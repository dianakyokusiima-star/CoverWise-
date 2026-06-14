# Push CoverWise™ Extension to GitHub

Your repo: https://github.com/dianakyokusiima-star/CoverWise-

## Step-by-step

Open your terminal and run these commands one at a time:

```bash
# 1. Clone your existing repo
git clone https://github.com/dianakyokusiima-star/CoverWise-.git
cd CoverWise-

# 2. Copy all extension files into the repo
# (drag the contents of coverwise-extension/ into the CoverWise- folder)
# OR if you're on Mac/Linux:
cp -r /path/to/coverwise-extension/* .

# 3. Stage everything
git add .

# 4. Commit
git commit -m "feat: add Chrome extension - popup, sidebar, background worker, AI analysis"

# 5. Push
git push origin main
```

## What gets pushed

- manifest.json       → Extension config (Manifest V3)
- background.js       → AI analysis via Anthropic API + context menus
- content.js          → Sidebar injection into any page
- popup.html          → Main popup UI
- popup.css           → All popup styles
- popup.js            → Full popup logic (5 views)
- sidebar.html        → Floating sidebar for Canva/KDP
- icons/              → icon16.png, icon48.png, icon128.png
- README.md           → Updated with install instructions
