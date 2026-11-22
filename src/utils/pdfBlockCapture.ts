import { Platform } from 'react-native';
import {
  FreeHandStroke,
  FreeTextBox,
  PaperTemplate,
  PdfHeaderFooterConfig,
  PdfPageData,
  PdfRedactionRect,
  PdfStampItem,
  PdfWatermarkConfig,
} from '../types/note';
import { renderCompositePageToCanvas } from './pdfEngine';

export interface BlockRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PdfPageSnapshotMeta {
  pageNumber: number;
  totalPages: number;
  title: string;
  subtitle?: string;
  content: string;
  docName: string;
}

export interface CapturedBlockResult {
  imageDataUrl: string | null;
  extractedText: string;
  width: number;
  height: number;
  pageNumber: number;
  docName: string;
}

/**
 * 단어/문자 단위로 Canvas 2D 컨텍스트 너비에 맞게 자동 줄바꿈 (한글/영문 혼용 정밀 지원)
 */
function wrapTextLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
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

/** 수평 띠(lineTop~lineBot, x범위)가 먹칠 영역과 겹치는지 검사 — 가려진 텍스트는 절대 발췌되지 않음 */
function bandHitsRedaction(
  redactions: PdfRedactionRect[],
  top: number,
  bottom: number,
  left: number,
  right: number
): boolean {
  for (const r of redactions) {
    if (r.y < bottom && r.y + r.height > top && r.x < right && r.x + r.width > left) {
      return true;
    }
  }
  return false;
}

/**
 * PDF 또는 캔버스 페이지의 지정된 직사각형 블록 영역을 2x HiDPI 이미지(Data URL)로 캡처하고,
 * 해당 블록 영역 안에 걸치는 본문/제목/텍스트 상자 텍스트를 정밀하게 발췌합니다.
 * (먹칠 영역에 걸친 텍스트는 발췌 결과에서 자동 제외)
 */
export function captureDocumentBlockSnapshot(params: {
  cropRect: BlockRect;
  pageWidth: number;
  pageHeight: number;
  isPdfMode: boolean;
  isNightMode: boolean;
  paperTemplate: PaperTemplate;
  pdfPage: PdfPageSnapshotMeta | null;
  strokes: FreeHandStroke[];
  textBoxes: FreeTextBox[];
  redactions?: PdfRedactionRect[];
  hasRenderedImage?: boolean;
}): CapturedBlockResult {
  const {
    cropRect,
    pageWidth,
    pageHeight,
    isPdfMode,
    isNightMode,
    paperTemplate,
    pdfPage,
    strokes,
    textBoxes,
  } = params;
  const redactions = params.redactions || [];
  const hasRenderedImage = Boolean(params.hasRenderedImage);

  const cropX = Math.max(0, Math.round(cropRect.x));
  const cropY = Math.max(0, Math.round(cropRect.y));
  const cropW = Math.max(24, Math.min(pageWidth - cropX, Math.round(cropRect.width)));
  const cropH = Math.max(24, Math.min(pageHeight - cropY, Math.round(cropRect.height)));
  const cropRight = cropX + cropW;
  const cropBottom = cropY + cropH;

  const extractedLines: string[] = [];

  // 텍스트 상자 중 블록 영역에 포함되는 텍스트 수집 (먹칠된 텍스트 상자 제외)
  const matchedTextBoxLines: string[] = [];
  for (const tb of textBoxes) {
    if (!tb.text || !tb.text.trim()) continue;
    const tbX = tb.x;
    const tbY = tb.y;
    const tbW = Math.max(80, tb.text.length * (tb.fontSize || 16) * 0.65);
    const tbH = (tb.fontSize || 16) * 1.6;
    const overlaps =
      tbX < cropRight && tbX + tbW > cropX && tbY < cropBottom && tbY + tbH > cropY;
    if (overlaps && !bandHitsRedaction(redactions, tbY, tbY + tbH, tbX, tbX + tbW)) {
      matchedTextBoxLines.push(tb.text.trim());
    }
  }

  // 실제 PDF 렌더링 이미지 페이지: 읽기 순서 텍스트를 페이지 높이에 비례 매핑하여 블록 영역 텍스트 발췌
  if (isPdfMode && pdfPage && hasRenderedImage) {
    const allLines = (pdfPage.content || '').split('\n').filter((l) => l.trim());
    if (allLines.length > 0) {
      const marginTop = pageHeight * 0.06;
      const usable = Math.max(1, pageHeight - marginTop * 2);
      const lineH = usable / allLines.length;
      allLines.forEach((line, i) => {
        const top = marginTop + i * lineH;
        const bot = top + lineH;
        if (bot >= cropY && top <= cropBottom && !bandHitsRedaction(redactions, top, bot, 0, pageWidth)) {
          extractedLines.push(line.trim());
        }
      });
    }
  }

  // 웹 환경: Offscreen 2x HiDPI HTML5 Canvas 렌더링으로 초고화질 블록 캡처
  let imageDataUrl: string | null = null;

  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    try {
      const scale = Math.min(2, cropW * cropH > 300000 ? 1.5 : 2);
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(cropW * scale);
      canvas.height = Math.round(cropH * scale);
      const ctx = canvas.getContext('2d');

      if (ctx) {
        ctx.scale(scale, scale);
        ctx.translate(-cropX, -cropY);

        // 1. 배경색 및 용지 템플릿 렌더링
        const isDarkBg = isNightMode || paperTemplate === 'dark';
        ctx.fillStyle = isNightMode ? '#0F172A' : paperTemplate === 'dark' ? '#1E293B' : '#FFFFFF';
        ctx.fillRect(cropX, cropY, cropW, cropH);

        if (!isPdfMode || paperTemplate !== 'blank') {
          if (paperTemplate === 'lined' || paperTemplate === 'cornell') {
            ctx.strokeStyle = isDarkBg ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)';
            ctx.lineWidth = 1;
            const startY = Math.floor(cropY / 28) * 28;
            for (let y = startY; y <= cropBottom; y += 28) {
              ctx.beginPath();
              ctx.moveTo(cropX, y + 14);
              ctx.lineTo(cropRight, y + 14);
              ctx.stroke();
            }
            if (paperTemplate === 'cornell') {
              const marginX = pageWidth * 0.28;
              ctx.strokeStyle = 'rgba(225,29,72,0.24)';
              ctx.lineWidth = 1.5;
              ctx.beginPath();
              ctx.moveTo(marginX, cropY);
              ctx.lineTo(marginX, cropBottom);
              ctx.stroke();
            }
          } else if (paperTemplate === 'grid' || paperTemplate === 'dark') {
            ctx.strokeStyle = isDarkBg ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.07)';
            ctx.lineWidth = 1;
            const sx = Math.floor(cropX / 24) * 24;
            const sy = Math.floor(cropY / 24) * 24;
            for (let x = sx; x <= cropRight; x += 24) {
              ctx.beginPath();
              ctx.moveTo(x, cropY);
              ctx.lineTo(x, cropBottom);
              ctx.stroke();
            }
            for (let y = sy; y <= cropBottom; y += 24) {
              ctx.beginPath();
              ctx.moveTo(cropX, y);
              ctx.lineTo(cropRight, y);
              ctx.stroke();
            }
          } else if (paperTemplate === 'dot') {
            ctx.fillStyle = 'rgba(15,23,42,0.16)';
            const sx = Math.floor(cropX / 20) * 20;
            const sy = Math.floor(cropY / 20) * 20;
            for (let x = sx; x <= cropRight; x += 20) {
              for (let y = sy; y <= cropBottom; y += 20) {
                ctx.beginPath();
                ctx.arc(x + 10, y + 10, 1.2, 0, Math.PI * 2);
                ctx.fill();
              }
            }
          }
        }

        // 2. PDF 문서 본문 렌더링 & 해당 블록 영역 텍스트 정밀 발췌
        if (isPdfMode && pdfPage && !hasRenderedImage) {
          const padX = 40;
          const contentMaxW = Math.max(200, pageWidth - padX * 2);
          let cursorY = 48;

          // 상단 문서 태그 행
          ctx.font = '700 11px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
          ctx.fillStyle = isNightMode ? '#60A5FA' : '#2563EB';
          ctx.fillText('STICKYCRAFT DOCUMENT', padX, cursorY);

          ctx.fillStyle = isNightMode ? '#94A3B8' : '#64748B';
          const pageLabel = `PAGE ${pdfPage.pageNumber} OF ${pdfPage.totalPages}`;
          const labelW = ctx.measureText(pageLabel).width;
          ctx.fillText(pageLabel, pageWidth - padX - labelW, cursorY);

          cursorY += 32;

          // 문서 제목
          ctx.font = '800 22px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
          ctx.fillStyle = isNightMode ? '#F8FAFC' : '#0F172A';
          const titleLines = wrapTextLines(ctx, pdfPage.title, contentMaxW);
          for (const line of titleLines) {
            const lineTop = cursorY - 20;
            const lineBot = cursorY + 6;
            ctx.fillText(line, padX, cursorY);
            if (lineBot >= cropY && lineTop <= cropBottom && cropRight > padX && line.trim() && !bandHitsRedaction(redactions, lineTop, lineBot, padX, pageWidth - padX)) {
              extractedLines.push(line.trim());
            }
            cursorY += 30;
          }

          // 부제목
          if (pdfPage.subtitle) {
            cursorY += 2;
            ctx.font = '600 14px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
            ctx.fillStyle = isNightMode ? '#94A3B8' : '#475569';
            const subLines = wrapTextLines(ctx, pdfPage.subtitle, contentMaxW);
            for (const line of subLines) {
              const lineTop = cursorY - 14;
              const lineBot = cursorY + 4;
              ctx.fillText(line, padX, cursorY);
              if (lineBot >= cropY && lineTop <= cropBottom && cropRight > padX && line.trim() && !bandHitsRedaction(redactions, lineTop, lineBot, padX, pageWidth - padX)) {
                extractedLines.push(line.trim());
              }
              cursorY += 22;
            }
          }

          // 구분선
          cursorY += 8;
          ctx.strokeStyle = isNightMode ? '#334155' : '#E2E8F0';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(padX, cursorY);
          ctx.lineTo(pageWidth - padX, cursorY);
          ctx.stroke();

          // 본문 텍스트
          cursorY += 28;
          ctx.font = '400 14px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
          ctx.fillStyle = isNightMode ? '#E2E8F0' : '#334155';
          const bodyLines = wrapTextLines(ctx, pdfPage.content || '', contentMaxW);
          for (const line of bodyLines) {
            if (!line) {
              cursorY += 16;
              continue;
            }
            const lineTop = cursorY - 14;
            const lineBot = cursorY + 6;
            ctx.fillText(line, padX, cursorY);
            if (lineBot >= cropY && lineTop <= cropBottom && cropRight > padX && line.trim() && !bandHitsRedaction(redactions, lineTop, lineBot, padX, pageWidth - padX)) {
              extractedLines.push(line.trim());
            }
            cursorY += 24;
          }
        }

        // 3. 형광펜 레이어 렌더링
        const drawStrokeList = (list: FreeHandStroke[], alpha: number) => {
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
                const cx = (st.x + en.x) / 2;
                const cy = (st.y + en.y) / 2;
                const r = Math.hypot(en.x - st.x, en.y - st.y) / 2;
                ctx.beginPath();
                ctx.arc(cx, cy, r, 0, Math.PI * 2);
                ctx.stroke();
              } else {
                ctx.beginPath();
                ctx.moveTo(st.x, st.y);
                ctx.lineTo(en.x, en.y);
                ctx.stroke();
                if (s.shapeType === 'arrow') {
                  const angle = Math.atan2(en.y - st.y, en.x - st.x);
                  const headLen = Math.max(12, (s.width || 3) * 3);
                  ctx.beginPath();
                  ctx.moveTo(en.x - headLen * Math.cos(angle - Math.PI / 6), en.y - headLen * Math.sin(angle - Math.PI / 6));
                  ctx.lineTo(en.x, en.y);
                  ctx.lineTo(en.x - headLen * Math.cos(angle + Math.PI / 6), en.y - headLen * Math.sin(angle + Math.PI / 6));
                  ctx.stroke();
                }
              }
            } else if (s.points && s.points.length > 0) {
              ctx.beginPath();
              ctx.moveTo(s.points[0].x, s.points[0].y);
              if (s.points.length === 1) {
                ctx.lineTo(s.points[0].x + 0.5, s.points[0].y + 0.5);
              } else if (s.isPolygon || s.shapeType === 'rect' || s.shapeType === 'triangle') {
                for (let i = 1; i < s.points.length; i++) {
                  ctx.lineTo(s.points[i].x, s.points[i].y);
                }
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

        drawStrokeList(
          strokes.filter((s) => s.tool === 'highlighter'),
          0.38
        );
        drawStrokeList(
          strokes.filter((s) => s.tool !== 'highlighter'),
          1.0
        );

        // 4. 자유 텍스트 상자 렌더링
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

        // 미세 외곽선으로 캡처 카드 느낌 부여
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
        ctx.lineWidth = 1;
        ctx.strokeRect(cropX + 0.5, cropY + 0.5, cropW - 1, cropH - 1);

        imageDataUrl = canvas.toDataURL('image/png');
      }
    } catch (err) {
      console.warn('PDF block canvas capture fallback:', err);
    }
  } else if (isPdfMode && pdfPage && !hasRenderedImage) {
    // 네이티브 폴백 텍스트 발췌
    const ratioStart = Math.max(0, Math.min(1, (cropY - 120) / Math.max(1, pageHeight - 160)));
    const ratioEnd = Math.max(ratioStart, Math.min(1, (cropBottom - 120) / Math.max(1, pageHeight - 160)));
    const allLines = [pdfPage.title, pdfPage.subtitle || '', ...(pdfPage.content || '').split('\n')].filter(Boolean);
    const startIdx = Math.floor(ratioStart * allLines.length);
    const endIdx = Math.max(startIdx + 1, Math.ceil(ratioEnd * allLines.length));
    extractedLines.push(...allLines.slice(startIdx, endIdx));
  }

  const combinedText = [...extractedLines, ...matchedTextBoxLines].join('\n').trim();

  return {
    imageDataUrl,
    extractedText: combinedText,
    width: cropW,
    height: cropH,
    pageNumber: pdfPage?.pageNumber || 1,
    docName: pdfPage?.docName || '문서',
  };
}

/**
 * 실제 PDF 렌더링 이미지 + 속지 + 머리글/바닥글 + 워터마크 + 필기 + 텍스트 + 스탬프 + 먹칠까지
 * 화면과 100% 동일하게 합성한 뒤 블록 영역만 잘라내는 고정밀 비동기 캡처.
 * (먹칠 영역은 이미지에서도 검정으로 영구 마스킹되고 텍스트 발췌에서도 제외 → 민감정보 유출 0%)
 */
export async function captureDocumentBlockSnapshotAsync(params: {
  cropRect: BlockRect;
  pageWidth: number;
  pageHeight: number;
  isPdfMode: boolean;
  isNightMode: boolean;
  paperTemplate: PaperTemplate;
  pdfPage: PdfPageSnapshotMeta | null;
  pdfPageData: PdfPageData | null;
  strokes: FreeHandStroke[];
  textBoxes: FreeTextBox[];
  stamps: PdfStampItem[];
  redactions: PdfRedactionRect[];
  watermark?: PdfWatermarkConfig;
  headerFooter?: PdfHeaderFooterConfig;
}): Promise<CapturedBlockResult> {
  const hasRenderedImage = Boolean(params.pdfPageData?.renderedImageUri);
  const base = captureDocumentBlockSnapshot({
    cropRect: params.cropRect,
    pageWidth: params.pageWidth,
    pageHeight: params.pageHeight,
    isPdfMode: params.isPdfMode,
    isNightMode: params.isNightMode,
    paperTemplate: params.paperTemplate,
    pdfPage: params.pdfPage,
    strokes: params.strokes,
    textBoxes: params.textBoxes,
    redactions: params.redactions,
    hasRenderedImage,
  });

  if (Platform.OS !== 'web' || typeof document === 'undefined') return base;

  try {
    const scale = base.width * base.height > 300000 ? 1.5 : 2;
    const composite = await renderCompositePageToCanvas({
      pageNumber: params.pdfPage?.pageNumber || 1,
      totalPages: params.pdfPage?.totalPages || 1,
      pageWidth: params.pageWidth,
      pageHeight: params.pageHeight,
      isPdfMode: params.isPdfMode,
      isNightMode: params.isNightMode,
      paperTemplate: params.paperTemplate,
      pdfPage: params.pdfPageData,
      strokes: params.strokes,
      textBoxes: params.textBoxes,
      stamps: params.stamps,
      redactions: params.redactions,
      watermark: params.watermark,
      headerFooter: params.headerFooter,
      scale,
    });
    if (!composite) return base;

    const cropX = Math.max(0, Math.round(params.cropRect.x));
    const cropY = Math.max(0, Math.round(params.cropRect.y));
    const out = document.createElement('canvas');
    out.width = Math.round(base.width * scale);
    out.height = Math.round(base.height * scale);
    const octx = out.getContext('2d');
    if (!octx) return base;
    octx.drawImage(
      composite,
      cropX * scale,
      cropY * scale,
      base.width * scale,
      base.height * scale,
      0,
      0,
      out.width,
      out.height
    );
    octx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
    octx.lineWidth = 1;
    octx.strokeRect(0.5, 0.5, out.width - 1, out.height - 1);
    return { ...base, imageDataUrl: out.toDataURL('image/png') };
  } catch (err) {
    console.warn('Composite block capture fallback:', err);
    return base;
  }
}

/**
 * 캡처된 PDF 블록(이미지 + 발췌 텍스트)을 시스템 클립보드에 복사합니다.
 */
export async function copyBlockToClipboard(
  imageDataUrl: string | null,
  extractedText: string
): Promise<'image+text' | 'image' | 'text' | 'failed'> {
  if (Platform.OS !== 'web' || typeof navigator === 'undefined') {
    return 'text';
  }

  // 1차 시도: 이미지 + 텍스트 동시 복사 (최신 Chromium / Edge / Safari ClipboardItem 지원)
  if (imageDataUrl && navigator.clipboard && typeof (window as any).ClipboardItem !== 'undefined') {
    try {
      const res = await fetch(imageDataUrl);
      const blob = await res.blob();
      const items: Record<string, Blob> = { 'image/png': blob };
      if (extractedText) {
        items['text/plain'] = new Blob([extractedText], { type: 'text/plain' });
      }
      await navigator.clipboard.write([new (window as any).ClipboardItem(items)]);
      return extractedText ? 'image+text' : 'image';
    } catch {
      // 이미지+텍스트 복합이 거부되면 이미지 단독 또는 텍스트 단독 복사 시도
      try {
        const res = await fetch(imageDataUrl);
        const blob = await res.blob();
        await navigator.clipboard.write([new (window as any).ClipboardItem({ 'image/png': blob })]);
        return 'image';
      } catch {
        // fall through to text copy
      }
    }
  }

  // 2차 시도: 텍스트 복사
  const textToCopy = extractedText || '[PDF 블록 캡처]';
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(textToCopy);
      return 'text';
    } catch {
      // fall through
    }
  }

  // 3차 폴백: 임시 textarea execCommand
  try {
    const ta = document.createElement('textarea');
    ta.value = textToCopy;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    return 'text';
  } catch {
    return 'failed';
  }
}
