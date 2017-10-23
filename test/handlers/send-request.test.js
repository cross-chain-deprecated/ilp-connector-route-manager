'use strict'
/* eslint-env mocha */

const assert = require('assert')
const nock = require('nock')
const TableCoordinator = require('../../src/lib/table-coordinator')
const PeerBroadcaster = require('../../src/lib/peer-broadcaster')
const ShardBroadcaster = require('../../src/lib/shard-broadcaster')
const sendRequest = require('../../src/handlers/send-request')

describe('Send request', function () {
  beforeEach(function () {
    this.config.tableCoordinator = new TableCoordinator(this.config)
    this.config.shardBroadcaster = new ShardBroadcaster(this.config)
    this.config.peerBroadcaster = new PeerBroadcaster(this.config)
    this.sendRequest = sendRequest(this.config)
  })

  describe('invalid message', function () {
    it('throws an error without custom', async function () {
      await this.sendRequest({ from: 'g.eur.connie.east.server' }).then(() => {
        assert(false)
      }).catch((err) => {
        assert.equal(err.message, 'unexpected request type')
      })
    })

    it('throws an error when method!=broadcast_routes', async function () {
      await this.sendRequest({
        from: 'g.eur.connie.east.server',
        custom: {method: 'invalid'}
      }).then(() => {
        assert(false)
      }).catch((err) => {
        assert.equal(err.message, 'unexpected request type')
      })
    })

    it('throws an error when an invalid RoutingUpdate is sent', async function () {
      await this.sendRequest(this.makeBroadcast({
        from: 'g.eur.connie.east.server',
        new_routes: 'not an array'
      })).then(() => {
        assert(false)
      }).catch((err) => {
        assert.equal(err.message, 'data.new_routes should be array')
      })
    })
  })

  describe('broadcast_routes', function () {
    it('broadcasts new routes', async function () {
      nock('http://connie-west').post('/internal/routes', {
        all: [
          this.sRoutes.connieWestToEast,
          this.sRoutes.connieWestToConradEast
        ]
      }).reply(200)
      nock('http://connie-east').post('/internal/routes', { all: [] }).reply(200)
      nock('http://connie-west').post('/internal/request', this.makeBroadcast({
        to: 'g.usd.connie.west.client',
        new_routes: [
          this.mRoutes.connieWestToEast,
          this.mRoutes.connieWestToConradEast
        ],
        request_full_table: true
      })).reply(200)

      await this.sendRequest(this.makeBroadcast({
        from: 'g.eur.connie.east.server',
        new_routes: [this.mRoutes.connieEastToConradEast]
      }))
    })
  })
})
