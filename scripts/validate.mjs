#!/usr/bin/env node
// Checks a lugares.json export before it goes live. Zero dependencies.
// Usage: node scripts/validate.mjs [archivo.json]   (default: data/lugares.json)
// Also checks resumenes.json when it sits next to the data file.
// Exit code 1 when there are errors; warnings alone exit with 0.

import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateData, plural } from '../assets/js/data.js';

const file = process.argv[2] ?? fileURLToPath(new URL('../data/lugares.json', import.meta.url));

let data;
let result;
try {
  data = JSON.parse(readFileSync(file, 'utf8'));
  const summariesFile = join(dirname(file), 'resumenes.json');
  let summaries = null;
  if (existsSync(summariesFile)) {
    try {
      summaries = JSON.parse(readFileSync(summariesFile, 'utf8'));
    } catch (err) {
      throw new Error(`resumenes.json no es JSON válido: ${err.message}`);
    }
  }
  result = validateData(data, { summaries });
} catch (err) {
  result = { errors: [{ id: null, message: `no se pudo leer el archivo como JSON (${err.message})` }], warnings: [] };
}

const line = ({ id, message }) => `  ${id ? `${id}: ` : ''}${message}`;
const out = [`Revisando ${file}`];
if (result.errors.length) out.push('', 'Errores', ...result.errors.map(line));
if (result.warnings.length) out.push('', 'Avisos', ...result.warnings.map(line));
const total = Array.isArray(data) ? data.length : 0;
out.push('', [
  plural(total, 'entrada', 'entradas'),
  plural(result.errors.length, 'error', 'errores'),
  plural(result.warnings.length, 'aviso', 'avisos'),
].join(', '));

console.log(out.join('\n'));
process.exitCode = result.errors.length ? 1 : 0;
