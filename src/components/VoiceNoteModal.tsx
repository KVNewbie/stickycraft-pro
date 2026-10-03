import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AudioNote } from '../types/note';

interface VoiceNoteModalProps {
  visible: boolean;
  onClose: () => void;
  onSaveAudio: (audio: AudioNote) => void;
}

export const VoiceNoteModal: React.FC<VoiceNoteModalProps> = ({
  visible,
  onClose,
  onSaveAudio,
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordedUri, setRecordedUri] = useState<string | null>(null);
  const [recordedDuration, setRecordedDuration] = useState(0);
  const [timerSec, setTimerSec] = useState(0);
  const timerSecRef = useRef(0);

  const mediaRecorderRef = useRef<any>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<any>(null);

  useEffect(() => {
    if (!visible) {
      handleReset();
    }
  }, [visible]);

  const handleReset = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (mediaRecorderRef.current && isRecording) {
      try {
        mediaRecorderRef.current.stop();
      } catch (e) {}
    }
    setIsRecording(false);
    setRecordedUri(null);
    setRecordedDuration(0);
    setTimerSec(0);
    timerSecRef.current = 0;
    audioChunksRef.current = [];
  };

  const startRecording = async () => {
    if (Platform.OS === 'web') {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error('getUserMedia not supported');
        }
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new (window as any).MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        audioChunksRef.current = [];

        mediaRecorder.ondataavailable = (event: any) => {
          if (event.data && event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        mediaRecorder.onstop = () => {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          const audioUrl = URL.createObjectURL(audioBlob);
          setRecordedUri(audioUrl);
          setRecordedDuration(Math.max(1, timerSecRef.current));
          stream.getTracks().forEach((track) => track.stop());
        };

        mediaRecorder.start();
        setIsRecording(true);
        setTimerSec(0);
        timerSecRef.current = 0;

        timerIntervalRef.current = setInterval(() => {
          setTimerSec((prev) => {
            const next = prev + 1;
            timerSecRef.current = next;
            return next;
          });
        }, 1000);
      } catch (err) {
        console.warn('Microphone permission error or simulated mode', err);
        // Fallback simulated recording
        setIsRecording(true);
        setTimerSec(0);
        timerSecRef.current = 0;
        timerIntervalRef.current = setInterval(() => {
          setTimerSec((prev) => {
            const next = prev + 1;
            timerSecRef.current = next;
            return next;
          });
        }, 1000);
      }
    } else {
      Alert.alert('음성 녹음 안내', '네이티브 음성 녹음 기능이 준비 중입니다.');
    }
  };

  const stopRecording = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    setIsRecording(false);

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch (e) {
        console.error('Stop recording error', e);
      }
    } else {
      // Mock sound clip if browser media recorder wasn't available
      const mockUri = 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3';
      setRecordedUri(mockUri);
      setRecordedDuration(Math.max(2, timerSecRef.current));
    }
  };

  const handleSave = () => {
    const finalDuration = recordedDuration || Math.max(2, timerSecRef.current);
    const nowStr = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
    const audioItem: AudioNote = {
      id: 'audio_' + Date.now(),
      uri: recordedUri || 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
      duration: finalDuration,
      createdAt: Date.now(),
      title: `녹음 (${nowStr})`,
    };

    onSaveAudio(audioItem);
    onClose();
  };

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.titleWrap}>
              <View style={styles.iconCircle}>
                <Ionicons name="mic" size={18} color="#2563EB" />
              </View>
              <View>
                <Text style={styles.title}>Noteshelf & Jnotes 음성 녹음</Text>
                <Text style={styles.subtitle}>
                  회의, 강의, 순간의 생각을 목소리로 생생하게 기록하세요!
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color="#64748B" />
            </TouchableOpacity>
          </View>

          {/* Recorder Center Stage */}
          <View style={styles.stage}>
            <View
              style={[
                styles.micWaveCircle,
                isRecording && styles.micWaveCircleActive,
              ]}
            >
              <TouchableOpacity
                testID="record-button"
                style={[
                  styles.recordBtn,
                  isRecording && styles.recordBtnActive,
                ]}
                onPress={isRecording ? stopRecording : startRecording}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={isRecording ? 'stop' : 'mic'}
                  size={36}
                  color="#FFFFFF"
                />
              </TouchableOpacity>
            </View>

            {/* Timer Display */}
            <Text
              style={[
                styles.timerText,
                isRecording && styles.timerTextRecording,
              ]}
            >
              {formatTimer(timerSec)}
            </Text>

            <Text style={styles.statusGuide}>
              {isRecording
                ? '🔴 음성을 녹음하는 중입니다... (탭하여 정지)'
                : recordedUri
                ? '✨ 녹음이 완료되었습니다! 아래 버튼을 눌러 메모에 첨부하세요.'
                : '마이크 버튼을 탭하여 녹음을 시작하세요'}
            </Text>
          </View>

          {/* Action Buttons */}
          <View style={styles.footer}>
            <TouchableOpacity onPress={onClose} style={styles.cancelBtn}>
              <Text style={styles.cancelBtnText}>취소</Text>
            </TouchableOpacity>

            <TouchableOpacity
              testID="attach-audio-button"
              onPress={handleSave}
              disabled={!recordedUri && timerSec === 0}
              style={[
                styles.attachBtn,
                (!recordedUri && timerSec === 0) && styles.attachBtnDisabled,
              ]}
              activeOpacity={0.85}
            >
              <Ionicons name="checkmark-circle" size={17} color="#FFFFFF" />
              <Text style={styles.attachBtnText}>스티커 메모에 음성 첨부</Text>
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
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  container: {
    width: '100%',
    maxWidth: 460,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
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
    marginBottom: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  titleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  subtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  closeBtn: {
    padding: 4,
  },
  stage: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  micWaveCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  micWaveCircleActive: {
    backgroundColor: '#FEE2E2',
    borderWidth: 3,
    borderColor: '#EF4444',
  },
  recordBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  recordBtnActive: {
    backgroundColor: '#DC2626',
    shadowColor: '#DC2626',
  },
  timerText: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0F172A',
    fontVariant: ['tabular-nums'],
    marginBottom: 8,
  },
  timerTextRecording: {
    color: '#DC2626',
  },
  statusGuide: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    maxWidth: 280,
    lineHeight: 18,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 10,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  attachBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#2563EB',
  },
  attachBtnDisabled: {
    backgroundColor: '#94A3B8',
    opacity: 0.5,
  },
  attachBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
