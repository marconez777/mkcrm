
UPDATE public.tracking_sites
SET data_residency = 'remote',
    webhook_secret_in  = COALESCE(webhook_secret_in,  encode(gen_random_bytes(32), 'hex')),
    webhook_secret_out = COALESCE(webhook_secret_out, encode(gen_random_bytes(32), 'hex')),
    journey_api_url    = COALESCE(journey_api_url, 'https://clinicaohrpsiquiatria.com/functions/v1/get-lead-journey')
WHERE id = 'ee42f66a-b7b0-4067-b8be-1f1a856eef01';
