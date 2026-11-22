import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Image,
  Platform,
  Dimensions,
  PanResponder,
  GestureResponderEvent,
  Modal,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path as SvgPath, Rect, Circle, Line as SvgLine } from 'react-native-svg';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Plus,
  Undo2,
  Redo2,
  Mic,
  Share2,
  Layers,
  FileText,
  PenTool,
  Highlighter,
  Eraser,
  Square,
  Circle as CircleIcon,
  ArrowRight,
  Minus,
  Type,
  Palette,
  Maximize2,
  Trash2,
  Check,
  X,
  Upload,
  BookOpen,
  Hand,
  Search,
  Copy,
  Printer,
  Download,
  CheckCheck,
  LassoSelect,
  BoxSelect,
  Presentation,
  Bookmark,
  ZoomIn,
  ZoomOut,
  Minimize2,
  Zap,
  Moon,
  Sun,
  Sparkles,
  Shapes,
  List,
  RotateCw,
  Volume2,
  VolumeX,
  Combine,
  Scissors,
  LayoutGrid,
  Edit3,
  Crop,
  PanelRight,
  FilePlus2,
  ClipboardCopy,
  Stamp,
  EyeOff,
  MessageSquare,
  Droplets,
  ChartBar,
  GitCompare,
  Command,
  Columns2,
  Rows3,
  FileDown,
  ImageDown,
} from 'lucide-react-native';
import {
  Note,
  NoteImage,
  FreeHandStroke,
  AudioNote,
  PaperTemplate,
  FreeTextBox,
  PdfPageData,
  PdfViewLayout,
  PdfWatermarkConfig,
  PdfHeaderFooterConfig,
  PdfStampItem,
  PdfRedactionRect,
  PdfCommentThread,
  PdfDocumentMeta,
  PdfSourceLink,
} from '../types/note';
import { useNoteStore } from '../store/useNoteStore';
import { AudioRecordingStudio } from './AudioRecordingStudio';
import { PaperTemplatePattern } from './PaperTemplatePattern';
import { DraggableAudioPin } from './DraggableAudioPin';
import { DraggableTextBox } from './DraggableTextBox';
import { AudioPlayerBar } from './AudioPlayerBar';
import { recognizeShape } from '../utils/shapeRecognizer';
import {
  triggerWritingScratch,
  stopWritingScratch,
  playWritingSoundPreview,
} from '../utils/writingSound';
import {
  PdfOpenLauncherView,
  PdfAcrobatStudioPanel,
  PdfWorkspaceTab,
  parseUploadedPdfFile,
  extractPdfPagesFromNote,
  pickNativePdfFiles,
} from './PdfAcrobatStudioPanel';
import {
  captureDocumentBlockSnapshot,
  captureDocumentBlockSnapshotAsync,
  copyBlockToClipboard,
  BlockRect,
  CapturedBlockResult,
} from '../utils/pdfBlockCapture';
import { PdfSideNoteDrawer, SideNoteSnippetItem } from './PdfSideNoteDrawer';
import {
  exportDocumentToRealPdf,
  exportPageToPngFile,
  computeDocumentWordStats,
  ensurePdfPageRendered,
} from '../utils/pdfEngine';
import {
  PdfCommandPaletteModal,
  PdfWatermarkHeaderModal,
  PdfPropertiesStatsModal,
  PdfCompareModal,
  PdfCommentsDrawer,
  PdfCommandItem,
} from './PdfToolsOverlays';
import { EditorExitRef, useEditorAutosave } from '../utils/useEditorAutosave';
import { waitForNotesWrite } from '../utils/notePersistence';

interface DocumentWorkspaceModalProps {
  note?: Note | null;
  initialMode?: 'pdf' | 'canvas';
  onClose: () => void;
  exitRef?: EditorExitRef;
}

// 선분과 점 사이의 최단 거리 계산 (지우개 터치 감지 정확도 극대화)
const distanceToSegment = (
  p: { x: number; y: number },
  v: { x: number; y: number },
  w: { x: number; y: number }
) => {
  const l2 = (w.x - v.x) ** 2 + (w.y - v.y) ** 2;
  if (l2 === 0) return Math.hypot(p.x - v.x, p.y - v.y);
  let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (v.x + t * (w.x - v.x)), p.y - (v.y + t * (w.y - v.y)));
};

// 지우개 반경 내에 스트로크의 점 또는 선분, 도형이 닿았는지 판별
const strokeHitsEraser = (
  stroke: FreeHandStroke,
  ex: number,
  ey: number,
  radius = 28
) => {
  const strokeHitRadius = radius + (stroke.width ? stroke.width / 2 : 2);

  // 기하 도형(사각형, 원, 화살표, 직선) 지우개 충돌 검사
  if (stroke.tool === 'shape' && stroke.shapeStart && stroke.shapeEnd) {
    const s = stroke.shapeStart;
    const e = stroke.shapeEnd;
    if (stroke.shapeType === 'line' || stroke.shapeType === 'arrow') {
      return distanceToSegment({ x: ex, y: ey }, s, e) < strokeHitRadius;
    }
    const minX = Math.min(s.x, e.x) - strokeHitRadius;
    const maxX = Math.max(s.x, e.x) + strokeHitRadius;
    const minY = Math.min(s.y, e.y) - strokeHitRadius;
    const maxY = Math.max(s.y, e.y) + strokeHitRadius;
    return ex >= minX && ex <= maxX && ey >= minY && ey <= maxY;
  }

  if (!stroke.points || stroke.points.length === 0) return false;
  if (stroke.points.length === 1) {
    return Math.hypot(stroke.points[0].x - ex, stroke.points[0].y - ey) < strokeHitRadius;
  }
  for (let i = 0; i < stroke.points.length - 1; i++) {
    const d = distanceToSegment({ x: ex, y: ey }, stroke.points[i], stroke.points[i + 1]);
    if (d < strokeHitRadius) {
      return true;
    }
  }
  return false;
};

// 부드러운 Bézier 곡선 계산 또는 다각형/직사각형 직선/원형 렌더링
const pointsToSvgPath = (
  points: { x: number; y: number }[],
  isPolygon?: boolean,
  shapeType?: string
) => {
  if (!points || points.length === 0) return '';
  if (points.length === 1) {
    return `M ${points[0].x} ${points[0].y} L ${points[0].x + 0.1} ${points[0].y + 0.1}`;
  }
  if (points.length === 2) {
    return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
  }

  // 원형 (Circle / Ellipse): 수학적으로 정확한 SVG Arc 명령어로 매끄럽게 렌더링
  if (shapeType === 'circle') {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const p of points) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const rx = Math.max(2, (maxX - minX) / 2);
    const ry = Math.max(2, (maxY - minY) / 2);
    return `M ${cx - rx} ${cy} A ${rx} ${ry} 0 1 0 ${cx + rx} ${cy} A ${rx} ${ry} 0 1 0 ${cx - rx} ${cy} Z`;
  }

  // 직사각형, 정사각형, 삼각형 등 다각형이거나 끝점과 시작점이 일치하는 닫힌 다각형 점군인 경우
  const isClosedPoly =
    isPolygon ||
    shapeType === 'rect' ||
    shapeType === 'triangle' ||
    (points.length >= 4 &&
      points.length <= 8 &&
      Math.hypot(points[0].x - points[points.length - 1].x, points[0].y - points[points.length - 1].y) < 2);

  if (isClosedPoly) {
    let polyPath = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      polyPath += ` L ${points[i].x} ${points[i].y}`;
    }
    return polyPath + ' Z';
  }

  let path = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length - 1; i++) {
    const xc = (points[i].x + points[i + 1].x) / 2;
    const yc = (points[i].y + points[i + 1].y) / 2;
    path += ` Q ${points[i].x} ${points[i].y}, ${xc} ${yc}`;
  }
  const last = points[points.length - 1];
  path += ` L ${last.x} ${last.y}`;
  return path;
};

import { SAMPLE_DOCUMENTS, getSampleDocumentForNote } from '../constants/sampleDocuments';

interface StrokeWithPage extends FreeHandStroke {
  pageIndex: number;
}

const mapShapeType = (t: string | null): 'rect' | 'circle' | 'line' | 'triangle' | undefined => {
  if (t === 'rectangle') return 'rect';
  if (t === 'circle') return 'circle';
  if (t === 'line') return 'line';
  if (t === 'triangle') return 'triangle';
  return undefined;
};

// 60fps 드로잉 최적화: 확정된 필기/형광펜/도형 레이어를 메모이제이션하여 드로잉 중 재계산 차단
const CommittedDocumentStrokesLayer = React.memo(
  ({
    strokes,
    selectedStrokeIds,
  }: {
    strokes: StrokeWithPage[];
    selectedStrokeIds: string[];
  }) => {
    const selectedSet = React.useMemo(() => new Set(selectedStrokeIds), [selectedStrokeIds]);

    return (
      <>
        {/* 1. 형광펜 레이어 (반투명으로 글씨 뒤로 깔림) */}
        {strokes
          .filter((s) => s.tool === 'highlighter')
          .map((stroke) => {
            const isSel = selectedSet.has(stroke.id);
            return (
              <SvgPath
                key={stroke.id}
                d={pointsToSvgPath(
                  stroke.points,
                  stroke.isPolygon || stroke.shapeType === 'rect' || stroke.shapeType === 'triangle',
                  stroke.shapeType
                )}
                stroke={stroke.color}
                strokeWidth={stroke.width || 24}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={isSel ? 0.75 : 0.38}
              />
            );
          })}

        {/* 2. 일반 펜/만년필 및 기하 도형 레이어 */}
        {strokes
          .filter((s) => s.tool !== 'highlighter')
          .map((stroke) => {
            const isSel = selectedSet.has(stroke.id);
            if (stroke.tool === 'shape' && stroke.shapeStart && stroke.shapeEnd) {
              const s = stroke.shapeStart;
              const e = stroke.shapeEnd;
              if (stroke.shapeType === 'rect') {
                const rx = Math.min(s.x, e.x);
                const ry = Math.min(s.y, e.y);
                const rw = Math.max(2, Math.abs(e.x - s.x));
                const rh = Math.max(2, Math.abs(e.y - s.y));
                return (
                  <Rect
                    key={stroke.id}
                    x={rx}
                    y={ry}
                    width={rw}
                    height={rh}
                    stroke={stroke.color}
                    strokeWidth={stroke.width}
                    strokeDasharray={isSel ? '4,4' : undefined}
                    fill="none"
                    rx={4}
                  />
                );
              }
              if (stroke.shapeType === 'circle') {
                const cx = (s.x + e.x) / 2;
                const cy = (s.y + e.y) / 2;
                const r = Math.max(2, Math.hypot(e.x - s.x, e.y - s.y) / 2);
                return (
                  <Circle
                    key={stroke.id}
                    cx={cx}
                    cy={cy}
                    r={r}
                    stroke={stroke.color}
                    strokeWidth={stroke.width}
                    strokeDasharray={isSel ? '4,4' : undefined}
                    fill="none"
                  />
                );
              }
              if (stroke.shapeType === 'arrow') {
                const angle = Math.atan2(e.y - s.y, e.x - s.x);
                const headLen = Math.max(12, stroke.width * 3);
                const lx = e.x - headLen * Math.cos(angle - Math.PI / 6);
                const ly = e.y - headLen * Math.sin(angle - Math.PI / 6);
                const rx = e.x - headLen * Math.cos(angle + Math.PI / 6);
                const ry = e.y - headLen * Math.sin(angle + Math.PI / 6);
                return (
                  <React.Fragment key={stroke.id}>
                    <SvgLine
                      x1={s.x}
                      y1={s.y}
                      x2={e.x}
                      y2={e.y}
                      stroke={stroke.color}
                      strokeWidth={stroke.width}
                      strokeDasharray={isSel ? '4,4' : undefined}
                      strokeLinecap="round"
                    />
                    <SvgPath
                      d={`M ${lx} ${ly} L ${e.x} ${e.y} L ${rx} ${ry}`}
                      stroke={stroke.color}
                      strokeWidth={stroke.width}
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </React.Fragment>
                );
              }
              return (
                <SvgLine
                  key={stroke.id}
                  x1={s.x}
                  y1={s.y}
                  x2={e.x}
                  y2={e.y}
                  stroke={stroke.color}
                  strokeWidth={stroke.width}
                  strokeDasharray={isSel ? '4,4' : undefined}
                  strokeLinecap="round"
                />
              );
            }

            const pathData = pointsToSvgPath(
              stroke.points,
              stroke.isPolygon || stroke.shapeType === 'rect' || stroke.shapeType === 'triangle',
              stroke.shapeType
            );
            return (
              <SvgPath
                key={stroke.id}
                d={pathData}
                stroke={stroke.color}
                strokeWidth={stroke.width}
                strokeDasharray={isSel ? '4,4' : undefined}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={1}
              />
            );
          })}
      </>
    );
  }
);

export const DocumentWorkspaceModal: React.FC<DocumentWorkspaceModalProps> = ({
  note: initialNote,
  initialMode = 'pdf',
  onClose,
  exitRef,
}) => {
  const notes = useNoteStore((s) => s.notes);
  const writingSoundEnabled = useNoteStore((s) => s.writingSoundEnabled);
  const addNote = useNoteStore((s) => s.addNote);
  const updateNote = useNoteStore((s) => s.updateNote);
  const deleteNote = useNoteStore((s) => s.deleteNote);
  const setWritingSoundEnabled = useNoteStore((s) => s.setWritingSoundEnabled);
  const pendingPdfTarget = useNoteStore((s) => s.pendingPdfTarget);
  const clearPendingPdfTarget = useNoteStore((s) => s.clearPendingPdfTarget);

  const isPdfMode = initialMode === 'pdf' || (initialNote?.noteType === 'pdf') || !!initialNote?.pdfUri;

  // 새 메모에서 PDF를 열었을 때는 기존 샘플 문서가 멋대로 열리지 않고 Adobe 스타일 PDF 시작/열기 허브를 표시
  const [activeNoteId, setActiveNoteId] = useState<string>(initialNote?.id || '');
  const activeNoteIdRef = useRef<string>(initialNote?.id || '');
  activeNoteIdRef.current = activeNoteId;
  const pdfDocUidRef = useRef<string>(
    initialNote?.pdfDocUid ||
      `pdfdoc_${initialNote?.id || Date.now()}_${Math.random().toString(36).substring(2, 6)}`
  );

  const [isPdfLauncherOpen, setIsPdfLauncherOpen] = useState<boolean>(isPdfMode && !initialNote);
  const [pdfWorkspaceTab, setPdfWorkspaceTab] = useState<PdfWorkspaceTab>('annotate');

  // 3차: 발췌 스티커에서 '원문 보기'로 돌아왔을 때 해당 문단 영역 하이라이트 상태
  const [sourceHighlightTarget, setSourceHighlightTarget] = useState<{
    pageNumber: number;
    pageId?: string;
    normRect?: { x: number; y: number; width: number; height: number };
    cropRect?: { x: number; y: number; width: number; height: number };
    excerptText?: string;
  } | null>(null);

  // 4차: Apple Pencil / S Pen 스타일러스 팜 리젝션(손바닥 오입력 무시) 모드
  const [isPalmRejectionEnabled, setIsPalmRejectionEnabled] = useState<boolean>(false);
  const isPalmRejectionRef = useRef<boolean>(false);
  isPalmRejectionRef.current = isPalmRejectionEnabled;

  const initialPdfPages: PdfPageData[] = React.useMemo(() => {
    if (!isPdfMode) return [];
    if (initialNote) {
      return extractPdfPagesFromNote(initialNote);
    }
    return [];
  }, [initialNote, isPdfMode]);

  const [pdfPages, setPdfPages] = useState<PdfPageData[]>(initialPdfPages);

  const [title, setTitle] = useState<string>(
    initialNote?.title || (isPdfMode ? '새 PDF 문서.pdf' : '아이디어 캔버스 드로잉')
  );
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(
    isPdfMode ? Math.max(1, initialPdfPages.length || 3) : 2
  );
  const [paperTemplate, setPaperTemplate] = useState<PaperTemplate>(
    initialNote?.paperTemplate || 'blank'
  );

  // 필기 스트로크 관리
  const [strokes, setStrokes] = useState<StrokeWithPage[]>(
    ((initialNote?.strokes as StrokeWithPage[]) || []).map((s) => ({
      ...s,
      pageIndex: s.pageIndex || 1,
    }))
  );
  const [currentStroke, setCurrentStroke] = useState<StrokeWithPage | null>(null);
  const [undoStack, setUndoStack] = useState<StrokeWithPage[][]>([]);
  const [redoStack, setRedoStack] = useState<StrokeWithPage[][]>([]);

  // 툴박스 도구 설정 (Goodnotes / Notewise / Flexcil 블록 발췌 + 스탬프·먹칠·댓글 통합)
  const [activeTool, setActiveTool] = useState<
    | 'hand'
    | 'fountain'
    | 'pen'
    | 'highlighter'
    | 'eraser'
    | 'shape'
    | 'text'
    | 'lasso'
    | 'snippet'
    | 'laser'
    | 'stamp'
    | 'redact'
    | 'comment'
  >('fountain');
  const [shapeType, setShapeType] = useState<'rect' | 'circle' | 'arrow' | 'line'>('rect');

  // PDF 보기 레이아웃 (단일 페이지 / 연속 세로 스크롤 / 양면 2페이지 나란히 보기)
  const [viewLayout, setViewLayout] = useState<PdfViewLayout>('single');

  // 워터마크 & 머리글·바닥글·페이지 번호 & 스탬프 & 먹칠 & 스레드 댓글 & 메타데이터 상태
  const [pdfWatermark, setPdfWatermark] = useState<PdfWatermarkConfig>(
    initialNote?.pdfWatermark || {
      enabled: false,
      text: '기밀 CONFIDENTIAL',
      opacity: 0.14,
      color: '#DC2626',
    }
  );
  const [pdfHeaderFooter, setPdfHeaderFooter] = useState<PdfHeaderFooterConfig>(
    initialNote?.pdfHeaderFooter || {
      enabled: false,
      headerText: '',
      footerText: '',
      showPageNumbers: true,
    }
  );
  const [pdfStamps, setPdfStamps] = useState<PdfStampItem[]>(initialNote?.pdfStamps || []);
  const [pdfRedactions, setPdfRedactions] = useState<PdfRedactionRect[]>(
    initialNote?.pdfRedactions || []
  );
  const [pdfComments, setPdfComments] = useState<PdfCommentThread[]>(
    initialNote?.pdfComments || []
  );
  const [pdfMeta, setPdfMeta] = useState<PdfDocumentMeta>(initialNote?.pdfMeta || {});

  const STAMP_PRESETS = [
    { label: '승인 APPROVED', sublabel: 'STICKYCRAFT REVIEW', color: '#059669' },
    { label: '초안 DRAFT', sublabel: 'WORKING DOCUMENT', color: '#2563EB' },
    { label: '검토 완료 REVIEWED', sublabel: 'VERIFIED', color: '#7C3AED' },
    { label: '중요 IMPORTANT', sublabel: 'PRIORITY', color: '#D97706' },
    { label: '기밀 CONFIDENTIAL', sublabel: 'DO NOT DISTRIBUTE', color: '#DC2626' },
  ] as const;
  const [activeStampPresetIdx, setActiveStampPresetIdx] = useState<number>(0);
  const activeStampPresetRef = useRef(STAMP_PRESETS[0]);
  activeStampPresetRef.current = STAMP_PRESETS[activeStampPresetIdx] as any;

  // 민감정보 먹칠(Redaction) 드래그 상태
  const [redactDraftRect, setRedactDraftRect] = useState<{
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
  } | null>(null);
  const redactDraftRectRef = useRef(redactDraftRect);
  redactDraftRectRef.current = redactDraftRect;

  // Stage 2 전문가 모달 & 드로어 상태 (명령 팔레트 Ctrl+K, 워터마크, 속성/통계, PDF 비교, 댓글 드로어)
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isWatermarkModalOpen, setIsWatermarkModalOpen] = useState(false);
  const [isPropertiesModalOpen, setIsPropertiesModalOpen] = useState(false);
  const [isCompareModalOpen, setIsCompareModalOpen] = useState(false);
  const [isCommentsDrawerOpen, setIsCommentsDrawerOpen] = useState(false);
  const [activeCommentThreadId, setActiveCommentThreadId] = useState<string | null>(null);

  // Flexcil / LiquidText 스타일 PDF 블록 지정 캡처 & 복사 / 노트로 보내기 상태
  const [snippetDraftRect, setSnippetDraftRect] = useState<{
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
  } | null>(null);
  const snippetDraftRectRef = useRef(snippetDraftRect);
  snippetDraftRectRef.current = snippetDraftRect;
  const [capturedBlockRect, setCapturedBlockRect] = useState<BlockRect | null>(null);
  const [capturedBlockResult, setCapturedBlockResult] = useState<CapturedBlockResult | null>(null);
  const [isAppendNotePickerOpen, setIsAppendNotePickerOpen] = useState(false);

  // Flexcil / Samsung Notes 스타일 분할 화면 사이드 노트 상태
  const [isSideNoteOpen, setIsSideNoteOpen] = useState(false);
  const [sideLinkedNoteId, setSideLinkedNoteId] = useState<string | null>(null);
  const [sideNoteTitle, setSideNoteTitle] = useState<string>(
    `${(initialNote?.title || 'PDF 문서').replace(/\.pdf$/i, '')} 요약 노트`
  );
  const [sideNoteContent, setSideNoteContent] = useState<string>('');
  const [sideNoteSnippets, setSideNoteSnippets] = useState<SideNoteSnippetItem[]>([]);

  // 데스크톱 Spacebar 꾹 누르기 임시 손바닥 스크롤 상태
  const [isSpacePanning, setIsSpacePanning] = useState(false);
  const isSpacePanRef = useRef(false);

  // Goodnotes 6 시그니처: 프레젠테이션 레이저 포인터 상태
  const [laserPoint, setLaserPoint] = useState<{ x: number; y: number } | null>(null);
  const [laserTrail, setLaserTrail] = useState<{ x: number; y: number }[]>([]);
  const laserFadeTimerRef = useRef<any>(null);

  // Goodnotes / Flexcil 시그니처: 페이지별 90도 회전 각도 (0, 90, 180, 270)
  const [pageRotations, setPageRotations] = useState<Record<number, number>>({});

  const handleRotateCurrentPage = () => {
    setPageRotations((prev) => {
      const cur = prev[currentPage] || 0;
      const next = (cur + 90) % 360;
      setExportToastMessage(`🔄 페이지 ${currentPage} 회전: ${next}°`);
      setTimeout(() => setExportToastMessage(null), 1500);
      return { ...prev, [currentPage]: next };
    });
  };

  // 직사각형 영역 선택 도구 상태 (직관적인 Rectangular Marquee Selection)
  const [selectedStrokeIds, setSelectedStrokeIds] = useState<string[]>([]);
  const [selectionRect, setSelectionRect] = useState<{
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
  } | null>(null);
  const [isDraggingSelection, setIsDraggingSelection] = useState(false);
  const lassoDragStartRef = useRef<{ x: number; y: number } | null>(null);
  const [selectionBBox, setSelectionBBox] = useState<{
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  } | null>(null);

  // 책갈피 / 즐겨찾기 페이지 (Notewise / Flexcil 북마크)
  const [bookmarkedPages, setBookmarkedPages] = useState<number[]>(
    initialNote?.bookmarkedPages && initialNote.bookmarkedPages.length > 0
      ? initialNote.bookmarkedPages
      : [1]
  );
  const [thumbnailFilter, setThumbnailFilter] = useState<'all' | 'bookmarks' | 'outline'>('all');

  // 화면 배율 및 전체화면 (Zoom Level & Fullscreen Mode)
  const [zoomLevel, setZoomLevel] = useState<number>(1.0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // 지우개 자동 복귀 (Notewise eraser_auto_deselect: 지운 후 이전 펜으로 자동 복귀)
  const [autoDeselectEraser, setAutoDeselectEraser] = useState(false);

  // Goodnotes / Notewise 시그니처 3색 즐겨찾기 퀵 슬롯
  const [colorSlots, setColorSlots] = useState<string[]>(['#1E293B', '#DC2626', '#FACC15']);
  const [activeColorSlot, setActiveColorSlot] = useState<number>(0);
  const strokeColor = colorSlots[activeColorSlot];

  // Goodnotes 6 & Notewise 스타일 3-Slot 즐겨찾기 펜 랙
  const [penPresets, setPenPresets] = useState<Array<{
    id: number;
    tool: 'fountain' | 'pen' | 'highlighter';
    color: string;
    width: number;
    label: string;
  }>>([
    { id: 1, tool: 'fountain', color: '#1E293B', width: 3, label: '만년필' },
    { id: 2, tool: 'pen', color: '#DC2626', width: 2, label: '볼펜' },
    { id: 3, tool: 'highlighter', color: '#FACC15', width: 22, label: '형광펜' },
  ]);
  const [activePresetIndex, setActivePresetIndex] = useState<number | null>(0);
  const [editingPresetIndex, setEditingPresetIndex] = useState<number | null>(null);

  // 스마트 도형 자동 보정 (Snap to Shape - Goodnotes / Notewise 시그니처)
  const [autoSnapShape, setAutoSnapShape] = useState<boolean>(true);
  const autoSnapShapeRef = useRef(autoSnapShape);
  autoSnapShapeRef.current = autoSnapShape;

  // 야간 모드 / 다크 모드 (PDF & 캔버스 눈부심 방지 읽기 모드)
  const [isNightMode, setIsNightMode] = useState<boolean>(false);

  // 페이지별 개별 속지 템플릿 및 새 페이지 양식 추가 모달
  const [pageTemplates, setPageTemplates] = useState<Record<number, PaperTemplate>>(
    initialNote?.pageTemplates || {}
  );
  const [isAddPageTemplateModalOpen, setIsAddPageTemplateModalOpen] = useState(false);

  // 굵기 프리셋 (2px, 4px, 8px)
  const [strokeWidth, setStrokeWidth] = useState<number>(3);
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);

  // 자유 텍스트 상자 (Goodnotes / Notewise 탭하여 입력)
  const [textBoxes, setTextBoxes] = useState<FreeTextBox[]>(initialNote?.textBoxes || []);
  const [selectedTextBoxId, setSelectedTextBoxId] = useState<string | null>(null);
  const [defaultTextFontSize, setDefaultTextFontSize] = useState<number>(18);

  // 문서 내 단어 검색 (In-Document Search & Navigator)
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSearchIndex, setActiveSearchIndex] = useState<number>(0);

  // 속지 템플릿 변경 팝오버
  const [isTemplateMenuOpen, setIsTemplateMenuOpen] = useState(false);

  // 음성 녹음 및 오디오 플레이어 독
  const [isRecording, setIsRecording] = useState(false);
  const [audioNotes, setAudioNotes] = useState<AudioNote[]>(initialNote?.audioNotes || []);
  const [isAudioDockOpen, setIsAudioDockOpen] = useState(false);

  // 썸네일 오버뷰 서랍
  const [isOverviewOpen, setIsOverviewOpen] = useState(false);

  // 벤치마크 편의성: 공유 및 내보내기 모달
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportToastMessage, setExportToastMessage] = useState<string | null>(null);

  // 벤치마크 편의성: 페이지 직접 점프 모달
  const [isPageJumpModalOpen, setIsPageJumpModalOpen] = useState(false);
  const [jumpPageInput, setJumpPageInput] = useState('');

  // 벤치마크 편의성: 지우개 반경 및 모드 (Goodnotes / Notewise 획 지우개 vs 부분 지우개)
  const [eraserRadius, setEraserRadius] = useState<number>(28);
  const [eraserMode, setEraserMode] = useState<'stroke' | 'standard'>('stroke');
  const eraserRadiusRef = useRef(eraserRadius);
  eraserRadiusRef.current = eraserRadius;

  // Goodnotes 6 & Notewise 편의성: 형광펜만 지우기 모드 (일반 펜 글씨 보호)
  const [eraseHighlighterOnly, setEraseHighlighterOnly] = useState<boolean>(false);
  const eraseHighlighterOnlyRef = useRef(eraseHighlighterOnly);
  eraseHighlighterOnlyRef.current = eraseHighlighterOnly;

  // 벤치마크 편의성: 펜 팁 스타일 (만년필 vs 볼펜)
  const [penType, setPenType] = useState<'fountain' | 'pen'>('fountain');

  // 실시간 PDF 페이지 데이터 기반 activeDocument 생성 (업로드/새 문서/병합/분할 100% 반영)
  const activeDocument = React.useMemo(() => {
    if (!isPdfMode) return null;
    if (pdfPages.length > 0) {
      return {
        id: activeNoteId || 'custom-pdf',
        name: title || 'PDF 문서.pdf',
        pages: pdfPages.map((p, idx) => ({
          pageNumber: idx + 1,
          title: p.title,
          subtitle: p.subtitle || (p.sourcePdfName ? `원본: ${p.sourcePdfName}` : ''),
          content: p.content,
        })),
      };
    }
    if (initialNote) {
      return getSampleDocumentForNote(initialNote.title, initialNote.pdfName);
    }
    return null;
  }, [isPdfMode, pdfPages, activeNoteId, title, initialNote]);

  // 캔버스 크기 및 스크롤 뷰 참조 (손바닥 도구 Grab-to-Scroll 지원)
  const pageContainerRef = useRef<View>(null);
  const canvasScrollRef = useRef<ScrollView>(null);
  const scrollOffsetRef = useRef({ x: 0, y: 0 });
  const handInertiaRafRef = useRef<number | null>(null);
  const [isHandPanning, setIsHandPanning] = useState(false);
  const [pageLayout, setPageLayout] = useState({ width: 720, height: 1018 });

  useEffect(() => {
    return () => {
      stopWritingScratch();
      if (handInertiaRafRef.current !== null && typeof cancelAnimationFrame !== 'undefined') {
        cancelAnimationFrame(handInertiaRafRef.current);
      }
      if (rafStrokeIdRef.current !== null && typeof cancelAnimationFrame !== 'undefined') {
        cancelAnimationFrame(rafStrokeIdRef.current);
      }
    };
  }, []);

  // PanResponder 및 Web 이벤트 클로저 버그 해결을 위한 최신 상태 Mutable Refs
  const activeToolRef = useRef(activeTool);
  activeToolRef.current = activeTool;

  const writingSoundEnabledRef = useRef(writingSoundEnabled);
  writingSoundEnabledRef.current = writingSoundEnabled;

  const shapeTypeRef = useRef(shapeType);
  shapeTypeRef.current = shapeType;

  const strokeColorRef = useRef(strokeColor);
  strokeColorRef.current = strokeColor;

  const strokeWidthRef = useRef(strokeWidth);
  strokeWidthRef.current = strokeWidth;

  const currentPageRef = useRef(currentPage);
  currentPageRef.current = currentPage;

  const strokesRef = useRef<StrokeWithPage[]>(strokes);
  strokesRef.current = strokes;

  const undoStackRef = useRef<StrokeWithPage[][]>(undoStack);
  undoStackRef.current = undoStack;

  const redoStackRef = useRef<StrokeWithPage[][]>(redoStack);
  redoStackRef.current = redoStack;

  const selectionBBoxRef = useRef(selectionBBox);
  selectionBBoxRef.current = selectionBBox;

  const selectedStrokeIdsRef = useRef(selectedStrokeIds);
  selectedStrokeIdsRef.current = selectedStrokeIds;

  const autoDeselectEraserRef = useRef(autoDeselectEraser);
  autoDeselectEraserRef.current = autoDeselectEraser;

  const zoomLevelRef = useRef(zoomLevel);
  zoomLevelRef.current = zoomLevel;

  const selectionRectRef = useRef(selectionRect);
  selectionRectRef.current = selectionRect;

  const dragStartStrokesRef = useRef<StrokeWithPage[]>([]);
  const hasErasedInThisDragRef = useRef(false);
  const isErasingRef = useRef(false);
  const currentStrokeRef = useRef<StrokeWithPage | null>(null);
  const rafStrokeIdRef = useRef<number | null>(null);
  const lastDrawPointRef = useRef<{ x: number; y: number } | null>(null);

  // 펜 종류 전환 시 도구에 맞는 스마트 기본 굵기 동기화
  useEffect(() => {
    if (activeTool === 'highlighter') {
      if (strokeWidth < 10) {
        setStrokeWidth(22);
      }
    } else if (activeTool === 'fountain' || activeTool === 'pen') {
      if (strokeWidth >= 10) {
        setStrokeWidth(3);
      }
    }
  }, [activeTool]);

  // 현재 문서를 즉시 스토어에 반영하고 노트 고유 ID를 보장하는 헬퍼 (자동 저장 및 발췌 스티커 원문 링크 생성 공용)
  const persistCurrentDocumentState = React.useCallback(
    (snap?: {
      title: string;
      strokes: StrokeWithPage[];
      paperTemplate: PaperTemplate;
      audioNotes: AudioNote[];
      textBoxes: FreeTextBox[];
      pdfPages: PdfPageData[];
      pdfWatermark: PdfWatermarkConfig;
      pdfHeaderFooter: PdfHeaderFooterConfig;
      pdfStamps: PdfStampItem[];
      pdfRedactions: PdfRedactionRect[];
      pdfComments: PdfCommentThread[];
      pdfMeta: PdfDocumentMeta;
      bookmarkedPages: number[];
      pageTemplates: Record<number, PaperTemplate>;
      totalPages: number;
    }): string => {
      const s = snap || {
        title,
        strokes: strokesRef.current,
        paperTemplate,
        audioNotes,
        textBoxes,
        pdfPages,
        pdfWatermark,
        pdfHeaderFooter,
        pdfStamps,
        pdfRedactions,
        pdfComments,
        pdfMeta,
        bookmarkedPages,
        pageTemplates,
        totalPages,
      };
      const finalTitle = s.title.trim() || (isPdfMode ? 'PDF 문서.pdf' : '손글씨 캔버스');
      const normalizedPdfPages = isPdfMode
        ? s.pdfPages.map((p, idx) => ({ ...p, pageNumber: idx + 1 }))
        : undefined;

      if (activeNoteIdRef.current) {
        updateNote(activeNoteIdRef.current, {
          title: finalTitle,
          pdfDocUid: pdfDocUidRef.current,
          strokes: s.strokes,
          paperTemplate: s.paperTemplate,
          audioNotes: s.audioNotes,
          textBoxes: s.textBoxes,
          noteType: isPdfMode ? 'pdf' : 'canvas',
          pdfName: isPdfMode ? finalTitle : undefined,
          pdfPages: normalizedPdfPages,
          pdfWatermark: s.pdfWatermark,
          pdfHeaderFooter: s.pdfHeaderFooter,
          pdfStamps: s.pdfStamps,
          pdfRedactions: s.pdfRedactions,
          pdfComments: s.pdfComments,
          pdfMeta: s.pdfMeta,
          bookmarkedPages: s.bookmarkedPages,
          pageTemplates: s.pageTemplates,
        });
        return activeNoteIdRef.current;
      }

      const createdId = addNote({
        title: finalTitle,
        pdfDocUid: pdfDocUidRef.current,
        content: isPdfMode
          ? normalizedPdfPages && normalizedPdfPages[0]?.content
            ? normalizedPdfPages[0].content.slice(0, 180)
            : `[PDF 문서 첨부] ${finalTitle} (총 ${s.totalPages}페이지)`
          : '손글씨 캔버스 필기 메모',
        color: isPdfMode ? 'paper' : 'yellow',
        decoStyle: 'minimal',
        images: [],
        checklist: [],
        tags: [isPdfMode ? 'PDF' : '캔버스', '필기'],
        isPinned: false,
        isLocked: false,
        strokes: s.strokes,
        paperTemplate: s.paperTemplate,
        audioNotes: s.audioNotes,
        textBoxes: s.textBoxes,
        boardId: 'ideas',
        noteType: isPdfMode ? 'pdf' : 'canvas',
        pdfName: isPdfMode ? finalTitle : undefined,
        pdfPages: normalizedPdfPages,
        pdfWatermark: s.pdfWatermark,
        pdfHeaderFooter: s.pdfHeaderFooter,
        pdfStamps: s.pdfStamps,
        pdfRedactions: s.pdfRedactions,
        pdfComments: s.pdfComments,
        pdfMeta: s.pdfMeta,
        bookmarkedPages: s.bookmarkedPages,
        pageTemplates: s.pageTemplates,
      });
      activeNoteIdRef.current = createdId;
      setActiveNoteId(createdId);
      return createdId;
    },
    [
      title,
      paperTemplate,
      audioNotes,
      textBoxes,
      pdfPages,
      pdfWatermark,
      pdfHeaderFooter,
      pdfStamps,
      pdfRedactions,
      pdfComments,
      pdfMeta,
      bookmarkedPages,
      pageTemplates,
      totalPages,
      isPdfMode,
      addNote,
      updateNote,
    ]
  );

  // 실시간 자동 저장 스냅샷 (400ms 디바운스 + 백그라운드/언마운트/Android 뒤로 가기 시 즉시 flush)
  const autosaveSnapshot = React.useMemo(() => {
    if (isPdfMode && isPdfLauncherOpen) return null;
    if (
      !activeNoteIdRef.current &&
      !isPdfMode &&
      strokes.length === 0 &&
      textBoxes.length === 0 &&
      audioNotes.length === 0
    ) {
      return null;
    }
    if (!activeNoteIdRef.current && isPdfMode && pdfPages.length === 0 && strokes.length === 0) {
      return null;
    }
    return {
      title,
      strokes,
      paperTemplate,
      audioNotes,
      textBoxes,
      pdfPages,
      pdfWatermark,
      pdfHeaderFooter,
      pdfStamps,
      pdfRedactions,
      pdfComments,
      pdfMeta,
      bookmarkedPages,
      pageTemplates,
      totalPages,
    };
  }, [
    isPdfMode,
    isPdfLauncherOpen,
    title,
    strokes,
    paperTemplate,
    audioNotes,
    textBoxes,
    pdfPages,
    pdfWatermark,
    pdfHeaderFooter,
    pdfStamps,
    pdfRedactions,
    pdfComments,
    pdfMeta,
    bookmarkedPages,
    pageTemplates,
    totalPages,
  ]);

  const writeAutosave = React.useCallback(
    async (snap: NonNullable<typeof autosaveSnapshot>) => {
      persistCurrentDocumentState(snap);
      await waitForNotesWrite();
    },
    [persistCurrentDocumentState]
  );

  const {
    status: autosaveStatus,
    flush: flushAutosave,
    close: autosaveClose,
    label: autosaveLabel,
  } = useEditorAutosave(autosaveSnapshot, writeAutosave, onClose, exitRef);

  // 저장 및 종료
  const handleSaveAndExit = async () => {
    stopWritingScratch();
    if (isPdfMode && isPdfLauncherOpen && !activeNoteIdRef.current && pdfPages.length === 0) {
      onClose();
      return;
    }
    if (autosaveSnapshot) {
      persistCurrentDocumentState(autosaveSnapshot);
      await waitForNotesWrite();
    }
    await autosaveClose();
  };

  // 2차: 보이는 쪽부터 지연 렌더링 (80쪽 이상 대용량 PDF에서 아직 렌더링되지 않은 현재/인접 페이지를 자동 렌더링)
  useEffect(() => {
    if (!isPdfMode || pdfPages.length === 0) return;
    let cancelled = false;
    const candidateNums = [currentPage];
    if (currentPage + 1 <= pdfPages.length) candidateNums.push(currentPage + 1);
    if (currentPage - 1 >= 1) candidateNums.push(currentPage - 1);

    (async () => {
      for (const pNum of candidateNums) {
        const target = pdfPages[pNum - 1];
        if (!target || target.renderedImageUri || !target.sourceDocId) continue;
        const uri = await ensurePdfPageRendered(target);
        if (uri && !cancelled) {
          setPdfPages((prev) =>
            prev.map((item, idx) => (idx === pNum - 1 ? { ...item, renderedImageUri: uri } : item))
          );
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isPdfMode, currentPage, pdfPages]);

  // 3차/4차: 발췌 스티커에서 '원문 보기' 클릭 또는 홈 통합 검색에서 특정 쪽 클릭 시 해당 페이지로 즉시 이동 & 영역 강조
  useEffect(() => {
    if (!pendingPdfTarget) return;
    let resolvedPage = pendingPdfTarget.pageNumber || 1;
    if (pendingPdfTarget.pageId && pdfPages.length > 0) {
      const idx = pdfPages.findIndex((p) => p.id === pendingPdfTarget.pageId);
      if (idx >= 0) resolvedPage = idx + 1;
    }
    resolvedPage = Math.max(1, Math.min(Math.max(totalPages, pdfPages.length || 1), resolvedPage));

    setIsPdfLauncherOpen(false);
    setPdfWorkspaceTab('annotate');
    setCurrentPage(resolvedPage);

    if (pendingPdfTarget.normRect || pendingPdfTarget.cropRect) {
      setSourceHighlightTarget({
        pageNumber: resolvedPage,
        pageId: pendingPdfTarget.pageId,
        normRect: pendingPdfTarget.normRect,
        cropRect: pendingPdfTarget.cropRect,
        excerptText: pendingPdfTarget.excerptText,
      });
      setExportToastMessage(`🔍 발췌 원문 위치(P.${resolvedPage}쪽)로 이동하여 문단을 강조했습니다.`);
      setTimeout(() => setExportToastMessage(null), 2800);
    } else if (pendingPdfTarget.searchQuery) {
      setIsSearchOpen(true);
      setSearchQuery(pendingPdfTarget.searchQuery);
      setExportToastMessage(`🔍 '${pendingPdfTarget.searchQuery}' 일치 페이지(P.${resolvedPage}쪽)로 이동했습니다.`);
      setTimeout(() => setExportToastMessage(null), 2400);
    }

    clearPendingPdfTarget();
  }, [pendingPdfTarget, pdfPages, totalPages, clearPendingPdfTarget]);

  // 템플릿 지정 새 페이지 추가 (Notewise & Goodnotes 페이지 템플릿 생성기)
  const handleAddNewPageWithTemplate = (chosenTemplate: PaperTemplate) => {
    const newPageNum = totalPages + 1;
    const templateNames: Record<PaperTemplate, string> = {
      blank: '무지',
      lined: '줄노트',
      grid: '모눈종이',
      cornell: '코넬 노트',
      dot: '점 모눈',
      dark: '다크 칠판',
    };
    if (isPdfMode) {
      setPdfPages((prev) => [
        ...prev,
        {
          id: `pdfp_${Date.now()}_${newPageNum}_${Math.random().toString(36).substring(2, 6)}`,
          pageNumber: newPageNum,
          title: `${title.replace(/\.pdf$/i, '')} — Page ${newPageNum}`,
          subtitle: `추가된 페이지 (${templateNames[chosenTemplate] || chosenTemplate})`,
          content: '',
          sourcePdfName: title,
        },
      ]);
    }
    setTotalPages(newPageNum);
    setPageTemplates((prev) => ({ ...prev, [newPageNum]: chosenTemplate }));
    setCurrentPage(newPageNum);
    setIsAddPageTemplateModalOpen(false);
    setIsOverviewOpen(false);
    setExportToastMessage(`📄 페이지 ${newPageNum}번(${templateNames[chosenTemplate] || chosenTemplate})이 추가되었습니다.`);
    setTimeout(() => setExportToastMessage(null), 2500);
  };

  // 객체 바운딩 박스 계산 함수 (올가미 선택 도구용)
  const computeStrokeBBox = (s: StrokeWithPage) => {
    if (s.tool === 'shape' && s.shapeStart && s.shapeEnd) {
      return {
        minX: Math.min(s.shapeStart.x, s.shapeEnd.x),
        minY: Math.min(s.shapeStart.y, s.shapeEnd.y),
        maxX: Math.max(s.shapeStart.x, s.shapeEnd.x),
        maxY: Math.max(s.shapeStart.y, s.shapeEnd.y),
      };
    }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of s.points) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
    return { minX, minY, maxX, maxY };
  };

  // 올가미 선택 영역 복제 (Goodnotes / Notewise 스타일 ⎘ 복제)
  const handleDuplicateSelection = () => {
    if (selectedStrokeIds.length === 0) return;
    undoStackRef.current = [...undoStackRef.current, strokesRef.current];
    redoStackRef.current = [];
    setUndoStack(undoStackRef.current);
    setRedoStack([]);
    const selectedStrokes = strokesRef.current.filter((s) => selectedStrokeIds.includes(s.id));
    const newStrokes: StrokeWithPage[] = selectedStrokes.map((s) => ({
      ...s,
      id: `strk_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      points: s.points.map((p) => ({ x: p.x + 25, y: p.y + 25 })),
      shapeStart: s.shapeStart ? { x: s.shapeStart.x + 25, y: s.shapeStart.y + 25 } : undefined,
      shapeEnd: s.shapeEnd ? { x: s.shapeEnd.x + 25, y: s.shapeEnd.y + 25 } : undefined,
    }));
    const newIds = newStrokes.map((s) => s.id);
    const updated = [...strokesRef.current, ...newStrokes];
    strokesRef.current = updated;
    setStrokes(updated);
    setSelectedStrokeIds(newIds);
    if (selectionBBox) {
      setSelectionBBox({
        minX: selectionBBox.minX + 25,
        minY: selectionBBox.minY + 25,
        maxX: selectionBBox.maxX + 25,
        maxY: selectionBBox.maxY + 25,
      });
    }
    setExportToastMessage(`${newStrokes.length}개 객체가 복제되었습니다.`);
    setTimeout(() => setExportToastMessage(null), 2000);
  };

  // 올가미 선택 영역 색상 변경 (Goodnotes 스타일 🎨 색상 변경)
  const handleRecolorSelection = () => {
    if (selectedStrokeIds.length === 0) return;
    undoStackRef.current = [...undoStackRef.current, strokesRef.current];
    redoStackRef.current = [];
    setUndoStack(undoStackRef.current);
    setRedoStack([]);
    const updated = strokesRef.current.map((s) =>
      selectedStrokeIds.includes(s.id) ? { ...s, color: strokeColorRef.current } : s
    );
    strokesRef.current = updated;
    setStrokes(updated);
    setExportToastMessage('선택한 객체의 색상이 변경되었습니다.');
    setTimeout(() => setExportToastMessage(null), 2000);
  };

  // 올가미 선택 영역 삭제 (🗑️ 삭제)
  const handleDeleteSelection = () => {
    if (selectedStrokeIds.length === 0) return;
    undoStackRef.current = [...undoStackRef.current, strokesRef.current];
    redoStackRef.current = [];
    setUndoStack(undoStackRef.current);
    setRedoStack([]);
    const count = selectedStrokeIds.length;
    const updated = strokesRef.current.filter((s) => !selectedStrokeIds.includes(s.id));
    strokesRef.current = updated;
    setStrokes(updated);
    setSelectedStrokeIds([]);
    setSelectionBBox(null);
    setExportToastMessage(`${count}개 객체가 삭제되었습니다.`);
    setTimeout(() => setExportToastMessage(null), 2000);
  };

  // 현재 페이지 즐겨찾기 북마크 토글 (Notewise / Goodnotes ⭐/🔖)
  const toggleBookmarkCurrentPage = () => {
    setBookmarkedPages((prev) => {
      const isBookmarked = prev.includes(currentPage);
      const updated = isBookmarked
        ? prev.filter((p) => p !== currentPage)
        : [...prev, currentPage].sort((a, b) => a - b);
      setExportToastMessage(
        isBookmarked
          ? `P.${currentPage} 북마크가 해제되었습니다.`
          : `P.${currentPage} 북마크 즐겨찾기 추가 ⭐`
      );
      setTimeout(() => setExportToastMessage(null), 2000);
      return updated;
    });
  };

  // Undo / Redo (Goodnotes / Notewise 스냅샷 기반 무결점 실행 취소 시스템)
  const handleUndo = () => {
    if (undoStackRef.current.length === 0) return;
    const prevSnapshot = undoStackRef.current[undoStackRef.current.length - 1];
    const newUndo = undoStackRef.current.slice(0, undoStackRef.current.length - 1);
    const newRedo = [...redoStackRef.current, strokesRef.current];
    undoStackRef.current = newUndo;
    redoStackRef.current = newRedo;
    setUndoStack(newUndo);
    setRedoStack(newRedo);
    strokesRef.current = prevSnapshot;
    setStrokes(prevSnapshot);
  };

  const handleRedo = () => {
    if (redoStackRef.current.length === 0) return;
    const nextSnapshot = redoStackRef.current[redoStackRef.current.length - 1];
    const newRedo = redoStackRef.current.slice(0, redoStackRef.current.length - 1);
    const newUndo = [...undoStackRef.current, strokesRef.current];
    redoStackRef.current = newRedo;
    undoStackRef.current = newUndo;
    setRedoStack(newRedo);
    setUndoStack(newUndo);
    strokesRef.current = nextSnapshot;
    setStrokes(nextSnapshot);
  };

  // 페이지 전환 시 열려 있던 블록 발췌 프레임 초기화
  useEffect(() => {
    setCapturedBlockRect(null);
    setCapturedBlockResult(null);
    setSnippetDraftRect(null);
    setIsAppendNotePickerOpen(false);
  }, [currentPage]);

  // Flexcil / LiquidText 스타일 PDF 영역 블록 캡처 확정 엔진
  const finalizeSnippetCapture = (startX: number, startY: number, endX: number, endY: number) => {
    const x = Math.min(startX, endX);
    const y = Math.min(startY, endY);
    const width = Math.abs(endX - startX);
    const height = Math.abs(endY - startY);

    if (width < 16 || height < 16) {
      setCapturedBlockRect(null);
      setCapturedBlockResult(null);
      return;
    }

    const cropRect: BlockRect = { x, y, width, height };
    const rawPdfPageData = isPdfMode ? pdfPages[currentPageRef.current - 1] || null : null;
    const pageObj = isPdfMode && activeDocument?.pages[currentPageRef.current - 1]
      ? {
          id: rawPdfPageData?.id,
          pageNumber: currentPageRef.current,
          totalPages,
          title: activeDocument.pages[currentPageRef.current - 1].title,
          subtitle: activeDocument.pages[currentPageRef.current - 1].subtitle,
          content: activeDocument.pages[currentPageRef.current - 1].content,
          docName: title || 'PDF 문서.pdf',
          textItems: rawPdfPageData?.textItems,
        }
      : null;

    const pageStrokes = strokesRef.current.filter((s) => (s.pageIndex || 1) === currentPageRef.current);
    const pageTextBoxes = textBoxes.filter((t) => (t.pageIndex || 1) === currentPageRef.current);
    const pageStamps = pdfStamps.filter((st) => st.pageIndex === currentPageRef.current);
    const pageRedactions = pdfRedactions.filter((r) => r.pageIndex === currentPageRef.current);

    const syncCaptured = captureDocumentBlockSnapshot({
      cropRect,
      pageWidth: pageLayout.width || 720,
      pageHeight: pageLayout.height || 1018,
      isPdfMode,
      isNightMode,
      paperTemplate: pageTemplates[currentPageRef.current] || paperTemplate,
      pdfPage: pageObj,
      pdfPageData: rawPdfPageData,
      strokes: pageStrokes,
      textBoxes: pageTextBoxes,
      redactions: pageRedactions,
      hasRenderedImage: Boolean(rawPdfPageData?.renderedImageUri),
    });

    setCapturedBlockRect(cropRect);
    setCapturedBlockResult(syncCaptured);

    // 실제 PDF 이미지·스탬프·워터마크·먹칠까지 완벽 합성한 고화질 이미지로 비동기 업그레이드
    captureDocumentBlockSnapshotAsync({
      cropRect,
      pageWidth: pageLayout.width || 720,
      pageHeight: pageLayout.height || 1018,
      isPdfMode,
      isNightMode,
      paperTemplate: pageTemplates[currentPageRef.current] || paperTemplate,
      pdfPage: pageObj,
      pdfPageData: rawPdfPageData,
      strokes: pageStrokes,
      textBoxes: pageTextBoxes,
      stamps: pageStamps,
      redactions: pageRedactions,
      watermark: pdfWatermark,
      headerFooter: pdfHeaderFooter,
    }).then((asyncRes) => {
      setCapturedBlockResult(asyncRes);
    });

    setExportToastMessage(
      syncCaptured.extractedText
        ? `✂️ 블록 영역 및 텍스트(${syncCaptured.extractedText.length}자) 지정 완료! 복사 또는 노트로 보내기 가능`
        : '✂️ 블록 영역 캡처 완료! 복사하거나 노트로 가져올 수 있습니다'
    );
    setTimeout(() => setExportToastMessage(null), 2600);
  };

  // 1. 지정된 PDF 블록 클립보드 복사 (이미지 + 발췌 텍스트 동시 복사)
  const handleCopyCapturedBlock = async () => {
    if (!capturedBlockResult) return;
    const mode = await copyBlockToClipboard(
      capturedBlockResult.imageDataUrl,
      capturedBlockResult.extractedText
    );
    const msg =
      mode === 'image+text'
        ? '📋 PDF 블록(고화질 이미지 + 텍스트)이 클립보드에 복사되었습니다!'
        : mode === 'image'
        ? '📋 PDF 블록 이미지가 클립보드에 복사되었습니다!'
        : mode === 'text'
        ? '📋 PDF 발췌 텍스트가 클립보드에 복사되었습니다!'
        : '⚠️ 클립보드 복사에 실패했습니다.';
    setExportToastMessage(msg);
    setTimeout(() => setExportToastMessage(null), 2400);
  };

  // 2. 지정된 PDF 블록을 새 스티커 노트로 즉시 가져오기 (원문 왕복 참조 링크 포함)
  const handleSendBlockToNewNote = () => {
    if (!capturedBlockResult) return;
    const ensuredSourceNoteId = persistCurrentDocumentState();
    const cleanDoc = (title || 'PDF 문서').replace(/\.pdf$/i, '');
    const pNum = capturedBlockResult.pageNumber;
    const rawPdfPageData = isPdfMode ? pdfPages[pNum - 1] || null : null;
    const citation = `[출처: ${title || 'PDF 문서'} · P.${pNum}]`;
    const bodyText = capturedBlockResult.extractedText
      ? `${capturedBlockResult.extractedText}\n\n${citation}`
      : `${citation} 블록 발췌 이미지입니다.`;

    const sourceLink: PdfSourceLink = {
      sourceNoteId: ensuredSourceNoteId,
      sourceDocUid: pdfDocUidRef.current,
      sourceDocName: title || 'PDF 문서.pdf',
      sourcePageId: rawPdfPageData?.id || capturedBlockResult.sourcePageId || `page_${pNum}`,
      fallbackPageNumber: pNum,
      normRect: capturedBlockResult.normRect,
      cropRect: capturedBlockResult.cropRect,
      excerptText: capturedBlockResult.extractedText,
    };

    const newImages: NoteImage[] = capturedBlockResult.imageDataUrl
      ? [
          {
            id: `pdfsnip_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            uri: capturedBlockResult.imageDataUrl,
            caption: `${cleanDoc} (P.${pNum} 블록 발췌)`,
            placement: 'inline',
            size: 'large',
          },
        ]
      : [];

    addNote({
      title: `📄 ${cleanDoc} (P.${pNum} 발췌)`,
      content: bodyText,
      color: 'yellow',
      decoStyle: 'tape',
      images: newImages,
      checklist: [],
      tags: ['PDF발췌', `P${pNum}`],
      isPinned: false,
      isLocked: false,
      boardId: 'ideas',
      noteType: 'text',
      paperTemplate: 'lined',
      pdfSourceLink: sourceLink,
      pdfSourceLinks: [sourceLink],
    });

    setCapturedBlockRect(null);
    setCapturedBlockResult(null);
    setExportToastMessage(`✨ '📄 ${cleanDoc} (P.${pNum} 발췌)' 새 스티커 노트로 저장되었습니다! (원문 보기 연결됨)`);
    setTimeout(() => setExportToastMessage(null), 2800);
  };

  // 3. 지정된 PDF 블록을 기존 스티커 노트에 이어 붙이기 (원문 왕복 참조 링크 추가)
  const handleAppendBlockToExistingNote = (targetNote: Note) => {
    if (!capturedBlockResult) return;
    const ensuredSourceNoteId = persistCurrentDocumentState();
    const cleanDoc = (title || 'PDF 문서').replace(/\.pdf$/i, '');
    const pNum = capturedBlockResult.pageNumber;
    const rawPdfPageData = isPdfMode ? pdfPages[pNum - 1] || null : null;
    const citationBlock = capturedBlockResult.extractedText
      ? `\n\n📌 [${cleanDoc} · P.${pNum} 발췌]\n${capturedBlockResult.extractedText}`
      : `\n\n📌 [${cleanDoc} · P.${pNum} 이미지 발췌]`;

    const sourceLink: PdfSourceLink = {
      sourceNoteId: ensuredSourceNoteId,
      sourceDocUid: pdfDocUidRef.current,
      sourceDocName: title || 'PDF 문서.pdf',
      sourcePageId: rawPdfPageData?.id || capturedBlockResult.sourcePageId || `page_${pNum}`,
      fallbackPageNumber: pNum,
      normRect: capturedBlockResult.normRect,
      cropRect: capturedBlockResult.cropRect,
      excerptText: capturedBlockResult.extractedText,
    };

    const updatedImages: NoteImage[] = [...(targetNote.images || [])];
    if (capturedBlockResult.imageDataUrl) {
      updatedImages.push({
        id: `pdfsnip_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        uri: capturedBlockResult.imageDataUrl,
        caption: `${cleanDoc} (P.${pNum} 발췌)`,
        placement: 'inline',
        size: 'large',
      });
    }

    const nextTags = Array.from(new Set([...(targetNote.tags || []), 'PDF발췌']));
    const existingLinks = targetNote.pdfSourceLinks || (targetNote.pdfSourceLink ? [targetNote.pdfSourceLink] : []);
    updateNote(targetNote.id, {
      content: `${targetNote.content || ''}${citationBlock}`.trim(),
      images: updatedImages,
      tags: nextTags,
      pdfSourceLink: sourceLink,
      pdfSourceLinks: [...existingLinks, sourceLink],
    });

    setIsAppendNotePickerOpen(false);
    setCapturedBlockRect(null);
    setCapturedBlockResult(null);
    setExportToastMessage(`📎 '${targetNote.title || '제목 없음'}' 노트에 PDF 블록과 원문 링크가 추가되었습니다!`);
    setTimeout(() => setExportToastMessage(null), 2800);
  };

  // 4. 지정된 PDF 블록을 우측 분할 사이드 노트로 즉시 보내기 (Flexcil / LiquidText 시그니처)
  const handleSendBlockToSideNote = () => {
    if (!capturedBlockResult) return;
    const newItem: SideNoteSnippetItem = {
      id: `sidesnip_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      imageDataUrl: capturedBlockResult.imageDataUrl,
      extractedText: capturedBlockResult.extractedText,
      pageNumber: capturedBlockResult.pageNumber,
      docName: capturedBlockResult.docName,
      createdAt: Date.now(),
    };
    setSideNoteSnippets((prev) => [newItem, ...prev]);
    if (capturedBlockResult.extractedText) {
      setSideNoteContent((prev) => {
        const prefix = prev.trim() ? `${prev.trim()}\n\n` : '';
        return `${prefix}[P.${capturedBlockResult.pageNumber}] ${capturedBlockResult.extractedText}`;
      });
    }
    if (!sideNoteTitle.trim()) {
      setSideNoteTitle(`${(title || 'PDF 문서').replace(/\.pdf$/i, '')} 요약 노트`);
    }
    setIsSideNoteOpen(true);
    setCapturedBlockRect(null);
    setCapturedBlockResult(null);
    setExportToastMessage(`📝 P.${capturedBlockResult.pageNumber} 발췌 블록이 분할 사이드 노트에 추가되었습니다!`);
    setTimeout(() => setExportToastMessage(null), 2400);
  };

  // 5. 지정된 PDF 블록을 형광펜 하이라이트 밴드로 변환
  const handleHighlightCapturedBlock = () => {
    if (!capturedBlockRect) return;
    const midY = capturedBlockRect.y + capturedBlockRect.height / 2;
    const hlStroke: StrokeWithPage = {
      id: `hlblk_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      points: [
        { x: capturedBlockRect.x + 4, y: midY },
        { x: capturedBlockRect.x + capturedBlockRect.width - 4, y: midY },
      ],
      color: '#FACC15',
      width: Math.max(18, Math.min(84, capturedBlockRect.height)),
      tool: 'highlighter',
      isRuler: true,
      pageIndex: currentPageRef.current,
    };
    undoStackRef.current = [...undoStackRef.current, strokesRef.current];
    redoStackRef.current = [];
    setUndoStack(undoStackRef.current);
    setRedoStack([]);
    const next = [...strokesRef.current, hlStroke];
    strokesRef.current = next;
    setStrokes(next);
    setCapturedBlockRect(null);
    setCapturedBlockResult(null);
    setExportToastMessage('🖍️ 선택한 블록 영역에 형광펜 강조가 적용되었습니다!');
    setTimeout(() => setExportToastMessage(null), 1800);
  };

  // 분할 사이드 노트 연결 대상 전환
  const handleChangeSideLinkedNote = (noteId: string | null) => {
    setSideLinkedNoteId(noteId);
    if (noteId) {
      const target = notes.find((n) => n.id === noteId);
      if (target) {
        setSideNoteTitle(target.title || '');
        setSideNoteContent(target.content || '');
      }
    } else {
      setSideNoteTitle(`${(title || 'PDF 문서').replace(/\.pdf$/i, '')} 요약 노트`);
      setSideNoteContent('');
    }
  };

  // 분할 사이드 노트 보드 저장/업데이트
  const handleSaveSideNoteToBoard = () => {
    const cleanTitle = sideNoteTitle.trim() || `${(title || 'PDF 문서').replace(/\.pdf$/i, '')} 요약 노트`;
    const snippetImages: NoteImage[] = sideNoteSnippets
      .filter((s) => !!s.imageDataUrl)
      .map((s) => ({
        id: `img_${s.id}`,
        uri: s.imageDataUrl as string,
        caption: `${s.docName.replace(/\.pdf$/i, '')} (P.${s.pageNumber} 발췌)`,
        placement: 'inline',
        size: 'large',
      }));

    if (sideLinkedNoteId) {
      const existing = notes.find((n) => n.id === sideLinkedNoteId);
      if (existing) {
        updateNote(existing.id, {
          title: cleanTitle,
          content: sideNoteContent,
          images: [...(existing.images || []), ...snippetImages],
          tags: Array.from(new Set([...(existing.tags || []), 'PDF요약'])),
        });
        setSideNoteSnippets([]);
        setExportToastMessage(`💾 '${cleanTitle}' 노트에 사이드 메모와 발췌 블록이 저장되었습니다!`);
        setTimeout(() => setExportToastMessage(null), 2600);
        return;
      }
    }

    addNote({
      title: cleanTitle,
      content: sideNoteContent || `[${title || 'PDF 문서'} 연동 사이드 요약 노트]`,
      color: 'yellow',
      decoStyle: 'tape',
      images: snippetImages,
      checklist: [],
      tags: ['PDF요약', '발췌노트'],
      isPinned: false,
      isLocked: false,
      boardId: 'ideas',
      noteType: 'text',
      paperTemplate: 'lined',
    });
    setSideNoteSnippets([]);
    setExportToastMessage(`✨ '${cleanTitle}' 새 스티커 노트가 보드에 저장되었습니다!`);
    setTimeout(() => setExportToastMessage(null), 2600);
  };

  // 데스크톱 Web 단축키 & 파워 제스처 핸들러 (Ctrl+K 명령 팔레트, Ctrl+Z/Y, Ctrl+F 검색, Space 임시 손바닥 스크롤, PageUp/PageDown, Ctrl+Wheel 줌)
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
        return;
      }

      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea') return;

      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault();
        isSpacePanRef.current = true;
        setIsSpacePanning(true);
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      } else if (e.key === 'PageDown' || (e.altKey && e.key === 'ArrowRight')) {
        e.preventDefault();
        setCurrentPage((p) => Math.min(totalPages, p + 1));
      } else if (e.key === 'PageUp' || (e.altKey && e.key === 'ArrowLeft')) {
        e.preventDefault();
        setCurrentPage((p) => Math.max(1, p - 1));
      } else if (e.key === 'Escape') {
        if (selectedStrokeIdsRef.current.length > 0) {
          setSelectedStrokeIds([]);
          setSelectionBBox(null);
        }
        setCapturedBlockRect(null);
        setCapturedBlockResult(null);
        setSnippetDraftRect(null);
        setRedactDraftRect(null);
        setIsAppendNotePickerOpen(false);
        setSelectedTextBoxId(null);
        setIsColorPickerOpen(false);
        setIsTemplateMenuOpen(false);
        setEditingPresetIndex(null);
        setIsAddPageTemplateModalOpen(false);
        setIsExportModalOpen(false);
        setIsPageJumpModalOpen(false);
        setIsSearchOpen(false);
        setIsCommandPaletteOpen(false);
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedStrokeIdsRef.current.length > 0) {
          handleDeleteSelection();
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        isSpacePanRef.current = false;
        setIsSpacePanning(false);
      }
    };

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY < 0 ? 0.1 : -0.1;
        setZoomLevel((z) => Math.max(0.5, Math.min(2.2, Number((z + delta).toFixed(2)))));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('wheel', handleWheel);
    };
  }, [undoStack, redoStack, selectedStrokeIds, totalPages]);

  // 지우개 터치/드래그 시 해당 스트로크 정밀 검출 및 동기 삭제 (Goodnotes 6 / Notewise 형광펜 전용 지우개 지원)
  const handleEraseAt = (x: number, y: number) => {
    const curPage = currentPageRef.current;
    const currentList = strokesRef.current;
    const toErase = currentList.filter(
      (s) =>
        s.pageIndex === curPage &&
        (!eraseHighlighterOnlyRef.current || s.tool === 'highlighter') &&
        strokeHitsEraser(s, x, y, eraserRadiusRef.current)
    );
    if (toErase.length === 0) return;

    hasErasedInThisDragRef.current = true;
    const erasedIds = new Set(toErase.map((s) => s.id));
    const remaining = currentList.filter((s) => !erasedIds.has(s.id));
    strokesRef.current = remaining;
    setStrokes(remaining);
  };

  // 현재 페이지 모든 필기 전체 삭제 (Goodnotes / Notewise 원클릭 지우개)
  const handleClearCurrentPageStrokes = () => {
    const curPage = currentPageRef.current;
    const hasPageStrokes = strokesRef.current.some((s) => s.pageIndex === curPage);
    if (hasPageStrokes) {
      undoStackRef.current = [...undoStackRef.current, strokesRef.current];
      redoStackRef.current = [];
      setUndoStack(undoStackRef.current);
      setRedoStack([]);
      const remaining = strokesRef.current.filter((s) => s.pageIndex !== curPage);
      strokesRef.current = remaining;
      setStrokes(remaining);
      setExportToastMessage(`P.${curPage} 페이지의 모든 필기가 삭제되었습니다.`);
      setTimeout(() => setExportToastMessage(null), 1800);
    }
  };

  // 텍스트 상자 업데이트 및 삭제
  const handleUpdateTextBox = (id: string, updates: Partial<FreeTextBox>) => {
    setTextBoxes((prev) => prev.map((t) => (t.id === id ? { ...t, ...updates } : t)));
  };

  const handleDeleteTextBox = (id: string) => {
    setTextBoxes((prev) => prev.filter((t) => t.id !== id));
    if (selectedTextBoxId === id) setSelectedTextBoxId(null);
  };

  // 페이지별 필기 획 수 집계 (Organize Pages 뷰용)
  const strokeCountsByPage = React.useMemo(() => {
    const map: Record<number, number> = {};
    for (const s of strokes) {
      const p = s.pageIndex || 1;
      map[p] = (map[p] || 0) + 1;
    }
    return map;
  }, [strokes]);

  // 썸네일 오버뷰 & 페이지 구성: 페이지 복제
  const handleDuplicatePage = (pNum: number) => {
    const pageStrokes = strokesRef.current.filter((s) => s.pageIndex === pNum);
    const newPageNum = totalPages + 1;
    const duplicatedStrokes = pageStrokes.map((s) => ({
      ...s,
      id: 'strk_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      pageIndex: newPageNum,
    }));
    strokesRef.current = [...strokesRef.current, ...duplicatedStrokes];
    setStrokes(strokesRef.current);

    if (isPdfMode) {
      setPdfPages((prev) => {
        const src = prev[pNum - 1] || {
          id: `pdfp_${Date.now()}`,
          pageNumber: pNum,
          title: `${title} — Page ${pNum}`,
          subtitle: '',
          content: '',
        };
        const copy: PdfPageData = {
          ...src,
          id: `pdfp_${Date.now()}_${newPageNum}_${Math.random().toString(36).substring(2, 6)}`,
          pageNumber: newPageNum,
          title: `${src.title} (사본)`,
        };
        return [...prev, copy];
      });
    }

    if (pageTemplates[pNum]) {
      setPageTemplates((prev) => ({ ...prev, [newPageNum]: prev[pNum] }));
    }

    const pageTextBoxes = textBoxes.filter((t) => (t.pageIndex || 1) === pNum);
    if (pageTextBoxes.length > 0) {
      const duplicatedTextBoxes = pageTextBoxes.map((t) => ({
        ...t,
        id: 'box_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        pageIndex: newPageNum,
      }));
      setTextBoxes((prev) => [...prev, ...duplicatedTextBoxes]);
    }

    setTotalPages(newPageNum);
    setCurrentPage(newPageNum);
    setExportToastMessage(`📄 페이지 ${pNum}이(가) 페이지 ${newPageNum}으로 복제되었습니다`);
    setTimeout(() => setExportToastMessage(null), 1800);
  };

  // 페이지 삭제 (1개 이하 보호 및 전체 주석 페이지 번호 재정렬)
  const handleDeletePage = (pNum: number) => {
    if (totalPages <= 1) {
      Alert.alert('삭제 불가', '최소 1개의 페이지는 유지되어야 합니다.');
      return;
    }
    const remainingStrokes = strokesRef.current
      .filter((s) => s.pageIndex !== pNum)
      .map((s) => (s.pageIndex > pNum ? { ...s, pageIndex: s.pageIndex - 1 } : s));
    strokesRef.current = remainingStrokes;
    setStrokes(remainingStrokes);
    setAudioNotes((prev) =>
      prev
        .filter((a) => (a.pageIndex || 1) !== pNum)
        .map((a) => ((a.pageIndex || 1) > pNum ? { ...a, pageIndex: (a.pageIndex || 1) - 1 } : a))
    );
    setTextBoxes((prev) =>
      prev
        .filter((t) => (t.pageIndex || 1) !== pNum)
        .map((t) => ((t.pageIndex || 1) > pNum ? { ...t, pageIndex: (t.pageIndex || 1) - 1 } : t))
    );
    if (isPdfMode) {
      setPdfPages((prev) =>
        prev
          .filter((_, idx) => idx + 1 !== pNum)
          .map((p, idx) => ({ ...p, pageNumber: idx + 1 }))
      );
    }
    setTotalPages((prev) => Math.max(1, prev - 1));
    setCurrentPage((prev) => (prev >= pNum ? Math.max(1, prev - 1) : prev));
    setExportToastMessage(`🗑️ 페이지 ${pNum}번이 삭제되었습니다.`);
    setTimeout(() => setExportToastMessage(null), 1800);
  };

  // Adobe Acrobat 페이지 구성: 드래그 앤 드롭 및 화살표를 통한 임의 위치 페이지 이동 (필기/텍스트/오디오/스탬프/먹칠/댓글/회전 동기 이동)
  const handleMovePage = (fromPage: number, toPage: number) => {
    if (fromPage === toPage || fromPage < 1 || fromPage > totalPages || toPage < 1 || toPage > totalPages) return;

    const oldOrder = Array.from({ length: totalPages }, (_, i) => i + 1);
    const [movedOldNum] = oldOrder.splice(fromPage - 1, 1);
    oldOrder.splice(toPage - 1, 0, movedOldNum);

    const oldToNewMap = new Map<number, number>();
    oldOrder.forEach((oldNum, idx) => {
      oldToNewMap.set(oldNum, idx + 1);
    });

    setPdfPages((prev) => {
      if (prev.length < totalPages) return prev;
      return oldOrder.map((oldNum, idx) => ({
        ...prev[oldNum - 1],
        pageNumber: idx + 1,
      }));
    });

    const remapIdx = (idx?: number) => oldToNewMap.get(idx || 1) || (idx || 1);

    const reorderedStrokes = strokesRef.current.map((s) => ({
      ...s,
      pageIndex: remapIdx(s.pageIndex),
    }));
    strokesRef.current = reorderedStrokes;
    setStrokes(reorderedStrokes);

    setTextBoxes((prev) => prev.map((t) => ({ ...t, pageIndex: remapIdx(t.pageIndex) })));
    setAudioNotes((prev) => prev.map((a) => ({ ...a, pageIndex: remapIdx(a.pageIndex) })));
    setPdfStamps((prev) => prev.map((st) => ({ ...st, pageIndex: remapIdx(st.pageIndex) })));
    setPdfRedactions((prev) => prev.map((r) => ({ ...r, pageIndex: remapIdx(r.pageIndex) })));
    setPdfComments((prev) => prev.map((c) => ({ ...c, pageIndex: remapIdx(c.pageIndex) })));
    setPageRotations((prev) => {
      const next: Record<number, number> = {};
      Object.entries(prev).forEach(([k, rot]) => {
        const mapped = oldToNewMap.get(Number(k));
        if (mapped) next[mapped] = rot;
      });
      return next;
    });
    setPageTemplates((prev) => {
      const next: Record<number, PaperTemplate> = {};
      Object.entries(prev).forEach(([k, tpl]) => {
        const mapped = oldToNewMap.get(Number(k));
        if (mapped) next[mapped] = tpl;
      });
      return next;
    });
    setBookmarkedPages((prev) =>
      prev.map((p) => oldToNewMap.get(p) || p).sort((a, b) => a - b)
    );
    setCurrentPage(toPage);
    setExportToastMessage(`🗂️ P.${fromPage} → P.${toPage} 위치로 페이지가 이동되었습니다.`);
    setTimeout(() => setExportToastMessage(null), 1800);
  };

  // 특정 페이지 90도 회전
  const handleRotatePageAt = (pNum: number) => {
    setPageRotations((prev) => {
      const cur = prev[pNum] || 0;
      const next = (cur + 90) % 360;
      setExportToastMessage(`🔄 P.${pNum} 페이지 회전: ${next}°`);
      setTimeout(() => setExportToastMessage(null), 1500);
      return { ...prev, [pNum]: next };
    });
  };

  // 특정 페이지 뒤에 새 빈 페이지 삽입
  const handleInsertBlankPageAfter = (afterPage: number) => {
    const insertIdx = Math.max(0, Math.min(totalPages, afterPage));
    const newPageNum = insertIdx + 1;

    setPdfPages((prev) => {
      const blankPage: PdfPageData = {
        id: `pdfp_${Date.now()}_${newPageNum}_${Math.random().toString(36).substring(2, 6)}`,
        pageNumber: newPageNum,
        title: `${title.replace(/\.pdf$/i, '')} — 추가 페이지`,
        subtitle: `빈 페이지 (P.${afterPage} 뒤에 삽입됨)`,
        content: '',
        sourcePdfName: title,
      };
      const next = [...prev.slice(0, insertIdx), blankPage, ...prev.slice(insertIdx)];
      return next.map((p, idx) => ({ ...p, pageNumber: idx + 1 }));
    });

    const shiftIdx = (idx?: number) => {
      const p = idx || 1;
      return p > insertIdx ? p + 1 : p;
    };
    const shiftedStrokes = strokesRef.current.map((s) => ({
      ...s,
      pageIndex: shiftIdx(s.pageIndex),
    }));
    strokesRef.current = shiftedStrokes;
    setStrokes(shiftedStrokes);
    setTextBoxes((prev) => prev.map((t) => ({ ...t, pageIndex: shiftIdx(t.pageIndex) })));
    setAudioNotes((prev) => prev.map((a) => ({ ...a, pageIndex: shiftIdx(a.pageIndex) })));

    setTotalPages((prev) => prev + 1);
    setCurrentPage(newPageNum);
    setExportToastMessage(`➕ P.${newPageNum} 위치에 새 빈 페이지가 삽입되었습니다.`);
    setTimeout(() => setExportToastMessage(null), 1800);
  };

  // Adobe Acrobat 스타일 PDF 병합 및 다른 PDF 페이지 복사·드래그 삽입 (Merge / Copy-Paste Pages)
  const handleMergePages = (
    incomingPages: PdfPageData[],
    sourceNote: Note | null,
    position: 'append' | 'prepend' | 'after_current',
    customInsertIndex?: number,
    selectedSourcePageNums?: number[]
  ) => {
    if (!incomingPages || incomingPages.length === 0) return;
    const count = incomingPages.length;
    const insertIndex =
      typeof customInsertIndex === 'number'
        ? Math.max(0, Math.min(pdfPages.length, customInsertIndex))
        : position === 'prepend'
        ? 0
        : position === 'after_current'
        ? Math.min(pdfPages.length, currentPage)
        : pdfPages.length;

    const clonedIncoming = incomingPages.map((p, idx) => ({
      ...p,
      id: `pdfp_ins_${Date.now()}_${idx + 1}_${Math.random().toString(36).substring(2, 6)}`,
      sourcePdfName: p.sourcePdfName || sourceNote?.title || sourceNote?.pdfName || '외부 PDF',
    }));

    const nextPages = [
      ...pdfPages.slice(0, insertIndex),
      ...clonedIncoming,
      ...pdfPages.slice(insertIndex),
    ].map((p, idx) => ({ ...p, pageNumber: idx + 1 }));

    setPdfPages(nextPages);
    setTotalPages(nextPages.length);

    // 기존 주석들의 페이지 인덱스 시프트
    const shiftExisting = (pIdx?: number) => {
      const p = pIdx || 1;
      return p > insertIndex ? p + count : p;
    };

    let mergedStrokes: StrokeWithPage[] = strokesRef.current.map((s) => ({
      ...s,
      pageIndex: shiftExisting(s.pageIndex),
    }));
    let mergedTextBoxes: FreeTextBox[] = textBoxes.map((t) => ({
      ...t,
      pageIndex: shiftExisting(t.pageIndex),
    }));
    let mergedAudios: AudioNote[] = audioNotes.map((a) => ({
      ...a,
      pageIndex: shiftExisting(a.pageIndex),
    }));

    setPdfStamps((prev) => prev.map((st) => ({ ...st, pageIndex: shiftExisting(st.pageIndex) })));
    setPdfRedactions((prev) => prev.map((r) => ({ ...r, pageIndex: shiftExisting(r.pageIndex) })));
    setPdfComments((prev) => prev.map((c) => ({ ...c, pageIndex: shiftExisting(c.pageIndex) })));
    setPageRotations((prev) => {
      const next: Record<number, number> = {};
      Object.entries(prev).forEach(([k, rot]) => {
        next[shiftExisting(Number(k))] = rot;
      });
      return next;
    });

    // 병합/복사 원본 노트에 있던 필기/텍스트/오디오도 선택된 페이지 매핑에 맞춰 함께 복사
    if (sourceNote) {
      const srcPageToNewPage = new Map<number, number>();
      if (selectedSourcePageNums && selectedSourcePageNums.length === count) {
        selectedSourcePageNums.forEach((origPageNum, idx) => {
          srcPageToNewPage.set(origPageNum, insertIndex + idx + 1);
        });
      } else {
        for (let i = 1; i <= count; i++) {
          srcPageToNewPage.set(i, insertIndex + i);
        }
      }

      if (sourceNote.strokes && sourceNote.strokes.length > 0) {
        const incomingStrokes: StrokeWithPage[] = sourceNote.strokes
          .filter((s) => srcPageToNewPage.has(s.pageIndex || 1))
          .map((s) => ({
            ...s,
            id: `strk_m_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            pageIndex: srcPageToNewPage.get(s.pageIndex || 1) || insertIndex + 1,
          }));
        mergedStrokes = [...mergedStrokes, ...incomingStrokes];
      }
      if (sourceNote.textBoxes && sourceNote.textBoxes.length > 0) {
        const incomingBoxes: FreeTextBox[] = sourceNote.textBoxes
          .filter((t) => srcPageToNewPage.has(t.pageIndex || 1))
          .map((t) => ({
            ...t,
            id: `tb_m_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            pageIndex: srcPageToNewPage.get(t.pageIndex || 1) || insertIndex + 1,
          }));
        mergedTextBoxes = [...mergedTextBoxes, ...incomingBoxes];
      }
      if (sourceNote.audioNotes && sourceNote.audioNotes.length > 0) {
        const incomingAudios: AudioNote[] = sourceNote.audioNotes
          .filter((a) => srcPageToNewPage.has(a.pageIndex || 1))
          .map((a) => ({
            ...a,
            id: `aud_m_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            pageIndex: srcPageToNewPage.get(a.pageIndex || 1) || insertIndex + 1,
          }));
        mergedAudios = [...mergedAudios, ...incomingAudios];
      }
    }

    strokesRef.current = mergedStrokes;
    setStrokes(mergedStrokes);
    setTextBoxes(mergedTextBoxes);
    setAudioNotes(mergedAudios);
    setCurrentPage(insertIndex + 1);
    setPdfWorkspaceTab('organize');
    setExportToastMessage(
      `📑 P.${insertIndex + 1} 위치에 ${count}페이지가 삽입되었습니다! (총 ${nextPages.length}페이지 · 드래그하여 위치 이동 가능)`
    );
    setTimeout(() => setExportToastMessage(null), 3000);
  };

  // Adobe Acrobat 스타일 PDF 분할 및 추출 (Split / Extract PDF)
  const handleSplitPages = (
    selectedPageNums: number[],
    removeOriginalPages: boolean,
    newDocTitle: string
  ) => {
    if (!selectedPageNums || selectedPageNums.length === 0) return;
    const sorted = [...selectedPageNums].sort((a, b) => a - b);
    const pageMap = new Map<number, number>();
    sorted.forEach((oldPageNum, idx) => {
      pageMap.set(oldPageNum, idx + 1);
    });

    const extractedPages: PdfPageData[] = sorted
      .map((pNum, idx) => {
        const src = pdfPages[pNum - 1];
        if (!src) return null;
        return {
          ...src,
          id: `pdfp_split_${Date.now()}_${idx + 1}_${Math.random().toString(36).substring(2, 6)}`,
          pageNumber: idx + 1,
        };
      })
      .filter(Boolean) as PdfPageData[];

    const extractedStrokes = strokesRef.current
      .filter((s) => pageMap.has(s.pageIndex || 1))
      .map((s) => ({
        ...s,
        id: `strk_sp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        pageIndex: pageMap.get(s.pageIndex || 1) || 1,
      }));

    const extractedBoxes = textBoxes
      .filter((t) => pageMap.has(t.pageIndex || 1))
      .map((t) => ({
        ...t,
        id: `tb_sp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        pageIndex: pageMap.get(t.pageIndex || 1) || 1,
      }));

    const extractedAudios = audioNotes
      .filter((a) => pageMap.has(a.pageIndex || 1))
      .map((a) => ({
        ...a,
        id: `aud_sp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        pageIndex: pageMap.get(a.pageIndex || 1) || 1,
      }));

    const finalNewTitle = newDocTitle.endsWith('.pdf') ? newDocTitle : `${newDocTitle}.pdf`;

    addNote({
      title: finalNewTitle,
      pdfName: finalNewTitle,
      pdfPages: extractedPages,
      content:
        extractedPages[0]?.content?.slice(0, 180) ||
        `[분할 추출된 PDF] 원본: ${title} (${extractedPages.length}페이지)`,
      color: 'paper',
      decoStyle: 'minimal',
      images: [],
      checklist: [],
      tags: ['PDF', '분할문서'],
      isPinned: false,
      isLocked: false,
      strokes: extractedStrokes,
      textBoxes: extractedBoxes,
      audioNotes: extractedAudios,
      paperTemplate,
      boardId: 'ideas',
      noteType: 'pdf',
      bookmarkedPages: [1],
      pageTemplates: {},
    });

    if (removeOriginalPages && sorted.length < pdfPages.length) {
      const remainingSet = new Set(sorted);
      const remainingMap = new Map<number, number>();
      let newIdx = 1;
      const remainingPages: PdfPageData[] = [];
      pdfPages.forEach((p, idx) => {
        const oldNum = idx + 1;
        if (!remainingSet.has(oldNum)) {
          remainingMap.set(oldNum, newIdx);
          remainingPages.push({ ...p, pageNumber: newIdx });
          newIdx++;
        }
      });

      const remainingStrokes = strokesRef.current
        .filter((s) => remainingMap.has(s.pageIndex || 1))
        .map((s) => ({ ...s, pageIndex: remainingMap.get(s.pageIndex || 1) || 1 }));
      strokesRef.current = remainingStrokes;
      setStrokes(remainingStrokes);

      setTextBoxes((prev) =>
        prev
          .filter((t) => remainingMap.has(t.pageIndex || 1))
          .map((t) => ({ ...t, pageIndex: remainingMap.get(t.pageIndex || 1) || 1 }))
      );
      setAudioNotes((prev) =>
        prev
          .filter((a) => remainingMap.has(a.pageIndex || 1))
          .map((a) => ({ ...a, pageIndex: remainingMap.get(a.pageIndex || 1) || 1 }))
      );

      setPdfPages(remainingPages);
      setTotalPages(remainingPages.length);
      setCurrentPage(1);
      setPdfWorkspaceTab('organize');
      setExportToastMessage(
        `✂️ '${finalNewTitle}'(${extractedPages.length}장)으로 분리 완료! 현재 문서에는 ${remainingPages.length}장이 남았습니다.`
      );
    } else {
      setExportToastMessage(
        `✂️ '${finalNewTitle}'(${extractedPages.length}장) 새 PDF 메모가 워크스페이스에 생성되었습니다!`
      );
    }
    setTimeout(() => setExportToastMessage(null), 3200);
  };

  // 문서 내 단어 검색 일치 목록 및 위치 탐색
  const searchMatches = React.useMemo(() => {
    if (!searchQuery.trim() || !isPdfMode || !activeDocument) return [];
    const q = searchQuery.toLowerCase();
    const safeRegex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
    return activeDocument.pages
      .map((p) => {
        const contentCount = (p.content.toLowerCase().match(safeRegex) || []).length;
        const titleCount = p.title.toLowerCase().includes(q) ? 1 : 0;
        const subCount = p.subtitle.toLowerCase().includes(q) ? 1 : 0;
        return {
          pageNumber: p.pageNumber,
          title: p.title,
          count: contentCount + titleCount + subCount,
        };
      })
      .filter((m) => m.count > 0);
  }, [searchQuery, isPdfMode, activeDocument]);

  const totalSearchCount = React.useMemo(() => {
    return searchMatches.reduce((acc, m) => acc + m.count, 0);
  }, [searchMatches]);

  const handleNextSearchMatch = () => {
    if (searchMatches.length === 0) return;
    const nextIdx = (activeSearchIndex + 1) % searchMatches.length;
    setActiveSearchIndex(nextIdx);
    const targetPage = searchMatches[nextIdx].pageNumber;
    setCurrentPage(targetPage);
    setExportToastMessage(`🔍 '${searchQuery}' 검색 결과: P.${targetPage} (${nextIdx + 1}/${searchMatches.length})`);
    setTimeout(() => setExportToastMessage(null), 1800);
  };

  const handlePrevSearchMatch = () => {
    if (searchMatches.length === 0) return;
    const prevIdx = (activeSearchIndex - 1 + searchMatches.length) % searchMatches.length;
    setActiveSearchIndex(prevIdx);
    const targetPage = searchMatches[prevIdx].pageNumber;
    setCurrentPage(targetPage);
    setExportToastMessage(`🔍 '${searchQuery}' 검색 결과: P.${targetPage} (${prevIdx + 1}/${searchMatches.length})`);
    setTimeout(() => setExportToastMessage(null), 1800);
  };

  // 공간 오디오 핀 위치 변경 및 관리 (Notewise 자유 배치 오디오 스탬프)
  const handleUpdateAudioPos = (id: string, x: number, y: number) => {
    setAudioNotes((prev) =>
      prev.map((a) => (a.id === id ? { ...a, x, y } : a))
    );
  };

  const handleDeleteAudio = (id: string) => {
    setAudioNotes((prev) => prev.filter((a) => a.id !== id));
  };

  const handleStopRecording = (newAudio: AudioNote) => {
    const curPage = currentPageRef.current;
    const pageAudios = audioNotes.filter((a) => (a.pageIndex || 1) === curPage);
    const seq = pageAudios.length + 1;
    const placedAudio: AudioNote = {
      ...newAudio,
      pageIndex: curPage,
      title: `P.${curPage} 녹음 ${seq > 1 ? seq : ''}`.trim(),
      x: 60,
      y: 80 + (pageAudios.length * 48) % 600,
    };
    setAudioNotes((prev) => [...prev, placedAudio]);
    setIsRecording(false);
  };

  // 인쇄 및 PDF 내보내기 (Goodnotes / Notewise 내보내기)
  const handleExportPdfOrPrint = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.print();
    } else {
      Alert.alert('인쇄 및 PDF', 'PDF 문서 내보내기 준비가 완료되었습니다.');
    }
    setIsExportModalOpen(false);
  };

  // 문서 전체 텍스트 및 주석 클립보드 복사
  const handleCopyDocumentContent = () => {
    let fullText = `[StickyCraft 문서: ${title}]\n\n`;
    if (isPdfMode && activeDocument) {
      activeDocument.pages.forEach((p) => {
        fullText += `--- 페이지 ${p.pageNumber}: ${p.title} ---\n`;
        if (p.subtitle) fullText += `${p.subtitle}\n`;
        fullText += `${p.content}\n\n`;
      });
    }
    if (textBoxes.length > 0) {
      fullText += `[추가 텍스트 메모 및 주석 (${textBoxes.length}건)]\n`;
      textBoxes.forEach((tb, i) => {
        fullText += `${i + 1}. (P.${tb.pageIndex || 1}) ${tb.text || '(빈 메모)'}\n`;
      });
      fullText += '\n';
    }
    if (audioNotes.length > 0) {
      fullText += `[녹음된 음성 메모 (${audioNotes.length}건)]\n`;
      audioNotes.forEach((a, i) => {
        const mins = Math.floor(a.duration / 60);
        const secs = a.duration % 60;
        fullText += `${i + 1}. (P.${a.pageIndex || 1}) ${mins}분 ${secs}초 녹음 파일\n`;
      });
    }

    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(fullText).catch(console.error);
    }
    setExportToastMessage('문서 전체 내용이 클립보드에 복사되었습니다!');
    setTimeout(() => setExportToastMessage(null), 3000);
    setIsExportModalOpen(false);
  };

  // JSON 데이터 백업 파일 다운로드
  const handleExportBackupJson = () => {
    const backupData = {
      title,
      isPdfMode,
      totalPages,
      paperTemplate,
      strokes: strokesRef.current,
      textBoxes,
      audioNotes,
      exportedAt: new Date().toISOString(),
    };
    const jsonStr = JSON.stringify(backupData, null, 2);
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${title.replace(/\.pdf$/i, '')}_backup.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
    setExportToastMessage('JSON 백업 파일이 다운로드되었습니다!');
    setTimeout(() => setExportToastMessage(null), 3000);
    setIsExportModalOpen(false);
  };

  // 실제 .pdf 바이너리 파일 다운로드 (pdf-lib 엔진: 원본 이미지·필기·스탬프·워터마크·머리글·먹칠·회전 모두 반영)
  const handleExportRealPdfBinary = async () => {
    setExportToastMessage('⏳ 실제 PDF(.pdf) 문서를 합성하여 생성하는 중...');
    try {
      const ok = await exportDocumentToRealPdf({
        title: title || 'StickyCraft_Document.pdf',
        totalPages,
        pageWidth: pageLayout.width || 720,
        pageHeight: pageLayout.height || 1018,
        isPdfMode,
        isNightMode,
        defaultTemplate: paperTemplate,
        pageTemplates,
        pageRotations,
        pdfPages,
        strokes: strokesRef.current,
        textBoxes,
        stamps: pdfStamps,
        redactions: pdfRedactions,
        watermark: pdfWatermark,
        headerFooter: pdfHeaderFooter,
        meta: pdfMeta,
      });
      setIsExportModalOpen(false);
      setExportToastMessage(
        ok
          ? `📄 '${(title || 'document').replace(/\.pdf$/i, '')}.pdf' 실제 PDF 파일이 다운로드되었습니다!`
          : '⚠️ PDF 내보내기는 웹 브라우저 환경에서 지원됩니다.'
      );
      setTimeout(() => setExportToastMessage(null), 3200);
    } catch (err) {
      console.warn('Real PDF export failed:', err);
      setExportToastMessage('⚠️ PDF 생성 중 오류가 발생했습니다.');
      setTimeout(() => setExportToastMessage(null), 2500);
    }
  };

  // 현재 페이지를 2x HiDPI PNG 이미지 파일로 다운로드
  const handleExportCurrentPagePng = async () => {
    setExportToastMessage(`⏳ P.${currentPage} 페이지를 고해상도 PNG 이미지로 저장 중...`);
    const ok = await exportPageToPngFile({
      fileNameBase: title || 'StickyCraft_Page',
      pageNumber: currentPage,
      totalPages,
      pageWidth: pageLayout.width || 720,
      pageHeight: pageLayout.height || 1018,
      isPdfMode,
      isNightMode,
      paperTemplate: pageTemplates[currentPage] || paperTemplate,
      pdfPage: pdfPages[currentPage - 1] || null,
      strokes: strokesRef.current.filter((s) => (s.pageIndex || 1) === currentPage),
      textBoxes: textBoxes.filter((t) => (t.pageIndex || 1) === currentPage),
      stamps: pdfStamps.filter((s) => s.pageIndex === currentPage),
      redactions: pdfRedactions.filter((r) => r.pageIndex === currentPage),
      watermark: pdfWatermark,
      headerFooter: pdfHeaderFooter,
    });
    setIsExportModalOpen(false);
    setExportToastMessage(
      ok
        ? `🖼️ P.${currentPage} 고해상도 PNG 이미지가 다운로드되었습니다!`
        : '⚠️ PNG 이미지 저장에 실패했습니다.'
    );
    setTimeout(() => setExportToastMessage(null), 2800);
  };

  // 다중 페이지 일괄 90° 회전
  const handleBatchRotatePages = (pageNums: number[]) => {
    if (!pageNums || pageNums.length === 0) return;
    setPageRotations((prev) => {
      const next = { ...prev };
      for (const p of pageNums) {
        next[p] = ((prev[p] || 0) + 90) % 360;
      }
      return next;
    });
    setExportToastMessage(`🔄 선택한 ${pageNums.length}개 페이지가 일괄 90° 회전되었습니다!`);
    setTimeout(() => setExportToastMessage(null), 2200);
  };

  // 다중 페이지 일괄 삭제
  const handleBatchDeletePages = (pageNums: number[]) => {
    if (!pageNums || pageNums.length === 0 || pageNums.length >= totalPages) return;
    const removeSet = new Set(pageNums);
    const remainingMap = new Map<number, number>();
    let nextIdx = 1;
    const remainingPages: PdfPageData[] = [];
    for (let oldNum = 1; oldNum <= totalPages; oldNum++) {
      if (!removeSet.has(oldNum)) {
        remainingMap.set(oldNum, nextIdx);
        if (pdfPages[oldNum - 1]) {
          remainingPages.push({ ...pdfPages[oldNum - 1], pageNumber: nextIdx });
        }
        nextIdx++;
      }
    }
    const newTotal = Math.max(1, nextIdx - 1);
    if (isPdfMode) setPdfPages(remainingPages);
    const nextStrokes = strokesRef.current
      .filter((s) => remainingMap.has(s.pageIndex || 1))
      .map((s) => ({ ...s, pageIndex: remainingMap.get(s.pageIndex || 1) || 1 }));
    strokesRef.current = nextStrokes;
    setStrokes(nextStrokes);
    setTextBoxes((prev) =>
      prev
        .filter((t) => remainingMap.has(t.pageIndex || 1))
        .map((t) => ({ ...t, pageIndex: remainingMap.get(t.pageIndex || 1) || 1 }))
    );
    setAudioNotes((prev) =>
      prev
        .filter((a) => remainingMap.has(a.pageIndex || 1))
        .map((a) => ({ ...a, pageIndex: remainingMap.get(a.pageIndex || 1) || 1 }))
    );
    setPdfStamps((prev) =>
      prev
        .filter((st) => remainingMap.has(st.pageIndex))
        .map((st) => ({ ...st, pageIndex: remainingMap.get(st.pageIndex) || 1 }))
    );
    setPdfRedactions((prev) =>
      prev
        .filter((r) => remainingMap.has(r.pageIndex))
        .map((r) => ({ ...r, pageIndex: remainingMap.get(r.pageIndex) || 1 }))
    );
    setPdfComments((prev) =>
      prev
        .filter((c) => remainingMap.has(c.pageIndex))
        .map((c) => ({ ...c, pageIndex: remainingMap.get(c.pageIndex) || 1 }))
    );
    setTotalPages(newTotal);
    setCurrentPage(1);
    setExportToastMessage(`🗑️ 선택한 ${pageNums.length}개 페이지가 일괄 삭제되었습니다.`);
    setTimeout(() => setExportToastMessage(null), 2200);
  };

  // 매 N페이지마다 자동 일괄 분할 (Split every N pages)
  const handleSplitEveryNPages = (chunkSize: number, baseTitle: string) => {
    const size = Math.max(1, chunkSize);
    const total = pdfPages.length;
    if (total < 2) return;
    let createdCount = 0;
    for (let start = 1; start <= total; start += size) {
      const end = Math.min(total, start + size - 1);
      const nums: number[] = [];
      for (let p = start; p <= end; p++) nums.push(p);
      const label = start === end ? `P${start}` : `P${start}-${end}`;
      handleSplitPages(nums, false, `${baseTitle}_${label}.pdf`);
      createdCount++;
    }
    setExportToastMessage(
      `📚 ${size}장씩 총 ${createdCount}개의 분할 PDF 문서가 보관함에 일괄 생성되었습니다!`
    );
    setTimeout(() => setExportToastMessage(null), 3200);
  };

  // 스탬프 배치 / 먹칠 확정 / 스레드 댓글 핀 배치 핸들러
  const placeStampAt = (x: number, y: number, pageNum = currentPageRef.current) => {
    const preset = activeStampPresetRef.current;
    const newStamp: PdfStampItem = {
      id: `stmp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      pageIndex: pageNum,
      x: Math.max(12, Math.min((pageLayout.width || 720) - 150, x - 68)),
      y: Math.max(12, Math.min((pageLayout.height || 1018) - 56, y - 22)),
      label: preset.label,
      sublabel: preset.sublabel,
      color: preset.color,
      rotation: -8,
    };
    setPdfStamps((prev) => [...prev, newStamp]);
    setExportToastMessage(`💮 P.${pageNum}에 [${preset.label}] 스탬프가 찍혔습니다.`);
    setTimeout(() => setExportToastMessage(null), 1800);
  };

  const finalizeRedactionRect = (
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    pageNum = currentPageRef.current
  ) => {
    const x = Math.max(0, Math.min(startX, endX));
    const y = Math.max(0, Math.min(startY, endY));
    const width = Math.abs(endX - startX);
    const height = Math.abs(endY - startY);
    if (width < 12 || height < 10) return;
    const newRedaction: PdfRedactionRect = {
      id: `rdct_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      pageIndex: pageNum,
      x: Math.round(x),
      y: Math.round(y),
      width: Math.round(width),
      height: Math.round(height),
      reason: 'REDACTED',
    };
    setPdfRedactions((prev) => [...prev, newRedaction]);
    setExportToastMessage(
      `⬛ 민감정보 먹칠 적용 완료 (블록 발췌 및 실제 PDF 저장 시 영구 마스킹)`
    );
    setTimeout(() => setExportToastMessage(null), 2200);
  };

  const placeCommentPinAt = (x: number, y: number, pageNum = currentPageRef.current) => {
    const newThread: PdfCommentThread = {
      id: `cmnt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      pageIndex: pageNum,
      x: Math.max(16, Math.min((pageLayout.width || 720) - 44, Math.round(x))),
      y: Math.max(16, Math.min((pageLayout.height || 1018) - 44, Math.round(y))),
      resolved: false,
      createdAt: Date.now(),
      messages: [
        {
          id: `cmsg_${Date.now()}`,
          author: pdfMeta.author || '검토자',
          text: `P.${pageNum} (${Math.round(x)}, ${Math.round(y)}) 위치 검토 메모`,
          createdAt: Date.now(),
        },
      ],
    };
    setPdfComments((prev) => [...prev, newThread]);
    setActiveCommentThreadId(newThread.id);
    setIsCommentsDrawerOpen(true);
    setExportToastMessage(`💬 P.${pageNum}에 스레드 댓글 핀이 추가되었습니다.`);
    setTimeout(() => setExportToastMessage(null), 2000);
  };

  // 문서 단어 수 & 주석 통계 실시간 집계
  const documentWordStats = React.useMemo(
    () =>
      computeDocumentWordStats({
        pdfPages,
        currentPage,
        totalPages,
        strokes,
        textBoxes,
        stamps: pdfStamps,
        redactions: pdfRedactions,
        comments: pdfComments,
      }),
    [pdfPages, currentPage, totalPages, strokes, textBoxes, pdfStamps, pdfRedactions, pdfComments]
  );

  // Ctrl+K 명령 팔레트 전체 명령 목록
  const commandPaletteItems: PdfCommandItem[] = React.useMemo(
    () => [
      {
        id: 'view-single',
        label: '보기 레이아웃: 단일 페이지 (Single Page)',
        description: '한 페이지씩 집중해서 필기 및 주석 작업',
        category: '보기',
        keywords: 'single 단일 한쪽',
        onExecute: () => {
          setPdfWorkspaceTab('annotate');
          setViewLayout('single');
        },
      },
      {
        id: 'view-continuous',
        label: '보기 레이아웃: 연속 세로 스크롤 (Continuous Scroll)',
        description: '모든 페이지를 위아래로 끊김 없이 연속 스크롤하며 열람 및 필기',
        category: '보기',
        keywords: 'continuous 연속 스크롤 전체',
        onExecute: () => {
          setPdfWorkspaceTab('annotate');
          setViewLayout('continuous');
        },
      },
      {
        id: 'view-twoup',
        label: '보기 레이아웃: 양면 2페이지 나란히 보기 (Two-Up Spread)',
        description: '책처럼 좌우 두 페이지를 한 화면에 나란히 펼쳐서 열람 및 비교',
        category: '보기',
        keywords: 'two-up 양면 2쪽 펼침',
        onExecute: () => {
          setPdfWorkspaceTab('annotate');
          setViewLayout('two-up');
        },
      },
      {
        id: 'tool-stamp',
        label: '스탬프 도구 (승인 / 초안 / 기밀 / 검토 완료)',
        description: '페이지 원하는 위치에 공식 검토 스탬프 배치',
        category: '편집',
        keywords: 'stamp 스탬프 도장 승인 기밀 초안',
        onExecute: () => {
          setPdfWorkspaceTab('annotate');
          setActiveTool('stamp');
        },
      },
      {
        id: 'tool-redact',
        label: '민감정보 먹칠 / 가림 도구 (Redaction)',
        description: '개인정보나 기밀 문구를 드래그해 검정 박스로 영구 마스킹',
        category: '편집',
        keywords: 'redact 먹칠 가림 개인정보 마스킹',
        onExecute: () => {
          setPdfWorkspaceTab('annotate');
          setActiveTool('redact');
        },
      },
      {
        id: 'tool-comment',
        label: '스레드 댓글 핀 추가 및 댓글 패널 열기',
        description: '페이지 좌표에 댓글 핀을 찍고 답글/해결 상태 관리',
        category: '검토',
        keywords: 'comment 댓글 코멘트 리뷰 검토',
        onExecute: () => {
          setPdfWorkspaceTab('annotate');
          setActiveTool('comment');
          setIsCommentsDrawerOpen(true);
        },
      },
      {
        id: 'tool-snippet',
        label: 'PDF 블록 지정 캡처 & 노트로 가져오기',
        description: '원하는 영역을 드래그해 클립보드 복사 또는 새 노트/사이드 노트로 발췌',
        category: '편집',
        keywords: 'snippet block 블록 캡처 발췌 복사',
        onExecute: () => {
          setPdfWorkspaceTab('annotate');
          setActiveTool('snippet');
        },
      },
      {
        id: 'modal-watermark',
        label: '워터마크 · 머리글 · 바닥글 · 페이지 번호 설정',
        description: '대각선 워터마크(기밀/초안) 및 머리글·바닥글·자동 페이지 번호 구성',
        category: '편집',
        keywords: 'watermark header footer 워터마크 머리글 바닥글 페이지번호',
        onExecute: () => setIsWatermarkModalOpen(true),
      },
      {
        id: 'modal-compare',
        label: '두 PDF 문서 비교 (Compare PDFs)',
        description: '현재 PDF와 다른 PDF 문서의 페이지별 추가/삭제된 줄 차이점 비교',
        category: '검토',
        keywords: 'compare diff 비교 차이',
        onExecute: () => setIsCompareModalOpen(true),
      },
      {
        id: 'modal-props',
        label: '문서 속성 및 단어 수 / 주석 통계 보기',
        description: '작성자·주제·키워드 메타데이터 편집 및 페이지/전체 단어·글자 수 확인',
        category: '검토',
        keywords: 'properties word count 속성 통계 단어 글자수 메타데이터',
        onExecute: () => setIsPropertiesModalOpen(true),
      },
      {
        id: 'tab-organize',
        label: '페이지 구성 스튜디오 (다중 선택 / 일괄 회전 / 순서 변경)',
        description: '썸네일 그리드에서 페이지를 다중 선택하여 일괄 회전·삭제·추출',
        category: '문서 구성',
        keywords: 'organize 페이지 구성 회전 정렬',
        onExecute: () => setPdfWorkspaceTab('organize'),
      },
      {
        id: 'tab-merge',
        label: 'PDF 병합 스튜디오 (Merge PDF)',
        description: '외부 PDF 파일이나 앱 내 노트를 현재 문서의 원하는 위치에 병합',
        category: '문서 구성',
        keywords: 'merge combine 병합 합치기',
        onExecute: () => setPdfWorkspaceTab('merge'),
      },
      {
        id: 'tab-split',
        label: 'PDF 분할 및 매 N페이지 자동 일괄 분할 (Split PDF)',
        description: '특정 페이지 범위 추출 또는 매 N장마다 여러 PDF로 자동 분할',
        category: '문서 구성',
        keywords: 'split extract 분할 추출 나누기',
        onExecute: () => setPdfWorkspaceTab('split'),
      },
      {
        id: 'export-real-pdf',
        label: '실제 PDF 파일로 다운로드 (.pdf)',
        description: '필기·스탬프·워터마크·먹칠이 모두 합쳐진 정식 .pdf 바이너리 파일 저장',
        category: '내보내기',
        keywords: 'export download pdf 저장 내보내기 다운로드',
        onExecute: handleExportRealPdfBinary,
      },
      {
        id: 'export-png',
        label: `현재 페이지(P.${currentPage}) 고해상도 PNG 이미지 저장 (.png)`,
        description: '현재 페이지를 2x HiDPI PNG 이미지 파일로 즉시 다운로드',
        category: '내보내기',
        keywords: 'png image 이미지 사진 저장',
        onExecute: handleExportCurrentPagePng,
      },
      {
        id: 'search-doc',
        label: '문서 내 키워드 검색',
        description: 'PDF 전체 페이지에서 단어를 검색하고 즉시 점프',
        category: '보기',
        shortcut: 'Ctrl+F',
        keywords: 'search find 검색 찾기',
        onExecute: () => setIsSearchOpen(true),
      },
      {
        id: 'toggle-night',
        label: isNightMode ? '주간 모드로 전환' : '야간 다크 모드로 전환',
        description: '눈부심 방지 다크 리더 모드 토글',
        category: '보기',
        keywords: 'night dark 야간 다크',
        onExecute: () => setIsNightMode((p) => !p),
      },
    ],
    [currentPage, isNightMode, title, totalPages, pdfPages, pdfStamps, pdfRedactions, pdfWatermark, pdfHeaderFooter, pdfMeta]
  );

  // 특정 페이지로 직접 이동 (Jump to Page)
  const handleJumpToPage = (targetNum: number) => {
    const p = Math.max(1, Math.min(totalPages, targetNum));
    setCurrentPage(p);
    setIsPageJumpModalOpen(false);
    setJumpPageInput('');
  };

  // 터치 제스처 핸들러 (PanResponder for Mobile & Responsive Web)
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () =>
        activeToolRef.current !== 'hand',
      onMoveShouldSetPanResponder: () =>
        activeToolRef.current !== 'hand' &&
        activeToolRef.current !== 'text' &&
        activeToolRef.current !== 'stamp' &&
        activeToolRef.current !== 'comment',
      onPanResponderGrant: (evt: GestureResponderEvent) => {
        const nativeEvt: any = evt.nativeEvent;
        if ((nativeEvt.touches?.length || 0) >= 2) {
          currentStrokeRef.current = null;
          setCurrentStroke(null);
          return;
        }
        if (
          isPalmRejectionRef.current &&
          (nativeEvt.pointerType === 'touch' ||
            (typeof nativeEvt.radiusX === 'number' && nativeEvt.radiusX > 22) ||
            (typeof nativeEvt.majorRadius === 'number' && nativeEvt.majorRadius > 22))
        ) {
          return;
        }
        const { locationX, locationY } = evt.nativeEvent;
        if (activeToolRef.current === 'text') {
          const newBox: FreeTextBox = {
            id: 'tb_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
            x: Math.max(20, Math.min((pageLayout.width || 600) - 180, locationX)),
            y: Math.max(20, Math.min((pageLayout.height || 800) - 80, locationY)),
            text: '',
            fontSize: defaultTextFontSize || 18,
            color: strokeColorRef.current,
            backgroundColor: 'transparent',
            pageIndex: currentPageRef.current,
          };
          setTextBoxes((prev) => [...prev, newBox]);
          setSelectedTextBoxId(newBox.id);
          setActiveTool('hand');
          return;
        }
        setSelectedTextBoxId(null);

        if (activeToolRef.current === 'stamp') {
          placeStampAt(locationX, locationY, currentPageRef.current);
          return;
        }

        if (activeToolRef.current === 'comment') {
          placeCommentPinAt(locationX, locationY, currentPageRef.current);
          return;
        }

        if (activeToolRef.current === 'redact') {
          setRedactDraftRect({
            startX: locationX,
            startY: locationY,
            currentX: locationX,
            currentY: locationY,
          });
          return;
        }

        if (activeToolRef.current === 'laser') {
          if (laserFadeTimerRef.current) clearTimeout(laserFadeTimerRef.current);
          setLaserPoint({ x: locationX, y: locationY });
          setLaserTrail([{ x: locationX, y: locationY }]);
          return;
        }

        if (activeToolRef.current === 'snippet') {
          setCapturedBlockRect(null);
          setCapturedBlockResult(null);
          setIsAppendNotePickerOpen(false);
          setSnippetDraftRect({
            startX: locationX,
            startY: locationY,
            currentX: locationX,
            currentY: locationY,
          });
          return;
        }

        if (activeToolRef.current === 'lasso') {
          const sBBox = selectionBBoxRef.current;
          if (
            sBBox &&
            locationX >= sBBox.minX &&
            locationX <= sBBox.maxX &&
            locationY >= sBBox.minY &&
            locationY <= sBBox.maxY
          ) {
            setIsDraggingSelection(true);
            lassoDragStartRef.current = { x: locationX, y: locationY };
            return;
          }
          setSelectedStrokeIds([]);
          setSelectionBBox(null);
          setIsDraggingSelection(false);
          setSelectionRect({
            startX: locationX,
            startY: locationY,
            currentX: locationX,
            currentY: locationY,
          });
          return;
        }

        if (activeToolRef.current === 'eraser') {
          isErasingRef.current = true;
          dragStartStrokesRef.current = strokesRef.current;
          hasErasedInThisDragRef.current = false;
          handleEraseAt(locationX, locationY);
          return;
        }

        if (activeToolRef.current === 'shape') {
          const shapeStroke: StrokeWithPage = {
            id: 'strk_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
            points: [{ x: locationX, y: locationY }],
            color: strokeColorRef.current,
            width: strokeWidthRef.current,
            tool: 'shape',
            shapeType: shapeTypeRef.current,
            shapeStart: { x: locationX, y: locationY },
            shapeEnd: { x: locationX, y: locationY },
            pageIndex: currentPageRef.current,
          };
          currentStrokeRef.current = shapeStroke;
          setCurrentStroke(shapeStroke);
          return;
        }

        const newStroke: StrokeWithPage = {
          id: 'strk_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
          points: [{ x: locationX, y: locationY }],
          color: strokeColorRef.current,
          width: strokeWidthRef.current,
          tool:
            activeToolRef.current === 'highlighter'
              ? 'highlighter'
              : activeToolRef.current === 'fountain'
              ? 'fountain'
              : 'pen',
          pageIndex: currentPageRef.current,
        };
        currentStrokeRef.current = newStroke;
        setCurrentStroke(newStroke);
      },
      onPanResponderMove: (evt: GestureResponderEvent) => {
        const nativeEvt: any = evt.nativeEvent;
        if ((nativeEvt.touches?.length || 0) >= 2) {
          if (currentStrokeRef.current) {
            currentStrokeRef.current = null;
            setCurrentStroke(null);
          }
          return;
        }
        const { locationX, locationY } = evt.nativeEvent;
        if (activeToolRef.current === 'laser') {
          setLaserPoint({ x: locationX, y: locationY });
          setLaserTrail((prev) => {
            const next = [...prev, { x: locationX, y: locationY }];
            return next.length > 25 ? next.slice(next.length - 25) : next;
          });
          return;
        }

        if (activeToolRef.current === 'redact') {
          if (redactDraftRectRef.current) {
            setRedactDraftRect((prev) =>
              prev ? { ...prev, currentX: locationX, currentY: locationY } : null
            );
          }
          return;
        }

        if (activeToolRef.current === 'snippet') {
          if (snippetDraftRectRef.current) {
            setSnippetDraftRect((prev) =>
              prev ? { ...prev, currentX: locationX, currentY: locationY } : null
            );
          }
          return;
        }

        if (activeToolRef.current === 'lasso') {
          if (isDraggingSelection && lassoDragStartRef.current && selectionBBoxRef.current) {
            const dx = locationX - lassoDragStartRef.current.x;
            const dy = locationY - lassoDragStartRef.current.y;
            lassoDragStartRef.current = { x: locationX, y: locationY };
            const selIds = selectedStrokeIdsRef.current;
            setStrokes((prev) =>
              prev.map((s) => {
                if (!selIds.includes(s.id)) return s;
                return {
                  ...s,
                  points: s.points.map((p) => ({ x: p.x + dx, y: p.y + dy })),
                  shapeStart: s.shapeStart ? { x: s.shapeStart.x + dx, y: s.shapeStart.y + dy } : undefined,
                  shapeEnd: s.shapeEnd ? { x: s.shapeEnd.x + dx, y: s.shapeEnd.y + dy } : undefined,
                };
              })
            );
            setSelectionBBox((b) =>
              b ? { minX: b.minX + dx, minY: b.minY + dy, maxX: b.maxX + dx, maxY: b.maxY + dy } : null
            );
            return;
          }
          if (selectionRectRef.current) {
            setSelectionRect((prev) =>
              prev ? { ...prev, currentX: locationX, currentY: locationY } : null
            );
          }
          return;
        }

        if (activeToolRef.current === 'eraser') {
          handleEraseAt(locationX, locationY);
          return;
        }

        if (!currentStrokeRef.current) return;

        const prevPoints = currentStrokeRef.current.points;
        const lastPt = prevPoints[prevPoints.length - 1];
        if (lastPt) {
          triggerWritingScratch(
            locationX - lastPt.x,
            locationY - lastPt.y,
            writingSoundEnabledRef.current,
            currentStrokeRef.current.tool
          );
        }

        if (currentStrokeRef.current.tool === 'shape') {
          currentStrokeRef.current = {
            ...currentStrokeRef.current,
            shapeEnd: { x: locationX, y: locationY },
          };
          setCurrentStroke(currentStrokeRef.current);
          return;
        }

        currentStrokeRef.current = {
          ...currentStrokeRef.current,
          points: [...currentStrokeRef.current.points, { x: locationX, y: locationY }],
        };
        setCurrentStroke(currentStrokeRef.current);
      },
      onPanResponderRelease: () => {
        stopWritingScratch();
        if (activeToolRef.current === 'laser') {
          setLaserPoint(null);
          if (laserFadeTimerRef.current) clearTimeout(laserFadeTimerRef.current);
          laserFadeTimerRef.current = setTimeout(() => {
            setLaserTrail([]);
          }, 500);
          return;
        }

        if (activeToolRef.current === 'redact') {
          const draft = redactDraftRectRef.current;
          setRedactDraftRect(null);
          if (draft) {
            finalizeRedactionRect(draft.startX, draft.startY, draft.currentX, draft.currentY);
          }
          return;
        }

        if (activeToolRef.current === 'snippet') {
          const draft = snippetDraftRectRef.current;
          setSnippetDraftRect(null);
          if (draft) {
            finalizeSnippetCapture(draft.startX, draft.startY, draft.currentX, draft.currentY);
          }
          return;
        }

        if (activeToolRef.current === 'eraser') {
          isErasingRef.current = false;
          if (hasErasedInThisDragRef.current) {
            undoStackRef.current = [...undoStackRef.current, dragStartStrokesRef.current];
            redoStackRef.current = [];
            setUndoStack(undoStackRef.current);
            setRedoStack([]);
            hasErasedInThisDragRef.current = false;
            if (autoDeselectEraserRef.current) {
              setActiveTool('fountain');
            }
          }
          return;
        }

        if (activeToolRef.current === 'lasso') {
          if (isDraggingSelection) {
            setIsDraggingSelection(false);
            lassoDragStartRef.current = null;
            return;
          }
          const rect = selectionRectRef.current;
          if (rect) {
            const minX = Math.min(rect.startX, rect.currentX);
            const maxX = Math.max(rect.startX, rect.currentX);
            const minY = Math.min(rect.startY, rect.currentY);
            const maxY = Math.max(rect.startY, rect.currentY);
            const width = maxX - minX;
            const height = maxY - minY;

            if (width > 4 || height > 4) {
              const matched = strokesRef.current.filter((s) => {
                if (s.pageIndex !== currentPageRef.current) return false;
                const b = computeStrokeBBox(s);
                const overlaps = !(
                  b.maxX < minX ||
                  b.minX > maxX ||
                  b.maxY < minY ||
                  b.minY > maxY
                );
                return overlaps;
              });

              if (matched.length > 0) {
                const ids = matched.map((s) => s.id);
                setSelectedStrokeIds(ids);
                let sMinX = Infinity, sMinY = Infinity, sMaxX = -Infinity, sMaxY = -Infinity;
                for (const s of matched) {
                  const b = computeStrokeBBox(s);
                  if (b.minX < sMinX) sMinX = b.minX;
                  if (b.minY < sMinY) sMinY = b.minY;
                  if (b.maxX > sMaxX) sMaxX = b.maxX;
                  if (b.maxY > sMaxY) sMaxY = b.maxY;
                }
                setSelectionBBox({
                  minX: Math.max(0, sMinX - 8),
                  minY: Math.max(0, sMinY - 8),
                  maxX: sMaxX + 8,
                  maxY: sMaxY + 8,
                });
                setExportToastMessage(`선택 완료: ${ids.length}개 객체가 선택되었습니다.`);
                setTimeout(() => setExportToastMessage(null), 2000);
              } else {
                setSelectedStrokeIds([]);
                setSelectionBBox(null);
              }
            }
          }
          setSelectionRect(null);
          return;
        }

        const finished = currentStrokeRef.current;
        currentStrokeRef.current = null;
        setCurrentStroke(null);

        if (finished && finished.tool === 'shape' && finished.shapeStart && finished.shapeEnd) {
          const dist = Math.hypot(
            finished.shapeEnd.x - finished.shapeStart.x,
            finished.shapeEnd.y - finished.shapeStart.y
          );
          if (dist > 6) {
            undoStackRef.current = [...undoStackRef.current, strokesRef.current];
            redoStackRef.current = [];
            setUndoStack(undoStackRef.current);
            setRedoStack([]);
            const nextStrokes = [...strokesRef.current, finished];
            strokesRef.current = nextStrokes;
            setStrokes(nextStrokes);
          }
          return;
        }

        if (finished && finished.points.length > 0) {
          let processedStroke = finished;
          if (
            autoSnapShapeRef.current &&
            (finished.tool === 'fountain' || finished.tool === 'pen' || finished.tool === 'highlighter')
          ) {
            const recognized = recognizeShape(finished.points);
            if (recognized) {
              processedStroke = {
                ...finished,
                points: recognized.points,
                shapeType: mapShapeType(recognized.type),
                isPolygon: recognized.isPolygon ?? (recognized.type === 'rectangle' || recognized.type === 'triangle'),
              };
              setExportToastMessage(`📐 '${recognized.label}'으로 자동 보정되었습니다`);
              setTimeout(() => setExportToastMessage(null), 2000);
            }
          }
          undoStackRef.current = [...undoStackRef.current, strokesRef.current];
          redoStackRef.current = [];
          setUndoStack(undoStackRef.current);
          setRedoStack([]);
          const nextStrokes = [...strokesRef.current, processedStroke];
          strokesRef.current = nextStrokes;
          setStrokes(nextStrokes);
        }
      },
    })
  ).current;

  // 손바닥 도구(Hand Tool) 공통 Grab-to-Scroll 핸들러 (꾹 누르고 위아래/좌우 밀기 + 자연스러운 관성 스크롤)
  const findScrollableAncestor = (startEl: HTMLElement | null): HTMLElement | null => {
    const scrollRefNode: HTMLElement | null =
      (canvasScrollRef.current as any)?.getScrollableNode?.() || null;
    if (scrollRefNode && scrollRefNode.scrollHeight > scrollRefNode.clientHeight + 2) {
      return scrollRefNode;
    }
    let cur: HTMLElement | null = startEl;
    while (cur && cur !== document.body) {
      try {
        const cs = window.getComputedStyle(cur);
        const canScrollY =
          (cs.overflowY === 'auto' || cs.overflowY === 'scroll') &&
          cur.scrollHeight > cur.clientHeight + 2;
        const canScrollX =
          (cs.overflowX === 'auto' || cs.overflowX === 'scroll') &&
          cur.scrollWidth > cur.clientWidth + 2;
        if (canScrollY || canScrollX) return cur;
      } catch {
        // ignore
      }
      cur = cur.parentElement;
    }
    return scrollRefNode;
  };

  const startHandDragScroll = (e: any) => {
    if (Platform.OS !== 'web' || (activeToolRef.current !== 'hand' && !isSpacePanRef.current)) return;
    if (e._handScrollHandled) return;
    const targetTag = (e.target as HTMLElement)?.tagName?.toLowerCase?.() || '';
    if (targetTag === 'input' || targetTag === 'textarea' || targetTag === 'button') return;

    e._handScrollHandled = true;
    e.preventDefault?.();

    if (handInertiaRafRef.current !== null && typeof cancelAnimationFrame !== 'undefined') {
      cancelAnimationFrame(handInertiaRafRef.current);
      handInertiaRafRef.current = null;
    }

    setSelectedTextBoxId(null);
    setIsHandPanning(true);

    const startClientY = e.clientY;
    const startClientX = e.clientX;
    const scrollNode = findScrollableAncestor((e.currentTarget || e.target) as HTMLElement | null);

    const startScrollY = scrollNode ? scrollNode.scrollTop : scrollOffsetRef.current.y;
    const startScrollX = scrollNode ? scrollNode.scrollLeft : scrollOffsetRef.current.x;

    let lastClientY = e.clientY;
    let lastClientX = e.clientX;
    let velocityY = 0;
    let velocityX = 0;

    const onHandMove = (ev: MouseEvent) => {
      ev.preventDefault();
      const dy = ev.clientY - startClientY;
      const dx = ev.clientX - startClientX;
      velocityY = ev.clientY - lastClientY;
      velocityX = ev.clientX - lastClientX;
      lastClientY = ev.clientY;
      lastClientX = ev.clientX;

      const maxScrollY = scrollNode ? Math.max(0, scrollNode.scrollHeight - scrollNode.clientHeight) : 5000;
      const maxScrollX = scrollNode ? Math.max(0, scrollNode.scrollWidth - scrollNode.clientWidth) : 2000;
      const nextY = Math.max(0, Math.min(maxScrollY, startScrollY - dy));
      const nextX = Math.max(0, Math.min(maxScrollX, startScrollX - dx));
      scrollOffsetRef.current = { x: nextX, y: nextY };
      if (scrollNode) {
        scrollNode.scrollTop = nextY;
        scrollNode.scrollLeft = nextX;
      } else {
        canvasScrollRef.current?.scrollTo({ y: nextY, animated: false });
      }
    };

    const onHandUp = () => {
      setIsHandPanning(false);
      window.removeEventListener('mousemove', onHandMove);
      window.removeEventListener('mouseup', onHandUp);

      // 손으로 밀었을 때 자연스럽게 감속하며 미끄러지는 관성 스크롤 (Momentum Inertia)
      if ((Math.abs(velocityY) > 1.5 || Math.abs(velocityX) > 1.5) && typeof requestAnimationFrame !== 'undefined') {
        let vy = -velocityY * 0.95;
        let vx = -velocityX * 0.95;
        const stepInertia = () => {
          if (Math.abs(vy) < 0.45 && Math.abs(vx) < 0.45) {
            handInertiaRafRef.current = null;
            return;
          }
          const curY = scrollNode ? scrollNode.scrollTop : scrollOffsetRef.current.y;
          const curX = scrollNode ? scrollNode.scrollLeft : scrollOffsetRef.current.x;
          const maxScrollY = scrollNode ? Math.max(0, scrollNode.scrollHeight - scrollNode.clientHeight) : 5000;
          const maxScrollX = scrollNode ? Math.max(0, scrollNode.scrollWidth - scrollNode.clientWidth) : 2000;
          const nextY = Math.max(0, Math.min(maxScrollY, curY + vy));
          const nextX = Math.max(0, Math.min(maxScrollX, curX + vx));
          scrollOffsetRef.current = { x: nextX, y: nextY };
          if (scrollNode) {
            scrollNode.scrollTop = nextY;
            scrollNode.scrollLeft = nextX;
          } else {
            canvasScrollRef.current?.scrollTo({ y: nextY, animated: false });
          }
          vy *= 0.92;
          vx *= 0.92;
          handInertiaRafRef.current = requestAnimationFrame(stepInertia);
        };
        handInertiaRafRef.current = requestAnimationFrame(stepInertia);
      }
    };

    window.addEventListener('mousemove', onHandMove);
    window.addEventListener('mouseup', onHandUp);
  };

  // 데스크톱 웹 마우스 드래그 핸들러 (손바닥 Grab-to-Scroll + Space 임시 패닝 + 스탬프/먹칠/댓글 + 블록 발췌 + 60fps 무끊김 필기)
  const handleWebMouseDown = (e: any) => {
    if (Platform.OS !== 'web') return;

    // 손바닥 도구(Hand Tool) 또는 Spacebar 꾹 누른 상태: 꾹 누르고 위아래/좌우 밀면 자연스럽게 스크롤 + 관성 모멘텀
    if (activeToolRef.current === 'hand' || isSpacePanRef.current) {
      startHandDragScroll(e);
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const z = zoomLevelRef.current || 1.0;
    const x = (e.clientX - rect.left) / z;
    const y = (e.clientY - rect.top) / z;

    if (activeToolRef.current === 'text') {
      const newBox: FreeTextBox = {
        id: 'tb_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        x: Math.max(20, Math.min(pageLayout.width - 180, x)),
        y: Math.max(20, Math.min(pageLayout.height - 80, y)),
        text: '',
        fontSize: defaultTextFontSize || 18,
        color: strokeColorRef.current,
        backgroundColor: 'transparent',
        pageIndex: currentPageRef.current,
      };
      setTextBoxes((prev) => [...prev, newBox]);
      setSelectedTextBoxId(newBox.id);
      setActiveTool('hand');
      return;
    }
    setSelectedTextBoxId(null);

    if (activeToolRef.current === 'stamp') {
      e.preventDefault?.();
      placeStampAt(x, y, currentPageRef.current);
      return;
    }

    if (activeToolRef.current === 'comment') {
      e.preventDefault?.();
      placeCommentPinAt(x, y, currentPageRef.current);
      return;
    }

    if (activeToolRef.current === 'redact') {
      e.preventDefault?.();
      const draft = {
        startX: x,
        startY: y,
        currentX: x,
        currentY: y,
      };
      redactDraftRectRef.current = draft;
      setRedactDraftRect(draft);
      return;
    }

    if (activeToolRef.current === 'laser') {
      if (laserFadeTimerRef.current) clearTimeout(laserFadeTimerRef.current);
      setLaserPoint({ x, y });
      setLaserTrail([{ x, y }]);
      return;
    }

    // Flexcil / LiquidText 스타일 PDF 영역 블록 지정 캡처 & 발췌 도구
    if (activeToolRef.current === 'snippet') {
      e.preventDefault?.();
      setCapturedBlockRect(null);
      setCapturedBlockResult(null);
      setIsAppendNotePickerOpen(false);
      const draft = {
        startX: x,
        startY: y,
        currentX: x,
        currentY: y,
      };
      snippetDraftRectRef.current = draft;
      setSnippetDraftRect(draft);
      return;
    }

    if (activeToolRef.current === 'lasso') {
      const sBBox = selectionBBoxRef.current;
      if (
        sBBox &&
        x >= sBBox.minX &&
        x <= sBBox.maxX &&
        y >= sBBox.minY &&
        y <= sBBox.maxY
      ) {
        setIsDraggingSelection(true);
        lassoDragStartRef.current = { x, y };
        return;
      }
      setSelectedStrokeIds([]);
      setSelectionBBox(null);
      setIsDraggingSelection(false);
      const selDraft = {
        startX: x,
        startY: y,
        currentX: x,
        currentY: y,
      };
      selectionRectRef.current = selDraft;
      setSelectionRect(selDraft);
      return;
    }

    if (activeToolRef.current === 'eraser') {
      isErasingRef.current = true;
      dragStartStrokesRef.current = strokesRef.current;
      hasErasedInThisDragRef.current = false;
      handleEraseAt(x, y);
      return;
    }

    lastDrawPointRef.current = { x, y };

    if (activeToolRef.current === 'shape') {
      const shapeStroke: StrokeWithPage = {
        id: 'strk_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        points: [{ x, y }],
        color: strokeColorRef.current,
        width: strokeWidthRef.current,
        tool: 'shape',
        shapeType: shapeTypeRef.current,
        shapeStart: { x, y },
        shapeEnd: { x, y },
        pageIndex: currentPageRef.current,
      };
      currentStrokeRef.current = shapeStroke;
      setCurrentStroke(shapeStroke);
      return;
    }

    const newStroke: StrokeWithPage = {
      id: 'strk_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      points: [{ x, y }],
      color: strokeColorRef.current,
      width: strokeWidthRef.current,
      tool:
        activeToolRef.current === 'highlighter'
          ? 'highlighter'
          : activeToolRef.current === 'fountain'
          ? 'fountain'
          : 'pen',
      pageIndex: currentPageRef.current,
    };
    currentStrokeRef.current = newStroke;
    setCurrentStroke(newStroke);
  };

  const handleWebMouseMove = (e: any) => {
    if (Platform.OS !== 'web') return;
    if (
      activeToolRef.current === 'hand' ||
      activeToolRef.current === 'text' ||
      activeToolRef.current === 'stamp' ||
      activeToolRef.current === 'comment'
    )
      return;

    const rect = e.currentTarget.getBoundingClientRect();
    const z = zoomLevelRef.current || 1.0;
    const x = (e.clientX - rect.left) / z;
    const y = (e.clientY - rect.top) / z;

    if (activeToolRef.current === 'laser') {
      setLaserPoint({ x, y });
      setLaserTrail((prev) => {
        const next = [...prev, { x, y }];
        return next.length > 25 ? next.slice(next.length - 25) : next;
      });
      return;
    }

    if (activeToolRef.current === 'redact') {
      if (redactDraftRectRef.current) {
        const next = { ...redactDraftRectRef.current, currentX: x, currentY: y };
        redactDraftRectRef.current = next;
        setRedactDraftRect(next);
      }
      return;
    }

    if (activeToolRef.current === 'snippet') {
      if (snippetDraftRectRef.current) {
        const next = { ...snippetDraftRectRef.current, currentX: x, currentY: y };
        snippetDraftRectRef.current = next;
        setSnippetDraftRect(next);
      }
      return;
    }

    if (activeToolRef.current === 'lasso') {
      if (isDraggingSelection && lassoDragStartRef.current && selectionBBoxRef.current) {
        const dx = x - lassoDragStartRef.current.x;
        const dy = y - lassoDragStartRef.current.y;
        lassoDragStartRef.current = { x, y };
        const selIds = selectedStrokeIdsRef.current;
        setStrokes((prev) =>
          prev.map((s) => {
            if (!selIds.includes(s.id)) return s;
            return {
              ...s,
              points: s.points.map((p) => ({ x: p.x + dx, y: p.y + dy })),
              shapeStart: s.shapeStart ? { x: s.shapeStart.x + dx, y: s.shapeStart.y + dy } : undefined,
              shapeEnd: s.shapeEnd ? { x: s.shapeEnd.x + dx, y: s.shapeEnd.y + dy } : undefined,
            };
          })
        );
        setSelectionBBox((b) =>
          b ? { minX: b.minX + dx, minY: b.minY + dy, maxX: b.maxX + dx, maxY: b.maxY + dy } : null
        );
        return;
      }
      if (selectionRectRef.current) {
        const next = { ...selectionRectRef.current, currentX: x, currentY: y };
        selectionRectRef.current = next;
        setSelectionRect(next);
      }
      return;
    }

    if (activeToolRef.current === 'eraser') {
      if (isErasingRef.current) {
        handleEraseAt(x, y);
      }
      return;
    }

    if (!currentStrokeRef.current) return;

    const lastPt = lastDrawPointRef.current;
    const dx = lastPt ? x - lastPt.x : 2;
    const dy = lastPt ? y - lastPt.y : 2;
    if (lastPt && Math.hypot(dx, dy) < 1.1) return;

    lastDrawPointRef.current = { x, y };
    triggerWritingScratch(dx, dy, writingSoundEnabledRef.current, currentStrokeRef.current.tool);

    if (currentStrokeRef.current.tool === 'shape') {
      currentStrokeRef.current = {
        ...currentStrokeRef.current,
        shapeEnd: { x, y },
      };
      if (rafStrokeIdRef.current === null && typeof requestAnimationFrame !== 'undefined') {
        rafStrokeIdRef.current = requestAnimationFrame(() => {
          rafStrokeIdRef.current = null;
          if (currentStrokeRef.current) {
            setCurrentStroke({ ...currentStrokeRef.current });
          }
        });
      } else if (typeof requestAnimationFrame === 'undefined') {
        setCurrentStroke(currentStrokeRef.current);
      }
      return;
    }

    currentStrokeRef.current.points.push({ x, y });
    if (rafStrokeIdRef.current === null && typeof requestAnimationFrame !== 'undefined') {
      rafStrokeIdRef.current = requestAnimationFrame(() => {
        rafStrokeIdRef.current = null;
        if (currentStrokeRef.current) {
          setCurrentStroke({
            ...currentStrokeRef.current,
            points: [...currentStrokeRef.current.points],
          });
        }
      });
    } else if (typeof requestAnimationFrame === 'undefined') {
      setCurrentStroke({ ...currentStrokeRef.current });
    }
  };

  const handleWebMouseUp = () => {
    if (Platform.OS !== 'web') return;
    stopWritingScratch();
    if (rafStrokeIdRef.current !== null && typeof cancelAnimationFrame !== 'undefined') {
      cancelAnimationFrame(rafStrokeIdRef.current);
      rafStrokeIdRef.current = null;
    }
    if (
      activeToolRef.current === 'hand' ||
      activeToolRef.current === 'text' ||
      activeToolRef.current === 'stamp' ||
      activeToolRef.current === 'comment'
    )
      return;

    if (activeToolRef.current === 'laser') {
      setLaserPoint(null);
      if (laserFadeTimerRef.current) clearTimeout(laserFadeTimerRef.current);
      laserFadeTimerRef.current = setTimeout(() => {
        setLaserTrail([]);
      }, 500);
      return;
    }

    if (activeToolRef.current === 'redact') {
      const draft = redactDraftRectRef.current;
      redactDraftRectRef.current = null;
      setRedactDraftRect(null);
      if (draft) {
        finalizeRedactionRect(draft.startX, draft.startY, draft.currentX, draft.currentY);
      }
      return;
    }

    if (activeToolRef.current === 'snippet') {
      const draft = snippetDraftRectRef.current;
      snippetDraftRectRef.current = null;
      setSnippetDraftRect(null);
      if (draft) {
        finalizeSnippetCapture(draft.startX, draft.startY, draft.currentX, draft.currentY);
      }
      return;
    }

    if (activeToolRef.current === 'eraser') {
      isErasingRef.current = false;
      if (hasErasedInThisDragRef.current) {
        undoStackRef.current = [...undoStackRef.current, dragStartStrokesRef.current];
        redoStackRef.current = [];
        setUndoStack(undoStackRef.current);
        setRedoStack([]);
        hasErasedInThisDragRef.current = false;
        if (autoDeselectEraserRef.current) {
          setActiveTool('fountain');
        }
      }
      return;
    }

    if (activeToolRef.current === 'lasso') {
      if (isDraggingSelection) {
        setIsDraggingSelection(false);
        lassoDragStartRef.current = null;
        return;
      }
      const rect = selectionRectRef.current;
      if (rect) {
        const minX = Math.min(rect.startX, rect.currentX);
        const maxX = Math.max(rect.startX, rect.currentX);
        const minY = Math.min(rect.startY, rect.currentY);
        const maxY = Math.max(rect.startY, rect.currentY);
        const width = maxX - minX;
        const height = maxY - minY;

        if (width > 4 || height > 4) {
          const matched = strokesRef.current.filter((s) => {
            if (s.pageIndex !== currentPageRef.current) return false;
            const b = computeStrokeBBox(s);
            const overlaps = !(
              b.maxX < minX ||
              b.minX > maxX ||
              b.maxY < minY ||
              b.minY > maxY
            );
            return overlaps;
          });

          if (matched.length > 0) {
            const ids = matched.map((s) => s.id);
            setSelectedStrokeIds(ids);
            let sMinX = Infinity, sMinY = Infinity, sMaxX = -Infinity, sMaxY = -Infinity;
            for (const s of matched) {
              const b = computeStrokeBBox(s);
              if (b.minX < sMinX) sMinX = b.minX;
              if (b.minY < sMinY) sMinY = b.minY;
              if (b.maxX > sMaxX) sMaxX = b.maxX;
              if (b.maxY > sMaxY) sMaxY = b.maxY;
            }
            setSelectionBBox({
              minX: Math.max(0, sMinX - 8),
              minY: Math.max(0, sMinY - 8),
              maxX: sMaxX + 8,
              maxY: sMaxY + 8,
            });
            setExportToastMessage(`선택 완료: ${ids.length}개 객체가 선택되었습니다.`);
            setTimeout(() => setExportToastMessage(null), 2000);
          } else {
            setSelectedStrokeIds([]);
            setSelectionBBox(null);
          }
        }
      }
      setSelectionRect(null);
      return;
    }

    const finished = currentStrokeRef.current;
    currentStrokeRef.current = null;
    setCurrentStroke(null);

    if (finished && finished.tool === 'shape' && finished.shapeStart && finished.shapeEnd) {
      const dist = Math.hypot(
        finished.shapeEnd.x - finished.shapeStart.x,
        finished.shapeEnd.y - finished.shapeStart.y
      );
      if (dist > 6) {
        undoStackRef.current = [...undoStackRef.current, strokesRef.current];
        redoStackRef.current = [];
        setUndoStack(undoStackRef.current);
        setRedoStack([]);
        const nextStrokes = [...strokesRef.current, finished];
        strokesRef.current = nextStrokes;
        setStrokes(nextStrokes);
      }
      return;
    }

    if (finished && finished.points.length > 0) {
      let processedStroke = finished;
      if (
        autoSnapShapeRef.current &&
        (finished.tool === 'fountain' || finished.tool === 'pen' || finished.tool === 'highlighter')
      ) {
        // 단일 스트로크 고정밀 인식 (한 번에 그린 획만 변환)
        const recognized = recognizeShape(finished.points);
        if (recognized) {
          processedStroke = {
            ...finished,
            points: recognized.points,
            shapeType: mapShapeType(recognized.type),
            isPolygon: recognized.isPolygon ?? (recognized.type === 'rectangle' || recognized.type === 'triangle'),
          };
          setExportToastMessage(`📐 '${recognized.label}'으로 자동 보정되었습니다`);
          setTimeout(() => setExportToastMessage(null), 2000);
        }
      }
      undoStackRef.current = [...undoStackRef.current, strokesRef.current];
      redoStackRef.current = [];
      setUndoStack(undoStackRef.current);
      setRedoStack([]);
      const nextStrokes = [...strokesRef.current, processedStroke];
      strokesRef.current = nextStrokes;
      setStrokes(nextStrokes);
    }
  };

  // 현재 페이지의 스트로크 필터링
  const currentPageStrokes = strokes.filter((s) => s.pageIndex === currentPage);

  // 내 파일에서 PDF 업로드 (실제 PDF 파일 파싱 및 페이지 로드)
  const handlePickDocument = async () => {
    if (Platform.OS === 'web') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'application/pdf,.pdf';
      input.onchange = async (e: any) => {
        const file: File | undefined = e.target?.files?.[0];
        if (file) {
          setExportToastMessage(`⏳ '${file.name}' 원본 PDF 렌더링 중...`);
          const parsed = await parseUploadedPdfFile(file);
          setTitle(parsed.fileName);
          setPdfPages(parsed.pages);
          if (parsed.meta) setPdfMeta(parsed.meta);
          setTotalPages(parsed.pages.length);
          setCurrentPage(1);
          setIsPdfLauncherOpen(false);
          setExportToastMessage(
            `📄 '${parsed.fileName}' (${parsed.pages.length}페이지 · ${
              parsed.usedRealRenderer ? '원본 PDF 렌더링' : '경량 파서'
            }) 문서를 불러왔습니다.`
          );
          setTimeout(() => setExportToastMessage(null), 2600);
        }
      };
      input.click();
    } else {
      const pickedFiles = await pickNativePdfFiles(false);
      const picked = pickedFiles[0];
      if (!picked) return;
      setExportToastMessage(`⏳ '${picked.name}' 원본 PDF 불러오는 중...`);
      const parsed = await parseUploadedPdfFile(picked);
      setTitle(parsed.fileName);
      setPdfPages(parsed.pages);
      if (parsed.meta) setPdfMeta(parsed.meta);
      setTotalPages(parsed.pages.length);
      setCurrentPage(1);
      setIsPdfLauncherOpen(false);
      setExportToastMessage(
        `📄 '${parsed.fileName}' (${parsed.pages.length}페이지) 문서를 불러왔습니다.`
      );
      setTimeout(() => setExportToastMessage(null), 2600);
    }
  };

  // 12색 감성 학업/문구 컬러 팔레트 (Notewise / Goodnotes 컬러 세트)
  const PALETTE_COLORS = [
    { color: '#1E293B', label: '클래식 차콜' },
    { color: '#2563EB', label: '코발트 블루' },
    { color: '#DC2626', label: '카민 레드' },
    { color: '#059669', label: '포레스트 그린' },
    { color: '#7C3AED', label: '로열 바이올렛' },
    { color: '#D97706', label: '앤틱 앰버' },
    { color: '#F59E0B', label: '형광 옐로우' },
    { color: '#10B981', label: '민트 그린' },
    { color: '#06B6D4', label: '스카이 사이언' },
    { color: '#EC4899', label: '코랄 핑크' },
    { color: '#8B5CF6', label: '소프트 라일락' },
    { color: '#64748B', label: '슬레이트 그레이' },
  ];

  const existingPdfNotes = React.useMemo(
    () =>
      notes.filter(
        (n) =>
          !n.isDeleted &&
          (n.noteType === 'pdf' ||
            Boolean(n.pdfName) ||
            Boolean(n.pdfPages && n.pdfPages.length > 0))
      ),
    [notes]
  );

  if (isPdfMode && isPdfLauncherOpen) {
    return (
      <SafeAreaView style={styles.workspaceContainer} edges={['top', 'left', 'right', 'bottom']}>
        <PdfOpenLauncherView
          existingPdfNotes={existingPdfNotes}
          onOpenUploadedPdf={(fileName, pages, initialTab, meta) => {
            setTitle(fileName);
            setPdfPages(pages);
            if (meta) setPdfMeta(meta);
            setTotalPages(pages.length);
            setCurrentPage(1);
            setPdfWorkspaceTab(initialTab);
            setIsPdfLauncherOpen(false);
            setExportToastMessage(`📄 '${fileName}' (${pages.length}페이지) 문서를 불러왔습니다.`);
            setTimeout(() => setExportToastMessage(null), 2500);
          }}
          onCreateBlankPdf={(docName, pageCount, tpl, initialTab) => {
            const cleanName = docName.replace(/\.pdf$/i, '');
            const blankPages: PdfPageData[] = Array.from({ length: pageCount }).map((_, idx) => ({
              id: `pdfp_new_${Date.now()}_${idx + 1}`,
              pageNumber: idx + 1,
              title: `${cleanName} — Page ${idx + 1}`,
              subtitle: `${docName} (${idx + 1}/${pageCount} 페이지)`,
              content: '',
              sourcePdfName: docName,
            }));
            setTitle(docName);
            setPdfPages(blankPages);
            setTotalPages(pageCount);
            setPaperTemplate(tpl);
            setCurrentPage(1);
            setPdfWorkspaceTab(initialTab);
            setIsPdfLauncherOpen(false);
            setExportToastMessage(`📄 새 PDF 문서 '${docName}' (${pageCount}페이지)가 생성되었습니다.`);
            setTimeout(() => setExportToastMessage(null), 2500);
          }}
          onSelectExistingNote={(pickedNote, initialTab) => {
            const extracted = extractPdfPagesFromNote(pickedNote);
            setActiveNoteId(pickedNote.id);
            setTitle(pickedNote.title || pickedNote.pdfName || 'PDF 문서.pdf');
            setPdfPages(extracted);
            setTotalPages(extracted.length);
            setCurrentPage(1);
            const existingStrokes = ((pickedNote.strokes as StrokeWithPage[]) || []).map((s) => ({
              ...s,
              pageIndex: s.pageIndex || 1,
            }));
            strokesRef.current = existingStrokes;
            setStrokes(existingStrokes);
            setTextBoxes(pickedNote.textBoxes || []);
            setAudioNotes(pickedNote.audioNotes || []);
            setPaperTemplate(pickedNote.paperTemplate || 'blank');
            if (pickedNote.pdfWatermark) setPdfWatermark(pickedNote.pdfWatermark);
            if (pickedNote.pdfHeaderFooter) setPdfHeaderFooter(pickedNote.pdfHeaderFooter);
            setPdfStamps(pickedNote.pdfStamps || []);
            setPdfRedactions(pickedNote.pdfRedactions || []);
            setPdfComments(pickedNote.pdfComments || []);
            setPdfMeta(pickedNote.pdfMeta || {});
            setBookmarkedPages(
              pickedNote.bookmarkedPages && pickedNote.bookmarkedPages.length > 0
                ? pickedNote.bookmarkedPages
                : [1]
            );
            setPageTemplates(pickedNote.pageTemplates || {});
            setPdfWorkspaceTab(initialTab);
            setIsPdfLauncherOpen(false);
          }}
          onCancel={() => {
            if (pdfPages.length > 0) {
              setIsPdfLauncherOpen(false);
            } else {
              onClose();
            }
          }}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.workspaceContainer} edges={['top', 'left', 'right', 'bottom']}>
      {/* 1. 상단 내비게이션 바 (Notewise view_canvas_navigation_bar.xml) */}
      <View style={[styles.topNavigationBar, isFullscreen && { display: 'none' }]}>
        <View style={styles.navLeft}>
          <TouchableOpacity style={styles.backBtn} onPress={handleSaveAndExit}>
            <ArrowLeft size={22} color="#1E293B" />
          </TouchableOpacity>

          <View style={styles.docInfo}>
            <TextInput
              style={styles.docTitleInput}
              value={title}
              onChangeText={setTitle}
              placeholder="문서 제목"
              placeholderTextColor="#94A3B8"
            />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={styles.docSubtitle}>
                {isPdfMode ? '📄 Goodnotes / Notewise PDF 모드' : '🎨 DrawNote 무한 캔버스 모드'}
              </Text>
              {Boolean(autosaveLabel) && (
                <TouchableOpacity
                  disabled={autosaveStatus !== 'error'}
                  onPress={flushAutosave}
                  style={{
                    paddingHorizontal: 7,
                    paddingVertical: 2,
                    borderRadius: 999,
                    backgroundColor:
                      autosaveStatus === 'error'
                        ? '#FEF2F2'
                        : autosaveStatus === 'saving'
                        ? '#EFF6FF'
                        : '#ECFDF5',
                  }}
                >
                  <Text
                    style={{
                      fontSize: 10.5,
                      fontWeight: '700',
                      color:
                        autosaveStatus === 'error'
                          ? '#DC2626'
                          : autosaveStatus === 'saving'
                          ? '#2563EB'
                          : '#059669',
                    }}
                  >
                    {autosaveLabel}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>

        {/* 중앙: 페이지 점퍼 & 전환 버튼 (< 1 / 3 > + 🔖 북마크) */}
        <View style={styles.pageJumperPill}>
          <TouchableOpacity
            style={[styles.pageBtn, currentPage === 1 && styles.pageBtnDisabled]}
            disabled={currentPage === 1}
            onPress={() => setCurrentPage((p) => Math.max(1, p - 1))}
            {...(Platform.OS === 'web' ? ({ onClick: () => setCurrentPage((p) => Math.max(1, p - 1)) } as any) : {})}
          >
            <ChevronLeft size={18} color={currentPage === 1 ? '#CBD5E1' : '#1E293B'} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.pageNumberTouchArea}
            onPress={() => setIsPageJumpModalOpen(true)}
            {...(Platform.OS === 'web' ? ({ onClick: () => setIsPageJumpModalOpen(true) } as any) : {})}
          >
            <Text style={styles.pageNumberText}>
              {currentPage} / {totalPages}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.pageBtn, currentPage === totalPages && styles.pageBtnDisabled]}
            disabled={currentPage === totalPages}
            onPress={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            {...(Platform.OS === 'web' ? ({ onClick: () => setCurrentPage((p) => Math.min(totalPages, p + 1)) } as any) : {})}
          >
            <ChevronRight size={18} color={currentPage === totalPages ? '#CBD5E1' : '#1E293B'} />
          </TouchableOpacity>

          {/* 🔖 즐겨찾기 북마크 토글 버튼 (Notewise / Flexcil 북마크) */}
          <TouchableOpacity
            style={[
              styles.pageBtn,
              bookmarkedPages.includes(currentPage) && styles.bookmarkBtnActive,
            ]}
            onPress={toggleBookmarkCurrentPage}
            {...(Platform.OS === 'web' ? ({ onClick: toggleBookmarkCurrentPage } as any) : {})}
          >
            <Bookmark
              size={15}
              color={bookmarkedPages.includes(currentPage) ? '#F59E0B' : '#64748B'}
              fill={bookmarkedPages.includes(currentPage) ? '#F59E0B' : 'none'}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.addPageBtn}
            onPress={() => setIsAddPageTemplateModalOpen(true)}
            {...(Platform.OS === 'web'
              ? ({
                  onClick: () => setIsAddPageTemplateModalOpen(true),
                } as any)
              : {})}
          >
            <Plus size={16} color="#2563EB" />
          </TouchableOpacity>

          {/* 1-Tap 현재 페이지 복제 버튼 */}
          <TouchableOpacity
            style={styles.pageQuickActionBtn}
            onPress={() => handleDuplicatePage(currentPage)}
            {...(Platform.OS === 'web' ? ({ onClick: () => handleDuplicatePage(currentPage) } as any) : {})}
          >
            <Copy size={13} color="#475569" />
          </TouchableOpacity>

          {/* 1-Tap 90도 회전 버튼 */}
          <TouchableOpacity
            style={styles.pageQuickActionBtn}
            onPress={handleRotateCurrentPage}
            {...(Platform.OS === 'web' ? ({ onClick: handleRotateCurrentPage } as any) : {})}
          >
            <RotateCw size={13} color="#475569" />
          </TouchableOpacity>
        </View>

        {/* 우측: 줌 배율, 야간 모드, 전체화면, Undo/Redo, 검색, 속지, 오디오 녹음, 썸네일 오버뷰, 공유/저장 */}
        <View style={styles.navRight}>
          {/* 배율 조절 및 전체화면 (Zoom Level & Fullscreen) */}
          <View style={styles.zoomControlGroup}>
            <TouchableOpacity
              style={styles.zoomBtn}
              onPress={() => setZoomLevel((z) => Math.max(0.75, Number((z - 0.25).toFixed(2))))}
              {...(Platform.OS === 'web'
                ? ({ onClick: () => setZoomLevel((z) => Math.max(0.75, Number((z - 0.25).toFixed(2)))) } as any)
                : {})}
            >
              <ZoomOut size={14} color="#475569" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.zoomLevelBadge}
              onPress={() => setZoomLevel(1.0)}
              {...(Platform.OS === 'web' ? ({ onClick: () => setZoomLevel(1.0) } as any) : {})}
            >
              <Text style={styles.zoomLevelText}>{Math.round(zoomLevel * 100)}%</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.zoomBtn}
              onPress={() => setZoomLevel((z) => Math.min(2.0, Number((z + 0.25).toFixed(2))))}
              {...(Platform.OS === 'web'
                ? ({ onClick: () => setZoomLevel((z) => Math.min(2.0, Number((z + 0.25).toFixed(2)))) } as any)
                : {})}
            >
              <ZoomIn size={14} color="#475569" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.zoomBtn, isFullscreen && styles.zoomBtnActive]}
              onPress={() => setIsFullscreen((f) => !f)}
              {...(Platform.OS === 'web' ? ({ onClick: () => setIsFullscreen((f) => !f) } as any) : {})}
            >
              {isFullscreen ? <Minimize2 size={14} color="#2563EB" /> : <Maximize2 size={14} color="#475569" />}
            </TouchableOpacity>
          </View>

          {/* 손바닥 무시 (Apple Pencil / S Pen 스타일러스 팜 리젝션) 토글 */}
          <TouchableOpacity
            style={[
              styles.nightModeBtn,
              isPalmRejectionEnabled && { backgroundColor: '#DBEAFE', borderColor: '#60A5FA' },
            ]}
            onPress={() => {
              setIsPalmRejectionEnabled((prev) => {
                const next = !prev;
                setExportToastMessage(
                  next
                    ? '✋ 손바닥 무시 켜짐 (Apple Pencil · S Pen 전용 필기)'
                    : '👆 손가락 + 펜 동시 입력 모드로 전환되었습니다'
                );
                setTimeout(() => setExportToastMessage(null), 2000);
                return next;
              });
            }}
          >
            <Hand size={13} color={isPalmRejectionEnabled ? '#1D4ED8' : '#475569'} />
            <Text
              style={[
                styles.nightModeText,
                isPalmRejectionEnabled && { color: '#1D4ED8', fontWeight: '800' },
              ]}
            >
              {isPalmRejectionEnabled ? '펜전용' : '손바닥'}
            </Text>
          </TouchableOpacity>

          {/* 야간 모드 / 다크 모드 토글 (Flexcil / Goodnotes 야간 읽기 벤치마크) */}
          <TouchableOpacity
            style={[styles.nightModeBtn, isNightMode && styles.nightModeBtnActive]}
            onPress={() => {
              setIsNightMode((prev) => {
                const next = !prev;
                setExportToastMessage(next ? '🌙 야간 모드가 켜졌습니다 (눈부심 방지)' : '☀️ 주간 모드로 전환되었습니다');
                setTimeout(() => setExportToastMessage(null), 1800);
                return next;
              });
            }}
          >
            {isNightMode ? (
              <Sun size={14} color="#F59E0B" />
            ) : (
              <Moon size={14} color="#475569" />
            )}
            <Text style={[styles.nightModeText, isNightMode && styles.nightModeTextActive]}>
              {isNightMode ? '주간' : '야간'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, undoStack.length === 0 && styles.actionBtnDisabled]}
            disabled={undoStack.length === 0}
            onPress={handleUndo}
          >
            <Undo2 size={19} color={undoStack.length === 0 ? '#CBD5E1' : '#475569'} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, redoStack.length === 0 && styles.actionBtnDisabled]}
            disabled={redoStack.length === 0}
            onPress={handleRedo}
          >
            <Redo2 size={19} color={redoStack.length === 0 ? '#CBD5E1' : '#475569'} />
          </TouchableOpacity>

          {/* 문서 내 단어 검색 버튼 */}
          <TouchableOpacity
            style={[styles.actionBtn, isSearchOpen && styles.actionBtnActiveBlue]}
            onPress={() => setIsSearchOpen((prev) => !prev)}
          >
            <Search size={19} color={isSearchOpen ? '#2563EB' : '#475569'} />
          </TouchableOpacity>

          {/* Flexcil 스타일 분할 사이드 노트 패널 토글 */}
          <TouchableOpacity
            style={[styles.sideNoteToggleBtn, isSideNoteOpen && styles.sideNoteToggleBtnActive]}
            onPress={() => {
              setPdfWorkspaceTab('annotate');
              setIsSideNoteOpen((prev) => !prev);
            }}
          >
            <PanelRight size={15} color={isSideNoteOpen ? '#B45309' : '#475569'} />
            <Text
              style={[
                styles.sideNoteToggleText,
                isSideNoteOpen && styles.sideNoteToggleTextActive,
              ]}
            >
              사이드 노트{sideNoteSnippets.length > 0 ? ` (${sideNoteSnippets.length})` : ''}
            </Text>
          </TouchableOpacity>

          {/* 속지 템플릿 변경 버튼 */}
          <TouchableOpacity
            style={[styles.actionBtn, isTemplateMenuOpen && styles.actionBtnActiveBlue]}
            onPress={() => setIsTemplateMenuOpen((prev) => !prev)}
          >
            <BookOpen size={19} color={isTemplateMenuOpen ? '#2563EB' : '#475569'} />
          </TouchableOpacity>

          {/* 오디오 녹음 버튼 (Notewise 실시간 팟캐스트 연동) */}
          <TouchableOpacity
            style={[styles.actionBtn, isRecording && styles.recordingActiveBtn]}
            onPress={() => setIsRecording((prev) => !prev)}
          >
            <Mic size={19} color={isRecording ? '#DC2626' : '#475569'} />
          </TouchableOpacity>

          {/* 오디오 플레이어 독 토글 버튼 (전체 페이지 오디오 탐색 및 -5s, +5s, 처음으로, 음소거) */}
          {audioNotes.length > 0 && (
            <TouchableOpacity
              style={[styles.actionBtn, isAudioDockOpen && styles.actionBtnActiveBlue]}
              onPress={() => setIsAudioDockOpen((prev) => !prev)}
            >
              <Volume2 size={19} color={isAudioDockOpen ? '#2563EB' : '#475569'} />
              <View pointerEvents="none" style={styles.audioCountBadge}>
                <Text style={styles.audioCountBadgeText}>{audioNotes.length}</Text>
              </View>
            </TouchableOpacity>
          )}

          {/* 썸네일 오버뷰 서랍 토글 (Notewise overview_button) */}
          <TouchableOpacity
            style={[styles.actionBtn, isOverviewOpen && styles.overviewActiveBtn]}
            onPress={() => setIsOverviewOpen((prev) => !prev)}
          >
            <Layers size={19} color={isOverviewOpen ? '#2563EB' : '#475569'} />
          </TouchableOpacity>

          {/* 외부 PDF 불러오기 */}
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={handlePickDocument}
          >
            <Upload size={19} color="#475569" />
          </TouchableOpacity>

          {/* 공유 및 내보내기 모달 (Goodnotes / Notewise PDF, 인쇄, 텍스트 추출) */}
          <TouchableOpacity
            style={[styles.actionBtn, isExportModalOpen && styles.actionBtnActiveBlue]}
            onPress={() => setIsExportModalOpen(true)}
          >
            <Share2 size={19} color={isExportModalOpen ? '#2563EB' : '#475569'} />
          </TouchableOpacity>

          {/* 저장 및 닫기 */}
          <TouchableOpacity
            style={styles.saveExitBtn}
            onPress={handleSaveAndExit}
          >
            <Check size={16} color="#FFFFFF" strokeWidth={3} />
            <Text style={styles.saveExitText}>저장</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Adobe Acrobat 스타일 PDF 4대 모드 전환 바 (편집/주석 | 페이지 구성 | 병합(Merge) | 분할(Split)) */}
      {isPdfMode && !isFullscreen && (
        <View style={styles.acrobatModeBar}>
          <View style={styles.acrobatTabGroup}>
            <TouchableOpacity
              style={[
                styles.acrobatTabBtn,
                pdfWorkspaceTab === 'annotate' && styles.acrobatTabBtnActiveBlue,
              ]}
              onPress={() => setPdfWorkspaceTab('annotate')}
            >
              <Edit3
                size={13}
                color={pdfWorkspaceTab === 'annotate' ? '#1D4ED8' : '#475569'}
              />
              <Text
                style={[
                  styles.acrobatTabText,
                  pdfWorkspaceTab === 'annotate' && styles.acrobatTabTextActiveBlue,
                ]}
              >
                편집 / 필기 주석
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.acrobatTabBtn,
                pdfWorkspaceTab === 'organize' && styles.acrobatTabBtnActiveGreen,
              ]}
              onPress={() => setPdfWorkspaceTab('organize')}
            >
              <LayoutGrid
                size={13}
                color={pdfWorkspaceTab === 'organize' ? '#047857' : '#475569'}
              />
              <Text
                style={[
                  styles.acrobatTabText,
                  pdfWorkspaceTab === 'organize' && styles.acrobatTabTextActiveGreen,
                ]}
              >
                페이지 구성 ({totalPages}장)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.acrobatTabBtn,
                pdfWorkspaceTab === 'merge' && styles.acrobatTabBtnActivePurple,
              ]}
              onPress={() => setPdfWorkspaceTab('merge')}
            >
              <Combine
                size={13}
                color={pdfWorkspaceTab === 'merge' ? '#6D28D9' : '#475569'}
              />
              <Text
                style={[
                  styles.acrobatTabText,
                  pdfWorkspaceTab === 'merge' && styles.acrobatTabTextActivePurple,
                ]}
              >
                PDF 병합 (Merge)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.acrobatTabBtn,
                pdfWorkspaceTab === 'split' && styles.acrobatTabBtnActiveRed,
              ]}
              onPress={() => setPdfWorkspaceTab('split')}
            >
              <Scissors
                size={13}
                color={pdfWorkspaceTab === 'split' ? '#B91C1C' : '#475569'}
              />
              <Text
                style={[
                  styles.acrobatTabText,
                  pdfWorkspaceTab === 'split' && styles.acrobatTabTextActiveRed,
                ]}
              >
                PDF 분할 / 추출 (Split)
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.acrobatRightGroup}>
            {/* 보기 레이아웃 전환 (단일 / 연속 스크롤 / 양면 2쪽) */}
            <View style={styles.viewLayoutSwitchPill}>
              {(
                [
                  { id: 'single', label: '단일', icon: FileText },
                  { id: 'continuous', label: '연속', icon: Rows3 },
                  { id: 'two-up', label: '양면 2쪽', icon: Columns2 },
                ] as const
              ).map((ly) => {
                const IconComp = ly.icon;
                const isSel = viewLayout === ly.id && pdfWorkspaceTab === 'annotate';
                return (
                  <TouchableOpacity
                    key={ly.id}
                    style={[styles.viewLayoutBtn, isSel && styles.viewLayoutBtnActive]}
                    onPress={() => {
                      setPdfWorkspaceTab('annotate');
                      setViewLayout(ly.id);
                    }}
                  >
                    <IconComp size={11} color={isSel ? '#1D4ED8' : '#64748B'} />
                    <Text style={[styles.viewLayoutBtnText, isSel && styles.viewLayoutBtnTextActive]}>
                      {ly.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* 워터마크 & 머리글/바닥글 */}
            <TouchableOpacity
              style={[
                styles.acrobatToolMiniBtn,
                (pdfWatermark.enabled || pdfHeaderFooter.enabled) && styles.acrobatToolMiniBtnActive,
              ]}
              onPress={() => setIsWatermarkModalOpen(true)}
            >
              <Droplets
                size={12}
                color={pdfWatermark.enabled || pdfHeaderFooter.enabled ? '#1D4ED8' : '#475569'}
              />
              <Text
                style={[
                  styles.acrobatToolMiniText,
                  (pdfWatermark.enabled || pdfHeaderFooter.enabled) && { color: '#1D4ED8' },
                ]}
              >
                워터마크·머리글
              </Text>
            </TouchableOpacity>

            {/* 두 PDF 비교 */}
            <TouchableOpacity
              style={styles.acrobatToolMiniBtn}
              onPress={() => setIsCompareModalOpen(true)}
            >
              <GitCompare size={12} color="#6D28D9" />
              <Text style={styles.acrobatToolMiniText}>PDF 비교</Text>
            </TouchableOpacity>

            {/* 문서 속성 & 단어/주석 통계 */}
            <TouchableOpacity
              style={styles.acrobatToolMiniBtn}
              onPress={() => setIsPropertiesModalOpen(true)}
            >
              <ChartBar size={12} color="#047857" />
              <Text style={styles.acrobatToolMiniText}>
                통계 ({documentWordStats.totalWords}단어)
              </Text>
            </TouchableOpacity>

            {/* 스레드 댓글 드로어 토글 */}
            <TouchableOpacity
              style={[
                styles.acrobatToolMiniBtn,
                isCommentsDrawerOpen && styles.acrobatToolMiniBtnActive,
              ]}
              onPress={() => {
                setPdfWorkspaceTab('annotate');
                setIsCommentsDrawerOpen((p) => !p);
              }}
            >
              <MessageSquare
                size={12}
                color={isCommentsDrawerOpen ? '#1D4ED8' : '#475569'}
              />
              <Text
                style={[
                  styles.acrobatToolMiniText,
                  isCommentsDrawerOpen && { color: '#1D4ED8' },
                ]}
              >
                댓글{pdfComments.length > 0 ? ` (${pdfComments.length})` : ''}
              </Text>
            </TouchableOpacity>

            {/* Ctrl+K 명령 팔레트 */}
            <TouchableOpacity
              style={styles.acrobatCmdPaletteBtn}
              onPress={() => setIsCommandPaletteOpen(true)}
            >
              <Command size={11} color="#FFFFFF" />
              <Text style={styles.acrobatCmdPaletteText}>⌘K 명령</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.acrobatSnippetQuickBtn,
                pdfWorkspaceTab === 'annotate' &&
                  activeTool === 'snippet' &&
                  styles.acrobatSnippetQuickBtnActive,
              ]}
              onPress={() => {
                setPdfWorkspaceTab('annotate');
                setActiveTool('snippet');
                setExportToastMessage(
                  '✂️ 블록 발췌 모드: PDF에서 복사하거나 노트로 가져올 영역을 드래그하세요!'
                );
                setTimeout(() => setExportToastMessage(null), 2600);
              }}
            >
              <Crop
                size={12}
                color={
                  pdfWorkspaceTab === 'annotate' && activeTool === 'snippet' ? '#FFFFFF' : '#B45309'
                }
              />
              <Text
                style={[
                  styles.acrobatSnippetQuickText,
                  pdfWorkspaceTab === 'annotate' &&
                    activeTool === 'snippet' &&
                    styles.acrobatSnippetQuickTextActive,
                ]}
              >
                블록 발췌
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.acrobatOpenHubBtn}
              onPress={() => setIsPdfLauncherOpen(true)}
            >
              <Upload size={12} color="#2563EB" />
              <Text style={styles.acrobatOpenHubText}>PDF 허브</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* 전체화면 복원 플로팅 버튼 */}
      {isFullscreen && (
        <TouchableOpacity
          style={styles.fullscreenFloatingExitBtn}
          onPress={() => setIsFullscreen(false)}
          {...(Platform.OS === 'web' ? ({ onClick: () => setIsFullscreen(false) } as any) : {})}
        >
          <Minimize2 size={14} color="#FFFFFF" />
          <Text style={styles.fullscreenFloatingExitText}>전체화면 종료</Text>
        </TouchableOpacity>
      )}

      {/* 실시간 문서 내 단어 검색 바 (In-Document Search & Navigator) */}
      {isSearchOpen && (
        <View style={styles.inDocSearchBar}>
          <Search size={16} color="#64748B" />
          <TextInput
            style={styles.inDocSearchInput}
            placeholder="문서 내 단어 검색..."
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={(text) => {
              setSearchQuery(text);
              setActiveSearchIndex(0);
            }}
            autoFocus
          />
          {searchQuery ? (
            <TouchableOpacity
              onPress={() => {
                setSearchQuery('');
                setActiveSearchIndex(0);
              }}
              style={{ padding: 4 }}
              {...(Platform.OS === 'web'
                ? ({
                    onClick: () => {
                      setSearchQuery('');
                      setActiveSearchIndex(0);
                    },
                  } as any)
                : {})}
            >
              <X size={15} color="#94A3B8" />
            </TouchableOpacity>
          ) : null}

          {/* 검색 결과 이전 / 다음 네비게이션 컨트롤 */}
          {searchMatches.length > 0 && (
            <View style={styles.searchNavigatorRow}>
              <Text style={styles.searchTotalCountText}>
                총 {totalSearchCount}건 ({activeSearchIndex + 1}/{searchMatches.length})
              </Text>
              <TouchableOpacity
                style={styles.searchNavArrowBtn}
                onPress={handlePrevSearchMatch}
                {...(Platform.OS === 'web' ? ({ onClick: handlePrevSearchMatch } as any) : {})}
              >
                <ChevronLeft size={15} color="#1E293B" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.searchNavArrowBtn}
                onPress={handleNextSearchMatch}
                {...(Platform.OS === 'web' ? ({ onClick: handleNextSearchMatch } as any) : {})}
              >
                <ChevronRight size={15} color="#1E293B" />
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.searchMatchBadgeList}>
            {searchMatches.length > 0 ? (
              searchMatches.map((m, idx) => (
                <TouchableOpacity
                  key={m.pageNumber}
                  style={[
                    styles.searchMatchPill,
                    (m.pageNumber === currentPage || idx === activeSearchIndex) && styles.searchMatchPillActive,
                  ]}
                  onPress={() => {
                    setActiveSearchIndex(idx);
                    setCurrentPage(m.pageNumber);
                  }}
                  {...(Platform.OS === 'web'
                    ? ({
                        onClick: () => {
                          setActiveSearchIndex(idx);
                          setCurrentPage(m.pageNumber);
                        },
                      } as any)
                    : {})}
                >
                  <Text
                    style={[
                      styles.searchMatchPillText,
                      (m.pageNumber === currentPage || idx === activeSearchIndex) && styles.searchMatchPillTextActive,
                    ]}
                  >
                    P.{m.pageNumber} ({m.count}건)
                  </Text>
                </TouchableOpacity>
              ))
            ) : searchQuery ? (
              <Text style={styles.searchNoMatchText}>검색 결과 없음</Text>
            ) : (
              <Text style={styles.searchPromptText}>키워드를 입력하면 페이지별 일치 항목이 표시됩니다</Text>
            )}
          </View>
        </View>
      )}

      {/* 속지 템플릿 변경 바 (Quick Template Switcher) */}
      {isTemplateMenuOpen && (
        <View style={styles.templateSelectionBar}>
          <Text style={styles.templateSelectionTitle}>속지 변경:</Text>
          {(
            [
              { key: 'blank', label: '무지' },
              { key: 'lined', label: '줄노트' },
              { key: 'grid', label: '모눈' },
              { key: 'dot', label: '도트' },
              { key: 'cornell', label: '코넬' },
              { key: 'dark', label: '다크 칠판' },
            ] as const
          ).map((t) => (
            <TouchableOpacity
              key={t.key}
              style={[
                styles.templateOptionBtn,
                paperTemplate === t.key && styles.templateOptionBtnActive,
              ]}
              onPress={() => {
                setPaperTemplate(t.key);
                setIsTemplateMenuOpen(false);
              }}
              {...(Platform.OS === 'web'
                ? ({
                    onClick: () => {
                      setPaperTemplate(t.key);
                      setIsTemplateMenuOpen(false);
                    },
                  } as any)
                : {})}
            >
              <Text
                style={[
                  styles.templateOptionText,
                  paperTemplate === t.key && styles.templateOptionTextActive,
                ]}
              >
                {t.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* 손바닥 탐색 모드 알림 배너 */}
      {activeTool === 'hand' && (!isPdfMode || pdfWorkspaceTab === 'annotate') && (
        <View style={styles.handModeNoticeBanner}>
          <Hand size={14} color="#059669" />
          <Text style={styles.handModeNoticeText}>
            손바닥 탐색 모드: 문서를 꾹 누른 채 위아래로 밀면 부드럽게 드래그 스크롤됩니다 (필기 방지 활성화)
          </Text>
        </View>
      )}

      {/* 실시간 오디오 레코딩 배너 (녹음 진행 중일 때만 상단 부유) */}
      {isRecording && (
        <View style={styles.audioFloatingWrapper}>
          <AudioRecordingStudio
            isRecording={isRecording}
            onStopRecording={handleStopRecording}
            onCancelRecording={() => setIsRecording(false)}
          />
        </View>
      )}

      {/* 플로팅 오디오 플레이어 독 (모든 페이지 오디오 컨트롤: -5초, +5초, 처음으로, 음소거 완비) */}
      {isAudioDockOpen && audioNotes.length > 0 && (
        <View style={styles.floatingAudioDock}>
          <View style={styles.audioDockHeader}>
            <View style={styles.audioDockHeaderLeft}>
              <Volume2 size={15} color="#2563EB" />
              <Text style={styles.audioDockTitle}>
                문서 음성 메모 ({audioNotes.length}개)
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => setIsAudioDockOpen(false)}
              style={styles.audioDockCloseBtn}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <X size={15} color="#64748B" />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.audioDockScroll} nestedScrollEnabled showsVerticalScrollIndicator>
            {audioNotes.map((audio, idx) => (
              <AudioPlayerBar
                key={audio.id}
                audio={audio}
                index={idx}
                totalCount={audioNotes.length}
                isPdfNote={true}
                accentColor="#2563EB"
                onDelete={() => handleDeleteAudio(audio.id)}
                onUpdateTitle={(newTitle) => {
                  setAudioNotes((prev) =>
                    prev.map((a) => (a.id === audio.id ? { ...a, title: newTitle } : a))
                  );
                }}
                onPressPageBadge={(targetPage) => {
                  setCurrentPage(targetPage);
                }}
              />
            ))}
          </ScrollView>
        </View>
      )}

      {/* 2. 중앙 메인 작업 영역 (PDF 편집/병합/분할/구성 및 드로잉 캔버스) */}
      <View style={styles.workspaceBody}>
        {isPdfMode && pdfWorkspaceTab !== 'annotate' ? (
          <PdfAcrobatStudioPanel
            mode={pdfWorkspaceTab}
            title={title}
            pdfPages={pdfPages}
            currentPage={currentPage}
            pageRotations={pageRotations}
            strokeCountsByPage={strokeCountsByPage}
            allNotes={notes}
            currentNoteId={activeNoteId}
            onSelectPageAndAnnotate={(pNum) => {
              setCurrentPage(pNum);
              setPdfWorkspaceTab('annotate');
            }}
            onMovePage={handleMovePage}
            onRotatePage={handleRotatePageAt}
            onDuplicatePage={handleDuplicatePage}
            onDeletePage={handleDeletePage}
            onInsertBlankPageAfter={handleInsertBlankPageAfter}
            onMergePages={handleMergePages}
            onSplitPages={handleSplitPages}
            onBatchRotatePages={handleBatchRotatePages}
            onBatchDeletePages={handleBatchDeletePages}
            onSplitEveryNPages={handleSplitEveryNPages}
          />
        ) : (
          <>
        {/* 썸네일 오버뷰 사이드 드로어 (페이지 관리: 복제/삭제/추가) */}
        {isOverviewOpen && (
          <View style={styles.thumbnailSidebar}>
            <View style={styles.thumbnailHeader}>
              <Text style={styles.thumbnailHeaderText}>페이지 관리 ({totalPages}장)</Text>
              <TouchableOpacity
                onPress={() => setIsOverviewOpen(false)}
                {...(Platform.OS === 'web' ? ({ onClick: () => setIsOverviewOpen(false) } as any) : {})}
              >
                <X size={18} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            {/* 즐겨찾기 북마크 및 목차 필터 탭 (Notewise / Flexcil / Goodnotes 벤치마크) */}
            <View style={styles.overviewFilterRow}>
              <TouchableOpacity
                style={[styles.overviewFilterChip, thumbnailFilter === 'all' && styles.overviewFilterChipActive]}
                onPress={() => setThumbnailFilter('all')}
                {...(Platform.OS === 'web' ? ({ onClick: () => setThumbnailFilter('all') } as any) : {})}
              >
                <Text style={[styles.overviewFilterText, thumbnailFilter === 'all' && styles.overviewFilterTextActive]}>
                  전체 ({totalPages})
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.overviewFilterChip, thumbnailFilter === 'bookmarks' && styles.overviewFilterChipActive]}
                onPress={() => setThumbnailFilter('bookmarks')}
                {...(Platform.OS === 'web' ? ({ onClick: () => setThumbnailFilter('bookmarks') } as any) : {})}
              >
                <Bookmark
                  size={12}
                  color={thumbnailFilter === 'bookmarks' ? '#F59E0B' : '#64748B'}
                  fill={thumbnailFilter === 'bookmarks' ? '#F59E0B' : 'none'}
                />
                <Text style={[styles.overviewFilterText, thumbnailFilter === 'bookmarks' && styles.overviewFilterTextActive]}>
                  즐겨찾기 ({bookmarkedPages.length})
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.overviewFilterChip, thumbnailFilter === 'outline' && styles.overviewFilterChipActive]}
                onPress={() => setThumbnailFilter('outline')}
                {...(Platform.OS === 'web' ? ({ onClick: () => setThumbnailFilter('outline') } as any) : {})}
              >
                <List
                  size={12}
                  color={thumbnailFilter === 'outline' ? '#2563EB' : '#64748B'}
                />
                <Text style={[styles.overviewFilterText, thumbnailFilter === 'outline' && styles.overviewFilterTextActive]}>
                  목차
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.thumbnailList}>
              {thumbnailFilter === 'outline' ? (
                <View style={styles.outlineSectionContainer}>
                  {isPdfMode && activeDocument?.pages && activeDocument.pages.length > 0 ? (
                    activeDocument.pages.map((p) => {
                      const isCur = p.pageNumber === currentPage;
                      return (
                        <TouchableOpacity
                          key={p.pageNumber}
                          style={[styles.outlineItemCard, isCur && styles.outlineItemCardActive]}
                          onPress={() => {
                            setCurrentPage(p.pageNumber);
                            setIsOverviewOpen(false);
                            setExportToastMessage(`📑 P.${p.pageNumber} '${p.title}' 목차로 이동했습니다.`);
                            setTimeout(() => setExportToastMessage(null), 1800);
                          }}
                          {...(Platform.OS === 'web'
                            ? ({
                                onClick: () => {
                                  setCurrentPage(p.pageNumber);
                                  setIsOverviewOpen(false);
                                  setExportToastMessage(`📑 P.${p.pageNumber} '${p.title}' 목차로 이동했습니다.`);
                                  setTimeout(() => setExportToastMessage(null), 1800);
                                },
                              } as any)
                            : {})}
                        >
                          <View style={[styles.outlineItemBadge, isCur && styles.outlineItemBadgeActive]}>
                            <Text style={[styles.outlineItemBadgeText, isCur && styles.outlineItemBadgeTextActive]}>
                              P.{p.pageNumber}
                            </Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.outlineItemTitle, isCur && styles.outlineItemTitleActive]} numberOfLines={1}>
                              {p.title}
                            </Text>
                            {p.subtitle ? (
                              <Text style={styles.outlineItemSubtitle} numberOfLines={1}>
                                {p.subtitle}
                              </Text>
                            ) : null}
                          </View>
                          <ChevronRight size={14} color={isCur ? '#2563EB' : '#94A3B8'} />
                        </TouchableOpacity>
                      );
                    })
                  ) : (
                    <View style={styles.emptyBookmarksBox}>
                      <List size={24} color="#CBD5E1" />
                      <Text style={styles.emptyBookmarksText}>등록된 문서 목차가 없습니다.</Text>
                      <Text style={styles.emptyBookmarksSubtext}>
                        PDF 문서 페이지를 추가하거나 상단 북마크로 중요한 페이지를 마크하세요.
                      </Text>
                    </View>
                  )}
                </View>
              ) : (
                <>
                  {Array.from({ length: totalPages })
                    .map((_, idx) => idx + 1)
                    .filter((pNum) => thumbnailFilter === 'all' || bookmarkedPages.includes(pNum))
                    .map((pNum) => {
                      const idx = pNum - 1;
                      const isSelected = pNum === currentPage;
                      const isPageBookmarked = bookmarkedPages.includes(pNum);
                      return (
                        <View
                          key={pNum}
                          style={[styles.thumbnailCard, isSelected && styles.thumbnailCardSelected]}
                        >
                          <TouchableOpacity
                            style={styles.thumbnailTouchArea}
                            onPress={() => {
                              setCurrentPage(pNum);
                              setIsOverviewOpen(false);
                            }}
                            {...(Platform.OS === 'web'
                              ? ({
                                  onClick: () => {
                                    setCurrentPage(pNum);
                                    setIsOverviewOpen(false);
                                  },
                                } as any)
                              : {})}
                          >
                            <View style={styles.thumbnailMiniPage}>
                              {isPageBookmarked && (
                                <View style={styles.thumbnailBookmarkRibbon}>
                                  <Bookmark size={11} color="#F59E0B" fill="#F59E0B" />
                                </View>
                              )}
                              {isPdfMode && pdfPages[idx]?.renderedImageUri ? (
                                <Image
                                  source={{ uri: pdfPages[idx].renderedImageUri }}
                                  style={{ width: '100%', height: '100%' }}
                                  resizeMode="contain"
                                />
                              ) : (
                                <Text style={styles.thumbnailPageContent} numberOfLines={4}>
                                  {isPdfMode && activeDocument?.pages[idx]
                                    ? activeDocument.pages[idx].title
                                    : `Page ${pNum} 노트`}
                                </Text>
                              )}
                            </View>
                            <Text style={[styles.thumbnailLabel, isSelected && styles.thumbnailLabelSelected]}>
                              페이지 {pNum}
                            </Text>
                          </TouchableOpacity>

                          {/* 페이지별 복제 및 삭제 액션 버튼 */}
                          <View style={styles.thumbnailActionsRow}>
                            <TouchableOpacity
                              style={styles.thumbnailActionBtn}
                              onPress={() => handleDuplicatePage(pNum)}
                              {...(Platform.OS === 'web' ? ({ onClick: () => handleDuplicatePage(pNum) } as any) : {})}
                            >
                              <Copy size={12} color="#2563EB" />
                              <Text style={styles.thumbnailActionText}>복제</Text>
                            </TouchableOpacity>
                            {totalPages > 1 && (
                              <TouchableOpacity
                                style={styles.thumbnailActionBtn}
                                onPress={() => handleDeletePage(pNum)}
                                {...(Platform.OS === 'web' ? ({ onClick: () => handleDeletePage(pNum) } as any) : {})}
                              >
                                <Trash2 size={12} color="#EF4444" />
                                <Text style={[styles.thumbnailActionText, { color: '#EF4444' }]}>삭제</Text>
                              </TouchableOpacity>
                            )}
                          </View>
                        </View>
                      );
                    })}

                  {/* 즐겨찾기 비어있을 때 안내 */}
                  {thumbnailFilter === 'bookmarks' && bookmarkedPages.length === 0 && (
                    <View style={styles.emptyBookmarksBox}>
                      <Bookmark size={24} color="#CBD5E1" />
                      <Text style={styles.emptyBookmarksText}>즐겨찾기한 페이지가 없습니다.</Text>
                      <Text style={styles.emptyBookmarksSubtext}>
                        상단 바의 북마크 아이콘(🔖)을 눌러 등록해보세요.
                      </Text>
                    </View>
                  )}
                </>
              )}

              {/* 새 페이지 추가 버튼 */}
              <TouchableOpacity
                style={styles.addPageThumbnailBtn}
                onPress={() => setIsAddPageTemplateModalOpen(true)}
                {...(Platform.OS === 'web'
                  ? ({ onClick: () => setIsAddPageTemplateModalOpen(true) } as any)
                  : {})}
              >
                <Plus size={16} color="#2563EB" />
                <Text style={styles.addPageThumbnailText}>새 페이지 추가</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        )}

        {/* 스크롤 가능한 메인 문서 A4 뷰 (단일 / 연속 스크롤 / 양면 2쪽 지원) */}
        <ScrollView
          ref={canvasScrollRef}
          style={[
            styles.canvasScrollView,
            Platform.OS === 'web' && (activeTool === 'hand' || isSpacePanning)
              ? ({ cursor: isHandPanning ? 'grabbing' : 'grab', userSelect: 'none' } as any)
              : null,
          ]}
          contentContainerStyle={[
            styles.canvasScrollContent,
            viewLayout === 'two-up' && styles.canvasScrollContentTwoUp,
            viewLayout === 'continuous' && { gap: 28 },
          ]}
          showsVerticalScrollIndicator={true}
          scrollEventThrottle={16}
          onScroll={(e) => {
            scrollOffsetRef.current = {
              x: e.nativeEvent.contentOffset.x,
              y: e.nativeEvent.contentOffset.y,
            };
          }}
          {...(Platform.OS === 'web' && (activeTool === 'hand' || isSpacePanning)
            ? ({ onMouseDown: startHandDragScroll } as any)
            : {})}
        >
          {/* 연속 세로 스크롤(Continuous) 모드: 현재 페이지 앞의 페이지들 렌더링 (클릭 시 즉시 해당 페이지 활성화) */}
          {viewLayout === 'continuous' &&
            Array.from({ length: Math.max(0, currentPage - 1) }).map((_, idx) => {
              const pNum = idx + 1;
              const pData = pdfPages[pNum - 1];
              const pDoc = activeDocument?.pages[pNum - 1];
              const pStrokes = strokes.filter((s) => (s.pageIndex || 1) === pNum);
              const pStamps = pdfStamps.filter((st) => st.pageIndex === pNum);
              const pRedactions = pdfRedactions.filter((r) => r.pageIndex === pNum);
              return (
                <TouchableOpacity
                  key={`cont_prev_${pNum}`}
                  activeOpacity={0.95}
                  onPress={() => setCurrentPage(pNum)}
                  style={[
                    styles.a4PageSheet,
                    styles.companionPageSheet,
                    isNightMode && { backgroundColor: '#0F172A', borderColor: '#1E293B' },
                  ]}
                >
                  {pData?.renderedImageUri ? (
                    <Image
                      source={{ uri: pData.renderedImageUri }}
                      style={StyleSheet.absoluteFill}
                      resizeMode="contain"
                    />
                  ) : pDoc ? (
                    <View style={[styles.pdfPageContent, isNightMode && styles.pdfPageContentDark]}>
                      <View style={styles.pdfHeaderRow}>
                        <Text style={[styles.pdfDocTag, isNightMode && styles.pdfDocTagDark]}>
                          StickyCraft Document
                        </Text>
                        <Text style={[styles.pdfPageTag, isNightMode && styles.pdfPageTagDark]}>
                          PAGE {pNum} OF {totalPages}
                        </Text>
                      </View>
                      <Text style={[styles.pdfPageTitle, isNightMode && styles.pdfPageTitleDark]}>
                        {pDoc.title}
                      </Text>
                      <Text style={[styles.pdfPageSubtitle, isNightMode && styles.pdfPageSubtitleDark]}>
                        {pDoc.subtitle}
                      </Text>
                      <View style={[styles.pdfDivider, isNightMode && styles.pdfDividerDark]} />
                      <Text style={[styles.pdfBodyText, isNightMode && styles.pdfBodyTextDark]}>
                        {pDoc.content}
                      </Text>
                    </View>
                  ) : null}
                  <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" pointerEvents="none">
                    <CommittedDocumentStrokesLayer strokes={pStrokes} selectedStrokeIds={[]} />
                  </Svg>
                  {pStamps.map((st) => (
                    <View
                      key={st.id}
                      pointerEvents="none"
                      style={[
                        styles.pdfStampBadge,
                        {
                          left: st.x,
                          top: st.y,
                          borderColor: st.color,
                          transform: [{ rotate: `${st.rotation ?? -8}deg` }],
                        },
                      ]}
                    >
                      <Text style={[styles.pdfStampLabel, { color: st.color }]}>{st.label}</Text>
                    </View>
                  ))}
                  {pRedactions.map((rd) => (
                    <View
                      key={rd.id}
                      pointerEvents="none"
                      style={[
                        styles.pdfRedactionBox,
                        { left: rd.x, top: rd.y, width: rd.width, height: rd.height },
                      ]}
                    />
                  ))}
                  <View style={styles.companionFocusBadge} pointerEvents="none">
                    <Text style={styles.companionFocusBadgeText}>
                      P.{pNum} / {totalPages} · 클릭하여 이 페이지에 필기
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}

          {/* A4 스타일 활성 문서 시트 (고해상도 그림자 및 경계선) */}
          <View
            ref={pageContainerRef}
            style={[
              styles.a4PageSheet,
              isNightMode
                ? { backgroundColor: '#0F172A', borderColor: '#1E293B' }
                : {
                    backgroundColor:
                      (pageTemplates[currentPage] || paperTemplate) === 'dark'
                        ? '#1E293B'
                        : '#FFFFFF',
                  },
              {
                transform: [
                  { scale: zoomLevel },
                  ...(pageRotations[currentPage] ? [{ rotate: `${pageRotations[currentPage]}deg` }] : []),
                ],
              },
            ]}
            onLayout={(e) => {
              const { width, height } = e.nativeEvent.layout;
              setPageLayout({ width, height });
            }}
          >
            {/* 속지 패턴 렌더링 (원본 PDF 이미지가 없을 때만 속지 표시) */}
            {!pdfPages[currentPage - 1]?.renderedImageUri &&
              (!isPdfMode || pageTemplates[currentPage] || !activeDocument?.pages[currentPage - 1]) && (
              <View style={StyleSheet.absoluteFill} pointerEvents="none">
                <PaperTemplatePattern
                  template={isNightMode ? 'dark' : pageTemplates[currentPage] || paperTemplate}
                />
              </View>
            )}

            {/* PDF 모드: 1순위 실제 PDF 원본 렌더링 이미지, 2순위 구조화 텍스트 본문 */}
            {isPdfMode && pdfPages[currentPage - 1]?.renderedImageUri ? (
              <View style={StyleSheet.absoluteFill} pointerEvents="none">
                <Image
                  source={{ uri: pdfPages[currentPage - 1].renderedImageUri }}
                  style={{ width: '100%', height: '100%' }}
                  resizeMode="contain"
                />
              </View>
            ) : isPdfMode && activeDocument?.pages[currentPage - 1] ? (
              <View
                style={[styles.pdfPageContent, isNightMode && styles.pdfPageContentDark]}
                pointerEvents="none"
              >
                <View style={styles.pdfHeaderRow}>
                  <Text style={[styles.pdfDocTag, isNightMode && styles.pdfDocTagDark]}>
                    StickyCraft Document
                  </Text>
                  <Text style={[styles.pdfPageTag, isNightMode && styles.pdfPageTagDark]}>
                    PAGE {currentPage} OF {totalPages}
                  </Text>
                </View>
                <Text style={[styles.pdfPageTitle, isNightMode && styles.pdfPageTitleDark]}>
                  {activeDocument.pages[currentPage - 1].title}
                </Text>
                <Text style={[styles.pdfPageSubtitle, isNightMode && styles.pdfPageSubtitleDark]}>
                  {activeDocument.pages[currentPage - 1].subtitle}
                </Text>
                <View style={[styles.pdfDivider, isNightMode && styles.pdfDividerDark]} />
                <Text style={[styles.pdfBodyText, isNightMode && styles.pdfBodyTextDark]}>
                  {activeDocument.pages[currentPage - 1].content}
                </Text>
              </View>
            ) : null}

            {/* 머리글 · 바닥글 · 자동 페이지 번호 오버레이 */}
            {pdfHeaderFooter.enabled && (
              <View style={StyleSheet.absoluteFill} pointerEvents="none">
                {pdfHeaderFooter.headerText.trim() ? (
                  <Text style={styles.pdfHeaderOverlayText}>{pdfHeaderFooter.headerText}</Text>
                ) : null}
                <View style={styles.pdfFooterOverlayRow}>
                  <Text style={styles.pdfFooterOverlayText}>{pdfHeaderFooter.footerText}</Text>
                  {pdfHeaderFooter.showPageNumbers && (
                    <Text style={styles.pdfFooterOverlayPageNum}>
                      {currentPage} / {totalPages}
                    </Text>
                  )}
                </View>
              </View>
            )}

            {/* 대각선 워터마크 오버레이 (기밀 CONFIDENTIAL / 초안 DRAFT 등) */}
            {pdfWatermark.enabled && pdfWatermark.text.trim().length > 0 && (
              <View style={styles.pdfWatermarkOverlay} pointerEvents="none">
                <Text
                  style={[
                    styles.pdfWatermarkText,
                    {
                      color: pdfWatermark.color || '#DC2626',
                      opacity: Math.max(0.05, Math.min(0.45, pdfWatermark.opacity || 0.14)),
                    },
                  ]}
                >
                  {pdfWatermark.text}
                </Text>
              </View>
            )}

            {/* 손글씨 & 기하 도형 & PDF 블록 발췌 & 먹칠 드래그 실시간 벡터 SVG 오버레이 레이어 */}
            <View
              style={[
                StyleSheet.absoluteFill,
                Platform.OS === 'web' &&
                  ({
                    cursor:
                      activeTool === 'hand' || isSpacePanning
                        ? isHandPanning
                          ? 'grabbing'
                          : 'grab'
                        : activeTool === 'text'
                        ? 'text'
                        : 'crosshair',
                    userSelect: 'none',
                    touchAction: activeTool === 'hand' ? 'pan-y pan-x' : 'none',
                  } as any),
              ]}
              {...(Platform.OS !== 'web' ? panResponder.panHandlers : {})}
              {...(Platform.OS === 'web'
                ? ({
                    onMouseDown: handleWebMouseDown,
                    onMouseMove: handleWebMouseMove,
                    onMouseUp: handleWebMouseUp,
                    onMouseLeave: handleWebMouseUp,
                  } as any)
                : {})}
            >
              <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
                {/* 메모이제이션된 확정 필기/형광펜/도형 레이어 (60fps 드로잉 중 재연산 0%) */}
                <CommittedDocumentStrokesLayer
                  strokes={currentPageStrokes}
                  selectedStrokeIds={selectedStrokeIds}
                />

                {/* 실시간 직사각형 영역 선택 상자 (파란 점선 및 반투명 채우기) */}
                {selectionRect && (
                  <Rect
                    x={Math.min(selectionRect.startX, selectionRect.currentX)}
                    y={Math.min(selectionRect.startY, selectionRect.currentY)}
                    width={Math.max(1, Math.abs(selectionRect.currentX - selectionRect.startX))}
                    height={Math.max(1, Math.abs(selectionRect.currentY - selectionRect.startY))}
                    stroke="#2563EB"
                    strokeWidth={1.8}
                    strokeDasharray="6,4"
                    fill="rgba(37, 99, 235, 0.12)"
                    rx={3}
                  />
                )}

                {/* Flexcil 스타일 실시간 PDF 블록 캡처 드래그 영역 (주황 점선) */}
                {snippetDraftRect && (
                  <Rect
                    x={Math.min(snippetDraftRect.startX, snippetDraftRect.currentX)}
                    y={Math.min(snippetDraftRect.startY, snippetDraftRect.currentY)}
                    width={Math.max(1, Math.abs(snippetDraftRect.currentX - snippetDraftRect.startX))}
                    height={Math.max(1, Math.abs(snippetDraftRect.currentY - snippetDraftRect.startY))}
                    stroke="#D97706"
                    strokeWidth={2.2}
                    strokeDasharray="6,4"
                    fill="rgba(245, 158, 11, 0.14)"
                    rx={4}
                  />
                )}

                {/* 실시간 민감정보 먹칠(Redaction) 드래그 영역 프리뷰 */}
                {redactDraftRect && (
                  <Rect
                    x={Math.min(redactDraftRect.startX, redactDraftRect.currentX)}
                    y={Math.min(redactDraftRect.startY, redactDraftRect.currentY)}
                    width={Math.max(1, Math.abs(redactDraftRect.currentX - redactDraftRect.startX))}
                    height={Math.max(1, Math.abs(redactDraftRect.currentY - redactDraftRect.startY))}
                    stroke="#EF4444"
                    strokeWidth={2}
                    fill="rgba(9, 9, 11, 0.85)"
                    rx={2}
                  />
                )}

                {/* 현재 실시간 드로잉 중인 도형 프리뷰 */}
                {currentStroke &&
                  currentStroke.tool === 'shape' &&
                  currentStroke.shapeStart &&
                  currentStroke.shapeEnd &&
                  (() => {
                    const s = currentStroke.shapeStart;
                    const e = currentStroke.shapeEnd;
                    if (currentStroke.shapeType === 'rect') {
                      return (
                        <Rect
                          x={Math.min(s.x, e.x)}
                          y={Math.min(s.y, e.y)}
                          width={Math.max(2, Math.abs(e.x - s.x))}
                          height={Math.max(2, Math.abs(e.y - s.y))}
                          stroke={currentStroke.color}
                          strokeWidth={currentStroke.width}
                          fill="none"
                          rx={4}
                        />
                      );
                    }
                    if (currentStroke.shapeType === 'circle') {
                      return (
                        <Circle
                          cx={(s.x + e.x) / 2}
                          cy={(s.y + e.y) / 2}
                          r={Math.max(2, Math.hypot(e.x - s.x, e.y - s.y) / 2)}
                          stroke={currentStroke.color}
                          strokeWidth={currentStroke.width}
                          fill="none"
                        />
                      );
                    }
                    if (currentStroke.shapeType === 'arrow') {
                      const angle = Math.atan2(e.y - s.y, e.x - s.x);
                      const headLen = Math.max(12, currentStroke.width * 3);
                      const lx = e.x - headLen * Math.cos(angle - Math.PI / 6);
                      const ly = e.y - headLen * Math.sin(angle - Math.PI / 6);
                      const rx = e.x - headLen * Math.cos(angle + Math.PI / 6);
                      const ry = e.y - headLen * Math.sin(angle + Math.PI / 6);
                      return (
                        <React.Fragment>
                          <SvgLine
                            x1={s.x}
                            y1={s.y}
                            x2={e.x}
                            y2={e.y}
                            stroke={currentStroke.color}
                            strokeWidth={currentStroke.width}
                            strokeLinecap="round"
                          />
                          <SvgPath
                            d={`M ${lx} ${ly} L ${e.x} ${e.y} L ${rx} ${ry}`}
                            stroke={currentStroke.color}
                            strokeWidth={currentStroke.width}
                            fill="none"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </React.Fragment>
                      );
                    }
                    return (
                      <SvgLine
                        x1={s.x}
                        y1={s.y}
                        x2={e.x}
                        y2={e.y}
                        stroke={currentStroke.color}
                        strokeWidth={currentStroke.width}
                        strokeLinecap="round"
                      />
                    );
                  })()}

                {/* 현재 실시간 드로잉 중인 펜/형광펜 스트로크 */}
                {currentStroke && currentStroke.tool !== 'shape' && (
                  <SvgPath
                    d={pointsToSvgPath(currentStroke.points)}
                    stroke={currentStroke.color}
                    strokeWidth={currentStroke.width}
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity={currentStroke.tool === 'highlighter' ? 0.45 : 1}
                  />
                )}

                {/* Goodnotes 6 프레젠테이션 레이저 포인터 궤적 및 발광 점 */}
                {laserTrail.length > 1 && (
                  <SvgPath
                    d={pointsToSvgPath(laserTrail)}
                    stroke="#EF4444"
                    strokeWidth={4.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                    opacity={0.85}
                  />
                )}
                {laserPoint && (
                  <>
                    <Circle
                      cx={laserPoint.x}
                      cy={laserPoint.y}
                      r={14}
                      fill="rgba(239, 68, 68, 0.25)"
                    />
                    <Circle
                      cx={laserPoint.x}
                      cy={laserPoint.y}
                      r={8}
                      fill="rgba(239, 68, 68, 0.55)"
                    />
                    <Circle
                      cx={laserPoint.x}
                      cy={laserPoint.y}
                      r={4.5}
                      fill="#FFFFFF"
                      stroke="#DC2626"
                      strokeWidth={2}
                    />
                  </>
                )}
              </Svg>
            </View>

            {/* 스탬프 배지 레이어 (승인 / 초안 / 검토 완료 / 중요 / 기밀) */}
            {pdfStamps
              .filter((st) => st.pageIndex === currentPage)
              .map((st) => (
                <View
                  key={st.id}
                  pointerEvents={
                    activeTool === 'stamp' || activeTool === 'eraser' ? 'auto' : 'none'
                  }
                  style={[
                    styles.pdfStampBadge,
                    {
                      left: st.x,
                      top: st.y,
                      borderColor: st.color,
                      transform: [{ rotate: `${st.rotation ?? -8}deg` }],
                    },
                  ]}
                >
                  <View style={[styles.pdfStampInnerBorder, { borderColor: st.color }]}>
                    <Text style={[styles.pdfStampLabel, { color: st.color }]}>{st.label}</Text>
                    {st.sublabel ? (
                      <Text style={[styles.pdfStampSublabel, { color: st.color }]}>
                        {st.sublabel}
                      </Text>
                    ) : null}
                  </View>
                  {(activeTool === 'stamp' || activeTool === 'eraser') && (
                    <TouchableOpacity
                      style={styles.overlayRemoveCircle}
                      onPress={() =>
                        setPdfStamps((prev) => prev.filter((item) => item.id !== st.id))
                      }
                    >
                      <X size={10} color="#FFFFFF" />
                    </TouchableOpacity>
                  )}
                </View>
              ))}

            {/* 민감정보 먹칠/가림 박스 레이어 (Redactions) */}
            {pdfRedactions
              .filter((rd) => rd.pageIndex === currentPage)
              .map((rd) => (
                <View
                  key={rd.id}
                  pointerEvents={
                    activeTool === 'redact' || activeTool === 'eraser' ? 'auto' : 'none'
                  }
                  style={[
                    styles.pdfRedactionBox,
                    {
                      left: rd.x,
                      top: rd.y,
                      width: rd.width,
                      height: rd.height,
                    },
                  ]}
                >
                  <Text style={styles.pdfRedactionLabel}>{rd.reason || 'REDACTED'}</Text>
                  {(activeTool === 'redact' || activeTool === 'eraser') && (
                    <TouchableOpacity
                      style={styles.overlayRemoveCircle}
                      onPress={() =>
                        setPdfRedactions((prev) => prev.filter((item) => item.id !== rd.id))
                      }
                    >
                      <X size={10} color="#FFFFFF" />
                    </TouchableOpacity>
                  )}
                </View>
              ))}

            {/* 스레드 댓글 핀 레이어 (클릭 시 우측 댓글 드로어에서 해당 스레드 포커스) */}
            {pdfComments
              .filter((cm) => cm.pageIndex === currentPage)
              .map((cm) => {
                const threadNumber = pdfComments.findIndex((t) => t.id === cm.id) + 1;
                const isSelected = activeCommentThreadId === cm.id;
                return (
                  <TouchableOpacity
                    key={cm.id}
                    style={[
                      styles.pdfCommentPin,
                      { left: cm.x, top: cm.y },
                      cm.resolved && styles.pdfCommentPinResolved,
                      isSelected && styles.pdfCommentPinSelected,
                    ]}
                    onPress={() => {
                      setActiveCommentThreadId(cm.id);
                      setIsCommentsDrawerOpen(true);
                    }}
                  >
                    <MessageSquare size={12} color="#FFFFFF" />
                    <Text style={styles.pdfCommentPinText}>#{threadNumber}</Text>
                  </TouchableOpacity>
                );
              })}

            {/* 발췌 스티커 [원문 보기] 왕복 하이라이트 오버레이 (Flexcil 참조 링크 벤치마크) */}
            {sourceHighlightTarget &&
              (sourceHighlightTarget.pageId
                ? pdfPages[currentPage - 1]?.id === sourceHighlightTarget.pageId
                : sourceHighlightTarget.pageNumber === currentPage) &&
              (() => {
                const pw = pageLayout.width || 720;
                const ph = pageLayout.height || 1018;
                const box = sourceHighlightTarget.normRect
                  ? {
                      x: sourceHighlightTarget.normRect.x * pw,
                      y: sourceHighlightTarget.normRect.y * ph,
                      width: Math.max(48, sourceHighlightTarget.normRect.width * pw),
                      height: Math.max(32, sourceHighlightTarget.normRect.height * ph),
                    }
                  : sourceHighlightTarget.cropRect
                  ? {
                      x: sourceHighlightTarget.cropRect.x,
                      y: sourceHighlightTarget.cropRect.y,
                      width: Math.max(48, sourceHighlightTarget.cropRect.width),
                      height: Math.max(32, sourceHighlightTarget.cropRect.height),
                    }
                  : {
                      x: 40,
                      y: 80,
                      width: Math.max(120, pw - 80),
                      height: 110,
                    };
                return (
                  <View
                    style={{
                      position: 'absolute',
                      left: box.x,
                      top: box.y,
                      width: box.width,
                      height: box.height,
                      backgroundColor: 'rgba(245, 158, 11, 0.20)',
                      borderWidth: 2.5,
                      borderColor: '#D97706',
                      borderRadius: 10,
                      zIndex: 85,
                    }}
                    pointerEvents="box-none"
                  >
                    <View
                      style={{
                        position: 'absolute',
                        top: -28,
                        left: 0,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 6,
                        backgroundColor: '#D97706',
                        paddingHorizontal: 10,
                        paddingVertical: 4,
                        borderRadius: 999,
                      }}
                    >
                      <Text style={{ fontSize: 11, fontWeight: '800', color: '#FFFFFF' }}>
                        🔍 발췌 원문 위치 (P.{currentPage})
                      </Text>
                      <TouchableOpacity onPress={() => setSourceHighlightTarget(null)}>
                        <X size={12} color="#FFFFFF" />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })()}

            {/* 올가미 선택 영역 바운딩 박스 & 플로팅 액션 바 (복제 / 색상변경 / 삭제 / 닫기) */}
            {selectionBBox && selectedStrokeIds.length > 0 && (
              <View
                style={[
                  styles.selectionBoxOverlay,
                  {
                    left: selectionBBox.minX,
                    top: selectionBBox.minY,
                    width: Math.max(40, selectionBBox.maxX - selectionBBox.minX),
                    height: Math.max(30, selectionBBox.maxY - selectionBBox.minY),
                  },
                ]}
                pointerEvents="box-none"
              >
                <View style={styles.selectionDashedBorder} pointerEvents="none" />
                <View style={[styles.selectionCornerHandle, { top: -5, left: -5 }]} />
                <View style={[styles.selectionCornerHandle, { top: -5, right: -5 }]} />
                <View style={[styles.selectionCornerHandle, { bottom: -5, left: -5 }]} />
                <View style={[styles.selectionCornerHandle, { bottom: -5, right: -5 }]} />

                {/* Floating Action Menu above selection */}
                <View style={styles.selectionFloatingToolbar}>
                  <TouchableOpacity
                    style={styles.selectionActionBtn}
                    onPress={handleDuplicateSelection}
                    {...(Platform.OS === 'web' ? ({ onClick: handleDuplicateSelection } as any) : {})}
                  >
                    <Copy size={11} color="#FFFFFF" />
                    <Text style={styles.selectionActionText}>복제</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.selectionActionBtn}
                    onPress={handleRecolorSelection}
                    {...(Platform.OS === 'web' ? ({ onClick: handleRecolorSelection } as any) : {})}
                  >
                    <Palette size={11} color="#FFFFFF" />
                    <Text style={styles.selectionActionText}>색상 변경</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.selectionActionBtn, { backgroundColor: '#DC2626' }]}
                    onPress={handleDeleteSelection}
                    {...(Platform.OS === 'web' ? ({ onClick: handleDeleteSelection } as any) : {})}
                  >
                    <Trash2 size={11} color="#FFFFFF" />
                    <Text style={styles.selectionActionText}>삭제</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.selectionCloseBtn}
                    onPress={() => {
                      setSelectedStrokeIds([]);
                      setSelectionBBox(null);
                    }}
                    {...(Platform.OS === 'web'
                      ? ({
                          onClick: () => {
                            setSelectedStrokeIds([]);
                            setSelectionBBox(null);
                          },
                        } as any)
                      : {})}
                  >
                    <X size={11} color="#CBD5E1" />
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Flexcil / LiquidText 스타일 PDF 블록 지정 캡처 프레임 & 플로팅 액션 바 (복사 / 새 노트 / 기존 노트 / 사이드 노트 / 강조) */}
            {capturedBlockRect && capturedBlockResult && (
              <View
                style={[
                  styles.snippetOverlayBox,
                  {
                    left: capturedBlockRect.x,
                    top: capturedBlockRect.y,
                    width: Math.max(40, capturedBlockRect.width),
                    height: Math.max(30, capturedBlockRect.height),
                  },
                ]}
                pointerEvents="box-none"
              >
                <View style={styles.snippetDashedFrame} pointerEvents="none" />
                <View style={[styles.snippetCornerDot, { top: -5, left: -5 }]} pointerEvents="none" />
                <View style={[styles.snippetCornerDot, { top: -5, right: -5 }]} pointerEvents="none" />
                <View style={[styles.snippetCornerDot, { bottom: -5, left: -5 }]} pointerEvents="none" />
                <View style={[styles.snippetCornerDot, { bottom: -5, right: -5 }]} pointerEvents="none" />

                {/* 플로팅 액션 바 (상단 공간이 좁으면 블록 아래로 자동 배치) */}
                <View
                  style={[
                    styles.snippetActionBar,
                    capturedBlockRect.y < 76
                      ? { bottom: -46, top: undefined }
                      : { top: -46, bottom: undefined },
                  ]}
                >
                  <TouchableOpacity
                    style={[styles.snippetActionBtn, { backgroundColor: '#1E293B' }]}
                    onPress={handleCopyCapturedBlock}
                  >
                    <ClipboardCopy size={12} color="#FFFFFF" />
                    <Text style={styles.snippetActionBtnText}>복사</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.snippetActionBtn, { backgroundColor: '#2563EB' }]}
                    onPress={handleSendBlockToNewNote}
                  >
                    <FilePlus2 size={12} color="#FFFFFF" />
                    <Text style={styles.snippetActionBtnText}>새 노트로</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.snippetActionBtn, { backgroundColor: '#7C3AED' }]}
                    onPress={() => setIsAppendNotePickerOpen((prev) => !prev)}
                  >
                    <Plus size={12} color="#FFFFFF" />
                    <Text style={styles.snippetActionBtnText}>기존 노트에</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.snippetActionBtn, { backgroundColor: '#D97706' }]}
                    onPress={handleSendBlockToSideNote}
                  >
                    <PanelRight size={12} color="#FFFFFF" />
                    <Text style={styles.snippetActionBtnText}>사이드 노트</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.snippetActionBtn, { backgroundColor: '#059669' }]}
                    onPress={handleHighlightCapturedBlock}
                  >
                    <Highlighter size={12} color="#FFFFFF" />
                    <Text style={styles.snippetActionBtnText}>강조</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.snippetCloseBtn}
                    onPress={() => {
                      setCapturedBlockRect(null);
                      setCapturedBlockResult(null);
                      setIsAppendNotePickerOpen(false);
                    }}
                  >
                    <X size={12} color="#94A3B8" />
                  </TouchableOpacity>
                </View>

                {/* 기존 노트 선택 인라인 팝오버 */}
                {isAppendNotePickerOpen && (
                  <View
                    style={[
                      styles.appendNotePickerCard,
                      capturedBlockRect.y < 76 ? { top: capturedBlockRect.height + 52 } : { top: 8 },
                    ]}
                  >
                    <View style={styles.appendNotePickerHeader}>
                      <Text style={styles.appendNotePickerTitle}>📎 발췌 블록을 추가할 기존 노트 선택</Text>
                      <TouchableOpacity onPress={() => setIsAppendNotePickerOpen(false)}>
                        <X size={13} color="#64748B" />
                      </TouchableOpacity>
                    </View>
                    <ScrollView style={{ maxHeight: 190 }} nestedScrollEnabled>
                      {notes
                        .filter((n) => !n.isDeleted && !n.isArchived && n.id !== activeNoteId)
                        .map((targetNote) => (
                          <TouchableOpacity
                            key={targetNote.id}
                            style={styles.appendNoteItemBtn}
                            onPress={() => handleAppendBlockToExistingNote(targetNote)}
                          >
                            <FileText size={13} color="#7C3AED" />
                            <Text style={styles.appendNoteItemTitle} numberOfLines={1}>
                              {targetNote.title || '제목 없음'}
                            </Text>
                            <Text style={styles.appendNoteItemTag}>추가 →</Text>
                          </TouchableOpacity>
                        ))}
                    </ScrollView>
                  </View>
                )}
              </View>
            )}

            {/* 자유 텍스트 상자 목록 (Goodnotes / Notewise 스타일 탭하여 입력) */}
            {textBoxes
              .filter((t) => (t.pageIndex || 1) === currentPage)
              .map((t) => (
                <DraggableTextBox
                  key={t.id}
                  textBox={t}
                  containerWidth={pageLayout.width}
                  containerHeight={pageLayout.height}
                  isSelected={selectedTextBoxId === t.id}
                  onSelect={(id) => setSelectedTextBoxId(id)}
                  onUpdate={handleUpdateTextBox}
                  onDelete={handleDeleteTextBox}
                />
              ))}

            {/* 자유 위치 조정 가능한 공간 음성 녹음 핀 (Notewise & Noteshelf 스타일) */}
            {audioNotes
              .filter((a) => (a.pageIndex || 1) === currentPage)
              .map((audio) => (
                <DraggableAudioPin
                  key={audio.id}
                  audio={audio}
                  containerWidth={pageLayout.width}
                  containerHeight={pageLayout.height}
                  onUpdatePosition={handleUpdateAudioPos}
                  onDelete={handleDeleteAudio}
                />
              ))}
          </View>

          {/* 양면 나란히 보기(Two-Up) 또는 연속 세로 스크롤(Continuous): 뒤따르는 페이지 렌더링 */}
          {(() => {
            const followingPages: number[] = [];
            if (viewLayout === 'continuous') {
              for (let p = currentPage + 1; p <= totalPages; p++) followingPages.push(p);
            } else if (viewLayout === 'two-up' && totalPages > 1) {
              const facing = currentPage < totalPages ? currentPage + 1 : currentPage - 1;
              if (facing >= 1 && facing <= totalPages && facing !== currentPage) {
                followingPages.push(facing);
              }
            }
            return followingPages.map((pNum) => {
              const pData = pdfPages[pNum - 1];
              const pDoc = activeDocument?.pages[pNum - 1];
              const pStrokes = strokes.filter((s) => (s.pageIndex || 1) === pNum);
              const pStamps = pdfStamps.filter((st) => st.pageIndex === pNum);
              const pRedactions = pdfRedactions.filter((r) => r.pageIndex === pNum);
              return (
                <TouchableOpacity
                  key={`comp_next_${pNum}`}
                  activeOpacity={0.95}
                  onPress={() => setCurrentPage(pNum)}
                  style={[
                    styles.a4PageSheet,
                    styles.companionPageSheet,
                    isNightMode && { backgroundColor: '#0F172A', borderColor: '#1E293B' },
                  ]}
                >
                  {pData?.renderedImageUri ? (
                    <Image
                      source={{ uri: pData.renderedImageUri }}
                      style={StyleSheet.absoluteFill}
                      resizeMode="contain"
                    />
                  ) : pDoc ? (
                    <View style={[styles.pdfPageContent, isNightMode && styles.pdfPageContentDark]}>
                      <View style={styles.pdfHeaderRow}>
                        <Text style={[styles.pdfDocTag, isNightMode && styles.pdfDocTagDark]}>
                          StickyCraft Document
                        </Text>
                        <Text style={[styles.pdfPageTag, isNightMode && styles.pdfPageTagDark]}>
                          PAGE {pNum} OF {totalPages}
                        </Text>
                      </View>
                      <Text style={[styles.pdfPageTitle, isNightMode && styles.pdfPageTitleDark]}>
                        {pDoc.title}
                      </Text>
                      <Text style={[styles.pdfPageSubtitle, isNightMode && styles.pdfPageSubtitleDark]}>
                        {pDoc.subtitle}
                      </Text>
                      <View style={[styles.pdfDivider, isNightMode && styles.pdfDividerDark]} />
                      <Text style={[styles.pdfBodyText, isNightMode && styles.pdfBodyTextDark]}>
                        {pDoc.content}
                      </Text>
                    </View>
                  ) : null}
                  {pdfWatermark.enabled && pdfWatermark.text.trim().length > 0 && (
                    <View style={styles.pdfWatermarkOverlay} pointerEvents="none">
                      <Text
                        style={[
                          styles.pdfWatermarkText,
                          {
                            color: pdfWatermark.color || '#DC2626',
                            opacity: Math.max(0.05, Math.min(0.45, pdfWatermark.opacity || 0.14)),
                          },
                        ]}
                      >
                        {pdfWatermark.text}
                      </Text>
                    </View>
                  )}
                  <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" pointerEvents="none">
                    <CommittedDocumentStrokesLayer strokes={pStrokes} selectedStrokeIds={[]} />
                  </Svg>
                  {pStamps.map((st) => (
                    <View
                      key={st.id}
                      pointerEvents="none"
                      style={[
                        styles.pdfStampBadge,
                        {
                          left: st.x,
                          top: st.y,
                          borderColor: st.color,
                          transform: [{ rotate: `${st.rotation ?? -8}deg` }],
                        },
                      ]}
                    >
                      <Text style={[styles.pdfStampLabel, { color: st.color }]}>{st.label}</Text>
                    </View>
                  ))}
                  {pRedactions.map((rd) => (
                    <View
                      key={rd.id}
                      pointerEvents="none"
                      style={[
                        styles.pdfRedactionBox,
                        { left: rd.x, top: rd.y, width: rd.width, height: rd.height },
                      ]}
                    />
                  ))}
                  <View style={styles.companionFocusBadge} pointerEvents="none">
                    <Text style={styles.companionFocusBadgeText}>
                      P.{pNum} / {totalPages} · 클릭하여 이 페이지에 필기
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            });
          })()}
        </ScrollView>

        {/* 우측 스레드 댓글 검토 드로어 */}
        {isCommentsDrawerOpen && (
          <PdfCommentsDrawer
            comments={pdfComments}
            activeThreadId={activeCommentThreadId}
            currentPage={currentPage}
            onSelectThread={(thread) => {
              setActiveCommentThreadId(thread.id);
              setCurrentPage(thread.pageIndex);
            }}
            onReplyThread={(threadId, replyText) => {
              setPdfComments((prev) =>
                prev.map((t) =>
                  t.id === threadId
                    ? {
                        ...t,
                        messages: [
                          ...t.messages,
                          {
                            id: `cmsg_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
                            author: pdfMeta.author || '검토자',
                            text: replyText,
                            createdAt: Date.now(),
                          },
                        ],
                      }
                    : t
                )
              );
            }}
            onToggleResolved={(threadId) => {
              setPdfComments((prev) =>
                prev.map((t) => (t.id === threadId ? { ...t, resolved: !t.resolved } : t))
              );
            }}
            onDeleteThread={(threadId) => {
              setPdfComments((prev) => prev.filter((t) => t.id !== threadId));
              if (activeCommentThreadId === threadId) setActiveCommentThreadId(null);
            }}
            onStartPlaceComment={() => {
              setActiveTool('comment');
              setExportToastMessage('💬 문서 위 원하는 위치를 클릭하면 스레드 댓글 핀이 생성됩니다!');
              setTimeout(() => setExportToastMessage(null), 2200);
            }}
            onClose={() => setIsCommentsDrawerOpen(false)}
          />
        )}

        {/* Flexcil / LiquidText 스타일 우측 분할 사이드 노트 패널 */}
        {isSideNoteOpen && (
          <PdfSideNoteDrawer
            docTitle={title}
            allNotes={notes}
            currentNoteId={activeNoteId}
            linkedNoteId={sideLinkedNoteId}
            sideTitle={sideNoteTitle}
            sideContent={sideNoteContent}
            snippets={sideNoteSnippets}
            onChangeLinkedNoteId={handleChangeSideLinkedNote}
            onChangeTitle={setSideNoteTitle}
            onChangeContent={setSideNoteContent}
            onRemoveSnippet={(id) =>
              setSideNoteSnippets((prev) => prev.filter((item) => item.id !== id))
            }
            onJumpToPage={(pNum) => {
              const clamped = Math.max(1, Math.min(totalPages, pNum));
              setCurrentPage(clamped);
              setExportToastMessage(`📑 발췌 출처 P.${clamped} 페이지로 이동했습니다.`);
              setTimeout(() => setExportToastMessage(null), 1600);
            }}
            onCopySnippet={async (snip) => {
              await copyBlockToClipboard(snip.imageDataUrl, snip.extractedText);
              setExportToastMessage('📋 발췌 블록이 클립보드에 복사되었습니다!');
              setTimeout(() => setExportToastMessage(null), 1800);
            }}
            onSaveToBoard={handleSaveSideNoteToBoard}
            onClose={() => setIsSideNoteOpen(false)}
          />
        )}
          </>
        )}
      </View>

      {/* 3. 하단 플로팅 프로 툴박스 (편집/필기 주석 모드일 때만 표시, 빈 여백 클릭 통과) */}
      {(!isPdfMode || pdfWorkspaceTab === 'annotate') && (
      <View
        pointerEvents="box-none"
        style={[
          styles.floatingToolboxContainer,
          isSideNoteOpen && { right: 340 },
        ]}
      >
        {/* 활성 도구별 보조 컨트롤 팝오버 */}
        {activeTool === 'shape' && (
          <View style={styles.subShapeToolbox}>
            <Text style={styles.subShapeLabel}>도형:</Text>
            {(
              [
                { type: 'rect', label: '사각형', icon: Square },
                { type: 'circle', label: '원형', icon: CircleIcon },
                { type: 'arrow', label: '화살표', icon: ArrowRight },
                { type: 'line', label: '직선', icon: Minus },
              ] as const
            ).map((item) => {
              const IconComp = item.icon;
              const isCurrentShape = shapeType === item.type;
              return (
                <TouchableOpacity
                  key={item.type}
                  style={[styles.subShapeBtn, isCurrentShape && styles.subShapeBtnActive]}
                  onPress={() => setShapeType(item.type)}
                  {...(Platform.OS === 'web' ? ({ onClick: () => setShapeType(item.type) } as any) : {})}
                >
                  <IconComp size={14} color={isCurrentShape ? '#2563EB' : '#475569'} />
                  <Text
                    style={[
                      styles.subShapeBtnText,
                      isCurrentShape && styles.subShapeBtnTextActive,
                    ]}
                  >
                    {item.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {(activeTool === 'fountain' || activeTool === 'pen' || activeTool === 'highlighter') && (
          <View style={styles.subShapeToolbox}>
            <Text style={styles.subShapeLabel}>펜 종류:</Text>
            <TouchableOpacity
              style={[styles.subShapeBtn, activeTool === 'fountain' && styles.subShapeBtnActive]}
              onPress={() => setActiveTool('fountain')}
            >
              <PenTool size={13} color={activeTool === 'fountain' ? '#2563EB' : '#475569'} />
              <Text style={[styles.subShapeBtnText, activeTool === 'fountain' && styles.subShapeBtnTextActive]}>
                만년필
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.subShapeBtn, activeTool === 'pen' && styles.subShapeBtnActive]}
              onPress={() => setActiveTool('pen')}
            >
              <PenTool size={13} color={activeTool === 'pen' ? '#2563EB' : '#475569'} />
              <Text style={[styles.subShapeBtnText, activeTool === 'pen' && styles.subShapeBtnTextActive]}>
                볼펜
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.subShapeBtn, activeTool === 'highlighter' && styles.subShapeBtnActive]}
              onPress={() => setActiveTool('highlighter')}
            >
              <Highlighter size={13} color={activeTool === 'highlighter' ? '#2563EB' : '#475569'} />
              <Text style={[styles.subShapeBtnText, activeTool === 'highlighter' && styles.subShapeBtnTextActive]}>
                형광펜
              </Text>
            </TouchableOpacity>

            <View style={{ width: 1, height: 16, backgroundColor: '#E2E8F0', marginHorizontal: 4 }} />

            {/* Goodnotes & Notewise 스타일 스마트 도형 자동 보정 (Snap to Shape) */}
            <TouchableOpacity
              style={[styles.autoSnapBtn, autoSnapShape && styles.autoSnapBtnActive]}
              onPress={() => {
                setAutoSnapShape((prev) => {
                  const next = !prev;
                  setExportToastMessage(next ? '📐 스마트 도형 자동 보정 켜짐' : '📐 도형 자동 보정 꺼짐');
                  setTimeout(() => setExportToastMessage(null), 1800);
                  return next;
                });
              }}
            >
              <Sparkles size={12} color={autoSnapShape ? '#2563EB' : '#64748B'} />
              <Text style={[styles.autoSnapText, autoSnapShape && styles.autoSnapTextActive]}>
                도형 보정 {autoSnapShape ? 'ON' : 'OFF'}
              </Text>
            </TouchableOpacity>

            {/* 사각사각 필기음 ASMR 퀵 토글 (설정과 실시간 연동) */}
            <TouchableOpacity
              style={[styles.autoSnapBtn, writingSoundEnabled && styles.writingSoundQuickBtnActive]}
              onPress={() => {
                const next = !writingSoundEnabled;
                setWritingSoundEnabled(next);
                if (next) {
                  playWritingSoundPreview();
                } else {
                  stopWritingScratch();
                }
                setExportToastMessage(
                  next ? '✏️ 사각사각 필기 효과음 켜짐 (설정 연동)' : '🔇 필기 효과음 꺼짐'
                );
                setTimeout(() => setExportToastMessage(null), 1800);
              }}
            >
              {writingSoundEnabled ? (
                <Volume2 size={12} color="#059669" />
              ) : (
                <VolumeX size={12} color="#64748B" />
              )}
              <Text
                style={[
                  styles.autoSnapText,
                  writingSoundEnabled && styles.writingSoundQuickTextActive,
                ]}
              >
                필기음 {writingSoundEnabled ? 'ON' : 'OFF'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {(activeTool === 'text' || selectedTextBoxId !== null) && (
          <View style={styles.subShapeToolbox}>
            <Type size={13} color="#2563EB" />
            <Text style={styles.subShapeLabel}>글자 크기:</Text>
            {[12, 16, 20, 26, 34].map((sz) => {
              const currentBox = selectedTextBoxId ? textBoxes.find((t) => t.id === selectedTextBoxId) : null;
              const isCurrentSize = currentBox ? currentBox.fontSize === sz : defaultTextFontSize === sz;
              return (
                <TouchableOpacity
                  key={sz}
                  style={[styles.subShapeBtn, isCurrentSize && styles.subShapeBtnActive]}
                  onPress={() => {
                    setDefaultTextFontSize(sz);
                    if (selectedTextBoxId) {
                      handleUpdateTextBox(selectedTextBoxId, { fontSize: sz });
                    }
                  }}
                  {...(Platform.OS === 'web'
                    ? ({
                        onClick: () => {
                          setDefaultTextFontSize(sz);
                          if (selectedTextBoxId) {
                            handleUpdateTextBox(selectedTextBoxId, { fontSize: sz });
                          }
                        },
                      } as any)
                    : {})}
                >
                  <Text style={[styles.subShapeBtnText, isCurrentSize && styles.subShapeBtnTextActive]}>
                    {sz}px
                  </Text>
                </TouchableOpacity>
              );
            })}
            <View style={{ width: 1, height: 16, backgroundColor: '#E2E8F0', marginHorizontal: 4 }} />
            <Text style={[styles.subShapeBtnText, { color: '#64748B' }]}>
              {selectedTextBoxId ? '선택된 텍스트 상자' : '캔버스 클릭 시 텍스트 상자 생성'}
            </Text>
            {selectedTextBoxId && (
              <TouchableOpacity
                style={[styles.subShapeBtn, { marginLeft: 4 }]}
                onPress={() => setSelectedTextBoxId(null)}
                {...(Platform.OS === 'web' ? ({ onClick: () => setSelectedTextBoxId(null) } as any) : {})}
              >
                <X size={13} color="#64748B" />
              </TouchableOpacity>
            )}
          </View>
        )}

        {activeTool === 'eraser' && (
          <View style={styles.subShapeToolbox}>
            <Text style={styles.subShapeLabel}>지우개 크기:</Text>
            {[
              { label: '소 (16px)', radius: 16 },
              { label: '중 (28px)', radius: 28 },
              { label: '대 (44px)', radius: 44 },
            ].map((item) => (
              <TouchableOpacity
                key={item.label}
                style={[
                  styles.subShapeBtn,
                  eraserRadius === item.radius && styles.subShapeBtnActive,
                ]}
                onPress={() => setEraserRadius(item.radius)}
                {...(Platform.OS === 'web'
                  ? ({ onClick: () => setEraserRadius(item.radius) } as any)
                  : {})}
              >
                <Text
                  style={[
                    styles.subShapeBtnText,
                    eraserRadius === item.radius && styles.subShapeBtnTextActive,
                  ]}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}

            <View style={{ width: 1, height: 16, backgroundColor: '#E2E8F0', marginHorizontal: 4 }} />

            {/* Goodnotes 6 & Notewise 시그니처: 형광펜만 지우기 토글 (일반 펜 글씨 보호) */}
            <TouchableOpacity
              style={[
                styles.eraserHighlighterOnlyBtn,
                eraseHighlighterOnly && styles.eraserHighlighterOnlyBtnActive,
              ]}
              onPress={() => {
                setEraseHighlighterOnly((prev) => {
                  const next = !prev;
                  setExportToastMessage(
                    next
                      ? '🖍️ 형광펜만 지우기 모드 (일반 펜 글씨 보호)'
                      : '🧹 전체 필기 지우기 모드'
                  );
                  setTimeout(() => setExportToastMessage(null), 1800);
                  return next;
                });
              }}
              {...(Platform.OS === 'web'
                ? ({
                    onClick: () => {
                      setEraseHighlighterOnly((prev) => {
                        const next = !prev;
                        setExportToastMessage(
                          next
                            ? '🖍️ 형광펜만 지우기 모드 (일반 펜 글씨 보호)'
                            : '🧹 전체 필기 지우기 모드'
                        );
                        setTimeout(() => setExportToastMessage(null), 1800);
                        return next;
                      });
                    },
                  } as any)
                : {})}
            >
              <Highlighter size={12} color={eraseHighlighterOnly ? '#D97706' : '#64748B'} />
              <Text
                style={[
                  styles.eraserHighlighterOnlyText,
                  eraseHighlighterOnly && styles.eraserHighlighterOnlyTextActive,
                ]}
              >
                형광펜만 {eraseHighlighterOnly ? 'ON' : 'OFF'}
              </Text>
            </TouchableOpacity>

            <View style={{ width: 1, height: 16, backgroundColor: '#E2E8F0', marginHorizontal: 4 }} />

            {/* Notewise: 지운 후 펜 자동 복귀 토글 */}
            <TouchableOpacity
              style={[styles.autoDeselectBtn, autoDeselectEraser && styles.autoDeselectBtnActive]}
              onPress={() => setAutoDeselectEraser((prev) => !prev)}
              {...(Platform.OS === 'web' ? ({ onClick: () => setAutoDeselectEraser((prev) => !prev) } as any) : {})}
            >
              <Zap size={12} color={autoDeselectEraser ? '#2563EB' : '#64748B'} />
              <Text style={[styles.autoDeselectText, autoDeselectEraser && styles.autoDeselectTextActive]}>
                자동 복귀
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.clearPageFloatingBtn}
              onPress={handleClearCurrentPageStrokes}
              {...(Platform.OS === 'web'
                ? ({ onClick: handleClearCurrentPageStrokes } as any)
                : {})}
            >
              <Trash2 size={13} color="#DC2626" />
              <Text style={styles.clearPageFloatingText}>전체 비우기</Text>
            </TouchableOpacity>
          </View>
        )}

        {activeTool === 'stamp' && (
          <View style={styles.subShapeToolbox}>
            <Stamp size={13} color="#DC2626" />
            <Text style={styles.subShapeLabel}>스탬프 선택 (클릭하여 찍기):</Text>
            {STAMP_PRESETS.map((preset, idx) => {
              const isCur = activeStampPresetIdx === idx;
              return (
                <TouchableOpacity
                  key={preset.label}
                  style={[
                    styles.subShapeBtn,
                    isCur && { backgroundColor: '#FEF2F2', borderColor: preset.color, borderWidth: 1 },
                  ]}
                  onPress={() => setActiveStampPresetIdx(idx)}
                >
                  <View
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: preset.color,
                    }}
                  />
                  <Text
                    style={[
                      styles.subShapeBtnText,
                      isCur && { color: preset.color, fontWeight: '800' },
                    ]}
                  >
                    {preset.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
            {pdfStamps.some((s) => s.pageIndex === currentPage) && (
              <TouchableOpacity
                style={styles.clearPageFloatingBtn}
                onPress={() =>
                  setPdfStamps((prev) => prev.filter((s) => s.pageIndex !== currentPage))
                }
              >
                <Trash2 size={12} color="#DC2626" />
                <Text style={styles.clearPageFloatingText}>P.{currentPage} 스탬프 지우기</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {activeTool === 'redact' && (
          <View style={styles.subShapeToolbox}>
            <EyeOff size={13} color="#09090B" />
            <Text style={styles.subShapeLabel}>
              ⬛ 민감정보 먹칠(Redaction): 가릴 영역을 드래그하세요 (블록 발췌 및 PDF 저장 시 영구 마스킹)
            </Text>
            {pdfRedactions.some((r) => r.pageIndex === currentPage) && (
              <TouchableOpacity
                style={styles.clearPageFloatingBtn}
                onPress={() =>
                  setPdfRedactions((prev) => prev.filter((r) => r.pageIndex !== currentPage))
                }
              >
                <Trash2 size={12} color="#DC2626" />
                <Text style={styles.clearPageFloatingText}>P.{currentPage} 먹칠 해제</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* 활성 도구 안내 뱃지 (레이저 포인터 / 직사각형 선택 / 댓글 핀 모드) */}
        {activeTool === 'comment' && (
          <View style={styles.toolGuideBadgeBlue}>
            <MessageSquare size={13} color="#2563EB" />
            <Text style={styles.toolGuideBadgeBlueText}>
              💬 스레드 댓글 핀 모드: 문서 위 원하는 위치를 클릭하면 댓글 핀이 찍히고 우측 스레드 창이 열립니다
            </Text>
          </View>
        )}
        {activeTool === 'laser' && (
          <View style={styles.toolGuideBadgeRed}>
            <Presentation size={13} color="#EF4444" />
            <Text style={styles.toolGuideBadgeRedText}>
              🎯 프레젠테이션 레이저: 발표 중 강조용 도구 (0.5초 후 자동 소멸)
            </Text>
          </View>
        )}
        {activeTool === 'lasso' && (
          <View style={styles.toolGuideBadgeBlue}>
            <BoxSelect size={13} color="#2563EB" />
            <Text style={styles.toolGuideBadgeBlueText}>
              📦 직사각형 선택 도구: 드래그하여 사각 영역 안의 필기를 묶어서 선택/이동
            </Text>
          </View>
        )}
        {activeTool === 'snippet' && (
          <View style={styles.toolGuideBadgeAmber}>
            <Crop size={13} color="#D97706" />
            <Text style={styles.toolGuideBadgeAmberText}>
              ✂️ PDF 블록 발췌/복사: 원하는 영역을 드래그하면 클립보드 복사 · 새 노트로 가져오기 · 기존 노트 추가 가능
            </Text>
          </View>
        )}
        {isSpacePanning && activeTool !== 'hand' && (
          <View style={styles.toolGuideBadgeBlue}>
            <Hand size={13} color="#059669" />
            <Text style={[styles.toolGuideBadgeBlueText, { color: '#047857' }]}>
              ✋ Space 임시 손바닥 모드: 드래그하여 화면을 부드럽게 스크롤하세요 (키를 떼면 이전 펜 복귀)
            </Text>
          </View>
        )}

        {/* 메인 툴박스 알약 바 */}
        <View style={styles.floatingToolboxPill}>
          {/* 1. 손바닥 탐색 (Flexcil / Goodnotes 제스처/뷰어 모드) */}
          <TouchableOpacity
            style={[styles.toolBtn, activeTool === 'hand' && styles.toolBtnActiveGreen]}
            onPress={() => setActiveTool('hand')}
          >
            <Hand size={19} color={activeTool === 'hand' ? '#FFFFFF' : '#1E293B'} />
          </TouchableOpacity>

          {/* 2. 만년필 (Fountain) */}
          <TouchableOpacity
            style={[styles.toolBtn, activeTool === 'fountain' && styles.toolBtnActive]}
            onPress={() => setActiveTool('fountain')}
          >
            <PenTool size={19} color={activeTool === 'fountain' ? '#FFFFFF' : '#1E293B'} />
          </TouchableOpacity>

          {/* 3. 형광펜 (Highlighter) */}
          <TouchableOpacity
            style={[styles.toolBtn, activeTool === 'highlighter' && styles.toolBtnActiveHighlighter]}
            onPress={() => setActiveTool('highlighter')}
          >
            <Highlighter size={19} color={activeTool === 'highlighter' ? '#FFFFFF' : '#1E293B'} />
          </TouchableOpacity>

          {/* 4. 지우개 (Eraser) */}
          <TouchableOpacity
            style={[styles.toolBtn, activeTool === 'eraser' && styles.toolBtnActiveEraser]}
            onPress={() => setActiveTool('eraser')}
          >
            <Eraser size={19} color={activeTool === 'eraser' ? '#FFFFFF' : '#1E293B'} />
          </TouchableOpacity>

          {/* 5. 도형 그리기 (Shapes) */}
          <TouchableOpacity
            style={[styles.toolBtn, activeTool === 'shape' && styles.toolBtnActive]}
            onPress={() => setActiveTool('shape')}
          >
            <Square size={19} color={activeTool === 'shape' ? '#FFFFFF' : '#1E293B'} />
          </TouchableOpacity>

          {/* 6. 텍스트 박스 삽입 (Type / Text) */}
          <TouchableOpacity
            style={[styles.toolBtn, activeTool === 'text' && styles.toolBtnActive]}
            onPress={() => setActiveTool('text')}
          >
            <Type size={19} color={activeTool === 'text' ? '#FFFFFF' : '#1E293B'} />
          </TouchableOpacity>

          {/* 7. 직사각형 영역 선택 (Rectangular Selection - Goodnotes / Notewise 스타일) */}
          <TouchableOpacity
            style={[styles.toolBtn, activeTool === 'lasso' && styles.toolBtnActiveLasso]}
            onPress={() => {
              setActiveTool('lasso');
              setSelectedStrokeIds([]);
              setSelectionBBox(null);
              setCapturedBlockRect(null);
              setCapturedBlockResult(null);
              setExportToastMessage('📦 직사각형 선택: 드래그하여 사각 영역 안의 필기를 선택합니다.');
              setTimeout(() => setExportToastMessage(null), 2500);
            }}
            {...(Platform.OS === 'web'
              ? ({ title: '직사각형 영역 선택 (드래그하여 객체 선택 및 이동)' } as any)
              : {})}
          >
            <BoxSelect size={19} color={activeTool === 'lasso' ? '#FFFFFF' : '#1E293B'} />
          </TouchableOpacity>

          {/* 8. Flexcil 스타일 PDF 영역 블록 발췌/복사 & 노트로 가져오기 (Snippet Capture) */}
          <TouchableOpacity
            style={[styles.toolBtn, activeTool === 'snippet' && styles.toolBtnActiveSnippet]}
            onPress={() => {
              setActiveTool('snippet');
              setSelectedStrokeIds([]);
              setSelectionBBox(null);
              setExportToastMessage(
                '✂️ 블록 발췌 모드: PDF 영역을 드래그하여 복사하거나 노트로 바로 가져오세요!'
              );
              setTimeout(() => setExportToastMessage(null), 2800);
            }}
            {...(Platform.OS === 'web'
              ? ({ title: 'PDF 블록 지정 복사 및 노트로 가져오기 (Flexcil 스타일)' } as any)
              : {})}
          >
            <Crop size={19} color={activeTool === 'snippet' ? '#FFFFFF' : '#D97706'} />
          </TouchableOpacity>

          {/* 9. 스탬프 도구 (승인 / 초안 / 검토 완료 / 중요 / 기밀) */}
          <TouchableOpacity
            style={[
              styles.toolBtn,
              activeTool === 'stamp' && { backgroundColor: '#DC2626' },
            ]}
            onPress={() => {
              setActiveTool('stamp');
              setSelectedStrokeIds([]);
              setSelectionBBox(null);
            }}
            {...(Platform.OS === 'web'
              ? ({ title: '공식 스탬프 찍기 (승인 / 초안 / 검토 완료 / 기밀)' } as any)
              : {})}
          >
            <Stamp size={18} color={activeTool === 'stamp' ? '#FFFFFF' : '#DC2626'} />
          </TouchableOpacity>

          {/* 10. 민감정보 먹칠/가림 도구 (Redaction) */}
          <TouchableOpacity
            style={[
              styles.toolBtn,
              activeTool === 'redact' && { backgroundColor: '#09090B' },
            ]}
            onPress={() => {
              setActiveTool('redact');
              setSelectedStrokeIds([]);
              setSelectionBBox(null);
            }}
            {...(Platform.OS === 'web'
              ? ({ title: '민감정보 먹칠/가림 (드래그하여 영구 마스킹)' } as any)
              : {})}
          >
            <EyeOff size={18} color={activeTool === 'redact' ? '#FFFFFF' : '#0F172A'} />
          </TouchableOpacity>

          {/* 11. 위치 기반 스레드 댓글 핀 도구 */}
          <TouchableOpacity
            style={[
              styles.toolBtn,
              activeTool === 'comment' && { backgroundColor: '#2563EB' },
            ]}
            onPress={() => {
              setActiveTool('comment');
              setIsCommentsDrawerOpen(true);
            }}
            {...(Platform.OS === 'web'
              ? ({ title: '위치 기반 스레드 댓글 핀 추가' } as any)
              : {})}
          >
            <MessageSquare size={18} color={activeTool === 'comment' ? '#FFFFFF' : '#2563EB'} />
          </TouchableOpacity>

          {/* 12. 프레젠테이션 레이저 포인터 (발표/강조용: 0.5초 후 자동 소멸) */}
          <TouchableOpacity
            style={[styles.toolBtn, activeTool === 'laser' && styles.toolBtnActiveLaser]}
            onPress={() => {
              setActiveTool('laser');
              setSelectedStrokeIds([]);
              setSelectionBBox(null);
              setCapturedBlockRect(null);
              setCapturedBlockResult(null);
              setExportToastMessage('🎯 프레젠테이션 레이저: 발표 중 강조용 도구로, 필기선이 0.5초 후 자동으로 사라집니다.');
              setTimeout(() => setExportToastMessage(null), 3500);
            }}
            {...(Platform.OS === 'web'
              ? ({ title: '프레젠테이션 레이저 포인터 (발표 중 중요한 부분을 가리키면 0.5초 후 자동 소멸)' } as any)
              : {})}
          >
            <Presentation size={19} color={activeTool === 'laser' ? '#FFFFFF' : '#EF4444'} />
          </TouchableOpacity>

          <View style={styles.toolboxDivider} />

          {/* Goodnotes / Notewise 시그니처 3-Slot 즐겨찾기 펜 랙 (Pen Preset Rack) */}
          <View style={styles.quickPenPresetGroup}>
            {penPresets.map((preset, idx) => {
              const isSlotActive =
                activePresetIndex === idx &&
                (activeTool === preset.tool ||
                  (preset.tool === 'fountain' && activeTool === 'fountain') ||
                  (preset.tool === 'pen' && activeTool === 'pen') ||
                  (preset.tool === 'highlighter' && activeTool === 'highlighter'));
              return (
                <TouchableOpacity
                  key={preset.id}
                  style={[styles.penPresetPill, isSlotActive && styles.penPresetPillActive]}
                  onPress={() => {
                    setActivePresetIndex(idx);
                    setActiveTool(preset.tool);
                    setColorSlots((prev) => {
                      const next = [...prev];
                      next[activeColorSlot] = preset.color;
                      return next;
                    });
                    setStrokeWidth(preset.width);
                  }}
                  onLongPress={() => setEditingPresetIndex(idx)}
                  {...(Platform.OS === 'web'
                    ? ({
                        onClick: () => {
                          if (isSlotActive) {
                            setEditingPresetIndex(idx);
                          } else {
                            setActivePresetIndex(idx);
                            setActiveTool(preset.tool);
                            setColorSlots((prev) => {
                              const next = [...prev];
                              next[activeColorSlot] = preset.color;
                              return next;
                            });
                            setStrokeWidth(preset.width);
                          }
                        },
                      } as any)
                    : {})}
                >
                  <View style={[styles.penPresetColorDot, { backgroundColor: preset.color }]} />
                  {preset.tool === 'highlighter' ? (
                    <Highlighter size={12} color={isSlotActive ? '#2563EB' : '#64748B'} />
                  ) : (
                    <PenTool size={12} color={isSlotActive ? '#2563EB' : '#64748B'} />
                  )}
                  <Text
                    style={[
                      styles.penPresetWidthText,
                      isSlotActive && styles.penPresetWidthTextActive,
                    ]}
                  >
                    {preset.width}px
                  </Text>
                </TouchableOpacity>
              );
            })}
            {/* 커스텀 색상 팔레트 열기 */}
            <TouchableOpacity
              style={styles.paletteTriggerBtn}
              onPress={() => setIsColorPickerOpen((prev) => !prev)}
              {...(Platform.OS === 'web' ? ({ onClick: () => setIsColorPickerOpen((prev) => !prev) } as any) : {})}
            >
              <Palette size={16} color="#64748B" />
            </TouchableOpacity>
          </View>

          <View style={styles.toolboxDivider} />

          {/* Goodnotes / Notewise 시그니처 Thickness Slot Presets */}
          <View style={styles.widthSelectorGroup}>
            {(activeTool === 'highlighter' ? [12, 22, 36] : [2, 3, 5, 8]).map((w) => (
              <TouchableOpacity
                key={w}
                style={[styles.widthCircle, strokeWidth === w && styles.widthCircleSelected]}
                onPress={() => {
                  setStrokeWidth(w);
                  if (activePresetIndex !== null) {
                    setPenPresets((prev) =>
                      prev.map((p, i) => (i === activePresetIndex ? { ...p, width: w } : p))
                    );
                  }
                }}
                {...(Platform.OS === 'web'
                  ? ({
                      onClick: () => {
                        setStrokeWidth(w);
                        if (activePresetIndex !== null) {
                          setPenPresets((prev) =>
                            prev.map((p, i) => (i === activePresetIndex ? { ...p, width: w } : p))
                          );
                        }
                      },
                    } as any)
                  : {})}
              >
                <View
                  style={{
                    width:
                      activeTool === 'highlighter'
                        ? w === 12
                          ? 7
                          : w === 22
                          ? 11
                          : 15
                        : w === 2
                        ? 4
                        : w === 3
                        ? 6
                        : w === 5
                        ? 8
                        : 11,
                    height:
                      activeTool === 'highlighter'
                        ? w === 12
                          ? 7
                          : w === 22
                          ? 11
                          : 15
                        : w === 2
                        ? 4
                        : w === 3
                        ? 6
                        : w === 5
                        ? 8
                        : 11,
                    borderRadius: 8,
                    backgroundColor: strokeWidth === w ? '#2563EB' : '#64748B',
                  }}
                />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* 색상 팔레트 팝오버 */}
        {isColorPickerOpen && (
          <View style={styles.colorPopover}>
            <View style={styles.paletteRow}>
              {PALETTE_COLORS.map((item) => (
                <TouchableOpacity
                  key={item.color}
                  style={[
                    styles.paletteDot,
                    { backgroundColor: item.color },
                    strokeColor === item.color && styles.paletteDotSelected,
                  ]}
                  onPress={() => {
                    setColorSlots((prev) => {
                      const next = [...prev];
                      next[activeColorSlot] = item.color;
                      return next;
                    });
                    if (activePresetIndex !== null) {
                      setPenPresets((prev) =>
                        prev.map((p, i) => (i === activePresetIndex ? { ...p, color: item.color } : p))
                      );
                    }
                    setIsColorPickerOpen(false);
                  }}
                  {...(Platform.OS === 'web'
                    ? ({
                        onClick: () => {
                          setColorSlots((prev) => {
                            const next = [...prev];
                            next[activeColorSlot] = item.color;
                            return next;
                          });
                          if (activePresetIndex !== null) {
                            setPenPresets((prev) =>
                              prev.map((p, i) => (i === activePresetIndex ? { ...p, color: item.color } : p))
                            );
                          }
                          setIsColorPickerOpen(false);
                        },
                      } as any)
                    : {})}
                >
                  {strokeColor === item.color && <Check size={12} color="#FFFFFF" strokeWidth={3} />}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
      </View>
      )}

      {/* 4. 공유 및 내보내기 팝업 모달 (Goodnotes & Notewise 내보내기 1:1) */}
      <Modal
        visible={isExportModalOpen}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsExportModalOpen(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setIsExportModalOpen(false)}
        >
          <View style={styles.exportModalCard} onStartShouldSetResponder={() => true}>
            <View style={styles.exportModalHeader}>
              <View style={styles.exportModalTitleRow}>
                <Share2 size={18} color="#2563EB" />
                <Text style={styles.exportModalTitle}>문서 공유 및 내보내기</Text>
              </View>
              <TouchableOpacity
                onPress={() => setIsExportModalOpen(false)}
                {...(Platform.OS === 'web' ? ({ onClick: () => setIsExportModalOpen(false) } as any) : {})}
              >
                <X size={18} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            <Text style={styles.exportModalSubtitle}>
              현재 작업 중인 문서({title})와 주석 데이터를 다양한 형식으로 내보냅니다.
            </Text>

            <View style={styles.exportOptionsList}>
              <TouchableOpacity
                style={[styles.exportOptionItem, { borderColor: '#FECACA', backgroundColor: '#FEF2F2' }]}
                onPress={handleExportRealPdfBinary}
              >
                <View style={[styles.exportOptionIconBox, { backgroundColor: '#FEE2E2' }]}>
                  <FileDown size={20} color="#DC2626" />
                </View>
                <View style={styles.exportOptionTextBox}>
                  <Text style={[styles.exportOptionTitle, { color: '#991B1B' }]}>
                    실제 PDF 파일로 저장 (.pdf 바이너리 다운로드)
                  </Text>
                  <Text style={styles.exportOptionDesc}>
                    원본 PDF 페이지, 필기, 도형, 스탬프, 워터마크, 머리글, 먹칠이 모두 반영된 정식 .pdf 파일을 즉시 다운로드합니다.
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.exportOptionItem}
                onPress={handleExportCurrentPagePng}
              >
                <View style={[styles.exportOptionIconBox, { backgroundColor: '#FEF3C7' }]}>
                  <ImageDown size={20} color="#D97706" />
                </View>
                <View style={styles.exportOptionTextBox}>
                  <Text style={styles.exportOptionTitle}>
                    현재 페이지(P.{currentPage}) 고해상도 PNG 이미지 저장 (.png)
                  </Text>
                  <Text style={styles.exportOptionDesc}>
                    현재 페이지와 모든 주석을 2x HiDPI 고화질 PNG 이미지 파일로 내보냅니다.
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.exportOptionItem}
                onPress={handleExportPdfOrPrint}
                {...(Platform.OS === 'web' ? ({ onClick: handleExportPdfOrPrint } as any) : {})}
              >
                <View style={[styles.exportOptionIconBox, { backgroundColor: '#EFF6FF' }]}>
                  <Printer size={20} color="#2563EB" />
                </View>
                <View style={styles.exportOptionTextBox}>
                  <Text style={styles.exportOptionTitle}>브라우저 인쇄 대화상자 열기</Text>
                  <Text style={styles.exportOptionDesc}>시스템 인쇄창을 열어 프린터로 직접 출력합니다.</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.exportOptionItem}
                onPress={handleCopyDocumentContent}
                {...(Platform.OS === 'web' ? ({ onClick: handleCopyDocumentContent } as any) : {})}
              >
                <View style={[styles.exportOptionIconBox, { backgroundColor: '#F0FDF4' }]}>
                  <Copy size={20} color="#16A34A" />
                </View>
                <View style={styles.exportOptionTextBox}>
                  <Text style={styles.exportOptionTitle}>문서 텍스트 및 주석 전체 복사</Text>
                  <Text style={styles.exportOptionDesc}>문서 본문과 작성한 모든 텍스트 상자 주석을 클립보드에 텍스트로 복사합니다.</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.exportOptionItem}
                onPress={handleExportBackupJson}
                {...(Platform.OS === 'web' ? ({ onClick: handleExportBackupJson } as any) : {})}
              >
                <View style={[styles.exportOptionIconBox, { backgroundColor: '#FAF5FF' }]}>
                  <Download size={20} color="#9333EA" />
                </View>
                <View style={styles.exportOptionTextBox}>
                  <Text style={styles.exportOptionTitle}>데이터 백업 파일(JSON) 다운로드</Text>
                  <Text style={styles.exportOptionDesc}>모든 벡터 스트로크 좌표, 도형, 텍스트 상자 및 음성 녹음 데이터를 보존합니다.</Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* 5. 페이지 직접 점프 모달 (Jump to Page Dialog) */}
      <Modal
        visible={isPageJumpModalOpen}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsPageJumpModalOpen(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setIsPageJumpModalOpen(false)}
        >
          <View style={styles.pageJumpModalCard} onStartShouldSetResponder={() => true}>
            <View style={styles.exportModalHeader}>
              <Text style={styles.exportModalTitle}>페이지 바로가기</Text>
              <TouchableOpacity
                onPress={() => setIsPageJumpModalOpen(false)}
                {...(Platform.OS === 'web' ? ({ onClick: () => setIsPageJumpModalOpen(false) } as any) : {})}
              >
                <X size={18} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            <Text style={styles.exportModalSubtitle}>
              이동할 페이지 번호를 선택하거나 직접 입력하세요. (1 ~ {totalPages})
            </Text>

            {/* 빠른 번호 버튼들 */}
            <View style={styles.pageNumberBtnRow}>
              {Array.from({ length: totalPages }).map((_, idx) => {
                const pNum = idx + 1;
                const isCur = pNum === currentPage;
                return (
                  <TouchableOpacity
                    key={pNum}
                    style={[styles.pageQuickBtn, isCur && styles.pageQuickBtnActive]}
                    onPress={() => handleJumpToPage(pNum)}
                    {...(Platform.OS === 'web' ? ({ onClick: () => handleJumpToPage(pNum) } as any) : {})}
                  >
                    <Text style={[styles.pageQuickBtnText, isCur && styles.pageQuickBtnTextActive]}>
                      P.{pNum}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* 직접 번호 입력 */}
            <View style={styles.pageJumpInputRow}>
              <TextInput
                style={styles.pageJumpInput}
                placeholder={`1 ~ ${totalPages}`}
                placeholderTextColor="#94A3B8"
                keyboardType="numeric"
                value={jumpPageInput}
                onChangeText={setJumpPageInput}
              />
              <TouchableOpacity
                style={styles.pageJumpSubmitBtn}
                onPress={() => {
                  const num = parseInt(jumpPageInput, 10);
                  if (!isNaN(num)) handleJumpToPage(num);
                }}
                {...(Platform.OS === 'web'
                  ? ({
                      onClick: () => {
                        const num = parseInt(jumpPageInput, 10);
                        if (!isNaN(num)) handleJumpToPage(num);
                      },
                    } as any)
                  : {})}
              >
                <Text style={styles.pageJumpSubmitText}>이동</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* 6. 새 페이지 양식/속지 선택 모달 (Goodnotes & Notewise 페이지 추가 템플릿) */}
      <Modal
        visible={isAddPageTemplateModalOpen}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsAddPageTemplateModalOpen(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setIsAddPageTemplateModalOpen(false)}
        >
          <View style={styles.templatePickerModalCard} onStartShouldSetResponder={() => true}>
            <View style={styles.exportModalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <BookOpen size={18} color="#2563EB" />
                <Text style={styles.exportModalTitle}>새 페이지 추가 양식</Text>
              </View>
              <TouchableOpacity
                onPress={() => setIsAddPageTemplateModalOpen(false)}
                {...(Platform.OS === 'web' ? ({ onClick: () => setIsAddPageTemplateModalOpen(false) } as any) : {})}
              >
                <X size={18} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            <Text style={styles.exportModalSubtitle}>
              새로 생성할 {totalPages + 1}번 페이지의 용지 템플릿을 선택하세요.
            </Text>

            <View style={styles.templateChoicesGrid}>
              {[
                { id: 'blank' as PaperTemplate, name: '무지 (Blank)', desc: '자유로운 백지 스케치', icon: '📄' },
                { id: 'lined' as PaperTemplate, name: '줄노트 (Lined)', desc: '단정한 줄글 필기', icon: '📝' },
                { id: 'grid' as PaperTemplate, name: '모눈종이 (Grid)', desc: '도형 및 표, 수식 필기', icon: '📐' },
                { id: 'cornell' as PaperTemplate, name: '코넬 노트 (Cornell)', desc: '핵심어/필기/요약 3단', icon: '🎓' },
                { id: 'dark' as PaperTemplate, name: '다크 칠판 (Dark)', desc: '눈이 편한 칠판 모드', icon: '🌑' },
              ].map((tmpl) => (
                <TouchableOpacity
                  key={tmpl.id}
                  style={styles.templateChoiceCard}
                  onPress={() => handleAddNewPageWithTemplate(tmpl.id)}
                  {...(Platform.OS === 'web' ? ({ onClick: () => handleAddNewPageWithTemplate(tmpl.id) } as any) : {})}
                >
                  <Text style={styles.templateChoiceEmoji}>{tmpl.icon}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.templateChoiceName}>{tmpl.name}</Text>
                    <Text style={styles.templateChoiceDesc}>{tmpl.desc}</Text>
                  </View>
                  <ChevronRight size={16} color="#94A3B8" />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* 7. 즐겨찾기 펜 슬롯 커스텀 모달 (Goodnotes & Notewise 스타일) */}
      <Modal
        visible={editingPresetIndex !== null}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setEditingPresetIndex(null)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setEditingPresetIndex(null)}
        >
          <View style={styles.presetModalCard} onStartShouldSetResponder={() => true}>
            <View style={styles.exportModalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <PenTool size={18} color="#2563EB" />
                <Text style={styles.exportModalTitle}>
                  즐겨찾기 펜 #{editingPresetIndex !== null ? editingPresetIndex + 1 : 1} 설정
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setEditingPresetIndex(null)}
                {...(Platform.OS === 'web' ? ({ onClick: () => setEditingPresetIndex(null) } as any) : {})}
              >
                <X size={18} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            {editingPresetIndex !== null && penPresets[editingPresetIndex] && (
              <View style={{ gap: 14, marginTop: 6 }}>
                {/* 1. 도구 종류 선택 */}
                <View>
                  <Text style={styles.presetSectionLabel}>펜 유형</Text>
                  <View style={styles.presetToolRow}>
                    {(
                      [
                        { tool: 'fountain' as const, label: '만년필', icon: PenTool },
                        { tool: 'pen' as const, label: '볼펜', icon: PenTool },
                        { tool: 'highlighter' as const, label: '형광펜', icon: Highlighter },
                      ] as const
                    ).map((t) => {
                      const IconComp = t.icon;
                      const isSel = penPresets[editingPresetIndex].tool === t.tool;
                      return (
                        <TouchableOpacity
                          key={t.tool}
                          style={[styles.presetToolBtn, isSel && styles.presetToolBtnActive]}
                          onPress={() => {
                            setPenPresets((prev) =>
                              prev.map((p, i) =>
                                i === editingPresetIndex ? { ...p, tool: t.tool, label: t.label } : p
                              )
                            );
                            if (activePresetIndex === editingPresetIndex) {
                              setActiveTool(t.tool);
                            }
                          }}
                          {...(Platform.OS === 'web'
                            ? ({
                                onClick: () => {
                                  setPenPresets((prev) =>
                                    prev.map((p, i) =>
                                      i === editingPresetIndex ? { ...p, tool: t.tool, label: t.label } : p
                                    )
                                  );
                                  if (activePresetIndex === editingPresetIndex) {
                                    setActiveTool(t.tool);
                                  }
                                },
                              } as any)
                            : {})}
                        >
                          <IconComp size={15} color={isSel ? '#2563EB' : '#64748B'} />
                          <Text style={[styles.presetToolBtnText, isSel && styles.presetToolBtnTextActive]}>
                            {t.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {/* 2. 잉크 색상 선택 */}
                <View>
                  <Text style={styles.presetSectionLabel}>잉크 색상</Text>
                  <View style={styles.paletteRow}>
                    {PALETTE_COLORS.map((item) => {
                      const isCurColor = penPresets[editingPresetIndex].color === item.color;
                      return (
                        <TouchableOpacity
                          key={item.color}
                          style={[
                            styles.paletteDot,
                            { backgroundColor: item.color },
                            isCurColor && styles.paletteDotSelected,
                          ]}
                          onPress={() => {
                            setPenPresets((prev) =>
                              prev.map((p, i) =>
                                i === editingPresetIndex ? { ...p, color: item.color } : p
                              )
                            );
                            if (activePresetIndex === editingPresetIndex) {
                              setColorSlots((slots) => {
                                const next = [...slots];
                                next[activeColorSlot] = item.color;
                                return next;
                              });
                            }
                          }}
                          {...(Platform.OS === 'web'
                            ? ({
                                onClick: () => {
                                  setPenPresets((prev) =>
                                    prev.map((p, i) =>
                                      i === editingPresetIndex ? { ...p, color: item.color } : p
                                    )
                                  );
                                  if (activePresetIndex === editingPresetIndex) {
                                    setColorSlots((slots) => {
                                      const next = [...slots];
                                      next[activeColorSlot] = item.color;
                                      return next;
                                    });
                                  }
                                },
                              } as any)
                            : {})}
                        >
                          {isCurColor && <Check size={12} color="#FFFFFF" strokeWidth={3} />}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {/* 3. 획 굵기 선택 */}
                <View>
                  <Text style={styles.presetSectionLabel}>
                    선 굵기: {penPresets[editingPresetIndex].width}px
                  </Text>
                  <View style={styles.presetWidthRow}>
                    {[1, 2, 4, 8, 14, 22].map((w) => {
                      const isSel = penPresets[editingPresetIndex].width === w;
                      return (
                        <TouchableOpacity
                          key={w}
                          style={[styles.presetWidthBtn, isSel && styles.presetWidthBtnActive]}
                          onPress={() => {
                            setPenPresets((prev) =>
                              prev.map((p, i) =>
                                i === editingPresetIndex ? { ...p, width: w } : p
                              )
                            );
                            if (activePresetIndex === editingPresetIndex) {
                              setStrokeWidth(w);
                            }
                          }}
                          {...(Platform.OS === 'web'
                            ? ({
                                onClick: () => {
                                  setPenPresets((prev) =>
                                    prev.map((p, i) =>
                                      i === editingPresetIndex ? { ...p, width: w } : p
                                    )
                                  );
                                  if (activePresetIndex === editingPresetIndex) {
                                    setStrokeWidth(w);
                                  }
                                },
                              } as any)
                            : {})}
                        >
                          <Text style={[styles.presetWidthBtnText, isSel && styles.presetWidthBtnTextActive]}>
                            {w}px
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {/* 확인 버튼 */}
                <TouchableOpacity
                  style={styles.presetSaveConfirmBtn}
                  onPress={() => {
                    setEditingPresetIndex(null);
                    setExportToastMessage('펜 슬롯 설정이 저장되었습니다.');
                    setTimeout(() => setExportToastMessage(null), 1800);
                  }}
                  {...(Platform.OS === 'web'
                    ? ({
                        onClick: () => {
                          setEditingPresetIndex(null);
                          setExportToastMessage('펜 슬롯 설정이 저장되었습니다.');
                          setTimeout(() => setExportToastMessage(null), 1800);
                        },
                      } as any)
                    : {})}
                >
                  <Check size={16} color="#FFFFFF" />
                  <Text style={styles.presetSaveConfirmText}>설정 완료</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Stage 2 PDF 워크벤치 오버레이 모달 (Ctrl+K 명령 팔레트, 워터마크·머리글, 속성·통계, PDF 비교) */}
      <PdfCommandPaletteModal
        visible={isCommandPaletteOpen}
        commands={commandPaletteItems}
        onClose={() => setIsCommandPaletteOpen(false)}
      />

      <PdfWatermarkHeaderModal
        visible={isWatermarkModalOpen}
        watermark={pdfWatermark}
        headerFooter={pdfHeaderFooter}
        onChangeWatermark={setPdfWatermark}
        onChangeHeaderFooter={setPdfHeaderFooter}
        onClose={() => setIsWatermarkModalOpen(false)}
      />

      <PdfPropertiesStatsModal
        visible={isPropertiesModalOpen}
        title={title}
        currentPage={currentPage}
        meta={pdfMeta}
        stats={documentWordStats}
        onChangeTitle={setTitle}
        onChangeMeta={setPdfMeta}
        onClose={() => setIsPropertiesModalOpen(false)}
      />

      <PdfCompareModal
        visible={isCompareModalOpen}
        currentTitle={title}
        currentPages={pdfPages}
        allNotes={notes}
        currentNoteId={activeNoteId}
        onClose={() => setIsCompareModalOpen(false)}
      />

      {/* 8. 알림 토스트 배너 */}
      {exportToastMessage && (
        <View style={styles.toastBanner}>
          <CheckCheck size={16} color="#FFFFFF" />
          <Text style={styles.toastText}>{exportToastMessage}</Text>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  workspaceContainer: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  topNavigationBar: {
    height: 56,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    zIndex: 10,
  },
  navLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  backBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  docInfo: {
    flex: 1,
  },
  docTitleInput: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    paddingVertical: 0,
  },
  docSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  pageJumperPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 6,
  },
  pageBtn: {
    padding: 4,
  },
  pageBtnDisabled: {
    opacity: 0.4,
  },
  pageNumberText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
    minWidth: 42,
    textAlign: 'center',
  },
  addPageBtn: {
    padding: 4,
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
    marginLeft: 4,
  },
  pageQuickActionBtn: {
    padding: 5,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    marginLeft: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    justifyContent: 'flex-end',
    flex: 1,
  },
  actionBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
  },
  actionBtnDisabled: {
    opacity: 0.4,
  },
  actionBtnActiveBlue: {
    backgroundColor: '#EFF6FF',
    borderColor: '#93C5FD',
    borderWidth: 1,
  },
  recordingActiveBtn: {
    backgroundColor: '#FEE2E2',
  },
  overviewActiveBtn: {
    backgroundColor: '#EFF6FF',
  },
  saveExitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#2563EB',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    marginLeft: 4,
  },
  saveExitText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  inDocSearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    gap: 10,
    zIndex: 9,
  },
  inDocSearchInput: {
    flex: 1,
    maxWidth: 240,
    height: 32,
    backgroundColor: '#F1F5F9',
    borderRadius: 6,
    paddingHorizontal: 10,
    fontSize: 13,
    color: '#0F172A',
  },
  searchMatchBadgeList: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  searchMatchPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  searchMatchPillActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  searchMatchPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1D4ED8',
  },
  searchMatchPillTextActive: {
    color: '#FFFFFF',
  },
  searchNoMatchText: {
    fontSize: 12,
    color: '#94A3B8',
  },
  searchPromptText: {
    fontSize: 12,
    color: '#64748B',
  },
  templateSelectionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    gap: 8,
    zIndex: 9,
  },
  templateSelectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  templateOptionBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  templateOptionBtnActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  templateOptionText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#334155',
  },
  templateOptionTextActive: {
    color: '#FFFFFF',
  },
  handModeNoticeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ECFDF5',
    paddingVertical: 4,
    paddingHorizontal: 12,
    gap: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#A7F3D0',
    zIndex: 9,
  },
  handModeNoticeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#065F46',
  },
  audioFloatingWrapper: {
    position: 'absolute',
    top: 60,
    left: 20,
    right: 20,
    zIndex: 99,
  },
  workspaceBody: {
    flex: 1,
    flexDirection: 'row',
  },
  thumbnailSidebar: {
    width: 220,
    backgroundColor: '#1E293B',
    borderRightWidth: 1,
    borderRightColor: '#334155',
    padding: 12,
  },
  thumbnailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  thumbnailHeaderText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  thumbnailList: {
    flex: 1,
  },
  thumbnailCard: {
    borderRadius: 8,
    backgroundColor: '#334155',
    padding: 8,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  thumbnailCardSelected: {
    borderColor: '#3B82F6',
    backgroundColor: '#1E3A8A',
  },
  thumbnailTouchArea: {
    width: '100%',
  },
  thumbnailMiniPage: {
    height: 110,
    backgroundColor: '#FFFFFF',
    borderRadius: 4,
    padding: 6,
    overflow: 'hidden',
  },
  thumbnailPageContent: {
    fontSize: 8,
    color: '#475569',
    lineHeight: 11,
  },
  thumbnailLabel: {
    fontSize: 11,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 6,
    fontWeight: '600',
  },
  thumbnailLabelSelected: {
    color: '#60A5FA',
    fontWeight: '700',
  },
  thumbnailActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 6,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  thumbnailActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  thumbnailActionText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#93C5FD',
  },
  addPageThumbnailBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    paddingVertical: 10,
    marginTop: 4,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderStyle: 'dashed',
  },
  addPageThumbnailText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2563EB',
  },
  canvasScrollView: {
    flex: 1,
    backgroundColor: '#334155',
  },
  canvasScrollContent: {
    alignItems: 'center',
    paddingTop: 24,
    paddingBottom: 140,
    paddingHorizontal: 16,
  },
  a4PageSheet: {
    width: '100%',
    maxWidth: 720,
    minHeight: 1018,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    position: 'relative',
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
      },
      android: {
        elevation: 12,
      },
      web: {
        boxShadow: '0 12px 36px rgba(0, 0, 0, 0.28)',
      },
    }),
  },
  pdfPageContent: {
    padding: 48,
  },
  pdfHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  pdfDocTag: {
    fontSize: 11,
    fontWeight: '800',
    color: '#2563EB',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  pdfPageTag: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 1.1,
  },
  pdfPageTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 8,
    lineHeight: 32,
  },
  pdfPageSubtitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 16,
  },
  pdfDivider: {
    height: 2,
    backgroundColor: '#E2E8F0',
    marginBottom: 24,
  },
  pdfBodyText: {
    fontSize: 15,
    color: '#334155',
    lineHeight: 26,
  },
  floatingToolboxContainer: {
    position: 'absolute',
    bottom: 24,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 50,
  },
  subShapeToolbox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    gap: 6,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
      },
      android: {
        elevation: 6,
      },
      web: {
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.15)',
      },
    }),
  },
  subShapeLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    marginRight: 2,
  },
  subShapeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
  },
  subShapeBtnActive: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#3B82F6',
  },
  subShapeBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  subShapeBtnTextActive: {
    color: '#2563EB',
    fontWeight: '700',
  },
  clearPageFloatingBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 18,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    ...Platform.select({
      web: {
        cursor: 'pointer',
      },
    }),
  },
  clearPageFloatingText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#DC2626',
  },
  toolGuideBadgeRed: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#FECACA',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  toolGuideBadgeRedText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#DC2626',
  },
  toolGuideBadgeBlue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  toolGuideBadgeBlueText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2563EB',
  },
  floatingToolboxPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 30,
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 10,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.25,
        shadowRadius: 16,
      },
      android: {
        elevation: 10,
      },
      web: {
        boxShadow: '0 8px 30px rgba(0, 0, 0, 0.25)',
      },
    }),
  },
  toolBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
  },
  toolBtnActive: {
    backgroundColor: '#2563EB',
  },
  toolBtnActiveGreen: {
    backgroundColor: '#059669',
  },
  toolBtnActiveHighlighter: {
    backgroundColor: '#D97706',
  },
  toolBtnActiveEraser: {
    backgroundColor: '#DC2626',
  },
  toolboxDivider: {
    width: 1,
    height: 22,
    backgroundColor: '#E2E8F0',
  },
  quickColorSlotGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  quickColorSlotCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  quickColorSlotCircleActive: {
    borderColor: '#2563EB',
    transform: [{ scale: 1.15 }],
  },
  quickColorInnerDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  paletteTriggerBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    marginLeft: 2,
  },
  widthSelectorGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  widthCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
  },
  widthCircleSelected: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1.5,
    borderColor: '#2563EB',
  },
  colorPopover: {
    position: 'absolute',
    bottom: 64,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
      web: {
        boxShadow: '0 6px 20px rgba(0, 0, 0, 0.2)',
      },
    }),
  },
  paletteRow: {
    flexDirection: 'row',
    gap: 8,
  },
  paletteDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
  },
  paletteDotSelected: {
    borderWidth: 2,
    borderColor: '#FFFFFF',
    transform: [{ scale: 1.15 }],
  },
  pageNumberTouchArea: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  exportModalCard: {
    width: '100%',
    maxWidth: 480,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 22,
    gap: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.25,
        shadowRadius: 20,
      },
      android: {
        elevation: 12,
      },
      web: {
        boxShadow: '0 20px 40px rgba(15, 23, 42, 0.25)',
      },
    }),
  },
  exportModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  exportModalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  exportModalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
  },
  exportModalSubtitle: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
  },
  exportOptionsList: {
    gap: 10,
  },
  exportOptionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 14,
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  exportOptionIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  exportOptionTextBox: {
    flex: 1,
    gap: 2,
  },
  exportOptionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
  },
  exportOptionDesc: {
    fontSize: 11,
    color: '#64748B',
    lineHeight: 15,
  },
  pageJumpModalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    gap: 14,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.2,
        shadowRadius: 16,
      },
      android: {
        elevation: 10,
      },
      web: {
        boxShadow: '0 16px 36px rgba(15, 23, 42, 0.22)',
      },
    }),
  },
  pageNumberBtnRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pageQuickBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  pageQuickBtnActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  pageQuickBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  pageQuickBtnTextActive: {
    color: '#FFFFFF',
  },
  pageJumpInputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  pageJumpInput: {
    flex: 1,
    height: 42,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 14,
    color: '#0F172A',
  },
  pageJumpSubmitBtn: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 18,
    height: 42,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pageJumpSubmitText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  toastBanner: {
    position: 'absolute',
    top: 70,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#0F172A',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 24,
    zIndex: 99999,
    ...Platform.select({
      web: {
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.25)',
      },
    }),
  },
  toastText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  bookmarkBtnActive: {
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
  },
  zoomControlGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 16,
    paddingHorizontal: 4,
    paddingVertical: 2,
    gap: 2,
    marginRight: 4,
  },
  zoomBtn: {
    padding: 4,
    borderRadius: 12,
  },
  zoomBtnActive: {
    backgroundColor: '#DBEAFE',
  },
  zoomLevelBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  zoomLevelText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  fullscreenFloatingExitBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    zIndex: 9999,
    backgroundColor: 'rgba(15, 23, 42, 0.88)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    ...Platform.select({
      web: {
        boxShadow: '0 4px 14px rgba(0,0,0,0.3)',
      },
    }),
  },
  fullscreenFloatingExitText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  toolBtnActiveLasso: {
    backgroundColor: '#4F46E5',
    shadowColor: '#4F46E5',
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 4,
  },
  toolBtnActiveLaser: {
    backgroundColor: '#EF4444',
    shadowColor: '#DC2626',
    shadowOpacity: 0.45,
    shadowRadius: 7,
    elevation: 5,
  },
  autoDeselectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
  },
  autoDeselectBtnActive: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#3B82F6',
  },
  autoDeselectText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  autoDeselectTextActive: {
    color: '#2563EB',
  },
  overviewFilterRow: {
    flexDirection: 'row',
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  overviewFilterChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  overviewFilterChipActive: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#3B82F6',
  },
  overviewFilterText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  overviewFilterTextActive: {
    color: '#2563EB',
    fontWeight: '700',
  },
  thumbnailBookmarkRibbon: {
    position: 'absolute',
    top: 3,
    right: 3,
    zIndex: 5,
  },
  emptyBookmarksBox: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  emptyBookmarksText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
    marginTop: 6,
  },
  emptyBookmarksSubtext: {
    fontSize: 11,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 16,
  },
  selectionBoxOverlay: {
    position: 'absolute',
    zIndex: 40,
  },
  selectionDashedBorder: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1.5,
    borderColor: '#2563EB',
    borderStyle: 'dashed',
    borderRadius: 4,
    backgroundColor: 'rgba(37, 99, 235, 0.05)',
  },
  selectionCornerHandle: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#2563EB',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  selectionFloatingToolbar: {
    position: 'absolute',
    top: -38,
    left: 0,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 4,
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 50,
    minWidth: 190,
  },
  selectionActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  selectionActionText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  selectionCloseBtn: {
    padding: 3,
    borderRadius: 4,
    marginLeft: 2,
  },
  // 1. 야간 모드 버튼 (Top Nav)
  nightModeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  nightModeBtnActive: {
    backgroundColor: '#0F172A',
    borderColor: '#334155',
  },
  nightModeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  nightModeTextActive: {
    color: '#F59E0B',
  },
  // 2. 야간 모드 PDF 페이지 스타일
  pdfPageContentDark: {
    backgroundColor: '#0F172A',
  },
  pdfDocTagDark: {
    backgroundColor: '#1E293B',
    color: '#94A3B8',
  },
  pdfPageTagDark: {
    backgroundColor: '#1E293B',
    color: '#60A5FA',
  },
  pdfPageTitleDark: {
    color: '#F8FAFC',
  },
  pdfPageSubtitleDark: {
    color: '#94A3B8',
  },
  pdfDividerDark: {
    backgroundColor: '#334155',
  },
  pdfBodyTextDark: {
    color: '#CBD5E1',
  },
  // 3. 스마트 도형 자동 보정 버튼 (Sub Toolbar)
  autoSnapBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  autoSnapBtnActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#93C5FD',
  },
  autoSnapText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  autoSnapTextActive: {
    color: '#2563EB',
  },
  // 4. Goodnotes / Notewise 시그니처 3-Slot 즐겨찾기 펜 랙
  quickPenPresetGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  penPresetPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 16,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  penPresetPillActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#2563EB',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  penPresetColorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  penPresetWidthText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
  },
  penPresetWidthTextActive: {
    color: '#2563EB',
  },
  // 5. 새 페이지 양식/속지 선택 모달 (Goodnotes 스타일)
  templatePickerModalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    width: '90%',
    maxWidth: 420,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  templateChoicesGrid: {
    gap: 8,
    marginTop: 8,
  },
  templateChoiceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  templateChoiceEmoji: {
    fontSize: 22,
  },
  templateChoiceName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  templateChoiceDesc: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  // 6. 펜 슬롯 커스텀 설정 모달
  presetModalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    width: '90%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  presetSectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 8,
  },
  presetToolRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  presetToolBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  presetToolBtnActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#2563EB',
  },
  presetToolBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  presetToolBtnTextActive: {
    color: '#2563EB',
    fontWeight: '700',
  },
  presetWidthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  presetWidthBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  presetWidthBtnActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  presetWidthBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  presetWidthBtnTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  presetSaveConfirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#2563EB',
    paddingVertical: 11,
    borderRadius: 8,
    marginTop: 6,
  },
  presetSaveConfirmText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  // 7. 형광펜만 지우기 버튼 스타일
  eraserHighlighterOnlyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  eraserHighlighterOnlyBtnActive: {
    backgroundColor: '#FEF3C7',
    borderColor: '#F59E0B',
  },
  eraserHighlighterOnlyText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  eraserHighlighterOnlyTextActive: {
    color: '#D97706',
    fontWeight: '700',
  },
  // 8. 문서 내 단어 검색 네비게이터 바
  searchNavigatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 6,
    borderLeftWidth: 1,
    borderLeftColor: '#E2E8F0',
  },
  searchTotalCountText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2563EB',
  },
  searchNavArrowBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      web: { cursor: 'pointer' },
    }),
  },
  // 9. 문서 목차(Outline) 사이드바 섹션
  outlineSectionContainer: {
    padding: 10,
    gap: 8,
  },
  outlineItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...Platform.select({
      web: { cursor: 'pointer' },
    }),
  },
  outlineItemCardActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#3B82F6',
  },
  outlineItemBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
  },
  outlineItemBadgeActive: {
    backgroundColor: '#2563EB',
  },
  outlineItemBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  outlineItemBadgeTextActive: {
    color: '#FFFFFF',
  },
  outlineItemTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
  },
  outlineItemTitleActive: {
    color: '#2563EB',
  },
  outlineItemSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  audioCountBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#2563EB',
    borderRadius: 8,
    minWidth: 15,
    height: 15,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
  },
  audioCountBadgeText: {
    fontSize: 8.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  floatingAudioDock: {
    position: 'absolute',
    top: 54,
    right: 16,
    width: 340,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#93C5FD',
    padding: 10,
    zIndex: 9999,
    ...Platform.select({
      ios: {
        shadowColor: '#1E293B',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.2,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
      web: {
        boxShadow: '0 8px 24px rgba(15, 23, 42, 0.22)',
      },
    }),
  },
  audioDockHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    marginBottom: 6,
  },
  audioDockHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  audioDockTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E293B',
  },
  audioDockCloseBtn: {
    padding: 2,
  },
  audioDockScroll: {
    maxHeight: 280,
  },
  // Adobe Acrobat 스타일 PDF 4대 모드 바 (편집/주석 | 페이지 구성 | 병합 | 분할)
  acrobatModeBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingHorizontal: 14,
    paddingVertical: 7,
    zIndex: 9,
  },
  acrobatTabGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  acrobatTabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...Platform.select({
      web: { cursor: 'pointer' },
    }),
  },
  acrobatTabBtnActiveBlue: {
    backgroundColor: '#EFF6FF',
    borderColor: '#2563EB',
  },
  acrobatTabBtnActiveGreen: {
    backgroundColor: '#ECFDF5',
    borderColor: '#059669',
  },
  acrobatTabBtnActivePurple: {
    backgroundColor: '#F5F3FF',
    borderColor: '#7C3AED',
  },
  acrobatTabBtnActiveRed: {
    backgroundColor: '#FEF2F2',
    borderColor: '#DC2626',
  },
  acrobatTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  acrobatTabTextActiveBlue: {
    color: '#1D4ED8',
    fontWeight: '700',
  },
  acrobatTabTextActiveGreen: {
    color: '#047857',
    fontWeight: '700',
  },
  acrobatTabTextActivePurple: {
    color: '#6D28D9',
    fontWeight: '700',
  },
  acrobatTabTextActiveRed: {
    color: '#B91C1C',
    fontWeight: '700',
  },
  acrobatOpenHubBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    ...Platform.select({
      web: { cursor: 'pointer' },
    }),
  },
  acrobatOpenHubText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#2563EB',
  },
  writingSoundQuickBtnActive: {
    backgroundColor: '#ECFDF5',
    borderColor: '#10B981',
  },
  writingSoundQuickTextActive: {
    color: '#059669',
    fontWeight: '700',
  },
  // 분할 사이드 노트 토글 버튼 (상단 바)
  sideNoteToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...Platform.select({
      web: { cursor: 'pointer' },
    }),
  },
  sideNoteToggleBtnActive: {
    backgroundColor: '#FEF3C7',
    borderColor: '#F59E0B',
  },
  sideNoteToggleText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#475569',
  },
  sideNoteToggleTextActive: {
    color: '#B45309',
  },
  // Acrobat 바 우측 액션 그룹 & 블록 발췌 퀵 버튼
  acrobatRightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  acrobatSnippetQuickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FCD34D',
    ...Platform.select({
      web: { cursor: 'pointer' },
    }),
  },
  acrobatSnippetQuickBtnActive: {
    backgroundColor: '#D97706',
    borderColor: '#B45309',
  },
  acrobatSnippetQuickText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#B45309',
  },
  acrobatSnippetQuickTextActive: {
    color: '#FFFFFF',
  },
  // 툴박스 블록 발췌 버튼 활성 & 안내 배지
  toolBtnActiveSnippet: {
    backgroundColor: '#D97706',
  },
  toolGuideBadgeAmber: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FCD34D',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginBottom: 8,
    ...Platform.select({
      web: { boxShadow: '0 4px 12px rgba(217, 119, 6, 0.14)' },
    }),
  },
  toolGuideBadgeAmberText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#92400E',
  },
  // PDF 블록 캡처 확정 오버레이 & 플로팅 액션 바
  snippetOverlayBox: {
    position: 'absolute',
    zIndex: 60,
  },
  snippetDashedFrame: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#D97706',
    backgroundColor: 'rgba(245, 158, 11, 0.10)',
    borderRadius: 5,
  },
  snippetCornerDot: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#D97706',
  },
  snippetActionBar: {
    position: 'absolute',
    left: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#0F172A',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 10,
    zIndex: 70,
    ...Platform.select({
      web: {
        boxShadow: '0 8px 24px rgba(15, 23, 42, 0.35)',
        whiteSpace: 'nowrap',
      },
    }),
  },
  snippetActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    ...Platform.select({
      web: { cursor: 'pointer' },
    }),
  },
  snippetActionBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  snippetCloseBtn: {
    padding: 5,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    ...Platform.select({
      web: { cursor: 'pointer' },
    }),
  },
  appendNotePickerCard: {
    position: 'absolute',
    left: 0,
    width: 280,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#C4B5FD',
    padding: 8,
    zIndex: 80,
    ...Platform.select({
      web: { boxShadow: '0 10px 28px rgba(15, 23, 42, 0.25)' },
    }),
  },
  appendNotePickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 6,
    marginBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  appendNotePickerTitle: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#4C1D95',
  },
  appendNoteItemBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 8,
    paddingVertical: 7,
    borderRadius: 7,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
    ...Platform.select({
      web: { cursor: 'pointer' },
    }),
  },
  appendNoteItemTitle: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: '#1E293B',
  },
  appendNoteItemTag: {
    fontSize: 11,
    fontWeight: '700',
    color: '#7C3AED',
  },
  // Stage 1 + Stage 2 PDF 워크벤치 스타일 (보기 레이아웃, 워터마크, 스탬프, 먹칠, 댓글 핀)
  viewLayoutSwitchPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    padding: 2,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  viewLayoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  viewLayoutBtnActive: {
    backgroundColor: '#FFFFFF',
  },
  viewLayoutBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  viewLayoutBtnTextActive: {
    color: '#1D4ED8',
    fontWeight: '800',
  },
  acrobatToolMiniBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
  },
  acrobatToolMiniBtnActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#93C5FD',
  },
  acrobatToolMiniText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#334155',
  },
  acrobatCmdPaletteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#1E293B',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
  },
  acrobatCmdPaletteText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  canvasScrollContentTwoUp: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'flex-start',
    gap: 22,
  },
  companionPageSheet: {
    borderWidth: 2,
    borderColor: '#60A5FA',
    opacity: 0.96,
  },
  companionFocusBadge: {
    position: 'absolute',
    bottom: 14,
    alignSelf: 'center',
    backgroundColor: 'rgba(30, 41, 59, 0.86)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
  },
  companionFocusBadgeText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '800',
  },
  pdfHeaderOverlayText: {
    position: 'absolute',
    top: 12,
    left: 28,
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  pdfFooterOverlayRow: {
    position: 'absolute',
    bottom: 10,
    left: 28,
    right: 28,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pdfFooterOverlayText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  pdfFooterOverlayPageNum: {
    fontSize: 11,
    fontWeight: '800',
    color: '#475569',
  },
  pdfWatermarkOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pdfWatermarkText: {
    fontSize: 56,
    fontWeight: '900',
    letterSpacing: 3,
    textAlign: 'center',
    transform: [{ rotate: '-35deg' }],
  },
  pdfStampBadge: {
    position: 'absolute',
    width: 144,
    minHeight: 46,
    backgroundColor: 'rgba(255, 255, 255, 0.90)',
    borderWidth: 2.5,
    borderRadius: 6,
    padding: 3,
    zIndex: 55,
  },
  pdfStampInnerBorder: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 3,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  pdfStampLabel: {
    fontSize: 13.5,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  pdfStampSublabel: {
    fontSize: 8.5,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginTop: 1,
  },
  pdfRedactionBox: {
    position: 'absolute',
    backgroundColor: '#09090B',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 2,
    zIndex: 58,
  },
  pdfRedactionLabel: {
    color: '#94A3B8',
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 1,
  },
  overlayRemoveCircle: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pdfCommentPin: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#2563EB',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    zIndex: 59,
    ...Platform.select({
      web: {
        cursor: 'pointer',
        boxShadow: '0 4px 12px rgba(37, 99, 235, 0.35)',
      },
    }),
  },
  pdfCommentPinResolved: {
    backgroundColor: '#10B981',
  },
  pdfCommentPinSelected: {
    backgroundColor: '#D97706',
    transform: [{ scale: 1.08 }],
  },
  pdfCommentPinText: {
    color: '#FFFFFF',
    fontSize: 10.5,
    fontWeight: '900',
  },
});


