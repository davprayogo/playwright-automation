/** TCMS adapter of Storage Locations: Section 9.1 labels -> StorageLocation, create through the Page Object. */
import type { Page } from "@playwright/test";
import { toModel, type FieldSpec, type MenuAdapter } from "@tcms/adapter";
import type { FieldValues } from "@tcms/runSetup";
import { StorageLocationsPage } from "./StorageLocationsPage";
import type { StorageLocation } from "./storage-location.data";

const MENU = "Storage Locations";

const FIELDS: Record<string, FieldSpec<StorageLocation>> = {
  Area: { field: "area" },
  Name: { field: "name" },
  "SAP Reference": { field: "sapReference" },
  "SAP Status": { field: "sapStatus" },
  "Bin Managed": { field: "binManaged", kind: "yesno" },
  Description: { field: "description" },
  Remark: { field: "remark" },
};

/** Factory is part of the identity key (MOM-99 9.1) but not a field of the form. */
const KEY_ONLY = ["Factory"];

/** Values of a Storage Locations data set (Section 9.1 labels) as Page Object data. */
export const toStorageLocation = (values: FieldValues) =>
  toModel<StorageLocation>(MENU, values, FIELDS, KEY_ONLY);

export const adapter: MenuAdapter = {
  menu: MENU,
  path: new StorageLocationsPage({} as Page).path,
  titleLabel: "Name",
  detailLabels: ["Area", "SAP Reference", "SAP Status", "Description", "Remark"],
  listKeyFields: ["Area", "Name"], // Factory: not confirmed as a list column (TCMS-F07)
  async create(page, values) {
    const p = new StorageLocationsPage(page);
    await p.open();
    await p.create(toStorageLocation(values));
  },
};