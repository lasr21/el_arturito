#!/usr/bin/env node
// Checks a lugares.json export before it goes live. Zero dependencies.
// Usage: node scripts/validate.mjs [archivo.json]   (default: data/lugares.json)
// Exit code 1 when there are errors; warnings alone exit with 0.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { validateData, plural } from '../assets/js/data.js';

const file = process.argv[2] ?? fileURLToPath(new URL('../data/lugares.json', import.meta.url));

let data;
let result;
try {
  data = JSON.parse(readFileSync(file, 'utf8'));
  result = validateData(data);
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
