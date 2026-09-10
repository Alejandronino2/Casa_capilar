<?php
require __DIR__ . '/helpers.php';

function folders_file() {
  return root_dir() . '/content/folders.json';
}

function default_folders() {
  return array(
    array('id' => 'pocion', 'name' => 'Poción', 'locked' => true),
    array('id' => 'click-hair', 'name' => 'Click Hair', 'locked' => true),
    array('id' => 'herbacol', 'name' => 'HERBACOL', 'locked' => true),
    array('id' => 'bell-franz', 'name' => 'Bell Franz', 'locked' => true),
    array('id' => 'anyeluz', 'name' => 'anyeluz', 'locked' => true),
    array('id' => 'origen-botanico', 'name' => 'Origen Botánico', 'locked' => true),
    array('id' => 'sin-carpeta', 'name' => 'Sin carpeta', 'locked' => true),
  );
}

function normalize_folder($raw) {
  $id = isset($raw['id']) ? strtolower(trim((string) $raw['id'])) : '';
  $id = preg_replace('/[^a-z0-9._-]+/', '-', $id);
  $id = trim($id, '-');
  if ($id === '' || !valid_id($id)) return null;
  $name = isset($raw['name']) ? trim((string) $raw['name']) : $id;
  if ($name === '') $name = $id;
  return array(
    'id' => $id,
    'name' => $name,
    'locked' => !empty($raw['locked']),
  );
}

function read_folders() {
  $path = folders_file();
  if (!is_file($path)) {
    $defaults = default_folders();
    write_folders($defaults);
    return $defaults;
  }
  $raw = file_get_contents($path);
  $parsed = json_decode($raw, true);
  if (!is_array($parsed) || !$parsed) {
    $defaults = default_folders();
    write_folders($defaults);
    return $defaults;
  }
  $out = array();
  $seen = array();
  foreach ($parsed as $item) {
    $folder = normalize_folder($item);
    if (!$folder || isset($seen[$folder['id']])) continue;
    $seen[$folder['id']] = true;
    $out[] = $folder;
  }
  foreach (default_folders() as $def) {
    if (!isset($seen[$def['id']])) {
      $out[] = $def;
      $seen[$def['id']] = true;
    }
  }
  return $out;
}

function write_folders($folders) {
  $path = folders_file();
  $dir = dirname($path);
  if (!is_dir($dir) && !mkdir($dir, 0755, true)) {
    json_out(500, array('ok' => false, 'error' => 'No se pudo crear content/'));
  }
  $ok = file_put_contents($path, json_encode(array_values($folders), JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) . "\n");
  if ($ok === false) {
    json_out(500, array('ok' => false, 'error' => 'No se pudo escribir folders.json'));
  }
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
  json_out(200, array('ok' => true, 'folders' => read_folders()));
}

if ($_SERVER['REQUEST_METHOD'] === 'PUT' || $_SERVER['REQUEST_METHOD'] === 'POST') {
  $body = read_json_body();
  $action = isset($body['action']) ? $body['action'] : 'save';
  $folders = read_folders();
  $byId = array();
  foreach ($folders as $f) $byId[$f['id']] = $f;

  if ($action === 'create') {
    $folder = normalize_folder(array(
      'id' => isset($body['id']) ? $body['id'] : (isset($body['name']) ? $body['name'] : ''),
      'name' => isset($body['name']) ? $body['name'] : '',
      'locked' => false,
    ));
    if (!$folder) json_out(400, array('ok' => false, 'error' => 'Nombre de carpeta invalido'));
    if (isset($byId[$folder['id']])) json_out(400, array('ok' => false, 'error' => 'Ya existe esa carpeta'));
    $folders[] = $folder;
    write_folders($folders);
    json_out(200, array('ok' => true, 'folders' => $folders, 'created' => $folder));
  }

  if ($action === 'delete') {
    $id = isset($body['id']) ? $body['id'] : '';
    if (!isset($byId[$id])) json_out(404, array('ok' => false, 'error' => 'Carpeta no encontrada'));
    if (!empty($byId[$id]['locked'])) json_out(400, array('ok' => false, 'error' => 'No se puede borrar una carpeta de marca'));
    $folders = array_values(array_filter($folders, function ($f) use ($id) { return $f['id'] !== $id; }));
    write_folders($folders);
    json_out(200, array('ok' => true, 'folders' => $folders, 'deleted' => $id));
  }

  if ($action === 'save' && isset($body['folders']) && is_array($body['folders'])) {
    $next = array();
    $seen = array();
    foreach ($body['folders'] as $item) {
      $folder = normalize_folder($item);
      if (!$folder || isset($seen[$folder['id']])) continue;
      if (isset($byId[$folder['id']]) && !empty($byId[$folder['id']]['locked'])) {
        $folder['locked'] = true;
        $folder['name'] = $byId[$folder['id']]['name'];
      }
      $seen[$folder['id']] = true;
      $next[] = $folder;
    }
    foreach (default_folders() as $def) {
      if (!isset($seen[$def['id']])) $next[] = $def;
    }
    write_folders($next);
    json_out(200, array('ok' => true, 'folders' => $next));
  }

  json_out(400, array('ok' => false, 'error' => 'Accion invalida'));
}

json_out(405, array('ok' => false, 'error' => 'Metodo no permitido'));
