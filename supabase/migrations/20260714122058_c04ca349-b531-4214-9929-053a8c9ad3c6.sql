
CREATE TYPE public.app_role AS ENUM ('admin', 'pcp', 'producao', 'viewer');
CREATE TYPE public.os_status AS ENUM ('aberta','aguardando_material','em_producao','em_pintura','pronta','entregue','atrasada','cancelada');
CREATE TYPE public.etapa_tipo AS ENUM ('abertura','solicitacao_material','chegada_material','pintura','entrega');
CREATE TYPE public.etapa_status AS ENUM ('pendente','concluido');

CREATE OR REPLACE FUNCTION public.update_updated_at_column() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL DEFAULT '',
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles select auth" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles update own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE TRIGGER profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.has_any_role(_user_id UUID, _roles public.app_role[])
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = ANY(_roles));
$$;

CREATE POLICY "user_roles select" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "user_roles admin manage" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, nome, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'nome', split_part(NEW.email,'@',1)), NEW.email);
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'viewer');
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TABLE public.clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  contato TEXT,
  email TEXT,
  telefone TEXT,
  cnpj TEXT,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clientes TO authenticated;
GRANT ALL ON public.clientes TO service_role;
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "clientes select" ON public.clientes FOR SELECT TO authenticated USING (true);
CREATE POLICY "clientes write" ON public.clientes FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','pcp']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','pcp']::public.app_role[]));
CREATE TRIGGER clientes_updated BEFORE UPDATE ON public.clientes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX ON public.clientes (nome);

CREATE TABLE public.ordens_servico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_os TEXT NOT NULL UNIQUE,
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  solicitante TEXT,
  numero_ss TEXT,
  numero_pedido TEXT,
  projeto TEXT,
  gestor TEXT,
  orcamentista TEXT,
  data_inicio_prev DATE,
  data_entrega_prev DATE,
  data_entrega_real DATE,
  unidade TEXT,
  quantidade NUMERIC(14,3),
  valor_unit NUMERIC(14,2),
  valor_total NUMERIC(14,2),
  peso_kg NUMERIC(14,3),
  local_entrega TEXT,
  tipo_frete TEXT,
  descricao TEXT,
  fora_escopo TEXT,
  status public.os_status NOT NULL DEFAULT 'aberta',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ordens_servico TO authenticated;
GRANT ALL ON public.ordens_servico TO service_role;
ALTER TABLE public.ordens_servico ENABLE ROW LEVEL SECURITY;
CREATE POLICY "os select" ON public.ordens_servico FOR SELECT TO authenticated USING (true);
CREATE POLICY "os insert" ON public.ordens_servico FOR INSERT TO authenticated
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','pcp']::public.app_role[]));
CREATE POLICY "os update" ON public.ordens_servico FOR UPDATE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','pcp','producao']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','pcp','producao']::public.app_role[]));
CREATE POLICY "os delete" ON public.ordens_servico FOR DELETE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','pcp']::public.app_role[]));
CREATE TRIGGER os_updated BEFORE UPDATE ON public.ordens_servico FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX ON public.ordens_servico (cliente_id);
CREATE INDEX ON public.ordens_servico (status);
CREATE INDEX ON public.ordens_servico (data_entrega_prev);

CREATE TABLE public.os_etapas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  os_id UUID NOT NULL REFERENCES public.ordens_servico(id) ON DELETE CASCADE,
  tipo public.etapa_tipo NOT NULL,
  data DATE,
  status public.etapa_status NOT NULL DEFAULT 'pendente',
  observacao TEXT,
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(os_id, tipo)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.os_etapas TO authenticated;
GRANT ALL ON public.os_etapas TO service_role;
ALTER TABLE public.os_etapas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "etapas select" ON public.os_etapas FOR SELECT TO authenticated USING (true);
CREATE POLICY "etapas write" ON public.os_etapas FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','pcp','producao']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','pcp','producao']::public.app_role[]));
CREATE TRIGGER etapas_updated BEFORE UPDATE ON public.os_etapas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX ON public.os_etapas (os_id);

CREATE OR REPLACE FUNCTION public.seed_os_etapas()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.os_etapas (os_id, tipo, data, status) VALUES
    (NEW.id, 'abertura', CURRENT_DATE, 'concluido'),
    (NEW.id, 'solicitacao_material', NULL, 'pendente'),
    (NEW.id, 'chegada_material', NULL, 'pendente'),
    (NEW.id, 'pintura', NULL, 'pendente'),
    (NEW.id, 'entrega', NULL, 'pendente');
  RETURN NEW;
END; $$;
CREATE TRIGGER os_seed_etapas AFTER INSERT ON public.ordens_servico
  FOR EACH ROW EXECUTE FUNCTION public.seed_os_etapas();

CREATE TABLE public.os_comentarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  os_id UUID NOT NULL REFERENCES public.ordens_servico(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  texto TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.os_comentarios TO authenticated;
GRANT ALL ON public.os_comentarios TO service_role;
ALTER TABLE public.os_comentarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "com select" ON public.os_comentarios FOR SELECT TO authenticated USING (true);
CREATE POLICY "com insert" ON public.os_comentarios FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "com delete" ON public.os_comentarios FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE TABLE public.os_historico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  os_id UUID NOT NULL REFERENCES public.ordens_servico(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  acao TEXT NOT NULL,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.os_historico TO authenticated;
GRANT ALL ON public.os_historico TO service_role;
ALTER TABLE public.os_historico ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hist select" ON public.os_historico FOR SELECT TO authenticated USING (true);
CREATE POLICY "hist insert" ON public.os_historico FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE TABLE public.os_anexos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  os_id UUID NOT NULL REFERENCES public.ordens_servico(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  nome TEXT NOT NULL,
  mime_type TEXT,
  tipo TEXT,
  tamanho BIGINT,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.os_anexos TO authenticated;
GRANT ALL ON public.os_anexos TO service_role;
ALTER TABLE public.os_anexos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anx select" ON public.os_anexos FOR SELECT TO authenticated USING (true);
CREATE POLICY "anx write" ON public.os_anexos FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','pcp','producao']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','pcp','producao']::public.app_role[]));
