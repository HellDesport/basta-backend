// apps/src/scripts/importDictionary.js
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { q } from "../repositories/db.js";
import { normalizeWord } from "../utils/text.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Mapea categoría → archivo TXT
const FILES = {
  nombre: "nombres.txt",
  apellido: "apellidos.txt",
  animal: "animales.txt",
  fruta: "frutas.txt",
  cosa: "cosa.txt",
  pais: "paises.txt",
};

// ENUM('approved','pending','rejected')
const DICTIONARY_STATUS = "approved";

// Verifica si ya existe en DB
async function existsInDB(word, categorySlug) {
  const rows = await q(
    `SELECT id FROM dictionary WHERE word = ? AND category_slug = ? LIMIT 1`,
    [word, categorySlug]
  );
  return rows.length > 0;
}

async function importCategory(categorySlug, filename) {
  const filePath = path.join(__dirname, "..", "dictionary", filename);

  console.log(`→ Importando ${categorySlug} desde ${filename}`);

  const raw = fs.readFileSync(filePath, "utf8");

  // Normaliza y limpia
  let lines = raw
    .split("\n")
    .map(x => normalizeWord(x.trim().toLowerCase()))
    .filter(x => x.length > 0);

  // Elimina duplicados dentro del archivo
  lines = [...new Set(lines)];

  console.log(`   ${lines.length} palabras después de limpiar duplicados.`);

  let inserted = 0;
  let skipped = 0;

  for (const word of lines) {
    // 1. Revisa si existe en DB
    const alreadyExists = await existsInDB(word, categorySlug);
    if (alreadyExists) {
      skipped++;
      continue;
    }

    // 2. Inserta si no existe
    try {
      await q(
        `INSERT INTO dictionary (word, category_slug, locale, status)
         VALUES (?, ?, 'es', ?)`,
        [word, categorySlug, DICTIONARY_STATUS]
      );
      inserted++;
    } catch (err) {
      console.log("Error insertando:", word, err.message);
    }
  }

  console.log(`   OK → Insertadas: ${inserted}, Omitidas por duplicado: ${skipped}`);
}

async function main() {
  console.log("============ Importando Diccionarios ============");

  for (const slug in FILES) {
    const file = FILES[slug];
    await importCategory(slug, file);
  }

  console.log("============ FINALIZADO ============");
  process.exit(0);
}

main();
