'use strict'

const http = require('http')
const Koa = require('koa')
const Router = require('koa-router')
const Logger = require('koa-logger')
const Parser = require('koa-bodyparser')
const Boom = require('boom')

class PrivateApp {
  constructor ({ handlers }) {
    const app = new Koa()
    const router = new Router()
    const parser = new Parser()
    const logger = new Logger()

    app.use(logger)
    app.use(parser)
    app.use(router.routes())
    app.use(router.allowedMethods({
      throw: true,
      notImplemented: () => Boom.notImplemented(),
      methodNotAllowed: () => Boom.methodNotAllowed()
    }))

    router.post('/internal/shard/:shard', async (ctx) => {
      ctx.body = await handlers.broadcastToShard({ shardPrefix: ctx.params.shard })
      ctx.status = 200
    })

    router.post('/internal/request', async (ctx) => {
      ctx.body = await handlers.sendRequest({
        from: ctx.request.body.from,
        custom: ctx.request.body.custom
      })
      ctx.status = 200
    })

    this.app = app
    this.router = router
  }

  listen (port) {
    this.server = http.createServer(this.app.callback()).listen(port)
  }

  close () {
    this.server.close()
  }
}

module.exports = PrivateApp
