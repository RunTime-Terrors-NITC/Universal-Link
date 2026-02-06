const express = require("express");
const path = require("path");
const cors = require("cors")
const app = express();

const PORT = 4000;

app.use(
    cors({
        origin: "http://localhost:5173", // Vite default port
        methods: ["GET", "POST"],
    })
);

const server = app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

const io = require("socket.io")(server, {
    cors: {
        origin: "http://localhost:5173",
        methods: ["GET", "POST"],
    },
});


io.on("connection", onConnected);

function onConnected(socket) {
    console.log(socket.id);

    socket.on("disconnect", () => {
        console.log("Socket Disconnected: ", socket.id);
    });
}