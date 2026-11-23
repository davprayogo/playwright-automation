import type { Page } from "@playwright/test";
import { AreaMastersPage } from "@pages/AreaMastersPage";
import { ProcessMastersPage } from "@pages/ProcessMastersPage";
import { StorageLocationsPage } from "@pages/StorageLocationsPage";
import type { AreaMaster } from "@data/wms/areaMaster";

/** A storage location made for the test, with the area data a line shows for it. */
export interface StorageLocationRef {
  name: string;
  area: string;
  factory: string;
  floor: string;
  division: string;
}

/**
 * Process masters a test can ask for. "main" for normal lines; "spare" to deactivate
 * (inactive reference cases) without touching the main one.
 */
export type PmKey = "main" | "spare";

/**
 * Storage locations a test can ask for.
 * Area A (factory A): line1, repair1, repair2, spare1, spare2. spare* are meant to be deactivated.
 * Area B (another factory): line2.
 * Area C: areaC, for the "area of the storage location is inactive" case (area C gets deactivated).
 */
export type SlocKey =
  | "line1"
  | "line2"
  | "repair1"
  | "repair2"
  | "spare1"
  | "spare2"
  | "areaC";

export type AreaKey = "A" | "B" | "C";

const SLOC_AREA: Record<SlocKey, AreaKey> = {
  line1: "A",
  line2: "B",
  repair1: "A",
  repair2: "A",
  spare1: "A",
  spare2: "A",
  areaC: "C",
};

const SLOC_NAME: Record<SlocKey, string> = {
  line1: "LINE 1 SLOC",
  line2: "LINE 2 SLOC",
  repair1: "REPAIR 1 SLOC",
  repair2: "REPAIR 2 SLOC",
  spare1: "SPARE 1 SLOC",
  spare2: "SPARE 2 SLOC",
  areaC: "AREA C SLOC",
};

const PM_NAME: Record<PmKey, string> = { main: "PM", spare: "PM SPARE" };

const uid = () =>
  (Date.now().toString(36) + Math.random().toString(36).slice(2, 4))
    .slice(-6)
    .toUpperCase();

/**
 * Reference data for one Production Line test, made through the UI on first use:
 * Area -> Storage Location, and Process Master. Each record is made once per test
 * and gets the same unique suffix.
 *
 * deactivate*() set a record to Active No through the general active/inactive process
 * (BasePage.deactivate), optionally from another page ("another user").
 * cleanup() deletes everything in reverse order; inactive records are deleted from the
 * list filtered with showInactiveOnly(), because the default list hides them.
 * Delete the production lines first: a used storage location or process cannot be deleted.
 */
export class ProductionLineRefs {
  private readonly id = uid();
  private readonly areaPage: AreaMastersPage;
  private readonly slocPage: StorageLocationsPage;
  private readonly pmPage: ProcessMastersPage;

  private readonly pms = new Map<PmKey, string>();
  private readonly areas = new Map<AreaKey, AreaMaster>();
  private readonly slocs = new Map<SlocKey, StorageLocationRef>();

  private readonly inactivePms = new Set<PmKey>();
  private readonly inactiveAreas = new Set<AreaKey>();
  private readonly inactiveSlocs = new Set<SlocKey>();

  constructor(page: Page) {
    this.areaPage = new AreaMastersPage(page);
    this.slocPage = new StorageLocationsPage(page);
    this.pmPage = new ProcessMastersPage(page);
  }

  // ---------- Make on first use ----------

  /** Active process master (MOM-67). */
  async processMaster(key: PmKey = "main"): Promise<string> {
    const cached = this.pms.get(key);
    if (cached) return cached;
    const name = `${PM_NAME[key]} ${this.id}`;
    await this.pmPage.open();
    await this.pmPage.create({ name, description: "Automation MOM-99" });
    this.pms.set(key, name);
    return name;
  }

  /** Active storage location (MOM-113) in an active area (MOM-98). */
  async storageLocation(key: SlocKey): Promise<StorageLocationRef> {
    const cached = this.slocs.get(key);
    if (cached) return cached;

    const area = await this.area(SLOC_AREA[key]);
    const name = `${SLOC_NAME[key]} ${this.id}`;
    await this.slocPage.open();
    await this.slocPage.create({ area: area.name, name });

    const ref: StorageLocationRef = {
      name,
      area: area.name,
      factory: area.factory,
      floor: area.floor ?? "",
      division: area.division ?? "",
    };
    this.slocs.set(key, ref);
    return ref;
  }

  // ---------- Deactivate (general active/inactive process) ----------

  /** Set a process master to Active No. `on`: another page, as "another user". */
  async deactivateProcessMaster(key: PmKey, on?: Page) {
    const name = await this.processMaster(key);
    const pmPage = on ? new ProcessMastersPage(on) : this.pmPage;
    await pmPage.open();
    await pmPage.deactivate("Name", [name]);
    this.inactivePms.add(key);
  }

  /** Set a storage location to Active No. `on`: another page, as "another user". */
  async deactivateStorageLocation(key: SlocKey, on?: Page) {
    const { name } = await this.storageLocation(key);
    const slocPage = on ? new StorageLocationsPage(on) : this.slocPage;
    await slocPage.open();
    await slocPage.deactivate("Name", [name]);
    this.inactiveSlocs.add(key);
  }

  /** Set the area of a storage location to Active No (the storage location stays active). */
  async deactivateAreaOf(key: SlocKey, on?: Page) {
    await this.storageLocation(key);
    const areaKey = SLOC_AREA[key];
    const area = this.areas.get(areaKey)!;
    const areaPage = on ? new AreaMastersPage(on) : this.areaPage;
    await areaPage.open();
    await areaPage.deactivate("Name", [area.name]);
    this.inactiveAreas.add(areaKey);
  }

  /**
   * Delete one storage location from another page (a second user), e.g. while a
   * line form that selected it is still open. It is then left out of cleanup().
   */
  async deleteStorageLocationFrom(page: Page, key: SlocKey) {
    const ref = this.slocs.get(key);
    if (!ref) throw new Error(`Storage location "${key}" was not made in this test.`);
    const other = new StorageLocationsPage(page);
    await other.open();
    await other.delete([ref.name]);
    this.slocs.delete(key);
    this.inactiveSlocs.delete(key);
  }

  // ---------- Cleanup ----------

  /**
   * Delete storage locations, then areas, then process masters. Active records from the
   * default list; inactive records from the list filtered with showInactiveOnly().
   * Logs and continues on failure.
   */
  async cleanup() {
    await this.deleteGroup(
      "storage locations",
      this.split(this.slocs, this.inactiveSlocs, (s) => s.name),
      async (names, inactive) => {
        await this.slocPage.open();
        if (inactive) await this.slocPage.showInactiveOnly();
        await this.slocPage.delete(names);
      },
    );
    await this.deleteGroup(
      "areas",
      this.split(this.areas, this.inactiveAreas, (a) => a.name),
      async (names, inactive) => {
        await this.areaPage.open();
        if (inactive) await this.areaPage.showInactiveOnly();
        await this.areaPage.delete(names);
      },
    );
    await this.deleteGroup(
      "process masters",
      this.split(this.pms, this.inactivePms, (name) => name),
      async (names, inactive) => {
        await this.pmPage.open();
        if (inactive) await this.pmPage.showInactiveOnly();
        await this.pmPage.delete(names);
      },
    );
  }

  // ---------- Helpers ----------

  private async area(key: AreaKey): Promise<AreaMaster> {
    const cached = this.areas.get(key);
    if (cached) return cached;

    const data: AreaMaster = {
      factory: `F${key}${this.id}`, // 8 chars, under the 10-char limit
      name: `PL AREA ${key} ${this.id}`,
      floor: "1",
      division: "SMT",
    };
    await this.areaPage.open();
    await this.areaPage.create(data);
    this.areas.set(key, data);
    return data;
  }

  /** Names of the records made, split into active and inactive. */
  private split<K, V>(made: Map<K, V>, inactive: Set<K>, nameOf: (v: V) => string) {
    const active: string[] = [];
    const off: string[] = [];
    for (const [key, value] of made) (inactive.has(key) ? off : active).push(nameOf(value));
    return { active, inactive: off };
  }

  private async deleteGroup(
    what: string,
    names: { active: string[]; inactive: string[] },
    run: (names: string[], inactive: boolean) => Promise<void>,
  ) {
    for (const [list, inactive] of [
      [names.active, false],
      [names.inactive, true],
    ] as const) {
      if (!list.length) continue;
      try {
        await run(list, inactive);
      } catch (e) {
        console.warn(`Cleanup failed for ${inactive ? "inactive " : ""}${what}: ${list.join(", ")}`, e);
      }
    }
  }
}