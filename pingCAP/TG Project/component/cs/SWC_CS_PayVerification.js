/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 * @NModuleScope SameAccount
 */
define(["N/ui/dialog","N/runtime",'../ue/SWC_UE_PayVerification.js'],

    function(dialog,runtime,PayVerification) {
        /**
         * Validation function to be executed when record is saved.
         *
         * @param {Object} scriptContext
         * @param {Record} scriptContext.currentRecord - Current form record
         * @returns {boolean} Return true if record is valid
         *
         * @since 2015.2
         */
        function saveRecord(scriptContext) {
            var currentRec =  scriptContext.currentRecord;
            debugger;
            var language = runtime.getCurrentUser().getPreference({name:"language"});//获取语言
            var obj = PayVerification.verifyRequiredMessage(currentRec,language);
            if (obj.msg.length>0) {
                let res ={
                    title:obj.title,
                    message:obj.msg
                }
                dialog.alert(res);
            }else {
                return true;
            }
        }
        return {
            saveRecord: saveRecord
        };

    });
