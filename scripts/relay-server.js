import { WebSocketServer } from 'ws';
import os from 'node:os';

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
