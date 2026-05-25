import { defineConfig } from 'eslint/config'
import tseslint from '@electron-toolkit/eslint-config-ts'
import eslintConfigPrettier from '@electron-toolkit/eslint-config-prettier'
import eslintPluginReact from 'eslint-plugin-react'
import eslintPluginReactHooks from 'eslint-plugin-react-hooks'
import eslintPluginReactRefresh from 'eslint-plugin-react-refresh'

export default defineConfig(
    {
        ignores: [
            '**/node_modules',
            '**/dist',
            '**/out',
            '../!(desktop)/**', // ignore tout sauf apps/desktop
            'resources/**' // ignore le dossier resources dans apps/desktop
        ]
    },
    tseslint.configs.recommended,
    eslintPluginReact.configs.flat.recommended,
    eslintPluginReact.configs.flat['jsx-runtime'],
    {
        settings: {
            react: {
                version: 'detect'
            }
        }
    },
    {
        files: ['**/*.{ts,tsx}'],
        plugins: {
            'react-hooks': eslintPluginReactHooks,
            'react-refresh': eslintPluginReactRefresh
        },
        rules: {
            ...eslintPluginReactHooks.configs.recommended.rules,
            ...eslintPluginReactRefresh.configs.vite.rules,
            indent: ['error', 4],
            '@typescript-eslint/explicit-function-return-type': 'off',
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/no-unused-vars': 'warn',
            'no-prototype-builtins': 'off',
            'no-undef': 'off',
            'react/display-name': 'off'
        }
    },
    eslintConfigPrettier
)
