import { CANVAS, DEFAULT_STORY, GRADIENT, LIMITS, SAFE, normalizeStory, renderStory, ensureFonts } from './template.js';
import { fetchStories, saveStories, uploadImage, readAsDataUrl, downloadDataUrl, aiStatus, completeStoryCopy, fetchTrash, trashAction } from './api.js';
import { importProductCutout } from './cutout.js';

const state = {
  stories: [],
  trash: [],
  view: 'active',
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
  aiConfigured: false,
};

const $ = function (sel) { return document.querySelector(sel); };

const BRAND_BACKGROUNDS = [
  { id: 'pocion', name: 'Poción', path: 'assets/backgrounds/brand-pocion.jpg' },
  { id: 'click-hair', name: 'Click Hair', path: 'assets/backgrounds/brand-click-hair.jpg' },
  { id: 'herbacol', name: 'HERBACOL', path: 'assets/backgrounds/brand-herbacol.jpg' },
  { id: 'bell-franz', name: 'Bell Franz', path: 'assets/backgrounds/brand-bell-franz.jpg' },
  { id: 'anyeluz', name: 'anyeluz', path: 'assets/backgrounds/brand-anyeluz.jpg' },
  { id: 'origen-botanico', name: 'Origen Botánico', path: 'assets/backgrounds/brand-origen-botanico.jpg' },
];

function refreshBrandActive() {
  const current = selected() ? selected().background : '';
  document.querySelectorAll('#brandBgGrid .brand-btn').forEach(function (btn) {
    btn.classList.toggle('active', btn.getAttribute('data-bg') === current);
  });
}

function renderBrandButtons() {
  const host = $('#brandBgGrid');
  if (!host) return;
  host.innerHTML = BRAND_BACKGROUNDS.map(function (brand) {
    return '<button type="button" class="brand-btn" data-brand="' + brand.id + '" data-bg="' + brand.path + '" style="background-image:url(\'' + brand.path + '\')"><span>' + brand.name + '</span></button>';
  }).join('');
  refreshBrandActive();
}

function selected() {
  const list = visibleStories();
  return list.find(function (s) { return s.id === state.selectedId; }) || list[0];
}

function visibleStories() {
  return state.view === 'trash' ? state.trash : state.stories;
}

function checkedIds() {
  return Object.keys(state.checked).filter(function (id) { return state.checked[id]; });
}

function applyServerLists(result) {
  if (result.stories) {
    state.stories = result.stories.map(function (s, i) { return normalizeStory(s, i); });
    state.baseline = JSON.stringify(state.stories);
  }
  if (result.trash) {
    state.trash = result.trash.map(function (s, i) { return normalizeStory(s, i); });
  }
  Object.keys(state.checked).forEach(function (id) {
    const exists = visibleStories().some(function (s) { return s.id === id; });
    if (!exists) delete state.checked[id];
  });
  const list = visibleStories();
  if (!list.some(function (s) { return s.id === state.selectedId; })) {
    state.selectedId = list[0] ? list[0].id : '';
  }
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
  if (!story) {
    $('#previewHost').innerHTML = '';
    $('#warnings').innerHTML = '<p class="warn-ok">Selecciona una pieza.</p>';
    return;
  }
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
  const list = visibleStories();
  const allChecked = list.length > 0 && list.every(function (s) { return state.checked[s.id]; });
  $('#checkAll').checked = allChecked;
  $('#listTitle').textContent = state.view === 'trash' ? 'Borrados' : 'Piezas';
  $('#tabActive').classList.toggle('active', state.view === 'active');
  $('#tabTrash').classList.toggle('active', state.view === 'trash');
  $('#trashCount').textContent = String(state.trash.length);
  $('#btnNew').classList.toggle('hidden', state.view === 'trash');

  const n = checkedIds().filter(function (id) {
    return list.some(function (s) { return s.id === id; });
  }).length;
  const trashBtn = $('#btnTrashChecked');
  const restoreBtn = $('#btnRestoreChecked');
  const purgeBtn = $('#btnPurgeChecked');
  trashBtn.classList.toggle('hidden', state.view !== 'active');
  restoreBtn.classList.toggle('hidden', state.view !== 'trash');
  purgeBtn.classList.toggle('hidden', state.view !== 'trash');
  trashBtn.disabled = state.view !== 'active' || n === 0;
  restoreBtn.disabled = state.view !== 'trash' || n === 0;
  purgeBtn.disabled = state.view !== 'trash' || n === 0;
  trashBtn.textContent = 'A borrados (' + n + ')';
  restoreBtn.textContent = 'Restaurar (' + n + ')';
  purgeBtn.textContent = 'Eliminar (' + n + ')';

  if (!list.length) {
    ul.innerHTML = '<li class="help" style="padding:12px">' +
      (state.view === 'trash' ? 'No hay piezas en borrados.' : 'No hay piezas. Crea una nueva.') +
      '</li>';
  } else {
    ul.innerHTML = list.map(function (story) {
      const active = story.id === state.selectedId;
      const badge = state.view === 'trash'
        ? { cls: 'warn', text: 'borrada' }
        : storyBadge(story);
      const actions = state.view === 'trash'
        ? '<button type="button" data-restore="' + story.id + '">restaurar</button>' +
          '<button type="button" class="del" data-purge="' + story.id + '">eliminar</button>'
        : '<button type="button" data-dup="' + story.id + '">duplicar</button>' +
          '<button type="button" class="del" data-del="' + story.id + '">borrar</button>';
      return '<li><div class="item' + (active ? ' active' : '') + (state.view === 'active' && storyIsDirty(story) ? ' is-dirty' : '') + '" data-id="' + story.id + '">' +
        '<div class="item-top"><div style="display:flex;gap:8px;min-width:0">' +
        '<input type="checkbox" data-check="' + story.id + '"' + (state.checked[story.id] ? ' checked' : '') + '>' +
        '<div style="min-width:0"><p class="item-title">' + (story.titulo || '(sin titulo)') + '</p>' +
        '<p class="item-id">' + story.id + '</p></div></div>' +
        '<span class="badge ' + badge.cls + '">' + badge.text + '</span></div>' +
        '<div class="item-meta"><span>' + (story.textLayout === 'stacked' ? 'apilado' : '2 columnas') + '</span>' +
        '<span>' + (story.background === GRADIENT ? 'fondo CSS' : 'foto') + '</span>' +
        actions + '</div></div></li>';
    }).join('');
  }

  const checkedActive = checkedIds().filter(function (id) {
    return state.stories.some(function (s) { return s.id === id; });
  }).length;
  $('#downloadBtn').textContent = 'Descargar (' + checkedActive + ')';
  $('#downloadBtn').disabled = checkedActive === 0 || state.exporting || state.view === 'trash';
  updateAiButtons();
  setFormEditable(state.view === 'active');
}

function setFormEditable(enabled) {
  document.querySelectorAll('.aside-right input, .aside-right textarea, .aside-right select, .aside-right button').forEach(function (el) {
    if (el.id === 'btnAi' || el.id === 'btnAiChecked') return;
    el.disabled = !enabled;
  });
  if ($('#btnAi')) $('#btnAi').disabled = !enabled || !!state.processingId;
  if ($('#btnAiChecked')) {
    const n = checkedIds().filter(function (id) { return state.stories.some(function (s) { return s.id === id; }); }).length;
    $('#btnAiChecked').disabled = !enabled || !!state.processingId || n === 0;
  }
}

async function moveToTrash(ids) {
  if (!ids.length) return;
  const result = await trashAction('trash', ids, state.stories);
  applyServerLists(result);
  state.view = 'active';
  renderList();
  fillForm();
  await preview();
  refreshSaveState(ids.length + (ids.length === 1 ? ' pieza enviada a borrados' : ' piezas enviadas a borrados'));
}

async function restoreFromTrash(ids) {
  if (!ids.length) return;
  const result = await trashAction('restore', ids);
  applyServerLists(result);
  state.view = 'active';
  if (result.restored && result.restored[0]) state.selectedId = result.restored[0];
  renderList();
  fillForm();
  await preview();
  refreshSaveState(ids.length + (ids.length === 1 ? ' pieza restaurada' : ' piezas restauradas'));
}

async function purgeFromTrash(ids) {
  if (!ids.length) return;
  const result = await trashAction('purge', ids);
  applyServerLists(result);
  renderList();
  fillForm();
  await preview();
  refreshSaveState(ids.length + (ids.length === 1 ? ' pieza eliminada para siempre' : ' piezas eliminadas para siempre'));
}

function fillForm() {
  const s = selected();
  if (!s) {
    ['f-id','f-titulo','f-textoA','f-textoB','f-notes','f-product','f-bg','f-original','f-accent-txt'].forEach(function (id) {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    return;
  }
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
  refreshBrandActive();
}

function patch(partial) {
  if (state.view === 'trash') return;
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
    if (partial.textoA !== undefined) $('#f-textoA').value = s.textoA;
    if (partial.textoB !== undefined) $('#f-textoB').value = s.textoB;
    if (partial.titulo !== undefined) $('#f-titulo').value = s.titulo;
  }
  preview();
}

function updateAiButtons() {
  const busy = !!state.processingId;
  const n = Object.keys(state.checked).filter(function (id) { return state.checked[id]; }).length;
  const btn = $('#btnAi');
  const batch = $('#btnAiChecked');
  if (!btn || !batch) return;
  btn.disabled = busy;
  btn.textContent = busy && state.processingId === state.selectedId ? 'Leyendo foto…' : 'Completar con IA';
  batch.disabled = busy || n === 0;
  batch.textContent = n ? 'IA en marcadas (' + n + ')' : 'IA en marcadas';
}

function applyToStory(id, partial) {
  state.stories = state.stories.map(function (story) {
    if (story.id !== id) return story;
    return normalizeStory(Object.assign({}, story, partial));
  });
  refreshSaveState();
  renderList();
  const s = selected();
  if (s && s.id === id) {
    if (partial.textoA !== undefined) $('#f-textoA').value = s.textoA;
    if (partial.textoB !== undefined) $('#f-textoB').value = s.textoB;
    preview();
  }
}

async function completeWithAi(stories) {
  const list = (stories || []).filter(Boolean);
  if (!list.length || state.processingId) return;
  if (!state.aiConfigured) {
    refreshSaveState('Falta la clave de ChatGPT. Copia api/config.sample.php a api/config.local.php y pon openai_api_key.', 'warn');
    return;
  }
  for (let i = 0; i < list.length; i += 1) {
    const story = state.stories.find(function (s) { return s.id === list[i].id; }) || list[i];
    state.processingId = story.id;
    renderList();
    refreshSaveState('IA ' + (i + 1) + '/' + list.length + ' · leyendo envase de ' + story.id + '…');
    try {
      const result = await completeStoryCopy(story);
      applyToStory(story.id, { textoA: result.textoA, textoB: result.textoB });
      refreshSaveState('IA ' + (i + 1) + '/' + list.length + ' · ' + story.id + ' listo. Revisa y guarda.');
    } catch (err) {
      refreshSaveState(err.message || 'Error de IA', 'err');
      break;
    }
  }
  state.processingId = '';
  renderList();
  if (!$('#saveNote').classList.contains('err')) refreshSaveState();
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
    if (state.view === 'trash' || state.saving || !isDirty()) return;
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
    if (state.view === 'trash') return;
    let n = state.stories.length + 1;
    while (state.stories.some(function (s) { return s.id === 'pieza-' + n; })) n += 1;
    const created = normalizeStory(Object.assign({}, DEFAULT_STORY, { id: 'pieza-' + n }));
    state.stories.push(created);
    state.selectedId = created.id;
    renderList(); fillForm(); preview();
    refreshSaveState();
  };
  $('#tabActive').onclick = function () {
    state.view = 'active';
    state.checked = {};
    state.selectedId = state.stories[0] ? state.stories[0].id : '';
    renderList(); fillForm(); preview();
  };
  $('#tabTrash').onclick = function () {
    state.view = 'trash';
    state.checked = {};
    state.selectedId = state.trash[0] ? state.trash[0].id : '';
    renderList(); fillForm(); preview();
  };
  $('#btnTrashChecked').onclick = async function () {
    const ids = checkedIds().filter(function (id) { return state.stories.some(function (s) { return s.id === id; }); });
    if (!ids.length) return;
    if (!confirm('Mover ' + ids.length + ' pieza(s) a borrados?')) return;
    try { await moveToTrash(ids); }
    catch (err) { refreshSaveState(err.message || 'No se pudo enviar a borrados', 'err'); }
  };
  $('#btnRestoreChecked').onclick = async function () {
    const ids = checkedIds().filter(function (id) { return state.trash.some(function (s) { return s.id === id; }); });
    if (!ids.length) return;
    try { await restoreFromTrash(ids); }
    catch (err) { refreshSaveState(err.message || 'No se pudo restaurar', 'err'); }
  };
  $('#btnPurgeChecked').onclick = async function () {
    const ids = checkedIds().filter(function (id) { return state.trash.some(function (s) { return s.id === id; }); });
    if (!ids.length) return;
    if (!confirm('Eliminar para siempre ' + ids.length + ' pieza(s)? Esto no se puede deshacer.')) return;
    try { await purgeFromTrash(ids); }
    catch (err) { refreshSaveState(err.message || 'No se pudo eliminar', 'err'); }
  };
  $('#storyList').onclick = function (e) {
    const check = e.target.getAttribute && e.target.getAttribute('data-check');
    if (e.target.type === 'checkbox' && check) {
      state.checked[check] = e.target.checked;
      renderList();
      return;
    }
    if (e.target.getAttribute('data-dup')) {
      if (state.view === 'trash') return;
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
      if (!confirm('Mover «' + id + '» a borrados?')) return;
      moveToTrash([id]).catch(function (err) {
        refreshSaveState(err.message || 'No se pudo enviar a borrados', 'err');
      });
      return;
    }
    if (e.target.getAttribute('data-restore')) {
      const id = e.target.getAttribute('data-restore');
      restoreFromTrash([id]).catch(function (err) {
        refreshSaveState(err.message || 'No se pudo restaurar', 'err');
      });
      return;
    }
    if (e.target.getAttribute('data-purge')) {
      const id = e.target.getAttribute('data-purge');
      if (!confirm('Eliminar «' + id + '» para siempre?')) return;
      purgeFromTrash([id]).catch(function (err) {
        refreshSaveState(err.message || 'No se pudo eliminar', 'err');
      });
      return;
    }
    const item = e.target.closest('.item');
    if (item) {
      state.selectedId = item.getAttribute('data-id');
      renderList(); fillForm(); preview();
    }
  };
  $('#checkAll').onchange = function (e) {
    visibleStories().forEach(function (s) { state.checked[s.id] = e.target.checked; });
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
  renderBrandButtons();
  $('#brandBgGrid').onclick = function (e) {
    const btn = e.target.closest('[data-bg]');
    if (!btn) return;
    patch({ background: btn.getAttribute('data-bg') });
    refreshBrandActive();
  };
  $('#btnGradient').onclick = function () { patch({ background: GRADIENT }); refreshBrandActive(); };
  $('#btnLeaves').onclick = function () { patch({ background: 'assets/backgrounds/leaves-green-vertical.jpg' }); refreshBrandActive(); };
  $('#btnUsePng').onclick = function () { patch({ productImage: 'assets/products/' + selected().id + '.png' }); };
  $('#btnAi').onclick = function () { completeWithAi([selected()]); };
  $('#btnAiChecked').onclick = function () {
    completeWithAi(state.stories.filter(function (s) { return state.checked[s.id]; }));
  };
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
  try {
    const trash = await fetchTrash();
    state.trash = trash.map(function (s, i) { return normalizeStory(s, i); });
  } catch (err) {
    state.trash = [];
  }
  state.baseline = JSON.stringify(state.stories);
  const params = new URLSearchParams(window.location.search);
  const select = params.get('select');
  const created = (params.get('created') || '').split(',').filter(Boolean);
  if (select && state.stories.some(function (s) { return s.id === select; })) state.selectedId = select;
  else state.selectedId = state.stories[0] ? state.stories[0].id : '';
  created.forEach(function (id) { state.checked[id] = true; });
  try {
    const status = await aiStatus();
    state.aiConfigured = !!(status && status.configured);
    if ($('#aiHelp')) {
      $('#aiHelp').textContent = state.aiConfigured
        ? 'ChatGPT listo. Lee la foto original y el envase: Texto A = para que sirve, Texto B = tamanos.'
        : 'Falta la clave de ChatGPT. Copia api/config.sample.php a api/config.local.php y pon openai_api_key.';
    }
  } catch (err) {
    state.aiConfigured = false;
  }
  $('#saveBtn').disabled = true;
  renderList();
  fillForm();
  await preview();
  if (created.length) refreshSaveState(created.length + ' pieza(s) llegaron desde extract');
}

boot();
