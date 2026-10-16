import { test } from "@fixtures/test-fixtures";
// import { SessionPage } from "@pages/SessionPage";
import { attachScreenshot } from "@utils/screenshot";

const server = process.env.SERVER_NAME ?? "dev1";

/**
 * Regresi CUD lewat UI. Data dibuat unik, lalu dihapus di akhir
 * sehingga tidak meninggalkan sampah di environment.
 */
test.describe.serial("@crud Rack Masters", () => {
  const dataCreateRackMaster = {
    name: "RACK-Create-01",
    storageLocation: "LOC-STR-BLK1",
  };
  const DataUpdateRackMaster = {
    name: "RACK-Update-01",
    storageLocation: "LOC-STR-BLK1",
  };
  // test.beforeEach(async ({ page }) => {
  //   const session = new SessionPage(page);
  //   await page.goto("/");
  //   await session.selectServer(server);
  //   await session.selectModulebyText("WMS");
  //   await page.waitForURL(new RegExp(`/wms/`), { timeout: 30_000 });
  // });
  test("Create", async ({ rackMastersPage, page }, testInfo) => {
    await rackMastersPage.open();
    await rackMastersPage.create(dataCreateRackMaster);
    await attachScreenshot(page, testInfo, "Rack Masters - setelah Create");
  });
  test("Update", async ({ rackMastersPage, page }, testInfo) => {
    await rackMastersPage.open();
    await rackMastersPage.update(
      dataCreateRackMaster.name,
      DataUpdateRackMaster,
    );
    await attachScreenshot(page, testInfo, "Rack Masters - setelah Update");
  });
  test("Delete", async ({ rackMastersPage, page }, testInfo) => {
    await rackMastersPage.open();
    await rackMastersPage.delete([DataUpdateRackMaster.name]);
    await attachScreenshot(page, testInfo, "Rack Masters - setelah Delete");
  });
});
