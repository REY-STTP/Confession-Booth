-- 0002_indexer UP — cursor indexer + counter percobaan publikasi.
CREATE TABLE indexer_state (
  name varchar(64) PRIMARY KEY,
  last_block bigint NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE publications ADD COLUMN attempts integer NOT NULL DEFAULT 0;
