/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @author yltian
 * @description 金蝶云星空 科目余额表接口对接 INT-007、008、009、010 => 金蝶云星空凭证抓取
 */
define(["N/runtime", "N/task", "N/record", "N/format", "N/search", "N/http", "N/https",
        "N/ui/serverWidget", "N/redirect", "../../common/SWC_OMS_Utils.js", "../../common/Commons.js"],

    (runtime, task, record, format, search, http, https, serverWidget,
     redirect, SWCommons, Commons) => {

        /**
         * 按页面展示数据拉取金蝶凭证接口，创建NS日记账单据
         * @param {Object} scriptContext
         * @param {ServerRequest} scriptContext.request - Incoming request
         * @param {ServerResponse} scriptContext.response - Suitelet response
         * @since 2015.2
         */
        const onRequest = (scriptContext) => {
            var method = scriptContext.request.method;
            var parameters = scriptContext.request.parameters;

            if (method == "GET") {
                var subsidiary = parameters.subsidiary || "";

                var form = serverWidget.createForm({title: "金蝶云星空凭证抓取"});

                form.clientScriptModulePath = '../cs/SWC_CS_QuerykingdeeVoucher';

                form.addSubmitButton({label: "执行"});

                form.addField({
                    id: 'custpage_month',
                    label: "月份",
                    type: 'SELECT',
                    source: 'accountingperiod'
                }).updateLayoutType({layoutType: serverWidget.FieldLayoutType.OUTSIDEABOVE});
                form.addField({
                    id: 'custpage_start',
                    label: "开始时间",
                    type: 'DATE'
                }).updateDisplayType({displayType: serverWidget.FieldDisplayType.DISABLED});
                form.addField({
                    id: 'custpage_end',
                    label: "结束时间",
                    type: 'DATE'
                }).updateDisplayType({displayType: serverWidget.FieldDisplayType.DISABLED});

                var subsidiaryField = form.addField({
                    id: 'custpage_subsidiary',
                    label: "子公司",
                    type: serverWidget.FieldType.SELECT
                });
                subsidiaryField.addSelectOption({
                    value: "",
                    text: "全部公司"
                });
                // 检索金蝶云星空编码不为空的公司数据
                var subsidiaryAry = Commons.schKingdeeCodeExist();
                // 设置公司主体固定值
                subsidiaryAry.forEach(function (value) {
                    subsidiaryField.addSelectOption({
                        value: value.subsidiaryCode, // 子公司星空云编码
                        text: value.subsidiaryName   // 子公司名称
                    });
                });
                subsidiaryField.defaultValue = subsidiary.toString();
                // 添加总条数字段
                form.addField({
                    id: 'custpage_total',
                    label: "总条数",
                    type: serverWidget.FieldType.INTEGER
                }).updateDisplayType({displayType: serverWidget.FieldDisplayType.HIDDEN});

                var sublist = form.addSublist({
                    id: 'custpage_sublist',
                    type: serverWidget.SublistType.LIST,
                    label: '操作明细'
                });

                sublist.addField({id: 'custpage_month', label: '月份', type: serverWidget.FieldType.TEXT});
                sublist.addField({id: 'custpage_exetime', label: '执行时间', type: serverWidget.FieldType.TEXT});
                sublist.addField({id: 'custpage_isfinish', label: '是否已完成', type: serverWidget.FieldType.TEXT});
                sublist.addField({id: 'custpage_exeperson', label: '执行人', type: serverWidget.FieldType.TEXT});
                sublist.addField({id: 'custpage_startdate', label: '开始时间', type: serverWidget.FieldType.TEXT});
                sublist.addField({id: 'custpage_enddate', label: '结束时间', type: serverWidget.FieldType.TEXT});
                sublist.addField({id: 'custpage_subsidiary', label: '子公司', type: serverWidget.FieldType.TEXT});

                // 字列表展示自定义记录 拉去凭证操作记录 内容
                var sublistArr = [];
                var kingdeeVoucherRecordSchObj = search.create({
                    type: "customrecord_swc_kingdee_voucher_record",
                    filters: [],
                    columns:
                        [
                            search.createColumn({name: "custrecord_swc_kingdee_voucher_month", label: "月份"}),
                            search.createColumn({name: "custrecord_swc_kingdee_voucher_date", label: "执行时间"}),
                            search.createColumn({name: "custrecord_swc_kingdee_voucher_startdate", label: "开始时间"}),
                            search.createColumn({name: "custrecord_swc_kingdee_voucher_enddate", label: "结束时间"}),
                            search.createColumn({
                                name: "custrecord_swctt_completed",
                                join: "CUSTRECORD_SWC_KINGDEE_VOUCHER_TRACKER",
                                label: "是否已完成"
                            }),
                            search.createColumn({name: "custrecord_swc_kingdee_voucher_person", label: "执行人"}),
                            search.createColumn({name: "custrecord_swc_kingdee_voucher_subsidiar", label: "子公司"}),
                        ]
                });
                var searchResultCount = kingdeeVoucherRecordSchObj.runPaged().count;
                if (searchResultCount > 0) {
                    kingdeeVoucherRecordSchObj.run().each(function (result) {
                        sublistArr.push({
                            "month": result.getValue({name: "custrecord_swc_kingdee_voucher_month", label: "月份"}),
                            "date": result.getValue({name: "custrecord_swc_kingdee_voucher_date", label: "执行时间"}),
                            "startDate": result.getValue({
                                name: "custrecord_swc_kingdee_voucher_startdate",
                                label: "开始时间"
                            }),
                            "endDate": result.getValue({name: "custrecord_swc_kingdee_voucher_enddate", label: "结束时间"}),
                            "finish": result.getValue({
                                name: "custrecord_swctt_completed",
                                join: "CUSTRECORD_SWC_KINGDEE_VOUCHER_TRACKER",
                                label: "是否已完成"
                            }),
                            "person": result.getText({name: "custrecord_swc_kingdee_voucher_person", label: "执行人"}),
                            "subsidiary": result.getValue({
                                name: "custrecord_swc_kingdee_voucher_subsidiar",
                                label: "子公司"
                            })
                        })
                        return true;
                    });
                }

                for (var i = 0; i < sublistArr.length; i++) {
                    if (sublistArr[i]["month"]) sublist.setSublistValue({
                        id: "custpage_month",
                        line: i,
                        value: sublistArr[i]["month"]
                    });
                    if (sublistArr[i]["date"]) sublist.setSublistValue({
                        id: "custpage_exetime",
                        line: i,
                        value: sublistArr[i]["date"]
                    });
                    if (sublistArr[i]["finish"] == "true" || sublistArr[i]["finish"] == true) {
                        sublist.setSublistValue({id: "custpage_isfinish", line: i, value: "是"});
                    } else {
                        sublist.setSublistValue({id: "custpage_isfinish", line: i, value: "否"});
                    }
                    if (sublistArr[i]["person"]) sublist.setSublistValue({
                        id: "custpage_exeperson",
                        line: i,
                        value: sublistArr[i]["person"]
                    });
                    if (sublistArr[i]["startDate"]) sublist.setSublistValue({
                        id: "custpage_startdate",
                        line: i,
                        value: sublistArr[i]["startDate"]
                    });
                    if (sublistArr[i]["endDate"]) sublist.setSublistValue({
                        id: "custpage_enddate",
                        line: i,
                        value: sublistArr[i]["endDate"]
                    });
                    if (sublistArr[i]["subsidiary"]) {
                        // 根据编码取得对应的下拉列表数据
                        var subsidiaryName = null;
                        for (var j = 0; j < subsidiaryAry.length; j++) {
                            if (sublistArr[i]["subsidiary"] == subsidiaryAry[j].subsidiaryCode) {
                                subsidiaryName = subsidiaryAry[j].subsidiaryName;
                                break;
                            }
                        }
                        if (subsidiaryName) {
                            // 设置编码对应的公司名称
                            sublist.setSublistValue({
                                id: "custpage_subsidiary",
                                line: i,
                                value: subsidiaryName
                            });
                        }
                    } else {
                        // 子公司为空的场合，显示全部"全部公司"
                        sublist.setSublistValue({
                            id: "custpage_subsidiary",
                            line: i,
                            value: "全部公司"
                        });
                    }

                }

                scriptContext.response.writePage({pageObject: form});
            } else if (method == "POST") {
                var startDate = scriptContext.request.parameters.custpage_start;
                startDate = format.parse({value: startDate, type: format.Type.DATE});
                var endDate = scriptContext.request.parameters.custpage_end;
                endDate = format.parse({value: endDate, type: format.Type.DATE});
                var today = getThisDate(8);
                var subsidiary = parameters.custpage_subsidiary;
                // 总页数
                var total = parameters.custpage_total;
                // 执行时间处理
                var now = SWCommons.getDate(8);
                var exeDate = SWCommons.formatDate(now, "yyyy-MM-dd hh:mm:ss");

                // 如果选择的结束日期比现在大。结束日期默认为现在
                if (endDate.getTime() > today.getTime()) {
                    endDate = today;
                }

                // 如果选择的是之前的月份。
                if ((Number(endDate.getMonth()) + 1) < (Number(today.getMonth()) + 1)) {
                    endDate.setDate(endDate.getDate() + 1);
                    endDate.setSeconds(endDate.getSeconds() - 1);
                } else {
                    // 如果当月，且为今天。时分秒等于现在
                    if ((Number(endDate.getDate())) == (Number(today.getDate()))) {
                        endDate = today;
                    }
                }

                var startStr = "" + startDate.getFullYear() + zeroPush(startDate.getMonth() + 1) + zeroPush(startDate.getDate()) + "000000";
                var endStr = "" + endDate.getFullYear() + zeroPush(endDate.getMonth() + 1) + zeroPush(endDate.getDate()) + zeroPush(endDate.getHours()) + zeroPush(endDate.getMinutes()) + zeroPush(endDate.getSeconds());

                // 创建tracker
                var trackerRec = record.create({type: "customrecord_swc_task_tracker"});
                trackerRec.setValue({fieldId: "custrecord_swctt_platform", value: "4"}); // 金蝶云星空
                trackerRec.setValue({fieldId: "custrecord_swctt_type", value: "144"}); // 金蝶凭证拉取
                trackerRec.setValue({fieldId: "custrecord_swctt_start", value: startStr});
                trackerRec.setValue({fieldId: "custrecord_swctt_end", value: endStr});
                // 检索条件设置：{"subsidiary": ["子公司内部ID", ...]}
                var customReqCond = {
                    subsidiary: subsidiary
                        ? [subsidiary]
                        : Commons.schKingdeeCodeExist().map(function (value) {
                            return value.subsidiaryCode
                        })
                };
                // 执行时间
                customReqCond["exeDate"] = exeDate;
                // 执行人
                customReqCond["person"] = runtime.getCurrentUser().id;
                // 请求参数 => FPERIOD（期间）, FYEAR（年），取得画面选择账期前一月的月份、年份
                var lastYearMonth = new Date(startDate.getFullYear(), startDate.getMonth() - 1, 1);
                customReqCond["fPeriod"] = lastYearMonth.getMonth() + 1;
                customReqCond["fYear"] = lastYearMonth.getFullYear();
                // 总条数
                trackerRec.setValue({fieldId: "custrecord_swctt_total", value: total});
                // 每页条数（默认100条）
                trackerRec.setValue({fieldId: "custrecord_swctt_page_size", value: 40});

                trackerRec.setValue({fieldId: "custrecord_custom_req_cond", value: JSON.stringify(customReqCond)});
                var trackerRecId = trackerRec.save();

                // 创建操作记录
                var operationRec = record.create({type: "customrecord_swc_kingdee_voucher_record"});
                operationRec.setValue({
                    fieldId: "custrecord_swc_kingdee_voucher_month",
                    value: startDate.getFullYear() + "年" + (startDate.getMonth() + 1) + "月"
                });
                operationRec.setValue({
                    fieldId: "custrecord_swc_kingdee_voucher_date",
                    value: exeDate
                });
                operationRec.setValue({
                    fieldId: "custrecord_swc_kingdee_voucher_person",
                    value: runtime.getCurrentUser().id
                });
                operationRec.setValue({fieldId: "custrecord_swc_kingdee_voucher_tracker", value: trackerRecId});
                operationRec.setValue({
                    fieldId: "custrecord_swc_kingdee_voucher_startdate",
                    value: stringToDate(startStr)
                });
                operationRec.setValue({fieldId: "custrecord_swc_kingdee_voucher_enddate", value: stringToDate(endStr)});
                if (subsidiary) operationRec.setValue({
                    fieldId: "custrecord_swc_kingdee_voucher_subsidiar",
                    value: subsidiary
                });

                operationRec.save();

                // 转发到当前页面
                redirect.toSuitelet({
                    scriptId: 'customscript_swc_sl_querykingdeevoucher',
                    deploymentId: 'customdeploy_swc_sl_querykingdeevoucher',
                    parameters: {
                        flag: 'a',
                        startDate: format.format({value: startDate, type: format.Type.DATE}),
                        endDate: format.format({value: endDate, type: format.Type.DATE}),
                        subsidiary: subsidiary
                    }
                });
            }
        }

        function stringToDate(str) {
            var year = str.substr(0, 4);
            var month = str.substr(4, 2);
            var day = str.substr(6, 2);
            var hours = str.substr(8, 2);
            var mins = str.substr(10, 2);
            var seconds = str.substr(12, 2);
            return "" + year + "-" + month + "-" + day + " " + hours + ":" + mins + ":" + seconds;
        }

        function zeroPush(string) {
            if (String(string).length == 1) {
                return "0" + string;
            } else {
                return string;
            }
        }

        function getThisDate(timeZone) {
            var date = new Date();
            var utcTime = date.getTime() + date.getTimezoneOffset() * 60 * 1000;
            var tzTime = utcTime + timeZone * 60 * 60 * 1000;
            return new Date(tzTime);
        }

        return {onRequest}

    });
