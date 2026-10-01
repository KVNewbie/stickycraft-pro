import React, { useState } from 'react';
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
import {
  Share2,
  Download,
  Upload,
  Copy,
  Check,
  X,
  Smartphone,
  HardDrive,
  RefreshCw,
} from 'lucide-react-native';
import { useNoteStore } from '../store/useNoteStore';

interface DeviceSyncModalProps {
  visible: boolean;
  onClose: () => void;
}

export const DeviceSyncModal: React.FC<DeviceSyncModalProps> = ({ visible, onClose }) => {
  const { notes, exportAllData, importAllData } = useNoteStore();
  const [copied, setCopied] = useState(false);
  const [importText, setImportText] = useState('');
  const [importStatus, setImportStatus] = useState<string | null>(null);

  // 1. 클립보드로 전체 데이터 백업 복사
  const handleCopyBackup = async () => {
    try {
      const data = exportAllData();
      if (Platform.OS === 'web' && navigator.clipboard) {
        await navigator.clipboard.writeText(data);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.error('Failed to copy to clipboard', err);
    }
  };

  // 2. JSON 파일 다운로드
  const handleDownloadJson = () => {
    try {
      const data = exportAllData();
      if (Platform.OS === 'web') {
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `StickyCraft_Backup_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        Alert.alert('알림', '모바일에서는 클립보드 복사를 이용해주세요.');
      }
    } catch (err) {
      console.error('Failed to download backup JSON', err);
    }
  };

  // 3. 파일로 가져오기
  const handleFileImport = (e: any) => {
    const file = e.target?.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        if (content) {
          const success = importAllData(content);
          if (success) {
            setImportStatus('✅ 백업 복원이 완료되었습니다!');
            setTimeout(() => {
              setImportStatus(null);
              onClose();
            }, 1800);
          } else {
            setImportStatus('❌ 올바르지 않은 백업 파일 형식입니다.');
          }
        }
      };
      reader.readAsText(file);
    }
    if (e.target) e.target.value = '';
  };

  // 4. 텍스트 붙여넣기로 복원
  const handleTextImport = () => {
    if (!importText.trim()) return;
    const success = importAllData(importText.trim());
    if (success) {
      setImportStatus('✅ 클립보드 데이터로 복원 완료!');
      setImportText('');
      setTimeout(() => {
        setImportStatus(null);
        onClose();
      }, 1800);
    } else {
      setImportStatus('❌ 데이터 형식이 올바르지 않습니다.');
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          {/* 헤더 */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.iconCircle}>
                <Share2 size={20} color="#2563eb" />
              </View>
              <View>
                <Text style={styles.headerTitle}>기기간 데이터 공유 & 백업</Text>
                <Text style={styles.headerSub}>
                  스마트폰, 태블릿, PC 간에 메모와 필기를 손쉽게 동기화하세요
                </Text>
              </View>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <X size={18} color="#64748b" />
            </TouchableOpacity>
          </View>

          {/* 상태 알림 */}
          {importStatus && (
            <View style={styles.statusBanner}>
              <Text style={styles.statusText}>{importStatus}</Text>
            </View>
          )}

          {/* 본문 그리드 */}
          <View style={styles.body}>
            {/* 섹션 1: 기기에서 내보내기 (Export) */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <HardDrive size={16} color="#0284c7" />
                <Text style={styles.sectionTitle}>내보내기 (이 기기 → 다른 기기)</Text>
              </View>
              <Text style={styles.sectionDesc}>
                현재 총 {notes.length}개의 메모와 필기 데이터가 저장되어 있습니다.
              </Text>

              <View style={styles.btnRow}>
                <TouchableOpacity style={styles.actionBtn} onPress={handleCopyBackup}>
                  {copied ? <Check size={16} color="#059669" /> : <Copy size={16} color="#334155" />}
                  <Text style={[styles.actionBtnText, copied && { color: '#059669', fontWeight: '700' }]}>
                    {copied ? '클립보드 복사됨!' : '전체 백업 복사'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.actionBtnPrimary} onPress={handleDownloadJson}>
                  <Download size={16} color="#ffffff" />
                  <Text style={styles.actionBtnPrimaryText}>JSON 파일 저장</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* 섹션 2: 다른 기기에서 가져오기 (Import) */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <Smartphone size={16} color="#16a34a" />
                <Text style={styles.sectionTitle}>가져오기 (다른 기기 → 이 기기)</Text>
              </View>
              <Text style={styles.sectionDesc}>
                다른 기기에서 복사한 백업 코드를 붙여넣거나 백업 파일을 열어주세요.
              </Text>

              {Platform.OS === 'web' && (
                <label style={styles.fileUploadLabel as any}>
                  <Upload size={16} color="#2563eb" />
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#2563eb' }}>
                    백업 JSON 파일 열기
                  </span>
                  <input
                    type="file"
                    accept=".json,application/json"
                    onChange={handleFileImport}
                    style={{ display: 'none' }}
                  />
                </label>
              )}

              <View style={styles.inputWrap}>
                <TextInput
                  style={styles.textInput}
                  placeholder="복사한 백업 JSON 데이터를 여기에 붙여넣기..."
                  placeholderTextColor="#94a3b8"
                  value={importText}
                  onChangeText={setImportText}
                  multiline
                />
                {importText.trim().length > 0 && (
                  <TouchableOpacity style={styles.restoreBtn} onPress={handleTextImport}>
                    <RefreshCw size={14} color="#ffffff" />
                    <Text style={styles.restoreBtnText}>데이터 복원 적용</Text>
                  </TouchableOpacity>
                )}
              </View>
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
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 540,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    backgroundColor: '#ffffff',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  headerSub: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusBanner: {
    backgroundColor: '#f0fdf4',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#bbf7d0',
    alignItems: 'center',
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#166534',
  },
  body: {
    padding: 20,
    gap: 16,
  },
  sectionCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1e293b',
  },
  sectionDesc: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 14,
    lineHeight: 18,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 10,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  actionBtnText: {
    fontSize: 13,
    color: '#334155',
    fontWeight: '600',
  },
  actionBtnPrimary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563eb',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  actionBtnPrimaryText: {
    fontSize: 13,
    color: '#ffffff',
    fontWeight: '700',
  },
  fileUploadLabel: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#eff6ff',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#93c5fd',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  inputWrap: {
    gap: 8,
  },
  textInput: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    padding: 10,
    fontSize: 12,
    color: '#1e293b',
    height: 60,
    textAlignVertical: 'top',
  },
  restoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#16a34a',
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  restoreBtnText: {
    fontSize: 12,
    color: '#ffffff',
    fontWeight: '700',
  },
});
