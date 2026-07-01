import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import Svg, { Path } from 'react-native-svg';
import { Button, ErrorMessage, useSafeBack } from '@features/shared';
import {
  useSignIn,
  useSocialAuth,
  authSchemas,
  AuthField,
  BrandMark,
  SocialAuthButtons,
  SocialAuthDivider,
} from '@features/auth';
import { hasCompletedOnboarding } from '@features/onboarding';

function BackIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path
        d="M15 6l-6 6 6 6"
        stroke="#F4F4F7"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export default function SignIn() {
  const { t } = useTranslation();
  const router = useRouter();
  const safeBack = useSafeBack('/(auth)/welcome');
  const signIn = useSignIn();
  const social = useSocialAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [validationErr, setValidationErr] = useState<string | null>(null);

  const onSocial = async (provider: 'apple' | 'google') => {
    const fn = provider === 'apple' ? social.signInWithApple : social.signInWithGoogle;
    const outcome = await fn();
    if (!outcome) return;
    router.replace(outcome.kind === 'new_user' ? '/(onboarding)/intro' : '/(tabs)/');
  };

  const onSubmit = () => {
    const parsed = authSchemas.signIn.safeParse({ email, password });
    if (!parsed.success) {
      setValidationErr(t('errors.unknown'));
      return;
    }
    setValidationErr(null);
    signIn.mutate(parsed.data, {
      onSuccess: async (session) => {
        // Resume the quiz for anyone who hasn't finished it — a user who
        // confirmed their email after sign-up, or abandoned onboarding earlier.
        const done = session?.user ? await hasCompletedOnboarding(session.user.id) : true;
        router.replace(done ? '/(tabs)/' : '/(onboarding)/intro');
      },
    });
  };

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={['top', 'left', 'right']}>
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: -120,
          right: -80,
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
              {t('auth.signIn.title')}
            </Text>
            <Text className="text-ink-subtle text-base mt-2">{t('auth.signIn.subtitle')}</Text>
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
            label={t('auth.signIn.email')}
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
            label={t('auth.signIn.password')}
            icon="lock"
            password
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            returnKeyType="go"
            onSubmitEditing={onSubmit}
          />

          <Pressable hitSlop={8} className="self-end mb-5">
            <Text className="text-accent text-sm font-semibold">{t('auth.signIn.forgot')}</Text>
          </Pressable>

          {validationErr ? <Text className="text-danger text-sm mb-3">{validationErr}</Text> : null}
          {signIn.isError ? (
            <View className="mb-3">
              <ErrorMessage error={signIn.error} />
            </View>
          ) : null}

          <Button label={t('auth.signIn.submit')} loading={signIn.isPending} onPress={onSubmit} />

          <View className="flex-row justify-center items-center mt-6 mb-6">
            <Text className="text-ink-subtle text-sm">{t('auth.signIn.noAccount')} </Text>
            <Pressable onPress={() => router.replace('/(auth)/sign-up')} hitSlop={8}>
              <Text className="text-accent text-sm font-semibold">
                {t('auth.signIn.noAccountCta')}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
