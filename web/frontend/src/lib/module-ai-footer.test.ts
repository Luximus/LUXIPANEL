import { afterEach, describe, expect, it } from "vitest";
import { mountModuleAiFooter } from "./module-ai-footer";

const tick = async () => { await new Promise((resolve) => setTimeout(resolve, 0)); };

afterEach(() => { document.body.replaceChildren(); });

describe("module AI drawer footer", () => {
  it("submits through the original module form and keeps its existing handler", async () => {
    document.body.innerHTML = `<form id="cron-ai-form" data-module-ai-footer-form>
      <div data-module-ai-footer-row><input id="cron-ai-input" data-module-ai-footer-input placeholder="Pregunta" />
      <button type="submit">Enviar</button></div></form><footer id="footer"></footer>`;
    const source = document.getElementById("cron-ai-form") as HTMLFormElement;
    const sourceInput = document.getElementById("cron-ai-input") as HTMLInputElement;
    const received: string[] = [];
    source.addEventListener("submit", (event) => {
      event.preventDefault();
      received.push(sourceInput.value);
      sourceInput.value = "";
    });
    const footer = document.getElementById("footer")!;
    const cleanup = mountModuleAiFooter(footer, document);
    const input = footer.querySelector("input") as HTMLInputElement;
    input.value = "Revisa el cron";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    (footer.querySelector("form") as HTMLFormElement).requestSubmit();
    await tick();
    expect(received).toEqual(["Revisa el cron"]);
    expect(input.value).toBe("");
    expect(source.hasAttribute("data-ai-footer-relocated")).toBe(true);
    cleanup();
    expect(footer.children).toHaveLength(0);
    expect(source.hasAttribute("data-ai-footer-relocated")).toBe(false);
  });

  it("switches the footer to the visible Files editor form", async () => {
    document.body.innerHTML = `<section id="browser"><form id="files-ai-form" data-module-ai-footer-form>
      <div data-module-ai-footer-row><input data-module-ai-footer-input placeholder="Archivos" /><button type="submit">Enviar</button></div>
      </form></section><section id="editor" hidden><form id="files-editor-ai-form" data-module-ai-footer-form>
      <div data-module-ai-footer-row><input data-module-ai-footer-input placeholder="Editor" /><button type="submit">Enviar</button></div>
      </form></section><footer id="footer"></footer>`;
    const footer = document.getElementById("footer")!;
    const cleanup = mountModuleAiFooter(footer, document);
    expect((footer.querySelector("input") as HTMLInputElement).placeholder).toBe("Archivos");
    document.getElementById("browser")!.hidden = true;
    document.getElementById("editor")!.hidden = false;
    await tick();
    expect((footer.querySelector("input") as HTMLInputElement).placeholder).toBe("Editor");
    cleanup();
  });

  it("relays an embedded module form into the host drawer footer", async () => {
    const embedded = document.implementation.createHTMLDocument("Cron");
    embedded.body.innerHTML = `<form data-module-ai-footer-form><div data-module-ai-footer-row>
      <input data-module-ai-footer-input placeholder="Pregunta a Cron" /><button type="submit">Enviar</button>
      </div></form>`;
    const source = embedded.querySelector("form") as HTMLFormElement;
    let submitted = "";
    source.addEventListener("submit", (event) => {
      event.preventDefault();
      submitted = (source.querySelector("input") as HTMLInputElement).value;
    });
    const footer = document.createElement("footer");
    document.body.appendChild(footer);
    const cleanup = mountModuleAiFooter(footer, embedded);
    const input = footer.querySelector("input") as HTMLInputElement;
    input.value = "Revisa mis tareas";
    (footer.querySelector("form") as HTMLFormElement).requestSubmit();
    await tick();
    expect(submitted).toBe("Revisa mis tareas");
    cleanup();
  });
});
