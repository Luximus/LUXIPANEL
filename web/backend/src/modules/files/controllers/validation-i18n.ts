// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/** Localized editor validation results. Validator IDs and parser diagnostics stay stable. */
import { API_LOCALES, apiLocale } from "../../../shared/i18n/errors.js";
import type { ValidationResult } from "../services/validation.service.js";

type Translations = readonly [string, string, string, string, string, string, string, string, string, string, string, string];
const messages = {
  json: ["JSON no válido", "Invalid JSON", "JSON invalide", "Ungültiges JSON", "JSON non valido", "JSON inválido", "JSON غير صالح", "অবৈধ JSON", "अमान्य JSON", "JSON が無効です", "잘못된 JSON", "Некорректный JSON"],
  env: ["Línea no válida (se esperaba CLAVE=valor): «{text}»", "Invalid line (expected KEY=value): “{text}”", "Ligne invalide (CLÉ=valeur attendu) : « {text} »", "Ungültige Zeile (SCHLÜSSEL=Wert erwartet): „{text}“", "Riga non valida (previsto CHIAVE=valore): «{text}»", "Linha inválida (esperado CHAVE=valor): «{text}»", "سطر غير صالح (المتوقع مفتاح=قيمة): «{text}»", "লাইনটি অবৈধ (KEY=value প্রত্যাশিত): “{text}”", "अमान्य पंक्ति (कुंजी=मान अपेक्षित): “{text}”", "無効な行です（KEY=値 が必要）:「{text}」", "잘못된 줄입니다(KEY=값 필요): ‘{text}’", "Некорректная строка (ожидается КЛЮЧ=значение): «{text}»"],
  closingBrace: ["Llave de cierre «}» sin apertura correspondiente.", "Closing brace “}” has no matching opening brace.", "Accolade fermante « } » sans accolade ouvrante correspondante.", "Schließende Klammer „}“ ohne passende öffnende Klammer.", "Parentesi graffa di chiusura «}» senza apertura corrispondente.", "Chaveta de fecho «}» sem abertura correspondente.", "القوس «}» ليس له قوس فتح مطابق.", "বন্ধনী ‘}’-এর মিলযুক্ত খোলা বন্ধনী নেই।", "समापन ब्रैकेट ‘}’ के लिए मेल खाता प्रारंभिक ब्रैकेट नहीं है।", "閉じ波かっこ「}」に対応する開き波かっこがありません。", "닫는 중괄호 ‘}’에 대응하는 여는 중괄호가 없습니다.", "Для закрывающей скобки «}» нет открывающей."],
  missingBraces: ["Faltan {count} llave(s) de cierre «}».", "Missing {count} closing brace(s) “}”.", "Il manque {count} accolade(s) fermante(s) « } ».", "Es fehlen {count} schließende Klammer(n) „}“.", "Mancano {count} parentesi graffe di chiusura «}».", "Faltam {count} chavetas de fecho «}».", "ينقص {count} من أقواس الإغلاق «}».", "‘}’ বন্ধনী {count}টি অনুপস্থিত।", "समापन ब्रैकेट ‘}’ की संख्या {count} कम है।", "閉じ波かっこ「}」が {count} 個不足しています。", "닫는 중괄호 ‘}’가 {count}개 부족합니다.", "Не хватает {count} закрывающих скобок «}»."],
  yaml: ["YAML no válido", "Invalid YAML", "YAML invalide", "Ungültiges YAML", "YAML non valido", "YAML inválido", "YAML غير صالح", "অবৈধ YAML", "अमान्य YAML", "YAML が無効です", "잘못된 YAML", "Некорректный YAML"],
  php: ["Error de sintaxis PHP", "PHP syntax error", "Erreur de syntaxe PHP", "PHP-Syntaxfehler", "Errore di sintassi PHP", "Erro de sintaxe PHP", "خطأ في صياغة PHP", "PHP সিনট্যাক্স ত্রুটি", "PHP सिंटैक्स त्रुटि", "PHP 構文エラー", "PHP 구문 오류", "Синтаксическая ошибка PHP"],
} as const satisfies Record<string, Translations>;

export function localizeFileValidation(locale: unknown, result: ValidationResult): ValidationResult {
  const index = API_LOCALES.indexOf(apiLocale(locale));
  const phrase = (key: keyof typeof messages) => messages[key][index] ?? messages[key][1];
  return {
    ...result,
    errors: result.errors.map((error) => {
      const source = error.message;
      let message = source;
      if (source === "JSON no válido") message = phrase("json");
      else if (source === "Llave de cierre «}» sin apertura correspondiente.") message = phrase("closingBrace");
      else if (source === "YAML no válido") message = phrase("yaml");
      else if (source === "Error de sintaxis PHP") message = phrase("php");
      else {
        const env = /^Línea no válida \(se esperaba CLAVE=valor\): "([\s\S]*)"$/.exec(source);
        const braces = /^Faltan (\d+) llave\(s\) de cierre «}»\.$/.exec(source);
        if (env) message = phrase("env").replace("{text}", () => env[1] ?? "");
        else if (braces) message = phrase("missingBraces").replace("{count}", braces[1] ?? "");
      }
      return { ...error, message };
    }),
  };
}
