import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const html = read('index.html');

test('no data reaches the DOM as markup', () => {
  for (const file of readdirSync(new URL('../assets/js/', import.meta.url))) {
    const code = read(`assets/js/${file}`).replace(/\/\/.*$/gm, '');
    assert.doesNotMatch(code, /\b(innerHTML|outerHTML|insertAdjacentHTML|document\.write|eval)\b/, file);
  }
});

test('the page declares the Content Security Policy', () => {
  const csp = "default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'self'; form-action 'none'";
  assert.ok(html.includes(`<meta http-equiv="Content-Security-Policy" content="${csp}">`));
});

test('no inline scripts, style blocks or style attributes', () => {
  for (const [, attrs] of html.matchAll(/<script\b([^>]*)>/g)) assert.match(attrs, /\bsrc=/);
  assert.doesNotMatch(html, /<style\b/);
  assert.doesNotMatch(html, /\sstyle=/);
});

test('asset paths are relative, so the site works under /<repo>/', () => {
  for (const [, url] of html.matchAll(/\s(?:src|href)="([^"]*)"/g)) {
    assert.ok(!url.startsWith('/'), url);
  }
  assert.doesNotMatch(read('assets/css/styles.css'), /url\(["']?\//);
});

test('external links open in a new tab without an opener', () => {
  for (const [tag] of html.matchAll(/<a\b[^>]*href="https?:[^>]*>/g)) {
    assert.match(tag, /target="_blank"/);
    assert.match(tag, /rel="noopener"/);
  }
});
