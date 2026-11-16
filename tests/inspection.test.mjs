import test from 'node:test';import assert from 'node:assert/strict';
import {gas} from './gas-mock.mjs';import {send} from './auth-helpers.mjs';
test('Backup records canonical manifest; corruption is detected and restore refuses a modified copy',()=>{
  const g=gas(),token=g.ctx.issueSession_('admin@example.com','admin').token;g.properties.set('BACKUP_FOLDER_ID','private-backup-folder');
  const backup=send(g,'maintenance',{token,operation:'backup'});assert.equal(backup.ok,true,JSON.stringify(backup));assert.equal(backup.data.verified,true);
  const id=backup.data.fileId,verify=()=>send(g,'maintenance',{token,operation:'verifyBackup',backupId:id});assert.equal(verify().data.verified,true);
  const source=g.properties.get('SPREADSHEET_ID'),restore=send(g,'maintenance',{token,operation:'restore',backupId:id});assert.equal(restore.ok,true);assert.equal(g.properties.get('SPREADSHEET_ID'),source);
  g.books.get(id).getSheetByName('_Users').rows[1][2]='staff';assert.equal(verify().data.verified,false);
  assert.equal(send(g,'maintenance',{token,operation:'restore',backupId:id}).error.code,'BACKUP_UNVERIFIED');
  assert.equal(g.properties.get('SPREADSHEET_ID'),source);
});
test('Unknown and legacy backups cannot be silently verified or restored; non-Admin cannot inspect any backup',()=>{
  const g=gas(),token=g.ctx.issueSession_('admin@example.com','admin').token;
  assert.equal(send(g,'maintenance',{token,operation:'verifyBackup',backupId:'unregistered-backup'}).error.code,'FORBIDDEN');
  g.ctx.audit_('SYSTEM','BACKUP','backup','legacy-backup-id',null,null);
  assert.equal(send(g,'maintenance',{token,operation:'verifyBackup',backupId:'legacy-backup-id'}).data.verified,false);
  assert.equal(send(g,'maintenance',{token,operation:'restore',backupId:'legacy-backup-id'}).error.code,'BACKUP_UNVERIFIED');
  g.ctx.append_('_Users',['staff','staff@example.com','staff','{}',true,1]);const staff=g.ctx.issueSession_('staff@example.com','staff').token;
  assert.equal(send(g,'maintenance',{token:staff,operation:'inspectSources'}).error.code,'FORBIDDEN');
});
test('Source inspection reports invalid records with physical row and never changes business cells',()=>{
  const g=gas(),token=g.ctx.issueSession_('admin@example.com','admin').token;
  g.ctx.writeRow_('materials',{recordId:'bad',version:1,name:'Material',purchaseUnit:'kg',unit:'g',conversion:0,minimum:0,deleted:false});
  const before=JSON.stringify(g.tables.get('materials').rows),result=send(g,'maintenance',{token,operation:'inspectSources',module:'materials'});
  assert.equal(result.ok,true,JSON.stringify(result));assert.equal(result.data.total,1);assert.equal(result.data.rows[0].id,'bad');assert.equal(result.data.rows[0].row,2);assert.equal(result.data.readOnly,true);
  assert.equal(JSON.stringify(g.tables.get('materials').rows),before);
});
test('Backup verification and Drive copy never hold the global write lock; concurrent source changes refuse restore',()=>{
  const g=gas();g.properties.set('BACKUP_FOLDER_ID','private-backup-folder');let held=false;
  g.ctx.LockService.getScriptLock=()=>({tryLock(){assert.equal(held,false);held=true;return true;},releaseLock(){held=false;}});
  const values=g.ctx.profileValues_;g.ctx.profileValues_=(name,range)=>{assert.equal(held,false);return values(name,range);};
  const getFile=g.ctx.DriveApp.getFileById;g.ctx.DriveApp.getFileById=id=>{const file=getFile(id);return {...file,makeCopy(...args){assert.equal(held,false);const result=file.makeCopy(...args);g.tables.get('_Users').rows[1][2]='staff';return result;}};};
  const result=g.ctx.backup_();assert.equal(result.verified,false);assert.equal(g.properties.has('LAST_BACKUP'),false);assert.equal(g.properties.has('BACKUP_LEASE'),false);
  // The copy's checksum alone cannot override a failed consistency check at creation.
  g.ctx.profileValues_=values;assert.equal(g.ctx.verifyBackup_(result.fileId).verified,false);
});
