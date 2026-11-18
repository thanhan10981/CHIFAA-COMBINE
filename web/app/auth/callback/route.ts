import {authTarget} from '@/lib/auth/target';
import {NextResponse,type NextRequest} from 'next/server';
import {serverSupabase} from '@/lib/supabase/server';
export async function GET(request:NextRequest){const appUrl=process.env.NEXT_PUBLIC_APP_URL;if(!appUrl)return new NextResponse('Chưa cấu hình ứng dụng',{status:503});const code=request.nextUrl.searchParams.get('code'),next=authTarget(request.nextUrl.searchParams.get('next')),client=await serverSupabase();if(client&&code){const {error}=await client.auth.exchangeCodeForSession(code);if(!error)return NextResponse.redirect(new URL(next,appUrl));}return NextResponse.redirect(new URL('/login?reason=oauth',appUrl));}
