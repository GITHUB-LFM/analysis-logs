const Koa = require('koa'),
    route = require('koa-route'),
    websockify = require('koa-websocket');
let fs = require('fs');
let spawn = require('child_process').spawn;
let watch = require('watch');
let dataFormat = require('./format.js');
const logPath = '/logdir2';
// const logPath = '/Users/huanghuanlai/dounine/github/analysis-logs/logs';


const app = websockify(new Koa());
let filterFuns = [];
let tailFilePush = function ({name, filterFun}) {
    if (filterFuns.findIndex(obj => obj.name == name) != -1) {
        return false;
    }
    filterFuns.push({name, filterFun});
    return true;
};
let tailFilePop = function ({name}) {
    filterFuns.splice(filterFuns.findIndex(obj => obj.name == name), 1);
};
let fun = function () {
    let dayPath = dataFormat.format(new Date(), "yyyyMMdd") + "/172.16.198.56";
    if (fs.existsSync(logPath + '/' + dayPath)) {
        let filenames = fs.readdirSync(logPath + '/' + dayPath).filter(name => {
            return name.startsWith(("0" + new Date().getHours()).slice(-2) + "_")
        }).map(function (file) {
            return `${logPath}/${dayPath}/${file}`
        });
        let tail = spawn("tail", ["-f", "-n 10"].concat(filenames));
        tail.stdout.on("data", function (data) {
            filterFuns.forEach(fun => {
                fun["filterFun"](data.toString("utf-8"))
            })
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
            console.log('创建文件');
            fun();
        }
        preCreateTime = new Date().getTime()
    } else if (curr.nlink === 0) {
        // console.log('删除文件');
    } else {
        //console.log('修改文件');
    }
});

app.ws.use(function (ctx, next) {
    return next(ctx);
});

app.ws.use(route.all('/logs/:appKey/:openId', function (ctx) {
    let appKey = ctx.url.split("/")[2];
    let openId = ctx.url.split("/")[3];
    if (openId.indexOf("*") != -1 || appKey.indexOf("*") != -1) {
        ctx.websocket.send(JSON.stringify({status: 'fail', msg: '(openId|appKey)不能包含正则表达式,请检查'}));
        ctx.websocket.close();
        return;
    }
    let myFilter = function (data) {
        if (data && data.indexOf(appKey) != -1 && data.indexOf(openId) != -1) {
            data.split("\n").forEach(line => {
                if (line && line.indexOf(appKey) != -1 && line.indexOf(openId) != -1) {
                    ctx.websocket.send(line);
                }
            })
        }
    };
    if (!tailFilePush({name: openId + appKey, filterFun: myFilter})) {
        ctx.websocket.send(JSON.stringify({status: 'fail', msg: '一个openId只能打开监听一款appKey数据,请检查是否有其它浏览器在使用'}));
        ctx.websocket.close();
        return;
    }
    ctx.websocket.send(JSON.stringify({status: 'success', msg: '用户行为监听中'}));
    ctx.websocket.on('close', function (message) {
        tailFilePop({name: openId + appKey});
        console.log('连接关闭.');
    });
}));

app.listen(3001, function () {
    console.log(`listener port 3001`);
    fun();
});