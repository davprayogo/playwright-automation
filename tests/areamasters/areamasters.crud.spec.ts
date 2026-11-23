/**
 * MOM-98 Area Masters — automation (FSD Section 9), positive and negative.
 *
 * One file per menu (AUTOMATION_RULES Section 1.1). Tests follow FSD Section 9 order
 * and are tagged by the FSD Type: run a subset with --grep @positive / --grep @negative.
 *
 * Automated:
 *  - @positive: 001, 005, 008, 009, 013, 014, 015, 018, 020, 021, 022, 024, 025, 032, 033, 034
 *  - @negative: 004, 007, 010, 016, 019, 023, 026, 027, 035, 037, 038
 *  Partial (see the annotation in each test): 001, 027, 032, 035.
 *  Additional QA Recommendation (not in FSD Section 9), @negative: QA-MOM98-010a, 010b, 010c
 *  (mandatory fields left empty, both and one at a time; TC-010 covers spaces only).
 *
 * Not automated:
 *  - 002, 003 (Custom Filter / Quick Search: no BasePage function yet)
 *  - 006 (Active read only on New/Edit: Active has no locator, its DOM is not confirmed)
 *  - 011 (positive, typing over the max length: not automated yet)
 *  - 012, 030, 041, 042, 043 (API requests: no API client yet)
 *  - 017, 028, 029, 031, 036 (an area or a child record becomes inactive: the active/inactive process is not automated)
 *  - 039, 040 (authorization: needs a second login without the action)
 *
 * Test data: every test makes its own areas through the UI, with a unique suffix and a
 * unique factory, then afterEach deletes them (storage locations first, then areas).
 * Messages: generic checks expect MOM-0029 (STD_MESSAGES / STD_DIALOGS), as FSD Section 9
 * states; MOM-98 business rules expect the FSD text (AM_MESSAGES). Where the FSD does not
 * say where a message shows, the test only checks that the exact text is on the page.
 * Toasts (confirmed in the UI, AUTOMATION_RULES Section 10): a duplicate Factory + Name
 * (016, 023) and the delete of an area in use (035) show a toast, not the MOM-0029
 * "Duplicate Record" modal / the MOM-98 FR-80 text. See expectToast(), duplicateRecordMessage().
 * "Another user": a second page in the same browser context (same login).
 * Server errors: simulated with failApi() (network interception), no backend change needed.
 * Login is expected from the Playwright config (storageState).
 * Evidence: each test ends with attachScreenshot() — only reached when every step passed.
 */
import { test, type Page } from "@playwright/test";
import { AM_MESSAGES, AreaMastersPage } from "@pages/AreaMastersPage";
import { StorageLocationsPage } from "@pages/StorageLocationsPage";
import { STD_DIALOGS, STD_MESSAGES } from "@pages/BasePage"; // duplicate toast: AreaMastersPage.expectDuplicateToast
import type { AreaMaster } from "@data/wms/areaMaster";
import { attachScreenshot } from "@utils/screenshot";
import { failApi } from "@utils/network";

/** API calls of this menu (assumed path). The page URL also matches, but failApi() skips page loads. */
const AM_API = /area-?masters?/i;

const POSITIVE = { tag: "@positive" };
const NEGATIVE = { tag: "@negative" };

const uid = () =>
  (Date.now().toString(36) + Math.random().toString(36).slice(2, 4))
    .slice(-6)
    .toUpperCase();
/** 7 chars, under the 10-char Factory limit, unique per call. */
const factoryCode = () => `F${uid()}`;

const shot = (step: string) => `Area Masters - ${step}`;

test.describe("MOM-98 Area Masters", () => {
  let areaPage: AreaMastersPage;
  let created: string[];
  let slocs: string[];
  let extraPages: Page[];

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
  const partial = (description: string) =>
    test.info().annotations.push({ type: "partial", description });

  /** A second page in the same login, used as "another user". */
  const anotherUser = async (page: Page) => {
    const other = await page.context().newPage();
    extraPages.push(other);
    return other;
  };

  /** A storage location (MOM-113) that points to the area: a child record. */
  const addStorageLocation = async (page: Page, area: string) => {
    const name = `SLOC ${uid()}`;
    const slocPage = new StorageLocationsPage(page);
    await slocPage.open();
    await slocPage.create({ area, name });
    slocs.push(name);
    return name;
  };

  test.beforeEach(async ({ page }) => {
    areaPage = new AreaMastersPage(page);
    created = [];
    slocs = [];
    extraPages = [];
    // Leaving a refused form may raise a browser "leave page?" prompt: accept it.
    page.on("dialog", (dialog) => dialog.accept());
  });

  test.afterEach(async ({ page }) => {
    await page.unrouteAll({ behavior: "ignoreErrors" });
    for (const other of extraPages) await other.close();
    // Storage locations first: an area in use cannot be deleted.
    if (slocs.length) {
      try {
        const slocPage = new StorageLocationsPage(page);
        await slocPage.open();
        await slocPage.delete([...new Set(slocs)]);
      } catch (e) {
        console.warn(
          `Cleanup failed for storage locations: ${slocs.join(", ")}`,
          e,
        );
      }
    }
    if (created.length) {
      try {
        await areaPage.open();
        await areaPage.delete([...new Set(created)]);
      } catch (e) {
        console.warn(`Cleanup failed for areas: ${created.join(", ")}`, e);
      }
    }
  });

  // ---------- 9.1 List and Area Page ----------

  test(
    "TC-MOM98-001 List loads with the FSD columns",
    POSITIVE,
    async ({ page }, testInfo) => {
      partial(
        "Inactive area hidden by default is not checked: needs the active/inactive process.",
      );
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
    },
  );

  test(
    "TC-MOM98-004 The list fails to load",
    NEGATIVE,
    async ({ page }, testInfo) => {
      await failApi(page, AM_API, ["GET"]);

      await areaPage.goto(areaPage.path);
      await areaPage.expectMessage(AM_MESSAGES.listLoadFailed);

      await attachScreenshot(page, testInfo, shot("TC-MOM98-004 List view"));
    },
  );

  test(
    "TC-MOM98-005 Open an area shows every field",
    POSITIVE,
    async ({ page }, testInfo) => {
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

      await attachScreenshot(page, testInfo, shot("TC-MOM98-005 Detail view"));
    },
  );

  test(
    "TC-MOM98-007 The area page fails to load",
    NEGATIVE,
    async ({ page }, testInfo) => {
      const name = `PROD LINE 1 ${uid()}`;
      await createArea({ factory: factoryCode(), name });

      await areaPage.open();
      await failApi(page, AM_API, ["GET"]);
      await areaPage.openDetailByColumn("Name", name);
      await areaPage.expectMessage(AM_MESSAGES.detailLoadFailed);

      await attachScreenshot(page, testInfo, shot("TC-MOM98-007 Detail view"));
    },
  );

  // ---------- 9.2 Create ----------

  test(
    "TC-MOM98-008 Create an area with all fields",
    POSITIVE,
    async ({ page }, testInfo) => {
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
      await attachScreenshot(
        page,
        testInfo,
        shot("TC-MOM98-008 Step 3 Detail view setelah Create"),
      );

      await areaPage.open();
      await areaPage.expectInList(data.name, data.factory);

      await attachScreenshot(
        page,
        testInfo,
        shot("TC-MOM98-008 Step 4 List view setelah Create"),
      );
    },
  );

  test(
    "TC-MOM98-009 Create an area with mandatory fields only",
    POSITIVE,
    async ({ page }, testInfo) => {
      const data: AreaMaster = {
        factory: factoryCode(),
        name: `QC 2 ${uid()}`,
      };
      await createArea(data);

      await areaPage.openDetail(data.name);
      await areaPage.expectDetail({
        ...data,
        floor: "",
        division: "",
        description: "",
        remark: "",
      });

      await attachScreenshot(
        page,
        testInfo,
        shot("TC-MOM98-009 Detail view setelah Create"),
      );
    },
  );

  test(
    "TC-MOM98-010 Factory and Name with only spaces are refused",
    NEGATIVE,
    async ({ page }, testInfo) => {
      await areaPage.open();
      await areaPage.startCreate({ factory: "  ", name: "   " });
      await areaPage.trySave();

      await areaPage.expectFieldErrors(
        ["factory", "name"],
        STD_MESSAGES.required,
      );
      await areaPage.expectFormStillOpen(); // nothing is saved

      await attachScreenshot(
        page,
        testInfo,
        shot("TC-MOM98-010 Detail view setelah Create ditolak"),
      );
    },
  );

  // Additional QA Recommendation: FSD Section 9 has no case for mandatory fields left
  // EMPTY (TC-010 covers spaces only, both fields at once). One field at a time shows
  // that each field has its own check (FR-30, MOM-0029 FR-460).
  const REQUIRED_EMPTY_CASES: {
    id: string;
    title: string;
    data: (name: string) => Partial<AreaMaster>;
    empty: (keyof AreaMaster)[];
  }[] = [
    {
      id: "QA-MOM98-010a",
      title: "Factory and Name left empty",
      data: () => ({}),
      empty: ["factory", "name"],
    },
    {
      id: "QA-MOM98-010b",
      title: "Factory left empty",
      data: (name) => ({ name }),
      empty: ["factory"],
    },
    {
      id: "QA-MOM98-010c",
      title: "Name left empty",
      data: () => ({ factory: factoryCode() }),
      empty: ["name"],
    },
  ];

  for (const c of REQUIRED_EMPTY_CASES) {
    test(
      `${c.id} ${c.title} is refused`,
      NEGATIVE,
      async ({ page }, testInfo) => {
        test.info().annotations.push({
          type: "classification",
          description:
            "Additional QA Recommendation (FR-30, MOM-0029 FR-460). Not a test case in FSD MOM-98 Section 9.",
        });
        const data = c.data(`QC REQ ${uid()}`);

        await areaPage.open();
        await areaPage.startCreate(data); // empty fields are not touched
        await areaPage.trySave();

        await areaPage.expectFieldErrors(c.empty, STD_MESSAGES.required);
        await areaPage.expectFormStillOpen(); // nothing is saved
        await attachScreenshot(
          page,
          testInfo,
          shot(`${c.id} Detail view setelah Create ditolak`),
        );

        if (data.name) {
          await areaPage.open();
          await areaPage.expectNotInList(data.name); // nothing is saved

          await attachScreenshot(page, testInfo, shot(`${c.id} List view`));
        }
      },
    );
  }

  test(
    "TC-MOM98-013 Factory and Name are saved trimmed",
    POSITIVE,
    async ({ page }, testInfo) => {
      const factory = factoryCode();
      const name = `QC 4 ${uid()}`;
      await createArea({ factory: ` ${factory} `, name: ` ${name} ` });

      await areaPage.openDetail(name); // H6 title = trimmed Name
      await areaPage.expectDetail({ factory, name });

      await attachScreenshot(
        page,
        testInfo,
        shot("TC-MOM98-013 Detail view setelah Create"),
      );
    },
  );

  test(
    "TC-MOM98-014 Factory is saved with the existing spelling on create",
    POSITIVE,
    async ({ page }, testInfo) => {
      const factory = factoryCode();
      const id = uid();
      await createArea({ factory, name: `MAIN STORE ${id}` });
      await createArea({ factory: factory.toLowerCase(), name: `QC 5 ${id}` });

      await areaPage.open();
      await areaPage.expectInList(`QC 5 ${id}`, factory);

      await attachScreenshot(
        page,
        testInfo,
        shot("TC-MOM98-014 List view setelah Create"),
      );
    },
  );

  test(
    "TC-MOM98-015 A new factory is saved as entered",
    POSITIVE,
    async ({ page }, testInfo) => {
      const factory = factoryCode().toLowerCase();
      const name = `QC 9 ${uid()}`;
      await createArea({ factory, name });

      await areaPage.openDetail(name);
      await areaPage.expectDetail({ factory }); // saved as entered (lowercase)

      await attachScreenshot(
        page,
        testInfo,
        shot("TC-MOM98-015 Detail view setelah Create"),
      );
    },
  );

  test(
    "TC-MOM98-016 Duplicate name in the same factory, different case and spaces",
    NEGATIVE,
    async ({ page }, testInfo) => {
      const existing: AreaMaster = {
        factory: factoryCode(),
        name: `MAIN STORE ${uid()}`,
      };
      await createArea(existing);
      const lowerName = existing.name.toLowerCase();

      await areaPage.open();
      await areaPage.startCreate({
        factory: ` ${existing.factory.toLowerCase()} `,
        name: ` ${lowerName} `,
      });
      await areaPage.trySave();
      // Toast (not the MOM-0029 modal). Typed or existing spelling: not confirmed yet, accept both.
      await areaPage.expectDuplicateToast(
        [existing.factory.toLowerCase(), existing.factory],
        [lowerName, existing.name],
      );
      await attachScreenshot(
        page,
        testInfo,
        shot("TC-MOM98-016 Detail view setelah Create ditolak"),
      ); // right after the toast

      await areaPage.open();
      await areaPage.expectInList(existing.name, existing.factory);
      await areaPage.expectNotInList(lowerName); // nothing is saved

      await attachScreenshot(page, testInfo, shot("TC-MOM98-016 List view"));
    },
  );

  test(
    "TC-MOM98-018 Same name in two factories is allowed",
    POSITIVE,
    async ({ page }, testInfo) => {
      const f1 = factoryCode();
      const f2 = factoryCode();
      const name = `MAIN STORE ${uid()}`;
      await createArea({ factory: f1, name });
      await createArea({ factory: f2, name });

      await areaPage.open();
      await areaPage.expectInList(name, f1);
      await areaPage.expectInList(name, f2);

      await attachScreenshot(
        page,
        testInfo,
        shot("TC-MOM98-018 List view setelah Create"),
      );
    },
  );

  test(
    "TC-MOM98-019 Create fails on a database error",
    NEGATIVE,
    async ({ page }, testInfo) => {
      const data: AreaMaster = {
        factory: factoryCode(),
        name: `TEST ${uid()}`,
      };
      await areaPage.open();
      await areaPage.startCreate(data);
      const stop = await failApi(page, AM_API, ["POST", "PUT"]);

      await areaPage.trySave();
      await areaPage.expectMessage(AM_MESSAGES.saveFailed);
      await attachScreenshot(
        page,
        testInfo,
        shot("TC-MOM98-019 Detail view setelah Create gagal"),
      );

      await stop();
      await areaPage.open();
      await areaPage.expectNotInList(data.name); // nothing is saved

      await attachScreenshot(page, testInfo, shot("TC-MOM98-019 List view"));
    },
  );

  // ---------- 9.3 Edit ----------

  test(
    "TC-MOM98-020 Edit the name and the division",
    POSITIVE,
    async ({ page }, testInfo) => {
      const id = uid();
      const oldName = `QC ${id}`;
      const newName = `QC AREA ${id}`;
      await createArea({ factory: factoryCode(), name: oldName });

      await areaPage.open();
      await areaPage.update(oldName, { name: newName, division: "QA" });
      rename(oldName, newName);

      await areaPage.openDetail(newName); // H6 title = new Name
      await areaPage.expectDetail({ name: newName, division: "QA" });

      await attachScreenshot(
        page,
        testInfo,
        shot("TC-MOM98-020 Detail view setelah Update"),
      );
    },
  );

  test(
    "TC-MOM98-021 Edit without changing the name is not a duplicate",
    POSITIVE,
    async ({ page }, testInfo) => {
      const data: AreaMaster = {
        factory: factoryCode(),
        name: `MAIN STORE ${uid()}`,
      };
      await createArea(data);

      await areaPage.open();
      await areaPage.update(data.name, { remark: "Updated" }); // asserts no Duplicate Record modal

      await areaPage.openDetail(data.name); // H6 title = Name
      await areaPage.expectDetail({ ...data, remark: "Updated" });

      await attachScreenshot(
        page,
        testInfo,
        shot("TC-MOM98-021 Detail view setelah Update"),
      );
    },
  );

  test(
    "TC-MOM98-022 Change only the case of the area's own name",
    POSITIVE,
    async ({ page }, testInfo) => {
      const id = uid().toLowerCase();
      const oldName = `Main Store ${id}`;
      const newName = oldName.toUpperCase();
      await createArea({ factory: factoryCode(), name: oldName });

      await areaPage.open();
      await areaPage.update(oldName, { name: newName });
      rename(oldName, newName);

      await areaPage.openDetail(newName); // H6 title, exact case
      await areaPage.expectDetail({ name: newName });

      await attachScreenshot(
        page,
        testInfo,
        shot("TC-MOM98-022 Detail view setelah Update"),
      );
    },
  );

  test(
    "TC-MOM98-023 Move an area to a factory where the name exists",
    NEGATIVE,
    async ({ page }, testInfo) => {
      const f1 = factoryCode();
      const f2 = factoryCode();
      const name = `QC ${uid()}`;
      await createArea({ factory: f1, name });
      await createArea({ factory: f2, name });

      await areaPage.open();
      // The same name is in both factories: open the row by its factory (f1 holds only this area).
      await areaPage.startEdit(
        name,
        { factory: f2.toLowerCase() },
        { byFactory: f1 },
      );
      await areaPage.trySave();
      // Toast. FSD expects the existing spelling of F2; the typed "f2" is also accepted until confirmed.
      await areaPage.expectDuplicateToast([f2.toLowerCase(), f2], name);
      await attachScreenshot(
        page,
        testInfo,
        shot("TC-MOM98-023 Detail view setelah Update ditolak"),
      ); // right after the toast

      await areaPage.open();
      await areaPage.expectInList(name, f1); // the area stays in F1
      await areaPage.expectInList(name, f2);

      await attachScreenshot(page, testInfo, shot("TC-MOM98-023 List view"));
    },
  );

  test(
    "TC-MOM98-024 Factory is saved with the existing spelling on edit",
    POSITIVE,
    async ({ page }, testInfo) => {
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

      await attachScreenshot(
        page,
        testInfo,
        shot("TC-MOM98-024 Detail view setelah Update"),
      );
    },
  );

  test(
    "TC-MOM98-025 On edit, the area itself is not used for the factory spelling",
    POSITIVE,
    async ({ page }, testInfo) => {
      const factoryLower = factoryCode().toLowerCase();
      const name = `QC 7 ${uid()}`;
      await createArea({ factory: factoryLower, name });

      await areaPage.open();
      await areaPage.update(name, { factory: factoryLower.toUpperCase() });

      await areaPage.openDetail(name);
      await areaPage.expectDetail({ factory: factoryLower.toUpperCase() });

      await attachScreenshot(
        page,
        testInfo,
        shot("TC-MOM98-025 Detail view setelah Update"),
      );
    },
  );

  test(
    "TC-MOM98-026 Edit an area that another user deleted",
    NEGATIVE,
    async ({ page }, testInfo) => {
      const name = `QC 8 ${uid()}`;
      await createArea({ factory: factoryCode(), name });

      await areaPage.open();
      await areaPage.startEdit(name, { remark: "X" });

      const other = new AreaMastersPage(await anotherUser(page));
      await other.open();
      await other.delete([name]);
      untrack(name);

      await areaPage.trySave();
      await areaPage.expectDialogWithTitle(
        STD_DIALOGS.deleted.title,
        STD_DIALOGS.deleted.text,
      );
      await attachScreenshot(
        page,
        testInfo,
        shot("TC-MOM98-026 Step 2 Detail view setelah Update ditolak"),
      );

      await areaPage.confirmDialog("Back to List");
      await areaPage.expectTableLoaded();
      await areaPage.expectNotInList(name);

      await attachScreenshot(
        page,
        testInfo,
        shot("TC-MOM98-026 Step 3 List view"),
      );
    },
  );

  test(
    "TC-MOM98-027 Edit an area that another user changed",
    NEGATIVE,
    async ({ page }, testInfo) => {
      partial(
        '"No overwrite option is offered" is not checked: no BasePage function to check a dialog has no such button.',
      );
      const name = `QC 10 ${uid()}`;
      await createArea({ factory: factoryCode(), name }); // no Division, no Remark

      await areaPage.open();
      await areaPage.startEdit(name, { remark: "Tester" });

      const other = new AreaMastersPage(await anotherUser(page));
      await other.open();
      await other.update(name, { division: "SMT" });

      await areaPage.trySave();
      await areaPage.expectDialogWithTitle(
        STD_DIALOGS.outdated.title,
        STD_DIALOGS.outdated.text,
      );
      await attachScreenshot(
        page,
        testInfo,
        shot("TC-MOM98-027 Step 2 Detail view setelah Update ditolak"),
      );

      await areaPage.confirmDialog("Reload");
      await areaPage.expectFormStillOpen(); // stays in edit mode
      await areaPage.expectFormValues({ division: "SMT", remark: "" }); // latest data, own change dropped

      await attachScreenshot(
        page,
        testInfo,
        shot("TC-MOM98-027 Step 3 Detail view"),
      );
    },
  );

  // ---------- 9.5 Delete ----------

  test(
    "TC-MOM98-032 Delete unused areas from the list",
    POSITIVE,
    async ({ page }, testInfo) => {
      partial(
        "Step 4 (Custom Filter Active = No) not automated: no BasePage filter function yet.",
      );
      const id = uid();
      const names = [`TEMP ${id}`, `TEMP 2 ${id}`];
      const factory = factoryCode();
      for (const name of names) await createArea({ factory, name });

      await areaPage.open();
      await areaPage.delete(names, { confirmMessage: "Delete 2 Records?" });
      untrack(...names);

      await attachScreenshot(
        page,
        testInfo,
        shot("TC-MOM98-032 List view setelah Delete"),
      );
    },
  );

  test(
    "TC-MOM98-033 Delete an unused area from the area page",
    POSITIVE,
    async ({ page }, testInfo) => {
      const name = `TEMP 3 ${uid()}`;
      await createArea({ factory: factoryCode(), name });

      await areaPage.deleteFromDetail(name);
      untrack(name);

      await attachScreenshot(
        page,
        testInfo,
        shot("TC-MOM98-033 List view setelah Delete"),
      );
    },
  );

  test(
    "TC-MOM98-034 Cancel the delete confirmation",
    POSITIVE,
    async ({ page }, testInfo) => {
      const name = `TEMP 4 ${uid()}`;
      await createArea({ factory: factoryCode(), name });

      await areaPage.open();
      await areaPage.cancelDelete([name]);

      await attachScreenshot(
        page,
        testInfo,
        shot("TC-MOM98-034 List view setelah Cancel Delete"),
      );
    },
  );

  test(
    "TC-MOM98-035 Delete is all-or-none when some areas are in use",
    NEGATIVE,
    async ({ page }, testInfo) => {
      partial(
        "Area used by a digi tag is not covered: Digi Tag Masters has no Page Object. Only a storage location is used as the child record.",
      );
      const id = uid();
      const factory = factoryCode();
      const used = `MAIN STORE ${id}`;
      const free = `TEMP 5 ${id}`;
      await createArea({ factory, name: used });
      await createArea({ factory, name: free });
      await addStorageLocation(page, used);

      await areaPage.open();
      await areaPage.tryDelete([used, free]);
      // Standard toast, not the FR-80 text: it does not name the areas in use.
      await areaPage.expectToast(STD_MESSAGES.deleteInUse);
      await attachScreenshot(
        page,
        testInfo,
        shot("TC-MOM98-035 List view setelah Delete ditolak"),
      ); // right after the toast

      // The toast names no area: the list proves which areas stayed.
      await areaPage.open();
      await areaPage.expectInList(used); // nothing is deleted, the free area too
      await areaPage.expectInList(free);

      await attachScreenshot(page, testInfo, shot("TC-MOM98-035 List view"));
    },
  );

  test(
    "TC-MOM98-037 Delete an area that another user deleted",
    NEGATIVE,
    async ({ page }, testInfo) => {
      const id = uid();
      const factory = factoryCode();
      const gone = `TEMP 6 ${id}`;
      const kept = `TEMP 7 ${id}`;
      await createArea({ factory, name: gone });
      await createArea({ factory, name: kept });

      await areaPage.open(); // the tester loads the list first

      const other = new AreaMastersPage(await anotherUser(page));
      await other.open();
      await other.delete([gone]);
      untrack(gone);

      await areaPage.tryDelete([gone, kept]);
      await areaPage.expectMessage(AM_MESSAGES.areasNoLongerExist([gone]));
      await attachScreenshot(
        page,
        testInfo,
        shot("TC-MOM98-037 List view setelah Delete ditolak"),
      );

      await areaPage.open();
      await areaPage.expectInList(kept); // nothing is deleted

      await attachScreenshot(page, testInfo, shot("TC-MOM98-037 List view"));
    },
  );

  test(
    "TC-MOM98-038 Delete fails on a database error",
    NEGATIVE,
    async ({ page }, testInfo) => {
      const id = uid();
      const factory = factoryCode();
      const names = [`TEMP 8 ${id}`, `TEMP 9 ${id}`];
      for (const name of names) await createArea({ factory, name });

      await areaPage.open();
      // Delete may be sent as DELETE or as POST (several ids): fail both.
      const stop = await failApi(page, AM_API, ["DELETE", "POST"]);
      await areaPage.tryDelete(names);
      await areaPage.expectMessage(AM_MESSAGES.saveFailed);
      await attachScreenshot(
        page,
        testInfo,
        shot("TC-MOM98-038 List view setelah Delete gagal"),
      );

      await stop();
      await areaPage.open();
      for (const name of names) await areaPage.expectInList(name); // nothing is deleted

      await attachScreenshot(page, testInfo, shot("TC-MOM98-038 List view"));
    },
  );
});
