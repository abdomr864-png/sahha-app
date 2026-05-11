/* eslint-disable max-lines -- Multi-step meal-parse flow; refactor tracked separately. */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Image, Pressable, Text, TextInput, View } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { Button, Card, Header, Icon, Screen, Spinner } from '@features/shared';
import { aiClient } from '@lib/llm';
import type { MealMacros } from '@lib/llm';
import { AIError } from '@lib/llm/client';
import { useEntitlement } from '@features/premium';
import { supabase } from '@lib/supabase/client';

const MEAL_BUCKET = 'meal-photos';
type Mode = 'photo' | 'text';

export function MealParseScreen() {
  const { t, i18n } = useTranslation();
  const [mode, setMode] = useState<Mode>('photo');
  const [text, setText] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [photoPath, setPhotoPath] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [result, setResult] = useState<MealMacros | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const ent = useEntitlement('ai_meal_parse');

  const isBlocked = ent.data && !ent.data.allowed;
  const locale = ((i18n.language as string | undefined) ?? 'en') as 'fr' | 'ar' | 'en';

  const reset = () => {
    setResult(null);
    setErrorCode(null);
    setPhotoPath(null);
    setSavedAt(null);
  };

  const pickFromLibrary = async () => {
    reset();
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        t('ai.meal.permissionTitle', 'Permission needed'),
        t('ai.meal.permissionBody', 'Allow photo library access to log meals from a picture.'),
      );
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
      allowsEditing: false,
    });
    if (!res.canceled && res.assets[0]) {
      setImageUri(res.assets[0].uri);
      setMode('photo');
    }
  };

  const takePhoto = async () => {
    reset();
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        t('ai.meal.permissionTitle', 'Permission needed'),
        t('ai.meal.cameraPermissionBody', 'Allow camera access to snap your meal.'),
      );
      return;
    }
    const res = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
      allowsEditing: false,
    });
    if (!res.canceled && res.assets[0]) {
      setImageUri(res.assets[0].uri);
      setMode('photo');
    }
  };

  const uploadAndParse = async () => {
    if (!imageUri) return;
    setUploading(true);
    setErrorCode(null);
    setResult(null);
    try {
      // Compress + resize before upload to keep token + storage costs sane.
      const compressed = await ImageManipulator.manipulateAsync(
        imageUri,
        [{ resize: { width: 1024 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG },
      );

      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new Error('unauthenticated');

      const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
      const res = await fetch(compressed.uri);
      const arrayBuffer = await res.arrayBuffer();
      const upload = await supabase.storage
        .from(MEAL_BUCKET)
        .upload(path, arrayBuffer, { contentType: 'image/jpeg', upsert: false });
      if (upload.error) throw upload.error;
      setPhotoPath(path);

      // Vision needs a fetchable URL. Bucket is private → signed URL valid 10 min.
      const signed = await supabase.storage.from(MEAL_BUCKET).createSignedUrl(path, 600);
      if (signed.error || !signed.data?.signedUrl) throw signed.error ?? new Error('no_url');

      setUploading(false);
      setParsing(true);
      const data = await aiClient.parseMeal(
        { image_url: signed.data.signedUrl, text: text.trim() || undefined },
        locale,
      );
      setResult(data);
    } catch (e) {
      setErrorCode(e instanceof AIError ? e.code : 'provider_error');
    } finally {
      setUploading(false);
      setParsing(false);
    }
  };

  const parseText = async () => {
    setParsing(true);
    setErrorCode(null);
    setResult(null);
    try {
      const data = await aiClient.parseMeal({ text: text.trim() }, locale);
      setResult(data);
    } catch (e) {
      setErrorCode(e instanceof AIError ? e.code : 'provider_error');
    } finally {
      setParsing(false);
    }
  };

  const saveToLog = async () => {
    if (!result || saving) return;
    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) {
        Alert.alert(
          t('ai.meal.signInTitle', 'Sign in required'),
          t('ai.meal.signInToSave', 'Sign in to save meals to your daily log.'),
        );
        return;
      }
      const { data: mealRow, error: mealErr } = await supabase
        .from('meals')
        .insert({
          user_id: userId,
          name: result.dish_name ?? null,
          meal_type: result.meal_type_guess ?? null,
          eaten_at: new Date().toISOString(),
          photo_url: photoPath,
          verdict: result.verdict ?? null,
          health_score: result.health_score ?? null,
          ai_summary: result.summary ?? null,
        })
        .select('id')
        .single();
      if (mealErr || !mealRow) throw mealErr ?? new Error('meal_insert_failed');

      if (result.items.length > 0) {
        const { error: itemsErr } = await supabase.from('meal_items').insert(
          result.items.map((it) => ({
            meal_id: mealRow.id,
            custom_name: it.name,
            calories: it.calories,
            protein_g: it.protein_g,
            carbs_g: it.carbs_g,
            fat_g: it.fat_g,
            quantity_g: it.quantity_g,
          })),
        );
        if (itemsErr) throw itemsErr;
      }
      setSavedAt(new Date());
    } catch (e) {
      Alert.alert(
        t('ai.meal.saveFailedTitle', 'Save failed'),
        (e as Error).message ?? t('ai.meal.saveFailedBody', "Couldn't save the meal. Try again."),
      );
    } finally {
      setSaving(false);
    }
  };

  const updateItem = (i: number, patch: Partial<MealMacros['items'][number]>) => {
    if (!result) return;
    const items = result.items.map((it, idx) => (idx === i ? { ...it, ...patch } : it));
    const total = items.reduce(
      (s, it) => ({
        calories: s.calories + it.calories,
        protein_g: s.protein_g + it.protein_g,
        carbs_g: s.carbs_g + it.carbs_g,
        fat_g: s.fat_g + it.fat_g,
        fiber_g: (s.fiber_g ?? 0) + (it.fiber_g ?? 0),
        sugar_g: (s.sugar_g ?? 0) + (it.sugar_g ?? 0),
        sodium_mg: (s.sodium_mg ?? 0) + (it.sodium_mg ?? 0),
      }),
      { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0, sugar_g: 0, sodium_mg: 0 },
    );
    setResult({ ...result, items, total });
  };

  const busy = uploading || parsing;

  return (
    <Screen scroll>
      <Header title={t('ai.meal.title', 'AI Meal Coach')} showBack />

      {isBlocked ? (
        <Card tone="raised" className="mb-4">
          <Text className="text-ink font-semibold mb-1">
            {ent.data?.reason === 'premium_only'
              ? t('premium.required', 'Premium required')
              : t('premium.dailyLimit', 'Daily limit reached')}
          </Text>
          <Text className="text-ink-subtle text-sm">
            {t('ai.meal.upgradeHint', 'Upgrade to log unlimited meals with AI vision.')}
          </Text>
        </Card>
      ) : null}

      {/* Mode toggle */}
      <View className="flex-row mb-4 bg-bg-subtle rounded-2xl border border-border p-1">
        <ModeTab
          icon="camera"
          label={t('ai.meal.photo', 'Photo')}
          active={mode === 'photo'}
          onPress={() => setMode('photo')}
        />
        <ModeTab
          icon="edit"
          label={t('ai.meal.describe', 'Describe')}
          active={mode === 'text'}
          onPress={() => setMode('text')}
        />
      </View>

      {mode === 'photo' ? (
        <View className="mb-4">
          {imageUri ? (
            <View className="rounded-3xl overflow-hidden border border-border bg-bg-raised mb-3">
              <Image source={{ uri: imageUri }} style={{ width: '100%', aspectRatio: 1 }} />
              <Pressable
                onPress={() => {
                  setImageUri(null);
                  reset();
                }}
                className="absolute top-3 right-3 w-9 h-9 rounded-full bg-bg/80 items-center justify-center"
              >
                <Icon name="x" size={18} color="#F4F4F5" />
              </Pressable>
            </View>
          ) : (
            <View
              className="rounded-3xl border-2 border-dashed border-border bg-bg-subtle items-center justify-center mb-3"
              style={{ aspectRatio: 1.4 }}
            >
              <View className="w-14 h-14 rounded-2xl bg-accent/15 border border-accent/40 items-center justify-center mb-3">
                <Icon name="camera" size={26} color="#FF4D2E" />
              </View>
              <Text className="text-ink font-bold text-base">
                {t('ai.meal.snapTitle', 'Snap your meal')}
              </Text>
              <Text className="text-ink-subtle text-xs mt-1 px-6 text-center">
                {t(
                  'ai.meal.snapBody',
                  'AI will identify foods, estimate portions, and tell you if it fits your goal.',
                )}
              </Text>
            </View>
          )}

          <View className="flex-row" style={{ gap: 10 }}>
            <View className="flex-1">
              <Button
                label={t('ai.meal.take', 'Camera')}
                icon="camera"
                onPress={takePhoto}
                disabled={busy || !!isBlocked}
              />
            </View>
            <View className="flex-1">
              <Button
                label={t('ai.meal.upload', 'Gallery')}
                icon="image"
                variant="secondary"
                onPress={pickFromLibrary}
                disabled={busy || !!isBlocked}
              />
            </View>
          </View>

          {imageUri ? (
            <>
              <View className="h-3" />
              <View className="bg-bg-raised border border-border rounded-2xl px-4 py-3 mb-3">
                <Text className="text-ink-muted text-[10px] font-bold mb-2 uppercase tracking-widest">
                  {t('ai.meal.optionalNote', 'Optional note')}
                </Text>
                <TextInput
                  value={text}
                  onChangeText={setText}
                  placeholder={t('ai.meal.notePlaceholder', 'e.g. portion was small, no oil')}
                  placeholderTextColor="#A1A1AA"
                  className="text-ink text-base"
                  multiline
                  style={{ minHeight: 44 }}
                />
              </View>
              <Button
                label={t('ai.meal.analyze', 'Analyze with AI')}
                icon="sparkles"
                loading={busy}
                disabled={busy || !!isBlocked}
                onPress={uploadAndParse}
              />
            </>
          ) : null}
        </View>
      ) : (
        <View className="mb-4">
          <View className="bg-bg-raised border border-border rounded-2xl px-4 py-3 mb-3">
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder={t(
                'ai.meal.placeholder',
                'e.g. 2 eggs, 1 banana and oatmeal with berries',
              )}
              placeholderTextColor="#A1A1AA"
              className="text-ink text-base"
              multiline
              style={{ minHeight: 100 }}
            />
          </View>
          <Button
            label={t('ai.meal.parse', 'Analyze meal')}
            icon="sparkles"
            loading={busy}
            disabled={!text.trim() || busy || !!isBlocked}
            onPress={parseText}
          />
        </View>
      )}

      {busy ? (
        <View className="items-center my-6">
          <Spinner />
          <Text className="text-ink-subtle text-sm mt-3">
            {uploading
              ? t('ai.meal.uploading', 'Uploading photo…')
              : t('ai.meal.analyzing', 'Analyzing nutrition…')}
          </Text>
        </View>
      ) : null}

      {errorCode ? (
        <View className="mt-3 p-3 rounded-2xl bg-bg-raised border border-danger flex-row items-center">
          <Icon name="alert" size={18} color="#F87171" />
          <Text className="text-danger text-sm ml-2 flex-1">
            {t(`errors.ai.${errorCode}`, errorCode)}
          </Text>
        </View>
      ) : null}

      {result ? (
        <ResultView
          result={result}
          onUpdate={updateItem}
          onSave={saveToLog}
          saving={saving}
          saved={!!savedAt}
        />
      ) : null}
    </Screen>
  );
}

function ModeTab({
  icon,
  label,
  active,
  onPress,
}: {
  icon: 'camera' | 'edit';
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`flex-1 flex-row items-center justify-center py-2.5 rounded-xl ${
        active ? 'bg-bg-raised border border-border' : ''
      }`}
    >
      <Icon name={icon} size={16} color={active ? '#FF4D2E' : '#A1A1AA'} />
      <Text className={`ml-2 text-sm font-bold ${active ? 'text-ink' : 'text-ink-subtle'}`}>
        {label}
      </Text>
    </Pressable>
  );
}

function ResultView({
  result,
  onUpdate,
  onSave,
  saving,
  saved,
}: {
  result: MealMacros;
  onUpdate: (i: number, patch: Partial<MealMacros['items'][number]>) => void;
  onSave: () => void;
  saving: boolean;
  saved: boolean;
}) {
  const { t } = useTranslation();
  const verdict = result.verdict ?? 'ok';
  const score = result.health_score ?? 0;

  const verdictMeta: Record<
    'good' | 'ok' | 'bad',
    { label: string; bg: string; border: string; text: string; emoji: string }
  > = {
    good: {
      label: t('ai.meal.verdictGood', 'Great choice'),
      bg: 'bg-emerald-900/30',
      border: 'border-emerald-500/40',
      text: 'text-emerald-300',
      emoji: '✓',
    },
    ok: {
      label: t('ai.meal.verdictOk', 'Decent'),
      bg: 'bg-amber-900/30',
      border: 'border-amber-500/40',
      text: 'text-amber-300',
      emoji: '~',
    },
    bad: {
      label: t('ai.meal.verdictBad', 'Could be better'),
      bg: 'bg-rose-900/30',
      border: 'border-rose-500/40',
      text: 'text-rose-300',
      emoji: '!',
    },
  };
  const v = verdictMeta[verdict];

  return (
    <View className="mt-6">
      {/* AI Verdict hero */}
      <View className={`rounded-3xl border ${v.border} ${v.bg} p-5 mb-4`}>
        <View className="flex-row items-center justify-between mb-3">
          <View className="flex-row items-center">
            <View
              className={`w-10 h-10 rounded-2xl items-center justify-center border ${v.border}`}
            >
              <Text className={`${v.text} font-extrabold text-lg`}>{v.emoji}</Text>
            </View>
            <View className="ml-3">
              <Text className="text-ink-muted text-[10px] font-bold tracking-widest">
                {t('ai.meal.aiVerdict', 'AI VERDICT')}
              </Text>
              <Text className={`${v.text} text-lg font-extrabold mt-0.5`}>{v.label}</Text>
            </View>
          </View>
          {score ? (
            <View className="items-end">
              <Text className="text-ink-muted text-[10px] font-bold tracking-widest">
                {t('ai.meal.health', 'HEALTH')}
              </Text>
              <Text className="text-ink text-2xl font-extrabold">
                {score}
                <Text className="text-ink-muted text-sm font-bold">/10</Text>
              </Text>
            </View>
          ) : null}
        </View>
        {result.summary ? (
          <Text className="text-ink text-sm leading-5">{result.summary}</Text>
        ) : null}
      </View>

      {/* Dish header — name + cuisine tag */}
      {result.dish_name || result.cuisine ? (
        <View className="mb-4">
          {result.dish_name ? (
            <Text className="text-ink text-2xl font-extrabold leading-7">{result.dish_name}</Text>
          ) : null}
          {result.cuisine ? (
            <View className="flex-row mt-2">
              <View className="bg-bg-raised border border-border rounded-full px-3 py-1">
                <Text className="text-ink-subtle text-[11px] font-bold uppercase tracking-wider">
                  {result.cuisine}
                </Text>
              </View>
            </View>
          ) : null}
        </View>
      ) : null}

      {/* Macro ring + breakdown */}
      <MacroRing total={result.total} />

      {/* Detailed macro tiles */}
      <View className="flex-row mt-4 mb-2" style={{ gap: 8 }}>
        <MacroTile label="kcal" value={Math.round(result.total.calories)} accent />
        <MacroTile label="P" value={`${Math.round(result.total.protein_g)}g`} color="#34D399" />
        <MacroTile label="C" value={`${Math.round(result.total.carbs_g)}g`} color="#60A5FA" />
        <MacroTile label="F" value={`${Math.round(result.total.fat_g)}g`} color="#FBBF24" />
      </View>

      {(result.total.fiber_g != null ||
        result.total.sugar_g != null ||
        result.total.sodium_mg != null) && (
        <View className="flex-row mb-4" style={{ gap: 8 }}>
          {result.total.fiber_g != null ? (
            <MicroTile
              icon="leaf"
              label={t('ai.meal.fiber')}
              value={`${Math.round(result.total.fiber_g)}g`}
            />
          ) : null}
          {result.total.sugar_g != null ? (
            <MicroTile
              icon="apple"
              label={t('ai.meal.sugar')}
              value={`${Math.round(result.total.sugar_g)}g`}
            />
          ) : null}
          {result.total.sodium_mg != null ? (
            <MicroTile
              icon="droplet"
              label={t('ai.meal.sodium')}
              value={`${Math.round(result.total.sodium_mg)}mg`}
            />
          ) : null}
        </View>
      )}

      {/* Notes */}
      {result.notes && result.notes.length > 0 ? (
        <Card className="mb-3">
          <View className="flex-row items-center mb-2">
            <Icon name="check-circle" size={16} color="#34D399" />
            <Text className="text-emerald-300 font-bold ml-2">
              {t('ai.meal.whyItWorks', 'Why this works')}
            </Text>
          </View>
          {result.notes.map((n, i) => (
            <Text key={i} className="text-ink text-sm leading-5 mb-1">
              • {n}
            </Text>
          ))}
        </Card>
      ) : null}

      {/* Warnings */}
      {result.warnings && result.warnings.length > 0 ? (
        <Card className="mb-3" tone="raised">
          <View className="flex-row items-center mb-2">
            <Icon name="alert" size={16} color="#FBBF24" />
            <Text className="text-amber-300 font-bold ml-2">
              {t('ai.meal.watchOut', 'Watch out')}
            </Text>
          </View>
          {result.warnings.map((w, i) => (
            <Text key={i} className="text-ink text-sm leading-5 mb-1">
              • {w}
            </Text>
          ))}
        </Card>
      ) : null}

      {/* Per-ingredient breakdown */}
      <Text className="text-ink-muted text-[10px] font-bold mb-2 uppercase tracking-widest">
        {t('ai.meal.ingredients', 'Ingredients')} · {result.items.length}
      </Text>
      {result.items.map((item, i) => {
        const totalCal = result.items.reduce((s, it) => s + it.calories, 0) || 1;
        const pct = Math.round((item.calories / totalCal) * 100);
        return (
          <View key={i} className="bg-bg-raised border border-border rounded-2xl p-4 mb-2">
            <View className="flex-row items-center justify-between mb-2">
              <View className="flex-1 mr-2">
                <Text className="text-ink font-semibold">{item.name}</Text>
                {item.detail ? (
                  <Text className="text-ink-subtle text-xs mt-0.5">{item.detail}</Text>
                ) : null}
              </View>
              <View
                className={`px-2 py-0.5 rounded-md ${
                  item.confidence === 'high'
                    ? 'bg-emerald-900/40'
                    : item.confidence === 'medium'
                      ? 'bg-amber-900/40'
                      : 'bg-rose-900/40'
                }`}
              >
                <Text className="text-[10px] font-bold text-ink uppercase">{item.confidence}</Text>
              </View>
            </View>

            {/* Cooking method + share-of-meal pill row */}
            <View className="flex-row mb-3" style={{ gap: 6 }}>
              {item.cooking_method && item.cooking_method !== 'unknown' ? (
                <View className="bg-bg-subtle border border-border rounded-full px-2.5 py-1 flex-row items-center">
                  <Icon name={cookingIcon(item.cooking_method)} size={11} color="#A1A1AA" />
                  <Text className="text-ink-subtle text-[10px] font-bold uppercase ml-1">
                    {item.cooking_method.replace('_', ' ')}
                  </Text>
                </View>
              ) : null}
              <View className="bg-accent/10 border border-accent/30 rounded-full px-2.5 py-1">
                <Text className="text-accent text-[10px] font-bold">
                  {t('ai.meal.shareOfMeal', { pct })}
                </Text>
              </View>
            </View>

            <View className="flex-row" style={{ gap: 8 }}>
              <NumField
                label="g"
                value={item.quantity_g}
                onChange={(v) => onUpdate(i, { quantity_g: v })}
              />
              <NumField
                label="kcal"
                value={item.calories}
                onChange={(v) => onUpdate(i, { calories: v })}
              />
              <NumField
                label="P"
                value={item.protein_g}
                onChange={(v) => onUpdate(i, { protein_g: v })}
              />
              <NumField
                label="C"
                value={item.carbs_g}
                onChange={(v) => onUpdate(i, { carbs_g: v })}
              />
              <NumField label="F" value={item.fat_g} onChange={(v) => onUpdate(i, { fat_g: v })} />
            </View>
          </View>
        );
      })}

      <View className="h-3" />
      <Button
        label={saved ? t('ai.meal.saved', 'Saved to log ✓') : t('ai.meal.save', 'Save to log')}
        icon={saved ? 'check-circle' : 'check'}
        loading={saving}
        disabled={saving || saved}
        onPress={onSave}
      />
      <View style={{ height: 60 }} />
    </View>
  );
}

function MacroTile({
  label,
  value,
  color,
  accent,
}: {
  label: string;
  value: number | string;
  color?: string;
  accent?: boolean;
}) {
  return (
    <View
      className={`flex-1 rounded-2xl border p-3 ${
        accent ? 'bg-accent/10 border-accent/40' : 'bg-bg-raised border-border'
      }`}
    >
      <Text
        className="text-[10px] font-bold tracking-widest"
        style={{ color: color ?? (accent ? '#FF4D2E' : '#A1A1AA') }}
      >
        {label.toUpperCase()}
      </Text>
      <Text className="text-ink text-lg font-extrabold mt-1">{value}</Text>
    </View>
  );
}

function MicroTile({
  icon,
  label,
  value,
}: {
  icon: 'leaf' | 'apple' | 'droplet';
  label: string;
  value: string;
}) {
  return (
    <View className="flex-1 bg-bg-subtle border border-border rounded-2xl p-3 flex-row items-center">
      <Icon name={icon} size={16} color="#A1A1AA" />
      <View className="ml-2">
        <Text className="text-ink-muted text-[10px] font-bold uppercase">{label}</Text>
        <Text className="text-ink text-sm font-bold">{value}</Text>
      </View>
    </View>
  );
}

function NumField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <View className="flex-1">
      <Text className="text-ink-muted text-[9px] mb-1 uppercase">{label}</Text>
      <TextInput
        value={String(Math.round(value))}
        onChangeText={(t) => onChange(Number(t.replace(/[^\d.]/g, '')) || 0)}
        keyboardType="numeric"
        className="text-ink text-sm bg-bg border border-border rounded-lg px-2 py-1"
      />
    </View>
  );
}

// Macro distribution ring. Shows P/C/F split by calorie share around a kcal total.
function MacroRing({ total }: { total: MealMacros['total'] }) {
  const { t } = useTranslation();
  const proteinKcal = total.protein_g * 4;
  const carbsKcal = total.carbs_g * 4;
  const fatKcal = total.fat_g * 9;
  const sum = Math.max(1, proteinKcal + carbsKcal + fatKcal);

  const proteinPct = proteinKcal / sum;
  const carbsPct = carbsKcal / sum;
  const fatPct = fatKcal / sum;

  const SIZE = 160;
  const STROKE = 14;
  const r = (SIZE - STROKE) / 2;
  const c = 2 * Math.PI * r;

  // Build dasharray segments (length, gap, length, gap…) so each color paints
  // its slice of the circumference. Each segment starts at the previous offset.
  const segments = [
    { color: '#34D399', frac: proteinPct, label: 'P', grams: total.protein_g },
    { color: '#60A5FA', frac: carbsPct, label: 'C', grams: total.carbs_g },
    { color: '#FBBF24', frac: fatPct, label: 'F', grams: total.fat_g },
  ];

  let offset = 0;

  return (
    <View className="bg-bg-raised border border-border rounded-3xl p-5 flex-row items-center">
      <Svg width={SIZE} height={SIZE}>
        <G rotation={-90} originX={SIZE / 2} originY={SIZE / 2}>
          {/* Track */}
          <Circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={r}
            stroke="#27272A"
            strokeWidth={STROKE}
            fill="transparent"
          />
          {segments.map((seg, i) => {
            const len = seg.frac * c;
            const dash = `${len} ${c - len}`;
            const slice = (
              <Circle
                key={i}
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={r}
                stroke={seg.color}
                strokeWidth={STROKE}
                strokeDasharray={dash}
                strokeDashoffset={-offset}
                fill="transparent"
                strokeLinecap="butt"
              />
            );
            offset += len;
            return slice;
          })}
        </G>
      </Svg>
      <View className="ml-5 flex-1">
        <Text className="text-ink-muted text-[10px] font-bold tracking-widest uppercase">
          {t('ai.meal.totalLabel')}
        </Text>
        <Text className="text-ink text-3xl font-extrabold leading-9">
          {Math.round(total.calories)}
          <Text className="text-ink-muted text-base font-bold"> kcal</Text>
        </Text>
        <View className="mt-3" style={{ gap: 6 }}>
          {segments.map((seg, i) => (
            <View key={i} className="flex-row items-center">
              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: seg.color,
                  marginRight: 8,
                }}
              />
              <Text className="text-ink text-xs font-bold">{Math.round(seg.frac * 100)}%</Text>
              <Text className="text-ink-subtle text-xs ml-2">
                {Math.round(seg.grams)}g{' '}
                {seg.label === 'P'
                  ? t('ai.meal.macroProtein')
                  : seg.label === 'C'
                    ? t('ai.meal.macroCarbs')
                    : t('ai.meal.macroFat')}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

function cookingIcon(method: string): 'flame' | 'leaf' | 'droplet' | 'flask' {
  switch (method) {
    case 'grilled':
    case 'roasted':
    case 'baked':
    case 'fried':
    case 'deep_fried':
    case 'sauteed':
    case 'smoked':
      return 'flame';
    case 'raw':
      return 'leaf';
    case 'boiled':
    case 'steamed':
    case 'braised':
      return 'droplet';
    default:
      return 'flask';
  }
}
