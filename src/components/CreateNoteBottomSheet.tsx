import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Dimensions,
  Platform,
} from 'react-native';
import {
  FileText,
  CheckSquare,
  Palette,
  BookOpen,
  Mic,
  X,
  Sparkles,
  ChevronRight,
} from 'lucide-react-native';
import { useNoteStore } from '../store/useNoteStore';

export const CreateNoteBottomSheet: React.FC = () => {
  const {
    isCreateNoteSheetOpen,
    closeCreateNoteSheet,
    openColorNoteTextEditor,
    openColorNoteChecklistEditor,
    openCanvasWorkspace,
    openPdfWorkspace,
  } = useNoteStore();

  if (!isCreateNoteSheetOpen) return null;

  const handleSelect = (type: 'text' | 'checklist' | 'canvas' | 'pdf' | 'voice') => {
    closeCreateNoteSheet();
    if (type === 'text') {
      openColorNoteTextEditor(null);
    } else if (type === 'checklist') {
      openColorNoteChecklistEditor(null);
    } else if (type === 'canvas') {
      openCanvasWorkspace(null);
    } else if (type === 'pdf') {
      openPdfWorkspace(null);
    } else if (type === 'voice') {
      // 음성 메모는 텍스트 에디터에서 녹음기를 바로 띄우거나 전용 녹음 메모 생성
      openColorNoteTextEditor(null);
    }
  };

  const ITEMS = [
    {
      id: 'text',
      title: '텍스트 메모',
      badge: 'ColorNote 스타일',
      badgeColor: '#2563EB',
      desc: '깔끔한 줄노트 감성으로 빠르게 생각을 기록하세요.',
      icon: FileText,
      iconColor: '#2563EB',
      bgColor: '#EFF6FF',
    },
    {
      id: 'checklist',
      title: '체크리스트 할 일',
      badge: 'ColorNote 스타일',
      badgeColor: '#059669',
      desc: '할 일 관리, 완료 항목 취소선, 자동 하단 정렬 지원',
      icon: CheckSquare,
      iconColor: '#059669',
      bgColor: '#ECFDF5',
    },
    {
      id: 'canvas',
      title: '자유 손글씨 & 캔버스',
      badge: 'DrawNote & Notewise',
      badgeColor: '#7C3AED',
      desc: '만년필 손글씨, 스마트 도형 보정, 페이퍼 속지 템플릿',
      icon: Palette,
      iconColor: '#7C3AED',
      bgColor: '#F5F3FF',
    },
    {
      id: 'pdf',
      title: 'PDF / 학습 문서 열기',
      badge: 'Goodnotes & Notewise',
      badgeColor: '#E11D48',
      desc: 'PDF 문서를 열어 형광펜 필기, 올가미 캡처, 주석 달기',
      icon: BookOpen,
      iconColor: '#E11D48',
      bgColor: '#FFF1F2',
    },
    {
      id: 'voice',
      title: '빠른 음성 녹음 메모',
      badge: 'Notewise 스타일',
      badgeColor: '#D97706',
      desc: '실시간 파형 녹음과 타임스탬프가 연동된 음성 메모',
      icon: Mic,
      iconColor: '#D97706',
      bgColor: '#FFFBEB',
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
                      onPress={() => handleSelect(item.id as any)}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.iconBox, { backgroundColor: item.bgColor }]}>
                        <IconComp size={22} color={item.iconColor} />
                      </View>

                      <View style={styles.actionContent}>
                        <View style={styles.actionTitleRow}>
                          <Text style={styles.actionTitle}>{item.title}</Text>
                          <View
                            style={[
                              styles.badge,
                              { backgroundColor: item.badgeColor + '14' },
                            ]}
                          >
                            <Text style={[styles.badgeText, { color: item.badgeColor }]}>
                              {item.badge}
                            </Text>
                          </View>
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
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  actionDesc: {
    fontSize: 11.5,
    color: '#64748B',
  },
});
