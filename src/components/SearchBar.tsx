import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import {
  Search,
  X,
  Pin,
  Image as ImageIcon,
  CheckSquare,
  RotateCcw,
  Tag,
  ArrowUpDown,
  FileText,
  ListCheck,
  Mic,
  Sparkles,
  ChevronRight,
} from 'lucide-react-native';
import { useNoteStore } from '../store/useNoteStore';
import { NOTE_COLORS, COLOR_KEYS } from '../constants/colors';
import { NoteColorId, SortOption, Note } from '../types/note';

const SORT_OPTIONS: { id: SortOption; label: string }[] = [
  { id: 'updated', label: '최근 수정순' },
  { id: 'created', label: '작성일순' },
  { id: 'title', label: '제목순' },
  { id: 'color', label: 'ColorNote 색상순' },
  { id: 'reminder', label: '알람/리마인더순' },
];

export const SearchBar: React.FC = () => {
  const {
    notes,
    filters,
    setSearchQuery,
    setSelectedTag,
    setSelectedColor,
    toggleFilterPinned,
    toggleFilterImages,
    toggleFilterChecklist,
    setSortBy,
    resetFilters,
    openEditNoteEditor,
    openLockModal,
  } = useNoteStore();

  // 모든 메모에서 사용된 태그 고유 목록 추출
  const availableTags = useMemo(() => {
    const set = new Set<string>();
    notes.forEach((n) => n.tags.forEach((t) => set.add(t)));
    return Array.from(set);
  }, [notes]);

  // 통합 검색 인덱스 매칭 목록
  const indexedMatches = useMemo(() => {
    const q = filters.searchQuery.trim().toLowerCase();
    if (!q) return [];

    return notes
      .filter((n) => !n.isDeleted)
      .map((note) => {
        let field: 'title' | 'content' | 'checklist' | 'tag' | 'audio' | null = null;
        let snippet = '';

        if (note.title && note.title.toLowerCase().includes(q)) {
          field = 'title';
          snippet = note.title;
        } else if (note.content && note.content.toLowerCase().includes(q)) {
          field = 'content';
          const idx = note.content.toLowerCase().indexOf(q);
          const start = Math.max(0, idx - 15);
          const end = Math.min(note.content.length, idx + q.length + 30);
          snippet = (start > 0 ? '...' : '') + note.content.substring(start, end) + (end < note.content.length ? '...' : '');
        } else if (note.checklist && note.checklist.some((c) => c.text.toLowerCase().includes(q))) {
          field = 'checklist';
          const matchItem = note.checklist.find((c) => c.text.toLowerCase().includes(q));
          snippet = `할 일: ${matchItem?.text || ''}`;
        } else if (note.tags && note.tags.some((t) => t.toLowerCase().includes(q))) {
          field = 'tag';
          snippet = `태그: #${note.tags.join(' #')}`;
        } else if (note.audioNotes && note.audioNotes.some((a) => (a.title || '').toLowerCase().includes(q))) {
          field = 'audio';
          const matchA = note.audioNotes.find((a) => (a.title || '').toLowerCase().includes(q));
          snippet = `음성 녹음: ${matchA?.title || ''}`;
        }

        if (!field) return null;
        return { note, field, snippet };
      })
      .filter(Boolean) as { note: Note; field: string; snippet: string }[];
  }, [notes, filters.searchQuery]);

  const hasActiveFilters =
    filters.searchQuery.trim() !== '' ||
    filters.selectedTag !== null ||
    filters.selectedColor !== null ||
    filters.onlyPinned ||
    filters.onlyHasImages ||
    filters.onlyChecklist ||
    filters.sortBy !== 'updated';

  const handleOpenNote = (note: Note) => {
    if (note.isLocked) {
      openLockModal(note, () => openEditNoteEditor(note));
    } else {
      openEditNoteEditor(note);
    }
  };

  return (
    <View style={styles.container}>
      {/* Search Input Box */}
      <View style={styles.inputWrapper}>
        <Search size={16} color="#94A3B8" />
        <TextInput
          style={styles.input}
          placeholder="메모 제목, 내용, 태그, 체크리스트 통합 검색..."
          placeholderTextColor="#94A3B8"
          value={filters.searchQuery}
          onChangeText={setSearchQuery}
        />
        {filters.searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <X size={16} color="#64748B" />
          </TouchableOpacity>
        )}
      </View>

      {/* 실시간 통합 검색 인덱스 팝업/서머리 */}
      {filters.searchQuery.trim().length > 0 && (
        <View style={styles.indexBox}>
          <View style={styles.indexHeader}>
            <View style={styles.indexTitleRow}>
              <Sparkles size={13} color="#2563EB" />
              <Text style={styles.indexTitle}>
                통합 검색 인덱스: "{filters.searchQuery}" ({indexedMatches.length}건 일치)
              </Text>
            </View>
          </View>

          {indexedMatches.length > 0 ? (
            <ScrollView
              style={styles.indexListScroll}
              nestedScrollEnabled
              showsVerticalScrollIndicator={false}
            >
              {indexedMatches.slice(0, 4).map(({ note, field, snippet }) => {
                const colorCfg = NOTE_COLORS[note.color] || NOTE_COLORS.yellow;
                return (
                  <TouchableOpacity
                    key={note.id}
                    style={styles.indexResultItem}
                    onPress={() => handleOpenNote(note)}
                    activeOpacity={0.7}
                  >
                    <View
                      style={[
                        styles.indexItemColorDot,
                        { backgroundColor: colorCfg.cardBorder },
                      ]}
                    />
                    <View style={styles.indexItemTextWrap}>
                      <Text style={styles.indexItemTitle} numberOfLines={1}>
                        {note.title || '제목 없음'}
                      </Text>
                      <Text style={styles.indexItemSnippet} numberOfLines={1}>
                        {snippet}
                      </Text>
                    </View>
                    <ChevronRight size={14} color="#94A3B8" />
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          ) : (
            <Text style={styles.indexEmptyText}>일치하는 메모 내용이 없습니다.</Text>
          )}
        </View>
      )}

      {/* Sort Options Bar (ColorNote Feature) */}
      <View style={styles.sortBar}>
        <View style={styles.sortLabelWrap}>
          <ArrowUpDown size={12} color="#64748B" />
          <Text style={styles.sortLabel}>정렬:</Text>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.sortScrollContent}
        >
          {SORT_OPTIONS.map((opt) => {
            const isSelected = (filters.sortBy || 'updated') === opt.id;
            return (
              <TouchableOpacity
                key={opt.id}
                style={[styles.sortChip, isSelected && styles.sortChipActive]}
                onPress={() => setSortBy(opt.id)}
              >
                <Text
                  style={[
                    styles.sortChipText,
                    isSelected && styles.sortChipTextActive,
                  ]}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Filter Quick Pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.pillsScroll}
        contentContainerStyle={styles.pillsContent}
      >
        {/* Reset Button */}
        {hasActiveFilters && (
          <TouchableOpacity style={styles.resetBtn} onPress={resetFilters}>
            <RotateCcw size={12} color="#DC2626" />
            <Text style={styles.resetBtnText}>필터 초기화</Text>
          </TouchableOpacity>
        )}

        {/* Pinned filter */}
        <TouchableOpacity
          style={[styles.filterPill, filters.onlyPinned && styles.filterPillActive]}
          onPress={toggleFilterPinned}
        >
          <Pin size={12} color={filters.onlyPinned ? '#FFFFFF' : '#475569'} />
          <Text
            style={[
              styles.filterPillText,
              filters.onlyPinned && styles.filterPillTextActive,
            ]}
          >
            고정 메모
          </Text>
        </TouchableOpacity>

        {/* Images filter */}
        <TouchableOpacity
          style={[
            styles.filterPill,
            filters.onlyHasImages && styles.filterPillActive,
          ]}
          onPress={toggleFilterImages}
        >
          <ImageIcon size={12} color={filters.onlyHasImages ? '#FFFFFF' : '#475569'} />
          <Text
            style={[
              styles.filterPillText,
              filters.onlyHasImages && styles.filterPillTextActive,
            ]}
          >
            사진 포함
          </Text>
        </TouchableOpacity>

        {/* Checklist filter */}
        <TouchableOpacity
          style={[
            styles.filterPill,
            filters.onlyChecklist && styles.filterPillActive,
          ]}
          onPress={toggleFilterChecklist}
        >
          <CheckSquare size={12} color={filters.onlyChecklist ? '#FFFFFF' : '#475569'} />
          <Text
            style={[
              styles.filterPillText,
              filters.onlyChecklist && styles.filterPillTextActive,
            ]}
          >
            할 일 목록
          </Text>
        </TouchableOpacity>

        {/* Color Palette Filter */}
        <View style={styles.colorFilterGroup}>
          {COLOR_KEYS.slice(0, 8).map((cKey) => {
            const isSelected = filters.selectedColor === cKey;
            const colorCfg = NOTE_COLORS[cKey];
            return (
              <TouchableOpacity
                key={cKey}
                onPress={() => setSelectedColor(isSelected ? null : cKey)}
                style={[
                  styles.colorDot,
                  { backgroundColor: colorCfg.bg, borderColor: colorCfg.cardBorder },
                  isSelected && styles.colorDotSelected,
                ]}
              />
            );
          })}
        </View>

        {/* Tags Chips */}
        {availableTags.map((tag) => {
          const isSelected = filters.selectedTag === tag;
          return (
            <TouchableOpacity
              key={tag}
              onPress={() => setSelectedTag(isSelected ? null : tag)}
              style={[styles.tagChip, isSelected && styles.tagChipSelected]}
            >
              <Tag size={10} color={isSelected ? '#FFFFFF' : '#64748B'} />
              <Text
                style={[styles.tagChipText, isSelected && styles.tagChipTextActive]}
              >
                #{tag}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 40,
    gap: 8,
  },
  input: {
    flex: 1,
    fontSize: 13.5,
    color: '#0F172A',
    paddingVertical: 0,
  },
  sortBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 6,
  },
  sortLabelWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  sortLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  sortScrollContent: {
    gap: 6,
    paddingRight: 10,
  },
  sortChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sortChipActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#3B82F6',
  },
  sortChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  sortChipTextActive: {
    color: '#1D4ED8',
    fontWeight: '700',
  },
  pillsScroll: {
    marginTop: 8,
  },
  pillsContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingRight: 12,
  },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
  },
  resetBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#DC2626',
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
  },
  filterPillActive: {
    backgroundColor: '#0F172A',
    borderColor: '#0F172A',
  },
  filterPillText: {
    fontSize: 11.5,
    color: '#475569',
    fontWeight: '500',
  },
  filterPillTextActive: {
    color: '#FFFFFF',
  },
  colorFilterGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 4,
  },
  colorDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
  },
  colorDotSelected: {
    borderColor: '#0F172A',
    transform: [{ scale: 1.2 }],
  },
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 4.5,
    borderRadius: 10,
  },
  tagChipSelected: {
    backgroundColor: '#3B82F6',
  },
  tagChipText: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '500',
  },
  tagChipTextActive: {
    color: '#FFFFFF',
  },
  indexBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 8,
    padding: 10,
  },
  indexHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  indexTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  indexTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1D4ED8',
  },
  indexListScroll: {
    maxHeight: 180,
  },
  indexResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 8,
    marginVertical: 3,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8,
  },
  indexItemColorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  indexItemTextWrap: {
    flex: 1,
  },
  indexItemTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  indexItemSnippet: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  indexEmptyText: {
    fontSize: 12,
    color: '#94A3B8',
    paddingVertical: 6,
    textAlign: 'center',
  },
});
