/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
define(['N/currentRecord', 'N/record','N/search'],

    (currentRecord, record,search) => {
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
            //首先获取表单，表单类型，表单记录
            var newRec = scriptContext.newRecord;
            var type = scriptContext.type;
            var form = scriptContext.form;
            // 如果是【查看】模式
            if (type=='view'){
                // 获取【审批状态】的值
                var isExamine = newRec.getValue({fieldId:"custrecord_advpay_status"});
                // 获取【关联付款单】字段的值
                var assoPay = newRec.getValue({fieldId:"custrecord_advpay_prepaynote"});
                // 如果【同步状态】未勾选(同步失败)，则添加手动推送按钮
                if (assoPay==""&&isExamine==3){
                    //首先引用CS
                    form.clientScriptModulePath = '../cs/SWC_CS_CrtAdvPay.js'
                    // 接着添加按钮
                    form.addButton({
                        id:"custpage_btn_crt_adv_pay",
                        label:"创建预付款",
                        functionName:"crtAdvPay"
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
        }

        return {
            beforeLoad,
            // beforeSubmit,
            // afterSubmit
        }

    });
