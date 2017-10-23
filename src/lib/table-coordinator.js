'use strict'

const RouteTable = require('./route-table')
const Route = require('./route')

class TableCoordinator {
  constructor ({ shards, tables }) {
    this.shards = shards
    this.tables = tables
    for (const shard of shards) {
      this.tables[shard.prefix] = new RouteTable({ shard })
      for (const shardRoute of shard.initialTable) {
        this.addShardRoute(shard, shardRoute)
      }
    }
  }

  addShardRoute (shard, shardRoute) {
    const nextShard = this.shards.find((s) => s.host === shardRoute.shard)
    const headRoute = new Route({
      sourceLedger: shard.prefix,
      nextLedger: nextShard.prefix,
      nextShard: nextShard.host,
      targetPrefix: shardRoute.prefix,
      curveLocal: shardRoute.curveLocal,
      isLocal: shardRoute.local,
      expiresAt: Infinity // Never expire the initial routes.
    })
    this.tables[shard.prefix].addHeadRoute(headRoute)
  }

  addMessageRoute (msgRoute) {
    const tailRoute = new Route({
      sourceLedger: msgRoute.source_ledger,
      nextLedger: msgRoute.destination_ledger,
      targetPrefix: msgRoute.destination_ledger,
      foreignPeer: msgRoute.source_account,
      isLocal: false
    }, msgRoute.paths)
    this._addTailRoute(tailRoute)
  }

  _addTailRoute (tailRoute) {
    this.eachTable((table, shardPrefix) => {
      const fullRoute = table.addTailRoute(tailRoute)
      if (fullRoute) {
        this._addTailRoute(fullRoute)
      }
    })
  }

  bumpByPeer (peerAccount, holdTime) {
    this.eachTable((table, shardPrefix) =>
      table.bumpByPeer(peerAccount, holdTime))
  }

  removeExpiredRoutes () {
    this.eachTable((table) => table.removeBy((route) => route.isExpired()))
  }

  removeByPeer (peerAccount) {
    this.eachTable((table) => table.removeBy((route) =>
      route.foreignPeer === peerAccount))
  }

  removeByPeerDestination (peerAccount, destination) {
    this.eachTable((table) => table.removeBy((route) =>
      route.foreignPeer === peerAccount && route.targetPrefix === destination))
  }

  eachTable (fn) {
    for (const sourcePrefix in this.tables) {
      fn(this.tables[sourcePrefix], sourcePrefix)
    }
  }
}

module.exports = TableCoordinator
