/**
 * @NApiVersion 2.1
 * @NModuleScope public
 * @description 员工中心应付账单
 * @author chen dong xu
 */
define(['N/record', 'N/search', './SWC_CONFIG_DATA'],

    function (record, search, SWC_CONFIG_DATA) {

        /**
         * 再次查询
         * @param filterJsonOption 查询条件 {'':'', ...}
         * @return {{unBillTotal: number, vendor: (string|*|string), price_quantity_total: number, subsidiary, unBilled: *[], rateTotal: number}}
         */
        function queryData(filterJsonOption) {

            // 查询采购订单
            var poData = searchData(filterJsonOption);
            // 查询未生成账单的数据
            var unBilled = searchSupplierBill(poData);

            var options = tidyUpData(unBilled);

            // log.audit({title:'再次查询',details: options});

            return options;
        }

        /**
         * 查询是否全部开票
         * @param filterJsonOption 查询条件 {'':'', ...}
         * @return {*[]|*}
         */
        function queryCheck(filterJsonOption) {
            // 查询采购订单
            var poData = searchData(filterJsonOption);
            if (poData.length > 0) {
                // 查询供应商账单申请
                var unBilled = searchSupplierBill(poData);
            } else {
                var unBilled = [];
            }

            return unBilled;
        }

        /**
         *
         * @param unBilled 未开票的数据 [{}, ...]
         * @return {{unBillTotal: number, vendor: (string|*|string), price_quantity_total: number, subsidiary, unBilled: *[], rateTotal: number}}
         */
        function tidyUpData(unBilled) {
            // log.audit({title: 'unBilled(未开票的数据)', details: unBilled});
            // 当付款方式为1 查询供应商信息
            var vendor_obj = '';
            if (unBilled[0].pay_way == '1') {
                // log.audit({title: '开始查询供应商信息', details: '111111111111'})
                vendor_obj = srchVendorInfo(unBilled[0].vendor);
                // log.audit({title: 'vendor_obj', details: vendor_obj});
            }

            // var decimalTax = 0;
            // var taxRate = {};
            //
            // if (unBilled[0].taxcode) {
            //     // 税率
            //     taxRate = search.lookupFields({
            //         type: search.Type.SALES_TAX_ITEM,
            //         id: unBilled[0].taxcode,
            //         columns: ['rate']
            //     });
            //     // 将税率转化成小数
            //     var str = taxRate.rate.replace("%", "");
            //     decimalTax = str / 100;
            // }


            // 获取到采购订单总金额
            var poRec = record.load({
                type: record.Type.PURCHASE_ORDER,
                id: unBilled[0].internalid
            });

            var totalPo = poRec.getValue({fieldId: 'total'});

            var department_body = poRec.getValue({fieldId: 'department'});


            // 所有行数据 已开票的总金额 合计
            var BillTotal = 0;
            // 所有行数据 付款总金额 合计
            var payTotal = 0;

            // 最后的查询结果 [{}, ...]
            var result = [];

            // 计算 金额 税额 总金额
            for (var i = 0; unBilled.length > 0 && i < unBilled.length; i++) {
                // log.audit({title: 'unBilled[i].itemBill_count', details: unBilled[i].itemBill_count});

                // 所有行数据 已开票的总金额 合计
                BillTotal += Number(unBilled[i].itemBill_count);

                // log.audit({title: 'BillTotal', details: BillTotal});

                if (unBilled[i].flag) {
                    // // 税率
                    // if (taxRate.rate) {
                    //     unBilled[i].taxrate = taxRate.rate;
                    // }

                    // // 金额
                    // unBilled[i].price_quantity = Number(unBilled[i].fxrate) * Number(unBilled[i].quantity);
                    // // 税额
                    // unBilled[i].price_tax = Number(unBilled[i].fxrate) * Number(unBilled[i].quantity) * Number(decimalTax);
                    // // 总金额
                    // unBilled[i].total_line = Number(unBilled[i].price_quantity) + Number(unBilled[i].price_tax);
                    // 付款总金额
                    // payTotal += unBilled[i].total_line;

                    result.push(unBilled[i]);
                }
            }

            var options = {
                'unBilled': result,
                'totalPo': totalPo,
                'BillTotal': BillTotal,
                'payTotal': payTotal,
                'vendor_obj': vendor_obj,
                'currency': unBilled[0].currency,
                'pay_body': unBilled[0].subsidiary,
                'vendor': unBilled[0].vendor,
                'department_line': unBilled[0].department,
                'department': department_body,
                'just_cause': unBilled[0].just_cause // 查询采购订单结果 正当理由赋值到页面事由描述中
            }

            // log.audit({title: '页面展示数据', details: options});

            return options;
        }

        /**
         * 查询数据 (员工中心应付账单采购订单查询cdx)
         * @param filterJsonOption 查询条件 {'poNum':'采购订单编号(文本)'}
         * @return {*[]} 结果集 [{}, ...]
         */
        function searchData(filterJsonOption) {

            var purchaseorderSearchObj = search.create({
                type: "purchaseorder",
                filters:
                    [
                        ["type", "anyof", "PurchOrd"],
                        "AND",
                        ["numbertext", "is", filterJsonOption.po_num],
                        "AND",
                        ["approvalstatus","anyof","2"],
                        "AND",
                        ["mainline", "is", "F"],
                        "AND",
                        ["shipping", "is", "F"],
                        "AND",
                        ["taxline", "is", "F"],
                        "AND",
                        ["cogs", "is", "F"],
                        "AND",
                        ["closed","is","F"],
                        // 2025-04-29 HC ADD 排除子公司id=1,15,8的PO
                        "AND",
                        ["subsidiary", "noneof", "1", "15", "8"],
                        // "AND",
                        // ["status","noneof","PurchOrd:H"]
                        // // 2025-05-26 HC ADD 排除已关闭的PO(1479)
                    ],
                columns:
                    [
                        search.createColumn({name: "internalid", label: "内部 ID"}),
                        search.createColumn({name: "tranid", label: "文档编号"}),
                        search.createColumn({
                            name: "internalid",
                            join: "vendor",
                            label: "内部 ID"
                        }),
                        search.createColumn({name: "subsidiarynohierarchy", label: "子公司（无层次结构）"}),
                        search.createColumn({name: "item", label: "货品"}),
                        search.createColumn({name: "quantity", label: "数量"}),
                        search.createColumn({name: "fxrate", label: "货品价格"}),
                        search.createColumn({name: "taxcode", label: "税项"}),
                        search.createColumn({name: "linesequencenumber", label: "行序号"}),
                        search.createColumn({name: "line", label: "行 Id"}),
                        search.createColumn({name: "debitfxamount", label: "金额（借记）（外币）"}),
                        search.createColumn({name: "department", label: "部门"}),
                        search.createColumn({name: "grossamount", label: "金额（总额）"}),
                        search.createColumn({name: "fxamount", label: "金额（外币）"}),
                        search.createColumn({name: "currency", label: "货币"}),
                        search.createColumn({
                            name: "internalid",
                            join: "CUSTCOL_SWC_JON_EMPLOYEE",
                            label: "内部 ID"
                        }),
                        search.createColumn({
                            name: "altname",
                            join: "vendor",
                            label: "名称"
                        }),
                        search.createColumn({name: "custbody_swc_justification", label: "正当理由"}),
                        search.createColumn({name: "line.cseg_swc_pro", label: "项目(日记账)"})

                    ]
            });

            var objArr = [];

            var allRes = getAllResultsOfSearch(purchaseorderSearchObj);

            for (var i = 0; allRes.length > 0 && i < allRes.length; i++) {
                var obj = {};
                obj.internalid = allRes[i].getValue({name: "internalid", label: "内部 ID"});
                obj.internalidTxt = allRes[i].getValue({name: "tranid", label: "文档编号"});
                obj.vendor = allRes[i].getValue({name: "internalid", join: "vendor", label: "内部 ID"});
                // obj.vendor_name = allRes[i].getValue({ name: "altname", join: "vendor", label: "名称"});

                obj.subsidiary = allRes[i].getValue({name: "subsidiarynohierarchy", label: "子公司（无层次结构）"});
                obj.item = allRes[i].getValue({name: "item", label: "货品"});
                obj.itemText = allRes[i].getText({name: "item", label: "货品"});
                obj.quantity = allRes[i].getValue({name: "quantity", label: "数量"});
                obj.fxrate = allRes[i].getValue({name: "fxrate", label: "货品价格"});

                obj.amount = Math.abs(allRes[i].getValue({name: "fxamount", label: "金额（外币）"}));
                obj.grossamount = allRes[i].getValue({name: "grossamount", label: "金额（总额）"});
                obj.currency = allRes[i].getValue({name: "currency", label: "货币"});
                obj.employee = allRes[i].getValue({name: "internalid", join: "CUSTCOL_SWC_JON_EMPLOYEE", label: "内部 ID"});

                obj.taxcode = allRes[i].getValue({name: "taxcode", label: "税项"});
                obj.taxcodeText = allRes[i].getText({name: "taxcode", label: "税项"});
                obj.linenum = allRes[i].getValue({name: "linesequencenumber", label: "行序号"});
                obj.lineId = allRes[i].getValue({name: "line", label: "行 Id"});
                obj.department = allRes[i].getValue({name: "department", label: "部门"});
                obj.just_cause = allRes[i].getValue({name: "custbody_swc_justification", label: "正当理由"});
                obj.pro = allRes[i].getValue({name: "line.cseg_swc_pro", label: "项目(日记账)"});

                // obj.departmentText = allRes[i].getText({name: "department", label: "部门"});

                obj.pay_way = filterJsonOption.pay_way;
                obj.key = obj.item + '_' + obj.quantity;
                obj.flag = true;
                obj.itemBill_count = 0;
                objArr.push(obj);
            }
             //log.audit({title: '采购订单数据', details: objArr});

            return objArr;
        }


        /**
         * 查询供应商账单申请 (供应商账单申请搜索_cdx)
         * @param poData 采购订单的查询结果 [{}, ...]
         * @return {*[]} 未生成供应商账单申请的数据 [{}, ...]
         */
        function searchSupplierBill(poData) {

            var customrecord_swc_account_payableSearchObj = search.create({
                type: "customrecord_swc_account_payable",
                filters:
                    [
                        ["custrecord_ap_number","anyof",poData[0].internalid]
                    ],
                columns:
                    [
                        // search.createColumn({
                        //     name: "custrecord_aps_quantity",
                        //     join: "CUSTRECORD_APS_FIELD",
                        //     label: "数量"
                        // }),
                        // search.createColumn({
                        //     name: "custrecord_aps_price",
                        //     join: "CUSTRECORD_APS_FIELD",
                        //     label: "价格"
                        // }),

                        search.createColumn({
                            name: "custrecord_aps_item",
                            join: "CUSTRECORD_APS_FIELD",
                            label: "货品"
                        }),
                        search.createColumn({
                            name: "custrecord_aps_totalamount",
                            join: "CUSTRECORD_APS_FIELD",
                            label: "总金额"
                        }),
                        search.createColumn({
                            name: "custrecord_aps_line_status",
                            join: "CUSTRECORD_APS_FIELD",
                            label: "审批状态"
                        }),
                        search.createColumn({
                            name: "custrecord_aps_department",
                            join: "CUSTRECORD_APS_FIELD",
                            label: "预算归属部门"
                        })
                    ]
            });

            var allRes = getAllResultsOfSearch(customrecord_swc_account_payableSearchObj);

            // 采购订单货品行数据
            for (var i = 0; poData.length > 0 && i < poData.length; i++) {
                // 多个供应商账单申请 已经生成的总金额
                var money_Count = 0;
                poData[i].un_bill_amount = Number(poData[i].amount);
                // 已经生成的供应商账单的数据
                for (var j = 0; allRes.length > 0 && j < allRes.length; j++) {
                    var item = allRes[j].getValue({name: "custrecord_aps_item", join: "CUSTRECORD_APS_FIELD", label: "货品"});
                    var amount_count = allRes[j].getValue({name: "custrecord_aps_totalamount", join: "CUSTRECORD_APS_FIELD", label: "总金额"});
                    var approval_status = allRes[j].getValue({name: "custrecord_aps_line_status", join: "CUSTRECORD_APS_FIELD", label: "审批状态"});

                    var department = allRes[j].getValue({name: "custrecord_aps_department", join: "CUSTRECORD_APS_FIELD", label: "预算归属部门"});

                    // log.audit({title: '供应商账单申请子表(审批状态)', details: approval_status});

                    if (poData[i].item == item && poData[i].department == department) {

                        // 已经生成的该货品 账单总金额
                        money_Count += Number(amount_count);
                        poData[i].itemBill_count = money_Count;

                        // 审批状态为失败或者驳回 算开票失败
                        // if (approval_status == SWC_CONFIG_DATA.configData().APPROVAL_STATUS || approval_status == SWC_CONFIG_DATA.configData().APPROVAL_STATUS_A) {
                               //log.audit({title: 'money_Count', details: money_Count});
                      //log.audit({title: 'poData[i].amount', details: poData[i].amount});
                        if (approval_status == SWC_CONFIG_DATA.configData().BILL_APPROVAL_STATUS_FS_APPROVAL_REJECT || approval_status == SWC_CONFIG_DATA.configData().BILL_APPROVAL_STATUS_FS_PUSH_FAILURE) {
                            money_Count -= Number(amount_count);
                            poData[i].itemBill_count = money_Count;
                        }

                        // 未开票的 总金额
                        poData[i].un_bill_amount = Number(poData[i].amount) - money_Count;

                        if (money_Count == poData[i].amount || poData[i].un_bill_amount < 0) {
                            poData[i].flag = false;
                        }

                    }




                }

            }

            log.audit({title: '处理后poData', details: poData})

            return poData;
        }

        /**
         * 获取所有保存检索结果
         * @param saveSearch 保存检索
         * @return 数据结果数组
         */
        function getAllResultsOfSearch(saveSearch) {
            var resultset = saveSearch.run();
            var start = 0;
            var step = 1000;
            var resultArr = [];
            var results = resultset.getRange({
                start: start,
                end: Number(start) + Number(step)
            });
            while (results && results.length > 0) {
                resultArr = resultArr.concat(results);
                start = Number(start) + Number(step);
                results = resultset.getRange({
                    start: start,
                    end: Number(start) + Number(step)
                });
            }
            return resultArr;
        }

        /**
         * 检索所有【中间表id】对应的【INVOICE NO.】
         * @param {Object} options
         * @param {Array} options.poNum
         * @return {Object}
         */
        function adjInvoiceNo(invoice_num) {
            var accountpayableSearchObj = search.create({
                type: "customrecord_swc_account_payable",
                filters:
                    [
                        ["custrecord_ap_invoiceno","is",invoice_num]
                    ],
                columns:
                    [
                        search.createColumn({name: "custrecord_ap_invoiceno", label: "invoice编号"}),
                        search.createColumn({name: "internalid", label: "内部 ID"})
                    ]
            });
            var srchRs = getAllResultsOfSearch(accountpayableSearchObj);

            if (srchRs.length > 0) {
                return true;
            } else {
                return false;
            }
        }

        // *##* djm新增检索方法
        /**
         * 检索所有【供应商id】对应的【供应商银行信息】
         * @param {Object} options
         * @param {Array} options.poNum
         * @return {Object}
         */
        function srchVendorInfo(vendorId) {
            var vendorSearchObj = search.create({
                type: "vendor",
                filters:
                    [
                        ["internalid","anyof",vendorId]
                    ],
                columns:
                    [
                        search.createColumn({
                            name: "entityid",
                            sort: search.Sort.ASC,
                            label: "ID"
                        }),
                        search.createColumn({name: "altname", label: "名称"}),
                        search.createColumn({
                            name: "internalid",
                            join: "CUSTRECORD_SWC_VENDOR",
                            label: "内部 ID"
                        }),
                        search.createColumn({
                            name: "custrecord_swc_vendor_bankname",
                            join: "CUSTRECORD_SWC_VENDOR",
                            label: "Vendor Bank Name"
                        }),
                        search.createColumn({
                            name: "custrecord_swc_vendor_account",
                            join: "CUSTRECORD_SWC_VENDOR",
                            label: "Bank Account No."
                        }),
                        search.createColumn({
                            name: "custrecord_swc_bank_province",
                            join: "CUSTRECORD_SWC_VENDOR",
                            label: "开户行省份/州"
                        }),
                        search.createColumn({
                            name: "custrecord_swc_swiftcode",
                            join: "CUSTRECORD_SWC_VENDOR",
                            label: "Swift Code"
                        }),
                        search.createColumn({
                            name: "custrecord_swc_routing_transit",
                            join: "CUSTRECORD_SWC_VENDOR",
                            label: "Routing & Transit No."
                        }),
                        search.createColumn({
                            name: "name",
                            join: "CUSTRECORD_SWC_VENDOR",
                            label: "ID"
                        })
                    ]
            });
            var srchRs = getAllResultsOfSearch(vendorSearchObj);
            // 创建银行信息对象
            var vendorBankInfo = {
                // VENDOR BANK NAME
                'vendor_bank_name':srchRs[0].getValue({
                    name: "custrecord_swc_vendor_bankname",
                    join: "CUSTRECORD_SWC_VENDOR",
                    label: "Vendor Bank Name"
                }),
                // VENDOR BANK ACCOUNT NO.
                'vendor_bank_account' : srchRs[0].getValue({
                    name: "custrecord_swc_vendor_account",
                    join: "CUSTRECORD_SWC_VENDOR",
                    label: "Bank Account No."
                }),
                // VENDOR BANK CITY OR STATE
                'vendor_bank_city' : srchRs[0].getValue({
                    name: "custrecord_swc_bank_province",
                    join: "CUSTRECORD_SWC_VENDOR",
                    label: "开户行省份/州"
                }),
                // SWIFT CODE
                'swift_code' : srchRs[0].getValue({
                    name: "custrecord_swc_swiftcode",
                    join: "CUSTRECORD_SWC_VENDOR",
                    label: "Swift Code"
                }),
                // ROUTING & TRANSIT NO.
                'routing_transit' : srchRs[0].getValue({
                    name: "custrecord_swc_routing_transit",
                    join: "CUSTRECORD_SWC_VENDOR",
                    label: "Routing & Transit No."
                })
            }
            return vendorBankInfo;
        }

        // *##* djm新增检索方法
        /**
         * 检索所有【应付无需采购订单标识】对应的【货品id】
         * @param {Object} options
         * @param {Array} options.poNum
         * @return {Object}
         */
        function srchTaxGoods() {
            var serviceitemSearchObj = search.create({
                type: "serviceitem",
                filters:
                    [
                        ["type", "anyof", "Service"],
                        "AND",
                        ["custitem_swc_payable_flag", "is", "T"]
                    ],
                columns:
                    [
                        search.createColumn({name: "internalid", label: "内部 ID"})
                    ]
            });
            var srchRs = getAllResultsOfSearch(serviceitemSearchObj);
            var goodsArr = [];
            for (var i = 0; i < srchRs.length; i++) {
                var goodsInfo = srchRs[i].getValue({name: "internalid", label: "内部 ID"});
                goodsArr.push(goodsInfo);
            }
            return goodsArr;
        }


        /**
         * 查询全部子公司
         * @return {*[]} [{'value': '内部id', 'text': '子公司文本'}, ...]
         */
        function searchSubsidiary() {
            var subsidiarySearchObj = search.create({
                type: "subsidiary",
                filters:
                    [
                        ["custrecord_swc_code","isempty",""],
                        "AND",
                        ["isinactive", "is", "F"]
                    ],
                columns:
                    [
                        search.createColumn({name: "internalid", label: "内部 ID"}),
                        search.createColumn({name: "namenohierarchy", label: "名称（无层次结构）"})
                    ]
            });
            var searchObj = subsidiarySearchObj.run();

            var objArr = [];
            searchObj.each(function(result){
                var obj = {};
                obj['value'] = result.getValue({name: "internalid", label: "内部 ID"});
                obj['text'] = result.getValue({name: "namenohierarchy", label: "名称（无层次结构）"});
                objArr.push(obj);
                return true;
            });

            return objArr;
        }

        /**
         * 校验采购订单是否存在
         * @param {Object} options
         * @param {String} options.purchOrdNum 采购订单号：PO100
         * @returns {{poIsExist: boolean, poSubsidiary: string}}
         */
        function verifyPurchOrdExist(options) {
            var verifyInfo = {
                poIsExist: false,
                poSubsidiary: ''
            };
            var purchOrdNum = options.purchOrdNum;
            if (!purchOrdNum) return verifyInfo;

            var purchaseorderSearchObj = search.create({
                type: "purchaseorder",
                filters:
                    [
                        ["type", "anyof", "PurchOrd"],
                        "AND",
                        ["numbertext", "is", purchOrdNum],
                        "AND",
                        ["mainline", "is", "T"],
                    ],
                columns:
                    [
                        search.createColumn({name: "internalid", label: "内部 ID"}),
                        search.createColumn({name: "subsidiary", label: "子公司"})
                    ]
            });

            var searchResultCount = purchaseorderSearchObj.runPaged().count;

            if (searchResultCount > 0) {
                verifyInfo.poIsExist = true;
                purchaseorderSearchObj.run().each(function(result) {
                    verifyInfo.poSubsidiary = result.getValue({name: "subsidiary"}) || '';
                    return true;
                });
            }

            return verifyInfo;
        }

        return {
            queryData: queryData,
            queryCheck: queryCheck,
            tidyUpData: tidyUpData,
            adjInvoiceNo:adjInvoiceNo,// djm根据【表单id】判断所有中间表中，是否存在和【该表单】相同的【INVOICE编号】
            srchVendorInfo:srchVendorInfo, // djm根据【供应商id】检索对应的【供应商银行信息】子列表的字段
            srchTaxGoods:srchTaxGoods, // djm检索所有【应付无需采购订单标识】对应的【货品id】
            searchSubsidiary: searchSubsidiary,
            verifyPurchOrdExist: verifyPurchOrdExist, // 校验采购订单是否存在


        };

    });
