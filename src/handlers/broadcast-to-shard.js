'use strict'

// When a shard comes online, it POSTs this endpoint on the route-manager.
module.exports = ({ shards, shardBroadcaster }) => async ({ shardPrefix }) => {
  const shard = shards.find((shard) => shard.prefix === shardPrefix)
  if (!shard) {
    throw new Error('no matching shard found')
  }
  await shardBroadcaster.broadcastToShard(shard)
}
