export default {
  title: 'Hyperfunctions for analytics',
  duration: '11 min',
  summary: 'Fill gaps, measure counters and rates, and compute percentiles without dragging raw rows around.',
  objectives: [
    'Repair missing buckets with time_bucket_gapfill, locf and interpolate',
    'Measure a monotonic counter correctly with counter_agg',
    'Use time_weight for irregularly sampled data',
    'Compute percentiles and summary statistics with aggregate types',
  ],
  steps: [
    {
      title: 'The problem: your data has holes',
      explain:
        'Sensor 7 in this dataset went offline for six hours. A plain GROUP BY simply omits those buckets, ' +
        'which silently breaks charts, joins and any "value per interval" calculation - the gap looks like ' +
        'compressed time rather than missing data.',
      sql: `SELECT
  time_bucket('1 hour', time) AS bucket,
  count(*)                    AS samples
FROM readings
WHERE sensor_id = 7
  AND time >= now() - INTERVAL '3 days 2 hours'
  AND time <  now() - INTERVAL '2 days 14 hours'
GROUP BY bucket
ORDER BY bucket;`,
      maxRows: 14,
      takeaway:
        'Count the rows: a 12 hour window returns far fewer than 12 buckets. The missing hours are the outage.',
    },
    {
      title: 'time_bucket_gapfill: make the missing buckets appear',
      explain:
        'gapfill emits a row for every bucket in the requested range, whether or not data exists. The range ' +
        'comes from the WHERE clause, so it needs explicit start and end bounds on the time column.',
      sql: `SELECT
  time_bucket_gapfill('1 hour', time) AS bucket,
  count(*)                            AS samples,
  round(avg(temperature)::numeric, 2) AS avg_temp
FROM readings
WHERE sensor_id = 7
  AND time >= now() - INTERVAL '3 days 2 hours'
  AND time <  now() - INTERVAL '2 days 14 hours'
GROUP BY bucket
ORDER BY bucket;`,
      maxRows: 14,
      takeaway:
        'Now every hour is present and the outage is explicit: avg_temp is NULL exactly where data is missing.',
    },
    {
      title: 'locf() and interpolate(): decide what a gap means',
      explain:
        'A NULL is honest but rarely what a dashboard wants. locf ("last observation carried forward") holds ' +
        'the previous value, which suits state-like readings. interpolate draws a straight line between the ' +
        'values on either side, which suits continuous physical measurements.',
      sql: `SELECT
  time_bucket_gapfill('1 hour', time)              AS bucket,
  round(avg(temperature)::numeric, 2)              AS raw,
  locf(round(avg(temperature)::numeric, 2))        AS locf,
  interpolate(round(avg(temperature)::numeric, 2)) AS interpolated
FROM readings
WHERE sensor_id = 7
  AND time >= now() - INTERVAL '3 days 2 hours'
  AND time <  now() - INTERVAL '2 days 14 hours'
GROUP BY bucket
ORDER BY bucket;`,
      maxRows: 14,
      note:
        'locf and interpolate must be the outermost call in their column, so any rounding goes inside them. ' +
        'Choose deliberately: locf on a temperature graph invents a flat line, and interpolate on a device ' +
        'status invents states that never existed.',
    },
    {
      title: 'counter_agg: the right way to read a counter',
      explain:
        'energy_kwh only ever increases - it is a meter reading, not a measurement. max() - min() is wrong ' +
        'the moment the device restarts and the counter resets to zero. counter_agg understands resets, and ' +
        'delta() and rate() read the answer out of it.',
      sql: `SELECT
  sensor_id,
  round(delta(counter_agg(time, energy_kwh))::numeric, 2)       AS kwh_consumed,
  round((rate(counter_agg(time, energy_kwh)) * 3600)::numeric, 3) AS kwh_per_hour,
  num_resets(counter_agg(time, energy_kwh))                      AS resets
FROM readings
WHERE time >= now() - INTERVAL '24 hours'
GROUP BY sensor_id
ORDER BY sensor_id
LIMIT 6;`,
      takeaway:
        'rate() is per second, so multiply by 3600 for an hourly figure. This is the same family of functions ' +
        'as Prometheus rate/increase, but computed in the database.',
    },
    {
      title: 'time_weight: when samples are not evenly spaced',
      explain:
        'A plain avg() treats every row equally. If a sensor reports every minute while idle and every second ' +
        'while busy, the busy period dominates the average purely because it produced more rows. A ' +
        'time-weighted average weights each value by how long it was in effect.',
      sql: `SELECT
  sensor_id,
  round(avg(temperature)::numeric, 3)                                AS plain_avg,
  round(average(time_weight('Linear', time, temperature))::numeric, 3) AS time_weighted_avg
FROM readings
WHERE time >= now() - INTERVAL '24 hours'
GROUP BY sensor_id
ORDER BY sensor_id
LIMIT 6;`,
      note:
        "'Linear' assumes the value moved smoothly between samples; 'LOCF' assumes it held its last value " +
        'until the next reading. Use LOCF for step-like signals such as a thermostat setpoint.',
    },
    {
      title: 'Percentiles without sorting everything',
      explain:
        'An exact percentile has to sort the whole input. approx_percentile builds a small sketch instead, ' +
        'which is dramatically cheaper on large inputs and accurate enough for latency and SLA reporting.',
      sql: `SELECT
  round(approx_percentile(0.50, percentile_agg(temperature))::numeric, 2) AS p50,
  round(approx_percentile(0.95, percentile_agg(temperature))::numeric, 2) AS p95,
  round(approx_percentile(0.99, percentile_agg(temperature))::numeric, 2) AS p99
FROM readings
WHERE time >= now() - INTERVAL '7 days';`,
      takeaway:
        'percentile_agg builds the sketch and approx_percentile reads it. Because the sketch is a value, you ' +
        'can store it in a continuous aggregate and query percentiles later without the raw rows.',
    },
    {
      title: 'stats_agg: one pass, several statistics',
      explain:
        'stats_agg computes a summary in a single pass, then accessors pull individual numbers out of it. ' +
        'This beats calling avg, stddev and variance separately, each of which rescans the input.',
      sql: `SELECT
  s.site,
  round(average(stats_agg(r.temperature))::numeric, 2) AS mean,
  round(stddev(stats_agg(r.temperature))::numeric, 3)  AS stddev,
  round(num_vals(stats_agg(r.temperature))::numeric, 0) AS samples
FROM readings AS r
JOIN sensors  AS s USING (sensor_id)
WHERE r.time >= now() - INTERVAL '24 hours'
GROUP BY s.site
ORDER BY s.site;`,
    },
    {
      title: 'Why these compose so well with continuous aggregates',
      explain:
        'Aggregate types such as percentile_agg, stats_agg, counter_agg and time_weight are values you can ' +
        'store. Materialise the aggregate once per hour, then roll hours up into days later - without ever ' +
        'revisiting the raw rows. That is the pattern behind fast historical dashboards.',
      sql: `SELECT
  time_bucket('6 hours', time) AS bucket,
  round(approx_percentile(0.95, percentile_agg(temperature))::numeric, 2) AS p95_temp
FROM readings
WHERE time >= now() - INTERVAL '2 days'
GROUP BY bucket
ORDER BY bucket;`,
    },
  ],
  challenge: {
    prompt:
      'Return the 95th percentile of humidity over the last 24 hours, in a column named p95, using approx_percentile.',
    hint: 'approx_percentile(0.95, percentile_agg(humidity))',
    solution: `SELECT approx_percentile(0.95, percentile_agg(humidity)) AS p95 FROM readings WHERE time >= now() - INTERVAL '24 hours';`,
    check: (rows) => rows.length === 1 && Number(rows[0].p95) > 0,
  },
  next: 'Next: npm run lesson 07  (performance tuning)',
};
