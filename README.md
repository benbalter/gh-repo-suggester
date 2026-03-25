# Repo Suggester

A GitHub Action that recommends repositories to follow within an organization, powered by [GitHub Models](https://github.com/marketplace/models).

It looks at your starred repos to understand your interests, then picks the best matches from an org's repo catalog using AI.

## Usage

```yaml
- uses: benbalter/repo-suggester@main
  with:
    org: my-org
    token: ${{ secrets.MODELS_PAT }}
```

## Inputs

| Input   | Required | Default              | Description                                          |
| ------- | -------- | -------------------- | ---------------------------------------------------- |
| `org`   | ✅       |                      | GitHub organization to recommend repos from          |
| `token` | ✅       |                      | PAT with `read:org`, `read:user` + Models access     |
| `model` |          | `openai/gpt-4o-mini` | [GitHub Models](https://github.com/marketplace/models) model ID |
| `count` |          | `5`                  | Number of repos to recommend                         |
| `topic` |          |                      | Optional topic filter to narrow candidate repos      |

## Outputs

| Output            | Description                          |
| ----------------- | ------------------------------------ |
| `recommendations` | Markdown-formatted recommendations   |

## How it works

1. Fetches your most recent starred repos (up to 100) as interest signals
2. Lists repos in the target org (excluding ones you already starred and archived repos)
3. Sends both lists to a GitHub Models LLM
4. Returns ranked recommendations with explanations tied to your interests

Results appear in the **Actions job summary** and are available via the `recommendations` output.

## Token setup

The default `GITHUB_TOKEN` doesn't have GitHub Models access. Create a **fine-grained PAT** with:

- **Read** access to your starred repos
- **Read** access to the target org's repos
- **GitHub Models** access (enabled automatically for PATs in orgs with Models enabled)

Store it as a repository secret (e.g., `MODELS_PAT`).

## Example: weekly digest

```yaml
name: Suggest repos
on:
  schedule:
    - cron: '0 9 * * 1'

jobs:
  suggest:
    runs-on: ubuntu-latest
    steps:
      - uses: benbalter/repo-suggester@main
        id: suggest
        with:
          org: my-org
          token: ${{ secrets.MODELS_PAT }}
          count: 10

      - run: echo "${{ steps.suggest.outputs.recommendations }}"
```

## License

MIT
