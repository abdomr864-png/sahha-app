import { useEffect, useState } from 'react';
import { Text, View, type LayoutChangeEvent } from 'react-native';
import { useTranslation } from 'react-i18next';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  cancelAnimation,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Icon } from '@features/shared';

const ACCENT = '#FF4D2E';
type GradientColors = readonly [string, string, ...string[]];

/**
 * Full-bleed "AI is analyzing" overlay that sits directly ON the meal photo.
 * The food stays visible underneath; a glowing beam sweeps the frame, corner
 * brackets lock on, and a compact HUD at the bottom of the image reports the
 * current stage + faux progress. The macro result renders below the photo.
 */
export function MealScanOverlay({ uploading }: { uploading: boolean }) {
  const { t } = useTranslation();
  const [height, setHeight] = useState(0);

  const STAGES = [
    t('ai.meal.stages.look', 'Looking at your plate…'),
    t('ai.meal.stages.identify', 'Identifying ingredients…'),
    t('ai.meal.stages.portions', 'Estimating portions…'),
    t('ai.meal.stages.macros', 'Crunching the macros…'),
  ];
  const [stageIdx, setStageIdx] = useState(0);
  const [percent, setPercent] = useState(0);

  useEffect(() => {
    setStageIdx(0);
    const id = setInterval(() => setStageIdx((i) => (i + 1) % STAGES.length), 1300);
    return () => clearInterval(id);
  }, [STAGES.length]);

  const scan = useSharedValue(0);
  const progress = useSharedValue(0);
  const corner = useSharedValue(0);
  const ring = useSharedValue(1);

  useDerivedValue(() => {
    runOnJS(setPercent)(Math.round(progress.value * 100));
  });

  useEffect(() => {
    progress.value = withTiming(0.96, { duration: 7000, easing: Easing.out(Easing.cubic) });
    scan.value = withRepeat(
      withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
    corner.value = withRepeat(
      withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.cubic) }),
      -1,
      true,
    );
    ring.value = withRepeat(
      withTiming(1.14, { duration: 1000, easing: Easing.inOut(Easing.cubic) }),
      -1,
      true,
    );
    return () => {
      cancelAnimation(progress);
      cancelAnimation(scan);
      cancelAnimation(corner);
      cancelAnimation(ring);
    };
  }, [progress, scan, corner, ring]);

  const BEAM = 3;
  const beamStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: scan.value * Math.max(0, height - BEAM) }],
    opacity: 0.5 + (1 - Math.abs(scan.value - 0.5) * 2) * 0.5,
  }));
  // Soft band that trails the beam, giving the sweep a glowing body.
  const bandStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: scan.value * Math.max(0, height - 120) }],
  }));
  const cornerStyle = useAnimatedStyle(() => ({
    opacity: 0.5 + corner.value * 0.5,
    transform: [{ scale: 0.97 + corner.value * 0.05 }],
  }));
  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: ring.value }],
    opacity: 1.3 - ring.value,
  }));

  const onLayout = (e: LayoutChangeEvent) => setHeight(e.nativeEvent.layout.height);

  return (
    <Animated.View
      entering={FadeIn.duration(240)}
      exiting={FadeOut.duration(180)}
      onLayout={onLayout}
      pointerEvents="none"
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden' }}
    >
      {/* Dim wash so the food stays readable but the HUD pops */}
      <LinearGradient
        colors={
          ['rgba(11,11,15,0.32)', 'rgba(11,11,15,0.12)', 'rgba(11,11,15,0.82)'] as GradientColors
        }
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />

      {/* Trailing glow band */}
      <Animated.View style={[{ position: 'absolute', left: 0, right: 0, height: 120 }, bandStyle]}>
        <LinearGradient
          colors={['rgba(255,77,46,0)', 'rgba(255,77,46,0.18)'] as GradientColors}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={{ flex: 1 }}
        />
      </Animated.View>

      {/* Sweeping scan beam */}
      <Animated.View style={[{ position: 'absolute', left: 0, right: 0, height: BEAM }, beamStyle]}>
        <LinearGradient
          colors={
            ['rgba(255,77,46,0)', 'rgba(255,138,43,0.95)', 'rgba(255,77,46,0)'] as GradientColors
          }
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={{ flex: 1 }}
        />
      </Animated.View>

      {/* Center lock-on reticle */}
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Animated.View
          style={[
            {
              position: 'absolute',
              width: 96,
              height: 96,
              borderRadius: 48,
              borderWidth: 1.5,
              borderColor: ACCENT,
            },
            ringStyle,
          ]}
        />
        <View
          style={{
            width: 56,
            height: 56,
            borderRadius: 28,
            backgroundColor: 'rgba(255,77,46,0.16)',
            borderWidth: 1,
            borderColor: 'rgba(255,77,46,0.6)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name="sparkles" size={24} color={ACCENT} />
        </View>
      </View>

      {/* Corner brackets framing the plate */}
      <Animated.View
        pointerEvents="none"
        style={[{ position: 'absolute', top: 14, left: 14, right: 14, bottom: 14 }, cornerStyle]}
      >
        {(['tl', 'tr', 'bl', 'br'] as const).map((p) => (
          <Bracket key={p} pos={p} />
        ))}
      </Animated.View>

      {/* Bottom HUD */}
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
          <View
            style={{
              width: 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: ACCENT,
              marginRight: 8,
            }}
          />
          <Text style={{ color: '#B4B4C2', fontSize: 10, fontWeight: '800', letterSpacing: 1.4 }}>
            {t('ai.meal.analyzeSub', 'AI VISION')}
          </Text>
          <View style={{ flex: 1 }} />
          <Text
            style={{
              color: ACCENT,
              fontSize: 12,
              fontWeight: '800',
              fontVariant: ['tabular-nums'],
            }}
          >
            {percent.toString().padStart(2, '0')}%
          </Text>
        </View>

        <Animated.Text
          key={stageIdx}
          entering={FadeIn.duration(260)}
          exiting={FadeOut.duration(140)}
          style={{ color: '#F4F4F7', fontSize: 17, fontWeight: '800' }}
        >
          {uploading ? t('ai.meal.uploading', 'Uploading photo…') : STAGES[stageIdx]}
        </Animated.Text>

        {/* Progress bar */}
        <View
          style={{
            marginTop: 12,
            height: 5,
            borderRadius: 999,
            backgroundColor: 'rgba(255,255,255,0.14)',
            overflow: 'hidden',
          }}
        >
          <View
            style={{
              height: '100%',
              borderRadius: 999,
              backgroundColor: ACCENT,
              width: `${percent}%`,
            }}
          />
        </View>
      </View>
    </Animated.View>
  );
}

function Bracket({ pos }: { pos: 'tl' | 'tr' | 'bl' | 'br' }) {
  const size = 26;
  const thick = 3;
  const common = {
    position: 'absolute' as const,
    width: size,
    height: size,
    borderColor: '#FF8A2B',
  };
  const map: Record<typeof pos, object> = {
    tl: { top: 0, left: 0, borderTopWidth: thick, borderLeftWidth: thick, borderTopLeftRadius: 8 },
    tr: {
      top: 0,
      right: 0,
      borderTopWidth: thick,
      borderRightWidth: thick,
      borderTopRightRadius: 8,
    },
    bl: {
      bottom: 0,
      left: 0,
      borderBottomWidth: thick,
      borderLeftWidth: thick,
      borderBottomLeftRadius: 8,
    },
    br: {
      bottom: 0,
      right: 0,
      borderBottomWidth: thick,
      borderRightWidth: thick,
      borderBottomRightRadius: 8,
    },
  };
  return <View style={[common, map[pos]]} />;
}
