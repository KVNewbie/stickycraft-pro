import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Pin,
  Lock,
  Unlock,
  Trash2,
  Mic,
  Palette,
  Check,
  CheckSquare,
  Square,
  Plus,
  ArrowUpDown,
  MoreVertical,
  ChevronDown,
  ChevronUp,
  X,
  ListCheck,
  Copy,
  Search,
} from 'lucide-react-native';
import { Note, NoteColorId, ChecklistItem, AudioNote } from '../types/note';
import { NOTE_COLORS, COLOR_KEYS } from '../constants/colors';
import { useNoteStore } from '../store/useNoteStore';
import { AudioRecordingStudio } from './AudioRecordingStudio';

interface ColorNoteChecklistEditorProps {
  note?: Note | null;
  onClose: () => void;
}

export const ColorNoteChecklistEditor: React.FC<ColorNoteChecklistEditorProps> = ({
  note: initialNote,
  onClose,
}) => {
  const {
    addNote,
    updateNote,
    deleteNote,
    openLockModal,
  } = useNoteStore();

  const [noteId, setNoteId] = useState<string>(initialNote?.id || '');
  const [title, setTitle] = useState<string>(initialNote?.title || '');
  const [color, setColor] = useState<NoteColorId>(initialNote?.color || 'mint');
  const [isPinned, setIsPinned] = useState<boolean>(initialNote?.isPinned || false);
  const [isLocked, setIsLocked] = useState<boolean>(initialNote?.isLocked || false);
  const [items, setItems] = useState<ChecklistItem[]>(
    initialNote?.checklist && initialNote.checklist.length > 0
      ? initialNote.checklist
      : [
          { id: 'item_1', text: '첫 번째 할 일 항목', completed: false },
          { id: 'item_2', text: '완료된 항목 예시', completed: true },
        ]
  );
  const [audioNotes, setAudioNotes] = useState<AudioNote[]>(initialNote?.audioNotes || []);

  const [newItemText, setNewItemText] = useState('');
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);

  // ColorNote 벤치마크: 목록 내 실시간 검색 상태
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const searchMatchCount = searchQuery.trim().length > 0
    ? items.filter((item) => item.text.toLowerCase().includes(searchQuery.trim().toLowerCase())).length
    : 0;

  const addItemInputRef = useRef<TextInput>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 1800);
  };

  const handleCopyChecklist = async () => {
    const listText = items
      .map((item) => `${item.completed ? '[x]' : '[ ]'} ${item.text}`)
      .join('\n');
    const fullText = (title ? `${title}\n\n` : '') + listText;
    if (!fullText.trim()) {
      showToast('복사할 항목이 없습니다');
      return;
    }
    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(fullText);
      }
      showToast('📋 체크리스트가 텍스트로 복사되었습니다');
    } catch (e) {
      showToast('📋 복사 완료');
    }
  };

  const activeColorConfig = NOTE_COLORS[color] || NOTE_COLORS.mint;

  // 전체 진행도 계산
  const totalCount = items.length;
  const completedCount = items.filter((item) => item.completed).length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  // 저장 및 종료
  const handleSaveAndExit = () => {
    // 항목도 없고 제목도 없으면 저장하지 않고 닫기
    if (!title.trim() && items.length === 0 && audioNotes.length === 0) {
      onClose();
      return;
    }

    const finalTitle = title.trim() || '체크리스트 할 일';

    if (noteId) {
      updateNote(noteId, {
        title: finalTitle,
        checklist: items,
        color,
        isPinned,
        isLocked,
        audioNotes,
        noteType: 'checklist',
      });
    } else {
      addNote({
        title: finalTitle,
        content: items.map((i) => (i.completed ? `[x] ${i.text}` : `[ ] ${i.text}`)).join('\n'),
        color,
        decoStyle: 'minimal',
        images: [],
        checklist: items,
        tags: ['체크리스트'],
        isPinned,
        isLocked,
        audioNotes,
        boardId: 'ideas',
        noteType: 'checklist',
      });
    }
    onClose();
  };

  // 새 항목 추가
  const handleAddItem = () => {
    if (!newItemText.trim()) return;
    const newItem: ChecklistItem = {
      id: 'chk_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      text: newItemText.trim(),
      completed: false,
    };
    setItems((prev) => [...prev, newItem]);
    setNewItemText('');
    // 키보드 포커스 유지
    addItemInputRef.current?.focus();
  };

  // 항목 토글
  const toggleItem = (id: string) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, completed: !item.completed } : item))
    );
  };

  // 항목 텍스트 수정
  const updateItemText = (id: string, text: string) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, text } : item))
    );
  };

  // 항목 삭제
  const deleteItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  // 항목 순서 이동
  const moveItem = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === items.length - 1) return;
    const newItems = [...items];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    const temp = newItems[index];
    newItems[index] = newItems[targetIndex];
    newItems[targetIndex] = temp;
    setItems(newItems);
  };

  // ColorNote 고급 액션: 완료 항목 하단 자동 정렬
  const sortCheckedToBottom = () => {
    setItems((prev) => {
      const unchecked = prev.filter((i) => !i.completed);
      const checked = prev.filter((i) => i.completed);
      return [...unchecked, ...checked];
    });
    showToast('⇅ 완료 항목이 하단으로 정렬되었습니다.');
    setIsMoreMenuOpen(false);
  };

  // ColorNote & Keep 벤치마크 편의성: 가나다 / 알파벳 순 정렬
  const sortAlphabetically = () => {
    setItems((prev) => {
      return [...prev].sort((a, b) =>
        a.text.localeCompare(b.text, 'ko-KR', { sensitivity: 'base' })
      );
    });
    showToast('🔤 가나다순으로 정렬되었습니다.');
    setIsMoreMenuOpen(false);
  };

  // 체크리스트 항목 1-Tap 복제
  const duplicateItem = (id: string) => {
    const target = items.find((i) => i.id === id);
    if (!target) return;
    const newItem: ChecklistItem = {
      id: 'chk_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      text: target.text + ' (복사본)',
      completed: false,
    };
    const index = items.findIndex((i) => i.id === id);
    const next = [...items];
    next.splice(index + 1, 0, newItem);
    setItems(next);
    showToast('📋 항목이 복제되었습니다.');
  };

  // 모두 완료
  const checkAll = () => {
    setItems((prev) => prev.map((i) => ({ ...i, completed: true })));
    setIsMoreMenuOpen(false);
  };

  // 모두 미완료
  const uncheckAll = () => {
    setItems((prev) => prev.map((i) => ({ ...i, completed: false })));
    setIsMoreMenuOpen(false);
  };

  // 완료된 항목 일괄 삭제
  const removeCompleted = () => {
    setItems((prev) => prev.filter((i) => !i.completed));
    setIsMoreMenuOpen(false);
  };

  // 메모 삭제
  const handleDeleteNote = () => {
    if (noteId) {
      deleteNote(noteId);
    }
    onClose();
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: activeColorConfig.bg }]}
      edges={['top', 'left', 'right', 'bottom']}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardContainer}
      >
        {/* ColorNote 상단 타이틀 바 */}
        <View style={[styles.headerBar, { borderBottomColor: activeColorConfig.cardBorder }]}>
          <TouchableOpacity
            style={styles.headerIconButton}
            onPress={handleSaveAndExit}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <ArrowLeft size={24} color="#1E293B" />
          </TouchableOpacity>

          {/* 제목 입력창 */}
          <TextInput
            style={styles.titleInput}
            placeholder="체크리스트 제목"
            placeholderTextColor="#94A3B8"
            value={title}
            onChangeText={setTitle}
            maxLength={80}
          />

          {/* 액션 아이콘들 */}
          <View style={styles.headerActions}>
            {/* 목록 내 검색 토글 */}
            <TouchableOpacity
              style={[styles.headerIconButton, isSearchOpen && styles.activeIconBlue]}
              onPress={() => {
                setIsSearchOpen(!isSearchOpen);
                if (isSearchOpen) setSearchQuery('');
              }}
              {...(Platform.OS === 'web'
                ? ({
                    onClick: () => {
                      setIsSearchOpen(!isSearchOpen);
                      if (isSearchOpen) setSearchQuery('');
                    },
                  } as any)
                : {})}
            >
              <Search size={20} color={isSearchOpen ? '#2563EB' : '#475569'} />
            </TouchableOpacity>

            {/* 텍스트 클립보드 복사 */}
            <TouchableOpacity
              style={styles.headerIconButton}
              onPress={handleCopyChecklist}
              {...(Platform.OS === 'web' ? ({ onClick: handleCopyChecklist } as any) : {})}
            >
              <Copy size={20} color="#475569" />
            </TouchableOpacity>

            {/* 음성 녹음 */}
            <TouchableOpacity
              style={[styles.headerIconButton, isRecording && styles.activeIcon]}
              onPress={() => setIsRecording((prev) => !prev)}
            >
              <Mic size={20} color={isRecording ? '#DC2626' : '#475569'} />
            </TouchableOpacity>

            {/* 핀 고정 */}
            <TouchableOpacity
              style={styles.headerIconButton}
              onPress={() => setIsPinned(!isPinned)}
            >
              <Pin
                size={20}
                color={isPinned ? '#D97706' : '#94A3B8'}
                fill={isPinned ? '#F59E0B' : 'none'}
              />
            </TouchableOpacity>

            {/* 색상 선택기 토글 */}
            <TouchableOpacity
              style={styles.headerIconButton}
              onPress={() => setIsColorPickerOpen(!isColorPickerOpen)}
            >
              <Palette size={20} color="#475569" />
            </TouchableOpacity>

            {/* 더보기 메뉴 버튼 */}
            <TouchableOpacity
              style={styles.headerIconButton}
              onPress={() => setIsMoreMenuOpen(!isMoreMenuOpen)}
            >
              <MoreVertical size={20} color="#475569" />
            </TouchableOpacity>
          </View>
        </View>

        {/* 체크리스트 내 실시간 검색 바 */}
        {isSearchOpen && (
          <View style={styles.inListSearchBar}>
            <Search size={15} color="#64748B" />
            <TextInput
              style={styles.inListSearchInput}
              placeholder="체크리스트 항목 검색..."
              placeholderTextColor="#94A3B8"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus
            />
            {searchQuery.trim().length > 0 && (
              <View style={styles.searchMatchPill}>
                <Text style={styles.searchMatchPillText}>{searchMatchCount}건 일치</Text>
              </View>
            )}
            <TouchableOpacity
              style={styles.searchCloseBtn}
              onPress={() => {
                setIsSearchOpen(false);
                setSearchQuery('');
              }}
              {...(Platform.OS === 'web'
                ? ({
                    onClick: () => {
                      setIsSearchOpen(false);
                      setSearchQuery('');
                    },
                  } as any)
                : {})}
            >
              <X size={15} color="#64748B" />
            </TouchableOpacity>
          </View>
        )}

        {/* 더보기 드롭다운 팝업 메뉴 (ColorNote 스타일) */}
        {isMoreMenuOpen && (
          <View style={styles.dropdownMenu}>
            <TouchableOpacity style={styles.dropdownItem} onPress={sortCheckedToBottom}>
              <ArrowUpDown size={16} color="#2563EB" />
              <Text style={styles.dropdownText}>완료 항목 하단 정렬</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.dropdownItem} onPress={sortAlphabetically}>
              <ArrowUpDown size={16} color="#7C3AED" />
              <Text style={styles.dropdownText}>가나다 / 알파벳 순 정렬</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.dropdownItem} onPress={checkAll}>
              <CheckSquare size={16} color="#059669" />
              <Text style={styles.dropdownText}>모두 완료 체크</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.dropdownItem} onPress={uncheckAll}>
              <Square size={16} color="#64748B" />
              <Text style={styles.dropdownText}>모두 체크 해제</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.dropdownItem} onPress={removeCompleted}>
              <Trash2 size={16} color="#DC2626" />
              <Text style={[styles.dropdownText, { color: '#DC2626' }]}>완료 항목 삭제</Text>
            </TouchableOpacity>
            <View style={styles.menuDivider} />
            <TouchableOpacity style={styles.dropdownItem} onPress={handleDeleteNote}>
              <Trash2 size={16} color="#991B1B" />
              <Text style={[styles.dropdownText, { color: '#991B1B' }]}>이 메모 전체 삭제</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* 12색 컬러 팔레트 슬라이더 */}
        {isColorPickerOpen && (
          <View style={styles.colorPickerContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.colorList}>
              {COLOR_KEYS.map((k) => {
                const conf = NOTE_COLORS[k];
                const isSelected = color === k;
                return (
                  <TouchableOpacity
                    key={k}
                    style={[
                      styles.colorDot,
                      { backgroundColor: conf.bg, borderColor: conf.cardBorder },
                      isSelected && styles.colorDotSelected,
                    ]}
                    onPress={() => {
                      setColor(k);
                      setIsColorPickerOpen(false);
                    }}
                  >
                    {isSelected && <Check size={14} color="#1E293B" strokeWidth={3} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* 음성 녹음 스튜디오 */}
        {(isRecording || audioNotes.length > 0) && (
          <AudioRecordingStudio
            isRecording={isRecording}
            audioNotes={audioNotes}
            onStopRecording={(newAudio) => {
              setAudioNotes((prev) => [...prev, newAudio]);
              setIsRecording(false);
            }}
            onCancelRecording={() => setIsRecording(false)}
            onDeleteAudio={(id) => setAudioNotes((prev) => prev.filter((a) => a.id !== id))}
          />
        )}

        {/* 체크리스트 진행도 바 (ColorNote 진행률 시각화) */}
        <View style={styles.progressContainer}>
          <View style={styles.progressInfoRow}>
            <View style={styles.progressBadge}>
              <ListCheck size={14} color="#059669" />
              <Text style={styles.progressText}>
                {totalCount}개 중 {completedCount}개 완료
              </Text>
            </View>
            <Text style={styles.progressPercentText}>{progressPercent}%</Text>
          </View>
          <View style={styles.progressBarBackground}>
            <View
              style={[
                styles.progressBarFill,
                { width: `${progressPercent}%`, backgroundColor: progressPercent === 100 ? '#10B981' : '#059669' },
              ]}
            />
          </View>
        </View>

        {/* ColorNote view_checklist_header_additem: 최상단 빠른 항목 추가 바 */}
        <View style={styles.addItemHeaderRow}>
          <TouchableOpacity style={styles.addItemPlusBtn} onPress={handleAddItem}>
            <Plus size={20} color="#FFFFFF" />
          </TouchableOpacity>
          <TextInput
            ref={addItemInputRef}
            style={styles.addItemInput}
            placeholder="+ 새 할 일 항목 입력 (Enter로 연속 추가)..."
            placeholderTextColor="#64748B"
            value={newItemText}
            onChangeText={setNewItemText}
            onSubmitEditing={handleAddItem}
            blurOnSubmit={false}
            returnKeyType="done"
          />
          {newItemText.trim().length > 0 && (
            <TouchableOpacity style={styles.addItemConfirmBtn} onPress={handleAddItem}>
              <Text style={styles.addItemConfirmText}>추가</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* 체크리스트 목록 영역 */}
        <ScrollView
          style={styles.itemsScrollView}
          contentContainerStyle={styles.itemsContentContainer}
          keyboardShouldPersistTaps="handled"
        >
          {items.map((item, index) => {
            const isMatched =
              searchQuery.trim().length > 0 &&
              item.text.toLowerCase().includes(searchQuery.trim().toLowerCase());
            return (
              <View
                key={item.id}
                style={[
                  styles.itemRow,
                  item.completed && styles.itemRowCompleted,
                  isMatched && styles.itemRowMatched,
                  { borderBottomColor: activeColorConfig.cardBorder },
                ]}
              >
                {/* 체크박스 버튼 */}
                <TouchableOpacity
                  style={styles.checkboxTouch}
                  onPress={() => toggleItem(item.id)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  {item.completed ? (
                    <View style={styles.checkedBox}>
                      <Check size={14} color="#FFFFFF" strokeWidth={3} />
                    </View>
                  ) : (
                    <View style={styles.uncheckSquare} />
                  )}
                </TouchableOpacity>

                {/* 항목 텍스트 입력창 (즉시 인라인 수정 가능) */}
                <TextInput
                  style={[
                    styles.itemTextInput,
                    item.completed && styles.itemTextCompleted,
                    isMatched && styles.itemTextMatched,
                  ]}
                  value={item.text}
                  onChangeText={(text) => updateItemText(item.id, text)}
                  multiline
                />

                {/* 순서 조정, 복제 & 삭제 액션 */}
                <View style={styles.itemActions}>
                  {index > 0 && (
                    <TouchableOpacity
                      style={styles.reorderBtn}
                      onPress={() => moveItem(index, 'up')}
                    >
                      <ChevronUp size={16} color="#94A3B8" />
                    </TouchableOpacity>
                  )}
                  {index < items.length - 1 && (
                    <TouchableOpacity
                      style={styles.reorderBtn}
                      onPress={() => moveItem(index, 'down')}
                    >
                      <ChevronDown size={16} color="#94A3B8" />
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={styles.reorderBtn}
                    onPress={() => duplicateItem(item.id)}
                    {...(Platform.OS === 'web' ? ({ onClick: () => duplicateItem(item.id) } as any) : {})}
                  >
                    <Copy size={14} color="#94A3B8" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.deleteItemBtn}
                    onPress={() => deleteItem(item.id)}
                  >
                    <X size={16} color="#94A3B8" />
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}

          {items.length === 0 && (
            <View style={styles.emptyContainer}>
              <ListCheck size={48} color="#94A3B8" />
              <Text style={styles.emptyText}>등록된 할 일이 없습니다.</Text>
              <Text style={styles.emptySubText}>상단의 입력창에 할 일을 적어보세요!</Text>
            </View>
          )}
        </ScrollView>

        {/* 하단 툴바: 빠른 정리 액션 */}
        <View style={styles.bottomToolbar}>
          <TouchableOpacity style={styles.toolbarChip} onPress={sortCheckedToBottom}>
            <ArrowUpDown size={14} color="#334155" />
            <Text style={styles.toolbarChipText}>하단 정렬</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.toolbarChip} onPress={sortAlphabetically}>
            <Text style={styles.toolbarChipText}>🔤 가나다순</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.toolbarChip} onPress={checkAll}>
            <CheckSquare size={14} color="#334155" />
            <Text style={styles.toolbarChipText}>모두 체크</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.toolbarChip} onPress={uncheckAll}>
            <Square size={14} color="#334155" />
            <Text style={styles.toolbarChipText}>모두 해제</Text>
          </TouchableOpacity>
          {completedCount > 0 && (
            <TouchableOpacity
              style={[styles.toolbarChip, { backgroundColor: '#FEE2E2', borderColor: '#FECACA' }]}
              onPress={removeCompleted}
            >
              <Trash2 size={14} color="#DC2626" />
              <Text style={[styles.toolbarChipText, { color: '#DC2626' }]}>
                완료({completedCount}) 정리
              </Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.toolbarChip} onPress={handleCopyChecklist}>
            <Copy size={13} color="#2563EB" />
            <Text style={[styles.toolbarChipText, { color: '#2563EB' }]}>텍스트 복사</Text>
          </TouchableOpacity>
        </View>

        {/* Floating Toast Notification */}
        {toastMessage && (
          <View style={styles.toastWrap} pointerEvents="none">
            <View style={styles.toastPill}>
              <Text style={styles.toastText}>{toastMessage}</Text>
            </View>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardContainer: {
    flex: 1,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.65)',
  },
  headerIconButton: {
    padding: 6,
    borderRadius: 8,
  },
  activeIcon: {
    backgroundColor: '#FEE2E2',
  },
  activeIconBlue: {
    backgroundColor: '#DBEAFE',
  },
  inListSearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    gap: 8,
  },
  inListSearchInput: {
    flex: 1,
    fontSize: 14,
    color: '#0F172A',
    padding: 0,
  },
  searchMatchPill: {
    backgroundColor: '#FEF08A',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  searchMatchPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#854D0E',
  },
  searchCloseBtn: {
    padding: 4,
  },
  titleInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    marginLeft: 8,
    marginRight: 8,
    paddingVertical: 4,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dropdownMenu: {
    position: 'absolute',
    top: 55,
    right: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 6,
    width: 190,
    zIndex: 999,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.18,
        shadowRadius: 10,
      },
      android: {
        elevation: 10,
      },
      web: {
        boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
      },
    }),
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  dropdownText: {
    fontSize: 14,
    color: '#1E293B',
    fontWeight: '500',
  },
  menuDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 4,
  },
  colorPickerContainer: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  colorList: {
    paddingHorizontal: 16,
    gap: 12,
  },
  colorDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  colorDotSelected: {
    borderColor: '#0F172A',
    transform: [{ scale: 1.15 }],
  },
  progressContainer: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
  },
  progressInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  progressBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  progressText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
  },
  progressPercentText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#059669',
  },
  progressBarBackground: {
    height: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.08)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  addItemHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 12,
    marginVertical: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 3,
      },
      android: {
        elevation: 2,
      },
      web: {
        boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
      },
    }),
  },
  addItemPlusBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#059669',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  addItemInput: {
    flex: 1,
    fontSize: 15,
    color: '#0F172A',
    paddingVertical: 4,
  },
  addItemConfirmBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#ECFDF5',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  addItemConfirmText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#059669',
  },
  itemsScrollView: {
    flex: 1,
  },
  itemsContentContainer: {
    paddingHorizontal: 12,
    paddingBottom: 24,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
    borderBottomWidth: 1,
  },
  itemRowCompleted: {
    backgroundColor: 'rgba(255, 255, 255, 0.45)',
    opacity: 0.8,
  },
  itemRowMatched: {
    backgroundColor: '#FEF9C3',
    borderColor: '#EAB308',
    borderWidth: 1.5,
  },
  checkboxTouch: {
    marginRight: 10,
  },
  uncheckSquare: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#94A3B8',
    backgroundColor: '#FFFFFF',
  },
  checkedBox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    backgroundColor: '#059669',
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemTextInput: {
    flex: 1,
    fontSize: 15,
    color: '#1E293B',
    paddingVertical: 0,
    lineHeight: 20,
  },
  itemTextCompleted: {
    textDecorationLine: 'line-through',
    color: '#94A3B8',
  },
  itemTextMatched: {
    fontWeight: '700',
    color: '#713F12',
  },
  itemActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  reorderBtn: {
    padding: 4,
  },
  deleteItemBtn: {
    padding: 4,
    marginLeft: 4,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 12,
  },
  emptySubText: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 4,
  },
  bottomToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.08)',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    flexWrap: 'wrap',
  },
  toolbarChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  toolbarChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  toastWrap: {
    position: 'absolute',
    bottom: 60,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 999,
  },
  toastPill: {
    backgroundColor: 'rgba(15, 23, 42, 0.92)',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 6,
  },
  toastText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
});
