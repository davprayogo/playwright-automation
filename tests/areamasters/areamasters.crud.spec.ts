/**
 * MOM-98 Area Masters — Happy path automation (FSD Section 9).
 *
 * Scope: positive UI cases only. Not automated here:
 *  - 002, 003 (Custom Filter / Quick Search: no BasePage function yet)
 *  - 004, 007, 019, 038 (server error simulation)
 *  - 006, 010–012, 016, 017, 023 (negative / validation)
 *  - 026, 027, 035–037 (concurrency, child records)
 *  - 028–031 (active/inactive process), 039–043 (authorization / API)
 *
 * Test data is created via UI with a unique suffix, then cleaned up in afterEach.
 * Login is expected from the Playwright config (storageState).
 * Evidence: each test ends with attachScreenshot() — only reached when every step passed.
 */
import { test } from "@playwright/test";
import { AreaMastersPage } from "@pages/AreaMastersPage";
import type { AreaMaster } from "@data/wms/areaMaster";
import { attachScreenshot } from "@utils/screenshot";

const uid = () =>
  (Date.now().toString(36) + Math.random().toString(36).slice(2, 4))
    .slice(-6)
    .toUpperCase();
/** 7 chars, under the 10-char Factory limit, unique per call. */
const factoryCode = () => `F${uid()}`;

test.describe("MOM-98 Area Masters - Happy Path", () => {
  let areaPage: AreaMastersPage;
  let created: string[];

  const createArea = async (data: AreaMaster) => {
    await areaPage.open();
    await areaPage.create(data);
    created.push(data.name.trim());
  };
  const rename = (oldName: string, newName: string) => {
    created = created.filter((n) => n !== oldName).concat(newName);
  };
  const untrack = (...names: string[]) => {
    created = created.filter((n) => !names.includes(n));
  };

  test.beforeEach(async ({ page }) => {
    areaPage = new AreaMastersPage(page);
    created = [];
  });

  test.afterEach(async () => {
    if (!created.length) return;
    try {
      await areaPage.open();
      await areaPage.delete([...new Set(created)]);
    } catch (e) {
      console.warn(`Cleanup failed for: ${created.join(", ")}`, e);
    }
  });

  // ---------- 9.1 List and Area Page ----------

  test("TC-MOM98-001 List loads with the FSD columns", async ({ page }, testInfo) => {
    test.info().annotations.push({
      type: "partial",
      description:
        "Inactive area hidden by default is not checked: needs the active/inactive process.",
    });
    await areaPage.open();
    await areaPage.expectListColumns([
      "Factory",
      "Name",
      "Floor",
      "Division",
      "Description",
      "Remark",
      "Active",
    ]);

    await attachScreenshot(page, testInfo, "Area Masters - TC-MOM98-001 List view");
  });

  test("TC-MOM98-005 Open an area shows every field", async ({ page }, testInfo) => {
    const data: AreaMaster = {
      factory: factoryCode(),
      name: `PROD LINE 1 ${uid()}`,
      floor: "1",
      division: "SMT",
      description: "Line 1",
      remark: "Main line",
    };
    await createArea(data);

    await areaPage.openDetail(data.name); // H6 title = Name
    await areaPage.expectDetail(data);

    await attachScreenshot(page, testInfo, "Area Masters - TC-MOM98-005 Detail view");
  });

  // ---------- 9.2 Create ----------

  test("TC-MOM98-008 Create an area with all fields", async ({ page }, testInfo) => {
    const data: AreaMaster = {
      factory: factoryCode(),
      name: `PROD LINE 2 ${uid()}`,
      floor: "16#5",
      division: "SMT",
      description: "Line 2 floor",
      remark: "New",
    };
    await createArea(data); // asserts H6 title = Name
    await areaPage.expectDetail(data); // Floor 16#5 accepted as entered
    await attachScreenshot(page, testInfo, "Area Masters - TC-MOM98-008 Step 3 Detail view setelah Create");

    await areaPage.open();
    await areaPage.expectInList(data.name, data.factory);

    await attachScreenshot(page, testInfo, "Area Masters - TC-MOM98-008 Step 4 List view setelah Create");
  });

  test("TC-MOM98-009 Create an area with mandatory fields only", async ({ page }, testInfo) => {
    const data: AreaMaster = { factory: factoryCode(), name: `QC 2 ${uid()}` };
    await createArea(data);

    await areaPage.openDetail(data.name);
    await areaPage.expectDetail({
      ...data,
      floor: "",
      division: "",
      description: "",
      remark: "",
    });

    await attachScreenshot(page, testInfo, "Area Masters - TC-MOM98-009 Detail view setelah Create");
  });

  test("TC-MOM98-013 Factory and Name are saved trimmed", async ({ page }, testInfo) => {
    const factory = factoryCode();
    const name = `QC 4 ${uid()}`;
    await createArea({ factory: ` ${factory} `, name: ` ${name} ` });

    await areaPage.openDetail(name); // H6 title = trimmed Name
    await areaPage.expectDetail({ factory, name });

    await attachScreenshot(page, testInfo, "Area Masters - TC-MOM98-013 Detail view setelah Create");
  });

  test("TC-MOM98-014 Factory is saved with the existing spelling on create", async ({ page }, testInfo) => {
    const factory = factoryCode();
    const id = uid();
    await createArea({ factory, name: `MAIN STORE ${id}` });
    await createArea({ factory: factory.toLowerCase(), name: `QC 5 ${id}` });

    await areaPage.open();
    await areaPage.expectInList(`QC 5 ${id}`, factory);

    await attachScreenshot(page, testInfo, "Area Masters - TC-MOM98-014 List view setelah Create");
  });

  test("TC-MOM98-015 A new factory is saved as entered", async ({ page }, testInfo) => {
    const factory = factoryCode().toLowerCase();
    const name = `QC 9 ${uid()}`;
    await createArea({ factory, name });

    await areaPage.openDetail(name);
    await areaPage.expectDetail({ factory }); // saved as entered (lowercase)

    await attachScreenshot(page, testInfo, "Area Masters - TC-MOM98-015 Detail view setelah Create");
  });

  test("TC-MOM98-018 Same name in two factories is allowed", async ({ page }, testInfo) => {
    const f1 = factoryCode();
    const f2 = factoryCode();
    const name = `MAIN STORE ${uid()}`;
    await createArea({ factory: f1, name });
    await createArea({ factory: f2, name });

    await areaPage.open();
    await areaPage.expectInList(name, f1);
    await areaPage.expectInList(name, f2);

    await attachScreenshot(page, testInfo, "Area Masters - TC-MOM98-018 List view setelah Create");
  });

  // ---------- 9.3 Edit ----------

  test("TC-MOM98-020 Edit the name and the division", async ({ page }, testInfo) => {
    const id = uid();
    const oldName = `QC ${id}`;
    const newName = `QC AREA ${id}`;
    await createArea({ factory: factoryCode(), name: oldName });

    await areaPage.open();
    await areaPage.update(oldName, { name: newName, division: "QA" });
    rename(oldName, newName);

    await areaPage.openDetail(newName); // H6 title = new Name
    await areaPage.expectDetail({ name: newName, division: "QA" });

    await attachScreenshot(page, testInfo, "Area Masters - TC-MOM98-020 Detail view setelah Update");
  });

  test("TC-MOM98-021 Edit without changing the name is not a duplicate", async ({ page }, testInfo) => {
    const data: AreaMaster = { factory: factoryCode(), name: `MAIN STORE ${uid()}` };
    await createArea(data);

    await areaPage.open();
    await areaPage.update(data.name, { remark: "Updated" }); // asserts no Duplicate Record modal

    await areaPage.openDetail(data.name); // H6 title = Name
    await areaPage.expectDetail({ ...data, remark: "Updated" });

    await attachScreenshot(page, testInfo, "Area Masters - TC-MOM98-021 Detail view setelah Update");
  });

  test("TC-MOM98-022 Change only the case of the area's own name", async ({ page }, testInfo) => {
    const id = uid().toLowerCase();
    const oldName = `Main Store ${id}`;
    const newName = oldName.toUpperCase();
    await createArea({ factory: factoryCode(), name: oldName });

    await areaPage.open();
    await areaPage.update(oldName, { name: newName });
    rename(oldName, newName);

    await areaPage.openDetail(newName); // H6 title, exact case
    await areaPage.expectDetail({ name: newName });

    await attachScreenshot(page, testInfo, "Area Masters - TC-MOM98-022 Detail view setelah Update");
  });

  test("TC-MOM98-024 Factory is saved with the existing spelling on edit", async ({ page }, testInfo) => {
    const f1 = factoryCode();
    const f2 = factoryCode();
    const id = uid();
    const name = `QC 6 ${id}`;
    await createArea({ factory: f1, name });
    await createArea({ factory: f2, name: `MAIN STORE ${id}` });

    await areaPage.open();
    await areaPage.update(name, { factory: f2.toLowerCase() });

    await areaPage.openDetail(name);
    await areaPage.expectDetail({ factory: f2 }); // existing spelling

    await attachScreenshot(page, testInfo, "Area Masters - TC-MOM98-024 Detail view setelah Update");
  });

  test("TC-MOM98-025 On edit, the area itself is not used for the factory spelling", async ({ page }, testInfo) => {
    const factoryLower = factoryCode().toLowerCase();
    const name = `QC 7 ${uid()}`;
    await createArea({ factory: factoryLower, name });

    await areaPage.open();
    await areaPage.update(name, { factory: factoryLower.toUpperCase() });

    await areaPage.openDetail(name);
    await areaPage.expectDetail({ factory: factoryLower.toUpperCase() });

    await attachScreenshot(page, testInfo, "Area Masters - TC-MOM98-025 Detail view setelah Update");
  });

  // ---------- 9.5 Delete ----------

  test("TC-MOM98-032 Delete unused areas from the list", async ({ page }, testInfo) => {
    test.info().annotations.push({
      type: "partial",
      description:
        "Step 4 (Custom Filter Active = No) not automated: no BasePage filter function yet.",
    });
    const id = uid();
    const names = [`TEMP ${id}`, `TEMP 2 ${id}`];
    const factory = factoryCode();
    for (const name of names) await createArea({ factory, name });

    await areaPage.open();
    await areaPage.delete(names, { confirmMessage: "Delete 2 Records?" });
    untrack(...names);

    await attachScreenshot(page, testInfo, "Area Masters - TC-MOM98-032 List view setelah Delete");
  });

  test("TC-MOM98-033 Delete an unused area from the area page", async ({ page }, testInfo) => {
    const name = `TEMP 3 ${uid()}`;
    await createArea({ factory: factoryCode(), name });

    await areaPage.deleteFromDetail(name);
    untrack(name);

    await attachScreenshot(page, testInfo, "Area Masters - TC-MOM98-033 List view setelah Delete");
  });

  test("TC-MOM98-034 Cancel the delete confirmation", async ({ page }, testInfo) => {
    const name = `TEMP 4 ${uid()}`;
    await createArea({ factory: factoryCode(), name });

    await areaPage.open();
    await areaPage.cancelDelete([name]);

    await attachScreenshot(page, testInfo, "Area Masters - TC-MOM98-034 List view setelah Cancel Delete");
  });
});
