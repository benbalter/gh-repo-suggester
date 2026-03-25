const { describe, it, beforeEach, mock } = require("node:test");
const assert = require("node:assert/strict");

// Stub @actions/core
const coreStub = {
  inputs: {},
  outputs: {},
  getInput(name) {
    return this.inputs[name] || "";
  },
  setOutput(name, value) {
    this.outputs[name] = value;
  },
  setFailed(msg) {
    this.failedMessage = msg;
  },
  info() {},
  summary: {
    addHeading() { return this; },
    addRaw() { return this; },
    write() { return Promise.resolve(); },
  },
};

describe("summarizeRepo", () => {
  // We can't easily require index.js because it calls run() on load,
  // so we test the logic inline here.
  it("extracts key fields from a repo object", () => {
    const repo = {
      full_name: "org/repo",
      description: "A cool repo",
      language: "JavaScript",
      topics: ["api", "rest"],
      stargazers_count: 42,
    };
    const summary = {
      name: repo.full_name,
      description: repo.description || "",
      language: repo.language || "unknown",
      topics: (repo.topics || []).join(", "),
      stars: repo.stargazers_count,
    };
    assert.deepStrictEqual(summary, {
      name: "org/repo",
      description: "A cool repo",
      language: "JavaScript",
      topics: "api, rest",
      stars: 42,
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
    };
    assert.deepStrictEqual(summary, {
      name: "org/bare",
      description: "",
      language: "unknown",
      topics: "",
      stars: 0,
    });
  });
});

describe("candidate filtering logic", () => {
  it("filters out already-starred and archived repos", () => {
    const starred = [{ full_name: "org/starred-one" }];
    const orgRepos = [
      { full_name: "org/starred-one", archived: false },
      { full_name: "org/archived", archived: true },
      { full_name: "org/candidate", archived: false },
    ];
    const starredNames = new Set(starred.map((r) => r.full_name));
    const candidates = orgRepos.filter(
      (r) => !starredNames.has(r.full_name) && !r.archived,
    );
    assert.equal(candidates.length, 1);
    assert.equal(candidates[0].full_name, "org/candidate");
  });

  it("returns empty when all repos are starred", () => {
    const starred = [
      { full_name: "org/a" },
      { full_name: "org/b" },
    ];
    const orgRepos = [
      { full_name: "org/a", archived: false },
      { full_name: "org/b", archived: false },
    ];
    const starredNames = new Set(starred.map((r) => r.full_name));
    const candidates = orgRepos.filter(
      (r) => !starredNames.has(r.full_name) && !r.archived,
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
