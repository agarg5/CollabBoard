-- Allow board deletion for both app roles.
drop policy if exists "Authenticated users can delete boards" on boards;
create policy "Authenticated users can delete boards"
  on boards for delete to authenticated using (true);

drop policy if exists "Anon users can delete boards" on boards;
create policy "Anon users can delete boards"
  on boards for delete to anon using (true);
