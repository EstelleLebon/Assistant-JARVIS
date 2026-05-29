
import { defineConfig } from "eslint/config";
import tseslint from "@electron-toolkit/eslint-config-ts";
import eslintConfigPrettier from "@electron-toolkit/eslint-config-prettier";
import parser from "@typescript-eslint/parser";

export default defineConfig(
  tseslint.configs.recommended,
  {
    ignores: [
      "**/node_modules",
      "**/dist",
      "**/out"
    ],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parser
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
  eslintConfigPrettier,
);
