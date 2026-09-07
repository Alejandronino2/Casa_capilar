<!doctype html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Recorte de producto · Casa Capilar</title>
  <link rel="stylesheet" href="css/app.css">
</head>
<body>
<div class="app">
  <header class="header">
    <h1>Recorte de producto <span>fondo fuera con WASM, en el navegador</span></h1>
    <div class="header-actions">
      <button type="button" class="btn" id="btnAdd">Anadir imagenes</button>
      <button type="button" class="btn btn-primary" id="btnProcess">Procesar todo</button>
      <button type="button" class="btn btn-primary" id="btnToEditor" disabled>Enviar al editor</button>
      <a class="btn" href="index.php">Volver al editor</a>
    </div>
  </header>
  <input type="file" id="fileAdd" accept="image/*" multiple class="hidden">
  <div class="extract-main">
    <section id="zone" style="min-height:0;overflow:auto">
      <div class="extract-drop" id="empty">
        <div>
          <p><strong>Arrastra aqui las piezas originales</strong></p>
          <p class="help">Se quita el fondo en el navegador y el PNG queda listo para assets/products/.</p>
        </div>
      </div>
      <div class="cards" id="cards"></div>
    </section>
    <aside class="aside aside-right">
      <div class="form">
        <section class="panel">
          <h2>Recorte alfa</h2>
          <div class="body">
            <label><input type="checkbox" id="trimOn" checked> Recortar margenes transparentes</label>
            <label class="field"><span class="lbl">umbral alfa <span class="hint" id="trimThV">8</span></span>
              <input type="range" id="trimTh" min="0" max="64" value="8"></label>
            <label class="field"><span class="lbl">margen <span class="hint" id="trimPadV">2px</span></span>
              <input type="range" id="trimPad" min="0" max="40" value="2"></label>
            <button type="button" class="btn" id="btnRetrim">Re-recortar</button>
          </div>
        </section>
        <section class="panel">
          <h2>Lote</h2>
          <div class="body">
            <p id="batchInfo" class="help">0 en cola</p>
            <div class="row">
              <button type="button" class="btn" id="btnDlAll">Descargar todos</button>
              <button type="button" class="btn btn-primary" id="btnSaveAll">Guardar todos</button>
              <button type="button" class="btn btn-primary" id="btnToEditor2" disabled>Enviar al editor</button>
              <button type="button" class="btn btn-danger" id="btnClear">Vaciar cola</button>
            </div>
            <p class="help">«Enviar al editor» quita el fondo si falta, guarda cada PNG y crea una pieza nueva en el editor.</p>
            <p id="sendNote" class="note"></p>
          </div>
        </section>
      </div>
    </aside>
  </div>
</div>
<script type="module" src="js/extract.js"></script>
</body>
</html>
