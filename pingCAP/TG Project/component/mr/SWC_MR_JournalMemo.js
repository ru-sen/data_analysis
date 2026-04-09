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

            //定时执行未更新明细备注的账单摊销日记账数据
        const getInputData = (inputContext) => {
                var journalJson = {};//日记账数据 格式：{日记账id：{摊销表id：{“name”：日程安排表名称，“memo”：账单第一行费用名称}}}
                var journalIdArr = [];//日记账id数组
                // 1.通过检索获取未付款的银行对账单
                var journalentrySearchObj = search.create({
                    type: "journalentry",
                    filters:
                        [
                            ["type","anyof","Journal"],
                            "AND",
                            ["memo","contains","Amortization"],
                            "AND",
                            ["mainline","is","T"],
                            "AND",
                            ["isrevrectransaction","is","T"],
                            "AND",
                            //HC PINGCAP PTE. LTD./PINGCAP INTERNATIONAL PTE. LTD切换本位币，原bill用JE复原
                            [
                                ["createdfrom.type","anyof","VendBill"],
                                "OR",
                                [
                                    ["createdfrom.type","anyof","Journal"],
                                    "AND",
                                    ["subsidiary","anyof","27","28"]
                                ]
                            ],
                            "AND",
                            ["custbody_swc_amortization_flag","is","F"]
                        ],
                    columns:
                        [
                            search.createColumn({name: "internalid", summary: "GROUP", label: "内部 ID"})
                            //search.createColumn({name: "tranid", summary: "GROUP", label: "文档编号"})
                        ]
                });
                var srchRst = getAllResultsOfSearch(journalentrySearchObj);
                if(srchRst.length <= 0)return journalJson;
                for (var i = 0; i < srchRst.length; i++) {
                    var journalId = srchRst[i].getValue({name: "internalid", summary: "GROUP", label: "内部 ID"}); // 内部 ID
                    if(journalId){
                        journalJson[journalId] = {};//先将日记账id放入JSON中
                        journalIdArr.push(journalId);//将日记账id放入数组中
                    }
                }
                log.audit("journalJson1",journalJson);

                var billIdArr = [];//账单id数组
                var journalIdLength = journalIdArr.length;
                var amortFilters = [];
                // 900条数据一组，避免检索条件数据溢出
                var groupPageSize = 800;
                var intlAry = [];
                for (var i = 0; i < journalIdLength; i += groupPageSize) {
                    var dtlIntlIdAryTmp = journalIdArr.slice(i, i + groupPageSize);
                    if (intlAry.length) {
                        // 第一条组以外的数据拼接"OR"
                        intlAry.push("OR");
                    }
                    intlAry.push(["journal.internalid","anyof",dtlIntlIdAryTmp]);
                }
                amortFilters.push(intlAry);
                amortFilters.push("AND", ["srctrantype","anyof",["Journal","VendBill"]]);

                var amortizationscheduleSearchObj = search.create({
                    type: "amortizationschedule",
                    filters:amortFilters,
                    columns:
                        [
                            search.createColumn({name: "internalid", summary: "GROUP", label: "摊销表内部id"}),
                            search.createColumn({name: "schedulenumber", summary: "GROUP", label: "摊销表编码"}),
                            search.createColumn({name: "scheddate", summary: "GROUP", sort: search.Sort.ASC, label: "日期"}),
                            search.createColumn({name: "tranid", join: "journal", summary: "GROUP", label: "日记账编码"}),
                            search.createColumn({name: "internalid", join: "journal", summary: "GROUP", label: "日记账内部id"}),
                            search.createColumn({name: "transactionnumber", join: "transaction", summary: "GROUP", label: "账单编码"}),
                            search.createColumn({name: "internalid", join: "transaction", summary: "GROUP", label: "账单id"}),
                            search.createColumn({name: "name", summary: "GROUP", label: "日程安排表名称"})
                        ]
                });
                var res = getAllResultsOfSearch(amortizationscheduleSearchObj);
                for (var i = 0; i < res.length; i++) {
                    var amortId = res[i].getValue({name: "internalid", summary: "GROUP", label: "摊销表内部id"}); // 摊销表内部id
                    var journalId = res[i].getValue({name: "internalid", join: "journal", summary: "GROUP", label: "日记账内部id"}); // 日记账内部 ID
                    var billId = res[i].getValue({name: "internalid", join: "transaction", summary: "GROUP", label: "账单id"}); // 账单id
                    var amortName = res[i].getValue({name: "name", summary: "GROUP", label: "日程安排表名称"}); // 日程安排表名称
                    //如果JOSN中存在日记账id，将其他数据放入对应日记账下
                    if(journalJson[journalId] && amortId){
                        journalJson[journalId][amortId] = {"amortName":amortName,"billId":billId,"billName":"","entityId":"","departmentId":"","costCenter":""};
                    }
                    if(billId)billIdArr.push(billId);
                }
                log.audit("journalJson2",journalJson);


                var billJson = {};//格式： {billId：billName,...}
                if(billIdArr && billIdArr.length > 0) {
                    //HC 来源账单新增供应商，第一行部门和Cost Center取值
                    var billFilters = [];
                    var intAry = [];
                    for (var i = 0; i < billIdArr.length; i += groupPageSize) {
                        var dtlIntlIdAryTmp = billIdArr.slice(i, i + groupPageSize);
                        if (intAry.length) {
                            // 第一条组以外的数据拼接"OR"
                            intAry.push("OR");
                        }
                        intAry.push(["internalid","anyof",dtlIntlIdAryTmp]);
                    }
                    billFilters.push(intAry);
                    billFilters.push("AND", ["type","anyof","VendBill"], "AND",["linesequencenumber","equalto","1"]);
                    var vendorbillSearchObj = search.create({
                        type: "vendorbill",
                        filters:billFilters,
                        columns:
                            [
                                search.createColumn({name: "internalid", label: "内部 ID"}),
                                search.createColumn({name: "item", label: "货品"}),
                                search.createColumn({name: "entity", label: "名称"}),
                                search.createColumn({name: "department", label: "部门"}),
                                search.createColumn({name: "custcol_swc_cost_centerid", label: "COST CENTER"}),
                            ]
                    });
                    var billRes = getAllResultsOfSearch(vendorbillSearchObj);
                    for (var i = 0; i < billRes.length; i++) {
                        var billId = billRes[i].getValue({name: "internalid", label: "内部 ID"}); // 账单id
                        var billName = billRes[i].getText({name: "item", label: "货品"}); // 账单货品第一行名称
                        var entityId = billRes[i].getValue({name: "entity", label: "名称"}); // 供应商
                        var departmentId = billRes[i].getValue({name: "department", label: "部门"}); // 账单货品第一行部门
                        var costCenter = billRes[i].getValue({name: "custcol_swc_cost_centerid", label: "COST CENTER"}); // 账单货品第一行Cost Center
                        if(billId && billName)billJson[billId] = {
                            "billName": billName,
                            "entityId": entityId,
                            "departmentId": departmentId,
                            "costCenter": costCenter
                        };
                    }
                    //HC 新增来源日记账明细名称，第一行部门和Cost Center取值
                    var jeFilters = [];
                    jeFilters.push(intAry);
                    jeFilters.push("AND");
                    jeFilters.push(["type","anyof","Journal"]);
                    var journalEntrySearchObj = search.create({
                        type: "journalentry",
                        filters:jeFilters,
                        columns:
                            [
                                search.createColumn({name: "internalid", label: "内部 ID"}),
                                search.createColumn({name: "entity", label: "名称"}),
                                search.createColumn({name: "department", label: "部门"}),
                                search.createColumn({name: "custcol_swc_cost_centerid", label: "COST CENTER"}),
                                search.createColumn({
                                    name: "internalid",
                                    join: "amortizationSchedule",
                                    label: "内部 ID"
                                })
                            ]
                    });
                    var jeCols = journalEntrySearchObj.columns;
                    var jeRes = getAllResultsOfSearch(journalEntrySearchObj);
                    for (var j = 0; j < jeRes.length; j++) {
                        var jeId = jeRes[j].getValue(jeCols[0]);
                        var jeEntityId = jeRes[j].getValue(jeCols[1]) || '';
                        var jeDepartmentId = jeRes[j].getValue(jeCols[2]) || '';
                        var jeCostCenter = jeRes[j].getValue(jeCols[3]) || '';
                        var jeAmortId = jeRes[j].getValue(jeCols[4]) || '';// 关联的日程安排表id
                        if (!billJson[jeId]) {
                            billJson[jeId] = {"billName": "", "entityId": "", "departmentId": "", "costCenter": ""}
                        }
                        if (jeEntityId && !billJson[jeId].entityId) {
                            billJson[jeId].entityId = jeEntityId;
                        }
                        if (jeAmortId) {
                            billJson[jeId].departmentId = jeDepartmentId;
                            billJson[jeId].costCenter = jeCostCenter;
                        }
                    }
                }
                log.audit('billJson', billJson);
                //将账单下的第一行货品名称赋值到JSON中
                for(var journalIdKey in journalJson){
                    for(var amortIdKey in journalJson[journalIdKey]){
                        var newBillId = journalJson[journalIdKey][amortIdKey]["billId"] || "";
                        if(newBillId && billJson[newBillId]){
                            journalJson[journalIdKey][amortIdKey]["billName"] = billJson[newBillId].billName || "";
                            //HP Add: 新增名称，部门和Cost Center
                            journalJson[journalIdKey][amortIdKey]["entityId"] = billJson[newBillId].entityId || "";
                            journalJson[journalIdKey][amortIdKey]["departmentId"] = billJson[newBillId].departmentId || "";
                            journalJson[journalIdKey][amortIdKey]["costCenter"] = billJson[newBillId].costCenter || "";
                        }
                    }
                }
                log.audit("journalJson3",journalJson);
                return journalJson;
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
            try{
                // 从map接收数据
                log.audit("reduce数据",reduceContext);
                var values = JSON.parse(reduceContext.values);//{"2":{"amortName":"TX00000001","billId":"15434","billName":"6648 Software service fee (S&M)"}}
                log.audit("处理后的数据values", values);
                var key = JSON.parse(reduceContext.key);
                log.audit("处理后的数据key", key);
                if(key){
                    // 20250417 HC 改成动态模式
                    var jourRec = record.load({type: record.Type.JOURNAL_ENTRY, id: key, isDynamic: true});//日记账
                    log.audit("jourRec id",jourRec.getValue({fieldId:"id"}));
                    var jourCount = jourRec.getLineCount({sublistId:"line"});
                    if(jourCount > 0){
                        var bodyMemo = "";
                        for(var j = 0; j < jourCount; j++){
                            var planCode = jourRec.getSublistValue({fieldId:"schedulenum",sublistId:"line",line:j});//计划编号
                            log.audit("planCode",planCode);
                            //如果子列表的计划编号等于JOSN中的摊销表id，则将明细备注更改为日程安排表名称+"/"+账单第一行费用名称。
                            if(planCode &&values[planCode]) {
                                //20250414 HC without billName,remove slash
                                // var memo = values[planCode]["amortName"] + "/" + values[planCode]["billName"];
                                var memo = values[planCode]["amortName"];
                                if(values[planCode]["billName"]) {
                                    memo += "/" + values[planCode]["billName"];
                                }
                                log.audit("memo",memo);
                                if(memo && j==0)bodyMemo = memo;
                                try {
                                    jourRec.selectLine({sublistId:"line",line:j});
                                    // if(memo)jourRec.setSublistValue({fieldId:"memo",sublistId:"line",line:j,value:memo});
                                    if(memo)jourRec.setCurrentSublistValue({fieldId:"memo",sublistId:"line",value:memo});
                                    //HC 20250417 if entity is empty, set entity,department,costCenter
                                    var entityId = jourRec.getCurrentSublistValue({fieldId:"entity",sublistId:"line"});
                                    var accountName = jourRec.getCurrentSublistText({fieldId:"account",sublistId:"line"});
                                    if(!entityId && values[planCode]["entityId"] && accountName.startsWith('112302'))jourRec.setCurrentSublistValue({fieldId:"entity",sublistId:"line",value:values[planCode]["entityId"]});
                                    var departmentId = jourRec.getCurrentSublistValue({fieldId:"department",sublistId:"line"});
                                    if(!departmentId && values[planCode]["departmentId"])jourRec.setCurrentSublistValue({fieldId:"department",sublistId:"line",value:values[planCode]["departmentId"]});
                                    if(!departmentId && values[planCode]["costCenter"])jourRec.setCurrentSublistValue({fieldId:"custcol_swc_cost_centerid",sublistId:"line",value:values[planCode]["costCenter"]});
                                    jourRec.commitLine({sublistId:"line"});
                                } catch (e) {
                                    jourRec.selectLine({sublistId:"line",line:j});
                                    if(memo)jourRec.setCurrentSublistValue({fieldId:"memo",sublistId:"line",value:memo});
                                    jourRec.setCurrentSublistValue({fieldId:"custcol_pc_je_status",sublistId:"line",line:j,value:e.message});// 回写错误信息
                                    jourRec.commitLine({sublistId:"line"});
                                }
                            }
                        }
                        log.audit("bodyMemo",bodyMemo);
                        // if(bodyMemo)jourRec.setValue({fieldId:"memo",value:bodyMemo});//主表的备注设置为第一行明细的备注 BODY备注赋值取消Will
                        jourRec.setValue({fieldId:"custbody_swc_amortization_flag",value:true});//摊销日记账备注处理标识

                    }
                    jourRec.save();
                }
            }catch (e) {
                throw e.message;
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
            var inputSummary = summaryContext.inputSummary;
            var mapSummary = summaryContext.mapSummary;
            var reduceSummary = summaryContext.reduceSummary;

            if (inputSummary.error) {
                log.error({title : 'INPUT_STAGE_FAILED', details : inputSummary.error});
            }

            mapSummary.errors.iterator().each(function (key, value) {
                log.error({title : 'MAP_STAGE_FAILED', details : key + ' : ' + value});
                return true;
            });

            reduceSummary.errors.iterator().each(function (key, value) {
                log.error({title : 'REDUCE_STAGE_FAILED', details : key + ' : ' + value});
                return true;
            });
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