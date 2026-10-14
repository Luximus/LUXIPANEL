// Registra los matchers de @testing-library/jest-dom (toBeInTheDocument,
// toHaveAttribute, toBeDisabled, …) en los tipos de `expect` de Vitest.
// Vive en src/ (no en test/setup.ts) para que `tsc -b` lo incluya en el
// programa y la augmentación de tipos sea global para los *.test.tsx.
import "@testing-library/jest-dom/vitest";
