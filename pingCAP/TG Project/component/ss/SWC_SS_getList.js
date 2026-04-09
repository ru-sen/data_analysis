/**
 * @NApiVersion 2.x
 * @NScriptType ScheduledScript
 * @NModuleScope Public
 */
define(["N/format","N/runtime","N/record","N/search","../../common/SWC_OMS_Utils.js","../../common/Commons.js",
        "../../lib/decimal"],
    /**
     *  ①定期抓取订单列表（不包含订单明细）
     *  ②定期抓到账信息
     */
    function(format,runtime,record,search,SWCommons,Commons, decimal)
    {

        /**
         * Definition of the Scheduled script trigger point.
         *
         * @param {Object} scriptContext
         * @param {string} scriptContext.type - The context in which the script is executed. It is one of the values from the scriptContext.InvocationType enum.
         * @Since 2015.2
         */
        function execute(scriptContext)
        {
            var scriptObj = runtime.getCurrentScript();
            var remUsage0 = scriptObj.getRemainingUsage();
            log.audit({title:"START",details:remUsage0});
            var platformName = scriptObj.getParameter({name: "custscript_swc_platform_name"});
            // 获取东8区时间
            var now = SWCommons.getDate(8);
            var startTime = formatDate(now,"yyyy-MM-dd");
            //TODO 测试使用 测试后删除
            //startTime = "2025-05-31";
            var tranTypeId = scriptObj.getParameter({name: "custscript_swc_tran_type"});
            if(!tranTypeId){
                throw "Please configure Tran Type";
            }
            var tranType = search.lookupFields({type:"customlist_swc_tran", id:tranTypeId,columns:["name"]});  //fulfillList
            if(!tranType || Object.keys(tranType).length < 0) return;
            var mySearch = "";
            if (tranType.name == "getNavanVoucherList"){
                //获取最后一次的Task Tracker信息 ：由于按照end 倒序排列，因此取第一条记录 多个【自定义请求条件】参数
                mySearch = search.create({
                    type: "customrecord_swc_task_tracker",//记录接口调用日志
                    filters: [
                        ["custrecord_swctt_type", "anyof", tranTypeId],
                        "AND",
                        ["custrecord_swctt_platform.name","is", platformName],
                        "AND",
                        ["custrecord_custom_req_cond","is", startTime]
                    ],
                    columns:
                        [

                            search.createColumn({name: "internalid", sort: search.Sort.DESC, label: "ID"}),
                            search.createColumn({name: "custrecord_swctt_end",sort: search.Sort.DESC,label: "结束时间"}),
                            search.createColumn({name: "custrecord_swctt_completed", label: "是否已完成"}),
                            search.createColumn({name: "custrecord_swctt_start", label: "开始时间"}),
                            search.createColumn({name: "custrecord_swctt_total", label: "总条数"}),
                            search.createColumn({name: "custrecord_swctt_total_pages", label: "总页数"}),
                            search.createColumn({name: "custrecord_swctt_current_page", label: "当前页"}),
                            search.createColumn({name: "custrecord_custom_req_cond", label: "自定义请求条件"})
                        ]
                });
            }else {
                //获取最后一次的Task Tracker信息 ：由于按照end 倒序排列，因此取第一条记录
                mySearch = search.create({
                    type: "customrecord_swc_task_tracker",//记录接口调用日志
                    filters: [
                        ["custrecord_swctt_type", "anyof", tranTypeId],
                        "AND",
                        ["custrecord_swctt_platform.name","is", platformName]
                    ],
                    columns:
                        [

                            search.createColumn({name: "internalid", sort: search.Sort.DESC, label: "ID"}),
                            search.createColumn({name: "custrecord_swctt_end",sort: search.Sort.DESC,label: "结束时间"}),
                            search.createColumn({name: "custrecord_swctt_completed", label: "是否已完成"}),
                            search.createColumn({name: "custrecord_swctt_start", label: "开始时间"}),
                            search.createColumn({name: "custrecord_swctt_total", label: "总条数"}),
                            search.createColumn({name: "custrecord_swctt_total_pages", label: "总页数"}),
                            search.createColumn({name: "custrecord_swctt_current_page", label: "当前页"}),
                            search.createColumn({name: "custrecord_custom_req_cond", label: "自定义请求条件"})
                        ]
                });
            }

            var resultSet = mySearch.run();
            // 取最后更新日期最大的一条
            var results = resultSet.getRange({start: 0, end: 1});


            // 获取platform
            //platform 参数可以通过script parameter 进行配置
            var platformConfigJson = SWCommons.getPlatformConfig(platformName);
            // 开始和结束日期最大跨度（小时）
            var interval = scriptObj.getParameter({name:"custscript_swc_interval"}) || platformConfigJson.interval || 24;
            // 从最后一次抓取时间提前n小时
            var HOURS_BEFORE = scriptObj.getParameter({name:"custscript_swc_hours_before"}) || platformConfigJson.hoursBefore || 2;
            // 最后一次抓取时间向后推n小时
            var HOURS_AFTER = interval - HOURS_BEFORE;
            var PAGE_SIZE = scriptObj.getParameter({name:"custscript_swc_page_size"}) ||  platformConfigJson.pageSize || 10;

            // Task Tracker
            var taskTrackerRec = null;

            var start = "";
            var end = "";
            var begindate = "";
            var curPage = 1;
            var totalPages = 1;
            var total = -1;
            var newTranslate = "";//生成费用报销赋值日期使用
            if (tranType.name == "getNavanVoucherList" &&(!results || !results.length)){
                completed = true;
            }else {
                // 如果不存在最后一次抓取记录，则退出
                if (!results || !results.length) {
                    return;
                }
                var latestTaskTrackerRes = results[0];
                var completed = latestTaskTrackerRes.getValue({name:"custrecord_swctt_completed"}) || false;
                var condSubsidiary = latestTaskTrackerRes.getValue({name:"custrecord_custom_req_cond"}) || "";//自定义请求条件-salesforce公司
                var trackerTotal = latestTaskTrackerRes.getValue({name:"custrecord_swctt_total"}) || "";
                log.audit("condSubsidiary",condSubsidiary);
                log.audit("completed",completed);
                var customReqCond;
            }

            // 未执行完成，则从此次开始执行
            if (!completed) {
                start = SWCommons.timestampToDate(latestTaskTrackerRes.getValue({name:"custrecord_swctt_start"}));
                end = SWCommons.timestampToDate(latestTaskTrackerRes.getValue({name:"custrecord_swctt_end"}));
                curPage = Number(latestTaskTrackerRes.getValue({name:"custrecord_swctt_current_page"})) + 1;
                if(tranType.name != "getSalesforceQueryList" && tranType.name != "getSalesforceCollectionList"){
                    var customReqCondTmp = latestTaskTrackerRes.getValue({name: "custrecord_custom_req_cond"});
                    if (tranType.name != "getNavanVoucherList"){
                        customReqCond = customReqCondTmp ? JSON.parse(customReqCondTmp) : null;
                    }else {
                        begindate = SWCommons.formatDate(start, "yyyy-MM-dd");
                        start = SWCommons.formatDate(start, "yyyyMMdd")+"000000";
                        end = SWCommons.formatDate(end, "yyyyMMdd")+"000000";
                    }
                }
                totalPages = Number(latestTaskTrackerRes.getValue({name:"custrecord_swctt_total_pages"}) || 0) ;

                taskTrackerRec = record.load({type:"customrecord_swc_task_tracker",id:latestTaskTrackerRes.id});
            }
            if (completed) {
                // Salesforce不需要自动生成tracker
                if(tranType.name == "getSalesforceQueryList" || tranType.name == "getSalesforceDeleteList" || tranType.name == "getSalesforceCollectionList") return;
                // 金蝶云星空凭证抓去不需要自动生成tracker
                if (tranType.name == "getKingdeeVoucherList") return;

                if (tranType.name == "getNavanVoucherList"){
                    log.audit("当前日期",startTime);
                    var thisLastDate = getLastDayOfMonth();//获取当月最后一天日期
                    var last21Date = getLastMonthDate(21);//获取上个月21号日期
                    last21Date = last21Date.slice(0,8)+"21";
                    var last15Date = getLastMonthDate(15);//获取上个月15号日期
                    last15Date = last15Date.slice(0,8)+"15";
                    var this15Date = getThisMonthDate(15);//获取当月15号日期
                    this15Date = this15Date.slice(0,8)+"15";
                    //var lastOneDate = getFirstDayOfNextMonth();//获取下个月第一天日期
                    log.audit("thisLastDate获取当月最后一天日期",thisLastDate);
                    log.audit("last21Date获取上个月21号日期",last21Date);
                    log.audit("last15Date获取上个月15号日期",last15Date);
                    log.audit("last15Date获取当月15号日期",this15Date);
                    //log.audit("lastOneDate获取下个月第一天日期",lastOneDate);
                    // 只在15号或者月末最后一天去执行 其他时间不执行
                    //TODO 测试使用 测试后删除
                    //thisLastDate = "2025-05-31";
                    // 取消15号执行
                    if(/*startTime!=this15Date && */startTime != thisLastDate){
                        log.audit("执行状态","不是月末不执行！");
                        return;
                    }
                    log.audit("执行状态","继续执行");
                    //什么时间点可以执行：如果最后拉取时间是上个月15号 或者 上个月月末，则新tracker的拉取时间为上个月21号
                    if (!results || !results.length) {
                        //var last21Date = getLastMonthDate(20);//获取上个月21号日期
                        begindate = last21Date;
                        //TODO 测试使用 测试后删除
                        //begindate = "2025-04-21";

                    }else {
                        log.audit("start2",latestTaskTrackerRes.getValue({name:"custrecord_swctt_start"}));
                        //tracker最后一次开始时间加24小时
                        var start = formatDate(SWCommons.addHours(SWCommons.timestampToDate(latestTaskTrackerRes.getValue({name:"custrecord_swctt_start"})), 24),"yyyy-MM-dd");

                        // 最后一次抓取结束日期 tracker时间转换为时间格式
                        var lastEndDate = SWCommons.timestampToDate(latestTaskTrackerRes.getValue({name:"custrecord_swctt_start"}));
                        log.audit("1start",start);

                        var lastEndDateTime = formatDate(lastEndDate,"yyyy-MM-dd");

                        //什么时候结束执行：只执行到当月15号
                        if(startTime.slice(8,10) == "15"){
                            if(lastEndDateTime ==this15Date)return;
                        }else {
                            //什么时候结束执行：只执行到当月月末
                            if(lastEndDateTime == thisLastDate)return;
                        }

                        // 如果开始时间 大于【最后一次抓取日期】，则开始时间使用【最后一次抓取开始日期】
                        if (now - lastEndDate > 0) {
                            begindate = start;
                        }else {
                            begindate = startTime;
                        }
                    }


                    start =  begindate.replace(/-/g,"").trim()+"000000";
                    end =  begindate.replace(/-/g,"").trim()+"000000";
                }else {
                    // 最后一次抓取结束日期
                    var lastEndDate = SWCommons.timestampToDate(latestTaskTrackerRes.getValue({name:"custrecord_swctt_end"}));
                    // 获取东8区时间
                    var now = SWCommons.getDate(TIME_ZONE_OFFSET);

                    // 向前推n个小时
                    start = SWCommons.addHours(lastEndDate, -1 * HOURS_BEFORE);
                    // 如果开始时间 大于当前时间，则不查询
                    if (start - now > 0) {
                        return;
                    }

                    // 向后推n个小时
                    // end = SWCommons.addHours(lastEndDate, HOURS_AFTER);

                    // 如果结束时间大于当前时间，则取当前时间
                    // if (end - now >= 0) {
                    //
                    // }
                    end = now;
                }

                taskTrackerRec = record.create({type:"customrecord_swc_task_tracker"});
            }

            log.audit({title:"start:end", details:start + ":" + end});
            var prefix = "";
            if(tranType.name !== "getNavanVoucherList"){
                var startStr = SWCommons.formatDate(start, "yyyy-MM-dd hh:mm:ss");
                var endStr = SWCommons.formatDate(end, "yyyy-MM-dd hh:mm:ss");         // 按照时间跨度取结束时间
                // var endStr = SWCommons.formatDate(now, "yyyy-MM-dd hh:mm:ss");      // 按照当前时间取结束时间
                prefix = tranType.name + "_" + SWCommons.formatDate(start, "yyyyMMddhhmmss") + "_" + SWCommons.formatDate(end, "yyyyMMddhhmmss");

                var timeStamp = getDate(-24,SWCommons.formatDate(start, "yyyy/MM/dd hh:mm:ss"));
                log.audit({title:"timeStamp", details:timeStamp});
            }else {
                prefix = start.slice(0,8)
                log.audit("prefix",prefix);
            }


            // 进行遍历抓取，并创建task
            var index = 0;
            var sumAuthingIdArr = []; // authing接口使用 汇总
            var authingIdArr = []; // authing接口使用
            var nsEmpIdArr = []; // 邮箱包含“@pingcap”并且飞书员工ID（custentity_swc_feishu_userid）为空的员工的邮箱信息
            if(tranType.name == "getEmployeeIDFeiShuList") {
                nsEmpIdArr = getNsEmpDataFeiShu();
            }
            if(tranType.name == "getEmployeeIDFeiShuOUList") {
                nsEmpIdArr = getNsEmpDataFeiShuOU();
            }

            var contractIdArr = []; // 采购申请合同数组zcg
            if(tranType.name == "getFeiShuContractId") {
                contractIdArr = getNSContractId();
            }


            // Salesforce Collection-更新发票接口
            // {"内部Id": {"collAmt": "已支付金额", "collDate": "Collections Date", "collStatus": "Collections Status", "remainAmt": "发票未结清金额", "collId": "record id"}, ...}
            var invoiceObj = {};
            if (tranType.name == "updSalesforceCollectionList") {
                // 取得待更新数据
                invoiceObj = getNsInvoice2Upt();
            }
            var invoiceObjKeyAry = Object.keys(invoiceObj);

            if (platformName == "飞书") {
                var instanceCodejson = {};
                if(tranType.name == "FsSearchPurchaseRequstList"){//采购申请审批回调-查询飞书审批的code数据
                    instanceCodejson = schPrsublistJson();//查询采购申请子列表部分数据(暂时弃用)
                    //instanceCodejson = schPrsublistToNSJson();//查询采购申请子列表部分数据

                }else if(tranType.name == "FsSearchPayRequstList"){//付款申请审批回调-查询飞书审批的code数据
                    instanceCodejson = schApsublistJson();//查询供应商申请子列表部分数据(暂时弃用)
                    //instanceCodejson = schApsublistToNSJson();//查询供应商申请子列表部分数据

                }
                log.audit("instanceCodejson",instanceCodejson);
                if(Object.keys(instanceCodejson).length >0){
                    trackerTotal = Object.keys(instanceCodejson).length;
                }else {
                    trackerTotal = 0;
                }
            }

            // 金蝶云星空凭证拉取的场合，tracker total为0的场合，重新取得总条数
            if (platformName == "金蝶云星空") {
                if (tranType.name == "getKingdeeVoucherList") {
                    log.error("trackerTotal", trackerTotal)
                    data = Commons.getKingdeeSSReqParam({
                        startStr: startStr,
                        endStr: endStr,
                        customReqCond: customReqCond,
                        curPage: curPage - 1, // 默认从0开始
                        PAGE_SIZE: PAGE_SIZE,
                    });
                    var tryCount = 3;
                    // 调用登录接口取得cookie
                    var getCookieResp = SWCommons.tryRequestURL(
                        "https://pingcap.ik3cloud.com/k3cloud/Kingdee.BOS.WebApi.ServicesStub.AuthService.ValidateUser.common.kdsvc",
                        JSON.stringify({"acctID":"20201217180017639", "username":"administrator", "password":"pingcap2022!", "lcid":"2052"}),
                        {"Accept":"application/json","Content-Type":"application/json"},
                        "POST",
                        tryCount);
                    var getCookieRespObj = getCookieResp && getCookieResp.body ? JSON.parse(getCookieResp.body) : {};
                    // 循环处理记录数据条数
                    // 设置登录凭证cookie
                    var headers = {"Content-Type":"application/json","Accept":"*/*"};
                    headers["Cookie"] = "kdservice-sessionid=" + getCookieRespObj["KDSVCSessionId"];
                    // 计算索引
                    var curPageCount = 0, PAGE_SIZE_COUNT = 2000;
                    // 记录凭证数据总条数
                    var totalCount = 0;

                    // 凭证条数: {"公司_凭证": "数量", ...}
                    var voucherCount = {};
                    // 数据请求处理完成区分：当拉取凭证条数为0的场合，结束处理
                    var exePullFlag = true;
                    while (exePullFlag) {
                        try {
                            var data = Commons.getKingdeeSSReqParam({
                                startStr: startStr,
                                endStr: endStr,
                                customReqCond: customReqCond,
                                curPage: curPageCount, // 默认从0开始
                                PAGE_SIZE: PAGE_SIZE_COUNT,
                            });
                            // 调用凭证单据查询接口
                            var response = SWCommons.tryRequestURL("https://pingcap.ik3cloud.com/k3cloud/Kingdee.BOS.WebApi.ServicesStub.DynamicFormService.ExecuteBillQuery.common.kdsvc",
                                JSON.stringify(data.reqData), headers, "POST", tryCount);
                            var bodyObj = response && response.body ? JSON.parse(response.body) : [];
                            // 判断是否存在异常
                            if ((bodyObj[0] && bodyObj[0].hasOwnProperty("Result")) || bodyObj.length == 0) {
                                exePullFlag = false;
                            } else {
                                totalCount += bodyObj.length;
                                curPageCount += 1;
                                // 根据【公司_凭证】分组，取得凭证条数
                                bodyObj.forEach(function (value) {
                                    // 子公司 + "_" + 凭证号
                                    var keyTmp = value[1] + "_" + value[11];
                                    if (voucherCount.hasOwnProperty(keyTmp)) {
                                        // 存在的场合累加1
                                        voucherCount[keyTmp] += 1;
                                    } else {
                                        // [公司_凭证]不存在的场合，设置默认值为1
                                        voucherCount[keyTmp] = 1;
                                    }
                                });
                            }
                        } catch (e) {
                            log.error('金蝶云星空凭证拉取总条数取得失败', e);
                            exePullFlag = false;
                        }
                    }
                    trackerTotal = totalCount;
                }
            }

            do {
                var data = null;
                // 不设置task的外部id标识，避免重复拉取导致task一直是pending状态
                var isNotSetExtId = false;
                if(platformName == "Authing") {
                    if(tranType.name == "getEmployeeList") {
                        data = {
                            pageSize : PAGE_SIZE,
                            curPage : curPage,
                            timeStamp : timeStamp,
                            authingIdArr : authingIdArr
                        };
                    } else if (tranType.name == "getDepartmentList") {
                        data = {
                            pageSize : PAGE_SIZE,
                            curPage : curPage,
                            timeStamp : timeStamp,
                            authingIdArr : authingIdArr
                        };
                    }
                } else if(platformName == "Authing(New)") {
                    if(tranType.name == "getEmployeeList_new") {
                        data = {
                            pageSize : PAGE_SIZE,
                            curPage : curPage,
                            timeStamp : timeStamp,
                            authingIdArr : authingIdArr
                        };
                    } else if (tranType.name == "getDepartmentList_new") {
                        data = {
                            pageSize : PAGE_SIZE,
                            curPage : curPage,
                            timeStamp : timeStamp,
                            authingIdArr : authingIdArr
                        };
                    }
                } else if (platformName == "Navan"){
                    isNotSetExtId = true;
                    if(tranType.name == "getNavanVoucherList") {
                        data = {
                            pageSize : PAGE_SIZE,
                            curPage : curPage,
                            startTime:begindate,
                            newTranslate: startTime,
                            timeStamp : timeStamp,
                            reportType:""
                        };
                    }
                }else if (platformName == "Salesforce") {
                    if(tranType.name == "getSalesforceQueryList") {
                        data = {
                            "pageSize" : PAGE_SIZE,
                            "curPage" : curPage,
                            "pageNo" : curPage-1,//curPage
                            "startTime":startStr,
                            "endTime": endStr,
                            "condSubsidiary":condSubsidiary//自定义请求条件-salesforce公司
                        };
                    }
                    if(tranType.name == "getSalesforceCollectionList") {
                        data = {
                            "pageSize" : PAGE_SIZE,
                            "curPage" : curPage,
                            "pageNo" : curPage-1,//curPage
                            "startTime":startStr,
                            "endTime": endStr,
                            "condSubsidiary":condSubsidiary//自定义请求条件-salesforce公司
                        };
                    }
                    if(tranType.name == "getSalesforceDeleteList") {
                        data = {
                            "pageSize" : PAGE_SIZE,
                            "curPage" : curPage,
                            "pageNo" : curPage-1,//curPage
                            "startTime":startStr,
                            "endTime": endStr
                        };
                    }
                    if (tranType.name == "updSalesforceCollectionList" && invoiceObjKeyAry.length) {
                        var resultPageObj = {};

                        var startIdx = PAGE_SIZE * (curPage - 1);
                        var endIdx = PAGE_SIZE * curPage - 1;
                        for (var i = startIdx; i <= Math.min(invoiceObjKeyAry.length - 1 , endIdx); i++ ) {
                            // {"内部Id": {"collAmt": "已支付金额", "collDate": "Collections Date", "collStatus": "Collections Status", "remainAmt": "发票未结清金额", "collId": "record id"}, ...}
                            resultPageObj[invoiceObjKeyAry[i]] = invoiceObj[invoiceObjKeyAry[i]];
                        }

                        data = {
                            pageSize : PAGE_SIZE,
                            curPage : curPage,
                            timeStamp : timeStamp,
                            invoiceObj : resultPageObj
                        };
                    }
                } else if (platformName == "飞书") {
                    var strTime = startStr.replace(/-/g,"/");
                    var endTime = endStr.replace(/-/g,"/");
                    var fsStartTime = getDate(-22,strTime);
                    var fsEndTime = getDate(-22,endTime);
                    // 存在没有飞书ID的员工才会更新
                    if(tranType.name == "getEmployeeIDFeiShuList" && nsEmpIdArr.length) {
                        var resultPageArr = [];

                        var start11 = PAGE_SIZE * (curPage - 1);
                        var end11 = PAGE_SIZE * curPage - 1;
                        for (var i = start11; i <= Math.min(nsEmpIdArr.length-1 , end11); i++ ) {
                            resultPageArr.push(nsEmpIdArr[i]);
                        }

                        data = {

                            pageSize : PAGE_SIZE,
                            curPage : curPage,
                            timeStamp : timeStamp,
                            empEmailArr : resultPageArr
                        };
                    } else if(tranType.name == "getEmployeeIDFeiShuOUList" && nsEmpIdArr.length) {
                        var resultPageArr = [];

                        var start11 = PAGE_SIZE * (curPage - 1);
                        var end11 = PAGE_SIZE * curPage - 1;
                        for (var i = start11; i <= Math.min(nsEmpIdArr.length-1 , end11); i++ ) {
                            resultPageArr.push(nsEmpIdArr[i]);
                        }

                        data = {

                            pageSize : PAGE_SIZE,
                            curPage : curPage,
                            timeStamp : timeStamp,
                            empEmailArr : resultPageArr
                        };
                        //采购申请审批回调
                    } else if(tranType.name == "FsSearchPurchaseRequstList") {
                        data = {
                            "orderName": "采购申请审批",//此参数只为显示效果
                            "approval_code": "FB6D2FA3-B5C3-4239-BB73-C413F23555A8",
                            //"locale": "zh-CN",
                            "startTime": startStr,//此参数只为显示效果
                            "endTime": endStr,//此参数只为显示效果
                            "instanceCodejson":instanceCodejson,//{prsId：[instanceCode1,instanceCode2,instanceCode3,,....],prsId2：[instanceCode1,instanceCode2,instanceCode3,,....]}
                            //"instance_start_time_from":fsStartTime,//审批开始时间
                            //"instance_start_time_to":fsEndTime,//审批结束时间
                            "pageSize" : PAGE_SIZE,
                            "pageNo" : curPage-1
                        }
                        //付款申请审批回调
                    }else if(tranType.name == "FsSearchPayRequstList") {
                        data = {
                            "orderName": "付款申请审批",//此参数只为显示效果
                            "approval_code": "7475FE86-9720-466A-AE43-F0F79E554AA6",
                            //"locale": "zh-CN",
                            "startTime": startStr,//此参数只为显示效果
                            "endTime": endStr,//此参数只为显示效果
                            "instanceCodejson":instanceCodejson,//{apsId：[instanceCode1,instanceCode2,instanceCode3,,....],apsId2：[instanceCode1,instanceCode2,instanceCode3,,....]}
                            //"instance_start_time_from":fsStartTime,//审批开始时间
                            //"instance_start_time_to":fsEndTime,//审批结束时间
                            "pageSize" : PAGE_SIZE,
                            "pageNo" : curPage-1
                        }
                    } else if(tranType.name == "getFeiShuContractId") {
                        var resultPageArr = [];

                        var start11 = PAGE_SIZE * (curPage - 1);
                        var end11 = PAGE_SIZE * curPage - 1;
                        for (var i = start11; i <= Math.min(contractIdArr.length-1 , end11); i++ ) {
                            resultPageArr.push(contractIdArr[i]);
                        }

                        data = {
                            pageSize : PAGE_SIZE,
                            curPage : curPage,
                            timeStamp : timeStamp,
                            total : contractIdArr.length,
                            contractIdArr : resultPageArr
                        };

                    }
                } else if (platformName == "金蝶云星空") {
                    // 处理请求参数
                    if (tranType.name == "getKingdeeVoucherList") {

                        data = Commons.getKingdeeSSReqParam({
                            startStr: startStr,
                            endStr: endStr,
                            customReqCond: customReqCond,
                            curPage: curPage - 1, // 默认从0开始
                            PAGE_SIZE: PAGE_SIZE,
                            voucherCount: voucherCount
                        });
                    }
                }else if(platformName == "expenseReport"){
                    if (tranType.name == "exReportToJournalList") {
                        data = {
                            "pageSize" : PAGE_SIZE,
                            "curPage" : curPage,
                            "pageNo" : curPage-1//curPage
                        };
                    }
                }

                var options = {
                    code : prefix + "_" + PAGE_SIZE + "_" + curPage + platformName,
                    platform : platformName,
                    tranName :tranType.name, //"fulfillList","orderList"
                    isSchedule : true,
                    data : data,
                    isNotSetExtId: isNotSetExtId
                };
                //飞书 -审批 ---先停止调用飞书审批 改成在NS审批
                if(tranType.name == "FsSearchPurchaseRequstList" || tranType.name == "FsSearchPayRequstList")options.tranName = "fsSearchAuditStatusList";
                //if(tranType.name == "FsSearchPurchaseRequstList" || tranType.name == "FsSearchPayRequstList")options.tranName = "fsSearchAuditStatusToNSList";

                log.audit("options",options);
                SWCommons.createAndExecTask(options);
                var out = options && options.output
                log.audit('AUDIT',JSON.stringify(out))

                var success = out && out.success;
                if (success == true) {
                    if (total < 0) {
                        total = out.total;
                        if(tranType.name == "getEmployeeIDFeiShuList" || tranType.name == "getEmployeeIDFeiShuOUList") {
                            total = nsEmpIdArr.length;
                        }
                        if (tranType.name == "getKingdeeVoucherList") { // 金蝶云星空凭证接口无需重新计算总条数
                            // 取得tracker上的值
                            total = trackerTotal;
                        }
                        if (tranType.name == "getFeiShuContractId") { // 飞书拉取合同接口
                            // 取得tracker上的值
                            total = contractIdArr.length;
                        }
                        if (tranType.name == "updSalesforceCollectionList") { // salesforce更新发票
                            total = invoiceObjKeyAry.length;
                        }
                        if (tranType.name == "updSalesforceCollectionList"){
                            totalPages = 3;

                        }else {
                            totalPages = Math.ceil(total / PAGE_SIZE);
                        }
                    }
                    // authing抓所有数据外键ID用的
                    if(out.authingIdArr) authingIdArr = out.authingIdArr;
                } else {
                    if (total < 0) {
                        log.audit({title:"total<0", details:tranType.name+":首次抓取失败"});
                        return;
                    }
                }
                if(tranType.name == "getSalesforceCollectionList") {
                    if(scriptObj.getRemainingUsage() <= 1000) {
                        break;
                    }
                }else {
                    if(scriptObj.getRemainingUsage() <= 500) {
                        break;
                    }
                }
                //将每页的数据汇总到一起 然后再进行删除操作
                log.audit("authingIdArr.length-"+curPage,authingIdArr.length);
                if(authingIdArr.length>0){
                    for(var k=0;k<authingIdArr.length;k++){
                        if(sumAuthingIdArr.indexOf(authingIdArr[k]) == -1)sumAuthingIdArr.push(authingIdArr[k]);
                    }
                }
                curPage++;
                index++;
            } while (curPage - totalPages <= 0);

            log.audit("sumAuthingIdArr.length",sumAuthingIdArr.length);
            // 将authing 删除的员工数据在NS 非活动
            if(tranType.name == "getEmployeeList_new" && sumAuthingIdArr.length) {
                inactiveDeleteEmpData_new(sumAuthingIdArr);
            }
            // 将authing 删除的部门数据在NS 非活动
            if(tranType.name == "getDepartmentList_new" && sumAuthingIdArr.length) {
                inactiveDeleteDepartmentData_new(sumAuthingIdArr);
            }
            // 将authing 删除的员工数据在NS 非活动
            if(tranType.name == "getEmployeeList" && sumAuthingIdArr.length) {
                inactiveDeleteEmpData(sumAuthingIdArr);
            }
            // 将authing 删除的部门数据在NS 非活动
            if(tranType.name == "getDepartmentList" && sumAuthingIdArr.length) {
                inactiveDeleteDepartmentData(sumAuthingIdArr);
            }

            // Task tracker 状态处理
            var completed = "F";
            if((totalPages - curPage < 0 && total > 0) || total <= 0)
            {
                completed = "T";
            }
            // 设置task tracker信息
            Commons.setFieldsValues(taskTrackerRec, {
                "custrecord_swctt_platform" : platformName
            }, true, true);

            if(tranType.name == "getNavanVoucherList"){
                Commons.setFieldsValues(taskTrackerRec, {
                    "custrecord_swctt_completed" : completed,
                    "custrecord_swctt_start" : start,
                    "custrecord_swctt_end" : end,
                    "custrecord_swctt_total" : total,
                    "custrecord_swctt_page_size" : PAGE_SIZE,
                    "custrecord_swctt_total_pages" : totalPages,
                    "custrecord_swctt_current_page" : Math.min(curPage, totalPages),
                    "custrecord_swctt_type" : tranTypeId,
                    "custrecord_custom_req_cond" : startTime
                }, false, true);
            }else {
                Commons.setFieldsValues(taskTrackerRec, {
                    "custrecord_swctt_completed" : completed,
                    "custrecord_swctt_start" : SWCommons.formatDate(start, "yyyyMMddhhmmss"),
                    "custrecord_swctt_end" : SWCommons.formatDate(end, "yyyyMMddhhmmss"),
                    "custrecord_swctt_total" : total,
                    "custrecord_swctt_page_size" : PAGE_SIZE,
                    "custrecord_swctt_total_pages" : totalPages,
                    "custrecord_swctt_current_page" : Math.min(curPage, totalPages),
                    "custrecord_swctt_type" : tranTypeId,
                }, false, true);
            }
            taskTrackerRec.save({enableSourcing:true,ignoreMandatoryFields:true});
            log.audit({title:"END",details:scriptObj.getRemainingUsage()});
        }

        function getDate(timeZone,timeString) {
            var date = new Date(timeString);
            var utcTime = date.getTime() + date.getTimezoneOffset() * 60 * 1000;
            var tzTime = utcTime + timeZone * 60 * 60 * 1000;
            return tzTime;
        }

        /**
         * 将authing删除的员工在ns非活动
         * @param outData
         */
        function inactiveDeleteEmpData(authingIdArr) {
            var option = {};
            // 获取NS活动且有authing userID的员工
            getNSEmpData(option);
            // 取差集为要非活动的ns
            var needInactiveEmpArr = getDistinc(option.NSAuthingIdArr,authingIdArr);
            // 非活动员工
            if(needInactiveEmpArr.length) {
                for(var i = 0; i < needInactiveEmpArr.length; i++) {

                    var empId = option.NSAuthingIdAndInternalIdJson[needInactiveEmpArr[i]];
                    if(option.oldnewIdJson.hasOwnProperty(needInactiveEmpArr[i]) && option.oldnewIdJson[needInactiveEmpArr[i]].old) {
                        record.submitFields({type:"employee",id:empId,values:{"isinactive":"T"}});
                    }
                }
            }
        }
        /**
         * 将authing删除的员工在ns非活动
         * @param outData
         */
        function inactiveDeleteEmpData_new(authingIdArr) {
            var option = {};
            // 获取NS活动且有authing userID的员工
            getNSEmpData(option);
            // 取差集为要非活动的ns
            var needInactiveEmpArr = getDistinc(option.NSAuthingIdArr,authingIdArr);
            // 非活动员工
            if(needInactiveEmpArr.length) {
                for(var i = 0; i < needInactiveEmpArr.length; i++) {
                    var empId = option.NSAuthingIdAndInternalIdJson[needInactiveEmpArr[i]];
                    if(option.oldnewIdJson.hasOwnProperty(needInactiveEmpArr[i]) && option.oldnewIdJson[needInactiveEmpArr[i]].new) {
                        record.submitFields({type:"employee",id:empId,values:{"isinactive":"T"}});
                    }
                }
            }
        }


        /**
         * 获取NS非活动且有authing userID的员工
         * @param option
         */
        function getNSEmpData(option) {
            option.NSAuthingIdArr = []; // ns存authing id
            option.oldnewIdJson = {}; // 新旧auting标记
            option.NSAuthingIdAndInternalIdJson = {}; //{"ns authingid":"ns internalid"}
            var employeeSearchObj = search.create({
                type: "employee",
                filters: [["isinactive","is","F"], "AND", ["custentity_swc_job_num","isnotempty",""]],
                columns:
                    [
                        search.createColumn({name: "custentity_swc_job_num", label: "Authing员工id"}),
                        search.createColumn({name: "custentity_swc_old_authing_flag", label: "旧auting标记"}),
                        search.createColumn({name: "custentity_swc_new_authing_flag", label: "新auting标记"}),
                        search.createColumn({name: "internalid", label: "内部 ID"})
                    ]
            });
            employeeSearchObj.run().each(function(result) {
                var authingId = result.getValue({name: "custentity_swc_job_num"});
                var oldFlag = result.getValue({name: "custentity_swc_old_authing_flag"});
                var newFlag = result.getValue({name: "custentity_swc_new_authing_flag"});
                var internalId = result.getValue({name: "internalid"});
                option.NSAuthingIdArr.push(authingId);
                option.oldnewIdJson[authingId] = {};
                option.oldnewIdJson[authingId]["new"] = newFlag;
                option.oldnewIdJson[authingId]["old"] = oldFlag;
                option.NSAuthingIdAndInternalIdJson[authingId] = internalId;
                return true;
            });
        }

        /**
         * 将authing 删除的部门数据在NS 非活动
         * @param authingIdArr
         */
        function inactiveDeleteDepartmentData_new(authingIdArr) {
            var option = {};
            // 获取NS活动且有authing 部门ID的员工
            getNSDPData(option);
            // 取差集为要非活动的ns
            var needInactiveDPArr = getDistinc(option.NSAuthingIdArr,authingIdArr);
            // 非活动员工
            if(needInactiveDPArr.length) {
                for(var i = 0; i < needInactiveDPArr.length; i++) {
                    var dpId = option.NSAuthingIdAndInternalIdJson[needInactiveDPArr[i]];
                    if(option.oldnewIdJson.hasOwnProperty(needInactiveDPArr[i]) && option.oldnewIdJson[needInactiveDPArr[i]].new) {
                        //record.submitFields({type:"department",id:dpId,values:{"isinactive":"T"}});
                        //20260108  John Wang   优化：部门非活动时，修改部门名称，避免重复
                        var dpRec = record.load({type:"department",id:dpId});
                        var dpName = dpRec.getValue({fieldId:"name"});
                        dpName = dpName + '_' + (new Date().getTime() + '').slice(-4);
                        dpRec.setValue({fieldId:"name",value:dpName.slice(0, 60)}); // 部门名称限制长度为60
                        dpRec.setValue({fieldId:"isinactive",value:"T"});
                        dpRec.save({enableSourcing:true,ignoreMandatoryFields:true});
                    }
                }
            }
        }
        /**
         * 将authing 删除的部门数据在NS 非活动
         * @param authingIdArr
         */
        function inactiveDeleteDepartmentData(authingIdArr) {
            var option = {};
            // 获取NS活动且有authing 部门ID的员工
            getNSDPData(option);
            // 取差集为要非活动的ns
            var needInactiveDPArr = getDistinc(option.NSAuthingIdArr,authingIdArr);
            // log.audit("ns已有部门",JSON.stringify(option.NSAuthingIdArr));
            // log.audit("接口抓回来部门",JSON.stringify(authingIdArr));
            // log.audit("要非活动的部门",JSON.stringify(needInactiveDPArr));
            // 非活动员工
            if(needInactiveDPArr.length) {
                for(var i = 0; i < needInactiveDPArr.length; i++) {
                    var dpId = option.NSAuthingIdAndInternalIdJson[needInactiveDPArr[i]];
                    if(option.oldnewIdJson.hasOwnProperty(needInactiveDPArr[i]) && option.oldnewIdJson[needInactiveDPArr[i]].old) {
                        log.audit("要非活动的部门内部ID"+dpId,"非活动成功");
                        //record.submitFields({type:"department",id:dpId,values:{"isinactive":"T"}});
                        //20260108  John Wang   优化：部门非活动时，修改部门名称，避免重复
                        var dpRec = record.load({type:"department",id:dpId});
                        var dpName = dpRec.getValue({fieldId:"name"});
                        dpName = dpName + '_' + (new Date().getTime() + '').slice(-4);
                        dpRec.setValue({fieldId:"name",value:dpName.slice(0, 60)}); // 部门名称限制长度为60
                        dpRec.setValue({fieldId:"isinactive",value: true});
                        dpRec.save({enableSourcing:true,ignoreMandatoryFields:true});
                    }
                }
            }
        }



        /**
         * 获取NS活动且有authing 部门ID的员工
         * @param option
         */
        function getNSDPData(option) {
            option.NSAuthingIdArr = []; // ns存authing id
            option.oldnewIdJson = {}; // 新旧auting标记
            option.NSAuthingIdAndInternalIdJson = {}; //{"ns authingid":"ns internalid"}
            var employeeSearchObj = search.create({
                type: "department",
                filters: [["isinactive","is","F"], "AND", ["custrecord_swc_authing_departid","isnotempty",""]],
                columns:
                    [
                        search.createColumn({name: "custrecord_swc_authing_departid", label: "Authing员工id"}),
                        search.createColumn({name: "custrecord_swc_old_authing_flag", label: "旧auting标记"}),
                        search.createColumn({name: "custrecord_swc_new_authing_flag", label: "新auting标记"}),
                        search.createColumn({name: "internalid", label: "内部 ID"})
                    ]
            });
            employeeSearchObj.run().each(function(result) {
                var authingId = result.getValue({name: "custrecord_swc_authing_departid"});
                var oldFlag = result.getValue({name: "custrecord_swc_old_authing_flag"});
                var newFlag = result.getValue({name: "custrecord_swc_new_authing_flag"});
                var internalId = result.getValue({name: "internalid"});
                option.NSAuthingIdArr.push(authingId);
                option.oldnewIdJson[authingId] = {};
                option.oldnewIdJson[authingId]["new"] = newFlag;
                option.oldnewIdJson[authingId]["old"] = oldFlag;
                option.NSAuthingIdAndInternalIdJson[authingId] = internalId;
                return true;
            });
        }
        /**
         * 邮箱包含“@pingcap”并且飞书员工ID（custentity_swc_feishu_ouid）为空的员工的邮箱信息
         */
        function getNsEmpDataFeiShuOU() {
            var arr = [];
            var employeeSearchObj = search.create({
                type: "employee",
                filters:
                    [
                        ["custentity_swc_feishu_ouid","isempty",""],
                        "AND",
                        ["email","haskeywords","@pingcap"],
                        "AND",
                        ["isinactive","is","F"]
                    ],
                columns:
                    [
                        search.createColumn({name: "email", label: "电子邮件"}),
                        search.createColumn({name: "internalid", label: "内部 ID"})
                    ]
            });
            employeeSearchObj.run().each(function(result) {
                var obj = {
                    "empId" : result.getValue({name: "internalid"}),
                    "empEmail" : result.getValue({name: "email"})
                }
                arr.push(obj);
                return true;
            });
            return arr;
        }
        /**
         * 邮箱包含“@pingcap”并且飞书员工ID（custentity_swc_feishu_userid）为空的员工的邮箱信息
         */
        function getNsEmpDataFeiShu() {
            var arr = [];
            var employeeSearchObj = search.create({
                type: "employee",
                filters:
                    [
                        ["custentity_swc_feishu_userid","isempty",""],
                        "AND",
                        ["email","haskeywords","@pingcap"],
                        "AND",
                        ["isinactive","is","F"]
                    ],
                columns:
                    [
                        search.createColumn({name: "email", label: "电子邮件"}),
                        search.createColumn({name: "internalid", label: "内部 ID"})
                    ]
            });
            employeeSearchObj.run().each(function(result) {
                var obj = {
                    "empId" : result.getValue({name: "internalid"}),
                    "empEmail" : result.getValue({name: "email"})
                }
                arr.push(obj);
                return true;
            });
            return arr;
        }

        /**
         * 获取中间表 飞书合同ContractId  合同ID
         */
        function getNSContractId() {
            var arr = [];
            var customrecord_swc_feishu_contractidSearchObj = search.create({
                type: "customrecord_swc_feishu_contractid",
                filters: [["custrecord_line_success_flag","is","F"]],
                columns:
                    [
                        search.createColumn({name: "internalid", label: "内部 ID"}),
                        search.createColumn({name: "custrecord_line_contractid", label: "contractid"})
                    ]
            });
            customrecord_swc_feishu_contractidSearchObj.run().each(function(result){
                var contractId = result.getValue({name: "custrecord_line_contractid"});
                arr.push(contractId);
                return true;
            });
            return arr;
        }
        /**
         * 取得待更新数据
         * @return {"内部Id": {"collAmt": "已支付金额", "collDate": "Collections Date", "collStatus": "Collections Status", "remainAmt": "发票未结清金额", "collId": "record id"}, ...}
         */
        function getNsInvoice2Upt() {
            var invoiceSearchObj = search.create({
                type: "invoice",
                filters:
                    [
                        ["type","anyof","CustInvc"],
                        "AND",
                        ["taxline","is","F"],
                        "AND",
                        ["cogs","is","F"],
                        "AND",
                        ["custbody_swc_push_collection_flag","is","T"],
                        "AND",
                        ["mainline","is","T"],
                        "AND",
                        ["applyingtransaction.type","anyof","CustPymt"],
                        "AND",
                        ["custbody_swc_collection_id","isnotempty",""]
                    ],
                columns:
                    [
                        search.createColumn({
                            name: "internalid",
                            summary: "GROUP",
                            label: "内部 ID"
                        }),
                        search.createColumn({
                            name: "fxamount",
                            summary: "AVG",
                            label: "金额（外币）"
                        }),
                        search.createColumn({
                            name: "formulanumeric",
                            summary: "SUM",
                            formula: "ABS({applyingtransaction.fxamount})",
                            label: "公式（数值）"
                        }),
                        search.createColumn({
                            name: "custbody_swc_collections_date",
                            summary: "GROUP",
                            label: "collections date"
                        }),
                        search.createColumn({
                            name: "custbody_swc_collection_id",
                            summary: "GROUP",
                            label: "Record ID"
                        })
                    ]
            });

            var allResults = Commons.getAllResults(invoiceSearchObj);

            // {"内部Id": {"collAmt": "已支付金额", "collDate": "Collections Date", "collStatus": "Collections Status", "remainAmt": "发票未结清金额", "collId": "record id"}, ...}
            var invoiceObj = {};
            allResults.forEach(function (value) {
                var collId = value.getValue({
                    name: "custbody_swc_collection_id",
                    summary: "GROUP",
                    label: "Record ID"
                });

                // saleforce record id为空的场合，当前数据处理略过
                if (collId == "- None -") return;

                var intlId = value.getValue({
                    name: "internalid",
                    summary: "GROUP",
                    label: "内部 ID"
                });
                var fxAmt = value.getValue({
                    name: "fxamount",
                    summary: "AVG",
                    label: "金额（外币）"
                });
                var applyTransFxAmt = value.getValue({
                    name: "formulanumeric",
                    summary: "SUM",
                    formula: "ABS({applyingtransaction.fxamount})",
                    label: "公式（数值）"
                });
                var collDate = value.getValue({
                    name: "custbody_swc_collections_date",
                    summary: "GROUP",
                    label: "collections date"
                });

                var collDateStr = null;
                if (collDate) {
                    collDate = format.parse({value: collDate, type: format.Type.DATE});
                    collDateStr = collDate.getFullYear() + "-" + (collDate.getMonth() + 1) + "-" +collDate.getDate();
                }

                invoiceObj[intlId] =  {
                    collAmt: applyTransFxAmt,                        // Collections Amount 已支付金额
                    collDate: collDateStr,                           // Collections Date 自定义字段
                    collStatus: "Collected",                         // 开发环境启用 Collections Status 固定值设定 "Collected"
                    remainAmt: decimal.subN(fxAmt, applyTransFxAmt), // Remaining Amount 发票未结清金额
                    collId: collId                                   // saleforce record id
                };

            });

            return invoiceObj;
        }

        /**
         * 两数组取差集
         * @param a
         * @param b
         */
        function getDistinc(a,b) {
            return a.filter(function (v){return b.indexOf(v) == -1});
        }

        /**
         * 查询采购申请子列表 审批状态为飞书审批中或者驳回  飞书INSTANCE_CODE不为空 并且采购订单号不存在的 采购申请单号 和 飞书INSTANCE_CODE 存入JSON（暂时弃用）
         */
        function schPrsublistJson() {
            //格式： {prsId：[instanceCode1,instanceCode2,instanceCode3,,....],prsId2：[instanceCode1,instanceCode2,instanceCode3,,....]}
            var instanceCodejson = {};
            var customrecord_swc_prsublistSearchObj = search.create({
                type: "customrecord_swc_prsublist",
                filters:
                    [
                        ["custrecord_prs_instance_code","isnotempty",""],
                        "AND",
                        ["custrecord_prs_line_status","anyof","3","5"],
                        "AND",
                        ["custrecord_prs_ponum","anyof","@NONE@"]
                    ],
                columns:
                    [
                        search.createColumn({name: "custrecord_prs_field", label: "采购申请单号"}),
                        search.createColumn({name: "custrecord_prs_instance_code", label: " 飞书INSTANCE_CODE"})
                    ]
            });
            //var prsublistResult = getAllResults(customrecord_swc_prsublistSearchObj);
            customrecord_swc_prsublistSearchObj.run().each(function(result) {
                var prsId = result.getValue({name: "custrecord_prs_field", label: "采购申请单号"});
                var instanceCode = result.getValue({name: "custrecord_prs_instance_code", label: " 飞书INSTANCE_CODE"});
                if(prsId && instanceCode){
                    var insArr = [];
                    if(instanceCodejson.hasOwnProperty(prsId)){
                        insArr = instanceCodejson[prsId];
                    }
                    insArr.push(instanceCode);
                    instanceCodejson[prsId] = insArr;
                }
                return true;
            });
            return instanceCodejson;
        }

        /**
         * 查询供应商申请子列表 审批状态为飞书审批中或者驳回  飞书INSTANCE_CODE不为空 ,供应商申请单号 和 飞书INSTANCE_CODE 存入JSON（暂时弃用）
         */
        function schApsublistJson() {
            //格式： {apsId：[instanceCode1,instanceCode2,instanceCode3,,....],apsId2：[instanceCode1,instanceCode2,instanceCode3,,....]}
            var instanceCodejson = {};
            var customrecord_swc_apsublistSearchObj = search.create({
                type: "customrecord_swc_apsublist",
                filters:
                    [
                        ["custrecord_aps_instance_code","isnotempty",""],
                        "AND",
                        ["custrecord_aps_line_status","anyof","4","2"]
                    ],
                columns:
                    [
                        search.createColumn({name: "custrecord_aps_instance_code", label: "飞书INSTANCE_CODE"}),
                        search.createColumn({name: "custrecord_aps_field", label: "供应商账单申请单号"})
                    ]
            });
            customrecord_swc_apsublistSearchObj.run().each(function(result) {
                var apsId = result.getValue({name: "custrecord_aps_field", label: "供应商账单申请单号"});
                var instanceCode = result.getValue({name: "custrecord_aps_instance_code", label: "飞书INSTANCE_CODE"});
                if(apsId && instanceCode){
                    var insArr = [];
                    if(instanceCodejson.hasOwnProperty(apsId)){
                        insArr = instanceCodejson[apsId];
                    }
                    insArr.push(instanceCode);
                    instanceCodejson[apsId] = insArr;
                }
                return true;
            });
            return instanceCodejson;
        }

        /**
         * 查询采购申请子列表 审批状态为飞书审批中或者驳回  【采购审批中间表】ID 不为空 并且采购订单号不存在的 采购申请单号 和 【采购审批中间表】ID 存入JSON
         */
        function schPrsublistToNSJson() {
            //格式： {prsId：[instanceCode1,instanceCode2,instanceCode3,,....],prsId2：[instanceCode1,instanceCode2,instanceCode3,,....]}
            var instanceCodejson = {};
            var customrecord_swc_prsublistSearchObj = search.create({
                type: "customrecord_swc_prsublist",
                filters:
                    [
                        ["custrecord_prs_ns_approval","isnotempty",""],
                        "AND",
                        ["custrecord_prs_line_status","anyof","3","5"],
                        "AND",
                        ["custrecord_prs_ponum","anyof","@NONE@"]
                    ],
                columns:
                    [
                        search.createColumn({name: "custrecord_prs_field", label: "采购申请单号"}),
                        search.createColumn({name: "custrecord_prs_ns_approval", label: " 采购审批中间表"})
                    ]
            });
            //var prsublistResult = getAllResults(customrecord_swc_prsublistSearchObj);
            customrecord_swc_prsublistSearchObj.run().each(function(result) {
                var prsId = result.getValue({name: "custrecord_prs_field", label: "采购申请单号"});
                var instanceCode = result.getValue({name: "custrecord_prs_ns_approval", label: " 采购审批中间表"});
                if(prsId && instanceCode){
                    var insArr = [];
                    if(instanceCodejson.hasOwnProperty(prsId)){
                        insArr = instanceCodejson[prsId];
                    }
                    insArr.push(instanceCode);
                    instanceCodejson[prsId] = insArr;
                }
                return true;
            });
            return instanceCodejson;
        }

        /**
         * 查询供应商申请子列表 审批状态为飞书审批中或者驳回  采购申请中间表不为空 ,供应商申请单号 和 采购申请中间表 存入JSON
         */
        function schApsublistToNSJson() {
            //格式： {apsId：[instanceCode1,instanceCode2,instanceCode3,,....],apsId2：[instanceCode1,instanceCode2,instanceCode3,,....]}
            var instanceCodejson = {};
            var customrecord_swc_apsublistSearchObj = search.create({
                type: "customrecord_swc_apsublist",
                filters:
                    [
                        ["custrecord_aps_ns_approval","isnotempty",""],
                        "AND",
                        ["custrecord_aps_line_status","anyof","4","2"]
                    ],
                columns:
                    [
                        search.createColumn({name: "custrecord_aps_ns_approval", label: "采购申请中间表"}),
                        search.createColumn({name: "custrecord_aps_field", label: "供应商账单申请单号"})
                    ]
            });
            customrecord_swc_apsublistSearchObj.run().each(function(result) {
                var apsId = result.getValue({name: "custrecord_aps_field", label: "供应商账单申请单号"});
                var instanceCode = result.getValue({name: "custrecord_aps_ns_approval", label: "采购申请中间表"});
                if(apsId && instanceCode){
                    var insArr = [];
                    if(instanceCodejson.hasOwnProperty(apsId)){
                        insArr = instanceCodejson[apsId];
                    }
                    insArr.push(instanceCode);
                    instanceCodejson[apsId] = insArr;
                }
                return true;
            });
            return instanceCodejson;
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
        function to2Digits(num) {
            return (num < 10 ? "0" : "") + num;
        }

        //获取当月最后一天日期
        function getLastDayOfMonth() {
            var currentDate = new Date();
            var year = currentDate.getFullYear();
            var month = currentDate.getMonth() + 1; // 月份从0开始，需要加1
            var lastDayOfMonth = new Date(year, month, 0).getDate();
            if(month<10)month = "0"+month;
            return year+"-"+month+"-"+lastDayOfMonth;
        }

        //获取上个月某一天日期
        function getLastMonthDate(day) {
            var date = new Date();
            date.setMonth(date.getMonth() - 1); // 上个月
            date.setDate(day); // 设置为上个月的某一天
            return date.toISOString().slice(0,10);
        }

        //获取本月某一天日期
        function getThisMonthDate(day) {
            var date = new Date();
            date.setMonth(date.getMonth()); // 上本
            date.setDate(day); // 设置为本月的某一天
            return date.toISOString().slice(0,10);
        }

        //获取下个月第一天日期
        function getFirstDayOfNextMonth() {
            var now = new Date();
            var nextMonth = now.getMonth() + 1; // 当前月份加1
            var nextYear = now.getFullYear(); // 当前年份，如果下个月是12月，则年份需要增加
            var time = "";
            if (nextMonth === 12) {
                time =  new Date(nextYear + 1, 0, 1); // 如果下个月是12月，则年份增加1，月份变为0（即1月）
            } else {
                time =  new Date(nextYear, nextMonth, 1); // 下个月的第一天
            }
            return formatDate(time,"yyyy-MM-dd");

        }


        return {
            execute: execute
        };

    });
