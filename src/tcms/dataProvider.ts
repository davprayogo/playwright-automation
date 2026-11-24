/**
 * Data-set provider (FSD ZSN_ETCMS001 Section 8.9). Carries out the test data TCMS made for
 * ONE test case. It never makes a value.
 *
 *   dummy / custom : create with exactly the given values, save the record number, own it,
 *                    delete it in cleanup by that number.
 *   existing       : find by identity key, check one row and the state (FR-210). Never changed.
 *   input          : hand the values to the test, which types them in its steps.
 *   dependency     : nothing to create; the identity value is read from the record it follows.
 *
 * Ownership: deactivate() and remove() refuse a record the provider did not create, so a
 * missing `(mutates)` mark in the FSD can never change existing data.
 */
import type { Page } from "@playwright/test";
import { SetupError } from "./errors";
import type { MenuAdapter } from "./adapter";
import { RecordPage } from "./RecordPage";
import { menuAdapter } from "./registry";
import type {
  DataMode,
  DataSetDef,
  DataSource,
  FieldValues,
  RunSetup,
  TestDataEntry,
} from "./runSetup";

export type CleanupResult = "deleted" | "not_touched" | "failed" | "kept" | "none";

interface RecordState {
  ds: string;
  menu: string;
  source: DataSource;
  /** Values sent by TCMS (identity key for existing). */
  sent: FieldValues | { follows: string };
  /** Values the test reads: sent values, plus the fields read from Lumina for existing data. */
  values?: FieldValues;
  recordNo?: string;
  owned: boolean;
  /** Gone from Lumina because the test (or "another user" in the test) deleted it. */
  gone: boolean;
  state?: "active" | "inactive";
  cleanup: CleanupResult;
  note?: string;
}

/** What a test gets from data.get(). */
export interface DataSetHandle {
  id: string;
  source: DataSource;
  values: Readonly<FieldValues>;
  /** One field; a field that is not known is a setup error (Blocked), not a test failure. */
  value(label: string): string;
  recordNo?: string;
}

export interface SnapshotRow {
  dataSet: string;
  menu: string;
  source: DataSource;
  valuesSent: FieldValues | { follows: string };
  record: FieldValues | null;
  luminaRecordNo: string | null;
  state: "active" | "inactive" | null;
  cleanup: CleanupResult;
  note?: string;
}

export class DataProvider {
  readonly dataMode: DataMode;
  readonly log: string[] = [];
  private readonly records = new Map<string, RecordState>();
  /** Creation order: cleanup runs in reverse, so records that use others go first. */
  private readonly createdOrder: string[] = [];

  constructor(
    private readonly page: Page,
    private readonly setup: RunSetup,
    readonly tcId: string,
  ) {
    this.dataMode = setup.dataMode;
    for (const [ds, entry] of Object.entries(this.entries)) {
      const def = this.def(ds);
      this.records.set(ds, {
        ds,
        menu: def.menu,
        source: entry.source,
        sent: "follows" in entry ? { follows: entry.follows } : "key" in entry ? entry.key : entry.values,
        owned: false,
        gone: false,
        cleanup: "none",
      });
    }
  }

  private get entries(): Record<string, TestDataEntry> {
    return this.setup.testCases[this.tcId].data;
  }

  private def(ds: string): DataSetDef {
    const def = this.setup.dataSets[ds];
    if (!def) throw new SetupError(`${ds} is in the test data of ${this.tcId} but not in the dataSets catalogue.`);
    return def;
  }

  private entry(ds: string): TestDataEntry {
    const entry = this.entries[ds];
    if (!entry) {
      throw new SetupError(`${this.tcId} has no test data for ${ds}. Add it to Data Sets of the test case in the FSD.`);
    }
    return entry;
  }

  private state(ds: string): RecordState {
    this.entry(ds);
    return this.records.get(ds)!;
  }

  private adapter(ds: string): MenuAdapter {
    return menuAdapter(this.def(ds).menu);
  }

  private say(line: string) {
    this.log.push(`${new Date().toISOString()} ${line}`);
  }

  // ===================================================================
  // Setup phase (FR-210, FR-220)
  // ===================================================================

  /**
   * 1. Check every existing data set (before anything is created).
   * 2. Create every dummy / custom Setup data set, dependencies first.
   * 3. Set the Setup data sets with State Inactive to inactive, after their dependants exist
   *    (MOM-99 Section 9.1 note).
   * Input data sets are not created: the test steps create them.
   */
  async runSetup() {
    for (const ds of this.ordered()) {
      if (this.entry(ds).source === "existing") await this.findExisting(ds);
    }
    for (const ds of this.ordered()) {
      const { source } = this.entry(ds);
      if ((source === "dummy" || source === "custom") && this.def(ds).role === "setup") {
        await this.createSetup(ds);
      }
    }
    for (const ds of this.createdOrder) {
      if (this.def(ds).state === "inactive") await this.deactivate(ds);
    }
  }

  /** Data sets of this test case in dependency order (Depends On first). */
  private ordered(): string[] {
    const out: string[] = [];
    const visiting = new Set<string>();
    const visit = (ds: string) => {
      if (out.includes(ds)) return;
      if (visiting.has(ds)) throw new SetupError(`Data sets depend on each other in a loop at ${ds}.`);
      visiting.add(ds);
      for (const dep of Object.keys(this.def(ds).dependsOn ?? {})) {
        if (dep in this.entries) visit(dep);
      }
      visiting.delete(ds);
      out.push(ds);
    };
    Object.keys(this.entries).forEach(visit);
    return out;
  }

  private async createSetup(ds: string) {
    const rec = this.state(ds);
    const adapter = this.adapter(ds);
    const values = rec.sent as FieldValues;
    this.say(`setup: create ${ds} in ${adapter.menu} ${JSON.stringify(values)}`);
    const where = new RecordPage(this.page, adapter.path);
    try {
      await adapter.create(this.page, values);
      this.own(ds, where.recordNoFromUrl(), values);
    } catch (e) {
      // The save may have gone through before the step that failed (e.g. the H6 check timed
      // out on the new detail view). When the detail URL of this menu is open, the record
      // exists: own it, so cleanup deletes it and the same values can be used again.
      const recordNo = this.tryRecordNo(where);
      if (recordNo) {
        this.own(ds, recordNo, values);
        this.say(`setup: ${ds} create step failed, but record ${recordNo} was saved: kept for cleanup`);
      } else {
        rec.note = `Create failed; if the record was saved anyway, delete ${adapter.menu} ${JSON.stringify(values)} by hand.`;
      }
      throw new SetupError(`${ds}: ${adapter.menu} create failed. ${(e as Error).message.split("\n")[0]}`);
    }
    this.say(`setup: ${ds} created as record ${rec.recordNo}`);
  }

  /** Record number of the open page, or undefined when it is not a detail view of this menu. */
  private tryRecordNo(where: RecordPage): string | undefined {
    try {
      return where.recordNoFromUrl();
    } catch {
      return undefined;
    }
  }

  /** Mark a record created by this run: cleanup deletes it by its record number. */
  private own(ds: string, recordNo: string, values: FieldValues) {
    const rec = this.state(ds);
    rec.recordNo = recordNo;
    rec.owned = true;
    rec.state = "active";
    rec.values = { ...values };
    if (!this.createdOrder.includes(ds)) this.createdOrder.push(ds);
  }

  /** FR-210: exactly one record with the identity key, in the state of Section 9.1. */
  private async findExisting(ds: string) {
    const rec = this.state(ds);
    const def = this.def(ds);
    const adapter = this.adapter(ds);
    const key = rec.sent as FieldValues;
    const want = def.state ?? "active";
    const keyText = Object.values(key).join(" / ");
    const env = this.setup.environment.toUpperCase();
    const where = new RecordPage(this.page, adapter.path);
    const cells = adapter.listKeyFields.filter((f) => f in key).map((f) => key[f]);
    if (!cells.length) throw new SetupError(`${ds} (existing): no identity key field of ${adapter.menu} can be found in the list.`);

    this.say(`setup: find existing ${ds} in ${adapter.menu} by ${JSON.stringify(key)}`);
    const rows = await where.findRows(cells, want === "inactive");
    const count = await rows.count();
    if (count !== 1) {
      const other = await (await where.findRows(cells, want !== "inactive")).count();
      if (count === 0 && other > 0) {
        throw new SetupError(`${ds} (existing): ${adapter.menu} ${keyText} in ${env} is not in state ${want === "active" ? "Active" : "Inactive"}.`);
      }
      throw new SetupError(
        count === 0
          ? `${ds} (existing): no ${adapter.menu} ${keyText} found in ${env}.`
          : `${ds} (existing): ${count} ${adapter.menu} records match ${keyText} in ${env}; the identity key must find one.`,
      );
    }
    await rows.first().click();
    rec.recordNo = where.recordNoFromUrl();
    rec.values = { ...key, ...(await where.readDetail(adapter.titleLabel, adapter.detailLabels)) };
    rec.state = want;
    rec.cleanup = "not_touched";
    this.say(`setup: ${ds} found as record ${rec.recordNo}`);
  }

  // ===================================================================
  // Test phase: what a test may do with the data
  // ===================================================================

  /** Test data of one data set of this test case. */
  get(ds: string): DataSetHandle {
    const rec = this.state(ds);
    const values = rec.values ?? this.valuesOf(ds);
    return {
      id: ds,
      source: rec.source,
      values,
      recordNo: rec.recordNo,
      value: (label: string) => {
        const v = values[label];
        if (v === undefined) {
          throw new SetupError(
            `${ds} (${rec.source}) has no value for "${label}"` +
              (rec.source === "dependency" ? " (only the identity value of a followed record is known)." : "."),
          );
        }
        return v;
      },
    };
  }

  private valuesOf(ds: string): FieldValues {
    const entry = this.entry(ds);
    if (entry.source === "dependency") return this.followed(ds, entry.follows);
    if (entry.source === "existing") return entry.key;
    return entry.values;
  }

  /**
   * FR-140: a dependency takes its identity value from the record it follows: the field of the
   * followed data set that points to it (dependsOn of the catalogue).
   */
  private followed(ds: string, follows: string): FieldValues {
    const field = this.def(follows).dependsOn?.[ds];
    if (!field) throw new SetupError(`${ds} follows ${follows}, but ${follows} does not depend on ${ds}.`);
    return { [this.adapter(ds).titleLabel]: this.get(follows).value(field) };
  }

  /**
   * The test created the record of `ds` (an Input data set) and its detail view is open.
   * Saves the record number and owns it, so cleanup deletes it.
   */
  async created(ds: string) {
    const rec = this.state(ds);
    if (rec.source !== "input" && rec.source !== "dummy" && rec.source !== "custom") {
      throw new SetupError(`${ds} is ${rec.source} data: the test must not create it.`);
    }
    const adapter = this.adapter(ds);
    rec.recordNo = new RecordPage(this.page, adapter.path).recordNoFromUrl();
    rec.owned = true;
    rec.gone = false;
    rec.state = "active";
    rec.values ??= { ...(rec.sent as FieldValues) };
    if (!this.createdOrder.includes(ds)) this.createdOrder.push(ds);
    this.say(`test: ${ds} created as record ${rec.recordNo}`);
  }

  /** Set an owned record to inactive. `on`: another page, as "another user". */
  async deactivate(ds: string, on: Page = this.page) {
    const rec = this.owned(ds, "deactivate");
    await new RecordPage(on, this.adapter(ds).path).deactivateRecord(rec.recordNo!);
    rec.state = "inactive";
    this.say(`${ds}: record ${rec.recordNo} set to inactive`);
  }

  /** Delete an owned record now, e.g. "another user deletes it". `on`: the other page. */
  async remove(ds: string, on: Page = this.page) {
    const rec = this.owned(ds, "delete");
    await new RecordPage(on, this.adapter(ds).path).deleteRecord(rec.recordNo!);
    rec.gone = true;
    rec.cleanup = "deleted";
    this.say(`${ds}: record ${rec.recordNo} deleted during the test`);
  }

  /** The test steps deleted the record through the menu under test (e.g. a Delete test case). */
  removedByTest(ds: string) {
    const rec = this.owned(ds, "delete");
    rec.gone = true;
    rec.cleanup = "deleted";
    this.say(`test: ${ds} record ${rec.recordNo} deleted by the test steps`);
  }

  private owned(ds: string, action: string): RecordState {
    const rec = this.state(ds);
    if (!rec.owned || !rec.recordNo) {
      throw new SetupError(
        `Refused to ${action} ${ds} (${rec.source}): only records created by this run can be changed. ` +
          `Mark the data set (mutates) in the FSD so TCMS sends it as dummy data.`,
      );
    }
    return rec;
  }

  // ===================================================================
  // Cleanup phase (FR-230, FR-235)
  // ===================================================================

  /** Delete owned records by record number, newest first. Never changes the result. */
  async cleanup() {
    if (this.dataMode !== "delete") {
      for (const ds of this.createdOrder) {
        const rec = this.records.get(ds)!;
        if (!rec.gone) rec.cleanup = "kept";
      }
      this.say(`cleanup: skipped (${this.dataMode}), ${this.kept().length} record(s) kept`);
      return;
    }
    for (const ds of [...this.createdOrder].reverse()) {
      const rec = this.records.get(ds)!;
      if (rec.gone) continue;
      try {
        await new RecordPage(this.page, this.adapter(ds).path).deleteRecord(rec.recordNo!);
        rec.cleanup = "deleted";
        this.say(`cleanup: ${ds} record ${rec.recordNo} deleted`);
      } catch (e) {
        rec.cleanup = "failed";
        rec.note = `Left in Lumina: ${rec.menu} record ${rec.recordNo}. ${(e as Error).message.split("\n")[0]}`;
        this.say(`cleanup: ${ds} record ${rec.recordNo} FAILED: ${rec.note}`);
      }
    }
  }

  kept(): RecordState[] {
    return [...this.records.values()].filter((r) => r.cleanup === "kept");
  }

  cleanupStatus(): "done" | "failed" | "kept" | "none" {
    const rows = [...this.records.values()];
    if (rows.some((r) => r.cleanup === "failed")) return "failed";
    if (rows.some((r) => r.cleanup === "kept")) return "kept";
    return this.createdOrder.length ? "done" : "none";
  }

  /** Data snapshot of FR-240, one row per data set of the test case. */
  snapshot(): SnapshotRow[] {
    return [...this.records.values()].map((r) => ({
      dataSet: r.ds,
      menu: r.menu,
      source: r.source,
      valuesSent: r.sent,
      record: r.source === "existing" ? r.values ?? null : null,
      luminaRecordNo: r.recordNo ?? null,
      state: r.state ?? null,
      cleanup: r.cleanup === "none" && r.source === "existing" ? "not_touched" : r.cleanup,
      note: r.note,
    }));
  }
}