# ¿Dónde comió el Arturito?

> Proyecto de fan, no oficial. No tengo relación con el Arturito ni con su equipo.

Todas las reseñas son del Arturito. Síguelo y ve sus videos completos:

- TikTok: [@soyelarturito](https://www.tiktok.com/@soyelarturito)
- YouTube: [@soyelarturito](https://www.youtube.com/@soyelarturito)

Esta página es un índice de los lugares que reseñó: para cada uno muestra su veredicto, qué pedir, qué evitar, el video original y un enlace para abrir el lugar en Google Maps. Se puede filtrar por país, ciudad o platillo, y cada vista se puede compartir porque los filtros quedan en la dirección de la página.

La página no aloja ni incrusta sus videos, fotos ni audio: siempre manda al video original, que tiene la última palabra. No tiene anuncios, cookies ni rastreo, y no hace peticiones a terceros al cargar.

Hecho con amor por **lasr21**. Me encuentras en [X](https://x.com/lasr21) e [Instagram](https://www.instagram.com/lasr21/).

## Cómo se arma la guía

Detrás de cada ficha hay un poco de trabajo de manos, magia y varias tazas de café. Reviso los videos públicos, organizo la información útil de cada reseña y la convierto en una lista sencilla: dónde fue, qué recomendó pedir, qué conviene evitar y el enlace para volver al video.

Las herramientas automáticas ayudan a ordenar y revisar esa información, pero pueden equivocarse. Por eso, cuando algo no cuadra, el video original manda. Los restaurantes cambian de menú, horarios y hasta de humor: confirma siempre antes de ir.

La guía crece poco a poco: voy agregando lugares conforme reviso más videos, así que si no encuentras uno, puede que todavía no llegue.

Este repositorio solo guarda datos mínimos para la guía, como nombres de lugares, ciudades, platillos y enlaces. No incluye videos, fotos, transcripciones ni capturas.

## Cómo está hecha la página

Es HTML, CSS y JavaScript sin dependencias ni paso de compilación. Lo único que cambia con el tiempo es `data/lugares.json`. El diseño completo y las decisiones están en [DESIGN.md](DESIGN.md).

## Actualizar los datos

1. Exporta la lista completa desde tu pipeline (el archivo siempre es la lista entera, no solo lo nuevo).
2. Si quieres, revísala antes: `node scripts/validate.mjs ruta/al/archivo.json`.
3. Reemplaza `data/lugares.json` con el archivo nuevo.
4. Haz commit y push a `main`.

GitHub Actions valida los datos, corre las pruebas y, si todo pasa, publica la página. Si el archivo tiene errores, la versión anterior sigue en línea y el reporte del workflow dice qué entrada falló y por qué. Los lugares, ciudades y países nuevos aparecen solos, sin tocar código.

El validador falla (código 1) con errores como un `video_id` repetido o un enlace que no es de TikTok, y solo avisa (código 0) de cosas como un lugar sin nombre o una entrada marcada para revisión manual. Termina con un resumen como `112 entradas, 0 errores, 1 aviso`.

## Verla en tu computadora

Los navegadores no dejan cargar el JSON si abres `index.html` directo desde el disco, así que sirve la carpeta con un servidor local:

```sh
python -m http.server 8000
# o bien: npx serve .
```

y abre <http://localhost:8000>. Para las pruebas: `node --test` (o `npm test`); para validar los datos: `npm run validate`.

## Publicar en GitHub Pages (una sola vez)

En el repositorio, ve a **Settings → Pages** y en **Source** elige **GitHub Actions**. A partir de ahí, cada push a `main` publica la página en <https://lasr21.github.io/el_arturito/>.

## Ajustes

Todo lo que se puede cambiar sin tocar el resto del código está en `assets/js/config.js`:

- `SITE.social`: tus redes (X e Instagram). Aparecen en el pie de página y son adonde la página manda las correcciones y solicitudes de retiro.
- `CREATOR.links`: las redes del Arturito que aparecen en la página.
- `SHOW_NEEDS_REVIEW`: en `false` oculta las entradas que el pipeline marcó para revisión.
- `LIST_PREVIEW`: cuántos platillos se ven antes de “Ver N más”.

## Créditos

Todo el mérito de las reseñas es del Arturito: [TikTok](https://www.tiktok.com/@soyelarturito) y [YouTube](https://www.youtube.com/@soyelarturito).

La tipografía es [Archivo](https://github.com/Omnibus-Type/Archivo), de Omnibus-Type, con licencia SIL Open Font License (ver `assets/fonts/OFL.txt`).

Las banderas son de [flag-icons](https://github.com/lipis/flag-icons), con licencia MIT (ver `assets/flags/LICENSE.txt`).

## Licencia

El código está bajo la licencia MIT (ver [LICENSE](LICENSE)). Los datos resumen videos públicos del Arturito; este proyecto no reclama ningún derecho sobre su contenido. Si eres el Arturito o parte de su equipo y quieres que cambie o quite algo, mándame un DM en [X](https://x.com/lasr21) o [Instagram](https://www.instagram.com/lasr21/) y lo hago.
