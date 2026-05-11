/* eslint-disable @typescript-eslint/no-explicit-any --
 * The Google Sign-In SDK is loaded via require() so the JS bundle stays
 * valid in environments where the native module isn't linked (Expo Go,
 * web). We type as `any` and validate the fields we read at the call site. */

import Constants, { ExecutionEnvironment } from 'expo-constants';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@lib/supabase/client';
import { AppError } from '@lib/supabase/errors';

export interface GoogleProfile {
  email: string | null;
  fullName: string | null;
}

export type GoogleAuthResult =
  | { cancelled: true }
  | { cancelled: false; session: Session; profile: GoogleProfile };

type GS = any;

let cached: GS | null | undefined;
function loadGoogleSignin(): GS | null {
  if (cached !== undefined) return cached;
  // Skip the require entirely in Expo Go — the native module isn't linked there
  // and the resulting TurboModuleRegistry error gets surfaced by LogBox even when
  // we wrap the require in try/catch.
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) {
    cached = null;
    return cached;
  }
  try {
    cached = require('@react-native-google-signin/google-signin');
  } catch {
    cached = null;
  }
  return cached;
}

export function isGoogleSigninAvailable(): boolean {
  return loadGoogleSignin() !== null;
}

let configured = false;
function ensureConfigured(mod: GS) {
  if (configured) return;
  mod.GoogleSignin.configure({
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    offlineAccess: false,
  });
  configured = true;
}

export async function signInWithGoogle(): Promise<GoogleAuthResult> {
  const mod = loadGoogleSignin();
  if (!mod) {
    // Native module not linked — most likely running in Expo Go.
    throw new AppError('forbidden');
  }
  ensureConfigured(mod);
  const { GoogleSignin, statusCodes } = mod;

  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  } catch (e) {
    throw new AppError('unknown', e);
  }

  let result;
  try {
    result = await GoogleSignin.signIn();
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === statusCodes.SIGN_IN_CANCELLED || code === statusCodes.IN_PROGRESS) {
      return { cancelled: true };
    }
    throw mapGoogleError(e, statusCodes);
  }

  // v14 returns { type: 'success', data: { idToken, user, ... } }; older
  // versions return the data shape directly. Support both.
  const data =
    (
      result as {
        data?: { idToken?: string | null; user?: { email?: string; name?: string | null } };
      }
    ).data ??
    (result as unknown as {
      idToken?: string | null;
      user?: { email?: string; name?: string | null };
    });

  const idToken = data?.idToken ?? null;
  if (!idToken) throw new AppError('unknown');

  const { data: sb, error } = await supabase.auth.signInWithIdToken({
    provider: 'google',
    token: idToken,
  });
  if (error || !sb.session) throw mapGoogleError(error ?? new Error('no_session'), statusCodes);

  return {
    cancelled: false,
    session: sb.session,
    profile: {
      email: data?.user?.email ?? null,
      fullName: data?.user?.name ?? null,
    },
  };
}

export async function signOutGoogle(): Promise<void> {
  const mod = loadGoogleSignin();
  if (!mod) return;
  try {
    ensureConfigured(mod);
    await mod.GoogleSignin.signOut();
  } catch {
    // Best-effort — Supabase signOut is the source of truth.
  }
}

function mapGoogleError(e: unknown, statusCodes: GS): AppError {
  const err = e as { code?: string; status?: number; message?: string };
  if (err?.message?.includes('Network')) return new AppError('network', e);
  if (err?.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
    return new AppError('forbidden', e);
  }
  if (err?.status === 401) return new AppError('unauthenticated', e);
  return new AppError('unknown', e);
}
