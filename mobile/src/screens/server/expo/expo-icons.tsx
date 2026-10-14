/**
 * expo-icons — iconos que faltan en `tabler-icons.tsx`: se definen localmente
 * (regla del módulo) con `react-native-svg`, mismo estilo Tabler outline
 * (viewBox 24, stroke 2, fill none). `color` lo inyecta `Button` al clonar el
 * icono. Extraídos de ExpoScreen para compartirlos con sus diálogos.
 */
import React from "react";
import Svg, { Path } from "react-native-svg";

function makeLocalIcon(paths: readonly string[]) {
  return function LocalIcon({ size = 24, color = "currentColor" }: { size?: number; color?: string }) {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        {paths.map((d, i) => (
          <Path key={i} d={d} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        ))}
      </Svg>
    );
  };
}
// ti-cloud-upload (publicar actualización OTA)
export const IconCloudUpload = makeLocalIcon([
  "M7 18a4.6 4.4 0 0 1 0 -9a5 4.5 0 0 1 11 2h1a3.5 3.5 0 0 1 0 7h-1",
  "M9 15l3 -3l3 3",
  "M12 12l0 9",
]);
// ti-device-mobile (probar en dispositivo / dev-client)
export const IconDeviceMobile = makeLocalIcon([
  "M6 5a2 2 0 0 1 2 -2h8a2 2 0 0 1 2 2v14a2 2 0 0 1 -2 2h-8a2 2 0 0 1 -2 -2v-14z",
  "M11 4h2",
  "M12 17v.01",
]);
// ti-player-stop (detener servidor de pruebas)
export const IconPlayerStop = makeLocalIcon([
  "M5 5m0 2a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2v10a2 2 0 0 1 -2 2h-10a2 2 0 0 1 -2 -2z",
]);
// ti-shield-lock (pestaña Credenciales)
export const IconShieldLock = makeLocalIcon([
  "M12 3a12 12 0 0 0 8.5 3a12 12 0 0 1 -8.5 15a12 12 0 0 1 -8.5 -15a12 12 0 0 0 8.5 -3",
  "M12 11m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0",
  "M12 12l0 2.5",
]);
// ti-webhook (registrar webhook EAS)
export const IconWebhook = makeLocalIcon([
  "M4.876 13.61a4 4 0 1 0 6.124 3.39h6",
  "M15.066 20.502a4 4 0 1 0 -2.124 -7.502c-.706 0 -1.424 .179 -2 .5l-2.94 -5.5",
  "M8.5 6.5l-3 5.5",
]);
