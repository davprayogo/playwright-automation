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
  factory?: string;
  floor?: string;
  division?: string;
}