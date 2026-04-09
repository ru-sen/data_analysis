/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 */
define(['N/runtime', 'N/task', 'N/record', 'N/currentRecord', 'N/search', '../../common/SWC_CONFIG_DATA.js', 'N/format'],

    (runtime, task, record, currentRecord, search, SWC_CONFIG_DATA, format) => {
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
            // 1.通过检索获取未付款的银行对账单
            var customrecord_swc_bank_reconciliationSearchObj = search.create({
                type: "customrecord_swc_bank_reconciliation",
                filters:
                    [
                        ["custrecord_br_pay_num","anyof","@NONE@"]
                    ],
                columns:
                    [
                        search.createColumn({
                            name: "name",
                            sort: search.Sort.ASC,
                            label: "ID"
                        }),
                        search.createColumn({name: "custrecord_br_trandate", label: "交易日期"}),
                        search.createColumn({name: "custrecord_br_bank_account", label: "银行类科目"}),
                        search.createColumn({name: "custrecord_br_remittance_information", label: "汇寄信息"}),
                        search.createColumn({name: "custrecord_br_original_amount", label: "原始金额"}),
                        search.createColumn({name: "custrecord_br_original_currency", label: "原始货币"}),
                        search.createColumn({name: "custrecord_br_exchange_rate", label: "汇率"}),
                        search.createColumn({name: "custrecord_br_memo", label: "摘要"}),
                        search.createColumn({name: "custrecord_br_collection_number", label: "collection number"}),
                        search.createColumn({name: "custrecord_br_income_account", label: "收入差异科目"}),
                        search.createColumn({name: "custrecord_br_variance_amount", label: "差异科目金额（原始货币）"}),
                        search.createColumn({name: "internalid", label: "内部 ID"}),
                        search.createColumn({name: "custrecord_br_jon_num", label: "差异科目日记账单号"})
                    ]
            });
            var srchRst = getAllResultsOfSearch(customrecord_swc_bank_reconciliationSearchObj);
            // 建立对账单对象,用于保存数据
            var backRecoArr = [];
            var bankRecoInfoObj = {}
            // 遍历保存检索,将数据对象属性添加到对象中
            for (var i = 0; i < srchRst.length; i++) {
                // 从保存检索取值
                var br_id = srchRst[i].getValue({name: "name", sort: search.Sort.ASC, label: "ID"}); // 银行对账单ID
                var br_trandate = srchRst[i].getValue({name: "custrecord_br_trandate", label: "交易日期"}); // 银行对账单交易日期
                var br_bank_acct = srchRst[i].getValue({name: "custrecord_br_bank_account", label: "银行类科目"}); // 银行对账单中银行类科目
                var br_original_amount = srchRst[i].getValue({name: "custrecord_br_original_amount", label: "原始金额"}); // 银行对账单原始金额
                var br_original_currency = srchRst[i].getValue({name: "custrecord_br_original_currency", label: "原始货币"}); // 银行对账单原始货币v
                var br_exchange_rate = srchRst[i].getValue({name: "custrecord_br_exchange_rate", label: "汇率"}); // 银行对账单汇率
                var br_memo = srchRst[i].getValue({name: "custrecord_br_memo", label: "摘要"}); // 银行对账单摘要
                var br_collection_number = srchRst[i].getValue({name: "custrecord_br_collection_number", label: "collection number"}); // 银行对账单collection number
                var br_income_account = srchRst[i].getValue({name: "custrecord_br_income_account", label: "收入差异科目"}); // 银行对账单收入差异科目
                var br_variance_amount = srchRst[i].getValue({name: "custrecord_br_variance_amount", label: "差异科目金额（原始货币）"}); // 银行对账单差异科目金额
                var intl_id = srchRst[i].getValue({name: "internalid", label: "内部 ID"}); // 对账单内部ID用于反写错误信息
                var br_jon_num = srchRst[i].getValue({name: "custrecord_br_jon_num", label: "差异科目日记账单号"}); // 对账单“差异科目日记帐单号”用于判断是否生成日记账
                // 向对象赋值 格式：{id1：{},id2:{},....}(2.如果collection number存在，则添加对象数据)
                // TODO 这里需要优化处理，需要考虑不同的日期格式
                var br_time = new Date(br_trandate).getTime();// 将日期转化为毫秒格式
                // log.audit("毫秒",br_time);
                if (br_collection_number)bankRecoInfoObj[br_id] = {
                    'br_trandate': br_time,
                    'br_original_amount': br_original_amount,
                    'br_original_currency': br_original_currency,
                    'br_exchange_rate': br_exchange_rate,
                    'br_memo': br_memo,
                    'br_collection_number': br_collection_number,
                    'br_income_account': br_income_account,
                    'br_variance_amount': br_variance_amount,
                    'br_bank_acct': br_bank_acct,
                    'intl_id': intl_id,
                    'br_jon_num':br_jon_num
                };
            }
            // 返回将对象添加到数组中，用于reduce处理，返回数组
            backRecoArr.push(bankRecoInfoObj);
            log.audit("检索对象",bankRecoInfoObj);
            return backRecoArr;
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
                key : mapContext.key,
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
            // 从Map接收数据
            log.audit("reduce数据",reduceContext);
            var allInfo = JSON.parse(reduceContext.values);
            log.audit("处理后的数据", allInfo);
            // 获取对应单据的collection number
            var i = 0;
            for (var key in allInfo){
                i++;
                var adjTime = 0; // 写一个变量防止if条件嵌套多层
                var collectionNum = allInfo[key]["br_collection_number"]; // 获取对账单collection number
                var br_intlId = allInfo[key]["intl_id"]; // 银行对账单ID用于反写
                var br_curr = allInfo[key]["br_original_currency"]; // 对账单原始货币，用于和发票币种比对
                var br_exch_rate = allInfo[key]["br_exchange_rate"]; // 对账单汇率，用于倒除
                var br_org_amt = allInfo[key]["br_original_amount"]; // 订单原始金额
                var br_inc_acct = allInfo[key]["br_income_account"]; // 收入差异科目，用于判断以及生成日记账
                var br_date = allInfo[key]["br_trandate"]; // 交易日期，用于创建日记账
                var br_memo = allInfo[key]["br_memo"]; // 对账单摘要，用于创建日记账
                var br_vari_amt = allInfo[key]["br_variance_amount"]; // 原始差异科目，用于日记账赋值
                var br_bank_acct = allInfo[key]["br_bank_acct"]; // 对账单银行类科目，用于付款单赋值
                var br_jon_num = allInfo[key]["br_jon_num"]; // 对账单“差异科目日记账编号”，用于判断以及生成日记账
                // log.audit("第"+i+"项collection number",collectionNum);
                // 3.根据collection number获取对应的发票，4.获取对应发票的货币和客户字段
                var invoiceRst = getInvoiceByCollNum(collectionNum);
                log.audit("第"+i+"项对应发票数据",invoiceRst);
                // 如果返回的是错误信息，则将错误信息反写到对应的银行对账单上
                if (invoiceRst == "invoiceNotExist") {
                    //使用SubmitFields反写节约资源
                    record.submitFields({
                        type: 'customrecord_swc_bank_reconciliation',
                        id: br_intlId,
                        values:{
                          custrecord_br_error : '异常信息：对应发票不存在！'
                        }
                    });
                    continue;
                }
                // 如果返回的是对象，则比较发票币种和对账单货币,
                else {
                    // log.audit("第"+i+"项发票币种", invoiceRst.invoice_currency);
                    // log.audit("第"+i+"项对账单货币", br_curr);
                    // log.audit("第"+i+"项倒除前金额：", br_org_amt);
                    // 如果不一致则需要倒除汇率
                    if (invoiceRst.invoice_currency != br_curr) {
                        br_org_amt /= br_exch_rate;
                        log.audit("第"+i+"项倒除后金额", br_org_amt);
                        adjTime = 1;
                    }
                    // 如果一样，则不做处理
                    else {
                        log.audit("第"+i+"项无需倒除",br_org_amt);
                        adjTime = 1;
                    }
                }
                // 如果原始金额处理结束，则需要判断”是否存在差异科目“
                if (adjTime == 1){
                    // 如果“差异科目日记账”存在，直接根据日记账和发票生成付款单
                    if (br_jon_num){
                        log.audit("根据已有日记账生成付款单","根据已有日记账生成付款单");
                        // 创建信息对象，将需要填写的内容（发票内部ID,对账单的银行科目，原始金额）放入对象中
                        var jeJonInfoObj = {
                            'inv_id':invoiceRst.invoice_id, // 发票内部ID（用于创建付款单）
                            'br_bank_acct':br_bank_acct, // 对账单银行类科目（用于付款单赋值）
                            'br_org_amt' : br_org_amt, // 处理后的原始金额（用于付款单赋值）
                            'br_vari_amt' : br_vari_amt, // 日记账的借贷金额（用于核销日记账）
                            'je_rec_id' : br_jon_num, // 日记账的内部ID（用于核销日记账）这里可以直接取“差异科目日记账”ID
                            'br_memo': br_memo, // 对账单上的摘要（用于付款单赋值）
                        }
                        // 根据对应信息创建对应付款单
                        var jeJonId = crtPaymentByInvoice(jeJonInfoObj);
                        if (jeJonId.errorInfo){
                            record.submitFields({
                                type: 'customrecord_swc_bank_reconciliation',
                                id: br_intlId,
                                values:{
                                    custrecord_br_error : '付款单生成错误，错误信息：' + jeJonId.errorInfo
                                }
                            });
                            continue;
                        }
                        try {
                            if (jeJonId) {
                                // 最后将对应的付款单ID反写到对应的银行对账单上
                                //使用SubmitFields反写节约资源
                                record.submitFields({
                                    type: 'customrecord_swc_bank_reconciliation',
                                    id: br_intlId,
                                    values: {
                                        custrecord_br_pay_num: jeJonId,
                                    }
                                });
                                log.audit("alertLog", "创建付款单反写成功,流程结束");
                            }
                        } catch (e) {
                            log.audit("付款单反写异常",e);
                        }
                    }
                    // 如果”收入差异科目“存在，“差异科目日记账”不存在则需要生成对应日记账
                    else if (br_inc_acct && !br_jon_num){
                        // 将需要的信息放入对象中，生成对应日记账
                        var dataInfoObj = {
                            'inv_subs': invoiceRst.invoice_subs, // 发票上的子公司（用于日记账赋值）
                            'inv_curr': invoiceRst.invoice_currency, // 发票上的货币币种（用于判断倒除）
                            'inv_cust': invoiceRst.customer_id, // 发票上的客户ID（用于日记账赋值）
                            'br_curr' :　br_curr, // 对账单上的货币币种（用于判断是否倒除）
                            'br_trandate': br_date, // 对账单上的交易日期
                            'br_memo': br_memo, // 对账单上的摘要
                            'br_inc_acct': br_inc_acct, // 收入差异科目
                            'br_vari_amt': br_vari_amt, // 原始差异金额（用于）
                            'br_exch_rate':br_exch_rate // 对账单汇率（用于倒除）
                        }
                        log.audit("dataInfoObj对象",dataInfoObj);
                        // 生成日记账
                        var jeRecId = crtJeByInfo(dataInfoObj);
                        // 如果生成日记账报错，需要将错误信息反写
                        if (jeRecId.errorInfo){
                            record.submitFields({
                                type: 'customrecord_swc_bank_reconciliation',
                                id: br_intlId,
                                values:{
                                    custrecord_br_error : '日记账生成错误，错误信息：' + jeRecId.errorInfo
                                }
                            });
                            continue;
                        }
                        // 如果生成日记账正确，需要将日记账ID反写到“差异科目日记账”上
                        else{
                            record.submitFields({
                                type: 'customrecord_swc_bank_reconciliation',
                                id: br_intlId,
                                values:{
                                    custrecord_br_jon_num : jeRecId
                                }
                            });
                        }
                        // 创建信息对象，将需要填写的内容（发票内部ID,对账单的银行科目，原始金额）放入对象中
                        var jePmtInfoObj = {
                            'inv_id':invoiceRst.invoice_id, // 发票内部ID（用于创建付款单）
                            'br_bank_acct':br_bank_acct, // 对账单银行类科目（用于付款单赋值）
                            'br_org_amt' : br_org_amt, // 处理后的原始金额（用于付款单赋值）
                            'br_vari_amt' : br_vari_amt, // 日记账的借贷金额（用于核销日记账）
                            'je_rec_id' : jeRecId, // 日记账的内部ID（用于核销日记账）
                            'br_memo': br_memo, // 对账单上的摘要（用于付款单赋值）
                        }
                        // 根据对应信息创建对应付款单
                        var jePmtId = crtPaymentByInvoice(jePmtInfoObj);
                        if (jePmtId.errorInfo){
                            record.submitFields({
                                type: 'customrecord_swc_bank_reconciliation',
                                id: br_intlId,
                                values:{
                                    custrecord_br_error : '付款单生成错误，错误信息：' + jePmtId.errorInfo
                                }
                            });
                            continue;
                        }
                        try {
                            if (jePmtId) {
                                // 最后将对应的付款单ID反写到对应的银行对账单上
                                //使用SubmitFields反写节约资源
                                record.submitFields({
                                    type: 'customrecord_swc_bank_reconciliation',
                                    id: br_intlId,
                                    values: {
                                        custrecord_br_pay_num: jePmtId,
                                    }
                                });
                                log.audit("alertLog", "创建付款单反写成功,流程结束");
                            }
                        } catch (e) {
                            log.audit("付款单反写异常",e);
                        }
                    }
                    // 如果“收入差异科目"不存在，直接根据“发票”生成“客户付款”
                    else {
                        // 创建信息对象，将需要填写的内容（发票内部ID,对账单的银行科目，原始金额）放入对象中
                        var peymentInfoObj = {
                            'inv_id':invoiceRst.invoice_id, // 发票内部ID（用于创建付款单）
                            'br_bank_acct':br_bank_acct, // 对账单银行类科目（用于付款单赋值）
                            'br_org_amt' : br_org_amt, // 处理后的原始金额（用于付款单赋值）
                            'br_vari_amt' : br_vari_amt, // 日记账的借贷金额（用于核销日记账）
                            'br_memo': br_memo, // 对账单上的摘要（用于付款单赋值）
                        }
                        // 根据对应信息创建对应付款单
                        var pmtId = crtPaymentByInvoice(peymentInfoObj);
                        if (pmtId.errorInfo){
                            record.submitFields({
                                type: 'customrecord_swc_bank_reconciliation',
                                id: br_intlId,
                                values:{
                                    custrecord_br_error : '付款单生成错误，错误信息：' + pmtId.errorInfo
                                }
                            });
                            continue;
                        }
                        try {
                            if (pmtId) {
                                // 最后将对应的付款单ID反写到对应的银行对账单上
                                //使用SubmitFields反写节约资源
                                record.submitFields({
                                    type: 'customrecord_swc_bank_reconciliation',
                                    id: br_intlId,
                                    values: {
                                        custrecord_br_pay_num: pmtId,
                                    }
                                });
                                log.audit("alertLog", "创建付款单反写成功,流程结束");
                            }
                        } catch (e) {
                            log.audit("付款单反写异常",e);
                        }
                    }
                }
            }
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
         * 根据“发票和对账单信息对象”生成日记账分录
         * @param {Object} dataObj (对应的发票和对账单需要取得的信息)
         * @return 订单保存ID
         */
        function crtJeByInfo(dataObj){
            // 获取发票和对账单信息对象
            var dataInfoObj = dataObj;
            log.audit("发票和对账单信息对象",dataInfoObj);
            // 从信息对象取值
            var inv_subs = dataInfoObj.inv_subs; // 发票上的子公司（用于日记账赋值）
            var inv_curr = dataInfoObj.inv_curr; // 发票上的货币币种（用于判断是否倒除）
            var inv_cust = dataInfoObj.inv_cust; // 发票上的客户ID（用于日记账赋值）
            var br_curr = dataInfoObj.br_curr; // 对账单上的货币币种（用于判断是否倒除）
            var br_trandate = dataInfoObj.br_trandate; // 对账单上的交易日期（用于日记账赋值）
            var br_memo = dataInfoObj.br_memo; // 对账单上的摘要（用于日记账赋值）
            var br_inc_acct = dataInfoObj.br_inc_acct; // 收入差异科目（用于日记账赋值）
            var br_vari_amt = dataInfoObj.br_vari_amt; // 原始差异金额（用于赋值和倒除）
            var br_exch_rate = dataInfoObj.br_exch_rate; // 对账单汇率（用于倒除）

            try { // 创建日记账记录
                log.audit("开始创建日记账", "开始创建日记账");
                var jeRec = record.create({type: record.Type.JOURNAL_ENTRY, isDynamic: true});
                if (inv_subs) jeRec.setValue({fieldId: 'subsidiary', value: inv_subs}); // 向日记账分录赋值（子公司）与发票一致
                if (inv_curr) jeRec.setValue({fieldId: 'currency', value: inv_curr}); // 向日记账赋值（币种）与发票一致
                if (br_trandate) jeRec.setValue({fieldId: 'trandate', value: new Date(br_trandate)}); // 向日记账赋值（日期）与对账单交易日期一致
                if (br_memo) jeRec.setValue({fieldId: 'memo', value: br_memo}); // 向日记账赋值（备注）与对账单上摘要一致
                // TODO 需要在Config文件中标注常量：6 （银行对账单）
                jeRec.setValue({fieldId: 'custbody_swc_platform', value: 6}); // 来源平台，设置为“银行对账单”
                // 添加借贷项（借方）
                log.audit("添加借方", "添加借方");
                jeRec.selectNewLine({sublistId: 'line'}); // 首先添加新行
                jeRec.setCurrentSublistValue({sublistId: 'line', fieldId: 'account', value: br_inc_acct}); // 向日记账子列表赋值（科目）与对账单收入差异科目一致
                if (br_curr != inv_curr) br_vari_amt /= br_exch_rate; // 如果发票和对账单币种不一致，需要倒除原始差异金额
                jeRec.setCurrentSublistValue({sublistId: 'line', fieldId: 'debit', value: br_vari_amt}); // 向日记账子列表赋值（借方金额）与对账单原始差异金额一致（如果货币不相等需要倒除）
                jeRec.setCurrentSublistValue({sublistId: 'line', fieldId: 'memo', value: br_memo}); // 向日记账子列表赋值（摘要）与对账单摘要一致
                jeRec.setCurrentSublistValue({sublistId: 'line', fieldId: 'entity', value: inv_cust}); // 向日记账子列表赋值（往来名称）与客户ID一致
                jeRec.commitLine({sublistId: 'line'}); // 提交当前行
                // 添加借贷项（贷方）
                log.audit("添加贷方", "添加贷方");
                jeRec.selectNewLine({sublistId: 'line'}); // 首先添加新行
                // TODO 需要在Config文件中标注常量：1241 （112201 应收账款 : 应收账款_已开账单）
                jeRec.setCurrentSublistValue({sublistId: 'line', fieldId: 'account', value: 1241}); // 向日记账子列表赋值（科目）为“112201 应收账款 : 应收账款_已开账单（ID：1241）”
                jeRec.setCurrentSublistValue({sublistId: 'line', fieldId: 'credit', value: br_vari_amt}) // 向日记账子列表赋值（借方金额）与对账单原始差异金额一致
                jeRec.setCurrentSublistValue({sublistId: 'line', fieldId: 'memo', value: br_memo}); // 向日记账子列表赋值（摘要）与对账单摘要一致
                jeRec.setCurrentSublistValue({sublistId: 'line', fieldId: 'entity', value: inv_cust}); // 向日记账子列表赋值（往来名称）与客户ID一致
                jeRec.commitLine({sublistId: 'line'}); // 提交当前行

                // 保存日记账记录
                log.audit("日记账保存", "日记账保存");
                var jeRecId = jeRec.save();
                // 输出保存的日记账 ID
                log.audit('日记账创建成功,保存ID为', jeRecId);
                return jeRecId;
            }
            // 创建日记账出现错误需要提示
            catch (e) {
                var errorObj = {
                    errorInfo : e
                }
                log.audit("错误信息",e);
                return errorObj
            }
        }

        // customerpayment

        /**
         * 根据“发票”生成“客户付款”
         * @param {Object} dataObj (对应需要向付款单上赋值的信息)
         * @return 订单保存ID
         */
        function crtPaymentByInvoice (dataObj){
            try { // 获取对象中需要赋值的信息
                var allInfo = dataObj;
                log.audit("付款单需要赋值的信息对象", allInfo);
                // 从信息对象取值
                var inv_id = allInfo.inv_id; // 发票的内部ID（用于生成付款单）
                var br_bank_acct = allInfo.br_bank_acct; // 对账单上银行类科目（用于付款单赋值）
                var br_org_amt = allInfo.br_org_amt; // 对账单上的原始金额（用于付款单赋值）
                var br_vari_amt = allInfo.br_org_amt; // 日记账上的借贷金额（用于勾选核销日记账）
                var br_memo = allInfo.br_memo; // 对账单上的摘要（用于付款单赋值）
                if (allInfo.je_rec_id) var je_rec_id = allInfo.je_rec_id; // 对应的日记账ID（用于勾选对应日记账核销）
                // 创建付款单
                log.audit("创建付款单", "创建付款单");
                var payRec = record.transform({
                    fromType: record.Type.INVOICE,
                    fromId: inv_id,
                    toType: record.Type.CUSTOMER_PAYMENT,
                    isDynamic: true
                });
                payRec.setValue({fieldId: 'account', value: br_bank_acct}); // 向付款单赋值（科目）对应银行对账单上银行类科目
                payRec.setValue({fieldId: 'payment', value: br_org_amt}); // 向付款单赋值（付款金额）对应银行对账单上原始金额
                payRec.setValue({fieldId: 'memo', value: br_memo}); // 向付款单赋值（备注）对应银行对账单上摘要
                // 如果“日记账ID”存在，则需要搜索“贷记”子列表行，勾选对应日记账
                if (je_rec_id) {
                    log.audit("处理日记账勾选", "处理日记账勾选");
                    // 首先根据对应的“日记账ID”，搜索对应的参考编号，通过内部ID，作为唯一键，勾选核销
                    var creditLineCount = payRec.getLineCount({sublistId: 'credit'}); // 获取”贷项“子列表行数，用于循环遍历
                    for (var i = 0; i < creditLineCount; i++) {
                        payRec.selectLine({sublistId: 'credit', line: i}); // 选中当前行
                        var jeIntlId = payRec.getCurrentSublistValue({sublistId: 'credit', fieldId: 'internalid'}); // 获取付款单页面日记账的内部ID，用于比较
                        log.audit("日记账ID",je_rec_id);
                        log.audit("页面日记账ID",jeIntlId);
                        if (jeIntlId == je_rec_id) {
                            payRec.setCurrentSublistValue({sublistId: 'credit', fieldId: 'apply', value: true}); // 勾选复选框
                            payRec.setCurrentSublistValue({sublistId: 'credit', fieldId: 'amount', value: br_vari_amt}); // 填写贷记金额,对日记账上的”贷记金额“
                            payRec.commitLine({sublistId: 'credit'}); // 提交当前行
                        }
                    }

                    // （另一种方法，防止一对多）首先根据对应的“日记账ID”，搜索对应的参考编号，通过参考编号+原始金额，作为唯一键，勾选核销
                    // var jeRecTranId = search.lookupFields({
                    //     type: search.Type.JOURNAL_ENTRY,
                    //     id: je_rec_id,
                    //     columns: 'tranid'
                    // });
                    // log.audit("日记账参考编号",jeRecTranId);
                    // var srchKey = jeRecTranId+"_"+br_vari_amt; // 构建检索日记账所需的唯一键
                    // var creditLineCount = payRec.getLineCount({sublistId: 'credit'}); // 获取”贷项“子列表行数，用于循环遍历
                    // for (var i = 0; i < creditLineCount; i++) {
                    //     var payTranId = payRec.getSublistValue({sublistId: 'credit', fieldId: 'refnum', line: i}); // 获取付款单上的“参考编号”
                    //     var payAmount = payRec.getSublistValue({sublistId: 'credit', fieldId: 'total',line: i}); // 获取付款单上的“原始金额”
                    //     var payKey = payTranId+"_"+payAmount; // 构建付款单上对应数据的唯一键
                    //     // 如果日记账信息和付款单子列表的某一行信息相等，则勾选对应的”核销复选框“
                    //     if (srchKey == payKey){
                    //         payRec.setSublistValue({sublistId: 'credit', fieldId: 'apply', line: i,value: true}); // 勾选复选框
                    //     }
                    // }
                }
                log.audit("处理发票核销", "处理发票核销");
                var applyLineCount = payRec.getLineCount({sublistId: 'apply'}); // 获取”发票“子列表行数，用于循环遍历
                for (var i = 0; i < applyLineCount; i++) {
                    payRec.selectLine({sublistId: 'apply', line: i}); // 选中当前行
                    var pmtIntlId = payRec.getCurrentSublistValue({sublistId: 'apply', fieldId: 'internalid'}); // 获取付款单页面发票的内部ID，用于比较
                    // 如果付款单页面发票的内部ID和发票的内部ID一致，勾选核销
                    if (pmtIntlId == inv_id) {
                        payRec.setCurrentSublistValue({sublistId: 'apply', fieldId: 'apply', value: true}); // 勾选复选框
                        payRec.setCurrentSublistValue({sublistId: 'apply', fieldId: 'amount', value: br_org_amt}); // 填写对应支付金额,对应处理后的对账单原始金额
                        payRec.commitLine({sublistId: 'apply'}); // 提交当前行
                    }
                }
                payRec.setValue({fieldId:'autoapply',value:true}); // 勾选“自动核销”
                log.audit("保存付款单", "保存付款单");
                var payRecId = payRec.save();
                log.audit("付款单创建成功,保存ID为", payRecId);
                return payRecId;
            }
            // 出现错误需要提示
            catch (e) {
                var errorObj = {
                    errorInfo : e
                }
                log.audit("错误信息",e);
                return errorObj
            }
        }



        /**
         * 根据“collection number”获取对应的发票信息
         * @param {String} collNum (对应的collection number)
         * @return 发票信息对象
         */
        function getInvoiceByCollNum(collNum){
            var invoiceSearchObj = search.create({
                type: "invoice",
                filters:
                    [
                        ["type","anyof","CustInvc"],
                        "AND",
                        ["mainline","is","T"],
                        "AND",
                        ["custbody_swc_collection_number","startswith",collNum]
                    ],
                columns:
                    [
                        search.createColumn({name: "internalid", join: "customer", label: "客户内部ID"}),
                        search.createColumn({name: "custbody_swc_collection_number", label: "Collection Number"}),
                        search.createColumn({name: "currency", label: "货币"}),
                        search.createColumn({name: "subsidiary", label: "子公司"}),
                        search.createColumn({name: "internalid", label: "发票内部ID"})
                    ]
            });
            var srchRst = getAllResultsOfSearch(invoiceSearchObj);
            // 创建空对象，根据检索结果是否存在将异常信息反写
            var invoiceObj = {};
            // 如果保存检索有值，则将数据添加到对象中
            if (srchRst.length > 0) {
                invoiceObj = {
                    'customer_id' : srchRst[0].getValue({name: "internalid", join: "customer", label: "客户内部ID"}), // 客户内部ID
                    'invoice_currency' : srchRst[0].getValue({name: "currency", label: "货币"}), // 发票币种
                    'invoice_subs' : srchRst[0].getValue({name: "subsidiary", label: "子公司"}), // 发票子公司
                    'invoice_id' : srchRst[0].getValue({name: "internalid", label: "发票内部ID"}) // 发票内部ID（用于生成付款单）
                }
                return invoiceObj;
            }
            // 如果不存在则返回错误信息
            else{
                return "invoiceNotExist";
            }
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


        return {getInputData, map, reduce, summarize}

    });
