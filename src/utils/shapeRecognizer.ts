/**
 * Notewise & Goodnotes 6 벤치마크 고정밀 스마트 도형 및 다중 스트로크 결합 엔진
 * (Smart Shape & Multi-Stroke Snap-to-Endpoints Engine)
 * 
 * [핵심 기능]
 * 1. 단일 스트로크 고정밀 인식:
 *    - 원/타원: 둘레 대비 면적비(원형도) 및 방사형 편차를 분석하여 사각형과 절대 충돌하지 않음
 *    - 직사각형/정사각형: 4개 모서리 돌출 및 면적 채움비(Solidity) 분석으로 안정적 인식
 *    - 삼각형: 3개 코너 및 삼각형 특화 면적비(30~65%) 검출
 *    - 직선: 시작-끝 직선거리비 88% 이상
 * 2. 다중 스트로크 자동 결합 (Multi-Stroke Recognition / Snap to Endpoints):
 *    - 사용자가 사각형을 한 번에 그리지 않고 'ㅣ', 'ㄱ', 'ㅡ' 또는 4개의 분할된 선으로 그려도,
 *      최근 그린 선들의 끝점들이 서로 인접하여 닫힌 루프를 형성하면
 *      개별 선들을 하나의 완벽한 정밀 기하학 도형(직사각형, 정사각형, 삼각형)으로 자동 결합(Merge)합니다.
 */

export interface Point {
  x: number;
  y: number;
}

export type RecognizedShapeType = 'line' | 'arrow' | 'rectangle' | 'circle' | 'triangle' | null;

export interface RecognizedShape {
  type: RecognizedShapeType;
  points: Point[];
  label: string;
  isPolygon?: boolean;
}

/**
 * 두 점 사이의 유클리드 거리
 */
export const getDistance = (p1: Point, p2: Point): number => {
  return Math.hypot(p2.x - p1.x, p2.y - p1.y);
};

/**
 * 점들의 바운딩 박스 계산
 */
export const getBoundingBox = (points: Point[]) => {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }

  return {
    minX,
    maxX,
    minY,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2,
  };
};

/**
 * 스트로크 전체 경로 누적 길이 계산
 */
export const getPathLength = (points: Point[]): number => {
  let len = 0;
  for (let i = 1; i < points.length; i++) {
    len += getDistance(points[i - 1], points[i]);
  }
  return len;
};

/**
 * 신발끈 공식(Shoelace formula)을 이용한 다각형 면적 계산
 */
export const getPolygonArea = (points: Point[]): number => {
  let area = 0;
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += points[i].x * points[j].y;
    area -= points[j].x * points[i].y;
  }
  return Math.abs(area) / 2;
};

/**
 * 스트로크 등간격 리샘플링 (Uniform Resampling)
 */
export const resampleStroke = (points: Point[], spacing: number = 8): Point[] => {
  if (points.length < 2) return points;
  const resampled: Point[] = [points[0]];
  let distAccum = 0;

  for (let i = 1; i < points.length; i++) {
    const p1 = points[i - 1];
    const p2 = points[i];
    const segDist = getDistance(p1, p2);

    if (distAccum + segDist >= spacing) {
      let cur = spacing - distAccum;
      while (cur <= segDist) {
        resampled.push({
          x: p1.x + (cur / segDist) * (p2.x - p1.x),
          y: p1.y + (cur / segDist) * (p2.y - p1.y),
        });
        cur += spacing;
      }
      distAccum = segDist - (cur - spacing);
    } else {
      distAccum += segDist;
    }
  }

  const last = points[points.length - 1];
  if (getDistance(resampled[resampled.length - 1], last) > spacing / 2) {
    resampled.push(last);
  }
  return resampled;
};

/**
 * ShortStraw 윈도우 회전각(Turning angle) 기반 코너 검출
 */
export const detectSharpCorners = (
  resampled: Point[]
): { pt: Point; angle: number; idx: number }[] => {
  const n = resampled.length;
  if (n < 8) return [];
  const corners: { pt: Point; angle: number; idx: number }[] = [];
  const window = Math.max(3, Math.floor(n / 12));

  for (let i = window; i < n - window; i++) {
    const pPrev = resampled[i - window];
    const pCurr = resampled[i];
    const pNext = resampled[i + window];

    const v1 = { x: pCurr.x - pPrev.x, y: pCurr.y - pPrev.y };
    const v2 = { x: pNext.x - pCurr.x, y: pNext.y - pCurr.y };

    const mag1 = Math.hypot(v1.x, v1.y);
    const mag2 = Math.hypot(v2.x, v2.y);
    if (mag1 === 0 || mag2 === 0) continue;

    const dot = Math.max(-1, Math.min(1, (v1.x * v2.x + v1.y * v2.y) / (mag1 * mag2)));
    const angle = Math.acos(dot) * (180 / Math.PI);

    if (angle > 45) {
      corners.push({ pt: pCurr, angle, idx: i });
    }
  }

  const clustered: { pt: Point; angle: number; idx: number }[] = [];
  let cur: { pt: Point; angle: number; idx: number }[] = [];

  for (let i = 0; i < corners.length; i++) {
    const c = corners[i];
    if (cur.length === 0) {
      cur.push(c);
    } else if (c.idx - cur[cur.length - 1].idx <= window * 2) {
      cur.push(c);
    } else {
      cur.sort((a, b) => b.angle - a.angle);
      clustered.push(cur[0]);
      cur = [c];
    }
  }
  if (cur.length > 0) {
    cur.sort((a, b) => b.angle - a.angle);
    clustered.push(cur[0]);
  }

  return clustered;
};

/**
 * 바운딩 박스 4개 모서리(Corner)와 점들 간의 평균 최소 거리 비율
 * - 직사각형/정사각형: 선이 모서리를 지나므로 cornerGap <= 0.15
 * - 원/타원: 기하학적으로 모서리가 비어 있으므로 cornerGap >= 0.15 (이론값 약 0.207)
 */
export const computeCornerGap = (points: Point[], bbox: ReturnType<typeof getBoundingBox>): number => {
  const minDim = Math.min(bbox.width, bbox.height);
  if (minDim === 0) return 0;
  const corners = [
    { x: bbox.minX, y: bbox.minY },
    { x: bbox.maxX, y: bbox.minY },
    { x: bbox.maxX, y: bbox.maxY },
    { x: bbox.minX, y: bbox.maxY },
  ];
  let totalGap = 0;
  for (let i = 0; i < 4; i++) {
    const c = corners[i];
    let minDist = Infinity;
    for (let j = 0; j < points.length; j++) {
      const p = points[j];
      const d = Math.hypot(p.x - c.x, p.y - c.y);
      if (d < minDist) minDist = d;
    }
    totalGap += minDist;
  }
  return (totalGap / 4) / minDim;
};

/**
 * 단일 스트로크 도형 자동 인식
 */
export const recognizeShape = (points: Point[]): RecognizedShape | null => {
  if (!points || points.length < 4) return null;

  const first = points[0];
  const last = points[points.length - 1];
  const totalLength = getPathLength(points);
  const directDist = getDistance(first, last);

  if (totalLength < 18) return null;

  const bbox = getBoundingBox(points);
  const diag = Math.hypot(bbox.width, bbox.height);

  // 1. 직선 검사 (88% 이상 선형)
  if (directDist / totalLength >= 0.88) {
    return {
      type: 'line',
      points: [first, last],
      label: '직선',
      isPolygon: true,
    };
  }

  // 2. 닫힌 루프 검사 (손글씨 끝점 벌어짐 및 오버슛 포용)
  let isClosed = directDist < Math.max(70, diag * 0.45);
  if (!isClosed && points.length > 6) {
    const headLimit = Math.min(35, Math.floor(points.length * 0.40));
    for (let i = 0; i < headLimit; i++) {
      if (getDistance(points[i], last) < Math.max(65, diag * 0.40)) {
        isClosed = true;
        break;
      }
    }
  }

  if (!isClosed || bbox.width < 16 || bbox.height < 16) {
    return null;
  }

  const strokeArea = getPolygonArea(points);
  const bboxArea = bbox.width * bbox.height;
  const solidity = bboxArea > 0 ? strokeArea / bboxArea : 0;
  const circularity = totalLength > 0 ? (4 * Math.PI * strokeArea) / Math.pow(totalLength, 2) : 0;

  const resamp = resampleStroke(points, 8);
  const sharpCorners = detectSharpCorners(resamp);

  const rx = bbox.width / 2;
  const ry = bbox.height / 2;

  // Mean Ellipse Fit Error (MSE from ideal ellipse/circle)
  let sumNormDistErr = 0;
  for (const p of points) {
    const normDist = Math.hypot((p.x - bbox.centerX) / rx, (p.y - bbox.centerY) / ry);
    sumNormDistErr += Math.abs(normDist - 1);
  }
  const meanEllipseErr = sumNormDistErr / points.length;

  // Corner Gap (바운딩 박스 4개 모서리까지의 최소 거리 정규화)
  const cornerGap = computeCornerGap(points, bbox);

  const isCircleProportion = bbox.width / bbox.height > 0.80 && bbox.width / bbox.height < 1.25;

  const createCirclePoints = (): Point[] => {
    const circlePoints: Point[] = [];
    const steps = 48;
    const finalRx = isCircleProportion ? (rx + ry) / 2 : rx;
    const finalRy = isCircleProportion ? (rx + ry) / 2 : ry;
    for (let i = 0; i <= steps; i++) {
      const rad = (i / steps) * Math.PI * 2;
      circlePoints.push({
        x: bbox.centerX + finalRx * Math.cos(rad),
        y: bbox.centerY + finalRy * Math.sin(rad),
      });
    }
    return circlePoints;
  };

  // -----------------------------------------------------------------
  // [1순위] 원 / 타원 판별
  // - 원형의 기하학적 불변 원리: 4개 모서리가 비어 있으므로 cornerGap >= 0.15
  // - solidity: 0.58 ~ 0.86 (이론값 π/4 ≈ 0.785)
  // - 타원 피팅 오차 meanEllipseErr <= 0.17 또는 원형도 circularity >= 0.60
  // -----------------------------------------------------------------
  const isCircle =
    cornerGap >= 0.15 &&
    solidity >= 0.58 &&
    solidity <= 0.86 &&
    (meanEllipseErr <= 0.17 || circularity >= 0.60);

  if (isCircle) {
    return {
      type: 'circle',
      points: createCirclePoints(),
      label: isCircleProportion ? '정원' : '타원',
      isPolygon: false,
    };
  }

  // -----------------------------------------------------------------
  // [2순위] 삼각형 판별
  // - solidity 0.30 ~ 0.66 & 2~3개 코너
  // -----------------------------------------------------------------
  if (
    solidity >= 0.30 &&
    solidity <= 0.66 &&
    (sharpCorners.length === 2 || sharpCorners.length === 3)
  ) {
    let triPts: Point[] = [];
    if (sharpCorners.length === 3) {
      triPts = sharpCorners.map(c => c.pt);
    } else {
      triPts = [sharpCorners[0].pt, sharpCorners[1].pt, first];
    }
    return {
      type: 'triangle',
      points: [...triPts, triPts[0]],
      label: '삼각형',
      isPolygon: true,
    };
  }

  // -----------------------------------------------------------------
  // [3순위] 직사각형 / 정사각형 판별
  // - 직사각형 불변 원리: solidity >= 0.83 (또는 자연스러운 손그림 코너 cornerGap <= 0.15 & solidity >= 0.75)
  // -----------------------------------------------------------------
  if (solidity >= 0.83 || (solidity >= 0.75 && cornerGap <= 0.15)) {
    const isSquare = bbox.width / bbox.height >= 0.82 && bbox.width / bbox.height <= 1.22;

    let longestEdgeAngle = 0;
    let maxEdgeLen = 0;
    const cornerPts = sharpCorners.map(c => c.pt);

    if (cornerPts.length >= 4) {
      for (let i = 0; i < 4; i++) {
        const p1 = cornerPts[i];
        const p2 = cornerPts[(i + 1) % 4];
        const d = getDistance(p1, p2);
        if (d > maxEdgeLen) {
          maxEdgeLen = d;
          longestEdgeAngle = Math.atan2(p2.y - p1.y, p2.x - p1.x) * (180 / Math.PI);
        }
      }
    }

    let angleDev = Math.abs(longestEdgeAngle % 90);
    if (angleDev > 45) angleDev = 90 - angleDev;

    const isAxisAligned = angleDev < 14 || cornerPts.length !== 4;

    if (isAxisAligned) {
      if (isSquare) {
        const side = (bbox.width + bbox.height) / 2;
        const half = side / 2;
        return {
          type: 'rectangle',
          points: [
            { x: bbox.centerX - half, y: bbox.centerY - half },
            { x: bbox.centerX + half, y: bbox.centerY - half },
            { x: bbox.centerX + half, y: bbox.centerY + half },
            { x: bbox.centerX - half, y: bbox.centerY + half },
            { x: bbox.centerX - half, y: bbox.centerY - half },
          ],
          label: '정사각형',
          isPolygon: true,
        };
      } else {
        return {
          type: 'rectangle',
          points: [
            { x: bbox.minX, y: bbox.minY },
            { x: bbox.maxX, y: bbox.minY },
            { x: bbox.maxX, y: bbox.maxY },
            { x: bbox.minX, y: bbox.maxY },
            { x: bbox.minX, y: bbox.minY },
          ],
          label: '직사각형',
          isPolygon: true,
        };
      }
    } else {
      const rad = (longestEdgeAngle * Math.PI) / 180;
      const cos = Math.cos(-rad);
      const sin = Math.sin(-rad);

      let rMinX = Infinity, rMaxX = -Infinity, rMinY = Infinity, rMaxY = -Infinity;
      for (let i = 0; i < points.length; i++) {
        const p = points[i];
        const dx = p.x - bbox.centerX;
        const dy = p.y - bbox.centerY;
        const rxVal = dx * cos - dy * sin;
        const ryVal = dx * sin + dy * cos;
        if (rxVal < rMinX) rMinX = rxVal;
        if (rxVal > rMaxX) rMaxX = rxVal;
        if (ryVal < rMinY) rMinY = ryVal;
        if (ryVal > rMaxY) rMaxY = ryVal;
      }

      const rotateBack = (rxVal: number, ryVal: number): Point => {
        const cosB = Math.cos(rad);
        const sinB = Math.sin(rad);
        return {
          x: bbox.centerX + (rxVal * cosB - ryVal * sinB),
          y: bbox.centerY + (rxVal * sinB + ryVal * cosB),
        };
      };

      const p0 = rotateBack(rMinX, rMinY);
      const p1 = rotateBack(rMaxX, rMinY);
      const p2 = rotateBack(rMaxX, rMaxY);
      const p3 = rotateBack(rMinX, rMaxY);

      return {
        type: 'rectangle',
        points: [p0, p1, p2, p3, p0],
        label: '직사각형',
        isPolygon: true,
      };
    }
  }

  return null;
};

// ----------------------------------------------------------------------------
// 다중 스트로크 자동 체이닝 및 도형 결합 엔진 (Multi-Stroke Snap-to-Endpoints)
// ----------------------------------------------------------------------------
const tryFormClosedChain = <T extends { points: Point[] }>(
  strokes: T[],
  snapRadius: number = 45
): Point[] | null => {
  if (strokes.length < 2 || strokes.length > 5) return null;

  const n = strokes.length;
  const remaining = strokes.slice(0, n - 1);
  const currentChain: Point[] = [...strokes[n - 1].points];

  let head = currentChain[0];
  let tail = currentChain[currentChain.length - 1];

  while (remaining.length > 0) {
    let foundIndex = -1;
    let connectAtTail = true;
    let reverseStroke = false;

    for (let i = 0; i < remaining.length; i++) {
      const s = remaining[i];
      const sStart = s.points[0];
      const sEnd = s.points[s.points.length - 1];

      if (getDistance(tail, sStart) <= snapRadius) {
        foundIndex = i;
        connectAtTail = true;
        reverseStroke = false;
        break;
      }
      if (getDistance(tail, sEnd) <= snapRadius) {
        foundIndex = i;
        connectAtTail = true;
        reverseStroke = true;
        break;
      }
      if (getDistance(head, sEnd) <= snapRadius) {
        foundIndex = i;
        connectAtTail = false;
        reverseStroke = false;
        break;
      }
      if (getDistance(head, sStart) <= snapRadius) {
        foundIndex = i;
        connectAtTail = false;
        reverseStroke = true;
        break;
      }
    }

    if (foundIndex === -1) return null;

    const nextStroke = remaining.splice(foundIndex, 1)[0];
    const pts = reverseStroke ? [...nextStroke.points].reverse() : [...nextStroke.points];

    if (connectAtTail) {
      currentChain.push(...pts);
      tail = currentChain[currentChain.length - 1];
    } else {
      currentChain.unshift(...pts);
      head = currentChain[0];
    }
  }

  if (getDistance(head, tail) <= snapRadius * 1.3) {
    currentChain.push(head);
    return currentChain;
  }
  return null;
};

/**
 * 최근 그려진 스트로크들과 새 스트로크가 서로 연결되어 직사각형/다각형을 이루는지 검사
 * (Goodnotes 'Snap to Endpoints' 시그니처 벤치마크)
 */
export const tryRecognizeMultiStroke = <
  T extends { id: string; points: Point[]; pageIndex?: number }
>(
  existingStrokes: T[],
  newStroke: T,
  snapRadius: number = 45
): { recognized: RecognizedShape; mergedStrokeIds: string[] } | null => {
  // 같은 페이지의 직전 스트로크들 필터
  const pageStrokes = existingStrokes.filter(
    (s) => (s.pageIndex ?? 0) === (newStroke.pageIndex ?? 0) && s.id !== newStroke.id
  );

  if (pageStrokes.length === 0) return null;

  // 최근 1~3개 스트로크 + 신규 스트로크 (총 2~4개 조합 탐색)
  const recentCandidates = pageStrokes.slice(-4);

  for (let k = 1; k <= Math.min(3, recentCandidates.length); k++) {
    const subset = [...recentCandidates.slice(-k), newStroke];
    const chain = tryFormClosedChain(subset, snapRadius);
    if (chain) {
      const recognized = recognizeShape(chain);
      if (recognized && (recognized.type === 'rectangle' || recognized.type === 'triangle')) {
        return {
          recognized,
          mergedStrokeIds: subset.map((s) => s.id),
        };
      }
    }
  }

  return null;
};
