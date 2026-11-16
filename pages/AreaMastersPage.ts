import { expect } from "@playwright/test";
import { BasePage } from "./BasePage";
import type { AreaMaster } from "@data/wms/areaMaster";

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

  // private dialog = () => this.page.getByRole("dialog");

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
    await this.expectNoDuplicateModal();
    await this.expectDetailOpened(data.name ?? oldName);
  }

  /** Delete from the list. Rows must be selected first (rule 9). */
  async delete(names: string[], opts: { confirmMessage?: string } = {}) {
    await this.selectRowsByColumn("Name", names);
    await this.clickDelete();
    if (opts.confirmMessage) {
      await expect(this.dialog()).toContainText(opts.confirmMessage);
    }
    await this.confirmDialog("Delete");
    for (const name of names) {
      await this.expectNotInList(name);
    }
  }

  /** Delete from the area page (FR-80). */
  async deleteFromDetail(name: string) {
    await this.openDetail(name);
    await this.clickDelete();
    await expect(this.dialog()).toContainText(`Delete area ${name.trim()}?`);
    await this.confirmDialog("Delete");
    await this.open();
    await this.expectNotInList(name);
  }

  /** Select rows, click Delete, then cancel the confirmation. */
  async cancelDelete(names: string[]) {
    await this.selectRowsByColumn("Name", names);
    await this.clickDelete();
    await this.confirmDialog("Cancel");
    for (const name of names) {
      await this.expectInList(name);
    }
  }

  // ---------- Assertions ----------

  async expectDetailOpened(name: string) {
    await expect(
      this.page.getByRole("heading", { name: name.trim(), exact: true }),
    ).toBeVisible();
  }

  /** ASSUMPTION: the area page (view mode) renders the same test-id inputs. */
  async expectDetail(expected: Partial<AreaMaster>) {
    const map = this.fieldMap(expected);
    for (const [input, value] of map) {
      if (value !== undefined) await expect(input()).toHaveValue(value);
    }
  }

  async expectListColumns(columns: string[]) {
    for (const column of columns) {
      await expect(
        this.page.getByRole("columnheader", { name: column, exact: true }),
      ).toBeVisible();
    }
  }

  async expectInList(name: string, factory?: string) {
    await expect(this.rowOf(name, factory)).toHaveCount(1);
  }

  async expectNotInList(name: string, factory?: string) {
    await expect(this.rowOf(name, factory)).toHaveCount(0);
  }

  async expectNoDuplicateModal() {
    await expect(
      this.page.getByRole("dialog", { name: "Duplicate Record" }),
    ).toHaveCount(0);
  }

  // ---------- Helpers ----------

  private rowOf(name: string, factory?: string) {
    let row = this.page.getByRole("row").filter({
      has: this.page.getByRole("cell", { name: name.trim(), exact: true }),
    });
    if (factory) {
      row = row.filter({
        has: this.page.getByRole("cell", { name: factory, exact: true }),
      });
    }
    return row;
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