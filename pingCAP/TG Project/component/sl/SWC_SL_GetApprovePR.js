/**
 * @NApiVersion 2.x
 * @NScriptType Suitelet
 * @NModuleScope Public
 */
define(['N/record','N/search','N/http','N/runtime',"N/format","N/url"],
    /**
     * 飞书合同获取员工已审批的采购申请链接url
     * @param {record} record
     * @param {search} search
     * @param {http} http
     * @param {runtime} runtime
     *
     */
    function(record,search,http,runtime,format,url) {

        /**
         * Definition of the Suitelet script trigger point.
         *  errorCode
         *  0 正确
         *  60001 userId为空
         *  60002 根据userId查询不到员工
         *  60003 意外错误，请联系管理员
         * @param {Object} context
         * @param {ServerRequest} context.request - Encapsulation of the incoming request
         * @param {ServerResponse} context.response - Encapsulation of the Suitelet response
         * @Since 2015.2
         */
        function onRequest(context) {
            if(context.request.method == "POST") {
                log.audit("1",context.request.parameters)
                var resultJson = {};
                //var userId = context.request.parameters.userId;    // 客户调用SL接口传飞书员工user ID
                var newJson = context.request.body;
                if(newJson) newJson = JSON.parse(newJson);
                log.audit("newId",newJson.userId)
                log.audit("keywords",newJson.keywords)
                var userId = newJson.userId;
                var keywords = newJson.keywords;
                if(keywords) {
                    try {
                        resultJson = {
                            "code":"0",
                            "msg":"success",
                            "data":{}
                        }
                        var receipts = [];
                        var customrecord_swc_purchase_requestSearchObj = search.create({
                            type: "customrecord_swc_purchase_request",
                            filters:
                                [
                                    ["isinactive","is","F"],
                                    "AND",
                                    ["idtext","is",keywords],
                                    "AND",
                                    ["custrecord_prs_field.custrecord_prs_line_status","anyof","10"] // 采购申请状态采购订单已创建
                                ],
                            columns:
                                [
                                    search.createColumn({name: "internalid", summary: "GROUP", label: "内部 ID"}),
                                    search.createColumn({name: "name", summary: "GROUP", sort: search.Sort.ASC, label: "ID"}),
                                    search.createColumn({name: "custrecord_pr_extramemo", summary: "GROUP",  label: "申请理由"}),
                                    search.createColumn({name: "custrecord_pr_buyer", summary: "GROUP",  label: "提交人"}),
                                    search.createColumn({name: "custrecord_pr_date", summary: "GROUP", label: "单据创建日期"})
                                ]
                        });
                        var searchResultCount = customrecord_swc_purchase_requestSearchObj.runPaged().count;
                        resultJson["data"]["total"] = searchResultCount;
                        resultJson["data"]["receipts"] = [];
                        var result = getAllResultsOfSearch(customrecord_swc_purchase_requestSearchObj);
                        for(var i = 0; i < result.length; i++) {
                            var scheme = 'https://';
                            var host = url.resolveDomain({
                                hostType: url.HostType.APPLICATION
                            });
                            var relativePath = url.resolveRecord({
                                recordType: 'customrecord_swc_purchase_request',
                                recordId: result[i].getValue({name: "internalid"}),
                                isEditMode: false
                            });
                            var output = scheme + host + relativePath;

                            var emp = result[i].getValue({name: "custrecord_pr_buyer", summary: "GROUP"});
                            var res = search.lookupFields({type:"employee",id:emp,columns:["custentity_swc_feishu_userid"]});
                            var obj = {

                                "id":result[i].getValue({name: "internalid", summary: "GROUP"}),
                                "title":result[i].getValue({name: "name", summary: "GROUP"}),
                                "content":result[i].getValue({name: "custrecord_pr_extramemo", summary: "GROUP"}),
                                "sponsor":res["custentity_swc_feishu_userid"],
                                "createTime":result[i].getText({name: "custrecord_pr_date", summary: "GROUP"}),
                                "pcAppLink":output,
                                "mobileAppLink":"",
                            }

                            resultJson["data"]["receipts"].push(obj);
                        }

                    } catch (e) {
                        resultJson = {
                            "code":"60003",
                            "msg":"系统错误，请联系管理员："+ e
                        }
                    }
                } else {
                    if(!userId) {
                        resultJson = {
                            "code":"60001",
                            "msg":"userId为空"
                        }
                        crtLog4PushApi({reqParam: {"userId":userId}, respParam: resultJson, tranName: "sysnFeiShuPR"});
                        context.response.write({output:JSON.stringify(resultJson)})
                        return;
                    }



                    // 获取NS员工内部ID
                    var empId = getNSEmpId(userId);
                    if(!empId) {
                        resultJson = {
                            "code":"60002",
                            "msg":"根据userId查询不到员工"
                        }
                        crtLog4PushApi({reqParam: {"userId":userId}, respParam: resultJson, tranName: "sysnFeiShuPR"});
                        context.response.write({output:JSON.stringify(resultJson)})
                        return;
                    }


                    var today = (format.format({value:new Date(),type:format.Type.DATETIME,timezone:format.Timezone.ASIA_HONG_KONG})).split(' ')[0];
                    log.audit({title:'today',details:today})
                    var todayDate = format.parse({value:today,type:format.Type.DATE});
                    todayDate.setDate(todayDate.getDate()-5);
                    todayDate = format.format({value:todayDate,type:format.Type.DATE});
                    log.audit({title:'前五天',details:todayDate})

                    try {
                        resultJson = {
                            "code":"0",
                            "msg":"success",
                            "data":{}
                        }
                        var receipts = [];
                        var customrecord_swc_purchase_requestSearchObj = search.create({
                            type: "customrecord_swc_purchase_request",
                            filters:
                                [
                                    ["isinactive","is","F"],
                                    "AND",
                                    ["custrecord_pr_buyer","anyof",empId],
                                    "AND",
                                    ["custrecord_pr_date","onorafter",todayDate],
                                    "AND",
                                    ["custrecord_prs_field.custrecord_prs_line_status","anyof","10"] // 采购申请状态采购订单已创建
                                ],
                            columns:
                                [
                                    search.createColumn({name: "internalid", summary: "GROUP", label: "内部 ID"}),
                                    search.createColumn({name: "name", summary: "GROUP", sort: search.Sort.ASC, label: "ID"}),
                                    search.createColumn({name: "custrecord_pr_extramemo", summary: "GROUP", label: "申请理由"}),
                                    search.createColumn({name: "custrecord_pr_date", summary: "GROUP", label: "单据创建日期"})
                                ]
                        });
                        var searchResultCount = customrecord_swc_purchase_requestSearchObj.runPaged().count;
                        resultJson["data"]["total"] = searchResultCount;
                        resultJson["data"]["receipts"] = [];
                        var result = getAllResultsOfSearch(customrecord_swc_purchase_requestSearchObj);
                        for(var i = 0; i < result.length; i++) {
                            var scheme = 'https://';
                            var host = url.resolveDomain({
                                hostType: url.HostType.APPLICATION
                            });
                            var relativePath = url.resolveRecord({
                                recordType: 'customrecord_swc_purchase_request',
                                recordId: result[i].getValue({name: "internalid"}),
                                isEditMode: false
                            });
                            var output = scheme + host + relativePath;
                            var obj = {
                                "id":result[i].getValue({name: "internalid", summary: "GROUP"}),
                                "title":result[i].getValue({name: "name", summary: "GROUP"}),
                                "content":result[i].getValue({name: "custrecord_pr_extramemo", summary: "GROUP"}),
                                "sponsor":userId,
                                "createTime":result[i].getText({name: "custrecord_pr_date", summary: "GROUP"}),
                                "pcAppLink":output,
                                "mobileAppLink":"",
                            }
                            resultJson["data"]["receipts"].push(obj);
                        }

                    } catch (e) {
                        resultJson = {
                            "code":"60003",
                            "msg":"系统错误，请联系管理员："+ e
                        }
                    }

                }

                log.audit("resultJson",JSON.stringify(resultJson))
                // 创建日志
                crtLog4PushApi({reqParam: {"userId":userId}, respParam: resultJson, tranName: "sysnFeiShuPR"});

                context.response.write({output:JSON.stringify(resultJson)})
            }
        }


        /**
         * 创建日志，记录推送接口请求参数和响应参数
         * @param {Object} options
         * @param {Object} options.reqParam 请求参数
         * @param {Object} options.respParam 响应参数
         * @param {string} options.tranName 事务处理名称：推送接口名称，需维护关联列表
         */
        function crtLog4PushApi(options) {
            var reqParam = options.reqParam;
            var respParam = options.respParam;

            var logRec = record.create({type: "customrecord_swc_task", isDynamic: true});
            // 电商平台（TODO 旺店通内部ID，生产需调整）
            logRec.setValue({fieldId: 'custrecord_swct_platform', value: '3'});
            // 事务类型
            logRec.setText({fieldId: 'custrecord_swct_tran_name', text: options.tranName});
            // 接口执行入参
            if (reqParam) {
                logRec.setValue({fieldId: 'custrecord_swct_input_data', value: JSON.stringify(reqParam)});
            }
            // 接口返回值
            if (respParam) {
                logRec.setValue({fieldId: 'custrecord_swct_output', value: JSON.stringify(respParam)});
            }
            // 最后一次修改时间
            var latModDate = format.format({value: new Date(), type: format.Type.DATETIME});
            logRec.setValue({fieldId: 'custrecord_swct_api_last_modified', value: latModDate});
            if (respParam.code == 0) {
                // 接口执行结果   custrecord_swct_result
                logRec.setValue({fieldId: 'custrecord_swct_result', value: "ok"});
                //任务状态，1.成功，2失败
                logRec.setValue({fieldId: 'custrecord_swct_status', value: 1});
                //接口返回值   custrecord_swct_output
                //newWs.setValue({fieldId: 'custrecord_swct_output', value: informationAll.returnedMessages});
                //接口调用执行完成   custrecord_swct_api_completed
                logRec.setValue({fieldId: 'custrecord_swct_api_completed', value: true});
                //业务执行完成   custrecord_swct_exec_completed
                logRec.setValue({fieldId: 'custrecord_swct_exec_completed', value: true});
            } else {
                //接口执行结果   custrecord_swct_result
                logRec.setValue({fieldId: 'custrecord_swct_result', value: "error"});
                //任务状态，1.成功，2失败 3.关闭
                logRec.setValue({fieldId: 'custrecord_swct_status', value: 3});
                //接口返回值   custrecord_swct_output
                //newWs.setValue({fieldId: 'custrecord_swct_output', value: informationAll.errorMessage});
                //接口调用执行完成   custrecord_swct_api_completed
                logRec.setValue({fieldId: 'custrecord_swct_api_completed', value: false});
                //接口调用失败次数   custrecord_swct_api_error_count
                logRec.setValue({fieldId: 'custrecord_swct_api_error_count', value: 3});
                //业务执行失败次数   custrecord_swct_exec_error_count
                logRec.setValue({fieldId: 'custrecord_swct_exec_error_count', value: 3});
            }
            logRec.save();
        }

        function getNSEmpId(userId) {
            var empId = "";
            var employeeSearchObj = search.create({
                type: "employee",
                filters: [["custentity_swc_feishu_userid","is",userId], "AND", ["isinactive","is","F"]],
                columns:
                    [
                        search.createColumn({name: "internalid", label: "内部 ID"}),
                        search.createColumn({name: "custentity_swc_feishu_userid", label: "飞书员工id"})
                    ]
            });
            employeeSearchObj.run().each(function(result) {
                empId = result.getValue({name: "internalid"});
                return true;
            });
            return empId;
        }



        /**
         * 获取所有保存检索结果
         * @param saveSearch 保存检索
         * @return 数据结果数组
         */
        function getAllResultsOfSearch(saveSearch) {
            var resultset = saveSearch.run();
            var start = 0;
            var step = 1000;
            var resultArr = [];
            var results = resultset.getRange({
                start : start,
                end : Number(start) + Number(step)
            });
            while (results && results.length > 0) {
                resultArr = resultArr.concat(results);
                start = Number(start) + Number(step);
                results = resultset.getRange({
                    start : start,
                    end : Number(start) + Number(step)
                });
            }
            return resultArr;
        }


        return {
            onRequest: onRequest
        };

    });
