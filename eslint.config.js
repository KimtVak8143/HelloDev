"use strict";

module.exports = [
  {
    ignores: ["node_modules/**", "coverage/**"]
  },
  {
    files: ["src/**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "commonjs"
    },
    rules: {
      "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "no-console": "off",
      eqeqeq: ["error", "always"],
      curly: ["error", "all"],
      quotes: ["error", "double"],
      semi: ["error", "always"],
      "comma-dangle": ["error", "never"]
    }
  }
];
