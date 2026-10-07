import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  FlatList,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Sparkles, Moon } from 'lucide-react-native';
import { useNoteStore } from '../store/useNoteStore';
import { NOTE_COLORS } from '../constants/colors';
import { Note } from '../types/note';
import { getLunarDate } from '../utils/lunarCalendar';
import { CalendarStickerPickerModal } from './CalendarStickerPickerModal';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

interface DayCell {
  dateStr: string; // YYYY-MM-DD
  dayNumber: number;
  year: number;
  month: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  notes: Note[];
}

export const CalendarView: React.FC = () => {
  const {
    notes,
    selectedCalendarDate,
    setSelectedCalendarDate,
    openEditNoteEditor,
    openNewNoteEditor,
    toggleChecklistItem,
    lunarDisplayMode,
    setLunarDisplayMode,
    calendarDateStickers,
    setCalendarDateSticker,
  } = useNoteStore();

  const [isStickerPickerOpen, setIsStickerPickerOpen] = useState(false);

  // Active month/year state
  const [currentDate, setCurrentDate] = useState(() => {
    if (selectedCalendarDate) {
      const [y, m] = selectedCalendarDate.split('-').map(Number);
      return new Date(y, m - 1, 1);
    }
    return new Date();
  });

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth(); // 0-indexed

  // Filter out deleted notes
  const activeNotes = useMemo(() => notes.filter((n) => !n.isDeleted), [notes]);

  // Map notes to YYYY-MM-DD based on updatedAt, createdAt, or reminder.date
  const notesByDate = useMemo(() => {
    const map: Record<string, Note[]> = {};

    activeNotes.forEach((note) => {
      // Primary date: reminder date if exists, else updatedAt date
      let dateKey = '';
      if (note.reminder && note.reminder.date) {
        dateKey = note.reminder.date;
      } else {
        const d = new Date(note.updatedAt || note.createdAt);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        dateKey = `${y}-${m}-${day}`;
      }

      if (!map[dateKey]) {
        map[dateKey] = [];
      }
      map[dateKey].push(note);
    });

    return map;
  }, [activeNotes]);

  // Generate 42 calendar cells
  const calendarCells = useMemo<DayCell[]>(() => {
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(
      today.getDate()
    ).padStart(2, '0')}`;

    const firstDayOfMonth = new Date(year, month, 1).getDay(); // 0(Sun) ~ 6(Sat)
    const daysInCurrentMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const cells: DayCell[] = [];

    // Prev month padding
    for (let i = firstDayOfMonth - 1; i >= 0; i--) {
      const dNum = daysInPrevMonth - i;
      const prevDate = new Date(year, month - 1, dNum);
      const prevY = prevDate.getFullYear();
      const prevM = prevDate.getMonth() + 1;
      const dateStr = `${prevY}-${String(prevM).padStart(2, '0')}-${String(dNum).padStart(2, '0')}`;
      cells.push({
        dateStr,
        dayNumber: dNum,
        year: prevY,
        month: prevM,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
        notes: notesByDate[dateStr] || [],
      });
    }

    // Current month days
    for (let d = 1; d <= daysInCurrentMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      cells.push({
        dateStr,
        dayNumber: d,
        year,
        month: month + 1,
        isCurrentMonth: true,
        isToday: dateStr === todayStr,
        notes: notesByDate[dateStr] || [],
      });
    }

    // Next month padding to fill 42 cells (6 rows)
    const remaining = 42 - cells.length;
    for (let d = 1; d <= remaining; d++) {
      const nextDate = new Date(year, month + 1, d);
      const nextY = nextDate.getFullYear();
      const nextM = nextDate.getMonth() + 1;
      const dateStr = `${nextY}-${String(nextM).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      cells.push({
        dateStr,
        dayNumber: d,
        year: nextY,
        month: nextM,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
        notes: notesByDate[dateStr] || [],
      });
    }

    return cells;
  }, [year, month, notesByDate]);

  // Notes on currently selected date
  const selectedDateNotes = useMemo(() => {
    return notesByDate[selectedCalendarDate] || [];
  }, [notesByDate, selectedCalendarDate]);

  // Selected date lunar info
  const selectedDateLunar = useMemo(() => {
    if (!selectedCalendarDate) return getLunarDate(year, month + 1, 1);
    const [y, m, d] = selectedCalendarDate.split('-').map(Number);
    return getLunarDate(y, m, d);
  }, [selectedCalendarDate, year, month]);

  const selectedSticker = calendarDateStickers[selectedCalendarDate];

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const handleGoToday = () => {
    const today = new Date();
    setCurrentDate(new Date(today.getFullYear(), today.getMonth(), 1));
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(
      today.getDate()
    ).padStart(2, '0')}`;
    setSelectedCalendarDate(todayStr);
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.mainScroll}
        contentContainerStyle={styles.mainScrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Calendar Card */}
        <View style={styles.calendarCard}>
          {/* Header Month Navigation */}
          <View style={styles.header}>
            <View style={styles.monthDisplay}>
              <Ionicons name="calendar-outline" size={22} color="#2563EB" />
              <Text style={styles.monthText}>
                {year}년 {month + 1}월
              </Text>
            </View>

            <View style={styles.navButtons}>
              {/* Lunar Display Mode Toggle (음력 설정) */}
              <TouchableOpacity
                style={[
                  styles.lunarToggleBtn,
                  lunarDisplayMode !== 'none' && styles.lunarToggleBtnActive,
                ]}
                onPress={() => {
                  const nextMode =
                    lunarDisplayMode === 'all'
                      ? 'key_days'
                      : lunarDisplayMode === 'key_days'
                      ? 'none'
                      : 'all';
                  setLunarDisplayMode(nextMode);
                }}
                activeOpacity={0.7}
              >
                <Moon size={12} color={lunarDisplayMode !== 'none' ? '#2563EB' : '#64748B'} />
                <Text
                  style={[
                    styles.lunarToggleText,
                    lunarDisplayMode !== 'none' && styles.lunarToggleTextActive,
                  ]}
                >
                  {lunarDisplayMode === 'all' ? '음력' : lunarDisplayMode === 'key_days' ? '초하루/보름' : '음력끔'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={handleGoToday} style={styles.todayBtn}>
                <Text style={styles.todayBtnText}>오늘</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handlePrevMonth} style={styles.arrowBtn}>
                <Ionicons name="chevron-back" size={20} color="#475569" />
              </TouchableOpacity>
              <TouchableOpacity onPress={handleNextMonth} style={styles.arrowBtn}>
                <Ionicons name="chevron-forward" size={20} color="#475569" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Weekday Labels */}
          <View style={styles.weekRow}>
            {WEEKDAYS.map((w, idx) => (
              <View key={w} style={styles.weekCell}>
                <Text
                  style={[
                    styles.weekText,
                    idx === 0 && styles.sundayText,
                    idx === 6 && styles.saturdayText,
                  ]}
                >
                  {w}
                </Text>
              </View>
            ))}
          </View>

          {/* Grid Cells (6 rows x 7 cols) */}
          <View style={styles.grid}>
            {calendarCells.map((cell) => {
              const isSelected = cell.dateStr === selectedCalendarDate;
              const lunar = getLunarDate(cell.year, cell.month, cell.dayNumber);
              const sticker = calendarDateStickers[cell.dateStr];
              const showLunar =
                lunarDisplayMode === 'all' ||
                (lunarDisplayMode === 'key_days' && lunar.isKeyDay);

              return (
                <TouchableOpacity
                  key={cell.dateStr}
                  style={[
                    styles.dayCell,
                    !cell.isCurrentMonth && styles.dayCellOutside,
                    isSelected && styles.dayCellSelected,
                    cell.isToday && styles.dayCellToday,
                  ]}
                  onPress={() => setSelectedCalendarDate(cell.dateStr)}
                  activeOpacity={0.7}
                >
                  {/* Day Number & Sticker Header Row */}
                  <View style={styles.cellTopRow}>
                    <Text
                      style={[
                        styles.dayNumber,
                        !cell.isCurrentMonth && styles.dayNumberOutside,
                        cell.isToday && styles.dayNumberToday,
                        isSelected && styles.dayNumberSelected,
                      ]}
                    >
                      {cell.dayNumber}
                    </Text>

                    {sticker && (
                      <Text style={styles.cellStickerEmoji}>{sticker.emoji}</Text>
                    )}
                  </View>

                  {/* Lunar Date Display */}
                  {showLunar && (
                    <Text
                      style={[
                        styles.cellLunarText,
                        lunar.holidayName ? styles.cellLunarHoliday : null,
                        !cell.isCurrentMonth && styles.cellLunarOutside,
                        isSelected && styles.cellLunarSelected,
                      ]}
                      numberOfLines={1}
                    >
                      {lunar.shortText}
                    </Text>
                  )}

                  {/* ColorNote Bars / Dots */}
                  <View style={styles.noteIndicators}>
                    {cell.notes.slice(0, 3).map((note) => {
                      const color = NOTE_COLORS[note.color] || NOTE_COLORS.yellow;
                      return (
                        <View
                          key={note.id}
                          style={[
                            styles.colorStrip,
                            { backgroundColor: color.shadow },
                          ]}
                        />
                      );
                    })}
                    {cell.notes.length > 3 && (
                      <Text style={styles.moreNotesCount}>+{cell.notes.length - 3}</Text>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Selected Date Note List Section (ColorNote Signature) */}
        <View style={styles.detailSection}>
          <View style={styles.detailHeader}>
            <View>
              <Text style={styles.detailDateTitle}>
                {selectedCalendarDate} 메모 ({selectedDateNotes.length})
              </Text>
              <Text style={styles.detailSubtext}>
                날짜별로 정리된 ColorNote 스티커 메모를 확인하고 관리합니다.
              </Text>
            </View>

            <TouchableOpacity
              style={styles.addNoteForDateBtn}
              onPress={() => openNewNoteEditor()}
              activeOpacity={0.8}
            >
              <Ionicons name="add" size={18} color="#FFF" />
              <Text style={styles.addNoteForDateText}>이 날짜에 새 메모</Text>
            </TouchableOpacity>
          </View>

          {/* Selected Date Lunar Info & Anniversary Sticker Bar */}
          <View style={styles.dateMetaBar}>
            <View style={styles.dateMetaLeft}>
              <View style={styles.selectedLunarBadge}>
                <Moon size={13} color="#2563EB" />
                <Text style={styles.selectedLunarBadgeText}>
                  {selectedDateLunar.displayText}
                </Text>
              </View>

              {selectedSticker && (
                <View style={styles.selectedStickerPill}>
                  <Text style={styles.selectedStickerEmoji}>{selectedSticker.emoji}</Text>
                  <Text style={styles.selectedStickerLabel}>
                    {selectedSticker.label || '기념일'}
                  </Text>
                </View>
              )}
            </View>

            <TouchableOpacity
              style={styles.stickerTriggerBtn}
              onPress={() => setIsStickerPickerOpen(true)}
              activeOpacity={0.8}
            >
              <Sparkles size={14} color="#D97706" />
              <Text style={styles.stickerTriggerBtnText}>
                {selectedSticker ? '기념일/아이콘 수정' : '기념일/아이콘 추가'}
              </Text>
            </TouchableOpacity>
          </View>

          {selectedDateNotes.length === 0 ? (
            <View style={styles.emptyDayWrap}>
              <Ionicons name="clipboard-outline" size={40} color="#CBD5E1" />
              <Text style={styles.emptyDayTitle}>이 날짜에 등록된 메모가 없습니다.</Text>
              <Text style={styles.emptyDayDesc}>
                상단의 '이 날짜에 새 메모' 버튼을 눌러 중요한 일정이나 할 일을 기록해보세요.
              </Text>
            </View>
          ) : (
            <View style={styles.dayNotesList}>
              {selectedDateNotes.map((note) => {
                const color = NOTE_COLORS[note.color] || NOTE_COLORS.yellow;
                return (
                  <TouchableOpacity
                    key={note.id}
                    style={[
                      styles.noteListItem,
                      { backgroundColor: color.bg, borderColor: color.cardBorder },
                    ]}
                    onPress={() => openEditNoteEditor(note)}
                    activeOpacity={0.85}
                  >
                    <View style={styles.noteItemHeader}>
                      <View style={[styles.itemColorBar, { backgroundColor: color.shadow }]} />
                      <Text
                        style={[styles.noteItemTitle, { color: color.text }]}
                        numberOfLines={1}
                      >
                        {note.title || '제목 없는 메모'}
                      </Text>

                      {note.isPinned && (
                        <Ionicons name="pin" size={14} color={color.shadow} style={{ marginLeft: 6 }} />
                      )}
                      {note.isLocked && (
                        <Ionicons name="lock-closed" size={14} color="#EF4444" style={{ marginLeft: 4 }} />
                      )}
                      {note.reminder && (
                        <View style={styles.reminderBadge}>
                          <Ionicons name="alarm-outline" size={12} color="#DC2626" />
                          <Text style={styles.reminderBadgeText}>
                            {note.reminder.time || '종일'}
                          </Text>
                        </View>
                      )}
                    </View>

                    {note.content ? (
                      <Text
                        style={[styles.noteItemBody, { color: color.text }]}
                        numberOfLines={3}
                      >
                        {note.content}
                      </Text>
                    ) : null}

                    {/* Checklist preview */}
                    {note.checklist && note.checklist.length > 0 && (
                      <View style={styles.checklistPreview}>
                        {note.checklist.slice(0, 3).map((item) => (
                          <TouchableOpacity
                            key={item.id}
                            style={styles.checkItemRow}
                            onPress={() => toggleChecklistItem(note.id, item.id)}
                          >
                            <Ionicons
                              name={item.completed ? 'checkbox' : 'square-outline'}
                              size={16}
                              color={item.completed ? '#10B981' : '#64748B'}
                            />
                            <Text
                              style={[
                                styles.checkItemText,
                                { color: color.text },
                                item.completed && styles.checkItemCompleted,
                              ]}
                              numberOfLines={1}
                            >
                              {item.text}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Calendar Date Sticker / Anniversary Picker Modal */}
      <CalendarStickerPickerModal
        visible={isStickerPickerOpen}
        dateStr={selectedCalendarDate}
        currentSticker={selectedSticker}
        onSave={(st) => setCalendarDateSticker(selectedCalendarDate, st)}
        onClose={() => setIsStickerPickerOpen(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F1F5F9',
  },
  mainScroll: {
    flex: 1,
  },
  mainScrollContent: {
    padding: 16,
    paddingBottom: 80,
  },
  calendarCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  monthDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  monthText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  navButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  lunarToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
  },
  lunarToggleBtnActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#93C5FD',
  },
  lunarToggleText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  lunarToggleTextActive: {
    color: '#2563EB',
    fontWeight: '700',
  },
  todayBtn: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  todayBtnText: {
    color: '#2563EB',
    fontSize: 12,
    fontWeight: '700',
  },
  arrowBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  weekRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 8,
    marginBottom: 6,
  },
  weekCell: {
    flex: 1,
    alignItems: 'center',
  },
  weekText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  sundayText: {
    color: '#EF4444',
  },
  saturdayText: {
    color: '#3B82F6',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: `${100 / 7}%`,
    height: 62,
    padding: 3,
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  dayCellOutside: {
    opacity: 0.35,
  },
  dayCellSelected: {
    backgroundColor: '#EFF6FF',
    borderColor: '#3B82F6',
  },
  dayCellToday: {
    backgroundColor: '#F8FAFC',
  },
  dayNumber: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 3,
  },
  dayNumberOutside: {
    color: '#94A3B8',
  },
  dayNumberToday: {
    color: '#2563EB',
    fontWeight: '800',
  },
  dayNumberSelected: {
    color: '#1D4ED8',
    fontWeight: '800',
  },
  cellTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    width: '100%',
  },
  cellStickerEmoji: {
    fontSize: 10,
    marginLeft: 2,
  },
  cellLunarText: {
    fontSize: 9,
    color: '#64748B',
    fontWeight: '500',
    marginTop: -2,
    marginBottom: 2,
  },
  cellLunarHoliday: {
    color: '#DC2626',
    fontWeight: '700',
  },
  cellLunarOutside: {
    color: '#CBD5E1',
  },
  cellLunarSelected: {
    color: '#1D4ED8',
    fontWeight: '700',
  },
  dateMetaBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  dateMetaLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    flex: 1,
  },
  selectedLunarBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  selectedLunarBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  selectedStickerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  selectedStickerEmoji: {
    fontSize: 13,
  },
  selectedStickerLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#B45309',
  },
  stickerTriggerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    marginLeft: 8,
  },
  stickerTriggerBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  noteIndicators: {
    width: '100%',
    alignItems: 'center',
    gap: 2,
  },
  colorStrip: {
    width: '85%',
    height: 4,
    borderRadius: 2,
  },
  moreNotesCount: {
    fontSize: 9,
    color: '#64748B',
    fontWeight: '700',
  },
  detailSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    flexWrap: 'wrap',
    gap: 10,
  },
  detailDateTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  detailSubtext: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  addNoteForDateBtn: {
    backgroundColor: '#2563EB',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addNoteForDateText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  emptyDayWrap: {
    alignItems: 'center',
    paddingVertical: 36,
  },
  emptyDayTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
    marginTop: 10,
  },
  emptyDayDesc: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 4,
    textAlign: 'center',
  },
  dayNotesList: {
    gap: 12,
  },
  noteListItem: {
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  noteItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  itemColorBar: {
    width: 4,
    height: 16,
    borderRadius: 2,
    marginRight: 8,
  },
  noteItemTitle: {
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
  },
  reminderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 6,
  },
  reminderBadgeText: {
    fontSize: 10,
    color: '#DC2626',
    fontWeight: '700',
  },
  noteItemBody: {
    fontSize: 12,
    lineHeight: 18,
    opacity: 0.85,
    marginBottom: 6,
  },
  checklistPreview: {
    marginTop: 4,
    gap: 4,
    paddingTop: 6,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(0,0,0,0.08)',
  },
  checkItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  checkItemText: {
    fontSize: 12,
    flex: 1,
  },
  checkItemCompleted: {
    textDecorationLine: 'line-through',
    opacity: 0.5,
  },
});
