-- Harden delete_user_data against search_path injection (Supabase recommendation).
create or replace function delete_user_data(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from board_objects where created_by = target_user_id;
  delete from boards where created_by = target_user_id;
end;
$$;
