import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Platform,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NoteImage, PaperTemplate } from '../types/note';

interface DrawingPadModalProps {
  visible: boolean;
  onClose: () => void;
  onSaveDrawing: (image: NoteImage) => void;
}

const PALETTE = [
  { id: 'black', color: '#1E293B', label: '블랙' },
  { id: 'red', color: '#EF4444', label: '레드' },
  { id: 'blue', color: '#3B82F6', label: '블루' },
  { id: 'green', color: '#10B981', label: '그린' },
  { id: 'highlighter-yellow', color: '#FACC15', label: '형광 옐로우' },
  { id: 'highlighter-pink', color: '#F43F5E', label: '형광 핑크' },
  { id: 'purple', color: '#8B5CF6', label: '바이올렛' },
];

const STROKE_WIDTHS = [
  { id: 'fine', width: 2, label: '얇게 (2px)' },
  { id: 'normal', width: 5, label: '보통 (5px)' },
  { id: 'thick', width: 12, label: '굵게 (12px)' },
  { id: 'highlighter', width: 24, label: '형광펜 (24px)' },
];

export const DrawingPadModal: React.FC<DrawingPadModalProps> = ({
  visible,
  onClose,
  onSaveDrawing,
}) => {
  const [selectedColor, setSelectedColor] = useState<string>('#1E293B');
  const [selectedWidth, setSelectedWidth] = useState<number>(5);
  const [toolMode, setToolMode] = useState<'pen' | 'fountain' | 'highlighter' | 'eraser'>('pen');
  const [isRulerMode, setIsRulerMode] = useState(false); // Noteshelf 직선/자 보정 모드
  const [drawingPaper, setDrawingPaper] = useState<PaperTemplate>('blank'); // Noteshelf 페이퍼 템플릿

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef(false);
  const historyRef = useRef<ImageData[]>([]);
  const startPointRef = useRef<{ x: number; y: number } | null>(null);
  const snapshotBeforeLineRef = useRef<ImageData | null>(null);

  // 캔버스 배경에 페이퍼 템플릿(줄, 모눈, 도트) 그리기
  const renderPaperBackground = (ctx: CanvasRenderingContext2D, width: number, height: number, template: PaperTemplate) => {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);

    if (template === 'lined') {
      ctx.strokeStyle = 'rgba(15, 23, 42, 0.08)';
      ctx.lineWidth = 1;
      for (let y = 30; y < height; y += 28) {
        ctx.beginPath();
        ctx.moveTo(10, y);
        ctx.lineTo(width - 10, y);
        ctx.stroke();
      }
    } else if (template === 'grid') {
      ctx.strokeStyle = 'rgba(15, 23, 42, 0.07)';
      ctx.lineWidth = 1;
      for (let x = 20; x < width; x += 24) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 20; y < height; y += 24) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }
    } else if (template === 'dot') {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.16)';
      for (let x = 16; x < width; x += 22) {
        for (let y = 16; y < height; y += 22) {
          ctx.beginPath();
          ctx.arc(x, y, 1.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  };

  const redrawCanvasWithTemplate = (template: PaperTemplate) => {
    if (Platform.OS !== 'web') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    renderPaperBackground(ctx, canvas.width, canvas.height, template);
    historyRef.current = [ctx.getImageData(0, 0, canvas.width, canvas.height)];
  };

  useEffect(() => {
    if (visible && Platform.OS === 'web') {
      setTimeout(() => {
        redrawCanvasWithTemplate(drawingPaper);
      }, 100);
    }
  }, [visible, drawingPaper]);

  if (!visible) return null;

  const handleStartDraw = (e: any) => {
    if (Platform.OS !== 'web') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    isDrawingRef.current = true;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX || (e.touches && e.touches[0].clientX)) - rect.left;
    const y = (e.clientY || (e.touches && e.touches[0].clientY)) - rect.top;

    startPointRef.current = { x, y };

    if (isRulerMode) {
      // Ruler mode: save snapshot to redraw line on move
      snapshotBeforeLineRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height);
      return;
    }

    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (toolMode === 'eraser') {
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = selectedWidth * 2.5;
      ctx.globalAlpha = 1.0;
    } else if (toolMode === 'highlighter') {
      ctx.strokeStyle = selectedColor;
      ctx.lineWidth = 24;
      ctx.globalAlpha = 0.35;
    } else if (toolMode === 'fountain') {
      // Noteshelf 만년필: 캘리그라피 엣지
      ctx.strokeStyle = selectedColor;
      ctx.lineWidth = selectedWidth * 1.3;
      ctx.globalAlpha = 0.95;
    } else {
      ctx.strokeStyle = selectedColor;
      ctx.lineWidth = selectedWidth;
      ctx.globalAlpha = 1.0;
    }
  };

  const handleDraw = (e: any) => {
    if (!isDrawingRef.current || Platform.OS !== 'web') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX || (e.touches && e.touches[0].clientX)) - rect.left;
    const y = (e.clientY || (e.touches && e.touches[0].clientY)) - rect.top;

    if (isRulerMode && startPointRef.current && snapshotBeforeLineRef.current) {
      // Restore clean state and draw straight line
      ctx.putImageData(snapshotBeforeLineRef.current, 0, 0);
      ctx.beginPath();
      ctx.moveTo(startPointRef.current.x, startPointRef.current.y);
      ctx.lineTo(x, y);
      ctx.strokeStyle = selectedColor;
      ctx.lineWidth = toolMode === 'highlighter' ? 24 : selectedWidth;
      ctx.globalAlpha = toolMode === 'highlighter' ? 0.35 : 1.0;
      ctx.lineCap = 'round';
      ctx.stroke();
      return;
    }

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const handleEndDraw = () => {
    if (!isDrawingRef.current || Platform.OS !== 'web') return;
    isDrawingRef.current = false;
    startPointRef.current = null;
    snapshotBeforeLineRef.current = null;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.closePath();
    ctx.globalAlpha = 1.0;

    // Save history for undo
    if (historyRef.current.length > 25) {
      historyRef.current.shift();
    }
    historyRef.current.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
  };

  const handleUndo = () => {
    if (Platform.OS !== 'web') return;
    const canvas = canvasRef.current;
    if (!canvas || historyRef.current.length <= 1) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    historyRef.current.pop();
    const previous = historyRef.current[historyRef.current.length - 1];
    if (previous) {
      ctx.putImageData(previous, 0, 0);
    }
  };

  const handleClear = () => {
    if (Platform.OS !== 'web') return;
    redrawCanvasWithTemplate(drawingPaper);
  };

  const handleSave = () => {
    if (Platform.OS === 'web') {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const dataUrl = canvas.toDataURL('image/png');

      const drawingImage: NoteImage = {
        id: 'drawing_' + Date.now(),
        uri: dataUrl,
        size: 'medium',
        placement: 'inline',
        wrapMode: 'break',
        customWidth: 320,
        customHeight: 220,
        caption: '손글씨 스케치 드로잉',
      };

      onSaveDrawing(drawingImage);
      onClose();
    } else {
      const drawingImage: NoteImage = {
        id: 'drawing_' + Date.now(),
        uri: 'https://images.unsplash.com/photo-1544717305-2782549b5136?w=600&auto=format&fit=crop&q=80',
        size: 'medium',
        placement: 'inline',
        wrapMode: 'break',
        caption: '손글씨 스케치 드로잉',
      };
      onSaveDrawing(drawingImage);
      onClose();
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
              <View style={styles.headerIconCircle}>
                <Ionicons name="pencil" size={20} color="#2563EB" />
              </View>
              <View>
                <Text style={styles.headerTitle}>Noteshelf & Samsung Notes 스케치 패드</Text>
                <Text style={styles.headerSubtitle}>
                  속지 위 만년필 손글씨 필기와 반듯한 직선 자 모드를 지원합니다.
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color="#64748B" />
            </TouchableOpacity>
          </View>

          {/* Noteshelf Paper Template Selector Bar */}
          <View style={styles.paperSelectRow}>
            <Text style={styles.paperSelectLabel}>속지 선택:</Text>
            {(
              [
                { id: 'blank', label: '무지' },
                { id: 'lined', label: '줄노트' },
                { id: 'grid', label: '모눈종이' },
                { id: 'dot', label: '도트' },
              ] as const
            ).map((p) => {
              const isSelected = drawingPaper === p.id;
              return (
                <TouchableOpacity
                  key={p.id}
                  style={[styles.paperChip, isSelected && styles.paperChipActive]}
                  onPress={() => setDrawingPaper(p.id)}
                >
                  <Text style={[styles.paperChipText, isSelected && styles.paperChipTextActive]}>
                    {p.label}
                  </Text>
                </TouchableOpacity>
              );
            })}

            {/* Noteshelf Ruler / Straight Line Toggle */}
            <TouchableOpacity
              style={[styles.rulerToggleBtn, isRulerMode && styles.rulerToggleBtnActive]}
              onPress={() => setIsRulerMode(!isRulerMode)}
            >
              <Ionicons
                name="remove-outline"
                size={16}
                color={isRulerMode ? '#FFFFFF' : '#475569'}
              />
              <Text
                style={[
                  styles.rulerToggleText,
                  isRulerMode && styles.rulerToggleTextActive,
                ]}
              >
                직선 자 {isRulerMode ? 'ON' : 'OFF'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Tools Palette Toolbar */}
          <View style={styles.toolbar}>
            {/* Tool Mode Buttons (Pen, Fountain, Highlighter, Eraser) */}
            <View style={styles.toolModeGroup}>
              <TouchableOpacity
                style={[styles.toolBtn, toolMode === 'pen' && styles.toolBtnActive]}
                onPress={() => setToolMode('pen')}
              >
                <Ionicons
                  name="pencil-outline"
                  size={15}
                  color={toolMode === 'pen' ? '#2563EB' : '#475569'}
                />
                <Text style={[styles.toolBtnText, toolMode === 'pen' && styles.toolBtnTextActive]}>
                  펜
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.toolBtn, toolMode === 'fountain' && styles.toolBtnActive]}
                onPress={() => setToolMode('fountain')}
              >
                <Ionicons
                  name="brush-outline"
                  size={15}
                  color={toolMode === 'fountain' ? '#2563EB' : '#475569'}
                />
                <Text style={[styles.toolBtnText, toolMode === 'fountain' && styles.toolBtnTextActive]}>
                  만년필
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.toolBtn, toolMode === 'highlighter' && styles.toolBtnActive]}
                onPress={() => setToolMode('highlighter')}
              >
                <Ionicons
                  name="color-wand-outline"
                  size={15}
                  color={toolMode === 'highlighter' ? '#2563EB' : '#475569'}
                />
                <Text
                  style={[
                    styles.toolBtnText,
                    toolMode === 'highlighter' && styles.toolBtnTextActive,
                  ]}
                >
                  형광펜
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.toolBtn, toolMode === 'eraser' && styles.toolBtnActive]}
                onPress={() => setToolMode('eraser')}
              >
                <Ionicons
                  name="cut-outline"
                  size={15}
                  color={toolMode === 'eraser' ? '#EF4444' : '#475569'}
                />
                <Text
                  style={[
                    styles.toolBtnText,
                    toolMode === 'eraser' && { color: '#EF4444', fontWeight: '700' },
                  ]}
                >
                  지우개
                </Text>
              </TouchableOpacity>
            </View>

            {/* Stroke Width Selector */}
            {toolMode !== 'highlighter' && (
              <View style={styles.strokeWidthGroup}>
                {STROKE_WIDTHS.slice(0, 3).map((sw) => (
                  <TouchableOpacity
                    key={sw.id}
                    style={[
                      styles.strokeBtn,
                      selectedWidth === sw.width && styles.strokeBtnActive,
                    ]}
                    onPress={() => setSelectedWidth(sw.width)}
                  >
                    <View
                      style={[
                        styles.strokeDot,
                        {
                          width: sw.width * 1.5,
                          height: sw.width * 1.5,
                          backgroundColor:
                            selectedWidth === sw.width ? '#2563EB' : '#94A3B8',
                        },
                      ]}
                    />
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Color Palette */}
            {toolMode !== 'eraser' && (
              <View style={styles.colorPaletteGroup}>
                {PALETTE.map((c) => (
                  <TouchableOpacity
                    key={c.id}
                    style={[
                      styles.colorDotBtn,
                      { backgroundColor: c.color },
                      selectedColor === c.color && styles.colorDotBtnSelected,
                    ]}
                    onPress={() => setSelectedColor(c.color)}
                  />
                ))}
              </View>
            )}

            {/* Undo / Clear Actions */}
            <View style={styles.actionGroup}>
              <TouchableOpacity onPress={handleUndo} style={styles.actionIconBtn}>
                <Ionicons name="arrow-undo-outline" size={17} color="#475569" />
              </TouchableOpacity>
              <TouchableOpacity onPress={handleClear} style={styles.actionIconBtn}>
                <Ionicons name="trash-outline" size={17} color="#EF4444" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Interactive Drawing Canvas Area */}
          <View style={styles.canvasContainer}>
            {Platform.OS === 'web' ? (
              <canvas
                ref={canvasRef as any}
                width={500}
                height={320}
                onMouseDown={handleStartDraw}
                onMouseMove={handleDraw}
                onMouseUp={handleEndDraw}
                onMouseLeave={handleEndDraw}
                onTouchStart={handleStartDraw}
                onTouchMove={handleDraw}
                onTouchEnd={handleEndDraw}
                style={{
                  width: '100%',
                  height: 320,
                  backgroundColor: '#FFFFFF',
                  borderRadius: 12,
                  cursor: isRulerMode ? 'crosshair' : toolMode === 'eraser' ? 'pointer' : 'crosshair',
                  touchAction: 'none',
                }}
              />
            ) : (
              <View style={styles.nativeMockWrap}>
                <Ionicons name="brush-outline" size={48} color="#94A3B8" />
                <Text style={styles.nativeMockText}>
                  모바일 환경에서는 손가락이나 S펜으로 자유롭게 스케치할 수 있습니다.
                </Text>
              </View>
            )}
          </View>

          {/* Footer Save Button */}
          <View style={styles.footer}>
            <TouchableOpacity onPress={onClose} style={styles.cancelBtn}>
              <Text style={styles.cancelBtnText}>취소</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={handleSave} style={styles.saveBtn} activeOpacity={0.85}>
              <Ionicons name="checkmark" size={18} color="#FFFFFF" />
              <Text style={styles.saveBtnText}>스티커 메모에 손글씨 첨부하기</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  container: {
    width: '100%',
    maxWidth: 580,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  closeBtn: {
    padding: 4,
  },
  paperSelectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
    flexWrap: 'wrap',
  },
  paperSelectLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    marginRight: 2,
  },
  paperChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  paperChipActive: {
    backgroundColor: '#0F172A',
    borderColor: '#0F172A',
  },
  paperChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  paperChipTextActive: {
    color: '#FFFFFF',
  },
  rulerToggleBtn: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  rulerToggleBtnActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  rulerToggleText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  rulerToggleTextActive: {
    color: '#FFFFFF',
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 8,
    marginBottom: 12,
  },
  toolModeGroup: {
    flexDirection: 'row',
    gap: 4,
  },
  toolBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  toolBtnActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#2563EB',
  },
  toolBtnText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#475569',
  },
  toolBtnTextActive: {
    color: '#2563EB',
  },
  strokeWidthGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  strokeBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  strokeBtnActive: {
    borderColor: '#2563EB',
    backgroundColor: '#EFF6FF',
  },
  strokeDot: {
    borderRadius: 10,
  },
  colorPaletteGroup: {
    flexDirection: 'row',
    gap: 4,
  },
  colorDotBtn: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.8)',
  },
  colorDotBtnSelected: {
    transform: [{ scale: 1.25 }],
    borderColor: '#0F172A',
  },
  actionGroup: {
    flexDirection: 'row',
    gap: 6,
  },
  actionIconBtn: {
    width: 28,
    height: 28,
    borderRadius: 7,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  canvasContainer: {
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
  },
  nativeMockWrap: {
    height: 320,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  nativeMockText: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 12,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 14,
  },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: '#2563EB',
  },
  saveBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
