import { useState, type DragEvent, type ReactNode } from "react";
import { Trash2, GripVertical, ChevronDown, ChevronUp, Plus } from "lucide-react";
import type { AccountProvider, SavedAccount } from "../storage/savedAccounts";
import { getMessages } from "../i18n";
import { ProviderBadge } from "./ui/ProviderBadge";
import { Tooltip } from "./ui/Tooltip";

function getInitials(account: SavedAccount): string {
  const source = account.displayName || account.email || "?";
  const parts = source.split(/[\s._-]+/g).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function AccountAvatar({ account, size = "md" }: { account: SavedAccount; size?: "sm" | "md" }) {
  const dim = size === "sm" ? "w-8" : "w-10";
  if (account.photoURL) {
    return (
      <div className={`avatar`}>
        <div className={`${dim} rounded-full ring ring-base-100 ring-offset-0`}>
          <img src={account.photoURL} alt={account.email} referrerPolicy="no-referrer" />
        </div>
      </div>
    );
  }
  return (
    <div className="avatar avatar-placeholder">
      <div className={`${dim} rounded-full bg-primary text-primary-content ring ring-base-100 ring-offset-0`}>
        <span className="text-xs font-bold">{getInitials(account)}</span>
      </div>
    </div>
  );
}

export function LoginAccountsList({
  accounts,
  loading,
  language,
  className,
  onSelect,
  onRemove,
  onReorder,
  addProviders,
  onAddProvider,
  trailing,
}: {
  accounts: SavedAccount[];
  loading: boolean;
  language?: string;
  className?: string;
  onSelect: (account: SavedAccount) => void;
  onRemove: (email: string) => void;
  onReorder: (emailsInOrder: string[]) => void;
  /** "Add account" buttons rendered inside the selector, one per provider. */
  addProviders?: AccountProvider[];
  onAddProvider?: (provider: AccountProvider) => void;
  /** Optional element rendered at the end of the trigger row (e.g. language switcher). */
  trailing?: ReactNode;
}) {
  const t = getMessages(language);
  const hasAccounts = accounts.length > 0;
  const providers = addProviders ?? [];
  const canAdd = providers.length > 0 && !!onAddProvider;
  const [expanded, setExpanded] = useState(false);
  const [dragEmail, setDragEmail] = useState<string | null>(null);
  const [overEmail, setOverEmail] = useState<string | null>(null);

  if (!hasAccounts && !canAdd && !trailing) return null;

  const addLabel = (provider: AccountProvider): string => {
    switch (provider) {
      case "apple": return t.login.appleAddAccount;
      case "github": return t.login.githubAddAccount;
      case "microsoft": return t.login.microsoftAddAccount;
      default: return t.login.googleAddAccount;
    }
  };

  const previewAccounts = accounts.slice(0, 4);
  const extraCount = Math.max(0, accounts.length - previewAccounts.length);

  function onDragStart(event: DragEvent<HTMLLIElement>, email: string) {
    setDragEmail(email);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", email);
  }

  function onDragOver(event: DragEvent<HTMLLIElement>, email: string) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    if (overEmail !== email) setOverEmail(email);
  }

  function onDragLeave(_event: DragEvent<HTMLLIElement>, email: string) {
    if (overEmail === email) setOverEmail(null);
  }

  function onDrop(event: DragEvent<HTMLLIElement>, targetEmail: string) {
    event.preventDefault();
    const sourceEmail = dragEmail || event.dataTransfer.getData("text/plain");
    setDragEmail(null);
    setOverEmail(null);
    if (!sourceEmail || sourceEmail === targetEmail) return;
    const order = accounts.map((entry) => entry.email);
    const fromIdx = order.indexOf(sourceEmail);
    const toIdx = order.indexOf(targetEmail);
    if (fromIdx < 0 || toIdx < 0) return;
    order.splice(fromIdx, 1);
    order.splice(toIdx, 0, sourceEmail);
    onReorder(order);
  }

  function onDragEnd() {
    setDragEmail(null);
    setOverEmail(null);
  }

  return (
    <div className={className ?? "w-full"}>
      <div className="flex items-stretch gap-2">
        <button
          type="button"
          className="flex h-14 min-w-0 flex-1 items-center justify-between gap-3 rounded-xl border border-base-300/60 bg-base-100/70 px-4 shadow-xs transition hover:border-primary/40 hover:bg-base-100"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          disabled={loading}
        >
          <div className="flex items-center gap-3">
            {hasAccounts ? (
              <div className="avatar-group -space-x-3">
                {previewAccounts.map((account) => (
                  <AccountAvatar key={account.email} account={account} size="sm" />
                ))}
                {extraCount > 0 ? (
                  <div className="avatar avatar-placeholder">
                    <div className="w-8 rounded-full bg-base-300 text-base-content ring ring-base-100 ring-offset-0">
                      <span className="text-xs font-bold">+{extraCount}</span>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-content">
                <Plus size={18} />
              </span>
            )}
            <div className="flex flex-col items-start">
              <span className="text-sm font-semibold">{hasAccounts ? t.login.savedAccounts : t.login.addAccount}</span>
              {hasAccounts ? (
                <span className="text-xs opacity-70">
                  {accounts.length} {accounts.length === 1 ? t.login.accountsAvailableOne : t.login.accountsAvailableMany}
                </span>
              ) : null}
            </div>
          </div>
          {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>
        {trailing}
      </div>

      {expanded ? (
        <div className="mt-2 overflow-hidden rounded-xl border border-base-300/70 bg-base-100 shadow-xs">
          {canAdd ? (
            <div className="flex items-center justify-center gap-3 border-b border-base-300/60 px-3 py-3">
              {providers.map((provider) => (
                <Tooltip key={provider} tip={addLabel(provider)} position="bottom">
                  <button
                    type="button"
                    className="flex h-11 w-11 items-center justify-center rounded-full border border-base-300/70 bg-base-100 transition hover:-translate-y-px hover:border-primary/40 hover:bg-base-200 disabled:cursor-not-allowed disabled:opacity-50"
                    onClick={() => onAddProvider?.(provider)}
                    disabled={loading}
                    aria-label={addLabel(provider)}
                  >
                    <ProviderBadge provider={provider} size={26} />
                  </button>
                </Tooltip>
              ))}
            </div>
          ) : null}
          <ul className="flex flex-col divide-y divide-base-300/60">
            {accounts.map((account) => {
              const isDragging = dragEmail === account.email;
              const isOver = overEmail === account.email && dragEmail && dragEmail !== account.email;
              return (
                <li
                  key={account.email}
                  className={`flex items-center gap-3 px-3 py-2 transition ${
                    isDragging ? "opacity-40" : ""
                  } ${isOver ? "bg-primary/5 ring-1 ring-inset ring-primary/40" : "hover:bg-base-200/60"}`}
                  draggable
                  onDragStart={(event) => onDragStart(event, account.email)}
                  onDragOver={(event) => onDragOver(event, account.email)}
                  onDragLeave={(event) => onDragLeave(event, account.email)}
                  onDrop={(event) => onDrop(event, account.email)}
                  onDragEnd={onDragEnd}
                >
                  <span
                    className="flex h-6 w-4 shrink-0 cursor-grab items-center justify-center text-base-content/40"
                    aria-hidden="true"
                  >
                    <GripVertical size={16} />
                  </span>
                  <ProviderBadge provider={account.provider} />
                  <AccountAvatar account={account} />
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-start transition hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
                    onClick={() => onSelect(account)}
                    disabled={loading}
                  >
                    <div className="truncate text-sm font-semibold">
                      {account.displayName || account.email.split("@")[0]}
                    </div>
                    <div className="truncate text-xs opacity-70">{account.email}</div>
                  </button>
                  <button
                    type="button"
                    className="lp-icon-btn is-danger tooltip tooltip-left"
                    onClick={() => onRemove(account.email)}
                    data-tip={t.login.removeAccountTitle}
                    aria-label={t.login.removeAccountAria}
                    disabled={loading}
                  >
                    <Trash2 size={15} />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
