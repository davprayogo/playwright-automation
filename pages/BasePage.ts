import { Page, Locator, expect } from "@playwright/test";
import { clickRowByColumnValue } from "@utils/table-helper";
import { selectCheckboxesByColumnValues } from "@utils/table-helper";

/**
 * Base class untuk semua Page Object.
 * Taruh aksi umum yang dipakai ulang di banyak halaman.
 */
export abstract class BasePage {
  constructor(protected readonly page: Page) {}

  async goto(path: string) {
    await this.page.goto(path);
  }

  /** Klik menu di navigasi samping/atas berdasarkan nama. */
  async openMenu(name: string) {
    await this.page.getByRole("link", { name, exact: true }).first().click();
  }

  /** Tunggu sampai baris pertama tabel muncul (list view siap). */
  async expectTableLoaded() {
    await expect(this.tableRows().first()).toBeVisible();
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

  // async confirmDialog(buttonName = "Ya") {
  //   await this.page.getByRole("button", { name: buttonName }).click();
  // }

  /** Baris data yang bisa dibuka (punya detail). Baris skeleton tidak ikut. */
  clickableRows(): Locator {
    return this.page.locator('tbody > tr[class*="cursor-pointer"]');
  }

  /** General Function kayak Click button Create, Click Save, Click Delete, Click Edit */
  async openCreatePage() {
    await this.page.getByTestId("button-create").click();
  }

  async clickEdit() {
    this.page.getByTestId("btn-detail-edit").click();
  }

  async clickSave() {
    this.page.getByTestId("btn-detail-save").click();
  }

  async clickDelete() {
    await this.page.getByTestId("record-action-btn-more").click();
    await this.page.getByTestId("record-action-btn-delete").click();
  }

  protected dialog() {
    return this.page.getByRole("dialog");
  }

  async confirmDialog(buttonName = "Save") {
    const dialog = this.dialog();
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: buttonName, exact: true }).click();
    await expect(dialog).toBeHidden();
  }
  async openDetailByColumn(columnName: string, value: string) {
    await clickRowByColumnValue(this.page, columnName, value);
  }

  async selectRowsByColumn(columnName: string, values: string[]) {
    await selectCheckboxesByColumnValues(this.page, columnName, values);
  }

  async selectOptions(locator: () => Locator, name: string) {
    const input = locator();
    await input.click();
    await input.fill(name); // memfilter daftar
    // const option = this.page
    //   .getByRole("option")
    //   .filter({ hasText: name })
    //   .first();
    // const label = (await option.innerText()).replace(/\s+/g, " ").trim();
    // await option.click();
    // await expect(input).toHaveValue(label);
    await this.page
      .getByRole("option", { exact: true })
      .filter({ hasText: name })
      .click();
    await expect(input).toHaveValue(
      new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    );
  }
}
