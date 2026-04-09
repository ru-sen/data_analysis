/**
 * @NApiVersion 2.1
 * @NScriptType mapreducescript
 * @NModuleScope Public
 */
define(["N/runtime","N/record","N/search","../../common/SWC_OMS_Utils.js"],
    /**
     *  ①定期抓取订单列表（不包含订单明细）
     *  ②定期抓到账信息
     */
    function(runtime,record,search,SWCommons){
        return {
            getInputData: function (context)
            {
                var maps = new Map();
                SWCommons.processSearch("customrecord_swc_task", null, [["custrecord_swct_exec_error_count","equalto","3"], "and",
                    ["custrecord_swct_status","anyof","2"]
                    ], [search.createColumn({name: "custrecord_swct_tran_name"})], function(result, index)
                {
                    maps.set(result.id,result.getValue({name: "custrecord_swct_tran_name"}));
                });
                log.audit("",JSON.stringify(Array.from(maps)));
                return Array.from(maps);
            },
            map: function (context)
            {
                var options = JSON.parse(context.value);
                context.write({key: options[0],value: options[1]});
                var taskRec;
                if(options[1] == "27")//易快报的费用单据
                {
                    taskRec = record.load({type:"customrecord_swc_task",id:options[0],isDynamic:true});
                    taskRec.setValue({fieldId:"custrecord_swct_api_completed",value:false});
                    taskRec.setValue({fieldId:"custrecord_swct_exec_error_count",value:""});
                    taskRec.save({ignoreMandatoryFields:true,enableSourcing:true});
                }else{
                    record.submitFields({type:"customrecord_swc_task",id:options[0],values:{"custrecord_swct_exec_error_count":0}});
                }
            }
        }
    });
