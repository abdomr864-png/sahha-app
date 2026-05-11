import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { aiClient, AIError, type GenerateProgramRequest } from '@lib/llm';
import { useDraftRoutineStore } from '../store';

interface State {
  loading: boolean;
  errorCode: string | null;
}

export function useGenerateProgram() {
  const { i18n } = useTranslation();
  const [state, setState] = useState<State>({ loading: false, errorCode: null });
  const setProgram = useDraftRoutineStore((s) => s.setProgram);

  const generate = async (req: Omit<GenerateProgramRequest, 'locale'>) => {
    setState({ loading: true, errorCode: null });
    try {
      const locale = (i18n.language as 'fr' | 'ar' | 'en') ?? 'en';
      const res = await aiClient.generateProgram({ ...req, locale, mode: 'preview' });
      if (res.program) {
        setProgram(res.program, {
          goal: req.goal,
          weeks: req.weeks,
          days_per_week: req.days_per_week,
        });
      }
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
