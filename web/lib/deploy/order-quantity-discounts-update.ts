import {buildPersistentOrderLinksUpdate} from './persistent-order-links-update';
export function buildOrderQuantityDiscountsUpdate(linksMigration:string,discountMigration:string){
 const sql=discountMigration.trim();
 if(!/^begin;/i.test(sql)||!/commit;$/i.test(sql))throw new Error('Transaction migration required');
 const links=buildPersistentOrderLinksUpdate(linksMigration).replace(/commit;\s*select to_regprocedure\('public\.public_order_links_v2\(\)'\) is not null as persistent_store_links_ready;\s*$/,'');
 return links+`
-- Owner-confirmed rule: eligible dish <50 =>15%; >=50 =>17% for the whole line.
do $patch092$ begin
 if current_user not in ('postgres','supabase_admin') then raise exception 'SQL_EDITOR_OWNER_REQUIRED';end if;
 perform pg_advisory_xact_lock(170092);
 if to_regprocedure('private.order_quantity_discount_rate(uuid,uuid,date,numeric)') is not null then return;end if;
 execute $migration092$${sql.replace(/^begin;/i,'').replace(/commit;$/i,'')}$migration092$;
end $patch092$;
notify pgrst,'reload schema';
commit;
select to_regprocedure('public.public_order_links_v2()') is not null as persistent_store_links_ready,
 to_regprocedure('private.order_quantity_discount_rate(uuid,uuid,date,numeric)') is not null as quantity_discounts_ready;
`;
}
