'use strict'
/* eslint-env mocha */

const nock = require('nock')
const TableCoordinator = require('../../src/lib/table-coordinator')
const ShardBroadcaster = require('../../src/lib/shard-broadcaster')

describe('ShardBroadcaster', function () {
  beforeEach(function () {
    this.tableCoordinator = new TableCoordinator(this.config)
    this.shardBroadcaster = new ShardBroadcaster(this.config)
  })

  describe('broadcastToRevisedShard', function () {
    it('does nothing when the epoch has not changed', async function () {
      nock('http://connie-east').post('/internal/routes', { all: [] }).reply(200)
      await this.shardBroadcaster.broadcastToRevisedShard(this.shards[1])
      await this.shardBroadcaster.broadcastToRevisedShard(this.shards[1])
    })

    it('resets the epoch on error', async function () {
      nock('http://connie-east').post('/internal/routes', { all: [] }).reply(500)
      nock('http://connie-east').post('/internal/routes', { all: [] }).reply(200)
      await this.shardBroadcaster.broadcastToRevisedShard(this.shards[1])
      await this.shardBroadcaster.broadcastToRevisedShard(this.shards[1])
    })

    it('posts the shard\'s routes', async function () {
      nock('http://connie-west').post('/internal/routes', {
        all: [ this.sRoutes.connieWestToEast ]
      }).reply(200)
      nock('http://connie-west').post('/internal/routes', {
        all: [ this.sRoutes.connieWestToEast, this.sRoutes.connieWestToConradEast ]
      }).reply(200)

      await this.shardBroadcaster.broadcastToRevisedShard(this.shards[0])
      this.tableCoordinator.addMessageRoute(this.mRoutes.connieEastToConradEast)
      await this.shardBroadcaster.broadcastToRevisedShard(this.shards[0])
    })
  })
})
