import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Platform,
} from 'react-native';
import { Palette, Check, X, Pipette, Sparkles } from 'lucide-react-native';

interface ColorPaletteModalProps {
  visible: boolean;
  onClose: () => void;
  currentColor: string;
  onSelectColor: (color: string) => void;
  colorSlots: string[];
  activeSlotIndex: number;
  onUpdateSlotColor: (index: number, color: string) => void;
}

// Goodnotes, Jnotes, Noteshelf 스타일 테마별 색상 컬렉션
const PALETTE_COLLECTIONS = [
  {
    name: '🎓 Goodnotes 스탠다드',
    colors: [
      '#0f172a', // 딥 블랙
      '#334155', // 슬레이트 차콜
      '#64748b', // 쿨 그레이
      '#1e3a8a', // 잉크 네이비
      '#2563eb', // 코발트 블루
      '#0284c7', // 스카이 블루
      '#0d9488', // 딥 틸
      '#059669', // 에메랄드
      '#16a34a', // 포레스트 그린
      '#65a30d', // 라임 올리브
      '#ca8a04', // 앰버 골드
      '#ea580c', // 웜 오렌지
      '#dc2626', // 크림슨 레드
      '#9333ea', // 바이올렛
    ],
  },
  {
    name: '🌸 Jnotes 파스텔 감성',
    colors: [
      '#fda4af', // 베이비 로즈
      '#f472b6', // 파스텔 핑크
      '#f9a8d4', // 솜사탕 핑크
      '#c084fc', // 라벤더 퍼플
      '#a78bfa', // 소프트 바이올렛
      '#818cf8', // 페리윙클
      '#60a5fa', // 파스텔 스카이
      '#7dd3fc', // 아이스 블루
      '#6ee7b7', // 민트 그린
      '#a7f3d0', // 소프트 세이지
      '#fde047', // 버터 옐로우
      '#fed7aa', // 피치 코랄
      '#fbcfe8', // 블러시
      '#e2e8f0', // 포그 그레이
    ],
  },
  {
    name: '⚡ 형광 & 네온 하이라이터',
    colors: [
      '#fef08a', // 네온 레몬
      '#fde047', // 형광 옐로우
      '#bbf7d0', // 형광 민트
      '#86efac', // 네온 그린
      '#fbcfe8', // 형광 핑크
      '#f472b6', // 네온 마젠타
      '#fed7aa', // 형광 오렌지
      '#bae6fd', // 네온 아쿠아
      '#ddd6fe', // 형광 라일락
      '#fef9c3', // 크림 하이라이터
    ],
  },
  {
    name: '🍂 빈티지 레트로 & 어스톤',
    colors: [
      '#78350f', // 웜 브라운
      '#9a3412', // 테라코타
      '#b45309', // 머스타드
      '#3f6212', // 딥 올리브
      '#14532d', // 딥 헌터 그린
      '#164e63', // 앤틱 틸
      '#1e293b', // 앤틱 네이비
      '#4c1d95', // 빈티지 퍼플
      '#701a75', // 플럼 와인
      '#831843', // 딥 버건디
    ],
  },
];

export const ColorPaletteModal: React.FC<ColorPaletteModalProps> = ({
  visible,
  onClose,
  currentColor,
  onSelectColor,
  colorSlots,
  activeSlotIndex,
  onUpdateSlotColor,
}) => {
  const [customHex, setCustomHex] = useState(currentColor);

  const handleApplyColor = (color: string) => {
    onSelectColor(color);
    onUpdateSlotColor(activeSlotIndex, color);
    setCustomHex(color);
  };

  const handleCustomHexSubmit = () => {
    let hex = customHex.trim();
    if (!hex.startsWith('#')) hex = '#' + hex;
    if (/^#[0-9A-Fa-f]{6}$/.test(hex)) {
      handleApplyColor(hex);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity style={styles.card} activeOpacity={1} onPress={(e) => e.stopPropagation()}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <Palette size={18} color="#2563eb" />
              <Text style={styles.title}>전문가 색상 팔레트 스튜디오</Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <X size={16} color="#64748b" />
            </TouchableOpacity>
          </View>

          {/* Quick Slots Row (Goodnotes 3 Slots) */}
          <View style={styles.slotsContainer}>
            <Text style={styles.slotsLabel}>퀵 컬러 슬롯:</Text>
            <View style={styles.slotsRow}>
              {colorSlots.map((slotColor, idx) => {
                const isSelectedSlot = idx === activeSlotIndex;
                return (
                  <TouchableOpacity
                    key={idx}
                    style={[
                      styles.slotBtn,
                      { backgroundColor: slotColor },
                      isSelectedSlot && styles.slotBtnActive,
                    ]}
                    onPress={() => {
                      onSelectColor(slotColor);
                      setCustomHex(slotColor);
                    }}
                  >
                    {isSelectedSlot && (
                      <Check
                        size={14}
                        color={['#fef08a', '#fde047', '#fde68a', '#ffffff', '#fed7aa', '#bae6fd'].includes(slotColor.toLowerCase()) ? '#000000' : '#ffffff'}
                      />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={styles.slotsHint}>
              * 아래 팔레트에서 색상을 누르면 선택된 슬롯이 변경됩니다.
            </Text>
          </View>

          {/* Custom Color Input Section */}
          <View style={styles.customSection}>
            <View style={styles.customPreviewRow}>
              <View style={[styles.previewSwatch, { backgroundColor: customHex }]} />

              {/* 웹 컬러 피커 인풋 */}
              {Platform.OS === 'web' && (
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      backgroundColor: '#f1f5f9',
                      padding: '6px 10px',
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 600,
                      color: '#334155',
                      cursor: 'pointer',
                      border: '1px solid #cbd5e1',
                    }}
                  >
                    <Pipette size={14} color="#334155" />
                    <span>스펙트럼</span>
                    <input
                      type="color"
                      value={customHex.startsWith('#') && customHex.length === 7 ? customHex : '#2563eb'}
                      onChange={(e) => {
                        const col = e.target.value;
                        setCustomHex(col);
                        handleApplyColor(col);
                      }}
                      style={{
                        position: 'absolute',
                        opacity: 0,
                        width: '100%',
                        height: '100%',
                        left: 0,
                        top: 0,
                        cursor: 'pointer',
                      }}
                    />
                  </label>
                </div>
              )}

              <TextInput
                style={styles.hexInput}
                value={customHex}
                onChangeText={setCustomHex}
                placeholder="#000000"
                placeholderTextColor="#94a3b8"
                maxLength={7}
                autoCapitalize="characters"
              />

              <TouchableOpacity style={styles.applyBtn} onPress={handleCustomHexSubmit}>
                <Text style={styles.applyBtnText}>적용</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Palette Collections Scroll */}
          <ScrollView style={styles.palettesScroll} showsVerticalScrollIndicator={false}>
            {PALETTE_COLLECTIONS.map((palette, pIdx) => (
              <View key={pIdx} style={styles.paletteGroup}>
                <Text style={styles.paletteName}>{palette.name}</Text>
                <View style={styles.colorGrid}>
                  {palette.colors.map((c) => {
                    const isCurrent = currentColor.toLowerCase() === c.toLowerCase();
                    return (
                      <TouchableOpacity
                        key={c}
                        style={[
                          styles.colorDot,
                          { backgroundColor: c },
                          isCurrent && styles.colorDotCurrent,
                        ]}
                        onPress={() => handleApplyColor(c)}
                        activeOpacity={0.8}
                      >
                        {isCurrent && (
                          <Check
                            size={12}
                            color={['#fef08a', '#fde047', '#bbf7d0', '#fbcfe8', '#fed7aa', '#bae6fd', '#fde68a'].includes(c.toLowerCase()) ? '#0f172a' : '#ffffff'}
                          />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ))}
          </ScrollView>
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
    zIndex: 999,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    width: '100%',
    maxWidth: 420,
    maxHeight: '80%',
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotsContainer: {
    marginTop: 12,
    padding: 10,
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  slotsLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 6,
  },
  slotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  slotBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  slotBtnActive: {
    borderColor: '#2563eb',
    transform: [{ scale: 1.15 }],
  },
  slotsHint: {
    fontSize: 10,
    color: '#94a3b8',
    marginTop: 6,
  },
  customSection: {
    marginVertical: 12,
  },
  customPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  previewSwatch: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  hexInput: {
    flex: 1,
    height: 34,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 6,
    paddingHorizontal: 10,
    fontSize: 13,
    fontWeight: '600',
    color: '#1e293b',
    backgroundColor: '#ffffff',
  },
  applyBtn: {
    backgroundColor: '#0f172a',
    paddingHorizontal: 12,
    height: 34,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
  },
  palettesScroll: {
    flex: 1,
    marginTop: 4,
  },
  paletteGroup: {
    marginBottom: 14,
  },
  paletteName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 8,
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  colorDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  colorDotCurrent: {
    borderColor: '#2563eb',
    transform: [{ scale: 1.18 }],
  },
});
