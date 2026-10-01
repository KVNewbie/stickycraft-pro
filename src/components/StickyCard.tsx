import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Dimensions,
} from 'react-native';
import {
  Pin,
  CheckSquare,
  Square,
  Image as ImageIcon,
  Tag,
  Clock,
  ExternalLink,
  Copy,
} from 'lucide-react-native';
import { Ionicons } from '@expo/vector-icons';
import { Note } from '../types/note';
import { NOTE_COLORS } from '../constants/colors';
import { useNoteStore } from '../store/useNoteStore';
import { ShareCardModal } from './ShareCardModal';
import { PaperTemplatePattern } from './PaperTemplatePattern';
import { AudioPlayerBar } from './AudioPlayerBar';

interface StickyCardProps {
  note: Note;
  isCanvasItem?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
  style?: object;
}

export const StickyCard: React.FC<StickyCardProps> = ({
  note,
  isCanvasItem = false,
  onPress,
  onLongPress,
  style,
}) => {
  const {
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
          <TouchableOpacity activeOpacity={0.8} onPress={handleCardPress}>
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
        <View style={styles.contentContainer}>
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
                    <Image
                      source={{ uri: img.uri }}
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
                      <Image
                        source={{ uri: wrapImg.uri }}
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
                      <Image
                        source={{ uri: wrapImg.uri }}
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
                    <Image
                      source={{ uri: wrapImg.uri }}
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
                          <Image
                            source={{ uri: middleImg.uri }}
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
                            <Image
                              source={{ uri: img.uri }}
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

            {/* Interactive Checklist (To-Do) */}
            {note.checklist && note.checklist.length > 0 && (
              <View style={styles.checklistContainer}>
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
                        item.completed && styles.checkItemCompleted,
                      ]}
                      numberOfLines={2}
                    >
                      {item.text}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Noteshelf & Jnotes 음성 녹음 메모 */}
            {note.audioNotes && note.audioNotes.length > 0 && (
              <View style={{ marginTop: 8, gap: 4 }}>
                {note.audioNotes.map((audio) => (
                  <AudioPlayerBar
                    key={audio.id}
                    audio={audio}
                    accentColor={colorConfig.text}
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
  checklistContainer: {
    marginTop: 8,
    gap: 5,
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
});
