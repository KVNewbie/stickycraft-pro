import React, { useRef, useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import {
  View,
  StyleSheet,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  Image as RNImage,
  ScrollView,
  PanResponder,
  GestureResponderEvent,
  Dimensions,
} from 'react-native';
import Svg, { Path as SvgPath } from 'react-native-svg';
import { ActiveToolType } from './ProToolbar';
import { PaperTemplatePattern } from './PaperTemplatePattern';
import { PaperTemplate, FreeTextBox, NoteImage, AudioNote, FreeHandStroke } from '../types/note';
import { AudioPlayerBar } from './AudioPlayerBar';
import { X, Check, Move, Maximize2, Mic, Image as ImageIcon, Volume2 } from 'lucide-react-native';
import { recognizeShape, tryRecognizeMultiStroke } from '../utils/shapeRecognizer';

export interface FreeCanvasEditorRef {
  undo: () => void;
  redo: () => void;
  clear: () => void;
  pasteSnippet: (snippetDataUrl: string) => void;
  addImage: (imageUri: string) => void;
  addAudio: (audio: AudioNote) => void;
}

interface FreeCanvasEditorProps {
  initialDrawingData?: string;
  initialStrokes?: FreeHandStroke[];
  paperTemplate?: PaperTemplate;
  selectedTool: ActiveToolType;
  currentColor: string;
  currentWidth: number;
  isRulerActive: boolean;
  onUpdateDrawing?: (dataUrl: string) => void;
  onUpdateStrokes?: (strokes: FreeHandStroke[]) => void;
  canUndoState?: (canUndo: boolean, canRedo: boolean) => void;

  // 자유 캔버스 위 사진/캡처본 & 음성 녹음
  images: NoteImage[];
  onUpdateImages: (images: NoteImage[]) => void;
  audioNotes: AudioNote[];
  onUpdateAudioNotes: (audios: AudioNote[]) => void;
}

interface StrokePoint {
  x: number;
  y: number;
}

interface Stroke {
  id: string;
  points: StrokePoint[];
  color: string;
  width: number;
  tool: ActiveToolType;
  isRuler?: boolean;
  isPolygon?: boolean;
  shapeType?: 'rect' | 'circle' | 'arrow' | 'line' | 'triangle';
}

const mapShapeType = (t: string | null): 'rect' | 'circle' | 'line' | 'triangle' | undefined => {
  if (t === 'rectangle') return 'rect';
  if (t === 'circle') return 'circle';
  if (t === 'line') return 'line';
  if (t === 'triangle') return 'triangle';
  return undefined;
};

export const FreeCanvasEditor = forwardRef<FreeCanvasEditorRef, FreeCanvasEditorProps>(
  (
    {
      initialDrawingData,
      initialStrokes = [],
      paperTemplate = 'blank',
      selectedTool,
      currentColor,
      currentWidth,
      isRulerActive,
      onUpdateDrawing,
      onUpdateStrokes,
      canUndoState,
      images,
      onUpdateImages,
      audioNotes,
      onUpdateAudioNotes,
    },
    ref
  ) => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);

    const [strokes, setStrokes] = useState<Stroke[]>(initialStrokes as Stroke[]);
    const [redoStack, setRedoStack] = useState<Stroke[]>([]);
    const [currentStroke, setCurrentStroke] = useState<Stroke | null>(null);

    // 텍스트 상자 목록
    const [textBoxes, setTextBoxes] = useState<FreeTextBox[]>([]);
    const [activeTextId, setActiveTextId] = useState<string | null>(null);

    // 선택된 이미지/캡처본 카드 (크기 조절 및 조작용)
    const [selectedImgId, setSelectedImgId] = useState<string | null>(null);

    // 캔버스 크기 (기본 A4 비율)
    const canvasWidth = 820;
    const canvasHeight = 1160;

    // Undo / Redo 상위 보고 및 스트로크 영속 동기화
    useEffect(() => {
      if (canUndoState) {
        canUndoState(strokes.length > 0, redoStack.length > 0);
      }
      if (onUpdateStrokes) {
        onUpdateStrokes(strokes as any);
      }
    }, [strokes, redoStack]);

    const handleUndo = () => {
      if (strokes.length === 0) return;
      const last = strokes[strokes.length - 1];
      const nextStrokes = strokes.slice(0, strokes.length - 1);
      setStrokes(nextStrokes);
      setRedoStack((prev) => [...prev, last]);
    };

    const handleRedo = () => {
      if (redoStack.length === 0) return;
      const next = redoStack[redoStack.length - 1];
      setRedoStack((prev) => prev.slice(0, prev.length - 1));
      setStrokes((prev) => [...prev, next]);
    };

    useImperativeHandle(ref, () => ({
      undo: handleUndo,
      redo: handleRedo,
      clear: () => {
        setStrokes([]);
        setRedoStack([]);
        setTextBoxes([]);
        if (onUpdateStrokes) onUpdateStrokes([]);
      },
      pasteSnippet: (snippetDataUrl: string) => {
        const newImg: NoteImage = {
          id: 'snip_' + Date.now(),
          uri: snippetDataUrl,
          x: 100,
          y: 180,
          customWidth: 340,
          customHeight: 240,
          caption: '캔버스 캡처본',
        };
        onUpdateImages([...images, newImg]);
        setSelectedImgId(newImg.id);
      },
      addImage: (imageUri: string) => {
        const newImg: NoteImage = {
          id: 'img_' + Date.now(),
          uri: imageUri,
          x: 80,
          y: 140,
          customWidth: 320,
          customHeight: 240,
          caption: '첨부 사진',
        };
        onUpdateImages([...images, newImg]);
        setSelectedImgId(newImg.id);
      },
      addAudio: (audio: AudioNote) => {
        onUpdateAudioNotes([...audioNotes, audio]);
      },
    }));

    // 웹 HTML5 캔버스 렌더링 (베지어 곡선 보간)
    const redrawCanvas = () => {
      if (Platform.OS !== 'web') return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (const stroke of strokes) {
        if (stroke.points.length === 0) continue;

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(stroke.points[0].x, stroke.points[0].y);

        if (stroke.tool === 'highlighter') {
          ctx.globalAlpha = 0.4;
          ctx.strokeStyle = stroke.color;
          ctx.lineWidth = stroke.width * 2.5;
          ctx.lineCap = 'square';
          ctx.lineJoin = 'miter';
        } else {
          ctx.globalAlpha = 1.0;
          ctx.strokeStyle = stroke.color;
          ctx.lineWidth = stroke.tool === 'fountain' ? stroke.width * 1.3 : stroke.width;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
        }

        if (stroke.isRuler || stroke.points.length === 2) {
          const last = stroke.points[stroke.points.length - 1];
          ctx.lineTo(last.x, last.y);
        } else {
          // Quadratic Bézier curve smoothing
          for (let i = 1; i < stroke.points.length - 1; i++) {
            const xc = (stroke.points[i].x + stroke.points[i + 1].x) / 2;
            const yc = (stroke.points[i].y + stroke.points[i + 1].y) / 2;
            ctx.quadraticCurveTo(stroke.points[i].x, stroke.points[i].y, xc, yc);
          }
          const last = stroke.points[stroke.points.length - 1];
          ctx.lineTo(last.x, last.y);
        }

        ctx.stroke();
        ctx.restore();
      }

      if (onUpdateDrawing) {
        try {
          const dataUrl = canvas.toDataURL('image/png');
          onUpdateDrawing(dataUrl);
        } catch (e) {
          // ignore
        }
      }
    };

    useEffect(() => {
      redrawCanvas();
    }, [strokes]);

    // 스트로크를 Quadratic Bézier SVG Path 또는 직선 다각형으로 변환 (모바일/웹 네이티브 렌더링용)
    const strokeToSvgPath = (stroke: Stroke) => {
      const points = stroke.points;
      if (!points || points.length === 0) return '';
      if ((stroke.isRuler || points.length === 2) && points.length >= 2) {
        const first = points[0];
        const last = points[points.length - 1];
        return `M ${first.x} ${first.y} L ${last.x} ${last.y}`;
      }

      // 원형 (Circle / Ellipse): 수학적으로 정확한 SVG Arc 명령어로 매끄럽게 렌더링
      if (stroke.shapeType === 'circle') {
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        for (const p of points) {
          if (p.x < minX) minX = p.x;
          if (p.x > maxX) maxX = p.x;
          if (p.y < minY) minY = p.y;
          if (p.y > maxY) maxY = p.y;
        }
        const cx = (minX + maxX) / 2;
        const cy = (minY + maxY) / 2;
        const rx = Math.max(2, (maxX - minX) / 2);
        const ry = Math.max(2, (maxY - minY) / 2);
        return `M ${cx - rx} ${cy} A ${rx} ${ry} 0 1 0 ${cx + rx} ${cy} A ${rx} ${ry} 0 1 0 ${cx - rx} ${cy} Z`;
      }

      // 직사각형, 삼각형 등 다각형이거나 끝점과 시작점이 일치하는 닫힌 다각형 점군인 경우
      const isClosedPoly =
        stroke.isPolygon ||
        stroke.shapeType === 'rect' ||
        stroke.shapeType === 'triangle' ||
        (points.length >= 4 &&
          points.length <= 8 &&
          Math.hypot(points[0].x - points[points.length - 1].x, points[0].y - points[points.length - 1].y) < 2);

      if (isClosedPoly) {
        let polyPath = `M ${points[0].x} ${points[0].y}`;
        for (let i = 1; i < points.length; i++) {
          polyPath += ` L ${points[i].x} ${points[i].y}`;
        }
        return polyPath + ' Z';
      }

      if (points.length === 1) {
        return `M ${points[0].x} ${points[0].y} L ${points[0].x + 0.5} ${points[0].y + 0.5}`;
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

    // 모바일 터치 제스처 (PanResponder)
    const panResponder = useRef(
      PanResponder.create({
        onStartShouldSetPanResponder: () => selectedTool !== 'text',
        onMoveShouldSetPanResponder: () => selectedTool !== 'text',
        onPanResponderGrant: (evt: GestureResponderEvent) => {
          const { locationX, locationY } = evt.nativeEvent;
          if (selectedTool === 'eraser') {
            setStrokes((prev) =>
              prev.filter(
                (st) =>
                  !st.points.some((p) => Math.hypot(p.x - locationX, p.y - locationY) < 24)
              )
            );
            return;
          }
          const newStroke: Stroke = {
            id: 'str_' + Date.now(),
            points: [{ x: locationX, y: locationY }],
            color: currentColor,
            width: currentWidth,
            tool: selectedTool,
            isRuler: isRulerActive,
          };
          setCurrentStroke(newStroke);
        },
        onPanResponderMove: (evt: GestureResponderEvent) => {
          const { locationX, locationY } = evt.nativeEvent;
          if (selectedTool === 'eraser') {
            setStrokes((prev) =>
              prev.filter(
                (st) =>
                  !st.points.some((p) => Math.hypot(p.x - locationX, p.y - locationY) < 24)
              )
            );
            return;
          }
          setCurrentStroke((prev) => {
            if (!prev) return null;
            return { ...prev, points: [...prev.points, { x: locationX, y: locationY }] };
          });
        },
        onPanResponderRelease: () => {
          if (currentStroke && currentStroke.points.length > 1) {
            let finalStroke = currentStroke;

            // Notewise & Goodnotes 스마트 도형 자동 인식 (선, 사각형, 원)
            if (selectedTool === 'shape' || isRulerActive) {
              const multiResult = tryRecognizeMultiStroke(strokes, currentStroke, 50);
              if (multiResult) {
                const { recognized, mergedStrokeIds } = multiResult;
                const mergedIdSet = new Set(mergedStrokeIds);
                const mergedStroke: Stroke = {
                  ...currentStroke,
                  id: 'shape_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
                  points: recognized.points,
                  isRuler: recognized.type === 'line',
                  shapeType: mapShapeType(recognized.type),
                  isPolygon: recognized.isPolygon ?? (recognized.type === 'rectangle' || recognized.type === 'triangle'),
                };
                const remaining = strokes.filter((s) => !mergedIdSet.has(s.id));
                const updated = [...remaining, mergedStroke];
                setStrokes(updated);
                setRedoStack([]);
                if (onUpdateStrokes) onUpdateStrokes(updated as any);
                setCurrentStroke(null);
                return;
              }

              const recognized = recognizeShape(currentStroke.points);
              if (recognized) {
                finalStroke = {
                  ...currentStroke,
                  points: recognized.points,
                  isRuler: recognized.type === 'line',
                  shapeType: mapShapeType(recognized.type),
                  isPolygon: recognized.isPolygon ?? (recognized.type === 'rectangle' || recognized.type === 'triangle'),
                };
              }
            }

            const updated = [...strokes, finalStroke];
            setStrokes(updated);
            setRedoStack([]);
            if (onUpdateStrokes) onUpdateStrokes(updated as any);
          }
          setCurrentStroke(null);
        },
      })
    ).current;

    return (
      <View style={styles.container}>
        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={styles.scrollContent}
          horizontal={Platform.OS === 'web'}
          showsVerticalScrollIndicator={true}
          showsHorizontalScrollIndicator={true}
        >
          {/* 가상 양식 용지 (A4 비율 노트 시트) */}
          <View
            style={[
              styles.paperSheet,
              { width: canvasWidth, minHeight: canvasHeight },
              paperTemplate === 'dark' && { backgroundColor: '#1E293B' },
            ]}
          >
            {/* 1. 속지 패턴 배경 */}
            <PaperTemplatePattern template={paperTemplate} />

            {/* 2. 캔버스 상단 음성 녹음 메모 섹션 (Audio Notes) */}
            {audioNotes.length > 0 && (
              <View style={styles.audioSection}>
                <View style={styles.audioSectionHeader}>
                  <Volume2 size={15} color="#2563eb" />
                  <Text style={styles.audioSectionTitle}>
                    첨부된 음성 녹음 메모 ({audioNotes.length}개)
                  </Text>
                </View>
                {audioNotes.map((audio, idx) => (
                  <AudioPlayerBar
                    key={audio.id}
                    audio={audio}
                    index={idx}
                    totalCount={audioNotes.length}
                    isPdfNote={false}
                    onDelete={() => onUpdateAudioNotes(audioNotes.filter((a) => a.id !== audio.id))}
                    onUpdateTitle={(newTitle) =>
                      onUpdateAudioNotes(
                        audioNotes.map((a) => (a.id === audio.id ? { ...a, title: newTitle } : a))
                      )
                    }
                    accentColor="#2563eb"
                  />
                ))}
              </View>
            )}

            {/* 3. 캔버스 위 사진 & 캡처본 레이어 (Images & Snippets) */}
            {images.map((img, idx) => {
              const imgX = img.x ?? 60 + (idx % 3) * 40;
              const imgY = img.y ?? 100 + (idx % 4) * 50;
              const imgW = img.customWidth ?? 320;
              const imgH = img.customHeight ?? 240;
              const isSelected = selectedImgId === img.id;

              return (
                <View
                  key={img.id}
                  style={[
                    styles.imageCard,
                    {
                      left: imgX,
                      top: imgY,
                      width: imgW,
                      height: imgH,
                      zIndex: isSelected ? 22 : 15,
                      borderColor: isSelected ? '#2563eb' : 'rgba(0,0,0,0.15)',
                      borderWidth: isSelected ? 2 : 1,
                    },
                  ]}
                >
                  {/* 상단 컨트롤 바 (헤더 & 삭제) */}
                  <View
                    style={[
                      styles.imageCardHeader,
                      { backgroundColor: isSelected ? '#2563eb' : 'rgba(15, 23, 42, 0.8)' },
                    ]}
                  >
                    <View style={styles.imageCardTitleRow}>
                      <Move size={12} color="#ffffff" />
                      <Text style={styles.imageCardTitle} numberOfLines={1}>
                        {img.caption || '사진 / 캡처본'}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => onUpdateImages(images.filter((i) => i.id !== img.id))}
                      style={styles.imageDeleteBtn}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <X size={14} color="#ffffff" />
                    </TouchableOpacity>
                  </View>

                  {/* 네이티브 & 웹 공통 이미지 컴포넌트 */}
                  <RNImage
                    source={{ uri: img.uri }}
                    style={styles.imageElement}
                    resizeMode="contain"
                  />
                </View>
              );
            })}

            {/* 4. 손글씨 필기 & 주석 투명 캔버스 레이어 */}
            {/* 웹: HTML5 Canvas */}
            {Platform.OS === 'web' && (
              <canvas
                ref={canvasRef as any}
                width={canvasWidth}
                height={canvasHeight}
                onPointerDown={(e: any) => {
                  if (selectedTool === 'text') return;
                  const rect = e.currentTarget.getBoundingClientRect();
                  const x = e.clientX - rect.left;
                  const y = e.clientY - rect.top;

                  if (selectedTool === 'eraser') {
                    setStrokes((prev) =>
                      prev.filter(
                        (st) => !st.points.some((p) => Math.hypot(p.x - x, p.y - y) < 24)
                      )
                    );
                    return;
                  }

                  const newStroke: Stroke = {
                    id: 'str_' + Date.now(),
                    points: [{ x, y }],
                    color: currentColor,
                    width: currentWidth,
                    tool: selectedTool,
                    isRuler: isRulerActive,
                  };
                  setCurrentStroke(newStroke);
                }}
                onPointerMove={(e: any) => {
                  if (!currentStroke) return;
                  const rect = e.currentTarget.getBoundingClientRect();
                  const x = e.clientX - rect.left;
                  const y = e.clientY - rect.top;

                  setCurrentStroke((prev) => {
                    if (!prev) return null;
                    return { ...prev, points: [...prev.points, { x, y }] };
                  });
                }}
                onPointerUp={() => {
                  if (currentStroke && currentStroke.points.length > 1) {
                    let finalStroke = currentStroke;

                    if (selectedTool === 'shape' || isRulerActive) {
                      const multiResult = tryRecognizeMultiStroke(strokes, currentStroke, 50);
                      if (multiResult) {
                        const { recognized, mergedStrokeIds } = multiResult;
                        const mergedIdSet = new Set(mergedStrokeIds);
                        const mergedStroke: Stroke = {
                          ...currentStroke,
                          id: 'shape_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
                          points: recognized.points,
                          isRuler: recognized.type === 'line',
                          shapeType: mapShapeType(recognized.type),
                          isPolygon: recognized.isPolygon ?? (recognized.type === 'rectangle' || recognized.type === 'triangle'),
                        };
                        const remaining = strokes.filter((s) => !mergedIdSet.has(s.id));
                        const updated = [...remaining, mergedStroke];
                        setStrokes(updated);
                        setRedoStack([]);
                        if (onUpdateStrokes) onUpdateStrokes(updated as any);
                        setCurrentStroke(null);
                        return;
                      }

                      const recognized = recognizeShape(currentStroke.points);
                      if (recognized) {
                        finalStroke = {
                          ...currentStroke,
                          points: recognized.points,
                          isRuler: recognized.type === 'line',
                          shapeType: mapShapeType(recognized.type),
                          isPolygon: recognized.isPolygon ?? (recognized.type === 'rectangle' || recognized.type === 'triangle'),
                        };
                      }
                    }

                    const updated = [...strokes, finalStroke];
                    setStrokes(updated);
                    setRedoStack([]);
                    if (onUpdateStrokes) onUpdateStrokes(updated as any);
                  }
                  setCurrentStroke(null);
                }}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  touchAction: 'none',
                  cursor: selectedTool === 'text' ? 'text' : 'crosshair',
                  zIndex: 20,
                }}
              />
            )}

            {/* 모바일(iOS/Android): 네이티브 SVG 필기 레이어 */}
            {Platform.OS !== 'web' && (
              <View
                style={[StyleSheet.absoluteFill, { zIndex: 20 }]}
                {...panResponder.panHandlers}
              >
                <Svg width={canvasWidth} height={canvasHeight}>
                  {strokes.map((stroke) => (
                    <SvgPath
                      key={stroke.id}
                      d={strokeToSvgPath(stroke)}
                      stroke={stroke.color}
                      strokeWidth={
                        stroke.tool === 'highlighter'
                          ? stroke.width * 2.5
                          : stroke.tool === 'fountain'
                          ? stroke.width * 1.3
                          : stroke.width
                      }
                      strokeOpacity={stroke.tool === 'highlighter' ? 0.4 : 1.0}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      fill="none"
                    />
                  ))}
                  {currentStroke && (
                    <SvgPath
                      d={strokeToSvgPath(currentStroke)}
                      stroke={currentStroke.color}
                      strokeWidth={
                        currentStroke.tool === 'highlighter'
                          ? currentStroke.width * 2.5
                          : currentStroke.width
                      }
                      strokeOpacity={currentStroke.tool === 'highlighter' ? 0.4 : 1.0}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      fill="none"
                    />
                  )}
                </Svg>
              </View>
            )}

            {/* 5. 자유 텍스트 상자 오버레이 */}
            {textBoxes.map((box) => (
              <View
                key={box.id}
                style={[
                  styles.textBoxCard,
                  {
                    left: box.x,
                    top: box.y,
                    borderColor: activeTextId === box.id ? '#3b82f6' : 'transparent',
                  },
                ]}
              >
                <TextInput
                  value={box.text}
                  onChangeText={(val) => {
                    setTextBoxes((prev) =>
                      prev.map((b) => (b.id === box.id ? { ...b, text: val } : b))
                    );
                  }}
                  onFocus={() => setActiveTextId(box.id)}
                  style={styles.textInputStyle}
                  multiline
                  placeholder="텍스트 입력..."
                  placeholderTextColor="#94a3b8"
                />
                <TouchableOpacity
                  onPress={() => setTextBoxes((prev) => prev.filter((b) => b.id !== box.id))}
                  style={styles.textDeleteBtn}
                >
                  <X size={12} color="#dc2626" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </ScrollView>
      </View>
    );
  }
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#cbd5e1',
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '100%',
  },
  paperSheet: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
    position: 'relative',
    overflow: 'hidden',
  },
  audioSection: {
    margin: 16,
    padding: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    zIndex: 10,
  },
  audioSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  audioSectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  imageCard: {
    position: 'absolute',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  imageCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  imageCardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  imageCardTitle: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#ffffff',
  },
  imageDeleteBtn: {
    padding: 2,
  },
  imageElement: {
    width: '100%',
    height: '100%',
    backgroundColor: '#f1f5f9',
  },
  textBoxCard: {
    position: 'absolute',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 8,
    padding: 6,
    minWidth: 120,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
    zIndex: 25,
  },
  textInputStyle: {
    fontSize: 14,
    color: '#0f172a',
    padding: 4,
    minHeight: 30,
  },
  textDeleteBtn: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#fee2e2',
    borderRadius: 8,
    padding: 3,
    borderWidth: 1,
    borderColor: '#fca5a5',
  },
});
