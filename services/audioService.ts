
export const playSparkleSound = () => {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;

    const ctx = new AudioContext();
    const now = ctx.currentTime;

    // Play a sequence of high pitched sine waves for a magical shimmer
    [0, 0.05, 0.1, 0.15, 0.2].forEach((offset) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sine';
      // Randomize frequencies slightly for a magical feel
      const freq = 1500 + Math.random() * 1000; 
      osc.frequency.setValueAtTime(freq, now + offset);
      osc.frequency.exponentialRampToValueAtTime(freq + 500, now + offset + 0.5);
      
      gain.gain.setValueAtTime(0.02, now + offset);
      gain.gain.linearRampToValueAtTime(0.05, now + offset + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.5);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start(now + offset);
      osc.stop(now + offset + 0.6);
    });
  } catch (e) {
    console.error("Audio error", e);
  }
};

export const playHoHoHo = () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        // Cancel any pending speech
        window.speechSynthesis.cancel();
        
        const utterance = new SpeechSynthesisUtterance("Ho! Ho! Ho!");
        utterance.rate = 0.8;
        utterance.pitch = 0.5; // Deeper voice
        utterance.volume = 1.0;
        
        // Try to find a male voice, though browser dependent
        const voices = window.speechSynthesis.getVoices();
        const preferredVoice = voices.find(v => v.name.includes('Male') || v.name.includes('Google US English'));
        if (preferredVoice) utterance.voice = preferredVoice;

        window.speechSynthesis.speak(utterance);
    }
};

export const playArrivalChime = () => {
    try {
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContext) return;
        const ctx = new AudioContext();
        const now = ctx.currentTime;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(440, now); // A4
        osc.frequency.linearRampToValueAtTime(880, now + 0.1); // Slide up
        
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.1, now + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 1.0);

        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.start(now);
        osc.stop(now + 1.0);
    } catch(e) {
        console.error(e);
    }
}
