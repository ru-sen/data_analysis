/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 * @NModuleScope Public
 */
define(['N/search', 'N/record',"N/https"],

function(search,record,https) {
   
    /**
     * Marks the beginning of the Map/Reduce process and generates input data.
     *
     * @typedef {Object} ObjectRef
     * @property {number} id - Internal ID of the record instance
     * @property {string} type - Record type id
     *
     * @return {Array|Object|Search|RecordRef} inputSummary
     * @since 2015.1
     */
    function getInputData() {
        try {


            //Authing platform 获取token
            var platformRecord = record.load({type: 'customrecord_swc_platform',id:'1'});
            var accessKeyId = platformRecord.getValue({fieldId:"custrecord_swcp_session_key"});
            var accessKeySecret = platformRecord.getValue({fieldId:"custrecord_swcp_session_secret"});

            var headers = 	{"Content-Type":"application/json; charset=utf-8","Accept":"*/*"};
            var postData = {"accessKeyId":accessKeyId,"accessKeySecret":accessKeySecret};

            var response = https.request({
                method:https.Method.POST,
                url:"https://api.authing.pingcap.net/api/v3/get-management-token",
                headers:headers,
                body:JSON.stringify(postData)
            })

            log.audit('response',response);
            var accessToken = JSON.parse(response.body).data.access_token;
            log.audit('authing accessToken',accessToken);
            platformRecord.setValue({fieldId:'custrecord_swcp_appkey',value:accessToken});
            platformRecord.save();



            //Authing(new) platform 获取token
            var platformRecord = record.load({type: 'customrecord_swc_platform',id:'8'});
            var accessKeyId = platformRecord.getValue({fieldId:"custrecord_swcp_session_key"});
            var accessKeySecret = platformRecord.getValue({fieldId:"custrecord_swcp_session_secret"});

            var headers = 	{"Content-Type":"application/json","x-authing-userpool-id":"65af6bc7f17f80ed81ae8768"};
            var postData = {"accessKeyId":accessKeyId,"accessKeySecret":accessKeySecret};

            var response = https.request({
                method:https.Method.POST,
                url:"https://pingcap-cn.authing.cn/api/v3/get-management-token",
                headers:headers,
                body:JSON.stringify(postData)
            })

            log.audit('response',response);
            var accessToken = JSON.parse(response.body).data.access_token;
            log.audit('authing(new) accessToken',accessToken);
            platformRecord.setValue({fieldId:'custrecord_swcp_appkey',value:accessToken});
            platformRecord.save();






            //飞书 platform 获取token
            var platformRecord = record.load({type: 'customrecord_swc_platform',id:'3'});
            var accessKeyId = platformRecord.getValue({fieldId:"custrecord_swcp_session_key"});
            var accessKeySecret = platformRecord.getValue({fieldId:"custrecord_swcp_session_secret"});

            var headers = 	{"Content-Type":"application/json; charset=utf-8","Accept":"*/*"};
            var postData = {"app_id":accessKeyId,"app_secret":accessKeySecret};

            var response = https.request({
                method:https.Method.POST,
                url:"https://open.feishu.cn/open-apis/auth/v3/app_access_token/internal",
                headers:headers,
                body:JSON.stringify(postData)
            })


            var accessToken = JSON.parse(response.body).app_access_token;
            log.audit('飞书accessToken',accessToken);
            platformRecord.setValue({fieldId:'custrecord_swcp_appkey',value:accessToken});
            platformRecord.save();


        }catch (e) {
            log.audit('错误信息',e);
        }
    }

    /**
     * Executes when the map entry point is triggered and applies to each key/value pair.
     *
     * @param {MapSummary} context - Data collection containing the key/value pairs to process through the map stage
     * @since 2015.1
     */
    function map(context) {

    }

    /**
     * Executes when the reduce entry point is triggered and applies to each group.
     *
     * @param {ReduceSummary} context - Data collection containing the groups to process through the reduce stage
     * @since 2015.1
     */
    function reduce(context) {

    }


    /**
     * Executes when the summarize entry point is triggered and applies to the result set.
     *
     * @param {Summary} summary - Holds statistics regarding the execution of a map/reduce script
     * @since 2015.1
     */
    function summarize(summary) {

    }



    return {
        getInputData: getInputData,
        map: map,
        reduce: reduce,
        summarize: summarize
    };
    
});
