import { nativeText } from '../../../i18n/native-text';
/**
 * settings-connectors — catálogos de conectores de credenciales del módulo
 * Ajustes (tokens por módulo + almacenamiento de backups). Contienen JSX
 * (iconos), por eso viven aparte de settings-types. Extraídos sin cambios.
 */
import React from "react";
import {
  TablerBrandCloudflare,
  TablerBrandReactNative,
  TablerSparkles,
  TablerBrandGithub,
  TablerShieldCheck,
  TablerDatabase,
} from "../../../features/app/tabler-icons";
import type { TokenConnector } from "./settings-types";

export const TOKEN_CONNECTORS: TokenConnector[] = [
  { id: "cloudflare", get label() { return nativeText("Cloudflare"); }, icon: <TablerBrandCloudflare size={20} />, base: "/api/cloudflare/config", del: "/api/cloudflare/config", test: "/api/cloudflare/test", putKey: "apiToken", setField: "tokenSet", previewField: "tokenPreview", gate: "cloudflare" },
  { id: "expo", label: "Expo (EAS)", icon: <TablerBrandReactNative size={20} />, base: "/api/expo/config", del: "/api/expo/config", putKey: "token", setField: "tokenSet", previewField: "tokenPreview", gate: "expo" },
  { id: "openclaw", get label() { return nativeText("OpenClaw"); }, icon: <TablerSparkles size={20} />, base: "/api/openclaw/config", del: "/api/openclaw/api-key", test: "/api/openclaw/test", putKey: "apiKey", setField: "apiKeySet", previewField: "apiKeyPreview", gate: "openclaw" },
  { id: "repository-store", label: "GitHub", icon: <TablerBrandGithub size={20} />, base: "/api/admin/repository-store/config", del: "/api/admin/repository-store/config", putKey: "token", setField: "tokenConfigured", gate: undefined },
  { id: "bitninja", get label() { return nativeText("BitNinja"); }, icon: <TablerShieldCheck size={20} />, base: "/api/bitninja/config", del: "/api/bitninja/config", putKey: "licenseKey", setField: "tokenSet", previewField: "tokenPreview", gate: "bitninja" },
];

export const STORAGE_CONNECTORS = [
  { provider: "r2", label: "Cloudflare R2", icon: <TablerBrandCloudflare size={20} /> },
  { provider: "s3", label: "Amazon S3", icon: <TablerDatabase size={20} /> },
];

