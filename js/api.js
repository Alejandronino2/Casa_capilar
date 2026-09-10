export async function fetchStories() {
  const res = await fetch('api/products.php', { cache: 'no-store' });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

export async function saveStories(stories) {
  const res = await fetch('api/products.php', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(stories),
  });
  return res.json();
}

export async function fetchTrash() {
  const res = await fetch('api/trash.php', { cache: 'no-store' });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const data = await res.json();
  return (data && data.items) ? data.items : [];
}

export async function trashAction(action, ids, stories) {
  const body = { action: action, ids: ids };
  if (stories) body.stories = stories;
  const res = await fetch('api/trash.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok || !data.ok) {
    throw new Error((data && data.error) || 'No se pudo actualizar borrados');
  }
  return data;
}

export async function aiStatus() {
  const res = await fetch('api/ai.php', { cache: 'no-store' });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}

export async function completeStoryCopy(story, options) {
  options = options || {};
  const res = await fetch('api/ai.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: story.id,
      titulo: story.titulo,
      notes: story.notes || '',
      folder: story.folder || '',
      marca: options.marca || story.folder || '',
      productImage: story.productImage || '',
      originalImage: story.originalImage || '',
      usePhoto: !!options.usePhoto,
    }),
  });
  const data = await res.json();
  if (!res.ok || !data.ok) {
    const err = new Error((data && data.error) || 'No se pudo completar con IA');
    if (data && data.rateLimited) {
      err.rateLimited = true;
      err.retryAfter = Math.max(3, Number(data.retryAfter) || 20);
    }
    throw err;
  }
  return data;
}

export async function fetchFolders() {
  const res = await fetch('api/folders.php', { cache: 'no-store' });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const data = await res.json();
  return (data && data.folders) ? data.folders : [];
}

export async function createFolder(name) {
  const res = await fetch('api/folders.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'create', name: name }),
  });
  const data = await res.json();
  if (!res.ok || !data.ok) throw new Error((data && data.error) || 'No se pudo crear carpeta');
  return data;
}

export async function deleteFolder(id) {
  const res = await fetch('api/folders.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'delete', id: id }),
  });
  const data = await res.json();
  if (!res.ok || !data.ok) throw new Error((data && data.error) || 'No se pudo borrar carpeta');
  return data;
}

export async function uploadImage(id, dataUrl, type) {
  const res = await fetch('api/upload.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: id, dataUrl: dataUrl, type: type || 'product' }),
  });
  return res.json();
}

export function readAsDataUrl(file) {
  return new Promise(function (resolve, reject) {
    const reader = new FileReader();
    reader.onload = function () { resolve(String(reader.result)); };
    reader.onerror = function () { reject(reader.error || new Error('No se pudo leer el archivo')); };
    reader.readAsDataURL(file);
  });
}

export function downloadDataUrl(dataUrl, filename) {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

export function trimTransparent(dataUrl, options) {
  options = options || { enabled: true, threshold: 8, padding: 2 };
  return new Promise(function (resolve, reject) {
    const img = new Image();
    img.onload = function () {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0);
      if (!options.enabled) {
        resolve({ dataUrl: canvas.toDataURL('image/png'), width: canvas.width, height: canvas.height });
        return;
      }
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      let minX = canvas.width, minY = canvas.height, maxX = -1, maxY = -1;
      for (let y = 0; y < canvas.height; y += 1) {
        for (let x = 0; x < canvas.width; x += 1) {
          if (data[(y * canvas.width + x) * 4 + 3] > options.threshold) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }
      if (maxX < 0) {
        resolve({ dataUrl: canvas.toDataURL('image/png'), width: canvas.width, height: canvas.height });
        return;
      }
      const pad = options.padding || 0;
      const left = Math.max(0, minX - pad);
      const top = Math.max(0, minY - pad);
      const right = Math.min(canvas.width - 1, maxX + pad);
      const bottom = Math.min(canvas.height - 1, maxY + pad);
      const out = document.createElement('canvas');
      out.width = right - left + 1;
      out.height = bottom - top + 1;
      out.getContext('2d').drawImage(canvas, left, top, out.width, out.height, 0, 0, out.width, out.height);
      resolve({ dataUrl: out.toDataURL('image/png'), width: out.width, height: out.height });
    };
    img.onerror = function () { reject(new Error('No se pudo recortar el PNG')); };
    img.src = dataUrl;
  });
}
