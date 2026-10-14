import { expect, it } from "vitest";
import { sliceTableWindow } from "./table-window.js";

const data=Array.from({length:55},(_,id)=>({id,username:`user-${id}`,name:`row-${id}`,enabled:id%2===0}));
it("paginates arrays and preserves metadata and actor capabilities",()=>{
  const result=sliceTableWindow({ok:true,data,meta:{localCount:7}},{offset:20,limit:20},"user-54");
  expect(result.data).toEqual(data.slice(20,40));
  expect(result.meta).toMatchObject({localCount:7,tableWindow:{total:55,hasMore:true,actor:data[54]}});
});
it("filters and sorts the whole collection before slicing, including its final partial page",()=>{
  const query={offset:20,limit:20,filters:[{key:"enabled",type:"select",value:"true"}],sorting:[{key:"id",desc:true}]};
  const result=sliceTableWindow({ok:true,data:{records:data,serverIp:"127.0.0.1"}}, {...query,field:"records"});
  expect(result.data.serverIp).toBe("127.0.0.1");expect(result.data.records.map((row:any)=>row.id)).toEqual([14,12,10,8,6,4,2,0]);
  expect(result.meta.tableWindow).toMatchObject({total:28,hasMore:false});
});
it("keeps legacy, failed and non-list responses intact",()=>{
  for(const body of [{ok:false,error:"unauthorized"},{ok:true,data:{setting:true}}]) expect(sliceTableWindow(body,{offset:0,limit:20})).toBe(body);
});
