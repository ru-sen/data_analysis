/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @NModuleScope Public
 */
define(["N/runtime","N/task","N/record","N/format","N/search","N/http","N/https","N/ui/serverWidget"],
    function(runtime,task,record,format,search,http,https,serverWidget)
    {

        /**
         * 非活动部门批量操作
         * @param {Object} context
         * @param {ServerRequest} context.request - Encapsulation of the incoming request
         * @param {ServerResponse} context.response - Encapsulation of the Suitelet response
         * @Since 2015.2
         */
        function onRequest(context) {
            var request = context.request;
            var isinDept = "T";
            if(context.request.method == "GET") {
                isinDept = request.parameters.isinactivedept ? request.parameters.isinactivedept : "";//非活动部门
            }
            if(context.request.method == "POST") {
                try {
                    log.audit("requestbody",request.body);
                    var body = request.body?JSON.parse(request.body):request.body;
                    log.audit("params",body.params);
                    var params = body.params ? JSON.parse(body.params) : "";
                    isinDept = params ? params.isinactivedept : "";//非活动部门
                    var mrTask = task.create({
                        taskType: task.TaskType.MAP_REDUCE,
                        scriptId: 'customscript_swc_mr_isinactivedept',
                        deploymentId: 'customdeploy_swc_mr_isinactivedept',
                        params: {custscript_params: JSON.stringify(body.params)},
                    });
                    var taskid = mrTask.submit();
                    log.audit("执行task", taskid);
                    var deptStatusRec = record.load({id:1,type:'customrecord_dept_status',isDynamic:true});//执行状态
                    var newStatus = deptStatusRec.getValue({fieldId:"custrecord_status"});
                    if(newStatus =="执行中"){
                        context.response.write(JSON.stringify({"message":"有正在执行的数据请勿重复操作！"}));
                        return;
                    }
                    deptStatusRec.setValue({fieldId:"custrecord_status",value:"执行中"})
                    deptStatusRec.save();
                    context.response.write(JSON.stringify({"message":"数据正在执行中..."}));
                    return;
                }catch (e) {
                    context.response.write(JSON.stringify({"message":e.message}));
                    return;
                }

            }
            try {
                log.audit("isinDept",isinDept);
                var form = serverWidget.createForm({title: "部门批量操作"});
                var hidden_field = form.addField({ id:'hidden_info',type:serverWidget.FieldType.INLINEHTML,label:'读取中...'});
                hidden_field.defaultValue = '<div id="timeoutblocker" style="position: fixed; z-index: 10000; top: 0px; left: 0px; height: 100%; ' +
                    'width: 100%; margin: 5px 0px; background-color: rgb(155, 155, 155); opacity: 0.6;"><span style="width:100%;height:100%;' +
                    'line-height:700px;text-align:center;display:block;font-weight: bold; color: red">读取中...</span></div>';
                form.clientScriptModulePath = '../cs/SWC_CS_IsInactiveDept';
                //form.addSubmitButton({label:"查询"});
                form.addButton({id: 'custpage_search', label: "刷新", functionName: "toShow()"});
                form.addButton({id: 'custpage_create', label: "提交", functionName: "toCreate()"});
                var isinactiveDept = form.addField({id:'custpage_isinactivedept',label:'非活动部门',type:serverWidget.FieldType.CHECKBOX});
                if(isinDept){
                    isinactiveDept.defaultValue = isinDept;
                }else {
                    isinactiveDept.defaultValue = "T";
                }

                var status = form.addField({id:'custpage_status',label:'执行状态',type:serverWidget.FieldType.TEXT}).updateDisplayType({displayType: serverWidget.FieldDisplayType.DISABLED});
                var deptStatusNewRec = record.load({id:1,type:'customrecord_dept_status',isDynamic:true});//执行状态
                var custrecord_status = deptStatusNewRec.getValue({fieldId:"custrecord_status"});
                if(custrecord_status)status.defaultValue = custrecord_status;
                var sublist = form.addSublist({id: 'custpage_sublist', type: serverWidget.SublistType.LIST, label: '明细'});
                sublist.addButton({id: "custpage_subbtn_allcheck", label: "全选", functionName: "allCheck()"});
                sublist.addButton({id: "custpage_subbtn_deallcheck", label: "取消全选", functionName: "deAllCheck()"});
                if(custrecord_status == "执行中"){
                    sublist.addField({id:'custpage_checkbox',label:'勾选框',type:serverWidget.FieldType.CHECKBOX}).updateDisplayType({displayType: serverWidget.FieldDisplayType.DISABLED});
                }else {
                    sublist.addField({id:'custpage_checkbox',label:'勾选框',type:serverWidget.FieldType.CHECKBOX});
                }
                sublist.addField({id:'custpage_id',label:'id',type:serverWidget.FieldType.TEXT}).updateDisplayType({displayType: serverWidget.FieldDisplayType.HIDDEN});
                sublist.addField({id:'custpage_name',label:'名称',type:serverWidget.FieldType.TEXT});
                sublist.addField({id:'custpage_isinactive',label:'非活动',type:serverWidget.FieldType.CHECKBOX}).updateDisplayType({displayType: serverWidget.FieldDisplayType.DISABLED});
                sublist.addField({id:'custpage_code',label:'部门编码',type:serverWidget.FieldType.TEXT});
                sublist.addField({id:'custpage_idname',label:'COST CENTER ID + NAME',type:serverWidget.FieldType.TEXT});
                sublist.addField({id:'custpage_type',label:'部门类型',type:serverWidget.FieldType.TEXT});
                var filters = [];
                if(isinDept){
                    filters.push(["isinactive","is",isinDept])
                }else {
                    filters.push(["isinactive","is","T"])
                }
                // 字列表展示自定义记录 一件代发操作记录 内容
                var departmentSearchObj = search.create({
                    type: "department",
                    filters:filters,
                    columns:
                        [
                            search.createColumn({name: "internalid", label: "内部 ID"}),
                            search.createColumn({name: "name", label: "名称"}),
                            search.createColumn({name: "isinactive", label: "非活动"}),
                            search.createColumn({name: "custrecord_swc_id", label: "部门编码"}),
                            search.createColumn({name: "custrecord_swc_costcenterid", label: "Cost Center ID + Name"}),
                            search.createColumn({name: "custrecord_swc_department_type", label: "部门类型"})
                        ]
                });
                var i =0;
                var searchResultCount = departmentSearchObj.runPaged().count;
                log.audit("searchResultCount",searchResultCount);
                var results = getAllResults(departmentSearchObj)
                for(var key in results){
                    sublist.setSublistValue({id:"custpage_id",line:i,value:results[key].getValue({name: "internalid", label: "内部 ID"})});
                    sublist.setSublistValue({id:"custpage_name",line:i,value:results[key].getValue({name: "name", label: "名称"})});
                    results[key].getValue({name: "isinactive", label: "非活动"})?sublist.setSublistValue({id:"custpage_isinactive",line:i,value:"T"}):sublist.setSublistValue({id:"custpage_isinactive",line:i,value:"F"});
                    //sublist.setSublistValue({id:"custpage_parent",line:i,value:results[key].getValue({name: "internalid", label: "内部 ID"})});
                    if(results[key].getValue({name: "custrecord_swc_id", label: "部门编码"})){
                        sublist.setSublistValue({id:"custpage_code",line:i,value:results[key].getValue({name: "custrecord_swc_id", label: "部门编码"})});
                    }
                    if(results[key].getValue({name: "custrecord_swc_costcenterid", label: "Cost Center ID + Name"})){
                        sublist.setSublistValue({id:"custpage_idname",line:i,value:results[key].getValue({name: "custrecord_swc_costcenterid", label: "Cost Center ID + Name"})});
                    }
                    if(results[key].getText({name: "custrecord_swc_department_type", label: "部门类型"})){
                        sublist.setSublistValue({id:"custpage_type",line:i,value:results[key].getText({name: "custrecord_swc_department_type", label: "部门类型"})});
                    }
                    i++;
                }
            }catch (e) {
                var deptStatusRec = record.load({id:1,type:'customrecord_dept_status',isDynamic:true});//执行状态
                deptStatusRec.setValue({fieldId:"custrecord_status",value:"执行失败，失败原因："+e.message.slice(0,1000)});
                deptStatusRec.save();
            }

            context.response.writePage({pageObject : form});

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


        return {
            onRequest: onRequest
        };
    });