// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { apiLocale, type ApiLocale } from "./errors.js";

export type ResponseMessageKey = "accountTerminated" | "passwordUpdated" | "loggedOut" | "sessionClosed" | "alreadyUpToDate";

const responseMessages: Record<ApiLocale, Record<ResponseMessageKey, string>> = {
  es: { accountTerminated: "Cuenta eliminada junto con todos sus datos asociados", passwordUpdated: "Contraseña actualizada", loggedOut: "Sesión cerrada", sessionClosed: "Sesión de terminal cerrada", alreadyUpToDate: "Ya está actualizado" },
  en: { accountTerminated: "Account terminated and all associated data deleted", passwordUpdated: "Password updated successfully", loggedOut: "Logged out", sessionClosed: "Session closed", alreadyUpToDate: "Already up to date" },
  fr: { accountTerminated: "Compte supprimé avec toutes ses données associées", passwordUpdated: "Mot de passe mis à jour", loggedOut: "Déconnexion effectuée", sessionClosed: "Session de terminal fermée", alreadyUpToDate: "Déjà à jour" },
  de: { accountTerminated: "Konto und alle zugehörigen Daten gelöscht", passwordUpdated: "Passwort aktualisiert", loggedOut: "Abgemeldet", sessionClosed: "Terminalsitzung geschlossen", alreadyUpToDate: "Bereits aktuell" },
  it: { accountTerminated: "Account eliminato con tutti i dati associati", passwordUpdated: "Password aggiornata", loggedOut: "Disconnessione effettuata", sessionClosed: "Sessione del terminale chiusa", alreadyUpToDate: "Già aggiornato" },
  pt: { accountTerminated: "Conta eliminada com todos os dados associados", passwordUpdated: "Palavra-passe atualizada", loggedOut: "Sessão terminada", sessionClosed: "Sessão do terminal fechada", alreadyUpToDate: "Já está atualizado" },
  ar: { accountTerminated: "حُذف الحساب وجميع بياناته المرتبطة", passwordUpdated: "تم تحديث كلمة المرور", loggedOut: "تم تسجيل الخروج", sessionClosed: "أُغلقت جلسة الطرفية", alreadyUpToDate: "محدّث بالفعل" },
  bn: { accountTerminated: "অ্যাকাউন্ট ও সংশ্লিষ্ট সব তথ্য মুছে ফেলা হয়েছে", passwordUpdated: "পাসওয়ার্ড হালনাগাদ হয়েছে", loggedOut: "লগআউট হয়েছে", sessionClosed: "টার্মিনাল সেশন বন্ধ হয়েছে", alreadyUpToDate: "ইতিমধ্যে হালনাগাদ আছে" },
  hi: { accountTerminated: "खाता और उससे जुड़ा सारा डेटा हटा दिया गया", passwordUpdated: "पासवर्ड अपडेट हो गया", loggedOut: "लॉग आउट हो गया", sessionClosed: "टर्मिनल सत्र बंद हो गया", alreadyUpToDate: "पहले से अपडेट है" },
  ja: { accountTerminated: "アカウントと関連データをすべて削除しました", passwordUpdated: "パスワードを更新しました", loggedOut: "ログアウトしました", sessionClosed: "ターミナルセッションを閉じました", alreadyUpToDate: "既に最新です" },
  ko: { accountTerminated: "계정과 관련 데이터를 모두 삭제했습니다", passwordUpdated: "비밀번호를 업데이트했습니다", loggedOut: "로그아웃했습니다", sessionClosed: "터미널 세션을 닫았습니다", alreadyUpToDate: "이미 최신 상태입니다" },
  ru: { accountTerminated: "Учётная запись и все связанные данные удалены", passwordUpdated: "Пароль обновлён", loggedOut: "Выход выполнен", sessionClosed: "Сеанс терминала закрыт", alreadyUpToDate: "Уже обновлено" },
};

export function apiResponseMessage(locale: unknown, key: ResponseMessageKey): string {
  return responseMessages[apiLocale(locale)][key];
}
