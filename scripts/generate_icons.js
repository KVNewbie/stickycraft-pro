const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

function createNoteIcon(size = 512) {
  const png = new PNG({ width: size, height: size });

  // 색상 헬퍼
  const setPixel = (x, y, r, g, b, a = 255) => {
    if (x < 0 || x >= size || y < 0 || y >= size) return;
    const idx = (size * y + x) << 2;
    // 알파 블렌딩
    if (a < 255) {
      const bgA = png.data[idx + 3] / 255;
      const fgA = a / 255;
      const outA = fgA + bgA * (1 - fgA);
      if (outA > 0) {
        png.data[idx] = Math.round((r * fgA + png.data[idx] * bgA * (1 - fgA)) / outA);
        png.data[idx + 1] = Math.round((g * fgA + png.data[idx + 1] * bgA * (1 - fgA)) / outA);
        png.data[idx + 2] = Math.round((b * fgA + png.data[idx + 2] * bgA * (1 - fgA)) / outA);
        png.data[idx + 3] = Math.round(outA * 255);
      }
    } else {
      png.data[idx] = r;
      png.data[idx + 1] = g;
      png.data[idx + 2] = b;
      png.data[idx + 3] = 255;
    }
  };

  // 1. 전체 배경 투명 초기화
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      setPixel(x, y, 0, 0, 0, 0);
    }
  }

  const s = size / 512; // 스케일 팩터

  // 2. 그림자 (Shadow)
  const shadowX = 64 * s;
  const shadowY = 72 * s;
  const noteW = 384 * s;
  const noteH = 384 * s;
  const r = 36 * s;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // 노트 영역 + 그림자
      if (x >= shadowX - 10 && x <= shadowX + noteW + 10 && y >= shadowY - 4 && y <= shadowY + noteH + 16) {
        const dx = Math.max(0, Math.max(shadowX - x, x - (shadowX + noteW)));
        const dy = Math.max(0, Math.max(shadowY - y, y - (shadowY + noteH)));
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist <= 16 * s) {
          const alpha = Math.max(0, 1 - dist / (16 * s)) * 45;
          setPixel(x, y, 15, 23, 42, alpha);
        }
      }
    }
  }

  // 3. 메인 포스트잇 스티커 사각형 (바닐라 / 옐로우)
  const nX = 60 * s;
  const nY = 60 * s;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (x >= nX && x <= nX + noteW && y >= nY && y <= nY + noteH) {
        // 모서리 둥글기
        const cx = x < nX + r ? nX + r : x > nX + noteW - r ? nX + noteW - r : x;
        const cy = y < nY + r ? nY + r : y > nY + noteH - r ? nY + noteH - r : y;
        const d = Math.hypot(x - cx, y - cy);
        if (d <= r) {
          // 상단에서 하단으로 은은한 그라데이션
          const t = (y - nY) / noteH;
          // #FEF08A (254, 240, 138) -> #FDE047 (253, 224, 71)
          const red = Math.round(254 - t * 3);
          const green = Math.round(242 - t * 18);
          const blue = Math.round(145 - t * 65);
          setPixel(x, y, red, green, blue, 255);
        }
      }
    }
  }

  // 4. 스티커 테두리 은은한 골드 라인
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (x >= nX && x <= nX + noteW && y >= nY && y <= nY + noteH) {
        const cx = x < nX + r ? nX + r : x > nX + noteW - r ? nX + noteW - r : x;
        const cy = y < nY + r ? nY + r : y > nY + noteH - r ? nY + noteH - r : y;
        const d = Math.hypot(x - cx, y - cy);
        if (d >= r - 2 * s && d <= r) {
          setPixel(x, y, 245, 158, 11, 160);
        }
      }
    }
  }

  // 5. 상단 감성 마스킹 테이프 (핑크 코랄 반투명 테이프)
  const tapeX = 186 * s;
  const tapeY = 36 * s;
  const tapeW = 140 * s;
  const tapeH = 46 * s;

  for (let y = tapeY; y < tapeY + tapeH; y++) {
    for (let x = tapeX; x < tapeX + tapeW; x++) {
      // 약간 기울어진 각도 (시각적 리듬)
      const rotY = y + (x - tapeX) * 0.05;
      if (rotY >= tapeY && rotY <= tapeY + tapeH) {
        // 반투명 파스텔 코랄 핑크
        setPixel(Math.round(x), Math.round(rotY), 244, 114, 182, 195);
      }
    }
  }

  // 6. 가로 노트 필기 가이드 라인 3개
  const lineX1 = 110 * s;
  const lineX2 = 402 * s;
  const lineYs = [170 * s, 230 * s, 290 * s];

  lineYs.forEach((ly) => {
    for (let x = lineX1; x <= lineX2; x++) {
      for (let y = ly; y < ly + 3 * s; y++) {
        setPixel(Math.round(x), Math.round(y), 217, 119, 6, 95);
      }
    }
  });

  // 7. 중앙의 만년필 펜촉 심볼 (Pen Nib Symbol)
  const penCenterX = 256 * s;
  const penTopY = 160 * s;
  const penBottomY = 340 * s;

  for (let y = penTopY; y <= penBottomY; y++) {
    // 펜촉의 역삼각형 / 다이아몬드 윤곽
    const progress = (y - penTopY) / (penBottomY - penTopY);
    let halfWidth = 0;
    if (progress < 0.25) {
      halfWidth = (progress / 0.25) * 48 * s;
    } else if (progress < 0.65) {
      halfWidth = (48 - (progress - 0.25) * 20) * s;
    } else {
      halfWidth = (40 - (progress - 0.65) * 90) * s;
    }
    halfWidth = Math.max(3 * s, halfWidth);

    for (let x = penCenterX - halfWidth; x <= penCenterX + halfWidth; x++) {
      // 펜촉 바디 (다크 슬레이트 네이비 #0F172A)
      setPixel(Math.round(x), Math.round(y), 15, 23, 42, 255);
    }
  }

  // 펜촉 골드 장식 팁 (하단 뾰족한 부분)
  for (let y = penBottomY - 45 * s; y <= penBottomY; y++) {
    const progress = (y - (penBottomY - 45 * s)) / (45 * s);
    const halfWidth = Math.max(2 * s, (1 - progress) * 16 * s);
    for (let x = penCenterX - halfWidth; x <= penCenterX + halfWidth; x++) {
      setPixel(Math.round(x), Math.round(y), 245, 158, 11, 255);
    }
  }

  // 펜촉 중심 슬릿 구멍 (원형 홀 & 라인)
  const holeY = 240 * s;
  const holeR = 8 * s;
  for (let y = holeY - holeR; y <= holeY + holeR; y++) {
    for (let x = penCenterX - holeR; x <= penCenterX + holeR; x++) {
      if (Math.hypot(x - penCenterX, y - holeY) <= holeR) {
        setPixel(Math.round(x), Math.round(y), 253, 224, 71, 255);
      }
    }
  }
  for (let y = holeY; y <= penBottomY - 4 * s; y++) {
    for (let x = penCenterX - 1.5 * s; x <= penCenterX + 1.5 * s; x++) {
      setPixel(Math.round(x), Math.round(y), 253, 224, 71, 255);
    }
  }

  // 8. 우측 하단 반짝이는 별 (Sparkle)
  const starX = 390 * s;
  const starY = 380 * s;
  const starSize = 24 * s;
  for (let y = starY - starSize; y <= starY + starSize; y++) {
    for (let x = starX - starSize; x <= starX + starSize; x++) {
      const dx = Math.abs(x - starX);
      const dy = Math.abs(y - starY);
      if (dx * dy < 16 * s * s) {
        const factor = Math.max(0, 1 - (dx + dy) / (starSize * 1.4));
        if (factor > 0) {
          setPixel(Math.round(x), Math.round(y), 217, 119, 6, Math.round(factor * 255));
        }
      }
    }
  }

  return png;
}

// 아이콘 파일들 저장
const assetsDir = path.join(__dirname, '..', 'assets');
if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}

console.log('Generating Note App icons...');

// 1. icon.png (512x512)
const icon512 = createNoteIcon(512);
icon512.pack().pipe(fs.createWriteStream(path.join(assetsDir, 'icon.png'))).on('finish', () => {
  console.log('✓ assets/icon.png created (512x512)');
});

// 2. adaptive-icon.png (512x512)
const adaptiveIcon = createNoteIcon(512);
adaptiveIcon.pack().pipe(fs.createWriteStream(path.join(assetsDir, 'adaptive-icon.png'))).on('finish', () => {
  console.log('✓ assets/adaptive-icon.png created (512x512)');
});

// 3. splash-icon.png (512x512)
const splashIcon = createNoteIcon(512);
splashIcon.pack().pipe(fs.createWriteStream(path.join(assetsDir, 'splash-icon.png'))).on('finish', () => {
  console.log('✓ assets/splash-icon.png created (512x512)');
});

// 4. favicon.png (64x64)
const favicon = createNoteIcon(64);
favicon.pack().pipe(fs.createWriteStream(path.join(assetsDir, 'favicon.png'))).on('finish', () => {
  console.log('✓ assets/favicon.png created (64x64)');
});
