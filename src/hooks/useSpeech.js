import { useState, useRef, useCallback } from 'react';

const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

export function useSpeech(onTranscript) {
  const [active, setActive] = useState(false);
  const [interim, setInterim] = useState('');
  const recRef = useRef(null);
  const activeRef = useRef(false);
  const committedRef = useRef('');

  const initRec = useCallback(() => {
    if (!SR) return;
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = '';

    rec.onresult = (e) => {
      let interimText = '';
      let finalText = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalText += t + ' ';
        else interimText += t;
      }
      if (finalText) {
        committedRef.current += finalText;
        onTranscript(committedRef.current);
      }
      setInterim(interimText ? `"${interimText}"` : '');
    };

    rec.onerror = (e) => {
      if (e.error !== 'aborted') stop();
    };

    rec.onend = () => {
      if (activeRef.current) try { rec.start(); } catch {}
    };

    recRef.current = rec;
  }, [onTranscript]);

  const stop = useCallback(() => {
    activeRef.current = false;
    setActive(false);
    setInterim('');
    try { recRef.current?.stop(); } catch {}
  }, []);

  const start = useCallback((currentText) => {
    if (!SR) return;
    committedRef.current = currentText || '';
    if (committedRef.current && !committedRef.current.endsWith(' ')) committedRef.current += ' ';
    if (!recRef.current) initRec();
    activeRef.current = true;
    setActive(true);
    setInterim('');
    try { recRef.current.start(); } catch {}
  }, [initRec]);

  const toggle = useCallback((currentText) => {
    if (activeRef.current) stop();
    else start(currentText);
  }, [start, stop]);

  return { active, interim, supported: !!SR, toggle, stop };
}
