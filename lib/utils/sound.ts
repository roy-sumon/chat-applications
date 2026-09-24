// Web Audio API synthesized notification sounds (no external audio files required)

let audioCtx: AudioContext | null = null;

const getAudioContext = (): AudioContext | null => {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
};

export const isSoundEnabled = (): boolean => {
  if (typeof window === "undefined") return true;
  const saved = localStorage.getItem("pulse_sound_enabled");
  return saved !== "false";
};

export const setSoundEnabled = (enabled: boolean): void => {
  if (typeof window === "undefined") return;
  localStorage.setItem("pulse_sound_enabled", enabled ? "true" : "false");
};

// Play subtle pop on sending message
export const playSendSound = (): void => {
  if (!isSoundEnabled()) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(600, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(900, ctx.currentTime + 0.08);

    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.08);
  } catch {
    // audio context not allowed yet
  }
};

// Play pleasant two-tone chime on receiving message
export const playReceiveSound = (): void => {
  if (!isSoundEnabled()) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    // Tone 1
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    gain1.gain.setValueAtTime(0.08, ctx.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);

    // Tone 2
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(880, ctx.currentTime + 0.08); // A5
    gain2.gain.setValueAtTime(0.09, ctx.currentTime + 0.08);
    gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);

    osc1.start(ctx.currentTime);
    osc1.stop(ctx.currentTime + 0.12);

    osc2.start(ctx.currentTime + 0.08);
    osc2.stop(ctx.currentTime + 0.22);
  } catch {
    // audio context not allowed yet
  }
};
