import assert from "node:assert/strict";
import {sendaiMapIsActive, sendaiMapRoleAllowed, SENDAI_MAP_EXPIRES_AT} from "../src/lib/sendai-map-policy.ts";
assert.equal(sendaiMapIsActive(SENDAI_MAP_EXPIRES_AT-1),true);
assert.equal(sendaiMapIsActive(SENDAI_MAP_EXPIRES_AT),false);
assert.equal(sendaiMapIsActive(SENDAI_MAP_EXPIRES_AT+1),false);
assert.equal(sendaiMapRoleAllowed("ca"),true);
assert.equal(sendaiMapRoleAllowed("admin"),true);
for(const role of ["pending","",null,undefined,"guest","CA"]){assert.equal(sendaiMapRoleAllowed(role),false);}
console.log("Sendai map expiry and role policy PASS");
