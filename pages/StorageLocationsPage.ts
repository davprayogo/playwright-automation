import { expect } from "@playwright/test";
import { BasePage } from "./BasePage";
import type { StorageLocation } from "@data/wms/storageLocations";

export class StorageLocationsPage extends BasePage {
  readonly path = "/wms/master-data/storage-locations";

  private inputName = () => this.page.getByTestId("sl-name-input");
  private inputDecription = () => this.page.getByTestId("am-description-input");
  private inputAreaMaster = () => this.page.getByTestId("sl-area-master-input");
  private inputSapRefrence = () =>
    this.page.getByTestId("sl-sap-reference-input");
  private inputSapStatus = () => this.page.getByTestId("sl-sap-status-input");
  private inputRemarks = () => this.page.getByTestId("am-remarks-input");

  private async fillForm(data: StorageLocation) {
    await this.inputName().fill(data.name);
    await this.selectOptions(this.inputAreaMaster, data.areaMaster);
    await this.inputDecription().fill(data.description ?? "");
    await this.inputSapRefrence().fill(data.sapReference ?? "");
    await this.inputSapStatus().fill(data.sapStatus ?? "");
    await this.inputRemarks().fill(data.remarks ?? "");
    await this.inputRemarks().fill(data.remarks ?? "");
  }

  async open() {
    await this.goto(this.path);
    await this.expectTableLoaded();
  }

  async create(data: StorageLocation) {
    await this.openCreatePage();
    await this.fillForm(data);
    await this.clickSave();
    await this.confirmDialog("Save");
    await expect(
      this.page.getByRole("heading", { name: data.name }),
    ).toBeVisible();
  }

  async update(oldValue: string, data: StorageLocation) {
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
