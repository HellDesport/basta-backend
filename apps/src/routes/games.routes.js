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
    res.status(201).json(data);
  } catch (e) {
    next(e);
  }
});

/* =======================================================
   POST /games/:code/join → Unirse a sala
======================================================= */
gamesRouter.post("/:code/settings", async (req, res, next) => {
  try {
    const code = req.params.code.toUpperCase();
    const { pointLimit, roundLimit } = req.body;

    const game = await gameRepo.getGameByCode(code);
    if (!game) {
      return res.status(404).json({ error: "GAME_NOT_FOUND" });
    }

    await gameRepo.updateGame(game.id, {
      point_limit: Number(pointLimit),
      round_limit: Number(roundLimit)
    });

    res.json({ ok: true });

  } catch (e) {
    next(e);
  }
});

/* =======================================================
   GET /games/:code/categories
======================================================= */
gamesRouter.get("/:code/categories", async (req, res, next) => {
  try {
    const code = req.params.code.toUpperCase();

    const game = await gameRepo.getGameByCode(code);
    if (!game) return res.status(404).json({ error: "GAME_NOT_FOUND" });

    const categories = await catRepo.listByGame(game.id);
    res.json({ categories });

  } catch (e) {
    next(e);
  }
});

/* =======================================================
   GET /games/:code → Estado lobby
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
        locked: game.locked ?? false,
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
   GET /games/:code/ingame (VERSIÓN BLINDADA)
======================================================= */
gamesRouter.get("/:code/ingame", async (req, res, next) => {
  try {
    const code = req.params.code.toUpperCase();

    const game = await gameRepo.getGameByCode(code);
    if (!game) return res.status(404).json({ error: "GAME_NOT_FOUND" });

    const players = await gameRepo.listPlayers(game.id);

    // Ronda activa
    const round = await roundRepo.getActiveRound(game.id);
    let roundPayload = null;

    if (round) {
      const categories = await catRepo.listByGame(game.id) || [];

      const endsAt = round.ends_at ? new Date(round.ends_at) : null;
      const now = new Date();
      let left = 0;

      if (endsAt instanceof Date && !isNaN(endsAt)) {
        left = Math.floor((endsAt - now) / 1000);
        if (!Number.isFinite(left)) left = 0;
      }

      const secs = Number(round.duration_sec);
      const safeSecs = Number.isFinite(secs) ? secs : 60;

      roundPayload = {
        id: round.id,
        letter: round.letter || "A",
        secs: safeSecs,
        left: left < 0 ? 0 : left,
        running: left > 0,
        categories
      };
    }

    // Puntajes + rondas jugadas
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
   POST /games/:code/start → Iniciar cuenta regresiva
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

    await gameRepo.removePlayer(game.id, playerId);

    req.io.to(code).emit("player:left", { id: playerId });

    res.json({ ok: true });

  } catch (e) {
    next(e);
  }
});

