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
  const rows = [['ID', 'Address', 'Latitude', 'Longitude', 'Notes', 'Category', 'כיוון', 'תמרור', 'סטטוס', 'Date', 'Time', 'Photos']];

  records.forEach(r => {
    const photoNote = r.photos?.length
      ? `${r.photos.length} photo${r.photos.length !== 1 ? 's' : ''} — files named ${formatId(r.id)}_1.jpg …`
      : '';

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
      rbEntries.forEach(({ dir, sign, status }, i) => {
        rows.push([
          formatId(r.id), r.address, r.lat, r.lon,
          'כיכר',   // Notes
          'כיכר',   // Category
          dir,      // כיוון
          sign,     // תמרור
          status,   // סטטוס
          r.date, r.time,
          i === 0 ? photoNote : '',
        ]);
      });
    } else {
      rows.push([
        formatId(r.id), r.address, r.lat, r.lon,
        r.defect ? (r.defect + (r.notes ? ' — ' + r.notes : '')) : r.notes,
        r.category || '', r.signDirection || '', r.signNumber || '', r.signCode || '',
        r.date, r.time, photoNote,
      ]);
    }
  });

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch:10 },{ wch:35 },{ wch:14 },{ wch:14 },{ wch:50 },{ wch:12 },{ wch:10 },{ wch:10 },{ wch:14 },{ wch:12 },{ wch:10 },{ wch:32 }];
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
  URL.revokeObjectURL(url);
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

export async function shareWhatsApp(records, showToast) {
  const dateStr = new Date().toISOString().slice(0, 10);

  // Share Excel — WhatsApp supports .xlsx on Android (ZIP is not supported)
  const wbout = XLSX.write(buildWorkbook(records), { bookType: 'xlsx', type: 'array' });
  const xlsxType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  const xlsxBlob = new Blob([wbout], { type: xlsxType });
  const xlsxFilename = `field-records-${dateStr}.xlsx`;
  const xlsxFile = new File([xlsxBlob], xlsxFilename, { type: xlsxType });

  if (navigator.canShare?.({ files: [xlsxFile] })) {
    try {
      await navigator.share({ title: 'Field Collector', files: [xlsxFile] });
    } catch (err) {
      if (err.name === 'AbortError') return;
      await saveFile(xlsxBlob, xlsxFilename, xlsxType);
    }
  } else {
    await saveFile(xlsxBlob, xlsxFilename, xlsxType);
  }

  // Photos: save separately as ZIP to Downloads
  const withPhotos = records.filter(r => r.photos?.length);
  if (withPhotos.length) {
    const zip = new JSZip();
    for (const r of withPhotos) {
      const fid = formatId(r.id);
      r.photos.forEach((dataUrl, i) => {
        zip.file(`${fid}_${i + 1}.jpg`, dataUrl.split(',')[1], { base64: true });
      });
    }
    const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
    await saveFile(zipBlob, `photos-${dateStr}.zip`, 'application/zip');
    showToast?.('📸 תמונות נשמרו בהורדות');
  }
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

  if (navigator.canShare?.({ files: [xlsxFile] })) {
    try {
      await navigator.share({ title: 'Survey Records', files: [xlsxFile] });
    } catch (err) {
      if (err.name === 'AbortError') return;
      await saveFile(xlsxBlob, xlsxFilename, xlsxType);
    }
  } else {
    await saveFile(xlsxBlob, xlsxFilename, xlsxType);
  }

  const withPhotos = records.filter(r => r.photos?.length);
  if (withPhotos.length) {
    const zip = new JSZip();
    for (const r of withPhotos) {
      const fid = formatId(r.id);
      r.photos.forEach((dataUrl, i) => {
        zip.file(`${fid}_${i + 1}.jpg`, dataUrl.split(',')[1], { base64: true });
      });
    }
    const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
    await saveFile(zipBlob, `photos-${dateStr}.zip`, 'application/zip');
    showToast?.('📸 תמונות נשמרו בהורדות');
  }
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

  if (navigator.canShare?.({ files: [xlsxFile] })) {
    try {
      await navigator.share({ title: 'Drainage Records', files: [xlsxFile] });
    } catch (err) {
      if (err.name === 'AbortError') return;
      await saveFile(xlsxBlob, xlsxFilename, xlsxType);
    }
  } else {
    await saveFile(xlsxBlob, xlsxFilename, xlsxType);
  }

  const withPhotos = records.filter(r => r.photos?.length);
  if (withPhotos.length) {
    const zip = new JSZip();
    for (const r of withPhotos) {
      const fid = formatId(r.id);
      r.photos.forEach((dataUrl, i) => {
        zip.file(`${fid}_${i + 1}.jpg`, dataUrl.split(',')[1], { base64: true });
      });
    }
    const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
    await saveFile(zipBlob, `photos-${dateStr}.zip`, 'application/zip');
    showToast?.('📸 תמונות נשמרו בהורדות');
  }
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

  if (navigator.canShare?.({ files })) {
    try {
      await navigator.share({
        title: `Photos for ${fid}`,
        text: `${files.length} photo${files.length !== 1 ? 's' : ''} from record ${fid}`,
        files,
      });
      return;
    } catch (err) {
      if (err.name === 'AbortError') return;
    }
  }
  for (const file of files) {
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url; a.download = file.name;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    await new Promise(r => setTimeout(r, 200));
  }
}
