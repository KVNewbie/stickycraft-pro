import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Image,
  Platform,
} from 'react-native';
import {
  X,
  FileText,
  Save,
  Copy,
  Trash2,
  ExternalLink,
  Plus,
  BookOpen,
  Check,
  ChevronDown,
} from 'lucide-react-native';
import { Note, NoteImage } from '../types/note';

export interface SideNoteSnippetItem {
  id: string;
  imageDataUrl: string | null;
  extractedText: string;
  pageNumber: number;
  docName: string;
  createdAt: number;
}

interface PdfSideNoteDrawerProps {
  docTitle: string;
  allNotes: Note[];
  currentNoteId: string;
  linkedNoteId: string | null;
  sideTitle: string;
  sideContent: string;
  snippets: SideNoteSnippetItem[];
  onChangeLinkedNoteId: (noteId: string | null) => void;
  onChangeTitle: (val: string) => void;
  onChangeContent: (val: string) => void;
  onRemoveSnippet: (snippetId: string) => void;
  onJumpToPage: (pageNumber: number) => void;
  onCopySnippet: (snippet: SideNoteSnippetItem) => void;
  onSaveToBoard: () => void;
  onClose: () => void;
}

export const PdfSideNoteDrawer: React.FC<PdfSideNoteDrawerProps> = React.memo(
  ({
    docTitle,
    allNotes,
    currentNoteId,
    linkedNoteId,
    sideTitle,
    sideContent,
    snippets,
    onChangeLinkedNoteId,
    onChangeTitle,
    onChangeContent,
    onRemoveSnippet,
    onJumpToPage,
    onCopySnippet,
    onSaveToBoard,
    onClose,
  }) => {
    const [isNotePickerOpen, setIsNotePickerOpen] = useState(false);

    const selectableNotes = allNotes.filter(
      (n) => !n.isDeleted && !n.isArchived && n.id !== currentNoteId && n.noteType !== 'pdf'
    );

    const linkedNote = linkedNoteId
      ? selectableNotes.find((n) => n.id === linkedNoteId) || null
      : null;

    return (
      <View style={styles.drawerContainer}>
        {/* 상단 헤더 */}
        <View style={styles.drawerHeader}>
          <View style={styles.drawerHeaderLeft}>
            <View style={styles.drawerIconBadge}>
              <BookOpen size={14} color="#D97706" />
            </View>
            <View>
              <Text style={styles.drawerTitle}>분할 사이드 노트</Text>
              <Text style={styles.drawerSubtitle}>Flexcil 스타일 PDF 발췌 연동</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <X size={16} color="#64748B" />
          </TouchableOpacity>
        </View>

        {/* 대상 노트 선택기 (새 노트 vs 기존 노트 연결) */}
        <View style={styles.targetRow}>
          <TouchableOpacity
            style={styles.targetSelectorBtn}
            onPress={() => setIsNotePickerOpen((prev) => !prev)}
          >
            <FileText size={13} color="#2563EB" />
            <Text style={styles.targetSelectorText} numberOfLines={1}>
              {linkedNote ? `기존 노트: ${linkedNote.title || '제목 없음'}` : '✨ 새 스티커 노트로 저장'}
            </Text>
            <ChevronDown size={14} color="#64748B" />
          </TouchableOpacity>
        </View>

        {isNotePickerOpen && (
          <View style={styles.notePickerDropdown}>
            <TouchableOpacity
              style={[styles.notePickerItem, !linkedNoteId && styles.notePickerItemActive]}
              onPress={() => {
                onChangeLinkedNoteId(null);
                setIsNotePickerOpen(false);
              }}
            >
              <Plus size={13} color="#059669" />
              <Text style={[styles.notePickerItemText, { color: '#059669', fontWeight: '700' }]}>
                새 연동 스티커 노트 만들기
              </Text>
              {!linkedNoteId && <Check size={13} color="#059669" />}
            </TouchableOpacity>
            <ScrollView style={{ maxHeight: 160 }} nestedScrollEnabled>
              {selectableNotes.map((n) => {
                const isSelected = linkedNoteId === n.id;
                return (
                  <TouchableOpacity
                    key={n.id}
                    style={[styles.notePickerItem, isSelected && styles.notePickerItemActive]}
                    onPress={() => {
                      onChangeLinkedNoteId(n.id);
                      setIsNotePickerOpen(false);
                    }}
                  >
                    <Text style={styles.notePickerItemText} numberOfLines={1}>
                      {n.title || '제목 없음'}
                    </Text>
                    {isSelected && <Check size={13} color="#2563EB" />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* 본문 편집 + 발췌 블록 스크롤 영역 */}
        <ScrollView style={styles.drawerBody} contentContainerStyle={styles.drawerBodyContent}>
          <Text style={styles.fieldLabel}>노트 제목</Text>
          <TextInput
            style={styles.titleInput}
            value={sideTitle}
            onChangeText={onChangeTitle}
            placeholder={`${docTitle.replace(/\.pdf$/i, '')} 요약 노트`}
            placeholderTextColor="#94A3B8"
          />

          <Text style={styles.fieldLabel}>자유 메모 & 발췌 정리</Text>
          <TextInput
            style={styles.contentInput}
            value={sideContent}
            onChangeText={onChangeContent}
            placeholder="PDF를 보며 핵심 내용을 정리하거나, 하단 [블록 발췌] 도구로 PDF 영역을 드래그해 가져오세요..."
            placeholderTextColor="#94A3B8"
            multiline
            textAlignVertical="top"
          />

          {/* 발췌된 PDF 블록 카드 목록 */}
          <View style={styles.snippetsHeaderRow}>
            <Text style={styles.fieldLabel}>발췌된 PDF 블록 ({snippets.length}개)</Text>
            {snippets.length > 0 && (
              <Text style={styles.snippetsHint}>페이지 뱃지 클릭 시 원문 이동</Text>
            )}
          </View>

          {snippets.length === 0 ? (
            <View style={styles.emptySnippetsBox}>
              <Text style={styles.emptySnippetsTitle}>아직 가져온 PDF 블록이 없습니다</Text>
              <Text style={styles.emptySnippetsSub}>
                하단 툴바의 ✂️ [블록 발췌] 도구로 PDF의 원하는 영역을 드래그한 뒤 [사이드 노트로]를 눌러보세요.
              </Text>
            </View>
          ) : (
            snippets.map((snip) => (
              <View key={snip.id} style={styles.snippetCard}>
                <View style={styles.snippetCardTop}>
                  <TouchableOpacity
                    style={styles.pageBacklinkBadge}
                    onPress={() => onJumpToPage(snip.pageNumber)}
                  >
                    <ExternalLink size={10} color="#1D4ED8" />
                    <Text style={styles.pageBacklinkText}>P.{snip.pageNumber} 원문 이동</Text>
                  </TouchableOpacity>
                  <View style={styles.snippetCardActions}>
                    <TouchableOpacity
                      style={styles.snippetMiniBtn}
                      onPress={() => onCopySnippet(snip)}
                    >
                      <Copy size={11} color="#475569" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.snippetMiniBtn}
                      onPress={() => onRemoveSnippet(snip.id)}
                    >
                      <Trash2 size={11} color="#DC2626" />
                    </TouchableOpacity>
                  </View>
                </View>

                {snip.imageDataUrl ? (
                  <Image
                    source={{ uri: snip.imageDataUrl }}
                    style={styles.snippetThumb}
                    resizeMode="contain"
                  />
                ) : null}

                {snip.extractedText ? (
                  <Text style={styles.snippetExtractedText} numberOfLines={4}>
                    {snip.extractedText}
                  </Text>
                ) : null}
              </View>
            ))
          )}
        </ScrollView>

        {/* 하단 저장 액션 */}
        <View style={styles.drawerFooter}>
          <TouchableOpacity style={styles.saveNoteBtn} onPress={onSaveToBoard}>
            <Save size={15} color="#FFFFFF" />
            <Text style={styles.saveNoteBtnText}>
              {linkedNote ? '연결된 기존 노트에 반영' : '새 스티커 노트로 보드에 저장'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }
);

const styles = StyleSheet.create({
  drawerContainer: {
    width: 340,
    backgroundColor: '#FFFBEB',
    borderLeftWidth: 1.5,
    borderLeftColor: '#FDE68A',
    flexDirection: 'column',
    zIndex: 12,
    ...Platform.select({
      web: {
        boxShadow: '-4px 0 20px rgba(15, 23, 42, 0.12)',
      },
    }),
  },
  drawerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 11,
    backgroundColor: '#FEF3C7',
    borderBottomWidth: 1,
    borderBottomColor: '#FDE68A',
  },
  drawerHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  drawerIconBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FCD34D',
  },
  drawerTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#78350F',
  },
  drawerSubtitle: {
    fontSize: 10.5,
    color: '#B45309',
  },
  closeBtn: {
    padding: 5,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.75)',
  },
  targetRow: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 6,
  },
  targetSelectorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    ...Platform.select({
      web: { cursor: 'pointer' },
    }),
  },
  targetSelectorText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    color: '#1E293B',
  },
  notePickerDropdown: {
    marginHorizontal: 12,
    marginBottom: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    overflow: 'hidden',
    ...Platform.select({
      web: { boxShadow: '0 6px 18px rgba(15, 23, 42, 0.14)' },
    }),
  },
  notePickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    ...Platform.select({
      web: { cursor: 'pointer' },
    }),
  },
  notePickerItemActive: {
    backgroundColor: '#EFF6FF',
  },
  notePickerItemText: {
    flex: 1,
    fontSize: 12,
    color: '#334155',
    fontWeight: '600',
  },
  drawerBody: {
    flex: 1,
  },
  drawerBodyContent: {
    padding: 12,
    gap: 8,
    paddingBottom: 24,
  },
  fieldLabel: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#92400E',
    marginTop: 2,
  },
  titleInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13.5,
    fontWeight: '700',
    color: '#0F172A',
  },
  contentInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 9,
    minHeight: 110,
    fontSize: 12.5,
    lineHeight: 19,
    color: '#1E293B',
  },
  snippetsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  snippetsHint: {
    fontSize: 10,
    color: '#B45309',
  },
  emptySnippetsBox: {
    backgroundColor: 'rgba(255,255,255,0.75)',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#FCD34D',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    gap: 4,
  },
  emptySnippetsTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#92400E',
  },
  emptySnippetsSub: {
    fontSize: 11,
    color: '#78716C',
    textAlign: 'center',
    lineHeight: 16,
  },
  snippetCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FDE68A',
    padding: 9,
    gap: 7,
  },
  snippetCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pageBacklinkBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    ...Platform.select({
      web: { cursor: 'pointer' },
    }),
  },
  pageBacklinkText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  snippetCardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  snippetMiniBtn: {
    padding: 4,
    borderRadius: 5,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  snippetThumb: {
    width: '100%',
    height: 110,
    borderRadius: 6,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  snippetExtractedText: {
    fontSize: 11.5,
    lineHeight: 16,
    color: '#334155',
    backgroundColor: '#F8FAFC',
    padding: 7,
    borderRadius: 6,
  },
  drawerFooter: {
    padding: 12,
    backgroundColor: '#FEF3C7',
    borderTopWidth: 1,
    borderTopColor: '#FDE68A',
  },
  saveNoteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#D97706',
    borderRadius: 9,
    paddingVertical: 10,
    ...Platform.select({
      web: { cursor: 'pointer' },
    }),
  },
  saveNoteBtnText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
