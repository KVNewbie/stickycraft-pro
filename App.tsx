import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  StatusBar as RNStatusBar,
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
import { NoteEditorModal } from './src/components/NoteEditorModal';
import { ImageViewerModal } from './src/components/ImageViewerModal';
import { BackupSettingsModal } from './src/components/BackupSettingsModal';
import { WidgetStudioModal } from './src/components/WidgetStudioModal';
import { PinLockModal } from './src/components/PinLockModal';
import { TrashArchiveModal } from './src/components/TrashArchiveModal';
import { ReminderModal } from './src/components/ReminderModal';
import { AdBannerSlot } from './src/components/AdBannerSlot';
import { FloatingSpeedDial } from './src/components/FloatingSpeedDial';

export default function App() {
  const {
    viewMode,
    isSearchOpen,
    isLoading,
    loadInitialData,
    openNewNoteEditor,
    isReminderModalOpen,
    reminderTargetNote,
    closeReminderModal,
    isTrashModalOpen,
    trashModalInitialTab,
    closeTrashModal,
  } = useNoteStore();

  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);

  useEffect(() => {
    loadInitialData();
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

          {/* Floating Speed Dial FAB (PDF, Canvas, Text, Voice) */}
          <FloatingSpeedDial />
        </View>

        {/* Bottom Google AdMob Banner Slot (Guaranteed Safe Area) */}
        <SafeAreaView edges={['bottom']} style={styles.bannerSafeArea}>
          <AdBannerSlot />
        </SafeAreaView>

        {/* Modals Layer */}
        <NoteEditorModal />
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
    bottom: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FDE047', // 포스트잇 대표 옐로우 컬러
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 28,
    shadowColor: '#CA8A04',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
    zIndex: 999,
    borderWidth: 1.5,
    borderColor: '#FEF08A',
  },
  fabText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  bannerSafeArea: {
    backgroundColor: '#FFFFFF',
  },
});
