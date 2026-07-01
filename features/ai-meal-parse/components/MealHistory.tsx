import { useTranslation } from 'react-i18next';
import { Image, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Icon } from '@features/shared';
import { useMealHistory, type MealHistoryEntry } from '../hooks/useMealHistory';
import { VERDICT_STYLE } from './verdict';

/**
 * Scrollable "recent meals" strip rendered at the bottom of the meal screen.
 * Each row is tappable and routes to the meal's detail page.
 */
export function MealHistory() {
  const { t } = useTranslation();
  const { data, isPending } = useMealHistory();

  // Nothing to show yet — stay quiet rather than render an empty shell.
  if (isPending || !data || data.length === 0) return null;

  return (
    <View className="mt-8">
      <View className="flex-row items-center mb-3">
        <Icon name="history" size={16} color="#B4B4C2" />
        <Text className="text-ink-muted text-[11px] font-bold uppercase tracking-widest ml-2">
          {t('ai.meal.recentMeals', 'Recent meals')}
        </Text>
        <View className="flex-1 h-px bg-border ml-3" />
      </View>

      <View style={{ gap: 8 }}>
        {data.map((meal) => (
          <MealHistoryRow key={meal.id} meal={meal} />
        ))}
      </View>
    </View>
  );
}

function MealHistoryRow({ meal }: { meal: MealHistoryEntry }) {
  const { t } = useTranslation();
  const router = useRouter();
  const v = meal.verdict ? VERDICT_STYLE[meal.verdict] : null;

  return (
    <Pressable
      onPress={() => router.push(`/meal/${meal.id}`)}
      className="flex-row items-center bg-bg-raised border border-border rounded-2xl p-2.5 active:bg-bg-elevated"
    >
      {/* Thumbnail / placeholder */}
      {meal.thumbUrl ? (
        <Image
          source={{ uri: meal.thumbUrl }}
          style={{ width: 56, height: 56, borderRadius: 16 }}
        />
      ) : (
        <View className="w-14 h-14 rounded-2xl bg-bg-subtle border border-border items-center justify-center">
          <Icon name="image" size={20} color="#74748A" />
        </View>
      )}

      <View className="flex-1 ml-3 mr-2">
        <Text className="text-ink font-bold text-sm" numberOfLines={1}>
          {meal.name ?? t('ai.meal.untitled', 'Logged meal')}
        </Text>
        <View className="flex-row items-center mt-0.5">
          <Text className="text-ink-muted text-xs">{formatWhen(meal.eatenAt, t)}</Text>
          <View className="w-1 h-1 rounded-full bg-ink-dim mx-2" />
          <Text className="text-ink-subtle text-xs font-semibold">
            {meal.calories} {t('ai.meal.kcalShort', 'kcal')}
          </Text>
        </View>
      </View>

      {/* Verdict / score badge */}
      {v ? (
        <View
          className={`w-8 h-8 rounded-full items-center justify-center border ${v.border} ${v.bg} mr-1`}
        >
          <Text className={`${v.text} font-extrabold`}>{meal.healthScore ?? v.emoji}</Text>
        </View>
      ) : null}
      <Icon name="chevron-right" size={18} color="#74748A" />
    </Pressable>
  );
}

type TFn = (key: string, fallback: string) => string;

/** "Today 14:30" / "Yesterday 09:10" / "12 May 14:30" */
function formatWhen(iso: string, t: TFn): string {
  const d = new Date(iso);
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (sameDay(d, today)) return `${t('ai.meal.today', 'Today')} ${time}`;
  if (sameDay(d, yesterday)) return `${t('ai.meal.yesterday', 'Yesterday')} ${time}`;
  return `${d.toLocaleDateString([], { day: 'numeric', month: 'short' })} ${time}`;
}
