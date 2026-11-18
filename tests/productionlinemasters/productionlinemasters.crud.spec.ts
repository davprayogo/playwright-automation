/**
 * MOM-99 Production Line Masters — Happy path automation (FSD Section 9).
 *
 * Scope: positive UI cases whose data can be made through the UI.
 * Automated: 001, 004, 007, 008, 009, 011, 012, 015, 017, 023, 024, 027, 030, 036, 037, 038
 * (001, 004, 017, 024, 027, 036 and 038 are partial: see the annotation in each test).
 *
 * Not automated here:
 *  - 002 (Custom Filter: no BasePage function yet)
 *  - 003, 022, 035 (changes in other menus after the line is saved, or Workstation Masters)
 *  - 005, 006, 016, 042 (server / database error simulation)
 *  - 010, 013, 014, 025, 026, 028, 029, 031, 032 (negative / validation: no BasePage
 *    function for inline errors or messages yet; API cases need an API client)
 *  - 018–021 (a second user deactivates or deletes a reference)
 *  - 033, 034, 041 (concurrency: a second user)
 *  - 039, 040 (lines used by work order schedules, workstations or material allocation lines)
 *  - 043 (export download: no BasePage function yet)
 *  - 044–050 (authorization: other roles / API)
 *
 * Test data: every test makes its own reference data through the UI, on first use
 * (ProductionLineRefs: Area -> Storage Location, and Process Master), then its lines.
 * afterEach deletes the lines first, then the reference data.
 * Login is expected from the Playwright config (storageState).
 * Evidence: each test ends with attachScreenshot() — only reached when every step passed.
 */
import { test } from "@playwright/test";
import {
  PLM_LIST_COLUMNS,
  ProductionLineMastersPage,
} from "@pages/ProductionLineMastersPages";
import type { ProductionLineMaster } from "@data/masterdata/ProductionLineMasters";
import { attachScreenshot } from "@utils/screenshot";
import {
  INACTIVE_REFS,
  ProductionLineRefs,
  type SlocKey,
} from "@fixtures/ProductionLineRefs";

const uid = () =>
  (Date.now().toString(36) + Math.random().toString(36).slice(2, 4))
    .slice(-6)
    .toUpperCase();

const shot = (step: string) => `Production Line Masters - ${step}`;

/** Line fields a test may set; references are chosen by key and made on first use. */
type LineOpts = Partial<
  Omit<
    ProductionLineMaster,
    "processMaster" | "storageLocation" | "repairStorageLocation"
  >
> & { sloc?: SlocKey; repair?: SlocKey };

test.describe("MOM-99 Production Line Masters - Happy Path", () => {
  let plPage: ProductionLineMastersPage;
  let refs: ProductionLineRefs;
  let created: string[];

  /** A valid line. Line No `L` + 6 chars stays under the 10-char limit. Storage location default: line2. */
  const newLine = async ({
    sloc = "line2",
    repair,
    ...overrides
  }: LineOpts = {}): Promise<ProductionLineMaster> => {
    const id = uid();
    return {
      code: `PL-${id}`,
      name: `SMT ${id}`,
      lineNo: `L${id}`,
      processMaster: await refs.processMaster(),
      storageLocation: (await refs.storageLocation(sloc)).name,
      ...(repair
        ? { repairStorageLocation: (await refs.storageLocation(repair)).name }
        : {}),
      ...overrides,
    };
  };

  const createLine = async (data: ProductionLineMaster) => {
    await plPage.open();
    await plPage.create(data);
    created.push(data.code.trim());
  };
  const untrack = (...codes: string[]) => {
    created = created.filter((c) => !codes.includes(c));
  };
  const partial = (description: string) =>
    test.info().annotations.push({ type: "partial", description });

  test.beforeEach(async ({ page }) => {
    plPage = new ProductionLineMastersPage(page);
    refs = new ProductionLineRefs(page);
    created = [];
  });

  test.afterEach(async () => {
    // Lines first: a storage location or process master in use cannot be deleted.
    if (created.length) {
      try {
        await plPage.open();
        await plPage.delete([...new Set(created)]);
      } catch (e) {
        console.warn(`Cleanup failed for lines: ${created.join(", ")}`, e);
      }
    }
    await refs.cleanup();
  });

  // ---------- 9.1 List and Detail ----------

  test("TC-MOM99-001 The list shows active lines with storage location and area data", async ({
    page,
  }, testInfo) => {
    partial(
      "Inactive line hidden by default is not checked: needs the active/inactive process.",
    );
    const data = await newLine({
      sloc: "line1",
      repair: "repair1",
      externalCode: "EXT-01",
    });
    await createLine(data);
    const sloc = await refs.storageLocation("line1");

    await plPage.open();
    await plPage.expectListColumns([...PLM_LIST_COLUMNS]);
    // Area data comes from Storage Location, not from Repair Storage Location.
    await plPage.expectListValues(data.code, {
      Name: data.name,
      "Line No": data.lineNo,
      "Storage Location": sloc.name,
      Area: sloc.area,
      Factory: sloc.factory,
      Floor: sloc.floor,
      Division: sloc.division,
      "Repair Storage Location": data.repairStorageLocation,
      "Process Master": data.processMaster,
      "External Code": "EXT-01",
      "Two Step Transfer": "No",
      "Auto Transfer to Repair": "No",
      Active: "Yes",
    });

    await attachScreenshot(page, testInfo, shot("TC-MOM99-001 List view"));
  });

  test("TC-MOM99-004 The detail page shows every field, and Code is read only", async ({
    page,
  }, testInfo) => {
    partial(
      "Area, Factory, Floor, Division and Active read only in Edit is not checked: they have no input locator.",
    );
    const data = await newLine({
      sloc: "line1",
      repair: "repair1",
      externalCode: "EXT-04",
    });
    await createLine(data);
    const sloc = await refs.storageLocation("line1");

    await plPage.openDetail(data.code);
    await plPage.expectDetail({
      ...data,
      area: sloc.area,
      factory: sloc.factory,
      floor: sloc.floor,
      division: sloc.division,
    });
    await attachScreenshot(
      page,
      testInfo,
      shot("TC-MOM99-004 Step 1 Detail view"),
    );

    await plPage.clickEdit();
    await plPage.expectCodeReadOnly();

    await attachScreenshot(
      page,
      testInfo,
      shot("TC-MOM99-004 Step 3 Detail view"),
    );
  });

  // ---------- 9.2 Create ----------

  test("TC-MOM99-007 Create a line with all fields", async ({
    page,
  }, testInfo) => {
    const data = await newLine({ repair: "repair1", externalCode: "EXT-02" });
    const sloc = await refs.storageLocation("line2");
    await createLine(data); // asserts H6 title = Code
    await plPage.expectDetail({
      ...data,
      area: sloc.area,
      factory: sloc.factory,
      floor: sloc.floor,
      division: sloc.division,
    });
    await attachScreenshot(
      page,
      testInfo,
      shot("TC-MOM99-007 Step 4 Detail view setelah Create"),
    );

    await plPage.open();
    await plPage.expectListValues(data.code, {
      Name: data.name,
      Area: sloc.area,
      Factory: sloc.factory,
      Active: "Yes",
    });

    await attachScreenshot(
      page,
      testInfo,
      shot("TC-MOM99-007 Step 5 List view setelah Create"),
    );
  });

  test("TC-MOM99-008 Default values on New, and Repair Storage Location is optional", async ({
    page,
  }, testInfo) => {
    const data = await newLine();
    await plPage.open();
    await plPage.startCreate(data); // toggles not touched
    await plPage.expectFormToggles({
      productionLine: true,
      twoStepTransfer: false,
      autoTransferToRepair: false,
    });
    await plPage.saveNew(data.code);
    created.push(data.code);

    await plPage.expectDetail({ repairStorageLocation: "", externalCode: "" });
    await attachScreenshot(
      page,
      testInfo,
      shot("TC-MOM99-008 Step 4 Detail view setelah Create"),
    );

    await plPage.open();
    await plPage.expectListValues(data.code, {
      "Two Step Transfer": "No",
      "Auto Transfer to Repair": "No",
      Active: "Yes",
    });
    // Production Line is not a list column (FSD 7.5): read it on the Edit form.
    await plPage.expectSavedToggles(data.code, { productionLine: true });

    await attachScreenshot(
      page,
      testInfo,
      shot("TC-MOM99-008 Step 5 Detail view setelah Create"),
    );
  });

  test("TC-MOM99-009 Create a line with non-default toggle values", async ({
    page,
  }, testInfo) => {
    const data = await newLine({
      repair: "repair1",
      productionLine: false,
      twoStepTransfer: true,
      autoTransferToRepair: true,
    });
    await createLine(data);

    await plPage.open();
    await plPage.expectListValues(data.code, {
      "Two Step Transfer": "Yes",
      "Auto Transfer to Repair": "Yes",
      "Repair Storage Location": data.repairStorageLocation,
    });
    await plPage.expectSavedToggles(data.code, {
      productionLine: false,
      twoStepTransfer: true,
      autoTransferToRepair: true,
    });

    await attachScreenshot(
      page,
      testInfo,
      shot("TC-MOM99-009 Detail view setelah Create"),
    );
  });

  test("TC-MOM99-011 Code, Name and Line No are saved trimmed", async ({
    page,
  }, testInfo) => {
    const data = await newLine();
    await createLine({
      ...data,
      code: ` ${data.code} `,
      name: ` ${data.name} `,
      lineNo: ` ${data.lineNo} `, // 9 chars with the spaces, under the 10-char limit
    });

    await plPage.openDetail(data.code); // H6 title = trimmed Code
    await plPage.expectDetail({
      code: data.code,
      name: data.name,
      lineNo: data.lineNo,
    });

    await attachScreenshot(
      page,
      testInfo,
      shot("TC-MOM99-011 Detail view setelah Create"),
    );
  });

  test("TC-MOM99-012 Text fields stop accepting characters at their maximum length", async ({
    page,
  }, testInfo) => {
    const base = await newLine();
    const typed = {
      code: base.code.padEnd(51, "X"),
      name: base.name.padEnd(101, "N"),
      lineNo: "L".padEnd(11, "1"),
      externalCode: "EXT-".padEnd(101, "E"),
    };
    const kept = {
      code: typed.code.slice(0, 50),
      name: typed.name.slice(0, 100),
      lineNo: typed.lineNo.slice(0, 10),
      externalCode: typed.externalCode.slice(0, 100),
    };

    await plPage.open();
    await plPage.startCreate({ ...base, ...typed }, { typeText: true });
    await plPage.expectFormValues(kept);
    await attachScreenshot(
      page,
      testInfo,
      shot("TC-MOM99-012 Step 2 Detail view"),
    );

    await plPage.saveNew(kept.code);
    created.push(kept.code);
    await plPage.expectDetail(kept);

    await attachScreenshot(
      page,
      testInfo,
      shot("TC-MOM99-012 Step 5 Detail view setelah Create"),
    );
  });

  test("TC-MOM99-015 Name, Line No and External Code can repeat", async ({
    page,
  }, testInfo) => {
    const first = await newLine({ externalCode: `EXT-${uid()}` });
    const second = await newLine({
      name: first.name,
      lineNo: first.lineNo,
      externalCode: first.externalCode,
    });
    await createLine(first);
    await createLine(second);

    await plPage.open();
    for (const code of [first.code, second.code]) {
      await plPage.expectListValues(code, {
        Name: first.name,
        "Line No": first.lineNo,
        "External Code": first.externalCode,
      });
    }

    await attachScreenshot(
      page,
      testInfo,
      shot("TC-MOM99-015 List view setelah Create"),
    );
  });

  // ---------- 9.3 Process Master, Storage Location and Repair Storage Location ----------

  test("TC-MOM99-017 Comboboxes show active records only, by name", async ({
    page,
  }, testInfo) => {
    const pm = await refs.processMaster();
    const sloc = await refs.storageLocation("line1");
    const repair = await refs.storageLocation("repair1");
    const inactivePm = INACTIVE_REFS.processMaster;
    const inactiveSloc = INACTIVE_REFS.storageLocation;
    if (!inactivePm || !inactiveSloc) {
      partial(
        "Inactive records hidden is not checked: set PLM_INACTIVE_PROCESS_MASTER and PLM_INACTIVE_SLOC to existing inactive records.",
      );
    }

    await plPage.open();
    await plPage.openCreatePage();
    await plPage.expectReferenceOptions("processMaster", pm, inactivePm);
    await plPage.expectReferenceOptions(
      "storageLocation",
      sloc.name,
      inactiveSloc,
    );
    await plPage.expectReferenceOptions(
      "repairStorageLocation",
      repair.name,
      inactiveSloc,
    );

    await attachScreenshot(
      page,
      testInfo,
      shot("TC-MOM99-017 Detail view (New)"),
    );
  });

  test("TC-MOM99-023 One storage location serves many lines, as storage location and as repair storage location", async ({
    page,
  }, testInfo) => {
    const first = await newLine({ sloc: "line1", repair: "repair1" });
    const second = await newLine({ sloc: "line1", repair: "repair1" });
    await createLine(first);
    await createLine(second);

    await plPage.open();
    for (const code of [first.code, second.code]) {
      await plPage.expectListValues(code, {
        "Storage Location": first.storageLocation,
        "Repair Storage Location": first.repairStorageLocation,
      });
    }

    await attachScreenshot(
      page,
      testInfo,
      shot("TC-MOM99-023 List view setelah Create"),
    );
  });

  test("TC-MOM99-024 Change the storage location of a line", async ({
    page,
  }, testInfo) => {
    partial("The line is not in use: workstations are set up in another menu.");
    const data = await newLine({ sloc: "line1" });
    await createLine(data);
    const sloc2 = await refs.storageLocation("line2");

    await plPage.open();
    await plPage.update(data.code, { storageLocation: sloc2.name });

    await plPage.openDetail(data.code);
    await plPage.expectDetail({
      storageLocation: sloc2.name,
      area: sloc2.area,
      factory: sloc2.factory,
    });

    await attachScreenshot(
      page,
      testInfo,
      shot("TC-MOM99-024 Detail view setelah Update"),
    );
  });

  test("TC-MOM99-027 Change the repair storage location of a line", async ({
    page,
  }, testInfo) => {
    partial(
      "Step 2 (clear Repair Storage Location) and the line in use are not automated: no BasePage function to clear a combobox; workstations are set up in another menu.",
    );
    const data = await newLine({ repair: "repair1" });
    await createLine(data);
    const repair2 = await refs.storageLocation("repair2");

    await plPage.open();
    await plPage.update(data.code, { repairStorageLocation: repair2.name });

    await plPage.openDetail(data.code);
    await plPage.expectDetail({ repairStorageLocation: repair2.name });

    await attachScreenshot(
      page,
      testInfo,
      shot("TC-MOM99-027 Detail view setelah Update"),
    );
  });

  // ---------- 9.5 Update ----------

  test("TC-MOM99-030 Edit name, line no and toggles", async ({
    page,
  }, testInfo) => {
    const data = await newLine();
    await createLine(data);
    const id = uid();
    const changes = {
      name: `SMT ${id}A`,
      lineNo: `L${id}A`,
      productionLine: false,
      twoStepTransfer: true,
    };

    await plPage.open();
    await plPage.update(data.code, changes);

    await plPage.openDetail(data.code); // Code unchanged on the H6 title
    await plPage.expectDetail({ name: changes.name, lineNo: changes.lineNo });
    await plPage.expectSavedToggles(data.code, {
      productionLine: false,
      twoStepTransfer: true,
    });

    await attachScreenshot(
      page,
      testInfo,
      shot("TC-MOM99-030 Detail view setelah Update"),
    );
  });

  // ---------- 9.7 Delete ----------

  test("TC-MOM99-036 Delete an unused line from its page", async ({
    page,
  }, testInfo) => {
    partial(
      "SMT configuration delete is not checked: it is set up in another menu.",
    );
    const data = await newLine();
    await createLine(data);

    await plPage.deleteFromDetail(data.code); // checks "Delete production line {Code}?"
    untrack(data.code);

    await attachScreenshot(
      page,
      testInfo,
      shot("TC-MOM99-036 List view setelah Delete"),
    );
  });

  test("TC-MOM99-037 Cancel the delete confirmation", async ({
    page,
  }, testInfo) => {
    const first = await newLine();
    const second = await newLine();
    await createLine(first);
    await createLine(second);

    await plPage.open();
    await plPage.cancelDelete([first.code, second.code], {
      confirmMessage: "Delete 2 Records?",
    });

    await attachScreenshot(
      page,
      testInfo,
      shot("TC-MOM99-037 List view setelah Cancel Delete"),
    );
  });

  test("TC-MOM99-038 Delete several unused lines from the list", async ({
    page,
  }, testInfo) => {
    partial(
      "Step 1 (Delete not enabled with no row checked) is not automated: Delete sits in the More menu, its disabled state is not confirmed with FE.",
    );
    const first = await newLine();
    const second = await newLine();
    await createLine(first);
    await createLine(second);

    await plPage.open();
    await plPage.delete([first.code, second.code], {
      confirmMessage: "Delete 2 Records?",
    });
    untrack(first.code, second.code);

    await attachScreenshot(
      page,
      testInfo,
      shot("TC-MOM99-038 List view setelah Delete"),
    );
  });
});
