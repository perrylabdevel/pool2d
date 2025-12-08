import { WebSocketServer } from 'ws';
import os from 'node:os';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const port = Number(process.env.PORT) || 8080;
const devPort = Number(process.env.VITE_PORT) || 5173;

const wss = new WebSocketServer({
  port,
  // Allow large match recordings and asset payloads without disconnecting
  maxPayload: 128 * 1024 * 1024, // 128MB
});

logAccessLinks();

wss.on('connection', (ws) => {
  console.log('Client connected');

  ws.on('message', (message) => {
    try {
      const parsed = JSON.parse(message.toString());
      if (parsed?.type === 'command' && parsed.command === 'build:ios') {
        runIOSBuild(parsed.payload);
      }
    } catch {
      // non-JSON messages just get broadcast
    }

    // Broadcast to all other clients
    wss.clients.forEach((client) => {
      if (client !== ws && client.readyState === 1) { // 1 = WebSocket.OPEN
        client.send(message.toString());
      }
    });
  });

  ws.on('close', () => {
    console.log('Client disconnected');
  });
});

function logAccessLinks() {
  const localWs = `ws://localhost:${port}`;
  console.log('──────────────────────────────────────────────');
  console.log(' Relay server online');
  console.log(` • Local machine WS: ${localWs}`);

  const interfaces = os.networkInterfaces();
  const lanIPs = Object.values(interfaces)
    .flat()
    .filter((iface) => iface && iface.family === 'IPv4' && !iface.internal)
    .map((iface) => iface.address);

  if (lanIPs.length) {
    console.log(' • LAN WS endpoints:');
    lanIPs.forEach((ip) => console.log(`   - ws://${ip}:${port}`));
  } else {
    console.log(' • No LAN IPv4 interfaces detected');
  }

  console.log(' Dev server links (requires `npm run dev`)');
  console.log(` • Game UI:  http://localhost:${devPort}/`);
  console.log(` • Panels:   http://localhost:${devPort}/devtools/`);
  console.log('──────────────────────────────────────────────');
}

function broadcastBuildStatus(payload) {
  const message = JSON.stringify({ type: 'build:ios:status', ...payload });
  wss.clients.forEach((client) => {
    if (client.readyState === 1) {
      client.send(message);
    }
  });
}

let buildInFlight = false;
function runIOSBuild(payload) {
  if (buildInFlight) {
    broadcastBuildStatus({ status: 'error', message: 'Build already in progress' });
    return;
  }

  buildInFlight = true;
  broadcastBuildStatus({ status: 'start', payload: { hasState: !!payload } });

  try {
    const outDir = path.join(process.cwd(), 'tmp');
    fs.mkdirSync(outDir, { recursive: true });
    if (payload?.state) {
      fs.writeFileSync(path.join(outDir, 'build-settings.json'), JSON.stringify(payload.state, null, 2), 'utf8');
    }
  } catch (err) {
    console.error('Failed to write build settings', err);
  }

  const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const child = spawn(npmCmd, ['run', 'build:ios'], {
    cwd: process.cwd(),
    env: process.env,
  });

  child.stdout.on('data', (data) => broadcastBuildStatus({ status: 'stdout', data: data.toString() }));
  child.stderr.on('data', (data) => broadcastBuildStatus({ status: 'stderr', data: data.toString() }));

  child.on('exit', (code, signal) => {
    broadcastBuildStatus({ status: 'exit', code, signal });
    buildInFlight = false;
  });

  child.on('error', (err) => {
    broadcastBuildStatus({ status: 'error', message: err.message });
    buildInFlight = false;
  });
}
