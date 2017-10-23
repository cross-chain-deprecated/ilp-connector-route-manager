'use strict'

const request = require('superagent')

class PeerBroadcaster {
  constructor ({ shards, tables, holdDownTime, tableCoordinator }) {
    this.shards = shards
    this.tables = tables
    this.holdDownTime = holdDownTime
    this.tableCoordinator = tableCoordinator
    this.peerEpochs = {} // { peerAccount ⇒ epoch }
    this.hasFullTable = new Set() // [peerAccount]
  }

  broadcastToAllShards () {
    return Promise.all(this.shards.map(this.broadcastToShard, this))
  }

  broadcastToRevisedShards () {
    return Promise.all(this.shards.map(this.broadcastToRevisedShard, this))
  }

  async broadcastToRevisedShard (shard) {
    const routeTable = this.tables[shard.prefix]
    const oldEpoch = this.peerEpochs[shard.peerAccount] || -1
    const newEpoch = routeTable.getEpoch()
    if (oldEpoch !== newEpoch) {
      await this.broadcastToShard(shard)
    }
  }

  async broadcastToShard (shard) {
    const routeTable = this.tables[shard.prefix]
    const oldEpoch = this.peerEpochs[shard.peerAccount] || -1
    const newEpoch = routeTable.getEpoch()
    // No routes to add, remove, or refresh.
    if (newEpoch === 0) return
    const newRoutes = routeTable.getMessageRoutes(oldEpoch)
    await request.post(shard.host + '/internal/request').send({
      to: shard.peerAccount,
      custom: {
        method: 'broadcast_routes',
        data: {
          new_routes: newRoutes,
          unreachable_through_me: routeTable.getLostLedgers(),
          hold_down_time: this.holdDownTime,
          request_full_table: !this.hasFullTable.has(shard.peerAccount)
        }
      }
    }).then(() => {
      console.log('peer-broadcaster: broadcast ok; shard:', shard.peerAccount, 'routes:', newRoutes.length)
      this.peerEpochs[shard.peerAccount] = newEpoch
      this.hasFullTable.add(shard.peerAccount)
    }).catch((err) => {
      console.error('peer-broadcaster: broadcast error; shard:', shard.peerAccount, 'error:', err.message)
      this.peerEpochs[shard.peerAccount] = -1
      this.tableCoordinator.removeByPeer(shard.peerAccount)
      this.hasFullTable.delete(shard.peerAccount)
    })
  }

  /* eslint-disable camelcase */
  receiveFromShard (sender, routingUpdate) {
    const {
      hold_down_time,
      unreachable_through_me,
      new_routes,
      request_full_table
    } = routingUpdate

    unreachable_through_me.forEach((destinationLedger) =>
      this.tableCoordinator.removeByPeerDestination(sender, destinationLedger))
    new_routes.forEach((msgRoute) => {
      // We received a route from another connector, but that route
      // doesn't actually belong to the connector, so ignore it.
      if (msgRoute.source_account !== sender) return
      // Make sure source_account is on source_ledger:
      if (!msgRoute.source_account.startsWith(msgRoute.source_ledger)) return
      this.tableCoordinator.addMessageRoute(msgRoute)
    })

    this.tableCoordinator.bumpByPeer(sender, hold_down_time)
    if (request_full_table) this.peerEpochs[sender] = -1
  }
  /* eslint-enable camelcase */
}

module.exports = PeerBroadcaster
