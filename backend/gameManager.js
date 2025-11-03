import fetch from "node-fetch";
import crypto from "crypto";

import fs from "fs";
const SAVE_FILE = "./games.json";
let games = {};

function saveGames() {
  fs.writeFileSync(SAVE_FILE, JSON.stringify(games, null, 2));
}

function loadGames() {
  if (fs.existsSync(SAVE_FILE)) {
    games = JSON.parse(fs.readFileSync(SAVE_FILE, "utf8"));
  }
}

loadGames();

export function createGame(playerId, name = 'Anonymous') {
  const gameId = crypto.randomUUID();
  games[gameId] = {
    id: gameId,
    players: {
      [playerId]: { name, hand: [], sets: [] },
    },
    started: false,
    turn: null,
  };
  saveGames();
  return games[gameId];
}

export async function joinGame(gameId, playerId, name = 'Anonymous') {
  const game = games[gameId];
  if (!game) return null;

  if (!game.players[playerId]) {
    game.players[playerId] = { name, hand: [], sets: [] };
  } else if (!game.players[playerId].name) {
    // update name if previously missing
    game.players[playerId].name = name;
  }

  if (!game.started && Object.keys(game.players).length === 2) {
    await startGame(game);
  }

  saveGames();

  return game;
}

async function startGame(game) {
  try {
    const deck = await fetch(
      "https://deckofcardsapi.com/api/deck/new/shuffle/"
    ).then((res) => res.json());

    const draw = await fetch(
      `https://deckofcardsapi.com/api/deck/${deck.deck_id}/draw/?count=14`
    ).then((res) => res.json());

    game.remaining = 52 - 14;

    if (!draw.cards || draw.cards.length < 14)
      throw new Error("Not enough cards drawn");

    const ids = Object.keys(game.players);
    game.players[ids[0]].hand = draw.cards.slice(0, 7);
    game.players[ids[1]].hand = draw.cards.slice(7, 14);

    game.deckId = deck.deck_id;
    game.turn = ids[0];
    game.started = true;

    console.log(game);
  } catch (err) {
    console.error("Failed to start game:", err);
  }
}

export async function leaveGame(gameId, playerId) {
  const game = games[gameId];
  if (!game) return { removed: false, deleted: false, game: null };

  delete game.players[playerId];

  // if no players left → delete game entirely
  if (Object.keys(game.players).length === 0) {
    delete games[gameId];
    console.log(`🗑️ Game ${gameId} deleted (no players left)`);
    return { removed: true, deleted: true, game: null };
  }

  console.log(`👋 Player ${playerId} left game ${gameId}`);
  saveGames();
  return { removed: true, deleted: false, game };
}

export async function handleAsk(gameId, from, to, rank, io) {
  const game = games[gameId];
  if (!game || !game.players[from] || !game.players[to]) return null;

  const asker = game.players[from];
  const target = game.players[to];

  if (!asker || !target) return null;

  const askerName = asker.name || from.slice(0, 5);
  const targetName = target.name || to.slice(0, 5);

  const matching = target.hand.filter((c) => c.value === rank);
  if (matching.length) {
    target.hand = target.hand.filter((c) => c.value !== rank);
    asker.hand.push(...matching);
    asker.hand = sortHand(asker.hand);
    target.hand = sortHand(target.hand);

    io.to(gameId).emit('gameMessage', {
      text: `🎯 ${askerName} asked ${targetName} for ${rank}s and got ${matching.length}!`,
    });

    const completed = checkForSets(gameId, asker, io);
    if (completed.length > 0) {
      io.to(gameId).emit("stateUpdate", games[gameId]); // sync everyone
    }

    
  } else {
    const draw = await fetch(
      `https://deckofcardsapi.com/api/deck/${game.deckId}/draw/?count=1`
    ).then((r) => r.json());

    if (draw.cards?.length) {
      const drawn = draw.cards[0];
      asker.hand.push(drawn);
      asker.hand = sortHand(asker.hand);
      target.hand = sortHand(target.hand);
      game.remaining = draw.remaining;
      io.to(gameId).emit('gameMessage', {
        text: `🎣 ${askerName} asked ${targetName} for ${rank}s — Go fish!`,
      });
      checkForSets(gameId, asker, io);
    }
  }

  const winner = checkGameOver(game);
  if (winner) {
    io.to(gameId).emit('gameMessage', {
      text: `🏆 ${game.players[winner].name || winner.slice(0, 5)} wins the game!`,
    });
    return;
  }

  game.turn = game.turn === from ? to : from;
  saveGames();
  return game;
}

function checkForSets(gameId, player, io) {
  const counts = {};
  const newSets = [];

  for (const card of player.hand) {
    const rank = card.value.toUpperCase();
    counts[rank] = (counts[rank] || 0) + 1;
  }

  for (const [rank, count] of Object.entries(counts)) {
    if (count === 4) {
      const setCards = player.hand.filter(
        (c) => c.value.toUpperCase() === rank
      );
      player.hand = player.hand.filter((c) => c.value.toUpperCase() !== rank);
      player.sets.push(setCards);
      newSets.push(rank);
    }
  }

  if (newSets.length > 0) {
    for (const rank of newSets) {
      io.to(gameId).emit('gameMessage', {
        text: `🎉 ${player.name || 'A player'} completed a set of ${rank}s!`,
      });
    }
    saveGames();
  }

  return newSets;
}

function checkGameOver(game) {
  const totalSets = Object.values(game.players).reduce(
    (sum, p) => sum + p.sets.length,
    0
  );
  if (totalSets === 13) {
    const scores = Object.entries(game.players).map(([id, p]) => ({
      id,
      score: p.sets.length,
    }));
    const winner = scores.reduce((a, b) => (a.score > b.score ? a : b));
    return winner.id;
  }
  return null;
}

export function sendMessage(io, gameId, text) {
  io.to(gameId).emit("message", { text });
}

function sortHand(hand) {
  const order = {
    ACE: 1,
    2: 2,
    3: 3,
    4: 4,
    5: 5,
    6: 6,
    7: 7,
    8: 8,
    9: 9,
    10: 10,
    JACK: 11,
    QUEEN: 12,
    KING: 13,
  };
  return hand.sort((a, b) => order[a.value] - order[b.value]);
}

export function getGame(gameId) {
  return games[gameId];
}

export function updatePlayerName(io, playerId, newName) {
  console.log("trying to update name to " + newName + " for " + playerId);
  for (const [gameId, game] of Object.entries(games)) {
    if (game.players[playerId]) {
      const oldName = game.players[playerId].name;
      game.players[playerId].name = newName;
      saveGames();
      io.to(game.id).emit("gameMessage", `${oldName} renamed to ${newName}!`);
      console.log("name updated");
      return { updated: true, gameId, game, playerName: newName };
    }
  }
  return { updated: false };
}

