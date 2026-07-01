import { useQuery } from '@tanstack/react-query';
import { useSpotifyStore } from '../store';
import { fetchUserPlaylists } from '../repositories/webApi';

/**
 * The connected user's playlists, for the picker. Only runs once connected;
 * the access token is refreshed transparently by the Web API layer.
 */
export function useSpotifyPlaylists() {
  const status = useSpotifyStore((s) => s.status);
  return useQuery({
    queryKey: ['spotify', 'playlists'],
    enabled: status === 'connected',
    queryFn: () => fetchUserPlaylists(),
    staleTime: 5 * 60_000,
  });
}
