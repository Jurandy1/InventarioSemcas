-- Tabelas extras + RLS para app com Firebase Auth + Supabase dados
-- Execute no Supabase SQL Editor se ainda não rodou

CREATE TABLE IF NOT EXISTS backups (
  id          TEXT PRIMARY KEY,
  criado_em   TIMESTAMPTZ DEFAULT now(),
  criado_por  TEXT,
  dados       JSONB DEFAULT '{}'
);

-- Colunas extras em convites (dados do convite de coordenadora)
ALTER TABLE convites ADD COLUMN IF NOT EXISTS unidade_id TEXT;
ALTER TABLE convites ADD COLUMN IF NOT EXISTS unidade_nome TEXT;
ALTER TABLE convites ADD COLUMN IF NOT EXISTS matricula TEXT;
ALTER TABLE convites ADD COLUMN IF NOT EXISTS data_uso TEXT;

ALTER TABLE convites_inventariantes ADD COLUMN IF NOT EXISTS unidade_id TEXT;
ALTER TABLE convites_inventariantes ADD COLUMN IF NOT EXISTS unidade_nome TEXT;

-- Auditoria: campos usados pelo app
ALTER TABLE auditoria ADD COLUMN IF NOT EXISTS timestamp TIMESTAMPTZ;
ALTER TABLE auditoria ADD COLUMN IF NOT EXISTS entidade TEXT;
ALTER TABLE auditoria ADD COLUMN IF NOT EXISTS entidade_id TEXT;

-- RLS (idempotente)
ALTER TABLE inventario ENABLE ROW LEVEL SECURITY;
ALTER TABLE manuais ENABLE ROW LEVEL SECURITY;
ALTER TABLE locais ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventariantes ENABLE ROW LEVEL SECURITY;
ALTER TABLE coordenadores ENABLE ROW LEVEL SECURITY;
ALTER TABLE tombos_ne ENABLE ROW LEVEL SECURITY;
ALTER TABLE finalizacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE campanhas ENABLE ROW LEVEL SECURITY;
ALTER TABLE auditoria ENABLE ROW LEVEL SECURITY;
ALTER TABLE convites ENABLE ROW LEVEL SECURITY;
ALTER TABLE convites_inventariantes ENABLE ROW LEVEL SECURITY;
ALTER TABLE cadastro_indice ENABLE ROW LEVEL SECURITY;
ALTER TABLE presenca_inventario ENABLE ROW LEVEL SECURITY;
ALTER TABLE aprovacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE rejeicoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE backups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "inventario_auth" ON inventario;
CREATE POLICY "inventario_auth" ON inventario FOR ALL USING (auth.jwt() IS NOT NULL) WITH CHECK (auth.jwt() IS NOT NULL);

DROP POLICY IF EXISTS "manuais_auth" ON manuais;
CREATE POLICY "manuais_auth" ON manuais FOR ALL USING (auth.jwt() IS NOT NULL) WITH CHECK (auth.jwt() IS NOT NULL);

DROP POLICY IF EXISTS "locais_auth" ON locais;
CREATE POLICY "locais_auth" ON locais FOR ALL USING (auth.jwt() IS NOT NULL) WITH CHECK (auth.jwt() IS NOT NULL);

DROP POLICY IF EXISTS "inventariantes_auth" ON inventariantes;
CREATE POLICY "inventariantes_auth" ON inventariantes FOR ALL USING (auth.jwt() IS NOT NULL) WITH CHECK (auth.jwt() IS NOT NULL);

DROP POLICY IF EXISTS "coordenadores_auth" ON coordenadores;
CREATE POLICY "coordenadores_auth" ON coordenadores FOR ALL USING (auth.jwt() IS NOT NULL) WITH CHECK (auth.jwt() IS NOT NULL);

DROP POLICY IF EXISTS "tombos_auth" ON tombos_ne;
CREATE POLICY "tombos_auth" ON tombos_ne FOR ALL USING (auth.jwt() IS NOT NULL) WITH CHECK (auth.jwt() IS NOT NULL);

DROP POLICY IF EXISTS "finalizacoes_auth" ON finalizacoes;
CREATE POLICY "finalizacoes_auth" ON finalizacoes FOR ALL USING (auth.jwt() IS NOT NULL) WITH CHECK (auth.jwt() IS NOT NULL);

DROP POLICY IF EXISTS "campanhas_auth" ON campanhas;
CREATE POLICY "campanhas_auth" ON campanhas FOR ALL USING (auth.jwt() IS NOT NULL) WITH CHECK (auth.jwt() IS NOT NULL);

DROP POLICY IF EXISTS "auditoria_auth" ON auditoria;
CREATE POLICY "auditoria_auth" ON auditoria FOR ALL USING (auth.jwt() IS NOT NULL) WITH CHECK (auth.jwt() IS NOT NULL);

DROP POLICY IF EXISTS "convites_public_read" ON convites;
CREATE POLICY "convites_public_read" ON convites FOR SELECT USING (true);
DROP POLICY IF EXISTS "convites_auth_write" ON convites;
CREATE POLICY "convites_auth_write" ON convites FOR INSERT WITH CHECK (auth.jwt() IS NOT NULL);
CREATE POLICY "convites_auth_update" ON convites FOR UPDATE USING (auth.jwt() IS NOT NULL);

DROP POLICY IF EXISTS "convites_inv_public_read" ON convites_inventariantes;
CREATE POLICY "convites_inv_public_read" ON convites_inventariantes FOR SELECT USING (true);
DROP POLICY IF EXISTS "convites_inv_auth_write" ON convites_inventariantes;
CREATE POLICY "convites_inv_auth_write" ON convites_inventariantes FOR INSERT WITH CHECK (auth.jwt() IS NOT NULL);
DROP POLICY IF EXISTS "convites_inv_auth_update" ON convites_inventariantes;
CREATE POLICY "convites_inv_auth_update" ON convites_inventariantes FOR UPDATE USING (auth.jwt() IS NOT NULL);

DROP POLICY IF EXISTS "cadastro_public_read" ON cadastro_indice;
CREATE POLICY "cadastro_public_read" ON cadastro_indice FOR SELECT USING (true);
DROP POLICY IF EXISTS "cadastro_auth_write" ON cadastro_indice;
CREATE POLICY "cadastro_auth_write" ON cadastro_indice FOR ALL USING (auth.jwt() IS NOT NULL) WITH CHECK (auth.jwt() IS NOT NULL);

DROP POLICY IF EXISTS "presenca_auth" ON presenca_inventario;
CREATE POLICY "presenca_auth" ON presenca_inventario FOR ALL USING (auth.jwt() IS NOT NULL) WITH CHECK (auth.jwt() IS NOT NULL);

DROP POLICY IF EXISTS "aprovacoes_auth" ON aprovacoes;
CREATE POLICY "aprovacoes_auth" ON aprovacoes FOR ALL USING (auth.jwt() IS NOT NULL) WITH CHECK (auth.jwt() IS NOT NULL);

DROP POLICY IF EXISTS "rejeicoes_auth" ON rejeicoes;
CREATE POLICY "rejeicoes_auth" ON rejeicoes FOR ALL USING (auth.jwt() IS NOT NULL) WITH CHECK (auth.jwt() IS NOT NULL);

DROP POLICY IF EXISTS "backups_auth" ON backups;
CREATE POLICY "backups_auth" ON backups FOR ALL USING (auth.jwt() IS NOT NULL) WITH CHECK (auth.jwt() IS NOT NULL);
