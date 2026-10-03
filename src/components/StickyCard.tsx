import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Dimensions,
  Platform,
} from 'react-native';
import {
  Pin,
  CheckSquare,
  Square,
  Image as ImageIcon,
  Tag,
  Clock,
  Copy,
  FileText,
} from 'lucide-react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path as SvgPath, SvgXml, Rect, Circle, Line as SvgLine } from 'react-native-svg';
import { Note } from '../types/note';
import { NOTE_COLORS } from '../constants/colors';
import { useNoteStore } from '../store/useNoteStore';
import { ShareCardModal } from './ShareCardModal';
import { PaperTemplatePattern } from './PaperTemplatePattern';
import { AudioPlayerBar } from './AudioPlayerBar';
import { getSampleDocumentForNote } from '../constants/sampleDocuments';

interface StickyCardProps {
  note: Note;
  isCanvasItem?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
  style?: object;
}

// Notewise/Goodnotes 스타일 부드러운 베지어(Bézier) 곡선 및 다각형 SVG Path 생성 엔진
const strokePointsToPath = (points?: { x: number; y: number }[], isRuler?: boolean, isPolygon?: boolean) => {
  if (!points || points.length === 0) return '';
  if (isRuler && points.length >= 2) {
    return `M ${points[0].x} ${points[0].y} L ${points[points.length - 1].x} ${points[points.length - 1].y}`;
  }

  // 직사각형, 삼각형 등 다각형이거나 끝점과 시작점이 일치하는 닫힌 다각형 점군인 경우
  const isClosedPoly =
    isPolygon ||
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

// Goodnotes / DrawNote / Notewise 벡터 스트로크 및 기하 도형(사각형, 원, 화살표, 선) 렌더러
const renderStrokeItem = (stroke: any) => {
  if (!stroke) return null;
  // 기하 도형 렌더링
  if (stroke.tool === 'shape' && stroke.shapeStart && stroke.shapeEnd) {
    const s = stroke.shapeStart;
    const e = stroke.shapeEnd;
    if (stroke.shapeType === 'rect') {
      const rx = Math.min(s.x, e.x);
      const ry = Math.min(s.y, e.y);
      const rw = Math.max(2, Math.abs(e.x - s.x));
      const rh = Math.max(2, Math.abs(e.y - s.y));
      return (
        <Rect
          key={stroke.id}
          x={rx}
          y={ry}
          width={rw}
          height={rh}
          stroke={stroke.color || '#2563EB'}
          strokeWidth={stroke.width || 3}
          fill="none"
          rx={4}
        />
      );
    }
    if (stroke.shapeType === 'circle') {
      const cx = (s.x + e.x) / 2;
      const cy = (s.y + e.y) / 2;
      const r = Math.max(2, Math.hypot(e.x - s.x, e.y - s.y) / 2);
      return (
        <Circle
          key={stroke.id}
          cx={cx}
          cy={cy}
          r={r}
          stroke={stroke.color || '#2563EB'}
          strokeWidth={stroke.width || 3}
          fill="none"
        />
      );
    }
    if (stroke.shapeType === 'arrow') {
      const angle = Math.atan2(e.y - s.y, e.x - s.x);
      const headLen = Math.max(12, (stroke.width || 3) * 3);
      const lx = e.x - headLen * Math.cos(angle - Math.PI / 6);
      const ly = e.y - headLen * Math.sin(angle - Math.PI / 6);
      const rx = e.x - headLen * Math.cos(angle + Math.PI / 6);
      const ry = e.y - headLen * Math.sin(angle + Math.PI / 6);
      return (
        <React.Fragment key={stroke.id}>
          <SvgLine
            x1={s.x}
            y1={s.y}
            x2={e.x}
            y2={e.y}
            stroke={stroke.color || '#DC2626'}
            strokeWidth={stroke.width || 3}
            strokeLinecap="round"
          />
          <SvgPath
            d={`M ${lx} ${ly} L ${e.x} ${e.y} L ${rx} ${ry}`}
            stroke={stroke.color || '#DC2626'}
            strokeWidth={stroke.width || 3}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </React.Fragment>
      );
    }
    return (
      <SvgLine
        key={stroke.id}
        x1={s.x}
        y1={s.y}
        x2={e.x}
        y2={e.y}
        stroke={stroke.color || '#2563EB'}
        strokeWidth={stroke.width || 3}
        strokeLinecap="round"
      />
    );
  }

  // 일반 펜 및 형광펜 Bézier 곡선 스트로크 또는 다각형
  const pathData = strokePointsToPath(
    stroke.points,
    stroke.isRuler,
    stroke.isPolygon || stroke.shapeType === 'rect' || stroke.shapeType === 'triangle'
  );
  if (!pathData) return null;
  const isHighlighter = stroke.tool === 'highlighter';
  return (
    <SvgPath
      key={stroke.id}
      d={pathData}
      stroke={stroke.color || '#1E293B'}
      strokeWidth={isHighlighter ? (stroke.width || 22) * 1.2 : stroke.width || 3}
      strokeOpacity={isHighlighter ? 0.42 : 1}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  );
};

// SVG 벡터 데이터 및 일반 래스터 이미지 통합 렌더러
const RenderCardImage: React.FC<{
  uri: string;
  style: any;
  resizeMode?: any;
}> = ({ uri, style, resizeMode = 'cover' }) => {
  if (uri && uri.startsWith('data:image/svg+xml;utf8,')) {
    try {
      const xml = decodeURIComponent(uri.replace('data:image/svg+xml;utf8,', ''));
      return (
        <View style={[{ overflow: 'hidden' }, style]}>
          <SvgXml xml={xml} width="100%" height="100%" />
        </View>
      );
    } catch (e) {
      // ignore
    }
  }
  return <Image source={{ uri }} style={style} resizeMode={resizeMode} />;
};

export const StickyCard: React.FC<StickyCardProps> = ({
  note,
  isCanvasItem = false,
  onPress,
  onLongPress,
  style,
}) => {
  const {
    updateNote,
    togglePin,
    toggleChecklistItem,
    openEditNoteEditor,
    openImageViewer,
    setSelectedTag,
    duplicateNote,
    openWidgetModal,
    openLockModal,
    toggleNoteLock,
    openReminderModal,
    deleteNote,
  } = useNoteStore();

  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  const colorConfig = NOTE_COLORS[note.color] || NOTE_COLORS.yellow;
  const rotationDeg = isCanvasItem ? `${note.rotation || 0}deg` : '0deg';

  const handleCardPress = () => {
    if (note.isLocked) {
      openLockModal(note, () => {
        if (onPress) onPress();
        else openEditNoteEditor(note);
      });
      return;
    }
    if (onPress) {
      onPress();
    } else {
      openEditNoteEditor(note);
    }
  };

  const formattedDate = new Date(note.updatedAt).toLocaleDateString('ko-KR', {
    month: 'short',
    day: 'numeric',
  });

  // 타이포그래피 스타일 동적 계산
  const dynamicFontSize =
    note.fontSize === 'sm' ? 12 : note.fontSize === 'lg' ? 15.5 : note.fontSize === 'xl' ? 18 : 13;

  const dynamicLineHeight =
    note.lineHeight === 'tight'
      ? Math.round(dynamicFontSize * 1.35)
      : note.lineHeight === 'relaxed'
      ? Math.round(dynamicFontSize * 1.9)
      : Math.round(dynamicFontSize * 1.55);

  // 상단 / 인라인 / 어울림 사진 분류
  const images = note.images || [];
  const wrappedImages = images.filter((img) => img.wrapMode && img.wrapMode !== 'break');
  const standardImages = images.filter((img) => !img.wrapMode || img.wrapMode === 'break');
  const topImages = standardImages.filter((img) => !img.placement || img.placement === 'top');
  const inlineImages = standardImages.filter((img) => img.placement === 'inline' || img.placement === 'bottom');

  // Goodnotes / Notewise 정품 규격 PDF 문서 판별 및 샘플 데이터 매칭
  const isPdfNote =
    note.noteType === 'pdf' ||
    Boolean(note.pdfName) ||
    Boolean(note.pdfUri) ||
    Boolean(note.title?.toLowerCase().includes('.pdf'));

  const pdfDoc = isPdfNote ? getSampleDocumentForNote(note.title, note.pdfName) : null;

  return (
    <View
      style={[
        styles.wrapper,
        isCanvasItem && { transform: [{ rotate: rotationDeg }] },
        style,
      ]}
    >
      {/* Deco Element: Masking Tape */}
      {note.decoStyle === 'tape' && (
        <View
          style={[
            styles.tape,
            { backgroundColor: colorConfig.tapeColor },
          ]}
        />
      )}

      {/* Deco Element: Push Pin */}
      {note.decoStyle === 'pin' && (
        <View style={styles.pushPinContainer}>
          <View style={styles.pushPinHead} />
          <View style={styles.pushPinPoint} />
        </View>
      )}

      {/* Main Sticky Note Card */}
      <View
        style={[
          styles.card,
          {
            backgroundColor: colorConfig.bg,
            borderColor: colorConfig.cardBorder,
            shadowColor: colorConfig.shadow,
          },
        ]}
      >
        {/* Noteshelf 페이퍼 속지 템플릿 패턴 */}
        <PaperTemplatePattern template={note.paperTemplate} />

        {/* Card Header (ColorNote Pro Actions) */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.pinButton}
            onPress={(e) => {
              e.stopPropagation();
              togglePin(note.id);
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Pin
              size={15}
              color={note.isPinned ? '#E11D48' : colorConfig.textMuted}
              fill={note.isPinned ? '#E11D48' : 'none'}
            />
          </TouchableOpacity>

          <View style={styles.headerRight}>
            {/* ColorNote 위젯 스튜디오 */}
            <TouchableOpacity
              onPress={(e) => {
                e.stopPropagation();
                openWidgetModal(note);
              }}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              style={styles.headerActionBtn}
            >
              <Ionicons name="apps-outline" size={14} color={colorConfig.textMuted} />
            </TouchableOpacity>

            {/* ColorNote 리마인더/알람 */}
            <TouchableOpacity
              onPress={(e) => {
                e.stopPropagation();
                openReminderModal(note);
              }}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              style={styles.headerActionBtn}
            >
              <Ionicons
                name={note.reminder ? 'alarm' : 'alarm-outline'}
                size={14}
                color={note.reminder ? '#DC2626' : colorConfig.textMuted}
              />
            </TouchableOpacity>

            {/* ColorNote 메모 잠금 */}
            <TouchableOpacity
              onPress={(e) => {
                e.stopPropagation();
                if (note.isLocked) {
                  // 잠금 해제 시 PIN 확인
                  openLockModal(note, () => {
                    toggleNoteLock(note.id);
                  });
                } else {
                  toggleNoteLock(note.id);
                }
              }}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              style={styles.headerActionBtn}
            >
              <Ionicons
                name={note.isLocked ? 'lock-closed' : 'lock-open-outline'}
                size={14}
                color={note.isLocked ? '#EF4444' : colorConfig.textMuted}
              />
            </TouchableOpacity>

            {/* 사본 생성 */}
            <TouchableOpacity
              onPress={(e) => {
                e.stopPropagation();
                duplicateNote(note.id);
              }}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              style={styles.headerActionBtn}
            >
              <Copy size={12} color={colorConfig.textMuted} />
            </TouchableOpacity>

            {/* Apple Notes & 3M Post-it 액자 카드 공유 */}
            <TouchableOpacity
              onPress={(e) => {
                e.stopPropagation();
                setIsShareModalOpen(true);
              }}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              style={styles.headerActionBtn}
            >
              <Ionicons name="share-outline" size={13} color={colorConfig.textMuted} />
            </TouchableOpacity>

            {/* ColorNote 휴지통으로 이동 (안전 삭제) */}
            <TouchableOpacity
              onPress={(e) => {
                e.stopPropagation();
                deleteNote(note.id);
              }}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              style={styles.headerActionBtn}
            >
              <Ionicons name="trash-outline" size={13} color={colorConfig.textMuted} />
            </TouchableOpacity>

            <Text style={[styles.dateText, { color: colorConfig.textMuted }]}>
              {formattedDate}
            </Text>
          </View>
        </View>

        {/* Title */}
        {note.isLocked ? (
          <TouchableOpacity activeOpacity={0.8} onPress={handleCardPress} style={styles.lockedTitleRow}>
            <Ionicons name="lock-closed" size={15} color="#EF4444" />
            <Text style={[styles.title, { color: colorConfig.text, marginLeft: 6 }]}>
              {note.title || '잠긴 메모'}
            </Text>
          </TouchableOpacity>
        ) : note.title ? (
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleCardPress}
            {...(Platform.OS === 'web' ? ({ onClick: handleCardPress } as any) : {})}
          >
            <Text
              style={[styles.title, { color: colorConfig.text }]}
              numberOfLines={2}
            >
              {note.title}
            </Text>
          </TouchableOpacity>
        ) : null}

        {/* Reminder Badge */}
        {note.reminder && (
          <TouchableOpacity
            style={styles.reminderBadge}
            onPress={(e) => {
              e.stopPropagation();
              openReminderModal(note);
            }}
          >
            <Ionicons name="alarm" size={12} color="#DC2626" />
            <Text style={styles.reminderBadgeText}>
              {note.reminder.date} {note.reminder.time || '종일'}
              {note.reminder.repeat && note.reminder.repeat !== 'none' ? ` (${note.reminder.repeat})` : ''}
            </Text>
          </TouchableOpacity>
        )}

        {/* Jnotes 다이어리 플래너 스티커 스탬프 배지 */}
        {note.stickers && note.stickers.length > 0 && (
          <View style={styles.cardStickerRow}>
            {note.stickers.map((st) => (
              <View
                key={st.id}
                style={[
                  styles.cardStickerBadge,
                  {
                    backgroundColor: (st.color || '#8B5CF6') + '18',
                    borderColor: (st.color || '#8B5CF6') + '44',
                  },
                ]}
              >
                <Text style={styles.cardStickerEmoji}>{st.emoji}</Text>
                <Text style={[styles.cardStickerLabel, { color: st.color || colorConfig.text }]}>
                  {st.label}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* In-Note Scrollable Content Area or Locked Shield */}
        <View style={[styles.contentContainer, (isPdfNote || (note.audioNotes && note.audioNotes.length > 0)) && { maxHeight: 340 }]}>
          {note.isLocked ? (
            <TouchableOpacity
              style={styles.lockedContainer}
              onPress={handleCardPress}
              activeOpacity={0.8}
            >
              <View style={styles.lockedIconWrap}>
                <Ionicons name="lock-closed" size={24} color="#64748B" />
              </View>
              <Text style={styles.lockedText}>비밀번호로 보호된 메모</Text>
              <Text style={styles.lockedSubText}>탭하여 PIN 입력 후 열기</Text>
            </TouchableOpacity>
          ) : (
            <ScrollView
              style={styles.innerScrollView}
              nestedScrollEnabled={true}
              showsVerticalScrollIndicator={true}
              contentContainerStyle={styles.scrollContent}
            >
            {/* Top Images Horizontal Slider */}
            {topImages.length > 0 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.imageScrollContainer}
              >
                {topImages.map((img, idx) => (
                  <TouchableOpacity
                    key={img.id || idx.toString()}
                    activeOpacity={0.85}
                    onPress={(e) => {
                      e.stopPropagation();
                      openImageViewer(img.uri);
                    }}
                    style={styles.imageThumbWrapper}
                  >
                    <RenderCardImage
                      uri={img.uri}
                      style={[
                        styles.imageThumb,
                        img.size === 'small' && { width: 60, height: 60 },
                        img.size === 'large' && { width: 130, height: 110 },
                      ]}
                    />
                    <View style={styles.zoomBadge}>
                      <ImageIcon size={9} color="#FFFFFF" />
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            {/* Goodnotes / Notewise 스타일 정품 규격 PDF 문서 시트 프리뷰 */}
            {isPdfNote && pdfDoc ? (
              <TouchableOpacity
                activeOpacity={0.92}
                onPress={handleCardPress}
                {...(Platform.OS === 'web' ? ({ onClick: handleCardPress } as any) : {})}
                style={styles.pdfMiniSheetWrapper}
              >
                <View style={styles.pdfMiniSheet}>
                  {/* 1. 상단 공식 헤더 */}
                  <View style={styles.pdfMiniHeaderRow}>
                    <View style={styles.pdfMiniDocBadge}>
                      <FileText size={11} color="#2563EB" />
                      <Text style={styles.pdfMiniDocTag}>STICKYCRAFT DOCUMENT</Text>
                    </View>
                    <Text style={styles.pdfMiniPageTag}>
                      PAGE 1 OF {pdfDoc.pages.length}
                    </Text>
                  </View>

                  {/* 2. 문서 공식 타이틀 및 소제목 */}
                  <Text style={styles.pdfMiniTitle} numberOfLines={2}>
                    {pdfDoc.pages[0]?.title || note.title}
                  </Text>
                  {pdfDoc.pages[0]?.subtitle ? (
                    <Text style={styles.pdfMiniSubtitle} numberOfLines={1}>
                      {pdfDoc.pages[0].subtitle}
                    </Text>
                  ) : null}

                  <View style={styles.pdfMiniDivider} />

                  {/* 3. 문서 본문 텍스트 (실제 PDF 문서 내용) */}
                  <Text style={styles.pdfMiniBodyText} numberOfLines={5}>
                    {pdfDoc.pages[0]?.content || note.content}
                  </Text>

                  {/* 4. 실시간 Bézier 벡터 필기 & 기하 도형(사각형, 원, 화살표) 오버레이 */}
                  {note.strokes && note.strokes.length > 0 && (
                    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
                      <Svg width="100%" height="100%" viewBox="0 0 720 1018" preserveAspectRatio="none">
                        {note.strokes
                          .filter((s) => (s.pageIndex || 1) === 1)
                          .map(renderStrokeItem)}
                      </Svg>
                    </View>
                  )}

                  {/* 5. 공간 배치 주석 메모 스티커 (textBoxes) */}
                  {note.textBoxes &&
                    note.textBoxes
                      .filter((t) => (t.pageIndex || 1) === 1)
                      .map((t) => {
                        const leftPct = Math.min(68, Math.max(4, (t.x / 720) * 100));
                        const topPct = Math.min(70, Math.max(6, (t.y / 1018) * 100));
                        return (
                          <View
                            key={t.id}
                            style={[
                              styles.pdfMiniStickyNote,
                              {
                                left: `${leftPct}%`,
                                top: `${topPct}%`,
                                backgroundColor: t.backgroundColor || '#FEF08A',
                              },
                            ]}
                            pointerEvents="none"
                          >
                            <Text
                              style={[
                                styles.pdfMiniStickyText,
                                { color: t.color || '#1E293B' },
                              ]}
                              numberOfLines={2}
                            >
                              {t.text || '📌 주석 메모'}
                            </Text>
                          </View>
                        );
                      })}

                  {/* 6. 공간 오디오 핀 인디케이터 (audioNotes) */}
                  {note.audioNotes &&
                    note.audioNotes
                      .filter((a) => (a.pageIndex || 1) === 1 && a.x !== undefined && a.y !== undefined)
                      .map((a) => {
                        const leftPct = Math.min(75, Math.max(4, ((a.x || 52) / 720) * 100));
                        const topPct = Math.min(75, Math.max(6, ((a.y || 215) / 1018) * 100));
                        return (
                          <View
                            key={a.id}
                            style={[
                              styles.pdfMiniAudioPin,
                              {
                                left: `${leftPct}%`,
                                top: `${topPct}%`,
                              },
                            ]}
                            pointerEvents="none"
                          >
                            <Text style={styles.pdfMiniAudioPinText}>
                              🎙️ {Math.floor(a.duration / 60)}:{(a.duration % 60).toString().padStart(2, '0')}
                            </Text>
                          </View>
                        );
                      })}

                  </View>
              </TouchableOpacity>
            ) : (
              <>
                {/* Text & Image Wrapping Render Engine */}
                {(() => {
                  const wrapImg = images.find((i) => i.wrapMode && i.wrapMode !== 'break');

                  // Case 1: 좌측 어울림 (사진 좌 + 글 우)
                  if (wrapImg && wrapImg.wrapMode === 'wrap-left') {
                    return (
                      <View style={styles.wrapContainerRow}>
                        <TouchableOpacity
                          activeOpacity={0.85}
                          onPress={(e) => {
                            e.stopPropagation();
                            openImageViewer(wrapImg.uri);
                          }}
                          style={styles.wrapImageThumb}
                        >
                          <RenderCardImage
                            uri={wrapImg.uri}
                            style={{
                              width: wrapImg.customWidth ? Math.min(130, wrapImg.customWidth) : 95,
                              height: wrapImg.customHeight ? Math.min(130, wrapImg.customHeight) : 85,
                              borderRadius: 8,
                            }}
                            resizeMode="cover"
                          />
                        </TouchableOpacity>
                        {note.content ? (
                          <TouchableOpacity activeOpacity={0.9} onPress={handleCardPress} style={{ flex: 1 }}>
                            <Text
                              style={[
                                styles.contentText,
                                {
                                  color: colorConfig.text,
                                  fontSize: dynamicFontSize,
                                  lineHeight: dynamicLineHeight,
                                },
                              ]}
                            >
                              {note.content}
                            </Text>
                          </TouchableOpacity>
                        ) : null}
                      </View>
                    );
                  }

                  // Case 2: 우측 어울림 (글 좌 + 사진 우)
                  if (wrapImg && wrapImg.wrapMode === 'wrap-right') {
                    return (
                      <View style={styles.wrapContainerRow}>
                        {note.content ? (
                          <TouchableOpacity activeOpacity={0.9} onPress={handleCardPress} style={{ flex: 1 }}>
                            <Text
                              style={[
                                styles.contentText,
                                {
                                  color: colorConfig.text,
                                  fontSize: dynamicFontSize,
                                  lineHeight: dynamicLineHeight,
                                },
                              ]}
                            >
                              {note.content}
                            </Text>
                          </TouchableOpacity>
                        ) : null}
                        <TouchableOpacity
                          activeOpacity={0.85}
                          onPress={(e) => {
                            e.stopPropagation();
                            openImageViewer(wrapImg.uri);
                          }}
                          style={styles.wrapImageThumb}
                        >
                          <RenderCardImage
                            uri={wrapImg.uri}
                            style={{
                              width: wrapImg.customWidth ? Math.min(130, wrapImg.customWidth) : 95,
                              height: wrapImg.customHeight ? Math.min(130, wrapImg.customHeight) : 85,
                              borderRadius: 8,
                            }}
                            resizeMode="cover"
                          />
                        </TouchableOpacity>
                      </View>
                    );
                  }

                  // Case 3: 사진 위에 글쓰기 (글 뒤로 / 워터마크 배경)
                  if (wrapImg && wrapImg.wrapMode === 'behind-text') {
                    return (
                      <TouchableOpacity
                        activeOpacity={0.9}
                        onPress={handleCardPress}
                        style={styles.behindTextWrapper}
                      >
                        <RenderCardImage
                          uri={wrapImg.uri}
                          style={[
                            StyleSheet.absoluteFillObject,
                            { opacity: wrapImg.opacity ?? 0.45, borderRadius: 8 },
                          ]}
                          resizeMode="cover"
                        />
                        <Text
                          style={[
                            styles.contentText,
                            {
                              color: colorConfig.text,
                              fontSize: dynamicFontSize,
                              lineHeight: dynamicLineHeight,
                              zIndex: 2,
                              textShadowColor: 'rgba(255,255,255,0.7)',
                              textShadowOffset: { width: 0, height: 1 },
                              textShadowRadius: 2,
                            },
                          ]}
                        >
                          {note.content}
                        </Text>
                      </TouchableOpacity>
                    );
                  }

                  // Case 4: 글 중간 삽입 (inline placement)
                  const middleImg = inlineImages[0];
                  if (middleImg && note.content) {
                    const parts = note.content.split('\n\n');
                    if (parts.length > 1) {
                      return (
                        <>
                          <TouchableOpacity activeOpacity={0.9} onPress={handleCardPress}>
                            <Text
                              style={[
                                styles.contentText,
                                {
                                  color: colorConfig.text,
                                  fontSize: dynamicFontSize,
                                  lineHeight: dynamicLineHeight,
                                },
                              ]}
                            >
                              {parts[0]}
                            </Text>
                          </TouchableOpacity>

                          <View style={styles.inlineImagesContainer}>
                            <TouchableOpacity
                              activeOpacity={0.85}
                              onPress={(e) => {
                                e.stopPropagation();
                                openImageViewer(middleImg.uri);
                              }}
                              style={styles.inlineImageWrapper}
                            >
                            <RenderCardImage
                              uri={middleImg.uri}
                              style={{
                                width: '100%',
                                height: middleImg.customHeight ? Math.min(180, middleImg.customHeight) : 130,
                                borderRadius: 8,
                              }}
                              resizeMode="cover"
                            />
                              <View style={styles.zoomBadge}>
                                <ImageIcon size={10} color="#FFFFFF" />
                              </View>
                            </TouchableOpacity>
                          </View>

                          <TouchableOpacity activeOpacity={0.9} onPress={handleCardPress}>
                            <Text
                              style={[
                                styles.contentText,
                                {
                                  color: colorConfig.text,
                                  fontSize: dynamicFontSize,
                                  lineHeight: dynamicLineHeight,
                                },
                              ]}
                            >
                              {parts.slice(1).join('\n\n')}
                            </Text>
                          </TouchableOpacity>
                        </>
                      );
                    }
                  }

                  // Case 5: 기본 분리 / 자리차지 (텍스트 일반 표시 + 아래 인라인 이미지)
                  return (
                    <>
                      {note.content ? (
                        <TouchableOpacity
                          activeOpacity={0.9}
                          onPress={handleCardPress}
                          {...(Platform.OS === 'web' ? ({ onClick: handleCardPress } as any) : {})}
                        >
                          <Text
                            style={[
                              styles.contentText,
                              {
                                color: colorConfig.text,
                                fontSize: dynamicFontSize,
                                lineHeight: dynamicLineHeight,
                              },
                            ]}
                          >
                            {note.content}
                          </Text>
                        </TouchableOpacity>
                      ) : null}

                      {inlineImages.length > 0 && (
                        <View style={styles.inlineImagesContainer}>
                          {inlineImages.map((img, idx) => {
                            const hasCustom = img.customWidth || img.customHeight;
                            return (
                              <TouchableOpacity
                                key={img.id || idx.toString()}
                                activeOpacity={0.85}
                                onPress={(e) => {
                                  e.stopPropagation();
                                  openImageViewer(img.uri);
                                }}
                                style={[
                                  styles.inlineImageWrapper,
                                  {
                                    transform: [
                                      { translateX: img.x || 0 },
                                      { translateY: img.y || 0 },
                                      { scale: img.scale || 1 },
                                    ],
                                  },
                                ]}
                              >
                                <RenderCardImage
                                  uri={img.uri}
                                  style={[
                                    styles.inlineImage,
                                    hasCustom
                                      ? { width: img.customWidth || 180, height: img.customHeight || 140 }
                                      : img.size === 'small'
                                      ? { height: 90, width: 120 }
                                      : img.size === 'large'
                                      ? { height: 200, width: '100%' }
                                      : { height: 140, width: '100%' },
                                  ]}
                                  resizeMode="cover"
                                />
                                <View style={styles.zoomBadge}>
                                  <ImageIcon size={10} color="#FFFFFF" />
                                </View>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      )}
                    </>
                  );
                })()}

                {/* Free Drawing / Handwriting Strokes Layer (DrawNote & Notewise) */}
                {(note.freeDrawingData || (note.strokes && note.strokes.length > 0)) && (
                  <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={handleCardPress}
                    {...(Platform.OS === 'web' ? ({ onClick: handleCardPress } as any) : {})}
                    style={styles.drawingCardContainer}
                  >
                    {note.freeDrawingData ? (
                      <RenderCardImage
                        uri={note.freeDrawingData}
                        style={styles.drawingImage}
                        resizeMode="contain"
                      />
                    ) : (
                      <View style={styles.drawingSvgWrap}>
                        {note.paperTemplate && (
                          <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
                            <PaperTemplatePattern template={note.paperTemplate} />
                          </View>
                        )}
                        <Svg width="100%" height={140} viewBox="0 0 720 1018" preserveAspectRatio="xMidYMid meet">
                          {note.strokes?.map(renderStrokeItem)}
                        </Svg>
                      </View>
                    )}
                  </TouchableOpacity>
                )}
              </>
            )}

            {/* ColorNote 스타일 인터랙티브 체크리스트 (진행률 바 & 취소선 & 통계) */}
            {note.checklist && note.checklist.length > 0 && (() => {
              const completedCount = note.checklist.filter((c) => c.completed).length;
              const totalCount = note.checklist.length;
              const percent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

              return (
                <View style={styles.checklistContainer}>
                  {/* Checklist Mini Header & Progress */}
                  <View style={styles.checklistHeaderRow}>
                    <View style={[styles.checklistStatsBadge, { backgroundColor: colorConfig.headerBg }]}>
                      <Text style={[styles.checklistStatsText, { color: colorConfig.text }]}>
                        ✓ {completedCount}/{totalCount} 완료 ({percent}%)
                      </Text>
                    </View>
                    <View style={styles.checklistProgressBar}>
                      <View
                        style={[
                          styles.checklistProgressFill,
                          {
                            width: `${percent}%`,
                            backgroundColor: percent === 100 ? '#10B981' : colorConfig.text,
                          },
                        ]}
                      />
                    </View>
                  </View>

                  {note.checklist.map((item) => (
                    <TouchableOpacity
                      key={item.id}
                      style={styles.checkItemRow}
                      activeOpacity={0.7}
                      onPress={(e) => {
                        e.stopPropagation();
                        toggleChecklistItem(note.id, item.id);
                      }}
                    >
                      {item.completed ? (
                        <CheckSquare size={16} color="#059669" />
                      ) : (
                        <Square size={16} color={colorConfig.textMuted} />
                      )}
                      <Text
                        style={[
                          styles.checkItemText,
                          { color: colorConfig.text },
                          item.completed && [
                            styles.checkItemCompleted,
                            { color: colorConfig.textMuted, textDecorationLine: 'line-through' },
                          ],
                        ]}
                        numberOfLines={2}
                      >
                        {item.text}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              );
            })()}

            {/* Noteshelf & Jnotes 음성 녹음 메모 */}
            {note.audioNotes && note.audioNotes.length > 0 && (
              <View style={{ marginTop: 8, gap: 4 }}>
                {note.audioNotes.map((audio, idx) => (
                  <AudioPlayerBar
                    key={audio.id}
                    audio={audio}
                    index={idx}
                    totalCount={note.audioNotes!.length}
                    isPdfNote={isPdfNote}
                    accentColor={colorConfig.text}
                    onUpdateTitle={(newTitle) => {
                      if (note.audioNotes) {
                        updateNote(note.id, {
                          audioNotes: note.audioNotes.map((a) =>
                            a.id === audio.id ? { ...a, title: newTitle } : a
                          ),
                        });
                      }
                    }}
                    onPressPageBadge={() => {
                      handleCardPress();
                    }}
                  />
                ))}
              </View>
            )}
          </ScrollView>
          )}
        </View>

        {/* Card Footer: Tags */}
        {note.tags && note.tags.length > 0 && (
          <View style={styles.footerTags}>
            {note.tags.slice(0, 3).map((tag) => (
              <TouchableOpacity
                key={tag}
                style={[
                  styles.tagBadge,
                  { backgroundColor: colorConfig.headerBg },
                ]}
                onPress={(e) => {
                  e.stopPropagation();
                  setSelectedTag(tag);
                }}
              >
                <Tag size={9} color={colorConfig.text} />
                <Text style={[styles.tagText, { color: colorConfig.text }]}>
                  #{tag}
                </Text>
              </TouchableOpacity>
            ))}
            {note.tags.length > 3 && (
              <Text style={[styles.tagMore, { color: colorConfig.textMuted }]}>
                +{note.tags.length - 3}
              </Text>
            )}
          </View>
        )}

        {/* Deco Element: Bottom Right Corner Fold */}
        {note.decoStyle === 'corner-fold' && (
          <View
            style={[
              styles.cornerFold,
              { borderTopColor: colorConfig.cardBorder },
            ]}
          />
        )}
      </View>

      {/* 액자 카드 공유 모달 */}
      <ShareCardModal
        visible={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        note={note}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
    marginVertical: 8,
    paddingTop: 10,
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 10,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 7,
    elevation: 4,
    overflow: 'hidden',
  },
  tape: {
    position: 'absolute',
    top: -8,
    alignSelf: 'center',
    width: 68,
    height: 18,
    borderRadius: 2,
    zIndex: 10,
    transform: [{ rotate: '-1.5deg' }],
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  pushPinContainer: {
    position: 'absolute',
    top: -7,
    alignSelf: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  pushPinHead: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#DC2626',
    borderWidth: 1.5,
    borderColor: '#FEE2E2',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 3,
  },
  pushPinPoint: {
    width: 2,
    height: 4,
    backgroundColor: '#71717A',
  },
  cornerFold: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderRightWidth: 16,
    borderTopWidth: 16,
    borderRightColor: 'transparent',
    borderTopColor: '#CBD5E1',
    opacity: 0.85,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  pinButton: {
    padding: 2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  headerActionBtn: {
    padding: 3,
    borderRadius: 4,
  },
  dateText: {
    fontSize: 10,
    fontWeight: '500',
    marginLeft: 2,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
    marginBottom: 6,
  },
  lockedTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  reminderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  reminderBadgeText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#DC2626',
  },
  cardStickerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginBottom: 6,
  },
  cardStickerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  cardStickerEmoji: {
    fontSize: 11,
  },
  cardStickerLabel: {
    fontSize: 10,
    fontWeight: '700',
  },
  lockedContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(0,0,0,0.03)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    borderStyle: 'dashed',
    marginVertical: 4,
  },
  lockedIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  lockedText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
    textAlign: 'center',
  },
  lockedSubText: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
    textAlign: 'center',
  },
  contentContainer: {
    maxHeight: 260,
  },
  innerScrollView: {
    flexGrow: 0,
  },
  scrollContent: {
    paddingBottom: 4,
  },
  contentText: {
    fontWeight: '400',
  },
  imageScrollContainer: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  imageThumbWrapper: {
    marginRight: 8,
    position: 'relative',
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
  },
  wrapContainerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 6,
  },
  wrapImageThumb: {
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
  },
  behindTextWrapper: {
    position: 'relative',
    padding: 8,
    borderRadius: 8,
    overflow: 'hidden',
    minHeight: 80,
  },
  imageThumb: {
    width: 80,
    height: 80,
    borderRadius: 7,
    backgroundColor: '#E2E8F0',
  },
  inlineImagesContainer: {
    marginVertical: 8,
    gap: 8,
  },
  inlineImageWrapper: {
    position: 'relative',
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
  },
  inlineImage: {
    borderRadius: 8,
    backgroundColor: '#E2E8F0',
  },
  zoomBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 4,
    padding: 2,
  },
  drawingCardContainer: {
    marginVertical: 6,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  drawingImage: {
    width: '100%',
    height: 140,
    borderRadius: 8,
  },
  drawingSvgWrap: {
    width: '100%',
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checklistContainer: {
    marginTop: 8,
    gap: 5,
  },
  checklistHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  checklistStatsBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  checklistStatsText: {
    fontSize: 10,
    fontWeight: '700',
  },
  checklistProgressBar: {
    flex: 1,
    height: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.08)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  checklistProgressFill: {
    height: '100%',
    borderRadius: 2,
  },
  checkItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 2,
  },
  checkItemText: {
    fontSize: 12.5,
    flex: 1,
    lineHeight: 17,
  },
  checkItemCompleted: {
    textDecorationLine: 'line-through',
    opacity: 0.55,
  },
  footerTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 8,
    paddingTop: 6,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(0,0,0,0.06)',
    alignItems: 'center',
  },
  tagBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 6,
  },
  tagText: {
    fontSize: 10,
    fontWeight: '600',
  },
  tagMore: {
    fontSize: 10,
    fontWeight: '500',
  },
  // Goodnotes / Notewise 정품 규격 PDF 문서 시트 프리뷰 스타일
  pdfMiniSheetWrapper: {
    marginVertical: 4,
    borderRadius: 9,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 5,
    elevation: 3,
  },
  pdfMiniSheet: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 26,
    minHeight: 185,
    maxHeight: 220,
    overflow: 'hidden',
    position: 'relative',
  },
  pdfMiniHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  pdfMiniDocBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  pdfMiniDocTag: {
    fontSize: 8,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.6,
  },
  pdfMiniPageTag: {
    fontSize: 7.5,
    fontWeight: '700',
    color: '#94A3B8',
  },
  pdfMiniTitle: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#0F172A',
    lineHeight: 15,
  },
  pdfMiniSubtitle: {
    fontSize: 9.5,
    fontWeight: '600',
    color: '#2563EB',
    marginTop: 2,
  },
  pdfMiniDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 5,
  },
  pdfMiniBodyText: {
    fontSize: 8.5,
    color: '#475569',
    lineHeight: 12.5,
  },
  pdfMiniStickyNote: {
    position: 'absolute',
    borderRadius: 4,
    borderWidth: 0.8,
    borderColor: '#FACC15',
    paddingHorizontal: 5,
    paddingVertical: 2,
    maxWidth: '55%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 2,
    elevation: 2,
    zIndex: 5,
  },
  pdfMiniStickyText: {
    fontSize: 8,
    fontWeight: '700',
    lineHeight: 11,
  },
  pdfMiniAudioPin: {
    position: 'absolute',
    backgroundColor: '#2563EB',
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
    zIndex: 6,
  },
  pdfMiniAudioPinText: {
    fontSize: 7.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
