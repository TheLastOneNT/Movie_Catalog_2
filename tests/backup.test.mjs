import test from "node:test";
import assert from "node:assert/strict";
import { validateBackup, bytesToBase64, base64ToBytes, BackupError } from "../worker/backup.js";

const minimal = () => ({
  schemaVersion: 3, movies: [], profiles: [{id:1,name:"Alex"},{id:2,name:"Sam"}],
  watchHistory: [], watchAttendance: [], moviePosters: [],
});
test("accepts complete empty v3 backup", () => assert.deepEqual(validateBackup(minimal()), {movies:0,views:0,seasons:0,posters:0}));
test("rejects partial and old backups to prevent data loss", () => {
  assert.throws(() => validateBackup({...minimal(), schemaVersion:2}), BackupError);
  assert.throws(() => validateBackup({...minimal(), moviePosters:undefined}), BackupError);
});
test("roundtrips poster blob bytes", () => {
  const source = Uint8Array.from([0,1,2,30,200,255]);
  assert.deepEqual(new Uint8Array(base64ToBytes(bytesToBase64(source))), source);
});

test("accepts v4 backup including an empty season diary", () => {
 const upgraded={...minimal(),schemaVersion:4,seasonViewings:[]};
 assert.deepEqual(validateBackup(upgraded),{movies:0,views:0,seasons:0,posters:0});
});
test("rejects v4 backup missing season diary to prevent data loss", () => {
 assert.throws(()=>validateBackup({...minimal(),schemaVersion:4}),BackupError);
});
