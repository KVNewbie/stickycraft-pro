import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  PanResponder,
  Platform,
  Animated,
} from 'react-native';
import {
  Mic,
  Play,
  Pause,
  Trash2,
  X,
  GripVertical,
} from 'lucide-react-native';
import { Ionicons } from '@expo/vector-icons';
import { AudioNote } from '../types/note';

interface DraggableAudioPinProps {
  audio: AudioNote;
  containerWidth?: number;
  containerHeight?: number;
  onUpdatePosition: (id: string, x: number, y: number) => void;
  onDelete: (id: string) => void;
  defaultExpanded?: boolean;
}

const PIN_WAVE_BARS_COUNT = 18;

// 고유 오디오 ID 기반 파형 바 높이 생성
const getPinWaveformHeights = (seed: string): number[] => {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  const heights: number[] = [];
  for (let i = 0; i < PIN_WAVE_BARS_COUNT; i++) {
    const bellFactor = Math.sin(((i + 1) / (PIN_WAVE_BARS_COUNT + 1)) * Math.PI);
    const pseudoRand = Math.abs(Math.sin((hash + i * 17) * 9999));
    const h = Math.round(5 + bellFactor * 12 + pseudoRand * 7);
    heights.push(Math.min(22, Math.max(4, h)));
  }
  return heights;
};

export const DraggableAudioPin: React.FC<DraggableAudioPinProps> = ({
  audio,
  containerWidth = 720,
  containerHeight = 1018,
  onUpdatePosition,
  onDelete,
  defaultExpanded = false,
}) => {
  const [position, setPosition] = useState({
    x: audio.x ?? 60,
    y: audio.y ?? 120,
  });
  const [isDragging, setIsDragging] = useState(false);
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  // 실시간 재생 및 컨트롤 상태
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(audio.duration || 10);
  const [playbackSpeed, setPlaybackSpeed] = useState<1.0 | 1.25 | 1.5 | 2.0>(1.0);
  const [isMuted, setIsMuted] = useState(false);
  const [animTick, setAnimTick] = useState(0);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const isHtmlAudioSupported = useRef(false);
  const trackLayoutWidthRef = useRef<number>(140);

  const posRef = useRef(position);
  posRef.current = position;

  const dragStartRef = useRef({ x: 0, y: 0 });
  const hasMovedRef = useRef(false);

  // 음성 파형 고유 높이 배열
  const waveformHeights = useMemo(() => {
    return getPinWaveformHeights(audio.id || audio.uri || 'pin-audio');
  }, [audio.id, audio.uri]);

  // 동기화: audio.x, audio.y 변경 시
  useEffect(() => {
    if (audio.x !== undefined && audio.y !== undefined) {
      setPosition({ x: audio.x, y: audio.y });
    }
  }, [audio.x, audio.y]);

  // HTML5 Audio 초기화
  useEffect(() => {
    if (Platform.OS === 'web' && audio.uri) {
      const isValidRemoteUrl =
        audio.uri.startsWith('http://') ||
        audio.uri.startsWith('https://') ||
        audio.uri.startsWith('data:audio') ||
        audio.uri.startsWith('blob:');

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

      animTimer = setInterval(() => {
        setAnimTick((t) => (t + 1) % 6);
      }, 150);
    }

    return () => {
      if (timer) clearInterval(timer);
      if (animTimer) clearInterval(animTimer);
    };
  }, [isPlaying, duration, playbackSpeed]);

  const formatTime = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

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

  // 파형 클릭/터치 시 해당 위치로 시크
  const handleWaveformPress = (e: any) => {
    let clickX = e.nativeEvent?.locationX;
    const width = trackLayoutWidthRef.current || 140;
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

  const isExpandedRef = useRef(isExpanded);
  isExpandedRef.current = isExpanded;

  const isDraggingRef = useRef(false);
  const dragStartMouseRef = useRef({ x: 0, y: 0 });
  const startPosRef = useRef({ x: 0, y: 0 });

  // 모바일 / 터치 및 웹 반응형 PanResponder
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (_, gesture) => {
        return Math.abs(gesture.dx) > 3 || Math.abs(gesture.dy) > 3;
      },
      onMoveShouldSetPanResponderCapture: (_, gesture) => {
        return Math.abs(gesture.dx) > 3 || Math.abs(gesture.dy) > 3;
      },
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        setIsDragging(true);
        hasMovedRef.current = false;
        dragStartRef.current = { x: posRef.current.x, y: posRef.current.y };
      },
      onPanResponderMove: (_, gesture) => {
        if (Math.abs(gesture.dx) > 3 || Math.abs(gesture.dy) > 3) {
          hasMovedRef.current = true;
        }
        const maxX = Math.max(10, containerWidth - (isExpandedRef.current ? 320 : 120));
        const maxY = Math.max(10, containerHeight - 60);
        const newX = Math.max(10, Math.min(maxX, dragStartRef.current.x + gesture.dx));
        const newY = Math.max(10, Math.min(maxY, dragStartRef.current.y + gesture.dy));
        setPosition({ x: newX, y: newY });
      },
      onPanResponderRelease: (_, gesture) => {
        setIsDragging(false);
        const didMove = Math.abs(gesture.dx) >= 4 || Math.abs(gesture.dy) >= 4;
        if (didMove) {
          const maxX = Math.max(10, containerWidth - (isExpandedRef.current ? 320 : 120));
          const maxY = Math.max(10, containerHeight - 60);
          const finalX = Math.max(10, Math.min(maxX, dragStartRef.current.x + gesture.dx));
          const finalY = Math.max(10, Math.min(maxY, dragStartRef.current.y + gesture.dy));
          setPosition({ x: finalX, y: finalY });
          onUpdatePosition(audio.id, finalX, finalY);
        } else if (!isExpandedRef.current) {
          setIsExpanded(true);
        }
      },
      onPanResponderTerminate: () => {
        setIsDragging(false);
      },
    })
  ).current;

  // 데스크톱 Web 마우스 드래그 핸들러
  const handleWebMouseDown = (e: any) => {
    if (Platform.OS !== 'web') return;
    e.stopPropagation?.();
    const target = e.target as HTMLElement;
    // 확장 상태에서는 전용 드래그 핸들을 클릭했을 때만 드래그 동작
    if (isExpandedRef.current && !target?.closest?.('[data-drag-handle="true"]')) {
      return;
    }

    isDraggingRef.current = true;
    hasMovedRef.current = false;
    dragStartMouseRef.current = { x: e.clientX, y: e.clientY };
    startPosRef.current = { x: posRef.current.x, y: posRef.current.y };

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const dx = moveEvent.clientX - dragStartMouseRef.current.x;
      const dy = moveEvent.clientY - dragStartMouseRef.current.y;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        hasMovedRef.current = true;
        setIsDragging(true);
      }
      const maxX = Math.max(10, containerWidth - (isExpandedRef.current ? 320 : 120));
      const maxY = Math.max(10, containerHeight - 60);
      const newX = Math.max(10, Math.min(maxX, startPosRef.current.x + dx));
      const newY = Math.max(10, Math.min(maxY, startPosRef.current.y + dy));
      setPosition({ x: newX, y: newY });
    };

    const onMouseUp = (upEvent: MouseEvent) => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;
      setIsDragging(false);

      const dx = upEvent.clientX - dragStartMouseRef.current.x;
      const dy = upEvent.clientY - dragStartMouseRef.current.y;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        hasMovedRef.current = true;
        const maxX = Math.max(10, containerWidth - (isExpandedRef.current ? 320 : 120));
        const maxY = Math.max(10, containerHeight - 60);
        const finalX = Math.max(10, Math.min(maxX, startPosRef.current.x + dx));
        const finalY = Math.max(10, Math.min(maxY, startPosRef.current.y + dy));
        setPosition({ x: finalX, y: finalY });
        onUpdatePosition(audio.id, finalX, finalY);
      } else {
        hasMovedRef.current = false;
        setIsExpanded(true);
      }
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const handleStampClick = (e: any) => {
    e?.stopPropagation?.();
    setIsExpanded(true);
  };

  return (
    <View
      style={[
        styles.pinContainer,
        {
          left: position.x,
          top: position.y,
          zIndex: isDragging ? 9999 : 50,
          transform: [{ scale: isDragging ? 1.04 : 1 }],
        },
      ]}
    >
      {!isExpanded ? (
        /* 1. 축소된 콤팩트 오디오 스탬프 / 핀 (Notewise & Noteshelf 스타일) */
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => setIsExpanded(true)}
          {...(Platform.OS === 'web'
            ? ({
                onMouseDown: handleWebMouseDown,
                onClick: handleStampClick,
              } as any)
            : panResponder.panHandlers)}
          style={[styles.collapsedStamp, isPlaying && styles.collapsedStampPlaying]}
        >
          <View style={styles.stampGrip}>
            <GripVertical size={13} color="#94A3B8" />
          </View>
          <View style={[styles.stampMicBadge, isPlaying && styles.stampMicBadgePlaying]}>
            <Mic size={13} color={isPlaying ? '#FFFFFF' : '#2563EB'} />
          </View>
          <Text style={styles.stampDurationText}>
            {audio.pageIndex ? `P.${audio.pageIndex} ` : ''}{formatTime(audio.duration)}
          </Text>
          {isPlaying && (
            <View style={styles.miniPlayingDot} />
          )}
        </TouchableOpacity>
      ) : (
        /* 2. 확장된 플로팅 오디오 플레이어 바 (Notewise & Goodnotes 3단 덱) */
        <View style={styles.expandedPlayerCard}>
          {/* Tier 1: 상단 헤더 [드래그 핸들] + [페이지 배지 & 제목] + [삭제] + [접기] */}
          <View style={styles.expandedHeaderRow}>
            <View
              {...({ 'data-drag-handle': 'true' } as any)}
              {...(Platform.OS === 'web'
                ? ({
                    onMouseDown: handleWebMouseDown,
                  } as any)
                : {})}
              style={styles.expandedDragHandle}
              {...panResponder.panHandlers}
            >
              <GripVertical size={14} color="#64748B" />
            </View>

            <View style={styles.pinHeaderTitleWrap}>
              {audio.pageIndex !== undefined && (
                <View style={styles.pageMiniBadge}>
                  <Text style={styles.pageMiniBadgeText}>P.{audio.pageIndex}</Text>
                </View>
              )}
              <Text style={styles.pinTitleText} numberOfLines={1}>
                {audio.title || (audio.pageIndex ? `P.${audio.pageIndex} 음성 메모` : '음성 메모')}
              </Text>
            </View>

            <View style={styles.pinHeaderActions}>
              <TouchableOpacity
                style={styles.actionIconButton}
                onPress={() => onDelete(audio.id)}
                {...(Platform.OS === 'web' ? ({ onClick: () => onDelete(audio.id) } as any) : {})}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <Trash2 size={13} color="#EF4444" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionIconButton}
                onPress={() => setIsExpanded(false)}
                {...(Platform.OS === 'web' ? ({ onClick: () => setIsExpanded(false) } as any) : {})}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <X size={13} color="#64748B" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Tier 2: 메인 플레이어 데크 [재생 버튼] + [18-바 인터랙티브 파형 스크러버] + [배속 칩] */}
          <View style={styles.middlePlayerRow}>
            <TouchableOpacity
              style={[styles.playBtn, isPlaying && styles.playBtnActive]}
              onPress={togglePlay}
              {...(Platform.OS === 'web' ? ({ onClick: togglePlay } as any) : {})}
              activeOpacity={0.8}
            >
              {isPlaying ? (
                <Pause size={13} color="#FFFFFF" fill="#FFFFFF" />
              ) : (
                <Play size={13} color="#FFFFFF" fill="#FFFFFF" style={{ marginLeft: 1.5 }} />
              )}
            </TouchableOpacity>

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
                const progressRatio = duration > 0 ? currentTime / duration : 0;
                const activeBarIdx = Math.floor(progressRatio * PIN_WAVE_BARS_COUNT);
                const isPast = idx <= activeBarIdx;
                const isCurrent = idx === activeBarIdx && isPlaying;
                const dynamicHeight = isCurrent ? Math.min(24, h + (animTick % 2 === 0 ? 4 : -2)) : h;
                return (
                  <View
                    key={idx}
                    style={[
                      styles.waveBarItem,
                      {
                        height: dynamicHeight,
                        backgroundColor: isPast ? '#2563EB' : '#CBD5E1',
                        opacity: isPast ? 1 : 0.65,
                      },
                    ]}
                  />
                );
              })}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.speedButton, playbackSpeed !== 1.0 && styles.speedButtonActive]}
              onPress={cycleSpeed}
              {...(Platform.OS === 'web' ? ({ onClick: cycleSpeed } as any) : {})}
              activeOpacity={0.7}
            >
              <Text style={[styles.speedButtonText, playbackSpeed !== 1.0 && styles.speedButtonTextActive]}>
                {playbackSpeed}x
              </Text>
            </TouchableOpacity>
          </View>

          {/* Tier 3: 하단 퀵 컨트롤 바 [타임코드] + [-5초] [+5초] [처음으로] [음소거] */}
          <View style={styles.pinBottomControlsBar}>
            <Text style={styles.timerCurrentText}>
              {formatTime(currentTime)} <Text style={styles.timerTotalText}>/ {formatTime(duration)}</Text>
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

              {/* Restart */}
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
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  pinContainer: {
    position: 'absolute',
    ...Platform.select({
      web: {
        userSelect: 'none',
        cursor: 'pointer' as any,
      },
    }),
  },
  collapsedStamp: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderWidth: 1.5,
    borderColor: '#BFDBFE',
    gap: 6,
    ...Platform.select({
      ios: {
        shadowColor: '#2563EB',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
      },
      android: {
        elevation: 6,
      },
      web: {
        boxShadow: '0 4px 14px rgba(37, 99, 235, 0.22)',
      },
    }),
  },
  collapsedStampPlaying: {
    borderColor: '#3B82F6',
    backgroundColor: '#EFF6FF',
  },
  stampGrip: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  stampMicBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stampMicBadgePlaying: {
    backgroundColor: '#2563EB',
  },
  stampDurationText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E293B',
    letterSpacing: 0.2,
  },
  miniPlayingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#2563EB',
  },
  expandedPlayerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1.5,
    borderColor: '#93C5FD',
    gap: 6,
    minWidth: 310,
    ...Platform.select({
      ios: {
        shadowColor: '#1E293B',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.25,
        shadowRadius: 16,
      },
      android: {
        elevation: 10,
      },
      web: {
        boxShadow: '0 8px 24px rgba(15, 23, 42, 0.25)',
      },
    }),
  },
  expandedHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 4,
    borderBottomWidth: 0.6,
    borderBottomColor: '#F1F5F9',
    gap: 6,
  },
  expandedDragHandle: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingRight: 2,
    ...Platform.select({
      web: {
        cursor: 'grab' as any,
      },
    }),
  },
  pinHeaderTitleWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    overflow: 'hidden',
  },
  pageMiniBadge: {
    backgroundColor: '#EFF6FF',
    borderRadius: 3.5,
    paddingHorizontal: 4.5,
    paddingVertical: 1,
    borderWidth: 0.6,
    borderColor: '#BFDBFE',
  },
  pageMiniBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#1D4ED8',
  },
  pinTitleText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#1E293B',
    flexShrink: 1,
  },
  pinHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionIconButton: {
    padding: 4,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      web: {
        cursor: 'pointer',
      },
    }),
  },
  middlePlayerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  playBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      web: {
        cursor: 'pointer',
      },
    }),
  },
  playBtnActive: {
    backgroundColor: '#DC2626',
  },
  waveformContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 24,
    paddingVertical: 2,
  },
  waveBarItem: {
    width: 2.5,
    borderRadius: 1.5,
  },
  speedButton: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 5,
    backgroundColor: '#F1F5F9',
    borderWidth: 0.6,
    borderColor: '#E2E8F0',
  },
  speedButtonActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#93C5FD',
  },
  speedButtonText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#64748B',
  },
  speedButtonTextActive: {
    color: '#2563EB',
  },
  pinBottomControlsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 3,
    borderTopWidth: 0.6,
    borderTopColor: '#F8FAFC',
  },
  timerCurrentText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#0F172A',
    fontVariant: ['tabular-nums'],
  },
  timerTotalText: {
    fontSize: 9,
    fontWeight: '500',
    color: '#64748B',
  },
  quickSeekGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  quickActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
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
