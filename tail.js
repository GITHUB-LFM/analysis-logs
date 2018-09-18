const Koa = require('koa'),
    route = require('koa-route'),
    websockify = require('koa-websocket');
var fs = require('fs');
var spawn = require('child_process').spawn;
var watch = require('watch');
const logPath = '/Users/huanghuanlai/dounine/github/analysis-logs/logs';

function Format(time, fmt) { //author: meizz
    var o = {
        "M+": time.getMonth() + 1, //月份
        "d+": time.getDate(), //日
        "h+": time.getHours(), //小时
        "m+": time.getMinutes(), //分
        "s+": time.getSeconds(), //秒
        "q+": Math.floor((time.getMonth() + 3) / 3), //季度
        "S": time.getMilliseconds() //毫秒
    };
    if (/(y+)/.test(fmt)) fmt = fmt.replace(RegExp.$1, (time.getFullYear() + "").substr(4 - RegExp.$1.length));
    for (var k in o)
        if (new RegExp("(" + k + ")").test(fmt)) fmt = fmt.replace(RegExp.$1, (RegExp.$1.length == 1) ? (o[k]) : (("00" + o[k]).substr(("" + o[k]).length)));
    return fmt;
}

const app = websockify(new Koa());
var filterFuns = [];
var tailFilePush = function ({name, filterFun}) {
    filterFuns.push({name, filterFun});
};
var tailFilePop = function ({name}) {
    filterFuns.splice(filterFuns.findIndex(obj => obj.name == name), 1);
};
var fun = function () {
    var dayPath = Format(new Date(), "yyyyMMdd") + "/172.16.198.56";
    if (fs.existsSync(logPath + '/' + dayPath)) {
        var filenames = fs.readdirSync(logPath + '/' + dayPath).filter(name => {
            return name.startsWith(("0" + new Date().getHours()).slice(-2) + "_")
        }).map(function (file) {
            return `${logPath}/${dayPath}/${file}`
        });
        var tail = spawn("tail", ["-f", "-n 10"].concat(filenames));
        tail.stdout.on("data", function (data) {
            filterFuns.forEach(fun => {
                fun["filterFun"](data.toString("utf-8"))
            })
        });
    }
};
var preCreateTime = 0;
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

app.ws.use(route.all('/logs/:appKey/:openId/:uuid', function (ctx) {
    var appKey = ctx.url.split("/")[2];
    var openId = ctx.url.split("/")[3];
    var uuid = ctx.url.split("/")[4];
    if(openId.indexOf("*")||appKey.indexOf("*")){
        ctx.websocket.send("(openId|appKey)不能包含正则表达式,请检查");
        ctx.websocket.close();
        return;
    }
    if(!uuid||(uuid&&uuid.length<36)){
        ctx.websocket.send("uuid必需等于36位,请检查");
        ctx.websocket.close();
        return;
    }
    var myFilter = function (data) {
        if (data && data.indexOf(appKey) != -1 && data.indexOf(openId) != -1) {
            ctx.websocket.send(data);
        }
    };
    tailFilePush({name: uuid, filterFun: myFilter});
    ctx.websocket.send(JSON.stringify({status: 'success', msg: '用户行为监听中'}));
    ctx.websocket.on('close', function (message) {
        tailFilePop({name: uuid});
        console.log('连接关闭.');
    });
}));

app.listen(3001, function () {
    console.log(`listener port 3001`);
    fun();
});