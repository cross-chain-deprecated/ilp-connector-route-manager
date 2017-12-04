'use strict'

const assert = require('assert')
const Ajv = require('ajv')
const ajv = new Ajv()

ajv.addMetaSchema(require('ajv/lib/refs/json-schema-draft-04.json'))
ajv.addSchema(require('../../schemas/IlpAddress.json'))
ajv.addSchema(require('../../schemas/Routes.json'))
ajv.addSchema(require('../../schemas/RoutingUpdate.json'))

const validateRoutingUpdate = (routingUpdate) => {
  const validate = ajv.getSchema('http://example.com/RoutingUpdate.json')
  const valid = validate(routingUpdate)
  if (valid) return
  throw new Error(ajv.errorsText(validate.errors))
}

const validateShardRoute = (shardRoute) => {
  const message = (msg) => 'invalid shard route: ' + msg
  assert.equal(typeof shardRoute.prefix, 'string', message('prefix must be a string'))
  assert.equal(typeof shardRoute.shard, 'string', message('shard must be a string'))
  if (shardRoute.curveLocal !== undefined) {
    assert.ok(Array.isArray(shardRoute.curveLocal), message('curveLocal must be an array'))
  }
  if (shardRoute.curveRemote !== undefined) {
    assert.ok(Array.isArray(shardRoute.curveRemote), message('curveRemote must be an array'))
  }
  if (shardRoute.local !== undefined) {
    assert.equal(typeof shardRoute.local, 'boolean', message('local must be a boolean'))
  }
}

const validateShard = (shard) => {
  const message = (msg) => 'invalid shard: ' + msg
  assert.equal(typeof shard.prefix, 'string', message('prefix must be a string'))
  assert.equal(typeof shard.host, 'string', message('host must be a string'))
  assert.equal(typeof shard.account, 'string', message('account must be a string'))
  assert.equal(typeof shard.peerAccount, 'string', message('peerAccount must be a string'))
  assert.ok(Array.isArray(shard.initialTable), message('initialTable must be an array'))
  shard.initialTable.forEach(validateShardRoute)
}

module.exports = {
  validateRoutingUpdate,
  validateShardRoute,
  validateShard
}
