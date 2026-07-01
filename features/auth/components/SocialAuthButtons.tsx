import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, Text, View } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import Svg, { Path } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { isGoogleSigninAvailable } from '../services/google-auth';

interface Props {
  onApple: () => void;
  onGoogle: () => void;
  loading?: 'apple' | 'google' | null;
  disabled?: boolean;
}

export function SocialAuthButtons({ onApple, onGoogle, loading = null, disabled = false }: Props) {
  const { t } = useTranslation();
  const [appleAvailable, setAppleAvailable] = useState(Platform.OS === 'ios');
  const googleAvailable = isGoogleSigninAvailable();

  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    AppleAuthentication.isAvailableAsync()
      .then(setAppleAvailable)
      .catch(() => setAppleAvailable(false));
  }, []);

  const isLoading = loading !== null;

  // Neither provider has a native module → render nothing (Expo Go on Android).
  if (Platform.OS !== 'ios' && !googleAvailable) return null;

  return (
    <View style={{ marginBottom: 18 }}>
      {Platform.OS === 'ios' && appleAvailable ? (
        <View style={{ marginBottom: 10 }}>
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
            buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
            cornerRadius={14}
            style={{ width: '100%', height: 52 }}
            onPress={() => {
              if (!disabled && !isLoading) onApple();
            }}
          />
          {loading === 'apple' ? (
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                inset: 0,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ActivityIndicator color="#0A0A0F" />
            </View>
          ) : null}
        </View>
      ) : null}

      {googleAvailable ? (
        <Pressable
          onPress={() => {
            if (!disabled && !isLoading) onGoogle();
          }}
          accessibilityRole="button"
          disabled={disabled || isLoading}
          style={{
            height: 52,
            borderRadius: 14,
            backgroundColor: '#FFFFFF',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: disabled || isLoading ? 0.7 : 1,
          }}
        >
          {loading === 'google' ? (
            <ActivityIndicator color="#0A0A0F" />
          ) : (
            <>
              <GoogleGlyph />
              <Text
                style={{
                  color: '#0A0A0F',
                  fontSize: 15,
                  fontWeight: '600',
                  marginLeft: 10,
                }}
              >
                {t('auth.social.google')}
              </Text>
            </>
          )}
        </Pressable>
      ) : null}
    </View>
  );
}

export function SocialAuthDivider() {
  const { t } = useTranslation();
  // Hide the "or" rule when neither provider is available — otherwise it
  // floats above the email field with nothing above it.
  if (Platform.OS !== 'ios' && !isGoogleSigninAvailable()) return null;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 18 }}>
      <View style={{ flex: 1, height: 1, backgroundColor: '#21212B' }} />
      <Text style={{ color: '#B4B4C2', fontSize: 12, marginHorizontal: 12 }}>
        {t('auth.social.or')}
      </Text>
      <View style={{ flex: 1, height: 1, backgroundColor: '#21212B' }} />
    </View>
  );
}

function GoogleGlyph() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24">
      <Path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.75h3.57c2.08-1.92 3.28-4.74 3.28-8.07z"
        fill="#4285F4"
      />
      <Path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.75c-.99.66-2.25 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"
        fill="#34A853"
      />
      <Path
        d="M5.84 14.12A6.6 6.6 0 0 1 5.5 12c0-.74.13-1.45.34-2.12V7.04H2.18A11 11 0 0 0 1 12c0 1.78.43 3.46 1.18 4.96l3.66-2.84z"
        fill="#FBBC05"
      />
      <Path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.04l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"
        fill="#EA4335"
      />
    </Svg>
  );
}
