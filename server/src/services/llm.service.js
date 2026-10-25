import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Single vision-capable model for OCR + structured enrichment
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
// Embedding model
const embeddingModel = genAI.getGenerativeModel({ model: 'text-embedding-004' });

/**
 * Enriches an item's text content using Gemini.
 * Returns structured JSON: { title, description, summary, category, tags }
 */
export async function enrichText(text) {
  const prompt = `You are a personal knowledge assistant. Analyze this content and return ONLY valid JSON with these fields:
{
  "title": "short descriptive title (max 10 words)",
  "description": "one sentence description",
  "summary": "2-3 sentence summary",
  "category": "one of: article, tool, video, document, note, recipe, shopping, travel, finance, health, education, social, other",
  "tags": ["array", "of", "3-6", "relevant", "lowercase", "tags"]
}

Content:
${text.slice(0, 4000)}`;

  const result = await model.generateContent(prompt);
  const raw = result.response.text().trim();

  // Strip markdown code fences if model wrapped the JSON
  const jsonStr = raw.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();

  try {
    return JSON.parse(jsonStr);
  } catch {
    // One repair attempt: extract JSON from response
    const match = jsonStr.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    // Fallback: return minimal structure
    return { title: 'Untitled', description: '', summary: '', category: 'other', tags: [] };
  }
}

/**
 * Generates an embedding vector for the given text.
 * Returns a number[] that can be stored in MongoDB for vector search.
 */
export async function embedText(text) {
  const result = await embeddingModel.embedContent(text.slice(0, 2000));
  return result.embedding.values;
}

/**
 * Uses Gemini vision to OCR an image and return structured enrichment.
 * @param {Buffer} imageBuffer
 * @param {string} mimeType e.g. 'image/jpeg'
 */
export async function enrichImage(imageBuffer, mimeType) {
  const prompt = `You are analyzing a screenshot or image. Return ONLY valid JSON:
{
  "extractedText": "all text visible in the image",
  "title": "short descriptive title",
  "description": "one sentence about what this image shows",
  "summary": "2-3 sentence summary",
  "category": "one of: article, tool, video, document, note, recipe, shopping, travel, finance, health, education, social, other",
  "tags": ["3-6", "relevant", "lowercase", "tags"]
}`;

  const imagePart = {
    inlineData: {
      data: imageBuffer.toString('base64'),
      mimeType,
    },
  };

  const result = await model.generateContent([prompt, imagePart]);
  const raw = result.response.text().trim();
  const jsonStr = raw.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();

  try {
    return JSON.parse(jsonStr);
  } catch {
    const match = jsonStr.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    return { extractedText: '', title: 'Image', description: '', summary: '', category: 'other', tags: [] };
  }
}
