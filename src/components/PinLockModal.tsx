import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNoteStore } from '../store/useNoteStore';

export const PinLockModal: React.FC = () => {
  const {
    isLockModalOpen,
    lockTargetNote,
    lockCallback,
    closeLockModal,
    masterPin,
    setMasterPin,
  } = useNoteStore();

  const [inputPin, setInputPin] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [setupStep, setSetupStep] = useState<'enter' | 'create' | 'confirm'>('enter');
  const [tempFirstPin, setTempFirstPin] = useState('');

  // Reset state on open
  useEffect(() => {
    if (isLockModalOpen) {
      setInputPin('');
      setErrorMessage('');
      if (!masterPin && (!lockTargetNote || !lockTargetNote.lockPin)) {
        setSetupStep('create');
      } else {
        setSetupStep('enter');
      }
    }
  }, [isLockModalOpen, masterPin, lockTargetNote]);

  if (!isLockModalOpen) {
    return null;
  }

  const targetPin = lockTargetNote?.lockPin || masterPin;

  const handleKeyPress = (num: string) => {
    if (inputPin.length >= 4) return;
    const nextPin = inputPin + num;
    setInputPin(nextPin);
    setErrorMessage('');

    if (nextPin.length === 4) {
      // 4자리 완성 시 자동 검증
      setTimeout(() => {
        handleCompletePin(nextPin);
      }, 150);
    }
  };

  const handleDelete = () => {
    if (inputPin.length > 0) {
      setInputPin(inputPin.slice(0, -1));
      setErrorMessage('');
    }
  };

  const handleClear = () => {
    setInputPin('');
    setErrorMessage('');
  };

  const handleCompletePin = (pin: string) => {
    if (setupStep === 'create') {
      setTempFirstPin(pin);
      setInputPin('');
      setSetupStep('confirm');
    } else if (setupStep === 'confirm') {
      if (pin === tempFirstPin) {
        setMasterPin(pin);
        if (lockCallback) {
          lockCallback();
        }
        closeLockModal();
      } else {
        setErrorMessage('비밀번호가 일치하지 않습니다. 다시 입력해주세요.');
        setInputPin('');
        setSetupStep('create');
      }
    } else {
      // 'enter' mode
      if (pin === targetPin) {
        if (lockCallback) {
          lockCallback();
        }
        closeLockModal();
      } else {
        setErrorMessage('비밀번호가 틀렸습니다. 다시 시도해주세요.');
        setInputPin('');
      }
    }
  };

  const getTitle = () => {
    if (setupStep === 'create') return '마스터 PIN 4자리 설정';
    if (setupStep === 'confirm') return 'PIN 번호 재입력 확인';
    return '비밀번호를 입력하세요';
  };

  const getSubDesc = () => {
    if (setupStep === 'create') return '잠긴 메모를 안전하게 보관할 4자리 비밀번호를 입력해주세요.';
    if (setupStep === 'confirm') return '확인을 위해 동일한 번호를 한 번 더 입력해주세요.';
    return `'${lockTargetNote?.title || '메모'}' 잠금을 해제합니다.`;
  };

  return (
    <Modal
      visible={isLockModalOpen}
      transparent
      animationType="fade"
      onRequestClose={closeLockModal}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.lockIconWrap}>
              <Ionicons name="lock-closed" size={28} color="#2563EB" />
            </View>
            <TouchableOpacity onPress={closeLockModal} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color="#64748B" />
            </TouchableOpacity>
          </View>

          <Text style={styles.title}>{getTitle()}</Text>
          <Text style={styles.subtitle}>{getSubDesc()}</Text>

          {/* Dots Display */}
          <View style={styles.dotsRow}>
            {[0, 1, 2, 3].map((idx) => {
              const isFilled = inputPin.length > idx;
              return (
                <View
                  key={idx}
                  style={[
                    styles.dot,
                    isFilled && styles.dotFilled,
                    errorMessage ? styles.dotError : null,
                  ]}
                />
              );
            })}
          </View>

          {/* Error Message */}
          {errorMessage ? (
            <Text style={styles.errorText}>{errorMessage}</Text>
          ) : (
            <View style={{ height: 20 }} />
          )}

          {/* Keypad */}
          <View style={styles.keypad}>
            {[
              ['1', '2', '3'],
              ['4', '5', '6'],
              ['7', '8', '9'],
              ['C', '0', '⌫'],
            ].map((row, rowIdx) => (
              <View key={rowIdx} style={styles.keypadRow}>
                {row.map((btn) => {
                  const isSpecial = btn === 'C' || btn === '⌫';
                  return (
                    <TouchableOpacity
                      key={btn}
                      style={[styles.keyBtn, isSpecial && styles.specialKeyBtn]}
                      onPress={() => {
                        if (btn === 'C') handleClear();
                        else if (btn === '⌫') handleDelete();
                        else handleKeyPress(btn);
                      }}
                      activeOpacity={0.7}
                    >
                      {btn === '⌫' ? (
                        <Ionicons name="backspace-outline" size={24} color="#64748B" />
                      ) : (
                        <Text style={[styles.keyText, isSpecial && styles.specialKeyText]}>
                          {btn}
                        </Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 20,
  },
  header: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  lockIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtn: {
    padding: 6,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 10,
  },
  subtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 20,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 16,
    marginVertical: 12,
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    backgroundColor: 'transparent',
  },
  dotFilled: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  dotError: {
    borderColor: '#EF4444',
    backgroundColor: '#EF4444',
  },
  errorText: {
    fontSize: 12,
    color: '#EF4444',
    fontWeight: '600',
    height: 20,
    marginTop: 2,
    textAlign: 'center',
  },
  keypad: {
    width: '100%',
    gap: 12,
    marginTop: 16,
  },
  keypadRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  keyBtn: {
    flex: 1,
    height: 56,
    borderRadius: 16,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  specialKeyBtn: {
    backgroundColor: '#F1F5F9',
  },
  keyText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1E293B',
  },
  specialKeyText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#64748B',
  },
});
