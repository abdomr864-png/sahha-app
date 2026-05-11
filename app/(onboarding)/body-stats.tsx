import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import {
  DateInput,
  ErrorMessage,
  Input,
  OnboardingFooter,
  OnboardingHeader,
  OnboardingHero,
  Screen,
} from '@features/shared';
import { useOnboardingStore, useCompleteOnboarding, onboardingSchema } from '@features/onboarding';

const INJURY_PRESETS = [
  'lower_back',
  'knees',
  'shoulders',
  'wrists',
  'elbows',
  'hips',
  'neck',
  'ankles',
];

const SEX_OPTIONS: ('male' | 'female' | 'other')[] = ['male', 'female', 'other'];

export default function BodyStats() {
  const { t } = useTranslation();
  const router = useRouter();
  const draft = useOnboardingStore((s) => s.draft);
  const setDraft = useOnboardingStore((s) => s.set);
  const complete = useCompleteOnboarding();

  const [username, setUsername] = useState(draft.username ?? '');
  const [displayName, setDisplayName] = useState(draft.display_name ?? '');
  const [heightCm, setHeightCm] = useState(String(draft.height_cm ?? ''));
  const [weight, setWeight] = useState(String(draft.weight_kg ?? ''));
  const [targetWeight, setTargetWeight] = useState(
    draft.target_weight_kg != null ? String(draft.target_weight_kg) : '',
  );
  const [sex, setSex] = useState<'male' | 'female' | 'other' | null>(draft.sex ?? null);
  const [dob, setDob] = useState(draft.dob ?? '');
  const [injuries, setInjuries] = useState<string[]>(draft.injuries ?? []);
  const [error, setError] = useState<string | null>(null);

  const toggleInjury = (key: string) =>
    setInjuries((arr) => (arr.includes(key) ? arr.filter((k) => k !== key) : [...arr, key]));

  const targetWeightNum = Number(targetWeight);
  const weightNum = Number(weight);

  const submit = () => {
    if (!sex) {
      setError(t('onboarding.bodyStats.errSex', { defaultValue: 'Please select your sex.' }));
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) {
      setError(
        t('onboarding.bodyStats.errDob', { defaultValue: 'Enter date of birth as YYYY-MM-DD.' }),
      );
      return;
    }
    if (!Number.isFinite(targetWeightNum) || targetWeightNum < 30 || targetWeightNum > 300) {
      setError(
        t('errors.invalidWeight', { defaultValue: 'Enter a target weight between 30 and 300 kg' }),
      );
      return;
    }
    const candidate = {
      ...draft,
      username,
      display_name: displayName,
      height_cm: Number(heightCm),
      weight_kg: weightNum,
      target_weight_kg: targetWeightNum,
      sex,
      dob,
      weight_unit: draft.weight_unit ?? 'kg',
      injuries,
    };
    const parsed = onboardingSchema.safeParse(candidate);
    if (!parsed.success) {
      setError(t('errors.unknown'));
      return;
    }
    setDraft('username', parsed.data.username);
    setDraft('display_name', parsed.data.display_name);
    setDraft('height_cm', parsed.data.height_cm);
    setDraft('weight_kg', parsed.data.weight_kg);
    setDraft('target_weight_kg', parsed.data.target_weight_kg);
    setDraft('weight_unit', parsed.data.weight_unit);
    setDraft('sex', parsed.data.sex);
    setDraft('dob', parsed.data.dob);
    if (parsed.data.injuries) setDraft('injuries', parsed.data.injuries);
    complete.mutate(parsed.data, {
      onSuccess: () => router.replace('/(onboarding)/health-permissions'),
    });
  };

  const canSubmit =
    !!username &&
    !!displayName &&
    !!sex &&
    /^\d{4}-\d{2}-\d{2}$/.test(dob) &&
    !!heightCm &&
    !!weight &&
    !!targetWeight;

  const direction = (() => {
    if (!Number.isFinite(weightNum) || !Number.isFinite(targetWeightNum)) return null;
    if (targetWeightNum > weightNum + 1) return 'gain';
    if (targetWeightNum < weightNum - 1) return 'lose';
    return 'maintain';
  })();

  return (
    <Screen
      scroll
      glow
      footer={
        <OnboardingFooter
          label={t('common.continue')}
          onPress={submit}
          disabled={!canSubmit}
          loading={complete.isPending}
        />
      }
    >
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <OnboardingHeader step={9} total={9} />
        <Animated.View entering={FadeIn.duration(500)}>
          <OnboardingHero icon="user" />
        </Animated.View>
        <Animated.View entering={FadeInDown.duration(500).delay(80)}>
          <Text className="text-ink text-4xl font-extrabold tracking-tight leading-tight mb-3 text-center">
            {t('onboarding.bodyStats.title')}
          </Text>
          <Text className="text-ink-subtle text-base mb-8 text-center px-2">
            {t('onboarding.bodyStats.subtitle')}
          </Text>
        </Animated.View>

        <Input
          label={t('onboarding.bodyStats.username')}
          icon="user"
          autoCapitalize="none"
          autoCorrect={false}
          value={username}
          onChangeText={setUsername}
          placeholder="liftbro"
        />
        <Input
          label={t('onboarding.bodyStats.displayName')}
          icon="user"
          value={displayName}
          onChangeText={setDisplayName}
          placeholder="Display name"
        />

        <View className="mt-2 mb-4">
          <Text className="text-ink-muted text-[10px] font-bold tracking-widest mb-2">
            {t('onboarding.bodyStats.sex', { defaultValue: 'SEX' }).toUpperCase()}
          </Text>
          <View className="flex-row" style={{ gap: 8 }}>
            {SEX_OPTIONS.map((s) => {
              const active = sex === s;
              return (
                <Pressable
                  key={s}
                  onPress={() => setSex(s)}
                  className={`flex-1 rounded-2xl border px-3 py-3 items-center ${
                    active ? 'bg-accent/10 border-accent' : 'bg-bg-raised border-border'
                  }`}
                >
                  <Text className={`text-sm font-bold ${active ? 'text-accent' : 'text-ink'}`}>
                    {t(`onboarding.bodyStats.${s}`)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <DateInput
          label={t('onboarding.bodyStats.dob', { defaultValue: 'DATE OF BIRTH' })}
          value={dob}
          onChange={setDob}
        />

        <View className="flex-row" style={{ gap: 10 }}>
          <View className="flex-1">
            <Input
              label={t('onboarding.bodyStats.heightCm')}
              icon="ruler"
              keyboardType="numeric"
              value={heightCm}
              onChangeText={setHeightCm}
              placeholder="178"
              trailing="cm"
            />
          </View>
          <View className="flex-1">
            <Input
              label={t('onboarding.bodyStats.weight')}
              icon="scale"
              keyboardType="numeric"
              value={weight}
              onChangeText={setWeight}
              placeholder="80"
              trailing="kg"
            />
          </View>
        </View>

        <Input
          label={t('onboarding.targetWeight.label', { defaultValue: 'Target weight' })}
          icon="target"
          keyboardType="numeric"
          value={targetWeight}
          onChangeText={(v) => {
            setTargetWeight(v);
            setError(null);
          }}
          placeholder="75"
          trailing="kg"
        />
        {direction ? (
          <Text className="text-ink-subtle text-xs -mt-2 mb-2">
            {direction === 'gain'
              ? t('onboarding.targetWeight.gain', {
                  defaultValue: 'You’ll gain weight to reach this goal.',
                })
              : direction === 'lose'
                ? t('onboarding.targetWeight.lose', {
                    defaultValue: 'You’ll lose weight to reach this goal.',
                  })
                : t('onboarding.targetWeight.maintain', {
                    defaultValue: 'You’ll maintain your current weight.',
                  })}
          </Text>
        ) : null}

        <View className="mt-4 mb-2">
          <Text className="text-ink-muted text-[10px] font-bold tracking-widest mb-2">
            {t('onboarding.injuries.label', 'INJURIES OR LIMITATIONS (optional)')}
          </Text>
          <View className="flex-row flex-wrap" style={{ gap: 6 }}>
            {INJURY_PRESETS.map((k) => {
              const active = injuries.includes(k);
              return (
                <Pressable
                  key={k}
                  onPress={() => toggleInjury(k)}
                  className={`px-3.5 py-2 rounded-full border ${
                    active ? 'bg-accent border-accent' : 'bg-bg-raised border-border'
                  }`}
                >
                  <Text
                    className={`text-xs font-bold ${active ? 'text-accent-contrast' : 'text-ink-subtle'}`}
                  >
                    {t(`onboarding.injuries.presets.${k}`, k.replace('_', ' '))}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {error ? <Text className="text-danger text-sm mb-2">{error}</Text> : null}
        {complete.isError ? (
          <View className="mb-3">
            <ErrorMessage error={complete.error} />
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </Screen>
  );
}
