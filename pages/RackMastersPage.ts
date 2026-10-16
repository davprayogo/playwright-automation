import { expect } from "@playwright/test";
import { BasePage } from "./BasePage";
import type { RackMaster } from "@data/wms/rackMaster";

export class RackMastersPage extends BasePage {
  readonly path = "/wms/master-data/rack-masters";

  private inputName = () => this.page.getByTestId("rk-name-input");
  private inputDescription = () =>
    this.page.getByTestId("rk-description-input");
  private inputStorageLocation = () =>
    this.page.getByTestId("rk-storage-location-input");
  private inputRemarks = () => this.page.getByTestId("rk-remarks-input");

  private async fillForm(data: RackMaster) {
    await this.inputName().fill(data.name);
    await this.inputDescription().fill(data.description ?? "");
    await this.selectOptions(this.inputStorageLocation, data.storageLocation);
    await this.inputRemarks().fill(data.remarks ?? "");
  }

  async open() {
    await this.goto(this.path);
    await this.expectTableLoaded();
  }

  async create(data: RackMaster) {
    await this.openCreatePage();
    await this.fillForm(data);
    await this.clickSave();
    await this.confirmDialog("Save");
    await expect(
      this.page.getByRole("heading", { name: data.name }),
    ).toBeVisible();
  }

  async update(oldValue: string, data: RackMaster) {
    await this.openDetailByColumn("Name", oldValue);
    await this.clickEdit();
    await this.fillForm(data);
    await this.page.waitForTimeout(2000);
    await this.clickSave();
    await this.confirmDialog("Save");
    await expect(
      this.page.getByRole("heading", { name: data.name }),
    ).toBeVisible();
  }

  async delete(values: string[]) {
    await this.selectRowsByColumn("Name", values);
    await this.clickDelete();
    await this.confirmDialog("Delete");
  }
}
