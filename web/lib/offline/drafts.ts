import {openDB,type DBSchema} from 'idb';
import {z} from 'zod';
const uuid=z.uuid(),quantity=z.string().regex(/^(?:0|[1-9]\d{0,8})(?:\.\d{1,6})?$/);
const payloads={
 production:z.object({warehouse_id:uuid,date:z.iso.date(),lines:z.array(z.object({product_id:uuid,recipe_version_id:uuid,main_quantity:quantity,extra_quantity:quantity,rejected_quantity:quantity}).strict()).min(1).max(100)}).strict(),
 counts:z.object({warehouse_id:uuid,date:z.iso.date(),inventory_version:z.string().regex(/^\d+$/),lines:z.array(z.object({material_id:uuid,counted_quantity:quantity}).strict()).min(1).max(200)}).strict(),
 attendance:z.object({employee_id:uuid,starts_at:z.iso.datetime({offset:true}),ends_at:z.iso.datetime({offset:true}),break_minutes:z.number().int().min(0).max(1440)}).strict(),
};
export type DraftModule=keyof typeof payloads;
export type Draft={id:string;userId:string;module:DraftModule;payload:unknown;state:'unsent'|'syncing'|'synced'|'conflict';updatedAt:string};
interface DraftDB extends DBSchema{drafts:{key:string;value:Draft;indexes:{'by-user':string}}}
const database=()=>openDB<DraftDB>('chifaa-drafts',1,{upgrade(db){db.createObjectStore('drafts',{keyPath:'id'}).createIndex('by-user','userId');}});
export function validateDraft(module:DraftModule,payload:unknown){return payloads[module].parse(payload);}
export async function saveDraft(draft:Omit<Draft,'state'|'updatedAt'>){uuid.parse(draft.userId);uuid.parse(draft.id);const payload=validateDraft(draft.module,draft.payload),db=await database();try{await db.put('drafts',{...draft,payload,state:'unsent',updatedAt:new Date().toISOString()});}finally{db.close();}}
export async function listDrafts(userId:string){uuid.parse(userId);const db=await database();try{return await db.getAllFromIndex('drafts','by-user',userId);}finally{db.close();}}
export async function clearDrafts(userId:string){const db=await database();try{const transaction=db.transaction('drafts','readwrite');for(const row of await transaction.store.index('by-user').getAll(userId))await transaction.store.delete(row.id);await transaction.done;}finally{db.close();}}
// No automatic sync. Online confirmation + authenticated RPC validation must be
// implemented and tested by each editor before a draft can become "synced".
