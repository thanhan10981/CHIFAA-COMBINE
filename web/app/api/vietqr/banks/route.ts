import {NextResponse} from 'next/server';

export const revalidate=86400;

export async function GET(){
 try{
  const response=await fetch('https://api.vietqr.io/v2/banks',{headers:{Accept:'application/json'},next:{revalidate:86400}});
  if(!response.ok)return NextResponse.json({code:'UPSTREAM_ERROR',desc:'VietQR bank list is unavailable.'},{status:502});
  return NextResponse.json(await response.json(),{headers:{'Cache-Control':'public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400'}});
 }catch{
  return NextResponse.json({code:'UPSTREAM_ERROR',desc:'VietQR bank list is unavailable.'},{status:502});
 }
}
