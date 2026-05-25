/**
 * Cloud Sync - Upload records to backend without photos
 */

export async function uploadRecordsToCloud(records, backendUrl, showToast) {
  if (!backendUrl) {
    showToast('❌ Backend URL not configured (BACKEND_URL)');
    return { success: false, error: 'Backend URL not configured' };
  }

  if (!Array.isArray(records) || records.length === 0) {
    showToast('⚠️ No records to upload');
    return { success: false, error: 'No records' };
  }

  // Strip photos from records before uploading
  const recordsWithoutPhotos = records.map(r => {
    const copy = { ...r };
    delete copy.photos;
    return copy;
  });

  try {
    const res = await fetch(`${backendUrl}/api/records`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ records: recordsWithoutPhotos }),
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }

    const data = await res.json();
    if (data.success) {
      showToast(`✅ ${recordsWithoutPhotos.length} נקודות הועלו בהצלחה`);
      return { success: true, count: recordsWithoutPhotos.length };
    } else {
      throw new Error(data.error || 'Unknown error');
    }
  } catch (err) {
    console.error('Cloud upload error:', err);
    showToast(`❌ שגיאה בהעלאה: ${err.message}`);
    return { success: false, error: err.message };
  }
}

export async function fetchRecordsFromCloud(backendUrl, showToast) {
  if (!backendUrl) {
    showToast('❌ Backend URL not configured');
    return { success: false, records: [] };
  }

  try {
    const res = await fetch(`${backendUrl}/api/records`);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const data = await res.json();
    if (data.success) {
      showToast(`ℹ️ ${data.count} נקודות טעונות מהענן`);
      return { success: true, records: data.records };
    } else {
      throw new Error(data.error || 'Unknown error');
    }
  } catch (err) {
    console.error('Cloud fetch error:', err);
    showToast(`❌ שגיאה בטעינה: ${err.message}`);
    return { success: false, records: [] };
  }
}
