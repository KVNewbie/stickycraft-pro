import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Linking,
} from 'react-native';
import { Sparkles, ExternalLink } from 'lucide-react-native';

interface AdBannerSlotProps {
  // 실제 구글 애드몹 배너 ID (미지정시 구글 공식 테스트 배너 ID 사용)
  adUnitId?: string;
}

// Google 공식 AdMob Test Ad Unit IDs
export const ADMOB_TEST_UNIT_IDS = {
  android: 'ca-app-pub-3940256099942544/6300978111',
  ios: 'ca-app-pub-3940256099942544/2934735716',
};

export const AdBannerSlot: React.FC<AdBannerSlotProps> = ({ adUnitId }) => {
  // 사용자가 클릭했을 때 안내
  const handleBannerPress = () => {
    // 광고 클릭 핸들러 (실제 프로덕션에서는 Google Mobile Ads SDK가 자동 처리)
  };

  return (
    <View style={styles.container}>
      <View style={styles.bannerBox}>
        {/* Ad Badge */}
        <View style={styles.adBadge}>
          <Text style={styles.adBadgeText}>AD</Text>
        </View>

        {/* Banner Content (Ad Placeholder & Preview) */}
        <TouchableOpacity
          style={styles.contentRow}
          activeOpacity={0.85}
          onPress={handleBannerPress}
        >
          <View style={styles.iconCircle}>
            <Sparkles size={14} color="#3B82F6" />
          </View>
          <View style={styles.textContainer}>
            <Text style={styles.sponsorTitle} numberOfLines={1}>
              Google Play & App Store AdMob Slot
            </Text>
            <Text style={styles.sponsorDesc} numberOfLines={1}>
              광고 배너 영역 • 안드로이드 및 iOS 배포 시 광고가 노출됩니다
            </Text>
          </View>
          <ExternalLink size={13} color="#94A3B8" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingVertical: 6,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    // 모바일 하단 내비게이션 바 및 Safe Area 위 안착
  },
  bannerBox: {
    width: '100%',
    maxWidth: 468,
    height: 50, // 표준 모바일 배너 규격 (Standard Banner 320x50 ~ 468x60)
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    position: 'relative',
    overflow: 'hidden',
  },
  adBadge: {
    backgroundColor: '#94A3B8',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
    marginRight: 8,
  },
  adBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  contentRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: {
    flex: 1,
  },
  sponsorTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E293B',
  },
  sponsorDesc: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 1,
  },
});
