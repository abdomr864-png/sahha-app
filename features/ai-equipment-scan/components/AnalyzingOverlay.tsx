/* eslint-disable max-lines */
import { useEffect, useState } from 'react';
import { Text, View, useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';
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
import { Icon } from '@features/shared';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedPath = Animated.createAnimatedComponent(Path);

const ACCENT = '#FF4D2E';
const ACCENT_SOFT = '#FF7A4D';

/**
 * Full-screen "AI is analyzing the equipment" overlay.
 *
 * Animation stack (back → front):
 *  - Soft radial glow + grid backdrop
 *  - Sweeping radar beam rotating around the center
 *  - Three sonar pulse rings (staggered)
 *  - Pulsing inner gradient ring
 *  - Rotating reticle ring with four tick marks
 *  - Four pulsing corner brackets around the icon
 *  - Two orbital particle rings rotating in opposite directions
 *  - Center icon with breathing scale + accent glow
 *
 * Bottom HUD:
 *  - Cycling status text ("Detecting…" → "Identifying…" → "Tutorial…" → "Almost ready…")
 *  - Animated shimmer progress bar
 *  - Faux percentage counter
 *  - Stage dots
 */
export function AnalyzingOverlay({ visible }: { visible: boolean }) {
  const { t } = useTranslation();
  const { width, height } = useWindowDimensions();

  const STAGES = [
    t('scan.analyzing', 'Analyzing…'),
    t('scan.analyzeStages.detect', 'Identifying equipment…'),
    t('scan.analyzeStages.tutorial', 'Generating tutorial…'),
    t('scan.analyzeStages.almost', 'Almost ready…'),
  ];
  const [stageIdx, setStageIdx] = useState(0);
  const [percent, setPercent] = useState(0);

  // Cycle the status text.
  useEffect(() => {
    if (!visible) return;
    setStageIdx(0);
    setPercent(0);
    const stageId = setInterval(() => {
      setStageIdx((i) => (i + 1) % STAGES.length);
    }, 1400);
    return () => clearInterval(stageId);
  }, [visible, STAGES.length]);

  // Faux percentage that smoothly climbs to ~96% over ~6s, then idles.
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
    if (!visible) return;
    progress.value = withTiming(0.96, { duration: 6000, easing: Easing.out(Easing.cubic) });

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
    visible,
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

  if (!visible) return null;

  // Build the radar beam as a 90° arc with a fading gradient. The wedge
  // sweeps the whole circle as the wrapper rotates.
  const beamArc = describeArc(CENTER, CENTER, INNER_RING_R - 2, RETICLE_R + 14, -50, 0);

  return (
    <Animated.View
      entering={FadeIn.duration(220)}
      exiting={FadeOut.duration(180)}
      pointerEvents="auto"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width,
        height,
        alignItems: 'center',
        justifyContent: 'center',
      }}
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
            'rgba(255,77,46,0.10)',
            'rgba(11,11,15,0.0)',
            'rgba(11,11,15,0.92)',
          ] as unknown as readonly [string, string, ...string[]]
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
              <SvgGradient id="beamGrad" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor={ACCENT} stopOpacity="0" />
                <Stop offset="0.6" stopColor={ACCENT_SOFT} stopOpacity="0.18" />
                <Stop offset="1" stopColor={ACCENT} stopOpacity="0.55" />
              </SvgGradient>
            </Defs>
            <AnimatedPath d={beamArc} fill="url(#beamGrad)" />
          </Svg>
        </Animated.View>

        {/* Base ring + sonar pulses */}
        <Svg width={SIZE} height={SIZE} style={{ position: 'absolute' }}>
          <Defs>
            <SvgGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={ACCENT_SOFT} />
              <Stop offset="1" stopColor={ACCENT} />
            </SvgGradient>
          </Defs>
          <Circle
            cx={CENTER}
            cy={CENTER}
            r={INNER_RING_R}
            stroke="#27272F"
            strokeWidth={1.5}
            fill="none"
          />
          <AnimatedCircle
            cx={CENTER}
            cy={CENTER}
            stroke={ACCENT}
            fill="none"
            animatedProps={pulseAProps}
          />
          <AnimatedCircle
            cx={CENTER}
            cy={CENTER}
            stroke={ACCENT}
            fill="none"
            animatedProps={pulseBProps}
          />
          <AnimatedCircle
            cx={CENTER}
            cy={CENTER}
            stroke={ACCENT}
            fill="none"
            animatedProps={pulseCProps}
          />
          <AnimatedCircle
            cx={CENTER}
            cy={CENTER}
            stroke="url(#ringGrad)"
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
              stroke="#3F3F46"
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
                  stroke={ACCENT}
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
                <Circle key={i} cx={x} cy={y} r={big ? 2.2 : 1.4} fill={big ? ACCENT : '#52525B'} />
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
                <Circle key={`a-${deg}`} cx={x} cy={y} r={2.5} fill={ACCENT_SOFT} opacity={0.9} />
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
                <Circle key={`b-${deg}`} cx={x} cy={y} r={1.8} fill="#FBBF24" opacity={0.85} />
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
            <Bracket key={pos} pos={pos} />
          ))}
        </Animated.View>

        {/* Center icon */}
        <Animated.View
          style={[
            {
              width: 88,
              height: 88,
              borderRadius: 44,
              backgroundColor: 'rgba(255,77,46,0.12)',
              borderWidth: 1.5,
              borderColor: 'rgba(255,77,46,0.55)',
              alignItems: 'center',
              justifyContent: 'center',
              shadowColor: ACCENT,
              shadowOpacity: 0.7,
              shadowRadius: 22,
              shadowOffset: { width: 0, height: 0 },
              elevation: 12,
            },
            iconStyle,
          ]}
        >
          <Icon name="sparkles" size={34} color={ACCENT} />
        </Animated.View>
      </View>

      {/* HUD */}
      <View style={{ marginTop: 32, alignItems: 'center', width: '78%' }}>
        <Animated.Text
          key={stageIdx}
          entering={FadeIn.duration(280)}
          exiting={FadeOut.duration(160)}
          style={{
            color: '#F4F4F5',
            fontSize: 19,
            fontWeight: '800',
            letterSpacing: 0.2,
          }}
        >
          {STAGES[stageIdx]}
        </Animated.Text>
        <Text
          style={{
            color: '#A1A1AA',
            fontSize: 11,
            marginTop: 8,
            letterSpacing: 1.4,
            fontWeight: '700',
          }}
        >
          {t('scan.analyzeSub', 'AI VISION · TAKES A FEW SECONDS')}
        </Text>

        {/* Progress bar with shimmer */}
        <View
          style={{
            marginTop: 22,
            width: '100%',
            height: 6,
            borderRadius: 3,
            backgroundColor: '#1B1B24',
            borderWidth: 1,
            borderColor: '#27272F',
            overflow: 'hidden',
          }}
        >
          <Animated.View
            style={{
              height: '100%',
              borderRadius: 3,
              backgroundColor: ACCENT,
              width: `${percent}%`,
            }}
          />
          <Animated.View
            pointerEvents="none"
            style={[
              {
                position: 'absolute',
                top: 0,
                bottom: 0,
                width: 120,
              },
              shimmerStyle,
            ]}
          >
            <LinearGradient
              colors={
                [
                  'rgba(255,255,255,0)',
                  'rgba(255,255,255,0.55)',
                  'rgba(255,255,255,0)',
                ] as unknown as readonly [string, string, ...string[]]
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
          <Text
            style={{
              color: '#A1A1AA',
              fontSize: 10,
              fontWeight: '700',
              letterSpacing: 1.2,
            }}
          >
            {t('scan.scanning', 'SCANNING')}
          </Text>
          <Text
            style={{
              color: ACCENT,
              fontSize: 11,
              fontWeight: '800',
              fontVariant: ['tabular-nums'],
            }}
          >
            {percent.toString().padStart(2, '0')}%
          </Text>
        </View>

        <ProgressDots index={stageIdx} total={STAGES.length} />
      </View>
    </Animated.View>
  );
}

function Bracket({ pos }: { pos: 'tl' | 'tr' | 'bl' | 'br' }) {
  const size = 16;
  const thick = 2.5;
  const common = {
    position: 'absolute' as const,
    width: size,
    height: size,
    borderColor: ACCENT,
  };
  const map: Record<typeof pos, object> = {
    tl: {
      top: 0,
      left: 0,
      borderTopWidth: thick,
      borderLeftWidth: thick,
      borderTopLeftRadius: 4,
    },
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

function ProgressDots({ index, total }: { index: number; total: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 6, marginTop: 14 }}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={{
            width: i === index ? 18 : 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: i === index ? ACCENT : '#3F3F46',
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
