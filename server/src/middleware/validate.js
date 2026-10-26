import { z } from 'zod';

export const itemType = z.enum(['link', 'image', 'pdf', 'text']);
export const dateString = z.iso.date();
export const searchSchema = z.object({
  q: z.string().trim().max(500).default(''),
  type: z.union([itemType, z.literal('')]).optional(),
  dateFrom: dateString.optional(), dateTo: dateString.optional(),
  timezone: z.enum(['UTC', 'Asia/Kolkata']).default('UTC'),
  category: z.string().trim().max(80).optional(),
  section: z.enum(['all', 'links', 'upcoming', 'photos', 'bookmarks', 'confidential']).default('all'),
  mode: z.enum(['keyword', 'vector', 'hybrid']).default('hybrid'),
});
export const listSchema = searchSchema.omit({ q: true }).extend({
  q: z.string().trim().max(500).optional(),
  status: z.enum(['pending', 'processing', 'done', 'failed']).optional(),
  cursor: z.string().max(250).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export const credentials = z.object({
  email: z.email().trim().toLowerCase().max(254),
  // bcrypt uses at most 72 bytes; reject rather than silently truncate passwords.
  password: z.string().min(8).refine(value => Buffer.byteLength(value) <= 72, 'Password must be at most 72 bytes'),
});
export const edits = z.object({
  title: z.string().trim().min(1).max(160).nullable().optional(),
  category: z.string().trim().max(80),
  tags: z.array(z.string().trim().min(1).max(40)).max(20),
});
export function validate(schema, source = 'body') {
  return (req, res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) return res.status(400).json({ error: result.error.issues[0].message });
    req.validated = result.data;
    next();
  };
}
export function validateId(req, res, next) {
  if (!z.string().regex(/^[a-f\d]{24}$/i).safeParse(req.params.id).success) {
    return res.status(400).json({ error: 'Invalid item ID' });
  }
  next();
}
