-- Backfill cost_usd for o4-mini rows (price: $1.10/M in, $4.40/M out)
UPDATE public.ai_usage
SET cost_usd = ROUND(((COALESCE(input_tokens,0) * 1.10) + (COALESCE(output_tokens,0) * 4.40))::numeric / 1000000, 6)
WHERE (cost_usd IS NULL OR cost_usd = 0)
  AND (model = 'o4-mini' OR model LIKE '%o4-mini%');

-- Backfill cost_usd for o3 rows (price: $2.00/M in, $8.00/M out)
UPDATE public.ai_usage
SET cost_usd = ROUND(((COALESCE(input_tokens,0) * 2.00) + (COALESCE(output_tokens,0) * 8.00))::numeric / 1000000, 6)
WHERE (cost_usd IS NULL OR cost_usd = 0)
  AND (model = 'o3' OR model LIKE '%/o3' OR model LIKE 'o3-2%');