import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Path, Stop } from 'react-native-svg';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  cancelAnimation,
  useAnimatedProps,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Icon } from './Icon';
import type { IconName } from './Icon';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedPath = Animated.createAnimatedComponent(Path);

type GradientColors = readonly [string, string, ...string[]];

export type AnalyzingScopeProps = {
  /** Icon shown breathing in the center of the scope. */
  icon?: IconName;
  /** Primary accent (rings, beam tip, progress). */
  accent?: string;
  /** Softer accent used for the gradient highlights. */
  accentSoft?: string;
  /** Cycling status lines (e.g. "Detecting…" → "Identifying…"). */
  stages: string[];
  /** Small uppercase caption under the status line. */
  sublabel: string;
  /** Bottom-left label next to the percentage (default "SCANNING"). */
  footLabel?: string;
  /** How long each status line stays up. */
  stageIntervalMs?: number;
  /** How long the faux progress takes to reach ~96%. */
  durationMs?: number;
};

/**
 * Shared, themeable "AI is analyzing…" scope. A radar/scope visual stack with a
 * cycling status HUD, designed to fill a screen body (drop it inside
 * `<Screen padded={false}>`). Animations run while mounted and cancel on unmount,
 * so render it only during the loading window.
 *
 * Animation stack (back → front):
 *  - Soft radial glow + grid dot backdrop
 *  - Sweeping radar beam rotating around the center
 *  - Three sonar pulse rings (staggered)
 *  - Pulsing inner gradient ring
 *  - Rotating reticle ring with four tick marks + counter-rotating tick dots
 *  - Two orbital particle rings rotating in opposite directions
 *  - Four pulsing corner brackets around the icon
 *  - Center icon with breathing scale + accent glow
 *
 * Bottom HUD: cycling status text · shimmer progress bar · faux percentage · stage dots.
 */
export function AnalyzingScope({
  icon = 'sparkles',
  accent = '#FF4D2E',
  accentSoft = '#FF8A2B',
  stages,
  sublabel,
  footLabel = 'SCANNING',
  stageIntervalMs = 1400,
  durationMs = 6000,
}: AnalyzingScopeProps) {
  const safeStages = stages.length > 0 ? stages : ['…'];
  const [stageIdx, setStageIdx] = useState(0);
  const [percent, setPercent] = useState(0);

  // Cycle the status text.
  useEffect(() => {
    setStageIdx(0);
    const id = setInterval(() => {
      setStageIdx((i) => (i + 1) % safeStages.length);
    }, stageIntervalMs);
    return () => clearInterval(id);
  }, [safeStages.length, stageIntervalMs]);

  // Faux percentage that smoothly climbs to ~96%, then idles.
  const progress = useSharedValue(0);
  useDerivedValue(() => {
    runOnJS(setPercent)(Math.round(progress.value * 100));
  });

  // Shared animation values.
  const rotateOuter = useSharedValue(0);
  const rotateInner = useSharedValue(0);
  const rotateBeam = useSharedValue(0);
  const rotateOrbitA = useSharedValue(0);
  const rotateOrbitB = useSharedValue(0);
  const innerPulse = useSharedValue(1);
  const iconScale = useSharedValue(1);
  const cornerPulse = useSharedValue(0);
  const pulseA = useSharedValue(0);
  const pulseB = useSharedValue(0);
  const pulseC = useSharedValue(0);
  const shimmerX = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(0.96, { duration: durationMs, easing: Easing.out(Easing.cubic) });

    rotateOuter.value = withRepeat(
      withTiming(360, { duration: 7000, easing: Easing.linear }),
      -1,
      false,
    );
    rotateInner.value = withRepeat(
      withTiming(-360, { duration: 9500, easing: Easing.linear }),
      -1,
      false,
    );
    rotateBeam.value = withRepeat(
      withTiming(360, { duration: 2200, easing: Easing.linear }),
      -1,
      false,
    );
    rotateOrbitA.value = withRepeat(
      withTiming(360, { duration: 4800, easing: Easing.linear }),
      -1,
      false,
    );
    rotateOrbitB.value = withRepeat(
      withTiming(-360, { duration: 6400, easing: Easing.linear }),
      -1,
      false,
    );
    innerPulse.value = withRepeat(
      withTiming(1.12, { duration: 1100, easing: Easing.inOut(Easing.cubic) }),
      -1,
      true,
    );
    iconScale.value = withRepeat(
      withTiming(1.08, { duration: 900, easing: Easing.inOut(Easing.cubic) }),
      -1,
      true,
    );
    cornerPulse.value = withRepeat(
      withTiming(1, { duration: 1300, easing: Easing.inOut(Easing.cubic) }),
      -1,
      true,
    );
    shimmerX.value = withRepeat(
      withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.cubic) }),
      -1,
      false,
    );
    const pulseCycle = { duration: 1900, easing: Easing.out(Easing.cubic) };
    pulseA.value = withRepeat(withTiming(1, pulseCycle), -1, false);
    pulseB.value = withDelay(500, withRepeat(withTiming(1, pulseCycle), -1, false));
    pulseC.value = withDelay(1000, withRepeat(withTiming(1, pulseCycle), -1, false));

    return () => {
      cancelAnimation(progress);
      cancelAnimation(rotateOuter);
      cancelAnimation(rotateInner);
      cancelAnimation(rotateBeam);
      cancelAnimation(rotateOrbitA);
      cancelAnimation(rotateOrbitB);
      cancelAnimation(innerPulse);
      cancelAnimation(iconScale);
      cancelAnimation(cornerPulse);
      cancelAnimation(shimmerX);
      cancelAnimation(pulseA);
      cancelAnimation(pulseB);
      cancelAnimation(pulseC);
    };
  }, [
    durationMs,
    progress,
    rotateOuter,
    rotateInner,
    rotateBeam,
    rotateOrbitA,
    rotateOrbitB,
    innerPulse,
    iconScale,
    cornerPulse,
    shimmerX,
    pulseA,
    pulseB,
    pulseC,
  ]);

  const SIZE = 280;
  const CENTER = SIZE / 2;
  const INNER_RING_R = 64;
  const RETICLE_R = 104;
  const ORBIT_A_R = 132;
  const ORBIT_B_R = 116;
  const MAX_PULSE_R = 124;

  const outerStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotateOuter.value}deg` }],
  }));
  const innerStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotateInner.value}deg` }],
  }));
  const beamStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotateBeam.value}deg` }],
  }));
  const orbitAStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotateOrbitA.value}deg` }],
  }));
  const orbitBStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotateOrbitB.value}deg` }],
  }));
  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: iconScale.value }],
  }));
  const cornerStyle = useAnimatedStyle(() => ({
    opacity: 0.55 + cornerPulse.value * 0.45,
    transform: [{ scale: 0.96 + cornerPulse.value * 0.06 }],
  }));
  const innerRingProps = useAnimatedProps(() => ({
    r: INNER_RING_R * innerPulse.value,
    opacity: 1 - (innerPulse.value - 1) * 4,
  }));
  const pulseAProps = useAnimatedProps(() => ({
    r: INNER_RING_R + (MAX_PULSE_R - INNER_RING_R) * pulseA.value,
    opacity: 0.6 * (1 - pulseA.value),
    strokeWidth: 2,
  }));
  const pulseBProps = useAnimatedProps(() => ({
    r: INNER_RING_R + (MAX_PULSE_R - INNER_RING_R) * pulseB.value,
    opacity: 0.6 * (1 - pulseB.value),
    strokeWidth: 2,
  }));
  const pulseCProps = useAnimatedProps(() => ({
    r: INNER_RING_R + (MAX_PULSE_R - INNER_RING_R) * pulseC.value,
    opacity: 0.6 * (1 - pulseC.value),
    strokeWidth: 2,
  }));
  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -120 + shimmerX.value * 360 }],
  }));

  // Build the radar beam as a wedge with a fading gradient. The wedge sweeps the
  // whole circle as the wrapper rotates.
  const beamArc = describeArc(CENTER, CENTER, INNER_RING_R - 2, RETICLE_R + 14, -50, 0);

  return (
    <Animated.View
      entering={FadeIn.duration(220)}
      exiting={FadeOut.duration(180)}
      style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
    >
      {/* Backdrop */}
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(11,11,15,0.94)',
        }}
      />
      <LinearGradient
        pointerEvents="none"
        colors={
          [
            withAlpha(accent, 0.1),
            'rgba(11,11,15,0.0)',
            'rgba(11,11,15,0.92)',
          ] as unknown as GradientColors
        }
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />
      {/* Grid dot pattern */}
      <GridDots count={28} />

      {/* Central scope */}
      <View style={{ width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' }}>
        {/* Sweeping radar beam */}
        <Animated.View style={[{ position: 'absolute', width: SIZE, height: SIZE }, beamStyle]}>
          <Svg width={SIZE} height={SIZE}>
            <Defs>
              <SvgGradient id="scopeBeamGrad" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor={accent} stopOpacity="0" />
                <Stop offset="0.6" stopColor={accentSoft} stopOpacity="0.18" />
                <Stop offset="1" stopColor={accent} stopOpacity="0.55" />
              </SvgGradient>
            </Defs>
            <AnimatedPath d={beamArc} fill="url(#scopeBeamGrad)" />
          </Svg>
        </Animated.View>

        {/* Base ring + sonar pulses */}
        <Svg width={SIZE} height={SIZE} style={{ position: 'absolute' }}>
          <Defs>
            <SvgGradient id="scopeRingGrad" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={accentSoft} />
              <Stop offset="1" stopColor={accent} />
            </SvgGradient>
          </Defs>
          <Circle
            cx={CENTER}
            cy={CENTER}
            r={INNER_RING_R}
            stroke="#21212B"
            strokeWidth={1.5}
            fill="none"
          />
          <AnimatedCircle
            cx={CENTER}
            cy={CENTER}
            stroke={accent}
            fill="none"
            animatedProps={pulseAProps}
          />
          <AnimatedCircle
            cx={CENTER}
            cy={CENTER}
            stroke={accent}
            fill="none"
            animatedProps={pulseBProps}
          />
          <AnimatedCircle
            cx={CENTER}
            cy={CENTER}
            stroke={accent}
            fill="none"
            animatedProps={pulseCProps}
          />
          <AnimatedCircle
            cx={CENTER}
            cy={CENTER}
            stroke="url(#scopeRingGrad)"
            strokeWidth={2.5}
            fill="none"
            animatedProps={innerRingProps}
          />
        </Svg>

        {/* Rotating reticle ring with tick arcs (CW) */}
        <Animated.View style={[{ position: 'absolute', width: SIZE, height: SIZE }, outerStyle]}>
          <Svg width={SIZE} height={SIZE}>
            <Circle
              cx={CENTER}
              cy={CENTER}
              r={RETICLE_R}
              stroke="#34343F"
              strokeWidth={1}
              strokeDasharray="2 6"
              fill="none"
            />
            {[0, 90, 180, 270].map((deg) => {
              const c = 2 * Math.PI * RETICLE_R;
              return (
                <Circle
                  key={deg}
                  cx={CENTER}
                  cy={CENTER}
                  r={RETICLE_R}
                  stroke={accent}
                  strokeWidth={3}
                  fill="none"
                  strokeDasharray={`${c * 0.06} ${c * 0.94}`}
                  strokeDashoffset={-c * (deg / 360) + c * 0.03}
                  strokeLinecap="round"
                />
              );
            })}
          </Svg>
        </Animated.View>

        {/* Counter-rotating mid ring (CCW) with small tick dots */}
        <Animated.View style={[{ position: 'absolute', width: SIZE, height: SIZE }, innerStyle]}>
          <Svg width={SIZE} height={SIZE}>
            {Array.from({ length: 12 }).map((_, i) => {
              const a = (i / 12) * 2 * Math.PI;
              const x = CENTER + Math.cos(a) * (RETICLE_R - 18);
              const y = CENTER + Math.sin(a) * (RETICLE_R - 18);
              const big = i % 3 === 0;
              return (
                <Circle key={i} cx={x} cy={y} r={big ? 2.2 : 1.4} fill={big ? accent : '#52525B'} />
              );
            })}
          </Svg>
        </Animated.View>

        {/* Orbital particle ring A (CW) */}
        <Animated.View style={[{ position: 'absolute', width: SIZE, height: SIZE }, orbitAStyle]}>
          <Svg width={SIZE} height={SIZE}>
            {[0, 60, 130, 220].map((deg) => {
              const a = (deg / 360) * 2 * Math.PI;
              const x = CENTER + Math.cos(a) * ORBIT_A_R;
              const y = CENTER + Math.sin(a) * ORBIT_A_R;
              return (
                <Circle key={`a-${deg}`} cx={x} cy={y} r={2.5} fill={accentSoft} opacity={0.9} />
              );
            })}
          </Svg>
        </Animated.View>

        {/* Orbital particle ring B (CCW) */}
        <Animated.View style={[{ position: 'absolute', width: SIZE, height: SIZE }, orbitBStyle]}>
          <Svg width={SIZE} height={SIZE}>
            {[40, 150, 250, 320].map((deg) => {
              const a = (deg / 360) * 2 * Math.PI;
              const x = CENTER + Math.cos(a) * ORBIT_B_R;
              const y = CENTER + Math.sin(a) * ORBIT_B_R;
              return (
                <Circle key={`b-${deg}`} cx={x} cy={y} r={1.8} fill="#F5C451" opacity={0.85} />
              );
            })}
          </Svg>
        </Animated.View>

        {/* Corner brackets around the icon */}
        <Animated.View
          style={[
            {
              position: 'absolute',
              width: 130,
              height: 130,
              alignItems: 'center',
              justifyContent: 'center',
            },
            cornerStyle,
          ]}
        >
          {(['tl', 'tr', 'bl', 'br'] as const).map((pos) => (
            <Bracket key={pos} pos={pos} color={accent} />
          ))}
        </Animated.View>

        {/* Center icon */}
        <Animated.View
          style={[
            {
              width: 88,
              height: 88,
              borderRadius: 44,
              backgroundColor: withAlpha(accent, 0.12),
              borderWidth: 1.5,
              borderColor: withAlpha(accent, 0.55),
              alignItems: 'center',
              justifyContent: 'center',
              shadowColor: accent,
              shadowOpacity: 0.7,
              shadowRadius: 22,
              shadowOffset: { width: 0, height: 0 },
              elevation: 12,
            },
            iconStyle,
          ]}
        >
          <Icon name={icon} size={34} color={accent} />
        </Animated.View>
      </View>

      {/* HUD */}
      <View style={{ marginTop: 32, alignItems: 'center', width: '78%' }}>
        <Animated.Text
          key={stageIdx}
          entering={FadeIn.duration(280)}
          exiting={FadeOut.duration(160)}
          style={{ color: '#F4F4F7', fontSize: 19, fontWeight: '800', letterSpacing: 0.2 }}
        >
          {safeStages[stageIdx]}
        </Animated.Text>
        <Text
          style={{
            color: '#B4B4C2',
            fontSize: 11,
            marginTop: 8,
            letterSpacing: 1.4,
            fontWeight: '700',
          }}
        >
          {sublabel}
        </Text>

        {/* Progress bar with shimmer */}
        <View
          style={{
            marginTop: 22,
            width: '100%',
            height: 6,
            borderRadius: 3,
            backgroundColor: '#1B1B25',
            borderWidth: 1,
            borderColor: '#21212B',
            overflow: 'hidden',
          }}
        >
          <View
            style={{
              height: '100%',
              borderRadius: 3,
              backgroundColor: accent,
              width: `${percent}%`,
            }}
          />
          <Animated.View
            pointerEvents="none"
            style={[{ position: 'absolute', top: 0, bottom: 0, width: 120 }, shimmerStyle]}
          >
            <LinearGradient
              colors={
                [
                  'rgba(255,255,255,0)',
                  'rgba(255,255,255,0.55)',
                  'rgba(255,255,255,0)',
                ] as unknown as GradientColors
              }
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={{ flex: 1 }}
            />
          </Animated.View>
        </View>

        <View
          style={{
            marginTop: 10,
            flexDirection: 'row',
            justifyContent: 'space-between',
            width: '100%',
          }}
        >
          <Text style={{ color: '#B4B4C2', fontSize: 10, fontWeight: '700', letterSpacing: 1.2 }}>
            {footLabel}
          </Text>
          <Text
            style={{
              color: accent,
              fontSize: 11,
              fontWeight: '800',
              fontVariant: ['tabular-nums'],
            }}
          >
            {percent.toString().padStart(2, '0')}%
          </Text>
        </View>

        <ProgressDots index={stageIdx} total={safeStages.length} color={accent} />
      </View>
    </Animated.View>
  );
}

function Bracket({ pos, color }: { pos: 'tl' | 'tr' | 'bl' | 'br'; color: string }) {
  const size = 16;
  const thick = 2.5;
  const common = {
    position: 'absolute' as const,
    width: size,
    height: size,
    borderColor: color,
  };
  const map: Record<typeof pos, object> = {
    tl: { top: 0, left: 0, borderTopWidth: thick, borderLeftWidth: thick, borderTopLeftRadius: 4 },
    tr: {
      top: 0,
      right: 0,
      borderTopWidth: thick,
      borderRightWidth: thick,
      borderTopRightRadius: 4,
    },
    bl: {
      bottom: 0,
      left: 0,
      borderBottomWidth: thick,
      borderLeftWidth: thick,
      borderBottomLeftRadius: 4,
    },
    br: {
      bottom: 0,
      right: 0,
      borderBottomWidth: thick,
      borderRightWidth: thick,
      borderBottomRightRadius: 4,
    },
  };
  return <View style={[common, map[pos]]} />;
}

function ProgressDots({ index, total, color }: { index: number; total: number; color: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: 6, marginTop: 14 }}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={{
            width: i === index ? 18 : 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: i === index ? color : '#34343F',
          }}
        />
      ))}
    </View>
  );
}

function GridDots({ count }: { count: number }) {
  const dots: { left: string; top: string; size: number; opacity: number }[] = [];
  // Deterministic-ish layout so it doesn't reshuffle each render.
  for (let i = 0; i < count; i++) {
    const x = ((i * 137) % 100) + ((i * 23) % 7);
    const y = ((i * 73) % 100) + ((i * 11) % 5);
    dots.push({
      left: `${x % 100}%`,
      top: `${y % 100}%`,
      size: i % 5 === 0 ? 2 : 1,
      opacity: i % 7 === 0 ? 0.35 : 0.15,
    });
  }
  return (
    <View
      pointerEvents="none"
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
    >
      {dots.map((d, i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            left: d.left as `${number}%`,
            top: d.top as `${number}%`,
            width: d.size,
            height: d.size,
            borderRadius: d.size / 2,
            backgroundColor: '#FFFFFF',
            opacity: d.opacity,
          }}
        />
      ))}
    </View>
  );
}

/** SVG path for a ring sector (donut wedge) from `startDeg` to `endDeg`. */
function describeArc(
  cx: number,
  cy: number,
  innerR: number,
  outerR: number,
  startDeg: number,
  endDeg: number,
): string {
  const polar = (r: number, deg: number) => {
    const rad = (deg * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  };
  const largeArc = Math.abs(endDeg - startDeg) > 180 ? 1 : 0;
  const p1 = polar(outerR, startDeg);
  const p2 = polar(outerR, endDeg);
  const p3 = polar(innerR, endDeg);
  const p4 = polar(innerR, startDeg);
  return [
    `M ${p1.x} ${p1.y}`,
    `A ${outerR} ${outerR} 0 ${largeArc} 1 ${p2.x} ${p2.y}`,
    `L ${p3.x} ${p3.y}`,
    `A ${innerR} ${innerR} 0 ${largeArc} 0 ${p4.x} ${p4.y}`,
    'Z',
  ].join(' ');
}

/** Append an alpha to a #RRGGBB hex (e.g. withAlpha('#FF4D2E', 0.12)). */
function withAlpha(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  if (h.length !== 6) return hex;
  const a = Math.round(Math.max(0, Math.min(1, alpha)) * 255)
    .toString(16)
    .padStart(2, '0');
  return `#${h}${a}`;
}
