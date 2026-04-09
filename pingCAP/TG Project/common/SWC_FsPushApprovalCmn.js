/**
 * @NApiVersion 2.0
 * @NModuleScope Public
 */
define(["N/search", "./SWC_CONFIG_DATA", "N/runtime", "./SWC_OMS_Utils", "N/file", "../lib/decimal",
    "./SWC_Translate"],

    function(search, SWC_CONFIG_DATA, runtime, SWCommons, file, decimal, SWC_Translate) {

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
            log.error('配置表：|' + templateType + '|', results.length)
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
log.error('flag-101', valTarget + '| ' +fieldName + ' | ' + text )
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
                    log.error('flag-1', 1)
                    // 对应的value不存在的场合，提示：飞书审批列表字段映射未维护字段名称：fieldName对应的TEXT
                    result.errInfo = SWC_Translate.translate("飞书审批列表字段映射未维护字段名称：") + fieldName + SWC_Translate.translate("对应的TEXT") + "\n";
                } else if (!fsVBADictObj[fieldName][valTarget].hasOwnProperty(text)) {
                    log.error('flag-1:' + text, fsVBADictObj[fieldName][valTarget])
                    log.error('flag-2:' + text, fsVBADictObj[fieldName][valTarget][text])

                    // 指定TEXT不存在的场合，提示：飞书审批列表字段映射未维护字段名称：fieldName对应的TEXT：text
                    result.errInfo = SWC_Translate.translate("飞书审批列表字段映射未维护字段名称：") + fieldName + SWC_Translate.translate("对应的TEXT:") + text + "\n";
                } else if (!fsVBADictObj[fieldName][valTarget][text]) {
                    log.error('flag-1', 3)

                    // TEXT对应的value不存在的场合，提示：飞书审批列表字段映射未维护字段名称：fieldName对应的TEXT：text的VALUE
                    result.errInfo = SWC_Translate.translate("飞书审批列表字段映射未维护字段名称：") + fieldName + SWC_Translate.translate("对应的TEXT:") + text + SWC_Translate.translate("的VALUE") + "\n";
                } else {
                    log.error('flag-1', 4)

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
         * 推送飞书审批实例
         * @param {Object} options
         * @param {string} options.approvalCode 模板ID
         * @param {string} options.submitter 提交人
         * @param {boolean} options.withDraw 是否代替
         * @param {array} options.formAry 表单参数
         * @param {string} options.verifyInfo 校验信息
         * @return {"msg": "", "instanceCode": ""}
         */
        function pushFsApproval(options) {
            var verifyInfo = options.verifyInfo;
            var submitter = options.submitter;
            var withDraw = options.withDraw;

            var msg = "";
            var instanceCode = "";
            if (!verifyInfo) {
                // 调用框架请求方法
                try {
                    // 当需求者不为空&&是否代提为true的场合，用户id设置为提交人，否则用户id设置为当前登录用户
                    var empId;
                    if (submitter && withDraw) {
                        empId = submitter;
                    } else {
                        if(runtime.getCurrentUser().id == 75901) {//JW HC
                            empId = submitter;
                        } else {
                            empId = runtime.getCurrentUser().id;
                        }
                    }
                    // 根据员工内部ID取得飞书用户id
                    var fsUserId = schFsEmpIdByEmpId(empId);
                    log.error("fsUserId", fsUserId)
                    log.error("表单参数formAry",options.formAry);
                    // 推送审批接口
                    var response = SWCommons.requestURL({
                        platform: "飞书",
                        apiId: "pushFsApprovalInstance",
                        data: {
                            "approval_code" : options.approvalCode,
                            "user_id" : fsUserId,
                            "form" : JSON.stringify(options.formAry)
                        },
                        skipMapping: true
                    });

                    // 响应结果处理
                    // {"code":0,"msg":"success","data":{"instance_code":"81D31358-93AF-92D6-7425-01A5D67C4E71"}}
                    // response = {"code":0,"msg":"success","data":{"instance_code":"81D31358-93AF-92D6-7425-01A5D67C4E71"}};
                    if (response.code == 0) {
                        msg = response.msg;
                        // 模板创建成功
                        instanceCode = response.data.instance_code;
                    } else {
                        msg = "单据推送失败：错误码【" + response.code + "】、错误信息【" + response.msg + "】";
                    }
                } catch (e) {
                    msg = "单据推送接口调用异常：" + e.message;
                }
            } else {
                msg = verifyInfo;
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
                // 飞书端最大支持9个文件，这里存8个 外面取一个
                if (fileIdAry.length == 8) break;
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
            pushFsApproval: pushFsApproval, // 推送飞书审批实例
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
