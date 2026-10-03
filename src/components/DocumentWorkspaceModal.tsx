import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
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
} from 'lucide-react-native';
import { Note, FreeHandStroke, AudioNote, PaperTemplate, FreeTextBox } from '../types/note';
import { useNoteStore } from '../store/useNoteStore';
import { AudioRecordingStudio } from './AudioRecordingStudio';
import { PaperTemplatePattern } from './PaperTemplatePattern';
import { DraggableAudioPin } from './DraggableAudioPin';
import { DraggableTextBox } from './DraggableTextBox';
import { AudioPlayerBar } from './AudioPlayerBar';
import { recognizeShape, tryRecognizeMultiStroke } from '../utils/shapeRecognizer';

interface DocumentWorkspaceModalProps {
  note?: Note | null;
  initialMode?: 'pdf' | 'canvas';
  onClose: () => void;
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

export const DocumentWorkspaceModal: React.FC<DocumentWorkspaceModalProps> = ({
  note: initialNote,
  initialMode = 'pdf',
  onClose,
}) => {
  const { addNote, updateNote, deleteNote } = useNoteStore();

  const isPdfMode = initialMode === 'pdf' || (initialNote?.noteType === 'pdf') || !!initialNote?.pdfUri;

  const [title, setTitle] = useState<string>(
    initialNote?.title || (isPdfMode ? '2026 프로덕트 전략 로드맵.pdf' : '아이디어 캔버스 드로잉')
  );
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(isPdfMode ? 3 : 2);
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

  // 툴박스 도구 설정 (Goodnotes / Notewise fragment_sketch_toolbox)
  const [activeTool, setActiveTool] = useState<
    'hand' | 'fountain' | 'pen' | 'highlighter' | 'eraser' | 'shape' | 'text' | 'lasso' | 'laser'
  >('fountain');
  const [shapeType, setShapeType] = useState<'rect' | 'circle' | 'arrow' | 'line'>('rect');

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

  // 문서 선택 (샘플 문서 동적 매칭)
  const matchedDoc = React.useMemo(() => {
    return getSampleDocumentForNote(initialNote?.title, initialNote?.pdfName);
  }, [initialNote?.title, initialNote?.pdfName]);

  const initialDocIdx = Math.max(0, SAMPLE_DOCUMENTS.findIndex((d) => d.id === matchedDoc.id));
  const [selectedDocIndex, setSelectedDocIndex] = useState(initialDocIdx >= 0 ? initialDocIdx : 0);
  const activeDocument = SAMPLE_DOCUMENTS[selectedDocIndex] || matchedDoc;

  // 캔버스 크기
  const pageContainerRef = useRef<View>(null);
  const [pageLayout, setPageLayout] = useState({ width: 720, height: 1018 });

  // PanResponder 및 Web 이벤트 클로저 버그 해결을 위한 최신 상태 Mutable Refs
  const activeToolRef = useRef(activeTool);
  activeToolRef.current = activeTool;

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

  // 저장 및 종료
  const handleSaveAndExit = () => {
    const finalTitle = title.trim() || (isPdfMode ? 'PDF 문서' : '손글씨 캔버스');
    const finalStrokes = strokesRef.current;
    if (initialNote?.id) {
      updateNote(initialNote.id, {
        title: finalTitle,
        strokes: finalStrokes,
        paperTemplate,
        audioNotes,
        textBoxes,
        noteType: isPdfMode ? 'pdf' : 'canvas',
        pdfName: isPdfMode ? finalTitle : undefined,
        bookmarkedPages,
        pageTemplates,
      });
    } else {
      addNote({
        title: finalTitle,
        content: isPdfMode ? `[PDF 문서 첨부] ${finalTitle}` : '손글씨 캔버스 필기 메모',
        color: isPdfMode ? 'paper' : 'yellow',
        decoStyle: 'minimal',
        images: [],
        checklist: [],
        tags: [isPdfMode ? 'PDF' : '캔버스', '필기'],
        isPinned: false,
        isLocked: false,
        strokes: finalStrokes,
        paperTemplate,
        audioNotes,
        textBoxes,
        boardId: 'ideas',
        noteType: isPdfMode ? 'pdf' : 'canvas',
        pdfName: isPdfMode ? finalTitle : undefined,
        bookmarkedPages,
        pageTemplates,
      });
    }
    onClose();
  };

  // 템플릿 지정 새 페이지 추가 (Notewise & Goodnotes 페이지 템플릿 생성기)
  const handleAddNewPageWithTemplate = (chosenTemplate: PaperTemplate) => {
    const newPageNum = totalPages + 1;
    setTotalPages(newPageNum);
    setPageTemplates((prev) => ({ ...prev, [newPageNum]: chosenTemplate }));
    setCurrentPage(newPageNum);
    setIsAddPageTemplateModalOpen(false);
    setIsOverviewOpen(false);
    const templateNames: Record<PaperTemplate, string> = {
      blank: '무지',
      lined: '줄노트',
      grid: '모눈종이',
      cornell: '코넬 노트',
      dot: '점 모눈',
      dark: '다크 칠판',
    };
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

  // 데스크톱 Web 단축키 핸들러 (Ctrl+Z: 실행 취소, Ctrl+Y: 다시 실행, Esc: 모달/선택 해제, Delete: 올가미 객체 삭제)
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea') return;

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
      } else if (e.key === 'Escape') {
        if (selectedStrokeIdsRef.current.length > 0) {
          setSelectedStrokeIds([]);
          setSelectionBBox(null);
        }
        setIsColorPickerOpen(false);
        setIsTemplateMenuOpen(false);
        setEditingPresetIndex(null);
        setIsAddPageTemplateModalOpen(false);
        setIsExportModalOpen(false);
        setIsPageJumpModalOpen(false);
        setIsSearchOpen(false);
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedStrokeIdsRef.current.length > 0) {
          handleDeleteSelection();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undoStack, redoStack, selectedStrokeIds]);

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

  // 썸네일 오버뷰 페이지 복제 및 삭제
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
    setTotalPages((prev) => Math.max(1, prev - 1));
    setCurrentPage((prev) => (prev >= pNum ? Math.max(1, prev - 1) : prev));
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
        activeToolRef.current !== 'hand' && activeToolRef.current !== 'text',
      onPanResponderGrant: (evt: GestureResponderEvent) => {
        const { locationX, locationY } = evt.nativeEvent;
        if (activeToolRef.current === 'text') {
          const newBox: FreeTextBox = {
            id: 'tb_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
            x: Math.max(20, Math.min((pageLayout.width || 600) - 180, locationX)),
            y: Math.max(20, Math.min((pageLayout.height || 800) - 80, locationY)),
            text: '',
            fontSize: 16,
            color: strokeColorRef.current,
            backgroundColor: 'transparent',
            pageIndex: currentPageRef.current,
          };
          setTextBoxes((prev) => [...prev, newBox]);
          setSelectedTextBoxId(newBox.id);
          setActiveTool('hand');
          return;
        }

        if (activeToolRef.current === 'laser') {
          if (laserFadeTimerRef.current) clearTimeout(laserFadeTimerRef.current);
          setLaserPoint({ x: locationX, y: locationY });
          setLaserTrail([{ x: locationX, y: locationY }]);
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
          width: activeToolRef.current === 'highlighter' ? 24 : strokeWidthRef.current,
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
        const { locationX, locationY } = evt.nativeEvent;
        if (activeToolRef.current === 'laser') {
          setLaserPoint({ x: locationX, y: locationY });
          setLaserTrail((prev) => {
            const next = [...prev, { x: locationX, y: locationY }];
            return next.length > 25 ? next.slice(next.length - 25) : next;
          });
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
        if (activeToolRef.current === 'laser') {
          setLaserPoint(null);
          if (laserFadeTimerRef.current) clearTimeout(laserFadeTimerRef.current);
          laserFadeTimerRef.current = setTimeout(() => {
            setLaserTrail([]);
          }, 500);
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
            // 1) Goodnotes 시그니처: 분할된 선들을 연결한 다중 스트로크 자동 결합 (| + ㄱ + ㅡ 등)
            const multiResult = tryRecognizeMultiStroke(strokesRef.current, finished, 50);
            if (multiResult) {
              const { recognized, mergedStrokeIds } = multiResult;
              const mergedIdSet = new Set(mergedStrokeIds);
              const mergedStroke: StrokeWithPage = {
                ...finished,
                id: 'shape_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
                points: recognized.points,
                shapeType: mapShapeType(recognized.type),
                isPolygon: recognized.isPolygon ?? (recognized.type === 'rectangle' || recognized.type === 'triangle'),
              };
              undoStackRef.current = [...undoStackRef.current, strokesRef.current];
              redoStackRef.current = [];
              setUndoStack(undoStackRef.current);
              setRedoStack([]);
              const remaining = strokesRef.current.filter((s) => !mergedIdSet.has(s.id));
              const nextStrokes: StrokeWithPage[] = [...remaining, mergedStroke];
              strokesRef.current = nextStrokes;
              setStrokes(nextStrokes);
              setExportToastMessage(`📐 ${mergedStrokeIds.length}개 선이 연결되어 '${recognized.label}'(으)로 자동 결합되었습니다`);
              setTimeout(() => setExportToastMessage(null), 2000);
              return;
            }

            // 2) 단일 스트로크 고정밀 인식
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

  // 데스크톱 웹 마우스 드래그 핸들러
  const handleWebMouseDown = (e: any) => {
    if (Platform.OS !== 'web') return;
    if (activeToolRef.current === 'hand') return;

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
        fontSize: 16,
        color: strokeColorRef.current,
        backgroundColor: 'transparent',
        pageIndex: currentPageRef.current,
      };
      setTextBoxes((prev) => [...prev, newBox]);
      setSelectedTextBoxId(newBox.id);
      setActiveTool('hand');
      return;
    }

    if (activeToolRef.current === 'laser') {
      if (laserFadeTimerRef.current) clearTimeout(laserFadeTimerRef.current);
      setLaserPoint({ x, y });
      setLaserTrail([{ x, y }]);
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
      setSelectionRect({
        startX: x,
        startY: y,
        currentX: x,
        currentY: y,
      });
      return;
    }

    if (activeToolRef.current === 'eraser') {
      isErasingRef.current = true;
      dragStartStrokesRef.current = strokesRef.current;
      hasErasedInThisDragRef.current = false;
      handleEraseAt(x, y);
      return;
    }

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
      width: activeToolRef.current === 'highlighter' ? 24 : strokeWidthRef.current,
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
    if (activeToolRef.current === 'hand' || activeToolRef.current === 'text') return;

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
        setSelectionRect((prev) => (prev ? { ...prev, currentX: x, currentY: y } : null));
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

    if (currentStrokeRef.current.tool === 'shape') {
      currentStrokeRef.current = {
        ...currentStrokeRef.current,
        shapeEnd: { x, y },
      };
      setCurrentStroke(currentStrokeRef.current);
      return;
    }

    currentStrokeRef.current = {
      ...currentStrokeRef.current,
      points: [...currentStrokeRef.current.points, { x, y }],
    };
    setCurrentStroke(currentStrokeRef.current);
  };

  const handleWebMouseUp = () => {
    if (Platform.OS !== 'web') return;
    if (activeToolRef.current === 'hand' || activeToolRef.current === 'text') return;

    if (activeToolRef.current === 'laser') {
      setLaserPoint(null);
      if (laserFadeTimerRef.current) clearTimeout(laserFadeTimerRef.current);
      laserFadeTimerRef.current = setTimeout(() => {
        setLaserTrail([]);
      }, 500);
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
        // 1) Goodnotes 시그니처: 분할된 선들을 연결한 다중 스트로크 자동 결합 (| + ㄱ + ㅡ 등)
        const multiResult = tryRecognizeMultiStroke(strokesRef.current, finished, 50);
        if (multiResult) {
          const { recognized, mergedStrokeIds } = multiResult;
          const mergedIdSet = new Set(mergedStrokeIds);
          const mergedStroke: StrokeWithPage = {
            ...finished,
            id: 'shape_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
            points: recognized.points,
            shapeType: mapShapeType(recognized.type),
            isPolygon: recognized.isPolygon ?? (recognized.type === 'rectangle' || recognized.type === 'triangle'),
          };
          undoStackRef.current = [...undoStackRef.current, strokesRef.current];
          redoStackRef.current = [];
          setUndoStack(undoStackRef.current);
          setRedoStack([]);
          const remaining = strokesRef.current.filter((s) => !mergedIdSet.has(s.id));
          const nextStrokes: StrokeWithPage[] = [...remaining, mergedStroke];
          strokesRef.current = nextStrokes;
          setStrokes(nextStrokes);
          setExportToastMessage(`📐 ${mergedStrokeIds.length}개 선이 연결되어 '${recognized.label}'(으)로 자동 결합되었습니다`);
          setTimeout(() => setExportToastMessage(null), 2000);
          return;
        }

        // 2) 단일 스트로크 고정밀 인식
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

  // 내 파일에서 PDF 업로드 (Web 지원)
  const handlePickDocument = () => {
    if (Platform.OS === 'web') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'application/pdf,image/*';
      input.onchange = (e: any) => {
        const file = e.target?.files?.[0];
        if (file) {
          setTitle(file.name);
          Alert.alert('문서 로드 완료', `'${file.name}' 문서가 성공적으로 열렸습니다.`);
        }
      };
      input.click();
    } else {
      Alert.alert('파일 탐색기', '기기 저장소에서 PDF 문서를 불러옵니다.');
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
            <Text style={styles.docSubtitle}>
              {isPdfMode ? '📄 Goodnotes / Notewise PDF 모드' : '🎨 DrawNote 무한 캔버스 모드'}
            </Text>
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
            {...(Platform.OS === 'web'
              ? ({
                  onClick: () => {
                    setIsNightMode((prev) => {
                      const next = !prev;
                      setExportToastMessage(next ? '🌙 야간 모드가 켜졌습니다 (눈부심 방지)' : '☀️ 주간 모드로 전환되었습니다');
                      setTimeout(() => setExportToastMessage(null), 1800);
                      return next;
                    });
                  },
                } as any)
              : {})}
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
            {...(Platform.OS === 'web' ? ({ onClick: handleUndo } as any) : {})}
          >
            <Undo2 size={19} color={undoStack.length === 0 ? '#CBD5E1' : '#475569'} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, redoStack.length === 0 && styles.actionBtnDisabled]}
            disabled={redoStack.length === 0}
            onPress={handleRedo}
            {...(Platform.OS === 'web' ? ({ onClick: handleRedo } as any) : {})}
          >
            <Redo2 size={19} color={redoStack.length === 0 ? '#CBD5E1' : '#475569'} />
          </TouchableOpacity>

          {/* 문서 내 단어 검색 버튼 */}
          <TouchableOpacity
            style={[styles.actionBtn, isSearchOpen && styles.actionBtnActiveBlue]}
            onPress={() => setIsSearchOpen((prev) => !prev)}
            {...(Platform.OS === 'web' ? ({ onClick: () => setIsSearchOpen((prev) => !prev) } as any) : {})}
          >
            <Search size={19} color={isSearchOpen ? '#2563EB' : '#475569'} />
          </TouchableOpacity>

          {/* 속지 템플릿 변경 버튼 */}
          <TouchableOpacity
            style={[styles.actionBtn, isTemplateMenuOpen && styles.actionBtnActiveBlue]}
            onPress={() => setIsTemplateMenuOpen((prev) => !prev)}
            {...(Platform.OS === 'web' ? ({ onClick: () => setIsTemplateMenuOpen((prev) => !prev) } as any) : {})}
          >
            <BookOpen size={19} color={isTemplateMenuOpen ? '#2563EB' : '#475569'} />
          </TouchableOpacity>

          {/* 오디오 녹음 버튼 (Notewise 실시간 팟캐스트 연동) */}
          <TouchableOpacity
            style={[styles.actionBtn, isRecording && styles.recordingActiveBtn]}
            onPress={() => setIsRecording((prev) => !prev)}
            {...(Platform.OS === 'web' ? ({ onClick: () => setIsRecording((prev) => !prev) } as any) : {})}
          >
            <Mic size={19} color={isRecording ? '#DC2626' : '#475569'} />
          </TouchableOpacity>

          {/* 오디오 플레이어 독 토글 버튼 (전체 페이지 오디오 탐색 및 -5s, +5s, 처음으로, 음소거) */}
          {audioNotes.length > 0 && (
            <TouchableOpacity
              style={[styles.actionBtn, isAudioDockOpen && styles.actionBtnActiveBlue]}
              onPress={() => setIsAudioDockOpen((prev) => !prev)}
              {...(Platform.OS === 'web' ? ({ onClick: () => setIsAudioDockOpen((prev) => !prev) } as any) : {})}
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
            {...(Platform.OS === 'web' ? ({ onClick: () => setIsOverviewOpen((prev) => !prev) } as any) : {})}
          >
            <Layers size={19} color={isOverviewOpen ? '#2563EB' : '#475569'} />
          </TouchableOpacity>

          {/* 외부 PDF 불러오기 */}
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={handlePickDocument}
            {...(Platform.OS === 'web' ? ({ onClick: handlePickDocument } as any) : {})}
          >
            <Upload size={19} color="#475569" />
          </TouchableOpacity>

          {/* 공유 및 내보내기 모달 (Goodnotes / Notewise PDF, 인쇄, 텍스트 추출) */}
          <TouchableOpacity
            style={[styles.actionBtn, isExportModalOpen && styles.actionBtnActiveBlue]}
            onPress={() => setIsExportModalOpen(true)}
            {...(Platform.OS === 'web' ? ({ onClick: () => setIsExportModalOpen(true) } as any) : {})}
          >
            <Share2 size={19} color={isExportModalOpen ? '#2563EB' : '#475569'} />
          </TouchableOpacity>

          {/* 저장 및 닫기 */}
          <TouchableOpacity
            style={styles.saveExitBtn}
            onPress={handleSaveAndExit}
            {...(Platform.OS === 'web' ? ({ onClick: handleSaveAndExit } as any) : {})}
          >
            <Check size={16} color="#FFFFFF" strokeWidth={3} />
            <Text style={styles.saveExitText}>저장</Text>
          </TouchableOpacity>
        </View>
      </View>

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
      {activeTool === 'hand' && (
        <View style={styles.handModeNoticeBanner}>
          <Hand size={14} color="#059669" />
          <Text style={styles.handModeNoticeText}>
            손바닥 탐색 모드: 필기 방지 활성화 (부드럽게 스크롤하며 문서를 읽을 수 있습니다)
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

      {/* 2. 중앙 메인 작업 영역 (PDF 및 드로잉 캔버스) */}
      <View style={styles.workspaceBody}>
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
                              <Text style={styles.thumbnailPageContent} numberOfLines={4}>
                                {isPdfMode && activeDocument?.pages[idx]
                                  ? activeDocument.pages[idx].title
                                  : `Page ${pNum} 노트`}
                              </Text>
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

        {/* 스크롤 가능한 메인 문서 A4 뷰 */}
        <ScrollView
          style={styles.canvasScrollView}
          contentContainerStyle={styles.canvasScrollContent}
          showsVerticalScrollIndicator={true}
        >
          {/* A4 스타일 문서 시트 (고해상도 그림자 및 경계선) */}
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
            {/* 속지 패턴 렌더링 (캔버스 모드이거나, 추가된 페이지이거나, 페이지별 템플릿이 지정된 경우) */}
            {(!isPdfMode || pageTemplates[currentPage] || !activeDocument?.pages[currentPage - 1]) && (
              <View style={StyleSheet.absoluteFill} pointerEvents="none">
                <PaperTemplatePattern
                  template={isNightMode ? 'dark' : pageTemplates[currentPage] || paperTemplate}
                />
              </View>
            )}

            {/* PDF 모드일 때 고품질 문서 본문 렌더링 */}
            {isPdfMode && activeDocument?.pages[currentPage - 1] && (
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
            )}

            {/* 손글씨 & 기하 도형 실시간 벡터 SVG 오버레이 레이어 */}
            <View
              style={[
                StyleSheet.absoluteFill,
                Platform.OS === 'web' && {
                  cursor:
                    activeTool === 'eraser'
                      ? 'crosshair'
                      : activeTool === 'hand'
                      ? 'grab'
                      : activeTool === 'text'
                      ? 'text'
                      : activeTool === 'shape'
                      ? 'crosshair'
                      : activeTool === 'lasso'
                      ? 'crosshair'
                      : 'default',
                },
              ]}
              {...panResponder.panHandlers}
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
                {/* 1. 형광펜 레이어 (Goodnotes / DrawNote 시그니처: 반투명으로 글씨 뒤로 깔림) */}
                {currentPageStrokes
                  .filter((s) => s.tool === 'highlighter')
                  .map((stroke) => {
                    const isSel = selectedStrokeIds.includes(stroke.id);
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

                {/* 2. 일반 펜/만년필 및 기하 도형 레이어 (선명하게 전면에 렌더링) */}
                {currentPageStrokes
                  .filter((s) => s.tool !== 'highlighter')
                  .map((stroke) => {
                    const isSel = selectedStrokeIds.includes(stroke.id);
                    // 기하 도형 렌더링
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
        </ScrollView>
      </View>

      {/* 3. 하단 플로팅 프로 툴박스 (Goodnotes & Notewise fragment_sketch_toolbox.xml) */}
      <View style={styles.floatingToolboxContainer}>
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
              {...(Platform.OS === 'web' ? ({ onClick: () => setActiveTool('fountain') } as any) : {})}
            >
              <PenTool size={13} color={activeTool === 'fountain' ? '#2563EB' : '#475569'} />
              <Text style={[styles.subShapeBtnText, activeTool === 'fountain' && styles.subShapeBtnTextActive]}>
                만년필
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.subShapeBtn, activeTool === 'pen' && styles.subShapeBtnActive]}
              onPress={() => setActiveTool('pen')}
              {...(Platform.OS === 'web' ? ({ onClick: () => setActiveTool('pen') } as any) : {})}
            >
              <PenTool size={13} color={activeTool === 'pen' ? '#2563EB' : '#475569'} />
              <Text style={[styles.subShapeBtnText, activeTool === 'pen' && styles.subShapeBtnTextActive]}>
                볼펜
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.subShapeBtn, activeTool === 'highlighter' && styles.subShapeBtnActive]}
              onPress={() => setActiveTool('highlighter')}
              {...(Platform.OS === 'web' ? ({ onClick: () => setActiveTool('highlighter') } as any) : {})}
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
              {...(Platform.OS === 'web'
                ? ({
                    onClick: () => {
                      setAutoSnapShape((prev) => {
                        const next = !prev;
                        setExportToastMessage(next ? '📐 스마트 도형 자동 보정 켜짐' : '📐 도형 자동 보정 꺼짐');
                        setTimeout(() => setExportToastMessage(null), 1800);
                        return next;
                      });
                    },
                  } as any)
                : {})}
            >
              <Sparkles size={12} color={autoSnapShape ? '#2563EB' : '#64748B'} />
              <Text style={[styles.autoSnapText, autoSnapShape && styles.autoSnapTextActive]}>
                도형 보정 {autoSnapShape ? 'ON' : 'OFF'}
              </Text>
            </TouchableOpacity>
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

        {/* 활성 도구 안내 뱃지 (레이저 포인터 / 직사각형 선택 모드) */}
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

        {/* 메인 툴박스 알약 바 */}
        <View style={styles.floatingToolboxPill}>
          {/* 1. 손바닥 탐색 (Flexcil / Goodnotes 제스처/뷰어 모드) */}
          <TouchableOpacity
            style={[styles.toolBtn, activeTool === 'hand' && styles.toolBtnActiveGreen]}
            onPress={() => setActiveTool('hand')}
            {...(Platform.OS === 'web' ? ({ onClick: () => setActiveTool('hand') } as any) : {})}
          >
            <Hand size={19} color={activeTool === 'hand' ? '#FFFFFF' : '#1E293B'} />
          </TouchableOpacity>

          {/* 2. 만년필 (Fountain) */}
          <TouchableOpacity
            style={[styles.toolBtn, activeTool === 'fountain' && styles.toolBtnActive]}
            onPress={() => setActiveTool('fountain')}
            {...(Platform.OS === 'web' ? ({ onClick: () => setActiveTool('fountain') } as any) : {})}
          >
            <PenTool size={19} color={activeTool === 'fountain' ? '#FFFFFF' : '#1E293B'} />
          </TouchableOpacity>

          {/* 3. 형광펜 (Highlighter) */}
          <TouchableOpacity
            style={[styles.toolBtn, activeTool === 'highlighter' && styles.toolBtnActiveHighlighter]}
            onPress={() => setActiveTool('highlighter')}
            {...(Platform.OS === 'web' ? ({ onClick: () => setActiveTool('highlighter') } as any) : {})}
          >
            <Highlighter size={19} color={activeTool === 'highlighter' ? '#FFFFFF' : '#1E293B'} />
          </TouchableOpacity>

          {/* 4. 지우개 (Eraser) */}
          <TouchableOpacity
            style={[styles.toolBtn, activeTool === 'eraser' && styles.toolBtnActiveEraser]}
            onPress={() => setActiveTool('eraser')}
            {...(Platform.OS === 'web' ? ({ onClick: () => setActiveTool('eraser') } as any) : {})}
          >
            <Eraser size={19} color={activeTool === 'eraser' ? '#FFFFFF' : '#1E293B'} />
          </TouchableOpacity>

          {/* 5. 도형 그리기 (Shapes) */}
          <TouchableOpacity
            style={[styles.toolBtn, activeTool === 'shape' && styles.toolBtnActive]}
            onPress={() => setActiveTool('shape')}
            {...(Platform.OS === 'web' ? ({ onClick: () => setActiveTool('shape') } as any) : {})}
          >
            <Square size={19} color={activeTool === 'shape' ? '#FFFFFF' : '#1E293B'} />
          </TouchableOpacity>

          {/* 6. 텍스트 박스 삽입 (Type / Text) */}
          <TouchableOpacity
            style={[styles.toolBtn, activeTool === 'text' && styles.toolBtnActive]}
            onPress={() => setActiveTool('text')}
            {...(Platform.OS === 'web' ? ({ onClick: () => setActiveTool('text') } as any) : {})}
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
              setExportToastMessage('📦 직사각형 선택: 드래그하여 사각 영역 안의 필기를 선택합니다.');
              setTimeout(() => setExportToastMessage(null), 2500);
            }}
            {...(Platform.OS === 'web'
              ? ({
                  title: '직사각형 영역 선택 (드래그하여 객체 선택 및 이동)',
                  onClick: () => {
                    setActiveTool('lasso');
                    setSelectedStrokeIds([]);
                    setSelectionBBox(null);
                    setExportToastMessage('📦 직사각형 선택: 드래그하여 사각 영역 안의 필기를 선택합니다.');
                    setTimeout(() => setExportToastMessage(null), 2500);
                  },
                } as any)
              : {})}
          >
            <BoxSelect size={19} color={activeTool === 'lasso' ? '#FFFFFF' : '#1E293B'} />
          </TouchableOpacity>

          {/* 8. 프레젠테이션 레이저 포인터 (발표/강조용: 0.5초 후 자동 소멸) */}
          <TouchableOpacity
            style={[styles.toolBtn, activeTool === 'laser' && styles.toolBtnActiveLaser]}
            onPress={() => {
              setActiveTool('laser');
              setSelectedStrokeIds([]);
              setSelectionBBox(null);
              setExportToastMessage('🎯 프레젠테이션 레이저: 발표 중 강조용 도구로, 필기선이 0.5초 후 자동으로 사라집니다.');
              setTimeout(() => setExportToastMessage(null), 3500);
            }}
            {...(Platform.OS === 'web'
              ? ({
                  title: '프레젠테이션 레이저 포인터 (발표 중 중요한 부분을 가리키면 0.5초 후 자동 소멸)',
                  onClick: () => {
                    setActiveTool('laser');
                    setSelectedStrokeIds([]);
                    setSelectionBBox(null);
                    setExportToastMessage('🎯 프레젠테이션 레이저: 발표 중 강조용 도구로, 필기선이 0.5초 후 자동으로 사라집니다.');
                    setTimeout(() => setExportToastMessage(null), 3500);
                  },
                } as any)
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

          {/* Goodnotes / Notewise 시그니처 3-Thickness Slot Presets */}
          <View style={styles.widthSelectorGroup}>
            {[2, 4, 8].map((w) => (
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
                    width: w === 2 ? 4 : w === 4 ? 7 : 11,
                    height: w === 2 ? 4 : w === 4 ? 7 : 11,
                    borderRadius: 6,
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
                style={styles.exportOptionItem}
                onPress={handleExportPdfOrPrint}
                {...(Platform.OS === 'web' ? ({ onClick: handleExportPdfOrPrint } as any) : {})}
              >
                <View style={[styles.exportOptionIconBox, { backgroundColor: '#EFF6FF' }]}>
                  <Printer size={20} color="#2563EB" />
                </View>
                <View style={styles.exportOptionTextBox}>
                  <Text style={styles.exportOptionTitle}>인쇄 및 PDF로 내보내기</Text>
                  <Text style={styles.exportOptionDesc}>문서 본문과 필기를 통합하여 A4 규격으로 인쇄하거나 PDF로 저장합니다.</Text>
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
    paddingVertical: 24,
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
});

