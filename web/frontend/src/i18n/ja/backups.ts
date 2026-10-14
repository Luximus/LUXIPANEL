const backups = {
  "pageTitle": "バックアップ",
  "settings": {
    "title": "バックアップ設定",
    "description": "接続中のサーバーに対する保存先と設定です。",
    "sections": "設定セクション",
    "localHelp": "このサーバーのローカルバックアップはここに保存されます。",
    "changeDirWarning": "フォルダーを変更すると、確認後に以前のローカルバックアップが削除されます。",
    "retentionHelp": "手動バックアップと新しいスケジュールに適用されます。既存のスケジュールには独自の上限が残ります。",
    "save": "変更を保存",
    "lastSuccess": "最後に成功したバックアップ",
    "localCopies": "ローカルバックアップ",
    "activeSchedules": "有効なスケジュール",
    "advancedCron": "カスタム Cron 式",
    "loading": "設定を読み込み中…",
    "loadError": "このサーバーの設定を読み込めませんでした。",
    "pending": "未保存の変更があります。",
    "countError": "バックアップ数は 1〜365 の範囲で選択してください。",
    "saving": "保存中…",
    "saved": "設定を保存しました。",
    "previewError": "フォルダーを確認できませんでした。",
    "destinationNotEmpty": "新しいフォルダーには既に LUXIPANEL のバックアップがあります。",
    "changeConfirm": "{path} にある {count} 件のローカルバックアップが削除されます。S3/R2 のバックアップは残ります。フォルダーを変更しますか？",
    "changeTitle": "バックアップフォルダーを変更",
    "changeError": "フォルダーを変更できませんでした。",
    "tables": "テーブル",
    "localHeading": "ローカル保存先",
    "overview": "バックアップの状態",
    "targetChanged": "サーバーが変更されました。設定をもう一度確認してください。"
  },
  "status": {
    "completed": "完了",
    "failed": "失敗",
    "running": "実行中"
  },
  "header": {
    "heading": "バックアップ",
    "subheading": "サーバーのファイル、データベース、メール、設定を保護します。",
    "btnBackupNow": "今すぐバックアップ"
  },
  "configCard": {
    "title": "バックアップ設定",
    "subtitle": "ローカルディレクトリとリモートストレージ。",
    "labelLocalDir": "ローカルバックアップディレクトリ",
    "placeholderLocalDir": "/var/backups/luxipanel",
    "labelRetentionDefault": "既定で保持するローカルバックアップ数",
    "s3Section": "S3 / Cloudflare R2",
    "labelEndpoint": "エンドポイント",
    "labelBucket": "バケット",
    "labelAccessKeyId": "アクセスキーID",
    "labelSecretAccessKey": "シークレットアクセスキー",
    "btnBrowse": "参照",
    "tabLocal": "ローカル",
    "tabCloud": "クラウド"
  },
  "pathBrowserDialog": {
    "title": "フォルダを選択",
    "btnUp": "上へ",
    "btnCancel": "キャンセル",
    "btnSelect": "このフォルダを使用"
  },
  "backupSources": {
    "title": "バックアップ対象",
    "scopeFull": "サーバー全体（厳選）",
    "scopeFullHint": "データベース、メール、パネル設定、/etc /home /var/www /root",
    "scopeCustom": "カスタム",
    "labelDatabases": "データベース",
    "dbAll": "すべて",
    "dbPick": "選択…",
    "dbChoose": "データベースを選択",
    "dbNone": "選択なし",
    "labelMail": "メール（vmail + Postfix/Dovecot）",
    "labelPanelConfig": "パネル設定",
    "foldersTitle": "フォルダー",
    "addFolder": "フォルダーを追加",
    "noFolders": "フォルダーが選択されていません"
  },
  "dbPickerDialog": {
    "title": "データベースを選択",
    "loading": "読み込み中…",
    "btnCancel": "キャンセル",
    "btnSelect": "選択を適用",
    "btnRetry": "再試行",
    "unavailableSelection": "選択したデータベースの一部が利用できません。選択を確認してください。"
  },
  "storagesSection": {
    "subtitle": "バックアップのクラウド保存先（S3 / Cloudflare R2）。",
    "tableTitle": "ストレージ",
    "btnNew": "新規ストレージ"
  },
  "storageDialog": {
    "titleNew": "新規クラウドストレージ",
    "titleEdit": "クラウドストレージを編集",
    "labelName": "名前",
    "placeholderName": "マイ R2 バケット",
    "labelProvider": "プロバイダー",
    "optS3": "Amazon S3",
    "optR2": "Cloudflare R2",
    "labelBucket": "バケット",
    "labelPrefix": "プレフィックス（フォルダー）",
    "placeholderPrefix": "backups/",
    "labelEndpoint": "エンドポイント",
    "labelRegion": "リージョン",
    "labelAccessKey": "アクセスキーID",
    "labelSecret": "シークレットアクセスキー",
    "secretKeepHint": "現在のシークレットを保持するには空欄のままにしてください。",
    "btnCancel": "キャンセル",
    "btnSave": "保存",
    "usingCentralCred": "設定 → 認証情報の中央クレデンシャルを使用しています（バケットのみ定義）。",
    "credRequired": "{provider} の認証情報が設定されていません。設定 → 認証情報に登録してからご利用ください。",
    "credRequiredCta": "設定 → 認証情報へ移動"
  },
  "progress": {
    "creating": "バックアップを作成中… 数分かかる場合があります。"
  },
  "historySection": {
    "title": "バックアップ履歴",
    "tableTitle": "バックアップ",
    "count": "{count} 件",
    "countPartial": "{total} 件中 {shown} 件を表示"
  },
  "schedulesSection": {
    "title": "スケジュール",
    "btnNew": "新規",
    "loading": "読み込み中...",
    "active": "有効",
    "paused": "停止中",
    "copies": "件",
    "pause": "一時停止",
    "enable": "有効化",
    "edit": "編集",
    "delete": "削除"
  },
  "backupDialog": {
    "title": "手動バックアップを作成",
    "labelName": "ラベル",
    "placeholderName": "pre-upgrade",
    "labelStorage": "ストレージ",
    "optionLocal": "ローカル",
    "optionS3": "AWS S3",
    "optionR2": "Cloudflare R2",
    "labelIncludeDb": "PostgreSQLダンプを含める",
    "sourcesTitle": "バックアップ対象",
    "labelIncludeDatabases": "データベース（MySQL/MariaDB + PostgreSQL）",
    "labelIncludeMail": "メールアカウント（メールボックス＋設定）",
    "labelIncludePanelConfig": "LuxiPanel の設定",
    "btnCancel": "キャンセル",
    "btnStart": "バックアップを開始"
  },
  "scheduleDialog": {
    "title": "バックアップをスケジュール",
    "labelName": "名前",
    "placeholderName": "週次バックアップ",
    "labelSchedule": "スケジュール（cron）",
    "placeholderSchedule": "0 3 * * 0",
    "labelStorage": "ストレージ",
    "optionLocal": "ローカル",
    "optionS3": "S3",
    "optionR2": "R2",
    "labelRetention": "保持するローカルバックアップ数",
    "labelFrequency": "頻度",
    "optHourly": "毎時",
    "optDaily": "毎日",
    "optWeekly": "毎週",
    "optMonthly": "毎月",
    "labelTime": "時刻",
    "labelWeekday": "曜日",
    "labelMonthday": "日（月内）",
    "cronPreview": "相当する cron",
    "cronExample": "0 3 * * *",
    "weekdays": [
      "日曜日",
      "月曜日",
      "火曜日",
      "水曜日",
      "木曜日",
      "金曜日",
      "土曜日"
    ],
    "btnCancel": "キャンセル",
    "btnSave": "保存",
    "localRetentionHint": "このスケジュールの最新のローカルバックアップは保持されます。",
    "cloudRetentionHint": "S3/R2 の保持期間はクラウド事業者側で設定してください。",
    "editTitle": "スケジュールを編集"
  },
  "toasts": {
    "errorSaveSettings": "バックアップ設定の保存に失敗しました",
    "preparingDownload": "ダウンロードを準備中…",
    "backupDeleted": "バックアップを削除しました",
    "backupsDeleted": "バックアップを削除しました",
    "scheduleDeleted": "スケジュールを削除しました",
    "errorDelete": "削除エラー",
    "errorCreateBackup": "バックアップの作成に失敗しました",
    "backupStarted": "バックアップを開始しました",
    "backupCompleted": "バックアップが完了しました",
    "backupStillRunning": "バックアップはまだ実行中です…",
    "scheduleCreated": "スケジュールを作成しました",
    "errorCreateSchedule": "スケジュールの作成に失敗しました",
    "storageDeleted": "ストレージを削除しました",
    "storageUpdated": "ストレージを更新しました",
    "storageCreated": "ストレージを作成しました",
    "errorSaveStorage": "ストレージの保存に失敗しました",
    "recordRemoved": "履歴から記録を削除しました"
  },
  "errors": {
    "listPathFailed": "このパスを一覧表示できませんでした（権限を確認してください）。",
    "listDbFailed": "データベースの一覧取得に失敗しました。",
    "downloadFailed": "バックアップをダウンロードできませんでした",
    "backupErrorDetail": "エラー: {error}"
  },
  "empty": {
    "noSubfolders": "(サブフォルダなし)",
    "noDbEngines": "アクティブなDBエンジンが検出されませんでした。",
    "noDatabases": "(データベースなし)",
    "noneSelected": "未選択",
    "noSchedules": "スケジュールなし"
  },
  "labels": {
    "loading": "読み込み中…",
    "fullServer": "サーバー全体",
    "editStorage": "ストレージを編集",
    "newStorage": "新規ストレージ"
  },
  "confirm": {
    "deleteBackup": "バックアップ「{label}」を削除しますか？",
    "deleteBackupTitle": "バックアップを削除",
    "deleteBulkBackup": "選択した{count}件のバックアップを削除しますか？",
    "deleteBulkBackupTitle": "バックアップを削除",
    "deleteSchedule": "このスケジュールを削除しますか？",
    "deleteScheduleTitle": "スケジュールを削除",
    "deleteStorage": "ストレージ「{name}」を削除しますか？",
    "deleteStorageTitle": "ストレージを削除",
    "removeRecord": "「{label}」を履歴から削除しますか？クラウド上のオブジェクトは保持されます。",
    "removeRecordTitle": "記録を削除",
    "cloudBulkNote": "S3/R2 のオブジェクトは保持されます。"
  },
  "table": {
    "columns": {
      "label": "ラベル",
      "status": "状態",
      "size": "サイズ",
      "storage": "ストレージ",
      "fecha": "日付"
    },
    "storagesColumns": {
      "name": "名前",
      "provider": "プロバイダー",
      "bucket": "バケット",
      "endpoint": "エンドポイント"
    },
    "filters": {
      "searchBackupLabel": "ラベルを検索...",
      "filterBackupStorage": "ストレージ",
      "searchStorageName": "名前を検索...",
      "filterStorageProvider": "プロバイダー"
    },
    "rowActions": {
      "download": "ダウンロード",
      "removeRecord": "履歴から削除",
      "details": "エラーを表示",
      "delete": "削除",
      "refresh": "状態を更新"
    },
    "quickActions": {
      "deleteSelected": "選択項目を削除"
    },
    "storagesRowActions": {
      "edit": "編集",
      "delete": "削除"
    }
  }
} as const;

export default backups;
