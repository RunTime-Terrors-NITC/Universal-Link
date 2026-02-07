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
        socket.to(roomId).emit(`new user joined to ${roomId} : `, socket.id);
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

    socket.on("disconnect", () => {
        console.log("Socket Disconnected: ", socket.id);
    });

    socket.on("error", (error) => {
        console.error("Socket error:", error);
    });
}
