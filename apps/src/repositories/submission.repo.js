// src/repositories/submission.repo.js
import { q, pool } from './db.js';
import { normalizeWord, startsWithLetter } from '../utils/text.js';
import * as roundRepo from '../repositories/round.repo.js';
import * as dictionaryRepo from '../repositories/dictionary.repo.js';

/* =======================================================
   INSERTAR SUBMISSION INDIVIDUAL
======================================================= */
export async function insertSubmission({
  roundId, playerId, categoryId,
  rawText, normalizedText,
  isValidLetter, isValidCategory,
  repetitionHash, status
}) {
  const rows = await q(
    `INSERT INTO submission
     (round_id, player_id, category_id, raw_text, normalized_text,
      is_valid_letter, is_valid_category, repetition_group_hash, status)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    [
      roundId, playerId, categoryId, rawText, normalizedText,
      isValidLetter ? 1 : 0,
      isValidCategory ? 1 : 0,
      repetitionHash,
      status
    ]
  );
  return rows;
}

/* =======================================================
   VERIFICAR SI CATEGORÍA EXISTE
======================================================= */
export async function categoryExists(categoryId) {
  const rows = await q(
    `SELECT id FROM category WHERE id=? AND enabled=1`,
    [categoryId]
  );
  return rows.length > 0;
}

/* =======================================================
   GETTERS BÁSICOS
======================================================= */
export async function getRoundById(id) {
  const rows = await q(`SELECT * FROM round WHERE id=?`, [id]);
  return rows[0] || null;
}

export async function getGameById(id) {
  const rows = await q(`SELECT * FROM game WHERE id=?`, [id]);
  return rows[0] || null;
}

/* =======================================================
   GUARDAR RESPUESTAS DEL JUGADOR — VALIDACIÓN COMPLETA
======================================================= */
export async function saveAnswers({ round, playerId, answers }) {

  if (!round) throw new Error("ROUND_NOT_FOUND");
  if (round.is_finished === 1) throw new Error("ROUND_ALREADY_FINISHED");

  // validación de tiempo
  const now = new Date();
  if (new Date(round.ends_at) <= now) {
    throw new Error("ROUND_TIME_EXPIRED");
  }

  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    // Borrar respuestas anteriores
    await conn.query(
      `DELETE FROM submission WHERE round_id = ? AND player_id = ?`,
      [round.id, playerId]
    );

    if (!answers || answers.length === 0) {
      await conn.commit();
      return { inserted: 0 };
    }

    const values = [];

    for (const a of answers) {
      const raw = (a.text || "").trim().slice(0, 80);
      const categoryId = Number(a.categoryId);

      // Validar categoría
      const validCat = await categoryExists(categoryId);

      // Normalizar palabra
      const norm = normalizeWord(raw);

      // Validar letra contra la ronda
      const okLetter = startsWithLetter(norm, round.letter);

      let status = "invalid";

      // Si letra y categoría están OK → validar diccionario
      if (okLetter && validCat && norm.length > 0) {

        // Obtener slug de la categoría desde el objeto round
        const category = round.categories.find(c => c.id === categoryId);

        if (category) {
          const exists = await dictionaryRepo.findWord(category.slug, norm);
          status = exists ? "valid" : "invalid";
        }
      }

      values.push([
        round.id,
        playerId,
        categoryId,
        raw,
        norm,
        okLetter ? 1 : 0,
        validCat ? 1 : 0,
        status
      ]);
    }

    // Inserción masiva
    if (values.length > 0) {
      await conn.query(
        `INSERT INTO submission
         (round_id, player_id, category_id, raw_text, normalized_text,
          is_valid_letter, is_valid_category, status)
         VALUES ?`,
        [values]
      );
    }

    await conn.commit();
    return { inserted: values.length };

  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/* =======================================================
   RESPUESTAS DE UNA RONDA
======================================================= */
export async function getSubmissionsOfRound(roundId) {
  return await q(
    `SELECT s.*, p.name, c.slug AS category_slug
       FROM submission s
       JOIN player p ON p.id = s.player_id
       JOIN category c ON c.id = s.category_id
      WHERE s.round_id = ?`,
    [roundId]
  );
}

/* =======================================================
   CUÁNTOS YA ENVIARON
======================================================= */
export async function countPlayersSubmitted(roundId) {
  const rows = await q(
    `SELECT COUNT(DISTINCT player_id) AS c
       FROM submission
      WHERE round_id = ?`,
    [roundId]
  );
  return rows[0]?.c ?? 0;
}

/* =======================================================
   🔥 FINALIZAR RONDA — con DICCIONARIO + REPETIDAS
======================================================= */
export async function finalizeRound(round, game) {

  const submissions = await getSubmissionsOfRound(round.id);

  const roundPoints = {};
  const players = {};

  // Agrupador para repetidas
  const repetidas = {};

  // 1) Agrupar por categoría y palabra
  for (const s of submissions) {
    const cat = s.category_slug;
    const txt = normalizeWord(s.raw_text);

    if (!repetidas[cat]) repetidas[cat] = {};
    if (!repetidas[cat][txt]) repetidas[cat][txt] = [];

    repetidas[cat][txt].push(s.player_id);
  }

  // 2) Calcular puntos
  for (const s of submissions) {
    const pid = s.player_id;

    if (!roundPoints[pid]) roundPoints[pid] = 0;
    players[pid] = s.name;

    const word = normalizeWord(s.raw_text);
    const letterOK = s.is_valid_letter === 1;
    const catOK = s.is_valid_category === 1;

    if (!word || !letterOK || !catOK) continue;

    // 3) Validación contra diccionario
    const exists = await dictionaryRepo.findWord(s.category_slug, word);
    if (!exists) continue;

    // 4) Repetidas
    const repList = repetidas[s.category_slug][word] || [];
    const repeated = repList.length > 1;

    if (repeated) {
      roundPoints[pid] += 50;
    } else {
      roundPoints[pid] += 100;
    }
  }

  // 5) Aplicar puntajes
  for (const pid in roundPoints) {
    await q(
      `UPDATE player
          SET score = COALESCE(score,0) + ?
        WHERE id = ?`,
      [roundPoints[pid], pid]
    );
  }

  // 6) Marcar ronda finalizada
  await roundRepo.markFinished(round.id);

  // 7) Totales
  const totals = await q(
    `SELECT id, name, score AS total
       FROM player
      WHERE game_id = ?`,
    [game.id]
  );

  return totals.map(p => ({
    id: p.id,
    name: p.name,
    roundPoints: roundPoints[p.id] ?? 0,
    total: Number(p.total) || 0
  }));
}
