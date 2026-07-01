import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from './Button';
import { Icon, type IconName } from './Icon';

type Tone = 'default' | 'danger';

interface Props {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
  icon?: IconName;
  tone?: Tone;
  title: string;
  body?: string;
  confirmLabel: string;
  cancelLabel: string;
  loading?: boolean;
}

export function ConfirmSheet({
  visible,
  onClose,
  onConfirm,
  icon,
  tone = 'default',
  title,
  body,
  confirmLabel,
  cancelLabel,
  loading,
}: Props) {
  const insets = useSafeAreaInsets();
  const progress = useSharedValue(0);
  // Keeps the Modal mounted during the slide-out so the animation can
  // finish before the native overlay disappears.
  const [mounted, setMounted] = useState(visible);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      progress.value = withTiming(1, {
        duration: 260,
        easing: Easing.out(Easing.cubic),
      });
    } else {
      progress.value = withTiming(
        0,
        { duration: 200, easing: Easing.in(Easing.cubic) },
        (finished) => {
          if (finished) runOnJS(setMounted)(false);
        },
      );
    }
  }, [visible, progress]);

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - progress.value) * 480 }],
    opacity: progress.value,
  }));
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: progress.value * 0.65,
  }));

  const accent = tone === 'danger' ? '#FF4D6D' : '#FF4D2E';
  const iconWrapClass =
    tone === 'danger'
      ? 'bg-danger/10 border border-danger/40'
      : 'bg-accent/10 border border-accent/40';

  const dismiss = () => {
    if (!loading) onClose();
  };

  return (
    <Modal
      visible={mounted}
      transparent
      statusBarTranslucent
      animationType="none"
      onRequestClose={dismiss}
    >
      <View style={StyleSheet.absoluteFill}>
        <Animated.View
          style={[StyleSheet.absoluteFill, { backgroundColor: '#000' }, backdropStyle]}
          pointerEvents="none"
        />
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={dismiss}
          accessibilityRole="button"
          accessibilityLabel={cancelLabel}
        />

        <Animated.View
          style={[
            {
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              paddingBottom: insets.bottom + 16,
              paddingHorizontal: 20,
              paddingTop: 10,
              backgroundColor: '#14141C',
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              borderTopWidth: 1,
              borderColor: '#21212B',
              shadowColor: '#000',
              shadowOpacity: 0.5,
              shadowRadius: 24,
              shadowOffset: { width: 0, height: -8 },
              elevation: 24,
            },
            sheetStyle,
          ]}
        >
          <View className="self-center w-10 h-1 rounded-full bg-border-strong mb-5" />

          {icon ? (
            <View className="items-center mb-4">
              <View
                className={`w-16 h-16 rounded-2xl items-center justify-center ${iconWrapClass}`}
                style={{
                  shadowColor: accent,
                  shadowOpacity: 0.4,
                  shadowRadius: 16,
                  shadowOffset: { width: 0, height: 8 },
                  elevation: 8,
                }}
              >
                <Icon name={icon} size={28} color={accent} strokeWidth={2} />
              </View>
            </View>
          ) : null}

          <Text className="text-ink text-xl font-extrabold tracking-tight text-center">
            {title}
          </Text>

          {body ? (
            <Text className="text-ink-subtle text-sm leading-5 text-center mt-2 mb-6 px-2">
              {body}
            </Text>
          ) : (
            <View className="mb-6" />
          )}

          <View style={{ gap: 10 }}>
            <Button
              label={confirmLabel}
              variant={tone === 'danger' ? 'danger' : 'primary'}
              icon={icon}
              loading={loading}
              onPress={onConfirm}
            />
            <Button label={cancelLabel} variant="secondary" onPress={dismiss} disabled={loading} />
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}
