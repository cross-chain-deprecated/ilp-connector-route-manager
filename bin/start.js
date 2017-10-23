#!/usr/bin/env node
'use strict'

const startRouteManager = require('../')

const shardsStr = process.env.ICR_SHARDS
if (!shardsStr) {
  throw new Error('Environment variable ICR_SHARDS is required')
}

startRouteManager({
  shards: JSON.parse(shardsStr),
  privatePort: process.env.ICR_PRIVATE_PORT,
  holdDownTime: process.env.ICR_HOLD_DOWN_TIME,
  broadcastInterval: process.env.ICR_BROADCAST_INTERVAL
}).catch(err => console.error(err && err.stack))
