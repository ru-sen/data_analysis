/**
 * @NApiVersion 2.x
 * @NScriptType ClientScript
 * @NModuleScope SameAccount
 * @author yltian
 * @description 金蝶云星空 科目余额表接口对接 INT-007、008、009、010 => 金蝶云星空凭证抓取
 */
define(["N/ui/dialog", "N/search", "N/https", "N/url", "../../common/SWC_CONFIG_DATA", "N/format"],

    function (dialog, search, https, url, SWC_CONFIG_DATA, format) {

        function pageInit(scriptContext) {
            var curRecord = scriptContext.currentRecord;

            var urlObj = getUrlParameterObj();
            var href = window.location.toString();
            var a = href.indexOf('scriptlet.nl?');
            var b = href.indexOf('&flag');
            href = href.substring(a, b);

            if (urlObj.flag) {
                dialog.alert({title: '友情提示', message: '正在拉取金蝶云星空凭证单据，请稍等!'});
                window.history.replaceState(null, null, href);
            }

            var month = curRecord.getValue({fieldId:"custpage_month"});
            if(month) {
                var accountingperiodSearchObj = search.create({
                    type: "accountingperiod",
                    filters: [["internalid","anyof",month]],
                    columns:
                        [
                            search.createColumn({name: "periodname", sort: search.Sort.ASC, label: "名称"}),
                            search.createColumn({name: "startdate", label: "开始日期"}),
                            search.createColumn({name: "enddate", label: "结束日期"})
                        ]
                });
                accountingperiodSearchObj.run().each(function(result) {
                    var startDate = result.getValue({name: "startdate"})
                    var endDate = result.getValue({name: "enddate"})
                    curRecord.setValue({fieldId:"custpage_start",value:format.parse({value:startDate,type:format.Type.DATE})});
                    curRecord.setValue({fieldId:"custpage_end",value:format.parse({value:endDate,type:format.Type.DATE})});
                    return true;
                });
            }
        }

        /**
         * Validation function to be executed when record is saved.
         *
         * @param {Object} scriptContext
         * @param {Record} scriptContext.currentRecord - Current form record
         * @returns {boolean} Return true if record is valid
         *
         * @since 2015.2
         */
        function saveRecord(scriptContext) {
            var curRec = scriptContext.currentRecord;

            var startDate = curRec.getValue({fieldId: "custpage_start"});
            var endDate = curRec.getValue({fieldId: "custpage_end"});
            if (!startDate) {
                dialog.alert({title: "友情提示", message: "请选择开始时间!"});
                return false;
            }
            if (!endDate) {
                dialog.alert({title: "友情提示", message: "请选择结束时间!"});
                return false;
            }

            // 开始时间不能大于结束时间
            if (startDate.getTime() > endDate.getTime()) {
                dialog.alert({title: "友情提示", message: "请选择开始时间不能大于结束时间!"});
                return false;
            }

            var today = getThisDate(8);
            if (startDate > today && 0 === 1) {
                dialog.alert({title: "友情提示", message: "请选择本月及之前月份进行拉取!"});
                return false;
            }

            // 查看 tracker 里面是否有未完成的金蝶凭证拉取定时操作，如果有不允许继续执行
            var customrecord_swc_task_trackerSearchObj = search.create({
                type: "customrecord_swc_task_tracker",
                filters: [["custrecord_swctt_type", "anyof", "144"], "AND", ["custrecord_swctt_completed", "is", "F"]],
                columns: [search.createColumn({name: "internalid", label: "内部 ID"})]
            });
            var searchResultCount = customrecord_swc_task_trackerSearchObj.runPaged().count;

            if (searchResultCount > 0) {
                dialog.alert({title: "友情提示", message: "有金蝶云星空凭证单据正在等待拉取，请稍后重试!"});
                return false;
            }

            // // 查询当前拉取总条数，当总条数为0的场合，终止处理，提示：暂无待同步数据
            // // 取得开始时间、结束时间、子公司
            // var startDate = curRec.getValue({fieldId: "custpage_start"});
            // var endDate = curRec.getValue({fieldId: "custpage_end"});
            // var subsidiary = curRec.getValue({fieldId: "custpage_subsidiary"});
            //
            // var getTotalUrl = url.resolveScript({
            //     scriptId: "customscript_swc_sl_querykingdeecmnapi",
            //     deploymentId: "customdeploy_swc_sl_querykingdeecmnapi",
            //     params: {
            //         startDate: format.format({value: startDate, type: format.Type.DATE}),
            //         endDate: format.format({value: endDate, type: format.Type.DATE}),
            //         subsidiary: subsidiary,
            //         optFlag: SWC_CONFIG_DATA.configData().KINGDEE_OPT_FLAG_QUERY_VOUCHER_TOTAL
            //     }
            // });
            // var getTotalResp = https.get({url: getTotalUrl});
            // var total = 0;
            // if (getTotalResp.code == 200 && getTotalResp.body) {
            //     var respData = JSON.parse(getTotalResp.body);
            //     if (respData.code != 200) {
            //         dialog.alert({title: "友情提示", message: "拉取失败，请重试"});
            //         return false;
            //     }
            //     total = respData.data.total;
            // }
            // if (total == 0) {
            //     dialog.alert({title: "友情提示", message: "无待拉取数据，请重新选择拉取条件"});
            //     return false;
            // }
            // curRec.setValue({fieldId: "custpage_total", value: total});

            return true;
        }

        /**
         * Function to be executed when field is changed.
         *custpage_saleagreement
         * @param {Object} scriptContext
         * @param {Record} scriptContext.currentRecord - Current form record
         * @param {string} scriptContext.sublistId - Sublist name
         * @param {string} scriptContext.fieldId - Field name
         * @param {number} scriptContext.lineNum - Line number. Will be undefined if not a sublist or matrix field
         * @param {number} scriptContext.columnNum - Line number. Will be undefined if not a matrix field
         *
         * @since 2015.2
         */
        function fieldChanged(scriptContext) {
            var curRecord = scriptContext.currentRecord;
            var month = curRecord.getValue({fieldId:"custpage_month"});
            // 带出来
            if(scriptContext.fieldId == "custpage_month") {
                if(month) {
                    var accountingperiodSearchObj = search.create({
                        type: "accountingperiod",
                        filters: [["internalid","anyof",month]],
                        columns:
                            [
                                search.createColumn({name: "periodname", sort: search.Sort.ASC, label: "名称"}),
                                search.createColumn({name: "startdate", label: "开始日期"}),
                                search.createColumn({name: "enddate", label: "结束日期"})
                            ]
                    });
                    accountingperiodSearchObj.run().each(function(result) {
                        var startDate = result.getValue({name: "startdate"})
                        var endDate = result.getValue({name: "enddate"})
                        curRecord.setValue({fieldId:"custpage_start",value:format.parse({value:startDate,type:format.Type.DATE})});
                        curRecord.setValue({fieldId:"custpage_end",value:format.parse({value:endDate,type:format.Type.DATE})});
                        return true;
                    });
                } else {
                    curRecord.setValue({fieldId:"custpage_start",value:""});
                    curRecord.setValue({fieldId:"custpage_end",value:""});
                }
            }
        }

        /**
         * 获取URL的参数
         * @return {null}
         */
        function getUrlParameterObj() {
            var href = window.location.toString();
            var hrefArr = href.split("?");
            if (!hrefArr[1]) return null;
            var tempArr = hrefArr[1].split("&");
            var parameterObj = {};
            for (var i = 0; i < tempArr.length; i++) {
                var paramArr = tempArr[i].split("=");
                if (!paramArr) continue;
                parameterObj[paramArr[0]] = paramArr[1];
            }
            return parameterObj;
        }

        function getThisDate(timeZone) {
            var date = new Date();
            var utcTime = date.getTime() + date.getTimezoneOffset() * 60 * 1000;
            var tzTime = utcTime + timeZone * 60 * 60 * 1000;
            return new Date(tzTime);
        }

        return {
            pageInit: pageInit,
            saveRecord: saveRecord,
            fieldChanged:fieldChanged
        };

    });
