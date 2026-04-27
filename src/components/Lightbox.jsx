export default function Lightbox({ src, onClose }) {
  return (
    <div id="lightbox" className={src ? 'open' : ''} onClick={onClose}>
      <button id="lightboxClose" onClick={onClose}>✕</button>
      {src && (
        <img
          id="lightboxImg"
          src={src}
          alt="תמונה"
          onClick={e => e.stopPropagation()}
        />
      )}
    </div>
  );
}
