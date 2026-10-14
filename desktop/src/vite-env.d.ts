/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_LUXIPANEL_URL?: string;
  readonly VITE_FIREBASE_API_KEY?: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN?: string;
  readonly VITE_FIREBASE_PROJECT_ID?: string;
  readonly VITE_FIREBASE_STORAGE_BUCKET?: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID?: string;
  readonly VITE_FIREBASE_APP_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare global {
  interface Window {
    electronApi?: {
      platform: string;
      chatStream?: (payload: {id:string;url:string;authorization:string}) => Promise<boolean>;
      stopChatStream?: (id:string) => Promise<void>;
      onChatStream?: (callback: (event:{id:string;chunk?:string;closed?:boolean;status?:number})=>void) => ()=>void;
      request: (payload: {
        url: string;
        method?: string;
        headers?: Record<string, string>;
        body?: string;
      }) => Promise<{ ok: boolean; status: number; data: unknown }>;
      /** Como `request`, pero además expone las cabeceras `Set-Cookie` de la
       *  respuesta (blob `\n`-separado). Solo el proceso main puede leerlas;
       *  lo usa el login DIRECTO a un box standalone (`api/directAuth.ts`). */
      requestWithCookies?: (payload: {
        url: string;
        method?: string;
        headers?: Record<string, string>;
        body?: string;
      }) => Promise<{ ok: boolean; status: number; data: unknown; cookies: string }>;
      downloadBinary?: (payload: { url: string; headers?: Record<string, string> }) => Promise<{ ok: boolean; status: number; bytes?: Uint8Array; error?: string }>;
      uploadBinary?: (payload: { url: string; headers?: Record<string, string>; bytes: Uint8Array }) => Promise<{ ok: boolean; status: number; data: unknown }>;
      /** ¿Ofrece el SO cifrado en reposo (Keychain/DPAPI/libsecret)? */
      secureAvailable?: () => Promise<{ available: boolean }>;
      /** Cifra un string con el keychain del SO; devuelve ciphertext base64. */
      secureEncrypt?: (payload: { plaintext: string }) => Promise<{ ok: true; ciphertext: string } | { ok: false; error: string }>;
      /** Descifra un ciphertext base64 producido por `secureEncrypt`. */
      secureDecrypt?: (payload: { ciphertext: string }) => Promise<{ ok: true; plaintext: string } | { ok: false; error: string }>;
      setTitle: (title: string) => Promise<boolean>;
      minimizeWindow: () => Promise<boolean>;
      toggleMaximizeWindow: () => Promise<{ maximized: boolean }>;
      closeWindow: () => Promise<boolean>;
      openExternal: (url: string) => Promise<boolean>;
      pickKeyFile: () => Promise<{ ok: true; content: string } | { ok: false; error?: string }>;
      registerPasskey: (payload: {
        token: string;
        label: string;
        lang?: string;
      }) => Promise<{ ok: boolean; error?: string; cancelled?: boolean }>;
      authenticatePasskey: (payload: {
        email?: string;
        lang?: string;
      }) => Promise<{ ok: boolean; error?: string; cancelled?: boolean; result?: unknown }>;
      stepUpPasskey: (payload: {
        token: string;
        scope: string;
        lang?: string;
      }) => Promise<{
        ok: boolean;
        error?: string;
        cancelled?: boolean;
        stepUpToken?: string;
        expiresAt?: number;
      }>;
      notify: (payload: { title?: string; body?: string }) => Promise<{ ok: boolean; error?: string }>;
      getAppVersion: () => Promise<string>;
      getAppPlatform: () => Promise<"windows" | "mac" | "linux">;
      downloadUpdate: (payload: {
        url: string;
        sha256?: string | null;
        suggestedName?: string;
      }) => Promise<{ ok: true; path: string; bytes: number; downloadId: string } | { ok: false; error: string }>;
      installUpdate: (payload: { path: string }) => Promise<{ ok: true } | { ok: false; error: string }>;
      onUpdateProgress: (cb: (data: { downloadId: string; received: number; total: number }) => void) => () => void;
      onDeeplink: (cb: (url: string) => void) => () => void;
    };
  }

  namespace JSX {
    interface IntrinsicElements {
      webview: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        src?: string;
        partition?: string;
        allowpopups?: string | boolean;
      };
    }
  }
}

export {};
