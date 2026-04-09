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
                var resultJson = {"調通":"調通"};
                //var userId = context.request.parameters.userId;    // 客户调用SL接口传飞书员工user ID
                var newJson = context.request.body;
                if(newJson) newJson = JSON.parse(newJson);
                log.audit("newJson",newJson)

                if(newJson.hasOwnProperty("event")) {
                    // - 10：归档完成时
                    if(newJson.event.contract_stage_code == 10 && newJson.event.contract_id) {
                        var customrecord_swc_feishu_contractidSearchObj = search.create({
                            type: "customrecord_swc_feishu_contractid",
                            filters: [["custrecord_line_contractid","is",newJson.event.contract_id]],
                            columns:
                                [
                                    search.createColumn({name: "internalid", label: "内部 ID"}),
                                    search.createColumn({name: "custrecord_line_contractid", label: "contractid"})
                                ]
                        });
                        var searchResultCount = customrecord_swc_feishu_contractidSearchObj.runPaged().count;
                        if(searchResultCount > 0) {
                            var res = customrecord_swc_feishu_contractidSearchObj.run().getRange({start:0,end:1});
                            var contractId = res[0].getValue({name: "internalid"});
                            var rec = record.load({type:"customrecord_swc_feishu_contractid",id:contractId});
                            rec.setValue({fieldId:"custrecord_line_success_flag",value:false});
                            rec.save();
                        } else {
                            var rec = record.create({type:"customrecord_swc_feishu_contractid"});
                            rec.setValue({fieldId:"custrecord_line_contractid",value:newJson.event.contract_id});
                            rec.save();
                        }
                        customrecord_swc_feishu_contractidSearchObj.run().each(function(result){
                            // .run().each has a limit of 4,000 results
                            return true;
                        });

                    }
                }

                context.response.write({output:JSON.stringify({"challenge":newJson.challenge})})
            }
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
