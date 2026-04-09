/**
 * @NApiVersion 2.1
 * @NScriptType mapreducescript
 * @NModuleScope Public
 */
define(["N/runtime","N/record","N/search"],
    /**
     *  取消成本分摊对应的所有已标记的工单
     */
    function(runtime,record,search){
        return {
            getInputData: function (context)
            {
                try {
                    var params = JSON.parse(getScriptParams());
                    log.audit("params",params);
                    var idArr = params.idArr;//需要修改的部门内部ID
                    log.audit("idArr",idArr);
                    log.audit("idArrtype",typeof params);

                    var isinactivedept = params.isinactivedept;//查询的非活动状态
                    var maps = new Map();
                    for(var i=0;i<idArr.length;i++){
                        maps.set(idArr[i],isinactivedept);
                    }
                    return Array.from(maps);
                }catch (e) {
                    log.audit("批量修改部门信息报错，getInputData部分，报错信息",e.message);
                    throw "批量修改部门信息报错，getInputData部分，报错信息："+e.message;
                }
            },
            map: function (context)
            {
                try {
                    var options = JSON.parse(context.value);
                    log.audit("options0", options[0]);
                    log.audit("options1", options[1]);
                    var deptRec = record.load({id:options[0],type:'department',isDynamic:true});
                    if(options[1] == "T"){
                        deptRec.setValue({fieldId:"isinactive",value:false});//非活动
                    }else if(options[1] == "F"){
                        deptRec.setValue({fieldId:"isinactive",value:true});//非活动
                    }
                    deptRec.save();
                    context.write({key: options[0],value: options[1]});
                }catch (e) {
                    throw "批量修改部门信息报错，map部分，报错信息："+e.message;

                }
            },

            summarize: function (summary)
            {
                if(summary.inputSummary.error) {
                    log.audit("执行失败",JSON.parse(summary.inputSummary.error).message);
                    var deptStatusRec = record.load({id:1,type:'customrecord_dept_status',isDynamic:true});//执行状态
                    deptStatusRec.setValue({fieldId:"custrecord_status",value:JSON.parse(summary.inputSummary.error).message.slice(0,1000)})
                    deptStatusRec.save();
                    return;
                }

                var errors = [];
                summary.mapSummary.errors.iterator().each(function(key,error){
                    log.audit({title:key,details:error});
                    errors.push(error)
                    return true;
                });

                if(errors.length<1){
                    log.audit("执行成功","执行成功");
                    var deptStatusRec = record.load({id:1,type:'customrecord_dept_status',isDynamic:true});//执行状态
                    deptStatusRec.setValue({fieldId:"custrecord_status",value:"执行完成"})
                    deptStatusRec.save();
                }else {
                    var deptStatusRec = record.load({id:1,type:'customrecord_dept_status',isDynamic:true});//执行状态
                    deptStatusRec.setValue({fieldId:"custrecord_status",value:"执行失败，失败原因："+(errors.toString().replace(/,/g, '')).slice(0,1000)});
                    deptStatusRec.save();
                }
                log.audit("summary.errors", errors);
            }

        }

        /**
         *通用功能模块
         */
        //获得参数
        function getScriptParams() {
            return JSON.parse(
                runtime.getCurrentScript().getParameter({name: "custscript_params"}) ||
                '[]'
            );
        }

    });