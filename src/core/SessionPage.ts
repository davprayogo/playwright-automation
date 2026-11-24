import { BasePage } from "./BasePage";
import { ModuleDef } from "@data/modules";

export class SessionPage extends BasePage {
  // TODO: samakan dengan button_server_dev1, button_ContinueOrSubmitServer, btn_module_mes
  async selectServer(server: string) {
    await this.page.getByRole("button", { name: server, exact: true }).click();
    await this.page.getByRole("button", { name: /continue|submit/i }).click();
  }

  async selectModule(mod: ModuleDef) {
    await this.page.locator("a", { hasText: mod.buttonLabel }).click();
  }

  async selectModulebyText(ModuleName: string) {
    await this.page.locator("a", { hasText: ModuleName }).click();
  }
}
