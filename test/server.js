const express = require("express");
const path = require("path");
const { fileURLToPath } = require("url");
const { dirname } = require("path");

const app = express();

const PORT = process.env.PORT || 4000;

app.use(express.static(path.join(__dirname, "public")));

const server = app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

const io = require("socket.io")(server);
let users = 0;

// Simple pairing: keep one waiting socket, pair it with the next connection
let waiting = null;
const socketToRoom = {};
const roomToPeers = {};

io.on("connection", onConnected);

function onConnected(socket) {
  console.log("Connected:", socket.id);

  users++;

  // If there's no waiting socket, mark this one as waiting
  if (!waiting) {
    waiting = socket;
    socket.emit("waiting");
  } else {
    // Pair the two sockets into a room
    const peer = waiting;
    waiting = null;
    const room = `${peer.id}#${socket.id}`;

    socket.join(room);
    peer.join(room);

    socketToRoom[socket.id] = room;
    socketToRoom[peer.id] = room;
    roomToPeers[room] = [peer.id, socket.id];

    socket.emit("peer-joined", { peerId: peer.id });
    peer.emit("peer-joined", { peerId: socket.id });
    console.log(`Paired ${peer.id} <-> ${socket.id} in ${room}`);
  }

  socket.on("disconnect", () => {
    users--;
    console.log("Socket Disconnected: ", socket.id);

    // If this socket was waiting, clear it
    if (waiting && waiting.id === socket.id) {
      waiting = null;
    }

    const room = socketToRoom[socket.id];
    if (room) {
      const peers = roomToPeers[room] || [];
      const otherId = peers.find((id) => id !== socket.id);
      if (otherId) {
        const otherSocket = io.sockets.sockets.get(otherId);
        if (otherSocket) {
          otherSocket.leave(room);
          otherSocket.emit("peer-disconnected");
          // put the remaining peer back into waiting so they can be paired
          waiting = otherSocket;
        }
      }

      delete roomToPeers[room];
      delete socketToRoom[socket.id];
    }
  });

  // Forward SDP (signaling) data to the other peer in the room
  socket.on("sdp", (data) => {
    const room = socketToRoom[socket.id];
    if (room) {
      socket.to(room).emit("sdp", data);
    } else {
      // No paired peer yet; ignore or log
      console.log("Received sdp but no room/peer to forward to.");
    }
  });
}
