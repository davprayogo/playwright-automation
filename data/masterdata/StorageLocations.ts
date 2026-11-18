/** Storage Location input data — fields per FSD MOM-113 Section 7.5.2 (Header fields). */
export interface StorageLocation {
  /** Mandatory. Combobox of active areas, by area name. */
  area: string;
  /** Mandatory, max 100 chars. Unique within the area, ignoring case. */
  name: string;
  /** Optional, max 100 chars. */
  sapReference?: string;
  /** Optional, max 25 chars. */
  sapStatus?: string;
  /** Optional Yes/No. No on New. */
  binManaged?: boolean;
  /** Optional, max 255 chars. */
  description?: string;
  /** Optional, max 255 chars. */
  remark?: string;
}
