import { useTranslation } from 'react-i18next';
import { Image, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { ErrorMessage, Header, Icon, Screen, Spinner } from '@features/shared';
import { useMealDetail, type MealDetail } from '../hooks/useMealDetail';
import { VERDICT_STYLE } from './verdict';

export function MealDetailScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, isPending, isError, error } = useMealDetail(id);

  return (
    <Screen scroll>
      <Header title={t('ai.meal.detailTitle', 'Meal')} showBack />
      {isPending ? (
        <View className="mt-12">
          <Spinner />
        </View>
      ) : isError ? (
        <ErrorMessage error={error} />
      ) : data ? (
        <MealDetailBody meal={data} />
      ) : (
        <Text className="text-ink-subtle text-center mt-12">
          {t('ai.meal.notFound', 'Meal not found.')}
        </Text>
      )}
    </Screen>
  );
}

function MealDetailBody({ meal }: { meal: MealDetail }) {
  const { t } = useTranslation();
  const v = meal.verdict ? VERDICT_STYLE[meal.verdict] : null;
  const verdictLabel: Record<string, string> = {
    good: t('ai.meal.verdictGood', 'Great choice'),
    ok: t('ai.meal.verdictOk', 'Decent'),
    bad: t('ai.meal.verdictBad', 'Could be better'),
  };
  const eaten = new Date(meal.eatenAt);

  return (
    <View className="mt-2">
      {/* Hero photo */}
      {meal.photoUrl ? (
        <View className="rounded-3xl overflow-hidden border border-border bg-bg-raised mb-4">
          <Image source={{ uri: meal.photoUrl }} style={{ width: '100%', aspectRatio: 1 }} />
        </View>
      ) : null}

      {/* Title + meta */}
      <Text className="text-ink text-2xl font-extrabold leading-7">
        {meal.name ?? t('ai.meal.untitled', 'Logged meal')}
      </Text>
      <View className="flex-row items-center mt-2 mb-4" style={{ gap: 8 }}>
        {meal.mealType ? (
          <View className="bg-bg-raised border border-border rounded-full px-3 py-1">
            <Text className="text-ink-subtle text-[11px] font-bold uppercase tracking-wider">
              {meal.mealType}
            </Text>
          </View>
        ) : null}
        <View className="flex-row items-center">
          <Icon name="clock" size={13} color="#74748A" />
          <Text className="text-ink-muted text-xs ml-1.5">
            {eaten.toLocaleDateString([], { day: 'numeric', month: 'short' })}{' '}
            {eaten.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
      </View>

      {/* Verdict hero */}
      {v ? (
        <View className={`rounded-3xl border ${v.border} ${v.bg} p-5 mb-4`}>
          <View className="flex-row items-center justify-between mb-2">
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
                <Text className={`${v.text} text-lg font-extrabold mt-0.5`}>
                  {meal.verdict ? verdictLabel[meal.verdict] : ''}
                </Text>
              </View>
            </View>
            {meal.healthScore ? (
              <View className="items-end">
                <Text className="text-ink-muted text-[10px] font-bold tracking-widest">
                  {t('ai.meal.health', 'HEALTH')}
                </Text>
                <Text className="text-ink text-2xl font-extrabold">
                  {meal.healthScore}
                  <Text className="text-ink-muted text-sm font-bold">/10</Text>
                </Text>
              </View>
            ) : null}
          </View>
          {meal.summary ? <Text className="text-ink text-sm leading-5">{meal.summary}</Text> : null}
        </View>
      ) : null}

      {/* Macro totals */}
      <View className="flex-row mb-2" style={{ gap: 8 }}>
        <MacroTile label="kcal" value={Math.round(meal.total.calories)} accent />
        <MacroTile label="P" value={`${Math.round(meal.total.protein)}g`} color="#2EE6A6" />
        <MacroTile label="C" value={`${Math.round(meal.total.carbs)}g`} color="#60A5FA" />
        <MacroTile label="F" value={`${Math.round(meal.total.fat)}g`} color="#F5C451" />
      </View>

      {/* Ingredients */}
      {meal.items.length > 0 ? (
        <>
          <Text className="text-ink-muted text-[10px] font-bold mt-4 mb-2 uppercase tracking-widest">
            {t('ai.meal.ingredients', 'Ingredients')} · {meal.items.length}
          </Text>
          {meal.items.map((item) => (
            <View
              key={item.id}
              className="bg-bg-raised border border-border rounded-2xl p-4 mb-2 flex-row items-center justify-between"
            >
              <View className="flex-1 mr-3">
                <Text className="text-ink font-semibold">{item.name || '—'}</Text>
                <Text className="text-ink-subtle text-xs mt-0.5">
                  {Math.round(item.quantityG)}g · P {Math.round(item.protein)} · C{' '}
                  {Math.round(item.carbs)} · F {Math.round(item.fat)}
                </Text>
              </View>
              <Text className="text-ink font-extrabold">
                {Math.round(item.calories)}
                <Text className="text-ink-muted text-xs font-bold"> kcal</Text>
              </Text>
            </View>
          ))}
        </>
      ) : null}

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
        style={{ color: color ?? (accent ? '#FF4D2E' : '#B4B4C2') }}
      >
        {label.toUpperCase()}
      </Text>
      <Text className="text-ink text-lg font-extrabold mt-1">{value}</Text>
    </View>
  );
}
