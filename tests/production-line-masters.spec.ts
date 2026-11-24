/**
 * MOM-99 Production Line Masters — automation of FSD Section 9.2, run by TCMS (ZSN_ETCMS001).
 *
 * TEST DATA: only from the TCMS run setup file (RUN_SETUP_FILE), through `data.get("DS-MOM99-..")`.
 * The script makes no value: no uid(), no Date.now(). The provider (src/tcms/dataProvider.ts)
 * creates the Setup data sets before the test body, checks existing data (FR-210), and deletes
 * what it created by record number after the test (FR-230). A test that creates an Input data
 * set calls `data.created(ds)` on its detail view so it is cleaned up too.
 *
 * Tags: @positive / @negative (FSD Type) and @TC-MOM99-xxx (TCMS selects by ID).
 * Annotation tc-version = the MOM-99 test case version the script was built from (FR-80).
 *
 * Variations (TCMS open item #14, decided: in the script, from the TCMS values): lower case,
 * spaces around, values from another data set. Each test that uses one says so in a
 * "variation" annotation.
 *
 * Automated:
 *  - @positive: 001, 002, 004, 007, 008, 009, 011, 012, 015, 017, 020, 022, 023, 024, 027, 030, 036, 037, 038
 *  - @negative: 005, 006, 010, 014, 016, 018, 019, 021, 025, 026, 028, 029, 031, 033, 034, 041, 042
 *  Partial (see the annotation in each test): 004, 027, 029, 031, 038.
 *  Blocked until a Page Object exists for the menu of a data set (setup ends Blocked, by design):
 *   - 024, 027 (DS-MOM99-23 Workstation Masters)
 *   - 036, 042 (DS-MOM99-28 SMT Prod. Line Configurations)
 *  034 is an Additional QA Recommendation (MOM-0029 FR-490), not an MOM-99 requirement.
 *
 * Not automated (Manual in TCMS: no @TC tag):
 *  - 003 (edits Area Masters / Storage Locations: StorageLocationsPage has no update yet)
 *  - 013, 032, 045, 047–050 (API requests: no API client yet)
 *  - 035, 039, 040 (Workstation Masters, Work Order Schedules, Material Allocations: no Page Object)
 *  - 043 (export download: no BasePage function yet)
 *  - 044, 046 (authorization: needs a second login without the action)
 *
 * Toasts / messages: as before (STD_MESSAGES, STD_DIALOGS, PLM_MESSAGES, duplicateRecordMessage).
 * "Another user": a second page in the same browser context (same login).
 * Server errors: simulated with failApi(). Login from the Playwright config (storageState).
 * Retries must be 0 in TCMS runs: a retry would create the same dummy values again.
 */
import type { Page } from "@playwright/test";
import { test } from "@tcms/fixtures";
import type { DataProvider, DataSetHandle } from "@tcms/dataProvider";
import { toProductionLine } from "@menus/production-line/production-line-master.tcms";
import { requireData } from "@tcms/errors";
import {
  PLM_LIST_COLUMNS,
  PLM_MESSAGES,
  ProductionLineMastersPage,
} from "@menus/production-line/ProductionLineMastersPage";
import {
  STD_DIALOGS,
  STD_MESSAGES,
  duplicateRecordMessage,
} from "@core/constants";
import type { ProductionLineMaster } from "@menus/production-line/production-line-master.data";
import { attachScreenshot } from "@utils/screenshot";
import { failApi } from "@utils/network";

/** API calls of this menu. The page URL also matches, but failApi() skips page loads. */
const PL_API = /production-?line/i;

const shot = (step: string) => `Production Line Masters - ${step}`;

/** Text fields of a line data set, as expectDetail() takes them. */
const lineText = (l: DataSetHandle) => ({
  code: l.value("Code"),
  name: l.value("Name"),
  lineNo: l.value("Line No"),
  processMaster: l.value("Process Master"),
  storageLocation: l.value("Storage Location"),
  repairStorageLocation: l.values["Repair Storage Location"] ?? "",
  externalCode: l.values["External Code"] ?? "",
});

/** Area data a line shows, from the area data set of its storage location. */
const areaOf = (area: DataSetHandle) => ({
  area: area.value("Name"),
  factory: area.value("Factory"),
  floor: area.value("Floor"),
  division: area.value("Division"),
});

test.describe("MOM-99 Production Line Masters", () => {
  let plPage: ProductionLineMastersPage;
  let extraPages: Page[];

  /** Page Object data of an Input line data set, with test-specific changes. */
  const lineInput = (
    data: DataProvider,
    ds: string,
    changes: Partial<ProductionLineMaster> = {},
  ) => ({
    ...toProductionLine(data.get(ds).values),
    ...changes,
  });

  /** Create the line of an Input data set through the menu, and hand it to cleanup. */
  const createLine = async (
    data: DataProvider,
    ds: string,
    line: ProductionLineMaster,
  ) => {
    await plPage.open();
    await plPage.create(line);
    await data.created(ds);
  };

  const partial = (description: string) =>
    test.info().annotations.push({ type: "partial", description });
  const variation = (description: string) =>
    test.info().annotations.push({ type: "variation", description });

  /** A second page in the same login, used as "another user". */
  const anotherUser = async (page: Page) => {
    const other = await page.context().newPage();
    extraPages.push(other);
    return other;
  };

  test.beforeEach(async ({ page }) => {
    plPage = new ProductionLineMastersPage(page);
    extraPages = [];
    // Leaving a refused form may raise a browser "leave page?" prompt: accept it.
    page.on("dialog", (dialog) => dialog.accept());
  });

  test.afterEach(async ({ page }) => {
    // The data cleanup runs after this hook, in the `data` fixture, by record number.
    await page.unrouteAll({ behavior: "ignoreErrors" });
    for (const other of extraPages) await other.close();
  });

  // ---------- 9.2.1 List and Detail ----------

  test(
    "TC-MOM99-001 The list shows active lines with storage location and area data",
    {
      tag: ["@positive", "@TC-MOM99-001"],
      annotation: { type: "tc-version", description: "1" },
    },
    async ({ page, data }, testInfo) => {
      const line = data.get("DS-MOM99-14");
      const off = data.get("DS-MOM99-15");
      const area = data.get("DS-MOM99-01");

      await plPage.open();
      await plPage.expectListColumns([...PLM_LIST_COLUMNS]);
      // Area data comes from Storage Location (DS-07), not from Repair Storage Location (DS-09).
      await plPage.expectLine(line.value("Code"), {
        Name: line.value("Name"),
        "Line No": line.value("Line No"),
        "Storage Location": data.get("DS-MOM99-07").value("Name"),
        Area: area.value("Name"),
        Factory: area.value("Factory"),
        Floor: area.value("Floor"),
        Division: area.value("Division"),
        "Repair Storage Location": data.get("DS-MOM99-09").value("Name"),
        "Process Master": data.get("DS-MOM99-04").value("Name"),
        "External Code": line.value("External Code"),
        "Two Step Transfer": true,
        "Auto Transfer to Repair": false,
        Active: true,
      });
      await plPage.expectNotInList(off.value("Code")); // hidden by the default filter

      await attachScreenshot(page, testInfo, shot("TC-MOM99-001 List view"));
    },
  );

  test(
    "TC-MOM99-002 Inactive lines show with the Custom Filter Active = FALSE",
    {
      tag: ["@positive", "@TC-MOM99-002"],
      annotation: { type: "tc-version", description: "1" },
    },
    async ({ page, data }, testInfo) => {
      const active = data.get("DS-MOM99-14").value("Code");
      const inactive = data.get("DS-MOM99-15").value("Code");

      await plPage.open();
      await plPage.expectNotInList(inactive); // step 1: hidden by default
      await attachScreenshot(
        page,
        testInfo,
        shot("TC-MOM99-002 Step 1 List view"),
      );

      await plPage.showInactiveOnly(); // step 2
      await plPage.expectLine(inactive, { Active: false });
      await plPage.expectNotInList(active);

      await attachScreenshot(
        page,
        testInfo,
        shot("TC-MOM99-002 Step 2 List view"),
      );
    },
  );

  test(
    "TC-MOM99-004 The detail page shows every field, and the derived fields, Code and Active are read only",
    {
      tag: ["@positive", "@TC-MOM99-004"],
      annotation: { type: "tc-version", description: "1" },
    },
    async ({ page, data }, testInfo) => {
      partial(
        "Step 3: only Code is checked read only. Area, Factory, Floor, Division and Active have no input locator.",
      );
      const line = data.get("DS-MOM99-14");

      await plPage.openDetail(line.value("Code"));
      await plPage.expectDetail({
        ...lineText(line),
        ...areaOf(data.get("DS-MOM99-01")),
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
    {
      tag: ["@negative", "@TC-MOM99-005"],
      annotation: { type: "tc-version", description: "1" },
    },
    async ({ page, data: _noDataSets }, testInfo) => {
      await failApi(page, PL_API, ["GET"]);

      await plPage.goto(plPage.path);
      await plPage.expectMessage(PLM_MESSAGES.listLoadFailed);

      await attachScreenshot(page, testInfo, shot("TC-MOM99-005 List view"));
    },
  );

  test(
    "TC-MOM99-006 The detail page fails to load",
    {
      tag: ["@negative", "@TC-MOM99-006"],
      annotation: { type: "tc-version", description: "1" },
    },
    async ({ page, data }, testInfo) => {
      const code = data.get("DS-MOM99-14").value("Code");

      await plPage.open();
      await failApi(page, PL_API, ["GET"]);
      await plPage.openDetailByColumn("Code", code);
      await plPage.expectMessage(PLM_MESSAGES.detailLoadFailed);

      await attachScreenshot(page, testInfo, shot("TC-MOM99-006 Detail view"));
    },
  );

  // ---------- 9.2.2 Create ----------

  test(
    "TC-MOM99-007 Create a line with all fields",
    {
      tag: ["@positive", "@TC-MOM99-007"],
      annotation: { type: "tc-version", description: "1" },
    },
    async ({ page, data }, testInfo) => {
      const line = lineInput(data, "DS-MOM99-29");
      const area = areaOf(data.get("DS-MOM99-02"));

      await createLine(data, "DS-MOM99-29", line); // asserts H6 title = Code
      await plPage.expectDetail({ ...line, ...area });
      await attachScreenshot(
        page,
        testInfo,
        shot("TC-MOM99-007 Step 2 Detail view setelah Create"),
      );

      await plPage.open();
      await plPage.expectLine(line.code, {
        Name: line.name,
        Area: area.area,
        Factory: area.factory,
        Active: true,
      });

      await attachScreenshot(
        page,
        testInfo,
        shot("TC-MOM99-007 Step 3 List view setelah Create"),
      );
    },
  );

  test(
    "TC-MOM99-008 Default values on New, and Repair Storage Location is optional",
    {
      tag: ["@positive", "@TC-MOM99-008"],
      annotation: { type: "tc-version", description: "1" },
    },
    async ({ page, data }, testInfo) => {
      const {
        repairStorageLocation: _r,
        externalCode: _e,
        ...line
      } = lineInput(data, "DS-MOM99-29");

      await plPage.open();
      await plPage.startCreate(line); // toggles not touched
      await plPage.expectFormToggles({
        productionLine: true,
        twoStepTransfer: false,
        autoTransferToRepair: false,
      });
      await plPage.saveNew(line.code);
      await data.created("DS-MOM99-29");

      await plPage.expectDetail({
        repairStorageLocation: "",
        externalCode: "",
      });
      await attachScreenshot(
        page,
        testInfo,
        shot("TC-MOM99-008 Step 4 Detail view setelah Create"),
      );

      await plPage.expectSavedToggles(line.code, {
        productionLine: true,
        twoStepTransfer: false,
        autoTransferToRepair: false,
      });

      await attachScreenshot(
        page,
        testInfo,
        shot("TC-MOM99-008 Step 5 Detail view"),
      );
    },
  );

  test(
    "TC-MOM99-009 Create a line with non-default toggle values",
    {
      tag: ["@positive", "@TC-MOM99-009"],
      annotation: { type: "tc-version", description: "1" },
    },
    async ({ page, data }, testInfo) => {
      const line = lineInput(data, "DS-MOM99-29", {
        productionLine: false,
        twoStepTransfer: true,
        autoTransferToRepair: true,
      });
      await createLine(data, "DS-MOM99-29", line);

      await plPage.open();
      await plPage.expectLine(line.code, {
        "Two Step Transfer": true,
        "Auto Transfer to Repair": true,
        "Repair Storage Location": data.get("DS-MOM99-09").value("Name"),
      });
      await attachScreenshot(
        page,
        testInfo,
        shot("TC-MOM99-009 Step 3 List view setelah Create"),
      );

      await plPage.expectSavedToggles(line.code, {
        productionLine: false,
        twoStepTransfer: true,
        autoTransferToRepair: true,
      });

      await attachScreenshot(
        page,
        testInfo,
        shot("TC-MOM99-009 Step 4 Detail view"),
      );
    },
  );

  test(
    "TC-MOM99-010 Mandatory fields empty or spaces only",
    {
      tag: ["@negative", "@TC-MOM99-010"],
      annotation: { type: "tc-version", description: "1" },
    },
    async ({ page, data: _noDataSets }, testInfo) => {
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
    {
      tag: ["@positive", "@TC-MOM99-011"],
      annotation: { type: "tc-version", description: "1" },
    },
    async ({ page, data }, testInfo) => {
      variation(
        "Code, Name and Line No of DS-MOM99-29 typed with one space before and after.",
      );
      const line = lineInput(data, "DS-MOM99-29");
      requireData(
        line.lineNo.length <= 8,
        "DS-MOM99-29 Line No must leave room for 2 spaces within 10 characters.",
      );

      await createLine(data, "DS-MOM99-29", {
        ...line,
        code: ` ${line.code} `,
        name: ` ${line.name} `,
        lineNo: ` ${line.lineNo} `,
      });

      await plPage.openDetail(line.code); // H6 title = trimmed Code
      await plPage.expectDetail({
        code: line.code,
        name: line.name,
        lineNo: line.lineNo,
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
    {
      tag: ["@positive", "@TC-MOM99-012"],
      annotation: { type: "tc-version", description: "1" },
    },
    async ({ page, data }, testInfo) => {
      const typed = lineInput(data, "DS-MOM99-30");
      const externalCode = typed.externalCode ?? "";
      // DS-MOM99-30 must be longer than each limit, or the test proves nothing: Blocked, not Fail.
      requireData(
        typed.code.length > 50,
        `DS-MOM99-30 Code has ${typed.code.length} characters, needs more than 50.`,
      );
      requireData(
        typed.name.length > 100,
        `DS-MOM99-30 Name has ${typed.name.length} characters, needs more than 100.`,
      );
      requireData(
        typed.lineNo.length > 10,
        `DS-MOM99-30 Line No has ${typed.lineNo.length} characters, needs more than 10.`,
      );
      requireData(
        externalCode.length > 100,
        `DS-MOM99-30 External Code has ${externalCode.length} characters, needs more than 100.`,
      );
      const kept = {
        code: typed.code.slice(0, 50),
        name: typed.name.slice(0, 100),
        lineNo: typed.lineNo.slice(0, 10),
        externalCode: externalCode.slice(0, 100),
      };

      await plPage.open();
      await plPage.startCreate(typed, { typeText: true });
      await plPage.expectFormValues(kept);
      await attachScreenshot(
        page,
        testInfo,
        shot("TC-MOM99-012 Step 1 Detail view"),
      );

      await plPage.saveNew(kept.code);
      await data.created("DS-MOM99-30");
      await plPage.expectDetail(kept);

      await attachScreenshot(
        page,
        testInfo,
        shot("TC-MOM99-012 Step 3 Detail view setelah Create"),
      );
    },
  );

  test(
    "TC-MOM99-014 Duplicate code is refused, ignoring case, across factories and against inactive lines",
    {
      tag: ["@negative", "@TC-MOM99-014"],
      annotation: { type: "tc-version", description: "1" },
    },
    async ({ page, data }, testInfo) => {
      variation("Step 1: Code of DS-MOM99-14 in lower case.");
      const existing = data.get("DS-MOM99-14").value("Code");
      const inactive = data.get("DS-MOM99-15").value("Code");
      const typed = existing.toLowerCase();

      await plPage.open();
      await plPage.startCreate(lineInput(data, "DS-MOM99-29", { code: typed }));
      await plPage.trySave();
      // Toast (UI). Value shown not confirmed: typed or existing spelling.
      await plPage.expectToast(
        duplicateRecordMessage([["Code", [typed, existing]]]),
      );
      await attachScreenshot(
        page,
        testInfo,
        shot("TC-MOM99-014 Step 1 Detail view setelah Create ditolak"),
      );

      await plPage.open();
      await plPage.expectInList(existing);
      await plPage.expectNotInList(typed); // nothing is saved (exact, case-sensitive match)

      await plPage.startCreate(
        lineInput(data, "DS-MOM99-29", { code: inactive }),
      );
      await plPage.trySave();
      await plPage.expectToast(duplicateRecordMessage([["Code", inactive]]));

      await attachScreenshot(
        page,
        testInfo,
        shot("TC-MOM99-014 Step 2 Detail view setelah Create ditolak"),
      );
    },
  );

  test(
    "TC-MOM99-015 Name, Line No and External Code can repeat",
    {
      tag: ["@positive", "@TC-MOM99-015"],
      annotation: { type: "tc-version", description: "1" },
    },
    async ({ page, data }, testInfo) => {
      variation(
        "Name, Line No and External Code of DS-MOM99-29 taken from DS-MOM99-14.",
      );
      const first = data.get("DS-MOM99-14");
      const same = {
        name: first.value("Name"),
        lineNo: first.value("Line No"),
        externalCode: first.value("External Code"),
      };
      const line = lineInput(data, "DS-MOM99-29", same);
      await createLine(data, "DS-MOM99-29", line);

      await plPage.open();
      for (const code of [first.value("Code"), line.code]) {
        await plPage.expectLine(code, {
          Name: same.name,
          "Line No": same.lineNo,
          "External Code": same.externalCode,
        });
      }

      await attachScreenshot(
        page,
        testInfo,
        shot("TC-MOM99-015 List view setelah Create"),
      );
    },
  );

  test(
    "TC-MOM99-016 Saving fails",
    {
      tag: ["@negative", "@TC-MOM99-016"],
      annotation: { type: "tc-version", description: "1" },
    },
    async ({ page, data }, testInfo) => {
      const line = lineInput(data, "DS-MOM99-29");
      await plPage.open();
      await plPage.startCreate(line);
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
      await plPage.expectNotInList(line.code); // nothing is saved

      await attachScreenshot(page, testInfo, shot("TC-MOM99-016 List view"));
    },
  );

  // ---------- 9.2.3 Process Master, Storage Location and Repair Storage Location ----------

  test(
    "TC-MOM99-017 Comboboxes show active records only, by name",
    {
      tag: ["@positive", "@TC-MOM99-017"],
      annotation: { type: "tc-version", description: "1" },
    },
    async ({ page, data }, testInfo) => {
      const pm = data.get("DS-MOM99-04").value("Name");
      const inactivePm = data.get("DS-MOM99-06").value("Name");
      const sloc = data.get("DS-MOM99-07").value("Name");
      const inactiveSloc = data.get("DS-MOM99-11").value("Name");

      await plPage.open();
      await plPage.openCreatePage();
      await plPage.expectReferenceOptions("processMaster", pm, inactivePm);
      await plPage.expectReferenceOptions(
        "storageLocation",
        sloc,
        inactiveSloc,
      );
      await plPage.expectReferenceOptions(
        "repairStorageLocation",
        sloc,
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
    {
      tag: ["@negative", "@TC-MOM99-018"],
      annotation: { type: "tc-version", description: "1" },
    },
    async ({ page, data }, testInfo) => {
      const line = lineInput(data, "DS-MOM99-29", {
        processMaster: data.get("DS-MOM99-05").value("Name"),
        repairStorageLocation: data.get("DS-MOM99-10").value("Name"),
      });
      await plPage.open();
      await plPage.startCreate(line);

      const other = await anotherUser(page); // user B; refused for anything not created by this run
      for (const ds of ["DS-MOM99-05", "DS-MOM99-08", "DS-MOM99-10"])
        await data.deactivate(ds, other);

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
    {
      tag: ["@negative", "@TC-MOM99-019"],
      annotation: { type: "tc-version", description: "1" },
    },
    async ({ page, data }, testInfo) => {
      const line = lineInput(data, "DS-MOM99-29", {
        storageLocation: data.get("DS-MOM99-10").value("Name"),
      });
      await plPage.open();
      await plPage.startCreate(line);

      await data.remove("DS-MOM99-10", await anotherUser(page)); // user B, by record number
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
    {
      tag: ["@positive", "@TC-MOM99-020"],
      annotation: { type: "tc-version", description: "1" },
    },
    async ({ page, data }, testInfo) => {
      const code = data.get("DS-MOM99-16").value("Code");
      const refs = {
        processMaster: data.get("DS-MOM99-06").value("Name"),
        storageLocation: data.get("DS-MOM99-11").value("Name"),
        repairStorageLocation: data.get("DS-MOM99-12").value("Name"),
      };

      await plPage.openDetail(code); // step 1: names still shown
      await plPage.expectDetail(refs);

      await plPage.open();
      await plPage.update(code, { externalCode: "EXT-NEW" }); // value from the FSD step

      await plPage.openDetail(code);
      await plPage.expectDetail({ externalCode: "EXT-NEW", ...refs });

      await attachScreenshot(
        page,
        testInfo,
        shot("TC-MOM99-020 Detail view setelah Update"),
      );
    },
  );

  test(
    "TC-MOM99-021 A changed reference that becomes inactive before Save is refused on Update",
    {
      tag: ["@negative", "@TC-MOM99-021"],
      annotation: { type: "tc-version", description: "1" },
    },
    async ({ page, data }, testInfo) => {
      const code = data.get("DS-MOM99-14").value("Code");

      await plPage.open();
      await plPage.startEdit(code, {
        processMaster: data.get("DS-MOM99-05").value("Name"),
        storageLocation: data.get("DS-MOM99-08").value("Name"),
        repairStorageLocation: data.get("DS-MOM99-10").value("Name"),
      });

      const other = await anotherUser(page); // user B
      for (const ds of ["DS-MOM99-05", "DS-MOM99-08", "DS-MOM99-10"])
        await data.deactivate(ds, other);

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

      await plPage.openDetail(code); // nothing changes
      await plPage.expectDetail({
        processMaster: data.get("DS-MOM99-04").value("Name"),
        storageLocation: data.get("DS-MOM99-07").value("Name"),
        repairStorageLocation: data.get("DS-MOM99-09").value("Name"),
      });

      await attachScreenshot(page, testInfo, shot("TC-MOM99-021 Detail view"));
    },
  );

  test(
    "TC-MOM99-022 A storage location whose area is inactive can be used",
    {
      tag: ["@positive", "@TC-MOM99-022"],
      annotation: { type: "tc-version", description: "1" },
    },
    async ({ page, data }, testInfo) => {
      const sloc = data.get("DS-MOM99-13").value("Name");
      const line = lineInput(data, "DS-MOM99-29", { storageLocation: sloc });

      await createLine(data, "DS-MOM99-29", line); // asserts H6 title = Code: the save is not refused
      await plPage.expectDetail({
        storageLocation: sloc,
        area: data.get("DS-MOM99-03").value("Name"),
      });

      await attachScreenshot(
        page,
        testInfo,
        shot("TC-MOM99-022 Detail view setelah Create"),
      );
    },
  );

  test(
    "TC-MOM99-023 One storage location serves many lines, as storage location and as repair storage location",
    {
      tag: ["@positive", "@TC-MOM99-023"],
      annotation: { type: "tc-version", description: "1" },
    },
    async ({ page, data }, testInfo) => {
      const sloc = data.get("DS-MOM99-07").value("Name");
      const repair = data.get("DS-MOM99-09").value("Name");
      const line = lineInput(data, "DS-MOM99-29", {
        storageLocation: sloc,
        repairStorageLocation: repair,
      });
      await createLine(data, "DS-MOM99-29", line);

      await plPage.open();
      for (const code of [data.get("DS-MOM99-14").value("Code"), line.code]) {
        await plPage.expectLine(code, {
          "Storage Location": sloc,
          "Repair Storage Location": repair,
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
    "TC-MOM99-024 Change the storage location of a line in use",
    {
      tag: ["@positive", "@TC-MOM99-024"],
      annotation: { type: "tc-version", description: "1" },
    },
    async ({ page, data }, testInfo) => {
      // Setup needs DS-MOM99-23 (Workstation Masters): Blocked until that Page Object exists.
      const code = data.get("DS-MOM99-14").value("Code");
      const sloc = data.get("DS-MOM99-08").value("Name");
      const area = data.get("DS-MOM99-02");

      await plPage.open();
      await plPage.update(code, { storageLocation: sloc });

      await plPage.openDetail(code);
      await plPage.expectDetail({
        storageLocation: sloc,
        area: area.value("Name"),
        factory: area.value("Factory"),
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
    {
      tag: ["@negative", "@TC-MOM99-025"],
      annotation: { type: "tc-version", description: "1" },
    },
    async ({ page, data }, testInfo) => {
      const sloc = data.get("DS-MOM99-08").value("Name");
      const line = lineInput(data, "DS-MOM99-29", {
        storageLocation: sloc,
        repairStorageLocation: sloc,
      });
      await plPage.open();
      await plPage.startCreate(line);
      await plPage.trySave();

      await plPage.expectMessage(PLM_MESSAGES.repairSameAsStorage(sloc));
      await attachScreenshot(
        page,
        testInfo,
        shot("TC-MOM99-025 Detail view setelah Create ditolak"),
      );

      await plPage.open();
      await plPage.expectNotInList(line.code); // nothing is saved

      await attachScreenshot(page, testInfo, shot("TC-MOM99-025 List view"));
    },
  );

  test(
    "TC-MOM99-026 Storage Location changed to the Repair Storage Location on Update",
    {
      tag: ["@negative", "@TC-MOM99-026"],
      annotation: { type: "tc-version", description: "1" },
    },
    async ({ page, data }, testInfo) => {
      const code = data.get("DS-MOM99-14").value("Code");
      const repair = data.get("DS-MOM99-09").value("Name");

      await plPage.open();
      await plPage.startEdit(code, { storageLocation: repair });
      await plPage.trySave();

      await plPage.expectMessage(PLM_MESSAGES.repairSameAsStorage(repair));
      await attachScreenshot(
        page,
        testInfo,
        shot("TC-MOM99-026 Detail view setelah Update ditolak"),
      );

      await plPage.openDetail(code);
      await plPage.expectDetail({
        storageLocation: data.get("DS-MOM99-07").value("Name"),
      }); // nothing changes

      await attachScreenshot(page, testInfo, shot("TC-MOM99-026 Detail view"));
    },
  );

  test(
    "TC-MOM99-027 Change and clear the repair storage location of a line in use",
    {
      tag: ["@positive", "@TC-MOM99-027"],
      annotation: { type: "tc-version", description: "1" },
    },
    async ({ page, data }, testInfo) => {
      // Setup needs DS-MOM99-23 (Workstation Masters): Blocked until that Page Object exists.
      partial(
        "Step 2 (clear Repair Storage Location) is not automated: no BasePage function to clear a combobox.",
      );
      const code = data.get("DS-MOM99-14").value("Code");
      const repair = data.get("DS-MOM99-10").value("Name");

      await plPage.open();
      await plPage.update(code, { repairStorageLocation: repair });

      await plPage.openDetail(code);
      await plPage.expectDetail({ repairStorageLocation: repair });

      await attachScreenshot(
        page,
        testInfo,
        shot("TC-MOM99-027 Step 1 Detail view setelah Update"),
      );
    },
  );

  test(
    "TC-MOM99-028 Auto Transfer to Repair Yes without a repair storage location on Create",
    {
      tag: ["@negative", "@TC-MOM99-028"],
      annotation: { type: "tc-version", description: "1" },
    },
    async ({ page, data }, testInfo) => {
      const { repairStorageLocation: _r, ...line } = lineInput(
        data,
        "DS-MOM99-29",
        { autoTransferToRepair: true },
      );
      await plPage.open();
      await plPage.startCreate(line);
      await plPage.trySave();

      await plPage.expectMessage(PLM_MESSAGES.autoTransferNeedsRepair);
      await attachScreenshot(
        page,
        testInfo,
        shot("TC-MOM99-028 Detail view setelah Create ditolak"),
      );

      await plPage.open();
      await plPage.expectNotInList(line.code); // nothing is saved

      await attachScreenshot(page, testInfo, shot("TC-MOM99-028 List view"));
    },
  );

  test(
    "TC-MOM99-029 Auto Transfer to Repair Yes without a repair storage location on Update",
    {
      tag: ["@negative", "@TC-MOM99-029"],
      annotation: { type: "tc-version", description: "1" },
    },
    async ({ page, data }, testInfo) => {
      partial(
        "Step 1 (clear Repair Storage Location of DS-MOM99-19) is not automated: no BasePage function to clear a combobox.",
      );
      const code = data.get("DS-MOM99-17").value("Code"); // Auto Transfer to Repair No, no repair storage location

      await plPage.open();
      await plPage.startEdit(code, { autoTransferToRepair: true });
      await plPage.trySave();

      await plPage.expectMessage(PLM_MESSAGES.autoTransferNeedsRepair);
      await attachScreenshot(
        page,
        testInfo,
        shot("TC-MOM99-029 Step 2 Detail view setelah Update ditolak"),
      );

      await plPage.expectSavedToggles(code, { autoTransferToRepair: false }); // nothing changes

      await attachScreenshot(page, testInfo, shot("TC-MOM99-029 Detail view"));
    },
  );

  // ---------- 9.2.4 Edit ----------

  test(
    "TC-MOM99-030 Edit name, line no and toggles",
    {
      tag: ["@positive", "@TC-MOM99-030"],
      annotation: { type: "tc-version", description: "1" },
    },
    async ({ page, data }, testInfo) => {
      const line = data.get("DS-MOM99-17");
      const code = line.value("Code");
      const changes = {
        name: `${line.value("Name")} X`, // FSD step 2
        lineNo: `${line.value("Line No")}X`,
        productionLine: false,
        twoStepTransfer: true,
      };

      await plPage.open();
      await plPage.update(code, changes);
      await plPage.expectDetail({ name: changes.name, lineNo: changes.lineNo }); // Code unchanged on the H6 title
      await attachScreenshot(
        page,
        testInfo,
        shot("TC-MOM99-030 Step 3 Detail view setelah Update"),
      );

      await plPage.expectSavedToggles(code, {
        productionLine: false,
        twoStepTransfer: true,
      });

      await attachScreenshot(
        page,
        testInfo,
        shot("TC-MOM99-030 Step 4 Detail view"),
      );
    },
  );

  test(
    "TC-MOM99-031 Mandatory fields cleared on Update",
    {
      tag: ["@negative", "@TC-MOM99-031"],
      annotation: { type: "tc-version", description: "1" },
    },
    async ({ page, data }, testInfo) => {
      partial(
        "Clearing Storage Location is not automated: no BasePage function to clear a combobox.",
      );
      const line = data.get("DS-MOM99-17");
      const code = line.value("Code");

      await plPage.open();
      await plPage.startEdit(code, { name: "   ", lineNo: "" });
      await plPage.trySave();

      await plPage.expectFieldErrors(["name", "lineNo"], STD_MESSAGES.required);
      await plPage.expectFormStillOpen();
      await attachScreenshot(
        page,
        testInfo,
        shot("TC-MOM99-031 Detail view setelah Update ditolak"),
      );

      await plPage.openDetail(code);
      await plPage.expectDetail({
        name: line.value("Name"),
        lineNo: line.value("Line No"),
      }); // nothing changes

      await attachScreenshot(page, testInfo, shot("TC-MOM99-031 Detail view"));
    },
  );

  test(
    "TC-MOM99-033 Save a line that another user deleted",
    {
      tag: ["@negative", "@TC-MOM99-033"],
      annotation: { type: "tc-version", description: "1" },
    },
    async ({ page, data }, testInfo) => {
      const code = data.get("DS-MOM99-17").value("Code");

      await plPage.open();
      await plPage.startEdit(code, { externalCode: "EXT-33" });

      await data.remove("DS-MOM99-17", await anotherUser(page)); // user B, by record number

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
      await plPage.expectNotInList(code);

      await attachScreenshot(
        page,
        testInfo,
        shot("TC-MOM99-033 Step 4 List view"),
      );
    },
  );

  test(
    "TC-MOM99-034 Save a line that another user changed after it was opened",
    {
      tag: ["@negative", "@TC-MOM99-034"],
      annotation: { type: "tc-version", description: "1" },
    },
    async ({ page, data }, testInfo) => {
      test.info().annotations.push({
        type: "classification",
        description:
          "Additional QA Recommendation (MOM-0029 FR-490). MOM-99 does not define this behavior.",
      });
      variation(
        'User B changes Name to the Name of DS-MOM99-17 with " B" added.',
      );
      const line = data.get("DS-MOM99-17");
      const code = line.value("Code");
      const newName = `${line.value("Name")} B`;

      await plPage.open();
      await plPage.startEdit(code, { externalCode: "EXT-NEW" });

      const other = new ProductionLineMastersPage(await anotherUser(page));
      await other.open();
      await other.update(code, { name: newName });

      await plPage.trySave();
      await plPage.expectDialogWithTitle(
        STD_DIALOGS.outdated.title,
        STD_DIALOGS.outdated.text,
      );
      await attachScreenshot(
        page,
        testInfo,
        shot("TC-MOM99-034 Step 1 Detail view setelah Update ditolak"),
      );

      await plPage.confirmDialog("Reload");
      await plPage.expectFormStillOpen(); // stays in edit mode
      await plPage.expectFormValues({
        name: newName,
        externalCode: line.values["External Code"] ?? "",
      }); // own change dropped

      await attachScreenshot(
        page,
        testInfo,
        shot("TC-MOM99-034 Step 2 Detail view"),
      );
    },
  );

  // ---------- 9.2.6 Delete ----------

  test(
    "TC-MOM99-036 Delete an unused line with an SMT configuration from its page",
    {
      tag: ["@positive", "@TC-MOM99-036"],
      annotation: { type: "tc-version", description: "1" },
    },
    async ({ page, data }, testInfo) => {
      // Setup needs DS-MOM99-28 (SMT Prod. Line Configurations): Blocked until that Page Object exists.
      const code = data.get("DS-MOM99-17").value("Code");

      await plPage.deleteFromDetail(code); // checks "Delete 1 Record?"
      data.removedByTest("DS-MOM99-17");

      await attachScreenshot(
        page,
        testInfo,
        shot("TC-MOM99-036 Step 3 List view setelah Delete"),
      );
    },
  );

  test(
    "TC-MOM99-037 Cancel the delete confirmation",
    {
      tag: ["@positive", "@TC-MOM99-037"],
      annotation: { type: "tc-version", description: "1" },
    },
    async ({ page, data }, testInfo) => {
      const codes = ["DS-MOM99-17", "DS-MOM99-18"].map((ds) =>
        data.get(ds).value("Code"),
      );

      await plPage.open();
      await plPage.cancelDelete(codes); // checks "Delete 2 Records?"

      await attachScreenshot(
        page,
        testInfo,
        shot("TC-MOM99-037 List view setelah Cancel Delete"),
      );
    },
  );

  test(
    "TC-MOM99-038 Delete several unused lines from the list",
    {
      tag: ["@positive", "@TC-MOM99-038"],
      annotation: { type: "tc-version", description: "1" },
    },
    async ({ page, data }, testInfo) => {
      partial(
        "Step 1 (Delete not available with no row ticked) is not automated: its disabled state is not confirmed with FE.",
      );
      const sets = ["DS-MOM99-17", "DS-MOM99-18"];

      await plPage.open();
      await plPage.delete(sets.map((ds) => data.get(ds).value("Code"))); // checks "Delete 2 Records?"
      for (const ds of sets) data.removedByTest(ds);

      await attachScreenshot(
        page,
        testInfo,
        shot("TC-MOM99-038 List view setelah Delete"),
      );
    },
  );

  test(
    "TC-MOM99-041 Delete from the list a line that another user deleted",
    {
      tag: ["@negative", "@TC-MOM99-041"],
      annotation: { type: "tc-version", description: "1" },
    },
    async ({ page, data }, testInfo) => {
      const gone = data.get("DS-MOM99-17").value("Code");
      const kept = data.get("DS-MOM99-18").value("Code");

      await plPage.open(); // step 1: the tester loads the list first
      await data.remove("DS-MOM99-17", await anotherUser(page)); // step 2: user B

      await plPage.selectRowsByColumn("Code", [gone, kept]);
      await plPage.clickDelete();
      await plPage.confirmDialog("Delete");
      await plPage.expectMessage(PLM_MESSAGES.linesNoLongerExist([gone]));
      await attachScreenshot(
        page,
        testInfo,
        shot("TC-MOM99-041 List view setelah Delete ditolak"),
      );

      await plPage.open();
      await plPage.expectInList(kept); // nothing is deleted

      await attachScreenshot(page, testInfo, shot("TC-MOM99-041 List view"));
    },
  );

  test(
    "TC-MOM99-042 Delete fails",
    {
      tag: ["@negative", "@TC-MOM99-042"],
      annotation: { type: "tc-version", description: "1" },
    },
    async ({ page, data }, testInfo) => {
      // Setup needs DS-MOM99-28 (SMT Prod. Line Configurations): Blocked until that Page Object exists.
      const code = data.get("DS-MOM99-17").value("Code");

      await plPage.openDetail(code);
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
      await plPage.expectInList(code); // nothing is deleted

      await attachScreenshot(page, testInfo, shot("TC-MOM99-042 List view"));
    },
  );
});
