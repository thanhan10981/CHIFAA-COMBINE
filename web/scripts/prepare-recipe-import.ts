import fs from 'node:fs/promises';
import {parseRecipeSource,buildRecipeImport} from '../lib/deploy/recipe-import';
const file=process.argv[2];if(!file)throw new Error('Pass the private pasted-sheet .txt path');
const commercial=JSON.parse(await fs.readFile('../output/commercial-source.json','utf8'));
const products=commercial.products??commercial.source?.products;
if(!products)throw new Error('Prepare commercial-source.json first');
const source=parseRecipeSource(await fs.readFile(file,'utf8'),products),date=process.argv[3]??'2026-11-17';
await fs.writeFile('../output/recipe-source.json',JSON.stringify(source,null,2));
await fs.writeFile('../output/CHIFAA_CONG_THUC_DEV.sql',buildRecipeImport(source,date));
const sql=(await fs.readFile('../supabase/migrations/202611170027_recipe_catalog.sql','utf8')).trim().replace(/^begin;/,'').replace(/commit;$/,'');
await fs.writeFile('../output/CHIFAA_PATCH_CONG_THUC_DEV.sql',`-- CHIFAA DEV027; run after026. No recipe data inside this schema patch.\ndo $patch027$ begin
if current_user not in ('postgres','supabase_admin') then raise exception 'SQL_EDITOR_OWNER_REQUIRED';end if;
perform pg_advisory_xact_lock(170027);
if to_regclass('public.employee_monthly_allowances') is null then raise exception 'PATCH_026_REQUIRED';end if;
if to_regclass('public.recipe_unresolved_items') is not null then raise exception 'PATCH_027_ALREADY_PRESENT';end if;
execute $migration027$${sql}$migration027$;end $patch027$;`);
const issues=source.recipes.flatMap(r=>[...(r.issue?[`${r.code}: ${r.issue}`]:[]),...r.items.filter(i=>i.issue).map(i=>`${r.code}: ${i.issue}`)]);
await fs.writeFile('../output/CONG_THUC_DOI_CHIEU.md',`# Đối chiếu công thức nguồn\n\n${source.recipes.length} công thức nhập nháp. Không công bố hoặc ghi kho. Nguồn TXT sao chép từ Excel được giữ riêng; không sửa workbook.\n\n${issues.map(i=>'- '+i).join('\n')}\n\n- Cơm: dùng số chốt 2.500g làm đầu ra nháp, giữ nguyên tổng nguyên liệu 2.300g trong nguồn; nước chưa có mã, cần liên kết vật tư.\n- Giá HC trong sheet 450đ khác danh mục 480đ; giá TEM55đ/TEMCC77đ chỉ tham khảo, không ghi đè giá danh mục.\n- Đũa đang mua theo túi, công thức theo cái; chưa rõ quy cách thì không suy từ giá120đ/cái.\n- Các ô giá/cost0 từ sheet là nguồn tham khảo, không phải xác minh giá0.\n- Không tạo bản sao M73241 trong ảnh vì không có trong dữ liệu nguồn.\n- Món nguyên cây dùng đầu ra số lát nguyên; hộp lấy số lát trực tiếp, không làm tròn tỷ lệ12/14 hoặc10/16 trước khi tính.\n`);
console.log(JSON.stringify({recipes:source.recipes.length,kinds:Object.fromEntries(['product','sauce','rice','packaging'].map(k=>[k,source.recipes.filter(r=>r.kind===k).length])),issues:issues.length,cloudExecuted:false}));
