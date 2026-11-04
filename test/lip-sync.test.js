import test from 'node:test';
import assert from 'node:assert/strict';
// Test pure helpers. Browser integration is covered by Playwright.
globalThis.window={};
await import('../public/voice-engine.js');
const {mouthForText,charAtTime}=globalThis.window.NexoraVoice;
test('text-based fallback visemes distinguish closed lips, round vowels and wide vowels',()=>{
 assert.ok(mouthForText('m',0).open<mouthForText('a',0).open);
 assert.ok(mouthForText('o',0).round>mouthForText('a',0).round);
 assert.equal(mouthForText(' ',0).open,0);
});
test('character alignment locates the sound-active character for a speech timestamp',()=>{
 const a={characters:['H','i','!'],character_start_times_seconds:[0,.2,.5],character_end_times_seconds:[.19,.48,.65]};
 assert.equal(charAtTime(a,.05),0);
 assert.equal(charAtTime(a,.25),1);
 assert.equal(charAtTime(a,.6),2);
 assert.equal(charAtTime(a,3),-1);
 assert.equal(charAtTime(null,.3),-1);
});
