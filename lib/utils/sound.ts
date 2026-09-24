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

// Auto-unlock AudioContext on first user interaction anywhere in the window
if (typeof window !== "undefined") {
  const unlockAudioContext = () => {
    if (audioCtx && audioCtx.state === "suspended") {
      audioCtx.resume().catch(() => {});
    }
  };
  window.addEventListener("click", unlockAudioContext, { passive: true });
  window.addEventListener("touchstart", unlockAudioContext, { passive: true });
  window.addEventListener("keydown", unlockAudioContext, { passive: true });
}

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

// Global registry of active ringtone resources
let activeRingtoneTimers: NodeJS.Timeout[] = [];
let activeRingtoneOscillators: OscillatorNode[] = [];
let activeRingtoneGains: GainNode[] = [];

// Instantly silence and terminate all running ringtones and pending pulses
export const stopAllRingtones = (): void => {
  activeRingtoneTimers.forEach((t) => clearTimeout(t));
  activeRingtoneTimers = [];

  activeRingtoneGains.forEach((g) => {
    try {
      if (audioCtx) {
        g.gain.cancelScheduledValues(audioCtx.currentTime);
        g.gain.setValueAtTime(0, audioCtx.currentTime);
      }
      g.disconnect();
    } catch {}
  });
  activeRingtoneGains = [];

  activeRingtoneOscillators.forEach((osc) => {
    try {
      osc.stop();
      osc.disconnect();
    } catch {}
  });
  activeRingtoneOscillators = [];
};

// Start soft ringing sound for incoming/outgoing call (returns stop function)
export const startRingtone = (): (() => void) => {
  stopAllRingtones();

  if (!isSoundEnabled()) return () => {};

  let isPlaying = true;

  const playRingPulse = () => {
    if (!isPlaying) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      if (ctx.state === "suspended") {
        ctx.resume().catch(() => {});
      }

      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = "sine";
      osc2.type = "sine";
      osc1.frequency.setValueAtTime(440, ctx.currentTime); // A4
      osc2.frequency.setValueAtTime(480, ctx.currentTime); // B4

      gain.gain.setValueAtTime(0.065, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 1.2);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      activeRingtoneOscillators.push(osc1, osc2);
      activeRingtoneGains.push(gain);

      osc1.start(ctx.currentTime);
      osc2.start(ctx.currentTime);
      osc1.stop(ctx.currentTime + 1.2);
      osc2.stop(ctx.currentTime + 1.2);

      setTimeout(() => {
        activeRingtoneOscillators = activeRingtoneOscillators.filter((o) => o !== osc1 && o !== osc2);
        activeRingtoneGains = activeRingtoneGains.filter((g) => g !== gain);
      }, 1300);

      const timer = setTimeout(playRingPulse, 3000);
      activeRingtoneTimers.push(timer);
    } catch {
      // ignore
    }
  };

  playRingPulse();

  return () => {
    isPlaying = false;
    stopAllRingtones();
  };
};

// Start distinct slow connecting tone when calling an offline recipient (WhatsApp / Messenger style)
export const startOfflineRingtone = (): (() => void) => {
  stopAllRingtones();

  if (!isSoundEnabled()) return () => {};

  let isPlaying = true;

  const playOfflinePulse = () => {
    if (!isPlaying) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      if (ctx.state === "suspended") {
        ctx.resume().catch(() => {});
      }

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(360, ctx.currentTime); // Low single connecting tone

      gain.gain.setValueAtTime(0.05, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);

      activeRingtoneOscillators.push(osc);
      activeRingtoneGains.push(gain);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.35);

      setTimeout(() => {
        activeRingtoneOscillators = activeRingtoneOscillators.filter((o) => o !== osc);
        activeRingtoneGains = activeRingtoneGains.filter((g) => g !== gain);
      }, 400);

      const timer = setTimeout(playOfflinePulse, 2200);
      activeRingtoneTimers.push(timer);
    } catch {
      // ignore
    }
  };

  playOfflinePulse();

  return () => {
    isPlaying = false;
    stopAllRingtones();
  };
};

// Play short phone hang-up sound
export const playCallEndSound = (): void => {
  stopAllRingtones();
  if (!isSoundEnabled()) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }

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
  stopAllRingtones();
  if (!isSoundEnabled()) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }

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
