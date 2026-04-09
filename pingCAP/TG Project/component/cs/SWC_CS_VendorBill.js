/**
 * @NApiVersion 2.x
 * @NScriptType ClientScript
 * @NModuleScope SameAccount
 * @author chen dong xu
 * @description 供应商账单 重新计算税率金额
 */
define(['N/search','N/format'],

function(search,format) {
    
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
        var currRec = scriptContext.currentRecord;
        var sublistId = scriptContext.sublistId;
        var fieldId = scriptContext.fieldId;
        var line = scriptContext.line;

        // 子列表税率改变触发 重新计算金额，总金额，税额
        if (sublistId == 'item' && fieldId == 'taxcode') {

            var tax_code = currRec.getCurrentSublistValue({sublistId: 'item', fieldId: 'taxcode'});

            // var tax_code2 = currRec.getSublistValue({sublistId: 'item', fieldId: 'taxcode', line: line});
            // 当税率为空不执行
            if (!tax_code) {
                return ;
                // 赋值税率
                // currRec.setCurrentSublistValue({sublistId: 'item', fieldId: 'taxcode', value: '5', ignoreFieldChange: true});
                // 赋值税额
                // currRec.setCurrentSublistValue({sublistId: 'item', fieldId: 'tax1amt', value: 0, ignoreFieldChange: true});
                // 获取总金额
                // var grossamt = currRec.getCurrentSublistValue({sublistId: 'item', fieldId: 'grossamt'});
                // 赋值总金额
                // currRec.setCurrentSublistValue({sublistId: 'item', fieldId: 'grossamt', value: grossamt, ignoreFieldChange: true});

            } else {
                // 税码
                var taxRate = search.lookupFields({
                    type: search.Type.SALES_TAX_ITEM,
                    id: tax_code,
                    columns: ['rate']
                });
                // 将税率转化成小数
                if(!taxRate.rate)return;
                var str = taxRate.rate.replace("%", "");
                var decimalTax = str / 100;

                // 获取总金额
                var grossamt = currRec.getCurrentSublistValue({sublistId: 'item', fieldId: 'grossamt'});

                // 金额、价格
                var amount = Number(grossamt) / (1 + Number(decimalTax));
                // 税额
                var tax1amt = Number(decimalTax) * Number(amount);

                // 赋值金额和价格
                currRec.setCurrentSublistValue({sublistId: 'item', fieldId: 'amount', value: amount.toFixed(8), ignoreFieldChange: true});
                currRec.setCurrentSublistValue({sublistId: 'item', fieldId: 'rate', value: amount.toFixed(8), ignoreFieldChange: true});
                // 赋值税码
                currRec.setCurrentSublistValue({sublistId: 'item', fieldId: 'taxcode', value: tax_code, ignoreFieldChange: true, forceSyncSourcing: true});
                // 赋值税率
                currRec.setCurrentSublistText({sublistId: 'item', fieldId: 'taxrate1', text: taxRate.rate, ignoreFieldChange: true});
                // 赋值税额
                currRec.setCurrentSublistValue({sublistId: 'item', fieldId: 'tax1amt', value: tax1amt.toFixed(8), ignoreFieldChange: true});
                // 赋值总金额
                currRec.setCurrentSublistValue({sublistId: 'item', fieldId: 'grossamt', value: grossamt, ignoreFieldChange: true});
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
        var currRec = scriptContext.currentRecord;
        var sublistId = scriptContext.sublistId;
        var fieldId = scriptContext.fieldId;
        var line = currRec.getCurrentSublistIndex({sublistId: 'item'})

        // 子列表税率改变触发 重新计算金额，总金额，税额
        if (sublistId == 'item' && fieldId == 'taxcode') {

            // alert('1111111111');

            var tax_code = currRec.getCurrentSublistValue({sublistId: 'item', fieldId: 'taxcode'});

            // var tax_code2 = currRec.getSublistValue({sublistId: 'item', fieldId: 'taxcode', line: line});
            // 当税率为空不执行
            if (!tax_code) {
                // 赋值税率
                currRec.setCurrentSublistValue({sublistId: 'item', fieldId: 'taxcode', value: '5'});

                // 赋值税额
                // currRec.setCurrentSublistValue({sublistId: 'item', fieldId: 'tax1amt', value: 0, ignoreFieldChange: true});
                // 获取总金额
                // var grossamt = currRec.getCurrentSublistValue({sublistId: 'item', fieldId: 'grossamt'});
                // 赋值总金额
                // currRec.setCurrentSublistValue({sublistId: 'item', fieldId: 'grossamt', value: grossamt, ignoreFieldChange: true});

            } else {
                // 税码
                var taxRate = search.lookupFields({
                    type: search.Type.SALES_TAX_ITEM,
                    id: tax_code,
                    columns: ['rate']
                });
                // 将税率转化成小数
                var str = taxRate.rate.replace("%", "");
                var decimalTax = str / 100;

                // 获取总金额
                var grossamt = currRec.getCurrentSublistValue({sublistId: 'item', fieldId: 'grossamt'});
                var grossamt2 = currRec.getSublistValue({sublistId: 'item', fieldId: 'grossamt', line: line});
                alert('总金额：' + grossamt2);

                // 金额、价格
                var amount = Number(grossamt) / (1 + Number(decimalTax));
                // 税额
                var tax1amt = Number(decimalTax) * Number(amount);
                // alert('税额：' + tax1amt);
                // alert('金额：' + amount);
                // alert('taxRate.rate：' + taxRate.rate);


                // 赋值金额和价格
                currRec.setCurrentSublistValue({sublistId: 'item', fieldId: 'amount', value: amount.toFixed(8), ignoreFieldChange: true});
                currRec.setCurrentSublistValue({sublistId: 'item', fieldId: 'rate', value: amount.toFixed(8), ignoreFieldChange: true});
                // 赋值税码
                currRec.setCurrentSublistValue({sublistId: 'item', fieldId: 'taxcode', value: tax_code, ignoreFieldChange: true});
                // 赋值税率
                // currRec.setCurrentSublistText({sublistId: 'item', fieldId: 'taxrate1', text: decimalTax, ignoreFieldChange: true});
                // 赋值税额
                currRec.setCurrentSublistValue({sublistId: 'item', fieldId: 'tax1amt', value: tax1amt.toFixed(8), ignoreFieldChange: true});
                // 赋值总金额
                currRec.setCurrentSublistValue({sublistId: 'item', fieldId: 'grossamt', value: grossamt2, ignoreFieldChange: true});
            }



        }
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
        var sublistLineCount = curRec.getLineCount({sublistId: 'item'});
      if (sublistLineCount > 0) {
        if (scriptContext.fieldId == "taxcode"){
            var tax_code = curRec.getCurrentSublistValue({sublistId: 'item', fieldId: 'taxcode'});
            if (!tax_code) {
                alert('税码不能为空！');
                return false;
            }
            var taxCodeArr = searchTaxCode();
            if(taxCodeArr.indexOf(tax_code) ==-1){
                alert('该税码在税码表中不存在，请重新选择！');
                return false;
            }

        }
      }
        return true;
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
        var currRec = scriptContext.currentRecord;
        var postingperiod = currRec.getValue({fieldId:"postingperiod"});//过账期间
        var trandate =currRec.getValue({fieldId:"trandate"}).getTime();//日期
        log.audit("trandate",trandate);
        var startTime = "";
        var endTime = "";
        if (postingperiod) {
            var accountingperiodSearchObj = search.create({
                type: "accountingperiod",
                filters: [["internalid", "anyof", postingperiod]],
                columns:
                    [
                        search.createColumn({name: "periodname", sort: search.Sort.ASC, label: "名称"}),
                        search.createColumn({name: "startdate", label: "开始日期"}),
                        search.createColumn({name: "enddate", label: "结束日期"})
                    ]
            });
            accountingperiodSearchObj.run().each(function (result) {
                var startDate = result.getValue({name: "startdate"})
                var endDate = result.getValue({name: "enddate"})
                startTime = format.parse({value: startDate, type: format.Type.DATE}).getTime();
                endTime = format.parse({value: endDate, type: format.Type.DATE}).getTime();
                return true;
            });
        }
        log.audit("startTime",startTime);
        log.audit("endTime",endTime);
        if(startTime<=trandate && endTime>=trandate){
            return true;
        }else {
            alert("日期不在过账期间范围内，请重新填写日期");
            return false;
        }

    }

    /**
     * 查询【税码】ID
     * @return {Object}
     */
    function searchTaxCode() {
        var salestaxitemSearchObj = search.create({
            type: "salestaxitem",
            filters:
                [
                ],
            columns:
                [
                    search.createColumn({name: "rate", label: "税率"}),
                    search.createColumn({name: "internalid", label: "内部 ID"}),
                    search.createColumn({name: "custrecord_swc_jptax_formula", label: "日本税计算逻辑"})
                ]
        });

        var results = getAllResults(salestaxitemSearchObj);
        var taxCodeArr = [];
        results.forEach(function (value) {
            var id = value.getValue({name: "internalid", label: "内部 ID"});
            if(id)taxCodeArr.push(id);
        });
        return taxCodeArr;
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
        // pageInit: pageInit,
        fieldChanged: fieldChanged,
        // postSourcing: postSourcing,
        // sublistChanged: sublistChanged,
        // lineInit: lineInit,
        validateField: validateField,
        // validateLine: validateLine,
        // validateInsert: validateInsert,
        // validateDelete: validateDelete,
        saveRecord: saveRecord
    };
    
});
