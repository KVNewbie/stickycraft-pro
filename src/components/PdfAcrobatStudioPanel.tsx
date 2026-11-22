import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Image,
  Platform,
} from 'react-native';
import {
  FileText,
  Upload,
  Plus,
  Layers,
  Scissors,
  FolderPlus,
  ArrowLeft,
  ArrowRight,
  RotateCw,
  Copy,
  Trash2,
  Check,
  Sparkles,
  FilePlus2,
  Combine,
  Split,
  LayoutGrid,
  Edit3,
  X,
  Image as ImageIcon,
  CheckSquare,
  Square,
} from 'lucide-react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { Note, PdfDocumentMeta, PdfPageData, PaperTemplate } from '../types/note';
import { SAMPLE_DOCUMENTS } from '../constants/sampleDocuments';
import {
  base64ToUint8Array,
  createPdfPagesFromImages,
  PdfInputSource,
  renderRealPdfFile,
} from '../utils/pdfEngine';

export type PdfWorkspaceTab = 'annotate' | 'organize' | 'merge' | 'split';

/**
 * 모바일(iOS / Android) 기기 파일 선택기에서 하나 또는 여러 개의 .pdf 파일을 선택해 바이너리로 읽어옵니다.
 */
export async function pickNativePdfFiles(
  multiple = false
): Promise<Array<{ name: string; bytes: Uint8Array }>> {
  try {
    const res = await DocumentPicker.getDocumentAsync({
      type: 'application/pdf',
      multiple,
      copyToCacheDirectory: true,
    });
    if (res.canceled || !res.assets || res.assets.length === 0) return [];
    const results: Array<{ name: string; bytes: Uint8Array }> = [];
    for (const asset of res.assets) {
      const base64 = await FileSystem.readAsStringAsync(asset.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      results.push({
        name: asset.name || '모바일_문서.pdf',
        bytes: base64ToUint8Array(base64),
      });
    }
    return results;
  } catch (err) {
    console.warn('Native PDF picker error:', err);
    return [];
  }
}

/**
 * 업로드된 실제 .pdf 파일(웹 File 또는 모바일 바이너리)을 오프라인 PDF.js / pdf-lib 엔진으로
 * 고화질 렌더링 + 읽기 순서 및 2D 좌표 텍스트 추출 + 메타데이터 파싱하여 PdfPageData 배열로 변환합니다.
 */
export async function parseUploadedPdfFile(
  file: PdfInputSource,
  onProgress?: (current: number, total: number) => void
): Promise<{
  fileName: string;
  pages: PdfPageData[];
  meta: PdfDocumentMeta;
  usedRealRenderer: boolean;
  sourceDocId: string;
}> {
  const fileName = file.name || '업로드_문서.pdf';
  const rendered = await renderRealPdfFile(file, onProgress);
  return {
    fileName,
    pages: rendered.pages,
    meta: rendered.meta,
    usedRealRenderer: rendered.usedRealRenderer,
    sourceDocId: rendered.sourceDocId,
  };
}

/**
 * 기존 Note 객체로부터 병합/열기용 PdfPageData 배열을 추출합니다.
 */
export function extractPdfPagesFromNote(note: Note): PdfPageData[] {
  if (note.pdfPages && note.pdfPages.length > 0) {
    return note.pdfPages.map((p, idx) => ({
      ...p,
      id: p.id || `pdfp_${Date.now()}_${idx + 1}_${Math.random().toString(36).substring(2, 6)}`,
      pageNumber: idx + 1,
      sourcePdfName: p.sourcePdfName || note.pdfName || note.title,
    }));
  }

  // 샘플 문서 매칭 여부 확인
  const query = (note.pdfName || note.title || '').toLowerCase();
  const sample = SAMPLE_DOCUMENTS.find(
    (doc) =>
      query.includes(doc.name.toLowerCase()) ||
      doc.name.toLowerCase().includes(query)
  );

  if (sample) {
    return sample.pages.map((p, idx) => ({
      id: `pdfp_${Date.now()}_${idx + 1}_${Math.random().toString(36).substring(2, 6)}`,
      pageNumber: idx + 1,
      title: p.title,
      subtitle: p.subtitle,
      content: p.content,
      sourcePdfName: sample.name,
    }));
  }

  // 일반 텍스트/체크리스트 메모를 PDF 페이지로 변환하여 병합할 때
  const checklistBody =
    note.checklist && note.checklist.length > 0
      ? '\n\n[체크리스트]\n' +
        note.checklist.map((c) => `${c.completed ? '☑' : '☐'} ${c.text}`).join('\n')
      : '';

  return [
    {
      id: `pdfp_${Date.now()}_1_${Math.random().toString(36).substring(2, 6)}`,
      pageNumber: 1,
      title: note.title || '병합된 메모 페이지',
      subtitle: `원본 메모: ${note.title || '제목 없음'}`,
      content: (note.content || '') + checklistBody,
      sourcePdfName: note.pdfName || note.title || '노트 메모',
    },
  ];
}

interface PdfOpenLauncherProps {
  existingPdfNotes: Note[];
  onOpenUploadedPdf: (
    fileName: string,
    pages: PdfPageData[],
    initialTab: PdfWorkspaceTab,
    meta?: PdfDocumentMeta
  ) => void;
  onCreateBlankPdf: (title: string, pageCount: number, template: PaperTemplate, initialTab: PdfWorkspaceTab) => void;
  onSelectExistingNote: (note: Note, initialTab: PdfWorkspaceTab) => void;
  onCancel: () => void;
}

/**
 * 새 메모 -> PDF 문서 열기 클릭 시 나타나는 Adobe Acrobat 스타일 PDF 시작 & 파일 열기 허브
 * (기존 샘플 문서가 멋대로 열리는 대신, 파일 열기 / 이미지→PDF / 새 빈 PDF / 기존 문서 선택)
 */
export const PdfOpenLauncherView: React.FC<PdfOpenLauncherProps> = ({
  existingPdfNotes,
  onOpenUploadedPdf,
  onCreateBlankPdf,
  onSelectExistingNote,
  onCancel,
}) => {
  const [selectedActionTab, setSelectedActionTab] = useState<PdfWorkspaceTab>('annotate');
  const [newPdfTitle, setNewPdfTitle] = useState('새 PDF 문서.pdf');
  const [newPdfPagesCount, setNewPdfPagesCount] = useState(3);
  const [newPdfTemplate, setNewPdfTemplate] = useState<PaperTemplate>('blank');
  const [isLoadingFile, setIsLoadingFile] = useState(false);
  const [loadingProgressText, setLoadingProgressText] = useState('');

  const handleTriggerFileUpload = async () => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'application/pdf,.pdf';
      input.multiple = selectedActionTab === 'merge';
      input.onchange = async (e: any) => {
        const files: FileList | undefined = e.target?.files;
        if (!files || files.length === 0) return;
        setIsLoadingFile(true);
        setLoadingProgressText('PDF 원본 렌더링 준비 중...');
        try {
          let combinedPages: PdfPageData[] = [];
          let primaryName = files[0].name;
          let primaryMeta: PdfDocumentMeta | undefined;
          for (let i = 0; i < files.length; i++) {
            const parsed = await parseUploadedPdfFile(files[i], (cur, tot) => {
              setLoadingProgressText(`PDF 원본 페이지 렌더링 중... (${cur}/${tot})`);
            });
            if (i === 0) primaryMeta = parsed.meta;
            combinedPages = [...combinedPages, ...parsed.pages];
          }
          const reindexed = combinedPages.map((p, idx) => ({
            ...p,
            pageNumber: idx + 1,
          }));
          if (files.length > 1) {
            primaryName = `${files[0].name.replace(/\.pdf$/i, '')}_외_${files.length - 1}건_병합.pdf`;
          }
          onOpenUploadedPdf(primaryName, reindexed, selectedActionTab, primaryMeta);
        } finally {
          setIsLoadingFile(false);
          setLoadingProgressText('');
        }
      };
      input.click();
      return;
    }

    // 모바일(iOS / Android): 기기 파일 선택기로 실제 .pdf 파일을 열어 원본 보존 및 로드
    setIsLoadingFile(true);
    setLoadingProgressText('기기에서 PDF 파일을 불러오는 중...');
    try {
      const picked = await pickNativePdfFiles(selectedActionTab === 'merge');
      if (picked.length === 0) return;
      let combinedPages: PdfPageData[] = [];
      let primaryName = picked[0].name;
      let primaryMeta: PdfDocumentMeta | undefined;
      for (let i = 0; i < picked.length; i++) {
        const parsed = await parseUploadedPdfFile(picked[i], (cur, tot) => {
          setLoadingProgressText(`PDF 분석 중... (${cur}/${tot})`);
        });
        if (i === 0) primaryMeta = parsed.meta;
        combinedPages = [...combinedPages, ...parsed.pages];
      }
      const reindexed = combinedPages.map((p, idx) => ({
        ...p,
        pageNumber: idx + 1,
      }));
      if (picked.length > 1) {
        primaryName = `${picked[0].name.replace(/\.pdf$/i, '')}_외_${picked.length - 1}건_병합.pdf`;
      }
      onOpenUploadedPdf(primaryName, reindexed, selectedActionTab, primaryMeta);
    } finally {
      setIsLoadingFile(false);
      setLoadingProgressText('');
    }
  };

  const handleTriggerImagesToPdf = () => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/png,image/jpeg,image/webp,image/*';
      input.multiple = true;
      input.onchange = async (e: any) => {
        const files: FileList | undefined = e.target?.files;
        if (!files || files.length === 0) return;
        setIsLoadingFile(true);
        setLoadingProgressText(`이미지 ${files.length}장을 A4 PDF로 변환 중...`);
        try {
          const pages = await createPdfPagesFromImages(Array.from(files));
          const base = files[0].name.replace(/\.[^.]+$/, '') || '이미지문서';
          const docName =
            files.length > 1 ? `${base}_외_${files.length - 1}장.pdf` : `${base}.pdf`;
          onOpenUploadedPdf(docName, pages, selectedActionTab);
        } finally {
          setIsLoadingFile(false);
          setLoadingProgressText('');
        }
      };
      input.click();
    }
  };

  const ACTION_MODES: {
    id: PdfWorkspaceTab;
    label: string;
    desc: string;
    icon: any;
    accent: string;
    bg: string;
  }[] = [
    {
      id: 'annotate',
      label: '편집 및 필기 주석',
      desc: '만년필·형광펜 필기, 도형, 텍스트 상자, 음성 핀 추가',
      icon: Edit3,
      accent: '#2563EB',
      bg: '#EFF6FF',
    },
    {
      id: 'merge',
      label: 'PDF 병합 (Merge)',
      desc: '여러 개의 PDF 파일이나 노트를 하나의 PDF로 결합',
      icon: Combine,
      accent: '#7C3AED',
      bg: '#F3E8FF',
    },
    {
      id: 'split',
      label: 'PDF 분할 및 추출 (Split)',
      desc: '원하는 페이지 범위만 추출하거나 두 개의 PDF로 분할',
      icon: Scissors,
      accent: '#DC2626',
      bg: '#FEE2E2',
    },
    {
      id: 'organize',
      label: '페이지 구성 (Organize)',
      desc: '페이지 순서 변경, 90° 회전, 복제, 빈 페이지 삽입/삭제',
      icon: LayoutGrid,
      accent: '#059669',
      bg: '#ECFDF5',
    },
  ];

  return (
    <View style={styles.launcherContainer}>
      {/* 상단 헤더 */}
      <View style={styles.launcherHeader}>
        <TouchableOpacity style={styles.backBtn} onPress={onCancel}>
          <ArrowLeft size={20} color="#1E293B" />
          <Text style={styles.backBtnText}>돌아가기</Text>
        </TouchableOpacity>
        <View style={styles.headerBadge}>
          <FileText size={16} color="#DC2626" />
          <Text style={styles.headerBadgeText}>Adobe Acrobat 스타일 PDF 워크스페이스 허브</Text>
        </View>
        <View style={{ width: 80 }} />
      </View>

      <ScrollView contentContainerStyle={styles.launcherScroll}>
        <View style={styles.heroBox}>
          <Text style={styles.heroTitle}>어떤 PDF 작업을 시작하시겠습니까?</Text>
          <Text style={styles.heroSubtitle}>
            수행할 작업 모드(편집 / 병합 / 분할 / 페이지 구성)를 선택하고 내 기기에서 PDF 파일을 열거나 새 문서를 만드세요.
          </Text>
        </View>

        {/* STEP 1: 작업 모드 선택 (Adobe Acrobat 4대 도구) */}
        <Text style={styles.stepHeading}>1. PDF 작업 모드 선택</Text>
        <View style={styles.modeGrid}>
          {ACTION_MODES.map((m) => {
            const IconComp = m.icon;
            const isSelected = selectedActionTab === m.id;
            return (
              <TouchableOpacity
                key={m.id}
                style={[
                  styles.modeCard,
                  isSelected && { borderColor: m.accent, backgroundColor: m.bg, borderWidth: 2 },
                ]}
                onPress={() => setSelectedActionTab(m.id)}
                activeOpacity={0.8}
              >
                <View style={[styles.modeIconCircle, { backgroundColor: m.bg }]}>
                  <IconComp size={20} color={m.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.modeCardTitle, isSelected && { color: m.accent }]}>
                    {m.label}
                  </Text>
                  <Text style={styles.modeCardDesc}>{m.desc}</Text>
                </View>
                {isSelected && (
                  <View style={[styles.modeCheckBadge, { backgroundColor: m.accent }]}>
                    <Check size={12} color="#FFFFFF" strokeWidth={3} />
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* STEP 2: PDF 파일 불러오기 또는 새 빈 PDF 생성 */}
        <Text style={styles.stepHeading}>2. 문서 열기 또는 새로 만들기</Text>
        <View style={styles.sourceCardsRow}>
          {/* 내 기기에서 PDF 파일 열기 / 이미지 → PDF */}
          <View style={styles.uploadDropCard}>
            <TouchableOpacity
              style={{ alignItems: 'center', gap: 10, width: '100%' }}
              onPress={handleTriggerFileUpload}
              activeOpacity={0.85}
            >
              <View style={styles.uploadIconCircle}>
                <Upload size={28} color="#2563EB" />
              </View>
              <Text style={styles.uploadCardTitle}>
                {isLoadingFile
                  ? loadingProgressText || 'PDF 문서 분석 및 불러오는 중...'
                  : selectedActionTab === 'merge'
                  ? '내 PC/기기에서 병합할 PDF 파일 선택 (다중 선택 가능)'
                  : '내 PC/기기에서 PDF 파일 불러오기 (.pdf)'}
              </Text>
              <Text style={styles.uploadCardSub}>
                실제 PDF 원본 레이아웃·표·이미지를 고화질 렌더링하고 텍스트 검색까지 자동 지원합니다.
              </Text>
              <View style={styles.uploadPrimaryBtn}>
                <FolderPlus size={16} color="#FFFFFF" />
                <Text style={styles.uploadPrimaryBtnText}>내 파일 탐색기에서 PDF 열기</Text>
              </View>
            </TouchableOpacity>

            <View style={styles.uploadOrDivider} />

            <TouchableOpacity
              style={styles.uploadImagesBtn}
              onPress={handleTriggerImagesToPdf}
              activeOpacity={0.85}
            >
              <ImageIcon size={15} color="#7C3AED" />
              <Text style={styles.uploadImagesBtnText}>
                🖼️ 이미지 여러 장(.png/.jpg)으로 새 PDF 만들기
              </Text>
            </TouchableOpacity>
          </View>

          {/* 새 빈 PDF 문서 생성 */}
          <View style={styles.newBlankPdfCard}>
            <View style={styles.newBlankHeader}>
              <FilePlus2 size={20} color="#059669" />
              <Text style={styles.newBlankTitle}>새 빈 PDF 문서 만들기</Text>
            </View>
            <Text style={styles.newBlankDesc}>
              외부 파일 없이 깨끗한 A4 PDF 문서를 원하는 페이지 수로 즉시 생성합니다.
            </Text>

            <Text style={styles.inputLabel}>문서 파일명</Text>
            <TextInput
              style={styles.titleInput}
              value={newPdfTitle}
              onChangeText={setNewPdfTitle}
              placeholder="예: 프로젝트 회의록.pdf"
              placeholderTextColor="#94A3B8"
            />

            <View style={styles.pageCountRow}>
              <Text style={styles.inputLabel}>초기 페이지 수:</Text>
              {[1, 2, 3, 5, 10].map((cnt) => (
                <TouchableOpacity
                  key={cnt}
                  style={[
                    styles.pageCountChip,
                    newPdfPagesCount === cnt && styles.pageCountChipActive,
                  ]}
                  onPress={() => setNewPdfPagesCount(cnt)}
                >
                  <Text
                    style={[
                      styles.pageCountChipText,
                      newPdfPagesCount === cnt && styles.pageCountChipTextActive,
                    ]}
                  >
                    {cnt}장
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.pageCountRow}>
              <Text style={styles.inputLabel}>기본 속지:</Text>
              {(
                [
                  { id: 'blank', label: '무지' },
                  { id: 'lined', label: '줄노트' },
                  { id: 'grid', label: '모눈' },
                  { id: 'cornell', label: '코넬' },
                ] as const
              ).map((t) => (
                <TouchableOpacity
                  key={t.id}
                  style={[
                    styles.pageCountChip,
                    newPdfTemplate === t.id && styles.pageCountChipActive,
                  ]}
                  onPress={() => setNewPdfTemplate(t.id)}
                >
                  <Text
                    style={[
                      styles.pageCountChipText,
                      newPdfTemplate === t.id && styles.pageCountChipTextActive,
                    ]}
                  >
                    {t.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={styles.createBlankBtn}
              onPress={() => {
                const finalName = newPdfTitle.trim()
                  ? newPdfTitle.trim().endsWith('.pdf')
                    ? newPdfTitle.trim()
                    : `${newPdfTitle.trim()}.pdf`
                  : '새 PDF 문서.pdf';
                onCreateBlankPdf(finalName, newPdfPagesCount, newPdfTemplate, selectedActionTab);
              }}
            >
              <Plus size={16} color="#FFFFFF" />
              <Text style={styles.createBlankBtnText}>새 PDF 문서 생성 후 시작</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* STEP 3: 내 워크스페이스에 저장된 기존 PDF 문서 열기 (선택 사항) */}
        {existingPdfNotes.length > 0 && (
          <View style={styles.existingSection}>
            <Text style={styles.stepHeading}>
              3. 내 보관함의 기존 PDF 문서 불러오기 ({existingPdfNotes.length}개)
            </Text>
            <View style={styles.existingList}>
              {existingPdfNotes.map((n) => {
                const pageCnt = n.pdfPages?.length || 3;
                return (
                  <TouchableOpacity
                    key={n.id}
                    style={styles.existingPdfRow}
                    onPress={() => onSelectExistingNote(n, selectedActionTab)}
                  >
                    <View style={styles.existingPdfIcon}>
                      <FileText size={18} color="#2563EB" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.existingPdfTitle} numberOfLines={1}>
                        {n.title || n.pdfName || 'PDF 문서'}
                      </Text>
                      <Text style={styles.existingPdfMeta}>
                        총 {pageCnt}페이지 • 필기 {(n.strokes || []).length}개 •{' '}
                        {new Date(n.updatedAt).toLocaleDateString('ko-KR')}
                      </Text>
                    </View>
                    <View style={styles.existingOpenPill}>
                      <Text style={styles.existingOpenPillText}>
                        {ACTION_MODES.find((a) => a.id === selectedActionTab)?.label} 열기 →
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

export interface PdfPageClipboardItem {
  sourceTitle: string;
  sourceNote: Note | null;
  pages: PdfPageData[];
  sourcePageNums: number[];
  copiedAt: number;
}

// 앱 내 모든 PDF 문서 간 공유되는 페이지 클립보드 (메모리 + 웹 전역 유지)
let sharedPdfPageClipboard: PdfPageClipboardItem | null = null;

interface PdfAcrobatStudioPanelProps {
  mode: 'organize' | 'merge' | 'split';
  title: string;
  pdfPages: PdfPageData[];
  currentPage: number;
  pageRotations: Record<number, number>;
  strokeCountsByPage: Record<number, number>;
  allNotes: Note[];
  currentNoteId?: string;
  onSelectPageAndAnnotate: (pageNum: number) => void;
  onMovePage: (fromPageNum: number, toPageNum: number) => void;
  onRotatePage: (pageNum: number) => void;
  onDuplicatePage: (pageNum: number) => void;
  onDeletePage: (pageNum: number) => void;
  onInsertBlankPageAfter: (afterPageNum: number) => void;
  onMergePages: (
    newPages: PdfPageData[],
    sourceNote: Note | null,
    position: 'append' | 'prepend' | 'after_current',
    customInsertIndex?: number,
    selectedSourcePageNums?: number[]
  ) => void;
  onSplitPages: (selectedPageNums: number[], removeOriginalPages: boolean, newDocTitle: string) => void;
  onBatchRotatePages?: (pageNums: number[]) => void;
  onBatchDeletePages?: (pageNums: number[]) => void;
  onSplitEveryNPages?: (chunkSize: number, baseTitle: string) => void;
}

/**
 * Adobe Acrobat 스타일 페이지 구성(Organize) / 병합(Merge) / 분할(Split) 전용 워크스페이스 뷰
 */
export const PdfAcrobatStudioPanel: React.FC<PdfAcrobatStudioPanelProps> = ({
  mode,
  title,
  pdfPages,
  currentPage,
  pageRotations,
  strokeCountsByPage,
  allNotes,
  currentNoteId,
  onSelectPageAndAnnotate,
  onMovePage,
  onRotatePage,
  onDuplicatePage,
  onDeletePage,
  onInsertBlankPageAfter,
  onMergePages,
  onSplitPages,
  onBatchRotatePages,
  onBatchDeletePages,
  onSplitEveryNPages,
}) => {
  // 병합(Merge) 상태
  const [mergePosition, setMergePosition] = useState<'append' | 'prepend' | 'after_current'>('append');
  const [isMergeLoading, setIsMergeLoading] = useState(false);
  const [expandedMergeNoteId, setExpandedMergeNoteId] = useState<string | null>(null);
  const [selectedMergePageMap, setSelectedMergePageMap] = useState<Record<string, number[]>>({});

  // 페이지 구성(Organize) 다중 선택 & 썸네일 크기 상태
  const [orgSelected, setOrgSelected] = useState<number[]>([]);
  const [thumbSize, setThumbSize] = useState<'sm' | 'md' | 'lg'>('md');
  const thumbCardWidth = thumbSize === 'sm' ? 170 : thumbSize === 'lg' ? 310 : 235;
  const thumbSheetHeight = thumbSize === 'sm' ? 120 : thumbSize === 'lg' ? 300 : 170;

  // 문서 간 페이지 복사 클립보드 & 다른 PDF에서 페이지 가져와 넣기 트레이 상태
  const [pageClipboard, setPageClipboard] = useState<PdfPageClipboardItem | null>(
    () => sharedPdfPageClipboard
  );
  const [isExternalPickerOpen, setIsExternalPickerOpen] = useState(false);
  const [externalSourceNoteId, setExternalSourceNoteId] = useState<string | null>(null);
  const [uploadedExternalDoc, setUploadedExternalDoc] = useState<{
    title: string;
    pages: PdfPageData[];
  } | null>(null);
  const [externalSelectedPages, setExternalSelectedPages] = useState<number[]>([]);
  const [externalInsertTargetIdx, setExternalInsertTargetIdx] = useState<number>(pdfPages.length);

  // 드래그 앤 드롭 페이지 순서 변경 / 외부 PDF 페이지 드래그 삽입 상태
  const [draggingPageNum, setDraggingPageNum] = useState<number | null>(null);
  const [draggingExternalPage, setDraggingExternalPage] = useState<{
    page: PdfPageData;
    pageNumber: number;
    sourceNote: Note | null;
  } | null>(null);
  const [dragOverPageNum, setDragOverPageNum] = useState<number | null>(null);

  const toggleOrgSelect = (pNum: number) => {
    setOrgSelected((prev) =>
      prev.includes(pNum) ? prev.filter((p) => p !== pNum) : [...prev, pNum].sort((a, b) => a - b)
    );
  };

  // 현재 PDF에서 선택한 페이지(또는 특정 페이지)를 문서 간 페이지 클립보드에 복사
  const handleCopyPagesToClipboard = (targetPageNums: number[]) => {
    const nums =
      targetPageNums.length > 0
        ? [...targetPageNums].sort((a, b) => a - b)
        : [currentPage || 1];
    const copiedPages = nums
      .map((n) => pdfPages[n - 1])
      .filter(Boolean)
      .map((p) => ({
        ...p,
        sourcePdfName: p.sourcePdfName || title,
      }));
    if (copiedPages.length === 0) return;
    const currentNoteObj = allNotes.find((n) => n.id === currentNoteId) || null;
    const item: PdfPageClipboardItem = {
      sourceTitle: title,
      sourceNote: currentNoteObj,
      pages: copiedPages,
      sourcePageNums: nums,
      copiedAt: Date.now(),
    };
    sharedPdfPageClipboard = item;
    setPageClipboard(item);
  };

  // 클립보드에 복사된 페이지를 현재 PDF 원하는 위치에 붙여넣기
  const handlePastePagesFromClipboard = (insertAfterPageNum?: number) => {
    const clip = sharedPdfPageClipboard || pageClipboard;
    if (!clip || clip.pages.length === 0) return;
    const insertIdx =
      typeof insertAfterPageNum === 'number'
        ? insertAfterPageNum
        : orgSelected.length > 0
        ? Math.max(...orgSelected)
        : pdfPages.length;
    onMergePages(clip.pages, clip.sourceNote, 'append', insertIdx, clip.sourcePageNums);
  };

  // 외부 로컬 .pdf 파일을 트레이로 불러와 원하는 페이지만 골라 넣기
  const handleLoadExternalPdfIntoTray = async () => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'application/pdf,.pdf';
      input.onchange = async (e: any) => {
        const file: File | undefined = e.target?.files?.[0];
        if (!file) return;
        setIsMergeLoading(true);
        try {
          const parsed = await parseUploadedPdfFile(file);
          setUploadedExternalDoc({
            title: parsed.fileName,
            pages: parsed.pages,
          });
          setExternalSourceNoteId('__uploaded__');
          setExternalSelectedPages(parsed.pages.map((_, idx) => idx + 1));
        } finally {
          setIsMergeLoading(false);
        }
      };
      input.click();
      return;
    }

    setIsMergeLoading(true);
    try {
      const picked = await pickNativePdfFiles(false);
      if (picked.length === 0) return;
      const parsed = await parseUploadedPdfFile(picked[0]);
      setUploadedExternalDoc({
        title: parsed.fileName,
        pages: parsed.pages,
      });
      setExternalSourceNoteId('__uploaded__');
      setExternalSelectedPages(parsed.pages.map((_, idx) => idx + 1));
    } finally {
      setIsMergeLoading(false);
    }
  };

  // 드래그 앤 드롭 완료 처리 (내부 페이지 순서 이동 또는 다른 PDF 페이지 원하는 슬롯에 삽입)
  const handleFinalizeDropOnPage = (targetPageNum: number) => {
    if (draggingExternalPage) {
      // 다른 PDF에서 드래그한 페이지를 targetPageNum 위치(즉 targetPageNum - 1 인덱스)에 삽입
      onMergePages(
        [draggingExternalPage.page],
        draggingExternalPage.sourceNote,
        'append',
        Math.max(0, targetPageNum - 1),
        [draggingExternalPage.pageNumber]
      );
      setDraggingExternalPage(null);
      setDragOverPageNum(null);
      return;
    }
    if (draggingPageNum !== null && draggingPageNum !== targetPageNum) {
      onMovePage(draggingPageNum, targetPageNum);
    }
    setDraggingPageNum(null);
    setDragOverPageNum(null);
  };

  // 분할(Split) 상태
  const [splitMode, setSplitMode] = useState<'select' | 'every-n'>('select');
  const [splitChunkSize, setSplitChunkSize] = useState<number>(1);
  const [splitChunkInput, setSplitChunkInput] = useState<string>('');
  const [selectedSplitPages, setSelectedSplitPages] = useState<number[]>([1]);
  const [splitRangeInput, setSplitRangeInput] = useState('1');
  const [splitNewTitle, setSplitNewTitle] = useState(
    `${title.replace(/\.pdf$/i, '')}_분할추출.pdf`
  );

  const toggleSplitPage = (pNum: number) => {
    setSelectedSplitPages((prev) => {
      const next = prev.includes(pNum)
        ? prev.filter((p) => p !== pNum)
        : [...prev, pNum].sort((a, b) => a - b);
      setSplitRangeInput(next.join(', '));
      return next;
    });
  };

  const applyRangeString = (rangeStr: string) => {
    setSplitRangeInput(rangeStr);
    const matched = new Set<number>();
    const parts = rangeStr.split(',');
    for (const raw of parts) {
      const trimmed = raw.trim();
      if (!trimmed) continue;
      if (trimmed.includes('-')) {
        const [s, e] = trimmed.split('-').map((n) => parseInt(n.trim(), 10));
        if (!isNaN(s) && !isNaN(e)) {
          const start = Math.max(1, Math.min(s, e));
          const end = Math.min(pdfPages.length, Math.max(s, e));
          for (let i = start; i <= end; i++) matched.add(i);
        }
      } else {
        const num = parseInt(trimmed, 10);
        if (!isNaN(num) && num >= 1 && num <= pdfPages.length) {
          matched.add(num);
        }
      }
    }
    if (matched.size > 0) {
      setSelectedSplitPages(Array.from(matched).sort((a, b) => a - b));
    }
  };

  const handleUploadPdfToMerge = async () => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'application/pdf,.pdf';
      input.multiple = true;
      input.onchange = async (e: any) => {
        const files: FileList | undefined = e.target?.files;
        if (!files || files.length === 0) return;
        setIsMergeLoading(true);
        try {
          let incoming: PdfPageData[] = [];
          for (let i = 0; i < files.length; i++) {
            const parsed = await parseUploadedPdfFile(files[i]);
            incoming = [...incoming, ...parsed.pages];
          }
          if (incoming.length > 0) {
            onMergePages(incoming, null, mergePosition);
          }
        } finally {
          setIsMergeLoading(false);
        }
      };
      input.click();
      return;
    }

    setIsMergeLoading(true);
    try {
      const picked = await pickNativePdfFiles(true);
      if (picked.length === 0) return;
      let incoming: PdfPageData[] = [];
      for (const item of picked) {
        const parsed = await parseUploadedPdfFile(item);
        incoming = [...incoming, ...parsed.pages];
      }
      if (incoming.length > 0) {
        onMergePages(incoming, null, mergePosition);
      }
    } finally {
      setIsMergeLoading(false);
    }
  };

  const mergeableNotes = allNotes.filter((n) => !n.isDeleted && n.id !== currentNoteId);

  const activeExternalNote =
    externalSourceNoteId && externalSourceNoteId !== '__uploaded__'
      ? mergeableNotes.find((n) => n.id === externalSourceNoteId) || null
      : null;

  const activeExternalPages: PdfPageData[] =
    externalSourceNoteId === '__uploaded__' && uploadedExternalDoc
      ? uploadedExternalDoc.pages
      : activeExternalNote
      ? extractPdfPagesFromNote(activeExternalNote)
      : [];

  const activeExternalTitle =
    externalSourceNoteId === '__uploaded__' && uploadedExternalDoc
      ? uploadedExternalDoc.title
      : activeExternalNote
      ? activeExternalNote.title || activeExternalNote.pdfName || '다른 PDF 문서'
      : '';

  // 실제 PDF 렌더링 이미지 or 텍스트 기반 미니 시트 공용 렌더러
  const renderMiniSheet = (p: PdfPageData, rot: number, height: number) => (
    <View
      style={[
        styles.orgMiniSheet,
        { height },
        p.renderedImageUri ? { padding: 0, overflow: 'hidden', backgroundColor: '#FFFFFF' } : null,
        rot ? { transform: [{ rotate: `${rot}deg` }] } : undefined,
      ]}
    >
      {p.renderedImageUri ? (
        <Image
          source={{ uri: p.renderedImageUri }}
          style={{ width: '100%', height: '100%' }}
          resizeMode="contain"
        />
      ) : (
        <>
          <Text style={styles.orgMiniTitle} numberOfLines={2}>
            {p.title}
          </Text>
          {p.subtitle ? (
            <Text style={styles.orgMiniSub} numberOfLines={1}>
              {p.subtitle}
            </Text>
          ) : null}
          <View style={styles.orgMiniDivider} />
          <Text style={styles.orgMiniContent} numberOfLines={Math.max(2, Math.floor(height / 22))}>
            {p.content}
          </Text>
        </>
      )}
    </View>
  );

  return (
    <ScrollView style={styles.studioScroll} contentContainerStyle={styles.studioContent}>
      {/* 1. 페이지 구성 (Organize Pages) 모드 */}
      {mode === 'organize' && (
        <View style={styles.studioSection}>
          <View style={styles.studioBanner}>
            <View style={{ flex: 1 }}>
              <Text style={styles.studioBannerTitle}>
                🗂️ 페이지 구성 · 드래그 정렬 · 다른 PDF 페이지 복사/삽입 (총 {pdfPages.length}페이지)
              </Text>
              <Text style={styles.studioBannerDesc}>
                카드를 드래그 앤 드롭(⠿)하여 페이지 위치를 자유롭게 바꾸거나, 다른 PDF에서 원하는 페이지만 복사·드래그해 현재 문서의 원하는 위치에 넣을 수 있습니다.
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <TouchableOpacity
                style={[
                  styles.bannerImportBtn,
                  isExternalPickerOpen && { backgroundColor: '#4F46E5' },
                ]}
                onPress={() => {
                  const nextOpen = !isExternalPickerOpen;
                  setIsExternalPickerOpen(nextOpen);
                  if (nextOpen && !externalSourceNoteId && mergeableNotes.length > 0) {
                    const first = mergeableNotes[0];
                    setExternalSourceNoteId(first.id);
                    const pages = extractPdfPagesFromNote(first);
                    setExternalSelectedPages(pages.map((_, idx) => idx + 1));
                  }
                }}
              >
                <FolderPlus size={15} color="#FFFFFF" />
                <Text style={styles.bannerAddBtnText}>
                  {isExternalPickerOpen
                    ? '다른 PDF 트레이 닫기'
                    : '📂 다른 PDF에서 페이지 가져와 넣기'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.bannerAddBtn}
                onPress={() => onInsertBlankPageAfter(pdfPages.length)}
              >
                <Plus size={15} color="#FFFFFF" />
                <Text style={styles.bannerAddBtnText}>맨 뒤에 빈 페이지</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* 다중 선택 일괄 작업 바 + 문서 간 페이지 복사/붙여넣기 + 썸네일 크기 */}
          <View style={styles.batchBar}>
            <TouchableOpacity
              style={styles.batchChip}
              onPress={() =>
                setOrgSelected(
                  orgSelected.length === pdfPages.length ? [] : pdfPages.map((_, i) => i + 1)
                )
              }
            >
              {orgSelected.length === pdfPages.length && pdfPages.length > 0 ? (
                <CheckSquare size={14} color="#2563EB" />
              ) : (
                <Square size={14} color="#64748B" />
              )}
              <Text style={styles.batchChipText}>
                {orgSelected.length === pdfPages.length && pdfPages.length > 0
                  ? '선택 해제'
                  : '전체 선택'}
              </Text>
            </TouchableOpacity>
            <Text style={styles.batchCountText}>{orgSelected.length}장 선택됨</Text>

            {/* 페이지 복사 (다른 PDF에 붙여넣기용) */}
            <TouchableOpacity
              style={[styles.batchActionBtn, { borderColor: '#C7D2FE', backgroundColor: '#EEF2FF' }]}
              onPress={() =>
                handleCopyPagesToClipboard(orgSelected.length > 0 ? orgSelected : [currentPage])
              }
            >
              <Copy size={13} color="#4F46E5" />
              <Text style={[styles.batchActionText, { color: '#4338CA' }]}>
                📋 페이지 복사 ({orgSelected.length > 0 ? `${orgSelected.length}장` : `P.${currentPage}`})
              </Text>
            </TouchableOpacity>

            {/* 복사된 페이지 붙여넣기 (다른 PDF 또는 현재 PDF에서 복사한 페이지) */}
            {pageClipboard && pageClipboard.pages.length > 0 && (
              <TouchableOpacity
                style={[
                  styles.batchActionBtn,
                  { borderColor: '#A7F3D0', backgroundColor: '#ECFDF5' },
                ]}
                onPress={() => handlePastePagesFromClipboard()}
              >
                <Plus size={13} color="#059669" />
                <Text style={[styles.batchActionText, { color: '#047857' }]}>
                  📥 복사한 페이지 붙여넣기 ({pageClipboard.pages.length}장 ·{' '}
                  {pageClipboard.sourceTitle.slice(0, 14)})
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.batchActionBtn, orgSelected.length === 0 && styles.batchDisabled]}
              disabled={orgSelected.length === 0}
              onPress={() => {
                if (onBatchRotatePages) onBatchRotatePages(orgSelected);
                else orgSelected.forEach((p) => onRotatePage(p));
              }}
            >
              <RotateCw size={13} color="#2563EB" />
              <Text style={[styles.batchActionText, { color: '#1D4ED8' }]}>일괄 90° 회전</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.batchActionBtn, orgSelected.length === 0 && styles.batchDisabled]}
              disabled={orgSelected.length === 0}
              onPress={() => {
                onSplitPages(
                  orgSelected,
                  false,
                  `${title.replace(/\.pdf$/i, '')}_선택추출.pdf`
                );
                setOrgSelected([]);
              }}
            >
              <Copy size={13} color="#059669" />
              <Text style={[styles.batchActionText, { color: '#047857' }]}>새 PDF로 추출</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.batchActionBtn,
                (orgSelected.length === 0 || orgSelected.length >= pdfPages.length) &&
                  styles.batchDisabled,
              ]}
              disabled={orgSelected.length === 0 || orgSelected.length >= pdfPages.length}
              onPress={() => {
                if (onBatchDeletePages) onBatchDeletePages(orgSelected);
                else [...orgSelected].sort((a, b) => b - a).forEach((p) => onDeletePage(p));
                setOrgSelected([]);
              }}
            >
              <Trash2 size={13} color="#DC2626" />
              <Text style={[styles.batchActionText, { color: '#B91C1C' }]}>일괄 삭제</Text>
            </TouchableOpacity>

            <View style={{ flex: 1 }} />

            <Text style={styles.batchCountText}>썸네일:</Text>
            {(
              [
                { id: 'sm', label: '작게' },
                { id: 'md', label: '보통' },
                { id: 'lg', label: '크게' },
              ] as const
            ).map((s) => (
              <TouchableOpacity
                key={s.id}
                style={[styles.batchChip, thumbSize === s.id && styles.batchChipActive]}
                onPress={() => setThumbSize(s.id)}
              >
                <Text
                  style={[styles.batchChipText, thumbSize === s.id && { color: '#1D4ED8' }]}
                >
                  {s.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* 📂 다른 PDF에서 원하는 페이지만 골라서 복사·드래그 삽입하는 인라인 트레이 */}
          {isExternalPickerOpen && (
            <View style={styles.externalTrayCard}>
              <View style={styles.externalTrayHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.externalTrayTitle}>
                    📂 다른 PDF에서 원하는 페이지만 복사·드래그하여 현재 PDF에 넣기
                  </Text>
                  <Text style={styles.externalTraySub}>
                    아래에서 원본 PDF를 고른 뒤 원하는 페이지를 체크해 원하는 위치에 삽입하거나, 페이지 카드를 드래그해 아래 현재 PDF 페이지 위에 놓으세요.
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.externalUploadBtn}
                  onPress={handleLoadExternalPdfIntoTray}
                >
                  <Upload size={13} color="#4F46E5" />
                  <Text style={styles.externalUploadBtnText}>+ 로컬 .pdf 파일 열기</Text>
                </TouchableOpacity>
              </View>

              {/* 보관함 문서 선택 칩 */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8, paddingVertical: 4 }}
              >
                {uploadedExternalDoc && (
                  <TouchableOpacity
                    style={[
                      styles.externalDocChip,
                      externalSourceNoteId === '__uploaded__' && styles.externalDocChipActive,
                    ]}
                    onPress={() => {
                      setExternalSourceNoteId('__uploaded__');
                      setExternalSelectedPages(uploadedExternalDoc.pages.map((_, idx) => idx + 1));
                    }}
                  >
                    <FileText
                      size={13}
                      color={externalSourceNoteId === '__uploaded__' ? '#FFFFFF' : '#4F46E5'}
                    />
                    <Text
                      style={[
                        styles.externalDocChipText,
                        externalSourceNoteId === '__uploaded__' && { color: '#FFFFFF' },
                      ]}
                    >
                      [로컬] {uploadedExternalDoc.title} ({uploadedExternalDoc.pages.length}쪽)
                    </Text>
                  </TouchableOpacity>
                )}
                {mergeableNotes.map((n) => {
                  const isSel = externalSourceNoteId === n.id;
                  const pCnt = n.pdfPages?.length || 1;
                  return (
                    <TouchableOpacity
                      key={n.id}
                      style={[styles.externalDocChip, isSel && styles.externalDocChipActive]}
                      onPress={() => {
                        setExternalSourceNoteId(n.id);
                        const extracted = extractPdfPagesFromNote(n);
                        setExternalSelectedPages(extracted.map((_, idx) => idx + 1));
                      }}
                    >
                      <FileText size={13} color={isSel ? '#FFFFFF' : '#475569'} />
                      <Text
                        style={[styles.externalDocChipText, isSel && { color: '#FFFFFF' }]}
                        numberOfLines={1}
                      >
                        {n.title || n.pdfName || '문서'} ({pCnt}쪽)
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {activeExternalPages.length > 0 && (
                <>
                  {/* 삽입할 목표 위치 선택 & 선택 페이지 일괄 삽입 버튼 */}
                  <View style={styles.externalInsertBar}>
                    <Text style={styles.batchCountText}>넣을 위치:</Text>
                    <TouchableOpacity
                      style={[
                        styles.batchChip,
                        externalInsertTargetIdx === 0 && styles.batchChipActive,
                      ]}
                      onPress={() => setExternalInsertTargetIdx(0)}
                    >
                      <Text
                        style={[
                          styles.batchChipText,
                          externalInsertTargetIdx === 0 && { color: '#1D4ED8' },
                        ]}
                      >
                        맨 앞 (P.1 앞)
                      </Text>
                    </TouchableOpacity>
                    {pdfPages.map((_, i) => {
                      const afterP = i + 1;
                      const isTarget = externalInsertTargetIdx === afterP;
                      return (
                        <TouchableOpacity
                          key={afterP}
                          style={[styles.batchChip, isTarget && styles.batchChipActive]}
                          onPress={() => setExternalInsertTargetIdx(afterP)}
                        >
                          <Text
                            style={[styles.batchChipText, isTarget && { color: '#1D4ED8' }]}
                          >
                            P.{afterP} 뒤
                          </Text>
                        </TouchableOpacity>
                      );
                    })}

                    <View style={{ flex: 1 }} />

                    <TouchableOpacity
                      style={styles.batchChip}
                      onPress={() =>
                        setExternalSelectedPages(
                          externalSelectedPages.length === activeExternalPages.length
                            ? []
                            : activeExternalPages.map((_, i) => i + 1)
                        )
                      }
                    >
                      <Text style={styles.batchChipText}>
                        {externalSelectedPages.length === activeExternalPages.length
                          ? '전체 해제'
                          : '전체 선택'}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.externalInsertExecBtn,
                        externalSelectedPages.length === 0 && styles.batchDisabled,
                      ]}
                      disabled={externalSelectedPages.length === 0}
                      onPress={() => {
                        const sorted = [...externalSelectedPages].sort((a, b) => a - b);
                        const chosen = sorted
                          .map((num) => activeExternalPages[num - 1])
                          .filter(Boolean)
                          .map((p) => ({
                            ...p,
                            sourcePdfName: p.sourcePdfName || activeExternalTitle,
                          }));
                        if (chosen.length > 0) {
                          onMergePages(
                            chosen,
                            activeExternalNote,
                            'append',
                            Math.min(pdfPages.length, externalInsertTargetIdx),
                            sorted
                          );
                        }
                      }}
                    >
                      <Plus size={14} color="#FFFFFF" />
                      <Text style={styles.externalInsertExecText}>
                        선택한 {externalSelectedPages.length}장 현재 PDF에 넣기
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* 선택한 외부 PDF의 페이지 썸네일 카드 리스트 (클릭 선택 또는 아래 현재 PDF로 드래그 삽입) */}
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: 12, paddingTop: 4, paddingBottom: 4 }}
                  >
                    {activeExternalPages.map((ep, eIdx) => {
                      const epNum = eIdx + 1;
                      const isExtChecked = externalSelectedPages.includes(epNum);
                      const webExtDragProps: any =
                        Platform.OS === 'web'
                          ? {
                              draggable: true,
                              onDragStart: () => {
                                setDraggingPageNum(null);
                                setDraggingExternalPage({
                                  page: {
                                    ...ep,
                                    sourcePdfName: ep.sourcePdfName || activeExternalTitle,
                                  },
                                  pageNumber: epNum,
                                  sourceNote: activeExternalNote,
                                });
                              },
                              onDragEnd: () => {
                                setDraggingExternalPage(null);
                                setDragOverPageNum(null);
                              },
                            }
                          : {};
                      return (
                        <View
                          key={ep.id || epNum}
                          {...webExtDragProps}
                          style={[
                            styles.externalPageCard,
                            isExtChecked && { borderColor: '#4F46E5', borderWidth: 2 },
                          ]}
                        >
                          <TouchableOpacity
                            onPress={() =>
                              setExternalSelectedPages((prev) =>
                                prev.includes(epNum)
                                  ? prev.filter((x) => x !== epNum)
                                  : [...prev, epNum].sort((a, b) => a - b)
                              )
                            }
                            style={styles.orgPageTopRow}
                          >
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                              {isExtChecked ? (
                                <CheckSquare size={15} color="#4F46E5" />
                              ) : (
                                <Square size={15} color="#94A3B8" />
                              )}
                              <View
                                style={[
                                  styles.orgPageNumBadge,
                                  { backgroundColor: '#EEF2FF', borderColor: '#C7D2FE' },
                                ]}
                              >
                                <Text style={[styles.orgPageNumText, { color: '#4338CA' }]}>
                                  원본 P.{epNum}
                                </Text>
                              </View>
                            </View>
                            <Text style={styles.dragGripBadge}>⠿ 드래그 삽입</Text>
                          </TouchableOpacity>

                          {renderMiniSheet(ep, 0, 110)}

                          <TouchableOpacity
                            style={styles.externalSingleInsertBtn}
                            onPress={() =>
                              onMergePages(
                                [
                                  {
                                    ...ep,
                                    sourcePdfName: ep.sourcePdfName || activeExternalTitle,
                                  },
                                ],
                                activeExternalNote,
                                'append',
                                Math.min(pdfPages.length, externalInsertTargetIdx),
                                [epNum]
                              )
                            }
                          >
                            <Plus size={12} color="#4F46E5" />
                            <Text style={styles.externalSingleInsertText}>
                              이 페이지만 바로 넣기
                            </Text>
                          </TouchableOpacity>
                        </View>
                      );
                    })}
                  </ScrollView>
                </>
              )}
            </View>
          )}

          {/* 드래그 안내 배너 (드래그 중일 때 표시) */}
          {(draggingPageNum !== null || draggingExternalPage !== null) && (
            <View style={styles.dragActiveBanner}>
              <Text style={styles.dragActiveBannerText}>
                {draggingExternalPage
                  ? `🖐️ 다른 PDF의 P.${draggingExternalPage.pageNumber} 페이지를 드래그 중입니다 — 원하는 위치의 페이지 카드 위에 놓으면 그 자리에 즉시 삽입됩니다!`
                  : `🖐️ P.${draggingPageNum} 페이지를 드래그 중입니다 — 이동할 목표 위치의 페이지 카드를 클릭하거나 위에 놓으세요!`}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setDraggingPageNum(null);
                  setDraggingExternalPage(null);
                  setDragOverPageNum(null);
                }}
              >
                <Text style={{ color: '#1D4ED8', fontWeight: '800', fontSize: 12 }}>취소</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.pageCardsGrid}>
            {pdfPages.map((p, idx) => {
              const pNum = idx + 1;
              const rot = pageRotations[pNum] || 0;
              const strokeCnt = strokeCountsByPage[pNum] || 0;
              const isChecked = orgSelected.includes(pNum);
              const isBeingDragged = draggingPageNum === pNum;
              const isDropTarget =
                dragOverPageNum === pNum &&
                (draggingExternalPage !== null ||
                  (draggingPageNum !== null && draggingPageNum !== pNum));

              const webCardDragProps: any =
                Platform.OS === 'web'
                  ? {
                      draggable: true,
                      onDragStart: () => {
                        setDraggingExternalPage(null);
                        setDraggingPageNum(pNum);
                      },
                      onDragOver: (e: any) => {
                        e.preventDefault();
                        if (dragOverPageNum !== pNum) setDragOverPageNum(pNum);
                      },
                      onDragEnter: (e: any) => {
                        e.preventDefault();
                        setDragOverPageNum(pNum);
                      },
                      onDrop: (e: any) => {
                        e.preventDefault();
                        handleFinalizeDropOnPage(pNum);
                      },
                      onDragEnd: () => {
                        setDraggingPageNum(null);
                        setDragOverPageNum(null);
                      },
                      onMouseEnter: () => {
                        if (draggingPageNum !== null || draggingExternalPage !== null) {
                          setDragOverPageNum(pNum);
                        }
                      },
                      onMouseUp: () => {
                        if (
                          (draggingPageNum !== null && draggingPageNum !== pNum) ||
                          draggingExternalPage !== null
                        ) {
                          handleFinalizeDropOnPage(pNum);
                        }
                      },
                    }
                  : {};

              return (
                <View
                  key={p.id || pNum}
                  {...webCardDragProps}
                  style={[
                    styles.orgPageCard,
                    { width: thumbCardWidth },
                    isChecked && { borderColor: '#2563EB', borderWidth: 2 },
                    pNum === currentPage && !isChecked && { borderColor: '#93C5FD' },
                    isBeingDragged && { opacity: 0.55, borderColor: '#4F46E5', borderStyle: 'dashed' },
                    isDropTarget && {
                      borderColor: '#2563EB',
                      borderWidth: 2.5,
                      backgroundColor: '#EFF6FF',
                    },
                  ]}
                >
                  {isDropTarget && (
                    <View style={styles.dropTargetRibbon}>
                      <Text style={styles.dropTargetRibbonText}>
                        {draggingExternalPage
                          ? `📥 여기에 외부 P.${draggingExternalPage.pageNumber} 삽입`
                          : `📍 P.${draggingPageNum} → P.${pNum} 위치로 이동`}
                      </Text>
                    </View>
                  )}

                  <View style={styles.orgPagePreview}>
                    <View style={styles.orgPageTopRow}>
                      <TouchableOpacity
                        onPress={() => toggleOrgSelect(pNum)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}
                      >
                        {isChecked ? (
                          <CheckSquare size={16} color="#2563EB" />
                        ) : (
                          <Square size={16} color="#94A3B8" />
                        )}
                        <View style={styles.orgPageNumBadge}>
                          <Text style={styles.orgPageNumText}>P.{pNum}</Text>
                        </View>
                      </TouchableOpacity>

                      {/* 드래그 이동 핸들 (드래그하거나 클릭 후 목표 페이지 클릭으로도 위치 이동 가능) */}
                      <TouchableOpacity
                        style={[
                          styles.dragGripPill,
                          draggingPageNum === pNum && {
                            backgroundColor: '#DBEAFE',
                            borderColor: '#2563EB',
                          },
                        ]}
                        onPress={() => {
                          if (draggingExternalPage) {
                            handleFinalizeDropOnPage(pNum);
                          } else if (draggingPageNum === null) {
                            setDraggingPageNum(pNum);
                          } else if (draggingPageNum === pNum) {
                            setDraggingPageNum(null);
                          } else {
                            handleFinalizeDropOnPage(pNum);
                          }
                        }}
                      >
                        <Text
                          style={[
                            styles.dragGripBadge,
                            draggingPageNum === pNum && { color: '#1D4ED8' },
                          ]}
                        >
                          {draggingPageNum === pNum
                            ? '📍 이동 중'
                            : draggingPageNum !== null || draggingExternalPage !== null
                            ? `여기로 놓기`
                            : '⠿ 드래그 이동'}
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {p.sourcePdfName && (
                      <Text
                        style={[styles.orgSourceBadge, { maxWidth: '100%', marginBottom: 4 }]}
                        numberOfLines={1}
                      >
                        출처: {p.sourcePdfName}
                      </Text>
                    )}

                    <TouchableOpacity
                      onPress={() => {
                        if (draggingPageNum !== null || draggingExternalPage !== null) {
                          handleFinalizeDropOnPage(pNum);
                        } else {
                          onSelectPageAndAnnotate(pNum);
                        }
                      }}
                      activeOpacity={0.85}
                    >
                      {renderMiniSheet(p, rot, thumbSheetHeight)}
                      <View style={styles.orgPageFooterMeta}>
                        <Text style={styles.orgMetaText}>
                          필기 {strokeCnt}획 {rot ? `• ${rot}°` : ''}
                        </Text>
                        <Text style={styles.orgEditLink}>필기 열기 →</Text>
                      </View>
                    </TouchableOpacity>
                  </View>

                  {/* 페이지 제어 버튼 바 */}
                  <View style={styles.orgActionsBar}>
                    <TouchableOpacity
                      style={[styles.orgActionBtn, pNum === 1 && styles.orgActionBtnDisabled]}
                      disabled={pNum === 1}
                      onPress={() => onMovePage(pNum, pNum - 1)}
                    >
                      <ArrowLeft size={13} color={pNum === 1 ? '#CBD5E1' : '#334155'} />
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.orgActionBtn,
                        pNum === pdfPages.length && styles.orgActionBtnDisabled,
                      ]}
                      disabled={pNum === pdfPages.length}
                      onPress={() => onMovePage(pNum, pNum + 1)}
                    >
                      <ArrowRight
                        size={13}
                        color={pNum === pdfPages.length ? '#CBD5E1' : '#334155'}
                      />
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.orgActionBtn}
                      onPress={() => onRotatePage(pNum)}
                    >
                      <RotateCw size={13} color="#2563EB" />
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.orgActionBtn}
                      onPress={() => {
                        handleCopyPagesToClipboard([pNum]);
                        onDuplicatePage(pNum);
                      }}
                    >
                      <Copy size={13} color="#059669" />
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.orgActionBtn}
                      onPress={() => onInsertBlankPageAfter(pNum)}
                    >
                      <Plus size={13} color="#7C3AED" />
                    </TouchableOpacity>

                    {pdfPages.length > 1 && (
                      <TouchableOpacity
                        style={styles.orgActionBtn}
                        onPress={() => onDeletePage(pNum)}
                      >
                        <Trash2 size={13} color="#DC2626" />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* 2. PDF 병합 (Combine / Merge PDF) 모드 */}
      {mode === 'merge' && (
        <View style={styles.studioSection}>
          <View style={[styles.studioBanner, { backgroundColor: '#F3E8FF', borderColor: '#DDD6FE' }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.studioBannerTitle, { color: '#5B21B6' }]}>
                📑 Adobe 스타일 PDF 병합 & 특정 페이지 골라 넣기 (현재 {pdfPages.length}페이지)
              </Text>
              <Text style={[styles.studioBannerDesc, { color: '#6D28D9' }]}>
                다른 PDF 전체를 병합하거나 [페이지 골라서 넣기]를 눌러 원하는 페이지만 복사해 가져온 뒤, 페이지 구성 탭에서 드래그로 위치를 조정할 수 있습니다.
              </Text>
            </View>
          </View>

          {/* 병합 삽입 위치 선택 */}
          <View style={styles.mergePositionBar}>
            <Text style={styles.mergePosLabel}>병합할 페이지 삽입 위치:</Text>
            {(
              [
                { id: 'append', label: `맨 뒤에 이어 붙이기 (P.${pdfPages.length} 뒤)` },
                { id: 'after_current', label: `현재 페이지(P.${currentPage}) 뒤에 삽입` },
                { id: 'prepend', label: '맨 앞(P.1 앞)에 삽입' },
              ] as const
            ).map((pos) => (
              <TouchableOpacity
                key={pos.id}
                style={[
                  styles.mergePosChip,
                  mergePosition === pos.id && styles.mergePosChipActive,
                ]}
                onPress={() => setMergePosition(pos.id)}
              >
                <Text
                  style={[
                    styles.mergePosChipText,
                    mergePosition === pos.id && styles.mergePosChipTextActive,
                  ]}
                >
                  {pos.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* 병합 소스 1: 내 기기에서 외부 PDF 파일 업로드하여 합치기 */}
          <TouchableOpacity
            style={styles.mergeUploadBox}
            onPress={handleUploadPdfToMerge}
            activeOpacity={0.85}
          >
            <View style={styles.mergeUploadIcon}>
              <Upload size={22} color="#7C3AED" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.mergeUploadTitle}>
                {isMergeLoading
                  ? '⏳ PDF 원본 페이지를 렌더링하여 병합하는 중...'
                  : '+ 내 PC/기기에서 다른 PDF 파일 선택하여 현재 문서에 병합'}
              </Text>
              <Text style={styles.mergeUploadSub}>
                하나 또는 여러 개의 .pdf 파일을 선택하면 위에서 지정한 위치에 즉시 병합됩니다.
              </Text>
            </View>
            <View style={styles.mergeUploadActionPill}>
              <Text style={styles.mergeUploadActionText}>파일 선택</Text>
            </View>
          </TouchableOpacity>

          {/* 병합 소스 2: 앱 내 다른 PDF / 메모 문서 선택하여 합치기 (전체 병합 또는 원하는 페이지만 선택 병합) */}
          <Text style={styles.subSectionHeading}>
            📚 앱 내 보관함에서 병합할 문서 또는 특정 페이지 선택 ({mergeableNotes.length}개)
          </Text>
          <View style={styles.mergeNotesList}>
            {mergeableNotes.map((n) => {
              const extracted = extractPdfPagesFromNote(n);
              const isPdf = n.noteType === 'pdf' || Boolean(n.pdfName);
              const isExpanded = expandedMergeNoteId === n.id;
              const selectedPagesForNote =
                selectedMergePageMap[n.id] || extracted.map((_, idx) => idx + 1);

              return (
                <View key={n.id} style={[styles.mergeNoteCard, { flexDirection: 'column', alignItems: 'stretch' }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <View
                      style={[
                        styles.mergeNoteBadge,
                        { backgroundColor: isPdf ? '#EFF6FF' : '#FEF3C7' },
                      ]}
                    >
                      <FileText size={16} color={isPdf ? '#2563EB' : '#D97706'} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.mergeNoteTitle} numberOfLines={1}>
                        {n.title || n.pdfName || '제목 없음'}
                      </Text>
                      <Text style={styles.mergeNoteMeta}>
                        {isPdf ? 'PDF 문서' : '노트 메모'} • {extracted.length}페이지 분량 • 필기{' '}
                        {(n.strokes || []).length}획 포함
                      </Text>
                    </View>

                    <TouchableOpacity
                      style={styles.mergeSelectPagesBtn}
                      onPress={() => {
                        if (isExpanded) {
                          setExpandedMergeNoteId(null);
                        } else {
                          setExpandedMergeNoteId(n.id);
                          if (!selectedMergePageMap[n.id]) {
                            setSelectedMergePageMap((prev) => ({
                              ...prev,
                              [n.id]: extracted.map((_, idx) => idx + 1),
                            }));
                          }
                        }
                      }}
                    >
                      <Text style={styles.mergeSelectPagesBtnText}>
                        {isExpanded ? '접기 ▲' : '🔍 페이지 골라서 넣기'}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.mergeExecBtn}
                      onPress={() => onMergePages(extracted, n, mergePosition)}
                    >
                      <Combine size={14} color="#FFFFFF" />
                      <Text style={styles.mergeExecBtnText}>전체 병합 ({extracted.length}장)</Text>
                    </TouchableOpacity>
                  </View>

                  {isExpanded && (
                    <View style={styles.mergeExpandedBox}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                        <Text style={styles.batchCountText}>
                          가져올 페이지를 클릭하여 선택하세요 ({selectedPagesForNote.length} / {extracted.length}장 선택됨)
                        </Text>
                        <TouchableOpacity
                          style={[
                            styles.mergeExecBtn,
                            selectedPagesForNote.length === 0 && styles.batchDisabled,
                          ]}
                          disabled={selectedPagesForNote.length === 0}
                          onPress={() => {
                            const sorted = [...selectedPagesForNote].sort((a, b) => a - b);
                            const chosen = sorted.map((num) => extracted[num - 1]).filter(Boolean);
                            onMergePages(chosen, n, mergePosition, undefined, sorted);
                          }}
                        >
                          <Plus size={14} color="#FFFFFF" />
                          <Text style={styles.mergeExecBtnText}>
                            선택한 {selectedPagesForNote.length}장만 현재 PDF에 넣기
                          </Text>
                        </TouchableOpacity>
                      </View>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
                        {extracted.map((ep, idx) => {
                          const pNum = idx + 1;
                          const isSel = selectedPagesForNote.includes(pNum);
                          return (
                            <TouchableOpacity
                              key={ep.id || pNum}
                              style={[
                                styles.externalPageCard,
                                isSel && { borderColor: '#7C3AED', borderWidth: 2 },
                              ]}
                              onPress={() => {
                                setSelectedMergePageMap((prev) => {
                                  const cur = prev[n.id] || extracted.map((_, i) => i + 1);
                                  const next = cur.includes(pNum)
                                    ? cur.filter((x) => x !== pNum)
                                    : [...cur, pNum].sort((a, b) => a - b);
                                  return { ...prev, [n.id]: next };
                                });
                              }}
                            >
                              <View style={styles.orgPageTopRow}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                  {isSel ? (
                                    <CheckSquare size={14} color="#7C3AED" />
                                  ) : (
                                    <Square size={14} color="#94A3B8" />
                                  )}
                                  <Text style={{ fontSize: 11.5, fontWeight: '800', color: '#5B21B6' }}>
                                    P.{pNum}
                                  </Text>
                                </View>
                              </View>
                              {renderMiniSheet(ep, 0, 96)}
                            </TouchableOpacity>
                          );
                        })}
                      </ScrollView>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* 3. PDF 분할 및 추출 (Split / Extract PDF) 모드 */}
      {mode === 'split' && (
        <View style={styles.studioSection}>
          <View style={[styles.studioBanner, { backgroundColor: '#FEF2F2', borderColor: '#FECACA' }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.studioBannerTitle, { color: '#991B1B' }]}>
                ✂️ Adobe 스타일 PDF 분할 및 페이지 추출 (총 {pdfPages.length}페이지 중{' '}
                {selectedSplitPages.length}장 선택됨)
              </Text>
              <Text style={[styles.studioBannerDesc, { color: '#B91C1C' }]}>
                분할하거나 추출할 페이지를 아래에서 클릭하여 선택(또는 범위 입력)한 뒤, 새 PDF 문서로 추출하거나 원본에서 분리하세요.
              </Text>
            </View>
          </View>

          {/* 분할 모드 전환: 선택/범위 분할 vs 매 N페이지마다 자동 일괄 분할 */}
          <View style={styles.splitModeSwitch}>
            {(
              [
                { id: 'select', label: '✂️ 선택 / 범위 분할' },
                { id: 'every-n', label: '📚 매 N페이지마다 자동 일괄 분할' },
              ] as const
            ).map((m) => (
              <TouchableOpacity
                key={m.id}
                style={[styles.splitModeBtn, splitMode === m.id && styles.splitModeBtnActive]}
                onPress={() => setSplitMode(m.id)}
              >
                <Text
                  style={[styles.splitModeText, splitMode === m.id && styles.splitModeTextActive]}
                >
                  {m.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {splitMode === 'every-n' && (
            <View style={styles.splitConfigCard}>
              <Text style={styles.mergePosLabel}>몇 페이지씩 나눌까요?</Text>
              <View style={styles.splitQuickRow}>
                {[1, 2, 3, 5, 10].map((n) => (
                  <TouchableOpacity
                    key={n}
                    style={[
                      styles.splitQuickChip,
                      splitChunkSize === n && !splitChunkInput && styles.splitQuickChipActive,
                    ]}
                    onPress={() => {
                      setSplitChunkSize(n);
                      setSplitChunkInput('');
                    }}
                  >
                    <Text style={styles.splitQuickChipText}>{n}장씩</Text>
                  </TouchableOpacity>
                ))}
                <TextInput
                  style={[styles.titleInput, { width: 110 }]}
                  value={splitChunkInput}
                  onChangeText={(v) => {
                    const clean = v.replace(/[^0-9]/g, '');
                    setSplitChunkInput(clean);
                    const num = parseInt(clean, 10);
                    if (!isNaN(num) && num >= 1) setSplitChunkSize(num);
                  }}
                  placeholder="직접 입력"
                  placeholderTextColor="#94A3B8"
                  keyboardType="numeric"
                />
              </View>

              {(() => {
                const size = Math.max(1, Math.min(pdfPages.length, splitChunkSize));
                const chunkCount = Math.ceil(pdfPages.length / size);
                const ranges = Array.from({ length: chunkCount }).map((_, i) => {
                  const s = i * size + 1;
                  const e = Math.min(pdfPages.length, (i + 1) * size);
                  return s === e ? `P.${s}` : `P.${s}~${e}`;
                });
                return (
                  <>
                    <Text style={styles.splitPreviewText}>
                      총 {pdfPages.length}페이지 → <Text style={{ fontWeight: '900' }}>{chunkCount}개</Text>의 PDF 문서로 분할됩니다:
                    </Text>
                    <View style={styles.splitQuickRow}>
                      {ranges.slice(0, 24).map((r, i) => (
                        <View key={r} style={styles.splitRangePill}>
                          <Text style={styles.splitRangePillText}>
                            #{i + 1} {r}
                          </Text>
                        </View>
                      ))}
                      {ranges.length > 24 && (
                        <Text style={styles.splitPreviewText}>... 외 {ranges.length - 24}개</Text>
                      )}
                    </View>
                    <TouchableOpacity
                      style={[styles.splitExtractBtn, chunkCount < 2 && { opacity: 0.4 }]}
                      disabled={chunkCount < 2 || !onSplitEveryNPages}
                      onPress={() =>
                        onSplitEveryNPages?.(size, title.replace(/\.pdf$/i, '') || '분할문서')
                      }
                    >
                      <Scissors size={15} color="#FFFFFF" />
                      <Text style={styles.splitExtractBtnText}>
                        {chunkCount}개의 새 PDF 메모로 한 번에 일괄 분할 (원본 유지)
                      </Text>
                    </TouchableOpacity>
                  </>
                );
              })()}
            </View>
          )}

          {splitMode === 'select' && (
          <>
          {/* 분할 범위 빠른 선택 & 새 문서 제목 입력 바 */}
          <View style={styles.splitConfigCard}>
            <View style={styles.splitQuickRow}>
              <Text style={styles.mergePosLabel}>빠른 페이지 선택:</Text>
              <TouchableOpacity
                style={styles.splitQuickChip}
                onPress={() => {
                  const all = pdfPages.map((_, i) => i + 1);
                  setSelectedSplitPages(all);
                  setSplitRangeInput(`1-${pdfPages.length}`);
                }}
              >
                <Text style={styles.splitQuickChipText}>전체 선택</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.splitQuickChip}
                onPress={() => {
                  const half = Math.max(1, Math.ceil(pdfPages.length / 2));
                  const firstHalf = Array.from({ length: half }).map((_, i) => i + 1);
                  setSelectedSplitPages(firstHalf);
                  setSplitRangeInput(`1-${half}`);
                }}
              >
                <Text style={styles.splitQuickChipText}>
                  전반부 (1~{Math.max(1, Math.ceil(pdfPages.length / 2))})
                </Text>
              </TouchableOpacity>
              {pdfPages.length >= 2 && (
                <TouchableOpacity
                  style={styles.splitQuickChip}
                  onPress={() => {
                    const half = Math.ceil(pdfPages.length / 2);
                    const secondHalf = Array.from({ length: pdfPages.length - half }).map(
                      (_, i) => half + 1 + i
                    );
                    setSelectedSplitPages(secondHalf);
                    setSplitRangeInput(`${half + 1}-${pdfPages.length}`);
                  }}
                >
                  <Text style={styles.splitQuickChipText}>
                    후반부 ({Math.ceil(pdfPages.length / 2) + 1}~{pdfPages.length})
                  </Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={styles.splitQuickChip}
                onPress={() => {
                  const odds = pdfPages.map((_, i) => i + 1).filter((n) => n % 2 === 1);
                  setSelectedSplitPages(odds);
                  setSplitRangeInput(odds.join(', '));
                }}
              >
                <Text style={styles.splitQuickChipText}>홀수 페이지</Text>
              </TouchableOpacity>
              {pdfPages.length >= 2 && (
                <TouchableOpacity
                  style={styles.splitQuickChip}
                  onPress={() => {
                    const evens = pdfPages.map((_, i) => i + 1).filter((n) => n % 2 === 0);
                    setSelectedSplitPages(evens);
                    setSplitRangeInput(evens.join(', '));
                  }}
                >
                  <Text style={styles.splitQuickChipText}>짝수 페이지</Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.splitInputsRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>페이지 범위 직접 입력 (예: 1-2, 4)</Text>
                <TextInput
                  style={styles.titleInput}
                  value={splitRangeInput}
                  onChangeText={applyRangeString}
                  placeholder="예: 1-2, 3"
                  placeholderTextColor="#94A3B8"
                />
              </View>
              <View style={{ flex: 1.5 }}>
                <Text style={styles.inputLabel}>생성될 분할 PDF 문서 제목</Text>
                <TextInput
                  style={styles.titleInput}
                  value={splitNewTitle}
                  onChangeText={setSplitNewTitle}
                  placeholder="분할된 새 PDF 문서 제목.pdf"
                  placeholderTextColor="#94A3B8"
                />
              </View>
            </View>

            <View style={styles.splitExecRow}>
              <TouchableOpacity
                style={[
                  styles.splitExtractBtn,
                  selectedSplitPages.length === 0 && { opacity: 0.4 },
                ]}
                disabled={selectedSplitPages.length === 0}
                onPress={() =>
                  onSplitPages(
                    selectedSplitPages,
                    false,
                    splitNewTitle.trim() || `${title.replace(/\.pdf$/i, '')}_추출.pdf`
                  )
                }
              >
                <Copy size={15} color="#FFFFFF" />
                <Text style={styles.splitExtractBtnText}>
                  선택 페이지({selectedSplitPages.length}장)를 새 PDF 메모로 추출 저장 (원본 유지)
                </Text>
              </TouchableOpacity>

              {pdfPages.length > 1 &&
                selectedSplitPages.length > 0 &&
                selectedSplitPages.length < pdfPages.length && (
                  <TouchableOpacity
                    style={styles.splitSeparateBtn}
                    onPress={() =>
                      onSplitPages(
                        selectedSplitPages,
                        true,
                        splitNewTitle.trim() || `${title.replace(/\.pdf$/i, '')}_분할.pdf`
                      )
                    }
                  >
                    <Scissors size={15} color="#FFFFFF" />
                    <Text style={styles.splitExtractBtnText}>
                      원본에서 분리하여 2개의 PDF로 분할 ({selectedSplitPages.length}장 분리 /{' '}
                      {pdfPages.length - selectedSplitPages.length}장 잔류)
                    </Text>
                  </TouchableOpacity>
                )}
            </View>
          </View>

          {/* 분할 페이지 시각적 선택 그리드 */}
          <View style={styles.pageCardsGrid}>
            {pdfPages.map((p, idx) => {
              const pNum = idx + 1;
              const isSelected = selectedSplitPages.includes(pNum);
              return (
                <TouchableOpacity
                  key={p.id || pNum}
                  style={[
                    styles.orgPageCard,
                    isSelected && {
                      borderColor: '#DC2626',
                      borderWidth: 2,
                      backgroundColor: '#FEF2F2',
                    },
                  ]}
                  onPress={() => toggleSplitPage(pNum)}
                  activeOpacity={0.85}
                >
                  <View style={styles.orgPagePreview}>
                    <View style={styles.orgPageTopRow}>
                      <View
                        style={[
                          styles.orgPageNumBadge,
                          isSelected && { backgroundColor: '#DC2626' },
                        ]}
                      >
                        <Text
                          style={[
                            styles.orgPageNumText,
                            isSelected && { color: '#FFFFFF' },
                          ]}
                        >
                          {isSelected ? '✓ ' : ''}P.{pNum}
                        </Text>
                      </View>
                      <Text
                        style={{
                          fontSize: 11,
                          fontWeight: '700',
                          color: isSelected ? '#DC2626' : '#64748B',
                        }}
                      >
                        {isSelected ? '분할 대상 선택됨' : '클릭하여 선택'}
                      </Text>
                    </View>

                    {renderMiniSheet(p, pageRotations[pNum] || 0, 170)}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
          </>
          )}
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  launcherContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  launcherHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  backBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
  },
  headerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  headerBadgeText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#DC2626',
  },
  launcherScroll: {
    padding: 24,
    maxWidth: 1020,
    width: '100%',
    alignSelf: 'center',
    gap: 16,
  },
  heroBox: {
    marginBottom: 4,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 6,
  },
  heroSubtitle: {
    fontSize: 13.5,
    color: '#64748B',
    lineHeight: 20,
  },
  stepHeading: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1E293B',
    marginTop: 6,
  },
  modeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  modeCard: {
    flex: 1,
    minWidth: 210,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  modeIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeCardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 2,
  },
  modeCardDesc: {
    fontSize: 11.5,
    color: '#64748B',
    lineHeight: 16,
  },
  modeCheckBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sourceCardsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  uploadDropCard: {
    flex: 1.1,
    minWidth: 300,
    backgroundColor: '#EFF6FF',
    borderRadius: 16,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#60A5FA',
    padding: 22,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  uploadIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadCardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1E3A8A',
    textAlign: 'center',
  },
  uploadCardSub: {
    fontSize: 12.5,
    color: '#3B82F6',
    textAlign: 'center',
    lineHeight: 18,
  },
  uploadPrimaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#2563EB',
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 10,
    marginTop: 6,
  },
  uploadPrimaryBtnText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '700',
  },
  newBlankPdfCard: {
    flex: 1,
    minWidth: 290,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 18,
    gap: 10,
  },
  newBlankHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  newBlankTitle: {
    fontSize: 15.5,
    fontWeight: '800',
    color: '#0F172A',
  },
  newBlankDesc: {
    fontSize: 12,
    color: '#64748B',
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 4,
  },
  titleInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13.5,
    color: '#0F172A',
  },
  pageCountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  pageCountChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  pageCountChipActive: {
    backgroundColor: '#ECFDF5',
    borderColor: '#10B981',
  },
  pageCountChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  pageCountChipTextActive: {
    color: '#059669',
    fontWeight: '800',
  },
  createBlankBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#059669',
    paddingVertical: 11,
    borderRadius: 10,
    marginTop: 4,
  },
  createBlankBtnText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '700',
  },
  existingSection: {
    marginTop: 8,
    gap: 10,
  },
  existingList: {
    gap: 8,
  },
  existingPdfRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  existingPdfIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  existingPdfTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  existingPdfMeta: {
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 2,
  },
  existingOpenPill: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  existingOpenPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2563EB',
  },
  // Studio Panel Styles
  studioScroll: {
    flex: 1,
    backgroundColor: '#F1F5F9',
  },
  studioContent: {
    padding: 20,
    maxWidth: 1100,
    width: '100%',
    alignSelf: 'center',
  },
  studioSection: {
    gap: 16,
  },
  studioBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 14,
    padding: 16,
    gap: 12,
    flexWrap: 'wrap',
  },
  studioBannerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#065F46',
    marginBottom: 4,
  },
  studioBannerDesc: {
    fontSize: 12.5,
    color: '#047857',
    lineHeight: 18,
  },
  bannerAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#059669',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
  },
  bannerAddBtnText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '700',
  },
  pageCardsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  orgPageCard: {
    width: 235,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    overflow: 'hidden',
  },
  orgPagePreview: {
    padding: 12,
    gap: 8,
  },
  orgPageTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  orgPageNumBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  orgPageNumText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#1D4ED8',
  },
  orgSourceBadge: {
    flex: 1,
    fontSize: 10,
    color: '#64748B',
    textAlign: 'right',
  },
  orgMiniSheet: {
    height: 170,
    backgroundColor: '#FAFAFA',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    padding: 10,
    gap: 4,
  },
  orgMiniTitle: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#0F172A',
  },
  orgMiniSub: {
    fontSize: 9.5,
    color: '#2563EB',
    fontWeight: '600',
  },
  orgMiniDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 3,
  },
  orgMiniContent: {
    fontSize: 9.5,
    color: '#475569',
    lineHeight: 14,
  },
  orgPageFooterMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  orgMetaText: {
    fontSize: 10.5,
    color: '#64748B',
    fontWeight: '600',
  },
  orgEditLink: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2563EB',
  },
  orgActionsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: '#F8FAFC',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingVertical: 7,
    paddingHorizontal: 6,
  },
  orgActionBtn: {
    padding: 5,
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  orgActionBtnDisabled: {
    opacity: 0.4,
  },
  mergePositionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    backgroundColor: '#FFFFFF',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  mergePosLabel: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#334155',
    marginRight: 4,
  },
  mergePosChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  mergePosChipActive: {
    backgroundColor: '#F3E8FF',
    borderColor: '#7C3AED',
  },
  mergePosChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  mergePosChipTextActive: {
    color: '#6D28D9',
    fontWeight: '800',
  },
  mergeUploadBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#A78BFA',
    borderRadius: 14,
    padding: 16,
  },
  mergeUploadIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#F3E8FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mergeUploadTitle: {
    fontSize: 14.5,
    fontWeight: '800',
    color: '#4C1D95',
  },
  mergeUploadSub: {
    fontSize: 12,
    color: '#6D28D9',
    marginTop: 2,
  },
  mergeUploadActionPill: {
    backgroundColor: '#7C3AED',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  mergeUploadActionText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '700',
  },
  subSectionHeading: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1E293B',
    marginTop: 4,
  },
  mergeNotesList: {
    gap: 10,
  },
  mergeNoteCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  mergeNoteBadge: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mergeNoteTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#0F172A',
  },
  mergeNoteMeta: {
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 2,
  },
  mergeExecBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#7C3AED',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  mergeExecBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  splitConfigCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    gap: 14,
  },
  splitQuickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  splitQuickChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  splitQuickChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  splitInputsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  splitExecRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  splitExtractBtn: {
    flex: 1,
    minWidth: 260,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#2563EB',
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  splitSeparateBtn: {
    flex: 1,
    minWidth: 260,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#DC2626',
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  splitExtractBtnText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '700',
  },
  uploadOrDivider: {
    width: '80%',
    height: 1,
    backgroundColor: '#BFDBFE',
    marginVertical: 4,
  },
  uploadImagesBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#C4B5FD',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
  },
  uploadImagesBtnText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#6D28D9',
  },
  batchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 10,
  },
  batchChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  batchChipActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#2563EB',
  },
  batchChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  batchCountText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  batchActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  batchActionText: {
    fontSize: 12,
    fontWeight: '800',
  },
  batchDisabled: {
    opacity: 0.4,
  },
  splitModeSwitch: {
    flexDirection: 'row',
    gap: 6,
    backgroundColor: '#FFFFFF',
    padding: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  splitModeBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 9,
    borderRadius: 9,
  },
  splitModeBtnActive: {
    backgroundColor: '#DC2626',
  },
  splitModeText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#475569',
  },
  splitModeTextActive: {
    color: '#FFFFFF',
  },
  splitQuickChipActive: {
    backgroundColor: '#FEE2E2',
    borderColor: '#DC2626',
  },
  splitPreviewText: {
    fontSize: 12.5,
    color: '#334155',
    fontWeight: '600',
  },
  splitRangePill: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 7,
  },
  splitRangePillText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#B91C1C',
  },
  bannerImportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#6366F1',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  externalTrayCard: {
    backgroundColor: '#EEF2FF',
    borderWidth: 1.5,
    borderColor: '#C7D2FE',
    borderRadius: 14,
    padding: 14,
    gap: 10,
  },
  externalTrayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  externalTrayTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#312E81',
  },
  externalTraySub: {
    fontSize: 12,
    color: '#4338CA',
    marginTop: 2,
  },
  externalUploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#A5B4FC',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  externalUploadBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#4F46E5',
  },
  externalDocChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 9,
  },
  externalDocChipActive: {
    backgroundColor: '#4F46E5',
    borderColor: '#4F46E5',
  },
  externalDocChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    maxWidth: 220,
  },
  externalInsertBar: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    backgroundColor: '#FFFFFF',
    padding: 9,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E0E7FF',
  },
  externalInsertExecBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#4F46E5',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  externalInsertExecText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  externalPageCard: {
    width: 175,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    padding: 9,
    gap: 6,
  },
  externalSingleInsertBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#C7D2FE',
    paddingVertical: 5,
    borderRadius: 7,
  },
  externalSingleInsertText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#4338CA',
  },
  dragGripPill: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  dragGripBadge: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#475569',
  },
  dragActiveBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#EFF6FF',
    borderWidth: 1.5,
    borderColor: '#60A5FA',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  dragActiveBannerText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#1E40AF',
  },
  dropTargetRibbon: {
    backgroundColor: '#2563EB',
    paddingVertical: 4,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  dropTargetRibbonText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  mergeSelectPagesBtn: {
    backgroundColor: '#F3E8FF',
    borderWidth: 1,
    borderColor: '#C4B5FD',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  mergeSelectPagesBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#6D28D9',
  },
  mergeExpandedBox: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
});
