import React from "react";
import { Text, View } from "react-native";
import { Check, Coins, X } from "lucide-react-native";
import { useTheme } from "../hooks/useTheme";
import { getThemeTokens } from "../theme/colors";
import { Modal } from "./ui/Modal";
import { Button } from "./ui/Button";

/** Resultado de una compra (IAP) de tokens para mostrar en el modal post-compra.
 *  `quantity` es el monto de tokens del pack. Tipo estructural — el controller
 *  usa la misma forma sin importar este símbolo. */
export type PurchaseResultState = {
  status: "success" | "error";
  kind: "tokens";
  quantity?: number;
  name: string;
};

type Strings = {
  okTitle: string;
  okMsg: string;
  failTitle: string;
  failMsg: string;
  ok: string;
  tokensUnit: string;
};

// i18n local (mismo set de locales que el resto de la app). Se elige por prefijo
// de 2 letras del idioma; fallback a es.
const STRINGS: Record<string, Strings> = {
  es: { okTitle: "¡Compra exitosa!", okMsg: "Tu compra se procesó correctamente.", failTitle: "No se pudo completar la compra", failMsg: "No pudimos procesar tu compra. Si se realizó el cobro, contáctanos y lo resolvemos.", ok: "Entendido", tokensUnit: "tokens" },
  en: { okTitle: "Purchase complete!", okMsg: "Your purchase was processed successfully.", failTitle: "Purchase couldn't be completed", failMsg: "We couldn't process your purchase. If you were charged, contact us and we'll sort it out.", ok: "Got it", tokensUnit: "tokens" },
  fr: { okTitle: "Achat réussi !", okMsg: "Votre achat a été traité avec succès.", failTitle: "Achat non finalisé", failMsg: "Nous n'avons pas pu traiter votre achat. Si vous avez été débité, contactez-nous et nous le résoudrons.", ok: "Compris", tokensUnit: "jetons" },
  pt: { okTitle: "Compra concluída!", okMsg: "Sua compra foi processada com sucesso.", failTitle: "Não foi possível concluir a compra", failMsg: "Não conseguimos processar sua compra. Se você foi cobrado, fale conosco e resolveremos.", ok: "Entendi", tokensUnit: "tokens" },
  it: { okTitle: "Acquisto completato!", okMsg: "Il tuo acquisto è stato elaborato correttamente.", failTitle: "Impossibile completare l'acquisto", failMsg: "Non siamo riusciti a elaborare il tuo acquisto. Se ti è stato addebitato, contattaci e lo risolveremo.", ok: "Ho capito", tokensUnit: "token" },
  ru: { okTitle: "Покупка завершена!", okMsg: "Ваша покупка успешно обработана.", failTitle: "Не удалось завершить покупку", failMsg: "Не удалось обработать покупку. Если средства списаны, свяжитесь с нами, и мы всё решим.", ok: "Понятно", tokensUnit: "токенов" },
  zh: { okTitle: "购买成功！", okMsg: "您的购买已成功处理。", failTitle: "购买未完成", failMsg: "我们无法处理您的购买。如果已扣款，请联系我们，我们会为您解决。", ok: "知道了", tokensUnit: "代币" },
  ko: { okTitle: "구매 완료!", okMsg: "구매가 정상적으로 처리되었습니다.", failTitle: "구매를 완료하지 못했습니다", failMsg: "구매를 처리하지 못했습니다. 결제가 되었다면 문의해 주시면 해결해 드리겠습니다.", ok: "확인", tokensUnit: "토큰" },
  ja: { okTitle: "購入が完了しました！", okMsg: "購入が正常に処理されました。", failTitle: "購入を完了できませんでした", failMsg: "購入を処理できませんでした。請求が発生した場合はお問い合わせください。解決いたします。", ok: "了解", tokensUnit: "トークン" },
  hi: { okTitle: "खरीद पूरी हुई!", okMsg: "आपकी खरीद सफलतापूर्वक संसाधित हो गई।", failTitle: "खरीद पूरी नहीं हो सकी", failMsg: "हम आपकी खरीद संसाधित नहीं कर सके। यदि आपसे शुल्क लिया गया है, तो हमसे संपर्क करें, हम इसे हल कर देंगे।", ok: "समझ गया", tokensUnit: "टोकन" },
  ar: { okTitle: "تمت عملية الشراء بنجاح!", okMsg: "تمت معالجة عملية الشراء بنجاح.", failTitle: "تعذّر إتمام عملية الشراء", failMsg: "تعذّر علينا معالجة عملية الشراء. إذا تم خصم المبلغ، تواصل معنا وسنحل المشكلة.", ok: "حسناً", tokensUnit: "رمز" },
};

function strings(language?: string): Strings {
  return STRINGS[(language ?? "es").slice(0, 2)] ?? STRINGS.es;
}

function groupNumber(n: number): string {
  try { return n.toLocaleString(); } catch { return String(n); }
}

/** Modal de resultado post-compra: icono central del producto (derivado por tipo),
 *  la cantidad comprada y, según el estado final (éxito/fracaso), un mensaje. */
export function PurchaseResultModal({
  state,
  onClose,
  language,
}: {
  state: PurchaseResultState | null;
  onClose: () => void;
  language?: string;
}) {
  const { theme } = useTheme();
  const tokens = getThemeTokens(theme === "dark");
  const s = strings(language);

  const success = state?.status === "success";
  const ProductIcon = Coins;
  const badge = success ? "#22c55e" : tokens.danger;
  const quantityText = `${groupNumber(state?.quantity ?? 0)} ${s.tokensUnit}`;
  // El nombre del pack es secundario a la cantidad de tokens comprados.
  const secondary = state?.name;

  return (
    <Modal
      visible={!!state}
      onClose={onClose}
      language={language}
      footer={<Button label={s.ok} variant="primary" onPress={onClose} />}
    >
      <View style={{ alignItems: "center", gap: 12, paddingVertical: 6 }}>
        <View
          style={{
            width: 88,
            height: 88,
            borderRadius: 44,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: `${tokens.brand}1A`,
          }}
        >
          <ProductIcon size={42} color={tokens.brand} />
          {/* Badge de estado (check/x) superpuesto */}
          <View
            style={{
              position: "absolute",
              right: -2,
              bottom: -2,
              width: 32,
              height: 32,
              borderRadius: 16,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: tokens.bgCardSolid,
            }}
          >
            <View
              style={{
                width: 26,
                height: 26,
                borderRadius: 13,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: badge,
              }}
            >
              {success ? <Check size={16} color="#ffffff" /> : <X size={16} color="#ffffff" />}
            </View>
          </View>
        </View>

        <Text style={{ color: tokens.textPrimary, fontSize: 22, fontWeight: "800", textAlign: "center" }}>
          {quantityText}
        </Text>
        {secondary ? (
          <Text style={{ color: tokens.textMuted, fontSize: 14, textAlign: "center", marginTop: -4 }}>
            {secondary}
          </Text>
        ) : null}

        <Text
          style={{
            color: success ? tokens.textPrimary : tokens.danger,
            fontSize: 16,
            fontWeight: "700",
            textAlign: "center",
            marginTop: 6,
          }}
        >
          {success ? s.okTitle : s.failTitle}
        </Text>
        <Text style={{ color: tokens.textSecondary, fontSize: 14, lineHeight: 20, textAlign: "center" }}>
          {success ? s.okMsg : s.failMsg}
        </Text>
      </View>
    </Modal>
  );
}
