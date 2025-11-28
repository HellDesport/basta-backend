import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import http from 'http';
import { Server as IOServer } from 'socket.io';

import { gamesRouter } from './routes/games.routes.js';
import { roundsRouter } from './routes/round.routes.js';
import { answersRouter } from './routes/answers.routes.js';

// repos
import * as submissionRepo from './repositories/submission.repo.js';
import * as roundRepo from './repositories/round.repo.js';
import * as gameRepo from './repositories/game.repo.js';

// servicios
import * as gameService from './services/game.service.js';

const app = express();

/* =======================================================
   CORS + JSON
======================================================= */
let ALLOW_ORIGINS = process.env.CORS_ORIGIN?.split(',')
  .map(s => s.trim())
  .filter(Boolean);

if (!ALLOW_ORIGINS || ALLOW_ORIGINS.length === 0) ALLOW_ORIGINS = true;

app.use(cors({
  origin: "*",
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type"]
}));
app.use(express.json());

/* =======================================================
   HEALTHCHECK
======================================================= */
app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

/* =======================================================
   HTTP + SOCKET.IO
======================================================= */
const server = http.createServer(app);

const io = new IOServer(server, {
  path: "/socket.io",
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: false
  }
});

app.use((req, _res, next) => { req.io = io; next(); });

/* =======================================================
   RUTAS API
======================================================= */
app.use('/api/games', gamesRouter);
app.use('/api', roundsRouter);
app.use('/api', answersRouter);

/* =======================================================================
   TIMERS POR RONDA (motor del juego)
======================================================================= */
const ROUND_TIMERS = new Map();

export async function startRoundTimer(round) {
  const roundId = round.id;

  const game = await gameRepo.getGameById(round.game_id);
  if (!game) return;

  const room = game.code;
  let timeLeft = Number(round.duration_sec) || 60;

  if (ROUND_TIMERS.has(roundId)) {
    clearInterval(ROUND_TIMERS.get(roundId));
    ROUND_TIMERS.delete(roundId);
  }

  const interval = setInterval(async () => {
    timeLeft--;

    io.to(room).emit("round:countdown", { roundId, timeLeft });

    if (timeLeft <= 0) {
      clearInterval(interval);
      ROUND_TIMERS.delete(roundId);

      await finishRound(roundId);
    }
  }, 1000);

  ROUND_TIMERS.set(roundId, interval);
}

/* =======================================================
   FINALIZAR RONDA
======================================================= */
async function finishRound(roundId) {
  try {
    const round = await roundRepo.getById(roundId);
    if (!round || round.is_finished === 1) return;

    const game = await gameRepo.getGameById(round.game_id);
    if (!game) return;

    const submissions = await submissionRepo.getSubmissionsOfRound(roundId);

    const groups = {};
    submissions.forEach(s => {
      const key = `${s.category_id}:${s.normalized_text}`;
      groups[key] = groups[key] || [];
      groups[key].push(s);
    });

    const duplicates = [];
    Object.values(groups).forEach(g => {
      if (g.length > 1 && g[0].normalized_text.trim() !== "") {
        g.forEach(s => duplicates.push(s.player_id));
      }
    });

    const scoreMap = {};
    submissions.forEach(s => {
      if (!scoreMap[s.player_id]) scoreMap[s.player_id] = 0;
      let add = 0;

      if (!s.raw_text.trim()) add = 0;
      else if (!s.is_valid_letter) add = 0;
      else if (duplicates.includes(s.player_id)) add = 0;
      else add = 100;

      scoreMap[s.player_id] += add;
    });

    const scores = [];
    for (const [playerId, total] of Object.entries(scoreMap)) {
      const pid = Number(playerId);
      const name = submissions.find(x => x.player_id === pid)?.name || "";

      scores.push({ id: pid, name, total });
      await gameRepo.addScoreToPlayer(game.id, pid, total);
    }

    await roundRepo.markFinished(roundId);

    io.to(game.code).emit("round:ended", {
      roundId,
      results: { scores, duplicates },
      nextInSec: 5
    });

    const end = await gameService.checkGameEnd(game.id);
    if (end.finished) {
      io.to(game.code).emit("game:finished", {
        winner: end.winner,
        reason: end.reason
      });
    }

  } catch (err) {
    console.error("❌ finishRound error:", err);
  }
}

/* =======================================================
   SOCKET HANDLERS
======================================================= */
io.on("connection", (socket) => {
  console.log(`🔌 WS conectado: ${socket.id}`);

  socket.on("game:join", async ({ code, playerId }) => {
    socket.join(code);

    const game = await gameRepo.getGameByCode(code);
    if (!game) return;

    const players = await gameRepo.listPlayers(game.id);
    const host = players.find(p => p.is_host === 1);

    io.to(code).emit("lobby:update", {
      players,
      hostId: host ? host.id : null,
      locked: Boolean(game.locked),
      pointLimit: game.point_limit,
      roundLimit: game.round_limit
    });

    socket.emit("joined", { room: code });
  });

  socket.on("round:basta", async ({ code }) => {
    const game = await gameRepo.getGameByCode(code);
    if (!game) return;

    const active = await roundRepo.getActiveRound(game.id);
    if (!active) return;

    finishRound(active.id);
  });

  socket.on("round:answers", async (payload) => {
    try {
      const { code, roundId, playerId, answers } = payload;

      const round = await roundRepo.getById(roundId);
      if (!round) return socket.emit("answers:saved", { ok: false });

      await submissionRepo.saveAnswers({ round, playerId, answers });
      socket.emit("answers:saved", { ok: true });

      const expected = await roundRepo.countPlayersInGame(round.game_id);
      const submitted = await submissionRepo.countPlayersSubmitted(roundId);

      if (submitted >= expected) finishRound(roundId);

    } catch {
      socket.emit("answers:saved", { ok: false });
    }
  });

  socket.on("disconnect", () => {
    console.log(`❎ WS desconectado: ${socket.id}`);
  });
});

/* =======================================================
   INICIO SERVER
======================================================= */
const PORT = process.env.PORT || 8080;

server.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server listening on port ${PORT}`);
});
