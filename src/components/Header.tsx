import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal,
  Alert,
} from 'react-native';
import {
  LayoutGrid,
  Move,
  Search,
  Plus,
  StickyNote,
  Briefcase,
  Coffee,
  Lightbulb,
  BookOpen,
  Folder,
  Layers,
  Settings,
  X,
  Database,
  Trash2,
  Calendar,
} from 'lucide-react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNoteStore } from '../store/useNoteStore';
import { Board, ViewMode } from '../types/note';

const BOARD_ICONS: Record<string, any> = {
  Layers,
  Briefcase,
  Coffee,
  Lightbulb,
  BookOpen,
  Folder,
};

interface HeaderProps {
  onOpenBackupModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenBackupModal }) => {
  const {
    notes,
    boards,
    activeBoardId,
    setActiveBoardId,
    viewMode,
    setViewMode,
    isSearchOpen,
    setIsSearchOpen,
    addBoard,
    deleteBoard,
    openTrashModal,
  } = useNoteStore();

  const [isAddBoardModalOpen, setIsAddBoardModalOpen] = useState(false);
  const [newBoardName, setNewBoardName] = useState('');

  const deletedCount = notes.filter((n) => n.isDeleted).length;

  const handleCreateBoard = () => {
    if (!newBoardName.trim()) return;
    addBoard(newBoardName.trim());
    setNewBoardName('');
    setIsAddBoardModalOpen(false);
  };

  return (
    <View style={styles.container}>
      {/* Top Main Bar */}
      <View style={styles.topBar}>
        {/* App Title & Branding */}
        <View style={styles.brandContainer}>
          <View style={styles.brandIconWrapper}>
            <StickyNote size={18} color="#D97706" />
          </View>
          <View>
            <Text style={styles.brandTitle}>StickyCraft</Text>
            <Text style={styles.brandBadge}>PRO</Text>
          </View>
        </View>

        {/* Action Controls */}
        <View style={styles.actionControls}>
          {/* 3-Way View Switcher (Grid / Canvas / Calendar) */}
          <View style={styles.viewSegmentGroup}>
            <TouchableOpacity
              style={[
                styles.segmentBtn,
                viewMode === 'grid' && styles.segmentBtnActive,
              ]}
              onPress={() => setViewMode('grid')}
              activeOpacity={0.8}
            >
              <LayoutGrid
                size={14}
                color={viewMode === 'grid' ? '#2563EB' : '#64748B'}
              />
              <Text
                style={[
                  styles.segmentText,
                  viewMode === 'grid' && styles.segmentTextActive,
                ]}
              >
                그리드
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.segmentBtn,
                viewMode === 'canvas' && styles.segmentBtnActive,
              ]}
              onPress={() => setViewMode('canvas')}
              activeOpacity={0.8}
            >
              <Move
                size={14}
                color={viewMode === 'canvas' ? '#D97706' : '#64748B'}
              />
              <Text
                style={[
                  styles.segmentText,
                  viewMode === 'canvas' && { color: '#B45309', fontWeight: '700' },
                ]}
              >
                캔버스
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.segmentBtn,
                viewMode === 'calendar' && styles.segmentBtnActive,
              ]}
              onPress={() => setViewMode('calendar')}
              activeOpacity={0.8}
            >
              <Calendar
                size={14}
                color={viewMode === 'calendar' ? '#10B981' : '#64748B'}
              />
              <Text
                style={[
                  styles.segmentText,
                  viewMode === 'calendar' && { color: '#059669', fontWeight: '700' },
                ]}
              >
                달력
              </Text>
            </TouchableOpacity>
          </View>

          {/* ColorNote Trash / Archive Button */}
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => openTrashModal('trash')}
          >
            <Ionicons name="trash-outline" size={18} color="#475569" />
            {deletedCount > 0 && (
              <View style={styles.trashBadge}>
                <Text style={styles.trashBadgeText}>
                  {deletedCount > 9 ? '9+' : deletedCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Search Toggle Button */}
          <TouchableOpacity
            style={[styles.iconBtn, isSearchOpen && styles.iconBtnActive]}
            onPress={() => setIsSearchOpen(!isSearchOpen)}
          >
            <Search size={18} color={isSearchOpen ? '#FFFFFF' : '#475569'} />
          </TouchableOpacity>

          {/* Settings & Backup Button */}
          <TouchableOpacity style={styles.iconBtn} onPress={onOpenBackupModal}>
            <Settings size={18} color="#475569" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Board (Workspace) Scroll Tabs */}
      <View style={styles.boardTabBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.boardTabsScroll}
        >
          {boards.map((b) => {
            const isActive = activeBoardId === b.id;
            const IconComponent = BOARD_ICONS[b.icon] || Folder;
            return (
              <TouchableOpacity
                key={b.id}
                style={[styles.boardTab, isActive && styles.boardTabActive]}
                onPress={() => setActiveBoardId(b.id)}
                activeOpacity={0.7}
              >
                <IconComponent
                  size={14}
                  color={isActive ? '#FFFFFF' : '#64748B'}
                />
                <Text
                  style={[
                    styles.boardTabText,
                    isActive && styles.boardTabTextActive,
                  ]}
                >
                  {b.name}
                </Text>
              </TouchableOpacity>
            );
          })}

          {/* Add Board Button */}
          <TouchableOpacity
            style={styles.addBoardBtn}
            onPress={() => setIsAddBoardModalOpen(true)}
          >
            <Plus size={14} color="#64748B" />
            <Text style={styles.addBoardBtnText}>새 보드</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Add Board Modal */}
      <Modal
        visible={isAddBoardModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsAddBoardModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>새 워크스페이스 보드 만들기</Text>
              <TouchableOpacity
                onPress={() => setIsAddBoardModalOpen(false)}
              >
                <X size={20} color="#64748B" />
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.boardInput}
              placeholder="보드 이름 입력 (예: 여행 계획, 아이디어 노트)"
              placeholderTextColor="#94A3B8"
              value={newBoardName}
              onChangeText={setNewBoardName}
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setIsAddBoardModalOpen(false)}
              >
                <Text style={styles.cancelBtnText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmBtn}
                onPress={handleCreateBoard}
              >
                <Text style={styles.confirmBtnText}>보드 생성</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 8,
  },
  brandContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandIconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  brandBadge: {
    fontSize: 9,
    fontWeight: '800',
    color: '#D97706',
    letterSpacing: 0.5,
  },
  actionControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  viewSegmentGroup: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 16,
    padding: 2,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  segmentBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 14,
  },
  segmentBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  segmentText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#64748B',
  },
  segmentTextActive: {
    color: '#2563EB',
    fontWeight: '700',
  },
  trashBadge: {
    position: 'absolute',
    top: -3,
    right: -3,
    backgroundColor: '#EF4444',
    borderRadius: 9,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  trashBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  iconBtnActive: {
    backgroundColor: '#0F172A',
    borderColor: '#0F172A',
  },
  boardTabBar: {
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: '#F8FAFC',
  },
  boardTabsScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
  },
  boardTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F8FAFC',
  },
  boardTabActive: {
    backgroundColor: '#0F172A',
  },
  boardTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  boardTabTextActive: {
    color: '#FFFFFF',
  },
  addBoardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#CBD5E1',
  },
  addBoardBtnText: {
    fontSize: 11.5,
    color: '#64748B',
    fontWeight: '500',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 15,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  boardInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0F172A',
    marginBottom: 18,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  cancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
  },
  cancelBtnText: {
    fontSize: 13.5,
    fontWeight: '600',
    color: '#64748B',
  },
  confirmBtn: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 8,
  },
  confirmBtnText: {
    fontSize: 13.5,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
