import {
  createGame,
  revealOwnCard,
  advanceRound,
  getPublicGame,
  voteForPlayer
} from "./engine.js";

const rooms = new Map();

const MIN_PLAYERS_TO_START = 2;
const CHAT_LIMIT = 300;

function makeId(prefix = "id") {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function makeRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

  for (let attempt = 0; attempt < 50; attempt++) {
    let code = "";

    for (let i = 0; i < 4; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }

    if (!rooms.has(code)) {
      return code;
    }
  }

  return Math.random().toString(36).slice(2, 6).toUpperCase();
}

function cleanName(name) {
  const value = String(name || "").trim();

  if (!value) {
    return "O‘yinchi";
  }

  return value.slice(0, 24);
}


function cleanChatText(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 400);
}

function cleanTelegramId(telegramId) {
  const value = String(telegramId || "").trim();
  return value ? value.slice(0, 64) : null;
}
function publicRoom(room, viewerPlayerId = null) {
  if (!room) {
    return null;
  }

  return {
    code: room.code,
    status: room.status,
    hostId: room.hostId,
    maxPlayers: room.maxPlayers,
    minPlayersToStart: MIN_PLAYERS_TO_START,
    createdAt: room.createdAt,
    updatedAt: room.updatedAt,
    chat: room.chat || [],
    chatLimit: CHAT_LIMIT,
    game: getPublicGame(room.game, room.players, viewerPlayerId, room.hostId),
    players: room.players.map((player) => ({
      id: player.id,
      name: player.name,
      isHost: player.id === room.hostId,
      ready: player.ready,
      connected: player.connected
    }))
  };
}

export function createRoom({ hostName, socketId, telegramId }) {
  const code = makeRoomCode();

  const host = {
    id: makeId("player"),
    socketId,
    name: cleanName(hostName),
    telegramId: cleanTelegramId(telegramId),
    ready: false,
    connected: true,
    joinedAt: new Date().toISOString()
  };

  const room = {
    code,
    status: "waiting",
    hostId: host.id,
    maxPlayers: 12,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    players: [host],
    chat: [],
    game: null
  };

  rooms.set(code, room);

  return {
    roomCode: code,
    room: publicRoom(room, host.id),
    playerId: host.id
  };
}

export function joinRoom({ roomCode, playerName, socketId, telegramId }) {
  const code = String(roomCode || "").trim().toUpperCase();
  const room = rooms.get(code);

  if (!room) {
    return {
      ok: false,
      error: "Bunday xona topilmadi"
    };
  }

  if (room.status !== "waiting") {
    return {
      ok: false,
      error: "Bu xonada o‘yin allaqachon boshlangan"
    };
  }

  if (room.players.length >= room.maxPlayers) {
    return {
      ok: false,
      error: "Xona to‘lib qolgan"
    };
  }

  const player = {
    id: makeId("player"),
    socketId,
    name: cleanName(playerName),
    telegramId: cleanTelegramId(telegramId),
    ready: false,
    connected: true,
    joinedAt: new Date().toISOString()
  };

  room.players.push(player);

  return {
    ok: true,
    roomCode: code,
    room: publicRoom(room, player.id),
    playerId: player.id
  };
}


export function reconnectRoom({ roomCode, playerId, socketId, telegramId }) {
  const code = String(roomCode || "").trim().toUpperCase();
  const room = rooms.get(code);

  if (!room) {
    return {
      ok: false,
      error: "Avvalgi xona topilmadi"
    };
  }

  const player = room.players.find((item) => item.id === playerId);

  if (!player) {
    return {
      ok: false,
      error: "Avvalgi o‘yinchi topilmadi"
    };
  }

  player.socketId = socketId;
  player.connected = true;
  player.disconnectedAt = null;
  player.reconnectedAt = new Date().toISOString();
  room.updatedAt = new Date().toISOString();

  return {
    ok: true,
    roomCode: code,
    room: publicRoom(room, player.id),
    playerId: player.id
  };
}
export function toggleReady({ roomCode, playerId }) {
  const code = String(roomCode || "").trim().toUpperCase();
  const room = rooms.get(code);

  if (!room) {
    return {
      ok: false,
      error: "Xona topilmadi"
    };
  }

  const player = room.players.find((item) => item.id === playerId);

  if (!player) {
    return {
      ok: false,
      error: "O‘yinchi topilmadi"
    };
  }

  if (room.status !== "waiting") {
    return {
      ok: false,
      error: "O‘yin boshlanganidan keyin tayyorlikni o‘zgartirib bo‘lmaydi"
    };
  }

  player.ready = !player.ready;

  return {
    ok: true,
    roomCode: code,
    room: publicRoom(room, playerId)
  };
}

export function startGame({ roomCode, playerId }) {
  const code = String(roomCode || "").trim().toUpperCase();
  const room = rooms.get(code);

  if (!room) {
    return {
      ok: false,
      error: "Xona topilmadi"
    };
  }

  if (room.hostId !== playerId) {
    return {
      ok: false,
      error: "O‘yinni faqat host boshlashi mumkin"
    };
  }

  if (room.players.length < MIN_PLAYERS_TO_START) {
    return {
      ok: false,
      error: `Kamida ${MIN_PLAYERS_TO_START} ta o‘yinchi kerak`
    };
  }

  const notReady = room.players.filter((player) => !player.ready);

  if (notReady.length > 0) {
    return {
      ok: false,
      error: "Hamma o‘yinchi tayyor bo‘lishi kerak"
    };
  }

  room.status = "playing";
  room.game = createGame(room.players);

  return {
    ok: true,
    roomCode: code,
    room: publicRoom(room, playerId)
  };
}

export function revealCard({ roomCode, playerId, cardKey }) {
  const code = String(roomCode || "").trim().toUpperCase();
  const room = rooms.get(code);

  if (!room) {
    return {
      ok: false,
      error: "Xona topilmadi"
    };
  }

  if (room.status !== "playing" || !room.game) {
    return {
      ok: false,
      error: "O‘yin hali boshlanmagan"
    };
  }

  const result = revealOwnCard(room.game, room.players, playerId, cardKey);

  if (!result.ok) {
    return result;
  }

  room.game = result.game;

  return {
    ok: true,
    roomCode: code,
    room: publicRoom(room, playerId)
  };
}

export function nextRound({ roomCode, playerId }) {
  const code = String(roomCode || "").trim().toUpperCase();
  const room = rooms.get(code);

  if (!room) {
    return {
      ok: false,
      error: "Xona topilmadi"
    };
  }

  if (room.hostId !== playerId) {
    return {
      ok: false,
      error: "Keyingi bosqichga faqat host o‘tkaza oladi"
    };
  }

  if (room.status !== "playing" || !room.game) {
    return {
      ok: false,
      error: "O‘yin hali boshlanmagan"
    };
  }

  const result = advanceRound(room.game, room.players);

  if (!result.ok) {
    return result;
  }

  room.game = result.game;

  if (room.game.status === "finished") {
    room.status = "finished";
  }

  return {
    ok: true,
    roomCode: code,
    room: publicRoom(room, playerId)
  };
}

export function castVote({ roomCode, playerId, targetId }) {
  const code = String(roomCode || "").trim().toUpperCase();
  const room = rooms.get(code);

  if (!room) {
    return {
      ok: false,
      error: "Xona topilmadi"
    };
  }

  if (room.status !== "playing" || !room.game) {
    return {
      ok: false,
      error: "O‘yin hali boshlanmagan"
    };
  }

  const result = voteForPlayer(room.game, room.players, playerId, targetId);

  if (!result.ok) {
    return result;
  }

  room.game = result.game;

  if (room.game.status === "finished") {
    room.status = "finished";
  }

  return {
    ok: true,
    roomCode: code,
    room: publicRoom(room, playerId)
  };
}

export function leaveRoom({ roomCode, playerId }) {
  const code = String(roomCode || "").trim().toUpperCase();
  const room = rooms.get(code);

  if (!room) {
    return {
      ok: true,
      deleted: true
    };
  }

  room.players = room.players.filter((player) => player.id !== playerId);

  if (room.players.length === 0) {
    rooms.delete(code);

    return {
      ok: true,
      deleted: true
    };
  }

  if (room.hostId === playerId) {
    room.hostId = room.players[0].id;
  }

  return {
    ok: true,
    roomCode: code,
    room: publicRoom(room, room.hostId)
  };
}

export function removeSocketFromRooms(socketId) {
  const changedRoomCodes = [];

  for (const room of rooms.values()) {
    const player = room.players.find((item) => item.socketId === socketId);

    if (!player) {
      continue;
    }

    player.connected = false;
    player.socketId = null;
    player.disconnectedAt = new Date().toISOString();
    room.updatedAt = new Date().toISOString();

    changedRoomCodes.push(room.code);
  }

  return changedRoomCodes;
}


export function sendChatMessage({ roomCode, playerId, text }) {
  const code = String(roomCode || "").trim().toUpperCase();
  const room = rooms.get(code);

  if (!room) {
    return {
      ok: false,
      error: "Xona topilmadi"
    };
  }

  const player = room.players.find((item) => item.id === playerId);

  if (!player) {
    return {
      ok: false,
      error: "O‘yinchi topilmadi"
    };
  }

  const cleanText = cleanChatText(text);

  if (!cleanText) {
    return {
      ok: false,
      error: "Xabar yozing"
    };
  }

  if (!room.chat) {
    room.chat = [];
  }

  const message = {
    id: makeId("chat"),
    playerId: player.id,
    name: player.name,
    isHost: player.id === room.hostId,
    text: cleanText,
    createdAt: new Date().toISOString()
  };

  room.chat.push(message);

  if (room.chat.length > CHAT_LIMIT) {
    room.chat = room.chat.slice(-CHAT_LIMIT);
  }

  return {
    ok: true,
    roomCode: code,
    message,
    room: publicRoom(room, playerId)
  };
}

export function clearRoomChat({ roomCode, playerId }) {
  const code = String(roomCode || "").trim().toUpperCase();
  const room = rooms.get(code);

  if (!room) {
    return {
      ok: false,
      error: "Xona topilmadi"
    };
  }

  if (room.hostId !== playerId) {
    return {
      ok: false,
      error: "Chatni faqat host tozalashi mumkin"
    };
  }

  room.chat = [];

  return {
    ok: true,
    roomCode: code,
    room: publicRoom(room, playerId)
  };
}

export function resumeRoomByTelegramId({ telegramId, socketId }) {
  const cleanId = cleanTelegramId(telegramId);

  if (!cleanId) {
    return {
      ok: false,
      error: "Telegram ID topilmadi"
    };
  }

  let matchedRoom = null;
  let matchedPlayer = null;

  for (const room of rooms.values()) {
    const player = room.players.find((item) => item.telegramId === cleanId);

    if (!player) {
      continue;
    }

    matchedRoom = room;
    matchedPlayer = player;
  }

  if (!matchedRoom || !matchedPlayer) {
    return {
      ok: false,
      error: "Avvalgi xona topilmadi"
    };
  }

  matchedPlayer.socketId = socketId;
  matchedPlayer.connected = true;
  matchedPlayer.disconnectedAt = null;
  matchedPlayer.reconnectedAt = new Date().toISOString();
  matchedRoom.updatedAt = new Date().toISOString();

  return {
    ok: true,
    roomCode: matchedRoom.code,
    room: publicRoom(matchedRoom, matchedPlayer.id),
    playerId: matchedPlayer.id
  };
}
export function getRoom(roomCode, viewerPlayerId = null) {
  const code = String(roomCode || "").trim().toUpperCase();
  return publicRoom(rooms.get(code), viewerPlayerId);
}

export function getRoomRecipientViews(roomCode) {
  const code = String(roomCode || "").trim().toUpperCase();
  const room = rooms.get(code);

  if (!room) {
    return [];
  }

  return room.players
    .filter((player) => player.connected && player.socketId)
    .map((player) => ({
      socketId: player.socketId,
      room: publicRoom(room, player.id)
    }));
}