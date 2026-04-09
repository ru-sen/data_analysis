/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @author yltian
 * @description 根据金蝶凭证创建日记账
 */
// {"子公司-年份-月份-金蝶凭证": "", ...}
var BLACK_LIST = {
    "14-2023-11-530": "",
    "14-2023-11-599": "",
    "14-2023-12-414": "",
    "14-2023-12-415": "",
    "14-2023-12-416": "",
    "14-2023-12-413": "",
    "14-2023-12-829": "",
    "14-2023-12-834": ""
}
define(['../../lib/decimal', "N/record", "N/search", "../../common/SWC_CONFIG_DATA", "N/query"],

    (decimal, record, search, SWC_CONFIG_DATA, query) => {

        /**
         * Defines the function definition that is executed after record is submitted.
         * @param {Object} scriptContext
         * @param {Record} scriptContext.newRecord - New record
         * @param {Record} scriptContext.oldRecord - Old record
         * @param {string} scriptContext.type - Trigger type; use values from the context.UserEventType enum
         * @since 2015.2
         */
        const afterSubmit = (scriptContext) => {
            var newRec = scriptContext.newRecord;
            var type = scriptContext.type;

            try {
                // 创建、编辑单据的场合
                if (type == 'create' || type == 'edit') {
                    newRec = record.load({type: "customrecord_kingdee_voucher", id: newRec.id});

                    var kingdeeDtlCt = newRec.getLineCount({sublistId: "recmachcustrecord_kvd_main"});

                    // 存在备注等于【结转本期损益】，终止处理
                    var endFlag = false;
                    for (var i = 0; i < kingdeeDtlCt; i++) {
                        // 备注
                        var memo = newRec.getSublistValue({sublistId: "recmachcustrecord_kvd_main", fieldId: "custrecord_kdv_explanation", line: i});
                        if (memo == SWC_CONFIG_DATA.configData().KINGDEE_MEMO_CARRY_CURRPERIOD_PROFIT2LOSS) {
                            endFlag = true;
                            break;
                        }
                    }
                    if (endFlag) return;

                    // 根据子公司、金蝶凭证、年份、月份检索日记账是否存在
                    var params= {
                        "subsidiary": newRec.getValue({fieldId: "custrecord_kv_subsidiary"}),
                        "journalnum": newRec.getValue({fieldId: "custrecord_kv_billno"}),
                        "year": newRec.getValue({fieldId: "custrecord_kv_year"}),
                        "month": newRec.getValue({fieldId: "custrecord_kv_month"})
                    }
                    var existsFlag = srchJounalByVoucherExist(params);
                    // 已存在的场合，不执行创建逻辑
                    if (existsFlag) return;
                    // 黑名单，不执行创建逻辑
                    // 子公司-年份-月份-金蝶凭证
                    var blackListKey = params["subsidiary"]
                        + "-" + params["year"]
                        + "-" + params["month"]
                        + "-" + params["journalnum"];
                    if (BLACK_LIST.hasOwnProperty(blackListKey)) return;

                    var journalCode = newRec.getValue({fieldId: "custrecord_kv_journalentrycode"});
                    var voucherCount = newRec.getValue({fieldId: "custrecord_kv_count"});
                    // 日记账编码为空 && 子列表行数等于凭证条数的场合，创建日记账
                    if (!journalCode && (kingdeeDtlCt == Number(voucherCount) && kingdeeDtlCt != 0)) {
                        // 根据明细行科目检索“限制为会计账簿”
                        // 取得明细行科目内部ID
                        var acctIntlIdAry = [];
                        // 组织机构存在标识，默认不存在
                        var toSubsidiary = null;
                        // 公司间类型
                        var interType = null;

                        // 多币种，默认值不存在多币种
                        var multiCurrencyFlag = false;
                        var multiCurrencyRef = null;
                        // 银行类科目标识
                        var bankTypeFlag = false;

                        // cost center id数组
                        var costCenterIdAry = [];

                        for (var i = 0; i < kingdeeDtlCt; i++) {
                            acctIntlIdAry.push(newRec.getSublistValue({sublistId: "recmachcustrecord_kvd_main", fieldId: "custrecord_kvd_account", line: i}));
                            var toSubsidiaryTmp = newRec.getSublistValue({sublistId: "recmachcustrecord_kvd_main", fieldId: "custrecord_kvd_fnumber", line: i});
                            if (!toSubsidiary && toSubsidiaryTmp) {
                                // 存在组织机构
                                toSubsidiary = toSubsidiaryTmp;
                            }
                            var interTypeTmp = newRec.getSublistValue({sublistId: "recmachcustrecord_kvd_main", fieldId: "custrecord_kvd_intertype", line: i});
                            if (!interType && interTypeTmp) {
                                interType = interTypeTmp;
                            }

                            var currencyTmp = newRec.getSublistValue({sublistId: "recmachcustrecord_kvd_main", fieldId: "custrecord_kvd_currency", line: i});
                            // 多币种判定：金蝶凭证明细存在多种币种
                            if (!multiCurrencyRef) {
                                // 币种参考默认值设定
                                multiCurrencyRef = currencyTmp;
                            } else if (!multiCurrencyFlag && multiCurrencyRef != currencyTmp) {
                                // 不存在多币种 && 当前币种与币种参考不一致的场合，存在多币种。设置多币种=true
                                multiCurrencyFlag = true;
                            }

                            if (!bankTypeFlag) {
                                // 银行类科目标识为false的场合
                                var bankTypeFlagTmp = newRec.getSublistValue({sublistId: "recmachcustrecord_kvd_main", fieldId: "custrecord_kvd_banktypeflag", line: i});
                                if (bankTypeFlagTmp) {
                                    // 存在银行类科目的场合，设置银行类科目标识=true
                                    bankTypeFlag = true;
                                }
                            }

                            // 当cost center不为空的场合，取cost center编码：C0100 Founders => C0100
                            var costCenterTmp = newRec.getSublistValue({sublistId: "recmachcustrecord_kvd_main", fieldId: "custrecord_kvd_cost_center", line: i});
                            if (costCenterTmp) {
                                costCenterIdAry.push(costCenterTmp.split(" ")[0]);
                            }
                        }
                        // 科目：{"account": {"内部 ID": "会计账簿", ...}, "acctBookExistFlag": "true"}
                        var acctBookObj = schAcctBook(acctIntlIdAry);
                        var acctBookExistFlag = acctBookObj["acctBookExistFlag"];
                        var srcAcctObj = null;
                        if (acctBookExistFlag) {
                            // 如果科目上有设置【限制为会计账簿】，通过HK的账簿+对应的国内子公司+科目（目标科目）去查询【全局科目映射】对应的来源科目。
                            var subsidiary = newRec.getValue({fieldId: "custrecord_kv_subsidiary"});
                            srcAcctObj = schSrcAcct({
                                acctBookId: SWC_CONFIG_DATA.configData().ACCT_BOOK_HK,
                                subsidiaryId: subsidiary,
                                acctIdAry: acctIntlIdAry
                            });
                        }

                        // 检索日记账行部门数据
                        var deptObj = srchDept(costCenterIdAry);

                        var newJournalIntlId = null;
                        // 存在组织结构，创建普通日记账，自定义表单类型：公司间日记账分录
                        if (toSubsidiary) {
                            newJournalIntlId = crtInterTranJournal({
                                newRec: newRec,
                                srcAcctObj: srcAcctObj,
                                toSubsidiary: toSubsidiary,
                                kingdeeDtlCt: kingdeeDtlCt,
                                acctBookObj: acctBookObj,
                                interType: interType,
                                deptObj: deptObj
                            });
                        } else {
                            // 不存在组织结构，创建普通日记账
                            newJournalIntlId = crtDefaultJournal({
                                newRec: newRec,
                                srcAcctObj: srcAcctObj,
                                kingdeeDtlCt: kingdeeDtlCt,
                                acctBookObj: acctBookObj,
                                multiCurrencyFlag: multiCurrencyFlag,
                                bankTypeFlag: bankTypeFlag,
                                deptObj: deptObj
                            });
                        }

                        // 日记账创建成功的场合，回写日记账编码
                        if (newJournalIntlId) {
                            var kvRec = record.load({type: "customrecord_kingdee_voucher", id: newRec.id, isDynamic: true});
                            // 更新金碟凭证日记账单据ID
                            kvRec.setValue({fieldId: "custrecord_kv_journalentrycode", value: newJournalIntlId});
                            // 清空错误信息
                            kvRec.setValue({fieldId: "custrecord_kv_error_info", value: ""});

                            kvRec.save();
                        }
                    }
                }
            } catch (e) {
                // 记录错误信息到金蝶凭证单据
                var kvRec = record.load({type: "customrecord_kingdee_voucher", id: newRec.id, isDynamic: true});
                kvRec.setValue({fieldId: "custrecord_kv_error_info", value: e});
                kvRec.save();
            }

        }

        /**
         * 根据货品行科目检索会计账簿，会计账簿存在值得场合，单据固定值设定
         * @param {array} acctAry 会计科目ID数组
         * @return {Object} 存在会计账簿
         */
        function schAcctBook(acctAry) {
            if (!acctAry || !acctAry.length) return null;

            // 拼接科目SQL参数：(1, 2, 3)
            var acctSQLStr = "(";
            acctAry.forEach(function (value, index) {
                if (index != 0) {
                    acctSQLStr += ",";
                }
                acctSQLStr += value;
            });
            acctSQLStr += ")";

            var sql = "select id, restricttoaccountingbook " +
                "from account  " +
                "where account.id in" + acctSQLStr + ";";
            var mappedResults = query.runSuiteQL({query:sql}).asMappedResults();

            var acctBookObj = {"account": {}, "acctBookExistFlag": false};
            // 默认值不存在会计账簿
            for (var i = 0; i < mappedResults.length; i++) {
                // 科目账簿不存在的场合 && 当前科目存在科目账簿的场合
                if (!acctBookObj["acctBookExistFlag"] && mappedResults[i]["restricttoaccountingbook"]) {
                    // 设置科目账簿存在标识为true
                    acctBookObj["acctBookExistFlag"] = true;
                }

                // 记录科目及对应的限定会计账簿
                acctBookObj["account"][mappedResults[i]["id"]] = mappedResults[i]["restricttoaccountingbook"];
            }

            return acctBookObj;
        }

        /**
         * 检索来源科目：通过HK的账簿+对应的国内子公司+科目（目标科目）去查询【全局科目映射】对应的来源科目
         * @param {Object} options
         * @param {string} options.acctBookId 限制为会计账簿
         * @param {string} options.subsidiaryId 子公司
         * @param {Array} options.acctIdAry 科目ID数组
         * @return {Object} {"科目Id数组中的科目": "来源科目", ...}
         */
        function schSrcAcct(options) {
            var acctBookId = options.acctBookId;
            var subsidiaryId = options.subsidiaryId;
            var acctIdAry = options.acctIdAry;

            if (!acctBookId || !subsidiaryId || !acctIdAry || !acctIdAry.length) return {};

            var schObj = search.create({
                type: "globalaccountmapping",
                filters:
                    [
                        ["subsidiary","anyof", subsidiaryId],
                        "AND",
                        ["accountingbook","anyof", acctBookId],
                        "AND",
                        ["destinationaccount","anyof", acctIdAry]
                    ],
                columns:
                    [
                        search.createColumn({
                            name: "sourceaccount",
                            sort: search.Sort.ASC,
                            label: "来源科目"
                        }),
                        search.createColumn({name: "destinationaccount", label: "目标科目"})
                    ]
            });

            var results = getAllResults(schObj);

            var srcAcctObj = {};
            for (var i = 0; i < results.length; i++) {
                var srcAcctId = results[i].getValue({name: "sourceaccount"});
                var destAcctId = results[i].getValue({name: "destinationaccount"});

                srcAcctObj[destAcctId] = srcAcctId;
            }

            return srcAcctObj
        }

        /**
         * 检索金蝶凭证创建的日记账是否存在
         * @param {Object} options
         * @param {string} options.subsidiary
         * @param {string} options.journalnum
         * @param {string} options.year
         * @param {string} options.month
         * @return {boolean} true：存在日记账，false不存在日记账
         */
        function srchJounalByVoucherExist(options) {
            // 必选参数为空的场合，查询失败，返回true，不执行后续创建操作
            if (!options.subsidiary || !options.journalnum || !options.year || !options.month) return true;

            var journalentrySearchObj = search.create({
                type: "journalentry",
                filters:
                    [
                        ["type","anyof","Journal"],
                        "AND",
                        ["subsidiary","anyof", options.subsidiary],
                        "AND",
                        ["custbody_swc_kingdee_journalnum","is", options.journalnum],
                        "AND",
                        ["custbody_swc_kv_year","is", options.year],
                        "AND",
                        ["custbody_swc_kv_month","is", options.month]
                    ],
                columns:
                    [
                        search.createColumn({
                            name: "internalid",
                            summary: "GROUP",
                            label: "内部 ID"
                        })
                    ]
            });
            var searchResultCount = journalentrySearchObj.runPaged().count;
            var existFlag = false;
            if (searchResultCount > 0) {
                existFlag = true;
            }

            return existFlag;
        }

        /**
         * 存在组织结构，创建普通日记账，自定义表单类型：公司间日记账分录
         * @param {Object} options
         * @param {Record} options.newRec 自定义记录：金碟凭证
         * @param {Object} options.srcAcctObj 全局科目映射 {"科目Id数组中的科目": "来源科目", ...}
         * @param {string} options.toSubsidiary 目标子公司（ns子公司）
         * @param {number} options.kingdeeDtlCt 明细行条数
         * @param {Object} options.acctBookObj 科目、会计账簿映射：{"account": {"内部 ID": "会计账簿", ...}, "acctBookExistFlag": "true"}
         * @param {string} options.interType 公司间类型
         * @param {Object} options.deptObj 部门
         * @return {string} 日记账id
         */
        function crtInterTranJournal(options) {
            var newRec = options.newRec;
            var srcAcctObj = options.srcAcctObj;
            var toSubsidiary = options.toSubsidiary;
            var kingdeeDtlCt = options.kingdeeDtlCt;
            var acctBookObj = options.acctBookObj;
            var interType = options.interType;
            var deptObj = options.deptObj;

            var journalRec = record.create({type: "journalentry", isDynamic: true});

            var subsidiary = newRec.getValue({fieldId: "custrecord_kv_subsidiary"});
            // 日期
            var tranDate = newRec.getValue({fieldId: "custrecord_kv_trandate"});
            // 金蝶凭证编码
            var kingdeeVoucherNo = newRec.getValue({fieldId: "custrecord_kv_billno"});
            // 执行时间
            var kingdeeDate = newRec.getValue({fieldId: "custrecord_kv_date"});
            // 执行人
            var kingdeePerson = newRec.getValue({fieldId: "custrecord_kv_person"});
            // 金蝶凭证年份
            var year = newRec.getValue({fieldId: "custrecord_kv_year"});
            // 金蝶凭证月份
            var month = newRec.getValue({fieldId: "custrecord_kv_month"});
            // 根据子公司、目标子公司、公司间类型检索名称
            var entity = srchEntity(subsidiary, toSubsidiary, interType);

            // 单据头数据设定
            // 自定义表单：公司间日记账分录
            journalRec.setValue({fieldId: "customform", value: SWC_CONFIG_DATA.configData().JOURNALENTRY_CUSTOMFORM_INTERCOMPANY});
            journalRec.setValue({fieldId: "subsidiary", value: subsidiary});
            // 币种全部设置本位币（CNY）
            journalRec.setValue({fieldId: "currency", value: SWC_CONFIG_DATA.configData().CURRENCY_CNY});
            // 目标子公司
            journalRec.setValue({fieldId: "tosubsidiary", value: toSubsidiary});
            journalRec.setValue({fieldId: "trandate", value: tranDate});
            journalRec.setValue({fieldId: "custbody_swc_kingdee_journalnum", value: kingdeeVoucherNo});
            // 金蝶日记账执行时间
            journalRec.setValue({fieldId: "custbody_swc_kingdee_journalexedate", value: kingdeeDate});
            // 金蝶日记账创建人
            journalRec.setValue({fieldId: "custbody_swc_kingdee_journalcrtperson", value: kingdeePerson});
            // 固定值设定，来源平添：金蝶云星空
            journalRec.setValue({fieldId: "custbody_swc_platform", value: SWC_CONFIG_DATA.configData().SWC_PLATFORM_KINGDEE_ID});
            // 金蝶凭证年份
            journalRec.setValue({fieldId: "custbody_swc_kv_year", value: year});
            // 金蝶凭证月份
            journalRec.setValue({fieldId: "custbody_swc_kv_month", value: month});

            for (var i = 0; i < kingdeeDtlCt; i++) {
                // 科目
                var account = newRec.getSublistValue({sublistId: "recmachcustrecord_kvd_main", fieldId: "custrecord_kvd_account", line: i});
                // 借记
                var debit = newRec.getSublistValue({sublistId: "recmachcustrecord_kvd_main", fieldId: "custrecord_kvd_debit", line: i});
                // 贷记
                var credit = newRec.getSublistValue({sublistId: "recmachcustrecord_kvd_main", fieldId: "custrecord_kvd_credit", line: i});
                // 备注
                var memo = newRec.getSublistValue({sublistId: "recmachcustrecord_kvd_main", fieldId: "custrecord_kdv_explanation", line: i});
                // 国内供应商
                var domesticVen = newRec.getSublistValue({sublistId: "recmachcustrecord_kvd_main", fieldId: "custrecord_kvd_domestic_ven", line: i});
                // 国内客户
                var domesticCus = newRec.getSublistValue({sublistId: "recmachcustrecord_kvd_main", fieldId: "custrecord_kvd_domestic_cus", line: i});
                // COST CENTER
                var costCenter = newRec.getSublistValue({sublistId: "recmachcustrecord_kvd_main", fieldId: "custrecord_kvd_cost_center", line: i});
                // 组织机构编码
                var fNumber = newRec.getSublistValue({sublistId: "recmachcustrecord_kvd_main", fieldId: "custrecord_kvd_fnumber", line: i});
                // 项目（日记账）
                var projectJournal = newRec.getSublistValue({sublistId: "recmachcustrecord_kvd_main", fieldId: "custrecord_kvd_projectjournal", line: i});

                journalRec.selectNewLine({sublistId: "line"});
                // 如果科目上有设置【限制为会计账簿】，生成特定账簿的日记账，账簿HK，子公司对应的公司，科目设置为来源科目
                if (acctBookObj["account"][account] && srcAcctObj[account]) {
                    // 当前科目存在特定会计账簿 && 在科目映射表存在的场合，取科目映射表数据
                    journalRec.setCurrentSublistValue({sublistId: "line", fieldId: "account", value: srcAcctObj[account]});
                } else {
                    // 上述以外的场合，设置为原科目
                    journalRec.setCurrentSublistValue({sublistId: "line", fieldId: "account", value: account});
                }

                journalRec.setCurrentSublistValue({sublistId: "line", fieldId: "debit", value: debit});
                journalRec.setCurrentSublistValue({sublistId: "line", fieldId: "credit", value: credit});
                journalRec.setCurrentSublistValue({sublistId: "line", fieldId: "memo", value: memo});
                journalRec.setCurrentSublistValue({sublistId: "line", fieldId: "custcol_swc_domestic_ven", value: domesticVen});
                journalRec.setCurrentSublistValue({sublistId: "line", fieldId: "custcol_swc_domestic_cus", value: domesticCus});
                // 当COST CENTER不为空的场合，取COST CENTER ID：C0902 CSG-SSC&Admin => C0902，设置日记账行部门
                if (costCenter) {
                    journalRec.setCurrentSublistValue({sublistId: "line", fieldId: "department", value: deptObj[costCenter.split(" ")[0]]});
                }
                journalRec.setCurrentSublistValue({sublistId: "line", fieldId: "custcol_swc_cost_centerid", value: costCenter});
                // 组织结构存在值得场合，设置名称、勾选抵消
                if (fNumber) {
                    // 名称
                    journalRec.setCurrentSublistValue({sublistId: "line", fieldId: "entity", value: entity});
                    // 抵消
                    journalRec.setCurrentSublistValue({sublistId: "line", fieldId: "eliminate", value: true});
                }
                // 项目（日记账）
                journalRec.setCurrentSublistValue({sublistId: "line", fieldId: "cseg_swc_pro", value: projectJournal});

                journalRec.commitLine({sublistId: "line"});
            }

            return journalRec.save();
        }

        /**
         * 不存在组织结构，创建普通日记账
         * @param {Object} options
         * @param {Record} options.newRec 自定义记录：金碟凭证
         * @param {Object} options.srcAcctObj 全局科目映射 {"科目Id数组中的科目": "来源科目", ...}
         * @param {number} options.kingdeeDtlCt 明细行条数
         * @param {Object} options.acctBookObj 科目、会计账簿映射：{"account": {"内部 ID": "会计账簿", ...}, "acctBookExistFlag": "true"}
         * @param {boolean} options.multiCurrencyFlag 多币种标识（true：存在多币种）
         * @param {boolean} options.bankTypeFlag 银行类科目标识（true：存在银行类科目）
         * @param {Object} options.deptObj 部门
         * @return {string} 日记账id
         */
        function crtDefaultJournal(options) {
            var newRec = options.newRec;
            var srcAcctObj = options.srcAcctObj;
            var kingdeeDtlCt = options.kingdeeDtlCt;
            var acctBookObj = options.acctBookObj;
            var multiCurrencyFlag = options.multiCurrencyFlag;
            var bankTypeFlag = options.bankTypeFlag;
            var deptObj = options.deptObj;

            // 外币处理：存在多币种 && 存在银行类科目 && 全部银行类科目不存在本位币的场合，存在外币问题
            // 外币问题存在标识，默认值false不存在外币问题
            var fCurrQExistFlag = false;
            if (multiCurrencyFlag && bankTypeFlag) {
                // 银行类科目判定：全部银行类科目都不是本位币的场合，存在外币问题
                // 银行类科目不存在本位币标识，默认值true银行类科目不存在本位币
                var localCurrNotExistFlag = true;
                for (var i = 0; i < kingdeeDtlCt; i++) {
                    var bankTypeFlagTmp = newRec.getSublistValue({sublistId: "recmachcustrecord_kvd_main", fieldId: "custrecord_kvd_banktypeflag", line: i});
                    var currencyTmp = newRec.getSublistValue({sublistId: "recmachcustrecord_kvd_main", fieldId: "custrecord_kvd_currency", line: i});
                    // 银行类科目存在本位币的场合，银行类科目不存在本位币标识 = false
                    if (bankTypeFlagTmp && currencyTmp == SWC_CONFIG_DATA.configData().CURRENCY_CNY) {
                        localCurrNotExistFlag = false;
                        break;
                    }
                }

                // 本位币不存在的场合，存在外币问题
                if (localCurrNotExistFlag) {
                    fCurrQExistFlag = true;
                }
            }

            var journalRec = record.create({type: "journalentry", isDynamic: true});

            var subsidiary = newRec.getValue({fieldId: "custrecord_kv_subsidiary"});
            // 日期
            var tranDate = newRec.getValue({fieldId: "custrecord_kv_trandate"});
            // 金蝶凭证编码
            var kingdeeVoucherNo = newRec.getValue({fieldId: "custrecord_kv_billno"});
            // 执行时间
            var kingdeeDate = newRec.getValue({fieldId: "custrecord_kv_date"});
            // 执行人
            var kingdeePerson = newRec.getValue({fieldId: "custrecord_kv_person"});
            // 金蝶凭证年份
            var year = newRec.getValue({fieldId: "custrecord_kv_year"});
            // 金蝶凭证月份
            var month = newRec.getValue({fieldId: "custrecord_kv_month"});

            // 单据头数据设定
            journalRec.setValue({fieldId: "subsidiary", value: subsidiary});

            var currency = null; // 货币
            var exchangerate = null; // 汇率
            if (fCurrQExistFlag) {
                // 取第一条银行类科目货币、汇率
                for (var i = 0; i < kingdeeDtlCt; i++) {
                    // 银行类科目标识
                    var bankTypeFlagTmp = newRec.getSublistValue({sublistId: "recmachcustrecord_kvd_main", fieldId: "custrecord_kvd_banktypeflag", line: i});
                    // 货币
                    var currencyTmp = newRec.getSublistValue({sublistId: "recmachcustrecord_kvd_main", fieldId: "custrecord_kvd_currency", line: i});
                    // 汇率
                    var fExchangerateTmp = newRec.getSublistValue({sublistId: "recmachcustrecord_kvd_main", fieldId: "custrecord_kvd_fexchangerate", line: i});

                    if (bankTypeFlagTmp) {
                        currency = currencyTmp;
                        exchangerate = fExchangerateTmp;
                        break;
                    }
                }
            } else {
                currency = SWC_CONFIG_DATA.configData().CURRENCY_CNY;
                exchangerate = SWC_CONFIG_DATA.configData().EXCHANGERATE_CNY;
            }

            journalRec.setValue({fieldId: "currency", value: currency});
            // 汇率
            journalRec.setValue({fieldId: "exchangerate", value: exchangerate});
            journalRec.setValue({fieldId: "trandate", value: tranDate});
            // 金蝶日记账编码
            journalRec.setValue({fieldId: "custbody_swc_kingdee_journalnum", value: kingdeeVoucherNo});
            // 金蝶日记账执行时间
            journalRec.setValue({fieldId: "custbody_swc_kingdee_journalexedate", value: kingdeeDate});
            // 金蝶日记账创建人
            journalRec.setValue({fieldId: "custbody_swc_kingdee_journalcrtperson", value: kingdeePerson});
            // 固定值设定，来源平添：金蝶云星空
            journalRec.setValue({fieldId: "custbody_swc_platform", value: SWC_CONFIG_DATA.configData().SWC_PLATFORM_KINGDEE_ID});
            // 金蝶凭证年份
            journalRec.setValue({fieldId: "custbody_swc_kv_year", value: year});
            // 金蝶凭证月份
            journalRec.setValue({fieldId: "custbody_swc_kv_month", value: month});

            // for (var i = 0; i < kingdeeDtlCt; i++) {
            //     if (fCurrQExistFlag) {
            // }
            // 借贷累计值（存在外币问题的场合生效）
            var debitSum = 0;
            var creditSum = 0;
            for (var i = 0; i < kingdeeDtlCt; i++) {
                // 科目
                var account = newRec.getSublistValue({sublistId: "recmachcustrecord_kvd_main", fieldId: "custrecord_kvd_account", line: i});
                // 借记
                var debit = newRec.getSublistValue({sublistId: "recmachcustrecord_kvd_main", fieldId: "custrecord_kvd_debit", line: i});
                // 贷记
                var credit = newRec.getSublistValue({sublistId: "recmachcustrecord_kvd_main", fieldId: "custrecord_kvd_credit", line: i});
                // 备注
                var memo = newRec.getSublistValue({sublistId: "recmachcustrecord_kvd_main", fieldId: "custrecord_kdv_explanation", line: i});
                // 国内供应商
                var domesticVen = newRec.getSublistValue({sublistId: "recmachcustrecord_kvd_main", fieldId: "custrecord_kvd_domestic_ven", line: i});
                // 国内客户
                var domesticCus = newRec.getSublistValue({sublistId: "recmachcustrecord_kvd_main", fieldId: "custrecord_kvd_domestic_cus", line: i});
                // COST CENTER
                var costCenter = newRec.getSublistValue({sublistId: "recmachcustrecord_kvd_main", fieldId: "custrecord_kvd_cost_center", line: i});
                // 组织机构编码
                var fNumber = newRec.getSublistValue({sublistId: "recmachcustrecord_kvd_main", fieldId: "custrecord_kvd_fnumber", line: i});
                // 项目（日记账）
                var projectJournal = newRec.getSublistValue({sublistId: "recmachcustrecord_kvd_main", fieldId: "custrecord_kvd_projectjournal", line: i});

                journalRec.selectNewLine({sublistId: "line"});
                // 如果科目上有设置【限制为会计账簿】，生成特定账簿的日记账，账簿HK，子公司对应的公司，科目设置为来源科目
                if (acctBookObj["account"][account] && srcAcctObj[account]) {
                    // 当前科目存在特定会计账簿 && 在科目映射表存在的场合，取科目映射表数据
                    journalRec.setCurrentSublistValue({sublistId: "line", fieldId: "account", value: srcAcctObj[account]});
                } else {
                    // 上述以外的场合，设置为原科目
                    journalRec.setCurrentSublistValue({sublistId: "line", fieldId: "account", value: account});
                }

                // 存在外币问题
                if (fCurrQExistFlag) {
                    debit = decimal.divN(debit, exchangerate).toFixed(2);
                    credit = decimal.divN(credit, exchangerate).toFixed(2);
                    // 累计借贷金额（用于计算尾差）
                    debitSum = decimal.addN(debitSum, debit);
                    creditSum = decimal.addN(creditSum, credit);
                }
                journalRec.setCurrentSublistValue({sublistId: "line", fieldId: "debit", value: debit});
                journalRec.setCurrentSublistValue({sublistId: "line", fieldId: "credit", value: credit});
                journalRec.setCurrentSublistValue({sublistId: "line", fieldId: "memo", value: memo});
                journalRec.setCurrentSublistValue({sublistId: "line", fieldId: "custcol_swc_domestic_ven", value: domesticVen});
                journalRec.setCurrentSublistValue({sublistId: "line", fieldId: "custcol_swc_domestic_cus", value: domesticCus});
                // 当COST CENTER不为空的场合，取COST CENTER ID：C0902 CSG-SSC&Admin => C0902，设置日记账行部门
                if (costCenter) {
                    journalRec.setCurrentSublistValue({sublistId: "line", fieldId: "department", value: deptObj[costCenter.split(" ")[0]]});
                }
                journalRec.setCurrentSublistValue({sublistId: "line", fieldId: "custcol_swc_cost_centerid", value: costCenter});
                // 项目（日记账）
                journalRec.setCurrentSublistValue({sublistId: "line", fieldId: "cseg_swc_pro", value: projectJournal});

                journalRec.commitLine({sublistId: "line"});
            }

            // 借贷存在尾差
            var diffSum = decimal.subN(debitSum, creditSum);
            if (diffSum != 0) {
                journalRec.selectNewLine({sublistId: "line"});

                journalRec.setCurrentSublistValue({sublistId: "line", fieldId: "account", value: SWC_CONFIG_DATA.configData().ACCOUNT_OTHER_EXPENSES_REALIZED_EXCHANGE_LOSSES});

                // 绝对值设定
                if (diffSum > 0) {
                    journalRec.setCurrentSublistValue({sublistId: "line", fieldId: "credit", value: Math.abs(diffSum)});
                } else if (diffSum < 0) {
                    journalRec.setCurrentSublistValue({sublistId: "line", fieldId: "debit", value: Math.abs(diffSum)});
                }

                journalRec.commitLine({sublistId: "line"});
            }

            var journalRecId = journalRec.save();

            var journalRec = record.load({type: record.Type.JOURNAL_ENTRY, id: journalRecId});
            journalRec.setValue({fieldId: "exchangerate", value: exchangerate});
            journalRec.save();

            return journalRecId;
        }

        /**
         * 根据子公司、目标子公司、公司间类型检索名称
         * @param {string} subsidiary 子公司
         * @param {string} toSubsidiary 目标子公司
         * @param {string} interType 公司间类型
         * @return {string} 名称（客户/供应商）
         */
        function srchEntity(subsidiary, toSubsidiary, interType) {
            if (!subsidiary || !toSubsidiary ||!interType) return "";

            var srchObj = null;
            if (interType == SWC_CONFIG_DATA.configData().INTERCOMPANY_TRANSACTIONS_TYPE_CSR) {
                // 公司间类型等于客户的场合
                srchObj = search.create({
                    type: "customer",
                    filters:
                        [
                            ["subsidiary","anyof", subsidiary],
                            "AND",
                            ["representingsubsidiary","anyof", toSubsidiary]
                        ],
                    columns:
                        [
                            search.createColumn({name: "internalid", label: "内部 ID"})
                        ]
                });
            } else if (interType == SWC_CONFIG_DATA.configData().INTERCOMPANY_TRANSACTIONS_TYPE_VEN) {
                // 公司间类型等于供应商的场合
                srchObj = search.create({
                    type: "vendor",
                    filters:
                        [
                            ["subsidiary","anyof", subsidiary],
                            "AND",
                            ["representingsubsidiary","anyof", toSubsidiary]
                        ],
                    columns:
                        [
                            search.createColumn({name: "internalid", label: "内部 ID"})
                        ]
                });
            }

            var entity = "";
            if (srchObj) {
                var searchResultCount = srchObj.runPaged().count;
                log.error("searchResultCount", searchResultCount)
                if (searchResultCount > 0) {
                    srchObj.run().each(function(result){
                        entity = result.getValue({name: "internalid", label: "内部 ID"});
                        return false;
                    });
                }
            }

            return entity;
        }

        /**
         * 检索子公司本位币
         * @param {string} subsidiaryId 子公司
         * @return {string} 货币（本位币）
         */
        function getSubCurrency(subsidiaryId) {
            if (!subsidiaryId) return "";

            var subsidiarySearchObj = search.create({
                type: "subsidiary",
                filters:
                    [
                        ["internalid","anyof", subsidiaryId]
                    ],
                columns:
                    [
                        search.createColumn({name: "currency", label: "货币"})
                    ]
            });

            var searchResultCount = subsidiarySearchObj.runPaged().count;

            var subCurrency = null;
            if (searchResultCount > 0) {
                subsidiarySearchObj.run().each(function(result){
                    subCurrency = result.getValue({name: "currency", label: "货币"});
                    return false;
                });
            }

            return subCurrency;
        }

        /**
         * 检索日记账行部门数据
         * @param {array} costCenterIdAry COST CENTER Id数组：["C0100", ...]
         * @return {Object} {"cost center id": "部门id", ...}
         */
        function srchDept(costCenterIdAry) {
            if (!costCenterIdAry || !costCenterIdAry.length) return {};

            // 检索条件字段无法使用anyof，使用表达式进行多个【COST CENTER ID】检索
            var expression = [];
            costCenterIdAry.forEach(function (value, index) {
                if (index != 0) {
                    expression.push("OR");
                }
                // Cost Center ID (自定义)
                expression.push(["custrecord_swc_costcenter_id","is", value]);
            });

            var filters = [];
            filters.push(expression);

            var departmentSearchObj = search.create({
                type: "department",
                filters: filters,
                columns:
                    [
                        search.createColumn({name: "internalid", label: "内部 ID"}),
                        search.createColumn({name: "custrecord_swc_costcenter_id", label: "Cost Center ID"})
                    ]
            });

            var results = getAllResults(departmentSearchObj);

            var deptObj = {};
            results.forEach(function (value) {
                var costCenterId = value.getValue({name: "custrecord_swc_costcenter_id", label: "Cost Center ID"});
                if (!deptObj.hasOwnProperty(costCenterId)) {
                    var deptId = value.getValue({name: "internalid", label: "内部 ID"});
                    deptObj[costCenterId] = deptId;
                }
            });

            return deptObj;
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

        return {afterSubmit}

    });
