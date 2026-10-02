"use strict";

const describeError = (err) => {
  if (err instanceof Error) return err.stack || `${err.name}: ${err.message}`;
  try {
    return typeof err === "string" ? err : JSON.stringify(err);
  } catch {
    return String(err);
  }
};

const EXIT_DELAY_MS = 500;

function installProcessGuard({
  logger,
  proc = process,
  exit = (code) => process.exit(code),
  stderrWrite = (chunk) => process.stderr.write(chunk),
} = {}) {
  if (!logger || typeof logger.error !== "function") {
    throw new TypeError("processGuard: logger.error kerak");
  }
  if (proc.__processGuardInstalled) return proc.__processGuardInstalled;

  const onRejection = (reason) => {
    logger.error(`[process] unhandledRejection — jarayon davom etadi: ${describeError(reason)}`);
  };
  const onException = (err, origin) => {
    logger.error(`[process] uncaughtException (${origin || "uncaughtException"}) — ${EXIT_DELAY_MS} ms dan keyin exit(1): ${describeError(err)}`);
    const t = setTimeout(() => exit(1), EXIT_DELAY_MS);
    if (typeof t.unref === "function") t.unref();
  };
  const onExit = (code) => {
    stderrWrite(`[process] exit code=${code} (${new Date().toISOString()})\n`);
  };
  const onLoggerError = (err) => {
    stderrWrite(`[process] logger error: ${describeError(err)}\n`);
  };

  proc.on("unhandledRejection", onRejection);
  proc.on("uncaughtException", onException);
  proc.on("exit", onExit);
  if (typeof logger.on === "function") logger.on("error", onLoggerError);

  const handle = {
    uninstall: () => {
      proc.off("unhandledRejection", onRejection);
      proc.off("uncaughtException", onException);
      proc.off("exit", onExit);
      if (typeof logger.off === "function") logger.off("error", onLoggerError);
      delete proc.__processGuardInstalled;
    },
  };
  proc.__processGuardInstalled = handle;
  return handle;
}

module.exports = { installProcessGuard, describeError, EXIT_DELAY_MS };
