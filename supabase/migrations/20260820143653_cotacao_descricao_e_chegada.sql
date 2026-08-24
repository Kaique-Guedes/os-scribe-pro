-- Renomeia "fornecedor" pra "descricao" (o campo passou a descrever a cotação,
-- não só o nome do fornecedor) e move o controle de chegada de material pra
-- dentro de cada cotação, já que a chegada acontece cotação por cotação
-- (cada uma pode ter fornecedor/prazo diferente).

ALTER TABLE material_cotacoes RENAME COLUMN fornecedor TO descricao;

ALTER TABLE material_cotacoes
  ADD COLUMN chegou boolean NOT NULL DEFAULT false,
  ADD COLUMN data_chegada timestamptz,
  ADD COLUMN pedido_compra_anexo_id uuid REFERENCES os_anexos(id),
  ADD COLUMN nota_fiscal_compra_anexo_id uuid REFERENCES os_anexos(id);
