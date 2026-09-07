import { readAsDataUrl, trimTransparent } from './api.js';

async function pngHasTransparency(file) {
  if (file.type !== 'image/png') return false;
  const dataUrl = await readAsDataUrl(file);
  const img = new Image();
  await new Promise(function (resolve, reject) {
    img.onload = resolve;
    img.onerror = function () { reject(new Error('No se pudo leer el PNG')); };
    img.src = dataUrl;
  });
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] < 250) return true;
  }
  return false;
}

function stepLabel(key) {
  const k = String(key || '').toLowerCase();
  if (k.indexOf('fetch') !== -1 || k.indexOf('download') !== -1) return 'Descargando modelo';
  if (k.indexOf('init') !== -1 || k.indexOf('session') !== -1) return 'Preparando motor';
  if (k.indexOf('compute') !== -1 || k.indexOf('infer') !== -1) return 'Quitando fondo';
  if (k) return 'Procesando ' + key;
  return 'Procesando';
}

function emitProgress(onProgress, message, percent) {
  if (!onProgress) return;
  onProgress(message, typeof percent === 'number' ? percent : 0);
}

export async function cutoutImage(source, onProgress, trim) {
  emitProgress(onProgress, 'Cargando motor de recorte…', 2);
  const mod = await import('https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.7.0/+esm');
  emitProgress(onProgress, 'Modelo listo, analizando imagen…', 8);
  const blob = await mod.removeBackground(source, {
    output: { format: 'image/png' },
    progress: function (key, current, total) {
      const pct = total > 0 ? Math.round((current / total) * 100) : 0;
      emitProgress(onProgress, stepLabel(key) + ' ' + pct + '%', Math.max(8, Math.min(92, pct)));
    },
  });
  emitProgress(onProgress, 'Recortando margenes transparentes…', 96);
  const raw = await readAsDataUrl(blob);
  const result = await trimTransparent(raw, trim);
  emitProgress(onProgress, 'Recorte listo', 100);
  return { result: result, rawDataUrl: raw };
}

export async function importProductCutout(file, onProgress) {
  if (await pngHasTransparency(file)) {
    if (onProgress) onProgress('PNG ya transparente: recortando margenes…');
    return trimTransparent(await readAsDataUrl(file));
  }
  const out = await cutoutImage(file, onProgress);
  return out.result;
}
