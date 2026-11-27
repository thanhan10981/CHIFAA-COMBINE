import assert from 'node:assert/strict';
import test from 'node:test';
import {parseVietQrBanks} from '../features/admin/vietqr-banks';

test('VietQR bank list keeps selectable transfer banks, validates BIN and sorts by short name',()=>{
 const banks=parseVietQrBanks({code:'00',data:[
  {id:2,name:'Ngân hàng B',code:'BBB',bin:'970002',shortName:'B Bank',logo:'https://api.vietqr.io/img/BBB.png',transferSupported:1,lookupSupported:1},
  {id:1,name:'Ngân hàng A',code:'AAA',bin:'970001',shortName:'A Bank',logo:'https://api.vietqr.io/img/AAA.png',transferSupported:1,lookupSupported:0},
  {id:3,name:'Không hỗ trợ',code:'XXX',bin:'970003',shortName:'X Bank',logo:'https://api.vietqr.io/img/XXX.png',transferSupported:0,lookupSupported:0},
  {id:4,name:'BIN sai',code:'BAD',bin:'123',shortName:'Bad Bank',logo:'https://api.vietqr.io/img/BAD.png',transferSupported:1,lookupSupported:1},
 ]});
 assert.deepEqual(banks.map(bank=>bank.bin),['970001','970002']);
 assert.throws(()=>parseVietQrBanks({code:'99',data:[]}));
});
