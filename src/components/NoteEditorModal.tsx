import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { SvgXml } from 'react-native-svg';
import {
  X,
  Check,
  Image as ImageIcon,
  CheckSquare,
  Pin,
  Trash2,
  Tag,
  Folder,
  Sliders,
  Plus,
  Type,
  AlignLeft,
  AlignRight,
  List,
  ListOrdered,
  Sparkles,
  Smile,
  MoveUp,
  MoveDown,
  FileText,
  Maximize2,
  Eye,
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { useNoteStore } from '../store/useNoteStore';
import {
  Note,
  NoteColorId,
  DecoStyle,
  ChecklistItem,
  NoteImage,
  NoteFontSize,
  NoteLineHeight,
  NoteCardWidth,
  ImageSize,
  ImagePlacement,
  TextWrapMode,
  PaperTemplate,
  AudioNote,
  PlannerSticker,
  EditorMode,
  FreeHandStroke,
} from '../types/note';
import { NOTE_COLORS, COLOR_KEYS } from '../constants/colors';
import { InteractiveImageEditor } from './InteractiveImageEditor';
import { DrawingPadModal } from './DrawingPadModal';
import { ShareCardModal } from './ShareCardModal';
import { PaperTemplatePattern } from './PaperTemplatePattern';
import { PlannerStickerModal } from './PlannerStickerModal';
import { VoiceNoteModal } from './VoiceNoteModal';
import { AudioPlayerBar } from './AudioPlayerBar';
import { EditorTabBar } from './EditorTabBar';
import { ProToolbar, ActiveToolType } from './ProToolbar';
import { PdfWorkspaceViewer } from './PdfWorkspaceViewer';
import { FreeCanvasEditor, FreeCanvasEditorRef } from './FreeCanvasEditor';
import { DeviceSyncModal } from './DeviceSyncModal';
import { exportNoteToPdf } from '../utils/pdfExporter';
import { Ionicons } from '@expo/vector-icons';

// 엑셀 및 비즈니스 특수 문자 팔레트 카테고리
const SYMBOL_CATEGORIES = [
  {
    category: '도형 & 기호',
    symbols: ['★', '☆', '●', '○', '■', '□', '◆', '◇', '▲', '▼', '▶', '◀'],
  },
  {
    category: '화살표 & 문장부호',
    symbols: ['→', '←', '↑', '↓', '↔', '⇄', '⇒', '※', '✦', '✧', '『', '』'],
  },
  {
    category: '통화 & 단위',
    symbols: ['₩', '$', '€', '¥', '%', '℃', '℉', '±', '×', '÷', '≒', '≠'],
  },
  {
    category: '업무 & 감성 아이콘',
    symbols: ['✓', '✕', '⚡', '☕', '💡', '📌', '📎', '✏️', '⏰', '🎯', '🏷️', '🔔'],
  },
];

export const NoteEditorModal: React.FC = () => {
  const {
    isEditorOpen,
    selectedNoteForEdit,
    closeEditor,
    addNote,
    updateNote,
    deleteNote,
    boards,
    activeBoardId,
    openImageViewer,
    editorMode,
    setEditorMode,
    editorTabs,
    activeEditorTabId,
    setActiveEditorTab,
    capturedSnippet,
    setCapturedSnippet,
    isDeviceSyncModalOpen,
    openDeviceSyncModal,
    closeDeviceSyncModal,
  } = useNoteStore();

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [color, setColor] = useState<NoteColorId>('yellow');
  const [decoStyle, setDecoStyle] = useState<DecoStyle>('tape');
  const [images, setImages] = useState<NoteImage[]>([]);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [boardId, setBoardId] = useState('ideas');
  const [isPinned, setIsPinned] = useState(false);
  const [newChecklistText, setNewChecklistText] = useState('');

  // 전문가 타이포그래피 & 레이아웃 설정
  const [fontSize, setFontSize] = useState<NoteFontSize>('base');
  const [lineHeight, setLineHeight] = useState<NoteLineHeight>('normal');
  const [cardWidth, setCardWidth] = useState<NoteCardWidth>('standard');

  // 텍스트 활성화(포커스) 상태 추적 -> 활성화 시에만 우측 위에 특수문자/서식 바 노출
  const [isTextFocused, setIsTextFocused] = useState(false);

  // 활성 보조 도구 탭 ('none' | 'formatting' | 'symbols' | 'typography')
  const [activeToolTab, setActiveToolTab] = useState<'none' | 'formatting' | 'symbols' | 'typography'>('none');

  const contentInputRef = useRef<TextInput>(null);

  // Noteshelf & Jnotes 고도화 상태
  const [paperTemplate, setPaperTemplate] = useState<PaperTemplate>('blank');
  const [stickers, setStickers] = useState<PlannerSticker[]>([]);
  const [audioNotes, setAudioNotes] = useState<AudioNote[]>([]);
  const [isStickerModalOpen, setIsStickerModalOpen] = useState(false);
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);

  // 자유 모드 필기 캔버스 & 프로 툴바 상태
  const [freeDrawingData, setFreeDrawingData] = useState<string | undefined>(undefined);
  const [strokes, setStrokes] = useState<FreeHandStroke[]>([]);
  const [autoSortChecked, setAutoSortChecked] = useState(false);
  const [proTool, setProTool] = useState<ActiveToolType>('pen');
  const [proColor, setProColor] = useState<string>('#0f172a');
  const [proWidth, setProWidth] = useState<number>(4);
  const [isRulerActive, setIsRulerActive] = useState<boolean>(false);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const freeCanvasRef = useRef<FreeCanvasEditorRef | null>(null);

  // Samsung/Apple Notes 손글씨 드로잉 & 공유 모달 상태
  const [isDrawingModalOpen, setIsDrawingModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  // 다중 이미지 중 활성 편집 이미지 인덱스
  const [activeImgIndex, setActiveImgIndex] = useState(0);

  // Apple Notes / Keep 스타일 스마트 체크리스트 도구
  const sortCompletedChecklistToBottom = () => {
    setChecklist((prev) => {
      const uncompleted = prev.filter((i) => !i.completed);
      const completed = prev.filter((i) => i.completed);
      return [...uncompleted, ...completed];
    });
  };

  const toggleAllChecklist = () => {
    const hasUncompleted = checklist.some((i) => !i.completed);
    setChecklist((prev) => prev.map((i) => ({ ...i, completed: hasUncompleted })));
  };

  // 글 중간 삽입 모드용 본문 파트 분할 (part1, part2)
  const getSplitContent = () => {
    const parts = content.split('\n\n');
    if (parts.length > 1) {
      return { part1: parts[0], part2: parts.slice(1).join('\n\n') };
    }
    return { part1: content, part2: '' };
  };

  const handlePart1Change = (t: string) => {
    const { part2 } = getSplitContent();
    setContent(part2 ? `${t}\n\n${part2}` : t);
  };

  const handlePart2Change = (t: string) => {
    const { part1 } = getSplitContent();
    setContent(`${part1}\n\n${t}`);
  };

  // 활성 이미지 어울림 모드 즉시 변경
  const handleSetImageWrap = (mode: TextWrapMode, placement: ImagePlacement = 'inline') => {
    if (images.length === 0) return;
    const targetIdx = Math.min(activeImgIndex, images.length - 1);
    const targetId = images[targetIdx].id;
    setImages((prev) =>
      prev.map((img, idx) =>
        idx === targetIdx
          ? {
              ...img,
              wrapMode: mode,
              placement: placement,
              opacity: mode === 'behind-text' ? (img.opacity ?? 0.35) : 1,
            }
          : img
      )
    );
  };

  // 기존 메모 편집 시 데이터 로드
  useEffect(() => {
    if (selectedNoteForEdit) {
      setTitle(selectedNoteForEdit.title || '');
      setContent(selectedNoteForEdit.content || '');
      setColor(selectedNoteForEdit.color || 'yellow');
      setDecoStyle(selectedNoteForEdit.decoStyle || 'tape');
      setImages(selectedNoteForEdit.images || []);
      setChecklist(selectedNoteForEdit.checklist || []);
      setTags(selectedNoteForEdit.tags || []);
      setBoardId(selectedNoteForEdit.boardId || 'ideas');
      setIsPinned(selectedNoteForEdit.isPinned || false);
      setFontSize(selectedNoteForEdit.fontSize || 'base');
      setLineHeight(selectedNoteForEdit.lineHeight || 'normal');
      setCardWidth(selectedNoteForEdit.cardWidth || 'standard');
      setPaperTemplate(selectedNoteForEdit.paperTemplate || 'blank');
      setStickers(selectedNoteForEdit.stickers || []);
      setAudioNotes(selectedNoteForEdit.audioNotes || []);
      setFreeDrawingData(selectedNoteForEdit.freeDrawingData);
      setStrokes(selectedNoteForEdit.strokes || []);
      setAutoSortChecked(selectedNoteForEdit.autoSortChecked || false);
      if (selectedNoteForEdit.editorMode) {
        setEditorMode(selectedNoteForEdit.editorMode);
      } else if (selectedNoteForEdit.freeDrawingData || (selectedNoteForEdit.strokes && selectedNoteForEdit.strokes.length > 0)) {
        setEditorMode('free');
      } else {
        setEditorMode('text');
      }
    } else {
      setTitle('');
      setContent('');
      setColor('yellow');
      setDecoStyle('tape');
      setImages([]);
      setChecklist([]);
      setTags([]);
      setBoardId(activeBoardId === 'all' ? 'ideas' : activeBoardId);
      setIsPinned(false);
      setFontSize('base');
      setLineHeight('normal');
      setCardWidth('standard');
      setPaperTemplate('blank');
      setStickers([]);
      setAudioNotes([]);
      setFreeDrawingData(undefined);
      setStrokes([]);
      setAutoSortChecked(false);
      setEditorMode('text');
    }
    setTagInput('');
    setNewChecklistText('');
    setActiveToolTab('none');
    setIsTextFocused(false);
  }, [selectedNoteForEdit, isEditorOpen, activeBoardId]);

  const activeColorConfig = NOTE_COLORS[color] || NOTE_COLORS.yellow;

  // 특수 문자 본문 삽입
  const insertSymbol = (sym: string) => {
    setContent((prev) => prev + sym);
  };

  // 행 구성 서식 삽입 (불릿, 번호, 구분선 등)
  const insertFormatting = (prefix: string) => {
    setContent((prev) => {
      if (prev.endsWith('\n') || prev.length === 0) {
        return prev + prefix;
      }
      return prev + '\n' + prefix;
    });
  };

  // 다음 번호 매기기 자동 계산
  const insertNextNumber = () => {
    const lines = content.split('\n');
    let lastNum = 0;
    for (let i = lines.length - 1; i >= 0; i--) {
      const match = lines[i].match(/^(\d+)\.\s/);
      if (match) {
        lastNum = parseInt(match[1], 10);
        break;
      }
    }
    const nextNum = lastNum + 1;
    insertFormatting(`${nextNum}. `);
  };

  // 사진 첨부 (Image Picker)
  const handlePickImage = async () => {
    try {
      if (Platform.OS !== 'web') {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('권한 안내', '사진을 첨부하려면 갤러리 접근 권한이 필요합니다.');
          return;
        }
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.85,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const newImg: NoteImage = {
          id: 'img_' + Date.now(),
          uri: result.assets[0].uri,
          size: 'medium',
          placement: 'top',
          x: 0,
          y: 0,
          scale: 1,
        };
        setImages((prev) => [...prev, newImg]);
      }
    } catch (e) {
      console.error('Image picker error', e);
    }
  };

  // 개별 이미지 업데이트 (위치, 크기, 배율)
  const handleUpdateImage = (imgId: string, updatedFields: Partial<NoteImage>) => {
    setImages((prev) =>
      prev.map((img) => (img.id === imgId ? { ...img, ...updatedFields } : img))
    );
  };

  const handleRemoveImage = (imgId: string) => {
    setImages((prev) => prev.filter((i) => i.id !== imgId));
  };

  // 체크리스트 관리
  const handleAddChecklistItem = () => {
    if (!newChecklistText.trim()) return;
    const newItem: ChecklistItem = {
      id: 'chk_' + Date.now(),
      text: newChecklistText.trim(),
      completed: false,
    };
    setChecklist((prev) => [...prev, newItem]);
    setNewChecklistText('');
  };

  const handleToggleChecklist = (id: string) => {
    setChecklist((prev) => {
      let updated = prev.map((item) =>
        item.id === id ? { ...item, completed: !item.completed } : item
      );
      if (autoSortChecked) {
        updated.sort((a, b) => (a.completed === b.completed ? 0 : a.completed ? 1 : -1));
      }
      return updated;
    });
  };

  const handleCheckAll = () => {
    setChecklist((prev) => prev.map((item) => ({ ...item, completed: true })));
  };

  const handleUncheckAll = () => {
    setChecklist((prev) => prev.map((item) => ({ ...item, completed: false })));
  };

  const handleToggleAutoSort = () => {
    const next = !autoSortChecked;
    setAutoSortChecked(next);
    if (next) {
      setChecklist((prev) =>
        [...prev].sort((a, b) => (a.completed === b.completed ? 0 : a.completed ? 1 : -1))
      );
    }
  };

  const handleRemoveChecklist = (id: string) => {
    setChecklist((prev) => prev.filter((item) => item.id !== id));
  };

  // 태그 관리
  const handleAddTag = () => {
    const trimmed = tagInput.trim().replace(/^#/, '');
    if (!trimmed) return;
    if (!tags.includes(trimmed)) {
      setTags((prev) => [...prev, trimmed]);
    }
    setTagInput('');
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags((prev) => prev.filter((t) => t !== tagToRemove));
  };

  // 저장 처리
  const handleSave = () => {
    if (
      !title.trim() &&
      !content.trim() &&
      images.length === 0 &&
      checklist.length === 0 &&
      audioNotes.length === 0 &&
      stickers.length === 0 &&
      !freeDrawingData &&
      strokes.length === 0
    ) {
      closeEditor();
      return;
    }

    if (selectedNoteForEdit) {
      updateNote(selectedNoteForEdit.id, {
        title: title.trim(),
        content: content,
        color,
        decoStyle,
        images,
        checklist,
        tags,
        boardId,
        isPinned,
        fontSize,
        lineHeight,
        cardWidth,
        paperTemplate,
        stickers,
        audioNotes,
        freeDrawingData,
        strokes,
        autoSortChecked,
        editorMode,
      });
    } else {
      addNote({
        title: title.trim(),
        content: content,
        color,
        decoStyle,
        images,
        checklist,
        tags,
        boardId,
        isPinned,
        isLocked: false,
        fontSize,
        lineHeight,
        cardWidth,
        paperTemplate,
        stickers,
        audioNotes,
        freeDrawingData,
        strokes,
        autoSortChecked,
        editorMode,
      });
    }
    closeEditor();
  };

  // PDF로 구워서 내보내기 (Export to PDF)
  const handleExportPdf = async () => {
    try {
      const success = await exportNoteToPdf({
        note: {
          title: title.trim() || 'StickyCraft_Note',
          content,
          color,
          tags,
          checklist,
          images,
          paperTemplate,
          freeDrawingData,
          updatedAt: Date.now(),
        },
      });
      if (success) {
        if (Platform.OS !== 'web') {
          Alert.alert('PDF 굽기 완료', '성공적으로 PDF 문서가 생성되었습니다.');
        }
      }
    } catch (e) {
      console.error('PDF export failed', e);
    }
  };

  // 영역 캡처 스니펫 메모/캔버스에 붙여넣기
  const handlePasteSnippet = () => {
    if (!capturedSnippet) return;
    const newImg: NoteImage = {
      id: 'img_snip_' + Date.now(),
      uri: capturedSnippet,
      size: 'large',
      placement: 'inline',
      wrapMode: 'break',
      x: 60,
      y: 120,
      customWidth: 340,
      customHeight: 240,
      caption: 'PDF/문서 영역 캡처 스니펫',
    };
    setImages((prev) => [...prev, newImg]);

    // PDF 탭에서 붙여넣기를 실행한 경우에만 기존 메모 또는 캔버스 탭으로 전환
    if (currentTab?.type !== 'canvas' && currentTab?.type !== 'note') {
      const targetTab = editorTabs.find((t) => t.type === 'canvas' || t.type === 'note');
      if (targetTab) {
        setActiveEditorTab(targetTab.id);
      }
    }
  };

  // 삭제 처리
  const handleDelete = () => {
    if (selectedNoteForEdit) {
      if (Platform.OS === 'web') {
        if (window.confirm('이 스티커 메모를 삭제하시겠습니까?')) {
          deleteNote(selectedNoteForEdit.id);
          closeEditor();
        }
      } else {
        Alert.alert('메모 삭제', '정말 이 스티커 메모를 삭제하시겠습니까?', [
          { text: '취소', style: 'cancel' },
          {
            text: '삭제',
            style: 'destructive',
            onPress: () => {
              deleteNote(selectedNoteForEdit.id);
              closeEditor();
            },
          },
        ]);
      }
    }
  };

  const charCount = content.length;
  const charCountNoSpace = content.replace(/\s+/g, '').length;
  const wordCount = content.trim() ? content.trim().split(/\s+/).filter(Boolean).length : 0;
  const readTimeMin = Math.max(1, Math.ceil(charCount / 500));

  const fontSizeStyle =
    fontSize === 'sm' ? 13 : fontSize === 'lg' ? 18 : fontSize === 'xl' ? 22 : 15;

  const lineHeightMultiplier =
    lineHeight === 'tight' ? 1.3 : lineHeight === 'relaxed' ? 2.0 : 1.6;

  const currentTab = editorTabs.find((t) => t.id === activeEditorTabId) || editorTabs[0];

  return (
    <Modal
      visible={isEditorOpen}
      animationType="slide"
      transparent={false}
      onRequestClose={closeEditor}
    >
      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor: activeColorConfig.bg }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* 1. Goodnotes / Browser 스타일 다중 탭 시스템 바 */}
        <EditorTabBar onPasteSnippet={handlePasteSnippet} />

        {/* 2. 레퍼런스 스타일 상단 통합 프로 툴바 */}
        <ProToolbar
          onBack={closeEditor}
          canUndo={canUndo}
          canRedo={canRedo}
          onUndo={() => freeCanvasRef.current?.undo()}
          onRedo={() => freeCanvasRef.current?.redo()}
          selectedTool={proTool}
          onSelectTool={setProTool}
          currentColor={proColor}
          onSelectColor={setProColor}
          currentWidth={proWidth}
          onSelectWidth={setProWidth}
          isRulerActive={isRulerActive}
          onToggleRuler={() => setIsRulerActive(!isRulerActive)}
          onOpenStickers={() => setIsStickerModalOpen(true)}
          onOpenVoice={() => setIsVoiceModalOpen(true)}
          onAddImage={handlePickImage}
          onExportPdf={handleExportPdf}
          onOpenDeviceSync={openDeviceSyncModal}
          editorMode={editorMode}
          onToggleEditorMode={(mode) => setEditorMode(mode)}
          tabType={currentTab?.type || 'note'}
        />

        {/* 3. 서브 액션 바: 상태 정보 & 고정 & 삭제 & 저장 버튼 */}
        <View
          style={[
            styles.headerBar,
            { borderBottomColor: activeColorConfig.cardBorder },
          ]}
        >
          <View style={styles.headerCenter}>
            <Text style={[styles.headerStatusText, { color: activeColorConfig.textMuted }]}>
              {currentTab?.type === 'pdf'
                ? `📄 PDF 문서 뷰어 / 주석 필기 (${currentTab.pdfName || currentTab.title})`
                : currentTab?.type === 'canvas' || editorMode === 'free'
                ? '🎨 자유 손글씨 & 캔버스 모드'
                : selectedNoteForEdit
                ? '✍️ 스티커 메모 편집 (텍스트 모드)'
                : '✍️ 새 스티커 메모 (텍스트 모드)'}
            </Text>
          </View>

          <View style={styles.headerActions}>
            {selectedNoteForEdit && (
              <TouchableOpacity onPress={handleDelete} style={styles.headerIconBtn}>
                <Trash2 size={18} color="#DC2626" />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={() => setIsPinned(!isPinned)}
              style={styles.headerIconBtn}
            >
              <Pin
                size={18}
                color={isPinned ? '#E11D48' : activeColorConfig.textMuted}
                fill={isPinned ? '#E11D48' : 'none'}
              />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSave}
              style={[styles.saveBtn, { backgroundColor: activeColorConfig.text }]}
            >
              <Check size={16} color={activeColorConfig.bg} />
              <Text style={[styles.saveBtnText, { color: activeColorConfig.bg }]}>
                저장 완료
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 메인 작업 영역: PDF 뷰어 ⟷ 자유 캔버스 ⟷ 텍스트 에디터 */}
        {currentTab?.type === 'pdf' ? (
          <PdfWorkspaceViewer
            pdfUri={currentTab.pdfUri}
            pdfName={currentTab.pdfName || currentTab.title}
            selectedTool={proTool}
            currentColor={proColor}
            currentWidth={proWidth}
            isRulerActive={isRulerActive}
          />
        ) : currentTab?.type === 'canvas' || (currentTab?.type === 'note' && editorMode === 'free') ? (
          <FreeCanvasEditor
            ref={freeCanvasRef}
            initialDrawingData={freeDrawingData}
            initialStrokes={strokes}
            onUpdateStrokes={setStrokes}
            paperTemplate={paperTemplate}
            selectedTool={proTool}
            currentColor={proColor}
            currentWidth={proWidth}
            isRulerActive={isRulerActive}
            onUpdateDrawing={(dataUrl) => setFreeDrawingData(dataUrl)}
            canUndoState={(undo, redo) => {
              setCanUndo(undo);
              setCanRedo(redo);
            }}
            images={images}
            onUpdateImages={setImages}
            audioNotes={audioNotes}
            onUpdateAudioNotes={setAudioNotes}
          />
        ) : (
          <>
            {/* Scrollable Main Form */}
            <ScrollView
              style={styles.scrollForm}
              contentContainerStyle={styles.scrollFormContent}
              showsVerticalScrollIndicator={true}
            >
          {/* Noteshelf 페이퍼 속지 템플릿 패턴 */}
          <PaperTemplatePattern template={paperTemplate} />

          {/* Note Title Input */}
          <TextInput
            style={[styles.titleInput, { color: activeColorConfig.text }]}
            placeholder="제목을 입력하세요..."
            placeholderTextColor={activeColorConfig.textMuted}
            value={title}
            onChangeText={setTitle}
            maxLength={120}
            onFocus={() => setIsTextFocused(true)}
            onBlur={() => setTimeout(() => setIsTextFocused(false), 300)}
          />

          {/* Jnotes 다이어리 플래너 감성 스티커 스탬프 배지 */}
          {stickers.length > 0 && (
            <View style={styles.stickerHeaderRow}>
              {stickers.map((st) => (
                <View
                  key={st.id}
                  style={[
                    styles.stickerStampBadge,
                    {
                      backgroundColor: (st.color || '#8B5CF6') + '18',
                      borderColor: (st.color || '#8B5CF6') + '44',
                    },
                  ]}
                >
                  <Text style={styles.stickerStampEmoji}>{st.emoji}</Text>
                  <Text style={[styles.stickerStampLabel, { color: st.color || '#1E293B' }]}>
                    {st.label}
                  </Text>
                  <TouchableOpacity
                    onPress={() => setStickers((prev) => prev.filter((s) => s.id !== st.id))}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  >
                    <Ionicons name="close-circle" size={13} color="#94A3B8" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          {/* 사진이 첨부되어 있을 때: 글-그림 어울림 스타일 바 & 다중 사진 탭 */}
          {images.length > 0 && (
            <View style={styles.imageWrapHeaderContainer}>
              {/* 다중 사진 선택 탭 (2장 이상일 때) */}
              {images.length > 1 && (
                <View style={styles.multiPhotoTabBar}>
                  <Text style={[styles.photoTabLabel, { color: activeColorConfig.textMuted }]}>사진 선택:</Text>
                  {images.map((img, idx) => (
                    <TouchableOpacity
                      key={img.id}
                      style={[
                        styles.photoTabPill,
                        activeImgIndex === idx && styles.photoTabPillActive,
                      ]}
                      onPress={() => setActiveImgIndex(idx)}
                    >
                      <ImageIcon size={11} color={activeImgIndex === idx ? '#FFFFFF' : '#475569'} />
                      <Text
                        style={[
                          styles.photoTabPillText,
                          activeImgIndex === idx && styles.photoTabPillTextActive,
                        ]}
                      >
                        사진 {idx + 1}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* 글과 사진의 어울림 스타일 원클릭 스위처 */}
              <View style={styles.wrapModeSwitchBar}>
                <Text style={[styles.wrapSwitchBarLabel, { color: activeColorConfig.text }]}>
                  글과 그림 어울림:
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.wrapSwitchButtons}>
                  {/* 1. 좌측 어울림 */}
                  <TouchableOpacity
                    style={[
                      styles.wrapSwitchBtn,
                      (images[activeImgIndex]?.wrapMode === 'wrap-left' || (!images[activeImgIndex]?.wrapMode && images[activeImgIndex]?.placement === 'inline')) &&
                        styles.wrapSwitchBtnActive,
                    ]}
                    onPress={() => handleSetImageWrap('wrap-left', 'inline')}
                  >
                    <AlignLeft size={12} color={(images[activeImgIndex]?.wrapMode === 'wrap-left') ? '#FFFFFF' : '#334155'} />
                    <Text
                      style={[
                        styles.wrapSwitchBtnText,
                        (images[activeImgIndex]?.wrapMode === 'wrap-left') && styles.wrapSwitchBtnTextActive,
                      ]}
                    >
                      좌측 어울림
                    </Text>
                  </TouchableOpacity>

                  {/* 2. 우측 어울림 */}
                  <TouchableOpacity
                    style={[
                      styles.wrapSwitchBtn,
                      images[activeImgIndex]?.wrapMode === 'wrap-right' && styles.wrapSwitchBtnActive,
                    ]}
                    onPress={() => handleSetImageWrap('wrap-right', 'inline')}
                  >
                    <AlignRight size={12} color={images[activeImgIndex]?.wrapMode === 'wrap-right' ? '#FFFFFF' : '#334155'} />
                    <Text
                      style={[
                        styles.wrapSwitchBtnText,
                        images[activeImgIndex]?.wrapMode === 'wrap-right' && styles.wrapSwitchBtnTextActive,
                      ]}
                    >
                      우측 어울림
                    </Text>
                  </TouchableOpacity>

                  {/* 3. 사진 위에 글쓰기 */}
                  <TouchableOpacity
                    style={[
                      styles.wrapSwitchBtn,
                      images[activeImgIndex]?.wrapMode === 'behind-text' && styles.wrapSwitchBtnActive,
                    ]}
                    onPress={() => handleSetImageWrap('behind-text', 'inline')}
                  >
                    <FileText size={12} color={images[activeImgIndex]?.wrapMode === 'behind-text' ? '#FFFFFF' : '#334155'} />
                    <Text
                      style={[
                        styles.wrapSwitchBtnText,
                        images[activeImgIndex]?.wrapMode === 'behind-text' && styles.wrapSwitchBtnTextActive,
                      ]}
                    >
                      사진 위에 글쓰기
                    </Text>
                  </TouchableOpacity>

                  {/* 4. 본문 중간 삽입 */}
                  <TouchableOpacity
                    style={[
                      styles.wrapSwitchBtn,
                      (images[activeImgIndex]?.wrapMode === 'break' && images[activeImgIndex]?.placement === 'inline') && styles.wrapSwitchBtnActive,
                    ]}
                    onPress={() => handleSetImageWrap('break', 'inline')}
                  >
                    <Maximize2 size={12} color={(images[activeImgIndex]?.wrapMode === 'break' && images[activeImgIndex]?.placement === 'inline') ? '#FFFFFF' : '#334155'} />
                    <Text
                      style={[
                        styles.wrapSwitchBtnText,
                        (images[activeImgIndex]?.wrapMode === 'break' && images[activeImgIndex]?.placement === 'inline') && styles.wrapSwitchBtnTextActive,
                      ]}
                    >
                      글 중간 삽입
                    </Text>
                  </TouchableOpacity>

                  {/* 5. 상단 배치 */}
                  <TouchableOpacity
                    style={[
                      styles.wrapSwitchBtn,
                      (images[activeImgIndex]?.wrapMode === 'break' && images[activeImgIndex]?.placement === 'top') && styles.wrapSwitchBtnActive,
                    ]}
                    onPress={() => handleSetImageWrap('break', 'top')}
                  >
                    <MoveUp size={12} color={(images[activeImgIndex]?.wrapMode === 'break' && images[activeImgIndex]?.placement === 'top') ? '#FFFFFF' : '#334155'} />
                    <Text
                      style={[
                        styles.wrapSwitchBtnText,
                        (images[activeImgIndex]?.wrapMode === 'break' && images[activeImgIndex]?.placement === 'top') && styles.wrapSwitchBtnTextActive,
                      ]}
                    >
                      글 위
                    </Text>
                  </TouchableOpacity>

                  {/* 6. 하단 배치 */}
                  <TouchableOpacity
                    style={[
                      styles.wrapSwitchBtn,
                      (images[activeImgIndex]?.wrapMode === 'break' && images[activeImgIndex]?.placement === 'bottom') && styles.wrapSwitchBtnActive,
                    ]}
                    onPress={() => handleSetImageWrap('break', 'bottom')}
                  >
                    <MoveDown size={12} color={(images[activeImgIndex]?.wrapMode === 'break' && images[activeImgIndex]?.placement === 'bottom') ? '#FFFFFF' : '#334155'} />
                    <Text
                      style={[
                        styles.wrapSwitchBtnText,
                        (images[activeImgIndex]?.wrapMode === 'break' && images[activeImgIndex]?.placement === 'bottom') && styles.wrapSwitchBtnTextActive,
                      ]}
                    >
                      글 아래
                    </Text>
                  </TouchableOpacity>
                </ScrollView>
              </View>
            </View>
          )}

          {/* 통합 본문 작업 공간 (Unified Note Body Workspace) */}
          <View style={styles.editorBoxContainer}>
            {/* 텍스트 포커스 시 우측 상단에만 나타나는 특수문자 & 서식 퀵 툴팁 */}
            {isTextFocused && (
              <View style={styles.focusToolbarFloating}>
                <TouchableOpacity
                  style={[
                    styles.quickToolBtn,
                    activeToolTab === 'symbols' && styles.quickToolBtnActive,
                  ]}
                  onPress={() =>
                    setActiveToolTab(activeToolTab === 'symbols' ? 'none' : 'symbols')
                  }
                >
                  <Smile size={13} color={activeToolTab === 'symbols' ? '#FFFFFF' : '#0F172A'} />
                  <Text
                    style={[
                      styles.quickToolBtnText,
                      activeToolTab === 'symbols' && styles.quickToolBtnTextActive,
                    ]}
                  >
                    ★ 특수문자
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.quickToolBtn,
                    activeToolTab === 'formatting' && styles.quickToolBtnActive,
                  ]}
                  onPress={() =>
                    setActiveToolTab(activeToolTab === 'formatting' ? 'none' : 'formatting')
                  }
                >
                  <ListOrdered size={13} color={activeToolTab === 'formatting' ? '#FFFFFF' : '#0F172A'} />
                  <Text
                    style={[
                      styles.quickToolBtnText,
                      activeToolTab === 'formatting' && styles.quickToolBtnTextActive,
                    ]}
                  >
                    1·2·3 행구성
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* 본문 렌더링 엔진: 선택된 어울림 모드에 따라 글과 그림이 하나로 결합 */}
            {(() => {
              if (images.length === 0) {
                // 이미지 없을 때 일반 입력창
                return (
                  <TextInput
                    ref={contentInputRef}
                    style={[
                      styles.contentInput,
                      {
                        color: activeColorConfig.text,
                        fontSize: fontSizeStyle,
                        lineHeight: Math.round(fontSizeStyle * lineHeightMultiplier),
                      },
                    ]}
                    placeholder="스티커 메모 내용을 자유롭게 적어보세요. 글자 수 제한이 없으며 긴 글도 안전하게 저장됩니다..."
                    placeholderTextColor={activeColorConfig.textMuted}
                    value={content}
                    onChangeText={setContent}
                    multiline
                    textAlignVertical="top"
                    onFocus={() => setIsTextFocused(true)}
                    onBlur={() => setTimeout(() => setIsTextFocused(false), 300)}
                  />
                );
              }

              const curImg = images[activeImgIndex] || images[0];
              const curMode = curImg.wrapMode || 'wrap-left';
              const curPlacement = curImg.placement || 'inline';

              // 1. 좌측 어울림 (사진 좌 + 글 우)
              if (curMode === 'wrap-left') {
                return (
                  <View style={styles.wrapRowLayout}>
                    <View style={styles.wrapImageCol}>
                      <InteractiveImageEditor
                        image={curImg}
                        activeColorConfig={activeColorConfig}
                        onUpdate={(fields) => handleUpdateImage(curImg.id, fields)}
                        onRemove={() => handleRemoveImage(curImg.id)}
                      />
                    </View>
                    <View style={styles.wrapTextCol}>
                      <TextInput
                        ref={contentInputRef}
                        style={[
                          styles.contentInput,
                          styles.wrapInputFlex,
                          {
                            color: activeColorConfig.text,
                            fontSize: fontSizeStyle,
                            lineHeight: Math.round(fontSizeStyle * lineHeightMultiplier),
                          },
                        ]}
                        placeholder="사진 옆에 글을 바로 작성해보세요..."
                        placeholderTextColor={activeColorConfig.textMuted}
                        value={content}
                        onChangeText={setContent}
                        multiline
                        textAlignVertical="top"
                        onFocus={() => setIsTextFocused(true)}
                        onBlur={() => setTimeout(() => setIsTextFocused(false), 300)}
                      />
                    </View>
                  </View>
                );
              }

              // 2. 우측 어울림 (글 좌 + 사진 우)
              if (curMode === 'wrap-right') {
                return (
                  <View style={styles.wrapRowLayout}>
                    <View style={styles.wrapTextCol}>
                      <TextInput
                        ref={contentInputRef}
                        style={[
                          styles.contentInput,
                          styles.wrapInputFlex,
                          {
                            color: activeColorConfig.text,
                            fontSize: fontSizeStyle,
                            lineHeight: Math.round(fontSizeStyle * lineHeightMultiplier),
                          },
                        ]}
                        placeholder="사진 옆에 글을 바로 작성해보세요..."
                        placeholderTextColor={activeColorConfig.textMuted}
                        value={content}
                        onChangeText={setContent}
                        multiline
                        textAlignVertical="top"
                        onFocus={() => setIsTextFocused(true)}
                        onBlur={() => setTimeout(() => setIsTextFocused(false), 300)}
                      />
                    </View>
                    <View style={styles.wrapImageCol}>
                      <InteractiveImageEditor
                        image={curImg}
                        activeColorConfig={activeColorConfig}
                        onUpdate={(fields) => handleUpdateImage(curImg.id, fields)}
                        onRemove={() => handleRemoveImage(curImg.id)}
                      />
                    </View>
                  </View>
                );
              }

              // 3. 사진 위에 글쓰기 (배경 워터마크)
              if (curMode === 'behind-text') {
                return (
                  <View style={styles.behindTextEditorBox}>
                    {curImg.uri && curImg.uri.startsWith('data:image/svg+xml;utf8,') ? (
                      <View
                        style={[
                          StyleSheet.absoluteFillObject,
                          {
                            opacity: curImg.opacity ?? 0.35,
                            borderRadius: 12,
                            overflow: 'hidden',
                          },
                        ]}
                      >
                        <SvgXml
                          xml={decodeURIComponent(curImg.uri.replace('data:image/svg+xml;utf8,', ''))}
                          width="100%"
                          height="100%"
                        />
                      </View>
                    ) : (
                      <Image
                        source={{ uri: curImg.uri }}
                        style={[
                          StyleSheet.absoluteFillObject,
                          {
                            opacity: curImg.opacity ?? 0.35,
                            borderRadius: 12,
                          },
                        ]}
                        resizeMode="cover"
                      />
                    )}
                    <TextInput
                      ref={contentInputRef}
                      style={[
                        styles.contentInput,
                        styles.behindTextInput,
                        {
                          color: activeColorConfig.text,
                          fontSize: fontSizeStyle,
                          lineHeight: Math.round(fontSizeStyle * lineHeightMultiplier),
                        },
                      ]}
                      placeholder="사진 위에 글을 작성해보세요..."
                      placeholderTextColor={activeColorConfig.textMuted}
                      value={content}
                      onChangeText={setContent}
                      multiline
                      textAlignVertical="top"
                      onFocus={() => setIsTextFocused(true)}
                      onBlur={() => setTimeout(() => setIsTextFocused(false), 300)}
                    />
                    <View style={styles.behindOpacityBar}>
                      <Eye size={12} color="#475569" />
                      <Text style={styles.behindOpacityLabel}>사진 투명도:</Text>
                      {([0.2, 0.35, 0.5, 0.7, 1.0] as const).map((op) => (
                        <TouchableOpacity
                          key={op}
                          style={[
                            styles.opacityPill,
                            (curImg.opacity ?? 0.35) === op && styles.opacityPillActive,
                          ]}
                          onPress={() => handleUpdateImage(curImg.id, { opacity: op })}
                        >
                          <Text
                            style={[
                              styles.opacityPillText,
                              (curImg.opacity ?? 0.35) === op && styles.opacityPillTextActive,
                            ]}
                          >
                            {Math.round(op * 100)}%
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                );
              }

              // 4. 글 중간 삽입 (글 윗 단락 + 사진 + 글 아랫 단락)
              if (curMode === 'break' && curPlacement === 'inline') {
                const { part1, part2 } = getSplitContent();
                return (
                  <View style={styles.middleInsertLayout}>
                    <TextInput
                      style={[
                        styles.contentInput,
                        styles.partInput,
                        {
                          color: activeColorConfig.text,
                          fontSize: fontSizeStyle,
                          lineHeight: Math.round(fontSizeStyle * lineHeightMultiplier),
                        },
                      ]}
                      placeholder="사진 윗부분 본문 내용을 적어보세요..."
                      placeholderTextColor={activeColorConfig.textMuted}
                      value={part1}
                      onChangeText={handlePart1Change}
                      multiline
                      textAlignVertical="top"
                      onFocus={() => setIsTextFocused(true)}
                      onBlur={() => setTimeout(() => setIsTextFocused(false), 300)}
                    />
                    <View style={styles.middleImageWrapper}>
                      <InteractiveImageEditor
                        image={curImg}
                        activeColorConfig={activeColorConfig}
                        onUpdate={(fields) => handleUpdateImage(curImg.id, fields)}
                        onRemove={() => handleRemoveImage(curImg.id)}
                      />
                    </View>
                    <TextInput
                      style={[
                        styles.contentInput,
                        styles.partInput,
                        {
                          color: activeColorConfig.text,
                          fontSize: fontSizeStyle,
                          lineHeight: Math.round(fontSizeStyle * lineHeightMultiplier),
                        },
                      ]}
                      placeholder="사진 아랫부분에 이어서 적어보세요..."
                      placeholderTextColor={activeColorConfig.textMuted}
                      value={part2}
                      onChangeText={handlePart2Change}
                      multiline
                      textAlignVertical="top"
                      onFocus={() => setIsTextFocused(true)}
                      onBlur={() => setTimeout(() => setIsTextFocused(false), 300)}
                    />
                  </View>
                );
              }

              // 5. 상단 배치 (사진 위 + 글 아래)
              if (curPlacement === 'top') {
                return (
                  <View style={styles.inlineStackLayout}>
                    <InteractiveImageEditor
                      image={curImg}
                      activeColorConfig={activeColorConfig}
                      onUpdate={(fields) => handleUpdateImage(curImg.id, fields)}
                      onRemove={() => handleRemoveImage(curImg.id)}
                    />
                    <TextInput
                      ref={contentInputRef}
                      style={[
                        styles.contentInput,
                        {
                          color: activeColorConfig.text,
                          fontSize: fontSizeStyle,
                          lineHeight: Math.round(fontSizeStyle * lineHeightMultiplier),
                        },
                      ]}
                      placeholder="사진 아래에 본문 내용을 적어보세요..."
                      placeholderTextColor={activeColorConfig.textMuted}
                      value={content}
                      onChangeText={setContent}
                      multiline
                      textAlignVertical="top"
                      onFocus={() => setIsTextFocused(true)}
                      onBlur={() => setTimeout(() => setIsTextFocused(false), 300)}
                    />
                  </View>
                );
              }

              // 6. 하단 배치 (글 위 + 사진 아래)
              return (
                <View style={styles.inlineStackLayout}>
                  <TextInput
                    ref={contentInputRef}
                    style={[
                      styles.contentInput,
                      {
                        color: activeColorConfig.text,
                        fontSize: fontSizeStyle,
                        lineHeight: Math.round(fontSizeStyle * lineHeightMultiplier),
                      },
                    ]}
                    placeholder="스티커 메모 내용을 적어보세요..."
                    placeholderTextColor={activeColorConfig.textMuted}
                    value={content}
                    onChangeText={setContent}
                    multiline
                    textAlignVertical="top"
                    onFocus={() => setIsTextFocused(true)}
                    onBlur={() => setTimeout(() => setIsTextFocused(false), 300)}
                  />
                  <InteractiveImageEditor
                    image={curImg}
                    activeColorConfig={activeColorConfig}
                    onUpdate={(fields) => handleUpdateImage(curImg.id, fields)}
                    onRemove={() => handleRemoveImage(curImg.id)}
                  />
                </View>
              );
            })()}
          </View>

          {/* Noteshelf & Jnotes 음성 녹음 메모 목록 */}
          {audioNotes.length > 0 && (
            <View style={styles.audioNotesContainer}>
              <View style={styles.audioSectionHeader}>
                <Ionicons name="mic-outline" size={14} color={activeColorConfig.text} />
                <Text style={[styles.audioSectionTitle, { color: activeColorConfig.text }]}>
                  음성 녹음 메모 ({audioNotes.length})
                </Text>
              </View>
              {audioNotes.map((audio, idx) => (
                <AudioPlayerBar
                  key={audio.id}
                  audio={audio}
                  index={idx}
                  totalCount={audioNotes.length}
                  isPdfNote={false}
                  accentColor={activeColorConfig.text}
                  onDelete={() => setAudioNotes((prev) => prev.filter((a) => a.id !== audio.id))}
                  onUpdateTitle={(newTitle) =>
                    setAudioNotes((prev) =>
                      prev.map((a) => (a.id === audio.id ? { ...a, title: newTitle } : a))
                    )
                  }
                />
              ))}
            </View>
          )}

          {/* Notion / Bear 스타일 프로페셔널 글자수 & 독서 시간 통계 바 */}
          <View style={styles.statsRow}>
            <View style={styles.statsLeft}>
              <Ionicons name="stats-chart-outline" size={13} color={activeColorConfig.textMuted} />
              <Text style={[styles.statsText, { color: activeColorConfig.textMuted }]}>
                {charCount.toLocaleString()}자 (공백제외 {charCountNoSpace.toLocaleString()}자) • {wordCount}단어 • 읽기 약 {readTimeMin}분
              </Text>
            </View>
          </View>

          {/* Checklist (To-Do) Section */}
          <View
            style={[
              styles.checklistSection,
              { borderColor: activeColorConfig.cardBorder },
            ]}
          >
            <View style={styles.sectionTitleRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                <CheckSquare size={16} color={activeColorConfig.text} />
                <Text style={[styles.sectionTitle, { color: activeColorConfig.text }]}>
                  할 일 체크리스트 ({checklist.filter((c) => c.completed).length}/{checklist.length})
                </Text>
              </View>

              {/* Apple Notes / Keep 스마트 체크리스트 도구 */}
              {checklist.length > 0 && (
                <View style={styles.checklistQuickTools}>
                  <TouchableOpacity
                    onPress={sortCompletedChecklistToBottom}
                    style={styles.checklistSortBtn}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  >
                    <Ionicons name="arrow-down-circle-outline" size={13} color={activeColorConfig.textMuted} />
                    <Text style={[styles.checklistSortText, { color: activeColorConfig.textMuted }]}>
                      완료 항목 아래로
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={toggleAllChecklist}
                    style={styles.checklistSortBtn}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  >
                    <Ionicons name="checkmark-done-outline" size={13} color={activeColorConfig.textMuted} />
                    <Text style={[styles.checklistSortText, { color: activeColorConfig.textMuted }]}>
                      전체 토글
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {checklist.map((item) => (
              <View key={item.id} style={styles.checklistRow}>
                <TouchableOpacity
                  onPress={() => handleToggleChecklist(item.id)}
                  style={styles.checkIconBtn}
                >
                  {item.completed ? (
                    <CheckSquare size={18} color="#059669" />
                  ) : (
                    <View
                      style={[
                        styles.emptyBox,
                        { borderColor: activeColorConfig.textMuted },
                      ]}
                    />
                  )}
                </TouchableOpacity>
                <Text
                  style={[
                    styles.checklistText,
                    { color: activeColorConfig.text },
                    item.completed && styles.checklistCompleted,
                  ]}
                >
                  {item.text}
                </Text>
                <TouchableOpacity
                  onPress={() => handleRemoveChecklist(item.id)}
                  style={styles.checklistDeleteBtn}
                >
                  <X size={15} color={activeColorConfig.textMuted} />
                </TouchableOpacity>
              </View>
            ))}

            <View style={styles.addChecklistRow}>
              <TextInput
                style={[
                  styles.addChecklistInput,
                  {
                    color: activeColorConfig.text,
                    borderColor: activeColorConfig.cardBorder,
                  },
                ]}
                placeholder="새로운 할 일 항목 추가..."
                placeholderTextColor={activeColorConfig.textMuted}
                value={newChecklistText}
                onChangeText={setNewChecklistText}
                onSubmitEditing={handleAddChecklistItem}
              />
              <TouchableOpacity
                style={[
                  styles.addChecklistBtn,
                  { backgroundColor: activeColorConfig.text },
                ]}
                onPress={handleAddChecklistItem}
              >
                <Plus size={16} color={activeColorConfig.bg} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Tags Section */}
          <View style={styles.tagsSection}>
            <View style={styles.sectionTitleRow}>
              <Tag size={15} color={activeColorConfig.text} />
              <Text style={[styles.sectionTitle, { color: activeColorConfig.text }]}>
                태그
              </Text>
            </View>
            <View style={styles.tagsList}>
              {tags.map((t) => (
                <View
                  key={t}
                  style={[
                    styles.tagBadge,
                    { backgroundColor: activeColorConfig.headerBg },
                  ]}
                >
                  <Text style={[styles.tagBadgeText, { color: activeColorConfig.text }]}>
                    #{t}
                  </Text>
                  <TouchableOpacity onPress={() => handleRemoveTag(t)}>
                    <X size={12} color={activeColorConfig.text} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
            <View style={styles.addTagRow}>
              <TextInput
                style={[
                  styles.addTagInput,
                  {
                    color: activeColorConfig.text,
                    borderColor: activeColorConfig.cardBorder,
                  },
                ]}
                placeholder="태그 입력 후 추가 (예: 아이디어, 독서)"
                placeholderTextColor={activeColorConfig.textMuted}
                value={tagInput}
                onChangeText={setTagInput}
                onSubmitEditing={handleAddTag}
              />
              <TouchableOpacity
                style={[
                  styles.addTagBtn,
                  { backgroundColor: activeColorConfig.headerBg },
                ]}
                onPress={handleAddTag}
              >
                <Text style={[styles.addTagBtnText, { color: activeColorConfig.text }]}>
                  추가
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Workspace Board Selection */}
          <View style={styles.boardSelectSection}>
            <View style={styles.sectionTitleRow}>
              <Folder size={15} color={activeColorConfig.text} />
              <Text style={[styles.sectionTitle, { color: activeColorConfig.text }]}>
                소속 워크스페이스
              </Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {boards
                .filter((b) => b.id !== 'all')
                .map((b) => {
                  const isSelected = boardId === b.id;
                  return (
                    <TouchableOpacity
                      key={b.id}
                      style={[
                        styles.boardChip,
                        isSelected && {
                          backgroundColor: activeColorConfig.text,
                          borderColor: activeColorConfig.text,
                        },
                      ]}
                      onPress={() => setBoardId(b.id)}
                    >
                      <Text
                        style={[
                          styles.boardChipText,
                          { color: activeColorConfig.text },
                          isSelected && { color: activeColorConfig.bg },
                        ]}
                      >
                        {b.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
            </ScrollView>
          </View>

          {/* Sticker Customization Toolbar (Color Palette & Deco Style) */}
          <View
            style={[
              styles.customSection,
              { borderColor: activeColorConfig.cardBorder },
            ]}
          >
            {/* 12 Pastel Colors */}
            <Text style={[styles.customSectionTitle, { color: activeColorConfig.text }]}>
              스티커 파스텔 색상 (12가지)
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.paletteScroll}
            >
              {COLOR_KEYS.map((k) => {
                const isSelected = color === k;
                const c = NOTE_COLORS[k];
                return (
                  <TouchableOpacity
                    key={k}
                    style={[
                      styles.paletteDot,
                      { backgroundColor: c.bg, borderColor: c.cardBorder },
                      isSelected && styles.paletteDotSelected,
                    ]}
                    onPress={() => setColor(k)}
                  >
                    {isSelected && <Check size={14} color={c.text} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Deco Styles */}
            <Text
              style={[
                styles.customSectionTitle,
                { color: activeColorConfig.text, marginTop: 12 },
              ]}
            >
              스티커 장식 스타일
            </Text>
            <View style={styles.decoRow}>
              {(
                [
                  { id: 'tape', name: '마스킹 테이프' },
                  { id: 'pin', name: '골드 압정 핀' },
                  { id: 'corner-fold', name: '모서리 접힘' },
                  { id: 'minimal', name: '미니멀 카드' },
                ] as const
              ).map((d) => {
                const isSelected = decoStyle === d.id;
                return (
                  <TouchableOpacity
                    key={d.id}
                    style={[
                      styles.decoChip,
                      { borderColor: activeColorConfig.cardBorder },
                      isSelected && {
                        backgroundColor: activeColorConfig.headerBg,
                        borderColor: activeColorConfig.text,
                      },
                    ]}
                    onPress={() => setDecoStyle(d.id)}
                  >
                    <Text
                      style={[
                        styles.decoChipText,
                        { color: activeColorConfig.text },
                        isSelected && { fontWeight: '700' },
                      ]}
                    >
                      {d.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </ScrollView>

        {/* Expandable Accessory Drawer (특수문자 팔레트, 서식 도구, 타이포그래피) */}
        {activeToolTab === 'symbols' && (
          <View style={[styles.accessoryDrawer, { backgroundColor: activeColorConfig.headerBg }]}>
            <View style={styles.drawerHeader}>
              <Text style={[styles.drawerTitle, { color: activeColorConfig.text }]}>
                엑셀 & 문서 특수 문자 팔레트
              </Text>
              <TouchableOpacity onPress={() => setActiveToolTab('none')}>
                <X size={16} color={activeColorConfig.text} />
              </TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.symbolsScroll}>
              {SYMBOL_CATEGORIES.map((cat, idx) => (
                <View key={idx} style={styles.symbolCategoryBlock}>
                  <Text style={[styles.symbolCatLabel, { color: activeColorConfig.textMuted }]}>
                    {cat.category}
                  </Text>
                  <View style={styles.symbolGrid}>
                    {cat.symbols.map((sym) => (
                      <TouchableOpacity
                        key={sym}
                        style={styles.symbolKey}
                        onPress={() => insertSymbol(sym)}
                      >
                        <Text style={[styles.symbolKeyText, { color: activeColorConfig.text }]}>
                          {sym}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {activeToolTab === 'formatting' && (
          <View style={[styles.accessoryDrawer, { backgroundColor: activeColorConfig.headerBg }]}>
            <View style={styles.drawerHeader}>
              <Text style={[styles.drawerTitle, { color: activeColorConfig.text }]}>
                행 구성 & 리스트 자동 서식
              </Text>
              <TouchableOpacity onPress={() => setActiveToolTab('none')}>
                <X size={16} color={activeColorConfig.text} />
              </TouchableOpacity>
            </View>
            <View style={styles.formatBtnGrid}>
              <TouchableOpacity
                style={styles.formatToolBtn}
                onPress={() => insertFormatting('• ')}
              >
                <Text style={styles.formatToolBtnIcon}>●</Text>
                <Text style={styles.formatToolBtnText}>불릿 목록 (•)</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.formatToolBtn}
                onPress={insertNextNumber}
              >
                <Text style={styles.formatToolBtnIcon}>1 2 3</Text>
                <Text style={styles.formatToolBtnText}>번호 목록</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.formatToolBtn}
                onPress={() => insertFormatting('▪ ')}
              >
                <Text style={styles.formatToolBtnIcon}>▪</Text>
                <Text style={styles.formatToolBtnText}>사각 불릿</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.formatToolBtn}
                onPress={() => insertFormatting('➜ ')}
              >
                <Text style={styles.formatToolBtnIcon}>➜</Text>
                <Text style={styles.formatToolBtnText}>화살표 목록</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.formatToolBtn}
                onPress={() => insertFormatting('[ ] ')}
              >
                <Text style={styles.formatToolBtnIcon}>☑</Text>
                <Text style={styles.formatToolBtnText}>텍스트 체크박스</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.formatToolBtn}
                onPress={() => insertFormatting('> 💡 [팁] ')}
              >
                <Text style={styles.formatToolBtnIcon}>💡</Text>
                <Text style={styles.formatToolBtnText}>콜아웃 팁 박스</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.formatToolBtn}
                onPress={() => insertFormatting('> ')}
              >
                <Text style={styles.formatToolBtnIcon}>❝</Text>
                <Text style={styles.formatToolBtnText}>인용구 블록</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.formatToolBtn}
                onPress={() => insertFormatting('⭐ 중요: ')}
              >
                <Text style={styles.formatToolBtnIcon}>⭐</Text>
                <Text style={styles.formatToolBtnText}>핵심 포인트</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.formatToolBtn}
                onPress={() => insertFormatting('────────────────\n')}
              >
                <Text style={styles.formatToolBtnIcon}>─</Text>
                <Text style={styles.formatToolBtnText}>구분선</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {activeToolTab === 'typography' && (
          <View style={[styles.accessoryDrawer, { backgroundColor: activeColorConfig.headerBg }]}>
            <View style={styles.drawerHeader}>
              <Text style={[styles.drawerTitle, { color: activeColorConfig.text }]}>
                글자 크기 & 사이 줄 간격 & 카드 너비 조절
              </Text>
              <TouchableOpacity onPress={() => setActiveToolTab('none')}>
                <X size={16} color={activeColorConfig.text} />
              </TouchableOpacity>
            </View>

            {/* Font Size Row */}
            <View style={styles.typoSettingRow}>
              <Text style={[styles.typoSettingLabel, { color: activeColorConfig.text }]}>
                글자 크기:
              </Text>
              <View style={styles.typoSegment}>
                {(['sm', 'base', 'lg', 'xl'] as const).map((s) => (
                  <TouchableOpacity
                    key={s}
                    style={[styles.typoSegmentBtn, fontSize === s && styles.typoSegmentBtnActive]}
                    onPress={() => setFontSize(s)}
                  >
                    <Text
                      style={[
                        styles.typoSegmentText,
                        fontSize === s && styles.typoSegmentTextActive,
                      ]}
                    >
                      {s === 'sm' ? '작게' : s === 'base' ? '보통' : s === 'lg' ? '크게' : '특대'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Line Spacing Row */}
            <View style={styles.typoSettingRow}>
              <Text style={[styles.typoSettingLabel, { color: activeColorConfig.text }]}>
                사이 줄 간격:
              </Text>
              <View style={styles.typoSegment}>
                {(['tight', 'normal', 'relaxed'] as const).map((l) => (
                  <TouchableOpacity
                    key={l}
                    style={[styles.typoSegmentBtn, lineHeight === l && styles.typoSegmentBtnActive]}
                    onPress={() => setLineHeight(l)}
                  >
                    <Text
                      style={[
                        styles.typoSegmentText,
                        lineHeight === l && styles.typoSegmentTextActive,
                      ]}
                    >
                      {l === 'tight' ? '좁게' : l === 'normal' ? '보통' : '넓게'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Card Width Row */}
            <View style={styles.typoSettingRow}>
              <Text style={[styles.typoSettingLabel, { color: activeColorConfig.text }]}>
                스티커 너비:
              </Text>
              <View style={styles.typoSegment}>
                {(['compact', 'standard', 'wide'] as const).map((w) => (
                  <TouchableOpacity
                    key={w}
                    style={[styles.typoSegmentBtn, cardWidth === w && styles.typoSegmentBtnActive]}
                    onPress={() => setCardWidth(w)}
                  >
                    <Text
                      style={[
                        styles.typoSegmentText,
                        cardWidth === w && styles.typoSegmentTextActive,
                      ]}
                    >
                      {w === 'compact' ? '컴팩트' : w === 'standard' ? '표준' : '와이드'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            {/* Noteshelf Paper Template Row */}
            <View style={styles.typoSettingRow}>
              <Text style={[styles.typoSettingLabel, { color: activeColorConfig.text }]}>
                페이퍼 속지:
              </Text>
              <View style={styles.typoSegment}>
                {(
                  [
                    { id: 'blank', label: '무지' },
                    { id: 'lined', label: '줄노트' },
                    { id: 'grid', label: '모눈' },
                    { id: 'dot', label: '도트' },
                    { id: 'cornell', label: '코넬' },
                    { id: 'dark', label: '다크칠판' },
                  ] as const
                ).map((p) => (
                  <TouchableOpacity
                    key={p.id}
                    style={[styles.typoSegmentBtn, paperTemplate === p.id && styles.typoSegmentBtnActive]}
                    onPress={() => setPaperTemplate(p.id)}
                  >
                    <Text
                      style={[
                        styles.typoSegmentText,
                        paperTemplate === p.id && styles.typoSegmentTextActive,
                      ]}
                    >
                      {p.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        )}

        {/* DrawNote / ColorNote 실시간 글자수 & 단어수 & 체크 카운터 바 */}
        <View
          style={[
            styles.wordCountBar,
            { backgroundColor: activeColorConfig.bg, borderTopColor: activeColorConfig.cardBorder },
          ]}
        >
          <Text style={[styles.wordCountText, { color: activeColorConfig.textMuted }]}>
            글자 <Text style={{ fontWeight: '700', color: activeColorConfig.text }}>{(title + content).length}</Text>자  •  단어 <Text style={{ fontWeight: '700', color: activeColorConfig.text }}>{content.trim() ? content.trim().split(/\s+/).length : 0}</Text>개{checklist.length > 0 ? `  •  체크 ${checklist.filter((c) => c.completed).length}/${checklist.length}` : ''}
          </Text>
        </View>

        {/* Bottom Floating Quick Action Bar */}
        <View
          style={[
            styles.bottomToolbar,
            { borderTopColor: activeColorConfig.cardBorder },
          ]}
        >
          {/* Photos Button */}
          <TouchableOpacity style={styles.bottomToolBtn} onPress={handlePickImage}>
            <ImageIcon size={16} color={activeColorConfig.text} />
            <Text style={[styles.bottomToolText, { color: activeColorConfig.text }]}>
              사진
            </Text>
          </TouchableOpacity>

          {/* Samsung/Apple Notes 손글씨 드로잉 패드 */}
          <TouchableOpacity
            style={styles.bottomToolBtn}
            onPress={() => setIsDrawingModalOpen(true)}
          >
            <Ionicons name="brush-outline" size={16} color={activeColorConfig.text} />
            <Text style={[styles.bottomToolText, { color: activeColorConfig.text }]}>
              손글씨
            </Text>
          </TouchableOpacity>

          {/* Jnotes 디지털 플래너 스티커 팩 */}
          <TouchableOpacity
            style={styles.bottomToolBtn}
            onPress={() => setIsStickerModalOpen(true)}
          >
            <Ionicons name="sparkles-outline" size={16} color={activeColorConfig.text} />
            <Text style={[styles.bottomToolText, { color: activeColorConfig.text }]}>
              스티커
            </Text>
          </TouchableOpacity>

          {/* Noteshelf & Jnotes 음성 녹음 메모 */}
          <TouchableOpacity
            style={styles.bottomToolBtn}
            onPress={() => setIsVoiceModalOpen(true)}
          >
            <Ionicons name="mic-outline" size={16} color={activeColorConfig.text} />
            <Text style={[styles.bottomToolText, { color: activeColorConfig.text }]}>
              음성
            </Text>
          </TouchableOpacity>

          {/* Typography & Paper Template Button */}
          <TouchableOpacity
            style={[
              styles.bottomToolBtn,
              activeToolTab === 'typography' && styles.bottomToolBtnActive,
            ]}
            onPress={() =>
              setActiveToolTab(activeToolTab === 'typography' ? 'none' : 'typography')
            }
          >
            <Type size={16} color={activeColorConfig.text} />
            <Text style={[styles.bottomToolText, { color: activeColorConfig.text }]}>
              속지/간격
            </Text>
          </TouchableOpacity>

          {/* Apple Notes / 3M Post-it 액자 카드 공유 */}
          <TouchableOpacity
            style={styles.bottomToolBtn}
            onPress={() => setIsShareModalOpen(true)}
          >
            <Ionicons name="share-outline" size={16} color={activeColorConfig.text} />
            <Text style={[styles.bottomToolText, { color: activeColorConfig.text }]}>
              공유
            </Text>
          </TouchableOpacity>
        </View>
          </>
        )}

        {/* Jnotes 스타일 플래너 스티커 팩 모달 */}
        <PlannerStickerModal
          visible={isStickerModalOpen}
          onClose={() => setIsStickerModalOpen(false)}
          onSelectSticker={(sticker) => setStickers((prev) => [...prev, sticker])}
          onInsertStickerText={(text) => insertFormatting(text)}
        />

        {/* Noteshelf & Jnotes 스타일 음성 녹음 모달 */}
        <VoiceNoteModal
          visible={isVoiceModalOpen}
          onClose={() => setIsVoiceModalOpen(false)}
          onSaveAudio={(audio) => setAudioNotes((prev) => [...prev, audio])}
        />

        {/* Samsung & Apple Notes 스타일 손글씨 드로잉 패드 모달 */}
        <DrawingPadModal
          visible={isDrawingModalOpen}
          onClose={() => setIsDrawingModalOpen(false)}
          onSaveDrawing={(drawingImage) => {
            setImages((prev) => [...prev, drawingImage]);
          }}
        />

        {/* Apple Notes & 3M Post-it 스타일 액자 카드 공유 모달 */}
        <ShareCardModal
          visible={isShareModalOpen}
          onClose={() => setIsShareModalOpen(false)}
          note={{
            id: selectedNoteForEdit?.id || 'temp',
            title: title || '제목 없음',
            content: content,
            color: color,
            decoStyle: decoStyle,
            images: images,
            checklist: checklist,
            tags: tags,
            boardId: boardId,
            isPinned: isPinned,
            isLocked: false,
            canvasX: selectedNoteForEdit?.canvasX || 0,
            canvasY: selectedNoteForEdit?.canvasY || 0,
            zIndex: selectedNoteForEdit?.zIndex || 1,
            rotation: selectedNoteForEdit?.rotation || 0,
            createdAt: selectedNoteForEdit?.createdAt || Date.now(),
            updatedAt: Date.now(),
            fontSize: fontSize,
            lineHeight: lineHeight,
            cardWidth: cardWidth,
          }}
        />

        {/* 기기간 동기화 & 백업 모달 */}
        <DeviceSyncModal
          visible={isDeviceSyncModalOpen}
          onClose={closeDeviceSyncModal}
        />
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 48 : 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerBtn: {
    padding: 6,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerStatusText: {
    fontSize: 13,
    fontWeight: '600',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIconBtn: {
    padding: 6,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
  },
  saveBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  scrollForm: {
    flex: 1,
  },
  scrollFormContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
  },
  titleInput: {
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 28,
    marginBottom: 10,
    padding: 0,
  },
  // Jnotes 플래너 스티커 스탬프 배지 스타일
  stickerHeaderRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  stickerStampBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  stickerStampEmoji: {
    fontSize: 13,
  },
  stickerStampLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
  // Noteshelf & Jnotes 음성 녹음 메모 컨테이너 스타일
  audioNotesContainer: {
    marginVertical: 10,
    gap: 6,
  },
  audioSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 4,
  },
  audioSectionTitle: {
    fontSize: 12,
    fontWeight: '700',
  },
  // 어울림 헤더 & 선택 바
  imageWrapHeaderContainer: {
    marginBottom: 12,
  },
  multiPhotoTabBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
    flexWrap: 'wrap',
  },
  photoTabLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginRight: 2,
  },
  photoTabPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  photoTabPillActive: {
    backgroundColor: '#0F172A',
  },
  photoTabPillText: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#475569',
  },
  photoTabPillTextActive: {
    color: '#FFFFFF',
  },
  wrapModeSwitchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  wrapSwitchBarLabel: {
    fontSize: 11.5,
    fontWeight: '700',
    flexShrink: 0,
  },
  wrapSwitchButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  wrapSwitchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  wrapSwitchBtnActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  wrapSwitchBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#334155',
  },
  wrapSwitchBtnTextActive: {
    color: '#FFFFFF',
  },
  // 좌/우 어울림 레이아웃 (Row)
  wrapRowLayout: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    minHeight: 180,
  },
  wrapImageCol: {
    flexShrink: 0,
    maxWidth: 240,
  },
  wrapTextCol: {
    flex: 1,
    minHeight: 180,
  },
  wrapInputFlex: {
    flex: 1,
    minHeight: 180,
    paddingTop: 8,
  },
  // 사진 위에 글쓰기 (Behind-Text) 레이아웃
  behindTextEditorBox: {
    position: 'relative',
    borderRadius: 12,
    overflow: 'hidden',
    minHeight: 220,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  behindTextInput: {
    minHeight: 220,
    padding: 14,
    zIndex: 2,
    textShadowColor: 'rgba(255,255,255,0.85)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  behindOpacityBar: {
    position: 'absolute',
    bottom: 6,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.92)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    zIndex: 10,
  },
  behindOpacityLabel: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#475569',
  },
  opacityPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
  },
  opacityPillActive: {
    backgroundColor: '#0F172A',
  },
  opacityPillText: {
    fontSize: 9.5,
    fontWeight: '600',
    color: '#475569',
  },
  opacityPillTextActive: {
    color: '#FFFFFF',
  },
  // 본문 중간 삽입 (Middle) 레이아웃
  middleInsertLayout: {
    gap: 8,
    minHeight: 200,
  },
  partInput: {
    minHeight: 80,
    paddingTop: 6,
    paddingBottom: 6,
  },
  middleImageWrapper: {
    alignItems: 'center',
    marginVertical: 4,
  },
  // 상/하 스택 레이아웃
  inlineStackLayout: {
    gap: 8,
    minHeight: 180,
  },
  editorBoxContainer: {
    position: 'relative',
    minHeight: 180,
  },
  // 텍스트 활성화 시 우측 상단에 플로팅되는 퀵 바
  focusToolbarFloating: {
    position: 'absolute',
    top: -12,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    zIndex: 99,
  },
  quickToolBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 14,
    paddingHorizontal: 9,
    paddingVertical: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  quickToolBtnActive: {
    backgroundColor: '#0F172A',
    borderColor: '#0F172A',
  },
  quickToolBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0F172A',
  },
  quickToolBtnTextActive: {
    color: '#FFFFFF',
  },
  contentInput: {
    minHeight: 180,
    paddingTop: 16,
    paddingBottom: 8,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
    marginBottom: 16,
  },
  statsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  statsText: {
    fontSize: 11,
    fontWeight: '500',
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  checklistQuickTools: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checklistSortBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingVertical: 3,
    paddingHorizontal: 7,
    borderRadius: 6,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  checklistSortText: {
    fontSize: 11,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  checklistSection: {
    paddingTop: 14,
    borderTopWidth: 1,
    marginBottom: 18,
  },
  checklistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
  },
  checkIconBtn: {
    padding: 2,
  },
  emptyBox: {
    width: 17,
    height: 17,
    borderRadius: 4,
    borderWidth: 1.5,
  },
  checklistText: {
    fontSize: 14,
    flex: 1,
    lineHeight: 20,
  },
  checklistCompleted: {
    textDecorationLine: 'line-through',
    opacity: 0.5,
  },
  checklistDeleteBtn: {
    padding: 4,
  },
  addChecklistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  addChecklistInput: {
    flex: 1,
    fontSize: 13.5,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  addChecklistBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagsSection: {
    marginBottom: 18,
  },
  tagsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  tagBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  tagBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  addTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  addTagInput: {
    flex: 1,
    fontSize: 13,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  addTagBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  addTagBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  boardSelectSection: {
    marginBottom: 18,
  },
  boardChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.15)',
    marginRight: 8,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  boardChipText: {
    fontSize: 12.5,
    fontWeight: '600',
  },
  customSection: {
    paddingTop: 14,
    borderTopWidth: 1,
    marginBottom: 20,
  },
  customSectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 10,
  },
  paletteScroll: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  paletteDot: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 2,
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paletteDotSelected: {
    transform: [{ scale: 1.15 }],
    borderColor: '#0F172A',
  },
  decoRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  decoChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  decoChipText: {
    fontSize: 12,
    fontWeight: '500',
  },
  // Accessory Drawer
  accessoryDrawer: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
  },
  drawerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  drawerTitle: {
    fontSize: 12,
    fontWeight: '700',
  },
  symbolsScroll: {
    flexDirection: 'row',
  },
  symbolCategoryBlock: {
    marginRight: 16,
  },
  symbolCatLabel: {
    fontSize: 10.5,
    fontWeight: '600',
    marginBottom: 4,
  },
  symbolGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: 144,
    gap: 4,
  },
  symbolKey: {
    width: 32,
    height: 32,
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  symbolKeyText: {
    fontSize: 14,
    fontWeight: '600',
  },
  formatBtnGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  formatToolBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  formatToolBtnIcon: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  formatToolBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  typoSettingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  typoSettingLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  typoSegment: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 2,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  typoSegmentBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  typoSegmentBtnActive: {
    backgroundColor: '#0F172A',
  },
  typoSegmentText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  typoSegmentTextActive: {
    color: '#FFFFFF',
  },
  wordCountBar: {
    paddingHorizontal: 16,
    paddingVertical: 5,
    borderTopWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wordCountText: {
    fontSize: 11,
    letterSpacing: 0.2,
  },
  bottomToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderTopWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.7)',
  },
  bottomToolBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  bottomToolBtnActive: {
    backgroundColor: '#0F172A',
    borderColor: '#0F172A',
  },
  bottomToolText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
