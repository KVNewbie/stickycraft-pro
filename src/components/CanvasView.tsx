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
} from 'react-native';
import { StickyCard } from './StickyCard';
import { useNoteStore } from '../store/useNoteStore';
import { Note } from '../types/note';
import {
  Move,
  Sparkles,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Compass,
  Copy,
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
  
  // 현재 실제 좌표를 항상 추적하는 Ref (클로저 트랩 완전 방지)
  const currentPosRef = useRef({ x: note.canvasX || 50, y: note.canvasY || 50 });
  // 각 드래그 제스처 시작 시점의 기준 좌표
  const startPosRef = useRef({ x: note.canvasX || 50, y: note.canvasY || 50 });

  // note.canvasX, canvasY 변경 시 Ref 및 상태 동기화
  useEffect(() => {
    const updated = { x: note.canvasX || 50, y: note.canvasY || 50 };
    setPosition(updated);
    currentPosRef.current = updated;
  }, [note.canvasX, note.canvasY]);

  // PanResponder for smooth 1:1 natural movement
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
        // ★ 핵심: 클로저에 갇힌 초기 state 대신 최신 currentPosRef 사용!
        startPosRef.current = { x: currentPosRef.current.x, y: currentPosRef.current.y };
      },
      onPanResponderMove: (_, gesture) => {
        // 시작 위치 + 누적 델타 = 정확한 1:1 손가락 추적
        const newX = Math.max(10, Math.min(CANVAS_WIDTH - 300, startPosRef.current.x + gesture.dx));
        const newY = Math.max(10, Math.min(CANVAS_HEIGHT - 320, startPosRef.current.y + gesture.dy));
        setPosition({ x: newX, y: newY });
        currentPosRef.current = { x: newX, y: newY };
      },
      // ★ 핵심: 부모 ScrollView 등이 제스처를 절대 가로채지 못하도록 잠금 (Termination 방지)
      onPanResponderTerminationRequest: () => false,
      onPanResponderRelease: (_, gesture) => {
        setIsDragging(false);
        const finalX = Math.max(10, Math.min(CANVAS_WIDTH - 300, startPosRef.current.x + gesture.dx));
        const finalY = Math.max(10, Math.min(CANVAS_HEIGHT - 320, startPosRef.current.y + gesture.dy));
        setPosition({ x: finalX, y: finalY });
        currentPosRef.current = { x: finalX, y: finalY };
        onDragEnd(note.id, finalX, finalY);
      },
      // 만약 시스템 레벨에서 풀리더라도 현재 위치를 안전하게 영구 저장
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

export const CanvasView: React.FC = () => {
  const { notes, activeBoardId, filters, updateCanvasPosition, bringToFront, duplicateNote } =
    useNoteStore();

  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [isDraggingAny, setIsDraggingAny] = useState<boolean>(false);
  const outerScrollRef = useRef<ScrollView>(null);
  const innerScrollRef = useRef<ScrollView>(null);

  const filteredNotes = useMemo(() => {
    return notes.filter((note) => {
      // ColorNote 휴지통 / 보관함 필터 (기본 캔버스에서는 제외)
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

  return (
    <View style={styles.container}>
      {/* Top Guide Bar */}
      <View style={styles.bannerGuide}>
        <View style={styles.bannerLeft}>
          <Sparkles size={14} color="#D97706" />
          <Text style={styles.bannerGuideText}>
            자유 캔버스: 스티커 핸들을 꾹 누르고 움직여 원하는 곳에 자유롭게 배치하세요!
          </Text>
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

      {/* 2D Scrollable Infinite Canvas */}
      <ScrollView
        ref={outerScrollRef}
        horizontal
        scrollEnabled={!isDraggingAny}
        showsHorizontalScrollIndicator={true}
        style={styles.outerScroll}
        contentContainerStyle={[styles.outerScrollContent, { width: CANVAS_WIDTH * zoomLevel }]}
      >
        <ScrollView
          ref={innerScrollRef}
          scrollEnabled={!isDraggingAny}
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
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#FDE68A',
  },
  bannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  bannerGuideText: {
    fontSize: 11.5,
    color: '#92400E',
    fontWeight: '600',
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
    width: 280, // 표준 스티커 메모 가로 폭
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
