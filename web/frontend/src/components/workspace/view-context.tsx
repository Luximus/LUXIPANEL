// SPDX-License-Identifier: AGPL-3.0-only
import {
  Fragment as ReactFragment,
  createElement,
  Children,
  createContext,
  isValidElement,
  useContext,
  type ReactNode,
} from "react";
import type { SessionUser } from "@/lib/auth";
import type { ControllerScope } from "./controller-scope";
import type { LocaleCode } from "@/i18n/config";
import { initialsFrom } from "@/lib/format";
export type ViewContext = {
  databasePrefix?: string;
  user: SessionUser;
  locale: LocaleCode;
  messages: Record<string, any>;
  url: URL;
  params: Record<string, string>;
  scope: ControllerScope;
  forView: (props: any, slots: Record<string, ReactNode>) => any;
};
export const InternalViewContext = createContext<ViewContext | null>(null);
export function useViewContext() {
  const context = useContext(InternalViewContext);
  if (!context) throw new Error("Internal module context missing");
  return context;
}
export function createViewContext(
  options: Omit<ViewContext, "forView">,
): ViewContext {
  return {
    ...options,
    forView(props, slots) {
      return {
        props,
        url: options.url,
        params: options.params,
        locals: { user: options.user },
        request: { __viewContext: options },
        response: { headers: new Headers() },
        slots: {
          has: (name: string) => Boolean(slots[name]),
          render: (name: string) => slots[name],
        },
        redirect: (url: string) => {
          throw new Error(`Module access denied (${url})`);
        },
      };
    },
  };
}
export function splitSlots(children: ReactNode): Record<string, ReactNode> {
  const slots: Record<string, ReactNode[]> = { default: [] };
  Children.forEach(children, (child) => {
    const name =
      isValidElement<{ slot?: string }>(child) && child.props.slot
        ? child.props.slot
        : "default";
    (slots[name] ??= []).push(child);
  });
  return slots;
}
export function classList(input: unknown): string {
  if (Array.isArray(input))
    return input.map(classList).filter(Boolean).join(" ");
  if (input && typeof input === "object")
    return Object.entries(input)
      .filter(([, value]) => value)
      .map(([key]) => key)
      .join(" ");
  return typeof input === "string" ? input : "";
}
export function getPageLocale(view: any) {
  return view.request.__viewContext.locale;
}
export function getPageMessages(view: any, _namespaces?: readonly string[]) {
  return view.request.__viewContext.messages;
}
export function localeFromRequest(request: any) {
  return request.__viewContext.locale;
}
// Components run synchronously after the registry has loaded their namespaces.
export function getMessages(
  _locale: LocaleCode,
  _namespaces?: readonly string[],
) {
  return useViewContext().messages;
}
export function getSession(request: any) {
  return request.__viewContext.user;
}
export function isAdmin(user: SessionUser) {
  return user.kind === "admin";
}
export function isExternalGuest(user: SessionUser) {
  return user.kind === "external-guest";
}
export function hasAction(user: SessionUser, action: string) {
  if (isAdmin(user)) return true;
  const actions = user.permissions?.actions || [];
  return (
    actions.includes("*") ||
    actions.includes(action) ||
    actions.includes(`${action.split(".")[0]}.*`)
  );
}
export function canSeeSidebar(user: SessionUser, item: string) {
  return (
    isAdmin(user) ||
    Boolean(
      user.permissions?.sidebar.some(
        (value) => value === item || value === "*",
      ),
    )
  );
}
export function getInitials(user: SessionUser) {
  return initialsFrom(user.displayName || user.username, { empty: "" });
}
export function moduleAccessRedirect(view: any, moduleId: string) {
  const user = view.locals.user;
  return !user || (!isAdmin(user) && !user.modules.includes(moduleId))
    ? view.redirect("/")
    : null;
}
export function adminRedirect(view: any) {
  return !view.locals.user || !isAdmin(view.locals.user)
    ? view.redirect("/")
    : null;
}

export function cssStyle(input: string): Record<string, string> {
  return Object.fromEntries(
    input
      .split(";")
      .map((item) => item.split(/:(.*)/s).slice(0, 2))
      .filter(([key, value]) => key && value)
      .map(([key, value]) => [
        key.trim().replace(/-([a-z])/g, (_all, char) => char.toUpperCase()),
        value.trim(),
      ]),
  );
}

export type Messages = Record<string, any>;
export function SlotFragment({children}: {children?: ReactNode; slot?: string}) { return createElement(ReactFragment, null, children); }
