/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @NModuleScope public
 */
define(['N/record', 'N/search', 'N/ui/serverWidget', 'N/currentRecord', 'N/ui/dialog'],

    (record, search, serverWidget, currentRecord, dialog) => {
        /**
         * Defines the Suitelet script trigger point.
         * @param {Object} scriptContext
         * @param {ServerRequest} scriptContext.request - Incoming request
         * @param {ServerResponse} scriptContext.response - Suitelet response
         * @since 2015.2
         */
        const onRequest = (scriptContext) => {
            var response = scriptContext.response;
            var request = scriptContext.request;
            // 获取从CS传递的数据
            var option = request.parameters.option;
            option = JSON.parse(option);
            if (option.api == 'poData') {
                // 将数据中的【表单ID】提取出来
                var formId = option.pay_form_id;
                // 通过【record.load】载入，获取【供应商预付款申请】表单的数据
                var curRec = record.load({
                    type: 'customrecord_swc_purchase_request',
                    id: formId,
                    isDynamic: true
                });
                // 创建错误信息对象
                var errorAlert = {};
                // 获取【首选供应商】字段
                var vendor = curRec.getValue({
                    fieldId: 'custrecord_pr_vendor_first'
                });
                // 如果供应商为空，需要提示用户
                if (!vendor) {
                    errorAlert = {
                        errorInfo: "noVenodr",
                    }
                    response.write(JSON.stringify(errorAlert));
                    return;
                }
                // 获取【需求者】字段
                var employee = curRec.getValue({
                    fieldId: 'custrecord_pr_buyer'
                });
                // 获取【创建采购订单日期】
                var crtPoDate = new Date();
                // 获取【审批状态】
                var approvalstatus = curRec.getValue({
                    fieldId: 'custrecord_pr_workflowstatus'
                });
                // 获取【子公司】
                var subS = curRec.getValue({
                    fieldId: 'custrecord_pr_sub'
                });
                // 获取【部门】
                var department = curRec.getValue({
                    fieldId: 'custrecord_pr_department'
                });
                // 获取【正当理由】
                var justification = curRec.getValue({
                    fieldId: 'custrecord_pr_extramemo'
                });
                // 获取【货币】
                var currency = curRec.getValue({
                    fieldId: 'custrecord_pr_currency'
                });
                // 获取【子列表】信息，首先获取行号
                var sublistLine = curRec.getLineCount({
                    sublistId: 'recmachcustrecord_prs_field'
                });
                // 建立【子列表信息】相关数组(货品，数量，价格，税码，总金额，税额)
                var itemArr = [];
                var quantityArr = [];
                var priceArr = [];
                var taxCodeArr = [];
                var totalAmountArr = [];
                var taxCountArr = [];
                // 遍历整个子列表
                for (var i = 0; i < sublistLine; i++) {
                    // 选中当前行
                    curRec.selectLine({
                        sublistId: 'recmachcustrecord_prs_field',
                        line: i
                    });
                    // 获取【货品】
                    var item = curRec.getCurrentSublistValue({
                        sublistId: 'recmachcustrecord_prs_field',
                        fieldId: 'custrecord_prs_item'
                    });
                    // 如果货品为空，需要提示用户
                    if (!item) {
                        errorAlert = {
                            errorInfo: "noItem",
                            line: i
                        }
                        response.write(JSON.stringify(errorAlert));
                        return;
                    }
                    // 获取【数量】
                    var quantity = curRec.getCurrentSublistValue({
                        sublistId: 'recmachcustrecord_prs_field',
                        fieldId: 'custrecord_prs_quantity'
                    });
                    // 获取【价格】
                    var price = curRec.getCurrentSublistValue({
                        sublistId: 'recmachcustrecord_prs_field',
                        fieldId: 'custrecord_prs_price'
                    });
                    // 获取【税码】
                    var taxCode = curRec.getCurrentSublistValue({
                        sublistId: 'recmachcustrecord_prs_field',
                        fieldId: 'custrecord_prs_taxcode'
                    });
                    // 获取【总金额】
                    var totalAmount = curRec.getCurrentSublistValue({
                        sublistId: 'recmachcustrecord_prs_field',
                        fieldId: 'custrecord_prs_totalamount'
                    });
                    // 获取【税额】
                    var taxCount = curRec.getCurrentSublistValue({
                        sublistId: 'recmachcustrecord_prs_field',
                        fieldId: 'custrecord_prs_taxrate'
                    });
                    // 将数据添加到数组中
                    itemArr.push(item);
                    quantityArr.push(quantity);
                    priceArr.push(price);
                    taxCodeArr.push(taxCode);
                    totalAmountArr.push(totalAmount);
                    taxCountArr.push(taxCount);
                }
                // 检索所有【子公司】对应的【税码】
                var srchTaxSubsRst = srchAllTaxSubs(subS).idArr;
                // 遍历【税码】数组，匹配对应的【子公司】名称
                for (var i = 0; i < taxCodeArr.length; i++) {
                    // 如果【税码】不在【检索税码结果】中，需要提示用户
                    if (srchTaxSubsRst.indexOf(taxCodeArr[i]) == -1) {
                        errorAlert = {
                            errorInfo: "noTaxCode",
                            taxCodeList: srchTaxSubsRst
                        }
                        response.write(JSON.stringify(errorAlert));
                        return;
                    }
                }
                // 建立子列表数据
                var sublistObj = {
                    'itemArr': itemArr,
                    'quantityArr': quantityArr,
                    'priceArr': priceArr,
                    'taxCodeArr': taxCodeArr,
                    'totalAmountArr': totalAmountArr,
                    'taxCountArr': taxCountArr
                };
                // ======================开始创建单据，获取部分【表单数据】==========================
                // 创建【采购订单】
                var newPoRec = record.create({
                    type: record.Type.PURCHASE_ORDER,
                    isDynamic: true
                });
                // 设置【供应商】字段
                newPoRec.setValue({
                    fieldId: 'entity',
                    value: vendor
                });
                // 设置【日期】
                newPoRec.setValue({
                    fieldId: 'trandate',
                    value: crtPoDate
                });
                // 设置【员工】字段
                newPoRec.setValue({
                    fieldId: 'employee',
                    value: employee
                });
                // 设置【审批状态】
                newPoRec.setValue({
                    fieldId: 'approvalstatus',
                    value: approvalstatus
                });
                // 设置【子公司】
                newPoRec.setValue({
                    fieldId: 'subsidiary',
                    value: subS
                });
                // 设置【部门】
                newPoRec.setValue({
                    fieldId: 'department',
                    value: department
                });
                // 设置【正当理由】
                newPoRec.setValue({
                    fieldId: 'custbody_swc_justification',
                    value: justification
                });
                // 设置【货币】
                newPoRec.setValue({
                    fieldId: 'currency',
                    value: currency
                });
                // 设置【子列表取值】
                for (var i = 0; i < sublistLine; i++) {
                    // 选中当前行
                    newPoRec.selectNewLine({
                        sublistId: 'item',
                    });
                    // 设置【货品】
                    var item1 = newPoRec.setCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'item',
                        value: sublistObj.itemArr[i]
                    });
                    // 设置【数量】
                    var quantity1 = newPoRec.setCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'quantity',
                        value: sublistObj.quantityArr[i]
                    });
                    // 设置【价格】
                    var price1 = newPoRec.setCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'rate',
                        value: sublistObj.priceArr[i]
                    });
                    // 设置【税码】
                    var taxCode1 = newPoRec.setCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'taxcode',
                        value: sublistObj.taxCodeArr[i]
                    });
                    // 设置【总金额】
                    var totalAmount1 = newPoRec.setCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'grossamt',
                        value: sublistObj.totalAmountArr[i]
                    });
                    // 设置【税额】
                    var taxCount1 = newPoRec.setCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'taxrate',
                        value: sublistObj.taxCountArr[i]
                    });
                    newPoRec.commitLine({
                        sublistId: 'item'
                    });
                }
                newPoRec.save({
                    enableSourcing: true,
                    ignoreMandatoryFields: true
                });
                // 获取【采购订单】的id，回填【采购申请】的字段
                var saveRecId = newPoRec.getValue({
                    fieldId: 'tranid'
                })
                // 最后保存单据，输出字符串便于CS脚本使用
                curRec.save({
                    enableSourcing: true,
                    ignoreMandatoryFields: true
                });
                errorAlert = {
                    errorInfo: "successSavedRec",
                }
                response.write(JSON.stringify(errorAlert));
                return;
            }
            if (option.api == 'fieldChanged') {
                // 将数据中的【表单ID】提取出来
                var taxValue = option.taxValue;
                var priceValue = option.priceValue;
                var quantityValue = option.quantityValue;
                log.audit("taxValuetaxValue", taxValue);
                var decimalTax = 0;
                if (taxValue != -8) {
                    // 检索税率
                    var taxRate = search.lookupFields({
                        type: search.Type.SALES_TAX_ITEM,
                        id: taxValue,
                        columns: ['rate']
                    });
                    // 将税率转化成小数
                    var str = taxRate.rate.replace("%", "");
                    decimalTax = str / 100;
                }
                var errorAlert1 = {
                    decimalTax: decimalTax,
                }
                response.write(JSON.stringify(errorAlert1));
                return;
            }
            if (option.api == 'ifChecked') {
                log.audit("aaaaaa", "aaaaaa");
                var buyerId = option.buyerId;
                var curUserId = option.curUserId;
                var ifWithdraw = srchIfWithdaw(curUserId);
                log.audit("当前用户id",curUserId);
                log.audit("ifWithdraw", ifWithdraw);
                log.audit("ifWithdraw.ifWithdraw", ifWithdraw.ifWithdraw);
                // 如果为空需要提示用户
                if (!ifWithdraw.ifWithdraw) {
                    var errorAlert2 = {
                        errorInfo: "noPermission"
                    }
                    response.write(JSON.stringify(errorAlert2));
                    return;
                }
                // 如果不为空，需要将每一项提取出来,根据逗号分割
                else{
                    var empArr = (ifWithdraw.ifWithdraw).split(",");
                    log.audit("数组",empArr);
                    if (empArr.indexOf((buyerId).toString())===-1){
                        var errorAlert2 = {
                            errorInfo: "noWithdraw"
                        }
                        response.write(JSON.stringify(errorAlert2));
                        return;
                    }
                }
            }
            if (option.api == 'validateTax') {
                // 从CS接受[子公司ID]和[税码ID]
                var subsValue = option.subsValue;
                if (subsValue){
                    var taxCodeValArr = option.taxCodeValArr;
                    // 如果选择的是"免税",则不需要判断条件
                    if (taxCodeValArr == -8||taxCodeValArr == ""){
                        var ifCntyFitC = {
                            "cntyInfo": "isFitCnty",
                        }
                        response.write(JSON.stringify(ifCntyFitC));
                        return;
                    }
                    // 通过保存检索,查找对应[子公司]对应的[地区]
                    var subsCnty = srchCountry(subsValue).countryNm;
                    log.audit("子公司国家地区:", subsCnty);
                    // 如果子公司是美国公司,直接返回
                    if (subsCnty == "US") {
                        var ifUSA = {
                            "cntyInfo": "isUSA"
                        }
                        response.write(JSON.stringify(ifUSA));
                        return;
                    }
                    // 如果不是美国公司,根据[税码]去查找所有[国家地区]
                    var srchTaxRst = srchCountryByTax(taxCodeValArr).taxCnty;
                    log.audit("税码国家地区:",srchTaxRst);
                    if (subsCnty == srchTaxRst) {
                        // 如果税码对应的国家地区都一致,则判断通过
                        var ifCntyFitA = {
                            "cntyInfo": "isFitCnty",
                        }
                        response.write(JSON.stringify(ifCntyFitA));
                        return;
                    } else {
                        // 如果税码对应的国家地区不一致,则判断不通过
                        var ifCntyFitB = {
                            "cntyInfo": "notFitCnty",
                        }
                        response.write(JSON.stringify(ifCntyFitB));
                        return;
                    }
                }else{
                    // 如果税码对应的国家地区不一致,则判断不通过
                    var ifCntyFitE = {
                        "cntyInfo": "notSubs",
                    }
                    response.write(JSON.stringify(ifCntyFitE));
                    return;
                }
            }
            if (option.api == 'itAsset'){
                log.audit("itAss", "itAss");
                var goodsObj = option.goodsObj;
                var adjRst = adjItAssetById(goodsObj);
                if (adjRst==false){
                    var adjRst = {
                        "errorInfo": "chkItAsset"
                    }
                    response.write(JSON.stringify(adjRst));
                    return;
                }
            }
        }


        /**
         * 检索所有【子公司】对应的【税码】
         * @param {Object} options
         * @param {Array} options.poNum
         * @return {Object}
         */
        function srchAllTaxSubs(subsId) {
            var salestaxitemSearchObj = search.create({
                type: "salestaxitem",
                filters:
                    [
                        ["subsidiary", "anyof", subsId]
                    ],
                columns:
                    [
                        search.createColumn({
                            name: "name",
                            sort: search.Sort.ASC,
                            label: "名称"
                        }),
                        search.createColumn({name: "subsidiary", label: "子公司"}),
                        search.createColumn({name: "internalid", label: "内部 ID"})
                    ]
            });
            var srchRs = getAllResults(salestaxitemSearchObj);
            // console.log("srchResultA:"+srchRs);
            var idArr = [];
            var subsArr = [];
            for (var i = 0; i < srchRs.length; i++) {
                var intlId = srchRs[i].getValue({name: "internalid", label: "内部 ID"});
                var intlSubS = srchRs[i].getValue({name: "subsidiary", label: "子公司"});
                idArr.push(intlId);
                subsArr.push(intlSubS);
            }
            var taxSubsObj = {
                idArr: idArr,
                subsArr: subsArr,
            }
            return taxSubsObj;
        }

        /**
         * 检索【子公司】对应的【国家/地区】
         * @param {Object} options
         * @param {Array} options.poNum
         * @return {Object}
         */
        function srchCountry(subsId) {
            var subsidiarySearchObj = search.create({
                type: "subsidiary",
                filters:
                    [
                        ["internalid", "anyof", subsId]
                    ],
                columns:
                    [
                        search.createColumn({name: "country", label: "国家/地区"})
                    ]
            });
            var srchRs = getAllResults(subsidiarySearchObj);
            var taxSubsObjA = {
                countryNm: srchRs[0].getValue({name: "country", label: "国家/地区"})
            }
            return taxSubsObjA;
        }

        /**
         * 检索所有【税码】对应的【国家/地区】
         * @param {Object} options
         * @param {Array} options.poNum
         * @return {Object}
         */
        function srchCountryByTax(taxId) {
            var salestaxitemSearchObj = search.create({
                type: "salestaxitem",
                filters:
                    [
                        ["internalidnumber", "equalto", taxId]
                    ],
                columns:
                    [
                        search.createColumn({
                            name: "name",
                            sort: search.Sort.ASC,
                            label: "名称"
                        }),
                        search.createColumn({name: "itemid", label: "项目 ID"}),
                        search.createColumn({name: "rate", label: "税率"}),
                        search.createColumn({name: "country", label: "国家/地区"}),
                        search.createColumn({name: "internalid", label: "内部 ID"})
                    ]
            });
            var srchRs = getAllResults(salestaxitemSearchObj);
            // var intIdArr = [];
            // var cntyArr = [];
            // for (var i = 0; i < srchRs.length; i++) {
            //     var intlId = srchRs[i].getValue({name: "internalid", label: "内部 ID"});
            //     var intlCnty = srchRs[i].getValue({name: "country", label: "国家/地区"});
            //     intIdArr.push(intlId);
            //     cntyArr.push(intlCnty);
            // }
            // var taxSubsObjB = {
            //     'intIdArr': intIdArr,
            //     'cntyArr': cntyArr,
            // }
            var taxSubsObjB = {
                taxCnty: srchRs[0].getValue({name: "country", label: "国家/地区"})
            }
            return taxSubsObjB;
        }


        /**
         * 根据【用户ID】检查【是否代提】勾选情况
         * @param {Object} options
         * @param {Array} options.poNum
         * @return {Object}
         */
        function srchIfWithdaw(curUserId) {
            var employeeSearchObj = search.create({
                type: "employee",
                filters:
                    [
                        ["internalid", "anyof", curUserId]
                    ],
                columns:
                    [
                        search.createColumn({
                            name: "entityid",
                            sort: search.Sort.ASC,
                            label: "名称"
                        }),
                        search.createColumn({name: "custentity_swc_allow_nominee", label: "是否代提"})
                    ]
            });
            var srchRs = getAllResults(employeeSearchObj);
            // console.log("srchResultA:"+srchRs);
            var ifWithdrawObj = {
                'ifWithdraw': srchRs[0].getValue({name: "custentity_swc_allow_nominee", label: "是否代提"})
            }
            return ifWithdrawObj;
        }

        /**
         * 检索所有【货品id】对应的【采购订单IT资产分类校验】勾选情况
         * @param {Object} options
         * @param {Array} options.poNum
         * @return {Object}
         */
        function adjItAssetById(goodsObj) {
            var serviceitemSearchObj = search.create({
                type: "serviceitem",
                filters:
                    [
                        ["type","anyof","Service"]
                    ],
                columns:
                    [
                        search.createColumn({name: "internalid", label: "内部 ID"}),
                        search.createColumn({name: "custitem_swc_asset_flag", label: "采购申请IT资产分类校验"})
                    ]
            });
            var srchRs = getAllResults(serviceitemSearchObj);
            for (var i = 0; i < srchRs.length; i++) {
                var goodsIdRst = srchRs[i].getValue({name: "internalid", label: "内部 ID"});
                var assetFlag = srchRs[i].getValue({name: "custitem_swc_asset_flag", label: "采购申请IT资产分类校验"});
                log.audit("勾选情况",assetFlag);
                if (goodsObj[goodsIdRst]&&assetFlag){
                    log.audit("对应id",goodsObj[goodsIdRst]["goodsId"]);
                    log.audit("字段填写情况",goodsObj[goodsIdRst]["expenseType"]);
                   if (!goodsObj[goodsIdRst]["expenseType"]){
                       return false;
                   }
                }
            }
            return true;
        }



        // 通用检索方法，放在最后，使用需要引用【N/search】模块
        function getAllResults(mySearch) {
            var resultSet = mySearch.run();
            var resultArr = [];
            var start = 0;
            var step = 1000;
            var results = resultSet.getRange({start: start, end: step});
            while (results && results.length > 0) {
                resultArr = resultArr.concat(results);
                start = Number(start) + Number(step);
                results = resultSet.getRange({start: start, end: Number(start) + Number(step)});
            }
            return resultArr;

        }

        /**
         * 生成供应商预付款表
         * @param recData,salesOrdId
         */
        function crtPrePayForm(recData) {
            // 使用record.create创建【供应商预付款】单据
            var prePayRec = record.create({
                type: record.Type.VENDOR_PREPAYMENT,
                isDynamic: true,
            });
            // 提取【付款人（供应商ID）】
            prePayRec.setValue({
                fieldId: "entity",
                value: recData.entity
            });
            // 提取【子公司ID】
            prePayRec.setValue({
                fieldId: "subsidiary",
                value: recData.subsidiary
            });
            // 提取【采购订单ID】
            prePayRec.setValue({
                fieldId: "purchaseorder",
                value: recData.purchaseorder,
            });
            // 提取【付款金额】
            prePayRec.setValue({
                fieldId: "payment",
                value: recData.payment
            });
            // 【货币】由系统自带
            // 【汇率】由系统自带
            // 提取【实际付款日期】如果为空则直接获取当前日期
            prePayRec.setValue({
                fieldId: "trandate",
                value: recData.trandate == "" || recData.trandate == null ? new Date() : recData.trandate
            });
            // 提取【账户ID】
            prePayRec.setValue({
                fieldId: "account",
                value: recData.account
            });
            // 提取【审批状态】
            prePayRec.setText({
                fieldId: "approvalstatus",
                text: recData.approvalstatus
            });
            // 提取【付款方式】
            prePayRec.setValue({
                fieldId: "custbody_swc_payway",
                value: recData.custbody_swc_payway
            });
            // 提取【预计付款日期】如果为空则直接获取当前日期
            prePayRec.setValue({
                fieldId: "custbody_swc_repaydate",
                value: recData.custbody_swc_repaydate == "" || recData.custbody_swc_repaydate == null ?
                    new Date() : recData.custbody_swc_repaydate
            });
            // 提取【部门】
            prePayRec.setValue({
                fieldId: "department",
                value: recData.department
            });
            // 保存【供应商预付款】，忽略必填，启用【sourcing】便于带出【货币】和【汇率】
            try {
                var save = prePayRec.save({
                    enableSourcing: true,
                    ignoreMandatoryFields: true
                });
            }
                // 如果保存失败则输出【错误信息】
            catch (e) {
                log.audit({title: '保存失败', details: e.message});
            }
            return save
        }

        return {onRequest}
    });
