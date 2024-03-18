import { faker } from '@faker-js/faker';
import fs from 'fs-extra';
import jsYaml from 'js-yaml';
import Knex from 'knex';
import { chunk } from 'lodash-es';
import path from 'path';
export default async function run(configPath = './config.yaml') {
    // Get config from arguments
    const absoluteConfigPath = absolutePath(configPath);
    const config = await getConfig(configPath);
    const allTasks = await loadTasks(config.tasksDir, path.dirname(absoluteConfigPath));
    const knex = Knex({
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
async function loadTasks(relativeTasksDir = './tasks', configDir = './') {
    // Read config.yaml file for knex connection
    const tasksDir = absolutePath(relativeTasksDir, configDir);
    const allFiles = await fs.readdir(tasksDir);
    const tasks = {};
    for (const file of allFiles) {
        if (file.endsWith('.yaml')) {
            const nsTask = await loadYaml(path.resolve(tasksDir, file));
            Object.assign(tasks, nsTask);
        }
    }
    return tasks;
}
export async function doTasks(knex, nsTask) {
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
                    const chunks = chunk(allIds, 50);
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
/**
 * Exceute a faker function with given arguments
 * @param {string} fn possibly dot separated function name
 * @param {string[]?} args arguments to pass the faker function
 */
function fakeit(fn, args) {
    const fnToCall = fn
        .split('.')
        .reduce((f, part) => f[part], faker);
    if (fnToCall instanceof Function) {
        return fnToCall(...(args || []));
    }
    else {
        throw new Error(`Invalid faker function ${fn}`);
    }
}
function absolutePath(filePath, from = process.cwd()) {
    return filePath.startsWith('/') ? filePath : path.resolve(from, filePath);
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
    const yamlString = await fs.readFile(filename, 'utf8');
    return jsYaml.load(yamlString);
}
