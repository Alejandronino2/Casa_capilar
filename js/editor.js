import { CANVAS, DEFAULT_STORY, GRADIENT, LIMITS, SAFE, normalizeStory, renderStory, ensureFonts } from './template.js';
import { fetchStories, saveStories, uploadImage, readAsDataUrl, downloadDataUrl, aiStatus, completeStoryCopy, fetchTrash, trashAction, fetchFolders, createFolder, deleteFolder } from './api.js';
import { importProductCutout } from './cutout.js';

const state = {
  stories: [],
  trash: [],
  folders: [],
  collapsed: {},
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
  aiWaiting: false,
  aiConfigured: false,
  pendingWarnFixes: {},
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
  const bust = Date.now();
  host.innerHTML = BRAND_BACKGROUNDS.map(function (brand) {
    return '<button type="button" class="brand-btn" data-brand="' + brand.id + '" data-bg="' + brand.path + '" style="background-image:url(\'' + brand.path + '?v=' + bust + '\')"><span>' + brand.name + '</span></button>';
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
  el.className = 'note' +
    (kind === 'err' ? ' err' : kind === 'warn' ? ' warn' : kind === 'wait' ? ' wait' : '');
}

function refreshSaveState(note, kind) {
  const dirty = isDirty();
  const count = dirtyCount();
  const btn = $('#saveBtn');
  const undo = $('#undoBtn');
  if (state.saving) {
    btn.disabled = true;
    btn.textContent = 'Guardando…';
  } else {
    btn.disabled = !dirty || !!state.processingId;
    btn.textContent = dirty ? 'Guardar' : 'Guardado';
  }
  if (undo) {
    undo.disabled = !dirty || !!state.saving || !!state.processingId || state.view === 'trash';
  }
  if (note !== undefined) {
    setNote(note, kind);
    return;
  }
  if (state.processingId) return;
  if (dirty) setNote(count + (count === 1 ? ' cambio sin guardar' : ' cambios sin guardar'), 'warn');
  else if (!state.exporting) setNote('');
}

function undoUnsaved() {
  if (!isDirty() || state.saving || state.processingId || state.view === 'trash') return;
  const count = dirtyCount();
  const msg = count === 1
    ? 'Deshacer el cambio sin guardar y volver al ultimo guardado?'
    : 'Deshacer ' + count + ' cambios sin guardar y volver al ultimo guardado?';
  if (!confirm(msg)) return;
  const selectedId = state.selectedId;
  state.stories = baselineStories().map(function (s, i) { return normalizeStory(s, i); });
  if (!state.stories.some(function (s) { return s.id === selectedId; })) {
    state.selectedId = state.stories[0] ? state.stories[0].id : '';
  }
  renderList();
  fillForm();
  preview();
  refreshBrandActive();
  refreshSaveState('Cambios deshechos. Quedo como el ultimo guardado.');
}

function storyBadge(story) {
  if (state.saving && storyIsDirty(story)) return { cls: 'busy', text: 'guardando' };
  if (state.processingId === story.id && state.aiWaiting) return { cls: 'busy', text: 'esperando…' };
  if (state.processingId === story.id) return { cls: 'busy', text: 'procesando' };
  if (storyIsDirty(story)) return { cls: 'warn', text: 'sin guardar' };
  return { cls: 'ok', text: 'guardada' };
}

function sleep(ms) {
  return new Promise(function (resolve) { setTimeout(resolve, ms); });
}

async function waitRateLimitCountdown(seconds) {
  const total = Math.max(3, Math.ceil(Number(seconds) || 20));
  state.aiWaiting = true;
  renderList();
  updateAiButtons();
  for (let left = total; left > 0; left -= 1) {
    setNote('Limite Groq · reintento automatico en ' + left + 's', 'wait');
    await sleep(1000);
  }
  state.aiWaiting = false;
  setNote('Reintentando IA…', 'warn');
  renderList();
  updateAiButtons();
}

async function completeStoryCopyWithRetry(story, options) {
  let attempt = 0;
  while (attempt < 5) {
    try {
      return await completeStoryCopy(story, options);
    } catch (err) {
      if (err && err.rateLimited && attempt < 4) {
        attempt += 1;
        await waitRateLimitCountdown(err.retryAfter || 20);
        continue;
      }
      throw err;
    }
  }
  throw new Error('Demasiados reintentos por limite de Groq');
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
    showSafeZones: state.showGuides,
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
  const fixes = {};
  const fixNotes = [];

  if (metrics.productMissing) {
    issues.push({ t: 'e', text: story.productImage ? 'No se pudo cargar ' + story.productImage : 'Falta el PNG del producto.' });
  }
  if (metrics.backgroundMissing) issues.push({ t: 'w', text: 'No se pudo cargar el fondo. Se usa el fondo CSS.' });
  const overflows = [];
  if (metrics.title.overflow) overflows.push('titulo');
  if (metrics.blockA.overflow) overflows.push('beneficios');
  if (metrics.description && metrics.description.overflow) overflows.push('descripcion');
  if (metrics.blockB.overflow) overflows.push('tamaño');
  if (overflows.length) issues.push({ t: 'e', text: 'Desborda: ' + overflows.join(', ') + '.' });

  if (state.autoFit && metrics.title.size && metrics.title.size < story.titleSize) {
    issues.push({ t: 'i', text: 'Auto-ajuste: titulo ' + story.titleSize + 'px → ' + metrics.title.size + 'px.' });
    fixes.titleSize = metrics.title.size;
    fixNotes.push('titulo');
  }
  const bodyCandidates = [];
  if (metrics.description && metrics.description.size) bodyCandidates.push(metrics.description.size);
  if (metrics.blockB && metrics.blockB.size) bodyCandidates.push(metrics.blockB.size);
  if (metrics.benefitsCount > 0 && metrics.blockA && metrics.blockA.size) bodyCandidates.push(metrics.blockA.size);
  const body = bodyCandidates.length ? Math.min.apply(null, bodyCandidates) : story.bodySize;
  if (state.autoFit && body < story.bodySize) {
    issues.push({ t: 'i', text: 'Auto-ajuste: cuerpo ' + story.bodySize + 'px → ' + body + 'px.' });
    fixes.bodySize = body;
    fixNotes.push('cuerpo');
  }
  if (!state.autoFit && overflows.length) {
    if (metrics.title.overflow) {
      fixes.titleSize = Math.max(LIMITS.titleSize.min, story.titleSize - 8);
      fixNotes.push('titulo');
    }
    if (metrics.blockA.overflow || metrics.blockB.overflow || (metrics.description && metrics.description.overflow)) {
      fixes.bodySize = Math.max(LIMITS.bodySize.min, story.bodySize - 4);
      fixNotes.push('cuerpo');
    }
  }

  // Solo avisar upscale extremo: el hero premium puede ampliar PNG de baja resolucion a proposito
  if (metrics.productUpscale > 1.65 && metrics.productNatural) {
    const pct = Math.round(metrics.productUpscale * 100);
    issues.push({ t: 'w', text: 'El PNG se amplia mucho (' + pct + '%). Ideal: exportar cutout mas grande.' });
    const nextScale = Math.max(
      LIMITS.productScale.min,
      Math.round((story.productScale / (metrics.productUpscale / 1.35)) * 100) / 100
    );
    if (nextScale < story.productScale - 0.001) {
      fixes.productScale = nextScale;
      fixNotes.push('escala ' + nextScale.toFixed(2) + '×');
    }
  }
  if (metrics.productInvadesTopSafeZone) {
    issues.push({ t: 'w', text: 'El producto entra en los ' + SAFE.top + 'px superiores.' });
    const delta = Math.ceil(SAFE.areaTop - metrics.productTop + 8);
    const nextOff = Math.min(LIMITS.productOffsetY.max, (Number(story.productOffsetY) || 0) + Math.max(delta, 8));
    if (nextOff > (Number(story.productOffsetY) || 0)) {
      fixes.productOffsetY = nextOff;
      fixNotes.push('bajar producto');
    }
  }
  if (metrics.productInvadesBottomSafeZone) {
    issues.push({ t: 'w', text: 'Hay elementos en los ' + SAFE.bottom + 'px inferiores.' });
    const nextOff = Math.max(LIMITS.productOffsetY.min, (Number(story.productOffsetY) || 0) - 12);
    if (nextOff < (Number(story.productOffsetY) || 0)) {
      fixes.productOffsetY = nextOff;
      fixNotes.push('subir producto');
    }
  }

  state.pendingWarnFixes = fixes;

  if (!issues.length) {
    box.innerHTML = '<p class="warn-ok">Sin avisos: el texto cabe y nada invade las zonas seguras.</p>';
    return;
  }

  const canFix = Object.keys(fixes).length > 0 && state.view === 'active';
  box.innerHTML =
    '<div class="warn-head">' +
    '<span>Avisos</span>' +
    (canFix
      ? '<button type="button" class="btn btn-primary btn-warn-fix" id="btnFixWarnings">Aplicar ajustes' +
        (fixNotes.length ? ' (' + fixNotes.join(', ') + ')' : '') +
        '</button>'
      : '') +
    '</div>' +
    '<ul>' + issues.map(function (i) {
      return '<li class="' + i.t + '">' + i.text + '</li>';
    }).join('') + '</ul>';
}

async function applyWarningFixes() {
  if (state.view === 'trash' || state.processingId) return;
  const story = selected();
  if (!story || !state.metrics) return;

  let fixes = state.pendingWarnFixes || {};
  if (!Object.keys(fixes).length) {
    renderWarnings(story, state.metrics);
    fixes = state.pendingWarnFixes || {};
  }
  if (!Object.keys(fixes).length) {
    refreshSaveState('No hay ajustes automaticos para estos avisos', 'warn');
    return;
  }

  patch(fixes);
  refreshSaveState('Ajustes aplicados. Revisa el preview y guarda.', 'warn');
  await preview();

  // Segunda pasada: si tras bajar la escala sigue invadiendo zona segura
  const again = state.pendingWarnFixes || {};
  if (again.productOffsetY != null && again.productOffsetY !== fixes.productOffsetY) {
    patch({ productOffsetY: again.productOffsetY });
    await preview();
  }
}

function folderName(id) {
  const found = state.folders.find(function (f) { return f.id === id; });
  return found ? found.name : (id || 'Sin carpeta');
}

function folderOptionsHtml(selected) {
  return state.folders.map(function (f) {
    return '<option value="' + f.id + '"' + (f.id === selected ? ' selected' : '') + '>' + f.name + '</option>';
  }).join('');
}

function renderFolderSelect() {
  const el = $('#f-folder');
  if (!el) return;
  const current = selected() ? selected().folder : 'sin-carpeta';
  el.innerHTML = folderOptionsHtml(current || 'sin-carpeta');
}

function needsPresentation(story) {
  const t = String((story && story.textoB) || '');
  return /consultar\s+presentaci[oó]n/i.test(t);
}

function storyItemHtml(story) {
  const active = story.id === state.selectedId;
  const badge = state.view === 'trash'
    ? { cls: 'warn', text: 'borrada' }
    : storyBadge(story);
  const consultar = state.view === 'active' && needsPresentation(story);
  const actions = state.view === 'trash'
    ? '<button type="button" data-restore="' + story.id + '">restaurar</button>' +
      '<button type="button" class="del" data-purge="' + story.id + '">eliminar</button>'
    : '<button type="button" data-dup="' + story.id + '">duplicar</button>' +
      '<button type="button" class="del" data-del="' + story.id + '">borrar</button>';
  return '<li><div class="item' +
    (active ? ' active' : '') +
    (state.view === 'active' && storyIsDirty(story) ? ' is-dirty' : '') +
    (consultar ? ' is-consultar' : '') +
    '" data-id="' + story.id + '">' +
    '<div class="item-top"><div style="display:flex;gap:8px;min-width:0">' +
    '<input type="checkbox" data-check="' + story.id + '"' + (state.checked[story.id] ? ' checked' : '') + '>' +
    '<div style="min-width:0"><p class="item-title">' + (story.titulo || '(sin titulo)') + '</p>' +
    '<p class="item-id">' + story.id + '</p></div></div>' +
    '<span class="badge ' + badge.cls + '">' + badge.text + '</span></div>' +
    '<div class="item-meta"><span>' + (story.textLayout === 'stacked' ? 'apilado' : '2 columnas') + '</span>' +
    '<span>' + (story.background === GRADIENT ? 'fondo CSS' : 'foto') + '</span>' +
    (consultar ? '<span class="meta-consultar">Consultar presentación</span>' : '') +
    actions + '</div></div></li>';
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
  if ($('#btnNewFolder')) $('#btnNewFolder').classList.toggle('hidden', state.view === 'trash');

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
  } else if (state.view === 'trash') {
    ul.innerHTML = list.map(storyItemHtml).join('');
  } else {
    const byFolder = {};
    list.forEach(function (story) {
      const key = story.folder || 'sin-carpeta';
      if (!byFolder[key]) byFolder[key] = [];
      byFolder[key].push(story);
    });
    const order = state.folders.slice();
    Object.keys(byFolder).forEach(function (id) {
      if (!order.some(function (f) { return f.id === id; })) {
        order.push({ id: id, name: id, locked: false });
      }
    });
    ul.innerHTML = order.map(function (folder) {
      const items = byFolder[folder.id] || [];
      if (!items.length && folder.id === 'sin-carpeta') return '';
      if (!items.length && !folder.locked) return '';
      const collapsed = !!state.collapsed[folder.id];
      const delBtn = folder.locked || items.length
        ? ''
        : '<button type="button" class="del" data-del-folder="' + folder.id + '">x</button>';
      return '<li class="folder-block" data-folder="' + folder.id + '">' +
        '<div class="folder-row">' +
        '<button type="button" class="folder-toggle" data-toggle-folder="' + folder.id + '" title="Abrir/cerrar">' +
        (collapsed ? '▸' : '▾') + '</button>' +
        '<button type="button" class="folder-head" data-folder-bg="' + folder.id + '" title="Clic: aplicar fondo de marca a toda la carpeta">' +
        '<span>' + folder.name + '</span>' +
        '<span class="meta">' + items.length + '</span></button>' +
        delBtn +
        '</div>' +
        '<ul class="folder-items' + (collapsed ? ' collapsed' : '') + '">' +
        items.map(storyItemHtml).join('') +
        '</ul></li>';
    }).join('');
  }

  const checkedActive = checkedIds().filter(function (id) {
    return state.stories.some(function (s) { return s.id === id; });
  }).length;
  $('#downloadBtn').textContent = 'Descargar (' + checkedActive + ')';
  $('#downloadBtn').disabled = checkedActive === 0 || state.exporting || state.view === 'trash';
  updateAiButtons();
  setFormEditable(state.view === 'active');
  renderFolderSelect();
  const bulk = $('#bulkFolder');
  if (bulk) {
    const prev = bulk.value;
    bulk.classList.toggle('hidden', state.view !== 'active');
    bulk.innerHTML = '<option value="">Mover a…</option>' + state.folders.map(function (f) {
      return '<option value="' + f.id + '">' + f.name + '</option>';
    }).join('');
    bulk.value = '';
    if (prev) bulk.value = '';
    bulk.disabled = n === 0 || state.view !== 'active';
  }
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
    ['f-id','f-titulo','f-hook','f-textoA','f-textoB','f-cta','f-notes','f-product','f-bg','f-original','f-accent-txt'].forEach(function (id) {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    return;
  }
  $('#f-id').value = s.id;
  renderFolderSelect();
  if ($('#f-folder')) $('#f-folder').value = s.folder || 'sin-carpeta';
  $('#f-titulo').value = s.titulo;
  if ($('#f-hook')) $('#f-hook').value = s.hook || '';
  $('#f-textoA').value = s.textoA;
  $('#f-textoB').value = s.textoB;
  if ($('#f-cta')) $('#f-cta').value = s.cta != null ? s.cta : 'COMPRAR →';
  $('#f-notes').value = s.notes || '';
  $('#f-product').value = s.productImage;
  $('#f-bg').value = s.background;
  $('#f-original').value = s.originalImage || '';
  $('#f-layout').value = s.textLayout;
  $('#f-scale').value = s.productScale;
  $('#f-scale-val').textContent = Number(s.productScale).toFixed(2) + '×';
  if ($('#f-offx')) {
    $('#f-offx').value = s.productOffsetX || 0;
    $('#f-offx-val').textContent = (s.productOffsetX || 0) + 'px';
  }
  $('#f-off').value = s.productOffsetY;
  $('#f-off-val').textContent = s.productOffsetY + 'px';
  if ($('#f-shelf-off')) {
    $('#f-shelf-off').value = s.shelfOffsetY || 0;
    $('#f-shelf-off-val').textContent = (s.shelfOffsetY || 0) + 'px';
  }
  if ($('#f-shelf-scale')) {
    $('#f-shelf-scale').value = s.shelfScale || 1;
    $('#f-shelf-scale-val').textContent = Number(s.shelfScale || 1).toFixed(2) + '×';
  }
  if ($('#f-text-offy')) {
    $('#f-text-offy').value = s.textOffsetY || 0;
    $('#f-text-offy-val').textContent = (s.textOffsetY || 0) + 'px';
  }
  if ($('#f-text-offx')) {
    $('#f-text-offx').value = s.textOffsetX || 0;
    $('#f-text-offx-val').textContent = (s.textOffsetX || 0) + 'px';
  }
  $('#f-title').value = s.titleSize;
  $('#f-title-val').textContent = s.titleSize + 'px';
  $('#f-body').value = s.bodySize;
  $('#f-body-val').textContent = s.bodySize + 'px';
  $('#f-accent').value = /^#[0-9a-f]{6}$/i.test(s.accentColor) ? s.accentColor : '#F27F83';
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
    if ($('#f-offx-val')) $('#f-offx-val').textContent = (s.productOffsetX || 0) + 'px';
    $('#f-off-val').textContent = s.productOffsetY + 'px';
    if ($('#f-shelf-off-val')) $('#f-shelf-off-val').textContent = (s.shelfOffsetY || 0) + 'px';
    if ($('#f-shelf-scale-val')) $('#f-shelf-scale-val').textContent = Number(s.shelfScale || 1).toFixed(2) + '×';
    if ($('#f-text-offy-val')) $('#f-text-offy-val').textContent = (s.textOffsetY || 0) + 'px';
    if ($('#f-text-offx-val')) $('#f-text-offx-val').textContent = (s.textOffsetX || 0) + 'px';
    $('#f-title-val').textContent = s.titleSize + 'px';
    $('#f-body-val').textContent = s.bodySize + 'px';
    if (partial.productImage) $('#f-product').value = s.productImage;
    if (partial.background) $('#f-bg').value = s.background;
    if (partial.originalImage) $('#f-original').value = s.originalImage || '';
    if (partial.accentColor) {
      $('#f-accent').value = /^#[0-9a-f]{6}$/i.test(s.accentColor) ? s.accentColor : '#F27F83';
      $('#f-accent-txt').value = s.accentColor;
    }
    if (partial.textoA !== undefined) $('#f-textoA').value = s.textoA;
    if (partial.textoB !== undefined) $('#f-textoB').value = s.textoB;
    if (partial.titulo !== undefined) $('#f-titulo').value = s.titulo;
    if (partial.hook !== undefined && $('#f-hook')) $('#f-hook').value = s.hook || '';
    if (partial.cta !== undefined && $('#f-cta')) $('#f-cta').value = s.cta != null ? s.cta : '';
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
  if (busy && state.aiWaiting) btn.textContent = 'Esperando limite…';
  else if (busy && state.processingId === state.selectedId) btn.textContent = 'Leyendo foto…';
  else btn.textContent = 'Completar con IA';
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
    if (partial.titulo !== undefined) $('#f-titulo').value = s.titulo;
    if (partial.textoA !== undefined) $('#f-textoA').value = s.textoA;
    if (partial.textoB !== undefined) $('#f-textoB').value = s.textoB;
    if (partial.background !== undefined) {
      $('#f-bg').value = s.background;
      refreshBrandActive();
    }
    if (partial.folder !== undefined) {
      renderFolderSelect();
      if ($('#f-folder')) $('#f-folder').value = s.folder || 'sin-carpeta';
    }
    preview();
  }
}

function brandById(id) {
  return BRAND_BACKGROUNDS.find(function (b) { return b.id === id; }) || null;
}

function applyBackgroundToIds(ids, bg, folderId) {
  const set = {};
  (ids || []).forEach(function (id) { set[id] = true; });
  let n = 0;
  state.stories = state.stories.map(function (story) {
    if (!set[story.id]) return story;
    n += 1;
    const next = { background: bg };
    if (folderId) next.folder = folderId;
    return normalizeStory(Object.assign({}, story, next));
  });
  if (folderId) state.collapsed[folderId] = false;
  state.assetRevision = Date.now();
  refreshSaveState();
  renderList();
  fillForm();
  preview();
  refreshBrandActive();
  return n;
}

async function completeWithAi(stories) {
  const list = (stories || []).filter(Boolean);
  if (!list.length || state.processingId) return;
  if (!state.aiConfigured) {
    refreshSaveState('Falta clave de IA. Pon groq_api_key (gratis) en api/config.local.php → console.groq.com/keys', 'warn');
    return;
  }
  const usePhoto = !!( $('#chkAiPhoto') && $('#chkAiPhoto').checked );
  const fixTitle = !!( !$('#chkAiTitle') || $('#chkAiTitle').checked );
  for (let i = 0; i < list.length; i += 1) {
    const story = state.stories.find(function (s) { return s.id === list[i].id; }) || list[i];
    state.processingId = story.id;
    state.aiWaiting = false;
    renderList();
    refreshSaveState('IA ' + (i + 1) + '/' + list.length + ' · ' + (usePhoto ? 'foto' : 'texto') + ' · ' + folderName(story.folder) + ' / ' + story.titulo);
    try {
      const result = await completeStoryCopyWithRetry(story, {
        usePhoto: usePhoto,
        marca: folderName(story.folder),
      });
      const partial = { textoA: result.textoA, textoB: result.textoB };
      if (fixTitle && result.titulo) partial.titulo = result.titulo;
      applyToStory(story.id, partial);
      refreshSaveState('IA ' + (i + 1) + '/' + list.length + ' · ' + story.id + ' listo (' + (result.mode || 'text') + '). Revisa y guarda.');
      if (usePhoto && i < list.length - 1) {
        await sleep(3200);
      }
    } catch (err) {
      state.aiWaiting = false;
      refreshSaveState(err.message || 'Error de IA', 'err');
      break;
    }
  }
  state.processingId = '';
  state.aiWaiting = false;
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
    await renderStory(hold, queued[i], { autoFit: true, showGuides: false, showSafeZones: false });
    const htmlToImage = await import('https://cdn.jsdelivr.net/npm/html-to-image@1.11.13/+esm');
    const canvas = hold.querySelector('#story-canvas');
    // Cinturon de seguridad: nunca exportar guías de zona segura
    canvas.querySelectorAll('[data-guides], [data-safe-zones]').forEach(function (el) { el.remove(); });
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
  if ($('#warnings')) {
    $('#warnings').onclick = function (e) {
      const btn = e.target.closest('#btnFixWarnings');
      if (!btn) return;
      applyWarningFixes();
    };
  }
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
  if ($('#undoBtn')) $('#undoBtn').onclick = function () { undoUnsaved(); };
  $('#downloadBtn').onclick = function () { downloadChecked(); };
  $('#btnNew').onclick = function () {
    if (state.view === 'trash') return;
    let n = state.stories.length + 1;
    while (state.stories.some(function (s) { return s.id === 'pieza-' + n; })) n += 1;
    const folder = (selected() && selected().folder) || 'sin-carpeta';
    const created = normalizeStory(Object.assign({}, DEFAULT_STORY, { id: 'pieza-' + n, folder: folder }));
    state.stories.push(created);
    state.selectedId = created.id;
    state.collapsed[folder] = false;
    renderList(); fillForm(); preview();
    refreshSaveState();
  };
  if ($('#btnNewFolder')) {
    $('#btnNewFolder').onclick = async function () {
      if (state.view === 'trash') return;
      const name = prompt('Nombre de la carpeta');
      if (!name || !name.trim()) return;
      try {
        const result = await createFolder(name.trim());
        state.folders = result.folders || state.folders;
        if (result.created) state.collapsed[result.created.id] = false;
        renderList();
        fillForm();
        refreshSaveState('Carpeta creada: ' + name.trim());
      } catch (err) {
        refreshSaveState(err.message || 'No se pudo crear carpeta', 'err');
      }
    };
  }
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
  if ($('#bulkFolder')) {
    $('#bulkFolder').onchange = function () {
      const folder = $('#bulkFolder').value;
      if (!folder || state.view !== 'active') return;
      const ids = checkedIds().filter(function (id) { return state.stories.some(function (s) { return s.id === id; }); });
      if (!ids.length) { $('#bulkFolder').value = ''; return; }
      state.stories = state.stories.map(function (story) {
        if (ids.indexOf(story.id) === -1) return story;
        return normalizeStory(Object.assign({}, story, { folder: folder }));
      });
      state.collapsed[folder] = false;
      $('#bulkFolder').value = '';
      renderList();
      fillForm();
      refreshSaveState(ids.length + ' pieza(s) movidas a ' + folderName(folder), 'warn');
    };
  }
  $('#storyList').onclick = function (e) {
    const toggle = e.target.closest('[data-toggle-folder]');
    if (toggle) {
      const fid = toggle.getAttribute('data-toggle-folder');
      state.collapsed[fid] = !state.collapsed[fid];
      renderList();
      return;
    }
    const folderBg = e.target.closest('[data-folder-bg]');
    if (folderBg) {
      const fid = folderBg.getAttribute('data-folder-bg');
      const brand = brandById(fid);
      if (!brand) {
        refreshSaveState('Esa carpeta no tiene fondo de marca. Usa los botones de fondo abajo.', 'warn');
        return;
      }
      const ids = state.stories.filter(function (s) {
        return (s.folder || 'sin-carpeta') === fid;
      }).map(function (s) { return s.id; });
      if (!ids.length) {
        refreshSaveState('La carpeta esta vacia', 'warn');
        return;
      }
      const n = applyBackgroundToIds(ids, brand.path, brand.id);
      refreshSaveState('Fondo «' + brand.name + '» en ' + n + ' pieza(s) de la carpeta. Guarda cuando quieras.', 'warn');
      return;
    }
    const delFolder = e.target.getAttribute && e.target.getAttribute('data-del-folder');
    if (delFolder) {
      if (!confirm('Eliminar carpeta vacia «' + delFolder + '»?')) return;
      deleteFolder(delFolder).then(function (result) {
        state.folders = result.folders || state.folders;
        renderList();
      }).catch(function (err) {
        refreshSaveState(err.message || 'No se pudo borrar carpeta', 'err');
      });
      return;
    }
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

  ['id', 'titulo', 'hook', 'textoA', 'textoB', 'cta', 'notes', 'product', 'bg', 'original', 'layout', 'accent-txt', 'folder'].forEach(function (name) {
    const el = document.getElementById('f-' + name);
    if (!el) return;
    el.oninput = el.onchange = function () {
      const map = { id: 'id', titulo: 'titulo', hook: 'hook', textoA: 'textoA', textoB: 'textoB', cta: 'cta', notes: 'notes', product: 'productImage', bg: 'background', original: 'originalImage', layout: 'textLayout', 'accent-txt': 'accentColor', folder: 'folder' };
      const patchData = {};
      if (name === 'id') patchData.id = el.value.trim().toLowerCase().replace(/[^a-z0-9._-]/g, '-');
      else patchData[map[name]] = el.value;
      if (name === 'folder') state.collapsed[el.value] = false;
      patch(patchData);
    };
  });
  function slider(id, key, fmt) {
    const el = document.getElementById(id);
    if (!el) return;
    el.oninput = function () {
      const val = Number(el.value);
      const hint = document.getElementById(id + '-val');
      if (hint) hint.textContent = fmt(val);
      const o = {}; o[key] = val; patch(o);
    };
  }
  slider('f-scale', 'productScale', function (v) { return v.toFixed(2) + '×'; });
  slider('f-offx', 'productOffsetX', function (v) { return v + 'px'; });
  slider('f-off', 'productOffsetY', function (v) { return v + 'px'; });
  slider('f-shelf-off', 'shelfOffsetY', function (v) { return v + 'px'; });
  slider('f-shelf-scale', 'shelfScale', function (v) { return v.toFixed(2) + '×'; });
  slider('f-text-offy', 'textOffsetY', function (v) { return v + 'px'; });
  slider('f-text-offx', 'textOffsetX', function (v) { return v + 'px'; });
  slider('f-title', 'titleSize', function (v) { return v + 'px'; });
  slider('f-body', 'bodySize', function (v) { return v + 'px'; });
  $('#f-accent').oninput = function () { patch({ accentColor: $('#f-accent').value }); };
  renderBrandButtons();
  $('#brandBgGrid').onclick = function (e) {
    const btn = e.target.closest('[data-bg]');
    if (!btn) return;
    const brand = btn.getAttribute('data-brand');
    const bg = btn.getAttribute('data-bg');
    const marked = checkedIds().filter(function (id) {
      return state.stories.some(function (s) { return s.id === id; });
    });
    if (marked.length) {
      const n = applyBackgroundToIds(marked, bg, brand || '');
      refreshSaveState('Fondo aplicado a ' + n + ' pieza(s) marcadas. Guarda cuando quieras.', 'warn');
      return;
    }
    const data = { background: bg };
    if (brand) {
      data.folder = brand;
      state.collapsed[brand] = false;
    }
    state.assetRevision = Date.now();
    patch(data);
    refreshBrandActive();
    renderFolderSelect();
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
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
      const tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : '';
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
      if (isDirty()) {
        e.preventDefault();
        undoUnsaved();
      }
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
    const folders = await fetchFolders();
    state.folders = folders;
  } catch (err) {
    state.folders = [
      { id: 'pocion', name: 'Poción', locked: true },
      { id: 'click-hair', name: 'Click Hair', locked: true },
      { id: 'herbacol', name: 'HERBACOL', locked: true },
      { id: 'bell-franz', name: 'Bell Franz', locked: true },
      { id: 'anyeluz', name: 'anyeluz', locked: true },
      { id: 'origen-botanico', name: 'Origen Botánico', locked: true },
      { id: 'sin-carpeta', name: 'Sin carpeta', locked: true },
    ];
  }
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
  state.assetRevision = Date.now();
  const params = new URLSearchParams(window.location.search);
  const select = params.get('select');
  const created = (params.get('created') || '').split(',').filter(Boolean);
  const folderParam = params.get('folder');
  if (select && state.stories.some(function (s) { return s.id === select; })) state.selectedId = select;
  else state.selectedId = state.stories[0] ? state.stories[0].id : '';
  created.forEach(function (id) { state.checked[id] = true; });
  if (folderParam) state.collapsed[folderParam] = false;
  else if (select) {
    const sel = state.stories.find(function (s) { return s.id === select; });
    if (sel && sel.folder) state.collapsed[sel.folder] = false;
  }
  try {
    const status = await aiStatus();
    state.aiConfigured = !!(status && status.configured);
    if ($('#aiHelp')) {
      const name = status && status.provider === 'groq' ? 'Groq (gratis)'
        : status && status.provider === 'openai' ? 'ChatGPT'
        : 'IA';
      $('#aiHelp').textContent = state.aiConfigured
        ? name + ': con «Leer foto» activa lee el envase y pone titulo real + venta.'
        : 'Falta clave de IA. Pon groq_api_key (gratis) en api/config.local.php → console.groq.com/keys';
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
