import { Page, Locator, expect } from "@playwright/test";
import {
  clickRowByColumnValue,
  selectCheckboxesByColumnValues,
} from "./table-helper";
import {
  CF_INACTIVE_ONLY,
  DETAIL_EMPTY_DISPLAY,
  LIST_ACTIVE_BADGE,
  LIST_ACTIVE_COLUMN,
  LIST_BOOLEAN_ICON,
  TABLE_EMPTY_TEXT,
  TABLE_NO_RESULT_TEXT,
  escapeRegExp,
} from "./constants";

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
 * Teks & nilai standar Lumina ada di ./constants (STD_MESSAGES, deleteConfirmMessage, ...).
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
   * List column -> `data-col-key` of its <td> (Lumina: the field name, e.g. "isTwoStepTransfer").
   * A Page menu overrides this for the columns it checks by cell. A column listed here is found
   * by its key; any other column by its header position.
   */
  protected readonly listColumnKeys: Readonly<Record<string, string>> = {};

  /** Cell of `column` in the one data row that has a cell `rowKey` (a unique value, e.g. Code). */
  protected async listCell(rowKey: string, column: string): Promise<Locator> {
    const row = this.rowByCells(rowKey);
    await expect(row).toHaveCount(1);
    const key = this.listColumnKeys[column];
    if (key) {
      // <td data-col-key> has no id; the key is the most stable hook (AUTOMATION_RULES 8.4).
      const cell = row.locator(`td[data-col-key="${key}"]`);
      await expect(
        cell,
        `No cell with data-col-key="${key}" for column "${column}"`,
      ).toHaveCount(1);
      return cell;
    }
    const index = await this.listColumnIndex(column);
    return row.getByRole("cell").nth(index);
  }

  /**
   * The row of `rowKey` shows `value` as text in `column`. Exact text, case-sensitive, after trim.
   * Use it when a value could sit in several columns.
   */
  async expectListCell(rowKey: string, column: string, value: string) {
    await expect(await this.listCell(rowKey, column)).toHaveText(value.trim());
  }

  /**
   * aria-labels of the icons (role="img" with an aria-label) in `scope`, hidden ones
   * included: the check is about the value the cell shows, not about how it paints.
   * The <svg aria-hidden> inside each Lumina icon also has role img but no label: skipped.
   */
  protected async iconLabels(scope: Locator): Promise<string[]> {
    return scope
      .getByRole("img", { includeHidden: true })
      .evaluateAll((els) =>
        els
          .filter((e) => e.hasAttribute("aria-label"))
          .map((e) => e.getAttribute("aria-label") as string),
      );
  }

  /**
   * Yes/No column: the cell holds exactly one icon, a check for true or a dash for
   * false (LIST_BOOLEAN_ICON). Checked by presence, not visibility: the icon is an
   * external svg sprite (<use xlink:href>) that may not paint in headless runs or traces.
   * On failure the error lists the icons found in the cell and the cell HTML:
   *   Received ["check"] -> the saved value differs (app or data issue, not the script)
   *   Received []        -> the cell has no icon (empty value, or a different DOM)
   */
  async expectListBoolean(rowKey: string, column: string, value: boolean) {
    const cell = await this.listCell(rowKey, column);
    const want = LIST_BOOLEAN_ICON[`${value}`];
    try {
      await expect
        .poll(() => this.iconLabels(cell), {
          message: `List "${column}" of row ${rowKey}: expected icon "${want}" (${value})`,
        })
        .toEqual([want]);
    } catch (e) {
      const html = await cell
        .evaluate((el) =>
          el.innerHTML
            .replace(/<style[\s\S]*?<\/style>/g, "")
            .replace(/\s+/g, " ")
            .slice(0, 600),
        )
        .catch(() => "(cell not readable)");
      if (e instanceof Error)
        e.message += `\nCell HTML (styles removed): ${html}`;
      throw e;
    }
  }

  /** Active column: badge text (LIST_ACTIVE_BADGE). The badge colour is not checked. */
  async expectListActive(rowKey: string, active: boolean) {
    const cell = await this.listCell(rowKey, LIST_ACTIVE_COLUMN);
    await expect(cell).toHaveText(LIST_ACTIVE_BADGE[`${active}`]);
  }

  /**
   * Several cells of one row. string = text; boolean = Active badge for the Active
   * column, Yes/No icon for every other column. undefined = not checked.
   */
  async expectListValues(
    rowKey: string,
    values: Record<string, string | boolean | undefined>,
  ) {
    for (const [column, value] of Object.entries(values)) {
      if (value === undefined) continue;
      if (typeof value === "string")
        await this.expectListCell(rowKey, column, value);
      else if (column === LIST_ACTIVE_COLUMN)
        await this.expectListActive(rowKey, value);
      else await this.expectListBoolean(rowKey, column, value);
    }
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

  /**
   * Deactivate on the LIST (rows must be selected first): More → Deactivate.
   * Same More button as Delete on the list (record-action-btn-more).
   */
  async clickDeactivate() {
    await this.page.getByTestId("record-action-btn-more").click();
    await this.page.getByTestId("btn-deactivate").click();
  }

  /** Deactivate on the DETAIL view: More (btn-detail-more) → Deactivate. */
  async clickDetailDeactivate() {
    await this.openDetailMore();
    await this.page.getByTestId("btn-deactivate").click();
  }

  /**
   * General Lumina active/inactive process, from the list:
   * select rows → More → Deactivate → confirm "Deactivate".
   * Inactive records are hidden by the default list filter (Active = Yes), so the rows
   * must leave the list. The list must already be open.
   */
  async deactivate(
    columnName: string,
    values: string[],
    opts: { confirmMessage?: string } = {},
  ) {
    await this.selectRowsByColumn(columnName, values);
    await this.clickDeactivate();
    if (opts.confirmMessage) await this.expectDialogText(opts.confirmMessage);
    await this.confirmDialog("Deactivate");
    for (const value of values) await this.expectRowNotInList(value);
  }

  /**
   * Deactivate the record open in the detail view: More → Deactivate → confirm "Deactivate".
   * What the page shows afterwards is not confirmed yet: the caller asserts the result
   * (e.g. open the list and expect the record not shown).
   */
  async deactivateFromDetail(opts: { confirmMessage?: string } = {}) {
    await this.clickDetailDeactivate();
    if (opts.confirmMessage) await this.expectDialogText(opts.confirmMessage);
    await this.confirmDialog("Deactivate");
    await this.page.waitForTimeout(2000);
  }

  /** Activate on the LIST (rows must be selected first): More → Activate. */
  async clickActivate() {
    await this.page.getByTestId("record-action-btn-more").click();
    await this.page.getByTestId("btn-activate").click();
  }

  /** Activate on the DETAIL view: More (btn-detail-more) → Activate. */
  async clickDetailActivate() {
    await this.openDetailMore();
    await this.page.getByTestId("btn-activate").click();
  }

  /**
   * Activate from the list. Inactive rows show only with a Custom Filter, so call
   * showInactiveOnly() first. Select rows → More → Activate → confirm "Activate".
   * The list keeps the inactive-only filter, so the rows must leave it.
   */
  async activate(
    columnName: string,
    values: string[],
    opts: { confirmMessage?: string } = {},
  ) {
    await this.selectRowsByColumn(columnName, values);
    await this.clickActivate();
    if (opts.confirmMessage) await this.expectDialogText(opts.confirmMessage);
    await this.confirmDialog("Activate");
    for (const value of values) await this.expectRowNotInList(value);
  }

  /**
   * Activate the record open in the detail view: More → Activate → confirm "Activate".
   * The caller asserts the result (e.g. open the list and expect the record shown).
   */
  async activateFromDetail(opts: { confirmMessage?: string } = {}) {
    await this.clickDetailActivate();
    if (opts.confirmMessage) await this.expectDialogText(opts.confirmMessage);
    await this.confirmDialog("Activate");
  }

  // =====================================================================
  // Custom Filter (list view)
  // =====================================================================

  /**
   * The Custom Filter panel: the <form> that holds the Apply button (cf-apply).
   * Condition rows have ids that change on every render (cf-row-13-field-input,
   * cf-row-14-..., ...): only their prefix "cf-row-" and their suffix are stable.
   */
  protected customFilterPanel(): Locator {
    return this.page
      .locator("form")
      .filter({ has: this.page.getByTestId("cf-apply") });
  }

  /**
   * A control of the first condition row, found by the stable id suffix:
   * "field-input" (input name="field"), "operator-combobox" (role combobox, text "Operator"),
   * "value-input" (input name="value").
   */
  protected customFilterControl(
    part: "field-input" | "operator-combobox" | "value",
  ): Locator {
    const panel = this.customFilterPanel();
    if (part !== "value") {
      return panel.locator(`[id^="cf-row-"][id$="-${part}"]`).first();
    }
    // The value control shows only after an operator is picked. Its tag/suffix is not
    // fixed by the DOM seen so far (input "-value-input" or div "-value-combobox"):
    // take the element with role combobox whose id has "-value" (not the role=group wrapper).
    return panel
      .locator('[id^="cf-row-"][id*="-value"]')
      .and(this.page.getByRole("combobox"))
      .first();
  }

  /** Whole text of an option, trimmed, case ignored (an option may hold an icon, or CSS uppercase). */
  private optionText(name: string): RegExp {
    return new RegExp(`^\\s*${escapeRegExp(name)}\\s*$`, "i");
  }

  /** The open dropdown option with this text (options may render outside the panel). */
  protected listOption(name: string): Locator {
    const text = this.optionText(name);
    return this.page
      .getByRole("option")
      .filter({ hasText: text })
      .or(this.page.getByRole("listbox").getByText(text))
      .first();
  }

  protected async pickListOption(name: string) {
    await this.listOption(name).click();
  }

  /** Current shown value of a combobox: input value, or text of a div combobox. */
  private comboboxValue(control: Locator): Promise<string> {
    return control.evaluate((el) =>
      el instanceof HTMLInputElement ? el.value : (el.textContent ?? "").trim(),
    );
  }

  /**
   * Choose a value in a combobox: open it; type only when the option does not show
   * and the control accepts typing (a select-only dropdown must not be typed into);
   * click the option; check the shown value. Case is ignored in the check, because
   * the UI may show the option with CSS uppercase.
   */
  protected async chooseInCombobox(control: Locator, name: string) {
    await control.click();
    const option = this.listOption(name);
    const shown = await option
      .waitFor({ state: "visible", timeout: 2000 })
      .then(
        () => true,
        () => false,
      );
    if (!shown) {
      const typeable = await control.evaluate(
        (el) => el instanceof HTMLInputElement && !el.readOnly && !el.disabled,
      );
      if (typeable) await control.fill(name);
    }
    // Bounded waits: on failure the caller still has time to report what the UI shows.
    await option.click({ timeout: 5000 });
    await expect
      .poll(() => this.comboboxValue(control), { timeout: 5000 })
      .toMatch(this.optionText(name));
  }

  /** Open the Custom Filter panel (cf-trigger). Clears a previous condition (cf-reset) if any. */
  async openCustomFilter() {
    await this.page.getByTestId("cf-trigger").click();
    await expect(this.customFilterPanel()).toBeVisible();
    const reset = this.page.getByTestId("cf-reset");
    if (await reset.isEnabled()) await reset.click();
  }

  /**
   * One Custom Filter condition: field → operator → value → Apply.
   * Option texts as shown in the UI, e.g. ("Active", "=", "FALSE").
   * The list must be open. The caller asserts the rows it expects.
   */
  async applyCustomFilter(field: string, operator: string, value: string) {
    await this.openCustomFilter();

    const fieldInput = this.customFilterControl("field-input");
    await fieldInput.click();
    await fieldInput.fill(field);
    await this.pickListOption(field);
    await expect(fieldInput).toHaveValue(field);

    // Operator is disabled until a field is chosen; it is a <div role="combobox">.
    const operatorBox = this.customFilterControl("operator-combobox");
    await operatorBox.click();
    await this.pickListOption(operator);
    await expect(operatorBox).toHaveText(operator);

    const valueBox = this.customFilterControl("value");
    try {
      await this.chooseInCombobox(valueBox, value);
    } catch (e) {
      // Show what the filter row and the open dropdown really hold.
      const row = await this.customFilterPanel()
        .locator('[id^="cf-row-"][id$="-field"]')
        .first()
        .evaluate((el) =>
          (el.parentElement?.outerHTML ?? "")
            .replace(/<style[\s\S]*?<\/style>/g, "")
            .replace(/<svg[\s\S]*?<\/svg>/g, "<svg/>")
            .replace(/\s+/g, " ")
            .slice(0, 1500),
        )
        .catch(() => "(row not readable)");
      const options = await this.page
        .getByRole("option")
        .allInnerTexts()
        .catch(() => []);
      if (e instanceof Error) {
        e.message += `\nCustom Filter value "${value}" not chosen.\nOptions shown: ${JSON.stringify(options)}\nRow HTML: ${row}`;
      }
      throw e;
    }

    await this.page.getByTestId("cf-apply").click();
    await this.expectTableLoaded();
  }

  /** List inactive records only: Custom Filter Active = FALSE (CF_INACTIVE_ONLY). */
  async showInactiveOnly() {
    const { field, operator, value } = CF_INACTIVE_ONLY;
    await this.applyCustomFilter(field, operator, value);
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
      .then(
        () => true,
        () => false,
      );
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
   * Detail view field value: the first element after the label. DOM:
   * <div>
   *   <div><p>{Label}</p></div>
   *   <p>{Value}</p>              <- text value
   *   or <a href="...">{Value}</a> / <p><a>{Value}</a></p>   <- hyperlink value
   * </div>
   */
  protected detailValue(label: string): Locator {
    return this.page.locator(
      `xpath=//div[p[normalize-space()='${label}']]/following-sibling::*[1]`,
    );
  }

  /** The hyperlink of a detail field: the value element itself, or a link inside it. */
  protected detailLink(label: string): Locator {
    const value = this.detailValue(label);
    return value.and(this.page.getByRole("link")).or(value.getByRole("link"));
  }

  /** The field value is a hyperlink with this exact text (after trim). */
  async expectDetailLink(label: string, text: string) {
    const link = this.detailLink(label);
    await expect(link).toHaveCount(1);
    await expect(link).toHaveText(text.trim());
  }

  /** Click the hyperlink of a detail field (opens the linked record). */
  async openDetailLink(label: string) {
    await this.detailLink(label).click();
  }

  /**
   * Exact text, case-sensitive. "" (or spaces) = must be empty, shown as "-".
   * Works the same for a text value (<p>) and a hyperlink value (<a>): the test does not
   * need to know which fields are links. Use expectDetailLink only to assert it IS a link.
   */
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
        throw new Error(
          `Detail field "${String(key)}" is not text; check it separately.`,
        );
      }
      if (key === map.titleField) {
        await this.expectDetailOpened(value);
        continue;
      }
      const label = map.labels[key];
      if (!label) {
        throw new Error(
          `No detail label for field "${String(key)}". Add it to DETAIL_LABELS.`,
        );
      }
      await this.expectDetailValue(label, value); // text or hyperlink, see detailValue()
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
    await expect(
      this.page.getByText(message, { exact: true }).first(),
    ).toBeVisible();
  }

  /**
   * Where toasts render. The toast DOM is not confirmed yet, so this is the whole page:
   * once known, return the toast container (e.g. getByRole("alert") or its id) so a
   * toast cannot be confused with the same text inline. Change only here.
   */
  protected toastScope(): Locator {
    return this.page.locator("body");
  }

  /**
   * A toast shows this message: exact text (string) or an anchored pattern (RegExp).
   * Toasts close by themselves after a few seconds: call this right after the action,
   * with no wait, screenshot or navigation in between; take the evidence screenshot
   * right after it.
   */
  async expectToast(message: string | RegExp) {
    const toast =
      typeof message === "string"
        ? this.toastScope().getByText(message, { exact: true })
        : this.toastScope().getByText(message);
    await expect(toast.first()).toBeVisible();
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
    await expect(input).toHaveValue(new RegExp(escapeRegExp(name)));
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
