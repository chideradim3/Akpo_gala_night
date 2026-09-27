-- ============================================================================
-- Gala Night — 10. Make secret tokens fully URL-safe
-- ============================================================================
-- `generate_secret_token()` base64-encoded 32 random bytes and swapped + and
-- / for - and _, but left base64's "=" padding on the end.
--
-- That padding is legal in a URL path, but it survives into
-- /tickets/<token> and gets percent-encoded to %3D somewhere along the way —
-- by the browser, a proxy, a messaging app rewriting the link, or Next.js
-- handing the value to the page. The lookup then fails and a paying guest
-- sees "page not found" holding a perfectly valid ticket link.
--
-- The page now decodes defensively, so this is belt and braces: removing the
-- padding means the character never appears in the first place. Tokens
-- become [A-Za-z0-9_-] only, which survives being pasted into WhatsApp,
-- typed by hand, or wrapped by an email client.
--
-- 32 random bytes still, so no loss of entropy. Existing tokens keep working.
-- ============================================================================

create or replace function public.generate_secret_token()
returns text
language sql
volatile
as $$
  select rtrim(
    replace(replace(encode(extensions.gen_random_bytes(32), 'base64'), '+', '-'), '/', '_'),
    '='
  );
$$;

comment on function public.generate_secret_token() is
  'URL-safe random secret: 32 bytes, base64url, no padding. Used for orders.access_token and tickets.qr_token.';
