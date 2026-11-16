/** Area Master input data — fields per FSD MOM-98 Section 7.5.2. */
export interface AreaMaster {
  /** Mandatory, max 10 chars. Case-insensitive, saved with the existing spelling. */
  factory: string;
  /** Mandatory, max 100 chars. Unique within the factory, ignoring case. */
  name: string;
  /** Optional, max 50 chars, free format (e.g. "16#5"). */
  floor?: string;
  /** Optional, max 100 chars. */
  division?: string;
  /** Optional, max 255 chars. */
  description?: string;
  /** Optional, max 255 chars. */
  remark?: string;
}
