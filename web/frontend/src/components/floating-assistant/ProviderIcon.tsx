// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import type { AssistantProviderId } from "./assistant-api";
import { PROVIDER_ICON_SVGS } from "./provider-icons.generated";

/**
 * Brand logo for an assistant provider — offline inline SVG (same approach as
 * the files module's icons). The SVG uses `fill="currentColor"`, so it inherits
 * the surrounding text color (e.g. the provider's accent). Sized via `font-size`
 * on the wrapping span.
 */
export function ProviderIcon({
  id,
  className,
}: {
  id: AssistantProviderId;
  className?: string;
}) {
  const svg = PROVIDER_ICON_SVGS[id];
  return (
    <span
      className={className}
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
