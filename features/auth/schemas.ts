import { z } from 'zod';

export const authSchemas = {
  signIn: z.object({
    email: z.string().email(),
    password: z.string().min(8),
  }),
  signUp: z.object({
    email: z.string().email(),
    password: z.string().min(8),
  }),
};

export type SignInInput = z.infer<typeof authSchemas.signIn>;
export type SignUpInput = z.infer<typeof authSchemas.signUp>;
