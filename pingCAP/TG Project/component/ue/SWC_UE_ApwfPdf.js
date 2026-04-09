/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
define(['N/search'],

    (search) => {
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
            var type = scriptContext.type;
            if (type == "view") {
                var rec = scriptContext.newRecord;
                // var approver = rec.getValue({fieldId: "custrecord_apwf_approver"}); // 审批人
                // var paytime = rec.getValue({fieldId: "custrecord_apwf_actul_paytime"}); // 付款日期
                var options = poPaySearch(rec.id);
                // 当审批人为邱芳并且付款日期存在值时，view状态显示按钮。
                if (options.approver == "695" && options.paytime) {
                    var form = scriptContext.form;
                    form.clientScriptModulePath = "../cs/SWC_CS_ApwfPdf.js";
                    form.addButton({
                        id: "custpage_btn_pdf",
                        label: "发票打印按钮",
                        functionName: "printPDF(" + rec.id + ")"
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

        function poPaySearch(id) {
            var options = {};
            var customrecord_swc_ap_wfSearchObj = search.create({
                type: "customrecord_swc_ap_wf",
                filters:
                    [
                        ["internalid", "anyof", id]
                    ],
                columns:
                    [
                        search.createColumn({name: "custrecord_apwf_approver", label: "审批人"}),
                        search.createColumn({name: "custrecord_apwf_actul_paytime", label: "付款日期"})
                    ]
            });
            var searchResultCount = customrecord_swc_ap_wfSearchObj.runPaged().count;
            if (customrecord_swc_ap_wfSearchObj && searchResultCount > 0) {
                customrecord_swc_ap_wfSearchObj.run().each(function (result) {
                    options.approver = result.getValue({name: "custrecord_apwf_approver", label: "审批人"});
                    options.paytime = result.getValue({name: "custrecord_apwf_actul_paytime", label: "付款日期"});
                    // .run().each has a limit of 4,000 results
                    return true;
                });
            }
            return options;
        }

        return {beforeLoad, beforeSubmit, afterSubmit}

    });
