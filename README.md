# Db Masker

Db Masker is a library for masking database data by performing updates on the data and optionally removing it. The updates and removals are specified in yaml configuration files.

### Supports

- Postgres
- MySQL
- SQLite

Install the correspond client library to use the database.

## Configuring Db Masker
To configure Db Masker, you'll need to set up the following:

The database connection information in the db-masker-config.yaml file.
```yaml
tasksDir: "./tasks"
client: "pg"
connection:
  host: "127.0.0.1"
  user: "user"
  password: "password"
  database: "database"
```

Alternatively, a js file can be used to configure the database connection. The js file should export a function that returns the configuration object. The function will be passed the environment variable `NODE_ENV` as an argument. This allows you to configure the database connection based on the environment.

```js
module.exports = (env) => {
  return {
    tasksDir: "./tasks",
    client: "pg",
    connection: () => {
      // return connection settings
    },
  }
}
```

The data updates and removals in one or more yaml files in the `tasks` directory. Each file corresponds to a namespace, and the data updates and removals are specified by table.

Here's an example of a yaml file:

```yaml
namespace:
  table:
    delete: true # remove all data from the table ( can also be a raw where clause eg. "column_name2 > 100" )
    updates:
      - column: "column_name"
        fn: "name.firstName" # use the faker function name.firstName to update the column
      - column: "column_name2"
        fn: "random.number" # use the faker function random.number to update the column
        args: [1, 100] # pass in two arguments to the function, the minimum and maximum numbers
      - column: "column_name3"
        fn: "raw" # use the raw sql to update the column
        query: "CONCAT(column_name, ' ', column_name2)"
```

## Usage

To run Db Masker, run the following command in your terminal:

```bash
npx db-masker db-masker-config.yaml
```

This will mask the data in your database according to the specifications in the yaml configuration files. The output will be logged to the console, and the process will exit with a status code of 0 on success or 1 on failure.