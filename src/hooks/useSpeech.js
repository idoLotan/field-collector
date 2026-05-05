import { useState, useRef, useCallback } from 'react';

const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

export function useSpeech(onTranscript) {
  const [active, setActive]   = useState(false);
  const [interim, setInterim] = useState('');

  const recRef         = useRef(null);
  const activeRef      = useRef(false);
  const committedRef   = useRef('');
  // Always-current ref so closures inside rec handlers never go stale
  const onTranscriptRef = useRef(onTranscript);
  onTranscriptRef.current = onTranscript;

  // Creates a fresh SpeechRecognition instance.
  // Called on every (re)start to avoid Android re-delivering previous results.
  const makeRec = () => {
    if (!SR) return null;
    const rec = new SR();
    rec.continuous     = true;
    rec.interimResults = true;
    rec.lang           = '';

    rec.onresult = (e) => {
      let interimText = '';
      let finalText   = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalText += t + ' ';
        else interimText += t;
      }
      if (finalText) {
        committedRef.current += finalText;
        onTranscriptRef.current(committedRef.current);
      }
      setInterim(interimText ? `"${interimText}"` : '');
    };

    rec.onerror = (e) => {
      if (e.error === 'aborted') return;
      activeRef.current = false;
      setActive(false);
      setInterim('');
      recRef.current = null;
    };

    // On Android, continuous mode ends automatically.
    // Create a brand-new instance to prevent result re-delivery on restart.
    rec.onend = () => {
      if (!activeRef.current) return;
      recRef.current = makeRec();
      try { recRef.current?.start(); } catch {}
    };

    return rec;
  };

  const stop = useCallback(() => {
    activeRef.current = false;
    setActive(false);
    setInterim('');
    try { recRef.current?.stop(); } catch {}
    recRef.current = null;
  }, []);

  const start = useCallback((currentText) => {
    if (!SR) return;
    committedRef.current = currentText || '';
    if (committedRef.current && !committedRef.current.endsWith(' ')) {
      committedRef.current += ' ';
    }
    recRef.current = makeRec();
    if (!recRef.current) return;
    activeRef.current = true;
    setActive(true);
    setInterim('');
    try { recRef.current.start(); } catch {}
  }, []); // no deps — all accessed via refs

  const toggle = useCallback((currentText) => {
    if (activeRef.current) stop();
    else start(currentText);
  }, [start, stop]);

  return { active, interim, supported: !!SR, toggle, stop };
}
