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

export async function cutoutImage(source, onProgress, trim) {
  if (onProgress) onProgress('cargando modelo…');
  const mod = await import('https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.7.0/+esm');
  const blob = await mod.removeBackground(source, {
    output: { format: 'image/png' },
    progress: function (key, current, total) {
      const pct = total > 0 ? Math.round((current / total) * 100) : 0;
      if (onProgress) onProgress(key + ' ' + pct + '%');
    },
  });
  if (onProgress) onProgress('recortando margenes…');
  const raw = await readAsDataUrl(blob);
  const result = await trimTransparent(raw, trim);
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
