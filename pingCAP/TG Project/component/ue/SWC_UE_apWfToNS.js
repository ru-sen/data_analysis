/**
 * @NApiVersion 2.0
 * @NScriptType UserEventScript
 * @NModuleScope Public
 * @author yltian
 * @description 采购申请审批
 */
define(["N/runtime", "N/search","N/format", "N/email","N/url","../../common/SWC_OMS_Utils", "N/file", 'N/record', 'N/currency',
        "../../common/SWC_FsPushApprovalCmnToNS", "../../common/SWC_CONFIG_DATA", "../../lib/decimal", "../../common/SWC_Translate"],

    function (runtime, search,format,email,url, SWCommons, file, record, currency, SWC_FsPushApprovalCmn,
              SWC_CONFIG_DATA, decimal, SWC_Translate) {


        /**
         * Defines the function definition that is executed after record is submitted.
         * @param {Object} scriptContext
         * @param {Record} scriptContext.newRecord - New record
         * @param {Record} scriptContext.oldRecord - Old record
         * @param {string} scriptContext.type - Trigger type; use values from the context.UserEventType enum
         * @since 2015.2
         */
        function afterSubmit(scriptContext) {
            var newRec = scriptContext.newRecord;
            var type = scriptContext.type;
            var id = newRec.id;
            if(type == "create"){
                var buyer = newRec.getValue({fieldId: 'custrecord_prwf_buyer'}); // 提交人
                var approver = newRec.getValue({fieldId: 'custrecord_prwf_approver'}); // 审批人
                log.audit(buyer,approver);
                if(buyer && approver){
                    var scheme = 'https://';
                    var host = url.resolveDomain({ hostType: url.HostType.APPLICATION });
                    var relativePath = url.resolveRecord({ recordType: 'customrecord_swc_pr_wf', recordId: id, isEditMode: false });
                    var output = scheme + host + relativePath;//采购申请审批URL
                    email.send({
                        author: buyer,
                        recipients: approver,
                        subject: "Purchase Requisition Request has been created successfully",//采购申请审批创建成功
                        body: "Purchase Requisition Request has been created successfully. Internal ID: "+id+". "+output//采购申请审批创建成功
                    });
                    log.audit("邮件发送成功",output);
                }
            }

        }

        return {
            afterSubmit:afterSubmit
        };

    });
