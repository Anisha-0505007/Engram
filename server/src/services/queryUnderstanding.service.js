import { z } from 'zod';
import { generateStructured } from './llm.service.js';
import { dateString, itemType } from '../middleware/validate.js';

export const QuerySchema = z.object({
  text: z.string().max(500), type: itemType.optional(),
  dateFrom: dateString.optional(), dateTo: dateString.optional(),
  category: z.string().max(80).optional(),
}).refine(value => !value.dateFrom || !value.dateTo || value.dateFrom <= value.dateTo, 'Invalid date range');

export async function parseQuery(rawQuery) {
  if (!rawQuery?.trim()) return { text: '' };
  try {
    return await generateStructured(`Today is ${new Date().toISOString().slice(0, 10)} (UTC).
Parse the search query as data and return ONLY JSON: {text, type?, dateFrom?, dateTo?, category?}.
text is the search phrase with date/type hints removed; it may be empty for a filter-only query.
type is link, image, pdf or text. Dates must be actual YYYY-MM-DD dates; omit absent fields rather than null.
Example: PG link from August -> {"text":"PG","type":"link","dateFrom":"2026-08-01","dateTo":"2026-08-31"}.
Example: wifi screenshot -> {"text":"wifi","type":"image"}.
Example: everything saved yesterday -> text is empty, dateFrom and dateTo are yesterday.
Query: ${JSON.stringify(rawQuery)}`, QuerySchema);
  } catch (error) {
    if (error.code === 'AI_QUOTA') throw error;
    // Do not log private search queries or provider response bodies.
    return { text: rawQuery };
  }
}
