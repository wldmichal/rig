---
name: preview-on-pages
description: Publish one rig page as a public preview on GitHub Pages for a reviewer, then take the lane marker off it once the review is in (ADR 0003). Use when a plan has a "preview for review" or "clean up" step.
---

# preview-on-pages

A reviewer reads a static copy of one page, not the lane. This skill puts that copy on GitHub Pages
with the workflow `.github/workflows/preview.yml`, which renders the page in Actions and deploys it
from a build artifact. The page never lands in the repo, so the marker can be taken off again. The
marker comes from the repo secret `LANE_MARKER`, never from a file.

Needs `gh`, signed in to the account that owns the repo, in a shell this agent can run. Every step
that makes something public waits for the human's yes: say what goes up, where, who can see it and
how to undo it.

The link is `https://<owner>.github.io/<repo>/`.

## Publish

1. Render the page locally first, with a command, and look at it (`pnpm dev`, then
   `curl -s localhost:8787<page>`). It must be self-contained: no outside scripts, styles or links.
2. **Ask the human.** Then:

   ```sh
   gh api -X POST repos/<owner>/<repo>/pages -f build_type=workflow   # once per repo
   printf '%s' "<marker>" | gh secret set LANE_MARKER
   gh workflow run preview.yml -f page=<page>
   gh run watch <run id> --exit-status
   ```

3. Fetch the link the way the reviewer will, with no sign-in, and compare it with the local render:
   same page, marker in the banner. Pages can lag a few seconds after the deploy finishes.
4. Send the reviewer the link and the plan's issues.
5. **Leave the preview issue open.** Sent is not seen: it waits on the reviewer's look (AGENTS.md
   rule 5). Say so in the issue. Check back for the review instead of closing early.

## Clean up

Only after the review is in, and after the human's yes:

```sh
gh secret delete LANE_MARKER
gh workflow run preview.yml -f page=<page>
gh run watch <run id> --exit-status
```

1. Fetch the link again: the banner reads "no marker set" and the marker appears nowhere in the page.
2. Delete the first run's artifact, which still holds the marked page until it expires:

   ```sh
   gh api repos/<owner>/<repo>/actions/runs/<first run id>/artifacts --jq '.artifacts[].id'
   gh api -X DELETE repos/<owner>/<repo>/actions/artifacts/<id>
   ```

3. Close the clean-up issue with the closing comment from AGENTS.md.

To take the page down for good: `gh api -X DELETE repos/<owner>/<repo>/pages`.

## Don'ts

- Don't commit the page, put it in an issue or attach it to chat: the marker can't be taken off
  there (ADR 0003).
- Don't serve Pages from a branch: the marked page would stay in git history.
- Don't pass the marker as a workflow input: inputs are visible on the run.
- Don't push over SSH if your SSH key belongs to another account: use HTTPS with `gh`.
