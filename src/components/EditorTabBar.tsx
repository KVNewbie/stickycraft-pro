import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform, Modal } from 'react-native';
import {
  FileText,
  File,
  Palette,
  Plus,
  X,
  ClipboardPaste,
  ChevronDown,
} from 'lucide-react-native';
import * as DocumentPicker from 'expo-document-picker';
import { useNoteStore } from '../store/useNoteStore';
import { EditorTab } from '../types/note';

interface EditorTabBarProps {
  onPasteSnippet?: () => void;
}

export const EditorTabBar: React.FC<EditorTabBarProps> = ({ onPasteSnippet }) => {
  const {
    editorTabs,
    activeEditorTabId,
    setActiveEditorTab,
    closeEditorTab,
    addEditorTab,
    capturedSnippet,
  } = useNoteStore();

  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleCreateNoteTab = () => {
    setIsAddMenuOpen(false);
    addEditorTab({
      title: `메모 ${editorTabs.length + 1}`,
      type: 'note',
    });
  };

  const handleCreateCanvasTab = () => {
    setIsAddMenuOpen(false);
    addEditorTab({
      title: `자유 필기장 ${editorTabs.length + 1}`,
      type: 'canvas',
    });
  };

  const handleOpenPdfFile = async () => {
    setIsAddMenuOpen(false);
    if (Platform.OS === 'web') {
      fileInputRef.current?.click();
    } else {
      try {
        const result = await DocumentPicker.getDocumentAsync({
          type: ['application/pdf', 'image/*'],
          copyToCacheDirectory: true,
        });
        if (!result.canceled && result.assets && result.assets.length > 0) {
          const file = result.assets[0];
          addEditorTab({
            title: file.name || `PDF 문서 ${editorTabs.length + 1}`,
            type: 'pdf',
            pdfUri: file.uri,
            pdfName: file.name,
          });
          return;
        }
      } catch (err) {
        console.warn('DocumentPicker in TabBar cancelled or failed', err);
      }
      // 취소되었거나 기본 워크스페이스 열기
      addEditorTab({
        title: `PDF 문서 ${editorTabs.length + 1}`,
        type: 'pdf',
      });
    }
  };

  const handleFileInputChange = (event: any) => {
    const file = event.target?.files?.[0];
    if (file) {
      const objectUrl = URL.createObjectURL(file);
      addEditorTab({
        title: file.name || '문서 뷰어',
        type: 'pdf',
        pdfUri: objectUrl,
        pdfName: file.name,
      });
    }
    // reset input
    if (event.target) event.target.value = '';
  };

  const getTabIcon = (type: EditorTab['type']) => {
    switch (type) {
      case 'pdf':
        return <File size={14} color="#e11d48" />;
      case 'canvas':
        return <Palette size={14} color="#7c3aed" />;
      case 'note':
      default:
        return <FileText size={14} color="#2563eb" />;
    }
  };

  return (
    <View style={styles.container}>
      {/* 숨겨진 파일 선택기 (웹) */}
      {Platform.OS === 'web' && (
        <input
          type="file"
          ref={fileInputRef as any}
          style={{ display: 'none' }}
          accept="application/pdf,image/*"
          onChange={handleFileInputChange}
        />
      )}

      {/* 탭 리스트 가로 스크롤 */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabsScrollContent}
      >
        {editorTabs.map((tab) => {
          const isActive = tab.id === activeEditorTabId;
          return (
            <TouchableOpacity
              key={tab.id}
              style={[styles.tabItem, isActive && styles.tabItemActive]}
              onPress={() => setActiveEditorTab(tab.id)}
              activeOpacity={0.7}
            >
              <View style={styles.tabIconWrap}>{getTabIcon(tab.type)}</View>
              <Text
                style={[styles.tabTitle, isActive && styles.tabTitleActive]}
                numberOfLines={1}
              >
                {tab.title}
              </Text>
              {editorTabs.length > 1 && (
                <TouchableOpacity
                  style={styles.closeBtn}
                  onPress={(e) => {
                    e.stopPropagation();
                    closeEditorTab(tab.id);
                  }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <X size={12} color={isActive ? '#475569' : '#94a3b8'} />
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          );
        })}

        {/* 새 탭 추가 버튼 (+) */}
        <View style={styles.addTabContainer}>
          <TouchableOpacity
            style={styles.addTabBtn}
            onPress={() => setIsAddMenuOpen(true)}
          >
            <Plus size={16} color="#475569" />
            <ChevronDown size={11} color="#64748b" style={{ marginLeft: 2 }} />
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* 탭 추가 팝오버 모달 */}
      <Modal
        visible={isAddMenuOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsAddMenuOpen(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setIsAddMenuOpen(false)}
        >
          <View style={styles.addDropdownCard}>
            <Text style={styles.dropdownHeaderTitle}>새 탭 열기</Text>
            <TouchableOpacity
              style={styles.dropdownItem}
              onPress={handleCreateNoteTab}
            >
              <FileText size={16} color="#2563eb" />
              <View>
                <Text style={styles.dropdownText}>새 메모 탭</Text>
                <Text style={styles.dropdownSubText}>텍스트 및 스티커 메모 작성</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.dropdownItem}
              onPress={handleOpenPdfFile}
            >
              <File size={16} color="#e11d48" />
              <View>
                <Text style={styles.dropdownText}>PDF / 이미지 문서 열람</Text>
                <Text style={styles.dropdownSubText}>자료 위에 필기 및 영역 캡처</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.dropdownItem}
              onPress={handleCreateCanvasTab}
            >
              <Palette size={16} color="#7c3aed" />
              <View>
                <Text style={styles.dropdownText}>자유 필기장 탭</Text>
                <Text style={styles.dropdownSubText}>속지 템플릿과 손글씨 드로잉</Text>
              </View>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* 클립보드에 캡처본이 있을 때 표시되는 뱃지 / 붙여넣기 버튼 */}
      {capturedSnippet && onPasteSnippet && (
        <TouchableOpacity
          style={styles.snippetBadge}
          onPress={onPasteSnippet}
          activeOpacity={0.8}
        >
          <ClipboardPaste size={14} color="#ffffff" />
          <Text style={styles.snippetText}>캡처본 붙여넣기</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 42,
    backgroundColor: '#f1f5f9',
    borderBottomWidth: 1,
    borderBottomColor: '#cbd5e1',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    zIndex: 100,
  },
  tabsScrollContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 10,
  },
  tabItem: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 32,
    paddingHorizontal: 12,
    marginRight: 6,
    borderRadius: 8,
    backgroundColor: '#e2e8f0',
    maxWidth: 160,
  },
  tabItemActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
    borderBottomWidth: 2,
    borderBottomColor: '#3b82f6',
  },
  tabIconWrap: {
    marginRight: 6,
  },
  tabTitle: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
    maxWidth: 90,
  },
  tabTitleActive: {
    color: '#0f172a',
    fontWeight: '700',
  },
  closeBtn: {
    marginLeft: 6,
    padding: 2,
    borderRadius: 6,
  },
  addTabContainer: {
    position: 'relative',
    zIndex: 200,
  },
  addTabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 30,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: '#e2e8f0',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  addDropdownCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    width: '100%',
    maxWidth: 320,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 10,
    gap: 6,
  },
  dropdownHeaderTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 6,
    paddingHorizontal: 6,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 12,
    borderRadius: 8,
    backgroundColor: '#f8fafc',
  },
  dropdownText: {
    fontSize: 13,
    color: '#1e293b',
    fontWeight: '600',
  },
  dropdownSubText: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  snippetBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2563eb',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 5,
    marginLeft: 'auto',
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  snippetText: {
    fontSize: 11,
    color: '#ffffff',
    fontWeight: '700',
  },
});
