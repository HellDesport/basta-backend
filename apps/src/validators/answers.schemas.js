// src/validators/answers.schemas.js
import { z } from 'zod';

export const SubmitAnswersSchema = z.object({
  playerId: z.number().int().positive(),

  answers: z.array(
    z.object({
      categoryId: z.number().int().positive(),

      // ahora permite texto vacío: ""
      text: z.string().max(80).default("")
    })
  )
});