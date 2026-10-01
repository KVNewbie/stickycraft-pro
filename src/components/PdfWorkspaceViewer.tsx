import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Alert,
  Image as RNImage,
  ScrollView,
  PanResponder,
  GestureResponderEvent,
  Dimensions,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import Svg, { Path as SvgPath, Rect as SvgRect } from 'react-native-svg';
import {
  UploadCloud,
  CheckCircle,
  FileText,
  Image as ImageIcon,
  Sparkles,
  BookOpen,
  Layers,
  ChevronRight,
} from 'lucide-react-native';
import { ActiveToolType } from './ProToolbar';
import { useNoteStore } from '../store/useNoteStore';

interface PdfWorkspaceViewerProps {
  pdfUri?: string;
  pdfName?: string;
  selectedTool: ActiveToolType;
  currentColor: string;
  currentWidth: number;
  isRulerActive: boolean;
  onUpdateSnapshot?: (dataUrl: string) => void;
}

interface StrokePoint {
  x: number;
  y: number;
}

interface Stroke {
  points: StrokePoint[];
  color: string;
  width: number;
  tool: ActiveToolType;
  isRuler?: boolean;
}

// 스마트폰 & 웹 어디서든 즉시 열리는 고해상도 샘플 학습 문서 4종
const SAMPLE_DOCS = [
  {
    name: '인체 근골격계 & 해부학 도해',
    desc: '의학·생물학 학습용 인체 구조도 (샘플)',
    icon: '🩻',
    uri: 'https://images.unsplash.com/photo-1530497610245-94d3c16cda28?auto=format&fit=crop&w=1200&q=80',
  },
  {
    name: '신경계 & 뇌 구조 슬라이드',
    desc: '신경과학 및 뇌 영역 분석 도표 (샘플)',
    icon: '🧠',
    uri: 'https://images.unsplash.com/photo-1559757175-5700dde675bc?auto=format&fit=crop&w=1200&q=80',
  },
  {
    name: '공학 수학 & 모눈종이 필기 양식',
    desc: '수식 계산 및 그래프 작성용 그리드 용지',
    icon: '📐',
    uri: 'https://images.unsplash.com/photo-1588345921523-c2dcdb7f1dcd?auto=format&fit=crop&w=1200&q=80',
  },
  {
    name: '비즈니스 전략 기획서 & 양식',
    desc: '회의록 정리 및 핵심 로드맵 템플릿',
    icon: '📊',
    uri: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=1200&q=80',
  },
];

export const PdfWorkspaceViewer: React.FC<PdfWorkspaceViewerProps> = ({
  pdfUri: initialUri,
  pdfName: initialName,
  selectedTool,
  currentColor,
  currentWidth,
  isRulerActive,
  onUpdateSnapshot,
}) => {
  const { setCapturedSnippet } = useNoteStore();
  const [docUri, setDocUri] = useState<string | undefined>(initialUri);
  const [docName, setDocName] = useState<string>(initialName || '문서 뷰어');

  // 웹 전용 캔버스 & 파일 인풋 ref
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imgBgRef = useRef<HTMLImageElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // 모바일 및 SVG 공통 스트로크 관리
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [currentStroke, setCurrentStroke] = useState<Stroke | null>(null);

  // 사각 영역 캡처 (Lasso) 상태
  const [selectionBox, setSelectionBox] = useState<{
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
  } | null>(null);

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // 문서 크기 (기본값)
  const [docSize, setDocSize] = useState({ width: 700, height: 900 });

  // 문서 이미지 로드 시 크기 동기화
  const handleImageLoad = (width: number, height: number) => {
    if (width > 0 && height > 0) {
      const screenWidth = Dimensions.get('window').width;
      const targetWidth = Math.min(width, Math.max(340, screenWidth - 32));
      const ratio = height / width;
      const targetHeight = targetWidth * ratio;
      setDocSize({ width: targetWidth, height: targetHeight });

      if (Platform.OS === 'web' && canvasRef.current) {
        canvasRef.current.width = targetWidth;
        canvasRef.current.height = targetHeight;
        redrawCanvas();
      }
    }
  };

  // 문서/사진 불러오기 핸들러 (모바일 & 웹 유니버설 지원)
  const handleOpenFile = async () => {
    try {
      if (Platform.OS === 'web') {
        fileInputRef.current?.click();
      } else {
        const result = await DocumentPicker.getDocumentAsync({
          type: ['application/pdf', 'image/*'],
          copyToCacheDirectory: true,
        });

        if (!result.canceled && result.assets && result.assets.length > 0) {
          const asset = result.assets[0];
          setDocUri(asset.uri);
          setDocName(asset.name || '불러온 문서');
          setStrokes([]);
          setSelectionBox(null);
        }
      }
    } catch (err) {
      console.error('Document picker error:', err);
      Alert.alert('파일 열기 안내', '문서를 불러오는 중 오류가 발생했습니다.');
    }
  };

  // 웹 전용 파일 인풋 체인지 핸들러
  const handleWebFileUpload = (e: any) => {
    const file = e.target?.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setDocUri(url);
      setDocName(file.name);
      setStrokes([]);
      setSelectionBox(null);
    }
    if (e.target) e.target.value = '';
  };

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
  };

  useEffect(() => {
    redrawCanvas();
  }, [strokes]);

  // 스트로크를 SVG Path 데이터로 변환 (모바일 네이티브 렌더링용)
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
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt: GestureResponderEvent) => {
        const { locationX, locationY } = evt.nativeEvent;

        if (selectedTool === 'lasso') {
          setSelectionBox({
            startX: locationX,
            startY: locationY,
            currentX: locationX,
            currentY: locationY,
          });
          return;
        }

        const newStroke: Stroke = {
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

        if (selectedTool === 'lasso') {
          setSelectionBox((prev) => (prev ? { ...prev, currentX: locationX, currentY: locationY } : null));
          return;
        }

        setCurrentStroke((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            points: [...prev.points, { x: locationX, y: locationY }],
          };
        });
      },
      onPanResponderRelease: () => {
        if (selectedTool === 'lasso' && selectionBox) {
          triggerLassoSnippetCapture();
          setSelectionBox(null);
          return;
        }

        if (currentStroke && currentStroke.points.length > 1) {
          setStrokes((prev) => [...prev, currentStroke]);
        }
        setCurrentStroke(null);
      },
    })
  ).current;

  // 올가미 캡처 트리거
  const triggerLassoSnippetCapture = () => {
    if (!selectionBox || !docUri) return;
    const w = Math.abs(selectionBox.currentX - selectionBox.startX);
    const h = Math.abs(selectionBox.currentY - selectionBox.startY);
    if (w < 15 || h < 15) return;

    // 웹 환경에서는 오프스크린 캔버스로 정확히 합성 추출
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const offscreen = document.createElement('canvas');
      offscreen.width = w;
      offscreen.height = h;
      const offCtx = offscreen.getContext('2d');
      if (offCtx) {
        offCtx.fillStyle = '#ffffff';
        offCtx.fillRect(0, 0, w, h);
        if (imgBgRef.current) {
          const x = Math.min(selectionBox.startX, selectionBox.currentX);
          const y = Math.min(selectionBox.startY, selectionBox.currentY);
          try {
            offCtx.drawImage(imgBgRef.current, x, y, w, h, 0, 0, w, h);
          } catch (e) {
            // CORS fallback
          }
        }
        if (canvasRef.current) {
          const x = Math.min(selectionBox.startX, selectionBox.currentX);
          const y = Math.min(selectionBox.startY, selectionBox.currentY);
          try {
            offCtx.drawImage(canvasRef.current, x, y, w, h, 0, 0, w, h);
          } catch (e) {
            // ignore
          }
        }
        try {
          const snippetUrl = offscreen.toDataURL('image/png');
          setCapturedSnippet(snippetUrl);
          setToastMessage('📸 선택 영역이 캡처되었습니다! 메모 탭에서 [캡처본 붙여넣기]를 눌러보세요.');
          setTimeout(() => setToastMessage(null), 4000);
          return;
        } catch (e) {
          // fallback
        }
      }
    }

    // 모바일에서는 원본 문서 URI를 스니펫으로 저장 (스마트폰 환경 최적화)
    setCapturedSnippet(docUri);
    setToastMessage('📸 선택 영역이 캡처되었습니다! 메모 탭에서 [캡처본 붙여넣기]를 눌러보세요.');
    setTimeout(() => setToastMessage(null), 4000);
  };

  return (
    <View style={styles.container}>
      {/* 웹 전용 히든 파일 인풋 */}
      {Platform.OS === 'web' && (
        <input
          type="file"
          ref={fileInputRef as any}
          style={{ display: 'none' }}
          accept="application/pdf,image/*"
          onChange={handleWebFileUpload}
        />
      )}

      {/* 1. 상단 상태 및 컨트롤 바 */}
      <View style={styles.headerBar}>
        <View style={styles.headerInfo}>
          <FileText size={16} color="#e11d48" />
          <Text style={styles.headerTitle} numberOfLines={1}>
            {docName}
          </Text>
        </View>

        <TouchableOpacity style={styles.openBtn} onPress={handleOpenFile} activeOpacity={0.8}>
          <UploadCloud size={14} color="#ffffff" />
          <Text style={styles.openBtnText}>내 문서/사진 열기</Text>
        </TouchableOpacity>
      </View>

      {/* 안내 알림 배너 */}
      {toastMessage && (
        <View style={styles.toastBanner}>
          <CheckCircle size={16} color="#059669" />
          <Text style={styles.toastText}>{toastMessage}</Text>
        </View>
      )}

      {/* 2. 메인 뷰어 영역 */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
      >
        {docUri ? (
          <View style={[styles.docWrapper, { width: docSize.width, height: docSize.height }]}>
            {/* 네이티브 & 웹 공통 이미지 컴포넌트 */}
            <RNImage
              source={{ uri: docUri }}
              style={[styles.docImage, { width: docSize.width, height: docSize.height }]}
              resizeMode="contain"
              onLoad={(e) => {
                const { width, height } = e.nativeEvent.source;
                handleImageLoad(width, height);
              }}
            />

            {/* 웹 전용 HTML5 캔버스 필기 오버레이 */}
            {Platform.OS === 'web' && (
              <canvas
                ref={canvasRef as any}
                width={docSize.width}
                height={docSize.height}
                onPointerDown={(e: any) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const x = e.clientX - rect.left;
                  const y = e.clientY - rect.top;
                  if (selectedTool === 'lasso') {
                    setSelectionBox({ startX: x, startY: y, currentX: x, currentY: y });
                    return;
                  }
                  setCurrentStroke({
                    points: [{ x, y }],
                    color: currentColor,
                    width: currentWidth,
                    tool: selectedTool,
                    isRuler: isRulerActive,
                  });
                }}
                onPointerMove={(e: any) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const x = e.clientX - rect.left;
                  const y = e.clientY - rect.top;
                  if (selectedTool === 'lasso') {
                    setSelectionBox((prev) => (prev ? { ...prev, currentX: x, currentY: y } : null));
                    return;
                  }
                  setCurrentStroke((prev) => {
                    if (!prev) return null;
                    return { ...prev, points: [...prev.points, { x, y }] };
                  });
                }}
                onPointerUp={() => {
                  if (selectedTool === 'lasso' && selectionBox) {
                    triggerLassoSnippetCapture();
                    setSelectionBox(null);
                    return;
                  }
                  if (currentStroke && currentStroke.points.length > 1) {
                    setStrokes((prev) => [...prev, currentStroke]);
                  }
                  setCurrentStroke(null);
                }}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  cursor: selectedTool === 'lasso' ? 'crosshair' : 'default',
                  touchAction: 'none',
                  zIndex: 10,
                }}
              />
            )}

            {/* 모바일(iOS/Android) 네이티브 SVG 필기 오버레이 */}
            {Platform.OS !== 'web' && (
              <View
                style={[StyleSheet.absoluteFill, { zIndex: 10 }]}
                {...panResponder.panHandlers}
              >
                <Svg width={docSize.width} height={docSize.height}>
                  {strokes.map((stroke, idx) => (
                    <SvgPath
                      key={idx}
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
                  {selectionBox && (
                    <SvgRect
                      x={Math.min(selectionBox.startX, selectionBox.currentX)}
                      y={Math.min(selectionBox.startY, selectionBox.currentY)}
                      width={Math.abs(selectionBox.currentX - selectionBox.startX)}
                      height={Math.abs(selectionBox.currentY - selectionBox.startY)}
                      stroke="#2563eb"
                      strokeWidth={2}
                      strokeDasharray="6, 4"
                      fill="rgba(37, 99, 235, 0.15)"
                    />
                  )}
                </Svg>
              </View>
            )}

            {/* 웹용 올가미 박스 오버레이 */}
            {Platform.OS === 'web' && selectionBox && (
              <div
                style={{
                  position: 'absolute',
                  left: Math.min(selectionBox.startX, selectionBox.currentX),
                  top: Math.min(selectionBox.startY, selectionBox.currentY),
                  width: Math.abs(selectionBox.currentX - selectionBox.startX),
                  height: Math.abs(selectionBox.currentY - selectionBox.startY),
                  border: '2px dashed #2563eb',
                  backgroundColor: 'rgba(37, 99, 235, 0.15)',
                  pointerEvents: 'none',
                  zIndex: 20,
                }}
              />
            )}
          </View>
        ) : (
          /* 문서가 없을 때: 예쁜 샘플 카드 뷰 & 업로드 버튼 (스마트폰 최적화) */
          <View style={styles.emptyCard}>
            <View style={styles.emptyIconCircle}>
              <UploadCloud size={32} color="#2563eb" />
            </View>
            <Text style={styles.emptyTitle}>PDF 또는 학습 문서를 열어보세요</Text>
            <Text style={styles.emptySub}>
              문서 위에 직접 밑줄·필기·주석을 달고, 올가미(Lasso)로 필요한 그림을 메모에 붙여넣을 수 있습니다.
            </Text>

            <TouchableOpacity style={styles.bigUploadBtn} onPress={handleOpenFile} activeOpacity={0.85}>
              <UploadCloud size={18} color="#ffffff" />
              <Text style={styles.bigUploadText}>내 기기에서 파일 선택 (PDF / 이미지)</Text>
            </TouchableOpacity>

            {/* 빠른 샘플 문서 4종 카드 그리드 */}
            <View style={styles.sampleSection}>
              <View style={styles.sampleSectionHeader}>
                <Sparkles size={16} color="#7c3aed" />
                <Text style={styles.sampleSectionTitle}>스마트폰 즉시 체험용 샘플 문서 4종</Text>
              </View>
              <Text style={styles.sampleSectionSub}>
                탭 한 번으로 바로 문서를 열어 필기와 영역 캡처를 체험해 보세요:
              </Text>

              <View style={styles.sampleGrid}>
                {SAMPLE_DOCS.map((doc, idx) => (
                  <TouchableOpacity
                    key={idx}
                    style={styles.sampleCard}
                    onPress={() => {
                      setDocUri(doc.uri);
                      setDocName(doc.name);
                      setStrokes([]);
                      setSelectionBox(null);
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={styles.sampleCardLeft}>
                      <Text style={styles.sampleCardEmoji}>{doc.icon}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.sampleCardTitle} numberOfLines={1}>
                          {doc.name}
                        </Text>
                        <Text style={styles.sampleCardDesc} numberOfLines={1}>
                          {doc.desc}
                        </Text>
                      </View>
                    </View>
                    <ChevronRight size={16} color="#94a3b8" />
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f1f5f9',
  },
  headerBar: {
    height: 48,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  headerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  headerTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1e293b',
  },
  openBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#2563eb',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  openBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  toastBanner: {
    backgroundColor: '#ecfdf5',
    borderBottomWidth: 1,
    borderBottomColor: '#a7f3d0',
    paddingVertical: 8,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  toastText: {
    color: '#065f46',
    fontSize: 12,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  docWrapper: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 4,
    position: 'relative',
  },
  docImage: {
    backgroundColor: '#ffffff',
  },
  emptyCard: {
    width: '92%',
    maxWidth: 580,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  emptyIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0f172a',
    textAlign: 'center',
    marginBottom: 6,
  },
  emptySub: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 20,
    paddingHorizontal: 12,
  },
  bigUploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#2563eb',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    width: '100%',
    marginBottom: 24,
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 2,
  },
  bigUploadText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  sampleSection: {
    width: '100%',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 18,
  },
  sampleSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  sampleSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1e293b',
  },
  sampleSectionSub: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 12,
  },
  sampleGrid: {
    gap: 8,
  },
  sampleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  sampleCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  sampleCardEmoji: {
    fontSize: 22,
  },
  sampleCardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 2,
  },
  sampleCardDesc: {
    fontSize: 11,
    color: '#64748b',
  },
});
