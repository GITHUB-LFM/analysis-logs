var body = require('koa-body')
const Koa = require('koa')
const fs = require('fs')
const app = new Koa()
const path = require('path')
const port = process.env.PORT || 3000
var Router = require('koa-router')

var router = new Router();
app.use(body());

app.use(require(path.join(__dirname,'/modules','log.js'))().routes());//端口路由


app.use(router.routes())

app.on('error', function(err){
    log.error('server error', err);
});

app.listen(port,function () {
    console.log('host-tools is running http://0.0.0.0:'+port)
});