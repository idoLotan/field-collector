import { useState, useEffect } from 'react';

export default function GpsField({ lat, lon, onCapture, onGoToMap }) {
  const [statusText, setStatusText] = useState('ממתין ל-GPS…');
  const [statusType, setStatusType] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (lat && lon) {
      setStatusText('✅ מיקום שוחזר');
      setStatusType('ok');
    }
  }, []);

  const captureGPS = () => {
    if (!navigator.geolocation) {
      setStatusText('❌ דפדפן זה אינו תומך במיקום.');
      setStatusType('err');
      return;
    }
    setStatusText('מאתר מיקום…');
    setStatusType('');
    setLoading(true);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const newLat = pos.coords.latitude.toFixed(6);
        const newLon = pos.coords.longitude.toFixed(6);
        onCapture(newLat, newLon);
        setStatusText(`✅ דיוק: ±${Math.round(pos.coords.accuracy)} מ'`);
        setStatusType('ok');
        setLoading(false);
      },
      (err) => {
        const msgs = {
          1: 'הרשאת מיקום נדחתה — אפשר מיקום בהגדרות הדפדפן.',
          2: 'לא ניתן לאתר מיקום. נסה בחוץ.',
          3: 'פג זמן. נסה שוב.',
        };
        setStatusText('❌ ' + (msgs[err.code] || err.message));
        setStatusType('err');
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  return (
    <div className="field">
      <label>מיקום GPS <span>🎯</span></label>
      <button className="btn btn-gps" onClick={captureGPS} disabled={loading}>
        {loading ? <><span className="spin" /> מאתר מיקום…</> : '⊙ קבל מיקום נוכחי'}
      </button>
      <input
        className="gps-coords-input"
        type="text"
        value={lat && lon ? `${lat}, ${lon}` : ''}
        placeholder="ממתין ל-GPS…"
        readOnly
      />
      <div id="gpsStatus" className={statusType}>{statusText}</div>
      {onGoToMap && (
        <button className="btn-map-link" onClick={onGoToMap}>🗺 בחר על מפה</button>
      )}
    </div>
  );
}
