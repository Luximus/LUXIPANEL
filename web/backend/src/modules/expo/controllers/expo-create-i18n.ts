// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/** Localized status messages for the detached Expo app creation job. */
import { apiLocale, type ApiLocale } from "../../../shared/i18n/errors.js";

type ExpoCreateMessages = Record<"alreadyRunning" | "pathExists" | "startFailed" | "runningLong" | "done" | "failed" | "running" | "endedUnexpectedly" | "jobMissing", string>;
const messages: Record<ApiLocale, ExpoCreateMessages> = {
  es: {
    alreadyRunning: "Ya hay una creación en curso para esta ruta.",
    pathExists: "La ruta {path} ya existe.",
    startFailed: "No se pudo iniciar la creación. {detail}",
    runningLong: "Creando la app… esto puede tardar varios minutos.",
    done: "App creada y lista.",
    failed: "La creación falló. Revisa el registro.",
    running: "Creando la app…",
    endedUnexpectedly: "El proceso de creación terminó inesperadamente.",
    jobMissing: "No se encontró el trabajo de creación (puede haber expirado).",
  },
  en: {
    alreadyRunning: "An app is already being created at this path.",
    pathExists: "The path {path} already exists.",
    startFailed: "Could not start app creation. {detail}",
    runningLong: "Creating the app… this may take several minutes.",
    done: "App created and ready.",
    failed: "Creation failed. Check the log.",
    running: "Creating the app…",
    endedUnexpectedly: "The creation process ended unexpectedly.",
    jobMissing: "The creation job was not found (it may have expired).",
  },
  fr: {
    alreadyRunning: "Une création est déjà en cours pour ce chemin.",
    pathExists: "Le chemin {path} existe déjà.",
    startFailed: "Impossible de démarrer la création. {detail}",
    runningLong: "Création de l’application… cela peut prendre plusieurs minutes.",
    done: "Application créée et prête.",
    failed: "Échec de la création. Consultez le journal.",
    running: "Création de l’application…",
    endedUnexpectedly: "Le processus de création s’est terminé de façon inattendue.",
    jobMissing: "Tâche de création introuvable (elle a peut-être expiré).",
  },
  de: {
    alreadyRunning: "Für diesen Pfad läuft bereits eine App-Erstellung.",
    pathExists: "Der Pfad {path} existiert bereits.",
    startFailed: "Die Erstellung konnte nicht gestartet werden. {detail}",
    runningLong: "Die App wird erstellt… das kann einige Minuten dauern.",
    done: "App erstellt und bereit.",
    failed: "Erstellung fehlgeschlagen. Prüfen Sie das Protokoll.",
    running: "Die App wird erstellt…",
    endedUnexpectedly: "Der Erstellungsprozess wurde unerwartet beendet.",
    jobMissing: "Erstellungsauftrag nicht gefunden (möglicherweise abgelaufen).",
  },
  it: {
    alreadyRunning: "È già in corso la creazione di un’app per questo percorso.",
    pathExists: "Il percorso {path} esiste già.",
    startFailed: "Impossibile avviare la creazione. {detail}",
    runningLong: "Creazione dell’app… potrebbero servire alcuni minuti.",
    done: "App creata e pronta.",
    failed: "Creazione non riuscita. Controlla il registro.",
    running: "Creazione dell’app…",
    endedUnexpectedly: "Il processo di creazione è terminato in modo imprevisto.",
    jobMissing: "Processo di creazione non trovato (potrebbe essere scaduto).",
  },
  pt: {
    alreadyRunning: "Já está em curso a criação de uma app para este caminho.",
    pathExists: "O caminho {path} já existe.",
    startFailed: "Não foi possível iniciar a criação. {detail}",
    runningLong: "A criar a app… isto pode demorar vários minutos.",
    done: "App criada e pronta.",
    failed: "A criação falhou. Consulte o registo.",
    running: "A criar a app…",
    endedUnexpectedly: "O processo de criação terminou inesperadamente.",
    jobMissing: "Tarefa de criação não encontrada (pode ter expirado).",
  },
  ar: {
    alreadyRunning: "يجري إنشاء تطبيق لهذا المسار بالفعل.",
    pathExists: "المسار {path} موجود بالفعل.",
    startFailed: "تعذّر بدء إنشاء التطبيق. {detail}",
    runningLong: "جارٍ إنشاء التطبيق… قد يستغرق الأمر عدة دقائق.",
    done: "تم إنشاء التطبيق وهو جاهز.",
    failed: "فشل الإنشاء. راجع السجل.",
    running: "جارٍ إنشاء التطبيق…",
    endedUnexpectedly: "انتهت عملية الإنشاء بشكل غير متوقع.",
    jobMissing: "لم يُعثر على مهمة الإنشاء (ربما انتهت صلاحيتها).",
  },
  bn: {
    alreadyRunning: "এই পাথে ইতিমধ্যে একটি অ্যাপ তৈরি হচ্ছে।",
    pathExists: "{path} পাথটি ইতিমধ্যে আছে।",
    startFailed: "অ্যাপ তৈরি শুরু করা যায়নি। {detail}",
    runningLong: "অ্যাপ তৈরি হচ্ছে… কয়েক মিনিট লাগতে পারে।",
    done: "অ্যাপ তৈরি হয়েছে এবং প্রস্তুত।",
    failed: "অ্যাপ তৈরি ব্যর্থ হয়েছে। লগ দেখুন।",
    running: "অ্যাপ তৈরি হচ্ছে…",
    endedUnexpectedly: "অ্যাপ তৈরির প্রক্রিয়া অপ্রত্যাশিতভাবে শেষ হয়েছে।",
    jobMissing: "তৈরির কাজ পাওয়া যায়নি (মেয়াদ শেষ হয়ে থাকতে পারে)।",
  },
  hi: {
    alreadyRunning: "इस पथ पर पहले से एक ऐप बनाया जा रहा है।",
    pathExists: "पथ {path} पहले से मौजूद है।",
    startFailed: "ऐप बनाना शुरू नहीं हो सका। {detail}",
    runningLong: "ऐप बनाया जा रहा है… इसमें कई मिनट लग सकते हैं।",
    done: "ऐप बन गया है और तैयार है।",
    failed: "ऐप बनाना विफल रहा। लॉग देखें।",
    running: "ऐप बनाया जा रहा है…",
    endedUnexpectedly: "ऐप बनाने की प्रक्रिया अप्रत्याशित रूप से समाप्त हो गई।",
    jobMissing: "बनाने का काम नहीं मिला (शायद उसकी अवधि समाप्त हो गई)।",
  },
  ja: {
    alreadyRunning: "このパスでは既にアプリを作成中です。",
    pathExists: "パス {path} は既に存在します。",
    startFailed: "アプリの作成を開始できませんでした。{detail}",
    runningLong: "アプリを作成中です…数分かかる場合があります。",
    done: "アプリの作成が完了しました。",
    failed: "作成に失敗しました。ログを確認してください。",
    running: "アプリを作成中です…",
    endedUnexpectedly: "作成処理が予期せず終了しました。",
    jobMissing: "作成ジョブが見つかりません（期限切れの可能性があります）。",
  },
  ko: {
    alreadyRunning: "이 경로에서 이미 앱을 만들고 있습니다.",
    pathExists: "경로 {path}이(가) 이미 있습니다.",
    startFailed: "앱 만들기를 시작하지 못했습니다. {detail}",
    runningLong: "앱을 만드는 중입니다… 몇 분 걸릴 수 있습니다.",
    done: "앱이 만들어져 준비되었습니다.",
    failed: "만들기에 실패했습니다. 로그를 확인하세요.",
    running: "앱을 만드는 중입니다…",
    endedUnexpectedly: "앱 만들기 프로세스가 예기치 않게 종료되었습니다.",
    jobMissing: "만들기 작업을 찾을 수 없습니다(만료되었을 수 있음).",
  },
  ru: {
    alreadyRunning: "По этому пути уже создаётся приложение.",
    pathExists: "Путь {path} уже существует.",
    startFailed: "Не удалось запустить создание приложения. {detail}",
    runningLong: "Приложение создаётся… это может занять несколько минут.",
    done: "Приложение создано и готово.",
    failed: "Создание не удалось. Проверьте журнал.",
    running: "Приложение создаётся…",
    endedUnexpectedly: "Процесс создания неожиданно завершился.",
    jobMissing: "Задача создания не найдена (возможно, срок её действия истёк).",
  },
};

export function localizeExpoCreateMessage(locale: unknown, source: string): string {
  const m = messages[apiLocale(locale)];
  if (source === "Ya hay una creación en curso para esta ruta.") return m.alreadyRunning;
  if (source === "Creando la app… esto puede tardar varios minutos.") return m.runningLong;
  if (source === "App creada y lista.") return m.done;
  if (source === "La creación falló. Revisa el registro.") return m.failed;
  if (source === "Creando la app…") return m.running;
  if (source === "El proceso de creación terminó inesperadamente.") return m.endedUnexpectedly;
  if (source === "No se encontró el trabajo de creación (puede haber expirado).") return m.jobMissing;
  const path = /^La ruta (.*) ya existe\.$/.exec(source)?.[1];
  if (path !== undefined) return m.pathExists.replace("{path}", () => path);
  const detail = /^No se pudo iniciar la creación\. (.*)$/s.exec(source)?.[1];
  if (detail !== undefined) return m.startFailed.replace("{detail}", () => detail);
  return source;
}

