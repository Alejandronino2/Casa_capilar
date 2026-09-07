import { CANVAS, DEFAULT_STORY, GRADIENT, LIMITS, SAFE, normalizeStory, renderStory, ensureFonts } from './template.js';
import { fetchStories, saveStories, uploadImage, readAsDataUrl, downloadDataUrl } from './api.js';
import { importProductCutout } from './cutout.js';

const state = {
  stories: [],
  selectedId: '',
  baseline: '',
  checked: {},
  autoFit: true,
  showGuides: true,
  showCompare: false,
  zoom: 'fit',
  fitScale: 0.3,
  assetRevision: 0,
  metrics: null,
  exporting: false,
  saving: false,
  processingId: '',
};

const $ = function (sel) { return document.querySelector(sel); };

function selected() {
  return state.stories.find(function (s) { return s.id === state.selectedId; }) || state.stories[0];
}

function baselineStories() {
  try { return JSON.parse(state.baseline || '[]'); } catch (e) { return []; }
}

function storyIsDirty(story) {
  const saved = baselineStories().find(function (s) { return s.id === story.id; });
  if (!saved) return true;
  return JSON.stringify(story) !== JSON.stringify(saved);
}

function dirtyCount() {
  return state.stories.filter(storyIsDirty).length;
}

function isDirty() {
  return JSON.stringify(state.stories) !== state.baseline;
}

function setNote(text, kind) {
  const el = $('#saveNote');
  el.textContent = text || '';
  el.className = 'note' + (kind === 'err' ? ' err' : kind === 'warn' ? ' warn' : '');
}

function refreshSaveState(note, kind) {
  const dirty = isDirty();
  const count = dirtyCount();
  const btn = $('#saveBtn');
  if (state.saving) {
    btn.disabled = true;
    btn.textContent = 'Guardando…';
  } else {
    btn.disabled = !dirty || !!state.processingId;
    btn.textContent = dirty ? 'Guardar' : 'Guardado';
  }
  if (note !== undefined) {
    setNote(note, kind);
    return;
  }
  if (state.processingId) return;
  if (dirty) setNote(count + (count === 1 ? ' cambio sin guardar' : ' cambios sin guardar'), 'warn');
  else if (!state.exporting) setNote('');
}

function storyBadge(story) {
  if (state.saving && storyIsDirty(story)) return { cls: 'busy', text: 'guardando' };
  if (state.processingId === story.id) return { cls: 'busy', text: 'procesando' };
  if (storyIsDirty(story)) return { cls: 'warn', text: 'sin guardar' };
  return { cls: 'ok', text: 'guardada' };
}

async function preview() {
  const story = selected();
  if (!story) return;
  const metrics = await renderStory($('#previewHost'), story, {
    autoFit: state.autoFit,
    showGuides: state.showGuides,
    highlightOverflow: true,
    assetRevision: state.assetRevision,
  });
  state.metrics = metrics;
  renderWarnings(story, metrics);
  scaleStage();
}

function scaleStage() {
  const host = $('#stage');
  const frame = $('#stageFrame');
  const inner = $('#previewHost');
  const scale = state.zoom === 'fit'
    ? Math.max(0.05, Math.min((host.clientWidth - 24) / CANVAS.width, (host.clientHeight - 24) / CANVAS.height))
    : state.zoom;
  state.fitScale = scale;
  frame.style.width = CANVAS.width * scale + 'px';
  frame.style.height = CANVAS.height * scale + 'px';
  inner.style.width = CANVAS.width + 'px';
  inner.style.height = CANVAS.height + 'px';
  inner.style.transform = 'scale(' + scale + ')';
  inner.style.transformOrigin = 'top left';
  $('#stageBadge').textContent = '1080 × 1920 · ' + Math.round(scale * 100) + '%';
}

function renderWarnings(story, metrics) {
  const box = $('#warnings');
  const issues = [];
  if (metrics.productMissing) {
    issues.push({ t: 'e', text: story.productImage ? 'No se pudo cargar ' + story.productImage : 'Falta el PNG del producto.' });
  }
  if (metrics.backgroundMissing) issues.push({ t: 'w', text: 'No se pudo cargar el fondo. Se usa el fondo CSS.' });
  const overflows = [];
  if (metrics.title.overflow) overflows.push('titulo');
  if (metrics.blockA.overflow) overflows.push('texto A');
  if (metrics.blockB.overflow) overflows.push('texto B');
  if (overflows.length) issues.push({ t: 'e', text: 'Desborda: ' + overflows.join(', ') + '.' });
  if (state.autoFit && metrics.title.size && metrics.title.size < story.titleSize) {
    issues.push({ t: 'i', text: 'Auto-ajuste: titulo ' + story.titleSize + 'px → ' + metrics.title.size + 'px.' });
  }
  const body = Math.min(metrics.blockA.size || story.bodySize, metrics.blockB.size || story.bodySize);
  if (state.autoFit && body < story.bodySize) {
    issues.push({ t: 'i', text: 'Auto-ajuste: cuerpo ' + story.bodySize + 'px → ' + body + 'px.' });
  }
  if (metrics.productUpscale > 1.005 && metrics.productNatural) {
    issues.push({ t: 'w', text: 'El PNG se amplia al ' + Math.round(metrics.productUpscale * 100) + '% de su resolucion.' });
  }
  if (metrics.productInvadesTopSafeZone) {
    issues.push({ t: 'w', text: 'El producto entra en los ' + SAFE.top + 'px superiores.' });
  }
  if (!issues.length) {
    box.innerHTML = '<p class="warn-ok">Sin avisos: el texto cabe y nada invade las zonas seguras.</p>';
    return;
  }
  box.innerHTML = '<ul>' + issues.map(function (i) {
    return '<li class="' + i.t + '">' + i.text + '</li>';
  }).join('') + '</ul>';
}

function renderList() {
  const ul = $('#storyList');
  const allChecked = state.stories.length > 0 && state.stories.every(function (s) { return state.checked[s.id]; });
  $('#checkAll').checked = allChecked;
  ul.innerHTML = state.stories.map(function (story) {
    const active = story.id === state.selectedId;
    const badge = storyBadge(story);
    return '<li><div class="item' + (active ? ' active' : '') + (storyIsDirty(story) ? ' is-dirty' : '') + '" data-id="' + story.id + '">' +
      '<div class="item-top"><div style="display:flex;gap:8px;min-width:0">' +
      '<input type="checkbox" data-check="' + story.id + '"' + (state.checked[story.id] ? ' checked' : '') + '>' +
      '<div style="min-width:0"><p class="item-title">' + (story.titulo || '(sin titulo)') + '</p>' +
      '<p class="item-id">' + story.id + '</p></div></div>' +
      '<span class="badge ' + badge.cls + '">' + badge.text + '</span></div>' +
      '<div class="item-meta"><span>' + (story.textLayout === 'stacked' ? 'apilado' : '2 columnas') + '</span>' +
      '<span>' + (story.background === GRADIENT ? 'fondo CSS' : 'foto') + '</span>' +
      '<button type="button" data-dup="' + story.id + '">duplicar</button>' +
      '<button type="button" class="del" data-del="' + story.id + '">borrar</button></div></div></li>';
  }).join('');
  $('#downloadBtn').textContent = 'Descargar (' + Object.keys(state.checked).filter(function (id) { return state.checked[id]; }).length + ')';
  $('#downloadBtn').disabled = !Object.keys(state.checked).some(function (id) { return state.checked[id]; }) || state.exporting;
}

function fillForm() {
  const s = selected();
  if (!s) return;
  $('#f-id').value = s.id;
  $('#f-titulo').value = s.titulo;
  $('#f-textoA').value = s.textoA;
  $('#f-textoB').value = s.textoB;
  $('#f-notes').value = s.notes || '';
  $('#f-product').value = s.productImage;
  $('#f-bg').value = s.background;
  $('#f-original').value = s.originalImage || '';
  $('#f-layout').value = s.textLayout;
  $('#f-scale').value = s.productScale;
  $('#f-scale-val').textContent = Number(s.productScale).toFixed(2) + '×';
  $('#f-off').value = s.productOffsetY;
  $('#f-off-val').textContent = s.productOffsetY + 'px';
  $('#f-title').value = s.titleSize;
  $('#f-title-val').textContent = s.titleSize + 'px';
  $('#f-body').value = s.bodySize;
  $('#f-body-val').textContent = s.bodySize + 'px';
  $('#f-accent').value = /^#[0-9a-f]{6}$/i.test(s.accentColor) ? s.accentColor : '#2B2B2B';
  $('#f-accent-txt').value = s.accentColor;
  updateCompare();
}

function patch(partial) {
  state.stories = state.stories.map(function (story) {
    if (story.id !== state.selectedId) return story;
    const next = normalizeStory(Object.assign({}, story, partial));
    if (partial.id && partial.id !== state.selectedId) {
      if (state.checked[state.selectedId]) {
        delete state.checked[state.selectedId];
        state.checked[partial.id] = true;
      }
      state.selectedId = partial.id;
    }
    return next;
  });
  refreshSaveState();
  renderList();
  const s = selected();
  if (s) {
    $('#f-scale-val').textContent = Number(s.productScale).toFixed(2) + '×';
    $('#f-off-val').textContent = s.productOffsetY + 'px';
    $('#f-title-val').textContent = s.titleSize + 'px';
    $('#f-body-val').textContent = s.bodySize + 'px';
    if (partial.productImage) $('#f-product').value = s.productImage;
    if (partial.background) $('#f-bg').value = s.background;
    if (partial.originalImage) $('#f-original').value = s.originalImage || '';
    if (partial.accentColor) {
      $('#f-accent').value = /^#[0-9a-f]{6}$/i.test(s.accentColor) ? s.accentColor : '#2B2B2B';
      $('#f-accent-txt').value = s.accentColor;
    }
  }
  preview();
}

function updateCompare() {
  const s = selected();
  const wrap = $('#compare');
  wrap.classList.toggle('hidden', !state.showCompare);
  $('#stageRow').className = 'stage-row ' + (state.showCompare ? 'two' : 'one');
  const img = $('#compareImg');
  const empty = $('#compareEmpty');
  if (s && s.originalImage) {
    img.src = s.originalImage + (state.assetRevision ? '?v=' + state.assetRevision : '');
    img.classList.remove('hidden');
    empty.classList.add('hidden');
  } else {
    img.removeAttribute('src');
    img.classList.add('hidden');
    empty.classList.remove('hidden');
  }
}

async function downloadChecked() {
  const queued = state.stories.filter(function (s) { return state.checked[s.id]; });
  if (!queued.length) return;
  state.exporting = true;
  renderList();
  const hold = $('#exportHost');
  hold.style.cssText = 'position:fixed;left:-2000px;top:0;width:1080px;height:1920px;overflow:hidden;pointer-events:none;z-index:-1';
  await ensureFonts();
  for (let i = 0; i < queued.length; i += 1) {
    setNote('Descargando ' + (i + 1) + '/' + queued.length + '… ' + queued[i].id);
    await renderStory(hold, queued[i], { autoFit: true, showGuides: false });
    const htmlToImage = await import('https://cdn.jsdelivr.net/npm/html-to-image@1.11.13/+esm');
    const canvas = hold.querySelector('#story-canvas');
    const dataUrl = await htmlToImage.toPng(canvas, {
      width: CANVAS.width,
      height: CANVAS.height,
      pixelRatio: 1,
      cacheBust: true,
    });
    downloadDataUrl(dataUrl, queued[i].id + '_story.png');
    await new Promise(function (r) { setTimeout(r, 350); });
  }
  hold.innerHTML = '';
  state.exporting = false;
  setNote('Descargadas ' + queued.length + ' historia(s)');
  renderList();
}

async function importProduct(file) {
  const s = selected();
  if (!file || !s || state.processingId) return;
  state.processingId = s.id;
  renderList();
  refreshSaveState('Cargando ' + file.name + '…');
  try {
    const cutout = await importProductCutout(file, function (msg) { refreshSaveState(msg); });
    refreshSaveState('Guardando PNG…');
    const result = await uploadImage(s.id, cutout.dataUrl, 'product');
    if (!result.ok) { refreshSaveState(result.error || 'No se pudo guardar', 'err'); return; }
    state.assetRevision = Date.now();
    patch({ productImage: result.path });
    refreshSaveState('Fondo quitado · ' + cutout.width + '×' + cutout.height + ' px. Recuerda guardar la pieza.');
  } catch (err) {
    refreshSaveState(err.message || 'No se pudo quitar el fondo', 'err');
  } finally {
    const keepErr = $('#saveNote').classList.contains('err');
    state.processingId = '';
    renderList();
    if (!keepErr && !state.saving) refreshSaveState();
  }
}

function bind() {
  $('#chkGuides').onchange = function (e) { state.showGuides = e.target.checked; preview(); };
  $('#chkFit').onchange = function (e) { state.autoFit = e.target.checked; preview(); };
  $('#chkCompare').onchange = function (e) { state.showCompare = e.target.checked; updateCompare(); };
  document.querySelectorAll('[data-zoom]').forEach(function (btn) {
    btn.onclick = function () {
      state.zoom = btn.getAttribute('data-zoom') === 'fit' ? 'fit' : Number(btn.getAttribute('data-zoom'));
      document.querySelectorAll('[data-zoom]').forEach(function (b) { b.classList.toggle('active', b === btn); });
      scaleStage();
    };
  });
  $('#saveBtn').onclick = async function () {
    if (state.saving || !isDirty()) return;
    state.saving = true;
    refreshSaveState('Guardando cambios…');
    renderList();
    try {
      const result = await saveStories(state.stories);
      if (result.ok) {
        state.baseline = JSON.stringify(state.stories);
        refreshSaveState('Guardado en content/products.json');
      } else {
        refreshSaveState(result.error || 'Error al guardar', 'err');
      }
    } catch (err) {
      refreshSaveState(err.message || 'Error al guardar', 'err');
    }
    state.saving = false;
    renderList();
    refreshSaveState($('#saveNote').textContent, $('#saveNote').classList.contains('err') ? 'err' : undefined);
  };
  $('#downloadBtn').onclick = function () { downloadChecked(); };
  $('#btnNew').onclick = function () {
    let n = state.stories.length + 1;
    while (state.stories.some(function (s) { return s.id === 'pieza-' + n; })) n += 1;
    const created = normalizeStory(Object.assign({}, DEFAULT_STORY, { id: 'pieza-' + n }));
    state.stories.push(created);
    state.selectedId = created.id;
    renderList(); fillForm(); preview();
    refreshSaveState();
  };
  $('#storyList').onclick = function (e) {
    const check = e.target.getAttribute && e.target.getAttribute('data-check');
    if (e.target.type === 'checkbox' && check) {
      state.checked[check] = e.target.checked;
      renderList();
      return;
    }
    if (e.target.getAttribute('data-dup')) {
      const id = e.target.getAttribute('data-dup');
      const src = state.stories.find(function (s) { return s.id === id; });
      let suf = 2;
      while (state.stories.some(function (s) { return s.id === id + '-' + suf; })) suf += 1;
      const copy = normalizeStory(Object.assign({}, src, { id: id + '-' + suf }));
      state.stories.push(copy);
      state.selectedId = copy.id;
      renderList(); fillForm(); preview();
      refreshSaveState();
      return;
    }
    if (e.target.getAttribute('data-del')) {
      const id = e.target.getAttribute('data-del');
      if (!confirm('Eliminar «' + id + '»?')) return;
      state.stories = state.stories.filter(function (s) { return s.id !== id; });
      delete state.checked[id];
      if (state.selectedId === id) state.selectedId = state.stories[0] ? state.stories[0].id : '';
      renderList(); fillForm(); preview();
      refreshSaveState();
      return;
    }
    const item = e.target.closest('.item');
    if (item) {
      state.selectedId = item.getAttribute('data-id');
      renderList(); fillForm(); preview();
    }
  };
  $('#checkAll').onchange = function (e) {
    state.stories.forEach(function (s) { state.checked[s.id] = e.target.checked; });
    renderList();
  };

  ['id', 'titulo', 'textoA', 'textoB', 'notes', 'product', 'bg', 'original', 'layout', 'accent-txt'].forEach(function (name) {
    const el = document.getElementById('f-' + name);
    if (!el) return;
    el.oninput = function () {
      const map = { id: 'id', titulo: 'titulo', textoA: 'textoA', textoB: 'textoB', notes: 'notes', product: 'productImage', bg: 'background', original: 'originalImage', layout: 'textLayout', 'accent-txt': 'accentColor' };
      const patchData = {};
      patchData[map[name]] = name === 'id' ? el.value.trim().toLowerCase().replace(/[^a-z0-9._-]/g, '-') : el.value;
      patch(patchData);
    };
  });
  function slider(id, key, fmt) {
    const el = document.getElementById(id);
    el.oninput = function () {
      const val = Number(el.value);
      document.getElementById(id + '-val').textContent = fmt(val);
      const o = {}; o[key] = val; patch(o);
    };
  }
  slider('f-scale', 'productScale', function (v) { return v.toFixed(2) + '×'; });
  slider('f-off', 'productOffsetY', function (v) { return v + 'px'; });
  slider('f-title', 'titleSize', function (v) { return v + 'px'; });
  slider('f-body', 'bodySize', function (v) { return v + 'px'; });
  $('#f-accent').oninput = function () { patch({ accentColor: $('#f-accent').value }); };
  $('#btnGradient').onclick = function () { patch({ background: GRADIENT }); };
  $('#btnLeaves').onclick = function () { patch({ background: 'assets/backgrounds/leaves-green-vertical.jpg' }); };
  $('#btnUsePng').onclick = function () { patch({ productImage: 'assets/products/' + selected().id + '.png' }); };
  $('#fileProduct').onchange = function (e) { importProduct(e.target.files[0]); e.target.value = ''; };
  $('#btnBrowse').onclick = function () { $('#fileProduct').click(); };
  $('#dropProduct').ondragover = function (e) { e.preventDefault(); };
  $('#dropProduct').ondrop = function (e) {
    e.preventDefault();
    importProduct(e.dataTransfer.files[0]);
  };
  $('#fileOriginal').onchange = async function (e) {
    const file = e.target.files[0];
    if (!file) return;
    const dataUrl = await readAsDataUrl(file);
    const result = await uploadImage(selected().id, dataUrl, 'original');
    if (result.ok) {
      state.assetRevision = Date.now();
      patch({ originalImage: result.path });
    } else refreshSaveState(result.error, 'err');
    e.target.value = '';
  };
  $('#btnOriginal').onclick = function () { $('#fileOriginal').click(); };
  $('#compare').ondragover = function (e) { e.preventDefault(); };
  $('#compare').ondrop = async function (e) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file) return;
    const dataUrl = await readAsDataUrl(file);
    const result = await uploadImage(selected().id, dataUrl, 'original');
    if (result.ok) {
      state.assetRevision = Date.now();
      patch({ originalImage: result.path });
    }
  };
  window.addEventListener('resize', scaleStage);
  window.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      $('#saveBtn').click();
    }
  });
  window.addEventListener('beforeunload', function (e) {
    if (isDirty() || state.saving || state.processingId) {
      e.preventDefault();
      e.returnValue = '';
    }
  });
}

async function boot() {
  bind();
  try {
    const loaded = await fetchStories();
    state.stories = loaded.map(function (s, i) { return normalizeStory(s, i); });
  } catch (err) {
    refreshSaveState('No se pudo leer products.json', 'err');
    state.stories = [normalizeStory({ id: 'pieza-1' })];
  }
  state.baseline = JSON.stringify(state.stories);
  const params = new URLSearchParams(window.location.search);
  const select = params.get('select');
  const created = (params.get('created') || '').split(',').filter(Boolean);
  if (select && state.stories.some(function (s) { return s.id === select; })) state.selectedId = select;
  else state.selectedId = state.stories[0] ? state.stories[0].id : '';
  created.forEach(function (id) { state.checked[id] = true; });
  $('#saveBtn').disabled = true;
  renderList();
  fillForm();
  await preview();
  if (created.length) refreshSaveState(created.length + ' pieza(s) llegaron desde extract');
}

boot();
