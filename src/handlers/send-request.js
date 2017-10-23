'use strict'

const { validateRoutingUpdate } = require('../util/validator')

module.exports = ({ peerBroadcaster, shardBroadcaster }) => async ({ from, custom }) => {
  if (!from) {
    throw new Error('missing message.from')
  }
  if (!custom || custom.method !== 'broadcast_routes') {
    throw new Error('unexpected request type')
  }

  const routingUpdate = custom.data
  validateRoutingUpdate(routingUpdate)
  peerBroadcaster.receiveFromShard(from, routingUpdate)

  await shardBroadcaster.broadcastToRevisedShards()
    .then(() => peerBroadcaster.broadcastToRevisedShards())
}
