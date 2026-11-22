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

// 마이크 권한 거부/미지원 환경에서도 실제 HTMLAudioElement로 재생 가능한 16-bit PCM WAV data URL 생성
function buildPlayableWavDataUrl(durationSec: number): string {
  const sampleRate = 8000;
  const totalSamples = Math.max(sampleRate, Math.min(sampleRate * 15, durationSec * sampleRate));
  const buffer = new ArrayBuffer(44 + totalSamples * 2);
  const view = new DataView(buffer);
  const writeStr = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + totalSamples * 2, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, totalSamples * 2, true);

  for (let i = 0; i < totalSamples; i++) {
    const t = i / sampleRate;
    const envelope = Math.exp(-3.5 * (t % 1));
    const sample = Math.sin(2 * Math.PI * 523.25 * t) * 0.18 * envelope;
    view.setInt16(44 + i * 2, Math.round(sample * 32767), true);
  }

  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
  }
  const b64 = typeof btoa === 'function' ? btoa(binary) : '';
  return `data:audio/wav;base64,${b64}`;
}

export const AudioRecordingStudio: React.FC<AudioRecordingStudioProps> = ({
  isRecording,
  onStopRecording,
  onCancelRecording,
  audioNotes = [],
  onDeleteAudio,
}) => {
  // 녹음 타이머 및 마이크 레코더
  const [seconds, setSeconds] = useState(0);
  const secondsRef = useRef(0);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const mediaRecorderRef = useRef<any>(null);
  const mediaStreamRef = useRef<any>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  // 실제 오디오 재생 상태
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [playProgress, setPlayProgress] = useState<number>(0);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const htmlAudioRef = useRef<HTMLAudioElement | null>(null);

  const stopMediaStream = () => {
    if (mediaStreamRef.current) {
      try {
        mediaStreamRef.current.getTracks().forEach((t: any) => t.stop());
      } catch {
        // ignore
      }
      mediaStreamRef.current = null;
    }
  };

  // 녹음 시작: 실제 마이크 스트림 연결 + 타이머 및 펄스 애니메이션
  useEffect(() => {
    let interval: any = null;
    let cancelled = false;

    if (isRecording) {
      setSeconds(0);
      secondsRef.current = 0;
      recordedChunksRef.current = [];

      if (
        Platform.OS === 'web' &&
        typeof navigator !== 'undefined' &&
        navigator.mediaDevices?.getUserMedia &&
        typeof (window as any).MediaRecorder !== 'undefined'
      ) {
        navigator.mediaDevices
          .getUserMedia({ audio: true })
          .then((stream) => {
            if (cancelled) {
              stream.getTracks().forEach((t) => t.stop());
              return;
            }
            mediaStreamRef.current = stream;
            const MR = (window as any).MediaRecorder;
            const recorder = new MR(stream);
            recordedChunksRef.current = [];
            recorder.ondataavailable = (e: any) => {
              if (e.data && e.data.size > 0) {
                recordedChunksRef.current.push(e.data);
              }
            };
            recorder.start(200);
            mediaRecorderRef.current = recorder;
          })
          .catch(() => {
            mediaRecorderRef.current = null;
          });
      }

      interval = setInterval(() => {
        setSeconds((prev) => {
          const next = prev + 1;
          secondsRef.current = next;
          return next;
        });
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
      stopMediaStream();
    }
    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
    };
  }, [isRecording]);

  // 실제 오디오 재생 (HTMLAudioElement 우선 + 진행률 동기화)
  useEffect(() => {
    if (htmlAudioRef.current) {
      htmlAudioRef.current.pause();
      htmlAudioRef.current = null;
    }
    if (!playingId) {
      setPlayProgress(0);
      return;
    }

    const target = audioNotes.find((a) => a.id === playingId);
    if (
      Platform.OS === 'web' &&
      target?.uri &&
      (target.uri.startsWith('data:audio') ||
        target.uri.startsWith('blob:') ||
        target.uri.startsWith('http'))
    ) {
      try {
        const a = new Audio(target.uri);
        a.playbackRate = playbackSpeed;
        htmlAudioRef.current = a;
        a.ontimeupdate = () => {
          const total = a.duration && !isNaN(a.duration) ? a.duration : target.duration || 1;
          setPlayProgress(Math.min(1, a.currentTime / Math.max(0.1, total)));
        };
        a.onended = () => {
          setPlayingId(null);
          setPlayProgress(0);
        };
        a.play().catch(() => {
          setPlayingId(null);
        });
        return () => {
          a.pause();
          a.src = '';
        };
      } catch {
        // fallback below
      }
    }

    const playInterval = setInterval(() => {
      setPlayProgress((prev) => {
        if (prev >= 1) {
          setPlayingId(null);
          return 0;
        }
        return prev + 0.05 * playbackSpeed;
      });
    }, 300);
    return () => clearInterval(playInterval);
  }, [playingId, playbackSpeed, audioNotes]);

  const formatTime = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const finalizeWithUri = (uri: string, duration: number) => {
    const seq = (audioNotes?.length || 0) + 1;
    const newAudio: AudioNote = {
      id: 'audio_' + Date.now(),
      uri,
      duration,
      createdAt: Date.now(),
      title: `녹음 ${seq}`,
    };
    onStopRecording(newAudio);
  };

  const handleDoneRecording = () => {
    const duration = Math.max(1, secondsRef.current || seconds);
    const recorder = mediaRecorderRef.current;

    if (recorder && recorder.state !== 'inactive') {
      recorder.onstop = () => {
        stopMediaStream();
        const mime = recorder.mimeType || 'audio/webm';
        const blob = new Blob(recordedChunksRef.current, { type: mime });
        recordedChunksRef.current = [];
        if (blob.size > 0 && typeof FileReader !== 'undefined') {
          const reader = new FileReader();
          reader.onloadend = () => {
            const dataUrl =
              typeof reader.result === 'string' && reader.result.startsWith('data:audio')
                ? reader.result
                : buildPlayableWavDataUrl(duration);
            finalizeWithUri(dataUrl, duration);
          };
          reader.readAsDataURL(blob);
        } else {
          finalizeWithUri(buildPlayableWavDataUrl(duration), duration);
        }
      };
      try {
        recorder.stop();
        mediaRecorderRef.current = null;
        return;
      } catch {
        // fallback
      }
    }

    stopMediaStream();
    finalizeWithUri(buildPlayableWavDataUrl(duration), duration);
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

            {/* 음성 파형 인디케이터 */}
            <View style={styles.waveformContainer}>
              {[10, 18, 14, 20, 12, 16, 11, 19, 13].map((h, i) => (
                <View
                  key={i}
                  style={[
                    styles.waveBar,
                    {
                      height: h,
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
              onPress={() => {
                stopMediaStream();
                onCancelRecording();
              }}
              {...(Platform.OS === 'web'
                ? {
                    onClick: () => {
                      stopMediaStream();
                      onCancelRecording();
                    },
                  }
                : {})}
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
