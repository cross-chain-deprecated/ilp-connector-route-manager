'use strict'

const assert = require('assert')
const PrivateApp = require('./src/lib/app')
const TableCoordinator = require('./src/lib/table-coordinator')
const PeerBroadcaster = require('./src/lib/peer-broadcaster')
const ShardBroadcaster = require('./src/lib/shard-broadcaster')
const { validateShard } = require('./src/util/validator')

const defaultHoldDownTime = 45000 // milliseconds
const defaultBroadcastInterval = 30000 // milliseconds

module.exports = ({
  shards, // [{ prefix, host, account, peerAccount, initialTable }]
  privatePort, // Integer
  holdDownTime, // Integer, milliseconds
  broadcastInterval // Integer, milliseconds
}) => {
  privatePort = privatePort || 8071
  holdDownTime = holdDownTime || defaultHoldDownTime
  broadcastInterval = broadcastInterval || defaultBroadcastInterval
  assert.ok(broadcastInterval < holdDownTime,
    'holdDownTime must be greater than broadcastInterval or routes will expire between broadcasts')
  shards.forEach(validateShard)

  const tables = {} // { shard.prefix ⇒ RouteTable }

  const tableCoordinator = new TableCoordinator({
    shards,
    tables
  })

  const shardBroadcaster = new ShardBroadcaster({
    shards,
    tables
  })

  const peerBroadcaster = new PeerBroadcaster({
    shards,
    tables,
    holdDownTime,
    tableCoordinator
  })

  const privateHandlers = {
    broadcastToShard: require('./src/handlers/broadcast-to-shard')({
      shards,
      shardBroadcaster
    }),
    sendRequest: require('./src/handlers/send-request')({
      peerBroadcaster,
      shardBroadcaster
    })
  }

  const privateApp = new PrivateApp({
    handlers: privateHandlers
  })

  let timer
  const broadcast = async () => {
    tableCoordinator.removeExpiredRoutes()
    await shardBroadcaster.broadcastToRevisedShards()
    await peerBroadcaster.broadcastToAllShards()
    timer = setTimeout(broadcast, broadcastInterval)
  }

  const start = async () => {
    privateApp.listen(privatePort)
    await broadcast()
    return () => {
      privateApp.close()
      clearTimeout(timer)
    }
  }

  return start()
}
