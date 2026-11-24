/** TCMS adapter of Production Line Masters: Section 9.1 labels -> ProductionLineMaster. */
import type { Page } from "@playwright/test";
import { toModel, type FieldSpec, type MenuAdapter } from "@tcms/adapter";
import type { FieldValues } from "@tcms/runSetup";
import { ProductionLineMastersPage } from "./ProductionLineMastersPage";
import type { ProductionLineMaster } from "./production-line-master.data";

const MENU = "Production Line Masters";

const FIELDS: Record<string, FieldSpec<ProductionLineMaster>> = {
  Code: { field: "code" },
  Name: { field: "name" },
  "Line No": { field: "lineNo" },
  "Process Master": { field: "processMaster" },
  "Storage Location": { field: "storageLocation" },
  "Repair Storage Location": { field: "repairStorageLocation" },
  "External Code": { field: "externalCode" },
  "Production Line": { field: "productionLine", kind: "yesno" },
  "Two Step Transfer": { field: "twoStepTransfer", kind: "yesno" },
  "Auto Transfer to Repair": { field: "autoTransferToRepair", kind: "yesno" },
};

/** Values of a Production Line data set (Section 9.1 labels) as Page Object data. */
export const toProductionLine = (values: FieldValues) =>
  toModel<ProductionLineMaster>(MENU, values, FIELDS);

export const adapter: MenuAdapter = {
  menu: MENU,
  path: new ProductionLineMastersPage({} as Page).path,
  titleLabel: "Code",
  detailLabels: [
    "Name",
    "Line No",
    "Process Master",
    "Storage Location",
    "Repair Storage Location",
    "External Code",
    "Area",
    "Factory",
    "Floor",
    "Division",
  ],
  listKeyFields: ["Code"],
  async create(page, values) {
    const p = new ProductionLineMastersPage(page);
    await p.open();
    await p.create(toProductionLine(values));
  },
};
