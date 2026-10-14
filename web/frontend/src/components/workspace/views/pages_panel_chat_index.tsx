// SPDX-License-Identifier: AGPL-3.0-only
// Internal component migrated from src/pages/panel/chat/index.astro.
import { SlotFragment as Fragment } from "../view-context";
import {
  useViewContext,
  splitSlots,
  classList,
  cssStyle,
} from "../view-context";

// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * /panel/chat — internal user-to-user chat screen.
 *
 * Reuses the AI assistant's chat UI/UX (conversation list + thread + composer)
 * via the `messenger` component set, backed by the per-server chat API. Opened
 * directly from the topbar messaging link or from a conversation deep link.
 */
import PanelLayout from "../module-frame";
import ChatModule from "@/components/messenger/ChatModule";
import { getPageLocale, getPageMessages } from "../view-context";
export default function pages_panel_chat_index(props: any) {
  const context = useViewContext();
  const slots = splitSlots(props.children);
  const Astro = context.forView(props, slots);
  const document = context.scope.document;
  const window = context.scope.window;
  const locale = getPageLocale(Astro);
  const t = getPageMessages(Astro, ["chat"]);
  const user = Astro.locals.user;
  const initialConvId = Astro.url.searchParams.get("c");
  const initialTo = Astro.url.searchParams.get("to");
  const openNew = Astro.url.searchParams.get("new") === "1";
  // Bloque E — deep-link del drawer de ajustes: `?settings=<sección>`.
  const settingsSection = Astro.url.searchParams.get("settings");
  // Bloque F — deep-link de llamada: `?call=<callId>` (el banner de la topbar
  // manda aquí al aceptar). La isla se une a esa llamada al montar.
  const initialCallId = Astro.url.searchParams.get("call");

  return (
    <Fragment>
      <PanelLayout title={t.chat.pageTitle} activeModule="chat" flush>
        <div className="flex h-full min-h-0 flex-col">
          <ChatModule
            locale={locale}
            me={user?.username ?? ""}
            messages={t.chat}
            initialConvId={initialConvId}
            initialTo={initialTo}
            openNew={openNew}
            initialSettingsSection={settingsSection}
            initialCallId={initialCallId}
            isAdmin={user?.kind === "admin"}
          />
        </div>
      </PanelLayout>
    </Fragment>
  );
}
