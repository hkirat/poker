import { useCallback, useRef, useEffect } from 'react';

type SoundType =
  | 'cardDeal'
  | 'cardFlip'
  | 'chipsBet'
  | 'chipsWin'
  | 'fold'
  | 'check'
  | 'yourTurn'
  | 'timerWarning'
  | 'message';

// Audio context singleton
let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  }
  return audioContext;
}

// Generate sound effects using Web Audio API
function createOscillatorSound(
  ctx: AudioContext,
  frequency: number,
  duration: number,
  type: OscillatorType = 'sine',
  volume: number = 0.3
): void {
  const oscillator = ctx.createOscillator();
  const gainNode = ctx.createGain();

  oscillator.connect(gainNode);
  gainNode.connect(ctx.destination);

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);

  gainNode.gain.setValueAtTime(volume, ctx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);

  oscillator.start(ctx.currentTime);
  oscillator.stop(ctx.currentTime + duration);
}

function createNoiseSound(ctx: AudioContext, duration: number, volume: number = 0.1): void {
  const bufferSize = ctx.sampleRate * duration;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);

  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.3));
  }

  const source = ctx.createBufferSource();
  const gainNode = ctx.createGain();
  const filter = ctx.createBiquadFilter();

  source.buffer = buffer;
  filter.type = 'lowpass';
  filter.frequency.value = 2000;

  source.connect(filter);
  filter.connect(gainNode);
  gainNode.connect(ctx.destination);

  gainNode.gain.setValueAtTime(volume, ctx.currentTime);
  source.start();
}

const soundGenerators: Record<SoundType, (ctx: AudioContext) => void> = {
  cardDeal: (ctx) => {
    // Quick swoosh sound
    createNoiseSound(ctx, 0.1, 0.15);
    setTimeout(() => createOscillatorSound(ctx, 800, 0.05, 'sine', 0.1), 50);
  },

  cardFlip: (ctx) => {
    createNoiseSound(ctx, 0.08, 0.1);
  },

  chipsBet: (ctx) => {
    // Chip clinking sound
    for (let i = 0; i < 3; i++) {
      setTimeout(() => {
        createOscillatorSound(ctx, 2000 + Math.random() * 500, 0.05, 'sine', 0.15);
        createNoiseSound(ctx, 0.03, 0.08);
      }, i * 30);
    }
  },

  chipsWin: (ctx) => {
    // Celebration sound - ascending notes
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    notes.forEach((freq, i) => {
      setTimeout(() => {
        createOscillatorSound(ctx, freq, 0.3, 'sine', 0.2);
      }, i * 100);
    });
    // Add some chip sounds
    for (let i = 0; i < 5; i++) {
      setTimeout(() => {
        createOscillatorSound(ctx, 2000 + Math.random() * 500, 0.05, 'sine', 0.1);
        createNoiseSound(ctx, 0.03, 0.05);
      }, 400 + i * 50);
    }
  },

  fold: (ctx) => {
    // Descending tone
    createOscillatorSound(ctx, 400, 0.15, 'sine', 0.15);
    setTimeout(() => createOscillatorSound(ctx, 300, 0.15, 'sine', 0.1), 100);
  },

  check: (ctx) => {
    // Quick tap sound
    createOscillatorSound(ctx, 600, 0.1, 'sine', 0.15);
  },

  yourTurn: (ctx) => {
    // Alert sound - two quick beeps
    createOscillatorSound(ctx, 880, 0.15, 'sine', 0.2);
    setTimeout(() => createOscillatorSound(ctx, 1100, 0.15, 'sine', 0.2), 200);
  },

  timerWarning: (ctx) => {
    // Urgent beep
    createOscillatorSound(ctx, 1000, 0.1, 'square', 0.15);
  },

  message: (ctx) => {
    // Soft notification
    createOscillatorSound(ctx, 700, 0.1, 'sine', 0.1);
    setTimeout(() => createOscillatorSound(ctx, 900, 0.15, 'sine', 0.1), 80);
  },
};

interface UseSoundReturn {
  playSound: (sound: SoundType) => void;
  isMuted: boolean;
  toggleMute: () => void;
}

export function useSound(): UseSoundReturn {
  const isMutedRef = useRef(false);
  const lastPlayedRef = useRef<Record<string, number>>({});

  // Load mute preference from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('poker-sound-muted');
    if (stored === 'true') {
      isMutedRef.current = true;
    }
  }, []);

  const playSound = useCallback((sound: SoundType) => {
    if (isMutedRef.current) return;

    // Debounce same sound within 50ms
    const now = Date.now();
    if (lastPlayedRef.current[sound] && now - lastPlayedRef.current[sound] < 50) {
      return;
    }
    lastPlayedRef.current[sound] = now;

    try {
      const ctx = getAudioContext();
      // Resume audio context if suspended (browser autoplay policy)
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
      soundGenerators[sound](ctx);
    } catch (error) {
      console.warn('Failed to play sound:', error);
    }
  }, []);

  const toggleMute = useCallback(() => {
    isMutedRef.current = !isMutedRef.current;
    localStorage.setItem('poker-sound-muted', String(isMutedRef.current));
  }, []);

  return {
    playSound,
    isMuted: isMutedRef.current,
    toggleMute,
  };
}

// Create a global sound player for use outside of React components
export const globalSoundPlayer = {
  play: (sound: SoundType) => {
    const stored = localStorage.getItem('poker-sound-muted');
    if (stored === 'true') return;

    try {
      const ctx = getAudioContext();
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
      soundGenerators[sound](ctx);
    } catch (error) {
      console.warn('Failed to play sound:', error);
    }
  },
};
