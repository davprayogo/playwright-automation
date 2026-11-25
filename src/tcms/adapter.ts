/**
 * Contract between the TCMS data-set provider and a Lumina menu (FSD ZSN_ETCMS001 Section 8.9,
 * Field mapping). Each menu folder implements it in `src/menus/{menu}/{menu}.tcms.ts` and is
 * listed once in `src/tcms/registry.ts`.
 */
import type { Page } from "@playwright/test";
import { SetupError } from "./errors";
import type { FieldValues } from "./runSetup";

export interface MenuAdapter {
  /** Exactly the Menu column of Section 9.1, e.g. "Production Line Masters". */
  menu: string;
  /** Route of the menu (the Page Object's `path`). */
  path: string;
  /** Label of the field shown as the H6 title: the identity value `{DS-...}` points to. */
  titleLabel: string;
  /** Detail labels read for an existing record (data snapshot, FR-130 / FR-240). */
  detailLabels: readonly string[];
  /**
   * Identity key fields that are list columns. A key field that is not a column cannot be
   * matched in the list (Storage Locations: Factory, finding TCMS-F07).
   */
  listKeyFields: readonly string[];
  /** Create with exactly the given values. Ends on the detail view of the new record. */
  create(page: Page, values: FieldValues): Promise<void>;
}

/** One Section 9.1 label: the data field it fills, and how its text is read. */
export type FieldSpec<T> = { field: keyof T; kind?: "text" | "yesno" };

function parseYesNo(menu: string, label: string, value: string): boolean {
  const v = value.trim().toLowerCase();
  if (v === "yes") return true;
  if (v === "no") return false;
  throw new SetupError(`${menu}: ${label} must be Yes or No, got "${value}".`);
}

/**
 * Section 9.1 values -> Page Object data. An unknown label is a setup error, so a label
 * that changes in the FSD is found at once instead of being dropped. `keyOnly` labels are
 * allowed in values but not sent to the form (e.g. Factory of a storage location).
 */
export function toModel<T>(
  menu: string,
  values: FieldValues,
  map: Record<string, FieldSpec<T>>,
  keyOnly: readonly string[] = [],
): T {
  const out: Record<string, unknown> = {};
  for (const [label, value] of Object.entries(values)) {
    if (keyOnly.includes(label)) continue;
    const spec = map[label];
    if (!spec) {
      throw new SetupError(`${menu}: field "${label}" has no mapping. Known: ${Object.keys(map).join(", ")}.`);
    }
    out[spec.field as string] = spec.kind === "yesno" ? parseYesNo(menu, label, value) : value;
  }
  return out as T;
}