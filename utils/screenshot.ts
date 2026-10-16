import { Page, TestInfo } from "@playwright/test";

/** Padanan WebUI.takeFullPageScreenshot(): dilampirkan ke laporan test. */
export async function attachScreenshot(
  page: Page,
  testInfo: TestInfo,
  name: string,
  fullPage = true,
) {
  await page.waitForTimeout(2000);
  await testInfo.attach(name, {
    body: await page.screenshot({ fullPage }),
    contentType: "image/png",
  });
}
