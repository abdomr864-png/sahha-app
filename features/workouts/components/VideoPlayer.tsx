// Video player wrapper for exercise demos.
//
// Uses `expo-video` when its native module is available (release builds + dev
// clients with the package installed). Falls back to a static "Demo coming soon"
// poster when the module is missing — this keeps the screen renderable in
// environments where the dep hasn't been added yet (FUTURE.md).

import type { ComponentType } from 'react';
import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Icon } from '@features/shared';

type LazyVideoModule = {
  useVideoPlayer: (src: string, init?: (p: { loop: boolean; muted: boolean }) => void) => unknown;
  VideoView: ComponentType<{
    player: unknown;
    style?: object;
    nativeControls?: boolean;
    contentFit?: string;
  }>;
};

let videoModule: LazyVideoModule | null = null;
try {
  videoModule = require('expo-video') as LazyVideoModule;
} catch {
  videoModule = null;
}

interface Props {
  videoUrl: string | null;
  photoUrl: string | null;
  height?: number;
}

export function VideoPlayer({ videoUrl, height = 220 }: Props) {
  if (!videoUrl || !videoModule) {
    return <Placeholder height={height} />;
  }
  return <PlayerInner videoUrl={videoUrl} height={height} module={videoModule} />;
}

function PlayerInner({
  videoUrl,
  height,
  module: mod,
}: {
  videoUrl: string;
  height: number;
  module: LazyVideoModule;
}) {
  // Hooks ARE conditional on the module being present — this component
  // is only mounted in that branch, so the rule-of-hooks contract holds.
  const player = mod.useVideoPlayer(videoUrl, (p) => {
    p.loop = true;
    p.muted = true;
  });
  const VideoView = mod.VideoView;
  return (
    <View
      className="rounded-3xl overflow-hidden bg-bg-raised border border-border"
      style={{ height }}
    >
      <VideoView player={player} style={{ flex: 1 }} nativeControls contentFit="cover" />
    </View>
  );
}

function Placeholder({ height }: { height: number }) {
  const { t } = useTranslation();
  return (
    <View
      className="rounded-3xl bg-bg-raised border border-border items-center justify-center"
      style={{ height }}
    >
      <View className="w-14 h-14 rounded-2xl bg-accent/10 border border-accent/30 items-center justify-center mb-2">
        <Icon name="play" size={20} color="#FF4D2E" />
      </View>
      <Text className="text-ink-subtle text-sm font-semibold">{t('exercise.demoSoon')}</Text>
    </View>
  );
}
