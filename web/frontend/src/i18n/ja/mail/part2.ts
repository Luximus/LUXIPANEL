// Auto-split fragment of mail.ts (part 2/2) — data only, keeps <1000 lines.
// Do not reorder keys: the aggregator merges parts by spread in original order.
const mailPart2 = {
  "routing": {
    "labels": {
      "autoRemote": "構成を自動検出：リモート",
      "local": "ローカル メール エクスチェンジャー",
      "backup": "バックアップ メール エクスチェンジャー",
      "remote": "リモート メール エクスチェンジャー"
    },
    "currentMode": "現在：{mode}"
  },
  "tracking": {
    "statuses": {
      "success": "成功",
      "deferred": "遅延",
      "failure": "失敗",
      "inProgress": "処理中",
      "unknown": "不明"
    },
    "columns": {
      "event": "イベント",
      "fromAddress": "送信元アドレス",
      "sentTime": "送信日時",
      "spamScore": "スパムスコア",
      "recipient": "受信者",
      "domain": "ドメイン",
      "id": "ID",
      "result": "結果",
      "actions": "操作"
    },
    "noRecordsFound": "レコードが見つかりません。",
    "zeroRecords": "0 件",
    "matchesZeroRecords": "検索結果は 0 件です。",
    "recordsCount": "{count} 件",
    "matchesRecords": "検索結果は {count} 件です。",
    "detailMeta": "イベント: {event} | ID: {id} | 宛先: {recipient}"
  },
  "filters": {
    "ruleParts": {
      "from": "差出人",
      "subject": "件名",
      "to": "宛先",
      "anyRecipient": "すべての受信者",
      "reply": "返信先",
      "body": "本文",
      "anyHeader": "すべてのヘッダー",
      "notDelivered": "未配信",
      "errorMessage": "エラーメッセージ",
      "listId": "リスト ID",
      "spamStatus": "スパム状態",
      "spamBar": "スパムバー",
      "spamScore": "スパムスコア"
    },
    "matches": {
      "contains": "を含む",
      "matchesRegex": "regex に一致",
      "doesNotContain": "を含まない",
      "equals": "と等しい",
      "beginsWith": "で始まる",
      "endsWith": "で終わる",
      "doesNotBegin": "で始まらない",
      "doesNotEnd": "で終わらない",
      "doesNotMatch": "に一致しない",
      "isAbove": "より大きい（数値のみ）",
      "isNotAbove": "以下（数値のみ）",
      "isBelow": "より小さい（数値のみ）",
      "isNotBelow": "以上（数値のみ）"
    },
    "actions": {
      "discard": "メッセージを破棄",
      "redirect": "メールにリダイレクト",
      "fail": "エラーメッセージを返す",
      "stop": "ルール処理を停止",
      "deliverToFolder": "フォルダーに配信",
      "pipe": "プログラムにパイプ"
    },
    "joinOp": {
      "and": "かつ",
      "or": "または"
    },
    "removeBtn": "-"
  },
  "defaultAddress": {
    "currentSetting": {
      "none": "現在の設定：（なし）",
      "forward": "現在の設定：{destination}",
      "forwardDefault": "（転送）",
      "fail": "現在の設定：:fail: {message}"
    },
    "defaultFailMessage": "該当するユーザーが存在しません"
  },
  "archive": {
    "retentionOptions": {
      "oneMonth": "1 ヶ月",
      "threeMonths": "3 ヶ月",
      "sixMonths": "6 ヶ月",
      "oneYear": "1 年",
      "twoYears": "2 年",
      "fiveYears": "5 年",
      "tenYears": "10 年",
      "forever": "無期限",
      "custom": "カスタム"
    },
    "fields": {
      "incomingEmail": "受信メッセージ",
      "outgoingMailingList": "送信メーリングリストメッセージ",
      "outgoingEmail": "送信メッセージ"
    }
  },
  "encryption": {
    "neverExpires": "有効期限なし"
  },
  "actions": {
    "view": "表示",
    "save": "保存",
    "clone": "複製",
    "copy": "コピー",
    "delete": "削除",
    "edit": "編集",
    "remove": "削除"
  },
  "outbound": {
    "cardTitle": "パネルのメール送信 (SMTP)",
    "cardDesc": "パネルがレポートやシステムメールを送信する際に使うデフォルトのアカウントまたは外部SMTP。",
    "back": "戻る",
    "intro": "LUXIPANELがシステムメール（cronエージェントのレポート、承認リンク、テスト）を送信する際の差出人。このサーバー上のメールアカウント、またはサーバーに属さない外部SMTPを使用できます。",
    "modeLabel": "送信モード",
    "modeDisabled": "無効",
    "modeAccount": "サーバーのメールアカウント（デフォルト）",
    "modeExternal": "外部SMTP",
    "accountLabel": "デフォルトの送信アカウント",
    "accountHint": "そのアカウントに保存されたSMTP認証情報を使用します。",
    "hostLabel": "SMTPサーバー",
    "portLabel": "ポート",
    "userLabel": "ユーザー",
    "passLabel": "パスワード",
    "passPlaceholder": "（変更なし）",
    "fromLabel": "送信者（メール）",
    "fromNameLabel": "送信者名",
    "secureLabel": "ダイレクトTLS（ポート465）",
    "save": "保存",
    "testPlaceholder": "to@example.com",
    "test": "テスト送信",
    "hostPlaceholder": "smtp.example.com",
    "fromPlaceholder": "sender@example.com",
    "fromNamePlaceholder": "私の会社"
  },
  "table": {
    "status": {
      "active": "有効",
      "inactive": "無効",
      "disabled": "無効"
    },
    "redirect": {
      "columns": {
        "domain": "ドメイン",
        "destinos": "宛先"
      },
      "filters": {
        "searchDomain": "ドメインを検索…"
      },
      "rowActions": {
        "edit": "編集",
        "delete": "削除"
      }
    },
    "encryption": {
      "columns": {
        "keyId": "キー ID",
        "label": "ID",
        "keySize": "キーサイズ",
        "created": "作成日",
        "expires": "有効期限"
      },
      "filters": {
        "searchKey": "キーを検索…"
      },
      "rowActions": {
        "view": "表示",
        "delete": "削除"
      }
    },
    "accounts": {
      "columns": {
        "address": "アドレス",
        "domain": "ドメイン",
        "uso": "クォータ / 使用量",
        "reenvios": "転送",
        "estado": "状態"
      },
      "filters": {
        "search": "アドレスまたはドメインを検索…",
        "domain": "ドメイン",
        "estado": "状態"
      },
      "rowActions": {
        "edit": "アカウントを編集",
        "depurarIa": "AIでクリーンアップ",
        "password": "パスワードを変更",
        "toggle": "有効化 / 無効化",
        "inbox": "メールを開く",
        "signatures": "署名を管理",
        "default": "デフォルトとして使用",
        "contacts": "連絡先を管理",
        "calendars": "カレンダーを管理",
        "autoresponder": "自動応答を管理",
        "filters": "フィルターを管理",
        "forwards": "転送の管理",
        "diskusage": "ディスク使用量を管理",
        "clone": "メールをクローン",
        "delete": "アカウントを削除"
      },
      "quickActions": {
        "bulkForward": "転送を追加",
        "bulkQuota": "クォータを変更",
        "bulkDelete": "アカウントを削除"
      }
    },
    "globalFilters": {
      "columns": {
        "name": "フィルター",
        "estado": "状態",
        "rules": "ルール",
        "actionsCount": "操作"
      },
      "filters": {
        "search": "フィルターを検索…"
      },
      "rowActions": {
        "edit": "編集",
        "delete": "削除"
      }
    },
    "contacts": {
      "columns": {
        "email": "メール",
        "name": "名前"
      },
      "filters": {
        "searchEmail": "メールを検索…"
      },
      "rowActions": {
        "edit": "編集",
        "delete": "削除"
      }
    },
    "calendars": {
      "columns": {
        "name": "名前",
        "timezone": "タイムゾーン",
        "estado": "状態"
      },
      "filters": {
        "search": "カレンダーを検索…"
      },
      "rowActions": {
        "edit": "編集",
        "delete": "削除"
      }
    },
    "signatures": {
      "columns": {
        "sender": "送信者",
        "preview": "署名"
      },
      "filters": {
        "search": "絞り込み・検索…"
      },
      "rowActions": {
        "edit": "編集",
        "delete": "削除"
      }
    },
    "filters": {
      "columns": {
        "name": "名前",
        "estado": "状態"
      },
      "filters": {
        "search": "フィルターを検索…"
      },
      "rowActions": {
        "edit": "編集",
        "delete": "削除"
      }
    }
  },
  "confirm": {
    "bulkDeleteAccounts": "{count} 件のメールアカウントを削除しますか？この操作は元に戻せません。",
    "deleteAccount": "アカウント {address} を削除しますか？この操作は元に戻せません。",
    "deleteAccountTitle": "アカウントを削除",
    "deleteAutoresponder": "このアカウントの自動応答を削除しますか？",
    "deleteByDate": "{from} から {to} までの {folder} のメールが削除されます。続行しますか？",
    "deleteByDateTitle": "日付でメールを削除",
    "deleteCalendar": "カレンダー「{label}」を削除しますか？",
    "deleteCalendarTitle": "カレンダーを削除",
    "deleteContact": "連絡先「{label}」を削除しますか？",
    "deleteContactTitle": "連絡先を削除",
    "deleteDomainForward": "@{domain} のグローバルリダイレクトを削除しますか？",
    "deleteDomainForwardTitle": "グローバルリダイレクトを削除",
    "deleteEncryptionKey": "この暗号化鍵を削除しますか？",
    "deleteFilter": "フィルター「{name}」を削除しますか？",
    "deleteFilterTitle": "フィルターを削除",
    "deleteForward": "{destination} への転送を削除しますか？",
    "deleteGlobalFilter": "グローバルフィルター「{label}」を削除しますか？",
    "deleteGlobalFilterTitle": "グローバルフィルターを削除",
    "yesDelete": "はい、削除します"
  },
  "empty": {
    "noDomains": "ドメインなし",
    "noFolders": "このアカウントのフォルダが見つかりませんでした。",
    "noOtherAccount": "他に利用可能なアカウントはありません"
  },
  "errors": {
    "accountCreateFailed": "アカウントの作成に失敗しました",
    "accountNotFound": "アカウントが見つかりませんでした",
    "accountUpdateFailed": "アカウントの更新に失敗しました",
    "accountUpdatedForwardsFailed": "アカウントは更新されましたが、転送の更新に失敗しました",
    "accountsLoadFailed": "アカウントの読み込みに失敗しました",
    "autoDeleteThresholdInvalid": "自動削除のしきい値が無効です。",
    "autoresponderDeleteFailed": "自動応答を削除できませんでした",
    "autoresponderSaveFailed": "自動応答を保存できませんでした。",
    "calendarDeleteFailed": "カレンダーを削除できませんでした",
    "calendarNotFound": "カレンダーが見つかりませんでした",
    "calendarSaveFailed": "カレンダーを保存できませんでした。",
    "cloneCreateFailed": "新しいアカウントを作成できませんでした。",
    "cloneFailed": "メールを複製できませんでした。",
    "cloneIdResolveFailed": "アカウントは作成されましたが、ID を解決できませんでした。「既存」として再試行してください。",
    "cloneLocalAndDomainRequired": "ローカル部とドメインを指定してください。",
    "clonePasswordTooShort": "パスワードは 6 文字以上である必要があります。",
    "contactDeleteFailed": "連絡先を削除できませんでした",
    "contactNotFound": "連絡先が見つかりませんでした",
    "contactSaveFailed": "連絡先を保存できませんでした。",
    "copyByRangeFailed": "範囲指定でコピーできませんでした",
    "customScoreInvalid": "カスタムスコアが無効です。",
    "dateRangeRequired": "開始日と終了日を選択してください",
    "defaultAddressLoadFailed": "デフォルトアドレスを読み込めませんでした。",
    "defaultAddressSaveFailed": "デフォルトアドレスを保存できませんでした。",
    "deleteByRangeFailed": "範囲指定で削除できませんでした",
    "deleteFailed": "削除に失敗しました",
    "destEmailInvalid": "宛先メールアドレスが無効です",
    "destinationsInvalidFormat": "1 つ以上の宛先の形式が無効です。",
    "diskUsageLoadFailed": "ディスク使用量を読み込めませんでした",
    "domainForwardDeleteFailed": "グローバルリダイレクトを削除できませんでした。",
    "domainForwardsLoadFailed": "グローバルリダイレクトを読み込めませんでした。",
    "domainRedirectSaveFailed": "グローバルリダイレクトを保存できませんでした。",
    "domainsLoadFailed": "DNS ドメインを読み込めませんでした",
    "filterDeleteFailed": "フィルターを削除できませんでした",
    "filterNotFound": "フィルターが見つかりませんでした",
    "filterSaveFailed": "フィルターを保存できませんでした。",
    "forwardAlreadyExists": "{destination} への転送はすでに存在します",
    "forwardsSaveFailed": "サーバーに転送を保存できませんでした",
    "globalFilterDeleteFailed": "グローバルフィルターを削除できませんでした。",
    "globalFilterSaveFailed": "グローバルフィルターを保存できませんでした。",
    "globalFilterTestFailed": "テストを実行できませんでした。",
    "globalFiltersLoadFailed": "グローバルフィルターを読み込めませんでした。",
    "indicateTestDestEmail": "テストの宛先メールアドレスを指定してください。",
    "localPartInvalid": "@ より前のユーザー部分の形式が無効です。",
    "localPartInvalidNoPoint": "@ より前のユーザー部分の形式が無効です",
    "mustAddAtLeastOneAction": "少なくとも 1 つのアクションを追加してください。",
    "mustAddAtLeastOneDestEmail": "少なくとも 1 つの宛先メールアドレスを追加してください。",
    "mustAddAtLeastOneRule": "少なくとも 1 つのルールを追加してください。",
    "mustEnterBody": "メッセージの内容を入力してください。",
    "mustEnterSubject": "件名を入力してください。",
    "mustEnterTestMessage": "テストメッセージを入力してください。",
    "mustEnterValidDestEmail": "有効な宛先メールアドレスを入力してください。",
    "mustIndicateCalendarName": "カレンダー名を指定してください。",
    "mustIndicateContactEmail": "連絡先のメールアドレスを指定してください。",
    "mustIndicateFilterName": "フィルター名を指定してください。",
    "mustIndicateName": "名前を指定してください。",
    "mustSelectDomain": "ドメインを選択してください。",
    "mustSelectDomainNoPoint": "ドメインを選択してください",
    "noAutoresponderToDelete": "削除する自動応答がありません",
    "passwordChangeFailed": "パスワードの変更に失敗しました",
    "quotaInvalid": "クォータが無効です",
    "routingLoadFailed": "メールルーティングの設定を読み込めませんでした。",
    "routingSaveFailed": "メールルーティングの設定を保存できませんでした。",
    "saveFailed": "保存に失敗しました",
    "scoreTypesLoadFailed": "スコアタイプのカタログを読み込めませんでした。",
    "selectDestAccount": "宛先アカウントを選択してください",
    "selectValidDomain": "有効なドメインを選択してください。",
    "spamFiltersLoadFailed": "スパムフィルターを読み込めませんでした。",
    "spamFiltersSaveFailed": "スパムフィルターの設定を保存できませんでした。",
    "testEmailFailed": "テスト送信に失敗しました",
    "toggleFailed": "状態の変更に失敗しました",
    "trackDeliveryLoadFailed": "配信追跡を読み込めませんでした。"
  },
  "labels": {
    "accountColon": "アカウント: {address}",
    "activating": "有効化中",
    "cloneStartedBg": "複製をバックグラウンドで開始しました。完了したら通知でお知らせします。",
    "cloning": "複製中…",
    "currentAccountColon": "現在のアカウント: {address}",
    "deactivating": "無効化中",
    "destEmailForCount": "{count} 件のアカウントに追加する転送の宛先メールアドレス:",
    "loading": "読み込み中...",
    "newQuotaFor": "{count} 件のアカウントの新しいクォータ（MB）。無制限にするには 0 を使用します。",
    "no": "いいえ",
    "noGlobalLimit": "グローバル制限なし",
    "originColon": "送信元: {addr}",
    "sendingTest": "テストを送信中…",
    "sudoPromptMessage": "サーバー上で権限なしにメールボックスの使用量を読み取ることはできません。SSH ユーザーの sudo パスワードを入力してください（サーバーに暗号化して保存されます）。",
    "to": "→",
    "total": "合計",
    "unlimited": "無制限",
    "yes": "はい",
    "keepCopy": "コピーを保存"
  },
  "placeholders": {
    "passwordNoChanges": "•••••••• (変更なし)",
    "selectDomain": "ドメインを選択...",
    "value": "値",
    "valueIfApplicable": "値（該当する場合）"
  },
  "status": {
    "active": "有効",
    "deactivated": "無効化済み",
    "inactive": "無効"
  },
  "titles": {
    "addForward": "転送を追加",
    "changeQuota": "クォータを変更",
    "deleteAccounts": "アカウントを削除",
    "deleteAutoresponder": "自動応答を削除",
    "deleteEncryptionKey": "鍵を削除",
    "deleteForward": "転送を削除"
  },
  "toasts": {
    "accountActivated": "アカウントを有効化しました",
    "accountCreated": "アカウントを作成しました",
    "accountDeactivated": "アカウントを無効化しました",
    "accountDeleted": "アカウントを削除しました",
    "accountUpdated": "アカウントを更新しました（{localPart}@{domain}）",
    "archiveDefaultUpdated": "アーカイブのデフォルト設定を更新しました。",
    "archiveDomainUpdated": "{domain} のアーカイブを更新しました。",
    "autoDeleteDisabled": "自動削除を無効にしました",
    "autoDeleteEnabled": "自動削除を有効にしました",
    "autoDeleteUpdated": "自動削除を更新しました",
    "autoresponderDeleted": "自動応答を削除しました",
    "autoresponderSaved": "自動応答を保存しました",
    "blacklistUpdated": "ブラックリストを更新しました",
    "bulkDeletedCount": "{ok}/{count} 件のアカウントを削除しました",
    "bulkUpdatedCount": "{ok}/{count} 件のアカウントを更新しました",
    "calculatedScoresUpdated": "計算済みスコアを更新しました",
    "calendarCreated": "カレンダーを作成しました",
    "calendarDeleted": "カレンダーを削除しました",
    "calendarUpdated": "カレンダーを更新しました",
    "cloneStarted": "複製を開始しました — 完了したら通知します",
    "contactCreated": "連絡先を作成しました",
    "contactDeleted": "連絡先を削除しました",
    "contactUpdated": "連絡先を更新しました",
    "defaultAddressUpdated": "@{domain} のデフォルトアドレスを更新しました",
    "defaultInboxSet": "{address} がデフォルトのメールアドレスになりました",
    "domainForwardDeleted": "@{domain} のグローバルリダイレクトを削除しました",
    "emailRoutingUpdated": "@{domain} のメールルーティングを更新しました",
    "emailsCopied": "{folder} から {count} 件のメールをコピーしました",
    "emailsDeleted": "{folder} から {count} 件のメールを削除しました",
    "filterCreated": "フィルターを作成しました",
    "filterDeleted": "フィルターを削除しました",
    "filterUpdated": "フィルターを更新しました",
    "forwardAddedCount": "{ok}/{count} 件のアカウントに転送を追加しました",
    "forwardDeleted": "転送を削除しました",
    "forwardsUpdated": "転送を更新しました",
    "globalFilterCreated": "グローバルフィルターを作成しました",
    "globalFilterDeleted": "グローバルフィルターを削除しました",
    "globalFilterUpdated": "グローバルフィルターを更新しました",
    "globalRedirectSaved": "@{domain} のグローバルリダイレクトを保存しました",
    "keyDeleted": "鍵を削除しました。",
    "keyGenerated": "鍵を生成しました。",
    "passwordUpdated": "パスワードを更新しました",
    "publicKeyImported": "公開鍵をインポートしました。",
    "settingsSaved": "設定を保存しました ✓",
    "spamBoxDisabled": "スパムボックスを無効にしました",
    "spamBoxEnabled": "スパムボックスを有効にしました",
    "spamBoxUpdated": "スパムボックスを更新しました",
    "spamFiltersDisabled": "スパムフィルターを無効にしました",
    "spamFiltersEnabled": "スパムフィルターを有効にしました",
    "spamThresholdUpdated": "スパム閾値を更新しました",
    "testEmailSent": "テストメールを送信しました ✓",
    "whitelistUpdated": "ホワイトリストを更新しました"
  },
  "signaturesDrawer": {
    "title": "署名",
    "addSignature": "署名を追加",
    "close": "閉じる",
    "tableTitle": "署名"
  },
  "dataTableTitles": {
    "rules": "ルール",
    "publicKeys": "公開鍵",
    "privateKeys": "秘密鍵",
    "accounts": "アカウント",
    "globalFilters": "グローバルフィルター",
    "contacts": "連絡先",
    "calendars": "カレンダー",
    "filters": "フィルター"
  },
  "trackColumns": {
    "event": "イベント",
    "fromAddress": "送信元アドレス",
    "sentTime": "送信時刻",
    "spamScore": "スパムスコア",
    "recipient": "宛先",
    "domain": "ドメイン",
    "queueId": "ID",
    "result": "結果",
    "actions": "操作"
  }
} as const;

export default mailPart2;
