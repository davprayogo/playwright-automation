/** Process Master input data — fields per FSD MOM-67 Section 7.5 (Detail View). */
export interface ProcessMaster {
  /** Mandatory, max 100 chars. Unique, ignoring case. Cannot be changed after save. */
  name: string;
  /** Optional, max 255 chars. */
  description?: string;
}