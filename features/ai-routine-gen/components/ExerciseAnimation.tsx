import { useEffect, useRef, useState } from 'react';
import { Image, View, type ImageStyle, type StyleProp } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

interface Props {
  images: string[];
  /** Half-cycle duration: how long one frame is fully visible before crossfading. */
  durationMs?: number;
  /** Crossfade duration between frames. */
  fadeMs?: number;
  /** Slight zoom on each rep — adds perceived motion / depth. */
  scalePulse?: boolean;
  /** Callback if both images fail to load. */
  onError?: () => void;
  /** Style for the outer container — should set width/height. */
  style?: StyleProp<ImageStyle>;
}

/**
 * Smooth cross-fading animation between exercise frames.
 *
 * Free-exercise-db ships 2 frames per exercise (start and end position).
 * Stacking two `Image` views with continuously animated opacity makes it
 * read as a rep instead of a photo swap.
 */
export function ExerciseAnimation({
  images,
  durationMs = 700,
  fadeMs = 450,
  scalePulse = true,
  onError,
  style,
}: Props) {
  const fadeProgress = useSharedValue(0); // 0 → frame A, 1 → frame B
  const scale = useSharedValue(1);
  const [aFailed, setAFailed] = useState(false);
  const [bFailed, setBFailed] = useState(false);
  const errorReportedRef = useRef(false);

  const frameA = images[0];
  const frameB = images[1] ?? images[0];

  useEffect(() => {
    if (!frameA) return;

    if (frameB && frameB !== frameA) {
      // Cross-fade loop A→B→A
      fadeProgress.value = withRepeat(
        withSequence(
          withTiming(1, { duration: fadeMs, easing: Easing.inOut(Easing.cubic) }),
          withTiming(1, { duration: durationMs }),
          withTiming(0, { duration: fadeMs, easing: Easing.inOut(Easing.cubic) }),
          withTiming(0, { duration: durationMs }),
        ),
        -1,
        false,
      );
      if (scalePulse) {
        scale.value = withRepeat(
          withSequence(
            withTiming(1.04, {
              duration: fadeMs + durationMs,
              easing: Easing.inOut(Easing.cubic),
            }),
            withTiming(1, {
              duration: fadeMs + durationMs,
              easing: Easing.inOut(Easing.cubic),
            }),
          ),
          -1,
          false,
        );
      }
    } else {
      // Single frame: only pulse the scale so it isn't perfectly still.
      if (scalePulse) {
        scale.value = withRepeat(
          withSequence(
            withTiming(1.03, { duration: 1200, easing: Easing.inOut(Easing.cubic) }),
            withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.cubic) }),
          ),
          -1,
          false,
        );
      }
    }
    return () => {
      cancelAnimation(fadeProgress);
      cancelAnimation(scale);
    };
  }, [frameA, frameB, durationMs, fadeMs, scalePulse, fadeProgress, scale]);

  const styleA = useAnimatedStyle(() => ({
    opacity: 1 - fadeProgress.value,
    transform: [{ scale: scale.value }],
  }));
  const styleB = useAnimatedStyle(() => ({
    opacity: fadeProgress.value,
    transform: [{ scale: scale.value }],
  }));

  // If both frames fail, surface to parent (so it can show a fallback tile).
  useEffect(() => {
    if (aFailed && bFailed && !errorReportedRef.current) {
      errorReportedRef.current = true;
      onError?.();
    }
  }, [aFailed, bFailed, onError]);

  if (!frameA) return null;

  return (
    <View style={[{ overflow: 'hidden' }, style as object]}>
      <Animated.View
        style={[{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }, styleA]}
      >
        <Image
          source={{ uri: frameA }}
          onError={() => setAFailed(true)}
          resizeMode="cover"
          style={{ width: '100%', height: '100%' }}
        />
      </Animated.View>
      {frameB && frameB !== frameA ? (
        <Animated.View
          style={[{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }, styleB]}
        >
          <Image
            source={{ uri: frameB }}
            onError={() => setBFailed(true)}
            resizeMode="cover"
            style={{ width: '100%', height: '100%' }}
          />
        </Animated.View>
      ) : null}
    </View>
  );
}
