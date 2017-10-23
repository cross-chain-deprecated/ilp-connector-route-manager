'use strict'
/* eslint-env mocha */

const crypto = require('crypto')
const base64url = require('base64url')
const IlpPacket = require('ilp-packet')
const lolex = require('lolex')
const assert = require('assert')
const helpers = require('./helpers')

describe('Integration', function () {
  beforeEach(async function () {
    this.senderRequests = []
    this.senderPlugin = helpers.sendPlugin()
    this.senderPlugin.registerRequestHandler(async (msg) => {
      this.senderRequests.push(msg)
      return { from: msg.to, to: msg.from }
    })
    this.receiverPlugin = helpers.receiverPlugin()

    this.stopConnieWest = await helpers.startConnieWest()
    this.stopConnieEast = await helpers.startConnieEast()
    await this.senderPlugin.connect()
    await this.receiverPlugin.connect()

    this.stopRouteManager = await helpers.startRouteManager()
  })

  afterEach(async function () {
    await this.senderPlugin.disconnect()
    await this.receiverPlugin.disconnect()
    await this.stopConnieWest()
    await this.stopConnieEast()
    this.stopRouteManager()
  })

  it('the sender receives the route broadcast', function () {
    assert.deepStrictEqual(this.senderRequests[0], {
      id: this.senderRequests[0].id,
      from: 'g.usd.connie.west.server',
      to: 'g.usd.connie.west.client',
      custom: {
        method: 'broadcast_routes',
        data: {
          new_routes: [this.mRoutes.connieWestToEast],
          unreachable_through_me: [],
          hold_down_time: 45000,
          request_full_table: true
        }
      }
    })
  })

  it('sends a payment', async function () {
    const preimage = Buffer.from('UrZS+/aZQ36jUgjI/APIW1CwMYtDF7KuslIzVj4LTKU=', 'base64')
    const hash = crypto.createHash('sha256').update(preimage).digest()
    const ilpPacket = IlpPacket.serializeIlpPayment({
      account: 'g.eur.connie.east.bob',
      amount: '100'
    })
    const transfer = {
      to: 'g.usd.connie.west.server',
      id: '5857d460-2a46-4545-8311-1539d99e78e8',
      amount: '51',
      ilp: base64url(ilpPacket),
      executionCondition: base64url(hash),
      expiresAt: (new Date(Date.now() + 5000)).toISOString()
    }

    const prepared = new Promise((resolve) =>
      this.receiverPlugin.on('incoming_prepare', (transfer) => {
        assert.deepStrictEqual(transfer, {
          ledger: 'g.eur.connie.east.',
          from: 'g.eur.connie.east.client',
          to: 'g.eur.connie.east.server',
          id: transfer.id,
          amount: '100',
          ilp: base64url(ilpPacket),
          executionCondition: base64url(hash),
          expiresAt: transfer.expiresAt
        })
        resolve()
      }))
    await this.senderPlugin.sendTransfer(transfer)
    await prepared
  })

  describe('received a remote route', function () {
    beforeEach(async function () {
      await this.receiverPlugin.sendRequest({
        from: 'g.eur.connie.east.server',
        to: 'g.eur.connie.east.client',
        custom: {
          method: 'broadcast_routes',
          data: this.makeUpdate({
            new_routes: [ this.mRoutes.connieEastToConradEast ],
            unreachable_through_me: [],
            hold_down_time: 1234,
            request_full_table: false
          })
        }
      })
    })

    it('the shard relays route broadcasts', function () {
      assert.deepStrictEqual(this.senderRequests[1], {
        id: this.senderRequests[1].id,
        from: 'g.usd.connie.west.server',
        to: 'g.usd.connie.west.client',
        custom: {
          method: 'broadcast_routes',
          data: this.makeUpdate({
            new_routes: [ this.mRoutes.connieWestToConradEast ],
            unreachable_through_me: [],
            hold_down_time: 45000,
            request_full_table: false
          })
        }
      })
    })

    it('the route-manager expires the remote route', async function () {
      this.clock.tick(60000)
      // Wait for the route broadcast to finish.
      await new Promise((resolve) => lolex.timers.setTimeout(resolve, 20))
      assert.deepStrictEqual(this.senderRequests[2], {
        id: this.senderRequests[2].id,
        from: 'g.usd.connie.west.server',
        to: 'g.usd.connie.west.client',
        custom: {
          method: 'broadcast_routes',
          data: {
            new_routes: [],
            unreachable_through_me: ['g.cad.conrad.east.'],
            hold_down_time: 45000,
            request_full_table: false
          }
        }
      })
    })
  })
})
