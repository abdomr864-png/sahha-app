// Re-export zod for Deno edge functions. Centralizing the import URL makes
// version bumps a single-file change.
export { z, ZodError } from 'https://esm.sh/zod@3.23.8';
export type { ZodType, ZodTypeAny, ZodIssue } from 'https://esm.sh/zod@3.23.8';
