let fs = require('fs');
let spawn = require('child_process').spawn;
let watch = require('watch');
let uuid = require('uuid/v4');
const Koa = require('koa'),
    route = require('koa-route'),
    websockify = require('koa-websocket');
let dataFormat = require('./format.js');
const logPath = '/logdir2';
const port = 3003;

const app = websockify(new Koa());
let wsClients = new Map();
var tail = null;
let fun = function () {
    let dayPath = dataFormat.format(new Date(), "yyyyMMdd") + "/172.16.198.56";
    if(tail!=null){
        try {
            tail.kill('SIGHUP');
        }catch (e) {
            console.log("tail程序关闭异常");
        }
    }
    if (fs.existsSync(`${logPath}/${dayPath}`)) {

        let filenames = fs.readdirSync(`${logPath}/${dayPath}`).filter(name => {
            return name.startsWith(("0" + new Date().getHours()).slice(-2) + "_")
        }).map(function (file) {
            return `${logPath}/${dayPath}/${file}`
        });

        tail = spawn("tail", ["-f"].concat(filenames));
        tail.stdout.on("data", function (data) {
            for(let filter of wsClients.values()){
                try {
                    filter(data.toString("utf-8"))
                }catch (e) {
                    console.log(e);
                }
            }
        });
    } else {
        console.log(logPath + '/' + dayPath + '路径不存在');
    }
};

let preCreateTime = 0;
watch.watchTree(logPath, function (f, curr, prev) {
    if (typeof f == "object" && prev === null && curr === null) {
    } else if (prev === null) {
        if ((new Date() - preCreateTime) > 1000) {
            fun();
        }
        preCreateTime = new Date().getTime()
    } else if (curr.nlink === 0) {

    } else {

    }
});

app.ws.use(function (ctx, next) {
    return next(ctx);
});

app.ws.use(route.all('/logs/:appKey/:openId', function (ctx) {
    let appKey = ctx.url.split("/")[2];
    let openId = ctx.url.split("/")[3];
    if (openId.indexOf("*") != -1 || appKey.indexOf("*") != -1) {
        ctx.websocket.send(JSON.stringify({status: 'fail', msg: '(openId|appKey)禁止使用正则表达式,请检查'}));
        ctx.websocket.close();
        return;
    }
    let clientId = uuid();
    wsClients.set(clientId,function (data) {
        if (data && data.indexOf(appKey) != -1 && data.indexOf(openId) != -1) {
            data.split("\n").forEach(line => {
                if (line && line.indexOf(appKey) != -1 && line.indexOf(openId) != -1) {
                    try {
                        ctx.websocket.send(line);
                    }catch (e) {
                        console.log('发送异常');
                    }
                }
            })
        }
    });
    ctx.websocket.on('close', function () {
        wsClients.delete(clientId);
    });

    ctx.websocket.on('error', function () {
        wsClients.delete(clientId);
        console.log('连接异常.');
    });

    ctx.websocket.on('message', function (message) {
        if(message==='online'){
            ctx.websocket.send(JSON.stringify({status: 'success', msg: '当前在线人数：'+wsClients.size}));
        }else if(message==='id'){
            ctx.websocket.send("你的id为："+clientId);
        }
    });
}));

app.listen(port, function () {
    console.log(`listener port ${port}`);
    fun();
});