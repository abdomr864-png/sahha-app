import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';
import { Button, Header, Screen, Spinner } from '@features/shared';
import { useEntitlement } from '@features/premium';
import { aiClient } from '@lib/llm';
import { AIError } from '@lib/llm/client';
import type { FormFeedback } from '@lib/llm';

/**
 * v1 form-check screen.
 *
 * Frame capture is gated behind a follow-up: the spec calls for `expo-video-
 * thumbnails` to extract 6 frames from a 30s recording, then upload to
 * Storage at `form-checks/{user_id}/{check_id}/`. Until that library lands
 * in the bundle, this screen accepts a list of frame URLs (e.g. from a
 * gallery picker) and is otherwise wired end-to-end.
 *
 * Open the screen with `?exercise_id=<uuid>`.
 */
export function FormCheckScreen() {
  const { t, i18n } = useTranslation();
  const { exercise_id } = useLocalSearchParams<{ exercise_id?: string }>();
  const ent = useEntitlement('ai_form_check');

  const [analyzing, setAnalyzing] = useState(false);
  const [feedback, setFeedback] = useState<FormFeedback | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  const isBlocked = ent.data && !ent.data.allowed;

  const _onAnalyze = async (videoUrl: string, frameUrls: string[]) => {
    if (!exercise_id) {
      setErrorCode('invalid_input');
      return;
    }
    setAnalyzing(true);
    setErrorCode(null);
    setFeedback(null);
    try {
      const res = await aiClient.formCheck({
        exercise_id,
        video_url: videoUrl,
        frame_urls: frameUrls,
        locale: ((i18n.language as string | undefined) ?? 'en') as 'fr' | 'ar' | 'en',
      });
      setFeedback(res.feedback);
    } catch (e) {
      setErrorCode(e instanceof AIError ? e.code : 'provider_error');
    } finally {
      setAnalyzing(false);
    }
  };

  if (analyzing) {
    return (
      <Screen>
        <View className="flex-1 items-center justify-center">
          <Spinner />
          <Text className="text-ink mt-6">{t('ai.formCheck.analyzing', 'Analyzing form…')}</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <Header title={t('ai.formCheck.title', 'Form check')} showBack />

      {isBlocked ? (
        <View className="bg-bg-raised border border-border rounded-2xl p-4 mb-4">
          <Text className="text-ink font-semibold mb-1">
            {ent.data?.reason === 'premium_only'
              ? t('premium.required', 'Premium required')
              : t('ai.formCheck.weeklyLimit', 'Weekly limit reached')}
          </Text>
          <Text className="text-ink-subtle text-sm">
            {t('ai.formCheck.upgradeHint', 'Upgrade to get unlimited form checks.')}
          </Text>
        </View>
      ) : (
        <View className="bg-bg-raised border border-border rounded-2xl p-4 mb-4">
          <Text className="text-ink font-semibold mb-2">
            {t('ai.formCheck.howto', 'How to record')}
          </Text>
          <Text className="text-ink-subtle text-sm">
            {t(
              'ai.formCheck.howtoBody',
              'Frame yourself from the side. Record 1 full rep (≈10s). The app extracts 6 still frames and sends them to the AI coach.',
            )}
          </Text>
        </View>
      )}

      <Button
        label={t('ai.formCheck.record', 'Record video')}
        icon="play"
        disabled={!!isBlocked}
        onPress={() => {
          // TODO: integrate expo-camera (already in deps) + expo-video-thumbnails
          // (needs to be added). On capture: extract 6 frames, upload to Storage
          // bucket `form-checks/{user_id}/{checkId}/`, call onAnalyze.
        }}
      />

      {errorCode ? (
        <View className="my-3 p-3 rounded-2xl bg-bg-raised border border-danger">
          <Text className="text-danger text-sm">{t(`errors.ai.${errorCode}`, errorCode)}</Text>
        </View>
      ) : null}

      {feedback ? <FeedbackView feedback={feedback} /> : null}
    </Screen>
  );
}

function FeedbackView({ feedback }: { feedback: FormFeedback }) {
  const { t } = useTranslation();
  const score = feedback.overall_score;
  const scoreColor = score >= 8 ? '#34D399' : score >= 5 ? '#FBBF24' : '#F87171';
  return (
    <View className="mt-6">
      <View className="bg-bg-raised border border-border rounded-2xl p-4 mb-3">
        <Text className="text-ink-muted text-[10px] font-bold uppercase tracking-widest">
          {t('ai.formCheck.score', 'Overall score')}
        </Text>
        <Text className="text-3xl font-extrabold mt-1" style={{ color: scoreColor }}>
          {score}/10
        </Text>
      </View>

      {feedback.safety_warning ? (
        <View className="bg-rose-900/40 border border-danger rounded-2xl p-4 mb-3">
          <Text className="text-danger font-bold mb-1">
            {t('ai.formCheck.safety', '⚠ Safety warning')}
          </Text>
          <Text className="text-ink">{feedback.safety_warning}</Text>
        </View>
      ) : null}

      {feedback.what_is_good.length > 0 ? (
        <View className="bg-bg-raised border border-border rounded-2xl p-4 mb-3">
          <Text className="text-emerald-400 font-bold mb-2">
            {t('ai.formCheck.good', 'Good points')}
          </Text>
          {feedback.what_is_good.map((s, i) => (
            <Text key={i} className="text-ink mb-1">
              • {s}
            </Text>
          ))}
        </View>
      ) : null}

      {feedback.what_to_fix.length > 0 ? (
        <View className="bg-bg-raised border border-border rounded-2xl p-4 mb-3">
          <Text className="text-amber-400 font-bold mb-2">
            {t('ai.formCheck.fix', 'What to fix')}
          </Text>
          {feedback.what_to_fix.map((f, i) => (
            <View key={i} className="mb-3">
              <Text className="text-ink font-semibold mb-1">{f.issue}</Text>
              <Text className="text-ink-subtle text-sm mb-1">
                {t(`ai.formCheck.severity.${f.severity}`, f.severity)}
              </Text>
              <Text className="text-ink-subtle text-sm">{f.suggestion}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}
