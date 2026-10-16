import { expect } from "@playwright/test";
import { BasePage } from "./BasePage";
import { SessionPage } from "./SessionPage";

/**
 * Login dengan Operator Login Key (QR Code number diisi manual).
 * Padanan dari keyword Katalon `loginWithOperatorLoginKey`:
 *
 *   openBrowser(url)                         -> page.goto('/')
 *   click button_login_with_operator_login_key -> loginWithKeyButton
 *   click button_Enter QR Code number manually -> enterManuallyButton
 *   setText input_QR Code Number loginKey      -> keyInput
 *   click span_Login                           -> submitButton
 *
 * TODO: locator di bawah adalah tebakan dari nama Test Object Katalon.
 * Cara paling cepat menyamakannya: buka Test Object di Katalon, lihat
 * Selector (CSS/XPath), lalu pakai di sini, contohnya:
 *   this.page.locator('xpath=//button[@id="..."]')
 *   this.page.locator('#loginKey')
 */
export class LoginPage extends BasePage {
  private loginWithKeyButton = () => this.page.getByTestId("btn-login-qr-scan");
  private loginWithSSOButton = () => this.page.getByTestId("btn-continue-sso");
  private usernameInput = () => this.page.getByTestId("username");
  private passwordInput = () => this.page.getByTestId("password");
  private signInButton = () => this.page.getByTestId("kc-login");

  private enterManuallyButton = () =>
    this.page.getByTestId("btn-login-qr-manual");

  private keyInput = () => this.page.getByTestId("btn-login-qr-key-input");

  // Di Katalon objeknya berupa <span>, jadi tidak selalu berrole "button".
  private submitButton = () =>
    this.page
      .getByRole("button", { name: /^login$/i })
      .or(this.page.getByTestId("btn-login-qr-submit"));

  async loginWithOperatorKey(loginKey: string) {
    await this.goto("/");

    await this.loginWithKeyButton().click();
    await this.enterManuallyButton().click();
    await this.keyInput().fill(loginKey);
    await this.submitButton().first().click();
  }

  async loginWithSSO(userName: string, password: string) {
    await this.goto("/");

    await this.loginWithSSOButton().click();
    await this.usernameInput().fill(userName);
    await this.passwordInput().fill(password);
    await this.signInButton().click();

    const sessionDialog = this.dialog().filter({
      hasText: "Sign In and End Other Session",
    });
    const welcome = this.page
      .getByRole("heading")
      .filter({ hasText: "Welcome" })
      .first();

    // Tunggu salah satu muncul: dialog sesi aktif ATAU halaman Welcome
    await sessionDialog
      .or(welcome)
      .first()
      .waitFor({ state: "visible", timeout: 15_000 })
      .catch(() => {}); // jika keduanya tidak muncul, lanjut

    // 1) Dialog muncul saja -> klik konfirmasi
    if (await sessionDialog.isVisible()) {
      await this.confirmDialog("Sign In and End Other Session");
      // setelah konfirmasi, tunggu halaman Welcome
      await welcome
        .waitFor({ state: "visible", timeout: 15_000 })
        .catch(() => {});
    }

    // 2) Welcome tampil saja -> pilih server
    if (await welcome.isVisible()) {
      await new SessionPage(this.page).selectServer(
        process.env.SERVER_NAME ?? "dev1",
      );
    }
  }

  /** Tombol pilihan login hilang jika login berhasil. */
  async expectLoggedIn() {
    await this.page.waitForLoadState("networkidle");
    await expect(this.loginWithKeyButton()).toBeHidden();
  }
}
