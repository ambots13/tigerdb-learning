export default {
  title: 'The analytics toolkit',
  duration: '11 min',
  summary: 'States, uptime, downsampling and OHLC: the hyperfunctions that answer questions plain SQL struggles with.',
  objectives: [
    'Downsample a series for charting with lttb',
    'Measure how long things stayed in each state with state_agg',
    'Detect outages with heartbeat_agg',
    'Build OHLC candlesticks and integrate a signal over time',
  ],
  steps: [
    {
      title: 'Downsampling: 2000 points into 100, without lying',
      explain:
        'A chart 800 pixels wide cannot show 500,000 points. Naive approaches - every Nth row, or an ' +
        'average per bucket - flatten exactly the spikes you are looking for.\n\n' +
        'lttb (Largest Triangle Three Buckets) selects source points to approximate the visual shape. Its ' +
        'resolution is a target, not a guarantee of an exact output count or preservation of every extreme.',
      sql: `SELECT count(*) AS points_returned
FROM unnest((
  SELECT lttb(time, temperature, 100)
  FROM readings
  WHERE sensor_id = 1
    AND time >= now() - INTERVAL '2 days'
));`,
      takeaway:
        'One aggregate call replaces a hand-rolled sampling scheme, and the result is the same shape a ' +
        'human would draw.',
    },
    {
      title: 'What lttb actually kept',
      explain:
        'The downsampled series keeps the real timestamps and real values - these are original data ' +
        'points, not synthesised averages.',
      sql: `SELECT time, round(value::numeric, 2) AS temperature
FROM unnest((
  SELECT lttb(time, temperature, 100)
  FROM readings
  WHERE sensor_id = 1
    AND time >= now() - INTERVAL '2 days'
))
ORDER BY time
LIMIT 8;`,
      note:
        'Compare sampled and raw extrema as an empirical quality check. LTTB does not guarantee that the ' +
        'global minimum and maximum are selected.',
    },
    {
      title: 'Did downsampling preserve the extremes?',
      explain: 'A quick honesty check on the previous step.',
      sql: `WITH sampled AS (
  SELECT value FROM unnest((
    SELECT lttb(time, temperature, 100)
    FROM readings WHERE sensor_id = 1 AND time >= now() - INTERVAL '2 days'
  ))
)
SELECT
  (SELECT round(min(value)::numeric, 2) FROM sampled) AS sampled_min,
  (SELECT round(max(value)::numeric, 2) FROM sampled) AS sampled_max,
  (SELECT round(min(temperature)::numeric, 2) FROM readings
    WHERE sensor_id = 1 AND time >= now() - INTERVAL '2 days') AS raw_min,
  (SELECT round(max(temperature)::numeric, 2) FROM readings
    WHERE sensor_id = 1 AND time >= now() - INTERVAL '2 days') AS raw_max;`,
      takeaway:
        'Interpret the measured difference rather than assuming an invariant. LTTB optimizes visual ' +
        'similarity and can omit a global extreme.',
    },
    {
      title: 'state_agg: how long was it in each state?',
      explain:
        'Time-series data often encodes states rather than measurements: healthy or degraded, charging or ' +
        'draining, open or closed. The question is almost never "how many rows" but "how long".\n\n' +
        'state_agg builds a timeline from state changes, and duration_in totals the time spent in one ' +
        'state.',
      sql: `SELECT
  sensor_id,
  duration_in(states, 'ok')  AS time_ok,
  duration_in(states, 'low') AS time_low
FROM (
  SELECT
    sensor_id,
    state_agg(time, CASE WHEN battery > 75 THEN 'ok' ELSE 'low' END) AS states
  FROM readings
  WHERE time >= now() - INTERVAL '3 days'
  GROUP BY sensor_id
) AS s
ORDER BY sensor_id
LIMIT 6;`,
      takeaway:
        'Doing this in plain SQL means window functions to find transitions, then differencing timestamps ' +
        'and handling the edges. This is one aggregate.',
    },
    {
      title: 'The state timeline itself',
      explain:
        'state_timeline expands the aggregate back into the intervals it recorded - the audit trail behind ' +
        'the durations.',
      sql: `SELECT state, start_time, end_time
FROM state_timeline((
  SELECT state_agg(time, CASE WHEN battery > 75 THEN 'ok' ELSE 'low' END)
  FROM readings
  WHERE sensor_id = 4 AND time >= now() - INTERVAL '3 days'
))
ORDER BY start_time
LIMIT 8;`,
    },
    {
      title: 'heartbeat_agg: was it even alive?',
      explain:
        'Missing data is data. heartbeat_agg treats each row as a heartbeat and reports how much of a time ' +
        'range was covered, given a maximum tolerated gap. Anything longer than that gap counts as ' +
        'downtime.\n\n' +
        'Sensor 7 in this dataset was offline for six hours three days ago - here is that outage, measured.',
      sql: `SELECT
  sensor_id,
  uptime(hb)   AS live_time,
  downtime(hb) AS dead_time
FROM (
  SELECT
    sensor_id,
    heartbeat_agg(time, now() - INTERVAL '4 days', INTERVAL '4 days', INTERVAL '5 minutes') AS hb
  FROM readings
  WHERE sensor_id IN (6, 7, 8)
    AND time >= now() - INTERVAL '4 days'
  GROUP BY sensor_id
) AS s
ORDER BY sensor_id;`,
      takeaway:
        'Sensor 7 shows roughly six hours of downtime while its neighbours show almost none. No join, no ' +
        'gapfill, no calendar table.',
    },
    {
      title: 'When exactly was it down?',
      explain:
        'dead_ranges returns the gaps themselves, which is what an incident report actually needs. The ' +
        'long middle gap is the seeded six-hour outage; the short ones at each end are just the edges of ' +
        'the requested window.',
      sql: `SELECT
  "start",
  "end",
  "end" - "start" AS duration
FROM dead_ranges((
  SELECT heartbeat_agg(time, now() - INTERVAL '4 days', INTERVAL '4 days', INTERVAL '5 minutes')
  FROM readings
  WHERE sensor_id = 7 AND time >= now() - INTERVAL '4 days'
))
ORDER BY "start";`,
      note:
        'start and end are reserved words, so they need double quotes when selected by name.',
    },
    {
      title: 'candlestick_agg: OHLC for any series',
      explain:
        'Open, high, low and close is a financial idea, but it fits any series where the first and last ' +
        'value of a period matter - daily temperature ranges, session start and end values, meter ' +
        'readings.',
      sql: `SELECT
  time_bucket('1 day', time) AS day,
  round(open(candlestick_agg(time, temperature, 1.0))::numeric, 2)  AS open,
  round(high(candlestick_agg(time, temperature, 1.0))::numeric, 2)  AS high,
  round(low(candlestick_agg(time, temperature, 1.0))::numeric, 2)   AS low,
  round(close(candlestick_agg(time, temperature, 1.0))::numeric, 2) AS close
FROM readings
WHERE sensor_id = 1
  AND time >= now() - INTERVAL '5 days'
GROUP BY day
ORDER BY day;`,
      note:
        'The third argument is volume. Pass 1.0 when the concept does not apply and ignore the ' +
        'volume-weighted accessors. The aggregate cannot be GROUP BY-ed directly - it has no equality ' +
        'operator - so build it in the select list or store it in a continuous aggregate.',
    },
    {
      title: 'integral: area under the curve',
      explain:
        'Some questions need the value multiplied by the time it held: degree-hours, ampere-hours, ' +
        'cumulative exposure. integral() computes that from a time-weighted summary, correctly handling ' +
        'irregular sample spacing.',
      sql: `SELECT
  sensor_id,
  round(integral(time_weight('Linear', time, temperature), 'hour')::numeric, 1) AS degree_hours
FROM readings
WHERE time >= now() - INTERVAL '1 day'
GROUP BY sensor_id
ORDER BY sensor_id
LIMIT 6;`,
      takeaway:
        'Summing temperature x interval by hand gets the edges wrong. This does not.',
    },
    {
      title: 'Which states combine across buckets',
      explain:
        'state_agg, heartbeat_agg, candlestick, and time_weight are documented two-step aggregates whose ' +
        'states can be combined with matching rollup functions. LTTB is a downsampling aggregate returning ' +
        'a timevector and should not be presented as the same rollup pattern.',
      analogy: {
        title: 'Keep the Lego model, not just one answer about it',
        description: 'A finished Lego model can answer several questions: how tall, how many red blocks, or how heavy. One written number cannot.',
        mapping: 'Loose blocks are raw rows, the reusable Lego model is intermediate aggregate state, combining models is rollup, and each question is an accessor such as duration or delta.',
        source: `flowchart LR
  BLOCKS["Many loose Lego blocks"] --> MODEL["Build a reusable model"]
  MODEL --> TALL["Ask: how tall?"]
  MODEL --> RED["Ask: how many red blocks?"]
  MODEL --> WEIGHT["Ask: how heavy?"]
  NUMBER["Store only one answer"] --> LIMIT["Cannot answer a different question later"]
  classDef main fill:#332659,stroke:#d2a8ff,color:#ffffff
  classDef good fill:#173b2a,stroke:#3fb950,color:#ffffff
  classDef bad fill:#3d2020,stroke:#f85149,color:#ffffff
  class MODEL main
  class TALL,RED,WEIGHT good
  class NUMBER,LIMIT bad`,
      },
      diagram: {
        title: 'Two-step aggregates store state before deriving answers',
        description: 'Intermediate states can be rolled up across buckets and reused by several accessors; LTTB follows a separate downsampling path.',
        source: `flowchart LR
  RAW["Raw readings"] --> STATE["Intermediate aggregate state per bucket"]
  STATE --> ROLLUP["rollup combines bucket states"]
  ROLLUP --> A1["Ask for duration, average, delta, or integral"]
  ROLLUP --> A2["Ask another question from the same stored state"]
  RAW --> LTTB["LTTB downsampling"]
  LTTB --> VECTOR["A smaller set of representative points"]
  STATE --> NOTE["Path 1: reusable aggregate state"]
  VECTOR --> NOTE2["Path 2: reduced points; separate from rollup"]
  classDef state fill:#1c2f45,stroke:#58a6ff,color:#e6edf3
  classDef answer fill:#173b2a,stroke:#3fb950,color:#e6edf3
  class STATE,ROLLUP state
  class A1,A2,VECTOR,NOTE,NOTE2 answer`,
      },
      sql: `SELECT
  time_bucket('12 hours', time) AS bucket,
  duration_in(state_agg(time, CASE WHEN battery > 75 THEN 'ok' ELSE 'low' END), 'low') AS time_low
FROM readings
WHERE sensor_id = 4 AND time >= now() - INTERVAL '3 days'
GROUP BY bucket
ORDER BY bucket;`,
      takeaway:
        'The pattern throughout this lab: store the aggregate, not the answer. Answers are cheap to ' +
        'derive later; raw rows are not.',
    },
  ],
  challenge: {
    prompt:
      'Using lttb, target approximately 25 points for sensor 2 temperature over the last 24 hours, and return ' +
      'the number of points in a column named points.',
    hint: 'Wrap the lttb call in unnest(...) and count the rows.',
    solution: `SELECT count(*) AS points FROM unnest((SELECT lttb(time, temperature, 25) FROM readings WHERE sensor_id = 2 AND time >= now() - INTERVAL '24 hours'));`,
  },
  next: 'Next: npm run lesson 14  (reading query plans)',
};
