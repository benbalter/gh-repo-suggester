const core = require("@actions/core");
const github = require("@actions/github");
const OpenAI = require("openai");

const MODELS_ENDPOINT = "https://models.github.ai/inference";
const MAX_STARRED = 100;
const MAX_CANDIDATES = 200;

async function getStarredRepos(octokit) {
  const repos = await octokit.paginate(
    octokit.rest.activity.listReposStarredByAuthenticatedUser,
    { per_page: 100, sort: "created", direction: "desc", headers: { accept: "application/vnd.github.v3+json" } },
    (response, done) => {
      if (response.data.length >= MAX_STARRED) done();
      return response.data;
    },
  );
  return repos.slice(0, MAX_STARRED);
}

async function getOrgRepos(octokit, org, topic) {
  const repos = await octokit.paginate(
    octokit.rest.repos.listForOrg,
    { org, per_page: 100, sort: "updated", direction: "desc" },
  );

  if (topic) {
    return repos.filter((r) =>
      r.topics && r.topics.some((t) => t.toLowerCase().includes(topic.toLowerCase())),
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
  };
}

function buildPrompt(starred, candidates, org, count) {
  const starredSummary = starred
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
        `- **${r.name}** (${r.language}, ★${r.stars}): ${r.description} [topics: ${r.topics}]`,
    )
    .join("\n");

  return `You recommend GitHub repositories. Given the user's starred repos (their interests), pick the ${count} best repos from the "${org}" organization.

## User's starred repos:
${starredSummary}

## Candidate repos in ${org}:
${candidateSummary}

Return EXACTLY ${count} recommendations (or fewer if there aren't enough good matches).
For each, output this format:

### <number>. <org>/<repo-name>

<One-sentence reason tied to specific starred repos or interests>

Do NOT recommend repos the user already starred. Be specific about *why* each repo matches.`;
}

async function run() {
  const token = core.getInput("token", { required: true });
  const org = core.getInput("org", { required: true });
  const model = core.getInput("model") || "openai/gpt-4o-mini";
  const count = parseInt(core.getInput("count") || "5", 10);
  const topic = core.getInput("topic") || "";

  const octokit = github.getOctokit(token);

  core.info("Fetching your starred repos…");
  const starred = await getStarredRepos(octokit);
  core.info(`Found ${starred.length} starred repos`);

  core.info(`Fetching repos in ${org}…`);
  let orgRepos = await getOrgRepos(octokit, org, topic);
  core.info(`Found ${orgRepos.length} repos in ${org}`);

  const starredNames = new Set(starred.map((r) => r.full_name));
  const candidates = orgRepos
    .filter((r) => !starredNames.has(r.full_name) && !r.archived)
    .slice(0, MAX_CANDIDATES);

  if (candidates.length === 0) {
    const msg =
      "No unstarred repos found in the org — you've already starred them all! 🎉";
    core.info(msg);
    core.setOutput("recommendations", msg);
    await core.summary.addHeading("Repo Suggester").addRaw(msg).write();
    return;
  }

  core.info(
    `Asking ${model} to pick ${count} recommendations from ${candidates.length} candidates…`,
  );
  const prompt = buildPrompt(starred, candidates, org, count);

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
    .addHeading("⭐ Repo Suggester")
    .addRaw(
      `Based on your **${starred.length}** starred repos, here are repos in **${org}** you might like:\n\n`,
    )
    .addRaw(recommendations)
    .write();

  core.info("\n" + recommendations);
}

run().catch((err) => core.setFailed(err.message));
