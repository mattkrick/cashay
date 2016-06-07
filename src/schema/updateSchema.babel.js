#!/usr/bin/env node

require('babel-register');
require('babel-polyfill');
require('./updateSchema').default();
