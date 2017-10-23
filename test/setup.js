'use strict'
/* eslint-env mocha */

const assert = require('assert')
const nock = require('nock')
const lolex = require('lolex')
const START_DATE = 1500000000000

beforeEach(function () {
  this.clock = lolex.install({now: START_DATE})
  this.makeBroadcast = makeBroadcast
  this.makeUpdate = makeUpdate

  this.config = {
    shards: [
      {
        prefix: 'g.usd.connie.west.',
        host: 'http://connie-west',
        account: 'g.usd.connie.west.server',
        peerAccount: 'g.usd.connie.west.client',
        initialTable: [{
          prefix: 'g.eur.connie.east.',
          shard: 'http://connie-east',
          curveLocal: [[0, 0], [50, 100]],
          local: true
        }]
      },
      {
        prefix: 'g.eur.connie.east.',
        host: 'http://connie-east',
        account: 'g.eur.connie.east.client',
        peerAccount: 'g.eur.connie.east.server',
        initialTable: []
      }
    ],
    tables: {},
    holdDownTime: 1234
  }

  this.shards = this.config.shards
  this.sRoutes = {}
  this.mRoutes = {}
  this.sRoutes.connieWestToEast = this.shards[0].initialTable[0]
  this.mRoutes.connieWestToEast = {
    source_ledger: 'g.usd.connie.west.',
    destination_ledger: 'g.eur.connie.east.',
    min_message_window: 1,
    source_account: 'g.usd.connie.west.server',
    paths: [ [] ]
  }

  this.sRoutes.connieEastToWest = {
    prefix: 'g.usd.connie.west.',
    shard: 'http://connie-west',
    curveLocal: [[0, 0], [100, 50]],
    local: true
  }
  this.mRoutes.connieEastToWest = {
    source_ledger: 'g.eur.connie.east.',
    destination_ledger: 'g.usd.connie.west.',
    min_message_window: 1,
    source_account: 'g.eur.connie.east.client',
    paths: [ [] ]
  }

  this.sRoutes.connieWestToConradEast = {
    prefix: 'g.cad.conrad.east.',
    shard: 'http://connie-east',
    curveLocal: [[0, 0], [50, 100]],
    local: false
  }
  this.mRoutes.connieWestToConradEast = {
    source_ledger: 'g.usd.connie.west.',
    destination_ledger: 'g.cad.conrad.east.',
    min_message_window: 1,
    source_account: 'g.usd.connie.west.server',
    paths: [[]]
  }

  this.mRoutes.connieEastToConradEast = {
    source_ledger: 'g.eur.connie.east.',
    destination_ledger: 'g.cad.conrad.east.',
    min_message_window: 1,
    source_account: 'g.eur.connie.east.server'
  }
})

afterEach(function () {
  this.clock.uninstall()

  const isDone = nock.isDone()
  const pending = nock.pendingMocks()
  nock.cleanAll()
  assert(isDone, 'not all nocks were called: ' + JSON.stringify(pending))
})

function makeUpdate (opts) {
  return {
    new_routes: opts.new_routes || [],
    unreachable_through_me: opts.unreachable_through_me || [],
    hold_down_time: opts.hold_down_time || 1234,
    request_full_table: opts.request_full_table || false
  }
}

function makeBroadcast (opts) {
  const msg = {
    to: opts.to,
    custom: {
      method: 'broadcast_routes',
      data: makeUpdate(opts)
    }
  }
  if (opts.from) msg.from = opts.from
  return msg
}
