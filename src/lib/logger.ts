type LogArgs = Parameters<typeof console.log>;

function isSilent() {
  const env = import.meta.env;
  const level = env.VITE_MISTY_LOG_LEVEL;
  return level === "silent" || (env.PROD && level !== "debug");
}

export const logger = {
  debug(...args: LogArgs) {
    if (!isSilent()) console.debug(...args);
  },
  info(...args: LogArgs) {
    if (!isSilent()) console.info(...args);
  },
  warn(...args: LogArgs) {
    console.warn(...args);
  },
  error(...args: LogArgs) {
    console.error(...args);
  },
};
