declare module 'better-sqlite3' {
  export interface Statement<BindParameters extends any[] = any[], Result = any> {
    run(...params: BindParameters): Result;
    get(...params: BindParameters): Result;
    all(...params: BindParameters): Result[];
    pluck(value?: boolean): Statement<BindParameters, Result>;
  }

  export interface DatabaseOptions {
    readonly?: boolean;
    fileMustExist?: boolean;
    timeout?: number;
  }

  export default class Database {
    constructor(filename: string, options?: DatabaseOptions);
    prepare<BindParameters extends any[] = any[], Result = any>(
      source: string
    ): Statement<BindParameters, Result>;
    exec(source: string): void;
    pragma(source: string): void;
    transaction<T extends (...args: any[]) => any>(fn: T): T;
    close(): void;
  }
}
