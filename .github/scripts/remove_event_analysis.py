from pathlib import Path

p = Path('docs/index.html')
s = p.read_text()

# Remove the standalone official-event analysis renderer.
start = s.find('  function eventAnalysisHtml(rows,periodLabel){\n')
end = s.find('  function route(){', start)
assert start >= 0 and end > start, 'eventAnalysisHtml block not found'
s = s[:start] + s[end:]

# Remove the extra event-only query. Meetup history still selects campfire_live_event_name.
start = s.find('    let eventMetricQuery=client.from("meetups")\n')
end = s.find('    const results=await Promise.all([\n', start)
assert start >= 0 and end > start, 'eventMetricQuery block not found'
s = s[:start] + s[end:]

# Remove the query from Promise.all and its result variable.
old = '      memberSnapshotQuery,\n      eventMetricQuery\n    ]);\n'
new = '      memberSnapshotQuery\n    ]);\n'
assert old in s, 'Promise.all eventMetricQuery entry not found'
s = s.replace(old, new, 1)

old = '    const eventMetricRows=results[6].data||[];\n'
assert old in s, 'eventMetricRows result not found'
s = s.replace(old, '', 1)

old = '      eventAnalysisHtml(eventMetricRows,periodLabel)+\n'
assert old in s, 'event analysis render call not found'
s = s.replace(old, '', 1)

# Keep the event tag in meetupCardHtml; only bump the mirror marker.
s = s.replace('const VERSION="my-community-20260927-event-analysis1";', 'const VERSION="my-community-20260927-event-tag-only1";', 1)

# Guard: the standalone analysis is gone, but the event tag field remains in Meetup cards.
assert 'function eventAnalysisHtml' not in s
assert 'eventMetricQuery' not in s
assert 'campfire_live_event_name' in s

p.write_text(s)
