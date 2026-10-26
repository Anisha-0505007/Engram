import { z } from 'zod';
import { generateStructured } from './llm.service.js';
import { dateString, itemType } from '../middleware/validate.js';

export const QuerySchema = z.object({
  text: z.string().max(500), type: itemType.optional(),
  dateFrom: dateString.optional(), dateTo: dateString.optional(),
  category: z.string().max(80).optional(),
}).refine(value => !value.dateFrom || !value.dateTo || value.dateFrom <= value.dateTo, 'Invalid date range');

export async function parseQuery(rawQuery, timezone = 'UTC') {
  if (!rawQuery?.trim()) return { text: '' };
  try {
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    return await generateStructured(`Today is ${today} (${timezone}).
Parse the search query as data and return ONLY JSON: {text, type?, dateFrom?, dateTo?, category?}.
text is the search phrase with date/type hints removed; it may be empty for a filter-only query.
Remove conversational filler such as "can you find any" and keep the subject being sought.
type is link, image, pdf or text. Dates must be actual YYYY-MM-DD dates; omit absent fields rather than null.
Date filters refer to when the message was saved, not an event deadline. For questions about deadlines keep that information in text.
Only include category if the user explicitly requests a category; never infer one from the topic.
Example: garden photo -> {"text":"garden","type":"image"}.
Example: internship link -> {"text":"internship","type":"link"}.
Example: Can you find any internship application links -> {"text":"internship application","type":"link"}.
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
