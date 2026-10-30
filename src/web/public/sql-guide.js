(() => {
  const keywordInsights = {
    SELECT: ['Read rows or compute values', 'SELECT defines the columns and expressions returned by this query.'],
    FROM: ['Choose the data source', 'FROM names the table, view, subquery, or function that supplies rows.'],
    WHERE: ['Filter rows', 'WHERE keeps only rows whose condition is true, reducing both the result and the work required.'],
    INSERT: ['Add rows', 'INSERT writes new rows into a table or hypertable.'],
    INTO: ['Choose the write target', 'INTO names the table that receives new rows or query output.'],
    VALUES: ['Provide literal rows', 'VALUES supplies one or more rows without reading them from another table.'],
    UPDATE: ['Change existing rows', 'UPDATE modifies rows that match its WHERE condition.'],
    SET: ['Assign new values', 'SET pairs columns or configuration options with their new values.'],
    DELETE: ['Remove rows', 'DELETE removes rows; a WHERE clause limits which rows are affected.'],
    CREATE: ['Create a database object', 'CREATE defines a new table, view, index, function, or other database object.'],
    ALTER: ['Change an object definition', 'ALTER changes the properties of an existing database object.'],
    DROP: ['Remove a database object', 'DROP deletes an object definition and, depending on the object, its stored data.'],
    TABLE: ['Work with a table', 'TABLE identifies the object as a row-and-column relation.'],
    VIEW: ['Work with a saved query', 'A view presents a stored query as if it were a table.'],
    INDEX: ['Work with an index', 'An index is an auxiliary structure that can avoid scanning every row.'],
    FUNCTION: ['Work with a function', 'A database function packages reusable SQL or procedural logic.'],
    AS: ['Assign a name or define a query', 'AS gives an expression an alias or introduces the query behind a view.'],
    JOIN: ['Combine related rows', 'JOIN combines rows from two sources using the following ON condition.'],
    LEFT: ['Keep every left-side row', 'LEFT JOIN preserves rows from the source on the left even when no match exists.'],
    RIGHT: ['Keep every right-side row', 'RIGHT JOIN preserves rows from the source on the right even when no match exists.'],
    INNER: ['Keep matching rows', 'INNER JOIN returns only row pairs that satisfy the join condition.'],
    CROSS: ['Form every row combination', 'CROSS JOIN pairs every row on the left with every row on the right.'],
    LATERAL: ['Let a source reference earlier sources', 'LATERAL evaluates the following source for each preceding row.'],
    ON: ['Define a join or conflict condition', 'ON introduces the condition used to match rows or handle a write conflict.'],
    GROUP: ['Build groups', 'GROUP BY collects rows sharing the same values so aggregates can summarize each group.'],
    BY: ['Supply grouping or ordering keys', 'BY introduces the expressions used by the preceding GROUP, ORDER, or PARTITION clause.'],
    HAVING: ['Filter completed groups', 'HAVING filters aggregate groups after GROUP BY, unlike WHERE which filters input rows.'],
    ORDER: ['Sort result rows', 'ORDER BY controls the order in which rows are returned.'],
    ASC: ['Sort ascending', 'ASC orders smaller or earlier values first.'],
    DESC: ['Sort descending', 'DESC orders larger or later values first.'],
    LIMIT: ['Cap the result size', 'LIMIT returns at most this many rows, useful for exploration and bounded output.'],
    OFFSET: ['Skip leading rows', 'OFFSET discards this many rows before returning the result.'],
    DISTINCT: ['Remove duplicates', 'DISTINCT keeps one copy of each unique selected value combination.'],
    OVER: ['Define an analytic window', 'OVER lets a window function calculate across related rows without collapsing them.'],
    PARTITION: ['Divide rows into independent windows', 'PARTITION BY restarts a window calculation for each key.'],
    WITH: ['Define options or reusable query blocks', 'WITH introduces table options or common table expressions, depending on its position.'],
    RECURSIVE: ['Allow a CTE to reference itself', 'RECURSIVE supports iterative queries such as traversing a hierarchy.'],
    UNION: ['Combine query results', 'UNION appends compatible result sets and removes duplicates unless ALL is specified.'],
    ALL: ['Keep all values', 'ALL usually preserves duplicates rather than deduplicating a result.'],
    RETURNING: ['Return affected rows', 'RETURNING exposes values from rows changed by INSERT, UPDATE, or DELETE.'],
    CONFLICT: ['Handle duplicate-key writes', 'ON CONFLICT defines what to do when an insert violates a unique constraint.'],
    DO: ['Choose the conflict action', 'DO introduces the action taken for a matching conflict.'],
    NOTHING: ['Skip the conflicting row', 'DO NOTHING leaves the existing row unchanged instead of raising an error.'],
    EXCLUDED: ['Reference the proposed row', 'EXCLUDED exposes values from the row that could not be inserted during an upsert.'],
    NULL: ['Represent a missing value', 'NULL means unknown or absent; it is not equal to any value, including another NULL.'],
    IS: ['Test SQL states', 'IS safely tests states such as NULL, TRUE, FALSE, or DISTINCT FROM.'],
    NOT: ['Negate a condition', 'NOT reverses the truth value of the condition that follows.'],
    AND: ['Require both conditions', 'AND keeps a row only when both surrounding conditions are true.'],
    OR: ['Allow either condition', 'OR keeps a row when either surrounding condition is true.'],
    IN: ['Match one of several values', 'IN checks whether a value occurs in a list or subquery result.'],
    BETWEEN: ['Test an inclusive range', 'BETWEEN checks whether a value lies between two inclusive bounds.'],
    LIKE: ['Match a text pattern', 'LIKE compares text using % for any sequence and _ for one character.'],
    CASE: ['Choose a value conditionally', 'CASE evaluates conditions in order and returns the first matching result.'],
    WHEN: ['Introduce a condition', 'WHEN defines one branch of a CASE expression.'],
    THEN: ['Return the branch result', 'THEN supplies the value for a matching WHEN condition.'],
    ELSE: ['Provide a fallback', 'ELSE supplies the result when no earlier branch matches.'],
    END: ['Close a SQL block', 'END marks the end of CASE or a procedural block.'],
    INTERVAL: ['Create a time duration', 'INTERVAL turns the following text into a PostgreSQL duration for time arithmetic.'],
    EXPLAIN: ['Show the execution plan', 'EXPLAIN asks PostgreSQL how it will execute a statement instead of only showing its rows.'],
    ANALYZE: ['Execute and measure the plan', 'With EXPLAIN, ANALYZE runs the query and reports actual timings and row counts.'],
    BUFFERS: ['Report cache and disk activity', 'BUFFERS shows how many data pages were read from cache or storage.'],
    COSTS: ['Control planner estimates', 'COSTS controls whether estimated startup and total costs appear in EXPLAIN.'],
    TIMING: ['Control per-node timing', 'TIMING controls detailed execution timing, which can itself add measurement overhead.'],
    SUMMARY: ['Control the plan summary', 'SUMMARY controls planning and total execution statistics at the end of EXPLAIN.'],
    IF: ['Apply a condition', 'IF makes the operation conditional, commonly avoiding an error when an object is absent.'],
    EXISTS: ['Test whether rows or objects exist', 'EXISTS succeeds when its subquery returns at least one row.'],
    CASCADE: ['Include dependent objects', 'CASCADE also applies the operation to objects that depend on this one.'],
    MATERIALIZED: ['Store query results', 'A materialized view persists its result so reads do not recompute the full query.'],
    DEFAULT: ['Use the predefined value', 'DEFAULT uses the value configured in the column or option definition.'],
    PRIMARY: ['Start a primary-key declaration', 'A primary key uniquely identifies each row and implies NOT NULL.'],
    KEY: ['Identify a constraint key', 'A key is one or more columns used to uniquely identify or relate rows.'],
    UNIQUE: ['Require distinct values', 'UNIQUE prevents duplicate values for the constrained column combination.'],
    REFERENCES: ['Declare a foreign key target', 'REFERENCES links values to a key in another table.'],
    CHECK: ['Enforce a row rule', 'CHECK rejects rows for which its condition is false.'],
    CALL: ['Run a stored procedure', 'CALL invokes a PostgreSQL procedure, which can perform database operations without returning a query result.'],
    USING: ['Specify how an operation works', 'USING introduces an index method, join expression, or implementation detail required by the preceding command.'],
    FILTER: ['Filter one aggregate', 'FILTER applies its WHERE condition only to the aggregate immediately before it.'],
    INCLUDE: ['Store extra values in an index', 'INCLUDE adds non-key columns so some queries can be answered directly from the index.'],
    EXTENSION: ['Work with a PostgreSQL extension', 'An extension installs a packaged set of database types, functions, and other objects.'],
    ADD: ['Add a property or object', 'ADD introduces a new column, constraint, or policy on an existing object.'],
    COLUMN: ['Identify a table column', 'COLUMN makes explicit that the operation applies to a named field in each row.'],
    CONSTRAINT: ['Define a data rule', 'A constraint makes PostgreSQL enforce validity or uniqueness whenever data changes.'],
    REPLACE: ['Replace an existing definition', 'OR REPLACE updates a supported object definition without requiring a separate drop.'],
    PROCEDURE: ['Define a stored procedure', 'A procedure packages server-side operations and is invoked with CALL.'],
    LANGUAGE: ['Choose the function language', 'LANGUAGE identifies how a function or procedure body should be interpreted.'],
    RETURNS: ['Declare a function result type', 'RETURNS tells PostgreSQL what kind of value or rows the function produces.'],
    DECLARE: ['Declare procedural variables', 'DECLARE introduces local variables used inside a PostgreSQL procedural block.'],
    BEGIN: ['Start a procedural or transaction block', 'BEGIN opens the executable body of a block or starts a transaction.'],
    LOOP: ['Repeat procedural statements', 'LOOP repeatedly executes its body until an exit condition is reached.'],
    FOR: ['Iterate or configure an operation', 'FOR introduces a procedural iteration target or an option belonging to the preceding clause.'],
    PERFORM: ['Execute and discard a result', 'PL/pgSQL PERFORM runs a query or function when its returned rows are not needed.'],
    EXECUTE: ['Run dynamically constructed SQL', 'EXECUTE evaluates a SQL command assembled at runtime in procedural code.'],
    RETURN: ['Return from procedural code', 'RETURN sends a function result or ends the current procedural invocation.'],
    OFF: ['Disable an option', 'OFF turns off the named PostgreSQL option for this statement or session.'],
    NO: ['Negate the following option', 'NO disables or omits the behavior named immediately after it.'],
    DATA: ['Refer to stored rows', 'DATA distinguishes stored query rows from an object’s definition or metadata.'],
    ARRAY: ['Construct or identify an array', 'ARRAY represents an ordered PostgreSQL collection of values of one element type.'],
    ORDINALITY: ['Add sequence numbers', 'WITH ORDINALITY adds a 1-based position column to rows returned by a set-returning function.'],
    TEXT: ['Use the text data type', 'TEXT stores variable-length character data without a fixed maximum length.'],
    TIMESTAMPTZ: ['Use a timezone-aware timestamp', 'TIMESTAMPTZ stores an absolute instant and displays it in the session time zone.'],
    INTEGER: ['Use a whole-number type', 'INTEGER stores signed whole numbers in four bytes.'],
    INT: ['Use a whole-number type', 'INT is PostgreSQL shorthand for INTEGER.'],
    BIGINT: ['Use a large whole-number type', 'BIGINT stores signed whole numbers in eight bytes.'],
    DOUBLE: ['Start a double-precision type', 'DOUBLE PRECISION stores an approximate 64-bit floating-point number.'],
    PRECISION: ['Complete a precision declaration', 'Here PRECISION completes the DOUBLE PRECISION floating-point data type.'],
    JSON: ['Use JSON data', 'JSON stores validated JSON text while preserving its original formatting.'],
    JSONB: ['Use binary JSON data', 'JSONB stores parsed JSON efficiently and supports indexing and structural operators.'],
    SERIAL: ['Create an auto-numbering column', 'SERIAL creates an integer column backed by a sequence for generated IDs.'],
    FORMAT: ['Format dynamic text', 'FORMAT safely assembles text using placeholders, commonly for dynamic SQL.'],
    CURRENT_DATE: ['Read today’s date', 'CURRENT_DATE returns the transaction’s calendar date in the session time zone.'],
  };

  const functionInsights = {
    avg: 'Calculates the arithmetic mean of non-NULL input values.',
    count: 'Counts input rows or non-NULL values; count(*) counts every row.',
    min: 'Returns the smallest non-NULL input value.',
    max: 'Returns the largest non-NULL input value.',
    sum: 'Adds all non-NULL input values.',
    round: 'Rounds a number to the requested precision.',
    now: 'Returns the current transaction timestamp as TIMESTAMPTZ.',
    time_bucket: 'Groups timestamps into fixed-width TimescaleDB time buckets for aggregation.',
    time_bucket_gapfill: 'Creates time buckets and also emits missing buckets so gaps can be filled.',
    locf: 'Fills gaps by carrying the last observed value forward.',
    interpolate: 'Fills gaps by estimating values between surrounding observations.',
    first: 'Returns the value associated with the earliest ordering value in an aggregate group.',
    last: 'Returns the value associated with the latest ordering value in an aggregate group.',
    create_hypertable: 'Converts a PostgreSQL table into a TimescaleDB hypertable partitioned by time.',
    hypertable_size: 'Reports the total storage used by a hypertable and its chunks.',
    chunks_detailed_size: 'Reports table, index, and total bytes for each chunk.',
    add_retention_policy: 'Schedules automatic removal of chunks older than a configured age.',
    add_continuous_aggregate_policy: 'Schedules incremental refreshes for a continuous aggregate.',
    add_columnstore_policy: 'Schedules old chunks for conversion to the columnstore.',
    drop_chunks: 'Removes complete chunks older than a time boundary efficiently.',
    to_columnstore: 'Converts a chunk or hypertable data to TimescaleDB columnar storage.',
    to_timestamp: 'Converts a Unix timestamp or formatted value into a PostgreSQL timestamp.',
    date_trunc: 'Truncates a timestamp to a calendar boundary such as hour or day.',
    coalesce: 'Returns the first non-NULL argument, providing a fallback for missing values.',
    nullif: 'Returns NULL when its two arguments are equal, often preventing invalid arithmetic.',
    jsonb_build_object: 'Builds a JSONB object from alternating key and value arguments.',
    generate_series: 'Produces a sequence of numbers or timestamps as query rows.',
    percentile_agg: 'Builds a Toolkit percentile summary that can be queried approximately.',
    approx_percentile: 'Reads an approximate percentile from a Toolkit percentile summary.',
    counter_agg: 'Summarizes a monotonically increasing counter while accounting for resets.',
    time_weight: 'Builds a time-weighted summary for irregularly spaced measurements.',
    average: 'Reads the time-weighted average from a Toolkit summary.',
    integral: 'Calculates area under a time-weighted series.',
    state_agg: 'Summarizes how long a value remained in each state.',
    duration_in: 'Reads time spent in a particular state from a state aggregate.',
    heartbeat_agg: 'Summarizes expected heartbeat events and observed gaps.',
    live_ranges: 'Returns time ranges considered live by a heartbeat aggregate.',
    lttb: 'Downsamples a time series while preserving its visual shape.',
  };

  const relationInsights = {
    pg_extension: 'PostgreSQL system catalog listing installed extensions and their versions.',
    pg_tables: 'PostgreSQL catalog view listing tables visible in each schema.',
    pg_indexes: 'PostgreSQL catalog view describing indexes and their definitions.',
    information_schema: 'SQL-standard metadata schema for discovering database objects and columns.',
    timescaledb_information: 'TimescaleDB metadata schema containing supported views for hypertables, chunks, jobs, policies, and compression.',
    readings: 'The lab’s main hypertable containing timestamped measurements from every sensor.',
    sensors: 'The lab’s ordinary PostgreSQL metadata table describing each sensor and site.',
    conditions: 'A small teaching hypertable created in the hypertables lesson.',
    fleet_telemetry: 'A hypertable used by the capstone pipeline to represent incoming fleet measurements.',
  };

  const relatedInsights = {
    SELECT: [
      ['SELECT DISTINCT', 'Return unique result rows.'],
      ['VALUES', 'Create a small result directly from literal rows.'],
      ['WITH', 'Name intermediate queries to make a larger read easier to follow.'],
    ],
    INSERT: [
      ['COPY', 'Bulk-load many rows much faster than individual inserts.'],
      ['INSERT … ON CONFLICT', 'Insert a row or update/skip it when a unique key already exists.'],
      ['UPDATE', 'Change rows that are already stored.'],
    ],
    UPDATE: [
      ['INSERT … ON CONFLICT', 'Combine insert and update behavior in one upsert.'],
      ['RETURNING', 'Return the changed rows without running another query.'],
      ['DELETE', 'Remove matching rows instead of changing them.'],
    ],
    DELETE: [
      ['TRUNCATE', 'Quickly remove every row from a regular table.'],
      ['drop_chunks()', 'Remove complete time ranges from a hypertable efficiently.'],
      ['add_retention_policy()', 'Schedule automatic removal of old chunks.'],
    ],
    CREATE: [
      ['ALTER', 'Change an existing object instead of creating another one.'],
      ['CREATE OR REPLACE', 'Replace supported object definitions in place.'],
      ['DROP', 'Remove an object that is no longer needed.'],
    ],
    DROP: [
      ['IF EXISTS', 'Avoid an error when the object may already be absent.'],
      ['DELETE', 'Remove selected rows while keeping the table.'],
      ['TRUNCATE', 'Empty a regular table while keeping its definition.'],
    ],
    WHERE: [
      ['HAVING', 'Filter groups after aggregation.'],
      ['FILTER (WHERE …)', 'Filter the input to one aggregate only.'],
      ['Partial index', 'Index only rows that match a frequently used predicate.'],
    ],
    JOIN: [
      ['LEFT JOIN', 'Keep every left-side row even when no match exists.'],
      ['CROSS JOIN', 'Produce every combination of rows.'],
      ['LATERAL JOIN', 'Evaluate a source using values from each preceding row.'],
    ],
    GROUP: [
      ['DISTINCT', 'Deduplicate rows without calculating aggregates.'],
      ['Window function', 'Calculate across related rows without collapsing them.'],
      ['time_bucket()', 'Group time-series rows into fixed intervals.'],
    ],
    ORDER: [
      ['ORDER BY … DESC', 'Return larger or newer values first.'],
      ['Window ORDER BY', 'Control calculation order inside an analytic window.'],
      ['Index ordering', 'Let a matching index avoid a separate sort.'],
    ],
    INDEX: [
      ['B-tree', 'Default choice for equality, ranges, and ordered retrieval.'],
      ['BRIN', 'Tiny index for naturally ordered, very large tables.'],
      ['GIN', 'Index composite values such as JSONB, arrays, and full-text data.'],
    ],
    EXPLAIN: [
      ['EXPLAIN ANALYZE', 'Execute the query and compare actual work with estimates.'],
      ['BUFFERS', 'Show cache hits and physical block reads.'],
      ['FORMAT JSON', 'Return a machine-readable plan for tools and deeper analysis.'],
    ],
    TIMESTAMPTZ: [
      ['TIMESTAMP', 'Store date and time without representing an absolute time zone-aware instant.'],
      ['DATE', 'Store a calendar date with no time of day.'],
      ['INTERVAL', 'Store or calculate a duration such as seven days.'],
    ],
    TEXT: [
      ['VARCHAR(n)', 'Store text with an enforced maximum character length.'],
      ['JSONB', 'Store structured JSON that can be queried and indexed.'],
      ['ENUM', 'Restrict a value to a predefined set of labels.'],
    ],
    JSONB: [
      ['JSON', 'Preserve the original JSON text rather than a parsed binary representation.'],
      ['Composite type', 'Store a fixed, strongly typed group of fields.'],
      ['Normalized table', 'Store repeated structured entities as relational rows.'],
    ],
    INTEGER: [
      ['SMALLINT', 'Use two bytes for a smaller whole-number range.'],
      ['BIGINT', 'Use eight bytes for a much larger whole-number range.'],
      ['NUMERIC', 'Store exact decimal values with configurable precision.'],
    ],
    INT: [
      ['SMALLINT', 'Use two bytes for a smaller whole-number range.'],
      ['BIGINT', 'Use eight bytes for a much larger whole-number range.'],
      ['NUMERIC', 'Store exact decimal values with configurable precision.'],
    ],
    BIGINT: [
      ['INTEGER', 'Use four bytes when the smaller range is sufficient.'],
      ['NUMERIC', 'Use arbitrary precision when even BIGINT is not enough.'],
      ['BIGSERIAL', 'Generate increasing BIGINT identifiers automatically.'],
    ],
    DOUBLE: [
      ['NUMERIC', 'Use exact decimal arithmetic when rounding errors are unacceptable.'],
      ['REAL', 'Use a smaller, lower-precision floating-point value.'],
      ['BIGINT', 'Store scaled whole units when exact integer arithmetic is preferable.'],
    ],
    SERIAL: [
      ['GENERATED AS IDENTITY', 'Modern SQL-standard auto-numbering with clearer ownership.'],
      ['UUID', 'Generate identifiers without coordinating a shared sequence.'],
      ['BIGSERIAL', 'Use an automatically generated 64-bit integer.'],
    ],
    'time_bucket': [
      ['date_trunc()', 'Align timestamps to calendar boundaries without TimescaleDB.'],
      ['time_bucket_gapfill()', 'Emit missing buckets so gaps can be filled.'],
      ['Continuous aggregate', 'Persist and incrementally refresh repeated bucketed results.'],
    ],
    'time_bucket_gapfill': [
      ['time_bucket()', 'Bucket only timestamps that actually have rows.'],
      ['locf()', 'Fill a missing bucket with the last observed value.'],
      ['interpolate()', 'Estimate a missing value between neighboring observations.'],
    ],
    'avg': [
      ['time_weight()', 'Account for irregular time gaps before calculating an average.'],
      ['percentile_agg()', 'Summarize a distribution instead of only its mean.'],
      ['min()/max()', 'Inspect the range around the average.'],
    ],
    'count': [
      ['count(*)', 'Count every row, including rows containing NULL columns.'],
      ['count(column)', 'Count only rows where that column is not NULL.'],
      ['approx_count_distinct()', 'Estimate unique values with bounded memory on large data.'],
    ],
    'now': [
      ['CURRENT_TIMESTAMP', 'SQL-standard spelling for the current transaction timestamp.'],
      ['clock_timestamp()', 'Read the actual wall-clock time even during a long transaction.'],
      ['CURRENT_DATE', 'Read today’s date without a time component.'],
    ],
    'create_hypertable': [
      ['WITH (tsdb.hypertable)', 'Create a hypertable declaratively with the table definition.'],
      ['Regular table', 'Keep PostgreSQL storage when time partitioning is unnecessary.'],
      ['Distributed design', 'Partition at the application or service level for different scaling needs.'],
    ],
    'drop_chunks': [
      ['DELETE', 'Remove arbitrary matching rows but with more row-level work.'],
      ['add_retention_policy()', 'Schedule recurring chunk removal automatically.'],
      ['DROP TABLE', 'Remove the entire hypertable and its definition.'],
    ],
    'to_columnstore': [
      ['add_columnstore_policy()', 'Convert old chunks automatically on a schedule.'],
      ['Rowstore', 'Keep frequently updated or point-looked-up data in row-oriented storage.'],
      ['Segment/order settings', 'Control how columnstore rows are grouped and sorted.'],
    ],
  };

  const planNodeInsights = {
    'Seq Scan': ['Sequential scan', 'Reads a table from beginning to end and tests each row.', 'Healthy for a large share of a table; suspicious when a selective predicate should use an index.'],
    'Parallel Seq Scan': ['Parallel sequential scan', 'Multiple workers divide a full-table scan into blocks and read them concurrently.', 'Useful for large scans; inspect Gather and worker counts to see how parallel work combines.'],
    'Index Scan': ['Index scan', 'Uses an index to find row locations, then visits the table for required values.', 'Strong for selective predicates, but many random table visits can become expensive.'],
    'Parallel Index Scan': ['Parallel index scan', 'Multiple workers cooperate to navigate an index and fetch matching table rows.', 'It helps when an index returns enough rows to justify worker coordination.'],
    'Index Only Scan': ['Index-only scan', 'Answers the query from index entries when PostgreSQL can confirm heap rows are visible.', 'Often ideal for selective reads because it can avoid table-page access. Check Heap Fetches.'],
    'Parallel Index Only Scan': ['Parallel index-only scan', 'Multiple workers return values from an index while avoiding most table visits.', 'Check Heap Fetches and worker participation to confirm the expected benefit.'],
    'Bitmap Index Scan': ['Bitmap index scan', 'Collects matching row locations from an index into a bitmap.', 'Useful when enough rows match that batching table-page visits is cheaper than random index-scan reads.'],
    'Bitmap Heap Scan': ['Bitmap heap scan', 'Visits table pages identified by one or more bitmap index scans.', 'Look at exact/lossy heap blocks and rows removed by recheck to judge bitmap precision.'],
    'Parallel Bitmap Heap Scan': ['Parallel bitmap heap scan', 'Workers share table-page visits identified by a bitmap.', 'Useful for medium-to-large matching sets when one worker would scan too many heap pages.'],
    'Custom Scan (ChunkAppend)': ['TimescaleDB ChunkAppend', 'TimescaleDB chooses relevant hypertable chunks and appends their rows.', 'Check chunks excluded and the child scans to see whether the time predicate pruned enough data.'],
    ChunkAppend: ['TimescaleDB ChunkAppend', 'TimescaleDB chooses relevant hypertable chunks and appends their rows.', 'Check chunks excluded and the child scans to see whether the time predicate pruned enough data.'],
    Append: ['Append', 'Runs multiple child branches and concatenates their rows.', 'For a hypertable, each child often represents a chunk; fewer children usually mean effective pruning.'],
    'Merge Append': ['Merge append', 'Combines already sorted child streams while preserving order.', 'This can avoid a separate full sort when child scans provide compatible ordering.'],
    'Nested Loop': ['Nested-loop join', 'For each outer row, runs or probes the inner child for matching rows.', 'Excellent with few outer rows and indexed inner lookups; costly when the inner side repeats many times.'],
    'Hash Join': ['Hash join', 'Builds an in-memory hash table from one child and probes it with rows from the other.', 'Good for larger equality joins; inspect memory, batches, and row estimates.'],
    'Merge Join': ['Merge join', 'Walks two inputs ordered by the join key and matches them in one pass.', 'Efficient for large sorted inputs, but required sorts can dominate the cost.'],
    Hash: ['Hash table build', 'Builds an in-memory lookup structure for a hash join.', 'Batches greater than one can indicate spilling or insufficient work memory.'],
    Aggregate: ['Aggregate', 'Combines input rows to calculate values such as count, sum, or average.', 'A plain Aggregate commonly produces one result from all input rows.'],
    HashAggregate: ['Hash aggregate', 'Groups rows in a hash table and calculates aggregates per group.', 'Fast when groups fit in memory; inspect memory usage and batches for spill risk.'],
    'Partial HashAggregate': ['Partial hash aggregate', 'Calculates intermediate grouped states before a final aggregation step.', 'This reduces data early, often once per chunk or parallel worker.'],
    'Finalize HashAggregate': ['Finalize hash aggregate', 'Combines partial aggregate states into final result values.', 'Its children did most row-level work; this node completes the grouped result.'],
    GroupAggregate: ['Group aggregate', 'Aggregates rows that arrive ordered by the grouping keys.', 'It can stream groups with low memory, but may require a preceding sort.'],
    WindowAgg: ['Window aggregate', 'Calculates window functions across related rows without collapsing them.', 'Sorts below this node often establish PARTITION BY and ORDER BY requirements.'],
    Sort: ['Sort', 'Orders all incoming rows by one or more keys.', 'Check sort method, memory, and input row count; disk-based sorts are a tuning signal.'],
    'Incremental Sort': ['Incremental sort', 'Reuses ordering already present in a prefix of the sort keys.', 'Usually cheaper than sorting the entire input from scratch.'],
    Limit: ['Limit', 'Stops after producing the requested number of rows.', 'It saves work only when child nodes can also stop early, often through matching index order.'],
    Unique: ['Unique', 'Removes duplicate rows from ordered input.', 'Its child usually sorts or supplies index order so duplicates can be compared together.'],
    Gather: ['Gather', 'Collects rows produced by parallel workers into the leader process.', 'Compare workers planned/launched and child loops to understand parallel participation.'],
    'Gather Merge': ['Gather merge', 'Collects parallel worker rows while preserving their sort order.', 'It supports ordered parallel plans without a new global sort.'],
    Materialize: ['Materialize', 'Stores a child result temporarily so it can be read again cheaply.', 'Useful for repeated reads, but large materialized results consume memory or temporary storage.'],
    Memoize: ['Memoize', 'Caches inner results by lookup key during a nested-loop join.', 'High cache hits can make repeated parameterized lookups much cheaper.'],
    'CTE Scan': ['CTE scan', 'Reads rows produced by a common table expression.', 'Whether work is reused or optimized through depends on CTE materialization behavior.'],
    'Subquery Scan': ['Subquery scan', 'Reads the result of a nested SELECT as a row source.', 'The child nodes reveal the actual work performed inside the subquery.'],
    'Function Scan': ['Function scan', 'Reads rows emitted by a set-returning function.', 'Estimate accuracy depends on how well PostgreSQL knows the function’s result size.'],
    'Values Scan': ['Values scan', 'Reads literal rows supplied by a VALUES clause.', 'This is normally a small, inexpensive in-memory source.'],
    'Foreign Scan': ['Foreign scan', 'Reads rows through a foreign data wrapper from an external source.', 'Remote filtering and transfer volume often dominate; inspect remote SQL when available.'],
    'Tid Scan': ['Tuple-ID scan', 'Fetches table rows directly by physical tuple identifiers.', 'This is specialized and efficient only when tuple locations are already known.'],
    LockRows: ['Row locking', 'Locks selected rows for clauses such as FOR UPDATE or FOR SHARE.', 'Contention and waiting may matter even when the underlying read is fast.'],
    SetOp: ['Set operation', 'Implements duplicate-aware operations such as INTERSECT or EXCEPT.', 'Its child ordering or hashing determines the cost of comparing result sets.'],
    'Recursive Union': ['Recursive union', 'Repeatedly evaluates the recursive branch of a recursive CTE.', 'Watch loops and row growth because recursive work can expand quickly.'],
    Result: ['Result', 'Computes expressions or emits a row without scanning a table.', 'Often inexpensive; a One-Time Filter can prevent its child from running at all.'],
  };

  const planAttributeInsights = {
    'Sort Key': ['Sort key', 'The expressions PostgreSQL uses to order rows.', 'Compare this with ORDER BY, GROUP BY, window ordering, or index column order.'],
    'Sort Method': ['Sort method', 'The algorithm and storage PostgreSQL used to sort.', 'quicksort is in memory; external merge indicates a disk spill and may benefit from more work_mem.'],
    'Presorted Key': ['Presorted key', 'Input columns that already have useful ordering before an incremental sort.', 'More presorted keys mean less data must be reordered from scratch.'],
    'Group Key': ['Grouping key', 'The expressions that define one aggregate group.', 'Rows with equal key values collapse into one aggregate result.'],
    Output: ['Node output', 'Columns and expressions this node passes to its parent.', 'Use this to track where computed values appear and whether unnecessarily wide rows travel upward.'],
    'Hash Cond': ['Hash join condition', 'The equality condition used to hash and match join rows.', 'Confirm it represents the intended relationship and uses compatible data types.'],
    'Merge Cond': ['Merge join condition', 'The ordered equality condition used by a merge join.', 'Both child streams must be ordered by these keys.'],
    'Join Filter': ['Join filter', 'A condition applied after candidate row pairs are formed.', 'Many rows removed here can indicate work that an earlier join condition could avoid.'],
    'Index Cond': ['Index condition', 'A predicate applied while navigating the index.', 'This reduces table work early and is usually more valuable than a later Filter.'],
    'Recheck Cond': ['Recheck condition', 'A predicate re-evaluated on table rows found by a bitmap scan.', 'Rechecks are normal; many lossy blocks can increase their cost.'],
    Filter: ['Filter', 'A condition tested after this node obtains a row.', 'Rows Removed by Filter shows wasted work; an index or earlier predicate may reduce it.'],
    'Rows Removed by Filter': ['Rows removed by filter', 'Rows this node read but rejected after applying its Filter.', 'A large value relative to rows returned signals avoidable scanning.'],
    'Rows Removed by Join Filter': ['Rows removed by join filter', 'Candidate row pairs rejected after the join generated them.', 'A large count can expose an inefficient join order or incomplete join condition.'],
    Buffers: ['Buffer activity', 'Database pages touched in shared cache, local memory, or temporary storage.', 'Hits came from cache; reads required storage access; temp reads/writes indicate spill activity.'],
    'I/O Timings': ['Storage I/O timing', 'Time spent waiting for data-file reads and writes when track_io_timing is enabled.', 'High I/O time relative to execution time points toward storage access rather than CPU work.'],
    Memory: ['Sort memory', 'Memory consumed by this sort operation.', 'If the method reports disk or external merge instead, the sort exceeded available work memory.'],
    Disk: ['Temporary disk usage', 'Temporary storage consumed after an operation could not remain fully in memory.', 'Disk spills are slower and can sometimes be reduced with better filtering, indexes, or carefully tuned work_mem.'],
    'Memory Usage': ['Memory usage', 'Memory consumed by this node’s hash or aggregate structure.', 'Compare with work_mem and multiply by concurrent nodes, workers, and sessions.'],
    'Peak Memory Usage': ['Peak memory usage', 'Highest memory consumption reported for this node.', 'Use it to reason about concurrency rather than judging one query in isolation.'],
    Batches: ['Hash batches', 'How many partitions a hash operation used.', 'One batch stayed in memory; multiple batches usually indicate partitioning and possible disk work.'],
    'Heap Fetches': ['Heap fetches', 'Table rows an index-only scan still had to visit for visibility checks.', 'Lower is better; VACUUM-maintained visibility maps help keep this near zero.'],
    'Chunks excluded during startup': ['Chunks excluded at startup', 'Hypertable chunks TimescaleDB pruned using values known when execution began.', 'More exclusion means less data opened; ensure time predicates target the partitioning column.'],
    'Chunks excluded during runtime': ['Chunks excluded at runtime', 'Chunks pruned using parameter values learned during execution.', 'This is valuable for prepared or parameterized time-series queries.'],
    'Workers Planned': ['Workers planned', 'Parallel workers PostgreSQL intended to use.', 'Parallelism has coordination overhead and helps most when enough work can be divided.'],
    'Workers Launched': ['Workers launched', 'Parallel workers that were actually started.', 'Fewer than planned can indicate system-wide worker limits or resource pressure.'],
    'Cache Key': ['Memoize cache key', 'Values used to look up a previously cached inner result.', 'Repeated keys produce hits and avoid rerunning the child branch.'],
    Hits: ['Memoize cache hits', 'Lookups served from previously cached results.', 'A high hit count means Memoize is avoiding repeated child work.'],
    Misses: ['Memoize cache misses', 'Lookups that required executing the child and caching a new result.', 'Many unique keys reduce the benefit of memoization.'],
    Evictions: ['Memoize evictions', 'Cached entries removed to stay within memory limits.', 'Frequent evictions can cause repeated work if removed keys are needed again.'],
    Overflows: ['Memoize overflows', 'Results too large to fit in the memoization cache.', 'Overflowing entries cannot provide normal repeat-lookup savings.'],
    'One-Time Filter': ['One-time filter', 'A condition evaluated once before this node runs.', 'If false, PostgreSQL skips the node and all of its descendants.'],
    Planning: ['Planning details', 'Statistics describing work PostgreSQL did before execution.', 'Planning reads catalogs and evaluates possible paths; complex queries may spend meaningful time here.'],
    'Planning Time': ['Planning time', 'Wall-clock time spent parsing, rewriting, and choosing a plan.', 'Usually small; high values can matter for frequently executed short queries.'],
    'Execution Time': ['Execution time', 'Total server time spent executing the chosen plan.', 'Compare this with client-observed latency, which also includes network and rendering time.'],
  };

  const keywords = new Set(Object.keys(keywordInsights));
  const relationIntroducers = new Set(['FROM', 'JOIN', 'INTO', 'UPDATE', 'TABLE', 'VIEW', 'INDEX', 'REFERENCES']);
  const tokenPattern =
    /(--[^\n]*|\/\*[\s\S]*?\*\/|\$[A-Za-z_][A-Za-z0-9_]*\$[\s\S]*?\$[A-Za-z_][A-Za-z0-9_]*\$|\$\$[\s\S]*?\$\$|'(?:''|[^'])*'|"(?:[^"]|"")*"|\b\d+(?:\.\d+)?\b|->>|#>>|->|#>|@>|<@|\|\||&&|::|>=|<=|<>|!=|=>|[-+*/%=<>(){},.;[\]]|[A-Za-z_][A-Za-z0-9_$]*|\s+|.)/g;

  function tokenize(sql) {
    return sql.match(tokenPattern) ?? [];
  }

  function meaningful(tokens, start, direction) {
    for (let index = start + direction; index >= 0 && index < tokens.length; index += direction) {
      if (!/^\s+$/.test(tokens[index]) && !/^--|^\/\*/.test(tokens[index])) return tokens[index];
    }
    return '';
  }

  function isRelationToken(tokens, index) {
    const previousTokens = [];
    for (let cursor = index - 1; cursor >= 0 && previousTokens.length < 6; cursor -= 1) {
      if (/^\s+$/.test(tokens[cursor]) || /^--|^\/\*/.test(tokens[cursor])) continue;
      previousTokens.push(tokens[cursor].toUpperCase());
    }
    if (relationIntroducers.has(previousTokens[0])) return true;

    const modifiers = new Set(['IF', 'NOT', 'EXISTS', 'ONLY', 'CONCURRENTLY', 'MATERIALIZED']);
    const introducer = previousTokens.find((candidate) => !modifiers.has(candidate));
    if (relationIntroducers.has(introducer)) return true;

    return previousTokens[0] === 'ON' && previousTokens.includes('INDEX');
  }

  function purposeFor(title, token, context) {
    const goal = String(context || title)
      .split(/(?<=[.!?])\s+/)[0]
      .trim();
    return `In “${title}”, ${token} contributes to this lesson goal: ${goal}`;
  }

  function explainToken(tokens, index, title, context) {
    const token = tokens[index];
    const upper = token.toUpperCase();
    const lower = token.toLowerCase();
    const previous = meaningful(tokens, index, -1).toUpperCase();
    const next = meaningful(tokens, index, 1);

    if (/^\s+$/.test(token)) return null;
    if (/^--|^\/\*/.test(token)) {
      return ['SQL comment', 'PostgreSQL ignores this text; it documents the intent for the learner or maintainer.', purposeFor(title, 'a comment', context)];
    }
    if (keywordInsights[upper]) {
      return [keywordInsights[upper][0], keywordInsights[upper][1], purposeFor(title, upper, context)];
    }
    if (/^'(?:''|[^'])*'$/.test(token)) {
      return ['Text or typed literal', `This quoted value is passed to PostgreSQL as data rather than interpreted as a name or command.`, purposeFor(title, token, context)];
    }
    if (/^"(?:[^"]|"")*"$/.test(token)) {
      return ['Quoted identifier', 'Double quotes preserve the exact spelling and case of a database object name.', purposeFor(title, token, context)];
    }
    if (/^\d+(?:\.\d+)?$/.test(token)) {
      return ['Numeric literal', `This places the number ${token} directly into the expression.`, purposeFor(title, token, context)];
    }
    if (/^[(),.;[\]{}]$/.test(token)) {
      const descriptions = {
        '(': 'Starts a function argument list, grouped expression, row, or subquery.',
        ')': 'Closes the current function argument list, grouped expression, row, or subquery.',
        ',': 'Separates neighboring columns, expressions, arguments, rows, or options.',
        ';': 'Ends one SQL statement so another can follow.',
        '.': 'Qualifies a name, commonly as schema.object or table.column.',
        '[': 'Starts an array subscript or array value.',
        ']': 'Closes an array subscript or array value.',
        '{': 'Starts a structured value.',
        '}': 'Closes a structured value.',
      };
      return ['SQL punctuation', descriptions[token], purposeFor(title, token, context)];
    }
    if (/^(->>|#>>|->|#>|@>|<@|\|\||&&|::|>=|<=|<>|!=|=>|[-+*/%=<>])$/.test(token)) {
      const descriptions = {
        '::': 'Casts the value on the left to the PostgreSQL data type on the right.',
        '=': 'Tests equality or assigns a value, depending on the surrounding clause.',
        '>': 'Tests whether the left value is greater than the right value.',
        '<': 'Tests whether the left value is less than the right value.',
        '>=': 'Tests whether the left value is greater than or equal to the right value.',
        '<=': 'Tests whether the left value is less than or equal to the right value.',
        '<>': 'Tests whether two values are different.',
        '!=': 'Tests whether two values are different.',
        '+': 'Adds numeric values or participates in an expression.',
        '-': 'Subtracts values; with timestamps and intervals, it moves backward in time.',
        '*': 'Multiplies values, or selects all columns when used after SELECT.',
        '/': 'Divides the value on the left by the value on the right.',
        '%': 'Calculates the remainder after division.',
        '=>': 'Associates a named function parameter with its supplied value.',
        '->': 'Extracts a JSON object field or array element while keeping the result as JSON.',
        '->>': 'Extracts a JSON object field or array element as text.',
        '#>': 'Extracts JSON at the path supplied on the right.',
        '#>>': 'Extracts JSON at the supplied path and returns it as text.',
        '@>': 'Tests whether the value on the left contains the value on the right.',
        '<@': 'Tests whether the value on the left is contained by the value on the right.',
        '||': 'Concatenates text, arrays, or JSON values.',
        '&&': 'Tests whether arrays, ranges, or other supported values overlap.',
      };
      return ['SQL operator', descriptions[token] ?? 'Combines or compares the surrounding values.', purposeFor(title, token, context)];
    }
    if (/^[A-Za-z_]/.test(token) && next === '(') {
      return [
        `${token}() function`,
        functionInsights[lower] ?? `Calls the PostgreSQL or TimescaleDB function named ${token} with the values inside the parentheses.`,
        purposeFor(title, `${token}()`, context),
      ];
    }
    if (isRelationToken(tokens, index) || relationInsights[lower] || previous === '.') {
      return [
        `${token} relation`,
        relationInsights[lower] ?? `${token} names a table, view, hypertable, schema, or other relation used by this statement.`,
        `This is the database object the “${title}” example reads, writes, defines, or inspects.`,
      ];
    }
    if (/^[A-Za-z_]/.test(token)) {
      const alias = previous === 'AS';
      return [
        alias ? `${token} alias` : `${token} identifier`,
        alias
          ? `This temporary output name makes the expression easier to reference or understand.`
          : `This identifier names a column, option, data type, alias, or database object in the statement.`,
        purposeFor(title, token, context),
      ];
    }
    return ['SQL syntax', 'This symbol is part of the PostgreSQL statement’s structure.', purposeFor(title, token, context)];
  }

  function relatedFor(token) {
    return relatedInsights[token] ?? relatedInsights[token.toUpperCase()] ?? [];
  }

  function insightSpan(text, insight, className = 'sql-token plan-token') {
    const span = document.createElement('span');
    span.className = className;
    span.tabIndex = 0;
    span.textContent = text;
    span.dataset.insightTitle = insight[0];
    span.dataset.insightWhat = insight[1];
    span.dataset.insightWhy = insight[2];
    if (insight[3]?.length) span.dataset.insightRelated = JSON.stringify(insight[3]);
    return span;
  }

  function planRanges(line) {
    const ranges = [];
    const add = (start, end, insight, className) => {
      if (ranges.some((range) => start < range.end && end > range.start)) return;
      ranges.push({ start, end, insight, className });
    };
    const addMatches = (pattern, build, className) => {
      for (const match of line.matchAll(pattern)) {
        add(match.index, match.index + match[0].length, build(match), className);
      }
    };

    for (const [attribute, insight] of Object.entries(planAttributeInsights).sort((a, b) => b[0].length - a[0].length)) {
      let start = line.indexOf(`${attribute}:`);
      while (start >= 0) {
        add(start, start + attribute.length, insight, 'sql-token plan-token plan-attribute');
        start = line.indexOf(`${attribute}:`, start + attribute.length + 1);
      }
    }

    const nodeNames = Object.keys(planNodeInsights).sort((a, b) => b.length - a.length);
    for (const nodeName of nodeNames) {
      const start = line.indexOf(nodeName);
      if (start >= 0) {
        add(start, start + nodeName.length, planNodeInsights[nodeName], 'sql-token plan-token plan-node');
        break;
      }
    }

    addMatches(/->/g, () => [
      'Child plan branch',
      'The arrow introduces work performed by a child node that feeds rows into its parent above.',
      'Read inward from the deepest children, then move upward to follow how PostgreSQL transforms rows.',
    ], 'sql-token plan-token plan-tree');

    addMatches(/cost=\d+(?:\.\d+)?\.\.\d+(?:\.\d+)?/g, (match) => {
      const [startup, total] = match[0].slice(5).split('..');
      return [
        'Estimated planner cost',
        `The planner estimates startup cost ${startup} and total cost ${total} in relative cost units, not milliseconds.`,
        'Compare costs between candidate nodes or plans; do not interpret them as elapsed time.',
        [
          ['startup cost', 'Estimated work before the first row can be returned.'],
          ['total cost', 'Estimated work to return every row from this node.'],
        ],
      ];
    }, 'sql-token plan-token plan-estimate');

    addMatches(/actual time=\d+(?:\.\d+)?\.\.\d+(?:\.\d+)?/g, (match) => {
      const [first, all] = match[0].slice(12).split('..');
      return [
        'Actual node timing',
        `This node produced its first row at ${first} ms and finished one loop at about ${all} ms.`,
        'Inclusive node time contains child work. Multiply per-loop behavior carefully, and do not add every node time together.',
      ];
    }, 'sql-token plan-token plan-actual');

    for (const match of line.matchAll(/\brows=\d+/g)) {
      const actualPosition = line.indexOf('(actual');
      const actual = actualPosition >= 0 && match.index > actualPosition;
      const count = match[0].slice(5);
      const insight = actual
        ? [
            'Actual rows',
            `This node emitted ${count} row(s) per loop during EXPLAIN ANALYZE.`,
            'Compare actual rows with estimated rows. Large differences can lead PostgreSQL to choose the wrong join, scan, or aggregate strategy.',
          ]
        : [
            'Estimated rows',
            `The planner expected this node to emit ${count} row(s).`,
            'Compare this estimate with actual rows; stale statistics or correlated columns often cause large mismatches.',
          ];
      add(
        match.index,
        match.index + match[0].length,
        insight,
        `sql-token plan-token ${actual ? 'plan-actual' : 'plan-estimate'}`,
      );
    }

    addMatches(/\bwidth=\d+/g, (match) => [
      'Estimated row width',
      `The planner expects each output row to average ${match[0].slice(6)} bytes.`,
      'Wider rows increase memory, sort, hash, transfer, and temporary-storage costs.',
    ], 'sql-token plan-token plan-estimate');

    addMatches(/\bloops=\d+/g, (match) => {
      const loops = match[0].slice(6);
      return [
        'Execution loops',
        `PostgreSQL executed this node ${loops} time(s). Reported actual rows and times are averages per loop.`,
        'A cheap inner node can become expensive when a nested loop repeats it many times; consider total work across all loops.',
      ];
    }, 'sql-token plan-token plan-actual');

    addMatches(/\b(?:shared|local|temp) (?:hit|read|dirtied|written)=\d+/g, (match) => {
      const [area, counter] = match[0].split(' ');
      const [operation, value] = counter.split('=');
      const meanings = {
        hit: 'found in PostgreSQL’s buffer cache without a storage read',
        read: 'loaded from storage into a buffer',
        dirtied: 'changed in memory and now requiring a future write',
        written: 'written to storage during this query',
      };
      return [
        `${area} buffer ${operation}`,
        `${value} ${area} page(s) were ${meanings[operation]}.`,
        area === 'temp'
          ? 'Temporary-page activity indicates a sort, hash, or materialization spill.'
          : 'Compare hits with reads to distinguish cached work from physical I/O.',
      ];
    }, 'sql-token plan-token plan-buffer');

    addMatches(/\bnever executed\b/g, () => [
      'Never executed',
      'EXPLAIN ANALYZE did not run this node because its parent never requested a row from it.',
      'Inspect the parent condition or earlier branch to understand why this work was skipped.',
    ], 'sql-token plan-token plan-warning');

    addMatches(/\bon\s+[A-Za-z_][A-Za-z0-9_$]*/gi, (match) => {
      const relation = match[0].replace(/^on\s+/i, '');
      return [
        `${relation} relation`,
        `This plan node reads from or operates on the relation named ${relation}.`,
        'TimescaleDB internal names beginning with _hyper_ represent physical chunks behind a hypertable.',
      ];
    }, 'sql-token plan-token plan-relation');

    addMatches(/\busing\s+[A-Za-z_][A-Za-z0-9_$]*/gi, (match) => {
      const index = match[0].replace(/^using\s+/i, '');
      return [
        `${index} index`,
        `This scan navigates the index named ${index} to locate candidate rows.`,
        'Compare Index Cond with Filter: an index condition avoids reading nonmatching entries earlier.',
      ];
    }, 'sql-token plan-token plan-relation');

    return ranges.sort((a, b) => a.start - b.start);
  }

  function renderPlanLine(line) {
    const row = document.createElement('div');
    row.className = 'plan-line';
    const ranges = planRanges(line);
    let cursor = 0;
    for (const range of ranges) {
      row.append(document.createTextNode(line.slice(cursor, range.start)));
      row.append(insightSpan(line.slice(range.start, range.end), range.insight, range.className));
      cursor = range.end;
    }
    row.append(document.createTextNode(line.slice(cursor)));
    return row;
  }

  function renderPlan(planText) {
    const wrapper = document.createElement('section');
    wrapper.className = 'guided-plan';

    const guide = document.createElement('div');
    guide.className = 'plan-reading-guide';
    const heading = document.createElement('strong');
    heading.textContent = 'How to read this plan';
    const summary = document.createElement('span');
    summary.textContent = ' Start at the deepest indented nodes, follow arrows upward, then compare estimated and actual rows. Hover highlighted terms for guidance.';
    guide.append(heading, summary);
    const legend = document.createElement('div');
    legend.className = 'plan-legend';
    for (const [className, label] of [
      ['plan-node', 'operation'],
      ['plan-estimate', 'estimate'],
      ['plan-actual', 'actual'],
      ['plan-attribute', 'detail'],
      ['plan-relation', 'table/index'],
    ]) {
      const item = document.createElement('span');
      item.className = className;
      item.textContent = label;
      legend.append(item);
    }
    guide.append(legend);
    wrapper.append(guide);

    const pre = document.createElement('pre');
    pre.className = 'sql plan guided-explain';
    pre.setAttribute('aria-label', 'Interactive PostgreSQL execution plan. Focus highlighted terms for explanations.');
    planText.split('\n').forEach((line) => pre.append(renderPlanLine(line)));
    wrapper.append(pre);
    return wrapper;
  }

  function render(sql, title, context, contextualInsights = {}) {
    const pre = document.createElement('pre');
    pre.className = 'sql guided-sql';
    pre.setAttribute('aria-label', `${title} SQL. Focus highlighted terms for explanations.`);
    const tokens = tokenize(sql);
    tokens.forEach((token, index) => {
      const exact = contextualInsights[token] ?? contextualInsights[token.toUpperCase()];
      const insight = exact
        ? [exact.title ?? token, exact.what, exact.why]
        : explainToken(tokens, index, title, context);
      if (!insight) {
        pre.append(document.createTextNode(token));
        return;
      }
      const span = document.createElement('span');
      span.className = 'sql-token';
      span.tabIndex = 0;
      span.textContent = token;
      span.dataset.insightTitle = insight[0];
      span.dataset.insightWhat = insight[1];
      span.dataset.insightWhy = insight[2];
      const related = relatedFor(token);
      if (related.length) span.dataset.insightRelated = JSON.stringify(related);
      pre.append(span);
    });
    return pre;
  }

  window.SqlGuide = { render, renderPlan };
})();
