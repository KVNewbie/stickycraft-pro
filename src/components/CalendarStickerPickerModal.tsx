import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
} from 'react-native';
import { X, Sparkles, Trash2, Check } from 'lucide-react-native';

interface CalendarStickerPickerModalProps {
  visible: boolean;
  dateStr: string; // YYYY-MM-DD
  currentSticker?: { emoji: string; label?: string };
  onSave: (sticker?: { emoji: string; label?: string }) => void;
  onClose: () => void;
}

const STICKER_CATEGORIES = [
  {
    category: '🎉 기념일 & 축하',
    emojis: ['🎂', '🎉', '❤️', '💍', '🎁', '💐', '🥳', '🎈', '🍾', '🎀'],
  },
  {
    category: '📅 일정 & 약속',
    emojis: ['☕', '🍽️', '✈️', '🚗', '💼', '🏥', '🏖️', '🚆', '🏨', '🎬'],
  },
  {
    category: '💪 할 일 & 루틴',
    emojis: ['🏃', '💊', '📚', '💰', '🛒', '🧹', '🏋️', '🐶', '🧘', '✍️'],
  },
  {
    category: '⭐ 상태 & 기분',
    emojis: ['⭐', '🔥', '🏆', '☀️', '🌧️', '🌈', '😊', '😴', '🍀', '💡'],
  },
];

export const CalendarStickerPickerModal: React.FC<CalendarStickerPickerModalProps> = ({
  visible,
  dateStr,
  currentSticker,
  onSave,
  onClose,
}) => {
  const [selectedEmoji, setSelectedEmoji] = useState(currentSticker?.emoji || '🎂');
  const [label, setLabel] = useState(currentSticker?.label || '');

  if (!visible) return null;

  const handleSave = () => {
    onSave({ emoji: selectedEmoji, label: label.trim() || undefined });
    onClose();
  };

  const handleRemove = () => {
    onSave(undefined);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity style={styles.dialogCard} activeOpacity={1} onPress={(e) => e.stopPropagation()}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleWrap}>
              <Sparkles size={18} color="#D97706" />
              <Text style={styles.title}>달력 기념일 & 아이콘 설정</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={18} color="#64748B" />
            </TouchableOpacity>
          </View>

          <Text style={styles.dateLabel}>선택 날짜: {dateStr}</Text>

          {/* Current Selection Preview & Label Input */}
          <View style={styles.previewBox}>
            <Text style={styles.previewEmoji}>{selectedEmoji}</Text>
            <View style={styles.inputWrap}>
              <Text style={styles.inputGuide}>기념일 / 일정 이름 (선택):</Text>
              <TextInput
                style={styles.labelInput}
                placeholder="예: 생일, 결혼기념일, 마감일, 월급날"
                placeholderTextColor="#94A3B8"
                value={label}
                onChangeText={setLabel}
                maxLength={20}
              />
            </View>
          </View>

          {/* Emoji Collections */}
          <ScrollView style={styles.emojiScroll} showsVerticalScrollIndicator={false}>
            {STICKER_CATEGORIES.map((cat, idx) => (
              <View key={idx} style={styles.categorySection}>
                <Text style={styles.categoryTitle}>{cat.category}</Text>
                <View style={styles.emojiGrid}>
                  {cat.emojis.map((em) => {
                    const isSelected = selectedEmoji === em;
                    return (
                      <TouchableOpacity
                        key={em}
                        style={[styles.emojiBtn, isSelected && styles.emojiBtnSelected]}
                        onPress={() => setSelectedEmoji(em)}
                      >
                        <Text style={styles.emojiChar}>{em}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ))}
          </ScrollView>

          {/* Footer Actions */}
          <View style={styles.footer}>
            {currentSticker ? (
              <TouchableOpacity style={styles.removeBtn} onPress={handleRemove}>
                <Trash2 size={16} color="#DC2626" />
                <Text style={styles.removeBtnText}>아이콘 삭제</Text>
              </TouchableOpacity>
            ) : <View />}

            <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
              <Check size={16} color="#FFFFFF" />
              <Text style={styles.saveBtnText}>아이콘 저장</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    zIndex: 1000,
  },
  dialogCard: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '85%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  headerTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2563EB',
    marginBottom: 12,
  },
  previewBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 12,
  },
  previewEmoji: {
    fontSize: 34,
    backgroundColor: '#FFFFFF',
    padding: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  inputWrap: {
    flex: 1,
  },
  inputGuide: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 4,
  },
  labelInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 13,
    color: '#0F172A',
  },
  emojiScroll: {
    maxHeight: 220,
    marginBottom: 16,
  },
  categorySection: {
    marginBottom: 14,
  },
  categoryTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 6,
  },
  emojiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  emojiBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  emojiBtnSelected: {
    backgroundColor: '#FEF3C7',
    borderColor: '#F59E0B',
    transform: [{ scale: 1.15 }],
  },
  emojiChar: {
    fontSize: 20,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  removeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#FEE2E2',
  },
  removeBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#DC2626',
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: '#0F172A',
    marginLeft: 'auto',
  },
  saveBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
