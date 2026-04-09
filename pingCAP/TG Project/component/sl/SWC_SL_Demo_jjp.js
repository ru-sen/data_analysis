/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @NModuleScope Public
 */
define(["N/task","N/record","N/format","N/search","N/http","N/https","N/file","N/ui/serverWidget", "N/runtime" ,"../../common/Commons.js","../../common/SWC_OMS_Utils.js","../../lib/underscore.js"],
    function(task,record,format,search,http,https,file,serverWidget,runtime,Commons,SWCommons)
    {

        /**
         * Definition of the Suitelet script trigger point.
         *
         * @param {Object} context
         * @param {ServerRequest} context.request - Encapsulation of the incoming request
         * @param {ServerResponse} context.response - Encapsulation of the Suitelet response
         * @Since 2015.2
         */
        function onRequest(context)
        {

            SWCommons.execTask({apiCompleted : false, taskId : 15907588});
            // SWCommons.createAndExecTask(options);
//         context.response.write(JSON.stringify(options.output||{}));
        return;



        }

        return {
            onRequest: onRequest
        };
    });