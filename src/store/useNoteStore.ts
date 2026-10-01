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
  EditorTab,
  EditorMode,
} from '../types/note';
import { DEFAULT_BOARDS } from '../constants/colors';
import { INITIAL_MOCK_NOTES } from '../constants/mockData';

const STORAGE_KEY_NOTES = '@stickycraft_notes_v1';
const STORAGE_KEY_BOARDS = '@stickycraft_boards_v1';
const STORAGE_KEY_VIEWMODE = '@stickycraft_viewmode_v1';
const STORAGE_KEY_WIDGETS = '@stickycraft_widgets_v1';
const STORAGE_KEY_PIN = '@stickycraft_master_pin_v1';

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

  // 탭 및 모드 시스템
  editorMode: 'text',
  editorTabs: [{ id: 'tab_default', title: '새 메모', type: 'note' }],
  activeEditorTabId: 'tab_default',
  capturedSnippet: null,
  isDeviceSyncModalOpen: false,

  loadInitialData: async () => {
    try {
      const [savedNotes, savedBoards, savedViewMode, savedWidgets, savedPin] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEY_NOTES),
        AsyncStorage.getItem(STORAGE_KEY_BOARDS),
        AsyncStorage.getItem(STORAGE_KEY_VIEWMODE),
        AsyncStorage.getItem(STORAGE_KEY_WIDGETS),
        AsyncStorage.getItem(STORAGE_KEY_PIN),
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

      set({
        notes: finalNotes,
        boards: finalBoards,
        viewMode: finalViewMode,
        widgets: finalWidgets,
        masterPin: savedPin || null,
        isLoading: false,
      });
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
      const updatedChecklist = note.checklist.map((item) =>
        item.id === itemId ? { ...item, completed: !item.completed } : item
      );
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
    const safeMode: EditorMode = initialMode === 'free' ? 'free' : 'text';
    const safeTabType: EditorTab['type'] =
      initialTabType === 'pdf' ? 'pdf' : initialTabType === 'canvas' ? 'canvas' : 'note';
    const tabId = 'tab_' + safeTabType + '_' + Date.now();
    const defaultTab: EditorTab = {
      id: tabId,
      title: safeTabType === 'pdf' ? 'PDF 문서' : safeTabType === 'canvas' ? '자유 필기장' : '새 메모',
      type: safeTabType,
    };
    set({
      selectedNoteForEdit: null,
      isEditorOpen: true,
      editorTabs: [defaultTab],
      activeEditorTabId: tabId,
      editorMode: safeMode,
    });
  },
  openEditNoteEditor: (note) => {
    const defaultTab: EditorTab = {
      id: 'tab_note_' + note.id,
      title: note.title || '메모',
      type: 'note',
      noteId: note.id,
      freeDrawingData: note.freeDrawingData,
    };
    set({
      selectedNoteForEdit: note,
      isEditorOpen: true,
      editorTabs: [defaultTab],
      activeEditorTabId: defaultTab.id,
      editorMode: note.editorMode || (note.freeDrawingData ? 'free' : 'text'),
    });
  },
  closeEditor: () => set({ selectedNoteForEdit: null, isEditorOpen: false }),

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
        return true;
      }
      return false;
    } catch (e) {
      console.error('Import failed', e);
      return false;
    }
  },

  resetToMockData: async () => {
    set({ notes: INITIAL_MOCK_NOTES, boards: DEFAULT_BOARDS, activeBoardId: 'all' });
    await AsyncStorage.setItem(STORAGE_KEY_NOTES, JSON.stringify(INITIAL_MOCK_NOTES));
    await AsyncStorage.setItem(STORAGE_KEY_BOARDS, JSON.stringify(DEFAULT_BOARDS));
  },
}));
