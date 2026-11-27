// Display order confirmed from the owner's menu reference. Unknown products
// retain their source order after the nine portion dishes and before whole rolls.
export const productMenu=[
 ['CN-XXPM','Cơm nắm xúc xích chà bông phô mai'],
 ['CN-XXMY','Cơm nắm xúc xích chà bông mayo'],
 ['CN-TERI','Cơm nắm gà sốt Teriyaki'],
 ['CN-GPM','Cơm nắm gà sốt phô mai'],
 ['CN-BV','Cơm nắm bò viên sốt bơ tỏi'],
 ['CN-CNM','Cơm nắm cá ngừ mayo'],
 ['CC','Cơm cuộn thường'],['CCC','Cơm cuộn chiên'],['CN-MY','Mì trộn Chifaa'],
 ['CC-NC','Cơm cuộn TT (nguyên cây)'],['CCC-NC','Cơm cuộn chiên (nguyên cây)']
];
const productOrder=new Map(productMenu.map(([code],index)=>[code,index]));
export const isWholeRollCode=(code:string)=>['CC-NC','CCC-NC'].includes(code.trim().toUpperCase());

export function sortProductsByMenuOrder<T extends {code:string}>(products:readonly T[]):T[];
export function sortProductsByMenuOrder<T>(products:readonly T[],codeOf:(product:T)=>string|null|undefined):T[];
export function sortProductsByMenuOrder<T>(products:readonly T[],codeOf:(product:T)=>string|null|undefined=product=>(product as {code:string}).code):T[]{
 const rank=(product:T)=>productOrder.get((codeOf(product)??'').trim().toUpperCase())??productOrder.size-2.5;
 return [...products].sort((left,right)=>rank(left)-rank(right));
}

// Fetch all matching pages before sorting, so a known menu item on a later
// server page is not stranded after unknown items on the first display page.
export async function loadMenuPages<P extends {rows:{code:string}[];total:number|string}>(read:(offset:number)=>Promise<P>){
 const first=await read(0),rows=[...first.rows],total=Number(first.total);
 if(!Number.isSafeInteger(total)||total<rows.length)throw new Error('Danh sách món chưa đầy đủ. Vui lòng tải lại.');
 while(rows.length<total){
  const next=await read(rows.length);
  if(Number(next.total)!==total||!next.rows.length||rows.length+next.rows.length>total)throw new Error('Danh sách món vừa thay đổi. Vui lòng tải lại.');
  rows.push(...next.rows);
 }
 return {...first,rows:sortProductsByMenuOrder(rows)};
}
