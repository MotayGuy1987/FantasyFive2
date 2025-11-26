-- Add Jackson player if not already exists
INSERT INTO players (name, position, price, is_in_form)
VALUES ('Jackson', 'Forward', '7.0', false)
ON CONFLICT (name) DO NOTHING;
