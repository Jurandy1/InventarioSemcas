-- InventarioSemcas — upgrade do schema Supabase
-- Execute no Supabase → SQL Editor (uma única vez).
-- Adiciona as colunas que o app grava e ainda não existiam, além de uma coluna
-- "extras" JSONB em todas as tabelas para campos futuros (o app usa como overflow).

-- Coluna extras (overflow) nas tabelas que ainda não têm
ALTER TABLE manuais              ADD COLUMN IF NOT EXISTS extras JSONB DEFAULT '{}';
ALTER TABLE locais               ADD COLUMN IF NOT EXISTS extras JSONB DEFAULT '{}';
ALTER TABLE inventariantes       ADD COLUMN IF NOT EXISTS extras JSONB DEFAULT '{}';
ALTER TABLE coordenadores        ADD COLUMN IF NOT EXISTS extras JSONB DEFAULT '{}';
ALTER TABLE finalizacoes         ADD COLUMN IF NOT EXISTS extras JSONB DEFAULT '{}';
ALTER TABLE cadastro_indice      ADD COLUMN IF NOT EXISTS extras JSONB DEFAULT '{}';
ALTER TABLE presenca_inventario  ADD COLUMN IF NOT EXISTS extras JSONB DEFAULT '{}';

-- Locais: campos gravados ao criar local
ALTER TABLE locais ADD COLUMN IF NOT EXISTS "desc" TEXT DEFAULT '';
ALTER TABLE locais ADD COLUMN IF NOT EXISTS session_id TEXT DEFAULT '';

-- Coordenadoras: cadastro via convite + aprovação/rejeição/desativação
ALTER TABLE coordenadores ADD COLUMN IF NOT EXISTS unidade_nome       TEXT;
ALTER TABLE coordenadores ADD COLUMN IF NOT EXISTS unidade_nomes      JSONB DEFAULT '[]';
ALTER TABLE coordenadores ADD COLUMN IF NOT EXISTS data_criacao       TEXT;
ALTER TABLE coordenadores ADD COLUMN IF NOT EXISTS convite_token      TEXT;
ALTER TABLE coordenadores ADD COLUMN IF NOT EXISTS data_aprovacao     TEXT;
ALTER TABLE coordenadores ADD COLUMN IF NOT EXISTS observacoes        TEXT;
ALTER TABLE coordenadores ADD COLUMN IF NOT EXISTS aprovado_por       TEXT;
ALTER TABLE coordenadores ADD COLUMN IF NOT EXISTS data_rejeicao      TEXT;
ALTER TABLE coordenadores ADD COLUMN IF NOT EXISTS motivo_rejeicao    TEXT;
ALTER TABLE coordenadores ADD COLUMN IF NOT EXISTS rejeitada_por      TEXT;
ALTER TABLE coordenadores ADD COLUMN IF NOT EXISTS data_desativacao   TEXT;
ALTER TABLE coordenadores ADD COLUMN IF NOT EXISTS motivo_desativacao TEXT;
ALTER TABLE coordenadores ADD COLUMN IF NOT EXISTS desativada_por     TEXT;

-- Inventariantes: cadastro via convite + aprovação/rejeição/desativação
ALTER TABLE inventariantes ADD COLUMN IF NOT EXISTS cargo              TEXT;
ALTER TABLE inventariantes ADD COLUMN IF NOT EXISTS unidade_nome       TEXT;
ALTER TABLE inventariantes ADD COLUMN IF NOT EXISTS unidade_nomes      JSONB DEFAULT '[]';
ALTER TABLE inventariantes ADD COLUMN IF NOT EXISTS data_criacao       TEXT;
ALTER TABLE inventariantes ADD COLUMN IF NOT EXISTS convite_token      TEXT;
ALTER TABLE inventariantes ADD COLUMN IF NOT EXISTS data_aprovacao     TEXT;
ALTER TABLE inventariantes ADD COLUMN IF NOT EXISTS observacoes        TEXT;
ALTER TABLE inventariantes ADD COLUMN IF NOT EXISTS aprovado_por       TEXT;
ALTER TABLE inventariantes ADD COLUMN IF NOT EXISTS data_rejeicao      TEXT;
ALTER TABLE inventariantes ADD COLUMN IF NOT EXISTS motivo_rejeicao    TEXT;
ALTER TABLE inventariantes ADD COLUMN IF NOT EXISTS rejeitado_por      TEXT;
ALTER TABLE inventariantes ADD COLUMN IF NOT EXISTS data_desativacao   TEXT;
ALTER TABLE inventariantes ADD COLUMN IF NOT EXISTS motivo_desativacao TEXT;
ALTER TABLE inventariantes ADD COLUMN IF NOT EXISTS desativado_por     TEXT;

-- Índice anti-duplicação de cadastro
ALTER TABLE cadastro_indice ADD COLUMN IF NOT EXISTS papel         TEXT;
ALTER TABLE cadastro_indice ADD COLUMN IF NOT EXISTS chave         TEXT;
ALTER TABLE cadastro_indice ADD COLUMN IF NOT EXISTS atualizado_em TEXT;

-- Presença durante inventário
ALTER TABLE presenca_inventario ADD COLUMN IF NOT EXISTS email      TEXT;
ALTER TABLE presenca_inventario ADD COLUMN IF NOT EXISTS ultimo_ping TEXT;

-- Tabela de backups (caso ainda não tenha rodado supabase-rls.sql)
CREATE TABLE IF NOT EXISTS backups (
  id          TEXT PRIMARY KEY,
  criado_em   TIMESTAMPTZ DEFAULT now(),
  criado_por  TEXT,
  dados       JSONB DEFAULT '{}'
);
ALTER TABLE backups ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "backups_auth" ON backups;
CREATE POLICY "backups_auth" ON backups FOR ALL USING (auth.jwt() IS NOT NULL) WITH CHECK (auth.jwt() IS NOT NULL);

-- Defaults alinhados ao app (evita stubs com status 'pendente' fora do filtro admin)
ALTER TABLE inventariantes ALTER COLUMN status SET DEFAULT 'pendente_aprovacao';
ALTER TABLE coordenadores ALTER COLUMN status SET DEFAULT 'pendente_aprovacao';

-- Recarrega o cache de schema do PostgREST (necessário após ALTER TABLE)
NOTIFY pgrst, 'reload schema';
