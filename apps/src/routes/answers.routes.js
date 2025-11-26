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

    // Guardar respuestas del jugador
    const result = await submissionRepo.saveAnswers({
      round,
      playerId: body.playerId,
      answers: validAnswers,
    });

    // Avisar que este jugador ya envió
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

    const needed = Math.min(4, Math.ceil(totalPlayers / 2));

    console.log(
      `[ROUND CHECK] total=${totalPlayers}, enviados=${submitted}, necesarios=${needed}`
    );

    req.io.to(game.code).emit("round:progress", {
      submitted,
      needed,
      totalPlayers
    });

    // ======================================================
    // 📌 ¿Se debe cerrar la ronda?
    // ======================================================
    if (submitted >= needed) {

      // Antes de nada, ver estado real de la ronda
      const latestState = await roundRepo.getRoundState(round.id);
      if (latestState?.is_finished) {
        console.warn(`[ROUND FINALIZE] ronda ${round.id} ya estaba finished (pre-check), se ignora cierre duplicado`);
        return res.status(201).json({ ok: true, ...result });
      }

      let elegant;

      try {
        // Puede pisarse entre varios jugadores, por eso el catch de abajo
        elegant = await submissionRepo.finalizeRound(round, game);
      } catch (err) {
        console.error("[ROUND FINALIZE] error en finalizeRound:", err);

        // Releer estado por si otra petición ya la finalizó justo antes del throw
        const afterState = await roundRepo.getRoundState(round.id);
        if (afterState?.is_finished) {
          console.warn(`[ROUND FINALIZE] ronda ${round.id} ya está finished (post-error), se considera cierre exitoso`);
          return res.status(201).json({ ok: true, ...result });
        }

        // Si sigue sin marcarse como finished, entonces sí dejamos que el error suba
        throw err;
      }

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
