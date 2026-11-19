import { Page, Locator, expect } from "@playwright/test";
import {
  clickRowByColumnValue,
  selectCheckboxesByColumnValues,
} from "@utils/table-helper";

/** Detail view shows an empty field as "-". */
export const DETAIL_EMPTY_DISPLAY = "-";

/** List view message when the menu has no data yet (empty state has no id). */
export const TABLE_EMPTY_TEXT = "No data. Please add it first.";

/** List view message when Quick Search / Filter finds nothing (no id). */
export const TABLE_NO_RESULT_TEXT =
  "No data found. Please try again with different search criteria.";

/**
 * MOM-0029 standard messages, used for generic checks instead of the feature
 * FSD wording (decision for MOM-99 Section 9; record the FSD mismatch).
 */
export const STD_MESSAGES = {
  /** FR-460, inline under the field. */
  required: "This field is required",
  /** FR-470, inline under the reference field. */
  inactiveRecord: "The selected record is inactive. Select another one",
  recordNotExist: "The selected record no longer exists. Select another one",
} as const;

/** MOM-0029 standard modals: title + fixed part of the text. */
export const STD_DIALOGS = {
  /** FR-480. The full text also names the unique fields and values. */
  duplicate: {
    title: "Duplicate Record",
    text: ["Another record already has the same", "It may be inactive. Please use different values."],
  },
  /** FR-490. The full text also names the user and the date time. */
  outdated: {
    title: "Data Outdated",
    text: [
      "after you opened it. Your changes have not been saved.",
      "Reload to continue editing with the latest data, or Discard to cancel your changes.",
    ],
  },
  /** FR-500. */
  deleted: {
    title: "Record Deleted",
    text: ["This record was deleted by another user after you opened it. Your changes have not been saved."],
  },
} as const;

/**
 * Maps a menu's data fields to its detail view.
 * - titleField: field shown as the H6 title (it has no label/value row).
 * - labels: field -> label text from FSD Section 7.5.2 (title field excluded).
 */
export type DetailFieldMap<T> = {
  titleField?: keyof T;
  labels: Partial<Record<keyof T, string>>;
};

/**
 * Base class untuk semua Page Object.
 * Taruh aksi umum yang dipakai ulang di banyak halaman.
 */
export abstract class BasePage {
  constructor(protected readonly page: Page) {}

  // =====================================================================
  // Navigation
  // =====================================================================

  async goto(path: string) {
    await this.page.goto(path);
  }

  /** Klik menu di navigasi samping/atas berdasarkan nama. */
  async openMenu(name: string) {
    await this.page.getByRole("link", { name, exact: true }).first().click();
  }

  // =====================================================================
  // List view: table
  // =====================================================================

  /**
   * List view siap: baris DATA pertama ATAU salah satu empty state terlihat
   * (belum ada data / tidak ada hasil Search-Filter).
   * Pakai clickableRows(), bukan tableRows(): baris skeleton (loading) juga <tr>,
   * jadi tableRows().first() bisa lolos sebelum data selesai dimuat.
   */
  async expectTableLoaded() {
    await expect(
      this.clickableRows()
        .first()
        .or(this.tableEmptyState())
        .or(this.tableNoResultState()),
    ).toBeVisible();
  }

  /** Empty state: the menu has no data yet. */
  protected tableEmptyState(): Locator {
    return this.page.getByText(TABLE_EMPTY_TEXT, { exact: true });
  }

  /** Empty state: Quick Search / Filter found nothing. */
  protected tableNoResultState(): Locator {
    return this.page.getByText(TABLE_NO_RESULT_TEXT, { exact: true });
  }

  /** Menu has no data at all: "No data. Please add it first." and no data rows. */
  async expectTableEmpty() {
    await expect(this.tableEmptyState()).toBeVisible();
    await expect(this.clickableRows()).toHaveCount(0);
  }

  /** Search / Filter found nothing: "No data found. ..." and no data rows. */
  async expectNoSearchResult() {
    await expect(this.tableNoResultState()).toBeVisible();
    await expect(this.clickableRows()).toHaveCount(0);
  }

  tableBody(): Locator {
    return this.page.locator("tbody");
  }

  tableRows(): Locator {
    return this.page.locator("table tbody tr");
  }

  rowByText(text: string): Locator {
    return this.page.getByRole("row").filter({ hasText: text });
  }

  /** Baris data yang bisa dibuka (punya detail). Baris skeleton tidak ikut. */
  clickableRows(): Locator {
    return this.page.locator('tbody > tr[class*="cursor-pointer"]');
  }

  async openDetailByColumn(columnName: string, value: string) {
    await clickRowByColumnValue(this.page, columnName, value);
  }

  async selectRowsByColumn(columnName: string, values: string[]) {
    await selectCheckboxesByColumnValues(this.page, columnName, values);
  }

  /**
   * List header cell. Lumina <th> is sortable & draggable: it has role="button"
   * (not "columnheader"), and the label sits in <button id="table-sort-btn">.
   */
  protected listHeader(column: string): Locator {
    return this.page.locator("thead th").filter({
      has: this.page.getByRole("button", { name: column, exact: true }),
    });
  }

  /** Columns from FSD Section 7.5.1. Checks presence only: users can drag to reorder. */
  async expectListColumns(columns: string[]) {
    for (const column of columns) {
      await expect(this.listHeader(column)).toHaveCount(1);
      await expect(this.listHeader(column)).toBeVisible();
    }
  }

  /**
   * Position of a list column among the <th> cells (the checkbox column counts),
   * read at run time, so a user's drag order does not matter.
   */
  protected async listColumnIndex(column: string): Promise<number> {
    await expect(this.listHeader(column)).toHaveCount(1);
    const headers = this.page.locator("thead th");
    const count = await headers.count();
    for (let i = 0; i < count; i++) {
      const hit = await headers
        .nth(i)
        .getByRole("button", { name: column, exact: true })
        .count();
      if (hit > 0) return i;
    }
    throw new Error(`List column "${column}" not found.`);
  }

  /**
   * The one data row that has a cell `rowKey` (a unique value, e.g. Code)
   * shows `value` in `column`. Exact text, case-sensitive, after trim.
   * Use it when a value such as "Yes" could sit in several columns.
   */
  async expectListCell(rowKey: string, column: string, value: string) {
    const index = await this.listColumnIndex(column);
    const row = this.rowByCells(rowKey);
    await expect(row).toHaveCount(1);
    await expect(row.getByRole("cell").nth(index)).toHaveText(value.trim());
  }

  /** Data row that has a cell with exactly each given value (trimmed, case-sensitive). */
  protected rowByCells(...values: string[]): Locator {
    let row = this.clickableRows();
    for (const value of values) {
      row = row.filter({
        has: this.page.getByRole("cell", { name: value.trim(), exact: true }),
      });
    }
    return row;
  }

  /** Exactly one data row has all the given cell values. */
  async expectRowInList(...values: string[]) {
    await expect(this.rowByCells(...values)).toHaveCount(1);
  }

  /** No data row has all the given cell values. */
  async expectRowNotInList(...values: string[]) {
    await expect(this.rowByCells(...values)).toHaveCount(0);
  }

  // =====================================================================
  // Actions (buttons)
  // =====================================================================

  /** General Function kayak Click button Create, Click Save, Click Delete, Click Edit */
  async openCreatePage() {
    await this.page.getByTestId("button-create").click();
  }

  async clickEdit() {
    await this.page.getByTestId("btn-detail-edit").click();
  }

  async clickSave() {
    await this.page.getByTestId("btn-detail-save").click();
  }

  /** A refused save leaves the form open: Save is still shown. */
  async expectFormStillOpen() {
    await expect(this.page.getByTestId("btn-detail-save")).toBeVisible();
  }

  /** Delete on the LIST (rows must be selected first): More → Delete. */
  async clickDelete() {
    await this.page.getByTestId("record-action-btn-more").click();
    await this.page.getByTestId("record-action-btn-delete").click();
  }

  /** Open the "More" menu on the DETAIL view (differs from the list's More). */
  async openDetailMore() {
    const more = this.page.getByTestId("btn-detail-more");
    await expect(more).toBeVisible();
    await more.click();
  }

  /**
   * Delete on the DETAIL view: More (btn-detail-more) → Delete.
   * The Delete item has the same test-id as on the list (record-action-btn-delete).
   */
  async clickDetailDelete() {
    await this.openDetailMore();
    await this.page.getByTestId("record-action-btn-delete").click();
  }

  // =====================================================================
  // Dialog
  // =====================================================================

  protected dialog() {
    return this.page.getByRole("dialog");
  }

  async confirmDialog(buttonName = "Save") {
    const dialog = this.dialog();
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: buttonName, exact: true }).click();
    await expect(dialog).toBeHidden();
  }

  /** Check the confirmation text before clicking a dialog button. */
  async expectDialogText(text: string) {
    await expect(this.dialog()).toContainText(text);
  }

  /** Dialog with this title is shown and contains every text part. */
  async expectDialogWithTitle(title: string, texts: readonly string[] = []) {
    const dialog = this.page.getByRole("dialog", { name: title });
    await expect(dialog).toBeVisible();
    for (const text of texts) await expect(dialog).toContainText(text);
  }

  /**
   * For a save that is expected to be refused: click Save, and click Save in the
   * confirmation only if one appears. Client-side checks refuse before the
   * confirmation; server checks refuse after it. Another dialog (e.g. Duplicate
   * Record) is left open for the test to check.
   */
  async clickSaveConfirmIfAsked() {
    await this.clickSave();
    const dialog = this.dialog();
    const shown = await dialog
      .first()
      .waitFor({ state: "visible", timeout: 3000 })
      .then(() => true, () => false);
    if (!shown) return;
    const save = dialog.getByRole("button", { name: "Save", exact: true });
    if ((await save.count()) > 0) await save.click();
  }

  /** No dialog with this title is shown (e.g. "Duplicate Record"). */
  async expectNoDialog(name: string) {
    await expect(this.page.getByRole("dialog", { name })).toHaveCount(0);
  }

  // =====================================================================
  // Detail view
  // =====================================================================

  /** Detail view title = H6 with the record's identity field (e.g. Name). */
  protected detailTitle(text: string): Locator {
    return this.page.getByRole("heading", {
      level: 6,
      name: text.trim(),
      exact: true,
    });
  }

  async expectDetailOpened(title: string) {
    await expect(this.detailTitle(title)).toBeVisible();
  }

  /**
   * Detail view field value. DOM:
   * <div>
   *   <div><p>{Label}</p></div>
   *   <p>{Value}</p>
   * </div>
   */
  protected detailValue(label: string): Locator {
    return this.page.locator(
      `xpath=//div[p[normalize-space()='${label}']]/following-sibling::p[1]`,
    );
  }

  /** Exact text, case-sensitive. "" (or spaces) = must be empty, shown as "-". */
  async expectDetailValue(label: string, value: string) {
    const shown = value.trim() === "" ? DETAIL_EMPTY_DISPLAY : value.trim();
    await expect(this.detailValue(label)).toHaveText(shown);
  }

  /**
   * Check several detail fields at once.
   * Field undefined = not checked. The title field is checked on the H6 title.
   */
  protected async expectDetailFields<T extends object>(
    expected: Partial<T>,
    map: DetailFieldMap<T>,
  ) {
    for (const key of Object.keys(expected) as (keyof T)[]) {
      const value = expected[key];
      if (value === undefined) continue;
      if (typeof value !== "string") {
        throw new Error(`Detail field "${String(key)}" is not text; check it separately.`);
      }
      if (key === map.titleField) {
        await this.expectDetailOpened(value);
        continue;
      }
      const label = map.labels[key];
      if (!label) {
        throw new Error(`No detail label for field "${String(key)}". Add it to DETAIL_LABELS.`);
      }
      await this.expectDetailValue(label, value);
    }
  }

  // =====================================================================
  // Messages (negative cases)
  // =====================================================================

  /**
   * Inline error of one field. The field wrapper has the field id without
   * "-input" (seen on the Lumina toggle: <div id="pl-is-production-line">
   * holds the input and a text slot under it).
   */
  protected fieldError(fieldId: string, message: string): Locator {
    return this.page.getByTestId(fieldId).getByText(message, { exact: true });
  }

  async expectFieldError(fieldId: string, message: string) {
    await expect(this.fieldError(fieldId, message)).toBeVisible();
  }

  /**
   * A message is shown somewhere on the page (inline, toast or modal), exact text.
   * Use it when the FSD does not say where the message shows.
   */
  async expectMessage(message: string) {
    await expect(this.page.getByText(message, { exact: true }).first()).toBeVisible();
  }

  // =====================================================================
  // Form
  // =====================================================================

  async selectOptions(locator: () => Locator, name: string) {
    const input = locator();
    await input.click();
    await input.fill(name); // memfilter daftar
    await this.page
      .getByRole("option", { exact: true })
      .filter({ hasText: name })
      .click();
    await expect(input).toHaveValue(
      new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    );
  }

  /**
   * Lumina toggle. DOM (fieldId = e.g. "pl-is-production-line"):
   * <div id="{fieldId}">
   *   <input id="{fieldId}-input" class="sr-only" readonly type="checkbox" [checked]>
   *   <div role="button" aria-label="Toggle switch">…</div>
   * </div>
   * The checkbox holds the state but is hidden and read only, so it cannot be clicked:
   * read the state from the checkbox, click the switch.
   */
  protected toggleInput(fieldId: string): Locator {
    return this.page.getByTestId(`${fieldId}-input`);
  }

  protected toggleSwitch(fieldId: string): Locator {
    return this.page
      .getByTestId(fieldId)
      .getByRole("button", { name: "Toggle switch", exact: true });
  }

  /** Set a toggle to on (Yes) or off (No). Clicks only when the state differs. */
  async setToggle(fieldId: string, on: boolean) {
    const input = this.toggleInput(fieldId);
    await expect(this.toggleSwitch(fieldId)).toBeVisible();
    if ((await input.isChecked()) !== on) {
      await this.toggleSwitch(fieldId).click();
    }
    await this.expectToggle(fieldId, on);
  }

  /** Toggle state on the open form (New or Edit). */
  async expectToggle(fieldId: string, on: boolean) {
    const input = this.toggleInput(fieldId);
    if (on) await expect(input).toBeChecked();
    else await expect(input).not.toBeChecked();
  }

  /** Combobox: typing `name` shows an option with exactly that text. Closes the list. */
  async expectOption(locator: () => Locator, name: string) {
    const input = locator();
    await input.click();
    await input.fill(name);
    await expect(
      this.page.getByRole("option", { name, exact: true }),
    ).toBeVisible();
    await input.press("Escape");
  }

  /**
   * Combobox: typing `name` shows no option with exactly that text
   * (e.g. an inactive record). Waits for the search request to settle first,
   * so the check does not pass while the option list is still loading.
   */
  async expectNoOption(locator: () => Locator, name: string) {
    const input = locator();
    await input.click();
    await input.fill(name);
    await this.page.waitForLoadState("networkidle");
    await expect(
      this.page.getByRole("option", { name, exact: true }),
    ).toHaveCount(0);
    await input.press("Escape");
  }
}