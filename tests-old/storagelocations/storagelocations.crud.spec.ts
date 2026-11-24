import { test } from "@fixtures/test-fixtures";
import { SessionPage } from "@pages/SessionPage";
import { attachScreenshot } from "@utils/screenshot";

const server = process.env.SERVER_NAME ?? "dev1";

test.describe.serial("@crud Storage Locations", () => {
  const dataCreateStorageLocation = {
    name: "Storage Location",
    description: "Create By playwright",
    areaMaster: "Main Storage",
  };
  const dataUpdateStorageLocation = {
    name: "Storage Location-MES",
    description: "Create By playwright",
    areaMaster: "Raw Material Warehouse",
    sapReference: "123456",
    sapStatus: "ACTIVE",
    remarks: "Create By playwright",
  };
  // test.beforeEach(async ({ page }) => {
  //   const session = new SessionPage(page);
  //   await page.goto("/");
  //   await session.selectServer(server);
  //   await session.selectModulebyText("WMS");
  //   await page.waitForURL(new RegExp(`/wms/`), { timeout: 30_000 });
  // });
  test("Create", async ({ storageLocationsPage, page }, testInfo) => {
    await storageLocationsPage.open();
    await storageLocationsPage.create(dataCreateStorageLocation);
    await attachScreenshot(page, testInfo, "Storage Locations - Create");
  });
  test("Update", async ({ storageLocationsPage, page }, testInfo) => {
    await storageLocationsPage.open();
    await storageLocationsPage.update(
      dataCreateStorageLocation.name,
      dataUpdateStorageLocation,
    );
    await attachScreenshot(page, testInfo, "Storage Locations - Update");
  });
  test("Delete", async ({ storageLocationsPage, page }, testInfo) => {
    await storageLocationsPage.open();
    await storageLocationsPage.delete([dataUpdateStorageLocation.name]);
    await attachScreenshot(page, testInfo, "Storage Locations - Delete");
  });
});
