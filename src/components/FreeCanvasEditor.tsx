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
import { PaperTemplate, FreeTextBox, NoteImage, AudioNote } from '../types/note';
import { AudioPlayerBar } from './AudioPlayerBar';
import { X, Check, Move, Maximize2, Mic, Image as ImageIcon, Volume2 } from 'lucide-react-native';

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
  paperTemplate?: PaperTemplate;
  selectedTool: ActiveToolType;
  currentColor: string;
  currentWidth: number;
  isRulerActive: boolean;
  onUpdateDrawing: (dataUrl: string) => void;
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
}

export const FreeCanvasEditor = forwardRef<FreeCanvasEditorRef, FreeCanvasEditorProps>(
  (
    {
      initialDrawingData,
      paperTemplate = 'blank',
      selectedTool,
      currentColor,
      currentWidth,
      isRulerActive,
      onUpdateDrawing,
      canUndoState,
      images,
      onUpdateImages,
      audioNotes,
      onUpdateAudioNotes,
    },
    ref
  ) => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);

    const [strokes, setStrokes] = useState<Stroke[]>([]);
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

    // Undo / Redo 상위 보고
    useEffect(() => {
      if (canUndoState) {
        canUndoState(strokes.length > 0, redoStack.length > 0);
      }
    }, [strokes, redoStack]);

    const handleUndo = () => {
      if (strokes.length === 0) return;
      const last = strokes[strokes.length - 1];
      setStrokes((prev) => prev.slice(0, prev.length - 1));
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

    // 웹 HTML5 캔버스 렌더링
    const redrawCanvas = () => {
      if (Platform.OS !== 'web') return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (const stroke of strokes) {
        if (stroke.points.length < 2) continue;

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(stroke.points[0].x, stroke.points[0].y);

        if (stroke.tool === 'highlighter') {
          ctx.globalAlpha = 0.45;
          ctx.strokeStyle = stroke.color;
          ctx.lineWidth = stroke.width * 2.5;
          ctx.lineCap = 'square';
        } else {
          ctx.globalAlpha = 1.0;
          ctx.strokeStyle = stroke.color;
          ctx.lineWidth = stroke.tool === 'fountain' ? stroke.width * 1.3 : stroke.width;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
        }

        if (stroke.isRuler) {
          const last = stroke.points[stroke.points.length - 1];
          ctx.lineTo(last.x, last.y);
        } else {
          for (let i = 1; i < stroke.points.length; i++) {
            ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
          }
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

    // 스트로크를 SVG Path로 변환 (모바일 네이티브 렌더링용)
    const strokeToSvgPath = (stroke: Stroke) => {
      if (stroke.points.length === 0) return '';
      if (stroke.isRuler && stroke.points.length >= 2) {
        const first = stroke.points[0];
        const last = stroke.points[stroke.points.length - 1];
        return `M ${first.x} ${first.y} L ${last.x} ${last.y}`;
      }
      return stroke.points.reduce((acc, pt, i) => {
        return i === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`;
      }, '');
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
              prev.filter((st) => !st.points.some((p) => Math.hypot(p.x - locationX, p.y - locationY) < 22))
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
              prev.filter((st) => !st.points.some((p) => Math.hypot(p.x - locationX, p.y - locationY) < 22))
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
            setStrokes((prev) => [...prev, currentStroke]);
            setRedoStack([]);
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
          <View style={[styles.paperSheet, { width: canvasWidth, minHeight: canvasHeight }]}>
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
                {audioNotes.map((audio) => (
                  <AudioPlayerBar
                    key={audio.id}
                    audio={audio}
                    onDelete={() => onUpdateAudioNotes(audioNotes.filter((a) => a.id !== audio.id))}
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
                      prev.filter((st) => !st.points.some((p) => Math.hypot(p.x - x, p.y - y) < 22))
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
                    setStrokes((prev) => [...prev, currentStroke]);
                    setRedoStack([]);
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
                      strokeOpacity={stroke.tool === 'highlighter' ? 0.45 : 1.0}
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
                      strokeOpacity={currentStroke.tool === 'highlighter' ? 0.45 : 1.0}
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
  },
  paperSheet: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 6,
  },
  audioSection: {
    position: 'relative',
    zIndex: 25,
    marginHorizontal: 20,
    marginTop: 14,
    marginBottom: 8,
    gap: 8,
  },
  audioSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  audioSectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1e293b',
  },
  imageCard: {
    position: 'absolute',
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  },
  imageCardHeader: {
    height: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  imageCardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  imageCardTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#ffffff',
  },
  imageDeleteBtn: {
    padding: 2,
  },
  imageElement: {
    flex: 1,
    width: '100%',
    backgroundColor: '#f8fafc',
  },
  textBoxCard: {
    position: 'absolute',
    zIndex: 25,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 120,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  textInputStyle: {
    fontSize: 14,
    color: '#0f172a',
    padding: 0,
    flex: 1,
  },
  textDeleteBtn: {
    padding: 2,
    marginLeft: 6,
  },
});
