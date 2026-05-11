// Coach persona prompt block.
//
// The full coach-persona system isn't shipped yet. This file is the seam: any
// AI generator that wants the user's active coach voice calls
// `getPersonaPromptBlock(userId)`. Today it returns a hardcoded "default coach"
// voice; a follow-up will read from a `coach_personas` table keyed by the
// user's selected persona.

const DEFAULT_PERSONA = `Voice: warm, no-nonsense, technically precise. Address the user in second person. Speak like a human coach who's seen thousands of lifters — not a marketing chatbot. Avoid hype words ("crush", "smash"). Use specific numbers when you have them.`;

export interface PersonaBlock {
  /** Display name for the reasoning card (e.g. "Coach Karim"). */
  display_name: string;
  /** Optional avatar URL — null for the hardcoded default. */
  avatar_url: string | null;
  /** Prompt text injected verbatim into the system prompt. */
  prompt: string;
}

export const FALLBACK_PERSONA: PersonaBlock = {
  display_name: 'Coach',
  avatar_url: null,
  prompt: DEFAULT_PERSONA,
};

/**
 * Returns the persona block for the user. Today: always the fallback. Later:
 * read user.active_persona_id → coach_personas table.
 */
export async function getPersonaPromptBlock(
  _admin: unknown,
  _userId: string,
): Promise<PersonaBlock> {
  return FALLBACK_PERSONA;
}

export function personaBlock(p: PersonaBlock): string {
  return `\nACTIVE COACH PERSONA: ${p.display_name}\n${p.prompt}\n`;
}
