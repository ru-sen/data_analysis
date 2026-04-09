/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 * @NModuleScope Public
 * @description Netsuite供应商数据同步飞书
 */
define(['../../app/SWC_FEISHU_PushData.js', 'N/currentRecord', 'N/record'],

function(SWC_FEISHU_PushData, currentRecord, record) {
    
    /**
     * Function to be executed after page is initialized.
     *
     * @param {Object} scriptContext
     * @param {Record} scriptContext.currentRecord - Current form record
     * @param {string} scriptContext.mode - The mode in which the record is being accessed (create, copy, or edit)
     *
     * @since 2015.2
     */
    function pageInit(scriptContext) {
    }

    /**
     * 推送旺店通货品编号
     */
    function updateFunc() {
        SWC_FEISHU_PushData.exeVendorPush({recId: currentRecord.get().id, serverInvokeFlag: false, recType: currentRecord.get().type});
    }

    return {
        pageInit: pageInit,
        updateFunc: updateFunc
    };
    
});
