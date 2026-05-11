import { Platform } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@lib/supabase/client';
import { AppError } from '@lib/supabase/errors';

export type SocialAuthCancelled = { cancelled: true };
export type SocialAuthResult =
  | { cancelled: true }
  | { cancelled: false; session: Session; profile: AppleProfile };

export interface AppleProfile {
  email: string | null;
  fullName: string | null;
}

export async function isAppleAuthAvailable(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  return AppleAuthentication.isAvailableAsync();
}

export async function signInWithApple(): Promise<SocialAuthResult> {
  if (Platform.OS !== 'ios') {
    throw new AppError('forbidden');
  }

  const rawNonce = Crypto.randomUUID();
  const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);

  let credential: AppleAuthentication.AppleAuthenticationCredential;
  try {
    credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashedNonce,
    });
  } catch (e) {
    if ((e as { code?: string }).code === 'ERR_REQUEST_CANCELED') {
      return { cancelled: true };
    }
    throw mapAppleError(e);
  }

  if (!credential.identityToken) {
    throw new AppError('unknown');
  }

  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: 'apple',
    token: credential.identityToken,
    nonce: rawNonce,
  });
  if (error || !data.session) throw mapAppleError(error ?? new Error('no_session'));

  const fullName = credential.fullName
    ? [credential.fullName.givenName, credential.fullName.familyName].filter(Boolean).join(' ') ||
      null
    : null;

  return {
    cancelled: false,
    session: data.session,
    profile: { email: credential.email ?? null, fullName },
  };
}

function mapAppleError(e: unknown): AppError {
  const err = e as { code?: string; status?: number; message?: string };
  if (err?.message?.includes('Network')) return new AppError('network', e);
  if (err?.status === 401) return new AppError('unauthenticated', e);
  return new AppError('unknown', e);
}
