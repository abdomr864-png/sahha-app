import { useCallback, useState } from 'react';
import { useSpotifyStore } from '../store';
import { connectSpotify, disconnectSpotify, isSpotifyConfigured } from '../services/connection';

/**
 * Connect / disconnect entry point for the prompt and settings screens.
 * `busy` covers the interactive round-trip (OAuth + product detect + remote
 * bind) so the calling button can show a spinner.
 */
export function useSpotifyConnect() {
  const status = useSpotifyStore((s) => s.status);
  const degradeReason = useSpotifyStore((s) => s.degradeReason);
  const product = useSpotifyStore((s) => s.product);
  const account = useSpotifyStore((s) => s.account);
  const [busy, setBusy] = useState(false);

  const connect = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      await connectSpotify();
    } finally {
      setBusy(false);
    }
  }, [busy]);

  const disconnect = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      await disconnectSpotify();
    } finally {
      setBusy(false);
    }
  }, [busy]);

  return {
    status,
    degradeReason,
    product,
    account,
    busy,
    isConnected: status === 'connected',
    isConfigured: isSpotifyConfigured(),
    connect,
    disconnect,
  };
}
