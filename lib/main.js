"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_extra_1 = __importDefault(require("fs-extra"));
const js_yaml_1 = __importDefault(require("js-yaml"));
const faker_1 = __importDefault(require("@faker-js/faker"));
const path_1 = __importDefault(require("path"));
const knex_1 = __importDefault(require("knex"));
async function run(configPath = './config.yaml') {
    // Get config from arguments
    const config = await getConfig(configPath);
    const allTasks = await loadTasks(config.tasksDir);
    const knex = (0, knex_1.default)({
        client: config.client,
        connection: config.connection,
    });
    for (const nsTask of Object.keys(allTasks)) {
        console.log(`Doing tasks for namespace ${nsTask}`);
        await doTasks(knex, allTasks[nsTask]);
    }
}
async function loadTasks(tasksDir = './tasks') {
    // Read config.yaml file for knex connection
    const taskDir = path_1.default.resolve(__dirname, tasksDir);
    const allFiles = await fs_extra_1.default.readdir(taskDir);
    const tasks = {};
    for (const file of allFiles) {
        if (file.endsWith('.yaml')) {
            const nsTask = loadYaml(path_1.default.resolve(taskDir, file));
            Object.assign(tasks, nsTask);
        }
    }
    return tasks;
}
async function doTasks(knex, nsTask) {
    for (const [table, task] of Object.entries(nsTask)) {
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
                    await query.update(knex.raw(update.query));
                }
                else {
                    const value = fakeit(update.fn, update.args || []);
                    await query.update(update.column, value);
                }
            }
        }
    }
}
/**
 * Exceute a faker function with given arguments
 * @param {string} fn possibly dot separated function name
 * @param {string[]?} args arguments to pass the faker function
 */
function fakeit(fn, args) {
    const fnToCall = fn
        .split('.')
        .reduce((f, part) => f[part], faker_1.default);
    if (fnToCall instanceof Function) {
        return fnToCall(...(args || []));
    }
    else {
        throw new Error(`Invalid faker function ${fn}`);
    }
}
/**
 *
 * @returns {Promise<{
 *  client: string
 *  connection: object
 * }>}
 */
function getConfig(configPath = './config.yaml') {
    return loadYaml(path_1.default.resolve(__dirname, configPath));
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
console.log('Starting db masker');
if (process.argv.length < 3) {
    console.log('Usage: db-masker <config.yaml>');
    process.exit(1);
}
const configPath = process.argv[2];
Promise.all([run(configPath)]).then(() => {
    console.log('Thank you for using db-masker');
    process.exit(0);
}).catch((err) => {
    console.error(err);
    process.exit(1);
});
