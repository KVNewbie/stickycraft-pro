import { Note } from '../types/note';

export const INITIAL_MOCK_NOTES: Note[] = [
  {
    id: 'note-welcome-1',
    title: '✨ StickyCraft Pro에 오신 것을 환영합니다!',
    content: `포스트잇의 친근한 아날로그 감성과 전문가용 기능이 결합된 프리미엄 스티커 메모 앱입니다.

💡 핵심 팁:
• [그리드 뷰]와 [캔버스 뷰]를 상단 우측 버튼으로 언제든 전환해 보세요.
• 캔버스 모드에서는 스티커를 손가락으로 자유롭게 드래그하여 원하는 위치에 배치할 수 있습니다!
• 메모를 탭하면 전체 내용을 크게 보고 편집할 수 있습니다.`,
    color: 'yellow',
    decoStyle: 'tape',
    images: [],
    checklist: [
      { id: 'c1', text: '상단 듀얼 뷰 스위치(그리드/캔버스) 눌러보기', completed: true },
      { id: 'c2', text: '새 메모 작성하고 사진 첨부해보기', completed: false },
      { id: 'c3', text: '좋아하는 파스텔 색상과 마스킹 테이프 골라보기', completed: false },
    ],
    tags: ['시작하기', '꿀팁'],
    isPinned: true,
    isLocked: false,
    boardId: 'ideas',
    canvasX: 20,
    canvasY: 30,
    zIndex: 1,
    rotation: -1.5,
    createdAt: Date.now() - 3600000 * 24,
    updatedAt: Date.now() - 3600000 * 24,
  },
  {
    id: 'note-long-text-2',
    title: '📖 무제한 글자수 & 내부 스크롤 테스트',
    content: `이 스티커 메모는 글자 수 제한이 전혀 없으며, 메모 카드 내부에서 부드럽게 스크롤을 지원합니다!

스티커 메모 특유의 컴팩트한 비주얼을 유지하면서도, 논문 발췌, 소설 구상, 긴 회의록이나 칼럼을 마음껏 작성할 수 있습니다.

[장문 테스트 본문 1]
생각은 순간적으로 떠오르지만, 제대로 기록되지 않으면 쉽게 흩어집니다. 고도화된 스티커 메모 시스템은 아이디어의 시각적 형태를 유지하면서 필요한 모든 세부 내용을 담을 수 있는 최적의 그릇이 되어줍니다.

[장문 테스트 본문 2]
밀라노트(Milanote)의 캔버스 자유도와 구글 킵(Google Keep)의 빠른 접근성, 그리고 애플 메모(Apple Notes)의 단단한 텍스트 관리 철학이 이 카드 안에 녹아있습니다.

[장문 테스트 본문 3]
스크롤을 내려보세요! 카드 밖으로 넘치지 않고 아주 매끄럽게 내부 스크롤이 작동합니다. 더 넓은 화면에서 읽고 싶다면 언제든 카드를 탭하여 전체 화면 모달로 열어볼 수 있습니다. 언제 어디서든 자유롭게 생각을 확장해 나가세요.`,
    color: 'mint',
    decoStyle: 'pin',
    images: [],
    checklist: [],
    tags: ['장문기록', '스크롤'],
    isPinned: false,
    isLocked: false,
    boardId: 'study',
    canvasX: 360,
    canvasY: 40,
    zIndex: 2,
    rotation: 1.2,
    createdAt: Date.now() - 3600000 * 18,
    updatedAt: Date.now() - 3600000 * 18,
  },
  {
    id: 'note-photo-3',
    title: '📸 사진이 쏙 들어간 비주얼 무드보드',
    content: `개별 스티커 메모에 고해상도 사진을 여러 장 첨부할 수 있습니다!

카메라로 찍은 영수증, 여행 사진, 디자인 레퍼런스를 스티커 위에 핀으로 꽂아두듯 아카이빙해 보세요. 사진을 터치하면 고화질 풀스크린 뷰어로 확대해 볼 수 있습니다.`,
    color: 'peach',
    decoStyle: 'tape',
    images: [
      {
        id: 'img-demo-1',
        uri: 'https://images.unsplash.com/photo-1517842645767-c639042777db?auto=format&fit=crop&w=600&q=80',
        caption: '작업 데스크 레퍼런스',
      },
      {
        id: 'img-demo-2',
        uri: 'https://images.unsplash.com/photo-1507842229451-7723906420f1?auto=format&fit=crop&w=600&q=80',
        caption: '아날로그 노트 감성',
      },
    ],
    checklist: [
      { id: 'cp1', text: '디자인 레퍼런스 수집', completed: true },
      { id: 'cp2', text: '컬러 팔레트 추출', completed: false },
    ],
    tags: ['무드보드', '사진첨부'],
    isPinned: true,
    isLocked: false,
    boardId: 'ideas',
    canvasX: 40,
    canvasY: 420,
    zIndex: 3,
    rotation: -0.8,
    createdAt: Date.now() - 3600000 * 12,
    updatedAt: Date.now() - 3600000 * 12,
  },
  {
    id: 'note-todo-4',
    title: '🎯 이번 주 핵심 프로젝트 목표',
    content: `상용 배포를 위한 마켓 출시 준비 체크리스트입니다.`,
    color: 'lavender',
    decoStyle: 'corner-fold',
    images: [],
    checklist: [
      { id: 't1', text: '안드로이드 구글 플레이 콘솔 앱 등록 준비', completed: true },
      { id: 't2', text: '애플 앱스토어 커넥트 메타데이터 세팅', completed: true },
      { id: 't3', text: 'AdMob 배너 광고 단위 연동 및 UX 점검', completed: false },
      { id: 't4', text: '오프라인 로컬 데이터 백업/복원 테스트', completed: false },
    ],
    tags: ['프로젝트', '출시준비'],
    isPinned: false,
    isLocked: false,
    boardId: 'work',
    canvasX: 380,
    canvasY: 460,
    zIndex: 4,
    rotation: 2.0,
    createdAt: Date.now() - 3600000 * 6,
    updatedAt: Date.now() - 3600000 * 6,
  },
  {
    id: 'note-coffee-5',
    title: '☕ 주말 브런치 카페 투어 리스트',
    content: `따뜻한 라떼와 크로와상이 맛있는 감성 카페 모음. 여유롭게 메모 정리하기 좋은 장소들.`,
    color: 'rose',
    decoStyle: 'minimal',
    images: [
      {
        id: 'img-cafe-1',
        uri: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=600&q=80',
        caption: '따뜻한 카페 분위기',
      },
    ],
    checklist: [
      { id: 'caf1', text: '연남동 우드 인테리어 북카페', completed: true },
      { id: 'caf2', text: '성수동 통유리 로스터리', completed: false },
    ],
    tags: ['일상', '카페'],
    isPinned: false,
    isLocked: false,
    boardId: 'personal',
    canvasX: 200,
    canvasY: 820,
    zIndex: 5,
    rotation: -2.2,
    createdAt: Date.now() - 3600000 * 2,
    updatedAt: Date.now() - 3600000 * 2,
  },
];
