const assistantPart3 = {
  "skillOptions": {
    "ponytail": {
      "mode": {
        "label": "強度",
        "choices": {
          "off": "オフ",
          "lite": "Lite — 最もシンプルな代替案を提案",
          "full": "Full — ラダーを適用",
          "ultra": "Ultra — YAGNI 過激主義"
        }
      }
    },
    "ui-ux-pro-max": {
      "detalle": {
        "label": "詳細度",
        "choices": {
          "breve": "簡易（最小トークン）",
          "completo": "詳細（より多くの詳細）"
        }
      }
    }
  },
  "toolCatalog": {
    "admin.bash": {
      "title": "bash コマンドを実行"
    },
    "admin.restart_service": {
      "title": "systemd サービスを再起動"
    },
    "backup.list_jobs": {
      "title": "設定済みバックアップを一覧表示"
    },
    "bitninja.status": {
      "title": "BitNinja ステータス"
    },
    "cloudflare.status": {
      "title": "Cloudflare ステータス"
    },
    "cloudflare.list_zones": {
      "title": "Cloudflare ゾーンを一覧表示"
    },
    "cloudflare.list_dns_records": {
      "title": "DNS レコードを一覧表示"
    },
    "cloudflare.create_dns_record": {
      "title": "DNS レコードを作成"
    },
    "cloudflare.update_dns_record": {
      "title": "DNS レコードを更新"
    },
    "cloudflare.delete_dns_record": {
      "title": "DNS レコードを削除"
    },
    "cloudflare.purge_cache": {
      "title": "Cloudflare キャッシュをパージ"
    },
    "cloudflare.get_zone_settings": {
      "title": "ゾーン設定を表示"
    },
    "cloudflare.set_zone_setting": {
      "title": "ゾーン設定を変更"
    },
    "cloudflare.list_access_rules": {
      "title": "IP アクセスルールを一覧表示"
    },
    "cloudflare.block_ip": {
      "title": "Cloudflare で IP をブロック"
    },
    "cron.list": {
      "title": "cron ジョブを一覧表示"
    },
    "cron.add": {
      "title": "cron ジョブを作成"
    },
    "cron.update": {
      "title": "cron ジョブを編集"
    },
    "cron.toggle": {
      "title": "cron ジョブを一時停止 / 再開"
    },
    "cron.remove": {
      "title": "cron ジョブを削除"
    },
    "cron.ai_list": {
      "title": "スケジュール済み AI エージェントを一覧表示"
    },
    "cron.ai_logs": {
      "title": "AI エージェントの実行履歴を一覧表示"
    },
    "cron.ai_read_log": {
      "title": "AI エージェントの実行内容を読む"
    },
    "cron.ai_run": {
      "title": "スケジュール済み AI エージェントを今すぐ実行"
    },
    "cron.ai_toggle": {
      "title": "スケジュール済み AI エージェントを一時停止 / 再開"
    },
    "cron.ai_add": {
      "title": "スケジュール済み AI エージェントを作成"
    },
    "cron.ai_update": {
      "title": "スケジュール済み AI エージェントを編集"
    },
    "cron.ai_remove": {
      "title": "スケジュール済み AI エージェントを削除"
    },
    "cron.presets_get": {
      "title": "エージェント設定を読み込む（プリセット）"
    },
    "cron.presets_set": {
      "title": "エージェント設定を保存する（プリセット）"
    },
    "dashboard.overview": {
      "title": "サーバー概要"
    },
    "databases.list_engines": {
      "title": "データベースエンジンを検出"
    },
    "databases.list_databases": {
      "title": "データベースを一覧表示"
    },
    "databases.list_tables": {
      "title": "テーブルを一覧表示"
    },
    "databases.run_query": {
      "title": "SQL クエリを実行"
    },
    "expo.status": {
      "title": "Expo ステータス"
    },
    "expo.account": {
      "title": "Expo アカウント"
    },
    "expo.list_projects": {
      "title": "Expo プロジェクトを一覧表示"
    },
    "expo.project_info": {
      "title": "プロジェクト情報"
    },
    "expo.init_project": {
      "title": "Expo プロジェクトを作成"
    },
    "expo.link_project": {
      "title": "プロジェクトを EAS にリンク"
    },
    "expo.build": {
      "title": "EAS ビルドを開始"
    },
    "expo.build_list": {
      "title": "ビルド履歴"
    },
    "expo.build_view": {
      "title": "ビルドステータス"
    },
    "expo.build_cancel": {
      "title": "ビルドをキャンセル"
    },
    "expo.submit": {
      "title": "ストアに提出"
    },
    "expo.dev_client": {
      "title": "dev-client を起動（QR）"
    },
    "expo.quota": {
      "title": "ビルドクォータ"
    },
    "expo.update": {
      "title": "OTA アップデートを公開"
    },
    "expo.env_list": {
      "title": "EAS 変数を一覧表示"
    },
    "expo.env_set": {
      "title": "EAS 変数を作成"
    },
    "expo.set_google_credential": {
      "title": "Play Store 認証情報"
    },
    "expo.set_apple_credential": {
      "title": "App Store 認証情報"
    },
    "expo.webhook_create": {
      "title": "EAS Webhook を登録"
    },
    "expo.device_create": {
      "title": "iOS デバイスを登録"
    },
    "files.read": {
      "title": "ファイルを読む"
    },
    "files.list_dir": {
      "title": "ディレクトリを一覧表示"
    },
    "files.grep": {
      "title": "ファイル内を検索"
    },
    "files.project_info": {
      "title": "プロジェクトタイプを検出"
    },
    "files.security_scan": {
      "title": "ヒューリスティックセキュリティスキャン"
    },
    "files.write": {
      "title": "ファイルを書き込む"
    },
    "files.mkdir": {
      "title": "フォルダーを作成"
    },
    "files.delete": {
      "title": "ファイルまたはフォルダーを削除"
    },
    "files.rename": {
      "title": "名前変更または移動"
    },
    "files.copy": {
      "title": "ファイルをコピー"
    },
    "files.chmod": {
      "title": "権限を変更（chmod）"
    },
    "files.chown": {
      "title": "所有者を変更（chown）"
    },
    "firewall.ufw_status": {
      "title": "UFW ステータス"
    },
    "firewall.fail2ban_status": {
      "title": "fail2ban ステータス（ジェイル）"
    },
    "hosting.list_accounts": {
      "title": "ホスティングアカウントを一覧表示"
    },
    "hosting.list_audit": {
      "title": "ホスティングアカウントの監査ログを表示"
    },
    "hosting.account_stats": {
      "title": "ホスティングアカウントの使用状況統計"
    },
    "mail.list_domains": {
      "title": "利用可能なドメイン"
    },
    "mail.list_messages": {
      "title": "メールボックスのメッセージを一覧表示"
    },
    "mail.fetch_message": {
      "title": "メッセージの全文を読む"
    },
    "mail.move_messages": {
      "title": "メッセージを隔離へ移動"
    },
    "mail.flag_messages": {
      "title": "メッセージにフラグを付ける"
    },
    "mail.delete_messages": {
      "title": "メッセージを削除（完全削除）"
    },
    "module-dev.validate_manifest": {
      "title": "マニフェストを検証"
    },
    "module-dev.run_checks": {
      "title": "モジュール静的チェック"
    },
    "module-dev.run_tests": {
      "title": "モジュールテストを実行"
    },
    "module-dev.list_modules": {
      "title": "マイマーケットプレイスモジュール"
    },
    "module-dev.module_status": {
      "title": "モジュールステータス"
    },
    "module-dev.submit_module": {
      "title": "モジュールをレビュー用に提出"
    },
    "module-dev.resubmit_module": {
      "title": "修正済みモジュールを再提出"
    },
    "module-dev.unpublish_module": {
      "title": "モジュールを非公開にする"
    },
    "module-dev.republish_module": {
      "title": "モジュールを再公開する"
    },
    "module-dev.preview_install": {
      "title": "プレビューをインストール（モード B）"
    },
    "module-dev.preview_uninstall": {
      "title": "プレビューをアンインストール"
    },
    "module-dev.link_project": {
      "title": "プロジェクト ↔ モジュールをリンク"
    },
    "monitor.cpu_top": {
      "title": "CPU 上位プロセス"
    },
    "monitor.watchdog_status": {
      "title": "自動再起動ステータス"
    },
    "monitor.watchdog_configure": {
      "title": "自動再起動を設定"
    },
    "nginx.list_sites": {
      "title": "nginx サイトを一覧表示"
    },
    "nginx.tail_access_log": {
      "title": "access.log をテール"
    },
    "obsidian.list_vaults": {
      "title": "ボルトを一覧表示"
    },
    "obsidian.list_notes": {
      "title": "ノートを一覧表示"
    },
    "obsidian.read_note": {
      "title": "ノートを読む"
    },
    "obsidian.search_notes": {
      "title": "ノートを検索"
    },
    "obsidian.backlinks": {
      "title": "ノートのバックリンク"
    },
    "obsidian.write_note": {
      "title": "ノートを書く"
    },
    "obsidian.append_note": {
      "title": "ノートに追記"
    },
    "obsidian.daily_note": {
      "title": "デイリーノート"
    },
    "obsidian.delete_note": {
      "title": "ノートを削除"
    },
    "obsidian.list_containers": {
      "title": "コンテキストコンテナを一覧表示"
    },
    "obsidian.sync_containers": {
      "title": "コンテキストコンテナを同期"
    },
    "openclaw.config": {
      "title": "OpenClaw 設定"
    },
    "openclaw.test_connection": {
      "title": "OpenClaw 接続をテスト"
    },
    "security-audit.last_report": {
      "title": "最新の監査レポート"
    },
    "security-audit.ssh_posture": {
      "title": "サーバー SSH セキュリティ姿勢"
    },
    "server-alerts.send": {
      "title": "サーバーに通知を送信"
    },
    "server-alerts.list_rules": {
      "title": "アラートルールを一覧表示"
    },
    "server-alerts.create_rule": {
      "title": "アラートルールを作成"
    },
    "users.list": {
      "title": "パネルユーザーを一覧表示"
    },
    "users.create": {
      "title": "ユーザーを作成"
    },
    "users.update": {
      "title": "ユーザーを編集"
    },
    "users.delete": {
      "title": "ユーザーを削除"
    },
    "users.groups_list": {
      "title": "権限付きグループを一覧表示"
    },
    "users.group_create": {
      "title": "グループを作成"
    },
    "users.group_update": {
      "title": "グループを編集"
    },
    "users.group_delete": {
      "title": "グループを削除"
    },
    "webhooks.list": {
      "title": "設定済み Webhook を一覧表示"
    }
  },
  "dataPanelCatalog": {
    "admin.health": {
      "title": "サーバーヘルス",
      "description": "接続されたターゲットの到達可能性 / 負荷プローブ — 運用上の質問に答える前のシステムプロンプトコンテキストとして有用。"
    },
    "dashboard.snapshot": {
      "title": "コンパクト概要",
      "description": "接続されたターゲットのコンパクトなプリプロンプト要約：負荷、RAM%、ルートディスク%、稼働中のキーサービス数。"
    },
    "monitor.snapshot": {
      "title": "システムスナップショット",
      "description": "接続されたターゲットの現在のリソース要約：CPU 使用率%、平均負荷、使用メモリ / 合計メモリ、ルートファイルシステム使用率。"
    },
    "obsidian.vaults_summary": {
      "title": "ボルト要約",
      "description": "接続されたサーバーに登録された Obsidian ボルトとそのパス、存在状態、マークダウンノート数。"
    }
  },
  "structurePanel": {
    "editorLoading": "エディターを読み込み中...",
    "loading": "読み込み中...",
    "createdNotice": "{count} 件のアイテムを作成しました。",
    "nothingToCreate": "作成するものがありません（すでに存在します）。",
    "savedNotice": "{rel} を保存しました。",
    "noActiveProviders": "アクティブな AI プロバイダーがありません。プロバイダーで有効にしてください。",
    "improvedNotice": "AI で改善されました。差分を確認し、問題なければ保存をクリックしてください。",
    "noAiChanges": "AI は変更を提案しませんでした。",
    "structureLoading": "構造を分析中...",
    "retry": "再試行",
    "copyAllContent": "すべてのコンテンツをコピー",
    "copied": "コピー済み",
    "copy": "コピー",
    "downloadFile": "ファイルをダウンロード",
    "download": "ダウンロード",
    "diff": "差分",
    "originalDiffTitle": "元のコンテンツとの差分を表示",
    "back": "戻る",
    "improveContentTitle": "プロジェクトコンテキストを使用して AI でコンテンツを改善",
    "improving": "改善中...",
    "improveWithAi": "AI で改善",
    "cancel": "キャンセル",
    "saving": "保存中...",
    "save": "保存",
    "chooseProvider": "AI プロバイダーを選択",
    "close": "閉じる",
    "noModel": "（モデルなし）",
    "directory": "ディレクトリ",
    "structureCount": "構造 · 作成予定 {count} 件",
    "markMissing": "不足を確認",
    "creating": "作成中...",
    "create": "作成（{count}）",
    "expand": "展開",
    "collapse": "折りたたむ",
    "edit": "編集",
    "exists": "既存",
    "createLabel": "作成",
    "fallbackFilename": "file.txt",
    "structureHints": {
      "claude": "Claude Code がプロジェクトディレクトリから読み込む指示、設定、ルール、コマンド、スキル、エージェント、フック。",
      "codex": "Codex CLI は AGENTS.md をプロジェクトガイドとして、.codex/ を設定とプロンプトとして読み込みます。",
      "gemini": "Gemini CLI は GEMINI.md をプロジェクトコンテキストとして、.gemini/ を設定とコマンドとして読み込みます。"
    },
    "structureNodes": {
      "CLAUDE.md": "プロジェクト指示（コンテキスト、コマンド、規約）",
      "CLAUDE.local.md": "ローカル指示（コミットしない。個人設定）",
      ".mcp.json": "プロジェクトの MCP サーバー",
      ".claude/settings.json": "プロジェクト設定（バージョン管理対象）",
      ".claude/settings.local.json": "ローカル設定（バージョン管理対象外）",
      ".claude/rules": "再利用可能なルール",
      ".claude/rules/code-style.md": "ルール: コードスタイル",
      ".claude/rules/testing.md": "ルール: テスト",
      ".claude/rules/api-conventions.md": "ルール: API 規約",
      ".claude/commands": "カスタムスラッシュコマンド",
      ".claude/commands/review.md": "/review コマンド",
      ".claude/commands/fix-issue.md": "/fix-issue コマンド",
      ".claude/skills": "プロジェクトのスキル",
      ".claude/skills/deploy": "スキル: deploy",
      ".claude/skills/deploy/SKILL.md": "deploy スキルの定義",
      ".claude/skills/deploy/deploy-config.md": "deploy スキルの設定",
      ".claude/agents": "専門のサブエージェント",
      ".claude/agents/code-reviewer.md": "エージェント: コードレビュアー",
      ".claude/agents/security-auditor.md": "エージェント: セキュリティ監査担当",
      ".claude/hooks": "フック（ライフサイクルスクリプト）",
      ".claude/hooks/validate-bash.sh": "フック: bash コマンドの検証",
      "AGENTS.md": "Codex/エージェント向けのプロジェクトガイド",
      ".codex": "Codex の設定",
      ".codex/config.toml": "Codex のプロジェクト設定",
      ".codex/prompts": "再利用可能なプロンプト/テンプレート",
      ".codex/prompts/review.md": "プロンプト: コードレビュー",
      "GEMINI.md": "Gemini 向けのプロジェクトコンテキスト",
      ".gemini": "Gemini の設定",
      ".gemini/settings.json": "Gemini のプロジェクト設定",
      ".gemini/commands": "カスタムコマンド",
      ".gemini/commands/review.toml": "コマンド: review",
      "modules/*": "マーケットプレイスモジュールのルート",
      "modules/*/module.manifest.json": "ドラフトマニフェスト（AUTO フィールドはプラットフォームが設定）",
      "modules/*/backend/index.js": "モジュールのバックエンド — SDK の defineModule() スケルトン",
      "modules/*/frontend": "モジュールのフロントエンド（Astro、任意）",
      "modules/*/README.md": "モジュールの README",
      ".claude/rules/marketplace.md": "ルール: マーケットプレイスのアーキテクチャ（マニフェスト、SDK、機能）",
      "MARKETPLACE.md": "マーケットプレイスのアーキテクチャルール（マニフェスト、SDK、機能）"
    }
  },
  "mcpConfigPanel": {
    "noInstallResponse": "インストール応答なし",
    "summaryTitle": "パネル機能を CLI に公開（MCP）",
    "optional": "省略可",
    "description": "{providerId} CLI をパネルのツールに接続します。パネルはターゲットサーバーに直接設定を書き込みます。何もコピーする必要はありません。",
    "configuredTitle": "ターゲットで設定済み",
    "tokenValidUntil": "トークンは {date} まで有効です。",
    "restartCli": "ターミナルで CLI を再起動して新しい MCP サーバーを読み込んでください。",
    "configuring": "設定中...",
    "configureAutomatically": "自動設定",
    "regenerate": "トークンを再生成して再設定",
    "manualTitle": "手動設定（上級者向け）",
    "generating": "生成中...",
    "generateManualSnippet": "手動スニペットを生成",
    "fileLabel": "ファイル",
    "snippetLabel": "スニペット（{format}）",
    "copy": "コピー",
    "mcpUrlLabel": "MCP URL"
  },
  "conversationMedia": {
    "download": "ダウンロード",
    "close": "閉じる",
    "previous": "前へ",
    "next": "次へ",
    "all": "すべて",
    "images": "画像",
    "documents": "ドキュメント",
    "attachmentsTitle": "会話の添付ファイル",
    "emptyConversation": "この会話に添付ファイルはありません。",
    "imagesSection": "画像",
    "documentsSection": "ドキュメント",
    "clickToExpand": "クリックして展開",
    "emptyImages": "画像はありません。",
    "emptyDocuments": "ドキュメントはありません。",
    "mediaTitle": "メディア",
    "attachToChat": "チャットに添付",
    "uploadToChat": "チャットにファイルをアップロード",
    "attachFailed": "ファイルをチャットに添付できませんでした。"
  },
  "teamBoard": {
    "title": "チーム作業中",
    "progressOf": "{total}件中{done}件のタスクが完了",
    "statusPending": "保留中",
    "statusRunning": "進行中",
    "statusDone": "完了",
    "statusFailed": "失敗",
    "statusCanceled": "キャンセル済み",
    "pendingPermission": "承認待ち",
    "openChat": "チャットを開く",
    "cancel": "タスクをキャンセル",
    "cancelConfirm": "このタスクをキャンセルしますか？エージェントは作業を停止します。",
    "assignedTo": "担当: {agent}",
    "autoTurn": "チームの自動通知",
    "dashboardTitle": "作業中のチーム",
    "tokensSummary": "トークン: {total}（リーダー {leader} · チーム {workers}）",
    "lessThan1s": "1秒未満",
    "insertions": "+{count}",
    "deletions": "-{count}",
    "viewDiff": "差分を表示",
    "close": "閉じる",
    "loading": "読み込み中…",
    "statusQueued": "キュー",
    "verifyRunning": "確認中…",
    "addTaskSubmit": "割り当て",
    "verifyPassed": "確認済み",
    "verifyFailed": "検証に失敗しました（{attempts}）",
    "filesChanged": "{count} 件のファイル",
    "diffTitle": "タスクの変更",
    "diffUnavailable": "このタスクの差分はありません（ワークツリーまたは変更がありません）。",
    "diffTruncated": "差分は省略されています。表示範囲を超える変更があります。",
    "branchIntegrated": "ブランチを統合済み",
    "cancelAll": "すべてキャンセル",
    "cancelAllConfirm": "実行中のすべてのタスクをキャンセルしますか？進行中の計画は失敗として記録されます。",
    "addTask": "タスクを追加",
    "addTaskTitle": "部下のエージェントにタスクを割り当てる",
    "addTaskWorker": "部下のエージェント",
    "addTaskWorkerPlaceholder": "— エージェントを選択 —",
    "addTaskNoWorkers": "このリーダーには直属の部下がいません。",
    "addTaskInstruction": "指示",
    "addTaskInstructionHint": "エージェントはこの会話を見られません。必要な背景情報をすべて含めてください。",
    "addTaskTitleField": "タイトル（任意）",
    "addTaskProject": "プロジェクト（任意）",
    "addTaskProjectNone": "— プロジェクトなし —",
    "addTaskSubmitting": "割り当て中…",
    "feedbackUp": "良い結果",
    "feedbackDown": "悪い結果",
    "orgChart": "組織図",
    "tokensChipTitle": "このタスクで使用したトークン"
  },
  "agentInfo": {
    "roleLabel": "ロール",
    "roleTooltip": "エージェントのロール: {role}",
    "providerLabel": "プロバイダー",
    "providerModelTooltip": "プロバイダー {provider} · モデル {model}",
    "projectLabel": "プロジェクト",
    "projectTooltip": "プロジェクト: {project}"
  },
  "mermaidDiagram": {
    "zoomOut": "ズームアウト",
    "zoomIn": "ズームイン",
    "zoomReset": "ズームをリセット"
  },
  "assistantErrorBoundary": {
    "errorMessage": "アシスタントの読み込み中にエラーが発生しました。",
    "retry": "再試行"
  }
} as const;

export default assistantPart3;
