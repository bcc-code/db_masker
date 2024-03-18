import type { Knex as IKnex } from 'knex';
type NSConfig = {
    [table: string]: {
        id?: string;
        delete?: boolean | string;
        updates: Array<FakerUpdate | RawUpdate>;
    };
};
type Update = {
    column: string;
    where?: string;
};
type RawUpdate = Update & {
    fn: 'raw';
    query: string;
};
type FakerUpdate = Update & {
    fn: string;
    args?: string[];
};
export default function run(configPath?: string): Promise<void>;
export declare function doTasks(knex: IKnex, nsTask: NSConfig): Promise<void>;
export {};
