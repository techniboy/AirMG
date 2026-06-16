import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      // `export const` next to a component is fine (CVA variants, shared consts).
      'react-refresh/only-export-components': ['error', { allowConstantExport: true }],
    },
  },
  {
    // react-three-fiber subtree: scenes mutate the scene graph inside the
    // useFrame render loop and use seeded procedural generation. React's
    // purity/immutability/effect rules don't model that paradigm, so they only
    // produce false positives here — disabled for this directory only.
    files: ['src/orbital/**/*.{ts,tsx}'],
    rules: {
      'react-hooks/immutability': 'off',
      'react-hooks/purity': 'off',
      'react-hooks/set-state-in-effect': 'off',
      'react-refresh/only-export-components': 'off',
    },
  },
])
