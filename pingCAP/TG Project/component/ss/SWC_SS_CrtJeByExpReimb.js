/**
 * Module Description
 *
 * Version    Date            Author           Remarks
 * 1.00       11 Jul 2019     12801
 *
 */

// 常量列表
var OTHERPAYABLE_REIMB_22401 = 1308; // 科目：22401其它应付款：其他应付款_应付报销款（沙箱id：1308）
//日本 JP  开曼 KY   美国 US    新加坡 SG    香港 HK
var custCountryJson = {"JP":"6","KY":"8","US":"10","SG":"11","HK":"9"};//地区映射关系


/**
 * 创建配货单task
 * @param {String} type Context Types: scheduled, ondemand, userinterface, aborted, skipped
 * @returns {Void}
 */
function CreateDeliveryNoteTask(type) {
    nlapiLogExecution("AUDIT","AUDIT","AUDIT")
    var ctx = nlapiGetContext();
    var jsonId =  ctx.getSetting('SCRIPT', 'custscript_swc_jsonid')//   jsonId
    var type =  ctx.getSetting('SCRIPT', 'custscript_swc_type')//   类型
    // var importStatusId =  ctx.getSetting('SCRIPT', 'custscript_import_status_id')//   配货单导入状态ID

    nlapiLogExecution("AUDIT","jsonId",jsonId)
    nlapiLogExecution("AUDIT","type",type)
    // nlapiLogExecution("AUDIT","importStatusId",importStatusId)
    if(type == "create"){
        // 进行遍历抓取，并创建task
        var curPage = 1; // 当前页
        var totalPages = 1; // 总页数
        var PAGE_SIZE = 20; // 每页条数
        var total = -1; // 接口返回总条数
        var message = "";
        //var importId = "";//外部ID
        try {
            var jsonRec = nlapiLoadRecord("customrecord_swc_crtjebyreimb_midrec", jsonId);
            //导入数据  格式：{key:{1:1,2:2,item:[{1:1},{2:2}...]},...}
            var jeData1 = jsonRec.getFieldValue("custrecord_swc_json1") ? (JSON.parse(jsonRec.getFieldValue("custrecord_swc_json1"))) : {};//预览数据
            var jeData2 = jsonRec.getFieldValue("custrecord_swc_json2") ? (JSON.parse(jsonRec.getFieldValue("custrecord_swc_json2"))) : {};//货品数据
            nlapiLogExecution("AUDIT","jeData1",JSON.stringify(jeData1))
            nlapiLogExecution("AUDIT","jeData2",JSON.stringify(jeData2))
            nlapiLogExecution("AUDIT","jeData1-length",Object.keys(jeData1).length)

            if(Object.keys(jeData1).length > 0){
                // 循环结果，修改配货单状态
                var jeDataArr = [];
                for(var i = 0; i < Object.keys(jeData1).length; i++) {
                    nlapiLogExecution("AUDIT","jeData1Detail",JSON.stringify(jeData1[i]));
                    jeDataArr.push(jeData1[i]);
                }
                nlapiLogExecution("AUDIT","jeData1Arr",JSON.stringify(jeDataArr));
                var result = [];
                var map = {};

                for (var i = 0; i < jeDataArr.length; i++) {
                    var obj = jeDataArr[i];
                    var type_ = obj.zj;

                    if (map[type_]) {
                        map[type_].push(obj);
                    } else {
                        map[type_] = [obj];
                    }
                }

                for (var type_ in map) {
                    result.push(map[type_]);
                }
                nlapiLogExecution("AUDIT","result1",JSON.stringify(result));
            } else {
                message+= "导入数据为空，无法创建日记账。";
            }
            var allCountry = getAllCountry();
            nlapiLogExecution("AUDIT","countryData",JSON.stringify(allCountry));
            for (var i = 0 ; i < result.length; i++) {
                nlapiLogExecution("AUDIT","result2",JSON.stringify(result[i]));
                governanceYield(); // usage恢复
                var jeLoadIdArr = []; // 用于存放反写日记账的ID
                var jeCountry = ""; // 【国家/地区】
                var jeSubs =  result[i][0].gs; // 获取【子公司】
                var jeBankAcct =  result[i][0].km; // 获取【预付款银行账户】
                var jeEmpId = result[i][0].ygm; // 获取【员工】
                var jeKey = result[i][0].zj; // 获取【货币_汇率】
                var jeCurr = jeKey.split("_")[0];
                var jeRate = jeKey.split("_")[1];
                var jeCreditAmt = 0; // 设置【贷方金额】
                for (var k = 0; k < allCountry.length; k++) {
                    if (allCountry[k].subsId == jeSubs) {
                        var fmtjeCountry = allCountry[k].countryId;
                        for (var countryKey in custCountryJson) {
                            if (countryKey == fmtjeCountry) {
                                jeCountry = custCountryJson[countryKey];
                            }
                        }
                    }
                }
                //创建日记账
                var jeRec = nlapiCreateRecord("journalentry");
                for (var j = 0; j < result[i].length; j++) {
                    nlapiLogExecution("AUDIT","result3",JSON.stringify(result[i][j]));
                    // 获取数组中的值
                    var jeEmp = result[i][j].yg; // 获取【员工】
                    var jeAmt = Number(result[i][j].je).toFixed(2); // 获取【金额】
                    var jeIntlId = result[i][j].dh; // 获取【日记账单号】
                    jeLoadIdArr.push(jeIntlId);
                    jeCreditAmt += Number(jeAmt);
                    // 为日记账赋值
                    jeRec.setFieldValue("subsidiary",jeSubs);
                    jeRec.setFieldValue("currency",jeCurr);
                    jeRec.setFieldValue("exchangerate",jeRate);
                    jeRec.setFieldValue("trandate",new Date());
                    jeRec.setFieldValue("custbody_swc_pay_flag","T");
                    jeRec.setFieldValue("custbody_swc_pay_employee_flag","T");
                    // 为日记账行赋值（借方）
                    nlapiLogExecution("AUDIT","crtDebit","crtDebit");
                    jeRec.selectNewLineItem('line');
                    jeRec.setCurrentLineItemValue('line', 'account', OTHERPAYABLE_REIMB_22401); // 科目
                    jeRec.setCurrentLineItemValue('line', 'debit', jeAmt); // 借方金额
                    nlapiLogExecution("AUDIT","crtDebit",jeRec.getCurrentLineItemValue('line', 'debit'));
                    jeRec.setCurrentLineItemValue('line', 'custcol_swc_jon_employee', jeEmpId); // 员工
                    jeRec.setCurrentLineItemValue('line', 'memo', '支付'+ jeEmp + '报销款'); // 备注
                    jeRec.setCurrentLineItemValue('line', 'cseg_swc_region', jeCountry); // 国家/地区
                    // jeRec.setCurrentLineItemValue('line', 'custcol_swc_jounal_num', jeIntlId); // 费用报销日记账单号
                    jeRec.commitLineItem('line');
                }
                nlapiLogExecution("AUDIT","crtCredit","crtCredit");
                // 添加贷方
                jeRec.selectNewLineItem('line');
                jeRec.setCurrentLineItemValue('line', 'account', jeBankAcct); // 科目
                jeRec.setCurrentLineItemValue('line', 'custcol_swc_jon_employee', jeEmpId); // 员工
                // jeRec.setCurrentLineItemValue('line', 'memo', '支付'+ jeEmp + '报销款'); // 备注
                jeRec.setCurrentLineItemValue('line', 'credit', Number(jeCreditAmt).toFixed(2)); // 贷方金额
                jeRec.setCurrentLineItemValue('line', 'cseg_swc_region', jeCountry); // 国家/地区
                jeRec.commitLineItem('line');
                // 保存日记账
                var jeRecId = nlapiSubmitRecord(jeRec);
                nlapiLogExecution("AUDIT","success__jeRecId",jeRecId);
                nlapiLogExecution("AUDIT","success__jeLoadIdArr",jeRecId);
                // 反写日记账
                if (jeRecId && jeLoadIdArr.length > 0) {
                    for (var p = 0; p < jeLoadIdArr.length; p++) {
                        var loadJeRec = nlapiLoadRecord("journalentry",jeLoadIdArr[p]);
                        loadJeRec.setFieldValue("custbody_swc_pay_flag","T");
                        var sublistId = 'line';
                        var lineCount = loadJeRec.getLineItemCount(sublistId);
                        for (var i = 1; i <= lineCount; i++) { // 子列表行数从1开始
                            loadJeRec.selectLineItem(sublistId, i);
                            var creditValue = loadJeRec.getCurrentLineItemValue(sublistId, 'credit'); // 获取贷方数据
                            if (creditValue) {
                                loadJeRec.setCurrentLineItemValue(sublistId, 'custcol_swc_jounal_num', jeRecId); // 获取贷方数据
                                loadJeRec.commitLineItem(sublistId);
                            }
                        }
                        var loadRecId = nlapiSubmitRecord(loadJeRec);
                    }
                }
                nlapiLogExecution("AUDIT","success__loadRecId",loadRecId);
            }
        } catch (e) {
            message+= e.message;
        }
        nlapiLogExecution("AUDIT","message",message);
        //nlapiLogExecution("AUDIT","importId",importId);

        //查询配货单导入状态单据
        // if(!importStatusId)message += "配货单导入状态不存在，请检查！"
        // var importStatusRec =  nlapiLoadRecord("customrecord_swc_import_status", importStatusId);
        // if(message){
        //     importStatusRec.setFieldValue("custrecord_mesasge",message);
        //     importStatusRec.setFieldValue("custrecord_status","生成失败");
        // }else {
        //     importStatusRec.setFieldValue("custrecord_status","生成成功");
        //     importStatusRec.setFieldValue("custrecord_mesasge","Excel数据生成配货单全部成功！");
        // }
        // var importStatusId = nlapiSubmitRecord(importStatusRec);
        // nlapiLogExecution("AUDIT","importStatusId",importStatusId);
    }
    // if(type == "createOrder"){
    //     try {
    //         var jsonRec = nlapiLoadRecord("customrecord_swc_import_info_json", jsonId);
    //         //导入数据  格式：{ids:[1,2,3,...]}
    //         var fileData = jsonRec.getFieldValue("custrecord_json") ? (JSON.parse(jsonRec.getFieldValue("custrecord_json"))) : {};//预览数据
    //         nlapiLogExecution("AUDIT","fileData",JSON.stringify(fileData))
    //         nlapiLogExecution("AUDIT","fileData-length",Object.keys(fileData).length)
    //         var idsArr = fileData["ids"];
    //         if(idsArr.length > 0){
    //             // 循环结果，修改配货单状态
    //             for(var i = 0;i<idsArr.length;i++) {
    //                 governanceYield(); // usage恢复
    //                 var deliveryNoteRec = nlapiLoadRecord("customrecord_swc_phd",idsArr[i]);
    //                 deliveryNoteRec.setFieldValue("custrecord_flag","F");//为ture的时候 执行UE脚本
    //                 deliveryNoteRec.setFieldValue("custrecord_swc_phd_ys_status","1");//易神同步状态 1，推送中
    //                 deliveryNoteRec.setFieldValue("custrecord_swc_phd_ns_status","2");//NS单据生成状态 2，生成中
    //                 var deliveryNoteId = nlapiSubmitRecord(deliveryNoteRec);
    //                 //nlapiLogExecution("AUDIT","craete-deliveryNoteId",deliveryNoteId);
    //             }
    //             // 循环结果，修改配货单,UE执行生成NS单据
    //             for(var j = 0;j<idsArr.length;j++) {
    //                 governanceYield(); // usage恢复
    //                 var deliveryNoteRec = nlapiLoadRecord("customrecord_swc_phd",idsArr[j]);
    //                 deliveryNoteRec.setFieldValue("custrecord_flag","T");//为ture的时候 执行UE脚本
    //                 var deliveryNoteId = nlapiSubmitRecord(deliveryNoteRec);
    //                 //nlapiLogExecution("AUDIT","craete-deliveryNoteId",deliveryNoteId);
    //             }
    //         }
    //     }catch (e) {
    //         message += e.message;
    //     }
    //
    // }
    nlapiLogExecution("AUDIT","message",message);
    //nlapiLogExecution("AUDIT","importId",importId);

}

/**
 * 获取所有【国家/地区】的ID,
 */
function getAllCountry (){
    var subsidiarySearch = nlapiSearchRecord("subsidiary",null,
        [
        ],
        [
            new nlobjSearchColumn("country"),
            new nlobjSearchColumn("internalid")
        ]
    );
    var countryArr = [];
    if (subsidiarySearch && subsidiarySearch.length > 0) {
        for (var i = 0 ; i < subsidiarySearch.length; i++) {
            var subsId = subsidiarySearch[i].getValue("internalid"); // 获取对应的子公司id
            var countryId = subsidiarySearch[i].getValue("country"); // 获取对应的国家/地区id
            var countryObj = {
                "subsId": subsId,
                "countryId": countryId
            }
            if (countryObj.hasOwnProperty("subsId") && countryObj.countryId) countryArr.push(countryObj);
        }
    }
    return countryArr;
}

/**
 * General method of processing more than 1000 data
 * 处理数据条数超过1000的情况
 * @param search
 * @returns {Array}
 */
function getAllResultsOfSearch(search) {
    var resultSet = search.runSearch();
    var start = 0;
    var step = 1000;
    var resultArr = [];
    var results = resultSet.getResults(start, Number(start) + Number(step));
    while (results && results.length > 0) {
        governanceYield();
        resultArr = resultArr.concat(results);
        start = Number(start) + Number(step);
        results = resultSet.getResults(start, Number(start) + Number(step));
    }
    return resultArr;
}

/**
 * 基础数据可用（基础数据：客户、供应商、地点等）
 * 根据数字字段数组值检索对应单据id
 * @param {Object} options
 * @param {string} options.type 单据类型
 * @param {string} options.field 检索字段
 * @param {array} options.fieldValue 检索值
 * @returns {Object} {"检索值参数": "单据id", ...}
 */
function srchEntityIdByValAry(options) {
    var filters = [["isinactive","is","F"]];
    var fieldFilters = [];
    if (options.fieldValue) {
        options.fieldValue = options.fieldValue.filter(function(value, index){
            return options.fieldValue.indexOf(value) === index;  // 因为indexOf 只能查找到第一个
        });

        options.fieldValue.forEach(function (value, index) {
            if (index != 0) {
                fieldFilters.push("OR");
            }
            fieldFilters.push([options.field,"is", value]);
        });
    }
    if (fieldFilters.length) {
        filters.push("AND", fieldFilters);
    }

    var srchObj = search.create({
        type: options.type,
        filters: filters,
        columns: [
            search.createColumn({name: "internalid"}),
            search.createColumn({name: options.field})
        ]
    });

    var entitiyObj = {};
    srchObj.run().each(function(result) {
        var field = "";
        if(options.type == "item" && result.getValue({name: options.field})){
            var name = result.getValue({name: options.field});
            field = (name.split(":")[1]).trim();
        }else {
            field = result.getValue({name: options.field});
        }
        var id = result.getValue({name: "internalid"});

        entitiyObj[field] = id;

        return true;
    });

    return entitiyObj;
}

/**
 * 处理usage
 */
function governanceYield() {
    // 使用在9700以上就更新usage
    if (parseInt(nlapiGetContext().getRemainingUsage()) <= 300) {
        var state = nlapiYieldScript();
        if (state.status == 'FAILURE') {
            nlapiLogExecution('DEBUG', 'Failed to yield script.');
        } else if (state.status == 'RESUME') {
            nlapiLogExecution('DEBUG', 'Resuming script');
        }
    }//
}




