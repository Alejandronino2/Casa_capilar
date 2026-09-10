export const CANVAS = { width: 1080, height: 1920 };
export const SAFE = { top: 155, bottom: 155, areaTop: 155, areaBottom: 1920 - 155 };
export const INK = '#252525';
export const ACCENT_DEFAULT = '#F27F83';
export const SHELF = { width: 420, height: 22, surfaceOffset: 0, visibleBottom: 22 };
export const GRADIENT = 'gradient';
export const LIMITS = {
  productScale: { min: 0.4, max: 2.2, step: 0.01 },
  productOffsetX: { min: -280, max: 280, step: 1 },
  productOffsetY: { min: -260, max: 260, step: 1 },
  shelfOffsetY: { min: -220, max: 220, step: 1 },
  shelfScale: { min: 0.55, max: 1.45, step: 0.01 },
  textOffsetY: { min: -220, max: 220, step: 1 },
  textOffsetX: { min: -120, max: 120, step: 1 },
  titleSize: { min: 36, max: 120, step: 1 },
  bodySize: { min: 18, max: 56, step: 1 },
};

export const DEFAULT_STORY = {
  titulo: 'Titulo de la pieza',
  textoA: 'Para que sirve el producto.',
  textoB: 'Tamaños:',
  hook: '',
  cta: 'COMPRAR →',
  productImage: '',
  background: GRADIENT,
  textLayout: 'two-col',
  productScale: 1.4,
  productOffsetX: 0,
  productOffsetY: 0,
  shelfOffsetY: 0,
  shelfScale: 1,
  textOffsetY: 0,
  textOffsetX: 0,
  titleSize: 72,
  bodySize: 26,
  accentColor: ACCENT_DEFAULT,
  folder: 'sin-carpeta',
};

const BRAND_LABELS = {
  pocion: 'Poción',
  'click-hair': 'Click Hair',
  herbacol: 'HERBACOL',
  'bell-franz': 'Bell Franz',
  anyeluz: 'anyeluz',
  'origen-botanico': 'Origen Botánico',
};

/** Logos de marca (PNG transparente). Si no hay, se usa texto. */
const BRAND_LOGOS = {
  'click-hair': 'assets/brands/logo-click-hair.png',
  anyeluz: 'assets/brands/logo-anyeluz.png',
  pocion: 'assets/brands/logo-pocion.png',
  herbacol: 'assets/brands/logo-herbacol.png',
  'bell-franz': 'assets/brands/logo-bell-franz.png',
  'origen-botanico': 'assets/brands/logo-origen-botanico.png',
};

/** Acento de marca bajo el nombre (línea estética). */
const BRAND_COLORS = {
  pocion: '#E50A7B',
  'click-hair': '#F24B5E',
  herbacol: '#46782D',
  'bell-franz': '#5F7A3A',
  anyeluz: '#252525',
  'origen-botanico': '#957256',
  'sin-carpeta': ACCENT_DEFAULT,
};

const BENEFIT_PHRASE = {
  HIDRATA: 'Hidrata',
  NUTRE: 'Nutre',
  BRILLA: 'Aporta brillo',
  DEFINE: 'Define',
  FORTALECE: 'Fortalece',
  SUAVIZA: 'Suaviza',
  REPARA: 'Repara',
  PROTEGE: 'Protege',
  LIMPIA: 'Limpia',
  REVITALIZA: 'Revitaliza',
  CRECE: 'Estimula el crecimiento',
  'ANTI-FRIZZ': 'Controla el frizz',
  VOLUMEN: 'Da volumen',
};

const HOOK_NOUN = {
  HIDRATA: 'Hidratación',
  NUTRE: 'Nutrición',
  BRILLA: 'Brillo',
  DEFINE: 'Definición',
  FORTALECE: 'Fuerza',
  SUAVIZA: 'Suavidad',
  REPARA: 'Reparación',
  PROTEGE: 'Protección',
  LIMPIA: 'Limpieza',
  REVITALIZA: 'Vitalidad',
  CRECE: 'Crecimiento',
  'ANTI-FRIZZ': 'Anti-frizz',
  VOLUMEN: 'Volumen',
};

/** Jerarquia comercial: contenido solo entre SAFE.top y SAFE.areaBottom. */
const ZONES = {
  brandTop: 168,
  titleTop: 208,
  titleHeight: 152,
  hookTop: 368,
  heroTop: 425,
  heroBottom: 1320,
  lowerTop: 1375,
  footerTop: 1675,
  footerHeight: 64,
};

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

export function normalizeStory(raw, index) {
  const input = raw || {};
  const id = (typeof input.id === 'string' && input.id.trim()) || 'pieza-' + ((index || 0) + 1);
  return {
    id: id,
    titulo: typeof input.titulo === 'string' ? input.titulo : DEFAULT_STORY.titulo,
    textoA: typeof input.textoA === 'string' ? input.textoA : DEFAULT_STORY.textoA,
    textoB: typeof input.textoB === 'string' ? input.textoB : DEFAULT_STORY.textoB,
    hook: typeof input.hook === 'string' ? input.hook : '',
    cta: typeof input.cta === 'string' ? input.cta : DEFAULT_STORY.cta,
    productImage: typeof input.productImage === 'string' ? input.productImage : '',
    background: typeof input.background === 'string' ? input.background : GRADIENT,
    textLayout: input.textLayout === 'stacked' ? 'stacked' : 'two-col',
    productScale: clamp(
      (function () {
        const n = Number(input.productScale);
        if (!Number.isFinite(n) || n <= 0) return 1.4;
        // Migrar default antiguo (~1.0 / 1.04) → 1.4
        if (n >= 0.95 && n <= 1.05) return 1.4;
        return n;
      })(),
      LIMITS.productScale.min,
      LIMITS.productScale.max
    ),
    productOffsetX: clamp(Number(input.productOffsetX) || 0, LIMITS.productOffsetX.min, LIMITS.productOffsetX.max),
    productOffsetY: clamp(Number(input.productOffsetY) || 0, LIMITS.productOffsetY.min, LIMITS.productOffsetY.max),
    shelfOffsetY: clamp(Number(input.shelfOffsetY) || 0, LIMITS.shelfOffsetY.min, LIMITS.shelfOffsetY.max),
    shelfScale: clamp(Number(input.shelfScale) || 1, LIMITS.shelfScale.min, LIMITS.shelfScale.max),
    textOffsetY: clamp(Number(input.textOffsetY) || 0, LIMITS.textOffsetY.min, LIMITS.textOffsetY.max),
    textOffsetX: clamp(Number(input.textOffsetX) || 0, LIMITS.textOffsetX.min, LIMITS.textOffsetX.max),
    titleSize: clamp(Number(input.titleSize) || DEFAULT_STORY.titleSize, LIMITS.titleSize.min, LIMITS.titleSize.max),
    bodySize: clamp(Number(input.bodySize) || DEFAULT_STORY.bodySize, LIMITS.bodySize.min, LIMITS.bodySize.max),
    accentColor: typeof input.accentColor === 'string' ? input.accentColor : ACCENT_DEFAULT,
    originalImage: typeof input.originalImage === 'string' ? input.originalImage : '',
    notes: typeof input.notes === 'string' ? input.notes : '',
    folder: (typeof input.folder === 'string' && input.folder.trim()) ? input.folder.trim() : 'sin-carpeta',
  };
}

export function getGeometry(textLayout) {
  const TITLE = { x: 100, y: ZONES.titleTop, width: 880, height: ZONES.titleHeight };
  return {
    title: TITLE,
    shelfSurfaceY: ZONES.heroBottom,
    product: { width: 900, baseHeight: 900 },
    arrowSize: { width: 0, height: 0 },
    blocks: [
      { key: 'A', x: 100, y: ZONES.lowerTop, width: 880, height: 220, align: 'center', arrow: { x: 0, y: 0, flip: false, variant: 'up' } },
      { key: 'B', x: 120, y: ZONES.footerTop, width: 840, height: 120, align: 'center', arrow: { x: 0, y: 0, flip: true, variant: 'up' } },
    ],
    textLayout: textLayout === 'stacked' ? 'stacked' : 'two-col',
  };
}

function esc(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeRegExp(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function resolveAccent(color) {
  const c = String(color || '').trim().toUpperCase();
  if (!c || c === '#2B2B2B' || c === '#252525' || c === '#000000' || c === '#111111') {
    return ACCENT_DEFAULT;
  }
  return color;
}

function brandLabel(folder) {
  if (!folder || folder === 'sin-carpeta') return '';
  return BRAND_LABELS[folder] || folder.replace(/-/g, ' ');
}

function brandLogoSrc(folder) {
  if (!folder) return '';
  return BRAND_LOGOS[folder] || '';
}

function brandUnderlineColor(folder, accentFallback) {
  if (folder && BRAND_COLORS[folder]) return BRAND_COLORS[folder];
  return accentFallback || ACCENT_DEFAULT;
}

function formatTitle(titulo, brand) {
  let t = String(titulo || '').replace(/\r/g, '').trim();
  if (brand) {
    const reLine = new RegExp('^\\s*' + escapeRegExp(brand) + '\\s*$', 'i');
    const reTail = new RegExp('[\\s\\n]*' + escapeRegExp(brand) + '\\s*$', 'i');
    t = t.split('\n').filter(function (line) { return !reLine.test(line.trim()); }).join('\n');
    t = t.replace(reTail, '').trim();
  }
  // Quitar "4 EN 1" del titulo visual (pasa a badge)
  t = t.replace(/\b\d+\s*en\s*1\b/ig, '').replace(/\s{2,}/g, ' ').trim();

  let lines = t.split(/\n+/).map(function (l) { return l.trim(); }).filter(Boolean);
  if (lines.length === 1) {
    const typeRe = /^(SHAMPOO|ACONDICIONADOR|MASCARILLA|CREMA(?:\s+PARA\s+PEINAR)?|TONICO|TÓNICO|SERUM|SÉRUM|SUERO|TRATAMIENTO|OLEO|ÓLEO|PERFUME|GEL|KIT|BLOQUEADOR|PROTECTOR)\b/i;
    const m = lines[0].match(typeRe);
    if (m) {
      const type = m[1].toUpperCase().replace(/\s+/g, ' ');
      const rest = lines[0].slice(m[0].length).trim().replace(/^DE\s+/i, 'DE ');
      if (rest) lines = [type, rest.toUpperCase()];
      else lines = [type];
    } else if (lines[0].length > 22) {
      const words = lines[0].split(/\s+/);
      if (words.length >= 3) {
        const mid = Math.ceil(words.length / 2);
        lines = [words.slice(0, mid).join(' '), words.slice(mid).join(' ')];
      }
    }
  }
  if (lines.length > 2) lines = lines.slice(0, 2);
  return lines.join('\n');
}

function extractBenefits(textoA) {
  const raw = String(textoA || '').trim();
  if (!raw) return [];

  if (/[·|]/.test(raw)) {
    const parts = raw.split(/[·|]/).map(function (p) { return p.trim(); }).filter(Boolean);
    if (parts.length >= 2 && parts.every(function (p) { return p.length <= 22; })) {
      return parts.slice(0, 3).map(function (p) { return p.toUpperCase(); });
    }
  }

  const short = raw.replace(/\n/g, ' ').trim();
  if (short.length <= 22 && short.split(/\s+/).length <= 3) {
    return [short.toUpperCase()];
  }

  const rules = [
    { re: /\bhidrat/i, label: 'HIDRATA' },
    { re: /\bnutr/i, label: 'NUTRE' },
    { re: /\bbrill/i, label: 'BRILLA' },
    { re: /\bdefin/i, label: 'DEFINE' },
    { re: /\bfortalec/i, label: 'FORTALECE' },
    { re: /\bsuaviz/i, label: 'SUAVIZA' },
    { re: /\brepar/i, label: 'REPARA' },
    { re: /\bproteg/i, label: 'PROTEGE' },
    { re: /\blimpi/i, label: 'LIMPIA' },
    { re: /\brevitaliz/i, label: 'REVITALIZA' },
    { re: /\bcrecimient/i, label: 'CRECE' },
    { re: /\bfrizz/i, label: 'ANTI-FRIZZ' },
    { re: /\bvolumen/i, label: 'VOLUMEN' },
  ];
  const found = [];
  rules.forEach(function (rule) {
    if (rule.re.test(raw) && found.indexOf(rule.label) === -1) found.push(rule.label);
  });
  return found.slice(0, 3);
}

function extractBadge(titulo, textoA) {
  const blob = String(titulo || '') + ' ' + String(textoA || '');
  const m = blob.match(/(\d+)\s*en\s*1/i);
  return m ? (m[1] + ' EN 1') : '';
}

function extractIngredients(titulo, textoA) {
  const blob = (String(titulo || '') + ' ' + String(textoA || '')).toUpperCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const catalog = [
    ['ARROZ', /\bARROZ\b/],
    ['AVENA', /\bAVENA\b/],
    ['AJÍ', /\bAJI\b/],
    ['MIEL', /\bMIEL\b/],
    ['CEBOLLA', /\bCEBOLLA\b/],
    ['ROMERO', /\bROMERO\b/],
    ['BANANO', /\bBANANO\b/],
    ['ALOE', /\bALOE\b/],
    ['ARGÁN', /\bARGAN\b/],
    ['GINSENG', /\bGINSENG\b/],
    ['LINAZA', /\bLINAZA\b/],
    ['GRANADA', /\bGRANADA\b/],
    ['AGUACATE', /\bAGUACATE\b/],
    ['CAFÉ', /\bCAFE\b/],
    ['MANZANILLA', /\bMANZANILLA\b/],
    ['ROSAS', /\bROSAS?\b/],
    ['COLÁGENO', /\bCOLAGENO\b/],
    ['KARITÉ', /\bKARITE\b/],
  ];
  const found = [];
  catalog.forEach(function (item) {
    if (item[1].test(blob) && found.indexOf(item[0]) === -1) found.push(item[0]);
  });
  return found.slice(0, 4);
}

function buildHook(data, benefits, badge) {
  if (data.hook && String(data.hook).trim()) return String(data.hook).trim();
  const nouns = benefits.map(function (b) { return HOOK_NOUN[b]; }).filter(Boolean);
  if (badge && nouns.length) {
    return badge + ' · ' + nouns.slice(0, 2).join(' + ');
  }
  if (nouns.length >= 2) {
    return nouns[0] + ' + ' + nouns[1].toLowerCase() + ' para tu cabello';
  }
  if (nouns.length === 1) {
    return nouns[0] + ' para tu cabello';
  }
  return 'Belleza real para tu cabello';
}

function benefitPhrases(benefits) {
  return benefits.map(function (b) {
    return BENEFIT_PHRASE[b] || b.charAt(0) + b.slice(1).toLowerCase();
  });
}

function extractSize(textoB) {
  const raw = String(textoB || '').replace(/\r/g, '').trim();
  if (!raw) return '';
  const match = raw.match(/(\d+(?:[.,]\d+)?\s*(?:ml|g|oz)(?:\s*(?:y|\/|,|&)\s*\d+(?:[.,]\d+)?\s*(?:ml|g|oz))?)/i);
  if (match) return match[1].replace(/\s+/g, ' ').toUpperCase();
  const cleaned = raw
    .replace(/^tama[nñ]os?\s*:?\s*/i, '')
    .split('\n')
    .map(function (l) { return l.trim(); })
    .filter(Boolean)[0] || '';
  return cleaned.toUpperCase();
}

function truncateDescription(textoA, maxChars) {
  const text = String(textoA || '').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  if (text.length <= maxChars) return text;
  const cut = text.slice(0, maxChars - 1);
  const soft = cut.replace(/\s+\S*$/, '');
  return (soft.length > 40 ? soft : cut).trim() + '…';
}

export function measureVisibleBounds(img) {
  if (!img || !img.naturalWidth || !img.naturalHeight) {
    return { x: 0, y: 0, width: 1, height: 1, contentRatioW: 1, contentRatioH: 1 };
  }
  const nw = img.naturalWidth;
  const nh = img.naturalHeight;
  try {
    const maxSide = 420;
    const scale = Math.min(1, maxSide / Math.max(nw, nh));
    const w = Math.max(1, Math.round(nw * scale));
    const h = Math.max(1, Math.round(nh * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    const data = ctx.getImageData(0, 0, w, h).data;
    let minX = w;
    let minY = h;
    let maxX = 0;
    let maxY = 0;
    let found = false;
    const threshold = 14;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (data[(y * w + x) * 4 + 3] > threshold) {
          found = true;
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (!found) {
      return { x: 0, y: 0, width: nw, height: nh, contentRatioW: 1, contentRatioH: 1 };
    }
    const inv = 1 / scale;
    const vw = Math.max(1, (maxX - minX + 1) * inv);
    const vh = Math.max(1, (maxY - minY + 1) * inv);
    return {
      x: minX * inv,
      y: minY * inv,
      width: vw,
      height: vh,
      contentRatioW: vw / nw,
      contentRatioH: vh / nh,
    };
  } catch (err) {
    return { x: 0, y: 0, width: nw, height: nh, contentRatioW: 1, contentRatioH: 1 };
  }
}

/**
 * Layout adaptativo del hero:
 * - alto → prioriza altura
 * - ancho / kit → limita por ancho
 * - mucho padding transparente → compensa con contentRatio
 * - productScale/offsets del editor se respetan
 */
export function calculateProductLayout(input) {
  const naturalWidth = Math.max(1, Number(input.naturalWidth) || 1);
  const naturalHeight = Math.max(1, Number(input.naturalHeight) || 1);
  const visible = input.visible || {
    width: naturalWidth,
    height: naturalHeight,
    contentRatioW: 1,
    contentRatioH: 1,
  };
  const productScale = Number(input.productScale) || 1;
  const productOffsetX = Number(input.productOffsetX) || 0;
  const productOffsetY = Number(input.productOffsetY) || 0;
  const shelfOffsetY = Number(input.shelfOffsetY) || 0;
  const shelfScale = Number(input.shelfScale) || 1;
  const areaTop = input.areaTop != null ? input.areaTop : ZONES.heroTop;
  const areaBottom = input.areaBottom != null ? input.areaBottom : ZONES.heroBottom;
  const maxWidth = input.maxWidth != null ? input.maxWidth : 960;

  const usefulH = Math.max(200, areaBottom - areaTop);
  const contentRatioH = clamp(Number(visible.contentRatioH) || (visible.height / naturalHeight) || 1, 0.25, 1);
  const contentRatioW = clamp(Number(visible.contentRatioW) || (visible.width / naturalWidth) || 1, 0.25, 1);
  const frameAspect = naturalWidth / naturalHeight;
  const visAspect = (visible.width || naturalWidth) / Math.max(1, visible.height || naturalHeight);

  // Objetivo: producto visible grande (~50–62% de la altura util del hero)
  let targetVisibleRatio = 0.58;
  if (visAspect > 1.15) targetVisibleRatio = 0.46; // ancho / kit
  else if (visAspect < 0.55) targetVisibleRatio = 0.62; // muy alto y delgado
  else if (contentRatioH < 0.55) targetVisibleRatio = 0.60; // mucho padding → empujar presencia

  const targetVisibleH = usefulH * targetVisibleRatio;
  let boxH = targetVisibleH / contentRatioH;
  let boxW = boxH * frameAspect;

  const maxBoxW = maxWidth;
  if (boxW > maxBoxW) {
    boxW = maxBoxW;
    boxH = boxW / frameAspect;
  }

  const maxBoxH = usefulH * (visAspect > 1.1 ? 0.70 : 0.86);
  if (boxH > maxBoxH) {
    boxH = maxBoxH;
    boxW = boxH * frameAspect;
  }

  // Productos pequenos / mucho aire: empujar un poco mas
  const visibleHNow = boxH * contentRatioH;
  if (visibleHNow < usefulH * 0.46 && visAspect <= 1.15) {
    const boost = (usefulH * 0.50) / Math.max(1, visibleHNow);
    boxW *= boost;
    boxH *= boost;
    if (boxW > maxBoxW) {
      boxW = maxBoxW;
      boxH = boxW / frameAspect;
    }
    if (boxH > maxBoxH) {
      boxH = maxBoxH;
      boxW = boxH * frameAspect;
    }
  }

  boxW *= productScale;
  boxH *= productScale;

  // Pedestal y producto nunca entran en zona insegura inferior
  const bottomLimit = SAFE.areaBottom - 44;
  let pedestalSurface = Math.min(areaBottom + shelfOffsetY, bottomLimit);
  // Nunca invadir zona insegura superior
  const maxTop = SAFE.areaTop;
  const maxHAllowed = Math.max(180, pedestalSurface + productOffsetY - maxTop);
  if (boxH > maxHAllowed) {
    boxH = maxHAllowed;
    boxW = boxH * frameAspect;
  }

  const leftBase = ((CANVAS.width - boxW) / 2) + productOffsetX;
  let top = Math.max(maxTop, pedestalSurface - boxH + productOffsetY);
  // Si el offset empuja el producto hacia abajo past bottom, reajustar
  if (top + boxH > bottomLimit) {
    top = Math.max(maxTop, bottomLimit - boxH);
    pedestalSurface = Math.min(bottomLimit, top + boxH);
  }

  // Centrar el CONTENIDO visible (no el frame PNG) con el pedestal
  const boxAspect = boxW / Math.max(1, boxH);
  let drawW;
  let drawH;
  let drawLeft;
  let drawTop;
  if (frameAspect > boxAspect) {
    drawW = boxW;
    drawH = boxW / frameAspect;
    drawLeft = 0;
    drawTop = boxH - drawH; // object-position: bottom
  } else {
    drawH = boxH;
    drawW = boxH * frameAspect;
    drawLeft = (boxW - drawW) / 2;
    drawTop = 0;
  }
  const vx = Number(visible.x) || 0;
  const vy = Number(visible.y) || 0;
  const vw = Number(visible.width) || naturalWidth;
  const vh = Number(visible.height) || naturalHeight;
  const visCenterInBoxX = drawLeft + ((vx + vw / 2) / naturalWidth) * drawW;
  const visBottomInBoxY = drawTop + ((vy + vh) / naturalHeight) * drawH;
  const shiftX = (boxW / 2) - visCenterInBoxX;
  const shiftY = boxH - visBottomInBoxY; // baja la caja para que el pie visible apoye en el pedestal

  const left = leftBase + shiftX;
  top = Math.max(maxTop, top + shiftY);
  if (top + boxH > bottomLimit) {
    top = Math.max(maxTop, bottomLimit - boxH);
    pedestalSurface = Math.min(bottomLimit, top + boxH);
  }

  const visibleW = boxW * contentRatioW;
  const pedestalW = clamp(visibleW * 0.88 * shelfScale, 260, 820);
  const visibleCenterX = left + visCenterInBoxX;
  const pedestalLeft = visibleCenterX - pedestalW / 2;

  return {
    width: boxW,
    height: boxH,
    left: left,
    top: top,
    pedestalSurface: pedestalSurface,
    pedestalWidth: pedestalW,
    pedestalLeft: pedestalLeft,
    visibleWidth: visibleW,
    visibleHeight: boxH * contentRatioH,
    contentRatioW: contentRatioW,
    contentRatioH: contentRatioH,
    visAspect: visAspect,
    visibleCenterX: visibleCenterX,
  };
}

function creamBackdropHtml(accent) {
  return (
    '<div style="position:absolute;inset:0;background:#F7EEE7"></div>' +
    '<div style="position:absolute;inset:0;background:' +
      'radial-gradient(ellipse 95% 72% at 50% 30%, #FFF9F5 0%, rgba(248,240,234,0.35) 48%, transparent 70%),' +
      'linear-gradient(180deg, #FFF8F4 0%, #F8F0EA 42%, #F1DFD4 100%)' +
    '"></div>' +
    '<div style="position:absolute;left:5%;top:22%;width:90%;height:52%;background:radial-gradient(circle at 50% 42%, ' +
      hexToRgba(accent, 0.10) + ' 0%, ' + hexToRgba(accent, 0.03) + ' 38%, transparent 70%);pointer-events:none"></div>' +
    '<div style="position:absolute;inset:0;background:radial-gradient(ellipse 110% 48% at 50% 100%, rgba(80,45,35,0.07) 0%, transparent 58%);pointer-events:none"></div>'
  );
}

function hexToRgba(hex, alpha) {
  const h = String(hex || ACCENT_DEFAULT).replace('#', '');
  const full = h.length === 3 ? h.split('').map(function (c) { return c + c; }).join('') : h;
  const n = parseInt(full, 16);
  if (Number.isNaN(n)) return 'rgba(242,127,131,' + alpha + ')';
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
}

function fitBox(box, requested, min, autoFit) {
  if (!box || !box.firstElementChild) return { size: requested, overflow: false };
  const inner = box.firstElementChild;
  let size = requested;
  inner.style.fontSize = size + 'px';
  const fits = function () { return inner.scrollHeight <= box.clientHeight + 0.5; };
  if (autoFit) {
    while (size > min && !fits()) {
      size -= 1;
      inner.style.fontSize = size + 'px';
    }
  }
  return { size: size, overflow: !fits() };
}

function waitImage(src) {
  return new Promise(function (resolve) {
    if (!src) return resolve({ ready: true, error: false, img: null });
    const img = new Image();
    img.onload = function () {
      const done = function () {
        resolve({
          ready: true,
          error: false,
          natural: { width: img.naturalWidth, height: img.naturalHeight },
          img: img,
        });
      };
      if (img.decode) img.decode().then(done, done);
      else done();
    };
    img.onerror = function () { resolve({ ready: true, error: true, img: null }); };
    img.src = src;
  });
}

export async function ensureFonts() {
  if (!document.fonts) return;
  await Promise.all([
    document.fonts.load('800 72px Poppins').catch(function () {}),
    document.fonts.load('500 26px Poppins').catch(function () {}),
    document.fonts.load('400 22px Poppins').catch(function () {}),
  ]);
  await document.fonts.ready;
}

export async function renderStory(host, data, options) {
  options = options || {};
  const autoFit = options.autoFit !== false;
  // Guías solo en editor. Export debe pasar showSafeZones:false (y showGuides:false).
  const showSafeZones = options.showSafeZones != null
    ? !!options.showSafeZones
    : !!options.showGuides;
  const highlight = !!options.highlightOverflow;
  const rev = options.assetRevision || 0;
  const bust = function (src) { return rev ? src.split('?')[0] + '?v=' + rev : src; };

  const geo = getGeometry(data.textLayout);
  const accent = resolveAccent(data.accentColor);
  const brand = brandLabel(data.folder);
  const brandLogo = brandLogoSrc(data.folder);
  const brandLogoUrl = brandLogo ? bust(brandLogo) : '';
  const brandLine = brandUnderlineColor(data.folder, accent);
  const titleText = formatTitle(data.titulo, brand);
  const benefits = extractBenefits(data.textoA);
  const badge = extractBadge(data.titulo, data.textoA);
  const ingredients = extractIngredients(data.titulo, data.textoA);
  const hookText = buildHook(data, benefits, badge);
  const phrases = benefitPhrases(benefits);
  const description = truncateDescription(data.textoA, 160);
  const sizeLabel = extractSize(data.textoB);
  const ctaText = String(data.cta != null ? data.cta : DEFAULT_STORY.cta).trim();

  const usesPhoto = data.background !== GRADIENT && String(data.background || '').trim() !== '';
  const bgSrc = usesPhoto ? bust(data.background) : '';
  const prodSrc = data.productImage ? bust(data.productImage) : '';

  const bg = await waitImage(bgSrc || undefined);
  const product = await waitImage(prodSrc || undefined);
  const brandImg = brandLogoUrl ? await waitImage(brandLogoUrl) : { ready: true, error: false };
  await ensureFonts();

  const productMissing = !data.productImage || product.error;
  const backgroundMissing = usesPhoto && bg.error;
  const brandLogoReady = !!(brandLogoUrl && !brandImg.error);
  // Espacio reservado cuando hay logo (evita solaparse con el titulo)
  const logoDisplayW = 360;
  const logoDisplayH = brandLogoReady && brandImg.natural
    ? Math.min(88, Math.round(logoDisplayW * (brandImg.natural.height / Math.max(1, brandImg.natural.width))))
    : (brandLogoReady ? 88 : 0);
  const brandLineW = brandLogoReady ? Math.round(logoDisplayW * 1.12) : 56; // un poco mas ancha que el logo
  const brandBlockBottom = brandLogoReady
    ? (ZONES.brandTop + logoDisplayH + 14 + 4 + 28) // logo + gap + linea + aire
    : (ZONES.brandTop + (brand ? 20 + 14 + 4 + 28 : 24)); // texto + gap + linea + aire
  const titleTop = Math.max(ZONES.titleTop, brandBlockBottom);
  const titleHeight = ZONES.titleHeight;
  const hookTop = Math.max(ZONES.hookTop, titleTop + titleHeight + 8);
  const heroTopAdj = Math.max(ZONES.heroTop, hookTop + 44);

  let visible = { width: 1, height: 1, contentRatioW: 1, contentRatioH: 1 };
  if (!productMissing && product.img) {
    visible = measureVisibleBounds(product.img);
  } else if (product.natural) {
    visible = {
      x: 0,
      y: 0,
      width: product.natural.width,
      height: product.natural.height,
      contentRatioW: 1,
      contentRatioH: 1,
    };
  }

  const layout = calculateProductLayout({
    naturalWidth: product.natural ? product.natural.width : 800,
    naturalHeight: product.natural ? product.natural.height : 1200,
    visible: visible,
    productScale: data.productScale,
    productOffsetX: data.productOffsetX,
    productOffsetY: data.productOffsetY,
    shelfOffsetY: data.shelfOffsetY,
    shelfScale: data.shelfScale,
    areaTop: heroTopAdj,
    areaBottom: ZONES.heroBottom,
    maxWidth: 1020,
  });

  const textOffY = Number(data.textOffsetY) || 0;
  const textOffX = Number(data.textOffsetX) || 0;
  const contentBottom = SAFE.areaBottom - 10;
  const footerH = ZONES.footerHeight;
  let footerTop = ZONES.footerTop + textOffY * 0.2;
  footerTop = clamp(footerTop, ZONES.lowerTop + 160, contentBottom - footerH);
  let lowerTop = ZONES.lowerTop + textOffY + (Number(data.shelfOffsetY) || 0) * 0.12;
  lowerTop = clamp(lowerTop, layout.pedestalSurface + 28, footerTop - 120);

  const renderedHeight = layout.height;
  const productUpscale = product.natural ? renderedHeight / product.natural.height : 1;

  const guides = showSafeZones
    ? '<div data-guides="true" data-safe-zones="true" style="position:absolute;inset:0;pointer-events:none;z-index:50">' +
      '<div style="position:absolute;left:0;top:0;width:' + CANVAS.width + 'px;height:' + SAFE.top + 'px;background:repeating-linear-gradient(45deg,rgba(236,72,153,0.10) 0 22px,rgba(236,72,153,0.03) 22px 44px);border-bottom:3px dashed rgba(236,72,153,0.75)"></div>' +
      '<div style="position:absolute;left:24px;top:' + (SAFE.top - 36) + 'px;font-weight:600;font-size:24px;color:rgba(190,24,93,0.85)">zona insegura superior · 155px</div>' +
      '<div style="position:absolute;left:0;top:' + SAFE.areaBottom + 'px;width:' + CANVAS.width + 'px;height:' + SAFE.bottom + 'px;background:repeating-linear-gradient(45deg,rgba(236,72,153,0.10) 0 22px,rgba(236,72,153,0.03) 22px 44px);border-top:3px dashed rgba(236,72,153,0.75)"></div>' +
      '<div style="position:absolute;left:24px;top:' + (SAFE.areaBottom + 12) + 'px;font-weight:600;font-size:24px;color:rgba(190,24,93,0.85)">zona insegura inferior · 155px</div>' +
      '<div style="position:absolute;left:' + (CANVAS.width / 2) + 'px;top:0;width:1px;height:' + CANVAS.height + 'px;background:rgba(59,130,246,0.28)"></div></div>'
    : '';

  const haloSize = Math.max(520, layout.visibleWidth * 1.55);
  const haloLeft = layout.visibleCenterX != null
    ? layout.visibleCenterX - haloSize / 2
    : (CANVAS.width - haloSize) / 2 + (Number(data.productOffsetX) || 0) * 0.5;
  const haloTop = layout.top + layout.height * 0.12 - haloSize * 0.18;

  // --- Lower commercial block ---
  let yCursor = lowerTop;
  let lowerParts = '';

  if (badge) {
    lowerParts +=
      '<div style="text-align:center;margin-bottom:10px">' +
      '<span style="display:inline-block;font-family:Poppins,sans-serif;font-weight:800;font-size:22px;letter-spacing:0.22em;color:' + accent + '">' +
      esc(badge) +
      '</span></div>';
    yCursor += 36;
  }

  if (ingredients.length) {
    lowerParts +=
      '<div style="text-align:center;margin-bottom:14px;font-family:Poppins,sans-serif;font-weight:800;font-size:26px;letter-spacing:0.12em;color:' + INK + '">' +
      ingredients.map(function (ing) { return esc(ing); }).join('<span style="margin:0 14px;color:' + accent + ';opacity:0.55">·</span>') +
      '</div>';
  }

  if (phrases.length) {
    lowerParts +=
      '<div data-fit="a" style="margin:0 auto 16px;max-width:820px;overflow:hidden;height:48px;display:flex;align-items:center;justify-content:center">' +
      '<div style="width:100%;font-family:Poppins,sans-serif;font-weight:500;line-height:1.2;color:rgba(37,37,37,0.78);text-align:center">' +
      phrases.map(function (p, i) {
        return (i ? '<span style="margin:0 12px;opacity:0.4">•</span>' : '') + esc(p);
      }).join('') +
      '</div></div>';
  } else {
    lowerParts += '<div data-fit="a" style="height:1px;overflow:hidden;opacity:0"><div></div></div>';
  }

  lowerParts +=
    '<div data-fit="desc" style="margin:0 auto;max-width:820px;height:110px;overflow:hidden;display:flex;align-items:flex-start;justify-content:center">' +
    '<div style="width:100%;font-family:Poppins,sans-serif;font-weight:500;line-height:1.38;color:rgba(37,37,37,0.70);text-align:center;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:3;overflow:hidden">' +
    esc(description) +
    '</div></div>';

  const lowerHtml =
    '<div style="position:absolute;left:' + (90 + textOffX) + 'px;top:' + lowerTop + 'px;width:' + (900 - Math.abs(textOffX) * 2) + 'px;max-height:' + Math.max(80, footerTop - lowerTop - 8) + 'px;overflow:hidden">' +
    lowerParts +
    '</div>';

  // Footer: size capsule + CTA (siempre dentro de zona segura)
  const sizeCapsule = sizeLabel
    ? '<div data-fit="b" style="display:inline-flex;align-items:center;justify-content:center;min-width:148px;height:56px;padding:0 28px;border-radius:999px;background:' + hexToRgba(accent, 0.14) + ';border:1.5px solid ' + hexToRgba(accent, 0.45) + ';overflow:hidden">' +
      '<div style="font-family:Poppins,sans-serif;font-weight:800;letter-spacing:0.14em;color:' + INK + ';white-space:nowrap">' + esc(sizeLabel) + '</div></div>'
    : '<div data-fit="b" style="display:none"><div></div></div>';

  const ctaHtml = ctaText
    ? '<div style="display:inline-flex;align-items:center;justify-content:center;min-height:56px;padding:0 28px;border-radius:999px;background:' + accent + ';box-shadow:0 10px 24px ' + hexToRgba(accent, 0.35) + '">' +
      '<div style="font-family:Poppins,sans-serif;font-weight:800;font-size:22px;letter-spacing:0.08em;color:#fff;white-space:nowrap">' + esc(ctaText) + '</div></div>'
    : '';

  const footerHtml =
    '<div style="position:absolute;left:90px;top:' + footerTop + 'px;width:900px;height:' + footerH + 'px;display:flex;align-items:center;justify-content:center;gap:22px;flex-wrap:nowrap;overflow:hidden">' +
    sizeCapsule +
    ctaHtml +
    '</div>';

  host.innerHTML =
    '<div id="story-canvas" data-story-id="' + esc(data.id) + '" data-story-ready="false" style="position:relative;width:' + CANVAS.width + 'px;height:' + CANVAS.height + 'px;overflow:hidden;background:#F7EEE7;isolation:isolate;font-family:Poppins,sans-serif;-webkit-font-smoothing:antialiased">' +
    creamBackdropHtml(accent) +
    (usesPhoto && !bg.error
      ? '<img src="' + esc(bgSrc) + '" alt="" width="' + CANVAS.width + '" height="' + CANVAS.height + '" style="position:absolute;inset:0;width:' + CANVAS.width + 'px;height:' + CANVAS.height + 'px;object-fit:cover;object-position:center;opacity:0.22;mix-blend-mode:multiply">' +
        '<div style="position:absolute;inset:0;background:linear-gradient(180deg,rgba(247,238,231,0.58) 0%,rgba(248,240,234,0.78) 42%,rgba(241,223,212,0.9) 100%);pointer-events:none"></div>'
      : '') +
    // BRAND + línea de color (logo Click Hair u otras marcas en texto)
    '<div style="position:absolute;left:120px;top:' + ZONES.brandTop + 'px;width:840px;text-align:center">' +
    (brandLogoReady
      ? '<img src="' + esc(brandLogoUrl) + '" alt="' + esc(brand || 'marca') + '" width="' + logoDisplayW + '" height="' + logoDisplayH + '" style="display:block;margin:0 auto;width:' + logoDisplayW + 'px;height:' + logoDisplayH + 'px;object-fit:contain">' +
        '<div style="margin:14px auto 0;width:' + brandLineW + 'px;height:4px;border-radius:999px;background:linear-gradient(90deg, transparent 0%, ' + brandLine + ' 12%, ' + brandLine + ' 88%, transparent 100%);box-shadow:0 4px 14px ' + hexToRgba(brandLine, 0.35) + ';opacity:0.95"></div>'
      : (brand
        ? '<div style="display:inline-block;text-align:center;max-width:90%">' +
          '<div style="font-family:Poppins,sans-serif;font-weight:500;font-size:20px;letter-spacing:0.34em;text-transform:uppercase;color:rgba(37,37,37,0.42)">' + esc(brand) + '</div>' +
          '<div style="margin:14px auto 0;width:112%;height:4px;border-radius:999px;background:linear-gradient(90deg, transparent 0%, ' + brandLine + ' 12%, ' + brandLine + ' 88%, transparent 100%);box-shadow:0 4px 14px ' + hexToRgba(brandLine, 0.35) + ';opacity:0.95"></div>' +
          '</div>'
        : '<div style="margin:10px auto 0;width:40px;height:2px;border-radius:999px;background:' + brandLine + ';opacity:0.45"></div>')) +
    '</div>' +
    // TITLE (empuja hacia abajo si hay logo)
    '<div data-fit="title" style="position:absolute;left:' + geo.title.x + 'px;top:' + titleTop + 'px;width:' + geo.title.width + 'px;height:' + titleHeight + 'px;overflow:hidden;display:flex;align-items:flex-end;justify-content:center">' +
    '<div style="width:100%;max-width:860px;font-family:Poppins,sans-serif;font-weight:800;line-height:0.98;letter-spacing:-0.025em;color:' + INK + ';text-align:center;white-space:pre-line">' + esc(titleText) + '</div></div>' +
    // HOOK
    '<div data-fit="hook" style="position:absolute;left:140px;top:' + hookTop + 'px;width:800px;height:40px;overflow:hidden;display:flex;align-items:center;justify-content:center">' +
    '<div style="width:100%;font-family:Poppins,sans-serif;font-weight:500;line-height:1.2;letter-spacing:0.02em;color:rgba(37,37,37,0.62);text-align:center">' +
    esc(hookText) +
    '</div></div>' +
    // HALO
    '<div style="position:absolute;left:' + haloLeft + 'px;top:' + haloTop + 'px;width:' + haloSize + 'px;height:' + haloSize + 'px;background:radial-gradient(circle, ' + hexToRgba(accent, 0.16) + ' 0%, ' + hexToRgba(accent, 0.05) + ' 42%, transparent 68%);pointer-events:none;z-index:1"></div>' +
    // Sombra de contacto (sin pedestal)
    '<div style="position:absolute;left:' + (layout.visibleCenterX - layout.visibleWidth * 0.42) + 'px;top:' + (layout.pedestalSurface - 6) + 'px;width:' + (layout.visibleWidth * 0.84) + 'px;height:28px;border-radius:50%;background:radial-gradient(ellipse, rgba(40,25,20,0.22) 0%, transparent 72%);z-index:2"></div>' +
    // PRODUCT
    '<div style="position:absolute;left:' + layout.left + 'px;top:' + layout.top + 'px;width:' + layout.width + 'px;height:' + layout.height + 'px;z-index:3">' +
    (!productMissing
      ? '<img src="' + esc(prodSrc) + '" alt="" style="width:' + layout.width + 'px;height:' + layout.height + 'px;object-fit:contain;object-position:bottom center;filter:contrast(1.06) saturate(1.05) drop-shadow(0 5px 7px rgba(40,25,20,0.28)) drop-shadow(0 26px 42px rgba(40,25,20,0.14))">'
      : '<div style="position:absolute;left:50%;bottom:0;transform:translateX(-50%);width:360px;height:420px;border:3px dashed rgba(37,37,37,0.28);border-radius:36px;display:flex;align-items:center;justify-content:center;text-align:center;padding:24px;color:rgba(37,37,37,0.5);font-weight:500;font-size:26px;line-height:1.3">Falta el PNG del producto</div>') +
    '</div>' +
    lowerHtml +
    footerHtml +
    guides +
    '</div>';

  const canvas = host.querySelector('#story-canvas');
  const titleFit = fitBox(host.querySelector('[data-fit="title"]'), data.titleSize, LIMITS.titleSize.min, autoFit);
  const hookFit = fitBox(host.querySelector('[data-fit="hook"]'), Math.min(data.bodySize + 2, 28), 16, autoFit);
  const fitA = fitBox(host.querySelector('[data-fit="a"]'), Math.min(data.bodySize + 2, 30), 16, autoFit && phrases.length > 0);
  const descEl = host.querySelector('[data-fit="desc"]');
  const fitDesc = descEl ? fitBox(descEl, Math.min(Math.max(data.bodySize + 2, 28), 34), 18, autoFit) : { size: data.bodySize, overflow: false };
  const fitB = fitBox(host.querySelector('[data-fit="b"]'), Math.min(data.bodySize + 4, 28), 16, autoFit && !!sizeLabel);

  if (highlight && titleFit.overflow) host.querySelector('[data-fit="title"]').style.outline = '1px dashed rgba(220,38,38,0.9)';
  if (highlight && hookFit.overflow) host.querySelector('[data-fit="hook"]').style.outline = '1px dashed rgba(220,38,38,0.9)';
  if (highlight && fitA.overflow && phrases.length) host.querySelector('[data-fit="a"]').style.outline = '1px dashed rgba(220,38,38,0.9)';
  if (highlight && fitDesc.overflow) descEl.style.outline = '1px dashed rgba(220,38,38,0.9)';
  if (highlight && fitB.overflow && sizeLabel) host.querySelector('[data-fit="b"]').style.outline = '1px dashed rgba(220,38,38,0.9)';
  canvas.setAttribute('data-story-ready', 'true');

  return {
    ready: true,
    title: titleFit,
    hook: hookFit,
    blockA: fitA,
    blockB: fitB,
    description: fitDesc,
    productNatural: product.natural,
    productRenderedHeight: renderedHeight,
    productVisibleHeight: layout.visibleHeight,
    productUpscale: productUpscale,
    productMissing: productMissing,
    backgroundMissing: backgroundMissing,
    productTop: layout.top,
    productBottom: layout.top + layout.height,
    productLayout: layout,
    productInvadesTopSafeZone: layout.top < SAFE.areaTop,
    productInvadesBottomSafeZone: (layout.top + layout.height) > SAFE.areaBottom || (footerTop + footerH) > SAFE.areaBottom,
    benefitsCount: phrases.length,
  };
}
