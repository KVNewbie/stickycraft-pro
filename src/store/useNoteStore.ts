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
} from '../types/note';
import { DEFAULT_BOARDS } from '../constants/colors';
import { INITIAL_MOCK_NOTES } from '../constants/mockData';
import { saveAutoBackupSnapshot } from '../utils/autoBackup';

const STORAGE_KEY_NOTES = '@stickycraft_notes_v1';
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

  // ColorNote 기능 9: 자동 백업 옵션
  autoBackupEnabled: boolean;
  setAutoBackupEnabled: (enabled: boolean) => void;

  // ColorNote 기능 10: 실시간 알람 상태 & 스누즈/해제
  activeAlarmNote: Note | null;
  setActiveAlarmNote: (note: Note | null) => void;
  checkPendingAlarms: () => void;
  snoozeAlarm: (noteId: string, minutes?: number) => void;
  dismissAlarm: (noteId: string) => void;

  // Actions
  loadInitialData: () => Promise<void>;
  addNote: (data: Omit<Note, 'id' | 'createdAt' | 'updatedAt' | 'zIndex' | 'canvasX' | 'canvasY' | 'rotation'>) => void;
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
  openCreateNoteSheet: () => void;
  closeCreateNoteSheet: () => void;
  openColorNoteTextEditor: (note?: Note | null) => void;
  openColorNoteChecklistEditor: (note?: Note | null) => void;
  openCanvasWorkspace: (note?: Note | null) => void;
  openPdfWorkspace: (note?: Note | null) => void;
  closeDedicatedEditor: () => void;

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

  openCreateNoteSheet: () => set({ isCreateNoteSheetOpen: true }),
  closeCreateNoteSheet: () => set({ isCreateNoteSheetOpen: false }),

  openColorNoteTextEditor: (note = null) =>
    set({
      activeEditorType: 'text',
      selectedNoteForDedicatedEditor: note,
      isCreateNoteSheetOpen: false,
    }),

  openColorNoteChecklistEditor: (note = null) =>
    set({
      activeEditorType: 'checklist',
      selectedNoteForDedicatedEditor: note,
      isCreateNoteSheetOpen: false,
    }),

  openCanvasWorkspace: (note = null) =>
    set({
      activeEditorType: 'canvas',
      selectedNoteForDedicatedEditor: note,
      isCreateNoteSheetOpen: false,
    }),

  openPdfWorkspace: (note = null) =>
    set({
      activeEditorType: 'pdf',
      selectedNoteForDedicatedEditor: note,
      isCreateNoteSheetOpen: false,
    }),

  closeDedicatedEditor: () =>
    set({
      activeEditorType: null,
      selectedNoteForDedicatedEditor: null,
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

      // 오디오 메모 스마트 정규화: 기존 데이터에 제목이나 페이지가 누락된 경우 자동 보정
      let hasMigratedAudios = false;
      finalNotes = finalNotes.map((n) => {
        if (!n.audioNotes || n.audioNotes.length === 0) return n;
        const isPdf =
          n.noteType === 'pdf' ||
          Boolean(n.pdfName) ||
          Boolean(n.pdfUri) ||
          Boolean(n.title?.toLowerCase().includes('.pdf'));

        const updatedAudios = n.audioNotes.map((a, idx) => {
          let updated = { ...a };
          let changed = false;
          // 1. PDF 문서인 경우 pageIndex 기본값 1 보장
          if (isPdf && updated.pageIndex === undefined) {
            updated.pageIndex = 1;
            changed = true;
          }
          // 2. 제목이 누락되었거나 generic "음성 메모"인 경우 자동 부여
          if (!updated.title || updated.title.trim() === '' || updated.title === '음성 메모') {
            if (updated.pageIndex !== undefined) {
              updated.title = `P.${updated.pageIndex} 음성 메모${n.audioNotes!.length > 1 ? ` #${idx + 1}` : ''}`;
            } else {
              updated.title = `녹음 ${idx + 1}`;
            }
            changed = true;
          }
          if (changed) hasMigratedAudios = true;
          return updated;
        });

        return { ...n, audioNotes: updatedAudios };
      });

      if (hasMigratedAudios) {
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
        isLoading: false,
      });

      // 자동 백업 실행 (데이터 보존용 스냅샷)
      if (finalAutoBackup) {
        saveAutoBackupSnapshot({
          notes: finalNotes,
          boards: finalBoards,
          widgets: finalWidgets,
          masterPin: savedPin || null,
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
    const updatedNotes = state.notes.map((note) => {
      if (note.id !== id) return note;
      const willBeLocked = !note.isLocked;
      return {
        ...note,
        isLocked: willBeLocked,
        lockPin: willBeLocked ? (pin || state.masterPin || undefined) : undefined,
        updatedAt: Date.now(),
      };
    });
    set({ notes: updatedNotes });
    AsyncStorage.setItem(STORAGE_KEY_NOTES, JSON.stringify(updatedNotes)).catch(console.error);
  },

  // ColorNote 기능 3: 휴지통(Trash) & 보관함(Archive)
  deleteNote: (id) => {
    // Soft Delete (휴지통으로 이동)
    const state = get();
    const updatedNotes = state.notes.map((note) =>
      note.id === id ? { ...note, isDeleted: true, deletedAt: Date.now(), updatedAt: Date.now() } : note
    );
    set({ notes: updatedNotes });
    AsyncStorage.setItem(STORAGE_KEY_NOTES, JSON.stringify(updatedNotes)).catch(console.error);
  },
  restoreNote: (id) => {
    const state = get();
    const updatedNotes = state.notes.map((note) =>
      note.id === id ? { ...note, isDeleted: false, deletedAt: undefined, updatedAt: Date.now() } : note
    );
    set({ notes: updatedNotes });
    AsyncStorage.setItem(STORAGE_KEY_NOTES, JSON.stringify(updatedNotes)).catch(console.error);
  },
  permanentDeleteNote: (id) => {
    const state = get();
    const updatedNotes = state.notes.filter((note) => note.id !== id);
    // 연관된 위젯도 함께 정리
    const updatedWidgets = state.widgets.filter((w) => w.noteId !== id);
    set({ notes: updatedNotes, widgets: updatedWidgets });
    AsyncStorage.setItem(STORAGE_KEY_NOTES, JSON.stringify(updatedNotes)).catch(console.error);
    AsyncStorage.setItem(STORAGE_KEY_WIDGETS, JSON.stringify(updatedWidgets)).catch(console.error);
  },
  emptyTrash: () => {
    const state = get();
    const deletedIds = new Set(state.notes.filter((n) => n.isDeleted).map((n) => n.id));
    const updatedNotes = state.notes.filter((n) => !n.isDeleted);
    const updatedWidgets = state.widgets.filter((w) => !deletedIds.has(w.noteId));
    set({ notes: updatedNotes, widgets: updatedWidgets });
    AsyncStorage.setItem(STORAGE_KEY_NOTES, JSON.stringify(updatedNotes)).catch(console.error);
    AsyncStorage.setItem(STORAGE_KEY_WIDGETS, JSON.stringify(updatedWidgets)).catch(console.error);
  },
  toggleArchiveNote: (id) => {
    const state = get();
    const updatedNotes = state.notes.map((note) =>
      note.id === id ? { ...note, isArchived: !note.isArchived, updatedAt: Date.now() } : note
    );
    set({ notes: updatedNotes });
    AsyncStorage.setItem(STORAGE_KEY_NOTES, JSON.stringify(updatedNotes)).catch(console.error);
  },

  // ColorNote 기능 4: 리마인더 & 알람
  setNoteReminder: (id, reminder) => {
    const state = get();
    const updatedNotes = state.notes.map((note) =>
      note.id === id ? { ...note, reminder, updatedAt: Date.now() } : note
    );
    set({ notes: updatedNotes });
    AsyncStorage.setItem(STORAGE_KEY_NOTES, JSON.stringify(updatedNotes)).catch(console.error);
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
    AsyncStorage.setItem(STORAGE_KEY_NOTES, JSON.stringify(updatedNotes)).catch(console.error);
  },

  uncheckAllChecklist: (noteId) => {
    const state = get();
    const updatedNotes = state.notes.map((note) => {
      if (note.id !== noteId) return note;
      const updatedChecklist = (note.checklist || []).map((item) => ({ ...item, completed: false }));
      return { ...note, checklist: updatedChecklist, updatedAt: Date.now() };
    });
    set({ notes: updatedNotes });
    AsyncStorage.setItem(STORAGE_KEY_NOTES, JSON.stringify(updatedNotes)).catch(console.error);
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
    AsyncStorage.setItem(STORAGE_KEY_NOTES, JSON.stringify(updatedNotes)).catch(console.error);
  },

  // ColorNote 기능 6: 캘린더 날짜
  setSelectedCalendarDate: (date) => {
    set({ selectedCalendarDate: date });
  },

  addNote: (data) => {
    const state = get();
    const newNoteId = 'note_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    const maxZ = state.notes.reduce((max, n) => Math.max(max, n.zIndex || 0), 0);
    const randomRotation = Number((Math.random() * 4 - 2).toFixed(1)); // -2도 ~ +2도 자연스러운 회전
    
    // 캔버스 초기 배치 좌표
    const defaultX = 20 + ((state.notes.length * 40) % 200);
    const defaultY = 40 + ((state.notes.length * 50) % 300);

    const newNote: Note = {
      ...data,
      id: newNoteId,
      boardId: data.boardId || (state.activeBoardId === 'all' ? 'ideas' : state.activeBoardId),
      canvasX: defaultX,
      canvasY: defaultY,
      zIndex: maxZ + 1,
      rotation: randomRotation,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const updatedNotes = [newNote, ...state.notes];
    set({ notes: updatedNotes });
    AsyncStorage.setItem(STORAGE_KEY_NOTES, JSON.stringify(updatedNotes)).catch(console.error);
  },

  updateNote: (id, data) => {
    const state = get();
    const updatedNotes = state.notes.map((note) =>
      note.id === id ? { ...note, ...data, updatedAt: Date.now() } : note
    );
    set({ notes: updatedNotes });
    AsyncStorage.setItem(STORAGE_KEY_NOTES, JSON.stringify(updatedNotes)).catch(console.error);
  },

  duplicateNote: (id) => {
    const state = get();
    const target = state.notes.find((n) => n.id === id);
    if (!target) return;
    const maxZ = state.notes.reduce((max, n) => Math.max(max, n.zIndex || 0), 0);
    const newNote: Note = {
      ...target,
      id: 'note_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      title: target.title ? `${target.title} (사본)` : '사본 메모',
      canvasX: (target.canvasX || 50) + 30,
      canvasY: (target.canvasY || 50) + 30,
      zIndex: maxZ + 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const updatedNotes = [newNote, ...state.notes];
    set({ notes: updatedNotes });
    AsyncStorage.setItem(STORAGE_KEY_NOTES, JSON.stringify(updatedNotes)).catch(console.error);
  },

  togglePin: (id) => {
    const state = get();
    const updatedNotes = state.notes.map((note) =>
      note.id === id ? { ...note, isPinned: !note.isPinned, updatedAt: Date.now() } : note
    );
    set({ notes: updatedNotes });
    AsyncStorage.setItem(STORAGE_KEY_NOTES, JSON.stringify(updatedNotes)).catch(console.error);
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
    AsyncStorage.setItem(STORAGE_KEY_NOTES, JSON.stringify(updatedNotes)).catch(console.error);
  },

  updateCanvasPosition: (id, x, y) => {
    const state = get();
    const updatedNotes = state.notes.map((note) =>
      note.id === id ? { ...note, canvasX: x, canvasY: y } : note
    );
    set({ notes: updatedNotes });
    AsyncStorage.setItem(STORAGE_KEY_NOTES, JSON.stringify(updatedNotes)).catch(console.error);
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
    AsyncStorage.setItem(STORAGE_KEY_NOTES, JSON.stringify(updatedNotes)).catch(console.error);
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
    return JSON.stringify({
      notes: state.notes,
      boards: state.boards,
      widgets: state.widgets,
      masterPin: state.masterPin,
      calendarStickers: state.calendarDateStickers,
      lunarDisplayMode: state.lunarDisplayMode,
      exportedAt: Date.now(),
    }, null, 2);
  },

  importAllData: (jsonData) => {
    try {
      const data = JSON.parse(jsonData);
      if (Array.isArray(data.notes)) {
        set({
          notes: data.notes,
          boards: Array.isArray(data.boards) ? data.boards : DEFAULT_BOARDS,
          widgets: Array.isArray(data.widgets) ? data.widgets : [],
          masterPin: typeof data.masterPin === 'string' ? data.masterPin : null,
          calendarDateStickers: data.calendarStickers && typeof data.calendarStickers === 'object' ? data.calendarStickers : {},
          ...(data.lunarDisplayMode ? { lunarDisplayMode: data.lunarDisplayMode } : {}),
        });
        AsyncStorage.setItem(STORAGE_KEY_NOTES, JSON.stringify(data.notes)).catch(console.error);
        if (Array.isArray(data.boards)) {
          AsyncStorage.setItem(STORAGE_KEY_BOARDS, JSON.stringify(data.boards)).catch(console.error);
        }
        if (Array.isArray(data.widgets)) {
          AsyncStorage.setItem(STORAGE_KEY_WIDGETS, JSON.stringify(data.widgets)).catch(console.error);
        }
        if (typeof data.masterPin === 'string') {
          AsyncStorage.setItem(STORAGE_KEY_PIN, data.masterPin).catch(console.error);
        }
        if (data.calendarStickers && typeof data.calendarStickers === 'object') {
          AsyncStorage.setItem(STORAGE_KEY_CALENDAR_STICKERS, JSON.stringify(data.calendarStickers)).catch(console.error);
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
    await AsyncStorage.setItem(STORAGE_KEY_NOTES, JSON.stringify(INITIAL_MOCK_NOTES));
    await AsyncStorage.setItem(STORAGE_KEY_BOARDS, JSON.stringify(DEFAULT_BOARDS));
    await AsyncStorage.setItem(STORAGE_KEY_CANVAS_STROKES, JSON.stringify([]));
  },

  // DrawNote 화이트보드 캔버스 필기 및 연결선
  addCanvasBoardStroke: (stroke: FreeHandStroke) => {
    const next = [...get().canvasBoardStrokes, stroke];
    set({ canvasBoardStrokes: next });
    AsyncStorage.setItem(STORAGE_KEY_CANVAS_STROKES, JSON.stringify(next)).catch(console.error);
  },

  setCanvasBoardStrokes: (strokes: FreeHandStroke[]) => {
    set({ canvasBoardStrokes: strokes });
    AsyncStorage.setItem(STORAGE_KEY_CANVAS_STROKES, JSON.stringify(strokes)).catch(console.error);
  },

  clearCanvasBoardStrokes: () => {
    set({ canvasBoardStrokes: [] });
    AsyncStorage.setItem(STORAGE_KEY_CANVAS_STROKES, JSON.stringify([])).catch(console.error);
  },
}));
