/**
 * @NApiVersion 2.0
 * @NScriptType UserEventScript
 * @NModuleScope Public
 */


define(["N/record","N/search","N/format","N/https","../../common/Commons.js","N/runtime","../../lib/underscore.js"],
    /**
     * 银企直连中间表支付成功的操作
     * @param record
     * @param search
     * @param format
     */
    function(record,search,format,https,Commons,runtime)
    {
        /**
         * Function definition to be triggered before record is loaded.
         *
         * @param {Object} scriptContext
         * @param {Record} scriptContext.newRecord - New record
         * @param {Record} scriptContext.oldRecord - Old record
         * @param {string} scriptContext.type - Trigger type
         * @Since 2015.2
         */
        function beforeLoad(scriptContext)
        {
            if(scriptContext.type == "copy")
            {
                scriptContext.newRecord.setValue({fieldId:"custrecord_swcpp_state",value:4});
                scriptContext.newRecord.setValue({fieldId:"custrecord_swcpp_payonlylist",value:""});
                scriptContext.newRecord.setValue({fieldId:"custrecord_swcpp_tranid",value:""});
                scriptContext.newRecord.setValue({fieldId:"custrecord_swcpp_err_msg",value:""});
            }
        }

        /**
         * Function definition to be triggered before record is loaded.
         *
         * @param {Object} scriptContext
         * @param {Record} scriptContext.newRecord - New record
         * @param {Record} scriptContext.oldRecord - Old record
         * @param {string} scriptContext.type - Trigger type
         * @Since 2015.2
         */
        function afterSubmit(scriptContext)
        {
            var newRec = scriptContext.newRecord;
            var oldRec = scriptContext.oldRecord;
            if(scriptContext.type == "create")
            {
                var customform = newRec.getValue({fieldId:"customform"});
                var leftStr = "";
                if(customform == 70)leftStr = "CMB";
                if(customform == 83)leftStr = "JPM";
                if(customform == 87)leftStr = "SVB";
                if(customform == 88)leftStr = "CITI";
                //支付记录创建时，业务参考号自动赋值为单据内部标识，有效防止重复
                record.submitFields({type:"customrecord_swc_payment_platform",id:newRec.id,values:{"custrecord_swcpp_tranid":leftStr + newRec.id + ""}});
            }
            // 校验一下 只有支付状态第一次变成支付成功才触发
            if(scriptContext.type == "edit") {
                var bank = newRec.getValue({fieldId:"custrecord_swcpp_account"}); // 付款银行
                if(!bank)
                {
                    throw "本次付款账户不能为空！";
                }
                var oldStatus = oldRec.getValue({fieldId:"custrecord_swcpp_state"});
                var newStatus = newRec.getValue({fieldId:"custrecord_swcpp_state"});
                var vendor = newRec.getValue({fieldId:"custrecord_swcpp_vendor"}); // 供应商
                var approvetransaction = newRec.getValue({fieldId:"custrecord_swcpp_approvetransaction"});
                var journalId = newRec.getValue({fieldId:"custrecord_swcpp_journalentry"}); // 日记账
                var expenseReportId = newRec.getValue({fieldId:"custrecord_swcpp_expense_report"}); //费用报表
                var code = newRec.getValue({fieldId:"custrecord_swcpp_tranid"}); // 业务参考号
                var fileId = newRec.getValue({fieldId:"custrecord_swcpp_fileid"}); // 图片id
                var employeeId = newRec.getValue({fieldId:"custrecord_swcpp_employee"}); // 员工
                var writeOffJournal = Commons.searchByExternalId("writeoff"+code,"journalentry");
                var expensePayId = Commons.searchByExternalId("expenseReport"+code,"vendorpayment");
                var recordType = newRec.getValue({fieldId:"custrecord_swcpp_recordtype"}); // 单据类型
                var money = newRec.getValue({fieldId:"custrecord_swcpp_amount"}); // 本次支付金额
                if(!writeOffJournal && journalId && newStatus == "1" && !approvetransaction)
                {
                    if(!writeOffJournal) createWriteOffJournal(journalId,code,fileId,newRec.id,bank);
                    return true;
                }
                if(!expensePayId && expenseReportId && newStatus == "1" && !approvetransaction)
                {
                    if(recordType == "1")//报销单
                    {
                        if(!expensePayId) expenseReportToVendorBill(expenseReportId,code,fileId,newRec.id,bank,employeeId,money);
                    }else
                    if(recordType == "2")//账单类
                    {
                        if(!expensePayId) expenseReportToVendorBill(expenseReportId,code,fileId,newRec.id,bank,vendor,money);
                    }
                    return true;
                }
                if(newStatus == "1" && oldStatus != newStatus)//状态变更为支付成功时
                {
                    var poId = newRec.getValue({fieldId:"custrecord_swcpp_po"}); // 采购订单名称
                    var titile = newRec.getValue({fieldId:"custrecord_swcpp_memo"}); // 标题
                    var subsidiary = newRec.getValue({fieldId:"custrecord_swcpp_subsidary"}); // 子公司
                    var vendorpayment = Commons.searchByExternalId("vendorpayment"+code,"vendorpayment");
                    var vendorprepayment = Commons.searchByExternalId("vendorprepayment"+code,"vendorprepayment");
                    var serviceJournal = Commons.searchByExternalId("service"+code,"journalentry");
                    var billAndPaymentTotalAmountJson = {};
                    // 支付成功的后续操作
                    if(Number(money) != 0)
                    {
                        if(recordType == "1" || recordType == "2" )
                        {//报销单、账单类
                            if(journalId)
                            {
                                // 生成核销日记账
                                if(!writeOffJournal) createWriteOffJournal(journalId,code,fileId,newRec.id,bank);
                            }
                            if(expenseReportId)
                            {
                                if(recordType == "1")//报销单
                                {
                                    if(!expensePayId) expenseReportToVendorBill(expenseReportId,code,fileId,newRec.id,bank,employeeId,money);
                                }else
                                if(recordType == "2")//账单类
                                {
                                    if(!expensePayId) expenseReportToVendorBill(expenseReportId,code,fileId,newRec.id,bank,vendor,money);
                                }
                            }
                        } else if(recordType == "3")
                        {//付款审批
                            if(!poId)
                            {
                                if(journalId)
                                {//有待核销日记账，则创建核销日记账
                                    if(!writeOffJournal) createWriteOffJournal(journalId,code,fileId,newRec.id,bank);
                                }else
                                {//没有待核销日记账，则创建对应供应商的预付款
                                    if(vendor) createVendorPrePayment(vendor,bank,money,code);
                                }
                            }else
                            {
                                // 获取账单id数组
                                var getBillIdArr = getBillIdArrSearch(poId);
                                if(getBillIdArr.length > 0) {
                                    if(!vendorpayment) writeOffBill(poId,money,code,newRec.id,getBillIdArr,billAndPaymentTotalAmountJson);
                                }
                                // 判断是否需要生成供应商预付款
                                if(!vendorprepayment) writeOffPrePayment(poId,code,newRec.id,fileId,titile,money,billAndPaymentTotalAmountJson,bank);
                            }
                        } else if(recordType == "5")
                        {//预付款
                            if(vendor) createVendorPrePayment(vendor,bank,money,code);
                        }  else if(recordType == "4")
                        {//借款单
                            if(!serviceJournal) createLoanJournal(money,code,fileId,titile,subsidiary,employeeId,newRec.id,bank);
                        }
                    }
                }
            }
        }
        function expenseReportToVendorBill(expenseReportId,code,fileId,newRecId,bank,entityId,amount,isClasses)
        {
            try{
                var isClasses = runtime.isFeatureInEffect({feature: "classes"});
                var expenseReportJson = {};
                var expensereportSearchObj = search.create({
                    type: "expensereport",
                    filters:
                        [
                            ["type","anyof","ExpRept"],
                            "AND",
                            ["internalid","anyof",expenseReportId],
                            "AND",
                            ["mainline","is","T"]
                        ],
                    columns:
                        [
                            search.createColumn({name: "department", label: "部门"})
                        ]
                });
                if(isClasses)
                {
                    expensereportSearchObj.columns.push(search.createColumn({name: "class", label: "类"}));
                }
                expensereportSearchObj.run().each(function(result){
                    // .run().each has a limit of 4,000 results
                    expenseReportJson.class = result.getValue({name: "class", label: "类"});
                    expenseReportJson.department = result.getValue({name: "department", label: "部门"});
                    return true;
                });
                var vendorPaymentRec = record.create({type:"vendorpayment",isDynamic:true});
                vendorPaymentRec.setValue({fieldId:"entity",value:entityId});
                vendorPaymentRec.setValue({fieldId:"account",value:bank});
                vendorPaymentRec.setValue({fieldId:"department",value:expenseReportJson.department});
                if(isClasses)
                {
                    vendorPaymentRec.setValue({fieldId:"class",value:expenseReportJson.class});
                }
                vendorPaymentRec.setValue({fieldId:"externalid",value:"expenseReport"+code});
                var count = vendorPaymentRec.getLineCount({sublistId:"apply"});
                for(var i = 0; i < count; i++)
                {
                    vendorPaymentRec.selectLine({sublistId:"apply",line:i});
                    var internalid = vendorPaymentRec.getCurrentSublistValue({sublistId:"apply",fieldId:"internalid"});
                    // 只核销相应采购订单的账单
                    if(internalid == expenseReportId) {
                        vendorPaymentRec.setCurrentSublistValue({sublistId:"apply",fieldId:"apply",value:true});
                        vendorPaymentRec.setCurrentSublistValue({sublistId:"apply",fieldId:"amount",value:amount});
                        vendorPaymentRec.commitLine({sublistId:"apply"});
                    }
                }
                var vpId = vendorPaymentRec.save({enableSourcing:true,ignoreMandatoryFields:true});
                if(vpId) record.submitFields({type:"customrecord_swc_payment_platform",id:newRecId,values:{"custrecord_swcpp_approvetransaction":vpId}});
                if(vpId && fileId) record.attach({record:{type:"file",id:fileId},to:{type:"vendorprepayment",id:vpId}});
                if(vpId && fileId) record.attach({record:{type:"file",id:fileId},to:{type:"expensereport",id:expenseReportId}});
            }catch (e) {
                log.audit("创建供应商付款失败：",code + "：" + e.message);
            }
        }
        // 判断是否需要生成供应商预付款
        function writeOffPrePayment(poId,code,newRecId,fileId,titile,money,billAndPaymentTotalAmountJson,bank)
        {
            var poRec = record.load({type:"purchaseorder",id:poId});
            var subsidiary = poRec.getValue({fieldId:"subsidiary"}); // 子公司（找科目）
            var vendor = poRec.getValue({fieldId:"entity"}); // 供应商
            var billAndPaymentTotalAmount = 0;

            for(var ids in billAndPaymentTotalAmountJson) {
                billAndPaymentTotalAmount += Number(billAndPaymentTotalAmountJson[ids]);
            }

            if(Number(money) > Number(billAndPaymentTotalAmount)) {
                var needPayAmount = Math.round((Number(money) - Number(billAndPaymentTotalAmount)) *100) / 100;
                var vendorPrePayment = record.create({type:"vendorprepayment",isDynamic:true});
                vendorPrePayment.setValue({fieldId:"externalid",value: "vendorprepayment"+code});
                vendorPrePayment.setValue({fieldId:"entity",value:vendor});
                vendorPrePayment.setValue({fieldId:"subsidiary",value:subsidiary});
                // vendorPrePayment.setValue({fieldId:"purchaseorder",value:poId});
                vendorPrePayment.setValue({fieldId:"account",value:bank});
                vendorPrePayment.setValue({fieldId:"payment",value:needPayAmount});
                vendorPrePayment.setValue({fieldId:"memo",value:"支付："+code +": "+titile});
                var id = vendorPrePayment.save({enableSourcing:true,ignoreMandatoryFields:true});
                if(id) record.submitFields({type:"customrecord_swc_payment_platform",id:newRecId,values:{"custrecord_swcpp_approvetransaction1":id}});
                if(id && fileId) record.attach({record:{type:"file",id:fileId},to:{type:"vendorprepayment",id:id}});
            }
        }

        // 借款单日记账
        function createLoanJournal(money,code,fileId,titile,subsidiary,employeeId,newRecId,bank) {
            var memo = code + ": " + titile;
            var journalRec = record.create({type:"journalentry",isDynamic:true});
            journalRec.setValue({fieldId:"subsidiary",value:subsidiary});
            journalRec.setValue({fieldId:"memo",value:memo});
            journalRec.setValue({fieldId:"externalid",value:"service"+code});
            journalRec.setValue({fieldId:"approvalstatus",value:"2"});//已核准
            var subRecord = journalRec.selectNewLine({sublistId:"line"});
            subRecord.setCurrentSublistValue({sublistId:"line", fieldId:"account", value: "248"});
            subRecord.setCurrentSublistValue({sublistId:"line", fieldId:"memo", value: memo});
            subRecord.setCurrentSublistValue({sublistId:"line", fieldId:"debit", value: money});
            subRecord.setCurrentSublistValue({sublistId:"line", fieldId:"entity", value: internalId});
            subRecord.commitLine({sublistId:"line"});
            var subRecord = journalRec.selectNewLine({sublistId:"line"});
            subRecord.setCurrentSublistValue({sublistId:"line", fieldId:"account", value: bank});
            subRecord.setCurrentSublistValue({sublistId:"line", fieldId:"memo", value: memo});
            subRecord.setCurrentSublistValue({sublistId:"line", fieldId:"credit", value: money});
            subRecord.commitLine({sublistId:"line"});
            var id = journalRec.save({enableSourcing:true,ignoreMandatoryFields:true});
            if(id) record.submitFields({type:"customrecord_swc_payment_platform",id:newRecId,values:{"custrecord_swcpp_approvetransaction":id}});
            if(id && fileId) record.attach({record:{type:"file",id:fileId},to:{type:"journalentry",id:id}});
        }

        // 核销账单
        function writeOffBill(poId,money,code,newRecId,getBillIdArr,billAndPaymentTotalAmountJson) {
            if(getBillIdArr.length) {
                var lastMoney = Number(money);
                var billId = getBillIdArr[0]; // 取一个账单id就行，会列出来该供应商所有的待支付账单在行上

                var vendorPaymentRec = record.transform({fromType:"vendorbill",fromId:billId,toType:"vendorpayment",isDynamic:true});
                vendorPaymentRec.setValue({fieldId:"externalid",value:"vendorpayment"+code});
                var count = vendorPaymentRec.getLineCount({sublistId:"apply"});
                for(var i = 0; i < count; i++) {
                    vendorPaymentRec.selectLine({sublistId:"apply",line:i});
                    var type = vendorPaymentRec.getCurrentSublistValue({sublistId:"apply",fieldId:"trantype"});
                    var createFrom = vendorPaymentRec.getCurrentSublistValue({sublistId:"apply",fieldId:"createdfrom"});
                    // 只核销相应采购订单的账单
                    if(type == "VendBill" && createFrom == poId) {
                        vendorPaymentRec.setCurrentSublistValue({sublistId:"apply",fieldId:"apply",value:true});
                        var last = vendorPaymentRec.getCurrentSublistValue({sublistId:"apply",fieldId:"due"});
                        var billPaymentedId = vendorPaymentRec.getCurrentSublistValue({sublistId:"apply",fieldId:"internalid"});
                        vendorPaymentRec.setCurrentSublistValue({sublistId:"apply",fieldId:"amount",value:Math.min(Number(lastMoney),Number(last))});
                        vendorPaymentRec.commitLine({sublistId:"apply"});
                        billAndPaymentTotalAmountJson[billPaymentedId] = Math.min(Number(lastMoney),Number(last));
                        //如果剩余金额为0了 跳出循环
                        lastMoney = lastMoney - (Math.min(Number(lastMoney),Number(last)));
                        if(lastMoney <= 0) break;
                    }
                }
                var id = vendorPaymentRec.save({enableSourcing:true,ignoreMandatoryFields:true});

                if(id) record.submitFields({type:"customrecord_swc_payment_platform",id:newRecId,values:{"custrecord_swcpp_approvetransaction":id}});
            }
        }

        // 获取账单id数组
        function getBillIdArrSearch(poId) {
            var arr = [];
            var vendorbillSearchObj = search.create({
                type: "vendorbill",
                filters: [["type","anyof","VendBill"], "AND", ["status","anyof","VendBill:A"], "AND", ["appliedtotransaction","anyof",poId]],
                columns: [search.createColumn({name: "internalid", label: "内部标识"})]
            });
            vendorbillSearchObj.run().each(function(result){
                var billId = result.getValue({name: "internalid"});
                arr.push(billId);
                return true;
            });
            return arr;
        }

        // 获取poid
        // function getPoIdSearch(poId) {
        //     var poid = '';
        //     var purchaseorderSearchObj = search.create({
        //         type: "purchaseorder",
        //         filters: [["type","anyof","PurchOrd"], "AND", ["mainline","is","T"], "AND", ["numbertext","is",poId]],
        //         columns: [search.createColumn({name: "internalid", label: "内部标识"}),]
        //     });
        //     purchaseorderSearchObj.run().each(function(result) {
        //         poid = result.getValue({name: "internalid"})
        //         return true;
        //     });
        //     return poid;
        // }

        // 创建供应商预付款
        function createVendorPrePayment(vendor,account,money,code)
        {
            var VendorPrePaymentRec = record.create({type:"vendorprepayment"});
            VendorPrePaymentRec.setValue({fieldId:"entity",value:vendor});// 收款人
            VendorPrePaymentRec.setValue({fieldId:"account",value:account}); //银行账户
            VendorPrePaymentRec.setValue({fieldId:"payment",value:money}) // 付款金额
            VendorPrePaymentRec.setValue({fieldId:"externalid",value:code}) // 付款金额
            VendorPrePaymentRec.save({enableSourcing:true,ignoreMandatoryFields:true});
        }
        // 核销日记账
        function createWriteOffJournal(journalId,code,fileId,newRecId,bank) {
            if(journalId)
            {
                var journalRec  = record.copy({type:"journalentry",id:journalId,isDynamic:true});
                var memo = journalRec.getValue({fieldId:"memo"});
                var newMemo = "支付: "+memo;
                journalRec.setValue({fieldId:"memo",value:newMemo});

                journalRec.setValue({fieldId:"externalid",value:"writeoff"+code});
                journalRec.setValue({fieldId:"approvalstatus",value:"2"});//已核准
                var count = journalRec.getLineCount({sublistId:"line"});
                var oldJournalJson = {credit:{},debit:{}};
                for(var i = count-1; i >= 0 ; i--)
                {
                    journalRec.selectLine({sublistId:"line",line:i});
                    var credit = journalRec.getCurrentSublistValue({sublistId:"line", fieldId:"credit"});
                    var debit = journalRec.getCurrentSublistValue({sublistId:"line", fieldId:"debit"});
                    var account = journalRec.getCurrentSublistValue({sublistId:"line", fieldId:"account"});
                    var entity = journalRec.getCurrentSublistValue({sublistId:"line", fieldId:"entity"});
                    var department = journalRec.getCurrentSublistValue({sublistId:"line", fieldId:"department"});
                    if(debit || account=="248") {//248 其他应收款 : 备用金
                        journalRec.removeLine({sublistId:"line",line:i});
                        oldJournalJson.debit[account] = oldJournalJson.debit[account] || {};
                        oldJournalJson.debit[account].amount = debit;
                        oldJournalJson.debit[account].entity = entity;
                        oldJournalJson.debit[account].department = department;
                        continue;
                    }
                    if(credit && account!="248") {//248 其他应收款 : 备用金
                        journalRec.removeLine({sublistId:"line",line:i});
                        oldJournalJson.credit[account] = oldJournalJson.credit[account] || {};
                        oldJournalJson.credit[account].amount = credit;
                        oldJournalJson.credit[account].entity = entity;
                        oldJournalJson.credit[account].department = department;
                    }
                }
                util.each(oldJournalJson.credit,function (valueObj,key) {
                    if(oldJournalJson.debit.hasOwnProperty(key))
                    {
                        delete oldJournalJson.credit[key];
                        return;
                    }
                    journalRec.selectNewLine({sublistId:"line"});
                    journalRec.setCurrentSublistValue({sublistId:"line", fieldId:"account", value: key});
                    journalRec.setCurrentSublistValue({sublistId:"line", fieldId:"memo", value: newMemo});
                    journalRec.setCurrentSublistValue({sublistId:"line", fieldId:"debit", value: valueObj.amount});
                    journalRec.setCurrentSublistValue({sublistId:"line", fieldId:"credit", value: ''});
                    valueObj.entity && journalRec.setCurrentSublistValue({sublistId:"line", fieldId:"entity", value: valueObj.entity});
                    valueObj.department && journalRec.setCurrentSublistValue({sublistId:"line", fieldId:"department", value: valueObj.department});
                    journalRec.commitLine({sublistId:"line"});
                    journalRec.selectNewLine({sublistId:"line"});
                    journalRec.setCurrentSublistValue({sublistId:"line", fieldId:"account", value: bank});
                    journalRec.setCurrentSublistValue({sublistId:"line", fieldId:"memo", value: newMemo});
                    journalRec.setCurrentSublistValue({sublistId:"line", fieldId:"credit", value: valueObj.amount});
                    journalRec.commitLine({sublistId:"line"});
                });
                var id = journalRec.save({enableSourcing:true,ignoreMandatoryFields:true});
                if(id) record.submitFields({type:"customrecord_swc_payment_platform",id:newRecId,values:{"custrecord_swcpp_approvetransaction":id}});
                if(id && fileId) record.attach({record:{type:"file",id:fileId},to:{type:"journalentry",id:id}});
            }
        }
        return {
            afterSubmit: afterSubmit
            ,beforeLoad: beforeLoad
        };
    });
