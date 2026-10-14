// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { API_LOCALES, apiLocale } from "../../../shared/i18n/errors.js";
import type { DiagnosticCheck } from "../services/diagnostics.service.js";

type Translations = readonly [string, string, string, string, string, string, string, string, string, string, string, string];
const labels = {
  "MX record": ["Registro MX", "MX record", "Enregistrement MX", "MX-Eintrag", "Record MX", "Registo MX", "سجل MX", "MX রেকর্ড", "MX रिकॉर्ड", "MX レコード", "MX 레코드", "Запись MX"],
  "SPF record": ["Registro SPF", "SPF record", "Enregistrement SPF", "SPF-Eintrag", "Record SPF", "Registo SPF", "سجل SPF", "SPF রেকর্ড", "SPF रिकॉर्ड", "SPF レコード", "SPF 레코드", "Запись SPF"],
  "DMARC record": ["Registro DMARC", "DMARC record", "Enregistrement DMARC", "DMARC-Eintrag", "Record DMARC", "Registo DMARC", "سجل DMARC", "DMARC রেকর্ড", "DMARC रिकॉर्ड", "DMARC レコード", "DMARC 레코드", "Запись DMARC"],
  "DKIM (mail)": ["DKIM (correo)", "DKIM (mail)", "DKIM (courriel)", "DKIM (E-Mail)", "DKIM (posta)", "DKIM (correio)", "DKIM (البريد)", "DKIM (ইমেইল)", "DKIM (ईमेल)", "DKIM（メール）", "DKIM(메일)", "DKIM (почта)"],
  "Reverse DNS": ["DNS inverso", "Reverse DNS", "DNS inverse", "Reverse DNS", "DNS inverso", "DNS inverso", "DNS العكسي", "বিপরীত DNS", "रिवर्स DNS", "逆引き DNS", "역방향 DNS", "Обратный DNS"],
  "MX records found": ["Se encontraron registros MX", "MX records found", "Enregistrements MX trouvés", "MX-Einträge gefunden", "Record MX trovati", "Registos MX encontrados", "عُثر على سجلات MX", "MX রেকর্ড পাওয়া গেছে", "MX रिकॉर्ड मिले", "MX レコードが見つかりました", "MX 레코드를 찾았습니다", "Записи MX найдены"],
  "No MX records found": ["No se encontraron registros MX", "No MX records found", "Aucun enregistrement MX trouvé", "Keine MX-Einträge gefunden", "Nessun record MX trovato", "Nenhum registo MX encontrado", "لم يُعثر على سجلات MX", "MX রেকর্ড পাওয়া যায়নি", "MX रिकॉर्ड नहीं मिले", "MX レコードが見つかりません", "MX 레코드를 찾을 수 없습니다", "Записи MX не найдены"],
  "SPF record present": ["Hay un registro SPF", "SPF record present", "Enregistrement SPF présent", "SPF-Eintrag vorhanden", "Record SPF presente", "Registo SPF presente", "سجل SPF موجود", "SPF রেকর্ড আছে", "SPF रिकॉर्ड मौजूद है", "SPF レコードがあります", "SPF 레코드가 있습니다", "Запись SPF есть"],
  "No SPF record found": ["No se encontró un registro SPF", "No SPF record found", "Aucun enregistrement SPF trouvé", "Kein SPF-Eintrag gefunden", "Nessun record SPF trovato", "Nenhum registo SPF encontrado", "لم يُعثر على سجل SPF", "SPF রেকর্ড পাওয়া যায়নি", "SPF रिकॉर्ड नहीं मिला", "SPF レコードが見つかりません", "SPF 레코드를 찾을 수 없습니다", "Запись SPF не найдена"],
  "DMARC record present": ["Hay un registro DMARC", "DMARC record present", "Enregistrement DMARC présent", "DMARC-Eintrag vorhanden", "Record DMARC presente", "Registo DMARC presente", "سجل DMARC موجود", "DMARC রেকর্ড আছে", "DMARC रिकॉर्ड मौजूद है", "DMARC レコードがあります", "DMARC 레코드가 있습니다", "Запись DMARC есть"],
  "No DMARC record found": ["No se encontró un registro DMARC", "No DMARC record found", "Aucun enregistrement DMARC trouvé", "Kein DMARC-Eintrag gefunden", "Nessun record DMARC trovato", "Nenhum registo DMARC encontrado", "لم يُعثر على سجل DMARC", "DMARC রেকর্ড পাওয়া যায়নি", "DMARC रिकॉर्ड नहीं मिला", "DMARC レコードが見つかりません", "DMARC 레코드를 찾을 수 없습니다", "Запись DMARC не найдена"],
  "DKIM key found": ["Se encontró una clave DKIM", "DKIM key found", "Clé DKIM trouvée", "DKIM-Schlüssel gefunden", "Chiave DKIM trovata", "Chave DKIM encontrada", "عُثر على مفتاح DKIM", "DKIM কী পাওয়া গেছে", "DKIM कुंजी मिली", "DKIM キーが見つかりました", "DKIM 키를 찾았습니다", "Ключ DKIM найден"],
  "No DKIM key found": ["No se encontró una clave DKIM", "No DKIM key found", "Aucune clé DKIM trouvée", "Kein DKIM-Schlüssel gefunden", "Nessuna chiave DKIM trovata", "Nenhuma chave DKIM encontrada", "لم يُعثر على مفتاح DKIM", "DKIM কী পাওয়া যায়নি", "DKIM कुंजी नहीं मिली", "DKIM キーが見つかりません", "DKIM 키를 찾을 수 없습니다", "Ключ DKIM не найден"],
  "Could not resolve MX IP": ["No se pudo resolver la IP del servidor MX", "Could not resolve MX IP", "Impossible de résoudre l’adresse IP du serveur MX", "Die IP-Adresse des MX-Servers konnte nicht aufgelöst werden", "Impossibile risolvere l’IP del server MX", "Não foi possível resolver o IP do servidor MX", "تعذّر تحديد عنوان IP لخادم MX", "MX সার্ভারের IP নির্ধারণ করা যায়নি", "MX सर्वर का IP पता नहीं मिला", "MX サーバーの IP アドレスを解決できませんでした", "MX 서버의 IP 주소를 확인할 수 없습니다", "Не удалось определить IP-адрес MX-сервера"],
  "No reverse DNS for MX IP": ["La IP del servidor MX no tiene DNS inverso", "No reverse DNS for MX IP", "Pas de DNS inverse pour l’adresse IP du serveur MX", "Für die IP-Adresse des MX-Servers gibt es keinen Reverse-DNS-Eintrag", "Nessun DNS inverso per l’IP del server MX", "O IP do servidor MX não tem DNS inverso", "لا يوجد DNS عكسي لعنوان IP لخادم MX", "MX সার্ভারের IP-এর জন্য বিপরীত DNS নেই", "MX सर्वर के IP के लिए रिवर्स DNS नहीं है", "MX サーバーの IP アドレスに逆引き DNS がありません", "MX 서버 IP의 역방향 DNS가 없습니다", "Для IP-адреса MX-сервера нет обратной DNS-записи"],
  "dig not available": ["La herramienta dig no está disponible", "The dig tool is unavailable", "L’outil dig est indisponible", "Das Tool dig ist nicht verfügbar", "Lo strumento dig non è disponibile", "A ferramenta dig não está disponível", "أداة dig غير متاحة", "dig টুলটি উপলব্ধ নেই", "dig टूल उपलब्ध नहीं है", "dig ツールを利用できません", "dig 도구를 사용할 수 없습니다", "Утилита dig недоступна"],
} as const satisfies Record<string, Translations>;

const responseLanguage: Record<(typeof API_LOCALES)[number], string> = {
  es: "español", en: "inglés", fr: "francés", de: "alemán", it: "italiano", pt: "portugués", ar: "árabe", bn: "bengalí", hi: "hindi", ja: "japonés", ko: "coreano", ru: "ruso",
};

export function diagnosticResponseLanguage(locale: unknown): string {
  return responseLanguage[apiLocale(locale)];
}

export function localizeDiagnosticChecks(locale: unknown, checks: DiagnosticCheck[]): DiagnosticCheck[] {
  const index = API_LOCALES.indexOf(apiLocale(locale));
  const translate = (value: string) => labels[value as keyof typeof labels]?.[index] ?? value;
  return checks.map((check) => ({ ...check, name: translate(check.name), message: translate(check.message) }));
}
