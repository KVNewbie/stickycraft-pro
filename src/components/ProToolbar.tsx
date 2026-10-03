import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import {
  ChevronLeft,
  Undo2,
  Redo2,
  PenTool,
  Feather,
  Highlighter,
  Eraser,
  Crop,
  Type,
  Smile,
  Mic,
  Ruler,
  Image as ImageIcon,
  FileDown,
  Share2,
  Edit3,
  Layers,
  Palette,
  ChevronDown,
  Shapes,
} from 'lucide-react-native';
import { EditorMode } from '../types/note';
import { ColorPaletteModal } from './ColorPaletteModal';

export type ActiveToolType = 'pen' | 'fountain' | 'highlighter' | 'eraser' | 'lasso' | 'text' | 'shape';

interface ProToolbarProps {
  onBack: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;

  selectedTool: ActiveToolType;
  onSelectTool: (tool: ActiveToolType) => void;
  currentColor: string;
  onSelectColor: (color: string) => void;
  currentWidth: number;
  onSelectWidth: (width: number) => void;
  isRulerActive: boolean;
  onToggleRuler: () => void;

  onOpenStickers: () => void;
  onOpenVoice: () => void;
  onAddImage: () => void;
  onExportPdf: () => void;
  onOpenDeviceSync: () => void;

  editorMode: EditorMode;
  onToggleEditorMode: (mode: EditorMode) => void;

  tabType: 'note' | 'pdf' | 'canvas';
}

const COLOR_PRESETS = [
  '#0f172a', // 블랙/차콜
  '#2563eb', // 코발트 블루
  '#dc2626', // 딥 레드
  '#16a34a', // 포레스트 그린
  '#ca8a04', // 옐로우 골드
  '#9333ea', // 퍼플
];

const STROKE_WIDTHS = [2, 4, 8, 16];

export const ProToolbar: React.FC<ProToolbarProps> = ({
  onBack,
  canUndo = false,
  canRedo = false,
  onUndo,
  onRedo,
  selectedTool,
  onSelectTool,
  currentColor,
  onSelectColor,
  currentWidth,
  onSelectWidth,
  isRulerActive,
  onToggleRuler,
  onOpenStickers,
  onOpenVoice,
  onAddImage,
  onExportPdf,
  onOpenDeviceSync,
  editorMode,
  onToggleEditorMode,
  tabType,
}) => {
  const [colorSlots, setColorSlots] = useState<string[]>([
    '#0f172a', // 슬롯 1: 차콜 블랙
    '#2563eb', // 슬롯 2: 코발트 블루
    '#dc2626', // 슬롯 3: 딥 레드
  ]);
  const [activeSlotIndex, setActiveSlotIndex] = useState<number>(0);
  const [isPaletteModalOpen, setIsPaletteModalOpen] = useState(false);

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* 1. 뒤로가기 & Undo / Redo */}
        <View style={styles.group}>
          <TouchableOpacity style={styles.iconBtn} onPress={onBack} accessibilityLabel="닫기/뒤로가기">
            <ChevronLeft size={20} color="#334155" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.iconBtn, !canUndo && styles.disabledBtn]}
            onPress={onUndo}
            disabled={!canUndo}
            accessibilityLabel="실행 취소 (Undo)"
          >
            <Undo2 size={18} color={canUndo ? '#334155' : '#cbd5e1'} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.iconBtn, !canRedo && styles.disabledBtn]}
            onPress={onRedo}
            disabled={!canRedo}
            accessibilityLabel="다시 실행 (Redo)"
          >
            <Redo2 size={18} color={canRedo ? '#334155' : '#cbd5e1'} />
          </TouchableOpacity>
        </View>

        <View style={styles.divider} />

        {/* 2. 모드 전환 세그먼트 (텍스트 모드 ⟷ 자유 필기 모드) */}
        {tabType === 'note' && (
          <View style={styles.modeSegment}>
            <TouchableOpacity
              style={[styles.modeBtn, editorMode === 'text' && styles.modeBtnActive]}
              onPress={() => onToggleEditorMode('text')}
            >
              <Edit3 size={13} color={editorMode === 'text' ? '#ffffff' : '#64748b'} />
              <Text style={[styles.modeBtnText, editorMode === 'text' && styles.modeBtnTextActive]}>
                텍스트
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeBtn, editorMode === 'free' && styles.modeBtnActive]}
              onPress={() => onToggleEditorMode('free')}
            >
              <Layers size={13} color={editorMode === 'free' ? '#ffffff' : '#64748b'} />
              <Text style={[styles.modeBtnText, editorMode === 'free' && styles.modeBtnTextActive]}>
                자유 필기
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {(tabType === 'note' && editorMode === 'free') || tabType === 'pdf' || tabType === 'canvas' ? (
          <>
            <View style={styles.divider} />

            {/* 3. 펜/지우개/캡처 도구 팔레트 (레퍼런스 이미지 스타일) */}
            <View style={styles.group}>
              {/* 볼펜 */}
              <TouchableOpacity
                style={[styles.toolBtn, selectedTool === 'pen' && styles.toolBtnActive]}
                onPress={() => onSelectTool('pen')}
                accessibilityLabel="볼펜"
              >
                <PenTool size={18} color={selectedTool === 'pen' ? '#2563eb' : '#475569'} />
              </TouchableOpacity>

              {/* 만년필 */}
              <TouchableOpacity
                style={[styles.toolBtn, selectedTool === 'fountain' && styles.toolBtnActive]}
                onPress={() => onSelectTool('fountain')}
                accessibilityLabel="만년필"
              >
                <Feather size={18} color={selectedTool === 'fountain' ? '#2563eb' : '#475569'} />
              </TouchableOpacity>

              {/* 형광펜 */}
              <TouchableOpacity
                style={[styles.toolBtn, selectedTool === 'highlighter' && styles.toolBtnActive]}
                onPress={() => onSelectTool('highlighter')}
                accessibilityLabel="형광펜"
              >
                <Highlighter
                  size={18}
                  color={selectedTool === 'highlighter' ? '#eab308' : '#475569'}
                />
              </TouchableOpacity>

              {/* 지우개 */}
              <TouchableOpacity
                style={[styles.toolBtn, selectedTool === 'eraser' && styles.toolBtnActive]}
                onPress={() => onSelectTool('eraser')}
                accessibilityLabel="지우개"
              >
                <Eraser size={18} color={selectedTool === 'eraser' ? '#ef4444' : '#475569'} />
              </TouchableOpacity>

              {/* 영역 캡처 / 올가미 (Lasso) */}
              <TouchableOpacity
                style={[styles.toolBtn, selectedTool === 'lasso' && styles.toolBtnActiveLasso]}
                onPress={() => onSelectTool('lasso')}
                accessibilityLabel="영역 캡처 / 올가미 (Lasso Snip)"
              >
                <Crop size={18} color={selectedTool === 'lasso' ? '#059669' : '#475569'} />
                {selectedTool === 'lasso' && <View style={styles.toolBadgeDot} />}
              </TouchableOpacity>

              {/* 텍스트 상자 */}
              <TouchableOpacity
                style={[styles.toolBtn, selectedTool === 'text' && styles.toolBtnActive]}
                onPress={() => onSelectTool('text')}
                accessibilityLabel="텍스트 상자"
              >
                <Type size={18} color={selectedTool === 'text' ? '#2563eb' : '#475569'} />
              </TouchableOpacity>

              {/* Notewise & Goodnotes 스마트 도형 (Shapes) */}
              <TouchableOpacity
                style={[styles.toolBtn, selectedTool === 'shape' && styles.toolBtnActive]}
                onPress={() => onSelectTool('shape')}
                accessibilityLabel="스마트 도형 인식 (Shapes)"
              >
                <Shapes size={18} color={selectedTool === 'shape' ? '#7c3aed' : '#475569'} />
              </TouchableOpacity>

              {/* 직선 자 (Ruler Mode) */}
              <TouchableOpacity
                style={[styles.toolBtn, isRulerActive && styles.toolBtnActive]}
                onPress={onToggleRuler}
                accessibilityLabel="직선 보정 자"
              >
                <Ruler size={18} color={isRulerActive ? '#2563eb' : '#475569'} />
              </TouchableOpacity>
            </View>

            <View style={styles.divider} />

            {/* 4. Goodnotes 스타일 3개 퀵 컬러 슬롯 & 전문가 색상 팔레트 & 굵기 선택 */}
            <View style={styles.group}>
              <View style={styles.colorPalette}>
                {colorSlots.map((c, idx) => {
                  const isActive = currentColor.toLowerCase() === c.toLowerCase();
                  return (
                    <TouchableOpacity
                      key={idx}
                      style={[
                        styles.colorDot,
                        { backgroundColor: c },
                        isActive && styles.colorDotActive,
                      ]}
                      onPress={() => {
                        setActiveSlotIndex(idx);
                        onSelectColor(c);
                      }}
                      onLongPress={() => {
                        setActiveSlotIndex(idx);
                        setIsPaletteModalOpen(true);
                      }}
                      accessibilityLabel={`색상 슬롯 ${idx + 1}`}
                    >
                      {isActive && (
                        <ChevronDown
                          size={10}
                          color={['#fef08a', '#fde047', '#ffffff', '#fed7aa', '#bae6fd', '#bbf7d0', '#fbcfe8'].includes(c.toLowerCase()) ? '#000000' : '#ffffff'}
                        />
                      )}
                    </TouchableOpacity>
                  );
                })}

                {/* 색상 팔레트 모달 열기 버튼 */}
                <TouchableOpacity
                  style={styles.paletteOpenBtn}
                  onPress={() => setIsPaletteModalOpen(true)}
                  accessibilityLabel="색상 팔레트 열기"
                >
                  <Palette size={16} color="#334155" />
                </TouchableOpacity>
              </View>

              {/* 굵기 프리셋 */}
              <View style={styles.widthGroup}>
                {STROKE_WIDTHS.map((w) => (
                  <TouchableOpacity
                    key={w}
                    style={[styles.widthBtn, currentWidth === w && styles.widthBtnActive]}
                    onPress={() => onSelectWidth(w)}
                    accessibilityLabel={`선 굵기 ${w}px`}
                  >
                    <View
                      style={{
                        width: Math.min(14, w + 3),
                        height: Math.min(14, w + 3),
                        borderRadius: 7,
                        backgroundColor: currentWidth === w ? '#2563eb' : '#94a3b8',
                      }}
                    />
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </>
        ) : null}

        <View style={styles.divider} />

        {/* 5. 부가 미디어 & 도구 (스티커, 이미지, 음성) */}
        <View style={styles.group}>
          <TouchableOpacity style={styles.iconBtn} onPress={onOpenStickers} accessibilityLabel="스티커">
            <Smile size={18} color="#475569" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={onAddImage} accessibilityLabel="사진 첨부">
            <ImageIcon size={18} color="#475569" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={onOpenVoice} accessibilityLabel="음성 녹음">
            <Mic size={18} color="#475569" />
          </TouchableOpacity>
        </View>

        <View style={styles.divider} />

        {/* 6. PDF 구워서 내보내기 & 기기간 공유 */}
        <View style={styles.group}>
          <TouchableOpacity style={styles.actionPillBtn} onPress={onExportPdf}>
            <FileDown size={14} color="#0284c7" />
            <Text style={styles.actionPillText}>PDF 굽기</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionPillBtn} onPress={onOpenDeviceSync}>
            <Share2 size={14} color="#059669" />
            <Text style={[styles.actionPillText, { color: '#059669' }]}>기기 공유</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* 7. 전문가 색상 팔레트 모달 */}
      <ColorPaletteModal
        visible={isPaletteModalOpen}
        onClose={() => setIsPaletteModalOpen(false)}
        currentColor={currentColor}
        onSelectColor={onSelectColor}
        colorSlots={colorSlots}
        activeSlotIndex={activeSlotIndex}
        onUpdateSlotColor={(idx, col) => {
          setColorSlots((prev) => {
            const next = [...prev];
            next[idx] = col;
            return next;
          });
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 48,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 3,
    zIndex: 90,
  },
  scrollContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    gap: 8,
  },
  group: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  divider: {
    width: 1,
    height: 24,
    backgroundColor: '#e2e8f0',
    marginHorizontal: 4,
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
  },
  disabledBtn: {
    opacity: 0.4,
  },
  modeSegment: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    padding: 3,
  },
  modeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 6,
    gap: 4,
  },
  modeBtnActive: {
    backgroundColor: '#3b82f6',
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 2,
  },
  modeBtnText: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
  },
  modeBtnTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  toolBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
    position: 'relative',
  },
  toolBtnActive: {
    backgroundColor: '#eff6ff',
    borderWidth: 1.5,
    borderColor: '#3b82f6',
  },
  toolBtnActiveLasso: {
    backgroundColor: '#ecfdf5',
    borderWidth: 1.5,
    borderColor: '#059669',
  },
  toolBadgeDot: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#059669',
  },
  colorPalette: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 4,
  },
  colorDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 1,
    elevation: 1,
  },
  colorDotActive: {
    borderColor: '#2563eb',
    transform: [{ scale: 1.2 }],
  },
  paletteOpenBtn: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    marginLeft: 3,
  },
  widthGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginLeft: 4,
  },
  widthBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  widthBtnActive: {
    backgroundColor: '#eff6ff',
  },
  actionPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f9ff',
    borderWidth: 1,
    borderColor: '#bae6fd',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 16,
    gap: 4,
  },
  actionPillText: {
    fontSize: 11,
    color: '#0284c7',
    fontWeight: '700',
  },
});
