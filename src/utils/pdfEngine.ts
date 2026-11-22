import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
// Metro ESM tslib.default 호환성 충돌을 방지하기 위해 단일 번들(pdf-lib.min.js)에서 로드
// eslint-disable-next-line @typescript-eslint/no-var-requires
export const { PDFDocument, degrees, rgb } = require('pdf-lib/dist/pdf-lib.min.js') as typeof import('pdf-lib');
import {
  FreeHandStroke,
  FreeTextBox,
  PaperTemplate,
  PdfCommentThread,
  PdfDocumentMeta,
  PdfHeaderFooterConfig,
  PdfPageData,
  PdfRedactionRect,
  PdfStampItem,
  PdfTextSpan,
  PdfWatermarkConfig,
} from '../types/note';

let cachedPdfJs: any = null;

/**
 * 원본 PDF 바이너리 메모리 레지스트리
 * - 보이는 쪽부터 지연 렌더링(ensurePdfPageRendered)
 * - PDF 내보내기 시 원본 벡터 텍스트 페이지 보존(copyPages)
 */
const pdfBinaryRegistry = new Map<string, Uint8Array>();

export function registerPdfBinary(sourceDocId: string, bytes: Uint8Array): void {
  pdfBinaryRegistry.set(sourceDocId, bytes);
}

export function getPdfBinary(sourceDocId?: string): Uint8Array | null {
  if (!sourceDocId) return null;
  return pdfBinaryRegistry.get(sourceDocId) || null;
}

export function base64ToUint8Array(base64: string): Uint8Array {
  const clean = base64.includes(',') ? base64.split(',')[1] : base64;
  if (typeof atob === 'function') {
    const bin = atob(clean);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const lookup = new Uint8Array(256);
  for (let i = 0; i < chars.length; i++) lookup[chars.charCodeAt(i)] = i;
  let bufferLength = clean.length * 0.75;
  if (clean[clean.length - 1] === '=') bufferLength--;
  if (clean[clean.length - 2] === '=') bufferLength--;
  const bytes = new Uint8Array(bufferLength);
  let p = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const encoded1 = lookup[clean.charCodeAt(i)];
    const encoded2 = lookup[clean.charCodeAt(i + 1)];
    const encoded3 = lookup[clean.charCodeAt(i + 2)];
    const encoded4 = lookup[clean.charCodeAt(i + 3)];
    bytes[p++] = (encoded1 << 2) | (encoded2 >> 4);
    if (p < bufferLength) bytes[p++] = ((encoded2 & 15) << 4) | (encoded3 >> 2);
    if (p < bufferLength) bytes[p++] = ((encoded3 & 3) << 6) | (encoded4 & 63);
  }
  return bytes;
}

export function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const sub = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, Array.from(sub));
  }
  if (typeof btoa === 'function') return btoa(binary);
  return '';
}

/**
 * public/pdfjs/ 에 배치된 오프라인 pdfjs-dist 엔진을 동적으로 로드 (Metro 번들러 충돌/비대화 0%)
 */
async function loadOfflinePdfJs(): Promise<any | null> {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  if (cachedPdfJs) return cachedPdfJs;

  try {
    const dynamicImport = new Function('u', 'return import(u)') as (u: string) => Promise<any>;
    const origin = window.location.origin;
    const pdfjs = await dynamicImport(`${origin}/pdfjs/pdf.min.mjs`);
    if (pdfjs?.GlobalWorkerOptions) {
      pdfjs.GlobalWorkerOptions.workerSrc = `${origin}/pdfjs/pdf.worker.min.mjs`;
    }
    cachedPdfJs = pdfjs;
    return pdfjs;
  } catch (err) {
    console.warn('Offline PDF.js load fallback:', err);
    return null;
  }
}

/**
 * 이미지 Data URL을 HTMLImageElement로 비동기 로드
 */
function loadHtmlImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = src;
  });
}

/**
 * 단어/문자 단위 Canvas 2D 줄바꿈 유틸 (한글/영문 혼용 정밀 지원)
 */
function wrapCanvasLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const result: string[] = [];
  const paragraphs = (text || '').split('\n');
  for (const para of paragraphs) {
    if (!para.trim()) {
      result.push('');
      continue;
    }
    let current = '';
    for (let i = 0; i < para.length; i++) {
      const ch = para[i];
      const next = current + ch;
      if (ctx.measureText(next).width > maxWidth && current.length > 0) {
        result.push(current);
        current = ch === ' ' ? '' : ch;
      } else {
        current = next;
      }
    }
    if (current) result.push(current);
  }
  return result;
}

/**
 * 지연 렌더링된 페이지(80쪽 등 대용량 PDF의 중간/후반 페이지)를 실제로 화면에 보여줄 때 즉시 렌더링
 */
export async function ensurePdfPageRendered(pageData: PdfPageData): Promise<string | undefined> {
  if (pageData.renderedImageUri) return pageData.renderedImageUri;
  if (!pageData.sourceDocId || !pageData.sourcePageNumber) return undefined;
  const rawBytes = getPdfBinary(pageData.sourceDocId);
  if (!rawBytes) return undefined;

  const pdfjs = await loadOfflinePdfJs();
  if (!pdfjs || typeof document === 'undefined') return undefined;

  try {
    const loadingTask = pdfjs.getDocument({
      data: new Uint8Array(rawBytes.slice(0)),
      useSystemFonts: true,
    });
    const pdfDoc = await loadingTask.promise;
    const pNum = Math.max(1, Math.min(pdfDoc.numPages || 1, pageData.sourcePageNumber));
    const page = await pdfDoc.getPage(pNum);
    const baseViewport = page.getViewport({ scale: 1.0 });
    const targetWidth = 960;
    const renderScale = Math.min(2.0, Math.max(1.0, targetWidth / Math.max(1, baseViewport.width)));
    const viewport = page.getViewport({ scale: renderScale });

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const ctx = canvas.getContext('2d');
    let dataUrl: string | undefined;
    if (ctx) {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport }).promise;
      dataUrl = canvas.toDataURL('image/jpeg', 0.82);
      pageData.renderedImageUri = dataUrl;
    }
    try {
      await pdfDoc.destroy();
    } catch {
      // ignore
    }
    return dataUrl;
  } catch (err) {
    console.warn('On-demand PDF page render error:', err);
    return undefined;
  }
}

export type PdfInputSource =
  | File
  | {
      name: string;
      bytes: Uint8Array | ArrayBuffer;
    };

/**
 * 실제 업로드된 .pdf 바이너리 파일을 PDF.js로 페이지 제한 없이(80쪽 이상 대용량 포함)
 * 보이는 쪽부터 고화질 렌더링 + 2단/다단 2D 글자 위치(textItems) 및 읽기 순서 텍스트 추출 + 메타데이터 파싱
 */
export async function renderRealPdfFile(
  fileOrSource: PdfInputSource,
  onProgress?: (current: number, total: number) => void
): Promise<{
  pages: PdfPageData[];
  meta: PdfDocumentMeta;
  usedRealRenderer: boolean;
  sourceDocId: string;
}> {
  const fileName = fileOrSource.name || '불러온_문서.pdf';
  const baseName = fileName.replace(/\.pdf$/i, '') || '불러온 문서';
  const rawBuffer: ArrayBuffer =
    typeof (fileOrSource as File).arrayBuffer === 'function'
      ? await (fileOrSource as File).arrayBuffer()
      : (fileOrSource as { bytes: Uint8Array | ArrayBuffer }).bytes instanceof Uint8Array
      ? ((fileOrSource as { bytes: Uint8Array }).bytes.buffer.slice(
          (fileOrSource as { bytes: Uint8Array }).bytes.byteOffset,
          (fileOrSource as { bytes: Uint8Array }).bytes.byteOffset +
            (fileOrSource as { bytes: Uint8Array }).bytes.byteLength
        ) as ArrayBuffer)
      : ((fileOrSource as { bytes: ArrayBuffer }).bytes as ArrayBuffer);

  const sourceDocId = `pdfsrc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const rawBytes = new Uint8Array(rawBuffer.slice(0));
  registerPdfBinary(sourceDocId, rawBytes);

  // 1차: 실제 PDF.js 엔진으로 원본 레이아웃/표/이미지/텍스트 100% 렌더링 (40쪽 제한 완전 해제)
  const pdfjs = await loadOfflinePdfJs();
  if (pdfjs && typeof document !== 'undefined') {
    try {
      const loadingTask = pdfjs.getDocument({
        data: new Uint8Array(rawBuffer.slice(0)),
        useSystemFonts: true,
      });
      const pdfDoc = await loadingTask.promise;
      const numPages = Math.max(1, pdfDoc.numPages || 1);

      let meta: PdfDocumentMeta = {};
      try {
        const metaObj = await pdfDoc.getMetadata();
        const info = metaObj?.info || {};
        meta = {
          author: info.Author ? String(info.Author) : undefined,
          subject: info.Subject ? String(info.Subject) : undefined,
          keywords: info.Keywords ? String(info.Keywords) : undefined,
        };
      } catch {
        // ignore metadata errors
      }

      // 20쪽 이하 문서는 전 페이지 즉시 렌더링, 대용량 문서(예: 60~100쪽)는 초반 12쪽 + 마지막 쪽을 즉시 렌더링하고 나머지는 보이는 즉시 지연 렌더링
      const eagerRenderThreshold = numPages <= 20 ? numPages : 12;

      const pages: PdfPageData[] = [];
      for (let i = 1; i <= numPages; i++) {
        onProgress?.(i, numPages);
        const page = await pdfDoc.getPage(i);
        const baseViewport = page.getViewport({ scale: 1.0 });
        const pageW = Math.max(1, baseViewport.width);
        const pageH = Math.max(1, baseViewport.height);

        let renderedImageUri: string | undefined;
        const shouldEagerRender = i <= eagerRenderThreshold || i === numPages;
        if (shouldEagerRender) {
          const targetWidth = numPages > 15 ? 860 : 1080;
          const renderScale = Math.min(2.0, Math.max(1.0, targetWidth / pageW));
          const viewport = page.getViewport({ scale: renderScale });

          const canvas = document.createElement('canvas');
          canvas.width = Math.round(viewport.width);
          canvas.height = Math.round(viewport.height);
          const ctx = canvas.getContext('2d');

          if (ctx) {
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            await page.render({ canvasContext: ctx, viewport }).promise;
            renderedImageUri = canvas.toDataURL('image/jpeg', numPages > 15 ? 0.78 : 0.86);
          }
        }

        // 실제 글자 위치(X, Y, W, H) 스팬 배열 + 읽기 순서 텍스트 추출 (2단 논문 좌/우 문단 분리 발췌 지원)
        let extractedText = '';
        const textItems: PdfTextSpan[] = [];
        try {
          const textContent = await page.getTextContent();
          const rawSpans: Array<PdfTextSpan & { rawY: number }> = [];
          for (const item of textContent.items as any[]) {
            const str = typeof item.str === 'string' ? item.str : '';
            if (!str || !str.trim()) continue;
            const tx = Array.isArray(item.transform) ? Number(item.transform[4]) || 0 : 0;
            const ty = Array.isArray(item.transform) ? Number(item.transform[5]) || 0 : 0;
            const fontH = Array.isArray(item.transform)
              ? Math.max(8, Math.hypot(Number(item.transform[2]) || 0, Number(item.transform[3]) || 12))
              : 12;
            const itemW =
              typeof item.width === 'number' && item.width > 0
                ? item.width
                : Math.max(fontH * 0.5, str.length * fontH * 0.52);
            const itemH =
              typeof item.height === 'number' && item.height > 0 ? item.height : fontH;

            const nx = Math.max(0, Math.min(1, tx / pageW));
            const topPx = pageH - ty - itemH * 0.85;
            const ny = Math.max(0, Math.min(1, topPx / pageH));
            const nw = Math.max(0.005, Math.min(1 - nx, itemW / pageW));
            const nh = Math.max(0.008, Math.min(1 - ny, (itemH * 1.15) / pageH));

            const span: PdfTextSpan = { text: str, nx, ny, nw, nh };
            textItems.push(span);
            rawSpans.push({ ...span, rawY: Math.round(ty) });
          }

          // Y(줄) 기준으로 그룹핑하되 같은 줄 안에서 좌/우 단 간격이 크면 4칸 공백으로 구분
          const lines: string[] = [];
          let currentLineSpans: Array<PdfTextSpan & { rawY: number }> = [];
          let lastY: number | null = null;
          for (const sp of rawSpans) {
            if (lastY !== null && Math.abs(sp.rawY - lastY) > 6) {
              if (currentLineSpans.length > 0) {
                currentLineSpans.sort((a, b) => a.nx - b.nx);
                let lineStr = '';
                let prevRight = 0;
                for (let k = 0; k < currentLineSpans.length; k++) {
                  const cur = currentLineSpans[k];
                  if (k > 0) {
                    const gap = cur.nx - prevRight;
                    lineStr += gap > 0.06 ? '    ' : ' ';
                  }
                  lineStr += cur.text.trim();
                  prevRight = cur.nx + cur.nw;
                }
                if (lineStr.trim()) lines.push(lineStr.trim());
              }
              currentLineSpans = [sp];
            } else {
              currentLineSpans.push(sp);
            }
            lastY = sp.rawY;
          }
          if (currentLineSpans.length > 0) {
            currentLineSpans.sort((a, b) => a.nx - b.nx);
            let lineStr = '';
            let prevRight = 0;
            for (let k = 0; k < currentLineSpans.length; k++) {
              const cur = currentLineSpans[k];
              if (k > 0) {
                const gap = cur.nx - prevRight;
                lineStr += gap > 0.06 ? '    ' : ' ';
              }
              lineStr += cur.text.trim();
              prevRight = cur.nx + cur.nw;
            }
            if (lineStr.trim()) lines.push(lineStr.trim());
          }
          extractedText = lines.join('\n').trim();
        } catch {
          // ignore text extraction errors
        }

        const firstLine = extractedText.split('\n').find((l) => l.trim().length > 2);
        pages.push({
          id: `pdfp_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 6)}`,
          pageNumber: i,
          title: firstLine ? firstLine.slice(0, 48) : `${baseName} — Page ${i}`,
          subtitle: `${fileName} (${i}/${numPages} 페이지 · 원본 PDF)`,
          content: extractedText,
          sourcePdfName: fileName,
          renderedImageUri,
          aspectRatio: pageW / pageH,
          textItems,
          sourceDocId,
          sourcePageNumber: i,
        });
      }

      try {
        await pdfDoc.destroy();
      } catch {
        // ignore
      }

      return { pages, meta, usedRealRenderer: true, sourceDocId };
    } catch (err) {
      console.warn('PDF.js render failed, falling back to pdf-lib / byte parser:', err);
    }
  }

  // 2차 폴백 (모바일 네이티브 및 PDF.js 미동작 시): pdf-lib + 전체 바이트 스캔 (페이지 수 30쪽 제한 제거)
  let pageCount = 1;
  let fallbackMeta: PdfDocumentMeta = {};
  const pageAspects: number[] = [];

  try {
    const pdfLibDoc = await PDFDocument.load(rawBytes, { ignoreEncryption: true });
    pageCount = Math.max(1, pdfLibDoc.getPageCount());
    fallbackMeta = {
      author: pdfLibDoc.getAuthor() || undefined,
      subject: pdfLibDoc.getSubject() || undefined,
      keywords: pdfLibDoc.getKeywords() || undefined,
    };
    for (let i = 0; i < pageCount; i++) {
      const sz = pdfLibDoc.getPage(i).getSize();
      pageAspects.push(sz.width / Math.max(1, sz.height));
    }
  } catch {
    let raw = '';
    const maxScan = rawBytes.length;
    for (let i = 0; i < maxScan; i++) {
      raw += String.fromCharCode(rawBytes[i]);
    }
    const pageMatches = raw.match(/\/Type\s*\/Page\b(?!s)/g);
    pageCount = Math.max(1, pageMatches ? pageMatches.length : 1);
  }

  const sizeKb = Math.max(1, Math.round(rawBytes.byteLength / 1024));
  const pages: PdfPageData[] = Array.from({ length: pageCount }).map((_, idx) => ({
    id: `pdfp_${Date.now()}_${idx + 1}_${Math.random().toString(36).substring(2, 6)}`,
    pageNumber: idx + 1,
    title: `${baseName} — Page ${idx + 1}`,
    subtitle: `${fileName} (${idx + 1}/${pageCount} 페이지)`,
    content: `[PDF 문서] ${fileName} — P.${idx + 1}/${pageCount} (${sizeKb} KB)`,
    sourcePdfName: fileName,
    aspectRatio: pageAspects[idx] || 720 / 1018,
    sourceDocId,
    sourcePageNumber: idx + 1,
  }));

  return { pages, meta: fallbackMeta, usedRealRenderer: false, sourceDocId };
}

/**
 * 여러 장의 이미지 파일(.png, .jpg, .webp 등)을 하나의 PDF 페이지 배열로 즉시 변환 (Create PDF from Images)
 */
export async function createPdfPagesFromImages(files: File[]): Promise<PdfPageData[]> {
  const pages: PdfPageData[] = [];

  for (let idx = 0; idx < files.length; idx++) {
    const file = files[idx];
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    // 이미지 용량 최적화 (최대 폭 1240px JPEG 압축)
    let optimizedUri = dataUrl;
    let aspectRatio = 720 / 1018;

    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      try {
        const img = await loadHtmlImage(dataUrl);
        aspectRatio = img.width / Math.max(1, img.height);
        const maxW = 1240;
        const scale = img.width > maxW ? maxW / img.width : 1;
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * scale);
        c.height = Math.round(img.height * scale);
        const ctx = c.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, c.width, c.height);
          ctx.drawImage(img, 0, 0, c.width, c.height);
          optimizedUri = c.toDataURL('image/jpeg', 0.88);
        }
      } catch {
        // use original dataUrl
      }
    }

    pages.push({
      id: `imgpdf_${Date.now()}_${idx + 1}_${Math.random().toString(36).substring(2, 6)}`,
      pageNumber: idx + 1,
      title: file.name.replace(/\.[^.]+$/, '') || `이미지 페이지 ${idx + 1}`,
      subtitle: `이미지에서 생성됨 (${idx + 1}/${files.length})`,
      content: '',
      sourcePdfName: file.name,
      renderedImageUri: optimizedUri,
      aspectRatio,
    });
  }

  return pages;
}

export interface CompositePageRenderParams {
  pageNumber: number;
  totalPages: number;
  pageWidth: number;
  pageHeight: number;
  isPdfMode: boolean;
  isNightMode: boolean;
  paperTemplate: PaperTemplate;
  pdfPage: PdfPageData | null;
  strokes: FreeHandStroke[];
  textBoxes: FreeTextBox[];
  stamps: PdfStampItem[];
  redactions: PdfRedactionRect[];
  watermark?: PdfWatermarkConfig;
  headerFooter?: PdfHeaderFooterConfig;
  scale?: number;
  /** true일 경우 원본 배경/PDF 이미지를 그리지 않고 필기·텍스트·스탬프·워터마크만 투명 캔버스에 렌더링 (원본 벡터 PDF 페이지 위 오버레이용) */
  annotationOnlyTransparent?: boolean;
}

/**
 * 단일 문서 페이지(원본 PDF 이미지/본문 + 속지 + 워터마크 + 머리글/바닥글 + 필기 + 텍스트 + 스탬프 + 먹칠)를
 * 고해상도 HTML5 Canvas로 합성합니다. (실제 PDF 내보내기 & PNG 저장 공용 엔진)
 */
export async function renderCompositePageToCanvas(
  params: CompositePageRenderParams
): Promise<HTMLCanvasElement | null> {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return null;

  const {
    pageNumber,
    totalPages,
    pageWidth,
    pageHeight,
    isPdfMode,
    isNightMode,
    paperTemplate,
    pdfPage,
    strokes,
    textBoxes,
    stamps,
    redactions,
    watermark,
    headerFooter,
    scale = 2,
    annotationOnlyTransparent = false,
  } = params;

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(pageWidth * scale);
  canvas.height = Math.round(pageHeight * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.scale(scale, scale);

  if (!annotationOnlyTransparent) {
    // 지연 렌더링된 페이지가 아직 렌더링되지 않았다면 지금 즉시 렌더링
    if (isPdfMode && pdfPage && !pdfPage.renderedImageUri && pdfPage.sourceDocId) {
      await ensurePdfPageRendered(pdfPage);
    }

    // 1. 배경색 및 속지 패턴
    const isDarkBg = isNightMode || paperTemplate === 'dark';
    ctx.fillStyle = isNightMode ? '#0F172A' : paperTemplate === 'dark' ? '#1E293B' : '#FFFFFF';
    ctx.fillRect(0, 0, pageWidth, pageHeight);

    if (!pdfPage?.renderedImageUri && (!isPdfMode || paperTemplate !== 'blank')) {
      if (paperTemplate === 'lined' || paperTemplate === 'cornell') {
        ctx.strokeStyle = isDarkBg ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)';
        ctx.lineWidth = 1;
        for (let y = 14; y < pageHeight; y += 28) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(pageWidth, y);
          ctx.stroke();
        }
        if (paperTemplate === 'cornell') {
          ctx.strokeStyle = 'rgba(225,29,72,0.24)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(pageWidth * 0.28, 0);
          ctx.lineTo(pageWidth * 0.28, pageHeight);
          ctx.stroke();
        }
      } else if (paperTemplate === 'grid' || paperTemplate === 'dark') {
        ctx.strokeStyle = isDarkBg ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.07)';
        ctx.lineWidth = 1;
        for (let x = 0; x <= pageWidth; x += 24) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, pageHeight);
          ctx.stroke();
        }
        for (let y = 0; y <= pageHeight; y += 24) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(pageWidth, y);
          ctx.stroke();
        }
      } else if (paperTemplate === 'dot') {
        ctx.fillStyle = 'rgba(15,23,42,0.16)';
        for (let x = 10; x < pageWidth; x += 20) {
          for (let y = 10; y < pageHeight; y += 20) {
            ctx.beginPath();
            ctx.arc(x, y, 1.2, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    }

    // 2. 원본 PDF 렌더링 이미지 또는 텍스트 기반 PDF 레이아웃
    if (isPdfMode && pdfPage) {
      if (pdfPage.renderedImageUri) {
        try {
          const img = await loadHtmlImage(pdfPage.renderedImageUri);
          const imgRatio = img.width / Math.max(1, img.height);
          const pageRatio = pageWidth / Math.max(1, pageHeight);
          let drawW = pageWidth;
          let drawH = pageHeight;
          let drawX = 0;
          let drawY = 0;
          if (imgRatio > pageRatio) {
            drawH = pageWidth / imgRatio;
            drawY = (pageHeight - drawH) / 2;
          } else {
            drawW = pageHeight * imgRatio;
            drawX = (pageWidth - drawW) / 2;
          }
          ctx.drawImage(img, drawX, drawY, drawW, drawH);
        } catch {
          // fall through
        }
      } else {
        const padX = 40;
        const contentMaxW = Math.max(200, pageWidth - padX * 2);
        let cy = 54;

        ctx.font = '700 11px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
        ctx.fillStyle = isNightMode ? '#60A5FA' : '#2563EB';
        ctx.fillText('STICKYCRAFT DOCUMENT', padX, cy);

        ctx.fillStyle = isNightMode ? '#94A3B8' : '#64748B';
        const pTag = `PAGE ${pageNumber} OF ${totalPages}`;
        ctx.fillText(pTag, pageWidth - padX - ctx.measureText(pTag).width, cy);
        cy += 32;

        ctx.font = '800 22px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
        ctx.fillStyle = isNightMode ? '#F8FAFC' : '#0F172A';
        for (const line of wrapCanvasLines(ctx, pdfPage.title || '', contentMaxW)) {
          ctx.fillText(line, padX, cy);
          cy += 30;
        }

        if (pdfPage.subtitle) {
          cy += 2;
          ctx.font = '600 14px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
          ctx.fillStyle = isNightMode ? '#94A3B8' : '#475569';
          for (const line of wrapCanvasLines(ctx, pdfPage.subtitle, contentMaxW)) {
            ctx.fillText(line, padX, cy);
            cy += 22;
          }
        }

        cy += 8;
        ctx.strokeStyle = isNightMode ? '#334155' : '#E2E8F0';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(padX, cy);
        ctx.lineTo(pageWidth - padX, cy);
        ctx.stroke();

        cy += 28;
        ctx.font = '400 14px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
        ctx.fillStyle = isNightMode ? '#E2E8F0' : '#334155';
        for (const line of wrapCanvasLines(ctx, pdfPage.content || '', contentMaxW)) {
          if (!line) {
            cy += 16;
            continue;
          }
          ctx.fillText(line, padX, cy);
          cy += 24;
        }
      }
    }
  }

  // 3. 머리글 / 바닥글 / 페이지 번호 (Header & Footer)
  if (headerFooter?.enabled) {
    ctx.save();
    ctx.font = '600 11px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.fillStyle = isNightMode ? '#94A3B8' : '#64748B';
    if (headerFooter.headerText.trim()) {
      ctx.fillText(headerFooter.headerText.trim(), 28, 24);
    }
    if (headerFooter.footerText.trim()) {
      ctx.fillText(headerFooter.footerText.trim(), 28, pageHeight - 16);
    }
    if (headerFooter.showPageNumbers) {
      const numStr = `${pageNumber} / ${totalPages}`;
      ctx.fillText(numStr, pageWidth - 28 - ctx.measureText(numStr).width, pageHeight - 16);
    }
    ctx.restore();
  }

  // 4. 대각선 워터마크 (Watermark)
  if (watermark?.enabled && watermark.text.trim()) {
    ctx.save();
    ctx.translate(pageWidth / 2, pageHeight / 2);
    ctx.rotate(-Math.PI / 5);
    ctx.globalAlpha = Math.max(0.05, Math.min(0.45, watermark.opacity || 0.14));
    ctx.font = '900 58px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.fillStyle = watermark.color || '#DC2626';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(watermark.text.trim(), 0, 0);
    ctx.restore();
  }

  // 5. 형광펜 & 필기/도형 스트로크
  const drawStrokes = (list: FreeHandStroke[], alpha: number) => {
    for (const s of list) {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = s.color || '#1E293B';
      ctx.lineWidth = s.width || 3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (s.tool === 'shape' && s.shapeStart && s.shapeEnd) {
        const st = s.shapeStart;
        const en = s.shapeEnd;
        if (s.shapeType === 'rect') {
          ctx.strokeRect(
            Math.min(st.x, en.x),
            Math.min(st.y, en.y),
            Math.abs(en.x - st.x),
            Math.abs(en.y - st.y)
          );
        } else if (s.shapeType === 'circle') {
          ctx.beginPath();
          ctx.arc(
            (st.x + en.x) / 2,
            (st.y + en.y) / 2,
            Math.hypot(en.x - st.x, en.y - st.y) / 2,
            0,
            Math.PI * 2
          );
          ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.moveTo(st.x, st.y);
          ctx.lineTo(en.x, en.y);
          ctx.stroke();
          if (s.shapeType === 'arrow') {
            const angle = Math.atan2(en.y - st.y, en.x - st.x);
            const hl = Math.max(12, (s.width || 3) * 3);
            ctx.beginPath();
            ctx.moveTo(en.x - hl * Math.cos(angle - Math.PI / 6), en.y - hl * Math.sin(angle - Math.PI / 6));
            ctx.lineTo(en.x, en.y);
            ctx.lineTo(en.x - hl * Math.cos(angle + Math.PI / 6), en.y - hl * Math.sin(angle + Math.PI / 6));
            ctx.stroke();
          }
        }
      } else if (s.points && s.points.length > 0) {
        ctx.beginPath();
        ctx.moveTo(s.points[0].x, s.points[0].y);
        if (s.points.length === 1) {
          ctx.lineTo(s.points[0].x + 0.5, s.points[0].y + 0.5);
        } else if (s.isPolygon || s.shapeType === 'rect' || s.shapeType === 'triangle') {
          for (let i = 1; i < s.points.length; i++) ctx.lineTo(s.points[i].x, s.points[i].y);
          ctx.closePath();
        } else {
          for (let i = 1; i < s.points.length - 1; i++) {
            const xc = (s.points[i].x + s.points[i + 1].x) / 2;
            const yc = (s.points[i].y + s.points[i + 1].y) / 2;
            ctx.quadraticCurveTo(s.points[i].x, s.points[i].y, xc, yc);
          }
          const last = s.points[s.points.length - 1];
          ctx.lineTo(last.x, last.y);
        }
        ctx.stroke();
      }
      ctx.restore();
    }
  };

  drawStrokes(strokes.filter((s) => s.tool === 'highlighter'), 0.38);
  drawStrokes(strokes.filter((s) => s.tool !== 'highlighter'), 1.0);

  // 6. 자유 텍스트 상자
  for (const tb of textBoxes) {
    if (!tb.text || !tb.text.trim()) continue;
    ctx.save();
    const fs = tb.fontSize || 16;
    ctx.font = `600 ${fs}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
    if (tb.backgroundColor && tb.backgroundColor !== 'transparent') {
      ctx.fillStyle = tb.backgroundColor;
      ctx.fillRect(tb.x - 4, tb.y - 2, ctx.measureText(tb.text).width + 12, fs + 10);
    }
    ctx.fillStyle = tb.color || '#1E293B';
    ctx.fillText(tb.text, tb.x, tb.y + fs);
    ctx.restore();
  }

  // 7. 스탬프 (승인 / 초안 / 기밀 / 검토 완료 등)
  for (const st of stamps) {
    ctx.save();
    ctx.translate(st.x + 68, st.y + 22);
    ctx.rotate(((st.rotation ?? -8) * Math.PI) / 180);
    ctx.strokeStyle = st.color || '#DC2626';
    ctx.lineWidth = 3;
    ctx.fillStyle = 'rgba(255,255,255,0.88)';
    ctx.fillRect(-68, -22, 136, 44);
    ctx.strokeRect(-68, -22, 136, 44);
    ctx.lineWidth = 1;
    ctx.strokeRect(-64, -18, 128, 36);
    ctx.fillStyle = st.color || '#DC2626';
    ctx.font = '900 15px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(st.label, 0, st.sublabel ? -5 : 0);
    if (st.sublabel) {
      ctx.font = '700 9px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
      ctx.fillText(st.sublabel, 0, 10);
    }
    ctx.restore();
  }

  // 8. 민감정보 먹칠/가림 (Redaction — 최상위 영구 검정 마스킹)
  for (const rd of redactions) {
    ctx.save();
    ctx.fillStyle = '#09090B';
    ctx.fillRect(rd.x, rd.y, rd.width, rd.height);
    if (rd.reason) {
      ctx.fillStyle = '#94A3B8';
      ctx.font = '700 10px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(rd.reason, rd.x + rd.width / 2, rd.y + rd.height / 2);
    }
    ctx.restore();
  }

  return canvas;
}

function parseHexRgb(hex?: string): { r: number; g: number; b: number } {
  const clean = (hex || '#1E293B').replace('#', '').trim();
  if (clean.length === 6) {
    const r = parseInt(clean.slice(0, 2), 16) / 255;
    const g = parseInt(clean.slice(2, 4), 16) / 255;
    const b = parseInt(clean.slice(4, 6), 16) / 255;
    if (!isNaN(r) && !isNaN(g) && !isNaN(b)) return { r, g, b };
  }
  return { r: 0.12, g: 0.16, b: 0.23 };
}

/**
 * pdf-lib 페이지 위에 벡터 필기 스트로크를 직접 그려 넣습니다 (캔버스 미지원 모바일/테스트 환경 및 벡터 확대 보존용)
 */
function drawVectorStrokesOnPdfPage(
  pdfPage: any,
  strokes: FreeHandStroke[],
  uiWidth: number,
  uiHeight: number
) {
  const { width: pdfW, height: pdfH } = pdfPage.getSize();
  const sx = pdfW / Math.max(1, uiWidth);
  const sy = pdfH / Math.max(1, uiHeight);

  for (const s of strokes) {
    const c = parseHexRgb(s.color);
    const colorObj = rgb(c.r, c.g, c.b);
    const opacity = s.tool === 'highlighter' ? 0.38 : 1.0;
    const thickness = Math.max(1, (s.width || 3) * sx);

    if (s.tool === 'shape' && s.shapeStart && s.shapeEnd) {
      const x1 = s.shapeStart.x * sx;
      const y1 = pdfH - s.shapeStart.y * sy;
      const x2 = s.shapeEnd.x * sx;
      const y2 = pdfH - s.shapeEnd.y * sy;
      pdfPage.drawLine({
        start: { x: x1, y: y1 },
        end: { x: x2, y: y2 },
        thickness,
        color: colorObj,
        opacity,
      });
    } else if (s.points && s.points.length > 0) {
      if (s.points.length === 1) {
        const px = s.points[0].x * sx;
        const py = pdfH - s.points[0].y * sy;
        pdfPage.drawLine({
          start: { x: px, y: py },
          end: { x: px + 0.8, y: py + 0.8 },
          thickness,
          color: colorObj,
          opacity,
        });
      } else {
        for (let i = 0; i < s.points.length - 1; i++) {
          const p1 = s.points[i];
          const p2 = s.points[i + 1];
          pdfPage.drawLine({
            start: { x: p1.x * sx, y: pdfH - p1.y * sy },
            end: { x: p2.x * sx, y: pdfH - p2.y * sy },
            thickness,
            color: colorObj,
            opacity,
          });
        }
      }
    }
  }
}

export interface ExportRealPdfParams {
  title: string;
  totalPages: number;
  pageWidth: number;
  pageHeight: number;
  isPdfMode: boolean;
  isNightMode: boolean;
  defaultTemplate: PaperTemplate;
  pageTemplates: Record<number, PaperTemplate>;
  pageRotations: Record<number, number>;
  pdfPages: PdfPageData[];
  strokes: Array<FreeHandStroke & { pageIndex?: number }>;
  textBoxes: FreeTextBox[];
  stamps: PdfStampItem[];
  redactions: PdfRedactionRect[];
  watermark?: PdfWatermarkConfig;
  headerFooter?: PdfHeaderFooterConfig;
  meta?: PdfDocumentMeta;
}

/**
 * 원본 PDF의 벡터 텍스트·폰트·도형을 그대로 보존(copyPages)하면서
 * 그 위에 필기·형광펜·텍스트 상자·스탬프·워터마크를 합성한 실제 .pdf 바이너리(Uint8Array)를 생성합니다.
 * 외부 PDF 리더에서 열었을 때 마지막 쪽(예: 80쪽) 필기가 선명하게 보이고 원문 문장 검색·복사가 그대로 동작합니다.
 */
export async function buildExportedPdfBytes(params: ExportRealPdfParams): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.setTitle(params.title || 'StickyCraft Document');
  if (params.meta?.author) pdfDoc.setAuthor(params.meta.author);
  if (params.meta?.subject) pdfDoc.setSubject(params.meta.subject);
  if (params.meta?.keywords) {
    pdfDoc.setKeywords(
      params.meta.keywords
        .split(',')
        .map((k) => k.trim())
        .filter(Boolean)
    );
  }
  pdfDoc.setProducer('StickyCraft Pro PDF Engine');
  pdfDoc.setCreator('StickyCraft Pro');

  // 원본 PDF 문서 캐시 로드 (동일 sourceDocId는 1회만 파싱)
  const loadedSourceDocs = new Map<string, any>();
  const getLoadedSourceDoc = async (sourceDocId?: string) => {
    if (!sourceDocId) return null;
    if (loadedSourceDocs.has(sourceDocId)) return loadedSourceDocs.get(sourceDocId);
    const bytes = getPdfBinary(sourceDocId);
    if (!bytes) return null;
    try {
      const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
      loadedSourceDocs.set(sourceDocId, doc);
      return doc;
    } catch {
      return null;
    }
  };

  const count = Math.max(1, params.totalPages);
  for (let pNum = 1; pNum <= count; pNum++) {
    const pageData = params.pdfPages[pNum - 1] || null;
    const pageStrokes = params.strokes.filter((s) => (s.pageIndex || 1) === pNum);
    const pageTextBoxes = params.textBoxes.filter((t) => (t.pageIndex || 1) === pNum);
    const pageStamps = params.stamps.filter((s) => s.pageIndex === pNum);
    const pageRedactions = params.redactions.filter((r) => r.pageIndex === pNum);

    const srcDoc =
      pageRedactions.length === 0 ? await getLoadedSourceDoc(pageData?.sourceDocId) : null;

    if (srcDoc && pageData?.sourcePageNumber) {
      // 원본 벡터 PDF 페이지를 그대로 복사하여 원문 텍스트 선택·검색 100% 유지!
      const srcIdx = Math.max(0, Math.min(srcDoc.getPageCount() - 1, pageData.sourcePageNumber - 1));
      const [copiedPage] = await pdfDoc.copyPages(srcDoc, [srcIdx]);
      const pdfPage = pdfDoc.addPage(copiedPage);
      const { width: pdfW, height: pdfH } = pdfPage.getSize();

      const hasAnnotations =
        pageStrokes.length > 0 ||
        pageTextBoxes.length > 0 ||
        pageStamps.length > 0 ||
        Boolean(params.watermark?.enabled && params.watermark.text.trim()) ||
        Boolean(params.headerFooter?.enabled);

      if (hasAnnotations) {
        // 1. 벡터 스트로크를 PDF 페이지 컨텐츠 스트림에 직접 기록
        if (pageStrokes.length > 0) {
          drawVectorStrokesOnPdfPage(pdfPage, pageStrokes, params.pageWidth, params.pageHeight);
        }
        // 2. 한글 텍스트 상자·스탬프·워터마크·머리글이 있는 경우 투명 PNG 오버레이도 함께 합성
        const hasRichOverlay =
          pageTextBoxes.length > 0 ||
          pageStamps.length > 0 ||
          Boolean(params.watermark?.enabled && params.watermark.text.trim()) ||
          Boolean(params.headerFooter?.enabled);

        if (hasRichOverlay && Platform.OS === 'web' && typeof document !== 'undefined') {
          const overlayCanvas = await renderCompositePageToCanvas({
            pageNumber: pNum,
            totalPages: count,
            pageWidth: params.pageWidth,
            pageHeight: params.pageHeight,
            isPdfMode: params.isPdfMode,
            isNightMode: params.isNightMode,
            paperTemplate: params.pageTemplates[pNum] || params.defaultTemplate,
            pdfPage: pageData,
            strokes: [], // 벡터로 이미 기록됨
            textBoxes: pageTextBoxes,
            stamps: pageStamps,
            redactions: [],
            watermark: params.watermark,
            headerFooter: params.headerFooter,
            scale: 1.8,
            annotationOnlyTransparent: true,
          });
          if (overlayCanvas) {
            const pngDataUrl = overlayCanvas.toDataURL('image/png');
            const pngBytes = base64ToUint8Array(pngDataUrl);
            const embeddedPng = await pdfDoc.embedPng(pngBytes);
            pdfPage.drawImage(embeddedPng, { x: 0, y: 0, width: pdfW, height: pdfH });
          }
        }
      }

      const rot = params.pageRotations[pNum] || 0;
      if (rot % 360 !== 0) {
        const curRot = pdfPage.getRotation().angle || 0;
        pdfPage.setRotation(degrees((curRot + rot) % 360));
      }
      continue;
    }

    // 원본 바이너리가 없는 자체 페이지 또는 민감정보 먹칠(Redaction) 영구 마스킹 페이지
    const a4W = 595.28;
    const a4H = (params.pageHeight / Math.max(1, params.pageWidth)) * a4W;
    const pdfPage = pdfDoc.addPage([a4W, a4H]);

    const canvas = await renderCompositePageToCanvas({
      pageNumber: pNum,
      totalPages: count,
      pageWidth: params.pageWidth,
      pageHeight: params.pageHeight,
      isPdfMode: params.isPdfMode,
      isNightMode: params.isNightMode,
      paperTemplate: params.pageTemplates[pNum] || params.defaultTemplate,
      pdfPage: pageData,
      strokes: pageStrokes,
      textBoxes: pageTextBoxes,
      stamps: pageStamps,
      redactions: pageRedactions,
      watermark: params.watermark,
      headerFooter: params.headerFooter,
      scale: 1.8,
    });

    if (canvas) {
      const jpgDataUrl = canvas.toDataURL('image/jpeg', 0.92);
      const bytes = base64ToUint8Array(jpgDataUrl);
      const embeddedImg = await pdfDoc.embedJpg(bytes);
      pdfPage.drawImage(embeddedImg, { x: 0, y: 0, width: a4W, height: a4H });
    } else if (pageStrokes.length > 0) {
      drawVectorStrokesOnPdfPage(pdfPage, pageStrokes, params.pageWidth, params.pageHeight);
    }

    const rot = params.pageRotations[pNum] || 0;
    if (rot % 360 !== 0) {
      pdfPage.setRotation(degrees(rot % 360));
    }
  }

  return await pdfDoc.save();
}

/**
 * pdf-lib를 사용하여 원문 텍스트와 필기·주석이 모두 반영된 실제 .pdf 파일을 다운로드(웹)하거나 시스템 공유 시트(모바일)로 공유합니다.
 */
export async function exportDocumentToRealPdf(params: ExportRealPdfParams): Promise<boolean> {
  const pdfBytes = await buildExportedPdfBytes(params);
  const safeName = (params.title || 'document').replace(/\.pdf$/i, '') + '.pdf';

  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const blob = new Blob([pdfBytes as any], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = safeName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return true;
  }

  try {
    const fileUri = `${FileSystem.documentDirectory || ''}${safeName}`;
    const base64Data = uint8ArrayToBase64(pdfBytes);
    await FileSystem.writeAsStringAsync(fileUri, base64Data, {
      encoding: FileSystem.EncodingType.Base64,
    });
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(fileUri, {
        mimeType: 'application/pdf',
        dialogTitle: `${safeName} 공유`,
        UTI: 'com.adobe.pdf',
      });
    }
    return true;
  } catch (err) {
    console.warn('Mobile PDF share failed:', err);
    return false;
  }
}

/**
 * 현재 페이지를 2x HiDPI PNG 이미지 파일로 즉시 다운로드 (Export to Image)
 */
export async function exportPageToPngFile(
  params: CompositePageRenderParams & { fileNameBase: string }
): Promise<boolean> {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return false;
  const canvas = await renderCompositePageToCanvas({ ...params, scale: 2 });
  if (!canvas) return false;
  const url = canvas.toDataURL('image/png');
  const a = document.createElement('a');
  a.href = url;
  a.download = `${params.fileNameBase.replace(/\.pdf$/i, '')}_P${params.pageNumber}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  return true;
}

/**
 * 문서 단어/글자 수 및 주석 통계 집계 (pdfcraft word_count_ui 스타일)
 */
export interface DocumentWordStats {
  totalPages: number;
  totalChars: number;
  totalWords: number;
  currentPageChars: number;
  currentPageWords: number;
  strokeCount: number;
  textBoxCount: number;
  stampCount: number;
  redactionCount: number;
  commentCount: number;
  openCommentCount: number;
}

export function computeDocumentWordStats(params: {
  pdfPages: PdfPageData[];
  currentPage: number;
  totalPages: number;
  strokes: FreeHandStroke[];
  textBoxes: FreeTextBox[];
  stamps: PdfStampItem[];
  redactions: PdfRedactionRect[];
  comments: PdfCommentThread[];
}): DocumentWordStats {
  const countText = (str: string) => {
    const clean = (str || '').trim();
    const chars = clean.replace(/\s/g, '').length;
    const words = clean ? clean.split(/\s+/).filter(Boolean).length : 0;
    return { chars, words };
  };

  let totalChars = 0;
  let totalWords = 0;
  let currentPageChars = 0;
  let currentPageWords = 0;

  params.pdfPages.forEach((p, idx) => {
    const pageNum = idx + 1;
    const text = [p.title, p.subtitle || '', p.content || ''].join('\n');
    const c = countText(text);
    totalChars += c.chars;
    totalWords += c.words;
    if (pageNum === params.currentPage) {
      currentPageChars += c.chars;
      currentPageWords += c.words;
    }
  });

  for (const tb of params.textBoxes) {
    const c = countText(tb.text);
    totalChars += c.chars;
    totalWords += c.words;
    if ((tb.pageIndex || 1) === params.currentPage) {
      currentPageChars += c.chars;
      currentPageWords += c.words;
    }
  }

  return {
    totalPages: params.totalPages,
    totalChars,
    totalWords,
    currentPageChars,
    currentPageWords,
    strokeCount: params.strokes.length,
    textBoxCount: params.textBoxes.length,
    stampCount: params.stamps.length,
    redactionCount: params.redactions.length,
    commentCount: params.comments.length,
    openCommentCount: params.comments.filter((c) => !c.resolved).length,
  };
}

/**
 * 두 PDF 문서의 페이지별 텍스트 차이점 비교 엔진 (pdfcraft compare_ui 스타일)
 */
export interface PdfPageDiffResult {
  pageNumber: number;
  status: 'same' | 'modified' | 'only-a' | 'only-b';
  titleA: string;
  titleB: string;
  imageA?: string;
  imageB?: string;
  lines: Array<{ type: 'same' | 'added' | 'removed'; text: string }>;
  addedCount: number;
  removedCount: number;
}

export function diffPdfDocuments(
  pagesA: PdfPageData[],
  pagesB: PdfPageData[]
): PdfPageDiffResult[] {
  const maxLen = Math.max(pagesA.length, pagesB.length);
  const results: PdfPageDiffResult[] = [];

  for (let i = 0; i < maxLen; i++) {
    const a = pagesA[i];
    const b = pagesB[i];
    if (a && !b) {
      const aLines = [a.title, ...(a.content || '').split('\n')].filter((l) => l.trim());
      results.push({
        pageNumber: i + 1,
        status: 'only-a',
        titleA: a.title,
        titleB: '(페이지 없음)',
        imageA: a.renderedImageUri,
        lines: aLines.map((t) => ({ type: 'removed', text: t })),
        addedCount: 0,
        removedCount: aLines.length,
      });
      continue;
    }
    if (!a && b) {
      const bLines = [b.title, ...(b.content || '').split('\n')].filter((l) => l.trim());
      results.push({
        pageNumber: i + 1,
        status: 'only-b',
        titleA: '(페이지 없음)',
        titleB: b.title,
        imageB: b.renderedImageUri,
        lines: bLines.map((t) => ({ type: 'added', text: t })),
        addedCount: bLines.length,
        removedCount: 0,
      });
      continue;
    }

    const linesA = [a.title, a.subtitle || '', ...(a.content || '').split('\n')]
      .map((l) => l.trim())
      .filter(Boolean);
    const linesB = [b.title, b.subtitle || '', ...(b.content || '').split('\n')]
      .map((l) => l.trim())
      .filter(Boolean);

    const setA = new Set(linesA);
    const setB = new Set(linesB);
    const diffLines: Array<{ type: 'same' | 'added' | 'removed'; text: string }> = [];
    let addedCount = 0;
    let removedCount = 0;

    for (const line of linesA) {
      if (setB.has(line)) {
        diffLines.push({ type: 'same', text: line });
      } else {
        diffLines.push({ type: 'removed', text: line });
        removedCount++;
      }
    }
    for (const line of linesB) {
      if (!setA.has(line)) {
        diffLines.push({ type: 'added', text: line });
        addedCount++;
      }
    }

    results.push({
      pageNumber: i + 1,
      status: addedCount === 0 && removedCount === 0 ? 'same' : 'modified',
      titleA: a.title,
      titleB: b.title,
      imageA: a.renderedImageUri,
      imageB: b.renderedImageUri,
      lines: diffLines,
      addedCount,
      removedCount,
    });
  }

  return results;
}
