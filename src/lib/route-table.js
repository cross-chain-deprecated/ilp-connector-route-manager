'use strict'

const MIN_MESSAGE_WINDOW = 1 // seconds

class RouteTable {
  constructor ({ shard }) {
    this.shard = shard
    this.routes = []
    this.headRoutes = []
    this.epoch = 0
    this.lostLedgers = new Set()
    this.dstCounts = {} // { targetPrefix ⇒ count }
  }

  addHeadRoute (headRoute) {
    headRoute.addedDuringEpoch = ++this.epoch
    this.headRoutes.push(headRoute)
    this.routes.push(headRoute)
    this.dstCount(headRoute.targetPrefix, 1)
  }

  addTailRoute (tailRoute) {
    const headRoute = this.headRoutes.find((_headRoute) =>
      tailRoute.sourceLedger.startsWith(_headRoute.targetPrefix))
    if (!headRoute) return
    const fullRoute = headRoute.join(tailRoute, ++this.epoch)
    if (!fullRoute) return

    this.routes.push(fullRoute)
    this.dstCount(tailRoute.targetPrefix, 1)
    return fullRoute
  }

  getShardRoutes () {
    return this.routes.map((route) => ({
      prefix: route.targetPrefix,
      shard: route.nextShard,
      curveLocal: route.curveLocal,
      curveRemote: route.curveRemote,
      local: route.isLocal
    }))
  }

  getMessageRoutes (sinceEpoch) {
    return this.routes
      .filter((route) => sinceEpoch < route.addedDuringEpoch)
      .map((route) => ({
        source_ledger: this.shard.prefix,
        destination_ledger: route.targetPrefix,
        source_account: this.shard.account,
        min_message_window: MIN_MESSAGE_WINDOW,
        points: route.curveFull,
        paths: route.paths
      }))
  }

  bumpByPeer (peerAccount, holdTime) {
    this.routes.forEach((route) => {
      if (route.foreignPeer === peerAccount) {
        route.bumpExpiration(holdTime)
      }
    })
  }

  removeBy (fn) {
    this.routes = this.routes.filter((route) => {
      const removed = fn(route)
      if (removed) {
        this.dstCount(route.targetPrefix, -1)
        this.epoch++
      }
      return !removed
    })
  }

  dstCount (destination, diff) {
    const newCount = (this.dstCounts[destination] || 0) + diff
    if (newCount === 0) this.lostLedgers.add(destination)
    this.dstCounts[destination] = newCount
  }

  getLostLedgers () {
    const ledgers = Array.from(this.lostLedgers)
    this.lostLedgers.clear()
    return ledgers
  }

  getEpoch () { return this.epoch }
}

module.exports = RouteTable
