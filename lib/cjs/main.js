"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.doTasks = void 0;
const faker_1 = require("@faker-js/faker");
const fs_extra_1 = __importDefault(require("fs-extra"));
const js_yaml_1 = __importDefault(require("js-yaml"));
const knex_1 = __importDefault(require("knex"));
const lodash_es_1 = require("lodash-es");
const path_1 = __importDefault(require("path"));
async function run(configPath = './config.yaml') {
    // Get config from arguments
    const absoluteConfigPath = absolutePath(configPath);
    const config = await getConfig(configPath);
    const allTasks = await loadTasks(config.tasksDir, path_1.default.dirname(absoluteConfigPath));
    const knex = (0, knex_1.default)({
        client: config.client,
        connection: config.connection,
    });
    const namespaces = Object.keys(allTasks);
    console.log(`Found ${namespaces.length} namespaces`);
    for (const nsTask of namespaces) {
        console.log(`Doing tasks for namespace ${nsTask}`);
        await doTasks(knex, allTasks[nsTask]);
    }
}
exports.default = run;
async function loadTasks(relativeTasksDir = './tasks', configDir = './') {
    // Read config.yaml file for knex connection
    const tasksDir = absolutePath(relativeTasksDir, configDir);
    const allFiles = await fs_extra_1.default.readdir(tasksDir);
    const tasks = {};
    for (const file of allFiles) {
        if (file.endsWith('.yaml')) {
            const nsTask = await loadYaml(path_1.default.resolve(tasksDir, file));
            Object.assign(tasks, nsTask);
        }
    }
    return tasks;
}
async function doTasks(knex, nsTask) {
    const start = Date.now();
    for (const [table, task] of Object.entries(nsTask)) {
        const idField = task.id ?? 'id';
        if (task.delete) {
            // If delete is a string, then it's a where clause
            if (typeof task.delete === 'string') {
                await knex(table).whereRaw(task.delete).delete();
            }
            else {
                await knex(table).delete();
            }
        }
        if (task.updates) {
            for (const update of task.updates) {
                const query = knex(table);
                if (update.where) {
                    query.whereRaw(update.where);
                }
                if (update.fn === 'raw') {
                    const changed = await query.update(update.column, knex.raw(update.query));
                    console.log(`Updated ${changed}x ${table}.${update.column} with raw query`);
                }
                else {
                    const allIds = await query.select(`${idField} as id`).pluck('id');
                    console.log(`Updating ${table}.${update.column} on ${allIds.length} rows`);
                    const chunks = (0, lodash_es_1.chunk)(allIds, 50);
                    for (const ids of chunks) {
                        const q = knex.queryBuilder();
                        ids.forEach(id => {
                            let value = fakeit(update.fn, update.args || []);
                            q.union((s) => {
                                s.select(knex.raw('? as id', id))
                                    .select(knex.raw('? as sq_value', value));
                            });
                        });
                        await knex(table).update({
                            [update.column]: knex.select('sq_value').from(q.as('sq_join'))
                                .where('sq_join.id', '=', knex.ref(`${table}.${idField}`))
                        }).where(`${table}.${idField}`, 'in', ids);
                    }
                }
            }
        }
    }
    console.log(`Finished in ${Date.now() - start}ms`);
}
exports.doTasks = doTasks;
/**
 * Exceute a faker function with given arguments
 * @param {string} fn possibly dot separated function name
 * @param {string[]?} args arguments to pass the faker function
 */
function fakeit(fn, args) {
    const fnToCall = fn
        .split('.')
        .reduce((f, part) => f[part], faker_1.faker);
    if (fnToCall instanceof Function) {
        return fnToCall(...(args || []));
    }
    else {
        throw new Error(`Invalid faker function ${fn}`);
    }
}
function absolutePath(filePath, from = process.cwd()) {
    return filePath.startsWith('/') ? filePath : path_1.default.resolve(from, filePath);
}
/**
 *
 * @returns {Promise<{
 *  client: string
 *  connection: object
 * }>}
 */
function getConfig(absoluteConfigPath) {
    if (absoluteConfigPath.endsWith('.yaml')) {
        return loadYaml(absoluteConfigPath);
    }
    else if (absoluteConfigPath.endsWith('.js')) {
        // TODO: Test if this needs default export
        return require(absoluteConfigPath)(process.env);
    }
    else {
        throw new Error(`Invalid config file ${absoluteConfigPath}`);
    }
}
/**
 *
 * @param {string} filename
 * @returns {Promise<object>}
 */
async function loadYaml(filename) {
    const yamlString = await fs_extra_1.default.readFile(filename, 'utf8');
    return js_yaml_1.default.load(yamlString);
}
