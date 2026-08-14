import { NextRequest, NextResponse } from 'next/server';
import { getFileById } from '@/lib/excel-db';
import { getCorsHeaders, handleCorsOptions } from '@/lib/cors';

export async function OPTIONS(){ return handleCorsOptions(); }

export async function POST(req: NextRequest){
  try{
    const body=await req.json().catch(()=>({}));
    const id=String(body?.id||'').trim();
    if(!id)return NextResponse.json({success:false,message:'id wajib diisi'},{status:400,headers:getCorsHeaders()});
    const file=await getFileById(id);
    if(!file)return NextResponse.json({success:false,message:'File tidak ditemukan'},{status:404,headers:getCorsHeaders()});
    if(file.type!=='video')return NextResponse.json({success:false,message:'File bukan video'},{status:400,headers:getCorsHeaders()});
    const target=new URL(`/api/v1/public/thumbnail/${encodeURIComponent(id)}`,req.url);
    const response=await fetch(target,{cache:'no-store'});
    const headers=getCorsHeaders(); headers.set('Cache-Control','no-store');
    if(!response.ok){
      const detail=await response.text().catch(()=> '');
      return NextResponse.json({success:false,message:detail||'Gagal membuat thumbnail'},{status:502,headers});
    }
    return NextResponse.json({success:true,id,status:'ready',
      thumbnail_url:`/api/v1/public/thumbnail/${encodeURIComponent(id)}`,
      source:response.headers.get('X-Thumbnail-Source')||'telegram-persistent'
    },{headers});
  }catch(e:any){
    return NextResponse.json({success:false,message:e?.message||'Thumbnail build failed'},{status:500,headers:getCorsHeaders()});
  }
}
