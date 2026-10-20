// Local server: serves the UI from public/ and runs scans at /api/scan,
// streaming progress to the page as Server-Sent Events so the lantern sweep
// follows the real scan. No framework, just Node.

import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scan } from './src/scan.js';
import { toMarkdown, toCsv } from './src/report.js';

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '127.0.0.1';
// Set HOSTED=1 when other people can reach this server: it blocks private
// network addresses and keeps scans small.
const HOSTED = process.env.HOSTED === '1';
const MAX_PAGES = HOSTED ? 30 : 200;
const MAX_CONCURRENT = HOSTED ? 3 : 5;

const PUBLIC = fileURLToPath(new URL('./public/', import.meta.url));
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.mp3': 'audio/mpeg', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };

let running = 0;

async function serveStatic(req, res, pathname) {
  const rel = normalize(decodeURIComponent(pathname === '/' ? '/index.html' : pathname)).replace(/^(\.\.[/\\])+/, '');
  const file = join(PUBLIC, rel);
  if (!file.startsWith(PUBLIC)) { res.writeHead(403); return res.end(); }
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('Nothing buried here.');
  }
}

async function handleScan(req, res, params) {
  const target = params.get('url');
  if (!target) { res.writeHead(400); return res.end('Missing url'); }
  if (running >= MAX_CONCURRENT) { res.writeHead(429); return res.end('Too many scans right now. Try again in a minute.'); }

  res.writeHead(200, {
    'content-type': 'text/event-stream',
    'cache-control': 'no-cache',
    connection: 'keep-alive',
  });
  const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  let closed = false;
  req.on('close', () => { closed = true; });

  running++;
  try {
    const maxPages = Math.min(Number(params.get('maxPages')) || 50, MAX_PAGES);
    const result = await scan(target, {
      maxPages,
      external: params.get('external') !== '0',
      allowPrivate: !HOSTED,
    }, (e) => {
      if (closed) return;
      if (e.type === 'done') return;
      send('progress', e);
    });
    if (!closed) send('done', result);
  } catch (err) {
    if (!closed) send('fail', { message: err.message });
  } finally {
    running--;
    res.end();
  }
}

// Exports: POST the result JSON back, get markdown or CSV to download.
async function handleExport(req, res, format) {
  let raw = '';
  for await (const chunk of req) { raw += chunk; if (raw.length > 5_000_000) break; }
  try {
    const result = JSON.parse(raw);
    const body = format === 'csv' ? toCsv(result) : toMarkdown(result, { title: `Ghosts on ${result.site}` });
    res.writeHead(200, {
      'content-type': format === 'csv' ? 'text/csv' : 'text/markdown',
      'content-disposition': `attachment; filename="graveyard-report.${format === 'csv' ? 'csv' : 'md'}"`,
    });
    res.end(body);
  } catch {
    res.writeHead(400); res.end('Bad report');
  }
}

const server = http.createServer(async (req, res) => {
  const { pathname, searchParams } = new URL(req.url, 'http://local');
  if (pathname === '/api/scan' && req.method === 'GET') return handleScan(req, res, searchParams);
  if (pathname === '/api/export' && req.method === 'POST') return handleExport(req, res, searchParams.get('format'));
  if (req.method === 'GET') return serveStatic(req, res, pathname);
  res.writeHead(405); res.end();
});

server.listen(PORT, HOST, () => {
  console.log(`\n  🏮 Graveyard Shift is open at http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}\n`);
});
