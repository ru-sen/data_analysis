/**
 * @NApiVersion 2.0
 * @NModuleScope Public
 *
 * Version          Date            Author        Remark
 * 1.0              2025/11/24      kori          飞书接口优化（1878）
 */
var SW_START_TIME = Date.now(); // 开始运行时候的毫秒数
var TIME_ZONE_OFFSET = 8;
var MAX_RUNNING_MILLIS = 40 * 60 * 1000;// 最长运行时间（毫秒数） : 40分钟
var YIELD_REMAINING_USAGE = 2000; // 剩余2000的时候就yield
var SW_GLOBALS = {
    apps : {}, // 暂时没用到
    platforms : {},
    funcs : {},
    globals : {},
    //存放kit的相关信息 ,123:{1:"T",2:"F"}
    kitMappings : {},
    flag:false
// 存放全局变量或数据
};
define(["N/xml","N/url","N/email","N/http","N/https","N/search","N/record","N/format","N/runtime",
        "./SWC_Business_Processing.js","./Commons.js","../lib/md5.js", "./SWC_CONFIG_DATA.js", "../lib/underscore.js"],
    function(xml,url,email,http,https,search,record,format,runtime,
             BusinessProcessing,Commons,md5, SWC_CONFIG_DATA)
    {
        _.templateSettings = {
            interpolate : /\$\{(.+?)\}/g,
            evaluate : /<%([\s\S]+?)%>/g
        };
        function initApp(platformName)
        {
            // 加载全局变量
            // var vars = getMappingFromSearch("customrecord_swc_global_vars", [ "custrecord_swcgv_parent_app.name", "is", "ECommerce" ], "name", [ "custrecord_swcgv_value" ]);
            // SW_GLOBALS.globals.variables = vars || {};
            SW_GLOBALS.globals.variables = {};

            //如果val 存在，则转为日期串；否则返回当前日期串
            registerFunc("curDate", function(val){
                if(val){
                    val = toDate(val) ;
                }else{
                    val = getDate(TIME_ZONE_OFFSET);
                }

                return val && format.format({value:val,type:format.Type.DATE}) || "";
            });
            //如果val 存在，则转为日期串；否则返回空串
            registerFunc("toDate", function(val){
                if(val){
                    val = toDate(val);
                }
                return val && format.format({value:val,type:format.Type.DATE}) ||"";
            });


            registerFunc("dateToStr", function(val){
                return lastModified();
            });

            registerFunc("jsonParse", function(val){
                return JSON.parse(val);
            });


            registerFunc("changedSuccess",function(val){
                return val=="200"?true:false;
            });
            registerFunc("changedSuccess1",function(val){
                return true;
            });

            var platformJson = pluginguanyi(platformName);
            registerPlatform(platformName, platformJson);
            SW_GLOBALS.platforms[platformName] = platformJson || {};
            platformJson.flag = true;
        }
        function registerApp(appName, appData) {
            if (!appName || !appData) {
                return;
            }
            SW_GLOBALS.apps[appName] = _.isFunction(appData) ? appData() : appData;
        }

        function getApp(appName) {
            return SW_GLOBALS.apps[appName] || {};
        }

// 注册平台
        function registerPlatform(platformName, platformData) {
            if (!platformName || !platformData) {
                return;
            }

            SW_GLOBALS.platforms[platformName] = _.isFunction(platformData) ? platformData() : platformData;
        }
//获取电商平台配置信息
        function getPlatform(platformName)
        {
            initApp(platformName);
            return SW_GLOBALS.platforms[platformName] || {};
        }

// 注册function，如果key为空，则直接注册到obj.funcs 对象中；否则注册到obj[key].funcs中
        function registerFunc(funcName, func, obj, key)
        {
            if (!funcName || !func) {
                return;
            }

            if (!obj) {
                obj = SW_GLOBALS;
            }

            if (key) {
                obj = obj[key] = obj[key] || {};
            }

            obj.funcs = obj.funcs || {};
            obj.funcs[funcName] = func;
        }

// 此方法可以优化
// 获取function，obj[key].funcs 中取不到，则从obj.funcs中获取;否则从globalFunc中取
        function getFunc(funcName, obj, key)
        {
            if (!funcName) {
                return;
            }
            // 从全局取
            var func = SW_GLOBALS.funcs[funcName];
            if (obj) {
                // 从obj 取
                func = obj.funcs && obj.funcs[funcName] || func;
                if (key) {
                    obj = obj[key];
                    // 从obj 取
                    func = obj && obj.funcs && obj.funcs[funcName] || func;
                }
            }

            return func;
        }

        function getDataFunc(functionName, platform, key) {
            var app = getPlatform(platform);
            return getFunc(functionName, app, key);
        }

        function getGlobalValue(obj, type, key) {
            if (!type) {
                return;
            }
            // 如果obj 的globals 中没有值，则从全局取
            var propOfObj = _.propertyOf(obj && obj.globals);
            var propOfGlobal = _.propertyOf(SW_GLOBALS.globals);
            return key ? propOfObj([ type, key ]) || propOfGlobal([ type, key ]) : propOfObj(type) || propOfGlobal(type);
        }

// 从globals.variables取值
        function getGlobalVariable(obj, key) {
            return getGlobalValue(obj, "variables", key);
        }

// 将data放到obj中，或者放到obj[key]中
        function registerData(name, data, obj, key)
        {
            if (!name || !data || !obj) {
                return;
            }

            if (key) {
                obj = obj[key] = obj[key] || {};
            }
            obj[name] = data;
        }

// json =>url 参数 (例如a=1&b=2 )
        function toParamsStr(params) {
            var s = _.map(params, function(value, key) {
                return encodeURIComponent(key) + "=" + encodeURIComponent(value == null ? "" : value);
            });
            return s.join("&");
        }

// 添加参数到url
        function addParamsToUrl(baseUrl, params) {
            if (params && _.keys(params).length) {
                var paramString = toParamsStr(params);
                var join_string = ~baseUrl.indexOf('?') ? '&' : '?';
                baseUrl += join_string + paramString;
            }
            return baseUrl;
        }
//传递field 数组进来，这样可以按照指定的顺序来设置
//[{name:"abc",val:"123"}]
        function setFieldsValuesByAry(rec, fieldsAry, isText, allowEmptyValue)
        {
            if (!rec || !fieldsAry) {
                return;
            }
            for ( var i in fieldsAry) {
                var fldJson = fieldsAry[i];
                var fldName = fldJson.name;
                var val = fldJson.val || "";

                // 不允许空值，则不设置
                if (!allowEmptyValue && !val) {
                    continue;
                }
                if (typeof val != "string") {
                    val = JSON.stringify(val);
                }
                Commons.setFieldValue(rec,isText,fldName,val);
            }
        }

        function setCurrentLineItemValues(rec, sublistId, fieldsJson, isText, allowEmptyValue)
        {
            if (!rec || !fieldsJson || !sublistId) {
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
                setCurrentLineValue(rec,isText,sublistId,fldName,val);
            }
        }

//传递field 数组进来，这样可以按照指定的顺序来设置
//[{name:"abc",val:"123"}]
        function setCurrentLineItemValuesByAry(rec, sublistId, fieldsAry, isText, allowEmptyValue) {
            if (!rec || !fieldsAry || !sublistId) {
                return;
            }
            for ( var i in fieldsAry) {

                var fldJson = fieldsAry[i];
                var fldName = fldJson.name;
                var val = fldJson.val||"";
                // 不允许空值，则不设置
                if (!allowEmptyValue && !val) {
                    continue;
                }
                if (typeof val != "string") {
                    val = JSON.stringify(val);
                }
                setCurrentLineValue(rec,isText,sublistId,fldName,val);
            }
        }

        function setCurrentLineValue(rec,isText,sublistId,fldName,val)
        {
            if (isText) {
                rec.setCurrentSublistText({sublistId:sublistId, fieldId:fldName, text:val});
            } else {
                rec.setCurrentSublistValue({sublistId:sublistId, fieldId:fldName, value:val});
            }
        }


        /*
         * _.mixin({"nvl":function(val1,val2){ return val1 || val2 ||""; }});
         */
        function loopSublist(rec, sublistId, fldAry, callBackfuc)
        {
            if (!rec || !sublistId || !fldAry) {
                return;
            }
            var count = rec.getLineCount({sublistId:sublistId});
            for (var i = 0; i < count; i++) {
                var fldJson = {};
                _.each(fldAry, function(fldName) {
                    // 如果想获取select字段的text，则在字段id前面加上: 号，例如:custrecord_x
                    var isGetText = (fldName.charAt(0) == ":");
                    var fldName2 = isGetText ? fldName.substr(1) : fldName;
                    if (isGetText) {
                        fldJson[fldName] = rec.getSublistText({sublistId:sublistId, fieldId:fldName2, line:i});
                    } else {
                        fldJson[fldName] = rec.getSublistValue({sublistId:sublistId, fieldId:fldName2, line:i});
                    }
                });

                callBackfuc(fldJson);
            }
        }

        function getSublistMapping(rec, sublistId, fldAry, callBackfuc)
        {
            if (!rec || !sublistId || !fldAry) {
                return;
            }
            var count = rec.getLineCount({sublistId:sublistId});
            for (var i = 0; i < count; i++) {
                var fldJson = {};
                // 如果想获取select字段的text，则在字段id前面加上: 号，例如:custrecord_x
                _.each(valFldJsonAry, function(valFldJson) {
                    dataJson[valFldJson.key] = getFieldValue(rec, valFldJson);
                });
                callBackfuc(fldJson);
            }
        }

        function getPlatformConfig(platformName)
        {
            var platform = getPlatform(platformName);
            return platform && platform.config || {};
        }

        function initPlatform(platformName)
        {
            var resultJson = Commons.searchByNameColumn("customrecord_swc_platform", [ platformName ], "name");
            var platformId = resultJson && resultJson[platformName];
            if (!platformId) {
                return {};
            }
            // var platformRec = nlapiLoadRecord("customrecord_sw_platform", platformId);
            var platformRec = record.load({type:"customrecord_swc_platform", id:platformId});
            // 加载platform 信息
            var locMapping = getMapping(platformRec, "recmachcustrecord_swcml_parent_platform", "custrecord_swcml_code", [ "custrecord_swcml_loc$id", "custrecord_swcml_is_cainiao$isCainiao","custrecord_swcml_deparment$department"]);
            var discountMapping = getMapping(platformRec, "recmachcustrecord_swcdm_parent_platform", ":custrecord_swcdm_payment_method", [ "custrecord_swcdm_discount_item" ]);
            var paytypeMapping = getMapping(platformRec, "recmachcustrecord_swcpm_parent_platform", ":custrecord_swcpm_payment_method", [ "custrecord_swcpm_terms$terms","custrecord_swcpm_paymethod2$method" ]);
            var logisticsMapping = getMapping(platformRec, "recmachcustrecord_swclm_parent_platform", "custrecord_swclm_code", [ "custrecord_swclm_shipmethod$shipMethod","custrecord_swclm_account$CustomerName","custrecord_swclm_password$CustomerPwd","custrecord_swclm_monthcode$MonthCode","custrecord_swclm_shipmethod3$shipmethod3","custrecord_swclm_parent_templatesize$TemplateSize" ]);
            var CustomerMapping = getMapping(platformRec, "recmachcustrecord_swcpcm_parent_platform", "custrecord_swcpcm_platform", [ "custrecord_swcpcm_customer$id","custrecord_swcpcm_e_commerce_platform$platformId","custrecord_swcpcm_deplartment$deparmentId"]);
            var platformJson = {
                globals : { // 全局变量设置
                    LOCATION : locMapping,
                    DISCOUNT : discountMapping,
                    PAYTYPE : paytypeMapping,
                    LOGISTICS : logisticsMapping,
                    CUSTOMER : CustomerMapping
                },
                config : {
                    appKey : platformRec.getValue({fieldId:"custrecord_swcp_appkey"}),
                    sessionKey : platformRec.getValue({fieldId:"custrecord_swcp_session_key"}),
                    sessionSecret : platformRec.getValue({fieldId:"custrecord_swcp_session_secret"}),
                    subsidiary : platformRec.getValue({fieldId:"custrecord_swcp_subsidiary"}),
                    sender : platformRec.getValue({fieldId:"custrecord_swcp_email_sender"}),
                    emails : platformRec.getValue({fieldId:"custrecord_swcp_email_receipients"}), // 通知邮件的收件人email
                    pageSize : platformRec.getValue({fieldId:"custrecord_swcp_page_size"}),
                    hoursBefore : platformRec.getValue({fieldId:"custrecord_swcp_hours_before"}), // 在上一次抓取时间之前几个小时进行抓取
                    interval : platformRec.getValue({fieldId:"custrecord_swcp_interval"}), // 开始和结束时间的间隔
                    wmsEmp : platformRec.getText({fieldId:"custrecord_swcp_wms_employee"}),
                    soForm : platformRec.getValue({fieldId:"custrecord_swcp_salesorder_form"}),
                    custForm : platformRec.getValue({fieldId:"custrecord_swcp_customer_form"}),
                    returnForm : platformRec.getValue({fieldId:"custrecord_swcp_return_form"}),
                    fulfillmentForm : platformRec.getValue({fieldId:"custrecord_swcp_fulfillment_form"})
                }
            };

            // 加载API sublist (可进行 重构，与getMapping进行整合，例如对于keyfld 不存在的情况，直接返回value)
            loopSublist(platformRec, "recmachcustrecord_swca_platform", [ "name", "custrecord_swca_api_method", "custrecord_swca_headers", "custrecord_swca_url", ":custrecord_swca_http_method" ],
                function(fldJson) {
                    var name = fldJson.name;
                    var headers = fldJson["custrecord_swca_headers"];

                    var apiJson = platformJson[name] = platformJson[name] || {
                        config : {
                            method : fldJson["custrecord_swca_api_method"],// "gy.erp.vip.get",
                            headers : headers,
                            url : fldJson["custrecord_swca_url"],
                            httpMethod : fldJson[":custrecord_swca_http_method"],
                        }
                    };
                });

            initAPIInfo(platformId, platformJson);
            return platformJson;
        }

        function getMapping(rec, sublistId, keyFld, valueFlds)
        {
            if (!rec || !keyFld || !valueFlds) {
                return;
            }

            if (!_.isArray(valueFlds)) {
                valueFlds = [ valueFlds ];
            }

            var keyFldJson = getFieldJson(keyFld);

            var valFldJsonAry = _.map(valueFlds, function(valFld) {
                return getFieldJson(valFld);
            });

            var data = {};

            if (sublistId) {
                var count = rec.getLineCount({sublistId:sublistId});
                for (var i = 0; i < count; i++) {
                    addEntry(data, keyFldJson, rec, valFldJsonAry, sublistId, i);
                }
            } else {
                addEntry(data, keyFldJson, rec, valFldJsonAry);
            }

            return data;
        }

        function getMappingFromSearch(type, filters, keyFld, valueFlds)
        {
            if (!type || !keyFld || !valueFlds) {
                return;
            }

            if (!_.isArray(valueFlds)) {
                valueFlds = [ valueFlds ];
            }

            var cols = [];
            var keyFldJson = getFieldJson(keyFld);
            var keyCol = search.createColumn({name: keyFldJson.fldName});
            // 传入key column
            cols.push(keyCol);
            var valFldJsonAry = _.map(valueFlds, function(valFld) {
                // 传入value column
                var fldJson = getFieldJson(valFld);
                cols.push(search.createColumn({name: fldJson.fldName}));
                return fldJson;
            });
            var mySearch = search.create({type: type,filters:filters,columns:cols});
            var results = Commons.getAllResults(mySearch);
            var data = {};
            _.each(results, function(result) {
                addEntryFromResult(data, keyFldJson, result, valFldJsonAry);
            });

            return data;
        }

        function addEntryFromResult(data, keyFldJson, result, valFldJsonAry)
        {
            var keyVal = getFieldValueFromResult(result, keyFldJson);
            if (valFldJsonAry.length > 1)
            {
                var dataJson = data[keyVal] = {};
                _.each(valFldJsonAry, function(valFldJson) {
                    dataJson[valFldJson.key] = getFieldValueFromResult(result, valFldJson);
                });
            } else { // 如果传入的结果数组中只有一个字段，这直接作为value加入
                data[keyVal] = getFieldValueFromResult(result, valFldJsonAry[0]);
            }
        }

        function getFieldValueFromResult(result, fldJson) {
            var str = fldJson.isText ? "Text" : "Value";
            return result["get" + str]({name:fldJson.fldName});
        }

        function addEntry(data, keyFldJson, rec, valFldJsonAry, sublistId, line)
        {
            var keyVal = getFieldValue(rec, keyFldJson, sublistId, line);
            if (valFldJsonAry.length > 1) {
                var dataJson = data[keyVal] = {};
                _.each(valFldJsonAry, function(valFldJson) {
                    dataJson[valFldJson.key] = getFieldValue(rec, valFldJson, sublistId, line);
                });
            } else { // 如果传入的结果数组中只有一个字段，这直接作为value加入
                data[keyVal] = getFieldValue(rec, valFldJsonAry[0], sublistId, line);
            }
        }

        function getFieldValue(rec, fldJson, sublistId, line)
        {
            var str = fldJson.isText ? "Text" : "Value";
            if (sublistId && (line || line == 0)) {
                return rec["getSublist" + str]({sublistId:sublistId, fieldId:fldJson.fldName, line:line}) || "";
            } else {
                return rec["get" + str]({fieldId:fldJson.fldName}) || "";
            }
        }

// :custbody_abc$key
// :表示调用getText，custbody_abc为字段id ，key表示以其作为json的key
        function getFieldJson(fldStr)
        {
            var fldAry = fldStr.split("$");
            var valFldStr = fldAry[0];
            var key = fldAry[1] || valFldStr;
            var isText = (valFldStr.charAt(0) == ":");
            var fldName = isText ? valFldStr.substr(1) : valFldStr;
            var fldJson = {
                fldName : fldName.trim(),
                key : key,
                isText : isText
            };

            return fldJson;
        }

// 加载平台api 以及api 字段映射
        function initAPIInfo(platformId, platformJson)
        {
            if (!platformId || !platformJson) {
                return;
            }
            /*
             * var apiInfo = { "getCustomer":{ config: { method:"gy.erp.vip.get",
             * headers : {"Content-Type": "text/plain"},
             * url:"http://v2.api.guanyierp.com/rest/erp_open", httpMethod:"POST",
             * outConfig :{ //配置会员信息 ".":{ src:".", fieldsMapping :{ success :
             * {src:"success"} } }, "body":{ src : "vips.0", fieldsMapping :{ entityId :
             * {src:"name"}, customerKey: {src:"code"}, } } } } }};
             */
            var apiNameCol = search.createColumn({
                name: "formulatext",
                formula: "nvl({custrecord_swcafm_api_ns2api.name},{custrecord_swcafm_api_api2ns.name})"
            });
            var configCol = search.createColumn({
                name: "formulatext",
                formula:"DECODE( {custrecord_swcafm_api_ns2api.name},'','outConfig','inConfig')"
            });
            var mySearch = search.create({
                type:"customrecord_swc_api_fields_mapping",
                filters:
                    [
                        [ "custrecord_swcafm_api_ns2api.custrecord_swca_platform", "anyof", platformId ],
                        "OR",
                        [ "custrecord_swcafm_api_api2ns.custrecord_swca_platform", "anyof", platformId ]
                    ],
                columns:
                    [
                        apiNameCol, configCol,
                        search.createColumn({name: "custrecord_swcafm_src_field"}),
                        search.createColumn({name: "custrecord_swcafm_desc"}),
                        search.createColumn({name: "custrecord_swcafm_module"}),
                        search.createColumn({name: "custrecord_swcafm_target_field"}),
                        search.createColumn({name: "custrecord_swcafm_parameter"}),
                        search.createColumn({name: "custrecord_swcafm_funcname"})
                    ]
            });
            var results = Commons.getAllResults(mySearch);
            _.each(results, function(result) {
                var apiName = result.getValue(apiNameCol);
                var apiJson = platformJson[apiName];
                if (!apiJson) {
                    return;
                }
                var configJson = apiJson.config;

                var configType = result.getValue(configCol); // inConfig / outConfig

                var configTypeJson = configJson[configType] = configJson[configType] || {};

                var srcFld = result.getValue({name:"custrecord_swcafm_src_field"});
                var module = result.getValue({name:"custrecord_swcafm_module"});
                var targetFld = result.getValue({name:"custrecord_swcafm_target_field"});
                var param = result.getValue({name:"custrecord_swcafm_parameter"});
                var funcName = result.getValue({name:"custrecord_swcafm_funcname"});
                var moduleJson = configTypeJson[module] = configTypeJson[module] || {
                    fieldsMapping : {}
                };

                if (!targetFld) {
                    moduleJson.src = srcFld;
                } else {
                    var fldsMappingJson = moduleJson.fieldsMapping;
                    var fldJson = fldsMappingJson[targetFld] = {
                        src : srcFld
                    };
                    param && (fldJson.param = param);
                    funcName && (fldJson.funcName = funcName);
                }
            });

        }

// yyyyMMddhhmmss 转为日期
        function timestampToDate(str)
        {
            if (!str) {
                return new Date();
            }
            var year = str.substr(0, 4);
            var month = str.substr(4, 2) - 1;
            var day = str.substr(6, 2);
            var hours = str.substr(8, 2);
            var mins = str.substr(10, 2);
            var seconds = str.substr(12, 2);
            return new Date(year, month, day, hours, mins, seconds);

        }

// yyyy-MM-dd hh:mm:ss 转成date对象
        function toDate(str)
        {
            if (!str) {
                return new Date();
            }
            var year = str.substr(0, 4);
            var month = str.substr(5, 2) - 1;
            var day = str.substr(8, 2);
            var hours = str.substr(11, 2);
            var mins = str.substr(14, 2);
            var seconds = str.substr(17, 2);
            return new Date(year, month, day, hours, mins, seconds);
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

        function addHours(date, hours) {
            var newDate = new Date(date.getTime());
            newDate.setHours(date.getHours() + hours * 1);
            return newDate;
        }
        function to2Digits(num) {
            return (num < 10 ? "0" : "") + num;
        }

        function getElapsedMins() {
            var now = Date.now();
            return now - SW_START_TIME;
        }
        function getDate(timeZone) {
            var date = new Date();
            var utcTime = date.getTime() + date.getTimezoneOffset() * 60 * 1000;
            var tzTime = utcTime + timeZone * 60 * 60 * 1000;
            return new Date(tzTime);
        }

        /**start***********************Plugin**********************************start**/
//注册配置表对应的方法，赋予方法处理逻辑
        function pluginguanyi(platformName)
        {
            var platformJson = initPlatform(platformName);
            registerFunc("beforeRequest", beforeRequest, platformJson);
            registerFunc("afterResponse", afterResponse, platformJson);

            // zcg pingCAP authing 员工同步接口
            registerFunc("getEmployeeList_data", getEmployeeListdata, platformJson);
            registerFunc("getEmployee_data", getEmployeedata, platformJson);

            // zcg pingCAP authing 部门同步接口
            registerFunc("getDepartmentList_data", getDepartmentListdata, platformJson);
            registerFunc("getDepartment_data", getDepartmentdata, platformJson);

            // zcg pingCAP authing(new) 员工同步接口
            registerFunc("getEmployeeList_new_data", getEmployeeList_newdata, platformJson);
            registerFunc("getEmployee_new_data", getEmployee_newdata, platformJson);

            // zcg pingCAP authing(new) 部门同步接口
            registerFunc("getDepartmentList_new_data", getDepartmentList_newdata, platformJson);
            registerFunc("getDepartment_new_data", getDepartment_newdata, platformJson);

            // zcg pingCAP 飞书ID同步NS员工
            registerFunc("getEmployeeIDFeiShuList_data", getEmployeeIDFeiShuListdata, platformJson);
            registerFunc("getEmployeeIDFeiShu_data", getEmployeeIDFeiShudata, platformJson);


            // zcg pingCAP 飞书ID同步NS员工ou
            registerFunc("getEmployeeIDFeiShuOUList_data", getEmployeeIDFeiShuOUListdata, platformJson);
            registerFunc("getEmployeeIDFeiShuOU_data", getEmployeeIDFeiShuOUdata, platformJson);

            // zcg pingCAP 飞书拉取采购合同回写采购订单下
            registerFunc("getFeiShuContractId_data", getFeiShuContractIddata, platformJson);
            registerFunc("getFeiShuContractFile_data", getFeiShuContractFiledata, platformJson);


            // jjp pingCAP Salesforce 查询接口
            registerFunc("getSalesforceQueryList_data", getSalesforceQueryListdata, platformJson);
            registerFunc("getSalesforceQuery_data", getSalesforceQuerydata, platformJson);

            // jjp8 pingCAP Navan费用报销凭证
            registerFunc("getNavanVoucherList_data", getNavanVoucherListdata, platformJson);
            registerFunc("getNavanVoucher_data", getNavanVoucherdata, platformJson);

            // jjp6 pingCAP Salesforce 手动创建task 生成销售订单
            registerFunc("getSalesforceSaleOrder_data", getSalesforceSaleOrderdata, platformJson);

            // jjp2 pingCAP Salesforce 删除接口
            registerFunc("getSalesforceDeleteList_data", getSalesforceDeleteListdata, platformJson);
            registerFunc("getSalesforceDelete_data", getSalesforceDeletedata, platformJson);

            // jjp3 pingCAP Salesforce Collection-创建发票接口
            registerFunc("getSalesforceCollectionList_data", getSalesforceCollectionListdata, platformJson);
            registerFunc("getSalesforceCollection_data", getSalesforceCollectiondata, platformJson);

            // jjp5 pingCAP 飞书 采购申请|付款申请 拉取飞书审批状态
            registerFunc("fsSearchAuditStatusList_data", fsSearchAuditStatusListData, platformJson);
            registerFunc("fsSearchAuditStatus_data", fsSearchAuditStatusData, platformJson);

            // jjp5-1 pingCAP 飞书 采购申请|付款申请 拉取飞书审批状态
            registerFunc("fsSearchAuditStatusToNSList_data", fsSearchAuditStatusToNSListData, platformJson);
            registerFunc("fsSearchAuditStatusToNS_data", fsSearchAuditStatusToNSData, platformJson);

            // jjp7 pingCAP费用报销生成日记账
            registerFunc("exReportToJournalList_data", exReportToJournalListdata, platformJson);
            registerFunc("exReportToJournal_data", exReportToJournaldata, platformJson);

            // yltian PingCAP 金蝶云星空 凭证查询接口
            registerFunc("getKingdeeVoucherList_data", getKingdeeVoucherListData, platformJson);
            registerFunc("getKingdeeVoucher_data", getKingdeeVoucherData, platformJson);

            // yltian uptSalesforceCollectionListData pingCAP Salesforce Collection-更新发票接口
            registerFunc("updSalesforceCollectionList_data", updSalesforceCollectionListData, platformJson);
            registerFunc("updSalesforceCollection_data", updSalesforceCollectionData, platformJson);

            // 注册到全局对象的funcs 中
            registerFunc("BUSCODN02031SEARCH", processBUSCODN02031SEARCH);//支付业务:支付结果列表查询接口
            registerFunc("ACCOUNTDETAIS", processACCOUNTDETAIS);//账户管理:查询账户交易信息
            registerFunc("ACCOUNTREFUNDMEIMAGE", processACCOUNTREFUNDMEIMAGE);//账户管理:查询电子回单信息（保存图片）
            registerFunc("BUSCODN02031REFUNDSEARCH", processBUSCODN02031REFUNDSEARCH);//支付业务:支付退票明细查询
            registerFunc("ACCOUNTREFUNDMESSAGE", processACCOUNTREFUNDMESSAGE);//账户管理:查询电子回单信息

            // zcg pingCAP authing 员工同步接口
            registerFunc("getEmployeeList", getEmployeeList);
            registerFunc("getEmployee", getEmployee);

            // zcg pingCAP authing 部门同步接口
            registerFunc("getDepartmentList", getDepartmentList);
            registerFunc("getDepartment", getDepartment);

            // zcg pingCAP authing(new) 员工同步接口
            registerFunc("getEmployeeList_new", getEmployeeList_new);
            registerFunc("getEmployee_new", getEmployee_new);

            // zcg pingCAP authing(new) 部门同步接口
            registerFunc("getDepartmentList_new", getDepartmentList_new);
            registerFunc("getDepartment_new", getDepartmen_new);

            // zcg pingCAP 飞书ID同步NS员工
            registerFunc("getEmployeeIDFeiShuList", getEmployeeIDFeiShuList);
            registerFunc("getEmployeeIDFeiShu", getEmployeeIDFeiShu);

            // zcg pingCAP 飞书ID同步NS员工OU
            registerFunc("getEmployeeIDFeiShuOUList", getEmployeeIDFeiShuOUList);
            registerFunc("getEmployeeIDFeiShuOU", getEmployeeIDFeiShuOU);

            // zcg pingCAP 飞书拉取采购合同回写采购订单下
            registerFunc("getFeiShuContractId", getFeiShuContractId);
            registerFunc("getFeiShuContractFile", getFeiShuContractFile);

            // jjp pingCAP Salesforce 查询接口
            registerFunc("getSalesforceQueryList", getSalesforceQueryList);
            registerFunc("getSalesforceQuery", getSalesforceQuery);

            // jjp8 pingCAP Navan费用报销凭证
            registerFunc("getNavanVoucherList", getNavanVoucherList);
            registerFunc("getNavanVoucher", getNavanVoucher);

            // jjp6 pingCAP Salesforce 查询接口
            registerFunc("getSalesforceSaleOrder", getSalesforceSaleOrder);

            // jjp2 pingCAP Salesforce 删除接口
            registerFunc("getSalesforceDeleteList", getSalesforceDeleteList);
            registerFunc("getSalesforceDelete", getSalesforceDelete);

            // jjp3 pingCAP Salesforce  Collection-创建发票接口
            registerFunc("getSalesforceCollectionList", getSalesforceCollectionList);
            registerFunc("getSalesforceCollection", getSalesforceCollection);

            // jjp5 pingCAP 飞书 采购申请|付款申请 拉取飞书审批状态
            registerFunc("fsSearchAuditStatusList", fsSearchAuditStatusList);
            registerFunc("fsSearchAuditStatus", fsSearchAuditStatus);

            // jjp5-1 pingCAP 飞书 采购申请|付款申请 拉取飞书审批状态
            registerFunc("fsSearchAuditStatusToNSList", fsSearchAuditStatusToNSList);
            registerFunc("fsSearchAuditStatusToNS", fsSearchAuditStatusToNS);

            // jjp7 pingCAP费用报销生成日记账
            registerFunc("exReportToJournalList", exReportToJournalList);
            registerFunc("exReportToJournal", exReportToJournal);

            // yltian PingCAP 金蝶云星空 凭证查询接口
            registerFunc("getKingdeeVoucherList", getKingdeeVoucherList);
            registerFunc("getKingdeeVoucher", getKingdeeVoucher);

            // yltian uptSalesforceCollectionListData pingCAP Salesforce Collection-更新发票接口
            registerFunc("updSalesforceCollectionList", updSalesforceCollectionList);
            registerFunc("updSalesforceCollection", updSalesforceCollection);

            return platformJson;
        }


        /*****************************SWC_Business_Processing.js******************************************************************/
        ///////////////////////////////////API访问处理////////////////////////////////////////

        function beforeRequest(options) {
            var platformName = options.platform;
            var platformJson = initPlatform(platformName);
            var input = options.input || options.data;
            var appConfig = platformJson.config;
            // var dataStrMd5 = crypto.createHash({algorithm:crypto.HashAlg.MD5});
            var sessionkey = appConfig.sessionKey;
            var appKey = appConfig.appKey;
            var method = options.apiConfigJson.method;
            input.method = method;

            if(platformName == "KDNIAO") {
                input.MemberID = appKey;
                // dataStrMd5.update({input:JSON.stringify(input) + sessionkey});
                // dataStrMd5 = dataStrMd5.digest().toLowerCase();
                var dataSign = Commons.encodeConvent(Commons.dataStrMd5(input,sessionkey,platformName));
                var reqBody = {
                    EBusinessID:appKey,
                    DataType:2,
                    RequestData:encodeURIComponent(JSON.stringify(input)),
                    RequestType:method,
                    DataSign:encodeURIComponent(dataSign)
                };
                var reqBodyStr = url.format({domain:"a",params:reqBody});
                options.postdata = reqBodyStr.substr(2);
            }
        }

        function afterResponse(options) {
            options.output = options.bodyJson = options.bodyStr && JSON.parse(options.bodyStr);
        }





        // 解析orderList 列表
        function parseTranscationOutput(out,platformJson,platform,apiId) {
            platformJson = platformJson || getPlatform(platform);
            var apiConfigJson = platformJson[apiId] && platformJson[apiId].config;
            var mappingConfig = apiConfigJson.outConfig;
            return doMapping(out, mappingConfig, platformJson, apiId);
        }
        /*********************************************BusinessProcessing*******************************************************************/

        function requestURL(options)
        {
            var platform = options.platform;
            var userName = "";
            var userPassword = "";
            if(platform == "Authing") {
                var apiId = options.apiId;
                // 如果skipMapping 为true，则不做mapping处理，直接返回原始响应数据。
                var skipMapping = true;
                if(options.platformJson && Object.keys(options.platformJson).length>0)
                {
                    log.audit("requestURL",true);
                }
                var platformJson = options.platformJson || getPlatform(platform);
                options.platformJson = platformJson;
                var apiConfigJson = options.apiConfigJson = platformJson[apiId] && platformJson[apiId].config;
                if (!skipMapping) {
                    doInputMapping(options);
                }
                var beforeRequestFunc =getFunc("beforeRequest", platformJson, apiId);
                if (beforeRequestFunc) {
                    beforeRequestFunc(options);
                }

                var tryCount = options.tryCount || apiConfigJson.tryCount || 1;
                var platformUrl = options.url || apiConfigJson.url;
                var postdata = options.postdata || apiConfigJson.postdata;
                var headers = options.headers || apiConfigJson.headers;
                var httpMethod = options.httpMethod || apiConfigJson.httpMethod;
                var method = options.method || apiConfigJson.method;


                var tranName = options.tranName;    // 事务处理名字
                var accessToken = platformJson.config.appKey;   // accessToken
                var sessionKey = platformJson.config.sessionKey;   // sessionKey

                log.audit('tranName',tranName)
                if(tranName == 'getEmployeeList') {
                    postdata = {"options": {"pagination": {"page": options.data.curPage, "limit": options.data.pageSize}, "withCustomData": true}};
                    headers = {"Content-Type":"application/json","Authorization" : accessToken,"x-authing-userpool-id":sessionKey};

                    var platformUrl = platformUrl+method;
                    log.audit('platformUrl',platformUrl);
                    var response = tryRequestURL(platformUrl, JSON.stringify(postdata), headers, httpMethod, tryCount, platform);
                    log.audit('response',response);
                    options.bodyStr = response && response.body;
                    // log.audit('options.bodyStr',options.bodyStr)
                } else if(tranName == 'getDepartmentList') {
                    headers = {"Content-Type":"application/json","Authorization" : accessToken,"x-authing-userpool-id":sessionKey};

                    var platformUrl = platformUrl+method + "?withCustomData=true&organizationCode="+options.data.organizationCode+"&departmentId="+options.data.departmentId;
                    // log.audit('platformUrl',platformUrl);
                    var response = tryRequestURL(platformUrl,"", headers, httpMethod, tryCount, platform);
                    // log.audit('response',response);
                    options.bodyStr = response && response.body;
                }
            } else if(platform == "Authing(New)") {
                var apiId = options.apiId;
                // 如果skipMapping 为true，则不做mapping处理，直接返回原始响应数据。
                var skipMapping = true;
                if(options.platformJson && Object.keys(options.platformJson).length>0)
                {
                    log.audit("requestURL",true);
                }
                var platformJson = options.platformJson || getPlatform(platform);
                options.platformJson = platformJson;
                var apiConfigJson = options.apiConfigJson = platformJson[apiId] && platformJson[apiId].config;
                if (!skipMapping) {
                    doInputMapping(options);
                }
                var beforeRequestFunc =getFunc("beforeRequest", platformJson, apiId);
                if (beforeRequestFunc) {
                    beforeRequestFunc(options);
                }

                var tryCount = options.tryCount || apiConfigJson.tryCount || 1;
                var platformUrl = options.url || apiConfigJson.url;
                var postdata = options.postdata || apiConfigJson.postdata;
                var headers = options.headers || apiConfigJson.headers;
                var httpMethod = options.httpMethod || apiConfigJson.httpMethod;
                var method = options.method || apiConfigJson.method;


                var tranName = options.tranName;    // 事务处理名字
                var accessToken = platformJson.config.appKey;   // accessToken
                var sessionKey = platformJson.config.sessionKey;   // sessionKey

                log.audit('tranName',tranName)
                if(tranName == 'getEmployeeList_new') {
                    postdata = {"options": {"pagination": {"page": options.data.curPage, "limit": options.data.pageSize}, "withCustomData": true}};
                    headers = {"Content-Type":"application/json","Authorization" : accessToken,"x-authing-userpool-id":"65af6bc7f17f80ed81ae8768"};

                    var platformUrl = platformUrl+method;
                    log.audit('platformUrl',platformUrl);
                    var response = tryRequestURL(platformUrl, JSON.stringify(postdata), headers, httpMethod, tryCount, platform);
                    log.audit('response',response);
                    options.bodyStr = response && response.body;
                    // log.audit('options.bodyStr',options.bodyStr)
                } else if(tranName == 'getDepartmentList_new') {
                    headers = {"Content-Type":"application/json","Authorization" : accessToken,"x-authing-userpool-id":"65af6bc7f17f80ed81ae8768"};

                    var platformUrl = platformUrl+method + "?withCustomData=true&organizationCode="+options.data.organizationCode+"&departmentId="+options.data.departmentId;
                    // log.audit('platformUrl',platformUrl);
                    var response = tryRequestURL(platformUrl,"", headers, httpMethod, tryCount, platform);
                    // log.audit('response',response);
                    options.bodyStr = response && response.body;
                }
            } else if(platform == "Salesforce") {
                var apiId = options.apiId;
                // 如果skipMapping 为true，则不做mapping处理，直接返回原始响应数据。
                var skipMapping = true;
                if(options.platformJson && Object.keys(options.platformJson).length>0)
                {
                    log.audit("requestURL",true);
                }
                var platformJson = options.platformJson || getPlatform(platform);
                options.platformJson = platformJson;
                var apiConfigJson = options.apiConfigJson = platformJson[apiId] && platformJson[apiId].config;
                if (!skipMapping) {
                    doInputMapping(options);
                }
                var beforeRequestFunc =getFunc("beforeRequest", platformJson, apiId);
                if (beforeRequestFunc) {
                    beforeRequestFunc(options);
                }
                var platformUrl = options.url || apiConfigJson.url;
                var postdata = options.postdata || apiConfigJson.postdata;
                var headers = options.headers || apiConfigJson.headers;
                var httpMethod = options.httpMethod || apiConfigJson.httpMethod;
                var method = options.method || apiConfigJson.method;


                var tranName = options.tranName;    // 事务处理名字
                var accessToken = platformJson.config.appKey;   // accessToken
                var sessionKey = platformJson.config.sessionKey;   // sessionKey

                var tryCount = options.tryCount || apiConfigJson.tryCount || 1;
                var instance_url = "";
                var sfClientId = platformJson.config.sfClientId || "";
                var sfClientSecret = platformJson.config.sfClientSecret || "";
                var sfUsername = platformJson.config.sfUsername || "";
                var sfPassword = platformJson.config.sfPassword || "";
                var tokenUrl = "https://login.salesforce.com/services/oauth2/token?grant_type=password"
                    + "&client_id=" + encodeURIComponent(sfClientId)
                    + "&client_secret=" + encodeURIComponent(sfClientSecret)
                    + "&username=" + encodeURIComponent(sfUsername)
                    + "&password=" + encodeURIComponent(sfPassword);
                var tokenResponse = https.request({method:"POST",url:tokenUrl,body:"",headers:""});
                log.audit('tokenResponse',tokenResponse);
                var accessToken = "Bearer " + JSON.parse(tokenResponse.body).access_token;//获取token
                instance_url = JSON.parse(tokenResponse.body).instance_url;
                headers = {"Content-Type":"application/json","Authorization" : accessToken};
                log.audit('apiId',apiId);

                //jjp 配置URL
                if(apiId == 'getSalesforceRevrecList'){//创建日记账数据接口
                    var str = options.data.startTime;//拉取数据日期
                    var end = options.data.endTime;//拉取数据日期
                    // var startTime = str.slice(0,10).trim()+"T"+str.slice(10,19).trim();
                    // var endTime = end.slice(0,10).trim()+"T"+end.slice(10,19).trim();
                    var startTime = str.slice(0,10).trim();
                    var endTime = end.slice(0,10).trim();
                    //startTime = startTime+"%2B00:00";
                    //endTime = endTime+"%2B00:00";
                    log.audit('startTime-endTime',startTime+","+endTime);
                    //2023-01-20T00:00:00%2B00:00   2023-01-20T00:00:00%2B00:00
                    var platformUrl = instance_url+"/services/data/v56.0/query/?q=SELECT+id+,Date__c+,Product__c+,Tax__c+,Order__c+,Account__c+,Rate__c+,Status__c+,CurrencyIsoCode+,Amount__c+,Name,+CreatedDate,+TiDB_Cloud_Dedicated_Amount__c,+TiDB_Cloud_Serverless_Amount__c+,TiDB_Cloud_Support_Amount__c+,TiDB_Cloud_Shortfall_Amount__c+from+Revenue__c+Where+Date__c+>=+"+startTime+"+and+Date__c+<="+endTime+"+and+Status__c='Confirmed'";
                    var response = tryRequestURL(platformUrl,"", headers, httpMethod, tryCount, platform);

                }else if(apiId == 'getSalesforceSaleOrderList'){//创建销售订单数据接口
                    var orderId = options.id;//销售订单编号
                    var condSubsidiary = options.condSubsidiary;
                    log.audit('orderId',orderId);
                    log.audit('condSubsidiary',condSubsidiary);
                    var platformUrl = "";
                    //jjp0321+合作伙伴字段功能 start
                    if (condSubsidiary && condSubsidiary == "all") {
                        platformUrl = instance_url + "/services/data/v56.0/query/?q=SELECT+id,+Partner_Name__c,+OP_Paid_via_Marketplace__c,+Order_Number__c,+Account_ID__c,+Currency_for_Finance__c,+Net_Fees__c,+EffectiveDate,+EndDate,+Real_Booking_Date__c,+Status,+Region__c,+Product_Family__c,+Overall_End_Date__c,+Overall_Start_Date__c,+Payment_Term__c,+Term__c,+CurrencyIsoCode,+Tax__c,+Cloud_Registration_Source__c,+PingCAP_RevRec_Entity__c,+(SELECT id,name,+Product__c,+Unit_Net_Price__c,+Term_Months__c,+Product_Code__c,+Quantity__c,+Service_Start_Date__c,+Service_End_Date__c,+Net_fees__c,+Product__r.Name from Order_Products__r) +from+Order+Where+Id+='" + orderId + "'+And+Status+=+'Activated'";
                    } else {
                        platformUrl = instance_url + "/services/data/v56.0/query/?q=SELECT+id,+Partner_Name__c,+OP_Paid_via_Marketplace__c,+Order_Number__c,+Account_ID__c,+Currency_for_Finance__c,+Net_Fees__c,+EffectiveDate,+EndDate,+Real_Booking_Date__c,+Status,+Region__c,+Product_Family__c,+Overall_End_Date__c,+Overall_Start_Date__c,+Payment_Term__c,+Term__c,+CurrencyIsoCode,+Tax__c,+Cloud_Registration_Source__c,+PingCAP_RevRec_Entity__c,+(SELECT id,name,+Product__c,+Unit_Net_Price__c,+Term_Months__c,+Product_Code__c,+Quantity__c,+Service_Start_Date__c,+Service_End_Date__c,+Net_fees__c,+Product__r.Name from Order_Products__r) +from+Order+Where+Id+='" + orderId + "'+And+Status+=+'Activated'+and+PingCAP_RevRec_Entity__c+='" + condSubsidiary + "'";
                    }
                    //jjp0321+合作伙伴字段功能 end
                    var response = tryRequestURL(platformUrl, "", headers, httpMethod, tryCount, platform);
                }else if(apiId == 'getSalesforceSaleOrderList2'){//创建销售订单数据接口---给Collection接口用的
                    var orderId = options.id;//销售订单编号
                    var condSubsidiary = options.condSubsidiary;
                    log.audit('orderId',orderId);
                    log.audit('condSubsidiary',condSubsidiary);
                    var platformUrl = "";
                    //jjp0321+合作伙伴字段功能 start
                    if(condSubsidiary && condSubsidiary == "all"){
                        platformUrl = instance_url+"/services/data/v56.0/query/?q=SELECT+id,+Partner_Name__c,+Order_Number__c,+Account_ID__c,+Currency_for_Finance__c,+Net_Fees__c,+EffectiveDate,+EndDate,+Real_Booking_Date__c,+Status,+Region__c,+Product_Family__c,+Overall_End_Date__c,+Overall_Start_Date__c,+Payment_Term__c,+Term__c,+CurrencyIsoCode,+Tax__c,+Cloud_Registration_Source__c,+PingCAP_RevRec_Entity__c,+(SELECT id,name,+Product__c,+Unit_Net_Price__c,+Term_Months__c,+Product_Code__c,+Quantity__c,+Service_Start_Date__c,+Service_End_Date__c,+Net_fees__c,+Product__r.Name from Order_Products__r) +from+Order+Where+Id+='"+orderId+"'+And+Status+=+'Activated'+and+PingCAP_RevRec_Entity__c+!='PingCAP Kabushiki-Kaisha'";
                    }else {
                        platformUrl = instance_url+"/services/data/v56.0/query/?q=SELECT+id,+Partner_Name__c,+Order_Number__c,+Account_ID__c,+Currency_for_Finance__c,+Net_Fees__c,+EffectiveDate,+EndDate,+Real_Booking_Date__c,+Status,+Region__c,+Product_Family__c,+Overall_End_Date__c,+Overall_Start_Date__c,+Payment_Term__c,+Term__c,+CurrencyIsoCode,+Tax__c,+Cloud_Registration_Source__c,+PingCAP_RevRec_Entity__c,+(SELECT id,name,+Product__c,+Unit_Net_Price__c,+Term_Months__c,+Product_Code__c,+Quantity__c,+Service_Start_Date__c,+Service_End_Date__c,+Net_fees__c,+Product__r.Name from Order_Products__r) +from+Order+Where+Id+='"+orderId+"'+And+Status+=+'Activated'+and+PingCAP_RevRec_Entity__c+='"+condSubsidiary+"'";
                    }
                    //jjp0321+合作伙伴字段功能 end
                    var response = tryRequestURL(platformUrl,"", headers, httpMethod, tryCount, platform);
                }else if(apiId == 'getSalesforceAccountList'){//创建客户数据接口
                    var accountId = options.id;//客户编号
                    log.audit('accountId',accountId);
                    var platformUrl = instance_url+"/services/data/v56.0/query/?q=SELECT+id+,name,BillingAddress,+JigsawCompanyId,+Region__c+from+Account+where+Account_ID__c+=+'"+accountId+"'";
                    var response = tryRequestURL(platformUrl,"", headers, httpMethod, tryCount, platform);
                    //jjp0321+合作伙伴字段功能 start
                }else if(apiId == 'getSalesforceAccountIdList'){//根据客户id查询客户accountId接口
                    var id = options.id;
                    log.audit('id',id);
                    var platformUrl = instance_url+"/services/data/v56.0/query/?q=SELECT+id+,name+,Region__c+,Account_ID__c,BillingAddress+from+Account+where+id+=+'"+id+"'";
                    var response = tryRequestURL(platformUrl,"", headers, httpMethod, tryCount, platform);
                    //jjp0321+合作伙伴字段功能 end
                }else if(apiId == 'getSalesforceCollectionList'){//创建发票--Collections_Date__c
                    var startTime = options.data.startTime.slice(0,10);//拉取数据日期
                    var endTime = options.data.endTime.slice(0,10);//拉取数据日期
                    log.audit('getSalesforceCollectionList-startTime',startTime);
                    log.audit('getSalesforceCollectionList-endTime',endTime);
                    var platformUrl = instance_url+"/services/data/v56.0/query/?q=SELECT+id,+Name,+Order__c,+Tax_Rate__c,+CurrencyIsoCode,+Exchange_Rate__c,+Order_Number__c,From_Marketplace__c,Actual_Billing_Date__c,+Invoice_Number__c,+Collections_Amount__c,Payable_Amount__c,+CollectionsStatus__c,+Payable_Date__c,+Collections_Date__c+from+Invoice_Collection__c+where+From_Marketplace__c+!=+'N/A'+and+Collections_Date__c>="+startTime+"+and+Collections_Date__c<="+endTime;
                    var response = tryRequestURL(platformUrl,"", headers, httpMethod, tryCount, platform);
                    //20240923 通过Order__c查询发票
                }else if(apiId == 'getSalesforceCollectionByOrderIdList'){//创建发票--Order__c
                    log.audit('getSalesforceCollectionByOrderIdList-options',options);
                    var orderId = options.id;//Order__c
                    log.audit('getSalesforceCollectionByOrderIdList-orderId',orderId);
                    var platformUrl = instance_url+"/services/data/v56.0/query/?q=SELECT+Invoice_Number__c+from+Invoice_Collection__c+where+Order__c+=+'"+orderId+"'";
                    var response = tryRequestURL(platformUrl,"", headers, httpMethod, tryCount, platform);

                }else if(apiId == 'getSalesforceCollectionBillingDateList'){//创建发票--Actual_Billing_Date__c
                    var startTime = options.data.startTime.slice(0,10);//拉取数据日期
                    var endTime = options.data.endTime.slice(0,10);//拉取数据日期
                    log.audit('getSalesforceCollectionBillingDateList-startTime',startTime);
                    log.audit('getSalesforceCollectionBillingDateList-endTime',endTime);
                    var platformUrl = instance_url+"/services/data/v56.0/query/?q=SELECT+id,+Name,+Order__c,+Tax_Rate__c,+CurrencyIsoCode,+Exchange_Rate__c,+Order_Number__c,From_Marketplace__c,Actual_Billing_Date__c,+Invoice_Number__c,+Collections_Amount__c,Payable_Amount__c,+CollectionsStatus__c,+Payable_Date__c,+Collections_Date__c+from+Invoice_Collection__c+where+From_Marketplace__c+=+'N/A'+and+Actual_Billing_Date__c>="+startTime+"+and+Actual_Billing_Date__c<="+endTime;
                    var response = tryRequestURL(platformUrl,"", headers, httpMethod, tryCount, platform);

                }else if(apiId == 'getSalesforceCollectionPDFList'){//创建发票--PDF
                    var collectionNumber = options.collectionNumber;//collectionNumber
                    log.audit("tryRequestURL-collectionNumber",collectionNumber);
                    //var platformUrl = "https://pingcap--sandbox1.sandbox.my.salesforce.com/services/apexrest/getcollectionfiles";
                    var platformUrl = instance_url+"/services/apexrest/getcollectionfiles";
                    var pdfJson ={"collectionnumber":collectionNumber};
                    var response = tryRequestURL(platformUrl,JSON.stringify(pdfJson), {"Content-Type":"application/json","Authorization" : accessToken,"Accept":"*/*"}, "POST", tryCount, platform);

                }else if(apiId == 'deleteSalesforceRevrecList'){//删除日记账数据接口
                    //log.audit('options',options);
                    var str = options.data.startTime;//拉取数据日期
                    var end = options.data.endTime;//拉取数据日期
                    var startTime = str.slice(0,10).trim()+"T"+str.slice(10,19).trim();
                    var endTime = end.slice(0,10).trim()+"T"+end.slice(10,19).trim();
                    startTime = startTime+"%2B00:00";
                    endTime = endTime+"%2B00:00";
                    log.audit('startTime-endTime',startTime+","+endTime);
                    //2023-01-20T00:00:00%2B00:00   2023-01-20T00:00:00%2B00:00
                    var platformUrl = instance_url+"/services/data/v56.0/sobjects/Revenue__c/deleted?start="+startTime+"&end="+endTime;
                    var response = tryRequestURL(platformUrl,"", headers, httpMethod, tryCount, platform);

                }else if(apiId == 'deleteSalesforceSaleOrderList'){//删除销售订单数据接口
                    //log.audit('options',options);
                    var str = options.data.startTime;//拉取数据日期
                    var end = options.data.endTime;//拉取数据日期
                    var startTime = str.slice(0,10).trim()+"T"+str.slice(10,19).trim();
                    var endTime = end.slice(0,10).trim()+"T"+end.slice(10,19).trim();
                    startTime = startTime+"%2B00:00";
                    endTime = endTime+"%2B00:00";
                    log.audit('startTime-endTime',startTime+","+endTime);
                    //2023-01-20T00:00:00%2B00:00   2023-01-20T00:00:00%2B00:00
                    var platformUrl = instance_url+"/services/data/v56.0/sobjects/Order/deleted?start="+startTime+"&end="+endTime;
                    var response = tryRequestURL(platformUrl,"", headers, httpMethod, tryCount, platform);
                } else if (apiId == "updSalesforceCollection") {
                    // TODO 调用中台，转发请求，生产需要修改下面代码
                    // 测试内容设定，待删除
                    accessToken = platformJson.config.collectionAccessToken || accessToken;
                    instance_url = "https://pingcap--sandbox1.sandbox.my.salesforce.com";
                    var data = options.data;
                    var url = instance_url + "/services/data/v57.0/sobjects/Invoice_Collection__c/" + data.collId
                    var reqData = {
                        "CollectionsStatus__c": data.collStatus,
                        "Collections_Amount__c": data.collAmt,
                        "Collections_Date__c": data.collDate,
                        "Remaining_Amount__c": data.remainAmt,
                        "url": url,
                        "authorizationToken": accessToken
                    }
                    headers = {"Content-Type":"application/json","Accept":"*/*"};
                    var response = tryRequestURL(platformUrl, JSON.stringify(reqData), headers, httpMethod, tryCount, platform);
                }else if(apiId == 'getSalesforceItemList') {//查询货品名称
                    var itemId = options.id;//货品id
                    log.audit('itemId', itemId);
                    var platformUrl = instance_url + "/services/data/v56.0/query/?q=SELECT id,name from Product2 where id ='"+itemId+"'";
                    var response = tryRequestURL(platformUrl, "", headers, httpMethod, tryCount, platform);
                }
                log.audit('response',response);
                options.bodyStr = response && response.body;

            } else if(platform == "飞书") {
                var apiId = options.apiId;
                // 如果skipMapping 为true，则不做mapping处理，直接返回原始响应数据。
                var skipMapping = true;
                if(options.platformJson && Object.keys(options.platformJson).length>0)
                {
                    log.audit("requestURL",true);
                }
                var platformJson = options.platformJson || getPlatform(platform);
                options.platformJson = platformJson;
                var apiConfigJson = options.apiConfigJson = platformJson[apiId] && platformJson[apiId].config;
                if (!skipMapping) {
                    doInputMapping(options);
                }
                var beforeRequestFunc =getFunc("beforeRequest", platformJson, apiId);
                if (beforeRequestFunc) {
                    beforeRequestFunc(options);
                }

                var tryCount = options.tryCount || apiConfigJson.tryCount || 1;
                var platformUrl = options.url || apiConfigJson.url;
                var postdata = options.postdata || apiConfigJson.postdata;
                var headers = options.headers || apiConfigJson.headers;
                var httpMethod = options.httpMethod || apiConfigJson.httpMethod;
                var method = options.method || apiConfigJson.method;


                var tranName = options.tranName;    // 事务处理名字
                var accessToken = platformJson.config.appKey;   // accessToken
                var sessionKey = platformJson.config.sessionKey;   // sessionKey


                log.audit('tranName',tranName)
                if(tranName == 'getEmployeeIDFeiShuList') {
                    postdata = {
                        "emails": Object.keys(options.data.empEmailJson)
                    };
                    headers = {"Content-Type":"application/json; charset=utf-8","Authorization" : "Bearer "+accessToken};
                    log.audit('headers',headers);
                    var platformUrl = platformUrl+method+"?user_id_type=user_id";
                    log.audit('platformUrl',platformUrl);
                    var response = tryRequestURL(platformUrl, JSON.stringify(postdata), headers, httpMethod, tryCount, platform);
                    log.audit('response',response);
                    options.bodyStr = response && response.body;
                    // log.audit('options.bodyStr',options.bodyStr)
                } else if(tranName == 'getEmployeeIDFeiShuOUList') {
                    postdata = {
                        "emails": Object.keys(options.data.empEmailJson)
                    };
                    headers = {"Content-Type":"application/json; charset=utf-8","Authorization" : "Bearer "+accessToken};
                    log.audit('headers',headers);
                    var platformUrl = platformUrl+method;
                    log.audit('platformUrl',platformUrl);
                    var response = tryRequestURL(platformUrl, JSON.stringify(postdata), headers, httpMethod, tryCount, platform);
                    log.audit('response',response);
                    options.bodyStr = response && response.body;
                    // log.audit('options.bodyStr',options.bodyStr)
                } else if(tranName == 'getFeiShuContractId') {

                    var contractId = options.data.contractId; // 合同id
                    log.audit('contractId',contractId);
                    headers = {"Content-Type":"application/json; charset=utf-8","Accept": "*/*","Authorization" : "Bearer "+accessToken};
                    log.audit('headers',headers);
                    var platformUrl = platformUrl+method;
                    platformUrl = platformUrl.replace(":contract_id",contractId);
                    log.audit('platformUrl',platformUrl);
                    var response = tryRequestURL(platformUrl, "", headers, httpMethod, tryCount, platform);
                    log.audit('response',response);
                    options.bodyStr = response && response.body;
                    log.audit('options.bodyStr',options.bodyStr)
                } else if(tranName == 'getFeiShuContractFile') {
                    var fileId = options.data.fileId; // 合同id
                    var platformUrl = platformUrl+method;
                    platformUrl = platformUrl.replace(":file_id",fileId);
                    log.audit('platformUrl',platformUrl);
                    var response = https.post({
                        url:"https://console.openconnect.me/prod-api/logic/commons/transformation/binary",
                        headers:{
                            "Accept":"*/*",
                            "User-Agent":"Mozilla/5",
                            "Content-Type":"application/json"
                        },
                        body:JSON.stringify({"url":platformUrl,"accessToken":accessToken})
                    });
                    log.audit('response',response);
                    options.bodyStr = response && response.body;
                    // log.audit('options.bodyStr',options.bodyStr)
                }else if(apiId == 'getRequstAuditStatusList'){//飞书  采购申请|付款申请 审批拉取List
                    postdata = options.input || options.data;
                    var approval_code = postdata["approval_code"];
                    var startTime = postdata["instance_start_time_from"];
                    var endTime = postdata["instance_start_time_to"];
                    var pageSize = postdata["pageSize"];
                    var platformUrl = "https://open.feishu.cn/open-apis/approval/v4/instances?approval_code="+approval_code+"&start_time="+startTime+"&end_time="+endTime;
                    log.audit("tryRequestURL-FSgetRequstAuditStatusList-postdata",postdata);
                    var response = tryRequestURL(platformUrl,"", {"Authorization" : "Bearer "+accessToken}, "GET", tryCount, platform);
                    log.audit('response',response);
                    options.bodyStr = response && response.body;
                }else if(apiId == 'getRequstAuditStatus') {//飞书  采购申请|付款申请 审批拉取Order
                    postdata = options.input || options.data;
                    var instance_id = options.instance_code;
                    var platformUrl = "https://open.feishu.cn/open-apis/approval/v4/instances/"+instance_id;
                    log.audit("tryRequestURL-FSgetRequstAuditStatusList-postdata", postdata);
                    var response = tryRequestURL(platformUrl, "", {"Authorization": "Bearer " + accessToken}, "GET", tryCount, platform);
                    log.audit('response',response);
                    options.bodyStr = response && response.body;
                }else if(apiId == 'pushFsApprovalInstance') {// TODO 飞书 创建审批实例
                    postdata = options.input || options.data;
                    // "https://open.feishu.cn/open-apis/approval/v4/instances";
                    var platformUrl = platformUrl + method;
                    var response = tryRequestURL(platformUrl, JSON.stringify(postdata), {"Authorization": "Bearer " + accessToken}, "POST", tryCount);

                    options.bodyStr = response && response.body;
                } else if (apiId == 'pushFsUploadFile') { // 飞书 上传文件
                    var dataTmp = options.input || options.data;
                    // 中台中转飞书文件上传API
                    var platformUrl = "https://console.openconnect.me/prod-api/logic/commons/transformation/handle";
                    // 请求数据格式：{"url":"飞书文件上传地址", "accessToken":"飞书登录令牌", "content": "NS文件二进制字符串"}
                    postdata = {
                        // url: "https://www.feishu.cn/approval/openapi/v2/file/upload?type=attachment&swocfile=content&name=" + encodeURIComponent(dataTmp.fileName),
                        url: "https://www.feishu.cn/approval/openapi/v2/file/upload",
                        fileName: dataTmp.fileName,
                        accessToken: accessToken,
                        data: {
                            "name": dataTmp.fileName,
                            "swocfile": "content",
                            "type": "attachment"
                        },
                        baseFile: dataTmp.fileContent
                    }
                    headers = {"Content-Type":"application/json","Accept":"*/*"};
                        var response = tryRequestURL(platformUrl, JSON.stringify(postdata), headers, "POST", tryCount);

                    options.bodyStr = response && response.body;
                }
            } else if (platform == "金蝶云星空") {
                var apiId = options.apiId;
                // 如果skipMapping 为true，则不做mapping处理，直接返回原始响应数据。
                var skipMapping = true;
                if(options.platformJson && Object.keys(options.platformJson).length>0)
                {
                    log.audit("requestURL",true);
                }
                var platformJson = options.platformJson || getPlatform(platform);
                options.platformJson = platformJson;
                var apiConfigJson = options.apiConfigJson = platformJson[apiId] && platformJson[apiId].config;
                if (!skipMapping) {
                    doInputMapping(options);
                }
                var beforeRequestFunc =getFunc("beforeRequest", platformJson, apiId);
                if (beforeRequestFunc) {
                    beforeRequestFunc(options);
                }

                var tryCount = options.tryCount || apiConfigJson.tryCount || 1;
                var platformUrl = options.url || apiConfigJson.url;
                // var postdata = options.postdata || apiConfigJson.postdata;
                var headers = options.headers || apiConfigJson.headers;
                var httpMethod = options.httpMethod || apiConfigJson.httpMethod;
                var method = options.method || apiConfigJson.method;

                // 调用登录接口取得cookie，设置到凭证拉取接口请求头cookie
                // 调用登录接口取得cookie
                var getCookieResp = tryRequestURL(
                    SWC_CONFIG_DATA.configData().KINGDEE_LOGIN_URL,
                    JSON.stringify(SWC_CONFIG_DATA.configData().KINGDEE_LOGIN_POST_DATA),
                    SWC_CONFIG_DATA.configData().KINGDEE_LOGIN_HEADER,
                    "POST",
                    tryCount);
                var getCookieRespObj = getCookieResp && getCookieResp.body ? JSON.parse(getCookieResp.body) : {};

                // 设置登录凭证cookie
                var headersObj = JSON.parse(headers);
                headersObj["Cookie"] = "kdservice-sessionid=" + getCookieRespObj["KDSVCSessionId"];

                // SWC_SS_getList.js中对应接口整理的data对象
                var postdata = options.data;
                var response;
                if ("getKingdeeVoucherList" == apiId) {
                    // 调用凭证单据查询接口
                    response = tryRequestURL(platformUrl + method, JSON.stringify(postdata), headersObj, httpMethod, tryCount, platform);
                }

                options.bodyStr = response && response.body;
            }else if(platform == 'Navan'){
                var apiId = options.apiId;
                // 如果skipMapping 为true，则不做mapping处理，直接返回原始响应数据。
                var skipMapping = true;
                if(options.platformJson && Object.keys(options.platformJson).length>0)
                {
                    log.audit("requestURL",true);
                }
                var platformJson = options.platformJson || getPlatform(platform);
                options.platformJson = platformJson;
                var apiConfigJson = options.apiConfigJson = platformJson[apiId] && platformJson[apiId].config;
                if (!skipMapping) {
                    doInputMapping(options);
                }
                var beforeRequestFunc =getFunc("beforeRequest", platformJson, apiId);
                if (beforeRequestFunc) {
                    beforeRequestFunc(options);
                }
                var platformUrl = options.url || apiConfigJson.url;
                var postdata = options.postdata || apiConfigJson.postdata;
                var headers = options.headers || apiConfigJson.headers;
                var httpMethod = options.httpMethod || apiConfigJson.httpMethod;
                var method = options.method || apiConfigJson.method;


                var tranName = options.tranName;    // 事务处理名字
                var sessionKey = platformJson.config.sessionKey;   // sessionKey
                var sessionSecret = platformJson.config.sessionSecret;   // sessionSecret

                var tryCount = options.tryCount || apiConfigJson.tryCount || 1;
                //var thisHeaders = {"Content-Type":"application/json; charset=utf-8"};
                log.audit("platformJson.config",platformJson.config);
                // var body = {
                //     "client_id" : sessionKey,
                //     "client_secret" : sessionSecret,
                //     "grant_type" : "client_credentials"
                // }
                var body = "?client_id="+sessionKey+"&client_secret="+sessionSecret+"&grant_type=client_credentials";
                var tokenResponse = https.request({method:"POST",url:"https://api.tripactions.com/ta-auth/oauth/token"+body,body:"",headers:""});
                log.audit('tokenResponse',tokenResponse);
                var accessToken = "Bearer " + JSON.parse(tokenResponse.body).access_token;//获取token
                headers = {"Content-Type":"application/json","Authorization" : accessToken,"Accept":"*/*"};
                log.audit('accessToken',accessToken);

                if(apiId == 'getNavanVoucherList'){
                    //Navan费用报销凭证接口
                    var str = options.data.startTime;//拉取数据日期
                    var reportType = options.data.reportType;

                    log.audit('startTime',str + reportType);
                    var newPlatformUrl = platformUrl+'?reportType='+reportType+'&dateModified='+str;
                    log.audit("newPlatformUrl",newPlatformUrl);
                    var response = tryRequestURL(newPlatformUrl,"", headers, httpMethod, tryCount, platform);
                    options.bodyStr = response && response.body;
                    log.audit("response.body",response.body);

                }

                if(apiId == 'getDateNavanVoucherList'){
                    //Navan费用报销凭证接口
                    var str = options.data.startTime;//拉取数据日期
                    var reportType = options.data.reportType;

                    log.audit('startTime',str + reportType);
                    var newPlatformUrl = platformUrl+'?reportType='+reportType+'&date='+str;
                    log.audit("newPlatformUrl",newPlatformUrl);
                    var response = tryRequestURL(newPlatformUrl,"", headers, httpMethod, tryCount, platform);
                    options.bodyStr = response && response.body;
                    log.audit("response.body",response.body);

                }

            }

            var afterResponseFunc = getFunc("afterResponse", platformJson, apiId);
            var exitFlag = false;
            if (afterResponseFunc) {
                exitFlag = afterResponseFunc(options);
                if (exitFlag) {
                    options.output && (options.output["_input_"] = options.input);
                    return options.output;
                }
            }
            if (!skipMapping) {
                doOutputMapping(options);
            }
            // 将请求参数也放到output中
            options.output && (options.output["_input_"] = options.input);
            return options.output;
        }

        function doInputMapping(options) {
            var platformJson = options.platformJson;
            var apiConfigJson = options.apiConfigJson;
            var apiId = options.apiId;
            var srcData = options.data; // 传入值
            var mappingConfig = apiConfigJson.inConfig;
            if (!srcData || !mappingConfig) {
                return;
            }

            options.input = doMapping(srcData, mappingConfig, platformJson, apiId);
        }

        function doOutputMapping(options) {
            var platformJson = options.platformJson;
            var apiConfigJson = options.apiConfigJson;
            var apiId = options.apiId;
            var srcData = options.bodyJson; // 传入值
            var mappingConfig = apiConfigJson.outConfig;
            if (!srcData || !mappingConfig) {
                return;
            }
            options.output = doMapping(srcData, mappingConfig, platformJson, apiId);
        }

        function doMapping(srcData, mappingConfig, platformJson, apiId) {
            if (!srcData || !mappingConfig) {
                return {};
            }
            // 后置处理cache
            var postProcessCache = {
                // module名称:{字段 :{func:函数,vals:[src值 ],param:param值}}
                // body : {"a":{func:test,vals:["x"],param:"param"}}}
            };

            var propOfSrcObj = _.propertyOf(srcData);
            var targetObj = {};
            // 遍历mappingConfig，处理各个模块的mapping（如body，items等）
            _.each(mappingConfig, function(moduleConfig, moduleName) {
                var src = moduleConfig.src; // 源的属性链，例如a.b
                // 获取到来源对象
                var srcObj = getValueByPropChain(srcData, propOfSrcObj, src);
                var isArray = _.isArray(srcObj);
                if (isArray) {
                    var moduleAry = (moduleName == ".") ? targetObj : (targetObj[moduleName] = targetObj[moduleName] || []);
                    // 遍历src 数组
                    _.each(srcObj, function(val, index) {
                        var curTarget = {};
                        if (!moduleConfig.fieldsMapping || !_.size(moduleConfig.fieldsMapping)) {
                            curTarget = val;
                        } else {
                            var propOfCurSrcObj = _.propertyOf(val);
                            // 对各个字段进行设置值
                            processFieldsMapping(val, propOfCurSrcObj, curTarget, moduleConfig.fieldsMapping, platformJson, apiId, postProcessCache, moduleName);
                        }

                        moduleAry.push(curTarget);
                    });

                    // 滞后处理
                    var postModuleCache = postProcessCache[moduleName] = postProcessCache[moduleName] || {};
                    if (postModuleCache) {
                        _.each(postModuleCache, function(fldConfig, fldName) {
                            var funcName = fldConfig.funcName; // 回调方法名称
                            var param = fldConfig.param;
                            var vals = fldConfig.vals; // 值数组
                            var func = getFunc(funcName, platformJson, apiId);
                            fldConfig.results = func && func(vals, param) || {}; // {"x":"1","y":2}
                        });
                    }
                    // 替换结果
                    _.each(moduleAry, function(element, index) {
                        _.each(postModuleCache, function(fldConfig, fldName) {
                            var results = fldConfig.results;
                            var curVal = element[fldName];
                            element[fldName] = results[curVal];
                        });
                    });
                } else {
                    var curTarget = (moduleName == ".") ? targetObj : (targetObj[moduleName] = targetObj[moduleName] || {});
                    processFieldsMapping(srcObj, _.propertyOf(srcObj), curTarget, moduleConfig.fieldsMapping, platformJson, apiId, postProcessCache, moduleName);
                }
            });
            return targetObj;
        }

// body : {"a":{func:test,vals:{"x":{param:"01"}}}}
        function addToCache(cache, moduleName, fldName, funcName, val, param) {
            if (!cache || !moduleName || !fldName || !funcName) {
                return;
            }

            var moduleJson = cache[moduleName] = cache[moduleName] || {};
            var fldJson = moduleJson[fldName] = moduleJson[fldName] || {
                funcName : funcName,
                param : param,
                vals : []
            };
            var vals = fldJson.vals;
            vals.push(val);
        }

        function processFieldsMapping(srcObj, propOfSrcObj, targetObj, fieldsMapping, platformJson, apiId, postProcessCache, moduleName)
        {
            if (!srcObj || !propOfSrcObj || !targetObj || !fieldsMapping) {
                return;
            }

            _.each(fieldsMapping, function(fldConfig, fldName) {

                // 从propOfSrcObj获取值
                var src = fldConfig.src;
                var funcName = fldConfig.funcName;
                var param = fldConfig.param;

                // 字段名称检查，如果第一个字符为:号，则使用模板来取值
                var srcVal = getValueByPropChain(srcObj, propOfSrcObj, src) || param;

                var isPost = false;
                // 滞后function检查(名称中第一个字符为:号)
                if (funcName && funcName.charAt(0) == ":") {
                    isPost = true;
                    funcName = funcName.substr(1);
                }
                var val = srcVal;
                if (isPost) {
                    addToCache(postProcessCache, moduleName, fldName, funcName, srcVal, param);
                } else {
                    var func = getFunc(funcName, platformJson, apiId);

                    val = func ? (func(srcVal, param) || "") : srcVal;
                }
                targetObj[fldName] = val;
            });
        }

        function getValueByPropChain(srcObj, propOfObj, str)
        {
            if (!str) {
                return "";
            }
            if (str == ".") { // 返回当前对象
                return srcObj;
            }
            var val = "";

            if (str.charAt(0) == ":") { // 模板表达式
                str = str.substr(1);
                val = _.template(str)(srcObj);

            } else {
                var propAry = str.split("."); // a.b 表达式
                val = propOfObj(propAry);
            }

            if(_.isString(val)){
                val = val.trim();
            }
            return val;
        }

        /**
         *
         * @param platformUrl
         * @param postdata
         * @param headers:{name:"Content-Type",value:"text/plain"}
         * @param httpMethod:POST
         * @param tryCount
         * @returns {string}
         */

        function tryRequestURL(platformUrl, postdata, headers, httpMethod, tryCount, platform,userName,userPassword) {
            var response = "";
            var success = false;
            var error = "";
            for (var i = 0; i < tryCount; i++) {
                try {
                    log.audit("platformUrl----tryRequestURL",platformUrl);
                    log.audit("httpMethod----tryRequestURL",httpMethod);
                    log.audit("postdata----tryRequestURL",postdata);
                    log.audit("headers----tryRequestURL",headers);
                    response = https.request({method:httpMethod,url:platformUrl,body:postdata,headers:headers});
                    log.audit("response----tryRequestURL",response);
                    success = true;
                    break;
                } catch (e) {
                    log.audit({title:"nlapiRequestURL",details:i + ":" + e});
                    error = e;
                }
            }
            if (!success) {
                throw error;
            }
            // return headers+JSON.stringify(postdata)+httpMethod;
            return response;
        }
        /**end***********************PluginGuanyi**********************************end**/
        /**start*************************PluginTrans****************************start**/
        // 调用飞书 飞书拉取采购合同回写采购订单下
        function getFeiShuContractIddata(options) {
            var data = options.data;
            var platformJson = options.platformJson;

            var ordersInfo = {};
            var externalidAry = []; // 外部id数组
            var timeStamp = options.data.timeStamp; // 时间戳
            var nsContractIdMidTable;
            // 循环调用接口
            if(data.contractIdArr.length) {
                for(var i = 0; i < data.contractIdArr.length; i++) {

                    var customrecord_swc_feishu_contractidSearchObj = search.create({
                        type: "customrecord_swc_feishu_contractid",
                        filters: [["custrecord_line_contractid","is",data.contractIdArr[i]]],
                        columns:
                            [
                                search.createColumn({name: "internalid", label: "内部 ID"}),
                                search.createColumn({name: "custrecord_line_contractid", label: "contractid"})
                            ]
                    });
                    customrecord_swc_feishu_contractidSearchObj.run().each(function(result) {
                        nsContractIdMidTable = result.getValue({name: "internalid"});
                        return true;
                    });

                    // 时间段内的订单信息抓取
                    var out = requestURL({
                        platform : options.platform,
                        tranName : options.tranName,
                        apiId : "getFeiShuContractId",
                        data : {"contractId":data.contractIdArr[i]},
                        tryCount : 3,
                        platformJson : platformJson
                    });
                    if (out) {
                        out.code == "0" ? out.success = true : out.success = false;
                        if (!out.success) {
                            return out;
                        }
                    }

                    var outData = out.data.contract;

                    //   抓取form中 "attribute_type": "feishu_approval","approval_type": "third_party_approval"
                    var form = outData.form;

                    form = JSON.parse(form);
                    var prIdArr = []; // ns 采购申请单ID数组
                    var flag = false; // 判断根据attribute_type，approval_type是否抓取回来
                    for(var j = 0; j < form.length; j++) {
                        if(form[j]["attribute_type"] == "feishu_approval" && form[j]["approval_type"] == "third_party_approval") {
                            flag = true;
                            var attribute_value = form[j]["attribute_value"];
                            for(var k = 0; k <attribute_value.length; k++ ) {
                                prIdArr.push(attribute_value[k].id);
                            }
                        }
                    }
                    if(flag) {
                        var requestTimeStamp = timeStamp; // 时间戳
                        var requestTimeStampDate = new Date(parseInt(requestTimeStamp));

                        // 补零操作 yyyy/mm/dd hh:mm:ss
                        var requestTimeStampDateAll = getAllDate(requestTimeStampDate);
                        var changeTimeValue = (requestTimeStampDateAll && requestTimeStampDateAll.replace(/\D/g,""));
                        var lastMod = Number(changeTimeValue) != 0 ? changeTimeValue : "";// yyyymmddhhmmss

                        externalidAry.push("feishuContractId_"+data.contractIdArr[i]);
                        var contract_files = outData.contract_files; // 文件JSON
                        ordersInfo[data.contractIdArr[i]] = {
                            nsContractIdMidTable : nsContractIdMidTable,
                            contractId : data.contractIdArr[i],
                            prIdArr : prIdArr,
                            // contractZhu : contract_files.contract_text,
                            contractGui : contract_files.contract_scans,
                            lastMod : lastMod
                        };
                        log.audit("ordersInfo[userId]",JSON.stringify(ordersInfo));
                    } else {
                        // 如果不需要处理 删除
                        if(nsContractIdMidTable) record.delete({type:"customrecord_swc_feishu_contractid",id:nsContractIdMidTable});
                    }
                }
            }


            var result = {
                total : data.total || 0,
                success : true,
                externalidAry : _.unique(externalidAry),
                ordersInfo : ordersInfo,
                // "_input_" : out["_input_"]
            };
            return result;
        }

        // 对抓取回来的批量数据拆单
        function getFeiShuContractId(options) {
            var data = options.output;
            if (!data) {
                throw "ERROR:NO_DATA";
            }
            var externalidAry = data.externalidAry;
            var ordersInfo = data.ordersInfo;

            // 存放销售订单task的外部id
            var tasksJson = checkAndGetTaskInfo(externalidAry);

            // ordersInfo 和 tasksJson 进行比对
            _.each(ordersInfo, function(orderInfo, userId)
            {

                orderInfo.success = data.success || options.success;

                // 如果delivery code 在task中存在，说明已经创建过task，如果当前lastModified 大于 task中记录的，则更新fulfill任务
                if (tasksJson["feishuContractId_" + userId])
                {
                    var lastMod = tasksJson["feishuContractId_" + userId].lastMod || 0;
                    var status = tasksJson["feishuContractId_" + userId].status;
                    var curLastMod = orderInfo.lastMod;
                    var apiCompleted = true;
                    if (curLastMod - lastMod > 0)
                    {
                        if(status != "1" || status != "3")
                        {
                            apiCompleted = false;
                        }
                        // 创建fulfill task
                        createAndExecTask({
                            platform : options.platform,
                            tranName : "getFeiShuContractFile",
                            lastModified : curLastMod,
                            output : orderInfo,
                            data : {
                                code : userId
                            },
                            apiCompleted : apiCompleted
                        });
                    }
                } else {
                    // 如果order-xx task 不存在需要创建task
                    createAndExecTask({
                        platform : options.platform,
                        tranName : "getFeiShuContractFile",
                        output : orderInfo,
                        data : {
                            code : userId
                        }
                    });
                }
            });
        }

        // 根据file_Id 抓取内容
        function getFeiShuContractFiledata(options) {
            var data = options.output;
            if (!data) {
                throw "ERROR:NO_DATA";
            }

            log.audit("data",data)
            // var contractZhuJson = options.output.contractZhu; // 主合同
            var contractGuiArr = options.output.contractGui; // 归档合同数组


            if(contractGuiArr.length) {
                // 归档合同
                for(var i = 0; i < contractGuiArr.length; i++) {
                    var out = requestURL({
                        platform : options.platform,
                        tranName : options.tranName,
                        apiId : "getFeiShuContractFile",
                        data : {"fileId":contractGuiArr[i].file_id},
                        tryCount : 3,
                        platformJson : options.platformJson
                    });

                    if (out) {
                        out.code == "200" ? out.success = true : out.success = false;
                        if (!out.success) {
                            return out;
                        }
                    }

                    options.output.contractGui[i].fileContent = out.msg;
                }
            }
            // else {
            //     if(contractZhuJson.file_id) {
            //         // 主合同
            //         var out = requestURL({
            //             platform : options.platform,
            //             tranName : options.tranName,
            //             apiId : "getFeiShuContractFile",
            //             data : {"fileId":contractZhuJson.file_id},
            //             tryCount : 3,
            //             platformJson : options.platformJson
            //         });
            //
            //         if (out) {
            //             out.code == "200" ? out.success = true : out.success = false;
            //             if (!out.success) {
            //                 return out;
            //             }
            //         }
            //         options.output.contractZhu.fileContent = out.msg;
            //
            //     }
            // }

            return options.output;
        }

        // 飞书同步ns 飞书ouID
        function getFeiShuContractFile(options) {
            BusinessProcessing.getFeiShuContractFile(options);
        }
        // 调用飞书 根据员工邮箱查询飞书员工IDOU
        function getEmployeeIDFeiShuOUListdata(options) {
            var data = options.data;
            var platformJson = options.platformJson;

            var empEmailJson = {};
            for(var i = 0; i < data.empEmailArr.length; i++) {
                empEmailJson[data.empEmailArr[i]["empEmail"]] = data.empEmailArr[i]["empId"];
            }
            data.empEmailJson = empEmailJson;

            // 时间段内的订单信息抓取
            var out = requestURL({
                platform : options.platform,
                tranName : options.tranName,
                apiId : "getEmployeeIDFeiShuOUList",
                data : data,
                tryCount : 3,
                platformJson : platformJson
            });
            if (out) {
                out.msg == "success" ? out.success = true : out.success = false;
                if (!out.success) {
                    return out;
                }
            }

            var timeStamp = options.data.timeStamp; // 时间戳
            var pageSize = options.data.pageSize;  // 一次请求多少个
            var curPage = options.data.curPage;  // 当前页


            var externalidAry = []; // 外部id数组


            var ordersInfo = {};
            var outData = out.data.user_list;
            log.audit("outData.length：",outData.length);

            _.each(outData, function(orderInfoJson, index) {

                var email = orderInfoJson.email;  // email
                var user_id = orderInfoJson.user_id;  // user_id
                var nsInternalId = empEmailJson[email]; // internalId

                var requestTimeStamp = timeStamp; // 时间戳
                var requestTimeStampDate = new Date(parseInt(requestTimeStamp));

                // 补零操作 yyyy/mm/dd hh:mm:ss
                var requestTimeStampDateAll = getAllDate(requestTimeStampDate);
                var changeTimeValue = (requestTimeStampDateAll && requestTimeStampDateAll.replace(/\D/g,""));
                var lastMod = Number(changeTimeValue) != 0 ? changeTimeValue : "";// yyyymmddhhmmss

                externalidAry.push("employeeFeiShuOU_"+user_id);

                ordersInfo[user_id] = {
                    email : email,
                    user_id : user_id,
                    nsInternalId : nsInternalId,
                    lastMod : lastMod
                };
                log.audit("ordersInfo[userId]"+index,JSON.stringify(ordersInfo));


            });

            var result = {
                total : out.data.user_list.length || 0,
                success : true,
                externalidAry : _.unique(externalidAry),
                ordersInfo : ordersInfo,
                "_input_" : out["_input_"]
            };
            return result;
        }

        // 对抓取回来的批量数据拆单
        function getEmployeeIDFeiShuOUList(options) {
            var data = options.output;
            if (!data) {
                throw "ERROR:NO_DATA";
            }
            var externalidAry = data.externalidAry;
            var ordersInfo = data.ordersInfo;

            // 存放销售订单task的外部id
            var tasksJson = checkAndGetTaskInfo(externalidAry);

            // ordersInfo 和 tasksJson 进行比对
            _.each(ordersInfo, function(orderInfo, userId)
            {

                orderInfo.success = data.success || options.success;

                // 如果delivery code 在task中存在，说明已经创建过task，如果当前lastModified 大于 task中记录的，则更新fulfill任务
                if (tasksJson["employeeFeiShuOU_" + userId])
                {
                    var lastMod = tasksJson["employeeFeiShuOU_" + userId].lastMod || 0;
                    var status = tasksJson["employeeFeiShuOU_" + userId].status;
                    var curLastMod = orderInfo.lastMod;
                    var apiCompleted = true;
                    if (curLastMod - lastMod > 0)
                    {
                        if(status != "1" || status != "3")
                        {
                            apiCompleted = false;
                        }
                        // 创建fulfill task
                        createAndExecTask({
                            platform : options.platform,
                            tranName : "getEmployeeIDFeiShuOU",
                            lastModified : curLastMod,
                            output : orderInfo,
                            data : {
                                code : userId
                            },
                            apiCompleted : apiCompleted
                        });
                    }
                } else {
                    // 如果order-xx task 不存在需要创建task
                    createAndExecTask({
                        platform : options.platform,
                        tranName : "getEmployeeIDFeiShuOU",
                        output : orderInfo,
                        data : {
                            code : userId
                        }
                    });
                }
            });
        }

        // 飞书返回单条task数据
        function getEmployeeIDFeiShuOUdata(options) {
            return options.output;
        }

        // 飞书同步ns 飞书ouID
        function getEmployeeIDFeiShuOU(options) {
            BusinessProcessing.getEmployeeFeiShuOUId(options);
        }


        // 调用飞书 根据员工邮箱查询飞书员工ID
        function getEmployeeIDFeiShuListdata(options) {
            var data = options.data;
            var platformJson = options.platformJson;

            var empEmailJson = {};
            for(var i = 0; i < data.empEmailArr.length; i++) {
                empEmailJson[data.empEmailArr[i]["empEmail"]] = data.empEmailArr[i]["empId"];
            }
            data.empEmailJson = empEmailJson;

            // 时间段内的订单信息抓取
            var out = requestURL({
                platform : options.platform,
                tranName : options.tranName,
                apiId : "getEmployeeIDFeiShuList",
                data : data,
                tryCount : 3,
                platformJson : platformJson
            });
            if (out) {
                out.msg == "success" ? out.success = true : out.success = false;
                if (!out.success) {
                    return out;
                }
            }

            var timeStamp = options.data.timeStamp; // 时间戳
            var pageSize = options.data.pageSize;  // 一次请求多少个
            var curPage = options.data.curPage;  // 当前页


            var externalidAry = []; // 外部id数组


            var ordersInfo = {};
            var outData = out.data.user_list;
            log.audit("outData.length：",outData.length);

            _.each(outData, function(orderInfoJson, index) {

                var email = orderInfoJson.email;  // email
                var user_id = orderInfoJson.user_id;  // user_id
                var nsInternalId = empEmailJson[email]; // internalId

                var requestTimeStamp = timeStamp; // 时间戳
                var requestTimeStampDate = new Date(parseInt(requestTimeStamp));

                // 补零操作 yyyy/mm/dd hh:mm:ss
                var requestTimeStampDateAll = getAllDate(requestTimeStampDate);
                var changeTimeValue = (requestTimeStampDateAll && requestTimeStampDateAll.replace(/\D/g,""));
                var lastMod = Number(changeTimeValue) != 0 ? changeTimeValue : "";// yyyymmddhhmmss

                externalidAry.push("employeeFeiShu_"+user_id);

                ordersInfo[user_id] = {
                    email : email,
                    user_id : user_id,
                    nsInternalId : nsInternalId,
                    lastMod : lastMod
                };
                log.audit("ordersInfo[userId]"+index,JSON.stringify(ordersInfo));


            });

            var result = {
                total : out.data.user_list.length || 0,
                success : true,
                externalidAry : _.unique(externalidAry),
                ordersInfo : ordersInfo,
                "_input_" : out["_input_"]
            };
            return result;
        }

        // 对抓取回来的批量数据拆单
        function getEmployeeIDFeiShuList(options) {
            var data = options.output;
            if (!data) {
                throw "ERROR:NO_DATA";
            }
            var externalidAry = data.externalidAry;
            var ordersInfo = data.ordersInfo;

            // 存放销售订单task的外部id
            var tasksJson = checkAndGetTaskInfo(externalidAry);

            // ordersInfo 和 tasksJson 进行比对
            _.each(ordersInfo, function(orderInfo, userId)
            {

                orderInfo.success = data.success || options.success;

                // 如果delivery code 在task中存在，说明已经创建过task，如果当前lastModified 大于 task中记录的，则更新fulfill任务
                if (tasksJson["employeeFeiShu_" + userId])
                {
                    var lastMod = tasksJson["employeeFeiShu_" + userId].lastMod || 0;
                    var status = tasksJson["employeeFeiShu_" + userId].status;
                    var curLastMod = orderInfo.lastMod;
                    var apiCompleted = true;
                    if (curLastMod - lastMod > 0)
                    {
                        if(status != "1" || status != "3")
                        {
                            apiCompleted = false;
                        }
                        // 创建fulfill task
                        createAndExecTask({
                            platform : options.platform,
                            tranName : "getEmployeeIDFeiShu",
                            lastModified : curLastMod,
                            output : orderInfo,
                            data : {
                                code : userId
                            },
                            apiCompleted : apiCompleted
                        });
                    }
                } else {
                    // 如果order-xx task 不存在需要创建task
                    createAndExecTask({
                        platform : options.platform,
                        tranName : "getEmployeeIDFeiShu",
                        output : orderInfo,
                        data : {
                            code : userId
                        }
                    });
                }
            });
        }

        // 飞书返回单条task数据
        function getEmployeeIDFeiShudata(options) {
            return options.output;
        }

        // 飞书同步ns 飞书ID
        function getEmployeeIDFeiShu(options) {
            BusinessProcessing.getEmployeeFeiShuId(options);
        }


        // 调用authing查询员工列表 查询所有员工
        function getEmployeeListdata(options) {
            var data = options.data;
            var platformJson = options.platformJson;
            // 时间段内的订单信息抓取
            var out = requestURL({
                platform : options.platform,
                tranName : options.tranName,
                apiId : "getEmployeeList",
                data : data,
                tryCount : 3,
                platformJson : platformJson
            });
            if (out) {
                out.statusCode == 200 ? out.success = true : out.success = false;
                if (!out.success) {
                    return out;
                }
            }

            var timeStamp = options.data.timeStamp; // 时间戳
            var pageSize = options.data.pageSize;  // 一次请求多少个
            var curPage = options.data.curPage;  // 当前页


            var externalidAry = []; // 外部id数组


            var ordersInfo = {};
            var outData = out.data.list;
            log.audit("outData.length：",outData);


            //分页
            // var resultPageArr = [];
            // if (outData) {
            //     var start = pageSize * (curPage - 1);
            //     var end = pageSize * curPage - 1;
            //     log.audit("分页开始号：",start);
            //     log.audit("分页结束号：",end);
            //     for (var i = start; i <= Math.min(outData.length-1 , end); i++ ) {
            //         resultPageArr.push(outData[i]);
            //     }
            // }
            // log.audit("resultPageArr：",resultPageArr);
            _.each(outData, function(orderInfoJson, index) {

                var userId = orderInfoJson.userId;  // userId
                var mainDepartmentId = orderInfoJson.mainDepartmentId;  // mainDepartmentId
                var company = orderInfoJson.company;  // company
                var status = orderInfoJson.status;  // status
                var email = orderInfoJson.email || "";  // email
                var jobNumber = orderInfoJson.customData.jobNumber;
                var leaderUserId = orderInfoJson.customData.leaderUserId;
                // 部门平凯（北京）得不接
                if(mainDepartmentId == "65efdc64708b0466c3725de2") {
                    return;
                }

                // 状态是Activated 且邮箱里没有-c的抓取回来
                if(status == "Activated" && email.indexOf("-c") < 0 && jobNumber) {
                    var requestTimeStamp = timeStamp; // 时间戳
                    var requestTimeStampDate = new Date(parseInt(requestTimeStamp));

                    // 补零操作 yyyy/mm/dd hh:mm:ss
                    var requestTimeStampDateAll = getAllDate(requestTimeStampDate);
                    var changeTimeValue = (requestTimeStampDateAll && requestTimeStampDateAll.replace(/\D/g,""));
                    var lastMod = Number(changeTimeValue) != 0 ? changeTimeValue : "";// yyyymmddhhmmss

                    externalidAry.push("employee_"+userId);

                    // 收集所有的authing userid
                    options.data.authingIdArr.push(userId);

                    ordersInfo[userId] = {
                        userId : userId,
                        externalId : orderInfoJson.externalId,
                        email : orderInfoJson.email,
                        phone : orderInfoJson.phone,
                        name : orderInfoJson.name,
                        company : orderInfoJson.company,
                        mainDepartmentId : orderInfoJson.mainDepartmentId,
                        jobNumber :  orderInfoJson.customData.jobNumber,
                        leaderUserId : orderInfoJson.customData.leaderUserId,
                        lastMod : lastMod
                    };
                    // log.audit("ordersInfo[userId]"+index,JSON.stringify(ordersInfo));
                }

            });

            var result = {
                total : out.data.totalCount || 0,
                success : true,
                externalidAry : _.unique(externalidAry),
                authingIdArr : _.unique(options.data.authingIdArr),
                ordersInfo : ordersInfo,
                "_input_" : out["_input_"]
            };
            return result;
        }

        // 对抓取回来的批量数据拆单
        function getEmployeeList(options) {
            var data = options.output;
            if (!data) {
                throw "ERROR:NO_DATA";
            }
            var externalidAry = data.externalidAry;
            var ordersInfo = data.ordersInfo;

            // 存放销售订单task的外部id
            var tasksJson = checkAndGetTaskInfo(externalidAry);

            // ordersInfo 和 tasksJson 进行比对
            _.each(ordersInfo, function(orderInfo, userId)
            {

                orderInfo.success = data.success || options.success;

                // 如果delivery code 在task中存在，说明已经创建过task，如果当前lastModified 大于 task中记录的，则更新fulfill任务
                if (tasksJson["employee_" + userId])
                {
                    var lastMod = tasksJson["employee_" + userId].lastMod || 0;
                    var status = tasksJson["employee_" + userId].status;
                    var curLastMod = orderInfo.lastMod;
                    var apiCompleted = true;
                    if (curLastMod - lastMod > 0)
                    {
                        if(status != "1" || status != "3")
                        {
                            apiCompleted = false;
                        }
                        // 创建fulfill task
                        createAndExecTask({
                            platform : options.platform,
                            tranName : "getEmployee",
                            lastModified : curLastMod,
                            output : orderInfo,
                            data : {
                                code : userId
                            },
                            apiCompleted : apiCompleted
                        });
                    }
                } else {
                    // 如果order-xx task 不存在需要创建task
                    createAndExecTask({
                        platform : options.platform,
                        tranName : "getEmployee",
                        output : orderInfo,
                        data : {
                            code : userId
                        }
                    });
                }
            });
        }

        // authing返回单条task数据
        function getEmployeedata(options) {
            return options.output;
        }

        // authing员工同步业务逻辑处
        function getEmployee(options) {
            BusinessProcessing.getEmployee(options);
        }


        // 调用authing查询员工列表 查询所有员工
        function getEmployeeList_newdata(options) {
            var data = options.data;
            var platformJson = options.platformJson;
            // 时间段内的订单信息抓取
            var out = requestURL({
                platform : options.platform,
                tranName : options.tranName,
                apiId : "getEmployeeList_new",
                data : data,
                tryCount : 3,
                platformJson : platformJson
            });
            if (out) {
                out.statusCode == 200 ? out.success = true : out.success = false;
                if (!out.success) {
                    return out;
                }
            }

            var timeStamp = options.data.timeStamp; // 时间戳
            var pageSize = options.data.pageSize;  // 一次请求多少个
            var curPage = options.data.curPage;  // 当前页


            var externalidAry = []; // 外部id数组


            var ordersInfo = {};
            var outData = out.data.list;
            // log.audit("outData.length：",outData);


            //分页
            // var resultPageArr = [];
            // if (outData) {
            //     var start = pageSize * (curPage - 1);
            //     var end = pageSize * curPage - 1;
            //     log.audit("分页开始号：",start);
            //     log.audit("分页结束号：",end);
            //     for (var i = start; i <= Math.min(outData.length-1 , end); i++ ) {
            //         resultPageArr.push(outData[i]);
            //     }
            // }
            // log.audit("resultPageArr：",resultPageArr);
            _.each(outData, function(orderInfoJson, index) {

                var userId = orderInfoJson.userId;  // userId
                var mainDepartmentId = orderInfoJson.mainDepartmentId;  // mainDepartmentId
                var company = orderInfoJson.company;  // company
                var status = orderInfoJson.status;  // status
                var email = orderInfoJson.email || "";  // email
                var jobNumber = orderInfoJson.customData.jobNumber;
                var leaderUserId = orderInfoJson.customData.leaderUserId;
                // 部门平凯（北京）得不接
                if(mainDepartmentId == "65efdc64708b0466c3725de2") {
                    return;
                }
                log.audit("email",email);
                log.audit("email",email.indexOf("-c"));
                // 状态是Activated 且邮箱里没有-c的抓取回来
                if(status == "Activated" && email.indexOf("-c") < 0 && jobNumber) {
                    var requestTimeStamp = timeStamp; // 时间戳
                    var requestTimeStampDate = new Date(parseInt(requestTimeStamp));
                    log.audit("33",33);
                    // 补零操作 yyyy/mm/dd hh:mm:ss
                    var requestTimeStampDateAll = getAllDate(requestTimeStampDate);
                    var changeTimeValue = (requestTimeStampDateAll && requestTimeStampDateAll.replace(/\D/g,""));
                    var lastMod = Number(changeTimeValue) != 0 ? changeTimeValue : "";// yyyymmddhhmmss
                    log.audit("11",11);
                    externalidAry.push("employee_"+userId);

                    // 收集所有的authing userid
                    options.data.authingIdArr.push(userId);

                    ordersInfo[userId] = {
                        userId : userId,
                        externalId : orderInfoJson.externalId,
                        email : orderInfoJson.email,
                        phone : orderInfoJson.phone,
                        name : orderInfoJson.name,
                        company : orderInfoJson.company,
                        mainDepartmentId : orderInfoJson.mainDepartmentId,
                        jobNumber :  orderInfoJson.customData.jobNumber,
                        leaderUserId : orderInfoJson.customData.leaderUserId,
                        lastMod : lastMod
                    };
                    log.audit("ordersInfo[userId]"+index,JSON.stringify(ordersInfo));
                }

            });

            var result = {
                total : out.data.totalCount || 0,
                success : true,
                externalidAry : _.unique(externalidAry),
                authingIdArr : _.unique(options.data.authingIdArr),
                ordersInfo : ordersInfo,
                "_input_" : out["_input_"]
            };
            return result;
        }

        // 对抓取回来的批量数据拆单
        function getEmployeeList_new(options) {
            var data = options.output;
            if (!data) {
                throw "ERROR:NO_DATA";
            }
            var externalidAry = data.externalidAry;
            var ordersInfo = data.ordersInfo;

            // 存放销售订单task的外部id
            var tasksJson = checkAndGetTaskInfo(externalidAry);

            // ordersInfo 和 tasksJson 进行比对
            _.each(ordersInfo, function(orderInfo, userId)
            {

                orderInfo.success = data.success || options.success;

                // 如果delivery code 在task中存在，说明已经创建过task，如果当前lastModified 大于 task中记录的，则更新fulfill任务
                if (tasksJson["employee_" + userId])
                {
                    var lastMod = tasksJson["employee_" + userId].lastMod || 0;
                    var status = tasksJson["employee_" + userId].status;
                    var curLastMod = orderInfo.lastMod;
                    var apiCompleted = true;
                    if (curLastMod - lastMod > 0)
                    {
                        if(status != "1" || status != "3")
                        {
                            apiCompleted = false;
                        }
                        // 创建fulfill task
                        createAndExecTask({
                            platform : options.platform,
                            tranName : "getEmployee_new",
                            lastModified : curLastMod,
                            output : orderInfo,
                            data : {
                                code : userId
                            },
                            apiCompleted : apiCompleted
                        });
                    }
                } else {
                    // 如果order-xx task 不存在需要创建task
                    createAndExecTask({
                        platform : options.platform,
                        tranName : "getEmployee_new",
                        output : orderInfo,
                        data : {
                            code : userId
                        }
                    });
                }
            });
        }

        // authing返回单条task数据
        function getEmployee_newdata(options) {
            return options.output;
        }

        // authing员工同步业务逻辑处
        function getEmployee_new(options) {
            BusinessProcessing.getEmployee_new(options);
        }
        // 调用authing查询组织+子部门列表 获取所有部门信息
        function getDepartmentList_newdata(options) {
            var ordersInfo = {}; // 总数据结构
            var externalidAry = []; // 外部id数组
            var organizationArr = []; // 组织机构列表[{"organCode","departmentId"}]
            var firstDepartmentIdArr = []; //一级部门有hasChildren ID数组[{"organCode","departmentId"}]
            var secondDepartmentIdArr = []; //二级部门有hasChildren ID数组[{"organCode","departmentId"}]
            var thidrdDepartmentIdArr = []; //三级部门有hasChildren ID数组[{"organCode","departmentId"}]
            var fourthDepartmentIdArr = []; //四级部门有hasChildren ID数组[{"organCode","departmentId"}]


            var data = options.data;
            var platformJson = options.platformJson;
            var timeStamp = options.data.timeStamp; // 时间戳
            var pageSize = options.data.pageSize;  // 一次请求多少个
            var curPage = options.data.curPage;  // 当前页

            var requestTimeStamp = timeStamp; // 时间戳
            var requestTimeStampDate = new Date(parseInt(requestTimeStamp));

            // 补零操作 yyyy/mm/dd hh:mm:ss
            var requestTimeStampDateAll = getAllDate(requestTimeStampDate);
            var changeTimeValue = (requestTimeStampDateAll && requestTimeStampDateAll.replace(/\D/g,""));
            var lastMod = Number(changeTimeValue) != 0 ? changeTimeValue : "";// yyyymmddhhmmss


            // 获取组织机构列表，拿第一层organizationCode和departmentId
            organizationArr = getOrganizationList_new(platformJson);
            log.audit("organizationArr",organizationArr)
            // 获取一级部门及其信息
            if(organizationArr.length) {
                _.each(organizationArr, function(organizationJson, index) {
                    // 时间段内的订单信息抓取
                    var out = requestURL({
                        platform : options.platform,
                        tranName : options.tranName,
                        apiId : "getDepartmentList_new",
                        data : {
                            "organizationCode":organizationJson.organizationCode,
                            "departmentId":organizationJson.departmentId
                        },
                        tryCount : 3,
                        platformJson : platformJson
                    });
                    if (out) {
                        out.statusCode == 200 ? out.success = true : out.success = false;
                        if (!out.success) {
                            return out;
                        }
                    }
                    var outData = out.data.list;
                    _.each(outData, function(orderInfoJson, index1) {
                        var organizationCode = orderInfoJson.organizationCode;
                        var departmentId = orderInfoJson.departmentId;
                        var name = orderInfoJson.name;
                        var code = orderInfoJson.code;
                        var hasChildren = orderInfoJson.hasChildren;
                        var leaderUserIds = (orderInfoJson.leaderUserIds)[0];
                        var description = orderInfoJson.description;
                        log.audit("description",description)
                        if(name == "平凯（北京）" || departmentId == "65efdc64708b0466c3725de2") {
                            return;
                        }


                        description = description?JSON.parse(description): {};
                        var hRBP = description.hRBP;
                        var costCenterName = description.costCenter;
                        var costCenterID
                        if(description.costCenter) {
                            costCenterID = description.costCenter.split(" ")[0];
                        }


                        // 收集所有的authing departmentId
                        options.data.authingIdArr.push(departmentId);

                        if(hasChildren == true || hasChildren == "true") {
                            firstDepartmentIdArr.push({
                                "organizationCode":organizationCode,
                                "departmentId":departmentId
                            })
                        }
                        externalidAry.push("department_"+departmentId);
                        ordersInfo[departmentId] = {
                            "code" : code,
                            "name" : name,
                            "code_name" : code+" "+name,
                            "firstOrgName": departmentId,
                            "secondOrgName": "",
                            "thirdOrgName": "",
                            "fourthOrgName": "",
                            "hRBP": hRBP,
                            "costCenterName": costCenterName,
                            "costCenterID": costCenterID,
                            "departmentId": departmentId,
                            "organizationCode": organizationCode,
                            "leaderUserIds": "",
                            "budgetUserIds":leaderUserIds,
                            "parentDp":"",
                            "lastMod": lastMod
                        };
                    });
                });
            }
            log.audit("firstDepartmentIdArr",firstDepartmentIdArr)

            // 获取二级部门及其信息
            if(firstDepartmentIdArr.length) {
                _.each(firstDepartmentIdArr, function(organizationJson, index) {
                    // 时间段内的订单信息抓取
                    var out = requestURL({
                        platform : options.platform,
                        tranName : options.tranName,
                        apiId : "getDepartmentList_new",
                        data : {
                            "organizationCode":organizationJson.organizationCode,
                            "departmentId":organizationJson.departmentId
                        },
                        tryCount : 3,
                        platformJson : platformJson
                    });
                    if (out) {
                        out.statusCode == 200 ? out.success = true : out.success = false;
                        if (!out.success) {
                            return out;
                        }
                    }

                    var outData = out.data.list;
                    _.each(outData, function(orderInfoJson, index1) {
                        var organizationCode = orderInfoJson.organizationCode;
                        var departmentId = orderInfoJson.departmentId;
                        var name = orderInfoJson.name;
                        var code = orderInfoJson.code;
                        var hasChildren = orderInfoJson.hasChildren;
                        var leaderUserIds = (orderInfoJson.leaderUserIds)[0];
                        var description = orderInfoJson.description;

                        if(name == "平凯（北京）" || departmentId == "65efdc64708b0466c3725de2") {
                            return;
                        }

                        description = description?JSON.parse(description): {};
                        var hRBP = description.hRBP;
                        var costCenterName = description.costCenter;
                        var costCenterID
                        if(description.costCenter) {
                            costCenterID = description.costCenter.split(" ")[0];
                        }
                        // 收集所有的authing departmentId
                        options.data.authingIdArr.push(departmentId);
                        if(hasChildren == true || hasChildren == "true") {
                            secondDepartmentIdArr.push({
                                "organizationCode":organizationCode,
                                "departmentId":departmentId
                            })
                        }
                        externalidAry.push("department_"+departmentId);
                        ordersInfo[departmentId] = {
                            "code" : code,
                            "name" : name,
                            "code_name" : code+" "+name,
                            "firstOrgName": organizationJson.departmentId,
                            "secondOrgName": departmentId,
                            "thirdOrgName": "",
                            "fourthOrgName": "",
                            "hRBP": hRBP,
                            "costCenterName": costCenterName,
                            "costCenterID": costCenterID,
                            "departmentId": departmentId,
                            "organizationCode": organizationCode,
                            "leaderUserIds": leaderUserIds,
                            "budgetUserIds":ordersInfo[organizationJson.departmentId]["budgetUserIds"],
                            "parentDp":ordersInfo[organizationJson.departmentId]["code"]+" "+ordersInfo[organizationJson.departmentId]["name"],
                            "lastMod": lastMod
                        };
                    });
                });
            }

            log.audit("secondDepartmentIdArr",secondDepartmentIdArr)

// 获取三级部门及其信息
            if(secondDepartmentIdArr.length) {
                _.each(secondDepartmentIdArr, function(organizationJson, index) {
                    // 时间段内的订单信息抓取
                    var out = requestURL({
                        platform : options.platform,
                        tranName : options.tranName,
                        apiId : "getDepartmentList_new",
                        data : {
                            "organizationCode":organizationJson.organizationCode,
                            "departmentId":organizationJson.departmentId
                        },
                        tryCount : 3,
                        platformJson : platformJson
                    });
                    if (out) {
                        out.statusCode == 200 ? out.success = true : out.success = false;
                        if (!out.success) {
                            return out;
                        }
                    }

                    var outData = out.data.list;
                    _.each(outData, function(orderInfoJson, index1) {
                        var organizationCode = orderInfoJson.organizationCode;
                        var departmentId = orderInfoJson.departmentId;
                        var name = orderInfoJson.name;
                        var code = orderInfoJson.code;
                        var hasChildren = orderInfoJson.hasChildren;
                        var leaderUserIds = (orderInfoJson.leaderUserIds)[0];
                        var description = orderInfoJson.description;


                        if(name == "平凯（北京）" || departmentId == "65efdc64708b0466c3725de2") {
                            return;
                        }
                        description = description?JSON.parse(description): {};
                        var hRBP = description.hRBP;
                        var costCenterName = description.costCenter;
                        var costCenterID
                        if(description.costCenter) {
                            costCenterID = description.costCenter.split(" ")[0];
                        }
                        // 收集所有的authing departmentId
                        options.data.authingIdArr.push(departmentId);
                        if(hasChildren == true || hasChildren == "true") {
                            thidrdDepartmentIdArr.push({
                                "organizationCode":organizationCode,
                                "departmentId":departmentId
                            })
                        }
                        externalidAry.push("department_"+departmentId);
                        ordersInfo[departmentId] = {
                            "code" : code,
                            "name" : name,
                            "code_name" : code+" "+name,
                            "firstOrgName": ordersInfo[organizationJson.departmentId]["firstOrgName"],
                            "secondOrgName": organizationJson.departmentId,
                            "thirdOrgName": departmentId,
                            "fourthOrgName": "",
                            "hRBP": hRBP,
                            "costCenterName": costCenterName,
                            "costCenterID": costCenterID,
                            "departmentId": departmentId,
                            "organizationCode": organizationCode,
                            "leaderUserIds": ordersInfo[organizationJson.departmentId]["leaderUserIds"],
                            "budgetUserIds":ordersInfo[ordersInfo[organizationJson.departmentId]["firstOrgName"]]["budgetUserIds"],
                            "parentDp":ordersInfo[ordersInfo[organizationJson.departmentId]["firstOrgName"]]["code"]+" "+ordersInfo[ordersInfo[organizationJson.departmentId]["firstOrgName"]]["name"]
                                +" : "+ ordersInfo[organizationJson.departmentId]["code"]+" "+ordersInfo[organizationJson.departmentId]["name"],
                            "lastMod": lastMod
                        };
                    });
                });
            }

            log.audit("thidrdDepartmentIdArr",thidrdDepartmentIdArr)

// 获取四级部门及其信息
            if(thidrdDepartmentIdArr.length) {
                _.each(thidrdDepartmentIdArr, function(organizationJson, index) {
                    // 时间段内的订单信息抓取
                    var out = requestURL({
                        platform : options.platform,
                        tranName : options.tranName,
                        apiId : "getDepartmentList_new",
                        data : {
                            "organizationCode":organizationJson.organizationCode,
                            "departmentId":organizationJson.departmentId
                        },
                        tryCount : 3,
                        platformJson : platformJson
                    });
                    if (out) {
                        out.statusCode == 200 ? out.success = true : out.success = false;
                        if (!out.success) {
                            return out;
                        }
                    }

                    var outData = out.data.list;
                    _.each(outData, function(orderInfoJson, index1) {
                        var organizationCode = orderInfoJson.organizationCode;
                        var departmentId = orderInfoJson.departmentId;
                        var name = orderInfoJson.name;
                        var code = orderInfoJson.code;
                        var hasChildren = orderInfoJson.hasChildren;
                        var leaderUserIds = (orderInfoJson.leaderUserIds)[0];
                        var description = orderInfoJson.description;


                        if(name == "平凯（北京）" || departmentId == "65efdc64708b0466c3725de2") {
                            return;
                        }
                        description = description?JSON.parse(description): {};
                        var hRBP = description.hRBP;
                        var costCenterName = description.costCenter;
                        var costCenterID
                        if(description.costCenter) {
                            costCenterID = description.costCenter.split(" ")[0];
                        }
                        // 收集所有的authing departmentId
                        options.data.authingIdArr.push(departmentId);
                        if(hasChildren == true || hasChildren == "true") {
                            fourthDepartmentIdArr.push({
                                "organizationCode":organizationCode,
                                "departmentId":departmentId
                            })
                        }

                        externalidAry.push("department_"+departmentId);
                        ordersInfo[departmentId] = {
                            "code" : code,
                            "name" : name,
                            "code_name" : code+" "+name,
                            "firstOrgName": ordersInfo[ordersInfo[organizationJson.departmentId]["secondOrgName"]]["firstOrgName"],
                            "secondOrgName": ordersInfo[organizationJson.departmentId]["secondOrgName"],
                            "thirdOrgName": organizationJson.departmentId,
                            "fourthOrgName": departmentId,
                            "hRBP": hRBP,
                            "costCenterName": costCenterName,
                            "costCenterID": costCenterID,
                            "departmentId": departmentId,
                            "organizationCode": organizationCode,
                            "leaderUserIds": ordersInfo[ordersInfo[organizationJson.departmentId]["secondOrgName"]]["leaderUserIds"],
                            "budgetUserIds":ordersInfo[ordersInfo[ordersInfo[organizationJson.departmentId]["secondOrgName"]]["firstOrgName"]]["budgetUserIds"],
                            "parentDp": ordersInfo[ordersInfo[ordersInfo[organizationJson.departmentId]["secondOrgName"]]["firstOrgName"]]["code"]+" "+ordersInfo[ordersInfo[ordersInfo[organizationJson.departmentId]["secondOrgName"]]["firstOrgName"]]["name"]
                                +" : "+ ordersInfo[ordersInfo[organizationJson.departmentId]["secondOrgName"]]["code"]+" "+ordersInfo[ordersInfo[organizationJson.departmentId]["secondOrgName"]]["name"]
                                +" : "+ ordersInfo[organizationJson.departmentId]["code"]+" "+ordersInfo[organizationJson.departmentId]["name"],
                            "lastMod": lastMod
                        };
                    });
                });
            }
            log.audit("fourthDepartmentIdArr",fourthDepartmentIdArr)


            // 给一级二级三级组织名称从部门ID换成name
            _.each(ordersInfo, function(orderInfo, departmentId) {
                if(orderInfo.firstOrgName) {
                    orderInfo.firstOrgName = ordersInfo[orderInfo.firstOrgName].name;
                }
                if(orderInfo.secondOrgName) {
                    orderInfo.secondOrgName = ordersInfo[orderInfo.secondOrgName].name;
                }
                if(orderInfo.thirdOrgName) {
                    orderInfo.thirdOrgName = ordersInfo[orderInfo.thirdOrgName].name;
                }
                if(orderInfo.fourthOrgName) {
                    orderInfo.fourthOrgName = ordersInfo[orderInfo.fourthOrgName].name;
                }
            });
            log.audit("ordersInfo",ordersInfo)


            //分页
            var resultPageArr = {};
            var totalDepartmentIdArr = Object.keys(ordersInfo);
            var totalCount = totalDepartmentIdArr.length;

            if (totalDepartmentIdArr.length) {
                var start = pageSize * (curPage - 1);
                var end = pageSize * curPage - 1;
                for (var i = start; i <= Math.min(totalDepartmentIdArr.length-1 , end); i++ ) {
                    resultPageArr[totalDepartmentIdArr[i]] = ordersInfo[totalDepartmentIdArr[i]];
                }
            }
            log.audit("resultPageArr：",resultPageArr);

            var result = {
                total : totalCount,
                success : true,
                externalidAry : _.unique(externalidAry),
                authingIdArr : _.unique(options.data.authingIdArr),
                ordersInfo : resultPageArr,
                // "_input_" : out["_input_"]
            };
            log.audit("result",result)
            return result;
        }

        // 调用authing查询组织+子部门列表 获取所有部门信息
        function getDepartmentListdata(options) {
            var ordersInfo = {}; // 总数据结构
            var externalidAry = []; // 外部id数组
            var organizationArr = []; // 组织机构列表[{"organCode","departmentId"}]
            var firstDepartmentIdArr = []; //一级部门有hasChildren ID数组[{"organCode","departmentId"}]
            var secondDepartmentIdArr = []; //二级部门有hasChildren ID数组[{"organCode","departmentId"}]
            var thidrdDepartmentIdArr = []; //三级部门有hasChildren ID数组[{"organCode","departmentId"}]
            var fourthDepartmentIdArr = []; //四级部门有hasChildren ID数组[{"organCode","departmentId"}]


            var data = options.data;
            var platformJson = options.platformJson;
            var timeStamp = options.data.timeStamp; // 时间戳
            var pageSize = options.data.pageSize;  // 一次请求多少个
            var curPage = options.data.curPage;  // 当前页

            var requestTimeStamp = timeStamp; // 时间戳
            var requestTimeStampDate = new Date(parseInt(requestTimeStamp));

            // 补零操作 yyyy/mm/dd hh:mm:ss
            var requestTimeStampDateAll = getAllDate(requestTimeStampDate);
            var changeTimeValue = (requestTimeStampDateAll && requestTimeStampDateAll.replace(/\D/g,""));
            var lastMod = Number(changeTimeValue) != 0 ? changeTimeValue : "";// yyyymmddhhmmss


            // 获取组织机构列表，拿第一层organizationCode和departmentId
            organizationArr = getOrganizationList(platformJson);
            log.audit("organizationArr",organizationArr)
            // 获取一级部门及其信息
            if(organizationArr.length) {
                _.each(organizationArr, function(organizationJson, index) {
                    // 时间段内的订单信息抓取
                    var out = requestURL({
                        platform : options.platform,
                        tranName : options.tranName,
                        apiId : "getDepartmentList",
                        data : {
                            "organizationCode":organizationJson.organizationCode,
                            "departmentId":organizationJson.departmentId
                        },
                        tryCount : 3,
                        platformJson : platformJson
                    });
                    if (out) {
                        out.statusCode == 200 ? out.success = true : out.success = false;
                        if (!out.success) {
                            return out;
                        }
                    }
                    var outData = out.data.list;
                    _.each(outData, function(orderInfoJson, index1) {
                        var organizationCode = orderInfoJson.organizationCode;
                        var departmentId = orderInfoJson.departmentId;
                        var name = orderInfoJson.name;
                        var code = orderInfoJson.code;
                        var hasChildren = orderInfoJson.hasChildren;
                        var leaderUserIds = (orderInfoJson.leaderUserIds)[0];
                        var description = orderInfoJson.description;

                        if(name == "平凯（北京）" || departmentId == "65efdc64708b0466c3725de2") {
                            return;
                        }


                        description = description?JSON.parse(description): {};
                        var hRBP = description.hRBP;
                        var costCenterName = description.costCenter;
                        var costCenterID
                        if(description.costCenter) {
                            costCenterID = description.costCenter.split(" ")[0];
                        }

                        // 收集所有的authing departmentId
                        options.data.authingIdArr.push(departmentId);

                        if(hasChildren == true || hasChildren == "true") {
                            firstDepartmentIdArr.push({
                                "organizationCode":organizationCode,
                                "departmentId":departmentId
                            })
                        }
                        externalidAry.push("department_"+departmentId);
                        ordersInfo[departmentId] = {
                            "code" : code,
                            "name" : name,
                            "code_name" : code+" "+name,
                            "firstOrgName": departmentId,
                            "secondOrgName": "",
                            "thirdOrgName": "",
                            "fourthOrgName": "",
                            "hRBP": hRBP,
                            "costCenterName": costCenterName,
                            "costCenterID": costCenterID,
                            "departmentId": departmentId,
                            "organizationCode": organizationCode,
                            "leaderUserIds": "",
                            "budgetUserIds":leaderUserIds,
                            "parentDp":"",
                            "lastMod": lastMod
                        };
                    });
                });
            }
            log.audit("firstDepartmentIdArr",firstDepartmentIdArr)

            // 获取二级部门及其信息
            if(firstDepartmentIdArr.length) {
                _.each(firstDepartmentIdArr, function(organizationJson, index) {
                    // 时间段内的订单信息抓取
                    var out = requestURL({
                        platform : options.platform,
                        tranName : options.tranName,
                        apiId : "getDepartmentList",
                        data : {
                            "organizationCode":organizationJson.organizationCode,
                            "departmentId":organizationJson.departmentId
                        },
                        tryCount : 3,
                        platformJson : platformJson
                    });
                    if (out) {
                        out.statusCode == 200 ? out.success = true : out.success = false;
                        if (!out.success) {
                            return out;
                        }
                    }

                    var outData = out.data.list;
                    _.each(outData, function(orderInfoJson, index1) {
                        var organizationCode = orderInfoJson.organizationCode;
                        var departmentId = orderInfoJson.departmentId;
                        var name = orderInfoJson.name;
                        var code = orderInfoJson.code;
                        var hasChildren = orderInfoJson.hasChildren;
                        var leaderUserIds = (orderInfoJson.leaderUserIds)[0];
                        var description = orderInfoJson.description;

                        if(name == "平凯（北京）" || departmentId == "65efdc64708b0466c3725de2") {
                            return;
                        }

                        description = description?JSON.parse(description): {};
                        var hRBP = description.hRBP;
                        var costCenterName = description.costCenter;
                        var costCenterID
                        if(description.costCenter) {
                            costCenterID = description.costCenter.split(" ")[0];
                        }

                        // 收集所有的authing departmentId
                        options.data.authingIdArr.push(departmentId);
                        if(hasChildren == true || hasChildren == "true") {
                            secondDepartmentIdArr.push({
                                "organizationCode":organizationCode,
                                "departmentId":departmentId
                            })
                        }
                        externalidAry.push("department_"+departmentId);
                        ordersInfo[departmentId] = {
                            "code" : code,
                            "name" : name,
                            "code_name" : code+" "+name,
                            "firstOrgName": organizationJson.departmentId,
                            "secondOrgName": departmentId,
                            "thirdOrgName": "",
                            "fourthOrgName": "",
                            "hRBP": hRBP,
                            "costCenterName": costCenterName,
                            "costCenterID": costCenterID,
                            "departmentId": departmentId,
                            "organizationCode": organizationCode,
                            "leaderUserIds": leaderUserIds,
                            "budgetUserIds":ordersInfo[organizationJson.departmentId]["budgetUserIds"],
                            "parentDp":ordersInfo[organizationJson.departmentId]["code"]+" "+ordersInfo[organizationJson.departmentId]["name"],
                            "lastMod": lastMod
                        };
                    });
                });
            }

            log.audit("secondDepartmentIdArr",secondDepartmentIdArr)

// 获取三级部门及其信息
            if(secondDepartmentIdArr.length) {
                _.each(secondDepartmentIdArr, function(organizationJson, index) {
                    // 时间段内的订单信息抓取
                    var out = requestURL({
                        platform : options.platform,
                        tranName : options.tranName,
                        apiId : "getDepartmentList",
                        data : {
                            "organizationCode":organizationJson.organizationCode,
                            "departmentId":organizationJson.departmentId
                        },
                        tryCount : 3,
                        platformJson : platformJson
                    });
                    if (out) {
                        out.statusCode == 200 ? out.success = true : out.success = false;
                        if (!out.success) {
                            return out;
                        }
                    }

                    var outData = out.data.list;
                    _.each(outData, function(orderInfoJson, index1) {
                        var organizationCode = orderInfoJson.organizationCode;
                        var departmentId = orderInfoJson.departmentId;
                        var name = orderInfoJson.name;
                        var code = orderInfoJson.code;
                        var hasChildren = orderInfoJson.hasChildren;
                        var leaderUserIds = (orderInfoJson.leaderUserIds)[0];
                        var description = orderInfoJson.description;


                        if(name == "平凯（北京）" || departmentId == "65efdc64708b0466c3725de2") {
                            return;
                        }
                        description = description?JSON.parse(description): {};
                        var hRBP = description.hRBP;
                        var costCenterName = description.costCenter;
                        var costCenterID
                        if(description.costCenter) {
                            costCenterID = description.costCenter.split(" ")[0];
                        }

                        // 收集所有的authing departmentId
                        options.data.authingIdArr.push(departmentId);
                        if(hasChildren == true || hasChildren == "true") {
                            thidrdDepartmentIdArr.push({
                                "organizationCode":organizationCode,
                                "departmentId":departmentId
                            })
                        }
                        externalidAry.push("department_"+departmentId);
                        ordersInfo[departmentId] = {
                            "code" : code,
                            "name" : name,
                            "code_name" : code+" "+name,
                            "firstOrgName": ordersInfo[organizationJson.departmentId]["firstOrgName"],
                            "secondOrgName": organizationJson.departmentId,
                            "thirdOrgName": departmentId,
                            "fourthOrgName": "",
                            "hRBP": hRBP,
                            "costCenterName": costCenterName,
                            "costCenterID": costCenterID,
                            "departmentId": departmentId,
                            "organizationCode": organizationCode,
                            "leaderUserIds": ordersInfo[organizationJson.departmentId]["leaderUserIds"],
                            "budgetUserIds":ordersInfo[ordersInfo[organizationJson.departmentId]["firstOrgName"]]["budgetUserIds"],
                            "parentDp":ordersInfo[ordersInfo[organizationJson.departmentId]["firstOrgName"]]["code"]+" "+ordersInfo[ordersInfo[organizationJson.departmentId]["firstOrgName"]]["name"]
                                +" : "+ ordersInfo[organizationJson.departmentId]["code"]+" "+ordersInfo[organizationJson.departmentId]["name"],
                            "lastMod": lastMod
                        };
                    });
                });
            }

            log.audit("thidrdDepartmentIdArr",thidrdDepartmentIdArr)

// 获取四级部门及其信息
            if(thidrdDepartmentIdArr.length) {
                _.each(thidrdDepartmentIdArr, function(organizationJson, index) {
                    // 时间段内的订单信息抓取
                    var out = requestURL({
                        platform : options.platform,
                        tranName : options.tranName,
                        apiId : "getDepartmentList",
                        data : {
                            "organizationCode":organizationJson.organizationCode,
                            "departmentId":organizationJson.departmentId
                        },
                        tryCount : 3,
                        platformJson : platformJson
                    });
                    if (out) {
                        out.statusCode == 200 ? out.success = true : out.success = false;
                        if (!out.success) {
                            return out;
                        }
                    }

                    var outData = out.data.list;
                    _.each(outData, function(orderInfoJson, index1) {
                        var organizationCode = orderInfoJson.organizationCode;
                        var departmentId = orderInfoJson.departmentId;
                        var name = orderInfoJson.name;
                        var code = orderInfoJson.code;
                        var hasChildren = orderInfoJson.hasChildren;
                        var leaderUserIds = (orderInfoJson.leaderUserIds)[0];
                        var description = orderInfoJson.description;


                        if(name == "平凯（北京）" || departmentId == "65efdc64708b0466c3725de2") {
                            return;
                        }
                        description = description?JSON.parse(description): {};
                        var hRBP = description.hRBP;
                        var costCenterName = description.costCenter;
                        var costCenterID
                        if(description.costCenter) {
                            costCenterID = description.costCenter.split(" ")[0];
                        }

                        // 收集所有的authing departmentId
                        options.data.authingIdArr.push(departmentId);
                        if(hasChildren == true || hasChildren == "true") {
                            fourthDepartmentIdArr.push({
                                "organizationCode":organizationCode,
                                "departmentId":departmentId
                            })
                        }

                        externalidAry.push("department_"+departmentId);
                        ordersInfo[departmentId] = {
                            "code" : code,
                            "name" : name,
                            "code_name" : code+" "+name,
                            "firstOrgName": ordersInfo[ordersInfo[organizationJson.departmentId]["secondOrgName"]]["firstOrgName"],
                            "secondOrgName": ordersInfo[organizationJson.departmentId]["secondOrgName"],
                            "thirdOrgName": organizationJson.departmentId,
                            "fourthOrgName": departmentId,
                            "hRBP": hRBP,
                            "costCenterName": costCenterName,
                            "costCenterID": costCenterID,
                            "departmentId": departmentId,
                            "organizationCode": organizationCode,
                            "leaderUserIds": ordersInfo[ordersInfo[organizationJson.departmentId]["secondOrgName"]]["leaderUserIds"],
                            "budgetUserIds":ordersInfo[ordersInfo[ordersInfo[organizationJson.departmentId]["secondOrgName"]]["firstOrgName"]]["budgetUserIds"],
                            "parentDp": ordersInfo[ordersInfo[ordersInfo[organizationJson.departmentId]["secondOrgName"]]["firstOrgName"]]["code"]+" "+ordersInfo[ordersInfo[ordersInfo[organizationJson.departmentId]["secondOrgName"]]["firstOrgName"]]["name"]
                                +" : "+ ordersInfo[ordersInfo[organizationJson.departmentId]["secondOrgName"]]["code"]+" "+ordersInfo[ordersInfo[organizationJson.departmentId]["secondOrgName"]]["name"]
                                +" : "+ ordersInfo[organizationJson.departmentId]["code"]+" "+ordersInfo[organizationJson.departmentId]["name"],
                            "lastMod": lastMod
                        };
                    });
                });
            }
            log.audit("fourthDepartmentIdArr",fourthDepartmentIdArr)


            // 给一级二级三级组织名称从部门ID换成name
            _.each(ordersInfo, function(orderInfo, departmentId) {
                if(orderInfo.firstOrgName) {
                    orderInfo.firstOrgName = ordersInfo[orderInfo.firstOrgName].name;
                }
                if(orderInfo.secondOrgName) {
                    orderInfo.secondOrgName = ordersInfo[orderInfo.secondOrgName].name;
                }
                if(orderInfo.thirdOrgName) {
                    orderInfo.thirdOrgName = ordersInfo[orderInfo.thirdOrgName].name;
                }
                if(orderInfo.fourthOrgName) {
                    orderInfo.fourthOrgName = ordersInfo[orderInfo.fourthOrgName].name;
                }
            });
            log.audit("ordersInfo",ordersInfo)


            //分页
            var resultPageArr = {};
            var totalDepartmentIdArr = Object.keys(ordersInfo);
            var totalCount = totalDepartmentIdArr.length;

            if (totalDepartmentIdArr.length) {
                var start = pageSize * (curPage - 1);
                var end = pageSize * curPage - 1;
                for (var i = start; i <= Math.min(totalDepartmentIdArr.length-1 , end); i++ ) {
                    resultPageArr[totalDepartmentIdArr[i]] = ordersInfo[totalDepartmentIdArr[i]];
                }
            }
            log.audit("resultPageArr：",resultPageArr);

            var result = {
                total : totalCount,
                success : true,
                externalidAry : _.unique(externalidAry),
                authingIdArr : _.unique(options.data.authingIdArr),
                ordersInfo : resultPageArr,
                // "_input_" : out["_input_"]
            };
            log.audit("result",result)
            return result;
        }

        // jjp5 飞书审批状态拉取
        function fsSearchAuditStatusListData(options) {
            log.audit({title:"fsSearchAuditStatusListData - out",details:options});
            var data = options.data;
            var pageSize = data.pageSize;
            var pageNo = data.pageNo;
            var instanceCodejson = data.instanceCodejson;//{prsId：[instanceCode1,instanceCode2,instanceCode3,,....],prsId2：[instanceCode1,instanceCode2,instanceCode3,,....]}
            var orderName = data.orderName;
            var approval_code = data.approval_code;
            var platformJson = options.platformJson;
            log.audit("fsSearchAuditStatusListData-instanceCodejson",instanceCodejson);
            // var out = requestURL({
            //     platform : options.platform,
            //     apiId : "getRequstAuditStatusList",
            //     data : data,
            //     tryCount : 3,
            //     platformJson : options.platformJson
            // });
            // log.audit({title:"fsSearchAuditStatusListData - out",details:JSON.stringify(out)});
            //
            // var retAutArr = [];
            // var count = out["data"]["instance_code_list"].length;
            // var instanceArr = out["data"]["instance_code_list"];
            // //分页
            //var instanceCodeArr = [];//分页后查询的JSON-当前页十条数据
            // if(count > 0){
            //     var start = pageSize * pageNo;//第几条开始
            //     var end = pageSize * (pageNo + 1);//第几条结束
            //     log.audit("start",start);
            //     log.audit("end",end);
            //     //var i =0;//代表循环数据里的每行的行号 从0开始
            //     //获取当前页十条数据
            //     for(var j = 0;j< instanceArr.length;j++) {
            //         if (start <= j && j < Math.min(count, end)) {
            //             //instanceCodeArr[index] = outDataResult;
            //             instanceCodeArr.push(instanceArr[j]);
            //         }
            //     }
            // }
            // log.audit("instanceCodeArr",instanceCodeArr);
            //
            //分页
            var start = pageSize * pageNo;//第几条开始
            var end = pageSize * (pageNo + 1);//第几条结束
            var resultPageArr = [];
            var count = Object.keys(instanceCodejson).length;
            if(count > 0){
                var j = 0;
                for(var i in instanceCodejson){
                    if(start<=j && j<Math.min(Object.keys(instanceCodejson).length,end)){
                        var resJson ={};
                        resJson["id"] = i;
                        resJson["instanceCode"] = instanceCodejson[i];
                        resultPageArr.push(resJson);
                    }
                    j++;
                }
            }

            var result = {
                "total" : count,
                "success" : true,
                "_output_" : resultPageArr,//格式：[{id:"aaa",instanceCode:[1,2,3,...]},{id:"bbb",instanceCode:[11,22,33,...]},...]
                "orderName" : orderName,
                "approval_code":approval_code
            };
            log.audit("fsSearchAuditStatusListData-result",result);
            return result;
        }

        // jjp5-1 飞书审批状态拉取
        function fsSearchAuditStatusToNSListData(options) {
            log.audit({title:"fsSearchAuditStatusToNSListData - out",details:options});
            var data = options.data;
            var pageSize = data.pageSize;
            var pageNo = data.pageNo;
            var instanceCodejson = data.instanceCodejson;//{prsId：[instanceCode1,instanceCode2,instanceCode3,,....],prsId2：[instanceCode1,instanceCode2,instanceCode3,,....]}
            var orderName = data.orderName;
            var approval_code = data.approval_code;
            var platformJson = options.platformJson;
            log.audit("fsSearchAuditStatusToNSListData-instanceCodejson",instanceCodejson);
            //分页
            var start = pageSize * pageNo;//第几条开始
            var end = pageSize * (pageNo + 1);//第几条结束
            var resultPageArr = [];
            var count = Object.keys(instanceCodejson).length;
            if(count > 0){
                var j = 0;
                for(var i in instanceCodejson){
                    if(start<=j && j<Math.min(Object.keys(instanceCodejson).length,end)){
                        var resJson ={};
                        resJson["id"] = i;
                        resJson["instanceCode"] = instanceCodejson[i];
                        resultPageArr.push(resJson);
                    }
                    j++;
                }
            }

            var result = {
                "total" : count,
                "success" : true,
                "_output_" : resultPageArr,//格式：[{id:"aaa",instanceCode:[1,2,3,...]},{id:"bbb",instanceCode:[11,22,33,...]},...]
                "orderName" : orderName,
                "approval_code":approval_code
            };
            log.audit("fsSearchAuditStatusToNSListData-result",result);
            return result;
        }

        // jjp5-1 飞书审批状态拉取
        function fsSearchAuditStatusToNSList(options) {
            var outPut = options.output._output_;//格式：[{id:"aaa",instanceCode:[1,2,3,...]},{id:"bbb",instanceCode:[11,22,33,...]},...]
            var orderName = options.output.orderName;
            var approval_code = options.output.approval_code;
            var apiCompleted = true;
            for(var i = 0; outPut.length > 0 && i < outPut.length; i++) {
                log.audit({title:"循环次数 ",details:i})
                // 创建单个飞书审批task
                createAndExecTask({
                    platform : "飞书",
                    tranName : "fsSearchAuditStatusToNS",
                    data : {
                        "orderName" : orderName,
                        "approval_code" : approval_code,
                        "instance_code" : outPut[i]["instanceCode"],
                        "id" : outPut[i]["id"],
                        "code" : outPut[i]["id"]
                    },
                    apiCompleted : false
                });
            }
        }

        // jjp5-1 审批状态拉取--通过code查询单个单据状态+
        function fsSearchAuditStatusToNSData(options) {
            log.audit({title:"fsSearchAuditStatusToNSData-output",details:JSON.stringify(options.output)});
            var data = options.data;//格式： {"instance_code" :[1,2,3],"id" : id}
            var instance_code = data.instance_code;//instance_code集合   格式： [1,2,3]
            var approval_code = data.approval_code;
            var id = data.id;//采购申请id

            var outArr = [];
            var actulPpaytime = "";//采购付款审批-付款日期
            var apwfTaxcode = "";//采购付款审批-税码
            for(var i=0;i<instance_code.length;i++){
                var auditStatus = "";
                var approverId = "";
                var buyerId = "";
                //采购申请
                if(approval_code == "FB6D2FA3-B5C3-4239-BB73-C413F23555A8"){
                    // var wfRec = record.load({id:instance_code[i],type:"customrecord_swc_pr_wf"});//采购申请审批
                    // auditStatus = wfRec.getValue({fieldId:"custrecord_prwf_status"});//审批状态
                    // approverId = wfRec.getValue({fieldId:"custrecord_prwf_approver"});//审批人
                    // buyerId = wfRec.getValue({fieldId:"custrecord_prwf_buyer"});//提交人
                    var wfJson = Commons.sechPrWfToNs(instance_code[i]);//采购申请审批
                    if(wfJson){
                        auditStatus = wfJson["status"];//审批状态
                        approverId = wfJson["approver"];//审批人
                        buyerId = wfJson["buyer"];//提交人
                    }
                }
                //供应商账单申请
                if(approval_code == "7475FE86-9720-466A-AE43-F0F79E554AA6"){
                    // var wfRec = record.load({id:instance_code[i],type:"customrecord_swc_ap_wf"});//采购付款审批
                    // auditStatus = wfRec.getValue({fieldId:"custrecord_apwf_line_status"});//审批状态
                    // approverId = wfRec.getValue({fieldId:"custrecord_apwf_approver"});//审批人
                    // buyerId = wfRec.getValue({fieldId:"custrecord_apwf_buyer"});//提交人
                    // if(!actulPpaytime){
                    //     actulPpaytime = wfRec.getValue({fieldId:"custrecord_apwf_actul_paytime"});//付款日期
                    // }
                    // if(!apwfTaxcode){
                    //     apwfTaxcode = wfRec.getValue({fieldId:"custrecord_apwf_taxcode"});//税码
                    // }
                    var apJson = Commons.sechApWfToNs(instance_code[i]);//采购付款审批
                    if(apJson){
                        auditStatus = apJson["status"];//审批状态
                        approverId = apJson["approver"];//审批人
                        buyerId = apJson["buyer"];//提交人
                        //付款日期和税码默认先取第一个
                        if(!actulPpaytime){
                            actulPpaytime = apJson["paytime"]//付款日期
                        }
                        if(!apwfTaxcode){
                            apwfTaxcode = apJson["taxcode"];//税码
                        }
                    }
                }

                var outJson = {
                    //"approval_name": bodyJson.approval_name,
                    "status" : auditStatus,
                    //"approval_code" :bodyJson.approval_code,
                    "instance_code" : instance_code[i],
                    "user_id" : approverId,
                    "buyerId" : buyerId
                };
                outArr.push(outJson);
            }
            var result = {
                "total" : instance_code.length || 0,
                "approval_code" : approval_code,
                "id" :id,
                "success" : true,
                "_output_" : outArr,
                "form" : {"actulPpaytime":actulPpaytime,"apwfTaxcode":apwfTaxcode}
            };
            return result;
        }

        // jjp5-1 飞书 审批状态拉取---修改单据状态
        function fsSearchAuditStatusToNS(options) {
            BusinessProcessing.getFsAuditStatusToNS(options);
        }

        // jjp Salesforce 单据拉取--接收并处理数据
        function getSalesforceQueryListdata(options) {
            try {
                var data = options.data;
                var pageSize = data.pageSize;
                var pageNo = data.pageNo;
                var condSubsidiary = data.condSubsidiary;//salesforce公司
                var out = requestURL({
                    platform : options.platform,
                    apiId : "getSalesforceRevrecList",
                    data : data,
                    tryCount : 3,
                    platformJson : options.platformJson
                });
                log.audit("jp- getSalesforceRevrecList 拉取订单out", JSON.stringify(out));
                if (out) {
                    out.flag == "failure" ? out.success = false : out.success = true;
                    if (!out.success) {
                        return out;
                    }
                }

                //框架代码 start
                var externalidAry = []; // 外部id数组
                //获取数据结构 示例：{"801BV000000vUMaYAM":{"order":{"orderNo":"801BV000000vUMaYAM"},"account":[{"currencyCode":"USD"}],"revrec":[]},"801BV000000LeI8YAK":{"order":{"orderNo":"801BV000000LeI8YAK"},"account":[{"currencyCode":"USD"}],"revrec":[]}}
                var ordersInfo = {};
                var outData = out.records; // 拉取数据
                _.each(outData, function (orderInfoJson, index) {

                    var order_no = orderInfoJson.Order__c;  // 销售单号
                    var account = orderInfoJson.Account__c;//客户
                    var currencyCode = orderInfoJson.CurrencyIsoCode;//货币

                    externalidAry.push("saler_order_" + order_no); // task 外部ID

                    var requestTimeStamp = data.timestamp; // 时间戳
                    var requestTimeStampDate = new Date(parseInt(requestTimeStamp));

                    // 补零操作 yyyy/mm/dd hh:mm:ss
                    var requestTimeStampDateAll = getAllDate(requestTimeStampDate);
                    var changeTimeValue = (requestTimeStampDateAll && requestTimeStampDateAll.replace(/\D/g, ""));
                    var lastMod = Number(changeTimeValue) != 0 ? changeTimeValue : "";// yyyymmddhhmmss

                    var revrec = {
                        "Id": orderInfoJson.Id,//  revrec id
                        "Product__c": orderInfoJson.Product__c,//  货品
                        "Tax__c": orderInfoJson.Tax__c,//  税率
                        "currencyCode": orderInfoJson.CurrencyIsoCode,//  货币
                        "Order__c": orderInfoJson.Order__c,//  销售订单
                        "Account__c": orderInfoJson.Account__c,//  ACCOUNT ID
                        "Status__c": orderInfoJson.Status__c,//  STATUS
                        "Name": orderInfoJson.Name,//  RevRec Number
                        "Amount__c": orderInfoJson.Amount__c,//  科目 贷记 金额
                        "CreatedDate": orderInfoJson.CreatedDate,//  创建日期
                        "Date__c": orderInfoJson.Date__c,//  日期
                        "Rate__c": orderInfoJson.Rate__c,//  税率
                        "Dedicated_Amount_USD__c": orderInfoJson.TiDB_Cloud_Dedicated_Amount__c,//  TiDB Cloud - Dedicated Amount (USD)
                        "Serverless_Amount_USD__c": orderInfoJson.TiDB_Cloud_Serverless_Amount__c,//  TiDB Cloud - Serverless Amount (USD)
                        "Support_Amount_USD__c": orderInfoJson.TiDB_Cloud_Support_Amount__c,//  TIDB Cloud - Support Amount (USD)
                        "TiDB_Cloud_Shortfall_Amount_USD__c": orderInfoJson.TiDB_Cloud_Shortfall_Amount__c// TIDB Cloud - Shortfall Amount (USD)
                    }
                    //如果销售订单编号不存在，就在ordersInfo中新增一条json，否则将Revrec数据存入对应的order下
                    if(!ordersInfo[order_no]){
                        //ordersInfo[order_no] = {"order": {orderNo: orderInfoJson.Order__c},"account":{},"revrec" : [],"collection" : [],lastMod:lastMod};
                        ordersInfo[order_no] = {"order": {orderNo: orderInfoJson.Order__c},"account":{},"revrec" : [],lastMod:lastMod};

                    }
                    ordersInfo[order_no]["revrec"].push(revrec);

                });
                //框架代码 end
                log.audit("ordersInfo",ordersInfo);

                //分页
                var ordersInfoResult = {};//分页后查询的JSON-当前页十条数据
                var ordersLength=0;//总条数
                for(var ever in ordersInfo) {
                    ordersLength++;
                }
                log.audit("ordersLength",ordersLength);
                if(ordersLength > 0){
                    log.audit("pageNo",pageNo);

                    var start = pageSize * pageNo;//第几条开始
                    var end = pageSize * (pageNo + 1);//第几条结束
                    var i =0;//代表循环数据里的每行的行号 从0开始
                    //获取当前页十条数据
                    _.each(ordersInfo, function (outDataResult, index) {
                        if(start <= i && i < Math.min(ordersLength,end)){
                            ordersInfoResult[index] = outDataResult;
                        }
                        i++;
                    });
                }
                log.audit("ordersInfoResult",ordersInfoResult);

                var result = {
                    total: ordersLength || 0,
                    "success" : true,
                    externalidAry: _.unique(externalidAry),
                    "ordersInfo" : ordersInfoResult,
                    "condSubsidiary" : condSubsidiary,
                    "trandate" :options.data.endTime,//revrec 日期(拉取接口的结束日期)
                    "_input_": out["_input_"]

                };
            }catch (e) {
                throw "getSalesforceQueryListdata-报错，报错信息："+e.message;
            }

            return result;
        }

        // jjp8  ① Navan费用报销凭证 单据拉取--接收并处理数据
        function getNavanVoucherListdata(options) {
            try {
                var data = options.data;
                //var pageSize = data.pageSize;
                //var pageNo = data.pageNo;
                log.audit("jp- getNavanVoucherList 拉取订单platform", options.platform);
                log.audit("jp- getNavanVoucherList 拉取订单data", options.data);
                var allout = [];//三个接口数据汇总后的数据
                //var now = getDate(8);
                //var newStartStr = addHours(now, -1);//当前时间往前推1天
                //var beforeHourTime = formatDate(addHours(now, -1),"yyyy-MM-dd");
                //var nowTime = formatDate(now,"yyyy-MM-dd");

                //调用三个接口 获取数据start
                options.data.reportType = "TRANSACTIONS";
                requestNavanUrl(options,allout);
                requestNavanDateUrl(options,allout);

                options.data.reportType = "MANUAL_TRANSACTIONS";
                requestNavanUrl(options,allout);
                requestNavanDateUrl(options,allout);

                // options.data.reportType = "REPAYMENTS";
                // requestNavanUrl(options,allout);
                // requestNavanDateUrl(options,allout);
                //调用三个接口 end

                //如果拉取的当前时间往前提一小时为前一天，则拉取当天和前一天的数据
                // log.audit("beforeHourTime",beforeHourTime+","+data.startTime+","+nowTime);
                // if(nowTime == data.startTime && beforeHourTime != data.startTime){
                //     log.audit("进入调用前一天数据接口",data);
                //     //调用三个接口 获取数据start
                //     //调用前一天的数据
                //     options.data.startTime = beforeHourTime;
                //     options.data.reportType = "TRANSACTIONS";
                //     requestNavanUrl(options,allout);
                //     requestNavanDateUrl(options,allout);
                //
                //     options.data.reportType = "MANUAL_TRANSACTIONS";
                //     requestNavanUrl(options,allout);
                //     requestNavanDateUrl(options,allout);
                //
                //     options.data.reportType = "REPAYMENTS";
                //     requestNavanUrl(options,allout);
                //     requestNavanDateUrl(options,allout);
                //
                //     //调用三个接口 获取数据end
                //
                // }
                log.audit("jp- getNavanVoucherList 拉取订单out", allout.length);


                var outData = [];
                var externalidAry = []; // 外部id数组
                // 手动分页
                if (allout.length) {
                    var start = data.pageSize * (data.curPage - 1);
                    var end = data.pageSize * data.curPage - 1;
                    for (var i = start; i <= Math.min(allout.length-1 , end); i++ ) {
                        outData.push(allout[i]);
                    }
                }
                var ordersInfo = {};
                _.each(outData, function(orderInfoJson, index) {

                    var requestTimeStamp = data.timeStamp; // 时间戳
                    var requestTimeStampDate = new Date(parseInt(requestTimeStamp));
                    // 补零操作 yyyy/mm/dd hh:mm:ss
                    var requestTimeStampDateAll = getAllDate(requestTimeStampDate);
                    var changeTimeValue = (requestTimeStampDateAll && requestTimeStampDateAll.replace(/\D/g,""));
                    var lastMod = Number(changeTimeValue) != 0 ? changeTimeValue : "";// yyyymmddhhmmss

                    // 流水单号
                    externalidAry.push("getNavanVoucher_"+orderInfoJson.ID);

                    ordersInfo[orderInfoJson.ID] = orderInfoJson;
                    ordersInfo[orderInfoJson.ID]["index"] = index
                    ordersInfo[orderInfoJson.ID]["lastMod"] = lastMod
                    // log.audit("ordersInfo[flowId]"+index,JSON.stringify(ordersInfo));
                    index +=1;

                });

                var result = {
                    total : allout.length || 0,
                    success : true,
                    externalidAry : _.unique(externalidAry),
                    ordersInfo : ordersInfo
                };

            log.audit("getNavanVoucherListdata-result",result);
            }catch (e) {
                throw "getNavanVoucherListdata-报错，报错信息："+e.message;
            }
            return result;
        }

        //jjp8  ② Navan费用报销凭证  对抓取回来的批量数据拆单
        function getNavanVoucherList(options) {
            log.audit("getNavanVoucherList-options", options);
            var data = options.output;
            if (!data) {
                throw "ERROR:NO_DATA";
            }
            try {
                var externalidAry = data.externalidAry;
                var ordersInfo = data.ordersInfo;
                log.audit("getNavanVoucherList-ordersInfo", ordersInfo);

                // 存放拉取销售订单listtask的外部id
                var tasksJson = checkAndGetTaskInfo(externalidAry);

                //循环接收过来的订单汇总
                _.each(ordersInfo, function (orderInfo, id) {
                    orderInfo.success = data.success || options.success;
                    //每一条汇总订单
                    // 如果delivery code 在task中存在，说明已经创建过task，如果当前lastModified 大于 task中记录的，则更新fulfill任务
                    if (tasksJson["getNavanVoucher_" + id]) {
                        var lastMod = tasksJson["getNavanVoucher_" + id].lastMod || 0;
                        var status = tasksJson["getNavanVoucher_" + id].status;
                        var curLastMod = orderInfo.lastMod;
                        var apiCompleted = true;
                        //if (curLastMod - lastMod > 0) {
                            if (status != "1" || status != "3") {
                                apiCompleted = false;
                            }
                            // 创建fulfill task
                            createAndExecTask({
                                platform: options.platform,
                                tranName: "getNavanVoucher",
                                lastModified: curLastMod,
                                output: orderInfo,
                                data: {
                                    code: id
                                },
                                apiCompleted: apiCompleted
                            });
                        //}
                    } else {
                        // 如果order-xx task 不存在需要创建task
                        createAndExecTask({
                            platform: options.platform,
                            tranName: "getNavanVoucher",
                            output: orderInfo,
                            data: {
                                code: id
                            }
                        });
                    }
                });
            }catch (e) {
                throw "getNavanVoucherList报错，报错信息："+e.message;
            }
        }

        // jjp8  ③ Navan费用报销凭证 返回单条task数据
        function getNavanVoucherdata(options) {
            log.audit("getNavanVoucherdata.output",options.output)
            return options.output;
        }

        //jjp8  ④ Navan费用报销凭证 查询业务逻辑处
        function getNavanVoucher(options) {
            BusinessProcessing.getNavanVoucher(options);
        }

        // jjp Salesforce  删除-单据拉取--接收并处理数据
        function getSalesforceDeleteListdata(options) {
            var data = options.data;
            var pageSize = data.pageSize;
            var pageNo = data.pageNo;
            //拉取日记账要删除的数据
            var revrecOut = requestURL({
                platform : options.platform,
                apiId : "deleteSalesforceRevrecList",
                data : data,
                tryCount : 3,
                platformJson : options.platformJson
            });
            log.audit("jp- deleteSalesforceRevrecList 删除订单out", JSON.stringify(revrecOut));
            // if (revrecOut) {
            //     revrecOut.flag == "failure" ? revrecOut.success = false : revrecOut.success = true;
            //     if (!revrecOut.success) {
            //         return revrecOut;
            //     }
            // }
            //拉取销售订单要删除的数据
            var orderOut = requestURL({
                platform : options.platform,
                apiId : "deleteSalesforceSaleOrderList",
                data : data,
                tryCount : 3,
                platformJson : options.platformJson
            });
            log.audit("jp- deleteSalesforceSaleOrderList 删除订单out", JSON.stringify(orderOut));
            // if (orderOut) {
            //     orderOut.flag == "failure" ? orderOut.success = false : orderOut.success = true;
            //     if (!orderOut.success) {
            //         return orderOut;
            //     }
            // }


            //框架代码 start
            var externalidAry = []; // 外部id数组
            //获取数据结构 示例：{id:{id:"id",type:"type"},id1:{id:"id1",type:"type1"}}
            var ordersInfo = {};
            //日记账数据 放入ordersInfo
            var revrecOutData = revrecOut ? revrecOut.deletedRecords : []; // 删除数据
            if(revrecOutData.length>0){
                _.each(revrecOutData, function (orderInfoJson, index) {

                    var id = orderInfoJson.id;  // id
                    var type = "revrec";//单据类型

                    externalidAry.push("revrec_" + id); // task 外部ID
                    var requestTimeStamp = data.timestamp; // 时间戳
                    var requestTimeStampDate = new Date(parseInt(requestTimeStamp));
                    // 补零操作 yyyy/mm/dd hh:mm:ss
                    var requestTimeStampDateAll = getAllDate(requestTimeStampDate);
                    var changeTimeValue = (requestTimeStampDateAll && requestTimeStampDateAll.replace(/\D/g, ""));
                    var lastMod = Number(changeTimeValue) != 0 ? changeTimeValue : "";// yyyymmddhhmmss

                    ordersInfo[id] = {"id":id,"type":type};

                });
            }

            //销售订单数据 放入ordersInfo
            var orderOutData = orderOut ? orderOut.deletedRecords : []; // 删除数据
            if(orderOutData.length>0){
                _.each(orderOutData, function (orderInfoJson, index) {

                    var id = orderInfoJson.id;  // id
                    var type = "order";//单据类型

                    externalidAry.push("order_" + id); // task 外部ID

                    var requestTimeStamp = data.timestamp; // 时间戳
                    var requestTimeStampDate = new Date(parseInt(requestTimeStamp));

                    // 补零操作 yyyy/mm/dd hh:mm:ss
                    var requestTimeStampDateAll = getAllDate(requestTimeStampDate);
                    var changeTimeValue = (requestTimeStampDateAll && requestTimeStampDateAll.replace(/\D/g, ""));
                    var lastMod = Number(changeTimeValue) != 0 ? changeTimeValue : "";// yyyymmddhhmmss

                    ordersInfo[id] = {"id":id,"type":type};

                });
            }

            //框架代码 end
            log.audit("ordersInfo",ordersInfo);

            //分页
            var ordersInfoResult = {};//分页后查询的JSON-当前页十条数据
            var ordersLength=0;//总条数
            if(ordersInfo && Object.keys(ordersInfo).length>0){
                ordersLength = Object.keys(ordersInfo).length;
                log.audit("ordersLength",ordersLength);

                var start = pageSize * pageNo;//第几条开始
                var end = pageSize * (pageNo + 1);//第几条结束
                var i =0;//代表循环数据里的每行的行号 从0开始
                //获取当前页十条数据
                _.each(ordersInfo, function (outDataResult, index) {
                    if(start <= i && i < Math.min(ordersLength,end)){
                        ordersInfoResult[index] = outDataResult;
                    }
                    i++;
                });
            }
            log.audit("ordersInfoResult",ordersInfoResult);

            var result = {
                total: ordersLength || 0,
                "success" : true,
                externalidAry: _.unique(externalidAry),
                "ordersInfo" : ordersInfoResult,
                "_input_": ordersInfo ? ordersInfo["_input_"] :ordersInfo

            };

            return result;
        }

        // jjp3 Salesforce 单据拉取--接收并处理数据（Collection-创建发票接口）
        function getSalesforceCollectionListdata(options) {
            var data = options.data;
            var pageSize = data.pageSize;
            var pageNo = data.pageNo;
            var condSubsidiary = data.condSubsidiary || "";//salesforce公司

            //框架代码 start
            var externalidAry = []; // 外部id数组
            //获取数据结构 示例：{"801BV000000vUMaYAM":{"order":{"orderNo":"801BV000000vUMaYAM"},"account":[{"currencyCode":"USD"}],"revrec":[]},"801BV000000LeI8YAK":{"order":{"orderNo":"801BV000000LeI8YAK"},"account":[{"currencyCode":"USD"}],"revrec":[]}}
            var ordersInfo = {};
            //创建存储basecode的记录  将编码存入记录中 在business里进行读取 防止List返回值过长问题
            var baseRecord =  record.create({type:"customrecord_collection_invoice_basecode",isDynamic:true});
            var j = 1;
            var baseRecordId = "";//basecode的记录id
            try{
                //20240426 删除from_marketplace！=N/A的数据 start
                //查询发票接口--通过colection的from_marketplace！=N/A时，时间使用Collections Date作为查询条件
                // var out = requestURL({
                //     platform : options.platform,
                //     apiId : "getSalesforceCollectionList",
                //     data : data,
                //     tryCount : 3,
                //     platformJson : options.platformJson
                // });
                // log.audit("jp- getSalesforceCollectionList 拉取发票订单out", JSON.stringify(out));
                // if (out) {
                //     out.flag == "failure" ? out.success = false : out.success = true;
                //     if (!out.success) {
                //         return out;
                //     }
                // }
                // var outData = out.records; // 拉取数据
                // log.audit("outData",outData);
                //
                // _.each(outData, function (orderInfoJson, index) {
                //
                //     var Id = orderInfoJson.Id;  // id
                //     externalidAry.push("invoice_" + Id); // task 外部ID
                //
                //     var requestTimeStamp = data.timestamp; // 时间戳
                //     var requestTimeStampDate = new Date(parseInt(requestTimeStamp));
                //
                //     // 补零操作 yyyy/mm/dd hh:mm:ss
                //     var requestTimeStampDateAll = getAllDate(requestTimeStampDate);
                //     var changeTimeValue = (requestTimeStampDateAll && requestTimeStampDateAll.replace(/\D/g, ""));
                //     var lastMod = Number(changeTimeValue) != 0 ? changeTimeValue : "";// yyyymmddhhmmss
                //
                //     var orderNumber = "";
                //     if(orderInfoJson.Order_Number__c){
                //         var orderNumber_1 = orderInfoJson.Order_Number__c.substring(orderInfoJson.Order_Number__c.length-18);//"<a href=\"801BV000000qv4U\" target=\"_blank\">US-OF-23061244</a>"
                //         orderNumber = orderNumber_1.slice(0,14);//US-OF-23061244
                //     }
                //     var collectionJson = {
                //         "message" : "",
                //         "Id": orderInfoJson.Id,//  id
                //         "Name": orderInfoJson.Name,//  Name
                //         "Order__c":orderInfoJson.Order__c,//订单号
                //         "Invoice_Number__c": orderInfoJson.Invoice_Number__c,//  INVOICE NUMBER
                //         "Order_Number__c": orderNumber,//  Order_Number__c
                //         "Collections_Amount__c": orderInfoJson.Collections_Amount__c,//  Collections_Amount__c
                //         "Payable_Amount__c": orderInfoJson.Payable_Amount__c,//  Payable_Amount__c
                //         "Exchange_Rate__c": orderInfoJson.Exchange_Rate__c,//  Exchange_Rate__c
                //         "From_Marketplace__c": orderInfoJson.From_Marketplace__c,//  From_Marketplace__c
                //         "Actual_Billing_Date__c": orderInfoJson.Actual_Billing_Date__c,//  Actual_Billing_Date__c
                //         "Collections_Date__c": orderInfoJson.Collections_Date__c,//  Collections_Date__c
                //         "Payable_Date__c": orderInfoJson.Payable_Date__c,//  Payable_Date__c
                //         "CollectionsStatus__c": orderInfoJson.CollectionsStatus__c,//  CollectionsStatus__c
                //         //"pdfDataArr":pdfDataArrResult//PDF文件  结构：[{fileurl:"",base64code:""},...]
                //     }
                //     ordersInfo[Id] = collectionJson;
                // });
                //20240426 删除from_marketplace！=N/A的数据 end

                //查询发票接口--通过colection的from_marketplace=N/A时，时间使用Actual Billing Date作为查询条件
                var billingDateOut = requestURL({
                    platform : options.platform,
                    apiId : "getSalesforceCollectionBillingDateList",
                    data : data,
                    tryCount : 3,
                    platformJson : options.platformJson
                });
                log.audit("jp- getSalesforceCollectionBillingDateList 拉取发票订单out", JSON.stringify(billingDateOut));
                if (billingDateOut) {
                    billingDateOut.flag == "failure" ? billingDateOut.success = false : billingDateOut.success = true;
                    if (!billingDateOut.success) {
                        return billingDateOut;
                    }
                }
                var billingDateOutData = billingDateOut.records; // 拉取数据
                _.each(billingDateOutData, function (billOrderInfoJson, index) {

                    var Id = billOrderInfoJson.Id;  // id
                    externalidAry.push("invoice_" + Id); // task 外部ID

                    var requestTimeStamp = data.timestamp; // 时间戳
                    var requestTimeStampDate = new Date(parseInt(requestTimeStamp));

                    // 补零操作 yyyy/mm/dd hh:mm:ss
                    var requestTimeStampDateAll = getAllDate(requestTimeStampDate);
                    var changeTimeValue = (requestTimeStampDateAll && requestTimeStampDateAll.replace(/\D/g, ""));
                    var lastMod = Number(changeTimeValue) != 0 ? changeTimeValue : "";// yyyymmddhhmmss

                    var orderNumber = "";
                    if(billOrderInfoJson.Order_Number__c){
                        var orderNumber_1 = billOrderInfoJson.Order_Number__c.substring(billOrderInfoJson.Order_Number__c.length-18);//"<a href=\"801BV000000qv4U\" target=\"_blank\">US-OF-23061244</a>"
                        orderNumber = orderNumber_1.slice(0,14);//US-OF-23061244
                    }
                    var billingCollectionJson = {
                        "Id": billOrderInfoJson.Id,//  id
                        "Name": billOrderInfoJson.Name,//  Name
                        "Order__c":billOrderInfoJson.Order__c,//订单号
                        "Invoice_Number__c": billOrderInfoJson.Invoice_Number__c,//  INVOICE NUMBER
                        "Tax_Rate__c": billOrderInfoJson.Tax_Rate__c,//  Tax_Rate__c
                        "Order_Number__c": orderNumber,//  Order_Number__c
                        "Collections_Amount__c": billOrderInfoJson.Collections_Amount__c,//  Collections_Amount__c
                        "Payable_Amount__c": billOrderInfoJson.Payable_Amount__c,//  Payable_Amount__c
                        "Exchange_Rate__c": billOrderInfoJson.Exchange_Rate__c,//  Exchange_Rate__c
                        "From_Marketplace__c": billOrderInfoJson.From_Marketplace__c,//  From_Marketplace__c
                        "Actual_Billing_Date__c": billOrderInfoJson.Actual_Billing_Date__c,//  Actual_Billing_Date__c
                        "Collections_Date__c": billOrderInfoJson.Collections_Date__c,//  Collections_Date__c
                        "Payable_Date__c": billOrderInfoJson.Payable_Date__c,//  Payable_Date__c
                        "CollectionsStatus__c": billOrderInfoJson.CollectionsStatus__c,//  CollectionsStatus__c
                        //"pdfDataArr":pdfDataArrResult//PDF文件  结构：[{fileurl:"",base64code:""},...]
                    }
                    ordersInfo[Id] = billingCollectionJson;


                });

                //框架代码 end
                log.audit("baseRecordId-1",baseRecordId);
                log.audit("ordersInfo",ordersInfo);

                //分页
                var ordersInfoResult = {};//分页后查询的JSON-当前页十条数据
                var ordersLength=0;//总条数
                for(var ever in ordersInfo) {
                    ordersLength++;
                }
                log.audit("ordersLength",ordersLength);
                if(ordersLength > 0){
                    log.audit("pageNo",pageNo);

                    var start = pageSize * pageNo;//第几条开始
                    var end = pageSize * (pageNo + 1);//第几条结束
                    var i =0;//代表循环数据里的每行的行号 从0开始
                    //获取当前页十条数据
                    _.each(ordersInfo, function (outDataResult, index) {
                        if(start <= i && i < Math.min(ordersLength,end)){

                            var pdfDataArr = [];//PDF数组
                            var pdfDataArrResult = [];
                            var collectionNumber = outDataResult.Name;  // Name（collectionnumber）
                            log.audit("collectionNumber",collectionNumber);
                            if(collectionNumber){
                                var pdfOut = requestURL({
                                    platform : options.platform,
                                    apiId : "getSalesforceCollectionPDFList",
                                    data : data,
                                    tryCount : 3,
                                    platformJson : options.platformJson,
                                    collectionNumber : collectionNumber
                                });
                                log.audit("pdfOut",pdfOut);
                                if(pdfOut.success == true){
                                    log.audit("filedatas",pdfOut.filedatas);
                                    if(pdfOut.filedatas.length>0){
                                        pdfDataArr = pdfOut.filedatas;
                                    }
                                }

                            }
                            //如果PDF文件存在 将数据存入baserecord中 并将对应的id存入josn中 方便最后通过id查询对应的code值
                            if(pdfDataArr.length>0){
                                for(var k = 0;k<pdfDataArr.length;k++){
                                    var pdfJson = {};
                                    pdfJson["fileurl"] = pdfDataArr[k]["fileurl"];
                                    pdfJson["base64code"] = index+"_"+j;
                                    pdfDataArrResult.push(pdfJson);
                                    baseRecord.selectNewLine({sublistId: 'recmachcustrecord_collection_invoice_basecode'});
                                    baseRecord.setCurrentSublistValue({sublistId: 'recmachcustrecord_collection_invoice_basecode', fieldId: 'custrecord_id', value: index +"_"+j});     //id
                                    // 判断字符长度超过上限1,000,000，设置文件为空
                                    if (pdfDataArr[k]["base64code"] && pdfDataArr[k]["base64code"].length > 1000000) {
                                        baseRecord.setCurrentSublistValue({sublistId: 'recmachcustrecord_collection_invoice_basecode', fieldId: 'custrecord_base64code', value: ""});     //base64code
                                    } else {
                                        baseRecord.setCurrentSublistValue({sublistId: 'recmachcustrecord_collection_invoice_basecode', fieldId: 'custrecord_base64code', value: pdfDataArr[k]["base64code"]});     //base64code
                                    }

                                    baseRecord.commitLine({sublistId: 'recmachcustrecord_collection_invoice_basecode'});
                                    j++;
                                }
                            }
                            outDataResult["pdfDataArr"] = pdfDataArrResult || [];//将PDF值放入需返回的数据里
                            ordersInfoResult[index] = outDataResult;
                        }
                        i++;
                    });
                    if(j!=1){
                        baseRecordId = baseRecord.save();
                    }
                }
                log.audit("ordersInfoResult",ordersInfoResult);

                var result = {
                    total: ordersLength || 0,
                    "success" : true,
                    externalidAry: _.unique(externalidAry),
                    "ordersInfo" : ordersInfoResult,
                    "baseRecordId" : baseRecordId,
                    "condSubsidiary" : condSubsidiary,
                    "trandate" :options.data.endTime,//revrec 日期(拉取接口的结束日期)
                    "_input_": billingDateOut["_input_"]

                };
            }
            catch (e) {
                throw e.message;
            }
            return result;
        }

        // 对抓取回来的批量数据拆单
        function getDepartmentList_new(options) {
            var data = options.output;
            if (!data) {
                throw "ERROR:NO_DATA";
            }
            var externalidAry = data.externalidAry;
            var ordersInfo = data.ordersInfo;

            // 存放销售订单task的外部id
            var tasksJson = checkAndGetTaskInfo(externalidAry);

            // ordersInfo 和 tasksJson 进行比对
            _.each(ordersInfo, function(orderInfo, departmentId)
            {

                orderInfo.success = data.success || options.success;

                // 如果delivery code 在task中存在，说明已经创建过task，如果当前lastModified 大于 task中记录的，则更新fulfill任务
                if (tasksJson["department_" + departmentId])
                {
                    var lastMod = tasksJson["department_" + departmentId].lastMod || 0;
                    var status = tasksJson["department_" + departmentId].status;
                    var curLastMod = orderInfo.lastMod;
                    var apiCompleted = true;
                    if (curLastMod - lastMod > 0)
                    {
                        if(status != "1" || status != "3")
                        {
                            apiCompleted = false;
                        }
                        // 创建fulfill task
                        createAndExecTask({
                            platform : options.platform,
                            tranName : "getDepartment_new",
                            lastModified : curLastMod,
                            output : orderInfo,
                            data : {
                                code : departmentId
                            },
                            apiCompleted : apiCompleted
                        });
                    }
                } else {
                    // 如果order-xx task 不存在需要创建task
                    createAndExecTask({
                        platform : options.platform,
                        tranName : "getDepartment_new",
                        output : orderInfo,
                        data : {
                            code : departmentId
                        }
                    });
                }
            });
        }
        // 对抓取回来的批量数据拆单
        function getDepartmentList(options) {
            var data = options.output;
            if (!data) {
                throw "ERROR:NO_DATA";
            }
            var externalidAry = data.externalidAry;
            var ordersInfo = data.ordersInfo;

            // 存放销售订单task的外部id
            var tasksJson = checkAndGetTaskInfo(externalidAry);

            // ordersInfo 和 tasksJson 进行比对
            _.each(ordersInfo, function(orderInfo, departmentId)
            {

                orderInfo.success = data.success || options.success;

                // 如果delivery code 在task中存在，说明已经创建过task，如果当前lastModified 大于 task中记录的，则更新fulfill任务
                if (tasksJson["department_" + departmentId])
                {
                    var lastMod = tasksJson["department_" + departmentId].lastMod || 0;
                    var status = tasksJson["department_" + departmentId].status;
                    var curLastMod = orderInfo.lastMod;
                    var apiCompleted = true;
                    if (curLastMod - lastMod > 0)
                    {
                        if(status != "1" || status != "3")
                        {
                            apiCompleted = false;
                        }
                        // 创建fulfill task
                        createAndExecTask({
                            platform : options.platform,
                            tranName : "getDepartment",
                            lastModified : curLastMod,
                            output : orderInfo,
                            data : {
                                code : departmentId
                            },
                            apiCompleted : apiCompleted
                        });
                    }
                } else {
                    // 如果order-xx task 不存在需要创建task
                    createAndExecTask({
                        platform : options.platform,
                        tranName : "getDepartment",
                        output : orderInfo,
                        data : {
                            code : departmentId
                        }
                    });
                }
            });
        }

        //jjp  Salesforce  对抓取回来的批量数据拆单
        function getSalesforceQueryList(options) {
            log.audit("getSalesforceQueryList-options", options);
            var data = options.output;
            if (!data) {
                throw "ERROR:NO_DATA";
            }
            try {
                var externalidAry = data.externalidAry;
                var ordersInfo = data.ordersInfo;
                log.audit("getSalesforceQueryList-ordersInfo", ordersInfo);
                var condSubsidiary = data.condSubsidiary;//salesforce公司
                var trandate = data.trandate;//日记账日期

                // 存放拉取销售订单listtask的外部id
                var tasksJson = checkAndGetTaskInfo(externalidAry);

                //循环接收过来的订单汇总
                _.each(ordersInfo, function (orderInfo, order_no) {
                    orderInfo.success = data.success || options.success;
                    //每一条汇总订单
                    // 如果delivery code 在task中存在，说明已经创建过task，如果当前lastModified 大于 task中记录的，则更新fulfill任务
                    if (tasksJson["saler_order_" + order_no]) {
                        var lastMod = tasksJson["saler_order_" + order_no].lastMod || 0;
                        var status = tasksJson["saler_order_" + order_no].status;
                        var curLastMod = orderInfo.lastMod;
                        var apiCompleted = true;
                        if (curLastMod - lastMod > 0) {
                            if (status != "1" || status != "3") {
                                apiCompleted = false;
                            }
                            // 创建fulfill task
                            createAndExecTask({
                                platform: options.platform,
                                tranName: "getSalesforceQuery",
                                lastModified: curLastMod,
                                output: orderInfo,
                                condSubsidiary :condSubsidiary,
                                trandate:trandate,
                                data: {
                                    code: order_no
                                },
                                apiCompleted: apiCompleted
                            });
                        }
                    } else {
                        // 如果order-xx task 不存在需要创建task
                        createAndExecTask({
                            platform: options.platform,
                            tranName: "getSalesforceQuery",
                            output: orderInfo,
                            condSubsidiary :condSubsidiary,
                            trandate:trandate,
                            data: {
                                code: order_no
                            }
                        });
                    }
                });
            }catch (e) {
                throw "getSalesforceQueryList报错，报错信息："+e.message;
            }
        }

        //jjp2  Salesforce 删除 对抓取回来的批量数据拆单
        function getSalesforceDeleteList(options) {
            log.audit("getSalesforceDeleteList-options", options);
            var data = options.output;
            if (!data) {
                throw "ERROR:NO_DATA";
            }
            var externalidAry = data.externalidAry;
            var ordersInfo = data.ordersInfo;

            // 存放拉取销售订单listtask的外部id
            var tasksJson = checkAndGetTaskInfo(externalidAry);

            //循环接收过来的订单汇总
            _.each(ordersInfo, function (orderInfo, order_no) {
                orderInfo.success = data.success || options.success;
                //每一条汇总订单
                // 如果delivery code 在task中存在，说明已经创建过task，如果当前lastModified 大于 task中记录的，则更新fulfill任务
                // if (tasksJson["saler_order_" + order_no]) {
                //     var lastMod = tasksJson["saler_order_" + order_no].lastMod || 0;
                //     var status = tasksJson["saler_order_" + order_no].status;
                //     var curLastMod = orderInfo.lastMod;
                //     var apiCompleted = true;
                //     if (curLastMod - lastMod > 0) {
                //         if (status != "1" || status != "3") {
                //             apiCompleted = false;
                //         }
                //         // 创建fulfill task
                //         createAndExecTask({
                //             platform: options.platform,
                //             tranName: "getSalesforceQuery",
                //             lastModified: curLastMod,
                //             output: orderInfo,
                //             data: {
                //                 code: order_no
                //             },
                //             apiCompleted: apiCompleted
                //         });
                //     }
                // } else {
                // 如果order-xx task 不存在需要创建task
                createAndExecTask({
                    platform: options.platform,
                    tranName: "getSalesforceDelete",
                    output: orderInfo,
                    data: {
                        code: order_no
                    }
                });
                // }
            });
        }

        //jjp3  Salesforce   Collection-创建发票接口--对抓取回来的批量数据拆单
        function getSalesforceCollectionList(options) {
            log.audit("getSalesforceCollectionList-options", options);
            var data = options.output;
            if (!data) {
                throw "ERROR:NO_DATA";
            }
            try {
                var condSubsidiary = data.condSubsidiary;//salesforce公司
                var externalidAry = data.externalidAry;
                var trandate = data.trandate;//日期（拉取接口的结束日期）
                var ordersInfo = data.ordersInfo;
                var baseRecordId = data.baseRecordId || "";//base记录的id值
                log.audit("baseRecordId",baseRecordId);
                // 存放拉取销售订单listtask的外部id
                var tasksJson = checkAndGetTaskInfo(externalidAry);

                //循环接收过来的订单汇总
                _.each(ordersInfo, function (orderInfo, order_no) {
                    orderInfo.success = data.success || options.success;
                    orderInfo.baseRecordId = baseRecordId;
                    //每一条汇总订单
                    // 如果delivery code 在task中存在，说明已经创建过task，如果当前lastModified 大于 task中记录的，则更新fulfill任务
                    if (tasksJson["saler_order_" + order_no]) {
                        var lastMod = tasksJson["invoice_" + order_no].lastMod || 0;
                        var status = tasksJson["invoice_" + order_no].status;
                        var curLastMod = orderInfo.lastMod;
                        var apiCompleted = true;
                        if (curLastMod - lastMod > 0) {
                            if (status != "1" || status != "3") {
                                apiCompleted = false;
                            }
                            // 创建fulfill task
                            createAndExecTask({
                                platform: options.platform,
                                tranName: "getSalesforceCollection",
                                lastModified: curLastMod,
                                output: orderInfo,
                                condSubsidiary :condSubsidiary,
                                trandate:trandate,
                                baseRecordId :baseRecordId,
                                data: {
                                    code: order_no
                                },
                                apiCompleted: apiCompleted
                            });
                        }
                    } else {
                        // 如果order-xx task 不存在需要创建task
                        createAndExecTask({
                            platform: options.platform,
                            tranName: "getSalesforceCollection",
                            output: orderInfo,
                            condSubsidiary :condSubsidiary,
                            trandate:trandate,
                            baseRecordId :baseRecordId,
                            data: {
                                code: order_no
                            }
                        });
                    }
                });
            }catch (e) {
                throw "getSalesforceCollectionList报错，报错信息："+e.message;
            }

        }

        // jjp5 飞书审批状态拉取
        function fsSearchAuditStatusList(options) {
            var outPut = options.output._output_;//格式：[{id:"aaa",instanceCode:[1,2,3,...]},{id:"bbb",instanceCode:[11,22,33,...]},...]
            var orderName = options.output.orderName;
            var approval_code = options.output.approval_code;
            var apiCompleted = true;
            for(var i = 0; outPut.length > 0 && i < outPut.length; i++) {
                log.audit({title:"循环次数 ",details:i})
                // 创建单个飞书审批task
                createAndExecTask({
                    platform : "飞书",
                    tranName : "fsSearchAuditStatus",
                    data : {
                        "orderName" : orderName,
                        "approval_code" : approval_code,
                        "instance_code" : outPut[i]["instanceCode"],
                        "id" : outPut[i]["id"],
                        "code" : outPut[i]["id"]
                    },
                    apiCompleted : false
                });
            }
        }

        // authing返回单条task数据
        function getDepartmentdata(options) {
            return options.output;
        }
        // authing返回单条task数据
        function getDepartment_newdata(options) {
            return options.output;
        }

        // jjp  Salesforce返回单条task数据
        function getSalesforceQuerydata(options) {
            //{"order":{"orderNo":"801BV000000fidYYAQ"},"account":{"currencyCode":"SGD"},"revrec":[],"collection" : [],"lastMod":"","success":true}
            var data = options.output;
            var condSubsidiary = options.condSubsidiary || "";
            var trandate = options.trandate || "";
            log.audit("getSalesforceQuerydata--options",options);
            log.audit("getSalesforceQuerydata--condSubsidiary",condSubsidiary);
            if (!data) {
                throw "ERROR:NO_DATA";
            }
            try {
                var orderId =data["order"]["orderNo"];//销售订单编号
                log.audit("getSalesforceQuerydata--orderId",orderId);
                if(!orderId){
                    throw "ERROR:NO_FIND_SALEORDER_CODE";
                }
                //查询销售订单信息接口
                var saleOrderOut = requestURL({
                    platform : options.platform,
                    apiId : "getSalesforceSaleOrderList",
                    data : data,
                    tryCount : 3,
                    platformJson : options.platformJson,
                    id:orderId,
                    condSubsidiary:condSubsidiary
                });
                if (saleOrderOut) {
                    saleOrderOut.flag == "failure" ? saleOrderOut.success = false : saleOrderOut.success = true;
                    if (!saleOrderOut.success) {
                        return saleOrderOut;
                    }
                }else {
                    return saleOrderOut;
                }
                log.audit("saleOrderOut",saleOrderOut);
                if(saleOrderOut.records.length <= 0){
                    data["order"]["message"] = "该订单不是"+condSubsidiary+"公司下的订单，不需要创建！";
                    return data;
                }
                log.audit("saleOrderOut222",saleOrderOut);
                //查询发票接口通过OrderId
                var collectionOut = requestURL({
                    platform : options.platform,
                    apiId : "getSalesforceCollectionByOrderIdList",
                    data : data,
                    tryCount : 3,
                    platformJson : options.platformJson,
                    id:orderId,
                    condSubsidiary:condSubsidiary
                });
                log.audit("collectionOut0926",collectionOut);
                //20240923 新增 start
                //如果公司主体为US或者PTE并且是N/A的情况下，增加判断是否为Stripe的收款。如果是Revrec的借方科目改为应收账款，反之与目前一样，递延收益。
                //revrec对应order的collection下的Invoice Number(接口id:Invoice_Number__c,目前Ns字段为custbody_swc_invoice_number)值中不包含“PingCAP”就是Stripe。
                data["order"]["isStrope"] = false;
                if(collectionOut){
                    log.audit("collectionOut",collectionOut);
                    var collectionOutData = collectionOut.records; // 拉取数据
                    log.audit("collectionOutData",collectionOutData);
                    log.audit("collectionOutData-type",typeof collectionOutData);

                    var invoiceNumber = "";
                    _.each(collectionOutData, function (collectionInfoJson, index) {
                        invoiceNumber = collectionInfoJson.Invoice_Number__c;  // Invoice_Number__c
                    });
                    log.audit("getSalesforceQuerydata-collection-Invoice_Number__c",invoiceNumber);
                    if((condSubsidiary == "PingCAP (US), Inc." || condSubsidiary == "PingCAP Pte. Ltd." || condSubsidiary == "all") &&
                        invoiceNumber && invoiceNumber.indexOf("PingCAP")==-1){
                        data["order"]["isStrope"] = true;
                    }
                }
                log.audit("getSalesforceQuerydata-collection-isStrope",data["order"]["isStrope"]);
                //20240923 新增 end
                data["trandate"] = trandate;//日记账 日期
                var orderRecord = saleOrderOut.records[0];//拉取的订单数据
                data["order"]["Id"] = orderRecord["Id"];//salesforce 订单id
                if(orderRecord["Order_Number__c"]){
                    var orderNumber = "";
                    if(orderRecord["Order_Number__c"].indexOf("null") == -1){
                        var orderNumber_1 = orderRecord["Order_Number__c"].substring(orderRecord["Order_Number__c"].length-18);//"<a href=\"801BV000000qv4U\" target=\"_blank\">US-OF-23061244</a>"
                        orderNumber = orderNumber_1.slice(0,14);//US-OF-23061244
                    }else {
                        var orderNumber_1 = orderRecord["Order_Number__c"].substring(orderRecord["Order_Number__c"].length-20);//"<a href=\"801BV000000qv4U\" target=\"_blank\">US-OF-23061244</a>"
                        orderNumber = orderNumber_1.slice(0,16);//null-OF-23061244
                    }
                    data["order"]["OrderNumber"] = orderNumber;//订单编号
                }else {
                    data["order"]["OrderNumber"] = "";//订单编号
                }
                data["order"]["AccountId"] = orderRecord["Account_ID__c"];//ACCOUNT ID
                data["order"]["Status"] = orderRecord["Status"];//STATUS
                data["order"]["Region__c"] = orderRecord["Region__c"];//REGION
                data["order"]["Product_Family__c"] = orderRecord["Product_Family__c"];//类别
                //data["order"]["Overall_End_Date__c"] = orderRecord["Overall_End_Date__c"];//ORDER END DATE
                data["order"]["Real_Booking_Date__c"] = orderRecord["Real_Booking_Date__c"];//Real_Booking_Date__c
                data["order"]["EffectiveDate"] = orderRecord["EffectiveDate"];//日期 - ORDER START DATE
                data["order"]["EndDate"] = orderRecord["EndDate"];//ORDER END DATE
                data["order"]["Payment_Term__c"] = orderRecord["Payment_Term__c"];//Payment Term
                data["order"]["Term__c"] = orderRecord["Term__c"];//TERM (MONTHS)
                data["order"]["CurrencyIsoCode"] = orderRecord["CurrencyIsoCode"];//货币
                data["order"]["Currency_for_Finance__c"] = orderRecord["Currency_for_Finance__c"];//货币2
                data["order"]["PingCAP_RevRec_Entity__c"] = orderRecord["PingCAP_RevRec_Entity__c"];//主要子公司
                data["order"]["Cloud_Registration_Source__c"] = orderRecord["Cloud_Registration_Source__c"];//Marketplace
                data["order"]["Net_Fees__c"] = orderRecord["Net_Fees__c"];//Net_Fees__c
                data["order"]["Cloud_Registration_Source__c"] = orderRecord["Cloud_Registration_Source__c"];
                data["order"]["OP_Paid_via_Marketplace__c"] = orderRecord["OP_Paid_via_Marketplace__c"];
                //jjp0321+合作伙伴字段功能 start
                var Partner_Name__c = "";
                var PartnerNameId = orderRecord["Partner_Name__c"];//合作伙伴 （selasforce的客户id）
                //如果合作伙伴存在，则调用客户接口，查询客户AccountId字段
                if(PartnerNameId && PartnerNameId!="null"){
                    //查询客户信息接口（根据客户id查询客户accountId接口）
                    var accountIdOut = requestURL({
                        platform : options.platform,
                        apiId : "getSalesforceAccountIdList",
                        data : data,
                        tryCount : 3,
                        platformJson : options.platformJson,
                        id:PartnerNameId
                    });
                    if (accountIdOut) {
                        accountIdOut.flag == "failure" ? accountIdOut.success = false : accountIdOut.success = true;
                    }
                    var accountIdRecord = accountIdOut.records[0];//拉取的订单数据
                    //将Partner_Name__c的客户数据存入data的partnerAccount中
                    data["partnerAccount"] = {};
                    data["partnerAccount"]["Id"] = accountIdRecord["Id"];//id
                    data["partnerAccount"]["Name"] = accountIdRecord["Name"];//name
                    data["partnerAccount"]["Region__c"] = accountIdRecord["Region__c"];//Region__c
                    data["partnerAccount"]["currency"] = data["order"]["CurrencyIsoCode"];//货币（取销售订单下的货币）
                    data["partnerAccount"]["financeCurrency"] = data["order"]["Currency_for_Finance__c"];//货币2
                    var BillingAddressJson = accountIdRecord["BillingAddress"];//BillingAddress
                    var billingAddress = "";
                    for(var j in BillingAddressJson){
                        if(BillingAddressJson[j])billingAddress += ","+BillingAddressJson[j];
                    }
                    if(billingAddress && billingAddress.slice(0,1)==",")billingAddress = billingAddress.slice(1,billingAddress.length);
                    data["partnerAccount"]["billingAddress"] = billingAddress;//地址

                    Partner_Name__c = accountIdRecord["Account_ID__c"] || "";//Account_ID__c
                }
                data["order"]["Partner_Name__c"] = Partner_Name__c;//Partner_Name__c
                //jjp0321+合作伙伴字段功能 end
                data["order"]["items"] =[];//货品集合

                var itemRecord = saleOrderOut.records[0]["Order_Products__r"]["records"];
                if(itemRecord.length>0){
                    for(var i=0;i<itemRecord.length;i++){
                        var item = {};
                        //如果金额为0 则不创建该行货品数据
                        if(!itemRecord[i]["Net_fees__c"] || Number(itemRecord[i]["Net_fees__c"]) == 0)continue;
                        item["Name"] = itemRecord[i]["Product__r"]["Name"];//货品
                        item["Quantity__c"] = itemRecord[i]["Quantity__c"];//数量
                        item["Term_Months__c"] = itemRecord[i]["Term_Months__c"];//货品-Term(Months)
                        //item["Unit_Net_Price__c"] = itemRecord[i]["Unit_Net_Price__c"];//单价
                        //item["Unit_Net_Price__c"] = orderRecord["Net_Fees__c"] || 0;//单价-去主表的Net_Fees__c字段值
                        item["Tax__c"] = itemRecord[i]["Tax__c"];//税码
                        item["Product_Code__c"] = itemRecord[i]["Product_Code__c"];//Product Code
                        item["Service_Start_Date__c"] = itemRecord[i]["Service_Start_Date__c"];//service start date
                        item["Service_End_Date__c"] = itemRecord[i]["Service_End_Date__c"];//service end date
                        item["Net_fees__c"] = itemRecord[i]["Net_fees__c"];//Net_fees__c 货品行 总金额

                        data["order"]["items"].push(item);
                    }

                }

                log.audit("getSalesforceQuerydata-- order-data",data);
                var accountId =data["order"]["AccountId"];//客户编号
                if(!accountId){
                    throw "ERROR:NO_FIND_ACCOUNT_CODE";
                }
                //查询客户信息接口
                var accountOut = requestURL({
                    platform : options.platform,
                    apiId : "getSalesforceAccountList",
                    data : data,
                    tryCount : 3,
                    platformJson : options.platformJson,
                    id:accountId
                });
                if (accountOut) {
                    accountOut.flag == "failure" ? accountOut.success = false : accountOut.success = true;
                    if (!accountOut.success) {
                        return accountOut;
                    }
                }else {
                    return accountOut;
                }
                log.audit("accountOut",accountOut);
                var accountRecord = accountOut.records[0];//拉取的订单数据
                data["account"]["Id"] = accountRecord["Id"];//id
                data["account"]["Name"] = accountRecord["Name"];//name
                //data["account"]["JigsawCompanyId"] = accountRecord["JigsawCompanyId"];//子公司
                data["account"]["Region__c"] = accountRecord["Region__c"];//Region__c
                data["account"]["currency"] = data["order"]["CurrencyIsoCode"];//货币（取销售订单下的货币）
                data["account"]["financeCurrency"] = data["order"]["Currency_for_Finance__c"];//货币2
                var BillingAddressJson = accountRecord["BillingAddress"];//BillingAddress
                log.audit("BillingAddressJson",BillingAddressJson);
                var billingAddress = "";
                for(var j in BillingAddressJson){
                    if(BillingAddressJson[j])billingAddress += ","+BillingAddressJson[j];
                }
                if(billingAddress && billingAddress.slice(0,1)==",")billingAddress = billingAddress.slice(1,billingAddress.length);
                log.audit("billingAddress",billingAddress);
                data["account"]["billingAddress"] = billingAddress;//地址

                //该接口去掉Collection发票的数据操作！
                // //查询Collection信息接口
                // var collectionOut = requestURL({
                //     platform : options.platform,
                //     apiId : "getSalesforceCollectionList",
                //     data : data,
                //     tryCount : 3,
                //     platformJson : options.platformJson,
                //     id:orderId
                // });
                // if (collectionOut) {
                //     collectionOut.flag == "failure" ? collectionOut.success = false : collectionOut.success = true;
                //     if (!collectionOut.success) {
                //         return data;
                //     }
                // }else {
                //     return data;
                // }
                // log.audit("collectionOut",collectionOut);
                // log.audit("getSalesforceQuerydata--data2",data);
                // var collectionRecord = collectionOut.records;//拉取的订单数据
                // for(var i=0;i<collectionRecord.length;i++){
                //     var collectionInfo = {};
                //     collectionInfo["Id"] = collectionRecord[i]["Id"];//id
                //     collectionInfo["Name"] = collectionRecord[i]["Name"];//
                //     //collectionInfo["Order__c"] = collectionRecord[i]["Order__c"];//
                //     //collectionInfo["Order_Number__c"] = collectionRecord[i]["Order_Number__c"];//
                //     collectionInfo["Invoice_Number__c"] = collectionRecord[i]["Invoice_Number__c"];//INVOICE NUMBER
                //     collectionInfo["Collections_Amount__c"] = collectionRecord[i]["Collections_Amount__c"];//明细金额
                //     data["collection"].push(collectionInfo);
                // }

                //var orderCurreny = orderRecord["CurrencyIsoCode"];//销售订单 币种
                var revrecArr = options.output.revrec || "";//日记账数据
                if(revrecArr.length >0){
                    for(var j=0;j<revrecArr.length;j++) {
                        var productId = revrecArr[j].Product__c;//salesforce的货品id
                        if(productId){
                            //调用货品接口 通过salesforce的货品id查询货品名称
                            var itemOut = requestURL({
                                platform : options.platform,
                                apiId : "getSalesforceItemList",
                                data : data,
                                tryCount : 3,
                                id:productId,
                                platformJson : options.platformJson
                            });
                            var itemOutData = itemOut.records[0]; // 拉取货品数据
                            if(itemOutData)revrecArr[j].Product__c = itemOutData.Name || "";//货品名称
                        }else {
                            revrecArr[j].Product__c = "";//货品名称
                        }

                        //弃用！
                        //var rate__c = revrecArr[j].Rate__c; // 税率
                        //var revrecCurreny = revrecArr[j].currencyCode; // 日记账 币种
                        //生成的时候需要判断币种与order的币种是否一致,如果不一致金额需要除Exchange Rate再设置  弃用！
                        // if(revrecCurreny != orderCurreny){
                        //     if(rate__c && Number(rate__c)!=0)revrecArr[j].Amount__c = (revrecArr[j].Amount__c)/Number(rate__c);// 借递延收益  贷主营业务收入：Amount
                        // }else {
                        //     revrecArr[j].Rate__c = "";
                        // }
                    }
                }
            }catch (e) {
                throw "getSalesforceQuerydata报错，报错信息："+e.message;
            }

            log.audit("getSalesforceQuerydata--data3",data);
            return options.output;
        }

        // jjp2  Salesforce 删除 返回单条task数据
        function getSalesforceDeletedata(options) {
            return options.output;
        }

        // jjp3  Salesforce Collection-创建发票接口 返回单条task数据
        function getSalesforceCollectiondata(options) {
            try {
                var data = options.output;
                var orderId = data.Order__c;
                var invoiceNumber = data.Invoice_Number__c;
                log.audit("jp- getSalesforceCollectiondata orderId", orderId);
                log.audit("jp- getSalesforceCollectiondata condSubsidiary", options.condSubsidiary);
                var condSubsidiary = options.condSubsidiary || "";
                var trandate = options.trandate || "";
                data["trandate"] = trandate;//日期（接口拉取的结束日期）

                if(condSubsidiary == "PingCAP Kabushiki-Kaisha"){
                    options.output.message = "该订单是"+condSubsidiary+"日本主体下的订单，不需要创建！";

                    //20240923 新增
                    //如果公司主体为US或者PTE并且是N/A的情况下，增加判断是否为Stripe的收款。如果是不抓取collection；反之不变与目前一样。
                    //collection下的Invoice Number(接口id:Invoice_Number__c,目前Ns字段为custbody_swc_invoice_number)值中不包含“PingCAP”就是Stripe。
                }else if(invoiceNumber && invoiceNumber.indexOf("PingCAP")==-1){
                    options.output.message = "公司主体为US或者PTE并且是N/A的情况下，Invoice Number为Stripe的收款，不需要创建！";
                } else {
                    //查询销售订单信息接口  判断发票下该销售订单的子公司是否是接口中选择的子公司
                    var saleOrderOut = requestURL({
                        platform : options.platform,
                        apiId : "getSalesforceSaleOrderList2",
                        data : data,
                        tryCount : 3,
                        platformJson : options.platformJson,
                        id:orderId,
                        condSubsidiary:condSubsidiary
                    });
                    log.audit("saleOrderOut",saleOrderOut);
                    if(saleOrderOut && saleOrderOut.records.length <= 0){
                        log.audit("saleOrderOut1",saleOrderOut);
                        options.output.message = "该Collection:"+options.output.Name+"对应的"+options.output.Order_Number__c+"接口查询不到。";
                        options.output.taskId = options.taskId;
                    }
                }
                //弃用！
                // else {
                //     var collectionCurreny = options.output.CurrencyIsoCode;//发票币种
                //     var orderRecord = saleOrderOut.records[0];//拉取的订单数据
                //     var orderCurreny = orderRecord.CurrencyIsoCode;//销售订单币种
                //     //生成的时候需要判断币种与order的币种是否一致,如果不一致金额需要除Exchange Rate再设置
                //     if(collectionCurreny !== orderCurreny){
                //         var exchangeRate = options.output.Exchange_Rate__c;//税率
                //         if(exchangeRate && Number(exchangeRate)!=0)options.output.Payable_Amount__c = (options.output.Payable_Amount__c)/Number(exchangeRate);
                //     }else {
                //         //如果一致 汇率赋值空（不赋值）
                //         options.output.Exchange_Rate__c = "";
                //     }
                // }
            }catch (e) {
                log.audit("saleOrderOut2",options.output);
                throw "getSalesforceCollectiondata报错，报错信息："+e.message;
            }

            return options.output;
        }

        // jjp5 审批状态拉取--通过code查询单个单据状态+
        function fsSearchAuditStatusData(options) {
            log.audit({title:"fsSearchAuditStatusData-output",details:JSON.stringify(options.output)});
            var data = options.data;//格式： {"instance_code" :[1,2,3],"id" : id}
            var instance_code = data.instance_code;//instance_code集合   格式： [1,2,3]
            var approval_code = data.approval_code;
            var id = data.id;//采购申请id

            //var status = data.task_list.status;
            // 飞书单个请求
            // var out = requestURL({
            //     platform : "飞书",
            //     apiId : "getRequstAuditStatus",
            //     data : data,
            //     tryCount : 3,
            //     platformJson : options.platformJson
            // });
            // log.audit({title:"fsSearchAuditStatusData-out",details:JSON.stringify(out)});
            // if(!out)return out;
            // var bodyJson = out.data;
            // var formJsonStr = bodyJson.form;
            // //+获取approval_code
            // var approval_code = bodyJson.approval_code;
            // var formJson;
            // if(formJsonStr != "") formJson = JSON.parse(formJsonStr);
            // var resultJson = {};
            // log.audit({title:"formJson.length",details:formJson.length});
            //
            // var serialNumber = bodyJson.serial_number;
            // var result = {
            //     "total" : 1,
            //     "success" : true,
            //     "approval_name": bodyJson.approval_name,
            //     "_output_" : formJsonStr,
            //     "status" : bodyJson.status,
            //     "approval_code" :bodyJson.approval_code,
            //     "serialNumber" : serialNumber,
            //     "instance_code" : instance_code
            // };
            // log.audit({title:"fsSearchSupplierApprovalData-result",details:result});
            // return result;
            var outArr = [];
            //【20251124 HP Start】
            var amorData = {};//维护行【Whether to amortize】【Whether to prepay】信息
            //【20251124 HP End】
            for(var i=0;i<instance_code.length;i++){
                //飞书单个请求
                var out = requestURL({
                    platform : "飞书",
                    apiId : "getRequstAuditStatus",
                    data : data,
                    instance_code:instance_code[i],
                    tryCount : 3,
                    platformJson : options.platformJson
                });
                log.audit({title:"fsSearchAuditStatusData-out",details:JSON.stringify(out)});
                //如果失败或不存在 则不赋值
                if(out && out.code != 0)continue;
                var bodyJson = out.data;
                var timeline = bodyJson.timeline;//获取审批人数组
                var form = bodyJson.form;//审批内容
                var user_id = "";
                var create_time = "0";
                //取create_time最新的时间的审批人
                if(timeline.length > 0){
                    for(var j=0;j<timeline.length;j++){
                        var cTime = timeline[j].create_time;
                        if(create_time < cTime){
                            create_time = cTime;
                            user_id = timeline[j].user_id || "";
                        }
                    }
                }
                var outJson = {
                    //"approval_name": bodyJson.approval_name,
                    "status" : bodyJson.status,
                    //"approval_code" :bodyJson.approval_code,
                    "instance_code" : instance_code[i],
                    "user_id" : user_id
                };
                outArr.push(outJson);
                //【20251124 HP Start】
                if(instance_code[i]) {
                    if('undefined' == typeof amorData[instance_code[i]]) amorData[instance_code[i]] = {};
                    var temptForm = JSON.parse(form);
                    for(var k = 0; k < temptForm.length; k++) {
                        if("widget17634611009960001" === temptForm[k].id) amorData[instance_code[i]]["prepay"] = justifyBolean(temptForm[k].value) ? true : false;
                        if("widget17634611399940001" === temptForm[k].id) amorData[instance_code[i]]["amorzation"] = justifyBolean(temptForm[k].value) ? true : false;
                        if('undefined' !== typeof amorData[instance_code[i]]["prepay"] && '' !== amorData[instance_code[i]]["prepay"] && 'undefined' !== typeof amorData[instance_code[i]]["amorzation"] && '' !== amorData[instance_code[i]]["amorzation"]) break;
                    }
                }
                //【20251124 HP End】
            }
            var result = {
                "total" : instance_code.length || 0,
                "approval_code" : approval_code,
                "id" :id,
                "success" : true,
                "_output_" : outArr,
                //【20251124 HP Start】
                "amordata" : JSON.stringify(amorData),
                //【20251124 HP End】
                "form" : form
            };
            return result;
        }

        //校验是否勾选
        function justifyBolean(val) {
            var rtn = false;
            if(val) {
                if('是' === val || 'TRUE' === String(val).toUpperCase() || 'T' === String(val).toUpperCase() || 'Y' === String(val).toUpperCase() || 'YES' === String(val).toUpperCase() || true === val) {
                    rtn = true;
                }
            }
            return rtn;
        }

        // jjp6 pingCAP Salesforce 手动创建task 生成销售订单
        function getSalesforceSaleOrderdata(options) {
            log.audit("jp- getSalesforceSaleOrderdata options", options);
        }

        // jjp6 pingCAP Salesforce 手动创建task 生成销售订单
        function getSalesforceSaleOrder(options) {
            var outputData = options.output;
            var taskRec = options.taskRec;
            var orderId = taskRec.getValue({fieldId:"custrecord_swct_input_data"});
            log.audit("jp- getSalesforceSaleOrderData orderId", orderId);
            if(!orderId)throw "请输入入参内容!";
            //查询销售订单信息接口  判断发票下该销售订单的子公司是否是接口中选择的子公司
            var saleOrderOut = requestURL({
                platform : options.platform,
                apiId : "getSalesforceSaleOrderList",
                data : outputData,
                tryCount : 3,
                platformJson : options.platformJson,
                id:orderId,
                condSubsidiary:"all"
            });
            log.audit("jp- getSalesforceSaleOrderData saleOrderOut", saleOrderOut);
            try {
                var data = {};
                if(saleOrderOut && saleOrderOut.records.length > 0){
                    var orderRecord = saleOrderOut.records[0];//拉取的订单数据
                    data["order"] = {};
                    data["order"]["Id"] = orderRecord["Id"];//salesforce 订单id
                    if(orderRecord["Order_Number__c"]){
                        var orderNumber_1 = orderRecord["Order_Number__c"].substring(orderRecord["Order_Number__c"].length-18);//"<a href=\"801BV000000qv4U\" target=\"_blank\">US-OF-23061244</a>"
                        var orderNumber = orderNumber_1.slice(0,14);//US-OF-23061244
                        data["order"]["OrderNumber"] = orderNumber;//订单编号
                    }else {
                        data["order"]["OrderNumber"] = "";//订单编号
                    }
                    data["order"]["AccountId"] = orderRecord["Account_ID__c"];//ACCOUNT ID
                    data["order"]["Status"] = orderRecord["Status"];//STATUS
                    data["order"]["Region__c"] = orderRecord["Region__c"];//REGION
                    data["order"]["Product_Family__c"] = orderRecord["Product_Family__c"];//类别
                    data["order"]["EffectiveDate"] = orderRecord["EffectiveDate"];//日期 - ORDER START DATE
                    data["order"]["EndDate"] = orderRecord["EndDate"];//ORDER END DATE
                    data["order"]["Payment_Term__c"] = orderRecord["Payment_Term__c"];//Payment Term
                    data["order"]["Term__c"] = orderRecord["Term__c"];//TERM (MONTHS)
                    data["order"]["CurrencyIsoCode"] = orderRecord["CurrencyIsoCode"];//货币
                    data["order"]["PingCAP_RevRec_Entity__c"] = orderRecord["PingCAP_RevRec_Entity__c"];//主要子公司
                    data["order"]["Cloud_Registration_Source__c"] = orderRecord["Cloud_Registration_Source__c"];//Marketplace
                    data["order"]["Net_Fees__c"] = orderRecord["Net_Fees__c"];//Net_Fees__c

                    data["order"]["items"] =[];//货品集合

                    var itemRecord = saleOrderOut.records[0]["Order_Products__r"]["records"];
                    if(itemRecord.length>0){
                        for(var i=0;i<itemRecord.length;i++){
                            var item = {};
                            //如果金额为0 则不创建该行货品数据
                            if(!itemRecord[i]["Net_fees__c"] || Number(itemRecord[i]["Net_fees__c"]) == 0)continue;
                            item["Name"] = itemRecord[i]["Product__r"]["Name"];//货品
                            item["Quantity__c"] = itemRecord[i]["Quantity__c"];//数量
                            item["Term_Months__c"] = itemRecord[i]["Term_Months__c"];//货品-Term(Months)
                            //item["Unit_Net_Price__c"] = itemRecord[i]["Unit_Net_Price__c"];//单价
                            //item["Unit_Net_Price__c"] = orderRecord["Net_Fees__c"] || 0;//单价-去主表的Net_Fees__c字段值
                            item["Tax__c"] = itemRecord[i]["Tax__c"];//税码
                            item["Product_Code__c"] = itemRecord[i]["Product_Code__c"];//Product Code
                            item["Service_Start_Date__c"] = itemRecord[i]["Service_Start_Date__c"];//service start date
                            item["Service_End_Date__c"] = itemRecord[i]["Service_End_Date__c"];//service end date
                            item["Net_fees__c"] = itemRecord[i]["Net_fees__c"];//Net_fees__c 货品行 总金额
                            data["order"]["items"].push(item);
                        }

                    }

                    var Partner_Name__c = "";
                    var PartnerNameId = orderRecord["Partner_Name__c"];//合作伙伴 （selasforce的客户id）
                    //如果合作伙伴存在，则调用客户接口，查询客户AccountId字段
                    if(PartnerNameId && PartnerNameId!="null"){
                        //查询客户信息接口
                        var accountIdOut = requestURL({
                            platform : options.platform,
                            apiId : "getSalesforceAccountIdList",
                            data : outputData,
                            tryCount : 3,
                            platformJson : options.platformJson,
                            id:PartnerNameId
                        });
                        if (accountIdOut) {
                            accountIdOut.flag == "failure" ? accountIdOut.success = false : accountIdOut.success = true;
                        }
                        var accountIdRecord = accountIdOut.records[0];//拉取的订单数据
                        //将Partner_Name__c的客户数据存入data的partnerAccount中
                        data["partnerAccount"] = {};
                        data["partnerAccount"]["Id"] = accountIdRecord["Id"];//id
                        data["partnerAccount"]["Name"] = accountIdRecord["Name"];//name
                        data["partnerAccount"]["Region__c"] = accountIdRecord["Region__c"];//Region__c
                        data["partnerAccount"]["currency"] = data["order"]["CurrencyIsoCode"];//货币（取销售订单下的货币）
                        data["partnerAccount"]["financeCurrency"] = data["order"]["Currency_for_Finance__c"];//货币2
                        var BillingAddressJson = accountIdRecord["BillingAddress"];//BillingAddress
                        var billingAddress = "";
                        for(var j in BillingAddressJson){
                            if(BillingAddressJson[j])billingAddress += ","+BillingAddressJson[j];
                        }
                        if(billingAddress && billingAddress.slice(0,1)==",")billingAddress = billingAddress.slice(1,billingAddress.length);
                        data["partnerAccount"]["billingAddress"] = billingAddress;//地址

                        Partner_Name__c = accountIdRecord["Account_ID__c"] || "";//Account_ID__c
                    }
                    data["order"]["Partner_Name__c"] = Partner_Name__c;//Partner_Name__c

                    var accountId =data["order"]["AccountId"];//客户编号
                    if(!accountId){
                        throw "ERROR:NO_FIND_ACCOUNT_CODE";
                    }
                    //查询客户信息接口
                    var accountOut = requestURL({
                        platform : options.platform,
                        apiId : "getSalesforceAccountList",
                        data : outputData,
                        tryCount : 3,
                        platformJson : options.platformJson,
                        id:accountId
                    });
                    if (accountOut) {
                        accountOut.flag == "failure" ? accountOut.success = false : accountOut.success = true;
                        if (!accountOut.success) {
                            return accountOut;
                        }
                    }else {
                        return accountOut;
                    }
                    log.audit("accountOut",accountOut);
                    var accountRecord = accountOut.records[0];//拉取的订单数据
                    data["account"] = {};
                    data["account"]["Id"] = accountRecord["Id"];//id
                    data["account"]["Name"] = accountRecord["Name"];//name
                    //data["account"]["JigsawCompanyId"] = accountRecord["JigsawCompanyId"];//子公司
                    data["account"]["Region__c"] = accountRecord["Region__c"];//Region__c
                    data["account"]["currency"] = data["order"]["CurrencyIsoCode"];//货币（取销售订单下的货币）
                    var BillingAddressJson = accountRecord["BillingAddress"];//BillingAddress
                    log.audit("BillingAddressJson",BillingAddressJson);
                    var billingAddress = "";
                    for(var j in BillingAddressJson){
                        if(BillingAddressJson[j])billingAddress += ","+BillingAddressJson[j];
                    }
                    if(billingAddress && billingAddress.slice(0,1)==",")billingAddress = billingAddress.slice(1,billingAddress.length);
                    log.audit("billingAddress",billingAddress);
                    data["account"]["billingAddress"] = billingAddress;//地址

                }
                log.audit("getSalesforceSaleOrder-- order-data",data);
                options.output =data;

                taskRec.setValue({fieldId:"custrecord_swct_output",value:JSON.stringify(data)});
            }catch (e) {
                throw e.message;
            }
            BusinessProcessing.getSalesforceSaleOrder(options);

        }

        // jjp7 pingCAP费用报销生成日记账
        function exReportToJournalListdata(options){
            try {
                var data = options.data;
                var platformJson = options.platformJson;
                //查询所有未推送的货品ids
                var idsArr = Commons.srchExreportIDsByjournalIsNull();
                log.audit("exReportToJournalListdata-out",idsArr);

                var outData = [];
                var externalidAry = []; // 外部id数组
                // 手动分页
                if (idsArr.length) {
                    var start = data.pageSize * (data.curPage - 1);
                    var end = data.pageSize * data.curPage - 1;
                    for (var i = start; i <= Math.min(idsArr.length-1 , end); i++ ) {
                        outData.push(idsArr[i]);
                    }
                }
                log.audit("exReportToJournalListdata-outData",outData);
                var ordersInfo = {};
                _.each(outData, function(orderId, index) {

                    var requestTimeStamp = data.timeStamp; // 时间戳
                    var requestTimeStampDate = new Date(parseInt(requestTimeStamp));
                    // 补零操作 yyyy/mm/dd hh:mm:ss
                    var requestTimeStampDateAll = getAllDate(requestTimeStampDate);
                    var changeTimeValue = (requestTimeStampDateAll && requestTimeStampDateAll.replace(/\D/g,""));
                    var lastMod = Number(changeTimeValue) != 0 ? changeTimeValue : "";// yyyymmddhhmmss

                    // 流水单号
                    externalidAry.push("exReportToJournal_"+orderId);
                    ordersInfo[orderId] = {};
                    ordersInfo[orderId]["orderId"] = orderId;
                    ordersInfo[orderId]["index"] = index
                    ordersInfo[orderId]["lastMod"] = lastMod
                    index +=1;

                });

                var result = {
                    total : idsArr.length || 0,
                    success : true,
                    externalidAry : _.unique(externalidAry),
                    ordersInfo : ordersInfo
                };
            }catch (e) {
                throw "exReportToJournalListdata方法报错,错误信息：" + e.message;
            }
            log.audit("exReportToJournalListdata-result",result);
            return result;
        }

        //jjp7 pingCAP费用报销生成日记账 对抓取回来的批量数据拆单
        function exReportToJournalList(options){
            var data = options.output;
            if (!data) {
                throw "ERROR:NO_DATA";
            }
            var externalidAry = data.externalidAry;
            var ordersInfo = data.ordersInfo;

            // 存放订单task的外部id
            var tasksJson = checkAndGetTaskInfo(externalidAry);
            // ordersInfo 和 tasksJson 进行比对
            _.each(ordersInfo, function(orderInfo, flowId)
            {
                orderInfo.success = data.success || options.success;
                // 如果delivery code 在task中存在，说明已经创建过task，如果当前lastModified 大于 task中记录的，则更新fulfill任务
                if (tasksJson["exReportToJournal_" + flowId])
                {
                    var lastMod = tasksJson["exReportToJournal_" + flowId].lastMod || 0;
                    var status = tasksJson["exReportToJournal_" + flowId].status;
                    var curLastMod = orderInfo.lastMod;
                    var apiCompleted = true;
                    if (curLastMod - lastMod > 0)
                    {
                        if(status != "1" || status != "3")
                        {
                            apiCompleted = false;
                        }
                        // 创建fulfill task
                        createAndExecTask({
                            platform : options.platform,
                            tranName : "exReportToJournal",
                            lastModified : curLastMod,
                            output : orderInfo.orderId,
                            data : {
                                code : flowId
                            },
                            apiCompleted : apiCompleted
                        });
                    }
                } else {
                    // 如果order-xx task 不存在需要创建task
                    createAndExecTask({
                        platform : options.platform,
                        tranName : "exReportToJournal",
                        output : orderInfo.orderId,
                        data : {
                            code : flowId
                        }
                    });
                }
            });
        }

        // jjp7 pingCAP费用报销生成日记账 表体字段拉取拼接到表头字段json中
        function exReportToJournaldata(options){
            log.audit("exReportToJournaldata.output",options.output)
            var result = {
                "success" : true,
                "_output_" : options.output,
            };
            return result;
        }

        // jjp7   pingCAP费用报销生成日记账 生成单据
        function exReportToJournal(options) {
            log.audit("exReportToJournal.options",options)
            BusinessProcessing.createExReportToJournal(options);
        }

        // authing部门同步业务逻辑处
        function getDepartment(options) {
            BusinessProcessing.getDepartment(options);
        }

        // authing部门同步业务逻辑处
        function getDepartmen_new(options) {
            BusinessProcessing.getDepartment_new(options);
        }

        // Salesforce查询业务逻辑处
        function getSalesforceQuery(options) {
            BusinessProcessing.getSalesforceQuery(options);
        }

        // Salesforce 删除 业务逻辑处
        function getSalesforceDelete(options) {
            BusinessProcessing.getSalesforceDelete(options);
        }

        // Salesforce Collection-创建发票接口 业务逻辑处
        function getSalesforceCollection(options) {
            BusinessProcessing.getSalesforceCollection(options);
        }

        // jjp5 飞书 审批状态拉取---修改单据状态
        function fsSearchAuditStatus(options) {
            BusinessProcessing.getFsAuditStatus(options);
        }

        /**
         * 金蝶云星空 凭证查询接口
         * @param options
         */
        function getKingdeeVoucherListData(options) {
            var data = options.data.reqData;
            var logicData = options.data.logicData;

            var platformJson = options.platformJson;

            // 时间段内的订单信息抓取
            var out = requestURL({
                platform: options.platform,
                tranName: options.tranName,
                apiId: "getKingdeeVoucherList",
                data: data,
                tryCount: 3,
                platformJson: platformJson
            });
            if (out) {
                out.flag == "failure" ? out.success = false : out.success = true;
                if (!out.success) {
                    return out;
                }
            }

            var outData = out;
            var ordersInfo = {
                kingdeeData: {},     // 金蝶接口响应数据
                logicData: logicData // 业务逻辑数据
            };

            // 根据公司、凭证编号执行数据分组 {"公司": {"凭证编号": {}, ...}, ...}
            var dataGroup = {};
            _.each(outData, function (voucher) {
                // [凭证编号,子公司,币别,过账日期,摘要,科目编码,借贷方向,借方金额,贷方金额]
                var fBillNo = voucher[11]; // 凭证编号

                var requestTimeStamp = data.timestamp; // 时间戳
                var requestTimeStampDate = new Date(parseInt(requestTimeStamp));

                // 补零操作 yyyy/mm/dd hh:mm:ss
                var requestTimeStampDateAll = getAllDate(requestTimeStampDate);
                var changeTimeValue = (requestTimeStampDateAll && requestTimeStampDateAll.replace(/\D/g, ""));
                var lastMod = Number(changeTimeValue) != 0 ? changeTimeValue : "";// yyyymmddhhmmss

                // 当前公司数据不存在的场合，初始化公司编号
                if (!dataGroup.hasOwnProperty(voucher[1])) {
                    dataGroup[voucher[1]] = {};
                }
                // 当前凭证编号不存在的场合，初始化凭证编号
                if (!dataGroup[voucher[1]].hasOwnProperty(fBillNo)) {
                    // 设置单据头数据
                    dataGroup[voucher[1]][fBillNo] = {
                        fBillNo: fBillNo,
                        fAccBookOrgId: voucher[1],  // 子公司
                        fCurrencyId: voucher[2],    // 币别
                        fPostDate: voucher[3],      // 过账日期
                        sublist: [],                // 单据体数据
                        lastMod:lastMod,            // 请求时候的时间yyyymmddhhmmss
                        exeDate: logicData.exeDate, // 执行时间
                        person: logicData.person,   // 执行时间
                        fDate: voucher[9],          // 日期
                        voucherCount: logicData["voucherCount"][voucher[1] + "_" + fBillNo], // 凭证明细条数
                    }
                }

                var costCenter = "";
                if (voucher[15]) {
                    costCenter = voucher[15]; // 部门编码
                }

                // 定义单据体数据
                var sublist = {
                    fExplanation: voucher[4], // 摘要
                    fAccountId: voucher[5],   // 科目编码
                    fDc: voucher[6],          // 借贷方向
                    fDebit: voucher[7],       // 借方金额
                    fCredit: voucher[8],      // 贷方金额
                    fNumber: voucher[10],     // 凭证明细该字段存在值的场合，当前凭证不作成日记账
                    domesticVen: voucher[12], // 国内供应商
                    domesticCus: voucher[13], // 国内客户
                    bankAcct: voucher[14],    // 银行账户
                    costCenter: costCenter,   // 消费中心
                    fCurrencyId: voucher[2],  // 货币
                    fExchangeRate: voucher[17], // 外汇兑换率
                    project: voucher[18]      // 项目
                }
                // 设置单据体数据
                dataGroup[voucher[1]][fBillNo]["sublist"].push(sublist);
            });

            // 取得分组数据全部凭证编号数据 {"公司": {"凭证编号": {}, ...}, ...}
            Object.keys(dataGroup).forEach(function (company) {
                Object.keys(dataGroup[company]).forEach(function (voucher) {
                    // 凭证编号数据
                    ordersInfo["kingdeeData"][company + "_" + voucher] = dataGroup[company][voucher];
                });
            });

            var result = {
                total: out.length || 0,
                success: true,
                ordersInfo: ordersInfo,
                "_input_": out["_input_"],
            };
            return result;
        }

        function getKingdeeVoucherList(options) {
            var data = options.output;
            if (!data) {
                throw "ERROR:NO_DATA";
            }
            var kingdeeData = data.ordersInfo.kingdeeData;
            var logicData = data.ordersInfo.logicData;


            _.each(kingdeeData, function (value, voucher) {

                value.success = data.success || options.success;

                // 如果order-xx task 不存在需要创建task
                createAndExecTask({
                    platform: options.platform,
                    tranName: "getKingdeeVoucher",
                    output: {kingdeeData: value, logicData: logicData},
                    data: {
                        code: voucher
                    }
                });
            });
        }

        function getKingdeeVoucherData(options) {
            options.output["success"] = true;
            return options.output;
        }

        // 金蝶云星空 凭证查询接口
        function getKingdeeVoucher(options) {
            BusinessProcessing.getKingdeeVoucher(options);
        }

        function updSalesforceCollectionListData(options) {
            var data = options.data;

            var timeStamp = options.data.timeStamp; // 时间戳
            var externalidAry = []; // 外部id数组


            var ordersInfo = {};

            _.each(data.invoiceObj, function(value, key) {
                var requestTimeStamp = timeStamp; // 时间戳
                var requestTimeStampDate = new Date(parseInt(requestTimeStamp));

                // 补零操作 yyyy/mm/dd hh:mm:ss
                var requestTimeStampDateAll = getAllDate(requestTimeStampDate);
                var changeTimeValue = (requestTimeStampDateAll && requestTimeStampDateAll.replace(/\D/g,""));
                var lastMod = Number(changeTimeValue) != 0 ? changeTimeValue : "";// yyyymmddhhmmss

                externalidAry.push("invoice_upd_salesforce" + key);

                // {"内部Id": {"collAmt": "已支付金额", "collDate": "Collections Date", "collStatus": "Collections Status", "remainAmt": "发票未结清金额", "collId": "record id"}, ...}
                ordersInfo[key] = value;
                ordersInfo[key]["lastMod"] = lastMod;
            });

            var result = {
                total : Object.keys(data.invoiceObj).length || 0,
                success : true,
                externalidAry : _.unique(externalidAry),
                ordersInfo : ordersInfo,
                // "_input_" : out["_input_"]
            };
            return result;
        }

        function updSalesforceCollectionList(options) {
            var data = options.output;
            if (!data) {
                throw "ERROR:NO_DATA";
            }
            var externalidAry = data.externalidAry;
            var tasksJson = checkAndGetTaskInfo(externalidAry);

            var ordersInfo = data.ordersInfo;
            // ordersInfo 和 tasksJson 进行比对
            _.each(ordersInfo, function(orderInfo, key)
            {

                orderInfo.success = data.success || options.success;

                // 如果delivery code 在task中存在，说明已经创建过task，如果当前lastModified 大于 task中记录的，则更新fulfill任务
                if (tasksJson["invoice_upd_salesforce" + key])
                {
                    var lastMod = tasksJson["invoice_upd_salesforce" + key].lastMod || 0;
                    var status = tasksJson["invoice_upd_salesforce" + key].status;
                    var curLastMod = orderInfo.lastMod;
                    var apiCompleted = true;
                    if (curLastMod - lastMod > 0)
                    {
                        if(status != "1" || status != "3")
                        {
                            apiCompleted = false;
                        }
                        // 创建fulfill task
                        createAndExecTask({
                            platform : options.platform,
                            tranName : "updSalesforceCollection",
                            lastModified : curLastMod,
                            output : orderInfo,
                            data : {
                                code : key
                            },
                            apiCompleted : apiCompleted
                        });
                    }
                } else {
                    // 如果order-xx task 不存在需要创建task
                    createAndExecTask({
                        platform : options.platform,
                        tranName : "updSalesforceCollection",
                        output : orderInfo,
                        data : {
                            code : key
                        }
                    });
                }
            });
        }

        function updSalesforceCollectionData(options) {
            var data = options.output;
            if (!data) {
                throw "ERROR:NO_DATA";
            }
            var result = requestURL({
                platform : options.platform,
                apiId : "updSalesforceCollection",
                data : data,
                tryCount : 3,
                platformJson : options.platformJson
            });

            // 响应体存在内容的场合，更新失败
            if (result && Object.keys(result).length) {
                // 根据ID更新发票推送失败状态
                var invoiceRec = record.load({type: "invoice", id: options.data.code});
                // 推送COLLECTION状态=fasle;
                invoiceRec.setValue({fieldId: "custbody_swc_collection_flag", value: false});
                invoiceRec.save();

                throw result;
            }

            options.output["success"] = true;
            return options.output;
        }

        function updSalesforceCollection(options) {
            BusinessProcessing.updSalesforceCollection(options);
        }

        function checkAndGetTaskInfo(externalidAry)
        {
            var tasksJson = {};
            if (externalidAry && externalidAry.length)
            {
                var mySearch = search.create({
                    type:"customrecord_swc_task",
                    filters:[[ "externalid", "anyof", externalidAry]],
                    columns:
                        [
                            search.createColumn({name:"custrecord_swct_api_last_modified"}),
                            search.createColumn({name:"custrecord_swct_status"}),
                            search.createColumn({name:"externalid"}),
                            search.createColumn({name: "custrecord_swct_api_completed", label: "接口调用执行完成"}),
                            search.createColumn({name: "custrecord_swct_output", label: "响应参数"})
                        ]
                });
                var results = Commons.getAllResults(mySearch);
                _.each(results, function(result) {
                    var externalId = result.getValue("externalid");
                    tasksJson[externalId] = {
                        lastMod : result.getValue("custrecord_swct_api_last_modified"),
                        status : result.getValue("custrecord_swct_status"),
                        completed : result.getValue("custrecord_swct_api_completed"),
                        output : result.getValue("custrecord_swct_output"),
                        taskId : result.id
                    }
                });
            }
            return tasksJson;
        }
        function lastModified()
        {
            var now = getDate(TIME_ZONE_OFFSET);
            return formatDate(now, "yyyyMMddhhmmss");
        }

        /**end*************************PluginTrans****************************end**/

        /**start***********************TaskLib**********************************start**/
        /**
         * @param options
         * @param {boolean} options.isNotSetExtId 补丁：不设置task的外部id标识，默认false，设定外部id。
         */
        function createTask(options)
        {
            var scriptObj = runtime.getCurrentScript();
            var remUsage0 = scriptObj.getRemainingUsage();
            var platform = options.platform;
            var tranName = options.tranName;
            var load = options.load; // load为true，表示如果task 存在，则加载
            var data = options.data;
            var soLogo = options.soLogo;
            var output = options.output;
            var input = output && output["_input_"];
            var platformCode = data && data.code || options.code || output.code;// platform_code
            var apiCompleted = options.apiCompleted || false;
            var apiLastModified = options.lastModified || 0; // api 最后更新日期
            var externalId = tranName + "_" + platformCode;
            var status = execCompleted == true ? "1" : "";
            status = soLogo ? "4" : status;
            var isNotSetExtId = options.isNotSetExtId;

            // 立即执行完成:不需要执行tran 方法，而是直接设置为执行完成
            var execCompleted = (options.execCompleted == true);

            // 补丁：金蝶云星空凭证拉取，无外部ID
            if (tranName == "getKingdeeVoucher") {
                // 创建task
                taskRec = record.create({type:"customrecord_swc_task"});
                // 设置task 参数
                Commons.setFieldsValues(taskRec, {
                    "custrecord_swct_platform" : platform,
                    "custrecord_swct_tran_name" : tranName
                }, true);
                Commons.setFieldsValues(taskRec, {
                    // "custrecord_swst_platform" : platform,
                    "custrecord_swct_input_data" : data,
                    "custrecord_swct_input" : input,
                    "custrecord_swct_output" : output,
                    "custrecord_swct_api_completed" : apiCompleted == true ? "T" : "F",
                    "custrecord_swct_api_last_modified" : apiLastModified,
                    // execComplteted 相关处理
                    "custrecord_swct_exec_completed" : execCompleted == true ? "T" : "F",
                    "custrecord_swct_status" : status
                }, false, true);
                options.taskId = taskRec.save({enableSourcing:true,ignoreMandatoryFields:true});
                return;
            }
            // 补丁：SS脚本执行的场合，设置生成task list不设定外部id
            if (isNotSetExtId) {
                externalId = "";
            } else {
                // 检索task 是否存在，如果存在则退出
                var taskId = Commons.searchByExternalId(externalId, "customrecord_swc_task");
                var taskRec = null;
                if (taskId) {
                    options.taskId = taskId;
                    // if(!load) return;
                    taskRec = options.taskRec = record.load({type:"customrecord_swc_task", id:taskId});

                    var curLastModified = taskRec.getValue({fieldId:"custrecord_swct_api_last_modified"}) || 0;
                    // var output = taskRec.getFieldValue("custrecord_swst_output");
                    // options.output = output&&JSON.parse(output);

                    if (apiLastModified - curLastModified >= 0) { // 有更新

                        Commons.setFieldsValues(taskRec, { // 清理执行环境
                            // "custrecord_swst_platform" : platform,
                            "externalid" : externalId,
                            "custrecord_swct_input_data" : data,
                            "custrecord_swct_input" : input,
                            "custrecord_swct_output" : output,
                            "custrecord_swct_api_completed" : apiCompleted == true ? "T" : "F",
                            "custrecord_swct_api_error_count" : "0",
                            "custrecord_swct_api_last_modified" : apiLastModified,
                            "custrecord_swct_exec_completed" : execCompleted == true ? "T" : "F", // 需要重新执行
                            "custrecord_swct_exec_error_count" : "0",
                            "custrecord_swct_status" : status // task状态清空
                        }, false, true);
                    }
                    return;
                }
            }

            // 创建task
            taskRec = record.create({type:"customrecord_swc_task"});
            // 设置task 参数
            Commons.setFieldsValues(taskRec, {
                "custrecord_swct_platform" : platform,
                "custrecord_swct_tran_name" : tranName
            }, true);
            Commons.setFieldsValues(taskRec, {
                // "custrecord_swst_platform" : platform,
                "externalid" : externalId,
                "custrecord_swct_input_data" : data,
                "custrecord_swct_input" : input,
                "custrecord_swct_output" : output,
                "custrecord_swct_api_completed" : apiCompleted == true ? "T" : "F",
                "custrecord_swct_api_last_modified" : apiLastModified,
                // execComplteted 相关处理
                "custrecord_swct_exec_completed" : execCompleted == true ? "T" : "F",
                "custrecord_swct_status" : status
            }, false, true);
            options.taskId = taskRec.save({enableSourcing:true,ignoreMandatoryFields:true});
            log.audit({title:"create task used",details:remUsage0 - scriptObj.getRemainingUsage()})
        }

        function execTask(options)
        {
            var scriptObj = runtime.getCurrentScript();
            var tryErrorCount = getGlobalVariable(null, "TASK_TRY_ERR_COUNT")||3;
            var remUsage0 = scriptObj.getRemainingUsage();
            var taskId = options.taskId;
            var isSchedule = options.isSchedule;
            if (!taskId) {
                return;
            }
            var taskRec = options.taskRec || record.load({type:"customrecord_swc_task", id:taskId});
            var status = taskRec.getValue({fieldId:"custrecord_swct_status"});
            var apiCompleted = options.apiCompleted || taskRec.getValue({fieldId:"custrecord_swct_api_completed"});
            // if(typeof apiCompleted == "string")
            // {
            //     apiCompleted = taskRec.getValue({fieldId:"custrecord_swct_api_completed"});
            // }
            // 只有"待执行"(空白)的和"失败"(failure)的，才允许执行;或者api 尚未执行
            //TODO apiComplted 是否会导致重复执行？
            if ((status == "1" || status == "3") && apiCompleted)
            {
                return options.success = true;
            }
            // 检查执行错误次数
            var execErrorCount = taskRec.getValue({fieldId:"custrecord_swct_exec_error_count"}) || 0;
            if (execErrorCount - tryErrorCount >=0)
            {
                return;
            }
            var platform = options.platform || taskRec.getText({fieldId:"custrecord_swct_platform"});
            var tranName = options.tranName || taskRec.getText({fieldId:"custrecord_swct_tran_name"});
            var output = options.output || taskRec.getValue({fieldId:"custrecord_swct_output"});
            //|| taskRec.getText({fieldId:"custrecord_swct_output"});
            var platformJson = options.platformJson || getPlatform(platform);
            options.platform = platform;
            options.tranName = tranName;
            options.output = output;
            var apiErrorCount = taskRec.getValue({fieldId:"custrecord_swct_api_error_count"});
            // var platformJson = getPlatform(platform);
            options.$globals = _.partial(getGlobalValue, platformJson);
            options.platformJson = platformJson;
            options.platformConfigJson = platformJson && platformJson.config;

            // 抓取未进行，并且低于最大试错次数
            if (!apiCompleted && apiErrorCount - tryErrorCount < 0) {
                var apiResult = "";
                var apiHasError = false;
                var apiOutput = "";

                // 抓取或更新data
                try {
                    var dataFunc = getDataFunc(tranName + "_data", platform);
                    if (dataFunc && _.isFunction(dataFunc)) {
                        if (!options.data) {
                            var inputDataStr = taskRec.getValue({fieldId:"custrecord_swct_input_data"});
                            options.data = inputDataStr && JSON.parse(inputDataStr) || {};
                        }
                        apiOutput = dataFunc(options);
                        if (!apiOutput || !apiOutput.success) {
                            apiCompleted = false;
                            apiHasError = true;
                        }
                    }
                } catch (e) {
                    apiOutput = e;
                    apiHasError = true;
                    apiErrorCount++;
                }

                Commons.setFieldsValues(taskRec, {
                    "custrecord_swct_api_completed" : apiHasError == false ? "T" : "F",
                    "custrecord_swct_input" : apiOutput && apiOutput["_input_"] || "",
                    "custrecord_swct_output" : apiOutput,
                    "custrecord_swst_status":apiHasError == false ? "1" : "2",
                    //1:success,2:failure,3:closed
                    "custrecord_swct_api_error_count" : apiHasError == true ? apiErrorCount : 0,
                    "custrecord_swct_api_last_modified" : apiOutput && apiOutput.lastModified
                }, false, true);
            }
            var output = taskRec.getValue({fieldId:"custrecord_swct_output"});
            log.audit("output20250106",output);
            options.output = output && JSON.parse(output);
            log.audit("output20250106-2",output);
            apiCompleted = taskRec.getValue({fieldId:"custrecord_swct_api_completed"});
            options.taskRec = taskRec;
            // 如果api 未执行成功，则退出
            if (!apiCompleted) {
                taskRec.save({enableSourcing:true,ignoreMandatoryFields:true});
                return;
            }
            // 如果是定期任务，则保存后退出，交由MR批量处理
            log.audit({title:"isSchedule", details: isSchedule});
            if(isSchedule)
            {
                // task 状态更新
                Commons.setFieldsValues(taskRec, {
                    "custrecord_swct_status" : "4", // 1:success,2:failure,3:closed,4:Pending
                    "custrecord_swct_exec_error_count" :  apiHasError == false ? apiErrorCount : 0
                }, false, true);
                taskRec.save({enableSourcing:true,ignoreMandatoryFields:true});
                return;
            }
            // 检查output 状态，如果不是success，则直接退出
            /*
             * if(output && !output.success){ nlapiSubmitRecord(taskRec); return; }
             */
            var result = "ok";
            var hasError = false;
            var status = "1"; //1:success
            log.audit({title:"EXEC:执行业务方法", details:"开始：" + tranName});

            // 执行业务方法
            try {
                var tranFunc = getFunc(tranName);
                log.audit({title:"EXEC:tranFunc", details:tranFunc});
                if (tranFunc && _.isFunction(tranFunc)) {
                    tranFunc(options);
                }
            } catch (e) {
                result = e;
                hasError = true;
                execErrorCount++;
            }
            if(hasError)
            {
                status = "2"; //2:failure
                if(result.name && result.name == "INVALID_FLD_VALUE")
                {
                    status = "3"; //3:closed
                }
            }
            if(result.name && result.name == "RCRD_HAS_BEEN_CHANGED")
            {
                status = "1";
                hasError = false;
                result = "ok";
            }
            // task 状态更新
            Commons.setFieldsValues(taskRec, {
                "custrecord_swct_exec_completed" : hasError == false ? "T":"F",
                "custrecord_swct_result" : result,
                "custrecord_swct_status" : status,
                "custrecord_swct_exec_error_count" : hasError == true ? execErrorCount : 0
            }, false, true);
            taskRec.save({enableSourcing:true,ignoreMandatoryFields:true});
            log.audit({title:"exec task used",details:remUsage0-scriptObj.getRemainingUsage()});
        }

        function createAndExecTask(options) {
            // 创建task
            var scriptObj = runtime.getCurrentScript();
            var remUsage0 = scriptObj.getRemainingUsage();
            log.audit({title:"createAndExecTask START",details:scriptObj.getRemainingUsage()});
            options.load = true;
            createTask(options);
            // 执行task
            execTask(options);

            log.audit({title:"createAndExecTask END",details:scriptObj.getRemainingUsage()});

        }
        function deleteExistTask(externalId){
            var id = Commons.searchByExternalId(externalId, "customrecord_swc_task");
            if(id){
                record.delete({type:"customrecord_swc_task",id:id});
            }
        }

        // 年月日时分秒补零操作
        function getAllDate(date) {
            var year=date.getFullYear();
            var mon=date.getMonth()+1;
            var day=date.getDate();
            var h=date.getHours();
            var m=date.getMinutes();
            var s=date.getSeconds();
            var submitTime = "";
            submitTime += year + "/";
            if(mon >= 10) {
                submitTime += mon + "/";
            }else {
                submitTime += "0" + mon + "/";
            }
            if(day >= 10) {
                submitTime += day;
            }else {
                submitTime += "0" + day;
            }
            submitTime +=" ";
            if(h >= 10) {
                submitTime += h + ":";
            }else {
                submitTime += "0" + h + ":";
            }
            if(m >= 10) {
                submitTime += m;
            }else {
                submitTime += "0" + m;
            }
            if(s >= 10) {
                submitTime += s;
            }else {
                submitTime += "0" + s;
            }
            return submitTime
        }


        function getSubsidiayId() {
            var json = {};
            var subsidiarySearchObj = search.create({
                type: "subsidiary",
                filters: [["isinactive","is","F"]],
                columns:
                    [
                        search.createColumn({name: "name", sort: search.Sort.ASC, label: "Name"}),
                        search.createColumn({name: "internalid", label: "Internal ID"}),
                        search.createColumn({name: "namenohierarchy", label: "Name (no hierarchy)"})
                    ]
            });
            subsidiarySearchObj.run().each(function(result){
                var name = result.getValue({name: "namenohierarchy"})
                var id = result.getValue({name: "internalid"})
                json[name] = id;
                return true;
            });
            return json;
        }




        /**
         * dynamically create search and process all search results
         *
         * @param recType
         * @param searchId
         * @param filters
         * @param columns
         * @param func
         * @param step
         */
        function processSearch(recType, searchId, filters, columns, func, step)
        {
            var mySearch = null;
            if (searchId) {
                // search = nlapiLoadSearch(recType, searchId);
                mySearch = search.load({type:recType, id:searchId});

                mySearch.columns.push(columns);
                if (filters && filters.length > 0)
                {
                    mySearch.filters.push("AND");
                    mySearch.filters.push(filters);
                }
            } else {
                mySearch = search.create({type:recType, filters:filters, columns:columns});
            }
            var resultSet = mySearch.run();
            var resultArr= [];
            var start = 0;
            var step  = step || 1000;
            var results = resultSet.getRange({start: start, end: step});
            while(results && results.length>0)
            {
                // debugConsole("processResults", start);
                processResults(results, func);
                start = Number(start)+Number(step);
                results = resultSet.getRange({start: start,end: Number(start)+Number(step)});
            }
        }

        /**
         * loop and process results array
         *
         * @param results
         * @param func
         */
        function processResults(results, func) {
            if (!results || results.length == 0) {
                return;
            }

            for ( var i in results) {
                func(results[i], i);
            }
        }

        /**
         * * authing 获取组织机构列表 拿到organizationCode和departmentId
         * @param platformJson
         */
        function getOrganizationList_new(platformJson) {
            var orgIdArr = [];
            var accessToken = platformJson.config.appKey;   // accessToken
            var sessionKey = platformJson.config.sessionKey;   // sessionKey
            var headers = {"Content-Type":"application/json","Authorization" : accessToken,"x-authing-userpool-id":"65af6bc7f17f80ed81ae8768"};
            var platformUrl = "https://pingcap-cn.authing.cn/api/v3/list-organizations?fetchAll=true&withCustomData=true&page=1&limit=50";
            var response = tryRequestURL(platformUrl, "", headers, "GET", 3, "Authing");
            log.audit('OrganizationListresponse',response);
            var bodyJson = response && JSON.parse(response.body);

            if(bodyJson.data.list.length) {
                _.each(bodyJson.data.list, function(organizationJson, index) {
                    orgIdArr.push({
                        "organizationCode":organizationJson.organizationCode,
                        "departmentId":organizationJson.departmentId,
                    })
                });
            }
            return orgIdArr;
        }
        /**
         * * authing 获取组织机构列表 拿到organizationCode和departmentId
         * @param platformJson
         */
        function getOrganizationList(platformJson) {
            var orgIdArr = [];
            var accessToken = platformJson.config.appKey;   // accessToken
            var sessionKey = platformJson.config.sessionKey;   // sessionKey
            var headers = {"Content-Type":"application/json","Authorization" : accessToken,"x-authing-userpool-id":sessionKey};
            var platformUrl = "https://api.authing.pingcap.net/api/v3/list-organizations?fetchAll=true&withCustomData=true&page=1&limit=50";
            var response = tryRequestURL(platformUrl, "", headers, "GET", 3, "Authing");
            log.audit('OrganizationListresponse',response);
            var bodyJson = response && JSON.parse(response.body);

            if(bodyJson.data.list.length) {
                _.each(bodyJson.data.list, function(organizationJson, index) {
                    orgIdArr.push({
                        "organizationCode":organizationJson.organizationCode,
                        "departmentId":organizationJson.departmentId,
                    })
                });
            }
            return orgIdArr;
        }

        /**
         * //支付业务:支付结果列表查询接口
         * @param options
         */
        function processBUSCODN02031SEARCH(options)
        {
            BusinessProcessing.updatePaymentStatus(options);
        }

        /**
         * 账户管理:查询账户交易信息
         * @param options
         */
        function processACCOUNTDETAIS(options)
        {
            BusinessProcessing.addAccountLog(options);
        }
        /**
         * 账户管理:查询电子回单信息
         */
        function processACCOUNTREFUNDMEIMAGE(options)
        {
            BusinessProcessing.addAccountImage(options);
        }
        /**
         * 账支付业务:支付退票明细查询
         */
        function processBUSCODN02031REFUNDSEARCH(options)
        {
            BusinessProcessing.updatePaymentStatusOfRefund(options);
        }

        /**
         * 账户管理:查询电子回单信息
         */
        function processACCOUNTREFUNDMESSAGE(options)
        {
            BusinessProcessing.updateReceiptsLogRec(options);
        }
        var COUNTRY = {"3":{"name":"Afghanistan","value":"AF"},"247":{"name":"Aland Islands","value":"AX"},"6":{"name":"Albania","value":"AL"},"62":{"name":"Algeria","value":"DZ"},"12":{"name":"American Samoa","value":"AS"},"1":{"name":"Andorra","value":"AD"},"9":{"name":"Angola","value":"AO"},"5":{"name":"Anguilla","value":"AI"},"10":{"name":"Antarctica","value":"AQ"},"4":{"name":"Antigua and Barbuda","value":"AG"},"11":{"name":"Argentina","value":"AR"},"7":{"name":"Armenia","value":"AM"},"15":{"name":"Aruba","value":"AW"},"14":{"name":"Australia","value":"AU"},"13":{"name":"Austria","value":"AT"},"16":{"name":"Azerbaijan","value":"AZ"},"31":{"name":"Bahamas","value":"BS"},"23":{"name":"Bahrain","value":"BH"},"19":{"name":"Bangladesh","value":"BD"},"18":{"name":"Barbados","value":"BB"},"35":{"name":"Belarus","value":"BY"},"20":{"name":"Belgium","value":"BE"},"36":{"name":"Belize","value":"BZ"},"25":{"name":"Benin","value":"BJ"},"27":{"name":"Bermuda","value":"BM"},"32":{"name":"Bhutan","value":"BT"},"29":{"name":"Bolivia","value":"BO"},"250":{"name":"Bonaire, Saint Eustatius and Saba","value":"BQ"},"17":{"name":"Bosnia and Herzegovina","value":"BA"},"34":{"name":"Botswana","value":"BW"},"33":{"name":"Bouvet Island","value":"BV"},"30":{"name":"Brazil","value":"BR"},"106":{"name":"British Indian Ocean Territory","value":"IO"},"28":{"name":"Brunei Darussalam","value":"BN"},"22":{"name":"Bulgaria","value":"BG"},"21":{"name":"Burkina Faso","value":"BF"},"24":{"name":"Burundi","value":"BI"},"117":{"name":"Cambodia","value":"KH"},"46":{"name":"Cameroon","value":"CM"},"37":{"name":"Canada","value":"CA"},"249":{"name":"Canary Islands","value":"IC"},"53":{"name":"Cape Verde","value":"CV"},"124":{"name":"Cayman Islands","value":"KY"},"40":{"name":"Central African Republic","value":"CF"},"248":{"name":"Ceuta and Melilla","value":"EA"},"212":{"name":"Chad","value":"TD"},"45":{"name":"Chile","value":"CL"},"47":{"name":"China","value":"CN"},"54":{"name":"Christmas Island","value":"CX"},"38":{"name":"Cocos (Keeling) Islands","value":"CC"},"48":{"name":"Colombia","value":"CO"},"119":{"name":"Comoros","value":"KM"},"39":{"name":"Congo, Democratic Republic of","value":"CD"},"41":{"name":"Congo, Republic of","value":"CG"},"44":{"name":"Cook Islands","value":"CK"},"49":{"name":"Costa Rica","value":"CR"},"43":{"name":"Cote d'Ivoire","value":"CI"},"98":{"name":"Croatia/Hrvatska","value":"HR"},"52":{"name":"Cuba","value":"CU"},"251":{"name":"Curaçao","value":"CW"},"55":{"name":"Cyprus","value":"CY"},"56":{"name":"Czech Republic","value":"CZ"},"59":{"name":"Denmark","value":"DK"},"58":{"name":"Djibouti","value":"DJ"},"60":{"name":"Dominica","value":"DM"},"61":{"name":"Dominican Republic","value":"DO"},"221":{"name":"East Timor","value":"TL"},"63":{"name":"Ecuador","value":"EC"},"65":{"name":"Egypt","value":"EG"},"208":{"name":"El Salvador","value":"SV"},"88":{"name":"Equatorial Guinea","value":"GQ"},"67":{"name":"Eritrea","value":"ER"},"64":{"name":"Estonia","value":"EE"},"69":{"name":"Ethiopia","value":"ET"},"72":{"name":"Falkland Islands","value":"FK"},"74":{"name":"Faroe Islands","value":"FO"},"71":{"name":"Fiji","value":"FJ"},"70":{"name":"Finland","value":"FI"},"75":{"name":"France","value":"FR"},"80":{"name":"French Guiana","value":"GF"},"175":{"name":"French Polynesia","value":"PF"},"213":{"name":"French Southern Territories","value":"TF"},"76":{"name":"Gabon","value":"GA"},"85":{"name":"Gambia","value":"GM"},"79":{"name":"Georgia","value":"GE"},"57":{"name":"Germany","value":"DE"},"82":{"name":"Ghana","value":"GH"},"83":{"name":"Gibraltar","value":"GI"},"89":{"name":"Greece","value":"GR"},"84":{"name":"Greenland","value":"GL"},"78":{"name":"Grenada","value":"GD"},"87":{"name":"Guadeloupe","value":"GP"},"92":{"name":"Guam","value":"GU"},"91":{"name":"Guatemala","value":"GT"},"81":{"name":"Guernsey","value":"GG"},"86":{"name":"Guinea","value":"GN"},"93":{"name":"Guinea-Bissau","value":"GW"},"94":{"name":"Guyana","value":"GY"},"99":{"name":"Haiti","value":"HT"},"96":{"name":"Heard and McDonald Islands","value":"HM"},"233":{"name":"Holy See (City Vatican State)","value":"VA"},"97":{"name":"Honduras","value":"HN"},"95":{"name":"Hong Kong","value":"HK"},"100":{"name":"Hungary","value":"HU"},"109":{"name":"Iceland","value":"IS"},"105":{"name":"India","value":"IN"},"101":{"name":"Indonesia","value":"ID"},"108":{"name":"Iran (Islamic Republic of)","value":"IR"},"107":{"name":"Iraq","value":"IQ"},"102":{"name":"Ireland","value":"IE"},"104":{"name":"Isle of Man","value":"IM"},"103":{"name":"Israel","value":"IL"},"110":{"name":"Italy","value":"IT"},"112":{"name":"Jamaica","value":"JM"},"114":{"name":"Japan","value":"JP"},"111":{"name":"Jersey","value":"JE"},"113":{"name":"Jordan","value":"JO"},"125":{"name":"Kazakhstan","value":"KZ"},"115":{"name":"Kenya","value":"KE"},"118":{"name":"Kiribati","value":"KI"},"121":{"name":"Korea, Democratic People's Republic","value":"KP"},"122":{"name":"Korea, Republic of","value":"KR"},"254":{"name":"Kosovo","value":"XK"},"123":{"name":"Kuwait","value":"KW"},"116":{"name":"Kyrgyzstan","value":"KG"},"126":{"name":"Lao People's Democratic Republic","value":"LA"},"135":{"name":"Latvia","value":"LV"},"127":{"name":"Lebanon","value":"LB"},"132":{"name":"Lesotho","value":"LS"},"131":{"name":"Liberia","value":"LR"},"136":{"name":"Libya","value":"LY"},"129":{"name":"Liechtenstein","value":"LI"},"133":{"name":"Lithuania","value":"LT"},"134":{"name":"Luxembourg","value":"LU"},"148":{"name":"Macau","value":"MO"},"144":{"name":"Macedonia","value":"MK"},"142":{"name":"Madagascar","value":"MG"},"156":{"name":"Malawi","value":"MW"},"158":{"name":"Malaysia","value":"MY"},"155":{"name":"Maldives","value":"MV"},"145":{"name":"Mali","value":"ML"},"153":{"name":"Malta","value":"MT"},"143":{"name":"Marshall Islands","value":"MH"},"150":{"name":"Martinique","value":"MQ"},"151":{"name":"Mauritania","value":"MR"},"154":{"name":"Mauritius","value":"MU"},"243":{"name":"Mayotte","value":"YT"},"157":{"name":"Mexico","value":"MX"},"73":{"name":"Micronesia, Federal State of","value":"FM"},"139":{"name":"Moldova, Republic of","value":"MD"},"138":{"name":"Monaco","value":"MC"},"147":{"name":"Mongolia","value":"MN"},"140":{"name":"Montenegro","value":"ME"},"152":{"name":"Montserrat","value":"MS"},"137":{"name":"Morocco","value":"MA"},"159":{"name":"Mozambique","value":"MZ"},"146":{"name":"Myanmar (Burma)","value":"MM"},"160":{"name":"Namibia","value":"NA"},"169":{"name":"Nauru","value":"NR"},"168":{"name":"Nepal","value":"NP"},"166":{"name":"Netherlands","value":"NL"},"8":{"name":"Netherlands Antilles (Deprecated)","value":"AN"},"161":{"name":"New Caledonia","value":"NC"},"171":{"name":"New Zealand","value":"NZ"},"165":{"name":"Nicaragua","value":"NI"},"162":{"name":"Niger","value":"NE"},"164":{"name":"Nigeria","value":"NG"},"170":{"name":"Niue","value":"NU"},"163":{"name":"Norfolk Island","value":"NF"},"149":{"name":"Northern Mariana Islands","value":"MP"},"167":{"name":"Norway","value":"NO"},"172":{"name":"Oman","value":"OM"},"178":{"name":"Pakistan","value":"PK"},"185":{"name":"Palau","value":"PW"},"173":{"name":"Panama","value":"PA"},"176":{"name":"Papua New Guinea","value":"PG"},"186":{"name":"Paraguay","value":"PY"},"174":{"name":"Peru","value":"PE"},"177":{"name":"Philippines","value":"PH"},"181":{"name":"Pitcairn Island","value":"PN"},"179":{"name":"Poland","value":"PL"},"184":{"name":"Portugal","value":"PT"},"182":{"name":"Puerto Rico","value":"PR"},"187":{"name":"Qatar","value":"QA"},"188":{"name":"Reunion Island","value":"RE"},"189":{"name":"Romania","value":"RO"},"190":{"name":"Russian Federation","value":"RU"},"191":{"name":"Rwanda","value":"RW"},"26":{"name":"Saint Barthélemy","value":"BL"},"198":{"name":"Saint Helena","value":"SH"},"120":{"name":"Saint Kitts and Nevis","value":"KN"},"128":{"name":"Saint Lucia","value":"LC"},"141":{"name":"Saint Martin","value":"MF"},"234":{"name":"Saint Vincent and the Grenadines","value":"VC"},"241":{"name":"Samoa","value":"WS"},"203":{"name":"San Marino","value":"SM"},"207":{"name":"Sao Tome and Principe","value":"ST"},"192":{"name":"Saudi Arabia","value":"SA"},"204":{"name":"Senegal","value":"SN"},"50":{"name":"Serbia","value":"RS"},"51":{"name":"Serbia and Montenegro (Deprecated)","value":"CS"},"194":{"name":"Seychelles","value":"SC"},"202":{"name":"Sierra Leone","value":"SL"},"197":{"name":"Singapore","value":"SG"},"252":{"name":"Sint Maarten","value":"SX"},"201":{"name":"Slovak Republic","value":"SK"},"199":{"name":"Slovenia","value":"SI"},"193":{"name":"Solomon Islands","value":"SB"},"205":{"name":"Somalia","value":"SO"},"244":{"name":"South Africa","value":"ZA"},"90":{"name":"South Georgia","value":"GS"},"253":{"name":"South Sudan","value":"SS"},"68":{"name":"Spain","value":"ES"},"130":{"name":"Sri Lanka","value":"LK"},"180":{"name":"St. Pierre and Miquelon","value":"PM"},"183":{"name":"State of Palestine","value":"PS"},"195":{"name":"Sudan","value":"SD"},"206":{"name":"Suriname","value":"SR"},"200":{"name":"Svalbard and Jan Mayen Islands","value":"SJ"},"210":{"name":"Swaziland","value":"SZ"},"196":{"name":"Sweden","value":"SE"},"42":{"name":"Switzerland","value":"CH"},"209":{"name":"Syrian Arab Republic","value":"SY"},"225":{"name":"Taiwan","value":"TW"},"216":{"name":"Tajikistan","value":"TJ"},"226":{"name":"Tanzania","value":"TZ"},"215":{"name":"Thailand","value":"TH"},"214":{"name":"Togo","value":"TG"},"217":{"name":"Tokelau","value":"TK"},"220":{"name":"Tonga","value":"TO"},"223":{"name":"Trinidad and Tobago","value":"TT"},"219":{"name":"Tunisia","value":"TN"},"222":{"name":"Turkey","value":"TR"},"218":{"name":"Turkmenistan","value":"TM"},"211":{"name":"Turks and Caicos Islands","value":"TC"},"224":{"name":"Tuvalu","value":"TV"},"228":{"name":"Uganda","value":"UG"},"227":{"name":"Ukraine","value":"UA"},"2":{"name":"United Arab Emirates","value":"AE"},"77":{"name":"United Kingdom","value":"GB"},"230":{"name":"United States","value":"US"},"231":{"name":"Uruguay","value":"UY"},"229":{"name":"US Minor Outlying Islands","value":"UM"},"232":{"name":"Uzbekistan","value":"UZ"},"239":{"name":"Vanuatu","value":"VU"},"235":{"name":"Venezuela","value":"VE"},"238":{"name":"Vietnam","value":"VN"},"236":{"name":"Virgin Islands (British)","value":"VG"},"237":{"name":"Virgin Islands (USA)","value":"VI"},"240":{"name":"Wallis and Futuna","value":"WF"},"66":{"name":"Western Sahara","value":"EH"},"242":{"name":"Yemen","value":"YE"},"245":{"name":"Zambia","value":"ZM"},"246":{"name":"Zimbabwe","value":"ZW"}};

        //调用接口 拉取 参数日期为dateModified的接口
        function requestNavanUrl(options,allout){
            //
            var tOutNew = requestURL({
                platform : options.platform,
                apiId : "getNavanVoucherList",
                data : options.data,
                tryCount : 3,
                platformJson : options.platformJson
            });
            log.audit("jp- getNavanVoucherList 拉取订单out", JSON.stringify(tOutNew));
            if(tOutNew.length>0){
                for(var i=0;i<tOutNew.length;i++){
                    //如果不是日本并且STATEMENT_ID存在 push，日本直接push
                    if(tOutNew[i]["BILLABLE_ENTITY"] == "PingCAP Kabushiki-Kaisha" ){
                        tOutNew[i]["newTranslate"] = options.data.newTranslate;//赋值日期字段
                        allout.push(tOutNew[i]);
                    }else if(tOutNew[i]["STATEMENT_ID"]){
                        tOutNew[i]["newTranslate"] = options.data.newTranslate;//赋值日期字段
                        allout.push(tOutNew[i]);
                    }
                }
            }
        }

        //调用接口  拉取 参数日期为date的接口
        function requestNavanDateUrl(options,allout){
            //拉取 参数日期为date的接口
            var tOutNew = requestURL({
                platform : options.platform,
                apiId : "getDateNavanVoucherList",
                data : options.data,
                tryCount : 3,
                platformJson : options.platformJson
            });
            log.audit("jp- getDateNavanVoucherList 拉取订单out", JSON.stringify(tOutNew));
            if(tOutNew.length>0){
                for(var i=0;i<tOutNew.length;i++){
                    //如果不是日本并且STATEMENT_ID存在 push，日本直接push
                    if(tOutNew[i]["BILLABLE_ENTITY"] == "PingCAP Kabushiki-Kaisha" ){
                        tOutNew[i]["newTranslate"] = options.data.newTranslate;//赋值日期字段
                        allout.push(tOutNew[i]);
                    }else if(tOutNew[i]["STATEMENT_ID"]){
                        tOutNew[i]["newTranslate"] = options.data.newTranslate;//赋值日期字段
                        allout.push(tOutNew[i]);
                    }
                }
            }
        }

        /**end***********************TaskLib**********************************end**/
        return {
            registerFunc :  registerFunc
            ,registerPlatform : registerPlatform
            ,initPlatform : initPlatform
            ,getPlatform : getPlatform
            ,getPlatformConfig : getPlatformConfig
            ,getDate : getDate
            ,formatDate : formatDate
            ,addHours : addHours
            ,getGlobalVariable : getGlobalVariable
            ,getFunc : getFunc
            ,getGlobalValue : getGlobalValue
            ,getDataFunc : getDataFunc
            ,getApp : getApp
            ,getElapsedMins : getElapsedMins
            ,requestURL : requestURL
            ,doMapping : doMapping
            ,timestampToDate : timestampToDate
            ,getMappingFromSearch : getMappingFromSearch
            ,getSubsidiayId :getSubsidiayId
            ,processSearch :processSearch
            //TasjLIb
            ,createAndExecTask : createAndExecTask
            ,createTask : createTask
            ,execTask : execTask
            ,lastModified : lastModified
            ,checkAndGetTaskInfo : checkAndGetTaskInfo
            ,tryRequestURL: tryRequestURL
        };
    });
