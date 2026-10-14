import type { AccountProvider } from "../../storage/savedAccounts";
import { GoogleIcon, AppleIcon, GithubIcon, MicrosoftIcon } from "./icons";
import styles from "./ProviderBadge.module.css";

/**
 * Small brand badge for the identity provider an account signed in with, shown
 * to the left of its avatar in the account selector (and as the icon-only
 * "add account" buttons). Email-based methods (passkey/recovery) and unknown
 * providers render an invisible spacer so every avatar stays aligned.
 */
export function ProviderBadge({ provider, size = 18 }: { provider?: AccountProvider | null; size?: number }) {
  if (!provider || provider === "passkey" || provider === "recovery") {
    return (
      <span
        className={styles.spacer}
        style={{ "--badge-size": `${size}px` } as React.CSSProperties}
        aria-hidden="true"
      />
    );
  }
  const bg =
    provider === "apple"
      ? "bg-black text-white"
      : provider === "github"
        ? "bg-[#24292f] text-white"
        : "bg-white"; // google & microsoft keep their colored marks on white
  const icon = Math.round(size * 0.6);
  return (
    <span
      className={`${styles.badge} ring-1 ring-base-300/70 ${bg}`}
      style={{ "--badge-size": `${size}px` } as React.CSSProperties}
      aria-hidden="true"
    >
      <span
        className={`${styles.icon} [&>svg]:h-full [&>svg]:w-full`}
        style={{ "--icon-size": `${icon}px` } as React.CSSProperties}
      >
        {provider === "google" ? <GoogleIcon /> : null}
        {provider === "apple" ? <AppleIcon /> : null}
        {provider === "github" ? <GithubIcon /> : null}
        {provider === "microsoft" ? <MicrosoftIcon /> : null}
      </span>
    </span>
  );
}
