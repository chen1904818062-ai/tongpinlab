export type Row = Record<string, unknown>;
export type QueryResult = { success: boolean; meta: { changes: number; last_row_id: number } };
export interface DatabaseStatement {
  bind(...values: unknown[]): DatabaseStatement;
  first<T extends Row = Row>(): Promise<T | null>;
  all<T extends Row = Row>(): Promise<{ results: T[]; success: boolean }>;
  run(): Promise<QueryResult>;
}
export interface AppDatabase {
  prepare(sql: string): DatabaseStatement;
  batch(statements: DatabaseStatement[]): QueryResult[] | Promise<QueryResult[]>;
}
