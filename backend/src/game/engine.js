import { cardDeck, cardLabels } from "./cards.js";

export const cardOrder = [
  "job",
  "age",
  "health",
  "character",
  "phobia",
  "hobby",
  "inventory",
  "special"
];

function pickRandom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function createPlayerCard() {
  return {
    job: pickRandom(cardDeck.jobs),
    age: pickRandom(cardDeck.ages),
    health: pickRandom(cardDeck.health),
    character: pickRandom(cardDeck.character),
    phobia: pickRandom(cardDeck.phobias),
    hobby: pickRandom(cardDeck.hobby),
    inventory: pickRandom(cardDeck.inventory),
    special: pickRandom(cardDeck.special)
  };
}

function getBunkerSlots(totalPlayers) {
  return Math.max(1, Math.floor(totalPlayers / 2));
}

function getActivePlayers(game, players) {
  return players.filter((player) => !game.eliminatedPlayerIds.includes(player.id));
}

function getPlayerName(players, playerId) {
  return players.find((player) => player.id === playerId)?.name || "Noma’lum o‘yinchi";
}

function countRevealedForPlayer(game, playerId) {
  return game.revealedByPlayer[playerId]?.length || 0;
}

function hasPlayerRevealedThisRound(game, playerId) {
  const roundKey = String(game.roundNumber);
  return Boolean(game.roundReveals[roundKey]?.[playerId]);
}

function isPlayerFullyRevealed(game, playerId) {
  return countRevealedForPlayer(game, playerId) >= cardOrder.length;
}

function isPlayerActive(game, playerId) {
  return !game.eliminatedPlayerIds.includes(playerId);
}

function isRoundComplete(game, players) {
  if (!game || game.status !== "playing" || game.phase !== "reveal") {
    return false;
  }

  const activePlayers = getActivePlayers(game, players);

  return activePlayers.every((player) => {
    return hasPlayerRevealedThisRound(game, player.id) || isPlayerFullyRevealed(game, player.id);
  });
}

function areAllActiveCardsRevealed(game, players) {
  const activePlayers = getActivePlayers(game, players);
  return activePlayers.every((player) => isPlayerFullyRevealed(game, player.id));
}

function startVoting(game, players, candidateIds = null, type = "normal") {
  const activePlayers = getActivePlayers(game, players);
  const activeIds = activePlayers.map((player) => player.id);

  game.phase = "voting";
  game.votes = {};
  game.voteRound += 1;
  game.voting = {
    type,
    candidates: Array.isArray(candidateIds) && candidateIds.length > 0 ? candidateIds : activeIds,
    startedAt: new Date().toISOString()
  };

  return game;
}

function finishGame(game) {
  game.status = "finished";
  game.phase = "finished";
  game.votes = {};
  game.voting = null;
  return game;
}

function moveToNextRevealOrFinish(game, players) {
  const activePlayers = getActivePlayers(game, players);

  if (activePlayers.length <= game.bunkerSlots) {
    return finishGame(game);
  }

  if (game.roundNumber >= game.totalRounds || areAllActiveCardsRevealed(game, players)) {
    return startVoting(game, players, null, "final");
  }

  game.roundNumber += 1;
  game.phase = "reveal";
  game.roundComplete = false;
  game.votes = {};
  game.voting = null;

  return game;
}

function countVotes(votes) {
  const counts = {};

  for (const targetId of Object.values(votes)) {
    counts[targetId] = (counts[targetId] || 0) + 1;
  }

  return counts;
}

function evaluateVotesIfComplete(game, players) {
  const activePlayers = getActivePlayers(game, players);
  const activeIds = activePlayers.map((player) => player.id);
  const votesCount = Object.keys(game.votes).filter((voterId) => activeIds.includes(voterId)).length;

  if (votesCount < activePlayers.length) {
    return game;
  }

  const counts = countVotes(game.votes);
  let maxVotes = 0;

  for (const value of Object.values(counts)) {
    if (value > maxVotes) {
      maxVotes = value;
    }
  }

  const topIds = Object.entries(counts)
    .filter((entry) => entry[1] === maxVotes)
    .map((entry) => entry[0]);

  if (topIds.length !== 1) {
    game.lastVoteResult = {
      type: "tie",
      tiedPlayerIds: topIds,
      tiedPlayerNames: topIds.map((id) => getPlayerName(players, id)),
      createdAt: new Date().toISOString()
    };

    game.votes = {};
    return startVoting(game, players, topIds, "revote");
  }

  const eliminatedId = topIds[0];

  game.eliminatedPlayerIds.push(eliminatedId);
  game.eliminationHistory.push({
    playerId: eliminatedId,
    playerName: getPlayerName(players, eliminatedId),
    roundNumber: game.roundNumber,
    voteRound: game.voteRound,
    votes: counts[eliminatedId],
    createdAt: new Date().toISOString()
  });

  game.lastVoteResult = {
    type: "eliminated",
    eliminatedPlayerId: eliminatedId,
    eliminatedPlayerName: getPlayerName(players, eliminatedId),
    votes: counts[eliminatedId],
    createdAt: new Date().toISOString()
  };

  return moveToNextRevealOrFinish(game, players);
}

export function createGame(players) {
  const playerCards = {};
  const revealedByPlayer = {};

  for (const player of players) {
    playerCards[player.id] = createPlayerCard();
    revealedByPlayer[player.id] = [];
  }

  return {
    status: "playing",
    phase: "reveal",
    roundNumber: 1,
    totalRounds: cardOrder.length,
    roundComplete: false,
    bunkerSlots: getBunkerSlots(players.length),
    catastrophe: pickRandom(cardDeck.catastrophes),
    bunker: pickRandom(cardDeck.bunkers),
    playerCards,
    revealedByPlayer,
    roundReveals: {},
    eliminatedPlayerIds: [],
    eliminationHistory: [],
    votes: {},
    voteRound: 0,
    voting: null,
    lastVoteResult: null,
    startedAt: new Date().toISOString()
  };
}

export function revealOwnCard(game, players, playerId, cardKey) {
  if (!game || game.status !== "playing") {
    return {
      ok: false,
      error: "O‘yin hozir faol emas"
    };
  }

  if (game.phase !== "reveal") {
    return {
      ok: false,
      error: "Hozir karta ochish bosqichi emas"
    };
  }

  if (!isPlayerActive(game, playerId)) {
    return {
      ok: false,
      error: "Siz o‘yindan chiqarilgansiz"
    };
  }

  const key = String(cardKey || "").trim();

  if (!cardOrder.includes(key)) {
    return {
      ok: false,
      error: "Bunday karta turi yo‘q"
    };
  }

  const playerExists = players.some((player) => player.id === playerId);

  if (!playerExists) {
    return {
      ok: false,
      error: "O‘yinchi topilmadi"
    };
  }

  if (!game.playerCards[playerId]) {
    return {
      ok: false,
      error: "Sizga karta berilmagan"
    };
  }

  if (!game.revealedByPlayer[playerId]) {
    game.revealedByPlayer[playerId] = [];
  }

  if (game.revealedByPlayer[playerId].includes(key)) {
    return {
      ok: false,
      error: "Bu karta oldin ochilgan"
    };
  }

  if (hasPlayerRevealedThisRound(game, playerId)) {
    return {
      ok: false,
      error: "Siz bu raundda bitta kartani ochib bo‘ldingiz"
    };
  }

  const roundKey = String(game.roundNumber);

  if (!game.roundReveals[roundKey]) {
    game.roundReveals[roundKey] = {};
  }

  game.revealedByPlayer[playerId].push(key);
  game.roundReveals[roundKey][playerId] = key;
  game.roundComplete = isRoundComplete(game, players);

  return {
    ok: true,
    game
  };
}

export function advanceRound(game, players) {
  if (!game || game.status !== "playing") {
    return {
      ok: false,
      error: "O‘yin hozir faol emas"
    };
  }

  if (game.phase !== "reveal") {
    return {
      ok: false,
      error: "Hozir raund almashtirish bosqichi emas"
    };
  }

  game.roundComplete = isRoundComplete(game, players);

  if (!game.roundComplete) {
    return {
      ok: false,
      error: "Hamma faol o‘yinchi bu raundda bittadan karta ochishi kerak"
    };
  }

  const shouldVote = game.roundNumber % 2 === 0 || game.roundNumber >= game.totalRounds || areAllActiveCardsRevealed(game, players);

  if (shouldVote) {
    startVoting(game, players, null, "normal");

    return {
      ok: true,
      game
    };
  }

  game.roundNumber += 1;
  game.roundComplete = false;

  return {
    ok: true,
    game
  };
}

export function voteForPlayer(game, players, voterId, targetId) {
  if (!game || game.status !== "playing") {
    return {
      ok: false,
      error: "O‘yin hozir faol emas"
    };
  }

  if (game.phase !== "voting") {
    return {
      ok: false,
      error: "Hozir ovoz berish bosqichi emas"
    };
  }

  if (!isPlayerActive(game, voterId)) {
    return {
      ok: false,
      error: "O‘yindan chiqqan o‘yinchi ovoz bera olmaydi"
    };
  }

  if (!isPlayerActive(game, targetId)) {
    return {
      ok: false,
      error: "Bu o‘yinchiga ovoz berib bo‘lmaydi"
    };
  }

  if (voterId === targetId) {
    return {
      ok: false,
      error: "O‘zingizga ovoz bera olmaysiz"
    };
  }

  if (game.votes[voterId]) {
    return {
      ok: false,
      error: "Siz ovoz berib bo‘ldingiz"
    };
  }

  const candidates = game.voting?.candidates || [];
  const canVoteTarget = candidates.includes(targetId);

  if (!canVoteTarget) {
    return {
      ok: false,
      error: "Qayta ovoz berishda faqat durangdagi o‘yinchilardan birini tanlash mumkin"
    };
  }

  game.votes[voterId] = targetId;
  game = evaluateVotesIfComplete(game, players);

  return {
    ok: true,
    game
  };
}

export function getPublicGame(game, players, viewerPlayerId, hostId) {
  if (!game) {
    return null;
  }

  const activePlayers = getActivePlayers(game, players);
  const activeIds = activePlayers.map((player) => player.id);
  const viewerIsEliminated = game.eliminatedPlayerIds.includes(viewerPlayerId);
  const roundKey = String(game.roundNumber);
  const currentRoundReveals = game.roundReveals[roundKey] || {};
  const viewerFullCard = game.playerCards[viewerPlayerId] || null;
  const viewerRevealedKeys = game.revealedByPlayer[viewerPlayerId] || [];
  const viewerHasRevealedThisRound = hasPlayerRevealedThisRound(game, viewerPlayerId);

  if (game.phase === "reveal") {
    game.roundComplete = isRoundComplete(game, players);
  }

  const myCard = viewerFullCard
    ? cardOrder.map((key) => ({
        key,
        label: cardLabels[key],
        value: viewerFullCard[key],
        revealed: viewerRevealedKeys.includes(key),
        canReveal:
          game.status === "playing" &&
          game.phase === "reveal" &&
          !viewerIsEliminated &&
          !viewerRevealedKeys.includes(key) &&
          !viewerHasRevealedThisRound &&
          !game.roundComplete
      }))
    : [];

  const publicPlayers = players.map((player) => {
    const fullCard = game.playerCards[player.id] || {};
    const revealedKeys = game.revealedByPlayer[player.id] || [];
    const visibleCard = {};

    for (const key of revealedKeys) {
      visibleCard[key] = {
        label: cardLabels[key],
        value: fullCard[key]
      };
    }

    const eliminated = game.eliminatedPlayerIds.includes(player.id);

    const cardSlots = cardOrder.map((key) => {
      const revealed = revealedKeys.includes(key);

      return {
        key,
        label: cardLabels[key],
        revealed,
        value: revealed ? fullCard[key] : null
      };
    });

    return {
      id: player.id,
      name: player.name,
      isHost: player.id === hostId,
      status: eliminated ? "eliminated" : "active",
      eliminated,
      hasRevealedThisRound: eliminated ? false : hasPlayerRevealedThisRound(game, player.id),
      revealedCount: revealedKeys.length,
      totalCards: cardOrder.length,
      currentRoundOpenedKey: currentRoundReveals[player.id] || null,
      card: visibleCard,
      cardSlots
    };
  });

  let voting = null;

  if (game.phase === "voting") {
    const candidates = game.voting?.candidates || activeIds;
    const viewerHasVoted = Boolean(game.votes[viewerPlayerId]);

    const options = activePlayers
      .filter((player) => player.id !== viewerPlayerId)
      .filter((player) => candidates.includes(player.id))
      .map((player) => ({
        id: player.id,
        name: player.name,
        isHost: player.id === hostId
      }));

    voting = {
      type: game.voting?.type || "normal",
      voteRound: game.voteRound,
      candidates: candidates.map((id) => ({
        id,
        name: getPlayerName(players, id)
      })),
      options,
      hasVoted: viewerHasVoted,
      myVoteTarget: game.votes[viewerPlayerId] || null,
      votedCount: Object.keys(game.votes).filter((voterId) => activeIds.includes(voterId)).length,
      votersTotal: activePlayers.length,
      canVote: !viewerIsEliminated && !viewerHasVoted && options.length > 0,
      lastVoteResult: game.lastVoteResult
    };
  }

  const winners = game.status === "finished"
    ? activePlayers.map((player) => ({
        id: player.id,
        name: player.name,
        isHost: player.id === hostId
      }))
    : [];

  return {
    status: game.status,
    phase: game.phase,
    catastrophe: game.catastrophe,
    bunker: game.bunker,
    bunkerSlots: game.bunkerSlots,
    activeCount: activePlayers.length,
    eliminatedCount: game.eliminatedPlayerIds.length,
    roundNumber: game.roundNumber,
    totalRounds: game.totalRounds,
    roundComplete: game.roundComplete,
    roundRevealsCount: Object.keys(currentRoundReveals).length,
    playersTotal: activePlayers.length,
    meIsEliminated: viewerIsEliminated,
    meHasRevealedThisRound: viewerHasRevealedThisRound,
    myCard,
    players: publicPlayers,
    voting,
    eliminationHistory: game.eliminationHistory,
    lastVoteResult: game.lastVoteResult,
    winners
  };
}