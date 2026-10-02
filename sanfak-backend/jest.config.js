module.exports = {
  testEnvironment: "node",
  setupFiles: ["./test/setup.js"],
  testMatch: ["**/*.test.js"],
  testPathIgnorePatterns: ["/node_modules/", "/test/integration/"],
  moduleNameMapper: {
    "^#shared/(.*)$": "<rootDir>/src/shared/$1",
    "^#config/(.*)$": "<rootDir>/src/config/$1",
    "^#validators/(.*)$": "<rootDir>/src/validators/$1",
    "^#modules/(.*)$": "<rootDir>/src/modules/$1",
    "^#references/(.*)$": "<rootDir>/src/references/$1",
    "^#domain/(.*)$": "<rootDir>/src/domain/$1",
    "^#system/(.*)$": "<rootDir>/src/system/$1",
    "^#app/(.*)$": "<rootDir>/src/app/$1",
  },
  coverageDirectory: "coverage",
  collectCoverageFrom: ["src/**/*.js", "!src/**/*.test.js"],
};
