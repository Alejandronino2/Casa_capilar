<?php
require __DIR__ . '/helpers.php';

function ai_config() {
  $cfg = array(
    'openai_api_key' => getenv('OPENAI_API_KEY') ? getenv('OPENAI_API_KEY') : '',
    'openai_model' => getenv('OPENAI_MODEL') ? getenv('OPENAI_MODEL') : 'gpt-4o-mini',
  );
  $local = __DIR__ . '/config.local.php';
  if (is_file($local)) {
    $extra = include $local;
    if (is_array($extra)) {
      $cfg = array_merge($cfg, $extra);
    }
  }
  return $cfg;
}

function ai_prompt($titulo, $notes) {
  return "Eres redactor de stories 1080x1920 para Casa Capilar (productos Anyeluz y similares).\n\n" .
    "Titulo de la pieza: " . $titulo . "\n" .
    "Notas: " . ($notes !== '' ? $notes : '(sin notas)') . "\n\n" .
    "Mira las fotos (pieza original 16:9 y/o el envase). Extrae el texto visible de la etiqueta y de la pieza original.\n\n" .
    "Devuelve SOLO un JSON con estas claves:\n" .
    "{\n" .
    "  \"textoA\": \"para que sirve el producto\",\n" .
    "  \"textoB\": \"Tamaños:\\n500 ml\",\n" .
    "  \"tamanos\": [\"500 ml\"]\n" .
    "}\n\n" .
    "Reglas:\n" .
    "- textoA (primera descripcion, izquierda): para que sirve / beneficio. 1 o 2 frases cortas, maximo 140 caracteres. Español. Sin tamaños ni ml.\n" .
    "- textoB (segunda descripcion, derecha): SOLO presentaciones. Formato exacto:\n" .
    "Tamaños:\n" .
    "800 ml\n" .
    "- Lee los ml, g u oz del envase o de la pieza. Si hay varios envases con el mismo tamaño, no lo repitas. Si hay tamaños distintos, uno por linea.\n" .
    "- Si es un set, lista los tamaños de cada producto (ej. 500 ml). Si no ves el tamaño, escribe \"Tamaños:\\nConsultar presentación\".\n" .
    "- No inventes mililitros. Prefiere lo que se lee en la foto.\n" .
    "- Tono comercial breve, como las piezas Anyeluz. Sin hashtags ni markdown.";
}

function encode_asset_image($rel) {
  $rel = str_replace('\\', '/', (string) $rel);
  if ($rel === '' || strpos($rel, '..') !== false) return null;
  if (!preg_match('#^assets/(products|originals)/[A-Za-z0-9._-]+$#', $rel)) return null;
  $full = root_dir() . '/' . $rel;
  if (!is_file($full)) return null;

  $raw = @file_get_contents($full);
  if ($raw === false || $raw === '') return null;

  if (!function_exists('imagecreatefromstring')) {
    if (strlen($raw) > 3500000) return null;
    $ext = strtolower(pathinfo($full, PATHINFO_EXTENSION));
    return array(
      'mime' => $ext === 'png' ? 'image/png' : 'image/jpeg',
      'b64' => base64_encode($raw),
    );
  }

  $src = @imagecreatefromstring($raw);
  if (!$src) return null;
  $w = imagesx($src);
  $h = imagesy($src);
  $max = 1280;
  $scale = min(1, $max / max($w, $h));
  $nw = max(1, (int) round($w * $scale));
  $nh = max(1, (int) round($h * $scale));
  $dst = imagecreatetruecolor($nw, $nh);
  $white = imagecolorallocate($dst, 255, 255, 255);
  imagefilledrectangle($dst, 0, 0, $nw, $nh, $white);
  imagecopyresampled($dst, $src, 0, 0, 0, 0, $nw, $nh, $w, $h);
  ob_start();
  imagejpeg($dst, null, 72);
  $jpeg = ob_get_clean();
  imagedestroy($src);
  imagedestroy($dst);
  if ($jpeg === false || $jpeg === '') return null;
  return array('mime' => 'image/jpeg', 'b64' => base64_encode($jpeg));
}

function http_post_json($url, $payload, $headers) {
  $body = json_encode($payload);
  if ($body === false) {
    json_out(500, array('ok' => false, 'error' => 'No se pudo armar la peticion a la IA'));
  }
  $headers[] = 'Content-Type: application/json';
  if (!function_exists('curl_init')) {
    json_out(500, array('ok' => false, 'error' => 'PHP no tiene curl. Activalo en hPanel → PHP'));
  }
  $ch = curl_init($url);
  curl_setopt($ch, CURLOPT_POST, true);
  curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
  curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
  curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
  curl_setopt($ch, CURLOPT_TIMEOUT, 90);
  curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 20);
  $raw = curl_exec($ch);
  $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
  $err = curl_error($ch);
  curl_close($ch);
  if ($raw === false) {
    json_out(502, array('ok' => false, 'error' => 'No se pudo contactar la IA' . ($err ? ': ' . $err : '')));
  }
  return array('code' => $code, 'raw' => $raw);
}

function parse_model_json($text) {
  $text = trim((string) $text);
  if (preg_match('/```(?:json)?\s*(\{.*\})\s*```/s', $text, $m)) {
    $text = $m[1];
  }
  $start = strpos($text, '{');
  $end = strrpos($text, '}');
  if ($start === false || $end === false || $end <= $start) return null;
  $decoded = json_decode(substr($text, $start, $end - $start + 1), true);
  return is_array($decoded) ? $decoded : null;
}

function format_texto_b($value, $tamanos) {
  $lines = array();
  if (is_array($tamanos)) {
    foreach ($tamanos as $item) {
      $item = trim((string) $item);
      if ($item !== '') $lines[] = $item;
    }
  }
  if (!$lines) {
    $raw = trim(preg_replace('/^tama[ñn]os\s*:?\s*/iu', '', (string) $value));
    foreach (preg_split('/\r\n|\n|\r|,/', $raw) as $item) {
      $item = trim($item);
      if ($item !== '') $lines[] = $item;
    }
  }
  $uniq = array();
  foreach ($lines as $item) {
    $key = mb_strtolower($item, 'UTF-8');
    if (!isset($uniq[$key])) $uniq[$key] = $item;
  }
  $lines = array_values($uniq);
  if (!$lines) $lines = array('Consultar presentación');
  return "Tamaños:\n" . implode("\n", $lines);
}

function clip_texto($text, $max) {
  $text = trim(preg_replace('/\s+/u', ' ', (string) $text));
  if (function_exists('mb_strlen') && mb_strlen($text, 'UTF-8') > $max) {
    $text = rtrim(mb_substr($text, 0, $max - 1, 'UTF-8')) . '…';
  } elseif (strlen($text) > $max) {
    $text = rtrim(substr($text, 0, $max - 1)) . '…';
  }
  return $text;
}

function openai_complete($cfg, $prompt, $images) {
  $content = array(array('type' => 'text', 'text' => $prompt));
  foreach ($images as $img) {
    $content[] = array(
      'type' => 'image_url',
      'image_url' => array('url' => 'data:' . $img['mime'] . ';base64,' . $img['b64']),
    );
  }
  $res = http_post_json(
    'https://api.openai.com/v1/chat/completions',
    array(
      'model' => $cfg['openai_model'],
      'temperature' => 0.2,
      'response_format' => array('type' => 'json_object'),
      'messages' => array(
        array('role' => 'system', 'content' => 'Respondes solo JSON valido, sin markdown.'),
        array('role' => 'user', 'content' => $content),
      ),
    ),
    array('Authorization: Bearer ' . $cfg['openai_api_key'])
  );
  $parsed = json_decode($res['raw'], true);
  if ($res['code'] >= 400) {
    $msg = 'OpenAI rechazo la peticion';
    if (is_array($parsed) && isset($parsed['error']['message'])) $msg = $parsed['error']['message'];
    $low = strtolower($msg);
    if (strpos($low, 'credit') !== false || strpos($low, 'quota') !== false || strpos($low, 'billing') !== false) {
      $msg = 'ChatGPT no tiene credito. Recarga la cuenta de OpenAI en platform.openai.com.';
    }
    json_out(502, array('ok' => false, 'error' => $msg));
  }
  $text = '';
  if (is_array($parsed) && isset($parsed['choices'][0]['message']['content'])) {
    $text = $parsed['choices'][0]['message']['content'];
  }
  return $text;
}

$cfg = ai_config();
$configured = !empty($cfg['openai_api_key']);

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
  json_out(200, array(
    'ok' => true,
    'configured' => $configured,
    'provider' => $configured ? 'chatgpt' : null,
  ));
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  json_out(405, array('ok' => false, 'error' => 'Metodo no permitido'));
}

if (!$configured) {
  json_out(501, array(
    'ok' => false,
    'configured' => false,
    'error' => 'Falta la clave de ChatGPT. Copia api/config.sample.php a api/config.local.php y pon openai_api_key.',
  ));
}

$body = read_json_body();
$titulo = isset($body['titulo']) ? trim((string) $body['titulo']) : '';
$notes = isset($body['notes']) ? trim((string) $body['notes']) : '';
$product = isset($body['productImage']) ? $body['productImage'] : '';
$original = isset($body['originalImage']) ? $body['originalImage'] : '';

$images = array();
$orig = encode_asset_image($original);
$prod = encode_asset_image($product);
if ($orig) $images[] = $orig;
if ($prod) $images[] = $prod;

$prompt = ai_prompt($titulo, $notes);
$rawText = openai_complete($cfg, $prompt, $images);

$data = parse_model_json($rawText);
if (!$data) {
  json_out(502, array('ok' => false, 'error' => 'ChatGPT no devolvio un JSON usable'));
}

$textoA = clip_texto(isset($data['textoA']) ? $data['textoA'] : '', 160);
$textoB = format_texto_b(isset($data['textoB']) ? $data['textoB'] : '', isset($data['tamanos']) ? $data['tamanos'] : array());
if ($textoA === '') {
  json_out(502, array('ok' => false, 'error' => 'ChatGPT no pudo escribir para que sirve el producto'));
}

json_out(200, array(
  'ok' => true,
  'textoA' => $textoA,
  'textoB' => $textoB,
  'provider' => 'chatgpt',
));
