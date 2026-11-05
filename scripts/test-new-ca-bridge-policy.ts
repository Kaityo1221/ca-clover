import assert from "node:assert/strict";
import {
  BRIDGE_PREVIEW_BRANCH,
  isIsolatedBridgeReady,
  isIsolatedPreflightReady,
  verifiedGoogleProviderSubject,
  allowedToBindPreview,
} from "../src/lib/new-ca-bridge-policy.ts";

const isolated = {
  NEW_CA_BRIDGE_ENABLED: "true",
  VERCEL_ENV: "preview",
  VERCEL_GIT_COMMIT_REF: BRIDGE_PREVIEW_BRANCH,
  NEW_CA_LAB_DATABASE_URL: "postgresql://test_user:synthetic_password@ep-test-pooler.us-east-2.aws.neon.tech/ca_clover_test?sslmode=require",
};

function check(label: string, actual: unknown, expected: unknown) {
  assert.deepEqual(actual, expected, label);
  console.log("PASS", label);
}

check("dedicated preview only",isIsolatedBridgeReady(isolated),true);
check("disabled by default",isIsolatedBridgeReady({...isolated,NEW_CA_BRIDGE_ENABLED:"false"}),false);
check("production forbidden",isIsolatedBridgeReady({...isolated,VERCEL_ENV:"production"}),false);
check("wrong preview branch forbidden",isIsolatedBridgeReady({...isolated,VERCEL_GIT_COMMIT_REF:"main"}),false);
check("different database forbidden",isIsolatedBridgeReady({...isolated,NEW_CA_LAB_DATABASE_URL:isolated.NEW_CA_LAB_DATABASE_URL.replace("ca_clover_test","production")}),false);
check("foreign hostname forbidden",isIsolatedBridgeReady({...isolated,NEW_CA_LAB_DATABASE_URL:"postgresql://u:p@evil.example/ca_clover_test"}),false);
check("Google provider ID accepted",verifiedGoogleProviderSubject({identities:[{provider:"google",provider_id:"synthetic-google-sub-01",identity_data:{sub:"synthetic-google-sub-01"}}]}),"synthetic-google-sub-01");
check("Supabase identity UUID is not Google subject",verifiedGoogleProviderSubject({identities:[{provider:"google",id:"synthetic-identity-uuid",identity_data:{sub:"synthetic-google-sub-02"}}]}),null);
check("identity row UUID does not override provider ID",verifiedGoogleProviderSubject({identities:[{provider:"google",id:"internal-id",provider_id:"real-google-sub",identity_data:{sub:"real-google-sub"}}]}),"real-google-sub");
check("Google account mismatch refused",verifiedGoogleProviderSubject({identities:[{provider:"google",provider_id:"a",identity_data:{sub:"b"}}]}),null);
check("untrusted email identity refused",verifiedGoogleProviderSubject({identities:[{provider:"email",provider_id:"synthetic"}]}),null);
check("ambiguous Google identities refused",verifiedGoogleProviderSubject({identities:[{provider:"google",provider_id:"a"},{provider:"google",provider_id:"b"}]}),null);
check("new pending user can link single matching application",allowedToBindPreview("pending",0,1),true);
check("existing CA role refused",allowedToBindPreview("ca",0,1),false);
check("existing admin refused",allowedToBindPreview("admin",0,1),false);
check("previously linked CA identity refused",allowedToBindPreview("pending",1,1),false);
check("missing application refused",allowedToBindPreview("pending",0,0),false);
check("ambiguous applications refused",allowedToBindPreview("pending",0,2),false);

const qaPreview = {...isolated, VERCEL_GIT_COMMIT_REF:"qa/newca-webkit-validation-20261105"};
check("QA read-only preflight allowed",isIsolatedPreflightReady(qaPreview),true);
check("QA cannot bind or write via existing bridge gate",isIsolatedBridgeReady(qaPreview),false);
check("QA read-only preflight production forbidden",isIsolatedPreflightReady({...qaPreview,VERCEL_ENV:"production"}),false);
check("QA read-only preflight requires explicit enable flag",isIsolatedPreflightReady({...qaPreview,NEW_CA_BRIDGE_ENABLED:"false"}),false);
check("QA read-only preflight wrong DB refused",isIsolatedPreflightReady({...qaPreview,NEW_CA_LAB_DATABASE_URL:isolated.NEW_CA_LAB_DATABASE_URL.replace("ca_clover_test","production")}),false);
check("QA read-only preflight main refused",isIsolatedPreflightReady({...qaPreview,VERCEL_GIT_COMMIT_REF:"main"}),false);
check("QA read-only preflight wrong hostname refused",isIsolatedPreflightReady({...qaPreview,NEW_CA_LAB_DATABASE_URL:"postgresql://u:p@evil.example/ca_clover_test"}),false);
