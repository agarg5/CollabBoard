-- Drop foreign key constraints on created_by so dev bypass auth works
-- (the fake dev user ID doesn't exist in auth.users)
alter table boards drop constraint if exists boards_created_by_fkey;
alter table board_objects drop constraint if exists board_objects_created_by_fkey;
