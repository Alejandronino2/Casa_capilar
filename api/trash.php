<?php
require __DIR__ . '/helpers.php';

function products_file() {
  return root_dir() . '/content/products.json';
}

function trash_file() {
  return root_dir() . '/content/trash.json';
}

function read_json_array($path) {
  if (!is_file($path)) return array();
  $raw = file_get_contents($path);
  if ($raw === false || trim($raw) === '') return array();
  $parsed = json_decode($raw, true);
  return is_array($parsed) ? $parsed : array();
}

function write_json_array($path, $data) {
  $dir = dirname($path);
  if (!is_dir($dir) && !mkdir($dir, 0755, true)) {
    json_out(500, array('ok' => false, 'error' => 'No se pudo crear ' . basename($dir) . '/'));
  }
  $ok = file_put_contents($path, json_encode(array_values($data), JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) . "\n");
  if ($ok === false) {
    json_out(500, array('ok' => false, 'error' => 'No se pudo escribir ' . basename($path)));
  }
}

function index_by_id($items) {
  $map = array();
  foreach ($items as $item) {
    if (!isset($item['id'])) continue;
    $map[$item['id']] = $item;
  }
  return $map;
}

function safe_asset_path($rel) {
  $rel = str_replace('\\', '/', (string) $rel);
  if ($rel === '' || strpos($rel, '..') !== false) return null;
  if (!preg_match('#^assets/(products|originals)/[A-Za-z0-9._-]+$#', $rel)) return null;
  return root_dir() . '/' . $rel;
}

function purge_assets($story) {
  $removed = array();
  $candidates = array();
  if (!empty($story['productImage'])) $candidates[] = $story['productImage'];
  if (!empty($story['originalImage'])) $candidates[] = $story['originalImage'];
  $id = isset($story['id']) ? $story['id'] : '';
  if (valid_id($id)) {
    $candidates[] = 'assets/products/' . $id . '.png';
    $candidates[] = 'assets/originals/' . $id . '.jpg';
    $candidates[] = 'assets/originals/' . $id . '.png';
  }
  $seen = array();
  foreach ($candidates as $rel) {
    $full = safe_asset_path($rel);
    if (!$full || isset($seen[$full])) continue;
    $seen[$full] = true;
    if (is_file($full) && @unlink($full)) $removed[] = $rel;
  }
  return $removed;
}

function unique_restore_id($id, $taken) {
  if (!isset($taken[$id])) return $id;
  $n = 2;
  while (isset($taken[$id . '-' . $n])) $n += 1;
  return $id . '-' . $n;
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
  json_out(200, array(
    'ok' => true,
    'items' => read_json_array(trash_file()),
  ));
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  json_out(405, array('ok' => false, 'error' => 'Metodo no permitido'));
}

$body = read_json_body();
$action = isset($body['action']) ? $body['action'] : '';
$ids = isset($body['ids']) && is_array($body['ids']) ? $body['ids'] : array();
$ids = array_values(array_filter($ids, 'valid_id'));
if (!$ids && $action !== 'list') {
  json_out(400, array('ok' => false, 'error' => 'Faltan ids'));
}

$products = read_json_array(products_file());
$trash = read_json_array(trash_file());

if ($action === 'trash') {
  if (isset($body['stories']) && is_array($body['stories'])) {
    $products = $body['stories'];
  }
  $want = array_flip($ids);
  $moved = array();
  $keep = array();
  foreach ($products as $story) {
    $id = isset($story['id']) ? $story['id'] : '';
    if (isset($want[$id])) {
      $story['deletedAt'] = date('c');
      $moved[] = $story;
    } else {
      $keep[] = $story;
    }
  }
  if (!$moved) {
    json_out(404, array('ok' => false, 'error' => 'No se encontraron piezas para borrar'));
  }
  $trashMap = index_by_id($trash);
  foreach ($moved as $item) {
    $trashMap[$item['id']] = $item;
  }
  write_json_array(products_file(), $keep);
  write_json_array(trash_file(), array_values($trashMap));
  json_out(200, array(
    'ok' => true,
    'action' => 'trash',
    'moved' => count($moved),
    'stories' => $keep,
    'trash' => array_values($trashMap),
  ));
}

if ($action === 'restore') {
  $trashMap = index_by_id($trash);
  $productMap = index_by_id($products);
  $restored = array();
  foreach ($ids as $id) {
    if (!isset($trashMap[$id])) continue;
    $item = $trashMap[$id];
    unset($item['deletedAt']);
    $newId = unique_restore_id($item['id'], $productMap);
    if ($newId !== $item['id']) $item['id'] = $newId;
    $productMap[$item['id']] = $item;
    $products[] = $item;
    unset($trashMap[$id]);
    $restored[] = $item['id'];
  }
  if (!$restored) {
    json_out(404, array('ok' => false, 'error' => 'No se encontraron piezas en borrados'));
  }
  write_json_array(products_file(), array_values($productMap));
  write_json_array(trash_file(), array_values($trashMap));
  json_out(200, array(
    'ok' => true,
    'action' => 'restore',
    'restored' => $restored,
    'stories' => array_values($productMap),
    'trash' => array_values($trashMap),
  ));
}

if ($action === 'purge') {
  $trashMap = index_by_id($trash);
  $purged = array();
  $files = array();
  foreach ($ids as $id) {
    if (!isset($trashMap[$id])) continue;
    $files = array_merge($files, purge_assets($trashMap[$id]));
    unset($trashMap[$id]);
    $purged[] = $id;
  }
  if (!$purged) {
    json_out(404, array('ok' => false, 'error' => 'No se encontraron piezas en borrados'));
  }
  write_json_array(trash_file(), array_values($trashMap));
  json_out(200, array(
    'ok' => true,
    'action' => 'purge',
    'purged' => $purged,
    'filesRemoved' => array_values(array_unique($files)),
    'trash' => array_values($trashMap),
  ));
}

json_out(400, array('ok' => false, 'error' => 'Accion invalida. Usa trash, restore o purge.'));
