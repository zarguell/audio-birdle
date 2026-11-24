import js from "@eslint/js";
import globals from "globals";

export default [
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "htmlcov/**",
      "coverage/**",
      ".venv/**",
      "sitegen/vendor/**",
    ],
  },
  {
    files: ["sitegen/static/js/**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        ...globals.browser,
      },
    },
    rules: {
      ...js.configs.recommended.rules,
      eqeqeq: "error",
      "no-console": ["warn", { allow: ["warn", "error", "info"] }],
      "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "prefer-const": "error",
    },
  },
  {
    files: ["tests/js/**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      ...js.configs.recommended.rules,
      eqeqeq: "error",
      "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "prefer-const": "error",
    },
  },
];
