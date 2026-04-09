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
                SWCommons.execTask({apiCompleted : false, taskId : 15907163});

            },
            map: function (context)
            {

            }
        }
    });