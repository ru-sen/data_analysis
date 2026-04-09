/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
define(["N/runtime"],

    (runtime) => {

        /**
         * Defines the function definition that is executed before record is submitted.
         * @param {Object} scriptContext
         * @param {Record} scriptContext.newRecord - New record
         * @param {Record} scriptContext.oldRecord - Old record
         * @param {string} scriptContext.type - Trigger type; use values from the context.UserEventType enum
         * @since 2015.2
         */
        const beforeSubmit = (scriptContext) => {
            var currentRec = scriptContext.newRecord;
            var ContextType = runtime.executionContext;
            if (ContextType == runtime.ContextType.CSV_IMPORT){//CSV导入时触发
                var language = runtime.getCurrentUser().getPreference({name:"language"});//获取语言
                var obj = verifyRequiredMessage(currentRec,language);
                //错误信息长度大于0 说明有错误信息!
                if (obj.msg.length>0){
                    throw obj.title+""+obj.msg;
                }
            }
        }

        /**
         * 验证必填信息
         */
        function verifyRequiredMessage (currentRec,language){
            //下拉选的 国家 内部id: 英文缩写 对照
            var  COUNTRY ={
                "105":"IN",//印度
                "122":"KR",//韩国
                "177":"PH",//菲律宾
                "225":"TW",//台湾
                "215":"TH",//泰国
                "95":"HK",//香港
                "14":"AU",//澳大利亚
                "171":"NZ",//新西兰
                "197":"SG",//新加坡
                "47":"CN",//中国
                "238":"VN"//越南
            };
            var  messagesJson = {
                ERR_PAY_CURRENCY_zh_CN :"付方币种 ",
                ERR_PAY_CURRENCY_en :"Currency of the payer. ",
                ERR_RECEIVE_ZIP_zh_CN:"收方邮政编码 ",
                ERR_RECEIVE_ZIP_en:"Recipient Postal Code. ",
                ERR_RECEIVE_STATE_zh_CN:"收方省/市/自治区 ",
                ERR_RECEIVE_STATE_en:"Receiving province / municipality / autonomous region. ",
                ERR_RECEIVE_MARKET_zh_CN:"收方市区 ",
                ERR_RECEIVE_ADDRESS_zh_CN:"收方地址 ",
                ERR_RECEIVE_ADDRESS_en:"Recipient address. ",
                ERR_RECEIVE_MARKET_en:"Receiving urban area. ",
                ERR_RECEIVE_STREET_zh_CN:"收方街道 ",
                ERR_RECEIVE_STREET_en:"Receiving street. ",
                ERR_RECEIVE_HOUSE_NUMBER_zh_CN:"收方门牌号 ",
                ERR_RECEIVE_HOUSE_NUMBER_en:"The house number of the recipient.",
                ERR_RECEIVE_PAYMENT_PURPOSE_zh_CN:"付款目的 ",
                ERR_RECEIVE_PAYMENT_PURPOSE_en:"Purpose of payment.",
                ERR_RECEIVE_PAYMENT_REASONS_zh_CN:"支付理由 ",
                ERR_RECEIVE_PAYMENT_REASONS_en:"Reason for payment.",
                ERR_RECEIVE_PAYMENT_DESCRIPTION_zh_CN:"支付详情说明 ",
                ERR_RECEIVE_PAYMENT_DESCRIPTION_en:"Details of payment.",
                ERR_RECEIVE_PAYMENT_Reasons_zh_CN:"付款和收款国家都必须填写支付详情说明，付款方在前，收款方在后， 第36个字符用空格分割 ",
                ERR_RECEIVE_PAYMENT_Reasons_en:"Both the paying and receiving countries must fill in the details of the payment, with the payer first and the payer later, and the 36th character is separated by a space.",
                ERR_RECEIVE_PAYMENT_USAGE_zh_CN:"用途说明 ",
                ERR_RECEIVE_PAYMENT_USAGE_en:"Usage description. ",
                ERR_RECEIVE_PAYMENT_MEMO_zh_CN:"备注 ",
                ERR_RECEIVE_PAYMENT_MEMO_en:"Memo.  ",
                ERROR_TITLE_zh_CN :"以下字段不能为空! ",
                ERROR_TITLE_en :"The following fields cannot be empty!",
                ERR_SEND_RECEIVE_zh_CN :"发送方统一ID /  接收方统一ID 必须填写 !",
                ERR_SEND_RECEIVE_en :"SENDERID / RECEVIERID , Must fill in ! ",
            };

            /*判断多个 英语环境语言*/
            if (language=="en_US"||language=="en_GB"||language=="en_CA"||language=="en_AU"){
                language = language.split("_")[0];
            }
            var title =messagesJson["ERROR_TITLE_"+language];//标题的中英文切换
            var msg ="";//错误信息集合
            var customForm = currentRec.getValue({fieldId:"customform"});//自定义表格
            /**
             * 22 : 硅谷银行(SVB)
             * 22 : 花旗银行(CITI)
             * 349 : 摩根大通JPM
            */
            if (customForm == "349" || customForm == "22" || customForm == "26"){
                var currency = currentRec.getValue({fieldId:"custrecord_swcpp_payment_currenty"});//付方币种
                var trsamt = currentRec.getValue({fieldId:"custrecord_swcpp_amount"});//本次支付金额
                var state = currentRec.getValue({fieldId:"custrecord_swcpp_payee_state"});//收方省/市/自治区
                var city = currentRec.getValue({fieldId:"custrecord_swcpp_payee_city"});//收方市区
                var street = currentRec.getValue({fieldId:"custrecord_swcpp_payee_street"});//收方街道
                var address = currentRec.getValue({fieldId:"custrecord_swcpp_payee_address"});//收方地址
                // var house_number = currentRec.getValue({fieldId:"custrecord_swcpp_payee_house_number"});//收方门牌号
                var payment_type = currentRec.getValue({fieldId:"custrecord_swcpp_payment_type"});//支付类型
                var payee_counorreg = currentRec.getValue({fieldId:"custrecord_swcpp_payee_counorreg"});//收方国家/地区
                payee_counorreg = COUNTRY[payee_counorreg];
                var payment_counorreg = currentRec.getValue({fieldId:"custrecord_swcpp_payment_counorreg"});//付方国家/地区
                payment_counorreg = COUNTRY[payment_counorreg];

                if (isEmpty(currency)){
                    msg+=messagesJson[`ERR_PAY_CURRENCY_${language}`];//付方币种
                }
                /**
                 * 如果收方国家是中国大陆 不需要校验  收方省/市/自治区、收方市区、收方地址、收方街道
                 *  支付金额大于五万时,用途说明必填
                 */
                if (payee_counorreg == "CN") {
                    if(Number(trsamt) - 50000 >= 0) {
                        var purpose = currentRec.getValue({fieldId:"custrecord_swcpp_china_pboc_purpose"});//用途说明
                        if (isEmpty(purpose)){
                            msg+=messagesJson[`ERR_RECEIVE_PAYMENT_USAGE_${language}`];//用途说明必填
                        }
                    }
                }
                /**
                 * 如果收方国家是 印度 韩国 菲律宾 台湾 泰国 香港 澳大利亚 新西兰 新加坡  越南
                 * 收方省/市/自治区、收方市区、收方地址、收方街道 为必填
                 */
                else if(payee_counorreg =="IN" || payee_counorreg =="KR" || payee_counorreg =="PH" || payee_counorreg =="TW" || payee_counorreg =="TH" || payee_counorreg =="HK" || payee_counorreg =="AU" || payee_counorreg =="NZ" || payee_counorreg =="SG" || payee_counorreg =="VN") {
                    // if (isEmpty(state)){
                    //     msg+=messagesJson[`ERR_RECEIVE_STATE_${language}`];//收方省/市/自治区
                    // }
                    if (isEmpty(address)){
                        msg+=messagesJson[`ERR_RECEIVE_ADDRESS_${language}`];//收方地址
                    }
                    if (isEmpty(city)){
                        msg+=messagesJson[`ERR_RECEIVE_MARKET_${language}`];//收方市区
                    }
                    if (isEmpty(street)){
                        msg+=messagesJson[`ERR_RECEIVE_STREET_${language}`];//收方街道
                    }
                }
                /**
                 * JPM高额支付时
                 * 与付款指示处理相关的进一步信息(收款方)跨境支付详情说明
                 * 收付方为下列其中之一时JPM必填
                 * 印度（IN）、韩国（KR）、菲律宾（PH）、台湾（TW）、泰国（TH）为必填项
                 * @type {string}
                 */
                    //印度（IN）、韩国（KR）、菲律宾（PH）、台湾（TW）、泰国（TH）
                var limitedCountry =["IN","KR","TW","TH","PH"];//限定国家
                var isINSTRFORDBTRA = false;
                var isINSTRFORDBTRB = false;
                // 如果 付方国家 不等于 收方国家 并且 俩个国家都是  印度、韩国、菲律宾、台湾、泰国
                // 的其中一个 [支付详细说明] 俩个国家都必须填写理由 付款方在前 收款方在后 第36个字符 用空格分割
                if(payee_counorreg!=payment_counorreg && limitedCountry.indexOf(payee_counorreg)>-1 && limitedCountry.indexOf(payment_counorreg)>-1) {
                    isINSTRFORDBTRB =true;
                }else  if( payee_counorreg== "IN" || payment_counorreg == "IN" || payee_counorreg == "KR" || payment_counorreg == "KR" || payee_counorreg == "PH" || payment_counorreg == "PH" || payee_counorreg == "TW" || payment_counorreg == "TW" || payee_counorreg == "TH" || payment_counorreg == "TH")
                {
                    isINSTRFORDBTRA = true;
                }
                /**
                 * JPM低额支付时
                 *
                 * 收付方为下列其中之一时
                 * 香港（HK）、澳大利亚（AU）、韩国（KR）、新西兰（NZ）、新加坡（SG）是必填项
                 * OTHR-外部启动信贷
                 * ECH-家庭津贴
                 * SALA-支付
                 * PENS-养老金
                 * DIVD-股息
                 * INTE-债券利息
                 * @type {string}
                 */
                var isPURPCD = false;
                if(payee_counorreg == "HK" || payment_counorreg == "HK" || payee_counorreg == "AU" || payment_counorreg == "AU" || payee_counorreg == "KR" || payment_counorreg == "KR" || payee_counorreg == "NZ" || payment_counorreg == "NZ" || payee_counorreg == "SG" || payment_counorreg == "SG")
                {
                    isPURPCD = true;
                }
                /**
                 * JPM低额支付时
                 * 收付方为下列其中之一时JPM必填
                 * 中国(CN)、泰国（TH）、台湾（TW）、菲律宾（PH）是必填
                 *
                 * @type {string}
                 */
                var isPRTRY = false;
                if(payee_counorreg == "CN" || payment_counorreg == "CN" || payee_counorreg == "TH" || payment_counorreg == "TH" || payee_counorreg == "TW" || payment_counorreg == "TW" || payee_counorreg == "PH" || payment_counorreg == "PH")
                {
                    isPRTRY = true;
                }
                /**
                 * JPM低额支付时
                 * 如果收方国家=付方国家，并且等于台湾时，以上两个字段必须输入，没有输入时
                 * UE端throw错误，
                 * CS端弹窗提醒
                 * 不可保存
                 * 台湾  TW
                 */
                var isChinaTW = false;
                if ( (payee_counorreg ==payment_counorreg) && payee_counorreg =='TW' )
                {
                    isChinaTW = true;
                }

                /**
                 * 越南 高额支付时 备注必填
                 */
                var isMemo =false;
                if(payee_counorreg =="VN" || payee_counorreg=="VN" ){
                    isMemo =true;
                }

                if (payment_type=="1"){//低额支付
                    if(isPRTRY)
                    {
                        var payment_purpose = currentRec.getValue({fieldId:"custrecord_swcpp_payment_purpose_code"});//付款目的 需要校验
                        if (isEmpty(payment_purpose)){
                            msg+=messagesJson[`ERR_RECEIVE_PAYMENT_PURPOSE_${language}`];//付款目的
                        }
                    }
                    if(isPURPCD)
                    {
                        var purpcd = currentRec.getValue({fieldId:"custrecord_swcpp_purpcd"});//支付理由 需要校验
                        if (isEmpty(purpcd)){
                            msg+=messagesJson[`ERR_RECEIVE_PAYMENT_REASONS_${language}`];//支付理由
                        }
                    }
                    if (isChinaTW)
                    {
                        var send = currentRec.getValue({fieldId:"custrecord_swcpp_send_direction"});//发送方统一ID
                        var receive = currentRec.getValue({fieldId:"custrecord_swcpp_receive_direction"});//接收方统一ID
                        if (isEmpty(send) || isEmpty(receive)){
                            msg+=messagesJson[`ERR_SEND_RECEIVE_${language}`];
                        }
                    }
                }else {//高额支付
                    if(isINSTRFORDBTRA)
                    {
                        var instructions = currentRec.getValue({fieldId:"custrecord_swcpp_payment_instructions"});//支付 详细说明需要校验
                        if (isEmpty(instructions)){
                            msg+=messagesJson[`ERR_RECEIVE_PAYMENT_DESCRIPTION_${language}`];//支付详细说明
                        }
                    }
                    if(isMemo)
                    {
                        var memo = currentRec.getValue({fieldId:"custrecord_swcpp_memo"});//备注 必填
                        if (isEmpty(memo)){
                            msg+=messagesJson[`ERR_RECEIVE_PAYMENT_MEMO_${language}`];//备注
                        }
                    }
                    if (isINSTRFORDBTRB){
                        var instructions = currentRec.getValue({fieldId:"custrecord_swcpp_payment_instructions"});//双方国家需要校验 支付详细说明
                        if (isEmpty(instructions)){
                            msg+=messagesJson[`ERR_RECEIVE_PAYMENT_Reasons_${language}`];//支付详细说明
                        }
                    }
                }
            }
            return {title,msg}
        }

        /**
         * 非空判断
         * @param obj 各种类型
         * @returns {boolean}
         */
        function isEmpty(obj) {
            if (obj === undefined || obj == null || obj === '') {
                return true;
            }
            if (obj.length && obj.length > 0) {
                return false;
            }
            if (obj.length === 0) {
                return true;
            }
            for ( var key in obj) {
                if (hasOwnProperty.call(obj, key)) {
                    return false;
                }
            }
            if (typeof (obj) == 'boolean') {
                return false;
            }
            if (typeof (obj) == 'number') {
                return false;
            }
            return true;
        }

        /**
         * Defines the function definition that is executed after record is submitted.
         * @param {Object} scriptContext
         * @param {Record} scriptContext.newRecord - New record
         * @param {Record} scriptContext.oldRecord - Old record
         * @param {string} scriptContext.type - Trigger type; use values from the context.UserEventType enum
         * @since 2015.2
         */
        const afterSubmit = (scriptContext) => {
        }

        return {
            // beforeLoad,
            beforeSubmit,
            verifyRequiredMessage,
            isEmpty,
            // afterSubmit
        }

    });
