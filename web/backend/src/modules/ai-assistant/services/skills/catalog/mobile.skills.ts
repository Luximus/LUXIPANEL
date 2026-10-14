// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import type { AssistantSkill } from "../skill.types.js";
import { catalogSkill } from "./factory.js";

export const mobileSkills: AssistantSkill[] = [
  catalogSkill({
    id: "expo",
    name: "Expo",
    category: "mobile",
    source: "https://docs.expo.dev/",
    description:
      "Guía al agente a desarrollar apps React Native con Expo (expo-router, módulos, config plugins).",
    block:
      "Arranca con npx create-expo-app@latest; un solo proyecto TS corre nativo en iOS/Android/web. Rutas por archivos en app/ con Expo Router. Prefiere paquetes expo-* sobre librerías nativas crudas; añade nativo con config plugins en app.json/app.config.js, no editando ios/android a mano (los regenera npx expo prebuild). Usa expo-dev-client para probar módulos nativos. Lee secretos vía app config/EAS env. Corre npx expo-doctor antes de builds.",
  }),
  catalogSkill({
    id: "eas-build",
    name: "EAS Build",
    category: "mobile",
    source: "https://docs.expo.dev/build/introduction/",
    description:
      "Orienta al agente a compilar binarios iOS/Android en la nube con EAS Build y perfiles eas.json.",
    block:
      "Servicio en la nube que compila binarios iOS/Android. Define perfiles en eas.json (development/preview/production); production firma para tiendas. eas build --profile <p> --platform all|android|ios (o --local). Deja que EAS genere/gestione keystore Android y certs/perfiles iOS; guarda secretos con eas env. distribution:\"internal\" da APK/ad-hoc por URL para QA antes de submit; autoIncrement sube versiones; --auto-submit encadena el envío. No commitees keystores ni perfiles de aprovisionamiento.",
  }),
  catalogSkill({
    id: "eas-services",
    name: "EAS Services",
    category: "mobile",
    source: "https://docs.expo.dev/eas/",
    description:
      "Ayuda al agente a usar el ecosistema EAS (Submit, Update/OTA, Workflows) end-to-end.",
    block:
      "Combina Build con Submit (eas submit entrega a App Store/Play) y Update (eas update, parches OTA de JS/assets sin pasar por la tienda). Alinea runtimeVersion entre build y update o el OTA no aplica. Enruta updates por canales/ramas (preview vs production). Automatiza build→submit→update con EAS Workflows (CI/CD). OTA solo cambia JS/assets; cambios nativos exigen rebuild. Revierte publicando un update previo. EAS Hosting sirve apps web/API routes.",
  }),
  catalogSkill({
    id: "react-native",
    name: "React Native",
    category: "mobile",
    source: "https://reactnative.dev/docs/getting-started",
    description:
      "Guía al agente a construir UIs nativas con React Native (componentes core, estilos, plataforma).",
    block:
      "Usa componentes core (View/Text/Pressable/FlatList) y StyleSheet con flexbox; nada de divs ni CSS del DOM. FlatList para listas largas, no map en ScrollView. Diferencias por plataforma con Platform.select/.ios./.android. Cuida hilo JS vs UI: evita trabajo pesado en render. Maneja safe areas e inputs (KeyboardAvoidingView). Activa la New Architecture en proyectos nuevos.",
  }),
  catalogSkill({
    id: "firebase-auth",
    name: "Firebase Auth",
    category: "mobile",
    source: "https://firebase.google.com/docs/auth",
    description:
      "Orienta al agente a implementar autenticación con Firebase Auth (providers, tokens, sesión).",
    block:
      "Usa el SDK de Firebase Auth y escucha onAuthStateChanged como única fuente de verdad de la sesión. Verifica en el backend con Admin SDK (verifyIdToken), nunca confíes en datos del cliente. Refresca ID tokens (caducan ~1h) en vez de cachearlos. Aplica permisos con custom claims + reglas de seguridad. No expongas claves de servicio en el cliente; valida email/proveedores según tu política.",
  }),
];
