/**
 * Generic record access for any menu: BasePage functions by record number, used by the
 * data-set provider (find by identity key, open / delete / deactivate by record number,
 * read the detail view). No menu-specific code.
 *
 * Record number: read from the detail URL `{path}/{id}` (FSD ZSN_ETCMS001 8.2.10). The route
 * pattern is assumed from the hyperlink seen in Production Lines
 * (".../production-lines/70/process-masters/46"): confirm it per menu (finding TCMS-F06).
 */
import { expect, type Locator, type Page } from "@playwright/test";
import { BasePage } from "@core/BasePage";
import { DETAIL_EMPTY_DISPLAY, deleteConfirmMessage } from "@core/constants";
import { SetupError } from "./errors";
import type { FieldValues } from "./runSetup";

export class RecordPage extends BasePage {
  constructor(page: Page, readonly path: string) {
    super(page);
  }

  /** Record number of the open detail view, from the URL `{path}/{id}`. */
  recordNoFromUrl(): string {
    const url = new URL(this.page.url());
    const match = url.pathname.match(new RegExp(`${this.path}/(\\d+)(?:/|$)`));
    if (!match) {
      throw new SetupError(`No record number in the URL ${url.pathname} (expected ${this.path}/{id}).`);
    }
    return match[1];
  }

  async openRecord(recordNo: string) {
    await this.goto(`${this.path}/${recordNo}`);
    await expect(this.page.getByTestId("btn-detail-more")).toBeVisible();
  }

  /** Delete by record number from the detail view, never by searching a name (FR-230). */
  async deleteRecord(recordNo: string) {
    await this.openRecord(recordNo);
    await this.clickDetailDelete();
    await this.expectDialogText(deleteConfirmMessage(1));
    await this.confirmDialog("Delete");
  }

  /** Deactivate by record number from the detail view (general active/inactive process). */
  async deactivateRecord(recordNo: string) {
    await this.openRecord(recordNo);
    await this.deactivateFromDetail();
  }

  /** Data rows whose cells hold every value (exact, trimmed). Active list, or inactive only. */
  async findRows(cells: string[], inactive: boolean): Promise<Locator> {
    await this.goto(this.path);
    await this.expectTableLoaded();
    if (inactive) await this.showInactiveOnly();
    return this.rowByCells(...cells);
  }

  /** Values of the open detail view: H6 title + each label ("-" read as ""). */
  async readDetail(titleLabel: string, labels: readonly string[]): Promise<FieldValues> {
    const title = this.page.getByRole("heading", { level: 6 }).first();
    await expect(title).toBeVisible();
    const out: FieldValues = { [titleLabel]: (await title.innerText()).trim() };
    for (const label of labels) {
      const value = this.detailValue(label);
      if ((await value.count()) === 0) continue; // e.g. a toggle with no text row
      const text = (await value.first().innerText()).trim();
      out[label] = text === DETAIL_EMPTY_DISPLAY ? "" : text;
    }
    return out;
  }
}