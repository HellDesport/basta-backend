// src/routes/games.routes.js
import { Router } from "express";
import { CreateGameSchema, JoinSchema } from "../validators/game.schemas.js";

import * as gameRepo from "../repositories/game.repo.js";
import * as gameService from "../services/game.service.js";
import * as catRepo from "../repositories/category.repo.js";
import * as roundRepo from "../repositories/round.repo.js";

export const gamesRouter = Router();

/* =======================================================
   POST /games → Crear sala con host
======================================================= */
gamesRouter.post("/", async (req, res, next) => {
  try {
    const body = CreateGameSchema.parse(req.body);
    const data = await gameService.createGameWithHost(body);

    req.io.to(data.game.code).emit("lobby:update", {
      players: data.players,
      hostId: data.game.hostId,
      locked: Boolean(data.game.locked),
      pointLimit: data.game.pointLimit,
      roundLimit: data.game.roundLimit
    });

    res.status(201).json(data);
  } catch (e) {
    next(e);
  }
});

/* =======================================================
   POST /games/:code/settings → Cambiar límites
======================================================= */
gamesRouter.post("/:code/settings", async (req, res, next) => {
  try {
    const code = req.params.code.toUpperCase();
    const { pointLimit, roundLimit } = req.body;

    const game = await gameRepo.getGameByCode(code);
    if (!game) return res.status(404).json({ error: "GAME_NOT_FOUND" });

    await gameRepo.updateGame(game.id, {
      point_limit: Number(pointLimit),
      round_limit: Number(roundLimit)
    });

    const players = await gameRepo.listPlayers(game.id);
    const host = players.find((p) => p.is_host === 1);

    req.io.to(code).emit("lobby:update", {
      players,
      hostId: host ? host.id : null,
      locked: Boolean(game.locked),
      pointLimit,
      roundLimit
    });

    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

/* =======================================================
   POST /games/join → Unirse
======================================================= */
gamesRouter.post("/join", async (req, res, next) => {
  try {
    const body = JoinSchema.parse(req.body);
    const data = await gameService.joinGame(body);

    req.io.to(data.game.code).emit("lobby:update", {
      players: data.players,
      hostId: data.game.hostId,
      locked: Boolean(data.game.locked),
      pointLimit: data.game.pointLimit,
      roundLimit: data.game.roundLimit
    });

    res.json(data);
  } catch (e) {
    next(e);
  }
});

/* =======================================================
   GET /games/:code → Lobby completo
======================================================= */
gamesRouter.get("/:code", async (req, res, next) => {
  try {
    const code = req.params.code.toUpperCase();

    const game = await gameRepo.getGameByCode(code);
    if (!game) return res.status(404).json({ error: "GAME_NOT_FOUND" });

    const players = await gameRepo.listPlayers(game.id);
    const host = players.find((p) => p.is_host === 1);

    res.json({
      game: {
        id: game.id,
        code: game.code,
        status: game.status,
        locked: Boolean(game.locked),
        hostId: host ? host.id : null,
        pointLimit: game.point_limit,
        roundLimit: game.round_limit,
        durationSec: game.duration_sec ?? 60,
        currentRound: game.current_round ?? 0
      },
      players
    });

  } catch (e) {
    next(e);
  }
});

/* =======================================================
   GET /games/:code/ingame
======================================================= */
gamesRouter.get("/:code/ingame", async (req, res, next) => {
  try {
    const code = req.params.code.toUpperCase();

    const game = await gameRepo.getGameByCode(code);
    if (!game) return res.status(404).json({ error: "GAME_NOT_FOUND" });

    const players = await gameRepo.listPlayers(game.id);

    const round = await roundRepo.getActiveRound(game.id);
    let roundPayload = null;

    if (round) {
      const categories = await catRepo.listByGame(game.id) || [];

      const endsAt = round.ends_at ? new Date(round.ends_at) : null;
      const now = new Date();
      let left = endsAt ? Math.floor((endsAt - now) / 1000) : 0;
      if (!Number.isFinite(left)) left = 0;

      const secs = Number(round.duration_sec) || 60;

      roundPayload = {
        id: round.id,
        letter: round.letter || "A",
        secs,
        left: Math.max(left, 0),
        running: left > 0,
        categories
      };
    }

    const scores = await gameRepo.getScores(game.id);
    const totalRounds = await roundRepo.countRounds(game.id);

    return res.json({
      gameId: game.id,
      players,
      round: roundPayload,
      scores,
      pointLimit: game.point_limit,
      roundLimit: game.round_limit,
      roundsPlayed: totalRounds,
      currentRound: game.current_round ?? 0
    });

  } catch (err) {
    console.error("❌ GET /ingame ERROR:", err);
    return res.status(500).json({ error: "SERVER_INGAME_ERROR" });
  }
});

/* =======================================================
   POST /games/:code/start
======================================================= */
gamesRouter.post("/:code/start", async (req, res, next) => {
  try {
    const code = req.params.code.toUpperCase();
    const { tMinus = 3 } = req.body;

    const game = await gameRepo.getGameByCode(code);
    if (!game) return res.status(404).json({ error: "GAME_NOT_FOUND" });

    req.io.to(code).emit("game:starting", { tMinus });

    setTimeout(() => {
      req.io.to(code).emit("game:started", { gameId: game.id });
    }, tMinus * 1000);

    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

/* ======================================================= 
   POST /games/:code/players/:id/leave
======================================================= */
gamesRouter.post("/:code/players/:id/leave", async (req, res, next) => {
  try {
    const code = req.params.code.toUpperCase();
    const playerId = Number(req.params.id);

    const game = await gameRepo.getGameByCode(code);
    if (!game) return res.status(404).json({ error: "GAME_NOT_FOUND" });

    // 🔥 removePlayer ahora recibe SOLO playerId
    await gameRepo.removePlayer(playerId);

    const players = await gameRepo.listPlayers(game.id);
    const host = players.find((p) => p.is_host === 1);

    req.io.to(code).emit("lobby:update", {
      players,
      hostId: host ? host.id : null,
      locked: Boolean(game.locked),
      pointLimit: game.point_limit,
      roundLimit: game.round_limit
    });

    res.json({ ok: true });

  } catch (e) {
    next(e);
  }
});
