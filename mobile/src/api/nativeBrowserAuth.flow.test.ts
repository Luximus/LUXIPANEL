import { beforeEach, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
vi.mock("expo-crypto",()=>({getRandomBytesAsync:vi.fn(async()=>new Uint8Array(32).fill(7)),CryptoDigestAlgorithm:{SHA256:"SHA256"},digestStringAsync:vi.fn(async(_algorithm:string,value:string)=>createHash("sha256").update(value).digest("hex"))}));
vi.mock("expo-web-browser",()=>({openAuthSessionAsync:vi.fn(),WebBrowserResultType:{CANCEL:"cancel"}}));
vi.mock("./directAuth",async importOriginal=>({...(await importOriginal<typeof import('./directAuth')>()),xhrRequest:vi.fn()}));
import { xhrRequest } from "./directAuth";
import { openAuthSessionAsync, WebBrowserResultType } from "expo-web-browser";
import { loginInSystemBrowser } from "./nativeBrowserAuth";
const xhr=vi.mocked(xhrRequest),browser=vi.mocked(openAuthSessionAsync), requestId="r".repeat(43),code="c".repeat(43),state=Buffer.alloc(32,7).toString("base64url");
beforeEach(()=>{
 vi.clearAllMocks();
 xhr.mockResolvedValueOnce({status:201,body:{ok:true,data:{authorizationUrl:`https://panel.test/login?nativeRequest=${requestId}`}},cookies:""});
 browser.mockResolvedValue({type:"success",url:`luxipanel://auth/callback?code=${code}&state=${state}`});
});
it('redeems a proof-bound code by POST and keeps secrets out of the browser URL',async()=>{
 xhr.mockResolvedValueOnce({status:200,body:{ok:true,data:{jwt:"independent-token",expiresAt:1234}},cookies:"luxipanel_csrf=fresh; Path=/"});
 expect(await loginInSystemBrowser('https://panel.test','es')).toEqual({jwt:'independent-token',csrf:{name:'luxipanel_csrf',value:'fresh'},exp:1234});
 const start=xhr.mock.calls[0][2]!.body as {state:string;codeChallenge:string};
 const redeem=xhr.mock.calls[1][2]!.body as {codeVerifier:string;code:string;state:string};
 expect(start.codeChallenge).toBe(createHash('sha256').update(redeem.codeVerifier).digest('base64url'));
 expect(redeem).toMatchObject({code,state:start.state});
 expect(xhr.mock.calls[1].slice(0,2)).toEqual(['POST','https://panel.test/api/auth/native/redeem']);
 expect(browser.mock.calls[0][0]).not.toContain(redeem.codeVerifier);
 expect(browser.mock.calls[0][0]).not.toContain('independent-token');
});
it('cancellation never redeems or creates a session',async()=>{
 browser.mockResolvedValueOnce({type:WebBrowserResultType.CANCEL});
 expect(await loginInSystemBrowser('https://panel.test','en')).toBeNull();expect(xhr).toHaveBeenCalledTimes(1);
});
it('a callback after changing profile is discarded',async()=>{
 let active=true;browser.mockImplementationOnce(async()=>{active=false;return {type:'success',url:`luxipanel://auth/callback?code=${code}&state=${state}`};});
 expect(await loginInSystemBrowser('https://panel.test','en',()=>active)).toBeNull();expect(xhr).toHaveBeenCalledTimes(1);
});
it('rejects callback state substitution before any token exchange',async()=>{
 browser.mockResolvedValueOnce({type:'success',url:`luxipanel://auth/callback?code=${code}&state=wrong`});
 await expect(loginInSystemBrowser('https://panel.test','en')).rejects.toThrow();expect(xhr).toHaveBeenCalledTimes(1);
});
it('never opens another server as the authorization endpoint',async()=>{
 xhr.mockReset();xhr.mockResolvedValueOnce({status:201,body:{ok:true,data:{authorizationUrl:`https://other.test/login?nativeRequest=${requestId}`}},cookies:''});
 await expect(loginInSystemBrowser('https://panel.test','en')).rejects.toThrow();expect(browser).not.toHaveBeenCalled();
});
it('does not accept a response without a CSRF token',async()=>{
 xhr.mockResolvedValueOnce({status:200,body:{ok:true,data:{jwt:'token'}},cookies:''});
 await expect(loginInSystemBrowser('https://panel.test','en')).rejects.toThrow();
});
