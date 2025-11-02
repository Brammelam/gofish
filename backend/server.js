import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { createGame, joinGame, leaveGame, handleAsk, getGame, sendMessage } from './gameManager.js';

const app = express();
app.use(cors());
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: '*' } });

io.on('connection', (socket) => {
  console.log('🧩 Socket connected:', socket.id);

  socket.on('createGame', (playerId) => {
    const game = createGame(playerId);
    socket.join(game.id);
    socket.emit('gameCreated', { id: game.id, state: game });
  });

  socket.on('joinGame', async (data) => {
    const { gameId, playerId } = data;
    const game = await joinGame(gameId, playerId);
    if (!game) return socket.emit('error', 'Game not found');
    socket.join(gameId);
    io.to(gameId).emit('stateUpdate', game);
    sendMessage(io , gameId, "Player joined");
  });

  socket.on('leaveGame', async ({ gameId, playerId }) => {
    const result = await leaveGame(gameId, playerId);
    socket.leave(gameId);

    if (result.deleted) {
      console.log(`Game ${gameId} fully deleted`);
    } else if (result.removed && result.game) {
      io.to(gameId).emit('stateUpdate', result.game);
      sendMessage(io , gameId, "Player left");
    }
  });

  socket.on('ask', async (data) => {
    const { gameId, from, to, rank } = data;
    const game = await handleAsk(gameId, from, to, rank, io);
    if (!game) return socket.emit('error', 'Invalid ask');
    io.to(gameId).emit('stateUpdate', game);
  });

  socket.on('getState', ({ gameId, playerId }) => {
    const game = getGame(gameId);
    if (!game) return socket.emit('error', 'Game not found');
    socket.join(gameId);
    socket.emit('stateUpdate', game);
    console.log('[getState]', { gameId, playerId, existingPlayers: Object.keys(game.players) });

  });

});

httpServer.listen(4000, () => console.log('🎴 Go Fish server running on port 4000'));
