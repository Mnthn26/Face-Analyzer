# Get your public Deskwise website

The published homepage is the **live-camera desk assistant**, not the original driver dashboard. Demo is optional. No API key, backend, database, or paid AI service is required. The site needs HTTPS for webcam access away from localhost.

## Quickest: upload the prepared website

1. Download `deskwise-website.zip` provided in Arena and **extract it**.
2. Sign into your own Netlify account at https://app.netlify.com/.
3. Open https://app.netlify.com/drop (or choose **Add new project → Deploy manually**).
4. Drag the extracted folder containing **index.html** into the upload area. Upload the built website, not the GitHub repository.
5. Netlify will show your HTTPS `*.netlify.app` URL after publishing. Open that URL directly, outside an iframe.
6. Choose **Start camera**, allow permission, then **Test alarm** at a comfortable volume.

You do not need VS Code or a local server once the website is published. You can rename the site or add a domain in your hosting dashboard. Availability, free-tier limits, and account requirements are controlled by the provider.

The archive is a snapshot: to publish later changes, regenerate the site and upload it again, or use Git integration below. Never upload `.git`, environment files, or the whole repository to a static host.

## Automatic updates from this private GitHub repository

### Netlify

1. In Netlify, add/import an existing project from GitHub.
2. Authorize Netlify through GitHub's own interface for `Mnthn26/Face-Analyzer`. Keep the repository private.
3. Select branch **arena/01a0e1c6-face-analyzer** as the branch to deploy, **not main**.
4. Build command: `node scripts/build-site.mjs`.
5. Publish directory: `site`.
6. Deploy. `netlify.toml` contains these settings for automatic detection.

Future pushes to this branch will rebuild the website when the Git integration is configured.

### Vercel

Import the same GitHub repository, authorize access, use the **Other** framework preset, and set the production branch to **arena/01a0e1c6-face-analyzer** in project Git settings. Deploy/redeploy that branch. The included `vercel.json` selects build command `node scripts/build-site.mjs` and output directory `site`. If the first import built `main`, change the branch and redeploy before testing.

Do not share passwords, tokens, or authentication codes in chat. Hosting authorization happens on your own provider's site.

## Build or inspect locally

```bash
# Node.js 20+; no package install required for this static build
node scripts/build-site.mjs

# Serve the production website locally (Python 3)
python -m http.server 8000 --directory site
```

Visit http://localhost:8000. Alternatively, `npm ci && npm run build && npm run preview` serves the production output with Vite. `npm run build:driver` retains the original React driver's build in `dist/`.

## Deployment checks

- The root URL shows **deskwise** and a **Start camera** button.
- HTTPS is active, camera permission is granted, and no browser extension blocks jsDelivr or Google Cloud Storage.
- The vision model downloads successfully; camera frames remain in the browser.
- Test alarm works with device sound enabled. Verify intentional eye closure while seated, then verify reopening clears the warning.
- End session releases the camera (browser camera indicator turns off).
- Test the device/browser you actually intend to use. Hidden tabs may be throttled or suspended; there is no guaranteed background alarm.

## Current publishing status

The website and provider configuration are ready, but **an enduring public deployment has not been created from Arena**. The connected GitHub integration returned HTTP 403 for Pages configuration, and this workspace has no authorized Netlify/Vercel account. Your repository has not been made public and no hosting charges have been authorized. Completing the account-side upload/import above is necessary to obtain your public URL.
