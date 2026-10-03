import React, { useState, useRef, useMemo } from 'react';
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
  Calendar,
  List,
  Edit3,
  Copy,
  Search,
  Type,
  X,
  Eye,
} from 'lucide-react-native';
import { Note, NoteColorId, AudioNote, NoteFontSize } from '../types/note';
import { NOTE_COLORS, COLOR_KEYS } from '../constants/colors';
import { useNoteStore } from '../store/useNoteStore';
import { PaperTemplatePattern } from './PaperTemplatePattern';
import { AudioRecordingStudio } from './AudioRecordingStudio';

interface ColorNoteTextEditorProps {
  note?: Note | null;
  onClose: () => void;
}

const FONT_PRESETS: Record<NoteFontSize, { label: string; size: number; lineHeight: number }> = {
  sm: { label: '소', size: 13, lineHeight: 22 },
  base: { label: '보통', size: 16, lineHeight: 28 },
  lg: { label: '크게', size: 19, lineHeight: 32 },
  xl: { label: '특대', size: 23, lineHeight: 38 },
};

export const ColorNoteTextEditor: React.FC<ColorNoteTextEditorProps> = ({
  note: initialNote,
  onClose,
}) => {
  const {
    addNote,
    updateNote,
    deleteNote,
    toggleNoteLock,
  } = useNoteStore();

  const [noteId] = useState<string>(initialNote?.id || '');
  const [title, setTitle] = useState<string>(initialNote?.title || '');
  const [content, setContent] = useState<string>(initialNote?.content || '');
  const [color, setColor] = useState<NoteColorId>(initialNote?.color || 'yellow');
  const [isPinned, setIsPinned] = useState<boolean>(initialNote?.isPinned || false);
  const [isLocked, setIsLocked] = useState<boolean>(initialNote?.isLocked || false);
  const [audioNotes, setAudioNotes] = useState<AudioNote[]>(initialNote?.audioNotes || []);

  // ColorNote 1:1 읽기 모드 (View) vs 편집 모드 (Edit)
  // 기존 메모가 있고 내용이나 제목이 있으면 읽기 모드로 시작 (오작동 방지)
  const [isEditMode, setIsEditMode] = useState<boolean>(
    !initialNote || (!initialNote.title && !initialNote.content)
  );

  // 글자 크기 (소, 보통, 크게, 특대)
  const [fontSize, setFontSize] = useState<NoteFontSize>(initialNote?.fontSize || 'base');

  // 본문 내 실시간 검색
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // 복사 / 알림 토스트
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);

  const contentInputRef = useRef<TextInput>(null);

  const activeColorConfig = NOTE_COLORS[color] || NOTE_COLORS.yellow;
  const currentFontConfig = FONT_PRESETS[fontSize] || FONT_PRESETS.base;

  // 자동 저장 핸들러
  const handleSaveAndExit = () => {
    // 텍스트와 제목이 모두 비어있고 음성도 없으면 저장하지 않고 닫기
    if (!title.trim() && !content.trim() && audioNotes.length === 0) {
      onClose();
      return;
    }

    if (noteId) {
      // 기존 메모 업데이트
      updateNote(noteId, {
        title: title.trim(),
        content: content,
        color,
        isPinned,
        isLocked,
        audioNotes,
        fontSize,
        noteType: 'text',
        editorMode: 'text',
      });
    } else {
      // 새 메모 추가
      addNote({
        title: title.trim(),
        content: content,
        color,
        decoStyle: 'minimal',
        images: [],
        checklist: [],
        tags: [],
        isPinned,
        isLocked,
        audioNotes,
        fontSize,
        boardId: 'all',
        paperTemplate: 'lined',
        noteType: 'text',
        editorMode: 'text',
      });
    }
    onClose();
  };

  // 완료 후 읽기 모드로 전환 (새 메모면 저장 후 종료)
  const handleCompleteEditing = () => {
    if (noteId) {
      updateNote(noteId, {
        title: title.trim(),
        content: content,
        color,
        isPinned,
        isLocked,
        audioNotes,
        fontSize,
      });
      setIsEditMode(false);
      showToast('✓ 저장되었습니다');
    } else {
      handleSaveAndExit();
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 1800);
  };

  // 클립보드 전체 복사
  const handleCopyAll = async () => {
    const fullText = (title ? title + '\n\n' : '') + content;
    if (!fullText.trim()) {
      showToast('복사할 내용이 없습니다');
      return;
    }
    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(fullText);
      }
      showToast('📋 전체 내용이 클립보드에 복사되었습니다');
    } catch (e) {
      showToast('📋 복사 완료');
    }
  };

  // 글자 크기 순환 토글 (소 -> 보통 -> 크게 -> 특대)
  const handleCycleFontSize = () => {
    const order: NoteFontSize[] = ['sm', 'base', 'lg', 'xl'];
    const next = order[(order.indexOf(fontSize) + 1) % order.length];
    setFontSize(next);
    if (noteId) {
      updateNote(noteId, { fontSize: next });
    }
    showToast(`🔤 글자 크기: ${FONT_PRESETS[next].label} (${FONT_PRESETS[next].size}px)`);
  };

  // 오늘 날짜 삽입 헬퍼
  const handleInsertDate = () => {
    const now = new Date();
    const dateStr = `[${now.getFullYear()}.${now.getMonth() + 1}.${now.getDate()} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}]\n`;
    setContent((prev) => (prev ? prev + '\n' + dateStr : dateStr));
  };

  // 불릿 목록 삽입 헬퍼
  const handleInsertBullet = () => {
    setContent((prev) => (prev ? prev + '\n• ' : '• '));
  };

  // 단어 & 글자 수 계산
  const charCount = content.length;
  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;

  // 본문 검색 매치 수 계산
  const searchMatchCount = useMemo(() => {
    if (!searchQuery.trim() || !content) return 0;
    try {
      const q = searchQuery.toLowerCase();
      let count = 0;
      let pos = 0;
      const lower = content.toLowerCase();
      while ((pos = lower.indexOf(q, pos)) !== -1) {
        count++;
        pos += q.length;
      }
      return count;
    } catch (e) {
      return 0;
    }
  }, [content, searchQuery]);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: activeColorConfig.bg }]}>
      {/* Paper Lined Pattern Background (ColorNote Ruled Lines) */}
      <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
        <PaperTemplatePattern template="lined" colorHex={activeColorConfig.textMuted} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardContainer}
      >
        {/* Top Header Bar (ColorNote Signature Top Bar) */}
        <View style={[styles.headerBar, { borderBottomColor: activeColorConfig.cardBorder }]}>
          {/* Back & Auto-save button */}
          <TouchableOpacity
            style={styles.backBtn}
            onPress={handleSaveAndExit}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            {...(Platform.OS === 'web' ? ({ onClick: handleSaveAndExit } as any) : {})}
          >
            <ArrowLeft size={22} color={activeColorConfig.text} />
          </TouchableOpacity>

          {/* Title Field (Editable in Edit Mode, Label in View Mode) */}
          {isEditMode ? (
            <TextInput
              style={[styles.headerTitleInput, { color: activeColorConfig.text }]}
              placeholder="제목 없음"
              placeholderTextColor={activeColorConfig.textMuted}
              value={title}
              onChangeText={setTitle}
              maxLength={100}
            />
          ) : (
            <TouchableOpacity
              style={styles.headerTitleReadWrap}
              onPress={() => setIsEditMode(true)}
              {...(Platform.OS === 'web' ? ({ onClick: () => setIsEditMode(true) } as any) : {})}
            >
              <Text
                style={[styles.headerTitleText, { color: activeColorConfig.text }]}
                numberOfLines={1}
              >
                {title || '제목 없음'}
              </Text>
            </TouchableOpacity>
          )}

          {/* Right Action Buttons */}
          <View style={styles.headerActions}>
            {/* View/Edit Mode Indicator & Switcher */}
            {isEditMode ? (
              <TouchableOpacity
                style={styles.completeBtn}
                onPress={handleCompleteEditing}
                {...(Platform.OS === 'web' ? ({ onClick: handleCompleteEditing } as any) : {})}
              >
                <Check size={16} color="#FFFFFF" strokeWidth={2.5} />
                <Text style={styles.completeBtnText}>완료</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.editBtnHeader}
                onPress={() => {
                  setIsEditMode(true);
                  setTimeout(() => contentInputRef.current?.focus(), 100);
                }}
                {...(Platform.OS === 'web'
                  ? ({
                      onClick: () => {
                        setIsEditMode(true);
                        setTimeout(() => contentInputRef.current?.focus(), 100);
                      },
                    } as any)
                  : {})}
              >
                <Edit3 size={15} color="#2563EB" />
                <Text style={styles.editBtnHeaderText}>편집</Text>
              </TouchableOpacity>
            )}

            {/* In-Note Search Toggle */}
            <TouchableOpacity
              style={[styles.iconBtn, isSearchOpen && styles.iconBtnActive]}
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
              <Search size={18} color={isSearchOpen ? '#2563EB' : activeColorConfig.text} />
            </TouchableOpacity>

            {/* Quick Copy to Clipboard */}
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={handleCopyAll}
              {...(Platform.OS === 'web' ? ({ onClick: handleCopyAll } as any) : {})}
            >
              <Copy size={18} color={activeColorConfig.text} />
            </TouchableOpacity>

            {/* Color Palette Picker */}
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => setIsColorPickerOpen(!isColorPickerOpen)}
              {...(Platform.OS === 'web' ? ({ onClick: () => setIsColorPickerOpen(!isColorPickerOpen) } as any) : {})}
            >
              <View
                style={[
                  styles.colorDotPreview,
                  { backgroundColor: activeColorConfig.cardBorder },
                ]}
              />
            </TouchableOpacity>

            {/* Audio Recording Toggle */}
            <TouchableOpacity
              style={[styles.iconBtn, isRecording && styles.iconBtnActiveRed]}
              onPress={() => setIsRecording(!isRecording)}
              {...(Platform.OS === 'web' ? ({ onClick: () => setIsRecording(!isRecording) } as any) : {})}
            >
              <Mic size={18} color={isRecording ? '#EF4444' : activeColorConfig.text} />
            </TouchableOpacity>

            {/* Pin Toggle */}
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => setIsPinned(!isPinned)}
              {...(Platform.OS === 'web' ? ({ onClick: () => setIsPinned(!isPinned) } as any) : {})}
            >
              <Pin
                size={18}
                color={isPinned ? '#E11D48' : activeColorConfig.text}
                fill={isPinned ? '#E11D48' : 'none'}
              />
            </TouchableOpacity>

            {/* Lock Toggle */}
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => {
                if (noteId) {
                  toggleNoteLock(noteId);
                  setIsLocked(!isLocked);
                } else {
                  setIsLocked(!isLocked);
                }
              }}
              {...(Platform.OS === 'web'
                ? ({
                    onClick: () => {
                      if (noteId) {
                        toggleNoteLock(noteId);
                        setIsLocked(!isLocked);
                      } else {
                        setIsLocked(!isLocked);
                      }
                    },
                  } as any)
                : {})}
            >
              {isLocked ? (
                <Lock size={18} color="#EF4444" />
              ) : (
                <Unlock size={18} color={activeColorConfig.textMuted} />
              )}
            </TouchableOpacity>

            {/* Delete Note */}
            {noteId ? (
              <TouchableOpacity
                style={styles.iconBtn}
                onPress={() => {
                  Alert.alert('메모 삭제', '이 메모를 휴지통으로 이동하시겠습니까?', [
                    { text: '취소', style: 'cancel' },
                    {
                      text: '삭제',
                      style: 'destructive',
                      onPress: () => {
                        deleteNote(noteId);
                        onClose();
                      },
                    },
                  ]);
                }}
                {...(Platform.OS === 'web'
                  ? ({
                      onClick: () => {
                        if (confirm('이 메모를 휴지통으로 이동하시겠습니까?')) {
                          deleteNote(noteId);
                          onClose();
                        }
                      },
                    } as any)
                  : {})}
              >
                <Trash2 size={18} color="#EF4444" />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        {/* In-Note Search Bar */}
        {isSearchOpen && (
          <View style={styles.inNoteSearchBar}>
            <Search size={15} color="#64748B" />
            <TextInput
              style={styles.inNoteSearchInput}
              placeholder="메모 내 검색어 입력..."
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
                setSearchQuery('');
                setIsSearchOpen(false);
              }}
              {...(Platform.OS === 'web'
                ? ({
                    onClick: () => {
                      setSearchQuery('');
                      setIsSearchOpen(false);
                    },
                  } as any)
                : {})}
            >
              <X size={15} color="#64748B" />
            </TouchableOpacity>
          </View>
        )}

        {/* Color Palette Flyout Strip */}
        {isColorPickerOpen && (
          <View style={styles.colorPaletteStrip}>
            {COLOR_KEYS.map((k) => {
              const cfg = NOTE_COLORS[k];
              const isSelected = color === k;
              return (
                <TouchableOpacity
                  key={k}
                  style={[
                    styles.colorChipBtn,
                    { backgroundColor: cfg.cardBorder },
                    isSelected && styles.colorChipBtnSelected,
                  ]}
                  onPress={() => {
                    setColor(k);
                    setIsColorPickerOpen(false);
                  }}
                  {...(Platform.OS === 'web'
                    ? ({
                        onClick: () => {
                          setColor(k);
                          setIsColorPickerOpen(false);
                        },
                      } as any)
                    : {})}
                >
                  {isSelected && <Check size={12} color="#FFFFFF" />}
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Audio Recording Studio (Live Recording Pill & Track Player) */}
        {(isRecording || audioNotes.length > 0) && (
          <View style={styles.audioStudioWrap}>
            <AudioRecordingStudio
              isRecording={isRecording}
              onStopRecording={(newAudio) => {
                setAudioNotes((prev) => [...prev, newAudio]);
                setIsRecording(false);
              }}
              onCancelRecording={() => setIsRecording(false)}
              audioNotes={audioNotes}
              onDeleteAudio={(id) => {
                setAudioNotes((prev) => prev.filter((a) => a.id !== id));
              }}
            />
          </View>
        )}

        {/* Lined Note Body Area (View Mode vs Edit Mode) */}
        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={true}
        >
          {isEditMode ? (
            <TextInput
              ref={contentInputRef}
              style={[
                styles.contentTextEditor,
                {
                  color: activeColorConfig.text,
                  fontSize: currentFontConfig.size,
                  lineHeight: currentFontConfig.lineHeight,
                },
              ]}
              placeholder="메모를 작성하세요..."
              placeholderTextColor={activeColorConfig.textMuted}
              value={content}
              onChangeText={setContent}
              multiline
              textAlignVertical="top"
              autoFocus={!initialNote}
            />
          ) : (
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => {
                setIsEditMode(true);
                setTimeout(() => contentInputRef.current?.focus(), 100);
              }}
              style={styles.readOnlyContainer}
              {...(Platform.OS === 'web'
                ? ({
                    onClick: () => {
                      setIsEditMode(true);
                      setTimeout(() => contentInputRef.current?.focus(), 100);
                    },
                  } as any)
                : {})}
            >
              {content ? (
                (() => {
                  if (!searchQuery.trim()) {
                    return (
                      <Text
                        style={[
                          styles.contentTextRead,
                          {
                            color: activeColorConfig.text,
                            fontSize: currentFontConfig.size,
                            lineHeight: currentFontConfig.lineHeight,
                          },
                        ]}
                      >
                        {content}
                      </Text>
                    );
                  }
                  // 검색어 하이라이트 렌더링
                  const escapedQuery = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                  const parts = content.split(new RegExp(`(${escapedQuery})`, 'gi'));
                  return (
                    <Text
                      style={[
                        styles.contentTextRead,
                        {
                          color: activeColorConfig.text,
                          fontSize: currentFontConfig.size,
                          lineHeight: currentFontConfig.lineHeight,
                        },
                      ]}
                    >
                      {parts.map((part, i) =>
                        part.toLowerCase() === searchQuery.toLowerCase() ? (
                          <Text key={i} style={styles.searchHighlight}>
                            {part}
                          </Text>
                        ) : (
                          part
                        )
                      )}
                    </Text>
                  );
                })()
              ) : (
                <Text style={[styles.emptyContentHint, { color: activeColorConfig.textMuted }]}>
                  내용이 비어있습니다. 탭하여 메모 작성을 시작하세요...
                </Text>
              )}
            </TouchableOpacity>
          )}
        </ScrollView>

        {/* Bottom Status & Fast Tool Bar */}
        <View style={[styles.bottomBar, { borderTopColor: activeColorConfig.cardBorder }]}>
          {/* Quick Formatting Tools */}
          <View style={styles.quickTools}>
            {isEditMode ? (
              <>
                <TouchableOpacity
                  style={styles.toolPill}
                  onPress={handleInsertBullet}
                  {...(Platform.OS === 'web' ? ({ onClick: handleInsertBullet } as any) : {})}
                >
                  <List size={14} color={activeColorConfig.text} />
                  <Text style={[styles.toolPillText, { color: activeColorConfig.text }]}>
                    목록
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.toolPill}
                  onPress={handleInsertDate}
                  {...(Platform.OS === 'web' ? ({ onClick: handleInsertDate } as any) : {})}
                >
                  <Calendar size={14} color={activeColorConfig.text} />
                  <Text style={[styles.toolPillText, { color: activeColorConfig.text }]}>
                    날짜 삽입
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity
                style={styles.editModeSwitchBtn}
                onPress={() => {
                  setIsEditMode(true);
                  setTimeout(() => contentInputRef.current?.focus(), 100);
                }}
                {...(Platform.OS === 'web'
                  ? ({
                      onClick: () => {
                        setIsEditMode(true);
                        setTimeout(() => contentInputRef.current?.focus(), 100);
                      },
                    } as any)
                  : {})}
              >
                <Edit3 size={14} color="#FFFFFF" />
                <Text style={styles.editModeSwitchText}>메모 편집하기</Text>
              </TouchableOpacity>
            )}

            {/* Font Size Toggle Button (소/중/대/특대) */}
            <TouchableOpacity
              style={styles.toolPill}
              onPress={handleCycleFontSize}
              {...(Platform.OS === 'web' ? ({ onClick: handleCycleFontSize } as any) : {})}
            >
              <Type size={13} color={activeColorConfig.text} />
              <Text style={[styles.toolPillText, { color: activeColorConfig.text }]}>
                크기: {currentFontConfig.label}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Word & Character Counter */}
          <Text style={[styles.counterText, { color: activeColorConfig.textMuted }]}>
            글자 {charCount}자 • 단어 {wordCount}개
          </Text>
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
  safeArea: {
    flex: 1,
  },
  keyboardContainer: {
    flex: 1,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.4)',
    gap: 8,
  },
  backBtn: {
    padding: 6,
    borderRadius: 8,
  },
  headerTitleInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  headerTitleReadWrap: {
    flex: 1,
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  headerTitleText: {
    fontSize: 18,
    fontWeight: '700',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  completeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#059669',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginRight: 4,
  },
  completeBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  editBtnHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    marginRight: 4,
  },
  editBtnHeaderText: {
    color: '#2563EB',
    fontSize: 13,
    fontWeight: '700',
  },
  iconBtn: {
    padding: 7,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnActive: {
    backgroundColor: '#DBEAFE',
  },
  iconBtnActiveRed: {
    backgroundColor: '#FEE2E2',
  },
  colorDotPreview: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  inNoteSearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 14,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  inNoteSearchInput: {
    flex: 1,
    fontSize: 13.5,
    color: '#1E293B',
    padding: 0,
  },
  searchMatchPill: {
    backgroundColor: '#FEF08A',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  searchMatchPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#854D0E',
  },
  searchCloseBtn: {
    padding: 4,
  },
  searchHighlight: {
    backgroundColor: '#FDE047',
    color: '#854D0E',
    fontWeight: '700',
    borderRadius: 2,
  },
  colorPaletteStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  colorChipBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorChipBtnSelected: {
    borderWidth: 2.5,
    borderColor: '#0F172A',
    transform: [{ scale: 1.15 }],
  },
  audioStudioWrap: {
    paddingHorizontal: 16,
    paddingTop: 6,
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 40,
  },
  contentTextEditor: {
    minHeight: 300,
    padding: 0,
  },
  readOnlyContainer: {
    minHeight: 300,
    flex: 1,
  },
  contentTextRead: {
    letterSpacing: 0.2,
  },
  emptyContentHint: {
    fontSize: 15,
    fontStyle: 'italic',
    paddingTop: 8,
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
  quickTools: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  editModeSwitchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#2563EB',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  editModeSwitchText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '700',
  },
  toolPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
  },
  toolPillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  counterText: {
    fontSize: 11,
    fontWeight: '600',
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
