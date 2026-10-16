import { test as setup } from "@playwright/test";
import { LoginPage } from "@pages/LoginPage";

const authFile = ".auth/user.json";

/**
 * Login satu kali dengan Operator Login Key, simpan sesi ke .auth/user.json.
 * Semua test lain memakai sesi ini (lihat playwright.config.ts).
 */
setup("login", async ({ page }) => {
  // const loginKey = process.env.OPERATOR_LOGIN_KEY;
  // if (!loginKey) {
  //   throw new Error("OPERATOR_LOGIN_KEY wajib diisi di file .env");
  // }

  const loginPage = new LoginPage(page);
  // await loginPage.loginWithSSO("badge", "passw0rd");
  await loginPage.loginWithOperatorKey("d368d434134c45738ef2e86bfcee9dd7");
  await loginPage.expectLoggedIn();

  await page.context().storageState({ path: authFile });
});
