-- InventarioSemcas — schema Supabase (Passo 2)
-- Execute no Supabase → SQL Editor

CREATE TABLE IF NOT EXISTS inventario (
  patrimonio_id       TEXT PRIMARY KEY,
  unidade_id          TEXT NOT NULL,
  unidade_nome        TEXT,
  estado              TEXT,
  situacao            TEXT,
  local_id            TEXT,
  obs                 TEXT DEFAULT '',
  marca               TEXT DEFAULT '',
  origem              TEXT DEFAULT 'Próprio',
  foto_urls           JSONB DEFAULT '[]',
  data                TEXT,
  hora                TEXT,
  usuario             TEXT,
  email               TEXT,
  ultima_atualizacao  TIMESTAMPTZ,
  is_manual           BOOLEAN DEFAULT false,
  descricao_edit      TEXT,
  especie_edit        TEXT,
  imei                TEXT,
  sem_tombo           BOOLEAN,
  tombo_referencia    TEXT,
  permuta_desc        TEXT,
  permuta_marca       TEXT,
  permuta_estado      TEXT,
  identificado_por_foto BOOLEAN,
  extras              JSONB DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_inventario_unidade ON inventario(unidade_id);

CREATE TABLE IF NOT EXISTS manuais (
  id              TEXT PRIMARY KEY,
  unidade_id      TEXT NOT NULL,
  patrimonio_label TEXT,
  data            TEXT,
  especie         TEXT,
  descricao       TEXT,
  marca           TEXT,
  fornecedor      TEXT,
  empenho         TEXT,
  nf              TEXT,
  data_nf         TEXT,
  tipo_entrada    TEXT DEFAULT 'Próprio',
  valor           NUMERIC DEFAULT 0,
  valor_atual     NUMERIC DEFAULT 0,
  imei            TEXT
);
CREATE INDEX IF NOT EXISTS idx_manuais_unidade ON manuais(unidade_id);

CREATE TABLE IF NOT EXISTS locais (
  id          TEXT PRIMARY KEY,
  nome        TEXT NOT NULL,
  unidade_id  TEXT,
  unidade_ids JSONB DEFAULT '[]',
  criado_por  TEXT,
  criado_em   TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_locais_unidade ON locais(unidade_id);

CREATE TABLE IF NOT EXISTS inventariantes (
  uid           TEXT PRIMARY KEY,
  email         TEXT,
  nome          TEXT,
  matricula     TEXT,
  unidade_id    TEXT,
  unidade_ids   JSONB DEFAULT '[]',
  status        TEXT DEFAULT 'pendente_aprovacao',
  criado_em     TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS coordenadores (
  uid           TEXT PRIMARY KEY,
  email         TEXT,
  nome          TEXT,
  matricula     TEXT,
  unidade_id    TEXT,
  unidade_ids   JSONB DEFAULT '[]',
  status        TEXT DEFAULT 'pendente_aprovacao',
  criado_em     TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tombos_ne (
  id          TEXT PRIMARY KEY,
  unidade_id  TEXT,
  descricao   TEXT,
  obs         TEXT,
  usuario     TEXT,
  data        TEXT,
  extras      JSONB DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS finalizacoes (
  id              TEXT PRIMARY KEY,
  campanha_id     TEXT DEFAULT 'ativa',
  unidade_ids     JSONB DEFAULT '[]',
  unidade_nomes   JSONB DEFAULT '[]',
  session_id      TEXT,
  finalized_at    TIMESTAMPTZ,
  finalized_by    JSONB DEFAULT '{}',
  coordenadora    JSONB DEFAULT '{}',
  convite_token   TEXT,
  stats           JSONB DEFAULT '{}',
  status          TEXT DEFAULT 'finalizado',
  ultima_edicao   TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS campanhas (
  id      TEXT PRIMARY KEY,
  status  TEXT DEFAULT 'aberta',
  dados   JSONB DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS auditoria (
  id          TEXT PRIMARY KEY,
  acao        TEXT,
  colecao     TEXT,
  doc_id      TEXT,
  usuario     TEXT,
  uid         TEXT,
  dados       JSONB DEFAULT '{}',
  criado_em   TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS convites (
  id              TEXT PRIMARY KEY,
  token           TEXT,
  status          TEXT DEFAULT 'ativo',
  criado_por      TEXT,
  data_criacao    TEXT,
  data_expiracao  TEXT,
  usado_por       TEXT,
  extras          JSONB DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS convites_inventariantes (
  id              TEXT PRIMARY KEY,
  token           TEXT,
  status          TEXT DEFAULT 'ativo',
  criado_por      TEXT,
  data_criacao    TEXT,
  data_expiracao  TEXT,
  usado_por       TEXT,
  extras          JSONB DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS cadastro_indice (
  id          TEXT PRIMARY KEY,
  uid         TEXT,
  email       TEXT,
  matricula   TEXT,
  nome        TEXT,
  status      TEXT DEFAULT 'ativo'
);

CREATE TABLE IF NOT EXISTS presenca_inventario (
  uid             TEXT PRIMARY KEY,
  nome            TEXT,
  unidade_ids     JSONB DEFAULT '[]',
  item_em_edicao  TEXT,
  item_descricao  TEXT,
  atualizado_em   TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS aprovacoes (
  id          TEXT PRIMARY KEY,
  item_id     TEXT,
  approver_id TEXT,
  dados       JSONB DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS rejeicoes (
  id          TEXT PRIMARY KEY,
  item_id     TEXT,
  approver_id TEXT,
  dados       JSONB DEFAULT '{}'
);
