#!/usr/bin/env node
'use strict';

import run from '../lib/esm/main.js';

if (process.argv.length != 3) {
    console.log('Usage: db-masker <config.yaml>');
    process.exit(1);
}
const configPath = process.argv[2];
console.log('Starting db masker');
run(configPath).then(() => {
    console.log('Thank you for using db-masker');
    process.exit(0);
}).catch((err) => {
    console.error(err);
    process.exit(1);
});