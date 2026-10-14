import { useState } from "react";
import styles from "./Avatar.module.css";

export function getInitials(name?: string | null, email?: string | null): string {
  const source = (name || email || "").trim();
  if (!source) return "?";
  const parts = source.split(/[\s._-]+/g).filter(Boolean);
  if (parts.length === 0) return source.charAt(0).toUpperCase();
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function UserAvatar({
  src,
  name,
  email,
  size = 32,
  className = "",
  altFallback = "Avatar",
}: {
  src?: string | null;
  name?: string | null;
  email?: string | null;
  size?: number;
  className?: string;
  altFallback?: string;
}) {
  const [failed, setFailed] = useState(false);
  const showPhoto = Boolean(src) && !failed;
  const initials = getInitials(name, email);

  return (
    <span
      className={`lxp-avatar ${styles.avatar} ${className}`}
      style={{ ["--avatar-size" as string]: `${size}px` }}
    >
      {showPhoto ? (
        <img
          src={src ?? undefined}
          alt={name ?? email ?? altFallback}
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className="lxp-avatar__img"
        />
      ) : null}
      <span
        className={`lxp-avatar__fallback ${styles.fallback}`}
        style={{ ["--avatar-font-size" as string]: `${Math.round(size * 0.36)}px` }}
      >
        {initials}
      </span>
    </span>
  );
}
