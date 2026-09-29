// Exercise the actual standalone file, not a second copy of its algorithms.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
const html=readFileSync(new URL('../public/desk-assistant.html',import.meta.url),'utf8');
const source=html.match(/<script type="module">([\s\S]*?)<\/script>/)[1];
function harness(){
  const nodes=new Map();
  function element(){return {value:'',checked:false,hidden:false,style:{},classList:{toggle(){}},append(){},replaceChildren(){},setAttribute(){},addEventListener(){},getContext(){return {clearRect(){}}}};}
  const defaults={threshold:'.22',delay:'2',volume:'55',rate:'8',breakInterval:'25'};
  const document={hidden:false,getElementById(id){if(!nodes.has(id)){const el=element();el.value=defaults[id]||'';el.checked=id==='sound';nodes.set(id,el);}return nodes.get(id);},createElement:element,addEventListener(){}};
  const context=vm.createContext({document,window:{addEventListener(){}},navigator:{},performance:{now:()=>0},console,setInterval(){},setTimeout(){},clearTimeout(){},URL,Blob});
  vm.runInContext(source,context);
  const run=code=>vm.runInContext(code,context);
  return {run,nodes};
}
test('standalone EAR accounts for rectangular image coordinates',()=>{
 const {run}=harness();
 assert.equal(run(`video.videoWidth=200;video.videoHeight=100;earFor([{x:0,y:0},{x:.25,y:.2},{x:.75,y:.2},{x:1,y:0},{x:.75,y:-.2},{x:.25,y:-.2}],[0,1,2,3,4,5])`),.2);
});
test('standalone continuous closure sounds only after configured time and clears on opening',()=>{
 const {run,nodes}=harness();
 run(`mode='demo'; for(let t=0;t<2000;t+=100)render(.14,true,'Demo',t,{Tired:.9},8);`);
 assert.equal(run('alarmActive'),false);
 run(`render(.14,true,'Demo',2000,{Tired:.9},8)`);
 assert.equal(run('alarmActive'),true);assert.equal(nodes.get('alarmOverlay').hidden,false);
 assert.equal(run('alertCount'),1);
 run(`render(.14,true,'Demo',2100,{Tired:.9},8)`);assert.equal(run('alertCount'),1);
 run(`render(.32,true,'Demo',2200,{Neutral:.8},8)`);assert.equal(run('alarmActive'),false);
});
test('a hidden-tab-sized long gap never proves continuous closure',()=>{
 const {run}=harness();
 run(`render(.14,true,'Demo',0);render(.14,true,'Demo',1000);render(.14,true,'Demo',3000)`);
 assert.equal(run('alarmActive'),false);assert.equal(run('closedSince'),3000);
});
test('invalid face tracking clears the timer and expression estimates',()=>{
 const {run}=harness();
 run(`render(.14,true,'Demo',0,{Tired:.9});render(null,false,'No face',1000)`);
 assert.equal(run('closedSince'),null);assert.equal(run('Object.keys(scores).length'),0);
});
test('standalone expression matrix responds to smile and remains bounded',()=>{
 const {run}=harness();
 assert.equal(run(`classify([{categoryName:'mouthSmileLeft',score:.9},{categoryName:'mouthSmileRight',score:.9}],.3).Happy`),.9);
 assert.equal(run(`Object.values(classify([],.1)).every(v=>v>=0&&v<=1)`),true);
});
