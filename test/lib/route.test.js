'use strict'
/* eslint-env mocha */

const assert = require('assert')
const Route = require('../../src/lib/route')

const ledgerA = 'ledgerA.'
const ledgerB = 'ledgerB.'
const ledgerC = 'ledgerC.'
const ledgerD = 'ledgerD.'
const hopsABC = { sourceLedger: ledgerA, nextLedger: ledgerB, targetPrefix: ledgerC }
const hopsBCD = { sourceLedger: ledgerB, nextLedger: ledgerC, targetPrefix: ledgerD }
const CURVE = [[0, 0], [50, 100]]

const markA = ledgerA + 'mark'

describe('Route', function () {
  describe('constructor', function () {
    it('sets up a curve and the hops', function () {
      const route = new Route(Object.assign({
        nextShard: 'http://connie-west',
        expiresAt: 1234,
        curveLocal: CURVE,
        isLocal: true,
        foreignPeer: markA,
        addedDuringEpoch: 567
      }, hopsABC))

      assert.equal(route.sourceLedger, ledgerA)
      assert.equal(route.nextLedger, ledgerB)
      assert.equal(route.nextShard, 'http://connie-west')
      assert.equal(route.targetPrefix, ledgerC)

      assert.equal(route.expiresAt, 1234)
      assert.deepEqual(route.curveLocal, CURVE)
      assert.equal(route.isLocal, true)
      assert.equal(route.foreignPeer, markA)
      assert.equal(route.addedDuringEpoch, 567)
      assert.deepEqual(route.paths, [[]])
    })
  })

  describe('join', function () {
    it('succeeds if the routes are adjacent', function () {
      const route1 = new Route({
        sourceLedger: ledgerA,
        nextLedger: ledgerB,
        targetPrefix: ledgerB,
        curveLocal: CURVE,
        isLocal: true
      }, [['path1a.'], ['path1b.']])
      const route2 = new Route(Object.assign({
        expiresAt: Date.now() + 123,
        isLocal: false,
        foreignPeer: markA
      }, hopsBCD), [['path2a1.', 'path2a2.'], ['path2b.']])
      const joinedRoute = route1.join(route2, 1234)

      // It concatenates the hops to ledgerA ledger, *[ 'path1a.' || 'path1b.' ]* ledgerC *[ ('path2a1.', 'path2a2.') || 'path2b.' ]* ledgerD
      assert.deepEqual(joinedRoute.sourceLedger, ledgerA)
      assert.deepEqual(joinedRoute.nextLedger, ledgerB)
      assert.deepEqual(joinedRoute.targetPrefix, ledgerD)
      assert.equal(joinedRoute.foreignPeer, markA)
      assert.equal(joinedRoute.expiresAt, Date.now() + 123)
      assert.deepEqual(joinedRoute.curveLocal, CURVE)
      // It isn't a local pair.
      assert.equal(joinedRoute.isLocal, false)
      assert.equal(joinedRoute.addedDuringEpoch, 1234)
      assert.deepEqual(joinedRoute.paths, [
        [ 'path1a.', ledgerC, 'path2a1.', 'path2a2.' ],
        [ 'path1a.', ledgerC, 'path2b.' ],
        [ 'path1b.', ledgerC, 'path2a1.', 'path2a2.' ],
        [ 'path1b.', ledgerC, 'path2b.' ]
      ])
    })

    it('fails if the routes aren\'t adjacent', function () {
      const route1 = new Route({
        sourceLedger: ledgerA,
        nextLedger: ledgerB
      })
      const route2 = new Route({
        sourceLedger: ledgerC,
        nextLedger: ledgerD
      })
      assert.strictEqual(route1.join(route2, 0), undefined)
    })

    it('fails if the joined route would double back', function () {
      const route1 = new Route({
        sourceLedger: ledgerB,
        nextLedger: ledgerA,
        targetPrefix: ledgerA
      })
      const route2 = new Route(hopsABC)
      assert.strictEqual(route1.join(route2, 0), undefined)
    })
  })

  describe('isExpired', function () {
    it('doesn\'t expire routes by default', function () {
      const route1 = new Route({
        sourceLedger: ledgerA,
        nextLedger: ledgerB
      })
      const route2 = new Route({
        sourceLedger: ledgerA,
        nextLedger: ledgerB,
        expiresAt: Date.now() + 1000
      })
      assert.strictEqual(route1.isExpired(), false)
      assert.strictEqual(route2.isExpired(), false)

      this.clock.tick(2000)
      assert.strictEqual(route1.isExpired(), false)
      assert.strictEqual(route2.isExpired(), true)
    })
  })

  describe('bumpExpiration', function () {
    it('doesn\'t expire routes that have been bumped, but they expire when specified', function () {
      const route1 = new Route(hopsABC)
      const route2 = new Route(Object.assign({expiresAt: Date.now() + 1000}, hopsABC))
      assert.strictEqual(route1.isExpired(), false)
      assert.strictEqual(route2.isExpired(), false)

      route2.bumpExpiration(3000)
      this.clock.tick(2000)
      assert.strictEqual(route1.isExpired(), false)
      assert.strictEqual(route2.isExpired(), false)
      this.clock.tick(5000)
      assert.strictEqual(route1.isExpired(), false)
      assert.strictEqual(route2.isExpired(), true)
    })
  })
})
