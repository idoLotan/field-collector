import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import { formatId } from './formatters';

const RB_DIRS = [
  { key: 'north', label: 'צפון' },
  { key: 'east',  label: 'מזרח' },
  { key: 'south', label: 'דרום' },
  { key: 'west',  label: 'מערב' },
];
const RB_SIGNS = ['301', '303', '306', '214', '213'];

function buildWorkbook(records) {
  const rows = [['ID', 'Latitude', 'Longitude', 'Notes', 'Category', 'תיאור', 'key', 'סטטוס']];

  records.forEach(r => {
    const rbEntries = [];
    if (r.roundabout) {
      RB_DIRS.forEach(dir => {
        RB_SIGNS.forEach(sign => {
          const status = r.roundabout[dir.key]?.[sign];
          if (status) rbEntries.push({ dir: dir.label, sign, status });
        });
      });
    }

    if (rbEntries.length) {
      rbEntries.forEach(({ sign, status }) => {
        rows.push([
          formatId(r.id), r.lat, r.lon,
          'כיכר',   // Notes
          'כיכר',   // Category
          sign,     // תיאור
          sign,     // key
          status,   // סטטוס
        ]);
      });
    } else {
      rows.push([
        formatId(r.id), r.lat, r.lon,
        r.defect ? (r.defect + (r.notes ? ' — ' + r.notes : '')) : r.notes,
        r.category || '',
        r.signNumber || '',
        r.signCode || '',
        r.signDesc || '',
      ]);
    }
  });

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch:10 },{ wch:14 },{ wch:14 },{ wch:50 },{ wch:12 },{ wch:16 },{ wch:12 },{ wch:18 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Field Records');
  return wb;
}

async function saveFile(blob, filename, mimeType) {
  if (window.showSaveFilePicker) {
    try {
      const ext = filename.split('.').pop();
      const handle = await window.showSaveFilePicker({
        suggestedName: filename,
        types: [{ description: 'File', accept: { [mimeType]: ['.' + ext] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return;
    } catch (err) {
      if (err.name === 'AbortError') return;
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

// Upload helper: try PUT to base/file, then POST to base (form field 'file').
async function uploadFileToHost(file, baseUrl) {
  const base = String(baseUrl).replace(/\/$/, '');

  // If server provides S3 signing endpoint, use S3 flow
  const s3SignUrl = window.S3_SIGN_URL;
  if (s3SignUrl) {
    try {
      return await uploadFileToS3(s3SignUrl, file);
    } catch (e) {
      console.warn('S3 upload failed', e);
    }
  }

  const putUrl = `${base}/${encodeURIComponent(file.name)}`;
  try {
    const putRes = await fetch(putUrl, { method: 'PUT', body: file });
    if (putRes.ok) return putUrl;
  } catch (e) {
    console.warn('PUT upload failed', e);
  }

  try {
    const fd = new FormData();
    fd.append('file', file, file.name);
    const postRes = await fetch(base, { method: 'POST', body: fd });
    if (!postRes.ok) throw new Error(postRes.statusText);
    const loc = postRes.headers.get('Location');
    const bodyText = await postRes.text();
    if (loc) return loc;
    if (bodyText && bodyText.trim().startsWith('http')) return bodyText.trim();
    return `${base}/${encodeURIComponent(file.name)}`;
  } catch (e) {
    console.warn('POST upload failed', e);
    throw e;
  }
}

// Upload via S3 presigned URL: server should return JSON { url, publicUrl? }
async function uploadFileToS3(signUrl, file) {
  const res = await fetch(signUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename: file.name, contentType: file.type }),
  });
  if (!res.ok) throw new Error('Failed to get presigned url');
  const json = await res.json();
  const { url, publicUrl } = json;
  if (!url) throw new Error('No presigned url returned');
  const putRes = await fetch(url, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } });
  if (!putRes.ok) throw new Error('S3 upload failed');
  return publicUrl || url.split('?')[0];
}

function openWhatsAppWithText(text) {
  const encoded = encodeURIComponent(text);
  const native = `whatsapp://send?text=${encoded}`;
  const web = `https://api.whatsapp.com/send?text=${encoded}`;
  // Try native first
  const win = window.open(native, '_blank') || window.open(web, '_blank');
  if (!win) {
    // fallback: change location
    window.location.href = web;
  }
}

export async function exportExcel(records) {
  const filename = `field-records-${new Date().toISOString().slice(0, 10)}.xlsx`;
  const wbout = XLSX.write(buildWorkbook(records), { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  await saveFile(blob, filename, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
}

export async function shareExcel(records) {
  const filename = `field-records-${new Date().toISOString().slice(0, 10)}.xlsx`;
  const wbout = XLSX.write(buildWorkbook(records), { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const file = new File([blob], filename, { type: blob.type });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ title: 'Field Records', text: `${records.length} record(s)`, files: [file] });
      return;
    } catch (err) {
      if (err.name === 'AbortError') return;
    }
  }
  await exportExcel(records);
}

export async function exportAllPhotosZip(records) {
  const withPhotos = records.filter(r => r.photos?.length);
  if (!withPhotos.length) return 0;

  const zip = new JSZip();
  let total = 0;
  for (const r of withPhotos) {
    const fid = formatId(r.id);
    r.photos.forEach((dataUrl, i) => {
      zip.file(`${fid}_${i + 1}.jpg`, dataUrl.split(',')[1], { base64: true });
      total++;
    });
  }

  const filename = `field-photos-${new Date().toISOString().slice(0, 10)}.zip`;
  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
  const file = new File([blob], filename, { type: 'application/zip' });

  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({
        title: 'Field Collector Photos',
        text: `${total} photo${total !== 1 ? 's' : ''} from ${withPhotos.length} record${withPhotos.length !== 1 ? 's' : ''}`,
        files: [file],
      });
      return total;
    } catch (err) {
      if (err.name === 'AbortError') return total;
    }
  }
  await saveFile(blob, filename, 'application/zip');
  return total;
}

function buildPhotoFiles(records) {
  const files = [];
  for (const r of records) {
    if (!r.photos?.length) continue;
    const fid = formatId(r.id);
    r.photos.forEach((dataUrl, i) => {
      const byteStr = atob(dataUrl.split(',')[1]);
      const arr = new Uint8Array(byteStr.length);
      for (let j = 0; j < byteStr.length; j++) arr[j] = byteStr.charCodeAt(j);
      files.push(new File([new Blob([arr], { type: 'image/jpeg' })], `${fid}_${i + 1}.jpg`, { type: 'image/jpeg' }));
    });
  }
  return files;
}

async function sharePhotosOrFallback(photoFiles, dateStr, showToast) {
  if (!photoFiles.length) return;
  if (navigator.canShare?.({ files: photoFiles })) {
    try {
      await navigator.share({ title: 'תמונות שטח', files: photoFiles });
      return;
    } catch (err) {
      if (err.name === 'AbortError') return;
    }
  }
  // Try upload to configured host (window.UPLOAD_BASE_URL) before falling back to ZIP download
  const uploadBase = window.UPLOAD_BASE_URL;
  if (uploadBase) {
    const urls = [];
    for (const f of photoFiles) {
      try {
        const url = await uploadFileToHost(f, uploadBase);
        urls.push(url);
      } catch (e) {
        console.warn('upload failed for', f.name, e);
      }
    }
    if (urls.length) {
      const text = `תמונות: ${urls.join('\n')}`;
      openWhatsAppWithText(text);
      showToast?.('📸 תמונות הועלו ושיתוף וואטסאפ נפתח');
      return;
    }
  }

  // Last resort: ZIP download
  const zip = new JSZip();
  photoFiles.forEach(f => zip.file(f.name, f));
  const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
  await saveFile(zipBlob, `photos-${dateStr}.zip`, 'application/zip');
  showToast?.('📸 תמונות נשמרו בהורדות');
}

export async function shareWhatsApp(records, showToast) {
  const dateStr = new Date().toISOString().slice(0, 10);

  const wbout = XLSX.write(buildWorkbook(records), { bookType: 'xlsx', type: 'array' });
  const xlsxType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  const xlsxBlob = new Blob([wbout], { type: xlsxType });
  const xlsxFilename = `field-records-${dateStr}.xlsx`;
  const xlsxFile = new File([xlsxBlob], xlsxFilename, { type: xlsxType });

  const uploadBase = window.UPLOAD_BASE_URL;
  if (navigator.canShare?.({ files: [xlsxFile] })) {
    try {
      await navigator.share({ title: 'Field Collector', files: [xlsxFile] });
    } catch (err) {
      if (err.name === 'AbortError') return;
      // try upload if configured, else save
      if (uploadBase) {
        try {
          const url = await uploadFileToHost(xlsxFile, uploadBase);
          openWhatsAppWithText(`קובץ: ${url}`);
        } catch (e) {
          await saveFile(xlsxBlob, xlsxFilename, xlsxType);
        }
      } else {
        await saveFile(xlsxBlob, xlsxFilename, xlsxType);
      }
    }
  } else if (uploadBase) {
    try {
      const url = await uploadFileToHost(xlsxFile, uploadBase);
      openWhatsAppWithText(`קובץ: ${url}`);
    } catch (e) {
      await saveFile(xlsxBlob, xlsxFilename, xlsxType);
    }
  } else {
    await saveFile(xlsxBlob, xlsxFilename, xlsxType);
  }

  await sharePhotosOrFallback(buildPhotoFiles(records), dateStr, showToast);
}

// ── Survey Excel export ──
function buildSurveyWorkbook(records) {
  const rows = [['ID', 'Address', 'Latitude', 'Longitude', 'סוג נכס', 'נפשות', 'קבוצת גיל', 'דיירות', 'מצב נכס', 'שם בעל/ת הדירה', 'תעודת זהות', 'Notes', 'Date', 'Time', 'Photos']];
  records.forEach(r => {
    const photoNote = r.photos?.length
      ? `${r.photos.length} photo${r.photos.length !== 1 ? 's' : ''} — files named ${formatId(r.id)}_1.jpg …`
      : '';
    rows.push([
      formatId(r.id), r.address, r.lat, r.lon,
      r.propertyType || '', r.residents || '', r.ageGroup || '',
      r.tenancy || '', r.condition || '',
      r.ownerName || '', r.ownerId || '',
      r.notes, r.date, r.time, photoNote,
    ]);
  });
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch:10 },{ wch:35 },{ wch:14 },{ wch:14 },{ wch:14 },{ wch:10 },{ wch:14 },{ wch:12 },{ wch:14 },{ wch:22 },{ wch:14 },{ wch:40 },{ wch:12 },{ wch:10 },{ wch:32 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Survey Records');
  return wb;
}

export async function shareSurveyWhatsApp(records, showToast) {
  const dateStr = new Date().toISOString().slice(0, 10);
  const wbout = XLSX.write(buildSurveyWorkbook(records), { bookType: 'xlsx', type: 'array' });
  const xlsxType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  const xlsxBlob = new Blob([wbout], { type: xlsxType });
  const xlsxFilename = `survey-records-${dateStr}.xlsx`;
  const xlsxFile = new File([xlsxBlob], xlsxFilename, { type: xlsxType });

  const uploadBase = window.UPLOAD_BASE_URL;
  if (navigator.canShare?.({ files: [xlsxFile] })) {
    try {
      await navigator.share({ title: 'Survey Records', files: [xlsxFile] });
    } catch (err) {
      if (err.name === 'AbortError') return;
      if (uploadBase) {
        try {
          const url = await uploadFileToHost(xlsxFile, uploadBase);
          openWhatsAppWithText(`קובץ: ${url}`);
        } catch (e) {
          await saveFile(xlsxBlob, xlsxFilename, xlsxType);
        }
      } else {
        await saveFile(xlsxBlob, xlsxFilename, xlsxType);
      }
    }
  } else if (uploadBase) {
    try {
      const url = await uploadFileToHost(xlsxFile, uploadBase);
      openWhatsAppWithText(`קובץ: ${url}`);
    } catch (e) {
      await saveFile(xlsxBlob, xlsxFilename, xlsxType);
    }
  } else {
    await saveFile(xlsxBlob, xlsxFilename, xlsxType);
  }

  await sharePhotosOrFallback(buildPhotoFiles(records), dateStr, showToast);
}

// ── Drainage Excel export ──
function buildDrainageWorkbook(records) {
  const rows = [['ID', 'Address', 'Latitude', 'Longitude', 'סוג רכיב', 'מצב', 'חומר', 'Notes', 'Date', 'Time', 'Photos']];
  records.forEach(r => {
    const photoNote = r.photos?.length
      ? `${r.photos.length} photo${r.photos.length !== 1 ? 's' : ''} — files named ${formatId(r.id)}_1.jpg …`
      : '';
    rows.push([
      formatId(r.id), r.address, r.lat, r.lon,
      r.drainageType || '', r.condition || '', r.material || '',
      r.notes, r.date, r.time, photoNote,
    ]);
  });
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch:10 },{ wch:35 },{ wch:14 },{ wch:14 },{ wch:12 },{ wch:14 },{ wch:10 },{ wch:40 },{ wch:12 },{ wch:10 },{ wch:32 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Drainage Records');
  return wb;
}

export async function shareDrainageWhatsApp(records, showToast) {
  const dateStr = new Date().toISOString().slice(0, 10);
  const wbout = XLSX.write(buildDrainageWorkbook(records), { bookType: 'xlsx', type: 'array' });
  const xlsxType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  const xlsxBlob = new Blob([wbout], { type: xlsxType });
  const xlsxFilename = `drainage-records-${dateStr}.xlsx`;
  const xlsxFile = new File([xlsxBlob], xlsxFilename, { type: xlsxType });

  const uploadBase = window.UPLOAD_BASE_URL;
  if (navigator.canShare?.({ files: [xlsxFile] })) {
    try {
      await navigator.share({ title: 'Drainage Records', files: [xlsxFile] });
    } catch (err) {
      if (err.name === 'AbortError') return;
      if (uploadBase) {
        try {
          const url = await uploadFileToHost(xlsxFile, uploadBase);
          openWhatsAppWithText(`קובץ: ${url}`);
        } catch (e) {
          await saveFile(xlsxBlob, xlsxFilename, xlsxType);
        }
      } else {
        await saveFile(xlsxBlob, xlsxFilename, xlsxType);
      }
    }
  } else if (uploadBase) {
    try {
      const url = await uploadFileToHost(xlsxFile, uploadBase);
      openWhatsAppWithText(`קובץ: ${url}`);
    } catch (e) {
      await saveFile(xlsxBlob, xlsxFilename, xlsxType);
    }
  } else {
    await saveFile(xlsxBlob, xlsxFilename, xlsxType);
  }

  await sharePhotosOrFallback(buildPhotoFiles(records), dateStr, showToast);
}

export async function saveRecordPhotos(record) {
  const fid = formatId(record.id);
  const photos = record.photos || [];
  if (!photos.length) return;

  const files = photos.map((dataUrl, i) => {
    const byteStr = atob(dataUrl.split(',')[1]);
    const arr = new Uint8Array(byteStr.length);
    for (let j = 0; j < byteStr.length; j++) arr[j] = byteStr.charCodeAt(j);
    return new File([new Blob([arr], { type: 'image/jpeg' })], `${fid}_${i + 1}.jpg`, { type: 'image/jpeg' });
  });

  // Try native Android share sheet (includes WhatsApp) — works on HTTPS
  if (navigator.share) {
    try {
      await navigator.share({ title: `תמונות ${fid}`, files });
      return;
    } catch (err) {
      if (err.name === 'AbortError') return;
      // NotAllowedError / not supported — fall through to WhatsApp fallback
    }
  }

  // Fallback: save files to device and open WhatsApp
  const uploadBase = window.UPLOAD_BASE_URL;
  if (uploadBase) {
    const urls = [];
    for (const f of files) {
      try {
        const url = await uploadFileToHost(f, uploadBase);
        urls.push(url);
      } catch (e) {
        console.warn('upload failed for', f.name, e);
      }
    }
    if (urls.length) {
      openWhatsAppWithText(`תמונות ${fid}: ${urls.join('\n')}`);
      return;
    }
  }

  for (let idx = 0; idx < files.length; idx++) {
    const file = files[idx];
    await new Promise(resolve => setTimeout(resolve, idx * 300));
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url; a.download = file.name;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  // Open WhatsApp directly after saving
  const wa = document.createElement('a');
  wa.href = 'whatsapp://';
  wa.target = '_blank';
  wa.rel = 'noopener';
  document.body.appendChild(wa);
  wa.click();
  document.body.removeChild(wa);
}
