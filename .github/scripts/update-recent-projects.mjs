import { readFile, writeFile } from "node:fs/promises";

const API_BASE = "https://api.github.com";
const OWNER = process.env.GITHUB_REPOSITORY_OWNER || process.env.GITHUB_ACTOR;
const TOKEN = process.env.GITHUB_TOKEN;

if (!OWNER) {
  console.error("Missing GITHUB_REPOSITORY_OWNER/GITHUB_ACTOR");
  process.exit(1);
}
if (!TOKEN) {
  console.error("Missing GITHUB_TOKEN");
  process.exit(1);
}

async function gh(path) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "update-recent-projects",
    },
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`GitHub API ${res.status} for ${path}: ${body}`);
  }
  return await res.json();
}

function fmtDate(iso) {
  if (!iso) return "";
  return iso.slice(0, 10);
}

function escapeMd(s) {
  return (s || "").replace(/\r?\n/g, " ").trim();
}

async function main() {
  const readmePath = "README.md";
  const readme = await readFile(readmePath, "utf8");

  const start = "<!--RECENT_PROJECTS:start-->";
  const end = "<!--RECENT_PROJECTS:end-->";
  const startIdx = readme.indexOf(start);
  const endIdx = readme.indexOf(end);
  if (startIdx === -1 || endIdx === -1 || endIdx < startIdx) {
    throw new Error(`Missing markers in ${readmePath}: ${start} / ${end}`);
  }

  // Repos: most recently pushed (not forks, not archived)
  const repos =
    (await gh(`/users/${OWNER}/repos?per_page=100&sort=pushed`)) || [];

  const candidates = repos
    .filter((r) => r && !r.fork && !r.archived)
    .slice(0, 8);

  const lines = [];
  for (const repo of candidates) {
    const name = repo.name;
    const url = repo.html_url;
    const desc = escapeMd(repo.description);
    const lang = repo.language ? ` • ${repo.language}` : "";

    // Latest release (if any)
    const release = await gh(`/repos/${OWNER}/${name}/releases/latest`);
    let releasePart = "";
    if (release && release.tag_name && release.html_url) {
      const tag = escapeMd(release.tag_name);
      const date = fmtDate(release.published_at);
      const datePart = date ? ` (${date})` : "";
      releasePart = ` — latest release: [${tag}](${release.html_url})${datePart}`;
    }

    const descPart = desc ? ` — ${desc}` : "";
    lines.push(`- **[${name}](${url})**${descPart}${lang}${releasePart}`);
  }

  const block =
    lines.length > 0
      ? `${lines.join("\n")}\n`
      : `- (No recent public repositories found.)\n`;

  const before = readme.slice(0, startIdx + start.length);
  const after = readme.slice(endIdx);
  const next = `${before}\n\n${block}${after}`;

  if (next !== readme) {
    await writeFile(readmePath, next, "utf8");
    console.log(`Updated ${readmePath}`);
  } else {
    console.log("No changes.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});


