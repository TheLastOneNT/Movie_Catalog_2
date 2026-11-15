import test from "node:test";
import assert from "node:assert/strict";
import { writeWeeklyBackup } from "../worker/scheduled-backup.js";

const snapshot=()=>({
 schemaVersion:5,seriesCycles:[],seasonViewings:[],ratingChanges:[],
 movies:[],profiles:[{id:1,name:"One"},{id:2,name:"Two"}],
 watchHistory:[],watchAttendance:[],moviePosters:[],dismissedCatalogAlerts:[],
});

class MemoryBucket {
 constructor(){this.objects=new Map();this.failRead=false;this.deleted=[];}
 async head(key){return this.objects.has(key)?{key}:null;}
 async put(key,value,opts={}){this.objects.set(key,{bytes:new Uint8Array(value),metadata:opts});}
 async get(key){const o=this.objects.get(key); if(!o||this.failRead)return null;return {arrayBuffer:async()=>o.bytes.buffer.slice(o.bytes.byteOffset,o.bytes.byteOffset+o.bytes.byteLength)};}
 async delete(key){this.deleted.push(key);this.objects.delete(key);}
 async list({prefix,cursor,limit}){const keys=[...this.objects.keys()].filter(x=>x.startsWith(prefix)).sort();const start=cursor?Number(cursor):0;const page=keys.slice(start,start+limit);return {objects:page.map(key=>({key})),truncated:start+limit<keys.length,cursor:String(start+limit)};}
}

test("full restorable JSON archives to private R2 with SHA-256 metadata",async()=>{
 const bucket=new MemoryBucket();
 const result=await writeWeeklyBackup({DB:{},BACKUP_BUCKET:bucket},async()=>snapshot(),new Date("2026-11-15T03:00:00Z"));
 assert.equal(result.retained,1);
 assert.match(result.key,/family-catalog\/weekly\/2026-11-15T03-00-00-000Z-/);
 const stored=bucket.objects.get(result.key);
 assert.equal(stored.metadata.customMetadata.sha256,result.sha256);
 assert.deepEqual(JSON.parse(new TextDecoder().decode(stored.bytes)),snapshot());
});

test("retains 12 latest snapshots after successful verification",async()=>{
 const bucket=new MemoryBucket();
 for(let day=1;day<=13;day++){
  await writeWeeklyBackup({DB:{},BACKUP_BUCKET:bucket},async()=>snapshot(),new Date(Date.UTC(2026,10,day,3)));
 }
 assert.equal(bucket.objects.size,12);
 assert.equal(bucket.deleted.length,1);
 assert.ok(![...bucket.objects.keys()].some(x=>x.includes("2026-11-01")));
});

test("missing R2 binding fails closed without removing anything",async()=>{
 await assert.rejects(()=>writeWeeklyBackup({DB:{}},async()=>snapshot()),/not configured/);
});

test("unverified R2 object prevents retention and produces an error",async()=>{
 const bucket=new MemoryBucket();
 bucket.failRead=true;
 await assert.rejects(()=>writeWeeklyBackup({DB:{},BACKUP_BUCKET:bucket},async()=>snapshot()),/verification failed/);
 assert.equal(bucket.deleted.length,0);
});

test("invalid backups never reach R2",async()=>{
 const bucket=new MemoryBucket();
 await assert.rejects(()=>writeWeeklyBackup({DB:{},BACKUP_BUCKET:bucket},async()=>({schemaVersion:5})),/Invalid|Missing/);
 assert.equal(bucket.objects.size,0);
});
