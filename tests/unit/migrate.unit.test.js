import { beforeEach, describe, expect, it, vi } from 'vitest';

const fsMock = vi.hoisted(() => ({
  readdir: vi.fn(),
  readFile: vi.fn()
}));

const poolMock = vi.hoisted(() => ({
  query: vi.fn(),
  connect: vi.fn()
}));

const clientMock = vi.hoisted(() => ({
  query: vi.fn(),
  release: vi.fn()
}));

vi.mock('fs/promises', () => ({
  default: fsMock
}));
vi.mock('../../src/db/client.js', () => ({
  pool: poolMock
}));

const { runMigrations } = await import('../../src/db/migrate.js');

describe('database migrations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fsMock.readdir.mockResolvedValue(['002_second.sql', 'notes.md', '001_first.sql']);
    fsMock.readFile.mockImplementation(async (filePath) => {
      if (String(filePath).endsWith('001_first.sql')) return 'CREATE TABLE first();';
      return 'CREATE TABLE second();';
    });
    poolMock.connect.mockResolvedValue(clientMock);
    poolMock.query.mockResolvedValue({ rowCount: 0 });
    clientMock.query.mockResolvedValue({});
  });

  it('stores applied migration filenames and skips already applied files', async () => {
    poolMock.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rowCount: 1 })
      .mockResolvedValueOnce({ rowCount: 0 });

    await runMigrations();

    expect(poolMock.query.mock.calls[0][0]).toContain('CREATE TABLE IF NOT EXISTS schema_migrations');
    expect(poolMock.query).toHaveBeenCalledWith(
      'SELECT 1 FROM schema_migrations WHERE filename = $1',
      ['001_first.sql']
    );
    expect(poolMock.query).toHaveBeenCalledWith(
      'SELECT 1 FROM schema_migrations WHERE filename = $1',
      ['002_second.sql']
    );
    expect(fsMock.readFile).toHaveBeenCalledTimes(1);
    expect(clientMock.query).toHaveBeenCalledWith('BEGIN');
    expect(clientMock.query).toHaveBeenCalledWith('CREATE TABLE second();');
    expect(clientMock.query).toHaveBeenCalledWith(
      'INSERT INTO schema_migrations(filename) VALUES ($1)',
      ['002_second.sql']
    );
    expect(clientMock.query).toHaveBeenCalledWith('COMMIT');
    expect(clientMock.release).toHaveBeenCalledTimes(1);
  });

  it('rolls back and releases the client when a migration fails', async () => {
    clientMock.query.mockImplementation(async (sql) => {
      if (sql === 'CREATE TABLE first();') {
        throw new Error('migration failed');
      }
    });

    await expect(runMigrations()).rejects.toThrow('migration failed');

    expect(clientMock.query).toHaveBeenCalledWith('ROLLBACK');
    expect(clientMock.release).toHaveBeenCalledTimes(1);
  });
});
