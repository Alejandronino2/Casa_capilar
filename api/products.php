<?php
require __DIR__ . '/helpers.php';

$file = root_dir() . '/content/products.json';

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
  if (!is_file($file)) {
    json_out(200, array());
  }
  header('Content-Type: application/json; charset=utf-8');
  header('Cache-Control: no-store');
  readfile($file);
  exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'PUT' || $_SERVER['REQUEST_METHOD'] === 'POST') {
  $parsed = read_json_body();
  if (!is_array($parsed) || (count($parsed) > 0 && !isset($parsed[0]))) {
    json_out(400, array('ok' => false, 'error' => 'Se esperaba un array de piezas'));
  }
  $ids = array();
  foreach ($parsed as $entry) {
    $id = isset($entry['id']) ? $entry['id'] : '';
    if (!valid_id($id)) {
      json_out(400, array('ok' => false, 'error' => 'id invalido: ' . $id));
    }
    if (in_array($id, $ids, true)) {
      json_out(400, array('ok' => false, 'error' => 'ids duplicados: ' . $id));
    }
    $ids[] = $id;
  }
  $dir = dirname($file);
  if (!is_dir($dir) && !mkdir($dir, 0755, true)) {
    json_out(500, array('ok' => false, 'error' => 'No se pudo crear content/'));
  }
  $ok = file_put_contents($file, json_encode($parsed, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) . "\n");
  if ($ok === false) {
    json_out(500, array('ok' => false, 'error' => 'No se pudo escribir content/products.json. Revisa permisos (755/775).'));
  }
  json_out(200, array('ok' => true, 'count' => count($parsed), 'path' => 'content/products.json'));
}

json_out(405, array('ok' => false, 'error' => 'Metodo no permitido'));
