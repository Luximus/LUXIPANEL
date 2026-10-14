import { useSyncExternalStore } from 'react';
import { loadSessionState, subscribeSessionState } from '../lib/session-state';

const getLanguage = () => loadSessionState().language;
/** A language change updates mounted drawers without disposing their forms. */
export function useLanguage(): string {
  return useSyncExternalStore(subscribeSessionState, getLanguage, getLanguage);
}
