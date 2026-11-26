/**
 * MOM-99 Production Line Masters — automation of FSD Section 9.2, run by TCMS (ZSN_ETCMS001).
 * Built from the MOM-99 FSD revision of 26 Nov 2026 (Section 9: DS-MOM99-01..33, TC-MOM99-001..051).
 * TC IDs follow the FSD: the same ID = the same test objective (TCMS key).
 *
 * TEST DATA: only from the TCMS run setup file (RUN_SETUP_FILE), through `data.get("DS-MOM99-..")`.
 * The script makes no value: no uid(), no Date.now(). The provider (src/tcms/dataProvider.ts)
 * creates the Setup data sets before the test body and deletes what it created by record number
 * after the test. A test that creates an Input data set calls `data.created(ds)` on its line page.
 *
 * Tags: @positive / @negative (FSD Type) and @TC-MOM99-xxx (TCMS selects by ID).
 * Annotation tc-version = the MOM-99 test case version the script was built from. All "1":
 * raise it when TCMS raises the version of a test case and the script is adapted.
 *
 * Variations (decided: in the script, from the TCMS values): lower case, spaces around, values
 * from another data set, a text added at the end. Each test that uses one says so in a
 * "variation" annotation.
 *
 * Automated:
 *  - @positive: 001, 005, 007, 012, 014, 015, 020, 021, 025, 026, 027, 028, 029, 034, 035, 045, 049
 *  - @negative: 004, 006, 008, 010, 013, 016, 017, 018, 019, 022, 023, 024, 031, 032, 036, 037,
 *               039, 047, 048, 050, 051
 *  Partial (see the "partial" annotation in each test): 001, 005, 010, 016, 018, 022, 023, 034, 035, 037.
 *  Blocked until a TCMS adapter (Page Object) exists for the menu of a data set (setup ends Blocked):
 *   - 020, 036 (DS-MOM99-25..27 Workstation Masters)
 *   - 034 (DS-MOM99-28 SMT Prod. Line Configurations)
 *   - 051 (DS-MOM99-29 Work Order Schedules, DS-MOM99-30 Material Allocations)
 *
 * Not automated (Manual in TCMS: no @TC tag):
 *  - 002 (edits Area Masters / Storage Locations: those Page Objects have no update yet)
 *  - 009, 011, 030, 041–044 (API requests: no API client yet)
 *  - 003, 040 (authorization: needs a second login without the action)
 *  - 033 (steps in Workstation Masters: no Page Object)
 *  - 038 (export download: no BasePage function yet)
 *  - 046 (Quick Search: its DOM / test ids are not known yet)
 *
 * Messages: STD_MESSAGES, STD_DIALOGS, PLM_MESSAGES, duplicateRecordMessage, maxLengthMessage.
 * Duplicate code and the delete-in-use messages are checked as toasts (confirmed UI; the FSD
 * says modal for duplicate: open conflict). Delete confirmation: "Delete 1 Record?" / "Delete {n} Records?".
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
  PLM_HIDDEN_COLUMNS,
  PLM_LIST_COLUMNS,
  PLM_MAX_LENGTH,
  PLM_MESSAGES,
  ProductionLineMastersPage,
} from "@menus/production-line/ProductionLineMastersPage";
import {
  STD_DIALOGS,
  STD_MESSAGES,
  duplicateRecordMessage,
  maxLengthMessage,
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
  const lineInput = (data: DataProvider, ds: string, changes: Partial<ProductionLineMaster> = {}) => ({
    ...toProductionLine(data.get(ds).values),
    ...changes,
  });

  /** Create the line of an Input data set through the menu, and hand it to cleanup. */
  const createLine = async (data: DataProvider, ds: string, line: ProductionLineMaster) => {
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

  test("TC-MOM99-001 The list shows active lines with the default columns and sort", { tag: ["@positive", "@TC-MOM99-001"], annotation: { type: "tc-version", description: "1" } }, async ({ page, data }, testInfo) => {
    partial("Default sort Code ascending is not checked: the test has one active line of its own, and the order of other lines depends on the database collation.");
    const line = data.get("DS-MOM99-14");
    const area = data.get("DS-MOM99-01");

    await plPage.open();
    await plPage.expectListColumns([...PLM_LIST_COLUMNS]);
    await plPage.expectColumnsHidden(PLM_HIDDEN_COLUMNS); // External Code hidden by default
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
      "Production Line": true,
      "Two Step Transfer": false,
      "Auto Transfer to Repair": false,
      Active: true,
    });
    await plPage.expectNotInList(data.get("DS-MOM99-15").value("Code")); // hidden by the default filter

    await attachScreenshot(page, testInfo, shot("TC-MOM99-001 List view"));
  });

  test("TC-MOM99-004 The list fails to load", { tag: ["@negative", "@TC-MOM99-004"], annotation: { type: "tc-version", description: "1" } }, async ({ page, data: _noDataSets }, testInfo) => {
    await failApi(page, PL_API, ["GET"]);

    await plPage.goto(plPage.path);
    await plPage.expectMessage(PLM_MESSAGES.listLoadFailed);

    await attachScreenshot(page, testInfo, shot("TC-MOM99-004 List view"));
  });

  test("TC-MOM99-005 The line page shows every field, and the derived fields, Code and Active are read only", { tag: ["@positive", "@TC-MOM99-005"], annotation: { type: "tc-version", description: "1" } }, async ({ page, data }, testInfo) => {
    partial("Step 3: only Code is checked read only. Area, Factory, Floor, Division and Active have no input locator.");
    const line = data.get("DS-MOM99-14");

    await plPage.openDetail(line.value("Code"));
    await plPage.expectDetail({ ...lineText(line), ...areaOf(data.get("DS-MOM99-01")) });
    await attachScreenshot(page, testInfo, shot("TC-MOM99-005 Step 1 Detail view"));

    await plPage.clickEdit();
    await plPage.expectCodeReadOnly();

    await attachScreenshot(page, testInfo, shot("TC-MOM99-005 Step 3 Detail view"));
  });

  test("TC-MOM99-006 The line page fails to load", { tag: ["@negative", "@TC-MOM99-006"], annotation: { type: "tc-version", description: "1" } }, async ({ page, data }, testInfo) => {
    const code = data.get("DS-MOM99-14").value("Code");

    await plPage.open();
    await failApi(page, PL_API, ["GET"]);
    await plPage.openDetailByColumn("Code", code);
    await plPage.expectMessage(PLM_MESSAGES.detailLoadFailed);

    await attachScreenshot(page, testInfo, shot("TC-MOM99-006 Detail view"));
  });

  test("TC-MOM99-045 Inactive lines show with the Custom Filter Active = FALSE", { tag: ["@positive", "@TC-MOM99-045"], annotation: { type: "tc-version", description: "1" } }, async ({ page, data }, testInfo) => {
    const active = data.get("DS-MOM99-14").value("Code");
    const inactive = data.get("DS-MOM99-15").value("Code");

    await plPage.open();
    await plPage.expectNotInList(inactive); // step 1: hidden by default
    await attachScreenshot(page, testInfo, shot("TC-MOM99-045 Step 1 List view"));

    await plPage.showInactiveOnly(); // step 2
    await plPage.expectLine(inactive, { Active: false });
    await plPage.expectNotInList(active);

    await attachScreenshot(page, testInfo, shot("TC-MOM99-045 Step 2 List view"));
  });

  // ---------- 9.2.2 Create ----------

  test("TC-MOM99-007 Create a line with all fields", { tag: ["@positive", "@TC-MOM99-007"], annotation: { type: "tc-version", description: "1" } }, async ({ page, data }, testInfo) => {
    const line = lineInput(data, "DS-MOM99-31");
    const area = areaOf(data.get("DS-MOM99-02"));

    await createLine(data, "DS-MOM99-31", line); // toggles not touched; asserts H6 title = Code
    await plPage.expectDetail({ ...line, ...area });
    await attachScreenshot(page, testInfo, shot("TC-MOM99-007 Step 2 Detail view setelah Create"));

    await plPage.open();
    await plPage.expectLine(line.code, {
      "Production Line": true,
      "Two Step Transfer": false,
      "Auto Transfer to Repair": false,
      Active: true,
    });

    await attachScreenshot(page, testInfo, shot("TC-MOM99-007 Step 3 List view setelah Create"));
  });

  test("TC-MOM99-008 Mandatory fields empty or spaces only", { tag: ["@negative", "@TC-MOM99-008"], annotation: { type: "tc-version", description: "1" } }, async ({ page, data: _noDataSets }, testInfo) => {
    await plPage.open();
    await plPage.startCreate({ code: "   ", name: "   " }); // Line No, Process Master, Storage Location empty
    await plPage.trySave();

    await plPage.expectFieldErrors(["code", "name", "lineNo", "processMaster", "storageLocation"], STD_MESSAGES.required);
    await plPage.expectFormStillOpen(); // nothing is saved

    await attachScreenshot(page, testInfo, shot("TC-MOM99-008 Detail view setelah Create ditolak"));
  });

  test("TC-MOM99-012 Code, Name and Line No are saved trimmed", { tag: ["@positive", "@TC-MOM99-012"], annotation: { type: "tc-version", description: "1" } }, async ({ page, data }, testInfo) => {
    variation("Code, Name and Line No of DS-MOM99-31 typed with one space before and after.");
    const line = lineInput(data, "DS-MOM99-31");
    requireData(line.lineNo.length <= PLM_MAX_LENGTH.lineNo - 2, "DS-MOM99-31 Line No must leave room for 2 spaces within 10 characters.");

    await createLine(data, "DS-MOM99-31", {
      ...line,
      code: ` ${line.code} `,
      name: ` ${line.name} `,
      lineNo: ` ${line.lineNo} `,
    });

    await plPage.openDetail(line.code); // H6 title = trimmed Code
    await plPage.expectDetail({ code: line.code, name: line.name, lineNo: line.lineNo });

    await attachScreenshot(page, testInfo, shot("TC-MOM99-012 Detail view setelah Create"));
  });

  test("TC-MOM99-013 Duplicate code is refused, ignoring case, also against an inactive line", { tag: ["@negative", "@TC-MOM99-013"], annotation: { type: "tc-version", description: "1" } }, async ({ page, data }, testInfo) => {
    variation("Codes of DS-MOM99-14 and DS-MOM99-15 typed in lower case.");
    const active = data.get("DS-MOM99-14").value("Code");
    const inactive = data.get("DS-MOM99-15").value("Code");

    await plPage.open();
    await plPage.startCreate(lineInput(data, "DS-MOM99-31", { code: active.toLowerCase() }));
    await plPage.trySave();
    // Toast (confirmed UI; FSD says modal "Duplicate Record"). {Code}: typed value (FSD example)
    // or the saved spelling, not confirmed: both accepted.
    await plPage.expectToast(duplicateRecordMessage([["Code", [active.toLowerCase(), active]]]));
    await attachScreenshot(page, testInfo, shot("TC-MOM99-013 Step 1 Detail view setelah Create ditolak"));

    await plPage.fill({ code: inactive.toLowerCase() }); // step 2: same form
    await plPage.trySave();
    await plPage.expectToast(duplicateRecordMessage([["Code", [inactive.toLowerCase(), inactive]]]));
    await attachScreenshot(page, testInfo, shot("TC-MOM99-013 Step 2 Detail view setelah Create ditolak"));

    await plPage.open();
    await plPage.expectNotInList(active.toLowerCase()); // nothing is saved (exact, case-sensitive match)
    await plPage.expectNotInList(inactive.toLowerCase());
  });

  test("TC-MOM99-014 The same name is allowed", { tag: ["@positive", "@TC-MOM99-014"], annotation: { type: "tc-version", description: "1" } }, async ({ page, data }, testInfo) => {
    variation("Name of DS-MOM99-31 taken from DS-MOM99-14.");
    const first = data.get("DS-MOM99-14");
    const line = lineInput(data, "DS-MOM99-31", { name: first.value("Name") });
    await createLine(data, "DS-MOM99-31", line);

    await plPage.open();
    for (const code of [first.value("Code"), line.code]) {
      await plPage.expectLine(code, { Name: first.value("Name") });
    }

    await attachScreenshot(page, testInfo, shot("TC-MOM99-014 List view setelah Create"));
  });

  test("TC-MOM99-015 The same line no is allowed", { tag: ["@positive", "@TC-MOM99-015"], annotation: { type: "tc-version", description: "1" } }, async ({ page, data }, testInfo) => {
    variation("Line No of DS-MOM99-31 taken from DS-MOM99-14.");
    const first = data.get("DS-MOM99-14");
    const line = lineInput(data, "DS-MOM99-31", { lineNo: first.value("Line No") });
    await createLine(data, "DS-MOM99-31", line);

    await plPage.open();
    for (const code of [first.value("Code"), line.code]) {
      await plPage.expectLine(code, { "Line No": first.value("Line No") });
    }

    await attachScreenshot(page, testInfo, shot("TC-MOM99-015 List view setelah Create"));
  });

  test("TC-MOM99-025 External Code is optional and not unique", { tag: ["@positive", "@TC-MOM99-025"], annotation: { type: "tc-version", description: "1" } }, async ({ page, data }, testInfo) => {
    variation("External Code of DS-MOM99-31 taken from DS-MOM99-14.");
    const external = data.get("DS-MOM99-14").value("External Code");

    await createLine(data, "DS-MOM99-31", lineInput(data, "DS-MOM99-31", { externalCode: external }));
    await plPage.expectDetail({ externalCode: external });
    await attachScreenshot(page, testInfo, shot("TC-MOM99-025 Step 1 Detail view setelah Create"));

    const { externalCode: _e, ...noExternal } = lineInput(data, "DS-MOM99-33");
    await createLine(data, "DS-MOM99-33", noExternal);
    await plPage.expectDetail({ externalCode: "" });

    await attachScreenshot(page, testInfo, shot("TC-MOM99-025 Step 2 Detail view setelah Create"));
  });

  test("TC-MOM99-026 Create an alternate-purpose line", { tag: ["@positive", "@TC-MOM99-026"], annotation: { type: "tc-version", description: "1" } }, async ({ page, data }, testInfo) => {
    const line = lineInput(data, "DS-MOM99-31", { productionLine: false });
    await createLine(data, "DS-MOM99-31", line);

    await plPage.open();
    await plPage.expectLine(line.code, { "Production Line": false });

    await attachScreenshot(page, testInfo, shot("TC-MOM99-026 List view setelah Create"));
  });

  test("TC-MOM99-039 Saving fails", { tag: ["@negative", "@TC-MOM99-039"], annotation: { type: "tc-version", description: "1" } }, async ({ page, data }, testInfo) => {
    const line = lineInput(data, "DS-MOM99-31");
    await plPage.open();
    await plPage.startCreate(line);
    const stop = await failApi(page, PL_API, ["POST", "PUT"]);

    await plPage.trySave();
    await plPage.expectMessage(PLM_MESSAGES.saveFailed);
    await attachScreenshot(page, testInfo, shot("TC-MOM99-039 Detail view setelah Create gagal"));

    await stop();
    await plPage.open();
    await plPage.expectNotInList(line.code); // nothing is saved

    await attachScreenshot(page, testInfo, shot("TC-MOM99-039 List view"));
  });

  test("TC-MOM99-047 Text over the maximum length is refused under the field", { tag: ["@negative", "@TC-MOM99-047"], annotation: { type: "tc-version", description: "1" } }, async ({ page, data }, testInfo) => {
    const typed = lineInput(data, "DS-MOM99-32");
    const externalCode = typed.externalCode ?? "";
    const length = { code: typed.code.length, name: typed.name.length, lineNo: typed.lineNo.length, externalCode: externalCode.length };
    // DS-MOM99-32 must be longer than each limit, or the test proves nothing: Blocked, not Fail.
    for (const [field, max] of Object.entries(PLM_MAX_LENGTH) as [keyof typeof PLM_MAX_LENGTH, number][]) {
      requireData(length[field] > max, `DS-MOM99-32 ${field} has ${length[field]} characters, needs more than ${max}.`);
    }

    await plPage.open();
    await plPage.startCreate(typed, { typeText: true });
    await plPage.trySave();

    await plPage.expectFieldErrorsEach({
      code: maxLengthMessage(PLM_MAX_LENGTH.code, length.code),
      name: maxLengthMessage(PLM_MAX_LENGTH.name, length.name),
      lineNo: maxLengthMessage(PLM_MAX_LENGTH.lineNo, length.lineNo),
      externalCode: maxLengthMessage(PLM_MAX_LENGTH.externalCode, length.externalCode),
    });
    await plPage.expectFormStillOpen(); // nothing is saved

    await attachScreenshot(page, testInfo, shot("TC-MOM99-047 Detail view setelah Create ditolak"));
  });

  // ---------- 9.2.3 Process Master, Storage Location and Repair Storage Location ----------

  test("TC-MOM99-010 Repair Storage Location is optional, but required for Auto Transfer to Repair", { tag: ["@negative", "@TC-MOM99-010"], annotation: { type: "tc-version", description: "1" } }, async ({ page, data }, testInfo) => {
    partial("Steps 4 and 5 (clear Repair Storage Location) are not automated: no BasePage function to clear a combobox.");
    const { repairStorageLocation: _r, ...line } = lineInput(data, "DS-MOM99-31");
    const repair = data.get("DS-MOM99-09").value("Name");

    await createLine(data, "DS-MOM99-31", line); // step 1: Auto Transfer to Repair off
    await plPage.expectDetail({ repairStorageLocation: "" });
    await attachScreenshot(page, testInfo, shot("TC-MOM99-010 Step 1 Detail view setelah Create"));

    await plPage.clickEdit(); // step 2
    await plPage.fill({ autoTransferToRepair: true });
    await plPage.trySave();
    await plPage.expectFieldErrors(["repairStorageLocation"], STD_MESSAGES.required);
    await plPage.expectFormStillOpen();
    await attachScreenshot(page, testInfo, shot("TC-MOM99-010 Step 2 Detail view setelah Update ditolak"));

    await plPage.fill({ repairStorageLocation: repair }); // step 3
    await plPage.saveNew(line.code);
    await plPage.expectDetail({ repairStorageLocation: repair });
    await plPage.expectSavedToggles(line.code, { autoTransferToRepair: true });

    await attachScreenshot(page, testInfo, shot("TC-MOM99-010 Step 3 Detail view setelah Update"));
  });

  test("TC-MOM99-016 An inactive process master cannot be used on a new line", { tag: ["@negative", "@TC-MOM99-016"], annotation: { type: "tc-version", description: "1" } }, async ({ page, data }, testInfo) => {
    partial("Step 2 (create request through the API) is not automated: no API client yet.");
    await plPage.open();
    await plPage.openCreatePage();
    await plPage.expectReferenceOptions(
      "processMaster",
      data.get("DS-MOM99-31").value("Process Master"), // active, so the combobox is known to work
      data.get("DS-MOM99-06").value("Name"),
    );

    await attachScreenshot(page, testInfo, shot("TC-MOM99-016 Step 1 Detail view (New)"));
  });

  test("TC-MOM99-017 A line whose process master became inactive cannot be saved until another one is selected", { tag: ["@negative", "@TC-MOM99-017"], annotation: { type: "tc-version", description: "1" } }, async ({ page, data }, testInfo) => {
    const code = data.get("DS-MOM99-16").value("Code");
    const newPm = data.get("DS-MOM99-05").value("Name");

    await plPage.openDetail(code); // step 1
    await plPage.expectDetail({ processMaster: data.get("DS-MOM99-06").value("Name") });

    await plPage.clickEdit(); // step 2: Process Master not changed
    await plPage.fill({ externalCode: "EXT-NEW" });
    await plPage.trySave();
    await plPage.expectFieldErrors(["processMaster"], STD_MESSAGES.inactiveRecord);
    await plPage.expectFormStillOpen();
    await attachScreenshot(page, testInfo, shot("TC-MOM99-017 Step 2 Detail view setelah Update ditolak"));

    await plPage.fill({ processMaster: newPm }); // step 3
    await plPage.saveNew(code);
    await plPage.expectDetail({ processMaster: newPm, externalCode: "EXT-NEW" });

    await attachScreenshot(page, testInfo, shot("TC-MOM99-017 Step 3 Detail view setelah Update"));
  });

  test("TC-MOM99-018 An inactive storage location cannot be used on a new line", { tag: ["@negative", "@TC-MOM99-018"], annotation: { type: "tc-version", description: "1" } }, async ({ page, data }, testInfo) => {
    partial("Step 2 (create request through the API) is not automated: no API client yet.");
    await plPage.open();
    await plPage.openCreatePage();
    await plPage.expectReferenceOptions(
      "storageLocation",
      data.get("DS-MOM99-31").value("Storage Location"),
      data.get("DS-MOM99-11").value("Name"),
    );

    await attachScreenshot(page, testInfo, shot("TC-MOM99-018 Step 1 Detail view (New)"));
  });

  test("TC-MOM99-019 A line whose storage location became inactive cannot be saved until another one is selected", { tag: ["@negative", "@TC-MOM99-019"], annotation: { type: "tc-version", description: "1" } }, async ({ page, data }, testInfo) => {
    const code = data.get("DS-MOM99-17").value("Code");
    const newSloc = data.get("DS-MOM99-07").value("Name");

    await plPage.openDetail(code); // step 1
    await plPage.expectDetail({ storageLocation: data.get("DS-MOM99-11").value("Name") });

    await plPage.clickEdit(); // step 2: Storage Location not changed
    await plPage.fill({ externalCode: "EXT-NEW" });
    await plPage.trySave();
    await plPage.expectFieldErrors(["storageLocation"], STD_MESSAGES.inactiveRecord);
    await plPage.expectFormStillOpen();
    await attachScreenshot(page, testInfo, shot("TC-MOM99-019 Step 2 Detail view setelah Update ditolak"));

    await plPage.fill({ storageLocation: newSloc }); // step 3
    await plPage.saveNew(code);
    await plPage.expectDetail({ storageLocation: newSloc, area: data.get("DS-MOM99-01").value("Name") });

    await attachScreenshot(page, testInfo, shot("TC-MOM99-019 Step 3 Detail view setelah Update"));
  });

  test("TC-MOM99-020 One storage location serves many lines, and the storage location of a line in use can be changed", { tag: ["@positive", "@TC-MOM99-020"], annotation: { type: "tc-version", description: "1" } }, async ({ page, data }, testInfo) => {
    // Setup needs DS-MOM99-25 and 26 (Workstation Masters): Blocked until that adapter exists.
    const sloc = data.get("DS-MOM99-07").value("Name");
    const inUse = data.get("DS-MOM99-19").value("Code");
    const line = lineInput(data, "DS-MOM99-31", { storageLocation: sloc });
    await createLine(data, "DS-MOM99-31", line); // step 1

    await plPage.open(); // step 2
    for (const code of [inUse, line.code]) await plPage.expectLine(code, { "Storage Location": sloc });
    await attachScreenshot(page, testInfo, shot("TC-MOM99-020 Step 2 List view setelah Create"));

    const newSloc = data.get("DS-MOM99-08").value("Name"); // step 3
    await plPage.update(inUse, { storageLocation: newSloc });
    await plPage.expectDetail({ storageLocation: newSloc, area: data.get("DS-MOM99-02").value("Name") });

    await attachScreenshot(page, testInfo, shot("TC-MOM99-020 Step 3 Detail view setelah Update"));
  });

  test("TC-MOM99-021 A storage location whose area is inactive can be used", { tag: ["@positive", "@TC-MOM99-021"], annotation: { type: "tc-version", description: "1" } }, async ({ page, data }, testInfo) => {
    const sloc = data.get("DS-MOM99-13").value("Name");
    const line = lineInput(data, "DS-MOM99-31", { storageLocation: sloc });

    await createLine(data, "DS-MOM99-31", line); // asserts H6 title = Code: the save is not refused
    await plPage.expectDetail({ storageLocation: sloc, area: data.get("DS-MOM99-03").value("Name") });

    await attachScreenshot(page, testInfo, shot("TC-MOM99-021 Detail view setelah Create"));
  });

  test("TC-MOM99-022 An inactive repair storage location cannot be used on a new line", { tag: ["@negative", "@TC-MOM99-022"], annotation: { type: "tc-version", description: "1" } }, async ({ page, data }, testInfo) => {
    partial("Step 2 (create request through the API) is not automated: no API client yet.");
    await plPage.open();
    await plPage.openCreatePage();
    await plPage.expectReferenceOptions(
      "repairStorageLocation",
      data.get("DS-MOM99-31").value("Repair Storage Location"),
      data.get("DS-MOM99-11").value("Name"),
    );

    await attachScreenshot(page, testInfo, shot("TC-MOM99-022 Step 1 Detail view (New)"));
  });

  test("TC-MOM99-023 A line whose repair storage location became inactive cannot be saved until it is changed or cleared", { tag: ["@negative", "@TC-MOM99-023"], annotation: { type: "tc-version", description: "1" } }, async ({ page, data }, testInfo) => {
    partial("Step 4 (clear Repair Storage Location) is not automated: no BasePage function to clear a combobox.");
    const code = data.get("DS-MOM99-18").value("Code");
    const newRepair = data.get("DS-MOM99-10").value("Name");

    await plPage.openDetail(code); // step 1
    await plPage.expectDetail({ repairStorageLocation: data.get("DS-MOM99-12").value("Name") });

    await plPage.clickEdit(); // step 2: Repair Storage Location not changed
    await plPage.fill({ externalCode: "EXT-NEW" });
    await plPage.trySave();
    await plPage.expectFieldErrors(["repairStorageLocation"], STD_MESSAGES.inactiveRecord);
    await plPage.expectFormStillOpen();
    await attachScreenshot(page, testInfo, shot("TC-MOM99-023 Step 2 Detail view setelah Update ditolak"));

    await plPage.fill({ repairStorageLocation: newRepair }); // step 3
    await plPage.saveNew(code);
    await plPage.expectDetail({ repairStorageLocation: newRepair });

    await attachScreenshot(page, testInfo, shot("TC-MOM99-023 Step 3 Detail view setelah Update"));
  });

  test("TC-MOM99-024 Repair Storage Location the same as Storage Location is refused", { tag: ["@negative", "@TC-MOM99-024"], annotation: { type: "tc-version", description: "1" } }, async ({ page, data }, testInfo) => {
    const sloc = data.get("DS-MOM99-08").value("Name");
    const line = lineInput(data, "DS-MOM99-31", { storageLocation: sloc, repairStorageLocation: sloc });

    await plPage.open(); // step 1
    await plPage.startCreate(line);
    await plPage.trySave();
    await plPage.expectFieldErrors(["repairStorageLocation"], PLM_MESSAGES.repairSameAsStorage);
    await plPage.expectFormStillOpen();
    await attachScreenshot(page, testInfo, shot("TC-MOM99-024 Step 1 Detail view setelah Create ditolak"));

    const existing = data.get("DS-MOM99-14").value("Code"); // step 2
    await plPage.open();
    await plPage.expectNotInList(line.code); // step 1: nothing is saved
    await plPage.startEdit(existing, { storageLocation: data.get("DS-MOM99-09").value("Name") });
    await plPage.trySave();
    await plPage.expectFieldErrors(["repairStorageLocation"], PLM_MESSAGES.repairSameAsStorage);
    await attachScreenshot(page, testInfo, shot("TC-MOM99-024 Step 2 Detail view setelah Update ditolak"));

    await plPage.openDetail(existing); // nothing is saved
    await plPage.expectDetail({ storageLocation: data.get("DS-MOM99-07").value("Name") });
  });

  test("TC-MOM99-048 A selected storage location deleted before Save is refused", { tag: ["@negative", "@TC-MOM99-048"], annotation: { type: "tc-version", description: "1" } }, async ({ page, data }, testInfo) => {
    const line = lineInput(data, "DS-MOM99-31", { storageLocation: data.get("DS-MOM99-10").value("Name") });
    await plPage.open();
    await plPage.startCreate(line);

    await data.remove("DS-MOM99-10", await anotherUser(page)); // another user, by record number
    await plPage.trySave();

    await plPage.expectFieldErrors(["storageLocation"], STD_MESSAGES.recordNotExist);
    await plPage.expectFormStillOpen(); // nothing is saved

    await attachScreenshot(page, testInfo, shot("TC-MOM99-048 Detail view setelah Create ditolak"));
  });

  // ---------- 9.2.4 Edit ----------

  test("TC-MOM99-027 Two Step Transfer is off by default and can be set on", { tag: ["@positive", "@TC-MOM99-027"], annotation: { type: "tc-version", description: "1" } }, async ({ page, data }, testInfo) => {
    const line = lineInput(data, "DS-MOM99-31");

    await plPage.open();
    await plPage.startCreate(line); // toggles not touched
    await plPage.expectFormToggles({ twoStepTransfer: false }); // step 1
    await plPage.saveNew(line.code); // step 2
    await data.created("DS-MOM99-31");

    await plPage.clickEdit(); // step 3
    await plPage.expectFormToggles({ twoStepTransfer: false }); // step 2: saved off
    await plPage.fill({ twoStepTransfer: true });
    await plPage.saveNew(line.code);

    await plPage.open(); // step 4
    await plPage.expectLine(line.code, { "Two Step Transfer": true });

    await attachScreenshot(page, testInfo, shot("TC-MOM99-027 Step 4 List view setelah Update"));
  });

  test("TC-MOM99-028 Auto Transfer to Repair is off by default and can be set on", { tag: ["@positive", "@TC-MOM99-028"], annotation: { type: "tc-version", description: "1" } }, async ({ page, data }, testInfo) => {
    const line = lineInput(data, "DS-MOM99-31"); // has a repair storage location

    await plPage.open();
    await plPage.startCreate(line);
    await plPage.expectFormToggles({ autoTransferToRepair: false }); // step 1
    await plPage.saveNew(line.code); // step 2
    await data.created("DS-MOM99-31");

    await plPage.clickEdit(); // step 3
    await plPage.expectFormToggles({ autoTransferToRepair: false }); // step 2: saved off
    await plPage.fill({ autoTransferToRepair: true });
    await plPage.saveNew(line.code);

    await plPage.open(); // step 4
    await plPage.expectLine(line.code, { "Auto Transfer to Repair": true });

    await attachScreenshot(page, testInfo, shot("TC-MOM99-028 Step 4 List view setelah Update"));
  });

  test("TC-MOM99-029 Edit name and line no", { tag: ["@positive", "@TC-MOM99-029"], annotation: { type: "tc-version", description: "1" } }, async ({ page, data }, testInfo) => {
    variation("\" A\" added to Name and \"A\" added to Line No of DS-MOM99-21 (FSD step 2).");
    const line = data.get("DS-MOM99-21");
    const code = line.value("Code");
    const changes = { name: `${line.value("Name")} A`, lineNo: `${line.value("Line No")}A` };

    await plPage.open();
    await plPage.update(code, changes);

    await plPage.openDetail(code); // step 4
    await plPage.expectDetail({ code, ...changes });

    await attachScreenshot(page, testInfo, shot("TC-MOM99-029 Detail view setelah Update"));
  });

  test("TC-MOM99-031 Save a line that another user deleted", { tag: ["@negative", "@TC-MOM99-031"], annotation: { type: "tc-version", description: "1" } }, async ({ page, data }, testInfo) => {
    const code = data.get("DS-MOM99-21").value("Code");

    await plPage.open();
    await plPage.startEdit(code, {});

    await data.remove("DS-MOM99-21", await anotherUser(page)); // step 2: another user, by record number

    await plPage.fill({ externalCode: "EXT-31" }); // step 3
    await plPage.trySave();
    await plPage.expectDialogWithTitle(STD_DIALOGS.deleted.title, STD_DIALOGS.deleted.text);
    await attachScreenshot(page, testInfo, shot("TC-MOM99-031 Step 3 Detail view setelah Update ditolak"));

    await plPage.confirmDialog("Back to List"); // step 4
    await plPage.expectTableLoaded();
    await plPage.expectNotInList(code);

    await attachScreenshot(page, testInfo, shot("TC-MOM99-031 Step 4 List view"));
  });

  test("TC-MOM99-032 Save a line that another user changed after it was opened", { tag: ["@negative", "@TC-MOM99-032"], annotation: { type: "tc-version", description: "1" } }, async ({ page, data }, testInfo) => {
    variation("Another user changes Name to the Name of DS-MOM99-21 with \" B\" added.");
    const line = data.get("DS-MOM99-21");
    const code = line.value("Code");
    const newName = `${line.value("Name")} B`;

    await plPage.open();
    await plPage.startEdit(code, {}); // step 1

    const other = new ProductionLineMastersPage(await anotherUser(page)); // step 2
    await other.open();
    await other.update(code, { name: newName });

    await plPage.fill({ externalCode: "EXT-NEW" }); // step 3
    await plPage.trySave();
    await plPage.expectDialogWithTitle(STD_DIALOGS.outdated.title, STD_DIALOGS.outdated.text);
    await attachScreenshot(page, testInfo, shot("TC-MOM99-032 Step 3 Detail view setelah Update ditolak"));

    await plPage.confirmDialog("Reload"); // step 4
    await plPage.expectFormStillOpen(); // stays in edit mode
    await plPage.expectFormValues({ name: newName, externalCode: line.values["External Code"] ?? "" }); // own change dropped

    await attachScreenshot(page, testInfo, shot("TC-MOM99-032 Step 4 Detail view"));
  });

  // ---------- 9.2.6 Delete ----------

  test("TC-MOM99-034 Delete an unused line with an SMT configuration from its page", { tag: ["@positive", "@TC-MOM99-034"], annotation: { type: "tc-version", description: "1" } }, async ({ page, data }, testInfo) => {
    // Setup needs DS-MOM99-28 (SMT Prod. Line Configurations): Blocked until that adapter exists.
    partial("Step 4 (no SMT configuration left) is not automated: no SMT Prod. Line Configurations Page Object.");
    const code = data.get("DS-MOM99-20").value("Code");

    await plPage.deleteFromDetail(code); // checks "Delete 1 Record?"
    data.removedByTest("DS-MOM99-20");
    data.removedByTest("DS-MOM99-28"); // deleted with the line (ON DELETE CASCADE)

    await attachScreenshot(page, testInfo, shot("TC-MOM99-034 Step 3 List view setelah Delete"));
  });

  test("TC-MOM99-035 Delete several unused lines from the list", { tag: ["@positive", "@TC-MOM99-035"], annotation: { type: "tc-version", description: "1" } }, async ({ page, data }, testInfo) => {
    partial("Step 1 (Delete not enabled with no row ticked) is not automated: its disabled state is not confirmed with FE.");
    const sets = ["DS-MOM99-20", "DS-MOM99-21"];

    await plPage.open();
    await plPage.delete(sets.map((ds) => data.get(ds).value("Code"))); // checks "Delete 2 Records?"
    for (const ds of sets) data.removedByTest(ds);

    await attachScreenshot(page, testInfo, shot("TC-MOM99-035 List view setelah Delete"));
  });

  test("TC-MOM99-036 A line used by workstations cannot be deleted, from the list or from its page", { tag: ["@negative", "@TC-MOM99-036"], annotation: { type: "tc-version", description: "1" } }, async ({ page, data }, testInfo) => {
    // Setup needs DS-MOM99-25..27 (Workstation Masters): Blocked until that adapter exists.
    const inUse = data.get("DS-MOM99-19").value("Code");
    const unused = data.get("DS-MOM99-21").value("Code");

    await plPage.open(); // step 1
    await plPage.tryDelete([inUse, unused]);
    await plPage.expectToast(STD_MESSAGES.deleteInUseList);
    await attachScreenshot(page, testInfo, shot("TC-MOM99-036 Step 1 List view setelah Delete ditolak"));
    await plPage.open();
    for (const code of [inUse, unused]) await plPage.expectInList(code); // nothing is deleted

    await plPage.tryDeleteFromDetail(inUse); // step 2
    await plPage.expectToast(STD_MESSAGES.deleteInUse);
    await attachScreenshot(page, testInfo, shot("TC-MOM99-036 Step 2 Detail view setelah Delete ditolak"));
    await plPage.open();
    await plPage.expectInList(inUse);
  });

  test("TC-MOM99-037 Delete from the list a line that another user deleted", { tag: ["@negative", "@TC-MOM99-037"], annotation: { type: "tc-version", description: "1" } }, async ({ page, data }, testInfo) => {
    partial("The modal button that closes Record Deleted is not known: the list is reloaded by the script, so the automatic list refresh is not checked.");
    const gone = data.get("DS-MOM99-21").value("Code");
    const kept = data.get("DS-MOM99-20").value("Code");

    await plPage.open(); // step 1
    await data.remove("DS-MOM99-21", await anotherUser(page)); // step 2: another user

    await plPage.tryDelete([gone, kept]); // steps 3 and 4
    await plPage.expectDialogWithTitle(STD_DIALOGS.deleted.title, STD_DIALOGS.deleted.text);
    await attachScreenshot(page, testInfo, shot("TC-MOM99-037 Step 4 List view setelah Delete ditolak"));

    await plPage.open();
    await plPage.expectNotInList(gone);
    await plPage.expectInList(kept); // all or none: nothing is deleted

    await attachScreenshot(page, testInfo, shot("TC-MOM99-037 List view"));
  });

  test("TC-MOM99-049 Cancel the delete confirmation", { tag: ["@positive", "@TC-MOM99-049"], annotation: { type: "tc-version", description: "1" } }, async ({ page, data }, testInfo) => {
    const codes = ["DS-MOM99-20", "DS-MOM99-21"].map((ds) => data.get(ds).value("Code"));

    await plPage.open();
    await plPage.cancelDelete(codes); // checks "Delete 2 Records?"

    await attachScreenshot(page, testInfo, shot("TC-MOM99-049 List view setelah Cancel Delete"));
  });

  test("TC-MOM99-050 Delete fails", { tag: ["@negative", "@TC-MOM99-050"], annotation: { type: "tc-version", description: "1" } }, async ({ page, data }, testInfo) => {
    const code = data.get("DS-MOM99-21").value("Code");

    await plPage.openDetail(code);
    // Delete may be sent as DELETE or as POST (several ids): fail both.
    const stop = await failApi(page, PL_API, ["DELETE", "POST"]);
    await plPage.clickDetailDelete();
    await plPage.confirmDialog("Delete");
    await plPage.expectMessage(PLM_MESSAGES.saveFailed);
    await attachScreenshot(page, testInfo, shot("TC-MOM99-050 Detail view setelah Delete gagal"));

    await stop();
    await plPage.open();
    await plPage.expectInList(code); // nothing is deleted

    await attachScreenshot(page, testInfo, shot("TC-MOM99-050 List view"));
  });

  test("TC-MOM99-051 A line used by a work order schedule or a material allocation line cannot be deleted", { tag: ["@negative", "@TC-MOM99-051"], annotation: { type: "tc-version", description: "1" } }, async ({ page, data }, testInfo) => {
    // Setup needs DS-MOM99-29 (Work Order Schedules) and DS-MOM99-30 (Material Allocations):
    // Blocked until those adapters exist.
    for (const ds of ["DS-MOM99-22", "DS-MOM99-23"]) {
      const code = data.get(ds).value("Code");
      await plPage.tryDeleteFromDetail(code);
      await plPage.expectToast(STD_MESSAGES.deleteInUse);
      await attachScreenshot(page, testInfo, shot(`TC-MOM99-051 ${ds} Detail view setelah Delete ditolak`));
      await plPage.open();
      await plPage.expectInList(code);
    }
  });
});