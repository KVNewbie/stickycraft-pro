import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Platform,
  Dimensions,
  PanResponder,
  GestureResponderEvent,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path as SvgPath, Line, Rect, Circle } from 'react-native-svg';
import { NoteImage, PaperTemplate } from '../types/note';

interface DrawingPadModalProps {
  visible: boolean;
  onClose: () => void;
  onSaveDrawing: (image: NoteImage) => void;
}

interface NativeStroke {
  id: string;
  points: { x: number; y: number }[];
  color: string;
  width: number;
  tool: 'pen' | 'fountain' | 'highlighter' | 'eraser';
  isRuler?: boolean;
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

// 부드러운 Bézier 곡선 변환 엔진
const strokePointsToPath = (points: { x: number; y: number }[], isRuler?: boolean) => {
  if (!points || points.length === 0) return '';
  if (isRuler || points.length === 2) {
    const first = points[0];
    const last = points[points.length - 1];
    return `M ${first.x} ${first.y} L ${last.x} ${last.y}`;
  }
  if (points.length === 1) {
    return `M ${points[0].x} ${points[0].y} L ${points[0].x + 0.1} ${points[0].y + 0.1}`;
  }
  let path = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length - 1; i++) {
    const xc = (points[i].x + points[i + 1].x) / 2;
    const yc = (points[i].y + points[i + 1].y) / 2;
    path += ` Q ${points[i].x} ${points[i].y}, ${xc} ${yc}`;
  }
  const last = points[points.length - 1];
  path += ` L ${last.x} ${last.y}`;
  return path;
};

export const DrawingPadModal: React.FC<DrawingPadModalProps> = ({
  visible,
  onClose,
  onSaveDrawing,
}) => {
  const [selectedColor, setSelectedColor] = useState<string>('#1E293B');
  const [selectedWidth, setSelectedWidth] = useState<number>(5);
  const [toolMode, setToolMode] = useState<'pen' | 'fountain' | 'highlighter' | 'eraser'>('pen');
  const [isRulerMode, setIsRulerMode] = useState(false);
  const [drawingPaper, setDrawingPaper] = useState<PaperTemplate>('blank');

  // 모바일 네이티브 제스처 & 스트로크 상태
  const [nativeStrokes, setNativeStrokes] = useState<NativeStroke[]>([]);
  const [currentNativeStroke, setCurrentNativeStroke] = useState<NativeStroke | null>(null);
  const [undoHistory, setUndoHistory] = useState<NativeStroke[][]>([]);
  const [canvasLayout, setCanvasLayout] = useState({ width: 340, height: 320 });

  // 웹 HTML5 캔버스 참조
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef(false);
  const webHistoryRef = useRef<ImageData[]>([]);
  const startPointRef = useRef<{ x: number; y: number } | null>(null);
  const snapshotBeforeLineRef = useRef<ImageData | null>(null);

  // 캔버스 배경에 페이퍼 템플릿(줄, 모눈, 도트) 그리기 (Web용)
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
    webHistoryRef.current = [ctx.getImageData(0, 0, canvas.width, canvas.height)];
  };

  useEffect(() => {
    if (visible && Platform.OS === 'web') {
      setTimeout(() => {
        redrawCanvasWithTemplate(drawingPaper);
      }, 100);
    }
  }, [visible, drawingPaper]);

  // 모바일 터치 제스처 PanResponder
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt: GestureResponderEvent) => {
        const { locationX, locationY } = evt.nativeEvent;
        const newStroke: NativeStroke = {
          id: 'stroke_' + Date.now(),
          points: [{ x: locationX, y: locationY }],
          color: selectedColor,
          width: toolMode === 'highlighter' ? 24 : toolMode === 'fountain' ? selectedWidth * 1.3 : selectedWidth,
          tool: toolMode,
          isRuler: isRulerMode,
        };
        setCurrentNativeStroke(newStroke);
      },
      onPanResponderMove: (evt: GestureResponderEvent) => {
        const { locationX, locationY } = evt.nativeEvent;
        setCurrentNativeStroke((prev) => {
          if (!prev) return null;
          if (prev.isRuler) {
            return {
              ...prev,
              points: [prev.points[0], { x: locationX, y: locationY }],
            };
          }
          return {
            ...prev,
            points: [...prev.points, { x: locationX, y: locationY }],
          };
        });
      },
      onPanResponderRelease: () => {
        setCurrentNativeStroke((active) => {
          if (active && active.points.length > 0) {
            setNativeStrokes((prev) => {
              setUndoHistory((hist) => [...hist, prev]);
              if (active.tool === 'eraser') {
                const targetPoint = active.points[0];
                return prev.filter((s) => {
                  return !s.points.some(
                    (p) => Math.hypot(p.x - targetPoint.x, p.y - targetPoint.y) < 25
                  );
                });
              }
              return [...prev, active];
            });
          }
          return null;
        });
      },
    })
  ).current;

  if (!visible) return null;

  // Web Mouse/Touch Event Handlers
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

    if (webHistoryRef.current.length > 25) {
      webHistoryRef.current.shift();
    }
    webHistoryRef.current.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
  };

  const handleUndo = () => {
    if (Platform.OS === 'web') {
      const canvas = canvasRef.current;
      if (!canvas || webHistoryRef.current.length <= 1) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      webHistoryRef.current.pop();
      const previous = webHistoryRef.current[webHistoryRef.current.length - 1];
      if (previous) {
        ctx.putImageData(previous, 0, 0);
      }
    } else {
      if (undoHistory.length === 0) {
        setNativeStrokes([]);
        return;
      }
      const prev = undoHistory[undoHistory.length - 1];
      setUndoHistory((h) => h.slice(0, h.length - 1));
      setNativeStrokes(prev);
    }
  };

  const handleClear = () => {
    if (Platform.OS === 'web') {
      redrawCanvasWithTemplate(drawingPaper);
    } else {
      setUndoHistory((h) => [...h, nativeStrokes]);
      setNativeStrokes([]);
    }
  };

  const generateSvgXmlString = (width: number, height: number) => {
    let bgSvg = '';
    if (drawingPaper === 'lined') {
      for (let y = 30; y < height; y += 28) {
        bgSvg += `<line x1="10" y1="${y}" x2="${width - 10}" y2="${y}" stroke="rgba(15, 23, 42, 0.08)" stroke-width="1" />`;
      }
    } else if (drawingPaper === 'grid') {
      for (let x = 20; x < width; x += 24) {
        bgSvg += `<line x1="${x}" y1="0" x2="${x}" y2="${height}" stroke="rgba(15, 23, 42, 0.07)" stroke-width="1" />`;
      }
      for (let y = 20; y < height; y += 24) {
        bgSvg += `<line x1="0" y1="${y}" x2="${width}" y2="${y}" stroke="rgba(15, 23, 42, 0.07)" stroke-width="1" />`;
      }
    } else if (drawingPaper === 'dot') {
      for (let x = 16; x < width; x += 22) {
        for (let y = 16; y < height; y += 22) {
          bgSvg += `<circle cx="${x}" cy="${y}" r="1.2" fill="rgba(15, 23, 42, 0.16)" />`;
        }
      }
    }

    const strokesSvg = nativeStrokes
      .map((s) => {
        const d = strokePointsToPath(s.points, s.isRuler);
        const opacity = s.tool === 'highlighter' ? '0.35' : '1.0';
        const strokeCol = s.tool === 'eraser' ? '#FFFFFF' : s.color;
        return `<path d="${d}" stroke="${strokeCol}" stroke-width="${s.width}" stroke-linecap="round" stroke-linejoin="round" fill="none" opacity="${opacity}" />`;
      })
      .join('');

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <rect width="100%" height="100%" fill="#FFFFFF" />
      ${bgSvg}
      ${strokesSvg}
    </svg>`;
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
      // 모바일 네이티브: 실제 SVG 벡터 데이터 생성하여 첨부
      const width = canvasLayout.width || 340;
      const height = canvasLayout.height || 320;
      const svgXml = generateSvgXmlString(width, height);
      const dataUrl = `data:image/svg+xml;utf8,${encodeURIComponent(svgXml)}`;

      const drawingImage: NoteImage = {
        id: 'drawing_' + Date.now(),
        uri: dataUrl,
        size: 'medium',
        placement: 'inline',
        wrapMode: 'break',
        customWidth: width,
        customHeight: height,
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
          <View
            style={styles.canvasContainer}
            onLayout={(e) => {
              const { width, height } = e.nativeEvent.layout;
              if (width > 0 && height > 0) {
                setCanvasLayout({ width: Math.round(width), height: Math.round(height) });
              }
            }}
          >
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
              <View
                style={styles.nativeCanvasArea}
                {...panResponder.panHandlers}
              >
                <Svg
                  width={canvasLayout.width}
                  height={canvasLayout.height}
                  style={StyleSheet.absoluteFillObject}
                >
                  {/* Paper Background */}
                  <Rect width="100%" height="100%" fill="#FFFFFF" />
                  {drawingPaper === 'lined' &&
                    Array.from({ length: Math.floor(canvasLayout.height / 28) }).map((_, i) => (
                      <Line
                        key={i}
                        x1={10}
                        y1={30 + i * 28}
                        x2={canvasLayout.width - 10}
                        y2={30 + i * 28}
                        stroke="rgba(15, 23, 42, 0.08)"
                        strokeWidth={1}
                      />
                    ))}
                  {drawingPaper === 'grid' && (
                    <>
                      {Array.from({ length: Math.floor(canvasLayout.width / 24) }).map((_, i) => (
                        <Line
                          key={'gx_' + i}
                          x1={20 + i * 24}
                          y1={0}
                          x2={20 + i * 24}
                          y2={canvasLayout.height}
                          stroke="rgba(15, 23, 42, 0.07)"
                          strokeWidth={1}
                        />
                      ))}
                      {Array.from({ length: Math.floor(canvasLayout.height / 24) }).map((_, i) => (
                        <Line
                          key={'gy_' + i}
                          x1={0}
                          y1={20 + i * 24}
                          x2={canvasLayout.width}
                          y2={20 + i * 24}
                          stroke="rgba(15, 23, 42, 0.07)"
                          strokeWidth={1}
                        />
                      ))}
                    </>
                  )}
                  {drawingPaper === 'dot' &&
                    Array.from({ length: Math.floor(canvasLayout.width / 22) }).map((_, xi) =>
                      Array.from({ length: Math.floor(canvasLayout.height / 22) }).map((_, yi) => (
                        <Circle
                          key={`d_${xi}_${yi}`}
                          cx={16 + xi * 22}
                          cy={16 + yi * 22}
                          r={1.2}
                          fill="rgba(15, 23, 42, 0.16)"
                        />
                      ))
                    )}

                  {/* Saved Strokes */}
                  {nativeStrokes.map((s, idx) => {
                    const d = strokePointsToPath(s.points, s.isRuler);
                    if (!d) return null;
                    return (
                      <SvgPath
                        key={s.id || idx}
                        d={d}
                        stroke={s.tool === 'eraser' ? '#FFFFFF' : s.color}
                        strokeWidth={s.width}
                        strokeOpacity={s.tool === 'highlighter' ? 0.35 : 1.0}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        fill="none"
                      />
                    );
                  })}

                  {/* Current Active Stroke */}
                  {currentNativeStroke && (
                    <SvgPath
                      d={strokePointsToPath(currentNativeStroke.points, currentNativeStroke.isRuler)}
                      stroke={currentNativeStroke.tool === 'eraser' ? '#FFFFFF' : currentNativeStroke.color}
                      strokeWidth={currentNativeStroke.width}
                      strokeOpacity={currentNativeStroke.tool === 'highlighter' ? 0.35 : 1.0}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      fill="none"
                    />
                  )}
                </Svg>
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
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  headerSubtitle: {
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  paperSelectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
    flexWrap: 'wrap',
  },
  paperSelectLabel: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#64748B',
    marginRight: 2,
  },
  paperChip: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  paperChipActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    marginLeft: 'auto',
  },
  rulerToggleBtnActive: {
    backgroundColor: '#0F172A',
    borderColor: '#0F172A',
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
    borderWidth: 1,
    borderColor: '#E2E8F0',
    flexWrap: 'wrap',
    gap: 8,
  },
  toolModeGroup: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 2,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  toolBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
  },
  toolBtnActive: {
    backgroundColor: '#EFF6FF',
  },
  toolBtnText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#64748B',
  },
  toolBtnTextActive: {
    color: '#2563EB',
    fontWeight: '700',
  },
  strokeWidthGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    padding: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  strokeBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  strokeBtnActive: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#93C5FD',
  },
  strokeDot: {
    borderRadius: 10,
  },
  colorPaletteGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  colorDotBtn: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorDotBtnSelected: {
    borderColor: '#0F172A',
    transform: [{ scale: 1.15 }],
  },
  actionGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionIconBtn: {
    width: 30,
    height: 30,
    borderRadius: 7,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  canvasContainer: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    marginVertical: 4,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 320,
    width: '100%',
  },
  nativeCanvasArea: {
    width: '100%',
    height: 320,
    backgroundColor: '#FFFFFF',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  cancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#2563EB',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 10,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  saveBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
