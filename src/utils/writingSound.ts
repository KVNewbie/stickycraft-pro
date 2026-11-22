import { Platform } from 'react-native';

/**
 * 초저지연(Zero-Latency) 종이 필기 사각사각(ASMR) 사운드 합성 엔진
 * - 메인 스레드 렌더링(60~120fps)에 전혀 부하를 주지 않도록 단일 루프 노이즈 버퍼와
 *   Web Audio API 하드웨어 오디오 스레드의 Gain/Filter 파라메트릭 모듈레이션을 사용합니다.
 * - 펜 이동 속도에 비례해 사각거리는 마찰음 음량과 주파수가 자연스럽게 변화하며,
 *   펜이 멈추거나 떼어지는 즉시 0으로 감쇠됩니다.
 */

let audioCtx: AudioContext | null = null;
let noiseSource: AudioBufferSourceNode | null = null;
let bandpassFilter: BiquadFilterNode | null = null;
let highpassFilter: BiquadFilterNode | null = null;
let gainNode: GainNode | null = null;
let silenceTimer: any = null;
let isEngineInitialized = false;

function initAudioEngine() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return false;
  if (isEngineInitialized && audioCtx && gainNode && bandpassFilter) {
    if (audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
    return true;
  }

  try {
    const AudioContextClass =
      (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return false;

    const ctx: AudioContext = new AudioContextClass();
    audioCtx = ctx;

    // 2초 길이의 종이 질감(Paper Grain) 핑크+화이트 노이즈 버퍼 생성
    const sampleRate = ctx.sampleRate;
    const bufferSize = sampleRate * 2;
    const buffer = ctx.createBuffer(1, bufferSize, sampleRate);
    const output = buffer.getChannelData(0);

    let b0 = 0,
      b1 = 0,
      b2 = 0,
      b3 = 0,
      b4 = 0,
      b5 = 0,
      b6 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      // 종이 표면의 미세한 결(Grain envelope) 부여
      const grain = 0.78 + 0.22 * Math.sin(i * 0.017) * Math.cos(i * 0.0053);
      output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.045 * grain;
      b6 = white * 0.115926;
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 720;

    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1950;
    bp.Q.value = 1.65;

    const gain = ctx.createGain();
    gain.gain.value = 0;

    source.connect(hp);
    hp.connect(bp);
    bp.connect(gain);
    gain.connect(ctx.destination);

    source.start(0);

    noiseSource = source;
    highpassFilter = hp;
    bandpassFilter = bp;
    gainNode = gain;
    isEngineInitialized = true;
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * 펜/형광펜 이동 시 실시간 사각사각 마찰음 업데이트
 */
export function triggerWritingScratch(
  dx: number,
  dy: number,
  enabled: boolean,
  tool: string = 'fountain'
) {
  if (!enabled || Platform.OS !== 'web') return;
  if (!initAudioEngine() || !audioCtx || !gainNode || !bandpassFilter) return;

  const dist = Math.hypot(dx, dy);
  if (dist < 0.4) return;

  const now = audioCtx.currentTime;

  // 도구별 고유 주파수 톤 (만년필/볼펜: 사각사각한 연필/펜 마찰음, 형광펜: 부드러운 마커 마찰음)
  const baseFreq =
    tool === 'highlighter' ? 1350 : tool === 'fountain' ? 2100 : 1850;
  const speedBoost = Math.min(950, dist * 24);
  bandpassFilter.frequency.setTargetAtTime(baseFreq + speedBoost, now, 0.012);

  // 이동 속도에 비례한 자연스러운 볼륨 (너무 시끄럽지 않고 기분 좋은 ASMR 레벨)
  const targetGain = Math.min(0.24, 0.045 + dist * 0.0065);
  gainNode.gain.setTargetAtTime(targetGain, now, 0.01);

  if (silenceTimer) clearTimeout(silenceTimer);
  silenceTimer = setTimeout(() => {
    if (audioCtx && gainNode) {
      gainNode.gain.setTargetAtTime(0, audioCtx.currentTime, 0.018);
    }
  }, 45);
}

/**
 * 펜을 떼었을 때 즉시 사각거리는 소리 정지
 */
export function stopWritingScratch() {
  if (silenceTimer) {
    clearTimeout(silenceTimer);
    silenceTimer = null;
  }
  if (audioCtx && gainNode) {
    try {
      gainNode.gain.setTargetAtTime(0, audioCtx.currentTime, 0.015);
    } catch {}
  }
}

/**
 * 설정에서 필기 소리 ON 전환 시 짧은 '사각-사각' 미리듣기 사운드 재생
 */
export function playWritingSoundPreview() {
  if (Platform.OS !== 'web') return;
  if (!initAudioEngine() || !audioCtx || !gainNode || !bandpassFilter) return;

  const now = audioCtx.currentTime;
  bandpassFilter.frequency.setValueAtTime(1950, now);
  gainNode.gain.cancelScheduledValues(now);
  gainNode.gain.setValueAtTime(0.01, now);
  // 첫 번째 획 '사각'
  gainNode.gain.linearRampToValueAtTime(0.18, now + 0.04);
  bandpassFilter.frequency.linearRampToValueAtTime(2450, now + 0.12);
  gainNode.gain.linearRampToValueAtTime(0.02, now + 0.14);
  // 두 번째 획 '사각'
  gainNode.gain.linearRampToValueAtTime(0.16, now + 0.19);
  bandpassFilter.frequency.linearRampToValueAtTime(2200, now + 0.28);
  gainNode.gain.linearRampToValueAtTime(0, now + 0.32);
}
