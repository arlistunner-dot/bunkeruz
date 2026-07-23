import express from "express";
import cors from "cors";
import http from "http";
import { Server } from "socket.io";
import { bot, printBotInfo } from "./bot.js";
import {
  createRoom,
  joinRoom,
  reconnectRoom,
  resumeRoomByTelegramId,
  toggleReady,
  leaveRoom,
  removeSocketFromRooms,
  getRoom,
  getRoomRecipientViews,
  startGame,
  revealCard,
  nextRound,
  castVote,
  sendChatMessage,
  clearRoomChat
} from "./game/roomManager.js";

const PORT = process.env.PORT || 4000;
const BACKEND_URL = (process.env.BACKEND_URL || "").trim().replace(/\/$/, "");
const BOT_WEBHOOK_SECRET = process.env.BOT_WEBHOOK_SECRET || "bunkeruz-webhook";
const WEBHOOK_PATH = `/telegram/webhook/${BOT_WEBHOOK_SECRET}`;

const app = express();

app.use(cors({
  origin: "*"
}));

app.use(express.json());

app.use(bot.webhookCallback(WEBHOOK_PATH));

function sendBackendStatus(req, res) {
  res.json({
    ok: true,
    status: "healthy",
    app: "Bunker Backend",
    version: "0.5.0",
    path: req.path,
    message: "Backend ishlayapti"
  });
}

app.get("/", sendBackendStatus);
app.get("/health", sendBackendStatus);
app.get("/api/health", sendBackendStatus);

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
    message: "Bunker real-time serveriga ulandingiz",
    socketId: socket.id
  });

  socket.on("room:resume", (payload, callback) => {
    const result = resumeRoomByTelegramId({
      telegramId: payload?.telegramId,
      socketId: socket.id
    });

    reply(callback, result);

    if (result.ok && result.roomCode) {
      socket.join(result.roomCode);
      emitRoom(result.roomCode);
    }
  });
  socket.on("room:reconnect", (payload, callback) => {
    const result = reconnectRoom({
      roomCode: payload?.roomCode,
      playerId: payload?.playerId,
      socketId: socket.id,
      telegramId: payload?.telegramId
    });

    reply(callback, result);

    if (result.ok && result.roomCode) {
      socket.join(result.roomCode);
      emitRoom(result.roomCode);
    }
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

  socket.on("chat:send", (payload, callback) => {
    const result = sendChatMessage({
      roomCode: payload?.roomCode,
      playerId: payload?.playerId,
      text: payload?.text
    });

    reply(callback, result);

    if (result.ok && result.roomCode) {
      emitRoom(result.roomCode);
    }
  });

  socket.on("chat:clear", (payload, callback) => {
    const result = clearRoomChat({
      roomCode: payload?.roomCode,
      playerId: payload?.playerId
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

app.use((req, res) => {
  res.status(404).json({
    ok: false,
    status: "not_found",
    app: "Bunker Backend",
    path: req.path,
    message: "Bunday route topilmadi"
  });
});

server.listen(PORT, async () => {
  console.log(`Bunker backend ishga tushdi: http://127.0.0.1:${PORT}`);
  printBotInfo();

  if (!BACKEND_URL.startsWith("https://")) {
    console.log("⚠️ BACKEND_URL yozilmagan yoki HTTPS emas. Webhook o‘rnatilmadi.");
    return;
  }

  const webhookUrl = `${BACKEND_URL}${WEBHOOK_PATH}`;

  try {
    await bot.telegram.setWebhook(webhookUrl, {
      drop_pending_updates: true
    });

    console.log("✅ Telegram webhook o‘rnatildi:", webhookUrl);
  } catch (error) {
    console.error("❌ Telegram webhook o‘rnatishda xato:", error);
  }
});