'use strict'

const Plugin = require('ilp-plugin-payment-channel-framework')
const Store = require('ilp-connector-shard/src/lib/store')
const startShard = require('ilp-connector-shard')
const startRouteManager = require('../../')

exports.sendPlugin = (opts) => {
  return new Plugin(Object.assign({
    server: 'btp+ws://user:westtoken@127.0.0.1:8082'
  }, opts))
}

exports.receiverPlugin = (opts) => {
  return new Plugin(Object.assign({
    maxBalance: '1000000000000',
    prefix: 'g.eur.connie.east.',
    listener: {port: 8085},
    info: {
      currencyScale: 9,
      currencyCode: 'EUR',
      prefix: 'g.eur.connie.east.',
      connectors: ['g.eur.connie.east.server']
    },
    authCheck: (username, token) => username === 'user' && token === 'easttoken',
    _store: new Store()
  }, opts))
}

exports.startConnieWest = (opts) => {
  return startShard(Object.assign({
    internalUri: 'http://127.0.0.1:8081',
    routeManagerUri: 'http://127.0.0.1:8070',
    plugin: new Plugin({
      maxBalance: '1000000000000',
      authCheck: (username, token) => username === 'user' && token === 'westtoken',
      listener: {port: 8082},
      prefix: 'g.usd.connie.west.',
      info: {
        currencyScale: 9,
        currencyCode: 'USD',
        prefix: 'g.usd.connie.west.',
        connectors: ['g.usd.connie.west.server']
      },
      _store: new Store()
    }),
    publicPort: 8080,
    privatePort: 8081
  }, opts))
}

exports.startConnieEast = (opts) => {
  return startShard(Object.assign({
    internalUri: 'http://127.0.0.1:8084',
    routeManagerUri: 'http://127.0.0.1:8070',
    plugin: new Plugin({
      prefix: 'g.eur.connie.east.',
      server: 'btp+ws://user:easttoken@127.0.0.1:8085'
    }),
    publicPort: 8083,
    privatePort: 8084
  }, opts))
}

exports.startRouteManager = (opts) => {
  return startRouteManager(Object.assign({
    shards: [
      {
        prefix: 'g.usd.connie.west.',
        host: 'http://127.0.0.1:8081',
        account: 'g.usd.connie.west.server',
        peerAccount: 'g.usd.connie.west.client',
        initialTable: [{
          prefix: 'g.eur.connie.east.',
          shard: 'http://127.0.0.1:8084',
          curveLocal: [[0, 0], [1000, 2000]],
          local: true
        }]
      },
      {
        prefix: 'g.eur.connie.east.',
        host: 'http://127.0.0.1:8084',
        account: 'g.eur.connie.east.client',
        peerAccount: 'g.eur.connie.east.server',
        initialTable: []
      }
    ],
    privatePort: 8070
  }, opts))
}
