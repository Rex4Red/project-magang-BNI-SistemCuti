export class ApiError extends Error {constructor(message:string,public status:number,public details?:any){super(message);}}
export async function api<T=any>(path:string,options:{method?:string;body?:unknown;key?:string}={}):Promise<T> {
  const response=await fetch('/api'+path,{method:options.method??'GET',credentials:'same-origin',headers:{'Content-Type':'application/json','X-Cuti-Client':'web',...(options.key?{'Idempotency-Key':options.key}:{})},body:options.body===undefined?undefined:JSON.stringify(options.body)});
  const data=await response.json();if(!response.ok)throw new ApiError(data.message??'Permintaan gagal.',response.status,data.details);return data;
}
export const action=(path:string,body:unknown,key=crypto.randomUUID())=>api(path,{method:'POST',body,key});
