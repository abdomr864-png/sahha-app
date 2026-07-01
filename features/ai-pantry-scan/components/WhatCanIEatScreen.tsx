/* eslint-disable max-lines -- Self-contained 3-step flow (scan -> confirm -> suggest). */
import { useMemo, useState } from 'react';
import {
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { Button, Card, Header, Icon, Screen, Spinner } from '@features/shared';
import { EntitlementGate, useEntitlement } from '@features/premium';
import { aiClient, AIError } from '@lib/llm';
import type { Locale, MealSuggestion, MealSuggestionsResponse, PantryScanItem } from '@lib/llm';
import { supabase } from '@lib/supabase/client';
import { uuidV4 as uuid } from '@lib/ids';
import {
  logSuggestionAsMeal,
  savePantry,
  uploadPantryImages,
  type PantryRow,
} from '../repositories/pantry';
import { usePantry } from '../hooks/usePantry';
import { useFoodSearch, foodDisplayName, type FoodSearchRow } from '../hooks/useFoodSearch';
import { useRemainingMacros } from '../hooks/useRemainingMacros';
import { loadLastSuggestions, saveLastSuggestions } from '../store';
import type { PantryUIItem, Step } from '../types';

const MAX_IMAGES = 4;

function scanItemToUI(it: PantryScanItem): PantryUIItem {
  return {
    key: uuid(),
    name: it.name,
    foodDbId: it.food_db_id,
    quantity: it.quantity,
    unit: it.unit ?? 'g',
    confidence: it.confidence,
    source: 'scan',
  };
}

function pantryRowToUI(r: PantryRow): PantryUIItem {
  return {
    key: r.id,
    name: r.name,
    foodDbId: r.food_db_id,
    quantity: r.quantity,
    unit: r.unit ?? 'g',
    confidence: r.confidence,
    source: r.source,
  };
}

export function WhatCanIEatScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const locale = ((i18n.language as string | undefined) ?? 'en') as Locale;
  const ent = useEntitlement('pantry_scan');

  return (
    <Screen scroll glow>
      <Header title={t('pantry.title', 'What can I eat?')} showBack />
      <EntitlementGate feature="pantry_scan" onUpgrade={() => router.push('/paywall')}>
        <Flow t={t} locale={locale} blocked={!!ent.data && !ent.data.allowed} />
      </EntitlementGate>
    </Screen>
  );
}

function Flow({
  t,
  locale,
  blocked,
}: {
  t: ReturnType<typeof useTranslation>['t'];
  locale: Locale;
  blocked: boolean;
}) {
  const qc = useQueryClient();
  const router = useRouter();
  const pantry = usePantry();
  const macros = useRemainingMacros();

  const [step, setStep] = useState<Step>('scan');
  const [imageUris, setImageUris] = useState<string[]>([]);
  const [scanning, setScanning] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [items, setItems] = useState<PantryUIItem[]>([]);
  const [result, setResult] = useState<MealSuggestionsResponse | null>(null);
  const [ramadan, setRamadan] = useState(false);
  const [loggedTitles, setLoggedTitles] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState<{ mode: 'add' } | { mode: 'map'; key: string } | null>(null);

  const lastSuggestions = useMemo(() => loadLastSuggestions(), []);

  // ---- helpers -------------------------------------------------------------
  const resetToScan = () => {
    setStep('scan');
    setImageUris([]);
    setItems([]);
    setResult(null);
    setErrorCode(null);
    setLoggedTitles(new Set());
  };

  const pickImages = async (fromCamera: boolean) => {
    setErrorCode(null);
    const perm = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        t('pantry.permissionTitle', 'Permission needed'),
        t('pantry.permissionBody', 'Allow camera / photo access to scan your ingredients.'),
      );
      return;
    }
    const res = fromCamera
      ? await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.85,
        })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.85,
          allowsMultipleSelection: true,
          selectionLimit: MAX_IMAGES,
        });
    if (res.canceled) return;
    const uris = res.assets.map((a) => a.uri);
    setImageUris((prev) => [...prev, ...uris].slice(0, MAX_IMAGES));
  };

  const analyze = async () => {
    if (imageUris.length === 0) return;
    setScanning(true);
    setErrorCode(null);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new AIError('unauthenticated', 401);

      // Compress + resize each photo before upload (token + storage cost).
      const compressed: string[] = [];
      for (const uri of imageUris) {
        const c = await ImageManipulator.manipulateAsync(uri, [{ resize: { width: 1024 } }], {
          compress: 0.7,
          format: ImageManipulator.SaveFormat.JPEG,
        });
        compressed.push(c.uri);
      }
      const signedUrls = await uploadPantryImages(userId, compressed);
      const scan = await aiClient.scanPantry({ image_urls: signedUrls, locale });

      if (scan.items.length === 0) {
        // Offline stub or nothing recognised — fall back to the saved pantry so
        // the user can still edit/add manually.
        setItems((pantry.data ?? []).map(pantryRowToUI));
        setErrorCode('needs_connection');
        setStep('confirm');
        return;
      }
      setItems(scan.items.map(scanItemToUI));
      setStep('confirm');
    } catch (e) {
      const code = e instanceof AIError ? e.code : 'provider_error';
      if (code === 'no_food_detected') {
        setErrorCode('no_food_detected');
      } else {
        // Network / provider issue — let them work from the saved pantry.
        setErrorCode('needs_connection');
        if ((pantry.data ?? []).length > 0) {
          setItems((pantry.data ?? []).map(pantryRowToUI));
          setStep('confirm');
        }
      }
    } finally {
      setScanning(false);
    }
  };

  const useSavedPantry = () => {
    setItems((pantry.data ?? []).map(pantryRowToUI));
    setErrorCode(null);
    setStep('confirm');
  };

  const updateItem = (key: string, patch: Partial<PantryUIItem>) =>
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, ...patch } : it)));
  const removeItem = (key: string) => setItems((prev) => prev.filter((it) => it.key !== key));

  const onPickFood = (food: FoodSearchRow) => {
    const name = foodDisplayName(food, locale);
    if (search?.mode === 'map') {
      updateItem(search.key, { name, foodDbId: food.id });
    } else {
      setItems((prev) => [
        ...prev,
        {
          key: uuid(),
          name,
          foodDbId: food.id,
          quantity: 100,
          unit: 'g',
          confidence: null,
          source: 'manual',
        },
      ]);
    }
    setSearch(null);
  };

  const matchedItems = useMemo(() => items.filter((i) => i.foodDbId), [items]);

  const suggest = async () => {
    if (matchedItems.length === 0) {
      Alert.alert(
        t('pantry.needIngredientTitle', 'Add an ingredient'),
        t(
          'pantry.needIngredientBody',
          'Add at least one recognised ingredient to get suggestions.',
        ),
      );
      return;
    }
    setSuggesting(true);
    setErrorCode(null);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      // Persist the confirmed pantry (best-effort) so it's there next time / offline.
      if (userId) {
        try {
          await savePantry(userId, items);
          void qc.invalidateQueries({ queryKey: ['pantry-items'] });
        } catch {
          /* non-fatal */
        }
      }
      const res = await aiClient.suggestMeals({
        confirmed_food_db_ids: matchedItems.map((i) => i.foodDbId!) as string[],
        remaining_macros: macros.remaining,
        locale,
        ramadan_mode: ramadan,
      });
      if (res.suggestions.length === 0) {
        // Offline stub / nothing usable — show last suggestions if we have them.
        if (lastSuggestions && lastSuggestions.suggestions.length > 0) {
          setResult(lastSuggestions);
          setErrorCode('needs_connection');
          setStep('suggest');
          return;
        }
        setErrorCode('no_suggestions');
        setResult({ suggestions: [], best_is_weak: true });
        setStep('suggest');
        return;
      }
      saveLastSuggestions(res);
      setResult(res);
      setStep('suggest');
    } catch (e) {
      const code = e instanceof AIError ? e.code : 'provider_error';
      if (lastSuggestions && lastSuggestions.suggestions.length > 0) {
        setResult(lastSuggestions);
        setErrorCode('needs_connection');
        setStep('suggest');
      } else {
        setErrorCode(code);
      }
    } finally {
      setSuggesting(false);
    }
  };

  const logMeal = async (s: MealSuggestion) => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) {
        Alert.alert(
          t('pantry.signInTitle', 'Sign in required'),
          t('pantry.signInBody', 'Sign in to log meals to your daily total.'),
        );
        return;
      }
      await logSuggestionAsMeal(userId, s);
      setLoggedTitles((prev) => new Set(prev).add(s.title));
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['today-nutrition'] }),
        qc.invalidateQueries({ queryKey: ['activity-calendar'] }),
        qc.invalidateQueries({ queryKey: ['meal-history'] }),
      ]);
    } catch (e) {
      Alert.alert(
        t('pantry.logFailedTitle', 'Could not log'),
        (e as Error).message ?? t('pantry.logFailedBody', 'Try again.'),
      );
    }
  };

  // ---- render --------------------------------------------------------------
  return (
    <View>
      {blocked ? null : <StepHeader t={t} step={step} />}

      {step === 'scan' ? (
        <ScanStep
          t={t}
          imageUris={imageUris}
          scanning={scanning}
          errorCode={errorCode}
          onPick={pickImages}
          onRemoveImage={(i) => setImageUris((prev) => prev.filter((_, idx) => idx !== i))}
          onAnalyze={analyze}
          savedPantryCount={(pantry.data ?? []).length}
          onUseSavedPantry={useSavedPantry}
          hasLastSuggestions={!!lastSuggestions && lastSuggestions.suggestions.length > 0}
          onViewLast={() => {
            if (lastSuggestions) {
              setResult(lastSuggestions);
              setStep('suggest');
            }
          }}
        />
      ) : null}

      {step === 'confirm' ? (
        <ConfirmStep
          t={t}
          items={items}
          errorCode={errorCode}
          suggesting={suggesting}
          onUpdate={updateItem}
          onRemove={removeItem}
          onAdd={() => setSearch({ mode: 'add' })}
          onMap={(key) => setSearch({ mode: 'map', key })}
          onBack={resetToScan}
          onContinue={suggest}
        />
      ) : null}

      {step === 'suggest' ? (
        <SuggestStep
          t={t}
          macros={macros}
          result={result}
          errorCode={errorCode}
          loggedTitles={loggedTitles}
          ramadan={ramadan}
          onToggleRamadan={setRamadan}
          onLog={logMeal}
          onRescan={resetToScan}
          onEdit={() => setStep('confirm')}
          onSetGoal={() => router.push('/edit-profile')}
        />
      ) : null}

      <FoodSearchModal
        t={t}
        locale={locale}
        visible={!!search}
        onClose={() => setSearch(null)}
        onPick={onPickFood}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
function StepHeader({ t, step }: { t: ReturnType<typeof useTranslation>['t']; step: Step }) {
  const steps: { key: Step; label: string }[] = [
    { key: 'scan', label: t('pantry.stepScan', 'Scan') },
    { key: 'confirm', label: t('pantry.stepConfirm', 'Confirm') },
    { key: 'suggest', label: t('pantry.stepSuggest', 'Suggest') },
  ];
  const activeIdx = steps.findIndex((s) => s.key === step);
  return (
    <View className="flex-row mb-4" style={{ gap: 8 }}>
      {steps.map((s, i) => (
        <View key={s.key} className="flex-1 items-center">
          <View
            className={`w-full h-1 rounded-full mb-1.5 ${i <= activeIdx ? 'bg-accent' : 'bg-bg-subtle'}`}
          />
          <Text
            className={`text-[10px] font-bold uppercase tracking-wider ${
              i === activeIdx ? 'text-accent' : 'text-ink-muted'
            }`}
          >
            {s.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
function ScanStep({
  t,
  imageUris,
  scanning,
  errorCode,
  onPick,
  onRemoveImage,
  onAnalyze,
  savedPantryCount,
  onUseSavedPantry,
  hasLastSuggestions,
  onViewLast,
}: {
  t: ReturnType<typeof useTranslation>['t'];
  imageUris: string[];
  scanning: boolean;
  errorCode: string | null;
  onPick: (fromCamera: boolean) => void;
  onRemoveImage: (i: number) => void;
  onAnalyze: () => void;
  savedPantryCount: number;
  onUseSavedPantry: () => void;
  hasLastSuggestions: boolean;
  onViewLast: () => void;
}) {
  return (
    <View>
      <Card tone="raised" className="mb-4">
        <View className="items-center py-4">
          <View className="w-20 h-20 rounded-3xl bg-accent/10 border border-accent/40 items-center justify-center">
            <Icon name="camera" size={28} color="#FF4D2E" />
          </View>
          <Text className="text-ink font-extrabold text-xl mt-3">
            {t('pantry.scanTitle', 'Scan your ingredients')}
          </Text>
          <Text className="text-ink-subtle text-sm mt-1.5 text-center leading-5 px-2">
            {t(
              'pantry.scanBody',
              'Snap your fridge or pantry. We suggest meals that fill the macros you have left today.',
            )}
          </Text>
        </View>
      </Card>

      {imageUris.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-3">
          <View className="flex-row" style={{ gap: 8 }}>
            {imageUris.map((uri, i) => (
              <View
                key={`${uri}-${i}`}
                className="rounded-2xl overflow-hidden border border-border"
              >
                <Image source={{ uri }} style={{ width: 96, height: 96 }} />
                {!scanning ? (
                  <Pressable
                    onPress={() => onRemoveImage(i)}
                    className="absolute top-1 right-1 w-6 h-6 rounded-full bg-bg/80 items-center justify-center"
                  >
                    <Icon name="x" size={13} color="#F4F4F7" />
                  </Pressable>
                ) : null}
              </View>
            ))}
          </View>
        </ScrollView>
      ) : null}

      {scanning ? (
        <View className="items-center my-6">
          <Spinner />
          <Text className="text-ink-subtle text-sm mt-3">
            {t('pantry.analyzing', 'Reading your ingredients…')}
          </Text>
        </View>
      ) : (
        <>
          <View className="flex-row mb-3" style={{ gap: 10 }}>
            <View className="flex-1">
              <Button
                label={t('pantry.camera', 'Camera')}
                icon="camera"
                onPress={() => onPick(true)}
              />
            </View>
            <View className="flex-1">
              <Button
                label={t('pantry.gallery', 'Gallery')}
                icon="image"
                variant="secondary"
                onPress={() => onPick(false)}
              />
            </View>
          </View>
          {imageUris.length > 0 ? (
            <Button label={t('pantry.analyze', 'Find meals')} icon="sparkles" onPress={onAnalyze} />
          ) : null}
        </>
      )}

      {errorCode ? <ErrorBanner t={t} code={errorCode} /> : null}

      {savedPantryCount > 0 ? (
        <Pressable
          onPress={onUseSavedPantry}
          className="mt-4 bg-bg-raised border border-border rounded-2xl p-4 flex-row items-center"
        >
          <Icon name="list" size={18} color="#B4B4C2" />
          <Text className="text-ink text-sm font-semibold ml-3 flex-1">
            {t('pantry.useSaved', 'Use saved pantry')} · {savedPantryCount}
          </Text>
          <Icon name="chevron-right" size={18} color="#B4B4C2" />
        </Pressable>
      ) : null}

      {hasLastSuggestions ? (
        <Pressable onPress={onViewLast} className="mt-3 flex-row items-center justify-center py-2">
          <Icon name="history" size={15} color="#B4B4C2" />
          <Text className="text-ink-subtle text-sm font-semibold ml-2">
            {t('pantry.viewLast', 'View last suggestions')}
          </Text>
        </Pressable>
      ) : null}

      <Disclaimer t={t} />
    </View>
  );
}

// ---------------------------------------------------------------------------
function ConfirmStep({
  t,
  items,
  errorCode,
  suggesting,
  onUpdate,
  onRemove,
  onAdd,
  onMap,
  onBack,
  onContinue,
}: {
  t: ReturnType<typeof useTranslation>['t'];
  items: PantryUIItem[];
  errorCode: string | null;
  suggesting: boolean;
  onUpdate: (key: string, patch: Partial<PantryUIItem>) => void;
  onRemove: (key: string) => void;
  onAdd: () => void;
  onMap: (key: string) => void;
  onBack: () => void;
  onContinue: () => void;
}) {
  return (
    <View>
      <Text className="text-ink-muted text-[11px] font-bold uppercase tracking-widest mb-2">
        {t('pantry.confirmTitle', 'Confirm ingredients')} · {items.length}
      </Text>
      <Text className="text-ink-subtle text-sm mb-3">
        {t(
          'pantry.confirmBody',
          'Remove anything wrong, add what we missed. Nothing proceeds until you confirm.',
        )}
      </Text>

      {errorCode ? <ErrorBanner t={t} code={errorCode} /> : null}

      {items.length === 0 ? (
        <Card tone="raised" className="my-2">
          <Text className="text-ink-subtle text-sm text-center">
            {t('pantry.empty', 'No ingredients yet — add some to continue.')}
          </Text>
        </Card>
      ) : null}

      {items.map((it) => (
        <ConfirmRow
          key={it.key}
          t={t}
          item={it}
          onUpdate={onUpdate}
          onRemove={onRemove}
          onMap={onMap}
        />
      ))}

      <Pressable
        onPress={onAdd}
        className="mt-1 mb-4 border border-dashed border-border rounded-2xl py-3 flex-row items-center justify-center active:opacity-80"
      >
        <Icon name="plus" size={16} color="#FF4D2E" />
        <Text className="text-accent text-sm font-bold ml-2">
          {t('pantry.addManual', 'Add ingredient')}
        </Text>
      </Pressable>

      <View className="flex-row" style={{ gap: 10 }}>
        <View className="flex-1">
          <Button
            label={t('common.back', 'Back')}
            variant="secondary"
            icon="chevron-left"
            onPress={onBack}
          />
        </View>
        <View className="flex-[2]">
          <Button
            label={t('pantry.getSuggestions', 'Suggest meals')}
            icon="sparkles"
            loading={suggesting}
            disabled={suggesting}
            onPress={onContinue}
          />
        </View>
      </View>
      <View style={{ height: 40 }} />
    </View>
  );
}

function ConfirmRow({
  t,
  item,
  onUpdate,
  onRemove,
  onMap,
}: {
  t: ReturnType<typeof useTranslation>['t'];
  item: PantryUIItem;
  onUpdate: (key: string, patch: Partial<PantryUIItem>) => void;
  onRemove: (key: string) => void;
  onMap: (key: string) => void;
}) {
  const unmatched = !item.foodDbId;
  const conf =
    item.confidence == null
      ? null
      : item.confidence >= 0.8
        ? 'high'
        : item.confidence >= 0.5
          ? 'medium'
          : 'low';
  return (
    <View
      className={`rounded-2xl border p-3 mb-2 ${
        unmatched ? 'bg-amber-900/15 border-amber-500/40' : 'bg-bg-raised border-border'
      }`}
    >
      <View className="flex-row items-center">
        <View className="flex-1 mr-2">
          <Text className="text-ink font-semibold">{item.name}</Text>
          {unmatched ? (
            <Pressable onPress={() => onMap(item.key)} className="flex-row items-center mt-1">
              <Icon name="search" size={12} color="#F5C451" />
              <Text className="text-amber-300 text-xs font-semibold ml-1">
                {t('pantry.unmatched', "Couldn't match — tap to search")}
              </Text>
            </Pressable>
          ) : conf ? (
            <Text className="text-ink-muted text-[11px] mt-0.5">
              {t(`pantry.conf_${conf}`, conf)}
            </Text>
          ) : (
            <Text className="text-ink-muted text-[11px] mt-0.5">{t('pantry.added', 'Added')}</Text>
          )}
        </View>
        <View className="flex-row items-center bg-bg border border-border rounded-lg px-2 py-1 mr-2">
          <TextInput
            value={item.quantity != null ? String(Math.round(item.quantity)) : ''}
            onChangeText={(v) =>
              onUpdate(item.key, { quantity: Number(v.replace(/[^\d.]/g, '')) || 0 })
            }
            keyboardType="numeric"
            placeholder="—"
            placeholderTextColor="#6B6B76"
            className="text-ink text-sm w-10 text-center"
          />
          <Text className="text-ink-muted text-[11px] ml-1">{item.unit ?? 'g'}</Text>
        </View>
        <Pressable
          onPress={() => onRemove(item.key)}
          className="w-8 h-8 rounded-full bg-bg items-center justify-center"
        >
          <Icon name="trash" size={15} color="#FF4D6D" />
        </Pressable>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
function SuggestStep({
  t,
  macros,
  result,
  errorCode,
  loggedTitles,
  ramadan,
  onToggleRamadan,
  onLog,
  onRescan,
  onEdit,
  onSetGoal,
}: {
  t: ReturnType<typeof useTranslation>['t'];
  macros: ReturnType<typeof useRemainingMacros>;
  result: MealSuggestionsResponse | null;
  errorCode: string | null;
  loggedTitles: Set<string>;
  ramadan: boolean;
  onToggleRamadan: (v: boolean) => void;
  onLog: (s: MealSuggestion) => void;
  onRescan: () => void;
  onEdit: () => void;
  onSetGoal: () => void;
}) {
  const suggestions = result?.suggestions ?? [];
  return (
    <View>
      <RemainingHeader t={t} macros={macros} />

      {!macros.hasTarget ? (
        <Pressable
          onPress={onSetGoal}
          className="mb-3 bg-bg-raised border border-border rounded-2xl p-3 flex-row items-center"
        >
          <Icon name="target" size={16} color="#F5C451" />
          <Text className="text-ink text-xs ml-2 flex-1">
            {t('pantry.setGoalHint', 'Set your goal in your profile for personalised targets.')}
          </Text>
          <Icon name="chevron-right" size={16} color="#B4B4C2" />
        </Pressable>
      ) : null}

      {/* Ramadan toggle */}
      <View className="flex-row items-center justify-between bg-bg-raised border border-border rounded-2xl px-4 py-3 mb-3">
        <View className="flex-row items-center flex-1">
          <Icon name="clock" size={16} color="#B4B4C2" />
          <Text className="text-ink text-sm font-semibold ml-2">
            {t('pantry.ramadan', 'Ramadan mode')}
          </Text>
        </View>
        <Switch value={ramadan} onValueChange={onToggleRamadan} />
      </View>
      {ramadan ? (
        <View className="mb-3 bg-bg-subtle border border-border rounded-2xl p-3 flex-row items-center">
          <Icon name="droplet" size={15} color="#60A5FA" />
          <Text className="text-ink-subtle text-xs ml-2 flex-1">
            {t(
              'pantry.ramadanHydration',
              'Stay hydrated between iftar and suhoor — sip water regularly.',
            )}
          </Text>
        </View>
      ) : null}

      {errorCode ? <ErrorBanner t={t} code={errorCode} /> : null}

      {result?.best_is_weak && suggestions.length > 0 ? (
        <View className="mb-3 bg-amber-900/15 border border-amber-500/40 rounded-2xl p-3 flex-row items-center">
          <Icon name="alert" size={15} color="#F5C451" />
          <Text className="text-amber-200 text-xs ml-2 flex-1">
            {t(
              'pantry.weakFit',
              "Closest options below — they don't fully fill your remaining macros.",
            )}
          </Text>
        </View>
      ) : null}

      {suggestions.length === 0 ? (
        <Card tone="raised" className="my-2">
          <Text className="text-ink font-semibold mb-1">
            {t('pantry.noMatchTitle', 'No good match yet')}
          </Text>
          <Text className="text-ink-subtle text-sm">
            {t(
              'pantry.noMatchBody',
              'Add a few more ingredients (a protein and a carb help most) and try again.',
            )}
          </Text>
        </Card>
      ) : (
        suggestions.map((s, i) => (
          <SuggestionCard
            key={`${s.title}-${i}`}
            t={t}
            s={s}
            logged={loggedTitles.has(s.title)}
            onLog={() => onLog(s)}
          />
        ))
      )}

      <View className="h-3" />
      <View className="flex-row" style={{ gap: 10 }}>
        <View className="flex-1">
          <Button
            label={t('pantry.editIngredients', 'Edit')}
            variant="secondary"
            icon="edit"
            onPress={onEdit}
          />
        </View>
        <View className="flex-1">
          <Button label={t('pantry.scanAgain', 'Scan again')} icon="camera" onPress={onRescan} />
        </View>
      </View>
      <View style={{ height: 50 }} />
    </View>
  );
}

function RemainingHeader({
  t,
  macros,
}: {
  t: ReturnType<typeof useTranslation>['t'];
  macros: ReturnType<typeof useRemainingMacros>;
}) {
  const r = macros.remaining;
  const cells: { label: string; value: number; color: string }[] = [
    { label: t('pantry.kcal', 'kcal'), value: r.kcal, color: '#FF4D2E' },
    { label: t('pantry.protein', 'Protein'), value: r.protein, color: '#2EE6A6' },
    { label: t('pantry.carbs', 'Carbs'), value: r.carbs, color: '#60A5FA' },
    { label: t('pantry.fat', 'Fat'), value: r.fat, color: '#F5C451' },
  ];
  return (
    <View className="bg-bg-raised border border-border rounded-3xl p-4 mb-3">
      <Text className="text-ink-muted text-[10px] font-bold uppercase tracking-widest mb-2">
        {t('pantry.remainingToday', 'Remaining today')}
      </Text>
      <View className="flex-row" style={{ gap: 8 }}>
        {cells.map((c) => (
          <View key={c.label} className="flex-1 items-center">
            <Text className="text-lg font-extrabold" style={{ color: c.color }}>
              {Math.round(c.value)}
            </Text>
            <Text className="text-ink-muted text-[10px] font-bold uppercase mt-0.5">{c.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function SuggestionCard({
  t,
  s,
  logged,
  onLog,
}: {
  t: ReturnType<typeof useTranslation>['t'];
  s: MealSuggestion;
  logged: boolean;
  onLog: () => void;
}) {
  const shortfallLabel =
    s.shortfall === 'protein'
      ? t('pantry.shortfallProtein', 'add a protein source to round this out')
      : s.shortfall === 'carbs'
        ? t('pantry.shortfallCarbs', 'add a carb source to round this out')
        : s.shortfall === 'fat'
          ? t('pantry.shortfallFat', 'add a healthy fat to round this out')
          : s.shortfall === 'kcal'
            ? t('pantry.shortfallKcal', 'a bit light on calories')
            : null;
  return (
    <View className="bg-bg-raised border border-border rounded-3xl p-4 mb-3">
      <View className="flex-row items-start justify-between mb-2">
        <Text className="text-ink text-lg font-extrabold flex-1 mr-2">{s.title}</Text>
        <View className="items-end">
          <View className="bg-accent/10 border border-accent/40 rounded-full px-2.5 py-1">
            <Text className="text-accent text-[11px] font-extrabold">
              {t('pantry.fit', 'Fit')} {Math.round(s.fit_score)}%
            </Text>
          </View>
        </View>
      </View>

      <Text className="text-emerald-300 text-xs font-bold mb-2">
        {t('pantry.coversProtein', {
          defaultValue: 'Covers {{pct}}% of remaining protein',
          pct: Math.round(s.protein_fill_pct),
        })}
      </Text>

      {/* Macro chips — every number computed server-side from the food DB */}
      <View className="flex-row mb-2" style={{ gap: 6 }}>
        <MacroChip label="kcal" value={Math.round(s.macros.kcal)} color="#FF4D2E" />
        <MacroChip label="P" value={`${Math.round(s.macros.protein)}g`} color="#2EE6A6" />
        <MacroChip label="C" value={`${Math.round(s.macros.carbs)}g`} color="#60A5FA" />
        <MacroChip label="F" value={`${Math.round(s.macros.fat)}g`} color="#F5C451" />
      </View>

      {/* Ingredients used */}
      <View className="mb-2">
        {s.items.map((it, i) => (
          <Text key={`${it.food_db_id}-${i}`} className="text-ink-subtle text-xs leading-5">
            • {it.name} — {Math.round(it.quantity_g)} g
          </Text>
        ))}
      </View>

      {s.note ? <Text className="text-ink text-sm leading-5 mb-1">{s.note}</Text> : null}
      {shortfallLabel ? (
        <Text className="text-amber-300 text-xs mb-2">↳ {shortfallLabel}</Text>
      ) : null}

      <View className="h-2" />
      <Button
        label={logged ? t('pantry.logged', 'Logged ✓') : t('pantry.logThis', 'Log this')}
        icon={logged ? 'check-circle' : 'check'}
        disabled={logged}
        onPress={onLog}
      />
    </View>
  );
}

function MacroChip({
  label,
  value,
  color,
}: {
  label: string;
  value: number | string;
  color: string;
}) {
  return (
    <View className="flex-1 bg-bg border border-border rounded-xl px-2 py-2 items-center">
      <Text className="text-[10px] font-bold uppercase" style={{ color }}>
        {label}
      </Text>
      <Text className="text-ink text-sm font-extrabold mt-0.5">{value}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
function FoodSearchModal({
  t,
  locale,
  visible,
  onClose,
  onPick,
}: {
  t: ReturnType<typeof useTranslation>['t'];
  locale: Locale;
  visible: boolean;
  onClose: () => void;
  onPick: (food: FoodSearchRow) => void;
}) {
  const [query, setQuery] = useState('');
  const search = useFoodSearch(query);
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View className="flex-1 bg-black/60 justify-end">
        <View
          className="bg-bg rounded-t-3xl border-t border-border p-4"
          style={{ maxHeight: '80%' }}
        >
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-ink font-extrabold text-lg">
              {t('pantry.searchFood', 'Search food')}
            </Text>
            <Pressable
              onPress={onClose}
              className="w-8 h-8 rounded-full bg-bg-raised items-center justify-center"
            >
              <Icon name="x" size={16} color="#F4F4F7" />
            </Pressable>
          </View>
          <View className="flex-row items-center bg-bg-raised border border-border rounded-2xl px-3 py-2 mb-3">
            <Icon name="search" size={16} color="#B4B4C2" />
            <TextInput
              value={query}
              onChangeText={setQuery}
              autoFocus
              placeholder={t('pantry.searchPlaceholder', 'e.g. chicken, rice, tomato…')}
              placeholderTextColor="#6B6B76"
              className="text-ink text-base ml-2 flex-1"
            />
          </View>
          <ScrollView keyboardShouldPersistTaps="handled">
            {search.isFetching ? (
              <View className="items-center py-6">
                <Spinner />
              </View>
            ) : null}
            {!search.isFetching && query.trim().length >= 2 && (search.data ?? []).length === 0 ? (
              <Text className="text-ink-subtle text-sm text-center py-6">
                {t('pantry.noResults', 'No matches in the food database.')}
              </Text>
            ) : null}
            {(search.data ?? []).map((f) => (
              <Pressable
                key={f.id}
                onPress={() => {
                  onPick(f);
                  setQuery('');
                }}
                className="flex-row items-center justify-between bg-bg-raised border border-border rounded-2xl px-4 py-3 mb-2"
              >
                <View className="flex-1 mr-2">
                  <Text className="text-ink font-semibold">{foodDisplayName(f, locale)}</Text>
                  <Text className="text-ink-muted text-[11px] mt-0.5">
                    {Math.round(f.calories)} kcal · {Math.round(f.protein_g)}P{' '}
                    {Math.round(f.carbs_g)}C {Math.round(f.fat_g)}F / {Math.round(f.serving_size_g)}
                    g
                  </Text>
                </View>
                <Icon name="plus" size={18} color="#FF4D2E" />
              </Pressable>
            ))}
            <View style={{ height: 30 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
function ErrorBanner({ t, code }: { t: ReturnType<typeof useTranslation>['t']; code: string }) {
  const msg =
    code === 'needs_connection'
      ? t('pantry.needsConnection', 'Scanning needs a connection. Showing your saved pantry.')
      : code === 'no_food_detected'
        ? t('pantry.noFood', 'No food detected — try a clearer photo of your ingredients.')
        : code === 'no_suggestions'
          ? t(
              'pantry.noSuggestions',
              "Couldn't build a meal from those ingredients. Add a few more.",
            )
          : code === 'entitlement_required' || code === 'premium_only'
            ? t('premium.premiumOnly', 'This is a premium feature.')
            : t(`errors.ai.${code}`, t('pantry.genericError', 'Something went wrong. Try again.'));
  return (
    <View className="my-2 p-3 rounded-2xl bg-bg-raised border border-danger flex-row items-center">
      <Icon name="alert" size={16} color="#FF4D6D" />
      <Text className="text-danger text-sm ml-2 flex-1">{msg}</Text>
    </View>
  );
}

function Disclaimer({ t }: { t: ReturnType<typeof useTranslation>['t'] }) {
  return (
    <Text className="text-ink-muted text-[11px] text-center mt-5 leading-4 px-4">
      {t('pantry.disclaimer', 'Suggestions are general guidance, not medical or nutrition advice.')}
    </Text>
  );
}
