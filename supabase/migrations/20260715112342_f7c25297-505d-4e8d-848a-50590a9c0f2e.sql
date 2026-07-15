
-- Trigger para registrar histórico de mudanças em ordens_servico
CREATE OR REPLACE FUNCTION public.log_os_history()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  changes jsonb := '{}'::jsonb;
  acao_txt text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.os_historico (os_id, user_id, acao, payload)
    VALUES (NEW.id, auth.uid(), 'criada', jsonb_build_object('numero_os', NEW.numero_os, 'status', NEW.status));
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    -- Compara campos relevantes e armazena diffs
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      changes := changes || jsonb_build_object('status', jsonb_build_object('de', OLD.status, 'para', NEW.status));
    END IF;
    IF NEW.data_entrega_prev IS DISTINCT FROM OLD.data_entrega_prev THEN
      changes := changes || jsonb_build_object('data_entrega_prev', jsonb_build_object('de', OLD.data_entrega_prev, 'para', NEW.data_entrega_prev));
    END IF;
    IF NEW.data_entrega_real IS DISTINCT FROM OLD.data_entrega_real THEN
      changes := changes || jsonb_build_object('data_entrega_real', jsonb_build_object('de', OLD.data_entrega_real, 'para', NEW.data_entrega_real));
    END IF;
    IF NEW.valor_total IS DISTINCT FROM OLD.valor_total THEN
      changes := changes || jsonb_build_object('valor_total', jsonb_build_object('de', OLD.valor_total, 'para', NEW.valor_total));
    END IF;
    IF NEW.quantidade IS DISTINCT FROM OLD.quantidade THEN
      changes := changes || jsonb_build_object('quantidade', jsonb_build_object('de', OLD.quantidade, 'para', NEW.quantidade));
    END IF;
    IF NEW.descricao IS DISTINCT FROM OLD.descricao THEN
      changes := changes || jsonb_build_object('descricao', jsonb_build_object('de', OLD.descricao, 'para', NEW.descricao));
    END IF;
    IF NEW.fora_escopo IS DISTINCT FROM OLD.fora_escopo THEN
      changes := changes || jsonb_build_object('fora_escopo', jsonb_build_object('de', OLD.fora_escopo, 'para', NEW.fora_escopo));
    END IF;
    IF NEW.cliente_id IS DISTINCT FROM OLD.cliente_id THEN
      changes := changes || jsonb_build_object('cliente_id', jsonb_build_object('de', OLD.cliente_id, 'para', NEW.cliente_id));
    END IF;

    IF changes <> '{}'::jsonb THEN
      acao_txt := CASE WHEN NEW.status IS DISTINCT FROM OLD.status THEN 'status_alterado' ELSE 'editada' END;
      INSERT INTO public.os_historico (os_id, user_id, acao, payload)
      VALUES (NEW.id, auth.uid(), acao_txt, changes);
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_os_history_ins ON public.ordens_servico;
DROP TRIGGER IF EXISTS trg_log_os_history_upd ON public.ordens_servico;

CREATE TRIGGER trg_log_os_history_ins
  AFTER INSERT ON public.ordens_servico
  FOR EACH ROW EXECUTE FUNCTION public.log_os_history();

CREATE TRIGGER trg_log_os_history_upd
  AFTER UPDATE ON public.ordens_servico
  FOR EACH ROW EXECUTE FUNCTION public.log_os_history();
