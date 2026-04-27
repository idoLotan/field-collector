const signGlob = import.meta.glob('/public/signs/*.png');

export const SIGNS = Object.keys(signGlob)
  .map(path => ({
    img: path.replace('/public', ''),
    code: path.split('/').pop().replace(/\.[^.]+$/, ''),
  }))
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
          {SIGNS.map(({ code, img }) => (
            <button key={code} className="sign-item" onClick={() => { onSelect(code); onClose(); }}>
              <img className="sign-item-img" src={img} alt={code} />
              <span className="sign-item-label">{code}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
