import { Router } from "express";
import { StartRoundSchema } from "../validators/game.schemas.js";
import * as gameRepo from "../repositories/game.repo.js";
import * as gameService from "../services/game.service.js";
import * as roundRepo from "../repositories/round.repo.js";

export const roundsRouter = Router();

/**
 * POST /games/:code/rounds
 * Inicia una nueva ronda
 */
roundsRouter.post("/games/:code/rounds", async (req, res, next) => {
  try {
    const code = String(req.params.code).trim().toUpperCase();
    const body = StartRoundSchema.parse(req.body);

    const game = await gameRepo.getGameByCode(code);
    if (!game) return res.status(404).json({ error: "GAME_NOT_FOUND" });

    // Crear ronda desde service
    const round = await gameService.startRound({
      gameId: game.id,
      letter: body.letter,
      durationSec: body.durationSec ?? 60,
    });

    // 🔥 Obtener la ronda REAL desde DB (con game_id, duration_sec, etc.)
    const fullRound = await roundRepo.getById(round.id);

    // 🔥 Notificar al servidor para arrancar el timer
    if (roundRepo.onRoundCreated) {
      await roundRepo.onRoundCreated(fullRound);
    }

    // 🔥 Emitir evento al cliente
    req.io.to(game.code).emit("round:started", {
      roundId: round.id,
      letter: round.letter,
      durationSec: round.durationSec,
      secs: round.secs,
      endsAt: round.endsAt,
      roundNumber: round.number,
      categories: round.categories
    });

    res.status(201).json({ round });

  } catch (err) {
    next(err);
  }
});
