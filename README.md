# Lumina Playwright Automation

E2E automation (Playwright + TypeScript) untuk menu Lumina (MOM/WMS), dibangun dari **Section 9 feature FSD** dan dijalankan oleh **TCMS** lewat Jenkins (FSD ZSN_ETCMS001).

Aturan lengkap: [`docs/AUTOMATION_RULES.md`](docs/AUTOMATION_RULES.md) (Page Object, locator, assertion, evidence) dan [`docs/AUTOMATION_RULES_TCMS.md`](docs/AUTOMATION_RULES_TCMS.md) (data set, tag TC, fase, reporter). README ini hanya peta project dan cara menjalankan.

> **Status migrasi (24 Nov 2026):** struktur di bawah adalah struktur **target**. File di repo masih di lokasi lama sampai migrasi selesai. Lihat [Migrasi dari struktur lama](#migrasi-dari-struktur-lama).

## Struktur folder

Prinsip: **satu menu = satu folder** di `src/menus/`. Page Object, tipe data, dan adapter TCMS sebuah menu ada di folder yang sama. Kode bersama ada di `src/core/`, integrasi TCMS di `src/tcms/` (tidak tahu menu apa pun), dokumen di `docs/`.

```
automations/
├── docs/                                  # semua dokumen, terpisah dari kode
│   ├── AUTOMATION_RULES.md
│   ├── AUTOMATION_RULES_TCMS.md
│   └── plan/                              # FSD TCMS, gap review
├── src/
│   ├── core/                              # dipakai semua menu
│   │   ├── BasePage.ts                    # aksi & assertion umum Lumina
│   │   ├── constants.ts                   # STD_MESSAGES, STD_DIALOGS, deleteConfirmMessage, ...
│   │   └── table-helper.ts                # klik / centang baris berdasarkan nilai kolom
│   ├── tcms/                              # integrasi TCMS (FSD ZSN_ETCMS001 Section 8.9)
│   │   ├── fixtures.ts                    # `test` + fixture `data` (setup / test / cleanup, mode delete|keep|prepare)
│   │   ├── dataProvider.ts                # data.get("DS-..."), created, deactivate, remove, cleanup by record no
│   │   ├── RecordPage.ts                  # buka / hapus / nonaktifkan record by nomor record (menu apa pun)
│   │   ├── registry.ts                    # daftar adapter menu: 1 baris per menu
│   │   ├── runSetup.ts                    # tipe & loader run-setup.json (RUN_SETUP_FILE)
│   │   ├── reporter.ts                    # custom reporter -> results.json untuk TCMS
│   │   └── errors.ts                      # SetupError / requireData -> hasil Blocked
│   ├── utils/
│   │   ├── screenshot.ts                  # attachScreenshot(): evidence di akhir setiap test
│   │   └── network.ts                     # failApi(): simulasi server error
│   └── menus/                             # 1 folder = 1 menu
│       ├── area-masters/
│       │   ├── AreaMastersPage.ts         # Page Object, extend BasePage
│       │   ├── area-master.data.ts        # tipe data input (FSD 7.5.2)
│       │   └── area-master.tcms.ts        # adapter TCMS: label Section 9.1 -> field, create
│       ├── storage-locations/
│       │   ├── StorageLocationsPage.ts
│       │   ├── storage-location.data.ts
│       │   └── storage-location.tcms.ts
│       ├── process-masters/
│       │   ├── ProcessMastersPage.ts
│       │   ├── process-master.data.ts
│       │   └── process-master.tcms.ts
│       └── production-line-masters/
│           ├── ProductionLineMastersPage.ts
│           ├── production-line-master.data.ts
│           └── production-line-master.tcms.ts
├── tests/                                 # 1 menu = 1 spec (rules 1.1), datar
│   ├── area-masters.spec.ts
│   └── production-line-masters.spec.ts    # format TCMS (data.get, @TC-MOM99-xxx)
├── test-data/
│   └── run-setup/
│       └── mom99.sample.json              # contoh run setup manual (sementara, sampai API TCMS ada)
├── README.md
├── playwright.config.ts
├── tsconfig.json
└── package.json
```

### Isi per folder menu

| File | Isi | Aturan |
|---|---|---|
| `{MenuName}Page.ts` | Page Object: `readonly path`, locator `{prefix}-{field}-input`, `DETAIL_TITLE_FIELD`, `DETAIL_LABELS`, alur create/update/delete, wrapper assertion | Rules 1–10 |
| `{menu}.data.ts` | `interface` data input; Required = Yes → wajib, No → `?` | Rules 3 |
| `{menu}.tcms.ts` | `export const adapter: MenuAdapter`: `menu` (persis kolom Menu Section 9.1), `path`, `titleLabel`, `detailLabels`, `listKeyFields`, mapping label → field, `create` | TCMS 13.7 |

Nama folder = nama menu kebab-case, sama dengan nama file spec di `tests/`. Contoh: menu *Production Line Masters* → `src/menus/production-line-masters/` dan `tests/production-line-masters.spec.ts`.

### Alias import (`tsconfig.json`)

```json
"paths": {
  "@core/*":  ["src/core/*"],
  "@tcms/*":  ["src/tcms/*"],
  "@menus/*": ["src/menus/*"],
  "@utils/*": ["src/utils/*"]
}
```

```typescript
import { BasePage } from "@core/BasePage";
import { STD_MESSAGES, deleteConfirmMessage } from "@core/constants";
import { ProductionLineMastersPage } from "@menus/production-line-masters/ProductionLineMastersPage";
import type { ProductionLineMaster } from "@menus/production-line-masters/production-line-master.data";
import { test } from "@tcms/fixtures";
import { attachScreenshot } from "@utils/screenshot";
```

Selalu import lewat alias, bukan path relatif (`../../`), agar memindahkan file tidak merusak import lain.

### Konvensi utama

| Hal | Aturan | Rules |
|---|---|---|
| Page Object | `src/menus/{menu}/{MenuName}Page.ts`, extend `BasePage`, `readonly path` = route aktual (kebab-case) | 1, 2, 5 |
| Kode bersama | Function yang dipakai >1 menu pindah ke `src/core/BasePage.ts`; konstanta pesan ke `src/core/constants.ts` | 5 |
| Spec | `tests/{menu}.spec.ts`, **satu file per menu**, positive + negative bercampur, urut FSD Section 9 lalu TC ID. Tidak ada folder/file per tipe test | 1.1 |
| Locator | `getByTestId` (`testIdAttribute: "id"`), input `{prefix}-{field}-input` | 4 |
| Field | Hanya dari FSD Section 7.5; beda dengan UI dicatat sebagai temuan | 3 |
| Evidence | Baris terakhir setiap test: `attachScreenshot(page, testInfo, "{Menu} - {TC ID} ...")` | 11 |
| Data (spec TCMS) | Hanya `data.get("DS-...")`; tanpa `uid()` / `Date.now()` | TCMS 13.3 |
| `src/tcms/` | Tidak boleh import dari `src/menus/` kecuali `registry.ts` | — |

## Tag

| Tag | Arti | Contoh |
|---|---|---|
| `@positive` / `@negative` | Kolom Type di FSD Section 9 | `--grep @negative` |
| `@TC-{JIRA}-{nnn}` | ID test case; TCMS menjalankan test berdasarkan tag ini | `--grep "@TC-MOM99-007\|@TC-MOM99-017"` |
| annotation `tc-version` | Versi test case asal script (status Automated / Script outdated di TCMS) | `{ type: "tc-version", description: "1" }` |

Tidak ada tag `@crud` / `@sanity` / `@seed`. Pemilihan test memakai tag di atas, bukan folder.

## Mulai

```bash
npm install
npx playwright install chromium
cp .env.example .env      # isi BASE_URL dan kredensial user test Lumina (QA / UAT)
```

Login: `playwright.config.ts` memakai `storageState` (login sekali di setup project), spec tidak login sendiri.

## Menjalankan

```bash
# Spec lama (data dibuat sendiri oleh test)
npx playwright test tests/area-masters.spec.ts
npx playwright test tests/area-masters.spec.ts --grep @negative

# Spec TCMS (data dari run setup). Ganti unique code di file sample dulu,
# atau pastikan run sebelumnya sudah cleanup.
RUN_SETUP_FILE=test-data/run-setup/mom99.sample.json \
  npx playwright test tests/production-line-masters.spec.ts --grep "@TC-MOM99-007"

# Lain-lain
npx playwright test --headed
npx playwright test --ui
npx playwright codegen <BASE_URL>    # cari locator; tetap ikuti aturan locator di rules Section 4
```

| Variabel env | Fungsi |
|---|---|
| `BASE_URL` | URL Lumina QA / UAT. Production tidak boleh dipakai (TCMS Section 5.3) |
| `RUN_SETUP_FILE` | File run setup TCMS. Wajib untuk spec TCMS |
| `TCMS_RUN_ID` | Nomor run TCMS (dari Jenkins), ditulis ke `results.json` |
| `BUILD_URL` | Dari Jenkins; reporter mengubah path evidence menjadi alamat artifact |

## Laporan

- HTML: `npx playwright show-report`, berisi screenshot evidence, trace, video.
- `results.json` (dari `src/tcms/reporter.ts`): hasil per test case (pass / fail / blocked / skipped / prepared / setup_failed), status setup–test–cleanup, data snapshot, log, alamat evidence. Dikirim Jenkins ke TCMS.

`playwright.config.ts` minimal:

```typescript
testDir: "./tests",
use: {
  baseURL: process.env.BASE_URL,
  testIdAttribute: "id",
  storageState: "<file sesi login>",
  screenshot: "only-on-failure",
  trace: "on",
  video: "on",
},
retries: process.env.RUN_SETUP_FILE ? 0 : undefined, // retry membuat dummy yang sama lagi
reporter: [["html"], ["./src/tcms/reporter.ts", { outputFile: "results.json" }]],
```

## Menambah menu baru

1. **Folder menu:** buat `src/menus/{menu}/`.
2. **Page Object:** `{MenuName}Page.ts`, extend `BasePage`. Cek `src/core/BasePage.ts` dulu sebelum menulis function baru; function yang dipakai >1 menu dipindah ke `BasePage` (rules Section 5).
3. **Tipe data:** `{menu}.data.ts`, field dan Required dari FSD Section 7.5.2.
4. **Adapter TCMS** (jika menu ini dipakai sebagai data set di Section 9.1 FSD mana pun): `{menu}.tcms.ts`, lalu tambahkan **1 baris** di `src/tcms/registry.ts`. Tanpa adapter, test yang butuh data set dari menu ini berakhir **Blocked** dengan note nama menunya.
5. **Spec:** `tests/{menu}.spec.ts`, satu file, header komentar berisi TC automated / partial / tidak diotomasi + alasan. Jika feature FSD sudah format Section 9.1 / 9.2: import `test` dari `@tcms/fixtures`, tulis tag `@TC-...` dan annotation `tc-version` literal di setiap test.
6. Jalankan checklist rules Section 12 dan TCMS 13.8 sebelum commit.

Menghapus menu: hapus folder `src/menus/{menu}/`, spec-nya, dan barisnya di `registry.ts`.

## Penulisan test (TCMS)

```typescript
import { test } from "@tcms/fixtures";
import { toProductionLine } from "@menus/production-line-masters/production-line-master.tcms";
import { attachScreenshot } from "@utils/screenshot";

test("TC-MOM99-007 Create a line with all fields",
  { tag: ["@positive", "@TC-MOM99-007"], annotation: { type: "tc-version", description: "1" } },
  async ({ page, data }, testInfo) => {
    const line = toProductionLine(data.get("DS-MOM99-29").values);
    await plPage.open();
    await plPage.create(line);
    await data.created("DS-MOM99-29");      // cleanup akan menghapusnya by record number
    // ... assertion
    await attachScreenshot(page, testInfo, "Production Line Masters - TC-MOM99-007 Detail view setelah Create");
  });
```

Seeding data untuk test manual **tidak** dibuat sebagai spec terpisah: pakai mode TCMS **Prepare data only** (Setup data set dibuat dan disimpan) atau **Run and keep data**.

## CI/CD (Jenkins, dipicu TCMS)

TCMS memulai build dengan parameter `TCMS_RUN_ID` saja (FSD ZSN_ETCMS001 Section 8.5). Langkah job:

1. `GET {TCMS_URL}/api/runs/{TCMS_RUN_ID}/setup` → `run-setup.json`.
2. Set `BASE_URL` dan user test Lumina dari Jenkins credentials sesuai environment di setup.
3. `RUN_SETUP_FILE=run-setup.json npx playwright test --grep "@TC-...|@TC-..."` (tag dari TC yang dicentang).
4. `archiveArtifacts`: `test-results/**`, `playwright-report/**`.
5. `post { always { ... } }`: `POST {TCMS_URL}/api/runs/{TCMS_RUN_ID}/results` dengan isi `results.json` (atau `{"buildError": "..."}` jika file tidak ada). Retry 3x, jeda 1 menit, jika TCMS tidak menjawab / 5xx.

Secret (token Git, Jenkins, TCMS, password user Lumina) hanya di credential store Jenkins / server TCMS, tidak di repo atau `.env` yang di-commit.

## Login SSO (jika dipakai)

```typescript
test.beforeEach(async ({ page }) => {
  const session = new SessionPage(page);
  await page.goto("/");
  await session.selectServer(server);            // server: dari env, mis. process.env.LUMINA_SERVER
  await session.selectModulebyText("WMS");
  await page.waitForURL(/\/wms\//, { timeout: 30_000 });
});
```

Lebih baik jalankan langkah ini **sekali** di setup project login lalu simpan ke `storageState`, bukan di `beforeEach` setiap spec: login per test memperlambat run dan menambah titik gagal yang bukan bagian menu yang diuji. `SessionPage` ditaruh di `src/core/`.

## Migrasi dari struktur lama

| Lama | Baru |
|---|---|
| `AUTOMATION_RULES.md`, `AUTOMATION_RULES_TCMS.md`, `plan/` | `docs/` |
| `BasePage.ts` | `src/core/BasePage.ts` (konstanta dipecah ke `src/core/constants.ts`) |
| `utils/table-helper.ts` | `src/core/table-helper.ts` |
| `utils/screenshot.ts`, `utils/network.ts` | `src/utils/` |
| `AreaMastersPage.ts` + `data/wms/areaMaster.ts` | `src/menus/area-masters/AreaMastersPage.ts` + `area-master.data.ts` |
| `StorageLocationsPage.ts` + `data/wms/storageLocation.ts` | `src/menus/storage-locations/` |
| `ProcessMastersPage.ts` + `data/wms/processMaster.ts` | `src/menus/process-masters/` |
| `ProductionLineMastersPage.ts` + `data/wms/productionLineMaster.ts` | `src/menus/production-line-masters/` |
| `tcms/menus.ts` (semua menu dalam 1 file) | `src/tcms/RecordPage.ts` + `src/tcms/registry.ts` + `{menu}.tcms.ts` per folder menu |
| `tcms/*.ts` lainnya | `src/tcms/` |
| `tcms/samples/run-setup.mom99.sample.json` | `test-data/run-setup/mom99.sample.json` |
| `tests/fixtures/productionLineRefs.ts` | Dihapus (diganti provider TCMS); cek dulu tidak ada spec lain yang memakainya |
| Import `@data/wms/*`, `../BasePage` | Alias `@core/*`, `@tcms/*`, `@menus/*`, `@utils/*` |

Yang ikut diperbarui saat migrasi: import di semua file, contoh path di `docs/AUTOMATION_RULES.md` (Section 1 dan 5) dan `docs/AUTOMATION_RULES_TCMS.md` (13.1, 13.6, 13.7), serta referensi `automations/AUTOMATION_RULES.md` di FSD ZSN_ETCMS001 Section 2. Isi kode tidak berubah, hanya lokasi dan import.