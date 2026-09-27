import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ClosureTracker, eyeAspectRatio, expressionScores, validPose } from './vision.js';
test('EAR uses pixel aspect ratio and vertical/horizontal eye distances', () => {
  const p = [{x:0,y:0},{x:.25,y:.2},{x:.75,y:.2},{x:1,y:0},{x:.75,y:-.2},{x:.25,y:-.2}];
  assert.equal(eyeAspectRatio(p,[0,1,2,3,4,5],200,100),.2);
});
test('alarm requires continuous elapsed closure, then clears on opening', () => {
  const t = new ClosureTracker();
  for (let now=0;now<2000;now+=100) assert.equal(t.update(.15,now,true).alarm,false);
  assert.equal(t.update(.15,2000,true).alarm,true);
  assert.deepEqual(t.update(.3,2100,true),{closedMs:0,alarm:false});
});
test('a blink is not a microsleep', () => {
  const t = new ClosureTracker(); t.update(.15,0,true); t.update(.15,100,true);
  assert.deepEqual(t.update(.3,200,true),{closedMs:0,alarm:false});
});
test('lost tracking, invalid measurements and long frame gaps break continuity', () => {
  const t = new ClosureTracker(); t.update(.1,0,true); t.update(.1,400,true);
  assert.equal(t.update(.1,1100,true).closedMs,0);
  assert.equal(t.update(.1,1400,false).closedMs,0);
  assert.equal(t.update(.1,1500,true).closedMs,0);
  assert.equal(t.update(NaN,1600,true).alarm,false);
});
test('hysteresis tolerates small threshold noise', () => {
  const t = new ClosureTracker(); t.update(.2,0,true);
  assert.equal(t.update(.23,100,true).closedMs,100);
  assert.equal(t.update(.25,200,true).closedMs,0);
});
test('duration is configurable', () => {
  const t = new ClosureTracker();
  for(let now=0;now<1000;now+=100)t.update(.15,now,true,.22,1000);
  assert.equal(t.update(.15,1000,true,.22,1000).alarm,true);
});
test('expression indicators remain bounded and respond to blendshapes', () => {
  const scores=expressionScores([{categoryName:'mouthSmileLeft',score:.9},{categoryName:'mouthSmileRight',score:.9}],.3);
  assert.equal(scores.Happy,.9);
  assert.ok(Object.values(scores).every(s=>s>=0&&s<=1));
  assert.equal(validPose([]),false);
});
