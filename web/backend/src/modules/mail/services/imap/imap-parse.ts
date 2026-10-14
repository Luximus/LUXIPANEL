// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * IMAP parsing/normalization helpers — pure functions that turn IMAPFlow
 * envelopes / mailparser output into the compact shapes the API returns, plus
 * the SPF/DKIM/DMARC verdict derivation and small UID/date utilities shared by
 * the fetch/folder/bulk sub-services.
 */

import type {
  MessageAddressObject,
  MessageEnvelopeObject,
  MessageStructureObject,
} from "imapflow";
import type {
  MailAddress,
  MailAuthResults,
  ParsedAddressObjectLike,
  ParsedHeaderLine,
  ParsedMailLike,
} from "./imap.types.js";

let simpleParserFn: ((source: string | Buffer) => Promise<ParsedMailLike>) | null = null;

export function normalizeEnvelopeAddress(address: MessageAddressObject | undefined): MailAddress | null {
  if (!address) return null;
  const value = (address.address || "").trim();
  if (!value) return null;
  const name = (address.name || "").trim();
  return name ? { name, address: value } : { address: value };
}

export function normalizeEnvelopeAddressList(addresses: MessageAddressObject[] | undefined): MailAddress[] | null {
  if (!Array.isArray(addresses) || addresses.length === 0) return null;
  const out = addresses
    .map((item) => normalizeEnvelopeAddress(item))
    .filter((item): item is MailAddress => Boolean(item));
  return out.length ? out : null;
}

export function normalizeParsedAddressList(addresses: ParsedAddressObjectLike | null | undefined): MailAddress[] | null {
  if (!addresses?.value || !Array.isArray(addresses.value) || addresses.value.length === 0) return null;
  const out = addresses.value
    .map((item) => {
      const value = (item.address || "").trim();
      if (!value) return null;
      const name = (item.name || "").trim();
      return name ? { name, address: value } : { address: value };
    })
    .filter((item): item is MailAddress => Boolean(item));
  return out.length ? out : null;
}

export function firstAddress(addresses: MailAddress[] | null): MailAddress | null {
  return addresses?.[0] ?? null;
}

export function normalizeDateIso(value: Date | null | undefined): string | null {
  if (!value) return null;
  const ts = value.getTime();
  if (Number.isNaN(ts)) return null;
  return new Date(ts).toISOString();
}

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function stripHtml(value: string): string {
  return collapseWhitespace(value.replace(/<[^>]+>/g, " "));
}

export function makePreview(text: string | null | undefined, max = 180): string {
  if (!text) return "";
  const normalized = collapseWhitespace(text);
  if (!normalized) return "";
  return normalized.length > max ? `${normalized.slice(0, max - 1)}…` : normalized;
}

export function normalizeSortOrder(value: string | undefined): "asc" | "desc" {
  return value?.toLowerCase() === "asc" ? "asc" : "desc";
}

export function hasAttachmentsFromBodyStructure(structure: MessageStructureObject | undefined): boolean {
  if (!structure) return false;
  const type = (structure.type || "").toLowerCase();
  const topType = type.split("/")[0] || type;
  const disposition = (structure.disposition || "").toLowerCase();
  const fileName = structure.dispositionParameters?.filename || structure.parameters?.name;

  const attachmentByDisposition = disposition === "attachment" || (disposition === "inline" && Boolean(fileName));
  const attachmentByType = Boolean(type) && topType !== "text" && topType !== "multipart" && !disposition;
  if (attachmentByDisposition || attachmentByType) return true;

  const children = structure.childNodes || [];
  return children.some((child) => hasAttachmentsFromBodyStructure(child));
}

export function envelopeValue(value: string | null | undefined): string {
  return (value || "").trim();
}

export function normalizeEnvelopeMessage(
  uid: number,
  seq: number,
  flags: string[],
  envelope: MessageEnvelopeObject | undefined,
  bodyStructure: MessageStructureObject | undefined,
) {
  const fromList = normalizeEnvelopeAddressList(envelope?.from);
  const toList = normalizeEnvelopeAddressList(envelope?.to);
  const ccList = normalizeEnvelopeAddressList(envelope?.cc);

  return {
    uid,
    seq,
    flags,
    seen: flags.includes("\\Seen"),
    from: firstAddress(fromList),
    to: toList,
    cc: ccList,
    subject: envelopeValue(envelope?.subject),
    date: normalizeDateIso(envelope?.date),
    preview: "",
    hasAttachments: hasAttachmentsFromBodyStructure(bodyStructure),
  };
}

export async function parseMessageSource(source: string): Promise<ParsedMailLike | null> {
  if (!source) return null;
  try {
    if (!simpleParserFn) {
      const mailparserModule = await import("mailparser");
      const maybeParser = (mailparserModule as { simpleParser?: unknown }).simpleParser;
      if (typeof maybeParser === "function") {
        simpleParserFn = maybeParser as (input: string | Buffer) => Promise<ParsedMailLike>;
      }
    }
    if (!simpleParserFn) return null;
    return await simpleParserFn(source);
  } catch {
    return null;
  }
}

function pickHeaderLine(headerLines: ParsedHeaderLine[] | null | undefined, key: string): string | null {
  if (!Array.isArray(headerLines)) return null;
  const wanted = key.toLowerCase();
  const matches = headerLines
    .filter((h) => (h.key || "").toLowerCase() === wanted)
    .map((h) => (h.line || "").replace(/^[^:]+:\s*/i, "").trim())
    .filter(Boolean);
  return matches.length ? matches.join(" | ") : null;
}

function matchVerdict(haystack: string, mechanism: string): string | null {
  const re = new RegExp(`\\b${mechanism}=([a-z]+)`, "i");
  const m = haystack.match(re);
  return m?.[1] ? m[1].toLowerCase() : null;
}

/** Derive a compact SPF/DKIM/DMARC verdict from the message header lines. */
export function parseAuthResults(headerLines: ParsedHeaderLine[] | null | undefined): MailAuthResults {
  const authResults = pickHeaderLine(headerLines, "Authentication-Results");
  const receivedSpf = pickHeaderLine(headerLines, "Received-SPF");
  const returnPath = pickHeaderLine(headerLines, "Return-Path");
  const dkimSigned = Boolean(pickHeaderLine(headerLines, "DKIM-Signature"));

  const combined = `${authResults || ""} ${receivedSpf || ""}`;
  let spf = matchVerdict(combined, "spf");
  // Received-SPF starts with the verdict word ("Pass"/"Fail"/...) before any "spf=".
  if (!spf && receivedSpf) {
    const first = receivedSpf.trim().split(/\s+/)[0]?.toLowerCase();
    if (first && /^(pass|fail|softfail|neutral|none|temperror|permerror)$/.test(first)) spf = first;
  }

  return {
    spf,
    dkim: matchVerdict(authResults || "", "dkim"),
    dmarc: matchVerdict(authResults || "", "dmarc"),
    returnPath: returnPath ? returnPath.replace(/^<|>$/g, "") : null,
    dkimSigned,
    authenticationResults: authResults,
  };
}

export function normalizeDate(value: Date | string | undefined): Date | undefined {
  if (!value) return undefined;
  if (value instanceof Date) return value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

export function addOneDay(date: Date): Date {
  const out = new Date(date);
  out.setDate(out.getDate() + 1);
  return out;
}

export function uidListToRange(uids: number[]): string {
  if (uids.length === 0) return "";
  const sorted = [...uids].sort((a, b) => a - b);
  const chunks: string[] = [];

  let start = sorted[0]!;
  let prev = sorted[0]!;
  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i]!;
    if (current === prev + 1) {
      prev = current;
      continue;
    }
    chunks.push(start === prev ? String(start) : `${start}:${prev}`);
    start = current;
    prev = current;
  }
  chunks.push(start === prev ? String(start) : `${start}:${prev}`);
  return chunks.join(",");
}

export function isSelectableMailbox(flags: Set<string> | undefined): boolean {
  if (!flags || flags.size === 0) return true;
  for (const flag of flags) {
    if (flag.toLowerCase() === "\\noselect") return false;
  }
  return true;
}
