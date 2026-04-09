/**
 * @NApiVersion 2.0
 * @NScriptType UserEventScript
 * @NModuleScope Public
 */
define(["N/search",'N/record','../../common/Commons.js','../../lib/decimal.js'],

    function (search,record,Commons,decimal) {

        //供应商账单金额换算
        function beforeSubmit(context) {
            try {
                log.audit("进入UE_beforeSubmit",context.type);

                var customerRecord = context.newRecord;//账单
                var currency = customerRecord.getValue({fieldId:"currency"});//货币
                var subsidiary = customerRecord.getValue({fieldId:"subsidiary"});//付款主体
                //如果是编辑并且公司本位币为日元(付款主体为9PingCAP 株式会社)，币种为日元
                if(context.type == context.UserEventType.EDIT && subsidiary =="9" && currency == "6"){
                    //应付账单明细税码设置完需要对税金进行小数位舍去，总金额保持不变，倒算未税金额（总金额-舍去后税金）及单价（单价除不尽保留6位小数）。
                    var billCount = customerRecord.getLineCount({sublistId:"item"});//账单子列表行数
                    log.audit("billCount",billCount);
                    var jptaxJson = Commons.srchJptaxAndRate();//查询【税码】下的数据 和日本税计算逻辑 (自定义)字段

                    if(billCount > 0){
                        for(var i = 0;i<billCount;i++) {
                            var taxCode = customerRecord.getSublistValue({sublistId:"item",fieldId:"taxcode",line:i});//税码
                            log.audit("taxCode",taxCode);
                            var tax = 0;//税率 数字
                            var jptax = 0;//日本税计算逻辑字段 数字
                            var swcTaxrate = "";//税额(CUSTOM)
                            if(taxCode) {
                                log.audit("jptaxJson",jptaxJson);
                                if(jptaxJson && Object.keys(jptaxJson).length>0 && jptaxJson[taxCode] && Object.keys(jptaxJson[taxCode]).length>0){
                                    log.audit("jptaxJson[taxCode]",jptaxJson[taxCode]);
                                    tax = jptaxJson[taxCode]["rate"]?decimal.divN(jptaxJson[taxCode]["rate"],100):0;
                                    swcTaxrate = jptaxJson[taxCode]["rate"]?jptaxJson[taxCode]["rate"]+"%":"";
                                    jptax = jptaxJson[taxCode]["jptax"]?jptaxJson[taxCode]["jptax"]:0;
                                }
                            }
                            log.audit("tax",tax);
                            log.audit("swcTaxrate",swcTaxrate);
                            //如果付款主体是日本并且税码不为0税率时
                            if(taxCode && tax){
                                var grossamt = customerRecord.getSublistValue({sublistId: 'item', fieldId: 'grossamt',line:i});//总金额
                                log.audit("日本-grossamt",grossamt);
                                var tax1amt =0;//税额
                                var amount = 0;//未税金额
                                //未税金额= 总金额/ （（税率*日本）+1 ）  作废
                                // if(jptax){
                                //     amount = decimal.divN(grossamt,(decimal.addN(decimal.mulN(tax,jptax),1)));
                                //     //tax1amt = (decimal.mulN(thisTax1amt,jptax)).toFixed(0);
                                // }else {
                                //     amount = decimal.divN(grossamt,(decimal.addN(tax,1)));
                                // }

                                //未税金额= 总金额/ （税率+1 ）
                                amount = decimal.divN(grossamt,(decimal.addN(tax,1)));
                                //tax1amt = (grossamt-amount).toFixed(0);
                                //amount = decimal.subN(grossamt,tax1amt);
                                //【税额】= 未税金额*税率*日本
                                if(jptax){
                                    tax1amt = (decimal.mulN(decimal.mulN(amount,tax),jptax)).toFixed(0);
                                }else {
                                    tax1amt = (decimal.mulN(amount,tax)).toFixed(0);
                                }
                                //【未税金额】 = 总金额-税额
                                amount = decimal.subN(grossamt,tax1amt)
                                if(tax1amt)customerRecord.setSublistValue({sublistId: 'item', fieldId: 'tax1amt',value: tax1amt,line:i});// 税额
                                customerRecord.setSublistValue({sublistId: 'item', fieldId: 'amount',value: amount,line:i});// 未税金额
                                log.audit("amount",amount);

                                var rate = (decimal.divN(grossamt,decimal.addN(1,tax))).toFixed(6); //(grossamt/(1+(tax/100))).toFixed(6);
                                customerRecord.setSublistValue({sublistId: 'item', fieldId: 'rate',value: rate,line:i});// 单价
                                customerRecord.setSublistValue({sublistId: 'item', fieldId: 'custcol_swc_report_taxcode', value: taxCode,line:i});// 税码(CUSTOM)
                                customerRecord.setSublistValue({sublistId: 'item', fieldId: 'custcol_swc_taxrate', value: swcTaxrate,line:i});// 税率(CUSTOM)
                                if(tax1amt)customerRecord.setSublistValue({sublistId: 'item', fieldId: 'custcol_swc_taxamount', value: tax1amt,line:i});// 税额(CUSTOM)
                            }else {
                                var grossamt = customerRecord.getSublistValue({sublistId: 'item', fieldId: 'grossamt',line:i});//总金额
                                log.audit("grossamt",grossamt);
                                var tax1amt =  Number(customerRecord.getSublistValue({sublistId: 'item', fieldId: 'tax1amt',line:i}).toFixed(0));// 税额
                                customerRecord.setSublistValue({sublistId: 'item', fieldId: 'tax1amt',value: tax1amt,line:i});// 税额
                                var amount = Number(grossamt) - Number(tax1amt);
                                customerRecord.setSublistValue({sublistId: 'item', fieldId: 'amount',value: amount,line:i});// 未税金额
                                log.audit("amount",amount);
                                var taxRate = customerRecord.getSublistValue({sublistId: 'item', fieldId: 'taxrate1',line:i});//税率
                                log.audit("taxRate",taxRate);
                                var tax = 0;
                                if(taxRate)tax = Number(taxRate)/100;
                                log.audit("tax",tax);
                                var rate = (grossamt/(1+tax)).toFixed(6);
                                customerRecord.setSublistValue({sublistId: 'item', fieldId: 'rate',value: rate,line:i});// 单价
                            }
                        }
                    }
                }

            }catch (e) {
                throw e.message;
            }
        }

        //创建账单付款
        function afterSubmit(context) {
            try {
                log.audit("进入UE_afterSubmit",context.type);
                var customerRecord = context.newRecord;//账单
                if(context.type == context.UserEventType.EDIT){
                    //创建账单付款（如果，付款科目，银行付款汇率，银行付款日期均存在值时，并且付款方式为对公转账，审批状态为已批准）
                    var billInternalid = customerRecord.getValue({fieldId:"id"});//账单id
                    log.audit("billInternalid",billInternalid);
                    var pay_account = customerRecord.getValue({fieldId:"custbody_swc_pay_account"});//付款科目
                    if(!pay_account)throw "科目不能为空！";
                    var curr = customerRecord.getValue({fieldId:"currency"});
                    log.audit("curr1",curr);
                    var memo = customerRecord.getValue({fieldId:"memo"});//备注
                    var bank_rate = customerRecord.getValue({fieldId:"custbody_swc_bank_rate"});//银行付款汇率
                    var bank_date = customerRecord.getValue({fieldId:"custbody_swc_bank_date"});//银行付款日期
                    var payway = customerRecord.getValue({fieldId:"custbody_swc_payway"});//付款方式
                    var approvalstatus = customerRecord.getValue({fieldId:"approvalstatus"});//审批状态
                    //如果，付款科目，银行付款汇率，银行付款日期均存在值时，并且付款方式为对公转账，审批状态为已批准。则创建账单付款
                    if(pay_account && bank_rate && bank_date && payway == "1" && approvalstatus == "2"){
                        //根据【账单】创建【账单付款】
                        var paymentRecord = record.transform({
                            fromType: record.Type.VENDOR_BILL,
                            fromId: billInternalid,
                            toType: record.Type.VENDOR_PAYMENT,
                            isDynamic: true,
                        });
                        paymentRecord.setValue({fieldId:"account",value:pay_account});//科目
                        log.audit("curr2",curr);
                        if(curr)paymentRecord.setValue({fieldId:"currency",value:curr});
                        log.audit("bank_rate",bank_rate);
                        if(memo)paymentRecord.setValue({fieldId:"memo",value:memo});
                        if(bank_date)paymentRecord.setValue({fieldId:"trandate",value:bank_date});
                        if(bank_rate)paymentRecord.setValue({fieldId:"exchangerate",value:bank_rate});
                        paymentRecord.setValue({fieldId:"approvalstatus",value:"2"});//已批准
                        var paymentCount = paymentRecord.getLineCount({sublistId:"apply"});//账单付款子列表行数
                        var flag = false;//子列表行数据是否有勾选，有设置为true
                        log.audit("paymentCount",paymentCount);
                        if(paymentCount > 0){
                            for(var i = 0;i<paymentCount;i++) {
                                paymentRecord.selectLine({sublistId: 'apply',line:i});
                                var subInternalid = paymentRecord.getCurrentSublistValue({sublistId: 'apply', fieldId: 'internalid'});//子列表内部id
                                log.audit("subInternalid",subInternalid);
                                log.audit("apply",paymentRecord.getCurrentSublistValue({sublistId: 'apply', fieldId: 'apply'}));
                                //如果子列表内部id与账单内部id不一致，则不勾选子列表
                                if(subInternalid !== billInternalid){
                                    paymentRecord.setCurrentSublistValue({sublistId: 'apply', fieldId: 'apply',value:false});
                                }else {
                                    paymentRecord.setCurrentSublistValue({sublistId: 'apply', fieldId: 'apply',value:true});
                                    flag = true
                                }
                                paymentRecord.commitLine({sublistId: 'apply'});
                            }
                        }
                        log.audit("flag",flag);
                        if(flag)paymentRecord.save();
                    }
                }
            }catch (e) {
                throw e.message;
            }
        }

        return {
            beforeSubmit :beforeSubmit,
            afterSubmit :afterSubmit
        };

    });
