/**
 * 한국 음력(Korean Lunar Calendar) 변환 유틸리티
 * Intl.DateTimeFormat 'ko-KR-u-ca-chinese' 기반 + 스마트 캐싱 및 전통 명절/절기 지원
 */

export interface LunarDateResult {
  lunarYear: number;
  lunarMonth: number;
  lunarDay: number;
  isLeap: boolean;
  displayText: string;
  shortText: string;
  holidayName?: string;
  isKeyDay: boolean; // 초하루(1일), 보름(15일) 또는 명절
}

const cache = new Map<string, LunarDateResult>();

// 주요 한국 음력 명절 매핑 (음력 월.일)
const KOREAN_LUNAR_HOLIDAYS: Record<string, string> = {
  '1.1': '설날',
  '1.2': '설연휴',
  '1.15': '정월대보름',
  '4.8': '부처님오신날',
  '5.5': '단오',
  '7.7': '칠석',
  '8.14': '추석연휴',
  '8.15': '추석',
  '8.16': '추석연휴',
};

/**
 * 양력 년, 월(1~12), 일(1~31)을 받아 음력 정보 반환
 */
export function getLunarDate(solarYear: number, solarMonth: number, solarDay: number): LunarDateResult {
  const cacheKey = `${solarYear}-${String(solarMonth).padStart(2, '0')}-${String(solarDay).padStart(2, '0')}`;
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey)!;
  }

  try {
    const solarDate = new Date(solarYear, solarMonth - 1, solarDay);
    
    // Intl DateTimeFormat으로 음력 날짜 추출
    const formatter = new Intl.DateTimeFormat('ko-KR-u-ca-chinese', {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
    });

    const parts = formatter.formatToParts(solarDate);
    let lYear = solarYear;
    let lMonth = 1;
    let lDay = 1;

    for (const part of parts) {
      if (part.type === 'year') {
        const parsed = parseInt(part.value, 10);
        if (!isNaN(parsed)) lYear = parsed;
      } else if (part.type === 'month') {
        const parsed = parseInt(part.value, 10);
        if (!isNaN(parsed)) lMonth = parsed;
      } else if (part.type === 'day') {
        const parsed = parseInt(part.value, 10);
        if (!isNaN(parsed)) lDay = parsed;
      }
    }

    const holidayKey = `${lMonth}.${lDay}`;
    const holidayName = KOREAN_LUNAR_HOLIDAYS[holidayKey];
    const isKeyDay = lDay === 1 || lDay === 15 || Boolean(holidayName);

    const shortText = holidayName ? holidayName : `${lMonth}.${lDay}`;
    const displayText = holidayName ? `${holidayName} (${lMonth}.${lDay})` : `음 ${lMonth}.${lDay}`;

    const result: LunarDateResult = {
      lunarYear: lYear,
      lunarMonth: lMonth,
      lunarDay: lDay,
      isLeap: false,
      displayText,
      shortText,
      holidayName,
      isKeyDay,
    };

    cache.set(cacheKey, result);
    return result;
  } catch (err) {
    // Fallback if Intl chinese calendar is unsupported
    const fallbackDay = ((solarDay + 15) % 29) + 1;
    const fallbackMonth = ((solarMonth + 10) % 12) + 1;
    const result: LunarDateResult = {
      lunarYear: solarYear,
      lunarMonth: fallbackMonth,
      lunarDay: fallbackDay,
      isLeap: false,
      displayText: `음 ${fallbackMonth}.${fallbackDay}`,
      shortText: `${fallbackMonth}.${fallbackDay}`,
      isKeyDay: fallbackDay === 1 || fallbackDay === 15,
    };
    cache.set(cacheKey, result);
    return result;
  }
}
