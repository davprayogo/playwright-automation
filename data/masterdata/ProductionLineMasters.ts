/** Production Line Master input data — fields per FSD MOM-99 Section 7.5 (Detail View). */
/** Production Line Master input data — fields per FSD MOM-99 Section 7.5 (Detail View). */
export interface ProductionLineMaster {
  /** Mandatory, max 50 chars. Unique across all factories, ignoring case. Cannot be changed after save. */
  code: string;
  /** Mandatory, max 100 chars. Not unique. */
  name: string;
  /** Mandatory, max 10 chars. Not unique. */
  lineNo: string;
  /** Mandatory. Combobox of active process masters, by name. */
  processMaster: string;
  /** Mandatory. Combobox of active storage locations, by name. */
  storageLocation: string;
  /** Optional. Must differ from storageLocation. Mandatory when autoTransferToRepair is true. */
  repairStorageLocation?: string;
  /** Optional, max 100 chars. Not unique. */
  externalCode?: string;
  /** Toggle. Default Yes on New. */
  productionLine?: boolean;
  /** Toggle. Default No on New. */
  twoStepTransfer?: boolean;
  /** Toggle. Default No on New. Yes needs repairStorageLocation. */
  autoTransferToRepair?: boolean;
}

/** Read-only fields shown on the line, read from the area of its storage location. */
export interface ProductionLineDerived {
  area?: string;
  master_area?: string;
  factory?: string;
  floor?: string;
  division?: string;
}

/** A seeded storage location and the area data the line shows for it. */
export interface StorageLocationRef {
  name: string;
  area: string;
  factory: string;
  floor: string;
  division: string;
}

const env = (key: string, fallback: string) => process.env[key] ?? fallback;

/**
 * Reference data that must already exist in the test environment
 * (FSD MOM-99 Section 9, "Shared test data"). This menu cannot create it.
 * Override per environment with the PLM_* environment variables.
 */
export const PLM_REFS = {
  /** Active process master. */
  processMaster: env("PLM_PROCESS_MASTER", "SMT"),
  /** Inactive process master. */
  inactiveProcessMaster: env("PLM_INACTIVE_PROCESS_MASTER", "OLD PM"),
  /** Active storage location in area PROD LINE 1. */
  sloc1: {
    name: env("PLM_SLOC1", "PROD LINE 1 SLOC 1"),
    area: env("PLM_SLOC1_AREA", "PROD LINE 1"),
    factory: env("PLM_SLOC1_FACTORY", "F1"),
    floor: env("PLM_SLOC1_FLOOR", "1"),
    division: env("PLM_SLOC1_DIVISION", "SMT"),
  } satisfies StorageLocationRef,
  /** Active storage location in area PROD LINE 2 (another factory). */
  sloc2: {
    name: env("PLM_SLOC2", "PROD LINE 2 SLOC 1"),
    area: env("PLM_SLOC2_AREA", "PROD LINE 2"),
    factory: env("PLM_SLOC2_FACTORY", "F2"),
    floor: env("PLM_SLOC2_FLOOR", "1"),
    division: env("PLM_SLOC2_DIVISION", "SMT"),
  } satisfies StorageLocationRef,
  /** Active storage locations used as repair storage locations. */
  repairSloc1: env("PLM_REPAIR_SLOC1", "REPAIR SLOC 1"),
  repairSloc2: env("PLM_REPAIR_SLOC2", "REPAIR SLOC 2"),
  /** Inactive storage location. */
  inactiveSloc: env("PLM_INACTIVE_SLOC", "OLD SLOC"),
} as const;
