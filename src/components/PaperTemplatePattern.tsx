import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import Svg, { Defs, Pattern, Line, Rect, Circle } from 'react-native-svg';
import { PaperTemplate } from '../types/note';

interface PaperTemplatePatternProps {
  template?: PaperTemplate;
  colorHex?: string;
  style?: object;
}

/**
 * Noteshelf & DrawNote 스타일 유니버설 페이퍼 속지 템플릿 패턴 엔진 (Mobile & Web 동시 지원)
 * - blank: 깨끗한 단색 무지
 * - lined: 은은한 가로 줄노트 (28px 간격)
 * - grid: 모눈종이 방안 격자 (24px x 24px)
 * - dot: 불렛 저널 도트 매트릭스 (20px 간격)
 * - cornell: 코넬식 단서/본문/요약 3분할 노트 (좌측 28% 레드 마진 라인)
 * - dark: 다크 모드 블랙보드 속지 + 미세 화이트 격자
 */
export const PaperTemplatePattern: React.FC<PaperTemplatePatternProps> = ({
  template = 'blank',
  colorHex = '#0F172A',
  style,
}) => {
  if (template === 'blank') {
    return null;
  }

  // 웹 환경: CSS 그라디언트를 사용한 초경량 렌더링
  if (Platform.OS === 'web') {
    let backgroundStyle: any = {};

    if (template === 'lined') {
      backgroundStyle = {
        backgroundImage: `repeating-linear-gradient(
          transparent,
          transparent 27px,
          rgba(15, 23, 42, 0.08) 27px,
          rgba(15, 23, 42, 0.08) 28px
        )`,
        backgroundPosition: '0 8px',
      };
    } else if (template === 'grid') {
      backgroundStyle = {
        backgroundImage: `
          linear-gradient(to right, rgba(15, 23, 42, 0.07) 1px, transparent 1px),
          linear-gradient(to bottom, rgba(15, 23, 42, 0.07) 1px, transparent 1px)
        `,
        backgroundSize: '24px 24px',
      };
    } else if (template === 'dot') {
      backgroundStyle = {
        backgroundImage: `radial-gradient(circle, rgba(15, 23, 42, 0.16) 1.2px, transparent 1.2px)`,
        backgroundSize: '20px 20px',
      };
    } else if (template === 'cornell') {
      backgroundStyle = {
        backgroundImage: `
          linear-gradient(to right, transparent 28%, rgba(225, 29, 72, 0.22) 28%, rgba(225, 29, 72, 0.22) 29%, transparent 29%),
          repeating-linear-gradient(
            transparent,
            transparent 27px,
            rgba(15, 23, 42, 0.08) 27px,
            rgba(15, 23, 42, 0.08) 28px
          )
        `,
        backgroundPosition: '0 8px',
      };
    } else if (template === 'dark') {
      backgroundStyle = {
        backgroundColor: '#1E293B',
        backgroundImage: `
          linear-gradient(to right, rgba(255, 255, 255, 0.08) 1px, transparent 1px),
          linear-gradient(to bottom, rgba(255, 255, 255, 0.08) 1px, transparent 1px)
        `,
        backgroundSize: '24px 24px',
      };
    }

    return (
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFillObject,
          {
            zIndex: 0,
            borderRadius: 12,
            overflow: 'hidden',
          },
          backgroundStyle,
          style,
        ]}
      />
    );
  }

  // 모바일 네이티브 환경 (iOS/Android): react-native-svg Pattern 및 Line 렌더링
  return (
    <View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFillObject,
        {
          zIndex: 0,
          borderRadius: 12,
          overflow: 'hidden',
        },
        template === 'dark' && { backgroundColor: '#1E293B' },
        style,
      ]}
    >
      <Svg width="100%" height="100%">
        <Defs>
          {template === 'lined' && (
            <Pattern id="linedPattern" width="100%" height="28" patternUnits="userSpaceOnUse">
              <Line x1="0" y1="27" x2="100%" y2="27" stroke="rgba(15, 23, 42, 0.08)" strokeWidth="1" />
            </Pattern>
          )}
          {(template === 'grid' || template === 'dark') && (
            <Pattern id="gridPattern" width="24" height="24" patternUnits="userSpaceOnUse">
              <Rect
                width="24"
                height="24"
                fill="none"
                stroke={template === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(15, 23, 42, 0.07)'}
                strokeWidth="1"
              />
            </Pattern>
          )}
          {template === 'dot' && (
            <Pattern id="dotPattern" width="20" height="20" patternUnits="userSpaceOnUse">
              <Circle cx="10" cy="10" r="1.2" fill="rgba(15, 23, 42, 0.16)" />
            </Pattern>
          )}
          {template === 'cornell' && (
            <Pattern id="cornellPattern" width="100%" height="28" patternUnits="userSpaceOnUse">
              <Line x1="0" y1="27" x2="100%" y2="27" stroke="rgba(15, 23, 42, 0.08)" strokeWidth="1" />
            </Pattern>
          )}
        </Defs>

        {template === 'lined' && <Rect width="100%" height="100%" fill="url(#linedPattern)" />}
        {(template === 'grid' || template === 'dark') && (
          <Rect width="100%" height="100%" fill="url(#gridPattern)" />
        )}
        {template === 'dot' && <Rect width="100%" height="100%" fill="url(#dotPattern)" />}
        {template === 'cornell' && (
          <>
            <Rect width="100%" height="100%" fill="url(#cornellPattern)" />
            {/* 코넬식 좌측 28% 단서 컬럼 구분 적색 라인 */}
            <Line x1="28%" y1="0" x2="28%" y2="100%" stroke="rgba(225, 29, 72, 0.25)" strokeWidth="1.5" />
          </>
        )}
      </Svg>
    </View>
  );
};
