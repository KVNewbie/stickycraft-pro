import { Platform, Alert } from 'react-native';
import * as Sharing from 'expo-sharing';
import { Note, ChecklistItem } from '../types/note';
import { NOTE_COLORS } from '../constants/colors';

interface ExportPdfOptions {
  note: Partial<Note>;
  drawingCanvasElement?: HTMLCanvasElement | null;
  pdfOrWorkspaceSnapshot?: string | null;
}

export const exportNoteToPdf = async ({
  note,
  drawingCanvasElement,
  pdfOrWorkspaceSnapshot,
}: ExportPdfOptions): Promise<boolean> => {
  try {
    if (Platform.OS !== 'web') {
      // 모바일 네이티브 환경 알림 및 공유 안내
      Alert.alert(
        'PDF 내보내기 안내',
        '모바일 기기에서는 [기기 공유] 기능을 통해 메모 내용과 사진을 PDF 또는 텍스트로 즉시 공유하실 수 있습니다.'
      );
      return true;
    }

    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const pageWidth = 210;
    const pageHeight = 297;
    const margin = 15;
    const contentWidth = pageWidth - margin * 2;

    // 1. 배경 색상 설정
    const noteColor = note.color && NOTE_COLORS[note.color] ? NOTE_COLORS[note.color] : NOTE_COLORS.yellow;
    
    // RGB 변환 헬퍼
    const hexToRgb = (hex: string) => {
      const cleaned = hex.replace('#', '');
      const num = parseInt(cleaned, 16);
      return {
        r: (num >> 16) & 255,
        g: (num >> 8) & 255,
        b: num & 255,
      };
    };

    const bgRgb = hexToRgb(noteColor.bg);
    doc.setFillColor(bgRgb.r, bgRgb.g, bgRgb.b);
    doc.rect(0, 0, pageWidth, pageHeight, 'F');

    // 2. 속지 패턴 그리기 (Lined, Grid, Cornell 등)
    if (note.paperTemplate === 'lined') {
      doc.setDrawColor(210, 210, 210);
      doc.setLineWidth(0.2);
      for (let y = 45; y < pageHeight - 15; y += 8) {
        doc.line(margin, y, pageWidth - margin, y);
      }
    } else if (note.paperTemplate === 'grid') {
      doc.setDrawColor(220, 220, 220);
      doc.setLineWidth(0.15);
      for (let x = margin; x <= pageWidth - margin; x += 6) {
        doc.line(x, 35, x, pageHeight - 15);
      }
      for (let y = 35; y <= pageHeight - 15; y += 6) {
        doc.line(margin, y, pageWidth - margin, y);
      }
    } else if (note.paperTemplate === 'cornell') {
      doc.setDrawColor(180, 180, 180);
      doc.setLineWidth(0.4);
      // 세로 구분선 (좌측 30%)
      doc.line(margin + 50, 40, margin + 50, pageHeight - 45);
      // 하단 요약 구분선
      doc.line(margin, pageHeight - 45, pageWidth - margin, pageHeight - 45);
    }

    let currentY = margin + 10;

    // 3. 타이틀 렌더링
    const title = note.title || '무제 메모';
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.setTextColor(33, 37, 41);
    doc.text(title, margin, currentY);
    currentY += 8;

    // 4. 날짜 및 태그 정보
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(110, 110, 110);
    const dateStr = note.updatedAt ? new Date(note.updatedAt).toLocaleString('ko-KR') : new Date().toLocaleString('ko-KR');
    const tagsStr = note.tags && note.tags.length > 0 ? `  |  ${note.tags.map((t) => '#' + t).join(' ')}` : '';
    doc.text(`${dateStr}${tagsStr}`, margin, currentY);
    currentY += 6;

    // 구분선
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.3);
    doc.line(margin, currentY, pageWidth - margin, currentY);
    currentY += 8;

    // 5. 자유 필기 캔버스 / 스냅샷이 있는 경우 (PDF 주석 또는 손글씨)
    let snapshotData = pdfOrWorkspaceSnapshot || note.freeDrawingData;
    if (!snapshotData && drawingCanvasElement) {
      try {
        snapshotData = drawingCanvasElement.toDataURL('image/png');
      } catch (e) {
        console.warn('Canvas toDataURL failed', e);
      }
    }

    if (snapshotData) {
      try {
        const drawingHeight = 90; // mm
        doc.addImage(snapshotData, 'PNG', margin, currentY, contentWidth, drawingHeight, undefined, 'FAST');
        currentY += drawingHeight + 8;
      } catch (err) {
        console.warn('Failed to embed drawing snapshot into PDF', err);
      }
    }

    // 6. 본문 텍스트 (줄바꿈 자동 처리)
    if (note.content) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      doc.setTextColor(40, 40, 40);
      const splitLines = doc.splitTextToSize(note.content, contentWidth);
      for (const line of splitLines) {
        if (currentY > pageHeight - margin - 10) {
          doc.addPage();
          doc.setFillColor(bgRgb.r, bgRgb.g, bgRgb.b);
          doc.rect(0, 0, pageWidth, pageHeight, 'F');
          currentY = margin + 10;
        }
        doc.text(line, margin, currentY);
        currentY += 6;
      }
      currentY += 4;
    }

    // 7. 체크리스트
    if (note.checklist && note.checklist.length > 0) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(30, 30, 30);
      if (currentY > pageHeight - margin - 20) {
        doc.addPage();
        currentY = margin + 10;
      }
      doc.text('Checklist', margin, currentY);
      currentY += 6;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      note.checklist.forEach((item: ChecklistItem) => {
        if (currentY > pageHeight - margin - 8) {
          doc.addPage();
          currentY = margin + 10;
        }
        const mark = item.completed ? '[V] ' : '[ ] ';
        doc.setTextColor(item.completed ? 120 : 40, item.completed ? 120 : 40, item.completed ? 120 : 40);
        doc.text(`${mark}${item.text}`, margin + 2, currentY);
        currentY += 5.5;
      });
    }

    // 8. 첨부 이미지 렌더링
    if (note.images && note.images.length > 0) {
      for (const img of note.images) {
        if (img.uri && (img.uri.startsWith('data:image') || img.uri.startsWith('http') || img.uri.startsWith('blob'))) {
          try {
            if (currentY + 50 > pageHeight - margin) {
              doc.addPage();
              currentY = margin + 10;
            }
            const imgHeight = 50;
            const imgWidth = 70;
            doc.addImage(img.uri, 'JPEG', margin, currentY, imgWidth, imgHeight, undefined, 'FAST');
            currentY += imgHeight + 6;
          } catch (e) {
            console.warn('Failed to embed attached note image to PDF', e);
          }
        }
      }
    }

    // 파일 저장
    const sanitizedTitle = (note.title || 'StickyCraft_Note').replace(/[/\\?%*:|"<>]/g, '_');
    doc.save(`${sanitizedTitle}.pdf`);
    return true;
  } catch (error) {
    console.error('PDF export error:', error);
    return false;
  }
};
