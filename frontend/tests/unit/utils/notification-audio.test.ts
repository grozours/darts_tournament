import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { playBellNotificationTone } from '../../../src/utils/notification-audio';

type FakeAudioContextInstance = {
  currentTime: number;
  state: 'running' | 'suspended';
  destination: { id: string };
  resume: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
  createOscillator: ReturnType<typeof vi.fn>;
  createGain: ReturnType<typeof vi.fn>;
};

const makeFakeAudioContextConstructor = (state: 'running' | 'suspended' = 'running') => {
  const instances: FakeAudioContextInstance[] = [];

  class FakeAudioContext {
    currentTime = 1;
    state = state;
    destination = { id: 'dest' };
    resume = vi.fn(async () => undefined);
    close = vi.fn(async () => undefined);
    createOscillator = vi.fn(() => {
      return {
        type: 'sine' as OscillatorType,
        frequency: {
          setValueAtTime: vi.fn(),
        },
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
      };
    });
    createGain = vi.fn(() => {
      return {
        gain: {
          setValueAtTime: vi.fn(),
          exponentialRampToValueAtTime: vi.fn(),
        },
        connect: vi.fn(),
      };
    });

    constructor() {
      instances.push(this as unknown as FakeAudioContextInstance);
    }
  }

  return { ctor: FakeAudioContext, instances };
};

describe('notification-audio', () => {
  const originalAudio = globalThis.Audio;
  const originalAudioContext = (globalThis.window as Window & { AudioContext?: unknown }).AudioContext;
  const originalWebkitAudioContext = (globalThis.window as Window & { webkitAudioContext?: unknown }).webkitAudioContext;

  beforeEach(() => {
    vi.useFakeTimers();
    Object.defineProperty(globalThis, 'Audio', {
      value: undefined,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(globalThis.window, 'AudioContext', {
      value: undefined,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(globalThis.window, 'webkitAudioContext', {
      value: undefined,
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    Object.defineProperty(globalThis, 'Audio', {
      value: originalAudio,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(globalThis.window, 'AudioContext', {
      value: originalAudioContext,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(globalThis.window, 'webkitAudioContext', {
      value: originalWebkitAudioContext,
      writable: true,
      configurable: true,
    });
  });

  it('returns without throwing when no audio context is available', async () => {
    await expect(playBellNotificationTone()).resolves.toBeUndefined();
  });

  it('plays custom match.mp3 when Audio is available', async () => {
    const play = vi.fn(async () => undefined);
    const instances: Array<{ play: ReturnType<typeof vi.fn>; volume: number; currentTime: number }> = [];

    class FakeAudio {
      preload = 'none';
      volume = 0;
      currentTime = 3;
      play = play;

      constructor() {
        instances.push(this);
      }
    }

    Object.defineProperty(globalThis, 'Audio', {
      value: FakeAudio,
      writable: true,
      configurable: true,
    });

    await playBellNotificationTone({ preview: true });

    expect(instances).toHaveLength(1);
    expect(play).toHaveBeenCalledTimes(1);
    expect(instances[0]?.volume).toBe(0.35);
    expect(instances[0]?.currentTime).toBe(0);
  });

  it('plays bell tone and closes context using AudioContext', async () => {
    const { ctor, instances } = makeFakeAudioContextConstructor('running');
    Object.defineProperty(globalThis.window, 'AudioContext', {
      value: ctor,
      writable: true,
      configurable: true,
    });

    await playBellNotificationTone();

    expect(instances).toHaveLength(1);

    const context = instances[0]!;
    expect(context.resume).not.toHaveBeenCalled();
    expect(context.createOscillator).toHaveBeenCalledTimes(9);
    expect(context.createGain).toHaveBeenCalledTimes(10);

    const firstOscillator = context.createOscillator.mock.results[0]?.value;
    expect(firstOscillator.frequency.setValueAtTime).toHaveBeenCalledWith(880, 1);
    expect(firstOscillator.start).toHaveBeenCalledWith(1);
    expect(firstOscillator.stop).toHaveBeenCalledWith(1.57);

    const fourthOscillator = context.createOscillator.mock.results[3]?.value;
    expect(fourthOscillator.frequency.setValueAtTime).toHaveBeenCalledWith(880, 2);
    expect(fourthOscillator.start).toHaveBeenCalledWith(2);
    expect(fourthOscillator.stop).toHaveBeenCalledWith(2.57);

    const seventhOscillator = context.createOscillator.mock.results[6]?.value;
    expect(seventhOscillator.frequency.setValueAtTime).toHaveBeenCalledWith(880, 3);
    expect(seventhOscillator.start).toHaveBeenCalledWith(3);
    expect(seventhOscillator.stop).toHaveBeenCalledWith(3.57);

    await vi.runAllTimersAsync();
    expect(context.close).toHaveBeenCalledTimes(1);
  });

  it('falls back to synthesized tone when mp3 playback fails', async () => {
    class FailingAudio {
      preload = 'none';
      volume = 0;
      currentTime = 0;

      constructor() {}

      async play(): Promise<void> {
        throw new Error('play failed');
      }
    }

    Object.defineProperty(globalThis, 'Audio', {
      value: FailingAudio,
      writable: true,
      configurable: true,
    });

    const { ctor, instances } = makeFakeAudioContextConstructor('running');
    Object.defineProperty(globalThis.window, 'AudioContext', {
      value: ctor,
      writable: true,
      configurable: true,
    });

    await playBellNotificationTone();

    expect(instances).toHaveLength(1);
    expect(instances[0]?.createOscillator).toHaveBeenCalledTimes(9);
  });

  it('uses webkitAudioContext fallback, resumes when suspended, and applies preview gain', async () => {
    const { ctor, instances } = makeFakeAudioContextConstructor('suspended');
    Object.defineProperty(globalThis.window, 'webkitAudioContext', {
      value: ctor,
      writable: true,
      configurable: true,
    });

    await playBellNotificationTone({ preview: true });

    const context = instances[0]!;
    expect(context.resume).toHaveBeenCalledTimes(1);

    const outputGain = context.createGain.mock.results[0]?.value;
    expect(outputGain.gain.setValueAtTime).toHaveBeenCalledWith(0.35, 1);

    await vi.runAllTimersAsync();
    expect(context.close).toHaveBeenCalledTimes(1);
  });
});
