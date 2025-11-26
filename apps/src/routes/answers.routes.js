// src/routes/answers.routes.js
import { Router } from 'express';
import { SubmitAnswersSchema } from '../validators/answers.schemas.js';
import * as gameRepo from '../repositories/game.repo.js';
import * as roundRepo from '../repositories/round.repo.js';
import * as submissionRepo from '../repositories/submission.repo.js';
import * as gameService from '../services/game.service.js';

export const answersRouter = Router();

answersRouter.post('/games/:code/rounds/:roundId/answers', async (req, res, next) => {
  try {
    const body = SubmitAnswersSchema.parse(req.body);

    const code = String(req.params.code).trim().toUpperCase();
    const game = await gameRepo.getGameByCode(code);
    if (!game) return res.status(404).json({ error: 'GAME_NOT_FOUND' });

    const roundId = Number(req.params.roundId);
    if (!Number.isInteger(roundId)) {
      return res.status(400).json({ error: 'INVALID_ROUND_ID' });
    }

    const round = await roundRepo.getByIdAndGame({ id: roundId, gameId: game.id });
    if (!round) return res.status(404).json({ error: 'ROUND_NOT_FOUND' });
    round.categories = await roundRepo.getCategoriesOfRound(round.id);

    
    const cleanAnswers = (body.answers || []).map(a => ({
      categoryId: Number(a.categoryId),
      text: (a.text ?? "").trim()
    }));

    const validAnswers = cleanAnswers.filter(a =>
      Number.isInteger(a.categoryId) && a.categoryId > 0
    );

    if (validAnswers.length === 0) {
      return res.status(201).json({
        ok: true,
        inserted: 0,
        warning: "NO_VALID_CATEGORIES"
      });
    }

    // Guardar respuestas
    const result = await submissionRepo.saveAnswers({
      round,
      playerId: body.playerId,
      answers: validAnswers,
    });

    // Emit básico
    req.io.to(game.code).emit('answers:submitted', {
      roundId: round.id,
      playerId: body.playerId,
      count: result.inserted,
    });

    // ======================================================
    // 📌 Calcular progreso para anti-troll
    // ======================================================
    const totalPlayers = await roundRepo.countPlayersInGame(game.id);
    const submitted = await submissionRepo.countPlayersSubmitted(round.id);

    // Regla dinámica:
    // - 4 jugadores → 2 necesarios
    // - 8 jugadores → 4 necesarios
    // - 12+ jugadores → 4 necesarios
    const needed = Math.min(4, Math.ceil(totalPlayers / 2));

    console.log(
      `[ROUND CHECK] total=${totalPlayers}, enviados=${submitted}, necesarios=${needed}`
    );

    // Emitir progreso al frontend
    req.io.to(game.code).emit("round:progress", {
      submitted,
      needed,
      totalPlayers
    });

    // ======================================================
    // 📌 ¿Se debe cerrar la ronda?
    // ======================================================
    if (submitted >= needed) {

      // Finalizar ronda con puntuaciones elegantes
      const elegant = await submissionRepo.finalizeRound(round, game);

      const cleanTotals = elegant.map(p => ({
        id: p.id,
        name: p.name,
        total: p.total
      }));

      req.io.to(game.code).emit("round:ended", {
        roundId: round.id,
        scores: cleanTotals
      });

      // ¿Termina la partida?
      const endCheck = await gameService.checkGameEnd(game.id);

      if (endCheck.finished) {
        req.io.to(game.code).emit("game:finished", endCheck);
        return res.status(201).json({ ok: true, ...result });
      }

      // Crear la siguiente ronda
      const nextRound = await gameService.startRound({
        gameId: game.id,
        letter: null,
        durationSec: game.duration_sec ?? 60,
      });

      req.io.to(game.code).emit("round:started", {
        roundId: nextRound.id,
        letter: nextRound.letter,
        durationSec: nextRound.durationSec,
        secs: nextRound.secs,
        endsAt: nextRound.endsAt,
        roundNumber: nextRound.number,
        categories: nextRound.categories
      });
    }

    // Respuesta al cliente REST
    res.status(201).json({ ok: true, ...result });

  } catch (e) {
    console.error("❌ Error en answers:", e);
    next(e);
  }
});
