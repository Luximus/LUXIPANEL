const openclaw = {
  "pageTitle": "OpenClaw",
  "header": {
    "subtitle": "Connect the panel with",
    "subtitleSuffix": "to use its models and tools."
  },
  "statusCard": {
    "title": "Connection status",
    "descKeySet": "API key configured. Press \"Test connection\" to verify.",
    "descNoKey": "No API key configured yet.",
    "btnTest": "Test connection"
  },
  "form": {
    "sectionTitle": "Credentials and endpoint",
    "sectionDesc": "The API key is stored encrypted in the panel database.",
    "labelEndpoint": "Endpoint",
    "placeholderEndpoint": "https://openclaw.ai",
    "hintEndpoint": "Base URL of the API. Default",
    "labelApiKey": "API key",
    "placeholderApiKeySet": "Configured · {preview}",
    "placeholderApiKeyUnset": "sk-...",
    "ariaToggleKey": "Show or hide",
    "btnClearKey": "Clear",
    "hintApiKey": "Leave blank to keep the current API key.",
    "labelDefaultModel": "Default model",
    "placeholderDefaultModel": "claw-default",
    "hintDefaultModel": "Model identifier used by internal calls that do not specify one.",
    "btnSave": "Save changes"
  },
  "help": {
    "title": "How do I get my API key?",
    "step1": "Sign in to",
    "step2": "Open your account settings and create a new API key.",
    "step3": "Paste it above and save — the panel will not display it in plain text again."
  }
} as const;

export default openclaw;
