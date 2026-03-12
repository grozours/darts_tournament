import matchBellAudioFile from '../../sound/match.mp3';

type AudioContextConstructor = new () => AudioContext;

type WindowWithWebkitAudio = Window & {
  AudioContext?: AudioContextConstructor;
  webkitAudioContext?: AudioContextConstructor;
};

const getAudioContextConstructor = (): AudioContextConstructor | undefined => {
  const windowReference = globalThis.window as WindowWithWebkitAudio | undefined;
  if (!windowReference) {
    return undefined;
  }

  return windowReference.AudioContext ?? windowReference.webkitAudioContext;
};

const closeContextLater = (context: AudioContext, delayMs: number) => {
  globalThis.window?.setTimeout(() => {
    void context.close();
  }, delayMs);
};

const playMatchBellAudioFile = async (options?: { preview?: boolean }): Promise<boolean> => {
  const AudioCtor = globalThis.Audio;
  if (typeof AudioCtor !== 'function') {
    return false;
  }

  try {
    const audio = new AudioCtor(matchBellAudioFile);
    audio.preload = 'auto';
    audio.volume = options?.preview ? 0.35 : 1;
    audio.currentTime = 0;
    await audio.play();
    return true;
  } catch {
    return false;
  }
};

const BELL_MAX_DURATION_SECONDS = 3;
const BELL_STRIKE_INTERVAL_SECONDS = 1;

const addBellPartial = (
  context: AudioContext,
  destination: AudioNode,
  frequency: number,
  gainPeak: number,
  startTime: number,
  durationSeconds: number,
  type: OscillatorType = 'sine'
) => {
  const oscillator = context.createOscillator();
  const gain = context.createGain();

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, startTime);

  gain.gain.setValueAtTime(0.0001, startTime);
  gain.gain.exponentialRampToValueAtTime(gainPeak, startTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + durationSeconds);

  oscillator.connect(gain);
  gain.connect(destination);
  oscillator.start(startTime);
  oscillator.stop(startTime + durationSeconds + 0.02);
};

const playBellStrike = (context: AudioContext, destination: AudioNode, startTime: number) => {
  addBellPartial(context, destination, 880, 0.22, startTime, 0.55, 'triangle');
  addBellPartial(context, destination, 1320, 0.14, startTime, 0.45, 'sine');
  addBellPartial(context, destination, 1760, 0.09, startTime, 0.35, 'sine');
};

export const playBellNotificationTone = async (options?: { preview?: boolean }): Promise<void> => {
  const audioPlayed = await playMatchBellAudioFile(options);
  if (audioPlayed) {
    return;
  }

  const AudioContextCtor = getAudioContextConstructor();
  if (!AudioContextCtor) {
    return;
  }

  const context = new AudioContextCtor();
  try {
    if (context.state === 'suspended') {
      await context.resume();
    }

    const output = context.createGain();
    const masterGain = options?.preview ? 0.35 : 0.55;
    output.gain.setValueAtTime(masterGain, context.currentTime);
    output.connect(context.destination);

    // Same bell strike repeated three times to mimic a boxing-style round bell cadence.
    playBellStrike(context, output, context.currentTime);
    playBellStrike(context, output, context.currentTime + BELL_STRIKE_INTERVAL_SECONDS);
    playBellStrike(context, output, context.currentTime + (BELL_STRIKE_INTERVAL_SECONDS * 2));
  } finally {
    closeContextLater(context, Math.round(BELL_MAX_DURATION_SECONDS * 1000) + 120);
  }
};
