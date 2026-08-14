import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'node:child_process';
import { Readable } from 'node:stream';
import { doc,getDoc,setDoc } from 'firebase/firestore';
import { db as firestoreDb } from '@/lib/firebase';
import { getFileById,getConfigMap } from '@/lib/excel-db';
import { getTelegramFileStream } from '@/lib/telegram';
import { getCorsHeaders,handleCorsOptions } from '@/lib/cors';

const mem=new Map<string,Buffer>(); const pending=new Map<string,Promise<Buffer|null>>();
function put(id:string,b:Buffer){mem.set(id,b);if(mem.size>80)mem.delete(mem.keys().next().value as string);}
async function saved(id:string,token:string){
  try{
    const s=await getDoc(doc(firestoreDb,'thumbnail_cache',id)); if(!s.exists())return null;
    const fid=(s.data() as any).telegram_file_id;if(!fid)return null;
    const x=await getTelegramFileStream(token,fid);if(!x.ok||!x.response?.body)return null;
    const b=Buffer.from(await x.response.arrayBuffer());if(b.length<100)return null;put(id,b);return b;
  }catch{return null}
}
async function upload(token:string,chat:string,b:Buffer,name:string,topic?:string){
  const f=new FormData();f.append('chat_id',chat);if(topic)f.append('message_thread_id',topic);
  f.append('caption',`XVIDSHUB THUMBNAIL\n${name}`);
  f.append('document',new Blob([new Uint8Array(b)],{type:'image/jpeg'}),name);
  const r=await fetch(`https://api.telegram.org/bot${token}/sendDocument`,{method:'POST',body:f});
  const d=await r.json();if(!d.ok||!d.result?.document?.file_id)throw Error(d.description||'Telegram upload gagal');
  return d.result.document.file_id as string;
}
async function build(id:string):Promise<Buffer|null>{
  const m=mem.get(id);if(m)return m;const q=pending.get(id);if(q)return q;
  const job=(async()=>{
    const file=await getFileById(id);if(!file||file.type!=='video')return null;
    const c=await getConfigMap();const token=c.telegram_bot_token,chat=c.telegram_chat_id;
    if(!token||!chat)throw Error('Telegram bot token/chat id belum dikonfigurasi');
    const old=await saved(id,token);if(old)return old;
    const src=await getTelegramFileStream(token,file.telegram_file_id);
    if(!src.ok||!src.response?.body)throw Error('Video Telegram tidak dapat diambil');
    const ff=spawn('ffmpeg',['-hide_banner','-loglevel','error','-ss','1','-i','pipe:0','-frames:v','1','-an','-vf','scale=640:-2:force_original_aspect_ratio=decrease','-f','image2pipe','-vcodec','mjpeg','-q:v','6','pipe:1'],{stdio:['pipe','pipe','pipe']});
    const chunks:Buffer[]=[];let err='';
    const done=new Promise<Buffer>((resolve,reject)=>{
      ff.stdout.on('data',c=>chunks.push(Buffer.from(c)));ff.stderr.on('data',c=>err+=c.toString().slice(-3000));
      ff.on('error',reject);ff.on('close',code=>{const b=Buffer.concat(chunks);code===0&&b.length>100?resolve(b):reject(Error(err||`ffmpeg exit ${code}`));});
    });
    Readable.fromWeb(src.response.body as any).pipe(ff.stdin);
    const b=await done;put(id,b);
    const fid=await upload(token,chat,b,`thumbnail_${id}.jpg`,c.telegram_topic_id);
    await setDoc(doc(firestoreDb,'thumbnail_cache',id),{telegram_file_id:fid,mime:'image/jpeg',source_file_id:file.telegram_file_id,created_at:new Date().toISOString()},{merge:true});
    return b;
  })();
  pending.set(id,job);try{return await job}finally{pending.delete(id)}
}
export async function OPTIONS(){return handleCorsOptions()}
export async function GET(req:NextRequest,{params}:{params:Promise<{id:string}>}){
  try{
    const {id}=await params;const b=await build(id);
    if(!b)return NextResponse.json({success:false,message:'Thumbnail tidak tersedia'},{status:404,headers:getCorsHeaders()});
    const h=new Headers(getCorsHeaders());h.set('Content-Type','image/jpeg');h.set('Content-Length',String(b.length));h.set('Cache-Control','public,max-age=2592000,stale-while-revalidate=604800');h.set('X-Thumbnail-Source','telegram-persistent');
    return new NextResponse(new Uint8Array(b),{headers:h});
  }catch(e:any){return NextResponse.json({success:false,message:e?.message||'Gagal membuat thumbnail'},{status:500,headers:getCorsHeaders()})}
}
