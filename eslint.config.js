import js from '@eslint/js';
import globals from 'globals';

export default [
    { ignores: ['node_modules/', 'dist/'] },
    js.configs.recommended,
    {
        files: ['src/**/*.js'],
        languageOptions: {
            sourceType: 'module',
            globals: { ...globals.browser, ...globals.webextensions },
        },
    },
    {
        files: ['scripts/**/*.js', 'tests/**/*.js', '*.config.js'],
        languageOptions: {
            globals: { ...globals.node },
        },
    },
];
