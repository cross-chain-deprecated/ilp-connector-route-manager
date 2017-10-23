'use strict'
/* eslint-env mocha */

const assert = require('assert')
const nock = require('nock')
const TableCoordinator = require('../../src/lib/table-coordinator')
const ShardBroadcaster = require('../../src/lib/shard-broadcaster')
const broadcastToShard = require('../../src/handlers/broadcast-to-shard')

describe('Broadcast to shard', function () {
  beforeEach(function () {
    this.tableCoordinator = new TableCoordinator(this.config)
    this.config.shardBroadcaster = new ShardBroadcaster(this.config)
    this.broadcastToShard = broadcastToShard(this.config)
  })

  describe('no matching shard', function () {
    it('throws an error', async function () {
      await this.broadcastToShard({shardPrefix: 'not a prefix'}).then(() => {
        assert(false)
      }).catch((err) => {
        assert.equal(err.message, 'no matching shard found')
      })
    })
  })

  describe('a valid shard', function () {
    it('broadcasts the shard routes', async function () {
      nock('http://connie-west').post('/internal/routes', {
        all: [ this.sRoutes.connieWestToEast ]
      }).reply(200)
      await this.broadcastToShard({shardPrefix: 'g.usd.connie.west.'})
    })
  })
})
