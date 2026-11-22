export type NoteColorId =
  | 'yellow'
  | 'coral'
  | 'peach'
  | 'mint'
  | 'sky'
  | 'lavender'
  | 'rose'
  | 'sage'
  | 'banana'
  | 'lilac'
  | 'charcoal'
  | 'paper';

export type DecoStyle = 'tape' | 'pin' | 'minimal' | 'corner-fold';

// Noteshelf & DrawNote 스타일 페이퍼 속지 템플릿 (다크 칠판 포함)
export type PaperTemplate = 'blank' | 'lined' | 'grid' | 'dot' | 'cornell' | 'dark';

// Noteshelf & Jnotes 스타일 음성 녹음 메모
export interface AudioNote {
  id: string;
  uri: string;
  duration: number; // 초
  createdAt: number;
  title?: string;
  x?: number;
  y?: number;
  pageIndex?: number;
}

// Jnotes 스타일 다이어리 플래너 스티커
export interface PlannerSticker {
  id: string;
  emoji: string;
  label: string;
  color?: string;
}

// 텍스트 모드 vs 자유 모드
export type EditorMode = 'text' | 'free';

// 자유 모드 필기 스트로크
export interface FreeHandStroke {
  id: string;
  points: { x: number; y: number }[];
  color: string;
  width: number;
  tool: 'pen' | 'fountain' | 'highlighter' | 'eraser' | 'connector' | 'shape';
  shapeType?: 'rect' | 'circle' | 'arrow' | 'line' | 'triangle';
  shapeStart?: { x: number; y: number };
  shapeEnd?: { x: number; y: number };
  isRuler?: boolean;
  isPolygon?: boolean;
  pageIndex?: number;
}

// 자유 모드 텍스트 상자
export interface FreeTextBox {
  id: string;
  x: number;
  y: number;
  text: string;
  fontSize: number;
  color: string;
  backgroundColor?: string;
  pageIndex?: number;
}

// 다중 탭 시스템
export interface EditorTab {
  id: string;
  title: string;
  type: 'note' | 'pdf' | 'canvas';
  noteId?: string;
  pdfUri?: string;
  pdfName?: string;
  pdfTotalPages?: number;
  pdfCurrentPage?: number;
  freeDrawingData?: string; // 캔버스 필기 스냅샷 Data URL
  textBoxes?: FreeTextBox[];
}

export type ImageSize = 'small' | 'medium' | 'large' | 'full';
export type ImagePlacement = 'top' | 'inline' | 'bottom';

export type NoteFontSize = 'sm' | 'base' | 'lg' | 'xl';
export type NoteLineHeight = 'tight' | 'normal' | 'relaxed';
export type NoteCardWidth = 'compact' | 'standard' | 'wide';

export interface ChecklistItem {
  id: string;
  text: string;
  completed: boolean;
}

export type TextWrapMode =
  | 'wrap-left'    // 사진 좌측, 글 우측 어울림
  | 'wrap-right'   // 글 좌측, 사진 우측 어울림
  | 'behind-text'  // 사진 위에 글쓰기 (글 뒤로 / 워터마크 배경)
  | 'break'        // 자리차지 (위아래 분리)
  | 'in-front';    // 자유 오버레이

export interface NoteImage {
  id: string;
  uri: string;
  width?: number;
  height?: number;
  caption?: string;
  size?: ImageSize; // 크기 조절 프리셋: small, medium, large, full
  placement?: ImagePlacement; // 배치 위치: 상단, 본문 중간, 하단
  x?: number; // X 좌표 위치
  y?: number; // Y 좌표 위치
  customWidth?: number; // 직접 지정 너비 (px)
  customHeight?: number; // 직접 지정 높이 (px)
  scale?: number; // 배율 (0.5 ~ 2.0)
  wrapMode?: TextWrapMode; // 한글/워드 스타일 본문 어울림 모드
  opacity?: number; // 사진 위에 글쓰기 시 투명도 (0.2 ~ 1.0)
}

export type WidgetSize = '1x1' | '2x2' | '4x2' | '4x4';

export interface WidgetConfig {
  id: string;
  noteId: string;
  size: WidgetSize;
  opacity: number; // 투명도 (0.2 ~ 1.0)
  showDeco: boolean;
  createdAt: number;
}

export interface ReminderInfo {
  date: string; // YYYY-MM-DD
  time?: string; // HH:mm
  isCompleted?: boolean;
  pinToStatusBar?: boolean; // ColorNote 스타일 상단바 고정 알림
  repeat?: 'none' | 'daily' | 'weekly' | 'monthly';
}

export type SortOption = 'updated' | 'created' | 'title' | 'color' | 'reminder';

export type LunarDisplayMode = 'none' | 'all' | 'key_days';

export type PdfViewLayout = 'single' | 'continuous' | 'two-up';

export interface PdfPageData {
  id: string;
  pageNumber: number;
  title: string;
  subtitle?: string;
  content: string;
  sourcePdfName?: string;
  renderedImageUri?: string; // 실제 .pdf 원본 렌더링 이미지 또는 이미지→PDF 변환 페이지 Data URL
  aspectRatio?: number; // 페이지 원본 width / height 비율
}

export interface PdfWatermarkConfig {
  enabled: boolean;
  text: string;
  opacity: number; // 0.05 ~ 0.45
  color: string;
}

export interface PdfHeaderFooterConfig {
  enabled: boolean;
  headerText: string;
  footerText: string;
  showPageNumbers: boolean;
}

export interface PdfStampItem {
  id: string;
  pageIndex: number;
  x: number;
  y: number;
  label: string;
  sublabel?: string;
  color: string;
  rotation?: number;
}

export interface PdfRedactionRect {
  id: string;
  pageIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
  reason?: string;
}

export interface PdfCommentMessage {
  id: string;
  author: string;
  text: string;
  createdAt: number;
}

export interface PdfCommentThread {
  id: string;
  pageIndex: number;
  x: number;
  y: number;
  resolved: boolean;
  createdAt: number;
  messages: PdfCommentMessage[];
}

export interface PdfDocumentMeta {
  author?: string;
  subject?: string;
  keywords?: string;
}

export interface Note {
  id: string;
  title: string;
  content: string; // 글자수 제한 없음 (장문 지원)
  color: NoteColorId;
  decoStyle: DecoStyle;
  images: NoteImage[]; // 사진 다중 첨부 및 크기/배치 조절
  checklist: ChecklistItem[]; // 할 일 목록 체크리스트
  tags: string[]; // #태그 목록
  isPinned: boolean;
  isLocked: boolean; // 잠금 메모 (ColorNote 스타일 비밀번호 보호)
  lockPin?: string; // 개별 잠금 비밀번호/PIN
  reminder?: ReminderInfo; // ColorNote 스타일 리마인더/알람
  isArchived?: boolean; // 보관함
  isDeleted?: boolean; // 휴지통 (삭제 복구 기능)
  deletedAt?: number; // 삭제 일시
  boardId: string; // 소속 보드
  canvasX: number; // 캔버스 모드 X좌표
  canvasY: number; // 캔버스 모드 Y좌표
  zIndex: number;
  rotation: number; // 포스트잇 특유의 자연스러운 살짝 기울임 각도 (-15도 ~ 15도)
  
  // 전문가 타이포그래피 & 크기 커스터마이징
  fontSize?: NoteFontSize;
  lineHeight?: NoteLineHeight;
  cardWidth?: NoteCardWidth;

  // Noteshelf & Jnotes & DrawNote 고도화 기능
  paperTemplate?: PaperTemplate; // 속지 스타일: blank, lined, grid, dot, cornell, dark
  audioNotes?: AudioNote[]; // 음성 녹음 메모 목록
  stickers?: PlannerSticker[]; // 다이어리 & 플래너 감성 스티커 목록
  freeDrawingData?: string; // 캔버스 자유 필기 스냅샷 Data URL
  strokes?: FreeHandStroke[]; // 손글씨 벡터 스트로크 포인트 배열 (영구 보존 및 선명한 렌더링)
  autoSortChecked?: boolean; // ColorNote 스타일 완료 항목 자동 하단 정렬
  editorMode?: EditorMode; // 텍스트 모드 vs 자유 필기 모드
  noteType?: 'text' | 'checklist' | 'canvas' | 'pdf'; // 메모 고유 유형
  pdfUri?: string; // 첨부된 PDF/문서 URI
  pdfName?: string; // 문서 파일명
  pdfPages?: PdfPageData[]; // PDF 개별 페이지 데이터 (원본 렌더링/편집/병합/분할 지원)
  pdfWatermark?: PdfWatermarkConfig; // 대각선 워터마크 설정
  pdfHeaderFooter?: PdfHeaderFooterConfig; // 머리글·바닥글·페이지 번호 설정
  pdfStamps?: PdfStampItem[]; // 스탬프(승인/초안/기밀/중요 등)
  pdfRedactions?: PdfRedactionRect[]; // 민감정보 먹칠/가림 영역
  pdfComments?: PdfCommentThread[]; // 위치 기반 스레드 댓글
  pdfMeta?: PdfDocumentMeta; // 문서 속성(저자/주제/키워드)
  textBoxes?: FreeTextBox[]; // PDF 및 캔버스 자유 텍스트 상자
  bookmarkedPages?: number[]; // Jnotes, Notewise, Goodnotes 스타일 즐겨찾기/책갈피 페이지 번호 목록
  pageTemplates?: Record<number, PaperTemplate>; // 페이지별 개별 속지 템플릿 (줄노트, 모눈, 코넬 등)
  createdAt: number;
  updatedAt: number;
}

export interface Board {
  id: string;
  name: string;
  icon: string;
  color?: string;
  isDefault?: boolean;
}

export type ViewMode = 'grid' | 'canvas' | 'calendar'; // ColorNote 스타일 캘린더 연동!

export interface FilterOptions {
  searchQuery: string;
  selectedTag: string | null;
  selectedColor: NoteColorId | null;
  onlyPinned: boolean;
  onlyHasImages: boolean;
  onlyChecklist: boolean;
  sortBy?: SortOption;
  showArchived?: boolean;
  showTrash?: boolean;
  listLayout?: 'grid' | 'list'; // ColorNote 스타일 그리드 / 리스트 뷰 레이아웃
}
