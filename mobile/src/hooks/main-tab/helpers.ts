import { Alert } from "react-native";
import { formatMessage, type Messages } from "../../i18n";

/** Ventana (ms) durante la cual reusamos el último resultado de ping de un
 *  servidor sin rehacer el handshake SSH. Evita re-sondear en cada carga /
 *  refresh y el parpadeo de "Comprobando" al reentrar a la pantalla. */
export const STATUS_TTL_MS = 45_000;
/** Cada cuánto (ms) volcamos en lote los resultados de ping acumulados. */
export const STATUS_FLUSH_MS = 400;

/** applicationId Android registrado en Play (el backend valida contra él). */
export const IAP_PACKAGE_NAME = "com.luxisoft.lxpanel";

/**
 * TOFU del gateway SSH: en el primer contacto con un servidor el backend exige
 * verificar su huella antes de dejar fluir tráfico. Mostramos la huella y
 * resolvemos `true` solo si el usuario confirma. Compartido por el connect con
 * credenciales guardadas (`openDirectPanelSession`) y con llave local
 * (`submitConnectLocalKey`).
 */
export function confirmHostFingerprint(fingerprint: string, t: Messages): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    Alert.alert(
      t.sshFingerprint.title,
      formatMessage(t.sshFingerprint.body, { fingerprint }),
      [
        { text: t.common.cancel, style: "cancel", onPress: () => resolve(false) },
        { text: t.sshFingerprint.confirm, onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}
