export interface SampleDocumentPage {
  pageNumber: number;
  title: string;
  subtitle: string;
  content: string;
}

export interface SampleDocument {
  id: string;
  name: string;
  pages: SampleDocumentPage[];
}

export const SAMPLE_DOCUMENTS: SampleDocument[] = [
  {
    id: 'doc-product-roadmap',
    name: '2026 프로덕트 전략 로드맵.pdf',
    pages: [
      {
        pageNumber: 1,
        title: 'StickyCraft Pro - 차세대 노트 에코시스템 기획서',
        subtitle: '1. 프로젝트 개요 및 벤치마크 핵심 지향점',
        content: `본 문서는 ColorNote, DrawNote, Notewise, Goodnotes의 주요 UX/UI 패턴을 융합하여 독보적인 반응형 노트 앱을 구축하기 위한 아키텍처 명세서입니다.

[핵심 설계 원칙]
• 1:1 직관성: 팝업 폼의 번잡함을 제거하고, 전체 화면 전용 작업 공간 제공
• 고화질 벡터 필기: 확대 축소에도 깨짐 없는 Bézier 곡선 스트로크 엔진
• 멀티페이지 연속 스크롤: A4 비율의 인체공학적 문서 레이아웃과 그림자 효과
• 음성 동기화 레코딩: 실시간 오디오 파형과 연동되는 플로팅 레코딩 스튜디오`,
      },
      {
        pageNumber: 2,
        title: 'StickyCraft Pro - 기능별 벤치마크 분석표',
        subtitle: '2. 레퍼런스 앱 심층 분석 결과',
        content: `[주요 분석 앱 및 특장점]
1. ColorNote (com.socialnmobile.dictapps.notepad.color.note)
   - 최상단 빠른 연속 추가 바(view_checklist_header_additem)
   - 완료 항목 취소선 및 하단 자동 정렬 시스템

2. Notewise (com.yygg.note.app)
   - 부유형 플로팅 툴박스(fragment_sketch_toolbox)
   - 실시간 오디오 레코딩 바와 1.0x~2.0x 배속 재생 시스템

3. DrawNote (com.dragonnest.drawnote)
   - 무한 화이트보드 캔버스와 마인드맵 화살표 연결선
   - 다양한 격자, 줄, 코넬, 칠판 페이퍼 템플릿`,
      },
      {
        pageNumber: 3,
        title: 'StickyCraft Pro - 향후 기술 로드맵',
        subtitle: '3. 버전 2.0 릴리즈 마일스톤',
        content: `• Q1: 크로스 플랫폼 클라우드 동기화 및 E2E 암호화
• Q2: 온디바이스 필기 텍스트 인식(OCR) 및 수식 계산기
• Q3: PDF 텍스트 다이렉트 검색 및 양식 채우기(Form-fill)
• Q4: 다이어리 플래너 감성 스티커 마켓플레이스 오픈`,
      },
    ],
  },
  {
    id: 'doc-ai-summary',
    name: '인공지능 & 딥러닝 핵심 요약 노트.pdf',
    pages: [
      {
        pageNumber: 1,
        title: 'Transformer Architecture & Self-Attention',
        subtitle: 'Chapter 1: Attention Is All You Need 요약',
        content: `Attention 메커니즘은 시퀀스 내의 모든 토큰 간의 상호 연관성을 O(1) 경로 길이로 계산합니다.

수식:
Attention(Q, K, V) = softmax(Q K^T / sqrt(d_k)) V

[학습 팁]
1. Multi-head Attention은 여러 다른 표현 공간의 정보를 동시에 포착합니다.
2. Positional Encoding을 통해 순서 정보를 벡터에 주입합니다.`,
      },
      {
        pageNumber: 2,
        title: 'Diffusion Models & Generative AI',
        subtitle: 'Chapter 2: 확산 모델의 원리와 디노이징',
        content: `Forward Process: 데이터에 점진적으로 가우시안 노이즈를 추가하여 순수 노이즈 상태로 변환합니다.
Reverse Process: 학습된 신경망을 통해 노이즈를 예측하고 역방향으로 제거하여 고해상도 이미지를 생성합니다.`,
      },
    ],
  },
];

export function getSampleDocumentForNote(noteTitle?: string, pdfName?: string): SampleDocument {
  const query = (pdfName || noteTitle || '').toLowerCase();
  const found = SAMPLE_DOCUMENTS.find(
    (doc) =>
      query.includes(doc.name.toLowerCase()) ||
      doc.name.toLowerCase().includes(query) ||
      (doc.id && query.includes(doc.id.toLowerCase()))
  );
  return found || SAMPLE_DOCUMENTS[0];
}
