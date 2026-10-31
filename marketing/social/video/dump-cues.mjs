// node dump-cues.mjs page.html cues.json: writes the sound cues and word anchors the film itself declares (window.CUES, window.T)
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const [, , html, out] = process.argv;
const b = await chromium.launch({ args: ['--allow-file-access-from-files'] });
const p = await b.newPage();
await p.goto(pathToFileURL(path.resolve(html)).href + '?render');
await p.waitForFunction(() => window.CUES);
writeFileSync(out, JSON.stringify(await p.evaluate(() => ({ cues: window.CUES, T: window.T, duration: window.VIDEO.duration })), null, 1));
await b.close();
