export const DEFAULT_AMBIENT_BGM = 'ambient://gallery';

export function isAmbientBgmUrl(url?: string | null) {
  return typeof url === 'string' && url.startsWith('ambient://');
}

type AudioContextCtor = typeof AudioContext;

function getAudioContextCtor(): AudioContextCtor | null {
  if (typeof window === 'undefined') return null;
  return window.AudioContext || (window as unknown as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext || null;
}

function makeNoiseBuffer(context: AudioContext, seconds = 2) {
  const frameCount = Math.floor(context.sampleRate * seconds);
  const buffer = context.createBuffer(1, frameCount, context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let index = 0; index < frameCount; index += 1) {
    data[index] = Math.random() * 2 - 1;
  }
  return buffer;
}

export class AmbientAudioPlayer {
  private context: AudioContext | null = null;
  private nodes: AudioNode[] = [];
  private masterGain: GainNode | null = null;
  private currentUrl = DEFAULT_AMBIENT_BGM;

  async start(url = DEFAULT_AMBIENT_BGM) {
    this.currentUrl = url;
    if (!this.context) {
      const Ctor = getAudioContextCtor();
      if (!Ctor) return;
      this.context = new Ctor();
    }

    if (this.context.state === 'suspended') {
      await this.context.resume();
    }

    this.stopNodes();
    this.masterGain = this.context.createGain();
    this.masterGain.gain.value = 0.18;
    this.masterGain.connect(this.context.destination);
    this.buildSoundscape(url);
  }

  stop() {
    this.stopNodes();
    this.masterGain?.disconnect();
    this.masterGain = null;
  }

  setMuted(muted: boolean) {
    if (!this.masterGain || !this.context) return;
    this.masterGain.gain.setTargetAtTime(muted ? 0 : 0.18, this.context.currentTime, 0.08);
  }

  dispose() {
    this.stop();
    this.context?.close().catch(() => undefined);
    this.context = null;
  }

  private buildSoundscape(url: string) {
    if (!this.context || !this.masterGain) return;
    const mode = url.replace('ambient://', '');

    if (mode.includes('silent')) return;

    // Conservative museum ambience: low, slow, soft room tone only.
    this.addFilteredNoise({ type: 'lowpass', frequency: 240, gain: 0.13, lfo: true });
    this.addFilteredNoise({ type: 'bandpass', frequency: 420, q: 0.35, gain: 0.035, lfo: true });
  }

  private addFilteredNoise(options: {
    type: BiquadFilterType;
    frequency: number;
    q?: number;
    gain: number;
    lfo?: boolean;
  }) {
    if (!this.context || !this.masterGain) return;

    const source = this.context.createBufferSource();
    source.buffer = makeNoiseBuffer(this.context);
    source.loop = true;

    const filter = this.context.createBiquadFilter();
    filter.type = options.type;
    filter.frequency.value = options.frequency;
    filter.Q.value = options.q ?? 0.4;

    const gain = this.context.createGain();
    gain.gain.value = options.gain;

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    this.nodes.push(source, filter, gain);

    if (options.lfo) {
      const oscillator = this.context.createOscillator();
      const lfoGain = this.context.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = 0.08 + Math.random() * 0.05;
      lfoGain.gain.value = options.frequency * 0.28;
      oscillator.connect(lfoGain);
      lfoGain.connect(filter.frequency);
      oscillator.start();
      this.nodes.push(oscillator, lfoGain);
    }

    source.start();
  }

  private stopNodes() {
    this.nodes.forEach((node) => {
      if ('stop' in node && typeof node.stop === 'function') {
        try {
          node.stop();
        } catch {
          // Already stopped.
        }
      }
      try {
        node.disconnect();
      } catch {
        // Already disconnected.
      }
    });
    this.nodes = [];
  }
}
