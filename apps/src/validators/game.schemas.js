// src/validators/game.schemas.js
import { z } from "zod";

/* =======================================================
   CREAR JUEGO
======================================================= */
export const CreateGameSchema = z.object({
  hostName: z.string().min(2).max(64),

  // Duración por ronda (15–300 seg)
  durationSec: z.preprocess(
    (v) => Number(v),
    z.number().int().min(15).max(300)
  ).default(60),

  // Categorías opcionales
  categories: z.array(z.string()).optional(),

  // Límite de puntos (opcional pero con rango válido)
  pointLimit: z.preprocess(
    (v) => Number(v),
    z.number().int().min(100).max(5000)
  ).default(1500),

  // Límite de rondas (opcional pero con rango válido)
  roundLimit: z.preprocess(
    (v) => Number(v),
    z.number().int().min(1).max(20)
  ).default(7)
});

/* =======================================================
   JOIN
======================================================= */
export const JoinSchema = z.object({
  name: z.string().min(2).max(64)
});

/* =======================================================
   INICIAR RONDA MANUAL
======================================================= */
export const StartRoundSchema = z.object({

  // Puede ser letra vacía → el backend usa randomLetter()
  letter: z
    .string()
    .trim()
    .length(1)
    .optional(),

  // duración opcional, mismo rango que createGame
  durationSec: z.preprocess(
    (v) => Number(v),
    z.number().int().min(15).max(300)
  ).optional()
});
