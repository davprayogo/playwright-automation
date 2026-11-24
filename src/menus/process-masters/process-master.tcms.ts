/** TCMS adapter of Process Masters: Section 9.1 labels -> ProcessMaster, create through the Page Object. */
import type { Page } from "@playwright/test";
import { toModel, type FieldSpec, type MenuAdapter } from "@tcms/adapter";
import type { FieldValues } from "@tcms/runSetup";
import { ProcessMastersPage } from "./ProcessMastersPage";
import type { ProcessMaster } from "./process-master.data";

const MENU = "Process Masters";

const FIELDS: Record<string, FieldSpec<ProcessMaster>> = {
  Name: { field: "name" },
  Description: { field: "description" },
};

/** Values of a Process Masters data set (Section 9.1 labels) as Page Object data. */
export const toProcessMaster = (values: FieldValues) => toModel<ProcessMaster>(MENU, values, FIELDS);

export const adapter: MenuAdapter = {
  menu: MENU,
  path: new ProcessMastersPage({} as Page).path,
  titleLabel: "Name",
  detailLabels: ["Description"],
  listKeyFields: ["Name"],
  async create(page, values) {
    const p = new ProcessMastersPage(page);
    await p.open();
    await p.create(toProcessMaster(values));
  },
};