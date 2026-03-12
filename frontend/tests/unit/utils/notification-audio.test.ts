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
  const originalAudioContext = (globalThis.window as Window & { AudioContext?: unknown }).AudioContext;
  const originalWebkitAudioContext = (globalThis.window as Window & { webkitAudioContext?: unknown }).webkitAudioContext;

  beforeEach(() => {
    vi.useFakeTimers();
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
    expect(context.createOscillator).toHaveBeenCalledTimes(3);
    expect(context.createGain).toHaveBeenCalledTimes(4);

    const firstOscillator = context.createOscillator.mock.results[0]?.value;
    expect(firstOscillator.frequency.setValueAtTime).toHaveBeenCalledWith(880, 1);
    expect(firstOscillator.start).toHaveBeenCalledTimes(1);
    expect(firstOscillator.stop).toHaveBeenCalledWith(1.8399999999999999);

    await vi.runAllTimersAsync();
    expect(context.close).toHaveBeenCalledTimes(1);
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
