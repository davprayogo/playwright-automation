import { test } from "@fixtures/test-fixtures";
import { SessionPage } from "@pages/SessionPage";
import { attachScreenshot } from "@utils/screenshot";

const server = process.env.SERVER_NAME ?? "dev1";

/**
 * Regresi CUD lewat UI. Data dibuat unik, lalu dihapus di akhir
 * sehingga tidak meninggalkan sampah di environment.
 */
test.describe.serial("@crud Area Masters", () => {
  const dataCreateAreaMaster = {
    name: "Office MIS",
    description: "Create By playwright",
    floor: "4#15",
  };
  const DataUpdateAreaMaster = {
    name: "Office MIS-MES",
    description: "Create By playwright",
  };
  // test.beforeEach(async ({ page }) => {
  //   const session = new SessionPage(page);
  //   await page.goto("/");
  //   await session.selectServer(server);
  //   await session.selectModulebyText("WMS");
  //   await page.waitForURL(new RegExp(`/wms/`), { timeout: 30_000 });
  // });
  test("Create", async ({ areaMastersPage, page }, testInfo) => {
    await areaMastersPage.open();
    await areaMastersPage.create(dataCreateAreaMaster);
    await attachScreenshot(page, testInfo, "Area Masters - setelah Create");
  });
  test("Update", async ({ areaMastersPage, page }, testInfo) => {
    await areaMastersPage.open();
    await areaMastersPage.update(
      dataCreateAreaMaster.name,
      DataUpdateAreaMaster,
    );
    await attachScreenshot(page, testInfo, "Area Masters - setelah Update");
  });
  test("Delete", async ({ areaMastersPage, page }, testInfo) => {
    await areaMastersPage.open();
    await areaMastersPage.delete([DataUpdateAreaMaster.name]);
    await attachScreenshot(page, testInfo, "Area Masters - setelah Delete");
  });
});
