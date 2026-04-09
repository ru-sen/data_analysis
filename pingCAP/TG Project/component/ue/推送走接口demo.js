/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @NModuleScope Public
 */
var headers = {"Content-Type":"application/json","Accept":"*/*"};
define(["N/search", "N/record", "N/format","N/cache","N/https","../../common/SWC_OMS_Utils"],
    function (search, record, format, cache,https,SWC_OMS_Utils) {

        /**
         * Function definition to be triggered before record is loaded.
         *
         * @param {Object} scriptContext
         * @param {Record} scriptContext.newRecord - New record
         * @param {Record} scriptContext.oldRecord - Old record
         * @param {string} scriptContext.type - Trigger type
         * @Since 2015.2
         */
        function beforeSubmit(scriptContext) {

        }
        /**
         * Function definition to be triggered before record is loaded.
         *
         * @param {Object} scriptContext
         * @param {Record} scriptContext.newRecord - New record
         * @param {Record} scriptContext.oldRecord - Old RECORD
         * @param {string} scriptContext.type - Trigger TYPE
         * @Since 2015.2
         */
        function afterSubmit(scriptContext) {

            var newRecord = scriptContext.newRecord;
            var synchronizationBoo = newRecord.getValue({fieldId:"custrecord_swcrl_synchstate"});
            var accountId = newRecord.getValue({fieldId:"custrecord_swcrl_account"});
            var swcrlType = newRecord.getValue({fieldId:"custrecord_swcrl_type"});
            var tradetype = newRecord.getValue({fieldId:"custrecord_swcrl_tradetype"});
            var payname = newRecord.getValue({fieldId: "custrecord_swcrl_payname"});              //付款名
            var memo = newRecord.getValue({fieldId: "custrecord_swcrl_naryur"});          //摘要说明
            log.audit("synchronizationBoo",synchronizationBoo);
            var isTrue = isFilters(memo);
            log.audit("memo",memo);
            log.audit("isTrue",isTrue);
            if(isTrue)
            {
                return true;
            }
            var isTradetype = checkTradetype(tradetype);//交易类型代码校验
            if(scriptContext.type == "create" || scriptContext.type == "edit")
            {
                if(!synchronizationBoo)//同步状态 = false
                {
                    if(swcrlType == "1")//收入
                    {
                        if(isTradetype)//交易类型代码校验结果为true
                        {
                            if(payname)
                            {
                                if(payname != "待报解预算收入-电子退库" && payname != "待报解预算收入-海淀支库")
                                {
                                    var isPayNameCheck = false;
                                    var employeeResults = SWC_OMS_Utils.searchEmployee("",payname);
                                    if(employeeResults && employeeResults.length > 0)
                                    {//校验是不是员工个人打款
                                        isPayNameCheck = true;
                                    }
                                    if(!isPayNameCheck)
                                    {//校验是不是公司内部交易
                                        var subsidiaryJson = SWC_OMS_Utils.getSubsidiayId();
                                        if(subsidiaryJson[payname])
                                        {
                                            isPayNameCheck = true;
                                        }
                                    }
                                    if(!isPayNameCheck)
                                    {
                                        var bankName = "";
                                        var bankNumber = "";
                                        var bankPayName = "";

                                        if(accountId)
                                        {
                                            var accountLookUp = search.lookupFields({
                                                type: search.Type.ACCOUNT,
                                                id: accountId,
                                                columns: ["custrecord_swc_bank_name", "custrecord_swc_bank_number", "custrecord_swc_bank_payname","subsidiary"]
                                            });
                                            bankName = accountLookUp.custrecord_swc_bank_name;
                                            bankNumber = accountLookUp.custrecord_swc_bank_number;
                                            bankPayName = accountLookUp.custrecord_swc_bank_payname;
                                            var subsidiary = accountLookUp.subsidiary[0].value;
                                            if(subsidiary != 2)
                                            {
                                                //NPT2、CPUA 销售收入
                                                var getTokenData = {
                                                    "appId": "FSAID_1319eb9",
                                                    "appSecret":"e603a183a4b54dbdbebdb09509cdd63a",
                                                    "permanentCode":"A9237E39459787ADEF4F9199E7870F01"
                                                };
                                                var tokenJson = https.post({
                                                    url: "https://open.fxiaoke.com/cgi/corpAccessToken/get/V2",
                                                    headers: headers,
                                                    body: JSON.stringify(getTokenData)
                                                });
                                                var tokenStr = JSON.parse(tokenJson.body).corpAccessToken;
                                                var corpIdStr = JSON.parse(tokenJson.body).corpId;
                                                var number = newRecord.getValue({fieldId: "custrecord_swcrl_number"});                //流水号
                                                var paynumber = newRecord.getValue({fieldId: "custrecord_swcrl_paynumber"});          //卡号
                                                var creationdate = newRecord.getValue({fieldId: "custrecord_swcrl_creationdate"});    //创建时间
                                                var payamount = newRecord.getValue({fieldId: "custrecord_swcrl_payamount"});          //金额
                                                var dataObj = {};
                                                dataObj["corpAccessToken"] = tokenStr;
                                                dataObj["corpId"] = corpIdStr;
                                                //dataObj["currentOpenUserId"] = "FSUID_1427E9DB0AEFFD34C35BD14A8224D70B";
                                                dataObj["currentOpenUserId"] = "FSUID_1427E9DB0AEFFD34C35BD14A8224D70B";
                                                dataObj.data = {};
                                                dataObj.data["object_data"] = {};
                                                dataObj.data["object_data"]["owner"] = ["FSUID_1427E9DB0AEFFD34C35BD14A8224D70B"]
                                                dataObj.data["object_data"]["field_zCoU2__c"] = Number(getDateObj(creationdate)) + "";                           //回款时间
                                                //dataObj.data["field_zCoU2__c"] = 1626857909845 + "";                           //回款时间
                                                dataObj.data["object_data"]["field_ywdPY__c"] = Number(payamount);                                                  //回款金额
                                                dataObj.data["object_data"]["field_1r5aO__c"] = number;                                                     //银行汇款流水号，要保证唯一性
                                                dataObj.data["object_data"]["field_gQD20__c"] = payname;                      //客户名称
                                                dataObj.data["object_data"]["field_emMCs__c"] = payname;                                                    //入账名称
                                                dataObj.data["object_data"]["dataObjectApiName"] = "object_q82qo__c";                                       //api名称
                                                dataObj.data["object_data"]["field_v8Wlh__c"] = bankPayName;//入账户名
                                                dataObj.data["object_data"]["field_acemw__c"] = bankNumber;//入账账号
                                                dataObj.data["object_data"]["field_FYylo__c"] = bankName;//入账银行
                                                dataObj.data["details"] = {};
                                                var options = {
                                                    platform: "fxiaoke",
                                                    tranName: "sendTheAmount",
                                                    data: dataObj,
                                                    code:newRecord.id,
                                                    skipMapping:true,
                                                };
                                                SWC_OMS_Utils.createAndExecTask(options);
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
        /*function getDateObj(dateStr) {
            var yy = dateStr.substring(0,4);
            var mm = dateStr.substring(4,6);
            var dd = dateStr.substring(6,8);
            var dateString = yy + "/" + mm + "/" + dd;
            log.debug("dateString",JSON.stringify(dateString));
            var dateHK = format.format({value : new Date(yy + "/" + mm + "/" + dd), type : format.Type.DATETIME, timezone : format.Timezone.ASIA_HONG_KONG}).split(" ")[0];
            var dateObj = format.parse({value:dateHK,type:format.Type.DATE});
            log.debug("dateObj",JSON.stringify(dateObj));
            return dateObj;
        }*/
        /**
         * ONTX 税款
         * FENC 网银费用
         * CPAJ 支付平台退款
         * IINT 账户结息
         * @param tradetype
         * @returns {boolean}
         */
        function checkTradetype(tradetype)
        {
            if(tradetype != 'CPAJ'&& tradetype != 'IINT' && tradetype != "N6TP")
            {
                return true;
            }
        }
        function getDateObj(dateStr) {
            var yy = dateStr.substring(0,4);
            var mm = dateStr.substring(4,6);
            var dd = dateStr.substring(6,8);
            var hh = dateStr.substring(8,10);
            var ff = dateStr.substring(10,12);
            var ss = dateStr.substring(12,14);
            //var dateString = yy + "/" + mm + "/" + dd;
            //log.debug("dateString",JSON.stringify(dateString));
            //var dateHK = format.format({value : yy + "/" + mm + "/" + dd+" "+ hh+":" +ff+":"+ss, type : format.Type.DATETIME, timezone : format.Timezone.ASIA_HONG_KONG});
            //var dateObj = format.parse({value:dateHK,type:format.Type.DATETIME});
            //log.debug("dateObj",JSON.stringify(dateObj));
            var dateObj = new Date(yy + "/" + mm + "/" + dd+" "+ hh+":" +ff+":"+ss);
            log.debug("dateObj",JSON.stringify(dateObj));
            dateObj.setHours(dateObj.getHours() -15);
            log.debug("dateObj",JSON.stringify(dateObj));
            return dateObj;
        }
        function getCustomerName(cusId) {
            var customerName = '';
            var customerSearchObj = search.create({
                type: "customer",
                filters: [["internalid","anyof",cusId]],
                columns: [search.createColumn({name: "companyname", label: "公司名称"})]
            });
            result = customerSearchObj.run().getRange({start: 0, end: 1});
            if(result.length > 0) {
                customerName = result[0].getValue({name: "companyname", label: "公司名称"});
            }
            return customerName;
        }

        /**
         * 同步至纷享销客的条件限制
         * 摘要里有”电子退库“和“退款”、“退电费”（C0520000033509C）、“退保证金”（G9790700146947C）的不要推到纷享销客回款池
         */
        function isFilters(memo)
        {
            if(memo.indexOf("退款") >= 0 || memo.indexOf("冲账") >= 0 || memo.indexOf("退回") >= 0 || memo.indexOf("退保") >= 0)
            {
                return true;
            }
            return false;
        }

        return {
            beforeSubmit: beforeSubmit,
            afterSubmit: afterSubmit,
        };

    });