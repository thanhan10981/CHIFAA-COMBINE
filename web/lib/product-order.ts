// Display order confirmed from the owner's menu reference. New products retain
// their source order after these menu items.
const productOrder=new Map([
 'CN-XXPM','CN-XXMY','CN-TERI','CN-GPM','CN-BV','CN-CNM','CC','CCC','CN-MY','CC-NC','CCC-NC'
].map((code,index)=>[code,index]));

export function sortProductsByMenuOrder<T extends {code:string}>(products:readonly T[]):T[]{
 const rank=(product:T)=>productOrder.get(product.code.trim().toUpperCase())??productOrder.size;
 return [...products].sort((left,right)=>rank(left)-rank(right));
}
