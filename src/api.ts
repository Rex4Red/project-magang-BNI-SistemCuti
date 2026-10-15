export class ApiError extends Error {constructor(message:string,public status:number,public details?:any){super(message);}}
export async function api<T=any>(path:string,options:{method?:string;body?:unknown;key?:string}={}):Promise<T> {
  let response: Response;
  try {
    response=await fetch('/api'+path,{
      method:options.method??'GET',
      credentials:'same-origin',
      headers:{
        'Content-Type':'application/json',
        'X-Cuti-Client':'web',
        ...(options.key?{'Idempotency-Key':options.key}:{})
      },
      body:options.body===undefined?undefined:JSON.stringify(options.body)
    });
  } catch (err: any) {
    throw new ApiError('Tidak dapat terhubung ke server backend.', 503);
  }
  let data: any = {};
  const text = await response.text();
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { message: text || 'Terjadi kesalahan pada server.' };
  }
  if(!response.ok)throw new ApiError(data.message??'Permintaan gagal.',response.status,data.details);
  return data;
}
export const action=(path:string,body:unknown,key=crypto.randomUUID())=>api(path,{method:'POST',body,key});

