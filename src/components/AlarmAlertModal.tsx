import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { Bell, Clock, Check, RotateCcw, FileText } from 'lucide-react-native';
import { Note } from '../types/note';
import { NOTE_COLORS } from '../constants/colors';
import { alarmSound } from '../utils/alarmSound';

interface AlarmAlertModalProps {
  note: Note | null;
  onDismiss: () => void;
  onSnooze: (minutes: number) => void;
  onOpenNote: (note: Note) => void;
}

export const AlarmAlertModal: React.FC<AlarmAlertModalProps> = ({
  note,
  onDismiss,
  onSnooze,
  onOpenNote,
}) => {
  useEffect(() => {
    if (note) {
      alarmSound.startRinging();
    } else {
      alarmSound.stopRinging();
    }
    return () => {
      alarmSound.stopRinging();
    };
  }, [note]);

  if (!note) return null;

  const colorCfg = NOTE_COLORS[note.color] || NOTE_COLORS.yellow;

  const handleDismiss = () => {
    alarmSound.stopRinging();
    onDismiss();
  };

  const handleSnooze = (min = 5) => {
    alarmSound.stopRinging();
    onSnooze(min);
  };

  const handleOpen = () => {
    alarmSound.stopRinging();
    onOpenNote(note);
  };

  return (
    <Modal visible={true} transparent animationType="fade" onRequestClose={handleDismiss}>
      <View style={styles.overlay}>
        <View style={styles.dialogCard}>
          {/* Header with pulsing alarm badge */}
          <View style={styles.badgeWrap}>
            <View style={styles.bellCircle}>
              <Bell size={28} color="#FFFFFF" />
            </View>
          </View>

          <Text style={styles.dialogTitle}>ColorNote 알람</Text>
          <Text style={styles.dialogTime}>
            ⏰ 설정된 알람 시간: {note.reminder?.time || '지금'}
          </Text>

          {/* Note preview box */}
          <View
            style={[
              styles.noteCardPreview,
              { backgroundColor: colorCfg.bg, borderColor: colorCfg.cardBorder },
            ]}
          >
            <Text style={[styles.noteTitle, { color: colorCfg.text }]} numberOfLines={1}>
              {note.title || '제목 없는 메모'}
            </Text>
            <Text style={[styles.noteSnippet, { color: colorCfg.text }]} numberOfLines={3}>
              {note.content || (note.checklist ? note.checklist.map((c) => `• ${c.text}`).join('\n') : '내용 없음')}
            </Text>
          </View>

          {/* Actions */}
          <View style={styles.buttonGroup}>
            <TouchableOpacity
              style={styles.openBtn}
              onPress={handleOpen}
              activeOpacity={0.8}
            >
              <FileText size={16} color="#2563EB" />
              <Text style={styles.openBtnText}>메모 확인 & 편집</Text>
            </TouchableOpacity>

            <View style={styles.twoColRow}>
              <TouchableOpacity
                style={styles.snoozeBtn}
                onPress={() => handleSnooze(5)}
                activeOpacity={0.8}
              >
                <RotateCcw size={15} color="#475569" />
                <Text style={styles.snoozeBtnText}>5분 후 다시 알림</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.dismissBtn}
                onPress={handleDismiss}
                activeOpacity={0.8}
              >
                <Check size={16} color="#FFFFFF" />
                <Text style={styles.dismissBtnText}>알람 끄기</Text>
              </TouchableOpacity>
            </View>
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
    padding: 20,
    zIndex: 2000,
  },
  dialogCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 22,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 20,
  },
  badgeWrap: {
    marginBottom: 12,
  },
  bellCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  dialogTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
  },
  dialogTime: {
    fontSize: 13,
    fontWeight: '700',
    color: '#DC2626',
    marginBottom: 16,
  },
  noteCardPreview: {
    width: '100%',
    borderRadius: 14,
    borderWidth: 2,
    padding: 14,
    marginBottom: 20,
  },
  noteTitle: {
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 6,
  },
  noteSnippet: {
    fontSize: 13,
    lineHeight: 18,
    opacity: 0.85,
  },
  buttonGroup: {
    width: '100%',
    gap: 10,
  },
  openBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#EFF6FF',
    borderWidth: 1.5,
    borderColor: '#BFDBFE',
    paddingVertical: 12,
    borderRadius: 12,
  },
  openBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  twoColRow: {
    flexDirection: 'row',
    gap: 10,
  },
  snoozeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#F1F5F9',
    paddingVertical: 12,
    borderRadius: 12,
  },
  snoozeBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
  dismissBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#0F172A',
    paddingVertical: 12,
    borderRadius: 12,
  },
  dismissBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
