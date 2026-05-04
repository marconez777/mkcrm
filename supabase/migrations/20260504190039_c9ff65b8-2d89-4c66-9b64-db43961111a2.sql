
insert into storage.buckets (id, name, public)
values ('chat-attachments', 'chat-attachments', true)
on conflict (id) do nothing;

create policy "chat-attachments public read"
on storage.objects for select
to public
using (bucket_id = 'chat-attachments');

create policy "chat-attachments authenticated upload"
on storage.objects for insert
to authenticated
with check (bucket_id = 'chat-attachments');

create policy "chat-attachments authenticated delete"
on storage.objects for delete
to authenticated
using (bucket_id = 'chat-attachments');
