import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import Svg, { Path } from 'react-native-svg';
import { Button, ErrorMessage, useSafeBack } from '@features/shared';
import {
  useSignUp,
  useSocialAuth,
  authSchemas,
  AuthField,
  BrandMark,
  SocialAuthButtons,
  SocialAuthDivider,
} from '@features/auth';

function BackIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path
        d="M15 6l-6 6 6 6"
        stroke="#F4F4F5"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function scorePassword(pw: string): { score: 0 | 1 | 2 | 3 | 4; label: string } {
  let s = 0;
  if (pw.length >= 8) s++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  const score = Math.min(s, 4) as 0 | 1 | 2 | 3 | 4;
  const labels = ['', 'Weak', 'Fair', 'Good', 'Strong'] as const;
  return { score, label: labels[score] ?? '' };
}

export default function SignUp() {
  const { t } = useTranslation();
  const router = useRouter();
  const safeBack = useSafeBack('/(auth)/welcome');
  const signUp = useSignUp();
  const social = useSocialAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [validationErr, setValidationErr] = useState<string | null>(null);

  const strength = useMemo(() => scorePassword(password), [password]);
  const barColors = ['#27272F', '#F87171', '#FBBF24', '#34D399', '#34D399'];

  const onSocial = async (provider: 'apple' | 'google') => {
    const fn = provider === 'apple' ? social.signInWithApple : social.signInWithGoogle;
    const outcome = await fn();
    if (!outcome) return;
    if (outcome.kind === 'new_user') router.replace('/(onboarding)/intro');
    // returning users handled by AuthGate's session redirect.
  };

  const onSubmit = () => {
    const parsed = authSchemas.signUp.safeParse({ email, password });
    if (!parsed.success) {
      setValidationErr(t('errors.unknown'));
      return;
    }
    setValidationErr(null);
    signUp.mutate(parsed.data, {
      onSuccess: () => router.replace('/(onboarding)/intro'),
    });
  };

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={['top', 'left', 'right']}>
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: -120,
          left: -80,
          width: 280,
          height: 280,
          borderRadius: 280,
          backgroundColor: '#FF4D2E',
          opacity: 0.16,
        }}
      />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingTop: 8 }}
          keyboardShouldPersistTaps="handled"
        >
          <Pressable
            onPress={safeBack}
            hitSlop={12}
            className="w-10 h-10 rounded-full bg-bg-raised border border-border items-center justify-center"
          >
            <BackIcon />
          </Pressable>

          <View className="mt-8 mb-8">
            <BrandMark size={56} />
            <Text className="text-ink text-3xl font-extrabold mt-6 tracking-tight">
              {t('auth.signUp.title')}
            </Text>
            <Text className="text-ink-subtle text-base mt-2">{t('auth.signUp.subtitle')}</Text>
          </View>

          <SocialAuthButtons
            onApple={() => onSocial('apple')}
            onGoogle={() => onSocial('google')}
            loading={social.status === 'loading' ? social.activeProvider : null}
          />
          {social.status === 'error' && social.error ? (
            <Text className="text-danger text-sm mb-3">{t(social.error.i18nKey)}</Text>
          ) : null}
          <SocialAuthDivider />

          <AuthField
            label={t('auth.signUp.email')}
            icon="mail"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
            value={email}
            onChangeText={setEmail}
            placeholder="you@domain.com"
            returnKeyType="next"
          />
          <AuthField
            label={t('auth.signUp.password')}
            icon="lock"
            password
            value={password}
            onChangeText={setPassword}
            placeholder="At least 8 characters"
            returnKeyType="go"
            onSubmitEditing={onSubmit}
          />

          {/* Password strength */}
          <View className="mb-5 -mt-1">
            <View className="flex-row" style={{ gap: 6 }}>
              {[1, 2, 3, 4].map((i) => (
                <View
                  key={i}
                  style={{
                    flex: 1,
                    height: 4,
                    borderRadius: 4,
                    backgroundColor: strength.score >= i ? barColors[strength.score] : '#27272F',
                  }}
                />
              ))}
            </View>
            {password ? (
              <Text className="text-ink-muted text-xs mt-2">
                Password strength: <Text className="text-ink">{strength.label}</Text>
              </Text>
            ) : null}
          </View>

          {validationErr ? <Text className="text-danger text-sm mb-3">{validationErr}</Text> : null}
          {signUp.isError ? (
            <View className="mb-3">
              <ErrorMessage error={signUp.error} />
            </View>
          ) : null}

          <Button label={t('auth.signUp.submit')} loading={signUp.isPending} onPress={onSubmit} />

          <Text className="text-ink-muted text-xs text-center mt-4 leading-5">
            {t('auth.signUp.terms')}
          </Text>

          <View className="flex-row justify-center items-center mt-6 mb-6">
            <Text className="text-ink-subtle text-sm">{t('auth.signUp.haveAccount')} </Text>
            <Pressable onPress={() => router.replace('/(auth)/sign-in')} hitSlop={8}>
              <Text className="text-accent text-sm font-semibold">
                {t('auth.signUp.haveAccountCta')}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
