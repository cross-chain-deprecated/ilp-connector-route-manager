'use strict'

const { LiquidityCurve } = require('ilp-routing')

class Route {
  /**
   * @param {Object} info
   * @param {String} info.sourceLedger - the ledger through which an incoming route enters this connector
   * @param {String} info.nextLedger - the ledger to which the connector should forward payments
   * @param {String} info.nextShard - the shard host to which the connector should forward payments
   * @param {String} info.targetPrefix - the last ledger on this route
   * @param {Number} info.expiresAt
   * @param {Point[]} info.curveLocal
   * @param {Point[]} info.curveRemote
   * @param {Boolean} info.isLocal
   * @param {String} info.foreignPeer
   * @param {String[][]} paths - possible lists of hops in between nextLedger and targetPrefix
   */
  constructor (info, paths = [ [] ]) {
    this.sourceLedger = info.sourceLedger
    this.nextLedger = info.nextLedger
    this.nextShard = info.nextShard
    this.targetPrefix = info.targetPrefix

    this.expiresAt = info.expiresAt
    this.curveLocal = info.curveLocal
    this.curveRemote = info.curveRemote
    this.curveFull = info.curveFull
    this.isLocal = info.isLocal
    this.foreignPeer = info.foreignPeer

    this.addedDuringEpoch = info.addedDuringEpoch
    this.paths = paths
  }

  /**
   * @returns {Boolean}
   */
  isExpired () { return this.expiresAt < Date.now() }

  /**
   * @param {Integer} holdDown milliseconds
   */
  bumpExpiration (holdDown) {
    if (this.expiresAt !== Infinity) {
      this.expiresAt = Date.now() + holdDown
    }
  }

  /**
   * @param {Route} tailRoute
   * @returns {Route}
   */
  join (tailRoute, addedDuringEpoch) {
    // Make sure the routes are actually adjacent, and check for loops:
    if (!canJoin(this, tailRoute)) return
    // Example:
    // this = {
    //   sourceLedger: S1,
    //   nextLedger: N1,
    //   targetPrefix: J,
    //   paths: [ [ P1.1, P1.2 ] ]
    // }
    // tailRoute = {
    //   sourceLedger: J,
    //   nextLedger: N2,
    //   targetPrefix: D2,
    //   paths: [ [Q1.1, Q1.2], [Q2.1, Q2.2] ]
    // }
    // joined = {
    //   sourceLedger: S1,
    //   nextLedger: N1,
    //   targetPrefix: D2,
    //   paths: [
    //     [P1.1 P1.2 J N2 Q1.1 Q1.2],
    //     [P1.1 P1.2 J N2 Q2.1 Q2.2]
    //   ]
    // }
    //
    // Take special care:
    // If N1 === J, don't include J in the joined paths
    // If N2 === D2, don't include N2 in the joined paths
    const havePaths = {}
    this.paths.map((headPath) => {
      if (this.targetPrefix !== this.nextLedger) {
        // N1 !== J, so include J:
        headPath = headPath.concat(this.targetPrefix)
      }
      if (tailRoute.targetPrefix !== tailRoute.nextLedger) {
        // N2 !== D2, so include N2:
        headPath = headPath.concat(tailRoute.nextLedger)
      }
      tailRoute.paths.map((tailPath) => {
        havePaths[ JSON.stringify(headPath.concat(tailPath)) ] = true
      })
    })

    const curveRemote = (new LiquidityCurve(this.curveRemote)).join(
      new LiquidityCurve(tailRoute.curveFull))
    const curveFull = (new LiquidityCurve(this.curveLocal)).join(curveRemote)

    return new Route({
      curveLocal: this.curveLocal,
      curveRemote: curveRemote.getPoints(),
      curveFull: curveFull.getPoints(),
      sourceLedger: this.sourceLedger,
      nextLedger: this.nextLedger,
      nextShard: this.nextShard,
      targetPrefix: tailRoute.targetPrefix,
      isLocal: false,
      foreignPeer: tailRoute.foreignPeer,
      expiresAt: tailRoute.expiresAt,
      addedDuringEpoch: addedDuringEpoch
    }, Object.keys(havePaths).map(JSON.parse))
  }
}

/**
 * @param {Route} routeA
 * @param {Route} routeB
 * @returns {Boolean} whether routeA and routeB can join without forming a loop
 */
function canJoin (routeA, routeB) {
  // These routes would be concatenated as:
  //  routeA.sourceLedger, routeA.nextLedger, [[ routeA.paths ]], routeA.targetPrefix
  //                                                              === routeB.sourceLedger, routeB.nextLedger, [[ routeB.paths ]], routeB.targetPrefix
  //
  //  routeC.sourceLedger, routeC.nextLedger, [[ routeA.paths ** [routeA.targetPrefix, routeB.nextLedger] ** routeB.paths ]], routeC.targetPrefix
  // (the ** tries to express that any path from routeA can be combined with any path from routeB)

  // These three should always be different from each other:
  const fixedLedgers = [routeA.sourceLedger, routeA.nextLedger, routeB.targetPrefix]
  if (routeA.targetPrefix !== routeB.sourceLedger) {
    // routes are not adjacent, can't join them
    return false
  }
  // If routeA has third ledger, add it:
  if (routeA.targetPrefix !== routeA.nextLedger) {
    fixedLedgers.push(routeA.targetPrefix)
  }
  // If routeB has third ledger, add it:
  if (routeB.targetPrefix !== routeB.nextLedger) {
    fixedLedgers.push(routeB.nextLedger)
  }

  // Now we have 3, 4, or 5 fixed ledgers; check that they all differ:
  const visited = {}
  for (let ledger of fixedLedgers) {
    if (visited[ledger]) return false
    visited[ledger] = true
  }

  // Check for intersections between routeA's paths and visited:
  // Remember paths are the alternative options between routeA.nextLedger and routeA.targetPrefix.
  //
  for (let path of routeA.paths) {
    for (let ledger of path) {
      if (visited[ledger]) return false
    }
  }

  // Now add all ledgers from routeA's paths to visited:
  for (let path of routeA.paths) {
    for (let ledger of path) {
      visited[ledger] = true
    }
  }
  // And check for intersections between routeB's paths and everything else:
  for (let path of routeB.paths) {
    for (let ledger of path) {
      if (visited[ledger]) return false
    }
  }

  return true
}

module.exports = Route
