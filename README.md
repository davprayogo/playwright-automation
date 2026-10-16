# Playwright Automation

E2E automation (TypeScript) untuk: **sanity** menu, **regresi CRUD** lewat UI, dan **seeding** master data.

## Struktur folder

```
playwright-automation/
├── .github/workflows/playwright.yml   # CI/CD, bisa di-trigger via API
├── data/
│   └── menus.ts                       # daftar menu untuk sanity test
├── fixtures/
│   └── test-fixtures.ts               # fixture Page Object
├── pages/                             # Page Object Model
│   ├── BasePage.ts
│   ├── LoginPage.ts
│   └── CustomerPage.ts                # contoh modul CRUD
├── tests/
│   ├── auth.setup.ts                  # login sekali, simpan sesi
│   ├── sanity/menu.sanity.spec.ts     # @sanity
│   ├── crud/customer.crud.spec.ts     # @crud
│   └── seed/customer.seed.spec.ts     # @seed
├── utils/
│   └── data-generator.ts              # nama/email unik
├── .env.example
├── playwright.config.ts
├── tsconfig.json
└── package.json
```

## Mulai

```bash
npm install
npx playwright install chromium
cp .env.example .env      # lalu isi BASE_URL, APP_USERNAME, APP_PASSWORD
```

## Menjalankan

| Perintah                                         | Fungsi                         |
| ------------------------------------------------ | ------------------------------ |
| `npm test`                                       | Semua test                     |
| `npm run test:sanity`                            | Sanity menu dan detail         |
| `npm run test:crud`                              | Regresi Create, Update, Delete |
| `npm run test:seed`                              | Seeding data (tanpa delete)    |
| `npm run test:headed`                            | Jalan dengan browser terlihat  |
| `npm run test:ui`                                | Mode UI interaktif             |
| `npm run codegen -- https://staging.example.com` | Rekam aksi jadi kode           |

## Laporan

- HTML bawaan: `npm run report:html`
- Allure: `npm run report:allure` (butuh Java terpasang)
- JSON: `results.json` (untuk dikirim ke aplikasi test management)

## Menambah modul baru

1. Salin `pages/CustomerPage.ts` menjadi `pages/XxxPage.ts`, sesuaikan path dan locator.
2. Daftarkan di `fixtures/test-fixtures.ts`.
3. Salin `tests/crud/customer.crud.spec.ts` dan `tests/seed/customer.seed.spec.ts`.
4. Tambahkan menu ke `data/menus.ts` agar ikut sanity.

## Yang HARUS disesuaikan

Semua locator di project ini adalah **contoh** (label "Tambah", "Simpan", "Edit", "Hapus", `getByTestId('detail-page')`, halaman `/login`, dll). Ubah sesuai aplikasi Anda sebelum dijalankan. Gunakan `npm run codegen` untuk menemukan locator yang tepat.

## CI/CD

Workflow `playwright.yml` menerima input `tag`, `base_url`, dan `run_id`. Secrets yang dibutuhkan di repo:
`APP_USERNAME`, `APP_PASSWORD`, dan opsional `TM_WEBHOOK_URL`, `TM_TOKEN` (untuk mengirim hasil ke aplikasi test management).

Contoh trigger via API:

```bash
curl -X POST \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Accept: application/vnd.github+json" \
  https://api.github.com/repos/<owner>/<repo>/actions/workflows/playwright.yml/dispatches \
  -d '{"ref":"main","inputs":{"tag":"@crud","base_url":"https://staging.app.com","run_id":"123"}}'
```

Sesuaikan versi image Docker di workflow dengan versi `@playwright/test` yang terpasang.

Gunakan dibawah ini jika login menggunakan SSO

```javascript
test.beforeEach(async ({ page }) => {
  const session = new SessionPage(page);
  await page.goto("/");
  await session.selectServer(server);
  await session.selectModulebyText("WMS");
  await page.waitForURL(new RegExp(`/wms/`), { timeout: 30_000 });
});
```
