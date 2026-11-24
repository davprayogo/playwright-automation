/**
 * Writes results.json for TCMS (FSD ZSN_ETCMS001 FR-220, FR-240, Section 8.5 step 5).
 *
 * playwright.config.ts:
 *   reporter: [["html"], ["./src/tcms/reporter.ts", { outputFile: "results.json" }]]
 *
 * Result per test case:
 *   prepared / setup_failed  in Prepare data only
 *   blocked                  setup failed, or a SetupError was thrown in the test body
 *   fail                     setup passed and a step or check failed
 *   pass                     setup and test passed
 *   skipped                  selected by --grep but not ticked in the run
 * Evidence: attachment paths. With BUILD_URL (Jenkins) they become artifact addresses,
 * so the archiveArtifacts pattern must keep the paths relative to the workspace.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import type {
  FullConfig,
  Reporter,
  TestCase,
  TestResult,
  TestStep,
} from "@playwright/test/reporter";
import { SETUP_ERROR_MARK } from "./errors";

type TcmsResult = "pass" | "fail" | "blocked" | "skipped" | "prepared" | "setup_failed";

interface TcmsTestResult {
  testCase: string;
  title: string;
  version: string | null;
  result: TcmsResult;
  setup: { status: "ok" | "failed" | "none"; note: string };
  test: { status: "passed" | "failed" | "not_run"; note: string };
  cleanup: "done" | "failed" | "kept" | "none";
  note: string;
  dataSnapshot: unknown[];
  log: string;
  evidence: { screenshot: string[]; trace: string | null; video: string | null };
  durationMs: number;
}

/** Error text without the SetupError name and mark. */
const clean = (text: string) => text.replace(/^SetupError:\s*/, "").replace(SETUP_ERROR_MARK, "").trim();

const firstLine = (text = "") => text.replace(/\u001b\[[0-9;]*m/g, "").split("\n")[0].trim();

function failedStep(steps: TestStep[]): string | null {
  for (const step of steps) {
    const inner = failedStep(step.steps);
    if (inner) return inner;
    if (step.error && step.category === "test.step") return step.title;
  }
  return null;
}

export default class TcmsReporter implements Reporter {
  private readonly results: TcmsTestResult[] = [];
  private readonly outputFile: string;
  private rootDir = process.cwd();

  constructor(options: { outputFile?: string } = {}) {
    this.outputFile = options.outputFile ?? process.env.TCMS_RESULTS_FILE ?? "results.json";
  }

  onBegin(config: FullConfig) {
    this.rootDir = config.rootDir;
  }

  private evidence(filePath?: string): string | null {
    if (!filePath) return null;
    const rel = path.relative(process.cwd(), filePath).split(path.sep).join("/");
    const build = process.env.BUILD_URL;
    return build ? `${build.replace(/\/?$/, "/")}artifact/${rel}` : rel;
  }

  /** PNG attachments; attachScreenshot() attaches a body, so it is written to a file first. */
  private screenshots(tcId: string, result: TestResult): string[] {
    const dir = path.resolve(this.rootDir, "test-results", "tcms-evidence");
    mkdirSync(dir, { recursive: true });
    return result.attachments
      .filter((a) => a.contentType === "image/png")
      .map((a, i) => {
        let file = a.path;
        if (!file && a.body) {
          file = path.join(dir, `${tcId}-r${result.retry}-${i + 1}.png`);
          writeFileSync(file, a.body);
        }
        return this.evidence(file);
      })
      .filter((x): x is string => !!x);
  }

  onTestEnd(test: TestCase, result: TestResult) {
    const tcId = test.tags.find((t) => /^@TC-/.test(t))?.slice(1);
    if (!tcId) return;
    const ann = (type: string) => test.annotations.find((a) => a.type === type)?.description;
    // Annotations pushed during the run are on result.annotations (Playwright >= 1.52) or test.annotations.
    const runAnn = (type: string) =>
      ((result as unknown as { annotations?: { type: string; description?: string }[] }).annotations ?? [])
        .find((a) => a.type === type)?.description ?? ann(type);

    const setupAnn = runAnn("tcms-setup");
    const prepared = runAnn("tcms-prepared") === "ok";
    const notInRun = runAnn("tcms-not-in-run") !== undefined;
    const errorText = firstLine(result.error?.message);
    const setupError = (result.errors ?? []).some((e) => e.message?.includes(SETUP_ERROR_MARK));
    const setupFailed = setupAnn?.startsWith("failed") || (!setupAnn && setupError);
    const isPrepare = runAnn("tcms-data-mode") === "prepare";

    const snapshotAtt = result.attachments.find((a) => a.name === "tcms-snapshot");
    const snapshot = snapshotAtt?.body ? JSON.parse(snapshotAtt.body.toString("utf8")) : { cleanup: "none", rows: [] };
    const logAtt = result.attachments.find((a) => a.name === "tcms-log");

    let res: TcmsResult;
    if (notInRun) res = "skipped";
    else if (setupFailed) res = isPrepare ? "setup_failed" : "blocked";
    else if (prepared) res = "prepared";
    else if (result.status === "passed") res = "pass";
    else if (result.status === "skipped") res = "skipped";
    else res = setupError ? "blocked" : "fail";

    const step = failedStep(result.steps);
    const setupNote = setupFailed ? (setupAnn?.replace(/^failed:\s*/, "") ?? clean(errorText)) : "";
    const testStatus: TcmsTestResult["test"]["status"] =
      res === "pass" ? "passed" : res === "fail" || (res === "blocked" && !setupFailed) ? "failed" : "not_run";

    this.results.push({
      testCase: tcId,
      title: test.title,
      version: ann("tc-version") ?? null,
      result: res,
      setup: { status: setupFailed ? "failed" : setupAnn === "ok" ? "ok" : "none", note: setupNote },
      test: {
        status: testStatus,
        note: res === "fail" ? (step ? `Failed at step "${step}": ${errorText}` : errorText) : "",
      },
      cleanup: snapshot.cleanup,
      note: res === "blocked" || res === "setup_failed" ? setupNote || clean(errorText) : res === "fail" ? errorText : "",
      dataSnapshot: snapshot.rows,
      log: [logAtt?.body?.toString("utf8") ?? "", ...result.stdout.map(String)].filter(Boolean).join("\n"),
      evidence: {
        screenshot: this.screenshots(tcId, result),
        trace: this.evidence(result.attachments.find((a) => a.name === "trace")?.path),
        video: this.evidence(result.attachments.find((a) => a.name === "video")?.path),
      },
      durationMs: result.duration,
    });
  }

  onEnd() {
    const body = {
      runId: process.env.TCMS_RUN_ID ?? null,
      generatedAt: new Date().toISOString(),
      tests: this.results,
    };
    writeFileSync(path.resolve(this.rootDir, this.outputFile), JSON.stringify(body, null, 2));
  }

  printsToStdio() {
    return false;
  }
}