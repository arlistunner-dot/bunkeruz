import express from "express";
import cors from "cors";
import http from "http";
import { Server } from "socket.io";
import {
  createRoom,
  joinRoom,
  toggleReady,
  leaveRoom,
  removeSocketFromRooms,
  getRoom,
  getRoomRecipientViews,
  startGame,
  revealCard,
  nextRound,
  castVote
} from "./game/roomManager.js";

const PORT = process.env.PORT || 4000;

const app = express();

app.use(cors({
  origin: "*"
}));

app.use(express.json());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

function reply(callback, payload) {
  if (typeof callback === "function") {
    callback(payload);
  }
}

function emitRoom(roomCode) {
  const views = getRoomRecipientViews(roomCode);

  for (const view of views) {
    io.to(view.socketId).emit("room:update", view.room);
  }
}

app.get("/", (req, res) => {
  res.json({
    ok: true,
    app: "So‘nggi Joy Backend",
    message: "Backend ishlayapti"
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    status: "healthy",
    app: "So‘nggi Joy",
    version: "0.5.0"
  });
});

app.get("/api/rooms/:code", (req, res) => {
  const room = getRoom(req.params.code);

  if (!room) {
    return res.status(404).json({
      ok: false,
      error: "Xona topilmadi"
    });
  }

  return res.json({
    ok: true,
    room
  });
});

io.on("connection", (socket) => {
  console.log("Yangi socket ulandi:", socket.id);

  socket.emit("server:hello", {
    message: "So‘nggi Joy real-time serveriga ulandingiz",
    socketId: socket.id
  });

  socket.on("room:create", (payload, callback) => {
    try {
      const result = createRoom({
        hostName: payload?.name,
        socketId: socket.id
      });

      socket.join(result.roomCode);

      reply(callback, {
        ok: true,
        room: result.room,
        playerId: result.playerId
      });

      emitRoom(result.roomCode);

      console.log(`Xona yaratildi: ${result.roomCode}`);
    } catch (error) {
      reply(callback, {
        ok: false,
        error: "Xona yaratishda xatolik bo‘ldi"
      });
    }
  });

  socket.on("room:join", (payload, callback) => {
    try {
      const result = joinRoom({
        roomCode: payload?.roomCode,
        playerName: payload?.name,
        socketId: socket.id
      });

      if (!result.ok) {
        return reply(callback, result);
      }

      socket.join(result.roomCode);

      reply(callback, {
        ok: true,
        room: result.room,
        playerId: result.playerId
      });

      emitRoom(result.roomCode);

      console.log(`Xonaga qo‘shildi: ${result.roomCode}`);
    } catch (error) {
      reply(callback, {
        ok: false,
        error: "Xonaga kirishda xatolik bo‘ldi"
      });
    }
  });

  socket.on("room:toggleReady", (payload, callback) => {
    const result = toggleReady({
      roomCode: payload?.roomCode,
      playerId: payload?.playerId
    });

    reply(callback, result);

    if (result.ok && result.roomCode) {
      emitRoom(result.roomCode);
    }
  });

  socket.on("game:start", (payload, callback) => {
    const result = startGame({
      roomCode: payload?.roomCode,
      playerId: payload?.playerId
    });

    reply(callback, result);

    if (result.ok && result.roomCode) {
      emitRoom(result.roomCode);
    }
  });

  socket.on("game:revealCard", (payload, callback) => {
    const result = revealCard({
      roomCode: payload?.roomCode,
      playerId: payload?.playerId,
      cardKey: payload?.cardKey
    });

    reply(callback, result);

    if (result.ok && result.roomCode) {
      emitRoom(result.roomCode);
    }
  });

  socket.on("game:nextRound", (payload, callback) => {
    const result = nextRound({
      roomCode: payload?.roomCode,
      playerId: payload?.playerId
    });

    reply(callback, result);

    if (result.ok && result.roomCode) {
      emitRoom(result.roomCode);
    }
  });

  socket.on("game:vote", (payload, callback) => {
    const result = castVote({
      roomCode: payload?.roomCode,
      playerId: payload?.playerId,
      targetId: payload?.targetId
    });

    reply(callback, result);

    if (result.ok && result.roomCode) {
      emitRoom(result.roomCode);
    }
  });

  socket.on("room:leave", (payload, callback) => {
    const result = leaveRoom({
      roomCode: payload?.roomCode,
      playerId: payload?.playerId
    });

    if (payload?.roomCode) {
      socket.leave(String(payload.roomCode).trim().toUpperCase());
    }

    reply(callback, result);

    if (result.ok && result.roomCode) {
      emitRoom(result.roomCode);
    }
  });

  socket.on("disconnect", () => {
    console.log("Socket uzildi:", socket.id);

    const changedRoomCodes = removeSocketFromRooms(socket.id);

    for (const code of changedRoomCodes) {
      emitRoom(code);
    }
  });
});

server.listen(PORT, () => {
  console.log(`So‘nggi Joy backend ishga tushdi: http://127.0.0.1:${PORT}`);
});