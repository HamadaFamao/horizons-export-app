// Voice filter types
export const VOICE_FILTERS = [
  { id: "none",       label: "Normal",     emoji: "🎤" },
  { id: "robot",      label: "Robot",      emoji: "🤖" },
  { id: "chipmunk",   label: "Chipmunk",   emoji: "🐿️" },
  { id: "deep",       label: "Deep",       emoji: "👹" },
  { id: "echo",       label: "Echo",       emoji: "🌊" },
  { id: "radio",      label: "Radio",      emoji: "📻" },
];

let audioContext = null;
let sourceNode = null;
let filterChain = [];
let currentStream = null;
let processedStream = null;

export const getAudioContext = () => {
  if (!audioContext || audioContext.state === 'closed') {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioContext;
};

export const applyVoiceFilter = async (filterId, micStream) => {
  // Clean up previous filter
  cleanupFilters();

  if (filterId === 'none' || !micStream) {
    return micStream; // Return original stream
  }

  try {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') await ctx.resume();

    sourceNode = ctx.createMediaStreamSource(micStream);
    const destination = ctx.createMediaStreamDestination();
    filterChain = [];

    if (filterId === 'robot') {
      // Robot: ring modulator effect
      const oscillator = ctx.createOscillator();
      oscillator.frequency.value = 50;
      oscillator.type = 'sawtooth';
      
      const gainNode = ctx.createGain();
      gainNode.gain.value = 1;
      
      const distortion = ctx.createWaveShaper();
      const curve = new Float32Array(256);
      for (let i = 0; i < 256; i++) {
        const x = (i * 2) / 256 - 1;
        curve[i] = (Math.PI + 200) * x / (Math.PI + 200 * Math.abs(x));
      }
      distortion.curve = curve;

      sourceNode.connect(distortion);
      distortion.connect(gainNode);
      gainNode.connect(destination);
      oscillator.start();
      filterChain = [oscillator, gainNode, distortion];
    }

    else if (filterId === 'chipmunk') {
      // Chipmunk: pitch shift up using faster playback
      const scriptProcessor = ctx.createScriptProcessor(4096, 1, 1);
      
      scriptProcessor.onaudioprocess = (e) => {
        const input = e.inputBuffer.getChannelData(0);
        const output = e.outputBuffer.getChannelData(0);
        const rate = 1.8; // Higher = more chipmunk
        for (let i = 0; i < output.length; i++) {
          const srcIdx = Math.floor(i * rate) % input.length;
          output[i] = input[srcIdx];
        }
      };

      sourceNode.connect(scriptProcessor);
      scriptProcessor.connect(destination);
      filterChain = [scriptProcessor];
    }

    else if (filterId === 'deep') {
      // Deep voice: pitch shift down
      const scriptProcessor = ctx.createScriptProcessor(4096, 1, 1);
      
      scriptProcessor.onaudioprocess = (e) => {
        const input = e.inputBuffer.getChannelData(0);
        const output = e.outputBuffer.getChannelData(0);
        const rate = 0.6; // Lower = deeper voice
        for (let i = 0; i < output.length; i++) {
          const srcIdx = Math.floor(i * rate) % input.length;
          output[i] = input[srcIdx] * 1.2; // Boost gain
        }
      };

      sourceNode.connect(scriptProcessor);
      scriptProcessor.connect(destination);
      filterChain = [scriptProcessor];
    }

    else if (filterId === 'echo') {
      // Echo: delay feedback loop
      const delay = ctx.createDelay(1.0);
      delay.delayTime.value = 0.3;
      
      const feedback = ctx.createGain();
      feedback.gain.value = 0.4;
      
      const dryGain = ctx.createGain();
      dryGain.gain.value = 0.7;
      
      const wetGain = ctx.createGain();
      wetGain.gain.value = 0.5;

      sourceNode.connect(dryGain);
      sourceNode.connect(delay);
      delay.connect(feedback);
      feedback.connect(delay);
      delay.connect(wetGain);
      dryGain.connect(destination);
      wetGain.connect(destination);
      filterChain = [delay, feedback, dryGain, wetGain];
    }

    else if (filterId === 'radio') {
      // Radio: bandpass filter + distortion
      const bandpass = ctx.createBiquadFilter();
      bandpass.type = 'bandpass';
      bandpass.frequency.value = 1800;
      bandpass.Q.value = 0.5;

      const distortion = ctx.createWaveShaper();
      const curve = new Float32Array(256);
      for (let i = 0; i < 256; i++) {
        const x = (i * 2) / 256 - 1;
        curve[i] = (3 + 20) * x * 20 * (Math.PI / 180) / 
                   (Math.PI + 20 * Math.abs(x));
      }
      distortion.curve = curve;

      const gainNode = ctx.createGain();
      gainNode.gain.value = 1.5;

      sourceNode.connect(bandpass);
      bandpass.connect(distortion);
      distortion.connect(gainNode);
      gainNode.connect(destination);
      filterChain = [bandpass, distortion, gainNode];
    }

    processedStream = destination.stream;
    currentStream = micStream;
    return destination.stream;

  } catch (err) {
    console.error('[VOICE_FILTER_ERROR]', err);
    return micStream; // Fallback to original
  }
};

export const cleanupFilters = () => {
  try {
    filterChain.forEach(node => {
      try { node.disconnect(); } catch {}
      try { if (node.stop) node.stop(); } catch {}
    });
    if (sourceNode) {
      try { sourceNode.disconnect(); } catch {}
    }
  } catch {}
  filterChain = [];
  sourceNode = null;
  processedStream = null;
};
