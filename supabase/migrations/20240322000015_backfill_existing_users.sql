-- Backfill existing users from auth.users to public.users
INSERT INTO public.users (id, email, full_name, avatar_url, created_at, updated_at)
SELECT 
  au.id,
  au.email,
  COALESCE(au.raw_user_meta_data->>'full_name', au.raw_user_meta_data->>'name') as full_name,
  au.raw_user_meta_data->>'avatar_url' as avatar_url,
  au.created_at,
  au.updated_at
FROM auth.users au
WHERE au.id NOT IN (SELECT id FROM public.users)
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  full_name = COALESCE(EXCLUDED.full_name, public.users.full_name),
  avatar_url = COALESCE(EXCLUDED.avatar_url, public.users.avatar_url),
  updated_at = NOW();
