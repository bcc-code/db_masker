#!/usr/bin/env node
'use strict';

const run = require('../lib/cjs/main.js');

if (process.argv.length != 3) {
    console.log('Usage: db-masker <config.yaml>');
    process.exit(1);
}
const configPath = process.argv[2];
console.log('Starting db masker');
Promise.all([run.default(configPath)]).then(() => {
    console.log('Thank you for using db-masker');
    process.exit(0);
}).catch((err) => {
    console.error(err);
    process.exit(1);
});