export const CANVAS = { width: 1080, height: 1920 };
export const SAFE = { top: 250, bottom: 340, areaTop: 250, areaBottom: 1920 - 340 };
export const INK = '#2B2B2B';
export const SHELF = { width: 780, height: 240, surfaceOffset: 48, visibleBottom: 160 };
export const GRADIENT = 'gradient';
export const LIMITS = {
  productScale: { min: 0.4, max: 1.6, step: 0.01 },
  productOffsetY: { min: -260, max: 260, step: 1 },
  titleSize: { min: 40, max: 120, step: 1 },
  bodySize: { min: 20, max: 56, step: 1 },
};

export const DEFAULT_STORY = {
  titulo: 'Titulo de la pieza',
  textoA: 'Texto de apoyo izquierdo.',
  textoB: 'Texto de apoyo derecho.',
  productImage: '',
  background: GRADIENT,
  textLayout: 'two-col',
  productScale: 1,
  productOffsetY: 0,
  titleSize: 78,
  bodySize: 34,
  accentColor: '#2B2B2B',
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
    productImage: typeof input.productImage === 'string' ? input.productImage : '',
    background: typeof input.background === 'string' ? input.background : GRADIENT,
    textLayout: input.textLayout === 'stacked' ? 'stacked' : 'two-col',
    productScale: clamp(Number(input.productScale) || 1, LIMITS.productScale.min, LIMITS.productScale.max),
    productOffsetY: clamp(Number(input.productOffsetY) || 0, LIMITS.productOffsetY.min, LIMITS.productOffsetY.max),
    titleSize: clamp(Number(input.titleSize) || 78, LIMITS.titleSize.min, LIMITS.titleSize.max),
    bodySize: clamp(Number(input.bodySize) || 34, LIMITS.bodySize.min, LIMITS.bodySize.max),
    accentColor: typeof input.accentColor === 'string' ? input.accentColor : '#2B2B2B',
    originalImage: typeof input.originalImage === 'string' ? input.originalImage : '',
    notes: typeof input.notes === 'string' ? input.notes : '',
  };
}

export function getGeometry(textLayout) {
  const TITLE = { x: 80, y: 288, width: 920, height: 252 };
  if (textLayout === 'stacked') {
    const textTop = 1176;
    return {
      title: TITLE,
      shelfSurfaceY: 1000,
      product: { width: 820, baseHeight: 540 },
      arrowSize: { width: 112, height: 120 },
      blocks: [
        { key: 'A', x: 220, y: textTop, width: 700, height: 186, align: 'left', arrow: { x: 88, y: textTop + 20, flip: false, variant: 'diagonal' } },
        { key: 'B', x: 160, y: textTop + 186 + 32, width: 700, height: 186, align: 'right', arrow: { x: 880, y: textTop + 186 + 32 + 20, flip: true, variant: 'diagonal' } },
      ],
    };
  }
  const textTop = 1374;
  return {
    title: TITLE,
    shelfSurfaceY: 1100,
    product: { width: 820, baseHeight: 560 },
    arrowSize: { width: 104, height: 108 },
    blocks: [
      { key: 'A', x: 68, y: textTop, width: 452, height: SAFE.areaBottom - textTop, align: 'left', arrow: { x: 146, y: 1262, flip: false, variant: 'up' } },
      { key: 'B', x: 560, y: textTop, width: 452, height: SAFE.areaBottom - textTop, align: 'right', arrow: { x: 830, y: 1262, flip: true, variant: 'up' } },
    ],
  };
}

function shelfSvg(showShadow) {
  const uid = 's' + Math.random().toString(36).slice(2, 8);
  return (
    '<svg width="' + SHELF.width + '" height="' + SHELF.height + '" viewBox="0 0 ' + SHELF.width + ' ' + SHELF.height + '" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
    '<defs><linearGradient id="b' + uid + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset="0.55" stop-color="#FBFCFA"/><stop offset="1" stop-color="#E4EADF"/></linearGradient>' +
    '<radialGradient id="r' + uid + '" cx="0.5" cy="0.32" r="0.75"><stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#F1F4EE"/></radialGradient>' +
    '<filter id="d' + uid + '" x="-25%" y="-25%" width="150%" height="180%"><feDropShadow dx="0" dy="16" stdDeviation="17" flood-color="#223D26" flood-opacity="0.22"/></filter>' +
    '<filter id="c' + uid + '" x="-60%" y="-260%" width="220%" height="620%"><feGaussianBlur stdDeviation="13"/></filter></defs>' +
    '<g filter="url(#d' + uid + ')">' +
    '<path d="M120 ' + SHELF.surfaceOffset + ' H660 V96 A62 62 0 0 1 598 ' + SHELF.visibleBottom + ' H182 A62 62 0 0 1 120 96 Z" fill="url(#b' + uid + ')"/>' +
    '<ellipse cx="390" cy="' + SHELF.surfaceOffset + '" rx="300" ry="40" fill="url(#r' + uid + ')"/>' +
    '<ellipse cx="390" cy="' + (SHELF.surfaceOffset + 2) + '" rx="300" ry="40" fill="none" stroke="#C9D3C4" stroke-opacity="0.35" stroke-width="1.5"/>' +
    '</g>' +
    (showShadow ? '<ellipse cx="390" cy="' + (SHELF.surfaceOffset - 4) + '" rx="236" ry="25" fill="#2C4630" opacity="0.2" filter="url(#c' + uid + ')"/>' : '') +
    '</svg>'
  );
}

function arrowSvg(width, height, color, variant, flip) {
  const paths = {
    up: { curve: 'M22 122 C 28 82, 46 46, 92 30', x: 95, y: 29, angle: -18 },
    diagonal: { curve: 'M12 118 C 34 100, 44 58, 88 26', x: 91, y: 24, angle: -36 },
  };
  const p = paths[variant] || paths.up;
  return (
    '<svg width="' + width + '" height="' + height + '" viewBox="0 0 120 130" fill="none" xmlns="http://www.w3.org/2000/svg" style="opacity:0.85;overflow:visible">' +
    '<g' + (flip ? ' transform="translate(120 0) scale(-1 1)"' : '') + '>' +
    '<path d="' + p.curve + '" stroke="' + color + '" stroke-width="7" stroke-linecap="round" stroke-dasharray="0.5 21" fill="none"/>' +
    '<path d="M0 0 L-27 -12 L-27 12 Z" fill="' + color + '" transform="translate(' + p.x + ' ' + p.y + ') rotate(' + p.angle + ')"/>' +
    '</g></svg>'
  );
}

function leafPattern() {
  const uid = 'l' + Math.random().toString(36).slice(2, 8);
  return (
    '<svg width="' + CANVAS.width + '" height="' + CANVAS.height + '" viewBox="0 0 ' + CANVAS.width + ' ' + CANVAS.height + '" xmlns="http://www.w3.org/2000/svg" style="position:absolute;inset:0;opacity:0.55" aria-hidden="true">' +
    '<defs><linearGradient id="g' + uid + '" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4E8B4A" stop-opacity="0.34"/><stop offset="1" stop-color="#7CBE6C" stop-opacity="0.18"/></linearGradient>' +
    '<pattern id="p' + uid + '" width="360" height="360" patternUnits="userSpaceOnUse" patternTransform="rotate(-12)">' +
    '<g fill="url(#g' + uid + ')"><path d="M40 30 C 130 30, 180 90, 180 170 C 100 170, 40 118, 40 30 Z"/>' +
    '<path d="M40 30 C 40 118, 100 170, 180 170" fill="none" stroke="#3F7A3C" stroke-opacity="0.16" stroke-width="3"/>' +
    '<path d="M300 200 C 240 210, 205 260, 214 330 C 286 322, 314 268, 300 200 Z"/>' +
    '<path d="M120 250 C 60 262, 30 306, 44 356 C 108 346, 134 300, 120 250 Z" opacity="0.7"/>' +
    '<path d="M240 60 C 300 44, 348 76, 352 138 C 288 148, 244 118, 240 60 Z" opacity="0.85"/></g></pattern></defs>' +
    '<rect width="' + CANVAS.width + '" height="' + CANVAS.height + '" fill="url(#p' + uid + ')"/></svg>'
  );
}

function esc(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function fitBox(box, requested, min, autoFit) {
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
    if (!src) return resolve({ ready: true, error: false });
    const img = new Image();
    img.onload = function () {
      const done = function () {
        resolve({ ready: true, error: false, natural: { width: img.naturalWidth, height: img.naturalHeight } });
      };
      if (img.decode) img.decode().then(done, done);
      else done();
    };
    img.onerror = function () { resolve({ ready: true, error: true }); };
    img.src = src;
  });
}

export async function ensureFonts() {
  if (!document.fonts) return;
  await Promise.all([
    document.fonts.load('800 78px Poppins').catch(function () {}),
    document.fonts.load('500 34px Poppins').catch(function () {}),
    document.fonts.load('400 34px Poppins').catch(function () {}),
  ]);
  await document.fonts.ready;
}

export async function renderStory(host, data, options) {
  options = options || {};
  const autoFit = options.autoFit !== false;
  const showGuides = !!options.showGuides;
  const highlight = !!options.highlightOverflow;
  const rev = options.assetRevision || 0;
  const bust = function (src) { return rev ? src.split('?')[0] + '?v=' + rev : src; };

  const geo = getGeometry(data.textLayout);
  const usesPhoto = data.background !== GRADIENT && data.background.trim() !== '';
  const bgSrc = usesPhoto ? bust(data.background) : '';
  const prodSrc = data.productImage ? bust(data.productImage) : '';

  const bg = await waitImage(bgSrc || undefined);
  const product = await waitImage(prodSrc || undefined);
  await ensureFonts();

  const productBoxHeight = geo.product.baseHeight * data.productScale;
  const productBoxWidth = geo.product.width;
  const productTop = geo.shelfSurfaceY + 8 - productBoxHeight + data.productOffsetY;
  const productMissing = !data.productImage || product.error;
  const backgroundMissing = usesPhoto && bg.error;
  const showLeaf = !usesPhoto || bg.error;
  const renderedHeight = product.natural
    ? Math.min(productBoxHeight, (productBoxWidth * product.natural.height) / product.natural.width)
    : productBoxHeight;
  const productUpscale = product.natural ? renderedHeight / product.natural.height : 1;

  const guides = showGuides
    ? '<div data-guides="true" style="position:absolute;inset:0;pointer-events:none">' +
      '<div style="position:absolute;left:0;top:0;width:' + CANVAS.width + 'px;height:' + SAFE.top + 'px;background:repeating-linear-gradient(45deg,rgba(236,72,153,0.12) 0 22px,rgba(236,72,153,0.04) 22px 44px);border-bottom:3px dashed rgba(236,72,153,0.8)"></div>' +
      '<div style="position:absolute;left:24px;top:' + (SAFE.top - 42) + 'px;font-weight:600;font-size:26px;color:rgba(190,24,93,0.85)">zona insegura superior · 250px</div>' +
      '<div style="position:absolute;left:0;top:' + SAFE.areaBottom + 'px;width:' + CANVAS.width + 'px;height:' + SAFE.bottom + 'px;background:repeating-linear-gradient(45deg,rgba(236,72,153,0.12) 0 22px,rgba(236,72,153,0.04) 22px 44px);border-top:3px dashed rgba(236,72,153,0.8)"></div>' +
      '<div style="position:absolute;left:24px;top:' + (SAFE.areaBottom + 12) + 'px;font-weight:600;font-size:26px;color:rgba(190,24,93,0.85)">zona insegura inferior · 340px</div>' +
      '<div style="position:absolute;left:' + (CANVAS.width / 2) + 'px;top:0;width:1px;height:' + CANVAS.height + 'px;background:rgba(59,130,246,0.35)"></div></div>'
    : '';

  const arrows = geo.blocks.map(function (block) {
    return '<div style="position:absolute;left:' + block.arrow.x + 'px;top:' + block.arrow.y + 'px">' +
      arrowSvg(geo.arrowSize.width, geo.arrowSize.height, data.accentColor, block.arrow.variant, block.arrow.flip) +
      '</div>';
  }).join('');

  host.innerHTML =
    '<div id="story-canvas" data-story-id="' + esc(data.id) + '" data-story-ready="false" style="position:relative;width:' + CANVAS.width + 'px;height:' + CANVAS.height + 'px;overflow:hidden;background:#DDF3D2;isolation:isolate;font-family:Poppins,sans-serif;-webkit-font-smoothing:antialiased">' +
    (usesPhoto && !bg.error
      ? '<img src="' + esc(bgSrc) + '" alt="" width="' + CANVAS.width + '" height="' + CANVAS.height + '" style="position:absolute;inset:0;width:' + CANVAS.width + 'px;height:' + CANVAS.height + 'px;object-fit:cover;object-position:center">'
      : '') +
    (showLeaf
      ? '<div style="position:absolute;inset:0;background:linear-gradient(160deg,#E9F8DF 0%,#C9EDB6 42%,#A9DE95 100%)"></div>' + leafPattern()
      : '') +
    '<div style="position:absolute;inset:0;background:rgba(214,243,203,0.56);mix-blend-mode:lighten"></div>' +
    '<div style="position:absolute;inset:0;background:linear-gradient(180deg,rgba(255,255,255,0.34) 0%,rgba(255,255,255,0.10) 46%,rgba(255,255,255,0.30) 100%)"></div>' +
    '<div style="position:absolute;left:' + ((CANVAS.width - SHELF.width) / 2) + 'px;top:' + (geo.shelfSurfaceY - SHELF.surfaceOffset) + 'px;width:' + SHELF.width + 'px;height:' + SHELF.height + 'px">' +
    shelfSvg(!productMissing) + '</div>' +
    '<div style="position:absolute;left:' + ((CANVAS.width - productBoxWidth) / 2) + 'px;top:' + productTop + 'px;width:' + productBoxWidth + 'px;height:' + productBoxHeight + 'px">' +
    (!productMissing
      ? '<img src="' + esc(prodSrc) + '" alt="" style="width:' + productBoxWidth + 'px;height:' + productBoxHeight + 'px;object-fit:contain;object-position:bottom center;filter:drop-shadow(0 20px 26px rgba(28,58,32,0.20))">'
      : '<div style="position:absolute;left:' + (productBoxWidth / 2 - 190) + 'px;bottom:0;width:380px;height:' + Math.max(160, productBoxHeight - 40) + 'px;border:4px dashed rgba(43,43,43,0.35);border-radius:40px;display:flex;align-items:center;justify-content:center;text-align:center;padding:24px;color:rgba(43,43,43,0.55);font-weight:500;font-size:28px;line-height:1.3">Falta el PNG del producto</div>') +
    '</div>' +
    '<div data-fit="title" style="position:absolute;left:' + geo.title.x + 'px;top:' + geo.title.y + 'px;width:' + geo.title.width + 'px;height:' + geo.title.height + 'px;overflow:hidden;display:flex;align-items:flex-start;justify-content:center;text-shadow:0 2px 18px rgba(255,255,255,0.35)">' +
    '<div style="width:100%;font-family:Poppins,sans-serif;font-weight:800;line-height:1.08;letter-spacing:-0.015em;color:' + INK + ';text-align:center;white-space:pre-line">' + esc(data.titulo) + '</div></div>' +
    arrows +
    '<div data-fit="a" style="position:absolute;left:' + geo.blocks[0].x + 'px;top:' + geo.blocks[0].y + 'px;width:' + geo.blocks[0].width + 'px;height:' + geo.blocks[0].height + 'px;overflow:hidden;display:flex;align-items:flex-start;justify-content:' + (geo.blocks[0].align === 'right' ? 'flex-end' : 'flex-start') + '">' +
    '<div style="width:100%;font-family:Poppins,sans-serif;font-weight:500;line-height:1.38;color:' + INK + ';text-align:' + geo.blocks[0].align + ';white-space:pre-line">' + esc(data.textoA) + '</div></div>' +
    '<div data-fit="b" style="position:absolute;left:' + geo.blocks[1].x + 'px;top:' + geo.blocks[1].y + 'px;width:' + geo.blocks[1].width + 'px;height:' + geo.blocks[1].height + 'px;overflow:hidden;display:flex;align-items:flex-start;justify-content:' + (geo.blocks[1].align === 'right' ? 'flex-end' : 'flex-start') + '">' +
    '<div style="width:100%;font-family:Poppins,sans-serif;font-weight:500;line-height:1.38;color:' + INK + ';text-align:' + geo.blocks[1].align + ';white-space:pre-line">' + esc(data.textoB) + '</div></div>' +
    guides +
    '</div>';

  const canvas = host.querySelector('#story-canvas');
  const titleFit = fitBox(host.querySelector('[data-fit="title"]'), data.titleSize, 40, autoFit);
  const fitA = fitBox(host.querySelector('[data-fit="a"]'), data.bodySize, 20, autoFit);
  const fitB = fitBox(host.querySelector('[data-fit="b"]'), data.bodySize, 20, autoFit);
  if (highlight && titleFit.overflow) host.querySelector('[data-fit="title"]').style.outline = '1px dashed rgba(220,38,38,0.9)';
  if (highlight && fitA.overflow) host.querySelector('[data-fit="a"]').style.outline = '1px dashed rgba(220,38,38,0.9)';
  if (highlight && fitB.overflow) host.querySelector('[data-fit="b"]').style.outline = '1px dashed rgba(220,38,38,0.9)';
  canvas.setAttribute('data-story-ready', 'true');

  return {
    ready: true,
    title: titleFit,
    blockA: fitA,
    blockB: fitB,
    productNatural: product.natural,
    productRenderedHeight: renderedHeight,
    productUpscale: productUpscale,
    productMissing: productMissing,
    backgroundMissing: backgroundMissing,
    productTop: productTop,
    productInvadesTopSafeZone: productTop < SAFE.areaTop,
  };
}
