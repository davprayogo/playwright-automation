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
 * Storage locations a test can ask for.
 * line1, repair1, repair2: in area A (factory 1). line2: in area B (another factory).
 */
export type SlocKey = "line1" | "line2" | "repair1" | "repair2";

type AreaKey = "A" | "B";

const SLOC_AREA: Record<SlocKey, AreaKey> = {
  line1: "A",
  line2: "B",
  repair1: "A",
  repair2: "A",
};

const SLOC_NAME: Record<SlocKey, string> = {
  line1: "LINE 1 SLOC",
  line2: "LINE 2 SLOC",
  repair1: "REPAIR 1 SLOC",
  repair2: "REPAIR 2 SLOC",
};

/**
 * Inactive records cannot be made through the UI (the active/inactive process
 * is not automated). Set these to existing inactive records to run that check.
 */
export const INACTIVE_REFS = {
  processMaster: process.env.PLM_INACTIVE_PROCESS_MASTER,
  storageLocation: process.env.PLM_INACTIVE_SLOC,
};

const uid = () =>
  (Date.now().toString(36) + Math.random().toString(36).slice(2, 4))
    .slice(-6)
    .toUpperCase();

/**
 * Reference data for one Production Line test, made through the UI on first use:
 * Area -> Storage Location, and Process Master. Each record is made once per test
 * and gets the same unique suffix. cleanup() deletes them in reverse order.
 * Delete the production lines first: a used storage location or process cannot be deleted.
 */
export class ProductionLineRefs {
  private readonly id = uid();
  private readonly areaPage: AreaMastersPage;
  private readonly slocPage: StorageLocationsPage;
  private readonly pmPage: ProcessMastersPage;

  private pm?: string;
  private readonly areas = new Map<AreaKey, AreaMaster>();
  private readonly slocs = new Map<SlocKey, StorageLocationRef>();

  constructor(page: Page) {
    this.areaPage = new AreaMastersPage(page);
    this.slocPage = new StorageLocationsPage(page);
    this.pmPage = new ProcessMastersPage(page);
  }

  /** Active process master (MOM-67). */
  async processMaster(): Promise<string> {
    if (!this.pm) {
      const name = `PM ${this.id}`;
      await this.pmPage.open();
      await this.pmPage.create({ name, description: "Automation MOM-99" });
      this.pm = name;
    }
    return this.pm;
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

  /**
   * Delete one storage location from another page (a second user), e.g. while a
   * line form that selected it is still open. It is then left out of cleanup().
   */
  async deleteStorageLocationFrom(page: Page, key: SlocKey) {
    const ref = this.slocs.get(key);
    if (!ref)
      throw new Error(`Storage location "${key}" was not made in this test.`);
    const other = new StorageLocationsPage(page);
    await other.open();
    await other.delete([ref.name]);
    this.slocs.delete(key);
  }

  /** Delete storage locations, then areas, then the process master. Logs and continues on failure. */
  async cleanup() {
    const slocs = [...this.slocs.values()].map((s) => s.name);
    const areas = [...this.areas.values()].map((a) => a.name);
    await this.tryDelete("storage locations", slocs, async () => {
      await this.slocPage.open();
      await this.slocPage.delete(slocs);
    });
    await this.tryDelete("areas", areas, async () => {
      await this.areaPage.open();
      await this.areaPage.delete(areas);
    });
    const pms = this.pm ? [this.pm] : [];
    await this.tryDelete("process masters", pms, async () => {
      await this.pmPage.open();
      await this.pmPage.delete(pms);
    });
  }

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

  private async tryDelete(
    what: string,
    names: string[],
    run: () => Promise<void>,
  ) {
    if (!names.length) return;
    try {
      await run();
    } catch (e) {
      console.warn(`Cleanup failed for ${what}: ${names.join(", ")}`, e);
    }
  }
}
