const firewall = {
  "pageTitle": "ファイアウォール",
  "installWarning": {
    "title": "ファイアウォールコンポーネントが検出されません",
    "description": "パッケージマネージャー（apt/dnf/apk/...）をデフォルト設定で実行し、完了後にサービスを有効にします。",
    "btnInstall": "今すぐインストール"
  },
  "statusCard": {
    "label": "ファイアウォール状態 (UFW)",
    "verifying": "確認中...",
    "btnDisable": "無効にする",
    "btnEnable": "有効にする"
  },
  "securityAudit": {
    "title": "セキュリティ監査 (プレミアム)",
    "btnStartAudit": "スキャンを開始",
    "scannerChecking": "確認中…",
    "btnInstallScanner": "インストール",
    "scanProgress": "スキャンの進行状況",
    "scanAi": "AI解析：0%",
    "noReports": "完了した監査がありません。新しい監査を開始してください。"
  },
  "ufwRules": {
    "title": "UFWルール",
    "btnNewRule": "新しいルール",
    "loading": "ルールを読み込み中...",
    "btnAllowCloudflare": "Cloudflareを許可",
    "searchLabel": "ルールを検索",
    "searchPlaceholder": "ポート、IP、コメントを検索…"
  },
  "fail2ban": {
    "btnBanIp": "IPをブロック",
    "loading": "jailを読み込み中..."
  },
  "ruleDialog": {
    "title": "新しいUFWルール",
    "labelAction": "アクション",
    "optionAllow": "許可",
    "optionDeny": "拒否",
    "optionReject": "却下",
    "labelProtocol": "プロトコル",
    "optionAny": "すべて",
    "labelPort": "ポート",
    "placeholderPort": "25 または 8080:8090",
    "labelFromIp": "送信元 IP",
    "placeholderFromIp": "any または 192.168.0.0/24",
    "labelComment": "コメント（任意）",
    "placeholderComment": "受信SMTP",
    "btnCancel": "キャンセル",
    "btnAdd": "ルールを追加"
  },
  "banDialog": {
    "title": "IPを手動でブロック",
    "labelIp": "IPアドレス",
    "placeholderIp": "192.168.1.100",
    "labelJail": "Fail2ban ジェイル",
    "btnCancel": "キャンセル",
    "btnBan": "ブロック"
  },
  "auditReportDialog": {
    "title": "セキュリティ監査レポート",
    "btnClose": "閉じる"
  },
  "aiAssistant": {
    "btnSuggestRules": "ルールを提案 (AI)",
    "btnSuggestBans": "BANを提案 (AI)",
    "btnAnalyze": "AI分析",
    "promptUfw": "接続中サーバーの UFW ファイアウォールを分析してください: 状態と現在のルールを確認し(firewall.ufw_status ツールを使用)、稼働中のサービスを止めずにセキュリティを向上させる賢い UFW ルールを提案してください。提案する各ルールについて理由を説明し、適用するための正確な `ufw` コマンドを添えてください。",
    "promptFail2ban": "接続中サーバーの Fail2ban を分析してください: 設定されている jail とブロック中の IP を確認し(firewall.fail2ban_status ツールを使用)、ブルートフォース攻撃から保護するためのブロックと設定の改善を提案してください。jail、IP/範囲、理由と適用するコマンドを明記してください。",
    "promptAnalyze": "接続中サーバーのファイアウォールに対する総合的なセキュリティ分析を実施してください。UFW と Fail2ban の状態を確認し(firewall.ufw_status と firewall.fail2ban_status ツールを使用)、リスク、公開ポート、弱い設定を特定し、優先順位付きの推奨事項と適用するコマンドを提示してください。",
    "analyzeRule": "AIで分析",
    "promptRule": "接続中サーバーのこの既存UFWルールを分析してください。許可またはブロックされるトラフィックを説明し、リスクを評価し、維持・調整・置換のいずれが適切か提案してください。変更を提案する場合は正確なコマンドを添えてください。\n\nルール #{number}\nアクション: {action}\n宛先/ポート: {to}\n送信元: {from}\nプロトコル: {proto}\nコメント: {comment}"
  },
  "labels": {
    "active": "有効",
    "inactive": "無効",
    "bannedCount": "{count}件Ban済み",
    "moreIps": "+{n} 件以上",
    "installingText": "UFWとFail2banをインストール中…数分かかる場合があります。",
    "installSuccessText": "ファイアウォールを正常にインストールしました。",
    "cfEdgeBlockQuestion": "{ip}をCloudflareエッジでもブロックしますか？",
    "findingsCount": "{n}件の検出結果",
    "completedAt": "{time}に完了",
    "scanAiProgress": "AI分析: {pct}%",
    "overallRisk": "総合リスク",
    "unknown": "不明",
    "keyThreats": "主な脅威",
    "recommendations": "推奨事項",
    "findingsTitle": "検出結果（{n}）",
    "moreFindingsCount": "+{n} 件の検出",
    "from": "送信元",
    "any": "すべて",
    "scanBitNinjaProgress": "BitNinja: {pct}%",
    "scanLynisProgress": "Lynis: {pct}%",
    "scanRkhunterProgress": "Rkhunter: {pct}%",
    "scanChkrootkitProgress": "Chkrootkit: {pct}%"
  },
  "empty": {
    "noRules": "ルールなし",
    "noJails": "アクティブなJailなし"
  },
  "actions": {
    "unban": "BAN解除",
    "blockInCloudflare": "Cloudflareでブロック",
    "dismiss": "閉じる"
  },
  "confirm": {
    "deleteRuleMsg": "ルール #{number} を削除しますか？",
    "deleteRuleTitle": "ルールの削除",
    "disableFwMsg": "ファイアウォールを無効にしますか？サーバーのネットワーク保護が解除されます。",
    "disableFwTitle": "ファイアウォールを無効化",
    "disableFwBtn": "はい、無効にする",
    "cfAllowMsg": "Cloudflareの公式IPレンジからの80/443を許可するUFWルールが追加されます。続行しますか？",
    "cfAllowTitle": "CloudflareのIPを許可",
    "cfAllowBtn": "続行"
  },
  "toasts": {
    "ruleDeleted": "ルールを削除しました",
    "errorDelete": "削除エラー",
    "ipUnbanned": "{ip} のBAN解除完了",
    "errorUnban": "BAN解除エラー",
    "fwEnabled": "ファイアウォール有効",
    "errorEnable": "有効化エラー",
    "fwDisabled": "ファイアウォール無効",
    "errorDisable": "無効化エラー",
    "fwInstalled": "ファイアウォールをインストールしました",
    "ruleAdded": "ルールを追加しました",
    "ipBanned": "{ip} を {jail} でBANしました",
    "errorBan": "BANエラー",
    "cfRulesApplied": "Cloudflareルールを適用しました（{applied}）",
    "errorCfRules": "Cloudflareルールの適用エラー",
    "errorStartAudit": "監査の開始エラー",
    "auditCompleted": "監査が完了しました",
    "auditFailed": "監査が失敗しました",
    "errorLoadReport": "レポートの読み込みエラー",
    "reportOf": "{date} のレポート"
  },
  "errors": {
    "addRule": "ルールの追加エラー"
  },
  "runtime": {
    "statusError": "状態を確認できませんでした",
    "rulesLoadError": "ルールを読み込めませんでした。",
    "noMatchingRules": "フィルターに一致するルールはありません。",
    "loggingSaved": "ログレベルを保存しました。",
    "loggingSaveError": "ログレベルを保存できませんでした。"
  },
  "settingsUi": {
    "rulesView": "ルール表示",
    "ufwLog": "UFWログ",
    "related": "関連",
    "title": "ファイアウォール設定",
    "description": "個人用フィルターとアクティブなサーバーのUFWログ。",
    "sectionsLabel": "ファイアウォール設定の項目",
    "showActions": "操作を表示",
    "all": "すべて",
    "limit": "制限",
    "serverSettingHint": "この設定はアクティブなサーバーの構成を変更します。",
    "logLevel": "ログレベル",
    "off": "無効",
    "low": "低",
    "medium": "中",
    "high": "高",
    "full": "すべて",
    "saveLevel": "レベルを保存",
    "relatedModules": "関連モジュール"
  }
} as const;

export default firewall;
