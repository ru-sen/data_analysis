/**
 * @NApiVersion 2.0
 * @NModuleScope Public
 */
define(["N/search",'N/url','N/https',"./SWC_CONFIG_DATA", "N/runtime", "./SWC_OMS_Utils", "N/file", "../lib/decimal", 'N/record'],

    function(search,url,https, SWC_CONFIG_DATA, runtime, SWCommons, file, decimal,record) {

        /**
         * 取得飞书供应商账单申请的字段映射字典数据
         * @param {string} templateType 模板类型
         * @return {Object} {"字段名称": {"id": "ID", "value": {"TEXT": "VALUE"}, ...}, ...}
         */
        function getFsVendorBillApplyDict(templateType) {
            var schCrtObj = search.create({
                type: "customrecord_swc_feishu_fieldid_mapping",
                filters:
                    [
                        ["isinactive","is","F"],
                        "AND",
                        ["custrecord_idmap_type","is", templateType]
                    ],
                columns:
                    [
                        search.createColumn({name: "custrecord_idmap_name", label: "字段名称"}),
                        search.createColumn({name: "custrecord_idmap_text", label: "TEXT"}),
                        search.createColumn({name: "custrecord_idmap_value", label: "Value"}),
                        search.createColumn({name: "custrecord_idmap_id", label: "ID"})
                    ]
            });

            var results = getAllResults(schCrtObj);

            var dictObj = {};
            for (var i = 0; i < results.length; i++) {
                var name = results[i].getValue({name: "custrecord_idmap_name", label: "字段名称"});
                var text = results[i].getValue({name: "custrecord_idmap_text", label: "TEXT"});
                var value = results[i].getValue({name: "custrecord_idmap_value", label: "Value"});
                var id = results[i].getValue({name: "custrecord_idmap_id", label: "ID"});

                // {"字段名称": {"id": "ID", "value": {"TEXT": "VALUE"}, ...}, ...}
                dictObj[name] = dictObj[name] || {id: null, value: {}};
                if (id) {
                    dictObj[name]["id"] = id;
                }
                dictObj[name]["value"][text] = value;
            }

            return dictObj;
        }

        /**
         * 校验飞书审批列表字段映射
         * @param {Object} options
         * @param {Object} options.fsVBADictObj 飞书供应商账单申请的字段映射字典数据 {"字段名称": {"id": "ID", "value": {"TEXT": "VALUE"}, ...}, ...}
         * @param {string} options.fieldName 字段名称
         * @param {string} options.valTarget 取值目标：取对应的ID："id"，取对应的值："value"
         * @param {string} options.text TEXT
         * @param {boolean} options.itemFlag 货品类型字段
         * @return {"value": "", "errInfo": "", "successFlag": true}
         */
        function verifyInfo(options) {
            var fsVBADictObj = options.fsVBADictObj;
            var fieldName = options.fieldName;
            var valTarget = options.valTarget;
            var text = options.text;
            var itemFlag = options.itemFlag;
            if (itemFlag) {
                // 货品类型字段，去除部门区分：(G&A)、(R&D)、(S&M)
                var end = text.lastIndexOf("(G&A)");
                if (end == -1) {
                    end = text.lastIndexOf("(R&D)");
                }
                if (end == -1) {
                    end = text.lastIndexOf("(S&M)");
                }

                if (end != -1) {
                    text = text.substring(0, (end - 1));
                }
                log.error("货品名称", text)
            }


            var result = {"value": "", "errInfo": ""};
            // 映射字段字段数据为空的场合
            if (!fsVBADictObj) return result;
            // 字段名称为空的场合
            if (!fieldName) return result;
            // 取值目标为空的场合
            if (!valTarget) return result;
            // 取值目标为"value"TEXT为空的场合
            if (valTarget == SWC_CONFIG_DATA.configData().FS_CRT_APPROVAL_VALUE_TARGET_VALUE && !text) return result;

            // 字段名称不存在值的场合，提示：飞书审批列表字段映射未维护字段名称：fieldName
            if (!fsVBADictObj.hasOwnProperty(fieldName)) {
                result.errInfo = SWC_Translate.translate("飞书审批列表字段映射未维护字段名称：") + fieldName + "\n";
                return result;
            }

            if (valTarget == SWC_CONFIG_DATA.configData().FS_CRT_APPROVAL_VALUE_TARGET_ID) {
                // 取值目标为id的场合
                // 对应的id不存在的场合，提示：飞书审批列表字段映射未维护字段名称：fieldName对应的ID
                if (!fsVBADictObj[fieldName][valTarget]) {
                    result.errInfo = SWC_Translate.translate("飞书审批列表字段映射未维护字段名称：") + fieldName + SWC_Translate.translate("对应的ID") + "\n";
                } else {
                    result.value = fsVBADictObj[fieldName][valTarget];
                }
            } else if (valTarget == SWC_CONFIG_DATA.configData().FS_CRT_APPROVAL_VALUE_TARGET_VALUE) {
                // 取值目标为value的场合
                if (!fsVBADictObj[fieldName][valTarget]) {
                    // 对应的value不存在的场合，提示：飞书审批列表字段映射未维护字段名称：fieldName对应的TEXT
                    result.errInfo = SWC_Translate.translate("飞书审批列表字段映射未维护字段名称：") + fieldName + SWC_Translate.translate("对应的TEXT") + "\n";
                } else if (!fsVBADictObj[fieldName][valTarget].hasOwnProperty(text)) {
                    // 指定TEXT不存在的场合，提示：飞书审批列表字段映射未维护字段名称：fieldName对应的TEXT：text
                    result.errInfo = SWC_Translate.translate("飞书审批列表字段映射未维护字段名称：") + fieldName + SWC_Translate.translate("对应的TEXT:") + text + "\n";
                } else if (!fsVBADictObj[fieldName][valTarget][text]) {
                    // TEXT对应的value不存在的场合，提示：飞书审批列表字段映射未维护字段名称：fieldName对应的TEXT：text的VALUE
                    result.errInfo = SWC_Translate.translate("飞书审批列表字段映射未维护字段名称：") + fieldName + SWC_Translate.translate("对应的TEXT:") + text + SWC_Translate.translate("的VALUE") + "\n";
                } else {
                    result.value = fsVBADictObj[fieldName][valTarget][text];
                }
            }

            return result;
        }

        /**
         * 根据员工内部Id检索飞书员工ID
         * @param {string} empId 员工ID
         * @return {string} fsEmpId 飞书员工ID
         */
        function schFsEmpIdByEmpId(empId) {
            if (!empId) return "";

            var employeeSearchObj = search.create({
                type: "employee",
                filters:
                    [
                        // ["isinactive","is","F"],
                        // "AND",
                        ["internalid","anyof", empId]
                    ],
                columns:
                    [
                        search.createColumn({name: "custentity_swc_feishu_userid", label: "飞书员工id"})
                    ]
            });

            var searchResultCount = employeeSearchObj.runPaged().count;
            if (!searchResultCount) return "";
            var fsEmpId = "";
            employeeSearchObj.run().each(function(result){
                fsEmpId = result.getValue({name: "custentity_swc_feishu_userid", label: "飞书员工id"});
                return false;
            });

            return fsEmpId;
        }



        /**
         * 根据部门内部ID取得飞书OPENID(部门)
         * @param {string} deptIntlId Ns部门id
         * @return {string} 飞书OPENID(部门)
         */
        function schFsOpenId(deptIntlId) {
            var customrecord_swc_feishu_depart_mappingSearchObj = search.create({
                type: "customrecord_swc_feishu_depart_mapping",
                filters:
                    [
                        // ["isinactive","is","F"],
                        // "AND",
                        ["custrecord_departmap_nsdep","anyof", deptIntlId]
                    ],
                columns:
                    [
                        search.createColumn({name: "custrecord_departmap_feiopenid", label: "openid(部门)"})
                    ]
            });
            var searchResultCount = customrecord_swc_feishu_depart_mappingSearchObj.runPaged().count;
            var fsOpenId;
            if (searchResultCount > 0) {
                customrecord_swc_feishu_depart_mappingSearchObj.run().each(function(result){
                    fsOpenId = result.getValue({name: "custrecord_departmap_feiopenid", label: "openid(部门)"});
                    return false;
                });
            }

            return fsOpenId;
        }

        /**
         * 根据部门内部ID取得飞书OPENID(部门)
         * @param {array} deptIntlIdAry Ns部门id
         * @return {Object} {"NS部门ID": "飞书OPENID(部门)", ...}
         */
        function schFsOpenIdByDeptIdAry(deptIntlIdAry) {
            if (!deptIntlIdAry || !deptIntlIdAry.length) return {};

            var schObj = search.create({
                type: "customrecord_swc_feishu_depart_mapping",
                filters:
                    [
                        ["isinactive","is","F"],
                        "AND",
                        ["custrecord_departmap_nsdep","anyof", deptIntlIdAry]
                    ],
                columns:
                    [
                        search.createColumn({name: "custrecord_departmap_feiopenid", label: "openid(部门)"}),
                        search.createColumn({name: "custrecord_departmap_nsdep", label: "NS部门列表"})
                    ]
            });

            var results = getAllResults(schObj);

            var fsOpenIdAry = {};
            for (var i = 0; i < results.length; i++) {
                var fsOpenId = results[i].getValue({name: "custrecord_departmap_feiopenid", label: "openid(部门)"});
                var nsDeptId = results[i].getValue({name: "custrecord_departmap_nsdep", label: "NS部门列表"});

                fsOpenIdAry[nsDeptId] = fsOpenId;
            }

            return fsOpenIdAry;
        }

        /**
         * 创建采购申请审批单据
         * @param {Object} options
         * @param {string} options.approvalCode 模板ID
         * @param {string} options.submitter 提交人
         * @param {boolean} options.withDraw 是否代替
         * @param {array} options.formAry 表单参数
         * @param {string} options.verifyInfo 校验信息
         * @return {"msg": "", "instanceCode": ""}
         */
        function pushFsApproval(options) {
            var info = options.info;

            var msg = "";
            var instanceCode = "";//审批单据ID
            if (Object.keys(info).length>0) {
                // 创建单据
                try {
                    var auditId = "";//审批单据ID
                    //创建采购申请审批
                    // if(options.approvalCode == "FB6D2FA3-B5C3-4239-BB73-C413F23555A8"){
                    //     var prWfRec = record.create({type:"customrecord_swc_pr_wf",isDynamic:true});//创建采购申请审批单据
                    //     if(info["department"])prWfRec.setValue({fieldId:"custrecord_prwf_budget_department",value:info["department"]});//预算归属部门
                    //     if(info["item"])prWfRec.setValue({fieldId:"custrecord_prwf_item",value:info["item"]});//费用类型
                    //     if(info["expensetype"])prWfRec.setValue({fieldId:"custrecord_prwf_expense_type",value:info["expensetype"]});//费用类别
                    //     if(info["totalamount"])prWfRec.setValue({fieldId:"custrecord_prwf_totalamount",value:info["totalamount"]});//金额(原币)
                    //     if(info["assetit"])prWfRec.setValue({fieldId:"custrecord_prwf_assetit",value:info["assetit"]});//IT 资产分类
                    //     if(info["empId"])prWfRec.setValue({fieldId:"custrecord_prwf_buyer",value:info["empId"]});//提交人
                    //     if(info["prspro"])prWfRec.setValue({fieldId:"custrecord_prwf_pro",value:info["prspro"]});//项目
                    //     //prWfRec.setValue({fieldId:"custrecord_prwf_status",value:SWC_CONFIG_DATA.configData().WORKFLOW_STATUS_FS_APPROVAL});//审批中
                    //
                    //     if(info["custrecord_pr_extramemo"])prWfRec.setValue({fieldId:"custrecord_prwf_extramemo",value:info["custrecord_pr_extramemo"]});//申请理由
                    //     if(info["custrecord_pr_ven_single_rationale"])prWfRec.setValue({fieldId:"custrecord_prwf_ven_single_rationale",value:info["custrecord_pr_ven_single_rationale"]});//单一供应商理由
                    //     if(info["custrecord_pr_vendor_first"])prWfRec.setValue({fieldId:"custrecord_prwf_vendor_first",value:info["custrecord_pr_vendor_first"]});//首选供应商
                    //     if(info["custrecord_pr_vendor_sec"])prWfRec.setValue({fieldId:"custrecord_prwf_vendor_sec",value:info["custrecord_pr_vendor_sec"]});//次选供应商
                    //     if(info["custrecord_pr_vendor_third"])prWfRec.setValue({fieldId:"custrecord_prwf_vendor_third",value:info["custrecord_pr_vendor_third"]});//末选供应商
                    //     if(info["custrecord_pr_vendor_memo"])prWfRec.setValue({fieldId:"custrecord_prwf_vendor_memo",value:info["custrecord_pr_vendor_memo"]});//首选供应商入选理由，供应商报价
                    //     if(info["custrecord_pr_vendor_memo2"])prWfRec.setValue({fieldId:"custrecord_prwf_vendor_memo2",value:info["custrecord_pr_vendor_memo2"]});//次选供应商入选理由，供应商报价
                    //     if(info["custrecord_pr_vendor_memo3"])prWfRec.setValue({fieldId:"custrecord_prwf_vendor_memo3",value:info["custrecord_pr_vendor_memo3"]});//末选供应商入选理由，供应商报价
                    //     if(info["custrecord_prwf_onlyflag"])prWfRec.setValue({fieldId:"custrecord_prwf_onlyflag",value:info["custrecord_prwf_onlyflag"]});//是否单一供应商
                    //     if(info["custrecord_prwf_amount_usd"])prWfRec.setValue({fieldId:"custrecord_prwf_amount_usd",value:info["custrecord_prwf_amount_usd"]})//金额(USD)
                    //
                    //     auditId = prWfRec.save();
                    // }
                    // //创建供应商账单申请审批
                    // if(options.approvalCode == "7475FE86-9720-466A-AE43-F0F79E554AA6"){
                    //     var apWfRec = record.create({type:"customrecord_swc_ap_wf",isDynamic:true});//创建采购付款申请审批单据
                    //     if(info["department"])apWfRec.setValue({fieldId:"custrecord_apwf_department",value:info["department"]});//预算归属部门
                    //     if(info["item"])apWfRec.setValue({fieldId:"custrecord_apwf_item",value:info["item"]});//费用类型
                    //     if(info["expensetype"])apWfRec.setValue({fieldId:"custrecord_apwf_catagorytype",value:info["expensetype"]});//费用类别
                    //     if(info["totalamount"])apWfRec.setValue({fieldId:"custrecord_apwf_totalamount",value:info["totalamount"]});//金额(原币)
                    //     if(info["empId"])apWfRec.setValue({fieldId:"custrecord_apwf_buyer",value:info["empId"]});//提交人
                    //     if(info["apspro"])apWfRec.setValue({fieldId:"custrecord_apwf_pro",value:info["apspro"]});//项目
                    //     apWfRec.setValue({fieldId:"custrecord_apwf_line_status",value:SWC_CONFIG_DATA.configData().BILL_APPROVAL_STATUS_FS_APPROVAL});//审批中
                    //
                    //     if(info["custrecord_ap_reason_description"])apWfRec.setValue({fieldId:"custrecord_apwf_reason_description",value:info["custrecord_ap_reason_description"]});//事由描述
                    //     if(info["custrecord_ap_payment_method"])apWfRec.setValue({fieldId:"custrecord_apwf_payment_method",value:info["custrecord_ap_payment_method"]});//付款方式
                    //     if(info["custrecord_ap_payment_period"])apWfRec.setValue({fieldId:"custrecord_apwf_subsidary",value:info["custrecord_ap_payment_period"]});//付款周期
                    //     if(info["custrecord_ap_vendorname"])apWfRec.setValue({fieldId:"custrecord_apwf_vendorname",value:info["custrecord_ap_vendorname"]});//供应商名称
                    //     if(info["custrecord_ap_currency"])apWfRec.setValue({fieldId:"custrecord_apwf_currency",value:info["custrecord_ap_currency"]});//币种
                    //     if(info["custrecord_ap_taxcode"])apWfRec.setValue({fieldId:"custrecord_apwf_taxcode",value:info["custrecord_ap_taxcode"]});//税码
                    //     if(info["custrecord_ap_vendor_bankname"])apWfRec.setValue({fieldId:"custrecord_apwf_vendor_bankname",value:info["custrecord_ap_vendor_bankname"]});//VENDOR BANK NAME
                    //     if(info["custrecord_ap_vendor_bank_accountno"])apWfRec.setValue({fieldId:"custrecord_apwf_vendor_bank_accountno",value:info["custrecord_ap_vendor_bank_accountno"]});//VENDOR BANK ACCOUNT NO.
                    //     if(info["custrecord_ap_vendorbank_citystate"])apWfRec.setValue({fieldId:"custrecord_apwf_vendorbank_citystate",value:info["custrecord_ap_vendorbank_citystate"]});//VENDOR BANK CITY OR STATE
                    //     if(info["custrecord_ap_swiftcode"])apWfRec.setValue({fieldId:"custrecord_apwf_swiftcode",value:info["custrecord_ap_swiftcode"]});//SWIFT CODE
                    //     if(info["custrecord_ap_routing_transitno"])apWfRec.setValue({fieldId:"custrecord_apwf_routing_transitno",value:info["custrecord_ap_routing_transitno"]});//ROUTING & TRANSIT NO.
                    //     if(info["custrecord_ap_invoiceno"])apWfRec.setValue({fieldId:"custrecord_apwf_invoiceno",value:info["custrecord_ap_invoiceno"]});//INVOICE编号
                    //     if(info["custrecord_ap_fullname"])apWfRec.setValue({fieldId:"custrecord_apwf_fullname",value:info["custrecord_ap_fullname"]});////收款人全名
                    //     if(info["custrecord_ap_address"])apWfRec.setValue({fieldId:"custrecord_apwf_address",value:info["custrecord_ap_address"]});//收款人收件地址
                    //     if(info["custrecord_ap_phone"])apWfRec.setValue({fieldId:"custrecord_apwf_phone",value:info["custrecord_ap_phone"]});//收款人联系电话
                    //     if(info["custrecord_ap_address_payee"])apWfRec.setValue({fieldId:"custrecord_apwf_address_payee",value:info["custrecord_ap_address_payee"]});//收款人邮箱
                    //     if(info["custrecord_ap_invoice_attachment"])apWfRec.setValue({fieldId:"custrecord_apwf_invoice_attachment2",value:info["custrecord_ap_invoice_attachment"]});//发票附件1
                    //     if(info["custrecord_ap_over_reason"])apWfRec.setValue({fieldId:"custrecord_apwf_over_reason",value:info["custrecord_ap_over_reason"]});//超申请理由
                    //     if(info["custrecord_ap_actul_paytime"])apWfRec.setValue({fieldId:"custrecord_apwf_actul_paytime",value:info["custrecord_ap_actul_paytime"]});//付款日期
                    //     if(info["purchOrdIntlId"])apWfRec.setValue({fieldId:"custrecord_apwf_po",value:info["purchOrdIntlId"]});//取得采购订单单号
                    //     if(info["fileIdAryFirst"])apWfRec.setValue({fieldId:"custrecord_apwf_invoice_attachment",value:info["fileIdAryFirst"]});//合同或报价单附件
                    //     if(info["poAmount"])apWfRec.setValue({fieldId:"custrecord_apwf_po_amount",value:info["poAmount"]});//采购订单金额
                    //     if(info["poPaidAmount"])apWfRec.setValue({fieldId:"custrecord_apwf_po_amount_paid",value:info["poPaidAmount"]});//已付款金额
                    //     if(info["poUnpayAmount"])apWfRec.setValue({fieldId:"custrecord_apwf_po_amount_unpay",value:info["poUnpayAmount"]});//采购订单未付金额
                    //     if(info["custrecord_ap_expected_paytime"])apWfRec.setValue({fieldId:"custrecord_apwf_paydate",value:info["custrecord_ap_expected_paytime"]});//期望付款时间
                    //     if(info["custrecord_ap_subsidary"])apWfRec.setValue({fieldId:"custrecord_apwf_paysub",value:info["custrecord_ap_subsidary"]});//付款主体
                    //
                    //     auditId = apWfRec.save();
                    // }

                    //调用SL接口创建单据（需要再SL创建单据 否则无法执行工作流）
                    var urlObj = url.resolveScript({
                        scriptId: 'customscript_swc_sl_purvendortons',
                        deploymentId: 'customdeploy_swc_sl_purvendortons',
                        returnExternalUrl:true
                         //params: {'options': JSON.stringify(options)}
                    });
                    var slMessage = "";
                    var responseBody = https.post({
                        url: urlObj,
                        body: {"obj": JSON.stringify(options)}
                    }).body;
                    log.audit("responseBody",responseBody);
                    var responseBodyJson = JSON.parse(responseBody);
                    log.audit("auditId",responseBodyJson.auditId);
                    log.audit("slMessage",responseBodyJson.message);
                    auditId = responseBodyJson.auditId;
                    slMessage = responseBodyJson.message;
                    if (auditId) {
                        msg = "success";
                        // 模板创建成功
                        instanceCode = auditId;
                    } else {
                        msg = "单据创建失败。"+slMessage;
                    }
                } catch (e) {
                    msg = "单据创建失败：" + slMessage;
                }
            } else {
                msg = "没有需要执行的单据！";
            }

            return {"msg": msg, "instanceCode": instanceCode};
        }

        function getAllResults(mySearch) {
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

        /**
         * 根据采购申请内部ID检索文件
         * @param {string} intlId
         * @return {array}
         */
        function schPurchApplyFile(intlId) {
            if (!intlId) return [];
            var customrecord_swc_purchase_requestSearchObj = search.create({
                type: "customrecord_swc_purchase_request",
                filters:
                    [
                        // ["isinactive","is","F"],
                        // "AND",
                        ["internalid","anyof", intlId]
                    ],
                columns:
                    [
                        search.createColumn({
                            name: "internalid",
                            join: "file",
                            label: "内部 ID"
                        })
                    ]
            });
            var searchResultCount = customrecord_swc_purchase_requestSearchObj.runPaged().count;
            var purchApplyFile = [];
            if (searchResultCount > 0) {
                customrecord_swc_purchase_requestSearchObj.run().each(function(result){
                    var fileIntlId = result.getValue({
                        name: "internalid",
                        join: "file",
                        label: "内部 ID"
                    });

                    if (fileIntlId) purchApplyFile.push(fileIntlId);

                    return true;
                });
            }

            return purchApplyFile;
        }

        /**
         * 文件上传接口调用
         * @param {array} fileIdAry 文件数组
         * @param {string}  fieldName 字段名称，区分报错信息字段
         * @return {Object} {"verifyInfo": 错误信息, "fsFileUrlAry": 文件上传成功code}
         */
        function fsUploadFile(fileIdAry, fieldName) {
            var verifyInfo = "";
            var fsFileUrlAry = [];
            log.error(fieldName + "fileIdAry", fileIdAry)
            fileIdAry.forEach(function (value) {
                // 访问飞书上传文件接口-将附件内容上传到飞书
                try {
                    var nsFile = file.load({id: value});
                    // 附件内容（base64编码）
                    var fileContent = nsFile.getContents();

                    // 推送正式环境
                    var response = SWCommons.requestURL({
                        platform: "飞书",
                        apiId: "pushFsUploadFile",
                        data : {
                            "fileName": nsFile.name,
                            "fileContent": fileContent,
                        },
                        skipMapping: true
                    });
                    log.error(fieldName + "response", response)

                    // 响应报文处理 {"msg":"操作成功","code":200,"data":{"msg":"success","code":0,"data":{"code":"E7EA6762-2F7B-45DF-B9B1-A8F0DC00FFD5","url":""}}}
                    // response = {"msg":"操作成功","code":200,"data":{"msg":"success","code":0,"data":{"code":"E7EA6762-2F7B-45DF-B9B1-A8F0DC00FFD5","url":""}}}
                    if (response && response.code == 200 && response.hasOwnProperty("data")) {
                        if (response.data.code == "0") {
                            fsFileUrlAry.push(response.data.data.code);
                        } else {
                            verifyInfo += fieldName + "：文件上传失败，错误码：" + response.data.code + "\n";
                        }
                    } else {
                        verifyInfo += fieldName + "：调用飞书文件上传接口异常：" + "\n";
                    }
                } catch (e) {
                    verifyInfo += fieldName + "：调用飞书文件上传接口异常：" + e.message + "\n";
                }
            });

            return {"verifyInfo": verifyInfo, "fsFileUrlAry": fsFileUrlAry};
        }

        /**
         * 根据货品内部ID检索名称
         * @param {array} itemIdAry
         * @return {Object} {"货品内部ID": "货品名称"}
         */
        function schAllItem(itemIdAry) {
            if (!itemIdAry || !itemIdAry.length) return {};

            var itemSearchObj = search.create({
                type: "item",
                filters:
                    [
                        ["internalid","anyof", itemIdAry]
                    ],
                columns:
                    [
                        search.createColumn({
                            name: "itemid",
                            sort: search.Sort.ASC,
                            label: "名称"
                        }),
                        search.createColumn({name: "internalid", label: "内部 ID"})
                    ]
            });

            var results = getAllResults(itemSearchObj);

            var itemObj = {};
            for (var i = 0; i < results.length; i++) {
                var itemId = results[i].getValue({name: "internalid", label: "内部 ID"});
                var itemName = results[i].getValue({
                    name: "itemid",
                    sort: search.Sort.ASC,
                    label: "名称"
                });

                itemObj[itemId] = itemName;
            }

            return itemObj;
        }

        /**
         * 根据内部ID检索类别（包含非活动货品）
         * @param {array} itemTypeIdAry
         * @return {Object} {"货品类型内部ID": "货品名称"}
         */
        function schAllItemType(itemTypeIdAry) {
            if (!itemTypeIdAry || !itemTypeIdAry.length) return {};

            var classificationSearchObj = search.create({
                type: "classification",
                filters:
                    [
                        ["internalid","anyof", itemTypeIdAry]
                    ],
                columns:
                    [
                        search.createColumn({
                            name: "name",
                            sort: search.Sort.ASC,
                            label: "名称"
                        }),
                        search.createColumn({name: "internalid", label: "内部 ID"})
                    ]
            });

            var results = getAllResults(classificationSearchObj);

            var itemTypeObj = {};
            for (var i = 0; i < results.length; i++) {
                var itemTypeId = results[i].getValue({name: "internalid", label: "内部 ID"});
                var itemTypeName = results[i].getValue({
                    name: "name",
                    sort: search.Sort.ASC,
                    label: "名称"
                });

                itemTypeObj[itemTypeId] = itemTypeName;
            }

            return itemTypeObj;
        }

        /**
         * 根据采购订单ID搜索采购相关文件.文件，保留9个文件
         * @param {string} purchOrdId 采购订单ID
         * @return {array} 文件ID数组
         */
        function schPurchRelatedFile(purchOrdId) {
            if (!purchOrdId) return [];

            var schObj = search.create({
                type: "customrecord_swc_po_floder",
                filters:
                    [
                        ["custrecord_folder_po","anyof", purchOrdId]
                    ],
                columns:
                    [
                        search.createColumn({name: "custrecord_folder_one", label: "文件"})
                    ]
            });

            var results = getAllResults(schObj);

            var fileIdAry = [];
            for (var i = 0; i < results.length; i++) {
                // 飞书端最大支持9个文件
                if (fileIdAry.length == 9) break;
                var fileId = results[i].getValue({name: "custrecord_folder_one", label: "文件"});
                if (fileId) {
                    fileIdAry.push(fileId);
                }
            }

            return fileIdAry;
        }

        /**
         * 检索供应商账单文件字段：发票、发票2、发票3
         * @param {string} vendorBillApplyId 供应商账单申请ID
         * @return {Object}
         */
        function schVendorBillApply(vendorBillApplyId) {
            log.error("vendorBillApplyId", vendorBillApplyId)
            if (!vendorBillApplyId) return null;
            var customrecord_swc_account_payableSearchObj = search.create({
                type: "customrecord_swc_account_payable",
                filters:
                    [
                        ["internalid","anyof", vendorBillApplyId]
                    ],
                columns:
                    [
                        search.createColumn({name: "custrecord_ap_invoice_attachment", label: "发票附件1"}),
                        search.createColumn({name: "custrecord_ap_invoice_attachment2", label: "发票附件2"}),
                        search.createColumn({name: "custrecord_ap_invoice_attachment3", label: "发票附件3"})
                    ]
            });
            var searchResultCount = customrecord_swc_account_payableSearchObj.runPaged().count;

            var vendorBillApplyObj = null;
            if (searchResultCount > 0) {
                customrecord_swc_account_payableSearchObj.run().each(function(result){
                    log.error("result", result)
                    vendorBillApplyObj = {};
                    vendorBillApplyObj["invoiceAttachmentId"] = result.getValue({name: "custrecord_ap_invoice_attachment", label: "发票附件1"});
                    vendorBillApplyObj["invoiceAttachmentId2"] = result.getValue({name: "custrecord_ap_invoice_attachment2", label: "发票附件2"});
                    vendorBillApplyObj["invoiceAttachmentId3"] = result.getValue({name: "custrecord_ap_invoice_attachment3", label: "发票附件3"});

                    return false;
                });
            }

            return vendorBillApplyObj;
        }

        /**
         * 检索采购订单金额（外币），计算总金额（外币）
         * @param {string} poId 采购订单ID
         * @return {number} 采购订单总金额（外币）
         */
        function getPOAmtForCurr(poId) {
            var amtForCurr = 0;

            if (!poId) return amtForCurr;

            var transactionSearchObj = search.create({
                type: "transaction",
                filters:
                    [
                        ["internalid","anyof", poId],
                        "AND",
                        ["mainline","is","F"],
                        "AND",
                        ["taxline","is","F"],
                        "AND",
                        ["shipping","is","F"],
                        "AND",
                        ["cogs","is","F"]
                    ],
                columns:
                    [
                        search.createColumn({name: "fxamount", label: "金额（外币）"})
                    ]
            });

            var results = getAllResults(transactionSearchObj);

            for (var i = 0; i < results.length; i++) {
                var fxAmt = Math.abs(results[i].getValue({name: "fxamount", label: "金额（外币）"}));
                amtForCurr = decimal.addN(amtForCurr, fxAmt);
            }

            return amtForCurr;
        }

        /**
         * 根据采购订单号检索账单，计算账单明细行金额（外币）
         * @param {string} poId 采购订单id
         * @return {number} 采购订单相关账单总金额（外币）
         */
        function getPoBillAmtForCurr(poId) {
            var billAmtForCurrNum = 0;
            if (!poId) return billAmtForCurrNum;

            var vendorbillSearchObj = search.create({
                type: "vendorbill",
                filters:
                    [
                        ["type","anyof","VendBill"],
                        "AND",
                        ["appliedtotransaction.internalid","anyof", poId],
                        "AND",
                        ["mainline","is","F"]
                    ],
                columns:
                    [
                        search.createColumn({name: "fxamount", label: "金额（外币）"})
                    ]
            });

            var results = getAllResults(vendorbillSearchObj);

            for (var i = 0; i < results.length; i++) {
                var fxAmt = results[i].getValue({name: "fxamount", label: "金额（外币）"});
                billAmtForCurrNum = decimal.addN(billAmtForCurrNum, Math.abs(fxAmt));
            }

            return billAmtForCurrNum;
        }

        /**
         * 检索项目（日记账）
         * @return {Object} {"id": "项目（日记账）名称", ...}
         */
        function schProjectJournal() {
            var customrecord_cseg_swc_proSearchObj = search.create({
                type: "customrecord_cseg_swc_pro",
                filters:
                    [
                        ["isinactive","is","F"]
                    ],
                columns:
                    [
                        search.createColumn({
                            name: "name",
                            sort: search.Sort.ASC,
                            label: "名称"
                        }),
                        search.createColumn({name: "internalid", label: "内部 ID"})
                    ]
            });
            var count = customrecord_cseg_swc_proSearchObj.runPaged().count;
            var results = {};
            if (count > 0) {
                customrecord_cseg_swc_proSearchObj.run().each(function(result){
                    var name = result.getValue({
                        name: "name",
                        sort: search.Sort.ASC,
                        label: "名称"
                    });
                    var id = result.getValue({name: "internalid", label: "内部 ID"});

                    results[id] = name;
                    return true;
                });
            }

            return results;
        }

        return {
            getFsVendorBillApplyDict: getFsVendorBillApplyDict, // 取得飞书供应商账单申请的字段映射字典数据
            verifyInfo: verifyInfo, // 校验飞书审批列表字段映射
            schFsEmpIdByEmpId: schFsEmpIdByEmpId, // 根据员工内部Id检索飞书员工ID
            schFsOpenId: schFsOpenId, // 根据部门内部ID取得飞书OPENID(部门)
            schFsOpenIdByDeptIdAry: schFsOpenIdByDeptIdAry, // 根据部门内部ID取得飞书OPENID(部门)
            pushFsApproval: pushFsApproval, // 创建采购申请审批单据
            schPurchApplyFile: schPurchApplyFile, // 根据采购申请内部ID检索文件
            fsUploadFile: fsUploadFile, // 文件上传接口调用
            schAllItem: schAllItem, // 根据内部ID检索货品（包含非活动货品）
            schAllItemType: schAllItemType, // 根据内部ID检索类别（包含非活动货品）
            schPurchRelatedFile: schPurchRelatedFile, // 根据采购订单ID搜索采购相关文件.文件
            schVendorBillApply: schVendorBillApply, // 检索供应商账单文件字段：发票、发票2、发票3
            getPOAmtForCurr: getPOAmtForCurr, // 检索采购订单金额（外币），计算总金额（外币）
            getPoBillAmtForCurr: getPoBillAmtForCurr, // 根据采购订单号检索账单，计算账单明细行金额（外币）
            schProjectJournal: schProjectJournal, // 检索项目（日记账）{"id": "项目（日记账）名称", ...}
            getAllResults: getAllResults,
        };

    });
