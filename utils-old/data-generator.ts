/**
 * Membuat nama unik per run supaya data tidak bentrok.
 * Prefix membantu tester manual mengenali data hasil automation.
 *
 *   uniqueName('AUTO-Customer') -> "AUTO-Customer-1760341234567"
 *   uniqueName('SEED-Customer') -> "SEED-Customer-1760341234567"
 */
export function uniqueName(prefix: string): string {
  return `${prefix}-${Date.now()}`;
}

export function uniqueEmail(prefix = 'auto'): string {
  return `${prefix}.${Date.now()}@example.com`;
}
