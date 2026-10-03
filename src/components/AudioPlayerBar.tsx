import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AudioNote } from '../types/note';

interface AudioPlayerBarProps {
  audio: AudioNote;
  onDelete?: () => void;
  accentColor?: string;
  onUpdateTitle?: (newTitle: string) => void;
  onPressPageBadge?: (pageIndex: number) => void;
  index?: number;
  totalCount?: number;
  isPdfNote?: boolean;
}

const WAVE_BARS_COUNT = 24;

// 고유 오디오 ID/URI 기반 사실적인 음성 주파수 파형 바 높이 생성
const getWaveformHeights = (seed: string): number[] => {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  const heights: number[] = [];
  for (let i = 0; i < WAVE_BARS_COUNT; i++) {
    const bellFactor = Math.sin(((i + 1) / (WAVE_BARS_COUNT + 1)) * Math.PI);
    const pseudoRand = Math.abs(Math.sin((hash + i * 19) * 9999));
    const h = Math.round(6 + bellFactor * 13 + pseudoRand * 9);
    heights.push(Math.min(26, Math.max(5, h)));
  }
  return heights;
};

export const AudioPlayerBar: React.FC<AudioPlayerBarProps> = ({
  audio,
  onDelete,
  accentColor = '#2563EB',
  onUpdateTitle,
  onPressPageBadge,
  index,
  totalCount,
  isPdfNote = false,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(audio.duration || 10);
  const [playbackSpeed, setPlaybackSpeed] = useState<1.0 | 1.25 | 1.5 | 2.0>(1.0);
  const [isMuted, setIsMuted] = useState(false);
  const [animTick, setAnimTick] = useState(0);

  // PDF 문서인 경우 pageIndex 기본값 1 적용
  const resolvedPageIndex = audio.pageIndex !== undefined ? audio.pageIndex : (isPdfNote ? 1 : undefined);

  // 스마트 기본 타이틀 계산:
  // 1. audio.title이 유효하게 설정되어 있고 generic "음성 메모"가 아니면 그대로 사용
  // 2. pageIndex가 있거나 PDF 문서인 경우 -> "P.1 음성 메모" (여러 개면 "P.1 녹음 1")
  // 3. 일반 메모(텍스트, 체크리스트, 캔버스)인 경우 -> "녹음 1", "녹음 2" (Samsung Notes 표준)
  const defaultTitle = useMemo(() => {
    if (audio.title && audio.title.trim() !== '' && audio.title !== '음성 메모') {
      return audio.title;
    }
    if (resolvedPageIndex !== undefined) {
      return (totalCount && totalCount > 1)
        ? `P.${resolvedPageIndex} 녹음 ${index !== undefined ? index + 1 : ''}`.trim()
        : `P.${resolvedPageIndex} 음성 메모`;
    }
    return `녹음 ${(index !== undefined ? index + 1 : 1)}`;
  }, [audio.title, resolvedPageIndex, index, totalCount]);

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [tempTitle, setTempTitle] = useState(audio.title || defaultTitle);

  // audio.title / defaultTitle 변경 시 동기화
  useEffect(() => {
    setTempTitle(audio.title || defaultTitle);
  }, [audio.title, defaultTitle]);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const isHtmlAudioSupported = useRef(false);
  const trackLayoutWidthRef = useRef<number>(180);

  // 녹음 생성 일시 포맷 (예: 오전 10:24)
  const formattedTime = useMemo(() => {
    if (!audio.createdAt) return '';
    try {
      const d = new Date(audio.createdAt);
      const now = new Date();
      const isToday = d.toDateString() === now.toDateString();
      const timeStr = d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: true });
      if (isToday) return timeStr;
      return `${d.getMonth() + 1}/${d.getDate()} ${timeStr}`;
    } catch {
      return '';
    }
  }, [audio.createdAt]);

  // 음성 파형 고유 높이 배열
  const waveformHeights = useMemo(() => {
    return getWaveformHeights(audio.id || audio.uri || 'audio-sample');
  }, [audio.id, audio.uri]);

  // HTML5 Audio 초기화
  useEffect(() => {
    if (Platform.OS === 'web' && audio.uri) {
      const isValidRemoteUrl =
        audio.uri.startsWith('http://') ||
        audio.uri.startsWith('https://') ||
        audio.uri.startsWith('data:audio');

      if (isValidRemoteUrl) {
        try {
          const a = new Audio(audio.uri);
          audioRef.current = a;
          isHtmlAudioSupported.current = true;
          a.playbackRate = playbackSpeed;
          a.muted = isMuted;

          a.onerror = () => {
            isHtmlAudioSupported.current = false;
          };

          a.onloadedmetadata = () => {
            if (a.duration && !isNaN(a.duration)) {
              setDuration(Math.round(a.duration));
            }
          };

          a.ontimeupdate = () => {
            setCurrentTime(Math.round(a.currentTime));
          };

          a.onended = () => {
            setIsPlaying(false);
            setCurrentTime(0);
          };

          return () => {
            a.pause();
            a.src = '';
          };
        } catch (e) {
          isHtmlAudioSupported.current = false;
        }
      }
    }
  }, [audio.uri]);

  // 배속 및 음소거 변경 반영
  useEffect(() => {
    if (audioRef.current && isHtmlAudioSupported.current) {
      audioRef.current.playbackRate = playbackSpeed;
      audioRef.current.muted = isMuted;
    }
  }, [playbackSpeed, isMuted]);

  // 재생 타이머 (실제 HTML5 오디오가 없거나 시뮬레이션일 때)
  useEffect(() => {
    let timer: any = null;
    let animTimer: any = null;

    if (isPlaying) {
      // 1. 재생 진행 타이머
      if (!audioRef.current || !isHtmlAudioSupported.current) {
        const intervalMs = Math.round(1000 / playbackSpeed);
        timer = setInterval(() => {
          setCurrentTime((prev) => {
            if (prev >= duration) {
              setIsPlaying(false);
              return 0;
            }
            return prev + 1;
          });
        }, intervalMs);
      }

      // 2. 실시간 파형 애니메이션 펄스 틱
      animTimer = setInterval(() => {
        setAnimTick((t) => (t + 1) % 6);
      }, 150);
    }

    return () => {
      if (timer) clearInterval(timer);
      if (animTimer) clearInterval(animTimer);
    };
  }, [isPlaying, duration, playbackSpeed]);

  const togglePlay = () => {
    if (Platform.OS === 'web' && audioRef.current && isHtmlAudioSupported.current) {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        audioRef.current
          .play()
          .then(() => setIsPlaying(true))
          .catch(() => {
            isHtmlAudioSupported.current = false;
            setIsPlaying(true);
          });
      }
    } else {
      setIsPlaying(!isPlaying);
    }
  };

  // 특정 시간대로 시크 (Seek)
  const seekTo = (targetSec: number) => {
    const clamped = Math.max(0, Math.min(duration, Math.round(targetSec)));
    setCurrentTime(clamped);
    if (audioRef.current && isHtmlAudioSupported.current) {
      audioRef.current.currentTime = clamped;
    }
  };

  // 상대 시간 점프 (±5초 탐색)
  const seekRelative = (deltaSec: number) => {
    seekTo(currentTime + deltaSec);
  };

  // 배속 순환 (1.0x -> 1.25x -> 1.5x -> 2.0x)
  const cycleSpeed = () => {
    const speeds: Array<1.0 | 1.25 | 1.5 | 2.0> = [1.0, 1.25, 1.5, 2.0];
    const nextIdx = (speeds.indexOf(playbackSpeed) + 1) % speeds.length;
    setPlaybackSpeed(speeds[nextIdx]);
  };

  // 음소거 토글
  const toggleMute = () => {
    setIsMuted((prev) => !prev);
  };

  // 제목 저장 및 취소 핸들러
  const handleSaveTitle = () => {
    const trimmed = tempTitle.trim();
    if (onUpdateTitle) {
      onUpdateTitle(trimmed || defaultTitle);
    }
    setIsEditingTitle(false);
  };

  const handleCancelTitle = () => {
    setTempTitle(audio.title || defaultTitle);
    setIsEditingTitle(false);
  };

  // 파형 클릭/터치 시 해당 위치로 시크
  const handleWaveformPress = (e: any) => {
    let clickX = e.nativeEvent?.locationX;
    const width = trackLayoutWidthRef.current || 180;
    if (clickX === undefined && Platform.OS === 'web') {
      const rect = e.currentTarget?.getBoundingClientRect?.();
      if (rect) {
        clickX = e.nativeEvent?.clientX - rect.left;
      }
    }
    if (clickX !== undefined && width > 0) {
      const ratio = Math.max(0, Math.min(1, clickX / width));
      seekTo(ratio * duration);
    }
  };

  const formatSec = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const progressRatio = duration > 0 ? Math.min(1, currentTime / duration) : 0;
  const activeBarIndex = Math.floor(progressRatio * WAVE_BARS_COUNT);

  return (
    <View style={styles.container}>
      {/* 1. 최상단 타이틀 & 페이지 배지 & 메타 정보 바 */}
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          {resolvedPageIndex !== undefined ? (
            <TouchableOpacity
              activeOpacity={onPressPageBadge ? 0.75 : 1}
              onPress={() => onPressPageBadge && onPressPageBadge(resolvedPageIndex)}
              style={styles.pageBadge}
            >
              <Text style={styles.pageBadgeText}>P.{resolvedPageIndex}</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.recordSeqBadge}>
              <Text style={styles.recordSeqBadgeText}>녹음 {index !== undefined ? index + 1 : 1}</Text>
            </View>
          )}

          {isEditingTitle ? (
            <View style={styles.inlineEditRow}>
              <TextInput
                value={tempTitle}
                onChangeText={setTempTitle}
                style={styles.inlineTitleInput}
                placeholder="제목 입력..."
                placeholderTextColor="#94A3B8"
                autoFocus
                onSubmitEditing={handleSaveTitle}
              />
              <TouchableOpacity onPress={handleSaveTitle} style={styles.editActionBtn} hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}>
                <Ionicons name="checkmark" size={13} color="#16A34A" />
              </TouchableOpacity>
              <TouchableOpacity onPress={handleCancelTitle} style={styles.editActionBtn} hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}>
                <Ionicons name="close" size={13} color="#64748B" />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              onPress={() => {
                if (onUpdateTitle) {
                  setTempTitle(audio.title || defaultTitle);
                  setIsEditingTitle(true);
                }
              }}
              disabled={!onUpdateTitle}
              style={styles.titleTouch}
              activeOpacity={0.7}
            >
              <Ionicons name="mic" size={11} color={accentColor || '#2563EB'} style={{ marginRight: 3 }} />
              <Text style={styles.audioTitleText} numberOfLines={1}>
                {audio.title || defaultTitle}
              </Text>
              {onUpdateTitle && (
                <Ionicons name="pencil-outline" size={10} color="#94A3B8" style={{ marginLeft: 4 }} />
              )}
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.headerRight}>
          {formattedTime ? (
            <Text style={styles.createdAtText}>{formattedTime}</Text>
          ) : null}
          {onDelete && (
            <TouchableOpacity
              onPress={onDelete}
              style={styles.deleteBtn}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <Ionicons name="trash-outline" size={12} color="#94A3B8" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* 2. 메인 플레이어 데크: [재생 버튼] + [24-바 파형 스크러버] + [배속 칩] */}
      <View style={styles.topPlayerRow}>
        <TouchableOpacity
          style={[styles.playBtn, { backgroundColor: accentColor || '#2563EB' }]}
          onPress={togglePlay}
          activeOpacity={0.82}
          hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
        >
          <Ionicons
            name={isPlaying ? 'pause' : 'play'}
            size={13}
            color="#FFFFFF"
            style={{ marginLeft: isPlaying ? 0 : 2 }}
          />
        </TouchableOpacity>

        {/* Interactive Sound Waveform Scrubber */}
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={handleWaveformPress}
          onLayout={(e) => {
            trackLayoutWidthRef.current = e.nativeEvent.layout.width;
          }}
          style={styles.waveformContainer}
          {...(Platform.OS === 'web' ? ({ onClick: handleWaveformPress } as any) : {})}
        >
          {waveformHeights.map((h, idx) => {
            const isPast = idx <= activeBarIndex;
            const isCurrent = idx === activeBarIndex && isPlaying;
            const dynamicHeight = isCurrent
              ? Math.min(28, h + (animTick % 2 === 0 ? 5 : -3))
              : h;

            return (
              <View
                key={idx}
                style={[
                  styles.waveformBar,
                  {
                    height: dynamicHeight,
                    backgroundColor: isPast ? (accentColor || '#2563EB') : '#CBD5E1',
                    opacity: isPast ? 1 : 0.65,
                    transform: isCurrent ? [{ scaleY: 1.15 }] : undefined,
                  },
                ]}
              />
            );
          })}
        </TouchableOpacity>

        {/* Speed Cycler Chip */}
        <TouchableOpacity
          style={[
            styles.speedBtn,
            playbackSpeed !== 1.0 && styles.speedBtnActive,
          ]}
          onPress={cycleSpeed}
          activeOpacity={0.75}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          <Text
            style={[
              styles.speedBtnText,
              playbackSpeed !== 1.0 && styles.speedBtnTextActive,
            ]}
          >
            {playbackSpeed}x
          </Text>
        </TouchableOpacity>
      </View>

      {/* 3. 하단 퀵 컨트롤 & 타임라인 바: [진행 시간] + [-5초] [+5초] [처음으로] [음소거] */}
      <View style={styles.quickControlsBar}>
        <Text style={styles.timeText}>
          {formatSec(currentTime)} / {formatSec(duration)}
        </Text>

        <View style={styles.quickSeekGroup}>
          {/* -5s Rewind */}
          <TouchableOpacity
            style={styles.quickActionBtn}
            onPress={() => seekRelative(-5)}
            activeOpacity={0.7}
            hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
          >
            <Ionicons name="play-back" size={10} color="#475569" />
            <Text style={styles.quickActionText}>-5초</Text>
          </TouchableOpacity>

          {/* +5s Fast Forward */}
          <TouchableOpacity
            style={styles.quickActionBtn}
            onPress={() => seekRelative(5)}
            activeOpacity={0.7}
            hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
          >
            <Ionicons name="play-forward" size={10} color="#475569" />
            <Text style={styles.quickActionText}>+5초</Text>
          </TouchableOpacity>

          {/* Jump to Start */}
          <TouchableOpacity
            style={styles.quickActionBtn}
            onPress={() => seekTo(0)}
            activeOpacity={0.7}
            hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
          >
            <Ionicons name="reload-outline" size={10} color="#475569" />
            <Text style={styles.quickActionText}>처음으로</Text>
          </TouchableOpacity>

          {/* Mute Toggle */}
          <TouchableOpacity
            style={[styles.muteBtn, isMuted && styles.muteBtnActive]}
            onPress={toggleMute}
            activeOpacity={0.7}
            hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
          >
            <Ionicons
              name={isMuted ? 'volume-mute' : 'volume-medium'}
              size={12}
              color={isMuted ? '#EF4444' : '#64748B'}
            />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingTop: 7,
    paddingBottom: 6,
    marginVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
    gap: 5,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 4,
    borderBottomWidth: 0.6,
    borderBottomColor: '#F1F5F9',
    gap: 6,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 5,
    overflow: 'hidden',
  },
  pageBadge: {
    backgroundColor: '#EFF6FF',
    borderWidth: 0.8,
    borderColor: '#BFDBFE',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  pageBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#1D4ED8',
  },
  recordSeqBadge: {
    backgroundColor: '#F1F5F9',
    borderWidth: 0.8,
    borderColor: '#CBD5E1',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  recordSeqBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#475569',
  },
  titleTouch: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  audioTitleText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1E293B',
    flexShrink: 1,
  },
  inlineEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 3,
  },
  inlineTitleInput: {
    flex: 1,
    fontSize: 10.5,
    fontWeight: '600',
    color: '#0F172A',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#3B82F6',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    height: 22,
  },
  editActionBtn: {
    padding: 2.5,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  createdAtText: {
    fontSize: 9,
    color: '#94A3B8',
    fontWeight: '500',
  },
  topPlayerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  playBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  waveformContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 26,
    paddingVertical: 2,
  },
  waveformBar: {
    width: 2.5,
    borderRadius: 1.5,
  },
  speedBtn: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 0.8,
    borderColor: '#E2E8F0',
  },
  speedBtnActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#93C5FD',
  },
  speedBtnText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#64748B',
  },
  speedBtnTextActive: {
    color: '#2563EB',
  },
  deleteBtn: {
    padding: 2,
  },
  quickControlsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 3,
    borderTopWidth: 0.6,
    borderTopColor: '#F8FAFC',
  },
  timeText: {
    fontSize: 9,
    color: '#64748B',
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  quickSeekGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  quickActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2.5,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 4,
    borderWidth: 0.6,
    borderColor: '#E2E8F0',
  },
  quickActionText: {
    fontSize: 8.5,
    fontWeight: '600',
    color: '#475569',
  },
  muteBtn: {
    padding: 2.5,
    borderRadius: 4,
  },
  muteBtnActive: {
    backgroundColor: '#FEE2E2',
  },
});
