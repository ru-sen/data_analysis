/**
 * @NApiVersion 2.x
 * @NScriptType ClientScript
 * @NModuleScope SameAccount
 */
define(['N/search', 'N/runtime', 'N/currentRecord', 'N/record', 'N/ui/dialog', 'N/url', 'N/https', 'N/currency','../../common/SWC_Translate'],

    function (search, runtime, currentRecord, record, dialog, url, https, currency,translateUtil) {

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
         * Function to be executed when field is changed.
         *
         * @param {Object} scriptContext
         * @param {Record} scriptContext.currentRecord - Current form record
         * @param {string} scriptContext.sublistId - Sublist name
         * @param {string} scriptContext.fieldId - Field name
         * @param {number} scriptContext.lineNum - Line number. Will be undefined if not a sublist or matrix field
         * @param {number} scriptContext.columnNum - Line number. Will be undefined if not a matrix field
         *
         * @since 2015.2
         */
        function fieldChanged(scriptContext) {
            debugger;
            var curRec = scriptContext.currentRecord;
          var sublistName = scriptContext.sublistId;
          if (sublistName == "recmachcustrecord_prs_field" && scriptContext.fieldId == "custrecord_prs_budget_department") {
            var subId = curRec.getValue({
    	    fieldId: "custrecord_pr_sub"
    	});
          if (subId) {
            curRec.setCurrentSublistValue({
            			sublistId: sublistName,
            			fieldId: "custrecord_prs_sub",
            			value: subId
                     })
            } else {
              alert("请输入付款主体");
            }
          }
           
            var money = curRec.getValue({
                fieldId: 'custrecord_pr_amount'
            });
            if (scriptContext.sublistId == 'recmachcustrecord_prs_field' && (scriptContext.fieldId == 'custrecord_prs_taxcode' || scriptContext.fieldId == 'custrecord_prs_price' || scriptContext.fieldId == 'custrecord_prs_quantity')) {
                // 获取税码
                var taxValue = curRec.getCurrentSublistValue({
                    sublistId: 'recmachcustrecord_prs_field',
                    fieldId: 'custrecord_prs_taxcode'
                });
                // 获取单价
                var priceValue = curRec.getCurrentSublistValue({
                    sublistId: 'recmachcustrecord_prs_field',
                    fieldId: 'custrecord_prs_price'
                });
                if (!priceValue) {
                    priceValue = 0;
                }
                // 获取数量
                var quantityValue = curRec.getCurrentSublistValue({
                    sublistId: 'recmachcustrecord_prs_field',
                    fieldId: 'custrecord_prs_quantity'
                });
                if (!quantityValue) {
                    quantityValue = 0;
                }
                var decimalTax = 0;
                if (!taxValue || !priceValue || !quantityValue) {
                    decimalTax = 0;
                } else {
                    // 将数据传递到SL便于处理【传递表单ID】
                    var urlObj = url.resolveScript({
                        scriptId: "customscript_swc_sl_crtpo",
                        deploymentId: "customdeploy_swc_sl_crtpo_d",
                        // returnExternalUrl:true,
                        // params: {}
                    });
                    // 创建一个对象，将想要传递的数据放入
                    var dataObj = {
                        'api': 'fieldChanged',
                        taxValue: taxValue,
                        priceValue: priceValue,
                        quantityValue: quantityValue
                    }
                    // 从SL获取搜索结果
                    var srchPoResult = https.post({
                        url: urlObj,
                        body: {"option": JSON.stringify(dataObj)}
                    }).body;
                    decimalTax = JSON.parse(srchPoResult).decimalTax;
                }

                // 计算税额
                var taxCount = priceValue * decimalTax;
                // 将税额赋值
                var taxCountValue = curRec.setCurrentSublistValue({
                    sublistId: 'recmachcustrecord_prs_field',
                    fieldId: 'custrecord_prs_taxrate',
                    value: taxCount,
                    ignoreFieldChange: true
                });
                // 计算明细金额（明细采购申请数量*单价+税额=明细金额）
                var detailAmount = quantityValue * priceValue + taxCount;
                // 将明细金额赋值
                var detailAmountValue = curRec.setCurrentSublistValue({
                    sublistId: 'recmachcustrecord_prs_field',
                    fieldId: 'custrecord_prs_totalamount',
                    value: detailAmount,
                    ignoreFieldChange: true
                });
            }
            if (scriptContext.fieldId == 'custrecord_pr_withdraw') {
                // 获取【需求者】字段id
                var buyerId = curRec.getValue({
                    fieldId:'custrecord_pr_buyer'
                });
                // 获取当前用户内部id
                var curUserId = runtime.getCurrentUser().id;
                // 将当前用户ID传到SL方便处理
                // 将数据传递到SL便于处理【传递表单ID】
                var urlObj = url.resolveScript({
                    scriptId: "customscript_swc_sl_crtpo",
                    deploymentId: "customdeploy_swc_sl_crtpo_d",
                });
                // 创建一个对象，将想要传递的数据放入
                var dataObj = {
                    'api': 'ifChecked',
                    'curUserId': curUserId,
                    'buyerId':buyerId
                }
                // 将对象提交到SL，并从SL获取返回数据
                var srchPoResult = https.post({
                    url: urlObj,
                    body: {"option": JSON.stringify(dataObj)}
                }).body;
                if (srchPoResult) {
                    if (JSON.parse(srchPoResult).errorInfo == "noPermission") {
                        dialog.alert({
                            title: translateUtil.translate('提示'),
                            message: translateUtil.translate('没有代提权限')
                        });
                        curRec.setValue({
                            fieldId: 'custrecord_pr_withdraw',
                            value: false,
                            ignoreFieldChange: true
                        });
                        return;
                    }
                    if (JSON.parse(srchPoResult).errorInfo == "noWithdraw") {
                        dialog.alert({
                            title: translateUtil.translate('提示'),
                            message: translateUtil.translate('不可以代提该需求者')
                        });
                        curRec.setValue({
                            fieldId: 'custrecord_pr_withdraw',
                            value: false,
                            ignoreFieldChange: true
                        });
                        return;
                    }
                }

            }
            // 如果【币种】字段改变且【预估金额合计】有值时,执行判断
            if (scriptContext.fieldId == 'custrecord_pr_currency' && money) {
                // 获取[币种]字段
                var currencyA = curRec.getText({
                    fieldId: 'custrecord_pr_currency'
                });
                // 如果【总和】有值的情况下,将[预估金额]转换为[美元]数量
                if (currencyA) {
                    // 计算汇率并转换为美元
                    var rate = currency.exchangeRate({
                        source: currencyA,
                        target: 'USD',
                        date: new Date()
                    });
                    var usdAmount = Number(money * rate).toFixed(2);
                    // 将转化后的值放入【预估金额合计USD】字段中
                    curRec.setValue({
                        fieldId: 'custrecord_pr_amount_usd',
                        value: usdAmount
                    });
                    return;
                }
            }
        }

        /**
         * Function to be executed when field is slaved.
         *
         * @param {Object} scriptContext
         * @param {Record} scriptContext.currentRecord - Current form record
         * @param {string} scriptContext.sublistId - Sublist name
         * @param {string} scriptContext.fieldId - Field name
         *
         * @since 2015.2
         */
        function postSourcing(scriptContext) {

        }

        /**
         * Function to be executed after sublist is inserted, removed, or edited.
         *
         * @param {Object} scriptContext
         * @param {Record} scriptContext.currentRecord - Current form record
         * @param {string} scriptContext.sublistId - Sublist name
         *
         * @since 2015.2
         */
        function sublistChanged(scriptContext) {
            // 获取当前表单
            var curRec = scriptContext.currentRecord;
            // 获取子列表行数
            var subLineCount = curRec.getLineCount({
                sublistId: 'recmachcustrecord_prs_field'
            });
            var amountSum = 0;
            var expenseTypeArr = [];
            var goodsIdArr = [];
            // 遍历子列表 获取所有的【明细金额】
            var obj = {};
            for (var i = 0; i < subLineCount; i++) {
                var obj1 = {};
                // 获取【明细金额】
                var detailamount = curRec.getSublistValue({
                    sublistId: 'recmachcustrecord_prs_field',
                    fieldId: 'custrecord_prs_totalamount',
                    line: i
                });
                // +++++++++++++djm+2023.3.22 获取[资产分类]+++++++++
                var expenseType = curRec.getSublistValue({
                    sublistId: 'recmachcustrecord_prs_field',
                    fieldId: 'custrecord_prs_feishu_assetit',
                    line: i
                });
                // djm+2023.3.22 获取[货品id]
                var goodsId = curRec.getSublistValue({
                    sublistId: 'recmachcustrecord_prs_field',
                    fieldId: 'custrecord_prs_item',
                    line: i
                });
                obj1['goodsId'] = goodsId;
                obj1['expenseType'] = expenseType;
                obj[goodsId] = obj1;
                // {'h货品id':{’goodsId‘：子列表货品id,'expenseType'：资产分类}}
                // ++++++++++++++获取结束+++++++++++++++++
                // 将【明细金额】数字累加
                amountSum += Number(detailamount);
            }
            // 将总和赋值到字段上
            curRec.setValue({
                fieldId: 'custrecord_pr_amount',
                value: amountSum
            });
            // ++++++++++++++++++djm+2023.3.22处理新增数据++++++++++++++++++++++++
            // log.audit("子列表行内情况",obj1);
            // log.audit("子列表信息情况",obj);
            // // 将数据传递到SL便于处理【传递表单ID】
            // var urlObj = url.resolveScript({
            //     scriptId: "customscript_swc_sl_crtpo",
            //     deploymentId: "customdeploy_swc_sl_crtpo_d",
            // });
            // // 创建一个对象，将想要传递的数据放入
            // var dataObj = {
            //     'api': 'itAsset',
            //     'goodsObj': obj,
            // }
            // // 将对象提交到SL，并从SL获取返回数据
            // var srchPoResult = https.post({
            //     url: urlObj,
            //     body: {"option": JSON.stringify(dataObj)}
            // }).body;
            // if (srchPoResult) {
            //     if (JSON.parse(srchPoResult).errorInfo == "chkItAsset") {
            //         alert(translateUtil.translate('请选择【IT 资产分类】！'));
            //         var curLineNum = curRec.getCurrentSublistIndex({
            //             sublistId: "recmachcustrecord_prs_field"
            //         });
            //         curRec.removeLine({
            //             sublistId: 'recmachcustrecord_prs_field',
            //             line: curLineNum
            //         })
            //         // curRec.setCurrentSublistValue({
            //         //     sublistId: 'recmachcustrecord_prs_field',
            //         //     fieldId: 'custrecord_prs_item',
            //         //     value: " "
            //         // });
            //         return;
            //     }
            // }
            // ++++++++++++++++++处理结束+++++++++++++++++++++++++++++++++




            // ========================djm+2023.3.21预估金额合计（usd）字段新增=========================
            // 获取[币种]字段
            var currencyA = curRec.getText({
                fieldId: 'custrecord_pr_currency'
            });
            // 如果【总和】有值的情况下,将[预估金额]转换为[美元]数量
            if (amountSum && currencyA) {
                // 计算汇率并转换为美元
                var rate = currency.exchangeRate({
                    source: currencyA,
                    target: 'USD',
                    date: new Date()
                });
                var usdAmount = Number(amountSum * rate).toFixed(2);
                // 将转化后的值放入【预估金额合计USD】字段中
                curRec.setValue({
                    fieldId: 'custrecord_pr_amount_usd',
                    value: usdAmount
                });
                return;
            }
            // else if (amountSum && !currencyA) {
            //     dialog.alert({
            //         title: translateUtil.translate('提示'),
            //         message: '请填写币种字段！'
            //     });
            //     // 将总和赋值到字段上
            //     curRec.setValue({
            //         fieldId: 'custrecord_pr_amount_usd',
            //         value: amountSum
            //     });
            //     return;
            // }
            // =====================================================================================
            return;
        }

        /**
         * Function to be executed after line is selected.
         *
         * @param {Object} scriptContext
         * @param {Record} scriptContext.currentRecord - Current form record
         * @param {string} scriptContext.sublistId - Sublist name
         *
         * @since 2015.2
         */
        function lineInit(scriptContext) {

        }

        /**
         * Validation function to be executed when field is changed.
         *
         * @param {Object} scriptContext
         * @param {Record} scriptContext.currentRecord - Current form record
         * @param {string} scriptContext.sublistId - Sublist name
         * @param {string} scriptContext.fieldId - Field name
         * @param {number} scriptContext.lineNum - Line number. Will be undefined if not a sublist or matrix field
         * @param {number} scriptContext.columnNum - Line number. Will be undefined if not a matrix field
         *
         * @returns {boolean} Return true if field is valid
         *
         * @since 2015.2
         */
        function validateField(scriptContext) {
            var curRec = scriptContext.currentRecord;
            // ======================停用判断，不知道以后是否会有需求变更============================
            if (scriptContext.sublistId == 'recmachcustrecord_prs_field' && scriptContext.fieldId == 'custrecord_prs_taxcode') {
                // 首先获取[子公司]字段ID
                var subsValue = curRec.getValue({
                    fieldId: "custrecord_pr_sub"
                });
                console.log(subsValue);
                // 获取税码
                var taxValueA = curRec.getCurrentSublistValue({
                    sublistId: 'recmachcustrecord_prs_field',
                    fieldId: 'custrecord_prs_taxcode'
                });
                console.log(taxValueA);
                var urlObj = url.resolveScript({
                    scriptId: "customscript_swc_sl_crtpo",
                    deploymentId: "customdeploy_swc_sl_crtpo_d"
                });
                // 创建一个对象，将想要传递的数据放入
                var dataObj = {
                    'api': 'validateTax',
                    'subsValue': subsValue,
                    'taxCodeValArr': taxValueA
                }
                // 从SL获取数据
                var srchTaxResult = https.post({
                    url: urlObj,
                    body: {"option": JSON.stringify(dataObj)}
                }).body;
                if (srchTaxResult){
                    if (JSON.parse(srchTaxResult).cntyInfo == "notSubs"){
                        dialog.alert({
                            title: translateUtil.translate('提示'),
                            message: '子公司不存在' // 已停用
                        });
                        return true;
                    }
                    // 接收SL数据,如果是"isUSA"代表是美国公司,子列表不需要税码
                    if (JSON.parse(srchTaxResult).cntyInfo == "isUSA" && taxValueA) {
                        curRec.setCurrentSublistValue({
                            sublistId: "recmachcustrecord_prs_field",
                            fieldId: "custrecord_prs_taxcode",
                            value: -8,
                            ignoreFieldChange: true
                        });
                        dialog.alert({
                            title: translateUtil.translate('提示'),
                            message: '美国公司不需要税码' // 已停用
                        });
                        return true;
                    }
                    if (JSON.parse(srchTaxResult).cntyInfo == "notFitCnty") {
                        dialog.alert({
                            title: translateUtil.translate('提示'),
                            message: '税码不匹配' // 已停用
                        });
                        return false;
                    }
                    if (JSON.parse(srchTaxResult).cntyInfo == "isFitCnty") {
                        return true;
                    } else {
                        return false;
                    }
                }

            }
            // =======================================停用判断===========================================
            else {
                return true;
            }
        }

        /**
         * Validation function to be executed when sublist line is committed.
         *
         * @param {Object} scriptContext
         * @param {Record} scriptContext.currentRecord - Current form record
         * @param {string} scriptContext.sublistId - Sublist name
         *
         * @returns {boolean} Return true if sublist line is valid
         *
         * @since 2015.2
         */
        function validateLine(scriptContext) {
            // 获取当前表单
            var curRec = scriptContext.currentRecord;
            // 遍历子列表 获取所有的【明细金额】
            var obj = {};
            // for (var i = 0; i < subLineCount; i++) {
            var obj1 = {};
            // +++++++++++++djm+2023.3.22 获取[资产分类]+++++++++
            var expenseType = curRec.getCurrentSublistValue({
                sublistId: 'recmachcustrecord_prs_field',
                fieldId: 'custrecord_prs_feishu_assetit',
            });
            // djm+2023.3.22 获取[货品id]
            var goodsId = curRec.getCurrentSublistValue({
                sublistId: 'recmachcustrecord_prs_field',
                fieldId: 'custrecord_prs_item',
            });
            obj1['goodsId'] = goodsId;
            obj1['expenseType'] = expenseType;
            obj[goodsId] = obj1;
            // {'h货品id':{’goodsId‘：子列表货品id,'expenseType'：资产分类}}
            // ++++++++++++++获取结束+++++++++++++++++
            // }
            // ++++++++++++++++++djm+2023.3.22处理新增数据++++++++++++++++++++++++
            // 将数据传递到SL便于处理【传递表单ID】
            var urlObj = url.resolveScript({
                scriptId: "customscript_swc_sl_crtpo",
                deploymentId: "customdeploy_swc_sl_crtpo_d",
            });
            // 创建一个对象，将想要传递的数据放入
            var dataObj = {
                'api': 'itAsset',
                'goodsObj': obj,
            }
            // 将对象提交到SL，并从SL获取返回数据
            var srchPoResult = https.post({
                url: urlObj,
                body: {"option": JSON.stringify(dataObj)}
            }).body;
            if (srchPoResult) {
                if (JSON.parse(srchPoResult).errorInfo == "chkItAsset") {
                    alert(translateUtil.translate('ERR_IT_ASSET'));
                    // curRec.setCurrentSublistValue({
                    //     sublistId: 'recmachcustrecord_prs_field',
                    //     fieldId: 'custrecord_prs_item',
                    //     value: " "
                    // });
                    return false;
                }
            }else {
                return true;
            }
            // ++++++++++++++++++处理结束+++++++++++++++++++++++++++++++++
        }

        /**
         * Validation function to be executed when sublist line is inserted.
         *
         * @param {Object} scriptContext
         * @param {Record} scriptContext.currentRecord - Current form record
         * @param {string} scriptContext.sublistId - Sublist name
         *
         * @returns {boolean} Return true if sublist line is valid
         *
         * @since 2015.2
         */
        function validateInsert(scriptContext) {

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
            // 获取当前表单
            var curRec = scriptContext.currentRecord;
            // 获取[首选供应商]字段
            var vendorFirst = curRec.getValue({
                fieldId: 'custrecord_pr_vendor_first'
            });
            // 获取[次选选供应商]字段
            var vendorSecond = curRec.getValue({
                fieldId: 'custrecord_pr_vendor_sec'
            });
            // 获取[次选供应商理由]字段
            var vendorSecondMemo = curRec.getValue({
                fieldId: 'custrecord_pr_vendor_memo2'
            });
            // 获取[末选供应商]字段
            var vendorLast = curRec.getValue({
                fieldId: 'custrecord_pr_vendor_third'
            });
            // 获取[末选供应商理由]字段
            var vendorLastMemo = curRec.getValue({
                fieldId: 'custrecord_pr_vendor_memo3'
            });
            // 获取[预估金额合计]字段
            var amountSum = curRec.getValue({
                fieldId: 'custrecord_pr_amount'
            });
            // 获取[币种]字段
            var currencyA = curRec.getText({
                fieldId: 'custrecord_pr_currency'
            });
            // 获取[单一供应商理由]字段
            var oneVendor = curRec.getValue({
                fieldId: 'custrecord_pr_ven_single_rationale'
            });
            if (!vendorFirst) {
                dialog.alert({
                    title: translateUtil.translate('提示'),
                    message: translateUtil.translate('ERR_PRIMARY_VENDOR')
                });
                return false;
            }
            // 如果存在币种,则校验
            if (currencyA&&!oneVendor) {
                // 计算汇率并转换为美元
                var rate = currency.exchangeRate({
                    source: currencyA,
                    target: 'USD',
                    date: new Date()
                });
                // 将[预估金额]转换为[美元]数量
                var usdAmount = Number(amountSum * rate).toFixed(2);
                if (vendorFirst && (usdAmount >= 20000 && usdAmount < 100000)) {
                    // 如果[次选供应商]未填写,则需要提示用户
                    if (!vendorSecond) {
                        dialog.alert({
                            title: translateUtil.translate('提示'),
                            message: translateUtil.translate('ERR_USD_AMOUNT') + usdAmount + translateUtil.translate('ERR_ADOVE_20K')
                        });
                        return false;
                    }
                    // 如果[次选供应商]填写,但是[单一供应商]字段有值,需要提示清除[单一供应商字段]
                    if (vendorSecond && oneVendor) {
                        dialog.alert({
                            title: translateUtil.translate('提示'),
                            message: translateUtil.translate('ERR_VENDOR_SINGLE')
                        });
                        return false;
                    }
                    // 如果[次选供应商]填写,但是[次选供应商理由]没填写,需要提示填写[次选供应商理由]
                    if (vendorSecond && !vendorSecondMemo) {
                        dialog.alert({
                            title: translateUtil.translate('提示'),
                            message: translateUtil.translate('ERR_VENDOR2_MEMO')
                        });
                        return false;
                    }
                }
                if (vendorFirst && usdAmount >= 100000) {
                    if (!vendorSecond) {
                        dialog.alert({
                            title: translateUtil.translate('提示'),
                            message: translateUtil.translate('ERR_USD_AMOUNT') + usdAmount + translateUtil.translate('ERR_ADOVE_20K')
                        });
                        return false;
                    }
                    // 如果[次选供应商]填写,但是[单一供应商]字段有值,需要提示清除[单一供应商字段]
                    if (vendorSecond && oneVendor) {
                        dialog.alert({
                            title: translateUtil.translate('提示'),
                            message: translateUtil.translate('ERR_VENDOR_SINGLE')
                        });
                        return false;
                    }
                    // 如果[次选供应商]填写,但是[次选供应商理由]没填写,需要提示填写[次选供应商理由]
                    if (vendorSecond && !vendorSecondMemo) {
                        dialog.alert({
                            title: translateUtil.translate('提示'),
                            message: translateUtil.translate('ERR_VENDOR2_MEMO')
                        });
                        return false;
                    }
                    if (!vendorLast) {
                        dialog.alert({
                            title: translateUtil.translate('提示'),
                            message: translateUtil.translate('ERR_USD_AMOUNT') + usdAmount + translateUtil.translate('ERR_ADOVE_100K')
                        });
                        return false;
                    }
                    // 如果[末选供应商]填写,但是[单一供应商]字段有值,需要提示清除[单一供应商字段]
                    if (vendorLast && oneVendor) {
                        dialog.alert({
                            title: translateUtil.translate('提示'),
                            message: translateUtil.translate('ERR_VENDOR_SINGLE')
                        });
                        return false;
                    }
                    // 如果[末选供应商]填写,但是[末选供应商理由]没填写,需要提示填写[末选供应商理由]
                    if (vendorLast && !vendorLastMemo) {
                        dialog.alert({
                            title: translateUtil.translate('提示'),
                            message: translateUtil.translate('ERR_VENDOR3_MEMO')
                        });
                        return false;
                    }
                }
            }
            if (currencyA&&oneVendor){
                // 如果[次选供应商]填写,但是[单一供应商]字段有值,需要提示清除[单一供应商字段]
                if (vendorSecond && oneVendor) {
                    dialog.alert({
                        title: translateUtil.translate('提示'),
                        message: translateUtil.translate('ERR_VENDOR_SINGLE')
                    });
                    return false;
                }
                // 如果[末选供应商]填写,但是[单一供应商]字段有值,需要提示清除[单一供应商字段]
                if (vendorLast && oneVendor) {
                    dialog.alert({
                        title: translateUtil.translate('提示'),
                        message: translateUtil.translate('ERR_VENDOR_SINGLE')
                    });
                    return false;
                }
            }
            // ==================判断费用类别是否一致========================
            var expenseTypeArr = [];
            // 获取子列表行数
            var subLineCount = curRec.getLineCount({
                sublistId: 'recmachcustrecord_prs_field'
            });
            // 遍历子列表获取所有【费用类别】
            for (var i = 0; i < subLineCount; i++) {
                // 获取【费用类别】
                var expenseType = curRec.getSublistValue({
                    sublistId: 'recmachcustrecord_prs_field',
                    fieldId: 'custrecord_prs_expense_type',
                    line: i
                });
                // 添加到数组中
                expenseTypeArr.push(expenseType);
            }
            // // 如果数组存在（子列表有值）则开始判断
            // if (expenseTypeArr.length > 0) {
            //     for (var i = 0; i < expenseTypeArr.length; i++) {
            //         // 判断【费用类别】每一项是否和第一项相等
            //         if (expenseTypeArr[i] != expenseTypeArr[0]) {
            //             dialog.alert({
            //                 title: translateUtil.translate('提示'),
            //                 message: '【费用类别】不一致'
            //             });
            //             return;
            //         }
            //     }
            // }
            // 获取勾选情况
            var ifChecked = curRec.getValue({
                fieldId: 'custentity_swc_allow_nominee'
            });
            var ifCheckedA = curRec.getValue({
                fieldId: 'custrecord_pr_withdraw'
            });
            if (!ifChecked) {
                // 获取需求者
                var buyer = curRec.getValue({
                    fieldId: 'custrecord_pr_buyer'
                });
                // console.log("需求者为：" + buyer);
                // 获取当前用户ID
                var user = runtime.getCurrentUser();
                // 新添加情况2023.3.23当是否代提字段未勾选且需求者不等于当前角色时
                if (buyer != user.id && !ifCheckedA) {
                    dialog.alert({
                        title: translateUtil.translate('提示'),
                        message: translateUtil.translate('ERR_CHK_APPLIER')
                    });
                    return false;
                } else {
                    return true;
                }
            } else {
                // crtPo();
                // crtPoBySl();
                return true;
            }

        }

        /**
         * 创建采购订单
         */
        // ===========================停用方法（736行）============================
        function crtPo() {
            debugger;
            // 首先获取当前表单
            var curRec = currentRecord.get();
            // 获取【首选供应商】字段
            var vendor = curRec.getValue({
                fieldId: 'custrecord_pr_vendor_first'
            });
            // 已停用
            if (!vendor) {
                dialog.alert({
                    title: translateUtil.translate('提示'),
                    message: '【供应商】不能为空，请核对【供应商】' // 已停用
                });
                return;
            }
            // 获取【需求者】字段
            var employee = curRec.getValue({
                fieldId: 'custrecord_pr_buyer'
            });
            if (!employee) {
                dialog.alert({
                    title: translateUtil.translate('提示'),
                    message: '【需求者】不能为空，请核对【需求者】' // 已停用
                });
                return;
            }
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
                if (!item) {
                    dialog.alert({
                        title: translateUtil.translate('提示'),
                        message: '第' + i + '行【货品】不能为空，请核对【货品】' // 已停用
                    });
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
            // 建立子列表数据
            var sublistObj = {
                'itemArr': itemArr,
                'quantityArr': quantityArr,
                'priceArr': priceArr,
                'taxCodeArr': taxCodeArr,
                'totalAmountArr': totalAmountArr,
                'taxCountArr': taxCountArr
            };
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
                // 美国公司没有税码
                if (currency != 5) {
                    // 设置【税码】
                    var taxCode1 = newPoRec.setCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'taxcode',
                        value: sublistObj.taxCodeArr[i]
                    });
                }
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
        }
        // ===========================停用方法====================================

        /**
         * 创建采购订单(调用SL)
         */
        // ===========================停用方法（737行）============================
        function crtPoBySl() {
            debugger;
            // 将数据传递到SL便于处理【传递表单ID】
            var urlObj = url.resolveScript({
                scriptId: "customscript_swc_sl_crtpo",
                deploymentId: "customdeploy_swc_sl_crtpo_d",
                // returnExternalUrl:true,
                // params: {}
            });
            // 创建一个对象，将想要传递的数据放入
            var dataObj = {
                'api': 'poData',
                'pay_form_id': currentRecord.get().id
            }
            // 从SL获取搜索结果
            var srchPoResult = https.post({
                url: urlObj,
                body: {"option": JSON.stringify(dataObj)}
            }).body;
            // 如果返回的是”noVenodr“，代表【供应商】为空，需要提示用户（已停用）
            if (JSON.parse(srchPoResult).errorInfo == "noVenodr") {
                dialog.alert({
                    title: translateUtil.translate('提示'),
                    message: '【供应商】不能为空，请核对【供应商】' // 已停用
                });
                return;
            }
            // 如果返回的是”noItem“，代表对应【子列表】的【货品】不存在，需要提示用户（已停用）
            if (JSON.parse(srchPoResult).errorInfo == "noItem") {
                dialog.alert({
                    title: translateUtil.translate('提示'),
                    message: '子列表的第' + JSON.parse(srchPoResult).line + '行货品不存在，请核对【货品】是否填写正确'
                });
                return;
            }
            // 如果返回的是”noTaxCode“,代表对应的【税码】不匹配，需要提示用户（已停用）
            if (JSON.parse(srchPoResult).errorInfo == "noTaxCode") {
                dialog.alert({
                    title: translateUtil.translate('提示'),
                    message: '没有找到与【子公司】对应的【税码】，请核对【税码】是否填写正确' // 已停用
                });
                return;
            }
            // 如果返回的是”successSavedRec“，代表成功保存订单，刷新页面
            if (JSON.parse(srchPoResult).errorInfo == "successSavedRec") {
                window.location.reload();
            }
        }
        // ===========================停用方法====================================

        return {
            pageInit: pageInit,
            fieldChanged: fieldChanged,
            // postSourcing: postSourcing,
            sublistChanged: sublistChanged,
            // lineInit: lineInit,
            validateField: validateField,
            validateLine: validateLine,
            // validateInsert: validateInsert,
            // validateDelete: validateDelete,
            saveRecord: saveRecord
        };

    });
