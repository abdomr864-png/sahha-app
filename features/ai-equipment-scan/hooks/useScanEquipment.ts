import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { aiClient, AIError } from '@lib/llm';
import { uploadScanImage } from '../repositories/scans';
import { useScanResultStore } from '../store';

interface State {
  loading: boolean;
  errorCode: string | null;
}

export function useScanEquipment() {
  const { i18n } = useTranslation();
  const [state, setState] = useState<State>({ loading: false, errorCode: null });
  const setResult = useScanResultStore((s) => s.setResult);

  const scan = async (userId: string, imageUri: string) => {
    setState({ loading: true, errorCode: null });
    try {
      const { signedUrl } = await uploadScanImage(userId, imageUri);
      const locale = (i18n.language as 'fr' | 'ar' | 'en') ?? 'en';
      const result = await aiClient.scanEquipment({ image_url: signedUrl, locale });
      setResult(result, signedUrl);
      setState({ loading: false, errorCode: null });
      return result;
    } catch (e) {
      const code = e instanceof AIError ? e.code : 'provider_error';
      setState({ loading: false, errorCode: code });
      throw e;
    }
  };

  return { scan, ...state };
}
