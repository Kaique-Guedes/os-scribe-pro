-- Preferência de notificação por e-mail (ex: avisar quando uma O.S. atrasa).
-- Guardada em profiles (não em localStorage) porque quem vai ler esse valor,
-- no futuro, é um job no servidor (cron), não o navegador do usuário.
-- A policy "profiles update own" já existente cobre a escrita dessa coluna
-- (cada usuário só edita a própria linha) — não precisa de policy nova.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS notif_atraso_email BOOLEAN NOT NULL DEFAULT true;
