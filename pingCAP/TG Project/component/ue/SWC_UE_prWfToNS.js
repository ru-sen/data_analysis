/**
 * @NApiVersion 2.0
 * @NScriptType UserEventScript
 * @NModuleScope Public
 * @author yltian
 * @description 采购付款申请单据飞书接口推送
 */
define(["N/runtime", "N/search","N/format", "N/email","N/url","../../common/SWC_OMS_Utils", "N/file", 'N/record', 'N/currency',
        "../../common/SWC_FsPushApprovalCmnToNS", "../../common/SWC_CONFIG_DATA", "../../lib/decimal", "../../common/SWC_Translate"],

    function (runtime, search,format,email,url, SWCommons, file, record, currency, SWC_FsPushApprovalCmn,
              SWC_CONFIG_DATA, decimal, SWC_Translate) {


        /**
         * Defines the function definition that is executed before record is submitted.
         * @param {Object} scriptContext
         * @param {Record} scriptContext.newRecord - New record
         * @param {Record} scriptContext.oldRecord - Old record
         * @param {string} scriptContext.type - Trigger type; use values from the context.UserEventType enum
         * @since 2015.2
         */
        function beforeSubmit(scriptContext) {
            log.audit("执行beforeSubmit", "beforeSubmit");
            var customerRecord = scriptContext.newRecord;
            var oldCustomerRecord = scriptContext.oldRecord;
            var id = customerRecord.id;
            log.audit("id",id);
            try {
                var apwfDetails = customerRecord.getValue({fieldId:"custrecord_apwf_details"});//审批节点
                var empId = "";

                var approver = "";
                if(apwfDetails == "发起"){
                    var buyerId = customerRecord.getValue({fieldId:"custrecord_apwf_buyer"});//提交人ID
                    approver = searchEmpNameById(buyerId);//提交人name
                }else {
                    if(oldCustomerRecord && oldCustomerRecord.getValue({fieldId:"custrecord_apwf_approver"})){
                        empId = oldCustomerRecord.getValue({fieldId:"custrecord_apwf_approver"});//审批人ID
                    }else{
                        empId = customerRecord.getValue({fieldId:"custrecord_apwf_approver"});//审批人ID
                    }
                    approver = searchEmpNameById(empId);//审批人name
                }

                //var billCount = customerRecord.getLineCount({sublistId:"recmachcustrecord_ap_process_key"});//子列表行数
                var processJson = searchApprovalProcess(id);//审批进程
                var billCount = 0;
                if(processJson){
                    billCount = processJson["count"]?processJson["count"]:0;
                }
                log.audit("billCount",billCount);
                var nowTime = formatDate(getDate(8),"yyyy-MM-dd hh:mm");
                // if(billCount>0){
                //     for(var i=0;i<billCount;i++){
                //         var processNode = customerRecord.getSublistValue({sublistId: 'recmachcustrecord_ap_process_key', fieldId: 'custrecord_ap_process_node',line:i});//节点
                //         if(apwfDetails == processNode){
                //             log.audit("存在相同数据-退出脚本",processNode);
                //             return;
                //         }
                //     }
                // }
                if(processJson && processJson["code"] && (processJson["code"]).length>0 && processJson["code"].indexOf(apwfDetails) != -1)return;

                log.audit("apwfDetails",apwfDetails);
                if(apwfDetails == "发起"){
                    customerRecord.setSublistValue({sublistId: 'recmachcustrecord_ap_process_key', fieldId: 'custrecord_ap_process_node',value: "发起",line:billCount});// 节点
                    customerRecord.setSublistValue({sublistId: 'recmachcustrecord_ap_process_key', fieldId: 'custrecord_ap_process_now',value: approver+"/发起审批/"+nowTime,line:billCount});// 节点
                    customerRecord.setSublistValue({sublistId: 'recmachcustrecord_ap_process_key', fieldId: 'custrecord_ap_process_num',value: billCount+1,line:billCount});// 序号

                }
                if(apwfDetails == "Line Manager"){
                    customerRecord.setSublistValue({sublistId: 'recmachcustrecord_ap_process_key', fieldId: 'custrecord_ap_process_node',value: "Line Manager",line:billCount});// 节点
                    customerRecord.setSublistValue({sublistId: 'recmachcustrecord_ap_process_key', fieldId: 'custrecord_ap_process_now',value: approver+"/已通过/"+nowTime,line:billCount});// 节点
                    customerRecord.setSublistValue({sublistId: 'recmachcustrecord_ap_process_key', fieldId: 'custrecord_ap_process_num',value: billCount+1,line:billCount});// 序号
                }
                if(apwfDetails == "Department Leader"){
                    customerRecord.setSublistValue({sublistId: 'recmachcustrecord_ap_process_key', fieldId: 'custrecord_ap_process_node',value: "Department Leader",line:billCount});// 节点
                    customerRecord.setSublistValue({sublistId: 'recmachcustrecord_ap_process_key', fieldId: 'custrecord_ap_process_now',value: approver+"/已通过/"+nowTime,line:billCount});// 节点
                    customerRecord.setSublistValue({sublistId: 'recmachcustrecord_ap_process_key', fieldId: 'custrecord_ap_process_num',value: billCount+1,line:billCount});// 序号
                }
                if(apwfDetails == "Budget Owner"){
                    customerRecord.setSublistValue({sublistId: 'recmachcustrecord_ap_process_key', fieldId: 'custrecord_ap_process_node',value: "Budget Owner",line:billCount});// 节点
                    customerRecord.setSublistValue({sublistId: 'recmachcustrecord_ap_process_key', fieldId: 'custrecord_ap_process_now',value: approver+"/已通过/"+nowTime,line:billCount});// 节点
                    customerRecord.setSublistValue({sublistId: 'recmachcustrecord_ap_process_key', fieldId: 'custrecord_ap_process_num',value: billCount+1,line:billCount});// 序号
                }
                if(apwfDetails == "CEG 审批"){
                    customerRecord.setSublistValue({sublistId: 'recmachcustrecord_ap_process_key', fieldId: 'custrecord_ap_process_node',value: "CEG 审批",line:billCount});// 节点
                    customerRecord.setSublistValue({sublistId: 'recmachcustrecord_ap_process_key', fieldId: 'custrecord_ap_process_now',value: approver+"/已通过/"+nowTime,line:billCount});// 节点
                    customerRecord.setSublistValue({sublistId: 'recmachcustrecord_ap_process_key', fieldId: 'custrecord_ap_process_num',value: billCount+1,line:billCount});// 序号
                }
                if(apwfDetails == "FP&A"){
                    customerRecord.setSublistValue({sublistId: 'recmachcustrecord_ap_process_key', fieldId: 'custrecord_ap_process_node',value: "FP&A",line:billCount});// 节点
                    customerRecord.setSublistValue({sublistId: 'recmachcustrecord_ap_process_key', fieldId: 'custrecord_ap_process_now',value: approver+"/已通过/"+nowTime,line:billCount});// 节点
                    customerRecord.setSublistValue({sublistId: 'recmachcustrecord_ap_process_key', fieldId: 'custrecord_ap_process_num',value: billCount+1,line:billCount});// 序号
                }
                if(apwfDetails == "核算审批"){
                    customerRecord.setSublistValue({sublistId: 'recmachcustrecord_ap_process_key', fieldId: 'custrecord_ap_process_node',value: "核算审批",line:billCount});// 节点
                    customerRecord.setSublistValue({sublistId: 'recmachcustrecord_ap_process_key', fieldId: 'custrecord_ap_process_now',value: approver+"/已通过/"+nowTime,line:billCount});// 节点
                    customerRecord.setSublistValue({sublistId: 'recmachcustrecord_ap_process_key', fieldId: 'custrecord_ap_process_num',value: billCount+1,line:billCount});// 序号
                }
                if(apwfDetails == "Treasury"){
                    customerRecord.setSublistValue({sublistId: 'recmachcustrecord_ap_process_key', fieldId: 'custrecord_ap_process_node',value: "Treasury",line:billCount});// 节点
                    customerRecord.setSublistValue({sublistId: 'recmachcustrecord_ap_process_key', fieldId: 'custrecord_ap_process_now',value: approver+"/已通过/"+nowTime,line:billCount});// 节点
                    customerRecord.setSublistValue({sublistId: 'recmachcustrecord_ap_process_key', fieldId: 'custrecord_ap_process_num',value: billCount+1,line:billCount});// 序号
                }
                if(apwfDetails == "抄送"){
                    customerRecord.setSublistValue({sublistId: 'recmachcustrecord_ap_process_key', fieldId: 'custrecord_ap_process_node',value: "抄送",line:billCount});// 节点
                    customerRecord.setSublistValue({sublistId: 'recmachcustrecord_ap_process_key', fieldId: 'custrecord_ap_process_now',value: "系统/抄送1人刘奇"+nowTime,line:billCount});// 节点
                    customerRecord.setSublistValue({sublistId: 'recmachcustrecord_ap_process_key', fieldId: 'custrecord_ap_process_num',value: billCount+1,line:billCount});// 序号
                }
                if(apwfDetails == "Copy"){
                    customerRecord.setSublistValue({sublistId: 'recmachcustrecord_ap_process_key', fieldId: 'custrecord_ap_process_node',value: "Copy",line:billCount});// 节点
                    customerRecord.setSublistValue({sublistId: 'recmachcustrecord_ap_process_key', fieldId: 'custrecord_ap_process_now',value: "系统/抄送1人刘奇"+nowTime,line:billCount});// 节点
                    customerRecord.setSublistValue({sublistId: 'recmachcustrecord_ap_process_key', fieldId: 'custrecord_ap_process_num',value: billCount+1,line:billCount});// 序号
                }
                if(apwfDetails == "财务付款"){
                    customerRecord.setSublistValue({sublistId: 'recmachcustrecord_ap_process_key', fieldId: 'custrecord_ap_process_node',value: "财务付款",line:billCount});// 节点
                    customerRecord.setSublistValue({sublistId: 'recmachcustrecord_ap_process_key', fieldId: 'custrecord_ap_process_now',value: approver+"/已通过/"+nowTime,line:billCount});// 节点
                    customerRecord.setSublistValue({sublistId: 'recmachcustrecord_ap_process_key', fieldId: 'custrecord_ap_process_num',value: billCount+1,line:billCount});// 序号
                }
            }catch (e) {
                throw "采购付款审批子列表赋值报错,SWC_UE_prWfToNS，报错信息："+e.message;
            }

        }

        /**
         * Defines the function definition that is executed after record is submitted.
         * @param {Object} scriptContext
         * @param {Record} scriptContext.newRecord - New record
         * @param {Record} scriptContext.oldRecord - Old record
         * @param {string} scriptContext.type - Trigger type; use values from the context.UserEventType enum
         * @since 2015.2
         */
        function afterSubmit(scriptContext) {
            var newRec = scriptContext.newRecord;
            var type = scriptContext.type;
            var id = newRec.id;
            if(type == "create"){
                var buyer = newRec.getValue({fieldId: 'custrecord_apwf_buyer'}); // 提交人
                var approver = newRec.getValue({fieldId: 'custrecord_apwf_approver'}); // 审批人
                log.audit(buyer,approver);
                if(buyer && approver){
                    var scheme = 'https://';
                    var host = url.resolveDomain({ hostType: url.HostType.APPLICATION });
                    var relativePath = url.resolveRecord({ recordType: 'customrecord_swc_ap_wf', recordId: id, isEditMode: false });
                    var output = scheme + host + relativePath;//采购付款审批URL
                    email.send({
                        author: buyer,
                        recipients: approver,
                        subject: "Purchase Payment Request has been created successfully",//采购付款审批创建成功
                        body: "Purchase Payment Request has been created successfully. Internal ID: "+id+". "+output//采购付款审批创建成功
                    });
                    log.audit("邮件发送成功",output);
                }
            }

        }

        //根据员工id查名称
        function searchEmpNameById(id) {
            if(!id)return "";
            var employeeSearchObj = search.create({
                type: "employee",
                filters:
                    [
                        ["internalid","anyof",id]
                    ],
                columns:
                    [
                        search.createColumn({name: "entityid", sort: search.Sort.ASC, label: "名称"})
                    ]
            });
            var results = getAllResults(employeeSearchObj);
            var name = results[0].getValue({name: "entityid", sort: search.Sort.ASC, label: "名称"});
            return name;
        }

        //审批进程
        function searchApprovalProcess(id){
            if(!id)return "";
            var customrecord_swc_approval_processSearchObj = search.create({
                type: "customrecord_swc_approval_process",
                filters:
                    [
                        ["custrecord_ap_process_key","anyof",id]
                    ],
                columns:
                    [
                        search.createColumn({
                            name: "scriptid",
                            sort: search.Sort.ASC,
                            label: "脚本 ID"
                        }),
                        search.createColumn({name: "custrecord_ap_process_num", label: "序号"}),
                        search.createColumn({name: "custrecord_ap_process_node", label: "节点"}),
                        search.createColumn({name: "custrecord_ap_process_key", label: "采购付款审批（主表）"})
                    ]
            });
            var processJson = {};
            var searchResultCount = customrecord_swc_approval_processSearchObj.runPaged().count;
            processJson["count"] = searchResultCount;
            var processCodeArr = [];
            if(searchResultCount>0){
                var results = getAllResults(customrecord_swc_approval_processSearchObj);
                for (var i = 0; i < results.length; i++) {
                    var name = results[i].getValue({name: "custrecord_ap_process_node", label: "节点"});
                    if(name)processCodeArr.push(name);
                }
            }
            processJson["code"] = processCodeArr;
            return processJson;
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

        function getDate(timeZone) {
            var date = new Date();
            var utcTime = date.getTime() + date.getTimezoneOffset() * 60 * 1000;
            var tzTime = utcTime + timeZone * 60 * 60 * 1000;
            return new Date(tzTime);
        }

        function to2Digits(num) {
            return (num < 10 ? "0" : "") + num;
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

        return {
            beforeSubmit:beforeSubmit,
            afterSubmit:afterSubmit
        };

    });
