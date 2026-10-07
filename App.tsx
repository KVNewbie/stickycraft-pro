import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Plus } from 'lucide-react-native';

import { useNoteStore } from './src/store/useNoteStore';
import { Header } from './src/components/Header';
import { SearchBar } from './src/components/SearchBar';
import { GridView } from './src/components/GridView';
import { CanvasView } from './src/components/CanvasView';
import { CalendarView } from './src/components/CalendarView';
import { CreateNoteBottomSheet } from './src/components/CreateNoteBottomSheet';
import { ColorNoteTextEditor } from './src/components/ColorNoteTextEditor';
import { ColorNoteChecklistEditor } from './src/components/ColorNoteChecklistEditor';
import { DocumentWorkspaceModal } from './src/components/DocumentWorkspaceModal';
import { ImageViewerModal } from './src/components/ImageViewerModal';
import { BackupSettingsModal } from './src/components/BackupSettingsModal';
import { WidgetStudioModal } from './src/components/WidgetStudioModal';
import { PinLockModal } from './src/components/PinLockModal';
import { TrashArchiveModal } from './src/components/TrashArchiveModal';
import { ReminderModal } from './src/components/ReminderModal';
import { StatusBarPinBanner } from './src/components/StatusBarPinBanner';
import { AlarmAlertModal } from './src/components/AlarmAlertModal';

export default function App() {
  const {
    viewMode,
    isSearchOpen,
    isLoading,
    loadInitialData,
    openCreateNoteSheet,
    activeEditorType,
    selectedNoteForDedicatedEditor,
    closeDedicatedEditor,
    isReminderModalOpen,
    reminderTargetNote,
    closeReminderModal,
    isTrashModalOpen,
    trashModalInitialTab,
    closeTrashModal,
    activeAlarmNote,
    snoozeAlarm,
    dismissAlarm,
    openEditNoteEditor,
    checkPendingAlarms,
  } = useNoteStore();

  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);

  useEffect(() => {
    loadInitialData();
    // 15초마다 주기적으로 알람 및 도래한 리마인더 점검
    const timer = setInterval(() => {
      checkPendingAlarms();
    }, 15000);
    return () => clearInterval(timer);
  }, []);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#D97706" />
        <Text style={styles.loadingText}>스티커 메모를 불러오는 중...</Text>
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <StatusBar style="dark" backgroundColor="#FFFFFF" />

        {/* Top Header */}
        <Header onOpenBackupModal={() => setIsBackupModalOpen(true)} />

        {/* ColorNote 상태표시줄 고정 알림 배너 */}
        <StatusBarPinBanner />

        {/* Search & Filter Bar (Toggled) */}
        {isSearchOpen && <SearchBar />}

        {/* Main Content Area (3-Way View: Grid, 2D Free Canvas, or ColorNote Calendar) */}
        <View style={styles.contentArea}>
          {viewMode === 'grid' ? (
            <GridView />
          ) : viewMode === 'canvas' ? (
            <CanvasView />
          ) : (
            <CalendarView />
          )}

          {/* Floating Action Button (DrawNote & Notewise 스타일 + 버튼) */}
          <TouchableOpacity
            style={styles.fab}
            onPress={openCreateNoteSheet}
            activeOpacity={0.85}
          >
            <Plus size={22} color="#0F172A" strokeWidth={2.5} />
            <Text style={styles.fabText}>새 메모 작성</Text>
          </TouchableOpacity>
        </View>

        {/* 1:1 벤치마크 신규 메모 선택 바텀시트 (DrawNote & Notewise) */}
        <CreateNoteBottomSheet />

        {/* 1:1 벤치마크 전용 에디터들 */}
        {activeEditorType === 'text' && (
          <Modal visible={true} animationType="slide" onRequestClose={closeDedicatedEditor}>
            <ColorNoteTextEditor
              note={selectedNoteForDedicatedEditor}
              onClose={closeDedicatedEditor}
            />
          </Modal>
        )}

        {activeEditorType === 'checklist' && (
          <Modal visible={true} animationType="slide" onRequestClose={closeDedicatedEditor}>
            <ColorNoteChecklistEditor
              note={selectedNoteForDedicatedEditor}
              onClose={closeDedicatedEditor}
            />
          </Modal>
        )}

        {(activeEditorType === 'canvas' || activeEditorType === 'pdf') && (
          <Modal visible={true} animationType="slide" onRequestClose={closeDedicatedEditor}>
            <DocumentWorkspaceModal
              note={selectedNoteForDedicatedEditor}
              initialMode={activeEditorType}
              onClose={closeDedicatedEditor}
            />
          </Modal>
        )}

        {/* 보조 유틸리티 모달들 */}
        <ImageViewerModal />
        <BackupSettingsModal
          visible={isBackupModalOpen}
          onClose={() => setIsBackupModalOpen(false)}
        />
        <WidgetStudioModal />
        <PinLockModal />
        <TrashArchiveModal
          visible={isTrashModalOpen}
          initialTab={trashModalInitialTab}
          onClose={closeTrashModal}
        />
        <ReminderModal
          visible={isReminderModalOpen}
          note={reminderTargetNote}
          onClose={closeReminderModal}
        />
        <AlarmAlertModal
          note={activeAlarmNote}
          onDismiss={() => {
            if (activeAlarmNote) dismissAlarm(activeAlarmNote.id);
          }}
          onSnooze={(mins) => {
            if (activeAlarmNote) snoozeAlarm(activeAlarmNote.id, mins);
          }}
          onOpenNote={(note) => {
            dismissAlarm(note.id);
            openEditNoteEditor(note);
          }}
        />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#FAF9F6',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: '#78716C',
    fontWeight: '600',
  },
  contentArea: {
    flex: 1,
    position: 'relative',
    backgroundColor: '#F8FAFC',
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FDE047', // 포스트잇 대표 옐로우 컬러
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 30,
    shadowColor: '#CA8A04',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
    zIndex: 999,
    borderWidth: 1.5,
    borderColor: '#FEF08A',
  },
  fabText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
});
