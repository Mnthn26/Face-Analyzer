// Publish only the standalone desk assistant, never the repository or source tests.
// No bundler or dependencies are required; safe to run on any Node.js 20+ host.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
const output = new URL('site/', root);
const html = await readFile(new URL('public/desk-assistant.html', root), 'utf8');
if (!html.includes('<title>Deskwise') || !html.includes('getUserMedia')) {
  throw new Error('Deskwise source is missing or incomplete; refusing to publish.');
}
await mkdir(output, { recursive: true });
await Promise.all([
  writeFile(new URL('index.html', output), html),
  writeFile(new URL('desk-assistant.html', output), html),
  writeFile(new URL('_headers', output), `/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(self), microphone=(), geolocation=(), screen-wake-lock=(self)
  Cache-Control: public, max-age=0, must-revalidate
`),
  writeFile(new URL('404.html', output), '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Page not found · Deskwise</title><body style="background:#111715;color:#e8efe9;font:18px system-ui;padding:10vw"><h1>That page isn’t here.</h1><a style="color:#c1ef9d" href="/">Back to Deskwise</a></body></html>'),
]);
console.log('Deskwise website ready in site/ — index.html is the live-camera homepage.');
