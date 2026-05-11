/* eslint-disable max-lines */
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ExerciseAnimation } from './ExerciseAnimation';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';
import { Icon } from '@features/shared';
import type { IconName } from '@features/shared';
import { exerciseImages, exerciseInfo } from '../data/exerciseLookup';

interface Props {
  visible: boolean;
  onClose: () => void;
  exercise: {
    name: string;
    muscle_group?: string;
    sets: number;
    reps: string;
    rpe?: number;
    rest_seconds: number;
  } | null;
  accentColor?: string;
}

export function ExerciseDetailSheet({
  visible,
  onClose,
  exercise,
  accentColor = '#F97316',
}: Props) {
  const { t } = useTranslation();
  const images = exercise ? exerciseImages(exercise.name) : [];
  const info = exercise ? exerciseInfo(exercise.name) : null;

  if (!exercise) return null;

  return (
    <Modal
      visible={visible}
      animationType="none"
      transparent
      statusBarTranslucent
      onRequestClose={onClose}
    >
      {/* Backdrop */}
      <Animated.View
        entering={FadeIn.duration(180)}
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.6)',
        }}
      >
        <Pressable style={{ flex: 1 }} onPress={onClose} />

        <Animated.View
          entering={SlideInDown.springify().damping(20)}
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            maxHeight: '92%',
            backgroundColor: '#0B0B0F',
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            borderTopWidth: 1,
            borderColor: '#27272F',
            overflow: 'hidden',
          }}
        >
          {/* Top accent stripe */}
          <LinearGradient
            colors={
              ['transparent', accentColor, 'transparent'] as unknown as readonly [
                string,
                string,
                ...string[],
              ]
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{ height: 2 }}
          />

          {/* Drag handle */}
          <View className="items-center pt-2">
            <View
              style={{
                width: 36,
                height: 4,
                borderRadius: 2,
                backgroundColor: '#3F3F46',
              }}
            />
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 32 }}
          >
            {/* Hero animation — smooth cross-fade between frames */}
            {images.length > 0 ? (
              <View
                style={{
                  width: '100%',
                  height: 240,
                  backgroundColor: '#17171B',
                  marginTop: 8,
                }}
              >
                <ExerciseAnimation
                  images={images}
                  durationMs={550}
                  fadeMs={500}
                  style={{ width: '100%', height: '100%' }}
                />
                <LinearGradient
                  colors={
                    ['transparent', 'rgba(11,11,15,0.95)'] as unknown as readonly [
                      string,
                      string,
                      ...string[],
                    ]
                  }
                  start={{ x: 0, y: 0.4 }}
                  end={{ x: 0, y: 1 }}
                  style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    bottom: 0,
                    height: 80,
                  }}
                />

                {/* Live demo badge */}
                <View
                  className="absolute flex-row items-center"
                  style={{
                    top: 12,
                    left: 16,
                    paddingHorizontal: 8,
                    paddingVertical: 4,
                    borderRadius: 999,
                    backgroundColor: 'rgba(0,0,0,0.55)',
                    gap: 5,
                  }}
                >
                  <View
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: 3,
                      backgroundColor: accentColor,
                    }}
                  />
                  <Text
                    className="text-white text-[9px] font-extrabold uppercase"
                    style={{ letterSpacing: 1.2 }}
                  >
                    {t('routines.liveDemo')}
                  </Text>
                </View>

                {/* Close button */}
                <Pressable
                  onPress={onClose}
                  style={{
                    position: 'absolute',
                    top: 12,
                    right: 12,
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    backgroundColor: 'rgba(0,0,0,0.55)',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon name="x" size={16} color="#FFFFFF" />
                </Pressable>
              </View>
            ) : null}

            <View className="px-5 pt-4">
              {/* Eyebrow */}
              {exercise.muscle_group ? (
                <View className="flex-row items-center mb-2" style={{ gap: 6 }}>
                  <View
                    style={{
                      width: 5,
                      height: 5,
                      borderRadius: 3,
                      backgroundColor: accentColor,
                    }}
                  />
                  <Text
                    className="text-[10px] font-extrabold uppercase"
                    style={{ color: accentColor, letterSpacing: 1.2 }}
                  >
                    {exercise.muscle_group}
                  </Text>
                </View>
              ) : null}

              {/* Title */}
              <Text className="text-ink text-2xl font-extrabold tracking-tight mb-1">
                {exercise.name}
              </Text>

              {/* Meta row */}
              {info ? (
                <View className="flex-row mb-4" style={{ gap: 6, flexWrap: 'wrap' }}>
                  {info.equipment ? <MetaPill icon="dumbbell" label={info.equipment} /> : null}
                  {info.level ? <MetaPill icon="trending" label={info.level} /> : null}
                  {info.mechanic ? <MetaPill icon="target" label={info.mechanic} /> : null}
                </View>
              ) : null}

              {/* Prescribed work */}
              <Text
                className="text-ink-muted text-[10px] font-extrabold uppercase mb-2 mt-2"
                style={{ letterSpacing: 1.2 }}
              >
                {t('exercise.prescribed')}
              </Text>
              <View className="flex-row" style={{ gap: 8 }}>
                <SpecCard
                  label={t('routines.setsXReps')}
                  value={`${exercise.sets} × ${exercise.reps}`}
                  accent={accentColor}
                />
                <SpecCard
                  label={t('train.session.rest')}
                  value={`${exercise.rest_seconds}${t('common.sec')}`}
                />
                {exercise.rpe ? (
                  <SpecCard label={t('routines.rpe')} value={String(exercise.rpe)} />
                ) : null}
              </View>

              {/* Muscles */}
              {info && (info.primaryMuscles.length || info.secondaryMuscles.length) ? (
                <>
                  <Text
                    className="text-ink-muted text-[10px] font-extrabold uppercase mb-2 mt-5"
                    style={{ letterSpacing: 1.2 }}
                  >
                    {t('exercise.muscles')}
                  </Text>
                  <View className="flex-row" style={{ gap: 6, flexWrap: 'wrap' }}>
                    {info.primaryMuscles.map((m) => (
                      <View
                        key={`p-${m}`}
                        className="rounded-full px-3 py-1"
                        style={{
                          backgroundColor: `${accentColor}1F`,
                          borderWidth: 1,
                          borderColor: `${accentColor}40`,
                        }}
                      >
                        <Text
                          className="text-[11px] font-extrabold uppercase"
                          style={{ color: accentColor, letterSpacing: 0.5 }}
                        >
                          {m}
                        </Text>
                      </View>
                    ))}
                    {info.secondaryMuscles.map((m) => (
                      <View
                        key={`s-${m}`}
                        className="rounded-full px-3 py-1"
                        style={{
                          backgroundColor: 'rgba(255,255,255,0.04)',
                          borderWidth: 1,
                          borderColor: '#27272F',
                        }}
                      >
                        <Text
                          className="text-ink-muted text-[11px] font-bold uppercase"
                          style={{ letterSpacing: 0.5 }}
                        >
                          {m}
                        </Text>
                      </View>
                    ))}
                  </View>
                </>
              ) : null}

              {/* Instructions */}
              {info?.instructions?.length ? (
                <>
                  <Text
                    className="text-ink-muted text-[10px] font-extrabold uppercase mb-3 mt-5"
                    style={{ letterSpacing: 1.2 }}
                  >
                    {t('routines.howToDo')}
                  </Text>
                  {info.instructions.map((step, i) => (
                    <View key={i} className="flex-row mb-3" style={{ gap: 12 }}>
                      <View
                        className="rounded-full items-center justify-center"
                        style={{
                          width: 24,
                          height: 24,
                          backgroundColor: `${accentColor}1F`,
                          borderWidth: 1,
                          borderColor: `${accentColor}40`,
                        }}
                      >
                        <Text className="text-[11px] font-extrabold" style={{ color: accentColor }}>
                          {i + 1}
                        </Text>
                      </View>
                      <Text className="text-ink text-[14px] flex-1" style={{ lineHeight: 20 }}>
                        {step}
                      </Text>
                    </View>
                  ))}
                </>
              ) : null}
            </View>
          </ScrollView>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

function MetaPill({ icon, label }: { icon: IconName; label: string }) {
  return (
    <View
      className="flex-row items-center rounded-full"
      style={{
        paddingHorizontal: 8,
        paddingVertical: 4,
        backgroundColor: 'rgba(255,255,255,0.04)',
        borderWidth: 1,
        borderColor: '#27272F',
        gap: 5,
      }}
    >
      <Icon name={icon} size={11} color="#A1A1AA" />
      <Text
        className="text-ink-muted text-[11px] font-bold capitalize"
        style={{ letterSpacing: 0.3 }}
      >
        {label}
      </Text>
    </View>
  );
}

function SpecCard({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <View
      className="flex-1 rounded-xl"
      style={{
        paddingVertical: 10,
        paddingHorizontal: 12,
        backgroundColor: accent ? `${accent}10` : '#17171B',
        borderWidth: 1,
        borderColor: accent ? `${accent}30` : '#27272F',
      }}
    >
      <Text
        className="text-[9px] font-extrabold uppercase mb-1"
        style={{
          letterSpacing: 1,
          color: accent ?? '#A1A1AA',
        }}
      >
        {label}
      </Text>
      <Text
        className="font-extrabold tracking-tight"
        style={{
          fontSize: 16,
          color: accent ?? '#F4F4F5',
        }}
      >
        {value}
      </Text>
    </View>
  );
}
