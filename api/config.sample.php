<?php
/**
 * Copia este archivo a config.local.php y pon tu clave.
 * config.local.php no se sube a git.
 *
 * Recomendado (gratis): Groq → https://console.groq.com/keys
 * Opcional (de pago): OpenAI → https://platform.openai.com/api-keys
 *
 * Con ai_provider = auto usa Groq si hay groq_api_key; si no, OpenAI.
 */
return array(
  'ai_provider' => 'auto',
  'groq_api_key' => '',
  'groq_model' => 'openai/gpt-oss-20b',
  'groq_vision_model' => 'qwen/qwen3.6-27b',
  'openai_api_key' => '',
  'openai_model' => 'gpt-4o-mini',
);
