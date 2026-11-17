-- Daily HP export: ONE statement, no direct base-table access.
-- Requires the reviewed private.suzuki_hp_snapshot() aggregate-only function.
-- Only the dedicated suzuki_hp_reader login is accepted. Wrong credentials
-- yield no SQL result, which makes the publishing script fail closed.
SELECT private.suzuki_hp_snapshot()::text AS public_snapshot
WHERE current_user = 'suzuki_hp_reader';
