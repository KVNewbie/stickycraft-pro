import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Image,
  Platform,
} from 'react-native';
import {
  Command,
  Search,
  X,
  Droplets,
  FileText,
  ChartBar,
  GitCompare,
  MessageSquare,
  Check,
  CheckCircle2,
  Circle,
  Send,
  Trash2,
  Upload,
  Sparkles,
  ArrowRight,
  RotateCcw,
} from 'lucide-react-native';
import {
  Note,
  PdfCommentThread,
  PdfDocumentMeta,
  PdfHeaderFooterConfig,
  PdfPageData,
  PdfWatermarkConfig,
} from '../types/note';
import {
  DocumentWordStats,
  PdfPageDiffResult,
  diffPdfDocuments,
  renderRealPdfFile,
} from '../utils/pdfEngine';
import { extractPdfPagesFromNote } from './PdfAcrobatStudioPanel';

/* ============================================================================
 * 1. Ctrl+K 명령 팔레트 모달 (PdfCommandPaletteModal)
 * ============================================================================ */
export interface PdfCommandItem {
  id: string;
  label: string;
  description: string;
  category: '보기' | '편집' | '문서 구성' | '검토' | '내보내기';
  shortcut?: string;
  keywords?: string;
  onExecute: () => void;
}

interface PdfCommandPaletteModalProps {
  visible: boolean;
  commands: PdfCommandItem[];
  onClose: () => void;
}

export const PdfCommandPaletteModal: React.FC<PdfCommandPaletteModalProps> = React.memo(
  ({ visible, commands, onClose }) => {
    const [query, setQuery] = useState('');
    const [selectedIdx, setSelectedIdx] = useState(0);

    useEffect(() => {
      if (visible) {
        setQuery('');
        setSelectedIdx(0);
      }
    }, [visible]);

    const filtered = useMemo(() => {
      const q = query.trim().toLowerCase();
      if (!q) return commands;
      return commands.filter((c) => {
        const hay = `${c.label} ${c.description} ${c.category} ${c.keywords || ''}`.toLowerCase();
        return hay.includes(q);
      });
    }, [commands, query]);

    useEffect(() => {
      setSelectedIdx(0);
    }, [query]);

    useEffect(() => {
      if (!visible || Platform.OS !== 'web' || typeof window === 'undefined') return;
      const onKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setSelectedIdx((prev) => (filtered.length > 0 ? (prev + 1) % filtered.length : 0));
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          setSelectedIdx((prev) =>
            filtered.length > 0 ? (prev - 1 + filtered.length) % filtered.length : 0
          );
        } else if (e.key === 'Enter') {
          if (filtered[selectedIdx]) {
            e.preventDefault();
            const cmd = filtered[selectedIdx];
            onClose();
            cmd.onExecute();
          }
        } else if (e.key === 'Escape') {
          e.preventDefault();
          onClose();
        }
      };
      window.addEventListener('keydown', onKeyDown);
      return () => window.removeEventListener('keydown', onKeyDown);
    }, [visible, filtered, selectedIdx, onClose]);

    const categoryColors: Record<PdfCommandItem['category'], { bg: string; fg: string }> = {
      보기: { bg: '#EFF6FF', fg: '#1D4ED8' },
      편집: { bg: '#FEF3C7', fg: '#B45309' },
      '문서 구성': { bg: '#ECFDF5', fg: '#047857' },
      검토: { bg: '#F3E8FF', fg: '#6D28D9' },
      내보내기: { bg: '#FEE2E2', fg: '#B91C1C' },
    };

    return (
      <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose}>
          <View
            style={styles.paletteCard}
            onStartShouldSetResponder={() => true}
            {...(Platform.OS === 'web'
              ? ({ onClick: (e: any) => e.stopPropagation() } as any)
              : {})}
          >
            <View style={styles.paletteSearchRow}>
              <Command size={17} color="#2563EB" />
              <TextInput
                style={styles.paletteInput}
                placeholder="명령어 검색... (예: 워터마크, 양면, PDF 저장, 비교, 먹칠, 스탬프, 댓글)"
                placeholderTextColor="#94A3B8"
                value={query}
                onChangeText={setQuery}
                autoFocus
              />
              <View style={styles.escBadge}>
                <Text style={styles.escBadgeText}>ESC</Text>
              </View>
            </View>

            <ScrollView style={styles.paletteList} keyboardShouldPersistTaps="handled">
              {filtered.length === 0 ? (
                <View style={styles.emptyBox}>
                  <Search size={24} color="#CBD5E1" />
                  <Text style={styles.emptyTitle}>일치하는 명령어가 없습니다</Text>
                  <Text style={styles.emptyDesc}>다른 키워드로 검색해 보세요.</Text>
                </View>
              ) : (
                filtered.map((cmd, idx) => {
                  const active = idx === selectedIdx;
                  const cat = categoryColors[cmd.category];
                  return (
                    <TouchableOpacity
                      key={cmd.id}
                      style={[styles.paletteItem, active && styles.paletteItemActive]}
                      onPress={() => {
                        onClose();
                        cmd.onExecute();
                      }}
                    >
                      <View style={[styles.catBadge, { backgroundColor: cat.bg }]}>
                        <Text style={[styles.catBadgeText, { color: cat.fg }]}>{cmd.category}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.paletteItemLabel, active && { color: '#1D4ED8' }]}>
                          {cmd.label}
                        </Text>
                        <Text style={styles.paletteItemDesc} numberOfLines={1}>
                          {cmd.description}
                        </Text>
                      </View>
                      {cmd.shortcut ? (
                        <View style={styles.shortcutPill}>
                          <Text style={styles.shortcutText}>{cmd.shortcut}</Text>
                        </View>
                      ) : (
                        <ArrowRight size={14} color={active ? '#2563EB' : '#CBD5E1'} />
                      )}
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>

            <View style={styles.paletteFooter}>
              <Text style={styles.paletteFooterHint}>↑↓ 이동 · Enter 실행 · Ctrl+K 열기/닫기</Text>
              <Text style={styles.paletteFooterCount}>{filtered.length}개 명령</Text>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    );
  }
);

/* ============================================================================
 * 2. 워터마크 & 머리글·바닥글·페이지 번호 설정 모달 (PdfWatermarkHeaderModal)
 * ============================================================================ */
interface PdfWatermarkHeaderModalProps {
  visible: boolean;
  watermark: PdfWatermarkConfig;
  headerFooter: PdfHeaderFooterConfig;
  onChangeWatermark: (next: PdfWatermarkConfig) => void;
  onChangeHeaderFooter: (next: PdfHeaderFooterConfig) => void;
  onClose: () => void;
}

const WATERMARK_PRESETS = ['기밀 CONFIDENTIAL', '초안 DRAFT', '대외비', '사본 COPY', '검토용'];
const WATERMARK_COLORS = ['#DC2626', '#2563EB', '#475569', '#059669', '#7C3AED', '#D97706'];
const OPACITY_PRESETS = [
  { label: '은은하게 (8%)', value: 0.08 },
  { label: '표준 (14%)', value: 0.14 },
  { label: '선명하게 (24%)', value: 0.24 },
  { label: '강하게 (36%)', value: 0.36 },
];

export const PdfWatermarkHeaderModal: React.FC<PdfWatermarkHeaderModalProps> = React.memo(
  ({ visible, watermark, headerFooter, onChangeWatermark, onChangeHeaderFooter, onClose }) => {
    return (
      <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose}>
          <View
            style={styles.modalCard}
            onStartShouldSetResponder={() => true}
            {...(Platform.OS === 'web'
              ? ({ onClick: (e: any) => e.stopPropagation() } as any)
              : {})}
          >
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleRow}>
                <Droplets size={18} color="#2563EB" />
                <Text style={styles.modalTitle}>워터마크 · 머리글 · 바닥글 · 페이지 번호</Text>
              </View>
              <TouchableOpacity onPress={onClose} style={styles.iconCloseBtn}>
                <X size={18} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 540 }} contentContainerStyle={{ gap: 16 }}>
              {/* 섹션 A: 대각선 워터마크 */}
              <View style={styles.sectionBox}>
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.sectionTitle}>💧 대각선 워터마크 (Watermark)</Text>
                  <TouchableOpacity
                    style={[styles.togglePill, watermark.enabled && styles.togglePillOn]}
                    onPress={() =>
                      onChangeWatermark({
                        ...watermark,
                        enabled: !watermark.enabled,
                        text: watermark.text || '기밀 CONFIDENTIAL',
                      })
                    }
                  >
                    <Text
                      style={[styles.togglePillText, watermark.enabled && styles.togglePillTextOn]}
                    >
                      {watermark.enabled ? '적용 중 ON' : '꺼짐 OFF'}
                    </Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.fieldLabel}>워터마크 문구</Text>
                <TextInput
                  style={styles.textInput}
                  value={watermark.text}
                  onChangeText={(text) =>
                    onChangeWatermark({
                      ...watermark,
                      text,
                      enabled: text.trim().length > 0 ? true : watermark.enabled,
                    })
                  }
                  placeholder="예: 기밀 CONFIDENTIAL, 대외비, 초안..."
                  placeholderTextColor="#94A3B8"
                />

                <View style={styles.chipRow}>
                  {WATERMARK_PRESETS.map((preset) => (
                    <TouchableOpacity
                      key={preset}
                      style={[
                        styles.presetChip,
                        watermark.text === preset && styles.presetChipActive,
                      ]}
                      onPress={() =>
                        onChangeWatermark({ ...watermark, text: preset, enabled: true })
                      }
                    >
                      <Text
                        style={[
                          styles.presetChipText,
                          watermark.text === preset && styles.presetChipTextActive,
                        ]}
                      >
                        {preset}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.fieldLabel}>투명도</Text>
                <View style={styles.chipRow}>
                  {OPACITY_PRESETS.map((op) => {
                    const active = Math.abs((watermark.opacity || 0.14) - op.value) < 0.03;
                    return (
                      <TouchableOpacity
                        key={op.label}
                        style={[styles.presetChip, active && styles.presetChipActive]}
                        onPress={() => onChangeWatermark({ ...watermark, opacity: op.value })}
                      >
                        <Text
                          style={[styles.presetChipText, active && styles.presetChipTextActive]}
                        >
                          {op.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Text style={styles.fieldLabel}>색상</Text>
                <View style={styles.colorRow}>
                  {WATERMARK_COLORS.map((c) => {
                    const sel = (watermark.color || '#DC2626') === c;
                    return (
                      <TouchableOpacity
                        key={c}
                        style={[
                          styles.colorSwatch,
                          { backgroundColor: c },
                          sel && styles.colorSwatchActive,
                        ]}
                        onPress={() => onChangeWatermark({ ...watermark, color: c })}
                      >
                        {sel && <Check size={13} color="#FFFFFF" strokeWidth={3} />}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* 섹션 B: 머리글 / 바닥글 / 페이지 번호 */}
              <View style={styles.sectionBox}>
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.sectionTitle}>📑 머리글 · 바닥글 · 페이지 번호</Text>
                  <TouchableOpacity
                    style={[styles.togglePill, headerFooter.enabled && styles.togglePillOn]}
                    onPress={() =>
                      onChangeHeaderFooter({ ...headerFooter, enabled: !headerFooter.enabled })
                    }
                  >
                    <Text
                      style={[
                        styles.togglePillText,
                        headerFooter.enabled && styles.togglePillTextOn,
                      ]}
                    >
                      {headerFooter.enabled ? '적용 중 ON' : '꺼짐 OFF'}
                    </Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.fieldLabel}>머리글 (Header — 좌측 상단 표시)</Text>
                <TextInput
                  style={styles.textInput}
                  value={headerFooter.headerText}
                  onChangeText={(headerText) =>
                    onChangeHeaderFooter({ ...headerFooter, headerText, enabled: true })
                  }
                  placeholder="예: 2026 프로젝트 보고서 · 내부 검토용"
                  placeholderTextColor="#94A3B8"
                />

                <Text style={styles.fieldLabel}>바닥글 (Footer — 좌측 하단 표시)</Text>
                <TextInput
                  style={styles.textInput}
                  value={headerFooter.footerText}
                  onChangeText={(footerText) =>
                    onChangeHeaderFooter({ ...headerFooter, footerText, enabled: true })
                  }
                  placeholder="예: © StickyCraft Pro · 무단 배포 금지"
                  placeholderTextColor="#94A3B8"
                />

                <TouchableOpacity
                  style={styles.checkToggleRow}
                  onPress={() =>
                    onChangeHeaderFooter({
                      ...headerFooter,
                      enabled: true,
                      showPageNumbers: !headerFooter.showPageNumbers,
                    })
                  }
                >
                  {headerFooter.showPageNumbers ? (
                    <CheckCircle2 size={18} color="#2563EB" />
                  ) : (
                    <Circle size={18} color="#94A3B8" />
                  )}
                  <Text style={styles.checkToggleText}>
                    우측 하단에 자동 페이지 번호 (1 / N) 표시
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>

            <View style={styles.modalFooterRow}>
              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={() => {
                  onChangeWatermark({ enabled: false, text: '', opacity: 0.14, color: '#DC2626' });
                  onChangeHeaderFooter({
                    enabled: false,
                    headerText: '',
                    footerText: '',
                    showPageNumbers: false,
                  });
                }}
              >
                <RotateCcw size={14} color="#475569" />
                <Text style={styles.secondaryBtnText}>모두 초기화</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.primaryBtn} onPress={onClose}>
                <Check size={15} color="#FFFFFF" />
                <Text style={styles.primaryBtnText}>적용 완료 (화면 & PDF 저장 반영)</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    );
  }
);

/* ============================================================================
 * 3. 문서 속성 & 단어/주석 통계 모달 (PdfPropertiesStatsModal)
 * ============================================================================ */
interface PdfPropertiesStatsModalProps {
  visible: boolean;
  title: string;
  currentPage: number;
  meta: PdfDocumentMeta;
  stats: DocumentWordStats;
  onChangeTitle: (nextTitle: string) => void;
  onChangeMeta: (nextMeta: PdfDocumentMeta) => void;
  onClose: () => void;
}

export const PdfPropertiesStatsModal: React.FC<PdfPropertiesStatsModalProps> = React.memo(
  ({ visible, title, currentPage, meta, stats, onChangeTitle, onChangeMeta, onClose }) => {
    const statCards = [
      { label: '전체 페이지', value: `${stats.totalPages}쪽`, color: '#2563EB', bg: '#EFF6FF' },
      { label: '문서 총 단어 수', value: `${stats.totalWords.toLocaleString()}단어`, color: '#059669', bg: '#ECFDF5' },
      { label: '문서 총 글자 수', value: `${stats.totalChars.toLocaleString()}자`, color: '#0D9488', bg: '#F0FDFA' },
      { label: `P.${currentPage} 단어/글자`, value: `${stats.currentPageWords} / ${stats.currentPageChars}`, color: '#7C3AED', bg: '#F3E8FF' },
      { label: '필기 / 도형', value: `${stats.strokeCount}획`, color: '#EA580C', bg: '#FFF7ED' },
      { label: '스탬프 / 먹칠', value: `${stats.stampCount} / ${stats.redactionCount}`, color: '#DC2626', bg: '#FEF2F2' },
      { label: '텍스트 상자', value: `${stats.textBoxCount}개`, color: '#0284C7', bg: '#F0F9FF' },
      {
        label: '검토 댓글',
        value: `미해결 ${stats.openCommentCount} / 총 ${stats.commentCount}`,
        color: '#B45309',
        bg: '#FEF3C7',
      },
    ];

    return (
      <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose}>
          <View
            style={styles.modalCard}
            onStartShouldSetResponder={() => true}
            {...(Platform.OS === 'web'
              ? ({ onClick: (e: any) => e.stopPropagation() } as any)
              : {})}
          >
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleRow}>
                <ChartBar size={18} color="#2563EB" />
                <Text style={styles.modalTitle}>문서 속성 · 단어 수 및 주석 통계</Text>
              </View>
              <TouchableOpacity onPress={onClose} style={styles.iconCloseBtn}>
                <X size={18} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 540 }} contentContainerStyle={{ gap: 16 }}>
              {/* 통계 그리드 */}
              <View style={styles.statsGrid}>
                {statCards.map((s) => (
                  <View key={s.label} style={[styles.statCard, { backgroundColor: s.bg }]}>
                    <Text style={styles.statCardLabel}>{s.label}</Text>
                    <Text style={[styles.statCardValue, { color: s.color }]}>{s.value}</Text>
                  </View>
                ))}
              </View>

              {/* 메타데이터 편집 */}
              <View style={styles.sectionBox}>
                <Text style={styles.sectionTitle}>📋 PDF 메타데이터 (실제 .pdf 내보내기 시 포함)</Text>

                <Text style={styles.fieldLabel}>문서 제목 (Title)</Text>
                <TextInput
                  style={styles.textInput}
                  value={title}
                  onChangeText={onChangeTitle}
                  placeholder="문서 제목"
                  placeholderTextColor="#94A3B8"
                />

                <Text style={styles.fieldLabel}>작성자 (Author)</Text>
                <TextInput
                  style={styles.textInput}
                  value={meta.author || ''}
                  onChangeText={(author) => onChangeMeta({ ...meta, author })}
                  placeholder="예: 홍길동 / 기획팀"
                  placeholderTextColor="#94A3B8"
                />

                <Text style={styles.fieldLabel}>주제 (Subject)</Text>
                <TextInput
                  style={styles.textInput}
                  value={meta.subject || ''}
                  onChangeText={(subject) => onChangeMeta({ ...meta, subject })}
                  placeholder="예: 2026년 4분기 분기 보고서"
                  placeholderTextColor="#94A3B8"
                />

                <Text style={styles.fieldLabel}>키워드 (Keywords — 쉼표로 구분)</Text>
                <TextInput
                  style={styles.textInput}
                  value={meta.keywords || ''}
                  onChangeText={(keywords) => onChangeMeta({ ...meta, keywords })}
                  placeholder="예: 기획, 회의록, 검토, 최종안"
                  placeholderTextColor="#94A3B8"
                />
              </View>
            </ScrollView>

            <View style={styles.modalFooterRow}>
              <View />
              <TouchableOpacity style={styles.primaryBtn} onPress={onClose}>
                <Check size={15} color="#FFFFFF" />
                <Text style={styles.primaryBtnText}>확인</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    );
  }
);

/* ============================================================================
 * 4. 두 PDF 문서 나란히 비교 모달 (PdfCompareModal)
 * ============================================================================ */
interface PdfCompareModalProps {
  visible: boolean;
  currentTitle: string;
  currentPages: PdfPageData[];
  allNotes: Note[];
  currentNoteId?: string;
  onClose: () => void;
}

export const PdfCompareModal: React.FC<PdfCompareModalProps> = React.memo(
  ({ visible, currentTitle, currentPages, allNotes, currentNoteId, onClose }) => {
    const [targetTitle, setTargetTitle] = useState<string>('');
    const [targetPages, setTargetPages] = useState<PdfPageData[] | null>(null);
    const [onlyDiffs, setOnlyDiffs] = useState<boolean>(false);
    const [isUploading, setIsUploading] = useState<boolean>(false);

    const candidateNotes = useMemo(
      () => allNotes.filter((n) => !n.isDeleted && n.id !== currentNoteId),
      [allNotes, currentNoteId]
    );

    const diffResults: PdfPageDiffResult[] = useMemo(() => {
      if (!targetPages) return [];
      return diffPdfDocuments(currentPages, targetPages);
    }, [currentPages, targetPages]);

    const visibleDiffs = useMemo(
      () => (onlyDiffs ? diffResults.filter((d) => d.status !== 'same') : diffResults),
      [diffResults, onlyDiffs]
    );

    const summary = useMemo(() => {
      let same = 0;
      let modified = 0;
      let extra = 0;
      for (const d of diffResults) {
        if (d.status === 'same') same++;
        else if (d.status === 'modified') modified++;
        else extra++;
      }
      return { same, modified, extra };
    }, [diffResults]);

    const handleUploadComparePdf = () => {
      if (Platform.OS !== 'web' || typeof document === 'undefined') return;
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'application/pdf,.pdf';
      input.onchange = async (e: any) => {
        const file: File | undefined = e.target?.files?.[0];
        if (!file) return;
        setIsUploading(true);
        try {
          const rendered = await renderRealPdfFile(file);
          setTargetTitle(file.name);
          setTargetPages(rendered.pages);
        } finally {
          setIsUploading(false);
        }
      };
      input.click();
    };

    const statusBadge = (status: PdfPageDiffResult['status']) => {
      switch (status) {
        case 'same':
          return { label: '동일', bg: '#ECFDF5', fg: '#047857' };
        case 'modified':
          return { label: '변경됨', bg: '#FEF3C7', fg: '#B45309' };
        case 'only-a':
          return { label: '현재 문서에만 있음', bg: '#FEE2E2', fg: '#B91C1C' };
        case 'only-b':
          return { label: '비교 문서에만 있음', bg: '#DBEAFE', fg: '#1D4ED8' };
      }
    };

    return (
      <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose}>
          <View
            style={[styles.modalCard, { maxWidth: 880 }]}
            onStartShouldSetResponder={() => true}
            {...(Platform.OS === 'web'
              ? ({ onClick: (e: any) => e.stopPropagation() } as any)
              : {})}
          >
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleRow}>
                <GitCompare size={18} color="#7C3AED" />
                <Text style={styles.modalTitle}>두 PDF 문서 비교 (Compare Diff)</Text>
              </View>
              <TouchableOpacity onPress={onClose} style={styles.iconCloseBtn}>
                <X size={18} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* 비교 대상 선택 바 */}
            <View style={styles.comparePickerBar}>
              <View style={styles.compareDocPill}>
                <Text style={styles.compareDocTag}>기준 (A)</Text>
                <Text style={styles.compareDocName} numberOfLines={1}>
                  {currentTitle} ({currentPages.length}쪽)
                </Text>
              </View>

              <Text style={styles.compareVsText}>VS</Text>

              <View style={[styles.compareDocPill, { borderColor: '#C4B5FD', backgroundColor: '#FAF5FF' }]}>
                <Text style={[styles.compareDocTag, { backgroundColor: '#7C3AED' }]}>비교 (B)</Text>
                <Text style={styles.compareDocName} numberOfLines={1}>
                  {targetPages ? `${targetTitle} (${targetPages.length}쪽)` : '아래에서 문서를 선택하세요'}
                </Text>
              </View>

              <TouchableOpacity
                style={styles.compareUploadBtn}
                onPress={handleUploadComparePdf}
                disabled={isUploading}
              >
                <Upload size={13} color="#FFFFFF" />
                <Text style={styles.compareUploadBtnText}>
                  {isUploading ? 'PDF 분석 중...' : '로컬 .pdf 열기'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* 앱 보관함에서 비교 대상 빠른 선택 */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxHeight: 42 }}>
              <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                <Text style={{ fontSize: 11.5, fontWeight: '700', color: '#64748B' }}>보관함 비교:</Text>
                {candidateNotes.map((n) => {
                  const isPicked = targetTitle === (n.title || n.pdfName);
                  return (
                    <TouchableOpacity
                      key={n.id}
                      style={[styles.presetChip, isPicked && styles.presetChipActive]}
                      onPress={() => {
                        setTargetTitle(n.title || n.pdfName || '문서');
                        setTargetPages(extractPdfPagesFromNote(n));
                      }}
                    >
                      <FileText size={11} color={isPicked ? '#2563EB' : '#64748B'} />
                      <Text
                        style={[styles.presetChipText, isPicked && styles.presetChipTextActive]}
                        numberOfLines={1}
                      >
                        {n.title || n.pdfName || '제목 없음'}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>

            {/* 비교 결과 요약 및 리스트 */}
            {targetPages ? (
              <>
                <View style={styles.compareSummaryRow}>
                  <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                    <View style={[styles.summaryBadge, { backgroundColor: '#ECFDF5' }]}>
                      <Text style={[styles.summaryBadgeText, { color: '#047857' }]}>
                        동일 {summary.same}쪽
                      </Text>
                    </View>
                    <View style={[styles.summaryBadge, { backgroundColor: '#FEF3C7' }]}>
                      <Text style={[styles.summaryBadgeText, { color: '#B45309' }]}>
                        내용 변경 {summary.modified}쪽
                      </Text>
                    </View>
                    <View style={[styles.summaryBadge, { backgroundColor: '#FEE2E2' }]}>
                      <Text style={[styles.summaryBadgeText, { color: '#B91C1C' }]}>
                        페이지 수 차이 {summary.extra}쪽
                      </Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    style={[styles.presetChip, onlyDiffs && styles.presetChipActive]}
                    onPress={() => setOnlyDiffs((p) => !p)}
                  >
                    <Text style={[styles.presetChipText, onlyDiffs && styles.presetChipTextActive]}>
                      {onlyDiffs ? '✓ 차이 있는 페이지만 보기' : '차이 있는 페이지만 보기'}
                    </Text>
                  </TouchableOpacity>
                </View>

                <ScrollView style={{ maxHeight: 410 }} contentContainerStyle={{ gap: 12 }}>
                  {visibleDiffs.length === 0 ? (
                    <View style={styles.emptyBox}>
                      <Sparkles size={24} color="#10B981" />
                      <Text style={styles.emptyTitle}>두 문서의 모든 페이지 내용이 동일합니다!</Text>
                    </View>
                  ) : (
                    visibleDiffs.map((d) => {
                      const badge = statusBadge(d.status);
                      return (
                        <View key={d.pageNumber} style={styles.diffPageCard}>
                          <View style={styles.diffPageHeader}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                              <Text style={styles.diffPageNum}>Page {d.pageNumber}</Text>
                              <View style={[styles.catBadge, { backgroundColor: badge.bg }]}>
                                <Text style={[styles.catBadgeText, { color: badge.fg }]}>
                                  {badge.label}
                                </Text>
                              </View>
                            </View>
                            <Text style={styles.diffCountsText}>
                              +{d.addedCount}줄 추가 · -{d.removedCount}줄 삭제
                            </Text>
                          </View>

                          {(d.imageA || d.imageB) && (
                            <View style={styles.diffThumbsRow}>
                              <View style={styles.diffThumbBox}>
                                <Text style={styles.diffThumbLabel}>A: {d.titleA}</Text>
                                {d.imageA ? (
                                  <Image
                                    source={{ uri: d.imageA }}
                                    style={styles.diffThumbImg}
                                    resizeMode="contain"
                                  />
                                ) : (
                                  <Text style={styles.diffNoImgText}>텍스트 페이지</Text>
                                )}
                              </View>
                              <View style={styles.diffThumbBox}>
                                <Text style={styles.diffThumbLabel}>B: {d.titleB}</Text>
                                {d.imageB ? (
                                  <Image
                                    source={{ uri: d.imageB }}
                                    style={styles.diffThumbImg}
                                    resizeMode="contain"
                                  />
                                ) : (
                                  <Text style={styles.diffNoImgText}>텍스트 페이지</Text>
                                )}
                              </View>
                            </View>
                          )}

                          <View style={styles.diffLinesBox}>
                            {d.lines.slice(0, 18).map((line, lIdx) => (
                              <View
                                key={lIdx}
                                style={[
                                  styles.diffLineRow,
                                  line.type === 'added' && styles.diffLineAdded,
                                  line.type === 'removed' && styles.diffLineRemoved,
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.diffLinePrefix,
                                    line.type === 'added' && { color: '#15803D' },
                                    line.type === 'removed' && { color: '#B91C1C' },
                                  ]}
                                >
                                  {line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}
                                </Text>
                                <Text
                                  style={[
                                    styles.diffLineText,
                                    line.type === 'added' && { color: '#14532D', fontWeight: '600' },
                                    line.type === 'removed' && { color: '#7F1D1D' },
                                  ]}
                                  numberOfLines={2}
                                >
                                  {line.text}
                                </Text>
                              </View>
                            ))}
                            {d.lines.length > 18 && (
                              <Text style={styles.diffMoreText}>
                                ... 외 {d.lines.length - 18}줄 생략
                              </Text>
                            )}
                          </View>
                        </View>
                      );
                    })
                  )}
                </ScrollView>
              </>
            ) : (
              <View style={styles.emptyBox}>
                <GitCompare size={28} color="#94A3B8" />
                <Text style={styles.emptyTitle}>비교할 PDF 문서를 선택하세요</Text>
                <Text style={styles.emptyDesc}>
                  위 보관함 목록에서 기존 문서를 클릭하거나 [로컬 .pdf 열기]로 수정 전/후 문서를 비교할 수 있습니다.
                </Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
      </Modal>
    );
  }
);

/* ============================================================================
 * 5. 우측 스레드 댓글 검토 드로어 (PdfCommentsDrawer)
 * ============================================================================ */
interface PdfCommentsDrawerProps {
  comments: PdfCommentThread[];
  activeThreadId: string | null;
  currentPage: number;
  onSelectThread: (thread: PdfCommentThread) => void;
  onReplyThread: (threadId: string, text: string) => void;
  onToggleResolved: (threadId: string) => void;
  onDeleteThread: (threadId: string) => void;
  onStartPlaceComment: () => void;
  onClose: () => void;
}

export const PdfCommentsDrawer: React.FC<PdfCommentsDrawerProps> = React.memo(
  ({
    comments,
    activeThreadId,
    currentPage,
    onSelectThread,
    onReplyThread,
    onToggleResolved,
    onDeleteThread,
    onStartPlaceComment,
    onClose,
  }) => {
    const [filter, setFilter] = useState<'all' | 'open' | 'resolved'>('all');
    const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});

    const filtered = useMemo(() => {
      return comments.filter((c) => {
        if (filter === 'open') return !c.resolved;
        if (filter === 'resolved') return c.resolved;
        return true;
      });
    }, [comments, filter]);

    const openCount = useMemo(() => comments.filter((c) => !c.resolved).length, [comments]);

    const handleSendReply = (threadId: string) => {
      const txt = (replyDrafts[threadId] || '').trim();
      if (!txt) return;
      onReplyThread(threadId, txt);
      setReplyDrafts((prev) => ({ ...prev, [threadId]: '' }));
    };

    return (
      <View style={styles.commentsDrawer}>
        <View style={styles.drawerHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
            <MessageSquare size={16} color="#2563EB" />
            <Text style={styles.drawerTitle}>스레드 댓글 ({comments.length})</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.iconCloseBtn}>
            <X size={16} color="#64748B" />
          </TouchableOpacity>
        </View>

        <View style={styles.drawerFilterBar}>
          {(
            [
              { id: 'all', label: `전체 (${comments.length})` },
              { id: 'open', label: `미해결 (${openCount})` },
              { id: 'resolved', label: `해결됨 (${comments.length - openCount})` },
            ] as const
          ).map((tab) => (
            <TouchableOpacity
              key={tab.id}
              style={[styles.drawerFilterChip, filter === tab.id && styles.drawerFilterChipActive]}
              onPress={() => setFilter(tab.id)}
            >
              <Text
                style={[
                  styles.drawerFilterText,
                  filter === tab.id && styles.drawerFilterTextActive,
                ]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={styles.addCommentBannerBtn} onPress={onStartPlaceComment}>
          <MessageSquare size={13} color="#FFFFFF" />
          <Text style={styles.addCommentBannerText}>
            + P.{currentPage} 페이지 원하는 위치에 댓글 핀 추가
          </Text>
        </TouchableOpacity>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 12, gap: 10 }}>
          {filtered.length === 0 ? (
            <View style={styles.emptyBox}>
              <MessageSquare size={24} color="#CBD5E1" />
              <Text style={styles.emptyTitle}>등록된 댓글이 없습니다</Text>
              <Text style={styles.emptyDesc}>
                상단 버튼이나 하단 💬 댓글 도구를 선택하고 문서 위를 클릭하면 스레드 댓글 핀이 생성됩니다.
              </Text>
            </View>
          ) : (
            filtered.map((thread, idx) => {
              const isSelected = thread.id === activeThreadId;
              const draft = replyDrafts[thread.id] || '';
              return (
                <View
                  key={thread.id}
                  style={[
                    styles.threadCard,
                    isSelected && styles.threadCardSelected,
                    thread.resolved && styles.threadCardResolved,
                  ]}
                >
                  <TouchableOpacity
                    style={styles.threadHeader}
                    onPress={() => onSelectThread(thread)}
                  >
                    <View style={styles.threadBadgeRow}>
                      <View
                        style={[
                          styles.threadNumBadge,
                          thread.resolved && { backgroundColor: '#10B981' },
                        ]}
                      >
                        <Text style={styles.threadNumText}>#{idx + 1}</Text>
                      </View>
                      <Text style={styles.threadPageLink}>P.{thread.pageIndex} 이동 →</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <TouchableOpacity
                        style={[
                          styles.resolveChip,
                          thread.resolved && styles.resolveChipDone,
                        ]}
                        onPress={() => onToggleResolved(thread.id)}
                      >
                        <Check size={11} color={thread.resolved ? '#FFFFFF' : '#059669'} />
                        <Text
                          style={[
                            styles.resolveChipText,
                            thread.resolved && { color: '#FFFFFF' },
                          ]}
                        >
                          {thread.resolved ? '해결됨' : '해결'}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.threadDeleteBtn}
                        onPress={() => onDeleteThread(thread.id)}
                      >
                        <Trash2 size={12} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>

                  <View style={styles.threadMessages}>
                    {thread.messages.map((msg) => (
                      <View key={msg.id} style={styles.msgBubble}>
                        <View style={styles.msgMetaRow}>
                          <Text style={styles.msgAuthor}>{msg.author}</Text>
                          <Text style={styles.msgTime}>
                            {new Date(msg.createdAt).toLocaleTimeString('ko-KR', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </Text>
                        </View>
                        <Text style={styles.msgText}>{msg.text}</Text>
                      </View>
                    ))}
                  </View>

                  <View style={styles.replyRow}>
                    <TextInput
                      style={styles.replyInput}
                      value={draft}
                      onChangeText={(v) =>
                        setReplyDrafts((prev) => ({ ...prev, [thread.id]: v }))
                      }
                      placeholder="답글 입력 후 Enter..."
                      placeholderTextColor="#94A3B8"
                      onSubmitEditing={() => handleSendReply(thread.id)}
                    />
                    <TouchableOpacity
                      style={[styles.replySendBtn, !draft.trim() && { opacity: 0.4 }]}
                      disabled={!draft.trim()}
                      onPress={() => handleSendReply(thread.id)}
                    >
                      <Send size={13} color="#FFFFFF" />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      </View>
    );
  }
);

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.48)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
  },
  paletteCard: {
    width: '100%',
    maxWidth: 620,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    ...Platform.select({
      web: { boxShadow: '0 22px 60px rgba(15, 23, 42, 0.35)' },
    }),
  },
  paletteSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  paletteInput: {
    flex: 1,
    fontSize: 14.5,
    color: '#0F172A',
    fontWeight: '600',
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}),
  },
  escBadge: {
    backgroundColor: '#F1F5F9',
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  escBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
  },
  paletteList: {
    maxHeight: 390,
  },
  paletteItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  paletteItemActive: {
    backgroundColor: '#EFF6FF',
  },
  catBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  catBadgeText: {
    fontSize: 10.5,
    fontWeight: '800',
  },
  paletteItemLabel: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#0F172A',
  },
  paletteItemDesc: {
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 1,
  },
  shortcutPill: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  shortcutText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#475569',
  },
  paletteFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#F8FAFC',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  paletteFooterHint: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  paletteFooterCount: {
    fontSize: 11,
    fontWeight: '800',
    color: '#2563EB',
  },
  modalCard: {
    width: '100%',
    maxWidth: 620,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    gap: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...Platform.select({
      web: { boxShadow: '0 20px 55px rgba(15, 23, 42, 0.30)' },
    }),
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 10,
  },
  modalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  iconCloseBtn: {
    padding: 5,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
  },
  sectionBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#1E293B',
  },
  togglePill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
    backgroundColor: '#E2E8F0',
  },
  togglePillOn: {
    backgroundColor: '#2563EB',
  },
  togglePillText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#475569',
  },
  togglePillTextOn: {
    color: '#FFFFFF',
  },
  fieldLabel: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#475569',
    marginTop: 2,
  },
  textInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 11,
    paddingVertical: 8,
    fontSize: 13,
    color: '#0F172A',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  presetChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  presetChipActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#2563EB',
  },
  presetChipText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#475569',
    maxWidth: 180,
  },
  presetChipTextActive: {
    color: '#1D4ED8',
    fontWeight: '800',
  },
  colorRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  colorSwatch: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorSwatchActive: {
    borderColor: '#0F172A',
  },
  checkToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 4,
  },
  checkToggleText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#1E293B',
  },
  modalFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 9,
    backgroundColor: '#F1F5F9',
  },
  secondaryBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#475569',
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 9,
    backgroundColor: '#2563EB',
  },
  primaryBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statCard: {
    width: '23.5%',
    minWidth: 125,
    flexGrow: 1,
    borderRadius: 10,
    padding: 10,
    gap: 4,
  },
  statCardLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  statCardValue: {
    fontSize: 15,
    fontWeight: '900',
  },
  comparePickerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  compareDocPill: {
    flex: 1,
    minWidth: 190,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 9,
    paddingHorizontal: 9,
    paddingVertical: 7,
  },
  compareDocTag: {
    backgroundColor: '#2563EB',
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
    overflow: 'hidden',
  },
  compareDocName: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  compareVsText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#7C3AED',
  },
  compareUploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#7C3AED',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 9,
  },
  compareUploadBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  compareSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
    paddingVertical: 4,
  },
  summaryBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  summaryBadgeText: {
    fontSize: 11.5,
    fontWeight: '800',
  },
  diffPageCard: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 11,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
  },
  diffPageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  diffPageNum: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  diffCountsText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#64748B',
  },
  diffThumbsRow: {
    flexDirection: 'row',
    gap: 10,
    padding: 10,
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  diffThumbBox: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  diffThumbLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#475569',
  },
  diffThumbImg: {
    width: '100%',
    height: 110,
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  diffNoImgText: {
    fontSize: 11,
    color: '#94A3B8',
    paddingVertical: 20,
  },
  diffLinesBox: {
    padding: 8,
    gap: 3,
  },
  diffLineRow: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  diffLineAdded: {
    backgroundColor: '#DCFCE7',
  },
  diffLineRemoved: {
    backgroundColor: '#FEE2E2',
  },
  diffLinePrefix: {
    fontSize: 11.5,
    fontWeight: '900',
    width: 12,
    color: '#94A3B8',
  },
  diffLineText: {
    flex: 1,
    fontSize: 11.5,
    color: '#334155',
  },
  diffMoreText: {
    fontSize: 11,
    color: '#64748B',
    textAlign: 'center',
    paddingTop: 4,
  },
  emptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    paddingHorizontal: 16,
    gap: 6,
  },
  emptyTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#334155',
    textAlign: 'center',
  },
  emptyDesc: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
  },
  // Comments Drawer
  commentsDrawer: {
    width: 315,
    backgroundColor: '#FFFFFF',
    borderLeftWidth: 1,
    borderLeftColor: '#E2E8F0',
    height: '100%',
  },
  drawerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  drawerTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#0F172A',
  },
  drawerFilterBar: {
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  drawerFilterChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 5,
    borderRadius: 7,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  drawerFilterChipActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#2563EB',
  },
  drawerFilterText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  drawerFilterTextActive: {
    color: '#1D4ED8',
  },
  addCommentBannerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#2563EB',
    marginHorizontal: 10,
    marginTop: 10,
    paddingVertical: 8,
    borderRadius: 9,
  },
  addCommentBannerText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '800',
  },
  threadCard: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 11,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  threadCardSelected: {
    borderColor: '#2563EB',
    borderWidth: 1.8,
  },
  threadCardResolved: {
    opacity: 0.78,
    backgroundColor: '#F8FAFC',
  },
  threadHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  threadBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  threadNumBadge: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  threadNumText: {
    color: '#FFFFFF',
    fontSize: 10.5,
    fontWeight: '800',
  },
  threadPageLink: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#1D4ED8',
  },
  resolveChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  resolveChipDone: {
    backgroundColor: '#10B981',
    borderColor: '#059669',
  },
  resolveChipText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#047857',
  },
  threadDeleteBtn: {
    padding: 4,
    borderRadius: 6,
  },
  threadMessages: {
    padding: 10,
    gap: 7,
  },
  msgBubble: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 8,
    gap: 3,
  },
  msgMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  msgAuthor: {
    fontSize: 11,
    fontWeight: '800',
    color: '#334155',
  },
  msgTime: {
    fontSize: 10,
    color: '#94A3B8',
  },
  msgText: {
    fontSize: 12.5,
    color: '#0F172A',
    lineHeight: 17,
  },
  replyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingBottom: 10,
  },
  replyInput: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 6,
    fontSize: 12,
    color: '#0F172A',
  },
  replySendBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
