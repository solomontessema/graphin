// Renders icon.html to the PNG sizes Chrome needs. It needs puppeteer-core and the Chrome installed on this computer.
// Give it the folder that holds icon.html, for example:
//   node make-icons.mjs C:/xampp/htdocs/Graphin/extension/icons
import puppeteer from 'puppeteer-core';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const here = path.resolve(process.argv[2] ?? '.');
const page = pathToFileURL(path.join(here, 'icon.html')).href;
const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
  args: ['--no-sandbox'],
});
const tab = await browser.newPage();
for (const size of [16, 48, 128]) {
  await tab.setViewport({ width: size, height: size, deviceScaleFactor: 1 });
  await tab.goto(page, { waitUntil: 'load' });
  await tab.screenshot({ path: path.join(here, `icon${size}.png`), omitBackground: true });
  console.log('wrote', `icon${size}.png`);
}
await browser.close();
