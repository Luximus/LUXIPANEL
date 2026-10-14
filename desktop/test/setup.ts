import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach } from "vitest";

// Estado limpio entre tests: jsdom comparte localStorage entre casos.
beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
});
