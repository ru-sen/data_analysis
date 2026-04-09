/**
 * @NApiVersion 2.0
 * @NModuleScope Public
 */
define(["N/format","N/runtime","N/file","N/encode","N/crypto","N/search","N/email"],

    function(format,runtime,file,encode,crypto,search,email) {
        function emportPrintTemplate(options,out)
        {
            var LogisticCode = out.orders.LogisticCode;
            if(LogisticCode)
            {
                var myFileObj = file.create({
                    name: out.orders.LogisticCode + ".html",
                    fileType: file.Type.HTMLDOC,
                    contents: out.PrintTemplate,
                    encoding: file.Encoding.UTF8,
                    isOnline:true,
                    folder: 419//沙箱419,生产353
                });
                var fileId = myFileObj.save();
                out.PrintTemplate = fileId;
                options.PrintTemplate = fileId;
                options.LogisticCode = LogisticCode;
            }
        }
        function encodeConvent(dataStrMd5) {
            return encode.convert({string:dataStrMd5,outputEncoding:encode.Encoding.BASE_64,inputEncoding:encode.Encoding.UTF_8});
        }
        function dataStrMd5(input,sessionkey,platformName)
        {
            var dataStrMd5 = crypto.createHash({algorithm:crypto.HashAlg.MD5});
            if(platformName == "GUANYI")
            {
                dataStrMd5.update({input:sessionkey + JSON.stringify(input) + sessionkey});
            }
            if(platformName == "KDNIAO")
            {
                dataStrMd5.update({input:JSON.stringify(input) + sessionkey});
            }
            dataStrMd5 = dataStrMd5.digest().toLowerCase();//解析后转成全小写的
            return dataStrMd5;
        }
        function signIt(appKey,timestamp,sessionSecret)
        {
            var header = encodeConvent(JSON.stringify({typ: "JWT", alg: "HS256"})).replace(/=+$/, '');
            var body = encodeConvent(JSON.stringify({"appid" : appKey, "timestamp" : timestamp })).replace(/=+$/, '');
            var sKey = crypto.createSecretKey({secret: sessionSecret, encoding: encode.Encoding.UTF_8});
            var signer = crypto.createHmac({algorithm: crypto.HashAlg.SHA256, key: sKey});
            signer.update({input: header + "." + body, inputEncoding: encode.Encoding.UTF_8});
            var sig = signer.digest({outputEncoding: encode.Encoding.BASE_64_URL_SAFE}).replace(/=+$/, '');
            return [header, body, sig].join(".");
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
        function searchByExternalIds(ids, recType) {
            if (!ids || !recType) {
                return {};
            }

            return searchByIdColumn(recType, ids, "externalid");
        }
// allowNullFilters : 是否允许null filters，如果filters 为null，则检索出全部数据
        function searchByIdColumn(recType, idAry, colName, resultColName, allowNullFilters) {
            if (!recType || !idAry || !colName) {
                return {};
            }

            var filters = buildIdFilters(colName, idAry);
            if (!filters && !allowNullFilters) {
                return {};
            }

            return getResultJson(recType, filters, colName, resultColName);
        }
        // 根据id 检索，例如internalid等等
        function buildIdFilters(colName, idAry) {
            if (!colName || !idAry || !idAry.length) {
                return null;
            }
            if (colName != "externalid") {
                idAry = allNumbers(idAry);
            }

            if (!idAry.length) {
                return null;
            }
            return [ colName, "anyof", idAry ];
        }
        function getResultJson(recType, filters, colName, resultColName) {
            var keyCol = search.createColumn({name: colName});
            var cols = [ keyCol ];
            var col = resultColName && new nlobjSearchColumn(resultColName);
            if (col) {
                cols.push(col);
            }
            var mySearch = search.create({type:recType, filters:filters, columns:cols});
            var results = getAllResults(mySearch);
            var retJson = {};
            _.each(results, function(searchResult, index) {
                var id = searchResult.id;
                var key = searchResult.getValue(keyCol) || "";
                if (!key) {
                    return;
                }

                retJson[key] = col ? searchResult.getValue(col) : id;
            });
            return retJson;
        }
        function searchByNameColumn(recType, namesAry, colName, resultColName) {
            if (!recType || !namesAry || !colName) {
                return {};
            }

            var filters = buildNameFilters(colName, namesAry);
            if (!filters && !allowNullFilters) {
                return {};
            }

            return getResultJson(recType, filters, colName, resultColName);
        }
        function buildNameFilters(colName, nameAry) {
            if (!colName || !nameAry || !nameAry.length) {
                return null;
            }

            var filters = [];
            _.each(nameAry, function(name) {
                if (!name) {
                    return;
                }
                if (filters.length) {
                    filters.push("or");
                }
                filters.push([ colName, "is", name ]);
            });
            return filters;
        }
// 将ary 中非数值 去除
        function allNumbers(ary) {
            if (!_.isArray(ary)) {
                ary = [ ary ];
            }

            return _.filter(ary, function(val) {
                val = Number(val)
                return (!_.isNaN(val))
            });
        }
        function searchByExternalId(id, recType) {
            if (!id) {
                return "";
            }
            var retJson = searchByExternalIds([ id ], recType);
            return retJson[id] || "";
        }
        function calcPrice(priceIncTax, taxRate)//taxRate = 13.0
        {
            if (!taxRate) {
                return priceIncTax;
            }
            // return nlapiFormatCurrency(priceIncTax / (1 + taxRate * 1));
            // return format.format({value:priceIncTax / (1 + taxRate / 100), type: format.Type.FLOAT});
            return Number(priceIncTax / (1 + taxRate / 100)).toFixed(8);
        }

        function setFieldsValues(rec, fieldsJson, isText, allowEmptyValue) {
            if (!rec || !fieldsJson) {
                return;
            }
            for ( var fldName in fieldsJson) {
                var val = fieldsJson[fldName] || "";
                // 不允许空值，则不设置
                if (!allowEmptyValue && !val) {
                    continue;
                }
                if (typeof val != "string") {
                    val = JSON.stringify(val);
                }
                setFieldValue(rec,isText,fldName,val);
            }
        }
        function setFieldValue(rec,isText,fldName,val)
        {
            if(val == "T"){val = true;}
            if(val == "F"){val = false;}
            if (isText) {
                rec.setText({fieldId:fldName, text:val});
            } else {
                rec.setValue({fieldId:fldName, value:val});
            }
        }
        function chanedItemCode(itemCodeArray,itemDetailsJson,locationArray)
        {
            var filters = [];
            if(itemCodeArray && itemCodeArray.length > 0)
            {
                filters.push(["externalid","anyof",itemCodeArray]);
                if(locationArray && locationArray.length > 0)
                {
                    filters.push("AND");
                    filters.push(["inventorylocation","anyof",locationArray]);
                }
            }
            var myItemsSearch = createItemSearch(filters);
            if(filters.length > 0)
            {
                itemDetailsJson.ids = {};
                itemDetailsJson.names = {};
                itemDetailsJson.stocks = {};
                var results = getAllResults(myItemsSearch);
                _.each(results, function(result) {
                    var externalId = result.getValue("externalid");
                    var locationId = result.getValue("inventorylocation");
                    itemDetailsJson.ids[externalId] = result.id;
                    itemDetailsJson.names[externalId] = itemDetailsJson.names[externalId] || {};
                    itemDetailsJson.names[externalId].displayName = result.getValue("displayname");
                    itemDetailsJson.names[externalId].type = result.getValue("type");
                    var stocks = itemDetailsJson.stocks[externalId] = itemDetailsJson.stocks[externalId] || {};
                    var locs = stocks[locationId] = stocks[locationId] || {};
                    locs.available = result.getValue("locationquantityavailable") || 0;
                    locs.onhand = result.getValue("locationquantityonhand") || 0;
                });
            }
        }
        function getItemStocks(itemCodeArray,stoksJson,locationArray)
        {
            var filters = [];
            if(itemCodeArray && itemCodeArray.length > 0)
            {
                filters.push(["externalid","anyof",itemCodeArray]);
                if(locationArray && locationArray.length > 0)
                {
                    filters.push("AND");
                    filters.push(["inventorylocation","anyof",locationArray]);
                }else{
                    return;
                }
            }
            var myItemsSearch = createItemSearch(filters);
            if(filters.length > 0)
            {
                stoksJson.ids = {};
                stoksJson.stocks = {};
                var results = getAllResults(myItemsSearch);
                _.each(results, function(result) {
                    var externalId = result.getValue("externalid");
                    var locationId = result.getValue("inventorylocation");
                    stoksJson.ids[externalId] = result.id;
                    var stocks = stoksJson.stocks[externalId] = stoksJson.stocks[externalId] || {};
                    var locs = stocks[locationId] = stocks[locationId] || {};
                    locs.available = result.getValue("locationquantityavailable") || 0;
                    locs.onhand = result.getValue("locationquantityonhand") || 0;
                });
            }
        }
        function chanedCustomerName(customerArray)
        {
            var customerJson = {};
            var filters = [];
            var cusNameFilters = [];
            _.each(customerArray, function(customerName)
            {
                customerName && cusNameFilters.push(["entityid","is",customerName],"OR");
            });
            if(cusNameFilters.length > 0)
            {
                cusNameFilters.pop();
                filters.push(cusNameFilters,"AND",["isinactive","is","F"]);
                var myCustomerSearch = createCustomerSearch(filters);
                var results = getAllResults(myCustomerSearch);
                _.each(results, function(result) {
                    var altname = result.getValue("altname");
                    customerJson[altname] = result.id;
                });
            }
            return customerJson;
        }
        function createItemSearch(filters)
        {
            return search.create({
                type: "item",
                filters:filters,
                columns:
                    [
                        search.createColumn({name: "externalid"}),
                        search.createColumn({name: "locationquantityavailable", label: "仓库资料 Available"}),
                        search.createColumn({name: "locationquantityonhand", label: "仓库资料 On Hand"}),
                        search.createColumn({name: "inventorylocation", label: "仓库资料"}),
                        search.createColumn({name: "displayname", label: "Display Name"}),
                        search.createColumn({name: "type", label: "类型"})
                    ]
            });
        }
        function createCustomerSearch(filters)
        {
            return search.create({
                type: "customer",
                filters:filters,
                columns:
                    [
                        search.createColumn({name: "altname", label: "Name"})
                    ]
            });
        }
        //币别
        function currencyMaping(ISOCODE)
        {
            var Currencies = {"CNY":1,"USD":2,"CAD":3,"EUR":4,"HKD":5,"AUD":6,"GBP":7,"JPY":8,"MXN":9,"AED":10,"SGD":11,"MYR":12,"SEK": 13,"CHF":14,"TWD":15,"PHP":16};
            if(Currencies.hasOwnProperty(ISOCODE))
            {
                return Currencies[ISOCODE];
            }
            return ISOCODE;
        }
        //strDate = "20200331"
        function formatDate(strDate)
        {
            if(strDate)
            {
                var formatString = [(strDate.substring(0,4)), (strDate.substring(4,6)), (strDate.substring(6,8))].join("/");
                var userObj = runtime.getCurrentUser();
                var userFormat = userObj.getPreference ({
                    name: "DATEFORMAT"
                });
                var isDate = new Date(formatString);
                userFormat = userFormat.replace(/YYYY/, isDate.getFullYear());
                if(userFormat.indexOf("MM") < 0 && userFormat.indexOf("M") >= 0)
                {
                    userFormat = userFormat.replace(/M/, isDate.getMonth() + 1);
                }else{
                    userFormat = userFormat.replace(/MM/, isDate.getMonth() + 1);
                }
                if(userFormat.indexOf("DD") < 0 && userFormat.indexOf("D") >= 0)
                {
                    userFormat = userFormat.replace(/D/, isDate.getDate());
                }else{
                    userFormat = userFormat.replace(/DD/, isDate.getDate());
                }
                log.audit({title:strDate+"",details:formatDate});
                return userFormat;
            }
        }

        /**
         * 浙大恩特 专用
         * @param principal
         * @returns {null}
         */
        function checkEmployee(principal)
        {
            var employeeId = null;
            if(!principal)
            {
                return employeeId;
            }
            var employeeSearchObj = search.create({
                type: "employee",
                filters:
                    [
                        ["custentity_swc_ename","is",principal]
                    ],
                columns:[]
            });
            employeeSearchObj.run().each(function(result){
                // .run().each has a limit of 4,000 results
                employeeId = result.id;
                return true;
            });
            return employeeId;
        }

        function searchSoWithPlatformCodeAndSOcode(platformCode,soCode) {

            var salesorderSearchObj = search.create({
                type: "salesorder",
                filters:
                    [
                        ["type","anyof","SalesOrd"],
                        "AND",
                        ["externalid","anyof",platformCode],
                        "AND",
                        ["custbody_swc_guanyi_num","is",soCode]
                    ],
                columns:
                    [
                        search.createColumn({
                            name: "ordertype",
                            sort: search.Sort.ASC,
                            label: "定单类型"
                        })
                    ]
            });
            var results = salesorderSearchObj.run().getRange({start : 0,end : 1});
            if(results && results.length > 0)
            {
                return results[0].id;
            }
            return;
        }
        function checkPurchaseOrder(tranid)
        {
            if(!tranid)return;
            var poId = "";
            var purchaseorderSearchObj = search.create({
                type: "purchaseorder",
                filters:
                    [
                        ["type","anyof","PurchOrd"],
                        "AND",
                        ["status","anyof","PurchOrd:E","PurchOrd:D","PurchOrd:B"],
                        "AND",
                        ["numbertext","is",tranid],
                        "AND",
                        ["mainline","is","T"],
                        "AND",
                        ["custbody_swc_issync","is","T"],//已同步至盘谷系统的标识符
                    ],
                columns:
                    []
            });
            purchaseorderSearchObj.run().each(function(result) {
                poId = result.id;
                return true;
            });
            return poId;
        }
        function checkItems(itemArr)
        {
            var itemJson = {};
            var filtersArr = buildNameFilters("upccode", itemArr);
            // for(var i = 0;i < itemArr.length;i++) {
            //     if(i == 0){
            //         filtersArr.push(["upccode","is",itemArr[i]]);
            //     }else {
            //         filtersArr.push("OR");
            //         filtersArr.push(["upccode","is",itemArr[i]]);
            //     }
            // }
            if(!filtersArr || filtersArr.length <= 0)
            {
                return itemJson;
            }
            var itemSearchObj = search.create({
                type: "item",
                filters: filtersArr,
                columns:
                    [
                        search.createColumn({name: "upccode", label: "统一商品代码"}),
                        search.createColumn({name: "internalid", label: "内部标识"}),
                        search.createColumn({name: "type", label: "类型"}),
                        search.createColumn({name: "displayname", label: "显示名称"}),
                        search.createColumn({name: "isserialitem", label: "是序列化货品"}),
                        search.createColumn({name: "islotitem", label: "是按批号编号的货品"})
                    ]
            });
            var itemCodeMapArr = getAllResults(itemSearchObj);
            for(var i = 0;i < itemCodeMapArr.length;i++) {
                var itemId = itemCodeMapArr[i].id;
                itemJson[itemId] = itemCodeMapArr[i];
            }
            return itemJson;
        }
        function checkWorkOrder(tranid)
        {
            if(!tranid)return;
            var workOrderObj = {};
            var workorderSearchObj = search.create({
                type: "workorder",
                filters:
                    [
                        ["type","anyof","WorkOrd"],
                        "AND",
                        ["status","anyof","WorkOrd:D"],
                        "AND",
                        ["buildable","greaterthan","0"],
                        "AND",
                        ["numbertext","is",tranid],
                        "AND",
                        ["mainline","is","T"]
                    ],
                columns:
                    [
                        search.createColumn({
                            name: "trandate",
                            sort: search.Sort.ASC,
                            label: "日期"
                        }),
                        search.createColumn({name: "asofdate", label: "截止日期"}),
                        search.createColumn({name: "postingperiod", label: "期间"}),
                        search.createColumn({name: "taxperiod", label: "税期"}),
                        search.createColumn({name: "type", label: "类型"}),
                        search.createColumn({name: "tranid", label: "文件号码"}),
                        search.createColumn({name: "entity", label: "名称"}),
                        search.createColumn({name: "account", label: "科目"}),
                        search.createColumn({name: "amount", label: "金额"}),
                        search.createColumn({name: "appliedtotransaction", label: "应用至事务处理"}),
                        search.createColumn({
                            name: "tranid",
                            join: "appliedToTransaction",
                            label: "文件号码"
                        })
                    ]
            });
            workorderSearchObj.run().each(function(result){
                workOrderObj.id = result.id;
                workOrderObj.appliedtotransaction = result.getValue({name: "appliedtotransaction", label: "应用至事务处理"}) || "";
                workOrderObj.tranid = result.getValue({name: "tranid", join: "appliedToTransaction", label: "文件号码"}) || "";
                // .run().each has a limit of 4,000 results
                return true;
            });
            return workOrderObj;
        }
        function checkTransaction(options)
        {
            var dataObj = options.output;
            var tranid = dataObj.tranid;
            if(!tranid)return;
            var filters = [[["numbertext","is",tranid],"OR",["appliedtotransaction.numbertext","is",tranid]]];
            var linesArray = dataObj.lines;
            util.each(linesArray,function (obj,index){
                var upccode = obj.name;
                filters.push("AND",["item.upccode","is",upccode]);
            });
            dataObj.transactions = {};
            var transactionSearchObj = search.create({
                type: "transaction",
                filters:filters,
                columns:
                    [
                        search.createColumn({name: "item", label: "货品"}),
                        search.createColumn({
                            name: "upccode",
                            join: "item",
                            label: "统一商品代码"
                        }),
                        search.createColumn({
                            name: "isserialitem",
                            join: "item",
                            label: "是序列化货品"
                        }),
                        search.createColumn({
                            name: "islotitem",
                            join: "item",
                            label: "是按批号编号的货品"
                        }),
                        search.createColumn({name: "trandate", label: "日期"}),
                        search.createColumn({name: "type", label: "类型"}),
                        search.createColumn({name: "tranid", label: "文件号码"}),
                        search.createColumn({name: "appliedtotransaction", label: "应用至事务处理"}),
                        search.createColumn({
                            name: "tranid",
                            join: "appliedToTransaction",
                            label: "文件号码"
                        }),
                        search.createColumn({
                            name: "inventorynumber",
                            join: "inventoryDetail",
                            label: " 编号"
                        }),
                        search.createColumn({
                            name: "location",
                            join: "inventoryDetail",
                            label: "地点"
                        }),
                        search.createColumn({name: "postingperiod", label: "期间"})
                    ]
            });
            var searchResultCount = transactionSearchObj.runPaged().count;
            log.debug("transactionSearchObj result count",searchResultCount);
            transactionSearchObj.run().each(function(result){
                var transactionId = result.id;
                var itemId = result.getValue({name: "item", label: "货品"});
                var appliedtotransactionId = result.getValue({name: "appliedtotransaction", label: "应用至事务处理"});
                var type = result.getValue({name: "type", label: "类型"});
                var inventoryNumber = result.getText({
                    name: "inventorynumber",
                    join: "inventoryDetail",
                    label: "编号"
                });
                var locationId = result.getValue({
                    name: "location",
                    join: "inventoryDetail",
                    label: "地点"
                });
                var detailsJson = dataObj.transactions[tranid] = dataObj.transactions[tranid] || {};
                if(type == "ItemShip")
                {
                    var itemShipJson = detailsJson.ItemShip = detailsJson.ItemShip || {};
                    var inventoryJson = itemShipJson[itemId] = itemShipJson[itemId] || {};
                    inventoryJson.upccode = result.getValue({name: "upccode", join: "item",label: "upccode"});
                    inventoryJson.isserial = result.getValue({name: "isserialitem", join: "item",label: "isserialitem"});
                    inventoryJson.islotnumbered = result.getValue({name: "islotitem", join: "item",label: "islotitem"});
                    inventoryJson.inventoryDetail = inventoryJson.inventoryDetail || [];
                    inventoryJson.inventoryDetail.push({
                        locationId:locationId,
                        inventoryNumber:inventoryNumber,
                        itemShipId:transactionId
                    });
                }
                if(type == "ItemRcpt")
                {
                    var itemRcptJson = detailsJson.ItemRcpt = detailsJson.ItemRcpt || {};
                    var inventoryJson = itemRcptJson[itemId] = itemRcptJson[itemId] || {};
                    inventoryJson.upccode = result.getValue({name: "upccode", join: "item",label: "upccode"});
                    inventoryJson.isserial = result.getValue({name: "isserialitem", join: "item",label: "isserialitem"});
                    inventoryJson.islotnumbered = result.getValue({name: "islotitem", join: "item",label: "islotitem"});
                    inventoryJson.inventoryDetail = inventoryJson.inventoryDetail || [];
                    inventoryJson.inventoryDetail.push({
                        locationId:locationId,
                        inventoryNumber:inventoryNumber,
                        itemShipId:transactionId
                    });
                }
                if(type == "VendAuth")
                {
                    var vendAuthJson = detailsJson.VendAuth = detailsJson.VendAuth || {};
                    var inventoryJson = vendAuthJson[itemId] = vendAuthJson[itemId] || {};
                    inventoryJson.upccode = result.getValue({name: "upccode", join: "item",label: "upccode"});
                    inventoryJson.isserial = result.getValue({name: "isserialitem", join: "item",label: "isserialitem"});
                    inventoryJson.islotnumbered = result.getValue({name: "islotitem", join: "item",label: "islotitem"});
                    inventoryJson.inventoryDetail = inventoryJson.inventoryDetail || [];
                    inventoryJson.inventoryDetail.push({
                        locationId:locationId,
                        inventoryNumber:inventoryNumber,
                        itemShipId:transactionId
                    });
                }
                if(type == "CustInvc")
                {
                    var custInvcJson = detailsJson.CustInvc = detailsJson.CustInvc || {};
                    var inventoryJson = custInvcJson[transactionId] = custInvcJson[transactionId] || {};
                    inventoryJson[inventoryNumber] = result.getValue({name: "postingperiod", label: "期间"});
                }
                if(appliedtotransactionId)
                {
                    dataObj.appliedtotransactionId = appliedtotransactionId;
                }
                // .run().each has a limit of 4,000 results
                return true;
            });
        }
        function checkItemInventoryDetails(options)
        {
            var itemsArray = options.output.lines;
            var filters1 = [];
            var filtersArr = [];
            util.each(itemsArray,function (itemObj,index) {
                var upccode = itemObj.name;
                if(upccode)
                {
                    if(filtersArr.length > 0)
                    {
                        filtersArr.push("OR",["upccode","is",upccode]);
                    }else
                    {
                        filtersArr.push(["upccode","is",upccode]);
                    }
                }
                util.each(itemObj.inventoryDetail,function (obj,index) {
                    var inventorynumber = obj.receiptinventorynumber;
                    if(inventorynumber)
                    {
                        if(filters1.length > 0)
                        {
                            filters1.push("OR",["inventorynumber.inventorynumber","is",inventorynumber]);
                        }else
                        {
                            filters1.push(["inventorynumber.inventorynumber","is",inventorynumber]);
                        }
                    }
                });
            });
            var itemJson = {};
            var filters =
                [
                    ["inventorynumber.quantityonhand","greaterthan","0"],
                    "AND",
                    ["locationquantityonhand","greaterthan","0"],
                    "AND",
                    ["formulatext: case when {inventorydetail.inventorynumber} ={inventorynumber.inventorynumber}then 'A' else 'B' end","startswith","A"],
                    "AND",
                    ["formulatext: case when {inventorylocation} = {inventorynumber.location} then 'A' else 'B' end","startswith","A"],
                    "AND",
                    ["formulatext: case when {islotitem} ='T' OR {isserialitem} = 'T' then 'A' else 'B' end","startswith","A"],
                    "AND",
                    ["formulatext: case when {inventorydetail.location} = {inventorynumber.location} then 'A' else 'B' end","startswith","A"]
                ];
            if(filtersArr.length <= 0 && filters1.length <= 0)
            {
                return;
            }
            if(filtersArr.length > 0)
            {
                filters.push("AND",filtersArr);
            }
            if(filters1.length > 0)
            {
                filters.push("AND",filters1);
            }
            var itemSearchObj = search.create({
                type: "item",
                filters:filters,
                columns:
                    [
                        search.createColumn({
                            name: "itemid",
                            summary: "GROUP",
                            sort: search.Sort.ASC,
                            label: "名称"
                        }),
                        search.createColumn({
                            name: "inventorynumber",
                            join: "inventoryNumber",
                            summary: "GROUP",
                            label: "编号"
                        }),
                        search.createColumn({
                            name: "location",
                            join: "inventoryNumber",
                            summary: "GROUP",
                            label: "地点"
                        }),
                        search.createColumn({
                            name: "quantityavailable",
                            join: "inventoryNumber",
                            summary: "GROUP",
                            label: "可用"
                        }),
                        search.createColumn({
                            name: "inventorynumber",
                            join: "inventoryDetail",
                            summary: "GROUP",
                            label: " 编号"
                        }),
                        search.createColumn({
                            name: "internalid",
                            join: "inventoryNumber",
                            summary: "GROUP",
                            label: "内部标识"
                        }),
                        search.createColumn({name: "upccode", label: "统一商品代码", summary: "GROUP"}),
                        search.createColumn({
                            name: "subsidiary",
                            join: "inventoryLocation",
                            summary: "GROUP",
                            label: "子公司"
                        })
                    ]
            });
            var retults = getAllResults(itemSearchObj);
            util.each(retults,function (result){
                var itemId = result.id;
                itemJson[itemId+""] = itemJson[itemId+""] || [];
                var dataJson =
                    {
                        upcCode : result.getValue({name: "upccode", label: "统一商品代码", summary: "GROUP"}),
                        location : result.getValue({name: "location", join: "inventoryNumber", label: "统一商品代码", summary: "GROUP"}),
                        inventoryNumber : result.getValue({name: "inventorynumber", join: "inventoryNumber", label: "编号", summary: "GROUP"}),
                        quantityavailable : result.getValue({name: "quantityavailable", join: "inventoryNumber", label: "可用", summary: "GROUP"}),
                    };
                itemJson[itemId+""].push(dataJson);
            });
            return itemJson;
        }

        /**
         * 查询各子公司对应的客户仓
         * customrecord_swc_cus_location_map
         */
        function searchCustomerLocation()
        {
            var cusLocJson = {};
            var customrecord_swc_cus_location_mapSearchObj = search.create({
                type: "customrecord_swc_cus_location_map",
                filters:
                    [
                        ["isinactive","is","F"]
                    ],
                columns:
                    [
                        search.createColumn({name: "custrecord_swcclm_location", label: "仓库"}),
                        search.createColumn({name: "custrecord_swcclm_subsidiary", label: "子公司"})
                    ]
            });
            var searchResultCount = customrecord_swc_cus_location_mapSearchObj.runPaged().count;
            log.debug("customrecord_swc_cus_location_mapSearchObj result count",searchResultCount);
            customrecord_swc_cus_location_mapSearchObj.run().each(function(result){
                // .run().each has a limit of 4,000 results
                var subId = result.getValue({name: "custrecord_swcclm_subsidiary", label: "子公司"});
                cusLocJson[subId] = cusLocJson[subId] || {};
                cusLocJson[subId].locationId = result.getValue({name: "custrecord_swcclm_location", label: "仓库"});
                return true;
            });
            return cusLocJson;
        }
        /**
         *
         * @param itemsArray[{name:""}]
         * @returns [name]
         */
        function getItemCodeArray(itemsArray)
        {
            var itemArr = [];
            util.each(itemsArray,function (itemObj,index) {
                itemArr.push(itemObj.name);
            });
            return itemArr;
        }
        function searchInventoryDetails(options)
        {
            var itemsArray = options.output.lines;

            var inventoryNumbers = [];
            options.itemsJson = {};
            var itemCodeArr = Array.from(new Set(itemsArray.map(function(obj){return obj.name})));
            var filters1 = buildNameFilters("item.upccode", itemCodeArr);

            var serialNumbers = Array.from(new Set(itemsArray.flatMap(function(obj){return obj.serialNumbers})));
            var batchNumbers = Array.from(new Set(itemsArray.flatMap(function(obj){return obj.batchNumbers})));
            inventoryNumbers = _.unique(serialNumbers.concat(batchNumbers));
            var filters2 = buildNameFilters("inventorynumber.inventorynumber", inventoryNumbers);
            var filters =
                [
                    ["available", "greaterthan", "0"]
                ];
            if(filters1.length <= 0 )
            {
                return;
            }
            filters.push("AND",filters1);
            if(filters2.length > 0)
            {
                filters.push("AND",filters2);
            }
            const inventorybalanceSearch = search.create({
                type: "inventorybalance",
                filters: filters,
                columns: [
                    search.createColumn({ name: "item", sort: search.Sort.ASC }),
                    search.createColumn({ name: "upccode", join: "item" }),
                    search.createColumn({ name: "isserialitem", join: "item" }),
                    search.createColumn({ name: "displayname", join: "item" }),
                    search.createColumn({ name: "islotitem", join: "item" }),
                    search.createColumn({ name: "type", join: "item" }),
                    search.createColumn({ name: "binnumber" }),
                    search.createColumn({ name: "location" }),
                    search.createColumn({ name: "inventorynumber" }),
                    search.createColumn({ name: "available" }),
                    search.createColumn({ name: "subsidiary", join: "location" })
                ],
            });
            var results = getAllResults(inventorybalanceSearch);
            util.each(results,function (result) {
                var itemId = result.getValue({ name: "item", sort: search.Sort.ASC });
                var locationId = result.getValue({ name: "location" });
                var inventorynumber = result.getText({ name: "inventorynumber" });
                var available = result.getValue({ name: "available" });
                var detailsJson = options.itemsJson[itemId] = options.itemsJson[itemId] || {};
                detailsJson.upccode = result.getValue({ name: "upccode", join: "item" });
                detailsJson.isserialitem = result.getValue({ name: "isserialitem", join: "item" });
                detailsJson.islotitem = result.getValue({ name: "islotitem", join: "item" });
                detailsJson.displayname = result.getValue({ name: "displayname", join: "item" });
                detailsJson.type = result.getValue({ name: "type", join: "item" });
                detailsJson.location = detailsJson.location || {};
                var locDetails = detailsJson.location[locationId] = detailsJson.location[locationId] || {};
                locDetails.binnumber = result.getValue({ name: "binnumber" });
                locDetails.subsidiary = result.getValue({ name: "subsidiary", join: "location" });
                locDetails.subsidiaryName = result.getText({ name: "subsidiary", join: "location" });
                locDetails.available = available;
                locDetails.inventorynumber = locDetails.inventorynumber || {};
                locDetails.inventorynumber[inventorynumber] = locDetails.inventorynumber[inventorynumber] || {};
                locDetails.inventorynumber[inventorynumber].available = available;
                locDetails.inventorynumber[inventorynumber].id = result.getValue({ name: "inventorynumber" });
            });
            sendEmail(JSON.stringify(options.itemsJson));
        }
        function checkSalesOrd(options)
        {
            var data = options.output;
            var tranid = data.tranid;
            var salesOrdJson = options.SalesOrd = options.SalesOrd || {};
            var salesorderSearchObj = search.create({
                type: "salesorder",
                filters:
                    [
                        ["type","anyof","SalesOrd"],
                        "AND",
                        ["shipping","is","F"],
                        "AND",
                        ["taxline","is","F"],
                        "AND",
                        ["mainline","is","F"],
                        "AND",
                        ["numbertext","is",tranid],
                        "AND",
                        ["status","anyof","SalesOrd:B","SalesOrd:E","SalesOrd:D"]
                    ],
                columns:
                    [
                        search.createColumn({name: "trandate", label: "日期"}),
                        search.createColumn({name: "tranid", label: "文件号码"}),
                        search.createColumn({name: "subsidiarynohierarchy", label: "子公司(无层级)"})
                    ]
            });
            var searchResultCount = salesorderSearchObj.runPaged().count;
            log.debug("salesorderSearchObj result count",searchResultCount);
            salesorderSearchObj.run().each(function(result){
                // .run().each has a limit of 4,000 results
                salesOrdJson[tranid] = salesOrdJson[tranid] || {};
                salesOrdJson[tranid].id = result.id;
                salesOrdJson[tranid].subsidiary = result.getValue({name: "subsidiarynohierarchy", label: "子公司(无层级)"});
                return true;
            });
        }
        function searchTransaction(tranid)
        {
            var detailsJson = {};
            var transactionSearchObj = search.create({
                type: "transaction",
                filters:
                    [
                        ["shipping","is","F"],
                        "AND",
                        ["taxline","is","F"],
                        "AND",
                        ["mainline","is","F"],
                        "AND",
                        ["numbertext","is",tranid],
                        "AND",
                        ["status","anyof","SalesOrd:B","SalesOrd:E","SalesOrd:D"]
                    ],
                columns:
                    [
                        search.createColumn({
                            name: "trandate",
                            sort: search.Sort.ASC,
                            label: "日期"
                        }),
                        search.createColumn({
                            name: "formulatext",
                            formula: "to_char({trandate},'yyyymmdd')",
                            label: "公式（文本）"
                        }),
                        search.createColumn({name: "tranid", label: "文件号码"}),
                        search.createColumn({name: "item", label: "货品"}),
                        search.createColumn({name: "quantity", label: "数量"}),
                        search.createColumn({name: "line", label: "行Id"}),
                        search.createColumn({name: "unit", label: "单位"}),
                        search.createColumn({name: "subsidiarynohierarchy", label: "子公司(无层级)"})
                    ]
            });
            var results = getAllResults(transactionSearchObj);
            util.each(results,function (result) {
                var tranid = result.getValue({name: "tranid", label: "文件号码"});
                var lineId =  result.getValue({name: "line", label: "行Id"});
                var bodyJson = detailsJson[tranid] = detailsJson[tranid] || {};
                bodyJson.id = result.id;
                bodyJson.trandate = result.getValue({name: "formulatext",formula: "to_char({trandate},'yyyymmdd')",label: "公式（文本）"});
                bodyJson.subsidiary = result.getValue({name: "subsidiarynohierarchy", label: "子公司(无层级)"});
                bodyJson.subsidiaryName = result.getText({name: "subsidiarynohierarchy", label: "子公司(无层级)"});
                bodyJson.items = bodyJson.items || {};
                var itemsJson = bodyJson.items[lineId] = bodyJson.items[lineId] || {};
                itemsJson.total = result.getValue({name: "quantity", label: "数量"});
                itemsJson.itemId = result.getValue({name: "item", label: "货品"});
                itemsJson.unitId = result.getValue({name: "units", label: "单位"});
            });
            return detailsJson;
        }
        function sendEmail(message)
        {
            var userObj = runtime.getCurrentUser();
            email.send({
                author: userObj.id,
                recipients: userObj.email,
                subject: "数据集合",
                body: message
            });
        }
        function checkItemShip(ids,tranid,externalid)
        {
            var itemShipJson = {};
            if(!tranid) return;
            var filters =
                [
                    ["type","anyof","ItemShip"],
                    "AND",
                    ["appliedtotransaction.numbertext","is",tranid]
                ];
            if(ids && ids.length > 0)
            {
                filters.push("AND",["internalid","anyof",ids]);
            }
            if(externalid)
            {
                filters.push("AND",["custbody_swc_pg_externalid","is",externalid]);
            }
            var itemfulfillmentSearchObj = search.create({
                type: "itemfulfillment",
                filters:filters,
                columns:
                    [
                        search.createColumn({name: "item", label: "货品"}),
                        search.createColumn({name: "location", label: "地点"}),
                        search.createColumn({name: "quantity", label: "数量"}),
                        search.createColumn({name: "appliedtotransaction", label: "应用至事务处理"}),
                        search.createColumn({
                            name: "line",
                            join: "appliedToTransaction",
                            label: "行Id"
                        }),
                        search.createColumn({
                            name: "quantity",
                            join: "inventoryDetail",
                            label: "数量"
                        }),
                        search.createColumn({
                            name: "inventorynumber",
                            join: "inventoryDetail",
                            label: " 编号"
                        }),
                        search.createColumn({
                            name: "formulatext",
                            formula: "to_char({trandate},'yyyymmdd')",
                            label: "公式（文本）"
                        }),
                    ]
            });
            itemfulfillmentSearchObj.run().each(function(result){
                // .run().each has a limit of 4,000 results
                var ffId = result.id;
                var locationId = result.getValue({name: "location", label: "地点"});
                var lineId = result.getValue({name: "line",join: "appliedToTransaction",label: "行Id"});
                var inventorynumber = result.getValue({
                    name: "inventorynumber",
                    join: "inventoryDetail",
                    label: " 编号"
                });
                itemShipJson.ids = itemShipJson.ids || [];
                itemShipJson.ids.push(ffId);
                var bodyJson = itemShipJson.body = itemShipJson.body || {};
                bodyJson[tranid] = bodyJson[tranid] || {};
                bodyJson[tranid].transactionId = result.getValue({name: "appliedtotransaction", label: "应用至事务处理"});
                var detailsJson = bodyJson[tranid][ffId] = bodyJson[tranid][ffId] || {};
                var locationJson = detailsJson.location = detailsJson.location || {};
                detailsJson.trandate = result.getValue({name: "formulatext",formula: "to_char({trandate},'yyyymmdd')",label: "公式（文本）"});
                var lineJson = locationJson[locationId] = locationJson[locationId] || {};
                lineJson[lineId] = lineJson[lineId] || {};
                lineJson[lineId].itemid = result.getValue({name: "item", label: "货品"});
                lineJson[lineId].total = result.getValue({name: "quantity", label: "数量"});
                lineJson[lineId].nums = lineJson[lineId].nums || {};
                lineJson[lineId].nums[inventorynumber] = lineJson[lineId].nums[inventorynumber] || {};
                lineJson[lineId].nums[inventorynumber].total = result.getValue({name: "quantity",join: "inventoryDetail",label: "数量"})
                return true;
            });
            sendEmail(JSON.stringify(itemShipJson));
            return itemShipJson;
        }
        //Commons.checkSalesOrder(tranid);
        //Commons.setErrorMessage(errors,title,value,code)

        /**
         * pingCAP 根据authing id查员工
         * @param userid
         */
        function srchEmpByAuthingid(userid) {
            var empId = "";
            var employeeSearchObj = search.create({
                type: "employee",
                filters: [["isinactive","is","F"], "AND", ["custentity_swc_job_num","is",userid]],
                columns:
                    [
                        search.createColumn({name: "custentity_swc_job_num", label: "Authing员工id"}),
                        search.createColumn({name: "internalid", label: "内部 ID"})
                    ]
            });
            employeeSearchObj.run().each(function(result) {
                empId = result.getValue({name: "internalid"});
                return true;
            });
            return empId;
        }

        /**
         * pingCAP 根据authing 公司名称查询ns公司
         * @param subsidiaryName
         */
        function srchSubsidiaryByName(subsidiaryName) {
            /*if(subsidiaryName.indexOf("北京平凯星辰科技发展有限公司") >= 0) {
                subsidiaryName = "北京平凯星辰科技发展有限公司";
            } else if(subsidiaryName.indexOf("平凯星辰（北京）科技有限公司") >= 0) {
                subsidiaryName = "平凯星辰（北京）科技有限公司";
            }

            var nsSubsidiaryId = "";
            var subsidiarySearchObj = search.create({
                type: "subsidiary",
                filters: [
                    ["isinactive","is","F"],
                    "AND",
                    ["name","contains",subsidiaryName],
                    "AND",
                    // 20250904 hc add 不搜旧子公司
                    ["name","doesnotcontain","Old"]
                ],
                columns:
                    [
                        search.createColumn({name: "internalid", label: "内部 ID"})
                    ]
            });
            subsidiarySearchObj.run().each(function(result){
                nsSubsidiaryId = result.getValue({name: "internalid"});
                return true;
            });
            return nsSubsidiaryId;*/
            //20251202 Hitpoint 优化子公司取值
            if(subsidiaryName.indexOf("北京平凯星辰科技发展有限公司") >= 0) {
                subsidiaryName = "北京平凯星辰科技发展有限公司";
            } else if(subsidiaryName.indexOf("平凯星辰（北京）科技有限公司") >= 0) {
                subsidiaryName = "平凯星辰（北京）科技有限公司";
            } else if(['北京星云深图软件科技有限公司', '北京星云深图软件科技有限公司成都分公司', '北京星云深图软件科技有限公司广州分公司', '北京星云深图软件科技有限公司杭州分公司',
                '北京星云深图软件科技有限公司南京分公司', '北京星云深图软件科技有限公司上海分公司', '北京星云深图软件科技有限公司深圳分公司'].indexOf(subsidiaryName) > -1) {
                subsidiaryName = '北京星云深图软件科技有限公司';
            }

            var nsSubsidiaryId = "",
                len = subsidiaryName.length * -1;
            var subsidiarySearchObj = search.create({
                type: "subsidiary",
                filters: [
                    ["isinactive","is","F"],
                    "AND",
                    ["name","contains", subsidiaryName],
                    "AND",
                    ["name","doesnotcontain","Old"]
                ],
                columns:
                    [
                        search.createColumn({name: "internalid", label: "内部 ID"}),
                        search.createColumn({name: "name", label: "名称"})
                    ]
            });
            subsidiarySearchObj.run().each(function(result){
                if(result.getValue({name: 'name'}).slice(len) == subsidiaryName) {
                    nsSubsidiaryId = result.getValue({name: "internalid"});
                    return true;
                }
            });
            return nsSubsidiaryId;
        }

        /**
         *
         * @param departmentId
         */
        function srchDepartmentByAuthingid(departmentId) {
            var nsDepartmentId = "";
            var nsSupervisorId = "";
            var departmentSearchObj = search.create({
                type: "department",
                filters: [["isinactive","is","F"], "AND", ["custrecord_swc_authing_departid","is",departmentId]],
                columns:
                    [
                        search.createColumn({name: "internalid", label: "内部 ID"}),
                        search.createColumn({name: "custrecord_swc_authing_leaderid", label: "Authing 部门领导ID"}),
                        search.createColumn({name: "custrecord_swc_authing_departid", label: "Authing部门id"}),
                        search.createColumn({name: "custrecord_swc_depart_leader", label: "DEPART. LEADER"}),
                        search.createColumn({name: "custrecord_swc_budget_owner", label: "BUDGET OWNER"}),
                    ]
            });
            departmentSearchObj.run().each(function(result) {
                nsDepartmentId = result.getValue({name: "internalid"});
                nsSupervisorId = result.getValue({name: "custrecord_swc_depart_leader"});
                return true;
            });

            return {
                "nsDepartmentId" : nsDepartmentId,
                "nsSupervisorId" : nsSupervisorId
            }
        }

        /**
         *
         * @param email
         */
        function srchEmpByEmail(email) {
            var empId = "";
            var employeeSearchObj = search.create({
                type: "employee",
                //jjp20240715修改 start
                //filters: [["isinactive","is","F"], "AND", ["custentity_swc_work_num","is",email]],
                filters: [["isinactive","is","F"], "AND", ["custentity_swc_job_num","is",email]],
                //jjp20240715修改 end
                columns:
                    [
                        search.createColumn({name: "custentity_swc_job_num", label: "Authing员工id"}),
                        search.createColumn({name: "internalid", label: "内部 ID"})
                    ]
            });
            employeeSearchObj.run().each(function(result) {
                empId = result.getValue({name: "internalid"});
                return true;
            });
            return empId;
        }

        /**
         *
         * @param 根据邮箱查询员工
         */
        function srchEmpIdByEmail(email) {
            var empId = "";
            var employeeSearchObj = search.create({
                type: "employee",
                filters: [["isinactive","is","F"], "AND", ["email","is",email]],
                columns:
                    [
                        search.createColumn({name: "internalid", label: "内部 ID"})
                    ]
            });
            employeeSearchObj.run().each(function(result) {
                empId = result.getValue({name: "internalid"});
                return true;
            });
            return empId;
        }


        /**
         * 根据员工里authing 外部ID字段查询员工
         * @param hRBP
         */
        function srchEmpByAuthingExternalId(hRBP) {
            var empId = "";
            var employeeSearchObj = search.create({
                type: "employee",
                filters: [["isinactive","is","F"], "AND", ["custentity_swc_externalid","is",hRBP]],
                columns:
                    [
                        search.createColumn({name: "custentity_swc_job_num", label: "Authing员工id"}),
                        search.createColumn({name: "internalid", label: "内部 ID"})
                    ]
            });
            employeeSearchObj.run().each(function(result) {
                empId = result.getValue({name: "internalid"});
                return true;
            });
            return empId;
        }

        /**
         * 查询所有子公司
         */
        function searchAllSubsidiary() {
            var subsidiaryIdArr = [];
            var subsidiarySearchObj = search.create({
                type: "subsidiary",
                filters: [],
                columns: [search.createColumn({name: "internalid", label: "内部 ID"})]
            });
            subsidiarySearchObj.run().each(function(result) {
                subsidiaryIdArr.push(result.getValue({name: "internalid"}));
                return true;
            });
            return subsidiaryIdArr;
        }

        /**
         * pingCAP salesforce 根据客户编码查询客户ID
         * @param code  客户编码
         */
        function srchCustomerIdByCode(code) {
            var customerId = "";
            var customerSearchObj = search.create({
                type: "customer",
                filters:
                    [
                        ["isinactive","is","F"],
                        "AND",
                        ["custentity_swc_customer_code","is",code]
                    ],
                columns:
                    [
                        search.createColumn({name: "entityid", sort: search.Sort.ASC, label: "ID"}),
                        search.createColumn({name: "altname", label: "名称"}),
                        search.createColumn({name: "internalid", label: "内部 ID"})
                    ]
            });

            customerSearchObj.run().each(function(result){
                customerId = result.getValue({name: "internalid", label: "内部 ID"});
                return true;
            });
            return customerId;
        }

        /**
         * pingCAP salesforce 根据salesforce子公司 查询Salesforce公司映射表 的 NS 子公司id
         * @param name  SALESFORCE收入主体名称
         */
        function srchSubsidiaryIdByName(name) {
            log.audit("srchSubsidiaryIdByName-name",name);
            var id = "";
            var customrecord_swc_sf_sub_mappingSearchObj = search.create({
                type: "customrecord_swc_sf_sub_mapping",
                filters:
                    [
                        ["custrecord_salesforce_sub","is",name]
                    ],
                columns:
                    [
                        search.createColumn({name: "scriptid", sort: search.Sort.ASC, label: "脚本 ID"}),
                        search.createColumn({name: "custrecord_salesforce_sub", label: "Salesforce收入主体名称"}),
                        search.createColumn({name: "custrecord_ns_sub", label: "NS 子公司名称"})
                    ]
            });

            customrecord_swc_sf_sub_mappingSearchObj.run().each(function(result){
                id = result.getValue({name: "custrecord_ns_sub", label: "NS 子公司名称"});
                return true;
            });
            return id;
        }

        /**
         * pingCAP salesforce 查询Salesforce公司映射表 的 NS 子公司id
         *
         */
        function srchMappingSubsidiary() {
            var subsidiaryArr = [];
            var customrecord_swc_sf_sub_mappingSearchObj = search.create({
                type: "customrecord_swc_sf_sub_mapping",
                filters:
                    [
                    ],
                columns:
                    [
                        search.createColumn({name: "scriptid", sort: search.Sort.ASC, label: "脚本 ID"}),
                        search.createColumn({name: "custrecord_salesforce_sub", label: "Salesforce收入主体名称"}),
                        search.createColumn({name: "custrecord_ns_sub", label: "NS 子公司名称"})
                    ]
            });

            customrecord_swc_sf_sub_mappingSearchObj.run().each(function(result){
                var nsName = result.getText({name: "custrecord_ns_sub", label: "NS 子公司名称"});
                var salesforceName = result.getValue({name: "custrecord_salesforce_sub", label: "Salesforce收入主体名称"});
                var subsidiaryJson =  {};
                subsidiaryJson.nsName = nsName || "";
                subsidiaryJson.salesforceName = salesforceName || "";
                subsidiaryArr.push(subsidiaryJson);
                return true;
            });
            return subsidiaryArr;
        }

        /**
         * pingCAP salesforce 根据AccountId查询日记账内部ID
         * @param accountId  ACCOUNTID
         * @return id 内部id
         */
        function srchJournalIdByAccountId(accountId) {
            if(!accountId)return "";
            var id = "";
            var journalentrySearchObj = search.create({
                type: "journalentry",
                filters:
                    [
                        ["type","anyof","Journal"],
                        "AND",
                        ["custbody_swc_accountid","is",accountId]
                    ],
                columns:
                    [
                        search.createColumn({name: "internalid", label: "内部 ID"})
                    ]
            });

            journalentrySearchObj.run().each(function(result){
                id = result.getValue({name: "internalid", label: "内部 ID"});
                return true;
            });
            return id;
        }

        /**
         * pingCAP salesforce 根据AccountId查询销售订单内部ID
         * @param accountId  ACCOUNTID
         * @return id 内部id
         */
        function srchSoIdByAccountId(accountId) {
            if(!accountId)return "";
            var id = "";
            var salesorderSearchObj = search.create({
                type: "salesorder",
                filters:
                    [
                        ["type","anyof","SalesOrd"],
                        "AND",
                        ["taxline","is","F"],
                        "AND",
                        ["mainline","is","F"],
                        "AND",
                        ["custbody_swc_accountid","is",accountId]
                    ],
                columns:
                    [
                        search.createColumn({name: "internalid", label: "内部 ID"})
                    ]
            });

            salesorderSearchObj.run().each(function(result){
                id = result.getValue({name: "internalid", label: "内部 ID"});
                return true;
            });
            return id;
        }

        /**
         * pingCAP salesforce 根据AccountId查询批量发票内部ID
         * @param accountId  ACCOUNTID
         * @return ids id数组
         */
        function srchInvoiceIdByAccountId(accountId) {
            if(!accountId)return [];
            var ids = [];
            var invoiceSearchObj = search.create({
                type: "invoice",
                filters:
                    [
                        ["type","anyof","CustInvc"],
                        "AND",
                        ["taxline","is","F"],
                        "AND",
                        ["mainline","is","F"],
                        "AND",
                        ["custbody_swc_accountid","is",accountId]
                    ],
                columns:
                    [
                        search.createColumn({name: "internalid", label: "内部 ID"})
                    ]
            });
            invoiceSearchObj.run().each(function(result){
                var id = result.getValue({name: "internalid", label: "内部 ID"});
                if(id)ids.push(id);
            });
            return ids;
        }

        /**
         * pingCAP salesforce 根据OrderNumber查询销售订单内部ID
         * @param orderNumber  采购订单号
         * @return id 内部id
         */
        function srchSoIdByOrderNumber(orderNumber) {
            if(!orderNumber)return "";
            var id = "";
            var salesorderSearchObj = search.create({
                type: "salesorder",
                filters:
                    [
                        ["type","anyof","SalesOrd"],
                        "AND",
                        ["taxline","is","F"],
                        "AND",
                        ["mainline","is","F"],
                        "AND",
                        ["otherrefnum","equalto",orderNumber]
                    ],
                columns:
                    [
                        search.createColumn({name: "internalid", label: "内部 ID"})
                    ]
            });

            salesorderSearchObj.run().each(function(result){
                id = result.getValue({name: "internalid", label: "内部 ID"});
                return true;
            });
            return id;
        }

        /**
         * pingCAP salesforce 根据OrderNumber查询批量发票内部ID
         * @param orderNumber  采购订单号
         * @return ids id数组
         */
        function srchInvoiceIdByOrderNumber(orderNumber) {
            if(!orderNumber)return [];
            var ids = [];
            var invoiceSearchObj = search.create({
                type: "invoice",
                filters:
                    [
                        ["type","anyof","CustInvc"],
                        "AND",
                        ["taxline","is","F"],
                        "AND",
                        ["mainline","is","F"],
                        "AND",
                        ["otherrefnum","equalto",orderNumber]
                    ],
                columns:
                    [
                        search.createColumn({name: "internalid", label: "内部 ID"})
                    ]
            });
            invoiceSearchObj.run().each(function(result){
                var id = result.getValue({name: "internalid", label: "内部 ID"});
                if(id)ids.push(id);
            });
            return ids;
        }

        /**
         * pingCAP salesforce pingCAP salesforce 根据id查询发票的金额总和
         * @param ids  发票所有内部ID
         * @return amount 所有发票总金额
         */
        function srchInvoiceAmountById(ids) {
            if(!ids)return 0;
            var amountSum = 0;
            var invoiceSearchObj = search.create({
                type: "invoice",
                filters:
                    [
                        ["type","anyof","CustInvc"],
                        "AND",
                        ["internalid","anyof",ids],
                        "AND",
                        ["mainline","is","F"],
                        "AND",
                        ["taxline","is","F"]
                    ],
                columns:
                    [
                        search.createColumn({name: "item", label: "货品"}),
                        search.createColumn({name: "amount", label: "金额"})
                    ]
            });
            invoiceSearchObj.run().each(function(result){
                amountSum += result.getValue({name: "amount", label: "金额"})|| 0;
            });
            return amountSum;
        }

        /**
         * 取得【金蝶云星空科目映射表】数据
         * @return {Object} {"金蝶科目编码": {"nsAcctCode": "NS科目编码", "bankTypeFlag": "true代表银行类科目", "interType": "公司间类型（客户/供应商）"}, ...}
         */
        function schKingdeeAcct() {
            var kingdeeAcctSchObj = search.create({
                type: "customrecord_swc_kingdee_account",
                filters:
                    [
                        ["isinactive","is","F"]
                    ],
                columns:
                    [
                        search.createColumn({name: "custrecord_kingdee_accountcode", label: "金蝶科目编码"}),
                        search.createColumn({name: "custrecord_ns_accountcode", label: "NS科目编码"}),
                        search.createColumn({name: "custrecord_banktype_flag", label: "银行类科目编码标识"}),
                        search.createColumn({name: "custrecord_inter_type", label: "公司间类型"})
                    ]
            });

            var kingdeeAcctObj = {};
            var kingdeeAcctSchRs = getAllResults(kingdeeAcctSchObj);
            for (var i = 0; i < kingdeeAcctSchRs.length; i++) {
                var kingdeeAcctCode = kingdeeAcctSchRs[i].getValue({name: "custrecord_kingdee_accountcode"});
                var nsAcctCode = kingdeeAcctSchRs[i].getValue({name: "custrecord_ns_accountcode"});
                var bankTypeFlag = kingdeeAcctSchRs[i].getValue({name: "custrecord_banktype_flag"});
                var interType = kingdeeAcctSchRs[i].getValue({name: "custrecord_inter_type"});

                kingdeeAcctObj[kingdeeAcctCode] = {nsAcctCode: nsAcctCode, bankTypeFlag: bankTypeFlag, interType: interType};
            }

            return kingdeeAcctObj;
        }

        /**
         * 检索科目，取得NS科目编号及科目ID
         * @return {Object} {"NS科目编号": "科目ID"}
         */
        function schNsAcctCode2Id() {
            var acctSchObj = search.create({
                type: "account",
                filters:
                    [
                        ["isinactive","is","F"],
                        "AND",
                        ["number","isnotempty",""]
                    ],
                columns:
                    [
                        search.createColumn({name: "number", label: "编号"}),
                        search.createColumn({name: "internalid", label: "内部 ID"})
                    ]
            });

            var nsAcctCode2IdObj = {};
            var acctSchRs = getAllResults(acctSchObj);
            for (var i = 0; i < acctSchRs.length; i++) {
                var number = acctSchRs[i].getValue({name: "number"});
                var intlId = acctSchRs[i].getValue({name: "internalid"});

                nsAcctCode2IdObj[number] = intlId;
            }

            return nsAcctCode2IdObj;
        }

        /**
         * 取得【金蝶云星空货币映射表】数据
         * @return {Object} {"金蝶货币编码": "NS货币", ...}
         */
        function schKingdeeCurrency() {
            var kingdeeCurrencySchObj = search.create({
                type: "customrecord_swc_kingdee_currcy",
                filters:
                    [
                        ["isinactive","is","F"]
                    ],
                columns:
                    [
                        search.createColumn({name: "custrecord_currency_code", label: "金蝶货币编码"}),
                        search.createColumn({name: "custrecord_ns_currency_code", label: "NS货币"})
                    ]
            });

            var kingdeeCurrencyObj = {};
            var kingdeeCurrencySchRs = getAllResults(kingdeeCurrencySchObj);
            for (var i = 0; i < kingdeeCurrencySchRs.length; i++) {
                var currencyCode = kingdeeCurrencySchRs[i].getValue({name: "custrecord_currency_code"});
                var nsCurrencyCode = kingdeeCurrencySchRs[i].getValue({name: "custrecord_ns_currency_code"});

                kingdeeCurrencyObj[currencyCode] = nsCurrencyCode;
            }

            return kingdeeCurrencyObj;
        }

        /**
         * 检索金碟凭证
         * @param {Object} options
         * @param {String} options.person 执行人
         * @param {String} options.date 执行时间
         * @param {string} options.voucher 凭证编号
         * @param {string} options.subsidiary 子公司
         * @return {boolean} {"intlId": "内部标识", "journalentryCode": "日记账编码"}
         */
        function schKingdeeVoucher(options) {
            var customrecord_kingdee_voucherSearchObj = search.create({
                type: "customrecord_kingdee_voucher",
                filters:
                    [
                        ["isinactive","is","F"],
                        "AND",
                        ["custrecord_kv_person","anyof", options.person.toString()],
                        "AND",
                        ["custrecord_kv_date","is", options.date],
                        "AND",
                        ["custrecord_kv_billno","is", options.voucher],
                        "AND",
                        ["custrecord_kv_subsidiary","anyof", options.subsidiary]
                    ],
                columns:
                    [
                        search.createColumn({name: "internalid", label: "内部标识"}),
                        search.createColumn({name: "custrecord_kv_journalentrycode", label: "日记账编码"})
                    ]
            });
            var searchResultCount = customrecord_kingdee_voucherSearchObj.runPaged().count;

            var kingdeeVoucher = null;
            if (searchResultCount > 0) {
                customrecord_kingdee_voucherSearchObj.run().each(function(result) {
                    kingdeeVoucher = {};
                    kingdeeVoucher["intlId"] = result.getValue({name: "internalid", label: "内部标识"});
                    kingdeeVoucher["journalentryCode"] = result.getValue({
                        name: "custrecord_kv_journalentrycode", label: "日记账编码"
                    });
                    return false;
                });
            }

            return kingdeeVoucher;
        }

        /**
         * 根据金碟云星空公司编码取得NS子公司内部ID
         * @param {Array} kingdeeSubCode 金蝶云星空子公司编码
         * @return {Object} {"金蝶云星空编码": "子公司内部ID", ...}
         */
        function schSubsidiaryBykingdeeSubCode(kingdeeSubCode) {
            var filters = [["isinactive","is","F"]];
            var subCodeFilters = [];
            kingdeeSubCode.forEach(function (value, index) {
                if (index != 0) {
                    subCodeFilters.push("OR");
                }
                subCodeFilters.push(["custrecord_swc_code","is", value]);
            });
            if (subCodeFilters.length) {
                filters.push("AND", subCodeFilters);
            }
            var subsidiarySearchObj = search.create({
                type: "subsidiary",
                filters: filters,
                columns:
                    [
                        search.createColumn({name: "internalid", label: "内部 ID"}),
                        search.createColumn({name: "custrecord_swc_code", label: "云星空编码"})
                    ]
            });
            var searchResultCount = subsidiarySearchObj.runPaged().count;

            var subsidiaryObj = {};
            if (searchResultCount > 0) {
                subsidiarySearchObj.run().each(function(result){
                    code = result.getValue({name: "custrecord_swc_code", label: "云星空编码"});
                    nsSubIntlId = result.getValue({name: "internalid", label: "内部 ID"});

                    subsidiaryObj[code] = nsSubIntlId;
                    return true;
                });
            }

            return subsidiaryObj;
        }

        /**
         * 获取金蝶云星空SS请求参数
         * @param {Object} options
         * @param {String} options.startStr 开始日期 yyyy-MM-dd
         * @param {String} options.endStr 结束日期 yyyy-MM-dd
         * @param {Object} options.customReqCond 自定义请求条件
         * @param {array} options.customReqCond.subsidiary 子公司
         * @param {string} options.customReqCond.person 执行人
         * @param {string} options.customReqCond.exeDate 执行时间
         * @param {number} options.curPage 当前页面（默认从0开始）
         * @param {number} options.PAGE_SIZE 单次接口允许请求数据条数
         * @param {Object} options.voucherCount 凭证明细条数
         * @return {Object} {"reqData": "请求接口参数", "logicData": "业务数据，用于分接口拉取同一张单据数据时合并数据"}
         */
        function getKingdeeSSReqParam(options) {
            var startStr = options.startStr;
            var endStr = options.endStr;
            var customReqCond = options.customReqCond;
            var curPage = options.curPage;
            var PAGE_SIZE = options.PAGE_SIZE;
            var voucherCount = options.voucherCount;

            // 过滤条件："FPostDate>='' and FPostDate<='' and (FACCBOOKORGID = 100232 or...)"
            var filterString = "";
            // 拼接检索时间检索条件
            filterString += ("FPostDate >= '" + startStr + "' and FPostDate <= '" + endStr + "'");
            filterString += " and (";
            // 拼接子公司检索条件
            var subsidiary = customReqCond ? customReqCond.subsidiary : [];
            subsidiary.forEach(function (value, index) {
                if (index != 0) {
                    filterString += " or ";
                }
                filterString += ("FACCBOOKORGID = " + value);
            });
            filterString += ")";
            // FPERIOD（期间）
            if (customReqCond && customReqCond.fPeriod) {
                filterString += " and FPERIOD = " + customReqCond.fPeriod;
            }
            // FYEAR（年）
            if (customReqCond && customReqCond.fYear) {
                filterString += " and FYEAR = " + customReqCond.fYear;
            }
            // 拉取备注不等于【结转本期损益】的凭证
            filterString += " and FEXPLANATION != '结转本期损益' ";
            // 执行人
            var person = customReqCond ? customReqCond.person : null;
            // 执行时间
            var exeDate = customReqCond ? customReqCond.exeDate : null;

            var data = {
                reqData: {
                    parameters: [{
                        "FormId": "GL_VOUCHER",
                        "FieldKeys": "FBILLNO, FACCBOOKORGID, FCURRENCYID.fnumber, FPostDate, FEXPLANATION, FACCOUNTID.FNUMBER, FDC, FDEBIT, FCREDIT, FDate, FDetailID.FFLEX11.fnumber, FVOUCHERGROUPNO, FDetailID.FFlex4.FNAME, FDetailID.FFlex6.FNAME, FDetailID.FF100005.fnumber, FDetailID.FFlex5.fnumber, FDetailID.FFlex5.FNAME, FEXCHANGERATE, FDetailID.FF100003.fnumber",
                        "FilterString": filterString,
                        "OrderString": "FVOUCHERGROUPNO",
                        "TopRowCount": 0,
                        "StartRow": curPage * PAGE_SIZE, // 计算当前数据开始索引位置（第一次请求接口：0 * PAGE_SIZE）
                        "Limit": PAGE_SIZE,
                        "SubSystemId": ""
                    }]
                },
                logicData: {
                    exeDate: exeDate,
                    person: person,
                    subsidiary: subsidiary,
                    voucherCount: voucherCount,
                    year: customReqCond.fYear,
                    month: customReqCond.fPeriod
                }
            }

            return data;
        }

        /**
         * 检索金蝶云星空编码不为空的公司数据
         * @return {array} [{"subsidiaryCode": "金蝶云星空编码", "subsidiaryName": "NS子公司名称"}, ...]
         */
        function schKingdeeCodeExist() {
            var subsidiarySearchObj = search.create({
                type: "subsidiary",
                filters:
                    [
                        ["isinactive","is","F"],
                        "AND",
                        ["custrecord_swc_code","isnotempty",""]
                    ],
                columns:
                    [
                        search.createColumn({name: "custrecord_swc_code", label: "云星空编码"}),
                        search.createColumn({name: "namenohierarchy", label: "名称（无层次结构）"})
                    ]
            });

            var results = getAllResults(subsidiarySearchObj);
            var kingdeeCodeAry = [];
            results.forEach(function (value) {
                kingdeeCodeAry.push({
                    subsidiaryCode: value.getValue({name: "custrecord_swc_code", label: "云星空编码"}),
                    subsidiaryName: value.getValue({name: "namenohierarchy", label: "名称（无层次结构）"})
                });
            });

            return kingdeeCodeAry;
        }
        function checkImageName(options)
        {
            if(!options.output)
            {
                options.checkImageName = {"success" : false,"message" : "图片信息为null"};
                return;
            }
            var imageJson;
            if(typeof options.output == "object")
            {
                imageJson = options.output;
            }
            if(typeof options.output == "string")
            {
                imageJson = JSON.parse(options.output);
            }
            var imageNames = "";
            var imageName = "";
            var isJPG = true;
            if(!imageJson.name)
            {
                options.checkImageName = {"success" : false,"message" : "图片name为null"};
                return;
            }
            if(imageJson.name.indexOf(".jpg") < 0)
            {
                isJPG = false;
            }
            if(imageJson.name.indexOf("C:\\Program Files\\CMB\\FbSdk\\Receipt\\") > 0)
            {
                imageName = imageJson.name.split("C:\\Program Files\\CMB\\FbSdk\\Receipt\\");
                imageNames = imageName[1].split("_");
            }else{
                imageNames = imageJson.name.split("_");
            }
            /**
             * 图片名称构成
             * 账号_起始日期-结束日期_回单实例号_流水号.jpg
             * 账号_起始日期-结束日期_回单实例号_流水号.pdf
             * 账号_起始日期-结束日期_回单实例号_流水号_业务参考号.jpg
             * 账号_起始日期-结束日期_回单实例号_流水号_业务参考号.pdf
             */
            if(imageNames.length < 5)//少于5表示末尾为流水号，大于5表示末尾为业务参考号
            {
                if(isJPG)
                {
                    options.logExternalId = imageNames[imageNames.length-1].split(".jpg")[0];//流水号 流水号是《账户交易流水》的外部ID
                }else{
                    options.logExternalId = imageNames[imageNames.length-1].split(".pdf")[0];//流水号 流水号是《账户交易流水》的外部ID
                }
            }else{
                if(isJPG)
                {
                    options.logExternalId = imageNames[3].split(".jpg")[0];//流水号 流水号是《账户交易流水》的外部ID
                    options.paymentExternalId = imageNames[imageNames.length-1].split(".jpg")[0];//业务参考号 《银企直联支付记录》外部ID
                }else{
                    options.logExternalId = imageNames[3].split(".pdf")[0];//流水号 流水号是《账户交易流水》的外部ID
                    options.paymentExternalId = imageNames[imageNames.length-1].split(".pdf")[0];//业务参考号 《银企直联支付记录》外部ID
                }
            }
        }

        /**
         * pingCAP 飞书 根据采购申请单的飞书instance_code查询采购申请单id
         * @param instanceCode  飞书instance_code
         * @return id 采购申请单 内部id
         */
        function srchPoRequestIdByInstanceCode(instanceCode) {
            if(!instanceCode)return "";
            var id = "";
            var customrecord_swc_purchase_requestSearchObj = search.create({
                type: "customrecord_swc_purchase_request",
                filters:
                    [
                        ["custrecord_pr_instance_code","is",instanceCode]
                    ],
                columns:
                    [
                        search.createColumn({name: "internalid", label: "内部 ID"})
                    ]
            });

            customrecord_swc_purchase_requestSearchObj.run().each(function(result){
                id = result.getValue({name: "internalid", label: "内部 ID"});
                return true;
            });
            return id;
        }

        /**
         * pingCAP 飞书 根据供应商账单申请单的飞书instance_code查询供应商账单申请单id
         * @param instanceCode  飞书instance_code
         * @return id 供应商账单申请单 内部id
         */
        function srchVenderPayableRequestIdByInstanceCode(instanceCode) {
            if(!instanceCode)return "";
            var id = "";
            var customrecord_swc_account_payableSearchObj = search.create({
                type: "customrecord_swc_account_payable",
                filters:
                    [
                        ["custrecord_ap_instance_code","is",instanceCode]
                    ],
                columns:
                    [
                        search.createColumn({name: "internalid", label: "内部 ID"})
                    ]
            });

            customrecord_swc_account_payableSearchObj.run().each(function(result){
                id = result.getValue({name: "internalid", label: "内部 ID"});
                return true;
            });
            return id;
        }

        /**
         * pingCAP 飞书 根据采购订单id查询采购订单编号
         * @param id  采购订单id
         * @return code 采购订单编号
         */
        function srchPoIdByPoCode(id) {
            if(!id)return "";
            var code = "";
            var purchaseorderSearchObj = search.create({
                type: "purchaseorder",
                filters:
                    [
                        ["type","anyof","PurchOrd"],
                        "AND",
                        ["internalid","anyof",id],
                        "AND",
                        ["mainline","is","T"]
                    ],
                columns:
                    [
                        search.createColumn({name: "tranid", label: "文档编号"})
                    ]
            });

            purchaseorderSearchObj.run().each(function(result){
                code = result.getValue({name: "tranid", label: "文档编号"});
                return true;
            });
            return code;
        }

        /**
         * 根据银行账户、公司检索银行类科目（业务上只存在一条）
         * @param {Object} options
         * @param {string} options.bankAcct 银行账户
         * @param {string} options.subsidiary 子公司
         * @return {string} 银行类科目内部ID
         */
        function schBankAcctIntlId(options) {
            var bankAcct = options.bankAcct;
            var subsidiary = options.subsidiary;

            if (!bankAcct || !subsidiary) return "";

            var accountSearchObj = search.create({
                type: "account",
                filters:
                    [
                        ["isinactive","is","F"],
                        "AND",
                        ["custrecord_swc_dbtbbk","anyof", bankAcct],
                        "AND",
                        ["subsidiary","anyof", subsidiary]
                    ],
                columns:
                    [
                        search.createColumn({name: "internalid", label: "内部 ID"})
                    ]
            });
            var searchResultCount = accountSearchObj.runPaged().count;

            var bankAcctId = "";
            if (searchResultCount > 0) {
                accountSearchObj.run().each(function(result){
                    bankAcctId = result.getValue({name: "internalid"});
                    return false;
                });
            }

            return bankAcctId;
        }

        /**
         * 检索金碟银行账号、NS公司不为空的科目
         * @return {Object} {"子公司_关联银行科目": "科目", ...}
         */
        function schBankAcct() {
            var accountSearchObj = search.create({
                type: "account",
                filters:
                    [
                        ["isinactive","is","F"],
                        "AND",
                        ["custrecord_swc_dbtbbk","noneof","@NONE@"],
                        "AND",
                        ["subsidiary","noneof","@NONE@"]
                    ],
                columns:
                    [
                        search.createColumn({name: "internalid", label: "内部 ID"}),
                        search.createColumn({name: "custrecord_swc_dbtbbk", label: "关联银行账户"}),
                        search.createColumn({name: "subsidiary", label: "子公司"})
                    ]
            });

            var result = getAllResults(accountSearchObj);

            var bankAcctObj = {};
            for (var i = 0; i < result.length; i++) {
                var bankAcct = result[i].getText({name: "custrecord_swc_dbtbbk", label: "关联银行账户"});
                var acctIntlId = result[i].getValue({name: "internalid", label: "内部 ID"});
                var subsidiary = result[i].getValue({name: "subsidiary", label: "子公司"});

                bankAcctObj[subsidiary + "_" + bankAcct] = acctIntlId;
            }

            return bankAcctObj;
        }

        /**
         * pingCAP salesforce 查询所有飞书员工ID不为空的员工名称
         *
         */
        function srchEmployeeName(userIdArr) {
            var acctNumAry = [];
            userIdArr.forEach(function (value, index) {
                if (index != 0) {
                    acctNumAry.push("OR")
                }
                acctNumAry.push(["custentity_swc_feishu_userid","is", value]);
            });

            var filters = [];
            if (acctNumAry && acctNumAry.length) {
                filters.push(acctNumAry);
            }
            var employeeSearchObj = search.create({
                type: "employee",
                filters:
                    [
                        filters
                    ],
                columns:
                    [
                        search.createColumn({name: "entityid", sort: search.Sort.ASC, label: "名称"}),
                        search.createColumn({name: "custentity_swc_feishu_userid", label: "飞书员工id"}),
                        search.createColumn({name: "custentity_swc_feishu_unatived", label: "是否旧系统停用"}),
                        search.createColumn({name: "internalid", label: "内部 ID"})
                    ]
            });

            var userIdJson =  {};
            employeeSearchObj.run().each(function(result){
                var name = result.getValue({name: "entityid", sort: search.Sort.ASC, label: "名称"});
                var userId = result.getValue({name: "custentity_swc_feishu_userid", label: "飞书员工id"});
                var unatived = result.getValue({name: "custentity_swc_feishu_unatived", label: "是否旧系统停用"});
                var internalid = result.getValue({name: "internalid", label: "内部 ID"});
                var json = {};
                json["name"] = name|| "";
                json["unatived"] = unatived|| "";
                json["internalid"] = internalid|| "";
                if(userId)userIdJson[userId] = json;
                return true;
            });
            return userIdJson;
        }

        /**
         * pingCAP salesforce 查询所有飞书员工ID不为空的员工名称
         *
         */
        function srchEmployeeNameToNS(userIdArr) {

            var employeeSearchObj = search.create({
                type: "employee",
                filters:
                    [
                        ["internalid","anyof",userIdArr]
                    ],
                columns:
                    [
                        search.createColumn({name: "entityid", sort: search.Sort.ASC, label: "名称"}),
                        search.createColumn({name: "custentity_swc_feishu_userid", label: "飞书员工id"}),
                        search.createColumn({name: "custentity_swc_feishu_unatived", label: "是否旧系统停用"}),
                        search.createColumn({name: "internalid", label: "内部 ID"})
                    ]
            });

            var userIdJson =  {};
            employeeSearchObj.run().each(function(result){
                var name = result.getValue({name: "entityid", sort: search.Sort.ASC, label: "名称"});
                //var userId = result.getValue({name: "custentity_swc_feishu_userid", label: "飞书员工id"});
                var unatived = result.getValue({name: "custentity_swc_feishu_unatived", label: "是否旧系统停用"});
                var internalid = result.getValue({name: "internalid", label: "内部 ID"});
                var json = {};
                json["name"] = name|| "";
                json["unatived"] = unatived|| "";
                json["internalid"] = internalid|| "";
                if(internalid)userIdJson[internalid] = json;
                return true;
            });
            return userIdJson;
        }

        /**
         * 根据货品名称查询货品【revrec收入科目】【收入科目】字段
         * @param {string} accountJson {creditId：xxx,debitId:xxx}
         */
        function schRevrecAccountByItemName(name) {
            if (!name) return "";
            var itemSearchObj = search.create({
                type: "item",
                filters:
                    [
                        ["name","is",name]
                    ],
                columns:
                    [
                        search.createColumn({name: "custitem_swc_revrec_account", label: "revrec收入科目"}),
                        search.createColumn({name: "incomeaccount", label: "收入科目"}),
                        search.createColumn({name: "custitem_swc_revrec_jp_debit", label: "日本revrec借方科目"})

                    ]
            });
            var searchResultCount = itemSearchObj.runPaged().count;
            var accountJson = {};
            if (searchResultCount > 0) {
                itemSearchObj.run().each(function(result){
                    var creditId = result.getValue({name: "custitem_swc_revrec_account", label: "revrec收入科目"});
                    accountJson["creditId"] = creditId;
                    var debitId = result.getValue({name: "incomeaccount", label: "收入科目"});
                    accountJson["debitId"] = debitId;
                    var jpDebit = result.getValue({name: "custitem_swc_revrec_jp_debit", label: "日本revrec借方科目"});
                    accountJson["jpDebit"] = jpDebit;
                    return false;
                });
            }

            return accountJson;
        }

        /**
         * 根据销售订单id查询发票数量总和
         * @param {string} id 销售单id
         */
        function schInvoiceSumNumBySoId(id) {
            if (!id) return "";
            var invoiceSearchObj = search.create({
                type: "invoice",
                filters:
                    [
                        ["type","anyof","CustInvc"],
                        "AND",
                        ["mainline","is","F"],
                        "AND",
                        ["createdfrom.internalid","anyof",id],
                        "AND",
                        ["taxline","is","F"],
                        "AND",
                        ["cogs","is","F"],
                        "AND",
                        ["shipping","is","F"]
                    ],
                columns:
                    [
                        search.createColumn({name: "quantity", summary: "SUM", label: "数量"})
                    ]
            });
            var searchResultCount = invoiceSearchObj.runPaged().count;
            var sumNum = "";
            if (searchResultCount > 0) {
                invoiceSearchObj.run().each(function(result){
                    sumNum = result.getValue({name: "quantity", summary: "SUM", label: "数量"});
                    return false;
                });
            }

            return sumNum;
        }

        /**
         * 根据采购订单id查询【采购相关文件】的文件
         * @param {string} id 采购订单id
         */
        function schFloderIdByPoId(id) {
            if (!id) return "";
            var resArr = [];//文件数组
            var customrecord_swc_po_floderSearchObj = search.create({
                type: "customrecord_swc_po_floder",
                filters:
                    [
                        ["custrecord_folder_po","anyof",id]
                    ],
                columns:
                    [
                        search.createColumn({name: "internalid", label: "内部 ID"}),
                        search.createColumn({name: "custrecord_folder_one", label: "文件"})
                    ]
            });
            var searchResultCount = customrecord_swc_po_floderSearchObj.runPaged().count;
            var floderId = "";
            if (searchResultCount > 0) {
                customrecord_swc_po_floderSearchObj.run().each(function(result){
                    floderId = result.getValue({name: "custrecord_folder_one", label: "文件"});
                    if(floderId)resArr.push(floderId);
                    return true;
                });
            }

            return resArr;
        }

        /**
         * 根据供应商ID查询【供应商银行信息】记录
         * @param {string} vendorId 供应商id
         */
        function schVenBankInfoByVendorId(vendorId) {
            if (!vendorId) return "";
            var customrecord_swc_ven_bankinfoSearchObj = search.create({
                type: "customrecord_swc_ven_bankinfo",
                filters:
                    [
                        ["custrecord_swc_vendor","anyof",vendorId]
                    ],
                columns:
                    [
                        search.createColumn({name: "custrecord_swc_vendor_bankname", label: "Vendor Bank Name"}),
                        search.createColumn({name: "custrecord_swc_vendor_accountname", label: "Bank account Name"}),
                        search.createColumn({name: "custrecord_swc_vendor_account", label: "Bank Account No."}),
                        search.createColumn({name: "custrecord_swc_swiftcode", label: "Swift Code"}),
                        search.createColumn({name: "custrecord_swc_routing_transit", label: "Routing & Transit No."}),
                        search.createColumn({name: "custrecord_swc_bank_country", label: "Bank Country"}),
                        search.createColumn({name: "custrecord_swc_bank_province", label: "开户行省份/州"}),
                        search.createColumn({name: "internalid", label: "内部 ID"})
                    ]
            });
            var searchResultCount = customrecord_swc_ven_bankinfoSearchObj.runPaged().count;
            var venJson = {};
            if (searchResultCount > 0) {
                customrecord_swc_ven_bankinfoSearchObj.run().each(function(result){
                    var vendor_bankname = result.getValue({name: "custrecord_swc_vendor_bankname", label: "Vendor Bank Name"});
                    venJson["vendor_bankname"] = vendor_bankname;
                    var vendor_accountname = result.getValue({name: "custrecord_swc_vendor_accountname", label: "Bank account Name"});
                    venJson["vendor_accountname"] = vendor_accountname;
                    var vendor_account = result.getValue({name: "custrecord_swc_vendor_account", label: "Bank Account No."});
                    venJson["vendor_account"] = vendor_account;
                    var swiftcode = result.getValue({name: "custrecord_swc_swiftcode", label: "Swift Code"});
                    venJson["swiftcode"] = swiftcode;
                    var routing_transit = result.getValue({name: "custrecord_swc_routing_transit", label: "Routing & Transit No."});
                    venJson["routing_transit"] = routing_transit;
                    var bank_country = result.getValue({name: "custrecord_swc_bank_country", label: "Bank Country"});
                    venJson["bank_country"] = bank_country;
                    var bank_province = result.getValue({name: "custrecord_swc_bank_province", label: "开户行省份/州"});
                    venJson["bank_province"] = bank_province;
                    var internalid = result.getValue({name: "internalid", label: "内部 ID"});
                    venJson["internalid"] = internalid;

                    return false;
                });
            }else {
                return "";
            }

            return venJson;
        }

        /**
         *  zcg 获取ns采购申请行的采购订单id数组
         * @param prIdArr
         */
        function nsSearchPo(prIdArr) {
            var poIdArr = [];
            var customrecord_swc_purchase_requestSearchObj = search.create({
                type: "customrecord_swc_purchase_request",
                filters: [["internalid","anyof",prIdArr]],
                columns: [search.createColumn({name: "custrecord_prs_ponum", join: "CUSTRECORD_PRS_FIELD", label: "采购订单单号"})]
            });
            customrecord_swc_purchase_requestSearchObj.run().each(function(result) {
                var poId = result.getValue({name: "custrecord_prs_ponum", join: "CUSTRECORD_PRS_FIELD"});
                if(poId && poIdArr.indexOf(poId) < 0) {
                    poIdArr.push(poId);
                }
                return true;
            });
            return poIdArr;
        }

        /**
         * 查询Salesforce税码映射表
         */
        function schTaxMapping() {
            var customrecord_swc_sf_tax_mappingSearchObj = search.create({
                type: "customrecord_swc_sf_tax_mapping",
                filters:
                    [
                    ],
                columns:
                    [
                        search.createColumn({name: "custrecord_salesforce_tax", label: "税率"}),
                        search.createColumn({name: "custrecord_sf_sub", label: "子公司名称"}),
                        search.createColumn({name: "custrecord_ns_account", label: "税项科目"})
                    ]
            });
            var searchResultCount = customrecord_swc_sf_tax_mappingSearchObj.runPaged().count;
            var taxJson = {};
            if (searchResultCount > 0) {
                customrecord_swc_sf_tax_mappingSearchObj.run().each(function(result){
                    var tax = result.getValue({name: "custrecord_salesforce_tax", label: "税率"});
                    var subsidiary = result.getValue({name: "custrecord_sf_sub", label: "子公司名称"});
                    var account = result.getValue({name: "custrecord_ns_account", label: "税项科目"});
                    taxJson[Number(tax)+"_"+subsidiary] = account || "";
                    return true;
                });
            }else {
                return "";
            }

            return taxJson;
        }

        /**
         * 检索项目（日记账）
         */
        function schProjectJournal() {
            var customrecord_cseg_swc_proSearchObj = search.create({
                type: "customrecord_cseg_swc_pro",
                filters:
                    [
                        ["isinactive","is","F"]
                    ],
                columns:
                    [
                        search.createColumn({
                            name: "name",
                            sort: search.Sort.ASC,
                            label: "名称"
                        }),
                        search.createColumn({name: "internalid", label: "内部 ID"})
                    ]
            });
            var count = customrecord_cseg_swc_proSearchObj.runPaged().count;
            var projectJournal = {};
            if (count > 0) {
                customrecord_cseg_swc_proSearchObj.run().each(function(result){
                    var name = result.getValue({
                        name: "name",
                        sort: search.Sort.ASC,
                        label: "名称"
                    });
                    var id = result.getValue({name: "internalid", label: "内部 ID"});
                    // X0000 N/A => X0000
                    projectJournal[name.split(" ")[0]] = id;
                    return true;
                });
            }

            return projectJournal;
        }

        /**
         * pingCAP 根据货品名称查询货品【财务核算产品】字段
         * @param itemName  货品名称
         * @return financialProduct 财务核算产品
         */
        function srchItemIdByItemName(itemName) {
            if(!itemName)return "";
            var financialProduct = "";
            var itemSearchObj = search.create({
                type: "item",
                filters:
                    [
                        ["name","is",itemName]
                    ],
                columns:
                    [
                        search.createColumn({name: "custitem_swc_financial_product", label: "财务核算产品"})
                    ]
            });
            itemSearchObj.run().each(function(result){
                financialProduct = result.getValue({name: "custitem_swc_financial_product", label: "财务核算产品"});
                return true;
            });
            return financialProduct;
        }

        /**
         * 检索【金蝶组织机构编码 (自定义)】不为空的子公司主数据
         * @return {Object} {"金蝶组织机构编码": "子公司内部 ID", ...}
         */
        function srchSubsidiaryByKdCodeNotEmpty() {
            var subsidiarySearchObj = search.create({
                type: "subsidiary",
                filters:
                    [
                        ["custrecord_swc_organ_code","isnotempty",""],
                        "AND",
                        ["isinactive","is","F"]
                    ],
                columns:
                    [
                        search.createColumn({name: "internalid", label: "内部 ID"}),
                        search.createColumn({name: "custrecord_swc_organ_code", label: "金蝶组织机构编码"})
                    ]
            });

            var results = getAllResults(subsidiarySearchObj);

            var subsidiary = {};
            results.forEach(function (value) {
                var intlId = value.getValue({name: "internalid", label: "内部 ID"});
                var organCode = value.getValue({name: "custrecord_swc_organ_code", label: "金蝶组织机构编码"});

                subsidiary[organCode] = intlId;
            });

            return subsidiary;
        }

        /**
         * 查询【税码】下的数据
         * @return {Object} {"subsidiary":{"子公司1":10%,...} ,"subsidiaryId":{10%:内部ID1,...}}
         */
        function srchSubsidiaryBySalesTax() {
            var salestaxitemSearchObj = search.create({
                type: "salestaxitem",
                filters:
                    [
                    ],
                columns:
                    [
                        search.createColumn({name: "subsidiary", label: "子公司"}),
                        search.createColumn({name: "rate", label: "税率"}),
                        search.createColumn({name: "internalid", label: "内部 ID"})
                    ]
            });

            var results = getAllResults(salestaxitemSearchObj);

            var subsidiaryJson = {};
            var subsidiaryRateIdJson = {};
            results.forEach(function (value) {
                var rate = value.getValue({name: "rate", label: "税率"});
                var subsidiaryId = value.getValue({name: "subsidiary", label: "子公司"});
                var id = value.getValue({name: "internalid", label: "内部 ID"});
                if(rate && rate !="0.00%"){
                    rate = rate.replace(".00%","%");
                    if(subsidiaryJson[subsidiaryId]){
                        subsidiaryJson[subsidiaryId].push(rate);
                    }else {
                        var arr = [];
                        arr.push(rate);
                        subsidiaryJson[subsidiaryId] = arr;
                    }
                    if(!subsidiaryRateIdJson[rate]){
                        subsidiaryRateIdJson[rate] = id;
                    }
                }
            });
            var json = {};
            json["subsidiary"] = subsidiaryJson;
            json["subsidiaryId"] = subsidiaryRateIdJson;
            return json;
        }


        /**
         * 查询【税码】下的【税码对应币种】和【税率】
         * @return {Object}
         */
        function srchTaxCodeAndCurr() {
            var salestaxitemSearchObj = search.create({
                type: "salestaxitem",
                filters:
                    [
                    ],
                columns:
                    [
                        search.createColumn({name: "subsidiary", label: "子公司"}),
                        search.createColumn({name: "rate", label: "税率"}),
                        search.createColumn({name: "internalid", label: "内部 ID"}),
                        search.createColumn({name: "custrecord_swc_taxcode_curr", label: "税码对应币种"})
                    ]
            });

            var results = getAllResults(salestaxitemSearchObj);

            var json = {};
            results.forEach(function (value) {
                var rate = value.getValue({name: "rate", label: "税率"});
                var subsidiaryId = value.getValue({name: "subsidiary", label: "子公司"});
                var taxcode_curr = value.getValue({name: "custrecord_swc_taxcode_curr", label: "税码对应币种"});
                var id = value.getValue({name: "internalid", label: "内部 ID"});
                if(rate && rate !="0.00%" && taxcode_curr){
                    rate = rate.replace(".00%","%");
                    json[rate+"_"+taxcode_curr] = id;
                }
            });
            return json;
        }

        /**
         * HC新增：日本子公司查询【税码】下的【税码对应币种】和【税率】-修改账单审批飞书回传匹配税码（1476）
         * @return {Object}
         */
        function srchTaxCodeAndCurrJPY(subsidiaryId) {

            var salestaxitemSearchObj = search.create({
                type: "salestaxitem",
                filters:  [
                    ['isinactive', 'is', 'F'],
                    'and',
                    ['subsidiary', 'anyof', subsidiaryId],
                    'and',
                    ['custrecord_hp_feishu_tax_code', 'is', 'T']
                ],
                columns:
                    [
                        search.createColumn({name: "internalid", label: "内部 ID", sort: 'ASC'}),
                        search.createColumn({name: "subsidiary", label: "子公司"}),
                        search.createColumn({name: "rate", label: "税率"}),
                        search.createColumn({name: "custrecord_swc_taxcode_curr", label: "税码对应币种"})
                    ]
            });

            var results = getAllResults(salestaxitemSearchObj);

            var json = {};
            results.forEach(function (value) {
                var rate = value.getValue({name: "rate", label: "税率"});
                var subsidiaryId = value.getValue({name: "subsidiary", label: "子公司"});
                var taxcode_curr = value.getValue({name: "custrecord_swc_taxcode_curr", label: "税码对应币种"});
                var id = value.getValue({name: "internalid", label: "内部 ID"});

                if(rate && rate !="0.00%" && taxcode_curr){
                    rate = rate.replace(".00%","%");
                    if(subsidiaryId && 9 == subsidiaryId && !json[rate+"_"+taxcode_curr]){
                        json[rate+"_"+taxcode_curr] = id;
                    }
                }
            });
            log.debug('json', json)
            return json;
        }

        /**
         * 查询子公司下的所有币种
         */
        function srchSubsidiaryCurrency() {
            var subsidiarySearchObj = search.create({
                type: "subsidiary",
                filters:
                    [
                    ],
                columns:
                    [
                        search.createColumn({name: "internalid", label: "内部 ID"}),
                        search.createColumn({name: "currency", label: "货币"})
                    ]
            });

            var results = getAllResults(subsidiarySearchObj);

            var subsidiary = {};
            results.forEach(function (value) {
                var intlId = value.getValue({name: "internalid", label: "内部 ID"});
                var organCode = value.getValue({name: "currency", label: "货币"});

                subsidiary[intlId] = organCode;
            });

            return subsidiary;
        }

        /**
         * 查询相关日记账为空的费用报告ID
         */
        function srchExreportIDsByjournalIsNull() {
            var expensereportSearchObj = search.create({
                type: "expensereport",
                filters:
                    [
                        ["custbody_createdfrom_expensify","contains","https://www.expensify.com"],
                        "AND",
                        ["type","anyof","ExpRept"],
                        "AND",
                        ["mainline","is","T"],
                        "AND",
                        ["taxline","is","F"],
                        "AND",
                        ["custbody_swc_related_journal","anyof","@NONE@"]//,
                        //"AND",
                        //["datecreated","notonorbefore","09/12/2023 11:59 下午"]
                    ],
                columns:
                    [
                        search.createColumn({name: "internalid", label: "内部 ID"})
                    ]
            });

            var results = getAllResults(expensereportSearchObj);

            var ids = [];
            results.forEach(function (value) {
                var intlId = value.getValue({name: "internalid", label: "内部 ID"});
                if(intlId)ids.push(intlId);
            });

            return ids;
        }

        /**
         * 根据【费用报告内部ID】查询【费用报告】
         */
        function srchExreportById(id) {
            var expensereportSearchObj = search.create({
                type: "expensereport",
                filters:
                    [
                        ["custbody_createdfrom_expensify","contains","https://www.expensify.com"],
                        "AND",
                        ["type","anyof","ExpRept"],
                        "AND",
                        ["mainline","is","F"],
                        "AND",
                        ["internalid","anyof",id],
                        "AND",
                        ["taxline","is","F"]
                    ],
                columns:
                    [
                        search.createColumn({name: "internalid", label: "内部 ID"}),
                        search.createColumn({name: "transactionnumber", label: "事务处理编号"}),
                        search.createColumn({name: "mainname", label: "主行名称"}),
                        search.createColumn({name: "trandate", label: "日期"}),
                        search.createColumn({name: "datecreated", label: "创建日期"}),
                        search.createColumn({name: "currency", label: "货币"}),
                        search.createColumn({name: "line", label: "行 Id"}),
                        search.createColumn({name: "expensecategory", label: "费用类别"}),
                        search.createColumn({name: "amount", label: "金额"}),
                        search.createColumn({name: "taxamount", label: "金额（税）"}),
                        search.createColumn({name: "memo", label: "备注"}),
                        search.createColumn({name: "custcol_expense_url", label: "Receipt URL"}),
                        search.createColumn({name: "department", label: "部门"}),
                        search.createColumn({name: "custcol_swc_cost_centerid", label: "COST CENTER"}),
                        search.createColumn({name: "taxcode", label: "税项"}),
                        search.createColumn({name: "subsidiarynohierarchy", label: "子公司（无层次结构）"}),
                        search.createColumn({name: "custbody_createdfrom_expensify", label: "Created From"}),
                        search.createColumn({name: "country", join: "subsidiary", label: "国家/地区"}),
                        search.createColumn({name: "custrecord_swc_pro", join: "department", label: "项目"})
                    ]
            });
            var results = getAllResults(expensereportSearchObj);
            return results;
        }

        /**
         * 查询费用类别
         * 格式：{"name1":"账户1",...}
         */
        function srchExpenseCategory() {
            var expensecategorySearchObj = search.create({
                type: "expensecategory",
                filters:
                    [
                    ],
                columns:
                    [
                        search.createColumn({name: "internalid", label: "内部 ID"}),
                        search.createColumn({name: "name", sort: search.Sort.ASC, label: "名称"}),
                        search.createColumn({name: "account", label: "账户"})
                    ]
            });
            var results = getAllResults(expensecategorySearchObj);
            var expenseCategoryJson = {};
            results.forEach(function (value) {
                var name = value.getValue({name: "name", sort: search.Sort.ASC, label: "名称"});
                var account = value.getValue({name: "account", label: "账户"});
                if(name && account)expenseCategoryJson[name] = account;
            });

            return expenseCategoryJson;
        }

        /**
         * 查询【部门】项目
         * 格式：{"部门内部ID1":"项目1",...}
         */
        function srchDepartmentSwcprp() {
            var departmentSearchObj = search.create({
                type: "department",
                filters:
                    [
                    ],
                columns:
                    [
                        search.createColumn({name: "internalid", label: "内部 ID"}),
                        search.createColumn({name: "custrecord_swc_pro", label: "项目"})
                    ]
            });
            var results = getAllResults(departmentSearchObj);
            var departmentJson = {};
            results.forEach(function (value) {
                var id = value.getValue({name: "internalid", label: "内部 ID"});
                var swcpro = value.getValue({name: "custrecord_swc_pro", label: "项目"});
                if(id && swcpro)departmentJson[id] = swcpro;
            });

            return departmentJson;
        }

        /**
         * 根据【子公司id】查询子公司下的【国家】
         */
        function srchSubsidiaryCountryById(id) {
            if(!id)return "";
            var country = "";
            var subsidiarySearchObj = search.create({
                type: "subsidiary",
                filters:
                    [
                        ["internalid","anyof",id]
                    ],
                columns:
                    [
                        search.createColumn({name: "country", label: "国家/地区"})
                    ]
            });
            // var results = getAllResults(subsidiarySearchObj);
            // results.forEach(function (value) {
            //     var country = value.getValue({name: "country", label: "国家/地区"});
            //     if(country)return country;
            // });
            var searchResultCount = subsidiarySearchObj.runPaged().count;

            if (searchResultCount > 0) {
                subsidiarySearchObj.run().each(function(result){
                    country = result.getValue({name: "country", label: "国家/地区"});
                    return false;
                });
            }

            return country;
        }

        /**
         * 根据【子公司id】查询【费用报销公司】的【税项科目】
         */
        function srchAccountExpenseById(id) {
            if(!id)return "";
            var account = "";
            var customrecord_swc_expense_sublistSearchObj = search.create({
                type: "customrecord_swc_expense_sublist",
                filters:
                    [
                        ["custrecord_expense_subname","anyof",id]
                    ],
                columns:
                    [
                        search.createColumn({name: "custrecord_expense_tax_account", label: "税项科目"})
                    ]
            });
            var searchResultCount = customrecord_swc_expense_sublistSearchObj.runPaged().count;

            if (searchResultCount > 0) {
                customrecord_swc_expense_sublistSearchObj.run().each(function(result){
                    account = result.getValue({name: "custrecord_expense_tax_account", label: "税项科目"});
                    return false;
                });
            }

            return account;
        }

        /**
         * 根据部门id查询部门类型存入JSON
         */
        function srchDepartmentTypeById() {
            var departmentSearchObj = search.create({
                type: "department",
                filters:
                    [
                    ],
                columns:
                    [
                        search.createColumn({name: "custrecord_swc_department_type", label: "部门类型"}),
                        search.createColumn({name: "internalid", label: "内部 ID"})
                    ]
            });
            var results = getAllResults(departmentSearchObj);
            var departmentJson = {};
            results.forEach(function (value) {
                var id = value.getValue({name: "internalid", label: "内部 ID"});
                var departmentType = value.getText({name: "custrecord_swc_department_type", label: "部门类型"});
                if(id && departmentType)departmentJson[id] = departmentType;
            });

            return departmentJson;
        }

        /**
         * 根据货品名称和部门类型查询服务类货品下的科目存入JSON
         */
        function srchAccountFromItem() {
            var serviceitemSearchObj = search.create({
                type: "serviceitem",
                filters:
                    [
                        ["type","anyof","Service"]
                    ],
                columns:
                    [
                        search.createColumn({name: "itemid", sort: search.Sort.ASC, label: "名称"}),
                        search.createColumn({name: "expenseaccount", label: "费用/销货成本科目"}),
                        search.createColumn({name: "custitem_swc_department_type", label: "部门类型"})
                    ]
            });
            var results = getAllResults(serviceitemSearchObj);
            var itemAccountJson = {};
            results.forEach(function (value) {
                var itemName = value.getValue({name: "itemid", sort: search.Sort.ASC, label: "名称"});
                var departmentType = value.getText({name: "custitem_swc_department_type", label: "部门类型"});
                var expenseaccount = value.getValue({name: "expenseaccount", label: "费用/销货成本科目"});
                if(itemName && departmentType && expenseaccount)itemAccountJson[itemName+departmentType] = expenseaccount;
            });

            return itemAccountJson;
        }

        /**
         * 查询【部门】 Cost Center ID + Name (自定义)
         * 格式：{"部门内部ID1":"Cost Center ID + Name (自定义)1",...}
         */
        function srchDepartmentCostcenterid() {
            var departmentSearchObj = search.create({
                type: "department",
                filters:
                    [
                    ],
                columns:
                    [
                        search.createColumn({name: "internalid", label: "内部 ID"}),
                        search.createColumn({name: "custrecord_swc_costcenterid", label: "Cost Center ID + Name"})
                    ]
            });
            var results = getAllResults(departmentSearchObj);
            var departmentJson = {};
            results.forEach(function (value) {
                var id = value.getValue({name: "internalid", label: "内部 ID"});
                var costcenterid = value.getValue({name: "custrecord_swc_costcenterid", label: "Cost Center ID + Name"});
                if(id && costcenterid)departmentJson[id] = costcenterid;
            });

            return departmentJson;
        }


        /**
         * 查询【采购申请审批】通过内部ID
         */
        function sechPrWfToNs(id) {
            if(!id)return "";
            var customrecord_swc_pr_wfSearchObj = search.create({
                type: "customrecord_swc_pr_wf",
                filters:
                    [
                        ["internalid","anyof",id]
                    ],
                columns:
                    [
                        search.createColumn({name: "custrecord_prwf_status", label: "审批状态"}),
                        search.createColumn({name: "custrecord_prwf_approver", label: "审批人"}),
                        search.createColumn({name: "custrecord_prwf_buyer", label: "提交人"})
                    ]
            });

            var results = getAllResults(customrecord_swc_pr_wfSearchObj);
            var json = {};
            results.forEach(function (value) {
                var status = value.getValue({name: "custrecord_prwf_status", label: "审批状态"});
                var approver = value.getValue({name: "custrecord_prwf_approver", label: "审批人"});
                var buyer = value.getValue({name: "custrecord_prwf_buyer", label: "提交人"});
                json["status"] = status?status:"";
                json["approver"] = approver?approver:"";
                json["buyer"] = buyer?buyer:"";
            });

            return json;
        }

        /**
         * 检索部门映射（金蝶云星空cost center mapping）
         * @return {Object} {"金蝶部门编码": "NS部门", ...}
         */
        function srchCostCenterMapping() {
            var srchObj = search.create({
                type: "customrecord_swc_keydee_costcenter_map",
                filters:
                    [
                        ["isinactive","is","F"]
                    ],
                columns:
                    [
                        search.createColumn({name: "custrecord_kd_costid", label: "金蝶部门编码"}),
                        search.createColumn({name: "custrecord_ns_costid", label: "NS部门"})
                    ]
            });

            var results = getAllResults(srchObj);

            var costCenterMappingObj = {};
            results.forEach(function (value) {
                // 金蝶部门编码
                var custrecord_kd_costid = value.getValue({name: "custrecord_kd_costid"});
                // NS部门
                var custrecord_ns_costid = value.getValue({name: "custrecord_ns_costid"});

                costCenterMappingObj[custrecord_kd_costid] = custrecord_ns_costid;
            });

            return costCenterMappingObj;
        }
        
        /**
         * 查询【采购付款审批】通过内部ID
         */
        function sechApWfToNs(id) {
            if(!id)return "";
            var customrecord_swc_ap_wfSearchObj = search.create({
                type: "customrecord_swc_ap_wf",
                filters:
                    [
                        ["internalid","anyof",id]
                    ],
                columns:
                    [
                        search.createColumn({name: "custrecord_apwf_approver", label: "审批人"}),
                        search.createColumn({name: "custrecord_apwf_line_status", label: "审批状态"}),
                        search.createColumn({name: "custrecord_apwf_buyer", label: "提交人"}),
                        search.createColumn({name: "custrecord_apwf_actul_paytime", label: "付款日期"}),
                        search.createColumn({name: "custrecord_apwf_taxcode", label: "税码"})
                    ]
            });

            var results = getAllResults(customrecord_swc_ap_wfSearchObj);
            var json = {};
            results.forEach(function (value) {
                var status = value.getValue({name: "custrecord_apwf_line_status", label: "审批状态"});
                var approver = value.getValue({name: "custrecord_apwf_approver", label: "审批人"});
                var buyer = value.getValue({name: "custrecord_apwf_buyer", label: "提交人"});
                var paytime = value.getValue({name: "custrecord_apwf_actul_paytime", label: "付款日期"});
                var taxcode = value.getValue({name: "custrecord_apwf_taxcode", label: "税码"});
                json["status"] = status?status:"";
                json["approver"] = approver?approver:"";
                json["buyer"] = buyer?buyer:"";
                json["paytime"] = paytime?paytime:"";
                json["taxcode"] = taxcode?taxcode:"";

            });

            return json;
        }

        /**
         * 查询自定义record（customrecord_swc_feishu_update_pending）
         */
        function sechFeishuUpdatePending() {
            var customrecord_swc_feishu_update_pendingSearchObj = search.create({
                type: "customrecord_swc_feishu_update_pending",
                filters:
                    [
                    ],
                columns:
                    [
                        search.createColumn({name: "custrecord_feishu_update_instance", label: "instance code"}),
                        search.createColumn({name: "custrecord_feishu_update_status", label: "状态"}),
                        search.createColumn({name: "custrecord_feishu_update_approval", label: "审批人"}),
                        search.createColumn({name: "custrecord_feishu_update_tax", label: "税码"}),
                        search.createColumn({name: "custrecord_feishu_update_paytime", label: "付款时间"})
                    ]
            });

            var results = getAllResults(customrecord_swc_feishu_update_pendingSearchObj);
            var resJson = {};
            results.forEach(function (value) {
                var json = {};
                var instanceCode = value.getValue({name: "custrecord_feishu_update_instance", label: "instance code"});
                var status = value.getValue({name: "custrecord_feishu_update_status", label: "状态"});
                var approver = value.getValue({name: "custrecord_feishu_update_approval", label: "审批人"});
                var taxcode = value.getValue({name: "custrecord_feishu_update_tax", label: "税码"});
                var paytime = value.getValue({name: "custrecord_feishu_update_paytime", label: "付款时间"});

                json["status"] = status?status:"";
                json["approver"] = approver?approver:"";
                json["paytime"] = paytime?paytime:"";
                json["taxcode"] = taxcode?taxcode:"";
                if(instanceCode)resJson[instanceCode] = json;
            });

            return resJson;
        }

        /**
         * 查询科目映射关系
         */
        function sechRevrectidbMapping() {
            var accountSearchObj = search.create({
                type: "account",
                filters:
                    [
                        ["custrecord_swc_revrec_tidb_mapping","isnotempty",""]
                    ],
                columns:
                    [
                        search.createColumn({name: "custrecord_swc_revrec_tidb_mapping", label: "Revrec TiDB 收入映射"}),
                        search.createColumn({name: "internalid", label: "内部 ID"})
                    ]
            });

            var results = getAllResults(accountSearchObj);
            var resJson = {};
            results.forEach(function (value) {
                var accountName = value.getValue({name: "custrecord_swc_revrec_tidb_mapping", label: "Revrec TiDB 收入映射"});
                var accountId = value.getValue({name: "internalid", label: "内部 ID"});

                if(accountName && accountId)resJson[accountName] = accountId;
            });

            return resJson;
        }

        /**
         * 查询【税码】下的数据 和日本税计算逻辑 (自定义)字段
         * @return {Object}
         */
        function srchJptaxAndRate() {
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
            var json = {};
            results.forEach(function (value) {
                var rate = value.getValue({name: "rate", label: "税率"});
                var jptax = value.getValue({name: "custrecord_swc_jptax_formula", label: "日本税计算逻辑"});
                var id = value.getValue({name: "internalid", label: "内部 ID"});
                //20240710删除税率为0的条件
                //if(rate && rate !="0.00%"){
                    rate = Number(rate.replace(".00%",""));
                    json[id] = {"rate":rate,"jptax":jptax?Number(jptax):""};
               // }
            });
            return json;
        }

        /**
         *
         * @param 根据费用类别名称查询id
         */
        function srchExpenseCategoryIdByName(name) {
            if(!name)return "";
            var id = "";
            var expensecategorySearchObj = search.create({
                type: "expensecategory",
                filters:
                    [
                        ["name","is",name]
                    ],
                columns:
                    [
                        search.createColumn({name: "internalid", label: "内部 ID"})
                    ]
            });
            expensecategorySearchObj.run().each(function(result) {
                id = result.getValue({name: "internalid"});
                return true;
            });
            return id;
        }

        /**
         *
         * @param 根据【Cost Center ID + Name (自定义)】查询部门id
         */
        function srchDeptIdByName(name) {
            if(!name)return "";
            var id = "";
            var departmentSearchObj = search.create({
                type: "department",
                filters:
                    [
                        ["custrecord_swc_costcenterid","is",name]
                    ],
                columns:
                    [
                        search.createColumn({name: "internalid", label: "内部 ID"})
                    ]
            });

            departmentSearchObj.run().each(function(result) {
                id = result.getValue({name: "internalid"});
                return true;
            });
            return id;
        }

        /**
         *
         * @param 根据科目编号查询科目id
         */
        function srchAccountIdByCode(code) {
            if(!code)return "";
            var id = "";
            var accountSearchObj = search.create({
                type: "account",
                filters:
                    [
                        ["number","is",code]
                    ],
                columns:
                    [
                        search.createColumn({name: "internalid", label: "内部 ID"})
                    ]
            });

            accountSearchObj.run().each(function(result) {
                id = result.getValue({name: "internalid"});
                return true;
            });
            return id;
        }

        //根据员工名称和autingid查询员工id
        function searchIdByNameAndAutingId(name,empId) {
            if (!name) return "";
            var filters =  [
                ["firstname","is",name]
            ];
            if(empId){
                filters.push("AND");
                filters.push(["internalid","noneof",empId]);
            }
            var employeeSearchObj = search.create({
                type: "employee",
                filters:filters,
                columns:
                    [
                        search.createColumn({name: "internalid", label: "内部 ID"})
                    ]
            });

            var id = "";
            employeeSearchObj.run().each(function (result) {
                id = result.getValue({name: "internalid", label: "内部 ID"});
                return true;
            });
            return id;

        }

        return {
            emportPrintTemplate : emportPrintTemplate
            ,encodeConvent : encodeConvent
            ,dataStrMd5 : dataStrMd5
            ,getAllResults : getAllResults
            ,chanedItemCode : chanedItemCode
            ,searchByExternalIds : searchByExternalIds
            ,searchByExternalId : searchByExternalId
            ,calcPrice : calcPrice
            ,setFieldsValues : setFieldsValues
            ,getResultJson : getResultJson
            ,currencyMaping : currencyMaping
            ,formatDate : formatDate
            ,chanedCustomerName : chanedCustomerName
            ,getItemStocks : getItemStocks
            ,checkEmployee : checkEmployee
            ,searchByNameColumn : searchByNameColumn
            ,buildNameFilters : buildNameFilters
            ,searchSoWithPlatformCodeAndSOcode:searchSoWithPlatformCodeAndSOcode
            ,checkPurchaseOrder : checkPurchaseOrder
            ,checkItems : checkItems
            ,checkWorkOrder : checkWorkOrder
            ,checkTransaction : checkTransaction
            ,checkItemInventoryDetails : checkItemInventoryDetails
            ,getItemCodeArray : getItemCodeArray
            ,searchCustomerLocation : searchCustomerLocation
            ,signIt : signIt
            ,searchInventoryDetails : searchInventoryDetails
            ,searchTransaction : searchTransaction
            ,checkSalesOrd : checkSalesOrd
            ,sendEmail : sendEmail
            ,checkItemShip : checkItemShip
            ,srchEmpByAuthingid : srchEmpByAuthingid // zcg pingCAP 根据authing 员工userid查员工
            ,srchEmpByEmail : srchEmpByEmail // zcg pingCAP 根据authing 员工邮箱查员工
            ,srchSubsidiaryByName : srchSubsidiaryByName // zcg pingCAP 根据authing 公司名称查询ns公司
            ,srchDepartmentByAuthingid : srchDepartmentByAuthingid // zcg pingCAP 根据authing 部门id查询部门
            ,srchEmpByAuthingExternalId : srchEmpByAuthingExternalId // zcg pingCAP 根据员工里authing 外部ID字段查询员工
            ,searchAllSubsidiary : searchAllSubsidiary // zcg pingCAP 查询所有子公司
            ,srchCustomerIdByCode : srchCustomerIdByCode // jjp pingCAP salesforce 根据客户编码查询客户ID
            ,srchSubsidiaryIdByName :srchSubsidiaryIdByName // jjp pingCAP salesforce 根据salesforce子公司 查询Salesforce公司映射表 的 NS 子公司id
            ,srchJournalIdByAccountId :srchJournalIdByAccountId //// jjp pingCAP salesforce 根据AccountId查询日记账内部ID
            ,srchSoIdByAccountId :srchSoIdByAccountId //根据AccountId查询销售订单内部ID
            ,srchInvoiceIdByAccountId :srchInvoiceIdByAccountId //根据AccountId查询批量发票内部ID
            ,srchInvoiceAmountById :srchInvoiceAmountById //// jjp pingCAP salesforce 根据id查询发票的金额总和
            ,schKingdeeAcct: schKingdeeAcct // 取得【金蝶云星空科目映射表】数据
            ,schNsAcctCode2Id: schNsAcctCode2Id // 检索科目，取得NS科目编号及科目ID
            ,schKingdeeCurrency: schKingdeeCurrency // 取得【金蝶云星空货币映射表】数据
            ,schKingdeeVoucher: schKingdeeVoucher // 检索金碟凭证
            ,schSubsidiaryBykingdeeSubCode: schSubsidiaryBykingdeeSubCode // 根据金碟云星空公司编码取得NS子公司内部ID
            ,srchMappingSubsidiary :srchMappingSubsidiary //jjp pingCAP salesforce 查询Salesforce公司映射表 的 NS 子公司id
            ,getKingdeeSSReqParam: getKingdeeSSReqParam// 获取金蝶云星空SS请求参数
            ,srchSoIdByOrderNumber: srchSoIdByOrderNumber //根据OrderNumber查询销售订单内部ID
            ,srchInvoiceIdByOrderNumber :srchInvoiceIdByOrderNumber //根据OrderNumber查询批量发票内部ID
            ,schKingdeeCodeExist: schKingdeeCodeExist // 检索金蝶云星空编码不为空的公司数据
            ,checkImageName: checkImageName
            ,srchPoRequestIdByInstanceCode: srchPoRequestIdByInstanceCode// jjp pingCAP 飞书 根据采购申请单的飞书instance_code查询采购申请单id
            ,srchVenderPayableRequestIdByInstanceCode: srchVenderPayableRequestIdByInstanceCode// jjp pingCAP 飞书 根据供应商账单申请单的飞书instance_code查询供应商账单申请单id
            ,srchPoIdByPoCode: srchPoIdByPoCode// jjp pingCAP 飞书 根据采购订单id查询采购订单编号
            ,schBankAcctIntlId: schBankAcctIntlId // 根据银行账户、公司检索银行类科目（业务上只存在一条）
            ,schBankAcct: schBankAcct // 检索金碟银行账号、NS公司不为空的科目
            ,srchEmployeeName: srchEmployeeName //pingCAP salesforce 查询所有飞书员工ID不为空的员工名称
            ,srchEmployeeNameToNS: srchEmployeeNameToNS //pingCAP salesforce 查询所有飞书员工ID不为空的员工名称
            ,schRevrecAccountByItemName: schRevrecAccountByItemName // jjp  根据货品名称查询货品【revrec收入科目】字段
            ,schInvoiceSumNumBySoId: schInvoiceSumNumBySoId//根据销售订单id查询发票数量总和
            ,schFloderIdByPoId: schFloderIdByPoId //根据采购订单id查询【采购相关文件】的内部ID
            ,schVenBankInfoByVendorId: schVenBankInfoByVendorId //根据供应商ID查询【供应商银行信息】记录
            ,nsSearchPo: nsSearchPo //zcg 获取ns采购申请行的采购订单id数组
            ,schTaxMapping: schTaxMapping//jjp 查询Salesforce税码映射表
            ,schProjectJournal: schProjectJournal // 检索项目（日记账）
            ,srchItemIdByItemName: srchItemIdByItemName//jjp 根据货品名称查询货品【财务核算产品】字段
            ,srchSubsidiaryByKdCodeNotEmpty: srchSubsidiaryByKdCodeNotEmpty // 检索【金蝶组织机构编码 (自定义)】不为空的子公司主数据
            ,srchSubsidiaryBySalesTax: srchSubsidiaryBySalesTax //查询【税码】下的数据
            ,srchTaxCodeAndCurr: srchTaxCodeAndCurr //查询【税码】下的【税码对应币种】和【税率】
            ,srchTaxCodeAndCurrJPY: srchTaxCodeAndCurrJPY //日本子公司查询【税码】下的【税码对应币种】和【税率】
            ,srchSubsidiaryCurrency: srchSubsidiaryCurrency //查询【子公司】下的所有币种
            ,srchExreportIDsByjournalIsNull:srchExreportIDsByjournalIsNull //查询相关日记账为空的费用报告ID
            ,srchExreportById:srchExreportById //根据【费用报告内部ID】查询【费用报告】
            ,srchExpenseCategory:srchExpenseCategory //查询费用类别
            ,srchDepartmentSwcprp:srchDepartmentSwcprp //查询部门项目
            ,srchSubsidiaryCountryById:srchSubsidiaryCountryById // 查询子公司国家
            ,srchAccountExpenseById:srchAccountExpenseById//根据【子公司id】查询【费用报销公司】的【税项科目】
            ,srchDepartmentTypeById:srchDepartmentTypeById//根据部门id查询部门类型存入JSON
            ,srchAccountFromItem:srchAccountFromItem//根据货品名称和部门类型查询服务类货品下的科目存入JSON
            ,srchDepartmentCostcenterid:srchDepartmentCostcenterid//查询【部门】 Cost Center ID + Name字段JSON
            ,sechPrWfToNs:sechPrWfToNs//查询【采购申请审批】通过内部ID
            ,srchCostCenterMapping: srchCostCenterMapping // 检索部门映射（金蝶云星空cost center mapping）
            ,sechApWfToNs:sechApWfToNs//查询【采购付款审批】通过内部ID
            ,sechFeishuUpdatePending:sechFeishuUpdatePending//查询自定义record（customrecord_swc_feishu_update_pending）
            ,sechRevrectidbMapping:sechRevrectidbMapping//查询科目映射关系
            ,srchJptaxAndRate:srchJptaxAndRate//查询【税码】下的数据 和日本税计算逻辑 (自定义)字段
            ,srchEmpIdByEmail:srchEmpIdByEmail //根据邮箱查询员工
            ,srchExpenseCategoryIdByName:srchExpenseCategoryIdByName//根据费用类别名称查询id
            ,srchDeptIdByName:srchDeptIdByName//根据【Cost Center ID + Name (自定义)】查询部门id
            ,srchAccountIdByCode:srchAccountIdByCode//根据科目编号查询科目id
            ,searchIdByNameAndAutingId:searchIdByNameAndAutingId//根据员工名称和autingid查询员工id
        };
    });
