import { useState } from 'react';
import { Alert, Image, Pressable, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as ImagePicker from 'expo-image-picker';
import { Button, Header, Icon, Screen } from '@features/shared';
import { communityRepo, useCommunityStore } from '@features/community';
import { useSession } from '@features/auth';

export default function CreatePost() {
  const { t } = useTranslation();
  const router = useRouter();
  const { session } = useSession();
  const userId = session?.user?.id;
  const refresh = useCommunityStore((s) => s.refresh);

  const [content, setContent] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(t('createPost.permTitle'), t('createPost.permBody'));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: false,
    });
    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
    }
  };

  const submit = async () => {
    if (!userId) return;
    if (!content.trim() && !imageUri) return;
    setSubmitting(true);
    try {
      await communityRepo.createPost({ userId, content, imageUri });
      await refresh(userId);
      router.back();
    } catch (e) {
      Alert.alert(t('common.error'), (e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = (content.trim().length > 0 || !!imageUri) && !submitting;

  return (
    <Screen>
      <Header title={t('createPost.title')} showBack />
      <View className="flex-1">
        <TextInput
          value={content}
          onChangeText={setContent}
          placeholder={t('createPost.placeholder')}
          placeholderTextColor="#B4B4C2"
          multiline
          maxLength={2000}
          className="text-ink text-base bg-bg-raised border border-border rounded-2xl p-4 min-h-[140px]"
          style={{ textAlignVertical: 'top' }}
        />

        {imageUri ? (
          <View className="mt-4 rounded-2xl overflow-hidden border border-border relative">
            <Image source={{ uri: imageUri }} style={{ width: '100%', aspectRatio: 1 }} />
            <Pressable
              onPress={() => setImageUri(null)}
              className="absolute top-3 right-3 w-9 h-9 rounded-full bg-black/70 items-center justify-center"
            >
              <Icon name="x" size={18} />
            </Pressable>
          </View>
        ) : (
          <Pressable
            onPress={pickImage}
            className="mt-4 flex-row items-center justify-center py-4 rounded-2xl bg-bg-raised border border-dashed border-border"
          >
            <Icon name="image" size={20} />
            <Text className="text-ink ml-2 font-semibold">{t('createPost.addPhoto')}</Text>
          </Pressable>
        )}

        <View className="flex-1" />

        <Button
          label={submitting ? t('createPost.posting') : t('createPost.publish')}
          onPress={submit}
          disabled={!canSubmit}
          loading={submitting}
          icon="send"
        />
      </View>
    </Screen>
  );
}
