import { BasePage } from "./BasePage";
import { MenuItem } from "@data/modules";
import { expect } from "@playwright/test";

export class MenuPage extends BasePage {
  // TODO: samakan dengan selector Test Object Katalon
  private burger = () => this.page.getByTestId("module-menu");
  private group = (m: MenuItem) =>
    this.page
      .locator('button[id^="module-menu-item-"]')
      .filter({ has: this.page.getByText(m.group, { exact: true }) });
  private item = (m: MenuItem) =>
    this.page.getByTestId("module-menu-popper").locator(`a[href="${m.path}"]`);
  private breadcrumb = () =>
    this.page.getByRole("navigation", { name: "breadcrumb" });

  heading(m: MenuItem) {
    return this.page.getByRole("heading", { name: m.heading }); // TODO: padanan text_IMEI
  }

  async openFromBurger(m: MenuItem) {
    await this.burger().click();
    const item = this.item(m);
    if (!(await item.isVisible())) {
      // klik grup hanya jika belum terbuka
      await this.group(m).click();
    }
    if ((await item.getAttribute("aria-disabled")) === "true") {
      await this.burger().click(); // tutup menu kembali
      return;
    }
    await item.click();
  }

  /** Jika halaman menu belum terbuka (bukan halaman default modul), buka lewat burger. */
  async ensureOnMenu(m: MenuItem) {
    const onPage = await this.page
      .waitForURL((url) => url.pathname === m.path, { timeout: 5000 })
      .then(
        () => true,
        () => false,
      );
    if (!onPage) await this.openFromBurger(m);
  }

  /** Klik link menu di breadcrumb untuk kembali ke list. */
  async backToListViaBreadcrumb(m: MenuItem) {
    await this.breadcrumb()
      .getByRole("link", { name: m.name, exact: true })
      .click();
    await expect(this.page).toHaveURL(new RegExp(`${m.path}($|\\?)`));
  }

  /** Breadcrumb halaman detail: yang terakhir adalah nama data (bukan link). */
  async expectDetailOpened(m: MenuItem) {
    await expect(this.breadcrumb()).toBeVisible();
    await expect(
      this.breadcrumb().getByRole("link", { name: m.name, exact: true }),
    ).toBeVisible();
  }
}
