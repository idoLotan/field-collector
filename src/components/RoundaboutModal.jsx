import { useState } from 'react';
import { useCompass } from '../utils/useCompass';
import CompassWidget from './CompassWidget';

const DIRS = [
  { key: 'north', label: 'צפון', short: 'צ' },
  { key: 'east',  label: 'מזרח', short: 'מ' },
  { key: 'south', label: 'דרום',  short: 'ד' },
  { key: 'west',  label: 'מערב', short: 'ע' },
];

const SIGNS = ['301', '303', '306', '214'];
const STATUSES = ['תקין', 'לא תקין', 'חסר'];
const DOT_COLOR = { 'תקין': '#16a34a', 'לא תקין': '#dc2626', 'חסר': '#ea580c', '': '#d1d5db' };

export const EMPTY_RB = Object.fromEntries(
  DIRS.map(d => [d.key, Object.fromEntries(SIGNS.map(s => [s, '']))])
);

export function hasRbData(rb) {
  if (!rb) return false;
  return DIRS.some(d => SIGNS.some(s => rb[d.key]?.[s]));
}

export function formatRbForExcel(rb) {
  if (!rb) return '';
  const short = { north: 'צ', east: 'מ', south: 'ד', west: 'ע' };
  return DIRS.map(d => {
    const parts = SIGNS.filter(s => rb[d.key]?.[s]).map(s => `${s}:${rb[d.key][s]}`);
    return parts.length ? `${short[d.key]}: ${parts.join(', ')}` : null;
  }).filter(Boolean).join(' | ') || '';
}

function SignImg({ sign }) {
  const [broken, setBroken] = useState(false);
  if (broken) return <div className="rb-sign-fallback">{sign}</div>;
  return (
    <img src={`/signs/${sign}.png`} className="rb-sign-img" alt={sign}
      onError={() => setBroken(true)} />
  );
}

function StatusBtn({ sign, status, onChange, menuUp, menuLeft }) {
  const [open, setOpen] = useState(false);
  const color = DOT_COLOR[status] || DOT_COLOR[''];
  return (
    <div className="rb-sbwrap">
      <button className={`rb-sb${status ? ' rb-sb-set' : ''}`}
        onClick={() => setOpen(o => !o)} title={status || 'בחר סטטוס'}>
        <span className="rb-sdot" style={{ background: color }} />
        <span className="rb-sarr">{open ? '▴' : '▾'}</span>
      </button>
      {open && (
        <div className={`rb-menu${menuUp ? ' rb-menu-up' : ''}${menuLeft ? ' rb-menu-left' : ''}`}>
          {STATUSES.map(s => (
            <button key={s} className={`rb-mitem${status === s ? ' rb-mitem-on' : ''}`}
              onClick={() => { onChange(sign, status === s ? '' : s); setOpen(false); }}>
              <span className="rb-mdot" style={{ background: DOT_COLOR[s] }} />
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function DirPanel({ dirKey, label, data, onChange, menuUp, menuLeft }) {
  const isNS = dirKey === 'north' || dirKey === 'south';
  return (
    <div className={`rb-dir rb-dir-${dirKey}`}>
      <div className="rb-dirlbl">{label}</div>
      <div className={isNS ? 'rb-signs-ns' : 'rb-signs-ew'}>
        {SIGNS.map(sign => (
          <div key={sign} className="rb-sign-row">
            <SignImg sign={sign} />
            <StatusBtn sign={sign} status={data?.[sign] || ''}
              onChange={(s, val) => onChange(dirKey, s, val)}
              menuUp={menuUp} menuLeft={menuLeft} />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function RoundaboutModal({ open, data, onChange, onClose }) {
  const { heading, active: compassActive, toggle: toggleCompass } = useCompass();

  if (!open) return null;

  const rb = data || EMPTY_RB;
  const rbType = rb._type || '4';

  const set = (dir, sign, val) =>
    onChange({ ...rb, [dir]: { ...rb[dir], [sign]: val } });

  const setType = (t) =>
    onChange({ ...rb, _type: t });

  const circleImg = rbType === '3' ? '/signs/square3.png' : '/signs/square.png';

  return (
    <div className="rb-overlay" onClick={onClose}>
      <div className="rb-modal" onClick={e => e.stopPropagation()}>

        <div className="rb-head">
          <h3>כיכר — סיווג תמרורים</h3>
          <button className="rb-x" onClick={onClose}>✕</button>
        </div>

        {/* Type selector */}
        <div className="rb-type-row">
          <button className={`rb-type-btn${rbType === '4' ? ' active' : ''}`}
            onClick={() => setType('4')}>
            4 כניסות
          </button>
          <button className={`rb-type-btn${rbType === '3' ? ' active' : ''}`}
            onClick={() => setType('3')}>
            3 כניסות
          </button>
        </div>

        <div className="rb-legend">
          {STATUSES.map(s => (
            <span key={s} className="rb-leg-item">
              <span className="rb-ldot" style={{ background: DOT_COLOR[s] }} />
              {s}
            </span>
          ))}
        </div>

        <div className="rb-diagram">

          <DirPanel dirKey="north" label="צפון" data={rb.north} onChange={set}
            menuUp={false} menuLeft={false} />

          <div className="rb-midrow">
            <DirPanel dirKey="west" label="מערב" data={rb.west} onChange={set}
              menuUp={false} menuLeft={false} />

            <div className="rb-circle-wrap">
              <img src={circleImg} className="rb-circle-img" alt="כיכר" />
              <div className="rb-compass-wrap">
                {compassActive
                  ? <CompassWidget heading={heading} size={48} />
                  : <button className="rb-compass-btn" onClick={() => toggleCompass()}>🧭</button>
                }
              </div>
            </div>

            <DirPanel dirKey="east" label="מזרח" data={rb.east} onChange={set}
              menuUp={false} menuLeft={true} />
          </div>

          <DirPanel dirKey="south" label="דרום" data={rb.south} onChange={set}
            menuUp={true} menuLeft={false} />

        </div>

        <div className="rb-foot">
          <button className="btn btn-primary" onClick={onClose}>סגור</button>
        </div>
      </div>
    </div>
  );
}
