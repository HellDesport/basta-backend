// src/repositories/dictionary.repo.js
import { q } from "./db.js";
import { normalizeWord } from "../utils/text.js";

export async function findWord(categorySlug, rawWord) {
  const word = normalizeWord(rawWord);

  const rows = await q(
    `SELECT id
       FROM dictionary
      WHERE category_slug = ?
        AND word = ?
        AND status = 'approved'
      LIMIT 1`,
    [categorySlug, word]
  );

  return rows[0] || null;
}