'use strict'
/* eslint-env mocha */

const assert = require('assert')
const nock = require('nock')
const TableCoordinator = require('../../src/lib/table-coordinator')
const PeerBroadcaster = require('../../src/lib/peer-broadcaster')

describe('PeerBroadcaster', function () {
  beforeEach(function () {
    this.tableCoordinator = new TableCoordinator(this.config)
    this.config.tableCoordinator = this.tableCoordinator
    this.peerBroadcaster = new PeerBroadcaster(this.config)
  })

  describe('broadcastToRevisedShard', function () {
    it('does nothing when the epoch has not changed', async function () {
      nock('http://connie-west').post('/internal/request', this.makeBroadcast({
        to: 'g.usd.connie.west.client',
        new_routes: [this.mRoutes.connieWestToEast],
        request_full_table: true
      })).reply(200)
      await this.peerBroadcaster.broadcastToRevisedShard(this.shards[0])
      await this.peerBroadcaster.broadcastToRevisedShard(this.shards[0])
    })
  })

  describe('broadcastToShard', function () {
    it('does nothing when there are no routes to add/remove/refresh', async function () {
      await this.peerBroadcaster.broadcastToShard(this.shards[1])
    })

    it('only broadcasts new routes', async function () {
      nock('http://connie-west').post('/internal/request', this.makeBroadcast({
        to: 'g.usd.connie.west.client',
        new_routes: [this.mRoutes.connieWestToEast],
        request_full_table: true
      })).reply(200)
      nock('http://connie-west').post('/internal/request', this.makeBroadcast({
        to: 'g.usd.connie.west.client',
        new_routes: [this.mRoutes.connieWestToConradEast]
      })).reply(200)

      await this.peerBroadcaster.broadcastToShard(this.shards[0])
      this.tableCoordinator.addMessageRoute(this.mRoutes.connieEastToConradEast)
      await this.peerBroadcaster.broadcastToShard(this.shards[0])
    })

    describe('a failed broadcast', function () {
      it('removes the failed peer\'s routes', async function () {
        this.tableCoordinator.addShardRoute(this.shards[1], this.sRoutes.connieEastToWest)
        this.tableCoordinator.addMessageRoute(this.mRoutes.connieEastToConradEast)
        nock('http://connie-east').post('/internal/request', this.makeBroadcast({
          to: 'g.eur.connie.east.server',
          new_routes: [this.mRoutes.connieEastToWest],
          request_full_table: true
        })).twice().reply(500)
        await this.peerBroadcaster.broadcastToShard(this.shards[1])
        // The epoch was reset, so it will retry the broadcast.
        await this.peerBroadcaster.broadcastToShard(this.shards[1])

        // connieEastToConradEast was removed.
        nock('http://connie-west').post('/internal/request', this.makeBroadcast({
          to: 'g.usd.connie.west.client',
          new_routes: [this.mRoutes.connieWestToEast],
          unreachable_through_me: ['g.cad.conrad.east.'],
          request_full_table: true
        })).reply(200)
        await this.peerBroadcaster.broadcastToShard(this.shards[0])
      })
    })
  })

  describe('receiveFromShard', function () {
    beforeEach(function () {
      this.tableWest = this.config.tables['g.usd.connie.west.']
    })

    it('removes unreachable routes', function () {
      this.tableCoordinator.addMessageRoute(this.mRoutes.connieEastToConradEast)
      this.peerBroadcaster.receiveFromShard('g.eur.connie.east.server', this.makeUpdate({
        unreachable_through_me: ['g.cad.conrad.east.']
      }))
      assert.deepEqual(this.tableWest.getMessageRoutes(-1), [this.mRoutes.connieWestToEast])
    })

    it('creates new routes', function () {
      this.peerBroadcaster.receiveFromShard('g.eur.connie.east.server', this.makeUpdate({
        new_routes: [this.mRoutes.connieEastToConradEast]
      }))
      assert.deepEqual(this.tableWest.getMessageRoutes(-1), [
        this.mRoutes.connieWestToEast,
        this.mRoutes.connieWestToConradEast
      ])
    })

    it('ignores new routes that don\'t belong to the sender', function () {
      this.peerBroadcaster.receiveFromShard('g.eur.connie.east.server', this.makeUpdate({
        new_routes: [
          Object.assign({}, this.mRoutes.connieEastToConradEast, {
            source_account: 'g.eur.connie.east.bob'
          })
        ]
      }))
    })

    it('bumps the expiries', function () {
      this.peerBroadcaster.receiveFromShard('g.eur.connie.east.server', this.makeUpdate({
        new_routes: [this.mRoutes.connieEastToConradEast]
      }))
      assert.strictEqual(this.tableWest.routes[1].isExpired(), false)
      this.clock.tick(1235)
      assert.strictEqual(this.tableWest.routes[1].isExpired(), true)
      this.peerBroadcaster.receiveFromShard('g.eur.connie.east.server', this.makeUpdate({}))
      assert.strictEqual(this.tableWest.routes[1].isExpired(), false)
    })

    it('resets the epoch when request_full_table=true', async function () {
      nock('http://connie-west').post('/internal/request', this.makeBroadcast({
        to: 'g.usd.connie.west.client',
        new_routes: [this.mRoutes.connieWestToEast],
        request_full_table: true
      })).reply(200)
      nock('http://connie-west').post('/internal/request', this.makeBroadcast({
        to: 'g.usd.connie.west.client',
        new_routes: [this.mRoutes.connieWestToEast]
      })).reply(200)

      await this.peerBroadcaster.broadcastToShard(this.shards[0])
      this.peerBroadcaster.receiveFromShard('g.usd.connie.west.client', this.makeUpdate({
        request_full_table: true
      }))
      await this.peerBroadcaster.broadcastToShard(this.shards[0])
    })
  })
})
