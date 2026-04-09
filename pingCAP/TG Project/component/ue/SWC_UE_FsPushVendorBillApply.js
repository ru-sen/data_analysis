/**
 * @NApiVersion 2.0
 * @NScriptType UserEventScript
 * @NModuleScope Public
 * @author yltian
 * @description 供应商账单申请飞书审批推送
 */
define(["N/runtime", "N/search", "../../common/SWC_OMS_Utils", "N/file", 'N/record', 'N/currency',
        "../../common/SWC_FsPushApprovalCmn", "../../common/SWC_CONFIG_DATA", "../../lib/decimal", "N/format", "N/url"],

    function (runtime, search, SWCommons, file, record, currency, SWC_FsPushApprovalCmn,
              SWC_CONFIG_DATA, decimal, format, url) {

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
                    newRec = record.load({type: "customrecord_swc_account_payable", id: newRec.id});
                    // 非导入的场合，推送状态为待审批或飞书审批驳回的供应商账单申请单据
                    syncFsPushVendorApply({newRec: newRec});
                }
            } catch (e) {
                log.error("程序错误", e.message);
            }
        }

        /**
         * 非导入的场合，推送状态为待审批或飞书审批驳回的供应商账单申请单据
         * @param {Object} options
         * @param {Record} options.newRec 新记录
         */
        function syncFsPushVendorApply(options) {
            var newRec = options.newRec;

            // CSV导入数据的场合，推送处理终止
            if (runtime.executionContext == runtime.ContextType.CSV_IMPORT) return;

            var apsLineCount = newRec.getLineCount({sublistId: "recmachcustrecord_aps_field"});
            // log.error("apsLineCount", apsLineCount)
            // 不存在推送数据的场合，结束处理
            if (!apsLineCount) return ;

            // 单据状态不为"待审批（1）" && 不为“飞书推送失败：6”的场合，推送处理终止
            // 执行标志：默认终止处理。
            var exeFlag = false;
            for (var i = 0; i < apsLineCount; i++) {
                // 审批状态
                var approvalStatus = newRec.getSublistValue({sublistId: "recmachcustrecord_aps_field", fieldId: "custrecord_aps_line_status", line: i});
                if (approvalStatus == SWC_CONFIG_DATA.configData().BILL_APPROVAL_STATUS_PENDING_APPROVAL
                    // 已驳回数据不重新推送
                    // || approvalStatus == SWC_CONFIG_DATA.configData().BILL_APPROVAL_STATUS_FS_APPROVAL_REJECT
                    || approvalStatus == SWC_CONFIG_DATA.configData().BILL_APPROVAL_STATUS_FS_PUSH_FAILURE) {
                    // 当明细行【审批状态】存在等于“待审批（1）”或者“飞书推送失败：6”的场合，继续执行
                    exeFlag = true;
                    break;
                }
            }
            // log.error("!exeFlag", !exeFlag)
            // 执行标志未false的场合，终止处理
            if (!exeFlag) return ;

            // 取得飞书供应商账单申请的字段映射字典数据
            var fsVBADictObj = SWC_FsPushApprovalCmn.getFsVendorBillApplyDict(SWC_CONFIG_DATA.configData().FS_APPROVAL_FIELD_MAPPING_VENDOR_ACCT_APPLY);
            // 推送处理
            // 推送处理（请求参数：表单，校验信息）分单据头和单据体数据，单据体数据根据分类单独推送，回写结果到单据行
            // 取得单据头数据（分组推送共通部分数据）{"formAry": [], "verifyInfo": ""} formAry：推送数据；verifyInfo： 校验信息
            var headerPushFormObj = getHeaderPushFormAry({newRec: newRec, fsVBADictObj: fsVBADictObj});
            log.error("共通表单参数", headerPushFormObj);

            // 取得单据体数据
            // {"预算归属部门_费用类型": {"formAry": "推送数据", "verifyInfo": "校验信息"}, ...}
            var bodyPushFormObj = getBodyPushFormAry({newRec: newRec, fsVBADictObj: fsVBADictObj, prsLineCount: apsLineCount});
            log.error("明细行分组参数", bodyPushFormObj)

            // 执行推送处理： {"预算归属部门_费用类型": {"msg": "", "instanceCode": ""}, ...}
            var pushFsApprovalResultObj = {};
            for (var key in bodyPushFormObj) {
                // 设置到共通方法中 请求参数：提交人
                // 请求参数：提交人
                var employee = newRec.getValue({fieldId: "custrecord_ap_employee"});
                var withDraw = newRec.getValue({fieldId: "custrecord_ap_withdraw"});

                // 推送飞书审批实例：{"msg": "", "instanceCode": ""}
                var pushApprovalResult = SWC_FsPushApprovalCmn.pushFsApproval({
                    approvalCode: SWC_CONFIG_DATA.configData().FS_APPROVAL_TEMPLATE_VENDOR_ACCT_APPLY,
                    submitter: employee,
                    withDraw: withDraw,
                    formAry: bodyPushFormObj[key]["formAry"].concat(headerPushFormObj["formAry"]), // 单据体 + 单据头推送表单数据
                    verifyInfo: bodyPushFormObj[key]["verifyInfo"] + headerPushFormObj["verifyInfo"]
                });

                pushFsApprovalResultObj[key] = pushApprovalResult;
            }
            log.error("推送处理结果", pushFsApprovalResultObj)

            // 记录推送结果
            // 加载供应商账单申请
            var vendorBillApplyRec = record.load({type: "customrecord_swc_account_payable", id: newRec.id});
            var apsLineCount = vendorBillApplyRec.getLineCount({sublistId: "recmachcustrecord_aps_field"});
            for (var i = 0; i < apsLineCount; i++) {
                // 只推送待审批、推送失败的明细，以外的场合，不执行推送，不更新推送状态
                var lineStatus = vendorBillApplyRec.getSublistValue({sublistId: "recmachcustrecord_aps_field", fieldId: "custrecord_aps_line_status", line: i});
                if (lineStatus != SWC_CONFIG_DATA.configData().BILL_APPROVAL_STATUS_PENDING_APPROVAL
                    && lineStatus != SWC_CONFIG_DATA.configData().BILL_APPROVAL_STATUS_FS_PUSH_FAILURE) {
                    continue;
                }

                // 预算归属部门
                var budgetDepartment = vendorBillApplyRec.getSublistValue({sublistId: "recmachcustrecord_aps_field", fieldId: "custrecord_aps_department", line: i});
                // 费用类型
                var itemValue = vendorBillApplyRec.getSublistValue({sublistId: "recmachcustrecord_aps_field", fieldId: "custrecord_aps_item", line: i});

                var lineKey = budgetDepartment + "_" + itemValue;
                if (pushFsApprovalResultObj.hasOwnProperty(lineKey)) {
                    var instanceCode = pushFsApprovalResultObj[lineKey]["instanceCode"];
                    var msg = pushFsApprovalResultObj[lineKey]["msg"];
                    if (instanceCode) {
                        // 推送成功的场合，状态（飞书审批中：2）
                        vendorBillApplyRec.setSublistValue({sublistId: "recmachcustrecord_aps_field", fieldId: "custrecord_aps_line_status", value: SWC_CONFIG_DATA.configData().BILL_APPROVAL_STATUS_FS_APPROVAL, line: i});
                    } else {
                        // 实例编码为空的场合，推送失败，状态（飞书推送失败：6）
                        vendorBillApplyRec.setSublistValue({sublistId: "recmachcustrecord_aps_field", fieldId: "custrecord_aps_line_status", value: SWC_CONFIG_DATA.configData().BILL_APPROVAL_STATUS_FS_PUSH_FAILURE, line: i});
                    }
                    // 飞书审批推送结果
                    vendorBillApplyRec.setSublistValue({sublistId: "recmachcustrecord_aps_field", fieldId: "custrecord_aps_code", value: msg, line: i});
                    // 飞书INSTANCE_CODE
                    vendorBillApplyRec.setSublistValue({sublistId: "recmachcustrecord_aps_field", fieldId: "custrecord_aps_instance_code", value: instanceCode, line: i});
                }
            }

            vendorBillApplyRec.save();
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

            // 关联境外采购申请单
            var parNum = newRec.getValue({fieldId: "custrecord_ap_prnum"});

            // 事由描述
            var reason = newRec.getValue({fieldId: "custrecord_ap_reason_description"});
            // 事由描述
            if (reason) {
                formAry.push({
                    "id": "reason",
                    "type": "textarea",
                    "value": reason
                });
            }

            // 合同或报价单附件（【采购订单】.采购合同文件）
            // 取得采购订单单号
            var purchOrdIntlId = newRec.getValue({fieldId: "custrecord_ap_number"});
            if (purchOrdIntlId) {
                // 采购订单存在的场合，取得采购合同文件
                 var fileIdAry = SWC_FsPushApprovalCmn.schPurchRelatedFile(purchOrdIntlId);
                var otherSupportdocId = newRec.getValue({fieldId: "custrecord_ap_other_supportdoc"});
                if(otherSupportdocId)fileIdAry.push(otherSupportdocId);
                var fsUploadFileRs = SWC_FsPushApprovalCmn.fsUploadFile(fileIdAry, "采购合同文件");
                var fsFileUrlAry = fsUploadFileRs.fsFileUrlAry;
                log.error("fsFileUrlAry",fsFileUrlAry);
                verifyInfo += fsUploadFileRs.verifyInfo;
                if (fsFileUrlAry && fsFileUrlAry.length) {
                    formAry.push({
                        "id": "enclosure",
                        "type": "attachmentV2",
                        "value": fsFileUrlAry
                    });
                }

                // 根据采购订单单号取得URL
                var scheme = 'https://';
                var host = url.resolveDomain({
                    hostType: url.HostType.APPLICATION
                });
                var poLinkUri = url.resolveRecord({
                    recordType: record.Type.PURCHASE_ORDER,
                    recordId: purchOrdIntlId,
                    isEditMode: false
                });
                var poLinkUrl = scheme + host + poLinkUri;
                formAry.push({
                    "id": "po_link",
                    "type": "textarea",
                    "value": poLinkUrl
                });
            }

            // 付款方式
            var paymentMethod = newRec.getValue({fieldId: "custrecord_ap_payment_method"});
            if (paymentMethod) {
                // fsVBADictObj["付款方式"]["value"][paymentMethod]
                var verifyInfoRs = SWC_FsPushApprovalCmn.verifyInfo({
                    fsVBADictObj: fsVBADictObj,
                    fieldName: "付款方式",
                    valTarget: SWC_CONFIG_DATA.configData().FS_CRT_APPROVAL_VALUE_TARGET_VALUE,
                    text: paymentMethod
                });

                if (verifyInfoRs.errInfo) {
                    verifyInfo += verifyInfoRs.errInfo;
                } else {
                    formAry.push({
                        "id": "payway",
                        "type": "radioV2",
                        "value": verifyInfoRs.value
                    });
                }
            }

            // 付款周期
            var paymentPeriod = newRec.getValue({fieldId: "custrecord_ap_payment_period"});
            if (paymentPeriod) {
                // fsVBADictObj["付款周期"]["value"][paymentPeriod]
                var verifyInfoRs = SWC_FsPushApprovalCmn.verifyInfo({
                    fsVBADictObj: fsVBADictObj,
                    fieldName: "付款周期",
                    valTarget: SWC_CONFIG_DATA.configData().FS_CRT_APPROVAL_VALUE_TARGET_VALUE,
                    text: paymentPeriod
                });
                if (verifyInfoRs.errInfo) {
                    verifyInfo += verifyInfoRs.errInfo;
                } else {
                    formAry.push({
                        "id": "payterm",
                        "type": "radioV2",
                        "value": verifyInfoRs.value
                    });
                }
            }

            // 付款主体
            var subsidaryId = newRec.getValue({fieldId: "custrecord_ap_subsidary"});
            if (subsidaryId) {
                // fsVBADictObj["付款主体"]["value"][subsidary]
                var verifyInfoRs = SWC_FsPushApprovalCmn.verifyInfo({
                    fsVBADictObj: fsVBADictObj,
                    fieldName: "付款主体",
                    valTarget: SWC_CONFIG_DATA.configData().FS_CRT_APPROVAL_VALUE_TARGET_VALUE,
                    text: subsidaryId
                });
                if (verifyInfoRs.errInfo) {
                    verifyInfo += verifyInfoRs.errInfo;
                } else {
                    formAry.push({
                        "id": "paycompany",
                        "type": "radioV2",
                        "value": verifyInfoRs.value
                    });
                }
            }

            // 供应商名称
            var vendorName = newRec.getValue({fieldId: "custrecord_ap_vendorname"});
            if (vendorName) {
                var vendorObj = search.lookupFields({type: "vendor", id: vendorName, columns: ["companyname"]});
                if (vendorObj && vendorObj.companyname) {
                    formAry.push({
                        "id": "vendorname",
                        "type": "input",
                        "value": vendorObj.companyname
                    });
                }
            }

            // 币种
            var currencyId = newRec.getValue({fieldId: "custrecord_ap_currency"});
            if (currencyId) {
                var currencyObj = search.lookupFields({type: "currency", id: currencyId, columns: ["name"]});
                var currencyName = currencyObj.name;
                if (currencyName) {
                    // fsVBADictObj["币种"]["value"][currency]
                    var verifyInfoRs = SWC_FsPushApprovalCmn.verifyInfo({
                        fsVBADictObj: fsVBADictObj,
                        fieldName: "币种",
                        valTarget: SWC_CONFIG_DATA.configData().FS_CRT_APPROVAL_VALUE_TARGET_VALUE,
                        text: currencyName
                    });
                    if (verifyInfoRs.errInfo) {
                        verifyInfo += verifyInfoRs.errInfo;
                    } else {
                        formAry.push({
                            "id": "currency",
                            "type": "radioV2",
                            "value": verifyInfoRs.value
                        });
                    }
                }
            }

            // 付款金额
            // var payAmount = newRec.getValue({fieldId: "custrecord_ap_payamount"});
            // if (payAmount != null && typeof(payAmount) != "undefined") {
            //     formAry.push({
            //         "id": "amount",
            //         "type": "number",
            //         "value": Number(payAmount)
            //     });
            // }

            // Vendor Bank Name
            var vendorBankName = newRec.getValue({fieldId: "custrecord_ap_vendor_bankname"});
            if (vendorBankName) {
                formAry.push({
                    "id": "vendorbankname",
                    "type": "input",
                    "value": vendorBankName
                });
            }

            // Vendor Bank Account No.
            var vendorBankAcctNo = newRec.getValue({fieldId: "custrecord_ap_vendor_bank_accountno"});
            if (vendorBankAcctNo) {
                formAry.push({
                    "id": "vendorbankaccountno",
                    "type": "input",
                    "value": vendorBankAcctNo
                });
            }

            // Vendor Bank City or State
            var vendorBankCityState = newRec.getValue({fieldId: "custrecord_ap_vendorbank_citystate"});
            if (vendorBankCityState) {
                formAry.push({
                    "id": "city",
                    "type": "input",
                    "value": vendorBankCityState
                });
            }

            // SWIFT CODE
            var swiftCode = newRec.getValue({fieldId: "custrecord_ap_swiftcode"});
            if (swiftCode) {
                formAry.push({
                    "id": "swiftcode",
                    "type": "input",
                    "value": swiftCode
                });
            }

            // Routing & Transit no.
            var routingTransitNo = newRec.getValue({fieldId: "custrecord_ap_routing_transitno"});
            if (routingTransitNo != null && typeof(routingTransitNo) != "undefined") {
                formAry.push({
                    "id": "routing",
                    "type": "input",
                    "value": routingTransitNo
                });
            }

            // invoice编号
            var invoiceNo = newRec.getValue({fieldId: "custrecord_ap_invoiceno"});
            if (invoiceNo) {
                formAry.push({
                    "id": "invoiceno",
                    "type": "input",
                    "value": invoiceNo
                });
            }

            // 收款人全名
            var fullName = newRec.getValue({fieldId: "custrecord_ap_fullname"});
            if (fullName) {
                formAry.push({
                    "id": "payeename",
                    "type": "input",
                    "value": fullName
                });
            }

            // 收款人收件地址
            var address = newRec.getValue({fieldId: "custrecord_ap_address"});
            if (address) {
                formAry.push({
                    "id": "payeeaddr",
                    "type": "input",
                    "value": address
                });
            }

            // 收款人联系电话
            var phone = newRec.getValue({fieldId: "custrecord_ap_phone"});
            if (phone) {
                formAry.push({
                    "id": "payeephone",
                    "type": "input",
                    "value": phone
                });
            }

            // 收款人邮箱
            var payeeEmail = newRec.getValue({fieldId: "custrecord_ap_address_payee"});
            if (payeeEmail) {
                formAry.push({
                    "id": "payeeemail",
                    "type": "input",
                    "value": payeeEmail
                });
            }

            //20240808修改 start
            //飞书文件URL-发票
            var invoiceFsFileUrlAry = [];
            // 发票附件
            var invoiceAttachmentId = newRec.getValue({fieldId: "custrecord_ap_invoice_attachment"});
            if (invoiceAttachmentId) {
                // {"verifyInfo": 错误信息, "fsFileUrlAry": 文件上传成功code}
                var fsUploadFileRs = SWC_FsPushApprovalCmn.fsUploadFile([invoiceAttachmentId], "发票附件");
                verifyInfo += fsUploadFileRs.verifyInfo;
                invoiceFsFileUrlAry = invoiceFsFileUrlAry.concat(fsUploadFileRs.fsFileUrlAry);
            }
            if (invoiceFsFileUrlAry && invoiceFsFileUrlAry.length) {
                log.error("verifyInfo", verifyInfo)
                log.error("invoiceFsFileUrlAry", invoiceFsFileUrlAry)
                formAry.push({
                    "id":"invoiceattachment",
                    "type":"attachmentV2",
                    "value": invoiceFsFileUrlAry
                });
            }

            // 发票附件2
            var invoiceFsFileUrlAry2 = [];
            var invoiceAttachmentId2 = newRec.getValue({fieldId: "custrecord_ap_invoice_attachment2"});
            if (invoiceAttachmentId2) {
                // {"verifyInfo": 错误信息, "fsFileUrlAry": 文件上传成功code}
                var fsUploadFileRs = SWC_FsPushApprovalCmn.fsUploadFile([invoiceAttachmentId2], "发票附件2");
                verifyInfo += fsUploadFileRs.verifyInfo;
                invoiceFsFileUrlAry2 = invoiceFsFileUrlAry2.concat(fsUploadFileRs.fsFileUrlAry);
            }
            if (invoiceFsFileUrlAry2 && invoiceFsFileUrlAry2.length) {
                log.error("verifyInfo", verifyInfo)
                log.error("invoiceFsFileUrlAry2", invoiceFsFileUrlAry2)
                formAry.push({
                    "id":"invoiceattachment2",
                    "type":"attachmentV2",
                    "value": invoiceFsFileUrlAry2
                });
            }
            // 发票附件3
            var invoiceFsFileUrlAry3 = [];
            var invoiceAttachmentId3 = newRec.getValue({fieldId: "custrecord_ap_invoice_attachment3"});
            if (invoiceAttachmentId3) {
                // {"verifyInfo": 错误信息, "fsFileUrlAry": 文件上传成功code}
                var fsUploadFileRs = SWC_FsPushApprovalCmn.fsUploadFile([invoiceAttachmentId3], "发票附件3");
                verifyInfo += fsUploadFileRs.verifyInfo;
                invoiceFsFileUrlAry3 = invoiceFsFileUrlAry3.concat(fsUploadFileRs.fsFileUrlAry);
            }
            if (invoiceFsFileUrlAry3 && invoiceFsFileUrlAry3.length) {
                log.error("verifyInfo", verifyInfo)
                log.error("invoiceFsFileUrlAry3", invoiceFsFileUrlAry3)
                formAry.push({
                    "id":"invoiceattachment3",
                    "type":"attachmentV2",
                    "value": invoiceFsFileUrlAry3
                });
            }

            //20240808修改 end

            // 超申请理由
            var overReason = newRec.getValue({fieldId: "custrecord_ap_over_reason"});
            if (overReason) {
                formAry.push({
                    "id": "amount_reason",
                    "type": "textarea",
                    "value": overReason
                });
            }

            // 当超申请理由不为空的场合，超申请判断（apply_judgment）设置为是，以外的场合设置为否
            var applyJudgment = false; // 默认值为"否"
            if (overReason && overReason.trim()) {
                applyJudgment = true;
            }
            formAry.push({
                "id":"apply_judgment",
                "type":"radioV2",
                "value": applyJudgment ? "lgxpwgcw-5wnj1k6bj7-0" : "lgxpwgeb-1rd7y1ufupt-1"
            });

            // 关联境外采购申请单
            // 取得关联境外采购申请单飞书审批ID
            var purchReqRec;
            var feInstanceCode; // 飞书INSTANCE_CODE
            if (parNum) {
                purchReqRec = record.load({type: "customrecord_swc_purchase_request", id: parNum});
                // 飞书INSTANCE_CODE
                feInstanceCode = purchReqRec.getValue({fieldId: "custrecord_pr_instance_code"});
            }
            if (feInstanceCode) {
                formAry.push({
                    "id":"prurl",
                    "type":"connect",
                    "value": [feInstanceCode]
                });
            }

            // 期望付款时间
            var expectedPaytime = newRec.getValue({fieldId: "custrecord_ap_expected_paytime"});
            if (expectedPaytime) {
                // 日期转化为 => RFC3339 格式日期字符串（"2019-10-01T08:12:01+08:00"）
                var payDate = format.parse({value: expectedPaytime, type: format.Type.DATE});
                var payDateStr = payDate.getFullYear() + "-" + fillZero(payDate.getMonth() + 1) + "-" + fillZero(payDate.getDate()) + "T00:00:00+08:00";
                formAry.push({
                    "id": "paydate",
                    "type": "date",
                    "value": payDateStr
                });
            }

            // 采购订单金额：采购订单号为空的场合，默认值0；以外的场合，根据采购订单号检索采购订单，计算采购订单总金额
            var amtForCurrNum = SWC_FsPushApprovalCmn.getPOAmtForCurr(purchOrdIntlId);
            formAry.push({
                "id": "po_amount",
                "type": "number",
                "value": amtForCurrNum
            });

            // 已付款金额：采购订单号为空的场合，默认值0；以外的场合，根据采购订单号检索账单，计算账单明细行金额（外币）
            var paidAmt = SWC_FsPushApprovalCmn.getPoBillAmtForCurr(purchOrdIntlId);
            formAry.push({
                "id": "po_payamount",
                "type": "number",
                "value": paidAmt
            });

            // 采购订单未付金额：采购订单金额 - 采购订单已付款金额
            formAry.push({
                "id": "po_unpayamount",
                "type": "number",
                "value": decimal.subN(amtForCurrNum, paidAmt)
            });

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
            // 货品内部ID
            var itemIdAry = [];
            // 货品类型内部ID
            var itemTypeIdAry = [];
            for (var i = 0; i < prsLineCount; i++) {
                var deptId = newRec.getSublistValue({sublistId: "recmachcustrecord_aps_field", fieldId: "custrecord_aps_department", line: i});
                var itemId = newRec.getSublistValue({sublistId: "recmachcustrecord_aps_field", fieldId: "custrecord_aps_item", line: i});
                var itemTypeId = newRec.getSublistValue({sublistId: "recmachcustrecord_aps_field", fieldId: "custrecord_aps_catagorytype", line: i});
                // 去重
                if (deptIdAry.indexOf(deptId) == -1) {
                    deptIdAry.push(deptId);
                }
                if (itemIdAry.indexOf(itemId) == -1) {
                    itemIdAry.push(itemId);
                }
                if (itemTypeIdAry.indexOf(itemTypeId) == -1) {
                    itemTypeIdAry.push(itemTypeId)
                }
            }
            // 根据预算归属部门取得对应的飞书部门id:{"NS部门ID": "飞书OPENID(部门)", ...}
            var fsOpenIdObj = SWC_FsPushApprovalCmn.schFsOpenIdByDeptIdAry(deptIdAry);
            // 根据货品内部ID检索名称
            var itemMappingObj = SWC_FsPushApprovalCmn.schAllItem(itemIdAry);
            // 根据货品类型内部ID检索货品类型
            var itemTypeObj = SWC_FsPushApprovalCmn.schAllItemType(itemTypeIdAry);
            // 项目（日记账）
            var projectJournalObj = SWC_FsPushApprovalCmn.schProjectJournal();

            // {"预算归属部门_费用类型": {"formAry": "推送数据", "verifyInfo": "校验信息"}, ...}
            var itemObj = {};
            var exceptionFlag = false;

            for (var i = 0; i < prsLineCount; i++) {
                // 已经推送成功的货品，跳过处理（账单审批状态_：2、账单审批状态_飞书审批完成：3、账单审批状态_账单已创建：5）
                // 审批状态
                var approvalStatus = newRec.getSublistValue({sublistId: "recmachcustrecord_aps_field", fieldId: "custrecord_aps_line_status", line: i});
                if (approvalStatus == SWC_CONFIG_DATA.configData().BILL_APPROVAL_STATUS_FS_APPROVAL
                    || approvalStatus == SWC_CONFIG_DATA.configData().BILL_APPROVAL_STATUS_FS_APPROVAL_FINISH
                    || approvalStatus == SWC_CONFIG_DATA.configData().BILL_APPROVAL_STATUS_BILL_CREATED
                    || approvalStatus == SWC_CONFIG_DATA.configData().BILL_APPROVAL_STATUS_FS_APPROVAL_REJECT) {
                    continue;
                }

                // [{id: "", value: "", type: "", ...}, ...]
                // 推送参数
                var formAry = [];
                // 校验信息
                var verifyInfo = "";

                // 预算归属部门
                var budgetDepartment = newRec.getSublistValue({sublistId: "recmachcustrecord_aps_field", fieldId: "custrecord_aps_department", line: i});
                var fsOpenId = fsOpenIdObj[budgetDepartment];
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
                var itemId = newRec.getSublistValue({sublistId: "recmachcustrecord_aps_field", fieldId: "custrecord_aps_item", line: i});
                var itemValue = newRec.getSublistValue({sublistId: "recmachcustrecord_aps_field", fieldId: "custrecord_aps_item", line: i});
                var itemLineKey = budgetDepartment + "_" + itemValue;
                // 默认没有出现错误
                var errFlag = false;
                // 货品
                if (itemId) {
                    // 费用类别
                    var itemTypeId = newRec.getSublistValue({sublistId: "recmachcustrecord_aps_field", fieldId: "custrecord_aps_catagorytype", line: i});
                    // fsVBADictObj[itemTypeTxt]["id"]
                    log.error('itemTypeObj[itemTypeId]', itemTypeObj[itemTypeId])
                    log.error('fsVBADictObj', fsVBADictObj['6900 Other Expenses'])
                    /*for(key in fsVBADictObj) {
                        log.error('fsVBADictObj=>' + key, fsVBADictObj[key])
                    }*/
                    var verifyInfoIdRs = SWC_FsPushApprovalCmn.verifyInfo({
                        fsVBADictObj: fsVBADictObj,
                        fieldName: itemTypeObj[itemTypeId],
                        valTarget: SWC_CONFIG_DATA.configData().FS_CRT_APPROVAL_VALUE_TARGET_ID
                    });
                    if (verifyInfoIdRs.errInfo) {
                        verifyInfo += verifyInfoIdRs.errInfo;
                        // 出现错误
                        errFlag = true;
                    }
                    // fsVBADictObj[itemTypeTxt]["value"][itemTxt]
                    log.error('jw-673', itemTypeId + '|' + itemTypeObj[itemTypeId] + '|' + itemId + '|' + itemMappingObj[itemId])
                    var verifyInfoValRs = SWC_FsPushApprovalCmn.verifyInfo({
                        fsVBADictObj: fsVBADictObj,
                        fieldName: itemTypeObj[itemTypeId],
                        valTarget: SWC_CONFIG_DATA.configData().FS_CRT_APPROVAL_VALUE_TARGET_VALUE,
                        text: itemMappingObj[itemId],
                        itemFlag: true
                    });
                    log.error('verifyInfoValRs', verifyInfoValRs)
                    if (verifyInfoValRs.errInfo) {
                        verifyInfo += verifyInfoValRs.errInfo;
                        // 出现错误
                        errFlag = true;
                    }
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

                // 金额
                var totalAmt = newRec.getSublistValue({sublistId: "recmachcustrecord_aps_field", fieldId: "custrecord_aps_totalamount", line: i});

                // 相同"预算归属部门(飞书部门ID)_费用类型"货品行累加金额
                // {"预算归属部门_费用类型": {"费用类别": "", "金额": "", "IT资产分类": ""}, ...}
                if (!itemObj.hasOwnProperty(itemLineKey)) {
                    // 费用类别
                    var itemTypeId = newRec.getSublistValue({sublistId: "recmachcustrecord_aps_field", fieldId: "custrecord_aps_catagorytype", line: i});
                    // 费用类别
                    if (itemTypeId) {
                        // fsVBADictObj["Expense Type"]["value"][itemTypeTxt]
                        var verifyInfoRs = SWC_FsPushApprovalCmn.verifyInfo({
                            fsVBADictObj: fsVBADictObj,
                            fieldName: "Expense Type",
                            valTarget: SWC_CONFIG_DATA.configData().FS_CRT_APPROVAL_VALUE_TARGET_VALUE,
                            text: itemTypeObj[itemTypeId]
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

                    // 金额
                    formAry.push({
                        "id": "amount",
                        "type": "number",
                        "value": Number(totalAmt)
                    });

                    // 项目
                    var pro = newRec.getSublistValue({sublistId: "recmachcustrecord_aps_field", fieldId: "custrecord_aps_pro", line: i});
                    if (pro) {
                        formAry.push({
                            "id": "pro",
                            "type": "input",
                            "value": projectJournalObj[pro]
                        });
                    }

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
                            itemObj[itemLineKey]["formAry"][j]["value"] = decimal.addN(itemObj[itemLineKey]["formAry"][j]["value"], totalAmt);
                            break;
                        }
                    }
                }
            }

            return itemObj;
        }

        /**
         * 数字补0：1 => 01
         * @param {number} num 待补0数字
         */
        function fillZero(num) {
            // 判断 小于10 为true
            if (num < 10) {
                // + 号 ，两边数值有一个是字符串 就是拼接
                // 小于 拼接 再赋值给num
                num = '0' + num;
            }

            return num;
        }

        return {
            afterSubmit: afterSubmit
        };


    });
