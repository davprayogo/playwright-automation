import { expect } from "@playwright/test";
import {
  BasePage,
  duplicateRecordMessage,
  type DetailFieldMap,
} from "./BasePage";
import type { AreaMaster } from "@data/wms/areaMaster";

type AreaField = keyof AreaMaster;

/** Field shown as the detail view H6 title — it has no label/value row. */
const DETAIL_TITLE_FIELD = "name" as const;

/**
 * Detail view label/value rows — field names from FSD MOM-98 Section 7.5.2,
 * minus the title field (shown only as H6).
 */
const DETAIL_LABELS: Record<
  Exclude<AreaField, typeof DETAIL_TITLE_FIELD>,
  string
> = {
  factory: "Factory",
  floor: "Floor",
  division: "Division",
  description: "Description",
  remark: "Remark",
};

const DETAIL_FIELDS: DetailFieldMap<AreaMaster> = {
  titleField: DETAIL_TITLE_FIELD,
  labels: DETAIL_LABELS,
};

/**
 * MOM-98 business-rule messages (FSD Section 7.3 / 8.3).
 * Generic checks use the BasePage standards instead (AUTOMATION_RULES Section 10):
 * required (inline), duplicate (toast, duplicateRecordMessage), delete of an area in use
 * (toast, STD_MESSAGES.deleteInUse — replaces the FR-80 "These areas cannot be deleted..." text),
 * concurrency (STD_DIALOGS).
 */
export const AM_MESSAGES = {
  listLoadFailed:
    "Areas could not be loaded. Please refresh the page or contact IT support.",
  detailLoadFailed:
    "This area could not be loaded. Please refresh the page or contact IT support.",
  saveFailed:
    "The change could not be saved. Please try again or contact IT support.",
  areasNoLongerExist: (names: string[]) =>
    `These areas no longer exist: ${names.join(", ")}. Please refresh the page.`,
} as const;

export class AreaMastersPage extends BasePage {
  readonly path = "/master-data/plant-structures/area-masters";

  // Rule: {prefix-menu}-{field-name}-input  (Area Masters -> "am").
  // The field wrapper has the id without "-input"; inline errors show inside it
  // (BasePage.fieldError). Active is read only: no input locator.
  private static readonly FIELD_IDS: Record<AreaField, string> = {
    factory: "am-factory",
    name: "am-name",
    floor: "am-floor",
    division: "am-division",
    description: "am-description",
    remark: "am-remark",
  };
  private input = (field: AreaField) =>
    this.page.getByTestId(`${AreaMastersPage.FIELD_IDS[field]}-input`);
  private inputFactory = () => this.input("factory");
  private inputName = () => this.input("name");
  private inputFloor = () => this.input("floor");
  private inputDivision = () => this.input("division");
  private inputDescription = () => this.input("description");
  private inputRemark = () => this.input("remark");

  // ---------- Navigation ----------

  async open() {
    await this.goto(this.path);
    await this.expectTableLoaded();
  }

  async openDetail(name: string) {
    await this.open();
    await this.openDetailByColumn("Name", name);
    await this.expectDetailOpened(name);
  }

  // ---------- Actions ----------

  async create(data: AreaMaster) {
    await this.startCreate(data);
    await this.clickSave();
    await this.confirmDialog("Save");
    await this.expectDetailOpened(data.name);
  }

  /** Open New and fill the form, without saving. */
  async startCreate(data: Partial<AreaMaster>) {
    await this.openCreatePage();
    await this.fillForm(data);
  }

  /**
   * Field undefined = not touched, "" = cleared.
   * The list must already be open (call open() first).
   */
  async update(oldName: string, data: Partial<AreaMaster>) {
    await this.openDetailByColumn("Name", oldName);
    await this.clickEdit();
    await this.fillForm(data);
    await this.clickSave();
    await this.confirmDialog("Save");
    await this.expectNoDialog("Duplicate Record");
    await this.expectDetailOpened(data.name ?? oldName);
  }

  /**
   * Open the area, click Edit and fill the form, without saving.
   * byFactory: open the row by its Factory instead of its Name, when the same name
   * exists in several factories (the factory must hold only this area).
   * The list must already be open (call open() first).
   */
  async startEdit(
    name: string,
    data: Partial<AreaMaster>,
    opts: { byFactory?: string } = {},
  ) {
    if (opts.byFactory)
      await this.openDetailByColumn("Factory", opts.byFactory);
    else await this.openDetailByColumn("Name", name);
    await this.expectDetailOpened(name);
    await this.clickEdit();
    await this.fillForm(data);
  }

  /** Click Save on a form that is expected to be refused (confirms only if asked). */
  async trySave() {
    await this.clickSaveConfirmIfAsked();
  }

  /** Delete from the list. Rows must be selected first. */
  async delete(names: string[], opts: { confirmMessage?: string } = {}) {
    await this.selectRowsByColumn("Name", names);
    await this.clickDelete();
    if (opts.confirmMessage) await this.expectDialogText(opts.confirmMessage);
    await this.confirmDialog("Delete");
    for (const name of names) await this.expectNotInList(name);
  }

  /**
   * Delete from the list when the delete is expected to be refused (FR-80):
   * select, Delete, confirm. No check that the rows are gone.
   */
  async tryDelete(names: string[]) {
    await this.selectRowsByColumn("Name", names);
    await this.clickDelete();
    await this.confirmDialog("Delete");
  }

  /** Delete from the area page (FR-80): More → Delete → confirm. */
  async deleteFromDetail(name: string) {
    await this.openDetail(name);
    await this.clickDetailDelete();
    await this.expectDialogText(`Delete 1 Record?`);
    await this.confirmDialog("Delete");
    await this.open();
    await this.expectNotInList(name);
  }

  /** Select rows, click Delete, then cancel the confirmation. */
  async cancelDelete(names: string[]) {
    await this.selectRowsByColumn("Name", names);
    await this.clickDelete();
    await this.confirmDialog("Cancel");
    for (const name of names) await this.expectInList(name);
  }

  // ---------- Assertions (menu-specific wrappers over BasePage) ----------

  /** Field undefined = not checked, "" = empty (UI "-"). Name is checked on the H6 title. */
  async expectDetail(expected: Partial<AreaMaster>) {
    await this.expectDetailFields(expected, DETAIL_FIELDS);
  }

  async expectInList(name: string, factory?: string) {
    await this.expectRowInList(...this.rowCells(name, factory));
  }

  async expectNotInList(name: string, factory?: string) {
    await this.expectRowNotInList(...this.rowCells(name, factory));
  }

  /** The same inline error shows under each field. */
  async expectFieldErrors(fields: AreaField[], message: string) {
    for (const field of fields) {
      await this.expectFieldError(AreaMastersPage.FIELD_IDS[field], message);
    }
  }

  /**
   * Duplicate toast for the unique key Factory + Name (FR-40), in that order.
   * Each value may be given as [typed, existing] while it is not confirmed which
   * spelling the toast shows (AUTOMATION_RULES Section 10.2). Call it right after
   * the save, then take the evidence screenshot.
   */
  async expectDuplicateToast(
    factory: string | readonly string[],
    name: string | readonly string[],
  ) {
    await this.expectToast(
      duplicateRecordMessage([
        ["Factory", factory],
        ["Name", name],
      ]),
    );
  }

  /** Values on the open form (New or Edit). Field undefined = not checked. */
  async expectFormValues(expected: Partial<AreaMaster>) {
    for (const [input, value] of this.fieldMap(expected)) {
      if (value !== undefined) await expect(input()).toHaveValue(value);
    }
  }

  // ---------- Helpers ----------

  private rowCells(name: string, factory?: string) {
    return factory ? [name, factory] : [name];
  }

  private fieldMap(data: Partial<AreaMaster>) {
    return [
      [this.inputFactory, data.factory],
      [this.inputName, data.name],
      [this.inputFloor, data.floor],
      [this.inputDivision, data.division],
      [this.inputDescription, data.description],
      [this.inputRemark, data.remark],
    ] as const;
  }

  private async fillForm(data: Partial<AreaMaster>) {
    for (const [input, value] of this.fieldMap(data)) {
      if (value !== undefined) await input().fill(value);
    }
  }
}
