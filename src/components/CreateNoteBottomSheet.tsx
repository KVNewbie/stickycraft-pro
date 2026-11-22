import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Platform,
} from 'react-native';
import {
  CheckSquare,
  Palette,
  BookOpen,
  X,
  Sparkles,
  ChevronRight,
} from 'lucide-react-native';
import { useNoteStore } from '../store/useNoteStore';

export const CreateNoteBottomSheet: React.FC = () => {
  const {
    isCreateNoteSheetOpen,
    closeCreateNoteSheet,
    openColorNoteChecklistEditor,
    openCanvasWorkspace,
    openPdfWorkspace,
  } = useNoteStore();

  if (!isCreateNoteSheetOpen) return null;

  const handleSelect = (type: 'checklist' | 'canvas' | 'pdf') => {
    closeCreateNoteSheet();
    if (type === 'checklist') {
      openColorNoteChecklistEditor(null);
    } else if (type === 'canvas') {
      openCanvasWorkspace(null);
    } else if (type === 'pdf') {
      openPdfWorkspace(null);
    }
  };

  const ITEMS = [
    {
      id: 'checklist',
      title: '체크리스트 만들기',
      desc: '할 일을 적고 완료한 항목을 체크합니다.',
      icon: CheckSquare,
      iconColor: '#059669',
      bgColor: '#ECFDF5',
    },
    {
      id: 'canvas',
      title: '손글씨 노트 쓰기',
      desc: '빈 페이지나 줄·격자 속지에 필기합니다.',
      icon: Palette,
      iconColor: '#7C3AED',
      bgColor: '#F5F3FF',
    },
    {
      id: 'pdf',
      title: 'PDF에 필기하기',
      desc: '문서를 열어 필기하고 필요한 부분을 발췌합니다.',
      icon: BookOpen,
      iconColor: '#E11D48',
      bgColor: '#FFF1F2',
    },
  ] as const;

  return (
    <Modal
      visible={isCreateNoteSheetOpen}
      transparent
      animationType="fade"
      onRequestClose={closeCreateNoteSheet}
    >
      <View style={styles.overlay}>
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={closeCreateNoteSheet}
        />
        <View style={styles.sheetContainer}>
              {/* Top Handle */}
              <View style={styles.handleBar} />

              {/* Header */}
              <View style={styles.header}>
                <View style={styles.headerTitleWrap}>
                  <Sparkles size={18} color="#D97706" />
                  <Text style={styles.headerTitle}>새 메모 작성</Text>
                </View>
                <TouchableOpacity
                  style={styles.closeBtn}
                  onPress={closeCreateNoteSheet}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <X size={18} color="#64748B" />
                </TouchableOpacity>
              </View>

              {/* Items List */}
              <View style={styles.itemsList}>
                {ITEMS.map((item) => {
                  const IconComp = item.icon;
                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={styles.actionCard}
                      onPress={() => handleSelect(item.id)}
                      accessibilityRole="button"
                      activeOpacity={0.7}
                    >
                      <View style={[styles.iconBox, { backgroundColor: item.bgColor }]}>
                        <IconComp size={22} color={item.iconColor} />
                      </View>

                      <View style={styles.actionContent}>
                        <View style={styles.actionTitleRow}>
                          <Text style={styles.actionTitle}>{item.title}</Text>
                        </View>
                        <Text style={styles.actionDesc}>{item.desc}</Text>
                      </View>

                      <ChevronRight size={18} color="#CBD5E1" />
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
        </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  sheetContainer: {
    width: '100%',
    maxWidth: 540,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 20,
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E2E8F0',
    alignSelf: 'center',
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    marginBottom: 12,
  },
  headerTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemsList: {
    gap: 10,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 12,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionContent: {
    flex: 1,
  },
  actionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 3,
  },
  actionTitle: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#0F172A',
  },
  actionDesc: {
    fontSize: 11.5,
    color: '#64748B',
  },
});
