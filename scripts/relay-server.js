import { WebSocketServer } from 'ws';

const wss = new WebSocketServer({ port: 8080 });

console.log('Relay server started on port 8080');

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
