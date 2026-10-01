import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { PaperTemplate } from '../types/note';

interface PaperTemplatePatternProps {
  template?: PaperTemplate;
  colorHex?: string;
  style?: object;
}

/**
 * Noteshelf 스타일 페이퍼 속지 템플릿 패턴 엔진
 * - blank: 깨끗한 단색 무지
 * - lined: 은은한 가로 줄노트 (28px 간격)
 * - grid: 모눈종이 방안 격자 (24px x 24px)
 * - dot: 불렛 저널 도트 매트릭스 (20px 간격)
 * - cornell: 코넬식 단서/본문/요약 3분할 노트
 */
export const PaperTemplatePattern: React.FC<PaperTemplatePatternProps> = ({
  template = 'blank',
  colorHex = '#0F172A',
  style,
}) => {
  if (template === 'blank') {
    return null;
  }

  // 웹 환경: CSS repeating-linear-gradient 및 radial-gradient를 사용한 초경량 고해상도 패턴
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

  // 모바일 네이티브 환경 fallback (오버레이)
  return (
    <View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFillObject,
        {
          zIndex: 0,
          borderWidth: template === 'grid' ? 1 : 0,
          borderColor: 'rgba(15, 23, 42, 0.05)',
        },
        style,
      ]}
    />
  );
};
