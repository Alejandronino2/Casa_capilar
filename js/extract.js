import { uploadImage, fetchStories, saveStories, readAsDataUrl, downloadDataUrl, trimTransparent } from './api.js';
import { cutoutImage } from './cutout.js';
import { DEFAULT_STORY, normalizeStory } from './template.js';

const items = [];
let counter = 0;
const trim = { enabled: true, threshold: 8, padding: 2 };

function slugify(value) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/\.[a-z0-9]+$/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
}

function render() {
  const host = document.getElementById('cards');
  const empty = document.getElementById('empty');
  empty.classList.toggle('hidden', items.length > 0);
  host.innerHTML = items.map(function (item) {
    return '<article class="card" data-key="' + item.key + '">' +
      '<div style="display:flex;justify-content:space-between;font-size:10px;margin-bottom:8px"><span>' + item.file.name + '</span><span>' + item.status + (item.progress ? ' · ' + item.progress : '') + '</span></div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">' +
      '<img src="' + item.originalUrl + '" alt="" style="width:100%;height:128px;object-fit:contain;background:#111;border-radius:8px">' +
      '<div class="checker" style="height:128px;border-radius:8px;display:flex;align-items:center;justify-content:center">' +
      (item.result ? '<img src="' + item.result.dataUrl + '" style="max-width:100%;max-height:100%;object-fit:contain">' : '<span style="font-size:10px;color:#737373">sin resultado</span>') +
      '</div></div>' +
      (item.result ? '<p class="help">' + item.result.width + '×' + item.result.height + ' px</p>' : '') +
      (item.error ? '<p class="note err">' + item.error + '</p>' : '') +
      (item.savedPath ? '<p class="note">Guardado en ' + item.savedPath + '</p>' : '') +
      '<label class="field" style="margin-top:8px"><span class="lbl">id del PNG</span>' +
      '<input type="text" value="' + item.id + '" data-id="' + item.key + '"></label>' +
      '<div class="row" style="margin-top:8px">' +
      '<button class="btn" data-run="' + item.key + '">Procesar</button>' +
      '<button class="btn" data-dl="' + item.key + '"' + (item.result ? '' : ' disabled') + '>Descargar</button>' +
      '<button class="btn btn-primary" data-save="' + item.key + '"' + (item.result ? '' : ' disabled') + '>Guardar</button>' +
      '</div></article>';
  }).join('');
  const ready = items.filter(function (i) { return i.status === 'listo'; }).length;
  document.getElementById('batchInfo').textContent = items.length + ' en cola · ' + ready + ' listas';
  const canSend = items.length > 0;
  document.getElementById('btnToEditor').disabled = !canSend || sending;
  document.getElementById('btnToEditor2').disabled = !canSend || sending;
}

let sending = false;

function titleFromFile(name) {
  return name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim() || 'Nueva pieza';
}

function uniqueId(base, taken) {
  var id = base || 'pieza';
  if (!taken[id]) return id;
  var n = 2;
  while (taken[id + '-' + n]) n += 1;
  return id + '-' + n;
}

function addFiles(files) {
  Array.from(files || []).filter(function (f) { return f.type.indexOf('image/') === 0; }).forEach(function (file) {
    counter += 1;
    items.push({
      key: 'item-' + counter,
      file: file,
      id: slugify(file.name) || 'producto-' + counter,
      status: 'pendiente',
      progress: '',
      originalUrl: URL.createObjectURL(file),
    });
  });
  render();
}

async function processOne(item) {
  item.status = 'procesando';
  item.progress = 'preparando…';
  item.error = '';
  render();
  try {
    const out = await cutoutImage(item.file, function (msg) { item.progress = msg; render(); }, trim);
    item.status = 'listo';
    item.progress = '';
    item.result = out.result;
    item.rawDataUrl = out.rawDataUrl;
  } catch (err) {
    item.status = 'error';
    item.error = err.message || String(err);
  }
  render();
}

document.getElementById('fileAdd').onchange = function (e) { addFiles(e.target.files); e.target.value = ''; };
document.getElementById('btnAdd').onclick = function () { document.getElementById('fileAdd').click(); };
async function processPending() {
  for (let i = 0; i < items.length; i += 1) {
    if (items[i].status === 'pendiente' || items[i].status === 'error') await processOne(items[i]);
  }
}

document.getElementById('btnProcess').onclick = function () { processPending(); };

async function sendToEditor() {
  if (!items.length || sending) return;
  sending = true;
  const note = document.getElementById('sendNote');
  note.textContent = 'Procesando imagenes…';
  render();
  try {
    await processPending();
    const ready = items.filter(function (i) { return i.status === 'listo' && i.result; });
    if (!ready.length) throw new Error('Ninguna imagen quedo lista. Revisa los errores.');

    const stories = (await fetchStories()).map(function (s, i) { return normalizeStory(s, i); });
    const taken = {};
    stories.forEach(function (s) { taken[s.id] = true; });
    const created = [];

    for (let i = 0; i < ready.length; i += 1) {
      const item = ready[i];
      note.textContent = 'Enviando ' + (i + 1) + '/' + ready.length + '… ' + item.id;
      const id = uniqueId(item.id, taken);
      taken[id] = true;
      item.id = id;
      const saved = await uploadImage(id, item.result.dataUrl, 'product');
      if (!saved.ok) throw new Error(saved.error || 'No se pudo guardar ' + id);
      item.savedPath = saved.path;
      try {
        const originalData = await readAsDataUrl(item.file);
        const orig = await uploadImage(id, originalData, 'original');
        if (orig.ok) item.originalPath = orig.path;
      } catch (e) { /* original opcional */ }

      const story = normalizeStory({
        id: id,
        titulo: titleFromFile(item.file.name),
        textoA: DEFAULT_STORY.textoA,
        textoB: DEFAULT_STORY.textoB,
        productImage: saved.path,
        background: DEFAULT_STORY.background,
        originalImage: item.originalPath || '',
        notes: 'Creada desde extract: ' + item.file.name,
      }, stories.length + created.length);
      created.push(story);
    }

    const result = await saveStories(stories.concat(created));
    if (!result.ok) throw new Error(result.error || 'No se pudieron guardar las piezas');
    note.textContent = created.length + ' pieza(s) listas. Abriendo editor…';
    window.location.href = 'index.php?select=' + encodeURIComponent(created[0].id) + '&created=' + encodeURIComponent(created.map(function (s) { return s.id; }).join(','));
  } catch (err) {
    note.textContent = err.message || String(err);
    note.className = 'note err';
    sending = false;
    render();
  }
}

document.getElementById('btnToEditor').onclick = function () { sendToEditor(); };
document.getElementById('btnToEditor2').onclick = function () { sendToEditor(); };
document.getElementById('zone').ondragover = function (e) { e.preventDefault(); };
document.getElementById('zone').ondrop = function (e) { e.preventDefault(); addFiles(e.dataTransfer.files); };
document.getElementById('cards').onclick = function (e) {
  const run = e.target.getAttribute('data-run');
  const dl = e.target.getAttribute('data-dl');
  const save = e.target.getAttribute('data-save');
  const item = items.find(function (i) { return i.key === run || i.key === dl || i.key === save; });
  if (!item) return;
  if (run) processOne(item);
  if (dl && item.result) downloadDataUrl(item.result.dataUrl, item.id + '.png');
  if (save && item.result) {
    uploadImage(item.id, item.result.dataUrl, 'product').then(function (r) {
      item.savedPath = r.ok ? r.path : '';
      item.error = r.ok ? '' : (r.error || 'Error');
      render();
    });
  }
};
document.getElementById('cards').onchange = function (e) {
  const key = e.target.getAttribute('data-id');
  const item = items.find(function (i) { return i.key === key; });
  if (item) item.id = slugify(e.target.value) || item.id;
};
document.getElementById('btnDlAll').onclick = function () {
  items.filter(function (i) { return i.result; }).forEach(function (i) { downloadDataUrl(i.result.dataUrl, i.id + '.png'); });
};
document.getElementById('btnSaveAll').onclick = function () {
  items.filter(function (i) { return i.result; }).forEach(function (i) {
    uploadImage(i.id, i.result.dataUrl, 'product').then(function (r) {
      i.savedPath = r.ok ? r.path : '';
      render();
    });
  });
};
document.getElementById('btnClear').onclick = function () { items.length = 0; render(); };
document.getElementById('trimOn').onchange = function (e) { trim.enabled = e.target.checked; };
document.getElementById('trimTh').oninput = function (e) { trim.threshold = Number(e.target.value); document.getElementById('trimThV').textContent = e.target.value; };
document.getElementById('trimPad').oninput = function (e) { trim.padding = Number(e.target.value); document.getElementById('trimPadV').textContent = e.target.value + 'px'; };
document.getElementById('btnRetrim').onclick = async function () {
  for (let i = 0; i < items.length; i += 1) {
    if (items[i].rawDataUrl) items[i].result = await trimTransparent(items[i].rawDataUrl, trim);
  }
  render();
};
