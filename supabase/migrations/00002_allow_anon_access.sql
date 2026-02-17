-- Allow anon role access for dev bypass auth mode
-- In production, real users will be authenticated; anon access is safe for MVP.

create policy "Anon users can read boards"
  on boards for select to anon using (true);

create policy "Anon users can insert boards"
  on boards for insert to anon with check (true);

create policy "Anon users can update boards"
  on boards for update to anon using (true) with check (true);

create policy "Anon users can read board_objects"
  on board_objects for select to anon using (true);

create policy "Anon users can insert board_objects"
  on board_objects for insert to anon with check (true);

create policy "Anon users can update board_objects"
  on board_objects for update to anon using (true) with check (true);

create policy "Anon users can delete board_objects"
  on board_objects for delete to anon using (true);
