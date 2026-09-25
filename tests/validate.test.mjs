import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('../scripts/validate.mjs', import.meta.url));
const fixture = name => fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url));
const run = file => spawnSync(process.execPath, [script, file], { encoding: 'utf8' });

test('the v1 data passes with a warning for the unnamed place', () => {
  const { status, stdout } = run(fixture('lugares-v1.json'));
  assert.equal(status, 0);
  assert.match(stdout, /7681454363881278728: no tiene nombre del lugar/);
  assert.match(stdout, /11 entradas, 0 errores, 1 aviso$/m);
});

test('the broken fixture fails and names each entry', () => {
  const { status, stdout } = run(fixture('roto.json'));
  assert.equal(status, 1);
  for (const expected of [
    /7665131431257066759: "video_id" repetido/,
    /#3: "video_id" debe ser un texto con solo dígitos/,
    /7658025624853826834: "url" no es un enlace de TikTok a este video/,
    /7662117502515760402: "url" no es un enlace de TikTok a este video/,
    /7681454363881278728: "enlace_google_maps" no es un enlace de Google Maps permitido/,
    /7665825493203160338: "recomendado" debe ser true o false/,
    /7665825493203160338: "que_pedir" tiene elementos vacíos/,
    /7665825493203160338: "que_evitar" debe ser una lista de textos/,
    /7665825493203160338: "ciudad" está vacío/,
    /7678824158536518930: falta el campo "pais"/,
    /#9: la entrada no es un objeto/,
  ]) assert.match(stdout, expected);
  assert.match(stdout, /9 entradas, 14 errores, 0 avisos$/m);
});

test('unreadable JSON and a non-list top level fail', () => {
  const dir = mkdtempSync(join(tmpdir(), 'lugares-'));
  const bad = join(dir, 'malo.json');
  writeFileSync(bad, '{"a":');
  assert.equal(run(bad).status, 1);
  const obj = join(dir, 'objeto.json');
  writeFileSync(obj, '{"lugares": []}');
  const { status, stdout } = run(obj);
  assert.equal(status, 1);
  assert.match(stdout, /debe contener una lista/);
  assert.equal(run(join(dir, 'no-existe.json')).status, 1);
});
