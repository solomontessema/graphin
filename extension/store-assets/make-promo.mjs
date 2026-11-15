// Renders promo-small.html to the 440x280 PNG the Chrome Web Store asks for. It needs puppeteer-core and the Chrome
// installed on this computer. Give it the folder that holds promo-small.html, for example:
//   node make-promo.mjs C:/xampp/htdocs/Graphin/extension/store-assets
import puppeteer from 'puppeteer-core';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const here = path.resolve(process.argv[2] ?? '.');
const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
  args: ['--no-sandbox'],
});
const tab = await browser.newPage();
await tab.setViewport({ width: 440, height: 280, deviceScaleFactor: 1 });
await tab.goto(pathToFileURL(path.join(here, 'promo-small.html')).href, { waitUntil: 'load' });
await tab.screenshot({ path: path.join(here, 'promo-small.png') });
console.log('wrote promo-small.png');
await browser.close();
