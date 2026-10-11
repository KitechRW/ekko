# EKKO interactive design preview (GitHub Pages)

This branch hosts **UI demonstration only**, separate from the live Node.js application.

- Public preview: \`https://kitechrw.github.io/ekko/\`
- Studio/login preview: \`https://kitechrw.github.io/ekko/studio.html\`
- Sample states: Upcoming, Live, Ended (choose in the preview bar).
- Studio actions: Explore Studio (no actual password), review and approve demo events, remove them, and change simulated states.
- Data is sample-only and saved to browser localStorage; reload to see your last chosen state.
- No live video is streamed. The LIVE screen uses simulated artwork.
- YouTube discovery, WebSub push callbacks, server authentication, and real deployment remain in the Node.js feature branch; GitHub Pages cannot execute them.

## One-time enablement (repo owner)

In \`KitechRW/ekko\` → **Settings → Pages → Build and deployment**, select **Deploy from a branch**, branch **gh-pages** and folder **/(root)**, then **Save**. Wait for GitHub to finish publishing. The link above works only after Pages is enabled and the deployment succeeds.

This is a publicly accessible static preview. Do not enter real administrator credentials in the preview.
