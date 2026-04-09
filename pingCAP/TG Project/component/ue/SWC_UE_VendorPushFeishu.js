/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @description Netsuite 供应商同步到飞书
 */
define(['../../app/SWC_FEISHU_PushData.js', '../../common/SWC_Translate.js'],
    
    (SWC_FEISHU_PushData, SWC_Translate) => {
        /**
         * Defines the function definition that is executed before record is loaded.
         * @param {Object} scriptContext
         * @param {Record} scriptContext.newRecord - New record
         * @param {string} scriptContext.type - Trigger type; use values from the context.UserEventType enum
         * @param {Form} scriptContext.form - Current form
         * @param {ServletRequest} scriptContext.request - HTTP request information sent from the browser for a client action only.
         * @since 2015.2
         */
        const beforeLoad = (scriptContext) => {
            var newRec = scriptContext.newRecord;
            var type = scriptContext.type;
            var form = scriptContext.form;

            // 查看状态，更新供应商信息，代表子公司为空。备注没有期初导入数据
            if (type == scriptContext.UserEventType.VIEW) {
                var representSubsidiary = newRec.getValue({fieldId: 'representingsubsidiary'}); // 代表子公司
                var memo = newRec.getValue({fieldId: 'comments'}); // 备注
                var feishuVendor = newRec.getValue({fieldId: 'custentity_swc_feishu_supply_code'}); // 更新必备
                var feishuVendorId = newRec.getValue({fieldId: 'custentity_swc_feishu_supply_oucode'}); // 更新必备
                if (feishuVendor && feishuVendorId && !representSubsidiary && memo.indexOf("期初导入") < 0) {
                    form.clientScriptModulePath = '../cs/SWC_CS_VendorPushFeishu.js';
                    form.addButton({
                        id: 'custpage_btn_update',
                        label: SWC_Translate.translate('同步供应商信息'),
                        functionName: 'updateFunc'
                    });
                }
            }
        }

        /**
         * Defines the function definition that is executed before record is submitted.
         * @param {Object} scriptContext
         * @param {Record} scriptContext.newRecord - New record
         * @param {Record} scriptContext.oldRecord - Old record
         * @param {string} scriptContext.type - Trigger type; use values from the context.UserEventType enum
         * @since 2015.2
         */
        const beforeSubmit = (scriptContext) => {
            var newRec = scriptContext.newRecord;
            var type = scriptContext.type;

        }

        /**
         * Defines the function definition that is executed after record is submitted.
         * @param {Object} scriptContext
         * @param {Record} scriptContext.newRecord - New record
         * @param {Record} scriptContext.oldRecord - Old record
         * @param {string} scriptContext.type - Trigger type; use values from the context.UserEventType enum
         * @since 2015.2
         */
        const afterSubmit = (scriptContext) => {
            var newRec = scriptContext.newRecord;
            var type = scriptContext.type;

            var representSubsidiary = newRec.getValue({fieldId: 'representingsubsidiary'}); // 代表子公司
            var memo = newRec.getValue({fieldId: 'comments'}); // 备注
            var feishuVendor = newRec.getValue({fieldId: 'custentity_swc_feishu_supply_code'}); // 更新必备
            var feishuVendorId = newRec.getValue({fieldId: 'custentity_swc_feishu_supply_oucode'}); // 更新必备

            if (!feishuVendor && !feishuVendorId && !representSubsidiary && memo.indexOf("期初导入") < 0) {
                // 创建同步飞书
                // if (type == scriptContext.UserEventType.CREATE) {
                    SWC_FEISHU_PushData.exeVendorPush({recId: newRec.id, serverInvokeFlag: true, recType: newRec.type});
                // }
            }
        }

        return {beforeLoad, beforeSubmit, afterSubmit}

    });
