/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 */
define(['N/record', 'N/search','N/format'],

    (record, search,format) => {
        /**
         * Defines the function that is executed at the beginning of the map/reduce process and generates the input data.
         * @param {Object} inputContext
         * @param {boolean} inputContext.isRestarted - Indicates whether the current invocation of this function is the first
         *     invocation (if true, the current invocation is not the first invocation and this function has been restarted)
         * @param {Object} inputContext.ObjectRef - Object that references the input data
         * @typedef {Object} ObjectRef
         * @property {string|number} ObjectRef.id - Internal ID of the record instance that contains the input data
         * @property {string} ObjectRef.type - Type of the record instance that contains the input data
         * @returns {Array|Object|Search|ObjectRef|File|Query} The input data to use in the map/reduce process
         * @since 2015.2
         */

        const getInputData = (inputContext) => {
            //获取数据
            var exSearch = search.create({
                type: "expensereport",
                settings: [{"name": "consolidationtype", "value": "ACCTTYPE"}],
                filters:
                    // [
                    //     ["type","anyof","ExpRept"],
                    //     "AND",
                    //     ["custbody_swc_joural_error","isnotempty",""],
                    //     "AND",
                    //     ["mainline","is","F"],
                    //     "AND",
                    //     ["expensedate","within","2025/04/01","2025/04/30"]
                    // ],
                    [
                        ["type","anyof","ExpRept"],
                        "AND",
                        ["custbody_swc_joural_error","isnotempty",""],
                        "AND",
                        ["mainline","is","F"],
                        "AND",
                        ["internalid","anyof","843934"]
                    ],
                columns:
                    [
                        search.createColumn({name: "internalid", label: "内部 ID", sort: search.Sort.ASC}),
                        search.createColumn({name: "subsidiary", label: "子公司"}),
                        //search.createColumn({name: "currency", label: "货币"}),
                        search.createColumn({
                            name: "currency",
                            join: "expenseDetail",
                            label: "货币",
                            sort: search.Sort.DESC
                        }),
                        search.createColumn({name: "amount", label: "金额"}),
                        search.createColumn({name: "trandate", label: "日期"}),
                        search.createColumn({name: "memo", label: "备注"}),
                        search.createColumn({
                            name: "memo",
                            join: "expenseDetail",
                            label: "备注"
                        }),
                        search.createColumn({name: "department", label: "部门"}),
                        search.createColumn({name: "expensecategory", label: "费用类别"}),
                        search.createColumn({
                            name: "custrecord_swc_department_type",
                            join: "department",
                            label: "部门类型"
                        }),
                        search.createColumn({
                            name: "country",
                            join: "subsidiary",
                            label: "国家/地区"
                        }),
                        search.createColumn({name: "custbody_swc_navan_type", label: "Navan业务类型"})
                    ]
            });

            var searchList = [];
            var result = getAllResultsOfSearch(exSearch);
            for (var i = 0; i < result.length; i++) {
                var currency = result[i].getValue({name: "currency", join: "expenseDetail"});
                if (currency) {
                    var lineObj = {};
                    lineObj.expensecategory = result[i].getText({name: "expensecategory"});
                    lineObj.department_type = result[i].getText({
                        name: "custrecord_swc_department_type",
                        join: "department"
                    });
                    lineObj.amount = result[i].getValue({name: "amount"});
                    lineObj.memo = result[i].getValue({name: "memo", join: "expenseDetail"});
                    lineObj.department = result[i].getValue({name: "department"});
                    lineObj.taxrate = result[i].getValue({name: "custcol_swc_taxrate"});
                    lineObj.taxcode = result[i].getValue({name: "custcol_swc_report_taxcode"});
                    searchList[searchList.length - 1].sublist.push(lineObj);
                } else {
                    var searchObj = {};
                    searchObj.internalid = result[i].getValue({name: "internalid"});
                    searchObj.subsidiary = result[i].getValue({name: "subsidiary"});
                    searchObj.currency = result[i + 1].getValue({name: "currency", join: "expenseDetail"});
                    var trandate = "";
                    if(result[i].getValue({name: "trandate"})){
                        var time =format.parse({value:new Date(format.parse({value: result[i].getValue({name: "trandate"}),type:format.Type.DATE})),type:format.Type.DATE});
                        trandate = formatDate(time,"yyyy-MM-dd");
                    }
                    log.audit("trandate",trandate);
                    searchObj.trandate = trandate;
                    searchObj.memo = result[i].getValue({name: "memo"});
                    searchObj.country = result[i].getValue({name: "country", join: "subsidiary"});
                    searchObj.navan_type = result[i].getValue({name: "custbody_swc_navan_type"});
                    searchObj.sublist = [];
                    searchList.push(searchObj);
                }
            }
            log.audit("searchList", searchList);
            return searchList;
        }

        /**
         * Defines the function that is executed when the map entry point is triggered. This entry point is triggered automatically
         * when the associated getInputData stage is complete. This function is applied to each key-value pair in the provided
         * context.
         * @param {Object} mapContext - Data collection containing the key-value pairs to process in the map stage. This parameter
         *     is provided automatically based on the results of the getInputData stage.
         * @param {Iterator} mapContext.errors - Serialized errors that were thrown during previous attempts to execute the map
         *     function on the current key-value pair
         * @param {number} mapContext.executionNo - Number of times the map function has been executed on the current key-value
         *     pair
         * @param {boolean} mapContext.isRestarted - Indicates whether the current invocation of this function is the first
         *     invocation (if true, the current invocation is not the first invocation and this function has been restarted)
         * @param {string} mapContext.key - Key to be processed during the map stage
         * @param {string} mapContext.value - Value to be processed during the map stage
         * @since 2015.2
         */

        const map = (mapContext) => {
            mapContext.write({
                key: mapContext.key,
                value: mapContext.value
            });
        }

        /**
         * Defines the function that is executed when the reduce entry point is triggered. This entry point is triggered
         * automatically when the associated map stage is complete. This function is applied to each group in the provided context.
         * @param {Object} reduceContext - Data collection containing the groups to process in the reduce stage. This parameter is
         *     provided automatically based on the results of the map stage.
         * @param {Iterator} reduceContext.errors - Serialized errors that were thrown during previous attempts to execute the
         *     reduce function on the current group
         * @param {number} reduceContext.executionNo - Number of times the reduce function has been executed on the current group
         * @param {boolean} reduceContext.isRestarted - Indicates whether the current invocation of this function is the first
         *     invocation (if true, the current invocation is not the first invocation and this function has been restarted)
         * @param {string} reduceContext.key - Key to be processed during the reduce stage
         * @param {List<String>} reduceContext.values - All values associated with a unique key that was passed to the reduce stage
         *     for processing
         * @since 2015.2
         */
        const reduce = (reduceContext) => {
            var jsonObj = JSON.parse(reduceContext.values[0]);
            log.audit({title: 'jsonObj', details: reduceContext.values[0]});
            var navan_type = jsonObj.navan_type;
            var country = jsonObj.country;
            if (navan_type == "1") {
                if (country == 'JP') {
                    var jptaxJson = srchJptaxAndRate();
                    var thisRec = record.load({type: "expensereport", id: jsonObj.internalid});
                    var list = [];
                    var sublist = jsonObj.sublist;
                    for (var i = 0; i < sublist.length; i++) {
                        var taxCode = thisRec.getSublistValue({sublistId: "expense", fieldId: "taxcode", line: i});
                        var tax = 0;//税率 数字
                        var jptax = 0;//日本税计算逻辑字段 数字
                        var swcTaxrate = "";//税额(CUSTOM)
                        if (taxCode) {
                            if (jptaxJson && jptaxJson[taxCode] && Object.keys(jptaxJson[taxCode]).length > 0) {
                                tax = jptaxJson[taxCode]["rate"] ? jptaxJson[taxCode]["rate"]/100 : 0;
                                swcTaxrate = jptaxJson[taxCode]["rate"] ? jptaxJson[taxCode]["rate"] + "%" : "";
                                jptax = jptaxJson[taxCode]["jptax"] ? jptaxJson[taxCode]["jptax"] : 0;
                            }
                        }
                        var jpyTax1amt = 0;//增值税金额
                        //税额 = 未税金额*税率*日本
                        if (jptax) {
                            jpyTax1amt = (sublist[i].amount * tax * jptax).toFixed(0);
                        } else {
                            jpyTax1amt = (sublist[i].amount * tax).toFixed(0);
                        }
                        //借
                        var debit = {};
                        debit.account = getAccount(sublist[i]);
                        debit.debit = sublist[i].amount;
                        debit.credit = 0;
                        debit.memo = sublist[i].memo;
                        debit.department = sublist[i].department;
                        // 纳税科目
                        debit.tax1acct = 3613;
                        // 增值税金额
                        // 税额(CUSTOM)
                        debit.taxamount = swcTaxrate;
                        // 税率(CUSTOM)
                        debit.taxrate = swcTaxrate;
                        // 税码(CUSTOM)
                        debit.taxcode = taxCode;

                        //贷
                        var credit = {};
                        credit.account = 1292;//应付账款_明细应付款
                        credit.debit = 0;
                        credit.credit = sublist[i].amount;
                        credit.memo = sublist[i].memo;
                        credit.department = sublist[i].department;
                        // 纳税科目
                        credit.tax1acct = 3613;
                        // 增值税金额
                        // 税额(CUSTOM)
                        credit.taxamount = swcTaxrate;
                        // 税率(CUSTOM)
                        credit.taxrate = swcTaxrate;
                        // 税码(CUSTOM)
                        credit.taxcode = taxCode;
                        list.push(debit);
                        list.push(credit);
                    }

                    jsonObj.line = list;
                } else if (country == 'US') {
                    var list = [];
                    var sublist = jsonObj.sublist;
                    for (var i = 0; i < sublist.length; i++) {
                        //借
                        var debit = {};
                        debit.account = getAccount(sublist[i]);
                        debit.debit = sublist[i].amount;
                        debit.credit = 0;
                        debit.memo = sublist[i].memo;
                        debit.department = sublist[i].department;
                        //贷
                        var credit = {};
                        credit.account = 1292;//应付账款_明细应付款
                        credit.debit = 0;
                        credit.credit = sublist[i].amount;
                        credit.memo = sublist[i].memo;
                        credit.department = sublist[i].department;
                        //借
                        var debit2 = {};
                        debit2.account = 1292;//应付账款_明细应付款
                        debit2.debit = sublist[i].amount;
                        debit2.credit = 0;
                        debit2.memo = sublist[i].memo;
                        debit2.department = sublist[i].department;
                        //贷
                        var credit2 = {};
                        credit2.account = 3485;//银行存款_US_CITI_美元_3136***8764
                        credit2.debit = 0;
                        credit2.credit = sublist[i].amount;
                        credit2.memo = sublist[i].memo;
                        credit2.department = sublist[i].department;
                        list.push(debit);
                        list.push(credit);
                        list.push(debit2);
                        list.push(credit2);
                    }
                    jsonObj.line = list;
                } else if (country == 'SG') {
                    var list = [];
                    var sublist = jsonObj.sublist;
                    for (var i = 0; i < sublist.length; i++) {
                        //借
                        var debit = {};
                        debit.account = getAccount(sublist[i]);
                        debit.debit = sublist[i].amount;
                        debit.credit = 0;
                        debit.memo = sublist[i].memo;
                        debit.department = sublist[i].department;
                        //贷
                        var credit = {};
                        credit.account = 1292;//应付账款_明细应付款
                        credit.debit = 0;
                        credit.credit = sublist[i].amount;
                        credit.memo = sublist[i].memo;
                        credit.department = sublist[i].department;
                        list.push(debit);
                        list.push(credit);
                    }
                    jsonObj.line = list;
                }
            } else if (navan_type == "2") {
                if (country == 'JP') {
                    var jptaxJson = srchJptaxAndRate();
                    var thisRec = record.load({type: "expensereport", id: jsonObj.internalid});
                    var list = [];
                    var sublist = jsonObj.sublist;
                    for (var i = 0; i < sublist.length; i++) {
                        var taxCode = thisRec.getSublistValue({sublistId: "expense", fieldId: "taxcode", line: i});
                        var tax = 0;//税率 数字
                        var jptax = 0;//日本税计算逻辑字段 数字
                        var swcTaxrate = "";//税额(CUSTOM)
                        if (taxCode) {
                            if (jptaxJson && jptaxJson[taxCode] && Object.keys(jptaxJson[taxCode]).length > 0) {
                                tax = jptaxJson[taxCode]["rate"] ? jptaxJson[taxCode]["rate"]/100 : 0;
                                swcTaxrate = jptaxJson[taxCode]["rate"] ? jptaxJson[taxCode]["rate"] + "%" : "";
                                jptax = jptaxJson[taxCode]["jptax"] ? jptaxJson[taxCode]["jptax"] : 0;
                            }
                        }
                        var jpyTax1amt = 0;//增值税金额
                        //税额 = 未税金额*税率*日本
                        if (jptax) {
                            jpyTax1amt = (sublist[i].amount * tax * jptax).toFixed(0);
                        } else {
                            jpyTax1amt = (sublist[i].amount * tax).toFixed(0);
                        }
                        //借
                        var debit = {};
                        debit.account = getAccount(sublist[i]);
                        debit.debit = sublist[i].amount;
                        debit.credit = 0;
                        debit.memo = sublist[i].memo;
                        debit.department = sublist[i].department;
                        // 纳税科目
                        debit.tax1acct = 3613;
                        // 增值税金额
                        // 税额(CUSTOM)
                        debit.taxamount = swcTaxrate;
                        // 税率(CUSTOM)
                        debit.taxrate = swcTaxrate;
                        // 税码(CUSTOM)
                        debit.taxcode = taxCode;

                        //贷
                        var credit = {};
                        credit.account = 1308;//其他应付款_应付报销款
                        credit.debit = 0;
                        credit.credit = sublist[i].amount;
                        credit.memo = sublist[i].memo;
                        credit.department = sublist[i].department;
                        // 纳税科目
                        credit.tax1acct = 3613;
                        // 增值税金额
                        // 税额(CUSTOM)
                        credit.taxamount = swcTaxrate;
                        // 税率(CUSTOM)
                        credit.taxrate = swcTaxrate;
                        // 税码(CUSTOM)
                        credit.taxcode = taxCode;
                        //借
                        var debit2 = {};
                        debit2.account = 1308;//其他应付款_应付报销款
                        debit2.debit = sublist[i].amount;
                        debit2.credit = 0;
                        debit2.memo = sublist[i].memo;
                        debit2.department = sublist[i].department;
                        // 纳税科目
                        debit2.tax1acct = 3613;
                        // 增值税金额
                        // 税额(CUSTOM)
                        debit2.taxamount = swcTaxrate;
                        // 税率(CUSTOM)
                        debit2.taxrate = swcTaxrate;
                        // 税码(CUSTOM)
                        debit2.taxcode = taxCode;
                        //贷
                        var credit2 = {};
                        credit2.account = 737;//银行存款_JP_三井住友银行_日元_8259***7590
                        credit2.debit = 0;
                        credit2.credit = sublist[i].amount;
                        credit2.memo = sublist[i].memo;
                        credit2.department = sublist[i].department;
                        // 纳税科目
                        credit2.tax1acct = 3613;
                        // 增值税金额
                        // 税额(CUSTOM)
                        credit2.taxamount = swcTaxrate;
                        // 税率(CUSTOM)
                        credit2.taxrate = swcTaxrate;
                        // 税码(CUSTOM)
                        credit2.taxcode = taxCode;
                        list.push(debit);
                        list.push(credit);
                        list.push(debit2);
                        list.push(credit2);
                    }
                    jsonObj.line = list;
                } else if (country == 'US') {
                    var list = [];
                    var sublist = jsonObj.sublist;
                    for (var i = 0; i < sublist.length; i++) {
                        //借
                        var debit = {};
                        debit.account = getAccount(sublist[i]);
                        debit.debit = sublist[i].amount;
                        debit.credit = 0;
                        debit.memo = sublist[i].memo;
                        debit.department = sublist[i].department;
                        //贷
                        var credit = {};
                        credit.account = 1308;//其他应付款_应付报销款
                        credit.debit = 0;
                        credit.credit = sublist[i].amount;
                        credit.memo = sublist[i].memo;
                        credit.department = sublist[i].department;
                        //借
                        var debit2 = {};
                        debit2.account = 1308;//其他应付款_应付报销款
                        debit2.debit = sublist[i].amount;
                        debit2.credit = 0;
                        debit2.memo = sublist[i].memo;
                        debit2.department = sublist[i].department;
                        //贷
                        var credit2 = {};
                        credit2.account = 3485;//银行存款_US_CITI_美元_3136***8764
                        credit2.debit = 0;
                        credit2.credit = sublist[i].amount;
                        credit2.memo = sublist[i].memo;
                        credit2.department = sublist[i].department;
                        list.push(debit);
                        list.push(credit);
                        list.push(debit2);
                        list.push(credit2);
                    }
                    jsonObj.line = list;
                } else if (country == 'SG') {
                    var list = [];
                    var sublist = jsonObj.sublist;
                    for (var i = 0; i < sublist.length; i++) {
                        //借
                        var debit = {};
                        debit.account = getAccount(sublist[i]);
                        debit.debit = sublist[i].amount;
                        debit.credit = 0;
                        debit.memo = sublist[i].memo;
                        debit.department = sublist[i].department;
                        //贷
                        var credit = {};
                        credit.account = 1308;//其他应付款_应付报销款
                        credit.debit = 0;
                        credit.credit = sublist[i].amount;
                        credit.memo = sublist[i].memo;
                        credit.department = sublist[i].department;
                        //借
                        var debit2 = {};
                        debit2.account = 1308;//其他应付款_应付报销款
                        debit2.debit = sublist[i].amount;
                        debit2.credit = 0;
                        debit2.memo = sublist[i].memo;
                        debit2.department = sublist[i].department;
                        //贷
                        var credit2 = {};
                        credit2.account = 734;//银行存款_PTE_CITI_美元_3050***3007
                        credit2.debit = 0;
                        credit2.credit = sublist[i].amount;
                        credit2.memo = sublist[i].memo;
                        credit2.department = sublist[i].department;
                        list.push(debit);
                        list.push(credit);
                        list.push(debit2);
                        list.push(credit2);
                    }
                    jsonObj.line = list;
                }
            } else if (navan_type == "3") {
                var list = [];
                var sublist = jsonObj.sublist;
                for (var i = 0; i < sublist.length; i++) {
                    //借
                    var debit = {};
                    debit.account = 1745;//预付账款_待摊费用_其他
                    debit.debit = sublist[i].amount;
                    debit.credit = 0;
                    debit.memo = sublist[i].memo;
                    debit.department = sublist[i].department;
                    //贷
                    var credit = {};
                    credit.account = 3485;//银行存款_US_CITI_美元_3136***8764
                    credit.debit = 0;
                    credit.credit = sublist[i].amount;
                    credit.memo = sublist[i].memo;
                    credit.department = sublist[i].department;
                    list.push(debit);
                    list.push(credit);
                }
                jsonObj.line = list;
            }

            log.audit("jsonObj",jsonObj);
            var jnRes = createJN(jsonObj);
            var exRec = record.load({type: "expensereport", id: jsonObj.internalid});
            if (jnRes.success) {
                exRec.setValue({fieldId: "custbody_swc_related_journal", value: jnRes.recordId});
            } else {
                exRec.setValue({fieldId: "custbody_swc_joural_error", value: jnRes.message});
            }
            exRec.save({enableSourcing: true, ignoreMandatoryFields: true});
        }


        /**
         * Defines the function that is executed when the summarize entry point is triggered. This entry point is triggered
         * automatically when the associated reduce stage is complete. This function is applied to the entire result set.
         * @param {Object} summaryContext - Statistics about the execution of a map/reduce script
         * @param {number} summaryContext.concurrency - Maximum concurrency number when executing parallel tasks for the map/reduce
         *     script
         * @param {Date} summaryContext.dateCreated - The date and time when the map/reduce script began running
         * @param {boolean} summaryContext.isRestarted - Indicates whether the current invocation of this function is the first
         *     invocation (if true, the current invocation is not the first invocation and this function has been restarted)
         * @param {Iterator} summaryContext.output - Serialized keys and values that were saved as output during the reduce stage
         * @param {number} summaryContext.seconds - Total seconds elapsed when running the map/reduce script
         * @param {number} summaryContext.usage - Total number of governance usage units consumed when running the map/reduce
         *     script
         * @param {number} summaryContext.yields - Total number of yields when running the map/reduce script
         * @param {Object} summaryContext.inputSummary - Statistics about the input stage
         * @param {Object} summaryContext.mapSummary - Statistics about the map stage
         * @param {Object} summaryContext.reduceSummary - Statistics about the reduce stage
         * @since 2015.2
         */
        const summarize = (summaryContext) => {

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

        function getAccount(sublist) {
            //科目
            var account = "";
            var name = sublist.expensecategory + " (" + sublist.department_type + ")";
            var itemSearchObj = search.create({
                type: "item",
                filters:
                    [
                        ["name", "is", name],
                        "OR",
                        ["name", "is", sublist.expensecategory]
                    ],
                columns:
                    [
                        search.createColumn({name: "itemid", label: "名称", sort: search.Sort.ASC}),
                        search.createColumn({name: "expenseaccount", label: "费用/销货成本科目"})
                    ]
            });
            var searchResultCount = itemSearchObj.runPaged().count;
            if (searchResultCount > 0) {
                itemSearchObj.run().each(function (result) {
                    account = result.getValue({name: "expenseaccount"});
                    return true;
                });
            }
            return account;
        }

        function createJN(jour) {
            var res = {};

            try {
                var thisRecord = record.create({
                    type: 'journalentry',
                    isDynamic: true
                });
                thisRecord.setValue({
                    fieldId: "subsidiary",
                    value: jour.subsidiary
                });
                thisRecord.setValue({
                    fieldId: "currency",
                    value: jour.currency
                });
                log.audit("666",format.parse({value:new Date(format.parse({value: jour.trandate,type:format.Type.DATE})),type:format.Type.DATE}));
                thisRecord.setValue({
                    fieldId: "trandate",
                    value: format.parse({value:new Date(format.parse({value: jour.trandate,type:format.Type.DATE})),type:format.Type.DATE})
                });
                thisRecord.setValue({
                    fieldId: "memo",
                    value: jour.memo
                });
                var count = jour.line.length;
                for (var i = 0; i < count; i++) {
                    if (jour.line[i].account == "") {
                        res.success = false;
                        res.message = "没有找到费用科目";
                        return res;
                    }
                    if (jour.line[i].debit || jour.line[i].credit) {
                        //新建行
                        thisRecord.selectNewLine({sublistId: "line"});
                        //科目
                        thisRecord.setCurrentSublistValue({
                            sublistId: "line",
                            fieldId: "account",
                            value: jour.line[i].account,
                            ignoreFieldChange: false
                        });
                        //借记
                        if (jour.line[i].debit) {
                            thisRecord.setCurrentSublistValue({
                                sublistId: "line",
                                fieldId: "debit",
                                value: jour.line[i].debit,
                                ignoreFieldChange: false
                            });
                        }
                        //贷记
                        if (jour.line[i].credit) {
                            thisRecord.setCurrentSublistValue({
                                sublistId: "line",
                                fieldId: "credit",
                                value: jour.line[i].credit,
                                ignoreFieldChange: false
                            });
                        }
                        //摘要
                        if (jour.line[i].memo) {
                            thisRecord.setCurrentSublistValue({
                                sublistId: "line",
                                fieldId: "memo",
                                value: jour.line[i].memo,
                                ignoreFieldChange: false
                            });
                        }
                        //部门
                        if (jour.line[i].department) {
                            thisRecord.setCurrentSublistValue({
                                sublistId: "line",
                                fieldId: "department",
                                value: jour.line[i].department,
                                ignoreFieldChange: false
                            });
                        }
                        // 纳税科目
                        if (jour.line[i].tax1acct) {
                            thisRecord.setCurrentSublistValue({
                                sublistId: "line",
                                fieldId: "tax1acct",
                                value: jour.line[i].tax1acct,
                                ignoreFieldChange: false
                            });
                        }
                        // 增值税金额
                        // if(jour.line[i].taxamount){
                        //         thisRecord.setCurrentSublistValue({
                        //                 sublistId: "line",
                        //                 fieldId: "custcol_swc_taxamount",
                        //                 value: jour.line[i].taxamount,
                        //                 ignoreFieldChange: false
                        //         });
                        // }
                        // 税额(CUSTOM)
                        if (jour.line[i].taxamount) {
                            thisRecord.setCurrentSublistValue({
                                sublistId: "line",
                                fieldId: "custcol_swc_taxamount",
                                value: jour.line[i].taxamount,
                                ignoreFieldChange: false
                            });
                        }
                        // 税率(CUSTOM)
                        if (jour.line[i].taxrate) {
                            thisRecord.setCurrentSublistValue({
                                sublistId: "line",
                                fieldId: "custcol_swc_taxrate",
                                value: jour.line[i].taxrate,
                                ignoreFieldChange: false
                            });
                        }
                        // 税码(CUSTOM)
                        if (jour.line[i].taxcode) {
                            thisRecord.setCurrentSublistValue({
                                sublistId: "line",
                                fieldId: "custcol_swc_report_taxcode",
                                value: jour.line[i].taxcode,
                                ignoreFieldChange: false
                            });
                        }
                        //提交行数据
                        thisRecord.commitLine({sublistId: "line"});
                    }
                }

                var recordId = thisRecord.save({
                    enableSourcing: true,
                    ignoreMandatoryFields: true
                });
                res.success = true;
                res.recordId = recordId;
                return recordId;
            } catch (e) {
                log.audit('error-createJournalentry', e);
                //throw e;
                res.success = false;
                res.message = e;
                return res;
            }
        }

        /**
         * 查询【税码】下的数据 和日本税计算逻辑 (自定义)字段
         * @return {Object}
         */
        function srchJptaxAndRate() {
            var salestaxitemSearchObj = search.create({
                type: "salestaxitem",
                filters:
                    [],
                columns:
                    [
                        search.createColumn({name: "rate", label: "税率"}),
                        search.createColumn({name: "internalid", label: "内部 ID"}),
                        search.createColumn({name: "custrecord_swc_jptax_formula", label: "日本税计算逻辑"})
                    ]
            });

            var results = getAllResultsOfSearch(salestaxitemSearchObj);
            var json = {};
            results.forEach(function (value) {
                var rate = value.getValue({name: "rate", label: "税率"});
                var jptax = value.getValue({name: "custrecord_swc_jptax_formula", label: "日本税计算逻辑"});
                var id = value.getValue({name: "internalid", label: "内部 ID"});
                //20240710删除税率为0的条件
                //if(rate && rate !="0.00%"){
                rate = Number(rate.replace(".00%", ""));
                json[id] = {"rate": rate, "jptax": jptax ? Number(jptax) : ""};
                // }
            });
            return json;
        }


        function formatDate(date, formatStr)
        {
            var year = date.getFullYear();
            var month = to2Digits(Number(date.getMonth()) + 1);
            var day = to2Digits(date.getDate());
            var hours = to2Digits(date.getHours());
            var mins = to2Digits(date.getMinutes());
            var seconds = to2Digits(date.getSeconds());

            var str = formatStr && formatStr.replace("yyyy", year).replace("MM", month).replace("dd", day).replace("hh", hours).replace("mm", mins).replace("ss", seconds);
            return str;

        }

        function to2Digits(num) {
            return (num < 10 ? "0" : "") + num;
        }

        return {getInputData, map, reduce, summarize}

    });
