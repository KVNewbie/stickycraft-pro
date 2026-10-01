import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PlannerSticker } from '../types/note';

interface PlannerStickerModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectSticker: (sticker: PlannerSticker) => void;
  onInsertStickerText: (text: string) => void;
}

interface StickerCategory {
  name: string;
  icon: keyof typeof Ionicons.glyphMap;
  stickers: { id: string; emoji: string; label: string; color: string }[];
}

const STICKER_CATEGORIES: StickerCategory[] = [
  {
    name: '업무 & 목표',
    icon: 'briefcase-outline',
    stickers: [
      { id: 'work_target', emoji: '🎯', label: '목표 달성', color: '#EF4444' },
      { id: 'work_fire', emoji: '🔥', label: '긴급 처리', color: '#F97316' },
      { id: 'work_warn', emoji: '⚠️', label: '주의/확인', color: '#F59E0B' },
      { id: 'work_done', emoji: '🎉', label: '업무 완료', color: '#10B981' },
      { id: 'work_trophy', emoji: '🏆', label: '핵심 성과', color: '#EAB308' },
      { id: 'work_clock', emoji: '⏰', label: '마감 임박', color: '#DC2626' },
      { id: 'work_bulb', emoji: '💡', label: '아이디어', color: '#8B5CF6' },
      { id: 'work_pin', emoji: '📌', label: '필독 사항', color: '#EC4899' },
      { id: 'work_rocket', emoji: '🚀', label: '프로젝트 런칭', color: '#3B82F6' },
      { id: 'work_meeting', emoji: '💼', label: '중요 미팅', color: '#0F172A' },
      { id: 'work_check', emoji: '✅', label: '최종 승인', color: '#059669' },
      { id: 'work_hold', emoji: '⏸️', label: '잠정 보류', color: '#64748B' },
    ],
  },
  {
    name: '다이어리 & 루틴',
    icon: 'calendar-outline',
    stickers: [
      { id: 'plan_today', emoji: '📅', label: '오늘의 루틴', color: '#3B82F6' },
      { id: 'plan_cart', emoji: '🛒', label: '장보기/쇼핑', color: '#10B981' },
      { id: 'plan_travel', emoji: '✈️', label: '여행/외출', color: '#06B6D4' },
      { id: 'plan_money', emoji: '💰', label: '지출/가계부', color: '#F59E0B' },
      { id: 'plan_study', emoji: '📚', label: '열공 스터디', color: '#8B5CF6' },
      { id: 'plan_pill', emoji: '💊', label: '영양제/약', color: '#EC4899' },
      { id: 'plan_workout', emoji: '🏋️', label: '오늘 운동 완료', color: '#EF4444' },
      { id: 'plan_gift', emoji: '🎁', label: '선물/기념일', color: '#F43F5E' },
      { id: 'plan_movie', emoji: '🎬', label: '영화/문화', color: '#6366F1' },
      { id: 'plan_hospital', emoji: '🩺', label: '병원 예약', color: '#14B8A6' },
      { id: 'plan_bday', emoji: '🎂', label: '생일 파티', color: '#FB7185' },
      { id: 'plan_food', emoji: '🍽️', label: '맛집 탐방', color: '#F97316' },
    ],
  },
  {
    name: '감정 & 힐링',
    icon: 'heart-outline',
    stickers: [
      { id: 'mood_coffee', emoji: '☕', label: '커피 한잔의 여유', color: '#78350F' },
      { id: 'mood_fight', emoji: '💪', label: '힘내자 화이팅!', color: '#2563EB' },
      { id: 'mood_spark', emoji: '✨', label: '영감 가득', color: '#EAB308' },
      { id: 'mood_heart', emoji: '💖', label: '최고의 기분', color: '#EC4899' },
      { id: 'mood_party', emoji: '🥳', label: '축하해요', color: '#8B5CF6' },
      { id: 'mood_sleep', emoji: '😴', label: '달콤한 꿀휴식', color: '#64748B' },
      { id: 'mood_rain', emoji: '🌧️', label: '비 오는 감성', color: '#0284C7' },
      { id: 'mood_sun', emoji: '☀️', label: '맑고 상쾌함', color: '#F59E0B' },
      { id: 'mood_clover', emoji: '🍀', label: '행운 만땅', color: '#10B981' },
      { id: 'mood_night', emoji: '🌙', label: '새벽 감성', color: '#1E1B4B' },
      { id: 'mood_cat', emoji: '🐾', label: '귀여운 힐링', color: '#D97706' },
      { id: 'mood_leaf', emoji: '🌿', label: '초록초록 쉼표', color: '#059669' },
    ],
  },
  {
    name: '스탬프 & 라벨',
    icon: 'ribbon-outline',
    stickers: [
      { id: 'badge_topsecret', emoji: '🔒', label: 'TOP SECRET', color: '#DC2626' },
      { id: 'badge_dday', emoji: '⭐', label: 'D-DAY', color: '#EA580C' },
      { id: 'badge_important', emoji: '🚨', label: 'IMPORTANT', color: '#B91C1C' },
      { id: 'badge_review', emoji: '👀', label: 'REVIEW', color: '#4F46E5' },
      { id: 'badge_mustdo', emoji: '📌', label: 'MUST DO', color: '#0F766E' },
      { id: 'badge_pass', emoji: '🎖️', label: 'COMPLETE', color: '#047857' },
    ],
  },
];

export const PlannerStickerModal: React.FC<PlannerStickerModalProps> = ({
  visible,
  onClose,
  onSelectSticker,
  onInsertStickerText,
}) => {
  const [activeCategory, setActiveCategory] = useState(0);

  const handleStickerClick = (sticker: { id: string; emoji: string; label: string; color: string }) => {
    onSelectSticker({
      id: sticker.id + '_' + Date.now(),
      emoji: sticker.emoji,
      label: sticker.label,
      color: sticker.color,
    });
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
            <View style={styles.headerTitleRow}>
              <View style={styles.iconCircle}>
                <Ionicons name="sparkles" size={18} color="#8B5CF6" />
              </View>
              <View>
                <Text style={styles.title}>Jnotes 디지털 플래너 스티커 팩</Text>
                <Text style={styles.subtitle}>
                  포스트잇에 감성 스티커 스탬프를 콕콕 붙여보세요!
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color="#64748B" />
            </TouchableOpacity>
          </View>

          {/* Category Tabs */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.categoryScroll}
            contentContainerStyle={styles.categoryContent}
          >
            {STICKER_CATEGORIES.map((cat, idx) => {
              const isActive = activeCategory === idx;
              return (
                <TouchableOpacity
                  key={cat.name}
                  style={[styles.categoryTab, isActive && styles.categoryTabActive]}
                  onPress={() => setActiveCategory(idx)}
                >
                  <Ionicons
                    name={cat.icon}
                    size={14}
                    color={isActive ? '#FFFFFF' : '#475569'}
                  />
                  <Text style={[styles.categoryTabText, isActive && styles.categoryTabTextActive]}>
                    {cat.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Stickers Grid */}
          <ScrollView style={styles.stickersScroll} contentContainerStyle={styles.stickersGrid}>
            {STICKER_CATEGORIES[activeCategory].stickers.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={[styles.stickerCard, { borderColor: item.color + '33' }]}
                activeOpacity={0.7}
                onPress={() => handleStickerClick(item)}
              >
                <View style={[styles.emojiWrap, { backgroundColor: item.color + '15' }]}>
                  <Text style={styles.emojiText}>{item.emoji}</Text>
                </View>
                <Text style={styles.stickerLabel} numberOfLines={1}>
                  {item.label}
                </Text>
                <TouchableOpacity
                  style={styles.insertTextBtn}
                  hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                  onPress={(e) => {
                    e.stopPropagation();
                    onInsertStickerText(`${item.emoji} [${item.label}] `);
                    onClose();
                  }}
                >
                  <Text style={styles.insertTextBtnLabel}>+본문 삽입</Text>
                </TouchableOpacity>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Footer Guide */}
          <View style={styles.footerGuide}>
            <Ionicons name="information-circle-outline" size={14} color="#64748B" />
            <Text style={styles.footerGuideText}>
              스티커를 탭하면 스티커 메모 상단에 스탬프로 부착되며, [+본문 삽입] 시 커서 위치에 바로 들어갑니다.
            </Text>
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
    maxWidth: 540,
    maxHeight: '85%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
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
    marginBottom: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3E8FF',
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
  categoryScroll: {
    marginBottom: 12,
  },
  categoryContent: {
    flexDirection: 'row',
    gap: 8,
  },
  categoryTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
  },
  categoryTabActive: {
    backgroundColor: '#8B5CF6',
  },
  categoryTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  categoryTabTextActive: {
    color: '#FFFFFF',
  },
  stickersScroll: {
    maxHeight: 380,
  },
  stickersGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingBottom: 8,
  },
  stickerCard: {
    width: '31%',
    backgroundColor: '#FAFAFA',
    borderRadius: 12,
    borderWidth: 1.2,
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  emojiText: {
    fontSize: 22,
  },
  stickerLabel: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 6,
    textAlign: 'center',
  },
  insertTextBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  insertTextBtnLabel: {
    fontSize: 9.5,
    fontWeight: '600',
    color: '#64748B',
  },
  footerGuide: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    marginTop: 10,
  },
  footerGuideText: {
    fontSize: 11,
    color: '#64748B',
    flex: 1,
    lineHeight: 15,
  },
});
