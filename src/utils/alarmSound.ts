import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

/**
 * Web Audio API & Haptics 기반 알람/리마인더 사운드 재생기
 */
class AlarmSoundPlayer {
  private audioCtx: any = null;
  private intervalId: any = null;

  private getAudioContext() {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass && !this.audioCtx) {
        this.audioCtx = new AudioContextClass();
      }
    }
    return this.audioCtx;
  }

  /**
   * 경쾌한 2단계 차임벨 사운드 재생
   */
  public playAlarmChime() {
    try {
      // 햅틱 진동
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      }

      const ctx = this.getAudioContext();
      if (!ctx) return;

      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const now = ctx.currentTime;

      // Tone 1 (High chime)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(880, now); // A5
      gain1.gain.setValueAtTime(0.3, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.35);

      // Tone 2 (Higher resolve chime)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(1174.66, now + 0.2); // D6
      gain2.gain.setValueAtTime(0.35, now + 0.2);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.2);
      osc2.stop(now + 0.7);
    } catch (e) {
      console.warn('Alarm audio play error:', e);
    }
  }

  /**
   * 지속적인 알람 벨 울림 시작
   */
  public startRinging() {
    this.stopRinging();
    this.playAlarmChime();
    this.intervalId = setInterval(() => {
      this.playAlarmChime();
    }, 2000);
  }

  /**
   * 알람 소리 중지
   */
  public stopRinging() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}

export const alarmSound = new AlarmSoundPlayer();
