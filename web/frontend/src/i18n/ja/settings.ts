const settings = {
  "passkeyName": {
    "title": "パスキーの名前",
    "hint": "デバイスを識別しやすい名前を付けてください。",
    "placeholder": "例：個人用ノートパソコン",
    "save": "名前を保存",
    "edit": "名前を編集",
    "invalid": "1～128文字の名前を入力してください。",
    "saved": "名前を更新しました",
    "error": "名前を保存できませんでした。",
    "cancel": "キャンセル"
},
  "placeholders": {
    "logoUrl": "https://example.com/logo.png",
    "imageUrl": "https://…/image.jpg"
  },
  "pageTitle": "設定",
  "loadFailure": {
    "title": "設定を読み込めませんでした",
    "sessionMessage": "設定を読み込めませんでした：サーバーとのセッションが利用できません。セレクターでサーバーを選び直すか、ログアウトして再度ログインしてください。",
    "genericMessage": "設定を読み込めませんでした。接続を確認して再試行してください。",
    "retry": "再試行"
  },
  "header": {
    "title": "パネル設定",
    "subtitle": "LUXIPANELのグローバル設定",
    "autosave": "自動保存"
  },
  "tabs": {
    "general": "一般",
    "layoutUi": "レイアウト/UI",
    "security": "セキュリティ",
    "modules": "モジュール",
    "system": "システム",
    "credentials": "認証情報"
  },
  "credentials": {
    "hcaptcha": {
      "title": "hCaptcha",
      "desc": "hCaptcha チャレンジでパネルのログインを保護します。hCaptcha ダッシュボードのキーを入力してください。",
      "sitekeyLabel": "サイトキー",
      "sitekeyPlaceholder": "hCaptcha のサイトキー",
      "secretLabel": "シークレットキー",
      "secretPlaceholder": "新しいシークレットキーを入力",
      "secretConfigured": "シークレットキーは設定済みです。保持するにはこの欄を空のままにしてください。",
      "statusConfigured": "設定済み",
      "statusMissing": "未設定",
      "saved": "hCaptcha の設定を保存しました"
    },
    "tolqia": {
      "label": "Tolqia",
      "help": "Tolqia アカウント（Plus または Premium プラン）の API トークン — このサーバーのユーザーで翻訳付き通話を利用できるようになります",
      "guide": {
        "steps": [
          "tolqia.com にアクセスし、アカウント（Plus または Premium プラン）でサインインします。",
          "「設定」›「API」を開き、新しいトークンを作成します。",
          "トークン（tq_live_ で始まります）をコピーし、「設定」に貼り付けます。"
        ],
        "docUrl": "https://tolqia.com/settings/api",
        "docLabel": "tolqia.com でトークンを作成 → 設定 › API",
        "docUrl2": "https://tolqia.com/docs",
        "docLabel2": "ドキュメント"
      }
    },
    "elevenlabs": {
      "label": "ElevenLabs",
      "help": "音声通話のリアルタイム翻訳に使用します",
      "voiceIdLabel": "既定の Voice ID",
      "voiceIdPlaceholder": "例: 21m00Tcm4TlvDq8ikWAM",
      "guide": {
        "steps": [
          "elevenlabs.io にアクセスしてサインインします。",
          "「My Account」→「API Keys」を開き、新しいキーを作成します。",
          "キー（sk_ で始まる）をコピーして「設定」タブに貼り付けます。"
        ],
        "docUrl": "https://elevenlabs.io/app/settings/api-keys",
        "docLabel": "ElevenLabs の API キー"
      }
    },
    "title": "モジュール認証情報",
    "subtitle": "モジュールが動作するために必要なアクセストークンとAPIキーを管理します。",
    "empty": "このサーバーで認証情報が必要なモジュールは有効になっていません。",
    "statusSet": "構成済み",
    "statusMissing": "構成されていない",
    "tokenLabel": "アクセストークン / APIキー",
    "tokenPlaceholder": "トークンを貼り付けてください…",
    "save": "保存",
    "test": "テスト",
    "clear": "削除",
    "manage": "管理",
    "show": "表示",
    "hide": "非表示",
    "saved": "認証情報が保存されました",
    "cleared": "認証情報が削除されました",
    "testOk": "接続は有効です",
    "testFail": "認証情報を検証できませんでした",
    "confirmClear": "この認証情報を削除しますか？",
    "confirmClearTitle": "認証情報を削除",
    "error": "エラーが発生しました",
    "getDoc": "トークンを取得",
    "managedLabel": {
      "assistant": "AIエージェント"
    },
    "managedHint": {
      "assistant": "アシスタントのプロバイダーAPIキーはそのパネルで管理されます。",
      "backups": "ストレージキー（S3 / R2）はバックアップモジュールで管理されます。"
    },
    "managedSummary": {
      "assistant": "AIプロバイダー（Claude、OpenAI、Gemini、…）",
      "backups": "S3 / R2ストレージ認証情報"
    },
    "storage": {
      "accountId": "アカウントID（Cloudflare）",
      "accessKeyId": "アクセスキーID",
      "secret": "シークレットアクセスキー",
      "endpoint": "エンドポイント（オプション）",
      "region": "リージョン（オプション）",
      "r2Hint": "アカウントレベルのR2認証情報はバックアップによって再利用されます。キーを一度ここに設定すると、バックアップでバケットを選択するだけです。",
      "s3Hint": "S3認証情報はバックアップによって再利用されます。キーを一度ここに設定すると、バックアップでバケットを選択するだけです。"
    },
    "connector": {
      "connect": "保存して接続",
      "disconnect": "切断",
      "connected": "接続済み",
      "configured": "構成済み",
      "notConnected": "未接続",
      "unavailable": "AIエージェントモジュールが有効である必要があります",
      "setupGuide": "セットアップガイド"
    },
    "help": {
      "tabConfig": "構成",
      "tabHelp": "ヘルプ",
      "openLink": "リンクを開く",
      "guides": {
        "cloudflare": {
          "steps": [
            "dash.cloudflare.com にアクセスし、「マイプロフィール」→「API トークン」を開きます。",
            "「トークンを作成」をクリックし、「DNS ゾーンの編集」テンプレートを使用するか、必要な権限（ゾーン: 読み取り、DNS: 編集など）でカスタムトークンを作成します。",
            "アクセスを許可するゾーンを選択してトークンを作成します。",
            "トークンをコピー（一度しか表示されません）し、「構成」タブに貼り付けます。"
          ],
          "docUrl": "https://dash.cloudflare.com/profile/api-tokens",
          "docLabel": "Cloudflare APIトークン"
        },
        "expo": {
          "steps": [
            "expo.dev にログインし、「Account settings」→「Access tokens」を開きます。",
            "「Create token」をクリックし、名前を付けて生成されたトークンをコピーします。",
            "「構成」タブに貼り付けます。"
          ],
          "docUrl": "https://expo.dev/settings/access-tokens",
          "docLabel": "Expoアクセストークン"
        },
        "openclaw": {
          "steps": [
            "openclaw.ai にログインします。",
            "OpenClaw のダッシュボードから API キーを生成またはコピーします。",
            "「構成」タブに貼り付けます（エンドポイントやデフォルトモデルが異なる場合は調整してください）。"
          ],
          "docUrl": "https://openclaw.ai",
          "docLabel": "OpenClaw"
        },
        "repository-store": {
          "steps": [
            "github.com →「Settings」→「Developer settings」→「Personal access tokens」を開きます。",
            "リポジトリの読み取り権限（public_repo または Contents: Read）を持つトークン（classic または fine-grained）を生成します。",
            "トークン（ghp_ または github_pat_ で始まる）をコピーし、「構成」タブに貼り付けます。"
          ],
          "docUrl": "https://github.com/settings/tokens",
          "docLabel": "GitHubトークン"
        },
        "bitninja": {
          "steps": [
            "BitNinja パネル（admin.bitninja.io）にログインします。",
            "ライセンス/サーバーセクションからライセンスキーをコピーします。",
            "「構成」タブに貼り付けます。"
          ],
          "docUrl": "https://bitninja.io",
          "docLabel": "BitNinja"
        },
        "r2": {
          "steps": [
            "dash.cloudflare.com →「R2」→「Manage R2 API Tokens」を開きます。",
            "オブジェクトの読み取り/書き込み権限を持つ「R2 API Token」（S3互換）を作成します。",
            "表示されたアクセスキーIDとシークレットアクセスキーをコピーします。",
            "アカウントIDはR2ページ/アカウントサマリーに表示されます。",
            "「構成」タブにアカウントID・アクセスキーID・シークレットを貼り付けます（エンドポイントはアカウントIDから自動生成されます）。"
          ],
          "docUrl": "https://dash.cloudflare.com/?to=/:account/r2/api-tokens",
          "docLabel": "R2 APIトークン"
        },
        "s3": {
          "steps": [
            "AWS コンソールで「IAM」→「ユーザー」→ 対象ユーザー →「セキュリティ認証情報」→「アクセスキーを作成」を開きます。",
            "アクセスキーIDとシークレットアクセスキーをコピーします。",
            "S3互換サービス（Wasabi、MinIO など）を使用する場合は、エンドポイントとリージョンをメモします。",
            "「構成」タブにキー（および該当する場合はエンドポイント/リージョン）を貼り付けます。"
          ],
          "docUrl": "https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_access-keys.html",
          "docLabel": "AWSアクセスキー"
        }
      }
    }
  },
  "general": {
    "hcaptchaEnabled": "ログイン時に hCaptcha を必須にする",
    "hcaptchaEnabledHint": "パネルのログインフォームに hCaptcha チャレンジを表示します。",
    "sectionTitle": "一般",
    "labelPanelName": "パネル名",
    "labelTimezone": "タイムゾーン",
    "labelLanguage": "言語",
    "languageOptions": {
      "en": "English",
      "es": "Español"
    },
    "labelSessionTtl": "セッション有効期間（時間）",
    "labelMaxLoginAttempts": "ログイン失敗回数（ロックアウト）",
    "labelRequire2fa": "すべてのユーザーに 2FA を必須化",
    "btnViewLog": "ログを表示",
    "labelAuditLog": "監査ログを有効にする",
    "labelSwitchNewTab": "サーバー切り替え時に新しいタブで開く"
  },
  "imageList": {
    "labelJson": "(JSON)",
    "labelUrls": "（画像URL）",
    "addButton": "画像を追加"
  },
  "layout": {
    "sectionTitle": "レイアウト、ブランディング、UI",
    "sectionSubtitle": "フロントエンドのロゴ、角丸、シャドウ、基本カラーをカスタマイズします。",
    "branding": {
      "groupTitle": "ブランディングとロゴ",
      "groupDesc": "サイドバー・ログイン・ヘッダー・フッター・ファビコンに適用される単一ロゴ。",
      "labelLogoUrl": "ロゴ URL",
      "logoUrlHelp": "サイドバー、ログイン、パネルヘッダー、フッター、公開画面など、すべての場所で使われる単一のロゴです。",
      "btnUpload": "アップロード",
      "btnPick": "選択",
      "btnDefault": "デフォルト",
      "restoreLogos": "ロゴをリセット",
      "loginLogoOpacity": "ログインのロゴ枠の不透明度",
      "loginLogoOpacityHelp": "/login のロゴ円背景の透過度（0=透明、100=不透明）。"
    },
    "loginBg": {
      "groupTitle": "ログイン背景",
      "groupDesc": "/login のアニメーション背景とそのフォールバック色。",
      "enableLabel": "/login でアニメーション背景を表示",
      "labelFallbackColor": "無効時の背景色",
      "labelActiveEffect": "/login のアクティブエフェクト",
      "previewTitle": "ログインプレビュー"
    },
    "shape": {
      "groupTitle": "形状とシャドウ",
      "groupDesc": "全体の角丸、カードとモーダルの影。",
      "labelRadius": "グローバル角丸",
      "radiusHelp": "例：0.5rem、12px。",
      "labelShadow": "基本シャドウ",
      "labelModalShadow": "モーダルシャドウ",
      "labelModalBackdrop": "モーダルオーバーレイ",
      "backdropHelp": "ダイアログの背景。",
      "layer1": "レイヤー1",
      "layer2": "レイヤー2",
      "labelColor": "カラー",
      "labelShadowSingle": "シャドウ"
    },
    "palettes": {
      "title": "カラーテーマ",
      "subtitle": "定義済みのパレットを選択すると、パネル全体（ライト／ダーク）に適用されます。",
      "light": "ライトテーマ",
      "dark": "ダークテーマ",
      "intensity": "濃淡"
    },
    "resetButton": "スタイルを既定値にリセット",
    "panelBg": {
      "groupTitle": "パネルの背景",
      "groupDesc": "パネル内のアニメーション背景とそのフォールバック色。",
      "enableLabel": "パネルにアニメーション背景を表示",
      "labelFallbackColor": "無効時の背景色",
      "labelActiveEffect": "パネルのアクティブエフェクト"
    }
  },
  "security": {
    "sectionTitle": "セキュリティ",
    "loginMethodsTitle": "許可するログイン方法",
    "loginMethodsDesc": "少なくとも1つの方法を有効にしておく必要があります。無効にした方法はログイン画面に表示されません。",
    "loginMethodsWarning": "少なくとも1つの方法を有効にしておく必要があります。",
    "passkey": {
      "name": "Passkey",
      "desc": "生体認証 / FIDO2。ユーザーはデバイスを登録する必要があります。",
      "verifying": "確認中...",
      "btnManage": "管理"
    },
    "password": {
      "name": "パスワード",
      "desc": "ユーザー名とパスワードでログイン。事前設定なしで常に利用可能。",
      "configured": "設定済み"
    },
    "recovery": {
      "name": "リカバリー",
      "desc": "緊急時のバックアップとしてのワンタイムコード。",
      "verifying": "確認中...",
      "btnManage": "管理"
    },
    "twoFaStatus": {
      "groupTitle": "このアカウントの 2FA 状態",
      "badgeDisabled": "無効",
      "promptText": "この管理者アカウントを保護するために 2FA を有効化してください。",
      "btnSetup": "設定",
      "btnDelete": "削除",
      "btnDisable": "無効化"
    }
  },
  "modules": {
    "sectionTitle": "モジュール別キャッシュエンジン",
    "sectionDesc1": "クライアントサーバーでのスケジュール収集の状態と調整。",
    "sectionDescBold": "有効/無効は親モジュールに依存",
    "modulesLink": "モジュール",
    "sectionDesc2": "：モジュールを無効にすると収集が停止し、再度有効にするとスケジュールが再設定されます。ここでは頻度のみ調整できます。DataTablesはそのサーバーの専用Redisから事前加工されたデータを読み込みます。停止中または古すぎる場合は通常のJSONにフォールバックします。",
    "loading": "読み込み中…",
    "tableHeaders": {
      "module": "モジュール / コレクション",
      "source": "ソース",
      "active": "有効",
      "interval": "間隔（秒）",
      "lastRefresh": "最終更新",
      "duration": "所要時間",
      "size": "サイズ",
      "hitRatio": "ヒット率"
    },
    "managedInPre": "（管理元：",
    "managedInPost": "）"
  },
  "system": {
    "factoryReset": {
      "sectionTitle": "設定をリセット",
      "sectionSubtitle": "パネルの設定を工場出荷時の値に戻します。",
      "warningTitle": "警告",
      "warningBefore": "この操作は ",
      "warningAllSettings": "すべての設定",
      "warningMiddle": " （一般、レイアウト/UI、SMTP、セキュリティ、モジュールが保存した設定）をデフォルト値にリセットします。インストール済みのユーザーとモジュールは ",
      "warningNotDeleted": "削除されません",
      "warningAfter": ".",
      "btnReset": "工場出荷時設定にリセット"
    },
    "backupRestore": {
      "sectionTitle": "バックアップから復元",
      "sectionSubtitle": "以前のバックアップからパネルを復元します（Backupsモジュールが必要）。",
      "loading": "バックアップを読み込み中...",
      "btnRestore": "選択したバックアップを復元"
    },
    "noBackup": {
      "title": "バックアップからの復元は利用できません",
      "descBefore": "モジュール ",
      "backupsModule": "バックアップ",
      "descAfter": " をモジュールパネルからインストールしてこの機能を有効にしてください。"
    }
  },
  "imagePicker": {
    "title": "画像を選択",
    "subtitle": "フロントエンドの公開フォルダーにある画像。",
    "empty": "公開フォルダーに画像がありません。",
    "btnUpload": "新しい画像をアップロード",
    "btnCancel": "キャンセル"
  },
  "smtpTest": {
    "dialogTitle": "テストメールを送信",
    "labelRecipient": "宛先",
    "placeholderRecipient": "you@example.com",
    "btnCancel": "キャンセル",
    "btnSend": "送信"
  },
  "passkeysDialog": {
    "title": "Passkeys を管理",
    "btnAdd": "Passkey を追加",
    "empty": "登録された Passkey はありません"
  },
  "recoveryDialog": {
    "title": "リカバリーコード",
    "btnGenerate": "生成／再生成",
    "loading": "読み込み中...",
    "warningText": "これらのコードを安全な場所に保存してください。一度しか表示されません。",
    "btnCopy": "すべてコピー",
    "btnPrint": "印刷"
  },
  "setup2faDialog": {
    "title": "2FA を設定",
    "subtitle": "認証アプリでこのQRコードをスキャンしてください。",
    "secretLabel": "手動シークレット：",
    "copyTitle": "コピー",
    "verifyLabel": "6桁のコードを入力：",
    "btnCancel": "キャンセル",
    "btnActivate": "2FAを有効化"
  },
  "disable2faDialog": {
    "title": "2FAを無効にしますか？",
    "body": "2FAは無効になりますが、後で再度有効にするためにシークレットは保持されます。",
    "btnCancel": "キャンセル",
    "btnConfirm": "2FAを無効化"
  },
  "delete2faDialog": {
    "title": "2FAを削除しますか？",
    "body": "保存されたシークレットが削除され、2FAを再度使用するには再設定が必要になります。",
    "btnCancel": "キャンセル",
    "btnConfirm": "2FAを削除"
  },
  "auditLogDialog": {
    "title": "監査ログ",
    "empty": "記録されたアクティビティはありません"
  },
  "modulesCache": {
    "agoSeconds": "{n}秒前",
    "agoMinutes": "{n}分前",
    "agoHours": "{n}時間前",
    "agoDays": "{n}日前",
    "collectionSingular": "コレクション",
    "collectionPlural": "コレクション",
    "activeSingular": "有効",
    "activePlural": "有効",
    "enabledTitle": "クライアントサーバーのディスパッチャーによるスケジュール収集",
    "badgeEnabled": "有効",
    "disabledTitle": "/panel/modules で親モジュールが無効 — 収集は一時停止中",
    "badgeDisabled": "無効",
    "buttonSave": "保存",
    "saving": "保存中…",
    "savedStatus": "{module}/{collection} を更新しました",
    "saveError": "{module}/{collection} の保存エラー: {message}",
    "loadedSummary": "{modules} モジュールに {count} 件のキャッシュ可能なコレクションがあります。変更はコレクターの次回実行時（≤60秒）に反映されます。",
    "loadError": "エラー: {message}"
  },
  "labels": {
    "auditLogin": "ログイン",
    "auditLoginFailed": "ログイン失敗",
    "auditLogout": "ログアウト",
    "auditPasswordChange": "パスワード変更",
    "auditPasskeyRegister": "Passkey登録",
    "auditPasskeyDelete": "Passkey削除",
    "auditRecoveryCodeUsed": "リカバリーコード使用",
    "auditProfileUpdate": "プロフィール更新",
    "auditSettingsUpdate": "設定更新",
    "audit2faEnabled": "2FA有効化",
    "audit2faDisabled": "2FA無効化",
    "auditEventDefault": "イベント",
    "aiHintAnthropic": "推奨モデル: claude-fable-5（最新）、claude-sonnet-4-6（バランス）、claude-opus-4-6（最高性能）",
    "aiKeyHintAnthropic": "APIキーはconsole.anthropic.comで取得できます",
    "aiHintOpenai": "gpt-5.6-sol, gpt-5.6-terra, gpt-5.6-luna",
    "aiKeyHintOpenai": "APIキーはplatform.openai.comで取得できます",
    "aiHintOllama": "ローカルOllamaにインストールされたモデル名。ツールはサポートされません。",
    "aiKeyHintOllama": "ローカルOllamaはAPIキー不要です",
    "managedByLp": "LP-LICENSE-SERVERで管理されています",
    "notAvailable": "利用不可",
    "managedExternally": "外部管理",
    "twoFaManagedByLp": "このモードでは認証はLP-LICENSE-SERVERで管理されます。",
    "licenseNoStatus": "状態なし",
    "licenseActive": "有効",
    "licenseExpires": "{date}に期限切れ",
    "licenseActiveDesc": "ライセンス有効",
    "licenseDegraded": "低下",
    "licensePending": "保留中",
    "licenseDegradedDesc": "ライセンスを検証できず、パネルは低下モードで動作しています。",
    "licenseNotActivated": "ライセンスはまだ有効化されていません。",
    "passkeyCount": "{count}件のPasskeyが登録されています",
    "noPasskeys": "登録済みのPasskeyはありません",
    "recoveryCodesGenerated": "リカバリーコードが生成されました",
    "noRecoveryCodes": "生成されたコードはありません",
    "passkeyRegistered": "{date}に登録済み",
    "recoveryCodesActive": "有効なリカバリーコードがあります。",
    "recoveryCodesNone": "有効なリカバリーコードはありません。",
    "recoveryCodesDisplayed": "{count}件のコードが生成されました。安全な場所に保管してください。",
    "twoFaEnabled": "有効",
    "twoFaEnabledDesc": "次回ログイン時にこの2FAが要求されます。シークレットを削除せずに無効化できます。",
    "twoFaDisabled": "無効",
    "twoFaDisabledDesc": "シークレットは保存されていますが、再度有効化するまでログイン時に要求されません。",
    "twoFaSetupPrompt": "この管理者アカウントを保護するために2FAを有効化してください。",
    "printRecoveryCodesTitle": "リカバリーコード - LUXIPANEL",
    "printRecoveryCodesDesc": "これらのコードを安全な場所に保管してください。各コードは一度しか使用できません。"
  },
  "toasts": {
    "errorSaving": "設定の保存中にエラーが発生しました",
    "errorSavingAppearance": "ライセンスサーバーに外観を保存できませんでした。数秒後に再試行してください。",
    "licenseKeyAndRefRequired": "ライセンスキーと支払い参照番号を入力してください",
    "licenseActivated": "ライセンスが正常に有効化されました",
    "licenseActivateError": "ライセンスを有効化できませんでした",
    "timezoneApplyError": "システムにタイムゾーンを適用できませんでした",
    "timezoneSavedNotApplied": "タイムゾーンはパネルに保存されましたが、システムに適用できませんでした（sudo権限を確認してください）。",
    "passkeysInLp": "PasskeysはLP-LICENSE-SERVERで管理されています",
    "passkeyDeleted": "Passkeyが削除されました",
    "passkeyDeleteError": "Passkeyの削除中にエラーが発生しました",
    "passkeyBrowserUnsupported": "お使いのブラウザはPasskeyをサポートしていません",
    "passkeyRegisterInitError": "登録を開始できませんでした",
    "passkeyRegisterCancelled": "登録がキャンセルされました",
    "passkeyRegisterFinishError": "登録の完了中にエラーが発生しました",
    "passkeyRegistered": "Passkeyが正常に登録されました",
    "passkeyRegisterUserCancelled": "ユーザーにより登録がキャンセルされました",
    "passkeyRegisterError": "Passkeyの登録中にエラーが発生しました",
    "recoveryCodesInLp": "リカバリーコードはLP-LICENSE-SERVERで管理されています",
    "recoveryCodesGenerateError": "コードの生成中にエラーが発生しました",
    "twoFaInLp": "2FAはLP-LICENSE-SERVERで管理されています",
    "twoFaSetupInitError": "2FAの設定開始中にエラーが発生しました",
    "twoFaQrError": "QRコードを生成できませんでした",
    "twoFaActivated": "2FAが正常に有効化されました",
    "twoFaDisabled": "ログイン時の2FAが無効化されました",
    "twoFaDisableError": "2FAの無効化中にエラーが発生しました",
    "twoFaReactivated": "ログイン時の2FAが有効化されました",
    "twoFaActivateError": "2FAの有効化中にエラーが発生しました",
    "twoFaDeleted": "2FAが削除されました",
    "twoFaDeleteError": "2FAの削除中にエラーが発生しました",
    "backupRestoreUnavailable": "このパネルからのバックアップ復元はまだ利用できません。",
    "imageExceeds5mb": "画像が5MBを超えています",
    "uploadingImage": "画像をアップロード中...",
    "imageUploadError": "画像のアップロード中にエラーが発生しました",
    "imageUploadInvalidResponse": "サーバーから無効な応答がありました",
    "imageUploaded": "画像が正常にアップロードされました",
    "logosRestored": "ロゴがデフォルト値に復元されました",
    "codesCopied": "コードがコピーされました",
    "secretCopied": "シークレットがコピーされました",
    "smtpTestSent": "テストメールが{to}に送信されました",
    "smtpTestError": "送信中にエラーが発生しました",
    "layoutReset": "スタイルがデフォルト値にリセットされました",
    "settingsReset": "設定がリセットされました",
    "settingsResetError": "リセット中にエラーが発生しました",
    "licenseRevalidated": "ライセンスが再検証されました",
    "licenseRevalidateError": "ライセンスを再検証できませんでした"
  },
  "actions": {
    "activating": "有効化中...",
    "activateOrUpdate": "有効化 / 更新",
    "manage": "管理",
    "configure": "設定",
    "viewOrRegenerate": "表示 / 再生成",
    "generate": "生成",
    "generating": "生成中...",
    "generateOrRegenerate": "生成 / 再生成",
    "disable": "無効化",
    "activate": "有効化",
    "activate2fa": "2FAを有効化",
    "continue": "続ける",
    "sending": "送信中...",
    "send": "送信",
    "resetting": "リセット中...",
    "factoryReset": "工場出荷時設定にリセット"
  },
  "errors": {
    "twoFaEnter6Digits": "コードの6桁を入力してください",
    "twoFaInvalidCode": "無効なコード"
  },
  "confirm": {
    "deletePasskeyTitle": "Passkeyを削除",
    "deletePasskeyBody": "このPasskeyを削除しますか？",
    "restoreBackupBody": "バックアップ「{id}」を復元しますか？",
    "restoreBackupTitle": "バックアップを復元",
    "restoreLogosBody": "ロゴをLUXIPANELのデフォルト値に復元しますか？",
    "restoreLogosTitle": "ロゴを復元",
    "restoreLogosConfirm": "はい、復元する",
    "resetLayoutBody": "インターフェースのスタイルをLUXIPANELのデフォルト値にリセットしますか？カスタムのロゴ、色、影、背景が失われます。",
    "resetLayoutTitle": "スタイルをリセット",
    "resetLayoutConfirm": "はい、リセットする",
    "factoryResetBody": "本当によろしいですか？パネルのすべての設定がリセットされます。",
    "factoryResetTitle": "設定をリセット",
    "factoryResetConfirm": "はい、リセットする"
  },
  "empty": {
    "noBackups": "利用可能なバックアップはありません。"
  },
  "palettes": {
    "violet": {
      "name": "バイオレット",
      "description": "LUXIPANELのデフォルトパレット。"
    },
    "ocean": {
      "name": "オーシャン",
      "description": "洗練された落ち着きのあるブルー。"
    },
    "emerald": {
      "name": "エメラルド",
      "description": "さわやかで自然なグリーン。"
    },
    "sunset": {
      "name": "サンセット",
      "description": "温かみのあるオレンジとアンバー。"
    },
    "rose": {
      "name": "ローズ",
      "description": "鮮やかなピンクとマゼンタ。"
    },
    "indigo": {
      "name": "インディゴ",
      "description": "エレガントでモダンなインディゴ。"
    },
    "aqua": {
      "name": "アクア",
      "description": "明るいターコイズとシアン。"
    },
    "graphite": {
      "name": "グラファイト",
      "description": "落ち着いたモノクロームのニュートラル。"
    },
    "amber": {
      "name": "アンバー",
      "description": "温かみのあるゴールドとハニー調。"
    },
    "fuchsia": {
      "name": "フクシャ",
      "description": "鮮烈なマゼンタとパープル。"
    },
    "lime": {
      "name": "ライム",
      "description": "エネルギッシュなライムグリーン。"
    },
    "slate": {
      "name": "スレート",
      "description": "プロフェッショナルなブルーグレー。"
    },
    "prisma": {
      "name": "プリズム",
      "description": "すべてのパレットの色を連続的で無限に遷移させます。",
      "colors": "カラー",
      "addColorButton": "色を追加",
      "addColorAria": "プリズム効果に使う色を選んで追加",
      "addColorInputAria": "プリズム効果に追加する色",
      "editColorAria": "色を編集",
      "editColorInputAria": "色の値を編集",
      "editColorHexAria": "色の16進数値",
      "removeColorAria": "色を削除",
      "moveUpAria": "色を上へ移動",
      "moveDownAria": "色を下へ移動",
      "helpText": "矢印でリストの順序を変更できます。各色がエフェクトの順序を決めます。"
    },
    "custom": {
      "name": "カスタム",
      "description": "ベースカラーを選び、濃淡を調整します。",
      "baseColor": "ベースカラー",
      "baseColorAria": "カスタムのベースカラー",
      "hexAria": "カスタムベースカラーの16進数値"
    },
    "luxisoft": {
      "description": "ライトモードはネイビーブルーとミント、ダークモードはグラファイトとミント。",
      "name": "Luxisoft"
    }
  },
  "managers": {
    "default": "マネージャー1"
  },
  "git": {
    "errorFallback": "エラー"
  }
} as const;

export default settings;
