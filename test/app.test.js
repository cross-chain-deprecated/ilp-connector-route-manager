'use strict'
/* eslint-env mocha */

const request = require('superagent')
const assert = require('assert')
const nock = require('nock')
const startRouteManager = require('../')

describe('App', function () {
  beforeEach(async function () {
    nock('http://connie-west').post('/internal/routes', {
      all: [ this.sRoutes.connieWestToEast ]
    }).reply(200)
    nock('http://connie-east').post('/internal/routes', { all: [] }).reply(200)
    nock('http://connie-west').post('/internal/request', this.makeBroadcast({
      to: 'g.usd.connie.west.client',
      new_routes: [ this.mRoutes.connieWestToEast ],
      hold_down_time: 45000,
      request_full_table: true
    })).reply(200)

    this.host = 'http://127.0.0.1:8000'
    this.stopRouteManager = await startRouteManager({
      shards: this.config.shards,
      privatePort: 8000
    })
  })

  afterEach(function () {
    this.stopRouteManager()
  })

  describe('/internal/shard/:shard', function () {
    it('broadcasts the shard routes', async function () {
      nock('http://connie-west').post('/internal/routes', {
        all: [ this.sRoutes.connieWestToEast ]
      }).reply(200)
      const res = await request.post(this.host + '/internal/shard/g.usd.connie.west.')
      assert.equal(res.statusCode, 200)
    })
  })

  describe('/internal/request', function () {
    it('broadcasts routes', async function () {
      nock('http://connie-west').post('/internal/routes', {
        all: [ this.sRoutes.connieWestToEast, this.sRoutes.connieWestToConradEast ]
      }).reply(200)
      nock('http://connie-west').post('/internal/request', this.makeBroadcast({
        to: 'g.usd.connie.west.client',
        new_routes: [ this.mRoutes.connieWestToConradEast ],
        hold_down_time: 45000
      })).reply(200)

      const res = await request.post(this.host + '/internal/request')
        .send(this.makeBroadcast({
          from: 'g.eur.connie.east.server',
          new_routes: [ this.mRoutes.connieEastToConradEast ]
        }))
      assert.equal(res.statusCode, 200)
    })
  })
})
