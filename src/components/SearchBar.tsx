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
} from 'lucide-react-native';
import { useNoteStore } from '../store/useNoteStore';
import { NOTE_COLORS, COLOR_KEYS } from '../constants/colors';
import { NoteColorId, SortOption } from '../types/note';

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
  } = useNoteStore();

  // 모든 메모에서 사용된 태그 고유 목록 추출
  const availableTags = useMemo(() => {
    const set = new Set<string>();
    notes.forEach((n) => n.tags.forEach((t) => set.add(t)));
    return Array.from(set);
  }, [notes]);

  const hasActiveFilters =
    filters.searchQuery.trim() !== '' ||
    filters.selectedTag !== null ||
    filters.selectedColor !== null ||
    filters.onlyPinned ||
    filters.onlyHasImages ||
    filters.onlyChecklist ||
    filters.sortBy !== 'updated';

  return (
    <View style={styles.container}>
      {/* Search Input Box */}
      <View style={styles.inputWrapper}>
        <Search size={16} color="#94A3B8" />
        <TextInput
          style={styles.input}
          placeholder="메모 제목, 내용, 태그 검색..."
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
});
