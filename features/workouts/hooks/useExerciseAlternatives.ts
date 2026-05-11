import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { aiClient, AIError, type ExerciseAlternativesResponse } from '@lib/llm';

interface State {
  loading: boolean;
  errorCode: string | null;
  data: ExerciseAlternativesResponse['alternatives'] | null;
}

export function useExerciseAlternatives() {
  const { i18n } = useTranslation();
  const [state, setState] = useState<State>({ loading: false, errorCode: null, data: null });

  const fetch = async (exerciseId: string, reason?: 'injury' | 'no_equipment' | 'variety') => {
    setState({ loading: true, errorCode: null, data: null });
    try {
      const locale = (i18n.language as 'fr' | 'ar' | 'en') ?? 'en';
      const res = await aiClient.exerciseAlternatives({
        exercise_id: exerciseId,
        reason,
        locale,
      });
      setState({ loading: false, errorCode: null, data: res.alternatives });
      return res.alternatives;
    } catch (e) {
      const code = e instanceof AIError ? e.code : 'provider_error';
      setState({ loading: false, errorCode: code, data: null });
      throw e;
    }
  };

  return { fetch, ...state };
}
