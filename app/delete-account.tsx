import { useState } from 'react';
import { Text, View } from 'react-native';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  Button,
  Card,
  ConfirmSheet,
  ErrorMessage,
  Icon,
  IconButton,
  Screen,
  useSafeBack,
} from '@features/shared';
import { supabase } from '@lib/supabase/client';
import { toAppError } from '@lib/supabase/errors';

function useDeleteAccount() {
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.functions.invoke('delete-account');
      if (error) {
        // FunctionsHttpError carries the raw Response on `.context` — read
        // the body so the user sees the real reason instead of a generic
        // "errors.unknown" fallback.
        const ctx = (error as { context?: Response }).context;
        let detail = '';
        let status: number | undefined;
        if (ctx && typeof ctx.text === 'function') {
          status = ctx.status;
          try {
            detail = await ctx.text();
          } catch {
            // body already consumed or unreadable — fall back to message
          }
        }
        const enriched = new Error(
          `delete-account failed${status ? ` (${status})` : ''}: ${detail || (error as Error).message || 'unknown'}`,
        );

        console.warn('[delete-account]', { status, detail, error });
        throw toAppError(enriched);
      }
      await supabase.auth.signOut();
    },
  });
}

export default function DeleteAccount() {
  const { t } = useTranslation();
  const safeBack = useSafeBack('/(tabs)/profile');
  const del = useDeleteAccount();
  const [sheetOpen, setSheetOpen] = useState(false);

  const onConfirm = () => {
    del.mutate(undefined, {
      onSuccess: () => setSheetOpen(false),
    });
  };

  return (
    <Screen scroll glow>
      <View className="mb-6">
        <IconButton icon="chevron-left" onPress={safeBack} />
      </View>

      <View className="items-center mb-6">
        <View
          className="w-20 h-20 rounded-3xl bg-danger/10 border border-danger/40 items-center justify-center mb-5"
          style={{
            shadowColor: '#F87171',
            shadowOpacity: 0.4,
            shadowRadius: 18,
            shadowOffset: { width: 0, height: 8 },
            elevation: 8,
          }}
        >
          <Icon name="trash" size={32} color="#F87171" strokeWidth={2} />
        </View>
        <Text className="text-ink text-2xl font-extrabold tracking-tight text-center">
          {t('deleteAccount.title')}
        </Text>
        <Text className="text-ink-subtle text-sm mt-2 text-center">
          {t('deleteAccount.warning')}
        </Text>
      </View>

      <Card tone="raised" className="mb-6 border border-danger/30">
        <View className="flex-row items-start">
          <Icon name="shield" size={16} color="#F87171" />
          <Text className="text-ink-subtle text-xs ml-2 flex-1 leading-5">
            {t('deleteAccount.permanentNote')}
          </Text>
        </View>
      </Card>

      {del.isError ? (
        <View className="mb-3" style={{ gap: 8 }}>
          <ErrorMessage error={del.error} />
          <View className="bg-bg-subtle border border-border rounded-xl px-3 py-2">
            <Text className="text-ink-muted text-[11px] font-mono leading-4">
              {(() => {
                const e = del.error as { cause?: unknown; message?: string };
                const cause = e?.cause as Error | undefined;
                return cause?.message ?? e?.message ?? String(del.error);
              })()}
            </Text>
          </View>
        </View>
      ) : null}

      <View style={{ gap: 10 }}>
        <Button
          label={t('deleteAccount.confirm')}
          variant="danger"
          icon="trash"
          loading={del.isPending}
          onPress={() => setSheetOpen(true)}
        />
        <Button label={t('deleteAccount.cancel')} variant="secondary" onPress={safeBack} />
      </View>

      <ConfirmSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onConfirm={onConfirm}
        icon="trash"
        tone="danger"
        title={t('deleteAccount.title')}
        body={t('deleteAccount.warning')}
        confirmLabel={t('deleteAccount.confirm')}
        cancelLabel={t('deleteAccount.cancel')}
        loading={del.isPending}
      />
    </Screen>
  );
}
