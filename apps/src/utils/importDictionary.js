import fs from "fs";
import path from "path";
import { pool } from "../repositories/db.js";

async function importCategory(fileName) {
  const categorySlug = fileName.replace(".txt", "").toLowerCase();
  const filePath = path.join(process.cwd(), "src/dictionary", fileName);

  if (!fs.existsSync(filePath)) {
    console.log(`⚠ Archivo no encontrado: ${fileName}`);
    return;
  }

  const content = fs.readFileSync(filePath, "utf8");
  const words = content
    .split(/\r?\n/)
    .map(w => w.trim().toLowerCase())
    .filter(w => w.length > 0);

  console.log(`📘 Importando ${words.length} palabras para categoría: ${categorySlug}`);

  for (const word of words) {
    try {
      await pool.query(
        `INSERT IGNORE INTO dictionary (word, category_slug, locale, status)
         VALUES (?, ?, 'es', 'valid')`,
        [word, categorySlug]
      );
    } catch (err) {
      console.error(`❌ Error insertando palabra ${word}:`, err);
    }
  }

  console.log(`✅ Categoría ${categorySlug} importada correctamente.`);
}

async function main() {
  const folder = path.join(process.cwd(), "src/dictionary");
  const files = fs.readdirSync(folder).filter(f => f.endsWith(".txt"));

  for (const file of files) {
    await importCategory(file);
  }

  console.log("🎉 Diccionario importado con éxito.");
  process.exit();
}

main();
