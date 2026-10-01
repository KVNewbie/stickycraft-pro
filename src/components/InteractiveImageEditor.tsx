import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  PanResponder,
  TextInput,
  Platform,
} from 'react-native';
import {
  Move,
  Maximize2,
  Trash2,
  X,
  Check,
  ZoomIn,
  Sliders,
  Sparkles,
  Layers,
  AlignLeft,
  AlignRight,
  FileText,
  Eye,
} from 'lucide-react-native';
import { NoteImage, TextWrapMode } from '../types/note';
import { NoteColorConfig } from '../constants/colors';

interface InteractiveImageEditorProps {
  image: NoteImage;
  activeColorConfig: NoteColorConfig;
  onUpdate: (updatedFields: Partial<NoteImage>) => void;
  onRemove: () => void;
}

type ActionMode = 'idle' | 'menu' | 'move' | 'resize' | 'wrap';

export const InteractiveImageEditor: React.FC<InteractiveImageEditorProps> = ({
  image,
  activeColorConfig,
  onUpdate,
  onRemove,
}) => {
  const [mode, setMode] = useState<ActionMode>('idle');

  // 위치 및 크기 상태
  const [pos, setPos] = useState({ x: image.x || 0, y: image.y || 0 });
  const [dims, setDims] = useState({
    width: image.customWidth || (image.size === 'small' ? 120 : image.size === 'large' ? 280 : 190),
    height: image.customHeight || (image.size === 'small' ? 100 : image.size === 'large' ? 210 : 150),
  });
  const [scale, setScale] = useState(image.scale || 1);
  const [wrapMode, setWrapMode] = useState<TextWrapMode>(image.wrapMode || 'break');
  const [opacity, setOpacity] = useState(image.opacity ?? (image.wrapMode === 'behind-text' ? 0.45 : 1));

  // 직접 입력용 텍스트 상태
  const [inputX, setInputX] = useState(String(image.x || 0));
  const [inputY, setInputY] = useState(String(image.y || 0));
  const [inputW, setInputW] = useState(String(dims.width));
  const [inputH, setInputH] = useState(String(dims.height));

  const startPosRef = useRef({ x: pos.x, y: pos.y });
  const startDimsRef = useRef({ width: dims.width, height: dims.height });
  const currentPosRef = useRef({ x: pos.x, y: pos.y });
  const currentDimsRef = useRef({ width: dims.width, height: dims.height });

  useEffect(() => {
    currentPosRef.current = pos;
    setInputX(String(Math.round(pos.x)));
    setInputY(String(Math.round(pos.y)));
  }, [pos]);

  useEffect(() => {
    currentDimsRef.current = dims;
    setInputW(String(Math.round(dims.width)));
    setInputH(String(Math.round(dims.height)));
  }, [dims]);

  // 이동 전용 PanResponder
  const movePanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderGrant: () => {
        startPosRef.current = { x: currentPosRef.current.x, y: currentPosRef.current.y };
      },
      onPanResponderMove: (_, gesture) => {
        const newX = Math.round(startPosRef.current.x + gesture.dx);
        const newY = Math.round(startPosRef.current.y + gesture.dy);
        setPos({ x: newX, y: newY });
        currentPosRef.current = { x: newX, y: newY };
      },
      // 부모 모달 스크롤 등이 드래그를 가로채지 못하도록 잠금
      onPanResponderTerminationRequest: () => false,
      onPanResponderRelease: (_, gesture) => {
        const finalX = Math.round(startPosRef.current.x + gesture.dx);
        const finalY = Math.round(startPosRef.current.y + gesture.dy);
        setPos({ x: finalX, y: finalY });
        currentPosRef.current = { x: finalX, y: finalY };
        onUpdate({ x: finalX, y: finalY });
      },
      onPanResponderTerminate: () => {
        onUpdate({ x: currentPosRef.current.x, y: currentPosRef.current.y });
      },
    })
  ).current;

  // 외곽 크기 조절 전용 PanResponder (우하단 핸들)
  const resizePanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderGrant: () => {
        startDimsRef.current = { width: currentDimsRef.current.width, height: currentDimsRef.current.height };
      },
      onPanResponderMove: (_, gesture) => {
        const newW = Math.max(70, Math.min(500, Math.round(startDimsRef.current.width + gesture.dx)));
        const newH = Math.max(60, Math.min(450, Math.round(startDimsRef.current.height + gesture.dy)));
        setDims({ width: newW, height: newH });
        currentDimsRef.current = { width: newW, height: newH };
      },
      // 부모 모달 스크롤 등이 크기 조절을 가로채지 못하도록 잠금
      onPanResponderTerminationRequest: () => false,
      onPanResponderRelease: (_, gesture) => {
        const finalW = Math.max(70, Math.min(500, Math.round(startDimsRef.current.width + gesture.dx)));
        const finalH = Math.max(60, Math.min(450, Math.round(startDimsRef.current.height + gesture.dy)));
        setDims({ width: finalW, height: finalH });
        currentDimsRef.current = { width: finalW, height: finalH };
        onUpdate({ customWidth: finalW, customHeight: finalH });
      },
      onPanResponderTerminate: () => {
        onUpdate({ customWidth: currentDimsRef.current.width, customHeight: currentDimsRef.current.height });
      },
    })
  ).current;

  // 수치 직접 입력 반영
  const handleApplyInputs = () => {
    const parsedX = parseInt(inputX, 10) || 0;
    const parsedY = parseInt(inputY, 10) || 0;
    const parsedW = Math.max(70, Math.min(500, parseInt(inputW, 10) || dims.width));
    const parsedH = Math.max(60, Math.min(450, parseInt(inputH, 10) || dims.height));

    setPos({ x: parsedX, y: parsedY });
    setDims({ width: parsedW, height: parsedH });
    onUpdate({ x: parsedX, y: parsedY, customWidth: parsedW, customHeight: parsedH, scale, wrapMode, opacity });
  };

  // 배율 변경
  const handleSetScale = (newScale: number) => {
    setScale(newScale);
    onUpdate({ scale: newScale });
  };

  // 어울림 모드 변경 (좌측/우측 어울림, 사진 위 글쓰기, 자리차지 등)
  const handleSetWrapMode = (modeVal: TextWrapMode) => {
    setWrapMode(modeVal);
    const newOpacity = modeVal === 'behind-text' ? 0.45 : 1;
    setOpacity(newOpacity);
    onUpdate({ wrapMode: modeVal, opacity: newOpacity });
  };

  // 투명도 변경
  const handleSetOpacity = (op: number) => {
    setOpacity(op);
    onUpdate({ opacity: op });
  };

  const handleFinish = () => {
    handleApplyInputs();
    setMode('idle');
  };

  return (
    <View style={styles.outerContainer}>
      {/* Active Mode Notice / Control Toolbar */}
      {mode !== 'idle' && (
        <View style={styles.modeToolbar}>
          <View style={styles.modeStatusRow}>
            <Sparkles size={14} color="#2563EB" />
            <Text style={styles.modeStatusText}>
              {mode === 'menu'
                ? '이미지 & 어울림 액션'
                : mode === 'move'
                ? '자유 캔버스 이동 모드'
                : mode === 'resize'
                ? '외곽 크기 조절 모드'
                : '본문 어울림 (Wrap) 설정'}
            </Text>
          </View>
          <TouchableOpacity style={styles.finishBtn} onPress={handleFinish}>
            <Check size={14} color="#FFFFFF" />
            <Text style={styles.finishBtnText}>해제 / 완료</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Main Interactive Image Frame */}
      <View
        style={[
          styles.imagePositionWrapper,
          {
            transform: [
              { translateX: pos.x },
              { translateY: pos.y },
              { scale: scale },
            ],
            opacity: opacity,
          },
        ]}
      >
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => {
            if (mode === 'idle') setMode('menu');
          }}
          onLongPress={() => setMode('menu')}
          delayLongPress={300}
          style={[
            styles.imageWrapper,
            { width: dims.width, height: dims.height },
            mode === 'move' && styles.movingFrame,
            mode === 'resize' && styles.resizingFrame,
            wrapMode === 'behind-text' && styles.behindTextFrame,
          ]}
        >
          {/* Real Image */}
          <Image
            source={{ uri: image.uri }}
            style={{ width: '100%', height: '100%' }}
            resizeMode="cover"
          />

          {/* Current Wrap Mode Badge */}
          {wrapMode !== 'break' && mode === 'idle' && (
            <View style={styles.wrapBadge}>
              <Text style={styles.wrapBadgeText}>
                {wrapMode === 'wrap-left'
                  ? '📄 좌측 어울림'
                  : wrapMode === 'wrap-right'
                  ? '📄 우측 어울림'
                  : wrapMode === 'behind-text'
                  ? '🔲 사진 위 글쓰기'
                  : '✨ 자유 오버레이'}
              </Text>
            </View>
          )}

          {/* Move Drag Handle Bar on top (when in move mode) */}
          {mode === 'move' && (
            <View {...movePanResponder.panHandlers} style={styles.moveHandleOverlay}>
              <View style={styles.moveHandlePill}>
                <Move size={12} color="#FFFFFF" />
                <Text style={styles.moveHandlePillText}>여기를 잡고 자유 이동</Text>
              </View>
            </View>
          )}

          {/* Resize Corner Handles (when in resize mode) */}
          {mode === 'resize' && (
            <>
              <View style={[styles.cornerDot, styles.dotTL]} />
              <View style={[styles.cornerDot, styles.dotTR]} />
              <View style={[styles.cornerDot, styles.dotBL]} />
              {/* Bottom Right Draggable Handle */}
              <View {...resizePanResponder.panHandlers} style={[styles.cornerDot, styles.dotBRActive]}>
                <Maximize2 size={10} color="#FFFFFF" />
              </View>
            </>
          )}

          {/* Long Press Action Menu Overlay */}
          {mode === 'menu' && (
            <View style={styles.menuOverlay}>
              <Text style={styles.menuTitle}>사진 & 본문 어울림 설정</Text>
              <TouchableOpacity
                style={styles.menuItemBtn}
                onPress={() => setMode('wrap')}
              >
                <Layers size={14} color="#7C3AED" />
                <Text style={styles.menuItemText}>🔄 본문 어울림 (글과 함께 배치)</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.menuItemBtn}
                onPress={() => setMode('move')}
              >
                <Move size={14} color="#2563EB" />
                <Text style={styles.menuItemText}>✨ 자유 이동 (캔버스형)</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.menuItemBtn}
                onPress={() => setMode('resize')}
              >
                <Maximize2 size={14} color="#059669" />
                <Text style={styles.menuItemText}>📐 외곽 크기 조절</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.menuItemBtn, styles.menuItemDelete]}
                onPress={onRemove}
              >
                <Trash2 size={14} color="#DC2626" />
                <Text style={[styles.menuItemText, { color: '#DC2626' }]}>사진 삭제</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.menuCancelBtn}
                onPress={() => setMode('idle')}
              >
                <Text style={styles.menuCancelText}>닫기</Text>
              </TouchableOpacity>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Wrap Mode Selector (어울림 모드 선택 서랍) */}
      {(mode === 'wrap' || mode === 'move' || mode === 'resize') && (
        <View style={styles.numericControlPanel}>
          <Text style={styles.panelTitle}>본문과의 어울림 (글과 사진의 조화)</Text>
          <View style={styles.wrapBtnGrid}>
            <TouchableOpacity
              style={[styles.wrapOptionBtn, wrapMode === 'wrap-left' && styles.wrapOptionBtnActive]}
              onPress={() => handleSetWrapMode('wrap-left')}
            >
              <AlignLeft size={13} color={wrapMode === 'wrap-left' ? '#FFFFFF' : '#334155'} />
              <Text style={[styles.wrapOptionText, wrapMode === 'wrap-left' && styles.wrapOptionTextActive]}>
                좌측 어울림 (사진 좌 + 글 우)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.wrapOptionBtn, wrapMode === 'wrap-right' && styles.wrapOptionBtnActive]}
              onPress={() => handleSetWrapMode('wrap-right')}
            >
              <AlignRight size={13} color={wrapMode === 'wrap-right' ? '#FFFFFF' : '#334155'} />
              <Text style={[styles.wrapOptionText, wrapMode === 'wrap-right' && styles.wrapOptionTextActive]}>
                우측 어울림 (글 좌 + 사진 우)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.wrapOptionBtn, wrapMode === 'behind-text' && styles.wrapOptionBtnActive]}
              onPress={() => handleSetWrapMode('behind-text')}
            >
              <FileText size={13} color={wrapMode === 'behind-text' ? '#FFFFFF' : '#334155'} />
              <Text style={[styles.wrapOptionText, wrapMode === 'behind-text' && styles.wrapOptionTextActive]}>
                사진 위에 글쓰기 (배경)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.wrapOptionBtn, wrapMode === 'break' && styles.wrapOptionBtnActive]}
              onPress={() => handleSetWrapMode('break')}
            >
              <Maximize2 size={13} color={wrapMode === 'break' ? '#FFFFFF' : '#334155'} />
              <Text style={[styles.wrapOptionText, wrapMode === 'break' && styles.wrapOptionTextActive]}>
                자리차지 (위아래 분리)
              </Text>
            </TouchableOpacity>
          </View>

          {/* 사진 위에 글쓰기 선택 시 투명도 조절 */}
          {wrapMode === 'behind-text' && (
            <View style={styles.opacityRow}>
              <Eye size={12} color="#64748B" />
              <Text style={styles.scaleLabel}>배경 투명도:</Text>
              {([0.2, 0.35, 0.5, 0.7, 1.0] as const).map((op) => (
                <TouchableOpacity
                  key={op}
                  style={[styles.scaleBtn, opacity === op && styles.scaleBtnActive]}
                  onPress={() => handleSetOpacity(op)}
                >
                  <Text style={[styles.scaleBtnText, opacity === op && styles.scaleBtnTextActive]}>
                    {Math.round(op * 100)}%
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Numeric Position & Size */}
          <Text style={[styles.panelTitle, { marginTop: 10 }]}>정밀 수치 및 배율</Text>
          <View style={styles.inputRow}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>X 위치:</Text>
              <TextInput
                style={styles.numInput}
                value={inputX}
                onChangeText={setInputX}
                keyboardType="numeric"
                onBlur={handleApplyInputs}
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Y 위치:</Text>
              <TextInput
                style={styles.numInput}
                value={inputY}
                onChangeText={setInputY}
                keyboardType="numeric"
                onBlur={handleApplyInputs}
              />
            </View>
          </View>

          <View style={styles.inputRow}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>너비 (W):</Text>
              <TextInput
                style={styles.numInput}
                value={inputW}
                onChangeText={setInputW}
                keyboardType="numeric"
                onBlur={handleApplyInputs}
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>높이 (H):</Text>
              <TextInput
                style={styles.numInput}
                value={inputH}
                onChangeText={setInputH}
                keyboardType="numeric"
                onBlur={handleApplyInputs}
              />
            </View>
          </View>

          {/* Scale Multiplier */}
          <View style={styles.scaleRow}>
            <Text style={styles.scaleLabel}>배율:</Text>
            {([0.5, 0.75, 1.0, 1.25, 1.5, 2.0] as const).map((sc) => (
              <TouchableOpacity
                key={sc}
                style={[styles.scaleBtn, scale === sc && styles.scaleBtnActive]}
                onPress={() => handleSetScale(sc)}
              >
                <Text style={[styles.scaleBtnText, scale === sc && styles.scaleBtnTextActive]}>
                  {Math.round(sc * 100)}%
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  outerContainer: {
    marginVertical: 10,
    alignItems: 'center',
    position: 'relative',
  },
  modeToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    width: '100%',
    marginBottom: 8,
  },
  modeStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  modeStatusText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  finishBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#2563EB',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  finishBtnText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '700',
  },
  imagePositionWrapper: {
    position: 'relative',
    zIndex: 10,
  },
  imageWrapper: {
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#E2E8F0',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
    position: 'relative',
  },
  movingFrame: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#2563EB',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  resizingFrame: {
    borderWidth: 2,
    borderColor: '#059669',
  },
  behindTextFrame: {
    borderWidth: 1.5,
    borderColor: '#A855F7',
    borderStyle: 'dotted',
  },
  wrapBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    zIndex: 15,
  },
  wrapBadgeText: {
    color: '#FFFFFF',
    fontSize: 9.5,
    fontWeight: '700',
  },
  moveHandleOverlay: {
    position: 'absolute',
    top: 6,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 20,
  },
  moveHandlePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#2563EB',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 4,
  },
  moveHandlePillText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  cornerDot: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#059669',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    zIndex: 20,
  },
  dotTL: { top: -6, left: -6 },
  dotTR: { top: -6, right: -6 },
  dotBL: { bottom: -6, left: -6 },
  dotBRActive: {
    bottom: -8,
    right: -8,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.88)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12,
    gap: 6,
    zIndex: 30,
  },
  menuTitle: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '700',
    marginBottom: 4,
  },
  menuItemBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    width: '92%',
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 8,
    justifyContent: 'center',
  },
  menuItemDelete: {
    backgroundColor: '#FEE2E2',
  },
  menuItemText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#1E293B',
  },
  menuCancelBtn: {
    marginTop: 2,
  },
  menuCancelText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
  },
  numericControlPanel: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    width: '100%',
    maxWidth: 420,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 5,
    elevation: 3,
  },
  panelTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 6,
  },
  wrapBtnGrid: {
    gap: 5,
    marginBottom: 8,
  },
  wrapOptionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  wrapOptionBtnActive: {
    backgroundColor: '#7C3AED',
    borderColor: '#7C3AED',
  },
  wrapOptionText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#334155',
  },
  wrapOptionTextActive: {
    color: '#FFFFFF',
  },
  opacityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginVertical: 6,
    backgroundColor: '#FAF5FF',
    padding: 6,
    borderRadius: 8,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 6,
  },
  inputGroup: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    width: 52,
  },
  numInput: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 12,
    color: '#0F172A',
    textAlign: 'center',
  },
  scaleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
    flexWrap: 'wrap',
  },
  scaleLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    marginRight: 4,
  },
  scaleBtn: {
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
  },
  scaleBtnActive: {
    backgroundColor: '#0F172A',
  },
  scaleBtnText: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#475569',
  },
  scaleBtnTextActive: {
    color: '#FFFFFF',
  },
});
