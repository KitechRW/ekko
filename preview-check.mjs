import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
const root=process.cwd();
const read=p=>readFileSync(join(root,p),"utf8");
const viewer=read("index.html");
const studio=read("studio.html");
const viewScript=read("preview-viewer.js");
const adminScript=read("preview-studio.js");
const adapter=read("preview-api.js");
const styles=read("preview.css");
for (const [name,html] of [["viewer",viewer],["studio",studio]]) {
  assert.match(html,/<html lang="en">/);
  assert.match(html,/DESIGN PREVIEW/);
  assert.match(html,/data-preview-state="scheduled"/);
  assert.match(html,/data-preview-state="live"/);
  assert.match(html,/data-preview-state="ended"/);
  assert.match(html,/src="\.\/preview-api\.js"/);
  assert.match(html,/href="\.\/preview\.css"/);
  for (const [,resource] of html.matchAll(/(?:src|href)="(\.\/[^"#?]+)"/g)) {
    if(resource.endsWith(".html") || resource.endsWith(".js") ||
      resource.endsWith(".css") || resource.endsWith(".svg") ||
      resource.endsWith(".png") || resource.endsWith(".webmanifest")) {
      assert.ok(existsSync(join(root,resource)),name+" missing "+resource);
    }
  }
  assert.doesNotMatch(html,/(?:src|href)="\/[^"]+"/,"Avoid origin-absolute assets on project Pages.");
}
assert.match(viewer,/preview-viewer\.js/);
assert.match(studio,/preview-studio\.js/);
assert.match(studio,/no real password needed|no password needed/);
assert.match(viewScript,/preview-playback/);
assert.doesNotMatch(viewScript,/navigator\.serviceWorker\.register\("\/sw\.js"\)/);
assert.match(adminScript,/\/api\/admin\/approve/);
assert.match(adapter,/window\.fetch=async/);
assert.match(adapter,/localStorage/);
assert.match(adapter,/Only|sample|simulat/i);
assert.match(styles,/body\.preview-page\.cinema-mode \.preview-bar/);
const manifest=JSON.parse(read("preview.webmanifest"));
assert.equal(manifest.display,"standalone");
assert.equal(manifest.start_url,"./");
assert.ok(manifest.icons.some(i=>i.sizes==="192x192"));
assert.ok(manifest.icons.some(i=>i.sizes==="512x512"));
console.log("EKKO GitHub Pages interactive preview smoke checks passed");
