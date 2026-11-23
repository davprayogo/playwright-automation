/**
 * MOM-99 Production Line Masters — automation (FSD Section 9), positive and negative.
 *
 * One file per menu (AUTOMATION_RULES Section 1.1). Tests follow FSD Section 9 order
 * and are tagged by the FSD Type: run a subset with --grep @positive / --grep @negative.
 *
 * Automated:
 *  - @positive: 001, 002, 004, 007, 008, 009, 011, 012, 015, 017, 020, 022, 023, 024, 027, 030, 036, 037, 038
 *  - @negative: 005, 006, 010, 014, 016, 018, 019, 021, 025, 026, 028, 029, 031, 033, 034, 041, 042
 *  Partial (see the annotation in each test): 004, 024, 027, 029, 031, 036, 038, 042.
 *  034 is an Additional QA Recommendation (MOM-0029 FR-490), not an MOM-99 requirement.
 *
 * Not automated:
 *  - 003, 035 (changes in Area Masters / Storage Locations after the line is saved, Workstation Masters)
 *  - 013, 032 (API requests: no API client yet)
 *  - 039, 040 (lines used by work order schedules, workstations or material allocation lines)
 *  - 043 (export download: no BasePage function yet)
 *  - 044–050 (authorization: needs a second login without the action)
 *
 * Test data: every test makes its own reference data through the UI, on first use
 * (ProductionLineRefs: Area -> Storage Location, and Process Master), then its lines.
 * Inactive records: made with BasePage.deactivate() (general active/inactive process).
 * afterEach deletes the lines first, then the reference data; inactive records are deleted
 * from the list filtered with showInactiveOnly(), because the default list hides them.
 * Toasts (confirmed in the UI): duplicate code and delete of a record in use show a toast,
 * not the MOM-0029 modal / the MOM-99 FR-160 text. See expectToast() and duplicateRecordMessage().
 * Messages: generic checks expect MOM-0029 (STD_MESSAGES / STD_DIALOGS); MOM-99 business
 * rules expect the FSD text (PLM_MESSAGES). Where the FSD does not say where a message
 * shows, the test only checks that the exact text is on the page.
 * "Another user": a second page in the same browser context (same login).
 * Server errors: simulated with failApi() (network interception), no backend change needed.
 * Login is expected from the Playwright config (storageState).
 * Evidence: each test ends with attachScreenshot() — only reached when every step passed.
 */
import { test, type Page } from "@playwright/test";
import {
  PLM_LIST_COLUMNS,
  PLM_MESSAGES,
  ProductionLineMastersPage,
} from "@pages/ProductionLineMastersPages";
import {
  STD_DIALOGS,
  STD_MESSAGES,
  duplicateRecordMessage,
} from "@pages/BasePage";
import type { ProductionLineMaster } from "@data/masterdata/ProductionLineMasters";
import { attachScreenshot } from "@utils/screenshot";
import { failApi } from "@utils/network";
import {
  ProductionLineRefs,
  type PmKey,
  type SlocKey,
} from "@fixtures/ProductionLineRefs";

/** API calls of this menu. The page URL also matches, but failApi() skips page loads. */
const PL_API = /production-?line/i;

const POSITIVE = { tag: "@positive" };
const NEGATIVE = { tag: "@negative" };

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
> & { pm?: PmKey; sloc?: SlocKey; repair?: SlocKey };

test.describe("MOM-99 Production Line Masters", () => {
  let plPage: ProductionLineMastersPage;
  let refs: ProductionLineRefs;
  let created: string[];
  let inactiveLines: string[];
  let extraPages: Page[];

  /** A valid line. Line No `L` + 6 chars stays under the 10-char limit. Storage location default: line2. */
  const newLine = async ({
    pm = "main",
    sloc = "line2",
    repair,
    ...overrides
  }: LineOpts = {}): Promise<ProductionLineMaster> => {
    const id = uid();
    return {
      code: `PL-${id}`,
      name: `SMT ${id}`,
      lineNo: `L${id}`,
      processMaster: await refs.processMaster(pm),
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
    inactiveLines = inactiveLines.filter((c) => !codes.includes(c));
  };
  /** Set a line to Active No and track it for cleanup from the inactive-only list. */
  const deactivateLine = async (code: string) => {
    await plPage.open();
    await plPage.deactivate("Code", [code]);
    created = created.filter((c) => c !== code);
    inactiveLines.push(code);
  };
  /** Delete lines: active ones from the default list, inactive ones from showInactiveOnly(). */
  const deleteLines = async (codes: string[], inactive: boolean) => {
    if (!codes.length) return;
    try {
      await plPage.open();
      if (inactive) await plPage.showInactiveOnly();
      await plPage.delete([...new Set(codes)]);
    } catch (e) {
      console.warn(
        `Cleanup failed for ${inactive ? "inactive " : ""}lines: ${codes.join(", ")}`,
        e,
      );
    }
  };
  const partial = (description: string) =>
    test.info().annotations.push({ type: "partial", description });

  /** A second page in the same login, used as "another user". */
  const anotherUser = async (page: Page) => {
    const other = await page.context().newPage();
    extraPages.push(other);
    return other;
  };

  test.beforeEach(async ({ page }) => {
    plPage = new ProductionLineMastersPage(page);
    refs = new ProductionLineRefs(page);
    created = [];
    inactiveLines = [];
    extraPages = [];
    // Leaving a refused form may raise a browser "leave page?" prompt: accept it.
    page.on("dialog", (dialog) => dialog.accept());
  });

  test.afterEach(async ({ page }) => {
    await page.unrouteAll({ behavior: "ignoreErrors" });
    for (const other of extraPages) await other.close();
    // Lines first: a storage location or process master in use cannot be deleted.
    await deleteLines(created, false);
    await deleteLines(inactiveLines, true);
    await refs.cleanup();
  });

  // ---------- 9.1 List and Detail ----------

  test(
    "TC-MOM99-001 The list shows active lines with storage location and area data",
    POSITIVE,
    async ({ page }, testInfo) => {
      const data = await newLine({
        sloc: "line1",
        repair: "repair1",
        externalCode: "EXT-01",
      });
      await createLine(data);
      const inactive = await newLine();
      await createLine(inactive);
      await deactivateLine(inactive.code);
      const sloc = await refs.storageLocation("line1");

      await plPage.open();
      await plPage.expectListColumns([...PLM_LIST_COLUMNS]);
      // Area data comes from Storage Location, not from Repair Storage Location.
      await plPage.expectLine(data.code, {
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
        "Two Step Transfer": false,
        "Auto Transfer to Repair": false,
        Active: true,
      });
      await plPage.expectNotInList(inactive.code); // hidden by the default filter (Active = Yes)

      await attachScreenshot(page, testInfo, shot("TC-MOM99-001 List view"));
    },
  );

  test(
    "TC-MOM99-002 Inactive lines show when the Custom Filter Active = No is applied",
    POSITIVE,
    async ({ page }, testInfo) => {
      const active = await newLine();
      const inactive = await newLine();
      await createLine(active);
      await createLine(inactive);
      await deactivateLine(inactive.code);

      await plPage.open();
      await plPage.expectNotInList(inactive.code); // step 1: hidden by default
      await plPage.expectInList(active.code);
      await attachScreenshot(
        page,
        testInfo,
        shot("TC-MOM99-002 Step 1 List view"),
      );

      await plPage.showInactiveOnly(); // step 2: Custom Filter Active = FALSE
      await plPage.expectLine(inactive.code, { Active: false });
      await plPage.expectNotInList(active.code);

      await attachScreenshot(
        page,
        testInfo,
        shot("TC-MOM99-002 Step 2 List view"),
      );
    },
  );

  test(
    "TC-MOM99-004 The detail page shows every field, and Code is read only",
    POSITIVE,
    async ({ page }, testInfo) => {
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
    },
  );

  test(
    "TC-MOM99-005 The list fails to load",
    NEGATIVE,
    async ({ page }, testInfo) => {
      await failApi(page, PL_API, ["GET"]);

      await plPage.goto(plPage.path);
      await plPage.expectMessage(PLM_MESSAGES.listLoadFailed);

      await attachScreenshot(page, testInfo, shot("TC-MOM99-005 List view"));
    },
  );

  test(
    "TC-MOM99-006 The detail page fails to load",
    NEGATIVE,
    async ({ page }, testInfo) => {
      const data = await newLine();
      await createLine(data);

      await plPage.open();
      await failApi(page, PL_API, ["GET"]);
      await plPage.openDetailByColumn("Code", data.code);
      await plPage.expectMessage(PLM_MESSAGES.detailLoadFailed);

      await attachScreenshot(page, testInfo, shot("TC-MOM99-006 Detail view"));
    },
  );

  // ---------- 9.2 Create ----------

  test(
    "TC-MOM99-007 Create a line with all fields",
    POSITIVE,
    async ({ page }, testInfo) => {
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
      await plPage.expectLine(data.code, {
        Name: data.name,
        Area: sloc.area,
        Factory: sloc.factory,
        Active: true,
      });

      await attachScreenshot(
        page,
        testInfo,
        shot("TC-MOM99-007 Step 5 List view setelah Create"),
      );
    },
  );

  test(
    "TC-MOM99-008 Default values on New, and Repair Storage Location is optional",
    POSITIVE,
    async ({ page }, testInfo) => {
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

      await plPage.expectDetail({
        repairStorageLocation: "",
        externalCode: "",
      });
      await attachScreenshot(
        page,
        testInfo,
        shot("TC-MOM99-008 Step 4 Detail view setelah Create"),
      );

      await plPage.open();
      await plPage.expectLine(data.code, {
        "Two Step Transfer": false,
        "Auto Transfer to Repair": false,
        Active: true,
      });
      // Production Line is not a list column (FSD 7.5): read it on the Edit form.
      await plPage.expectSavedToggles(data.code, { productionLine: true });

      await attachScreenshot(
        page,
        testInfo,
        shot("TC-MOM99-008 Step 5 Detail view setelah Create"),
      );
    },
  );

  test(
    "TC-MOM99-009 Create a line with non-default toggle values",
    POSITIVE,
    async ({ page }, testInfo) => {
      const data = await newLine({
        repair: "repair1",
        productionLine: false,
        twoStepTransfer: true,
        autoTransferToRepair: true,
      });
      await createLine(data);

      await plPage.open();
      await plPage.expectLine(data.code, {
        "Two Step Transfer": true,
        "Auto Transfer to Repair": true,
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
    },
  );

  test(
    "TC-MOM99-010 Mandatory fields empty or spaces only",
    NEGATIVE,
    async ({ page }, testInfo) => {
      await plPage.open();
      await plPage.startCreate({ code: "   ", name: "   " }); // Line No, Process Master, Storage Location empty
      await plPage.trySave();

      await plPage.expectFieldErrors(
        ["code", "name", "lineNo", "processMaster", "storageLocation"],
        STD_MESSAGES.required,
      );
      await plPage.expectFormStillOpen(); // nothing is saved

      await attachScreenshot(
        page,
        testInfo,
        shot("TC-MOM99-010 Detail view setelah Create ditolak"),
      );
    },
  );

  test(
    "TC-MOM99-011 Code, Name and Line No are saved trimmed",
    POSITIVE,
    async ({ page }, testInfo) => {
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
    },
  );

  test(
    "TC-MOM99-012 Text fields stop accepting characters at their maximum length",
    POSITIVE,
    async ({ page }, testInfo) => {
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
    },
  );

  test(
    "TC-MOM99-014 Duplicate code is refused, ignoring case and across factories",
    NEGATIVE,
    async ({ page }, testInfo) => {
      const existing = await newLine({ sloc: "line1" }); // factory of area A
      await createLine(existing);
      const duplicate = await newLine({
        sloc: "line2",
        code: existing.code.toLowerCase(),
      }); // area B, other factory

      await plPage.open();
      await plPage.startCreate(duplicate);
      await plPage.trySave();
      // Toast (UI), not the MOM-0029 modal. Value shown not confirmed: typed or existing spelling.
      await plPage.expectToast(
        duplicateRecordMessage([["Code", [duplicate.code, existing.code]]]),
      );
      await attachScreenshot(
        page,
        testInfo,
        shot("TC-MOM99-014 Detail view setelah Create ditolak"),
      );

      await plPage.open();
      await plPage.expectInList(existing.code);
      await plPage.expectNotInList(duplicate.code); // nothing is saved
      await attachScreenshot(
        page,
        testInfo,
        shot("TC-MOM99-014 Step 1 List view"),
      );

      // Step 2: the code of an inactive line is also refused.
      const inactive = await newLine();
      await createLine(inactive);
      await deactivateLine(inactive.code);
      await plPage.open();
      await plPage.startCreate(await newLine({ code: inactive.code }));
      await plPage.trySave();
      await plPage.expectToast(
        duplicateRecordMessage([["Code", inactive.code]]),
      );
      await attachScreenshot(
        page,
        testInfo,
        shot("TC-MOM99-014 Step 2 Detail view setelah Create ditolak"),
      );
    },
  );

  test(
    "TC-MOM99-015 Name, Line No and External Code can repeat",
    POSITIVE,
    async ({ page }, testInfo) => {
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
        await plPage.expectLine(code, {
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
    },
  );

  test("TC-MOM99-016 Saving fails", NEGATIVE, async ({ page }, testInfo) => {
    const data = await newLine();
    await plPage.open();
    await plPage.startCreate(data);
    const stop = await failApi(page, PL_API, ["POST", "PUT"]);

    await plPage.trySave();
    await plPage.expectMessage(PLM_MESSAGES.saveFailed);
    await attachScreenshot(
      page,
      testInfo,
      shot("TC-MOM99-016 Detail view setelah Create gagal"),
    );

    await stop();
    await plPage.open();
    await plPage.expectNotInList(data.code); // nothing is saved

    await attachScreenshot(page, testInfo, shot("TC-MOM99-016 List view"));
  });

  // ---------- 9.3 Process Master, Storage Location and Repair Storage Location ----------

  test(
    "TC-MOM99-017 Comboboxes show active records only, by name",
    POSITIVE,
    async ({ page }, testInfo) => {
      const pm = await refs.processMaster();
      const sloc = await refs.storageLocation("line1");
      const repair = await refs.storageLocation("repair1");
      const inactivePm = await refs.processMaster("spare");
      const inactiveSloc = (await refs.storageLocation("spare1")).name;
      await refs.deactivateProcessMaster("spare");
      await refs.deactivateStorageLocation("spare1");

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
    },
  );

  test(
    "TC-MOM99-018 A selected reference that becomes inactive before Save is refused on Create",
    NEGATIVE,
    async ({ page }, testInfo) => {
      const data = await newLine({
        pm: "spare",
        sloc: "spare1",
        repair: "spare2",
      });
      await plPage.open();
      await plPage.startCreate(data);

      const other = await anotherUser(page); // user B
      await refs.deactivateProcessMaster("spare", other);
      await refs.deactivateStorageLocation("spare1", other);
      await refs.deactivateStorageLocation("spare2", other);

      await plPage.trySave();
      await plPage.expectFieldErrors(
        ["processMaster", "storageLocation", "repairStorageLocation"],
        STD_MESSAGES.inactiveRecord,
      );
      await plPage.expectFormStillOpen(); // nothing is saved

      await attachScreenshot(
        page,
        testInfo,
        shot("TC-MOM99-018 Detail view setelah Create ditolak"),
      );
    },
  );

  test(
    "TC-MOM99-019 A selected storage location that is deleted before Save is refused",
    NEGATIVE,
    async ({ page }, testInfo) => {
      const data = await newLine({ sloc: "line1" });
      await plPage.open();
      await plPage.startCreate(data);

      await refs.deleteStorageLocationFrom(await anotherUser(page), "line1");
      await plPage.trySave();

      await plPage.expectFieldErrors(
        ["storageLocation"],
        STD_MESSAGES.recordNotExist,
      );
      await plPage.expectFormStillOpen(); // nothing is saved

      await attachScreenshot(
        page,
        testInfo,
        shot("TC-MOM99-019 Detail view setelah Create ditolak"),
      );
    },
  );

  test(
    "TC-MOM99-020 A line whose references became inactive can still be saved when they are not changed",
    POSITIVE,
    async ({ page }, testInfo) => {
      const data = await newLine({
        pm: "spare",
        sloc: "spare1",
        repair: "spare2",
      });
      await createLine(data);
      await refs.deactivateProcessMaster("spare");
      await refs.deactivateStorageLocation("spare1");
      await refs.deactivateStorageLocation("spare2");

      await plPage.openDetail(data.code); // step 1: names still shown
      await plPage.expectDetail({
        processMaster: data.processMaster,
        storageLocation: data.storageLocation,
        repairStorageLocation: data.repairStorageLocation,
      });

      await plPage.open();
      await plPage.update(data.code, { externalCode: "EXT-05" });

      await plPage.openDetail(data.code);
      await plPage.expectDetail({
        externalCode: "EXT-05",
        processMaster: data.processMaster,
        storageLocation: data.storageLocation,
        repairStorageLocation: data.repairStorageLocation,
      });

      await attachScreenshot(
        page,
        testInfo,
        shot("TC-MOM99-020 Detail view setelah Update"),
      );
    },
  );

  test(
    "TC-MOM99-021 A changed reference that becomes inactive before Save is refused on Update",
    NEGATIVE,
    async ({ page }, testInfo) => {
      const data = await newLine({ sloc: "line2", repair: "repair1" });
      await createLine(data);
      const newPm = await refs.processMaster("spare");
      const newSloc = (await refs.storageLocation("spare1")).name;
      const newRepair = (await refs.storageLocation("spare2")).name;

      await plPage.open();
      await plPage.startEdit(data.code, {
        processMaster: newPm,
        storageLocation: newSloc,
        repairStorageLocation: newRepair,
      });

      const other = await anotherUser(page); // user B
      await refs.deactivateProcessMaster("spare", other);
      await refs.deactivateStorageLocation("spare1", other);
      await refs.deactivateStorageLocation("spare2", other);

      await plPage.trySave();
      await plPage.expectFieldErrors(
        ["processMaster", "storageLocation", "repairStorageLocation"],
        STD_MESSAGES.inactiveRecord,
      );
      await attachScreenshot(
        page,
        testInfo,
        shot("TC-MOM99-021 Detail view setelah Update ditolak"),
      );

      await plPage.openDetail(data.code); // nothing changes
      await plPage.expectDetail({
        processMaster: data.processMaster,
        storageLocation: data.storageLocation,
        repairStorageLocation: data.repairStorageLocation,
      });

      await attachScreenshot(page, testInfo, shot("TC-MOM99-021 Detail view"));
    },
  );

  test(
    "TC-MOM99-022 A storage location whose area is inactive can be used",
    POSITIVE,
    async ({ page }, testInfo) => {
      const sloc = await refs.storageLocation("areaC");
      await refs.deactivateAreaOf("areaC"); // the storage location stays active
      const data = await newLine({ sloc: "areaC" });

      await createLine(data); // asserts H6 title = Code: the save is not refused
      await plPage.expectDetail({ storageLocation: sloc.name });

      await attachScreenshot(
        page,
        testInfo,
        shot("TC-MOM99-022 Detail view setelah Create"),
      );
    },
  );

  test(
    "TC-MOM99-023 One storage location serves many lines, as storage location and as repair storage location",
    POSITIVE,
    async ({ page }, testInfo) => {
      const first = await newLine({ sloc: "line1", repair: "repair1" });
      const second = await newLine({ sloc: "line1", repair: "repair1" });
      await createLine(first);
      await createLine(second);

      await plPage.open();
      for (const code of [first.code, second.code]) {
        await plPage.expectLine(code, {
          "Storage Location": first.storageLocation,
          "Repair Storage Location": first.repairStorageLocation,
        });
      }

      await attachScreenshot(
        page,
        testInfo,
        shot("TC-MOM99-023 List view setelah Create"),
      );
    },
  );

  test(
    "TC-MOM99-024 Change the storage location of a line",
    POSITIVE,
    async ({ page }, testInfo) => {
      partial(
        "The line is not in use: workstations are set up in another menu.",
      );
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
    },
  );

  test(
    "TC-MOM99-025 Repair Storage Location the same as Storage Location on Create",
    NEGATIVE,
    async ({ page }, testInfo) => {
      const data = await newLine({ sloc: "line2", repair: "line2" });
      await plPage.open();
      await plPage.startCreate(data);
      await plPage.trySave();

      await plPage.expectMessage(
        PLM_MESSAGES.repairSameAsStorage(data.storageLocation),
      );
      await attachScreenshot(
        page,
        testInfo,
        shot("TC-MOM99-025 Detail view setelah Create ditolak"),
      );

      await plPage.open();
      await plPage.expectNotInList(data.code); // nothing is saved

      await attachScreenshot(page, testInfo, shot("TC-MOM99-025 List view"));
    },
  );

  test(
    "TC-MOM99-026 Storage Location changed to the Repair Storage Location on Update",
    NEGATIVE,
    async ({ page }, testInfo) => {
      const data = await newLine({ sloc: "line1", repair: "repair1" });
      await createLine(data);
      const repair = data.repairStorageLocation!;

      await plPage.open();
      await plPage.startEdit(data.code, { storageLocation: repair });
      await plPage.trySave();

      await plPage.expectMessage(PLM_MESSAGES.repairSameAsStorage(repair));
      await attachScreenshot(
        page,
        testInfo,
        shot("TC-MOM99-026 Detail view setelah Update ditolak"),
      );

      await plPage.openDetail(data.code);
      await plPage.expectDetail({ storageLocation: data.storageLocation }); // nothing changes

      await attachScreenshot(page, testInfo, shot("TC-MOM99-026 Detail view"));
    },
  );

  test(
    "TC-MOM99-027 Change the repair storage location of a line",
    POSITIVE,
    async ({ page }, testInfo) => {
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
    },
  );

  // ---------- 9.4 Auto Transfer to Repair ----------

  test(
    "TC-MOM99-028 Auto Transfer to Repair Yes without a repair storage location on Create",
    NEGATIVE,
    async ({ page }, testInfo) => {
      const data = await newLine({ autoTransferToRepair: true }); // no repair storage location
      await plPage.open();
      await plPage.startCreate(data);
      await plPage.trySave();

      await plPage.expectMessage(PLM_MESSAGES.autoTransferNeedsRepair);
      await attachScreenshot(
        page,
        testInfo,
        shot("TC-MOM99-028 Detail view setelah Create ditolak"),
      );

      await plPage.open();
      await plPage.expectNotInList(data.code); // nothing is saved

      await attachScreenshot(page, testInfo, shot("TC-MOM99-028 List view"));
    },
  );

  test(
    "TC-MOM99-029 Auto Transfer to Repair Yes without a repair storage location on Update",
    NEGATIVE,
    async ({ page }, testInfo) => {
      partial(
        "Step 1 (clear Repair Storage Location while Auto Transfer to Repair is Yes) is not automated: no BasePage function to clear a combobox.",
      );
      const data = await newLine(); // Auto Transfer to Repair No, no repair storage location
      await createLine(data);

      await plPage.open();
      await plPage.startEdit(data.code, { autoTransferToRepair: true });
      await plPage.trySave();

      await plPage.expectMessage(PLM_MESSAGES.autoTransferNeedsRepair);
      await attachScreenshot(
        page,
        testInfo,
        shot("TC-MOM99-029 Detail view setelah Update ditolak"),
      );

      await plPage.expectSavedToggles(data.code, {
        autoTransferToRepair: false,
      }); // nothing changes

      await attachScreenshot(page, testInfo, shot("TC-MOM99-029 Detail view"));
    },
  );

  // ---------- 9.5 Update ----------

  test(
    "TC-MOM99-030 Edit name, line no and toggles",
    POSITIVE,
    async ({ page }, testInfo) => {
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
    },
  );

  test(
    "TC-MOM99-031 Mandatory fields cleared on Update",
    NEGATIVE,
    async ({ page }, testInfo) => {
      partial(
        "Clearing Storage Location is not automated: no BasePage function to clear a combobox.",
      );
      const data = await newLine();
      await createLine(data);

      await plPage.open();
      await plPage.startEdit(data.code, { name: "   ", lineNo: "" });
      await plPage.trySave();

      await plPage.expectFieldErrors(["name", "lineNo"], STD_MESSAGES.required);
      await plPage.expectFormStillOpen();
      await attachScreenshot(
        page,
        testInfo,
        shot("TC-MOM99-031 Detail view setelah Update ditolak"),
      );

      await plPage.openDetail(data.code);
      await plPage.expectDetail({ name: data.name, lineNo: data.lineNo }); // nothing changes

      await attachScreenshot(page, testInfo, shot("TC-MOM99-031 Detail view"));
    },
  );

  test(
    "TC-MOM99-033 Save a line that another user deleted",
    NEGATIVE,
    async ({ page }, testInfo) => {
      const data = await newLine();
      await createLine(data);

      await plPage.open();
      await plPage.startEdit(data.code, { externalCode: "EXT-33" });

      const other = new ProductionLineMastersPage(await anotherUser(page));
      await other.open();
      await other.delete([data.code]);
      untrack(data.code);

      await plPage.trySave();
      await plPage.expectDialogWithTitle(
        STD_DIALOGS.deleted.title,
        STD_DIALOGS.deleted.text,
      );
      await attachScreenshot(
        page,
        testInfo,
        shot("TC-MOM99-033 Step 3 Detail view setelah Update ditolak"),
      );

      await plPage.confirmDialog("Back to List");
      await plPage.expectTableLoaded();
      await plPage.expectNotInList(data.code);

      await attachScreenshot(
        page,
        testInfo,
        shot("TC-MOM99-033 Step 4 List view"),
      );
    },
  );

  test(
    "TC-MOM99-034 Save a line that another user changed after it was opened",
    NEGATIVE,
    async ({ page }, testInfo) => {
      test.info().annotations.push({
        type: "classification",
        description:
          "Additional QA Recommendation (MOM-0029 FR-490). MOM-99 does not define this behavior.",
      });
      const data = await newLine();
      await createLine(data);
      const newName = `${data.name} B`;

      await plPage.open();
      await plPage.startEdit(data.code, { externalCode: "EXT-34" });

      const other = new ProductionLineMastersPage(await anotherUser(page));
      await other.open();
      await other.update(data.code, { name: newName });

      await plPage.trySave();
      await plPage.expectDialogWithTitle(
        STD_DIALOGS.outdated.title,
        STD_DIALOGS.outdated.text,
      );
      await attachScreenshot(
        page,
        testInfo,
        shot("TC-MOM99-034 Step 3 Detail view setelah Update ditolak"),
      );

      await plPage.confirmDialog("Reload");
      await plPage.expectFormStillOpen(); // stays in edit mode
      await plPage.expectFormValues({ name: newName, externalCode: "" }); // latest data, own change dropped

      await attachScreenshot(
        page,
        testInfo,
        shot("TC-MOM99-034 Step 4 Detail view"),
      );
    },
  );

  // ---------- 9.7 Delete ----------

  test(
    "TC-MOM99-036 Delete an unused line from its page",
    POSITIVE,
    async ({ page }, testInfo) => {
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
    },
  );

  test(
    "TC-MOM99-037 Cancel the delete confirmation",
    POSITIVE,
    async ({ page }, testInfo) => {
      const first = await newLine();
      const second = await newLine();
      await createLine(first);
      await createLine(second);

      await plPage.open();
      await plPage.cancelDelete([first.code, second.code], {
        confirmMessage: "Delete 2 production lines?",
      });

      await attachScreenshot(
        page,
        testInfo,
        shot("TC-MOM99-037 List view setelah Cancel Delete"),
      );
    },
  );

  test(
    "TC-MOM99-038 Delete several unused lines from the list",
    POSITIVE,
    async ({ page }, testInfo) => {
      partial(
        "Step 1 (Delete not enabled with no row checked) is not automated: Delete sits in the More menu, its disabled state is not confirmed with FE.",
      );
      const first = await newLine();
      const second = await newLine();
      await createLine(first);
      await createLine(second);

      await plPage.open();
      await plPage.delete([first.code, second.code], {
        confirmMessage: "Delete 2 production lines?",
      });
      untrack(first.code, second.code);

      await attachScreenshot(
        page,
        testInfo,
        shot("TC-MOM99-038 List view setelah Delete"),
      );
    },
  );

  test(
    "TC-MOM99-041 Delete from the list a line that another user deleted",
    NEGATIVE,
    async ({ page }, testInfo) => {
      const gone = await newLine();
      const kept = await newLine();
      await createLine(gone);
      await createLine(kept);

      await plPage.open(); // the tester loads the list first

      const other = new ProductionLineMastersPage(await anotherUser(page));
      await other.open();
      await other.delete([gone.code]);
      untrack(gone.code);

      await plPage.selectRowsByColumn("Code", [gone.code, kept.code]);
      await plPage.clickDelete();
      await plPage.confirmDialog("Delete");
      await plPage.expectMessage(PLM_MESSAGES.linesNoLongerExist([gone.code]));
      await attachScreenshot(
        page,
        testInfo,
        shot("TC-MOM99-041 List view setelah Delete ditolak"),
      );

      await plPage.open();
      await plPage.expectInList(kept.code); // nothing is deleted

      await attachScreenshot(page, testInfo, shot("TC-MOM99-041 List view"));
    },
  );

  test("TC-MOM99-042 Delete fails", NEGATIVE, async ({ page }, testInfo) => {
    partial(
      "SMT configuration staying is not checked: it is set up in another menu.",
    );
    const data = await newLine();
    await createLine(data);

    await plPage.openDetail(data.code);
    // Delete may be sent as DELETE or as POST (several ids): fail both.
    const stop = await failApi(page, PL_API, ["DELETE", "POST"]);
    await plPage.clickDetailDelete();
    await plPage.confirmDialog("Delete");
    await plPage.expectMessage(PLM_MESSAGES.saveFailed);
    await attachScreenshot(
      page,
      testInfo,
      shot("TC-MOM99-042 Detail view setelah Delete gagal"),
    );

    await stop();
    await plPage.open();
    await plPage.expectInList(data.code); // nothing is deleted

    await attachScreenshot(page, testInfo, shot("TC-MOM99-042 List view"));
  });
});
