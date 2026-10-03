import React, { useRef, useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  PanResponder,
  TouchableOpacity,
  Dimensions,
  Platform,
  GestureResponderEvent,
} from 'react-native';
import Svg, { Path as SvgPath } from 'react-native-svg';
import { StickyCard } from './StickyCard';
import { useNoteStore } from '../store/useNoteStore';
import { Note, FreeHandStroke } from '../types/note';
import {
  Move,
  Sparkles,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Copy,
  PenTool,
  ArrowRight,
  Highlighter,
  Eraser,
  Undo2,
  Redo2,
  Trash2,
} from 'lucide-react-native';

const CANVAS_WIDTH = 2600;
const CANVAS_HEIGHT = 2600;

interface DraggableStickyProps {
  note: Note;
  onDragStart?: () => void;
  onDragEnd: (id: string, x: number, y: number) => void;
  onBringToFront: (id: string) => void;
  onDuplicate: (id: string) => void;
}

const DraggableSticky: React.FC<DraggableStickyProps> = ({
  note,
  onDragStart,
  onDragEnd,
  onBringToFront,
  onDuplicate,
}) => {
  const [position, setPosition] = useState({ x: note.canvasX || 50, y: note.canvasY || 50 });
  const [isDragging, setIsDragging] = useState(false);

  const currentPosRef = useRef({ x: note.canvasX || 50, y: note.canvasY || 50 });
  const startPosRef = useRef({ x: note.canvasX || 50, y: note.canvasY || 50 });

  useEffect(() => {
    const updated = { x: note.canvasX || 50, y: note.canvasY || 50 };
    setPosition(updated);
    currentPosRef.current = updated;
  }, [note.canvasX, note.canvasY]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: (_, gesture) => {
        return Math.abs(gesture.dx) > 1 || Math.abs(gesture.dy) > 1;
      },
      onMoveShouldSetPanResponderCapture: (_, gesture) => {
        return Math.abs(gesture.dx) > 1 || Math.abs(gesture.dy) > 1;
      },
      onPanResponderGrant: () => {
        setIsDragging(true);
        onBringToFront(note.id);
        onDragStart?.();
        startPosRef.current = { x: currentPosRef.current.x, y: currentPosRef.current.y };
      },
      onPanResponderMove: (_, gesture) => {
        const newX = Math.max(10, Math.min(CANVAS_WIDTH - 300, startPosRef.current.x + gesture.dx));
        const newY = Math.max(10, Math.min(CANVAS_HEIGHT - 320, startPosRef.current.y + gesture.dy));
        setPosition({ x: newX, y: newY });
        currentPosRef.current = { x: newX, y: newY };
      },
      onPanResponderTerminationRequest: () => false,
      onPanResponderRelease: (_, gesture) => {
        setIsDragging(false);
        const finalX = Math.max(10, Math.min(CANVAS_WIDTH - 300, startPosRef.current.x + gesture.dx));
        const finalY = Math.max(10, Math.min(CANVAS_HEIGHT - 320, startPosRef.current.y + gesture.dy));
        setPosition({ x: finalX, y: finalY });
        currentPosRef.current = { x: finalX, y: finalY };
        onDragEnd(note.id, finalX, finalY);
      },
      onPanResponderTerminate: () => {
        setIsDragging(false);
        onDragEnd(note.id, currentPosRef.current.x, currentPosRef.current.y);
      },
    })
  ).current;

  return (
    <View
      style={[
        styles.draggableItem,
        {
          left: position.x,
          top: position.y,
          zIndex: isDragging ? 9999 : note.zIndex || 1,
          transform: isDragging ? [{ scale: 1.03 }] : [{ scale: 1 }],
          opacity: isDragging ? 0.95 : 1,
        },
      ]}
    >
      {/* Top Drag Control Bar */}
      <View style={styles.topControlBar}>
        <View {...panResponder.panHandlers} style={styles.dragHandleTrigger}>
          <View style={[styles.dragPill, isDragging && styles.dragPillActive]}>
            <Move size={12} color={isDragging ? '#FFFFFF' : '#475569'} />
            <Text style={[styles.dragText, isDragging && styles.dragTextActive]}>
              {isDragging ? '이동 중...' : '드래그 이동'}
            </Text>
          </View>
        </View>

        {/* Quick Duplicate Button */}
        <TouchableOpacity
          style={styles.duplicatePill}
          onPress={() => onDuplicate(note.id)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Copy size={11} color="#64748B" />
        </TouchableOpacity>
      </View>

      {/* Sticky Note Body */}
      <StickyCard note={note} isCanvasItem={true} />
    </View>
  );
};

// Quadratic Bézier curve smoothing engine
const strokePointsToPath = (points?: { x: number; y: number }[], isRuler?: boolean) => {
  if (!points || points.length === 0) return '';
  if (isRuler && points.length >= 2) {
    return `M ${points[0].x} ${points[0].y} L ${points[points.length - 1].x} ${points[points.length - 1].y}`;
  }
  if (points.length === 1) {
    return `M ${points[0].x} ${points[0].y} L ${points[0].x + 0.5} ${points[0].y + 0.5}`;
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

// 화살표 연결선 및 일반 스트로크 통합 렌더 엔진
const renderStrokePath = (stroke: FreeHandStroke) => {
  const points = stroke.points;
  if (!points || points.length === 0) return '';

  if (stroke.tool === 'connector' && points.length >= 2) {
    const p0 = points[0];
    const p1 = points[points.length - 1];
    const angle = Math.atan2(p1.y - p0.y, p1.x - p0.x);
    const arrowLen = Math.max(16, stroke.width * 3.5);
    const arrowAngle = Math.PI / 6; // 30 degrees
    const ax1 = p1.x - arrowLen * Math.cos(angle - arrowAngle);
    const ay1 = p1.y - arrowLen * Math.sin(angle - arrowAngle);
    const ax2 = p1.x - arrowLen * Math.cos(angle + arrowAngle);
    const ay2 = p1.y - arrowLen * Math.sin(angle + arrowAngle);

    return `M ${p0.x} ${p0.y} L ${p1.x} ${p1.y} M ${ax1} ${ay1} L ${p1.x} ${p1.y} L ${ax2} ${ay2}`;
  }

  return strokePointsToPath(points, stroke.isRuler);
};

// 선분과 점 사이의 거리 계산
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

const strokeHitsEraser = (
  stroke: FreeHandStroke,
  ex: number,
  ey: number,
  radius = 28
) => {
  if (!stroke.points || stroke.points.length === 0) return false;
  const strokeHitRadius = radius + (stroke.width ? stroke.width / 2 : 2);
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

const BOARD_PALETTE = [
  { id: 'dark', color: '#0F172A' },
  { id: 'blue', color: '#2563EB' },
  { id: 'red', color: '#EF4444' },
  { id: 'green', color: '#10B981' },
  { id: 'amber', color: '#F59E0B' },
  { id: 'purple', color: '#8B5CF6' },
];

export const CanvasView: React.FC = () => {
  const {
    notes,
    activeBoardId,
    filters,
    updateCanvasPosition,
    bringToFront,
    duplicateNote,
    canvasBoardStrokes,
    addCanvasBoardStroke,
    setCanvasBoardStrokes,
    clearCanvasBoardStrokes,
  } = useNoteStore();

  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [isDraggingAny, setIsDraggingAny] = useState<boolean>(false);
  const outerScrollRef = useRef<ScrollView>(null);
  const innerScrollRef = useRef<ScrollView>(null);

  // DrawNote 화이트보드 모드: 'pan' (이동 및 스크롤) vs 'draw' (자유 필기 및 연결선)
  const [canvasMode, setCanvasMode] = useState<'pan' | 'draw'>('pan');
  const [boardTool, setBoardTool] = useState<'pen' | 'connector' | 'highlighter' | 'eraser'>('pen');
  const [boardColor, setBoardColor] = useState<string>('#2563EB');
  const [boardWidth, setBoardWidth] = useState<number>(4);
  const [currentBoardStroke, setCurrentBoardStroke] = useState<FreeHandStroke | null>(null);
  const [boardUndoStack, setBoardUndoStack] = useState<FreeHandStroke[][]>([]);
  const [boardRedoStack, setBoardRedoStack] = useState<FreeHandStroke[][]>([]);

  const filteredNotes = useMemo(() => {
    return notes.filter((note) => {
      if (note.isDeleted) return false;
      if (note.isArchived && !filters.showArchived) return false;

      if (activeBoardId !== 'all' && note.boardId !== activeBoardId) return false;
      if (filters.searchQuery.trim()) {
        const q = filters.searchQuery.toLowerCase();
        const inTitle = (note.title || '').toLowerCase().includes(q);
        const inContent = (note.content || '').toLowerCase().includes(q);
        const inTags = (note.tags || []).some((t) => t.toLowerCase().includes(q));
        if (!inTitle && !inContent && !inTags) return false;
      }
      if (filters.selectedTag && (!note.tags || !note.tags.includes(filters.selectedTag))) return false;
      if (filters.selectedColor && note.color !== filters.selectedColor) return false;
      if (filters.onlyPinned && !note.isPinned) return false;
      if (filters.onlyHasImages && (!note.images || note.images.length === 0)) return false;
      if (filters.onlyChecklist && (!note.checklist || note.checklist.length === 0)) return false;
      return true;
    });
  }, [notes, activeBoardId, filters]);

  const handleZoomIn = () => {
    setZoomLevel((prev) => Math.min(1.4, Number((prev + 0.15).toFixed(2))));
  };

  const handleZoomOut = () => {
    setZoomLevel((prev) => Math.max(0.65, Number((prev - 0.15).toFixed(2))));
  };

  const handleResetZoom = () => {
    setZoomLevel(1);
    outerScrollRef.current?.scrollTo({ x: 0, y: 0, animated: true });
    innerScrollRef.current?.scrollTo({ x: 0, y: 0, animated: true });
  };

  // PanResponder 및 Web 이벤트 최신 상태 동기화용 Mutable Refs
  const boardToolRef = useRef(boardTool);
  boardToolRef.current = boardTool;

  const boardColorRef = useRef(boardColor);
  boardColorRef.current = boardColor;

  const boardWidthRef = useRef(boardWidth);
  boardWidthRef.current = boardWidth;

  const canvasModeRef = useRef(canvasMode);
  canvasModeRef.current = canvasMode;

  const strokesRef = useRef(canvasBoardStrokes);
  strokesRef.current = canvasBoardStrokes;

  const dragStartBoardStrokesRef = useRef<FreeHandStroke[]>([]);
  const hasErasedInThisBoardDragRef = useRef(false);
  const isErasingRef = useRef(false);

  // 화이트보드 실행 취소 (Undo / Redo - 스냅샷 기반)
  const handleBoardUndo = () => {
    if (boardUndoStack.length === 0) return;
    const prev = boardUndoStack[boardUndoStack.length - 1];
    setBoardUndoStack((h) => h.slice(0, h.length - 1));
    setBoardRedoStack((r) => [...r, strokesRef.current]);
    strokesRef.current = prev;
    setCanvasBoardStrokes(prev);
  };

  const handleBoardRedo = () => {
    if (boardRedoStack.length === 0) return;
    const next = boardRedoStack[boardRedoStack.length - 1];
    setBoardRedoStack((r) => r.slice(0, r.length - 1));
    setBoardUndoStack((h) => [...h, strokesRef.current]);
    strokesRef.current = next;
    setCanvasBoardStrokes(next);
  };

  // 화이트보드 필기 전체 지우기
  const handleBoardClear = () => {
    setCurrentBoardStroke(null);
    if (strokesRef.current.length > 0) {
      setBoardUndoStack((h) => [...h, strokesRef.current]);
      setBoardRedoStack([]);
      strokesRef.current = [];
      clearCanvasBoardStrokes();
    }
  };

  // 캔버스 보드 지우개 연속 드래그 동기 삭제
  const handleBoardEraseAt = (x: number, y: number) => {
    const currentList = strokesRef.current;
    const toErase = currentList.filter((s) => strokeHitsEraser(s, x, y, 30));
    if (toErase.length === 0) return;

    hasErasedInThisBoardDragRef.current = true;
    const erasedIds = new Set(toErase.map((s) => s.id));
    const remaining = currentList.filter((s) => !erasedIds.has(s.id));
    strokesRef.current = remaining;
    setCanvasBoardStrokes(remaining);
  };

  // 보드 필기 모드 PanResponder (Mobile/Touch)
  const boardPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => canvasModeRef.current === 'draw',
      onStartShouldSetPanResponderCapture: () => canvasModeRef.current === 'draw',
      onMoveShouldSetPanResponder: () => canvasModeRef.current === 'draw',
      onMoveShouldSetPanResponderCapture: () => canvasModeRef.current === 'draw',
      onPanResponderGrant: (evt: GestureResponderEvent) => {
        const { locationX, locationY } = evt.nativeEvent;
        if (boardToolRef.current === 'eraser') {
          isErasingRef.current = true;
          dragStartBoardStrokesRef.current = strokesRef.current;
          hasErasedInThisBoardDragRef.current = false;
          handleBoardEraseAt(locationX, locationY);
          return;
        }

        const newStroke: FreeHandStroke = {
          id: 'bstroke_' + Date.now(),
          points: [{ x: locationX, y: locationY }],
          color: boardColorRef.current,
          width:
            boardToolRef.current === 'highlighter'
              ? 22
              : boardToolRef.current === 'connector'
              ? boardWidthRef.current * 1.2
              : boardWidthRef.current,
          tool: boardToolRef.current,
          isRuler: boardToolRef.current === 'connector',
        };
        setCurrentBoardStroke(newStroke);
      },
      onPanResponderMove: (evt: GestureResponderEvent) => {
        const { locationX, locationY } = evt.nativeEvent;
        if (boardToolRef.current === 'eraser') {
          handleBoardEraseAt(locationX, locationY);
          return;
        }

        setCurrentBoardStroke((prev) => {
          if (!prev) return null;
          if (prev.tool === 'connector') {
            return {
              ...prev,
              points: [prev.points[0], { x: locationX, y: locationY }],
            };
          }
          return {
            ...prev,
            points: [...prev.points, { x: locationX, y: locationY }],
          };
        });
      },
      onPanResponderRelease: () => {
        if (boardToolRef.current === 'eraser') {
          isErasingRef.current = false;
          if (hasErasedInThisBoardDragRef.current) {
            setBoardUndoStack((h) => [...h, dragStartBoardStrokesRef.current]);
            setBoardRedoStack([]);
            hasErasedInThisBoardDragRef.current = false;
          }
          return;
        }

        setCurrentBoardStroke((active) => {
          if (active && active.points.length > 0) {
            setBoardUndoStack((h) => [...h, strokesRef.current]);
            setBoardRedoStack([]);
            const next = [...strokesRef.current, active];
            strokesRef.current = next;
            setCanvasBoardStrokes(next);
          }
          return null;
        });
      },
    })
  ).current;

  // 데스크톱 Web 마우스 드로잉 및 지우개 핸들러
  const handleWebMouseDown = (e: any) => {
    if (Platform.OS !== 'web' || canvasModeRef.current !== 'draw') return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / zoomLevel;
    const y = (e.clientY - rect.top) / zoomLevel;

    if (boardToolRef.current === 'eraser') {
      isErasingRef.current = true;
      dragStartBoardStrokesRef.current = strokesRef.current;
      hasErasedInThisBoardDragRef.current = false;
      handleBoardEraseAt(x, y);

      const onMouseMove = (moveEvent: MouseEvent) => {
        if (!isErasingRef.current) return;
        const curX = (moveEvent.clientX - rect.left) / zoomLevel;
        const curY = (moveEvent.clientY - rect.top) / zoomLevel;
        handleBoardEraseAt(curX, curY);
      };

      const onMouseUp = () => {
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
        isErasingRef.current = false;
        if (hasErasedInThisBoardDragRef.current) {
          setBoardUndoStack((h) => [...h, dragStartBoardStrokesRef.current]);
          setBoardRedoStack([]);
          hasErasedInThisBoardDragRef.current = false;
        }
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
      return;
    }

    const newStroke: FreeHandStroke = {
      id: 'bstroke_' + Date.now(),
      points: [{ x, y }],
      color: boardColorRef.current,
      width:
        boardToolRef.current === 'highlighter'
          ? 22
          : boardToolRef.current === 'connector'
          ? boardWidthRef.current * 1.2
          : boardWidthRef.current,
      tool: boardToolRef.current,
      isRuler: boardToolRef.current === 'connector',
    };
    setCurrentBoardStroke(newStroke);

    let activeStroke = newStroke;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const curX = (moveEvent.clientX - rect.left) / zoomLevel;
      const curY = (moveEvent.clientY - rect.top) / zoomLevel;

      if (activeStroke.tool === 'connector') {
        activeStroke = {
          ...activeStroke,
          points: [activeStroke.points[0], { x: curX, y: curY }],
        };
      } else {
        activeStroke = {
          ...activeStroke,
          points: [...activeStroke.points, { x: curX, y: curY }],
        };
      }
      setCurrentBoardStroke(activeStroke);
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      if (activeStroke && activeStroke.points.length > 0) {
        setBoardUndoStack((h) => [...h, strokesRef.current]);
        setBoardRedoStack([]);
        const next = [...strokesRef.current, activeStroke];
        strokesRef.current = next;
        setCanvasBoardStrokes(next);
        setCurrentBoardStroke(null);
      }
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  return (
    <View style={styles.container}>
      {/* Top Banner & Mode Toggle Bar */}
      <View style={styles.bannerGuide}>
        <View style={styles.bannerLeft}>
          <Sparkles size={14} color="#D97706" />
          <Text style={styles.bannerGuideText}>
            {canvasMode === 'pan'
              ? '스티커 핸들을 잡고 이동하거나 캔버스를 스크롤하세요.'
              : '보드 필기 모드: 펜이나 화살표 연결선으로 생각을 자유롭게 연결하세요!'}
          </Text>
        </View>

        {/* Mode Switch Pills */}
        <View style={styles.modeToggleGroup}>
          <TouchableOpacity
            style={[styles.modeToggleBtn, canvasMode === 'pan' && styles.modeToggleBtnActive]}
            onPress={() => setCanvasMode('pan')}
          >
            <Move size={12} color={canvasMode === 'pan' ? '#FFFFFF' : '#475569'} />
            <Text
              style={[
                styles.modeToggleBtnText,
                canvasMode === 'pan' && styles.modeToggleBtnTextActive,
              ]}
            >
              이동/탐색
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.modeToggleBtn, canvasMode === 'draw' && styles.modeToggleBtnActive]}
            onPress={() => setCanvasMode('draw')}
          >
            <PenTool size={12} color={canvasMode === 'draw' ? '#FFFFFF' : '#475569'} />
            <Text
              style={[
                styles.modeToggleBtnText,
                canvasMode === 'draw' && styles.modeToggleBtnTextActive,
              ]}
            >
              보드 필기
            </Text>
          </TouchableOpacity>
        </View>

        {/* Zoom Controls */}
        <View style={styles.zoomControlGroup}>
          <TouchableOpacity style={styles.zoomBtn} onPress={handleZoomOut}>
            <ZoomOut size={13} color="#475569" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.zoomResetBtn} onPress={handleResetZoom}>
            <Text style={styles.zoomText}>{Math.round(zoomLevel * 100)}%</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.zoomBtn} onPress={handleZoomIn}>
            <ZoomIn size={13} color="#475569" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.zoomBtn} onPress={handleResetZoom}>
            <RotateCcw size={13} color="#475569" />
          </TouchableOpacity>
        </View>
      </View>

      {/* DrawNote Whiteboard Floating Drawing Toolbar (Active in Draw mode) */}
      {canvasMode === 'draw' && (
        <View style={styles.floatingBoardToolbar}>
          {/* Tool selector */}
          <View style={styles.floatingToolGroup}>
            <TouchableOpacity
              style={[styles.fToolBtn, boardTool === 'pen' && styles.fToolBtnActive]}
              onPress={() => setBoardTool('pen')}
              {...(Platform.OS === 'web' ? ({ onClick: () => setBoardTool('pen') } as any) : {})}
            >
              <PenTool size={14} color={boardTool === 'pen' ? '#2563EB' : '#475569'} />
              <Text style={[styles.fToolText, boardTool === 'pen' && styles.fToolTextActive]}>
                펜
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.fToolBtn, boardTool === 'connector' && styles.fToolBtnActive]}
              onPress={() => setBoardTool('connector')}
              {...(Platform.OS === 'web' ? ({ onClick: () => setBoardTool('connector') } as any) : {})}
            >
              <ArrowRight size={14} color={boardTool === 'connector' ? '#2563EB' : '#475569'} />
              <Text style={[styles.fToolText, boardTool === 'connector' && styles.fToolTextActive]}>
                연결선 화살표
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.fToolBtn, boardTool === 'highlighter' && styles.fToolBtnActive]}
              onPress={() => setBoardTool('highlighter')}
              {...(Platform.OS === 'web' ? ({ onClick: () => setBoardTool('highlighter') } as any) : {})}
            >
              <Highlighter size={14} color={boardTool === 'highlighter' ? '#2563EB' : '#475569'} />
              <Text style={[styles.fToolText, boardTool === 'highlighter' && styles.fToolTextActive]}>
                형광펜
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.fToolBtn, boardTool === 'eraser' && styles.fToolBtnActive]}
              onPress={() => setBoardTool('eraser')}
              {...(Platform.OS === 'web' ? ({ onClick: () => setBoardTool('eraser') } as any) : {})}
            >
              <Eraser size={14} color={boardTool === 'eraser' ? '#EF4444' : '#475569'} />
              <Text
                style={[
                  styles.fToolText,
                  boardTool === 'eraser' && { color: '#EF4444', fontWeight: '700' },
                ]}
              >
                지우개
              </Text>
            </TouchableOpacity>
          </View>

          {/* Stroke Width Selector */}
          {boardTool !== 'highlighter' && boardTool !== 'eraser' && (
            <View style={styles.fWidthGroup}>
              {[
                { id: 'w2', val: 2 },
                { id: 'w5', val: 5 },
                { id: 'w10', val: 10 },
              ].map((w) => (
                <TouchableOpacity
                  key={w.id}
                  style={[styles.fWidthBtn, boardWidth === w.val && styles.fWidthBtnActive]}
                  onPress={() => setBoardWidth(w.val)}
                >
                  <View
                    style={{
                      width: w.val * 1.4,
                      height: w.val * 1.4,
                      borderRadius: 10,
                      backgroundColor: boardWidth === w.val ? '#2563EB' : '#94A3B8',
                    }}
                  />
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Color Palette */}
          {boardTool !== 'eraser' && (
            <View style={styles.fColorPalette}>
              {BOARD_PALETTE.map((c) => (
                <TouchableOpacity
                  key={c.id}
                  style={[
                    styles.fColorDot,
                    { backgroundColor: c.color },
                    boardColor === c.color && styles.fColorDotActive,
                  ]}
                  onPress={() => setBoardColor(c.color)}
                />
              ))}
            </View>
          )}

          {/* Undo / Redo / Clear Actions */}
          <View style={styles.fActionGroup}>
            <TouchableOpacity
              onPress={handleBoardUndo}
              {...(Platform.OS === 'web' ? ({ onClick: handleBoardUndo } as any) : {})}
              disabled={boardUndoStack.length === 0}
              style={[styles.fActionBtn, boardUndoStack.length === 0 && { opacity: 0.35 }]}
            >
              <Undo2 size={14} color={boardUndoStack.length === 0 ? '#CBD5E1' : '#475569'} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleBoardRedo}
              {...(Platform.OS === 'web' ? ({ onClick: handleBoardRedo } as any) : {})}
              disabled={boardRedoStack.length === 0}
              style={[styles.fActionBtn, boardRedoStack.length === 0 && { opacity: 0.35 }]}
            >
              <Redo2 size={14} color={boardRedoStack.length === 0 ? '#CBD5E1' : '#475569'} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleBoardClear}
              {...(Platform.OS === 'web' ? ({ onClick: handleBoardClear } as any) : {})}
              style={styles.fActionBtn}
            >
              <Trash2 size={14} color="#EF4444" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* 2D Scrollable Infinite Canvas */}
      <ScrollView
        ref={outerScrollRef}
        horizontal
        scrollEnabled={canvasMode === 'pan' && !isDraggingAny}
        showsHorizontalScrollIndicator={true}
        style={styles.outerScroll}
        contentContainerStyle={[styles.outerScrollContent, { width: CANVAS_WIDTH * zoomLevel }]}
      >
        <ScrollView
          ref={innerScrollRef}
          scrollEnabled={canvasMode === 'pan' && !isDraggingAny}
          showsVerticalScrollIndicator={true}
          style={styles.innerScroll}
          contentContainerStyle={[
            styles.canvasBoard,
            {
              width: CANVAS_WIDTH,
              height: CANVAS_HEIGHT,
              transform: [{ scale: zoomLevel }],
              transformOrigin: 'top left',
            },
          ]}
        >
          {/* Subtle Dot Grid Background */}
          <View style={styles.gridBackgroundLayer} pointerEvents="none">
            {Array.from({ length: 45 }).map((_, r) => (
              <View key={`row-${r}`} style={styles.dotRow}>
                {Array.from({ length: 45 }).map((_, c) => (
                  <View key={`dot-${r}-${c}`} style={styles.gridDot} />
                ))}
              </View>
            ))}
          </View>

          {/* Whiteboard Board Strokes SVG Layer */}
          <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
            <Svg width={CANVAS_WIDTH} height={CANVAS_HEIGHT}>
              {canvasBoardStrokes.map((s) => {
                const d = renderStrokePath(s);
                if (!d) return null;
                const isHl = s.tool === 'highlighter';
                return (
                  <SvgPath
                    key={s.id}
                    d={d}
                    stroke={s.color}
                    strokeWidth={s.width}
                    strokeOpacity={isHl ? 0.4 : 1.0}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                  />
                );
              })}

              {/* Active drawing stroke */}
              {currentBoardStroke && (
                <SvgPath
                  d={renderStrokePath(currentBoardStroke)}
                  stroke={currentBoardStroke.color}
                  strokeWidth={currentBoardStroke.width}
                  strokeOpacity={currentBoardStroke.tool === 'highlighter' ? 0.4 : 1.0}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
              )}
            </Svg>
          </View>

          {/* Interactive Board Drawing Capture Layer (Draw Mode) */}
          {canvasMode === 'draw' && (
            <View
              style={[
                StyleSheet.absoluteFillObject,
                Platform.OS === 'web' && {
                  cursor: boardTool === 'eraser' ? 'crosshair' : 'crosshair',
                },
              ]}
              {...(Platform.OS !== 'web' ? boardPanResponder.panHandlers : {})}
              {...(Platform.OS === 'web'
                ? ({
                    onMouseDown: handleWebMouseDown,
                  } as any)
                : {})}
            />
          )}

          {/* Placed Sticky Notes */}
          {filteredNotes.map((note) => (
            <DraggableSticky
              key={note.id}
              note={note}
              onDragStart={() => setIsDraggingAny(true)}
              onDragEnd={(id, x, y) => {
                setIsDraggingAny(false);
                updateCanvasPosition(id, x, y);
              }}
              onBringToFront={bringToFront}
              onDuplicate={duplicateNote}
            />
          ))}
        </ScrollView>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  bannerGuide: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: '#FDE68A',
    gap: 8,
    flexWrap: 'wrap',
  },
  bannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    minWidth: 200,
  },
  bannerGuideText: {
    fontSize: 11.5,
    color: '#92400E',
    fontWeight: '600',
  },
  modeToggleGroup: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: 8,
    padding: 2,
    borderWidth: 1,
    borderColor: '#FCD34D',
    gap: 2,
  },
  modeToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  modeToggleBtnActive: {
    backgroundColor: '#0F172A',
  },
  modeToggleBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  modeToggleBtnTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  zoomControlGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FCD34D',
  },
  zoomBtn: {
    padding: 3,
  },
  zoomResetBtn: {
    paddingHorizontal: 4,
  },
  zoomText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#0F172A',
  },
  floatingBoardToolbar: {
    position: 'absolute',
    top: 48,
    left: '50%',
    transform: [{ translateX: -230 }],
    zIndex: 10000,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 10,
  },
  floatingToolGroup: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderRadius: 20,
    padding: 2,
    gap: 2,
  },
  fToolBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 16,
  },
  fToolBtnActive: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  fToolText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  fToolTextActive: {
    color: '#2563EB',
    fontWeight: '700',
  },
  fWidthGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 4,
  },
  fWidthBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fWidthBtnActive: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#93C5FD',
  },
  fColorPalette: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  fColorDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  fColorDotActive: {
    borderColor: '#0F172A',
    transform: [{ scale: 1.2 }],
  },
  fActionGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderLeftWidth: 1,
    borderLeftColor: '#E2E8F0',
    paddingLeft: 6,
  },
  fActionBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  outerScroll: {
    flex: 1,
  },
  outerScrollContent: {
    minWidth: CANVAS_WIDTH,
  },
  innerScroll: {
    flex: 1,
  },
  canvasBoard: {
    position: 'relative',
  },
  gridBackgroundLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT,
    padding: 20,
    justifyContent: 'space-between',
  },
  dotRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  gridDot: {
    width: 3.5,
    height: 3.5,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
    opacity: 0.65,
  },
  draggableItem: {
    position: 'absolute',
    width: 280,
  },
  topControlBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  dragHandleTrigger: {
    alignItems: 'center',
  },
  dragPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
    elevation: 3,
  },
  dragPillActive: {
    backgroundColor: '#0F172A',
    borderColor: '#0F172A',
    transform: [{ scale: 1.05 }],
  },
  dragText: {
    fontSize: 10,
    color: '#475569',
    fontWeight: '600',
  },
  dragTextActive: {
    color: '#FFFFFF',
  },
  duplicatePill: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 4,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
});
