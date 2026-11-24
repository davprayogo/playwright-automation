/** TCMS adapter of Area Masters: Section 9.1 labels -> AreaMaster, create through the Page Object. */
import type { Page } from "@playwright/test";
import { toModel, type FieldSpec, type MenuAdapter } from "@tcms/adapter";
import type { FieldValues } from "@tcms/runSetup";
import { AreaMastersPage } from "./AreaMastersPage";
import type { AreaMaster } from "./area-master.data";

const MENU = "Area Masters";

const FIELDS: Record<string, FieldSpec<AreaMaster>> = {
  Factory: { field: "factory" },
  Name: { field: "name" },
  Floor: { field: "floor" },
  Division: { field: "division" },
  Description: { field: "description" },
  Remark: { field: "remark" },
};

/** Values of an Area Masters data set (Section 9.1 labels) as Page Object data. */
export const toAreaMaster = (values: FieldValues) => toModel<AreaMaster>(MENU, values, FIELDS);

export const adapter: MenuAdapter = {
  menu: MENU,
  path: new AreaMastersPage({} as Page).path,
  titleLabel: "Name",
  detailLabels: ["Factory", "Floor", "Division", "Description", "Remark"],
  listKeyFields: ["Factory", "Name"],
  async create(page, values) {
    const p = new AreaMastersPage(page);
    await p.open();
    await p.create(toAreaMaster(values));
  },
};