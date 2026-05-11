import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@lib/supabase/client';
import { toAppError } from '@lib/supabase/errors';
import type { SignInInput, SignUpInput } from '../schemas';

export function useSignIn() {
  return useMutation({
    mutationFn: async (input: SignInInput) => {
      const { data, error } = await supabase.auth.signInWithPassword(input);
      if (error) throw toAppError(error);
      return data.session;
    },
  });
}

export function useSignUp() {
  return useMutation({
    mutationFn: async (input: SignUpInput) => {
      const { data, error } = await supabase.auth.signUp(input);
      if (error) throw toAppError(error);
      return data.session;
    },
  });
}

export function useSignOut() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.auth.signOut();
      if (error) throw toAppError(error);
    },
    onSuccess: () => {
      qc.clear();
    },
  });
}
