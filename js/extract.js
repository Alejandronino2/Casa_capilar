import { uploadImage, fetchStories, saveStories, readAsDataUrl, downloadDataUrl, trimTransparent } from './api.js';
import { cutoutImage } from './cutout.js';
import { DEFAULT_STORY, normalizeStory } from './template.js';

const items = [];
let counter = 0;
const trim = { enabled: true, threshold: 8, padding: 2 };
let sending = false;
let processing = false;

function slugify(value) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/\.[a-z0-9]+$/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
}

function isBusy(item) {
  return item.status === 'procesando' || item.status === 'guardando';
}

function isUnsaved(item) {
  return !!(item.result && (!item.savedPath || item.savedId !== item.id));
}

function statusClass(item) {
  if (item.status === 'error') return 'err';
  if (isBusy(item)) return 'busy';
  if (isUnsaved(item)) return 'warn';
  if (item.status === 'guardado') return 'ok';
  if (item.status === 'listo') return 'ok';
  return 'pending';
}

function statusLabel(item) {
  if (item.status === 'procesando') return 'procesando';
  if (item.status === 'guardando') return 'guardando';
  if (item.status === 'error') return 'error';
  if (isUnsaved(item)) return 'sin guardar';
  if (item.status === 'guardado') return 'guardado';
  if (item.status === 'listo') return 'listo';
  return 'pendiente';
}

function saveButtonLabel(item) {
  if (item.status === 'guardando') return 'Guardando…';
  if (item.result && !isUnsaved(item)) return 'Guardado';
  return 'Guardar';
}

function elapsed(item) {
  if (!item.startedAt) return '';
  const sec = Math.max(0, Math.round((Date.now() - item.startedAt) / 1000));
  return sec ? sec + 's' : '';
}

function counts() {
  return {
    total: items.length,
    pending: items.filter(function (i) { return i.status === 'pendiente' || i.status === 'error'; }).length,
    busy: items.filter(isBusy).length,
    unsaved: items.filter(isUnsaved).length,
    saved: items.filter(function (i) { return i.status === 'guardado' && !isUnsaved(i); }).length,
    error: items.filter(function (i) { return i.status === 'error'; }).length,
  };
}

function setProcessNote(text, kind) {
  const el = document.getElementById('processNote');
  el.textContent = text || '';
  el.className = 'note' + (kind === 'err' ? ' err' : kind === 'warn' ? ' warn' : '');
}

function updateToolbar() {
  const c = counts();
  const processBtn = document.getElementById('btnProcess');
  processBtn.disabled = processing || sending || !c.pending;
  processBtn.textContent = processing ? 'Procesando…' : 'Procesar todo';
  document.getElementById('btnToEditor').disabled = !c.total || sending || processing;
  document.getElementById('btnToEditor2').disabled = !c.total || sending || processing;
  document.getElementById('btnSaveAll').disabled = sending || processing || !c.unsaved;
  document.getElementById('btnSaveAll').textContent = c.unsaved ? 'Guardar todos (' + c.unsaved + ')' : 'Guardar todos';

  const parts = [c.total + ' en cola'];
  if (c.busy) parts.push(c.busy + ' en proceso');
  if (c.unsaved) parts.push(c.unsaved + ' sin guardar');
  if (c.saved) parts.push(c.saved + ' guardada' + (c.saved === 1 ? '' : 's'));
  if (c.error) parts.push(c.error + ' con error');
  document.getElementById('batchInfo').textContent = parts.join(' · ');

  if (processing) return;
  if (sending) return;
  if (c.unsaved) setProcessNote(c.unsaved + (c.unsaved === 1 ? ' recorte sin guardar' : ' recortes sin guardar'), 'warn');
  else if (c.saved && !c.pending) setProcessNote('Todo guardado');
  else setProcessNote('');
}

function cardHtml(item) {
  const busy = isBusy(item);
  const unsaved = isUnsaved(item);
  const showBar = item.status === 'procesando';
  const pct = item.percent || 0;
  const time = elapsed(item);
  return '<article class="card' + (busy ? ' is-busy' : '') + (unsaved ? ' is-dirty' : '') + '" data-key="' + item.key + '">' +
    '<div class="card-head"><span class="card-name">' + item.file.name + '</span>' +
    '<span class="badge ' + statusClass(item) + '" data-role="badge">' + statusLabel(item) + '</span></div>' +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">' +
    '<img src="' + item.originalUrl + '" alt="" style="width:100%;height:128px;object-fit:contain;background:#111;border-radius:8px">' +
    '<div class="checker" style="height:128px;border-radius:8px;display:flex;align-items:center;justify-content:center">' +
    (item.result ? '<img src="' + item.result.dataUrl + '" style="max-width:100%;max-height:100%;object-fit:contain">' : '<span style="font-size:10px;color:#737373">' + (busy ? 'procesando…' : 'sin resultado') + '</span>') +
    '</div></div>' +
    '<p class="card-progress" data-role="progress">' + (item.progress || '') + (time ? ' · ' + time : '') + '</p>' +
    '<div class="progress-bar' + (showBar && !pct ? ' indeterminate' : '') + (showBar ? '' : ' hidden') + '" data-role="bar">' +
    '<span data-role="fill" style="width:' + pct + '%"></span></div>' +
    (item.result ? '<p class="help">' + item.result.width + '×' + item.result.height + ' px</p>' : '') +
    (item.error ? '<p class="note err">' + item.error + '</p>' : '') +
    (item.savedPath && !unsaved ? '<p class="note">Guardado en ' + item.savedPath + '</p>' : '') +
    (unsaved ? '<p class="note warn">Editado o procesado, todavia no esta guardado.</p>' : '') +
    '<label class="field" style="margin-top:8px"><span class="lbl">id del PNG</span>' +
    '<input type="text" value="' + item.id + '" data-id="' + item.key + '"' + (busy ? ' disabled' : '') + '></label>' +
    '<div class="row" style="margin-top:8px">' +
    '<button class="btn" data-run="' + item.key + '"' + (busy || sending ? ' disabled' : '') + '>' + (item.status === 'procesando' ? 'Procesando…' : 'Procesar') + '</button>' +
    '<button class="btn" data-dl="' + item.key + '"' + (item.result && !busy ? '' : ' disabled') + '>Descargar</button>' +
    '<button class="btn btn-primary" data-save="' + item.key + '"' + (item.result && unsaved && !busy && !sending ? '' : ' disabled') + '>' + saveButtonLabel(item) + '</button>' +
    '</div></article>';
}

function render() {
  const host = document.getElementById('cards');
  const empty = document.getElementById('empty');
  empty.classList.toggle('hidden', items.length > 0);
  host.innerHTML = items.map(cardHtml).join('');
  updateToolbar();
}

function paintProgress(item) {
  const card = document.querySelector('[data-key="' + item.key + '"]');
  if (!card) {
    render();
    return;
  }
  const badge = card.querySelector('[data-role="badge"]');
  const prog = card.querySelector('[data-role="progress"]');
  const bar = card.querySelector('[data-role="bar"]');
  const fill = card.querySelector('[data-role="fill"]');
  const time = elapsed(item);
  if (badge) {
    badge.className = 'badge ' + statusClass(item);
    badge.textContent = statusLabel(item);
  }
  if (prog) prog.textContent = (item.progress || '') + (time ? ' · ' + time : '');
  if (bar) {
    bar.classList.toggle('hidden', item.status !== 'procesando');
    bar.classList.toggle('indeterminate', item.status === 'procesando' && !(item.percent > 0));
  }
  if (fill) fill.style.width = (item.percent || 0) + '%';
}

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
      progress: 'En cola, espera a Procesar',
      percent: 0,
      originalUrl: URL.createObjectURL(file),
      savedPath: '',
      savedId: '',
    });
  });
  render();
}

async function processOne(item) {
  if (!item || isBusy(item)) return;
  item.status = 'procesando';
  item.progress = 'Preparando imagen…';
  item.percent = 4;
  item.error = '';
  item.result = null;
  item.rawDataUrl = '';
  item.savedPath = '';
  item.savedId = '';
  item.startedAt = Date.now();
  render();
  try {
    const out = await cutoutImage(item.file, function (msg, percent) {
      item.progress = msg;
      if (typeof percent === 'number') item.percent = percent;
      paintProgress(item);
      const c = counts();
      setProcessNote('Procesando ' + item.id + ' · ' + msg + (c.busy > 1 ? ' · ' + c.busy + ' en curso' : ''));
    }, trim);
    item.status = 'listo';
    item.progress = 'Listo, sin guardar';
    item.percent = 100;
    item.result = out.result;
    item.rawDataUrl = out.rawDataUrl;
  } catch (err) {
    item.status = 'error';
    item.progress = '';
    item.percent = 0;
    item.error = err.message || String(err);
  }
  item.startedAt = 0;
  render();
}

async function processPending() {
  if (processing) return;
  const queue = items.filter(function (i) { return i.status === 'pendiente' || i.status === 'error'; });
  if (!queue.length) return;
  processing = true;
  updateToolbar();
  for (let i = 0; i < queue.length; i += 1) {
    setProcessNote('Procesando ' + (i + 1) + '/' + queue.length + ' · ' + queue[i].file.name);
    await processOne(queue[i]);
  }
  processing = false;
  render();
}

async function saveOne(item) {
  if (!item || !item.result || item.status === 'guardando' || sending) return;
  item.status = 'guardando';
  item.progress = 'Subiendo PNG…';
  item.error = '';
  render();
  try {
    const r = await uploadImage(item.id, item.result.dataUrl, 'product');
    if (!r.ok) throw new Error(r.error || 'No se pudo guardar');
    item.savedPath = r.path;
    item.savedId = item.id;
    item.status = 'guardado';
    item.progress = '';
  } catch (err) {
    item.status = 'listo';
    item.error = err.message || String(err);
    item.progress = '';
  }
  render();
}

function markIdChange(item, value) {
  item.id = slugify(value) || item.id;
  if (item.result) {
    item.progress = isUnsaved(item) ? 'Cambios sin guardar' : '';
    if (item.status === 'guardado' && isUnsaved(item)) item.status = 'listo';
  }
  render();
}

document.getElementById('fileAdd').onchange = function (e) { addFiles(e.target.files); e.target.value = ''; };
document.getElementById('btnAdd').onclick = function () { document.getElementById('fileAdd').click(); };
document.getElementById('btnProcess').onclick = function () {
  if (!counts().pending) {
    setProcessNote('No hay imagenes pendientes', 'warn');
    return;
  }
  processPending();
};

async function sendToEditor() {
  if (!items.length || sending || processing) return;
  sending = true;
  const note = document.getElementById('sendNote');
  note.className = 'note';
  note.textContent = 'Procesando imagenes pendientes…';
  setProcessNote('Preparando envio al editor…');
  render();
  try {
    await processPending();
    const ready = items.filter(function (i) { return i.result; });
    if (!ready.length) throw new Error('Ninguna imagen quedo lista. Revisa los errores.');

    const stories = (await fetchStories()).map(function (s, i) { return normalizeStory(s, i); });
    const taken = {};
    stories.forEach(function (s) { taken[s.id] = true; });
    const created = [];

    for (let i = 0; i < ready.length; i += 1) {
      const item = ready[i];
      item.status = 'guardando';
      item.progress = 'Enviando al editor…';
      render();
      note.textContent = 'Enviando ' + (i + 1) + '/' + ready.length + '… ' + item.id;
      setProcessNote('Enviando ' + (i + 1) + '/' + ready.length + ' · ' + item.id);
      const id = uniqueId(item.id, taken);
      taken[id] = true;
      item.id = id;
      const saved = await uploadImage(id, item.result.dataUrl, 'product');
      if (!saved.ok) throw new Error(saved.error || 'No se pudo guardar ' + id);
      item.savedPath = saved.path;
      item.savedId = id;
      item.status = 'guardado';
      item.progress = '';
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
    setProcessNote('Listo. Abriendo editor…');
    window.location.href = 'index.php?select=' + encodeURIComponent(created[0].id) + '&created=' + encodeURIComponent(created.map(function (s) { return s.id; }).join(','));
  } catch (err) {
    note.textContent = err.message || String(err);
    note.className = 'note err';
    setProcessNote(err.message || String(err), 'err');
    sending = false;
    items.forEach(function (item) {
      if (item.status === 'guardando') item.status = item.result ? 'listo' : 'error';
    });
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
  if (save) saveOne(item);
};
document.getElementById('cards').onchange = function (e) {
  const key = e.target.getAttribute('data-id');
  const item = items.find(function (i) { return i.key === key; });
  if (item) markIdChange(item, e.target.value);
};
document.getElementById('btnDlAll').onclick = function () {
  items.filter(function (i) { return i.result; }).forEach(function (i) { downloadDataUrl(i.result.dataUrl, i.id + '.png'); });
};
document.getElementById('btnSaveAll').onclick = async function () {
  const unsaved = items.filter(isUnsaved);
  for (let i = 0; i < unsaved.length; i += 1) await saveOne(unsaved[i]);
};
document.getElementById('btnClear').onclick = function () {
  if (processing || sending) return;
  if (counts().unsaved && !confirm('Hay recortes sin guardar. Vaciar la cola?')) return;
  items.length = 0;
  render();
};
document.getElementById('trimOn').onchange = function (e) { trim.enabled = e.target.checked; };
document.getElementById('trimTh').oninput = function (e) { trim.threshold = Number(e.target.value); document.getElementById('trimThV').textContent = e.target.value; };
document.getElementById('trimPad').oninput = function (e) { trim.padding = Number(e.target.value); document.getElementById('trimPadV').textContent = e.target.value + 'px'; };
document.getElementById('btnRetrim').onclick = async function () {
  for (let i = 0; i < items.length; i += 1) {
    if (!items[i].rawDataUrl) continue;
    items[i].result = await trimTransparent(items[i].rawDataUrl, trim);
    items[i].savedPath = '';
    items[i].savedId = '';
    items[i].status = 'listo';
    items[i].progress = 'Re-recortado, sin guardar';
  }
  render();
};

window.addEventListener('beforeunload', function (e) {
  if (processing || sending || counts().unsaved) {
    e.preventDefault();
    e.returnValue = '';
  }
});

updateToolbar();
