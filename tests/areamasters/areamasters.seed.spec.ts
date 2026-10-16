import { test } from "@fixtures/test-fixtures";
import { uniqueName, uniqueEmail } from "@utils/data-generator";
import { SessionPage } from "@pages/SessionPage";

/**
 * Seeding master data untuk manual testing.
 * Hanya Create, TIDAK ada Delete, supaya data tertinggal.
 * Jumlah diatur lewat SEED_COUNT di .env (default 10).
 *
 * Jalankan: npm run test:seed
 */
const count = Number(process.env.SEED_COUNT ?? 10);

test.describe("@seed AreaMasters", () => {
  for (let i = 1; i <= count; i++) {
    test(`@seed buat AreaMasters #${i}`, async ({ areaMastersPage, page }) => {
      await areaMastersPage.open();
      await areaMastersPage.create({
        name: uniqueName(`Area-${i}`),
        description: uniqueEmail(`seed${i}`),
      });
    });
  }
});
