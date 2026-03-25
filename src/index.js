const core = require("@actions/core");
const github = require("@actions/github");
const OpenAI = require("openai");

const MODELS_ENDPOINT = "https://models.github.ai/inference";
const MAX_WATCHED = 100;
const MAX_CANDIDATES = 200;

const WATCH_TYPES = [
  "All Activity — every notification (issues, PRs, releases, discussions, etc.)",
  "Issues and Pull Requests — stay in the loop on development activity",
  "Releases Only — get notified of new versions",
  "Discussions — follow community conversations",
  "Security Alerts — stay aware of vulnerabilities",
];

async function getWatchedRepos(octokit) {
  const repos = await octokit.paginate(
    octokit.rest.activity.listWatchedReposForAuthenticatedUser,
    { per_page: 100 },
    (response, done) => {
      if (response.data.length >= MAX_WATCHED) done();
      return response.data;
    },
  );
  return repos.slice(0, MAX_WATCHED);
}

async function getOrgRepos(octokit, org, topic) {
  const repos = await octokit.paginate(
    octokit.rest.repos.listForOrg,
    { org, per_page: 100, sort: "updated", direction: "desc" },
  );

  if (topic) {
    return repos.filter(
      (r) =>
        r.topics &&
        r.topics.some((t) =>
          t.toLowerCase().includes(topic.toLowerCase()),
        ),
    );
  }
  return repos;
}

function summarizeRepo(repo) {
  return {
    name: repo.full_name,
    description: repo.description || "",
    language: repo.language || "unknown",
    topics: (repo.topics || []).join(", "),
    stars: repo.stargazers_count,
    has_discussions: repo.has_discussions || false,
    has_issues: repo.has_issues || false,
  };
}

function buildPrompt(watched, candidates, org, count) {
  const watchedSummary = watched
    .map(summarizeRepo)
    .map(
      (r) =>
        `- **${r.name}** (${r.language}): ${r.description} [topics: ${r.topics}]`,
    )
    .join("\n");

  const candidateSummary = candidates
    .map(summarizeRepo)
    .map(
      (r) =>
        `- **${r.name}** (${r.language}, ★${r.stars}): ${r.description} [topics: ${r.topics}, discussions: ${r.has_discussions}, issues: ${r.has_issues}]`,
    )
    .join("\n");

  return `You recommend GitHub repositories to watch. Given the user's currently watched repos (their interests), pick the ${count} best repos from the "${org}" organization for them to watch.

## User's currently watched repos:
${watchedSummary}

## Candidate repos in ${org}:
${candidateSummary}

## GitHub watching types:
${WATCH_TYPES.map((t) => `- ${t}`).join("\n")}

Return EXACTLY ${count} recommendations (or fewer if there aren't enough good matches).
For each, output this format:

### <number>. <org>/<repo-name>

**Suggested watch type:** <one of the watching types above>

<One-sentence reason tied to the user's watched repos or interests, and why the suggested watch type fits>

Choose the watch type based on the repo's characteristics:
- Recommend "Releases Only" for libraries or tools the user likely depends on
- Recommend "Discussions" for repos with discussions enabled that match community interests
- Recommend "Issues and Pull Requests" for repos the user might want to contribute to
- Recommend "Security Alerts" for dependencies or security-sensitive repos
- Recommend "All Activity" only for repos closely aligned with the user's core work

Do NOT recommend repos the user already watches. Be specific about *why* each repo matches.`;
}

async function run() {
  const token = core.getInput("token", { required: true });
  const org = core.getInput("org", { required: true });
  const model = core.getInput("model") || "openai/gpt-4o-mini";
  const count = parseInt(core.getInput("count") || "5", 10);
  const topic = core.getInput("topic") || "";

  const octokit = github.getOctokit(token);

  core.info("Fetching your watched repos…");
  const watched = await getWatchedRepos(octokit);
  core.info(`Found ${watched.length} watched repos`);

  core.info(`Fetching repos in ${org}…`);
  const orgRepos = await getOrgRepos(octokit, org, topic);
  core.info(`Found ${orgRepos.length} repos in ${org}`);

  const watchedNames = new Set(watched.map((r) => r.full_name));
  const candidates = orgRepos
    .filter((r) => !watchedNames.has(r.full_name) && !r.archived)
    .slice(0, MAX_CANDIDATES);

  if (candidates.length === 0) {
    const msg =
      "No unwatched repos found in the org — you're already watching them all! 👀";
    core.info(msg);
    core.setOutput("recommendations", msg);
    await core.summary.addHeading("Repo Suggester").addRaw(msg).write();
    return;
  }

  core.info(
    `Asking ${model} to pick ${count} recommendations from ${candidates.length} candidates…`,
  );
  const prompt = buildPrompt(watched, candidates, org, count);

  const client = new OpenAI({
    baseURL: MODELS_ENDPOINT,
    apiKey: token,
  });

  const response = await client.chat.completions.create({
    model,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.7,
  });

  const recommendations = response.choices[0].message.content;

  core.setOutput("recommendations", recommendations);

  await core.summary
    .addHeading("👀 Repo Suggester")
    .addRaw(
      `Based on your **${watched.length}** watched repos, here are repos in **${org}** you might want to watch:\n\n`,
    )
    .addRaw(recommendations)
    .write();

  core.info("\n" + recommendations);
}

run().catch((err) => core.setFailed(err.message));
