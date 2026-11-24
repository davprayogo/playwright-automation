/**
 * A setup problem: the data a test case needs could not be created, found or read.
 * The reporter turns it into Blocked (or Setup failed in Prepare data only), never Fail,
 * because Fail must mean a problem in the menu under test (FSD ZSN_ETCMS001 FR-220).
 */
export const SETUP_ERROR_MARK = "[TCMS setup]";

export class SetupError extends Error {
  constructor(message: string) {
    super(`${SETUP_ERROR_MARK} ${message}`);
    this.name = "SetupError";
  }
}

/** The test needs something of the data that is not there: Blocked, not Fail. */
export function requireData(condition: unknown, message: string): asserts condition {
  if (!condition) throw new SetupError(message);
}