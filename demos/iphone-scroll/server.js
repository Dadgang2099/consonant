#!/usr/bin/env node
/**
 * Dev server for demos/iphone-scroll
 * - Serves static files from this directory
 * - POST /push-live  → writes live.json (survives page refresh for all visitors)
 * - GET  /live.json  → served as a normal static file once written
 *
 * Usage:  node demos/iphone-scroll/server.js
 *         npm run demo:iphone
 */

import http from 'http';
import fs   from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ROOT = __dirname;
const PORT = process.env.PORT || 3737;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css',
  '.js':   'application/javascript',
  '.json': 'application/json',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png':  'image/png',
  '.svg':  'image/svg+xml',
  '.mp4':  'video/mp4',
  '.webm': 'video/webm',
  '.woff2':'font/woff2',
  '.woff': 'font/woff',
  '.ttf':  'font/ttf',
};

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  // ── PUSH LIVE ──────────────────────────────────────────────
  if (req.method === 'POST' && url.pathname === '/push-live') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body);
        const dest    = path.join(ROOT, 'live.json');
        fs.writeFileSync(dest, JSON.stringify(payload, null, 2));
        console.log('[push-live] live.json updated', new Date().toLocaleTimeString());
        res.writeHead(200, { 'Content-Type': 'application/json', ...CORS });
        res.end(JSON.stringify({ ok: true, ts: new Date().toISOString() }));
      } catch (e) {
        console.error('[push-live] error:', e.message);
        res.writeHead(400, CORS);
        res.end(JSON.stringify({ ok: false, error: e.message }));
      }
    });
    return;
  }

  // ── CORS preflight ─────────────────────────────────────────
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS);
    res.end();
    return;
  }

  // ── Static files ───────────────────────────────────────────
  let pathname = url.pathname === '/' ? '/index.html' : url.pathname;
  const filePath = path.join(ROOT, pathname);

  // Prevent directory traversal outside ROOT
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403); res.end('Forbidden'); return;
  }

  fs.stat(filePath, (statErr, stat) => {
    if (statErr) { res.writeHead(404); res.end('Not found'); return; }

    const ext  = path.extname(filePath).toLowerCase();
    const type = MIME[ext] || 'application/octet-stream';
    const size = stat.size;

    // Byte-range support — required for video seeking in browsers
    const rangeHeader = req.headers['range'];
    if (rangeHeader) {
      const [startStr, endStr] = rangeHeader.replace('bytes=', '').split('-');
      const start = parseInt(startStr, 10);
      const end   = endStr ? parseInt(endStr, 10) : size - 1;
      const chunkLen = end - start + 1;
      res.writeHead(206, {
        'Content-Range':  `bytes ${start}-${end}/${size}`,
        'Accept-Ranges':  'bytes',
        'Content-Length': chunkLen,
        'Content-Type':   type,
        ...CORS,
        'Cache-Control': 'no-store',
      });
      fs.createReadStream(filePath, { start, end }).pipe(res);
      return;
    }

    const noCache = { 'Cache-Control': 'no-store, no-cache, must-revalidate', 'Pragma': 'no-cache', 'Expires': '0' };
    res.writeHead(200, {
      'Content-Type':  type,
      'Accept-Ranges': 'bytes',
      'Content-Length': size,
      ...CORS,
      ...noCache,
    });
    fs.createReadStream(filePath).pipe(res);
  });

}).listen(PORT, () => {
  console.log(`\n  iPhone scroll demo`);
  console.log(`  http://localhost:${PORT}\n`);
  console.log(`  PUSH LIVE  →  POST /push-live  →  writes live.json`);
  console.log(`  Refresh any browser tab and settings reload automatically\n`);
});
