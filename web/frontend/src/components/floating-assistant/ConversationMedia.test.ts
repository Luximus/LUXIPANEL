// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { AttachmentsBrowser } from "./ConversationMedia";

afterEach(() => document.body.replaceChildren());

it("uploads new files and stages a conversation image from Multimedia", async () => {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const onUpload = vi.fn();
  const onClose = vi.fn();
  const onAttachExisting = vi.fn(async () => undefined);
  const image = { name: "foto.png", mimeType: "image/png", url: "/api/ai/attachments/123" };

  await act(async () => {
    root.render(createElement(AttachmentsBrowser, {
      attachments: [image],
      onOpenImage: vi.fn(),
      onUpload,
      onAttachExisting,
      onClose,
    }));
  });

  const buttons = Array.from(document.querySelectorAll("button"));
  const upload = buttons.find((button) => button.textContent?.includes("Subir archivos"));
  const attach = buttons.find((button) => button.textContent?.includes("Adjuntar al chat"));
  expect(upload).toBeDefined();
  expect(attach).toBeDefined();

  await act(async () => { upload!.click(); });
  expect(onUpload).toHaveBeenCalledOnce();

  await act(async () => { attach!.click(); });
  expect(onAttachExisting).toHaveBeenCalledWith(image);
  expect(onClose).toHaveBeenCalledOnce();
  await act(async () => { root.unmount(); });
});
