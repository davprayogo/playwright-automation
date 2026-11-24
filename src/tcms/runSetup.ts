/**
 * TCMS run setup (FSD ZSN_ETCMS001 Section 8.5): the final test data of each test case,
 * made by TCMS. The script only carries it out: it never makes a value (Section 8.9).
 *
 * Shape = the FSD example, plus `dataSets` (catalogue of Section 9.1). The FSD example has
 * no menu, role, state or dependencies per data set, so the script could not know in which
 * menu to create a record, which one to set inactive, or in which order. Proposed as an FSD
 * change (finding TCMS-F01): until TCMS sends it, the sample file carries it.
 */
import { readFileSync } from "node:fs";

export type DataSource = "dummy" | "custom" | "existing" | "input" | "dependency";
export type DataMode = "delete" | "keep" | "prepare";

/** Field label (as shown in Lumina, Section 9.1) -> value. */
export type FieldValues = Record<string, string>;

/** One row of Section 9.1 of the feature FSD. */
export interface DataSetDef {
  menu: string;
  role: "setup" | "input";
  /** Empty for Input. */
  state?: "active" | "inactive";
  /** Field labels of the identity key. Empty for Input. */
  identityKey?: string[];
  /**
   * Depends On, with the field of this data set that points to it.
   * Example DS-MOM99-14: { "DS-MOM99-04": "Process Master", "DS-MOM99-07": "Storage Location" }.
   * Taken from the `{DS-...}` tokens of Default Values. Needed for FR-140 (dependency follows
   * an existing record) and for the create order.
   */
  dependsOn?: Record<string, string>;
}

export type TestDataEntry =
  | { source: "dummy" | "custom" | "input"; values: FieldValues }
  | { source: "existing"; key: FieldValues }
  | { source: "dependency"; follows: string };

export interface TestCaseSetup {
  version: number;
  data: Record<string, TestDataEntry>;
}

export interface RunSetup {
  runId: string;
  environment: "qa" | "uat";
  browser: "chromium";
  dataMode: DataMode;
  dataSets: Record<string, DataSetDef>;
  testCases: Record<string, TestCaseSetup>;
}

const cache = new Map<string, RunSetup>();

/** Read and check the run setup file once per worker. */
export function loadRunSetup(file: string): RunSetup {
  const hit = cache.get(file);
  if (hit) return hit;
  let setup: RunSetup;
  try {
    setup = JSON.parse(readFileSync(file, "utf8")) as RunSetup;
  } catch (e) {
    throw new Error(`TCMS run setup "${file}" cannot be read: ${(e as Error).message}`);
  }
  for (const field of ["runId", "dataMode", "dataSets", "testCases"] as const) {
    if (setup[field] === undefined) throw new Error(`TCMS run setup "${file}": "${field}" is missing.`);
  }
  if (!["delete", "keep", "prepare"].includes(setup.dataMode)) {
    throw new Error(`TCMS run setup "${file}": dataMode "${setup.dataMode}" is not delete, keep or prepare.`);
  }
  cache.set(file, setup);
  return setup;
}