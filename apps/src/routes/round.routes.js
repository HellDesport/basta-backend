// src/routes/round.routes.js
import { Router } from "express";
import { StartRoundSchema } from "../validators/game.schemas.js";
import * as gameRepo from "../repositories/game.repo.js";
import * as gameService from "../services/game.service.js";

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

    const round = await gameService.startRound({
      gameId: game.id,
      letter: body.letter,
      durationSec: body.durationSec ?? 60,
    });

    // Emitir evento redondeado y consistente
    req.io.to(game.code).emit("round:started", {
      roundId: round.id,
      letter: round.letter,

      // tiempos
      durationSec: round.durationSec,
      secs: round.secs,
      endsAt: round.endsAt,

      // ronda actual
      roundNumber: round.number,

      // categorías para que renderice inputs
      categories: round.categories
    });

    res.status(201).json({ round });

  } catch (err) {
    next(err);
  }
});
