# ¿Dónde comió el Arturito?

Design doc and build brief for a fan-made index of El Arturito's restaurant reviews.

Working title. Owner: Luis. Status: v1 built; see the decision log (§15). Last updated: September 2026.

## 1. What this is

A fan-made, unofficial static website that indexes the places reviewed by the Mexican food creator El Arturito ([@soyelarturito](https://www.tiktok.com/@soyelarturito)). For each place it shows his verdict, what to order, what to avoid, a link to the original video, and a link to open the place in Google Maps. Visitors can narrow the list by country, city or dish.

It exists because his reviews are easy to trust and hard to find again. When you want to go to a place he recommended, you have to remember which video it was, dig through his profile, and rewatch it to recall what he ordered. This site is a love letter to his work: a well-kept index that makes his recommendations easier to use and sends people back to his videos. It has no relationship with him or his team, and it says so plainly.

## 2. For the building agent

You start from a folder that contains this file and one JSON file with the data. Read the whole document before writing any code, then build what it specifies. Where it is silent, choose the simplest option consistent with the principles in §3. If something here turns out to be impossible or clearly wrong, make the smallest change that works. In both cases, record what you decided in the decision log (§15) and keep the rest of this document accurate.

Do not add frameworks, bundlers, runtime dependencies or third-party services.

A sensible order of work: the data layer and its tests, the validator, markup and rendering, filters and URL state, the visual design, the deploy workflow, and the README. When you finish, go through the acceptance checks in §13, report each one as pass or fail, and list every `TODO(Luis)` left in the repo.

## 3. Principles

**Send people to him.** The site is an index, not a substitute for his content. It never hosts, re-uploads or embeds his videos, audio, thumbnails, transcripts or photos, and on every card the primary action opens the original video.

**Unofficial, and it says so early.** The disclaimer sits right under the title, not only in the footer.

**The video outranks the data.** Entries come from an offline pipeline that extracts them from his public videos, so names can be misheard and fields can be missing. The UI treats every string as untrusted text, degrades gracefully when values are null, and always points to the video as the source of truth.

**Zero maintenance.** The only recurring change is replacing one JSON file. Nothing needs to be rebuilt, upgraded or configured when that happens.

**No keys, no backend, no tracking.** No Google Maps API, no analytics, no cookies, and no third-party requests when the page loads. The only external things are outbound links.

**Phone first.** The typical visit happens on a phone, on the street, maybe on a weak connection, with one question in mind: what should I order here, or where should I eat in this city?

## 4. Scope

Version 1 is a single page that loads the data, shows every place as a card, and lets people filter by country and city, search by place, city or dish, filter by verdict, and sort by location or by recency. The state of those controls lives in the URL, so any view can be shared. The site deploys to GitHub Pages through a workflow that validates the data before publishing.

Out of scope for v1: embedded maps, coordinates and "near me"; the Google Maps API; embedded TikTok players and thumbnails; accounts, comments, ratings and submissions; the extraction pipeline itself, which lives offline, outside this repo; an English version; analytics; any form of monetization.

## 5. Data contract

### 5.1 Location and update model

The data lives at `data/lugares.json`. If the JSON file you were given has a different name, move it there. The file is always a full snapshot: Luis replaces it wholesale with a fresh export, and the site never writes to it. Fields the site doesn't know about are ignored, so the pipeline can add fields later without breaking anything.

### 5.2 Fields

Each entry is one video. Every key below is required; some values may be null or empty, as stated.

| Field | Type | Meaning | How the UI uses it |
|---|---|---|---|
| `video_id` | digit string, unique | TikTok video ID | Key, anchor, recency order, derived date. Keep it a string: 19-digit IDs exceed `Number.MAX_SAFE_INTEGER`. |
| `url` | string | The review on TikTok | Primary button. |
| `nombre_lugar` | string or `null` | Place name as said or shown in the video | Card title; fallback copy when null or blank. |
| `enlace_google_maps` | string or `null` | Google Maps search link | Secondary button; fallback in §5.3. |
| `recomendado` | boolean | His overall verdict | The stamp. |
| `que_pedir` | array of strings, may be empty | What to order | "Qué pedir" list, or "Si vas, pide" when not recommended; hidden when empty. |
| `que_evitar` | array of strings, may be empty | What to avoid; free text, not always a dish | "Qué evitar" list; hidden when empty. |
| `ciudad` | non-empty string | City | Grouping, filters, search. |
| `pais` | non-empty string | Country | Grouping, filters, search. |
| `necesita_revision_manual` | boolean | The pipeline flagged the entry | "Por confirmar" note; see `SHOW_NEEDS_REVIEW`. |

### 5.3 Derived values

These are computed in the browser and never stored.

**Publish date.** TikTok video IDs carry the upload time, in Unix seconds, in their top 32 bits:

```js
const publishedAt = new Date(Number(BigInt(video_id) >> 32n) * 1000);
```

This is an observed property of TikTok IDs, not an official API. It checks out against the current data (the eleven IDs decode to dates between 2 July and 24 September 2026), but treat it as best effort: show month and year only, format in UTC, and hide the date when it falls before 2016 or after tomorrow. For recency ordering, compare `BigInt(video_id)` values directly. The date earns its place on every card because menus change: a dish he ordered a year ago may be gone, and "Video de julio de 2026" sets that expectation without extra copy.

**Maps link.** Use `enlace_google_maps` when it passes the allowlist (§10.4). If it is null but `nombre_lugar` exists, build one with the documented Maps URLs format, which needs no API key:

```js
const q = `${nombre_lugar}, ${ciudad}, ${pais}`;
const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
```

If both are null, the card shows no Maps button.

**Grouping keys and slugs.** Group and filter on normalized keys so "Mexico" and "México" land together, and display whichever spelling appears most often (ties go to the spelling seen first). City keys are scoped by country, so two cities with the same name in different countries stay apart. Synonyms such as "EE. UU." versus "Estados Unidos" are the pipeline's job; the site doesn't try to merge them.

```js
const norm = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim().replace(/\s+/g, ' ');
const slug = s => norm(s).replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '');
const cityKey = e => `${slug(e.pais)}/${slug(e.ciudad)}`;
```

The slug keeps letters and digits from any script. For Latin names it gives the same result as `[^a-z0-9]`, and a name in another script can't collapse to an empty key (§15).

**Display casing.** Capitalize the first letter of list items when rendering, so "medialuna tradicional" shows as "Medialuna tradicional". Text that starts with a digit is left as is ("18 meses…"). Never write changes back to the data.

### 5.4 Edge cases in the data

The v1 data (11 entries) is also kept as the test fixture `tests/fixtures/lugares-v1.json`.

| Case | Where it happens now | Required behavior |
|---|---|---|
| No place name | The Austin entry (`7681454363881278728`) | Title "Lugar por identificar" with the hint; keep the TikTok button; no Maps button. |
| Flagged for review | None today (covered by unit tests and a browser check on a modified copy of the data) | "Por confirmar" note; sorts after confirmed entries in its city. |
| Not recommended, but with something to order | Fuente Alemana | "No recomendado" stamp; list heading "Si vas, pide". |
| Long lists | Cantón Mexicali (14 items to order), Madre Rojas (11), Kefish (9), Austin (8), Villa Torel (7) | First 5 visible; the rest behind "Ver N más" (§8.6). Capitanía 624 and Trattoria Da Enzo al 29 have 6, so all show. |
| Things to avoid that aren't dishes | Kefish: "venir el lunes (no hay chocolates)" | Render as is; the heading is "Qué evitar", never "Platillos". |
| Inconsistent casing | "Tortilla de harina…" next to "medialuna tradicional" | Capitalize the first letter when rendering (§5.3). |
| Misheard names | "La Matrichana de 1870" is La Matriciana dal 1870 | Nothing to fix in the site; the about copy says the video has the last word. Fixes belong in the pipeline. |
| Maps link encoded differently | La Mezzetta uses `+` for spaces; the rest use `%20` | Nothing to do; both pass the allowlist and work. |
| Same place in two videos | Not yet, but likely | One card per video; don't merge. The validator warns. |
| Entry fails validation at runtime | None today | Skip it with a `console.warn` naming its `video_id`; never break the page. |

## 6. Relationship with the creator

Refer to him as El Arturito and link his handle. Don't use his photo, likeness, logo or channel art, and don't use TikTok's or YouTube's logos: text labels with simple generic icons (play, map pin) are enough and avoid implying endorsement.

The disclaimer appears in four places: a short line under the site title, the full "Por qué existe esta página" section, one line in the footer, and the top of the README.

Social links, checked in September 2026:

| Network | Link | Status |
|---|---|---|
| TikTok | https://www.tiktok.com/@soyelarturito | Verified |
| YouTube | https://www.youtube.com/@soyelarturito | Verified |
| Instagram | None yet | Not verified. Leave it out until Luis confirms the handle. Don't guess: `@soyarturito` and `@soyarturitook` are unrelated accounts. |

Links to him open in a new tab. The about section ends with a corrections and takedown line asking for a DM on Luis's X or Instagram (`SITE.social`); requests from him or his team are honored promptly. The site carries no ads, no affiliate links and no tracking, and the footer says so.

## 7. Copy

All UI text is Spanish (es-MX). The about note is written in Luis's first person and signed, because it's a love letter. Everything else speaks in the interface's voice: plain verbs, sentence case, no exclamation marks, errors that explain instead of apologizing, and buttons that say exactly what happens when you use them.

| Element | Text |
|---|---|
| Site title | ¿Dónde comió el Arturito? |
| Tagline | Qué pedir y qué evitar en los lugares que reseñó @soyelarturito, con el video de cada uno. |
| Short disclaimer | Proyecto de fan, no oficial. No tengo relación con el Arturito ni con su equipo. |
| Link to the about section | Por qué existe esta página |
| Skip link | Saltar a los resultados |
| Search label and placeholder | Buscar; Lugar, platillo o ciudad |
| Search clear button (accessible name) | Borrar la búsqueda |
| Location chips | "Todos", then each country with its count. After choosing a country: "Todos los países", the country with its count, and each of its cities with its count. |
| Verdict filter | Todos / Recomendados / No recomendados |
| Order | Por lugar / Más recientes |
| Result count | 11 lugares en 7 ciudades de 5 países. With a country selected: 4 lugares en 3 ciudades de México. With a city selected: 1 lugar en Austin. Use correct singulars. |
| No results | Ningún lugar coincide con la búsqueda y los filtros. Button: Ver todos los lugares |
| Loading | Cargando lugares… |
| Load error | No se pudo cargar la lista de lugares. Recarga la página; si sigue fallando, repórtalo en GitHub. (Links to the repo's issues.) |
| Stamp | Recomendado / No recomendado |
| Flagged note | Por confirmar |
| List headings | Qué pedir; Si vas, pide (when not recommended); Qué evitar |
| Overflow toggle | Ver 9 más / Ver menos |
| Unnamed place, title | Lugar por identificar |
| Unnamed place, hint | El nombre no quedó claro en los datos. Mira el video para ubicarlo. |
| Card date | Video de julio de 2026 |
| Buttons | Ver reseña en TikTok / Abrir en Google Maps |
| Heading of the flat view (visually hidden) | Lugares, del video más reciente al más antiguo |
| Follow line | Síguelo en TikTok y YouTube. (Built from `CREATOR.links`.) |
| Footer | Hecho con amor por lasr21, fan del Arturito. Me encuentras en X e Instagram. Sin anuncios y sin rastreo. Código en GitHub. |
| Freshness line | Incluye videos hasta el 24 de septiembre de 2026. (Date of the newest video.) |

The about section, as a draft for Luis to edit:

> **Por qué existe esta página**
>
> Disfruto mucho las reseñas del Arturito y confío en lo que recomienda. El problema es que, cuando quería ir a alguno de sus lugares, me costaba muchísimo volver a encontrar el video: cómo se llamaba el lugar, qué había pedido, qué dijo que no pidiera. Por eso hice esta página.
>
> Es una carta de amor a su trabajo, no algo oficial: no tengo ninguna relación con él ni con su equipo, y no gano nada con esto. Todo sale de sus videos públicos y puede tener errores. El video siempre tiene la última palabra, y los menús cambian, así que fíjate en la fecha. Si esto te sirve, síguelo y ve sus videos completos.
>
> Voy agregando lugares poco a poco, conforme reviso más videos. Los marcados como "Por confirmar" tienen datos que todavía no reviso a mano.
>
> Si eres el Arturito o parte de su equipo y quieres que cambie o quite algo, mándame un DM en X o Instagram y lo hago.
>
> Luis

"X" and "Instagram" link to the accounts in `SITE.social`. If that list is ever emptied, the line falls back to "…escríbeme en GitHub y lo hago", linking to the repo's issues.

## 8. Interaction design

### 8.1 Page structure

One page, in this order: the header (title, tagline, short disclaimer with a link to the about section), a sticky control bar, the remaining controls, the result count, the results, the about section, and the footer. On a 390×844 phone, the top of the first card is visible without scrolling.

```
┌──────────────────────────────┐
│ ¿Dónde comió                 │  title, condensed, white
│ el Arturito?                 │
│ Qué pedir y qué evitar en…   │  tagline
│ Proyecto de fan, no oficial. │  short disclaimer + link
├──────────────────────────────┤
│ [Lugar, platillo o ciudad  ] │  sticky: search
│ (Todos 11)(Argentina 3)(Chi… │  sticky: chips, scroll sideways
├──────────────────────────────┤
│ [Todos|Recomendados|No rec.] │  verdict
│ [Por lugar|Más recientes]    │  order
│ 11 lugares en 7 ciudades de… │  live count
│                              │
│ Argentina                    │  h2 on the blue field
│ Buenos Aires                 │  h3
│ ┌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┐ │
│ │ ticket                   │ │
│ └──────────────────────────┘ │
└──────────────────────────────┘
```

```
┌────────────────────────────────────────────────────────────────┐
│ ¿Dónde comió                                                   │
│ el Arturito?                                                   │
│ Qué pedir y qué evitar…     Proyecto de fan, no oficial. Por…  │
├────────────────────────────────────────────────────────────────┤
│ [Buscar…………………]  (Todos 11)(Argentina 3)(Chile 1)(Estados…    │  sticky
├────────────────────────────────────────────────────────────────┤
│ [Todos|Recomendados|No recomendados]  [Por lugar|Más recientes]│
│ 11 lugares en 7 ciudades de 5 países                           │
│                                                                │
│ Argentina                                                      │
│ Buenos Aires                                                   │
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐             │
│ │ ticket       │ │ ticket       │ │ ticket       │             │
│ └──────────────┘ └──────────────┘ └──────────────┘             │
│ Chile                                                          │
│ Santiago de Chile                                              │
│ ┌──────────────┐                                               │
└────────────────────────────────────────────────────────────────┘
```

### 8.2 Controls

The sticky bar holds only the search field and one row of location chips, and stays under about 112 px tall on phones (it measures 112 px). The location row drills down in place: it starts as "Todos" plus one chip per country with its count; choosing a country turns the same row into "Todos los países" (to go back), the selected country, and one chip per city in it. Pressing the country chip clears a selected city; pressing a selected city chip unselects it. Country chips and country headings carry the country's flag (§9.4). On phones the chips stay in one row that scrolls sideways, with no scrollbar and a fade at the right edge; the row starts at the beginning whenever it switches between countries and a country's cities. From 768 px the chips wrap onto more lines instead of scrolling, so the bar grows (México's 12 cities take three rows); scrolling to a deep-linked card measures the bar's height at that moment. They are real buttons with `aria-pressed`, inside a labeled group; after a chip is used, focus stays on the matching chip in the redrawn row. The row keeps its height while the data loads, so nothing below it moves.

Below the sticky bar, in normal flow, sit two segmented controls: verdict (Todos / Recomendados / No recomendados) and order (Por lugar / Más recientes). They are radio groups in fieldsets with visually hidden legends. They fit on one row from 360 px and wrap below that.

Chip counts reflect the search text and the verdict filter, but not the location selection itself. Chips with zero results are hidden, except the one currently selected. If `SHOW_NEEDS_REVIEW` is false, flagged entries are removed before anything else happens.

### 8.3 Search

Case- and accent-insensitive substring matching over the place name, the city, the country, and every item in both lists. A multi-word query requires every word to match somewhere in the entry, so "pizza buenos" finds the pizzería in Buenos Aires. Debounce input by about 120 ms; Enter applies the search at once and closes the phone keyboard. A 44 px clear button appears inside the field when it has text. Match highlighting is not part of v1.

### 8.4 Ordering

"Por lugar" is the default: countries A–Z, then cities A–Z, both with `Intl.Collator('es')`, shown as group headings. Within a city, recommended entries come before not-recommended ones, confirmed before "Por confirmar", then newest first.

"Más recientes" is a flat list, newest first, with no group headings. In both modes every card shows its own city and country.

### 8.5 URL state

State is mirrored to the query string with `history.replaceState`, using `q`, `pais`, `ciudad`, `veredicto` (`si` or `no`) and `orden` (`recientes`). Location values are slugs, as in `?pais=mexico&ciudad=ciudad-de-mexico`. Defaults are omitted, unknown values are ignored, and loading a URL restores its view. `ciudad` only counts together with a valid `pais`, because city slugs are only unique within a country.

Each card has `id="v-{video_id}"`. Opening a URL with that hash scrolls to the card and highlights it briefly; if the filters in the URL would hide it, search, location and verdict are cleared first (the order is kept, since it never hides anything).

### 8.6 Card

From top to bottom: the stamp (top right), the place name, city and country, the video date, the "Por confirmar" note when flagged, the unnamed-place hint when there's no name, the "Qué pedir" list, the "Qué evitar" list, and the two buttons. In the DOM the place name comes before the stamp, so screen readers reach the heading first. Each list shows its first 5 items; when two or more would be hidden, the rest go behind a "Ver N más" toggle, otherwise everything shows. The toggle is a button with `aria-expanded` placed after the list, so it reads "Ver menos" under the last item when open. On phones the buttons are full width and stacked, video first; they sit side by side once both labels fit on one line (from about 520 px in the single-column layout).

```
┌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┐  perforated top edge
│ Madre Rojas          /Recomendado/ │  rubber stamp, rotated
│ Buenos Aires, Argentina            │
│ Video de julio de 2026             │
│                                    │
│ Qué pedir                          │
│ ✓ Tortilla de harina con pan con…  │
│ ✓ Sashimi de wagyu                 │
│ ✓ Estracciatella con caquis        │
│ ✓ Brocheta de wagyu                │
│ ✓ Empanada de carne wagyu          │
│   Ver 6 más                        │
│                                    │
│ Qué evitar                         │
│ ✗ Un platillo de pescado no…       │
│                                    │
│ [ Ver reseña en TikTok           ] │
│ [ Abrir en Google Maps           ] │
└────────────────────────────────────┘
```

### 8.7 States

While loading, the header renders immediately and the results area shows "Cargando lugares…" (marked `aria-busy`, and tall enough that the about section doesn't jump when the cards arrive). On a load error, the results area shows the error copy with a link to the repo's issues. With no results, the live count reads the no-results copy and the results area shows the "Ver todos los lugares" button, which clears search and filters.

## 9. Visual direction

### 9.1 Concept

La comanda. Every place is a waiter's order ticket (a comanda) resting on a fonda table set with blue enamelware (peltre). A fonda is the small, family-run eatery found all over Mexico; peltre is the speckled blue enamel of its plates and mugs. The ticket is the unit of the design and its one memorable thing, and everything around it stays quiet. The metaphor fits because the heart of every review is literally an order: what to ask for, and what to skip.

### 9.2 Palette

| Name | Hex | Use |
|---|---|---|
| peltre | `#1F4E8C` | Page field (the table), sticky bar, primary button. |
| papel | `#FDFCF9` | Ticket paper. |
| imprenta | `#1E1D1B` | Printed text: place names, headings, labels. |
| carbón | `#2E348F` | The written order: list items, in carbon-copy ink. |
| palomita | `#1E7A4C` | Recommended stamp and check marks. |
| tache | `#C23127` | Not-recommended stamp and cross marks. |

Every pair used for text meets WCAG AA (measured): white on peltre 8.3:1, carbón on papel 10.2:1, imprenta on papel 16.4:1, palomita on papel 5.2:1, tache on papel 5.4:1, the muted note ink `#5C5850` on papel 6.9:1. Focus rings use a warm yellow (`#FFC93C`) on the blue field (5.4:1) and peltre on paper (8.1:1). The optional white speckles were left out (§15).

### 9.3 Type

One family: Archivo by Omnibus-Type (SIL Open Font License), self-hosted as a variable woff2 with its width axis, with `OFL.txt` alongside. The shipped file is the Latin subset, trimmed to weights 400–800 and widths 62–100 (58 KB). The title and place names use it condensed and heavy (width 70, weight 800), like the printed header of an order pad; body text and lists use normal width at 400–500. The site title is the typographic moment: very large, condensed, white on peltre, left aligned, set on two lines ("¿Dónde comió / el Arturito?").

Sentence case everywhere. Base size 17 px on phones and 18 px from 768 px, a 1.25 scale ratio, line height about 1.45 for body text and 1.0 for the title, and running text under about 70 characters per line. Fallback stack: `"Archivo", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`. Never fake condensing with `transform: scaleX`. Condensed headings and button labels get a little extra word spacing (0.06 em), because Archivo's condensed spaces run tight.

### 9.4 The ticket

White paper, square corners, a perforated top edge (the table color showing through a row of half-circle holes, drawn with a radial gradient), and a shadow tinted with the table color rather than neutral gray, as if the paper rests on the enamel. Tickets don't rotate; only the stamp does. The stamp is a rubber-stamp mark in the top-right corner: sentence-case text inside a double outline, in palomita or tache ink, rotated −6°. "Por confirmar" reads like a pencil note: small, muted, with a dashed underline, never a colored pill.

List markers are SVG strokes that look hand drawn: a palomita (the check mark Mexican teachers use) for things to order and a tache (the cross) for things to avoid, colored accordingly. They are drawn as CSS masks on a pseudo-element, so they are invisible to screen readers and the list headings carry the meaning. List items are set in carbón; everything printed uses imprenta.

Flags are small SVGs (20×15 in chips, scaled with the text in country headings) with a faint outline so white flags hold their edge. They are decorative (`alt=""`), since the country name sits next to them. Spanish country names are matched to ISO codes with `Intl.DisplayNames`, plus a few aliases such as "EE. UU.", so a new country gets its flag with no code change; a name with no match simply shows no flag.

The video button is solid peltre with white text and a play icon. The Maps button is outlined in imprenta with a pin icon. Button labels carry no appended arrows.

### 9.5 Layout

Left aligned throughout. On phones, one column with 16 px gutters. From 700 px, a grid with `repeat(auto-fill, minmax(300px, 1fr))`, 24 px gaps and `align-items: start`, up to 1200 px wide. Group headings sit on the blue field in white: the country large and condensed, the city smaller and slightly muted.

### 9.6 Motion

One orchestrated moment: on first render, the stamps on the cards in view land once (scaling from 1.15 to 1 with a quick fade, 180 ms each, staggered by 40 ms, via the Web Animations API). Nothing else moves on its own. Motion that answers an action is welcome: the extra list items fade in when "Ver N más" opens, and a deep-linked card gets a brief yellow outline. All motion is disabled under `prefers-reduced-motion`; the deep-link outline then shows without animating.

### 9.7 Dark mode

Follow `prefers-color-scheme`. The table deepens to `#0F2747`, tickets become night paper (`#1B2130`) with light ink (`#EDEBE5`, carbón `#B3BCFF`), and the stamp inks lighten (palomita `#5FC28E`, tache `#FF8A7A`). Measured on night paper: ink 13.5:1, carbón 8.8:1, palomita 7.3:1, tache 7.0:1, muted note ink `#B4B0A7` 7.4:1. Peltre is too close to night paper for a button fill or a focus ring (1.9:1), so in dark mode the video button uses `#2B5FA6` (white text 6.4:1) and focus rings on paper turn yellow (10.5:1).

### 9.8 What to avoid

These are the defaults that make generated sites look alike, plus a few traps specific to this one: a cream background with a serif display and a terracotta accent; near-black with a single acid-bright accent; newspaper hairlines and dense columns; identical rounded cards with the same soft gray shadow and gradient washes; all-caps or letter-spaced labels above headings; metadata strings joined with middle dots; arrows appended to button text; monospace for small labels; emoji as icons; and emoji flags in particular, which Windows renders as two letters (the site uses SVG flag files instead).

Before calling the design done, take screenshots at 360 px and 1280 px if your environment allows it, compare them against this section, and remove one decoration. (Done: the hairline under the sticky bar was removed.)

## 10. Architecture

### 10.1 Stack

Static HTML, CSS and vanilla JavaScript modules. No framework, no bundler, no runtime dependencies: the site runs exactly as the files sit in the repo. A `package.json` exists only to set `"type": "module"` and define `test` and `validate` scripts, with no dependencies. The reasoning: the only thing that changes is a JSON file, so there's nothing to rebuild, and a dependency-free site will still work years from now.

### 10.2 Repository layout

```
.
├── index.html
├── assets/
│   ├── css/styles.css
│   ├── js/
│   │   ├── config.js    # everything Luis may want to edit
│   │   ├── data.js      # pure: validate, normalize, derive (importable from Node)
│   │   ├── filters.js   # pure: search, facets, ordering, grouping, URL mapping
│   │   ├── flags.js     # pure: country name → flag file
│   │   ├── render.js    # DOM building
│   │   └── main.js      # boot: load data, wire events, sync URL
│   ├── fonts/           # archivo-latin-var.woff2 + OFL.txt
│   ├── flags/           # country flags from flag-icons (SVG) + LICENSE.txt
│   └── og.png           # 1200×630 share image
├── data/
│   └── lugares.json     # the only file that changes regularly
├── scripts/
│   └── validate.mjs     # data check, used locally and in CI
├── tests/
│   ├── fixtures/        # lugares-v1.json (copy of the v1 data) and roto.json (deliberately broken)
│   ├── data.test.mjs
│   ├── filters.test.mjs
│   ├── validate.test.mjs
│   ├── flags.test.mjs
│   └── security.test.mjs
├── .github/workflows/pages.yml
├── package.json         # "type": "module" and scripts, nothing else
├── DESIGN.md
├── README.md
└── LICENSE              # MIT, covers the code only
```

`assets/js/config.js`:

```js
export const SITE = {
  title: '¿Dónde comió el Arturito?',
  author: 'lasr21',
  // Where people can reach you (corrections, takedown requests): shown as "mándame un DM en X o Instagram".
  social: [
    { label: 'X', url: 'https://x.com/lasr21' },
    { label: 'Instagram', url: 'https://www.instagram.com/lasr21/' },
  ],
  repoUrl: 'https://github.com/lasr21/el_arturito',
};

export const CREATOR = {
  name: 'El Arturito',
  handle: '@soyelarturito',
  links: [
    { label: 'TikTok', url: 'https://www.tiktok.com/@soyelarturito' },
    { label: 'YouTube', url: 'https://www.youtube.com/@soyelarturito' },
    // TODO(Luis): add Instagram once the handle is verified.
  ],
};

export const DATA_URL = 'data/lugares.json'; // relative to index.html
export const SHOW_NEEDS_REVIEW = true;       // false hides entries flagged by the pipeline
export const LIST_PREVIEW = 5;               // items shown before "Ver N más"
```

`SITE.social` feeds both the footer and the takedown line. `repoUrl` was derived from the git remote.

### 10.3 Loading

Load the data with `fetch(DATA_URL, { cache: 'no-cache' })` so a new file shows up right after a deploy. Every URL in the site is relative: GitHub project pages live under `/<repo>/`, and root-absolute paths such as `/data/...` break there. Opening `index.html` straight from disk won't work, because browsers block `fetch` on `file://`; the README explains how to serve it locally.

### 10.4 Security

The data comes from an automated pipeline, so it's untrusted input. Build the DOM with `createElement` and `textContent`; never pass data through `innerHTML`, `insertAdjacentHTML` or markup strings. Links pass an allowlist or are treated as missing: video links must start with `https://www.tiktok.com/` and contain `/video/{video_id}` or `/photo/{video_id}` (followed by `/`, `?`, `#` or the end, so a longer ID doesn't match); Maps links must start with `https://www.google.com/maps/` or `https://maps.app.goo.gl/`. External links use `target="_blank" rel="noopener"`.

The page carries this Content Security Policy as a meta tag: `default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'self'; form-action 'none'`. That means no inline scripts and no `style` attributes; the icons are `data:` SVGs in the stylesheet, and the stamp animation uses the Web Animations API. `tests/security.test.mjs` fails if any of this regresses.

### 10.5 Performance

No third-party requests at load. The site's own HTML, CSS and JS stay under about 50 KB gzipped (about 17 KB today); the font is subset to Latin, preloaded, and uses `font-display: swap`. Rendering goes through a `DocumentFragment`, cards are built once and reused across filter changes, and tickets use `content-visibility: auto`, so a few thousand entries stay smooth.

### 10.6 Accessibility

Set `lang="es-MX"`; use header, main and footer landmarks; add a skip link to the results; label every control; put the result count in an `aria-live="polite"` region. Heading levels follow the grouping: the site is h1, countries h2, cities h3, places h4, list headings h5; in the flat view places are h3 under a visually hidden h2, with list headings h4. The verdict is carried by the stamp's text, never by color alone. Card buttons point to the place name with `aria-describedby`, since every card repeats the same labels. Chip counts read as "3 lugares". Meet WCAG AA contrast, keep focus visible everywhere, make touch targets at least 44×44 px, and respect reduced motion.

### 10.7 Sharing and search engines

The page has a title, a meta description, and Open Graph and Twitter card tags pointing to `assets/og.png` (1200×630: the site title set on the peltre field, with a small ticket). `og:image` and `og:url` use the absolute Pages URL derived from the git remote, `https://lasr21.github.io/el_arturito/`. The favicon is a small inline SVG (a white palomita on peltre), not an emoji.

## 11. Deploy, updates and README

### 11.1 Workflow

`.github/workflows/pages.yml` runs on pushes to `main`, on pull requests, and on manual dispatch. A `check` job sets up Node (current LTS) and runs `node scripts/validate.mjs data/lugares.json` and `node --test`. On `main` only, a `deploy` job that depends on `check` copies `index.html`, `assets/` and `data/` into `_site/` and publishes it with the official Pages actions (`actions/configure-pages@v5`, `actions/upload-pages-artifact@v4`, `actions/deploy-pages@v4`). Permissions: `contents: read`, `pages: write`, `id-token: write`, with a `pages` concurrency group. The result is that a malformed data file fails the check and never reaches the live site.

One manual step for Luis, once: in the repo's Settings → Pages, set the source to GitHub Actions.

### 11.2 Updating the data

Luis exports the full list from his offline pipeline, optionally runs `node scripts/validate.mjs <file>` on it, replaces `data/lugares.json`, and pushes. The workflow validates and deploys. New places, cities and countries need no code changes.

### 11.3 Local preview

Serve the folder over HTTP, for example with `python -m http.server 8000` or `npx serve .`, and open `http://localhost:8000`. Run the tests with `node --test`.

### 11.4 README

`README.md` is written in Spanish. It opens with the short disclaimer and links to his accounts, then explains what the site is, who made it (lasr21, with X and Instagram), how the guide is put together (without detailing the offline pipeline), how to update the data (§11.2), how to preview locally (§11.3), the one-time Pages setting, and the settings in `config.js`. It closes with credits, giving all credit for the reviews to El Arturito with his links, and the license: MIT for the code, while the data summarizes his public videos and claims no rights over his content.

## 12. Validator

`scripts/validate.mjs` is a zero-dependency Node script. It imports its rules from `assets/js/data.js`, so the browser and CI agree on what's valid. Without an argument it checks `data/lugares.json`.

It fails with exit code 1 on: unreadable JSON; a top level that isn't an array; an entry that isn't an object; a required field that's missing or has the wrong type; a `video_id` that isn't a digit string; a duplicated `video_id`; a `url` that fails the allowlist or doesn't match its `video_id`; a non-null `enlace_google_maps` that fails the allowlist; empty strings inside `que_pedir` or `que_evitar`; an empty `ciudad` or `pais`.

It warns, with exit code 0, on: a null or blank `nombre_lugar`; `necesita_revision_manual: true`; the same place name and city in more than one video; a decoded date outside the plausible range; country or city names that differ only in case, accents or spacing; unknown fields, listed once.

The output is a short report in Spanish that names the `video_id` behind each finding (or `#n`, the entry's position, when the ID itself is unusable) and ends with a summary line such as "11 entradas, 0 errores, 1 aviso".

## 13. Acceptance checks

These refer to the data as it stands for v1 (eleven entries). Tests use a fixture copy, so they keep passing as the live data grows.

| # | Check | How to verify |
|---|---|---|
| 1 | Works under a subpath | Serve the parent folder and open `/<folder>/`; everything loads. |
| 2 | Current data renders | 11 cards; the count reads "11 lugares en 7 ciudades de 5 países". |
| 3 | Unnamed places | The Austin card shows "Lugar por identificar" with the hint, keeps the TikTok button, and shows no Maps button. |
| 4 | Negative verdict | Fuente Alemana shows "No recomendado" and "Si vas, pide". |
| 5 | Long lists | Cantón Mexicali shows 5 items and "Ver 9 más", which expands with mouse and keyboard; Capitanía 624 shows all 6 items with no toggle. |
| 6 | Grouped order | Argentina, Chile, Estados Unidos, Italia, México. Buenos Aires lists Medias Lunas Marpla, Madre Rojas, then La Mezzetta. With La Mezzetta flagged, it shows "Por confirmar" and still sorts last. |
| 7 | Recency order | "Más recientes" starts with La Matrichana de 1870 (September 2026) and ends with La Mezzetta (July 2026). |
| 8 | Search | "mexico" returns the 4 places in México; "wagyu" returns Madre Rojas; "pizza buenos" returns La Mezzetta. |
| 9 | Drill-down and URL | Choosing Argentina shows a Buenos Aires chip with count 3, the URL gains `?pais=argentina`, and reloading restores the view. |
| 10 | Deep link | `#v-7662117502515760402` scrolls to and highlights Fuente Alemana, even when a URL filter would hide it. |
| 11 | Keyboard | Every control is reachable, focus is always visible, and chips toggle with Enter and Space. |
| 12 | Small screens | At 320 px there's no horizontal page scroll and touch targets are at least 44 px; at 390×844 the top of the first card shows without scrolling. |
| 13 | Preferences | Dark mode and reduced motion are honored. |
| 14 | Privacy | The browser's network panel shows no third-party requests on load. |
| 15 | Safety | No data passes through `innerHTML` (grep for it); the CSP is present and the console shows no violations. |
| 16 | Validator | Current data: 0 errors, with a warning for the unnamed Austin place. Broken fixture: exit code 1. |
| 17 | Tests | `node --test` passes, covering normalization, slugs, date decoding (`7665131431257066759` is 21 July 2026, `7689148407067217159` is 24 September 2026, `7658025624853826834` is 2 July 2026), search, facets, ordering, the Maps fallback and the URL allowlist. |
| 18 | Lighthouse, mobile | Accessibility ≥ 95, Performance ≥ 90, Best Practices ≥ 95. |
| 19 | Handover | The final report lists every remaining `TODO(Luis)`. |

## 14. Later, not v1

If the pipeline ever adds coordinates, a "cerca de mí" filter and a map built with Leaflet and OpenStreetMap tiles would work without any Google key. Other candidates: an RSS or Atom feed of newly added places, a "mi lista" of saved places in `localStorage` for planning a trip, an English version, prerendered HTML for search engines, and per-city share images.

## 15. Decision log

| Decision | Reason |
|---|---|
| Vanilla static site, no build step | Only the JSON changes, so there's nothing to rebuild or upgrade. |
| Data file is a full snapshot | Keeps the site stateless; merging and cleanup live in the offline pipeline. |
| Link out to TikTok; no embeds, no thumbnails | Sends views to him, avoids third-party scripts, and TikTok thumbnail URLs expire. |
| Google Maps search links, no API | No keys, no billing, good enough to find the place. |
| Dates derived from video IDs | No extra data needed, and menus change, so dates matter. |
| Spanish UI | His audience and the data are in Spanish. |
| Flagged entries shown, marked "Por confirmar" | They still carry a useful video link; one config flag hides them. |

The building agent appends its decisions below this line.

| Decision | Reason |
|---|---|
| `restaurants.json` moved to `data/lugares.json`; the brief's numbers updated to the real data (11 entries, 7 cities, 5 countries) | The file handed over was newer than the one the brief described: it adds Trattoria Da Enzo al 29 and Villa Torel, and the Buenos Aires pizzería is now named (La Mezzetta) and not flagged. §5.3, §5.4, §7, §8.1, §12 and §13 now match it. |
| The test fixture is a copy of the 11-entry file; the flagged case is tested with synthetic entries | The 9-entry snapshot wasn't available, and recreating it would mean inventing data. |
| `slug` keeps letters and digits of any script (`\p{L}\p{N}`) | Same output as `[a-z0-9]` for Latin names, but a city or country written in another script no longer collapses to an empty key shared with every other such name. |
| `capitalize` leaves text that starts with a digit alone | "18 meses…" should not become "18 Meses…". |
| The browser and the validator run the same `checkEntry`; any entry with an error is skipped at runtime | One definition of valid. CI already blocks bad files, so the runtime check only guards against a file that skipped CI. |
| A duplicated `video_id`: the first occurrence wins | IDs are keys and anchors; CI reports the later ones as errors. |
| `ciudad` in the URL needs a valid `pais` | City slugs are only unique within a country. |
| Deep links clear search, location and verdict, and keep the order | The order never hides a card. |
| "Todos los países" has no count; the selected country chip shows its count and clears the city | It is a way back, not a filter; the country chip already carries the number. |
| "Ver N más" is a button with `aria-expanded`, not `<details>` | A `<summary>` would stay above the extra items, so "Ver menos" would sit mid-list. The button stays under the last item. |
| Icons (play, pin, search, clear, palomita, tache) are `data:` SVGs used as CSS masks | Same strokes as inline SVG, fewer nodes per ticket, no markup strings, allowed by the CSP (`img-src data:`), and they take the text color. |
| Stamp landing uses the Web Animations API | Staggering without `style` attributes, which the CSP forbids. |
| No speckles on the table; the sticky bar's hairline removed as the "one decoration" | Nearly every part of the field carries text, and speckles may never sit behind text. The hairline added nothing once the bar matched the table. |
| Dark mode: video button `#2B5FA6`, yellow focus rings on night paper | Peltre against night paper is 1.9:1, too faint for a button edge or a focus ring. |
| Font: Google Fonts' Archivo Latin subset (v2.001), instanced to weights 400–800 and widths 62–100 with fontTools | Keeps the width axis while dropping ranges the site never uses: 58 KB instead of 90 KB. |
| A 44 px clear button inside the search field; the native one is hidden | The native clear control is too small a touch target. |
| While loading, the chip row keeps its height and the results area is viewport-tall (`aria-busy`) | Without it, the about section was in view during load and jumped when the cards arrived (CLS 0.53 → 0.002). |
| Card buttons wrap on their own (`flex: 1 1 auto`) instead of switching at a fixed 480 px | They sit side by side exactly when both labels fit on one line, which in the single-column layout happens from about 520 px. |
| The unnamed-place hint goes after the date, next to where "Por confirmar" goes | Both are notes about the data, set in the same muted style. |
| The follow line lives in the footer | The about note already asks people to follow him; the footer gives the links. |
| `repoUrl` and the Pages URL derived from the git remote (`lasr21/el_arturito`) | Avoids two `TODO(Luis)` placeholders. |
| Workflow uses `actions/checkout@v5`, `actions/setup-node@v5`, `configure-pages@v5`, `upload-pages-artifact@v4`, `deploy-pages@v4` | The latest majors known at build time; not checked online from the build environment. Bump them if GitHub has released newer ones. |
| `tests/security.test.mjs` checks the source for `innerHTML` and similar, inline scripts and styles, the CSP, and root-absolute paths | Makes checks 1 and 15 permanent instead of manual. |
| Country flags as SVG files from flag-icons (MIT), all ~250 shipped | Emoji flags render as two letters on Windows. Shipping every flag keeps the zero-maintenance promise for new countries; a visitor only downloads the flags on screen. |
| Flags matched through `Intl.DisplayNames('es')` plus a short alias list | No hand-kept country table; "México", "Mexico" and "EE. UU." all resolve. |
| Chips wrap from 768 px and scroll only on phones, with the scrollbar hidden and a right-edge fade | With México's 12 cities the desktop row was clipped mid-chip and showed a stray scrollbar line. The sticky bar grows instead, and deep links measure it. |
| The chip row's scroll position resets when it switches level | Carrying the country row's scroll into the city row hid "Todos los países" off the left edge. |
| Corrections and takedowns go to a DM on X or Instagram (`SITE.social`) instead of GitHub issues or an email | Luis's preference; it also resolved the `SITE.contact` TODO. |
| The Maps button has an explicit paper background instead of transparent | Same look; contrast checkers can't see the ticket behind skipped (`content-visibility`) cards and reported false failures. |
