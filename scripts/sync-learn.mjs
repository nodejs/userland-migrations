/**
 * Syncs recipe READMEs from this repo into nodejs/learn.
 *
 * Expected workspace layout (set up by refresh-learn.yml):
 *   $GITHUB_WORKSPACE/              ← nodejs/learn checkout (workspace root)
 *     pages/userland-migrations/    ← written by this script
 *     site.json                     ← updated by this script
 *   $GITHUB_WORKSPACE/source/       ← this repo (userland-migrations)
 *     scripts/sync-learn.mjs        ← this file
 *     recipes/{name}/README.md      ← read by this script
 *
 * Run from workspace root:
 *   node source/scripts/sync-learn.mjs
 */

import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = process.cwd();

const RECIPES_DIR = resolve(__dirname, "../recipes");
const OUTPUT_DIR = resolve(workspaceRoot, "pages", "userland-migrations");
const SITE_JSON = resolve(workspaceRoot, "site.json");
const SIDEBAR_GROUP_NAME = "Userland Migrations";

/**
 * Extracts the first H1 heading from a Markdown file,
 * skipping the YAML frontmatter block if present.
 */
function extractTitle(content, fallback) {
  const lines = content.split("\n");
  let inFrontmatter = false;
  let frontmatterDone = false;

  for (const line of lines) {
    if (!frontmatterDone) {
      if (line.trim() === "---") {
        if (!inFrontmatter) {
          inFrontmatter = true;
          continue;
        }
          frontmatterDone = true;
          continue;
      }
      if (inFrontmatter) continue;
    }

    const match = line.match(/^#\s+(.+)$/);
    if (match) return match[1].trim();
  }

  return fallback;
}

// 1. Collect recipes
const entries = await readdir(RECIPES_DIR, { withFileTypes: true });
const recipes = entries
  .filter((e) => e.isDirectory())
  .map((e) => e.name)
  .sort();

// 2. Create output directory
await mkdir(OUTPUT_DIR, { recursive: true });

// 3. Copy READMEs and collect sidebar items
const sidebarItems = [];

for (const name of recipes) {
  const readmePath = join(RECIPES_DIR, name, "README.md");
  if (!existsSync(readmePath)) {
    console.warn(`Skipping ${name}: no README.md found`);
    continue;
  }

  const content = await readFile(readmePath, "utf8");
  const title = extractTitle(content, name);

  await writeFile(join(OUTPUT_DIR, `${name}.md`), content, "utf8");

  sidebarItems.push({
    link: `/learn/userland-migrations/${name}`,
    label: title,
  });

  console.log(`  ✓ ${name} → "${title}"`);
}

console.log(`\nCopied ${sidebarItems.length} pages to pages/userland-migrations/`);

// 4. Update site.json sidebar
const siteJson = JSON.parse(await readFile(SITE_JSON, "utf8"));

const existingGroupIndex = siteJson.sidebar.findIndex(
  (group) => group.groupName === SIDEBAR_GROUP_NAME,
);

const newGroup = {
  groupName: SIDEBAR_GROUP_NAME,
  items: sidebarItems,
};

if (existingGroupIndex !== -1) {
  siteJson.sidebar[existingGroupIndex] = newGroup;
  console.log(`Updated existing "${SIDEBAR_GROUP_NAME}" group in site.json`);
} else {
  siteJson.sidebar.push(newGroup);
  console.log(`Added new "${SIDEBAR_GROUP_NAME}" group to site.json`);
}

await writeFile(SITE_JSON, `${JSON.stringify(siteJson, null, 2)}\n`, "utf8");
console.log("site.json updated.");
