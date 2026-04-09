/**
 * @NApiVersion 2.x
 * @NScriptType ClientScript
 * @NModuleScope public
 * @author yltian
 * @description 采购申请UE引用文件
 */
define(["N/currentRecord", "N/record", "N/ui/dialog", "../../common/SWC_Translate", "../../common/SWC_CONFIG_DATA"],

function(currentRecord, record, dialog, SWC_Translate, SWC_CONFIG_DATA) {
    
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
     * Validation function to be executed when record is saved.
     *
     * @param {Object} scriptContext
     * @param {Record} scriptContext.currentRecord - Current form record
     * @returns {boolean} Return true if record is valid
     *
     * @since 2015.2
     */
    function saveRecord(scriptContext) {
        var curRec = scriptContext.currentRecord;

        // 保存单据不执行推送处理
        curRec.setValue({fieldId: "custrecord_pr_submit_flag", value: false});

        return true;
    }

    /**
     * 设置单据推送飞书审批
     */
    function sbtFsApproval() {
        var curRec = currentRecord.get();

        // 利用jQuery移除提交按钮HTML
        // 删除页头提交按钮
        // jQuery("#tdbody_custpage_btn_sbtfsapproval").parent().parent().parent().parent().prev().remove();
        // jQuery("#tdbody_custpage_btn_sbtfsapproval").parent().parent().parent().parent().remove();
        // // 删除页尾提交按钮
        // jQuery("#tdbody_secondarycustpage_btn_sbtfsapproval").parent().parent().parent().parent().prev().remove();
        // jQuery("#tdbody_secondarycustpage_btn_sbtfsapproval").parent().parent().parent().parent().remove();

        var prsRec = record.load({type: "customrecord_swc_purchase_request", id: curRec.id});
        // 是否推送 = true
        prsRec.setValue({fieldId: "custrecord_pr_submit_flag", value: true});
        // 是否推送已驳回数据，设置为true的场合，推送已驳回数据
        prsRec.setValue({fieldId: "custrecord_pr_refuse_flag", value: true});

        prsRec.save();

        dialog.alert({
            title: SWC_Translate.translate("提示"),
            message: SWC_Translate.translate("提交完成")
        }).then(function (value) {
            location.reload();
        }).catch(function (error) {
            alert(error)
        });
    }

    /**
     * Validation function to be executed when record is deleted.
     *
     * @param {Object} scriptContext
     * @param {Record} scriptContext.currentRecord - Current form record
     * @param {string} scriptContext.sublistId - Sublist name
     *
     * @returns {boolean} Return true if sublist line is valid
     *
     * @since 2015.2
     */
    function validateDelete(scriptContext) {
        var curRec = scriptContext.currentRecord;
        var sublistId = scriptContext.sublistId;

        if (sublistId == "recmachcustrecord_prs_field") {
            // 审批状态为：飞书审批中、飞书审批完成、采购订单已创建场合的明细行不可被删除，
            // 上述场合点击删除提示：当前行数据处理中或处理完成，不可删除
            // 取得当前行审批状态
            var approvalStatus = curRec.getCurrentSublistValue({sublistId: sublistId, fieldId: "custrecord_prs_line_status"});
            if (approvalStatus == SWC_CONFIG_DATA.configData().WORKFLOW_STATUS_FS_APPROVAL
                || approvalStatus == SWC_CONFIG_DATA.configData().WORKFLOW_STATUS_FS_APPROVAL_FINISH
                || approvalStatus == SWC_CONFIG_DATA.configData().WORKFLOW_STATUS_PURCH_ORD_CREATED) {
                dialog.alert({
                    title: SWC_Translate.translate("提示"),
                    message: SWC_Translate.translate("当前行数据处理中或处理完成，不可删除")
                }).catch(function (error) {
                    alert(error);
                })
                return false;
            }
        }

        return true;
    }

    return {
        pageInit: pageInit,
        sbtFsApproval: sbtFsApproval,
        saveRecord: saveRecord,
        validateDelete: validateDelete
    };
    
});
