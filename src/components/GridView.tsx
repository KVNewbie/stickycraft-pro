import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  useWindowDimensions,
  TouchableOpacity,
} from 'react-native';
import { StickyCard } from './StickyCard';
import { useNoteStore } from '../store/useNoteStore';
import { Pin, Sparkles, Plus } from 'lucide-react-native';

export const GridView: React.FC = () => {
  const { width } = useWindowDimensions();
  const { notes, activeBoardId, filters, openNewNoteEditor } = useNoteStore();

  // 화면 너비에 따라 컬럼 수 결정 (모바일: 2컬럼, 태블릿/웹: 3~4컬럼)
  const numColumns = width > 900 ? 4 : width > 600 ? 3 : 2;

  // 필터링 및 정렬 적용
  const filteredNotes = useMemo(() => {
    const list = notes.filter((note) => {
      // ColorNote 휴지통 / 보관함 필터 (기본 그리드에서는 제외)
      if (note.isDeleted) return false;
      if (note.isArchived && !filters.showArchived) return false;

      // 보드 필터
      if (activeBoardId !== 'all' && note.boardId !== activeBoardId) {
        return false;
      }
      // 검색어 필터 (제목, 본문, 체크리스트, 태그)
      if (filters.searchQuery.trim()) {
        const q = filters.searchQuery.toLowerCase();
        const inTitle = (note.title || '').toLowerCase().includes(q);
        const inContent = (note.content || '').toLowerCase().includes(q);
        const inTags = (note.tags || []).some((t) => t.toLowerCase().includes(q));
        const inCheck = (note.checklist || []).some((c) => c.text.toLowerCase().includes(q));
        if (!inTitle && !inContent && !inTags && !inCheck) return false;
      }
      // 태그 필터
      if (filters.selectedTag && (!note.tags || !note.tags.includes(filters.selectedTag))) {
        return false;
      }
      // 색상 필터
      if (filters.selectedColor && note.color !== filters.selectedColor) {
        return false;
      }
      // 핀만 보기
      if (filters.onlyPinned && !note.isPinned) {
        return false;
      }
      // 사진 있는 메모만
      if (filters.onlyHasImages && (!note.images || note.images.length === 0)) {
        return false;
      }
      // 체크리스트 있는 메모만
      if (filters.onlyChecklist && (!note.checklist || note.checklist.length === 0)) {
        return false;
      }
      return true;
    });

    // ColorNote 다중 정렬 알고리즘
    const sortBy = filters.sortBy || 'updated';
    const COLOR_ORDER: Record<string, number> = {
      yellow: 1,
      orange: 2,
      peach: 3,
      green: 4,
      mint: 5,
      sky: 6,
      blue: 7,
      pink: 8,
      purple: 9,
      lavender: 10,
      cream: 11,
      white: 12,
      gray: 13,
      dark: 14,
    };

    return list.sort((a, b) => {
      if (sortBy === 'created') {
        return (b.createdAt || 0) - (a.createdAt || 0);
      }
      if (sortBy === 'title') {
        return (a.title || '').localeCompare(b.title || '');
      }
      if (sortBy === 'color') {
        const orderA = COLOR_ORDER[a.color] || 99;
        const orderB = COLOR_ORDER[b.color] || 99;
        if (orderA !== orderB) return orderA - orderB;
        return (b.updatedAt || 0) - (a.updatedAt || 0);
      }
      if (sortBy === 'reminder') {
        const hasRemA = a.reminder ? 1 : 0;
        const hasRemB = b.reminder ? 1 : 0;
        if (hasRemA !== hasRemB) return hasRemB - hasRemA;
        if (a.reminder && b.reminder) {
          return (a.reminder.date || '').localeCompare(b.reminder.date || '');
        }
        return (b.updatedAt || 0) - (a.updatedAt || 0);
      }
      // Default: 'updated'
      return (b.updatedAt || 0) - (a.updatedAt || 0);
    });
  }, [notes, activeBoardId, filters]);

  // 핀 고정 메모와 일반 메모 분리
  const pinnedNotes = useMemo(() => filteredNotes.filter((n) => n.isPinned), [filteredNotes]);
  const otherNotes = useMemo(() => filteredNotes.filter((n) => !n.isPinned), [filteredNotes]);

  // 컬럼별로 고르게 분배하는 함수
  const distributeToColumns = (list: typeof notes, cols: number) => {
    const columns: (typeof notes)[] = Array.from({ length: cols }, () => []);
    list.forEach((item, index) => {
      columns[index % cols].push(item);
    });
    return columns;
  };

  const pinnedColumns = useMemo(() => distributeToColumns(pinnedNotes, numColumns), [pinnedNotes, numColumns]);
  const otherColumns = useMemo(() => distributeToColumns(otherNotes, numColumns), [otherNotes, numColumns]);

  if (filteredNotes.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyIconBg}>
          <Sparkles size={36} color="#EAB308" />
        </View>
        <Text style={styles.emptyTitle}>메모가 비어있습니다</Text>
        <Text style={styles.emptySubtitle}>
          새로운 스티커 메모를 추가하여 아이디어, 사진, 할 일을 기록해 보세요!
        </Text>
        <TouchableOpacity style={styles.emptyCreateBtn} onPress={openNewNoteEditor}>
          <Plus size={18} color="#FFFFFF" />
          <Text style={styles.emptyCreateBtnText}>첫 스티커 메모 작성하기</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* 핀 고정 섹션 (Pinned Section) */}
      {pinnedNotes.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Pin size={14} color="#E11D48" fill="#E11D48" />
            <Text style={styles.sectionTitle}>고정된 메모 ({pinnedNotes.length})</Text>
          </View>
          <View style={styles.gridRow}>
            {pinnedColumns.map((col, colIdx) => (
              <View key={`pin-col-${colIdx}`} style={styles.gridCol}>
                {col.map((note) => (
                  <StickyCard key={note.id} note={note} isCanvasItem={false} />
                ))}
              </View>
            ))}
          </View>
        </View>
      )}

      {/* 일반 메모 섹션 (Other Notes Section) */}
      {otherNotes.length > 0 && (
        <View style={styles.section}>
          {pinnedNotes.length > 0 && (
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>모든 메모 ({otherNotes.length})</Text>
            </View>
          )}
          <View style={styles.gridRow}>
            {otherColumns.map((col, colIdx) => (
              <View key={`other-col-${colIdx}`} style={styles.gridCol}>
                {col.map((note) => (
                  <StickyCard key={note.id} note={note} isCanvasItem={false} />
                ))}
              </View>
            ))}
          </View>
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 12,
    paddingTop: 16,
    paddingBottom: 120, // 하단 배너 광고 및 FAB 공간 확보
  },
  section: {
    marginBottom: 18,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  gridRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  gridCol: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingBottom: 80,
  },
  emptyIconBg: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#FEF9C3',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: '#CA8A04',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 3,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 13.5,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  emptyCreateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#0F172A',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 4,
  },
  emptyCreateBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
