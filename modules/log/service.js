const cmd = require('node-cmd')
const Promise = require('bluebird')
const getAsync = Promise.promisify(cmd.get, {multiArgs: true, context: cmd})

module.exports = function () {
    function Format(time,fmt) { //author: meizz
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

    this.log = function (ctx) {
        let appKey = ctx.params.appKey;
        let limit = ctx.params.limit;
        let timeStr = ctx.params.timeStr;
        if(limit>=100||limit<=0){
            limit = 100;
        }
        let hour = new Date().getHours();
        let time = new Date(timeStr);
        if(isNaN(time)){
            ctx.body = {
                code: 'LOGIC',
                data: '时间格式不正确(参数:2018-01-01 12:12:12)'
            }
            return;
        }
        let times = [];
        for(let i=0;i<60;i++){
            times.push((parseInt(time.getTime()/1000))+i);
        }
        let todayStr = Format(new Date(),"yyyyMMdd");
        let ec1 = `cat /logdir2/${todayStr}/*/${hour}_*.log | grep ${appKey} | grep -E '${times.join("|")}' | head -n ${limit}`;
        return getAsync(ec1).then((data, err) => {
            if (err) {
                ctx.body = {
                    code: "LOGIC",
                    msg: "查询出错.",
                    data: err
                }
            } else {
                let logJsons = []
                let logs = data[0].split(/\n/)
                for(let line of logs){
                    let normalLine = line.replace(/\\"/g, '"').replace('"{', '{').replace('}"', '}');
                    if(normalLine){
                        try{
                            logJsons.push(JSON.parse(normalLine.trim()))
                        }catch (e) {
                            logJsons.push(normalLine)
                        }
                    }
                }
                ctx.body = {
                    code: 'OK',
                    data: logJsons
                }
            }
        }).catch(err => {
            console.log(err)
            ctx.body = {
                code: 'ERROR',
                msg: err
            }
        });
    }

    return this
}