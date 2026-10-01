import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  Platform,
} from 'react-native';
import {
  X,
  Database,
  Download,
  Upload,
  RotateCcw,
  ShieldCheck,
  Smartphone,
  ExternalLink,
} from 'lucide-react-native';
import { useNoteStore } from '../store/useNoteStore';

interface BackupSettingsModalProps {
  visible: boolean;
  onClose: () => void;
}

export const BackupSettingsModal: React.FC<BackupSettingsModalProps> = ({
  visible,
  onClose,
}) => {
  const { notes, exportAllData, importAllData, resetToMockData } = useNoteStore();
  const [jsonText, setJsonText] = useState('');
  const [copiedMsg, setCopiedMsg] = useState(false);

  const handleExport = () => {
    const dataStr = exportAllData();
    setJsonText(dataStr);
    if (Platform.OS === 'web' && navigator?.clipboard) {
      navigator.clipboard.writeText(dataStr);
      setCopiedMsg(true);
      setTimeout(() => setCopiedMsg(false), 3000);
    }
  };

  const handleImport = () => {
    if (!jsonText.trim()) {
      alertOrNotice('알림', '복원할 JSON 데이터를 아래 텍스트 상자에 붙여넣어 주세요.');
      return;
    }
    const success = importAllData(jsonText);
    if (success) {
      alertOrNotice('복원 완료', '메모 데이터가 성공적으로 복원되었습니다!');
      onClose();
    } else {
      alertOrNotice('오류', '올바른 백업 데이터 형식이 아닙니다.');
    }
  };

  const handleResetData = () => {
    if (Platform.OS === 'web') {
      if (window.confirm('예시 가이드 스티커 메모들로 초기화하시겠습니까? 현재 메모는 덮어씌워집니다.')) {
        resetToMockData();
        onClose();
      }
    } else {
      Alert.alert(
        '데이터 초기화',
        '예시 가이드 스티커 메모들로 초기화하시겠습니까?',
        [
          { text: '취소', style: 'cancel' },
          {
            text: '초기화',
            style: 'destructive',
            onPress: () => {
              resetToMockData();
              onClose();
            },
          },
        ]
      );
    }
  };

  const alertOrNotice = (title: string, msg: string) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}: ${msg}`);
    } else {
      Alert.alert(title, msg);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <Database size={18} color="#0F172A" />
              <Text style={styles.title}>앱 설정 & 데이터 백업</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={20} color="#64748B" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.contentScroll} showsVerticalScrollIndicator={false}>
            {/* Market Deployment Status */}
            <View style={styles.sectionBox}>
              <View style={styles.sectionHeader}>
                <Smartphone size={16} color="#3B82F6" />
                <Text style={styles.sectionTitle}>스토어 배포 지원 현황</Text>
              </View>
              <Text style={styles.sectionDesc}>
                • Google Play (Android APK/AAB) 지원{'\n'}
                • Apple App Store (iOS IPA) 지원{'\n'}
                • 웹 브라우저 PWA 지원
              </Text>
            </View>

            {/* Note Stats */}
            <View style={styles.statsCard}>
              <Text style={styles.statsLabel}>보관된 총 스티커 메모</Text>
              <Text style={styles.statsNumber}>{notes.length}개</Text>
            </View>

            {/* Backup & Export Buttons */}
            <View style={styles.buttonGroup}>
              <TouchableOpacity style={styles.actionBtn} onPress={handleExport}>
                <Download size={16} color="#FFFFFF" />
                <Text style={styles.actionBtnText}>전체 메모 JSON 백업 / 복사</Text>
              </TouchableOpacity>
              {copiedMsg && (
                <Text style={styles.copiedNotice}>
                  ✓ 클립보드에 백업 데이터가 복사되었습니다!
                </Text>
              )}

              <TouchableOpacity
                style={[styles.actionBtn, styles.importBtn]}
                onPress={handleImport}
              >
                <Upload size={16} color="#0F172A" />
                <Text style={[styles.actionBtnText, { color: '#0F172A' }]}>
                  입력된 JSON 데이터로 복원
                </Text>
              </TouchableOpacity>
            </View>

            {/* JSON Box */}
            <TextInput
              style={styles.jsonInput}
              multiline
              placeholder="백업된 JSON 데이터를 여기에 붙여넣어 복원하거나 내보낸 데이터를 확인하세요."
              placeholderTextColor="#94A3B8"
              value={jsonText}
              onChangeText={setJsonText}
            />

            {/* Reset to Mock */}
            <TouchableOpacity style={styles.resetBtn} onPress={handleResetData}>
              <RotateCcw size={15} color="#DC2626" />
              <Text style={styles.resetBtnText}>예시 가이드 메모로 초기화</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 460,
    maxHeight: '85%',
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
    marginBottom: 16,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
  },
  closeBtn: {
    padding: 4,
  },
  contentScroll: {
    flexGrow: 0,
  },
  sectionBox: {
    backgroundColor: '#F0F9FF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0369A1',
  },
  sectionDesc: {
    fontSize: 12,
    color: '#075985',
    lineHeight: 18,
  },
  statsCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  statsLabel: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 4,
  },
  statsNumber: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
  },
  buttonGroup: {
    gap: 8,
    marginBottom: 12,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#0F172A',
    paddingVertical: 11,
    borderRadius: 12,
  },
  importBtn: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  copiedNotice: {
    color: '#059669',
    fontSize: 11.5,
    fontWeight: '600',
    textAlign: 'center',
  },
  jsonInput: {
    height: 120,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 10,
    fontSize: 11.5,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: '#334155',
    textAlignVertical: 'top',
    marginBottom: 14,
  },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    marginBottom: 10,
  },
  resetBtnText: {
    color: '#DC2626',
    fontSize: 12.5,
    fontWeight: '600',
  },
});
