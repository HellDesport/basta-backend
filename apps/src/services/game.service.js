// src/services/game.service.js
import dayjs from "dayjs";
import { makeRoomCode } from "../utils/code.js";
import * as gameRepo from "../repositories/game.repo.js";
import * as catRepo from "../repositories/category.repo.js";
import * as roundRepo from "../repositories/round.repo.js";

/* =======================================================
   CREAR JUEGO CON HOST
======================================================= */
export async function createGameWithHost({
  hostName,
  categories = null,
  durationSec = 60,
  pointLimit = 1500,
  roundLimit = 7
}) {
  const code = makeRoomCode();

  const game = await gameRepo.createGame({
    code,
    pointLimit,
    roundLimit
  });

  const host = await gameRepo.addPlayer(game.id, hostName, true);

  const cats = await catRepo.getDefaults();
  await catRepo.attachToGame(game.id, cats.map(c => c.id));

  const players = await gameRepo.listPlayers(game.id);

  return {
    ok: true,
    game: {
      id: game.id,
      code: game.code,
      status: game.status,
      locked: Boolean(game.locked),
      hostId: host.id,
      pointLimit: game.point_limit,
      roundLimit: game.round_limit,
      durationSec: Number(durationSec),
      currentRound: game.current_round ?? 0
    },
    players,
    host,
    categories: cats
  };
}

/* =======================================================
   CREAR RONDA — LETRAS NO REPETIDAS (PARCHADO)
======================================================= */
export async function startRound({ gameId, letter, durationSec = 60 }) {
  const dSec = Number(durationSec) || 60;

  // ======================================================
  // OBTENER LETRAS YA USADAS EN LA PARTIDA (método real)
  // ======================================================
  let usedLetters = [];
  try {
    usedLetters = await roundRepo.getUsedLetters(gameId);
  } catch (err) {
    usedLetters = [];
  }

  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
  let available = alphabet.filter(l => !usedLetters.includes(l));

  if (available.length === 0) {
    available = alphabet;
  }

  const L = letter
    ? letter.toUpperCase()
    : available[Math.floor(Math.random() * available.length)];

  // ======================================================
  // Fechas
  // ======================================================
  const startsAt = dayjs().toDate();
  const endsAt = dayjs(startsAt).add(dSec, "second").toDate();

  // Crear ronda en DB
  const round = await roundRepo.createRound({
    gameId,
    letter: L,
    startsAt,
    endsAt,
    durationSec: dSec
  });

  await gameRepo.incrementRoundNumber(gameId);

  const roundNumber = await roundRepo.countRounds(gameId);
  const categories = await catRepo.listByGame(gameId);

  return {
    id: round.id,
    letter: round.letter,
    secs: Number(round.duration_sec),
    durationSec: Number(round.duration_sec),
    endsAt: new Date(round.ends_at).toISOString(),
    number: roundNumber,
    categories,
    roundNumber
  };
}

/* =======================================================
   FIN DE PARTIDA
======================================================= */
export async function checkGameEnd(gameId) {
  const game = await gameRepo.getGameById(gameId);

  const roundsPlayed = await roundRepo.countRounds(gameId);
  const scores = await gameRepo.getScores(game.id);

  const normalizeWinner = (p) =>
    p ? { id: p.id, name: p.name, total: Number(p.total) || 0 } : null;

  if (game.round_limit && roundsPlayed >= game.round_limit) {
    return {
      finished: true,
      reason: "round_limit",
      winner: normalizeWinner(scores[0]),
      roundsPlayed
    };
  }

  if (game.point_limit) {
    const winner = scores.find(p => Number(p.total) >= game.point_limit);
    if (winner) {
      return {
        finished: true,
        reason: "point_limit",
        winner: normalizeWinner(winner),
        roundsPlayed
      };
    }
  }

  return { finished: false, roundsPlayed };
}

/* =======================================================
   UNIRSE A UN JUEGO
======================================================= */
export async function joinGame({ gameCode, playerName }) {
  const code = gameCode.toUpperCase();

  const game = await gameRepo.getGameByCode(code);
  if (!game) return { ok: false, error: "GAME_NOT_FOUND" };

  const player = await gameRepo.addPlayer(game.id, playerName, false);
  const players = await gameRepo.listPlayers(game.id);

  const host = players.find(p => p.is_host === 1);

  return {
    ok: true,
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
    player,
    players
  };
}
 