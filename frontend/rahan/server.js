import WebSocket, { WebSocketServer } from "ws";

const wss = new WebSocketServer({ port: 3000 });

let clients = [];

wss.on("connection", ws => {
  clients.push(ws);

  ws.on("message", message => {
    // broadcast to everyone except sender
    clients.forEach(client => {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        client.send(message.toString());
      }
    });
  });

  ws.on("close", () => {
    clients = clients.filter(c => c !== ws);
  });
});

console.log("Signaling server running on ws://localhost:3000");