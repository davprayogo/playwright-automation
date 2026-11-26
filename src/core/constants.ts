/**
 * Standard Lumina texts and values used by BasePage, the Page Objects and the specs.
 * Change a text here only: every check that uses it follows.
 */

/** Detail view shows an empty field as "-". */
export const DETAIL_EMPTY_DISPLAY = "-";

/** List view message when the menu has no data yet (empty state has no id). */
export const TABLE_EMPTY_TEXT = "No data. Please add it first.";

/** List view message when Quick Search / Filter finds nothing (no id). */
export const TABLE_NO_RESULT_TEXT =
  "No data found. Please try again with different search criteria.";

/**
 * List view Yes/No cells show an icon, not text: a check for true, a dash for false.
 * Values = aria-label of the icon (<span role="img" aria-label="...">, like "clipboard").
 * Confirm with FE: change only here.
 */
export const LIST_BOOLEAN_ICON = { true: "check", false: "minus" } as const;

/**
 * Custom Filter (MOM-0029 FR-60) condition that lists inactive records only
 * (the default list shows Active = Yes). Option texts as shown in the UI.
 */
export const CF_INACTIVE_ONLY = { field: "Active", operator: "=", value: "FALSE" } as const;

/** The Active column shows a badge with text instead of an icon. */
export const LIST_ACTIVE_COLUMN = "Active";
export const LIST_ACTIVE_BADGE = { true: "Active", false: "Inactive" } as const;

/**
 * MOM-0029 standard messages, used for generic checks instead of the feature
 * FSD wording (decision for MOM-99 Section 9; record the FSD mismatch).
 */
export const STD_MESSAGES = {
  /** FR-460, inline under the field. */
  required: "This field is required",
  /** FR-470, inline under the reference field. */
  inactiveRecord: "The selected record is inactive. Select another one",
  recordNotExist: "The selected record no longer exists. Select another one",
  /** Toast. Delete from the record page refused because other records use the record (confirmed in the UI). */
  deleteInUse:
    "This record cannot be deleted because it is already used by other records. If it is no longer needed, set it to inactive instead.",
  /**
   * Delete from the LIST refused because other records use one or more selected records
   * (MOM-99 rev. FR-160). Shown as a toast like deleteInUse: not confirmed in the UI yet.
   */
  deleteInUseList:
    "One or more selected records cannot be deleted because they are already used by other records. If they are no longer needed, set them to inactive instead.",
} as const;

/** FR-460, inline under a text field over its maximum length, e.g. "Maximum 50 characters (51 entered)". */
export function maxLengthMessage(max: number, entered: number): string {
  return `Maximum ${max} characters (${entered} entered)`;
}

/**
 * API answer for a text over its maximum length (MOM-99 rev. Section 8.3), e.g.
 * "The length of Code must be 50 characters or fewer. You entered 51 characters."
 * For API tests; the UI shows maxLengthMessage() under the field.
 */
export function apiMaxLengthMessage(field: string, max: number, entered: number): string {
  return `The length of ${field} must be ${max} characters or fewer. You entered ${entered} characters.`;
}

/**
 * Delete confirmation text (standard Lumina, list and detail view):
 *   1 record   : "Delete 1 Record?"
 *   2+ records : "Delete {qty} Records?"
 * Replaces the per-menu FSD texts ("Delete {N} production lines?", "Delete area {Name}?").
 */
export function deleteConfirmMessage(count: number): string {
  return count === 1 ? "Delete 1 Record?" : `Delete ${count} Records?`;
}

export const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Toast. Duplicate unique value(s) (MOM-0029 FR-480 text; shown as a toast in the UI,
 * not as the "Duplicate Record" modal). Fields in the configured unique order:
 *   1 field : Another record already has the same {Field}: {Value}. It may be inactive. Please use different values.
 *   2+      : Another record already has the same {Field 1}: {Value 1}, {Field 2}: {Value 2}. It may be inactive. ...
 * A value may be given as several accepted spellings (e.g. the typed "pl-01" and the
 * existing "PL-01") while it is not confirmed which one the message shows.
 * Returns an exact (anchored) pattern.
 */
export function duplicateRecordMessage(
  fields: ReadonlyArray<readonly [field: string, value: string | readonly string[]]>,
): RegExp {
  const pairs = fields.map(([field, value]) => {
    const values = (typeof value === "string" ? [value] : value).map((v) => escapeRegExp(v.trim()));
    return `${escapeRegExp(field)}: (?:${values.join("|")})`;
  });
  return new RegExp(
    `^Another record already has the same ${pairs.join(", ")}\\. It may be inactive\\. Please use different values\\.$`,
  );
}

/** MOM-0029 standard modals: title + fixed part of the text. */
export const STD_DIALOGS = {
  // FR-480 "Duplicate Record" is NOT a modal in the UI: it is a toast. Use duplicateRecordMessage().
  /** FR-490. The full text also names the user and the date time. */
  outdated: {
    title: "Data Outdated",
    text: [
      "after you opened it. Your changes have not been saved.",
      "Reload to continue editing with the latest data, or Discard to cancel your changes.",
    ],
  },
  /** FR-500. Also shown when a Delete from the list hits a record another user deleted (MOM-99 rev. FR-160). */
  deleted: {
    title: "Record Deleted",
    text: ["This record was deleted by another user after you opened it. Your changes have not been saved."],
  },
} as const;
