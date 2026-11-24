/**
 * Lumina menus the data-set provider can set up. One line per menu: the adapter lives in
 * the menu folder (`src/menus/{menu}/{menu}.tcms.ts`). This is the only file in src/tcms that
 * imports from src/menus.
 *
 * A data set whose menu is not listed here ends the test case as Blocked, with a note
 * naming the menu.
 */
import type { MenuAdapter } from "./adapter";
import { SetupError } from "./errors";
import { adapter as areaMasters } from "@menus/area-masters/area-master.tcms";
import { adapter as storageLocations } from "@menus/storage-locations/storage-location.tcms";
import { adapter as processMasters } from "@menus/process-masters/process-master.tcms";
import { adapter as productionLineMasters } from "@menus/production-line/production-line-master.tcms";

const ADAPTERS: readonly MenuAdapter[] = [
  areaMasters,
  storageLocations,
  processMasters,
  productionLineMasters,
];

export function menuAdapter(menu: string): MenuAdapter {
  const adapter = ADAPTERS.find((a) => a.menu === menu);
  if (!adapter) {
    throw new SetupError(
      `Menu "${menu}" has no Page Object for data setup yet. Supported: ${ADAPTERS.map((a) => a.menu).join(", ")}.`,
    );
  }
  return adapter;
}
