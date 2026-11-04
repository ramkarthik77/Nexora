import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const css=readFileSync(new URL('../public/v8-dock.css',import.meta.url),'utf8');
const js=readFileSync(new URL('../public/v8-dock.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
test('V8 dock styles and load order are wired',()=>{
 assert.match(css,/#demoPanel\.demo-panel\{position:fixed/);
 assert.match(css,/@media\(max-width:740px\)/);
 assert.match(html,/v8-dock\.css/);
 assert.match(html,/app\.js" defer><\/script>\s*<script src="\.\/v8-dock\.js"/);
 assert.match(js,/document\.body\.appendChild\(panel\)/);
});
