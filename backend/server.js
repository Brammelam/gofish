import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import {
  createGame,
  joinGame,
  leaveGame,
  handleAsk,
  getGame,
  sendMessage,
  updatePlayerName,
} from "./gameManager.js";

const app = express();
app.use(cors());
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: "*" } });

io.on("connection", (socket) => {
  console.log("🧩 Socket connected:", socket.id);

  socket.on("createGame", async (data) => {
    const isObject = typeof data === "object" && data !== null;
    const playerId = isObject ? data.playerId : data;
    const name = isObject ? data.name || "Anonymous" : "Anonymous";
    const vsAI = isObject ? !!data.vsAI : false;

    const game = createGame(playerId, name, vsAI);

    socket.join(game.id);
    socket.emit("gameCreated", { id: game.id, state: game });

    if (vsAI) {
      const aiId = "AI_PLAYER";
      await joinGame(game.id, aiId, "Computer");
      io.to(game.id).emit("stateUpdate", game);
    }

    console.log(`🎮 Game ${game.id} created (${vsAI ? "vs AI" : "2-player"})`);
  });

  socket.on("joinGame", async (data) => {
    const { gameId, playerId, name } = data;
    const game = await joinGame(gameId, playerId, name);
    if (!game) return socket.emit("error", "Game not found");
    socket.join(gameId);
    io.to(gameId).emit("stateUpdate", game);
    sendMessage(io, gameId, `${name} joined`);
  });

  socket.on("leaveGame", async ({ gameId, playerId }) => {
    const result = await leaveGame(gameId, playerId);
    socket.leave(gameId);

    if (result.deleted) {
      console.log(`Game ${gameId} fully deleted`);
    } else if (result.removed && result.game) {
      io.to(gameId).emit("stateUpdate", result.game);
      sendMessage(io, gameId, "Player left");
    }
  });

  socket.on("ask", async (data) => {
    const { gameId, from, to, rank } = data;
    const game = await handleAsk(gameId, from, to, rank, io);
    if (!game) return socket.emit("error", "Invalid ask");
    io.to(gameId).emit("stateUpdate", game);
  });

  socket.on("getState", ({ gameId, playerId }) => {
    const game = getGame(gameId);
    if (!game) return socket.emit("error", "Game not found");
    socket.join(gameId);
    socket.emit("stateUpdate", game);
    console.log("[getState]", {
      gameId,
      playerId,
      existingPlayers: Object.keys(game.players),
    });
  });

  socket.on("updateName", ({ playerId, name }) => {
    const result = updatePlayerName(io, playerId, name);

    if (result.updated) {
      const { gameId, game, playerName } = result;

      io.to(gameId).emit("gameMessage", {
        text: `✏️ ${playerName} updated their name.`,
      });

      io.to(gameId).emit("stateUpdate", game);
      console.log(`Updated player ${playerId} name → ${playerName}`);
    } else {
      console.warn(`updateName: playerId ${playerId} not found in any game.`);
    }
  });
});

httpServer.listen(process.env.PORT ?? 4000, () =>
  console.log("🎴 Go Fish server running on port 4000")
);
