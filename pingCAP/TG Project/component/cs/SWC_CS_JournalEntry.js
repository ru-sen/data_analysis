/**
 * @NApiVersion 2.x
 * @NScriptType ClientScript
 * @NModuleScope SameAccount
 * @author chen dong xu
 * @description 提交行时根据科目表中复选框打勾的数据验证必填
 */
define(['N/record', 'N/search'],

function(record, search) {
    
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
debugger
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
        var sublistLineCount = curRec.getLineCount({sublistId: 'line'});
        if (sublistLineCount > 0) {
            if (scriptContext.fieldId == "taxcode"){
                var tax_code = curRec.getCurrentSublistValue({sublistId: 'line', fieldId: 'taxcode'});
                if (!tax_code)return true;
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
      debugger
        var currRec = scriptContext.currentRecord;
        var sublistId = scriptContext.sublistId;
        if (sublistId == 'line') {
            // var line = currRec.getSublistIndex({sublistId: 'line'});

            // 科目
            var account = currRec.getCurrentSublistValue({sublistId: 'line', fieldId: 'account'});

            if (!account) return true;
            // 根据科目查询科目表上的复选框 {'字段id': true/false, ...}
            var flagObj = search.lookupFields({
                type: search.Type.ACCOUNT,
                id: account,
                columns: [
                    'custrecord_swc_memo_flag',
                    'custrecord_swc_tax_flag',
                    'custrecord_swc_cusname_flag',
                    'custrecord_swc_partner_flag',
                    'custrecord_swc_product_flag',
                    'custrecord_swc_ordernum_flag',
                    'custrecord_swc_vendor_flag',
                    'custrecord_swc_deposit_flag',
                    'custrecord_swc_lease_flag',
                    'custrecord_swc_intangible_flag',
                    'custrecord_swc_deferred_flag',
                    'custrecord_swc_unamortized_flag',
                    'custrecord_swc_employee_flag',
                    'custrecord_swc_depart_flag',
                    'custrecord_swc_group_flag',
                    'custrecord_swc_area_flag',
                    'custrecord_swc_stats_flag',
                    'custrecord_swc_financial_flag',
                    'custrecord_swc_investment_flag',
                    'custrecord_swc_coa_flag',
                    'custrecord_swc_relatedasset_flag',
                  'custrecord_swc_counterparter_flag'
                ]
            });

            // log.audit({title: 'flagObj', details: flagObj});

            var idArr = [
                'memo',
                'taxcode',
                'custcol_swc_jon_cusname',
                'custcol_swc_partner',
                'custcol_swc_jon_product',
                'custcol_swc_jon_ordernum',
                'custcol_swc_jon_vendorname',
                'cseg_swc_investment',
                'cseg_swc_lease',
                'cseg_swc_intangible',
                'cseg_swc_defexp',
                'cseg_swc_longterm',
                'custcol_swc_jon_employee',
                'department',
                'cseg_swc_pro',
                'cseg_swc_region',
                'custcol_swc_jon_stats',
                'cseg_swc_finpuct',
                'cseg_swc_invest',
                'custcol_swc_jon_coa',
                'custcol_far_trn_relatedasset',
              'entity'
            ];
            var promptArr = [
                '摘要',
                '税码',
                '客户名称',
                '合作伙伴',
                '产品',
                '订单编号',
                '供应商名称',
                '押金类型',
                '租赁明细',
                '无形资产名称',
                '待摊费用明细',
                '长期待摊明细',
                '员工',
                '部门',
                '项目',
                '地区',
                '州',
                '理财产品',
                '投资公司',
                '集团 COA',
                '相关资产',
              '往来名称'
            ];

            var flagIdArr = Object.keys(flagObj);

            var promptText = '';
            // // 当循环到 idArr[i] = 'custcol_swc_domestic_ven' 时候，计数这两个都为零的时候证明没有值，需要提示
            // var count_a = 0;
            // var count_b = 0;
            for (var i = 0; i < flagIdArr.length; i++) {
                if (flagObj[flagIdArr[i]]) {
                    var fieldValue = currRec.getCurrentSublistValue({
                        sublistId: 'line',
                        fieldId: idArr[i]
                    });

                    if (!fieldValue) {
                        if (promptText != '') {
                            promptText += '、';
                        }
                        promptText += promptArr[i]
                    }

                    // if (idArr[i] == 'custcol_swc_domestic_ven') {
                    //     var fieldValue2 = currRec.getCurrentSublistValue({
                    //         sublistId: 'line',
                    //         fieldId: 'custcol_swc_domestic_cus'
                    //     });
                    //
                    //     if (fieldValue) {
                    //         count_a++;
                    //     }
                    //
                    //     if (fieldValue2) {
                    //         count_b++;
                    //     }
                    //
                    //     if (count_a == 0 && count_b == 0) {
                    //         if (promptText != '') {
                    //             promptText += '、';
                    //         }
                    //         promptText += promptArr[i] + '或者国内客户（金蝶）';
                    //     }
                    // } else {
                    //
                    //
                    // }
                }
            }

            if (promptText != '') {
                promptText += '\xa0不能为空，请检查！';
                alert(promptText);
                return false;
            } else {
                return true;
            }
        }
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
        var curRec = scriptContext.currentRecord;
        //手工创建日记账标识该字段设置为true 触发SWC_UE_JournalEntry.js脚本
        curRec.setValue({fieldId: 'custbody_swc_journal_byhand',value:true});
        return true;
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
        var thisTaxCodeArr = [];
        results.forEach(function (value) {
            var id = value.getValue({name: "internalid", label: "内部 ID"});
            if(id)thisTaxCodeArr.push(id);
        });
        return thisTaxCodeArr;
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
         //pageInit: pageInit,
        // fieldChanged: fieldChanged,
        // postSourcing: postSourcing,
        // sublistChanged: sublistChanged,
        // lineInit: lineInit,
         validateField: validateField,
         validateLine: validateLine,
        // validateInsert: validateInsert,
        // validateDelete: validateDelete,
         saveRecord: saveRecord
    };
    
});
