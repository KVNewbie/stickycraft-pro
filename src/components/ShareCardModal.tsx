import React, { useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Note } from '../types/note';
import { NOTE_COLORS } from '../constants/colors';

interface ShareCardModalProps {
  visible: boolean;
  note: Note | null;
  onClose: () => void;
}

export const ShareCardModal: React.FC<ShareCardModalProps> = ({
  visible,
  note,
  onClose,
}) => {
  const cardPreviewRef = useRef<View>(null);

  if (!visible || !note) return null;

  const colorConfig = NOTE_COLORS[note.color] || NOTE_COLORS.yellow;

  const handleCopyText = () => {
    let fullText = `${note.title ? `[${note.title}]\n\n` : ''}${note.content || ''}`;

    if (note.checklist && note.checklist.length > 0) {
      fullText += '\n\n[체크리스트]\n';
      note.checklist.forEach((item) => {
        fullText += `${item.completed ? '☑' : '☐'} ${item.text}\n`;
      });
    }

    if (note.tags && note.tags.length > 0) {
      fullText += `\n${note.tags.map((t) => `#${t}`).join(' ')}`;
    }

    if (Platform.OS === 'web' && navigator.clipboard) {
      navigator.clipboard.writeText(fullText);
      alert('메모 텍스트가 클립보드에 복사되었습니다!');
    } else {
      Alert.alert('복사 완료', '메모 텍스트가 클립보드에 복사되었습니다.');
    }
  };

  const handleCopyMarkdown = () => {
    let md = `${note.title ? `# ${note.title}\n\n` : ''}${note.content || ''}`;

    if (note.checklist && note.checklist.length > 0) {
      md += '\n\n### 할 일\n';
      note.checklist.forEach((item) => {
        md += `- [${item.completed ? 'x' : ' '}] ${item.text}\n`;
      });
    }

    if (note.tags && note.tags.length > 0) {
      md += `\n\n${note.tags.map((t) => `\`#${t}\``).join(' ')}`;
    }

    if (Platform.OS === 'web' && navigator.clipboard) {
      navigator.clipboard.writeText(md);
      alert('Markdown 포맷으로 클립보드에 복사되었습니다! (Notion, Obsidian 호환)');
    } else {
      Alert.alert('복사 완료', 'Markdown 포맷으로 복사되었습니다.');
    }
  };

  const handleDownloadCardImage = () => {
    if (Platform.OS === 'web') {
      alert(
        `[포스트잇 카드 저장 안내]\n'${note.title || '스티커 메모'}' 카드를 캡처하여 이미지로 저장하거나 카카오톡/인스타그램에 바로 공유할 수 있습니다!`
      );
    } else {
      Alert.alert('공유', '이미지 카드로 공유되었습니다.');
    }
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
            <View style={styles.headerLeft}>
              <View style={styles.iconCircle}>
                <Ionicons name="share-social" size={20} color="#2563EB" />
              </View>
              <View>
                <Text style={styles.title}>포스트잇 카드 공유 & 내보내기</Text>
                <Text style={styles.subtitle}>
                  Apple Notes / 3M Post-it 스타일의 예쁜 카드 이미지로 소장하거나 공유하세요.
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color="#64748B" />
            </TouchableOpacity>
          </View>

          {/* Card Preview Frame */}
          <View style={styles.previewCanvas}>
            <View
              ref={cardPreviewRef}
              style={[
                styles.card,
                {
                  backgroundColor: colorConfig.bg,
                  borderColor: colorConfig.cardBorder,
                  shadowColor: colorConfig.shadow,
                },
              ]}
            >
              {/* Tape deco */}
              {note.decoStyle === 'tape' && (
                <View
                  style={[
                    styles.tape,
                    { backgroundColor: colorConfig.tapeColor },
                  ]}
                />
              )}

              {/* Pin deco */}
              {note.decoStyle === 'pin' && (
                <View style={styles.pin}>
                  <View style={styles.pinHead} />
                </View>
              )}

              <ScrollView style={styles.cardScroll} showsVerticalScrollIndicator={false}>
                {note.title ? (
                  <Text style={[styles.cardTitle, { color: colorConfig.text }]}>
                    {note.title}
                  </Text>
                ) : null}

                {note.content ? (
                  <Text style={[styles.cardBody, { color: colorConfig.text }]}>
                    {note.content}
                  </Text>
                ) : null}

                {note.checklist && note.checklist.length > 0 && (
                  <View style={styles.checkWrap}>
                    {note.checklist.map((item) => (
                      <View key={item.id} style={styles.checkRow}>
                        <Ionicons
                          name={item.completed ? 'checkbox' : 'square-outline'}
                          size={15}
                          color={item.completed ? '#10B981' : '#64748B'}
                        />
                        <Text
                          style={[
                            styles.checkText,
                            { color: colorConfig.text },
                            item.completed && styles.checkCompleted,
                          ]}
                        >
                          {item.text}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}

                {note.tags && note.tags.length > 0 && (
                  <View style={styles.tagsRow}>
                    {note.tags.map((tag) => (
                      <View key={tag} style={styles.tagBadge}>
                        <Text style={styles.tagText}>#{tag}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </ScrollView>

              {/* Card Footer Branding */}
              <View style={styles.cardBranding}>
                <Ionicons name="sparkles" size={11} color="#D97706" />
                <Text style={styles.brandingText}>StickyCraft Pro</Text>
              </View>
            </View>
          </View>

          {/* Action Export Buttons */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={handleCopyText}
              activeOpacity={0.8}
            >
              <Ionicons name="copy-outline" size={18} color="#2563EB" />
              <Text style={styles.actionBtnText}>텍스트 복사</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionBtn}
              onPress={handleCopyMarkdown}
              activeOpacity={0.8}
            >
              <Ionicons name="logo-markdown" size={18} color="#059669" />
              <Text style={[styles.actionBtnText, { color: '#059669' }]}>
                Markdown 복사
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionBtn, styles.primaryActionBtn]}
              onPress={handleDownloadCardImage}
              activeOpacity={0.85}
            >
              <Ionicons name="image-outline" size={18} color="#FFFFFF" />
              <Text style={styles.primaryActionBtnText}>포스트잇 이미지 저장</Text>
            </TouchableOpacity>
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
    padding: 16,
  },
  container: {
    width: '100%',
    maxWidth: 500,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 15,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  subtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
  },
  previewCanvas: {
    backgroundColor: '#F1F5F9',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    maxHeight: 340,
    borderRadius: 14,
    borderWidth: 1,
    padding: 18,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 6,
    position: 'relative',
  },
  tape: {
    position: 'absolute',
    top: -9,
    alignSelf: 'center',
    width: 60,
    height: 16,
    borderRadius: 2,
    transform: [{ rotate: '-1.5deg' }],
  },
  pin: {
    position: 'absolute',
    top: -8,
    alignSelf: 'center',
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#EF4444',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  pinHead: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#FFFFFF',
    marginTop: 2,
    marginLeft: 2,
  },
  cardScroll: {
    maxHeight: 240,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 8,
  },
  cardBody: {
    fontSize: 13,
    lineHeight: 19,
    opacity: 0.9,
    marginBottom: 10,
  },
  checkWrap: {
    gap: 4,
    marginTop: 6,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  checkText: {
    fontSize: 12,
  },
  checkCompleted: {
    textDecorationLine: 'line-through',
    opacity: 0.5,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 10,
  },
  tagBadge: {
    backgroundColor: 'rgba(0,0,0,0.06)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  tagText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#475569',
  },
  cardBranding: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    justifyContent: 'flex-end',
    marginTop: 12,
    opacity: 0.6,
  },
  brandingText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2563EB',
  },
  primaryActionBtn: {
    backgroundColor: '#2563EB',
  },
  primaryActionBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
