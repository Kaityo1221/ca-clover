// Production preflight: SELECT only. Does not enable a feature or create a room.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {neon} from '@neondatabase/serverless';
if(!process.env.ZOROARK_READONLY_CONFIG)throw Error('Explicit config path required');
const config=JSON.parse(fs.readFileSync(process.env.ZOROARK_READONLY_CONFIG,'utf8'));
for(const kind of ['gm','guest']){
 const u=new URL(config[kind]);
 assert.equal(u.hostname.replace('-pooler.','.'),'ep-billowing-unit-beco2lbg.c-9.us-east-2.aws.neon.tech');
 assert.equal(u.username,`zoroark_runtime_${kind}`);assert.equal(u.pathname,'/zoroark_prod');
 const sql=neon(config[kind]);
 const [identity]=await sql`select * from zoroark_isolated.runtime_identity()`;
 assert.deepEqual(identity,{database_name:'zoroark_prod',role_name:`zoroark_runtime_${kind}`,target:'production',version:3});
 const [role]=await sql`select rolcreatedb,rolcreaterole,rolbypassrls from pg_roles where rolname=current_user`;
 assert.deepEqual(role,{rolcreatedb:false,rolcreaterole:false,rolbypassrls:false});
 await assert.rejects(sql`select * from zoroark_isolated.rooms`,error=>error.code==='42501');
 await assert.rejects(sql`select * from zoroark_isolated.guest_participants`,error=>error.code==='42501');
 const [acl]=await sql`select has_function_privilege(current_user,'zoroark_isolated.guest_me(text)','EXECUTE') as legacy,
 has_schema_privilege(current_user,'zoroark_isolated','CREATE') as ddl`;
 assert.deepEqual(acl,{legacy:false,ddl:false});
}
console.log('PRODUCTION_READONLY_PREFLIGHT_PASS: actual GM/guest logins, identity, no admin, no direct table access, no legacy session function');
