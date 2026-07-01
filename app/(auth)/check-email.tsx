import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Button, Icon } from '@features/shared';
import { BrandMark } from '@features/auth';
import { supabase } from '@lib/supabase/client';

export default function CheckEmail() {
  const { t } = useTranslation();
  const router = useRouter();
  const { email } = useLocalSearchParams<{ email?: string }>();
  const [resendState, setResendState] = useState<'idle' | 'sending' | 'sent'>('idle');

  const onResend = async () => {
    if (!email || resendState === 'sending') return;
    setResendState('sending');
    const { error } = await supabase.auth.resend({ type: 'signup', email });
    setResendState(error ? 'idle' : 'sent');
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
      <View style={{ flex: 1, paddingHorizontal: 24, paddingTop: 8 }}>
        <View className="flex-1 items-center justify-center">
          <BrandMark size={56} />

          <View
            className="w-16 h-16 rounded-full items-center justify-center mt-8 mb-6"
            style={{
              backgroundColor: 'rgba(255,77,46,0.12)',
              borderWidth: 1,
              borderColor: 'rgba(255,77,46,0.4)',
            }}
          >
            <Icon name="mail" size={28} color="#FF4D2E" strokeWidth={2.2} />
          </View>

          <Text className="text-ink text-3xl font-extrabold tracking-tight text-center">
            {t('auth.checkEmail.title', { defaultValue: 'Confirm your email' })}
          </Text>
          <Text className="text-ink-subtle text-base mt-3 text-center leading-6">
            {email
              ? t('auth.checkEmail.subtitleWithEmail', {
                  email,
                  defaultValue: `We sent a confirmation link to ${email}. Tap it, then sign in to build your personalized plan.`,
                })
              : t('auth.checkEmail.subtitle', {
                  defaultValue:
                    'We sent you a confirmation link. Tap it, then sign in to build your personalized plan.',
                })}
          </Text>

          {resendState === 'sent' ? (
            <Text className="text-accent text-sm mt-4 text-center">
              {t('auth.checkEmail.resent', { defaultValue: 'Confirmation email sent again.' })}
            </Text>
          ) : null}
        </View>

        <View className="pb-6">
          <Button
            label={t('auth.checkEmail.cta', { defaultValue: 'Continue to sign in' })}
            onPress={() => router.replace('/(auth)/sign-in')}
          />
          <Pressable
            onPress={onResend}
            hitSlop={8}
            disabled={!email || resendState !== 'idle'}
            className="self-center mt-5"
          >
            <Text className="text-accent text-sm font-semibold">
              {resendState === 'sending'
                ? t('auth.checkEmail.resending', { defaultValue: 'Resending…' })
                : t('auth.checkEmail.resend', { defaultValue: 'Resend confirmation email' })}
            </Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}
