import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Platform,
} from 'react-native';
import {
  Mic,
  Square,
  Play,
  Pause,
  RotateCcw,
  Trash2,
  Volume2,
  X,
} from 'lucide-react-native';
import { AudioNote } from '../types/note';

interface AudioRecordingStudioProps {
  isRecording: boolean;
  onStopRecording: (audioNote: AudioNote) => void;
  onCancelRecording: () => void;
  audioNotes?: AudioNote[];
  onDeleteAudio?: (id: string) => void;
}

export const AudioRecordingStudio: React.FC<AudioRecordingStudioProps> = ({
  isRecording,
  onStopRecording,
  onCancelRecording,
  audioNotes = [],
  onDeleteAudio,
}) => {
  // 녹음 타이머
  const [seconds, setSeconds] = useState(0);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // 재생 상태
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [playProgress, setPlayProgress] = useState<number>(0);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);

  // 녹음 타이머 및 펄스 애니메이션
  useEffect(() => {
    let interval: any = null;
    if (isRecording) {
      setSeconds(0);
      interval = setInterval(() => {
        setSeconds((prev) => prev + 1);
      }, 1000);

      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.3,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRecording]);

  // 재생 시뮬레이션
  useEffect(() => {
    let playInterval: any = null;
    if (playingId) {
      playInterval = setInterval(() => {
        setPlayProgress((prev) => {
          if (prev >= 1) {
            setPlayingId(null);
            return 0;
          }
          return prev + 0.05 * playbackSpeed;
        });
      }, 300);
    } else {
      setPlayProgress(0);
    }
    return () => {
      if (playInterval) clearInterval(playInterval);
    };
  }, [playingId, playbackSpeed]);

  const formatTime = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleDoneRecording = () => {
    const duration = Math.max(1, seconds);
    const seq = (audioNotes?.length || 0) + 1;
    const newAudio: AudioNote = {
      id: 'audio_' + Date.now(),
      uri: 'recording_' + Date.now() + '.m4a',
      duration,
      createdAt: Date.now(),
      title: `녹음 ${seq}`,
    };
    onStopRecording(newAudio);
  };

  const togglePlaybackSpeed = () => {
    setPlaybackSpeed((prev) => (prev === 1.0 ? 1.25 : prev === 1.25 ? 1.5 : prev === 1.5 ? 2.0 : 1.0));
  };

  return (
    <View style={styles.container}>
      {/* 1. 활성 녹음 중 플로팅 바 (Notewise / Goodnotes 스타일) */}
      {isRecording && (
        <View style={styles.floatingRecordingPill}>
          <View style={styles.recordingLeft}>
            <Animated.View
              style={[
                styles.recDot,
                { transform: [{ scale: pulseAnim }] },
              ]}
            />
            <Text style={styles.recLabel}>REC</Text>
            <Text style={styles.recTimer}>{formatTime(seconds)}</Text>

            {/* 음성 파형 시뮬레이션 바 */}
            <View style={styles.waveformContainer}>
              {[12, 24, 18, 28, 16, 22, 14, 26, 18].map((h, i) => (
                <View
                  key={i}
                  style={[
                    styles.waveBar,
                    {
                      height: (h * (0.6 + (seconds % 3) * 0.2)),
                      backgroundColor: '#EF4444',
                    },
                  ]}
                />
              ))}
            </View>
          </View>

          <View style={styles.recordingActions}>
            <TouchableOpacity
              style={styles.stopBtn}
              onPress={handleDoneRecording}
              {...(Platform.OS === 'web' ? { onClick: handleDoneRecording } : {})}
              activeOpacity={0.8}
            >
              <Square size={13} color="#FFFFFF" fill="#FFFFFF" />
              <Text style={styles.stopBtnText}>완료</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={onCancelRecording}
              {...(Platform.OS === 'web' ? { onClick: onCancelRecording } : {})}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <X size={15} color="#94A3B8" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* 2. 녹음 완료된 오디오 플레이어 목록 (메모 상단에 깔끔하게 부착) */}
      {audioNotes && audioNotes.length > 0 && (
        <View style={styles.playerListContainer}>
          {audioNotes.map((audio) => {
            const isPlaying = playingId === audio.id;
            const currentSec = Math.floor((audio.duration || 10) * (isPlaying ? playProgress : 0));
            const totalSec = audio.duration || 10;

            return (
              <View key={audio.id} style={styles.audioPlayerTrack}>
                {/* Play/Pause Button */}
                <TouchableOpacity
                  style={[styles.playPauseBtn, isPlaying && styles.playPauseBtnActive]}
                  onPress={() => setPlayingId(isPlaying ? null : audio.id)}
                  activeOpacity={0.8}
                >
                  {isPlaying ? (
                    <Pause size={14} color="#FFFFFF" fill="#FFFFFF" />
                  ) : (
                    <Play size={14} color="#2563EB" fill="#2563EB" style={{ marginLeft: 2 }} />
                  )}
                </TouchableOpacity>

                {/* Progress & Waveform */}
                <View style={styles.trackInfoArea}>
                  <View style={styles.trackTimeRow}>
                    <Text style={styles.trackTimerText}>
                      {formatTime(currentSec)} / {formatTime(totalSec)}
                    </Text>
                    <TouchableOpacity
                      style={styles.speedPill}
                      onPress={togglePlaybackSpeed}
                    >
                      <Text style={styles.speedText}>{playbackSpeed}x</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Equalizer Waveform Indicator */}
                  <View style={styles.trackWaveform}>
                    {Array.from({ length: 28 }).map((_, idx) => {
                      const isActive = (idx / 28) <= (isPlaying ? playProgress : 0);
                      const height = 4 + (Math.sin(idx * 0.7) + 1) * 7;
                      return (
                        <View
                          key={idx}
                          style={[
                            styles.trackWaveBar,
                            {
                              height,
                              backgroundColor: isActive ? '#2563EB' : '#CBD5E1',
                            },
                          ]}
                        />
                      );
                    })}
                  </View>
                </View>

                {/* Delete Audio */}
                {onDeleteAudio && (
                  <TouchableOpacity
                    style={styles.deleteAudioBtn}
                    onPress={() => onDeleteAudio(audio.id)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Trash2 size={13} color="#94A3B8" />
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  floatingRecordingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginVertical: 8,
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
    borderWidth: 1.5,
    borderColor: '#FCA5A5',
  },
  recordingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  recDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#EF4444',
  },
  recLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#EF4444',
    letterSpacing: 0.5,
  },
  recTimer: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    fontVariant: ['tabular-nums'],
  },
  waveformContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginLeft: 6,
    height: 24,
  },
  waveBar: {
    width: 2.5,
    borderRadius: 1.5,
  },
  recordingActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stopBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#EF4444',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  stopBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  cancelBtn: {
    padding: 4,
  },
  playerListContainer: {
    gap: 8,
    marginVertical: 6,
  },
  audioPlayerTrack: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 10,
  },
  playPauseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playPauseBtnActive: {
    backgroundColor: '#2563EB',
  },
  trackInfoArea: {
    flex: 1,
  },
  trackTimeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  trackTimerText: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#475569',
    fontVariant: ['tabular-nums'],
  },
  speedPill: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    backgroundColor: '#F1F5F9',
  },
  speedText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#475569',
  },
  trackWaveform: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    height: 16,
  },
  trackWaveBar: {
    width: 2.5,
    borderRadius: 1,
  },
  deleteAudioBtn: {
    padding: 6,
  },
});
