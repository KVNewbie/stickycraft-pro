import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNoteStore } from '../store/useNoteStore';
import { Note, ReminderInfo } from '../types/note';

interface Props {
  visible: boolean;
  note: Note | null;
  onClose: () => void;
}

export const ReminderModal: React.FC<Props> = ({ visible, note, onClose }) => {
  const { setNoteReminder } = useNoteStore();

  const [date, setDate] = useState('');
  const [time, setTime] = useState('09:00');
  const [repeat, setRepeat] = useState<'none' | 'daily' | 'weekly' | 'monthly'>('none');
  const [pinToStatusBar, setPinToStatusBar] = useState(false);

  useEffect(() => {
    if (note && note.reminder) {
      setDate(note.reminder.date || '');
      setTime(note.reminder.time || '09:00');
      setRepeat(note.reminder.repeat || 'none');
      setPinToStatusBar(!!note.reminder.pinToStatusBar);
    } else {
      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(
        today.getDate()
      ).padStart(2, '0')}`;
      setDate(todayStr);
      setTime('09:00');
      setRepeat('none');
      setPinToStatusBar(false);
    }
  }, [note, visible]);

  if (!visible || !note) return null;

  const handleSetQuickDate = (offsetDays: number) => {
    const target = new Date();
    target.setDate(target.getDate() + offsetDays);
    const targetStr = `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}-${String(
      target.getDate()
    ).padStart(2, '0')}`;
    setDate(targetStr);
  };

  const handleSaveReminder = () => {
    if (!date) {
      if (Platform.OS === 'web') alert('날짜를 입력해주세요.');
      else Alert.alert('알림', '날짜를 입력해주세요.');
      return;
    }

    const reminder: ReminderInfo = {
      date,
      time,
      isCompleted: false,
      pinToStatusBar,
      repeat,
    };

    setNoteReminder(note.id, reminder);
    onClose();
  };

  const handleRemoveReminder = () => {
    setNoteReminder(note.id, undefined);
    onClose();
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
            <View style={styles.headerLeft}>
              <View style={styles.iconCircle}>
                <Ionicons name="alarm" size={20} color="#DC2626" />
              </View>
              <Text style={styles.title}>ColorNote 알람 & 리마인더</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color="#64748B" />
            </TouchableOpacity>
          </View>

          <Text style={styles.noteTargetTitle} numberOfLines={1}>
            대상 메모: {note.title || '제목 없는 메모'}
          </Text>

          {/* Quick Date Buttons */}
          <Text style={styles.label}>빠른 날짜 지정</Text>
          <View style={styles.quickDateRow}>
            {[
              { label: '오늘', offset: 0 },
              { label: '내일', offset: 1 },
              { label: '3일 후', offset: 3 },
              { label: '일주일 후', offset: 7 },
            ].map((q) => (
              <TouchableOpacity
                key={q.label}
                style={styles.quickDateBtn}
                onPress={() => handleSetQuickDate(q.offset)}
              >
                <Text style={styles.quickDateText}>{q.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Date Input */}
          <Text style={styles.label}>알림 날짜 (YYYY-MM-DD)</Text>
          <TextInput
            style={styles.input}
            value={date}
            onChangeText={setDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor="#94A3B8"
          />

          {/* Time Input */}
          <Text style={styles.label}>알림 시간 (HH:mm)</Text>
          <TextInput
            style={styles.input}
            value={time}
            onChangeText={setTime}
            placeholder="09:00"
            placeholderTextColor="#94A3B8"
          />

          {/* Repeat Selection */}
          <Text style={styles.label}>반복 주기</Text>
          <View style={styles.repeatRow}>
            {[
              { id: 'none', label: '반복 없음' },
              { id: 'daily', label: '매일' },
              { id: 'weekly', label: '매주' },
              { id: 'monthly', label: '매월' },
            ].map((rep) => (
              <TouchableOpacity
                key={rep.id}
                style={[styles.repeatBtn, repeat === rep.id && styles.repeatBtnActive]}
                onPress={() => setRepeat(rep.id as any)}
              >
                <Text
                  style={[
                    styles.repeatBtnText,
                    repeat === rep.id && styles.repeatBtnTextActive,
                  ]}
                >
                  {rep.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Pin to status bar toggle */}
          <TouchableOpacity
            style={styles.pinToggleRow}
            onPress={() => setPinToStatusBar(!pinToStatusBar)}
          >
            <Ionicons
              name={pinToStatusBar ? 'checkbox' : 'square-outline'}
              size={20}
              color={pinToStatusBar ? '#DC2626' : '#94A3B8'}
            />
            <Text style={styles.pinToggleText}>
              상태표시줄에 알림 고정 (ColorNote 시그니처)
            </Text>
          </TouchableOpacity>

          {/* Action Buttons */}
          <View style={styles.footer}>
            {note.reminder && (
              <TouchableOpacity
                style={styles.removeBtn}
                onPress={handleRemoveReminder}
              >
                <Text style={styles.removeBtnText}>알람 해제</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.saveBtn}
              onPress={handleSaveReminder}
            >
              <Text style={styles.saveBtnText}>알람 저장</Text>
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
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  container: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 15,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  closeBtn: {
    padding: 4,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
  },
  noteTargetTitle: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 14,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 6,
  },
  quickDateRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 12,
  },
  quickDateBtn: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    paddingVertical: 6,
    borderRadius: 6,
    alignItems: 'center',
  },
  quickDateText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#334155',
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: '#1E293B',
    marginBottom: 12,
  },
  repeatRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 14,
  },
  repeatBtn: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
  },
  repeatBtnActive: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#F87171',
  },
  repeatBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  repeatBtnTextActive: {
    color: '#DC2626',
    fontWeight: '700',
  },
  pinToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    marginBottom: 16,
  },
  pinToggleText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 4,
  },
  removeBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  removeBtnText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
  },
  saveBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#DC2626',
  },
  saveBtnText: {
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
