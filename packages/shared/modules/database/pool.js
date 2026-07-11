import pg from 'pg';

export function createDatabasePool({ connectionString, logger }) {
  const pool = new pg.Pool({ connectionString });

  pool.on('error', (error) => {
    logger.error('Unexpected database pool error', { error });
  });

  async function query(text, params = []) {
    return pool.query(text, params);
  }

  return { pool, query };
}
