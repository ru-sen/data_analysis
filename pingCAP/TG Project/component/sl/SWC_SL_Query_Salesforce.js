/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @NModuleScope Public
 */
define(["N/runtime","N/task","N/record","N/format","N/search","N/http","N/https","N/ui/serverWidget", "N/redirect" ,"../../common/Commons.js","../../common/SWC_OMS_Utils.js","../../lib/underscore.js"],
    function(runtime,task,record,format,search,http,https,serverWidget,redirect,Commons,SWCommons)
    {

        /**
         * Salesforce
         *  按页面展示数据拉取Salesforce
         * @param {Object} context
         * @param {ServerRequest} context.request - Encapsulation of the incoming request
         * @param {ServerResponse} context.response - Encapsulation of the Suitelet response
         * @Since 2015.2
         */
        function onRequest(context) {
            if(context.request.method == "GET") {
                var form = serverWidget.createForm({title: "Salesforce单据拉取"});
                form.clientScriptModulePath = '../cs/SWC_CS_Query_Salesforce';
                form.addSubmitButton({label:"拉取数据"});
                form.addField({id:'custpage_month',label:"账期",type:'SELECT',source:'accountingperiod'}).updateLayoutType({layoutType:serverWidget.FieldLayoutType.OUTSIDEABOVE});
                form.addField({id:'custpage_start',label:"开始时间",type:'DATE'});
                form.addField({id:'custpage_end',label:"结束时间",type:'DATE'});
                var subsidiaryField = form.addField({id:'custpage_subsidiary',label:"公司主体",type:'SELECT'});
                subsidiaryField.addSelectOption({value : "all", text : '全部'});
                var subsidiaryArr = Commons.srchMappingSubsidiary();
                log.audit("subsidiaryArr",subsidiaryArr);
                if(subsidiaryArr.length>0){
                    for(var i=0;i<subsidiaryArr.length;i++){
                        subsidiaryField.addSelectOption({value : subsidiaryArr[i].salesforceName, text :subsidiaryArr[i].nsName});
                    }
                }
                var selectField = form.addField({id:'custpage_type',label:'操作类型',type:serverWidget.FieldType.SELECT});
                selectField.addSelectOption({value : "", text : '请选择'});
                selectField.addSelectOption({value : "search", text : '获取订单'});
                //selectField.addSelectOption({value : "update", text : '更新订单'});
                selectField.addSelectOption({value : "delete", text : '删除订单'});
                //selectField.defaultValue = formType;

                var sublist = form.addSublist({id: 'custpage_sublist', type: serverWidget.SublistType.LIST, label: '操作明细'});

                //sublist.addField({id:'custpage_month',label:'账期',type:serverWidget.FieldType.TEXT});
                sublist.addField({id:'custpage_exetime',label:'执行时间',type:serverWidget.FieldType.TEXT});
                sublist.addField({id:'custpage_isfinish',label:'是否已完成',type:serverWidget.FieldType.TEXT});
                sublist.addField({id:'custpage_exeperson',label:'执行人',type:serverWidget.FieldType.TEXT});
                sublist.addField({id:'custpage_startdate',label:'开始时间',type:serverWidget.FieldType.TEXT});
                sublist.addField({id:'custpage_enddate',label:'结束时间',type:serverWidget.FieldType.TEXT});

                // 字列表展示自定义记录 一件代发操作记录 内容
                var sublistArr = [];
                var customrecord_swc_whole_sale_recordSearchObj = search.create({
                    type: "customrecord_swc_whole_sale_record",
                    filters: [],
                    columns:
                        [
                            search.createColumn({name: "custrecord_swc_whole_sale_month", label: "月份"}),
                            search.createColumn({name: "custrecord_swc_whole_sale_date", label: "执行时间"}),
                            search.createColumn({name: "custrecord_swc_whole_sale_person", label: "执行人"}),
                            search.createColumn({name: "internalid", sort: search.Sort.DESC, label: "内部 ID"}),
                            search.createColumn({name: "custrecord_swctt_completed", join: "CUSTRECORD_SWC_WHOLE_SALE_TRACKER", label: "是否已完成"}),
                            search.createColumn({name: "custrecord_swc_whole_sale_startdate", label: "开始时间"}),
                            search.createColumn({name: "custrecord_swc_whole_sale_enddate", label: "结束时间"})

                        ]
                });
                customrecord_swc_whole_sale_recordSearchObj.run().each(function(result) {
                    sublistArr.push({
                        "month":result.getValue({name: "custrecord_swc_whole_sale_month"}),
                        "date":result.getValue({name: "custrecord_swc_whole_sale_date"}),
                        "startDate":result.getValue({name: "custrecord_swc_whole_sale_startdate"}),
                        "endDate":result.getValue({name: "custrecord_swc_whole_sale_enddate"}),
                        "finish":result.getValue({name: "custrecord_swctt_completed", join: "CUSTRECORD_SWC_WHOLE_SALE_TRACKER"}),
                        "person":result.getText({name: "custrecord_swc_whole_sale_person"})
                    })
                    return true;
                });

                for(var i = 0; i < sublistArr.length; i++) {
                    if(sublistArr[i]["month"]) sublist.setSublistValue({id:"custpage_month",line:i,value:sublistArr[i]["month"]});
                    if(sublistArr[i]["date"]) sublist.setSublistValue({id:"custpage_exetime",line:i,value:sublistArr[i]["date"]});
                    if(sublistArr[i]["finish"] == "true"  || sublistArr[i]["finish"] == true) {
                        sublist.setSublistValue({id:"custpage_isfinish",line:i,value:"是"});
                    } else {
                        sublist.setSublistValue({id:"custpage_isfinish",line:i,value:"否"});
                    }
                    if(sublistArr[i]["person"]) sublist.setSublistValue({id:"custpage_exeperson",line:i,value:sublistArr[i]["person"]});
                    if(sublistArr[i]["startDate"]) sublist.setSublistValue({id:"custpage_startdate",line:i,value:sublistArr[i]["startDate"]});
                    if(sublistArr[i]["endDate"]) sublist.setSublistValue({id:"custpage_enddate",line:i,value:sublistArr[i]["endDate"]});
                }

                context.response.writePage({pageObject : form});
            } else {
                var startDate = context.request.parameters.custpage_start;
                startDate = format.parse({value:startDate,type:format.Type.DATE});
                var endDate = context.request.parameters.custpage_end;
                endDate = format.parse({value:endDate,type:format.Type.DATE});
                var type = context.request.parameters.custpage_type;
                var subsidiary = context.request.parameters.custpage_subsidiary;

                // var endDate1 = getThisDate(8);

                var today = getThisDate(8);
                // log.audit("getFullYear",today.getFullYear())
                // log.audit("getMonth",today.getMonth()+1)
                // log.audit("getDate",today.getDate())
                // log.audit("getHours",today.getHours())
                // log.audit("getMinutes",today.getMinutes())
                // log.audit("getSeconds",today.getSeconds())

                log.audit("endDate",endDate)
                log.audit("today",today)
                log.audit("endDate > today",endDate > today)
                log.audit("type",type)
                log.audit("subsidiary",subsidiary)


                // 如果选择的结束日期比现在大。结束日期默认为现在
                if(endDate > today) {
                    endDate = today;
                }

                // 如果选择的是之前的月份。
                if((Number(endDate.getMonth())+1) < (Number(today.getMonth())+1)) {
                    endDate.setDate(endDate.getDate()+1);
                    endDate.setSeconds(endDate.getSeconds()-1);
                } else {
                    // 如果当月，且为今天。时分秒等于现在
                    if((Number(endDate.getDate())) == (Number(today.getDate()))) {
                        endDate = today;
                    }
                }


                var startStr = "" + startDate.getFullYear() + zeroPush(startDate.getMonth()+1) + zeroPush(startDate.getDate()) + "000000";
                var endStr = "" + endDate.getFullYear() + zeroPush(endDate.getMonth()+1) + zeroPush(endDate.getDate()) +  zeroPush(endDate.getHours())+ zeroPush(endDate.getMinutes())+ zeroPush(endDate.getSeconds());
                log.audit("startStr",startStr)
                log.audit("endStr",endStr)


                if(type == "search"){
                    // 创建tracker--getSalesforceQueryList
                    var trackerRec = record.create({type:"customrecord_swc_task_tracker"});
                    trackerRec.setValue({fieldId:"custrecord_swctt_platform",value:"2"}); // Salesforce
                    trackerRec.setValue({fieldId:"custrecord_swctt_type",value:"33"}); // getSalesforceQueryList
                    trackerRec.setValue({fieldId:"custrecord_swctt_start",value:startStr});
                    trackerRec.setValue({fieldId:"custrecord_swctt_end",value:endStr});
                    trackerRec.setValue({fieldId:"custrecord_custom_req_cond",value:subsidiary});
                    var trackerRecId = trackerRec.save();

                    // 创建tracker--getSalesforceCollectionList
                    var trackerRec = record.create({type:"customrecord_swc_task_tracker"});
                    trackerRec.setValue({fieldId:"custrecord_swctt_platform",value:"2"}); // Salesforce
                    trackerRec.setValue({fieldId:"custrecord_swctt_type",value:"140"}); // getSalesforceCollectionList
                    trackerRec.setValue({fieldId:"custrecord_swctt_start",value:startStr});
                    trackerRec.setValue({fieldId:"custrecord_swctt_end",value:endStr});
                    trackerRec.setValue({fieldId:"custrecord_custom_req_cond",value:subsidiary});
                    var trackerRecId = trackerRec.save();

                    // 创建操作记录
                    var operationRec = record.create({type:"customrecord_swc_whole_sale_record"});
                    operationRec.setValue({fieldId:"custrecord_swc_whole_sale_month",value:startDate.getFullYear()+"年"+(startDate.getMonth()+1)+"月"});
                    operationRec.setValue({fieldId:"custrecord_swc_whole_sale_person",value:runtime.getCurrentUser().id});
                    operationRec.setValue({fieldId:"custrecord_swc_whole_sale_tracker",value:trackerRecId});
                    operationRec.setValue({fieldId:"custrecord_swc_whole_sale_startdate",value:stringToDate(startStr)});
                    operationRec.setValue({fieldId:"custrecord_swc_whole_sale_enddate",value:stringToDate(endStr)});

                    operationRec.save();
                }else if(type == "delete"){
                    // 创建tracker
                    var trackerRec = record.create({type:"customrecord_swc_task_tracker"});
                    trackerRec.setValue({fieldId:"custrecord_swctt_platform",value:"2"}); // Salesforce
                    trackerRec.setValue({fieldId:"custrecord_swctt_type",value:"138"}); // getSalesforceDeleteList
                    trackerRec.setValue({fieldId:"custrecord_swctt_start",value:startStr});
                    trackerRec.setValue({fieldId:"custrecord_swctt_end",value:endStr});
                    trackerRec.save();
                }

                redirect.toSuitelet({
                    scriptId: 'customscript_swc_sl_query_salesforce',
                    deploymentId: 'customdeploy_swc_sl_query_salesforce',
                    parameters:{'flag':'a'}
                });
            }
        }


        function stringToDate(str) {
            var year = str.substr(0, 4);
            var month = str.substr(4, 2);
            var day = str.substr(6, 2);
            var hours = str.substr(8, 2);
            var mins = str.substr(10, 2);
            var seconds = str.substr(12, 2);
            return ""+ year +"-"+month +"-"+day +" "+hours +":"+mins +":"+seconds;
        }

        function zeroPush(string) {
            if(String(string).length == 1) {
                return "0"+string;
            } else {
                return string;
            }
        }

        function getThisDate(timeZone) {
            var date = new Date();
            var utcTime = date.getTime() + date.getTimezoneOffset() * 60 * 1000;
            var tzTime = utcTime + timeZone * 60 * 60 * 1000;
            return new Date(tzTime);
        }
        return {
            onRequest: onRequest
        };
    });