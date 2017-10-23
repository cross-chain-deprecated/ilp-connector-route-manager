'use strict'

const request = require('superagent')

class ShardBroadcaster {
  constructor ({ shards, tables }) {
    this.shards = shards
    this.tables = tables
    this.shardEpochs = {} // { shardPrefix ⇒ epoch }
  }

  broadcastToRevisedShards () {
    return Promise.all(this.shards.map(this.broadcastToRevisedShard, this))
  }

  async broadcastToRevisedShard (shard) {
    const routeTable = this.tables[shard.prefix]
    const oldEpoch = this.shardEpochs[shard.prefix]
    const newEpoch = routeTable.getEpoch()
    if (oldEpoch !== newEpoch) {
      await this.broadcastToShard(shard)
    }
  }

  // TODO incremental updates
  async broadcastToShard (shard) {
    const routeTable = this.tables[shard.prefix]
    const newEpoch = routeTable.getEpoch()

    await request.post(shard.host + '/internal/routes').send({
      all: routeTable.getShardRoutes()
    }).then(() => {
      console.log('shard-broadcaster: broadcast ok; shard:', shard.prefix)
      this.shardEpochs[shard.prefix] = newEpoch
    }).catch((err) => {
      console.error('shard-broadcaster: broadcast error; shard:', shard.prefix, 'error:', err.message)
      this.shardEpochs[shard.prefix] = -1
    })
  }
}

module.exports = ShardBroadcaster
