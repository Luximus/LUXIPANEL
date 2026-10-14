// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import type { AssistantSkill } from "../skill.types.js";
import { catalogSkill } from "./factory.js";

export const testingSkills: AssistantSkill[] = [
  catalogSkill({
    id: "playwright",
    name: "Playwright",
    category: "testing",
    source: "https://playwright.dev/",
    description:
      "Pruebas E2E multi-navegador con auto-espera y trazas.",
    block:
      "Prioriza locators user-facing (getByRole, getByLabel, getByText) sobre CSS/XPath frágiles; encadena con .filter(). Confía en el auto-waiting; nada de waitForTimeout. Aserciones web-first que reintentan (await expect(locator).toBeVisible()). Aísla cada test (storageState/setup project para login). Configura projects por navegador y baseURL. Depura con trace viewer (trace: 'on-first-retry'). Paraleliza con workers/--shard; sin dependencias entre tests.",
  }),
  catalogSkill({
    id: "cypress",
    name: "Cypress",
    category: "testing",
    source: "https://docs.cypress.io/",
    description:
      "Pruebas de componentes y E2E en navegador con reintentos.",
    block:
      "Comandos asíncronos: NO asignes su retorno con const/let; usa .as() + @alias. Selecciona por data-cy, no por clases. Stubea red con cy.intercept(...).as() y espera con cy.wait('@x'); nada de cy.wait(ms) fijo. Tests independientes: estado limpio en beforeEach (no afterEach); cy.session para login cacheado. Define baseUrl en cypress.config.js. Habilita retries en CI. Component testing para UI aislada.",
  }),
  catalogSkill({
    id: "vitest",
    name: "Vitest",
    category: "testing",
    source: "https://vitest.dev/",
    description:
      "Runner de tests rápido nativo de Vite/ESM.",
    block:
      "vi.mock se hoistea al tope del archivo (corre antes de los imports); declara las fábricas sin variables externas. Usa vi.fn/vi.spyOn y limpia/restaura entre tests (vi.restoreAllMocks o restoreMocks en config). Timers: vi.useFakeTimers + vi.advanceTimersByTime; fechas con vi.setSystemTime. test.each para casos parametrizados. Config en vitest.config.ts. Tests junto al fuente (foo.test.ts). Cobertura v8. Sin estado global compartido.",
  }),
  catalogSkill({
    id: "jest",
    name: "Jest",
    category: "testing",
    source: "https://jestjs.io/docs/getting-started",
    description:
      "Framework de pruebas con mocks integrados y snapshots.",
    block:
      "jest.mock(path) se hoistea al tope; usa jest.fn/jest.spyOn y jest.requireActual para mocks parciales. Limpia con clearMocks/restoreMocks (config o beforeEach). Asegúrate con .mock.calls y matchers (toHaveBeenCalledWith). Snapshots solo para salida estable; revisa los diffs, no apruebes a ciegas. jest.useFakeTimers para temporización. test.each para tablas. ESM/TS via ts-jest o babel-jest. No dependas del orden de ejecución.",
  }),
  catalogSkill({
    id: "testing-library",
    name: "Testing Library",
    category: "testing",
    source: "https://testing-library.com/docs/",
    description:
      "Consultas centradas en el usuario para probar UI accesible.",
    block:
      "Prioridad de consulta: getByRole > getByLabelText > getByText; getByTestId solo último recurso. queryBy* (devuelve null) para ausencia; findBy* (Promise, reintenta ~1000ms) para async; waitFor para cambios del DOM, no timeouts. userEvent (no fireEvent) para interacción realista. Usa screen.* en vez de destructurar render. No pruebes detalles de implementación ni estado interno; afirma lo que ve el usuario.",
  }),
  catalogSkill({
    id: "storybook",
    name: "Storybook",
    category: "testing",
    source: "https://storybook.js.org/docs",
    description:
      "Desarrollo y prueba aislada de componentes UI.",
    block:
      "Escribe stories en CSF3: default export (meta con component/parameters/decorators) + named exports como objetos con args. Archivos Componente.stories.tsx junto al componente. Usa args/argTypes para variar props; autodocs para documentación. Cubre estados clave (vacío, error, carga) como stories aparte. play functions para interacción + test-runner en CI. Decorators para tema/i18n/contexto. Solo presentación, sin lógica de negocio.",
  }),
];
