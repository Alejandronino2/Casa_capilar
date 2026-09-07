<?php
require __DIR__ . '/helpers.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  json_out(405, array('ok' => false, 'error' => 'Metodo no permitido'));
}

$body = read_json_body();
$id = isset($body['id']) ? $body['id'] : '';
$dataUrl = isset($body['dataUrl']) ? $body['dataUrl'] : '';
$type = isset($body['type']) ? $body['type'] : 'product';

if (!valid_id($id)) {
  json_out(400, array('ok' => false, 'error' => 'id invalido'));
}
if (!$dataUrl) {
  json_out(400, array('ok' => false, 'error' => 'falta dataUrl'));
}

$decoded = decode_data_url($dataUrl);
$isProduct = $type !== 'original';

if ($isProduct && $decoded['mime'] !== 'image/png') {
  json_out(400, array('ok' => false, 'error' => 'el recorte de producto debe ser PNG'));
}

$folder = $isProduct ? 'products' : 'originals';
$ext = $isProduct ? 'png' : ($decoded['mime'] === 'image/png' ? 'png' : 'jpg');
$dir = root_dir() . '/assets/' . $folder;
if (!is_dir($dir) && !mkdir($dir, 0755, true)) {
  json_out(500, array('ok' => false, 'error' => 'No se pudo crear assets/' . $folder));
}

$path = $dir . '/' . $id . '.' . $ext;
if (file_put_contents($path, $decoded['bytes']) === false) {
  json_out(500, array('ok' => false, 'error' => 'No se pudo guardar la imagen. Revisa permisos de assets/.'));
}

json_out(200, array(
  'ok' => true,
  'path' => 'assets/' . $folder . '/' . $id . '.' . $ext,
  'bytes' => strlen($decoded['bytes']),
));
