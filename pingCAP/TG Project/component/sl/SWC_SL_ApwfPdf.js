/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 */
define(['../../common/juicerTemplateEngine.js','N/search','N/record','N/file','N/runtime','N/format','N/url'],
    
    (juicerTemplateEngine,search,record, file,runtime,format,url) => {
        /**
         * Defines the Suitelet script trigger point.
         * @param {Object} scriptContext
         * @param {ServerRequest} scriptContext.request - Incoming request
         * @param {ServerResponse} scriptContext.response - Suitelet response
         * @since 2015.2
         */
        const onRequest = (scriptContext) => {
            var options = {};
            options.request = scriptContext.request;
            options.response = scriptContext.response;

            options.recid = options.request.parameters.recid;
            log.audit('id', options.recid);
            // var rec = record.load({type: "customrecord_swc_ap_wf", id: options.recid});
            var searchObj = search.create({
                type: "customrecord_swc_ap_wf",
                filters:
                    [
                        ["internalid","anyof",options.recid]
                    ],
                columns:
                    [
                        search.createColumn({name: "custrecord_apwf_buyer", label: "提交人"}),
                        search.createColumn({
                            name: "department",
                            join: "CUSTRECORD_APWF_BUYER",
                            label: "部门"
                        }),
                        search.createColumn({name: "custrecord_apwf_line_status", label: "审批状态"}),
                        search.createColumn({name: "custrecord_apwf_department", label: "预算归属部门"}),
                        search.createColumn({name: "custrecord_apwf_reason_description", label: "事由描述"}),
                        search.createColumn({name: "custrecord_apwf_catagorytype", label: "费用类别"}),
                        search.createColumn({name: "custrecord_apwf_item", label: "货品"}),
                        search.createColumn({name: "custrecord_apwf_payment_method", label: "付款方式"}),
                        search.createColumn({
                            name: "namenohierarchy",
                            join: "CUSTRECORD_APWF_PAYSUB",
                            label: "名称（无层次结构）"
                        }),
                        search.createColumn({name: "custrecord_apwf_vendorname", label: "供应商名称"}),
                        search.createColumn({name: "custrecord_apwf_currency", label: "币种"}),
                        search.createColumn({name: "custrecord_apwf_po_amount", label: "采购订单金额"}),
                        search.createColumn({name: "custrecord_apwf_po_amount_paid", label: "采购订单已付金额"}),
                        search.createColumn({name: "custrecord_apwf_po_amount_unpay", label: "采购订单未付金额"}),
                        search.createColumn({name: "custrecord_apwf_po", label: "采购订单"}),
                        search.createColumn({name: "custrecord_apwf_totalamount", label: "总金额"}),
                        search.createColumn({name: "custrecord_apwf_taxcode", label: "税码"}),
                        search.createColumn({name: "custrecord_apwf_vendor_bankname", label: "Vendor Bank Name"}),
                        search.createColumn({name: "custrecord_apwf_vendor_bank_accountno", label: "Vendor Bank Account No."}),
                        search.createColumn({name: "custrecord_apwf_vendorbank_citystate", label: "Vendor Bank City or State"}),
                        search.createColumn({name: "custrecord_apwf_swiftcode", label: "SWIFT CODE"}),
                        search.createColumn({name: "custrecord_apwf_routing_transitno", label: "Routing & Transit no."}),
                        search.createColumn({name: "custrecord_apwf_invoiceno", label: "invoice编号"}),
                        search.createColumn({name: "custrecord_apwf_invoice_attachment2", label: "发票附件1"}),
                        search.createColumn({name: "custrecord_apwf_actul_paytime", label: "付款日期"}),
                        search.createColumn({name: "custrecord_apwf_paydate", label: "期望付款日期"}),
                        search.createColumn({name: "created", label: "创建日期"})
                    ]
            });
            var searchResultCount = searchObj.runPaged().count;
            if (searchObj && searchResultCount > 0) {
                searchObj.run().each(function(rec){
                    options.printUser = runtime.getCurrentUser().name; // 打印人员【当前用户】
                    var printTime = new Date();
                    options.printTime = printTime.getFullYear() + '-' + (printTime.getMonth() * 1 + 1) + '-'
                        + printTime.getDate() + ' ' + String(printTime.getHours()).padStart(2, '0')
                        + ':' + String(printTime.getMinutes()).padStart(2, '0'); // 打印时间【当前时间】
                    options.apCode = printTime.getFullYear().toString() + (printTime.getMonth()*1 + 1).toString()
                        + printTime.getDate().toString() + options.recid.toString(); // 申请编号【年月日+内部id】
                    options.buyer = rec.getText({name: "custrecord_apwf_buyer"}); // 申请人【提交人】
                    options.dept = rec.getText({name: "department", join: "CUSTRECORD_APWF_BUYER"}); // 所属部门
                    options.status = rec.getText({name: "custrecord_apwf_line_status"}); // 审批状态
                    options.apDept = rec.getText({name: "custrecord_apwf_department"}); // 预算所属部门
                    options.description = rec.getValue({name: "custrecord_apwf_reason_description"}); // 事由描述
                    options.catagorytype = rec.getText({name: "custrecord_apwf_catagorytype"}); // 费用类别
                    options.item = rec.getText({name: "custrecord_apwf_item"}); // 货品
                    options.payMethod = rec.getText({name: "custrecord_apwf_payment_method"}); // 付款方式
                    options.paySub = rec.getValue({name: "namenohierarchy",
                        join: "CUSTRECORD_APWF_PAYSUB",
                        label: "名称（无层次结构）"}); // 付款主体
                    options.vendor = rec.getText({name: "custrecord_apwf_vendorname"}); // 供应商名称
                    options.currency = rec.getText({name: "custrecord_apwf_currency"}); // 币种
                    options.amount = rec.getValue({name: "custrecord_apwf_po_amount"}); // 采购订单金额
                    options.amount_paid = rec.getValue({name: "custrecord_apwf_po_amount_paid"}); // 采购订单已付金额
                    options.amount_unpay = rec.getValue({name: "custrecord_apwf_po_amount_unpay"}); // 采购订单未付金额
                    var po = rec.getValue({name: "custrecord_apwf_po"}); // NS采购订单
                    options.poUrl = "";
                    if (po){
                        var scheme = 'https://';
                        var Host = url.resolveDomain({hostType: url.HostType.APPLICATION});
                        options.poUrl = scheme + Host + url.resolveRecord({recordType: "purchaseorder", recordId: po}); // NS采购订单链接
                    }
                    options.totalamount = rec.getValue({name: "custrecord_apwf_totalamount"}); // 付款金额
                    options.taxcode = rec.getText({name: "custrecord_apwf_taxcode"}); // Tax Rate
                    options.bank = rec.getValue({name: "custrecord_apwf_vendor_bankname"}); // Vendor Bank Name
                    options.account = rec.getValue({name: "custrecord_apwf_vendor_bank_accountno"}); // VENDOR BANK ACCOUNT NO.
                    options.citystate = rec.getValue({name: "custrecord_apwf_vendorbank_citystate"}); // VENDOR BANK CITY OR STATE
                    options.swift = rec.getValue({name: "custrecord_apwf_swiftcode"}); // SWIFT CODE
                    options.transitno = rec.getValue({name: "custrecord_apwf_routing_transitno"}); // ROUTING & TRANSIT NO.
                    options.invoiceno = rec.getValue({name: "custrecord_apwf_invoiceno"}); // INVOICE编号
                    var attach = rec.getValue({name: "custrecord_apwf_invoice_attachment2"}); // 发票附件1
                    if (attach){
                        options.attach = 1;
                    }else {
                        options.attach = 0;
                    }
                    var paydate = new Date(format.parse({value: rec.getValue({name: "custrecord_apwf_paydate"}), type: format.Type.DATE}));
                    log.audit('paydate',paydate)
                    if (paydate)options.paydate = paydate.getFullYear() + "年" + (paydate.getMonth()*1+1) + "月" + paydate.getDate() + "日"; // 期望付款日期
                    var paytime = new Date(format.parse({value: rec.getValue({name: "custrecord_apwf_actul_paytime"}), type: format.Type.DATE}));
                    if (paytime)options.paytime = paytime.getFullYear() + "年" + (paytime.getMonth()*1+1) + "月" + paytime.getDate() + "日"; // 付款日期（财务填写）
                    var reason = rec.getValue({name: "custrecord_apwf_over_reason"}); // 超申请判断
                    if (reason){
                        options.reason = "是";
                    }else {
                        options.reason = "否";
                    }
                    //jjp+ 20240322 CEG 审批 字段赋值   start
                    var apwfDepartment = rec.getText({name: "custrecord_apwf_department"}); // 预算所属部门
                    var createDate = rec.getValue({name: "created", label: "创建日期"}); // 创建日期
                    var date = format.parse({value:createDate,type:format.Type.DATE}).getTime();
                    var apwfItem = rec.getText({name: "custrecord_apwf_item"}); // 货品;
                    var item = apwfItem.split("(")[0];
                    var year = "";
                    var fiscalYearArr = fiscalYearSearch();//查询审批模版财年自定义record
                    //如果创建时间在【审批模版财年】时间范围内 取财年字段year
                    if(fiscalYearArr.length>0){
                        for(var i=0;i<fiscalYearArr.length;i++){
                            var startTime =fiscalYearArr[i]["startTime"]? format.parse({value:fiscalYearArr[i]["startTime"],type:format.Type.DATE}).getTime():"";
                            var endTime = fiscalYearArr[i]["endTime"]? format.parse({value:fiscalYearArr[i]["endTime"],type:format.Type.DATE}).getTime():"";
                            if(date>=startTime && date<=endTime){
                                year = fiscalYearArr[i]["year"];
                                break;
                            }
                        }
                    }
                    var ceg = "预算归属于 "+ apwfDepartment +"，"+year+"，"+item;
                    log.audit("CEG 审批",ceg);
                    options.ceg = ceg;//CEG 审批
                    //jjp+ 20240322 CEG 审批 字段赋值  end
                    return true;
                });
            }

            // 审批进程内容
            options.approvelArr = approvelSearch(options.recid);

            //绑定xml文件
            var fileOne = file.load('../xml/SWC_XML_ApwfPdf.xml');
            var template = fileOne.getContents();
            var xmlstr = juicer(template, options);
            options.response.renderPdf({xmlString: xmlstr});
        }

        /**
         * 根据采购付款审批id查找审批进程
         * @param id
         * @returns {*[]}
         */
        function approvelSearch(id) {
            var approvelArr = [];
            var customrecord_swc_approval_processSearchObj = search.create({
                type: "customrecord_swc_approval_process",
                filters:
                    [
                        ["custrecord_ap_process_key","anyof",id]
                    ],
                columns:
                    [
                        search.createColumn({ name: "custrecord_ap_process_num",
                            sort: search.Sort.ASC,
                            label: "序号"}),
                        search.createColumn({name: "custrecord_ap_process_node", label: "节点"}),
                        search.createColumn({name: "custrecord_ap_process_now", label: "进程"})
                    ]
            });
            var searchResultCount = customrecord_swc_approval_processSearchObj.runPaged().count;
            if (customrecord_swc_approval_processSearchObj && searchResultCount > 0){
                customrecord_swc_approval_processSearchObj.run().each(function(result){
                    approvelArr.push({
                        node: result.getValue({name: "custrecord_ap_process_node", label: "节点"}),
                        now: result.getValue({name: "custrecord_ap_process_now", label: "进程"})
                    });
                    // .run().each has a limit of 4,000 results
                    return true;
                });
            }
            return approvelArr;
        }

        /**
         * 查询审批模版财年自定义record
         */
        function fiscalYearSearch() {
            var fiscalYearArr = [];
            var customrecord_swc_feishu_fiscal_yearSearchObj = search.create({
                type: "customrecord_swc_feishu_fiscal_year",
                filters:
                    [
                    ],
                columns:
                    [
                        search.createColumn({name: "custrecord_fs_from_date", label: "财年开始日期"}),
                        search.createColumn({name: "custrecord_fs_to_date", label: "财年结束日期"}),
                        search.createColumn({name: "custrecord_fs_year", label: "财年"})
                    ]
            });

            var searchResultCount = customrecord_swc_feishu_fiscal_yearSearchObj.runPaged().count;
            if (customrecord_swc_feishu_fiscal_yearSearchObj && searchResultCount > 0){
                customrecord_swc_feishu_fiscal_yearSearchObj.run().each(function(result){
                    var fiscalYearJson = {};
                    fiscalYearJson["startTime"] = result.getValue({name: "custrecord_fs_from_date", label: "财年开始日期"});
                    fiscalYearJson["endTime"] =  result.getValue({name: "custrecord_fs_to_date", label: "财年结束日期"});
                    fiscalYearJson["year"] =  result.getValue({name: "custrecord_fs_year", label: "财年"});
                    fiscalYearArr.push(fiscalYearJson);
                    return true;
                });
            }
            return fiscalYearArr;
        }

        /**
         * 根据提交人查找所属部门
         * @param buyerId
         * @returns {string}
         */
        // function searchDept(buyerId) {
        //     var dept = "";
        //     var employeeSearchObj = search.create({
        //         type: "employee",
        //         filters:
        //             [
        //                 ["internalid","anyof","2880"]
        //             ],
        //         columns:
        //             [
        //                 search.createColumn({name: "department", label: "部门"})
        //             ]
        //     });
        //     var searchResultCount = employeeSearchObj.runPaged().count;
        //     if (employeeSearchObj && searchResultCount > 0){
        //         employeeSearchObj.run().each(function(result){
        //             dept = result.getText({name: "department", label: "部门"});
        //             // .run().each has a limit of 4,000 results
        //             return true;
        //         });
        //     }
        //     return dept
        // }

        return {onRequest}

    });
