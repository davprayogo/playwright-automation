import { test as base } from "@playwright/test";
import { AreaMastersPage } from "@pages/AreaMastersPage";
import { StorageLocationsPage } from "@pages/StorageLocationsPage";
import { RackMastersPage } from "@pages/RackMastersPage";

type Fixtures = {
  areaMastersPage: AreaMastersPage;
  storageLocationsPage: StorageLocationsPage;
  rackMastersPage: RackMastersPage;
};

/**
 * Fixture: setiap test tinggal menulis `async ({ customerPage }) => ...`.
 * Tambahkan Page Object modul lain di sini.
 */
export const test = base.extend<Fixtures>({
  areaMastersPage: async ({ page }, use) => {
    await use(new AreaMastersPage(page));
  },
  storageLocationsPage: async ({ page }, use) => {
    await use(new StorageLocationsPage(page));
  },
  rackMastersPage: async ({ page }, use) => {
    await use(new RackMastersPage(page));
  },
});

export { expect } from "@playwright/test";
