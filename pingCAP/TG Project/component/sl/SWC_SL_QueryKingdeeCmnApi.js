/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @NModuleScope public
 * @author yltian
 * @description 金蝶云星空共通API
 */
define(["../../common/SWC_CONFIG_DATA", "../../common/Commons", "N/format", "N/https"],

    (SWC_CONFIG_DATA, Commons, format, https) => {

        /**
         * Defines the Suitelet script trigger point.
         * @param {Object} scriptContext
         * @param {ServerRequest} scriptContext.request - Incoming request
         * @param {ServerResponse} scriptContext.response - Suitelet response
         * @since 2015.2
         */
        const onRequest = (scriptContext) => {
            var parameters = scriptContext.request.parameters;
            var method = scriptContext.request.method;

            var respData = {
                code: "200",
                data: {}
            }
            if (method == "GET") {
                // 操作区分
                var optFlag = parameters.optFlag;
                // 取得凭证接口抓去总条数
                if (optFlag == SWC_CONFIG_DATA.configData().KINGDEE_OPT_FLAG_QUERY_VOUCHER_TOTAL) {
                    var startDate = parameters.startDate
                    startDate = format.parse({value: startDate, type: format.Type.DATE});
                    var endDate = parameters.endDate;
                    endDate = format.parse({value: endDate, type: format.Type.DATE});
                    var subsidiary = parameters.subsidiary;

                    var startStr = formatDate(startDate, "yyyy-MM-dd hh:mm:ss");
                    var endStr = formatDate(endDate, "yyyy-MM-dd hh:mm:ss");
                    var customReqCond = {
                        subsidiary: subsidiary
                            ? [subsidiary]
                            : Commons.schKingdeeCodeExist().map(function (value) {
                           return value.subsidiaryCode
                        })
                    };
                    // 请求参数 => FPERIOD（期间）, FYEAR（年），取得画面选择账期前一月的月份、年份
                    var lastYearMonth = new Date(startDate.getFullYear(), startDate.getMonth() - 1, 1);
                    customReqCond["fPeriod"] = lastYearMonth.getMonth() + 1;
                    customReqCond["fYear"] = lastYearMonth.getFullYear();

                    var tryCount = 3;
                    // 调用登录接口取得cookie
                    var getCookieResp = tryRequestURL(
                        SWC_CONFIG_DATA.configData().KINGDEE_LOGIN_URL,
                        JSON.stringify(SWC_CONFIG_DATA.configData().KINGDEE_LOGIN_POST_DATA),
                        SWC_CONFIG_DATA.configData().KINGDEE_LOGIN_HEADER,
                        "POST",
                        tryCount);
                    var getCookieRespObj = getCookieResp && getCookieResp.body ? JSON.parse(getCookieResp.body) : {};
                    // 循环处理记录数据条数
                    // 设置登录凭证cookie
                    var headers = {"Content-Type":"application/json","Accept":"*/*"};
                    headers["Cookie"] = "kdservice-sessionid=" + getCookieRespObj["KDSVCSessionId"];

                    // 计算索引
                    var curPage = 0, PAGE_SIZE = 2000;
                    // 记录凭证数据总条数
                    var total = 0;
                    // 数据请求处理完成区分：当拉取凭证条数为0的场合，结束处理
                    var exePullFlag = true;
                    while (exePullFlag) {
                        try {
                            var data = Commons.getKingdeeSSReqParam({
                                startStr: startStr,
                                endStr: endStr,
                                customReqCond: customReqCond,
                                curPage: curPage, // 默认从0开始
                                PAGE_SIZE: PAGE_SIZE,
                            });
                            // 调用凭证单据查询接口
                            var response = tryRequestURL(SWC_CONFIG_DATA.configData().KINGDEE_VOUCHER_RECSCH_URL,
                                JSON.stringify(data.reqData), headers, "POST", tryCount);
                            var bodyObj = response && response.body ? JSON.parse(response.body) : [];
                            // 判断是否存在异常
                            if ((bodyObj[0] && bodyObj[0].hasOwnProperty("Result")) || bodyObj.length == 0) {
                                exePullFlag = false;
                            } else {
                                total += bodyObj.length;
                                curPage += 1;
                            }
                        } catch (e) {
                            log.error('错误', e);
                            exePullFlag = false;
                            respData.code = "500";
                        }
                    }

                    respData.data["total"] = total;
                    scriptContext.response.write(JSON.stringify(respData));
                }
            }
        }

        /**
         *
         * @param platformUrl
         * @param postdata
         * @param headers:{name:"Content-Type",value:"text/plain"}
         * @param httpMethod:POST
         * @param tryCount
         * @returns {string}
         */
        function tryRequestURL(platformUrl, postdata, headers, httpMethod, tryCount) {
            var response = "";
            var success = false;
            var error = "";
            for (var i = 0; i < tryCount; i++) {
                try {
                    response = https.request({method:httpMethod,url:platformUrl,body:postdata,headers:headers});
                    success = true;
                    break;
                } catch (e) {
                    log.audit({title:"nlapiRequestURL",details:i + ":" + e});
                    error = e;
                }
            }
            if (!success) {
                throw error;
            }
            return response;
        }

        function formatDate(date, formatStr) {
            var year = date.getFullYear();
            var month = to2Digits(Number(date.getMonth()) + 1);
            var day = to2Digits(date.getDate());
            var hours = to2Digits(date.getHours());
            var mins = to2Digits(date.getMinutes());
            var seconds = to2Digits(date.getSeconds());

            var str = formatStr && formatStr.replace("yyyy", year).replace("MM", month).replace("dd", day).replace("hh", hours).replace("mm", mins).replace("ss", seconds);
            return str;
        }

        function to2Digits(num) {
            return (num < 10 ? "0" : "") + num;
        }

        return {onRequest}

    });
