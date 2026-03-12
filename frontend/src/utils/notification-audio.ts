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

const BELL_MAX_DURATION_SECONDS = 0.95;

const addBellPartial = (
  context: AudioContext,
  destination: AudioNode,
  frequency: number,
  gainPeak: number,
  durationSeconds: number,
  type: OscillatorType = 'sine'
) => {
  const oscillator = context.createOscillator();
  const gain = context.createGain();

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, context.currentTime);

  gain.gain.setValueAtTime(0.0001, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(gainPeak, context.currentTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + durationSeconds);

  oscillator.connect(gain);
  gain.connect(destination);
  oscillator.start();
  oscillator.stop(context.currentTime + durationSeconds + 0.02);
};

export const playBellNotificationTone = async (options?: { preview?: boolean }): Promise<void> => {
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

    // Bell-like timbre with inharmonic partials and different decays (all under 1s).
    addBellPartial(context, output, 880, 0.22, Math.min(0.82, BELL_MAX_DURATION_SECONDS), 'triangle');
    addBellPartial(context, output, 1320, 0.14, Math.min(0.68, BELL_MAX_DURATION_SECONDS), 'sine');
    addBellPartial(context, output, 1760, 0.09, Math.min(0.52, BELL_MAX_DURATION_SECONDS), 'sine');
  } finally {
    closeContextLater(context, Math.round(BELL_MAX_DURATION_SECONDS * 1000) + 120);
  }
};
