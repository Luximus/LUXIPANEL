const assistantPart2 = {
  "cliUsageBars": {
    "sourceReal": "アカウントの残りの割り当て",
    "sourceEstimated": "推定残りトークン数",
    "sourceTokens": "残りトークン数",
    "cliUsage": "CLI残量",
    "session5h": "セッション（5時間）",
    "week": "週間",
    "sessionHours": "セッション（{hours}時間）",
    "resetSameDay": "{time} にリセット",
    "resetOtherDay": "{day} {time} にリセット",
    "unavailable": "{provider} の残りの割り当てを取得できませんでした",
    "retry": "再試行"
  },
  "notifySettings": {
    "title": "アシスタントの通知",
    "description": "チャットが終了し、見ていないときに、お使いのデバイス（ウェブ、アプリ、デスクトップ）に通知します。",
    "saveError": "保存できませんでした。"
  },
  "voiceSettings": {
    "title": "音声（オーディオ）",
    "description": "OpenAI を使ってアシスタントに話しかけ、回答を音声で聞けます。",
    "missingCapabilities": "音声を有効にするには、Codex プロバイダーに OpenAI API キーを設定してください。",
    "inputLabel": "入力（STT）",
    "outputLabel": "出力（TTS）",
    "notAvailable": "利用不可",
    "voiceLabel": "音声",
    "autoSpeak": "完了時に回答を自動で読み上げる",
    "audioProvider": "音声プロバイダー",
    "providerApi": "API (OpenAI/Gemini)",
    "providerPiper": "Piper（ローカル）",
    "providerMinimax": "MiniMax",
    "providerApiHint": "設定済みの API キーを使用します。",
    "piperReady": "Piper インストール済み",
    "piperMissing": "Piper 未インストール",
    "minimaxReady": "MiniMax 利用可能",
    "minimaxMissing": "MiniMax 利用不可",
    "minimaxAuthMissing": "MiniMax のキーがありません",
    "minimaxVoiceHint": "使用する MiniMax の音声。"
  },
  "agentMarket": {
    "title": "Market",
    "description": "このサーバーのプロジェクトで再利用できるプロフィール。",
    "search": "名前、説明、専門分野、技術で検索",
    "project": "現在のプロジェクト",
    "chooseProject": "プロジェクトを選択",
    "allProviders": "すべてのプロバイダー",
    "allRoles": "すべてのロール",
    "allAssignments": "すべての割り当て",
    "assigned": "割り当て済み",
    "unassigned": "未割り当て",
    "inherited": "継承",
    "removed": "削除済み",
    "empty": "エージェントのプロフィールはまだありません。",
    "noMatches": "条件に一致するプロフィールがありません。",
    "loading": "カタログを読み込み中…",
    "retry": "再試行",
    "error": "カタログを読み込みまたは更新できませんでした。",
    "pending": "処理中…",
    "add": "プロジェクトに追加",
    "remove": "プロジェクトから外す",
    "configure": "割り当てを設定",
    "editProfile": "共通プロフィールを編集",
    "profileHint": "プロフィールの変更はすべての所属プロジェクトに適用されます。",
    "assignmentHint": "この設定は選択したプロジェクトにのみ適用されます。",
    "removeConfirm": "このプロジェクトから {name} を外しますか？プロフィールと履歴は保持されます。",
    "saved": "変更を保存しました。",
    "specialty": "専門分野",
    "technologies": "技術（カンマ区切り）",
    "newProfile": "プロフィールを作成",
    "back": "チャットに戻る",
    "inheritedHint": "{project} から継承しています。解除は元のプロジェクトで行ってください。",
    "readOnly": "読み取り専用",
    "busy": "保留中の作業や承認があります。割り当てを変更する前に完了してください。",
    "forbidden": "この操作を行う権限がありません。",
    "contextChanged": "サーバーまたはセッションが変わりました。カタログを再読み込みしてください。",
    "uncertain": "結果を確認できませんでした。操作を繰り返す前にカタログを確認してください。",
    "historical": "履歴用：新しいチャットでは利用不可",
    "inherit": "プロフィールから継承",
    "none": "なし",
    "jobTitle": "プロジェクトでの職務",
    "instructions": "プロジェクトの指示",
    "limitsHint": "制限は既存の権限と組み合わせて適用され、追加のアクセスは付与しません。"
  },
  "agentsTab": {
    "teams": {
      "newTeamBtn": "新しいチーム",
      "newTeamTitle": "チームを作成",
      "editTeamTitle": "チームを編集",
      "nameLabel": "名前",
      "namePlaceholder": "例: Backend、Frontend、Design…",
      "descriptionLabel": "説明（任意）",
      "colorLabel": "色",
      "createBtn": "チームを作成",
      "saveBtn": "保存",
      "cancelBtn": "キャンセル",
      "addAgentsBtn": "エージェントを追加",
      "addAgentsTitle": "チームにエージェントを追加",
      "addAgentsEmpty": "追加できるエージェントがありません。",
      "addAgentsConfirm": "追加",
      "alreadyInTeam": "別のチームに所属",
      "removeFromTeamBtn": "チームから外す",
      "removeFromTeamConfirm": "このエージェントをチームから外しますか？エージェントは削除されません。",
      "deleteTeamBtn": "チームを削除",
      "deleteTeamConfirm": "このチームを削除しますか？",
      "deleteTeamKeepsAgentsNote": "エージェントは削除されません。チームから外されるだけです。",
      "teamSelectorLabel": "チーム",
      "groupRequired": "グループを選択または作成してください",
      "teamSelectorPlaceholder": "— グループを選択 —",
      "noTeamOption": "チームなし",
      "emptyTeamHint": "空のチーム — + ボタンでエージェントを追加してください。",
      "memberCount": "{count} 人のメンバー"
    },
    "cancel": "キャンセル",
    "saving": "保存中…",
    "saveChanges": "変更を保存",
    "noDescription": "説明なし",
    "allTools": "すべてのツール",
    "toolsCount": "{count} ツール",
    "noActiveModules": "ツールを持つアクティブなモジュールがありません。",
    "removeAll": "すべて削除",
    "selectAll": "すべて選択",
    "sensitiveTool": "機密操作",
    "confirmDeleteAgent": "エージェント「{name}」を削除しますか？",
    "confirmDeleteRole": "ロール「{name}」を削除しますか？使用中のエージェントから削除されます。",
    "duplicateName": "{name} (コピー)",
    "editBtn": "編集",
    "deleteTitle": "削除",
    "errorPrefix": "エラー: {message}",
    "backToAgents": "エージェント",
    "createdBy": "{ownerName} が作成",
    "diagram": {
      "empty": "エージェントなし — 作成するとここに表示されます",
      "connection": "接続"
    },
    "archetypes": {
      "devops": "DevOps / SRE",
      "security": "セキュリティ監査",
      "dba": "データベース管理者",
      "support": "テクニカルサポート",
      "nginx": "Webサーバー管理 / Nginx",
      "backups": "バックアップ専門家",
      "logs": "ログアナリスト",
      "automation": "自動化 / Cron"
    },
    "editor": {
      "titleNew": "新規エージェント",
      "titleEdit": "エージェントを編集",
      "headerTitleNew": "新しいエージェント",
      "headerDescNew": "新しいAIエージェントを設定",
      "headerTitleEdit": "エージェントを編集",
      "headerDescEdit": "エージェントの設定を変更",
      "backToList": "エージェント一覧へ戻る",
      "tabGeneral": "一般",
      "tabModel": "モデル",
      "tabHierarchy": "階層",
      "tabTools": "ツール",
      "tabResources": "リソース",
      "tabAccess": "アクセス",
      "aiHelpTitle": "AIアシスト",
      "aiHelpDesc": "プロフィールを選択すると、AIが名前・説明・プロンプト・ツールをプロ仕様で自動生成します。",
      "aiHelpSelect": "プロフィールを選択…",
      "aiHelpFromDesc": "説明文から生成",
      "aiHelpFromDescTitle": "現在の説明をもとに改善",
      "aiHelpGenerating": "AIでエージェントを生成中…",
      "fieldName": "名前",
      "namePlaceholder": "例: セキュリティ監査",
      "fieldDescription": "説明",
      "descPlaceholder": "このエージェントの用途",
      "fieldSystemPrompt": "システムプロンプト",
      "systemPromptPlaceholder": "エージェントの指示・キャラクター・目標…",
      "fieldAvatar": "アバター",
      "avatarRandomize": "ランダム",
      "avatarAuto": "自動",
      "avatarAttrs": {
        "top": "髪型・帽子",
        "hairColor": "髪の色",
        "eyes": "目",
        "eyebrows": "眉",
        "mouth": "口",
        "skinColor": "肌の色",
        "clothing": "服装",
        "clothesColor": "服の色",
        "accessories": "アクセサリー",
        "facialHair": "ひげ",
        "facialHairColor": "ひげの色"
      },
      "fieldProvider": "プロバイダー",
      "fieldModel": "モデル",
      "modelPlaceholder": "（プロバイダーのデフォルト）",
      "realtimeLabel": "リアルタイム通信（低遅延セッション）",
      "realtimeDesc": "双方向のオーディオ/テキストストリーミングセッション（プロバイダーにより OpenAI Realtime または Gemini Live）。",
      "realtimeUnavailable": "プロバイダー「{providerId}」はリアルタイムセッションに対応していません。codex（OpenAI）またはgeminiのみ利用可能です。",
      "multiAgentLabel": "マルチエージェントモード: 同一エージェントを複数並列実行",
      "multiAgentDescPre": "エージェントは",
      "multiAgentDescBold": "X倍に増殖",
      "multiAgentDescPost": "します: タスクはX個に分割され、各コピー（同じプロンプト・ツール・プロバイダー）が並列で処理し、最終的に1つの回答にまとめられます。",
      "multiAgentCopies": "コピー数（X）",
      "multiAgentCopiesHint": "エージェントのコピー（2〜8）",
      "multiAgentProvidersPre": "オプション — 複数のプロバイダーにコピーを分散します（メイン ",
      "multiAgentProvidersPost": " は常に参加します。他を選択して分散してください）:",
      "multiAgentApiHint": "APIキーを持つAPIモードのプロバイダーのみ使用されます。マルチエージェントにはAPIモードが必要です。",
      "roleHeading": "ロールと階層",
      "roleAssigned": "割り当てられたロール",
      "roleNone": "ロールなし",
      "roleHint": "ロールはベースプロンプトとデフォルトツールを提供し、エージェントがそれを補完します。ロールはエージェント一覧から管理します。",
      "parentAgent": "上位エージェント（従属）",
      "parentNone": "なし（最上位）",
      "parentHintPre": "上位エージェントはこのエージェントに",
      "parentHintBold": "委任",
      "parentHintPost": "できます: 実行中にタスクを委任し、その結果を利用します。",
      "connectionsLabel": "他のエージェントとの接続",
      "connectionsEmpty": "他のエージェントはありません。",
      "connectionsHint": "双方向チャンネル: 実行中に互いに情報を要求または提供できます（委任ツール）。",
      "supervisorLabel": "スーパーバイザー: 部下のためにチャットを作成できます",
      "supervisorDesc": "チャットタブで実際のチャットを開き、部下エージェントに作業を割り当てます（各チャットはエージェントのログとして残ります）。ロール経由でも付与されます。",
      "allowAllTools": "利用可能なすべてのツールを許可",
      "toolsDesc": "このエージェントが使用できるツールのサブセットを選択します。各モジュールの許可と交差するため、権限が拡張されることはありません。",
      "associatedServers": "関連サーバー",
      "serversEmpty": "登録済みサーバーはありません。",
      "attachedProjects": "紐付けプロジェクト",
      "attachedProjectsDesc": "ツリーから1つ以上のプロジェクトを選択します。親プロジェクトを選択すると、その入れ子フォルダがすべて選択されます。エージェントは選択したプロジェクトの作業パスを使用します。",
      "noParentProjects": "プロジェクトがありません。",
      "graphIndexesTitle": "コードグラフインデックス",
      "graphIndexesDesc": "エージェントはファイル全体を読む代わりに、これらのインデックスでグラフからコードを探索します（シンボル・呼び出し・アーキテクチャ）— トークン消費を削減します。",
      "graphIndexesEmpty": "利用可能なグラフインデックスがありません。プロジェクトタブからプロジェクトをインデックスしてください。",
      "credentialTitle": "アクセス資格情報",
      "saveObsidian": "紐付けプロジェクトのObsidian vaultにサマリーを保存",
      "agentSkills": "エージェントのスキル",
      "createAgent": "エージェントを作成",
      "snippetsSection": "ターミナルSnippets",
      "snippetsCategoryLabel": "Snippetsのカテゴリ",
      "snippetsCategoryNone": "（なし）",
      "snippetsTagsLabel": "カテゴリのタグ",
      "snippetsHelp": "このエージェントが利用できるターミナルSnippetsを事前にフィルターします。カテゴリを選び、必要に応じてそのカテゴリのタグを選択してください。カテゴリなし＝フィルターなし。",
      "snippetsNoAccess": "ターミナルSnippetsを読み込めませんでした（ターミナル権限が必要です）。",
      "snippetsNoTags": "このカテゴリにはタグがありません。"
    },
    "roleEditor": {
      "titleNew": "新規ロール",
      "titleEdit": "ロールを編集",
      "fieldName": "ロール名",
      "namePlaceholder": "例: コーディネーター、監査者、DBスペシャリスト",
      "fieldDesc": "説明",
      "descPlaceholder": "このロールが示す内容",
      "fieldBasePrompt": "ロールのベースプロンプト",
      "basePromptPlaceholder": "このロールを持つすべてのエージェントに共通するポリシー、責任、トーン…",
      "basePromptHint": "エージェント固有のプロンプトの前にベースとして注入されます。",
      "noToolLimit": "ロールによるツール制限なし",
      "toolsDesc": "ロールのツールは、そのエージェントが使用できる範囲を制限します（交差するため、拡張はされません）。",
      "supervisorLabel": "スーパーバイザー権限: このロールを持つエージェントは部下のチャットを作成できます",
      "supervisorDesc": "このロールを持つすべてのエージェントにスーパーバイザーとして動作する権限（チャットを開き作業を割り当てるツール）を付与します。",
      "createRole": "ロールを作成"
    },
    "treeView": {
      "title": "エージェント階層",
      "reloadTitle": "エージェントを再読み込みしてツリーを再生成",
      "regenerating": "再生成中…",
      "regenerate": "再生成",
      "description": "従属ツリー図（実線 = 上位 → 下位）およびピア間の接続（点線）。各エージェントの編集画面で「上位エージェント」を設定してツリーを構築します。"
    },
    "rolesList": {
      "newRole": "新規ロール",
      "description": "再利用可能なロール（ベースプロンプトとツールを含むプロフィール）を1つまたは複数のエージェントに割り当てます。",
      "emptyTitle": "ロールはまだありません",
      "emptyDesc": "複数のエージェントの動作を標準化するためにロールを作成します。",
      "agentsCount": "{count} エージェント"
    },
    "list": {
      "description": "カスタムAIエージェント: 独自プロンプト・ツール・プロバイダー/モデルを設定。チャットで使用したり、Cronでスケジュール実行できます。",
      "treeBtn": "ツリー",
      "treeBtnTitle": "エージェント階層ツリーを表示",
      "rolesBtn": "ロール",
      "rolesBtnTitle": "エージェントロールの作成と管理",
      "newAgent": "新規エージェント",
      "loading": "エージェントを読み込み中…",
      "emptyTitle": "エージェントがまだありません",
      "emptyDesc": "カスタムプロンプトとツールセットでチャットするエージェントを作成します。",
      "multiAgentTitle": "マルチエージェント: {count} コピー",
      "roleAssignedTitle": "割り当てられたロール",
      "subordinateTitle": "の部下",
      "connectionsTitle": "他のエージェントとの接続",
      "supervisorTitle": "スーパーバイザー: 部下のチャットを作成できます",
      "supervisorBadge": "スーパーバイザー",
      "realtimeTitle": "リアルタイム通信",
      "realtimeBadge": "リアルタイム",
      "startChat": "チャットを開始",
      "duplicateTitle": "複製",
      "noRoleGroupTitle": "ワークグループ未設定",
      "groupAria": "ワークグループ: {name}",
      "groupCount": "{count} エージェント",
      "noRoleGroupDesc": "ロール未割り当てのエージェント。エディターから割り当ててください。"
    },
    "resync": {
      "applying": "作成中…",
      "close": "閉じる",
      "btn": "テンプレートと同期",
      "btnTitle": "このチームをテンプレートと比較し、不足するエージェントを作成します",
      "modalTitle": "「{name}」をテンプレートと同期",
      "loading": "テンプレートと比較中…",
      "markersMissing": "このチームはテンプレート由来の識別情報を失ったため、自動比較できません。不足するエージェントを手動で作成できます。",
      "missingHeading": "不足",
      "presentHeading": "既存",
      "extraHeading": "手動で追加",
      "extraNote": "これらは変更されません。",
      "nothingMissing": "チームは完成しています。テンプレートのエージェントはすべて揃っています。",
      "confirm": "選択項目を作成"
    }
  },
  "accessTab": {
    "all": "すべて",
    "permissionsTitle": "アクセスと権限",
    "permissionsDescription": "現在、アシスタントの表示はプロフィールのassistantモジュール権限によって管理されています。ロール別の詳細（assistant.use / assistant.configure / assistant.module.<id>）は次のイテレーションで予定されています。",
    "recentInvocations": "最近のツール呼び出し",
    "refreshAriaLabel": "アクセスを更新",
    "loading": "読み込み中...",
    "emptyRecent": "最近のアクティビティはありません。",
    "emptyProvider": "このプロバイダーのアクティビティはありません。",
    "byUser": "ユーザー:",
    "crossServerTitle": "関連サーバーへのアクセス",
    "cmdPrefix": "$ ",
    "passwordLabel": "パスワード: ",
    "passphraseLabel": "パスフレーズ: ",
    "privateKeyLabel": "秘密鍵",
    "autoApproveRevoke": "取り消す",
    "autoApproveTitle": "自動承認",
    "autoApproveDescription": "確認を求めなくなったツール（「承認して次回から確認しない」で承認済み）。変更は次回の実行から適用されます。",
    "autoApproveEmpty": "自動承認されたツールはありません。エージェントの操作を承認するときに「承認して次回から確認しない」を選ぶと、ここに表示されます。",
    "autoApproveModeAuto": "自動モード：この一覧は適用されません"
  },
  "directoryPicker": {
    "title": "フォルダを選択",
    "goUp": "上へ",
    "loading": "読み込み中…",
    "emptyDirs": "（サブフォルダなし）",
    "cancel": "キャンセル",
    "select": "このフォルダを使用",
    "readError": "ディレクトリを読み取れませんでした"
  },
  "skillsSettings": {
    "title": "アシスタントのスキルとメソッド",
    "helper": "アシスタントの動作を調整するライブラリ、スキル、メソッドを有効または無効にします。",
    "tokenNote": "各スキルの指示はキャッシュされたプロンプトに含まれます（次のターン以降は約0.1×）。Ponytailはコードと出力トークンを削減します。UI/UX Pro Maxでは「簡潔」レベルを使うとトークン消費を抑えられます。",
    "search": "スキルを検索…",
    "allCategories": "すべてのカテゴリ",
    "loading": "スキルを読み込み中...",
    "empty": "利用可能なスキルがありません。",
    "noMatch": "フィルターに一致するスキルがありません。",
    "sourcePrefix": "ソース：",
    "errorGeneric": "スキルを更新できませんでした。再試行してください。",
    "activeShown": "{count}件有効 · {shown}件表示中。"
  },
  "skillsPicker": {
    "searchPlaceholder": "スキルを検索…",
    "resetTitle": "カスタマイズを削除（グローバルスキルを使用）",
    "reset": "リセット（{count}）",
    "loading": "スキルを読み込み中…",
    "empty": "スキルなし。",
    "globalNote": "プロバイダーのグローバルスキルに加え、自分のチャットにのみ適用されます。"
  },
  "skillCategories": {
    "methods": "アシスタントの手法",
    "code-quality": "コード品質",
    "web-quality": "Web品質（Lighthouse / CWV）",
    "ui-ux": "UI / UX / デザイン",
    "web-fullstack": "Web / フルスタック AI 開発",
    "mobile": "モバイルアプリ",
    "code-agents": "コードエージェント",
    "reusable-skills": "再利用可能な AI スキル",
    "security": "AI / Web / アプリセキュリティ",
    "token-savings": "トークン削減 / AI コスト",
    "ai-prod": "本番環境の AI エージェント",
    "devops": "DevOps / デプロイ",
    "testing": "テスト / コード品質",
    "data-rag": "データベース / RAG / 検索",
    "automation": "自動化 / ワークフロー",
    "other": "その他"
  },
  "skillCatalog": {
    "ask-protocol": {
      "name": "決定前に確認する",
      "description": "アシスタントが仮定せず、重要な意思決定の前に確認を求めるようにします（lxp_ask ツール + 質問プロトコル）。"
    },
    "project-context-vault": {
      "name": "プロジェクトコンテキスト（Obsidian）",
      "description": "プロジェクトコンテキストノート（Contexto.md / Errores.md）を注入し、obsidian.search_notes でさらに検索できます。"
    },
    "ponytail": {
      "name": "Ponytail（ミニマリストコード）",
      "description": "ミニマリスト開発モード：必要最小限のコードを書きます（決定ラダー + ガードレール）。"
    },
    "ui-ux-pro-max": {
      "name": "UI/UX Pro Max（インターフェース品質）",
      "description": "プロフェッショナルな UI/UX 基準（アクセシビリティ、タッチ、タイポグラフィ、状態）をプロンプトに注入します。簡易版または詳細版を選択できます。"
    },
    "openai-agents-sdk": {
      "name": "OpenAI Agents SDK",
      "description": "ツール、ハンドオフ、ガードレール、セッション、トレーシングを備えた OpenAI エージェント。"
    },
    "openai-agents-python": {
      "name": "OpenAI Agents Python SDK",
      "description": "エージェント向け Python SDK：Agent、Runner、@function_tool、ハンドオフ、トレーシング。"
    },
    "openai-agents-js": {
      "name": "OpenAI Agents JS SDK",
      "description": "OpenAI エージェント向け TypeScript/JS SDK：Agent、run、ツール（Zod）、ハンドオフ。"
    },
    "mcp-docs": {
      "name": "Model Context Protocol",
      "description": "LLM をツール、リソース、プロンプトに接続するオープン標準（AI の「USB-C」）。"
    },
    "mcp-github": {
      "name": "MCP（GitHub）",
      "description": "MCP GitHub org：公式 SDK（10 言語）、リファレンスサーバー、インスペクター。"
    },
    "anthropic-mcp-intro": {
      "name": "Anthropic MCP イントロ",
      "description": "N×M 統合問題を解決するオープン標準としての MCP に関する Anthropic のアナウンス。"
    },
    "n8n": {
      "name": "n8n",
      "description": "フェアコード、セルフホスト可能なワークフロー自動化。"
    },
    "make": {
      "name": "Make",
      "description": "シナリオによるビジュアルノーコード自動化（旧 Integromat）。"
    },
    "zapier": {
      "name": "Zapier",
      "description": "トリガーとアクション（Zap）による SaaS 自動化。"
    },
    "temporal": {
      "name": "Temporal",
      "description": "耐障害性のある永続ワークフローのオーケストレーション。"
    },
    "bullmq": {
      "name": "BullMQ",
      "description": "Node.js 向け Redis バックエンドのジョブキュー。"
    },
    "langgraph": {
      "name": "LangGraph",
      "description": "ステートフルグラフとして LLM エージェントをオーケストレーション。"
    },
    "codex-cli": {
      "name": "OpenAI Codex CLI",
      "description": "OpenAI の Codex CLI（ターミナルコードエージェント）を使用するようエージェントを誘導します。"
    },
    "codex-cli-features": {
      "name": "Codex CLI 機能",
      "description": "Codex CLI の機能（サンドボックス、承認、MCP、設定）についてエージェントに詳しく説明します。"
    },
    "codex-cloud": {
      "name": "Codex Cloud",
      "description": "タスクを Codex Cloud（リモート環境、並列実行、PR）に委譲するようエージェントを誘導します。"
    },
    "claude-code-skills": {
      "name": "Claude Code スキル",
      "description": "Claude Code スキル（SKILL.md を含むフォルダー、Agent Skills 標準）を作成・使用するようエージェントを誘導します。"
    },
    "copilot-cloud-agent": {
      "name": "GitHub Copilot クラウドエージェント",
      "description": "クラウドで動作して PR を開く GitHub Copilot コーディングエージェントにイシューを委譲するよう誘導します。"
    },
    "cursor": {
      "name": "Cursor",
      "description": "Cursor エディター（エージェント、リポジトリコンテキスト、ルール）で作業するようエージェントを誘導します。"
    },
    "agents-md": {
      "name": "AGENTS.md",
      "description": "コードエージェント向けの標準指示ファイルである AGENTS.md を書いて従うようエージェントを誘導します。"
    },
    "open-design-contribute": {
      "name": "Open Design — コントリビュート（ノーコード）",
      "description": "Open Design（nexu-io）へのノーコードコントリビュートガイド：スキルやデザインシステムの提出、ドキュメント翻訳、コピー修正、バグ報告を行い、PR / イシューを自動で開きます。"
    },
    "supabase": {
      "name": "Supabase",
      "description": "認証、ストレージ、リアルタイム機能を備えたマネージド Postgres バックエンド。"
    },
    "postgresql": {
      "name": "PostgreSQL",
      "description": "豊富な型を持つ堅牢なリレーショナルデータベース。"
    },
    "pgvector": {
      "name": "pgvector",
      "description": "Postgres 内のベクター類似検索。"
    },
    "pinecone": {
      "name": "Pinecone",
      "description": "スケールの RAG 向けマネージドベクターデータベース。"
    },
    "qdrant": {
      "name": "Qdrant",
      "description": "ペイロードフィルタリング付きオープンソースベクターエンジン。"
    },
    "weaviate": {
      "name": "Weaviate",
      "description": "スキーマとベクタライゼーションモジュールを備えたベクターデータベース。"
    },
    "github-actions": {
      "name": "GitHub Actions",
      "description": "イベントでトリガーされる YAML ワークフロー（.github/workflows）による GitHub CI/CD。"
    },
    "vercel": {
      "name": "Vercel",
      "description": "コミット / PR ごとのプレビューを備えたフロントエンドとサーバーレス関数のデプロイ。"
    },
    "docker": {
      "name": "Docker",
      "description": "軽量で再現可能なイメージによりアプリを一時的なコンテナにパッケージ化。"
    },
    "nginx": {
      "name": "Nginx",
      "description": "高性能 Web サーバーとリバースプロキシ。"
    },
    "pm2": {
      "name": "PM2",
      "description": "クラスター、再起動、ログ機能を備えた Node プロセスマネージャー。"
    },
    "redis": {
      "name": "Redis",
      "description": "キャッシュ、キュー、データ構造向けのインメモリストア。"
    },
    "expo": {
      "name": "Expo",
      "description": "Expo（expo-router、モジュール、設定プラグイン）で React Native アプリを開発するようエージェントを誘導します。"
    },
    "eas-build": {
      "name": "EAS Build",
      "description": "EAS Build と eas.json プロファイルでクラウド上に iOS/Android バイナリをビルドするようエージェントを誘導します。"
    },
    "eas-services": {
      "name": "EAS サービス",
      "description": "EAS エコシステム（Submit、Update/OTA、Workflows）をエンドツーエンドで使用するようエージェントを支援します。"
    },
    "react-native": {
      "name": "React Native",
      "description": "React Native（コアコンポーネント、スタイル、プラットフォーム）でネイティブ UI を構築するようエージェントを誘導します。"
    },
    "firebase-auth": {
      "name": "Firebase Auth",
      "description": "Firebase Auth（プロバイダー、トークン、セッション）で認証を実装するようエージェントを誘導します。"
    },
    "claude-agent-skills": {
      "name": "Claude エージェントスキル",
      "description": "再利用可能な機能をオンデマンドで読み込まれる Agent スキル（SKILL.md）としてパッケージ化します。"
    },
    "claude-skills-github": {
      "name": "Claude スキル（GitHub）",
      "description": "公式 anthropics/skills リポジトリ：ベースとパターンとしてのサンプル、仕様、テンプレート。"
    },
    "codex-agents-md-guide": {
      "name": "Codex AGENTS.md ガイド",
      "description": "コードエージェントにプロジェクト指示を与えるための Codex の AGENTS.md 規約。"
    },
    "owasp-llm-top10": {
      "name": "OWASP Top 10 LLM",
      "description": "LLM アプリの上位 10 リスク：プロンプトインジェクション、安全でない出力、過度な権限委譲。"
    },
    "owasp-asvs": {
      "name": "OWASP ASVS",
      "description": "ASVS v5.0：レベル別の検証可能なセキュリティ要件の標準。"
    },
    "codeql": {
      "name": "CodeQL",
      "description": "CodeQL：コードをデータとしてクエリ（データフロー / テイント）して脆弱性を発見。"
    },
    "semgrep": {
      "name": "Semgrep",
      "description": "Semgrep：コードライクなルールの SAST + サプライチェーン（SCA）とシークレット、高シグナル。"
    },
    "snyk": {
      "name": "Snyk",
      "description": "Snyk：SCA、コード（SAST）、コンテナ、IaC、API / Web（DAST）とガイド付き修正。"
    },
    "owasp-zap": {
      "name": "OWASP ZAP",
      "description": "OWASP ZAP：DAST（パッシブ / アクティブスキャン）向け主要オープンソース Web スキャナー。"
    },
    "skillspector": {
      "name": "SkillSpector（AI スキル監査）",
      "description": "インストール前に AI エージェントスキル（SKILL.md + スクリプト）の脆弱性と悪意の有無を監査します（NVIDIA、Apache-2.0）。"
    },
    "playwright": {
      "name": "Playwright",
      "description": "自動待機とトレース機能を備えたクロスブラウザ E2E テスト。"
    },
    "cypress": {
      "name": "Cypress",
      "description": "リトライ付きブラウザでのコンポーネントおよび E2E テスト。"
    },
    "vitest": {
      "name": "Vitest",
      "description": "Vite/ESM ネイティブの高速テストランナー。"
    },
    "jest": {
      "name": "Jest",
      "description": "組み込みモックとスナップショットを備えたテストフレームワーク。"
    },
    "testing-library": {
      "name": "Testing Library",
      "description": "アクセシブルな UI をテストするためのユーザー中心クエリ。"
    },
    "storybook": {
      "name": "Storybook",
      "description": "UI コンポーネントの独立した開発とテスト。"
    },
    "openai-prompt-caching": {
      "name": "OpenAI プロンプトキャッシング",
      "description": "OpenAI でキャッシュされたプロンプトプレフィックスを再利用してコストを自動削減。"
    },
    "openai-prompt-engineering": {
      "name": "OpenAI プロンプトエンジニアリング",
      "description": "反復回数とトークン数を減らすための正確なプロンプトを書く。"
    },
    "gemini-context-caching": {
      "name": "Gemini コンテキストキャッシング",
      "description": "Gemini で繰り返し使用される大きなコンテキストをキャッシュ（明示的または暗黙的）して入力コストを削減。"
    },
    "gemini-caching-api": {
      "name": "Gemini キャッシング API",
      "description": "Gemini cachedContents API：キャッシュの作成、再利用、TTL 更新、削除。"
    },
    "litellm-cost-tracking": {
      "name": "LiteLLM コスト追跡",
      "description": "LiteLLM プロキシでキー / ユーザー / チームごとのコストを測定・属性付け。"
    },
    "litellm": {
      "name": "LiteLLM",
      "description": "キャッシュ、フォールバック、ルーティングを備えた 100 以上の LLM（OpenAI 形式）への統合ゲートウェイ。"
    },
    "figma-ai": {
      "name": "Figma AI",
      "description": "Figma AI：キャンバスエージェント、画像生成、デザインからコードへの変換。"
    },
    "figma-make": {
      "name": "Figma Make",
      "description": "Figma Make：プロンプトまたはフレームから実際のコードを使った機能的なプロトタイプ / アプリへ。"
    },
    "figma-ai-tools": {
      "name": "Figma AI ツール",
      "description": "Figma Design の AI ツール：First Draft、レイヤー名変更、画像、テキスト。"
    },
    "framer": {
      "name": "Framer",
      "description": "Framer：ビジュアルキャンバス、AI エージェント、CMS、パブリッシングを備えたノーコードサイト。"
    },
    "relume": {
      "name": "Relume",
      "description": "Relume：AI とライブラリを使って概要からサイトマップ、ワイヤーフレーム、スタイルガイドへ。"
    },
    "design-md-tokens": {
      "name": "DESIGN.md（トークンベースシステム）",
      "description": "構造化された DESIGN.md でブランドに忠実な UI を生成：カラー / タイポグラフィ / スペーシングトークン、コンポーネント仕様、Do / Don't ルール（voltagent、MIT）。"
    },
    "nextjs-app-router": {
      "name": "Next.js App Router",
      "description": "App Router（サーバーコンポーネント、ルートハンドラー、レイアウト）で Next.js アプリを構築するようエージェントを誘導します。"
    },
    "vercel-ai-sdk": {
      "name": "Vercel AI SDK",
      "description": "AI SDK（generateText、streamText、ツール、構造化出力）で LLM を統合するようエージェントを支援します。"
    },
    "vercel-ai-gateway": {
      "name": "Vercel AI Gateway",
      "description": "AI Gateway（単一エンドポイント、フォールバック、オブザーバビリティ）を通じて複数モデルにリクエストをルーティングするようエージェントを誘導します。"
    },
    "openai-sdk-cli": {
      "name": "OpenAI SDK と CLI",
      "description": "OpenAI の公式 SDK（Python/Node）を慣用的に使用するようエージェントを誘導します。"
    },
    "v0-vercel": {
      "name": "v0 by Vercel",
      "description": "プロンプトから v0 を使って React/Tailwind/shadcn UI を生成・改善するようエージェントを支援します。"
    },
    "web-quality-audit": {
      "name": "Web 品質監査",
      "description": "包括的な Web 品質監査（パフォーマンス、アクセシビリティ、SEO、セキュリティ）と重大度分類。"
    },
    "web-performance": {
      "name": "Web パフォーマンス",
      "description": "ロード速度とランタイム効率を最適化（リソースバジェット + Lighthouse）。"
    },
    "core-web-vitals": {
      "name": "Core Web Vitals（LCP/INP/CLS）",
      "description": "LCP、INP、CLS を改善します（75 パーセンタイルのしきい値）。"
    },
    "web-accessibility": {
      "name": "Web アクセシビリティ（WCAG 2.2）",
      "description": "WCAG 2.2 に基づくアクセシビリティの監査と改善（AA 準拠を目標）。"
    },
    "web-seo": {
      "name": "SEO（テクニカル + オンページ）",
      "description": "検索エンジンの可視性を最適化：テクニカル SEO、オンページ、構造化データ。"
    },
    "web-best-practices": {
      "name": "Web ベストプラクティス（セキュリティ）",
      "description": "セキュリティ、互換性、コード品質のためのモダンなパターン。"
    }
  }
} as const;

export default assistantPart2;
