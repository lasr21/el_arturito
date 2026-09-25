// Country flags: SVGs in assets/flags/ (flag-icons, MIT). Pure, so the tests can import it.
// Spanish country names are matched through Intl.DisplayNames, so a new country
// in the data gets its flag with no code change.

import { norm } from './data.js';

// Two-letter codes with a file in assets/flags/.
const CODES = 'ad ae af ag ai al am ao aq ar as at au aw ax az ba bb bd be bf bg bh bi bj bl bm bn bo bq br bs bt bv bw by bz ca cc cd cf cg ch ci ck cl cm cn co cp cr cu cv cw cx cy cz de dg dj dk dm do dz ec ee eg eh er es et eu fi fj fk fm fo fr ga gb gd ge gf gg gh gi gl gm gn gp gq gr gs gt gu gw gy hk hm hn hr ht hu ic id ie il im in io iq ir is it je jm jo jp ke kg kh ki km kn kp kr kw ky kz la lb lc li lk lr ls lt lu lv ly ma mc md me mf mg mh mk ml mm mn mo mp mq mr ms mt mu mv mw mx my mz na nc ne nf ng ni nl no np nr nu nz om pa pc pe pf pg ph pk pl pm pn pr ps pt pw py qa re ro rs ru rw sa sb sc sd se sg sh si sj sk sl sm sn so sr ss st sv sx sy sz tc td tf tg th tj tk tl tm tn to tr tt tv tw tz ua ug um un us uy uz va vc ve vg vi vn vu wf ws xk xx ye yt za zm zw'.split(' ');

// Names the pipeline may use that Intl.DisplayNames doesn't give.
const ALIASES = {
  'ee. uu.': 'us', 'ee.uu.': 'us', 'eeuu': 'us', 'eua': 'us', 'usa': 'us', 'estados unidos de america': 'us',
  'inglaterra': 'gb-eng', 'escocia': 'gb-sct', 'gales': 'gb-wls', 'holanda': 'nl', 'corea': 'kr',
  'republica checa': 'cz', 'vaticano': 'va', 'ciudad del vaticano': 'va',
};

let byName = null;
function names() {
  if (byName) return byName;
  byName = new Map(Object.entries(ALIASES));
  const display = new Intl.DisplayNames(['es'], { type: 'region' });
  for (const code of CODES) {
    try {
      const name = display.of(code.toUpperCase());
      if (name && name !== code.toUpperCase() && !byName.has(norm(name))) byName.set(norm(name), code);
    } catch { /* not a region code */ }
  }
  return byName;
}

/** Path of the flag for a country name, relative to index.html, or null. */
export function flagFor(pais) {
  const code = names().get(norm(pais));
  return code ? `assets/flags/${code}.svg` : null;
}
