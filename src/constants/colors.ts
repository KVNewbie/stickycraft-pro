import { NoteColorId } from '../types/note';

export interface NoteColorConfig {
  id: NoteColorId;
  name: string;
  bg: string;
  cardBorder: string;
  headerBg: string;
  text: string;
  textMuted: string;
  tapeColor: string;
  shadow: string;
}

export const NOTE_COLORS: Record<NoteColorId, NoteColorConfig> = {
  yellow: {
    id: 'yellow',
    name: '클래식 옐로우',
    bg: '#FEF9C3', // warm soft pastel yellow
    cardBorder: '#FDE047',
    headerBg: '#FEF08A',
    text: '#374151',
    textMuted: '#6B7280',
    tapeColor: 'rgba(253, 224, 71, 0.65)',
    shadow: '#FACC15',
  },
  coral: {
    id: 'coral',
    name: '선셋 코랄',
    bg: '#FFE4E6',
    cardBorder: '#FECDD3',
    headerBg: '#FDA4AF',
    text: '#4C0519',
    textMuted: '#9F1239',
    tapeColor: 'rgba(251, 113, 133, 0.6)',
    shadow: '#FB7185',
  },
  peach: {
    id: 'peach',
    name: '살구 피치',
    bg: '#FFEDD5',
    cardBorder: '#FED7AA',
    headerBg: '#FDBA74',
    text: '#431407',
    textMuted: '#9A3412',
    tapeColor: 'rgba(251, 146, 60, 0.6)',
    shadow: '#FB923C',
  },
  mint: {
    id: 'mint',
    name: '프레시 민트',
    bg: '#DCFCE7',
    cardBorder: '#BBF7D0',
    headerBg: '#86EFAC',
    text: '#064E3B',
    textMuted: '#065F46',
    tapeColor: 'rgba(74, 222, 128, 0.6)',
    shadow: '#4ADE80',
  },
  sky: {
    id: 'sky',
    name: '소프트 스카이',
    bg: '#E0F2FE',
    cardBorder: '#BAE6FD',
    headerBg: '#7DD3FC',
    text: '#0C4A6E',
    textMuted: '#075985',
    tapeColor: 'rgba(56, 189, 248, 0.6)',
    shadow: '#38BDF8',
  },
  lavender: {
    id: 'lavender',
    name: '라벤더 블룸',
    bg: '#EDE9FE',
    cardBorder: '#DDD6FE',
    headerBg: '#C4B5FD',
    text: '#3B0764',
    textMuted: '#581C87',
    tapeColor: 'rgba(167, 139, 250, 0.6)',
    shadow: '#A78BFA',
  },
  rose: {
    id: 'rose',
    name: '파스텔 로즈',
    bg: '#FCE7F3',
    cardBorder: '#FBCFE8',
    headerBg: '#F472B6',
    text: '#500724',
    textMuted: '#831843',
    tapeColor: 'rgba(244, 114, 182, 0.6)',
    shadow: '#F472B6',
  },
  sage: {
    id: 'sage',
    name: '세이지 그린',
    bg: '#ECFDF5',
    cardBorder: '#D1FAE5',
    headerBg: '#6EE7B7',
    text: '#064E3B',
    textMuted: '#047857',
    tapeColor: 'rgba(52, 211, 153, 0.6)',
    shadow: '#34D399',
  },
  banana: {
    id: 'banana',
    name: '버터 크림',
    bg: '#FFFBEB',
    cardBorder: '#FEF3C7',
    headerBg: '#FDE68A',
    text: '#451A03',
    textMuted: '#78350F',
    tapeColor: 'rgba(252, 211, 77, 0.6)',
    shadow: '#FCD34D',
  },
  lilac: {
    id: 'lilac',
    name: '미스틱 바이올렛',
    bg: '#F3E8FF',
    cardBorder: '#E9D5FF',
    headerBg: '#D8B4FE',
    text: '#3B0764',
    textMuted: '#6B21A8',
    tapeColor: 'rgba(192, 132, 252, 0.6)',
    shadow: '#C084FC',
  },
  paper: {
    id: 'paper',
    name: '내추럴 크래프트',
    bg: '#F5EBE0',
    cardBorder: '#E3D5CA',
    headerBg: '#D5BDAF',
    text: '#2B2118',
    textMuted: '#5E503F',
    tapeColor: 'rgba(213, 189, 175, 0.7)',
    shadow: '#B79A84',
  },
  charcoal: {
    id: 'charcoal',
    name: '모던 흑연',
    bg: '#27272A',
    cardBorder: '#3F3F46',
    headerBg: '#3F3F46',
    text: '#F4F4F5',
    textMuted: '#A1A1AA',
    tapeColor: 'rgba(113, 113, 122, 0.6)',
    shadow: '#18181B',
  },
};

export const COLOR_KEYS = Object.keys(NOTE_COLORS) as NoteColorId[];

export const DEFAULT_BOARDS = [
  { id: 'all', name: '전체 메모', icon: 'Layers', isDefault: true },
  { id: 'work', name: '업무 / 프로젝트', icon: 'Briefcase' },
  { id: 'personal', name: '일상 / 기록', icon: 'Coffee' },
  { id: 'ideas', name: '아이디어 / 영감', icon: 'Lightbulb' },
  { id: 'study', name: '스터디 / 독서', icon: 'BookOpen' },
];
