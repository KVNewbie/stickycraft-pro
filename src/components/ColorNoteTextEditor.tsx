import React, { useState, useRef, useMemo, useCallback } from 'react';
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
  Bell,
  Tag,
  Sparkles,
  Folder,
  Archive,
  Smile,
  Layers,
  Plus,
  BookOpen,
} from 'lucide-react-native';
import {
  Note,
  NoteColorId,
  AudioNote,
  NoteFontSize,
  PaperTemplate,
  DecoStyle,
  PlannerSticker,
} from '../types/note';
import { NOTE_COLORS, COLOR_KEYS } from '../constants/colors';
import { useNoteStore } from '../store/useNoteStore';
import { PaperTemplatePattern } from './PaperTemplatePattern';
import { AudioRecordingStudio } from './AudioRecordingStudio';
import { ColorNoteColorMapModal } from './ColorNoteColorMapModal';
import { PlannerStickerModal } from './PlannerStickerModal';
import { EditorExitRef, useEditorAutosave } from '../utils/useEditorAutosave';
import { waitForNotesWrite } from '../utils/notePersistence';

interface ColorNoteTextEditorProps {
  note?: Note | null;
  onClose: () => void;
  exitRef?: EditorExitRef;
}

const FONT_PRESETS: Record<NoteFontSize, { label: string; size: number; lineHeight: number }> = {
  sm: { label: '소', size: 13, lineHeight: 22 },
  base: { label: '보통', size: 16, lineHeight: 28 },
  lg: { label: '크게', size: 20, lineHeight: 34 },
  xl: { label: '특대', size: 26, lineHeight: 42 },
};

const TEMPLATE_OPTIONS: { id: PaperTemplate; label: string }[] = [
  { id: 'lined', label: '줄노트' },
  { id: 'grid', label: '모눈' },
  { id: 'dot', label: '도트' },
  { id: 'cornell', label: '코넬' },
  { id: 'blank', label: '무지' },
  { id: 'dark', label: '칠판' },
];

const DECO_OPTIONS: { id: DecoStyle; label: string }[] = [
  { id: 'tape', label: '테이프' },
  { id: 'pin', label: '압정 핀' },
  { id: 'corner-fold', label: '모서리접기' },
  { id: 'minimal', label: '미니멀' },
];

export const ColorNoteTextEditor: React.FC<ColorNoteTextEditorProps> = ({
  note: initialNote,
  onClose,
  exitRef,
}) => {
  const {
    notes,
    boards,
    activeBoardId,
    autoStartVoiceRecording,
    addNote,
    updateNote,
    deleteNote,
    toggleNoteLock,
    toggleArchiveNote,
    openReminderModal,
    openPdfSourceLink,
  } = useNoteStore();

  const [noteId, setNoteId] = useState<string>(initialNote?.id || '');
  const noteIdRef = useRef<string>(initialNote?.id || '');
  const liveNote = useMemo(
    () => (noteId ? notes.find((n) => n.id === noteId) || initialNote : initialNote),
    [notes, noteId, initialNote]
  );

  const [title, setTitle] = useState<string>(
    initialNote?.title || (autoStartVoiceRecording ? '음성 녹음 메모' : '')
  );
  const [content, setContent] = useState<string>(initialNote?.content || '');
  const [color, setColor] = useState<NoteColorId>(initialNote?.color || 'yellow');
  const [isPinned, setIsPinned] = useState<boolean>(initialNote?.isPinned || false);
  const [isLocked, setIsLocked] = useState<boolean>(initialNote?.isLocked || false);
  const [audioNotes, setAudioNotes] = useState<AudioNote[]>(initialNote?.audioNotes || []);
  const [boardId, setBoardId] = useState<string>(
    initialNote?.boardId && initialNote.boardId !== 'all'
      ? initialNote.boardId
      : activeBoardId !== 'all'
      ? activeBoardId
      : 'ideas'
  );
  const [tags, setTags] = useState<string[]>(initialNote?.tags || []);
  const [tagInput, setTagInput] = useState<string>('');
  const [stickers, setStickers] = useState<PlannerSticker[]>(initialNote?.stickers || []);
  const [paperTemplate, setPaperTemplate] = useState<PaperTemplate>(
    initialNote?.paperTemplate || 'lined'
  );
  const [decoStyle, setDecoStyle] = useState<DecoStyle>(initialNote?.decoStyle || 'tape');
  const [isMetaPanelOpen, setIsMetaPanelOpen] = useState<boolean>(false);
  const [isStickerModalOpen, setIsStickerModalOpen] = useState<boolean>(false);

  // ColorNote 1:1 읽기 모드 (View) vs 편집 모드 (Edit)
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
  const [isRecording, setIsRecording] = useState<boolean>(Boolean(autoStartVoiceRecording));

  const contentInputRef = useRef<TextInput>(null);

  const activeColorConfig = NOTE_COLORS[color] || NOTE_COLORS.yellow;
  const currentFontConfig = FONT_PRESETS[fontSize] || FONT_PRESETS.base;
  const isDarkTemplate = paperTemplate === 'dark';
  const effectiveTextColor = isDarkTemplate ? '#F8FAFC' : activeColorConfig.text;
  const effectiveMutedColor = isDarkTemplate ? '#94A3B8' : activeColorConfig.textMuted;

  const handleAddTag = () => {
    const cleaned = tagInput.trim().replace(/^#/, '');
    if (!cleaned) return;
    if (!tags.includes(cleaned)) {
      const nextTags = [...tags, cleaned];
      setTags(nextTags);
      if (noteIdRef.current) updateNote(noteIdRef.current, { tags: nextTags });
    }
    setTagInput('');
  };

  const handleRemoveTag = (tagToRemove: string) => {
    const nextTags = tags.filter((t) => t !== tagToRemove);
    setTags(nextTags);
    if (noteIdRef.current) updateNote(noteIdRef.current, { tags: nextTags });
  };

  // 실시간 자동 저장 스냅샷 (400ms 디바운스 + 백그라운드/언마운트/뒤로 가기 즉시 flush)
  const autosaveSnapshot = useMemo(() => {
    const hasContent =
      Boolean(title.trim()) ||
      Boolean(content.trim()) ||
      audioNotes.length > 0 ||
      stickers.length > 0;
    if (!noteIdRef.current && !hasContent) return null;
    return {
      title: title.trim(),
      content,
      color,
      decoStyle,
      tags,
      stickers,
      boardId,
      paperTemplate,
      isPinned,
      isLocked,
      audioNotes,
      fontSize,
    };
  }, [
    title,
    content,
    color,
    decoStyle,
    tags,
    stickers,
    boardId,
    paperTemplate,
    isPinned,
    isLocked,
    audioNotes,
    fontSize,
  ]);

  const writeAutosave = useCallback(
    async (snap: NonNullable<typeof autosaveSnapshot>) => {
      if (noteIdRef.current) {
        updateNote(noteIdRef.current, {
          ...snap,
          noteType: 'text',
          editorMode: 'text',
        });
      } else {
        const createdId = addNote({
          ...snap,
          images: initialNote?.images || [],
          checklist: [],
          noteType: 'text',
          editorMode: 'text',
        });
        noteIdRef.current = createdId;
        setNoteId(createdId);
      }
      await waitForNotesWrite();
    },
    [addNote, updateNote, initialNote?.images]
  );

  const {
    flush: flushAutosave,
    close: handleSaveAndExit,
    label: autosaveLabel,
  } = useEditorAutosave(autosaveSnapshot, writeAutosave, onClose, exitRef);

  // 완료 후 읽기 모드로 전환
  const handleCompleteEditing = async () => {
    await flushAutosave();
    if (noteIdRef.current) {
      setIsEditMode(false);
      showToast('✓ 저장되었습니다');
    } else {
      await handleSaveAndExit();
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
    if (noteIdRef.current) {
      updateNote(noteIdRef.current, { fontSize: next });
    }
    showToast(`🔤 글자 크기: ${FONT_PRESETS[next].label} (${FONT_PRESETS[next].size}px) • 줄간격 자동 동기화`);
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

  const primarySourceLink =
    liveNote?.pdfSourceLink ||
    (liveNote?.pdfSourceLinks && liveNote.pdfSourceLinks.length > 0
      ? liveNote.pdfSourceLinks[liveNote.pdfSourceLinks.length - 1]
      : undefined);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: isDarkTemplate ? '#1E293B' : activeColorConfig.bg }]}>
      {/* Paper Template Background (폰트 lineHeight와 1:1 줄간격 자동 동기화) */}
      <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
        <PaperTemplatePattern
          template={paperTemplate}
          colorHex={effectiveMutedColor}
          lineSpacing={currentFontConfig.lineHeight}
        />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardContainer}
      >
        {/* Top Header Bar (ColorNote Signature Top Bar) */}
        <View style={[styles.headerBar, { borderBottomColor: activeColorConfig.cardBorder, backgroundColor: isDarkTemplate ? 'rgba(15,23,42,0.75)' : 'rgba(255,255,255,0.4)' }]}>
          {/* Back & Auto-save button */}
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => {
              void handleSaveAndExit();
            }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            {...(Platform.OS === 'web'
              ? ({
                  onClick: () => {
                    void handleSaveAndExit();
                  },
                } as any)
              : {})}
          >
            <ArrowLeft size={22} color={effectiveTextColor} />
          </TouchableOpacity>

          {/* Title Field (Editable in Edit Mode, Label in View Mode) */}
          {isEditMode ? (
            <TextInput
              style={[styles.headerTitleInput, { color: effectiveTextColor }]}
              placeholder="제목 없음"
              placeholderTextColor={effectiveMutedColor}
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
                style={[styles.headerTitleText, { color: effectiveTextColor }]}
                numberOfLines={1}
              >
                {title || '제목 없음'}
              </Text>
            </TouchableOpacity>
          )}

          {/* 실시간 자동 저장 상태 표시 ('저장 중…' / '저장됨' / '저장 실패 · 다시 시도') */}
          {Boolean(autosaveLabel) && (
            <View
              style={{
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderRadius: 8,
                backgroundColor: 'rgba(15, 23, 42, 0.08)',
                marginRight: 4,
              }}
            >
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: '700',
                  color: effectiveTextColor,
                }}
              >
                {autosaveLabel}
              </Text>
            </View>
          )}

          {/* 발췌 스티커인 경우: 원본 PDF의 해당 문단으로 바로 돌아가는 '원문 보기' 버튼 */}
          {primarySourceLink && (
            <TouchableOpacity
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                backgroundColor: '#EFF6FF',
                borderWidth: 1,
                borderColor: '#93C5FD',
                paddingHorizontal: 9,
                paddingVertical: 5,
                borderRadius: 10,
                marginRight: 4,
              }}
              onPress={async () => {
                await flushAutosave();
                const ok = openPdfSourceLink(primarySourceLink);
                if (!ok) {
                  showToast('원본 PDF 문서를 찾을 수 없습니다.');
                }
              }}
            >
              <BookOpen size={13} color="#1D4ED8" />
              <Text style={{ fontSize: 11.5, fontWeight: '800', color: '#1D4ED8' }}>
                원문 보기
              </Text>
            </TouchableOpacity>
          )}

          {/* Right Action Buttons */}
          <View style={styles.headerActions}>
            {/* View/Edit Mode Indicator & Switcher */}
            {isEditMode ? (
              <TouchableOpacity
                style={styles.completeBtn}
                onPress={() => {
                  void handleCompleteEditing();
                }}
                {...(Platform.OS === 'web'
                  ? ({
                      onClick: () => {
                        void handleCompleteEditing();
                      },
                    } as any)
                  : {})}
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
              <Search size={18} color={isSearchOpen ? '#2563EB' : effectiveTextColor} />
            </TouchableOpacity>

            {/* Quick Copy to Clipboard */}
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={handleCopyAll}
              {...(Platform.OS === 'web' ? ({ onClick: handleCopyAll } as any) : {})}
            >
              <Copy size={18} color={effectiveTextColor} />
            </TouchableOpacity>

            {/* Color Palette Picker (ColorNote Color Map Trigger) */}
            <TouchableOpacity
              style={[
                styles.colorTileHeaderBtn,
                { borderColor: activeColorConfig.cardBorder, backgroundColor: activeColorConfig.bg },
              ]}
              onPress={() => setIsColorPickerOpen(true)}
              {...(Platform.OS === 'web' ? ({ onClick: () => setIsColorPickerOpen(true) } as any) : {})}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.colorTileInner,
                  { backgroundColor: activeColorConfig.cardBorder },
                ]}
              >
                <Palette size={12} color="#FFFFFF" />
              </View>
            </TouchableOpacity>

            {/* Audio Recording Toggle */}
            <TouchableOpacity
              style={[styles.iconBtn, isRecording && styles.iconBtnActiveRed]}
              onPress={() => setIsRecording(!isRecording)}
              {...(Platform.OS === 'web' ? ({ onClick: () => setIsRecording(!isRecording) } as any) : {})}
            >
              <Mic size={18} color={isRecording ? '#EF4444' : effectiveTextColor} />
            </TouchableOpacity>

            {/* Pin Toggle */}
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => setIsPinned(!isPinned)}
              {...(Platform.OS === 'web' ? ({ onClick: () => setIsPinned(!isPinned) } as any) : {})}
            >
              <Pin
                size={18}
                color={isPinned ? '#E11D48' : effectiveTextColor}
                fill={isPinned ? '#E11D48' : 'none'}
              />
            </TouchableOpacity>

            {/* ColorNote 알람 & 상태바 리마인더 (실시간 스토어 반영) */}
            <TouchableOpacity
              style={[
                styles.iconBtn,
                liveNote?.reminder && { backgroundColor: '#FEE2E2', borderColor: '#FCA5A5' },
              ]}
              onPress={() => {
                if (liveNote) {
                  openReminderModal(liveNote);
                } else {
                  showToast('편집 완료(체크) 버튼을 먼저 눌러 저장한 후 알람을 설정해 주세요');
                }
              }}
              {...(Platform.OS === 'web'
                ? ({
                    onClick: () => {
                      if (liveNote) {
                        openReminderModal(liveNote);
                      } else {
                        showToast('편집 완료(체크) 버튼을 먼저 눌러 저장한 후 알람을 설정해 주세요');
                      }
                    },
                  } as any)
                : {})}
            >
              <Bell
                size={18}
                color={liveNote?.reminder ? '#DC2626' : effectiveTextColor}
                fill={liveNote?.reminder?.pinToStatusBar ? '#DC2626' : 'none'}
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
                <Unlock size={18} color={effectiveMutedColor} />
              )}
            </TouchableOpacity>

            {/* Archive Note */}
            {noteId ? (
              <TouchableOpacity
                style={styles.iconBtn}
                onPress={() => {
                  toggleArchiveNote(noteId);
                  onClose();
                }}
                {...(Platform.OS === 'web'
                  ? ({
                      onClick: () => {
                        toggleArchiveNote(noteId);
                        onClose();
                      },
                    } as any)
                  : {})}
              >
                <Archive size={18} color={effectiveMutedColor} />
              </TouchableOpacity>
            ) : null}

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

        {/* Collapsible Metadata & Styling Panel (보드 / 속지 / 카드데코 / #태그 / 플래너 스티커) */}
        {isMetaPanelOpen && (
          <View style={[styles.metaPanel, { borderBottomColor: activeColorConfig.cardBorder }]}>
            {/* 1. 보드 & 속지 & 데코 선택 행 */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.metaRowScroll}>
              <View style={styles.metaGroup}>
                <Folder size={13} color="#64748B" />
                <Text style={styles.metaGroupLabel}>폴더:</Text>
                {boards
                  .filter((b) => b.id !== 'all')
                  .map((b) => (
                    <TouchableOpacity
                      key={b.id}
                      style={[styles.metaChip, boardId === b.id && styles.metaChipActive]}
                      onPress={() => setBoardId(b.id)}
                      {...(Platform.OS === 'web' ? ({ onClick: () => setBoardId(b.id) } as any) : {})}
                    >
                      <Text style={[styles.metaChipText, boardId === b.id && styles.metaChipTextActive]}>
                        {b.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
              </View>

              <View style={styles.metaDivider} />

              <View style={styles.metaGroup}>
                <Layers size={13} color="#64748B" />
                <Text style={styles.metaGroupLabel}>속지:</Text>
                {TEMPLATE_OPTIONS.map((tpl) => (
                  <TouchableOpacity
                    key={tpl.id}
                    style={[styles.metaChip, paperTemplate === tpl.id && styles.metaChipActive]}
                    onPress={() => setPaperTemplate(tpl.id)}
                    {...(Platform.OS === 'web' ? ({ onClick: () => setPaperTemplate(tpl.id) } as any) : {})}
                  >
                    <Text style={[styles.metaChipText, paperTemplate === tpl.id && styles.metaChipTextActive]}>
                      {tpl.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.metaDivider} />

              <View style={styles.metaGroup}>
                <Sparkles size={13} color="#64748B" />
                <Text style={styles.metaGroupLabel}>상단장식:</Text>
                {DECO_OPTIONS.map((deco) => (
                  <TouchableOpacity
                    key={deco.id}
                    style={[styles.metaChip, decoStyle === deco.id && styles.metaChipActive]}
                    onPress={() => setDecoStyle(deco.id)}
                    {...(Platform.OS === 'web' ? ({ onClick: () => setDecoStyle(deco.id) } as any) : {})}
                  >
                    <Text style={[styles.metaChipText, decoStyle === deco.id && styles.metaChipTextActive]}>
                      {deco.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            {/* 2. 태그 입력 & 플래너 스티커 행 */}
            <View style={styles.metaTagStickerRow}>
              <View style={styles.tagInputBox}>
                <Tag size={13} color="#64748B" />
                <TextInput
                  style={styles.tagTextInput}
                  placeholder="태그 추가 후 Enter..."
                  placeholderTextColor="#94A3B8"
                  value={tagInput}
                  onChangeText={setTagInput}
                  onSubmitEditing={handleAddTag}
                />
                {tagInput.trim().length > 0 && (
                  <TouchableOpacity
                    style={styles.tagAddMiniBtn}
                    onPress={handleAddTag}
                    {...(Platform.OS === 'web' ? ({ onClick: handleAddTag } as any) : {})}
                  >
                    <Text style={styles.tagAddMiniBtnText}>추가</Text>
                  </TouchableOpacity>
                )}
              </View>

              <TouchableOpacity
                style={styles.stickerOpenBtn}
                onPress={() => setIsStickerModalOpen(true)}
                {...(Platform.OS === 'web' ? ({ onClick: () => setIsStickerModalOpen(true) } as any) : {})}
              >
                <Smile size={14} color="#7C3AED" />
                <Text style={styles.stickerOpenBtnText}>스티커 ({stickers.length})</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Active Tags & Stickers Preview Strip */}
        {(tags.length > 0 || stickers.length > 0) && (
          <View style={styles.activeBadgesStrip}>
            {stickers.map((st) => (
              <TouchableOpacity
                key={st.id}
                style={styles.stickerBadgePill}
                onPress={() => {
                  const next = stickers.filter((s) => s.id !== st.id);
                  setStickers(next);
                  if (noteId) updateNote(noteId, { stickers: next });
                }}
                {...(Platform.OS === 'web'
                  ? ({
                      onClick: () => {
                        const next = stickers.filter((s) => s.id !== st.id);
                        setStickers(next);
                        if (noteId) updateNote(noteId, { stickers: next });
                      },
                    } as any)
                  : {})}
              >
                <Text style={styles.stickerBadgeEmoji}>
                  {st.emoji} {st.label} ×
                </Text>
              </TouchableOpacity>
            ))}
            {tags.map((t) => (
              <TouchableOpacity
                key={t}
                style={styles.tagBadgePill}
                onPress={() => handleRemoveTag(t)}
                {...(Platform.OS === 'web' ? ({ onClick: () => handleRemoveTag(t) } as any) : {})}
              >
                <Text style={styles.tagBadgeText}>#{t} ×</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

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

        {/* ColorNote Signature Color Map Picker Modal */}
        <ColorNoteColorMapModal
          visible={isColorPickerOpen}
          currentColor={color}
          onSelectColor={(k) => {
            setColor(k);
            if (noteId) {
              updateNote(noteId, { color: k });
            }
            showToast(`🎨 메모 색상 변경: ${NOTE_COLORS[k]?.name || k}`);
          }}
          onClose={() => setIsColorPickerOpen(false)}
        />

        {/* Planner Sticker Picker Modal */}
        <PlannerStickerModal
          visible={isStickerModalOpen}
          onSelectSticker={(sticker) => {
            setStickers((prev) => {
              const next = [...prev, sticker];
              if (noteId) updateNote(noteId, { stickers: next });
              return next;
            });
            showToast(`${sticker.emoji} '${sticker.label}' 스티커 부착됨`);
          }}
          onInsertStickerText={(txt) => {
            setContent((prev) => (prev ? `${prev}\n${txt}` : txt));
            setIsEditMode(true);
          }}
          onClose={() => setIsStickerModalOpen(false)}
        />

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
                  color: effectiveTextColor,
                  fontSize: currentFontConfig.size,
                  lineHeight: currentFontConfig.lineHeight,
                },
              ]}
              placeholder="메모를 작성하세요..."
              placeholderTextColor={effectiveMutedColor}
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
                            color: effectiveTextColor,
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
                          color: effectiveTextColor,
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
                <Text style={[styles.emptyContentHint, { color: effectiveMutedColor }]}>
                  내용이 비어있습니다. 탭하여 메모 작성을 시작하세요...
                </Text>
              )}
            </TouchableOpacity>
          )}
        </ScrollView>

        {/* Bottom Status & Fast Tool Bar */}
        <View style={[styles.bottomBar, { borderTopColor: activeColorConfig.cardBorder, backgroundColor: isDarkTemplate ? 'rgba(15,23,42,0.85)' : 'rgba(255,255,255,0.6)' }]}>
          {/* Quick Formatting Tools */}
          <View style={styles.quickTools}>
            {isEditMode ? (
              <>
                <TouchableOpacity
                  style={styles.toolPill}
                  onPress={handleInsertBullet}
                  {...(Platform.OS === 'web' ? ({ onClick: handleInsertBullet } as any) : {})}
                >
                  <List size={14} color="#1E293B" />
                  <Text style={[styles.toolPillText, { color: '#1E293B' }]}>
                    목록
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.toolPill}
                  onPress={handleInsertDate}
                  {...(Platform.OS === 'web' ? ({ onClick: handleInsertDate } as any) : {})}
                >
                  <Calendar size={14} color="#1E293B" />
                  <Text style={[styles.toolPillText, { color: '#1E293B' }]}>
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
              <Type size={13} color="#1E293B" />
              <Text style={[styles.toolPillText, { color: '#1E293B' }]}>
                크기: {currentFontConfig.label}
              </Text>
            </TouchableOpacity>

            {/* Metadata / Template / Tag / Sticker Toggle Button */}
            <TouchableOpacity
              style={[styles.toolPill, isMetaPanelOpen && styles.toolPillActive]}
              onPress={() => setIsMetaPanelOpen(!isMetaPanelOpen)}
              {...(Platform.OS === 'web' ? ({ onClick: () => setIsMetaPanelOpen(!isMetaPanelOpen) } as any) : {})}
            >
              <Sparkles size={13} color={isMetaPanelOpen ? '#2563EB' : '#1E293B'} />
              <Text style={[styles.toolPillText, { color: isMetaPanelOpen ? '#2563EB' : '#1E293B' }]}>
                속지·태그·꾸미기
              </Text>
            </TouchableOpacity>
          </View>

          {/* Word & Character Counter */}
          <Text style={[styles.counterText, { color: effectiveMutedColor }]}>
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
  colorTileHeaderBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 2,
    elevation: 2,
  },
  colorTileInner: {
    width: '100%',
    height: '100%',
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaPanel: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderBottomWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
  },
  metaRowScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  metaGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  metaGroupLabel: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#475569',
    marginRight: 2,
  },
  metaChip: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  metaChipActive: {
    backgroundColor: '#DBEAFE',
    borderColor: '#3B82F6',
  },
  metaChipText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#475569',
  },
  metaChipTextActive: {
    color: '#1D4ED8',
    fontWeight: '700',
  },
  metaDivider: {
    width: 1,
    height: 18,
    backgroundColor: '#CBD5E1',
    marginHorizontal: 4,
  },
  metaTagStickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  tagInputBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 10,
    paddingVertical: 5,
    gap: 6,
  },
  tagTextInput: {
    flex: 1,
    fontSize: 12.5,
    color: '#1E293B',
    padding: 0,
  },
  tagAddMiniBtn: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  tagAddMiniBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  stickerOpenBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F3E8FF',
    borderWidth: 1,
    borderColor: '#DDD6FE',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  stickerOpenBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6D28D9',
  },
  activeBadgesStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  stickerBadgePill: {
    backgroundColor: 'rgba(255,255,255,0.85)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
  },
  stickerBadgeEmoji: {
    fontSize: 15,
  },
  tagBadgePill: {
    backgroundColor: 'rgba(255,255,255,0.8)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  tagBadgeText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#334155',
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
    paddingTop: 14,
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
    flexWrap: 'wrap',
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
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
  },
  toolPillActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#93C5FD',
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
