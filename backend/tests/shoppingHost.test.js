import {describe,it,expect} from 'vitest';
import scenarios from './golden/host/scenarios.json';
const host=require('../src/services/shoppingHost');
describe('hand-checked shopping host outputs',()=>{
 for(const scenario of scenarios)it(scenario.name,()=>{
 const room={products:[{id:'a',name:'Alpha',price:scenario.unknownPrice?null:100,currency:'INR',brand:'Example',category:'Shoes'},{id:'b',name:'Beta',price:200,currency:'INR',category:'Shoes'}],votes:scenario.votes||{}};
 const output=scenario.action==='summary'?host.summary(room):scenario.action==='disagreement'?host.disagreement(room,'a'):host.answer(room,'a',scenario.query);
 expect(output.text).toBe(scenario.expected);
 });
 it('keeps missing comparison fields unknown',()=>{const result=host.compare({name:'Alpha',price:null},{name:'Beta',price:20});expect(result.rows[1]).toEqual(['Price','Price unknown','₹20.00']);expect(result.rows[3]).toEqual(['Brand','Unknown','Unknown']);});
});
