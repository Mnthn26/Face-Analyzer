# Publish Deskwise using GitHub only

Normal use will be through your HTTPS website. You will not need Netlify, Vercel, VS Code, or a local server. GitHub hosts the files, while camera analysis runs in the visitor's browser. Initial model/runtime assets still download from jsDelivr and Google Cloud Storage; you do not need accounts with either provider.

## One-time repository-owner setup

The repository must be public before GitHub Pages can publish it. If it is still private, open **Settings → Danger Zone → Change repository visibility → Public**, review GitHub's warnings, and confirm. Public visibility exposes all committed content/history; do not publish secrets. A limited automated history scan found no obvious private keys or recognized token patterns, but this is not a comprehensive secret audit.

1. Open https://github.com/Mnthn26/Face-Analyzer/settings/pages.
2. Under **Build and deployment → Source**, select **GitHub Actions**. Do not select `main` as a branch publishing source—the website is built by the workflow on `main`.
3. Open https://github.com/Mnthn26/Face-Analyzer/actions and locate **Publish Deskwise website**. If its initial run failed before Pages was enabled, choose **Re-run all jobs** on that run. If no run exists, push a commit to `main` to trigger it. Workflow dispatch is also provided, but GitHub may not list its manual button until a workflow exists on the default branch.
4. If the deploy job says the environment disallows the branch, open **Settings → Environments → github-pages**, and permit **`main`** under deployment branch rules. Do not change unrelated environment protections.
5. Wait for **Test and build static website** and **Publish to GitHub Pages** to succeed. The deployment job shows the actual public URL.

Expected default URL **after successful deployment**:

**https://mnthn26.github.io/Face-Analyzer/**

This is an expected URL, not a claim that it is already live. A custom domain can be configured later through GitHub Pages. It is not required.

## Architecture and operational protections

- `.github/workflows/pages.yml` runs on pushes to `main`; deployment is also guarded to that branch. Competing Jekyll and raw-static workflows have been removed so they cannot overwrite the Deskwise site.
- Build/test job has only read access to repository contents. Deploy job has `pages: write` and `id-token: write`, using GitHub's short-lived workflow identity rather than stored credentials.
- No package installation is needed for the Node.js algorithm tests or static build. Tests must pass before deployment.
- A concurrency group prevents overlapping deployment jobs. An active deploy is not canceled midway by a newer push.
- `scripts/build-site.mjs` cleans only the fixed generated `site/` directory and copies the standalone website (including the favicon), never the repository, tests, credentials, or `.git`.
- `DESKWISE_BASE_PATH=/Face-Analyzer/` handles GitHub's project URL prefix. The prefix is validated against external URLs, path traversal, and HTML injection before insertion into the generated error page.
- HTML/CSS/JavaScript remain a standalone application. Session information lives in memory. Camera frames are not uploaded.
- GitHub Pages does not apply Netlify `_headers` rules. Those remain for optional alternate hosting, but are not claimed as active response headers on Pages.

## Verification

1. Visit the deployment URL directly in Chrome/Edge (not an iframe). Confirm **deskwise** and **Start camera** appear at the root of the project path.
2. Confirm the Deskwise favicon loads (green "D" mark on a dark rounded square).
3. Grant camera permission, wait for the model to load, and confirm real tracking rather than a DEMO label.
4. Test alarm at a comfortable device volume. Verify intentional prolonged closure while seated and that reopening clears the warning.
5. End the session and confirm the browser camera indicator turns off.
6. Try a nonexistent page under `/Face-Analyzer/`; its home link should return to the assistant.

Background monitoring remains best-effort: browsers can suspend hidden tabs and prevent new alarms. Public hosting does not remove that limitation. Real webcam/audio behavior and deployment success still require verification on the actual browser/host.

## Local development (optional, not needed to use the public website)

```bash
npm test
# GitHub project path; omit the environment variable for hosting at /
DESKWISE_BASE_PATH=/Face-Analyzer/ node scripts/build-site.mjs
```

The Pages workflow handles these commands automatically. For local root hosting use `node scripts/build-site.mjs`, then `python -m http.server 8000 --directory site` and open http://localhost:8000.

The existing Netlify/Vercel configuration is retained only as an optional alternative; neither is required for this GitHub-only path.
