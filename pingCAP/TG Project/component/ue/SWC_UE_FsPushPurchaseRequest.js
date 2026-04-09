/**
 * @NApiVersion 2.0
 * @NScriptType UserEventScript
 * @NModuleScope Public
 * @author yltian
 * @description 采购申请单据飞书接口推送
 */
define(["N/runtime", "N/search", "../../common/SWC_OMS_Utils", "N/file", 'N/record', 'N/currency',
        "../../common/SWC_FsPushApprovalCmn", "../../common/SWC_CONFIG_DATA", "../../lib/decimal", "../../common/SWC_Translate"],

    function (runtime, search, SWCommons, file, record, currency, SWC_FsPushApprovalCmn,
              SWC_CONFIG_DATA, decimal, SWC_Translate) {

        /**
         * Defines the function definition that is executed before record is loaded.
         * @param {Object} scriptContext
         * @param {Record} scriptContext.newRecord - New record
         * @param {string} scriptContext.type - Trigger type; use values from the context.UserEventType enum
         * @param {Form} scriptContext.form - Current form
         * @param {ServletRequest} scriptContext.request - HTTP request information sent from the browser for a client action only.
         * @since 2015.2
         */
        function beforeLoad(scriptContext) {
            var newRec = scriptContext.newRecord;
            var type = scriptContext.type;
            var form = scriptContext.form;

            try {
                // UI 操作的场合
                if (runtime.executionContext == runtime.ContextType.USER_INTERFACE) {
                    // 移除更改ID按钮
                    removeChangeIdBtn(type, form);

                    if (!newRec.id) return;

                    var prsRec = record.load({type: "customrecord_swc_purchase_request", id: newRec.id});
                    var prsLineCount = prsRec.getLineCount({sublistId: "recmachcustrecord_prs_field"});
                    // 无明细行终止处理
                    if (!prsLineCount) return ;

                    // 明细行【审批状态】全部不为"待提交（1）" && 不为"飞书审批驳回（5）" && 不为"推送失败（11）"，不添加提交按钮
                    // 取得明细行提交状态 true： 存在可提交数据，false：不存在可提交数据
                    var addFlag = getItemLineSbtFlag(prsLineCount, prsRec);

                    // 添加提交飞书审批按钮，点击按钮推送飞书审批单据
                    addSubmitFsApprovalBtn(addFlag, type, form);

                    // 编辑页面进入的场合，全部明细行推送完成，移除保存按钮
                    removeSaveBtn(addFlag, type, form);
                }

            } catch (e) {
                log.error("程序异常", e)
            }
        }

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

            try {
                if (type == "create" || type == "edit") {
                    // 非导入的场合，推送状态为待提交或飞书审批驳回的采购申请单据
                    syncFsPushPurchApply({newRec: record.load({type: "customrecord_swc_purchase_request", id: newRec.id})});
                }
            } catch (e) {
                log.error("程序错误", e.message);
            }
        }

        /**
         * 添加提交飞书审批按钮，点击按钮推送飞书审批单据
         * @param {boolean} addFlag 添加标志：true添加提交按钮
         * @param {string} type 触发类型
         * @param {Form} form 表单对象
         */
        function addSubmitFsApprovalBtn(addFlag, type, form) {
            // 查看以外的场合，结束处理
            if (type != "view") return ;

            if (addFlag) {
                // 添加提交按钮
                form.clientScriptModulePath = "../cs/SWC_CS_FsPushPurchaseRequest.js";
                form.addButton({id: "custpage_btn_sbtfsapproval", label: SWC_Translate.translate("提交"), functionName: "sbtFsApproval"});
            } else {
                // 飞书审批中：3/飞书审批完成：4/采购订单已创建：10的场合移除编辑按钮
                form.removeButton({id: "edit"});
            }
        }

        /**
         * 编辑页面进入的场合，全部明细行推送完成，移除保存按钮
         * @param {boolean} addFlag 添加标志：true添加提交按钮（单据未全部推送完成）
         * @param {string} type 触发类型
         * @param {Form} form 表单对象
         */
        function removeSaveBtn(addFlag, type, form) {
            // 编辑以外的场合，终止处理
            if (type != "edit") return ;

            if (!addFlag) {
                // 不存在可提交数据的场合，移除保存按钮
                form.removeButton({id: "submitter"});
            }
        }

        /**
         * 移除更改ID按钮
         * @param {string} type 触发类型
         * @param {Form} form 表单对象
         */
        function removeChangeIdBtn(type, form) {
            // 编辑或保存以外的场合，终止处理
            if (type != "edit" && type != "copy") return ;

            form.removeButton({id: "changeid"});
        }

        /**
         * 非导入的场合，推送状态为待提交或飞书审批驳回的采购申请单据
         * @param {Record} options.newRec 新记录
         */
        function syncFsPushPurchApply(options) {
            var newRec = options.newRec;

            // 是否提交=false的场合，终止处理
            var submitFlag = newRec.getValue({fieldId: "custrecord_pr_submit_flag"});
            log.error("submitFlag：" + newRec.id, submitFlag)
            if (!submitFlag) return ;

            // CSV导入数据的场合，推送处理终止
            if (runtime.executionContext == runtime.ContextType.CSV_IMPORT) return ;

            var prsLineCount = newRec.getLineCount({sublistId: "recmachcustrecord_prs_field"});
            // 不存在待推送数据的场合，结束处理
            if (!prsLineCount) return ;

            // 执行标志：默认值终止处理。当明细行【审批状态】存在等于"待提交（1）"或者 [是否推送已驳回数据 = true && "飞书审批驳回（5）]"或者"推送失败（11）"的场合，继续执行
            var exeFlag = false;
            // 是否推送已驳回数据
            var refuseFlag = newRec.getValue({fieldId: "custrecord_pr_refuse_flag"});
            for (var i = 0; i < prsLineCount; i++) {
                var approvalStatus = newRec.getSublistValue({sublistId: "recmachcustrecord_prs_field", fieldId: "custrecord_prs_line_status", line: i});
                if (approvalStatus == SWC_CONFIG_DATA.configData().WORKFLOW_STATUS_TO_BE_SUBMITTED
                    || (refuseFlag && approvalStatus == SWC_CONFIG_DATA.configData().WORKFLOW_STATUS_FS_APPROVAL_REJECT)
                    || approvalStatus == SWC_CONFIG_DATA.configData().WORKFLOW_STATUS_PUSH_FAILURE) {
                    // 当明细行【审批状态】存在等于"待提交（1）"或者[是否推送已驳回数据 = true && "飞书审批驳回（5）]或者"推送失败（11）"的场合，继续执行
                    exeFlag = true;
                    break;
                }
            }
            log.error("exeFlag：" + newRec.id,exeFlag);
            // 执行标志未false的场合，终止处理
            if (!exeFlag) return ;

            // 取得飞书供应商账单申请的字段映射字典数据
            var fsVBADictObj = SWC_FsPushApprovalCmn.getFsVendorBillApplyDict(SWC_CONFIG_DATA.configData().FS_APPROVAL_FIELD_MAPPING_PURCH_APPLY);

            // 推送处理（请求参数：表单，校验信息）分单据头和单据体数据，单据体数据根据分类单独推送，回写结果到单据行
            // 取得单据头数据（分组推送共通部分数据）{"formAry": [], "verifyInfo": ""} formAry：推送数据；verifyInfo： 校验信息
            var headerPushFormObj = getHeaderPushFormAry({newRec: newRec, fsVBADictObj: fsVBADictObj});

            // 取得单据体数据
            // {"预算归属部门_费用类型": {"formAry": "推送数据", "verifyInfo": "校验信息"}, ...}
            var bodyPushFormObj = getBodyPushFormAry({newRec: newRec, fsVBADictObj: fsVBADictObj, prsLineCount: prsLineCount});
            log.error("bodyPushFormObj：" + newRec.id, bodyPushFormObj)

            // 执行推送处理： {"预算归属部门_费用类型": {"msg": "", "instanceCode": ""}, ...}
            var pushFsApprovalResultObj = {};
            for (var key in bodyPushFormObj) {
                // 设置到共通方法中 请求参数：提交人
                // 需求者
                var buyer = newRec.getValue({fieldId: "custrecord_pr_buyer"});
                // 是否代提
                var withDraw = newRec.getValue({fieldId: "custrecord_pr_withdraw"});

                // 推送飞书审批实例：{"msg": "", "instanceCode": ""}
                var pushApprovalResult = SWC_FsPushApprovalCmn.pushFsApproval({
                    approvalCode: SWC_CONFIG_DATA.configData().FS_APPROVAL_TEMPLATE_PURCH_APPLY,
                    submitter: buyer,
                    withDraw: withDraw,
                    formAry: bodyPushFormObj[key]["formAry"].concat(headerPushFormObj["formAry"]), // 单据体 + 单据头推送表单数据
                    verifyInfo: bodyPushFormObj[key]["verifyInfo"] + headerPushFormObj["verifyInfo"]
                });

                pushFsApprovalResultObj[key] = pushApprovalResult;
            }
            log.error("pushFsApprovalResultObj：" + newRec.id, pushFsApprovalResultObj)

            // 记录推送结果
            // 根据货品行【预算归属部门】、【费用类型】回写【飞书审批推送结果】字段
            var purchReqRec = record.load({type: "customrecord_swc_purchase_request", id: newRec.id});
            // 【是否推送已驳回数据】
            var refuseFlag = purchReqRec.getValue({fieldId: "custrecord_pr_refuse_flag"});
            var prsLineCount = purchReqRec.getLineCount({sublistId: "recmachcustrecord_prs_field"});
            for (var i = 0; i < prsLineCount; i++) {
                var approvalStatus = purchReqRec.getSublistValue({sublistId: "recmachcustrecord_prs_field", fieldId: "custrecord_prs_line_status", line: i});
                // 待提交、飞书推送失败、推送已驳回数据&&当前状态为已驳回的场合，更新推送状态
                if (approvalStatus == SWC_CONFIG_DATA.configData().WORKFLOW_STATUS_TO_BE_SUBMITTED
                    || (refuseFlag && approvalStatus == SWC_CONFIG_DATA.configData().WORKFLOW_STATUS_FS_APPROVAL_REJECT)
                    || approvalStatus == SWC_CONFIG_DATA.configData().WORKFLOW_STATUS_PUSH_FAILURE) {
                    // 预算归属部门
                    var budgetDepartment = purchReqRec.getSublistValue({sublistId: "recmachcustrecord_prs_field", fieldId: "custrecord_prs_budget_department", line: i});
                    // 费用类型
                    var itemValue = purchReqRec.getSublistValue({sublistId: "recmachcustrecord_prs_field", fieldId: "custrecord_prs_item", line: i});
                    var lineKey = budgetDepartment + "_" + itemValue;
                    if (pushFsApprovalResultObj.hasOwnProperty(lineKey)) {
                        var instanceCode = pushFsApprovalResultObj[lineKey]["instanceCode"];
                        var msg = pushFsApprovalResultObj[lineKey]["msg"];
                        if (instanceCode) {
                            // 推送成功的场合，飞书审批中（3）
                            purchReqRec.setSublistValue({sublistId: "recmachcustrecord_prs_field", fieldId: "custrecord_prs_line_status", value: SWC_CONFIG_DATA.configData().WORKFLOW_STATUS_FS_APPROVAL, line: i});
                        } else {
                            // 实例编码为空的场合，推送失败，设置审批状态为推送失败
                            purchReqRec.setSublistValue({sublistId: "recmachcustrecord_prs_field", fieldId: "custrecord_prs_line_status", value: SWC_CONFIG_DATA.configData().WORKFLOW_STATUS_PUSH_FAILURE, line: i});
                        }
                        // 飞书审批推送结果
                        purchReqRec.setSublistValue({sublistId: "recmachcustrecord_prs_field", fieldId: "custrecord_prs_feishu_approval_push", value: msg, line: i});
                        // 飞书INSTANCE_CODE
                        purchReqRec.setSublistValue({sublistId: "recmachcustrecord_prs_field", fieldId: "custrecord_prs_instance_code", value: instanceCode, line: i});
                    }
                }
            }

            purchReqRec.save();

        }

        /**
         * 取得单据头数据（分组推送共通部分数据）
         * @param {Object} options
         * @param {Record} options.newRec 新纪录
         * @param {Object} options.fsVBADictObj 飞书供应商账单申请字典对象
         * @return {"formAry": [], "verifyInfo": ""} formAry：推送数据；verifyInfo： 校验信息
         */
        function getHeaderPushFormAry(options) {
            var newRec = options.newRec;
            // {"字段名称": {"id": "ID", "value": {"TEXT": "VALUE"}, ...}, ...}
            var fsVBADictObj = options.fsVBADictObj;

            // [{id: "", value: "", type: "", ...}, ...]
            // 推送参数
            var formAry = [];
            // 校验信息
            var verifyInfo = "";

            // 单据字段 => 飞书审批模板字段映射处理
            // 申请理由 => 正当理由
            var extraMemo = newRec.getValue({fieldId: "custrecord_pr_extramemo"});
            // 申请理由
            if (extraMemo) {
                formAry.push({
                    "id": "reason",
                    "type": "textarea",
                    "value": extraMemo
                });
            }
            // 附件
            // 根据采购申请内部ID检索文件
            var purchApplyFileAry = SWC_FsPushApprovalCmn.schPurchApplyFile(newRec.id);
            // {"verifyInfo": 错误信息, "fsFileUrlAry": 文件上传成功code}
            var fsUploadFileRs = SWC_FsPushApprovalCmn.fsUploadFile(purchApplyFileAry, "文件");
            verifyInfo += fsUploadFileRs.verifyInfo;
            var fsFileUrlAry = fsUploadFileRs.fsFileUrlAry;
            if (fsFileUrlAry && fsFileUrlAry.length) {
                formAry.push({
                    "id":"enclosure",
                    "type":"attachmentV2",
                    "value":fsFileUrlAry
                });
            }
            // 逻辑：当采购申请上单一供应商理由存在值的时候（空格不算），推送单一供应商理由（single_reason），是否为单一供应商（single_flag）。
            var singleRationale = newRec.getValue({fieldId: "custrecord_pr_ven_single_rationale"});
            singleRationale = singleRationale && singleRationale.trim();
            if (singleRationale) {
                // 单一供应商理由
                formAry.push({
                    "id": "single_reason",
                    "type": "textarea",
                    "value": singleRationale
                });
                // 是否为单一供应商（single_flag）
                // fsVBADictObj["Expense Type"]["value"][itemTypeTxt]
                var verifyInfoRs = SWC_FsPushApprovalCmn.verifyInfo({
                    fsVBADictObj: fsVBADictObj,
                    fieldName: "是否为单一供应商",
                    valTarget: SWC_CONFIG_DATA.configData().FS_CRT_APPROVAL_VALUE_TARGET_VALUE,
                    text: "yes"
                });
                if (verifyInfoRs.errInfo) {
                    verifyInfo += verifyInfoRs.errInfo;
                } else {
                    formAry.push({
                        "id": "single_flag",
                        "type": "radioV2",
                        "value": verifyInfoRs.value
                    });
                }
            }

            // 首选供应商：first_vendor
            var vendorFirst = newRec.getText({fieldId: "custrecord_pr_vendor_first"});
            if (vendorFirst) {
                formAry.push({
                    "id": "first_vendor",
                    "type": "input",
                    "value": vendorFirst
                });
            }

            // 首选供应商入选理由：first_vendor_reason
            var vendorMemo = newRec.getValue({fieldId: "custrecord_pr_vendor_memo"});
            if (vendorMemo) {
                formAry.push({
                    "id": "first_vendor_reason",
                    "type": "textarea",
                    "value": vendorMemo
                });
            }

            // 次选供应商：second_vendor
            var vendorSec = newRec.getValue({fieldId: "custrecord_pr_vendor_sec"});
            if (vendorSec) {
                formAry.push({
                    "id": "second_vendor",
                    "type": "input",
                    "value": vendorSec
                });
            }
            // 次选供应商入选理由：second_vendor_reason
            var vendorMemo2 = newRec.getValue({fieldId: "custrecord_pr_vendor_memo2"});
            if (vendorMemo2) {
                formAry.push({
                    "id": "second_vendor_reason",
                    "type": "textarea",
                    "value": vendorMemo2
                });
            }

            // 末选供应商：third_vendor
            var vendorThird = newRec.getValue({fieldId: "custrecord_pr_vendor_third"});
            if (vendorThird) {
                formAry.push({
                    "id": "third_vendor",
                    "type": "input",
                    "value": vendorThird
                });
            }

            // 末选供应商入选理由：third_vendor_reason
            var vendorMemo3 = newRec.getValue({fieldId: "custrecord_pr_vendor_memo3"});
            if (vendorMemo3) {
                formAry.push({
                    "id": "third_vendor_reason",
                    "type": "textarea",
                    "value": vendorMemo3
                });
            }

            return {formAry: formAry, verifyInfo: verifyInfo};
        }

        /**
         * 取得单据体数据：{"预算归属部门_费用类型": {"费用类别": "", "金额": "", "IT资产分类": ""}, ...}
         * @param {Object} options
         * @param {Record} options.newRec 新纪录
         * @param {Object} options.fsVBADictObj 飞书供应商账单申请字典对象
         * @param {number} options.prsLineCount 货品行数
         * @return {"预算归属部门_费用类型": {"formAry": "推送数据", "verifyInfo": "校验信息"}, ...}
         */
        function getBodyPushFormAry(options) {
            var newRec = options.newRec;
            // {"字段名称": {"id": "ID", "value": {"TEXT": "VALUE"}, ...}, ...}
            var fsVBADictObj = options.fsVBADictObj;
            var prsLineCount = options.prsLineCount;

            // 取得飞书映射归属部门
            var deptIdAry = [];
            for (var i = 0; i < prsLineCount; i++) {
                var deptId = newRec.getSublistValue({sublistId: "recmachcustrecord_prs_field", fieldId: "custrecord_prs_budget_department", line: i});
                // 去重
                if (deptIdAry.indexOf(deptId) == -1) {
                    deptIdAry.push(deptId);
                }
            }
            // 根据预算归属部门取得对应的飞书部门id:{"NS部门ID": "飞书OPENID(部门)", ...}
            var fsOpenIdObj = SWC_FsPushApprovalCmn.schFsOpenIdByDeptIdAry(deptIdAry);

            // 是否推送已驳回数据
            var refuseFlag = newRec.getValue({fieldId: "custrecord_pr_refuse_flag"});
            // {"预算归属部门_费用类型": {"formAry": "推送数据", "verifyInfo": "校验信息"}, ...}
            var itemObj = {};
            var exceptionFlag = false;
            for (var i = 0; i < prsLineCount; i++) {
                // 已经推送成功的货品，跳过处理
                var approvalStatus = newRec.getSublistValue({sublistId: "recmachcustrecord_prs_field", fieldId: "custrecord_prs_line_status", line: i});
                if (approvalStatus == SWC_CONFIG_DATA.configData().WORKFLOW_STATUS_FS_APPROVAL
                    || approvalStatus == SWC_CONFIG_DATA.configData().WORKFLOW_STATUS_FS_APPROVAL_FINISH
                    || approvalStatus == SWC_CONFIG_DATA.configData().WORKFLOW_STATUS_PURCH_ORD_CREATED
                    // （是否推送已驳回数据 = false && 已驳回）的场合，跳过处理
                    || (!refuseFlag && approvalStatus == SWC_CONFIG_DATA.configData().WORKFLOW_STATUS_FS_APPROVAL_REJECT)) continue;

                // [{id: "", value: "", type: "", ...}, ...]
                // 推送参数
                var formAry = [];
                // 校验信息
                var verifyInfo = "";

                // 预算归属部门
                var budgetDepartment = newRec.getSublistValue({sublistId: "recmachcustrecord_prs_field", fieldId: "custrecord_prs_budget_department", line: i});
                var fsOpenId = fsOpenIdObj[budgetDepartment];
                // 预算归属部门
                if (fsOpenId) {
                    formAry.push({
                        "id":"department",
                        "type":"department",
                        "value":[
                            {
                                "open_id": fsOpenId
                            }
                        ]
                    });
                }
                // 费用类型
                var itemTxt = newRec.getSublistText({sublistId: "recmachcustrecord_prs_field", fieldId: "custrecord_prs_item", line: i});
                var itemValue = newRec.getSublistValue({sublistId: "recmachcustrecord_prs_field", fieldId: "custrecord_prs_item", line: i});
                var itemLineKey = budgetDepartment + "_" + itemValue;
                log.error("itemLineKey", itemLineKey)
                // 默认没有出现错误
                var errFlag = false;
                // 货品
                if (itemTxt) {
                    // 费用类别
                    var itemTypeTxt = newRec.getSublistText({sublistId: "recmachcustrecord_prs_field", fieldId: "custrecord_prs_expense_type", line: i});
                    // fsVBADictObj[itemTypeTxt]["id"]
                    var verifyInfoIdRs = SWC_FsPushApprovalCmn.verifyInfo({
                        fsVBADictObj: fsVBADictObj,
                        fieldName: itemTypeTxt,
                        valTarget: SWC_CONFIG_DATA.configData().FS_CRT_APPROVAL_VALUE_TARGET_ID
                    });
                    if (verifyInfoIdRs.errInfo) {
                        verifyInfo += verifyInfoIdRs.errInfo;
                        // 出现错误
                        errFlag = true;
                    }
                    // fsVBADictObj[itemTypeTxt]["value"][itemTxt]
                    var verifyInfoValRs = SWC_FsPushApprovalCmn.verifyInfo({
                        fsVBADictObj: fsVBADictObj,
                        fieldName: itemTypeTxt,
                        valTarget: SWC_CONFIG_DATA.configData().FS_CRT_APPROVAL_VALUE_TARGET_VALUE,
                        text: itemTxt,
                        itemFlag: true
                    });
                    if (verifyInfoValRs.errInfo) {
                        verifyInfo += verifyInfoValRs.errInfo;
                        // 出现错误
                        errFlag = true;
                    }
                    log.error("货品错误信息", verifyInfo)
                    if (!errFlag) {
                        formAry.push({
                            "id": verifyInfoIdRs.value,
                            "type": "radioV2",
                            "value": verifyInfoValRs.value
                        });
                    }
                }

                // 当前行是最后一行 && 货品行存在错误信息，终止处理
                if (i == (prsLineCount - 1) && exceptionFlag) {
                    return itemObj;
                }

                // 预算归属部门对应的fsOpenId或者费用类型为空的场合，当前行结束推送处理
                log.error("!fsOpenId || errFlag 跳过处理", {"fsOpenId": fsOpenId, errFlag: errFlag});
                if (!fsOpenId || errFlag) {
                    exceptionFlag = true;
                    // 记录错误信息
                    if (!itemObj.hasOwnProperty(itemLineKey)) {
                        itemObj[itemLineKey] = {
                            formAry: formAry,
                            verifyInfo: verifyInfo
                        };
                    } else {
                        // 合并表单及错误信息
                        itemObj[itemLineKey]["formAry"] = itemObj[itemLineKey]["formAry"].concat(formAry);
                        itemObj[itemLineKey]["verifyInfo"] = itemObj[itemLineKey]["verifyInfo"] + verifyInfo;
                    }
                    continue;
                }

                // 金额（美金）
                var totalAmt = newRec.getSublistValue({sublistId: "recmachcustrecord_prs_field", fieldId: "custrecord_prs_totalamount", line: i});
                // 币种
                var curCurrency = newRec.getText({fieldId:"custrecord_pr_currency"});
                // 将币种金额转换成美元，保留4位小数
                var rate = currency.exchangeRate({
                    source: curCurrency,
                    target: 'USD'
                });
                var usdAmount = decimal.mulN(totalAmt, rate).toFixed(8);

                // 相同"预算归属部门(飞书部门ID)_费用类型"货品行累加金额
                // {"预算归属部门_费用类型": {"费用类别": "", "金额": "", "IT资产分类": ""}, ...}
                if (!itemObj.hasOwnProperty(itemLineKey)) {
                    // 费用类别
                    var itemTypeTxt = newRec.getSublistText({sublistId: "recmachcustrecord_prs_field", fieldId: "custrecord_prs_expense_type", line: i});
                    // 费用类别
                    if (itemTypeTxt) {
                        // fsVBADictObj["Expense Type"]["value"][itemTypeTxt]
                        var verifyInfoRs = SWC_FsPushApprovalCmn.verifyInfo({
                            fsVBADictObj: fsVBADictObj,
                            fieldName: "Expense Type",
                            valTarget: SWC_CONFIG_DATA.configData().FS_CRT_APPROVAL_VALUE_TARGET_VALUE,
                            text: itemTypeTxt
                        });
                        if (verifyInfoRs.errInfo) {
                            verifyInfo += verifyInfoRs.errInfo;
                        } else {
                            formAry.push({
                                "id": "item",
                                "type": "radioV2",
                                "value": verifyInfoRs.value
                            });
                        }
                    }

                    // IT资产分类
                    // 明细货品Expense Type为固定资产推送的场合，推送IT Assets Class资产分类
                    if (SWC_CONFIG_DATA.configData().EXPENSE_TYPE_FIXED_ASSETS == itemTypeTxt) {
                        var fsAssetClass = newRec.getSublistValue({sublistId: "recmachcustrecord_prs_field", fieldId: "custrecord_prs_feishu_assetit", line: i});
                        // fsVBADictObj["IT Assets Class"]["value"][fsAssetClass]
                        var verifyInfoValRs = SWC_FsPushApprovalCmn.verifyInfo({
                            fsVBADictObj: fsVBADictObj,
                            fieldName: "IT Assets Class",
                            valTarget: SWC_CONFIG_DATA.configData().FS_CRT_APPROVAL_VALUE_TARGET_VALUE,
                            text: fsAssetClass
                        });
                        if (verifyInfoValRs.errInfo) {
                            verifyInfo += verifyInfoValRs.errInfo;
                        } else {
                            formAry.push({
                                "id": "asset_type",
                                "type": "radioV2",
                                "value": verifyInfoValRs.value
                            });
                        }
                    }

                    // 金额（美金）
                    formAry.push({
                        "id": "amount", // 申请预算金额
                        "type": "amount",
                        "value": usdAmount,
                        "currency":"USD"
                    });

                    // 分组对象中不存在当前"预算归属部门(飞书部门ID)_费用类型"对应的货品明细，初始化表单参数
                    itemObj[itemLineKey] = {
                        formAry: formAry,
                        verifyInfo: verifyInfo
                    };
                } else {
                    // 存在的场合，累加金额
                    for (var j = 0; j < itemObj[itemLineKey]["formAry"].length; j++) {
                        // 取得id为金额的对象，累加金额
                        if (itemObj[itemLineKey]["formAry"][j]["id"] == "amount") {
                            itemObj[itemLineKey]["formAry"][j]["value"] = decimal.addN(itemObj[itemLineKey]["formAry"][j]["value"], usdAmount);
                            break;
                        }
                    }
                }

                // 项目
                var pro = newRec.getSublistText({sublistId: "recmachcustrecord_prs_field", fieldId: "custrecord_prs_pro", line: i});
                if (pro) {
                    formAry.push({
                        "id": "pro",
                        "type": "input",
                        "value": pro
                    });
                }

            }

            // 格式化金额（美金）保留两位小数：{"预算归属部门_费用类型": {"formAry": "推送数据", "verifyInfo": "校验信息"}, ...}
            for (var key in itemObj) {
                var formAryTmp = itemObj[key]["formAry"];
                for (var i = 0; i < formAryTmp.length; i++) {
                    if (formAryTmp[i]["id"] == "amount") {
                        formAryTmp[i]["value"] = Number(formAryTmp[i]["value"]).toFixed(2);
                    }
                }
            }

            return itemObj;
        }

        /**
         * 取得明细行提交状态
         * @param {number} prsLineCount 明细行条数
         * @param {Record} 采购申请记录
         * @return {boolean} true： 存在可提交数据，false：不存在可提交数据
         */
        function getItemLineSbtFlag(prsLineCount, prsRec) {
            // 明细行【审批状态】全部不为"待提交（1）" && 不为"飞书审批驳回（5）" && 不为"推送失败（11）"，不存在可提交数据
            var addFlag = false;
            for (var i = 0; i < prsLineCount; i++) {
                var approvalStatus = prsRec.getSublistValue({sublistId: "recmachcustrecord_prs_field", fieldId: "custrecord_prs_line_status", line: i});
                if (approvalStatus == SWC_CONFIG_DATA.configData().WORKFLOW_STATUS_TO_BE_SUBMITTED
                    || approvalStatus == SWC_CONFIG_DATA.configData().WORKFLOW_STATUS_FS_APPROVAL_REJECT
                    || approvalStatus == SWC_CONFIG_DATA.configData().WORKFLOW_STATUS_PUSH_FAILURE) {
                    // 当明细行【审批状态】存在等于"待提交（1）"或者"飞书审批驳回（5）"或者"推送失败（11）"的场合，存在可提交数据
                    addFlag = true;
                    break;
                }
            }

            return addFlag;
        }

        return {
            beforeLoad: beforeLoad,
            afterSubmit: afterSubmit
        };

    });
