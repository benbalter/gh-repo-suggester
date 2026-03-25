# gh-repo-suggester

A `gh` CLI extension that recommends repositories to watch within a GitHub organization, powered by [GitHub Models](https://github.com/marketplace/models).

It looks at your watched repos to understand your interests, then picks the best matches from an org's repo catalog using AI — and suggests the most appropriate **watching type** for each (All Activity, Releases Only, Discussions, etc.).

## Install

```
gh extension install benbalter/gh-repo-suggester
```

Requires [`jq`](https://jqlang.github.io/jq/download/).

## Usage

```
gh repo-suggester <org> [flags]
```

### Flags

| Flag                 | Default              | Description                                          |
| -------------------- | -------------------- | ---------------------------------------------------- |
| `-n`, `--count <N>`  | `5`                  | Number of repos to recommend                         |
| `-m`, `--model <ID>` | `openai/gpt-4o-mini` | [GitHub Models](https://github.com/marketplace/models) model ID |
| `-t`, `--topic <T>`  |                      | Filter candidate repos by topic                      |
| `-h`, `--help`       |                      | Show help                                            |

### Examples

```bash
# Recommend 5 repos from the "github" org
gh repo-suggester github

# Get 10 recommendations filtered to API-related repos
gh repo-suggester my-org --count 10 --topic api

# Use a different model
gh repo-suggester my-org --model openai/gpt-4o
```

## How it works

1. Fetches your watched repos (up to 100) via `gh api` — **no PAT needed**, uses your existing `gh` auth
2. Lists repos in the target org (excluding ones you already watch and archived repos)
3. Sends both lists to a GitHub Models LLM along with each repo's metadata (language, topics, whether discussions/issues are enabled, stars)
4. Returns ranked recommendations, each with a **suggested watch type**:
   - **All Activity** — for repos closely aligned with your core work
   - **Issues and Pull Requests** — for repos you might contribute to
   - **Releases Only** — for libraries or tools you depend on
   - **Discussions** — for repos with active community conversations
   - **Security Alerts** — for dependencies or security-sensitive repos

## Auth

Uses your existing `gh auth` token — no extra secrets or PATs required. Just make sure you're logged in:

```
gh auth status
```

## License

MIT
