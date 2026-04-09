/**
 * @NApiVersion 2.0
 * @NScriptType UserEventScript
 * @NModuleScope Public
 */
define(["N/search",'N/record'],

    function (search,record) {

        //部门为admin的时候 保存如果是非活动 取消勾选
        function beforeSubmit(context) {
                var customerRecord = context.newRecord;
                var isinactive = customerRecord.getValue({fieldId:"isinactive"});//非活动
               var id = customerRecord.id
                log.audit("isinactive",isinactive);
                          log.audit("id",id);
          if (id = 401) {
            if(isinactive)customerRecord.setValue({fieldId:"isinactive",value:false});
          }
                
        }

        return {
            beforeSubmit :beforeSubmit
        };

    });
