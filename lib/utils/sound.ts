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

let lastSendSoundTime = 0;

// Play subtle single pop on sending message (debounced to prevent double triggers)
export const playSendSound = (): void => {
  const now = Date.now();
  if (now - lastSendSoundTime < 350) return;
  lastSendSoundTime = now;

  if (!isSoundEnabled()) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(750, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(450, ctx.currentTime + 0.06);

    gain.gain.setValueAtTime(0.06, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.06);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.07);
  } catch {
    // audio context not allowed yet
  }
};

let lastReceiveSoundTime = 0;

// Play pleasant single notification chime on receiving message (debounced to prevent double triggers)
export const playReceiveSound = (): void => {
  const now = Date.now();
  if (now - lastReceiveSoundTime < 500) return;
  lastReceiveSoundTime = now;

  if (!isSoundEnabled()) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(800, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1050, ctx.currentTime + 0.08);

    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.16);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.18);
  } catch {
    // audio context not allowed yet
  }
};

// Set of active ringtone stopper callbacks
const activeRingtoneStoppers = new Set<() => void>();

export const stopAllRingtones = (): void => {
  activeRingtoneStoppers.forEach((stop) => {
    try {
      stop();
    } catch {
      // ignore
    }
  });
  activeRingtoneStoppers.clear();
};

// Start soft ringing sound for incoming/outgoing call (returns stop function)
export const startRingtone = (): (() => void) => {
  if (!isSoundEnabled()) return () => {};

  let isPlaying = true;
  let timer: NodeJS.Timeout | null = null;

  const stop = () => {
    isPlaying = false;
    if (timer) clearTimeout(timer);
    activeRingtoneStoppers.delete(stop);
  };
  activeRingtoneStoppers.add(stop);

  const playRingPulse = () => {
    if (!isPlaying) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;

      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = "sine";
      osc2.type = "sine";
      osc1.frequency.setValueAtTime(440, ctx.currentTime); // A4
      osc2.frequency.setValueAtTime(480, ctx.currentTime); // B4

      gain.gain.setValueAtTime(0.06, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(ctx.currentTime);
      osc2.start(ctx.currentTime);
      osc1.stop(ctx.currentTime + 1.2);
      osc2.stop(ctx.currentTime + 1.2);

      timer = setTimeout(playRingPulse, 3000);
    } catch {
      // ignore
    }
  };

  playRingPulse();

  return stop;
};

// Start distinct slow connecting tone when calling an offline recipient (WhatsApp / Messenger style)
export const startOfflineRingtone = (): (() => void) => {
  if (!isSoundEnabled()) return () => {};

  let isPlaying = true;
  let timer: NodeJS.Timeout | null = null;

  const stop = () => {
    isPlaying = false;
    if (timer) clearTimeout(timer);
    activeRingtoneStoppers.delete(stop);
  };
  activeRingtoneStoppers.add(stop);

  const playOfflinePulse = () => {
    if (!isPlaying) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(360, ctx.currentTime); // Low single connecting tone

      gain.gain.setValueAtTime(0.045, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.35);

      timer = setTimeout(playOfflinePulse, 2200);
    } catch {
      // ignore
    }
  };

  playOfflinePulse();

  return stop;
};

// Play short phone hang-up sound
export const playCallEndSound = (): void => {
  if (!isSoundEnabled()) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    for (let i = 0; i < 2; i++) {
      const startTime = ctx.currentTime + i * 0.15;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(425, startTime);

      gain.gain.setValueAtTime(0.07, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.1);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + 0.1);
    }
  } catch {
    // ignore
  }
};

// Play pleasant ascending chime on call connection
export const playCallConnectSound = (): void => {
  if (!isSoundEnabled()) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
    notes.forEach((freq, idx) => {
      const startTime = ctx.currentTime + idx * 0.08;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.07, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.12);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + 0.12);
    });
  } catch {
    // ignore
  }
};
