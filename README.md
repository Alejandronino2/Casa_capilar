# Casa Capilar Stories (Hostinger)

Version PHP + HTML + JS. No necesita Node, npm ni Playwright.
Sube **el contenido de esta carpeta** a `public_html` (o a una subcarpeta).

## Subir a Hostinger

1. En hPanel: **Sitios web → Administrador de archivos** (o FTP).
2. Entra en `public_html`.
3. Sube todo lo de esta carpeta: `index.php`, `extract.php`, `api/`, `assets/`, `content/`, `css/`, `js/`, `.htaccess`, `.user.ini`.
4. Permisos de escritura (775 o 755) en:
   - `content/`
   - `assets/products/`
   - `assets/originals/`
5. Abre `https://tudominio.com/` (o `https://tudominio.com/subcarpeta/`).

PHP 7.4+ o 8.x. En hPanel puedes elegir la version de PHP.

## Probar en local

```bash
cd hostinger
php -S localhost:8080
```

Luego abre http://localhost:8080/

## Uso

- **Editor:** lista, preview 1080×1920, textos, sliders.
- **Buscar imagen:** elige una foto de la galeria o el explorador; se le quita el fondo en el navegador y se guarda en `assets/products/{id}.png`.
- **Guardar:** escribe `content/products.json`.
- **Checks + Descargar:** PNG 1080×1920 de las piezas marcadas (se baja a tu carpeta de descargas).
- **Recortar producto:** `extract.php` para lotes.

La primera vez que quites un fondo, el navegador descarga el modelo WASM (hace falta internet).

## Si Guardar falla

- Carpeta `content/` y `assets/` deben ser escribibles por PHP.
- Si el PNG es grande, Hostinger puede limitar el POST. El archivo `.user.ini` pide 40 MB; espera unos minutos o sube el limite en hPanel → PHP.
