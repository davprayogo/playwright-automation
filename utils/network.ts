import type { Page, Route } from "@playwright/test";

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

/**
 * Simulate a server error: API calls (fetch/xhr) whose URL matches `url` and whose
 * method is in `methods` get an HTTP `status` reply. Page loads (document requests)
 * and other calls pass through, so the menu page itself still opens.
 * Returns a function that stops the simulation.
 *
 * Example: failApi(page, /production-?line/i, ["POST"])  // Create fails
 */
export async function failApi(
  page: Page,
  url: RegExp,
  methods: Method[],
  status = 500,
): Promise<() => Promise<void>> {
  const handler = async (route: Route) => {
    const request = route.request();
    const isApi = ["fetch", "xhr"].includes(request.resourceType());
    if (isApi && methods.includes(request.method() as Method)) {
      await route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify({ message: "Simulated server error (automation)" }),
      });
      return;
    }
    await route.fallback();
  };
  await page.route(url, handler);
  return () => page.unroute(url, handler);
}
