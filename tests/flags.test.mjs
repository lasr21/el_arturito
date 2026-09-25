import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { flagFor } from '../assets/js/flags.js';

test('Spanish country names find their flag, with or without accents', () => {
  assert.equal(flagFor('México'), 'assets/flags/mx.svg');
  assert.equal(flagFor('mexico'), 'assets/flags/mx.svg');
  assert.equal(flagFor('Estados Unidos'), 'assets/flags/us.svg');
  assert.equal(flagFor('EE. UU.'), 'assets/flags/us.svg');
  assert.equal(flagFor('Mónaco'), 'assets/flags/mc.svg');
  assert.equal(flagFor('Japón'), 'assets/flags/jp.svg');
  assert.equal(flagFor('Narnia'), null);
});

test('every country in the data has a flag file', () => {
  const data = JSON.parse(readFileSync(new URL('../data/lugares.json', import.meta.url), 'utf8'));
  for (const pais of new Set(data.map(e => e.pais))) {
    const path = flagFor(pais);
    assert.ok(path, `sin bandera: ${pais}`);
    assert.ok(existsSync(new URL(`../${path}`, import.meta.url)), path);
  }
});
