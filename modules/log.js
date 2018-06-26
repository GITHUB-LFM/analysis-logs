var Router = require('koa-router')
const service = require('./log/service')()

module.exports = function () {

    return new Router()
        .get('/logs/:appKey/:timeStr/:limit', async = ctx => {
            return service.log(ctx)
        })
}