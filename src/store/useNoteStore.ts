import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Note,
  Board,
  ViewMode,
  FilterOptions,
  NoteColorId,
  ChecklistItem,
  NoteImage,
  DecoStyle,
  WidgetConfig,
  WidgetSize,
  ReminderInfo,
  SortOption,
  LunarDisplayMode,
  EditorTab,
  EditorMode,
  FreeHandStroke,
  PdfSourceLink,
} from '../types/note';
import { DEFAULT_BOARDS } from '../constants/colors';
import { INITIAL_MOCK_NOTES } from '../constants/mockData';
import { saveAutoBackupSnapshot } from '../utils/autoBackup';
import { NOTES_STORAGE_KEY, persistNotes } from '../utils/notePersistence';

const STORAGE_KEY_NOTES = NOTES_STORAGE_KEY;
const STORAGE_KEY_BOARDS = '@stickycraft_boards_v1';
const STORAGE_KEY_VIEWMODE = '@stickycraft_viewmode_v1';
const STORAGE_KEY_WIDGETS = '@stickycraft_widgets_v1';
const STORAGE_KEY_PIN = '@stickycraft_master_pin_v1';
const STORAGE_KEY_CANVAS_STROKES = '@stickycraft_canvas_strokes_v1';
const STORAGE_KEY_SORT = '@stickycraft_sort_v1';
const STORAGE_KEY_LAYOUT = '@stickycraft_layout_v1';
const STORAGE_KEY_LUNAR = '@stickycraft_lunar_mode_v1';
const STORAGE_KEY_CALENDAR_STICKERS = '@stickycraft_calendar_stickers_v1';
const STORAGE_KEY_AUTOBACKUP_ENABLED = '@stickycraft_autobackup_enabled_v1';
const STORAGE_KEY_WRITING_SOUND = '@stickycraft_writing_sound_v1';

// 2D 캔버스에서 메모끼리 서로 겹치지 않고 자기 자리를 지키도록 하는 정밀 AABB 충돌 방지 좌표 탐색 엔진
const CARD_WIDTH = 280;
const CARD_GAP_X = 28;
const CARD_GAP_Y = 28;
const GRID_STEP_X = 320;
const GRID_STEP_Y = 560;

export function estimateNoteCardHeight(note?: Partial<Note> | null): number {
  if (!note) return 380;
  let h = 195; // 드래그 핸들 바 + 상단 툴바 + 제목 + 하단 여백

  const isPdf =
    note.noteType === 'pdf' ||
    !!note.pdfUri ||
    (note.pdfPages && note.pdfPages.length > 0) ||
    !!note.title?.toLowerCase?.().includes('.pdf');
  if (isPdf) {
    h += 215;
  } else if (note.noteType === 'canvas' || (note.strokes && note.strokes.length > 0) || note.freeDrawingData) {
    h += 185;
  }

  const audioCount = note.audioNotes?.length || 0;
  if (audioCount > 0) {
    h += Math.min(2, audioCount) * 108;
  }

  const imgCount = note.images?.length || 0;
  if (imgCount > 0) {
    h += 165;
  }

  const checkCount = note.checklist?.length || 0;
  if (checkCount > 0) {
    h += Math.min(220, 44 + checkCount * 30);
  }

  if (!isPdf && note.content) {
    const lineEst = Math.ceil(note.content.length / 26) + (note.content.match(/\n/g)?.length || 0);
    h += Math.min(210, Math.max(40, lineEst * 18));
  }

  if (note.tags && note.tags.length > 0) {
    h += 32;
  }

  return Math.max(240, Math.min(560, h));
}

export function findNonOverlappingPosition(
  desiredX: number,
  desiredY: number,
  existingNotes: Note[],
  excludeId?: string,
  activeBoardId: string = 'all',
  targetNote?: Partial<Note> | null
): { x: number; y: number } {
  const clampedX = Math.max(20, Math.min(2260, Math.round(desiredX)));
  const clampedY = Math.max(20, Math.min(2200, Math.round(desiredY)));

  const resolvedTarget = targetNote || (excludeId ? existingNotes.find((n) => n.id === excludeId) : null);
  const myHeight = estimateNoteCardHeight(resolvedTarget);

  const peers = existingNotes
    .filter((n) => {
      if (n.isDeleted || n.isArchived) return false;
      if (excludeId && n.id === excludeId) return false;
      if (activeBoardId !== 'all' && n.boardId !== activeBoardId) return false;
      return true;
    })
    .map((p) => ({
      x: p.canvasX ?? 40,
      y: p.canvasY ?? 40,
      w: CARD_WIDTH,
      h: estimateNoteCardHeight(p),
    }));

  const hasCollision = (cx: number, cy: number) => {
    return peers.some((p) => {
      const overlapX = cx < p.x + p.w + CARD_GAP_X && cx + CARD_WIDTH + CARD_GAP_X > p.x;
      const overlapY = cy < p.y + p.h + CARD_GAP_Y && cy + myHeight + CARD_GAP_Y > p.y;
      return overlapX && overlapY;
    });
  };

  if (!hasCollision(clampedX, clampedY)) {
    return { x: clampedX, y: clampedY };
  }

  // 1차: 충돌하는 피어의 바로 오른쪽/왼쪽/아래/위 등 밀어내기 후보 + 8방향 인접 슬롯 중 가장 가까운 빈 자리 탐색
  const candidates: Array<{ x: number; y: number }> = [];
  for (const p of peers) {
    const overlapX = clampedX < p.x + p.w + CARD_GAP_X && clampedX + CARD_WIDTH + CARD_GAP_X > p.x;
    const overlapY = clampedY < p.y + p.h + CARD_GAP_Y && clampedY + myHeight + CARD_GAP_Y > p.y;
    if (overlapX && overlapY) {
      candidates.push(
        { x: p.x + p.w + CARD_GAP_X, y: clampedY },
        { x: p.x - CARD_WIDTH - CARD_GAP_X, y: clampedY },
        { x: clampedX, y: p.y + p.h + CARD_GAP_Y },
        { x: clampedX, y: p.y - myHeight - CARD_GAP_Y }
      );
    }
  }

  const nearbyOffsets = [
    { dx: GRID_STEP_X, dy: 0 },
    { dx: -GRID_STEP_X, dy: 0 },
    { dx: 0, dy: myHeight + CARD_GAP_Y },
    { dx: 0, dy: -(myHeight + CARD_GAP_Y) },
    { dx: 0, dy: GRID_STEP_Y },
    { dx: GRID_STEP_X, dy: GRID_STEP_Y },
    { dx: -GRID_STEP_X, dy: GRID_STEP_Y },
    { dx: GRID_STEP_X, dy: -GRID_STEP_Y },
    { dx: -GRID_STEP_X, dy: -GRID_STEP_Y },
  ];
  for (const off of nearbyOffsets) {
    candidates.push({ x: clampedX + off.dx, y: clampedY + off.dy });
  }

  let bestCandidate: { x: number; y: number } | null = null;
  let bestDist = Infinity;

  for (const c of candidates) {
    const tx = Math.max(20, Math.min(2260, Math.round(c.x)));
    const ty = Math.max(20, Math.min(2200, Math.round(c.y)));
    if (!hasCollision(tx, ty)) {
      const dist = Math.hypot(tx - clampedX, ty - clampedY);
      if (dist < bestDist) {
        bestDist = dist;
        bestCandidate = { x: tx, y: ty };
      }
    }
  }

  if (bestCandidate) {
    return bestCandidate;
  }

  // 2차: 4열 정규 그리드 슬롯 순차 탐색
  for (let row = 0; row < 20; row++) {
    for (let col = 0; col < 4; col++) {
      const gx = 40 + col * GRID_STEP_X;
      const gy = 40 + row * GRID_STEP_Y;
      if (!hasCollision(gx, gy)) {
        return { x: gx, y: gy };
      }
    }
  }

  return { x: clampedX, y: clampedY };
}

interface NoteState {
  notes: Note[];
  boards: Board[];
  activeBoardId: string;
  viewMode: ViewMode;
  filters: FilterOptions;
  isSearchOpen: boolean;
  selectedNoteForEdit: Note | null;
  isEditorOpen: boolean;
  activeImageModalUri: string | null;
  isLoading: boolean;

  // ColorNote 기능 1: 홈 화면 위젯 (Widget Studio)
  widgets: WidgetConfig[];
  isWidgetModalOpen: boolean;
  widgetTargetNote: Note | null;
  openWidgetModal: (note: Note) => void;
  closeWidgetModal: () => void;
  addWidget: (noteId: string, size?: WidgetSize, opacity?: number, showDeco?: boolean) => void;
  removeWidget: (id: string) => void;
  updateWidget: (id: string, partial: Partial<WidgetConfig>) => void;

  // ColorNote 기능 2: 메모 잠금 및 마스터 PIN
  masterPin: string | null;
  setMasterPin: (pin: string) => void;
  isLockModalOpen: boolean;
  lockTargetNote: Note | null;
  lockCallback: (() => void) | null;
  openLockModal: (note: Note, onSuccess: () => void) => void;
  closeLockModal: () => void;
  toggleNoteLock: (id: string, pin?: string) => void;

  // ColorNote 기능 3: 휴지통(Trash) & 보관함(Archive) 시스템
  deleteNote: (id: string) => void; // 휴지통 이동 (Soft Delete)
  restoreNote: (id: string) => void; // 휴지통에서 복원
  permanentDeleteNote: (id: string) => void; // 영구 삭제
  emptyTrash: () => void; // 휴지통 비우기
  toggleArchiveNote: (id: string) => void; // 보관함 토글

  // ColorNote 기능 4: 리마인더 & 알람
  setNoteReminder: (id: string, reminder?: ReminderInfo) => void;
  isReminderModalOpen: boolean;
  reminderTargetNote: Note | null;
  openReminderModal: (note: Note) => void;
  closeReminderModal: () => void;

  // ColorNote 기능: 휴지통 & 보관함 모달
  isTrashModalOpen: boolean;
  trashModalInitialTab: 'trash' | 'archive';
  openTrashModal: (tab?: 'trash' | 'archive') => void;
  closeTrashModal: () => void;

  // ColorNote 기능 5: 정렬 (수정일, 생성일, 가나다, 색상, 알림)
  setSortBy: (sort: SortOption) => void;

  // ColorNote 기능 6: 캘린더 뷰 날짜 선택
  selectedCalendarDate: string;
  setSelectedCalendarDate: (date: string) => void;

  // ColorNote 기능 7: 음력 날짜 표시 설정
  lunarDisplayMode: LunarDisplayMode;
  setLunarDisplayMode: (mode: LunarDisplayMode) => void;

  // ColorNote 기능 8: 달력 기념일 / 아이콘 스티커
  calendarDateStickers: Record<string, { emoji: string; label?: string }>;
  setCalendarDateSticker: (dateStr: string, sticker?: { emoji: string; label?: string }) => void;

  // ColorNote 기능 9: 자동 백업 옵션 및 필기 사각사각 사운드 설정
  autoBackupEnabled: boolean;
  setAutoBackupEnabled: (enabled: boolean) => void;
  writingSoundEnabled: boolean;
  setWritingSoundEnabled: (enabled: boolean) => void;

  // ColorNote 기능 10: 실시간 알람 상태 & 스누즈/해제
  activeAlarmNote: Note | null;
  setActiveAlarmNote: (note: Note | null) => void;
  checkPendingAlarms: () => void;
  snoozeAlarm: (noteId: string, minutes?: number) => void;
  dismissAlarm: (noteId: string) => void;

  // Actions
  loadInitialData: () => Promise<void>;
  addNote: (data: Omit<Note, 'id' | 'createdAt' | 'updatedAt' | 'zIndex' | 'canvasX' | 'canvasY' | 'rotation'>) => string;
  updateNote: (id: string, data: Partial<Note>) => void;
  duplicateNote: (id: string) => void;
  togglePin: (id: string) => void;
  toggleChecklistItem: (noteId: string, itemId: string) => void;
  updateCanvasPosition: (id: string, x: number, y: number) => void;
  bringToFront: (id: string) => void;

  // Navigation & Board
  setActiveBoardId: (boardId: string) => void;
  setViewMode: (mode: ViewMode) => void;
  toggleViewMode: () => void;
  addBoard: (name: string, icon?: string) => void;
  deleteBoard: (id: string) => void;

  // Filters & Search
  setSearchQuery: (query: string) => void;
  setSelectedTag: (tag: string | null) => void;
  setSelectedColor: (color: NoteColorId | null) => void;
  toggleFilterPinned: () => void;
  toggleFilterImages: () => void;
  toggleFilterChecklist: () => void;
  resetFilters: () => void;
  setIsSearchOpen: (open: boolean) => void;
  setListLayout: (layout: 'grid' | 'list') => void;

  // ColorNote 체크리스트 전용 액션
  checkAllChecklist: (noteId: string) => void;
  uncheckAllChecklist: (noteId: string) => void;
  toggleAutoSortChecked: (noteId: string) => void;

  // 벤치마크 1:1 전용 에디터 및 작업 공간 상태
  activeEditorType: 'text' | 'checklist' | 'canvas' | 'pdf' | null;
  isCreateNoteSheetOpen: boolean;
  selectedNoteForDedicatedEditor: Note | null;
  autoStartVoiceRecording: boolean;
  pendingCalendarDate: string | null;
  setPendingCalendarDate: (date: string | null) => void;
  openCreateNoteSheet: () => void;
  closeCreateNoteSheet: () => void;
  openColorNoteTextEditor: (note?: Note | null, autoRecord?: boolean) => void;
  openColorNoteChecklistEditor: (note?: Note | null) => void;
  openCanvasWorkspace: (note?: Note | null) => void;
  openPdfWorkspace: (note?: Note | null) => void;
  closeDedicatedEditor: () => void;
  arrangeCanvasNotes: () => void;

  // Modals
  openNewNoteEditor: (initialMode?: EditorMode | any, initialTabType?: EditorTab['type']) => void;
  openEditNoteEditor: (note: Note) => void;
  closeEditor: () => void;
  openImageViewer: (uri: string) => void;
  closeImageViewer: () => void;

  // Noteshelf / Jnotes 스타일 다중 탭 & 모드 시스템
  editorMode: EditorMode;
  setEditorMode: (mode: EditorMode) => void;
  editorTabs: EditorTab[];
  activeEditorTabId: string;
  addEditorTab: (tab: Omit<EditorTab, 'id'>) => string;
  closeEditorTab: (id: string) => void;
  setActiveEditorTab: (id: string) => void;
  updateEditorTab: (id: string, partial: Partial<EditorTab>) => void;

  // 영역 캡처 스니펫 (PDF나 캔버스에서 캡처한 이미지 클립보드)
  capturedSnippet: string | null;
  setCapturedSnippet: (data: string | null) => void;

  // 기기간 공유 & 동기화 모달
  isDeviceSyncModalOpen: boolean;
  openDeviceSyncModal: () => void;
  closeDeviceSyncModal: () => void;

  // Backup / Reset
  exportAllData: () => string;
  importAllData: (jsonData: string) => boolean;
  resetToMockData: () => Promise<void>;

  // DrawNote 화이트보드 캔버스 필기 및 연결선
  canvasBoardStrokes: FreeHandStroke[];
  addCanvasBoardStroke: (stroke: FreeHandStroke) => void;
  setCanvasBoardStrokes: (strokes: FreeHandStroke[]) => void;
  clearCanvasBoardStrokes: () => void;

  // 3차/4차: 스티커 원문 보기(문서·페이지 고유 ID 및 발췌 영역 하이라이트) & 홈 통합 검색 쪽수 이동
  pendingPdfTarget: {
    noteId?: string;
    pageNumber?: number;
    pageId?: string;
    normRect?: { x: number; y: number; width: number; height: number };
    cropRect?: { x: number; y: number; width: number; height: number };
    excerptText?: string;
    searchQuery?: string;
  } | null;
  clearPendingPdfTarget: () => void;
  openPdfSourceLink: (link: PdfSourceLink) => boolean;
  openPdfNoteAtPage: (note: Note, pageNumber: number, searchQuery?: string) => void;
}

const initialFilters: FilterOptions = {
  searchQuery: '',
  selectedTag: null,
  selectedColor: null,
  onlyPinned: false,
  onlyHasImages: false,
  onlyChecklist: false,
  sortBy: 'updated',
  showArchived: false,
  showTrash: false,
  listLayout: 'grid',
};

export const useNoteStore = create<NoteState>((set, get) => ({
  notes: [],
  boards: DEFAULT_BOARDS,
  activeBoardId: 'all',
  viewMode: 'grid',
  filters: initialFilters,
  isSearchOpen: false,
  selectedNoteForEdit: null,
  isEditorOpen: false,
  activeImageModalUri: null,
  isLoading: true,

  widgets: [],
  isWidgetModalOpen: false,
  widgetTargetNote: null,
  masterPin: null,
  isLockModalOpen: false,
  lockTargetNote: null,
  lockCallback: null,
  selectedCalendarDate: new Date().toISOString().split('T')[0],
  isReminderModalOpen: false,
  reminderTargetNote: null,
  isTrashModalOpen: false,
  trashModalInitialTab: 'trash',

  lunarDisplayMode: 'all',
  setLunarDisplayMode: (mode) => {
    set({ lunarDisplayMode: mode });
    AsyncStorage.setItem(STORAGE_KEY_LUNAR, mode).catch(console.error);
  },
  calendarDateStickers: {},
  setCalendarDateSticker: (dateStr, sticker) => {
    const state = get();
    const updated = { ...state.calendarDateStickers };
    if (sticker) {
      updated[dateStr] = sticker;
    } else {
      delete updated[dateStr];
    }
    set({ calendarDateStickers: updated });
    AsyncStorage.setItem(STORAGE_KEY_CALENDAR_STICKERS, JSON.stringify(updated)).catch(console.error);
  },
  autoBackupEnabled: true,
  setAutoBackupEnabled: (enabled) => {
    set({ autoBackupEnabled: enabled });
    AsyncStorage.setItem(STORAGE_KEY_AUTOBACKUP_ENABLED, String(enabled)).catch(console.error);
  },
  writingSoundEnabled: true,
  setWritingSoundEnabled: (enabled) => {
    set({ writingSoundEnabled: enabled });
    AsyncStorage.setItem(STORAGE_KEY_WRITING_SOUND, String(enabled)).catch(console.error);
  },
  activeAlarmNote: null,
  setActiveAlarmNote: (note) => set({ activeAlarmNote: note }),
  checkPendingAlarms: () => {
    const state = get();
    if (state.activeAlarmNote) return;
    const now = new Date();
    const ymd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const currH = now.getHours();
    const currM = now.getMinutes();
    for (const n of state.notes) {
      if (n.isDeleted || !n.reminder || n.reminder.isCompleted) continue;
      if (n.reminder.date === ymd && n.reminder.time) {
        const [h, m] = n.reminder.time.split(':').map(Number);
        if (currH === h && currM === m) {
          set({ activeAlarmNote: n });
          break;
        }
      }
    }
  },
  snoozeAlarm: (noteId, minutes = 5) => {
    const state = get();
    const target = state.notes.find((n) => n.id === noteId);
    if (!target || !target.reminder) {
      set({ activeAlarmNote: null });
      return;
    }
    const now = new Date();
    now.setMinutes(now.getMinutes() + minutes);
    const newYMD = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const newTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    get().updateNote(noteId, {
      reminder: {
        ...target.reminder,
        date: newYMD,
        time: newTime,
        isCompleted: false,
      },
    });
    set({ activeAlarmNote: null });
  },
  dismissAlarm: (noteId) => {
    const state = get();
    const target = state.notes.find((n) => n.id === noteId);
    if (target && target.reminder) {
      get().updateNote(noteId, {
        reminder: { ...target.reminder, isCompleted: true },
      });
    }
    set({ activeAlarmNote: null });
  },

  // 벤치마크 1:1 전용 에디터 및 작업 공간 상태
  activeEditorType: null,
  isCreateNoteSheetOpen: false,
  selectedNoteForDedicatedEditor: null,
  autoStartVoiceRecording: false,
  pendingCalendarDate: null,
  pendingPdfTarget: null,

  setPendingCalendarDate: (date) => set({ pendingCalendarDate: date }),
  clearPendingPdfTarget: () => set({ pendingPdfTarget: null }),

  openPdfSourceLink: (link) => {
    const state = get();
    const activeNotes = state.notes.filter((n) => !n.isDeleted);
    // 1. 페이지 고유 ID(sourcePageId)가 소속된 문서 우선 탐색 (병합/분할/파일명 변경에도 정확히 추적)
    let targetNote =
      activeNotes.find(
        (n) =>
          Array.isArray(n.pdfPages) &&
          Boolean(link.sourcePageId) &&
          n.pdfPages.some((p) => p.id === link.sourcePageId)
      ) || null;
    // 2. 원본 노트 ID(sourceNoteId) 또는 문서 고유 UID(sourceDocUid)로 탐색
    if (!targetNote && link.sourceNoteId) {
      targetNote = activeNotes.find((n) => n.id === link.sourceNoteId) || null;
    }
    if (!targetNote && link.sourceDocUid) {
      targetNote = activeNotes.find((n) => n.pdfDocUid === link.sourceDocUid) || null;
    }
    // 3. 문서명(sourceDocName) 또는 발췌 텍스트 포함 PDF 탐색
    if (!targetNote && link.sourceDocName) {
      const cleanName = link.sourceDocName.replace(/\.pdf$/i, '').toLowerCase();
      targetNote =
        activeNotes.find(
          (n) =>
            (n.noteType === 'pdf' || Boolean(n.pdfPages?.length)) &&
            ((n.title || '').toLowerCase().includes(cleanName) ||
              (n.pdfName || '').toLowerCase().includes(cleanName))
        ) || null;
    }
    if (!targetNote) return false;

    const pages = targetNote.pdfPages || [];
    let resolvedPageNumber = link.fallbackPageNumber || 1;
    // 페이지 순서가 변경되어도 sourcePageId로 현재 페이지 위치를 정확히 찾음
    if (link.sourcePageId && pages.length > 0) {
      const pageIdx = pages.findIndex((p) => p.id === link.sourcePageId);
      if (pageIdx >= 0) {
        resolvedPageNumber = pageIdx + 1;
      } else if (link.excerptText) {
        const needle = link.excerptText.trim().slice(0, 32).toLowerCase();
        const textIdx = pages.findIndex((p) =>
          `${p.title}\n${p.subtitle || ''}\n${p.content || ''}`.toLowerCase().includes(needle)
        );
        if (textIdx >= 0) resolvedPageNumber = textIdx + 1;
      }
    }

    set({
      pendingPdfTarget: {
        noteId: targetNote.id,
        pageNumber: resolvedPageNumber,
        pageId: link.sourcePageId,
        normRect: link.normRect,
        cropRect: link.cropRect,
        excerptText: link.excerptText,
      },
      activeEditorType: 'pdf',
      selectedNoteForDedicatedEditor: targetNote,
      isCreateNoteSheetOpen: false,
    });
    return true;
  },

  openPdfNoteAtPage: (note, pageNumber, searchQuery) => {
    set({
      pendingPdfTarget: {
        noteId: note.id,
        pageNumber: Math.max(1, pageNumber || 1),
        searchQuery,
      },
      activeEditorType: 'pdf',
      selectedNoteForDedicatedEditor: note,
      isCreateNoteSheetOpen: false,
    });
  },

  openCreateNoteSheet: () => set({ isCreateNoteSheetOpen: true }),
  closeCreateNoteSheet: () => set({ isCreateNoteSheetOpen: false }),

  openColorNoteTextEditor: (note = null, autoRecord = false) =>
    set({
      activeEditorType: 'text',
      selectedNoteForDedicatedEditor: note,
      autoStartVoiceRecording: autoRecord,
      isCreateNoteSheetOpen: false,
    }),

  openColorNoteChecklistEditor: (note = null) =>
    set({
      activeEditorType: 'checklist',
      selectedNoteForDedicatedEditor: note,
      autoStartVoiceRecording: false,
      isCreateNoteSheetOpen: false,
    }),

  openCanvasWorkspace: (note = null) =>
    set({
      activeEditorType: 'canvas',
      selectedNoteForDedicatedEditor: note,
      autoStartVoiceRecording: false,
      isCreateNoteSheetOpen: false,
    }),

  openPdfWorkspace: (note = null) =>
    set({
      activeEditorType: 'pdf',
      selectedNoteForDedicatedEditor: note,
      autoStartVoiceRecording: false,
      isCreateNoteSheetOpen: false,
    }),

  closeDedicatedEditor: () =>
    set({
      activeEditorType: null,
      selectedNoteForDedicatedEditor: null,
      autoStartVoiceRecording: false,
      pendingCalendarDate: null,
      pendingPdfTarget: null,
    }),

  // 탭 및 모드 시스템
  editorMode: 'text',
  editorTabs: [{ id: 'tab_default', title: '새 메모', type: 'note' }],
  activeEditorTabId: 'tab_default',
  capturedSnippet: null,
  isDeviceSyncModalOpen: false,

  // DrawNote 화이트보드 캔버스 필기
  canvasBoardStrokes: [],

  loadInitialData: async () => {
    try {
      const [
        savedNotes,
        savedBoards,
        savedViewMode,
        savedWidgets,
        savedPin,
        savedCanvasStrokes,
        savedSort,
        savedLayout,
        savedLunar,
        savedStickers,
        savedAutoBackupEnabled,
        savedWritingSound,
      ] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEY_NOTES),
        AsyncStorage.getItem(STORAGE_KEY_BOARDS),
        AsyncStorage.getItem(STORAGE_KEY_VIEWMODE),
        AsyncStorage.getItem(STORAGE_KEY_WIDGETS),
        AsyncStorage.getItem(STORAGE_KEY_PIN),
        AsyncStorage.getItem(STORAGE_KEY_CANVAS_STROKES),
        AsyncStorage.getItem(STORAGE_KEY_SORT),
        AsyncStorage.getItem(STORAGE_KEY_LAYOUT),
        AsyncStorage.getItem(STORAGE_KEY_LUNAR),
        AsyncStorage.getItem(STORAGE_KEY_CALENDAR_STICKERS),
        AsyncStorage.getItem(STORAGE_KEY_AUTOBACKUP_ENABLED),
        AsyncStorage.getItem(STORAGE_KEY_WRITING_SOUND),
      ]);

      let finalNotes = INITIAL_MOCK_NOTES;
      if (savedNotes) {
        try {
          const parsed = JSON.parse(savedNotes);
          if (Array.isArray(parsed) && parsed.length > 0) {
            finalNotes = parsed;
          }
        } catch (e) {
          console.warn('Failed to parse saved notes, using initial mock data', e);
        }
      }

      // 오디오 메모 스마트 정규화 및 2D 캔버스 겹침 자동 해소
      let hasMigratedNotes = false;
      const placedNotes: Note[] = [];
      finalNotes = finalNotes.map((n) => {
        let noteCopy = { ...n };
        if (noteCopy.audioNotes && noteCopy.audioNotes.length > 0) {
          const isPdf =
            noteCopy.noteType === 'pdf' ||
            Boolean(noteCopy.pdfName) ||
            Boolean(noteCopy.pdfUri) ||
            Boolean(noteCopy.title?.toLowerCase().includes('.pdf'));

          const updatedAudios = noteCopy.audioNotes.map((a, idx) => {
            let updated = { ...a };
            let changed = false;
            if (isPdf && updated.pageIndex === undefined) {
              updated.pageIndex = 1;
              changed = true;
            }
            if (!updated.title || updated.title.trim() === '' || updated.title === '음성 메모') {
              if (updated.pageIndex !== undefined) {
                updated.title = `P.${updated.pageIndex} 음성 메모${noteCopy.audioNotes!.length > 1 ? ` #${idx + 1}` : ''}`;
              } else {
                updated.title = `녹음 ${idx + 1}`;
              }
              changed = true;
            }
            if (changed) hasMigratedNotes = true;
            return updated;
          });
          noteCopy.audioNotes = updatedAudios;
        }

        // 캔버스에서 다른 메모와 겹쳐 있으면 자동으로 빈 슬롯으로 정렬
        if (!noteCopy.isDeleted && !noteCopy.isArchived) {
          const pos = findNonOverlappingPosition(
            noteCopy.canvasX ?? 40,
            noteCopy.canvasY ?? 40,
            placedNotes,
            noteCopy.id,
            'all',
            noteCopy
          );
          if (pos.x !== noteCopy.canvasX || pos.y !== noteCopy.canvasY) {
            noteCopy.canvasX = pos.x;
            noteCopy.canvasY = pos.y;
            hasMigratedNotes = true;
          }
        }
        placedNotes.push(noteCopy);
        return noteCopy;
      });

      if (hasMigratedNotes) {
        AsyncStorage.setItem(STORAGE_KEY_NOTES, JSON.stringify(finalNotes)).catch(() => {});
      }

      let finalBoards = DEFAULT_BOARDS;
      if (savedBoards) {
        try {
          const parsedBoards = JSON.parse(savedBoards);
          if (Array.isArray(parsedBoards) && parsedBoards.length > 0) {
            finalBoards = parsedBoards;
          }
        } catch (e) {
          console.warn('Failed to parse saved boards', e);
        }
      }

      const finalViewMode = (savedViewMode === 'canvas' || savedViewMode === 'calendar' ? savedViewMode : 'grid') as ViewMode;

      let finalWidgets: WidgetConfig[] = [];
      if (savedWidgets) {
        try {
          finalWidgets = JSON.parse(savedWidgets);
        } catch (e) {
          console.warn('Failed to parse saved widgets', e);
        }
      }

      let finalCanvasStrokes: FreeHandStroke[] = [];
      if (savedCanvasStrokes) {
        try {
          const parsedStrokes = JSON.parse(savedCanvasStrokes);
          if (Array.isArray(parsedStrokes)) {
            finalCanvasStrokes = parsedStrokes;
          }
        } catch (e) {
          console.warn('Failed to parse saved canvas strokes', e);
        }
      }

      let parsedStickers = {};
      if (savedStickers) {
        try {
          parsedStickers = JSON.parse(savedStickers);
        } catch (e) {}
      }

      const finalSort = (savedSort as SortOption) || 'updated';
      const finalLayout = (savedLayout === 'list' ? 'list' : 'grid') as 'grid' | 'list';
      const finalLunar = (savedLunar as LunarDisplayMode) || 'all';
      const finalAutoBackup = savedAutoBackupEnabled !== 'false';
      const finalWritingSound = savedWritingSound !== 'false';

      set({
        notes: finalNotes,
        boards: finalBoards,
        viewMode: finalViewMode,
        widgets: finalWidgets,
        masterPin: savedPin || null,
        canvasBoardStrokes: finalCanvasStrokes,
        filters: {
          ...initialFilters,
          sortBy: finalSort,
          listLayout: finalLayout,
        },
        lunarDisplayMode: finalLunar,
        calendarDateStickers: parsedStickers,
        autoBackupEnabled: finalAutoBackup,
        writingSoundEnabled: finalWritingSound,
        isLoading: false,
      });

      // 자동 백업 실행 (데이터 보존용 스냅샷 - PIN 평문 제외, 보드 직접 그린 필기 포함)
      if (finalAutoBackup) {
        saveAutoBackupSnapshot({
          notes: finalNotes,
          boards: finalBoards,
          widgets: finalWidgets,
          canvasBoardStrokes: finalCanvasStrokes,
          calendarStickers: parsedStickers,
        });
      }
    } catch (error) {
      console.error('Error loading initial data:', error);
      set({ notes: INITIAL_MOCK_NOTES, isLoading: false });
    }
  },

  // ColorNote 기능 1: 홈 화면 위젯 (Widget Studio)
  openWidgetModal: (note) => set({ isWidgetModalOpen: true, widgetTargetNote: note }),
  closeWidgetModal: () => set({ isWidgetModalOpen: false, widgetTargetNote: null }),
  addWidget: (noteId, size = '2x2', opacity = 0.95, showDeco = true) => {
    const state = get();
    const newWidget: WidgetConfig = {
      id: 'widget_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      noteId,
      size,
      opacity,
      showDeco,
      createdAt: Date.now(),
    };
    const updated = [...state.widgets, newWidget];
    set({ widgets: updated });
    AsyncStorage.setItem(STORAGE_KEY_WIDGETS, JSON.stringify(updated)).catch(console.error);
  },
  removeWidget: (id) => {
    const state = get();
    const updated = state.widgets.filter((w) => w.id !== id);
    set({ widgets: updated });
    AsyncStorage.setItem(STORAGE_KEY_WIDGETS, JSON.stringify(updated)).catch(console.error);
  },
  updateWidget: (id, partial) => {
    const state = get();
    const updated = state.widgets.map((w) => (w.id === id ? { ...w, ...partial } : w));
    set({ widgets: updated });
    AsyncStorage.setItem(STORAGE_KEY_WIDGETS, JSON.stringify(updated)).catch(console.error);
  },

  // ColorNote 기능 2: 메모 잠금 및 마스터 PIN
  setMasterPin: (pin) => {
    set({ masterPin: pin });
    AsyncStorage.setItem(STORAGE_KEY_PIN, pin).catch(console.error);
  },
  openLockModal: (note, onSuccess) => {
    set({ isLockModalOpen: true, lockTargetNote: note, lockCallback: onSuccess });
  },
  closeLockModal: () => {
    set({ isLockModalOpen: false, lockTargetNote: null, lockCallback: null });
  },
  toggleNoteLock: (id, pin) => {
    const state = get();
    const target = state.notes.find((n) => n.id === id);
    if (!target) return;
    const willBeLocked = !target.isLocked;
    if (willBeLocked && !state.masterPin && !pin && !target.lockPin) {
      set({
        isLockModalOpen: true,
        lockTargetNote: target,
        lockCallback: () => {
          const latestState = get();
          const updated = latestState.notes.map((n) =>
            n.id === id
              ? {
                  ...n,
                  isLocked: true,
                  lockPin: latestState.masterPin || undefined,
                  updatedAt: Date.now(),
                }
              : n
          );
          set({ notes: updated });
          persistNotes(updated).catch(console.error);
        },
      });
      return;
    }

    const updatedNotes = state.notes.map((note) => {
      if (note.id !== id) return note;
      return {
        ...note,
        isLocked: willBeLocked,
        lockPin: willBeLocked ? (pin || state.masterPin || note.lockPin || undefined) : undefined,
        updatedAt: Date.now(),
      };
    });
    set({ notes: updatedNotes });
    persistNotes(updatedNotes).catch(console.error);
  },

  // ColorNote 기능 3: 휴지통(Trash) & 보관함(Archive)
  deleteNote: (id) => {
    // Soft Delete (휴지통으로 이동)
    const state = get();
    const updatedNotes = state.notes.map((note) =>
      note.id === id ? { ...note, isDeleted: true, deletedAt: Date.now(), updatedAt: Date.now() } : note
    );
    set({ notes: updatedNotes });
    persistNotes(updatedNotes).catch(console.error);
  },
  restoreNote: (id) => {
    const state = get();
    const updatedNotes = state.notes.map((note) =>
      note.id === id ? { ...note, isDeleted: false, deletedAt: undefined, updatedAt: Date.now() } : note
    );
    set({ notes: updatedNotes });
    persistNotes(updatedNotes).catch(console.error);
  },
  permanentDeleteNote: (id) => {
    const state = get();
    const updatedNotes = state.notes.filter((note) => note.id !== id);
    // 연관된 위젯도 함께 정리
    const updatedWidgets = state.widgets.filter((w) => w.noteId !== id);
    set({ notes: updatedNotes, widgets: updatedWidgets });
    persistNotes(updatedNotes).catch(console.error);
    AsyncStorage.setItem(STORAGE_KEY_WIDGETS, JSON.stringify(updatedWidgets)).catch(console.error);
  },
  emptyTrash: () => {
    const state = get();
    const deletedIds = new Set(state.notes.filter((n) => n.isDeleted).map((n) => n.id));
    const updatedNotes = state.notes.filter((n) => !n.isDeleted);
    const updatedWidgets = state.widgets.filter((w) => !deletedIds.has(w.noteId));
    set({ notes: updatedNotes, widgets: updatedWidgets });
    persistNotes(updatedNotes).catch(console.error);
    AsyncStorage.setItem(STORAGE_KEY_WIDGETS, JSON.stringify(updatedWidgets)).catch(console.error);
  },
  toggleArchiveNote: (id) => {
    const state = get();
    const updatedNotes = state.notes.map((note) =>
      note.id === id ? { ...note, isArchived: !note.isArchived, updatedAt: Date.now() } : note
    );
    set({ notes: updatedNotes });
    persistNotes(updatedNotes).catch(console.error);
  },

  // ColorNote 기능 4: 리마인더 & 알람
  setNoteReminder: (id, reminder) => {
    const state = get();
    const updatedNotes = state.notes.map((note) =>
      note.id === id ? { ...note, reminder, updatedAt: Date.now() } : note
    );
    set({ notes: updatedNotes });
    persistNotes(updatedNotes).catch(console.error);
  },
  openReminderModal: (note) => set({ isReminderModalOpen: true, reminderTargetNote: note }),
  closeReminderModal: () => set({ isReminderModalOpen: false, reminderTargetNote: null }),

  // ColorNote 기능: 휴지통 & 보관함 모달
  openTrashModal: (tab = 'trash') => set({ isTrashModalOpen: true, trashModalInitialTab: tab }),
  closeTrashModal: () => set({ isTrashModalOpen: false }),

  // ColorNote 기능 5: 정렬
  setSortBy: (sort) => {
    set((s) => ({ filters: { ...s.filters, sortBy: sort } }));
    AsyncStorage.setItem(STORAGE_KEY_SORT, sort).catch(console.error);
  },

  // ColorNote 기능: 그리드 / 리스트 레이아웃 토글
  setListLayout: (layout) => {
    set((s) => ({ filters: { ...s.filters, listLayout: layout } }));
    AsyncStorage.setItem(STORAGE_KEY_LAYOUT, layout).catch(console.error);
  },

  // ColorNote 기능: 체크리스트 전체 완료/해제/자동정렬
  checkAllChecklist: (noteId) => {
    const state = get();
    const updatedNotes = state.notes.map((note) => {
      if (note.id !== noteId) return note;
      const updatedChecklist = (note.checklist || []).map((item) => ({ ...item, completed: true }));
      return { ...note, checklist: updatedChecklist, updatedAt: Date.now() };
    });
    set({ notes: updatedNotes });
    persistNotes(updatedNotes).catch(console.error);
  },

  uncheckAllChecklist: (noteId) => {
    const state = get();
    const updatedNotes = state.notes.map((note) => {
      if (note.id !== noteId) return note;
      const updatedChecklist = (note.checklist || []).map((item) => ({ ...item, completed: false }));
      return { ...note, checklist: updatedChecklist, updatedAt: Date.now() };
    });
    set({ notes: updatedNotes });
    persistNotes(updatedNotes).catch(console.error);
  },

  toggleAutoSortChecked: (noteId) => {
    const state = get();
    const updatedNotes = state.notes.map((note) => {
      if (note.id !== noteId) return note;
      const willSort = !note.autoSortChecked;
      let list = [...(note.checklist || [])];
      if (willSort) {
        list.sort((a, b) => (a.completed === b.completed ? 0 : a.completed ? 1 : -1));
      }
      return { ...note, autoSortChecked: willSort, checklist: list, updatedAt: Date.now() };
    });
    set({ notes: updatedNotes });
    persistNotes(updatedNotes).catch(console.error);
  },

  // ColorNote 기능 6: 캘린더 날짜
  setSelectedCalendarDate: (date) => {
    set({ selectedCalendarDate: date });
  },

  addNote: (data) => {
    const state = get();
    const newNoteId = 'note_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    const maxZ = state.notes.reduce((max, n) => Math.max(max, n.zIndex || 0), 0);
    const randomRotation = Number((Math.random() * 1.6 - 0.8).toFixed(1));

    // 현재 선택된 보드가 있으면 우선 귀속 ('all'인 경우 전달된 boardId 또는 'ideas' 사용)
    const resolvedBoardId =
      state.activeBoardId && state.activeBoardId !== 'all'
        ? state.activeBoardId
        : data.boardId && data.boardId !== 'all'
        ? data.boardId
        : 'ideas';

    // 기존 메모들과 겹치지 않는 첫 번째 빈 슬롯 탐색
    const safePos = findNonOverlappingPosition(40, 40, state.notes, newNoteId, state.activeBoardId, data);

    // 달력 뷰에서 특정 날짜를 선택하고 작성한 경우 해당 날짜로 일정 자동 연동
    const targetCalendarDate =
      state.pendingCalendarDate || (state.viewMode === 'calendar' ? state.selectedCalendarDate : null);
    const resolvedReminder =
      data.reminder ||
      (targetCalendarDate
        ? {
            date: targetCalendarDate,
            isCompleted: false,
            repeat: 'none',
          }
        : undefined);

    const isPdfNote =
      data.noteType === 'pdf' ||
      Boolean(data.pdfPages && data.pdfPages.length > 0) ||
      Boolean(data.pdfName);

    const newNote: Note = {
      ...data,
      id: newNoteId,
      pdfDocUid: data.pdfDocUid || (isPdfNote ? `pdfdoc_${newNoteId}` : undefined),
      boardId: resolvedBoardId,
      reminder: resolvedReminder,
      canvasX: safePos.x,
      canvasY: safePos.y,
      zIndex: maxZ + 1,
      rotation: randomRotation,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const updatedNotes = [newNote, ...state.notes];
    set({ notes: updatedNotes, pendingCalendarDate: null });
    persistNotes(updatedNotes).catch(console.error);
    if (state.autoBackupEnabled) {
      saveAutoBackupSnapshot({
        notes: updatedNotes.map(({ lockPin, ...rest }) => rest),
        boards: state.boards,
        widgets: state.widgets,
        canvasBoardStrokes: state.canvasBoardStrokes,
        calendarStickers: state.calendarDateStickers,
      });
    }
    return newNoteId;
  },

  updateNote: (id, data) => {
    const state = get();
    const updatedNotes = state.notes.map((note) =>
      note.id === id ? { ...note, ...data, updatedAt: Date.now() } : note
    );
    set((prev) => ({
      notes: updatedNotes,
      selectedNoteForDedicatedEditor:
        prev.selectedNoteForDedicatedEditor && prev.selectedNoteForDedicatedEditor.id === id
          ? { ...prev.selectedNoteForDedicatedEditor, ...data, updatedAt: Date.now() }
          : prev.selectedNoteForDedicatedEditor,
    }));
    persistNotes(updatedNotes).catch(console.error);
    if (state.autoBackupEnabled) {
      saveAutoBackupSnapshot({
        notes: updatedNotes.map(({ lockPin, ...rest }) => rest),
        boards: state.boards,
        widgets: state.widgets,
        canvasBoardStrokes: state.canvasBoardStrokes,
        calendarStickers: state.calendarDateStickers,
      });
    }
  },

  duplicateNote: (id) => {
    const state = get();
    const target = state.notes.find((n) => n.id === id);
    if (!target) return;
    const maxZ = state.notes.reduce((max, n) => Math.max(max, n.zIndex || 0), 0);
    const newId = 'note_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    const safePos = findNonOverlappingPosition(
      (target.canvasX || 40) + 320,
      target.canvasY || 40,
      state.notes,
      newId,
      state.activeBoardId
    );
    const newNote: Note = {
      ...target,
      id: newId,
      title: target.title ? `${target.title} (사본)` : '사본 메모',
      canvasX: safePos.x,
      canvasY: safePos.y,
      zIndex: maxZ + 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const updatedNotes = [newNote, ...state.notes];
    set({ notes: updatedNotes });
    persistNotes(updatedNotes).catch(console.error);
  },

  togglePin: (id) => {
    const state = get();
    const updatedNotes = state.notes.map((note) =>
      note.id === id ? { ...note, isPinned: !note.isPinned, updatedAt: Date.now() } : note
    );
    set({ notes: updatedNotes });
    persistNotes(updatedNotes).catch(console.error);
  },

  toggleChecklistItem: (noteId, itemId) => {
    const state = get();
    const updatedNotes = state.notes.map((note) => {
      if (note.id !== noteId) return note;
      let updatedChecklist = note.checklist.map((item) =>
        item.id === itemId ? { ...item, completed: !item.completed } : item
      );
      if (note.autoSortChecked) {
        updatedChecklist.sort((a, b) => (a.completed === b.completed ? 0 : a.completed ? 1 : -1));
      }
      return { ...note, checklist: updatedChecklist, updatedAt: Date.now() };
    });
    set({ notes: updatedNotes });
    persistNotes(updatedNotes).catch(console.error);
  },

  updateCanvasPosition: (id, x, y) => {
    const state = get();
    // 다른 메모 위에 겹치게 놓으면 가장 가까운 빈 슬롯으로 자동 밀어내기(Snap-to-Free-Space)
    const safePos = findNonOverlappingPosition(x, y, state.notes, id, state.activeBoardId);
    const updatedNotes = state.notes.map((note) =>
      note.id === id ? { ...note, canvasX: safePos.x, canvasY: safePos.y } : note
    );
    set({ notes: updatedNotes });
    persistNotes(updatedNotes).catch(console.error);
  },

  arrangeCanvasNotes: () => {
    const state = get();
    const colBottomY = [40, 40, 40, 40];
    let idx = 0;
    const updatedNotes = state.notes.map((note) => {
      if (note.isDeleted || (note.isArchived && !state.filters.showArchived)) return note;
      if (state.activeBoardId !== 'all' && note.boardId !== state.activeBoardId) return note;

      // 가장 높이가 낮은 열에 배치하여 카드 길이가 달라도 절대 겹치지 않게 정돈 (Masonry Auto-Arrange)
      let targetCol = 0;
      for (let c = 1; c < colBottomY.length; c++) {
        if (colBottomY[c] < colBottomY[targetCol]) {
          targetCol = c;
        }
      }
      const x = 40 + targetCol * GRID_STEP_X;
      const y = colBottomY[targetCol];
      colBottomY[targetCol] = y + estimateNoteCardHeight(note) + CARD_GAP_Y;
      idx++;
      return {
        ...note,
        canvasX: x,
        canvasY: y,
        rotation: 0,
        zIndex: idx,
      };
    });
    set({ notes: updatedNotes });
    persistNotes(updatedNotes).catch(console.error);
  },

  bringToFront: (id) => {
    const state = get();
    const maxZ = state.notes.reduce((max, n) => Math.max(max, n.zIndex || 0), 0);
    const updatedNotes = state.notes.map((note) =>
      note.id === id ? { ...note, zIndex: maxZ + 1 } : note
    );
    set({ notes: updatedNotes });
  },

  setActiveBoardId: (boardId) => set({ activeBoardId: boardId }),

  setViewMode: (mode) => {
    set({ viewMode: mode });
    AsyncStorage.setItem(STORAGE_KEY_VIEWMODE, mode).catch(console.error);
  },

  toggleViewMode: () => {
    const current = get().viewMode;
    const nextMode = current === 'grid' ? 'canvas' : 'grid';
    set({ viewMode: nextMode });
    AsyncStorage.setItem(STORAGE_KEY_VIEWMODE, nextMode).catch(console.error);
  },

  addBoard: (name, icon = 'Folder') => {
    const state = get();
    const newBoard: Board = {
      id: 'board_' + Date.now(),
      name,
      icon,
    };
    const updatedBoards = [...state.boards, newBoard];
    set({ boards: updatedBoards, activeBoardId: newBoard.id });
    AsyncStorage.setItem(STORAGE_KEY_BOARDS, JSON.stringify(updatedBoards)).catch(console.error);
  },

  deleteBoard: (id) => {
    const state = get();
    if (id === 'all') return;
    const updatedBoards = state.boards.filter((b) => b.id !== id);
    const updatedNotes = state.notes.map((n) => (n.boardId === id ? { ...n, boardId: 'ideas' } : n));
    set({ boards: updatedBoards, notes: updatedNotes, activeBoardId: 'all' });
    AsyncStorage.setItem(STORAGE_KEY_BOARDS, JSON.stringify(updatedBoards)).catch(console.error);
    persistNotes(updatedNotes).catch(console.error);
  },

  setSearchQuery: (query) => set((s) => ({ filters: { ...s.filters, searchQuery: query } })),
  setSelectedTag: (tag) => set((s) => ({ filters: { ...s.filters, selectedTag: tag } })),
  setSelectedColor: (color) => set((s) => ({ filters: { ...s.filters, selectedColor: color } })),
  toggleFilterPinned: () => set((s) => ({ filters: { ...s.filters, onlyPinned: !s.filters.onlyPinned } })),
  toggleFilterImages: () => set((s) => ({ filters: { ...s.filters, onlyHasImages: !s.filters.onlyHasImages } })),
  toggleFilterChecklist: () => set((s) => ({ filters: { ...s.filters, onlyChecklist: !s.filters.onlyChecklist } })),
  resetFilters: () => set({ filters: initialFilters }),
  setIsSearchOpen: (open) => set({ isSearchOpen: open }),

  openNewNoteEditor: (initialMode = 'text', initialTabType = 'note') => {
    if (initialMode === 'free' || initialTabType === 'canvas') {
      get().openCanvasWorkspace(null);
    } else if (initialTabType === 'pdf') {
      get().openPdfWorkspace(null);
    } else {
      get().openCreateNoteSheet();
    }
  },
  openEditNoteEditor: (note) => {
    // 벤치마크 1:1 라우팅
    // 1) 체크리스트 메모
    if (note.noteType === 'checklist' || (note.checklist && note.checklist.length > 0)) {
      set({
        activeEditorType: 'checklist',
        selectedNoteForDedicatedEditor: note,
      });
      return;
    }
    // 2) PDF 문서 메모
    if (note.noteType === 'pdf' || note.pdfUri || note.title?.toLowerCase().includes('.pdf')) {
      set({
        activeEditorType: 'pdf',
        selectedNoteForDedicatedEditor: note,
      });
      return;
    }
    // 3) 손글씨 캔버스 메모
    if (note.noteType === 'canvas' || (note.strokes && note.strokes.length > 0) || note.freeDrawingData) {
      set({
        activeEditorType: 'canvas',
        selectedNoteForDedicatedEditor: note,
      });
      return;
    }
    // 4) 기본 텍스트 메모 -> ColorNote 줄노트 에디터
    set({
      activeEditorType: 'text',
      selectedNoteForDedicatedEditor: note,
    });
  },
  closeEditor: () =>
    set({
      selectedNoteForEdit: null,
      isEditorOpen: false,
      activeEditorType: null,
      selectedNoteForDedicatedEditor: null,
    }),

  // 탭 & 모드 & 캡처 액션
  setEditorMode: (mode) => set({ editorMode: mode }),
  setCapturedSnippet: (data) => set({ capturedSnippet: data }),
  addEditorTab: (tabData) => {
    const id = 'tab_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    const newTab: EditorTab = { ...tabData, id };
    set((s) => ({
      editorTabs: [...s.editorTabs, newTab],
      activeEditorTabId: id,
      editorMode: tabData.type === 'canvas' ? 'free' : s.editorMode,
    }));
    return id;
  },
  closeEditorTab: (id) => {
    const state = get();
    if (state.editorTabs.length <= 1) return;
    const filtered = state.editorTabs.filter((t) => t.id !== id);
    const nextActiveId =
      state.activeEditorTabId === id ? filtered[filtered.length - 1].id : state.activeEditorTabId;
    set({ editorTabs: filtered, activeEditorTabId: nextActiveId });
  },
  setActiveEditorTab: (id) => {
    const state = get();
    const tab = state.editorTabs.find((t) => t.id === id);
    set({
      activeEditorTabId: id,
      ...(tab?.type === 'canvas' ? { editorMode: 'free' as EditorMode } : {}),
    });
  },
  updateEditorTab: (id, partial) => {
    set((s) => ({
      editorTabs: s.editorTabs.map((t) => (t.id === id ? { ...t, ...partial } : t)),
    }));
  },

  // 기기간 공유 모달
  openDeviceSyncModal: () => set({ isDeviceSyncModalOpen: true }),
  closeDeviceSyncModal: () => set({ isDeviceSyncModalOpen: false }),

  openImageViewer: (uri) => set({ activeImageModalUri: uri }),
  closeImageViewer: () => set({ activeImageModalUri: null }),

  exportAllData: () => {
    const state = get();
    // 백업 파일에는 보드 직접 필기(canvasBoardStrokes)를 포함하고, 마스터/개별 PIN 평문은 제외
    const sanitizedNotes = state.notes.map(({ lockPin, ...rest }) => rest);
    return JSON.stringify(
      {
        notes: sanitizedNotes,
        boards: state.boards,
        widgets: state.widgets,
        canvasBoardStrokes: state.canvasBoardStrokes,
        boardStrokes: state.canvasBoardStrokes,
        calendarStickers: state.calendarDateStickers,
        lunarDisplayMode: state.lunarDisplayMode,
        exportedAt: Date.now(),
      },
      null,
      2
    );
  },

  importAllData: (jsonData) => {
    try {
      const data = JSON.parse(jsonData);
      if (Array.isArray(data.notes)) {
        const restoredBoardStrokes: FreeHandStroke[] = Array.isArray(data.canvasBoardStrokes)
          ? data.canvasBoardStrokes
          : Array.isArray(data.boardStrokes)
          ? data.boardStrokes
          : [];
        set({
          notes: data.notes,
          boards: Array.isArray(data.boards) ? data.boards : DEFAULT_BOARDS,
          widgets: Array.isArray(data.widgets) ? data.widgets : [],
          canvasBoardStrokes: restoredBoardStrokes,
          calendarDateStickers:
            data.calendarStickers && typeof data.calendarStickers === 'object'
              ? data.calendarStickers
              : {},
          ...(data.lunarDisplayMode ? { lunarDisplayMode: data.lunarDisplayMode } : {}),
        });
        persistNotes(data.notes).catch(console.error);
        if (Array.isArray(data.boards)) {
          AsyncStorage.setItem(STORAGE_KEY_BOARDS, JSON.stringify(data.boards)).catch(console.error);
        }
        if (Array.isArray(data.widgets)) {
          AsyncStorage.setItem(STORAGE_KEY_WIDGETS, JSON.stringify(data.widgets)).catch(console.error);
        }
        AsyncStorage.setItem(
          STORAGE_KEY_CANVAS_STROKES,
          JSON.stringify(restoredBoardStrokes)
        ).catch(console.error);
        if (data.calendarStickers && typeof data.calendarStickers === 'object') {
          AsyncStorage.setItem(
            STORAGE_KEY_CALENDAR_STICKERS,
            JSON.stringify(data.calendarStickers)
          ).catch(console.error);
        }
        return true;
      }
      return false;
    } catch (e) {
      console.error('Import failed', e);
      return false;
    }
  },

  resetToMockData: async () => {
    set({ notes: INITIAL_MOCK_NOTES, boards: DEFAULT_BOARDS, activeBoardId: 'all', canvasBoardStrokes: [] });
    await persistNotes(INITIAL_MOCK_NOTES);
    await AsyncStorage.setItem(STORAGE_KEY_BOARDS, JSON.stringify(DEFAULT_BOARDS));
    await AsyncStorage.setItem(STORAGE_KEY_CANVAS_STROKES, JSON.stringify([]));
  },

  // DrawNote 화이트보드 캔버스 필기 및 연결선
  addCanvasBoardStroke: (stroke: FreeHandStroke) => {
    const state = get();
    const next = [...state.canvasBoardStrokes, stroke];
    set({ canvasBoardStrokes: next });
    AsyncStorage.setItem(STORAGE_KEY_CANVAS_STROKES, JSON.stringify(next)).catch(console.error);
    if (state.autoBackupEnabled) {
      saveAutoBackupSnapshot({
        notes: state.notes.map(({ lockPin, ...rest }) => rest),
        boards: state.boards,
        widgets: state.widgets,
        canvasBoardStrokes: next,
        calendarStickers: state.calendarDateStickers,
      });
    }
  },

  setCanvasBoardStrokes: (strokes: FreeHandStroke[]) => {
    const state = get();
    set({ canvasBoardStrokes: strokes });
    AsyncStorage.setItem(STORAGE_KEY_CANVAS_STROKES, JSON.stringify(strokes)).catch(console.error);
    if (state.autoBackupEnabled) {
      saveAutoBackupSnapshot({
        notes: state.notes.map(({ lockPin, ...rest }) => rest),
        boards: state.boards,
        widgets: state.widgets,
        canvasBoardStrokes: strokes,
        calendarStickers: state.calendarDateStickers,
      });
    }
  },

  clearCanvasBoardStrokes: () => {
    set({ canvasBoardStrokes: [] });
    AsyncStorage.setItem(STORAGE_KEY_CANVAS_STROKES, JSON.stringify([])).catch(console.error);
  },
}));
