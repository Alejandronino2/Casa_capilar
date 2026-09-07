<?php
function json_out($status, $payload) {
  http_response_code($status);
  header('Content-Type: application/json; charset=utf-8');
  header('Cache-Control: no-store');
  echo json_encode($payload);
  exit;
}

function root_dir() {
  return dirname(__DIR__);
}

function read_json_body() {
  $raw = file_get_contents('php://input');
  if ($raw === false || $raw === '') {
    json_out(400, array('ok' => false, 'error' => 'Cuerpo vacio'));
  }
  $parsed = json_decode($raw, true);
  if ($parsed === null && json_last_error() !== JSON_ERROR_NONE) {
    json_out(400, array('ok' => false, 'error' => 'JSON invalido'));
  }
  return $parsed;
}

function valid_id($id) {
  return is_string($id) && preg_match('/^[a-z0-9][a-z0-9._-]{0,63}$/i', $id);
}

function decode_data_url($dataUrl) {
  if (!preg_match('/^data:([\w\/+.-]+);base64,(.*)$/s', $dataUrl, $m)) {
    json_out(400, array('ok' => false, 'error' => 'dataUrl invalido'));
  }
  $bin = base64_decode($m[2], true);
  if ($bin === false) {
    json_out(400, array('ok' => false, 'error' => 'base64 invalido'));
  }
  return array('mime' => $m[1], 'bytes' => $bin);
}
