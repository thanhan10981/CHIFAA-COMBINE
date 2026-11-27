export type VietQrBank={id:number;name:string;code:string;bin:string;shortName:string;logo:string;transferSupported:number;lookupSupported:number};

export function parseVietQrBanks(payload:unknown):VietQrBank[]{
 if(!payload||typeof payload!=='object'||(payload as {code?:unknown}).code!=='00'||!Array.isArray((payload as {data?:unknown}).data))throw new Error('API VietQR trả về danh sách ngân hàng không hợp lệ.');
 return (payload as {data:unknown[]}).data.filter((bank):bank is VietQrBank=>{
  if(!bank||typeof bank!=='object')return false;
  const row=bank as Partial<VietQrBank>;
  return typeof row.id==='number'&&typeof row.name==='string'&&typeof row.code==='string'&&typeof row.bin==='string'&&/^\d{6}$/.test(row.bin)&&typeof row.shortName==='string'&&typeof row.logo==='string'&&row.transferSupported===1;
 }).sort((a,b)=>a.shortName.localeCompare(b.shortName,'vi'));
}

export async function loadVietQrBanks():Promise<VietQrBank[]>{
 const response=await fetch('/api/vietqr/banks',{headers:{Accept:'application/json'}});
 if(!response.ok)throw new Error('Không tải được danh sách ngân hàng VietQR. Thử tải lại sau.');
 return parseVietQrBanks(await response.json());
}
