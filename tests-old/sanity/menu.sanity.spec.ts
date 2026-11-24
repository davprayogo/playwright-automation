import { test, expect } from "@playwright/test";
import { SessionPage } from "@pages/SessionPage";
import { MenuPage } from "@pages/MenuPage";
import { modules } from "@data/modules";
import { clickRandomRow } from "@utils/table-helper";

const server = process.env.SERVER_NAME ?? "dev1";

for (const mod of modules) {
  test.describe(mod.name, { tag: ["@sanity", `@${mod.key}`] }, () => {
    // Padanan: select server + select module di Test Suite Katalon
    test.beforeEach(async ({ page }) => {
      const session = new SessionPage(page);
      await page.goto("/");
      // await session.selectServer(server);
      await session.selectModule(mod);
      await page.waitForURL(new RegExp(`/${mod.key}/`), { timeout: 30_000 });
    });

    for (const menu of mod.menus) {
      test(`${menu.group} › ${menu.name}`, async ({ page }, testInfo) => {
        const menuPage = new MenuPage(page);
        const hasTable = menu.hasTable !== false;
        const hasDetail = hasTable && menu.hasDetail !== false;

        await test.step("Buka menu", async () => {
          await menuPage.ensureOnMenu(menu);
        });

        await test.step("Verifikasi judul dan tabel", async () => {
          await expect(menuPage.heading(menu)).toBeVisible();
          await expect(page).toHaveURL(new RegExp(menu.path));
          if (!hasTable) return;
          if (menu.allowEmpty) {
            await expect(menuPage.tableBody()).toBeVisible();
          } else if (hasDetail) {
            await expect(menuPage.clickableRows().first()).toBeVisible();
          } else {
            await menuPage.expectTableLoaded();
          }
        });

        if (hasDetail) {
          await test.step("Klik baris acak dan buka detail", async () => {
            await clickRandomRow(menuPage.clickableRows(), testInfo);
            await menuPage.expectDetailOpened(menu);
            await testInfo.attach(`${menu.name}-detail`, {
              body: await page.screenshot({ fullPage: true }),
              contentType: "image/png",
            });
          });

          await test.step("Kembali ke list lewat breadcrumb", async () => {
            await menuPage.backToListViaBreadcrumb(menu);
            await menuPage.expectTableLoaded();
          });
        } else {
          // Tanpa detail, screenshot list menggantikan screenshot detail
          await testInfo.attach(`${menu.name}-list`, {
            body: await page.screenshot({ fullPage: true }),
            contentType: "image/png",
          });
        }
      });
    }
  });
}
