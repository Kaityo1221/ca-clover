// Validate and publish a public, prefecture-only HP aggregate. No individual records.
import fs from 'node:fs';
const [source, destination] = process.argv.slice(2);
if (!source || !destination) throw new Error('Usage: node refresh-suzuki-hp.mjs INPUT OUTPUT');
const raw = fs.readFileSync(source, 'utf8').trim();
if (!raw || raw === 'null') {
  console.log('SKIPPED: the daily member-sync is incomplete or has failures');
  process.exit(0);
}
const data = JSON.parse(raw);
if (data.version !== 1 || data.syncComplete !== true || typeof data.generatedAt !== 'string') {
  throw new Error('Invalid or incomplete snapshot');
}
if (!data.prefectures || typeof data.prefectures !== 'object' || Array.isArray(data.prefectures)) {
  throw new Error('Missing prefecture object');
}
const records = Object.entries(data.prefectures);
if (records.length < 35 || records.length > 47) {
  throw new Error('Unexpected prefecture coverage: ' + records.length);
}
for (const [pref, entry] of records) {
  if (typeof pref !== 'string' || pref.length > 8 ||
      !Number.isSafeInteger(entry?.hp) || entry.hp < 1 ||
      !Number.isSafeInteger(entry?.communities) || entry.communities < 1) {
    throw new Error('Invalid aggregate for a prefecture');
  }
}
if (!data.prefectures['東京都']) throw new Error('Tokyo aggregate absent');
const canonical = value => JSON.stringify(
  Object.keys(value.prefectures).sort().map(name => [
    name, value.prefectures[name]?.hp, value.prefectures[name]?.communities
  ])
);
if (fs.existsSync(destination)) {
  const prior = JSON.parse(fs.readFileSync(destination, 'utf8'));
  if (canonical(prior) === canonical(data)) {
    console.log('UNCHANGED: prefecture HP totals have not changed');
    process.exit(0);
  }
}
fs.writeFileSync(destination, JSON.stringify(data, null, 2) + '\n');
console.log('UPDATED: ' + records.length + ' prefectures (no private member details)');
