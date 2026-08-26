-- Entrega parcial: cada nota fiscal (já é o registro de "entrega faturada" de uma O.S.)
-- passa a guardar também a quantidade entregue e sua unidade, além do valor.
-- Não cria tabela nova: a entrega parcial e a nota fiscal são o mesmo evento
-- (confirmado com o usuário: só entrega junto com a emissão da nota fiscal).
ALTER TABLE public.os_notas_fiscais
  ADD COLUMN quantidade NUMERIC(14,3),
  ADD COLUMN unidade TEXT;

COMMENT ON COLUMN public.os_notas_fiscais.quantidade IS 'Quantidade entregue nesta nota fiscal (itens, kg, conjuntos etc, conforme unidade da O.S.)';
COMMENT ON COLUMN public.os_notas_fiscais.unidade IS 'Unidade da quantidade entregue nesta nota (herda da O.S. por padrão, editável).';
