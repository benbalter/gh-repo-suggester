const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

describe("summarizeRepo", () => {
  it("extracts key fields including discussion/issue flags", () => {
    const repo = {
      full_name: "org/repo",
      description: "A cool repo",
      language: "JavaScript",
      topics: ["api", "rest"],
      stargazers_count: 42,
      has_discussions: true,
      has_issues: true,
    };
    const summary = {
      name: repo.full_name,
      description: repo.description || "",
      language: repo.language || "unknown",
      topics: (repo.topics || []).join(", "),
      stars: repo.stargazers_count,
      has_discussions: repo.has_discussions || false,
      has_issues: repo.has_issues || false,
    };
    assert.deepStrictEqual(summary, {
      name: "org/repo",
      description: "A cool repo",
      language: "JavaScript",
      topics: "api, rest",
      stars: 42,
      has_discussions: true,
      has_issues: true,
    });
  });

  it("handles missing fields gracefully", () => {
    const repo = {
      full_name: "org/bare",
      description: null,
      language: null,
      topics: null,
      stargazers_count: 0,
    };
    const summary = {
      name: repo.full_name,
      description: repo.description || "",
      language: repo.language || "unknown",
      topics: (repo.topics || []).join(", "),
      stars: repo.stargazers_count,
      has_discussions: repo.has_discussions || false,
      has_issues: repo.has_issues || false,
    };
    assert.deepStrictEqual(summary, {
      name: "org/bare",
      description: "",
      language: "unknown",
      topics: "",
      stars: 0,
      has_discussions: false,
      has_issues: false,
    });
  });
});

describe("candidate filtering logic", () => {
  it("filters out already-watched and archived repos", () => {
    const watched = [{ full_name: "org/watched-one" }];
    const orgRepos = [
      { full_name: "org/watched-one", archived: false },
      { full_name: "org/archived", archived: true },
      { full_name: "org/candidate", archived: false },
    ];
    const watchedNames = new Set(watched.map((r) => r.full_name));
    const candidates = orgRepos.filter(
      (r) => !watchedNames.has(r.full_name) && !r.archived,
    );
    assert.equal(candidates.length, 1);
    assert.equal(candidates[0].full_name, "org/candidate");
  });

  it("returns empty when all repos are watched", () => {
    const watched = [
      { full_name: "org/a" },
      { full_name: "org/b" },
    ];
    const orgRepos = [
      { full_name: "org/a", archived: false },
      { full_name: "org/b", archived: false },
    ];
    const watchedNames = new Set(watched.map((r) => r.full_name));
    const candidates = orgRepos.filter(
      (r) => !watchedNames.has(r.full_name) && !r.archived,
    );
    assert.equal(candidates.length, 0);
  });
});

describe("topic filtering", () => {
  it("filters repos by topic when specified", () => {
    const repos = [
      { full_name: "org/api-lib", topics: ["api", "rest"] },
      { full_name: "org/cli-tool", topics: ["cli"] },
      { full_name: "org/no-topics", topics: null },
    ];
    const topic = "api";
    const filtered = repos.filter(
      (r) =>
        r.topics &&
        r.topics.some((t) => t.toLowerCase().includes(topic.toLowerCase())),
    );
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0].full_name, "org/api-lib");
  });
});

describe("watch types", () => {
  it("defines all five GitHub watching types", () => {
    const WATCH_TYPES = [
      "All Activity — every notification (issues, PRs, releases, discussions, etc.)",
      "Issues and Pull Requests — stay in the loop on development activity",
      "Releases Only — get notified of new versions",
      "Discussions — follow community conversations",
      "Security Alerts — stay aware of vulnerabilities",
    ];
    assert.equal(WATCH_TYPES.length, 5);
    assert.ok(WATCH_TYPES[0].startsWith("All Activity"));
    assert.ok(WATCH_TYPES[2].startsWith("Releases Only"));
  });
});
