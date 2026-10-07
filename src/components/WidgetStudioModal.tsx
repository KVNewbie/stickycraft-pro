import React, { useState } from 'react';
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
import { useNoteStore } from '../store/useNoteStore';
import { NOTE_COLORS } from '../constants/colors';
import { WidgetSize } from '../types/note';

const WIDGET_SIZES: { id: WidgetSize; label: string; desc: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: '1x1', label: '1x1 미니 타일', desc: '바탕화면 심플 바로가기 아이콘', icon: 'square-outline' },
  { id: '2x2', label: '2x2 스티커 메모', desc: '가장 인기 있는 정사각 포스트잇', icon: 'grid-outline' },
  { id: '4x2', label: '4x2 할일 체크리스트', desc: '홈 화면에서 바로 체크하는 와이드 뷰', icon: 'list-outline' },
  { id: '4x4', label: '4x4 종합 캔버스', desc: '사진과 본문이 모두 보이는 풀 위젯', icon: 'newspaper-outline' },
];

export const WidgetStudioModal: React.FC = () => {
  const {
    isWidgetModalOpen,
    widgetTargetNote,
    closeWidgetModal,
    widgets,
    addWidget,
    removeWidget,
    updateWidget,
    toggleChecklistItem,
  } = useNoteStore();

  const [selectedSize, setSelectedSize] = useState<WidgetSize>('2x2');
  const [selectedOpacity, setSelectedOpacity] = useState<number>(0.95);
  const [showDeco, setShowDeco] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'create' | 'manage'>('create');

  if (!isWidgetModalOpen || !widgetTargetNote) {
    return null;
  }

  const noteColor = NOTE_COLORS[widgetTargetNote.color] || NOTE_COLORS.yellow;
  const noteWidgets = widgets.filter((w) => w.noteId === widgetTargetNote.id);

  const handleCreateWidget = () => {
    addWidget(widgetTargetNote.id, selectedSize, selectedOpacity, showDeco);
    if (Platform.OS === 'web') {
      alert(`[ColorNote 위젯 생성 완료]\n${widgetTargetNote.title || '메모'} (${selectedSize}) 위젯이 성공적으로 생성되었습니다!`);
    } else {
      Alert.alert(
        '위젯 생성 완료',
        `'${widgetTargetNote.title || '메모'}' (${selectedSize}) 위젯이 생성되었습니다. 모바일 홈 화면 위젯 목록에서도 바로 선택하실 수 있습니다.`,
        [{ text: '확인' }]
      );
    }
    setActiveTab('manage');
  };

  return (
    <Modal
      visible={isWidgetModalOpen}
      transparent
      animationType="slide"
      onRequestClose={closeWidgetModal}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={[styles.colorDot, { backgroundColor: noteColor.shadow }]} />
              <Text style={styles.title} numberOfLines={1}>
                ColorNote 스타일 위젯 스튜디오
              </Text>
            </View>
            <TouchableOpacity onPress={closeWidgetModal} style={styles.closeBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={24} color="#4A5568" />
            </TouchableOpacity>
          </View>

          {/* Subtitle */}
          <Text style={styles.subtitle}>
            스마트폰 홈 화면에 노트를 띄워 두고 즉시 확인하고 체크할 수 있습니다.
          </Text>

          {/* Mode Switcher Tabs */}
          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'create' && styles.tabBtnActive]}
              onPress={() => setActiveTab('create')}
            >
              <Ionicons
                name="add-circle-outline"
                size={16}
                color={activeTab === 'create' ? '#2563EB' : '#718096'}
              />
              <Text style={[styles.tabText, activeTab === 'create' && styles.tabTextActive]}>
                위젯 디자인 & 추가
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'manage' && styles.tabBtnActive]}
              onPress={() => setActiveTab('manage')}
            >
              <Ionicons
                name="layers-outline"
                size={16}
                color={activeTab === 'manage' ? '#2563EB' : '#718096'}
              />
              <Text style={[styles.tabText, activeTab === 'manage' && styles.tabTextActive]}>
                생성된 위젯 관리 ({noteWidgets.length})
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollArea} contentContainerStyle={styles.scrollContent}>
            {activeTab === 'create' ? (
              <>
                {/* 1. Size Selection */}
                <Text style={styles.sectionHeading}>1. 위젯 크기 선택</Text>
                <View style={styles.sizeGrid}>
                  {WIDGET_SIZES.map((sizeOpt) => {
                    const isSelected = selectedSize === sizeOpt.id;
                    return (
                      <TouchableOpacity
                        key={sizeOpt.id}
                        style={[styles.sizeCard, isSelected && styles.sizeCardActive]}
                        onPress={() => setSelectedSize(sizeOpt.id)}
                        activeOpacity={0.7}
                      >
                        <View style={[styles.sizeIconWrap, isSelected && styles.sizeIconWrapActive]}>
                          <Ionicons
                            name={sizeOpt.icon}
                            size={20}
                            color={isSelected ? '#2563EB' : '#64748B'}
                          />
                        </View>
                        <View style={styles.sizeTextWrap}>
                          <Text style={[styles.sizeLabel, isSelected && styles.sizeLabelActive]}>
                            {sizeOpt.label}
                          </Text>
                          <Text style={styles.sizeDesc}>{sizeOpt.desc}</Text>
                        </View>
                        {isSelected && (
                          <Ionicons name="checkmark-circle" size={18} color="#2563EB" />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* 2. Visual Options */}
                <Text style={styles.sectionHeading}>2. 스타일 및 배경 투명도 (0% ~ 100%)</Text>
                <View style={styles.optionColumn}>
                  <View style={styles.optionHeaderRow}>
                    <Text style={styles.optionLabel}>배경 투명도 설정</Text>
                    <Text style={styles.opacityValueHighlight}>
                      {Math.round(selectedOpacity * 100)}%
                    </Text>
                  </View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.opacityBtnGroup}>
                    {[
                      { val: 1.0, label: '100% (불투명)' },
                      { val: 0.9, label: '90%' },
                      { val: 0.8, label: '80%' },
                      { val: 0.7, label: '70%' },
                      { val: 0.5, label: '50% (반투명)' },
                      { val: 0.3, label: '30%' },
                      { val: 0.15, label: '15%' },
                      { val: 0.0, label: '0% (완전투명)' },
                    ].map((op) => (
                      <TouchableOpacity
                        key={op.label}
                        style={[
                          styles.opacityBtn,
                          selectedOpacity === op.val && styles.opacityBtnActive,
                        ]}
                        onPress={() => setSelectedOpacity(op.val)}
                      >
                        <Text
                          style={[
                            styles.opacityBtnText,
                            selectedOpacity === op.val && styles.opacityBtnTextActive,
                          ]}
                        >
                          {op.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>

                <View style={styles.optionRow}>
                  <Text style={styles.optionLabel}>상단 테이프 / 핀 데코</Text>
                  <TouchableOpacity
                    style={[styles.toggleBtn, showDeco && styles.toggleBtnActive]}
                    onPress={() => setShowDeco(!showDeco)}
                  >
                    <Ionicons
                      name={showDeco ? 'checkbox' : 'square-outline'}
                      size={20}
                      color={showDeco ? '#2563EB' : '#94A3B8'}
                    />
                    <Text style={[styles.toggleText, showDeco && styles.toggleTextActive]}>
                      {showDeco ? '데코 켜짐' : '심플 모드'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* 3. Live Phone Mockup Preview */}
                <Text style={styles.sectionHeading}>3. 실시간 홈 화면 미리보기</Text>
                <View style={styles.phoneMockup}>
                  {/* Phone Status Bar */}
                  <View style={styles.mockupStatusBar}>
                    <Text style={styles.mockupTime}>9:41</Text>
                    <View style={styles.mockupIcons}>
                      <Ionicons name="wifi" size={12} color="#CBD5E1" />
                      <Ionicons name="cellular" size={12} color="#CBD5E1" style={{ marginLeft: 4 }} />
                      <Ionicons name="battery-full" size={12} color="#CBD5E1" style={{ marginLeft: 4 }} />
                    </View>
                  </View>

                  {/* Widget Container based on size */}
                  <View style={styles.mockupWorkspace}>
                    <View
                      style={[
                        styles.widgetPreviewBox,
                        selectedSize === '1x1' && styles.widget1x1,
                        selectedSize === '2x2' && styles.widget2x2,
                        selectedSize === '4x2' && styles.widget4x2,
                        selectedSize === '4x4' && styles.widget4x4,
                        {
                          backgroundColor: noteColor.bg,
                          opacity: selectedOpacity,
                          borderColor: noteColor.cardBorder,
                        },
                      ]}
                    >
                      {/* Top Deco */}
                      {showDeco && (
                        <View style={styles.widgetDecoWrap}>
                          {widgetTargetNote.decoStyle === 'pin' ? (
                            <View style={styles.widgetPin}>
                              <View style={styles.widgetPinHead} />
                            </View>
                          ) : (
                            <View style={styles.widgetTape} />
                          )}
                        </View>
                      )}

                      {/* 1x1 Render */}
                      {selectedSize === '1x1' && (
                        <View style={styles.preview1x1Content}>
                          <Ionicons name="document-text" size={24} color={noteColor.shadow} />
                          <Text
                            style={[styles.previewTitle, { color: noteColor.text }]}
                            numberOfLines={1}
                          >
                            {widgetTargetNote.title || '메모'}
                          </Text>
                        </View>
                      )}

                      {/* 2x2 Render */}
                      {selectedSize === '2x2' && (
                        <View style={styles.preview2x2Content}>
                          <Text
                            style={[styles.previewTitle, { color: noteColor.text }]}
                            numberOfLines={1}
                          >
                            {widgetTargetNote.title || '메모'}
                          </Text>
                          <Text
                            style={[styles.previewBody, { color: noteColor.text }]}
                            numberOfLines={4}
                          >
                            {widgetTargetNote.content || '내용 없음'}
                          </Text>
                        </View>
                      )}

                      {/* 4x2 Render */}
                      {selectedSize === '4x2' && (
                        <View style={styles.preview4x2Content}>
                          <View style={styles.previewHeaderRow}>
                            <Text
                              style={[styles.previewTitle, { color: noteColor.text }]}
                              numberOfLines={1}
                            >
                              {widgetTargetNote.title || '할 일 체크리스트'}
                            </Text>
                            <Ionicons name="flash" size={14} color={noteColor.shadow} />
                          </View>
                          {widgetTargetNote.checklist && widgetTargetNote.checklist.length > 0 ? (
                            widgetTargetNote.checklist.slice(0, 3).map((item) => (
                              <View key={item.id} style={styles.mockCheckRow}>
                                <Ionicons
                                  name={item.completed ? 'checkmark-circle' : 'ellipse-outline'}
                                  size={14}
                                  color={item.completed ? '#10B981' : '#94A3B8'}
                                />
                                <Text
                                  style={[
                                    styles.mockCheckText,
                                    { color: noteColor.text },
                                    item.completed && styles.mockCheckCompleted,
                                  ]}
                                  numberOfLines={1}
                                >
                                  {item.text}
                                </Text>
                              </View>
                            ))
                          ) : (
                            <Text
                              style={[styles.previewBody, { color: noteColor.text }]}
                              numberOfLines={3}
                            >
                              {widgetTargetNote.content || '본문 내용이 표시됩니다.'}
                            </Text>
                          )}
                        </View>
                      )}

                      {/* 4x4 Render */}
                      {selectedSize === '4x4' && (
                        <View style={styles.preview4x4Content}>
                          <Text
                            style={[styles.previewTitleLarge, { color: noteColor.text }]}
                            numberOfLines={1}
                          >
                            {widgetTargetNote.title || '메모'}
                          </Text>
                          <Text
                            style={[styles.previewBody, { color: noteColor.text }]}
                            numberOfLines={6}
                          >
                            {widgetTargetNote.content || '내용 없음'}
                          </Text>
                          {widgetTargetNote.images && widgetTargetNote.images.length > 0 && (
                            <View style={styles.mockImgBadge}>
                              <Ionicons name="image" size={12} color="#FFF" />
                              <Text style={styles.mockImgBadgeText}>
                                사진 {widgetTargetNote.images.length}장 포함
                              </Text>
                            </View>
                          )}
                        </View>
                      )}
                    </View>
                  </View>

                  <Text style={styles.mockupGuideText}>
                    💡 실제 홈 화면에서는 터치 시 즉시 해당 메모가 열리며 편집할 수 있습니다.
                  </Text>
                </View>

                {/* Add Button */}
                <TouchableOpacity
                  style={styles.addWidgetBtn}
                  onPress={handleCreateWidget}
                  activeOpacity={0.8}
                >
                  <Ionicons name="add" size={20} color="#FFF" />
                  <Text style={styles.addWidgetBtnText}>
                    이 스타일로 위젯 생성하기 ({selectedSize})
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              /* Manage Tab */
              <View style={styles.manageContainer}>
                {noteWidgets.length === 0 ? (
                  <View style={styles.emptyWrap}>
                    <Ionicons name="apps-outline" size={48} color="#CBD5E1" />
                    <Text style={styles.emptyTitle}>생성된 위젯이 없습니다.</Text>
                    <Text style={styles.emptyDesc}>
                      '위젯 디자인 & 추가' 탭에서 원하는 크기의 위젯을 생성해보세요.
                    </Text>
                    <TouchableOpacity
                      style={styles.switchTabBtn}
                      onPress={() => setActiveTab('create')}
                    >
                      <Text style={styles.switchTabBtnText}>새 위젯 만들기</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <>
                    <Text style={styles.sectionHeading}>
                      현재 등록된 ColorNote 위젯 ({noteWidgets.length}개)
                    </Text>
                    {noteWidgets.map((w, idx) => (
                      <View key={w.id} style={styles.widgetItemCard}>
                        <View style={styles.widgetItemHeader}>
                          <View style={styles.widgetBadge}>
                            <Text style={styles.widgetBadgeText}>{w.size}</Text>
                          </View>
                          <Text style={styles.widgetItemTitle}>위젯 #{idx + 1}</Text>
                          <TouchableOpacity
                            onPress={() => removeWidget(w.id)}
                            style={styles.deleteWidgetBtn}
                          >
                            <Ionicons name="trash-outline" size={16} color="#EF4444" />
                            <Text style={styles.deleteWidgetText}>삭제</Text>
                          </TouchableOpacity>
                        </View>

                        {/* Widget Opacity adjustment */}
                        <View style={styles.manageOpacityRow}>
                          <View style={styles.manageOpacityHeader}>
                            <Ionicons name="color-filter-outline" size={14} color="#64748B" />
                            <Text style={styles.manageOpacityLabel}>투명도 설정:</Text>
                            <Text style={styles.manageOpacityValue}>
                              {Math.round((w.opacity ?? 0.95) * 100)}%
                            </Text>
                          </View>
                          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.manageOpacityChips}>
                            {[
                              { val: 1.0, label: '100%' },
                              { val: 0.8, label: '80%' },
                              { val: 0.5, label: '50%' },
                              { val: 0.3, label: '30%' },
                              { val: 0.0, label: '0% (완전투명)' },
                            ].map((op) => {
                              const isActive = Math.abs((w.opacity ?? 0.95) - op.val) < 0.05;
                              return (
                                <TouchableOpacity
                                  key={op.label}
                                  style={[styles.manageOpBtn, isActive && styles.manageOpBtnActive]}
                                  onPress={() => updateWidget(w.id, { opacity: op.val })}
                                >
                                  <Text style={[styles.manageOpText, isActive && styles.manageOpTextActive]}>
                                    {op.label}
                                  </Text>
                                </TouchableOpacity>
                              );
                            })}
                          </ScrollView>
                        </View>

                        {/* Interactive Checklist if available */}
                        {widgetTargetNote.checklist && widgetTargetNote.checklist.length > 0 && (
                          <View style={styles.widgetChecklistWrap}>
                            <Text style={styles.checklistTitle}>
                              위젯 즉시 체크 인터랙션:
                            </Text>
                            {widgetTargetNote.checklist.map((item) => (
                              <TouchableOpacity
                                key={item.id}
                                style={styles.widgetInteractiveCheckRow}
                                onPress={() => toggleChecklistItem(widgetTargetNote.id, item.id)}
                              >
                                <Ionicons
                                  name={item.completed ? 'checkbox' : 'square-outline'}
                                  size={18}
                                  color={item.completed ? '#10B981' : '#64748B'}
                                />
                                <Text
                                  style={[
                                    styles.widgetInteractiveText,
                                    item.completed && styles.mockCheckCompleted,
                                  ]}
                                >
                                  {item.text}
                                </Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        )}
                      </View>
                    ))}
                  </>
                )}
              </View>
            )}
          </ScrollView>
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
    padding: 16,
  },
  container: {
    width: '100%',
    maxWidth: 540,
    maxHeight: '90%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    overflow: 'hidden',
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
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  colorDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    marginRight: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    flex: 1,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
  },
  subtitle: {
    fontSize: 13,
    color: '#64748B',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    gap: 12,
  },
  tabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    gap: 6,
  },
  tabBtnActive: {
    borderBottomColor: '#2563EB',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  tabTextActive: {
    color: '#2563EB',
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  sectionHeading: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 10,
    marginTop: 6,
  },
  sizeGrid: {
    gap: 8,
    marginBottom: 16,
  },
  sizeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    gap: 12,
  },
  sizeCardActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#3B82F6',
  },
  sizeIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sizeIconWrapActive: {
    backgroundColor: '#DBEAFE',
  },
  sizeTextWrap: {
    flex: 1,
  },
  sizeLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
  },
  sizeLabelActive: {
    color: '#1D4ED8',
  },
  sizeDesc: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  optionColumn: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  optionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  opacityValueHighlight: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2563EB',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  optionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  opacityBtnGroup: {
    flexDirection: 'row',
    gap: 6,
  },
  opacityBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
  },
  opacityBtnActive: {
    backgroundColor: '#2563EB',
  },
  opacityBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  opacityBtnTextActive: {
    color: '#FFFFFF',
  },
  toggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
  },
  toggleBtnActive: {
    backgroundColor: '#EFF6FF',
  },
  toggleText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  toggleTextActive: {
    color: '#2563EB',
  },
  phoneMockup: {
    backgroundColor: '#1E293B',
    borderRadius: 20,
    padding: 14,
    marginVertical: 12,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
  },
  mockupStatusBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 6,
  },
  mockupTime: {
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '600',
  },
  mockupIcons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  mockupWorkspace: {
    minHeight: 160,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0F172A',
    borderRadius: 14,
    padding: 16,
  },
  widgetPreviewBox: {
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  widget1x1: {
    width: 90,
    height: 90,
    alignItems: 'center',
    justifyContent: 'center',
  },
  widget2x2: {
    width: 160,
    height: 160,
  },
  widget4x2: {
    width: '100%',
    minHeight: 120,
  },
  widget4x4: {
    width: '100%',
    minHeight: 220,
  },
  widgetDecoWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
  },
  widgetTape: {
    width: 48,
    height: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.75)',
    transform: [{ rotate: '-2deg' }],
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  widgetPin: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#EF4444',
    marginTop: 4,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  widgetPinHead: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#FFFFFF',
    marginTop: 2,
    marginLeft: 2,
  },
  preview1x1Content: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 10,
  },
  preview2x2Content: {
    flex: 1,
    paddingTop: 8,
  },
  preview4x2Content: {
    flex: 1,
    paddingTop: 6,
  },
  preview4x4Content: {
    flex: 1,
    paddingTop: 8,
  },
  previewHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  previewTitle: {
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 4,
  },
  previewTitleLarge: {
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 6,
  },
  previewBody: {
    fontSize: 11,
    lineHeight: 15,
    opacity: 0.85,
  },
  mockCheckRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginVertical: 2,
  },
  mockCheckText: {
    fontSize: 11,
    flex: 1,
  },
  mockCheckCompleted: {
    textDecorationLine: 'line-through',
    opacity: 0.5,
  },
  mockImgBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  mockImgBadgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '600',
  },
  mockupGuideText: {
    color: '#94A3B8',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 10,
  },
  addWidgetBtn: {
    backgroundColor: '#2563EB',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
    marginTop: 8,
    marginBottom: 20,
    shadowColor: '#2563EB',
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  addWidgetBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  manageContainer: {
    paddingVertical: 10,
  },
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#334155',
    marginTop: 12,
  },
  emptyDesc: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 16,
    maxWidth: 280,
  },
  switchTabBtn: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  switchTabBtnText: {
    color: '#2563EB',
    fontSize: 13,
    fontWeight: '700',
  },
  widgetItemCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12,
  },
  widgetItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  widgetBadge: {
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  widgetBadgeText: {
    color: '#1D4ED8',
    fontSize: 11,
    fontWeight: '700',
  },
  widgetItemTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
    flex: 1,
    marginLeft: 10,
  },
  deleteWidgetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    padding: 6,
  },
  deleteWidgetText: {
    fontSize: 12,
    color: '#EF4444',
    fontWeight: '600',
  },
  widgetChecklistWrap: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  checklistTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 6,
  },
  widgetInteractiveCheckRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  widgetInteractiveText: {
    fontSize: 13,
    color: '#334155',
    flex: 1,
  },
  manageOpacityRow: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  manageOpacityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 6,
  },
  manageOpacityLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  manageOpacityValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2563EB',
  },
  manageOpacityChips: {
    flexDirection: 'row',
    gap: 6,
  },
  manageOpBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  manageOpBtnActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#3B82F6',
  },
  manageOpText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  manageOpTextActive: {
    color: '#2563EB',
    fontWeight: '700',
  },
});
