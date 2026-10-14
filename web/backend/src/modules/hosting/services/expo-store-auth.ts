import { sign } from "node:crypto";
import { ConflictError } from "../../../shared/errors/index.js";
const encoded=(v:unknown)=>Buffer.from(JSON.stringify(v)).toString("base64url");
export async function googleStoreToken(service:Record<string,unknown>):Promise<string>{
 const now=Math.floor(Date.now()/1000),url="https://oauth2.googleapis.com/token";
 const unsigned=encoded({alg:"RS256",typ:"JWT"})+"."+encoded({iss:service.client_email,scope:"https://www.googleapis.com/auth/androidpublisher",aud:url,iat:now,exp:now+3600});
 const signature=sign("RSA-SHA256",Buffer.from(unsigned),String(service.private_key)).toString("base64url");
 const response=await fetch(url,{method:"POST",redirect:"error",headers:{"content-type":"application/x-www-form-urlencoded"},body:new URLSearchParams({grant_type:"urn:ietf:params:oauth:grant-type:jwt-bearer",assertion:unsigned+"."+signature}),signal:AbortSignal.timeout(15000)});
 const result=await response.json() as {access_token?:string};if(!response.ok||!result.access_token)throw new ConflictError("Google rechazó el archivo. Revisa la cuenta de servicio y sus permisos.");return result.access_token;
}
export function appleStoreToken(config:Record<string,unknown>):string{
 const now=Math.floor(Date.now()/1000),unsigned=encoded({alg:"ES256",kid:config.keyId,typ:"JWT"})+"."+encoded({iss:config.issuerId,iat:now,exp:now+600,aud:"appstoreconnect-v1"});
 return unsigned+"."+sign("sha256",Buffer.from(unsigned),{key:String(config.privateKey),dsaEncoding:"ieee-p1363"}).toString("base64url");
}
export async function verifyExpoStore(provider:"google"|"apple",config:Record<string,unknown>,identifier:string){
 if(provider==="google"){
  const token=await googleStoreToken(config.serviceAccount as Record<string,unknown>),url=`https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(identifier)}/edits`;
  const response=await fetch(url,{method:"POST",redirect:"error",headers:{authorization:`Bearer ${token}`,"content-type":"application/json"},body:"{}",signal:AbortSignal.timeout(15000)});
  const body=await response.json() as {id?:string};if(!response.ok||!body.id)throw new ConflictError("Concede acceso a esta app en Play Console y crea su ficha antes de conectar.");
  const removed=await fetch(url+"/"+encodeURIComponent(body.id),{method:"DELETE",redirect:"error",headers:{authorization:`Bearer ${token}`},signal:AbortSignal.timeout(15000)});if(!removed.ok)throw new ConflictError("No se pudo cerrar la verificación de Google Play");return;
 }
 const token=appleStoreToken(config),url=`https://api.appstoreconnect.apple.com/v1/apps?filter[bundleId]=${encodeURIComponent(identifier)}`;
 const response=await fetch(url,{redirect:"error",headers:{authorization:`Bearer ${token}`},signal:AbortSignal.timeout(15000)}),body=await response.json() as {data?:Array<{id:string}>};
 if(!response.ok||!body.data?.some(app=>app.id===String(config.storeAppId)))throw new ConflictError("La clave no tiene acceso a esta app. Revisa su Apple ID y Bundle ID en App Store Connect.");
}
