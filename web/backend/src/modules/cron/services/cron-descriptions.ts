// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/** User-facing descriptions of common five-field crontab schedules. */
import { apiLocale, type ApiLocale } from "../../../shared/i18n/errors.js";

type CronWords = Record<"reboot" | "hourly" | "midnight" | "weekly" | "monthly" | "yearly" | "everyMinute" | "everyMinutes" | "minutesWindow" | "hourlyAtMinute" | "everyHoursAtMinute" | "atTime" | "weekday" | "monthDay" | "daily" | "weekdayRange" | "invalidExpression" | "expectedFields" | "emptyField" | "invalidField" | "outOfRange", string>;
const words: Record<ApiLocale, CronWords> = {
  es: {
    reboot: "Al arrancar el servidor",
    hourly: "Cada hora (minuto 0)",
    midnight: "Todos los días a medianoche",
    weekly: "Cada domingo a medianoche",
    monthly: "El día 1 de cada mes a medianoche",
    yearly: "El 1 de enero a medianoche",
    everyMinute: "Cada minuto",
    everyMinutes: "cada {count} minutos",
    minutesWindow: "{interval}, de {from}:00 a {to}:59",
    hourlyAtMinute: "Cada hora, en el minuto {minute}",
    everyHoursAtMinute: "cada {count} horas (minuto {minute})",
    atTime: "a las {time}",
    weekday: "Cada {days}",
    monthDay: "El día {day} de cada mes",
    daily: "Todos los días",
    weekdayRange: "{from} a {to}",
    invalidExpression: "Expresión cron inválida: {error}",
    expectedFields: "Se esperaban 5 o 6 campos",
    emptyField: "Campo vacío",
    invalidField: "Campo «{field}» inválido",
    outOfRange: "Campo «{field}» fuera de rango [{min}-{max}]",
  },
  en: {
    reboot: "At server startup",
    hourly: "Every hour (minute 0)",
    midnight: "Every day at midnight",
    weekly: "Every Sunday at midnight",
    monthly: "On day 1 of each month at midnight",
    yearly: "On January 1 at midnight",
    everyMinute: "Every minute",
    everyMinutes: "every {count} minutes",
    minutesWindow: "{interval}, from {from}:00 to {to}:59",
    hourlyAtMinute: "Every hour at minute {minute}",
    everyHoursAtMinute: "every {count} hours (minute {minute})",
    atTime: "at {time}",
    weekday: "Every {days}",
    monthDay: "On day {day} of each month",
    daily: "Every day",
    weekdayRange: "{from} to {to}",
    invalidExpression: "Invalid cron expression: {error}",
    expectedFields: "Expected 5 or 6 fields",
    emptyField: "Empty field",
    invalidField: "Invalid field “{field}”",
    outOfRange: "Field “{field}” is outside the range [{min}-{max}]",
  },
  fr: {
    reboot: "Au démarrage du serveur",
    hourly: "Toutes les heures (minute 0)",
    midnight: "Tous les jours à minuit",
    weekly: "Chaque dimanche à minuit",
    monthly: "Le 1er de chaque mois à minuit",
    yearly: "Le 1er janvier à minuit",
    everyMinute: "Chaque minute",
    everyMinutes: "toutes les {count} minutes",
    minutesWindow: "{interval}, de {from}:00 à {to}:59",
    hourlyAtMinute: "Toutes les heures, à la minute {minute}",
    everyHoursAtMinute: "toutes les {count} heures (minute {minute})",
    atTime: "à {time}",
    weekday: "Chaque {days}",
    monthDay: "Le jour {day} de chaque mois",
    daily: "Tous les jours",
    weekdayRange: "{from} à {to}",
    invalidExpression: "Expression cron invalide : {error}",
    expectedFields: "5 ou 6 champs attendus",
    emptyField: "Champ vide",
    invalidField: "Champ « {field} » invalide",
    outOfRange: "Champ « {field} » hors de la plage [{min}-{max}]",
  },
  de: {
    reboot: "Beim Serverstart",
    hourly: "Jede Stunde (Minute 0)",
    midnight: "Täglich um Mitternacht",
    weekly: "Jeden Sonntag um Mitternacht",
    monthly: "Am 1. jedes Monats um Mitternacht",
    yearly: "Am 1. Januar um Mitternacht",
    everyMinute: "Jede Minute",
    everyMinutes: "alle {count} Minuten",
    minutesWindow: "{interval}, von {from}:00 bis {to}:59",
    hourlyAtMinute: "Jede Stunde zur Minute {minute}",
    everyHoursAtMinute: "alle {count} Stunden (Minute {minute})",
    atTime: "um {time}",
    weekday: "Jeden {days}",
    monthDay: "Am {day}. jedes Monats",
    daily: "Jeden Tag",
    weekdayRange: "{from} bis {to}",
    invalidExpression: "Ungültiger Cron-Ausdruck: {error}",
    expectedFields: "5 oder 6 Felder erwartet",
    emptyField: "Leeres Feld",
    invalidField: "Ungültiges Feld „{field}“",
    outOfRange: "Feld „{field}“ liegt außerhalb des Bereichs [{min}-{max}]",
  },
  it: {
    reboot: "All'avvio del server",
    hourly: "Ogni ora (minuto 0)",
    midnight: "Ogni giorno a mezzanotte",
    weekly: "Ogni domenica a mezzanotte",
    monthly: "Il giorno 1 di ogni mese a mezzanotte",
    yearly: "Il 1° gennaio a mezzanotte",
    everyMinute: "Ogni minuto",
    everyMinutes: "ogni {count} minuti",
    minutesWindow: "{interval}, dalle {from}:00 alle {to}:59",
    hourlyAtMinute: "Ogni ora al minuto {minute}",
    everyHoursAtMinute: "ogni {count} ore (minuto {minute})",
    atTime: "alle {time}",
    weekday: "Ogni {days}",
    monthDay: "Il giorno {day} di ogni mese",
    daily: "Ogni giorno",
    weekdayRange: "da {from} a {to}",
    invalidExpression: "Espressione cron non valida: {error}",
    expectedFields: "Previsti 5 o 6 campi",
    emptyField: "Campo vuoto",
    invalidField: "Campo «{field}» non valido",
    outOfRange: "Campo «{field}» fuori dall'intervallo [{min}-{max}]",
  },
  pt: {
    reboot: "Ao iniciar o servidor",
    hourly: "A cada hora (minuto 0)",
    midnight: "Todos os dias à meia-noite",
    weekly: "Todos os domingos à meia-noite",
    monthly: "No dia 1 de cada mês à meia-noite",
    yearly: "Em 1 de janeiro à meia-noite",
    everyMinute: "A cada minuto",
    everyMinutes: "a cada {count} minutos",
    minutesWindow: "{interval}, das {from}:00 às {to}:59",
    hourlyAtMinute: "A cada hora, no minuto {minute}",
    everyHoursAtMinute: "a cada {count} horas (minuto {minute})",
    atTime: "às {time}",
    weekday: "Todas as semanas: {days}",
    monthDay: "No dia {day} de cada mês",
    daily: "Todos os dias",
    weekdayRange: "{from} a {to}",
    invalidExpression: "Expressão cron inválida: {error}",
    expectedFields: "Eram esperados 5 ou 6 campos",
    emptyField: "Campo vazio",
    invalidField: "Campo «{field}» inválido",
    outOfRange: "Campo «{field}» fora do intervalo [{min}-{max}]",
  },
  ar: {
    reboot: "عند بدء تشغيل الخادم",
    hourly: "كل ساعة (الدقيقة 0)",
    midnight: "كل يوم عند منتصف الليل",
    weekly: "كل أحد عند منتصف الليل",
    monthly: "في اليوم الأول من كل شهر عند منتصف الليل",
    yearly: "في 1 يناير عند منتصف الليل",
    everyMinute: "كل دقيقة",
    everyMinutes: "كل {count} دقائق",
    minutesWindow: "{interval}، من {from}:00 إلى {to}:59",
    hourlyAtMinute: "كل ساعة عند الدقيقة {minute}",
    everyHoursAtMinute: "كل {count} ساعات (الدقيقة {minute})",
    atTime: "الساعة {time}",
    weekday: "كل أسبوع: {days}",
    monthDay: "في اليوم {day} من كل شهر",
    daily: "كل يوم",
    weekdayRange: "من {from} إلى {to}",
    invalidExpression: "تعبير cron غير صالح: {error}",
    expectedFields: "يجب إدخال 5 أو 6 حقول",
    emptyField: "حقل فارغ",
    invalidField: "الحقل «{field}» غير صالح",
    outOfRange: "الحقل «{field}» خارج النطاق [{min}-{max}]",
  },
  bn: {
    reboot: "সার্ভার চালু হলে",
    hourly: "প্রতি ঘণ্টায় (মিনিট ০)",
    midnight: "প্রতিদিন মধ্যরাতে",
    weekly: "প্রতি রবিবার মধ্যরাতে",
    monthly: "প্রতি মাসের ১ তারিখ মধ্যরাতে",
    yearly: "১ জানুয়ারি মধ্যরাতে",
    everyMinute: "প্রতি মিনিটে",
    everyMinutes: "প্রতি {count} মিনিটে",
    minutesWindow: "{interval}, {from}:00 থেকে {to}:59 পর্যন্ত",
    hourlyAtMinute: "প্রতি ঘণ্টায় {minute} মিনিটে",
    everyHoursAtMinute: "প্রতি {count} ঘণ্টায় ({minute} মিনিটে)",
    atTime: "{time}টায়",
    weekday: "প্রতি {days}",
    monthDay: "প্রতি মাসের {day} তারিখে",
    daily: "প্রতিদিন",
    weekdayRange: "{from} থেকে {to}",
    invalidExpression: "অবৈধ cron অভিব্যক্তি: {error}",
    expectedFields: "৫ বা ৬টি ক্ষেত্র প্রয়োজন",
    emptyField: "খালি ক্ষেত্র",
    invalidField: "«{field}» ক্ষেত্রটি অবৈধ",
    outOfRange: "«{field}» ক্ষেত্রটি [{min}-{max}] সীমার বাইরে",
  },
  hi: {
    reboot: "सर्वर शुरू होने पर",
    hourly: "हर घंटे (मिनट 0)",
    midnight: "हर दिन आधी रात को",
    weekly: "हर रविवार आधी रात को",
    monthly: "हर महीने की पहली तारीख को आधी रात में",
    yearly: "1 जनवरी को आधी रात में",
    everyMinute: "हर मिनट",
    everyMinutes: "हर {count} मिनट",
    minutesWindow: "{interval}, {from}:00 से {to}:59 तक",
    hourlyAtMinute: "हर घंटे {minute}वें मिनट पर",
    everyHoursAtMinute: "हर {count} घंटे ({minute}वें मिनट पर)",
    atTime: "{time} बजे",
    weekday: "हर {days}",
    monthDay: "हर महीने की {day} तारीख को",
    daily: "हर दिन",
    weekdayRange: "{from} से {to}",
    invalidExpression: "अमान्य cron अभिव्यक्ति: {error}",
    expectedFields: "5 या 6 फ़ील्ड अपेक्षित हैं",
    emptyField: "खाली फ़ील्ड",
    invalidField: "अमान्य फ़ील्ड «{field}»",
    outOfRange: "फ़ील्ड «{field}» सीमा [{min}-{max}] के बाहर है",
  },
  ja: {
    reboot: "サーバー起動時",
    hourly: "毎時0分",
    midnight: "毎日午前0時",
    weekly: "毎週日曜日の午前0時",
    monthly: "毎月1日の午前0時",
    yearly: "毎年1月1日の午前0時",
    everyMinute: "毎分",
    everyMinutes: "{count}分ごと",
    minutesWindow: "{from}:00〜{to}:59の間、{interval}",
    hourlyAtMinute: "毎時{minute}分",
    everyHoursAtMinute: "{count}時間ごと（{minute}分）",
    atTime: "{time}に",
    weekday: "毎週{days}",
    monthDay: "毎月{day}日",
    daily: "毎日",
    weekdayRange: "{from}から{to}まで",
    invalidExpression: "無効な cron 式: {error}",
    expectedFields: "5 個または 6 個のフィールドが必要です",
    emptyField: "空のフィールド",
    invalidField: "無効なフィールド「{field}」",
    outOfRange: "フィールド「{field}」は範囲 [{min}-{max}] 外です",
  },
  ko: {
    reboot: "서버 시작 시",
    hourly: "매시간 0분",
    midnight: "매일 자정",
    weekly: "매주 일요일 자정",
    monthly: "매월 1일 자정",
    yearly: "매년 1월 1일 자정",
    everyMinute: "매분",
    everyMinutes: "{count}분마다",
    minutesWindow: "{from}:00~{to}:59 사이 {interval}",
    hourlyAtMinute: "매시간 {minute}분",
    everyHoursAtMinute: "{count}시간마다({minute}분)",
    atTime: "{time}에",
    weekday: "매주 {days}",
    monthDay: "매월 {day}일",
    daily: "매일",
    weekdayRange: "{from}부터 {to}까지",
    invalidExpression: "잘못된 cron 표현식: {error}",
    expectedFields: "필드 5개 또는 6개가 필요합니다",
    emptyField: "빈 필드",
    invalidField: "잘못된 필드 ‘{field}’",
    outOfRange: "필드 ‘{field}’가 범위 [{min}-{max}]를 벗어났습니다",
  },
  ru: {
    reboot: "При запуске сервера",
    hourly: "Каждый час (минута 0)",
    midnight: "Ежедневно в полночь",
    weekly: "Каждое воскресенье в полночь",
    monthly: "В первый день каждого месяца в полночь",
    yearly: "1 января в полночь",
    everyMinute: "Каждую минуту",
    everyMinutes: "каждые {count} минут",
    minutesWindow: "{interval}, с {from}:00 до {to}:59",
    hourlyAtMinute: "Каждый час на минуте {minute}",
    everyHoursAtMinute: "каждые {count} часов (минута {minute})",
    atTime: "в {time}",
    weekday: "Еженедельно: {days}",
    monthDay: "Каждый месяц, день {day}",
    daily: "Ежедневно",
    weekdayRange: "с {from} по {to}",
    invalidExpression: "Недопустимое выражение cron: {error}",
    expectedFields: "Ожидалось 5 или 6 полей",
    emptyField: "Пустое поле",
    invalidField: "Недопустимое поле «{field}»",
    outOfRange: "Поле «{field}» вне диапазона [{min}-{max}]",
  },
};

function fmt(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match);
}

export function localizeCronValidationError(source: string | undefined, locale: unknown): string | undefined {
  if (!source) return undefined;
  const w = words[apiLocale(locale)];
  if (source === "Se esperaban 5 o 6 campos") return w.expectedFields;
  if (source === "Campo vacío") return w.emptyField;
  const invalid = /^Campo "([^"]+)" inválido$/.exec(source);
  if (invalid) return fmt(w.invalidField, { field: invalid[1]! });
  const range = /^Campo "([^"]+)" fuera de rango \[(\d+)-(\d+)\]$/.exec(source);
  if (range) return fmt(w.outOfRange, { field: range[1]!, min: range[2]!, max: range[3]! });
  return source;
}

export function cronInvalidExpressionMessage(source: string | undefined, locale: unknown): string {
  const w = words[apiLocale(locale)];
  return fmt(w.invalidExpression, { error: localizeCronValidationError(source, locale) ?? "" });
}

export function describeCron(expression: string, locale: unknown = "es"): string {
  const expr = expression.trim();
  const w = words[apiLocale(locale)];
  const alias: Record<string, keyof CronWords> = {
    "@reboot": "reboot", "@hourly": "hourly", "@daily": "midnight",
    "@midnight": "midnight", "@weekly": "weekly", "@monthly": "monthly",
    "@yearly": "yearly", "@annually": "yearly",
  };
  if (alias[expr]) return w[alias[expr]];
  const parts = expr.split(/\s+/);
  if (parts.length < 5) return expr;
  const fields = parts.length === 6 ? parts.slice(1) : parts;
  const [min, hr, dom, mon, dow] = fields as [string, string, string, string, string];
  const restWild = dom === "*" && mon === "*" && dow === "*";
  if (min === "*" && hr === "*" && restWild) return w.everyMinute;
  const minStep = /^\*\/(\d+)$/.exec(min)?.[1];
  const interval = minStep ? fmt(w.everyMinutes, { count: minStep }) : "";
  if (interval && hr === "*" && restWild) return interval;
  const hrRange = /^(\d+)-(\d+)$/.exec(hr);
  if (interval && hrRange && restWild) {
    return fmt(w.minutesWindow, { interval, from: hrRange[1]!.padStart(2, "0"), to: hrRange[2]!.padStart(2, "0") });
  }
  if (/^\d+$/.test(min) && hr === "*" && restWild) return fmt(w.hourlyAtMinute, { minute: min });
  const hrStep = /^\*\/(\d+)$/.exec(hr)?.[1];
  const time = /^\d+$/.test(min) && /^\d+$/.test(hr)
    ? fmt(w.atTime, { time: `${hr.padStart(2, "0")}:${min.padStart(2, "0")}` })
    : hrStep && /^\d+$/.test(min) ? fmt(w.everyHoursAtMinute, { count: hrStep, minute: min }) : "";
  const addTime = (base: string) => time ? `${base} ${time}` : base;
  if (dow !== "*" && dom === "*" && mon === "*") {
    const weekday = new Intl.DateTimeFormat(apiLocale(locale), { weekday: "long", timeZone: "UTC" });
    const dayName = (raw: string) => /^\d+$/.test(raw)
      ? weekday.format(new Date(Date.UTC(2024, 0, 7 + (Number(raw) % 7)))) : raw;
    const days = dow.split(",").map((d) => {
      const [from, to] = d.split("-");
      return to ? fmt(w.weekdayRange, { from: dayName(from ?? ""), to: dayName(to) }) : dayName(from ?? "");
    }).join(apiLocale(locale) === "ar" ? "، " : ", ");
    return addTime(fmt(w.weekday, { days }));
  }
  if (dom !== "*") return addTime(fmt(w.monthDay, { day: dom }));
  if (time) return addTime(w.daily);
  return expr;
}
