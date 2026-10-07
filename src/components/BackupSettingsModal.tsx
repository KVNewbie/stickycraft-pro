import React, { useState, useEffect } from 'react';
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
  Smartphone,
  Share2,
  FolderOpen,
  Clock,
  Check,
  Moon,
  Sparkles,
  ShieldCheck,
} from 'lucide-react-native';
import { useNoteStore } from '../store/useNoteStore';
import {
  exportAndShareBackupFile,
  pickAndReadBackupFile,
  getAutoBackupHistory,
  BackupSnapshotMeta,
} from '../utils/autoBackup';
import { LunarDisplayMode } from '../types/note';

interface BackupSettingsModalProps {
  visible: boolean;
  onClose: () => void;
}

export const BackupSettingsModal: React.FC<BackupSettingsModalProps> = ({
  visible,
  onClose,
}) => {
  const {
    notes,
    exportAllData,
    importAllData,
    resetToMockData,
    lunarDisplayMode,
    setLunarDisplayMode,
    autoBackupEnabled,
    setAutoBackupEnabled,
  } = useNoteStore();

  const [jsonText, setJsonText] = useState('');
  const [copiedMsg, setCopiedMsg] = useState(false);
  const [autoBackups, setAutoBackups] = useState<BackupSnapshotMeta[]>([]);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      loadBackupHistory();
    }
  }, [visible]);

  const loadBackupHistory = async () => {
    const list = await getAutoBackupHistory();
    setAutoBackups(list);
  };

  const showStatus = (msg: string) => {
    setStatusMsg(msg);
    setTimeout(() => setStatusMsg(null), 3000);
  };

  // 1. 파일로 내보내기 & 기기 공유 (카카오톡, 이메일, 드라이브)
  const handleExportFile = async () => {
    const dataStr = exportAllData();
    const success = await exportAndShareBackupFile(dataStr);
    if (success) {
      showStatus('✓ 백업 파일이 성공적으로 준비/공유되었습니다!');
    }
  };

  // 2. 파일에서 백업 가져와 복원하기
  const handleImportFile = async () => {
    const content = await pickAndReadBackupFile();
    if (!content) return;

    const confirmRestore = () => {
      const ok = importAllData(content);
      if (ok) {
        alertOrNotice('복원 완료', '백업 파일로부터 메모가 성공적으로 복원되었습니다!');
        onClose();
      } else {
        alertOrNotice('오류', '올바른 백업 파일 형식이 아닙니다.');
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm('선택한 파일로 메모 데이터를 복원하시겠습니까? 현재 메모가 업데이트됩니다.')) {
        confirmRestore();
      }
    } else {
      Alert.alert(
        '파일 복원',
        '선택한 파일로 메모 데이터를 복원하시겠습니까? 현재 메모가 업데이트됩니다.',
        [
          { text: '취소', style: 'cancel' },
          { text: '복원', onPress: confirmRestore },
        ]
      );
    }
  };

  // 3. 텍스트 JSON 내보내기/복사
  const handleExportText = () => {
    const dataStr = exportAllData();
    setJsonText(dataStr);
    if (Platform.OS === 'web' && navigator?.clipboard) {
      navigator.clipboard.writeText(dataStr);
      setCopiedMsg(true);
      setTimeout(() => setCopiedMsg(false), 3000);
    } else {
      showStatus('✓ JSON 데이터가 아래 텍스트 상자에 생성되었습니다');
    }
  };

  // 4. 텍스트 JSON으로 복원
  const handleImportText = () => {
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

  // 5. 자동 백업 스냅샷에서 복원
  const handleRestoreSnapshot = (snapshot: BackupSnapshotMeta) => {
    const confirmAction = () => {
      const ok = importAllData(snapshot.data);
      if (ok) {
        alertOrNotice('스냅샷 복원', `${snapshot.dateStr} 시점의 데이터로 복원되었습니다!`);
        onClose();
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm(`${snapshot.dateStr} 시점(${snapshot.noteCount}개 메모)으로 복원하시겠습니까?`)) {
        confirmAction();
      }
    } else {
      Alert.alert(
        '자동 백업 복원',
        `${snapshot.dateStr} 시점(${snapshot.noteCount}개 메모)으로 복원하시겠습니까?`,
        [
          { text: '취소', style: 'cancel' },
          { text: '복원', onPress: confirmAction },
        ]
      );
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

  const LUNAR_OPTIONS: { id: LunarDisplayMode; label: string; desc: string }[] = [
    { id: 'all', label: '항상 표시 (매일)', desc: '달력 모든 날짜 아래에 음력(예: 8.27) 표시' },
    { id: 'key_days', label: '주요 음력일만 표시', desc: '초하루(1일), 보름(15일), 설/추석 등 명절만 표시' },
    { id: 'none', label: '표시 안 함 (끄기)', desc: '양력 날짜만 표시' },
  ];

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
              <Text style={styles.title}>앱 환경설정 & 백업 스튜디오</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={20} color="#64748B" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.contentScroll} showsVerticalScrollIndicator={false}>
            {/* Status notification toast message */}
            {statusMsg && (
              <View style={styles.statusToast}>
                <Text style={styles.statusToastText}>{statusMsg}</Text>
              </View>
            )}

            {/* Note Stats */}
            <View style={styles.statsCard}>
              <Text style={styles.statsLabel}>현재 저장된 총 메모</Text>
              <Text style={styles.statsNumber}>{notes.length}개</Text>
            </View>

            {/* SECTION 1: 환경설정 - 달력 음력 날짜 표시 설정 (Select Mode) */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <Moon size={16} color="#2563EB" />
                <Text style={styles.sectionTitle}>달력 음력 날짜 표시 (셀렉트 설정)</Text>
              </View>
              <Text style={styles.sectionDesc}>
                달력 화면에서 음력 날짜 및 전통 명절을 어떻게 표시할지 선택하세요.
              </Text>

              <View style={styles.radioGroup}>
                {LUNAR_OPTIONS.map((opt) => {
                  const isSelected = lunarDisplayMode === opt.id;
                  return (
                    <TouchableOpacity
                      key={opt.id}
                      style={[styles.radioItem, isSelected && styles.radioItemSelected]}
                      onPress={() => setLunarDisplayMode(opt.id)}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.radioCircle, isSelected && styles.radioCircleSelected]}>
                        {isSelected && <View style={styles.radioInnerDot} />}
                      </View>
                      <View style={styles.radioTextWrap}>
                        <Text style={[styles.radioLabel, isSelected && styles.radioLabelSelected]}>
                          {opt.label}
                        </Text>
                        <Text style={styles.radioDesc}>{opt.desc}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* SECTION 2: 자동 백업 옵션 & 최근 자동 스냅샷 */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeaderRow}>
                <View style={styles.sectionHeader}>
                  <ShieldCheck size={16} color="#059669" />
                  <Text style={styles.sectionTitle}>자동 백업 (Auto-Backup)</Text>
                </View>
                <TouchableOpacity
                  style={[styles.toggleBtn, autoBackupEnabled && styles.toggleBtnActive]}
                  onPress={() => setAutoBackupEnabled(!autoBackupEnabled)}
                >
                  <Text style={[styles.toggleBtnText, autoBackupEnabled && styles.toggleBtnTextActive]}>
                    {autoBackupEnabled ? '자동 백업 켜짐' : '꺼짐'}
                  </Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.sectionDesc}>
                메모를 작성하거나 변경할 때마다 데이터 손실 방지를 위해 로컬에 안전한 스냅샷을 자동 보관합니다.
              </Text>

              {autoBackups.length > 0 ? (
                <View style={styles.snapshotList}>
                  <Text style={styles.snapshotHeading}>최근 자동 백업 기록 (최대 5개):</Text>
                  {autoBackups.map((snap) => (
                    <View key={snap.timestamp} style={styles.snapshotRow}>
                      <View style={styles.snapshotInfo}>
                        <Clock size={13} color="#64748B" />
                        <Text style={styles.snapshotDate}>{snap.dateStr}</Text>
                        <Text style={styles.snapshotCount}>({snap.noteCount}개 메모)</Text>
                      </View>
                      <TouchableOpacity
                        style={styles.snapshotRestoreBtn}
                        onPress={() => handleRestoreSnapshot(snap)}
                      >
                        <RotateCcw size={12} color="#2563EB" />
                        <Text style={styles.snapshotRestoreText}>복원</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>

            {/* SECTION 3: 파일로 내보내기 & 가져오기 (공유 / 전달) */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <Share2 size={16} color="#D97706" />
                <Text style={styles.sectionTitle}>파일 내보내기 & 가져오기 (공유/전달)</Text>
              </View>
              <Text style={styles.sectionDesc}>
                백업 파일을 생성하여 다른 사람에게 전달하거나, 외부 저장소(구글 드라이브, 카카오톡 등)로 안전하게 보관할 수 있습니다.
              </Text>

              <View style={styles.fileActionRow}>
                <TouchableOpacity style={styles.primaryActionBtn} onPress={handleExportFile}>
                  <Download size={16} color="#FFFFFF" />
                  <Text style={styles.primaryActionText}>백업 파일로 저장 / 공유</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.secondaryActionBtn} onPress={handleImportFile}>
                  <FolderOpen size={16} color="#0F172A" />
                  <Text style={styles.secondaryActionText}>파일에서 불러오기</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* SECTION 4: 텍스트 JSON 백업/복원 */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <Database size={16} color="#64748B" />
                <Text style={styles.sectionTitle}>텍스트 JSON 백업 / 직접 붙여넣기</Text>
              </View>

              <View style={styles.fileActionRow}>
                <TouchableOpacity style={styles.textActionBtn} onPress={handleExportText}>
                  <Download size={14} color="#334155" />
                  <Text style={styles.textActionText}>JSON 생성 / 복사</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.textActionBtn} onPress={handleImportText}>
                  <Upload size={14} color="#334155" />
                  <Text style={styles.textActionText}>아래 텍스트로 복원</Text>
                </TouchableOpacity>
              </View>

              {copiedMsg && (
                <Text style={styles.copiedNotice}>
                  ✓ 클립보드에 JSON 백업 데이터가 복사되었습니다!
                </Text>
              )}

              <TextInput
                style={styles.jsonInput}
                multiline
                placeholder="백업 JSON 텍스트를 여기에 붙여넣거나 확인할 수 있습니다."
                placeholderTextColor="#94A3B8"
                value={jsonText}
                onChangeText={setJsonText}
              />
            </View>

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
    maxWidth: 480,
    maxHeight: '88%',
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
    marginBottom: 12,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  closeBtn: {
    padding: 4,
  },
  contentScroll: {
    flexGrow: 0,
  },
  statusToast: {
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#86EFAC',
    borderRadius: 8,
    padding: 8,
    marginBottom: 10,
  },
  statusToastText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#166534',
    textAlign: 'center',
  },
  statsCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  statsLabel: {
    fontSize: 11,
    color: '#64748B',
    marginBottom: 2,
  },
  statsNumber: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
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
    color: '#0F172A',
  },
  sectionDesc: {
    fontSize: 11.5,
    color: '#64748B',
    lineHeight: 16,
    marginBottom: 10,
  },
  radioGroup: {
    gap: 8,
  },
  radioItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 10,
  },
  radioItemSelected: {
    backgroundColor: '#EFF6FF',
    borderColor: '#3B82F6',
  },
  radioCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: '#94A3B8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircleSelected: {
    borderColor: '#2563EB',
  },
  radioInnerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2563EB',
  },
  radioTextWrap: {
    flex: 1,
  },
  radioLabel: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#334155',
  },
  radioLabelSelected: {
    color: '#1D4ED8',
  },
  radioDesc: {
    fontSize: 10.5,
    color: '#64748B',
    marginTop: 2,
  },
  toggleBtn: {
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  toggleBtnActive: {
    backgroundColor: '#DCFCE7',
    borderColor: '#86EFAC',
  },
  toggleBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  toggleBtnTextActive: {
    color: '#166534',
  },
  snapshotList: {
    marginTop: 6,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 8,
  },
  snapshotHeading: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 6,
  },
  snapshotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  snapshotInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  snapshotDate: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#1E293B',
  },
  snapshotCount: {
    fontSize: 10.5,
    color: '#64748B',
  },
  snapshotRestoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  snapshotRestoreText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2563EB',
  },
  fileActionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  primaryActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#0F172A',
    paddingVertical: 10,
    borderRadius: 10,
  },
  primaryActionText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  secondaryActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#F1F5F9',
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  secondaryActionText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  textActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#F8FAFC',
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  textActionText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#334155',
  },
  copiedNotice: {
    color: '#059669',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 6,
  },
  jsonInput: {
    height: 70,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    padding: 8,
    fontSize: 10.5,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: '#334155',
    textAlignVertical: 'top',
    marginTop: 8,
  },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    marginTop: 4,
    marginBottom: 8,
  },
  resetBtnText: {
    color: '#DC2626',
    fontSize: 12,
    fontWeight: '600',
  },
});
