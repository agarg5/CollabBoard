-- Transactional function to delete all user data before auth user removal.
-- board_objects cascade-deletes when their parent board is deleted,
-- so we only need to handle objects on OTHER people's boards explicitly.
create or replace function delete_user_data(target_user_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  -- Remove objects the user placed on other people's boards
  delete from board_objects where created_by = target_user_id;

  -- Remove the user's own boards (cascade deletes remaining objects)
  delete from boards where created_by = target_user_id;
end;
$$;
