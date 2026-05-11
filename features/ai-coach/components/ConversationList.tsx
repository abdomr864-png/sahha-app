import { FlatList, Pressable, Text, View, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ErrorMessage, Icon, Spinner } from '@features/shared';
import { useConversations, useCoachSnapshot, type CoachSnapshot } from '../hooks/useConversations';

// Suggested quick-start prompts shown on the coach hub. Each routes into a
// brand-new conversation with the prompt pre-seeded via the `seed` query param.
interface QuickPrompt {
  icon: 'flame' | 'sparkles' | 'heart' | 'target' | 'apple' | 'dumbbell';
  labelKey: string;
  labelFallback: string;
  promptKey: string;
  promptFallback: string;
}

const QUICK_PROMPTS: QuickPrompt[] = [
  {
    icon: 'dumbbell',
    labelKey: 'ai.coach.quick.planTodayLabel',
    labelFallback: "Plan today's workout",
    promptKey: 'ai.coach.quick.planTodayPrompt',
    promptFallback: "What workout should I do today given how I've trained and slept this week?",
  },
  {
    icon: 'apple',
    labelKey: 'ai.coach.quick.macrosLabel',
    labelFallback: 'Critique my macros',
    promptKey: 'ai.coach.quick.macrosPrompt',
    promptFallback: 'How am I tracking on calories and protein today? What should I eat next?',
  },
  {
    icon: 'heart',
    labelKey: 'ai.coach.quick.recoveryLabel',
    labelFallback: 'Check my recovery',
    promptKey: 'ai.coach.quick.recoveryPrompt',
    promptFallback:
      'Based on my sleep, mood, and last sessions, am I recovered enough to push hard?',
  },
  {
    icon: 'target',
    labelKey: 'ai.coach.quick.progressLabel',
    labelFallback: 'Review my progress',
    promptKey: 'ai.coach.quick.progressPrompt',
    promptFallback: 'How is my progress over the last few weeks? What should I focus on next?',
  },
  {
    icon: 'flame',
    labelKey: 'ai.coach.quick.breakthroughLabel',
    labelFallback: 'Break a plateau',
    promptKey: 'ai.coach.quick.breakthroughPrompt',
    promptFallback: 'I feel stuck on my main lifts. How should I program the next 4 weeks?',
  },
];

export function ConversationList() {
  const { t } = useTranslation();
  const q = useConversations();
  const snap = useCoachSnapshot();

  if (q.isPending) return <Spinner />;
  if (q.isError) return <ErrorMessage error={q.error} />;
  const data = q.data ?? [];

  return (
    <FlatList
      data={data}
      keyExtractor={(c) => c.id}
      contentContainerClassName="px-5 pb-28"
      ItemSeparatorComponent={() => <View className="h-2.5" />}
      ListHeaderComponent={
        <View className="pb-4">
          <SnapshotCard snapshot={snap.data} />
          <QuickPromptsRow />
          <View className="flex-row items-center justify-between mt-6 mb-3">
            <Text className="text-ink text-base font-semibold">
              {t('ai.coach.history', 'Recent conversations')}
            </Text>
            {data.length > 0 ? (
              <Text className="text-ink-subtle text-xs">
                {data.length}{' '}
                {data.length === 1
                  ? t('ai.coach.chatOne', 'chat')
                  : t('ai.coach.chatMany', 'chats')}
              </Text>
            ) : null}
          </View>
        </View>
      }
      ListEmptyComponent={
        <View className="items-center mt-6">
          <View className="w-16 h-16 rounded-2xl bg-bg-raised border border-border items-center justify-center mb-4">
            <Icon name="sparkles" size={26} color="#A1A1AA" />
          </View>
          <Text className="text-ink-subtle text-base text-center px-6">
            {t(
              'ai.coach.empty',
              'No conversations yet. Pick a quick start above or just ask anything.',
            )}
          </Text>
        </View>
      }
      renderItem={({ item }) => (
        <Pressable
          onPress={() => router.push(`/ai-coach/${item.id}`)}
          className="bg-bg-raised border border-border rounded-2xl p-4 active:opacity-90"
        >
          <View className="flex-row items-start">
            <View className="w-10 h-10 rounded-xl bg-accent/15 items-center justify-center mr-3 mt-0.5">
              <Icon name="message" size={18} color="#22D3EE" />
            </View>
            <View className="flex-1">
              <Text className="text-ink text-base font-semibold" numberOfLines={1}>
                {item.title ?? t('ai.coach.untitled', 'Conversation')}
              </Text>
              {item.last_message_preview ? (
                <Text className="text-ink-subtle text-sm mt-1" numberOfLines={2}>
                  {item.last_message_preview}
                </Text>
              ) : null}
              <View className="flex-row items-center mt-2">
                <Text className="text-ink-subtle text-xs">
                  {formatRelative(item.last_message_at)}
                </Text>
                {item.message_count > 0 ? (
                  <>
                    <Text className="text-ink-subtle text-xs mx-1.5">•</Text>
                    <Text className="text-ink-subtle text-xs">
                      {item.message_count}{' '}
                      {item.message_count === 1
                        ? t('ai.coach.messageOne', 'message')
                        : t('ai.coach.messageMany', 'messages')}
                    </Text>
                  </>
                ) : null}
              </View>
            </View>
            <Icon name="chevron-right" size={18} color="#52525B" />
          </View>
        </Pressable>
      )}
    />
  );
}

function SnapshotCard({ snapshot }: { snapshot: CoachSnapshot | undefined }) {
  const { t } = useTranslation();
  const streak = snapshot?.current_streak ?? 0;
  const done = snapshot?.weekly_completions ?? 0;
  const target = snapshot?.weekly_target ?? 0;
  const workouts = snapshot?.workouts_7d ?? 0;

  return (
    <View className="bg-bg-raised border border-accent/30 rounded-3xl p-5 overflow-hidden">
      <View className="flex-row items-center mb-1">
        <View className="w-9 h-9 rounded-xl bg-accent/20 items-center justify-center mr-3">
          <Icon name="sparkles" size={18} color="#22D3EE" />
        </View>
        <View className="flex-1">
          <Text className="text-ink text-base font-bold">
            {t('ai.coach.heroTitle', 'Your AI Coach')}
          </Text>
          <Text className="text-ink-subtle text-xs mt-0.5">
            {t('ai.coach.heroSubtitle', 'Trained on your training, sleep, nutrition, and PRs.')}
          </Text>
        </View>
      </View>

      <View className="flex-row mt-4 gap-2">
        <Stat
          icon="flame"
          value={String(streak)}
          label={t('ai.coach.streak', 'day streak')}
          highlight={streak > 0}
        />
        <Stat
          icon="check-circle"
          value={target > 0 ? `${done}/${target}` : String(done)}
          label={t('ai.coach.weekly', 'this week')}
        />
        <Stat icon="dumbbell" value={String(workouts)} label={t('ai.coach.last7', 'last 7d')} />
      </View>

      {snapshot?.recent_pr ? (
        <View className="flex-row items-center mt-4 bg-accent/10 rounded-2xl px-3 py-2.5">
          <Icon name="medal" size={16} color="#FBBF24" />
          <Text className="text-ink text-sm font-semibold ml-2" numberOfLines={1}>
            {t('ai.coach.recentPr', 'New PR:')} {snapshot.recent_pr.exercise}{' '}
            {snapshot.recent_pr.value}
            {snapshot.recent_pr.unit}
          </Text>
        </View>
      ) : null}

      <Pressable
        onPress={() => router.push('/ai-coach/new')}
        className="flex-row items-center justify-center bg-accent rounded-2xl py-3 mt-4 active:opacity-90"
      >
        <Icon name="plus" size={16} color="#FFFFFF" />
        <Text className="text-accent-contrast font-bold ml-2">
          {t('ai.coach.newChat', 'Start a new chat')}
        </Text>
      </Pressable>
    </View>
  );
}

function Stat({
  icon,
  value,
  label,
  highlight,
}: {
  icon: 'flame' | 'check-circle' | 'dumbbell';
  value: string;
  label: string;
  highlight?: boolean;
}) {
  return (
    <View className="flex-1 bg-bg-subtle border border-border rounded-2xl p-3">
      <Icon name={icon} size={14} color={highlight ? '#F97316' : '#A1A1AA'} />
      <Text className="text-ink text-xl font-bold mt-1.5">{value}</Text>
      <Text className="text-ink-subtle text-[11px]" numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

function QuickPromptsRow() {
  const { t } = useTranslation();
  return (
    <View className="mt-5">
      <Text className="text-ink-subtle text-xs uppercase tracking-wider font-semibold mb-2.5">
        {t('ai.coach.quickStart', 'Quick start')}
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingRight: 8 }}
      >
        {QUICK_PROMPTS.map((p) => (
          <Pressable
            key={p.labelKey}
            onPress={() =>
              router.push({
                pathname: '/ai-coach/new',
                params: { seed: t(p.promptKey, p.promptFallback) },
              })
            }
            className="bg-bg-raised border border-border rounded-2xl px-3.5 py-3 mr-2 flex-row items-center active:opacity-90"
            style={{ maxWidth: 220 }}
          >
            <Icon name={p.icon} size={16} color="#22D3EE" />
            <Text className="text-ink text-sm font-semibold ml-2" numberOfLines={1}>
              {t(p.labelKey, p.labelFallback)}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

function formatRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.round(ms / 60_000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.round(hr / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}
