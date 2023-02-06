import fs from 'fs-extra';
import jsYaml from 'js-yaml';
import faker from '@faker-js/faker';
import path from 'path';
import Knex from 'knex';
import type {Knex as IKnex} from 'knex';

type DbConfig = {
  tasksDir: string;
  client: string
  connection: string | object
}

type FileConfig = {
  [ns: string]: NSConfig;
};

type NSConfig = {
  [table: string]: {
    delete?: boolean | string;
    updates: Array<FakerUpdate | RawUpdate>;
  };
};

type Update = {
  column: string;
  where?: string;
}

type RawUpdate = Update & {
  fn: 'raw';
  query: string;
}

type FakerUpdate = Update & {
  fn: string;
  args?: string[];
}

export default async function run(configPath = './config.yaml') {
  // Get config from arguments
  
  const config = await getConfig(configPath);
  const allTasks = await loadTasks(config.tasksDir);

  const knex = Knex({
    client: config.client,
    connection: config.connection,
  });

  for (const nsTask of Object.keys(allTasks)) {
    console.log(`Doing tasks for namespace ${nsTask}`);
    await doTasks(knex, allTasks[nsTask]);
  }
}

async function loadTasks(tasksDir = './tasks'): Promise<FileConfig> {
  // Read config.yaml file for knex connection
  const taskDir = path.resolve(__dirname, tasksDir);
  const allFiles = await fs.readdir(taskDir);
  const tasks: FileConfig = {};
  for (const file of allFiles) {
    if (file.endsWith('.yaml')) {
      const nsTask = loadYaml(path.resolve(taskDir, file));
      Object.assign(tasks, nsTask);
    }
  }

  return tasks;
}

export async function doTasks(
  knex: IKnex,
  nsTask: NSConfig
) {
  for (const [table, task] of Object.entries(nsTask)) {
    if (task.delete) {
      // If delete is a string, then it's a where clause
      if (typeof task.delete === 'string') {
        await knex(table).whereRaw(task.delete).delete();
      } else {
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
          await query.update(knex.raw((update as RawUpdate).query));
        } else {
          const value = fakeit(update.fn, (update as FakerUpdate).args || []);
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
function fakeit(fn: string, args?: Array<any>) {
  const fnToCall = fn
    .split('.')
    .reduce((f: { [x: string]: any }, part: string | number) => f[part], faker);
  if (fnToCall instanceof Function) {
    return fnToCall(...(args || []));
  } else {
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
  if (configPath.endsWith('.yaml')) {
    return loadYaml(path.resolve(__dirname, configPath)) as Promise<DbConfig>;
  } else if(configPath.endsWith('.js')) {
    // TODO: Test if this needs default export
    return require(path.resolve(__dirname, configPath))(process.env) as Promise<DbConfig>;
  } else {
    throw new Error(`Invalid config file ${configPath}`);
  }
}

/**
 *
 * @param {string} filename
 * @returns {Promise<object>}
 */
async function loadYaml(filename: any) {
  const yamlString = await fs.readFile(filename, 'utf8');
  return jsYaml.load(yamlString) as object;
}