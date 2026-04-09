/**
 * @NApiVersion 2.1
 * @NScriptType ScheduledScript
 * @NModuleScope Public
 * @author yltian
 * @description 拉取飞书审批模板_供应商账单申请、采购申请货品字段映射，创建在Netsuite端不存在的货品字段映射；错误数据两端手动删除。
 */
var SESSION_KEY_LARK = "cli_a33f90d887fbd00c";
var SESSION_SECRET_LARK = "Xx8XoQCx3ntA5F1b70UVygmxddCazk3p";
// 飞书审批模板_供应商账单申请
var FS_APPROVAL_TEMPLATE_VENDOR_ACCT_APPLY = "7475FE86-9720-466A-AE43-F0F79E554AA6";
// 飞书审批模板_采购申请
var FS_APPROVAL_TEMPLATE_PURCH_APPLY = "FB6D2FA3-B5C3-4239-BB73-C413F23555A8";
// 飞书审批列表字段映射字典数据_检索参数_飞书供应商账单申请
var FS_APPROVAL_FIELD_MAPPING_VENDOR_ACCT_APPLY = "飞书供应商账单申请";
// 飞书审批列表字段映射字典数据_飞书采购申请
var FS_APPROVAL_FIELD_MAPPING_PURCH_APPLY = "飞书采购申请";
// 飞书审批模板_Expense Type_自定义id："item"
var FS_APPROVAL_EXPENSE_TYPE_CUST_ID = "item";
// 拉取飞书审批模板（url + approval_code）
var LARK_APPROVAL_TEMPLATE_URL = "https://open.feishu.cn/open-apis/approval/v4/approvals/";
var LARK_TOKEN_URL = "https://open.feishu.cn/open-apis/auth/v3/app_access_token/internal";
define(["N/record", "../../common/Commons", "N/https", "N/search"],
    
    (record, Commons, https, search) => {

        /**
         * Defines the Scheduled script trigger point.
         * @param {Object} scriptContext
         * @param {string} scriptContext.type - Script execution context. Use values from the scriptContext.InvocationType enum.
         * @since 2015.2
         */
        const execute = (scriptContext) => {
            try {
                var token = getLarkAuthorization();

                if (!token) throw new Error("token不存在");

                var headers = {
                    "Accept":"application/json",
                    "Content-Type":"application/json",
                    "Authorization": "Bearer " + token
                };

                // 拉取供应商账单申请模板
                var tryCount = 3;
                var vendorAcctApplyResp = tryRequestURL(
                    LARK_APPROVAL_TEMPLATE_URL + FS_APPROVAL_TEMPLATE_VENDOR_ACCT_APPLY,
                    null, headers, "GET", tryCount);
                // 拉取采购申请模板
                var purchApplyResp = tryRequestURL(
                    LARK_APPROVAL_TEMPLATE_URL + FS_APPROVAL_TEMPLATE_PURCH_APPLY,
                    null, headers, "GET", tryCount);

                // 取得飞书供应商账单申请的字段映射字典数据：{"vendorAcctApply": {"字段名称": {"id": "ID", "value": {"TEXT": "VALUE"}, ...}, ...}, "purchApply": {}}
                var LarkFieldMappingObj = srchLarkFieldMapping();
                // 分别比对供应商账单申请模板、采购申请模板货品字段映射，不存在的创建
                crtNotExistItemMapping(vendorAcctApplyResp, LarkFieldMappingObj.vendorAcctApply, FS_APPROVAL_FIELD_MAPPING_VENDOR_ACCT_APPLY);
                crtNotExistItemMapping(purchApplyResp, LarkFieldMappingObj.purchApply, FS_APPROVAL_FIELD_MAPPING_PURCH_APPLY);
            } catch (e) {
                log.error("飞书数据异常", e);
            }
        }

        /**
         * 比对供应商账单申请模板、采购申请模板货品字段映射，不存在的创建
         * @param {string} tmplResp 模板数据
         * @param {Object} larkDictObj 飞书字段映射字典数据：{"字段名称": {"id": "ID", "value": {"TEXT": "VALUE"}, ...}, ...}
         * @param {string} tmplType 模板类型："飞书供应商账单申请"/"飞书采购申请"
         */
        function crtNotExistItemMapping(tmplResp, larkDictObj, tmplType) {
            tmplResp = JSON.parse(tmplResp.body);
            if (tmplResp["code"] != 0) throw new Error("【" + tmplType + "】数据拉取失败");

            var form = eval("(" + tmplResp["data"]["form"] + ")");

            var fieldMappingAry = [];
            form.forEach(function (value) {
                // if (value["custom_id"] == FS_APPROVAL_EXPENSE_TYPE_CUST_ID) {
                // 以"_"分割为item，作为货品
                if (value["custom_id"] && value["custom_id"].split("_")[0] == FS_APPROVAL_EXPENSE_TYPE_CUST_ID) {
                    // 货品类型自定义id固定值："item"
                    // 取得"Expense Type"字段下拉列表内容
                    var option = value["option"]
                    // 下拉列表为空，结束处理
                    if (!option || !option.length) return;

                    option.forEach(function (itemTypeVal) {
                        var itemTypeValTxt = itemTypeVal["text"];
                        // 1100 Fixed Assets 固定资产 => 1100 Fixed Assets
                        itemTypeValTxt = itemTypeValTxt.substr(0, itemTypeValTxt.lastIndexOf(" ")).trim();
                        // 货品类型
                        fieldMappingAry.push({
                            name: value["name"],
                            text: itemTypeValTxt,
                            value: itemTypeVal["value"],
                            id: ""
                        });
                    });
                } else {
                    // 存在“display_condition” && 指定格式为货品数据
                    // 展示条件为空的场合，结束处理
                    var dispCond = value["display_condition"];
                    if (!dispCond) return;

                    // 展示条件存在自定义id等于货品类型，标志为货品数据
                    if (dispCond["conditions"][0]["expressions"][0]["source_widget"]["custom_id"] == "item") {
                        var option = value["option"];
                        // 下拉列表为空，结束处理
                        if (!option || !option.length) return;

                        var valueName = value["name"];
                        valueName = valueName.substr(0, valueName.lastIndexOf(" ")).trim();

                        option.forEach(function (itemTypeVal) {
                            var itemTypeValTxt = itemTypeVal["text"];
                            // 1100 Fixed Assets 固定资产 => 1100 Fixed Assets
                            itemTypeValTxt = itemTypeValTxt.substr(0, itemTypeValTxt.lastIndexOf(" ")).trim();
                            fieldMappingAry.push({
                                name: valueName,
                                text: itemTypeValTxt,
                                value: itemTypeVal["value"],
                                id: value["id"]
                            });
                        });
                    }
                }
            });

            // 创建飞书审批列表字段映射
            fieldMappingAry.forEach(function (value) {
                var existFlag = verifyExist(value, larkDictObj);
                // 当前待创建源数据存在 && existFlag == false（false的场合，不存在）
                if (value && !existFlag) {
                    log.error("待创建源数据", value)
                    crtFieldMappingRec(value, tmplType);
                }
            });
        }

        /**
         * 校验拉取数据在中间表是否存在
         * @param {Object} fieldMappingObj 待创建的字段映射源数据：{"字段名称": {"id": "ID", "value": {"TEXT": "VALUE"}, ...}, ...}
         * @param {Object} larkDictObj 飞书字段映射字典数据：{"name": "字段名称", "text": "TEXT", "value": "VALUE", "id": ""ID}
         * @param {boolean} 数据存在：true；数据不存在：false。已存在的数据不进行新建处理
         */
        function verifyExist(fieldMappingObj, larkDictObj) {
            var existFlag = true;
            // 空值作为已存在处理
            if (!fieldMappingObj) return existFlag;

            // 新建操作不需要校验值是否一致，当对象对应的key存在，认为值存在。更新和删除人工修改数据
            if (!larkDictObj.hasOwnProperty(fieldMappingObj["name"])) {
                // 不存在当前字段名称
                existFlag = false;
            } else {
                // 存在当前字段名称，比对内容是否一致
                var curNameValue = larkDictObj[fieldMappingObj["name"]]["value"];
                // 判断指定【TEXT】是否存在
                if (!curNameValue.hasOwnProperty(fieldMappingObj["text"])) {
                    existFlag = false;
                }
            }

            return existFlag;
        }

        /**
         * 创建货品飞书审批列表字段映射
         * @param {Object} fieldMappingObj 飞书审批列表字段映射
         * @param {string} tmplType 模板类型："飞书供应商账单申请"/"飞书采购申请"
         */
        function crtFieldMappingRec(fieldMappingObj, tmplType) {
            var fieldMappingRec = record.create({type: "customrecord_swc_feishu_fieldid_mapping"});

            // 模板类型
            fieldMappingRec.setValue({fieldId: "custrecord_idmap_type", value: tmplType});
            // 字段名称
            fieldMappingRec.setValue({fieldId: "custrecord_idmap_name", value: fieldMappingObj["name"]});
            // TEXT
            fieldMappingRec.setValue({fieldId: "custrecord_idmap_text", value: fieldMappingObj["text"]});
            // VALUE
            fieldMappingRec.setValue({fieldId: "custrecord_idmap_value", value: fieldMappingObj["value"]});
            // ID
            fieldMappingRec.setValue({fieldId: "custrecord_idmap_id", value: fieldMappingObj["id"]});

            fieldMappingRec.save();
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
        function tryRequestURL(platformUrl, postdata, headers, httpMethod, tryCount) {
            var response = "";
            var success = false;
            var error = "";
            for (var i = 0; i < tryCount; i++) {
                try {
                    response = https.request({method:httpMethod,url:platformUrl,body:postdata,headers:headers});
                    success = true;
                    break;
                } catch (e) {
                    error = e;
                }
            }
            if (!success) {
                throw error;
            }
            return response;
        }

        /**
         * 取得登录授权
         * @return {string} 登录授权
         */
        function getLarkAuthorization() {
            var headers = {"Content-Type": "application/json; charset=utf-8", "Accept": "*/*"};
            var postData = {"app_id": SESSION_KEY_LARK, "app_secret": SESSION_SECRET_LARK};

            var response = tryRequestURL(LARK_TOKEN_URL, JSON.stringify(postData), headers, "POST", 3);

            return JSON.parse(response.body).app_access_token;
        }

        /**
         * 检索飞书审批字段
         * @return {Object} {"vendorAcctApply": {"字段名称": {"id": "ID", "value": {"TEXT": "VALUE"}, ...}, ...}, "purchApply": {}}
         */
        function srchLarkFieldMapping() {
            var srchObj = search.create({
                type: "customrecord_swc_feishu_fieldid_mapping",
                filters:
                    [
                        ["isinactive","is","F"],
                        "AND",
                        [["custrecord_idmap_type","is", FS_APPROVAL_FIELD_MAPPING_VENDOR_ACCT_APPLY],"OR",["custrecord_idmap_type","is", FS_APPROVAL_FIELD_MAPPING_PURCH_APPLY]]
                    ],
                columns:
                    [
                        search.createColumn({name: "custrecord_idmap_type", label: "模板类型"}),
                        search.createColumn({name: "custrecord_idmap_name", label: "字段名称"}),
                        search.createColumn({name: "custrecord_idmap_text", label: "TEXT"}),
                        search.createColumn({name: "custrecord_idmap_value", label: "Value"}),
                        search.createColumn({name: "custrecord_idmap_id", label: "ID"})
                    ]
            });

            var result = Commons.getAllResults(srchObj);

            var dictObj = {"vendorAcctApply": {}, "purchApply": {}};
            result.forEach(function (dictVal) {
                var type = dictVal.getValue({name: "custrecord_idmap_type"});
                var name = dictVal.getValue({name: "custrecord_idmap_name"});
                var text = dictVal.getValue({name: "custrecord_idmap_text"});
                var value = dictVal.getValue({name: "custrecord_idmap_value"});
                var id = dictVal.getValue({name: "custrecord_idmap_id"});

                var type;
                if (type == FS_APPROVAL_FIELD_MAPPING_VENDOR_ACCT_APPLY) {
                    type = "vendorAcctApply";
                } else if (type == FS_APPROVAL_FIELD_MAPPING_PURCH_APPLY) {
                    type = "purchApply";
                }

                // {"字段名称": {"id": "ID", "value": {"TEXT": "VALUE"}, ...}, ...}
                dictObj[type][name] = dictObj[type][name] || {id: null, value: {}};
                if (id) {
                    dictObj[type][name]["id"] = id;
                }
                dictObj[type][name]["value"][text] = value;
            });

            return dictObj;
        }

        return {execute}

    });
