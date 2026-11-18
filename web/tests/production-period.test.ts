import test from 'node:test';
import assert from 'node:assert/strict';
import {periodRange} from '../lib/production-period';
test('KH-01 calendar week boundaries cross months/years and preserve Monday-to-Sunday dates',()=>{
 assert.deepEqual(periodRange('2026-11-01','week'),{from:'2026-10-26',to:'2026-11-01'});
 assert.deepEqual(periodRange('2027-01-01','week'),{from:'2026-12-28',to:'2027-01-03'});
 assert.deepEqual(periodRange('2026-11-18','rolling7'),{from:'2026-11-12',to:'2026-11-18'});
 assert.deepEqual(periodRange('2028-02-29','month'),{from:'2028-02-01',to:'2028-02-29'});
 assert.deepEqual(periodRange('2026-12-31','quarter'),{from:'2026-10-01',to:'2026-12-31'});
 assert.deepEqual(periodRange('','week'),{from:'',to:''});
});
