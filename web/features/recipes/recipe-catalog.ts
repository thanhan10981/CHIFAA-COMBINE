import {loadMenuPages} from '../../lib/product-order';

// recipe_catalog rejects limits above 50; other menu RPCs allow 100.
export const recipeCatalogPageSize=50;
export function loadRecipeMenuPages<P extends {rows:{code:string}[];total:number|string}>(read:(offset:number,limit:number)=>Promise<P>){
 return loadMenuPages(offset=>read(offset,recipeCatalogPageSize));
}
