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

    // ============================================================
    // 🔥 VALIDACIÓN ANTI-TROLL / ANTI-TRAMPOSOS
    // ============================================================
    const cleanAnswers = (body.answers || []).map(a => ({
      categoryId: Number(a.categoryId),
      text: (a.text ?? "").trim()
    }));

    // respuestas válidas (texto con mínimo 2 caracteres)
    const validAnswers = cleanAnswers.filter(a =>
      Number.isInteger(a.categoryId) &&
      a.categoryId > 0 &&
      a.text.length >= 2
    );

    const totalCats = round.categories.length;
    const required = Math.ceil(totalCats / 2); // mínimo mitad (6 → 3)

    // Este jugador cuenta como "submitted" solo si cumple el mínimo
    const countsAsSubmitted = validAnswers.length >= required;

    if (!countsAsSubmitted) {
      console.log(
        `Jugador ${body.playerId} NO cumple mínimo (${validAnswers.length}/${required}), NO cuenta como enviado.`
      );
    }

    // Aunque no cuente como enviado, SÍ guardamos lo que haya escrito
    const result = await submissionRepo.saveAnswers({
      round,
      playerId: body.playerId,
      answers: validAnswers,
    });

    // Avisar que este jugador mandó algo (aunque no cumpla el mínimo)
    req.io.to(game.code).emit("answers:submitted", {
      roundId: round.id,
      playerId: body.playerId,
      count: result.inserted,
      valid: countsAsSubmitted
    });

    // ======================================================
    // 📌 Calcular progreso anti-troll REAL
    // ======================================================
    let submitted = await submissionRepo.countPlayersSubmitted(round.id);

    // Si este jugador sí cumple el mínimo → contarlo manualmente
    if (countsAsSubmitted) submitted++;

    const totalPlayers = await roundRepo.countPlayersInGame(game.id);
    const needed = Math.min(4, Math.ceil(totalPlayers / 2));

    console.log(
      `[ROUND CHECK] total=${totalPlayers}, enviados_validos=${submitted}, necesarios=${needed}`
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

      // Pre-check para evitar duplicados
      const latestState = await roundRepo.getRoundState(round.id);
      if (latestState?.is_finished) {
        console.warn(`[ROUND FINALIZE] ronda ${round.id} ya estaba finished (pre-check).`);
        return res.status(201).json({ ok: true, ...result });
      }

      let elegant;

      try {
        elegant = await submissionRepo.finalizeRound(round, game);
      } catch (err) {
        console.error("[ROUND FINALIZE] error en finalizeRound:", err);

        // Post-check por si otra petición ya la cerró
        const afterState = await roundRepo.getRoundState(round.id);
        if (afterState?.is_finished) {
          console.warn(`[ROUND FINALIZE] ronda ${round.id} ya terminó (post-error).`);
          return res.status(201).json({ ok: true, ...result });
        }

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

      // Nueva ronda
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

    // ======================================================
    // Respuesta REST
    // ======================================================
    res.status(201).json({ ok: true, ...result });

  } catch (e) {
    console.error("❌ Error en answers:", e);
    next(e);
  }
});
