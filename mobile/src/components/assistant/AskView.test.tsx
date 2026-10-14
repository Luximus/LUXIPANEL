import React from "react";
import { act, create } from "react-test-renderer";
import { expect, it, vi } from "vitest";

vi.mock("react-native", () => ({ View: "View", Text: "Text", TextInput: "TextInput", Pressable: "Pressable", ActivityIndicator: "Spinner" }));
vi.mock("lucide-react-native", () => ({ Check: "Check", HelpCircle: "HelpCircle", Send: "Send", Square: "Square" }));
vi.mock("./format", () => ({ assistantChatMessages: () => ({ askAnswersPrefix: "Respuestas:" }) }));
vi.mock("./turn-box.styles", () => ({ turnBoxStyles: { turnBox: {}, turnBoxTitleRow: {}, turnBoxTitle: {}, askQuestionText: {}, turnBoxBody: {} } }));
vi.mock("./AskView.styles", () => ({ styles: { askQuestion: {}, askInput: {}, askOptions: {}, askOption: {}, askOptionText: {}, askSubmit: {}, askSubmitText: {} } }));
import { AskView } from "./AskView";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const tokens = { border: "#333", brand: "#88f", brandDim: "#224", bgInput: "#111", textPrimary: "#fff", textSecondary: "#ccc", textMuted: "#888" } as any;

it("envía planDecision solo al elegir la primera opción del plan", async () => {
  const onAnswer = vi.fn(() => true);
  const questions = [{ id: "plan", type: "single" as const, text: "¿Apruebas?", options: ["Aprobar plan", "Pedir cambios"] }];
  let tree: ReturnType<typeof create>;
  await act(async () => { tree = create(<AskView questions={questions} kind="plan-approval" interactive t={{} as any} tokens={tokens} onAnswer={onAnswer} />); });
  const choices = tree!.root.findAllByType("Pressable" as any);
  await act(async () => choices[0]!.props.onPress());
  expect(onAnswer).toHaveBeenCalledWith("Aprobar plan", { planDecision: "approve" });
  await act(async () => tree!.unmount());

  onAnswer.mockClear();
  await act(async () => { tree = create(<AskView questions={questions} kind="plan-approval" interactive t={{} as any} tokens={tokens} onAnswer={onAnswer} />); });
  await act(async () => tree!.root.findAllByType("Pressable" as any)[1]!.props.onPress());
  expect(onAnswer).not.toHaveBeenCalled();
  await act(async () => tree!.root.findAllByType("Pressable" as any).at(-1)!.props.onPress());
  expect(onAnswer).toHaveBeenCalledWith("Pedir cambios", undefined);
  await act(async () => tree!.unmount());
});
