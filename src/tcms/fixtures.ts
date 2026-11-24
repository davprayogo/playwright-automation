/**
 * Playwright `test` with the TCMS data-set provider (FSD ZSN_ETCMS001 Section 8.9).
 *
 *   import { test, expect } from "@tcms/fixtures";
 *   test("TC-MOM99-007 ...", { tag: ["@positive", "@TC-MOM99-007"],
 *     annotation: { type: "tc-version", description: "1" } }, async ({ page, data }) => {
 *     const line = data.get("DS-MOM99-29");
 *   });
 *
 * Phases (FR-220):
 *   setup   : before the test body: existing data checked, Setup data sets created.
 *             A failure is a SetupError -> Blocked (Setup failed in Prepare data only).
 *   test    : the test body.
 *   cleanup : after the test body, by record number. Never changes the result.
 * Data after the run (FR-165): `delete` cleans up, `keep` keeps everything, `prepare` runs
 * only the setup, keeps it, and skips the test body ("Prepare data only" -> Prepared).
 */
import { test as base, expect } from "@playwright/test";
import { DataProvider } from "./dataProvider";
import { SETUP_ERROR_MARK, SetupError } from "./errors";
import { loadRunSetup } from "./runSetup";

export { expect };

/** Annotation types read by tcms/reporter.ts. */
export const TCMS_ANNOTATION = {
  version: "tc-version",
  setup: "tcms-setup",
  prepared: "tcms-prepared",
  notInRun: "tcms-not-in-run",
  dataMode: "tcms-data-mode",
} as const;

export const PREPARE_SKIP_REASON = "Prepare data only";

type Options = {
  /** Path of run-setup.json. From RUN_SETUP_FILE, or set in playwright.config `use`. */
  runSetupFile: string;
};

type Fixtures = { data: DataProvider };

const tcIdOf = (tags: readonly string[]) => tags.find((t) => /^@TC-/.test(t))?.slice(1);

export const test = base.extend<Options & Fixtures>({
  runSetupFile: [process.env.RUN_SETUP_FILE ?? "", { option: true }],

  data: async ({ page, runSetupFile }, use, testInfo) => {
    const tcId = tcIdOf(testInfo.tags);
    if (!tcId) throw new Error(`Test "${testInfo.title}" has no @TC-... tag (FSD ZSN_ETCMS001 Section 8.9).`);
    if (!runSetupFile) {
      throw new SetupError("RUN_SETUP_FILE is not set: the test data comes only from the TCMS run setup file.");
    }
    const setup = loadRunSetup(runSetupFile);
    const tc = setup.testCases[tcId];
    if (!tc) {
      // Selected by --grep but not ticked in TCMS: Skipped (FR-220).
      testInfo.annotations.push({ type: TCMS_ANNOTATION.notInRun, description: tcId });
      testInfo.skip(true, `${tcId} is not in run ${setup.runId}`);
      return;
    }
    const built = testInfo.annotations.find((a) => a.type === TCMS_ANNOTATION.version)?.description;
    if (built !== String(tc.version)) {
      console.warn(`${tcId}: script built from version ${built ?? "?"}, run setup sends version ${tc.version}.`);
    }

    const data = new DataProvider(page, setup, tcId);
    testInfo.annotations.push({ type: TCMS_ANNOTATION.dataMode, description: setup.dataMode });
    const finish = async () => {
      await testInfo.attach("tcms-snapshot", {
        body: JSON.stringify({ cleanup: data.cleanupStatus(), rows: data.snapshot() }, null, 2),
        contentType: "application/json",
      });
      await testInfo.attach("tcms-log", { body: data.log.join("\n"), contentType: "text/plain" });
    };

    try {
      await data.runSetup();
      testInfo.annotations.push({ type: TCMS_ANNOTATION.setup, description: "ok" });
    } catch (e) {
      const message = (e as Error).message.replace(SETUP_ERROR_MARK, "").trim();
      testInfo.annotations.push({ type: TCMS_ANNOTATION.setup, description: `failed: ${message}` });
      await data.cleanup(); // records made before the failure: deleted, or kept in keep / prepare
      await finish();
      throw e instanceof SetupError ? e : new SetupError(message);
    }

    if (data.dataMode === "prepare") {
      await data.cleanup(); // marks every created record as kept
      testInfo.annotations.push({ type: TCMS_ANNOTATION.prepared, description: "ok" });
      await finish();
      testInfo.skip(true, PREPARE_SKIP_REASON);
      return;
    }

    await use(data);

    await data.cleanup();
    await finish();
  },
});