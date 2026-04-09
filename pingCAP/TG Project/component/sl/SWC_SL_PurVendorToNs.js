/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @NModuleScope Public
 */
define(["N/runtime","N/task","N/record","N/format","N/search","N/url","../../common/SWC_CONFIG_DATA"],
    function(runtime,task,record,format,search,url,SWC_CONFIG_DATA)
    {

        /**
         * Salesforce
         *  采购申请/供应商付款申请推送到飞书改成推送到NS，推送的时候生成两个审批表功能（由于在UE脚本生成单据代码不会执行工作流 所以将此块代码拿到当前SL里编写）
         * @param {Object} context
         * @param {ServerRequest} context.request - Encapsulation of the incoming request
         * @param {ServerResponse} context.response - Encapsulation of the Suitelet response
         * @Since 2015.2
         */
        function onRequest(context) {
            var options = JSON.parse(context.request.parameters.obj);
            var info = options.info;
            log.audit("parameters-options",options);
            log.audit("info",info);
            var auditId = "";//审批单据ID
            try {
                //创建采购申请审批
                if(options.approvalCode == "FB6D2FA3-B5C3-4239-BB73-C413F23555A8"){
                    var prWfRec = record.create({type:"customrecord_swc_pr_wf",isDynamic:true});//创建采购申请审批单据
                    if(info["department"])prWfRec.setValue({fieldId:"custrecord_prwf_budget_department",value:info["department"]});//预算归属部门
                    if(info["item"])prWfRec.setValue({fieldId:"custrecord_prwf_item",value:info["item"]});//费用类型
                    if(info["expensetype"])prWfRec.setValue({fieldId:"custrecord_prwf_expense_type",value:info["expensetype"]});//费用类别
                    if(info["totalamount"])prWfRec.setValue({fieldId:"custrecord_prwf_totalamount",value:info["totalamount"]});//金额(原币)
                    if(info["assetit"])prWfRec.setValue({fieldId:"custrecord_prwf_assetit",value:info["assetit"]});//IT 资产分类
                    if(info["empId"])prWfRec.setValue({fieldId:"custrecord_prwf_buyer",value:info["empId"]});//提交人
                    if(info["prspro"])prWfRec.setValue({fieldId:"custrecord_prwf_pro",value:info["prspro"]});//项目
                    prWfRec.setValue({fieldId:"custrecord_prwf_status",value:SWC_CONFIG_DATA.configData().WORKFLOW_STATUS_FS_APPROVAL});//审批中

                    if(info["custrecord_pr_extramemo"])prWfRec.setValue({fieldId:"custrecord_prwf_extramemo",value:info["custrecord_pr_extramemo"]});//申请理由
                    if(info["custrecord_pr_ven_single_rationale"])prWfRec.setValue({fieldId:"custrecord_prwf_ven_single_rationale",value:info["custrecord_pr_ven_single_rationale"]});//单一供应商理由
                    if(info["custrecord_pr_vendor_first"])prWfRec.setValue({fieldId:"custrecord_prwf_vendor_first",value:info["custrecord_pr_vendor_first"]});//首选供应商
                    if(info["custrecord_pr_vendor_sec"])prWfRec.setValue({fieldId:"custrecord_prwf_vendor_sec",value:info["custrecord_pr_vendor_sec"]});//次选供应商
                    if(info["custrecord_pr_vendor_third"])prWfRec.setValue({fieldId:"custrecord_prwf_vendor_third",value:info["custrecord_pr_vendor_third"]});//末选供应商
                    if(info["custrecord_pr_vendor_memo"])prWfRec.setValue({fieldId:"custrecord_prwf_vendor_memo",value:info["custrecord_pr_vendor_memo"]});//首选供应商入选理由，供应商报价
                    if(info["custrecord_pr_vendor_memo2"])prWfRec.setValue({fieldId:"custrecord_prwf_vendor_memo2",value:info["custrecord_pr_vendor_memo2"]});//次选供应商入选理由，供应商报价
                    if(info["custrecord_pr_vendor_memo3"])prWfRec.setValue({fieldId:"custrecord_prwf_vendor_memo3",value:info["custrecord_pr_vendor_memo3"]});//末选供应商入选理由，供应商报价
                    if(info["custrecord_prwf_onlyflag"])prWfRec.setValue({fieldId:"custrecord_prwf_onlyflag",value:info["custrecord_prwf_onlyflag"]});//是否单一供应商
                    if(info["custrecord_prwf_amount_usd"])prWfRec.setValue({fieldId:"custrecord_prwf_amount_usd",value:info["custrecord_prwf_amount_usd"]})//金额(USD)

                    auditId = prWfRec.save();
                }
                //创建供应商账单申请审批
                if(options.approvalCode == "7475FE86-9720-466A-AE43-F0F79E554AA6"){
                    var outputUrl = "";
                    log.audit("采购订单单号info[purchOrdIntlId]", info["purchOrdIntlId"]);
                    //如果供应商账单申请下的【采购订单单号】存在，则根据此采购订单查询【采购申请子表】的【采购订单单号】字段，如果有匹配的采购订单单号，则取此【采购申请】URL链接
                    if(info["purchOrdIntlId"]){
                        var poRequestId = sechPoRequestId(info["purchOrdIntlId"]);
                        log.audit("poRequestId",poRequestId);
                        if(poRequestId){
                            var scheme = 'https://';
                            var host = url.resolveDomain({hostType: url.HostType.APPLICATION});
                            var relativePath = url.resolveRecord({
                                recordType: 'customrecord_swc_purchase_request',
                                recordId: poRequestId,
                                isEditMode: false
                            });
                            outputUrl = scheme + host + relativePath;//采购申请审批URL
                            log.audit("采购申请单outputUrl", outputUrl);
                        }
                    }

                    var apWfRec = record.create({type:"customrecord_swc_ap_wf",isDynamic:true});//创建采购付款申请审批单据
                    if(info["department"])apWfRec.setValue({fieldId:"custrecord_apwf_department",value:info["department"]});//预算归属部门
                    if(info["item"])apWfRec.setValue({fieldId:"custrecord_apwf_item",value:info["item"]});//费用类型
                    if(info["expensetype"])apWfRec.setValue({fieldId:"custrecord_apwf_catagorytype",value:info["expensetype"]});//费用类别
                    if(info["totalamount"])apWfRec.setValue({fieldId:"custrecord_apwf_totalamount",value:info["totalamount"]});//金额(原币)
                    if(info["empId"])apWfRec.setValue({fieldId:"custrecord_apwf_buyer",value:info["empId"]});//提交人
                    if(info["apspro"])apWfRec.setValue({fieldId:"custrecord_apwf_pro",value:info["apspro"]});//项目
                    apWfRec.setValue({fieldId:"custrecord_apwf_line_status",value:SWC_CONFIG_DATA.configData().BILL_APPROVAL_STATUS_FS_APPROVAL});//审批中

                    if(info["custrecord_ap_reason_description"])apWfRec.setValue({fieldId:"custrecord_apwf_reason_description",value:info["custrecord_ap_reason_description"]});//事由描述
                    if(info["custrecord_ap_payment_method"])apWfRec.setValue({fieldId:"custrecord_apwf_payment_method",value:info["custrecord_ap_payment_method"]});//付款方式
                    if(info["custrecord_ap_payment_period"])apWfRec.setValue({fieldId:"custrecord_apwf_subsidary",value:info["custrecord_ap_payment_period"]});//付款周期
                    if(info["custrecord_ap_vendorname"])apWfRec.setValue({fieldId:"custrecord_apwf_vendorname",value:info["custrecord_ap_vendorname"]});//供应商名称
                    if(info["custrecord_ap_currency"])apWfRec.setValue({fieldId:"custrecord_apwf_currency",value:info["custrecord_ap_currency"]});//币种
                    if(info["custrecord_ap_taxcode"])apWfRec.setValue({fieldId:"custrecord_apwf_taxcode",value:info["custrecord_ap_taxcode"]});//税码
                    if(info["custrecord_ap_vendor_bankname"])apWfRec.setValue({fieldId:"custrecord_apwf_vendor_bankname",value:info["custrecord_ap_vendor_bankname"]});//VENDOR BANK NAME
                    if(info["custrecord_ap_vendor_bank_accountno"])apWfRec.setValue({fieldId:"custrecord_apwf_vendor_bank_accountno",value:info["custrecord_ap_vendor_bank_accountno"]});//VENDOR BANK ACCOUNT NO.
                    if(info["custrecord_ap_vendorbank_citystate"])apWfRec.setValue({fieldId:"custrecord_apwf_vendorbank_citystate",value:info["custrecord_ap_vendorbank_citystate"]});//VENDOR BANK CITY OR STATE
                    if(info["custrecord_ap_swiftcode"])apWfRec.setValue({fieldId:"custrecord_apwf_swiftcode",value:info["custrecord_ap_swiftcode"]});//SWIFT CODE
                    if(info["custrecord_ap_routing_transitno"])apWfRec.setValue({fieldId:"custrecord_apwf_routing_transitno",value:info["custrecord_ap_routing_transitno"]});//ROUTING & TRANSIT NO.
                    if(info["custrecord_ap_invoiceno"])apWfRec.setValue({fieldId:"custrecord_apwf_invoiceno",value:info["custrecord_ap_invoiceno"]});//INVOICE编号
                    if(info["custrecord_ap_fullname"])apWfRec.setValue({fieldId:"custrecord_apwf_fullname",value:info["custrecord_ap_fullname"]});////收款人全名
                    if(info["custrecord_ap_address"])apWfRec.setValue({fieldId:"custrecord_apwf_address",value:info["custrecord_ap_address"]});//收款人收件地址
                    if(info["custrecord_ap_phone"])apWfRec.setValue({fieldId:"custrecord_apwf_phone",value:info["custrecord_ap_phone"]});//收款人联系电话
                    if(info["custrecord_ap_address_payee"])apWfRec.setValue({fieldId:"custrecord_apwf_address_payee",value:info["custrecord_ap_address_payee"]});//收款人邮箱
                    if(info["custrecord_ap_invoice_attachment"])apWfRec.setValue({fieldId:"custrecord_apwf_invoice_attachment2",value:info["custrecord_ap_invoice_attachment"]});//发票附件1
                    if(info["custrecord_ap_invoice_attachment2"])apWfRec.setValue({fieldId:"custrecord_apwf_invoice_attachment_two",value:info["custrecord_ap_invoice_attachment2"]});//发票附件2
                    if(info["custrecord_ap_invoice_attachment3"])apWfRec.setValue({fieldId:"custrecord_apwf_invoice_attachment_third",value:info["custrecord_ap_invoice_attachment3"]});//发票附件3
                    if(info["custrecord_ap_over_reason"])apWfRec.setValue({fieldId:"custrecord_apwf_over_reason",value:info["custrecord_ap_over_reason"]});//超申请理由
                    if(info["custrecord_ap_actul_paytime"]){
                        var actul_paytime = format.parse({value:new Date(format.parse({value: info["custrecord_ap_actul_paytime"],type:format.Type.DATE})),type:format.Type.DATE});
                        if(info["custrecord_ap_actul_paytime"])apWfRec.setValue({fieldId:"custrecord_apwf_actul_paytime",value:actul_paytime});//付款日期
                    }
                    if(info["purchOrdIntlId"])apWfRec.setValue({fieldId:"custrecord_apwf_po",value:info["purchOrdIntlId"]});//取得采购订单单号
                    if(info["fileIdAryFirst"])apWfRec.setValue({fieldId:"custrecord_apwf_invoice_attachment",value:info["fileIdAryFirst"]});//合同或报价单附件
                    if(info["poAmount"])apWfRec.setValue({fieldId:"custrecord_apwf_po_amount",value:info["poAmount"]});//采购订单金额
                    if(info["poPaidAmount"])apWfRec.setValue({fieldId:"custrecord_apwf_po_amount_paid",value:info["poPaidAmount"]});//已付款金额
                    if(info["poUnpayAmount"])apWfRec.setValue({fieldId:"custrecord_apwf_po_amount_unpay",value:info["poUnpayAmount"]});//采购订单未付金额
                    if(info["custrecord_ap_expected_paytime"]){
                        var expected_paytime = format.parse({value:new Date(format.parse({value: info["custrecord_ap_expected_paytime"],type:format.Type.DATE})),type:format.Type.DATE});
                        if(info["custrecord_ap_expected_paytime"])apWfRec.setValue({fieldId:"custrecord_apwf_paydate",value:expected_paytime});//期望付款时间
                    }
                    if(info["custrecord_ap_subsidary"])apWfRec.setValue({fieldId:"custrecord_apwf_paysub",value:info["custrecord_ap_subsidary"]});//付款主体
                    if(outputUrl)apWfRec.setValue({fieldId:"custrecord_apwf_url",value:outputUrl});//采购申请URL链接

                    auditId = apWfRec.save();
                }
            }catch (e) {
                log.audit("message",e.message);
                context.response.write(JSON.stringify({"auditId":"","message":e.message}));
                return;
            }
            log.audit("auditId",auditId);
            context.response.write(JSON.stringify({"auditId":auditId,"message":""}));
            return;
        }

        /**
         * 根据供应商账单申请下的采购申请单单号字段查询采购申请内部ID
         */
        function sechPoRequestId(poId) {
            var customrecord_swc_purchase_requestSearchObj = search.create({
                type: "customrecord_swc_purchase_request",
                filters:
                    [
                        ["custrecord_prs_field.custrecord_prs_ponum","anyof",poId]
                    ],
                columns:
                    [
                        search.createColumn({name: "internalid", label: "内部 ID"})
                    ]
            });
            var results = getAllResults(customrecord_swc_purchase_requestSearchObj);
            var id = "";
            results.forEach(function (value) {
                id = value.getValue({name: "internalid", label: "内部 ID"});
            });
            return id;
        }

        function getAllResults(mySearch)
        {
            var resultSet = mySearch.run();
            var resultArr= [];
            var start = 0;
            var step  = 1000;
            var results = resultSet.getRange({start: start, end: step});
            while(results && results.length>0)
            {
                resultArr = resultArr.concat(results);
                start = Number(start)+Number(step);
                results = resultSet.getRange({start: start,end: Number(start)+Number(step)});
            }
            return resultArr;
        }

        return {
            onRequest: onRequest
        };
    });
