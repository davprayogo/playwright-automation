import { BasePage, type DetailFieldMap } from "./BasePage";
import type { AreaMaster } from "@data/wms/areaMaster";

/** Field shown as the detail view H6 title — it has no label/value row. */
const DETAIL_TITLE_FIELD = "name" as const;

/**
 * Detail view label/value rows — field names from FSD MOM-98 Section 7.5.2,
 * minus the title field (shown only as H6).
 */
const DETAIL_LABELS: Record<
  Exclude<keyof AreaMaster, typeof DETAIL_TITLE_FIELD>,
  string
> = {
  factory: "Factory",
  floor: "Floor",
  division: "Division",
  description: "Description",
  remark: "Remark",
};

const DETAIL_FIELDS: DetailFieldMap<AreaMaster> = {
  titleField: DETAIL_TITLE_FIELD,
  labels: DETAIL_LABELS,
};

export class AreaMastersPage extends BasePage {
  readonly path = "/master-data/plant-structures/area-masters";

  // Rule: {prefix-menu}-{field-name}-input  (Area Masters -> "am")
  private inputFactory = () => this.page.getByTestId("am-factory-input");
  private inputName = () => this.page.getByTestId("am-name-input");
  private inputFloor = () => this.page.getByTestId("am-floor-input");
  private inputDivision = () => this.page.getByTestId("am-division-input");
  private inputDescription = () =>
    this.page.getByTestId("am-description-input");
  private inputRemark = () => this.page.getByTestId("am-remark-input");

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

  async create(data: AreaMaster) {
    await this.openCreatePage();
    await this.fillForm(data);
    await this.clickSave();
    await this.confirmDialog("Save");
    await this.expectDetailOpened(data.name);
  }

  /**
   * Field undefined = not touched, "" = cleared.
   * The list must already be open (call open() first).
   */
  async update(oldName: string, data: Partial<AreaMaster>) {
    await this.openDetailByColumn("Name", oldName);
    await this.clickEdit();
    await this.fillForm(data);
    await this.clickSave();
    await this.confirmDialog("Save");
    await this.expectNoDialog("Duplicate Record");
    await this.expectDetailOpened(data.name ?? oldName);
  }

  /** Delete from the list. Rows must be selected first. */
  async delete(names: string[], opts: { confirmMessage?: string } = {}) {
    await this.selectRowsByColumn("Name", names);
    await this.clickDelete();
    if (opts.confirmMessage) await this.expectDialogText(opts.confirmMessage);
    await this.confirmDialog("Delete");
    for (const name of names) await this.expectNotInList(name);
  }

  /** Delete from the area page (FR-80): More → Delete → confirm. */
  async deleteFromDetail(name: string) {
    await this.openDetail(name);
    await this.clickDetailDelete();
    await this.expectDialogText(`Delete 1 Records?`);
    await this.confirmDialog("Delete");
    await this.open();
    await this.expectNotInList(name);
  }

  /** Select rows, click Delete, then cancel the confirmation. */
  async cancelDelete(names: string[]) {
    await this.selectRowsByColumn("Name", names);
    await this.clickDelete();
    await this.confirmDialog("Cancel");
    for (const name of names) await this.expectInList(name);
  }

  // ---------- Assertions (menu-specific wrappers over BasePage) ----------

  /** Field undefined = not checked, "" = empty (UI "-"). Name is checked on the H6 title. */
  async expectDetail(expected: Partial<AreaMaster>) {
    await this.expectDetailFields(expected, DETAIL_FIELDS);
  }

  async expectInList(name: string, factory?: string) {
    await this.expectRowInList(...this.rowCells(name, factory));
  }

  async expectNotInList(name: string, factory?: string) {
    await this.expectRowNotInList(...this.rowCells(name, factory));
  }

  // ---------- Helpers ----------

  private rowCells(name: string, factory?: string) {
    return factory ? [name, factory] : [name];
  }

  private fieldMap(data: Partial<AreaMaster>) {
    return [
      [this.inputFactory, data.factory],
      [this.inputName, data.name],
      [this.inputFloor, data.floor],
      [this.inputDivision, data.division],
      [this.inputDescription, data.description],
      [this.inputRemark, data.remark],
    ] as const;
  }

  private async fillForm(data: Partial<AreaMaster>) {
    for (const [input, value] of this.fieldMap(data)) {
      if (value !== undefined) await input().fill(value);
    }
  }
}