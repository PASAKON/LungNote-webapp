-- Fix Gmail token storage round-trip.
--
-- Bug: Supabase JS auto-serializes Buffer values to JSON
-- `{"type":"Buffer","data":[...]}` which bytea stores as ASCII text rather
-- than raw bytes. Subsequent decryptToken() fails AES-256-GCM auth tag
-- verify ("Unsupported state or unable to authenticate data") and the
-- row flips to status='expired'.
--
-- Fix: store base64-encoded ciphertext in `text` columns. Code returns
-- string from encryptToken() and accepts string in decryptToken().
--
-- Data loss note: any existing row's tokens are already corrupted (the
-- original AES-GCM-on-base64 mismatch), so we drop and re-add the columns.
-- The user must reconnect Gmail via /dashboard/settings.

alter table lungnote_gmail_connections
  drop column refresh_token_enc,
  drop column access_token_enc;

alter table lungnote_gmail_connections
  add column refresh_token_enc text,
  add column access_token_enc text;

-- Existing rows lose their tokens; mark them so the disconnect flow / UI
-- prompts a reconnect rather than showing a stale "connected" state.
update lungnote_gmail_connections
  set status = 'expired',
      last_error = 'tokens cleared by 20260521090000 migration — please reconnect'
  where refresh_token_enc is null;
