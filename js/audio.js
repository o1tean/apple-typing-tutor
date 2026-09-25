/**
 * Apple-grade Acoustic Engine
 * Pure Web Audio API synthesis - zero latency, realistic scissor-switch & mechanical clicks.
 */

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.isMuted = false;
    this.volume = 0.6; // 0.0 to 1.0
    this.profile = 'magic'; // 'magic', 'thock', 'bubble', 'clicky'
    this.initialized = false;
  }

  init() {
    if (this.initialized) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
      this.initialized = true;
    } catch (e) {
      console.warn('Web Audio not supported:', e);
    }
  }

  ensureContext() {
    if (!this.initialized) {
      this.init();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(error => console.warn('Could not resume audio:', error));
    }
  }

  setMuted(muted) {
    this.isMuted = muted;
  }

  setVolume(vol) {
    this.volume = Math.max(0, Math.min(1, vol));
  }

  setProfile(profile) {
    this.profile = profile;
  }

  playKey() {
    if (this.isMuted || this.volume === 0) return;
    this.ensureContext();
    if (!this.ctx) return;

    switch (this.profile) {
      case 'magic':
        this.playMagicScissor();
        break;
      case 'thock':
        this.playThock();
        break;
      case 'bubble':
        this.playBubble();
        break;
      case 'clicky':
        this.playClicky();
        break;
      default:
        this.playMagicScissor();
    }
  }

  /**
   * Apple Magic Keyboard scissor switch sound:
   * Quick crisp snap + damped low resonance thud.
   */
  playMagicScissor() {
    const t = this.ctx.currentTime;
    const gain = this.ctx.createGain();
    gain.connect(this.ctx.destination);

    // Micro pitch variation for realistic human typing
    const pitchJitter = 1 + (Math.random() - 0.5) * 0.12;

    // High snap (plastic scissor switch crisp snap)
    const snapOsc = this.ctx.createOscillator();
    const snapGain = this.ctx.createGain();
    const snapFilter = this.ctx.createBiquadFilter();

    snapOsc.type = 'triangle';
    snapOsc.frequency.setValueAtTime(3200 * pitchJitter, t);
    snapOsc.frequency.exponentialRampToValueAtTime(800, t + 0.018);

    snapFilter.type = 'bandpass';
    snapFilter.frequency.setValueAtTime(3500, t);
    snapFilter.Q.setValueAtTime(3.0, t);

    snapGain.gain.setValueAtTime(this.volume * 0.45, t);
    snapGain.gain.exponentialRampToValueAtTime(0.001, t + 0.022);

    snapOsc.connect(snapFilter);
    snapFilter.connect(snapGain);
    snapGain.connect(gain);

    snapOsc.start(t);
    snapOsc.stop(t + 0.025);

    // Low damp thud (bottom out of the low travel key)
    const thudOsc = this.ctx.createOscillator();
    const thudGain = this.ctx.createGain();

    thudOsc.type = 'sine';
    thudOsc.frequency.setValueAtTime(380 * pitchJitter, t);
    thudOsc.frequency.exponentialRampToValueAtTime(90, t + 0.035);

    thudGain.gain.setValueAtTime(this.volume * 0.35, t);
    thudGain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);

    thudOsc.connect(thudGain);
    thudGain.connect(gain);

    thudOsc.start(t);
    thudOsc.stop(t + 0.042);
  }

  /**
   * Deep Custom Mechanical Keyboard Thock
   */
  playThock() {
    const t = this.ctx.currentTime;
    const pitchJitter = 1 + (Math.random() - 0.5) * 0.1;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(260 * pitchJitter, t);
    osc.frequency.exponentialRampToValueAtTime(60, t + 0.05);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1400, t);

    gain.gain.setValueAtTime(this.volume * 0.7, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + 0.065);
  }

  /**
   * Soft Bubble Pop
   */
  playBubble() {
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(450, t);
    osc.frequency.exponentialRampToValueAtTime(900, t + 0.03);

    gain.gain.setValueAtTime(this.volume * 0.5, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + 0.055);
  }

  /**
   * Classic Mechanical Blue Clicky
   */
  playClicky() {
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(4800, t);
    osc.frequency.exponentialRampToValueAtTime(1200, t + 0.015);

    gain.gain.setValueAtTime(this.volume * 0.35, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.02);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + 0.022);
  }

  /**
   * Polite error bump (tactile soft thud)
   */
  playError() {
    if (this.isMuted || this.volume === 0) return;
    this.ensureContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(160, t);
    osc.frequency.exponentialRampToValueAtTime(90, t + 0.1);

    gain.gain.setValueAtTime(this.volume * 0.35, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + 0.13);
  }

  /**
   * Apple Glass Chime for lesson completion
   * Harmonic triad with subtle shimmer
   */
  playSuccess() {
    if (this.isMuted || this.volume === 0) return;
    this.ensureContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6 (Major 7th chime)

    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const delay = idx * 0.08;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t + delay);

      gain.gain.setValueAtTime(0, t + delay);
      gain.gain.linearRampToValueAtTime(this.volume * 0.25, t + delay + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + delay + 0.8);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(t + delay);
      osc.stop(t + delay + 0.85);
    });
  }
}

export const sound = new AudioEngine();
