import type { JobsMessages } from "./es";

export const ja: JobsMessages = {
  section: "案件",
  title: "案件",
  subtitle: "トークンエスクロー付きのソフトウェア依頼",

  tab: {
    buyer: "自分の依頼",
    professional: "自分への割り当て",
    profile: "自分の専門家プロフィール",
  },

  status: {
    draft: "下書き",
    published: "公開済み",
    assigned: "割り当て済み",
    in_progress: "進行中",
    disputed: "係争中",
    released: "支払い済み",
    cancelled: "キャンセル済み",
  },

  field: {
    title: "タイトル",
    description: "説明",
    price: "価格（トークン）",
    deadline: "締め切り",
    deliverables: "成果物",
    country: "国",
    language: "言語",
    workType: "作業形態",
  },

  workType: {
    fixed: "固定価格",
    hourly: "時間単価",
  },

  action: {
    publish: "公開して資金を預託",
    offer: "専門家に提案",
    release: "支払いを実行",
    delete: "削除",
    accept: "承諾",
    reject: "拒否",
    detail: "詳細",
  },

  confirm: {
    publish: "{price} トークンがエスクローに預託されます。続行しますか？",
    release: "専門家に90%が支払われます。確認しますか？",
    delete: "95%が返金されます（手数料5%）。削除しますか？",
  },

  toast: {
    created: "依頼を作成しました",
    published: "依頼を公開し資金を預託しました",
    released: "支払いを実行しました",
    deleted: "依頼を削除しました",
    accepted: "提案を承諾しました",
    rejected: "提案を拒否しました",
  },

  empty: {
    buyer: "まだ依頼がありません",
    professional: "割り当てられた案件がありません",
  },

  error: {
    generic: "エラーが発生しました",
    insufficientTokens: "トークン残高が不足しています",
    notCancellable: "進行中の案件は削除できません",
    offerActive: "有効な提案がすでに存在します",
  },

  ai: {
    moderatePlan: "審査して計画",
    plan: "作業計画",
    translate: "自分の言語に翻訳",
    mustModerate: "公開する前に審査が必要です",
    notModerated: "依頼は審査を通過しませんでした",
    noBalance: "AIを利用するためのデータ残高がありません",
    unavailable: "AIアシスタントは利用できません",
    estimate: "見積もり（トークン）",
    professionalShare: "専門家（90%）",
    platformShare: "プラットフォーム（10%）",
    milestones: "マイルストーン",
    risks: "リスク",
    questions: "補足すべき質問",
    missing: "不足している項目",
    draftPlaceholder: "必要な内容を記述してください…",
    assist: "AIで支援",
    moderation: {
      apto: "承認済み",
      spam: "スパム",
      malicioso: "悪質",
      adulto: "アダルトコンテンツ",
      "no-software": "ソフトウェアではない",
      approved: "承認済み",
    },
    toast: {
      moderated: "依頼を審査しました",
      planned: "計画を生成しました",
      translated: "翻訳が完了しました",
    },
  },

  prof: {
    score: "適合度",
    busyCount: "対応中：{n}",
    search: {
      empty: "そのメールアドレスの専門家は見つかりませんでした",
    },
  },

  profile: {
    enroll: "専門家プロフィールを有効化",
    save: "プロフィールを保存",
    saved: "プロフィールを保存しました",
    displayName: "表示名",
    headline: "見出し",
    bio: "自己紹介",
    cvUrl: "履歴書のURL",
    country: "国",
    skills: "スキル",
    languages: "言語",
    links: "ポートフォリオのリンク",
    availability: "対応状況",
    rating: "評価",
    activeJobs: "進行中の案件",
    avail: {
      available: "対応可能",
      busy: "対応中",
      away: "離席中",
    },
  },

  offer: {
    sendMany: "{n} 名の専門家に提案を送信",
    sent: {
      summary: "{sent} 件の提案を送信、{skipped} 件をスキップ",
    },
    none: {
      selected: "専門家を1名以上選択してください",
    },
    searchPlaceholder: "メールで専門家を検索",
    message: "メッセージ（任意）",
    onlyAvailable: "対応可能な人のみ",
  },

  channel: {
    title: "進捗管理",
    empty: "この依頼にはまだメッセージがありません。",
    loadMore: "以前の分を読み込む",
    sendError: "メッセージを送信できませんでした。",
    notAssignedYet: "専門家が割り当てられるとチャンネルが開きます。",
    attachTooLarge: "ファイルが許容サイズを超えています。",
    systemRevoked: "共有アクセスが取り消されました",
    input: "メッセージを入力…",
    send: "送信",
    attach: "添付",
  },

  grants: {
    empty: "共有しているアクセスはありません。",
    share: "アクセスを共有",
    shareError: "アクセスを共有できませんでした。",
    revoke: "取り消す",
    revokeError: "アクセスを取り消せませんでした。",
    revoked: "取り消し済み",
    refLabel: "参照（id / リンク / メモ）",
    keyForbidden:
      "鍵情報は共有できません。代わりにリソースの参照（id）を共有してください。",
    label: "ラベル",
    type: {
      server: "サーバー",
      ssh_key: "SSH鍵",
      group: "グループ",
      link: "リンク",
      note: "メモ",
    },
  },

  progress: {
    title: "作業の進捗",
    meets100: "100%達成",
    inProgress: "進行中",
    report: "進捗レポート",
    review: "進捗を確認（AI）",
    toast: {
      done: "進捗を確認しました",
    },
  },

  milestone: {
    title: "50%マイルストーン",
    request: "50%を申請",
    requested: "50%を申請済み",
    approve: "50%を承認",
    approved: "50%を支払い済み",
    note: "メモ（任意）",
    split: "専門家 {dev} · プラットフォーム {fee}",
    toast: {
      requested: "マイルストーンを申請しました",
      approved: "専門家に50%を支払いました",
    },
  },

  edit: {
    title: "依頼を編集",
    save: "変更を保存",
    propose: "変更を提案",
    accept: "変更を承諾",
    reject: "変更を拒否",
    pending: "提案された変更",
    topup: "追加費用（トークン）",
    topupWarn: "これらの変更を承諾すると、追加で {n} トークンが預託されます。",
    remoderate: "タイトルや説明の編集には再審査が必要です。",
    toast: {
      saved: "依頼を更新しました",
      proposed: "専門家に変更を提案しました",
      accepted: "変更を承諾しました",
      rejected: "変更を拒否しました",
    },
  },

  dispute: {
    title: "係争 / 返金",
    badge: "係争中",
    open: "係争を開始",
    request: "返金を申請",
    reason: "係争の理由",
    notEligible: "まだ係争を申し立てられません（期間の30%が経過する必要があります）。",
    refundPct: "返金する割合",
    refundPartial: "一部返金",
    refundFull: "全額返金",
    continue: "作業を続行",
    toast: {
      requested: "係争を開始しました",
      resolved: "係争を解決しました",
    },
  },

  rating: {
    title: "専門家を評価",
    submit: "評価を送信",
    comment: "コメント（任意）",
    done: "この案件はすでに評価済みです",
    toast: {
      done: "評価いただきありがとうございます",
    },
  },

  test: {
    require: "技術テストを必須にする",
    generate: "テストを生成（AI）",
    ready: "テスト準備完了 · {n}問",
    aiUnavailable: "テストを生成するAIが利用できません",
    required: "テストが必要",
    present: "テストを受ける",
    passed: "合格",
    failed: "不合格",
    passedBadge: "テスト ✓",
    noTestBadge: "テストなし",
    acceptLocked: "受諾するにはテストに合格する必要があります",
    oneAttempt: "受験は1回のみで制限時間があります。今すぐテストを開始しますか？",
    attemptExists: "このテストはすでに受験済みです（1回のみ）",
    gateRequired: "この要件には技術テストの合格が必要です",
    notGenerated: "テストはまだ生成されていません",
    invalid: "テストが無効です。購入者が再生成する必要があります",
    questionOf: "全12問中 {n}問目",
    autoAdvance: "自動で進む：1問10秒、戻れません",
    next: "次へ",
    submit: "回答を送信",
    result: {
      passed: "合格！これで案件を受諾できます。",
      failed: "不合格。スコア：{score}/12。",
      timedOut: "テストの時間が切れました。",
    },
    toast: {
      required: "テスト設定を更新しました",
      generated: "テストを生成しました",
    },
  },
};
