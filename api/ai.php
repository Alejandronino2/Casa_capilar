<?php
require __DIR__ . '/helpers.php';

function ai_config() {
  $cfg = array(
    'ai_provider' => getenv('AI_PROVIDER') ? getenv('AI_PROVIDER') : 'auto',
    'groq_api_key' => getenv('GROQ_API_KEY') ? getenv('GROQ_API_KEY') : '',
    'groq_model' => getenv('GROQ_MODEL') ? getenv('GROQ_MODEL') : 'openai/gpt-oss-20b',
    'groq_vision_model' => getenv('GROQ_VISION_MODEL') ? getenv('GROQ_VISION_MODEL') : 'qwen/qwen3.6-27b',
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

function ai_resolve_provider($cfg) {
  $want = strtolower(trim((string) (isset($cfg['ai_provider']) ? $cfg['ai_provider'] : 'auto')));
  if ($want === 'groq' && !empty($cfg['groq_api_key'])) return 'groq';
  if ($want === 'openai' && !empty($cfg['openai_api_key'])) return 'openai';
  if ($want === 'auto' || $want === '') {
    if (!empty($cfg['groq_api_key'])) return 'groq';
    if (!empty($cfg['openai_api_key'])) return 'openai';
  }
  return null;
}

function title_hint_from_paths($product, $original, $id) {
  foreach (array($product, $original, $id) as $raw) {
    $base = pathinfo(basename(str_replace('\\', '/', (string) $raw)), PATHINFO_FILENAME);
    if ($base === '') continue;
    $base = preg_replace('/^[0-9]+-/', '', $base);
    if (preg_match('/whatsapp|photoroom|screenshot|img[-_]?[0-9]*$/i', $base) && preg_match('/\d{4}|photoroom/i', $base)) {
      continue;
    }
    $parts = preg_split('/[-_]+/', $base);
    $words = array();
    foreach ($parts as $w) {
      $w = trim((string) $w);
      if ($w === '') continue;
      if (preg_match('/^\d+$/', $w)) continue;
      if (preg_match('/^[a-f0-9]{8,}$/i', $w)) continue;
      if (preg_match('/^(photoroom|whatsapp|listing|image|img|foto|copy|final|at|pm|am)$/i', $w)) continue;
      $words[] = $w;
    }
    if (count($words) >= 2) {
      return implode(' ', $words);
    }
  }
  return '';
}

function titulo_parece_basura($titulo, $marca) {
  $t = trim((string) $titulo);
  if ($t === '') return true;
  if (preg_match('/whatsapp|photoroom|screenshot|\d{4}[-_]\d{2}/i', $t)) return true;
  if (preg_match('/^producto\b/iu', $t)) return true;
  $marca = trim((string) $marca);
  if ($marca !== '' && function_exists('mb_strtolower')) {
    if (mb_strtolower($t, 'UTF-8') === mb_strtolower($marca, 'UTF-8')) return true;
  }
  return false;
}

function ai_prompt($marca, $titulo, $notes, $hint, $hasPhoto) {
  $marca = $marca !== '' ? $marca : 'sin marca';
  $titulo = $titulo !== '' ? $titulo : 'producto';
  $lines = array();
  $lines[] = 'Venta Casa Capilar. Marca: ' . $marca . '.';
  if ($hasPhoto) {
    $lines[] = 'Lee la FOTO del envase y saca el nombre real del producto.';
  } else {
    $lines[] = 'Nombre actual: ' . $titulo . '.';
    if ($hint !== '') $lines[] = 'Pista archivo: ' . $hint . '.';
  }
  if ($notes !== '') $lines[] = 'Notas: ' . $notes . '.';
  $lines[] = 'Responde SOLO este JSON (una linea, sin think, sin markdown):';
  $lines[] = '{"titulo":"NOMBRE MAYUSCULAS SIN NUMEROS","textoA":"copy venta max 120 chars","textoB":"Tamaños:\\nConsultar presentación","tamanos":["Consultar presentación"]}';
  $lines[] = 'titulo = nombre del producto (no solo la marca, no PRODUCTO...). Si ves ml en foto usalos en textoB.';
  return implode(' ', $lines);
}

function encode_asset_image($rel, $compact) {
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
  $max = $compact ? 512 : 960;
  $quality = $compact ? 48 : 62;
  $scale = min(1, $max / max($w, $h));
  $nw = max(1, (int) round($w * $scale));
  $nh = max(1, (int) round($h * $scale));
  $dst = imagecreatetruecolor($nw, $nh);
  $white = imagecolorallocate($dst, 255, 255, 255);
  imagefilledrectangle($dst, 0, 0, $nw, $nh, $white);
  imagecopyresampled($dst, $src, 0, 0, 0, 0, $nw, $nh, $w, $h);
  ob_start();
  imagejpeg($dst, null, $quality);
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
  curl_setopt($ch, CURLOPT_TIMEOUT, 120);
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
  $text = preg_replace('/<think>.*?<\/think>/is', '', $text);
  // Si se corto a mitad del think, descarta el bloque abierto
  if (stripos($text, '<think>') !== false) {
    $text = preg_replace('/<think>.*$/is', '', $text);
  }
  $text = trim($text);
  if (preg_match('/```(?:json)?\s*(\{.*\})\s*```/s', $text, $m)) {
    $text = $m[1];
  }
  $start = strpos($text, '{');
  $end = strrpos($text, '}');
  if ($start === false || $end === false || $end <= $start) return null;
  $decoded = json_decode(substr($text, $start, $end - $start + 1), true);
  if (!is_array($decoded)) return null;
  // Acepta si trae al menos titulo o textoA
  if (!isset($decoded['titulo']) && !isset($decoded['textoA'])) return null;
  return $decoded;
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

function clip_titulo($text) {
  $text = str_replace(array("\r\n", "\r"), "\n", (string) $text);
  $text = preg_replace("/[ \t]+/u", ' ', $text);
  $text = preg_replace("/\n{2,}/u", "\n", $text);
  $text = trim($text);
  $lines = array();
  foreach (explode("\n", $text) as $line) {
    $line = trim($line);
    // Quitar digitos y restos como " #" o " -" al final
    $line = preg_replace('/\d+/u', '', $line);
    $line = preg_replace('/\s+/u', ' ', $line);
    $line = preg_replace('/\s*([#\-\/|,.;:])\s*/u', ' ', $line);
    $line = trim($line, " \t-_/|,.;:#");
    if ($line !== '') $lines[] = $line;
  }
  if (count($lines) > 2) $lines = array_slice($lines, 0, 2);
  $out = implode("\n", $lines);
  if (function_exists('mb_strtoupper')) {
    $out = mb_strtoupper($out, 'UTF-8');
  } else {
    $out = strtoupper($out);
  }
  if (function_exists('mb_strlen') && mb_strlen($out, 'UTF-8') > 90) {
    $out = rtrim(mb_substr($out, 0, 89, 'UTF-8')) . '…';
  } elseif (strlen($out) > 90) {
    $out = rtrim(substr($out, 0, 89)) . '…';
  }
  return $out;
}

function openai_compat_complete($url, $apiKey, $model, $prompt, $images, $label, $options) {
  $options = is_array($options) ? $options : array();
  $useJsonMode = !empty($options['json_mode']);
  $maxTokens = isset($options['max_tokens']) ? (int) $options['max_tokens'] : 280;
  $useImages = $images && count($images) > 0;
  $content = array(array('type' => 'text', 'text' => $prompt));
  foreach ($images as $img) {
    $content[] = array(
      'type' => 'image_url',
      'image_url' => array(
        'url' => 'data:' . $img['mime'] . ';base64,' . $img['b64'],
        'detail' => 'low',
      ),
    );
  }
  $payload = array(
    'model' => $model,
    'temperature' => isset($options['temperature']) ? $options['temperature'] : 0.2,
    'max_tokens' => $maxTokens,
    'messages' => array(
      array('role' => 'system', 'content' => 'Solo JSON valido. Sin razonamiento. Sin markdown.'),
      array('role' => 'user', 'content' => $useImages ? $content : $prompt),
    ),
  );
  if ($useJsonMode) {
    $payload['response_format'] = array('type' => 'json_object');
  }
  if (isset($options['reasoning_effort']) && $options['reasoning_effort'] !== '') {
    $payload['reasoning_effort'] = $options['reasoning_effort'];
  }

  $res = http_post_json($url, $payload, array('Authorization: Bearer ' . $apiKey));
  $parsed = json_decode($res['raw'], true);
  if ($res['code'] >= 400) {
    $msg = $label . ' rechazo la peticion';
    if (is_array($parsed) && isset($parsed['error']['message'])) $msg = $parsed['error']['message'];
    $low = strtolower($msg);
    if (strpos($low, 'rate limit') !== false || strpos($low, 'tokens per minute') !== false || strpos($low, 'tpm') !== false) {
      $retryAfter = 20;
      if (preg_match('/try again in\s+([0-9.]+)\s*s/i', $msg, $m)) {
        $retryAfter = (int) ceil((float) $m[1]) + 1;
      }
      if ($retryAfter < 3) $retryAfter = 3;
      if ($retryAfter > 120) $retryAfter = 120;
      json_out(429, array(
        'ok' => false,
        'error' => 'Groq llego al limite por minuto. Espera ' . $retryAfter . ' segundos.',
        'rateLimited' => true,
        'retryAfter' => $retryAfter,
      ));
    } elseif (strpos($low, 'credit') !== false || strpos($low, 'quota') !== false || strpos($low, 'billing') !== false) {
      if ($label === 'OpenAI') {
        $msg = 'ChatGPT no tiene credito. Usa Groq gratis: pon groq_api_key en api/config.local.php (console.groq.com).';
      } else {
        json_out(429, array(
          'ok' => false,
          'error' => 'Groq alcanzo el limite gratuito. Espera 60 segundos.',
          'rateLimited' => true,
          'retryAfter' => 60,
        ));
      }
    }
    json_out(502, array('ok' => false, 'error' => $msg));
  }
  $text = '';
  if (is_array($parsed) && isset($parsed['choices'][0]['message']['content'])) {
    $text = $parsed['choices'][0]['message']['content'];
  }
  return $text;
}

function ai_complete($provider, $cfg, $prompt, $images) {
  if ($provider === 'groq') {
    $useVision = $images && count($images) > 0;
    $model = $useVision
      ? (isset($cfg['groq_vision_model']) && $cfg['groq_vision_model'] !== '' ? $cfg['groq_vision_model'] : 'qwen/qwen3.6-27b')
      : $cfg['groq_model'];
    $opts = array(
      'json_mode' => false,
      'max_tokens' => $useVision ? 450 : 500,
      'temperature' => 0.1,
    );
    // qwen: none = sin think (evita cortar el JSON). gpt-oss: low
    $opts['reasoning_effort'] = $useVision ? 'none' : 'low';
    return openai_compat_complete(
      'https://api.groq.com/openai/v1/chat/completions',
      $cfg['groq_api_key'],
      $model,
      $prompt,
      $useVision ? $images : array(),
      'Groq',
      $opts
    );
  }
  return openai_compat_complete(
    'https://api.openai.com/v1/chat/completions',
    $cfg['openai_api_key'],
    $cfg['openai_model'],
    $prompt,
    $images,
    'OpenAI',
    array('json_mode' => true, 'max_tokens' => 220)
  );
}

$cfg = ai_config();
$provider = ai_resolve_provider($cfg);
$configured = $provider !== null;

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
  json_out(200, array(
    'ok' => true,
    'configured' => $configured,
    'provider' => $provider,
    'free' => $provider === 'groq',
  ));
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  json_out(405, array('ok' => false, 'error' => 'Metodo no permitido'));
}

if (!$configured) {
  json_out(501, array(
    'ok' => false,
    'configured' => false,
    'error' => 'Falta clave de IA. Copia api/config.sample.php a api/config.local.php y pon groq_api_key (gratis en console.groq.com).',
  ));
}

$body = read_json_body();
$titulo = isset($body['titulo']) ? trim((string) $body['titulo']) : '';
$notes = isset($body['notes']) ? trim((string) $body['notes']) : '';
$marca = isset($body['marca']) ? trim((string) $body['marca']) : '';
$folder = isset($body['folder']) ? trim((string) $body['folder']) : '';
$id = isset($body['id']) ? trim((string) $body['id']) : '';
if ($marca === '' && $folder !== '' && $folder !== 'sin-carpeta') $marca = $folder;
$product = isset($body['productImage']) ? $body['productImage'] : '';
$original = isset($body['originalImage']) ? $body['originalImage'] : '';
$usePhoto = array_key_exists('usePhoto', $body) ? !empty($body['usePhoto']) : true;

$hint = title_hint_from_paths($product, $original, $id);

$images = array();
if ($usePhoto) {
  $prod = encode_asset_image($product, true);
  $orig = encode_asset_image($original, true);
  if ($prod) $images[] = $prod;
  elseif ($orig) $images[] = $orig;
}

// Si el titulo es basura y hay imagen, forzar foto aunque el check venga apagado
if (!$images && titulo_parece_basura($titulo, $marca)) {
  $prod = encode_asset_image($product, true);
  $orig = encode_asset_image($original, true);
  if ($prod) $images[] = $prod;
  elseif ($orig) $images[] = $orig;
}

$hasPhoto = count($images) > 0;
$prompt = ai_prompt($marca, $titulo, $notes, $hint, $hasPhoto);

$rawText = ai_complete($provider, $cfg, $prompt, $images);
$data = parse_model_json($rawText);

// Reintento sin foto (mas estable) si la vision corto el JSON
if (!$data && $hasPhoto) {
  $prompt2 = ai_prompt($marca, $titulo, $notes, $hint, false);
  $rawText = ai_complete($provider, $cfg, $prompt2, array());
  $data = parse_model_json($rawText);
}

if (!$data) {
  // Ultimo recurso: titulo desde archivo + venta generica
  if ($hint !== '') {
    $data = array(
      'titulo' => $hint,
      'textoA' => 'Descubre este producto ' . $marca . ': resultado visible y cuidado que se nota desde el primer uso.',
      'textoB' => "Tamaños:\nConsultar presentación",
      'tamanos' => array('Consultar presentación'),
    );
  } else {
    json_out(502, array('ok' => false, 'error' => 'La IA no devolvio un JSON usable. Espera unos segundos e intenta de nuevo.'));
  }
}

$textoA = clip_texto(isset($data['textoA']) ? $data['textoA'] : '', 180);
$textoB = format_texto_b(isset($data['textoB']) ? $data['textoB'] : '', isset($data['tamanos']) ? $data['tamanos'] : array());
$tituloOut = clip_titulo(isset($data['titulo']) ? $data['titulo'] : '');
if ($tituloOut === '' && $hint !== '') $tituloOut = clip_titulo($hint);
if ($tituloOut === '') $tituloOut = clip_titulo($titulo);
if ($textoA === '') {
  json_out(502, array('ok' => false, 'error' => 'La IA no pudo escribir para que sirve el producto'));
}

json_out(200, array(
  'ok' => true,
  'titulo' => $tituloOut,
  'textoA' => $textoA,
  'textoB' => $textoB,
  'provider' => $provider,
  'mode' => $hasPhoto ? 'photo' : 'text',
));
