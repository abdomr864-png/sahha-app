import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { aiClient, AIError, type GenerateWorkoutRequest } from '@lib/llm';
import { useDraftRoutineStore } from '../store';

interface State {
  loading: boolean;
  errorCode: string | null;
}

export function useGenerateWorkout() {
  const { i18n } = useTranslation();
  const [state, setState] = useState<State>({ loading: false, errorCode: null });
  const setWorkout = useDraftRoutineStore((s) => s.setWorkout);

  const generate = async (req: Omit<GenerateWorkoutRequest, 'locale'>) => {
    setState({ loading: true, errorCode: null });
    try {
      const locale = (i18n.language as 'fr' | 'ar' | 'en') ?? 'en';
      const res = await aiClient.generateWorkout({ ...req, locale });
      setWorkout({ generation_id: res.generation_id, workout: res.workout });
      setState({ loading: false, errorCode: null });
      return res;
    } catch (e) {
      const code = e instanceof AIError ? e.code : 'provider_error';
      setState({ loading: false, errorCode: code });
      throw e;
    }
  };

  return { generate, ...state };
}
