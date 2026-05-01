import { useState, useEffect, useCallback } from 'react';

export function useCompass() {
  const [active, setActive]   = useState(false);
  const [heading, setHeading] = useState(null);

  const start = useCallback(async (showToast) => {
    if (typeof DeviceOrientationEvent?.requestPermission === 'function') {
      const perm = await DeviceOrientationEvent.requestPermission().catch(() => 'denied');
      if (perm !== 'granted') { showToast?.('❌ הרשאת מצפן נדחתה.'); return false; }
    }
    if (!('DeviceOrientationEvent' in window)) {
      showToast?.('❌ המכשיר לא תומך במצפן.'); return false;
    }
    setActive(true); return true;
  }, []);

  const stop = useCallback(() => { setActive(false); setHeading(null); }, []);

  const toggle = useCallback(async (showToast) => {
    if (active) { stop(); return; }
    await start(showToast);
  }, [active, start, stop]);

  useEffect(() => {
    if (!active) return;
    const handler = (e) => {
      const h = e.webkitCompassHeading ?? (e.absolute ? (360 - e.alpha) : null);
      if (h !== null) setHeading(Math.round(h));
    };
    window.addEventListener('deviceorientationabsolute', handler, true);
    window.addEventListener('deviceorientation', handler, true);
    return () => {
      window.removeEventListener('deviceorientationabsolute', handler, true);
      window.removeEventListener('deviceorientation', handler, true);
    };
  }, [active]);

  return { heading, active, toggle, start, stop };
}
