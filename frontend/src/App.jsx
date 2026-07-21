import { useEffect, useMemo, useState } from "react";
import { io } from "socket.io-client";

const API_URL = "https://bunkeruz-api-ldrt.onrender.com";
const SESSION_KEY = "songgi-joy-session-v1";

function saveSession(session) {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    // localStorage ishlamasa ham o‘yin davom etadi
  }
}

function readSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
  } catch {
    return null;
  }
}

function clearSession() {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    // localStorage ishlamasa ham o‘yin davom etadi
  }
}



function getTelegramUser() {
  if (typeof window === "undefined") {
    return { id: "", name: "" };
  }

  const tgUser = window.Telegram?.WebApp?.initDataUnsafe?.user;

  if (!tgUser) {
    return { id: "", name: "" };
  }

  const fullName = [tgUser.first_name, tgUser.last_name].filter(Boolean).join(" ");

  return {
    id: tgUser.id ? String(tgUser.id) : "",
    name: fullName || tgUser.username || ""
  };
}

function tryAutoResumeRoom(nextSocket, { setRoom, setPlayerId, setGameTab, setError }) {
  const saved = readSession();
  const telegramUser = getTelegramUser();
  const telegramId = telegramUser.id;

  const finishResume = (response) => {
    if (!response?.ok) {
      return false;
    }

    saveSession({
      roomCode: response.roomCode,
      playerId: response.playerId,
      name: telegramUser.name
    });

    setRoom(response.room);
    setPlayerId(response.playerId);
    setGameTab("cards");
    setError("");
    return true;
  };

  const resumeByTelegram = () => {
    if (!telegramId) {
      return;
    }

    nextSocket.emit("room:resume", { telegramId }, (response) => {
      finishResume(response);
    });
  };

  if (saved?.roomCode && saved?.playerId) {
    nextSocket.emit("room:reconnect", {
      roomCode: saved.roomCode,
      playerId: saved.playerId,
      telegramId
    }, (response) => {
      if (finishResume(response)) {
        return;
      }

      clearSession();
      resumeByTelegram();
    });

    return;
  }

  resumeByTelegram();
}
export default function App() {
  const [apiStatus, setApiStatus] = useState("tekshirilmoqda...");
  const [socketStatus, setSocketStatus] = useState("ulanmoqda...");
  const [socket, setSocket] = useState(null);

  const [name, setName] = useState(() => {
    return localStorage.getItem("songgi_joy_name") || "";
  });

  const [joinCode, setJoinCode] = useState("");
  const [room, setRoom] = useState(null);
  const [playerId, setPlayerId] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [gameTab, setGameTab] = useState("cards");
  const [chatInput, setChatInput] = useState("");

  const me = useMemo(() => {
    if (!room || !playerId) {
      return null;
    }

    return room.players.find((player) => player.id === playerId) || null;
  }, [room, playerId]);

  const isHost = Boolean(me?.isHost);

  useEffect(() => {
    fetch(`${API_URL}/api/health`)
      .then((res) => res.json())
      .then((data) => {
        if (data.ok) {
          setApiStatus("Backend ishlayapti");
        } else {
          setApiStatus("Backend javobi noto‘g‘ri");
        }
      })
      .catch(() => {
        setApiStatus("Backendga ulanib bo‘lmadi");
      });

    const nextSocket = io(API_URL, {
      transports: ["websocket", "polling"]
    });

    nextSocket.on("connect", () => {
      setSocketStatus("Real-time serverga ulandi");
      setApiStatus("Backend ishlayapti");

      setTimeout(() => {
        tryAutoResumeRoom(nextSocket, {
          setRoom,
          setPlayerId,
          setGameTab,
          setError
        });
      }, 700);
    });
    nextSocket.on("disconnect", () => {
      setSocketStatus("Real-time aloqa uzildi");
    });

    nextSocket.on("room:update", (nextRoom) => {
      setRoom(nextRoom);
    });

    setSocket(nextSocket);

    return () => {
      nextSocket.disconnect();
    };
  }, []);

  useEffect(() => {
    const phase = room?.game?.phase;

    if (phase === "voting") {
      setGameTab("vote");
      return;
    }

    if (phase === "reveal") {
      setGameTab((current) => current === "vote" ? "cards" : current);
    }
  }, [room?.game?.phase]);

  function getCleanName() {
    const clean = name.trim();

    if (!clean) {
      setError("Avval ismingizni yozing");
      return null;
    }

    localStorage.setItem("songgi_joy_name", clean);
    return clean;
  }

  function createNewRoom() {
    const clean = getCleanName();

    if (!clean || !socket) {
      return;
    }

    setBusy(true);
    setError("");

    socket.emit("room:create", { name: clean }, (response) => {
      setBusy(false);

      if (!response?.ok) {
        setError(response?.error || "Xona yaratib bo‘lmadi");
        return;
      }

      setRoom(response.room);
      setPlayerId(response.playerId);
      setJoinCode("");
    });
  }

  function joinExistingRoom() {
    const clean = getCleanName();
    const code = joinCode.trim().toUpperCase();

    if (!clean || !socket) {
      return;
    }

    if (!code) {
      setError("Xona kodini yozing");
      return;
    }

    setBusy(true);
    setError("");

    socket.emit("room:join", { name: clean, roomCode: code }, (response) => {
      setBusy(false);

      if (!response?.ok) {
        setError(response?.error || "Xonaga kirib bo‘lmadi");
        return;
      }

      setRoom(response.room);
      setPlayerId(response.playerId);
    });
  }

  function toggleReady() {
    if (!socket || !room || !playerId) {
      return;
    }

    socket.emit("room:toggleReady", {
      roomCode: room.code,
      playerId
    });
  }

  function startGame() {
    if (!socket || !room || !playerId) {
      return;
    }

    setError("");
    setGameTab("cards");

    socket.emit("game:start", {
      roomCode: room.code,
      playerId
    }, (response) => {
      if (!response?.ok) {
        setError(response?.error || "O‘yinni boshlab bo‘lmadi");
        return;
      }

      setRoom(response.room);
    });
  }

  function revealCard(cardKey) {
    if (!socket || !room || !playerId) {
      return;
    }

    setError("");

    socket.emit("game:revealCard", {
      roomCode: room.code,
      playerId,
      cardKey
    }, (response) => {
      if (!response?.ok) {
        setError(response?.error || "Kartani ochib bo‘lmadi");
        return;
      }

      setRoom(response.room);
    });
  }

  function nextRound() {
    if (!socket || !room || !playerId) {
      return;
    }

    setError("");

    socket.emit("game:nextRound", {
      roomCode: room.code,
      playerId
    }, (response) => {
      if (!response?.ok) {
        setError(response?.error || "Keyingi bosqichga o‘tib bo‘lmadi");
        return;
      }

      setRoom(response.room);
    });
  }

  function voteFor(targetId) {
    if (!socket || !room || !playerId) {
      return;
    }

    setError("");

    socket.emit("game:vote", {
      roomCode: room.code,
      playerId,
      targetId
    }, (response) => {
      if (!response?.ok) {
        setError(response?.error || "Ovoz berib bo‘lmadi");
        return;
      }

      setRoom(response.room);
    });
  }

  function sendChatMessage() {
    const text = chatInput.trim();

    if (!text || !socket || !room || !playerId) {
      return;
    }

    setError("");

    socket.emit("chat:send", {
      roomCode: room.code,
      playerId,
      text
    }, (response) => {
      if (!response?.ok) {
        setError(response?.error || "Xabar yuborib bo‘lmadi");
        return;
      }

      setChatInput("");
      setRoom(response.room);
    });
  }

  function clearChat() {
    if (!socket || !room || !playerId) {
      return;
    }

    socket.emit("chat:clear", {
      roomCode: room.code,
      playerId
    }, (response) => {
      if (!response?.ok) {
        setError(response?.error || "Chatni tozalab bo‘lmadi");
        return;
      }

      setRoom(response.room);
    });
  }
  function leaveRoom() {
    if (socket && room && playerId) {
      socket.emit("room:leave", {
        roomCode: room.code,
        playerId
      });
    }

    setRoom(null);
    setPlayerId(null);
    setError("");
    setGameTab("cards");
  }

  async function copyRoomCode() {
    if (!room?.code) {
      return;
    }

    try {
      await navigator.clipboard.writeText(room.code);
    } catch {
      // Clipboard ishlamasa ham o‘yin davom etadi
    }
  }

  function renderChatPanel(compact = false) {
    const messages = room?.chat || [];
    const chatLimit = room?.chatLimit || 300;

    return (
      <div className={compact ? "chat-panel compact-chat-panel" : "chat-panel"}>
        <div className="section-title">
          <div>
            <span>Vaqtinchalik xona chati</span>
            <strong>💬 Muhokama</strong>
          </div>

          <em>{messages.length}/{chatLimit}</em>
        </div>

        <div className="chat-messages">
          {messages.length > 0 ? (
            messages.map((message) => (
              <div
                className={message.playerId === playerId ? "chat-message own-message" : "chat-message"}
                key={message.id}
              >
                <div className="chat-message-head">
                  <strong>{message.name}{message.isHost ? " • Host" : ""}</strong>
                  <span>
                    {new Date(message.createdAt).toLocaleTimeString("uz-UZ", {
                      hour: "2-digit",
                      minute: "2-digit"
                    })}
                  </span>
                </div>

                <p>{message.text}</p>
              </div>
            ))
          ) : (
            <p className="empty-card">
              Hali xabar yo‘q. Birinchi bo‘lib bahsni boshlang.
            </p>
          )}
        </div>

        <div className="chat-form">
          <input
            value={chatInput}
            onChange={(event) => setChatInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                sendChatMessage();
              }
            }}
            placeholder="Masalan: menimcha jarrohni bunkerga olish kerak..."
            maxLength={400}
          />

          <button type="button" onClick={sendChatMessage} disabled={!chatInput.trim()}>
            Yuborish
          </button>
        </div>

        {isHost && messages.length > 0 && (
          <button type="button" className="small-secondary clear-chat-button" onClick={clearChat}>
            Chatni tozalash
          </button>
        )}
      </div>
    );
  }
  const minPlayers = room?.minPlayersToStart || 2;
  const allReady = room?.players?.length >= minPlayers && room.players.every((player) => player.ready);

  if (room?.status === "playing" || room?.status === "finished") {
    const game = room.game;
    const gameFinished = room.status === "finished" || game?.status === "finished";
    const isVoting = game?.phase === "voting";
    const isReveal = game?.phase === "reveal";

    return (
      <main className="app-shell game-shell">
        <section className="game-layout">
          <div className={gameTab === "chat" ? "game-main chat-only-main" : "game-main"}>
            {gameTab !== "chat" && (<>
            <div className="top-line">
              <div>
                <div className="badge">
                  {gameFinished ? "O‘yin yakunlandi" : isVoting ? "Ovoz berish" : "Karta ochish"}
                </div>
                <h1>So‘nggi Joy</h1>
              </div>

              <button type="button" className="small-secondary" onClick={leaveRoom}>
                Chiqish
              </button>
            </div>

            <div className="scenario-grid">
              <div className="scenario-card danger">
                <span>Katastrofa</span>
                <p>{game?.catastrophe}</p>
              </div>

              <div className="scenario-card">
                <span>Bunker</span>
                <p>{game?.bunker}</p>
              </div>
            </div>

            <div className="round-card">
              <span>O‘yin holati</span>

              {gameFinished ? (
                <div className="final-screen">
                  <div className="final-hero">
                    <div className="final-trophy">🏆</div>
                    <strong>Final: bunker eshiklari yopildi</strong>
                    <p>
                      Bunkerda {game?.bunkerSlots} ta joy bor edi. Quyidagi o‘yinchilar
                      omon qolgan guruh sifatida tanlandi.
                    </p>
                  </div>

                  <div className="final-grid">
                    <div className="final-panel winners-panel">
                      <div className="section-title">
                        <div>
                          <span>Omon qolganlar</span>
                          <strong>🛡️ Bunkerga kirganlar</strong>
                        </div>

                        <em>{game?.winners?.length || 0} g‘olib</em>
                      </div>

                      <div className="winner-final-list">
                        {game?.winners?.length > 0 ? (
                          game.winners.map((winner) => {
                            const winnerProfile = game?.players?.find((player) => player.id === winner.id);
                            const revealedCards = (winnerProfile?.cardSlots || []).filter((card) => card.revealed);

                            return (
                              <div className="winner-final-card" key={winner.id}>
                                <div className="final-player-head">
                                  <strong>🏅 {winner.name}</strong>
                                  <span>{winnerProfile?.isHost ? "Host" : "O‘yinchi"}</span>
                                </div>

                                <div className="final-mini-facts">
                                  {revealedCards.slice(0, 4).map((card) => (
                                    <div className="final-fact" key={card.key}>
                                      <span>{card.label}</span>
                                      <strong>{card.value}</strong>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <p className="empty-card">G‘oliblar topilmadi.</p>
                        )}
                      </div>
                    </div>

                    <div className="final-panel">
                      <div className="section-title">
                        <div>
                          <span>O‘yindan chiqarilganlar</span>
                          <strong>☠️ Bunker tashqarisida qolganlar</strong>
                        </div>
                      </div>

                      <div className="eliminated-final-list">
                        {game?.players?.filter((player) => player.eliminated).length > 0 ? (
                          game.players
                            .filter((player) => player.eliminated)
                            .map((player) => (
                              <div className="eliminated-final-row" key={player.id}>
                                <strong>{player.name}</strong>
                                <span>Chiqarilgan</span>
                              </div>
                            ))
                        ) : (
                          <p className="empty-card">Hech kim chiqarilmagan.</p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="final-stats">
                    <div>
                      <span>Jami o‘yinchi</span>
                      <strong>{game?.players?.length || 0}</strong>
                    </div>

                    <div>
                      <span>Bunker joylari</span>
                      <strong>{game?.bunkerSlots}</strong>
                    </div>

                    <div>
                      <span>Ovoz bilan chiqarilganlar</span>
                      <strong>{game?.eliminationHistory?.length || 0}</strong>
                    </div>
                  </div>

                  <div className="final-actions">
                    <button type="button" onClick={leaveRoom}>
                      Yangi o‘yin boshlash
                    </button>

                    <button type="button" className="secondary" onClick={() => setGameTab("players")}>
                      Barcha profillarni ko‘rish
                    </button>
                  </div>
                </div>
              ) : isVoting ? (
                <>
                  <strong>
                    {game.voting?.type === "revote" ? "Qayta ovoz berish" : "Ovoz berish bosqichi"}
                  </strong>

                  <p>
                    Progress: {game.voting?.votedCount}/{game.voting?.votersTotal}. Eng ko‘p ovoz olgan o‘yinchi
                    bunkerdan chiqariladi.
                  </p>

                  {game.voting?.type === "revote" && (
                    <div className="info-box vote">
                      Durang bo‘ldi. Endi faqat durangdagi o‘yinchilar orasidan qayta ovoz beriladi.
                    </div>
                  )}

                  {game.voting?.hasVoted && (
                    <div className="info-box success">
                      Siz ovoz berdingiz. Endi qolgan o‘yinchilarni kutamiz.
                    </div>
                  )}

                  {game.meIsEliminated && (
                    <div className="info-box">
                      Siz o‘yindan chiqarilgansiz. Endi faqat kuzatuvchi sifatida ko‘rasiz.
                    </div>
                  )}
                </>
              ) : (
                <>
                  <strong>
                    {game.roundNumber}/{game.totalRounds} — strategik karta ochish
                  </strong>

                  <p>
                    Har bir faol o‘yinchi o‘z kartalaridan istagan bittasini ochadi.
                    Progress: {game.roundRevealsCount}/{game.playersTotal}
                  </p>

                  {game.meIsEliminated && (
                    <div className="info-box">
                      Siz o‘yindan chiqarilgansiz. Kartani ocholmaysiz va ovoz bera olmaysiz.
                    </div>
                  )}

                  {game.meHasRevealedThisRound && !game.roundComplete && (
                    <div className="info-box">
                      Siz bu raundda kartangizni ochdingiz. Endi boshqalarni kutamiz.
                    </div>
                  )}

                  {game.roundComplete && (
                    <div className="info-box success">
                      Bu raund tugadi. Hamma faol o‘yinchi bittadan karta ochdi.
                    </div>
                  )}

                  {isHost && game.roundComplete && (
                    <button type="button" onClick={nextRound}>
                      {game.roundNumber % 2 === 0 ? "Ovoz berishga o‘tish" : "Keyingi raundga o‘tish"}
                    </button>
                  )}
                </>
              )}
            </div>

            </>)}

            {error && <div className="error-box">{error}</div>}

            <div className="mobile-tabbar">
              <button
                type="button"
                className={gameTab === "cards" ? "active" : ""}
                onClick={() => setGameTab("cards")}
              >
                Kartalar
              </button>

              <button
                type="button"
                className={gameTab === "players" ? "active" : ""}
                onClick={() => setGameTab("players")}
              >
                O‘yinchilar
              </button>

              <button
                type="button"
                className={gameTab === "vote" ? "active" : ""}
                onClick={() => setGameTab("vote")}
              >
                Ovoz
              </button>
              <button
                type="button"
                className={gameTab === "chat" ? "active" : ""}
                onClick={() => setGameTab("chat")}
              >
                Chat
              </button>
            </div>
<div className={`game-tab-section ${gameTab === "cards" ? "mobile-active" : ""}`}>
              <div className="my-card-panel">
                <div className="section-title">
                  <div>
                    <span>Faqat sizga ko‘rinadi</span>
                    <strong>Mening kartalarim</strong>
                  </div>

                  <em>
                    {game?.meIsEliminated
                      ? "O‘yindan chiqqansiz"
                      : game?.meHasRevealedThisRound
                        ? "Bu raundda ochdingiz"
                        : game?.roundComplete
                          ? "Raund tugagan"
                          : "Bitta karta tanlang"}
                  </em>
                </div>

                <div className="card-choice-grid">
                  {game?.myCard?.map((card) => (
                    <div className={card.revealed ? "card-choice revealed" : "card-choice"} key={card.key}>
                      <span>{card.label}</span>
                      <strong>{card.value}</strong>

                      {card.revealed ? (
                        <button type="button" disabled>
                          Ochilgan
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={!card.canReveal}
                          onClick={() => revealCard(card.key)}
                        >
                          Shu kartani ochish
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className={`game-tab-section ${gameTab === "vote" ? "mobile-active" : ""}`}>
              {isVoting && !gameFinished ? (
                <div className="vote-panel">
                  <div className="section-title">
                    <div>
                      <span>Yashirin ovoz</span>
                      <strong>Kim bunkerdan chiqishi kerak?</strong>
                    </div>

                    <em>
                      {game.voting?.type === "revote" ? "Durangdagi nomzodlar" : "Faol o‘yinchilar"}
                    </em>
                  </div>

                  {game.voting?.candidates?.length > 0 && (
                    <div className="candidate-list">
                      <span>Nomzodlar:</span>
                      <strong>
                        {game.voting.candidates.map((candidate) => candidate.name).join(", ")}
                      </strong>
                    </div>
                  )}

                  <div className="vote-options">
                    {game.voting?.options?.map((option) => (
                      <button
                        type="button"
                        className="vote-button"
                        key={option.id}
                        disabled={!game.voting?.canVote}
                        onClick={() => voteFor(option.id)}
                      >
                        <span>{option.isHost ? "Host" : "O‘yinchi"}</span>
                        <strong>{option.name}</strong>
                      </button>
                    ))}
                  </div>

                  {!game.voting?.canVote && !game.voting?.hasVoted && !game.meIsEliminated && (
                    <p className="empty-card">
                      Hozir ovoz berish uchun mos nomzod yo‘q.
                    </p>
                  )}
                </div>
              ) : (
                <div className="vote-panel empty-vote-panel">
                  <div className="section-title">
                    <div>
                      <span>Ovoz berish</span>
                      <strong>Hali boshlanmadi</strong>
                    </div>
                  </div>

                  <p className="empty-card">
                    Har 2 ta karta ochish raundidan keyin ovoz berish boshlanadi.
                  </p>
                </div>
              )}

              {game?.eliminationHistory?.length > 0 && (
                <div className="history-panel">
                  <div className="section-title">
                    <div>
                      <span>Ovoz berish natijalari</span>
                      <strong>Chiqarilganlar</strong>
                    </div>
                  </div>

                  <div className="history-list">
                    {game.eliminationHistory.map((item) => (
                      <div className="history-row" key={`${item.playerId}_${item.createdAt}`}>
                        <span>{item.roundNumber}-raund</span>
                        <strong>{item.playerName}</strong>
                        <em>{item.votes} ovoz</em>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className={`game-tab-section ${gameTab === "chat" ? "mobile-active" : ""}`}>
              {renderChatPanel()}
            </div>
            <div className={`game-tab-section players-tab-section ${gameTab === "players" ? "mobile-active" : ""}`}>
              <div className="section-title public-title">
                <div>
                  <span>Hammaga ko‘rinadigan ma’lumotlar</span>
                  <strong>O‘yinchilar profili</strong>
                </div>
              </div>

              <div className="revealed-grid">
                {game?.players?.map((player) => (
                  <div className={player.eliminated ? "reveal-card eliminated" : "reveal-card"} key={player.id}>
                    <div className="reveal-head">
                      <strong>
                        {player.name}
                        {player.id === playerId ? " — siz" : ""}
                      </strong>

                      <span>
                        {player.eliminated ? "Chiqarilgan" : player.isHost ? "Host" : "O‘yinchi"}
                      </span>
                    </div>

                    <div className="player-progress">
                      <span>Ochilgan: {player.revealedCount}/{player.totalCards}</span>
                      <strong>
                        {player.eliminated
                          ? "Kuzatuvchi"
                          : player.hasRevealedThisRound
                            ? "Bu raundda ochdi"
                            : isReveal
                              ? "Kutilmoqda"
                              : "Faol"}
                      </strong>
                    </div>

                    <div className="facts-list full-slots">
                      {(player.cardSlots || []).map((item) => (
                        <div
                          className={item.revealed ? "fact-row opened-slot" : "fact-row closed-slot"}
                          key={item.key}
                        >
                          <span>{item.label}</span>
                          <strong>{item.revealed ? item.value : "Yopiq"}</strong>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <aside className="players-panel game-panel">
            <div className="panel-header">
              <span>Xona kodi</span>
              <strong>{room.code}</strong>
            </div>

            <div className="mini-info">
              <span>Bunker joylari</span>
              <strong>{game?.bunkerSlots}</strong>
            </div>

            <div className="mini-info">
              <span>Faol o‘yinchilar</span>
              <strong>{game?.activeCount}</strong>
            </div>

            <div className="players-list">
              {game?.players?.map((player, index) => (
                <div className={player.eliminated ? "player-row eliminated-row" : "player-row"} key={player.id}>
                  <div className="avatar">{index + 1}</div>

                  <div>
                    <strong>
                      {player.name}
                      {player.id === playerId ? " — siz" : ""}
                    </strong>

                    <span>
                      {player.eliminated ? "Chiqarilgan" : player.isHost ? "Host" : "O‘yinchi"}
                    </span>
                  </div>

                  <div className={player.eliminated ? "ready-dot danger-dot" : "ready-dot active"} />
                </div>
              ))}
            </div>
          </aside>
        </section>
      </main>
    );
  }

  if (room) {
    return (
      <main className="app-shell">
        <section className="lobby-layout">
          <div className="lobby-main">
            <div className="badge">Xona kutish rejimi</div>

            <h1>So‘nggi Joy</h1>

            <p className="subtitle">
              Xona yaratildi. Endi do‘stlaringizga kodni yuboring. Hozircha test
              uchun kamida {minPlayers} ta o‘yinchi kerak.
            </p>

            <div className="room-code-card">
              <span>Xona kodi</span>
              <strong>{room.code}</strong>
              <button type="button" onClick={copyRoomCode}>
                Kodni nusxalash
              </button>
            </div>

            {error && <div className="error-box">{error}</div>}

            <div className="lobby-actions">
              <button type="button" onClick={toggleReady}>
                {me?.ready ? "Tayyorlikni bekor qilish" : "Men tayyorman"}
              </button>

              {isHost && (
                <button
                  type="button"
                  className={allReady ? "" : "disabled"}
                  disabled={!allReady}
                  onClick={startGame}
                  title={!allReady ? `Kamida ${minPlayers} o‘yinchi va hamma tayyor bo‘lishi kerak` : ""}
                >
                  O‘yinni boshlash
                </button>
              )}

              <button type="button" className="secondary" onClick={leaveRoom}>
                Xonadan chiqish
              </button>
            </div>

            <p className="note">
              O‘yin boshlanganda har kim o‘zining barcha kartasini ko‘radi va istagan kartasini ochadi.
            </p>
          </div>

          <aside className="players-panel">
            <div className="panel-header">
              <span>O‘yinchilar</span>
              <strong>{room.players.length}/{room.maxPlayers}</strong>
            </div>

            <div className="players-list">
              {room.players.map((player, index) => (
                <div className="player-row" key={player.id}>
                  <div className="avatar">{index + 1}</div>

                  <div>
                    <strong>
                      {player.name}
                      {player.id === playerId ? " — siz" : ""}
                    </strong>

                    <span>
                      {player.isHost ? "Host" : "O‘yinchi"} •{" "}
                      {player.ready ? "Tayyor" : "Kutilmoqda"}
                    </span>
                  </div>

                  <div className={player.ready ? "ready-dot active" : "ready-dot"} />
                </div>
              ))}
            </div>
          </aside>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <section className="hero-card">
        <div className="badge">Telegram Mini App o‘yini</div>

        <h1>So‘nggi Joy</h1>

        <p className="subtitle">
          Apokalipsisdan keyin bunkerda kim qoladi? Kartalarni oching,
          bahslashing, ovoz bering va omon qolishga harakat qiling.
        </p>

        <div className="status-grid">
          <div className="status-box">
            <span>API</span>
            <strong>{apiStatus}</strong>
          </div>

          <div className="status-box">
            <span>Socket</span>
            <strong>{socketStatus}</strong>
          </div>
        </div>

        <div className="form-grid">
          <label>
            Ismingiz
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Masalan: Islombek"
              maxLength={24}
            />
          </label>

          <label>
            Xona kodi
            <input
              value={joinCode}
              onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
              placeholder="Masalan: A7K2"
              maxLength={4}
            />
          </label>
        </div>

        {error && <div className="error-box">{error}</div>}

        <div className="actions">
          <button type="button" onClick={createNewRoom} disabled={busy || !socket}>
            Xona yaratish
          </button>

          <button
            type="button"
            className="secondary"
            onClick={joinExistingRoom}
            disabled={busy || !socket}
          >
            Kod orqali kirish
          </button>
        </div>

        <p className="note">
          Test uchun bitta oynada xona yarating, keyin boshqa brauzer oynasida
          shu kod orqali kiring.
        </p>
      </section>
    </main>
  );
}