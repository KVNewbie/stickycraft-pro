import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import { Pin, X, ChevronDown, ChevronUp, Bell, CheckSquare } from 'lucide-react-native';
import { useNoteStore } from '../store/useNoteStore';
import { NOTE_COLORS } from '../constants/colors';
import { Note } from '../types/note';

export const StatusBarPinBanner: React.FC = () => {
  const { notes, setNoteReminder, openEditNoteEditor, openLockModal } = useNoteStore();
  const [isExpanded, setIsExpanded] = useState(true);

  // Find all active notes with pinToStatusBar
  const pinnedNotes = notes.filter(
    (n) => !n.isDeleted && n.reminder && n.reminder.pinToStatusBar
  );

  if (pinnedNotes.length === 0) {
    return null;
  }

  const handleOpenNote = (note: Note) => {
    if (note.isLocked) {
      openLockModal(note, () => openEditNoteEditor(note));
    } else {
      openEditNoteEditor(note);
    }
  };

  const handleUnpin = (note: Note) => {
    if (note.reminder) {
      setNoteReminder(note.id, {
        ...note.reminder,
        pinToStatusBar: false,
      });
    }
  };

  return (
    <View style={styles.container}>
      {/* Status Bar Notification Header */}
      <View style={styles.bannerHeader}>
        <View style={styles.titleRow}>
          <View style={styles.pinIconCircle}>
            <Bell size={12} color="#DC2626" />
          </View>
          <Text style={styles.headerTitle}>
            상태표시줄 고정 알림 ({pinnedNotes.length})
          </Text>
          <Text style={styles.headerSubtitle}>ColorNote 시그니처 상단 고정</Text>
        </View>

        <TouchableOpacity
          style={styles.toggleCollapseBtn}
          onPress={() => setIsExpanded(!isExpanded)}
        >
          {isExpanded ? (
            <ChevronUp size={16} color="#64748B" />
          ) : (
            <ChevronDown size={16} color="#64748B" />
          )}
        </TouchableOpacity>
      </View>

      {/* Pinned Note Pills / Cards */}
      {isExpanded && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {pinnedNotes.map((note) => {
            const colorCfg = NOTE_COLORS[note.color] || NOTE_COLORS.yellow;
            const isChecklist = note.checklist && note.checklist.length > 0;
            const completedCount = isChecklist
              ? note.checklist!.filter((c) => c.completed).length
              : 0;

            return (
              <TouchableOpacity
                key={note.id}
                style={[
                  styles.pinnedCard,
                  { backgroundColor: colorCfg.bg, borderColor: colorCfg.cardBorder },
                ]}
                onPress={() => handleOpenNote(note)}
                activeOpacity={0.8}
              >
                {/* Left accent color strip */}
                <View
                  style={[
                    styles.accentStrip,
                    { backgroundColor: colorCfg.cardBorder },
                  ]}
                />

                <View style={styles.cardInfo}>
                  <View style={styles.cardTitleRow}>
                    <Text
                      style={[styles.cardTitle, { color: colorCfg.text }]}
                      numberOfLines={1}
                    >
                      {note.title || '제목 없음'}
                    </Text>
                    {note.reminder?.time && (
                      <Text style={styles.timeBadge}>{note.reminder.time}</Text>
                    )}
                  </View>

                  <Text
                    style={[styles.cardSnippet, { color: colorCfg.text }]}
                    numberOfLines={1}
                  >
                    {isChecklist
                      ? `[체크리스트 ${completedCount}/${note.checklist!.length}] ${note.checklist![0]?.text || ''}`
                      : note.content || '내용 없음'}
                  </Text>
                </View>

                {/* Unpin button */}
                <TouchableOpacity
                  style={styles.unpinBtn}
                  onPress={(e) => {
                    e.stopPropagation();
                    handleUnpin(note);
                  }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <X size={14} color="#64748B" />
                </TouchableOpacity>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFBEB',
    borderBottomWidth: 1,
    borderBottomColor: '#FEF3C7',
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  bannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pinIconCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#92400E',
  },
  headerSubtitle: {
    fontSize: 10,
    color: '#B45309',
    marginLeft: 4,
  },
  toggleCollapseBtn: {
    padding: 4,
  },
  scrollContent: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: 6,
    paddingBottom: 4,
  },
  pinnedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1.5,
    paddingRight: 8,
    maxWidth: 240,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  accentStrip: {
    width: 6,
    alignSelf: 'stretch',
    marginRight: 8,
  },
  cardInfo: {
    flex: 1,
    paddingVertical: 6,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  cardTitle: {
    fontSize: 12,
    fontWeight: '800',
    flex: 1,
  },
  timeBadge: {
    fontSize: 10,
    fontWeight: '700',
    color: '#DC2626',
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  cardSnippet: {
    fontSize: 11,
    opacity: 0.8,
    marginTop: 2,
  },
  unpinBtn: {
    padding: 6,
    marginLeft: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
  },
});
