// ESLint 9 flat config — backend LUXIPANEL (ESM, "type": "module").
// Sin type-checked linting: el chequeo de tipos ya lo cubre `npm run typecheck`.
import js from "@eslint/js";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import globals from "globals";

export default [
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "scripts/remote/**", // engines python + bundle remoto
      "coverage/**",
      "*.config.js",
      "*.config.ts",
    ],
  },
  {
    files: ["src/**/*.ts"],
    // El código lleva disables de reglas type-checked (no-unsafe-assignment,
    // require-await) que aquí no corren: no los marques como sobrantes.
    linterOptions: { reportUnusedDisableDirectives: "off" },
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 2023,
      sourceType: "module",
      parserOptions: { project: false },
      globals: { ...globals.node },
    },
    plugins: { "@typescript-eslint": tsPlugin },
    rules: {
      ...js.configs.recommended.rules,
      ...tsPlugin.configs["eslint-recommended"].overrides[0].rules,
      ...tsPlugin.configs.recommended.rules,

      // Reglas base que TypeScript ya garantiza o que chocan con el estilo del repo.
      "no-undef": "off",
      "no-empty": ["error", { allowEmptyCatch: true }],
      "no-control-regex": "off",

      // Estilo en regex/try-catch existentes: informa, no bloquea.
      "no-useless-escape": "warn",
      "no-regex-spaces": "warn",
      "no-useless-catch": "warn",

      // `any` es deliberado en los puentes con SSH/Redis/CLI sin tipos.
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          args: "after-used",
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrors: "all",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/no-empty-object-type": "off",
      "@typescript-eslint/no-require-imports": "off",
      "@typescript-eslint/no-unused-expressions": "off",
      "@typescript-eslint/no-this-alias": "off",
      "@typescript-eslint/ban-ts-comment": "warn",
      "@typescript-eslint/no-namespace": "off",
    },
  },
  {
    // Runner del sandbox: JS suelto dentro de src/.
    files: ["src/**/*.{js,mjs,cjs}"],
    linterOptions: { reportUnusedDisableDirectives: "off" },
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
      globals: { ...globals.node },
    },
    rules: {
      ...js.configs.recommended.rules,
      "no-empty": ["error", { allowEmptyCatch: true }],
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
  {
    // Tests: mismas reglas, sin ruido por helpers y mocks.
    files: ["src/**/*.test.ts", "src/test/**/*.ts"],
    rules: {
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-non-null-assertion": "off",
    },
  },
];
