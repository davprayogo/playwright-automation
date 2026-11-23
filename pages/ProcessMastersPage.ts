import {
  BasePage,
  deleteConfirmMessage,
  type DetailFieldMap,
} from "./BasePage";
import type { ProcessMaster } from "@data/masterdata/ProcessMasters";

/**
 * Field shown as the detail view H6 title — it has no label/value row.
 * FSD MOM-67 does not name the title field: Name is assumed (the unique key).
 */
const DETAIL_TITLE_FIELD = "name" as const;

/** Detail view label/value rows — FSD MOM-67 Section 7.5, Detail View, minus the title field. */
const DETAIL_LABELS: Record<
  Exclude<keyof ProcessMaster, typeof DETAIL_TITLE_FIELD>,
  string
> = {
  description: "Description",
};

const DETAIL_FIELDS: DetailFieldMap<ProcessMaster> = {
  titleField: DETAIL_TITLE_FIELD,
  labels: DETAIL_LABELS,
};

export class ProcessMastersPage extends BasePage {
  readonly path = "/master-data/manufacturing-processes/process-masters";

  // Test ids follow the Production Line toggle seen in the UI:
  // {prefix}-{field name in the data model, kebab-case}-input. Prefix "pm" is assumed.
  // Active is read only: no input locator.
  private inputName = () => this.page.getByTestId("pr-name-input");
  private inputDescription = () =>
    this.page.getByTestId("pr-description-input");

  // ---------- Navigation ----------

  async open() {
    await this.goto(this.path);
    await this.expectTableLoaded();
  }

  async openDetail(name: string) {
    await this.open();
    await this.openDetailByColumn("Name", name);
    await this.expectDetailOpened(name);
  }

  // ---------- Actions ----------

  async create(data: ProcessMaster) {
    await this.openCreatePage();
    await this.fillForm(data);
    await this.clickSave();
    await this.confirmDialog("Save");
    await this.expectDetailOpened(data.name);
  }

  /** Delete from the list (FR-100). Rows must be selected first. */
  async delete(names: string[]) {
    await this.selectRowsByColumn("Name", names);
    await this.clickDelete();
    await this.expectDialogText(deleteConfirmMessage(names.length)); // "Delete 1 Record?" / "Delete {qty} Records?"
    await this.confirmDialog("Delete");
    for (const name of names) await this.expectNotInList(name);
  }

  // ---------- Assertions ----------

  /** Field undefined = not checked, "" = empty (UI "-"). Name is checked on the H6 title. */
  async expectDetail(expected: Partial<ProcessMaster>) {
    await this.expectDetailFields(expected, DETAIL_FIELDS);
  }

  async expectInList(name: string) {
    await this.expectRowInList(name);
  }

  async expectNotInList(name: string) {
    await this.expectRowNotInList(name);
  }

  // ---------- Helpers ----------

  /** Field undefined = not touched. Name is filled on New only (read only after save). */
  private async fillForm(data: Partial<ProcessMaster>) {
    const fields = [
      [this.inputName, data.name],
      [this.inputDescription, data.description],
    ] as const;
    for (const [input, value] of fields) {
      if (value !== undefined) await input().fill(value);
    }
  }
}
