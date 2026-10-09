# CA Clover CA-wide switch emergency snapshots

Original Edge versions and verify_jwt:
- stamp-exchange: 9, verify_jwt=false
- stamp-event: 5, verify_jwt=false
- stamp-bulk: 6, verify_jwt=false
- admin-manage: 7, verify_jwt=true

Retained in backup branch only, **not** `pages`. Reapply DB function definitions through reviewed migration; deploy previous Edge functions with the original JWT flag and original shared identity file if rollback is authorized. Never delete existing medal history.
