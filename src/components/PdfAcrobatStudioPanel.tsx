import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
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
} from 'lucide-react-native';
import { Note, PdfPageData, PaperTemplate } from '../types/note';
import { SAMPLE_DOCUMENTS } from '../constants/sampleDocuments';

export type PdfWorkspaceTab = 'annotate' | 'organize' | 'merge' | 'split';

/**
 * 업로드된 실제 PDF 파일(ArrayBuffer)에서 페이지 수(/Type /Page) 및 메타 정보를 추출하여
 * PdfPageData 배열로 변환합니다.
 */
export async function parseUploadedPdfFile(file: File): Promise<{
  fileName: string;
  pages: PdfPageData[];
}> {
  const fileName = file.name || '업로드_문서.pdf';
  const cleanTitle = fileName.replace(/\.pdf$/i, '');
  const fileSizeKb = Math.max(1, Math.round((file.size || 10240) / 1024));

  let detectedPageCount = 3;
  const extractedSnippets: string[] = [];

  try {
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    // PDF 바이트 스트림에서 /Type /Page 패턴으로 실제 페이지 수 추정 (최대 30페이지 제한)
    const latin = new TextDecoder('latin1').decode(bytes.slice(0, Math.min(bytes.length, 1500000)));
    const pageMatches = latin.match(/\/Type\s*\/Page\b(?!s)/g);
    if (pageMatches && pageMatches.length > 0) {
      detectedPageCount = Math.max(1, Math.min(20, pageMatches.length));
    }

    // 괄호 안의 텍스트 리터럴 중 읽을 수 있는 문구 일부 추출 시도
    const textMatches = latin.match(/\(([^()]{4,120})\)/g);
    if (textMatches && textMatches.length > 0) {
      for (const raw of textMatches) {
        const inner = raw.slice(1, -1).replace(/\\[nrt]/g, ' ').trim();
        if (/^[A-Za-z0-9가-힣\s.,:;!?()\-_/]+$/.test(inner) && inner.length >= 6) {
          extractedSnippets.push(inner);
          if (extractedSnippets.length >= detectedPageCount * 3) break;
        }
      }
    }
  } catch {
    detectedPageCount = 3;
  }

  const nowStr = new Date().toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const pages: PdfPageData[] = Array.from({ length: detectedPageCount }).map((_, idx) => {
    const pNum = idx + 1;
    const snippetGroup = extractedSnippets.slice(idx * 3, idx * 3 + 3);
    const bodyText =
      snippetGroup.length > 0
        ? `[원본 PDF 파일 정보]\n• 파일명: ${fileName} (${fileSizeKb} KB)\n• 페이지: ${pNum} / ${detectedPageCount} 페이지\n• 불러온 날짜: ${nowStr}\n\n[추출된 문서 텍스트]\n${snippetGroup.join('\n')}\n\n이 페이지 위에 만년필·형광펜 필기, 도형, 텍스트 상자, 음성 녹음 핀을 자유롭게 추가하거나 상단 [페이지 구성 / 병합 / 분할] 탭에서 페이지를 편집할 수 있습니다.`
        : `[원본 PDF 문서 시트]\n• 파일명: ${fileName} (${fileSizeKb} KB)\n• 페이지: ${pNum} / ${detectedPageCount} 페이지\n• 불러온 날짜: ${nowStr}\n\n이 문서는 내 기기에서 불러온 PDF 문서의 ${pNum}번째 페이지입니다.\n하단 필기 도구(만년필, 형광펜, 도형, 텍스트 상자, 레이저 포인터)로 주석을 작성하거나, 상단 Adobe PDF 도구 바에서 [페이지 구성], [다른 PDF와 병합], [원하는 페이지 분할 추출]을 수행할 수 있습니다.`;

    return {
      id: `pdfp_${Date.now()}_${pNum}_${Math.random().toString(36).substring(2, 6)}`,
      pageNumber: pNum,
      title: `${cleanTitle} — Page ${pNum}`,
      subtitle: `${fileName} (${pNum}/${detectedPageCount} 페이지 • ${fileSizeKb} KB)`,
      content: bodyText,
      sourcePdfName: fileName,
    };
  });

  return { fileName, pages };
}

/**
 * 기존 Note 객체로부터 병합/열기용 PdfPageData 배열을 추출합니다.
 */
export function extractPdfPagesFromNote(note: Note): PdfPageData[] {
  if (note.pdfPages && note.pdfPages.length > 0) {
    return note.pdfPages.map((p, idx) => ({
      ...p,
      id: `pdfp_${Date.now()}_${idx + 1}_${Math.random().toString(36).substring(2, 6)}`,
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
  onOpenUploadedPdf: (fileName: string, pages: PdfPageData[], initialTab: PdfWorkspaceTab) => void;
  onCreateBlankPdf: (title: string, pageCount: number, template: PaperTemplate, initialTab: PdfWorkspaceTab) => void;
  onSelectExistingNote: (note: Note, initialTab: PdfWorkspaceTab) => void;
  onCancel: () => void;
}

/**
 * 새 메모 -> PDF 문서 열기 클릭 시 나타나는 Adobe Acrobat 스타일 PDF 시작 & 파일 열기 허브
 * (기존 샘플 문서가 멋대로 열리는 대신, 파일 열기 / 새 빈 PDF / 기존 문서 선택 및 편집·병합·분할 모드를 직접 선택)
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

  const handleTriggerFileUpload = () => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'application/pdf,.pdf';
      input.multiple = selectedActionTab === 'merge';
      input.onchange = async (e: any) => {
        const files: FileList | undefined = e.target?.files;
        if (!files || files.length === 0) return;
        setIsLoadingFile(true);
        try {
          let combinedPages: PdfPageData[] = [];
          let primaryName = files[0].name;
          for (let i = 0; i < files.length; i++) {
            const parsed = await parseUploadedPdfFile(files[i]);
            combinedPages = [...combinedPages, ...parsed.pages];
          }
          const reindexed = combinedPages.map((p, idx) => ({
            ...p,
            pageNumber: idx + 1,
          }));
          if (files.length > 1) {
            primaryName = `${files[0].name.replace(/\.pdf$/i, '')}_외_${files.length - 1}건_병합.pdf`;
          }
          onOpenUploadedPdf(primaryName, reindexed, selectedActionTab);
        } finally {
          setIsLoadingFile(false);
        }
      };
      input.click();
    } else {
      // 모바일 네이티브 환경 폴백: 새 문서 즉시 생성
      onCreateBlankPdf(newPdfTitle, newPdfPagesCount, newPdfTemplate, selectedActionTab);
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
          {/* 내 기기에서 PDF 파일 열기 */}
          <TouchableOpacity
            style={styles.uploadDropCard}
            onPress={handleTriggerFileUpload}
            activeOpacity={0.85}
          >
            <View style={styles.uploadIconCircle}>
              <Upload size={28} color="#2563EB" />
            </View>
            <Text style={styles.uploadCardTitle}>
              {isLoadingFile
                ? 'PDF 문서 분석 및 불러오는 중...'
                : selectedActionTab === 'merge'
                ? '내 PC/기기에서 병합할 PDF 파일 선택 (다중 선택 가능)'
                : '내 PC/기기에서 PDF 파일 불러오기 (.pdf)'}
            </Text>
            <Text style={styles.uploadCardSub}>
              클릭하여 로컬 저장소의 PDF 문서를 선택하면 선택한 [{ACTION_MODES.find((a) => a.id === selectedActionTab)?.label}] 모드로 즉시 열립니다.
            </Text>
            <View style={styles.uploadPrimaryBtn}>
              <FolderPlus size={16} color="#FFFFFF" />
              <Text style={styles.uploadPrimaryBtnText}>내 파일 탐색기에서 PDF 열기</Text>
            </View>
          </TouchableOpacity>

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
    position: 'append' | 'prepend' | 'after_current'
  ) => void;
  onSplitPages: (selectedPageNums: number[], removeOriginalPages: boolean, newDocTitle: string) => void;
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
}) => {
  // 병합(Merge) 상태
  const [mergePosition, setMergePosition] = useState<'append' | 'prepend' | 'after_current'>('append');

  // 분할(Split) 상태
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

  const handleUploadPdfToMerge = () => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'application/pdf,.pdf';
      input.multiple = true;
      input.onchange = async (e: any) => {
        const files: FileList | undefined = e.target?.files;
        if (!files || files.length === 0) return;
        let incoming: PdfPageData[] = [];
        for (let i = 0; i < files.length; i++) {
          const parsed = await parseUploadedPdfFile(files[i]);
          incoming = [...incoming, ...parsed.pages];
        }
        if (incoming.length > 0) {
          onMergePages(incoming, null, mergePosition);
        }
      };
      input.click();
    }
  };

  const mergeableNotes = allNotes.filter((n) => !n.isDeleted && n.id !== currentNoteId);

  return (
    <ScrollView style={styles.studioScroll} contentContainerStyle={styles.studioContent}>
      {/* 1. 페이지 구성 (Organize Pages) 모드 */}
      {mode === 'organize' && (
        <View style={styles.studioSection}>
          <View style={styles.studioBanner}>
            <View style={{ flex: 1 }}>
              <Text style={styles.studioBannerTitle}>
                🗂️ 페이지 구성 및 정렬 (총 {pdfPages.length}페이지)
              </Text>
              <Text style={styles.studioBannerDesc}>
                각 페이지의 순서를 앞뒤로 이동하거나 90° 회전, 복제, 새 페이지 삽입 및 삭제를 수행할 수 있습니다. 페이지를 클릭하면 필기 편집 화면으로 이동합니다.
              </Text>
            </View>
            <TouchableOpacity
              style={styles.bannerAddBtn}
              onPress={() => onInsertBlankPageAfter(pdfPages.length)}
            >
              <Plus size={15} color="#FFFFFF" />
              <Text style={styles.bannerAddBtnText}>맨 뒤에 페이지 추가</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.pageCardsGrid}>
            {pdfPages.map((p, idx) => {
              const pNum = idx + 1;
              const rot = pageRotations[pNum] || 0;
              const strokeCnt = strokeCountsByPage[pNum] || 0;
              return (
                <View key={p.id || pNum} style={styles.orgPageCard}>
                  <TouchableOpacity
                    style={styles.orgPagePreview}
                    onPress={() => onSelectPageAndAnnotate(pNum)}
                    activeOpacity={0.85}
                  >
                    <View style={styles.orgPageTopRow}>
                      <View style={styles.orgPageNumBadge}>
                        <Text style={styles.orgPageNumText}>P.{pNum}</Text>
                      </View>
                      {p.sourcePdfName && (
                        <Text style={styles.orgSourceBadge} numberOfLines={1}>
                          {p.sourcePdfName}
                        </Text>
                      )}
                    </View>
                    <View
                      style={[
                        styles.orgMiniSheet,
                        rot ? { transform: [{ rotate: `${rot}deg` }] } : undefined,
                      ]}
                    >
                      <Text style={styles.orgMiniTitle} numberOfLines={2}>
                        {p.title}
                      </Text>
                      {p.subtitle ? (
                        <Text style={styles.orgMiniSub} numberOfLines={1}>
                          {p.subtitle}
                        </Text>
                      ) : null}
                      <View style={styles.orgMiniDivider} />
                      <Text style={styles.orgMiniContent} numberOfLines={4}>
                        {p.content}
                      </Text>
                    </View>
                    <View style={styles.orgPageFooterMeta}>
                      <Text style={styles.orgMetaText}>
                        필기 {strokeCnt}획 {rot ? `• ${rot}° 회전됨` : ''}
                      </Text>
                      <Text style={styles.orgEditLink}>필기 열기 →</Text>
                    </View>
                  </TouchableOpacity>

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
                      onPress={() => onDuplicatePage(pNum)}
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
                📑 Adobe 스타일 PDF 병합 스튜디오 (현재 {pdfPages.length}페이지)
              </Text>
              <Text style={[styles.studioBannerDesc, { color: '#6D28D9' }]}>
                외부 PDF 파일을 추가로 불러오거나 앱 내의 다른 PDF/메모를 선택하여 현재 문서의 원하는 위치에 하나로 합칠 수 있습니다.
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
                + 내 PC/기기에서 다른 PDF 파일 선택하여 현재 문서에 병합
              </Text>
              <Text style={styles.mergeUploadSub}>
                하나 또는 여러 개의 .pdf 파일을 선택하면 위에서 지정한 위치에 즉시 병합됩니다.
              </Text>
            </View>
            <View style={styles.mergeUploadActionPill}>
              <Text style={styles.mergeUploadActionText}>파일 선택</Text>
            </View>
          </TouchableOpacity>

          {/* 병합 소스 2: 앱 내 다른 PDF / 메모 문서 선택하여 합치기 */}
          <Text style={styles.subSectionHeading}>
            📚 앱 내 보관함에서 병합할 문서 선택 ({mergeableNotes.length}개)
          </Text>
          <View style={styles.mergeNotesList}>
            {mergeableNotes.map((n) => {
              const extracted = extractPdfPagesFromNote(n);
              const isPdf = n.noteType === 'pdf' || Boolean(n.pdfName);
              return (
                <View key={n.id} style={styles.mergeNoteCard}>
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
                    style={styles.mergeExecBtn}
                    onPress={() => onMergePages(extracted, n, mergePosition)}
                  >
                    <Combine size={14} color="#FFFFFF" />
                    <Text style={styles.mergeExecBtnText}>이 문서 병합 ({extracted.length}장)</Text>
                  </TouchableOpacity>
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

                    <View style={styles.orgMiniSheet}>
                      <Text style={styles.orgMiniTitle} numberOfLines={2}>
                        {p.title}
                      </Text>
                      <View style={styles.orgMiniDivider} />
                      <Text style={styles.orgMiniContent} numberOfLines={4}>
                        {p.content}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
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
});
