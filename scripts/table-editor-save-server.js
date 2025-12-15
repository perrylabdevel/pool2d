#!/usr/bin/env node
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';

const DEFAULT_PORT = 8090;
const port = Number.parseInt(process.env.TABLE_EDITOR_SAVE_PORT || '', 10) || DEFAULT_PORT;

const repoRoot = process.cwd();
const tablesDir = path.join(repoRoot, 'src', 'geometry', 'tables');
const activePath = path.join(repoRoot, 'src', 'geometry', 'table.physics.json');

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  });
  res.end(body);
}

function sanitizeFilename(name) {
  const base = String(name || 'table')
    .trim()
    .replace(/[^\w\-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80);
  return base.length ? base : 'table';
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const buf = Buffer.concat(chunks);
  return buf.toString('utf8');
}

const server = http.createServer(async (req, res) => {
  if (!req.url) {
    res.writeHead(404).end();
    return;
  }

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
    });
    res.end();
    return;
  }

  if (req.method === 'POST' && req.url === '/api/table-editor/save') {
    try {
      const raw = await readBody(req);
      const data = JSON.parse(raw);

      if (!data || typeof data !== 'object') {
        sendJson(res, 400, { error: 'Invalid JSON body' });
        return;
      }

      const physicsJson = data.physicsJson;
      if (!physicsJson || !physicsJson.playArea || !Array.isArray(physicsJson.pockets) || !Array.isArray(physicsJson.rails)) {
        sendJson(res, 400, { error: 'Missing/invalid physicsJson' });
        return;
      }

      const filename = sanitizeFilename(data.name || data.tableId || 'table');
      await fs.mkdir(tablesDir, { recursive: true });
      const tablePath = path.join(tablesDir, `${filename}.physics.json`);

      const jsonText = JSON.stringify(physicsJson, null, 2) + '\n';
      await fs.writeFile(tablePath, jsonText, 'utf8');

      if (data.setActive) {
        await fs.writeFile(activePath, jsonText, 'utf8');
      }

      sendJson(res, 200, {
        ok: true,
        saved: path.relative(repoRoot, tablePath),
        active: data.setActive ? path.relative(repoRoot, activePath) : null,
      });
    } catch (err) {
      sendJson(res, 500, { error: String(err) });
    }
    return;
  }

  sendJson(res, 404, { error: 'Not found' });
});

server.listen(port, '0.0.0.0', () => {
  console.log(`[table-editor-save-server] listening on http://localhost:${port}`);
  console.log(`[table-editor-save-server] tables dir: ${tablesDir}`);
});

