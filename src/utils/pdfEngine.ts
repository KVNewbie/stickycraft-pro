import { Platform } from 'react-native';
// Metro ESM tslib.default 호환성 충돌을 방지하기 위해 단일 번들(pdf-lib.min.js)에서 로드
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { PDFDocument, degrees } = require('pdf-lib/dist/pdf-lib.min.js') as typeof import('pdf-lib');
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
  PdfWatermarkConfig,
} from '../types/note';

let cachedPdfJs: any = null;

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
 * 실제 업로드된 .pdf 바이너리 파일을 PDF.js로 페이지별 고화질 렌더링 + 읽기 순서 텍스트 추출 + 메타데이터 파싱
 */
export async function renderRealPdfFile(
  file: File,
  onProgress?: (current: number, total: number) => void
): Promise<{
  pages: PdfPageData[];
  meta: PdfDocumentMeta;
  usedRealRenderer: boolean;
}> {
  const baseName = file.name.replace(/\.pdf$/i, '') || '불러온 문서';
  const arrayBuffer = await file.arrayBuffer();

  // 1차: 실제 PDF.js 엔진으로 원본 레이아웃/표/이미지/텍스트 100% 렌더링
  const pdfjs = await loadOfflinePdfJs();
  if (pdfjs && typeof document !== 'undefined') {
    try {
      const loadingTask = pdfjs.getDocument({
        data: new Uint8Array(arrayBuffer.slice(0)),
        useSystemFonts: true,
      });
      const pdfDoc = await loadingTask.promise;
      const numPages = Math.max(1, Math.min(40, pdfDoc.numPages || 1));

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

      const pages: PdfPageData[] = [];
      for (let i = 1; i <= numPages; i++) {
        onProgress?.(i, numPages);
        const page = await pdfDoc.getPage(i);
        const baseViewport = page.getViewport({ scale: 1.0 });
        // A4 기준 1080px 너비 수준으로 선명하고 가볍게 렌더링 (메모리·속도 균형 최적화)
        const targetWidth = numPages > 15 ? 860 : 1080;
        const renderScale = Math.min(2.0, Math.max(1.0, targetWidth / Math.max(1, baseViewport.width)));
        const viewport = page.getViewport({ scale: renderScale });

        const canvas = document.createElement('canvas');
        canvas.width = Math.round(viewport.width);
        canvas.height = Math.round(viewport.height);
        const ctx = canvas.getContext('2d');

        let renderedImageUri: string | undefined;
        if (ctx) {
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          await page.render({ canvasContext: ctx, viewport }).promise;
          renderedImageUri = canvas.toDataURL('image/jpeg', numPages > 15 ? 0.78 : 0.86);
        }

        // 읽기 순서 기반 텍스트 추출 (문서 내 검색 Ctrl+F 및 블록 발췌 지원)
        let extractedText = '';
        try {
          const textContent = await page.getTextContent();
          const lines: string[] = [];
          let currentLine = '';
          let lastY: number | null = null;
          for (const item of textContent.items as any[]) {
            const str = typeof item.str === 'string' ? item.str : '';
            if (!str) continue;
            const y = Array.isArray(item.transform) ? Math.round(item.transform[5]) : null;
            if (lastY !== null && y !== null && Math.abs(y - lastY) > 6) {
              if (currentLine.trim()) lines.push(currentLine.trim());
              currentLine = str;
            } else {
              currentLine += (currentLine && !currentLine.endsWith(' ') && !str.startsWith(' ') ? ' ' : '') + str;
            }
            if (y !== null) lastY = y;
          }
          if (currentLine.trim()) lines.push(currentLine.trim());
          extractedText = lines.join('\n').trim();
        } catch {
          // ignore text extraction errors
        }

        const firstLine = extractedText.split('\n').find((l) => l.trim().length > 2);
        pages.push({
          id: `pdfp_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 6)}`,
          pageNumber: i,
          title: firstLine ? firstLine.slice(0, 48) : `${baseName} — Page ${i}`,
          subtitle: `${file.name} (${i}/${numPages} 페이지 · 원본 PDF 렌더링)`,
          content: extractedText,
          sourcePdfName: file.name,
          renderedImageUri,
          aspectRatio: baseViewport.width / Math.max(1, baseViewport.height),
        });
      }

      try {
        await pdfDoc.destroy();
      } catch {
        // ignore
      }

      return { pages, meta, usedRealRenderer: true };
    } catch (err) {
      console.warn('PDF.js render failed, falling back to lightweight parser:', err);
    }
  }

  // 2차 폴백: 경량 바이트 파서
  const bytes = new Uint8Array(arrayBuffer);
  let raw = '';
  const maxScan = Math.min(bytes.length, 400_000);
  for (let i = 0; i < maxScan; i++) {
    raw += String.fromCharCode(bytes[i]);
  }
  const pageMatches = raw.match(/\/Type\s*\/Page\b(?!s)/g);
  const pageCount = Math.max(1, Math.min(30, pageMatches ? pageMatches.length : 1));
  const pages: PdfPageData[] = Array.from({ length: pageCount }).map((_, idx) => ({
    id: `pdfp_${Date.now()}_${idx + 1}_${Math.random().toString(36).substring(2, 6)}`,
    pageNumber: idx + 1,
    title: `${baseName} — Page ${idx + 1}`,
    subtitle: `${file.name} (${idx + 1}/${pageCount} 페이지)`,
    content: `[로컬 파일 불러오기 완료] ${file.name}\n• 파일 크기: ${Math.max(1, Math.round(file.size / 1024))} KB\n• 이 페이지 위에 필기, 형광펜, 스탬프, 먹칠, 댓글을 자유롭게 추가할 수 있습니다.`,
    sourcePdfName: file.name,
  }));

  return { pages, meta: {}, usedRealRenderer: false };
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
  } = params;

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(pageWidth * scale);
  canvas.height = Math.round(pageHeight * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.scale(scale, scale);

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

/**
 * pdf-lib를 사용하여 편집·병합·분할·회전·필기·워터마크·스탬프·먹칠이 모두 반영된
 * 진짜 .pdf 바이너리 파일을 생성하고 다운로드합니다!
 */
export async function exportDocumentToRealPdf(params: {
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
}): Promise<boolean> {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return false;

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

  const count = Math.max(1, params.totalPages);
  for (let pNum = 1; pNum <= count; pNum++) {
    const pageData = params.pdfPages[pNum - 1] || null;
    const canvas = await renderCompositePageToCanvas({
      pageNumber: pNum,
      totalPages: count,
      pageWidth: params.pageWidth,
      pageHeight: params.pageHeight,
      isPdfMode: params.isPdfMode,
      isNightMode: params.isNightMode,
      paperTemplate: params.pageTemplates[pNum] || params.defaultTemplate,
      pdfPage: pageData,
      strokes: params.strokes.filter((s) => (s.pageIndex || 1) === pNum),
      textBoxes: params.textBoxes.filter((t) => (t.pageIndex || 1) === pNum),
      stamps: params.stamps.filter((s) => s.pageIndex === pNum),
      redactions: params.redactions.filter((r) => r.pageIndex === pNum),
      watermark: params.watermark,
      headerFooter: params.headerFooter,
      scale: 1.8,
    });

    if (!canvas) continue;
    const jpgDataUrl = canvas.toDataURL('image/jpeg', 0.92);
    const base64 = jpgDataUrl.split(',')[1];
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

    const embeddedImg = await pdfDoc.embedJpg(bytes);
    // A4 포인트 표준 크기 (595.28 x 841.89 pt)
    const a4W = 595.28;
    const a4H = (params.pageHeight / Math.max(1, params.pageWidth)) * a4W;
    const pdfPage = pdfDoc.addPage([a4W, a4H]);
    pdfPage.drawImage(embeddedImg, { x: 0, y: 0, width: a4W, height: a4H });

    const rot = params.pageRotations[pNum] || 0;
    if (rot % 360 !== 0) {
      pdfPage.setRotation(degrees(rot % 360));
    }
  }

  const pdfBytes = await pdfDoc.save();
  const blob = new Blob([pdfBytes as any], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const safeName = (params.title || 'document').replace(/\.pdf$/i, '') + '.pdf';
  a.href = url;
  a.download = safeName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
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
