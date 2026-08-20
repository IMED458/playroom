// Web Audio API Sound Synthesizer for alerts without external files

class SoundManager {
  private ctx: AudioContext | null = null;
  private soundEnabled: boolean = true;

  constructor() {
    // Lazy initialize on first interaction
  }

  private getContext(): AudioContext | null {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  public setEnabled(enabled: boolean) {
    this.soundEnabled = enabled;
  }

  public playBeep(freq = 880, duration = 0.15, type: OscillatorType = 'sine') {
    if (!this.soundEnabled) return;
    try {
      const ctx = this.getContext();
      if (!ctx) return;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);

      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch {
      // Ignore audio context errors if not permitted yet
    }
  }

  public playSessionFinishedAlert() {
    if (!this.soundEnabled) return;
    // Play a friendly 3-tone notification chime
    this.playBeep(523.25, 0.12, 'sine'); // C5
    setTimeout(() => this.playBeep(659.25, 0.12, 'sine'), 130); // E5
    setTimeout(() => this.playBeep(783.99, 0.35, 'sine'), 260); // G5
  }

  public playSessionExpiringWarning() {
    if (!this.soundEnabled) return;
    this.playBeep(700, 0.1, 'triangle');
    setTimeout(() => this.playBeep(700, 0.1, 'triangle'), 150);
  }

  public playSuccessTone() {
    if (!this.soundEnabled) return;
    this.playBeep(587.33, 0.08, 'sine'); // D5
    setTimeout(() => this.playBeep(880, 0.2, 'sine'), 90); // A5
  }
}

export const sounds = new SoundManager();
