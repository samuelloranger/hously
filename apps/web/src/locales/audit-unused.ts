/**
 * Translation key audit script.
 * Run from apps/web/:
 *
 *   bun src/locales/audit-unused.ts          # report only
 *   bun src/locales/audit-unused.ts --fix    # remove unused keys from locale files
 */

import fs from "fs";
import path from "path";

const ROOT = process.cwd(); // apps/web
const SRC = path.join(ROOT, "src");
const LOCALES_DIR = path.join(SRC, "locales");
const FIX = process.argv.includes("--fix");

// ---------------------------------------------------------------------------
// 1. Flatten / unflatten helpers
// ---------------------------------------------------------------------------
type NestedRecord = { [k: string]: string | NestedRecord };

function flatten(obj: NestedRecord, prefix = ""): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === "object") {
      Object.assign(result, flatten(v as NestedRecord, key));
    } else {
      result[key] = v as string;
    }
  }
  return result;
}

function unflatten(flat: Record<string, string>): NestedRecord {
  const result: NestedRecord = {};
  for (const [dotKey, value] of Object.entries(flat)) {
    const parts = dotKey.split(".");
    let cursor = result;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!(parts[i] in cursor)) cursor[parts[i]] = {};
      cursor = cursor[parts[i]] as NestedRecord;
    }
    cursor[parts[parts.length - 1]] = value;
  }
  return result;
}

// ---------------------------------------------------------------------------
// 2. Collect referenced translation keys from source files
//
//    Three strategies:
//    (a) t("foo.bar") / t('foo.bar')   — direct literal call
//    (b) t(`prefix.${...}`)            — template literal → captures prefix
//    (c) i18nKey="foo.bar"             — Trans component prop
// ---------------------------------------------------------------------------
const sourceGlob = new Bun.Glob("**/*.{ts,tsx}");
const sourceFiles = [
  ...sourceGlob.scanSync({ cwd: SRC, absolute: true, followSymlinks: false }),
].filter((f) => !f.includes("/locales/") && !f.endsWith(".d.ts"));

const literalKeys = new Set<string>();
const dynamicPrefixes = new Set<string>();

// (a) direct t() call with a string literal
const LITERAL_RE = /\bt\(\s*["']([a-zA-Z0-9][\w.]+)["']/g;
// (b) template literal: t(`prefix.${...}`)
const DYNAMIC_RE = /\bt\(`([a-zA-Z0-9][\w.]*)\$\{/g;
// (c) i18nKey prop for Trans component usage
const I18N_KEY_RE = /\bi18nKey=["']([a-zA-Z0-9][\w.]+)["']/g;

for (const file of sourceFiles) {
  const src = fs.readFileSync(file, "utf8");
  for (const m of src.matchAll(LITERAL_RE)) literalKeys.add(m[1]);
  for (const m of src.matchAll(DYNAMIC_RE)) dynamicPrefixes.add(m[1]);
  for (const m of src.matchAll(I18N_KEY_RE)) literalKeys.add(m[1]);
}

// ---------------------------------------------------------------------------
// 3. Load locale files
// ---------------------------------------------------------------------------
const localeGlob = new Bun.Glob("*/common.json");
const localeFiles = [
  ...localeGlob.scanSync({ cwd: LOCALES_DIR, absolute: true }),
].sort();

if (localeFiles.length === 0) {
  console.error(`No locale files found in ${LOCALES_DIR}`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// 4. Decide if a flat key is "used"
// ---------------------------------------------------------------------------
function isUsed(key: string): boolean {
  if (literalKeys.has(key)) return true;
  // i18next plural suffixes (both v4+ _one/_other and legacy _plural)
  const base = key.replace(/_(one|other|zero|two|few|many|plural)$/, "");
  if (base !== key && literalKeys.has(base)) return true;
  // Dynamic template literal prefix
  for (const prefix of dynamicPrefixes) {
    if (key.startsWith(prefix)) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// 5. Report & optionally fix each locale file
// ---------------------------------------------------------------------------
let totalRemoved = 0;

for (const localeFile of localeFiles) {
  const lang = path.basename(path.dirname(localeFile));
  const raw = JSON.parse(fs.readFileSync(localeFile, "utf8")) as NestedRecord;
  const flat = flatten(raw);

  const allKeys = Object.keys(flat);
  const unusedKeys = allKeys.filter((k) => !isUsed(k));
  const usedFlat = Object.fromEntries(
    Object.entries(flat).filter(([k]) => isUsed(k))
  );

  console.log(`\n=== ${lang.toUpperCase()} ===`);
  console.log(`  Total : ${allKeys.length}`);
  console.log(`  Used  : ${Object.keys(usedFlat).length}`);
  console.log(`  Unused: ${unusedKeys.length}`);

  if (unusedKeys.length > 0) {
    console.log("\n  Unused keys:");
    for (const k of unusedKeys) console.log(`    - ${k}`);
  }

  if (FIX && unusedKeys.length > 0) {
    const cleaned = unflatten(usedFlat);
    fs.writeFileSync(
      localeFile,
      JSON.stringify(cleaned, null, 2) + "\n",
      "utf8"
    );
    console.log(`\n  Removed ${unusedKeys.length} keys.`);
    totalRemoved += unusedKeys.length;
  }
}

console.log(
  FIX
    ? `\nDone. Total keys removed: ${totalRemoved}`
    : "\nRun with --fix to remove unused keys."
);
