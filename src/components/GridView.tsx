import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  useWindowDimensions,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { StickyCard } from './StickyCard';
import { useNoteStore } from '../store/useNoteStore';
import {
  Pin,
  Sparkles,
  Plus,
  LayoutGrid,
  List,
  CheckSquare,
  Image as ImageIcon,
  X,
  ArrowUpDown,
} from 'lucide-react-native';
import { Ionicons } from '@expo/vector-icons';
import { Note, SortOption } from '../types/note';
import { NOTE_COLORS, COLOR_KEYS } from '../constants/colors';

/**
 * ColorNote 스타일 컴팩트 리스트 아이템
 */
const NoteListItem: React.FC<{ note: Note }> = ({ note }) => {
  const { openEditNoteEditor, openLockModal, togglePin } = useNoteStore();
  const colorCfg = NOTE_COLORS[note.color] || NOTE_COLORS.yellow;
  const formattedDate = new Date(note.updatedAt).toLocaleDateString('ko-KR', {
    month: 'short',
    day: 'numeric',
  });

  const handlePress = () => {
    if (note.isLocked) {
      openLockModal(note, () => openEditNoteEditor(note));
    } else {
      openEditNoteEditor(note);
    }
  };

  const checklistCount = note.checklist ? note.checklist.length : 0;
  const completedCount = note.checklist ? note.checklist.filter((c) => c.completed).length : 0;

  return (
    <TouchableOpacity
      style={styles.listItemCard}
      onPress={handlePress}
      activeOpacity={0.7}
      {...(Platform.OS === 'web' ? ({ onClick: handlePress } as any) : {})}
    >
      {/* Left Color Indicator Bar (ColorNote Signature) */}
      <View style={[styles.listColorBar, { backgroundColor: colorCfg.cardBorder }]} />

      <View style={styles.listItemBody}>
        {/* Title row */}
        <View style={styles.listTitleRow}>
          {note.isLocked ? (
            <Ionicons name="lock-closed" size={14} color="#EF4444" style={{ marginRight: 5 }} />
          ) : null}
          <Text style={styles.listTitleText} numberOfLines={1}>
            {note.isLocked ? '비밀번호로 보호된 메모' : note.title || '제목 없음'}
          </Text>
          <TouchableOpacity
            style={styles.listPinTouchArea}
            onPress={(e) => {
              e.stopPropagation();
              togglePin(note.id);
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            {...(Platform.OS === 'web'
              ? ({
                  onClick: (e: any) => {
                    e.stopPropagation();
                    togglePin(note.id);
                  },
                } as any)
              : {})}
          >
            <Pin
              size={13}
              color={note.isPinned ? '#E11D48' : '#CBD5E1'}
              fill={note.isPinned ? '#E11D48' : 'none'}
            />
          </TouchableOpacity>
        </View>

        {/* Content Preview / Checklist Preview */}
        {!note.isLocked && (
          <Text style={styles.listSnippetText} numberOfLines={1}>
            {note.content
              ? note.content.replace(/\n/g, ' ')
              : checklistCount > 0
              ? note.checklist.map((c) => c.text).join(' • ')
              : '내용 없음'}
          </Text>
        )}

        {/* Badges Row */}
        <View style={styles.listMetaRow}>
          {checklistCount > 0 && (
            <View style={styles.listBadge}>
              <CheckSquare size={11} color="#059669" />
              <Text style={styles.listBadgeText}>
                {completedCount}/{checklistCount}
              </Text>
            </View>
          )}
          {note.images && note.images.length > 0 && (
            <View style={styles.listBadge}>
              <ImageIcon size={11} color="#2563EB" />
              <Text style={styles.listBadgeText}>{note.images.length}</Text>
            </View>
          )}
          {(note.freeDrawingData || (note.strokes && note.strokes.length > 0)) && (
            <View style={styles.listBadge}>
              <Ionicons name="brush" size={11} color="#7C3AED" />
              <Text style={[styles.listBadgeText, { color: '#7C3AED' }]}>손글씨</Text>
            </View>
          )}
          {note.reminder && (
            <View style={[styles.listBadge, { backgroundColor: '#FEE2E2' }]}>
              <Ionicons name="alarm" size={11} color="#DC2626" />
              <Text style={[styles.listBadgeText, { color: '#DC2626' }]}>
                {note.reminder.date}
              </Text>
            </View>
          )}
          <Text style={styles.listDateText}>{formattedDate}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

export const GridView: React.FC = () => {
  const { width } = useWindowDimensions();
  const {
    notes,
    activeBoardId,
    filters,
    openNewNoteEditor,
    setListLayout,
    setSelectedColor,
    setSearchQuery,
    setSortBy,
  } = useNoteStore();

  const isListMode = filters.listLayout === 'list';

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

  // 컬럼별로 고르게 분배하는 함수 (그리드 모드 전용)
  const distributeToColumns = (list: typeof notes, cols: number) => {
    const columns: (typeof notes)[] = Array.from({ length: cols }, () => []);
    list.forEach((item, index) => {
      columns[index % cols].push(item);
    });
    return columns;
  };

  const pinnedColumns = useMemo(
    () => distributeToColumns(pinnedNotes, numColumns),
    [pinnedNotes, numColumns]
  );
  const otherColumns = useMemo(
    () => distributeToColumns(otherNotes, numColumns),
    [otherNotes, numColumns]
  );

  return (
    <View style={styles.container}>
      {/* ColorNote 스타일 상단 서브 헤더 (카운트, 그리드/리스트 전환, 1-Tap 퀵 컬러 스트립) */}
      <View style={styles.topControlSection}>
        <View style={styles.topControlRow}>
          <Text style={styles.noteCountText}>
            {filters.selectedColor
              ? `${NOTE_COLORS[filters.selectedColor]?.name} 메모 `
              : '전체 메모 '}
            <Text style={styles.noteCountBold}>({filteredNotes.length})</Text>
          </Text>

          {/* ColorNote 스타일 우측 컨트롤: 정렬 셀렉터 & 레이아웃 토글 */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {/* 정렬 순서 변경 버튼 */}
            <TouchableOpacity
              style={styles.sortSelectorBtn}
              onPress={() => {
                const sortList: SortOption[] = ['updated', 'created', 'title', 'color'];
                const cur = filters.sortBy || 'updated';
                const next = sortList[(sortList.indexOf(cur) + 1) % sortList.length];
                setSortBy(next);
              }}
              activeOpacity={0.7}
              {...(Platform.OS === 'web'
                ? ({
                    onClick: () => {
                      const sortList: SortOption[] = ['updated', 'created', 'title', 'color'];
                      const cur = filters.sortBy || 'updated';
                      const next = sortList[(sortList.indexOf(cur) + 1) % sortList.length];
                      setSortBy(next);
                    },
                  } as any)
                : {})}
            >
              <ArrowUpDown size={12} color="#475569" />
              <Text style={styles.sortSelectorText}>
                {filters.sortBy === 'created'
                  ? '생성일순'
                  : filters.sortBy === 'title'
                  ? '가나다순'
                  : filters.sortBy === 'color'
                  ? '색상순'
                  : '최신순'}
              </Text>
            </TouchableOpacity>

            {/* Grid vs List Layout Toggle */}
            <View style={styles.layoutToggleGroup}>
              <TouchableOpacity
                style={[styles.layoutToggleBtn, !isListMode && styles.layoutToggleBtnActive]}
                onPress={() => setListLayout('grid')}
                activeOpacity={0.8}
              >
                <LayoutGrid size={13} color={!isListMode ? '#0F172A' : '#94A3B8'} />
                <Text style={[styles.layoutToggleText, !isListMode && styles.layoutToggleTextActive]}>
                  그리드
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.layoutToggleBtn, isListMode && styles.layoutToggleBtnActive]}
                onPress={() => setListLayout('list')}
                activeOpacity={0.8}
              >
                <List size={14} color={isListMode ? '#0F172A' : '#94A3B8'} />
                <Text style={[styles.layoutToggleText, isListMode && styles.layoutToggleTextActive]}>
                  리스트
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* 1-Tap Quick Color Bar (ColorNote Benchmark) */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.quickColorScroll}
        >
          <TouchableOpacity
            style={[
              styles.quickColorAllBtn,
              !filters.selectedColor && styles.quickColorAllBtnActive,
            ]}
            onPress={() => setSelectedColor(null)}
          >
            <Text
              style={[
                styles.quickColorAllText,
                !filters.selectedColor && styles.quickColorAllTextActive,
              ]}
            >
              전체
            </Text>
          </TouchableOpacity>
          {COLOR_KEYS.map((cKey) => {
            const isSelected = filters.selectedColor === cKey;
            const c = NOTE_COLORS[cKey];
            return (
              <TouchableOpacity
                key={cKey}
                onPress={() => setSelectedColor(isSelected ? null : cKey)}
                style={[
                  styles.quickColorDot,
                  { backgroundColor: c.bg, borderColor: c.cardBorder },
                  isSelected && styles.quickColorDotSelected,
                ]}
                hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
              >
                {isSelected && (
                  <View style={[styles.quickColorDotInner, { backgroundColor: c.text }]} />
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* 검색어가 활성화된 경우 표시되는 퀵 배너 및 원클릭 초기화 */}
        {filters.searchQuery.trim() ? (
          <View style={styles.searchBannerRow}>
            <View style={styles.searchBadge}>
              <Text style={styles.searchBadgeText}>
                검색: "{filters.searchQuery}" ({filteredNotes.length}개 일치)
              </Text>
            </View>
            <TouchableOpacity
              style={styles.searchClearBtn}
              onPress={() => setSearchQuery('')}
              {...(Platform.OS === 'web' ? ({ onClick: () => setSearchQuery('') } as any) : {})}
            >
              <X size={13} color="#64748B" />
              <Text style={styles.searchClearBtnText}>초기화</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>

      {/* Empty State */}
      {filteredNotes.length === 0 ? (
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
      ) : (
        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Pinned Section */}
          {pinnedNotes.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Pin size={13} color="#E11D48" fill="#E11D48" />
                <Text style={styles.sectionTitle}>고정된 메모 ({pinnedNotes.length})</Text>
              </View>

              {isListMode ? (
                <View style={styles.listContainer}>
                  {pinnedNotes.map((note) => (
                    <NoteListItem key={note.id} note={note} />
                  ))}
                </View>
              ) : (
                <View style={styles.gridRow}>
                  {pinnedColumns.map((col, colIdx) => (
                    <View key={`pin-col-${colIdx}`} style={styles.gridCol}>
                      {col.map((note) => (
                        <StickyCard key={note.id} note={note} isCanvasItem={false} />
                      ))}
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* Other Notes Section */}
          {otherNotes.length > 0 && (
            <View style={styles.section}>
              {pinnedNotes.length > 0 && (
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>모든 메모 ({otherNotes.length})</Text>
                </View>
              )}

              {isListMode ? (
                <View style={styles.listContainer}>
                  {otherNotes.map((note) => (
                    <NoteListItem key={note.id} note={note} />
                  ))}
                </View>
              ) : (
                <View style={styles.gridRow}>
                  {otherColumns.map((col, colIdx) => (
                    <View key={`other-col-${colIdx}`} style={styles.gridCol}>
                      {col.map((note) => (
                        <StickyCard key={note.id} note={note} isCanvasItem={false} />
                      ))}
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  topControlSection: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 8,
    gap: 8,
  },
  topControlRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  noteCountText: {
    fontSize: 12.5,
    color: '#64748B',
    fontWeight: '500',
  },
  noteCountBold: {
    fontWeight: '700',
    color: '#0F172A',
  },
  layoutToggleGroup: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    padding: 2,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  layoutToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  layoutToggleBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  layoutToggleText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94A3B8',
  },
  layoutToggleTextActive: {
    color: '#0F172A',
  },
  quickColorScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 2,
  },
  quickColorAllBtn: {
    paddingHorizontal: 10,
    paddingVertical: 3.5,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  quickColorAllBtnActive: {
    backgroundColor: '#0F172A',
    borderColor: '#0F172A',
  },
  quickColorAllText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  quickColorAllTextActive: {
    color: '#FFFFFF',
  },
  quickColorDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickColorDotSelected: {
    transform: [{ scale: 1.15 }],
    borderColor: '#0F172A',
  },
  quickColorDotInner: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 110,
  },
  section: {
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    fontSize: 12,
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
  listContainer: {
    gap: 8,
  },
  listItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  listColorBar: {
    width: 6,
    alignSelf: 'stretch',
  },
  listItemBody: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 3,
  },
  listTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  listTitleText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    flex: 1,
  },
  listSnippetText: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 16,
  },
  listMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  listBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  listBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#475569',
  },
  listDateText: {
    fontSize: 10.5,
    color: '#94A3B8',
    marginLeft: 'auto',
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
  searchBannerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  searchBadge: {
    flex: 1,
  },
  searchBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1D4ED8',
  },
  searchClearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    ...Platform.select({
      web: {
        cursor: 'pointer',
      },
    }),
  },
  searchClearBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1E40AF',
  },
  listPinTouchArea: {
    padding: 3,
    marginLeft: 6,
  },
  sortSelectorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...Platform.select({
      web: {
        cursor: 'pointer',
      },
    }),
  },
  sortSelectorText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
});
