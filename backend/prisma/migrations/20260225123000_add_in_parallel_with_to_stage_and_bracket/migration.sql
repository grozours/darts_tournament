-- Add runtime parallelism references for pool stages and brackets
ALTER TABLE "pool_stages"
ADD COLUMN "in_parallel_with" JSONB;

ALTER TABLE "brackets"
ADD COLUMN "in_parallel_with" JSONB;
