import type { ChatPreferences } from "./use-server-preferences";
const views = new Map<string, { convId: string | null; visible: boolean }>(),
  preferences = new Map<string, ChatPreferences>();
export const getChatActivity = (id: string) => views.get(id);
export const getCachedChatPreferences = (id: string) => preferences.get(id);
export const publishChatPreferences = (id: string, value: ChatPreferences) => {
  preferences.set(id, value);
};
export const trackChatActivity = (
  id: string,
  value: { convId: string | null; visible: boolean },
) => {
  views.set(id, value);
  return () => {
    if (views.get(id) === value) views.delete(id);
  };
};
export const clearChatPreferences = (id: string) => preferences.delete(id);
