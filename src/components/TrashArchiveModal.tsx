import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNoteStore } from '../store/useNoteStore';
import { NOTE_COLORS } from '../constants/colors';

interface Props {
  visible: boolean;
  onClose: () => void;
  initialTab?: 'trash' | 'archive';
}

export const TrashArchiveModal: React.FC<Props> = ({
  visible,
  onClose,
  initialTab = 'trash',
}) => {
  const {
    notes,
    restoreNote,
    permanentDeleteNote,
    emptyTrash,
    toggleArchiveNote,
    deleteNote,
  } = useNoteStore();

  const [activeTab, setActiveTab] = useState<'trash' | 'archive'>(initialTab);

  if (!visible) return null;

  const deletedNotes = notes.filter((n) => n.isDeleted);
  const archivedNotes = notes.filter((n) => !n.isDeleted && n.isArchived);

  const handleEmptyTrash = () => {
    if (deletedNotes.length === 0) return;
    const confirmAction = () => {
      emptyTrash();
    };

    if (Platform.OS === 'web') {
      if (window.confirm('휴지통에 있는 모든 메모를 영구 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
        confirmAction();
      }
    } else {
      Alert.alert(
        '휴지통 비우기',
        '휴지통에 있는 모든 메모를 영구 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.',
        [
          { text: '취소', style: 'cancel' },
          { text: '비우기', style: 'destructive', onPress: confirmAction },
        ]
      );
    }
  };

  const handlePermanentDelete = (id: string, title?: string) => {
    const confirmAction = () => {
      permanentDeleteNote(id);
    };

    if (Platform.OS === 'web') {
      if (window.confirm(`'${title || '메모'}'를 영구 삭제하시겠습니까?`)) {
        confirmAction();
      }
    } else {
      Alert.alert('영구 삭제', `'${title || '메모'}'를 영구 삭제하시겠습니까?`, [
        { text: '취소', style: 'cancel' },
        { text: '삭제', style: 'destructive', onPress: confirmAction },
      ]);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleWrap}>
              <Ionicons
                name={activeTab === 'trash' ? 'trash-bin-outline' : 'archive-outline'}
                size={22}
                color={activeTab === 'trash' ? '#EF4444' : '#2563EB'}
              />
              <Text style={styles.headerTitle}>ColorNote 보관소</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color="#64748B" />
            </TouchableOpacity>
          </View>

          {/* Tab Bar */}
          <View style={styles.tabBar}>
            <TouchableOpacity
              style={[styles.tabItem, activeTab === 'trash' && styles.tabItemActive]}
              onPress={() => setActiveTab('trash')}
            >
              <Ionicons
                name="trash-outline"
                size={16}
                color={activeTab === 'trash' ? '#EF4444' : '#64748B'}
              />
              <Text
                style={[
                  styles.tabItemText,
                  activeTab === 'trash' && styles.tabItemTextActiveTrash,
                ]}
              >
                휴지통 ({deletedNotes.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabItem, activeTab === 'archive' && styles.tabItemActive]}
              onPress={() => setActiveTab('archive')}
            >
              <Ionicons
                name="archive-outline"
                size={16}
                color={activeTab === 'archive' ? '#2563EB' : '#64748B'}
              />
              <Text
                style={[
                  styles.tabItemText,
                  activeTab === 'archive' && styles.tabItemTextActiveArchive,
                ]}
              >
                보관함 ({archivedNotes.length})
              </Text>
            </TouchableOpacity>
          </View>

          {/* Subheader action bar for Trash */}
          {activeTab === 'trash' && deletedNotes.length > 0 && (
            <View style={styles.actionBar}>
              <Text style={styles.actionGuide}>
                삭제된 메모는 언제든지 복구하거나 영구 삭제할 수 있습니다.
              </Text>
              <TouchableOpacity
                style={styles.emptyTrashBtn}
                onPress={handleEmptyTrash}
              >
                <Ionicons name="trash" size={14} color="#EF4444" />
                <Text style={styles.emptyTrashText}>휴지통 비우기</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Content Scroll */}
          <ScrollView style={styles.listScroll} contentContainerStyle={styles.listContent}>
            {activeTab === 'trash' ? (
              deletedNotes.length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons name="trash-outline" size={48} color="#CBD5E1" />
                  <Text style={styles.emptyTitle}>휴지통이 비어 있습니다.</Text>
                  <Text style={styles.emptyDesc}>삭제된 메모가 이곳에 안전하게 보관됩니다.</Text>
                </View>
              ) : (
                deletedNotes.map((note) => {
                  const color = NOTE_COLORS[note.color] || NOTE_COLORS.yellow;
                  return (
                    <View
                      key={note.id}
                      style={[
                        styles.noteCard,
                        { backgroundColor: color.bg, borderColor: color.cardBorder },
                      ]}
                    >
                      <View style={styles.noteTop}>
                        <View style={[styles.colorStrip, { backgroundColor: color.shadow }]} />
                        <Text style={[styles.noteTitle, { color: color.text }]} numberOfLines={1}>
                          {note.title || '제목 없는 메모'}
                        </Text>
                      </View>

                      {note.content ? (
                        <Text style={[styles.noteBody, { color: color.text }]} numberOfLines={2}>
                          {note.content}
                        </Text>
                      ) : null}

                      <View style={styles.cardActions}>
                        <TouchableOpacity
                          style={styles.restoreBtn}
                          onPress={() => restoreNote(note.id)}
                        >
                          <Ionicons name="refresh-outline" size={16} color="#2563EB" />
                          <Text style={styles.restoreBtnText}>복원하기</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.deleteForeverBtn}
                          onPress={() => handlePermanentDelete(note.id, note.title)}
                        >
                          <Ionicons name="trash-outline" size={16} color="#EF4444" />
                          <Text style={styles.deleteForeverBtnText}>영구 삭제</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })
              )
            ) : (
              /* Archive Tab */
              archivedNotes.length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons name="archive-outline" size={48} color="#CBD5E1" />
                  <Text style={styles.emptyTitle}>보관된 메모가 없습니다.</Text>
                  <Text style={styles.emptyDesc}>
                    자주 보지 않는 메모를 보관함에 보관하여 메인 화면을 깔끔하게 유지해보세요.
                  </Text>
                </View>
              ) : (
                archivedNotes.map((note) => {
                  const color = NOTE_COLORS[note.color] || NOTE_COLORS.yellow;
                  return (
                    <View
                      key={note.id}
                      style={[
                        styles.noteCard,
                        { backgroundColor: color.bg, borderColor: color.cardBorder },
                      ]}
                    >
                      <View style={styles.noteTop}>
                        <View style={[styles.colorStrip, { backgroundColor: color.shadow }]} />
                        <Text style={[styles.noteTitle, { color: color.text }]} numberOfLines={1}>
                          {note.title || '제목 없는 메모'}
                        </Text>
                      </View>

                      {note.content ? (
                        <Text style={[styles.noteBody, { color: color.text }]} numberOfLines={2}>
                          {note.content}
                        </Text>
                      ) : null}

                      <View style={styles.cardActions}>
                        <TouchableOpacity
                          style={styles.restoreBtn}
                          onPress={() => toggleArchiveNote(note.id)}
                        >
                          <Ionicons name="arrow-undo-outline" size={16} color="#2563EB" />
                          <Text style={styles.restoreBtnText}>보관 해제</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.deleteForeverBtn}
                          onPress={() => deleteNote(note.id)}
                        >
                          <Ionicons name="trash-outline" size={16} color="#EF4444" />
                          <Text style={styles.deleteForeverBtnText}>휴지통으로</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })
              )
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  container: {
    width: '100%',
    maxWidth: 500,
    maxHeight: '85%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 15,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 12,
  },
  headerTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  closeBtn: {
    padding: 6,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingHorizontal: 20,
    gap: 16,
  },
  tabItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    gap: 6,
  },
  tabItemActive: {
    borderBottomColor: '#0F172A',
  },
  tabItemText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  tabItemTextActiveTrash: {
    color: '#EF4444',
    fontWeight: '700',
  },
  tabItemTextActiveArchive: {
    color: '#2563EB',
    fontWeight: '700',
  },
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#FEF2F2',
    borderBottomWidth: 1,
    borderBottomColor: '#FEE2E2',
  },
  actionGuide: {
    fontSize: 11,
    color: '#991B1B',
    flex: 1,
  },
  emptyTrashBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  emptyTrashText: {
    fontSize: 11,
    color: '#EF4444',
    fontWeight: '700',
  },
  listScroll: {
    flex: 1,
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#475569',
    marginTop: 12,
  },
  emptyDesc: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 4,
    textAlign: 'center',
    maxWidth: 260,
  },
  noteCard: {
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
  },
  noteTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  colorStrip: {
    width: 4,
    height: 16,
    borderRadius: 2,
    marginRight: 8,
  },
  noteTitle: {
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
  },
  noteBody: {
    fontSize: 12,
    lineHeight: 18,
    opacity: 0.8,
    marginBottom: 10,
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    paddingTop: 8,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(0,0,0,0.08)',
  },
  restoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  restoreBtnText: {
    fontSize: 12,
    color: '#2563EB',
    fontWeight: '700',
  },
  deleteForeverBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  deleteForeverBtnText: {
    fontSize: 12,
    color: '#EF4444',
    fontWeight: '700',
  },
});
