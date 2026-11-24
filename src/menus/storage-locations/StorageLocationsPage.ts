import { BasePage, type DetailFieldMap } from "@core/BasePage";
import { deleteConfirmMessage } from "@core/constants";
import type { StorageLocation } from "./storage-location.data";

/**
 * Field shown as the detail view H6 title — it has no label/value row.
 * FSD MOM-113 does not name the title field: Name is assumed.
 */
const DETAIL_TITLE_FIELD = "name" as const;

type TextField = Exclude<keyof StorageLocation, "binManaged">;

/** Detail view label/value rows — FSD MOM-113 Section 7.5.2, minus the title field and Bin Managed (Yes/No). */
const DETAIL_LABELS: Record<Exclude<TextField, typeof DETAIL_TITLE_FIELD>, string> = {
  area: "Area",
  sapReference: "SAP Reference",
  sapStatus: "SAP Status",
  description: "Description",
  remark: "Remark",
};

const DETAIL_FIELDS: DetailFieldMap<Pick<StorageLocation, TextField>> = {
  titleField: DETAIL_TITLE_FIELD,
  labels: DETAIL_LABELS,
};

export class StorageLocationsPage extends BasePage {
  readonly path = "/master-data/plant-structures/storage-locations";

  // Test ids follow the Production Line toggle seen in the UI:
  // {prefix}-{field name in the data model, kebab-case}-input. Prefix "sl" is assumed.
  // Active is read only: no input locator.
  private inputArea = () => this.page.getByTestId("sl-area-master-input");
  private inputName = () => this.page.getByTestId("sl-name-input");
  private inputSapReference = () =>
    this.page.getByTestId("sl-sap-reference-input");
  private inputSapStatus = () => this.page.getByTestId("sl-sap-status-input");
  private inputDescription = () =>
    this.page.getByTestId("sl-description-input");
  private inputRemark = () => this.page.getByTestId("sl-remark-input");
  /** Toggle field id (see BasePage.setToggle). */
  private readonly toggleBinManaged = "sl-is-bin-managed";

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

  async create(data: StorageLocation) {
    await this.openCreatePage();
    await this.fillForm(data);
    await this.clickSave();
    await this.confirmDialog("Save");
    await this.expectDetailOpened(data.name);
  }

  /** Delete from the list (FR-110). Rows must be selected first. Names must be unique in the list. */
  async delete(names: string[]) {
    await this.selectRowsByColumn("Name", names);
    await this.clickDelete();
    await this.expectDialogText(deleteConfirmMessage(names.length)); // "Delete 1 Record?" / "Delete {qty} Records?"
    await this.confirmDialog("Delete");
    for (const name of names) await this.expectNotInList(name);
  }

  // ---------- Assertions ----------

  /** Field undefined = not checked, "" = empty (UI "-"). Name is checked on the H6 title. */
  async expectDetail(expected: Partial<Pick<StorageLocation, TextField>>) {
    await this.expectDetailFields(expected, DETAIL_FIELDS);
  }

  async expectInList(name: string, area?: string) {
    await this.expectRowInList(...(area ? [name, area] : [name]));
  }

  async expectNotInList(name: string, area?: string) {
    await this.expectRowNotInList(...(area ? [name, area] : [name]));
  }

  // ---------- Helpers ----------

  /** Field undefined = not touched. */
  private async fillForm(data: Partial<StorageLocation>) {
    if (data.area !== undefined) await this.selectOptions(this.inputArea, data.area);
    const text = [
      [this.inputName, data.name],
      [this.inputSapReference, data.sapReference],
      [this.inputSapStatus, data.sapStatus],
      [this.inputDescription, data.description],
      [this.inputRemark, data.remark],
    ] as const;
    for (const [input, value] of text) {
      if (value !== undefined) await input().fill(value);
    }
    if (data.binManaged !== undefined) {
      await this.setToggle(this.toggleBinManaged, data.binManaged);
    }
  }
}