/**
 * @NApiVersion 2.1
 * @NModuleScope Public
 * @description 旺店通推送数据共通模块
 */
define(['N/record', 'N/https', '../lib/md5.js', 'N/ui/dialog', 'N/search', 'N/format',"N/runtime"],

    (record, https, Md5, dialog, search, format,runtime) => {
        function getDate(timeZone, timeString) {
            var date = new Date(timeString);
            var utcTime = date.getTime() + date.getTimezoneOffset() * 60 * 1000;
            var tzTime = utcTime + timeZone * 60 * 60 * 1000;
            return tzTime.toString().slice(0, 10);
        }

        function getThisDate(timeZone) {
            var date = new Date();
            var utcTime = date.getTime() + date.getTimezoneOffset() * 60 * 1000;
            var tzTime = utcTime + timeZone * 60 * 60 * 1000;
            return new Date(tzTime);
        }

        function to2Digits(num) {
            return (num < 10 ? "0" : "") + num;
        }

        function formatDate(date, formatStr) {
            var year = date.getFullYear();
            var month = to2Digits(Number(date.getMonth()) + 1);
            var day = to2Digits(date.getDate());
            var hours = to2Digits(date.getHours());
            var mins = to2Digits(date.getMinutes());
            var seconds = to2Digits(date.getSeconds());

            var str = formatStr && formatStr.replace("yyyy", year).replace("MM", month).replace("dd", day).replace("hh", hours).replace("mm", mins).replace("ss", seconds);
            return str;
        }

        /**
         * NS同步供应商至飞书
         * @param {Object} options
         * @param {string} options.recId 记录ID
         * @param {boolean} options.serverInvokeFlag 服务器端调用区分（true：服务器端调用；false：客户端调用）
         * @param {string} options.recType 记录类型
         */
        function exeVendorPush(options) {
            var recId = options.recId;
            var serverInvokeFlag = options.serverInvokeFlag;
            var recType = options.recType;

            var addressJson = getVendorCountry(recId); // 供应商地址
            var res = search.lookupFields({type:"employee",id:runtime.getCurrentUser().id,columns:["custentity_swc_feishu_ouid"]});
            var operatorOUID = res["custentity_swc_feishu_ouid"]; // 创建或者更新供应商的员工的飞书OUid
            var curRec = record.load({type: recType, id: recId});

            // 供应商编码
            var nsVendor = curRec.getValue({fieldId: 'entityid'}); // 接口里自定义字段VBI00100001
            var feishuVendor = curRec.getValue({fieldId: 'custentity_swc_feishu_supply_code'}); // 接口里vendor
            var feishuVendorId = curRec.getValue({fieldId: 'custentity_swc_feishu_supply_oucode'}); // 接口返回回来的id字段
            // 公司名称
            var displayName = curRec.getValue({fieldId: 'companyname'});
            // 类型 公司 个人
            var type = curRec.getValue({fieldId: 'isperson'});

            log.audit("type",type);
          log.audit("addressJson",addressJson);
            var vendorBankCount = curRec.getLineCount({sublistId:"recmachcustrecord_swc_vendor"});
            var vendorBankJson = []; // 银行信息

            for(var i = 0; i < vendorBankCount; i++) {
                var obj = {
                    "bankName" : curRec.getSublistValue({sublistId:"recmachcustrecord_swc_vendor",fieldId:"custrecord_swc_vendor_bankname",line:i}),
                    "bankCode" : curRec.getSublistValue({sublistId:"recmachcustrecord_swc_vendor",fieldId:"custrecord_swc_vendor_bankacco",line:i}),
                    "swiftCode" : curRec.getSublistValue({sublistId:"recmachcustrecord_swc_vendor",fieldId:"custrecord_swc_swiftcode",line:i}),
                    "country" : curRec.getSublistText({sublistId:"recmachcustrecord_swc_vendor",fieldId:"custrecord_swc_bank_country",line:i}),
                    "account" : curRec.getSublistValue({sublistId:"recmachcustrecord_swc_vendor",fieldId:"custrecord_swc_vendor_account",line:i}),
                    "accountName" : curRec.getSublistValue({sublistId:"recmachcustrecord_swc_vendor",fieldId:"custrecord_swc_vendor_accountname",line:i})
                }
                vendorBankJson.push(obj);
            }




            // 飞书platform
            var platform = record.load({type:"customrecord_swc_platform",id:"3"});

            try {
                var method;
                var urlObj;
                var headers;
                var postData = {};
                // serverInvokeFlag ==true 服务器
                if(serverInvokeFlag) {
                    // 对数所有请求参数按照键名进行正序排序，数组和对象转成JSON字符串
                    postData = {
                        "adCountry": addressJson.country,
                        "status": "1",
                        "vendorText": displayName,
                        "vendorType": "2",//供应商
                        "vendorCategory": "22",//22：外部供应商(当vendor_category = 2 时的枚举值)
                        "vendorNature": (type == "T") ? "1" : "0",
                        "VBI00100001": nsVendor,
                        "VCO00100001": "ou_f1eee0f760ed4f26e988880200e2098f",//operatorOUID,
                        "extendInfo": [
                            {
                                "fieldType": 0,
                                "fieldValue": nsVendor,
                                "fieldCode": "VBI00100001"
                            },
                            {
                                "fieldType": 0,
                                "fieldValue": "ou_f1eee0f760ed4f26e988880200e2098f",//operatorOUID,
                                "fieldCode": "VCO00100001"
                            }
                        ],
                        "vendorAccounts":vendorBankJson,
                        "vendorAddresses":addressJson.addressArr
                    }
                    method = "POST";
                    headers = {"Authorization":"Bearer "+ platform.getValue({fieldId:"custrecord_swcp_appkey"}),"Content-Type":"application/json; charset=utf-8","Accept":"*/*"}
                    urlObj = "https://open.feishu.cn/open-apis/mdm/v1/vendors?user_id=ou_f1eee0f760ed4f26e988880200e2098f";//operatorOUID
                } else {
                    postData = {
                        "id":feishuVendorId,
                        "adCountry": addressJson.country,
                        "status": "1",
                        "vendor":feishuVendor,
                        "vendorText": displayName,
                        "vendorType": "2",//供应商
                        "vendorCategory": "22",//22：外部供应商(当vendor_category = 2 时的枚举值)
                        "vendorNature": (type == "T") ? "1" : "0",
                        "VBI00100001": nsVendor,
                        "VCO00100001": "ou_f1eee0f760ed4f26e988880200e2098f",//operatorOUID,
                        "extendInfo": [
                            {
                                "fieldType": 0,
                                "fieldValue": nsVendor,
                                "fieldCode": "VBI00100001"
                            },
                            {
                                "fieldType": 0,
                                "fieldValue":  "ou_f1eee0f760ed4f26e988880200e2098f",//operatorOUID,
                                "fieldCode": "VCO00100001"
                            }
                        ],
                        "vendorAccounts":vendorBankJson,
                        "vendorAddresses":addressJson.addressArr
                    }
                    method = "PUT";
                    headers = {"Authorization":"Bearer "+ platform.getValue({fieldId:"custrecord_swcp_appkey"}),"Content-Type":"application/json; charset=utf-8","Accept":"*/*"}
                    urlObj = "https://open.feishu.cn/open-apis/mdm/v1/vendors/"+feishuVendorId+"?user_id=ou_f1eee0f760ed4f26e988880200e2098f";//operatorOUID
                }
                var response = https.request({method:method,url: urlObj, headers: headers, body: JSON.stringify(postData)});
                log.audit("response",response);
                var responseBody = response && JSON.parse(response.body);

                // 创建日志
                crtLog4PushApi({reqParam: postData, respParam: responseBody, tranName: "sysnFeiShuVendor"});

                var clientMsg = null;
                if (responseBody.code == 0) {
                    if(serverInvokeFlag) {
                        // 成功
                        var vendorRec = record.load({type: recType, id: recId});
                        vendorRec.setValue({fieldId:"custentity_swc_feishu_supply_code",value:responseBody.data.id});
                        vendorRec.setValue({fieldId:"custentity_swc_feishu_supply_oucode",value:responseBody.data.vendor});
                        vendorRec.save();
                    }

                    clientMsg = "数据同步成功";
                } else {
                    // 失败的场合，取得错误信息
                    clientMsg = responseBody.msg;
                }
                // 客户端调用的场合，提示消息
                if (!serverInvokeFlag && clientMsg) {
                    dialog.alert({
                        title: '提示',
                        message: clientMsg
                    }).then(function () {
                        window.location.reload();
                    });
                }
            } catch (e) {
                log.error({title: '异常信息', details: JSON.stringify(e)});
            }
        }


        /**
         * 保存检索获取供应商国家/地区字段
         * @param recId
         */
        function getVendorCountry(recId) {
            var addressJson = {
                "country":"",
                "addressArr":[]
            };
            var vendorSearchObj = search.create({
                type: "vendor",
                filters: [["internalid","anyof",recId]],
                columns:
                    [
                        search.createColumn({name: "entityid", sort: search.Sort.ASC, label: "ID"}),
                        search.createColumn({name: "altname", label: "名称"}),
                        search.createColumn({name: "country", join: "Address", label: "国家/地区"}),
                        search.createColumn({name: "isdefaultbilling", join: "Address", label: "默认开票地址"}),
                        search.createColumn({name: "isdefaultshipping", join: "Address", label: "默认发运地址"}),
                        search.createColumn({name: "attention", join: "Address", label: "收件人"}),
                        search.createColumn({name: "statedisplayname", join: "Address", label: "州/省/自治区/直辖市显示名称"}),
                        search.createColumn({name: "city", join: "Address", label: "城市"}),
                        search.createColumn({name: "address1", join: "Address", label: "地址 1"}),
                        search.createColumn({name: "addressphone", join: "Address", label: "地址电话"}),
                        search.createColumn({name: "country", join: "Address", label: "国家/地区"}),
                        search.createColumn({name: "countrycode", join: "Address", label: "国家/地区代码"}),
                        search.createColumn({name: "addressee", join: "Address", label: "收件人"})
                    ]
            });
            vendorSearchObj.run().each(function(result) {
                var isDefaultShipping = result.getValue({name: "isdefaultshipping", join: "Address"});
                if(isDefaultShipping) {
                    addressJson.country = result.getValue({name: "countrycode", join: "Address"});
                }

                var obj = {
                    "country" : result.getValue({name: "countrycode", join: "Address"}),
                    "province" : result.getValue({name: "statedisplayname", join: "Address"}),
                    "city" : result.getValue({name: "city", join: "Address"}),
                    "address" : result.getValue({name: "address1", join: "Address"}),
                }
                addressJson.addressArr.push(obj);
                return true;
            });
            return addressJson;
        }


        /**
         * 创建日志，记录推送接口请求参数和响应参数
         * @param {Object} options
         * @param {Object} options.reqParam 请求参数
         * @param {Object} options.respParam 响应参数
         * @param {string} options.tranName 事务处理名称：推送接口名称，需维护关联列表
         */
        function crtLog4PushApi(options) {
            var reqParam = options.reqParam;
            var respParam = options.respParam;

            var logRec = record.create({type: "customrecord_swc_task", isDynamic: true});
            // 电商平台（TODO 旺店通内部ID，生产需调整）
            logRec.setValue({fieldId: 'custrecord_swct_platform', value: '3'});
            // 事务类型
            logRec.setText({fieldId: 'custrecord_swct_tran_name', text: options.tranName});
            // 接口执行入参
            if (reqParam) {
                logRec.setValue({fieldId: 'custrecord_swct_input_data', value: JSON.stringify(reqParam)});
            }
            // 接口返回值
            if (respParam) {
                logRec.setValue({fieldId: 'custrecord_swct_output', value: JSON.stringify(respParam)});
            }
            // 最后一次修改时间
            var latModDate = format.format({value: new Date(), type: format.Type.DATETIME});
            logRec.setValue({fieldId: 'custrecord_swct_api_last_modified', value: latModDate});
            if (respParam.code == 0) {
                // 接口执行结果   custrecord_swct_result
                logRec.setValue({fieldId: 'custrecord_swct_result', value: "ok"});
                //任务状态，1.成功，2失败
                logRec.setValue({fieldId: 'custrecord_swct_status', value: 1});
                //接口返回值   custrecord_swct_output
                //newWs.setValue({fieldId: 'custrecord_swct_output', value: informationAll.returnedMessages});
                //接口调用执行完成   custrecord_swct_api_completed
                logRec.setValue({fieldId: 'custrecord_swct_api_completed', value: true});
                //业务执行完成   custrecord_swct_exec_completed
                logRec.setValue({fieldId: 'custrecord_swct_exec_completed', value: true});
            } else {
                //接口执行结果   custrecord_swct_result
                logRec.setValue({fieldId: 'custrecord_swct_result', value: "error"});
                //任务状态，1.成功，2失败 ，3关闭
                logRec.setValue({fieldId: 'custrecord_swct_status', value: 3});
                //接口返回值   custrecord_swct_output
                //newWs.setValue({fieldId: 'custrecord_swct_output', value: informationAll.errorMessage});
                //接口调用执行完成   custrecord_swct_api_completed
                logRec.setValue({fieldId: 'custrecord_swct_api_completed', value: false});
                //接口调用失败次数   custrecord_swct_api_error_count
                logRec.setValue({fieldId: 'custrecord_swct_api_error_count', value: 3});
                //业务执行失败次数   custrecord_swct_exec_error_count
                logRec.setValue({fieldId: 'custrecord_swct_exec_error_count', value: 3});
            }
            logRec.save();
        }

        return {
            exeVendorPush: exeVendorPush
        }

    });
