/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @NModuleScope Public
 */
define(["N/record","N/search","../../common/SWC_OMS_Utils.js"],
    function(record,search,SWC_OMS_Utils)
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
            var lastModified = getLastModified();
            var parameter = context.request.body;
            var API = context.request.parameters.API;
            var externalid = context.request.parameters.externalid || getLastModified();
            if(API == "BUSCODN02031")//支付业务:直接支付接口
            {
                // var payDataArray = [];
                // util.each(payDataArray,function (recordId,index) {
                //     record.submitFields({type:"customrecord_swc_payment_platform",id:recordId,values:{"custrecord_swcpp_state":6}});//已提交银行待支付结果
                // });
                var output = searchPaymentDataToBank();
                var outData = [];
                util.each(output,function (obj,key) {
                    outData.push(obj);
                });
                context.response.write({output:JSON.stringify(outData)});
                return;
            }else if(API == "BUSCODN02031SEARCH")//支付业务:支付结果列表查询接口
            {
                log.audit({title:"支付业务:支付结果列表查询接口",details:parameter});
                var options = {
                    platform: "Banks Connector",
                    tranName: "BUSCODN02031SEARCH",
                    apiCompleted:false,// 如果是T，代表不需要调用接口，API COMPLETED 自动勾选。如果是F，需要先调用接口，成功之后，才可以勾选
                    skipMapping:true,
                    soLogo:true,
                    apiCompleted:true
                };
                options.output = parameter;
                options.code = externalid;
                SWC_OMS_Utils.createTask(options);
            }else if(API == "BUSCODN02031REFUNDSEARCH")//支付业务:支付退票明细查询
            {
                log.audit({title:"支付业务:支付退票明细查询",details:parameter});
                log.audit({title:"typeOfparameter",details:typeof parameter});
                var options = {
                    platform: "Banks Connector",
                    tranName: "BUSCODN02031REFUNDSEARCH",
                    apiCompleted:false,// 如果是T，代表不需要调用接口，API COMPLETED 自动勾选。如果是F，需要先调用接口，成功之后，才可以勾选
                    skipMapping:true,
                    soLogo:true,
                    apiCompleted:true
                };
                options.output = parameter;
                if(parameter.constructor == Object)
                {
                    var errmsg = parameter.errmsg;
                    var yurref = parameter.yurref;
                    if(errmsg && yurref)
                    {
                        externalid = yurref;
                    }
                }
                options.code = externalid;
                SWC_OMS_Utils.createTask(options);
            }else if(API == "ACCOUNTDETAIS")//账户管理:查询账户交易信息
            {
                log.audit({title:"账户管理:查询账户交易信息",details:parameter});
                var options = {
                    platform: "Banks Connector",
                    tranName: "ACCOUNTDETAIS",
                    apiCompleted:false,// 如果是T，代表不需要调用接口，API COMPLETED 自动勾选。如果是F，需要先调用接口，成功之后，才可以勾选
                    skipMapping:true,
                    soLogo:true,
                    apiCompleted:true
                };
                options.output = parameter;
                options.code = externalid;
                SWC_OMS_Utils.createTask(options);
            }else if(API == "ACCOUNTREFUNDMESSAGE")//账户管理:查询电子回单信息
            {
                log.audit({title:"账户管理:查询电子回单信息",details:parameter});
                var options = {
                    platform: "Banks Connector",
                    tranName: "ACCOUNTREFUNDMESSAGE",
                    apiCompleted:false,// 如果是T，代表不需要调用接口，API COMPLETED 自动勾选。如果是F，需要先调用接口，成功之后，才可以勾选
                    skipMapping:true,
                    soLogo:true,
                    apiCompleted:true
                };
                options.output = parameter;
                options.code = externalid;
                SWC_OMS_Utils.createTask(options);
            }else if(API == "ACCOUNTREFUNDMEIMAGE")//账户管理:查询电子回单信息（保存图片）
            {
                log.audit({title:"账户管理:查询电子回单信息（保存图片）",details:parameter});

                var options = {
                    platform: "Banks Connector",
                    tranName: "ACCOUNTREFUNDMEIMAGE",
                    apiCompleted:false,// 如果是T，代表不需要调用接口，API COMPLETED 自动勾选。如果是F，需要先调用接口，成功之后，才可以勾选
                    skipMapping:true,
                    soLogo:true,
                    apiCompleted:true
                };
                options.output = parameter;
                var imageJson = JSON.parse(parameter);
                if(!imageJson.errmsg)
                {
                    var imageNames = "";
                    var imageName = "";
                    if(imageJson.name.indexOf("C:\\Program Files\\CMB\\FbSdk\\Receipt\\") > 0)
                    {
                        imageName = imageJson.name.split("C:\\Program Files\\CMB\\FbSdk\\Receipt\\");
                        imageNames = imageName[1].split("_");
                    }else{
                        imageNames = imageJson.name.split("_");
                    }
                    // var paymentExternalId = "";
                    var logExternalId = "";
                    //"1000000012820100002578_20220406-20220414_802_47911295120220406.pdf"
                    if(imageNames.length < 5)
                    {
                        logExternalId = imageNames[imageNames.length-1].split(".jpg")[0];//流水号 流水号是《账户交易流水》的外部ID
                    }else{
                        logExternalId = imageNames[3].split(".jpg")[0];//流水号 流水号是《账户交易流水》的外部ID
                        // paymentExternalId = imageNames[imageNames.length-1].split(".jpg")[0];//业务参考号 《银企直联支付记录》外部ID
                    }
                    options.code = logExternalId;
                }else{
                    options.code = imageJson.errmsg;
                }
                SWC_OMS_Utils.createTask(options);
            }else if(API == "BUSCODN03010")//代发代扣:直接代发代扣接口
            {
                log.audit({title:"代发代扣:直接代发代扣接口",details:parameter});
            }else if(API == "BUSCODN03010SEARCH")//代发代扣:查询交易明细信息
            {
                log.audit({title:"代发代扣:查询交易明细信息",details:parameter});
            }else if(API == "BUSCODN03010REFUNDSEARCH")//代发代扣:代发退票明细查询
            {
                log.audit({title:"代发代扣:代发退票明细查询",details:parameter});
            }
            context.response.write({output:JSON.stringify({"success" : true})});
            return;
        }
        /**
         * 银企直联支付记录
         * customrecord_swc_payment_platform
         */
        function searchPaymentDataToBank()
        {
            var outputJson = {};
            var customrecord_swc_payment_platformSearchObj = search.create({
                type: "customrecord_swc_payment_platform",
                filters:
                    [
                        // ["custrecord_swcpp_updatesuccess","is","F"],//同步成功 = F
                        // "AND",
                        ["custrecord_swcpp_tranid","isnotempty",""],// 业务单据号不为空
                        "AND",
                        // ["custrecord_swcpp_flowid","isnotempty",""],// flowId号不为空: 只处理来自易快报的支付单据
                        // "AND",
                        ["custrecord_swcpp_state","anyof","4"]//支付状态为已发送待银行支付,支付失败
                    ],
                columns:
                    [
                        search.createColumn({name: "custrecord_swcpp_tranid", label: "业务参考号"}),
                        search.createColumn({name: "custrecord_swcpp_vendor", label: "供应商"}),
                        search.createColumn({name: "custrecord_swcpp_employee", label: "mployee"}),
                        search.createColumn({name: "custrecord_swcpp_account", label: "科目"}),
                        search.createColumn({name: "custrecord_swcpp_payareacode", label: "付方开户地区代码"}),
                        search.createColumn({name: "custrecord_swcpp_amount", label: "本次支付金额"}),
                        search.createColumn({name: "custrecord_swcpp_bodname", label: "收款开户行名称"}),
                        search.createColumn({name: "custrecord_swcpp_bodnum", label: "收款开户行联行号"}),
                        search.createColumn({name: "custrecord_swcpp_bodcity", label: "开户行城市"}),
                        search.createColumn({name: "custrecord_swcpp_bankname", label: "收款方户名"}),
                        search.createColumn({name: "custrecord_swcpp_banknumber", label: "收款银行账号"}),
                        search.createColumn({name: "custrecord_swcpp_accounttype", label: "收款方账户性质"}),
                        search.createColumn({name: "custrecord_swcpp_state", label: "支付状态"}),
                        search.createColumn({name: "custrecord_swcpp_memo", label: "备注"}),
                        search.createColumn({name: "custrecord_swcpp_buscod", label: "银行业务类别"}),
                        search.createColumn({name: "custrecord_swcpp_recordtype", label: "单据业务类型"}),
                        search.createColumn({name: "custrecord_swcpp_bank_address", label: "收方开户行地址（省市区）"}),
                        search.createColumn({name: "custrecord_swcpp_bank_number", label: "本次付款账户"}),
                        search.createColumn({name: "custrecord_sbm_bank_code",join: "CUSTRECORD_SWCPP_BANK_NUMBER",label: "银行代码"}),
                        search.createColumn({name: "name",join: "CUSTRECORD_SWCPP_BANK_NUMBER",label: "付款银行账户"}),
                        search.createColumn({name: "custrecord_sbm_bank_name",join: "CUSTRECORD_SWCPP_BANK_NUMBER",label: "付款银行账户名"}),
                        search.createColumn({name: "custrecord_swcpp_trxrem", label: "国际收支申报交易附言"}),
                        search.createColumn({name: "custrecord_st_code",join: "CUSTRECORD_SWCPP_TRXCOD",label: "国际收支申报交易编码"}),
                        search.createColumn({name: "custrecord_swcpp_currency",label: "收款方币种"}),
                        search.createColumn({name: "custrecord_swcpp_payment_type", label: "支付类型"}),
                        search.createColumn({name: "custrecord_spt_code",join: "CUSTRECORD_SWCPP_PAYMENT_TYPE",label: "支付类型"}),
                        search.createColumn({name: "custrecord_swcpp_payment_currenty", label: "支付币种"}),
                        search.createColumn({name: "custrecord_sbm_bank_currency",join: "CUSTRECORD_SWCPP_BANK_NUMBER",label: "支付币种"}),
                        search.createColumn({name: "custrecord_swcpp_payment_address",label: "付款方地址"}),
                        search.createColumn({name: "custrecord_swcpp_is_swift",label: "是否为国际统一编号"}),
                        search.createColumn({name: "custrecord_swcpp_transaction_statement",label: "支付申明"}),
                        search.createColumn({name: "custrecord_swcpp_payment_instructions",label: "支付详细说明"}),
                        search.createColumn({name: "custrecord_sp_code",join:"CUSTRECORD_SWCPP_PURPCD",label: "支付理由"}),
                        search.createColumn({name: "custrecord_swcpp_payee_house_number",label: "收款方门牌号"}),
                        search.createColumn({name: "custrecord_swcpp_payee_street",label: "收款方街道"}),
                        search.createColumn({name: "custrecord_swcpp_payee_city",label: "收款方市区"}),
                        search.createColumn({name: "custrecord_swcpp_payee_state",label: "收方省/市/自治区"}),
                        search.createColumn({name: "custrecord_swcpp_payee_counorreg",label: "收方国家/地区"}),
                        search.createColumn({name: "custrecord_swcpp_payee_zip",label: "收方邮政编码"}),
                        search.createColumn({name: "custrecord_swcpp_payee_swift_code",label: "收方国际统一编号"}),
                        search.createColumn({name: "custrecord_sc_code",join:"CUSTRECORD_SWCPP_SERVICE_CHARGE",label: "手续费承担方"}),
                        search.createColumn({name: "custrecord_swcpp_payment_swift_code",label: "付方国际统一编号"}),
                        search.createColumn({name: "custrecord_swcpp_send_direction",label: "付方统一ID"}),
                        search.createColumn({name: "custrecord_swcpp_receive_direction",label: "收方统一ID"}),
                        search.createColumn({name: "custrecord_sbm_bank_counorreg",join: "CUSTRECORD_SWCPP_BANK_NUMBER",label: "付方国家代码"}),
                        search.createColumn({name: "custrecord_sppc_code", join:"CUSTRECORD_SWCPP_PAYMENT_PURPOSE_CODE",label: "付款目的代码"}),
                        search.createColumn({name: "custrecord_scp_outvalue",join:"CUSTRECORD_SWCPP_CHINA_PBOC_PURPOSE",label: "中国PBOC用途说明"})
                    ]
            });
            //DBTACC 付方帐号
            //DBTBBK 付方开户地区代码
            //YURREF 业务参考号
            //CRTACC 收方帐号
            //CCYNBR 币种代码 10:人民币
            //NUSAGE 用途
            //TRSAMT 交易金额
            //STLCHN 结算方式代码 F：快速
            //BNKFLG 系统内外标志 Y：招行；N：非招行；
            // var results = SWCommons.getAllResults(customrecord_swc_payment_platformSearchObj);
            var resultSet = customrecord_swc_payment_platformSearchObj.run();
            var results = resultSet.getRange({start: 0, end: 1000});
            util.each(results,function (result,index) {
                // payDataArray.indexOf(result.id) < 0 && payDataArray.push(result.id);
                var bankType = result.getValue({name: "custrecord_sbm_bank_code",join: "CUSTRECORD_SWCPP_BANK_NUMBER",label: "银行代码"});
                var DBTACC = result.getValue({name: "name",join: "CUSTRECORD_SWCPP_BANK_NUMBER",label: "付款银行账户"});
                var CRTYPE = result.getValue({name: "custrecord_swcpp_accounttype", label: "收款方账户性质"});
                var YURREF = result.getValue({name: "custrecord_swcpp_tranid", label: "业务参考号"});
                var recordtype = result.getValue({name: "custrecord_swcpp_recordtype", label: "单据业务类型"});
                var recordtypeStr = result.getText({name: "custrecord_swcpp_recordtype", label: "单据业务类型"});
                var bodname = result.getValue({name: "custrecord_swcpp_bodname", label: "收款开户行名称"});
                var BNKFLG = "Y";
                var bankMemo = result.getValue({name: "custrecord_swcpp_memo", label: "备注"});
                var NUSAGE = recordtype?recordtypeStr+"_"+YURREF:YURREF;
                if(bankMemo){NUSAGE = bankMemo;}
                var CCYNBR = result.getText({name: "custrecord_swcpp_currency",label: "收款方币种"});
                var bankName = result.getValue({name: "custrecord_swcpp_bankname", label: "收款方户名"}).trim();
                if(bankType == "CMB")
                {
                    BNKFLG = bodname.indexOf("招商") >= 0 ?"Y":"N";
                    CCYNBR = "10";
                }
                if(bankType == "CZB")
                {
                    BNKFLG = bodname.indexOf("招商") >= 0 ?"Y":"N";
                    CCYNBR = "10";
                    //NS系统中1为对公，2为对私；浙商银行1为对私，2为对公。
                    if(CRTYPE == "1")
                    {
                        CRTYPE = "2";
                    }
                }
                var toJson = {
                    "YURREF":result.getValue({name: "custrecord_swcpp_tranid", label: "业务参考号"}).trim(),
                    "CRTACC":result.getValue({name: "custrecord_swcpp_banknumber", label: "收款银行账号"}).trim(),//"6225880280120198",
                    "NUSAGE":NUSAGE,
                    "CCYNBR":CCYNBR,
                    "TRSAMT":result.getValue({name: "custrecord_swcpp_amount", label: "本次支付金额"}),
                    "STLCHN":"F",
                    "BNKFLG":BNKFLG,
                    "CRTNAM":bankName,//收方帐户名
                    "recordId":result.id,
                    "CRTBNK":bodname,//收款开户行名称
                    "CRTADR":result.getValue({name: "custrecord_swcpp_bank_address", label: "收方开户行地址（省市区）"}),
                    "LRVEAN":bankName,
                    "CRTYPE":CRTYPE,
                    "BODNUM":result.getValue({name: "custrecord_swcpp_bodnum", label: "收款开户行联行号"}),
                    "TRXCOD":result.getValue({name: "custrecord_st_code",join: "CUSTRECORD_SWCPP_TRXCOD",label: "国际收支申报交易编码"}),
                    "TRXREM":result.getText({name: "custrecord_swcpp_trxrem", label: "国际收支申报交易附言"})
                };
                var accountJson = outputJson[DBTACC] = outputJson[DBTACC] || {};
                var fromJson = accountJson["from"] = accountJson["from"] || {};
                fromJson.DBTACC = DBTACC;
                // fromJson.DBTBBK = "75";
                accountJson.BANKTYPE = bankType;
                fromJson.DBTBBK = result.getValue({name: "custrecord_swcpp_payareacode", label: "付方开户地区代码"});
                fromJson.DBTACCNAME = result.getValue({name: "custrecord_sbm_bank_name",join: "CUSTRECORD_SWCPP_BANK_NUMBER",label: "付款银行账户名"});//付方账户名，需要和银行账户一起使用，需要客户提供
                if(bankType == "JPM")
                {
                    /**
                     * JPM必填(NURG: Local Low-Value、URGP: Wire)
                     */
                    fromJson.PAYMENTTYPE = result.getValue({name: "custrecord_spt_code",join: "CUSTRECORD_SWCPP_PAYMENT_TYPE",label: "支付类型"});
                    /**
                     * 付方国家代码
                     */
                    var DEBTORCTRY = result.getValue({name: "custrecord_sbm_bank_counorreg",join: "CUSTRECORD_SWCPP_BANK_NUMBER",label: "付方国家代码"});
                    fromJson.DEBTORCTRY = SWC_OMS_Utils.COUNTRY[DEBTORCTRY].value;
                    /**
                     * 支付币种
                     * @type {string}
                     */
                    fromJson.DEBTORCURRENCY = result.getText({name: "custrecord_swcpp_payment_currenty",label:"支付币种"});
                    /**
                     * 付方地址
                     */
                    fromJson.DEBTORADRLINE = result.getValue({name: "custrecord_swcpp_payment_address",label: "付款方地址"});
                    /**
                     * JPM 必填(国际统一编号)
                     * @type {string}
                     */
                    fromJson.DEBTORBANKCODE = result.getValue({name: "custrecord_swcpp_payment_swift_code",label: "付方国际统一编号"});
                    /**
                     * 手续费承担方
                     * JPM必填(DEBT、CRED、SHAR)
                     */
                    toJson.CHRGBR = result.getValue({name: "custrecord_sc_code",join:"CUSTRECORD_SWCPP_SERVICE_CHARGE",label: "手续费承担方"});
                    //JPM必填,国际统一编号
                    toJson.BIC = result.getValue({name: "custrecord_swcpp_payee_swift_code",label: "收方国际统一编号"});
                    //收方邮政编码
                    toJson.CDTRPSTCD = result.getValue({name: "custrecord_swcpp_payee_zip",label: "收方邮政编码"});
                    //收方国家代码
                    toJson.PSTCTRY = SWC_OMS_Utils.COUNTRY[result.getValue({name: "custrecord_swcpp_payee_counorreg",label: "收方国家/地区"})].value;
                    //收方省/市/自治区
                    toJson.CDTRCTRYSUBDVSN = result.getText({name: "custrecord_swcpp_payee_state",label: "收方省/市/自治区"});
                    //收款方市区
                    toJson.CDTRTWNNM = result.getValue({name: "custrecord_swcpp_payee_city",label: "收款方市区"});
                    //收款方街道
                    toJson.CDTRSTRNM = result.getValue({name: "custrecord_swcpp_payee_street",label: "收款方街道"});
                    //收款方门牌号
                    toJson.CDTRPSTADRLINE = result.getValue({name: "custrecord_swcpp_payee_house_number",label: "收款方门牌号"});
                    /**
                     * JPM高额支付时
                     * 与付款指示处理相关的进一步信息(收款方)跨境支付详情说明
                     * 收付方为下列其中之一时JPM必填
                     * 印度（IN）、韩国（KR）、菲律宾（PH）、台湾（TW）、泰国（TH）为必填项
                     * @type {string}
                     */
                    var isINSTRFORDBTRA = false;
                    if(toJson.PSTCTRY == "IN" || fromJson.DEBTORCTRY == "IN" || toJson.PSTCTRY == "KR" || fromJson.DEBTORCTRY == "KR" || toJson.PSTCTRY == "PH" || fromJson.DEBTORCTRY == "PH" || toJson.PSTCTRY == "TW" || fromJson.DEBTORCTRY == "TW" || toJson.PSTCTRY == "TH" || fromJson.DEBTORCTRY == "TH")
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
                    if(toJson.PSTCTRY == "HK" || fromJson.DEBTORCTRY == "HK" || toJson.PSTCTRY == "AU" || fromJson.DEBTORCTRY == "AU" || toJson.PSTCTRY == "KR" || fromJson.DEBTORCTRY == "KR" || toJson.PSTCTRY == "NZ" || fromJson.DEBTORCTRY == "NZ" || toJson.PSTCTRY == "SG" || fromJson.DEBTORCTRY == "SG")
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
                    if(toJson.PSTCTRY == "CN" || fromJson.DEBTORCTRY == "CN" || toJson.PSTCTRY == "TH" || fromJson.DEBTORCTRY == "TH" || toJson.PSTCTRY == "TW" || fromJson.DEBTORCTRY == "TW" || toJson.PSTCTRY == "PH" || fromJson.DEBTORCTRY == "PH")
                    {
                        isPRTRY = true;
                    }
                    /**
                     * 台湾（TW）、泰国（TH）
                     * 低额支付的时候
                     * 如果收方国家=付方国家，并且等于台湾/泰国时
                     * SENDERID 、RECEVIERID 为必填
                     * @type {boolean}
                     */
                    var isId = false;
                    if((toJson.PSTCTRY == "TH" && fromJson.DEBTORCTRY == "TH") || (toJson.PSTCTRY == "TW" && fromJson.DEBTORCTRY == "TW"))
                    {
                        isId = true;
                    }
                    if(fromJson.PAYMENTTYPE == "NURG")//JPM低额支付
                    {
                        if(isPRTRY)
                        {
                            toJson.PRTRY = result.getValue({name: "custrecord_sppc_code", join:"CUSTRECORD_SWCPP_PAYMENT_PURPOSE_CODE",label: "付款目的代码"});
                        }
                        if(isPURPCD)
                        {
                            toJson.PURPCD = result.getValue({name: "custrecord_sp_code",join:"CUSTRECORD_SWCPP_PURPCD",label: "支付理由"});
                        }
                        if(isId)
                        {
                            fromJson.SENDERID = result.getValue({name: "custrecord_swcpp_send_direction",label: "付方统一ID"});
                            toJson.RECEVIERID = result.getValue({name: "custrecord_swcpp_receive_direction",label: "收方统一ID"});
                        }
                    }
                    if(fromJson.PAYMENTTYPE == "URGP")//JPM高额支付
                    {
                        if(isINSTRFORDBTRA)
                        {
                            toJson.INSTRFORDBTRA = result.getValue({name: "custrecord_swcpp_payment_instructions",label: "支付详细说明"});
                        }
                    }
                    /**
                     *说明是否请求每笔交易的预订的声明。(收款方)
                     * JPM低额支付，由台湾账户付款时需要传入
                     * 不需要了
                     * @type {string}
                     */
                    // if(fromJson.DEBTORCTRY == "TW" && fromJson.PAYMENTTYPE == "NURG")
                    // {
                    //     toJson.BTCHBOOKG = result.getValue({name: "custrecord_swcpp_transaction_statement",label: "支付申明"});
                    // }
                    /**
                     * JPM需要传入Y/N
                     * 是否为国际统一编号
                     */
                    var SWIFTCODEFLAG = result.getValue({name: "custrecord_swcpp_is_swift",label: "是否为国际统一编号"});
                    toJson.SWIFTCODEFLAG = SWIFTCODEFLAG?"Y":"N";
                    /**
                     * 如果受益人为个人，付款金额>=50000元人民币，则需要。
                     * 中国PBOC用途说明
                     *
                     */
                    if(fromJson.DEBTORCTRY == toJson.PSTCTRY && fromJson.DEBTORCURRENCY == toJson.CCYNBR && fromJson.DEBTORCURRENCY == "CNY")
                    {
                        if(Number(toJson.TRSAMT) - 50000 >= 0)
                        {
                            toJson.NUSAGE = result.getValue({name: "custrecord_scp_outvalue",join:"CUSTRECORD_SWCPP_CHINA_PBOC_PURPOSE",label: "中国PBOC用途说明"});
                        }
                    }else
                    {
                        toJson.NUSAGE = bankMemo;
                    }
                    // /**
                    //  * 其他国家另取文本
                    //  */
                    // if(fromJson.DEBTORCURRENCY != "CNY" || toJson.CCYNBR != "CNY" || fromJson.PAYMENTTYPE == "NURG")
                    // {
                    //     toJson.NUSAGE = bankMemo;
                    // }
                }
                accountJson["to"] = accountJson["to"] || [];
                accountJson["to"].push(toJson);
            });
            return outputJson;
        }
        function getLastModified()
        {
            var now = getDate("8");
            return formatDate(now, "yyyyMMddHHmmssSSS");
        }
        function getDate(timeZone) {
            var date = new Date();
            var utcTime = date.getTime() + date.getTimezoneOffset() * 60 * 1000;
            var tzTime = utcTime + timeZone * 60 * 60 * 1000;
            return new Date(tzTime);
        }
        function formatDate(date, formatStr)
        {
            var year = date.getFullYear();
            var month = to2Digits(Number(date.getMonth()) + 1);
            var day = to2Digits(date.getDate());
            var hours = to2Digits(date.getHours());
            var mins = to2Digits(date.getMinutes());
            var seconds = to2Digits(date.getSeconds());
            var time = date.getTime();
            var str = formatStr && formatStr.replace("yyyy", year).replace("MM", month).replace("dd", day).replace("HH", hours).replace("mm", mins).replace("ss", seconds).replace("SSS",time);
            return str;
        }
        function to2Digits(num) {
            return (num < 10 ? "0" : "") + num;
        }
        return {
            onRequest: onRequest
        };
    });