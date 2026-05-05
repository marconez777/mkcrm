update public.messages
set media_url = null, media_mime = null
where media_url like 'https://mmg.whatsapp.net/%'
   or media_url like 'https://media-%.whatsapp.net/%'
   or media_url like '%.whatsapp.net/%';