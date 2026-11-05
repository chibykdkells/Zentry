-- Zendocx cutover verification. Run the SAME file against Neon and the VPS
-- copy, sort both outputs, and diff them (cutover.sh does this).
--
-- Output: one line per figure, "section|key|values". Read-only.
--   money|...    totals of every money column (kobo), grouped by type/status
--   rows|<table> exact row count of every table in schema public
--   migration|.. the _prisma_migrations ledger, one line per row; sorted
--                before diffing, so it is compared as a set, not a list
--
-- The only acceptable difference is rows|kv_store (short-lived cache rows
-- with expiry). Anything else stops the cutover.
set default_transaction_read_only = on;
\pset footer off
\pset tuples_only on
\pset format unaligned
\pset fieldsep '|'

-- Money: wallets
select 'money', 'Wallet', count(*), sum("availableBalance"), sum("escrowBalance"), sum("totalEarned"), sum("totalWithdrawn")
from "Wallet";

-- Money: ledger, per type and status
select 'money', 'Transaction.' || type || '.' || status, count(*), sum(amount), sum("balanceBefore"), sum("balanceAfter")
from "Transaction" group by type, status;

-- Money: orders, per status (includes escrowed orders)
select 'money', 'Order.' || status || '.released=' || ("escrowReleasedAt" is not null), count(*),
       sum("totalAmount"), sum("platformFee"), sum("tenantFee"), sum("cbtCommission")
from "Order" group by status, ("escrowReleasedAt" is not null);

-- Money: withdrawals, per status
select 'money', 'WithdrawalRequest.' || status, count(*), sum(amount), sum("feeKobo"), sum("payoutKobo")
from "WithdrawalRequest" group by status;

-- Money: admin prices
select 'money', 'Service', count(*), sum("providerCost"), sum("platformFee"), sum("tenantFee"),
       sum("totalPrice"), sum("cbtCommission"), round(sum("platformFeePercent")::numeric, 6)
from "Service";

-- Exact row counts, every table (never pg_stat_user_tables)
select 'rows', table_name, (xpath('/row/cnt/text()', xml_count))[1]::text::bigint
from (select table_name,
             query_to_xml(format('select count(*) as cnt from public.%I', table_name), false, true, '') as xml_count
        from information_schema.tables
       where table_schema = 'public' and table_type = 'BASE TABLE') t;

-- Migration ledger, as a set
select 'migration', migration_name, checksum, finished_at is not null, rolled_back_at is not null, applied_steps_count
from "_prisma_migrations";
