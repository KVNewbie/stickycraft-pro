import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { Check, X, Palette } from 'lucide-react-native';
import { NoteColorId } from '../types/note';
import { NOTE_COLORS, COLOR_KEYS } from '../constants/colors';

interface ColorNoteColorMapModalProps {
  visible: boolean;
  currentColor: NoteColorId;
  onSelectColor: (color: NoteColorId) => void;
  onClose: () => void;
}

export const ColorNoteColorMapModal: React.FC<ColorNoteColorMapModalProps> = ({
  visible,
  currentColor,
  onSelectColor,
  onClose,
}) => {
  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <TouchableOpacity
          style={styles.dialogCard}
          activeOpacity={1}
          onPress={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleWrap}>
              <View
                style={[
                  styles.currentColorPreview,
                  { backgroundColor: NOTE_COLORS[currentColor]?.cardBorder || '#CA8A04' },
                ]}
              />
              <Text style={styles.title}>ColorNote 컬러 맵 선택</Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <X size={18} color="#64748B" />
            </TouchableOpacity>
          </View>

          <Text style={styles.subtitle}>
            메모의 대표 색상을 선택하세요. 상단바 및 본문 배경에 즉시 적용됩니다.
          </Text>

          {/* Color Grid (Color Map) */}
          <View style={styles.colorGrid}>
            {COLOR_KEYS.map((k) => {
              const cfg = NOTE_COLORS[k];
              const isSelected = currentColor === k;
              return (
                <TouchableOpacity
                  key={k}
                  style={[
                    styles.colorTile,
                    { backgroundColor: cfg.bg, borderColor: cfg.cardBorder },
                    isSelected && styles.colorTileSelected,
                  ]}
                  onPress={() => {
                    onSelectColor(k);
                    onClose();
                  }}
                  activeOpacity={0.8}
                >
                  <View
                    style={[
                      styles.colorCircle,
                      { backgroundColor: cfg.cardBorder },
                    ]}
                  >
                    {isSelected && <Check size={14} color="#FFFFFF" strokeWidth={3} />}
                  </View>
                  <Text
                    style={[
                      styles.colorLabel,
                      { color: cfg.text },
                      isSelected && styles.colorLabelSelected,
                    ]}
                    numberOfLines={1}
                  >
                    {cfg.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
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
    maxWidth: 380,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
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
    marginBottom: 6,
  },
  headerTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  currentColorPreview: {
    width: 14,
    height: 14,
    borderRadius: 4,
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
  subtitle: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 16,
    lineHeight: 17,
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'space-between',
  },
  colorTile: {
    width: '30%',
    minWidth: 90,
    flexGrow: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  colorTileSelected: {
    borderColor: '#0F172A',
    transform: [{ scale: 1.03 }],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  colorCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  colorLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  colorLabelSelected: {
    fontWeight: '800',
  },
});
