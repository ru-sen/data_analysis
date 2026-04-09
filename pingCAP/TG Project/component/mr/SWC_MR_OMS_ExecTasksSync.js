/**
 * @NApiVersion 2.1
 * @NScriptType mapreducescript
 * @NModuleScope Public
 * @author ytian
 * @description 同步执行任务
 */
define(["N/runtime","N/record","N/search","../../common/SWC_OMS_Utils.js"],
    /**
     *  ①定期抓取订单列表（不包含订单明细）
     *  ②定期抓到账信息
     * ["custrecord_swct_tran_name","anyof","144","145"] => 金蝶云星空凭证拉取："getKingdeeVoucherList", "getKingdeeVoucher";
     */
    function(runtime,record,search,SWCommons){
            return {
                    getInputData: function (context)
                    {
                            // var platformJson = SWCommons.getPlatform("GUANYI");
                            var maps = new Map();
                            var TASK_TRY_ERR_COUNT = SWCommons.getGlobalVariable(null, "TASK_TRY_ERR_COUNT") || 3;
                            // 检索尚未执行完成的Task，并执行 (status 不是success或closed)
                            SWCommons.processSearch("customrecord_swc_task", null, [[ "custrecord_swct_status", "noneof", [ "1", "3"] ], "and",
                                    [ "formulanumeric:nvl({custrecord_swct_api_error_count},0)", "lessthan", TASK_TRY_ERR_COUNT ], "and",
                                    [ "formulanumeric:nvl({custrecord_swct_exec_error_count},0)", "lessthan", TASK_TRY_ERR_COUNT ], "and",
                                    ["custrecord_swct_tran_name","anyof","144","145"] ], null, function(result, index)
                            {
                                    // log.audit({title:"EXEC:" + index, details:result.id});
                                    maps.set(result.id,false);
                            });
                            return Array.from(maps);
                    },
                    map: function (context)
                    {
                            var options = JSON.parse(context.value);
                            context.write({key: options[0],value: options[1]});
                    },
                    reduce: function (context)
                    {
                            //执行Task
                            SWCommons.execTask({apiCompleted : false, taskId : context.key});
                            // log.audit({title:"context.key" , details:context.key});

                            context.write({
                                    key: context.key,
                                    value: context.values
                            });
                    },
                    summarize: function (summary)
                    {
                            var counts = 0;
                            summary.output.iterator().each(function (key, value)
                            {
                                    // log.audit({title: "summarize" + key,details: value});
                                    counts += 1;
                                    return true;
                            });
                            var errors = [];
                            summary.mapSummary.errors.iterator().each(function(key,error){
                                    // log.audit({title:key,details:error});
                                    errors.push(error)
                                    return true;
                            });
                            // log.audit("counts", counts);
                            // log.audit("summary.usage", summary.usage);
                            // log.audit("summary.errors", errors);
                    }
            }
    });
