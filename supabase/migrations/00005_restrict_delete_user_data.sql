-- Revoke execute from public-facing roles so only service-role
-- (used by the delete-account edge function) can call it.
revoke execute on function delete_user_data(uuid) from authenticated, anon, public;
