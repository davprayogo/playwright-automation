import { expect, type Locator } from "@playwright/test";
import { BasePage, type DetailFieldMap } from "@core/BasePage";
import { deleteConfirmMessage } from "@core/constants";
import type {
  ProductionLineDerived,
  ProductionLineMaster,
} from "./production-line-master.data";

/**
 * Columns shown by default — FSD MOM-99 Section 7.5.1, List View (Checkbox excluded).
 * Revision: Production Line is shown, External Code is hidden by default.
 */
export const PLM_LIST_COLUMNS = [
  "Code",
  "Name",
  "Line No",
  "Storage Location",
  "Area",
  "Factory",
  "Floor",
  "Division",
  "Repair Storage Location",
  "Process Master",
  "Production Line",
  "Two Step Transfer",
  "Auto Transfer to Repair",
  "Active",
] as const;

/** Columns hidden by default (the user can show them). */
export const PLM_HIDDEN_COLUMNS = ["External Code"] as const;

export type PlmListColumn =
  | (typeof PLM_LIST_COLUMNS)[number]
  | (typeof PLM_HIDDEN_COLUMNS)[number];

/** Yes/No list columns: an icon (Production Line, Two Step Transfer, Auto Transfer to Repair) or the Active badge. */
type PlmBooleanColumn =
  | "Production Line"
  | "Two Step Transfer"
  | "Auto Transfer to Repair"
  | "Active";

/** Expected list cells: text columns take a string, Yes/No columns take a boolean. */
export type PlmListValues = Partial<
  Record<Exclude<PlmListColumn, PlmBooleanColumn>, string> &
    Record<PlmBooleanColumn, boolean>
>;

/** Toggle fields. Checked on the form (not text on the detail view). */
export type PlmToggles = Pick<
  ProductionLineMaster,
  "productionLine" | "twoStepTransfer" | "autoTransferToRepair"
>;

const TOGGLE_KEYS = [
  "productionLine",
  "twoStepTransfer",
  "autoTransferToRepair",
] as const satisfies readonly (keyof PlmToggles)[];

/** Text fields of the line (toggles excluded). */
type TextField = {
  [K in keyof ProductionLineMaster]-?: NonNullable<
    ProductionLineMaster[K]
  > extends string
    ? K
    : never;
}[keyof ProductionLineMaster];

/** What the detail view shows as text: the line's text fields + area data. */
export type ProductionLineDetail = Pick<ProductionLineMaster, TextField> &
  ProductionLineDerived;

/**
 * Field shown as the detail view H6 title — it has no label/value row.
 * FSD MOM-99 does not name the title field: Code is assumed (the unique key).
 * Confirm with FE (AUTOMATION_RULES Section 9.1).
 */
const DETAIL_TITLE_FIELD = "code" as const;

/** Detail view label/value rows — FSD MOM-99 Section 7.5, Detail View, minus the title field. */
const DETAIL_LABELS: Record<
  Exclude<keyof ProductionLineDetail, typeof DETAIL_TITLE_FIELD>,
  string
> = {
  name: "Name",
  lineNo: "Line No",
  processMaster: "Process Master",
  storageLocation: "Storage Location",
  repairStorageLocation: "Repair Storage Location",
  externalCode: "External Code",
  area: "Area",
  factory: "Factory",
  floor: "Floor",
  division: "Division",
};

const DETAIL_FIELDS: DetailFieldMap<ProductionLineDetail> = {
  titleField: DETAIL_TITLE_FIELD,
  labels: DETAIL_LABELS,
};

type ReferenceField = "processMaster" | "storageLocation" | "repairStorageLocation";

/** Text and reference fields of the form (toggles excluded). */
export type PlmTextOrRefField = TextField;

/** Maximum length of each text field (FSD Section 7.5.2). */
export const PLM_MAX_LENGTH = {
  code: 50,
  name: 100,
  lineNo: 10,
  externalCode: 100,
} as const;

/**
 * MOM-99 business-rule messages (FSD rev. Section 7.3 / 8.3). Generic checks use STD_MESSAGES:
 *  - Auto Transfer to Repair Yes without a repair storage location (FR-130): STD_MESSAGES.required
 *    under Repair Storage Location.
 *  - Delete of a line another user deleted (FR-160): STD_DIALOGS.deleted (modal).
 *  - List or line page fails to load (FR-10, FR-20): LOAD_FAILED_TEXT, BasePage.expectLoadFailed().
 */
export const PLM_MESSAGES = {
  /** FR-90, inline under Repair Storage Location. */
  repairSameAsStorage: "Must be different from Storage Location",
  saveFailed: "The change could not be saved. Please try again or contact IT support.",
} as const;
// List / line page load failed (FR-10, FR-20): standard text, BasePage.expectLoadFailed().

export class ProductionLineMastersPage extends BasePage {
  /**
   * Route seen in the UI (hyperlink href ".../plant-structures/production-lines/70/process-masters/46").
   * It differs from the FSD menu name "Production Line Masters" (AUTOMATION_RULES Section 2): FSD finding.
   */
  readonly path = "/master-data/plant-structures/production-lines";

  // Test ids as seen in the UI (toggle Production Line): prefix "pl" and the field
  // name of the data model, kebab-case: "pl-is-production-line-input" (not "plm-production-line-input").
  // Only pl-is-production-line is confirmed; the other ids follow the same pattern.
  // The field wrapper has the id without "-input"; inline errors show inside it.
  // Area, Factory, Floor, Division and Active are read only: no input locator.
  private static readonly FIELD_IDS: Record<PlmTextOrRefField, string> = {
    code: "pl-code",
    name: "pl-name",
    lineNo: "pl-line-no",
    processMaster: "pl-process-master",
    storageLocation: "pl-storage-location",
    repairStorageLocation: "pl-repair-storage-location",
    externalCode: "pl-external-code",
  };
  private input = (field: PlmTextOrRefField) =>
    this.page.getByTestId(`${ProductionLineMastersPage.FIELD_IDS[field]}-input`);
  private inputCode = () => this.input("code");
  private inputName = () => this.input("name");
  private inputLineNo = () => this.input("lineNo");
  private inputProcessMaster = () => this.input("processMaster");
  private inputStorageLocation = () => this.input("storageLocation");
  private inputRepairStorageLocation = () => this.input("repairStorageLocation");
  private inputExternalCode = () => this.input("externalCode");

  /**
   * <td data-col-key> of the Yes/No list columns. Confirmed in the UI: isTwoStepTransfer
   * and isProductionLine. isAutoRepairTransfer and isActive follow the same pattern.
   */
  protected override readonly listColumnKeys = {
    "Production Line": "isProductionLine",
    "Two Step Transfer": "isTwoStepTransfer",
    "Auto Transfer to Repair": "isAutoRepairTransfer",
    Active: "isActive",
  };

  /** Toggle field ids (see BasePage.setToggle). */
  private static readonly TOGGLE_IDS: Record<keyof PlmToggles, string> = {
    productionLine: "pl-is-production-line",
    twoStepTransfer: "pl-is-two-step-transfer",
    autoTransferToRepair: "pl-is-auto-repair-to-transfer",
  };

  // ---------- Navigation ----------

  async open() {
    await this.goto(this.path);
    await this.expectTableLoaded();
  }

  async openDetail(code: string) {
    await this.open();
    await this.openDetailByColumn("Code", code);
    await this.expectDetailOpened(code);
  }

  // ---------- Actions ----------

  async create(data: ProductionLineMaster) {
    await this.startCreate(data);
    await this.saveNew(data.code);
  }

  /**
   * Open New and fill the form, without saving.
   * typeText: type the text fields key by key, as a user does.
   */
  async startCreate(
    data: Partial<ProductionLineMaster>,
    opts: { typeText?: boolean } = {},
  ) {
    await this.openCreatePage();
    await this.fillForm(data, opts);
  }

  /** Save the open form (New or Edit), confirm, and wait for the line page of `code`. */
  async saveNew(code: string) {
    await this.clickSave();
    await this.confirmDialog("Save");
    await this.expectDetailOpened(code);
  }

  /**
   * Code cannot be changed (FR-140). Field undefined = not touched.
   * The list must already be open (call open() first).
   */
  async update(
    code: string,
    data: Partial<Omit<ProductionLineMaster, "code">>,
  ) {
    await this.openDetailByColumn("Code", code);
    await this.clickEdit();
    await this.fillForm(data);
    await this.clickSave();
    await this.confirmDialog("Save");
    await this.expectNoDialog("Duplicate Record");
    await this.expectDetailOpened(code);
  }

  /**
   * Open the line, click Edit and fill the form, without saving.
   * The list must already be open (call open() first).
   */
  async startEdit(
    code: string,
    data: Partial<Omit<ProductionLineMaster, "code">>,
  ) {
    await this.openDetailByColumn("Code", code);
    await this.expectDetailOpened(code);
    await this.clickEdit();
    await this.fillForm(data);
  }

  /**
   * Fill the form that is already open (New, or Edit after clickEdit), without saving.
   * Use saveNew(code) to save it: it works for New and Edit.
   */
  async fill(data: Partial<Omit<ProductionLineMaster, "code">> & { code?: string }) {
    await this.fillForm(data);
  }

  /** Click Save on a form that is expected to be refused (confirms only if asked). */
  async trySave() {
    await this.clickSaveConfirmIfAsked();
  }

  /**
   * Tick the rows on the open list, click More → Delete, check the standard confirmation
   * "Delete 1 Record?" / "Delete {qty} Records?" and click Delete. The caller asserts the result.
   */
  async tryDelete(codes: string[]) {
    await this.selectRowsByColumn("Code", codes);
    await this.clickDelete();
    await this.expectDialogText(deleteConfirmMessage(codes.length));
    await this.confirmDialog("Delete");
  }

  /** Delete from the list (FR-160): the rows must leave the list. */
  async delete(codes: string[]) {
    await this.tryDelete(codes);
    for (const code of codes) await this.expectNotInList(code);
  }

  /**
   * Open the line, click More → Delete, check "Delete 1 Record?" and click Delete.
   * The caller asserts the result.
   */
  async tryDeleteFromDetail(code: string) {
    await this.openDetail(code);
    await this.clickDetailDelete();
    await this.expectDialogText(deleteConfirmMessage(1));
    await this.confirmDialog("Delete");
  }

  /** Delete from the line page (FR-160): the line must leave the list. */
  async deleteFromDetail(code: string) {
    await this.tryDeleteFromDetail(code);
    await this.open();
    await this.expectNotInList(code);
  }

  /** Select rows, click Delete, then cancel the confirmation. */
  async cancelDelete(codes: string[]) {
    await this.selectRowsByColumn("Code", codes);
    await this.clickDelete();
    await this.expectDialogText(deleteConfirmMessage(codes.length));
    await this.confirmDialog("Cancel");
    for (const code of codes) await this.expectInList(code);
  }

  // ---------- Assertions (menu-specific wrappers over BasePage) ----------

  /**
   * Field undefined = not checked, "" = empty (UI "-"). Code is checked on the H6 title.
   * Toggles in `expected` are ignored here: use expectFormToggles / expectSavedToggles.
   */
  async expectDetail(
    expected: Partial<ProductionLineMaster> & ProductionLineDerived,
  ) {
    const text: Partial<ProductionLineDetail> = { ...expected };
    for (const key of TOGGLE_KEYS) delete (text as Record<string, unknown>)[key];
    await this.expectDetailFields(text, DETAIL_FIELDS);
  }

  async expectInList(code: string) {
    await this.expectRowInList(code);
  }

  async expectNotInList(code: string) {
    await this.expectRowNotInList(code);
  }

  /**
   * The row of `code` shows each value in its column (FSD 7.5 List View names).
   * Yes/No columns take a boolean: icon, or the badge for Active.
   * A hidden column (External Code) can only be checked after the user shows it.
   */
  async expectLine(code: string, values: PlmListValues) {
    await this.expectListValues(code, values);
  }

  /**
   * Columns hidden by default have no header (FSD 7.5.1).
   * Candidate for BasePage once a second menu needs it.
   */
  async expectColumnsHidden(columns: readonly string[]) {
    for (const column of columns) await expect(this.listHeader(column)).toHaveCount(0);
  }

  /**
   * The rows with these Codes show in this order (default sort Code ascending, FSD 7.5.1).
   * Other rows between them are ignored. All the codes must be on the loaded page:
   * with many lines the run's codes may fall on different pages (then the test fails
   * with the codes found, not with a wrong order).
   * Candidate for BasePage once a second menu needs it.
   */
  async expectCodeOrder(codes: readonly string[]) {
    const index = await this.listColumnIndex("Code");
    const shown = await this.clickableRows().evaluateAll(
      (rows, i) => rows.map((r) => (r.children[i]?.textContent ?? "").trim()),
      index,
    );
    const found = shown.filter((code) => codes.includes(code));
    expect(found, `Codes on the loaded page, in list order (all shown: ${shown.length})`).toEqual([...codes]);
  }

  /** The same inline error shows under each field. */
  async expectFieldErrors(fields: PlmTextOrRefField[], message: string) {
    for (const field of fields) {
      await this.expectFieldError(ProductionLineMastersPage.FIELD_IDS[field], message);
    }
  }

  /** One inline error per field, each with its own text. */
  async expectFieldErrorsEach(errors: Partial<Record<PlmTextOrRefField, string>>) {
    for (const [field, message] of Object.entries(errors) as [PlmTextOrRefField, string | undefined][]) {
      if (message !== undefined) {
        await this.expectFieldError(ProductionLineMastersPage.FIELD_IDS[field], message);
      }
    }
  }

  /** Toggle state on the open form (New or Edit). Undefined = not checked. */
  async expectFormToggles(expected: PlmToggles) {
    for (const [fieldId, on] of this.toggleMap(expected)) {
      if (on !== undefined) await this.expectToggle(fieldId, on);
    }
  }

  /** Saved toggle state: open the line, click Edit and read the toggles. Leaves Edit open. */
  async expectSavedToggles(code: string, expected: PlmToggles) {
    await this.openDetail(code);
    await this.clickEdit();
    await this.expectFormToggles(expected);
  }

  /** Text values on the open form. */
  async expectFormValues(
    expected: Partial<
      Pick<ProductionLineMaster, "code" | "name" | "lineNo" | "externalCode">
    >,
  ) {
    for (const [input, value] of this.textMap(expected)) {
      if (value !== undefined) await expect(input()).toHaveValue(value);
    }
  }

  /** Code is read only in Edit (FR-140, Section 8.2): no input, or an input that cannot be edited. */
  async expectCodeReadOnly() {
    await expect(this.inputName()).toBeVisible(); // form is in Edit mode
    const code = this.inputCode();
    if ((await code.count()) > 0) await expect(code).not.toBeEditable();
  }

  /**
   * On the open form, a reference combobox shows `shown` and does not show `hidden`
   * (FR-70 to FR-90). hidden undefined = not checked.
   */
  async expectReferenceOptions(
    field: ReferenceField,
    shown: string,
    hidden?: string,
  ) {
    const input = this.referenceInput(field);
    await this.expectOption(input, shown);
    if (hidden !== undefined) await this.expectNoOption(input, hidden);
  }

  // ---------- Helpers ----------

  private referenceInput(field: ReferenceField): () => Locator {
    return {
      processMaster: this.inputProcessMaster,
      storageLocation: this.inputStorageLocation,
      repairStorageLocation: this.inputRepairStorageLocation,
    }[field];
  }

  private textMap(data: Partial<ProductionLineMaster>) {
    return [
      [this.inputCode, data.code],
      [this.inputName, data.name],
      [this.inputLineNo, data.lineNo],
      [this.inputExternalCode, data.externalCode],
    ] as const;
  }

  private comboMap(data: Partial<ProductionLineMaster>) {
    return [
      [this.inputProcessMaster, data.processMaster],
      [this.inputStorageLocation, data.storageLocation],
      [this.inputRepairStorageLocation, data.repairStorageLocation],
    ] as const;
  }

  /** [toggle field id, wanted state] for each toggle. */
  private toggleMap(data: PlmToggles) {
    const ids = ProductionLineMastersPage.TOGGLE_IDS;
    return TOGGLE_KEYS.map((key) => [ids[key], data[key]] as const);
  }

  /** Field undefined = not touched. Comboboxes cannot be cleared yet (no BasePage function). */
  private async fillForm(
    data: Partial<ProductionLineMaster>,
    opts: { typeText?: boolean } = {},
  ) {
    for (const [input, value] of this.textMap(data)) {
      if (value === undefined) continue;
      if (opts.typeText) {
        await input().clear();
        await input().pressSequentially(value);
      } else {
        await input().fill(value);
      }
    }
    for (const [input, value] of this.comboMap(data)) {
      if (value === undefined) continue;
      if (value.trim() === "") {
        throw new Error(
          "Clearing a combobox is not automated yet: add a BasePage function first.",
        );
      }
      await this.selectOptions(input, value);
    }
    for (const [fieldId, on] of this.toggleMap(data)) {
      if (on !== undefined) await this.setToggle(fieldId, on);
    }
  }
}