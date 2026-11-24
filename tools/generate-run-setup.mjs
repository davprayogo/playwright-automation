#!/usr/bin/env node
/**
 * LOCAL STAND-IN FOR TCMS (FSD ZSN_ETCMS001 FR-115, 8.6, 8.9). Remove when the TCMS
 * test-data API (GET {TCMS_URL}/api/test-data) is available.
 *
 * Makes a run setup file with NEW values for every run: it reads Section 9.1 Data Set and the
 * data sets of each test case from one or more Markdown sources (a feature FSD in the new
 * Section 9 format, or a catalogue in test-data/data-sets/), fills every template with a new
 * unique code per test case, and writes the same JSON shape TCMS sends (src/tcms/runSetup.ts).
 *
 * The values are decided here, before the run, and saved in the file: the specs and fixtures
 * still make no value, and the file shows exactly which data a run used.
 *
 * Usage (from the automations folder):
 *   node tools/generate-run-setup.mjs --source "test-data/data-sets/MOM-98 Area Masters - Data Set.md" \
 *        [--source "<path to MOM-99 FSD>.md"] [--tc TC-MOM98-008,TC-MOM98-009] \
 *        [--mode delete|keep|prepare] [--env qa|uat] [--out test-data/run-setup/local.json]
 *
 * Then:  RUN_SETUP_FILE=test-data/run-setup/local.json npx playwright test ...
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { randomInt } from "node:crypto";

// ---------------------------------------------------------------- arguments

const args = { source: [], tc: [], mode: "delete", env: "qa", out: "test-data/run-setup/local.json" };
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  const key = argv[i].replace(/^--/, "");
  const value = argv[++i];
  if (value === undefined) fail(`--${key} needs a value.`);
  if (key === "source") args.source.push(value);
  else if (key === "tc") args.tc.push(...value.split(",").map((s) => s.trim()).filter(Boolean));
  else if (key in args) args[key] = value;
  else fail(`Unknown option --${key}.`);
}
if (!args.source.length) fail("Give at least one --source (feature FSD or data set catalogue, Markdown).");
if (!["delete", "keep", "prepare"].includes(args.mode)) fail(`--mode must be delete, keep or prepare.`);
if (!["qa", "uat"].includes(args.env)) fail(`--env must be qa or uat (production is not allowed).`);

function fail(message) {
  console.error(`generate-run-setup: ${message}`);
  process.exit(1);
}

// ---------------------------------------------------------------- parse sources

/** ds -> { menu, role, state, identityKey, dependsOnColumn, pairs: [[field, template]] } */
const catalogue = new Map();
/** tc -> [ds, ...] in the order written */
const testCases = new Map();

const cellsOf = (line) => line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
const dsIds = (text) => text.match(/DS-[A-Z0-9]+-\d+/g) ?? [];

for (const file of args.source) {
  const md = readFileSync(file, "utf8");
  const lines = md.split(/\r?\n/);
  let currentTc = null;
  for (const line of lines) {
    // Section 9.1 row: | DS-... | Menu | Role | State | Identity Key | Depends On | Default Values |
    if (/^\|\s*DS-[A-Z0-9]+-\d+\s*\|/.test(line)) {
      const cells = cellsOf(line);
      if (cells.length !== 7) continue;
      const [ds, menu, role, state, key, dependsOn, values] = cells;
      if (catalogue.has(ds)) fail(`${ds} is defined twice (${file}).`);
      catalogue.set(ds, {
        menu,
        role: role.toLowerCase(),
        state: state ? state.toLowerCase() : undefined,
        identityKey: key && !/to be confirmed/i.test(key) ? key.split(",").map((k) => k.trim()) : [],
        dependsOnColumn: dsIds(dependsOn),
        pairs: values.split(" · ").map((pair) => {
          const at = pair.indexOf("=");
          return at < 0 ? [pair.trim(), ""] : [pair.slice(0, at).trim(), pair.slice(at + 1).trim()];
        }),
      });
      continue;
    }
    // Catalogue mapping row: | TC-... (or QA-...) | DS-..., DS-... (mutates) | ...
    const row = line.match(/^\|\s*((?:TC|QA)-[A-Z0-9]+-\w+)\s*\|([^|]*)\|/);
    if (row) {
      testCases.set(row[1], dsIds(row[2]));
      continue;
    }
    // Feature FSD test case heading + "- **Data Sets:** ..." line
    const heading = line.match(/^#{3,6}\s+((?:TC|QA)-[A-Z0-9]+-\w+)\b/);
    if (heading) {
      currentTc = heading[1];
      if (!testCases.has(currentTc)) testCases.set(currentTc, []);
      continue;
    }
    const sets = line.match(/^\s*-\s*\*\*Data Sets:\*\*\s*(.*)$/);
    if (sets && currentTc) testCases.set(currentTc, dsIds(sets[1]));
  }
}
if (!catalogue.size) fail("No Section 9.1 Data Set rows found in the sources.");

// ---------------------------------------------------------------- dependencies

/** {DS-X} or {DS-X.Field} tokens of one template. */
const tokenRe = /\{(DS-[A-Z0-9]+-\d+)(?:\.([^}]+))?\}/g;

for (const [ds, def] of catalogue) {
  const dependsOn = {};
  for (const [field, template] of def.pairs) {
    for (const m of template.matchAll(tokenRe)) dependsOn[m[1]] = field;
  }
  for (const dep of def.dependsOnColumn) if (!(dep in dependsOn)) dependsOn[dep] = "";
  for (const dep of Object.keys(dependsOn)) {
    if (!catalogue.has(dep)) fail(`${ds} depends on ${dep}, which is not in Section 9.1.`);
  }
  def.dependsOn = dependsOn;
}

/** The identity value a {DS-X} token stands for: the last identity key field (Name, Code), else Name / Code. */
function identityField(def) {
  if (def.identityKey.length) return def.identityKey[def.identityKey.length - 1];
  const fields = def.pairs.map(([f]) => f);
  return fields.includes("Code") ? "Code" : "Name";
}

// ---------------------------------------------------------------- fill per test case

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const usedCodes = new Set();
function newCode(length) {
  for (;;) {
    let code = "";
    for (let i = 0; i < length; i++) code += ALPHABET[randomInt(ALPHABET.length)];
    if (/[A-Z]/.test(code) && !usedCodes.has(code)) {
      usedCodes.add(code);
      return code;
    }
  }
}

const wanted = args.tc.length ? args.tc : [...testCases.keys()];
const out = {
  _comment:
    "GENERATED by tools/generate-run-setup.mjs (local stand-in for TCMS). New unique codes on every generation. Do not edit by hand.",
  runId: `LOCAL-${new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14)}`,
  environment: args.env,
  browser: "chromium",
  dataMode: args.mode,
  dataSets: {},
  testCases: {},
};
const warnings = [];

for (const tc of wanted) {
  const sets = testCases.get(tc);
  if (!sets) fail(`${tc} is not in the sources.`);

  // Data sets of the test case plus every dependency, dependencies first.
  const order = [];
  const visit = (ds, path = []) => {
    if (order.includes(ds)) return;
    if (path.includes(ds)) fail(`Data sets depend on each other in a loop: ${[...path, ds].join(" -> ")}.`);
    const def = catalogue.get(ds);
    if (!def) fail(`${tc} names ${ds}, which is not in Section 9.1.`);
    for (const dep of Object.keys(def.dependsOn)) visit(dep, [...path, ds]);
    order.push(ds);
  };
  sets.forEach((ds) => visit(ds));

  // One unique code per test case (FSD 8.6); {uid:n} takes its first n characters.
  const lengths = [...order.flatMap((ds) => catalogue.get(ds).pairs.map(([, t]) => t))]
    .flatMap((t) => [...t.matchAll(/\{uid:(\d+)\}/g)].map((m) => Number(m[1])));
  const code = newCode(Math.max(6, ...lengths));

  const filled = {};
  const data = {};
  for (const ds of order) {
    const def = catalogue.get(ds);
    const values = {};
    for (const [field, template] of def.pairs) {
      let value = template.replace(/\{uid:(\d+)\}/g, (_, n) => code.slice(0, Number(n)));
      value = value.replace(tokenRe, (whole, ref, refField) => {
        const v = filled[ref]?.[refField ?? identityField(catalogue.get(ref))];
        if (v === undefined) {
          warnings.push(`${tc}, ${ds}: ${field} uses ${whole}, which has no value.`);
          return whole;
        }
        return v;
      });
      if (/\{[^}]*\}/.test(value)) warnings.push(`${tc}, ${ds}: ${field} still holds a token: "${value}".`);
      values[field] = value;
    }
    filled[ds] = values;
    data[ds] = { source: def.role === "input" ? "input" : "dummy", values };

    const entry = { menu: def.menu, role: def.role };
    if (def.state) entry.state = def.state;
    if (def.identityKey.length) entry.identityKey = def.identityKey;
    if (Object.keys(def.dependsOn).length) entry.dependsOn = def.dependsOn;
    out.dataSets[ds] = entry;
  }
  out.testCases[tc] = { version: 1, data };
}

mkdirSync(dirname(args.out), { recursive: true });
writeFileSync(args.out, JSON.stringify(out, null, 2));
for (const w of warnings) console.warn(`warning: ${w}`);
console.log(
  `Wrote ${args.out}: ${Object.keys(out.testCases).length} test cases, ${Object.keys(out.dataSets).length} data sets, ` +
    `dataMode ${args.mode}, environment ${args.env}.`,
);