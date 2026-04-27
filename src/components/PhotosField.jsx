import { useRef } from 'react';

const MAX_PHOTOS = 3;

function compressImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const MAX = 1200;
      let { naturalWidth: w, naturalHeight: h } = img;
      if (w > MAX) { h = Math.round(h * MAX / w); w = MAX; }
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', 0.75));
    };
    img.onerror = reject;
    img.src = url;
  });
}

export default function PhotosField({ photos, onChange, openLightbox, showToast }) {
  const inputRef = useRef(null);

  const triggerCamera = () => {
    if (photos.length >= MAX_PHOTOS) {
      showToast(`⚠️ מקסימום ${MAX_PHOTOS} תמונות לרשומה.`);
      return;
    }
    inputRef.current.click();
  };

  const handleInput = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length) return;

    const slots = MAX_PHOTOS - photos.length;
    const toAdd = files.slice(0, slots);
    if (files.length > slots) showToast(`⚠️ Only ${slots} more photo${slots !== 1 ? 's' : ''} can be added.`);

    const newPhotos = [...photos];
    for (const file of toAdd) {
      try {
        newPhotos.push(await compressImage(file));
      } catch {
        showToast('❌ לא ניתן לקרוא תמונה אחת.');
      }
    }
    onChange(newPhotos);
  };

  const removePhoto = (idx) => {
    onChange(photos.filter((_, i) => i !== idx));
  };

  return (
    <div className="field">
      <label>
        <span style={{ fontWeight: 400, fontSize: '.8rem', color: 'var(--gray)' }}>{photos.length} מתוך {MAX_PHOTOS} תמונות</span>
        תמונות <span>📷</span>
      </label>
      <div className="photo-thumb-row">
        {photos.map((src, i) => (
          <div className="photo-thumb-wrap" key={i}>
            <img
              className="photo-thumb"
              src={src}
              alt={`תמונה ${i + 1}`}
              onClick={() => openLightbox(src)}
            />
            <button className="photo-thumb-remove" onClick={() => removePhoto(i)} title="הסר">✕</button>
          </div>
        ))}
      </div>
      <button
        className="btn-photo"
        onClick={triggerCamera}
        disabled={photos.length >= MAX_PHOTOS}
      >
        📷 צלם / הוסף תמונה
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={handleInput}
      />
    </div>
  );
}
