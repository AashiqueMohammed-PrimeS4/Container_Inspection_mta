// Console wrapper.

function enabled(): boolean {
  try {
    return Boolean(localStorage.getItem("debug"));
  } catch {
    return false; // private window or blocked storage
  }
}

export const log = {
  debug: (...args: unknown[]): void => {
    if (enabled()) console.debug("[claim]", ...args);
  },
  warn: (...args: unknown[]): void => {
    if (enabled()) console.warn("[claim]", ...args);
  },
};
