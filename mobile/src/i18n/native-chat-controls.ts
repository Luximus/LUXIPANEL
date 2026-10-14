import messages from "./native-chat-controls.json";
export const nativeChatControls = (language = "en"): typeof messages.en => (messages as Record<string,typeof messages.en>)[language.split("-")[0]] ?? messages.en;
