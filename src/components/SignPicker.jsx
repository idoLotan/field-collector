const signGlob = import.meta.glob('/public/signs/*.png');

const SIGN_DESCS = {
  '46':      'חד סיטרי',
  '122':     'רמזור',
  '135':     'מעבר חצייה להולכי רגל בקרבת מקום',
  '201':     'סע ישר או ימינה',
  '206':     'פנה ימינה',
  '207':     'פנה שמאלה',
  '213':     'עבור את המקום המסומן מימין או משמאל',
  '214':     'סע שמאלה עבור לפני התמרור',
  '215':     'סע ימינה עבור אחרי התמרור',
  '301':     'תן זכות קדימה',
  '302':     'עצור',
  '303':     'מעגל תנועה',
  '306':     'מעבר חצייה לפניך',
  '402':     'אין כניסה',
  '437':     'חניית נכים',
  '626':     'איזור חניה',
  'square':  'כיכר',
  'square3': 'כיכר (וריאנט)',
};

export const SIGNS = Object.keys(signGlob)
  .map(path => {
    const code = path.split('/').pop().replace(/\.[^.]+$/, '');
    return { img: path.replace('/public', ''), code, desc: SIGN_DESCS[code] || '' };
  })
  .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));

export default function SignPicker({ open, onSelect, onClose }) {
  if (!open) return null;
  return (
    <div className="sign-overlay" onClick={onClose}>
      <div className="sign-modal" onClick={e => e.stopPropagation()}>
        <div className="sign-modal-head">
          <h3>בחר סוג תמרור</h3>
          <button className="sign-modal-x" onClick={onClose}>✕</button>
        </div>
        <div className="sign-grid">
          {SIGNS.map(({ code, img, desc }) => (
            <button key={code} className="sign-item" onClick={() => { onSelect(code, desc); onClose(); }}>
              <img className="sign-item-img" src={img} alt={code} />
              <span className="sign-item-label">{code}</span>
              {desc && <span className="sign-item-desc">{desc}</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
