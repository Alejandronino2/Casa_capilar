<!doctype html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Casa Capilar Stories</title>
  <link rel="icon" href="favicon.ico" type="image/x-icon">
  <link rel="icon" href="favicon.png" type="image/png" sizes="180x180">
  <link rel="apple-touch-icon" href="favicon.png">
  <?php
    $cssV = @filemtime(__DIR__ . '/css/app.css') ?: time();
    $jsV = @filemtime(__DIR__ . '/js/editor.js') ?: time();
  ?>
  <link rel="stylesheet" href="css/app.css?v=<?= (int) $cssV ?>">
</head>
<body>
<div class="app">
  <header class="header">
    <h1>Casa Capilar <span>Stories 1080×1920</span></h1>
    <div class="toggles">
      <label><input type="checkbox" id="chkGuides" checked> Guias de zona segura</label>
      <label><input type="checkbox" id="chkFit" checked> Auto-ajuste de fuente</label>
      <label><input type="checkbox" id="chkCompare"> Comparar original</label>
    </div>
    <div class="zooms">
      <button type="button" data-zoom="fit" class="active">Ajustar</button>
      <button type="button" data-zoom="0.25">25%</button>
      <button type="button" data-zoom="0.5">50%</button>
      <button type="button" data-zoom="1">100%</button>
    </div>
    <div class="header-actions">
      <span id="saveNote" class="note"></span>
      <button type="button" class="btn" id="undoBtn" disabled title="Volver al ultimo guardado">Deshacer</button>
      <button type="button" class="btn btn-primary" id="downloadBtn" disabled>Descargar (0)</button>
      <a class="btn" href="extract.php">Recortar producto</a>
      <button type="button" class="btn btn-primary" id="saveBtn" disabled>Guardado</button>
    </div>
  </header>

  <main class="main">
    <aside class="aside aside-left">
      <div class="aside-head">
        <label style="display:flex;align-items:center;gap:8px">
          <input type="checkbox" id="checkAll">
          <h2 id="listTitle">Piezas</h2>
        </label>
        <button type="button" class="btn" id="btnNew">+ Nueva</button>
        <button type="button" class="btn" id="btnNewFolder" title="Nueva carpeta">+ Carpeta</button>
      </div>
      <div class="list-tabs">
        <button type="button" class="tab active" id="tabActive" data-view="active">Piezas</button>
        <button type="button" class="tab" id="tabTrash" data-view="trash">Borrados <span id="trashCount">0</span></button>
      </div>
      <div class="bulk-bar" id="bulkBar">
        <button type="button" class="btn btn-danger" id="btnTrashChecked" disabled>A borrados (0)</button>
        <button type="button" class="btn hidden" id="btnRestoreChecked" disabled>Restaurar (0)</button>
        <button type="button" class="btn btn-danger hidden" id="btnPurgeChecked" disabled>Eliminar (0)</button>
        <select id="bulkFolder" class="bulk-folder" title="Mover marcadas a carpeta">
          <option value="">Mover a…</option>
        </select>
      </div>
      <ul class="list" id="storyList"></ul>
    </aside>

    <section class="stage-wrap">
      <div class="stage-row one" id="stageRow">
        <div class="compare hidden" id="compare">
          <header>
            <h2>Original 16:9</h2>
            <button type="button" class="btn" id="btnOriginal">Cargar</button>
          </header>
          <input type="file" id="fileOriginal" accept="image/*" class="hidden">
          <div class="body">
            <img id="compareImg" alt="Original" class="hidden">
            <p id="compareEmpty" class="help">Arrastra aqui la pieza horizontal original.</p>
          </div>
        </div>
        <div class="stage" id="stage">
          <div class="stage-frame" id="stageFrame">
            <div id="previewHost"></div>
          </div>
          <span class="stage-badge" id="stageBadge">1080 × 1920</span>
        </div>
      </div>
      <div class="warn-box" id="warnings"></div>
    </section>

    <aside class="aside aside-right">
      <form class="form" onsubmit="return false">
        <section class="panel">
          <h2>Contenido</h2>
          <div class="body">
            <label class="field"><span class="lbl">id <span class="hint">minusculas</span></span><input type="text" id="f-id"></label>
            <label class="field"><span class="lbl">Carpeta / marca</span>
              <select id="f-folder"></select>
            </label>
            <label class="field"><span class="lbl">Titulo <span class="hint">2 lineas</span></span><textarea id="f-titulo" rows="2"></textarea></label>
            <label class="field"><span class="lbl">Hook <span class="hint">frase comercial bajo el titulo</span></span><input type="text" id="f-hook" placeholder="Nutrición + brillo para tu cabello"></label>
            <label class="field"><span class="lbl">Texto A <span class="hint">venta / beneficio</span></span><textarea id="f-textoA" rows="4"></textarea></label>
            <label class="field"><span class="lbl">Texto B <span class="hint">tamanos</span></span><textarea id="f-textoB" rows="3"></textarea></label>
            <label class="field"><span class="lbl">CTA <span class="hint">vacio = sin boton</span></span><input type="text" id="f-cta" placeholder="COMPRAR →"></label>
            <div class="row">
              <button type="button" class="btn btn-primary" id="btnAi">Completar con IA</button>
              <button type="button" class="btn" id="btnAiChecked" disabled>IA en marcadas</button>
            </div>
            <label class="ai-photo"><input type="checkbox" id="chkAiTitle" checked> También ajustar título</label>
            <label class="ai-photo"><input type="checkbox" id="chkAiPhoto" checked> Leer foto del envase (titulo real)</label>
            <p class="help" id="aiHelp">La IA lee la foto del producto para poner un titulo real + texto de venta.</p>
            <label class="field"><span class="lbl">Notas</span><input type="text" id="f-notes"></label>
          </div>
        </section>
        <section class="panel">
          <h2>Assets</h2>
          <div class="body">
            <label class="field"><span class="lbl">PNG del producto</span><input type="text" id="f-product"></label>
            <div class="drop" id="dropProduct">
              <input type="file" id="fileProduct" accept="image/*" class="hidden">
              <div class="row">
                <button type="button" class="btn btn-primary" id="btnBrowse">Buscar imagen</button>
                <button type="button" class="btn" id="btnUsePng">Usar id.png</button>
                <button type="button" class="btn" id="btnReprocessPng" title="Quita el fondo de la imagen actual del campo PNG">Procesar / quitar fondo</button>
              </div>
              <p class="help">Busca o arrastra cualquier foto, o pega una ruta en PNG del producto y pulsa «Procesar / quitar fondo». Se guarda en assets/products/.</p>
            </div>
            <label class="field"><span class="lbl">Fondo</span><input type="text" id="f-bg"></label>
            <div class="row">
              <button type="button" class="btn" id="btnGradient">Fondo CSS</button>
              <button type="button" class="btn" id="btnLeaves">Foto hojas</button>
            </div>
            <div class="brand-grid" id="brandBgGrid" aria-label="Fondos de marca"></div>
            <p class="help">Clic en un fondo: aplica a la pieza actual, o a todas las marcadas si hay checks. Clic en el nombre de una carpeta: aplica el fondo de esa marca a toda la carpeta.</p>
            <label class="field"><span class="lbl">Original 16:9</span><input type="text" id="f-original"></label>
          </div>
        </section>
        <section class="panel">
          <h2>Maquetacion</h2>
          <div class="body">
            <label class="field"><span class="lbl">textLayout</span>
              <select id="f-layout">
                <option value="two-col">two-col · dos columnas</option>
                <option value="stacked">stacked · uno sobre otro</option>
              </select>
            </label>
            <label class="field"><span class="lbl">Producto · tamaño <span class="hint" id="f-scale-val">1.40×</span></span>
              <input type="range" id="f-scale" min="0.4" max="2.2" step="0.01" value="1.4"></label>
            <label class="field"><span class="lbl">Producto · horizontal <span class="hint" id="f-offx-val">0px</span></span>
              <input type="range" id="f-offx" min="-280" max="280" step="1" value="0"></label>
            <label class="field"><span class="lbl">Producto · vertical <span class="hint" id="f-off-val">0px</span></span>
              <input type="range" id="f-off" min="-260" max="260" step="1" value="0"></label>
            <label class="field"><span class="lbl">Beneficios/texto · vertical <span class="hint" id="f-text-offy-val">0px</span></span>
              <input type="range" id="f-text-offy" min="-220" max="220" step="1" value="0"></label>
            <label class="field"><span class="lbl">Beneficios/texto · horizontal <span class="hint" id="f-text-offx-val">0px</span></span>
              <input type="range" id="f-text-offx" min="-120" max="120" step="1" value="0"></label>
            <label class="field"><span class="lbl">Titulo · tamaño <span class="hint" id="f-title-val">72px</span></span>
              <input type="range" id="f-title" min="36" max="120" step="1" value="72"></label>
            <label class="field"><span class="lbl">Cuerpo · tamaño <span class="hint" id="f-body-val">26px</span></span>
              <input type="range" id="f-body" min="18" max="56" step="1" value="26"></label>
            <label class="field"><span class="lbl">accentColor</span>
              <div class="row">
                <input type="color" id="f-accent" value="#F27F83">
                <input type="text" id="f-accent-txt" value="#F27F83">
              </div>
            </label>
          </div>
        </section>
      </form>
    </aside>
  </main>
</div>
<div id="exportHost" aria-hidden="true"></div>
<script type="module" src="js/editor.js?v=<?= (int) $jsV ?>"></script>
</body>
</html>
