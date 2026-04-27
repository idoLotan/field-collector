export default function Overlay({ overlay, onClose }) {
  const open = !!overlay;
  return (
    <div
      id="overlay"
      className={open ? 'open' : ''}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="overlay-card">
        <h3>{overlay?.title}</h3>
        <p>{overlay?.msg}</p>
        <div className="overlay-actions">
          <button className="btn btn-ghost" onClick={onClose}>ביטול</button>
          <button
            className="btn btn-red"
            onClick={() => { overlay?.onConfirm(); onClose(); }}
          >
            {overlay?.confirmText || 'מחק'}
          </button>
        </div>
      </div>
    </div>
  );
}
