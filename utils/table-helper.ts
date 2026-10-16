import { Locator, expect, TestInfo, Page } from "@playwright/test";

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const exactText = (s: string) => new RegExp(`^\\s*${escapeRegExp(s)}\\s*$`);

/** Padanan helper.TableHelper.clickRandomRow di Katalon. */
export async function clickRandomRow(rows: Locator, testInfo?: TestInfo) {
  // Tunggu baris muncul, jika tidak ada test gagal dengan pesan ini
  await expect(
    rows.first(),
    "Tidak ada baris data yang bisa diklik di List View ini.",
  ).toBeVisible({ timeout: 15_000 });

  const total = await rows.count();
  const index = Math.floor(Math.random() * total);

  console.log(
    `Ditemukan ${total} baris data. Memilih baris ke-${index + 1} secara acak.`,
  );
  // Tampil di laporan HTML/Allure, supaya kegagalan di baris tertentu bisa direproduksi
  testInfo?.annotations.push({
    type: "random-row",
    description: `baris ke-${index + 1} dari ${total}`,
  });

  await rows.nth(index).click();
}

/** Index kolom (mulai dari 1) berdasarkan teks tombol di header. */
export async function getColumnIndex(
  page: Page,
  columnName: string,
): Promise<number> {
  const header = page
    .locator("th", {
      has: page.locator("button", { hasText: exactText(columnName) }),
    })
    .first();
  await expect(
    header,
    `Kolom '${columnName}' tidak ditemukan di header tabel.`,
  ).toBeVisible();
  return header.evaluate(
    (th) => Array.from(th.parentElement!.children).indexOf(th) + 1,
  );
}

/** Semua baris yang kolom ke-`columnIndex`-nya bernilai persis `value`. */
export function rowsByColumnValue(
  page: Page,
  columnIndex: number,
  value: string,
): Locator {
  return page.locator("tbody tr").filter({
    has: page.locator(`td:nth-child(${columnIndex})`, {
      hasText: exactText(value),
    }),
  });
}

/** Klik Next jika ada dan aktif, lalu tunggu isi tabel berganti. false jika tidak ada. */
export async function goToNextPage(page: Page): Promise<boolean> {
  const nextButton = page
    .locator("button:not([disabled])")
    .filter({ hasText: /next/i })
    .or(page.locator('button[aria-label="Next page"]:not([disabled])'))
    .first();
  if (!(await nextButton.isVisible())) return false;

  const firstRowBefore = await page.locator("tbody tr").first().innerText();
  await nextButton.click();
  await expect(page.locator("tbody tr").first()).not.toHaveText(firstRowBefore);
  return true;
}

async function checkRow(checkbox: Locator) {
  try {
    await checkbox.check({ timeout: 3000 });
  } catch {
    // Padanan JS click di Katalon, untuk checkbox kustom yang <input>-nya tersembunyi
    if (!(await checkbox.isChecked())) {
      await checkbox.evaluate((el) => (el as HTMLInputElement).click());
    }
  }
  await expect(checkbox).toBeChecked();
}

/**
 * Padanan helper.selectMultipleCheckboxByColumnWithPagination di Katalon.
 * Centang checkbox pada baris yang kolom `columnName`-nya sama dengan salah satu `values`,
 * telusuri halaman berikutnya sampai semua nilai ditemukan.
 */
export async function selectCheckboxesByColumnValues(
  page: Page,
  columnName: string,
  values: string[],
  maxPages = 50,
) {
  const remaining = new Set(values);
  const columnIndex = await getColumnIndex(page, columnName); // header sama di semua halaman

  for (let p = 1; p <= maxPages && remaining.size > 0; p++) {
    console.log(`Checking page ke-${p}`);

    // Tunggu data asli (baris yang punya checkbox), bukan skeleton
    await page
      .locator('tbody tr input[type="checkbox"]')
      .first()
      .waitFor({ state: "attached", timeout: 15_000 })
      .catch(() => {});

    for (const value of [...remaining]) {
      const checkboxes = rowsByColumnValue(page, columnIndex, value).locator(
        'input[type="checkbox"]',
      );
      const count = await checkboxes.count();
      if (count === 0) continue;

      for (let i = 0; i < count; i++) {
        await checkRow(checkboxes.nth(i)); // semua baris yang cocok di halaman ini
      }
      console.log(`Found & selected value: ${value}`);
      remaining.delete(value);
    }

    if (remaining.size === 0) {
      console.log("Semua value sudah ditemukan");
      break;
    }
    if (!(await goToNextPage(page))) break;
  }

  if (remaining.size > 0) {
    throw new Error(
      `Tidak semua value ditemukan. Missing: ${[...remaining].join(", ")}`,
    );
  }
}

/**
 * Padanan helper.ClickDetailByColumnAndValueWithPagination di Katalon.
 * Cari baris yang kolom `columnName`-nya bernilai persis `value`,
 * telusuri halaman berikutnya jika perlu, lalu klik baris itu.
 */
export async function clickRowByColumnValue(
  page: Page,
  columnName: string,
  value: string,
  maxPages = 50,
) {
  // 1) Index kolom dari header (mulai dari 1, sama seperti XPath td[n])
  const header = page
    .locator("th", {
      has: page.locator("button", { hasText: exactText(columnName) }),
    })
    .first();
  await expect(
    header,
    `Kolom '${columnName}' tidak ditemukan di header tabel.`,
  ).toBeVisible();
  const columnIndex = await header.evaluate(
    (th) => Array.from(th.parentElement!.children).indexOf(th) + 1,
  );

  // 2) Baris dengan nilai persis di kolom tersebut
  const row = page.locator("tbody tr").filter({
    has: page.locator(`td:nth-child(${columnIndex})`, {
      hasText: exactText(value),
    }),
  });
  const clickableRows = page.locator('tbody > tr[class*="cursor-pointer"]');
  const nextButton = page
    .locator("button:not([disabled])")
    .filter({ hasText: /next/i })
    .or(page.locator('button[aria-label="Next page"]:not([disabled])'))
    .first();

  for (let p = 1; p <= maxPages; p++) {
    console.log(`Checking page ke-${p}`);

    // Tunggu data asli muncul (bukan skeleton) sebelum mencari
    await clickableRows
      .first()
      .waitFor({ state: "visible", timeout: 15_000 })
      .catch(() => {});

    if ((await row.count()) > 0) {
      await row.first().click();
      console.log(`Data ditemukan di page ke-${p}, baris diklik.`);
      return;
    }

    // 3) Halaman berikutnya
    if (!(await nextButton.isVisible())) break;

    const firstRowBefore = await page.locator("tbody tr").first().innerText();
    await nextButton.click();
    // Pengganti delay(1): tunggu sampai isi tabel benar-benar berganti
    await expect(page.locator("tbody tr").first()).not.toHaveText(
      firstRowBefore,
    );
  }

  throw new Error(
    `Data '${value}' pada kolom '${columnName}' tidak ditemukan.`,
  );
}
