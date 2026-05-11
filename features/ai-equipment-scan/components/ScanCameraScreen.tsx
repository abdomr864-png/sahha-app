import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { Button, Icon, Screen } from '@features/shared';
import { useEntitlement } from '@features/premium';
import { useSession } from '@features/auth';
import { useScanEquipment } from '../hooks/useScanEquipment';
import { AnalyzingOverlay } from './AnalyzingOverlay';

export function ScanCameraScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { session } = useSession();
  const camRef = useRef<CameraView | null>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [busy, setBusy] = useState(false);
  const [facing, setFacing] = useState<'back' | 'front'>('back');
  const ent = useEntitlement('equipment_scan');
  const { scan, errorCode } = useScanEquipment();

  // Vertical scan line that loops top→bottom inside the reticle.
  const scanY = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scanY, {
          toValue: 1,
          duration: 1800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(scanY, {
          toValue: 0,
          duration: 1800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [scanY]);

  if (!permission) {
    return (
      <Screen>
        <ActivityIndicator />
      </Screen>
    );
  }

  if (!permission.granted) {
    return (
      <Screen>
        <View className="flex-1 items-center justify-center">
          <Text className="text-ink text-xl font-bold mb-3">
            {t('scan.permTitle', 'Camera access needed')}
          </Text>
          <Text className="text-ink-subtle text-base text-center mb-6 px-6">
            {t('scan.permBody', 'Allow camera access to scan gym equipment.')}
          </Text>
          <Button label={t('scan.grant', 'Grant access')} onPress={requestPermission} />
        </View>
      </Screen>
    );
  }

  if (ent.data && !ent.data.allowed) {
    return (
      <Screen>
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-ink text-xl font-bold mb-2">
            {t('premium.limitReached', "You've hit the free limit")}
          </Text>
          <Text className="text-ink-subtle text-base text-center mb-6">
            {ent.data.reason === 'premium_only'
              ? t('premium.premiumOnly', 'This is a premium feature')
              : t(
                  'scan.dailyLimit',
                  'You can scan 5 pieces of equipment per day on the free plan.',
                )}
          </Text>
          <Button label={t('common.back', 'Back')} onPress={() => router.back()} />
        </View>
      </Screen>
    );
  }

  const runScan = async (uri: string) => {
    if (!session?.user) return;
    setBusy(true);
    try {
      const compressed = await manipulateAsync(uri, [{ resize: { width: 1024 } }], {
        compress: 0.7,
        format: SaveFormat.JPEG,
      });
      await scan(session.user.id, compressed.uri);
      router.replace('/scan/results');
    } catch {
      // Errors are surfaced via `errorCode` below.
    } finally {
      setBusy(false);
    }
  };

  const capture = async () => {
    if (!camRef.current || busy) return;
    const photo = await camRef.current.takePictureAsync({ quality: 0.7, skipProcessing: true });
    if (!photo) return;
    await runScan(photo.uri);
  };

  const pickFromGallery = async () => {
    if (busy) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
      allowsEditing: false,
    });
    if (!res.canceled && res.assets[0]) {
      await runScan(res.assets[0].uri);
    }
  };

  return (
    <View className="flex-1 bg-bg">
      <CameraView ref={camRef} style={{ flex: 1 }} facing={facing} />

      {/* Top gradient for icon legibility */}
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(0,0,0,0.65)', 'rgba(0,0,0,0)']}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 160 }}
      />
      {/* Bottom gradient */}
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.85)']}
        style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 260 }}
      />

      {/* Reticle with corner brackets + scan line */}
      <View className="absolute inset-0" pointerEvents="none">
        <View className="flex-1 items-center justify-center">
          <View style={{ width: '78%', aspectRatio: 1 }} className="relative">
            <Corner pos="tl" />
            <Corner pos="tr" />
            <Corner pos="bl" />
            <Corner pos="br" />
            <Animated.View
              style={{
                position: 'absolute',
                left: '6%',
                right: '6%',
                height: 2,
                backgroundColor: '#FF4D2E',
                shadowColor: '#FF4D2E',
                shadowOpacity: 0.9,
                shadowRadius: 8,
                shadowOffset: { width: 0, height: 0 },
                transform: [
                  {
                    translateY: scanY.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, 280],
                    }),
                  },
                ],
              }}
            />
          </View>
          <View className="mt-6 px-4 py-2 rounded-full bg-bg/70 border border-border">
            <Text className="text-ink text-xs font-bold tracking-wide">
              {t('scan.frameHint', 'Frame the whole machine, good lighting')}
            </Text>
          </View>
        </View>
      </View>

      {/* Top bar */}
      <View className="absolute top-12 left-0 right-0 px-5 flex-row items-center justify-between">
        <GlassButton onPress={() => router.back()} icon="x" />
        <View className="flex-row" style={{ gap: 10 }}>
          <GlassButton
            onPress={() => setFacing((f) => (f === 'back' ? 'front' : 'back'))}
            icon="sparkles"
          />
          <GlassButton onPress={() => router.push('/scan/saved')} icon="bookmark" />
        </View>
      </View>

      {/* Bottom dock: gallery — shutter — spacer */}
      <View className="absolute bottom-10 left-0 right-0 items-center">
        {errorCode ? (
          <View className="mb-4 px-4 py-2 rounded-full bg-danger/15 border border-danger/40">
            <Text className="text-danger text-xs font-bold">
              {t(`errors.ai.${errorCode}`, errorCode)}
            </Text>
          </View>
        ) : null}
        <View className="flex-row items-center" style={{ gap: 28 }}>
          <Pressable
            onPress={pickFromGallery}
            disabled={busy}
            className="w-14 h-14 rounded-2xl bg-bg/70 border border-border items-center justify-center"
            style={{ opacity: busy ? 0.4 : 1 }}
          >
            <Icon name="image" size={24} color="#F4F4F5" />
          </Pressable>

          <Pressable
            onPress={capture}
            disabled={busy}
            className="w-24 h-24 rounded-full bg-accent items-center justify-center"
            style={{
              shadowColor: '#FF4D2E',
              shadowOpacity: 0.7,
              shadowRadius: 24,
              shadowOffset: { width: 0, height: 8 },
              elevation: 12,
              opacity: busy ? 0.85 : 1,
            }}
          >
            <View className="w-[78px] h-[78px] rounded-full border-[3px] border-white items-center justify-center">
              <View className="w-[64px] h-[64px] rounded-full bg-accent" />
            </View>
          </Pressable>

          {/* Spacer to keep the shutter visually centered */}
          <View className="w-14 h-14" />
        </View>
        <Text className="text-ink-subtle text-[11px] font-semibold mt-3 tracking-widest uppercase">
          {t('scan.tapToScan', 'Tap to scan · Pick from gallery')}
        </Text>
      </View>

      {/* Full-screen analyzing overlay */}
      <AnalyzingOverlay visible={busy} />
    </View>
  );
}

function GlassButton({
  onPress,
  icon,
}: {
  onPress: () => void;
  icon: 'x' | 'bookmark' | 'sparkles';
}) {
  return (
    <Pressable
      onPress={onPress}
      className="w-11 h-11 rounded-full bg-bg/70 border border-border items-center justify-center"
    >
      <Icon name={icon} size={18} color="#FFFFFF" />
    </Pressable>
  );
}

function Corner({ pos }: { pos: 'tl' | 'tr' | 'bl' | 'br' }) {
  const base = 'absolute w-7 h-7 border-accent';
  const map: Record<typeof pos, string> = {
    tl: `${base} top-0 left-0 border-t-[3px] border-l-[3px] rounded-tl-2xl`,
    tr: `${base} top-0 right-0 border-t-[3px] border-r-[3px] rounded-tr-2xl`,
    bl: `${base} bottom-0 left-0 border-b-[3px] border-l-[3px] rounded-bl-2xl`,
    br: `${base} bottom-0 right-0 border-b-[3px] border-r-[3px] rounded-br-2xl`,
  };
  return <View className={map[pos]} />;
}
