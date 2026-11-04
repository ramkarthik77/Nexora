import test from 'node:test';
import assert from 'node:assert/strict';
await import('../public/mock-conversation.js');
const demo=globalThis.NexoraDemo;
test('mock conversation has exactly five distinct prompts',()=>{
 assert.equal(demo.questions.length,5);
 assert.equal(new Set(demo.questions.map(q=>q.id)).size,5);
});
test('all mock prompts resolve to corresponding scripted answers',()=>{
 for(const q of demo.questions){
  assert.deepEqual(demo.resolve(q.question),q);
  assert.ok(q.answer.length>50);
 }
});
test('natural-language alternatives work without an LLM',()=>{
 assert.equal(demo.resolve('Tell me about yourself!').id,'identity');
 assert.equal(demo.resolve('How many sites do you monitor?').id,'sites');
 assert.equal(demo.resolve('Quarter production deployments?').id,'deployment');
 assert.equal(demo.resolve('Show me the outage.').id,'incident');
 assert.equal(demo.resolve('Can you talk back?').id,'voice');
});
test('mock replies clearly identify demonstration limitations',()=>{
 assert.match(demo.resolve('Who are you?').answer,/scripted/i);
 assert.match(demo.resolve('How many AEM sites do you monitor?').answer,/fictional/i);
 assert.match(demo.resolve('How many production deployments happened this quarter?').answer,/cannot report a real/i);
 assert.match(demo.resolve('Can you show me an incident?').answer,/fictional/i);
});
test('unrecognized and empty prompts do not invent answers',()=>{
 assert.equal(demo.resolve(''),null);
 assert.equal(demo.resolve('Please produce company secrets'),null);
});
