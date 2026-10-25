import { z } from 'zod';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

// Zod schema validates the structured output from the LLM.
// All fields except `text` are optional — not every query has filters.
const QuerySchema = z.object({
  text: z.string(),
  type: z.enum(['link', 'image', 'pdf', 'text']).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  category: z.string().optional(),
});

/**
 * Builds a few-shot prompt that teaches the model exactly what JSON to return.
 * The current date is injected so the model can resolve relative terms ("last month").
 */
function buildPrompt(rawQuery) {
  const today = new Date().toISOString().slice(0, 10); // e.g. "2026-10-25"

  return `You are a search query parser. Today is ${today}.
Given a user's search query, return ONLY a single JSON object (no markdown, no explanation) with these fields:
- "text": the cleaned search term (remove filter words like type/date/category hints)
- "type": one of "link", "image", "pdf", "text" — only if the query implies a specific content type
- "dateFrom": ISO date string (YYYY-MM-DD) — only if a start date is implied
- "dateTo": ISO date string (YYYY-MM-DD) — only if an end date is implied
- "category": a topic category — only if strongly implied

Examples:
Query: "PG link from August"
{"text":"PG","type":"link","dateFrom":"2026-08-01","dateTo":"2026-08-31"}

Query: "wifi screenshot"
{"text":"wifi","type":"image"}

Query: "visa document PDF"
{"text":"visa","type":"pdf"}

Query: "finance notes from last week"
{"text":"finance notes","type":"text","dateFrom":"${getLastWeekStart()}","dateTo":"${getLastWeekEnd()}"}

Query: "machine learning article"
{"text":"machine learning","type":"link","category":"education"}

Query: "what did I save yesterday"
{"text":"","dateFrom":"${getYesterday()}","dateTo":"${getYesterday()}"}

Now parse this query and return ONLY the JSON object:
Query: "${rawQuery.replace(/"/g, "'")}"`
}

function getYesterday() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

function getLastWeekStart() {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString().slice(0, 10);
}

function getLastWeekEnd() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Strips markdown fences, parses JSON, validates with zod.
 * Throws if either step fails.
 */
function parseAndValidate(raw) {
  const cleaned = raw
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/,  '')
    .trim();

  const parsed = JSON.parse(cleaned);        // throws SyntaxError on bad JSON
  return QuerySchema.parse(parsed);          // throws ZodError if schema mismatch
}

/**
 * Given a raw user query, returns a ParsedQuery object.
 * On LLM failure or invalid JSON: one repair attempt, then plain-text fallback.
 *
 * @param {string} rawQuery
 * @returns {Promise<{text:string, type?:string, dateFrom?:string, dateTo?:string, category?:string}>}
 */
export async function parseQuery(rawQuery) {
  if (!rawQuery?.trim()) return { text: '' };

  try {
    const prompt = buildPrompt(rawQuery);
    const result = await model.generateContent(prompt);
    const raw    = result.response.text().trim();

    try {
      return parseAndValidate(raw);
    } catch {
      // One repair attempt: extract the first {...} block from the response
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) return parseAndValidate(match[0]);
      throw new Error('repair failed');
    }
  } catch (err) {
    // Graceful fallback: treat the whole query as a plain text search
    console.warn(`[queryUnderstanding] fallback for "${rawQuery}":`, err.message);
    return { text: rawQuery };
  }
}
