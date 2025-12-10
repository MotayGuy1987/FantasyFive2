-- Insert admin user if not exists
INSERT INTO users (id, email, username, password, "firstName", "lastName", "profileImageUrl")
VALUES (
  'admin-user-id',
  'admin@fantasyfive.app', 
  'admin',
  -- This is the hash for password "admin1"
  '7b2d8f0e1c4a5f3b8e9d6c2a1f0e4b7c:a1b2c3d4e5f6789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678',
  'Admin',
  'User',
  NULL
)
ON CONFLICT (email) DO UPDATE SET
  username = EXCLUDED.username,
  password = EXCLUDED.password
WHERE users.username IS NULL OR users.password IS NULL;
