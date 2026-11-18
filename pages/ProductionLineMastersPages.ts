import { expect, type Locator } from "@playwright/test";
import { BasePage, type DetailFieldMap } from "./BasePage";
import type {
  ProductionLineDerived,
  ProductionLineMaster,
} from "@data/masterdata/ProductionLineMasters";

/** List columns — FSD MOM-99 Section 7.5, List View (Checkbox excluded). */
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
  "External Code",
  "Two Step Transfer",
  "Auto Transfer to Repair",
  "Active",
] as const;

export type PlmListColumn = (typeof PLM_LIST_COLUMNS)[number];

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

type ReferenceField =
  | "processMaster"
  | "storageLocation"
  | "repairStorageLocation";

export class ProductionLineMastersPage extends BasePage {
  readonly path = "/master-data/plant-structures/production-lines";

  // Test ids as seen in the UI (toggle Production Line): prefix "pl" and the field
  // name of the data model, kebab-case: "pl-is-production-line-input" (not "plm-production-line-input").
  // Only pl-is-production-line is confirmed; the other ids follow the same pattern.
  // Area, Factory, Floor, Division and Active are read only: no input locator.
  private inputCode = () => this.page.getByTestId("pl-code-input");
  private inputName = () => this.page.getByTestId("pl-name-input");
  private inputLineNo = () => this.page.getByTestId("pl-line-no-input");
  private inputProcessMaster = () =>
    this.page.getByTestId("pl-master-process-input");
  private inputStorageLocation = () =>
    this.page.getByTestId("pl-storage-location-input");
  private inputRepairStorageLocation = () =>
    this.page.getByTestId("pl-repair-storage-location-input");
  private inputExternalCode = () =>
    this.page.getByTestId("pl-external-code-input");

  /** Toggle field ids (see BasePage.setToggle). */
  private static readonly TOGGLE_IDS: Record<keyof PlmToggles, string> = {
    productionLine: "pl-is-production-line",
    twoStepTransfer: "pl-is-two-step-transfer",
    autoTransferToRepair: "pl-is-auto-transfer-to-repair",
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
   * typeText: type the text fields key by key, so the input's max length applies.
   */
  async startCreate(
    data: ProductionLineMaster,
    opts: { typeText?: boolean } = {},
  ) {
    await this.openCreatePage();
    await this.fillForm(data, opts);
  }

  /** Save the open New form and confirm. */
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

  /** Delete from the list (FR-160). Rows must be selected first. */
  async delete(codes: string[], opts: { confirmMessage?: string } = {}) {
    await this.selectRowsByColumn("Code", codes);
    await this.clickDelete();
    if (opts.confirmMessage) await this.expectDialogText(opts.confirmMessage);
    await this.confirmDialog("Delete");
    for (const code of codes) await this.expectNotInList(code);
  }

  /** Delete from the line page (FR-160): More → Delete → confirm. */
  async deleteFromDetail(code: string) {
    await this.openDetail(code);
    await this.clickDetailDelete();
    await this.expectDialogText(`Delete 1 Records?`);
    await this.confirmDialog("Delete");
    await this.open();
    await this.expectNotInList(code);
  }

  /** Select rows, click Delete, then cancel the confirmation. */
  async cancelDelete(codes: string[], opts: { confirmMessage?: string } = {}) {
    await this.selectRowsByColumn("Code", codes);
    await this.clickDelete();
    if (opts.confirmMessage) await this.expectDialogText(opts.confirmMessage);
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
    for (const key of TOGGLE_KEYS)
      delete (text as Record<string, unknown>)[key];
    await this.expectDetailFields(text, DETAIL_FIELDS);
  }

  async expectInList(code: string) {
    await this.expectRowInList(code);
  }

  async expectNotInList(code: string) {
    await this.expectRowNotInList(code);
  }

  /** The row of `code` shows each value in its column (FSD 7.5 List View names). */
  async expectListValues(
    code: string,
    values: Partial<Record<PlmListColumn, string>>,
  ) {
    for (const [column, value] of Object.entries(values)) {
      if (value !== undefined) await this.expectListCell(code, column, value);
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

  /** Text values on the open form (e.g. after typing over the max length). */
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
