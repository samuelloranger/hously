---
name: pr-review
description: Review a PR like a human — inline comments on lines, review summary, and GitHub issues for major problems
argument-hint: "<PR number>"
---

## Instructions

Perform a **thorough code review** on a GitHub PR — just like a senior developer would. Post inline comments on specific lines, leave a summary review, and create GitHub issues for critical problems.

### Argument parsing

Parse the user's arguments for:

1. **PR number** (required): A plain number identifying the PR to review (e.g. `229`).

Examples:

- `/pr-review 229` → review PR #229

If no PR number is given, show an error: _"A PR number is required. Usage: `/pr-review 229`"_

### 1. Gather context

Fetch PR details and diff:

```bash
gh pr view <number> --json baseRefName,headRefName,title,body,files --jq '.'
```

Then gather the full diff:

```bash
gh pr diff <number> --color=never
```

Read the full diff carefully but do NOT output it to the user.

### 2. Perform code review

Carefully review the full diff. For each file changed, evaluate:

- **Correctness**: Logic errors, off-by-one, null/undefined risks, race conditions
- **Security**: Injection, XSS, secrets in code, insecure patterns (OWASP top 10)
- **Performance**: N+1 queries, unnecessary re-renders, missing indexes, expensive loops
- **Code quality**: Naming, duplication, dead code, overly complex logic
- **Testing**: Missing test coverage for new/changed behavior
- **Breaking changes**: API changes, DB migrations, config changes that affect other systems

Categorize each finding:

- **Inline comment** (default): For anything tied to a specific line — suggestions, questions, nits, warnings
- **GitHub issue**: For critical bugs, security vulnerabilities, or architectural concerns that need tracking beyond the PR

### 3. Post inline review comments

Use the GitHub CLI to submit a **pull request review** with inline comments on specific lines.

For each comment, identify:
- The **file path** (relative to repo root)
- The **line number** in the diff (the line in the new version of the file)
- The **comment body** — be specific, explain why, suggest a fix

Get the `{owner}/{repo}` from:

```bash
gh repo view --json nameWithOwner --jq '.nameWithOwner'
```

Write the review payload to a temp JSON file, then submit via `--input`. **Do NOT use `--field` for the comments array** — `gh` cannot parse nested JSON arrays with `--field`.

```bash
cat > /tmp/pr-review-<number>.json << 'ENDJSON'
{
  "event": "COMMENT",
  "body": "🤖 **Automated code review by Claude Code**\n\n<overall review summary>",
  "comments": [
    {
      "path": "<file>",
      "line": <line>,
      "body": "<comment>"
    }
  ]
}
ENDJSON
gh api repos/{owner}/{repo}/pulls/<number>/reviews --method POST --input /tmp/pr-review-<number>.json
```

**Important**: The `line` number must correspond to a line that exists in the PR diff (the new file version). If a comment targets a line that isn't part of the diff, move it to the review body summary instead. If the API returns `"Line could not be resolved"`, remove the problematic inline comment and include it in the body text instead, then retry.

#### Comment style guide

Write comments like a real reviewer:

- **Be direct**: "This will crash if `user` is null" not "It might be worth considering..."
- **Explain why**: Don't just say what's wrong — say why it matters
- **Suggest fixes**: Include code snippets when helpful (use markdown fenced blocks)
- **Use prefixes** to signal severity:
  - `🔴 CRITICAL:` — Must fix before merge (bugs, security, data loss)
  - `🟡 WARNING:` — Should fix, risky to ignore (perf, edge cases)
  - `🟢 NIT:` — Optional improvement (style, naming, minor cleanup)
  - `💡 SUGGESTION:` — Alternative approach worth considering
  - `❓ QUESTION:` — Need clarification on intent

### 4. Create GitHub issues for critical problems

For any **critical** finding (security vulnerability, data loss risk, architectural problem), create a GitHub issue:

```bash
gh issue create \
  --title "<concise title>" \
  --body "$(cat <<'EOF'
Found during review of PR #<number>.

## Problem

<detailed description>

## Location

`<file>:<line>`

## Suggested fix

<fix or approach>

## References

- PR: #<number>
EOF
)" \
  --label "bug"
```

Only create issues for truly critical findings — not for nits or minor warnings.

### 5. Output

After posting the review, tell the user:

- The review has been posted on PR #<number>
- A count of comments by severity (e.g. "Posted 8 comments: 1 critical, 3 warnings, 4 nits")
- List any GitHub issues created (with issue numbers/URLs)
- Final recommendation: **Approve**, **Approve with nits**, or **Request changes**
- Do NOT output the raw diff or repeat all comments in the conversation

### Rules

- Be thorough but fair — don't nitpick style if a linter/formatter handles it
- Focus on issues that matter: correctness, security, and maintainability
- Flag breaking changes and DB migrations prominently
- If the diff is very large, focus on the most impactful files first
- Never output the raw diff to the user
- Never post empty or generic comments like "looks good" on individual lines — only comment where there's something meaningful to say
- The overall review summary should include positive callouts for well-written code
