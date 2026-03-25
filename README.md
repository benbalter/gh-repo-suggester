# Repo Suggester

A GitHub Action that recommends repositories to watch within an organization, powered by [GitHub Models](https://github.com/marketplace/models).

It looks at your watched repos to understand your interests, then picks the best matches from an org's repo catalog using AI — and suggests the most appropriate **watching type** for each (All Activity, Releases Only, Discussions, etc.).

## Usage

```yaml
permissions:
  models: read

steps:
  - uses: benbalter/repo-suggester@main
    with:
      org: my-org
```

That's it — uses the built-in `GITHUB_TOKEN` with the `models: read` permission. No PAT needed.

## Inputs

| Input   | Required | Default              | Description                                          |
| ------- | -------- | -------------------- | ---------------------------------------------------- |
| `org`   | ✅       |                      | GitHub organization to recommend repos from          |
| `token` |          | `${{ github.token }}`| GitHub token (default works with `models: read`)     |
| `model` |          | `openai/gpt-4o-mini` | [GitHub Models](https://github.com/marketplace/models) model ID |
| `count` |          | `5`                  | Number of repos to recommend                         |
| `topic` |          |                      | Optional topic filter to narrow candidate repos      |

## Outputs

| Output            | Description                                          |
| ----------------- | ---------------------------------------------------- |
| `recommendations` | Markdown-formatted recommendations with watch types  |

## How it works

1. Fetches your watched repos (up to 100) as interest signals
2. Lists repos in the target org (excluding ones you already watch and archived repos)
3. Sends both lists to a GitHub Models LLM along with each repo's metadata (language, topics, discussions/issues enabled, stars)
4. Returns ranked recommendations, each with a **suggested watch type**:
   - **All Activity** — for repos closely aligned with your core work
   - **Issues and Pull Requests** — for repos you might contribute to
   - **Releases Only** — for libraries or tools you depend on
   - **Discussions** — for repos with active community conversations
   - **Security Alerts** — for dependencies or security-sensitive repos

Results appear in the **Actions job summary** and are available via the `recommendations` output.

## Permissions

Add `models: read` to your workflow permissions — this gives the `GITHUB_TOKEN` access to GitHub Models:

```yaml
permissions:
  models: read
```

No PAT or additional secrets required.

## Example: weekly digest

```yaml
name: Suggest repos
on:
  workflow_dispatch:
  schedule:
    - cron: '0 9 * * 1'

permissions:
  models: read

jobs:
  suggest:
    runs-on: ubuntu-latest
    steps:
      - uses: benbalter/repo-suggester@main
        id: suggest
        with:
          org: my-org
          count: 10

      - run: echo "${{ steps.suggest.outputs.recommendations }}"
```

## License

MIT
