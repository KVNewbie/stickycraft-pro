import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Platform,
} from 'react-native';
import {
  Plus,
  X,
  FileText,
  Palette,
  FileEdit,
  Mic,
} from 'lucide-react-native';
import { useNoteStore } from '../store/useNoteStore';

interface FloatingSpeedDialProps {
  onOpenVoiceModal?: () => void;
}

export const FloatingSpeedDial: React.FC<FloatingSpeedDialProps> = ({ onOpenVoiceModal }) => {
  const [isOpen, setIsOpen] = useState(false);
  const { openNewNoteEditor } = useNoteStore();

  const handleAction = (actionType: 'text' | 'canvas' | 'pdf' | 'voice') => {
    setIsOpen(false);

    if (actionType === 'pdf') {
      openNewNoteEditor('free', 'pdf');
    } else if (actionType === 'canvas') {
      openNewNoteEditor('free', 'canvas');
    } else if (actionType === 'voice') {
      openNewNoteEditor('text', 'note');
      if (onOpenVoiceModal) {
        setTimeout(() => onOpenVoiceModal(), 150);
      }
    } else {
      openNewNoteEditor('text', 'note');
    }
  };

  return (
    <>
      {/* 딤 오버레이 (열려 있을 때 바깥 터치 시 닫기) */}
      {isOpen && (
        <TouchableWithoutFeedback onPress={() => setIsOpen(false)}>
          <View style={styles.backdrop} />
        </TouchableWithoutFeedback>
      )}

      {/* 우측 하단 플로팅 메뉴 컨테이너 */}
      <View style={styles.container} pointerEvents="box-none">
        {/* 펼쳐지는 분기 액션 리스트 */}
        {isOpen && (
          <View style={styles.actionsList}>
            {/* 1. PDF / 문서 열기 */}
            <TouchableOpacity
              style={styles.actionRow}
              onPress={() => handleAction('pdf')}
              activeOpacity={0.8}
            >
              <View style={styles.labelBubble}>
                <Text style={styles.labelText}>📄 PDF / 학습 문서 열기</Text>
              </View>
              <View style={[styles.actionBtn, { backgroundColor: '#E11D48' }]}>
                <FileText size={20} color="#FFFFFF" />
              </View>
            </TouchableOpacity>

            {/* 2. 자유 손글씨 필기장 */}
            <TouchableOpacity
              style={styles.actionRow}
              onPress={() => handleAction('canvas')}
              activeOpacity={0.8}
            >
              <View style={styles.labelBubble}>
                <Text style={styles.labelText}>🎨 자유 손글씨 & 캔버스</Text>
              </View>
              <View style={[styles.actionBtn, { backgroundColor: '#7C3AED' }]}>
                <Palette size={20} color="#FFFFFF" />
              </View>
            </TouchableOpacity>

            {/* 3. 새 텍스트 메모 */}
            <TouchableOpacity
              style={styles.actionRow}
              onPress={() => handleAction('text')}
              activeOpacity={0.8}
            >
              <View style={styles.labelBubble}>
                <Text style={styles.labelText}>✍️ 새 텍스트 스티커 메모</Text>
              </View>
              <View style={[styles.actionBtn, { backgroundColor: '#2563EB' }]}>
                <FileEdit size={20} color="#FFFFFF" />
              </View>
            </TouchableOpacity>

            {/* 4. 빠른 음성 녹음 메모 */}
            <TouchableOpacity
              style={styles.actionRow}
              onPress={() => handleAction('voice')}
              activeOpacity={0.8}
            >
              <View style={styles.labelBubble}>
                <Text style={styles.labelText}>🎙️ 빠른 음성 녹음 메모</Text>
              </View>
              <View style={[styles.actionBtn, { backgroundColor: '#059669' }]}>
                <Mic size={20} color="#FFFFFF" />
              </View>
            </TouchableOpacity>
          </View>
        )}

        {/* 메인 트리거 FAB 버튼 */}
        <TouchableOpacity
          style={[styles.mainFab, isOpen && styles.mainFabActive]}
          onPress={() => setIsOpen(!isOpen)}
          activeOpacity={0.88}
        >
          {isOpen ? (
            <X size={26} color="#FFFFFF" />
          ) : (
            <Plus size={28} color="#0F172A" />
          )}
        </TouchableOpacity>
      </View>
    </>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    zIndex: 90,
  },
  container: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    alignItems: 'flex-end',
    zIndex: 95,
  },
  mainFab: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FDE047',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 8,
    borderWidth: 2,
    borderColor: '#F59E0B',
  },
  mainFabActive: {
    backgroundColor: '#334155',
    borderColor: '#475569',
  },
  actionsList: {
    alignItems: 'flex-end',
    marginBottom: 14,
    gap: 12,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  labelBubble: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  labelText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
  },
  actionBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 6,
    elevation: 6,
  },
});
