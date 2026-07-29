ALTER TABLE recruits
  ADD COLUMN IF NOT EXISTS focus_acknowledged BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS focus_acknowledgement_text TEXT;

COMMENT ON COLUMN recruits.focus_acknowledged IS
  'Confirma que o candidato está ciente de que o foco é a conta de mineração e o clã.';
