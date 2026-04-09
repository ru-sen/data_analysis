/**
 * @NApiVersion 2.x
 * @NModuleScope public
 * @description 员工中心应付账单
 * @author chen dong xu
 */
define(['N/record', 'N/search','N/format'],

    function (record, search, format) {

        // =========================== SL start =============================

        /**
         * 根据CS传递的检索条件,创建动态的筛选器
         * @param {String} subsId "子公司"字段ID
         * @param {String} empId “员工”字段ID
         * @param {String} acctId “默认付款银行账户”ID
         * @return {Array} filters 整理后的检索条件
         */
        function getJeFilter(subsId, empId) {
            var middleArr = getMiddleRecArr();
            var middleArrObj;
            if (middleArr.returnFlag != "noData") middleArrObj = JSON.parse(middleArr.returnData);
            log.audit("中间表结果数组",middleArr.returnData);
            var filters = [["type","anyof","Journal"], "AND",
                ["creditamount","greaterthan","0.00"], "AND",
                ["custbody_swc_pay_flag","is","F"], "AND",
                ["custbody_createdfrom_expensify","startswith","https://www.expensify.com"]];
            if (subsId) {
                filters.push("and", ["subsidiary", "anyof", subsId]);
            }
            if (empId) {
                filters.push("and", ["custcol_swc_jon_employee","anyof", empId]);
            }
            if (middleArr.returnFlag != "noData" && middleArr.returnData) {
                var jeArr = [];
                for (var i in middleArrObj) {
                    if (middleArrObj[i]) jeArr.push(middleArrObj[i]);
                }
                log.audit("检索中间表数组条件",jeArr);
                if (jeArr && jeArr.length > 0) {
                    filters.push("and", ["internalid","noneof",jeArr]);
                }
            }
         log.audit("data",new Date("2024/01/01"));
            filters.push("and", ["trandate","notwithin",format.format({value:new Date("2024/01/01"),type:format.Type.DATE}),format.format({value:new Date("2024/02/29"),type:format.Type.DATE})]);
  
            return filters;
        }

        /**
         * 根据动态筛选器检索货品相关信息,
         * @param {Array} filters
         * @return {Array} vbDataArr
         */
        function srchByJeFilters(filters){
            var journalentrySearchObj = search.create({
                type: "transaction",
                filters: filters, 
                columns:
                    [
                        search.createColumn({name: "internalid", summary: "GROUP", label: "内部 ID"}),
                        search.createColumn({name: "trandate", summary: "GROUP", label: "日期"}),
                        search.createColumn({name: "creditamount", summary: "SUM", label: "金额（贷记）"}),
                        search.createColumn({name: "creditfxamount", summary: "SUM", label: "金额（贷记）（外币）"}),
                        search.createColumn({name: "custcol_swc_jon_employee", summary: "GROUP", label: "员工"}),
                        search.createColumn({name: "subsidiary", summary: "GROUP", label: "子公司"}),
                        search.createColumn({name: "currency", summary: "GROUP", label: "货币"}),
                        search.createColumn({name: "exchangerate", summary: "GROUP", label: "汇率"})
                    ]
            });
            var srchRst = getAllResultsOfSearch(journalentrySearchObj); // 获取对应的所有信息{Array}
            var vbDataArr = []; // 创建数组，用于存放数据
            if (srchRst.length > 0) {
                for (var i = 0; i < srchRst.length; i++) {
                    var vbDataObj = {
                        'je_intlid':  srchRst[i].getValue({name: "internalid", summary: "GROUP", label: "内部 ID"}), // 获取日记账ID，用于子列表赋值
                        'je_amount': srchRst[i].getValue({name: "creditfxamount", summary: "SUM", label: "金额（贷记）（外币）"}), // 获取贷记金额，用于子列表赋值
                        'je_emp': srchRst[i].getValue({name: "custcol_swc_jon_employee", summary: "GROUP", label: "员工"}), // 获取员工，用于子列表赋值
                        'je_subs': srchRst[i].getValue({name: "subsidiary", summary: "GROUP", label: "子公司"}), // 获取子公司，用于子列表赋值
                        'je_curr': srchRst[i].getValue({name: "currency", summary: "GROUP", label: "货币"}), // 获取货币，用于子列表赋值
                        'je_rate': srchRst[i].getValue({name: "exchangerate", summary: "GROUP", label: "汇率"}), // 获取汇率，用于子列表赋值
                        'je_date': srchRst[i].getValue({name: "trandate", summary: "GROUP", label: "日期"}), // 获取日期，用于子列表赋值
                    }
                    vbDataArr.push(vbDataObj);
                }
            }
            return vbDataArr; // 返回数据
        }

        /**
         * 根据动态筛选器检索货品相关信息,
         * @param {Object} vbSubDataObj 页面勾选的子列表信息对象
         * @return {String} jeRecId
         */
        function crtJeByData(vbSubDataObj){
            // 首先获取各种信息
            var vbSubs = vbSubDataObj.vbSubs; // 获取"子公司";
            var vbCurr = vbSubDataObj.vbCurr; // 获取"币种";
            var vbPeriod = vbSubDataObj.vbPeriod; // 获取"过账期间";
            var vbAmt = vbSubDataObj.vbAmt; // 获取"余额";
            var vbAcctNm = vbSubDataObj.vbAcctNm; // 获取"科目";
            // 根据数据,创建日记账
            var jeRec = record.create({type: record.Type.JOURNAL_ENTRY, isDynamic: true}); // 创建日记账(之后会根据余额的正负生成不同子列表的日记账);
            if (vbSubs) jeRec.setValue({fieldId: 'subsidiary', value: vbSubs}); // 向日记账分录赋值（子公司）与"虚拟银行余额调整"的子公司ID一致;
            if (vbCurr) jeRec.setValue({fieldId: 'currency', value: vbCurr}); // 向日记账赋值（币种）与"虚拟银行余额调整"的币种页面一致;
            // if(vbPeriod) jeRec.setValue({fieldId: 'postingperiod', value:vbPeriod}); // 向日记账赋值（过账期间）与"虚拟银行余额调整"的期间一致;
            // 之后根据"科目余额"的正负,生成对应的日记账子列表信息;
            if (vbAmt && vbAmt > 0) {
                jeRec.selectNewLine({sublistId: 'line'}); // 首先在子列表添加新行;
                log.audit("添加借方","添加借方");
                jeRec.setCurrentSublistValue({sublistId: 'line', fieldId: 'account', value: 421}); //向日记账子列表赋值（借方科目）科目为:借：12210101 其他应收款 : 关联方往来 : 日常往来及代垫代付款项(不计息)
                jeRec.setCurrentSublistValue({sublistId: 'line', fieldId: 'debit', value: vbAmt}); // 向日记账子列表赋值（借方金额）与"虚拟银行余额调整"金额一致;
                jeRec.setCurrentSublistValue({sublistId: 'line', fieldId: 'department', value: 1}); // TODO 责任中心必填项取值需要询问
                jeRec.setCurrentSublistValue({sublistId: 'line', fieldId: 'entity', value: 559}); // 向日记账子列表赋值（往来名称）客户为：C0025 Sumec Shipping Pte. Ltd
                jeRec.commitLine({sublistId: 'line'}); // 提交当前行
                jeRec.selectNewLine({sublistId: 'line'}); // 在子列表添加新行;
                log.audit("添加贷方","添加贷方");
                if (vbAcctNm) jeRec.setCurrentSublistValue({sublistId: 'line', fieldId: 'account', value: vbAcctNm}); // 向日记账子列表赋值（借方科目）与"虚拟银行余额调整"科目一致;
                jeRec.setCurrentSublistValue({sublistId: 'line', fieldId: 'credit', value: vbAmt}); // 向日记账子列表赋值（借方金额）与"虚拟银行余额调整"金额一致;
                jeRec.setCurrentSublistValue({sublistId: 'line', fieldId: 'department', value: 1}); // TODO 责任中心必填项取值需要询问
                jeRec.setCurrentSublistValue({sublistId: 'line', fieldId: 'entity', value: 559}); // 向日记账子列表赋值（往来名称）客户为：C0025 Sumec Shipping Pte. Ltd
                jeRec.commitLine({sublistId: 'line'}); // 提交当前行
            }
            // 这里直接排除"科目余额"为0的情况
            else if (vbAmt && vbAmt < 0) {
                jeRec.selectNewLine({sublistId: 'line'}); // 首先在子列表添加新行;
                log.audit("添加借方","添加借方");
                if (vbAcctNm) jeRec.setCurrentSublistValue({sublistId: 'line', fieldId: 'account', value: vbAcctNm}); // 向日记账子列表赋值（借方科目）与"虚拟银行余额调整"科目一致;
                jeRec.setCurrentSublistValue({sublistId: 'line', fieldId: 'debit', value: vbAmt}); // 向日记账子列表赋值（借方金额）与"虚拟银行余额调整"金额一致;
                jeRec.setCurrentSublistValue({sublistId: 'line', fieldId: 'department', value: 1}); // TODO 责任中心必填项取值需要询问
                jeRec.setCurrentSublistValue({sublistId: 'line', fieldId: 'entity', value: 216}); // 向日记账子列表赋值（往来名称）客户为：C0025 Sumec Shipping Pte. Ltd
                jeRec.commitLine({sublistId: 'line'}); // 提交当前行
                jeRec.selectNewLine({sublistId: 'line'}); // 在子列表添加新行;
                log.audit("添加贷方","添加贷方");
                jeRec.setCurrentSublistValue({sublistId: 'line', fieldId: 'account', value: 455}); //向日记账子列表赋值（借方科目）科目为:借：12210101 其他应收款 : 关联方往来 : 日常往来及代垫代付款项(不计息)
                jeRec.setCurrentSublistValue({sublistId: 'line', fieldId: 'credit', value: vbAmt}); // 向日记账子列表赋值（借方金额）与"虚拟银行余额调整"金额一致;
                jeRec.setCurrentSublistValue({sublistId: 'line', fieldId: 'department', value: 1}); // TODO 责任中心必填项取值需要询问
                jeRec.setCurrentSublistValue({sublistId: 'line', fieldId: 'entity', value: 216}); // 向日记账子列表赋值（往来名称）客户为：C0025 Sumec Shipping Pte. Ltd
                jeRec.commitLine({sublistId: 'line'}); // 提交当前行
            }
            // 保存日记账记录
            log.audit("日记账保存", "日记账保存");
            var jeRecId = jeRec.save({ignoreMandatoryFields:true});
            // 输出保存的日记账 ID
            log.audit('日记账创建成功,保存ID为', jeRecId);
            return jeRecId;
        }

        /**
         * 用于获取所有【预付款科目】的信息,
         * @return {Array} acctArr(预付款科目数组)
         */
        function getAllPrepaidAcct() {
            var accountSearchObj = search.create({
                type: "account",
                filters:
                    [
                        ["number","startswith","1123"]
                    ],
                columns:
                    [
                        search.createColumn({name: "name", label: "名称"}),
                        search.createColumn({name: "displayname", label: "显示名称"}),
                        search.createColumn({name: "type", label: "科目类型"}),
                        search.createColumn({name: "description", label: "说明"}),
                        search.createColumn({name: "balance", label: "余额"}),
                        search.createColumn({name: "custrecord_fam_account_showinfixedasset", label: "在 Fixed Assets Management 中显示"}),
                        search.createColumn({name: "internalid", label: "内部 ID"}),
                        search.createColumn({
                            name: "number",
                            sort: search.Sort.ASC,
                            label: "编号"
                        })
                    ]
            });
            var srchRst = getAllResultsOfSearch(accountSearchObj);
            var acctArr = []; // 创建对应数组,用于放入值
            // 遍历整个搜索结果,获取对应的值
            for (var i = 0; i < srchRst.length; i++) {
                var acctObj = {
                    'acctId' :  srchRst[i].getValue({name: "internalid", label: "内部 ID"}), // 银行科目的ID(用于检索)
                    'acctNm' : srchRst[i].getValue({name: "number", label: "编号"})+' '+　srchRst[i].getValue({name: "name", label: "名称"}), // 银行科目的名称(用于选中)
                }
                acctArr.push(acctObj); // 将对应取值放入数组中
            }
            return acctArr; // 将检索数据返回
        }

        /**
         * 用于获取所有【日记账预付核销】的【日记账ID】【行ID】【剩余应核销金额】
         * @return {Array} acctArr(预付款数据数组)
         */
        function getAllPrepaidVerif() {
            try {
                var customrecord_swc_multiterm_writeoffSearchObj = search.create({
                    type: "customrecord_swc_multiterm_writeoff",
                    filters:
                        [
                            ["isinactive","is","F"]
                        ],
                    columns:
                        [
                            search.createColumn({
                                name: "internalid",
                                sort: search.Sort.DESC,
                                label: "内部 ID"
                            }),
                            search.createColumn({name: "custrecord_swc_current_journal", label: "主行日记账"}),
                            search.createColumn({name: "custrecord_swc_currentjournalentrylinenu", label: "主行日记账_行id"}),
                            search.createColumn({name: "custrecord_swc_verification_surplus", label: "主行日记账_剩余可核销金额"}),
                            search.createColumn({name: "custrecord_swc_write_off_to", label: "核销日记账"}),
                            search.createColumn({name: "custrecord_swc_writeofftojournalentrylin", label: "核销日记账_行id"}),
                            search.createColumn({name: "custrecord_swc_write_off_to_surplus", label: "核销日记账_剩余可核销金额"})
                        ]
                });
                var srchRst = getAllResultsOfSearch(customrecord_swc_multiterm_writeoffSearchObj);
                var verifDataArr = [];
                for (var i = 0;i < srchRst.length; i++) {
                    var varifDataObj = {
                        'verif_intlid' :  srchRst[i].getValue({name: "internalid", sort: search.Sort.DESC, label: "内部 ID"}), // 预付核销【内部ID】(用于检索)
                        'verif_mainje_id' :  srchRst[i].getValue({name: "custrecord_swc_current_journal", label: "主行日记账"}), // 预付核销【主行日记账ID】(用于检索)
                        'verif_mainje_lineid' :  srchRst[i].getValue({name: "custrecord_swc_currentjournalentrylinenu", label: "主行日记账_行id"}), // 预付核销【主行日记账,行ID】(用于检索)
                        'verif_mainje_leftamt' :  srchRst[i].getValue({name: "custrecord_swc_verification_surplus", label: "主行日记账_剩余可核销金额"}), // 预付核销【主行日记账，可核销金额】(用于检索)
                        'verif_verifje_id' :  srchRst[i].getValue({name: "custrecord_swc_write_off_to", label: "核销日记账"}), // 预付核销主行日记账ID(用于检索)
                        'verif_verifje_lineid' :  srchRst[i].getValue({name: "custrecord_swc_writeofftojournalentrylin", label: "核销日记账_行id"}), // 预付核销主行日记账ID(用于检索)
                        'verif_verifje_leftamt' :  srchRst[i].getValue({name: "custrecord_swc_write_off_to_surplus", label: "核销日记账_剩余可核销金额"}), // 预付核销主行日记账ID(用于检索)
                    }
                    verifDataArr.push(varifDataObj); // 将对应取值放入数组中
                }
                return verifDataArr;
            } catch (e) {
                log.audit("单据信息","获取所有【日记账预付核销】的【日记账ID】【行ID】【剩余应核销金额】数据为空!" + e);
            }
        }

        /**
         * 根据【批量支付员工费用报销】数据创建【费用报销日记账中间表】
         * @param {Array} subData(子列表数据)
         * @return {String} multVerifId（多项核销ID）
         */
        function crtMidRecByJeData(subData) {
            try {
                if (subData && subData.length > 0) {
                    var midRec = record.create({type: "customrecord_swc_crtjebyreimb_midrec"});
                    var jsonData1 = {};
                    var jsonData2 = {};
                    var jeIdArr = {};
                    for (var i = 0; i < subData.length; i++) {
                        var jeId = subData[i].dh;
                        jeIdArr[i] = jeId;
                        log.audit("subData[i]",subData[i].dh);
                        if (i <= 1000) {
                            jsonData1[i] = subData[i];
                        } else {
                            jsonData2[i] = subData[i];
                        }
                    }
                    log.audit("jsonData1",jsonData1);
                    midRec.setValue({fieldId: "custrecord_swc_json1", value: JSON.stringify(jsonData1)}); // 将前500项数据赋值到字段1
                    midRec.setValue({fieldId: "custrecord_swc_json2", value: JSON.stringify(jsonData2)}); // 将后500项数据赋值到字段2
                    midRec.setValue({fieldId: "custrecord_swc_jeid_array", value: JSON.stringify(jeIdArr)}); // 将【日记账ID数组】赋值对应字段
                    var midRecId =  midRec.save();
                }
                if (midRecId) {
                    return {
                        "successflag" : "success",
                        "message" : "生成中间表成功",
                        "midRecId": midRecId
                    }
                }
            } catch (e) {
                return {
                    "successflag" : "faliure",
                    "message" : "生成中间表出错：" + e,
                    "midRecId": ""
                }
            }

        }

        function getAllCust() {
            var customerSearchObj = search.create({
                type: "customer",
                filters:
                    [
                        ["stage","anyof","CUSTOMER"]
                    ],
                columns:
                    [
                        search.createColumn({name: "internalid", label: "内部 ID"}),
                        search.createColumn({name: "altname", label: "名称"}),
                        search.createColumn({
                            name: "entityid",
                            sort: search.Sort.ASC,
                            label: "ID"
                        })
                    ]
            });
            var srchRst = getAllResultsOfSearch(customerSearchObj);
            var custArr = [];
            for (var i = 0; i < srchRst.length; i++) {
                var altname = srchRst[i].getValue({name: "altname", label: "名称"}); // 获取[名称]
                var altId = srchRst[i].getValue({name: "entityid", sort: search.Sort.ASC, label: "ID"}); // 获取[ID]
                var custNm;
                if (!altname) {
                    custNm = altId;
                }
                if (altname &&　altId)　{
                    custNm = altId + ' ' + altname
                }
                var custObj = {
                    'custId' :  srchRst[i].getValue({name: "internalid", label: "内部 ID"}), // 银行科目的ID(用于检索)
                    'custNm' : custNm, // 银行科目的名称(用于选中)
                }
                custArr.push(custObj);
            }
            if (custArr && custArr.length > 0) return custArr;
        }

        function getAllVendor() {
            var vendorSearchObj = search.create({
                type: "vendor",
                filters:
                    [
                    ],
                columns:
                    [
                        search.createColumn({
                            name: "entityid",
                            sort: search.Sort.ASC,
                            label: "名称"
                        }),
                        search.createColumn({name: "internalid", label: "内部 ID"}),
                        search.createColumn({name: "phone", label: "电话"}),
                        search.createColumn({name: "altphone", label: "办公室电话"}),
                        search.createColumn({name: "fax", label: "传真"}),
                        search.createColumn({name: "altemail", label: "其他电子邮件"})
                    ]
            });
            var srchRst = getAllResultsOfSearch(vendorSearchObj);
            var vendorArr = [];
            for (var i = 0; i < srchRst.length; i++) {
                var vendorObj = {
                    'vendorId' :  srchRst[i].getValue({name: "internalid", label: "内部 ID"}), // 银行科目的ID(用于检索)
                    'vendorNm' : srchRst[i].getValue({name: "entityid", label: "名称"}), // 银行科目的名称(用于选中)
                }
                vendorArr.push(vendorObj);
            }
            if (vendorArr && vendorArr.length > 0) return vendorArr;
        }

        // =========================== Sl end ===============================

        // --------------------------- CS start -----------------------------

        /**
         * 根据【子公司】,通过对应的【费用报销公司记录】，检索对应的【默认付款银行账户】
         * @param {String} subsId (子公司ID)
         * @return 数据结果数组
         */
        function getBankAcctBySubs(subsId) {
            var customrecord_swc_expense_sublistSearchObj = search.create({
                type: "customrecord_swc_expense_sublist",
                filters:
                    [
                        ["custrecord_expense_subname","anyof",subsId]
                    ],
                columns:
                    [
                        search.createColumn({name: "custrecord_expense_banknum", label: "默认银行账号"})
                    ]
            });
            var srchRst = getAllResultsOfSearch(customrecord_swc_expense_sublistSearchObj);
            if (srchRst && srchRst.length > 0) {
                return {'bankAcct': srchRst[0].getValue({name: "custrecord_expense_banknum", label: "默认银行账号"})};
            } else {
                return {'bankAcct': 'bankAcctNotExist'};
            }
        }

        /**
         * 根据表单对象，获取页面上所有字段的值
         * @param {Object} currRec (表单对象)
         * @return 数据结果数组
         */
        function getBodyValue(currRec) {
            var jeSubs = currRec.getValue({fieldId: "custpage_swc_subs"}); // 获取“子公司”的ID(用于作为检索条件查询日记账并赋值到子列表上);
            var jeEmp = currRec.getValue({fieldId: "custpage_swc_employee"}); // 获取“员工”的ID(用于作为检索条件查询日记账并赋值到子列表上);
            var jeBankAcct = currRec.getValue({fieldId: "custpage_swc_bankamount"}); // 获取“默认付款银行账户”的ID(用于作为检索条件查询日记账并赋值到子列表上);
            // 将获取的字段数据整合成JSON串,作为子列表检索条件
            var option = {
                'jeSubs': jeSubs,
                'jeEmp': jeEmp,
                'jeBankAcct': jeBankAcct
            }
            return option;
        }

        /**
         * 根据表单对象，获取页面上所有字段的值
         * @param {Object} currRec(表单对象)
         * @param {Object} option(单据头数据)
         * @return {Array} vbDataArr (数据结果数组,用于生成日记账)
         */
        function getSubInfoData(currRec,option) {
            try {
                log.audit("单据信息","开始获取子列表数据！");
                var vbSubCount = currRec.getLineCount({sublistId: 'custpage_sublist'}); // 获取子列表行数,用于遍历子列表;
                var verifDataArr = []; // 创建空数组,用于存放【核销】勾选的【日记账】数据;
                for (var i = 0; i < vbSubCount; i++) {
                    var mainCheck = currRec.getSublistValue({sublistId: "custpage_sublist", fieldId: "custpage_sub_checkmain", line: i}); // 获取【主行勾选】
                    var verifCheck = currRec.getSublistValue({sublistId: "custpage_sublist", fieldId: "custpage_sub_checkverif", line: i}); // 获取【核销勾选】
                    var verifAmt = currRec.getSublistValue({sublistId: "custpage_sublist", fieldId: "custpage_sub_verifamount", line: i}); // 获取【本次核销金额】
                    var jeTdData = currRec.getSublistValue({sublistId: "custpage_sublist", fieldId: "custpage_sub_journalentry", line: i}); // 获取【日记账ID】
                    var jeDate = currRec.getSublistValue({sublistId: "custpage_sublist", fieldId: "custpage_sub_date", line: i}); // 获取【日期】
                    var lineIdData = currRec.getSublistValue({sublistId: "custpage_sublist", fieldId: "custpage_sub_lineid", line: i}); // 获取【行ID】
                    var jeAcct = option.vbAcctData; // 获取【科目】
                    var jeSubs = option.vbSubs; // 获取【子公司】
                    var jeVendor = option.vbVendor; // 获取【供应商】
                    var orgAmt = currRec.getSublistValue({sublistId: "custpage_sublist", fieldId: "custpage_sub_orgamount", line: i}); // 获取【原始金额】
                    var leftAmt = currRec.getSublistValue({sublistId: "custpage_sublist", fieldId: "custpage_sub_leftamount", line: i}); // 获取【剩余可核销金额】
                    // 如果【主行】勾选，则获取主行数据
                    if (mainCheck == true) {
                        var mainJeObj = {
                            'main_je_id': jeTdData, // 主行日记账
                            'main_je_date': jeDate, // 主行日记账_日期
                            'main_je_lineid': lineIdData, // 主行日记账_行ID
                            'main_je_acct': jeAcct, // 主行日记账_科目
                            'main_je_subs': jeSubs, // 主行日记账_子公司
                            'main_je_vendor': jeVendor, // 主行日记账_供应商
                            'main_je_amt': orgAmt, // 主行日记账_金额
                            'main_je_leftamt': leftAmt, // 主行日记账_剩余可核销金额
                        }
                    }
                    // 如果【核销】勾选，则获取核销数据并添加到数组里
                    if (verifCheck == true) {
                        var verifJeObj = {
                            'verif_je_id': jeTdData, // 主行日记账
                            'verif_je_date': jeDate, // 主行日记账_日期
                            'verif_je_lineid': lineIdData, // 主行日记账_行ID
                            'verif_je_acct': jeAcct, // 主行日记账_科目
                            'verif_je_subs': jeSubs, // 主行日记账_子公司
                            'verif_je_vendor': jeVendor, // 主行日记账_供应商
                            'verif_je_amt': orgAmt, // 主行日记账_金额
                            'verif_je_leftamt': leftAmt, // 主行日记账_剩余可核销金额
                            'curr_verif_amt': verifAmt // 本次核销金额
                        }
                        if (verifJeObj.hasOwnProperty("verif_je_id")) verifDataArr.push(verifJeObj);
                    }
                }
                log.audit("单据信息","完成获取子列表信息！");
                return {
                    "verifDataArr": verifDataArr,
                    "mainJeObj" : mainJeObj
                }; // 将存放所有数据的数组返回，用于生成日记账
            } catch (e) {
                log.audit("错误信息",e)
            }
        }
        // ---------------------------- CS end ------------------------------

        // ------------------ common function start -------------------------

        /**
         * 获取所有[中间表]的数据
         * @param saveSearch 保存检索
         * @return 数据结果数组
         */
        function getMiddleRecArr () {
            var customrecord_swc_crtjebyreimb_midrecSearchObj = search.create({
                type: "customrecord_swc_crtjebyreimb_midrec",
                filters:
                    [
                    ],
                columns:
                    [
                        search.createColumn({name: "custrecord_swc_jeid_array", label: "日记账单号数组"}),
                        search.createColumn({
                            name: "created",
                            sort: search.Sort.DESC,
                            label: "创建日期"
                        })
                    ]
            });
            var srchRst = getAllResultsOfSearch(customrecord_swc_crtjebyreimb_midrecSearchObj);
            if (srchRst && srchRst.length > 0) {
                for (var i = 0; i < srchRst.length; i++) {
                    return {"returnFlag": "dataInfo", "returnData": srchRst[0].getValue({name: "custrecord_swc_jeid_array", label: "日记账单号数组"})};
                }
            }
            return {"returnFlag": "noData"};
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

        // 获取当前月最后一天
        function getCurrentMonthFinally() {
            var date = new Date();
            date = getDate(date);
            date.setMonth(date.getMonth() + 1);
            return formatDate(new Date(date.setDate(0)));
        }

        // 获取月初第一天
        function getCurrentMonthFirst() {
            var date = new Date();
            date = getDate(date);
            return formatDate(new Date(date.setDate(1)));
        }

        /**
         * @description Date对象被转换为字符串
         * @param {*} date | <Date new Date()||"2019-04-16T03:37:22.032Z">
         * @return dateStr | <String '15/4/2019'>
         */
        function formatDate(date) {
            return format.format({
                value: date,
                type: format.Type.DATE,
            });
        }

        /**
         * 转换成正8区时间
         * @param times
         * @returns {Date}
         */
        function getDate(times) {
            var timeZone = 8;
            var date = new Date(times);
            var utcTime = date.getTime() + date.getTimezoneOffset() * 60 * 1000;
            var tzTime = utcTime + timeZone * 60 * 60 * 1000;
            return new Date(tzTime);
        }

        /**
         * 转换成正8区时间
         * @param times
         * @returns {Date}
         */
        function getDate2(times) {
            var timeZone = 16;
            var date = new Date(times);
            var utcTime = date.getTime() + date.getTimezoneOffset() * 60 * 1000;
            var tzTime = utcTime + timeZone * 60 * 60 * 1000;
            return new Date(tzTime);
        }

        // 日期转换
        function getModifyDate(date) {
            if(date && date !="null"){
                var modifyDateArr = null;
                if (date.indexOf("T")) {
                    modifyDateArr = date.split("T")[0].split("-"); // [2022,11,11];
                } else {
                    modifyDateArr = date.split("-"); // [2022,11,11];
                }
                return format.parse({
                    value:(format.format({
                        value:new Date(modifyDateArr[0],Number(modifyDateArr[1])-1,modifyDateArr[2]),
                        type:format.Type.DATETIME,
                        timezone:format.Timezone.ASIA_HONG_KONG
                    })).split(' ')[0],
                    type:format.Type.DATE
                });
            }
            return "";
        }

        // ------------------- common function end ---------------------------

        return {
            getBodyValue:getBodyValue,
            getJeFilter:getJeFilter, //根据【批量支付员工费用报销】页面传来的【子公司】【员工】作为保存检索条件
            srchByJeFilters:srchByJeFilters, // 根据【保存检索条件】检索对应的【日记账数据】
            getSubInfoData:getSubInfoData,
            crtJeByData:crtJeByData,
            getCurrentMonthFinally: getCurrentMonthFinally,
            getCurrentMonthFirst: getCurrentMonthFirst,
            getAllPrepaidAcct: getAllPrepaidAcct, // 用于获取所有【预付款科目】的信息
            getAllPrepaidVerif: getAllPrepaidVerif, // 用于获取所有【日记账预付核销】的【日记账ID】【行ID】【剩余应核销金额】
            crtMidRecByJeData: crtMidRecByJeData, // 根据【批量支付员工费用报销】数据创建【费用报销日记账中间表】
            getAllCust: getAllCust, // 用于获取所有客户
            getAllVendor: getAllVendor, // 用于获取供应商
            getBankAcctBySubs: getBankAcctBySubs, // 根据【子公司】,通过对应的【费用报销公司记录】，检索对应的【默认付款银行账户】
        };

    });
