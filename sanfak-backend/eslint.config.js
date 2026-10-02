const boundaries = require("eslint-plugin-boundaries");

module.exports = [
  {
    files: ["src/**/*.js"],
    languageOptions: { ecmaVersion: 2023, sourceType: "commonjs" },
    plugins: { boundaries },
    settings: {
      "boundaries/include": ["src/**/*.js"],
      "boundaries/elements": [
        { type: "shared", pattern: "src/shared", mode: "folder" },
        { type: "config", pattern: "src/config", mode: "folder" },
        { type: "validators", pattern: "src/validators", mode: "folder" },
        { type: "identity", pattern: "src/modules/4.01-auth", mode: "folder" },
        { type: "module", pattern: "src/modules/*", mode: "folder", capture: ["module"] },
        { type: "references", pattern: "src/references", mode: "folder" },
        { type: "domain", pattern: "src/domain", mode: "folder" },
        { type: "system", pattern: "src/system", mode: "folder" },
        { type: "app", pattern: "src/app", mode: "folder" },
      ],
      "import/resolver": {
        "custom-alias": {
          alias: {
            "#shared": "./src/shared",
            "#config": "./src/config",
            "#validators": "./src/validators",
            "#modules": "./src/modules",
            "#references": "./src/references",
            "#domain": "./src/domain",
            "#system": "./src/system",
            "#app": "./src/app",
          },
          extensions: [".js"],
        },
      },
    },
    rules: {
      "boundaries/element-types": [
        "warn",
        {
          default: "disallow",
          rules: [
            {
              from: ["app"],
              allow: ["shared", "config", "validators", "identity", "references", "domain", "system", "module"],
            },
            {
              from: ["module"],
              allow: ["shared", "config", "validators", "identity", "references", "system", ["module", { module: "${from.module}" }]],
            },
            {
              from: ["system"],
              allow: ["shared", "config", "validators", "identity", "references", "domain"],
            },
            {
              from: ["domain"],
              allow: ["shared", "config", "validators", "identity", "references"],
            },
            { from: ["references"], allow: ["shared", "config", "validators", "references"] },
            { from: ["identity"], allow: ["shared", "config", "validators", "references", "identity"] },
            { from: ["shared"], allow: ["shared", "config", "identity"] },
            { from: ["config"], allow: ["config"] },
            { from: ["validators"], allow: ["shared", "config", "validators"] },
          ],
        },
      ],

      "max-lines-per-function": ["warn", { max: 50, skipComments: true, skipBlankLines: true }],
      "max-lines": ["warn", { max: 400, skipComments: true, skipBlankLines: true }],
      "max-statements": ["warn", { max: 25 }],
      "max-params": ["warn", { max: 4 }],
      "max-depth": ["warn", { max: 4 }],
      complexity: ["warn", { max: 10 }],
    },
  },
];
