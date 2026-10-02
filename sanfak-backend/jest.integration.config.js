module.exports = {
  testEnvironment: "node",
  setupFilesAfterEnv: ["./test/integration/setup.js"],
  testMatch: ["**/test/integration/**/*.integration.test.js"],
  testPathIgnorePatterns: ["/node_modules/"],
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
  testTimeout: 60000,
};
