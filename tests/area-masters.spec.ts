/**
 * MOM-98 Area Masters — automation of FSD Section 9, run by TCMS (ZSN_ETCMS001).
 *
 * TEST DATA: only from the TCMS run setup file (RUN_SETUP_FILE), through `data.get("DS-MOM98-..")`.
 * Data sets: test-data/data-sets/MOM-98 Area Masters - Data Set.md (proposed Section 9.1; FSD
 * MOM-98 is still in the old Section 9 format). Local sample: test-data/run-setup/mom98.sample.json.
 * The script makes no value: no uid(), no Date.now(). The provider creates the Setup data sets
 * before the test body and deletes what it created by record number after the test, also when
 * the setup fails. A test that creates an Input data set calls `data.created(ds)`.
 *
 * Tags: @positive / @negative (FSD Type) and @TC-MOM98-xxx (TCMS selects by ID).
 * Annotation tc-version = the MOM-98 test case version the script was built from (FR-80).
 * Variations (TCMS open item #14: in the script, from the TCMS values): lower case, spaces
 * around, upper case. Each test that uses one says so in a "variation" annotation.
 *
 * Automated:
 *  - @positive: 001, 005, 008, 009, 013, 014, 015, 018, 020, 021, 022, 024, 025, 032, 033, 034
 *  - @negative: 004, 007, 010, 016, 019, 023, 026, 027, 035, 037, 038
 *  Partial (see the annotation in each test): 001, 027, 032, 035.
 *  Additional QA Recommendation (not in FSD Section 9), @negative: QA-MOM98-010a, 010b, 010c
 *  (mandatory fields left empty, both and one at a time; TC-010 covers spaces only).
 *  Tagged @QA-...: they run from a local run setup only; TCMS sends FSD test cases only.
 *
 * Not automated:
 *  - 002, 003 (Custom Filter / Quick Search: no BasePage function yet)
 *  - 006 (Active read only on New/Edit: Active has no locator, its DOM is not confirmed)
 *  - 011 (positive, typing over the max length: not automated yet)
 *  - 012, 030, 041, 042, 043 (API requests: no API client yet)
 *  - 017, 028, 029, 031, 036 (an area or a child record becomes inactive: not automated yet)
 *  - 039, 040 (authorization: needs a second login without the action)
 *
 * Messages: generic checks expect MOM-0029 (STD_MESSAGES / STD_DIALOGS), as FSD Section 9
 * states; MOM-98 business rules expect the FSD text (AM_MESSAGES). Where the FSD does not
 * say where a message shows, the test only checks that the exact text is on the page.
 * Toasts (confirmed in the UI, AUTOMATION_RULES Section 10): a duplicate Factory + Name
 * (016, 023) and the delete of an area in use (035) show a toast, not the MOM-0029
 * "Duplicate Record" modal / the MOM-98 FR-80 text. See expectToast(), duplicateRecordMessage().
 * Delete confirmation (confirmed in the UI): "Delete 1 Record?" / "Delete {qty} Records?",
 * not the FR-80 "Delete {N} areas?" / "Delete area {Name}?" texts. Checked inside
 * AreaMastersPage.delete / tryDelete / deleteFromDetail / cancelDelete (deleteConfirmMessage).
 * "Another user": a second page in the same browser context (same login).
 * Server errors: simulated with failApi() (network interception), no backend change needed.
 * Login is expected from the Playwright config (storageState).
 * Retries must be 0 in TCMS runs: a retry would create the same dummy values again.
 * Evidence: each test ends with attachScreenshot() — only reached when every step passed.
 */
import type { Page } from "@playwright/test";
import { test } from "@tcms/fixtures";
import type { DataProvider } from "@tcms/dataProvider";
import { AM_MESSAGES, AreaMastersPage } from "@menus/area-masters/AreaMastersPage";
import { toAreaMaster } from "@menus/area-masters/area-master.tcms";
import type { AreaMaster } from "@menus/area-masters/area-master.data";
import { STD_DIALOGS, STD_MESSAGES } from "@core/constants"; // duplicate toast: AreaMastersPage.expectDuplicateToast
import { attachScreenshot } from "@utils/screenshot";
import { failApi } from "@utils/network";

/** API calls of this menu (assumed path). The page URL also matches, but failApi() skips page loads. */
const AM_API = /area-?masters?/i;

const shot = (step: string) => `Area Masters - ${step}`;

test.describe("MOM-98 Area Masters", () => {
  let areaPage: AreaMastersPage;
  let extraPages: Page[];

  /** Page Object data of an area data set, with test-specific changes. */
  const area = (data: DataProvider, ds: string, changes: Partial<AreaMaster> = {}): AreaMaster => ({
    ...toAreaMaster(data.get(ds).values),
    ...changes,
  });

  /** Create the area of an Input data set through the menu, and hand it to cleanup. */
  const createArea = async (data: DataProvider, ds: string, value: AreaMaster) => {
    await areaPage.open();
    await areaPage.create(value);
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
    areaPage = new AreaMastersPage(page);
    extraPages = [];
    // Leaving a refused form may raise a browser "leave page?" prompt: accept it.
    page.on("dialog", (dialog) => dialog.accept());
  });

  test.afterEach(async ({ page }) => {
    // The data cleanup runs after this hook, in the TCMS fixture, by record number.
    await page.unrouteAll({ behavior: "ignoreErrors" });
    for (const other of extraPages) await other.close();
  });

  // ---------- 9.1 List and Area Page ----------

  test("TC-MOM98-001 List loads with the FSD columns", { tag: ["@positive", "@TC-MOM98-001"], annotation: { type: "tc-version", description: "1" } }, async ({ page, data: _noDataSets }, testInfo) => {
    partial("Inactive area hidden by default is not checked: needs the active/inactive process.");
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

    await attachScreenshot(page, testInfo, shot("TC-MOM98-001 List view"));
  });

  test("TC-MOM98-004 The list fails to load", { tag: ["@negative", "@TC-MOM98-004"], annotation: { type: "tc-version", description: "1" } }, async ({ page, data: _noDataSets }, testInfo) => {
    await failApi(page, AM_API, ["GET"]);

    await areaPage.goto(areaPage.path);
    await areaPage.expectMessage(AM_MESSAGES.listLoadFailed);

    await attachScreenshot(page, testInfo, shot("TC-MOM98-004 List view"));
  });

  test("TC-MOM98-005 Open an area shows every field", { tag: ["@positive", "@TC-MOM98-005"], annotation: { type: "tc-version", description: "1" } }, async ({ page, data }, testInfo) => {
    const value = area(data, "DS-MOM98-01");

    await areaPage.openDetail(value.name); // H6 title = Name
    await areaPage.expectDetail(value);

    await attachScreenshot(page, testInfo, shot("TC-MOM98-005 Detail view"));
  });

  test("TC-MOM98-007 The area page fails to load", { tag: ["@negative", "@TC-MOM98-007"], annotation: { type: "tc-version", description: "1" } }, async ({ page, data }, testInfo) => {
    const { name } = area(data, "DS-MOM98-01");

    await areaPage.open();
    await failApi(page, AM_API, ["GET"]);
    await areaPage.openDetailByColumn("Name", name);
    await areaPage.expectMessage(AM_MESSAGES.detailLoadFailed);

    await attachScreenshot(page, testInfo, shot("TC-MOM98-007 Detail view"));
  });

  // ---------- 9.2 Create ----------

  test("TC-MOM98-008 Create an area with all fields", { tag: ["@positive", "@TC-MOM98-008"], annotation: { type: "tc-version", description: "1" } }, async ({ page, data }, testInfo) => {
    const value = area(data, "DS-MOM98-02");
    await createArea(data, "DS-MOM98-02", value); // asserts H6 title = Name
    await areaPage.expectDetail(value); // Floor 16#5 accepted as entered
    await attachScreenshot(page, testInfo, shot("TC-MOM98-008 Step 3 Detail view setelah Create"));

    await areaPage.open();
    await areaPage.expectInList(value.name, value.factory);

    await attachScreenshot(page, testInfo, shot("TC-MOM98-008 Step 4 List view setelah Create"));
  });

  test("TC-MOM98-009 Create an area with mandatory fields only", { tag: ["@positive", "@TC-MOM98-009"], annotation: { type: "tc-version", description: "1" } }, async ({ page, data }, testInfo) => {
    const value = area(data, "DS-MOM98-03");
    await createArea(data, "DS-MOM98-03", value);

    await areaPage.openDetail(value.name);
    await areaPage.expectDetail({
      ...value,
      floor: "",
      division: "",
      description: "",
      remark: "",
    });

    await attachScreenshot(page, testInfo, shot("TC-MOM98-009 Detail view setelah Create"));
  });

  test("TC-MOM98-010 Factory and Name with only spaces are refused", { tag: ["@negative", "@TC-MOM98-010"], annotation: { type: "tc-version", description: "1" } }, async ({ page, data: _noDataSets }, testInfo) => {
    await areaPage.open();
    await areaPage.startCreate({ factory: "  ", name: "   " }); // spaces only: literal from the FSD step
    await areaPage.trySave();

    await areaPage.expectFieldErrors(["factory", "name"], STD_MESSAGES.required);
    await areaPage.expectFormStillOpen(); // nothing is saved

    await attachScreenshot(page, testInfo, shot("TC-MOM98-010 Detail view setelah Create ditolak"));
  });

  // Additional QA Recommendation: FSD Section 9 has no case for mandatory fields left
  // EMPTY (TC-010 covers spaces only, both fields at once). One field at a time shows
  // that each field has its own check (FR-30, MOM-0029 FR-460).
  const REQUIRED_EMPTY_CASES: {
    id: string;
    title: string;
    data: (data: DataProvider) => Partial<AreaMaster>;
    empty: (keyof AreaMaster)[];
  }[] = [
    { id: "QA-MOM98-010a", title: "Factory and Name left empty", data: () => ({}), empty: ["factory", "name"] },
    { id: "QA-MOM98-010b", title: "Factory left empty", data: (d) => ({ name: area(d, "DS-MOM98-03").name }), empty: ["factory"] },
    { id: "QA-MOM98-010c", title: "Name left empty", data: (d) => ({ factory: area(d, "DS-MOM98-03").factory }), empty: ["name"] },
  ];

  for (const c of REQUIRED_EMPTY_CASES) {
    test(`${c.id} ${c.title} is refused`, { tag: ["@negative", `@${c.id}`], annotation: { type: "tc-version", description: "1" } }, async ({ page, data }, testInfo) => {
      test.info().annotations.push({
        type: "classification",
        description: "Additional QA Recommendation (FR-30, MOM-0029 FR-460). Not a test case in FSD MOM-98 Section 9.",
      });
      const value = c.data(data);

      await areaPage.open();
      await areaPage.startCreate(value); // empty fields are not touched
      await areaPage.trySave();

      await areaPage.expectFieldErrors(c.empty, STD_MESSAGES.required);
      await areaPage.expectFormStillOpen(); // nothing is saved
      await attachScreenshot(page, testInfo, shot(`${c.id} Detail view setelah Create ditolak`));

      if (value.name) {
        await areaPage.open();
        await areaPage.expectNotInList(value.name); // nothing is saved

        await attachScreenshot(page, testInfo, shot(`${c.id} List view`));
      }
    });
  }

  test("TC-MOM98-013 Factory and Name are saved trimmed", { tag: ["@positive", "@TC-MOM98-013"], annotation: { type: "tc-version", description: "1" } }, async ({ page, data }, testInfo) => {
    variation("Factory and Name of DS-MOM98-03 typed with one space before and after.");
    const value = area(data, "DS-MOM98-03");
    await createArea(data, "DS-MOM98-03", { factory: ` ${value.factory} `, name: ` ${value.name} ` });

    await areaPage.openDetail(value.name); // H6 title = trimmed Name
    await areaPage.expectDetail({ factory: value.factory, name: value.name });

    await attachScreenshot(page, testInfo, shot("TC-MOM98-013 Detail view setelah Create"));
  });

  test("TC-MOM98-014 Factory is saved with the existing spelling on create", { tag: ["@positive", "@TC-MOM98-014"], annotation: { type: "tc-version", description: "1" } }, async ({ page, data }, testInfo) => {
    variation("Factory of DS-MOM98-05 (= factory of DS-MOM98-04) typed in lower case.");
    const existing = area(data, "DS-MOM98-04");
    const value = area(data, "DS-MOM98-05");
    await createArea(data, "DS-MOM98-05", { ...value, factory: value.factory.toLowerCase() });

    await areaPage.open();
    await areaPage.expectInList(value.name, existing.factory); // existing spelling

    await attachScreenshot(page, testInfo, shot("TC-MOM98-014 List view setelah Create"));
  });

  test("TC-MOM98-015 A new factory is saved as entered", { tag: ["@positive", "@TC-MOM98-015"], annotation: { type: "tc-version", description: "1" } }, async ({ page, data }, testInfo) => {
    const value = area(data, "DS-MOM98-06"); // factory starts in lower case (f + code)
    await createArea(data, "DS-MOM98-06", value);

    await areaPage.openDetail(value.name);
    await areaPage.expectDetail({ factory: value.factory }); // saved as entered

    await attachScreenshot(page, testInfo, shot("TC-MOM98-015 Detail view setelah Create"));
  });

  test("TC-MOM98-016 Duplicate name in the same factory, different case and spaces", { tag: ["@negative", "@TC-MOM98-016"], annotation: { type: "tc-version", description: "1" } }, async ({ page, data }, testInfo) => {
    variation("Factory and Name of DS-MOM98-04 in lower case, with one space before and after.");
    const existing = area(data, "DS-MOM98-04");
    const lowerFactory = existing.factory.toLowerCase();
    const lowerName = existing.name.toLowerCase();

    await areaPage.open();
    await areaPage.startCreate({ factory: ` ${lowerFactory} `, name: ` ${lowerName} ` });
    await areaPage.trySave();
    // Toast (not the MOM-0029 modal). Typed or existing spelling: not confirmed yet, accept both.
    await areaPage.expectDuplicateToast([lowerFactory, existing.factory], [lowerName, existing.name]);
    await attachScreenshot(page, testInfo, shot("TC-MOM98-016 Detail view setelah Create ditolak")); // right after the toast

    await areaPage.open();
    await areaPage.expectInList(existing.name, existing.factory);
    await areaPage.expectNotInList(lowerName); // nothing is saved

    await attachScreenshot(page, testInfo, shot("TC-MOM98-016 List view"));
  });

  test("TC-MOM98-018 Same name in two factories is allowed", { tag: ["@positive", "@TC-MOM98-018"], annotation: { type: "tc-version", description: "1" } }, async ({ page, data }, testInfo) => {
    const first = area(data, "DS-MOM98-04");
    const second = area(data, "DS-MOM98-07"); // same Name, factory G + code
    await createArea(data, "DS-MOM98-07", second);

    await areaPage.open();
    await areaPage.expectInList(first.name, first.factory);
    await areaPage.expectInList(second.name, second.factory);

    await attachScreenshot(page, testInfo, shot("TC-MOM98-018 List view setelah Create"));
  });

  test("TC-MOM98-019 Create fails on a database error", { tag: ["@negative", "@TC-MOM98-019"], annotation: { type: "tc-version", description: "1" } }, async ({ page, data }, testInfo) => {
    const value = area(data, "DS-MOM98-03");
    await areaPage.open();
    await areaPage.startCreate(value);
    const stop = await failApi(page, AM_API, ["POST", "PUT"]);

    await areaPage.trySave();
    await areaPage.expectMessage(AM_MESSAGES.saveFailed);
    await attachScreenshot(page, testInfo, shot("TC-MOM98-019 Detail view setelah Create gagal"));

    await stop();
    await areaPage.open();
    await areaPage.expectNotInList(value.name); // nothing is saved

    await attachScreenshot(page, testInfo, shot("TC-MOM98-019 List view"));
  });

  // ---------- 9.3 Edit ----------

  test("TC-MOM98-020 Edit the name and the division", { tag: ["@positive", "@TC-MOM98-020"], annotation: { type: "tc-version", description: "1" } }, async ({ page, data }, testInfo) => {
    const oldName = area(data, "DS-MOM98-08").name;
    const changes = toAreaMaster(data.get("DS-MOM98-09").values); // new Name and Division

    await areaPage.open();
    await areaPage.update(oldName, changes);

    await areaPage.openDetail(changes.name); // H6 title = new Name
    await areaPage.expectDetail(changes);

    await attachScreenshot(page, testInfo, shot("TC-MOM98-020 Detail view setelah Update"));
  });

  test("TC-MOM98-021 Edit without changing the name is not a duplicate", { tag: ["@positive", "@TC-MOM98-021"], annotation: { type: "tc-version", description: "1" } }, async ({ page, data }, testInfo) => {
    const value = area(data, "DS-MOM98-04");

    await areaPage.open();
    await areaPage.update(value.name, { remark: "Updated" }); // asserts no Duplicate Record modal

    await areaPage.openDetail(value.name); // H6 title = Name
    await areaPage.expectDetail({ ...value, remark: "Updated" });

    await attachScreenshot(page, testInfo, shot("TC-MOM98-021 Detail view setelah Update"));
  });

  test("TC-MOM98-022 Change only the case of the area's own name", { tag: ["@positive", "@TC-MOM98-022"], annotation: { type: "tc-version", description: "1" } }, async ({ page, data }, testInfo) => {
    variation("Name of DS-MOM98-11 (\"Main Store ...\") changed to upper case.");
    const oldName = area(data, "DS-MOM98-11").name;
    const newName = oldName.toUpperCase();

    await areaPage.open();
    await areaPage.update(oldName, { name: newName });

    await areaPage.openDetail(newName); // H6 title, exact case
    await areaPage.expectDetail({ name: newName });

    await attachScreenshot(page, testInfo, shot("TC-MOM98-022 Detail view setelah Update"));
  });

  test("TC-MOM98-023 Move an area to a factory where the name exists", { tag: ["@negative", "@TC-MOM98-023"], annotation: { type: "tc-version", description: "1" } }, async ({ page, data }, testInfo) => {
    variation("Factory of DS-MOM98-10 typed in lower case.");
    const moved = area(data, "DS-MOM98-08"); // factory F + code
    const other = area(data, "DS-MOM98-10"); // same Name, factory G + code
    const typed = other.factory.toLowerCase();

    await areaPage.open();
    // The same name is in both factories: open the row by its factory (it holds only this area).
    await areaPage.startEdit(moved.name, { factory: typed }, { byFactory: moved.factory });
    await areaPage.trySave();
    // Toast. FSD expects the existing spelling; the typed spelling is also accepted until confirmed.
    await areaPage.expectDuplicateToast([typed, other.factory], moved.name);
    await attachScreenshot(page, testInfo, shot("TC-MOM98-023 Detail view setelah Update ditolak")); // right after the toast

    await areaPage.open();
    await areaPage.expectInList(moved.name, moved.factory); // the area stays in its factory
    await areaPage.expectInList(other.name, other.factory);

    await attachScreenshot(page, testInfo, shot("TC-MOM98-023 List view"));
  });

  test("TC-MOM98-024 Factory is saved with the existing spelling on edit", { tag: ["@positive", "@TC-MOM98-024"], annotation: { type: "tc-version", description: "1" } }, async ({ page, data }, testInfo) => {
    variation("Factory of DS-MOM98-13 typed in lower case.");
    const value = area(data, "DS-MOM98-12");
    const target = area(data, "DS-MOM98-13");

    await areaPage.open();
    await areaPage.update(value.name, { factory: target.factory.toLowerCase() });

    await areaPage.openDetail(value.name);
    await areaPage.expectDetail({ factory: target.factory }); // existing spelling

    await attachScreenshot(page, testInfo, shot("TC-MOM98-024 Detail view setelah Update"));
  });

  test("TC-MOM98-025 On edit, the area itself is not used for the factory spelling", { tag: ["@positive", "@TC-MOM98-025"], annotation: { type: "tc-version", description: "1" } }, async ({ page, data }, testInfo) => {
    variation("Factory of DS-MOM98-14 (\"f...\") changed to upper case.");
    const value = area(data, "DS-MOM98-14");
    const upper = value.factory.toUpperCase();

    await areaPage.open();
    await areaPage.update(value.name, { factory: upper });

    await areaPage.openDetail(value.name);
    await areaPage.expectDetail({ factory: upper });

    await attachScreenshot(page, testInfo, shot("TC-MOM98-025 Detail view setelah Update"));
  });

  test("TC-MOM98-026 Edit an area that another user deleted", { tag: ["@negative", "@TC-MOM98-026"], annotation: { type: "tc-version", description: "1" } }, async ({ page, data }, testInfo) => {
    const { name } = area(data, "DS-MOM98-15");

    await areaPage.open();
    await areaPage.startEdit(name, { remark: "X" });

    await data.remove("DS-MOM98-15", await anotherUser(page)); // user B, by record number

    await areaPage.trySave();
    await areaPage.expectDialogWithTitle(STD_DIALOGS.deleted.title, STD_DIALOGS.deleted.text);
    await attachScreenshot(page, testInfo, shot("TC-MOM98-026 Step 2 Detail view setelah Update ditolak"));

    await areaPage.confirmDialog("Back to List");
    await areaPage.expectTableLoaded();
    await areaPage.expectNotInList(name);

    await attachScreenshot(page, testInfo, shot("TC-MOM98-026 Step 3 List view"));
  });

  test("TC-MOM98-027 Edit an area that another user changed", { tag: ["@negative", "@TC-MOM98-027"], annotation: { type: "tc-version", description: "1" } }, async ({ page, data }, testInfo) => {
    partial("\"No overwrite option is offered\" is not checked: no BasePage function to check a dialog has no such button.");
    const { name } = area(data, "DS-MOM98-16"); // no Division, no Remark

    await areaPage.open();
    await areaPage.startEdit(name, { remark: "Tester" });

    const other = new AreaMastersPage(await anotherUser(page));
    await other.open();
    await other.update(name, { division: "SMT" });

    await areaPage.trySave();
    await areaPage.expectDialogWithTitle(STD_DIALOGS.outdated.title, STD_DIALOGS.outdated.text);
    await attachScreenshot(page, testInfo, shot("TC-MOM98-027 Step 2 Detail view setelah Update ditolak"));

    await areaPage.confirmDialog("Reload");
    await areaPage.expectFormStillOpen(); // stays in edit mode
    await areaPage.expectFormValues({ division: "SMT", remark: "" }); // latest data, own change dropped

    await attachScreenshot(page, testInfo, shot("TC-MOM98-027 Step 3 Detail view"));
  });

  // ---------- 9.5 Delete ----------

  test("TC-MOM98-032 Delete unused areas from the list", { tag: ["@positive", "@TC-MOM98-032"], annotation: { type: "tc-version", description: "1" } }, async ({ page, data }, testInfo) => {
    partial("Step 4 (Custom Filter Active = No) not automated: no BasePage filter function yet.");
    const sets = ["DS-MOM98-17", "DS-MOM98-18"];

    await areaPage.open();
    await areaPage.delete(sets.map((ds) => area(data, ds).name)); // checks "Delete 2 Records?"
    for (const ds of sets) data.removedByTest(ds);

    await attachScreenshot(page, testInfo, shot("TC-MOM98-032 List view setelah Delete"));
  });

  test("TC-MOM98-033 Delete an unused area from the area page", { tag: ["@positive", "@TC-MOM98-033"], annotation: { type: "tc-version", description: "1" } }, async ({ page, data }, testInfo) => {
    await areaPage.deleteFromDetail(area(data, "DS-MOM98-17").name); // checks "Delete 1 Record?"
    data.removedByTest("DS-MOM98-17");

    await attachScreenshot(page, testInfo, shot("TC-MOM98-033 List view setelah Delete"));
  });

  test("TC-MOM98-034 Cancel the delete confirmation", { tag: ["@positive", "@TC-MOM98-034"], annotation: { type: "tc-version", description: "1" } }, async ({ page, data }, testInfo) => {
    await areaPage.open();
    await areaPage.cancelDelete([area(data, "DS-MOM98-17").name]); // checks "Delete 1 Record?"

    await attachScreenshot(page, testInfo, shot("TC-MOM98-034 List view setelah Cancel Delete"));
  });

  test("TC-MOM98-035 Delete is all-or-none when some areas are in use", { tag: ["@negative", "@TC-MOM98-035"], annotation: { type: "tc-version", description: "1" } }, async ({ page, data }, testInfo) => {
    partial("Area used by a digi tag is not covered: Digi Tag Masters has no Page Object. Only a storage location (DS-MOM98-19) is used as the child record.");
    const used = area(data, "DS-MOM98-04").name; // used by storage location DS-MOM98-19
    const free = area(data, "DS-MOM98-17").name;

    await areaPage.open();
    await areaPage.tryDelete([used, free]);
    // Standard toast, not the FR-80 text: it does not name the areas in use.
    await areaPage.expectToast(STD_MESSAGES.deleteInUse);
    await attachScreenshot(page, testInfo, shot("TC-MOM98-035 List view setelah Delete ditolak")); // right after the toast

    // The toast names no area: the list proves which areas stayed.
    await areaPage.open();
    await areaPage.expectInList(used); // nothing is deleted, the free area too
    await areaPage.expectInList(free);

    await attachScreenshot(page, testInfo, shot("TC-MOM98-035 List view"));
  });

  test("TC-MOM98-037 Delete an area that another user deleted", { tag: ["@negative", "@TC-MOM98-037"], annotation: { type: "tc-version", description: "1" } }, async ({ page, data }, testInfo) => {
    const gone = area(data, "DS-MOM98-17").name;
    const kept = area(data, "DS-MOM98-18").name;

    await areaPage.open(); // the tester loads the list first
    await data.remove("DS-MOM98-17", await anotherUser(page)); // user B, by record number

    await areaPage.tryDelete([gone, kept]);
    await areaPage.expectMessage(AM_MESSAGES.areasNoLongerExist([gone]));
    await attachScreenshot(page, testInfo, shot("TC-MOM98-037 List view setelah Delete ditolak"));

    await areaPage.open();
    await areaPage.expectInList(kept); // nothing is deleted

    await attachScreenshot(page, testInfo, shot("TC-MOM98-037 List view"));
  });

  test("TC-MOM98-038 Delete fails on a database error", { tag: ["@negative", "@TC-MOM98-038"], annotation: { type: "tc-version", description: "1" } }, async ({ page, data }, testInfo) => {
    const names = ["DS-MOM98-17", "DS-MOM98-18"].map((ds) => area(data, ds).name);

    await areaPage.open();
    // Delete may be sent as DELETE or as POST (several ids): fail both.
    const stop = await failApi(page, AM_API, ["DELETE", "POST"]);
    await areaPage.tryDelete(names);
    await areaPage.expectMessage(AM_MESSAGES.saveFailed);
    await attachScreenshot(page, testInfo, shot("TC-MOM98-038 List view setelah Delete gagal"));

    await stop();
    await areaPage.open();
    for (const name of names) await areaPage.expectInList(name); // nothing is deleted

    await attachScreenshot(page, testInfo, shot("TC-MOM98-038 List view"));
  });
});