import { useEffect, useMemo, useState } from 'react';
import { Alert, Image, Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import * as ImagePicker from 'expo-image-picker';
import {
  Button,
  Card,
  ErrorMessage,
  Header,
  Icon,
  Input,
  Screen,
  Spinner,
  useSafeBack,
} from '@features/shared';
import { useProfile, useUpdateProfile } from '@features/onboarding';
import { useSession } from '@features/auth';
import { supabase } from '@lib/supabase/client';
import { toAppError } from '@lib/supabase/errors';

async function uploadAvatar(userId: string, localUri: string): Promise<string> {
  const ext = localUri.split('.').pop()?.split('?')[0]?.toLowerCase() || 'jpg';
  const safeExt = /^[a-z0-9]{1,6}$/.test(ext) ? ext : 'jpg';
  const path = `${userId}/${Date.now()}.${safeExt}`;
  const res = await fetch(localUri);
  const buf = await res.arrayBuffer();
  const contentType =
    safeExt === 'png' ? 'image/png' : safeExt === 'webp' ? 'image/webp' : 'image/jpeg';
  const { error } = await supabase.storage
    .from('avatars')
    .upload(path, buf, { contentType, upsert: true });
  if (error) throw toAppError(error);
  const { data } = supabase.storage.from('avatars').getPublicUrl(path);
  return data.publicUrl;
}

export default function EditProfile() {
  const { t } = useTranslation();
  const safeBack = useSafeBack('/(tabs)/profile');
  const { session } = useSession();
  const profileQ = useProfile();
  const update = useUpdateProfile();

  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [targetWeightKg, setTargetWeightKg] = useState('');
  const [trainingDays, setTrainingDays] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  useEffect(() => {
    const p = profileQ.data;
    if (!p) return;
    setDisplayName(p.display_name ?? '');
    setUsername(p.username ?? '');
    setBio(p.bio ?? '');
    setHeightCm(p.height_cm ? String(p.height_cm) : '');
    setWeightKg(p.weight_kg ? String(p.weight_kg) : '');
    setTargetWeightKg(p.target_weight_kg ? String(p.target_weight_kg) : '');
    setTrainingDays(p.training_days_per_week ? String(p.training_days_per_week) : '');
    setAvatarUrl(p.avatar_url ?? null);
  }, [profileQ.data]);

  const initials = useMemo(() => {
    const source = (displayName || username || session?.user.email || 'A').trim();
    return source.slice(0, 1).toUpperCase();
  }, [displayName, username, session?.user.email]);

  const pickAvatar = async () => {
    const userId = session?.user.id;
    if (!userId) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(t('common.error'), t('profile.edit.permissionDenied'));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (result.canceled || !result.assets[0]) return;
    const localUri = result.assets[0].uri;
    setUploading(true);
    setUploadError(null);
    try {
      const url = await uploadAvatar(userId, localUri);
      setAvatarUrl(url);
      await update.mutateAsync({ avatar_url: url });
    } catch (e) {
      setUploadError(t('profile.edit.uploadFailed'));
      console.warn('avatar upload failed', e);
    } finally {
      setUploading(false);
    }
  };

  const removeAvatar = async () => {
    setAvatarUrl(null);
    try {
      await update.mutateAsync({ avatar_url: null });
    } catch {
      /* surfaced via update.error */
    }
  };

  const onSave = async () => {
    const heightNum = heightCm ? Number(heightCm) : null;
    const weightNum = weightKg ? Number(weightKg) : null;
    const targetNum = targetWeightKg ? Number(targetWeightKg) : null;
    const daysNum = trainingDays ? Number(trainingDays) : null;
    try {
      await update.mutateAsync({
        display_name: displayName.trim() || null,
        username: username.trim().toLowerCase() || null,
        bio: bio.trim() || null,
        height_cm: heightNum && !Number.isNaN(heightNum) ? heightNum : null,
        weight_kg: weightNum && !Number.isNaN(weightNum) ? weightNum : null,
        target_weight_kg: targetNum && !Number.isNaN(targetNum) ? targetNum : null,
        training_days_per_week:
          daysNum && !Number.isNaN(daysNum) ? Math.max(1, Math.min(7, daysNum)) : null,
      });
      safeBack();
    } catch {
      /* surfaced via update.error */
    }
  };

  if (profileQ.isPending) {
    return (
      <Screen>
        <Header title={t('profile.edit.title')} onBack={safeBack} showBack />
        <View className="flex-1 items-center justify-center">
          <Spinner />
        </View>
      </Screen>
    );
  }

  return (
    <Screen scroll glow padded={false}>
      <View className="px-5 pt-2">
        <Header title={t('profile.edit.title')} onBack={safeBack} showBack />

        {/* Avatar */}
        <Card className="mb-5 items-center">
          <Pressable
            onPress={pickAvatar}
            disabled={uploading}
            className="mb-3"
            accessibilityRole="button"
            accessibilityLabel={t('profile.edit.changeAvatar')}
          >
            <View
              className="w-28 h-28 rounded-full items-center justify-center overflow-hidden"
              style={{
                shadowColor: '#FF4D2E',
                shadowOpacity: 0.35,
                shadowRadius: 18,
                shadowOffset: { width: 0, height: 8 },
                elevation: 8,
                backgroundColor: '#FF4D2E',
              }}
            >
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={{ width: '100%', height: '100%' }} />
              ) : (
                <Text className="text-white text-4xl font-extrabold">{initials}</Text>
              )}
              <View className="absolute bottom-0 right-0 w-9 h-9 rounded-full bg-bg-raised border border-border items-center justify-center">
                <Icon name="camera" size={16} color="#F4F4F5" />
              </View>
            </View>
          </Pressable>
          <Text className="text-ink-subtle text-xs">
            {uploading ? t('profile.edit.uploading') : t('profile.edit.photo')}
          </Text>
          {avatarUrl ? (
            <Pressable onPress={removeAvatar} className="mt-2" accessibilityRole="button">
              <Text className="text-danger text-xs font-semibold">
                {t('profile.edit.removeAvatar')}
              </Text>
            </Pressable>
          ) : null}
          {uploadError ? <Text className="text-danger text-xs mt-2">{uploadError}</Text> : null}
        </Card>

        <Input
          label={t('profile.edit.displayName')}
          value={displayName}
          onChangeText={setDisplayName}
          placeholder={t('profile.edit.displayNamePlaceholder')}
          icon="user"
          maxLength={40}
        />
        <Input
          label={t('profile.edit.username')}
          value={username}
          onChangeText={(v) => setUsername(v.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
          placeholder={t('profile.edit.usernamePlaceholder')}
          icon="more"
          autoCapitalize="none"
          maxLength={20}
        />
        <Input
          label={t('profile.edit.bio')}
          value={bio}
          onChangeText={setBio}
          placeholder={t('profile.edit.bioPlaceholder')}
          icon="edit"
          maxLength={140}
        />

        <View className="flex-row" style={{ gap: 10 }}>
          <View className="flex-1">
            <Input
              label={t('profile.edit.height')}
              value={heightCm}
              onChangeText={setHeightCm}
              keyboardType="numeric"
              icon="ruler"
              trailing="cm"
            />
          </View>
          <View className="flex-1">
            <Input
              label={t('profile.edit.weight')}
              value={weightKg}
              onChangeText={setWeightKg}
              keyboardType="numeric"
              icon="scale"
              trailing="kg"
            />
          </View>
        </View>

        <View className="flex-row" style={{ gap: 10 }}>
          <View className="flex-1">
            <Input
              label={t('profile.edit.targetWeight')}
              value={targetWeightKg}
              onChangeText={setTargetWeightKg}
              keyboardType="numeric"
              icon="target"
              trailing="kg"
            />
          </View>
          <View className="flex-1">
            <Input
              label={t('profile.edit.trainingDays')}
              value={trainingDays}
              onChangeText={(v) => setTrainingDays(v.replace(/[^1-7]/g, '').slice(0, 1))}
              keyboardType="numeric"
              icon="calendar"
              trailing="/wk"
            />
          </View>
        </View>

        {update.isError ? (
          <View className="mb-3">
            <ErrorMessage error={update.error} />
          </View>
        ) : null}

        <View className="mt-2 mb-12" style={{ gap: 10 }}>
          <Button
            label={t('profile.edit.save')}
            icon="check"
            loading={update.isPending}
            onPress={onSave}
          />
          <Button label={t('common.cancel')} variant="secondary" onPress={safeBack} />
        </View>
      </View>
    </Screen>
  );
}
