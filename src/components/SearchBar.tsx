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
import { getSampleDocumentForNote } from '../constants/sampleDocuments';

const SORT_OPTIONS: { id: SortOption; label: string }[] = [
  { id: 'updated', label: '최근 수정순' },
  { id: 'created', label: '작성일순' },
  { id: 'title', label: '제목순' },
  { id: 'color', label: 'ColorNote 색상순' },
  { id: 'reminder', label: '알람/리마인더순' },
];

interface IndexedSearchMatch {
  key: string;
  note: Note;
  field: 'title' | 'content' | 'checklist' | 'tag' | 'audio' | 'pdf_page' | 'textbox' | 'comment';
  snippet: string;
  pageNumber?: number;
}

function buildSentenceSnippet(text: string, q: string): string {
  const clean = (text || '').replace(/\s+/g, ' ').trim();
  const idx = clean.toLowerCase().indexOf(q);
  if (idx < 0) return clean.slice(0, 64);
  const start = Math.max(0, idx - 18);
  const end = Math.min(clean.length, idx + q.length + 38);
  return (start > 0 ? '...' : '') + clean.slice(start, end) + (end < clean.length ? '...' : '');
}

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
    openPdfNoteAtPage,
    openPdfSourceLink,
  } = useNoteStore();

  // 모든 메모에서 사용된 태그 고유 목록 추출
  const availableTags = useMemo(() => {
    const set = new Set<string>();
    notes.forEach((n) => n.tags.forEach((t) => set.add(t)));
    return Array.from(set);
  }, [notes]);

  // 통합 검색 인덱스 매칭 목록 (메모 본문 · 체크 항목 · PDF 페이지별 원문 · 발췌 · 필기 텍스트 상자 통합)
  const indexedMatches = useMemo(() => {
    const q = filters.searchQuery.trim().toLowerCase();
    if (!q) return [];

    const results: IndexedSearchMatch[] = [];

    for (const note of notes) {
      if (note.isDeleted) continue;

      if (note.isLocked) {
        if (note.title && note.title.toLowerCase().includes(q)) {
          results.push({
            key: `${note.id}_locked_title`,
            note,
            field: 'title',
            snippet: '🔒 비밀번호로 보호된 메모',
          });
        } else if (note.tags && note.tags.some((t) => t.toLowerCase().includes(q))) {
          results.push({
            key: `${note.id}_locked_tag`,
            note,
            field: 'tag',
            snippet: `🔒 잠긴 메모 • 태그: #${note.tags.join(' #')}`,
          });
        }
        continue;
      }

      // 1. PDF 문서 페이지별 본문 검색 (문서명 · 쪽수 · 일치 문장)
      const isPdf =
        note.noteType === 'pdf' ||
        Boolean(note.pdfPages && note.pdfPages.length > 0) ||
        Boolean(note.pdfName);
      const pdfPages =
        note.pdfPages && note.pdfPages.length > 0
          ? note.pdfPages
          : isPdf
          ? getSampleDocumentForNote(note.title, note.pdfName)?.pages || []
          : [];

      let matchedInPdfPages = false;
      for (let i = 0; i < pdfPages.length; i++) {
        const p = pdfPages[i];
        const pNum = p.pageNumber || i + 1;
        const pageFullText = [p.title, p.subtitle || '', p.content || ''].join(' ');
        if (pageFullText.toLowerCase().includes(q)) {
          matchedInPdfPages = true;
          results.push({
            key: `${note.id}_pdfp_${pNum}`,
            note,
            field: 'pdf_page',
            pageNumber: pNum,
            snippet: `P.${pNum}쪽 • ${buildSentenceSnippet(pageFullText, q)}`,
          });
        }
      }

      // 2. PDF / 캔버스 자유 텍스트 상자(필기 텍스트) 검색
      if (note.textBoxes && note.textBoxes.length > 0) {
        for (const tb of note.textBoxes) {
          if (tb.text && tb.text.toLowerCase().includes(q)) {
            const pNum = tb.pageIndex || 1;
            results.push({
              key: `${note.id}_tb_${tb.id}`,
              note,
              field: 'textbox',
              pageNumber: pNum,
              snippet: `P.${pNum}쪽 필기 텍스트 • ${buildSentenceSnippet(tb.text, q)}`,
            });
          }
        }
      }

      // 3. 스레드 댓글 검색
      if (note.pdfComments && note.pdfComments.length > 0) {
        for (const c of note.pdfComments) {
          const hitMsg = (c.messages || []).find((m) => (m.text || '').toLowerCase().includes(q));
          if (hitMsg) {
            results.push({
              key: `${note.id}_cmnt_${c.id}`,
              note,
              field: 'comment',
              pageNumber: c.pageIndex || 1,
              snippet: `P.${c.pageIndex || 1}쪽 댓글 • ${buildSentenceSnippet(hitMsg.text, q)}`,
            });
          }
        }
      }

      if (matchedInPdfPages) continue;

      // 4. 일반 메모 / 발췌 스티커 / 체크리스트 검색
      if (note.content && note.content.toLowerCase().includes(q)) {
        const srcLink = note.pdfSourceLink;
        const prefix = srcLink
          ? `[발췌 원문 P.${srcLink.fallbackPageNumber}쪽] `
          : '';
        results.push({
          key: `${note.id}_content`,
          note,
          field: 'content',
          pageNumber: srcLink?.fallbackPageNumber,
          snippet: `${prefix}${buildSentenceSnippet(note.content, q)}`,
        });
      } else if (note.title && note.title.toLowerCase().includes(q)) {
        results.push({
          key: `${note.id}_title`,
          note,
          field: 'title',
          pageNumber: isPdf ? 1 : note.pdfSourceLink?.fallbackPageNumber,
          snippet: note.title,
        });
      } else if (note.checklist && note.checklist.some((c) => c.text.toLowerCase().includes(q))) {
        const matchItem = note.checklist.find((c) => c.text.toLowerCase().includes(q));
        results.push({
          key: `${note.id}_check`,
          note,
          field: 'checklist',
          snippet: `할 일: ${matchItem?.text || ''}`,
        });
      } else if (note.tags && note.tags.some((t) => t.toLowerCase().includes(q))) {
        results.push({
          key: `${note.id}_tag`,
          note,
          field: 'tag',
          snippet: `태그: #${note.tags.join(' #')}`,
        });
      } else if (note.audioNotes && note.audioNotes.some((a) => (a.title || '').toLowerCase().includes(q))) {
        const matchA = note.audioNotes.find((a) => (a.title || '').toLowerCase().includes(q));
        results.push({
          key: `${note.id}_audio`,
          note,
          field: 'audio',
          snippet: `음성 녹음: ${matchA?.title || ''}`,
        });
      }
    }

    return results;
  }, [notes, filters.searchQuery]);

  const hasActiveFilters =
    filters.searchQuery.trim() !== '' ||
    filters.selectedTag !== null ||
    filters.selectedColor !== null ||
    filters.onlyPinned ||
    filters.onlyHasImages ||
    filters.onlyChecklist ||
    filters.sortBy !== 'updated';

  const handleOpenSearchResult = (match: IndexedSearchMatch) => {
    const { note, pageNumber } = match;
    const isPdf =
      note.noteType === 'pdf' ||
      Boolean(note.pdfPages && note.pdfPages.length > 0) ||
      Boolean(note.pdfName);

    const openTarget = () => {
      if (isPdf && pageNumber) {
        openPdfNoteAtPage(note, pageNumber, filters.searchQuery.trim());
      } else {
        openEditNoteEditor(note);
      }
    };

    if (note.isLocked) {
      openLockModal(note, openTarget);
    } else {
      openTarget();
    }
  };

  return (
    <View style={styles.container}>
      {/* Search Input Box */}
      <View style={styles.inputWrapper}>
        <Search size={16} color="#94A3B8" />
        <TextInput
          style={styles.input}
          placeholder="메모 본문, 체크리스트, PDF 원문(페이지별), 발췌 통합 검색..."
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

      {/* 실시간 통합 검색 인덱스 팝업/서머리 (문서명 · 쪽수 · 일치 문장 표시) */}
      {filters.searchQuery.trim().length > 0 && (
        <View style={styles.indexBox}>
          <View style={styles.indexHeader}>
            <View style={styles.indexTitleRow}>
              <Sparkles size={13} color="#2563EB" />
              <Text style={styles.indexTitle}>
                통합 검색 결과: "{filters.searchQuery}" ({indexedMatches.length}건 일치)
              </Text>
            </View>
          </View>

          {indexedMatches.length > 0 ? (
            <ScrollView
              style={styles.indexListScroll}
              nestedScrollEnabled
              showsVerticalScrollIndicator={false}
            >
              {indexedMatches.slice(0, 8).map((match) => {
                const { key, note, snippet, pageNumber } = match;
                const colorCfg = NOTE_COLORS[note.color] || NOTE_COLORS.yellow;
                return (
                  <TouchableOpacity
                    key={key}
                    style={styles.indexResultItem}
                    onPress={() => handleOpenSearchResult(match)}
                    activeOpacity={0.7}
                  >
                    <View
                      style={[
                        styles.indexItemColorDot,
                        { backgroundColor: colorCfg.cardBorder },
                      ]}
                    />
                    <View style={styles.indexItemTextWrap}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={styles.indexItemTitle} numberOfLines={1}>
                          {note.title || note.pdfName || '제목 없음'}
                        </Text>
                        {typeof pageNumber === 'number' && (
                          <View
                            style={{
                              backgroundColor: '#EFF6FF',
                              borderWidth: 1,
                              borderColor: '#BFDBFE',
                              paddingHorizontal: 6,
                              paddingVertical: 1,
                              borderRadius: 6,
                            }}
                          >
                            <Text style={{ fontSize: 10.5, fontWeight: '800', color: '#1D4ED8' }}>
                              P.{pageNumber}쪽
                            </Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.indexItemSnippet} numberOfLines={1}>
                        {snippet}
                      </Text>
                    </View>
                    {note.pdfSourceLink && (
                      <TouchableOpacity
                        style={{
                          backgroundColor: '#EEF2FF',
                          borderWidth: 1,
                          borderColor: '#C7D2FE',
                          paddingHorizontal: 7,
                          paddingVertical: 3,
                          borderRadius: 6,
                        }}
                        onPress={(e) => {
                          e.stopPropagation();
                          if (note.pdfSourceLink) openPdfSourceLink(note.pdfSourceLink);
                        }}
                      >
                        <Text style={{ fontSize: 10.5, fontWeight: '800', color: '#4338CA' }}>
                          원문 보기
                        </Text>
                      </TouchableOpacity>
                    )}
                    <ChevronRight size={14} color="#94A3B8" />
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          ) : (
            <Text style={styles.indexEmptyText}>일치하는 메모 또는 PDF 문단이 없습니다.</Text>
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
