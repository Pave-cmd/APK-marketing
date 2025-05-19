const js = require('@eslint/js');
const tseslint = require('@typescript-eslint/eslint-plugin');
const unusedImports = require('eslint-plugin-unused-imports');
const tsParser = require('@typescript-eslint/parser');

module.exports = [
  js.configs.recommended,
  {
    files: ['**/*.js', '**/*.ts'],
    ignores: ['dist/**/*', 'node_modules/**/*', 'jscpd-report/**/*', 'src/public/js/**/*'],
    plugins: {
      '@typescript-eslint': tseslint,
      'unused-imports': unusedImports
    },
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: 'module',
      },
      globals: {
        // Přidáváme globální proměnné, které ESLint nerozpoznal
        process: 'readonly',
        console: 'readonly',
        module: 'readonly',
        __dirname: 'readonly',
        require: 'readonly',
        Buffer: 'readonly',
        URL: 'readonly'
      }
    },
    rules: {
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': 'error',
      'unused-imports/no-unused-imports': 'error',
      'unused-imports/no-unused-vars': [
        'error',
        {
          'vars': 'all', 
          'varsIgnorePattern': '^_', 
          'args': 'after-used', 
          'argsIgnorePattern': '^_'
        }
      ]
    }
  },
  {
    files: ['src/public/js/**/*.js'],
    languageOptions: {
      globals: {
        document: 'readonly',
        window: 'readonly',
        bootstrap: 'readonly',
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        Response: 'readonly',
        Headers: 'readonly',
        fetch: 'readonly',
        setInterval: 'readonly',
        location: 'readonly',
        HTMLElement: 'readonly'
      }
    }
  }
];