/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @author chen dong xu
 * @description 保存前根据科目验证科目表中复选框打勾的数据是否填写/导入日期和账期校验
 */

define(['N/runtime', 'N/record', 'N/search' ,'N/format','../../common/Commons.js','../../lib/decimal.js','../../common/SWC_CONFIG_DATA.js'],

    (runtime, record, search,format,Commons,decimal,SWC_CONFIG_DATA) => {
        /**
         * Defines the function definition that is executed before record is loaded.
         * @param {Object} scriptContext
         * @param {Record} scriptContext.newRecord - New record
         * @param {string} scriptContext.type - Trigger type; use values from the context.UserEventType enum
         * @param {Form} scriptContext.form - Current form
         * @param {ServletRequest} scriptContext.request - HTTP request information sent from the browser for a client action only.
         * @since 2015.2
         */
        const beforeLoad = (scriptContext) => {

        }

        /**
         * Defines the function definition that is executed before record is submitted.
         * @param {Object} scriptContext
         * @param {Record} scriptContext.newRecord - New record
         * @param {Record} scriptContext.oldRecord - Old record
         * @param {string} scriptContext.type - Trigger type; use values from the context.UserEventType enum
         * @since 2015.2
         */
        const beforeSubmit = (scriptContext) => {
            var newRec = scriptContext.newRecord;
            if (runtime.executionContext == runtime.ContextType.CSV_IMPORT) {
                //在csv导入日记账时，进行导入日期和账期校验，如果日期不属于导入的账期日期范围，不允许保存，提示：
                // Date is not within the current accounting period, please fill in the correct date.
                var postingperiod = newRec.getValue({fieldId:"postingperiod"});//过账期间
                var trandate =newRec.getValue({fieldId:"trandate"}).getTime();//日期
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
                if(startTime>trandate || endTime<trandate){
                    throw "Date is not within the current accounting period, please fill in the correct date.";
                }


                var lineCount = newRec.getLineCount({sublistId: 'line'});

                var prompt_count = '';

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

                for (var i = 0; i < lineCount; i++) {
                    // 科目
                    var account = newRec.getSublistValue({sublistId: 'line', fieldId: 'account', line: i});
                    if (!account) throw '请填写科目！';
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

                    
                    var promptText = '';
                    var flagIdArr = Object.keys(flagObj);
                    for (var j = 0; j < flagIdArr.length; j++) {
                        if (flagObj[flagIdArr[j]]) {
                            var fieldValue = newRec.getSublistValue({
                                sublistId: 'line',
                                fieldId: idArr[j],
                                line: i
                            });

                            if (!fieldValue) {
                                if (promptText != '') {
                                    promptText += '、';
                                }
                                promptText += promptArr[j]
                            }
                        }
                    }

                    if (promptText != '') {
                        var lineNum = i + 1;
                        var lineText = '第' + lineNum +'行：';
                        var prompt = lineText + promptText + '不能为空，请检查！\n';
                        prompt_count += prompt;
                    }
                }


                if (prompt_count != '') {
                    throw prompt_count;
                }

            }
        }

        /**
         * Defines the function definition that is executed after record is submitted.
         * @param {Object} scriptContext
         * @param {Record} scriptContext.newRecord - New record
         * @param {Record} scriptContext.oldRecord - Old record
         * @param {string} scriptContext.type - Trigger type; use values from the context.UserEventType enum
         * @since 2015.2
         */
        const afterSubmit = (scriptContext) => {
            var newRecord = scriptContext.newRecord;
            var flag = newRecord.getValue({fieldId:"custbody_swc_journal_byhand"});//手工创建日记账标识
            log.audit("flag",flag);
            var navanFlag = newRecord.getValue({fieldId:"custbody_swc_navan_type"});//非Navan创建
            log.audit("navanFlag",navanFlag);
            //csv导入和手动创建时执行
            if ((runtime.executionContext == runtime.ContextType.CSV_IMPORT || flag) && navanFlag == ""){
                var id = newRecord.getValue({fieldId:"id"});//id
                if(!id)return;
                var newRec = record.load({type:"journalentry",id:id,isDynamic:true});
                var createdfrom = newRec.getValue({fieldId:"custbody_createdfrom_expensify"});//CREATED FROM
                var revrecnumber = newRec.getValue({fieldId:"custbody_swc_revrec_number"});//REVREC NUMBER
                var subsidiary = newRec.getValue({fieldId:"subsidiary"});//子公司
                newRec.setValue({fieldId:"custbody_swc_journal_byhand",value:false});//手工创建日记账标识
                //如果他俩不存在 并且子公司为日本 则根据借贷金额和税码计算其他金额
                if(!createdfrom && !revrecnumber && subsidiary=="9"){
                    var lineCount = newRec.getLineCount({sublistId: 'line'});
                    log.audit("执行计算税额",lineCount);
                    var jptaxJson = Commons.srchJptaxAndRate();//查询【税码】下的数据 和日本税计算逻辑 (自定义)字段
                    if(lineCount > 0) {
                        for (var i = 0; i < lineCount; i++) {
                            var subRecord = newRec.selectLine({sublistId: 'line',line:i});
                            var taxCode = subRecord.getCurrentSublistValue({sublistId:"line",fieldId:"taxcode"});//税码
                            var amount = 0;
                            var debitOrCreditStr = "";
                            var debit = subRecord.getCurrentSublistValue({sublistId:"line",fieldId:"debit"});//借记
                            var credit = subRecord.getCurrentSublistValue({sublistId:"line",fieldId:"credit"});//贷记
                            if(debit){
                                amount = debit;
                                debitOrCreditStr = "debit";
                            }else if(credit){
                                amount = credit;
                                debitOrCreditStr = "credit";
                            }
                            log.audit("执行计算税额-amount",amount);
                            var tax = 0;//税率 数字
                            var jptax = 0;//日本税计算逻辑字段 数字
                            var swcTaxrate = "";//税额(CUSTOM)
                            if(jptaxJson && jptaxJson[taxCode] && Object.keys(jptaxJson[taxCode]).length>0){
                                tax = jptaxJson[taxCode]["rate"]?decimal.divN(jptaxJson[taxCode]["rate"],100):0;
                                swcTaxrate = jptaxJson[taxCode]["rate"]?jptaxJson[taxCode]["rate"]+"%":"";
                                jptax = jptaxJson[taxCode]["jptax"]?jptaxJson[taxCode]["jptax"]:0;
                            }
                            //税码存在
                            if(taxCode){
                                var accountText = subRecord.getCurrentSublistText({sublistId:"line",fieldId:"account"});//科目Text
                                var grossamt = subRecord.getCurrentSublistValue({sublistId:"line",fieldId:"grossamt"});//总金额
                                log.audit("未税金额amount",amount);//未税金额
                                //如果是日本的情况下 通过费用报告计算税额
                                var jpyTax1amt =0;//增值税金额
                                var allAmount = 0;//总金额
                                //总金额= 未税金额*（（税率*日本）+1 ）作废
                                // if(jptax){
                                //     allAmount = decimal.mulN(amount,decimal.addN(decimal.mulN(tax,jptax),1));
                                // }else {
                                //     allAmount = decimal.mulN(amount,decimal.addN(tax,1));
                                // }
                                log.audit("jptax",jptax);
                                log.audit("tax",tax);
                                //税额 = 未税金额*税率*日本
                                if(jptax){
                                    jpyTax1amt = (decimal.mulN(amount,decimal.mulN(tax,jptax))).toFixed(0);
                                    //allAmount = decimal.mulN(amount,decimal.addN(decimal.mulN(tax,jptax),1));
                                }else {
                                    jpyTax1amt = (decimal.mulN(amount,tax)).toFixed(0);
                                    //allAmount = decimal.mulN(amount,decimal.addN(tax,1));
                                }
                                //未税金额1（借记） = 总金额-税额
                                var newAmount = decimal.subN(grossamt,jpyTax1amt);//新借记
                                log.audit("newAmount",newAmount);
                                subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: debitOrCreditStr, value:newAmount});// 借记or贷记
                                log.audit("jpyTax1amt税额",jpyTax1amt);
                                subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'tax1amt', value:jpyTax1amt});// 增值税金额
                                subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'custcol_swc_report_taxcode', value: taxCode});// 税码(CUSTOM)
                                if(tax)subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'custcol_swc_taxrate', value: swcTaxrate});// 税率(CUSTOM)
                                if(jpyTax1amt)subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'custcol_swc_taxamount', value: jpyTax1amt});// 税额(CUSTOM)
                                //20241212新增 并且科目包含应收或者应付字符的
                                if(accountText.indexOf("应收")!=-1 || accountText.indexOf("预收")!=-1){
                                    subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'tax1acct', value:SWC_CONFIG_DATA.configData().TAX1ACCT_YJSF});// 纳税科目  应交税费_暂收消费税（消费税销项税额

                                }
                                subRecord.commitLine({sublistId:"line"});
                            }
                        }
                    }
                    newRec.save();
                }
            }
        }

        return {
            // beforeLoad,
            beforeSubmit,
            afterSubmit
        }

    });
