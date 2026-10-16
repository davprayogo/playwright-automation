import { expect } from "@playwright/test";
import { BasePage } from "./BasePage";
import type { AreaMaster } from "@data/wms/areaMaster";

export class AreaMastersPage extends BasePage {
  readonly path = "/wms/master-data/area-masters";

  private inputName = () => this.page.getByTestId("am-name-input");
  private inputDescription = () =>
    this.page.getByTestId("am-description-input");
  private inputFloor = () => this.page.getByTestId("am-floor-input");
  private inputRemarks = () => this.page.getByTestId("am-remarks-input");

  async open() {
    await this.goto(this.path);
    await this.expectTableLoaded();
  }

  async create(data: AreaMaster) {
    await this.openCreatePage();
    await this.inputName().fill(data.name);
    if (data.description) {
      await this.inputDescription().fill(data.description);
    }
    if (data.floor) {
      await this.inputFloor().fill(data.floor);
    }
    if (data.remarks) {
      await this.inputRemarks().fill(data.remarks);
    }
    await this.clickSave();
    await this.confirmDialog("Save");
    await expect(
      this.page.getByRole("heading", { name: data.name }),
    ).toBeVisible();
  }

  async update(oldValue: string, data: AreaMaster) {
    await this.openDetailByColumn("Name", oldValue);
    await this.clickEdit();
    await this.inputName().fill(data.name);
    if (data.description) {
      await this.inputDescription().fill(data.description);
    }
    if (data.floor) {
      await this.inputFloor().fill(data.floor);
    }
    if (data.remarks) {
      await this.inputRemarks().fill(data.remarks);
    }
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
