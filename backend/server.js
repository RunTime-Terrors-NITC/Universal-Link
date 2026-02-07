require("dotenv").config();
const express = require("express");
const path = require("path");
const cors = require("cors");
const app = express();

const PORT = process.env.PORT || 4000;
const FRONTEND_URLS = (
    process.env.FRONTEND_URL || "http://localhost:3000"
).split(",");

app.use(
    cors({
        origin: [...FRONTEND_URLS, "*"],
        methods: ["GET", "POST"],
    }),
);

const server = app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

const io = require("socket.io")(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
    },
});

io.on("connection", onConnected);

function onConnected(socket) {
    console.log("Connected:", socket.id);

    socket.on("join-room", (roomId) => {
        socket.join(roomId);

        // Notify others in the room that a new user joined
        socket.to(roomId).emit("user-joined", { userId: socket.id });

        console.log(`${socket.id} joined room ${roomId}`);

        // Send back confirmation with current users in room (optional)
        socket.emit("joined-room", { roomId, userId: socket.id });
    });

    socket.on("offer", ({ offer, to }) => {
        socket.to(to).emit("offer", { offer, from: socket.id });
    });

    socket.on("answer", ({ answer, to }) => {
        socket.to(to).emit("answer", { answer, from: socket.id });
    });

    socket.on("ice-candidate", ({ candidate, to }) => {
        socket.to(to).emit("ice-candidate", { candidate, from: socket.id });
    });

    socket.on("leave-room", (roomId) => {
        socket.to(roomId).emit("user-left", { userId: socket.id });
        socket.leave(roomId);
        console.log(`${socket.id} left room ${roomId}`);
    });

    socket.on("user-state-update", ({ roomId, userId, isMicOn, isCamOn }) => {
        socket.to(roomId).emit("user-state-update", { userId, isMicOn, isCamOn });
    });

    socket.on("disconnect", () => {
        console.log("Socket Disconnected:", socket.id);
        // Notify all rooms this user was in
        Array.from(socket.rooms).forEach((room) => {
            if (room !== socket.id) {
                socket.to(room).emit("user-left", { userId: socket.id });
            }
        });
    });

    socket.on("error", (error) => {
        console.error("Socket error:", error);
    });
}
