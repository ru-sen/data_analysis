/**
 * @NApiVersion 2.x
 * @NScriptType WorkflowActionScript
 */
define([],
    function () {
        function onAction(scriptContext) {
            // 输出日志：开始脚本
            log.audit({
                title: 'Start Script'
            });
            // 获取表单元素，获取子列表“item”行的数量
            var newRecord = scriptContext.newRecord;
            newRecord.setValue({
                fieldId:"custrecord_pr_extramemo",
                value:"aaaaaaa"
            });
            // var itemCount = newRecord.getLineCount({
            //     sublistId: 'item'
            // });
            // // 输出“item”的行数确保正确取得
            // log.debug({
            //     title: 'Item Count',
            //     details: itemCount
            // });
            // 循环获取子列表的每一个"quantity(数量)"字段的值，需要在循环里用到“行数”作为“循环次数”
            // for (var i = 0; i < itemCount; i++) {
            //     var quantity = newRecord.getSublistValue({
            //         sublistId: 'item',
            //         fieldId: 'quantity',
            //         line: i
            //     });
            //     // 输出获取到的内容
            //     log.debug({
            //         title: 'Quantity of Item ' + i,
            //         details: quantity
            //     });
            //     // 如果取到的值中有“0”，则返回0
            //     if (quantity === 0) {
            //         return 0;
            //     }
            // }
            // 结束脚本
            log.audit({
                title: 'End Script'
            });
            // // 返回“1”
            // return 1;
        }

        return {
            onAction: onAction
        }
    });