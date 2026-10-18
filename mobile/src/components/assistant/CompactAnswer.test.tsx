// SPDX-License-Identifier: AGPL-3.0-only
import React from "react";
import { act, create } from "react-test-renderer";
import { expect, it, vi } from "vitest";
vi.mock("react-native", () => ({ View: "View", Text: "Text", Pressable: "Pressable" }));
vi.mock("../MarkdownView", () => ({ MarkdownView: ({ text }: { text: string }) => React.createElement("Detail", { text }) }));
import { CompactAnswer } from "./CompactAnswer";
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

it("collapses long historical answers and opens the intact original on request", async () => {
  const content = "Revisión terminada. Falta desplegar.\n\n" + "Evidencia completa. ".repeat(100);
  let tree: ReturnType<typeof create>;
  await act(async () => { tree = create(<CompactAnswer text={content} tokens={{} as any} t={{} as any} lang="es" />); });
  expect(tree!.root.findAllByType("Detail" as any)).toHaveLength(0);
  const text = tree!.root.findAllByType("Text" as any)[0]!;
  expect(text.props.children).toBe("Revisión terminada. Falta desplegar.");
  expect(text.props.numberOfLines).toBe(2);
  await act(async () => tree!.root.findByType("Pressable" as any).props.onPress());
  expect(tree!.root.findByType("Detail" as any).props.text).toBe(content);
  expect(tree!.root.findByType("Pressable" as any).props.accessibilityState.expanded).toBe(true);
  await act(async () => tree!.unmount());
});
