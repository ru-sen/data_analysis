/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 * @description
 */
define([ 'N/record', 'N/search','N/format' ],

    ( record,search,format) => {
        const getInputData = (inputContext) => {
            // log.audit({
            //     title: "========",
            //     details: "========"
            // });
            return getAllData()
        }

        /**
         * @param {Object} mapContext
         */
        const map = (mapContext) => {
            var key = mapContext.key;
            var taxJson= srchJptaxAndRate()
            log.audit({
                title: "taxJson",
                details: taxJson
            });
            log.audit({
                title: "key",
                details: key
            });
            log.audit({
                title: "mapContext.value",
                details: mapContext.value
            });
            try {
                var value = JSON.parse(mapContext.value)
                log.audit({
                    title: "value",
                    details: value
                });
                if(value[Object.keys(value)[0]]["negative_cost"]){
                    log.audit({
                        title: "value",
                        details: value[Object.keys(value)[0]]["negative_cost"]
                    });
                }
                var rec_id=createJN(key, mapContext.value,taxJson)||''
               log.audit({
                        title: "rec_id",
                        details: rec_id
                    });
                for(let _key in value){
                    value[_key].jn_id = rec_id
                    mapContext.write({
                        key: _key,
                        value: value[_key],
                    });
                }
            } catch (error) {
                log.audit("error", error)
                for(let _key in value){
                    value[_key].jn_id=""
                    value[_key].errorMsg = error.message;
                    mapContext.write({
                        key: _key,
                        value: value[_key],
                    });
                }
            }
        }

        /**
         * @param {Object} context
         */
        const reduce = (context) => {
            log.audit({
                title: "context",
                details: context
            });
            log.audit({
                title: "context.key",
                details: context.key
            });
            log.audit({
                title: "context.value",
                details: context.values
            });
            log.error({
                title: "context.value",
                details: context.values
            });
            var values=JSON.parse(context.values[0])
            if(values.jn_id!==''&&values.hasOwnProperty("expenseaccount")&&(values.country=="SG"||values.country=="JP"||values.country=="US"||values.country=="MY")){//
                var exRec = record.load({type:"expensereport",id:context.key});
                log.audit('values.jn_id',values.jn_id)
                exRec.setValue({fieldId:"custbody_swc_related_journal",value:values.jn_id});
                exRec.setValue({fieldId:"custbody_swc_joural_error",value:""});
                exRec.save({enableSourcing: true, ignoreMandatoryFields: true});
                log.audit('suc')
            }else{
                var exRec = record.load({type:"expensereport",id:context.key});
                exRec.setValue({fieldId:"custbody_swc_joural_error",value:"日记账生成失败"});
                exRec.save({ enableSourcing: true, ignoreMandatoryFields: true });
                log.audit('err')
            }
        }
        const summarize = (summaryContext) => {

        }

        function createJN(key,value,jptaxJson) {
            var JNRecord = {}
            var recordId=""
            log.audit({
                title: "key[4]",
                details: key[4]
            });
            // hc add navan type：rebate/repayment/refund
            if([1, 3, 4, 5].includes(Number(key[4]))){//1 Purchase
                var value = JSON.parse(value);
                log.error({
                    title: "value",
                    details:value
                });
                if(value[Object.keys(value)[0]]["country"]=="US"){
                    JNRecord = record.create({
                        type: 'journalentry',
                        isDynamic: true,
                    });
                    JNRecord.setValue({
                        fieldId: "subsidiary",
                        value: key[0]
                    });
                    JNRecord.setValue({
                        fieldId: "currency",
                        value: key[2]
                    });
                    var time = new Date();
                    var month = Number(time.getMonth());
                    if(month.toString().length == 1)month = "0" + month;
                    JNRecord.setValue({
                        fieldId: "trandate",
                        value: format.parse({
                            value: time,
                            type: format.Type.DATE
                        })
                    });
                    var dateArr = formatDate(new Date(),format);
                    if (dateArr.length > 0) {
                        JNRecord.setValue({
                            fieldId: "memo",
                            // value: "Navan reimbursement " + dateArr[0] + dateArr[1]
                            value: "Navan reimbursement " + "2025" + month
                        });
                    }
                    //来源平台设置9
                    JNRecord.setValue({
                        fieldId: "custbody_swc_platform",
                        value: 9
                    });
                    //NAVAN业务类型
                    JNRecord.setValue({
                        fieldId: "custbody_swc_navan_type",
                        value: key[4]
                    });
                    var sublistId="line"
                    var debitSum = 0;//借zong
                    var reverseSum = 0;//negative_cost
                    log.audit('now_value',value)
                    for(let key1 in value){
                        if(value[key1].hasOwnProperty("expenseaccount")&&value[key1].debitfxamount){
                            JNRecord.selectNewLine({
                                sublistId: sublistId
                            });
                            JNRecord.setCurrentSublistValue({
                                sublistId: sublistId,
                                fieldId: "account",
                                value: value[key1].expenseaccount,
                                ignoreFieldChange: false
                            });
                            if(value[key1]["negative_cost"]){
                                if (value[key1].debitfxamount) {
                                    JNRecord.setCurrentSublistValue({
                                        sublistId: sublistId,
                                        fieldId: "credit",
                                        value: value[key1].debitfxamount,
                                        ignoreFieldChange: false
                                    });
                                }
                            }else{
                                if (value[key1].debitfxamount) {
                                    JNRecord.setCurrentSublistValue({
                                        sublistId: sublistId,
                                        fieldId: "debit",
                                        value: value[key1].debitfxamount,
                                        ignoreFieldChange: false
                                    });
                                }
                            }

                            if (value[key1].department) {
                                JNRecord.setCurrentSublistValue({
                                    sublistId: sublistId,
                                    fieldId: "department",
                                    value: value[key1].department,
                                });
                            }
                            if (value[key1].memo) {
                                JNRecord.setCurrentSublistValue({
                                    sublistId: sublistId,
                                    fieldId: "memo",
                                    value: value[key1].memo,
                                });
                            }
                            var curAccountName = JNRecord.getCurrentSublistText({
                                sublistId: sublistId,
                                fieldId: "account",
                            });
                            if (curAccountName.indexOf("研发") >= 0) {
                                JNRecord.setCurrentSublistValue({
                                    sublistId: sublistId,
                                    fieldId: "cseg_swc_pro",
                                    value: "1",
                                });
                            } else {
                                JNRecord.setCurrentSublistValue({
                                    sublistId: sublistId,
                                    fieldId: "cseg_swc_pro",
                                    value: "3",
                                });
                            }
                            JNRecord.setCurrentSublistValue({
                                sublistId: sublistId,
                                fieldId: "cseg_swc_region",
                                value: "10",
                            });
                            if (value[key1].entityid) {
                                // JNRecord.setCurrentSublistText({
                                //     sublistId: sublistId,
                                //     fieldId: "entity",
                                //     text: value[key1].entityid,
                                // });
                                JNRecord.setCurrentSublistText({
                                    sublistId: sublistId,
                                    fieldId: "custcol_swc_jon_employee",
                                    text: value[key1].entityid,
                                });
                            }
                            JNRecord.commitLine({sublistId: sublistId});
                            if(value[key1]["negative_cost"]){
                                reverseSum+=Number(value[key1].debitfxamount)
                            }else{
                                debitSum+=Number(value[key1].debitfxamount)
                            }
                        }
                    }
                    log.audit('debitSum1',debitSum)
                    if(debitSum>0){
                        //生成3行合计
                        JNRecord.selectNewLine({
                            sublistId: sublistId
                        });
                        JNRecord.setCurrentSublistValue({
                            sublistId: sublistId,
                            fieldId: "account",
                            value: 1292,
                            ignoreFieldChange: false
                        });
                        JNRecord.setCurrentSublistValue({
                            sublistId: sublistId,
                            fieldId: "credit",
                            value: debitSum - reverseSum,
                            ignoreFieldChange: false
                        });
                        JNRecord.setCurrentSublistValue({
                            sublistId: sublistId,
                            fieldId: "entity",
                            value: 16968,//VNDNS01270 Navan, Inc.
                            ignoreFieldChange: false
                        });
                        JNRecord.setCurrentSublistValue({
                            sublistId: sublistId,
                            fieldId: "memo",
                            // value: "Payment_Navan reimbursement " + dateArr[0] + dateArr[1],
                            value: "Payment_Navan reimbursement " + "2025" + month,
                            ignoreFieldChange: false
                        });
                        JNRecord.commitLine({sublistId: sublistId});

                        JNRecord.selectNewLine({
                            sublistId: sublistId
                        });
                        JNRecord.setCurrentSublistValue({
                            sublistId: sublistId,
                            fieldId: "account",
                            value: 1292,
                            ignoreFieldChange: false
                        });
                        JNRecord.setCurrentSublistValue({
                            sublistId: sublistId,
                            fieldId: "debit",
                            value: debitSum - reverseSum,
                            ignoreFieldChange: false
                        });
                        JNRecord.setCurrentSublistValue({
                            sublistId: sublistId,
                            fieldId: "entity",
                            value: 16968,//VNDNS01270 Navan, Inc.
                            ignoreFieldChange: false
                        });
                        JNRecord.setCurrentSublistValue({
                            sublistId: sublistId,
                            fieldId: "memo",
                            // value: "Payment_Navan reimbursement " + dateArr[0] + dateArr[1],
                            value: "Payment_Navan reimbursement " + "2025" + month,
                            ignoreFieldChange: false
                        });
                        JNRecord.commitLine({sublistId: sublistId});
                        JNRecord.selectNewLine({
                            sublistId: sublistId
                        });
                        JNRecord.setCurrentSublistValue({
                            sublistId: sublistId,
                            fieldId: "account",
                            value: 3485,
                            ignoreFieldChange: false
                        });
                        JNRecord.setCurrentSublistValue({
                            sublistId: sublistId,
                            fieldId: "credit",
                            value: debitSum - reverseSum,
                            ignoreFieldChange: false
                        });
                        JNRecord.setCurrentSublistValue({
                            sublistId: sublistId,
                            fieldId: "memo",
                            // value: "Payment_Navan reimbursement " + dateArr[0] + dateArr[1],
                            value: "Payment_Navan reimbursement " + "2025" + month,
                            ignoreFieldChange: false
                        });
                        JNRecord.commitLine({sublistId: sublistId});
                    }
                    if(reverseSum>0){
                        //生成3行合计
                        JNRecord.selectNewLine({
                            sublistId: sublistId
                        });
                        JNRecord.setCurrentSublistValue({
                            sublistId: sublistId,
                            fieldId: "account",
                            value: 1292,
                            ignoreFieldChange: false
                        });
                        JNRecord.setCurrentSublistValue({
                            sublistId: sublistId,
                            fieldId: "debit",
                            value: reverseSum,
                            ignoreFieldChange: false
                        });
                        JNRecord.setCurrentSublistValue({
                            sublistId: sublistId,
                            fieldId: "entity",
                            value: 16968,//VNDNS01270 Navan, Inc.
                            ignoreFieldChange: false
                        });
                        JNRecord.commitLine({sublistId: sublistId});

                        JNRecord.selectNewLine({
                            sublistId: sublistId
                        });
                        JNRecord.setCurrentSublistValue({
                            sublistId: sublistId,
                            fieldId: "account",
                            value: 1292,
                            ignoreFieldChange: false
                        });
                        JNRecord.setCurrentSublistValue({
                            sublistId: sublistId,
                            fieldId: "credit",
                            value: reverseSum,
                            ignoreFieldChange: false
                        });
                        JNRecord.setCurrentSublistValue({
                            sublistId: sublistId,
                            fieldId: "entity",
                            value: 16968,//VNDNS01270 Navan, Inc.
                            ignoreFieldChange: false
                        });
                        JNRecord.commitLine({sublistId: sublistId});
                        JNRecord.selectNewLine({
                            sublistId: sublistId
                        });
                        JNRecord.setCurrentSublistValue({
                            sublistId: sublistId,
                            fieldId: "account",
                            value: 3485,
                            ignoreFieldChange: false
                        });
                        JNRecord.setCurrentSublistValue({
                            sublistId: sublistId,
                            fieldId: "debit",
                            value: reverseSum,
                            ignoreFieldChange: false
                        });
                        JNRecord.setCurrentSublistValue({
                            sublistId: sublistId,
                            fieldId: "memo",
                            value: "Payment_Navan reimbursement " + dateArr[0] + dateArr[1],
                            ignoreFieldChange: false
                        });
                        JNRecord.commitLine({sublistId: sublistId});
                    }
                    recordId = JNRecord.save({
                        enableSourcing: true,
                        ignoreMandatoryFields: true
                    });
                    log.audit('US_recordId',recordId)
                }
                if(value[Object.keys(value)[0]]["country"]=="SG"){
                    JNRecord = record.create({
                        type: 'journalentry',
                        isDynamic: true,
                        defaultValues:{customform:107}
                    });
                    if( key[0] == 8) {
                        JNRecord.setValue({
                            fieldId: "subsidiary",
                            value: 28
                        });
                    }else if( key[0] == 9) {
                        JNRecord.setValue({
                            fieldId: "subsidiary",
                            value: 25
                        });
                    }else {
                        JNRecord.setValue({
                            fieldId: "subsidiary",
                            value: key[0]
                        });
                    }
                    JNRecord.setValue({
                        fieldId: "currency",
                        value: key[2]
                    });
                    //目标子公司
                    JNRecord.setValue({
                        fieldId: "tosubsidiary",
                        value: 6
                    });
                    var time = new Date();
                    var month = Number(time.getMonth());
                    if(month.toString().length == 1)month = "0" + month;
                    JNRecord.setValue({
                        fieldId: "trandate",
                        value: format.parse({
                            value: time,
                            type: format.Type.DATE
                        })
                    });
                    var dateArr = formatDate(new Date(),format);
                    if (dateArr.length > 0) {
                        JNRecord.setValue({
                            fieldId: "memo",
                            // value: "Navan reimbursement " + dateArr[0] + dateArr[1]
                            value: "Navan reimbursement " + "2025"+ month
                        });
                    }
                    //来源平台设置9
                    JNRecord.setValue({
                        fieldId: "custbody_swc_platform",
                        value: 9
                    });
                    //NAVAN业务类型
                    JNRecord.setValue({
                        fieldId: "custbody_swc_navan_type",
                        value: key[4]
                    });
                    var sublistId="line"
                    var debitSum = 0;//借zong
                    var reverseSum = 0;//negative_cost
                    for(let key1 in value){
                        if(value[key1].hasOwnProperty("expenseaccount")&&value[key1].debitfxamount){
                            JNRecord.selectNewLine({
                                sublistId: sublistId
                            });
                            JNRecord.setCurrentSublistValue({
                                sublistId: sublistId,
                                fieldId: "account",
                                value: value[key1].expenseaccount,
                                ignoreFieldChange: false
                            });
                            if(value[key1]["negative_cost"]){
                                if (value[key1].debitfxamount) {
                                    JNRecord.setCurrentSublistValue({
                                        sublistId: sublistId,
                                        fieldId: "credit",
                                        value: value[key1].debitfxamount,
                                        ignoreFieldChange: false
                                    });
                                }
                            }else{
                                if (value[key1].debitfxamount) {
                                    JNRecord.setCurrentSublistValue({
                                        sublistId: sublistId,
                                        fieldId: "debit",
                                        value: value[key1].debitfxamount,
                                        ignoreFieldChange: false
                                    });
                                }
                            }
                            if (value[key1].department) {
                                JNRecord.setCurrentSublistValue({
                                    sublistId: sublistId,
                                    fieldId: "department",
                                    value: value[key1].department,
                                });
                            }
                            var curAccountName = JNRecord.getCurrentSublistText({
                                sublistId: sublistId,
                                fieldId: "account",
                            });
                            if (curAccountName.indexOf("研发") >= 0) {
                                JNRecord.setCurrentSublistValue({
                                    sublistId: sublistId,
                                    fieldId: "cseg_swc_pro",
                                    value: "1",
                                });
                            } else {
                                JNRecord.setCurrentSublistValue({
                                    sublistId: sublistId,
                                    fieldId: "cseg_swc_pro",
                                    value: "3",
                                });
                            }
                            JNRecord.setCurrentSublistValue({
                                sublistId: sublistId,
                                fieldId: "cseg_swc_region",
                                value: "11",
                            });
                            if (value[key1].entityid) {
                                JNRecord.setCurrentSublistText({
                                    sublistId: sublistId,
                                    fieldId: "custcol_swc_jon_employee",
                                    text: value[key1].entityid,
                                });
                            }
                            if (value[key1].memo) {
                                JNRecord.setCurrentSublistValue({
                                    sublistId: sublistId,
                                    fieldId: "memo",
                                    value: value[key1].memo,
                                });
                            }
                            JNRecord.commitLine({sublistId: sublistId});
                            if(value[key1]["negative_cost"]){
                                reverseSum+=Number(value[key1].debitfxamount)
                            }else{
                                debitSum+=Number(value[key1].debitfxamount)
                            }
                        }
                    }
                    if(debitSum>0){
                        debitSum = debitSum.toFixed(2)
                        log.audit('debitSum2',debitSum)
                        //生成3行合计
                        JNRecord.selectNewLine({
                            sublistId: sublistId
                        });
                        JNRecord.setCurrentSublistValue({
                            sublistId: sublistId,
                            fieldId: "account",
                            value: 1292,
                            ignoreFieldChange: false
                        });
                        JNRecord.setCurrentSublistValue({
                            sublistId: sublistId,
                            fieldId: "credit",
                            value: debitSum,
                            ignoreFieldChange: false
                        });
                        JNRecord.setCurrentSublistValue({
                            sublistId: sublistId,
                            fieldId: "entity",
                            value: 16968,//VNDNS01270 Navan, Inc.
                            ignoreFieldChange: false
                        });
                        JNRecord.setCurrentSublistValue({
                            sublistId: sublistId,
                            fieldId: "memo",
                            // value: "Payment_Navan reimbursement " + dateArr[0] + dateArr[1],
                            value: "Payment_Navan reimbursement " + "2025" + month  ,
                            ignoreFieldChange: false
                        });
                        JNRecord.commitLine({sublistId: sublistId});

                        JNRecord.selectNewLine({
                            sublistId: sublistId
                        });
                        JNRecord.setCurrentSublistValue({
                            sublistId: sublistId,
                            fieldId: "account",
                            value: 1292,
                            ignoreFieldChange: false
                        });
                        JNRecord.setCurrentSublistValue({
                            sublistId: sublistId,
                            fieldId: "debit",
                            value: debitSum,
                            ignoreFieldChange: false
                        });
                        JNRecord.setCurrentSublistValue({
                            sublistId: sublistId,
                            fieldId: "entity",
                            value: 16968,//VNDNS01270 Navan, Inc.
                            ignoreFieldChange: false
                        });
                        JNRecord.setCurrentSublistValue({
                            sublistId: sublistId,
                            fieldId: "memo",
                            // value: "Payment_Navan reimbursement " + dateArr[0] + dateArr[1] + "_PINGCAP PTE. LTD. Representative Payment to PingCAP (US), Inc.",
                            value: "Payment_Navan reimbursement " + "2025" + month + "_PINGCAP PTE. LTD. Representative Payment to PingCAP (US), Inc.",//+ "_Pingcap US payment on behalf",//
                            ignoreFieldChange: false
                        });
                        JNRecord.commitLine({sublistId: sublistId});
                        JNRecord.selectNewLine({
                            sublistId: sublistId
                        });
                        JNRecord.setCurrentSublistValue({
                            sublistId: sublistId,
                            fieldId: "account",
                            value: 1310,
                            ignoreFieldChange: false
                        });
                        JNRecord.setCurrentSublistValue({
                            sublistId: sublistId,
                            fieldId: "credit",
                            value: debitSum,
                            ignoreFieldChange: false
                        });
                        JNRecord.setCurrentSublistValue({
                            sublistId: sublistId,
                            fieldId: "memo",
                            // value: "Payment_Navan reimbursement " + dateArr[0] + dateArr[1] + "_PINGCAP PTE. LTD. Representative Payment to PingCAP (US), Inc.",
                            value: "Payment_Navan reimbursement " + "2025" + month + "_Pingcap US payment on behalf",//"_PINGCAP PTE. LTD. Representative Payment to PingCAP (US), Inc.",
                            ignoreFieldChange: false
                        });
                        JNRecord.setCurrentSublistValue({
                            sublistId: sublistId,
                            fieldId: "entity",
                            value: 2133,//往来名称：公司间交易供应商
                            ignoreFieldChange: false
                        });
                        JNRecord.setCurrentSublistValue({
                            sublistId:sublistId,
                            fieldId: "eliminate",
                            value: true,
                            ignoreFieldChange: false
                        });
                        JNRecord.commitLine({sublistId: sublistId});
                    }
                    if(reverseSum>0){
                        reverseSum = reverseSum.toFixed(2)
                        //生成3行合计
                        JNRecord.selectNewLine({
                            sublistId: sublistId
                        });
                        JNRecord.setCurrentSublistValue({
                            sublistId: sublistId,
                            fieldId: "account",
                            value: 1292,
                            ignoreFieldChange: false
                        });
                        JNRecord.setCurrentSublistValue({
                            sublistId: sublistId,
                            fieldId: "debit",
                            value: reverseSum,
                            ignoreFieldChange: false
                        });
                        JNRecord.setCurrentSublistValue({
                            sublistId: sublistId,
                            fieldId: "entity",
                            value: 16968,//VNDNS01270 Navan, Inc.
                            ignoreFieldChange: false
                        });
                        JNRecord.commitLine({sublistId: sublistId});

                        JNRecord.selectNewLine({
                            sublistId: sublistId
                        });
                        JNRecord.setCurrentSublistValue({
                            sublistId: sublistId,
                            fieldId: "account",
                            value: 1292,
                            ignoreFieldChange: false
                        });
                        JNRecord.setCurrentSublistValue({
                            sublistId: sublistId,
                            fieldId: "credit",
                            value: reverseSum,
                            ignoreFieldChange: false
                        });
                        JNRecord.setCurrentSublistValue({
                            sublistId: sublistId,
                            fieldId: "entity",
                            value: 16968,//VNDNS01270 Navan, Inc.
                            ignoreFieldChange: false
                        });
                        JNRecord.commitLine({sublistId: sublistId});
                        JNRecord.selectNewLine({
                            sublistId: sublistId
                        });
                        JNRecord.setCurrentSublistValue({
                            sublistId: sublistId,
                            fieldId: "account",
                            value: 1310,
                            ignoreFieldChange: false
                        });
                        JNRecord.setCurrentSublistValue({
                            sublistId: sublistId,
                            fieldId: "debit",
                            value: reverseSum,
                            ignoreFieldChange: false
                        });
                        JNRecord.setCurrentSublistValue({
                            sublistId: sublistId,
                            fieldId: "memo",
                            // value: "Payment_Navan reimbursement " + dateArr[0] + dateArr[1] + "_PINGCAP PTE. LTD. Representative Payment to PingCAP (US), Inc.",
                            value: "Payment_Navan reimbursement " + "2025" + month + "_Pingcap US payment on behalf",//"_PINGCAP PTE. LTD. Representative Payment to PingCAP (US), Inc.",
                            ignoreFieldChange: false
                        });
                        JNRecord.setCurrentSublistValue({
                            sublistId: sublistId,
                            fieldId: "entity",
                            value: 2133,//往来名称：公司间交易供应商
                            ignoreFieldChange: false
                        });
                        JNRecord.setCurrentSublistValue({
                            sublistId:sublistId,
                            fieldId: "eliminate",
                            value: true,
                            ignoreFieldChange: false
                        });
                        JNRecord.commitLine({sublistId: sublistId});
                    }
                    recordId = JNRecord.save({
                        enableSourcing: true,
                        ignoreMandatoryFields: true
                    });
                    log.audit('SG_recordId',recordId)

                    if(recordId){
                        var this_record = record.create({
                            type: 'journalentry',
                            isDynamic: true,
                            defaultValues:{customform:107}
                        });
                        this_record.setValue({
                            fieldId: "subsidiary",
                            value: 6
                        });

                        this_record.setValue({
                            fieldId: "currency",
                            value: key[2]
                        });
                        //目标子公司
                        this_record.setValue({
                            fieldId: "tosubsidiary",
                            value: 8
                        });
                        var time = new Date();
                        var month = Number(time.getMonth());
                        if(month.toString().length == 1)month = "0" + month;
                        this_record.setValue({
                            fieldId: "trandate",
                            value: format.parse({
                                value: time,
                                type: format.Type.DATE
                            })
                        });
                        this_record.setValue({
                            fieldId: "memo",
                            // value: "Payment_Navan reimbursement "+ dateArr[0] + dateArr[1]+ "_PingCAP (US), Inc. Representative Payment to PINGCAP PTE. LTD."
                            value: "Payment_Navan reimbursement "+ "2025" + month + "_PingCAP (US), Inc. Representative Payment to PINGCAP PTE. LTD."
                        });

                        //来源平台设置9
                        this_record.setValue({
                            fieldId: "custbody_swc_platform",
                            value: 9
                        });
                        //NAVAN业务类型
                        this_record.setValue({
                            fieldId: "custbody_swc_navan_type",
                            value: key[4]
                        });
                        var sublistId="line"
                        //借：其他应收内部往来
                        this_record.selectNewLine({
                            sublistId: sublistId
                        });
                        this_record.setCurrentSublistValue({
                            sublistId: sublistId,
                            fieldId: "account",
                            value: 1248,
                            ignoreFieldChange: false
                        });
                        this_record.setCurrentSublistValue({
                            sublistId: sublistId,
                            fieldId: "debit",
                            value: debitSum - reverseSum,
                            ignoreFieldChange: false
                        });
                        this_record.setCurrentSublistValue({
                            sublistId: sublistId,
                            fieldId: "entity",
                            value: 69655,//1981,//往来名称：公司间交易供应商
                            ignoreFieldChange: false
                        });
                        this_record.setCurrentSublistValue({
                            sublistId: sublistId,
                            fieldId: "memo",
                            // value: "Payment_Navan reimbursement "+ dateArr[0] + dateArr[1]+ "_PingCAP (US), Inc. Representative Payment to PINGCAP PTE. LTD.",
                            value: "Payment_Navan reimbursement "+ "2025" + month + "_PingCAP (US), Inc. Representative Payment to PINGCAP PTE. LTD.",//"_Pingcap US payment on behalf",//
                            ignoreFieldChange: false
                        });
                        this_record.setCurrentSublistValue({
                            sublistId:sublistId,
                            fieldId: "eliminate",
                            value: true,
                            ignoreFieldChange: false
                        });
                        this_record.commitLine({sublistId: sublistId});
                        //贷：银行：银行_美国花旗
                        this_record.selectNewLine({
                            sublistId: sublistId
                        });
                        this_record.setCurrentSublistValue({
                            sublistId: sublistId,
                            fieldId: "account",
                            value: 3485,
                            ignoreFieldChange: false
                        });
                        this_record.setCurrentSublistValue({
                            sublistId: sublistId,
                            fieldId: "credit",
                            value: debitSum - reverseSum,
                            ignoreFieldChange: false
                        });
                        this_record.setCurrentSublistValue({
                            sublistId: sublistId,
                            fieldId: "memo",
                            // value: "Payment_Navan reimbursement "+ dateArr[0] + dateArr[1]+ "_PingCAP (US), Inc. Representative Payment to PINGCAP PTE. LTD.",
                            value: "Payment_Navan reimbursement "+ "2025" + month+ "_PingCAP (US), Inc. Representative Payment to PINGCAP PTE. LTD.",//"_Pingcap US payment on behalf",//
                            ignoreFieldChange: false
                        });
                        this_record.commitLine({sublistId: sublistId});

                        // if(reverseSum>0){
                        //     //相反
                        //     this_record.selectNewLine({
                        //         sublistId: sublistId
                        //     });
                        //     this_record.setCurrentSublistValue({
                        //         sublistId: sublistId,
                        //         fieldId: "account",
                        //         value: 1248,
                        //         ignoreFieldChange: false
                        //     });
                        //     this_record.setCurrentSublistValue({
                        //         sublistId: sublistId,
                        //         fieldId: "credit",
                        //         value: reverseSum,
                        //         ignoreFieldChange: false
                        //     });
                        //     this_record.setCurrentSublistValue({
                        //         sublistId: sublistId,
                        //         fieldId: "memo",
                        //         value: "Payment_Navan reimbursement "+ dateArr[0] + dateArr[1]+ "_PingCAP (US), Inc. Representative Payment to PINGCAP PTE. LTD.",
                        //         ignoreFieldChange: false
                        //     });
                        //     this_record.setCurrentSublistValue({
                        //         sublistId: sublistId,
                        //         fieldId: "entity",
                        //         value: 1981,//往来名称：公司间交易供应商
                        //         ignoreFieldChange: false
                        //     });
                        //     this_record.setCurrentSublistValue({
                        //         sublistId:sublistId,
                        //         fieldId: "eliminate",
                        //         value: true,
                        //         ignoreFieldChange: false
                        //     });
                        //     this_record.commitLine({sublistId: sublistId});
                        //     //贷：银行：银行_美国花旗
                        //     this_record.selectNewLine({
                        //         sublistId: sublistId
                        //     });
                        //     this_record.setCurrentSublistValue({
                        //         sublistId: sublistId,
                        //         fieldId: "account",
                        //         value: 3485,
                        //         ignoreFieldChange: false
                        //     });
                        //     this_record.setCurrentSublistValue({
                        //         sublistId: sublistId,
                        //         fieldId: "debit",
                        //         value: reverseSum,
                        //         ignoreFieldChange: false
                        //     });
                        //     this_record.setCurrentSublistValue({
                        //         sublistId: sublistId,
                        //         fieldId: "memo",
                        //         value: "Payment_Navan reimbursement "+ dateArr[0] + dateArr[1]+ "_PingCAP (US), Inc. Representative Payment to PINGCAP PTE. LTD.",
                        //         ignoreFieldChange: false
                        //     });
                        //     this_record.commitLine({sublistId: sublistId});
                        // }

                        var newJN_id=this_record.save({
                            enableSourcing: true,
                            ignoreMandatoryFields: true
                        });

                        //Navan公司间关联日记账
                        record.submitFields({
                            type: 'journalentry',
                            id: recordId,
                            values: {
                                custbody_swc_navan_interjouory: newJN_id
                            }
                        });
                        record.submitFields({
                            type: 'journalentry',
                            id: newJN_id,
                            values: {
                                custbody_swc_navan_interjouory: recordId
                            }
                        });
                    }
                }
                if(value[Object.keys(value)[0]]["country"]=="JP"){
                    //公司主体为日本时，生成分录（日记账自定义表单（customform）设置107，目标子公司设置6）：
                    JNRecord = record.create({
                        type: 'journalentry',
                        isDynamic: true,
                        defaultValues:{customform:107}
                    });
                    JNRecord.setValue({
                        fieldId: "subsidiary",
                        value: key[0]
                    });
                    JNRecord.setValue({
                        fieldId: "currency",
                        value: key[2]
                    });
                    //目标子公司
                    JNRecord.setValue({
                        fieldId: "tosubsidiary",
                        value: 6
                    });
                    var time = new Date();
                    var month = Number(time.getMonth());
                    if(month.toString().length == 1)month = "0" + month;
                    JNRecord.setValue({
                        fieldId: "trandate",
                        value: format.parse({
                            value: time,
                            type: format.Type.DATE
                        })
                    });
                    var dateArr = formatDate(new Date(),format);
                    if (dateArr.length > 0) {
                        JNRecord.setValue({
                            fieldId: "memo",
                            // value: "Navan reimbursement " + dateArr[0] + dateArr[1]
                            value: "Navan reimbursement " + "2025" + month
                        });
                    }
                    //来源平台设置9
                    JNRecord.setValue({
                        fieldId: "custbody_swc_platform",
                        value: 9
                    });
                    //NAVAN业务类型
                    JNRecord.setValue({
                        fieldId: "custbody_swc_navan_type",
                        value: key[4]
                    });
                    var sublistId="line"
                    var debitSum = 0;//借zong
                    var reverseSum = 0;//negative_cost
                    for(let key1 in value){
                        if(value[key1].hasOwnProperty("expenseaccount")&&value[key1].debitfxamount){
                            var taxCode = value[key1].taxcode
                            var tax = 0;
                            var jptax = 0;
                            var swcTaxrate = "";

                            JNRecord.selectNewLine({
                                sublistId: sublistId
                            });
                            JNRecord.setCurrentSublistValue({
                                sublistId: sublistId,
                                fieldId: "account",
                                value: value[key1].expenseaccount,
                                ignoreFieldChange: false
                            });
                            if (value[key1].taxcode) {
                                JNRecord.setCurrentSublistValue({
                                    sublistId: sublistId,
                                    fieldId: "taxcode",
                                    value: value[key1].taxcode,
                                    ignoreFieldChange: false
                                });
                            }
                            if(value[key1]["negative_cost"]){
                                if (value[key1].debitfxamount) {
                                    JNRecord.setCurrentSublistValue({
                                        sublistId: sublistId,
                                        fieldId: "credit",
                                        value: value[key1].debitfxamount,
                                        ignoreFieldChange: false
                                    });
                                }
                            }else{
                                if (value[key1].debitfxamount) {
                                    JNRecord.setCurrentSublistValue({
                                        sublistId: sublistId,
                                        fieldId: "debit",
                                        value: value[key1].debitfxamount,
                                        ignoreFieldChange: false
                                    });
                                }
                            }
                            if (value[key1].department) {
                                JNRecord.setCurrentSublistValue({
                                    sublistId: sublistId,
                                    fieldId: "department",
                                    value: value[key1].department,
                                });
                            }
                            var curAccountName = JNRecord.getCurrentSublistText({
                                sublistId: sublistId,
                                fieldId: "account",
                            });
                            if (curAccountName.indexOf("研发") >= 0) {
                                JNRecord.setCurrentSublistValue({
                                    sublistId: sublistId,
                                    fieldId: "cseg_swc_pro",
                                    value: "1",
                                });
                            } else {
                                JNRecord.setCurrentSublistValue({
                                    sublistId: sublistId,
                                    fieldId: "cseg_swc_pro",
                                    value: "3",
                                });
                            }
                            JNRecord.setCurrentSublistValue({
                                sublistId: sublistId,
                                fieldId: "cseg_swc_region",
                                value: "6",
                            });
                            if (value[key1].entityid) {
                                // JNRecord.setCurrentSublistText({
                                //     sublistId: sublistId,
                                //     fieldId: "entity",
                                //     text: value[key1].entityid,
                                // });
                                JNRecord.setCurrentSublistText({
                                    sublistId: sublistId,
                                    fieldId: "custcol_swc_jon_employee",
                                    text: value[key1].entityid,
                                });
                            }
                            if (value[key1].memo) {
                                JNRecord.setCurrentSublistValue({
                                    sublistId: sublistId,
                                    fieldId: "memo",
                                    value: value[key1].memo,
                                });
                            }
                            var jpyTax1amt =0;
                            if (value[key1].taxcode) {
                                if(jptaxJson && jptaxJson[taxCode] && Object.keys(jptaxJson[taxCode]).length>0){
                                    tax = jptaxJson[taxCode]["rate"]?divN(jptaxJson[taxCode]["rate"],100):0;
                                    swcTaxrate = jptaxJson[taxCode]["rate"]?jptaxJson[taxCode]["rate"]+"%":"";
                                    jptax = jptaxJson[taxCode]["jptax"]?jptaxJson[taxCode]["jptax"]:0;
                                }
                                if(jptax){
                                    jpyTax1amt = (value[key1].debitfxamount * tax * jptax).toFixed(0);
                                }else {
                                    jpyTax1amt = (value[key1].debitfxamount * tax ).toFixed(0);
                                }

                                //20250526 税额直接取自于费用报告的税额 S
                                jpyTax1amt = Math.abs(value[key1].taxamount);
                                //20250526 税额直接取自于费用报告的税额 E

                                JNRecord.setCurrentSublistValue({
                                    sublistId: sublistId,
                                    fieldId: "tax1amt",//增值税金额
                                    value: jpyTax1amt,
                                    ignoreFieldChange: false
                                });
                                JNRecord.setCurrentSublistValue({
                                    sublistId: sublistId,
                                    fieldId: "custcol_swc_taxamount",
                                    value: jpyTax1amt,//税额
                                    ignoreFieldChange: false
                                });
                                JNRecord.setCurrentSublistValue({
                                    sublistId: sublistId,
                                    fieldId: "custcol_swc_taxrate",//税率
                                    value: swcTaxrate,
                                    ignoreFieldChange: false
                                });
                                JNRecord.setCurrentSublistValue({
                                    sublistId: sublistId,
                                    fieldId: "custcol_swc_report_taxcode",//税码
                                    value: value[key1].taxcode,
                                    ignoreFieldChange: false
                                });
                                JNRecord.setCurrentSublistValue({
                                    sublistId: sublistId,
                                    fieldId: "tax1acct",
                                    value: 230,//纳税科目
                                    ignoreFieldChange: false
                                });
                            }
                            JNRecord.commitLine({sublistId: sublistId});
                            if(value[key1]["negative_cost"]){
                                reverseSum+=(Number(value[key1].debitfxamount) + Number(jpyTax1amt))
                            }else{
                                debitSum+=(Number(value[key1].debitfxamount) + Number(jpyTax1amt))
                            }
                        }
                    }
                    log.audit('debitSum3',debitSum)
                    log.audit('reverseSum3',reverseSum)
                    if(debitSum>0){
                        //生成3行合计
                        JNRecord.selectNewLine({
                            sublistId: sublistId
                        });
                        JNRecord.setCurrentSublistValue({
                            sublistId: sublistId,
                            fieldId: "account",
                            value: 1292,
                            ignoreFieldChange: false
                        });
                        JNRecord.setCurrentSublistValue({
                            sublistId: sublistId,
                            fieldId: "credit",
                            value: debitSum,
                            ignoreFieldChange: false
                        });
                        JNRecord.setCurrentSublistValue({
                            sublistId: sublistId,
                            fieldId: "entity",
                            value: 16968,//VNDNS01270 Navan, Inc.
                            ignoreFieldChange: false
                        });
                        JNRecord.setCurrentSublistValue({
                            sublistId: sublistId,
                            fieldId: "memo",
                            // value: "Payment_Navan reimbursement " + dateArr[0] + dateArr[1],
                            value: "Payment_Navan reimbursement " + "2025" + month,
                            ignoreFieldChange: false
                        });
                        JNRecord.commitLine({sublistId: sublistId});

                        JNRecord.selectNewLine({
                            sublistId: sublistId
                        });
                        JNRecord.setCurrentSublistValue({
                            sublistId: sublistId,
                            fieldId: "account",
                            value: 1292,
                            ignoreFieldChange: false
                        });
                        JNRecord.setCurrentSublistValue({
                            sublistId: sublistId,
                            fieldId: "debit",
                            value: debitSum,
                            ignoreFieldChange: false
                        });
                        JNRecord.setCurrentSublistValue({
                            sublistId: sublistId,
                            fieldId: "entity",
                            value: 16968,//VNDNS01270 Navan, Inc.
                            ignoreFieldChange: false
                        });
                        JNRecord.setCurrentSublistValue({
                            sublistId: sublistId,
                            fieldId: "memo",
                            // value: "Payment_Navan reimbursement " + dateArr[0] + dateArr[1],
                            value: "Payment_Navan reimbursement " + "2025" + month,
                            ignoreFieldChange: false
                        });
                        JNRecord.commitLine({sublistId: sublistId});
                        JNRecord.selectNewLine({
                            sublistId: sublistId
                        });
                        JNRecord.setCurrentSublistValue({
                            sublistId: sublistId,
                            fieldId: "account",
                            value: 1310,
                            ignoreFieldChange: false
                        });
                        JNRecord.setCurrentSublistValue({
                            sublistId: sublistId,
                            fieldId: "credit",
                            value: debitSum,
                            ignoreFieldChange: false
                        });
                        JNRecord.setCurrentSublistValue({
                            sublistId: sublistId,
                            fieldId: "memo",
                            // value: "Payment_Navan reimbursement " + dateArr[0] + dateArr[1] + "_PingCAP 株式会社 Representative Payment to PingCAP (US), Inc.",
                            value: "Payment_Navan reimbursement " + "2025" + month + "_Pingcap US payment on behalf",//"_PingCAP 株式会社 Representative Payment to PingCAP (US), Inc.",
                            ignoreFieldChange: false
                        });
                        JNRecord.setCurrentSublistValue({
                            sublistId: sublistId,
                            fieldId: "entity",
                            value: 2141,//往来名称：公司间交易供应商
                            ignoreFieldChange: false
                        });
                        JNRecord.setCurrentSublistValue({
                            sublistId:sublistId,
                            fieldId: "eliminate",
                            value: true,
                            ignoreFieldChange: false
                        });
                        JNRecord.commitLine({sublistId: sublistId});
                    }
                    if(reverseSum>0){
                        //生成3行合计
                        JNRecord.selectNewLine({
                            sublistId: sublistId
                        });
                        JNRecord.setCurrentSublistValue({
                            sublistId: sublistId,
                            fieldId: "account",
                            value: 1292,
                            ignoreFieldChange: false
                        });
                        JNRecord.setCurrentSublistValue({
                            sublistId: sublistId,
                            fieldId: "debit",
                            value: reverseSum,
                            ignoreFieldChange: false
                        });
                        JNRecord.setCurrentSublistValue({
                            sublistId: sublistId,
                            fieldId: "entity",
                            value: 16968,//VNDNS01270 Navan, Inc.
                            ignoreFieldChange: false
                        });
                        JNRecord.commitLine({sublistId: sublistId});

                        JNRecord.selectNewLine({
                            sublistId: sublistId
                        });
                        JNRecord.setCurrentSublistValue({
                            sublistId: sublistId,
                            fieldId: "account",
                            value: 1292,
                            ignoreFieldChange: false
                        });
                        JNRecord.setCurrentSublistValue({
                            sublistId: sublistId,
                            fieldId: "credit",
                            value: reverseSum,
                            ignoreFieldChange: false
                        });
                        JNRecord.setCurrentSublistValue({
                            sublistId: sublistId,
                            fieldId: "entity",
                            value: 16968,//VNDNS01270 Navan, Inc.
                            ignoreFieldChange: false
                        });
                        JNRecord.commitLine({sublistId: sublistId});
                        JNRecord.selectNewLine({
                            sublistId: sublistId
                        });
                        JNRecord.setCurrentSublistValue({
                            sublistId: sublistId,
                            fieldId: "account",
                            value: 1310,
                            ignoreFieldChange: false
                        });
                        JNRecord.setCurrentSublistValue({
                            sublistId: sublistId,
                            fieldId: "debit",
                            value: reverseSum,
                            ignoreFieldChange: false
                        });
                        JNRecord.setCurrentSublistValue({
                            sublistId: sublistId,
                            fieldId: "memo",
                            // value: "Payment_Navan reimbursement " + dateArr[0] + dateArr[1] + "_PingCAP 株式会社 Representative Payment to PingCAP (US), Inc.",
                            value: "Payment_Navan reimbursement " + "2025" + month + "_Pingcap US payment on behalf",//"_PingCAP 株式会社 Representative Payment to PingCAP (US), Inc.",
                            ignoreFieldChange: false
                        });
                        JNRecord.setCurrentSublistValue({
                            sublistId: sublistId,
                            fieldId: "entity",
                            value: 2141,//往来名称：公司间交易供应商
                            ignoreFieldChange: false
                        });
                        JNRecord.setCurrentSublistValue({
                            sublistId:sublistId,
                            fieldId: "eliminate",
                            value: true,
                            ignoreFieldChange: false
                        });
                        JNRecord.commitLine({sublistId: sublistId});
                    }
                    recordId = JNRecord.save({
                        enableSourcing: true,
                        ignoreMandatoryFields: true
                    });
                    log.audit('JP_recordId',recordId)
                    if(recordId){
                        var this_record = record.create({
                            type: 'journalentry',
                            isDynamic: true,
                            defaultValues:{customform:107}
                        });
                        this_record.setValue({
                            fieldId: "subsidiary",
                            value: 6
                        });

                        this_record.setValue({
                            fieldId: "currency",
                            value: key[2]
                        });
                        //目标子公司
                        this_record.setValue({
                            fieldId: "tosubsidiary",
                            value: 9
                        });
                        var time = new Date();
                        var month = Number(time.getMonth());
                        if(month.toString().length == 1)month = "0" + month;
                        this_record.setValue({
                            fieldId: "trandate",
                            value: format.parse({
                                value: time,
                                type: format.Type.DATE
                            })
                        });
                        this_record.setValue({
                            fieldId: "memo",
                            // value: "Payment_Navan reimbursement "+ dateArr[0] + dateArr[1]+ "_PingCAP (US), Inc. Representative Payment to PingCAP 株式会社"
                            value: "Payment_Navan reimbursement "+ "2025" + month+ "_PingCAP (US), Inc. Representative Payment to PingCAP 株式会社"
                        });

                        //来源平台设置9
                        this_record.setValue({
                            fieldId: "custbody_swc_platform",
                            value: 9
                        });
                        //NAVAN业务类型
                        this_record.setValue({
                            fieldId: "custbody_swc_navan_type",
                            value: key[4]
                        });
                        var sublistId="line"
                        //借：其他应收内部往来
                        this_record.selectNewLine({
                            sublistId: sublistId
                        });
                        this_record.setCurrentSublistValue({
                            sublistId: sublistId,
                            fieldId: "account",
                            value: 1248,
                            ignoreFieldChange: false
                        });
                        this_record.setCurrentSublistValue({
                            sublistId: sublistId,
                            fieldId: "debit",
                            value: debitSum-reverseSum,
                            ignoreFieldChange: false
                        });
                        this_record.setCurrentSublistValue({
                            sublistId: sublistId,
                            fieldId: "memo",
                            // value: "Payment_Navan reimbursement "+ dateArr[0] + dateArr[1]+ "_PingCAP (US), Inc. Representative Payment to PingCAP 株式会社",
                            value: "Payment_Navan reimbursement "+ "2025" + month+ "PingCAP (US), Inc. Representative Payment to PingCAP 株式会社",//"_PingCAP (US), Inc. Representative Payment to PingCAP 株式会社",
                            ignoreFieldChange: false
                        });
                        this_record.setCurrentSublistValue({
                            sublistId: sublistId,
                            fieldId: "entity",
                            value: 1982,//往来名称：公司间交易供应商
                            ignoreFieldChange: false
                        });
                        this_record.setCurrentSublistValue({
                            sublistId:sublistId,
                            fieldId: "eliminate",
                            value: true,
                            ignoreFieldChange: false
                        });
                        this_record.commitLine({sublistId: sublistId});
                        //贷：银行：银行_美国花旗
                        this_record.selectNewLine({
                            sublistId: sublistId
                        });
                        this_record.setCurrentSublistValue({
                            sublistId: sublistId,
                            fieldId: "account",
                            value: 3485,
                            ignoreFieldChange: false
                        });
                        this_record.setCurrentSublistValue({
                            sublistId: sublistId,
                            fieldId: "credit",
                            value: debitSum-reverseSum,
                            ignoreFieldChange: false
                        });
                        this_record.setCurrentSublistValue({
                            sublistId: sublistId,
                            fieldId: "memo",
                            // value: "Payment_Navan reimbursement "+ dateArr[0] + dateArr[1]+ "_PingCAP (US), Inc. Representative Payment to PingCAP 株式会社",
                            value: "Payment_Navan reimbursement "+ "2025" + month+ "_Pingcap US payment on behalf",//"_PingCAP (US), Inc. Representative Payment to PingCAP 株式会社",
                            ignoreFieldChange: false
                        });
                        this_record.commitLine({sublistId: sublistId});


                        var newJN_id=this_record.save({
                            enableSourcing: true,
                            ignoreMandatoryFields: true
                        });
                        //Navan公司间关联日记账
                        record.submitFields({
                            type: 'journalentry',
                            id: recordId,
                            values: {
                                custbody_swc_navan_interjouory: newJN_id
                            }
                        });
                        record.submitFields({//202503 add
                            type: 'journalentry',
                            id: newJN_id,
                            values: {
                                custbody_swc_navan_interjouory: recordId
                            }
                        });

                    }
                }
                if(value[Object.keys(value)[0]]["country"]=="MY"){
                    JNRecord = record.create({
                        type: 'journalentry',
                        isDynamic: true,
                    });
                    if( key[0] == 9) {
                        JNRecord.setValue({
                            fieldId: "subsidiary",
                            value: 25
                        });
                    }else {
                        JNRecord.setValue({
                            fieldId: "subsidiary",
                            value: key[0]
                        });
                    }
                    JNRecord.setValue({
                        fieldId: "currency",
                        value: key[2]
                    });
                    //目标子公司
                    JNRecord.setValue({
                        fieldId: "tosubsidiary",
                        value: 6
                    });
                    var time = new Date();
                    var month = Number(time.getMonth());
                    if(month.toString().length == 1)month = "0" + month;
                    JNRecord.setValue({
                        fieldId: "trandate",
                        value: format.parse({
                            value: time,
                            type: format.Type.DATE
                        })
                    });
                    var dateArr = formatDate(new Date(),format);
                    log.audit("dateArr",dateArr)
                    if (dateArr.length > 0) {
                        JNRecord.setValue({
                            fieldId: "memo",
                            // value: "Navan reimbursement " + dateArr[0] + dateArr[1]
                            value: "Navan reimbursement " + "2025" + month
                        });
                    }
                    //来源平台设置9
                    JNRecord.setValue({
                        fieldId: "custbody_swc_platform",
                        value: 9
                    });
                    //NAVAN业务类型
                    JNRecord.setValue({
                        fieldId: "custbody_swc_navan_type",
                        value: key[4]
                    });
                    var sublistId="line"
                    var debitSum = 0;//借zong
                    var reverseSum = 0;//negative_cost
                    for(let key1 in value){
                        if(value[key1].hasOwnProperty("expenseaccount")&&value[key1].debitfxamount){
                            JNRecord.selectNewLine({
                                sublistId: sublistId
                            });
                            JNRecord.setCurrentSublistValue({
                                sublistId: sublistId,
                                fieldId: "account",
                                value: value[key1].expenseaccount,
                                ignoreFieldChange: false
                            });
                            if(value[key1]["negative_cost"]){
                                if (value[key1].debitfxamount) {
                                    JNRecord.setCurrentSublistValue({
                                        sublistId: sublistId,
                                        fieldId: "credit",
                                        value: value[key1].debitfxamount,
                                        ignoreFieldChange: false
                                    });
                                }
                            }else{
                                if (value[key1].debitfxamount) {
                                    JNRecord.setCurrentSublistValue({
                                        sublistId: sublistId,
                                        fieldId: "debit",
                                        value: value[key1].debitfxamount,
                                        ignoreFieldChange: false
                                    });
                                }
                            }
                            if (value[key1].department) {
                                JNRecord.setCurrentSublistValue({
                                    sublistId: sublistId,
                                    fieldId: "department",
                                    value: value[key1].department,
                                });
                            }
                            var curAccountName = JNRecord.getCurrentSublistText({
                                sublistId: sublistId,
                                fieldId: "account",
                            });
                            if (curAccountName.indexOf("研发") >= 0) {
                                JNRecord.setCurrentSublistValue({
                                    sublistId: sublistId,
                                    fieldId: "cseg_swc_pro",
                                    value: "1",
                                });
                            } else {
                                JNRecord.setCurrentSublistValue({
                                    sublistId: sublistId,
                                    fieldId: "cseg_swc_pro",
                                    value: "3",
                                });
                            }
                            JNRecord.setCurrentSublistValue({
                                sublistId: sublistId,
                                fieldId: "cseg_swc_region",
                                value: "11",
                            });
                            if (value[key1].entityid) {
                                // JNRecord.setCurrentSublistText({
                                //     sublistId: sublistId,
                                //     fieldId: "entity",
                                //     text: value[key1].entityid,
                                // });
                                JNRecord.setCurrentSublistText({
                                    sublistId: sublistId,
                                    fieldId: "custcol_swc_jon_employee",
                                    text: value[key1].entityid,
                                });
                            }
                            if (value[key1].memo) {
                                JNRecord.setCurrentSublistValue({
                                    sublistId: sublistId,
                                    fieldId: "memo",
                                    value: value[key1].memo,
                                });
                            }
                            JNRecord.commitLine({sublistId: sublistId});
                            if(value[key1]["negative_cost"]){
                                reverseSum+=Number(value[key1].debitfxamount)
                            }else{
                                debitSum+=Number(value[key1].debitfxamount)
                            }

                            //其他应付报销款
                            JNRecord.selectNewLine({
                                sublistId: sublistId
                            });
                            JNRecord.setCurrentSublistValue({
                                sublistId: sublistId,
                                fieldId: "account",
                                value: 1308,
                                ignoreFieldChange: false
                            });
                            if(value[key1]["negative_cost"]){
                                if (value[key1].debitfxamount) {
                                    JNRecord.setCurrentSublistValue({
                                        sublistId: sublistId,
                                        fieldId: "debit",
                                        value: value[key1].debitfxamount,
                                        ignoreFieldChange: false
                                    });
                                }
                            }else{
                                if (value[key1].debitfxamount) {
                                    JNRecord.setCurrentSublistValue({
                                        sublistId: sublistId,
                                        fieldId: "credit",
                                        value: value[key1].debitfxamount,
                                        ignoreFieldChange: false
                                    });
                                }
                            }
                            JNRecord.setCurrentSublistValue({
                                sublistId: sublistId,
                                fieldId: "memo",
                                // value: "Payment_" + value[key1].entityid + "_Navan reimbursement " + dateArr[0] + dateArr[1],
                                value: "Payment_" + value[key1].entityid + "_Navan reimbursement " + "2025" + month,
                            });
                            JNRecord.setCurrentSublistText({
                                sublistId: sublistId,
                                fieldId: "custcol_swc_jon_employee",
                                text: value[key1].entityid,
                            });
                            JNRecord.commitLine({sublistId: sublistId});

                            JNRecord.selectNewLine({
                                sublistId: sublistId
                            });
                            JNRecord.setCurrentSublistValue({
                                sublistId: sublistId,
                                fieldId: "account",
                                value: 1308,
                                ignoreFieldChange: false
                            });
                            if(value[key1]["negative_cost"]){
                                if (value[key1].debitfxamount) {
                                    JNRecord.setCurrentSublistValue({
                                        sublistId: sublistId,
                                        fieldId: "credit",
                                        value: value[key1].debitfxamount,
                                        ignoreFieldChange: false
                                    });
                                }
                            }else{
                                if (value[key1].debitfxamount) {
                                    JNRecord.setCurrentSublistValue({
                                        sublistId: sublistId,
                                        fieldId: "debit",
                                        value: value[key1].debitfxamount,
                                        ignoreFieldChange: false
                                    });
                                }
                            }
                            JNRecord.setCurrentSublistValue({
                                sublistId: sublistId,
                                fieldId: "memo",
                                // value: "Payment_" + value[key1].entityid + "_Navan reimbursement " + dateArr[0] + dateArr[1],
                                value: "Payment_" + value[key1].entityid + "_Navan reimbursement " + "2025" + month,
                            });
                            JNRecord.setCurrentSublistText({
                                sublistId: sublistId,
                                fieldId: "custcol_swc_jon_employee",
                                text: value[key1].entityid,
                            });
                            JNRecord.commitLine({sublistId: sublistId});
                        }
                    }
                    log.audit('debitSum1678',debitSum)
                    log.audit('reverseSum',reverseSum)
                    if(debitSum>0){
                        //生成3行合计
                        // JNRecord.selectNewLine({
                        //     sublistId: sublistId
                        // });
                        // JNRecord.setCurrentSublistValue({
                        //     sublistId: sublistId,
                        //     fieldId: "account",
                        //     value: 1308,
                        //     ignoreFieldChange: false
                        // });
                        // JNRecord.setCurrentSublistValue({
                        //     sublistId: sublistId,
                        //     fieldId: "credit",
                        //     value: debitSum,
                        //     ignoreFieldChange: false
                        // });
                        // JNRecord.commitLine({sublistId: sublistId});
                        //
                        // JNRecord.selectNewLine({
                        //     sublistId: sublistId
                        // });
                        // JNRecord.setCurrentSublistValue({
                        //     sublistId: sublistId,
                        //     fieldId: "account",
                        //     value: 1308,
                        //     ignoreFieldChange: false
                        // });
                        // JNRecord.setCurrentSublistValue({
                        //     sublistId: sublistId,
                        //     fieldId: "debit",
                        //     value: debitSum,
                        //     ignoreFieldChange: false
                        // });
                        // JNRecord.commitLine({sublistId: sublistId});
                        JNRecord.selectNewLine({
                            sublistId: sublistId
                        });
                        JNRecord.setCurrentSublistValue({
                            sublistId: sublistId,
                            fieldId: "account",
                            value: 1310,
                            ignoreFieldChange: false
                        });
                        JNRecord.setCurrentSublistValue({
                            sublistId: sublistId,
                            fieldId: "credit",
                            value: debitSum,
                            ignoreFieldChange: false
                        });
                        JNRecord.setCurrentSublistValue({
                            sublistId: sublistId,
                            fieldId: "memo",
                            // value: "Payment_Navan reimbursement " + dateArr[0] + dateArr[1] + "_PINGCAP PTE. LTD. Representative Payment to PingCAP (US), Inc.",
                            value: "Payment_Navan reimbursement " + "2025" + month + "_Pingcap US payment on behalf",//"_PINGCAP PTE. LTD. Representative Payment to PingCAP (US), Inc.",
                            ignoreFieldChange: false
                        });
                        JNRecord.setCurrentSublistValue({
                            sublistId: sublistId,
                            fieldId: "entity",
                            value: 2133,//往来名称：公司间交易供应商
                            ignoreFieldChange: false
                        });
                        JNRecord.setCurrentSublistValue({
                            sublistId:sublistId,
                            fieldId: "eliminate",
                            value: true,
                            ignoreFieldChange: false
                        });
                        JNRecord.commitLine({sublistId: sublistId});
                    }
                    if(reverseSum>0){
                        //生成3行合计
                        // JNRecord.selectNewLine({
                        //     sublistId: sublistId
                        // });
                        // JNRecord.setCurrentSublistValue({
                        //     sublistId: sublistId,
                        //     fieldId: "account",
                        //     value: 1308,
                        //     ignoreFieldChange: false
                        // });
                        // JNRecord.setCurrentSublistValue({
                        //     sublistId: sublistId,
                        //     fieldId: "debit",
                        //     value: reverseSum,
                        //     ignoreFieldChange: false
                        // });
                        // JNRecord.commitLine({sublistId: sublistId});
                        //
                        // JNRecord.selectNewLine({
                        //     sublistId: sublistId
                        // });
                        // JNRecord.setCurrentSublistValue({
                        //     sublistId: sublistId,
                        //     fieldId: "account",
                        //     value: 1308,
                        //     ignoreFieldChange: false
                        // });
                        // JNRecord.setCurrentSublistValue({
                        //     sublistId: sublistId,
                        //     fieldId: "credit",
                        //     value: reverseSum,
                        //     ignoreFieldChange: false
                        // });
                        // JNRecord.commitLine({sublistId: sublistId});
                        JNRecord.selectNewLine({
                            sublistId: sublistId
                        });
                        JNRecord.setCurrentSublistValue({
                            sublistId: sublistId,
                            fieldId: "account",
                            value: 1310,
                            ignoreFieldChange: false
                        });
                        JNRecord.setCurrentSublistValue({
                            sublistId: sublistId,
                            fieldId: "debit",
                            value: reverseSum,
                            ignoreFieldChange: false
                        });
                        JNRecord.setCurrentSublistValue({
                            sublistId: sublistId,
                            fieldId: "memo",
                            // value: "Payment_Navan reimbursement " + dateArr[0] + dateArr[1] + "_PINGCAP PTE. LTD. Representative Payment to PingCAP (US), Inc.",
                            value: "Payment_Navan reimbursement " + "2025" + month + "_Pingcap US payment on behalf",//"_PINGCAP PTE. LTD. Representative Payment to PingCAP (US), Inc.",
                            ignoreFieldChange: false
                        });
                        JNRecord.setCurrentSublistValue({
                            sublistId: sublistId,
                            fieldId: "entity",
                            value: 2133,//往来名称：公司间交易供应商
                            ignoreFieldChange: false
                        });
                        JNRecord.setCurrentSublistValue({
                            sublistId:sublistId,
                            fieldId: "eliminate",
                            value: true,
                            ignoreFieldChange: false
                        });
                        JNRecord.commitLine({sublistId: sublistId});
                    }
                    recordId = JNRecord.save({
                        enableSourcing: true,
                        ignoreMandatoryFields: true
                    });
                    log.audit('MY_recordId',recordId)
                    if(recordId){
                        var this_record = record.create({
                            type: 'journalentry',
                            isDynamic: true,
                            defaultValues:{customform:107}
                        });
                        this_record.setValue({
                            fieldId: "subsidiary",
                            value: 6
                        });

                        this_record.setValue({
                            fieldId: "currency",
                            value: key[2]
                        });
                        //目标子公司
                        this_record.setValue({
                            fieldId: "tosubsidiary",
                            value: 25
                        });
                        var time = new Date();
                        var month = Number(time.getMonth());
                        if(month.toString().length == 1)month = "0" + month;
                        this_record.setValue({
                            fieldId: "trandate",
                            value: format.parse({
                                value: time,
                                type: format.Type.DATE
                            })
                        });
                        this_record.setValue({
                            fieldId: "memo",
                            // value: "Payment_Navan reimbursement "+ dateArr[0] + dateArr[1]+ "_PingCAP (US), Inc. Representative Payment to PINGCAP PTE. LTD."
                            value: "Payment_Navan reimbursement "+ "2025" + month+ "_PingCAP (US), Inc. Representative Payment to PINGCAP PTE. LTD."
                        });

                        //来源平台设置9
                        this_record.setValue({
                            fieldId: "custbody_swc_platform",
                            value: 9
                        });
                        //NAVAN业务类型
                        this_record.setValue({
                            fieldId: "custbody_swc_navan_type",
                            value: key[4]
                        });
                        var sublistId="line"
                        //借：其他应收内部往来
                        this_record.selectNewLine({
                            sublistId: sublistId
                        });
                        this_record.setCurrentSublistValue({
                            sublistId: sublistId,
                            fieldId: "account",
                            value: 1248,
                            ignoreFieldChange: false
                        });
                        this_record.setCurrentSublistValue({
                            sublistId: sublistId,
                            fieldId: "debit",
                            value: debitSum-reverseSum,
                            ignoreFieldChange: false
                        });
                        this_record.setCurrentSublistValue({
                            sublistId: sublistId,
                            fieldId: "memo",
                            // value: "Payment_Navan reimbursement "+ dateArr[0] + dateArr[1]+ "_PingCAP (US), Inc. Representative Payment to PINGCAP PTE. LTD.",
                            value: "Payment_Navan reimbursement "+ "2025" + month+ "_PingCAP (US), Inc. Representative Payment to PINGCAP PTE. LTD.",//"_Pingcap US payment on behalf",//
                            ignoreFieldChange: false
                        });
                        this_record.setCurrentSublistValue({
                            sublistId: sublistId,
                            fieldId: "entity",
                            value: 69655,//往来名称：公司间交易供应商
                            ignoreFieldChange: false
                        });
                        this_record.setCurrentSublistValue({
                            sublistId:sublistId,
                            fieldId: "eliminate",
                            value: true,
                            ignoreFieldChange: false
                        });
                        this_record.commitLine({sublistId: sublistId});
                        //贷：银行：银行_美国花旗
                        this_record.selectNewLine({
                            sublistId: sublistId
                        });
                        this_record.setCurrentSublistValue({
                            sublistId: sublistId,
                            fieldId: "account",
                            value: 3485,
                            ignoreFieldChange: false
                        });
                        this_record.setCurrentSublistValue({
                            sublistId: sublistId,
                            fieldId: "credit",
                            value: debitSum-reverseSum,
                            ignoreFieldChange: false
                        });
                        this_record.setCurrentSublistValue({
                            sublistId: sublistId,
                            fieldId: "memo",
                            // value: "Payment_Navan reimbursement "+ dateArr[0] + dateArr[1]+ "_PingCAP (US), Inc. Representative Payment to PINGCAP PTE. LTD.",
                            value: "Payment_Navan reimbursement "+ "2025" + month+ "_PingCAP (US), Inc. Representative Payment to PINGCAP PTE. LTD.",//"_Pingcap US payment on behalf",//
                            ignoreFieldChange: false
                        });
                        this_record.commitLine({sublistId: sublistId});

                        // if(reverseSum>0){
                        //     //相反
                        //     this_record.selectNewLine({
                        //         sublistId: sublistId
                        //     });
                        //     this_record.setCurrentSublistValue({
                        //         sublistId: sublistId,
                        //         fieldId: "account",
                        //         value: 1248,
                        //         ignoreFieldChange: false
                        //     });
                        //     this_record.setCurrentSublistValue({
                        //         sublistId: sublistId,
                        //         fieldId: "credit",
                        //         value: reverseSum,
                        //         ignoreFieldChange: false
                        //     });
                        //     this_record.setCurrentSublistValue({
                        //         sublistId: sublistId,
                        //         fieldId: "memo",
                        //         value: "Payment_Navan reimbursement "+ dateArr[0] + dateArr[1]+ "_PingCAP (US), Inc. Representative Payment to PINGCAP PTE. LTD.",
                        //         ignoreFieldChange: false
                        //     });
                        //     this_record.setCurrentSublistValue({
                        //         sublistId: sublistId,
                        //         fieldId: "entity",
                        //         value: 1981,//往来名称：公司间交易供应商
                        //         ignoreFieldChange: false
                        //     });
                        //     this_record.setCurrentSublistValue({
                        //         sublistId:sublistId,
                        //         fieldId: "eliminate",
                        //         value: true,
                        //         ignoreFieldChange: false
                        //     });
                        //     this_record.commitLine({sublistId: sublistId});
                        //     //贷：银行：银行_美国花旗
                        //     this_record.selectNewLine({
                        //         sublistId: sublistId
                        //     });
                        //     this_record.setCurrentSublistValue({
                        //         sublistId: sublistId,
                        //         fieldId: "account",
                        //         value: 3485,
                        //         ignoreFieldChange: false
                        //     });
                        //     this_record.setCurrentSublistValue({
                        //         sublistId: sublistId,
                        //         fieldId: "debit",
                        //         value: reverseSum,
                        //         ignoreFieldChange: false
                        //     });
                        //     this_record.setCurrentSublistValue({
                        //         sublistId: sublistId,
                        //         fieldId: "memo",
                        //         value: "Payment_Navan reimbursement "+ dateArr[0] + dateArr[1]+ "_PingCAP (US), Inc. Representative Payment to PINGCAP PTE. LTD.",
                        //         ignoreFieldChange: false
                        //     });
                        //     this_record.commitLine({sublistId: sublistId});
                        // }

                        var newJN_id=this_record.save({
                            enableSourcing: true,
                            ignoreMandatoryFields: true
                        });
                        //Navan公司间关联日记账
                        record.submitFields({
                            type: 'journalentry',
                            id: recordId,
                            values: {
                                custbody_swc_navan_interjouory: newJN_id
                            }
                        });
                        record.submitFields({//202503 add yyr
                            type: 'journalentry',
                            id: newJN_id,
                            values: {
                                custbody_swc_navan_interjouory: recordId
                            }
                        });
                    }
                }
            }else
            if(key[4]==2)
            {//2 MANUAL_TRANSACTIONS：
                var value = JSON.parse(value);
                if(value[Object.keys(value)[0]]["country"]=="JP"){
                    JNRecord = record.create({
                        type: 'journalentry',
                        isDynamic: true,
                    });
                    JNRecord.setValue({
                        fieldId: "subsidiary",
                        value: key[0]
                    });
                    JNRecord.setValue({
                        fieldId: "currency",
                        value: key[2]
                    });
                    var time = new Date();
                    var month = Number(time.getMonth());
                    if(month.toString().length == 1)month = "0" + month;
                    JNRecord.setValue({
                        fieldId: "trandate",
                        value: format.parse({
                            value: time,
                            type: format.Type.DATE
                        })
                    });
                    var dateArr = formatDate(new Date(),format);
                    if (dateArr.length > 0) {
                        JNRecord.setValue({
                            fieldId: "memo",
                            // value: "Navan reimbursement " + dateArr[0] + dateArr[1]
                            value: "Navan reimbursement " + "2025" + month
                        });
                    }
                    //来源平台设置9
                    JNRecord.setValue({
                        fieldId: "custbody_swc_platform",
                        value: 9
                    });
                    //NAVAN业务类型
                    JNRecord.setValue({
                        fieldId: "custbody_swc_navan_type",
                        value: key[4]
                    });
                    var sublistId="line"
                    var debitSum = 0;//借zong
                    var amtTotal = 0;
                    var amountTotal = 0;
                    var reverseSum = 0;//negative_cost
                    for(let key1 in value){
                        if(value[key1].hasOwnProperty("expenseaccount")&&value[key1].debitfxamount){
                            var taxCode = value[key1].taxcode
                            JNRecord.selectNewLine({
                                sublistId: sublistId
                            });
                            JNRecord.setCurrentSublistValue({
                                sublistId: sublistId,
                                fieldId: "account",
                                value: value[key1].expenseaccount,
                                ignoreFieldChange: false
                            });
                            if (value[key1].taxcode) {
                                JNRecord.setCurrentSublistValue({
                                    sublistId: sublistId,
                                    fieldId: "taxcode",
                                    value: value[key1].taxcode,
                                    ignoreFieldChange: false
                                });
                            }
                            if(value[key1]["negative_cost"]){
                                if (value[key1].debitfxamount) {
                                    JNRecord.setCurrentSublistValue({
                                        sublistId: sublistId,
                                        fieldId: "credit",
                                        value: value[key1].debitfxamount,
                                        ignoreFieldChange: false
                                    });
                                }
                            }else{
                                if (value[key1].debitfxamount) {
                                    JNRecord.setCurrentSublistValue({
                                        sublistId: sublistId,
                                        fieldId: "debit",
                                        value: value[key1].debitfxamount,
                                        ignoreFieldChange: false
                                    });
                                }
                            }
                            var jpyTax1amt =0;
                            if (value[key1].taxcode) {
                                if(jptaxJson && jptaxJson[taxCode] && Object.keys(jptaxJson[taxCode]).length>0){
                                    tax = jptaxJson[taxCode]["rate"]?divN(jptaxJson[taxCode]["rate"],100):0;
                                    swcTaxrate = jptaxJson[taxCode]["rate"]?jptaxJson[taxCode]["rate"]+"%":"";
                                    jptax = jptaxJson[taxCode]["jptax"]?jptaxJson[taxCode]["jptax"]:0;
                                }
                                if(jptax){
                                    jpyTax1amt = (value[key1].debitfxamount * tax * jptax).toFixed(0);
                                }else {
                                    jpyTax1amt = (value[key1].debitfxamount * tax ).toFixed(0);
                                }

                                //20250526 税额直接取自于费用报告的税额 S
                                jpyTax1amt = Math.abs(value[key1].taxamount);
                                //20250526 税额直接取自于费用报告的税额 E

                                JNRecord.setCurrentSublistValue({
                                    sublistId: sublistId,
                                    fieldId: "tax1amt",//增值税金额
                                    value: jpyTax1amt,
                                    ignoreFieldChange: false
                                });
                                JNRecord.setCurrentSublistValue({
                                    sublistId: sublistId,
                                    fieldId: "custcol_swc_taxamount",
                                    value: jpyTax1amt,//税额
                                    ignoreFieldChange: false
                                });
                                JNRecord.setCurrentSublistValue({
                                    sublistId: sublistId,
                                    fieldId: "custcol_swc_taxrate",//税率
                                    value: swcTaxrate,
                                    ignoreFieldChange: false
                                });
                                JNRecord.setCurrentSublistValue({
                                    sublistId: sublistId,
                                    fieldId: "custcol_swc_report_taxcode",//税码
                                    value: value[key1].taxcode,
                                    ignoreFieldChange: false
                                });
                                JNRecord.setCurrentSublistValue({
                                    sublistId: sublistId,
                                    fieldId: "tax1acct",
                                    value: 230,//纳税科目
                                    ignoreFieldChange: false
                                });
                            }
                            if (value[key1].department) {
                                JNRecord.setCurrentSublistValue({
                                    sublistId: sublistId,
                                    fieldId: "department",
                                    value: value[key1].department,
                                });
                            }
                            var curAccountName = JNRecord.getCurrentSublistText({
                                sublistId: sublistId,
                                fieldId: "account",
                            });
                            if (curAccountName.indexOf("研发") >= 0) {
                                JNRecord.setCurrentSublistValue({
                                    sublistId: sublistId,
                                    fieldId: "cseg_swc_pro",
                                    value: "1",
                                });
                            } else {
                                JNRecord.setCurrentSublistValue({
                                    sublistId: sublistId,
                                    fieldId: "cseg_swc_pro",
                                    value: "3",
                                });
                            }
                            JNRecord.setCurrentSublistValue({
                                sublistId: sublistId,
                                fieldId: "cseg_swc_region",
                                value: "6",
                            });
                            if (value[key1].entityid) {
                                // JNRecord.setCurrentSublistText({
                                //     sublistId: sublistId,
                                //     fieldId: "entity",
                                //     text: value[key1].entityid,
                                // });
                                JNRecord.setCurrentSublistText({
                                    sublistId: sublistId,
                                    fieldId: "custcol_swc_jon_employee",
                                    text: value[key1].entityid,
                                });
                            }
                            if (value[key1].memo) {
                                JNRecord.setCurrentSublistValue({
                                    sublistId: sublistId,
                                    fieldId: "memo",
                                    value: value[key1].memo,
                                });
                            }
                            JNRecord.commitLine({sublistId: sublistId});
                            if(value[key1]["negative_cost"]){
                                reverseSum+=(Number(value[key1].debitfxamount) + Number(jpyTax1amt))
                            }else{
                                debitSum+=(Number(value[key1].debitfxamount) + Number(jpyTax1amt))
                            }

                            //其他应付报销款
                            var curAmountTotal = Number(value[key1].debitfxamount) + Number(jpyTax1amt);
                            JNRecord.selectNewLine({
                                sublistId: sublistId
                            });
                            JNRecord.setCurrentSublistValue({
                                sublistId: sublistId,
                                fieldId: "account",
                                value: 1308,
                                ignoreFieldChange: false
                            });
                            if(value[key1]["negative_cost"]){
                                if (value[key1].debitfxamount) {
                                    JNRecord.setCurrentSublistValue({
                                        sublistId: sublistId,
                                        fieldId: "debit",
                                        value: curAmountTotal,
                                        ignoreFieldChange: false
                                    });
                                }
                            }else{
                                if (value[key1].debitfxamount) {
                                    JNRecord.setCurrentSublistValue({
                                        sublistId: sublistId,
                                        fieldId: "credit",
                                        value: curAmountTotal,
                                        ignoreFieldChange: false
                                    });
                                }
                            }
                            JNRecord.setCurrentSublistValue({
                                sublistId: sublistId,
                                fieldId: "memo",
                                // value: "Payment_" + value[key1].entityid + "_Navan reimbursement " + dateArr[0] + dateArr[1],
                                value: "Payment_" + value[key1].entityid + "_Navan reimbursement " + "2025" + month
                            });
                            JNRecord.setCurrentSublistText({
                                sublistId: sublistId,
                                fieldId: "custcol_swc_jon_employee",
                                text: value[key1].entityid,
                            });
                            JNRecord.commitLine({sublistId: sublistId});

                            JNRecord.selectNewLine({
                                sublistId: sublistId
                            });
                            JNRecord.setCurrentSublistValue({
                                sublistId: sublistId,
                                fieldId: "account",
                                value: 1308,
                                ignoreFieldChange: false
                            });
                            if(value[key1]["negative_cost"]){
                                if (value[key1].debitfxamount) {
                                    JNRecord.setCurrentSublistValue({
                                        sublistId: sublistId,
                                        fieldId: "credit",
                                        value: curAmountTotal,
                                        ignoreFieldChange: false
                                    });
                                }
                            }else{
                                if (value[key1].debitfxamount) {
                                    JNRecord.setCurrentSublistValue({
                                        sublistId: sublistId,
                                        fieldId: "debit",
                                        value: curAmountTotal,
                                        ignoreFieldChange: false
                                    });
                                }
                            }
                            JNRecord.setCurrentSublistValue({
                                sublistId: sublistId,
                                fieldId: "memo",
                                // value: "Payment_" + value[key1].entityid + "_Navan reimbursement " + dateArr[0] + dateArr[1],
                                value: "Payment_" + value[key1].entityid + "_Navan reimbursement " + "2025" + month,
                            });
                            JNRecord.setCurrentSublistText({
                                sublistId: sublistId,
                                fieldId: "custcol_swc_jon_employee",
                                text: value[key1].entityid,
                            });
                            JNRecord.commitLine({sublistId: sublistId});
                        }
                    }
                    log.audit('debitSum4',debitSum)
                    log.audit('reverseSum',reverseSum)
                    if(debitSum>0){
                        //生成3行合计
                        JNRecord.selectNewLine({
                            sublistId: sublistId
                        });
                        JNRecord.setCurrentSublistValue({
                            sublistId: sublistId,
                            fieldId: "account",
                            value: 737,
                            ignoreFieldChange: false
                        });
                        JNRecord.setCurrentSublistValue({
                            sublistId: sublistId,
                            fieldId: "credit",
                            value: debitSum,
                            ignoreFieldChange: false
                        });
                        JNRecord.setCurrentSublistValue({
                            sublistId: sublistId,
                            fieldId: "memo",
                            // value: "Payment_Navan reimbursement " + dateArr[0] + dateArr[1],
                            value: "Payment_Navan reimbursement " + "2025" + month,
                            ignoreFieldChange: false
                        });
                        JNRecord.commitLine({sublistId: sublistId});
                    }
                    if(reverseSum>0){

                        JNRecord.selectNewLine({
                            sublistId: sublistId
                        });
                        JNRecord.setCurrentSublistValue({
                            sublistId: sublistId,
                            fieldId: "account",
                            value: 737,
                            ignoreFieldChange: false
                        });
                        JNRecord.setCurrentSublistValue({
                            sublistId: sublistId,
                            fieldId: "debit",
                            value: reverseSum,
                            ignoreFieldChange: false
                        });
                        JNRecord.setCurrentSublistValue({
                            sublistId: sublistId,
                            fieldId: "memo",
                            // value: "Payment_Navan reimbursement " + dateArr[0] + dateArr[1],
                            value: "Payment_Navan reimbursement " + "2025" + month,
                            ignoreFieldChange: false
                        });
                        JNRecord.commitLine({sublistId: sublistId});
                    }

                    recordId = JNRecord.save({
                        enableSourcing: true,
                        ignoreMandatoryFields: true
                    });
                    log.audit('JP_recordId',recordId)
                }
                if(value[Object.keys(value)[0]]["country"]=="SG"){
                    JNRecord = record.create({
                        type: 'journalentry',
                        isDynamic: true,
                    });
                    if( key[0] == 8) {
                        JNRecord.setValue({
                            fieldId: "subsidiary",
                            value: 28
                        });
                    }else if( key[0] == 9) {
                        JNRecord.setValue({
                            fieldId: "subsidiary",
                            value: 25
                        });
                    }else {
                        JNRecord.setValue({
                            fieldId: "subsidiary",
                            value: key[0]
                        });
                    }
                    JNRecord.setValue({
                        fieldId: "currency",
                        value: key[2]
                    });
                    //目标子公司
                    JNRecord.setValue({
                        fieldId: "tosubsidiary",
                        value: 6
                    });
                    var time = new Date();
                    var month = Number(time.getMonth());
                    if(month.toString().length == 1)month = "0" + month;
                    JNRecord.setValue({
                        fieldId: "trandate",
                        value: format.parse({
                            value: time,
                            type: format.Type.DATE
                        })
                    });
                    var dateArr = formatDate(new Date(),format);
                    log.audit("dateArr",dateArr)
                    if (dateArr.length > 0) {
                        JNRecord.setValue({
                            fieldId: "memo",
                            // value: "Navan reimbursement " + dateArr[0] + dateArr[1]
                            value: "Navan reimbursement " + "2025" + month
                        });
                    }
                    //来源平台设置9
                    JNRecord.setValue({
                        fieldId: "custbody_swc_platform",
                        value: 9
                    });
                    //NAVAN业务类型
                    JNRecord.setValue({
                        fieldId: "custbody_swc_navan_type",
                        value: key[4]
                    });
                    var sublistId="line"
                    var debitSum = 0;//借zong
                    var reverseSum = 0;//negative_cost
                    for(let key1 in value){
                        if(value[key1].hasOwnProperty("expenseaccount")&&value[key1].debitfxamount){
                            JNRecord.selectNewLine({
                                sublistId: sublistId
                            });
                            JNRecord.setCurrentSublistValue({
                                sublistId: sublistId,
                                fieldId: "account",
                                value: value[key1].expenseaccount,
                                ignoreFieldChange: false
                            });
                            if(value[key1]["negative_cost"]){
                                if (value[key1].debitfxamount) {
                                    JNRecord.setCurrentSublistValue({
                                        sublistId: sublistId,
                                        fieldId: "credit",
                                        value: value[key1].debitfxamount,
                                        ignoreFieldChange: false
                                    });
                                }
                            }else{
                                if (value[key1].debitfxamount) {
                                    JNRecord.setCurrentSublistValue({
                                        sublistId: sublistId,
                                        fieldId: "debit",
                                        value: value[key1].debitfxamount,
                                        ignoreFieldChange: false
                                    });
                                }
                            }
                            if (value[key1].department) {
                                JNRecord.setCurrentSublistValue({
                                    sublistId: sublistId,
                                    fieldId: "department",
                                    value: value[key1].department,
                                });
                            }
                            var curAccountName = JNRecord.getCurrentSublistText({
                                sublistId: sublistId,
                                fieldId: "account",
                            });
                            if (curAccountName.indexOf("研发") >= 0) {
                                JNRecord.setCurrentSublistValue({
                                    sublistId: sublistId,
                                    fieldId: "cseg_swc_pro",
                                    value: "1",
                                });
                            } else {
                                JNRecord.setCurrentSublistValue({
                                    sublistId: sublistId,
                                    fieldId: "cseg_swc_pro",
                                    value: "3",
                                });
                            }
                            JNRecord.setCurrentSublistValue({
                                sublistId: sublistId,
                                fieldId: "cseg_swc_region",
                                value: "11",
                            });
                            if (value[key1].entityid) {
                                // JNRecord.setCurrentSublistText({
                                //     sublistId: sublistId,
                                //     fieldId: "entity",
                                //     text: value[key1].entityid,
                                // });
                                JNRecord.setCurrentSublistText({
                                    sublistId: sublistId,
                                    fieldId: "custcol_swc_jon_employee",
                                    text: value[key1].entityid,
                                });
                            }
                            if (value[key1].memo) {
                                JNRecord.setCurrentSublistValue({
                                    sublistId: sublistId,
                                    fieldId: "memo",
                                    value: value[key1].memo,
                                });
                            }
                            JNRecord.commitLine({sublistId: sublistId});
                            if(value[key1]["negative_cost"]){
                                reverseSum+=Number(value[key1].debitfxamount)
                            }else{
                                debitSum+=Number(value[key1].debitfxamount)
                            }

                            //其他应付报销款
                            JNRecord.selectNewLine({
                                sublistId: sublistId
                            });
                            JNRecord.setCurrentSublistValue({
                                sublistId: sublistId,
                                fieldId: "account",
                                value: 1308,
                                ignoreFieldChange: false
                            });
                            if(value[key1]["negative_cost"]){
                                if (value[key1].debitfxamount) {
                                    JNRecord.setCurrentSublistValue({
                                        sublistId: sublistId,
                                        fieldId: "debit",
                                        value: value[key1].debitfxamount,
                                        ignoreFieldChange: false
                                    });
                                }
                            }else{
                                if (value[key1].debitfxamount) {
                                    JNRecord.setCurrentSublistValue({
                                        sublistId: sublistId,
                                        fieldId: "credit",
                                        value: value[key1].debitfxamount,
                                        ignoreFieldChange: false
                                    });
                                }
                            }
                            JNRecord.setCurrentSublistValue({
                                sublistId: sublistId,
                                fieldId: "memo",
                                // value: "Payment_" + value[key1].entityid + "_Navan reimbursement " + dateArr[0] + dateArr[1],
                                value: "Payment_" + value[key1].entityid + "_Navan reimbursement " + "2025" + month,
                            });
                            JNRecord.setCurrentSublistText({
                                sublistId: sublistId,
                                fieldId: "custcol_swc_jon_employee",
                                text: value[key1].entityid,
                            });
                            JNRecord.commitLine({sublistId: sublistId});

                            JNRecord.selectNewLine({
                                sublistId: sublistId
                            });
                            JNRecord.setCurrentSublistValue({
                                sublistId: sublistId,
                                fieldId: "account",
                                value: 1308,
                                ignoreFieldChange: false
                            });
                            if(value[key1]["negative_cost"]){
                                if (value[key1].debitfxamount) {
                                    JNRecord.setCurrentSublistValue({
                                        sublistId: sublistId,
                                        fieldId: "credit",
                                        value: value[key1].debitfxamount,
                                        ignoreFieldChange: false
                                    });
                                }
                            }else{
                                if (value[key1].debitfxamount) {
                                    JNRecord.setCurrentSublistValue({
                                        sublistId: sublistId,
                                        fieldId: "debit",
                                        value: value[key1].debitfxamount,
                                        ignoreFieldChange: false
                                    });
                                }
                            }
                            JNRecord.setCurrentSublistValue({
                                sublistId: sublistId,
                                fieldId: "memo",
                                // value: "Payment_" + value[key1].entityid + "_Navan reimbursement " + dateArr[0] + dateArr[1],
                                value: "Payment_" + value[key1].entityid + "_Navan reimbursement " + "2025" + month,
                            });
                            JNRecord.setCurrentSublistText({
                                sublistId: sublistId,
                                fieldId: "custcol_swc_jon_employee",
                                text: value[key1].entityid,
                            });
                            JNRecord.commitLine({sublistId: sublistId});
                        }
                    }
                    log.audit('debitSum5',debitSum)
                    if(debitSum>0){
                        //生成3行合计
                        // JNRecord.selectNewLine({
                        //     sublistId: sublistId
                        // });
                        // JNRecord.setCurrentSublistValue({
                        //     sublistId: sublistId,
                        //     fieldId: "account",
                        //     value: 1308,
                        //     ignoreFieldChange: false
                        // });
                        // JNRecord.setCurrentSublistValue({
                        //     sublistId: sublistId,
                        //     fieldId: "credit",
                        //     value: debitSum,
                        //     ignoreFieldChange: false
                        // });
                        // JNRecord.commitLine({sublistId: sublistId});
                        //
                        // JNRecord.selectNewLine({
                        //     sublistId: sublistId
                        // });
                        // JNRecord.setCurrentSublistValue({
                        //     sublistId: sublistId,
                        //     fieldId: "account",
                        //     value: 1308,
                        //     ignoreFieldChange: false
                        // });
                        // JNRecord.setCurrentSublistValue({
                        //     sublistId: sublistId,
                        //     fieldId: "debit",
                        //     value: debitSum,
                        //     ignoreFieldChange: false
                        // });
                        // JNRecord.commitLine({sublistId: sublistId});
                        JNRecord.selectNewLine({
                            sublistId: sublistId
                        });
                        JNRecord.setCurrentSublistValue({
                            sublistId: sublistId,
                            fieldId: "account",
                            value: 1310,
                            ignoreFieldChange: false
                        });
                        JNRecord.setCurrentSublistValue({
                            sublistId: sublistId,
                            fieldId: "credit",
                            value: debitSum,
                            ignoreFieldChange: false
                        });
                        JNRecord.setCurrentSublistValue({
                            sublistId: sublistId,
                            fieldId: "memo",
                            // value: "Payment_Navan reimbursement " + dateArr[0] + dateArr[1] + "_PINGCAP PTE. LTD. Representative Payment to PingCAP (US), Inc.",
                            value: "Payment_Navan reimbursement " + "2025" + month + "_Pingcap US payment on behalf",//"_PINGCAP PTE. LTD. Representative Payment to PingCAP (US), Inc.",
                            ignoreFieldChange: false
                        });
                        JNRecord.setCurrentSublistValue({
                            sublistId: sublistId,
                            fieldId: "entity",
                            value: 2133,//往来名称：公司间交易供应商
                            ignoreFieldChange: false
                        });
                        JNRecord.setCurrentSublistValue({
                            sublistId:sublistId,
                            fieldId: "eliminate",
                            value: true,
                            ignoreFieldChange: false
                        });
                        JNRecord.commitLine({sublistId: sublistId});
                    }
                    if(reverseSum>0){
                        //生成3行合计
                        // JNRecord.selectNewLine({
                        //     sublistId: sublistId
                        // });
                        // JNRecord.setCurrentSublistValue({
                        //     sublistId: sublistId,
                        //     fieldId: "account",
                        //     value: 1308,
                        //     ignoreFieldChange: false
                        // });
                        // JNRecord.setCurrentSublistValue({
                        //     sublistId: sublistId,
                        //     fieldId: "debit",
                        //     value: reverseSum,
                        //     ignoreFieldChange: false
                        // });
                        // JNRecord.commitLine({sublistId: sublistId});
                        //
                        // JNRecord.selectNewLine({
                        //     sublistId: sublistId
                        // });
                        // JNRecord.setCurrentSublistValue({
                        //     sublistId: sublistId,
                        //     fieldId: "account",
                        //     value: 1308,
                        //     ignoreFieldChange: false
                        // });
                        // JNRecord.setCurrentSublistValue({
                        //     sublistId: sublistId,
                        //     fieldId: "credit",
                        //     value: reverseSum,
                        //     ignoreFieldChange: false
                        // });
                        // JNRecord.commitLine({sublistId: sublistId});
                        JNRecord.selectNewLine({
                            sublistId: sublistId
                        });
                        JNRecord.setCurrentSublistValue({
                            sublistId: sublistId,
                            fieldId: "account",
                            value: 1310,
                            ignoreFieldChange: false
                        });
                        JNRecord.setCurrentSublistValue({
                            sublistId: sublistId,
                            fieldId: "debit",
                            value: reverseSum,
                            ignoreFieldChange: false
                        });
                        JNRecord.setCurrentSublistValue({
                            sublistId: sublistId,
                            fieldId: "memo",
                            // value: "Payment_Navan reimbursement " + dateArr[0] + dateArr[1] + "_PINGCAP PTE. LTD. Representative Payment to PingCAP (US), Inc.",
                            value: "Payment_Navan reimbursement " + "2025" + month + "_Pingcap US payment on behalf",//"_PINGCAP PTE. LTD. Representative Payment to PingCAP (US), Inc.",
                            ignoreFieldChange: false
                        });
                        JNRecord.setCurrentSublistValue({
                            sublistId: sublistId,
                            fieldId: "entity",
                            value: 2133,//往来名称：公司间交易供应商
                            ignoreFieldChange: false
                        });
                        JNRecord.setCurrentSublistValue({
                            sublistId:sublistId,
                            fieldId: "eliminate",
                            value: true,
                            ignoreFieldChange: false
                        });
                        JNRecord.commitLine({sublistId: sublistId});
                    }
                    recordId = JNRecord.save({
                        enableSourcing: true,
                        ignoreMandatoryFields: true
                    });
                    log.audit('SG_recordId',recordId)
                    if(recordId){
                        var this_record = record.create({
                            type: 'journalentry',
                            isDynamic: true,
                            defaultValues:{customform:107}
                        });
                        this_record.setValue({
                            fieldId: "subsidiary",
                            value: 6
                        });

                        this_record.setValue({
                            fieldId: "currency",
                            value: key[2]
                        });
                        //目标子公司
                        this_record.setValue({
                            fieldId: "tosubsidiary",
                            value: 8
                        });
                        var time = new Date();
                        var month = Number(time.getMonth());
                        if(month.toString().length == 1)month = "0" + month;
                        this_record.setValue({
                            fieldId: "trandate",
                            value: format.parse({
                                value: time,
                                type: format.Type.DATE
                            })
                        });
                        this_record.setValue({
                            fieldId: "memo",
                            // value: "Payment_Navan reimbursement "+ dateArr[0] + dateArr[1]+ "_PingCAP (US), Inc. Representative Payment to PINGCAP PTE. LTD."
                            value: "Payment_Navan reimbursement "+ "2025" + month+ "_PingCAP (US), Inc. Representative Payment to PINGCAP PTE. LTD."
                        });

                        //来源平台设置9
                        this_record.setValue({
                            fieldId: "custbody_swc_platform",
                            value: 9
                        });
                        //NAVAN业务类型
                        this_record.setValue({
                            fieldId: "custbody_swc_navan_type",
                            value: key[4]
                        });
                        var sublistId="line"
                        //借：其他应收内部往来
                        this_record.selectNewLine({
                            sublistId: sublistId
                        });
                        this_record.setCurrentSublistValue({
                            sublistId: sublistId,
                            fieldId: "account",
                            value: 1248,
                            ignoreFieldChange: false
                        });
                        this_record.setCurrentSublistValue({
                            sublistId: sublistId,
                            fieldId: "debit",
                            value: debitSum-reverseSum,
                            ignoreFieldChange: false
                        });
                        this_record.setCurrentSublistValue({
                            sublistId: sublistId,
                            fieldId: "memo",
                            // value: "Payment_Navan reimbursement "+ dateArr[0] + dateArr[1]+ "_PingCAP (US), Inc. Representative Payment to PINGCAP PTE. LTD.",
                            value: "Payment_Navan reimbursement "+ "2025" + month+ "_PingCAP (US), Inc. Representative Payment to PINGCAP PTE. LTD.",//"_Pingcap US payment on behalf",//
                            ignoreFieldChange: false
                        });
                        this_record.setCurrentSublistValue({
                            sublistId: sublistId,
                            fieldId: "entity",
                            value: 69655,//往来名称：公司间交易供应商
                            ignoreFieldChange: false
                        });
                        this_record.setCurrentSublistValue({
                            sublistId:sublistId,
                            fieldId: "eliminate",
                            value: true,
                            ignoreFieldChange: false
                        });
                        this_record.commitLine({sublistId: sublistId});
                        //贷：银行：银行_美国花旗
                        this_record.selectNewLine({
                            sublistId: sublistId
                        });
                        this_record.setCurrentSublistValue({
                            sublistId: sublistId,
                            fieldId: "account",
                            value: 3485,
                            ignoreFieldChange: false
                        });
                        this_record.setCurrentSublistValue({
                            sublistId: sublistId,
                            fieldId: "credit",
                            value: debitSum-reverseSum,
                            ignoreFieldChange: false
                        });
                        this_record.setCurrentSublistValue({
                            sublistId: sublistId,
                            fieldId: "memo",
                            // value: "Payment_Navan reimbursement "+ dateArr[0] + dateArr[1]+ "_PingCAP (US), Inc. Representative Payment to PINGCAP PTE. LTD.",
                            value: "Payment_Navan reimbursement "+ "2025" + month+ "_PingCAP (US), Inc. Representative Payment to PINGCAP PTE. LTD.",//"_Pingcap US payment on behalf",//
                            ignoreFieldChange: false
                        });
                        this_record.commitLine({sublistId: sublistId});

                        // if(reverseSum>0){
                        //     //相反
                        //     this_record.selectNewLine({
                        //         sublistId: sublistId
                        //     });
                        //     this_record.setCurrentSublistValue({
                        //         sublistId: sublistId,
                        //         fieldId: "account",
                        //         value: 1248,
                        //         ignoreFieldChange: false
                        //     });
                        //     this_record.setCurrentSublistValue({
                        //         sublistId: sublistId,
                        //         fieldId: "credit",
                        //         value: reverseSum,
                        //         ignoreFieldChange: false
                        //     });
                        //     this_record.setCurrentSublistValue({
                        //         sublistId: sublistId,
                        //         fieldId: "memo",
                        //         value: "Payment_Navan reimbursement "+ dateArr[0] + dateArr[1]+ "_PingCAP (US), Inc. Representative Payment to PINGCAP PTE. LTD.",
                        //         ignoreFieldChange: false
                        //     });
                        //     this_record.setCurrentSublistValue({
                        //         sublistId: sublistId,
                        //         fieldId: "entity",
                        //         value: 1981,//往来名称：公司间交易供应商
                        //         ignoreFieldChange: false
                        //     });
                        //     this_record.setCurrentSublistValue({
                        //         sublistId:sublistId,
                        //         fieldId: "eliminate",
                        //         value: true,
                        //         ignoreFieldChange: false
                        //     });
                        //     this_record.commitLine({sublistId: sublistId});
                        //     //贷：银行：银行_美国花旗
                        //     this_record.selectNewLine({
                        //         sublistId: sublistId
                        //     });
                        //     this_record.setCurrentSublistValue({
                        //         sublistId: sublistId,
                        //         fieldId: "account",
                        //         value: 3485,
                        //         ignoreFieldChange: false
                        //     });
                        //     this_record.setCurrentSublistValue({
                        //         sublistId: sublistId,
                        //         fieldId: "debit",
                        //         value: reverseSum,
                        //         ignoreFieldChange: false
                        //     });
                        //     this_record.setCurrentSublistValue({
                        //         sublistId: sublistId,
                        //         fieldId: "memo",
                        //         value: "Payment_Navan reimbursement "+ dateArr[0] + dateArr[1]+ "_PingCAP (US), Inc. Representative Payment to PINGCAP PTE. LTD.",
                        //         ignoreFieldChange: false
                        //     });
                        //     this_record.commitLine({sublistId: sublistId});
                        // }

                        var newJN_id=this_record.save({
                            enableSourcing: true,
                            ignoreMandatoryFields: true
                        });
                        //Navan公司间关联日记账
                        record.submitFields({
                            type: 'journalentry',
                            id: recordId,
                            values: {
                                custbody_swc_navan_interjouory: newJN_id
                            }
                        });
                        record.submitFields({//202503 add yyr
                            type: 'journalentry',
                            id: newJN_id,
                            values: {
                                custbody_swc_navan_interjouory: recordId
                            }
                        });
                    }
                }
                if(value[Object.keys(value)[0]]["country"]=="US"){
                    JNRecord = record.create({
                        type: 'journalentry',
                        isDynamic: true,
                        defaultValues:{customform:107}
                    });
                    JNRecord.setValue({
                        fieldId: "subsidiary",
                        value: key[0]
                    });
                    JNRecord.setValue({
                        fieldId: "currency",
                        value: key[2]
                    });
                    var time = new Date();
                    var month = Number(time.getMonth());
                    if(month.toString().length == 1)month = "0" + month;
                    JNRecord.setValue({
                        fieldId: "trandate",
                        value: format.parse({
                            value: time,
                            type: format.Type.DATE
                        })
                    });
                    var dateArr = formatDate(new Date(),format);
                    if (dateArr.length > 0) {
                        JNRecord.setValue({
                            fieldId: "memo",
                            // value: "Navan reimbursement " + dateArr[0] + dateArr[1]
                            value: "Navan reimbursement " + "2025" + month
                        });
                    }
                    //来源平台设置9
                    JNRecord.setValue({
                        fieldId: "custbody_swc_platform",
                        value: 9
                    });
                    //NAVAN业务类型
                    JNRecord.setValue({
                        fieldId: "custbody_swc_navan_type",
                        value: key[4]
                    });
                    var sublistId="line"
                    var debitSum = 0;//借zong
                    var reverseSum = 0;//negative_cost
                    for(let key1 in value){
                        if(value[key1].hasOwnProperty("expenseaccount")&&value[key1].debitfxamount){
                            JNRecord.selectNewLine({
                                sublistId: sublistId
                            });
                            JNRecord.setCurrentSublistValue({
                                sublistId: sublistId,
                                fieldId: "account",
                                value: value[key1].expenseaccount,
                                ignoreFieldChange: false
                            });
                            if(value[key1]["negative_cost"]){
                                if (value[key1].debitfxamount) {
                                    JNRecord.setCurrentSublistValue({
                                        sublistId: sublistId,
                                        fieldId: "credit",
                                        value: value[key1].debitfxamount,
                                        ignoreFieldChange: false
                                    });
                                }
                            }else{
                                if (value[key1].debitfxamount) {
                                    JNRecord.setCurrentSublistValue({
                                        sublistId: sublistId,
                                        fieldId: "debit",
                                        value: value[key1].debitfxamount,
                                        ignoreFieldChange: false
                                    });
                                }
                            }
                            if (value[key1].department) {
                                JNRecord.setCurrentSublistValue({
                                    sublistId: sublistId,
                                    fieldId: "department",
                                    value: value[key1].department,
                                });
                            }
                            var curAccountName = JNRecord.getCurrentSublistText({
                                sublistId: sublistId,
                                fieldId: "account",
                            });
                            if (curAccountName.indexOf("研发") >= 0) {
                                JNRecord.setCurrentSublistValue({
                                    sublistId: sublistId,
                                    fieldId: "cseg_swc_pro",
                                    value: "1",
                                });
                            } else {
                                JNRecord.setCurrentSublistValue({
                                    sublistId: sublistId,
                                    fieldId: "cseg_swc_pro",
                                    value: "3",
                                });
                            }
                            JNRecord.setCurrentSublistValue({
                                sublistId: sublistId,
                                fieldId: "cseg_swc_region",
                                value: "10",
                            });
                            if (value[key1].entityid) {
                                // JNRecord.setCurrentSublistText({
                                //     sublistId: sublistId,
                                //     fieldId: "entity",
                                //     text: value[key1].entityid,
                                // });
                                JNRecord.setCurrentSublistText({
                                    sublistId: sublistId,
                                    fieldId: "custcol_swc_jon_employee",
                                    text: value[key1].entityid,
                                });
                            }
                            if (value[key1].memo) {
                                JNRecord.setCurrentSublistValue({
                                    sublistId: sublistId,
                                    fieldId: "memo",
                                    value: value[key1].memo,
                                });
                            }
                            JNRecord.commitLine({sublistId: sublistId});
                            if(value[key1]["negative_cost"]){
                                reverseSum+=Number(value[key1].debitfxamount)
                            }else{
                                debitSum+=Number(value[key1].debitfxamount)
                            }

                            //其他应付报销款
                            JNRecord.selectNewLine({
                                sublistId: sublistId
                            });
                            JNRecord.setCurrentSublistValue({
                                sublistId: sublistId,
                                fieldId: "account",
                                value: 1308,
                                ignoreFieldChange: false
                            });
                            if(value[key1]["negative_cost"]){
                                if (value[key1].debitfxamount) {
                                    JNRecord.setCurrentSublistValue({
                                        sublistId: sublistId,
                                        fieldId: "debit",
                                        value: value[key1].debitfxamount,
                                        ignoreFieldChange: false
                                    });
                                }
                            }else{
                                if (value[key1].debitfxamount) {
                                    JNRecord.setCurrentSublistValue({
                                        sublistId: sublistId,
                                        fieldId: "credit",
                                        value: value[key1].debitfxamount,
                                        ignoreFieldChange: false
                                    });
                                }
                            }
                            JNRecord.setCurrentSublistValue({
                                sublistId: sublistId,
                                fieldId: "memo",
                                // value: "Payment_" + value[key1].entityid + "_Navan reimbursement " + dateArr[0] + dateArr[1],
                                value: "Payment_" + value[key1].entityid + "_Navan reimbursement " + "2025" + month,
                            });
                            JNRecord.setCurrentSublistText({
                                sublistId: sublistId,
                                fieldId: "custcol_swc_jon_employee",
                                text: value[key1].entityid,
                            });
                            JNRecord.commitLine({sublistId: sublistId});

                            JNRecord.selectNewLine({
                                sublistId: sublistId
                            });
                            JNRecord.setCurrentSublistValue({
                                sublistId: sublistId,
                                fieldId: "account",
                                value: 1308,
                                ignoreFieldChange: false
                            });
                            if(value[key1]["negative_cost"]){
                                if (value[key1].debitfxamount) {
                                    JNRecord.setCurrentSublistValue({
                                        sublistId: sublistId,
                                        fieldId: "credit",
                                        value: value[key1].debitfxamount,
                                        ignoreFieldChange: false
                                    });
                                }
                            }else{
                                if (value[key1].debitfxamount) {
                                    JNRecord.setCurrentSublistValue({
                                        sublistId: sublistId,
                                        fieldId: "debit",
                                        value: value[key1].debitfxamount,
                                        ignoreFieldChange: false
                                    });
                                }
                            }
                            JNRecord.setCurrentSublistValue({
                                sublistId: sublistId,
                                fieldId: "memo",
                                // value: "Payment_" + value[key1].entityid + "_Navan reimbursement " + dateArr[0] + dateArr[1],
                                value: "Payment_" + value[key1].entityid + "_Navan reimbursement " + "2025" + month,
                            });
                            JNRecord.setCurrentSublistText({
                                sublistId: sublistId,
                                fieldId: "custcol_swc_jon_employee",
                                text: value[key1].entityid,
                            });
                            JNRecord.commitLine({sublistId: sublistId});
                        }
                    }
                    if(debitSum>0){
                        JNRecord.selectNewLine({
                            sublistId: sublistId
                        });
                        JNRecord.setCurrentSublistValue({
                            sublistId: sublistId,
                            fieldId: "account",
                            value: 3485,
                            ignoreFieldChange: false
                        });
                        JNRecord.setCurrentSublistValue({
                            sublistId: sublistId,
                            fieldId: "credit",
                            value: debitSum,
                            ignoreFieldChange: false
                        });
                        JNRecord.setCurrentSublistValue({
                            sublistId: sublistId,
                            fieldId: "memo",
                            // value: "Payment_Navan reimbursement " + dateArr[0] + dateArr[1],
                            value: "Payment_Navan reimbursement " + "2025" + month,
                            ignoreFieldChange: false
                        });
                        JNRecord.commitLine({sublistId: sublistId});
                    }
                    if(reverseSum>0){
                        JNRecord.selectNewLine({
                            sublistId: sublistId
                        });
                        JNRecord.setCurrentSublistValue({
                            sublistId: sublistId,
                            fieldId: "account",
                            value: 3485,
                            ignoreFieldChange: false
                        });
                        JNRecord.setCurrentSublistValue({
                            sublistId: sublistId,
                            fieldId: "debit",
                            value: reverseSum,
                            ignoreFieldChange: false
                        });
                        JNRecord.setCurrentSublistValue({
                            sublistId: sublistId,
                            fieldId: "memo",
                            // value: "Payment_Navan reimbursement " + dateArr[0] + dateArr[1],
                            value: "Payment_Navan reimbursement " + "2025" + month,
                            ignoreFieldChange: false
                        });
                        JNRecord.commitLine({sublistId: sublistId});
                    }
                    recordId = JNRecord.save({
                        enableSourcing: true,
                        ignoreMandatoryFields: true
                    });

                }
                if(value[Object.keys(value)[0]]["country"]=="MY"){
                    JNRecord = record.create({
                        type: 'journalentry',
                        isDynamic: true,
                    });
                    if( key[0] == 9) {
                        JNRecord.setValue({
                            fieldId: "subsidiary",
                            value: 25
                        });
                    }else {
                        JNRecord.setValue({
                            fieldId: "subsidiary",
                            value: key[0]
                        });
                    }
                    JNRecord.setValue({
                        fieldId: "currency",
                        value: key[2]
                    });
                    //目标子公司
                    JNRecord.setValue({
                        fieldId: "tosubsidiary",
                        value: 6
                    });
                    var time = new Date();
                    var month = Number(time.getMonth());
                    if(month.toString().length == 1)month = "0" + month;
                    JNRecord.setValue({
                        fieldId: "trandate",
                        value: format.parse({
                            value: time,
                            type: format.Type.DATE
                        })
                    });
                    var dateArr = formatDate(new Date(),format);
                    log.audit("dateArr",dateArr)
                    if (dateArr.length > 0) {
                        JNRecord.setValue({
                            fieldId: "memo",
                            // value: "Navan reimbursement " + dateArr[0] + dateArr[1]
                            value: "Navan reimbursement " + "2025" + month
                        });
                    }
                    //来源平台设置9
                    JNRecord.setValue({
                        fieldId: "custbody_swc_platform",
                        value: 9
                    });
                    //NAVAN业务类型
                    JNRecord.setValue({
                        fieldId: "custbody_swc_navan_type",
                        value: key[4]
                    });
                    var sublistId="line"
                    var debitSum = 0;//借zong
                    var reverseSum = 0;//negative_cost
                    for(let key1 in value){
                        if(value[key1].hasOwnProperty("expenseaccount")&&value[key1].debitfxamount){
                            JNRecord.selectNewLine({
                                sublistId: sublistId
                            });
                            JNRecord.setCurrentSublistValue({
                                sublistId: sublistId,
                                fieldId: "account",
                                value: value[key1].expenseaccount,
                                ignoreFieldChange: false
                            });
                            if(value[key1]["negative_cost"]){
                                if (value[key1].debitfxamount) {
                                    JNRecord.setCurrentSublistValue({
                                        sublistId: sublistId,
                                        fieldId: "credit",
                                        value: value[key1].debitfxamount,
                                        ignoreFieldChange: false
                                    });
                                }
                            }else{
                                if (value[key1].debitfxamount) {
                                    JNRecord.setCurrentSublistValue({
                                        sublistId: sublistId,
                                        fieldId: "debit",
                                        value: value[key1].debitfxamount,
                                        ignoreFieldChange: false
                                    });
                                }
                            }
                            if (value[key1].department) {
                                JNRecord.setCurrentSublistValue({
                                    sublistId: sublistId,
                                    fieldId: "department",
                                    value: value[key1].department,
                                });
                            }
                            var curAccountName = JNRecord.getCurrentSublistText({
                                sublistId: sublistId,
                                fieldId: "account",
                            });
                            if (curAccountName.indexOf("研发") >= 0) {
                                JNRecord.setCurrentSublistValue({
                                    sublistId: sublistId,
                                    fieldId: "cseg_swc_pro",
                                    value: "1",
                                });
                            } else {
                                JNRecord.setCurrentSublistValue({
                                    sublistId: sublistId,
                                    fieldId: "cseg_swc_pro",
                                    value: "3",
                                });
                            }
                            JNRecord.setCurrentSublistValue({
                                sublistId: sublistId,
                                fieldId: "cseg_swc_region",
                                value: "11",
                            });
                            if (value[key1].entityid) {
                                // JNRecord.setCurrentSublistText({
                                //     sublistId: sublistId,
                                //     fieldId: "entity",
                                //     text: value[key1].entityid,
                                // });
                                JNRecord.setCurrentSublistText({
                                    sublistId: sublistId,
                                    fieldId: "custcol_swc_jon_employee",
                                    text: value[key1].entityid,
                                });
                            }
                            if (value[key1].memo) {
                                JNRecord.setCurrentSublistValue({
                                    sublistId: sublistId,
                                    fieldId: "memo",
                                    value: value[key1].memo,
                                });
                            }
                            JNRecord.commitLine({sublistId: sublistId});
                            if(value[key1]["negative_cost"]){
                                reverseSum+=Number(value[key1].debitfxamount)
                            }else{
                                debitSum+=Number(value[key1].debitfxamount)
                            }

                            //其他应付报销款
                            JNRecord.selectNewLine({
                                sublistId: sublistId
                            });
                            JNRecord.setCurrentSublistValue({
                                sublistId: sublistId,
                                fieldId: "account",
                                value: 1308,
                                ignoreFieldChange: false
                            });
                            if(value[key1]["negative_cost"]){
                                if (value[key1].debitfxamount) {
                                    JNRecord.setCurrentSublistValue({
                                        sublistId: sublistId,
                                        fieldId: "debit",
                                        value: value[key1].debitfxamount,
                                        ignoreFieldChange: false
                                    });
                                }
                            }else{
                                if (value[key1].debitfxamount) {
                                    JNRecord.setCurrentSublistValue({
                                        sublistId: sublistId,
                                        fieldId: "credit",
                                        value: value[key1].debitfxamount,
                                        ignoreFieldChange: false
                                    });
                                }
                            }
                            JNRecord.setCurrentSublistValue({
                                sublistId: sublistId,
                                fieldId: "memo",
                                // value: "Payment_" + value[key1].entityid + "_Navan reimbursement " + dateArr[0] + dateArr[1],
                                value: "Payment_" + value[key1].entityid + "_Navan reimbursement " + "2025" + month,
                            });
                            JNRecord.setCurrentSublistText({
                                sublistId: sublistId,
                                fieldId: "custcol_swc_jon_employee",
                                text: value[key1].entityid,
                            });
                            JNRecord.commitLine({sublistId: sublistId});

                            JNRecord.selectNewLine({
                                sublistId: sublistId
                            });
                            JNRecord.setCurrentSublistValue({
                                sublistId: sublistId,
                                fieldId: "account",
                                value: 1308,
                                ignoreFieldChange: false
                            });
                            if(value[key1]["negative_cost"]){
                                if (value[key1].debitfxamount) {
                                    JNRecord.setCurrentSublistValue({
                                        sublistId: sublistId,
                                        fieldId: "credit",
                                        value: value[key1].debitfxamount,
                                        ignoreFieldChange: false
                                    });
                                }
                            }else{
                                if (value[key1].debitfxamount) {
                                    JNRecord.setCurrentSublistValue({
                                        sublistId: sublistId,
                                        fieldId: "debit",
                                        value: value[key1].debitfxamount,
                                        ignoreFieldChange: false
                                    });
                                }
                            }
                            JNRecord.setCurrentSublistValue({
                                sublistId: sublistId,
                                fieldId: "memo",
                                // value: "Payment_" + value[key1].entityid + "_Navan reimbursement " + dateArr[0] + dateArr[1],
                                value: "Payment_" + value[key1].entityid + "_Navan reimbursement " + "2025" + month,
                            });
                            JNRecord.setCurrentSublistText({
                                sublistId: sublistId,
                                fieldId: "custcol_swc_jon_employee",
                                text: value[key1].entityid,
                            });
                            JNRecord.commitLine({sublistId: sublistId});
                        }
                    }
                    log.audit('debitSum1678',debitSum)
                    log.audit('reverseSum',reverseSum)
                    if(debitSum>0){
                        //生成3行合计
                        // JNRecord.selectNewLine({
                        //     sublistId: sublistId
                        // });
                        // JNRecord.setCurrentSublistValue({
                        //     sublistId: sublistId,
                        //     fieldId: "account",
                        //     value: 1308,
                        //     ignoreFieldChange: false
                        // });
                        // JNRecord.setCurrentSublistValue({
                        //     sublistId: sublistId,
                        //     fieldId: "credit",
                        //     value: debitSum,
                        //     ignoreFieldChange: false
                        // });
                        // JNRecord.commitLine({sublistId: sublistId});
                        //
                        // JNRecord.selectNewLine({
                        //     sublistId: sublistId
                        // });
                        // JNRecord.setCurrentSublistValue({
                        //     sublistId: sublistId,
                        //     fieldId: "account",
                        //     value: 1308,
                        //     ignoreFieldChange: false
                        // });
                        // JNRecord.setCurrentSublistValue({
                        //     sublistId: sublistId,
                        //     fieldId: "debit",
                        //     value: debitSum,
                        //     ignoreFieldChange: false
                        // });
                        // JNRecord.commitLine({sublistId: sublistId});
                        JNRecord.selectNewLine({
                            sublistId: sublistId
                        });
                        JNRecord.setCurrentSublistValue({
                            sublistId: sublistId,
                            fieldId: "account",
                            value: 1310,
                            ignoreFieldChange: false
                        });
                        JNRecord.setCurrentSublistValue({
                            sublistId: sublistId,
                            fieldId: "credit",
                            value: debitSum,
                            ignoreFieldChange: false
                        });
                        JNRecord.setCurrentSublistValue({
                            sublistId: sublistId,
                            fieldId: "memo",
                            // value: "Payment_Navan reimbursement " + dateArr[0] + dateArr[1] + "_PINGCAP PTE. LTD. Representative Payment to PingCAP (US), Inc.",
                            value: "Payment_Navan reimbursement " + "2025" + month + "_Pingcap US payment on behalf",//"_PINGCAP PTE. LTD. Representative Payment to PingCAP (US), Inc.",
                            ignoreFieldChange: false
                        });
                        JNRecord.setCurrentSublistValue({
                            sublistId: sublistId,
                            fieldId: "entity",
                            value: 2133,//往来名称：公司间交易供应商
                            ignoreFieldChange: false
                        });
                        JNRecord.setCurrentSublistValue({
                            sublistId:sublistId,
                            fieldId: "eliminate",
                            value: true,
                            ignoreFieldChange: false
                        });
                        JNRecord.commitLine({sublistId: sublistId});
                    }
                    if(reverseSum>0){
                        //生成3行合计
                        // JNRecord.selectNewLine({
                        //     sublistId: sublistId
                        // });
                        // JNRecord.setCurrentSublistValue({
                        //     sublistId: sublistId,
                        //     fieldId: "account",
                        //     value: 1308,
                        //     ignoreFieldChange: false
                        // });
                        // JNRecord.setCurrentSublistValue({
                        //     sublistId: sublistId,
                        //     fieldId: "debit",
                        //     value: reverseSum,
                        //     ignoreFieldChange: false
                        // });
                        // JNRecord.commitLine({sublistId: sublistId});
                        //
                        // JNRecord.selectNewLine({
                        //     sublistId: sublistId
                        // });
                        // JNRecord.setCurrentSublistValue({
                        //     sublistId: sublistId,
                        //     fieldId: "account",
                        //     value: 1308,
                        //     ignoreFieldChange: false
                        // });
                        // JNRecord.setCurrentSublistValue({
                        //     sublistId: sublistId,
                        //     fieldId: "credit",
                        //     value: reverseSum,
                        //     ignoreFieldChange: false
                        // });
                        // JNRecord.commitLine({sublistId: sublistId});
                        JNRecord.selectNewLine({
                            sublistId: sublistId
                        });
                        JNRecord.setCurrentSublistValue({
                            sublistId: sublistId,
                            fieldId: "account",
                            value: 1310,
                            ignoreFieldChange: false
                        });
                        JNRecord.setCurrentSublistValue({
                            sublistId: sublistId,
                            fieldId: "debit",
                            value: reverseSum,
                            ignoreFieldChange: false
                        });
                        JNRecord.setCurrentSublistValue({
                            sublistId: sublistId,
                            fieldId: "memo",
                            // value: "Payment_Navan reimbursement " + dateArr[0] + dateArr[1] + "_PINGCAP PTE. LTD. Representative Payment to PingCAP (US), Inc.",
                            value: "Payment_Navan reimbursement " + "2025" + month + "_Pingcap US payment on behalf",//"_PINGCAP PTE. LTD. Representative Payment to PingCAP (US), Inc.",
                            ignoreFieldChange: false
                        });
                        JNRecord.setCurrentSublistValue({
                            sublistId: sublistId,
                            fieldId: "entity",
                            value: 2133,//往来名称：公司间交易供应商
                            ignoreFieldChange: false
                        });
                        JNRecord.setCurrentSublistValue({
                            sublistId:sublistId,
                            fieldId: "eliminate",
                            value: true,
                            ignoreFieldChange: false
                        });
                        JNRecord.commitLine({sublistId: sublistId});
                    }
                    recordId = JNRecord.save({
                        enableSourcing: true,
                        ignoreMandatoryFields: true
                    });
                    log.audit('MY_recordId',recordId)
                    if(recordId){
                        var this_record = record.create({
                            type: 'journalentry',
                            isDynamic: true,
                            defaultValues:{customform:107}
                        });
                        this_record.setValue({
                            fieldId: "subsidiary",
                            value: 6
                        });

                        this_record.setValue({
                            fieldId: "currency",
                            value: key[2]
                        });
                        //目标子公司
                        this_record.setValue({
                            fieldId: "tosubsidiary",
                            value: 25
                        });
                        var time = new Date();
                        var month = Number(time.getMonth());
                        if(month.toString().length == 1)month = "0" + month;
                        this_record.setValue({
                            fieldId: "trandate",
                            value: format.parse({
                                value: time,
                                type: format.Type.DATE
                            })
                        });
                        this_record.setValue({
                            fieldId: "memo",
                            // value: "Payment_Navan reimbursement "+ dateArr[0] + dateArr[1]+ "_PingCAP (US), Inc. Representative Payment to PINGCAP PTE. LTD."
                            value: "Payment_Navan reimbursement "+ "2025" + month+ "_PingCAP (US), Inc. Representative Payment to PINGCAP PTE. LTD."
                        });

                        //来源平台设置9
                        this_record.setValue({
                            fieldId: "custbody_swc_platform",
                            value: 9
                        });
                        //NAVAN业务类型
                        this_record.setValue({
                            fieldId: "custbody_swc_navan_type",
                            value: key[4]
                        });
                        var sublistId="line"
                        //借：其他应收内部往来
                        this_record.selectNewLine({
                            sublistId: sublistId
                        });
                        this_record.setCurrentSublistValue({
                            sublistId: sublistId,
                            fieldId: "account",
                            value: 1248,
                            ignoreFieldChange: false
                        });
                        this_record.setCurrentSublistValue({
                            sublistId: sublistId,
                            fieldId: "debit",
                            value: debitSum-reverseSum,
                            ignoreFieldChange: false
                        });
                        this_record.setCurrentSublistValue({
                            sublistId: sublistId,
                            fieldId: "memo",
                            // value: "Payment_Navan reimbursement "+ dateArr[0] + dateArr[1]+ "_PingCAP (US), Inc. Representative Payment to PINGCAP PTE. LTD.",
                            value: "Payment_Navan reimbursement "+ "2025" + month+ "_PingCAP (US), Inc. Representative Payment to PINGCAP PTE. LTD.",//"_Pingcap US payment on behalf",//
                            ignoreFieldChange: false
                        });
                        this_record.setCurrentSublistValue({
                            sublistId: sublistId,
                            fieldId: "entity",
                            value: 69655,//往来名称：公司间交易供应商
                            ignoreFieldChange: false
                        });
                        this_record.setCurrentSublistValue({
                            sublistId:sublistId,
                            fieldId: "eliminate",
                            value: true,
                            ignoreFieldChange: false
                        });
                        this_record.commitLine({sublistId: sublistId});
                        //贷：银行：银行_美国花旗
                        this_record.selectNewLine({
                            sublistId: sublistId
                        });
                        this_record.setCurrentSublistValue({
                            sublistId: sublistId,
                            fieldId: "account",
                            value: 3485,
                            ignoreFieldChange: false
                        });
                        this_record.setCurrentSublistValue({
                            sublistId: sublistId,
                            fieldId: "credit",
                            value: debitSum-reverseSum,
                            ignoreFieldChange: false
                        });
                        this_record.setCurrentSublistValue({
                            sublistId: sublistId,
                            fieldId: "memo",
                            // value: "Payment_Navan reimbursement "+ dateArr[0] + dateArr[1]+ "_PingCAP (US), Inc. Representative Payment to PINGCAP PTE. LTD.",
                            value: "Payment_Navan reimbursement "+ "2025" + month+ "_PingCAP (US), Inc. Representative Payment to PINGCAP PTE. LTD.",//"_Pingcap US payment on behalf",//
                            ignoreFieldChange: false
                        });
                        this_record.commitLine({sublistId: sublistId});

                        // if(reverseSum>0){
                        //     //相反
                        //     this_record.selectNewLine({
                        //         sublistId: sublistId
                        //     });
                        //     this_record.setCurrentSublistValue({
                        //         sublistId: sublistId,
                        //         fieldId: "account",
                        //         value: 1248,
                        //         ignoreFieldChange: false
                        //     });
                        //     this_record.setCurrentSublistValue({
                        //         sublistId: sublistId,
                        //         fieldId: "credit",
                        //         value: reverseSum,
                        //         ignoreFieldChange: false
                        //     });
                        //     this_record.setCurrentSublistValue({
                        //         sublistId: sublistId,
                        //         fieldId: "memo",
                        //         value: "Payment_Navan reimbursement "+ dateArr[0] + dateArr[1]+ "_PingCAP (US), Inc. Representative Payment to PINGCAP PTE. LTD.",
                        //         ignoreFieldChange: false
                        //     });
                        //     this_record.setCurrentSublistValue({
                        //         sublistId: sublistId,
                        //         fieldId: "entity",
                        //         value: 1981,//往来名称：公司间交易供应商
                        //         ignoreFieldChange: false
                        //     });
                        //     this_record.setCurrentSublistValue({
                        //         sublistId:sublistId,
                        //         fieldId: "eliminate",
                        //         value: true,
                        //         ignoreFieldChange: false
                        //     });
                        //     this_record.commitLine({sublistId: sublistId});
                        //     //贷：银行：银行_美国花旗
                        //     this_record.selectNewLine({
                        //         sublistId: sublistId
                        //     });
                        //     this_record.setCurrentSublistValue({
                        //         sublistId: sublistId,
                        //         fieldId: "account",
                        //         value: 3485,
                        //         ignoreFieldChange: false
                        //     });
                        //     this_record.setCurrentSublistValue({
                        //         sublistId: sublistId,
                        //         fieldId: "debit",
                        //         value: reverseSum,
                        //         ignoreFieldChange: false
                        //     });
                        //     this_record.setCurrentSublistValue({
                        //         sublistId: sublistId,
                        //         fieldId: "memo",
                        //         value: "Payment_Navan reimbursement "+ dateArr[0] + dateArr[1]+ "_PingCAP (US), Inc. Representative Payment to PINGCAP PTE. LTD.",
                        //         ignoreFieldChange: false
                        //     });
                        //     this_record.commitLine({sublistId: sublistId});
                        // }

                        var newJN_id=this_record.save({
                            enableSourcing: true,
                            ignoreMandatoryFields: true
                        });
                        //Navan公司间关联日记账
                        record.submitFields({
                            type: 'journalentry',
                            id: recordId,
                            values: {
                                custbody_swc_navan_interjouory: newJN_id
                            }
                        });
                        record.submitFields({//202503 add yyr
                            type: 'journalentry',
                            id: newJN_id,
                            values: {
                                custbody_swc_navan_interjouory: recordId
                            }
                        });
                    }
                }
            }
            return recordId

        }

        function getAllData() {
            try{
                var itemObj=getAccount()
                var dataList=getExpensereportData(itemObj)
                log.audit({
                    title: "itemObj",
                    details: itemObj
                });
                var resultObj = {};
                dataList.forEach(item => {
                    const key = item['sign'];
                    if (!resultObj[key]) {
                        resultObj[key] = {};
                    }
                    resultObj[key][item['id']]=item
                });

                log.audit({
                    title: "resultObj",
                    details: resultObj
                });
                return resultObj
            } catch (error) {
                log.audit("error", error)
            }
        }

        function getExpensereportData(itemObj) {
            var expensereportSearchObj = search.create({
                type: "expensereport",
                settings:[{"name":"consolidationtype","value":"NONE"}],
                filters:
                    [
                        ["type","anyof","ExpRept"],
                        "AND",
                        ["taxline","is","F"],
                        "AND",
                        ["mainline","is","F"],
                        "AND",
                        ["custbody_swc_navan_flag","is","T"],
                        "AND",
                        ["custbody_swc_related_journal","anyof","@NONE@"],
                        "AND",
                        ["custbody_swc_completed_navan","is","T"],
                        "AND",
                        ["trandate","onorafter","10/01/2025"],
                        "AND",
                        ["custbody_manually_created_journal","is","F"]
                    ],
                columns:
                    [
                        search.createColumn({name: "internalid", label: "内部 ID"}),
                        search.createColumn({name: "externalid", label: "外部 ID"}),
                        search.createColumn({name: "transactionnumber", label: "事务处理编号"}),
                        search.createColumn({name: "subsidiarynohierarchy", label: "子公司（无层次结构）"}),
                        search.createColumn({name: "trandate", label: "日期"}),
                        search.createColumn({name: "currency", label: "货币"}),
                        search.createColumn({name: "account", label: "科目"}),
                        search.createColumn({name: "exchangerate", label: "汇率"}),
                        search.createColumn({name: "debitfxamount", label: "金额（借记）（外币）"}),
                        search.createColumn({name: "creditfxamount", label: "金额（贷记）（外币）"}),
                        search.createColumn({name: "amount", label: "金额"}),
                        search.createColumn({name: "entityid",join: "employee",label: "名称"}),
                        search.createColumn({name: "department", label: "部门"}),
                        search.createColumn({name: "custbody_swc_navan_type", label: "Navan业务类型"}),
                        search.createColumn({name: "custbody_swc_statement_id", label: "STATEMENT ID"}),
                        search.createColumn({name: "custbody_swc_navan_id", label: "Navan id"}),
                        search.createColumn({name: "taxamount", label: "金额（税）"}),
                        search.createColumn({name: "expensecategory", label: "费用类别"}),
                        search.createColumn({name: "custrecord_swc_department_type", join: "department", label: "部门类型"}),
                        search.createColumn({name: "country", join: "subsidiary", label: "国家/地区"}),
                        search.createColumn({name: "custbody_swc_negative_cost", label: "负数费用报告"}),
                        search.createColumn({name: "internalid", join: "taxItem", label: "税码"}),
                        search.createColumn({name: "rate", join: "taxItem", label: "税率"}),
                        search.createColumn({name: "memo", join: "expenseDetail", label: "备注"}),
                    ]
            });
            var searchResultCount = expensereportSearchObj.runPaged().count;
            log.audit("transactionSearchObj result count----------",searchResultCount);
            var result = getAllResultsOfSearch(expensereportSearchObj);
            var dataList=[]
            if(result.length > 0){
                for(var i = 0; i < result.length; i++) {
                    const item={}
                    item.id = result[i].getValue({name: "internalid"});
                    item.transactionnumber = result[i].getValue({name: "transactionnumber"});
                    item.subsidiary = result[i].getValue({name: "subsidiarynohierarchy"});
                    item.trandate = result[i].getValue({name: "trandate"});
                    var dateArr = formatDate(result[i].getValue({name: "trandate"}),format);
                    if (dateArr.length > 0) {
                        item.trandate_text = dateArr[1]
                    }
                    item.currency = result[i].getValue({name: "currency"});
                    item.account = result[i].getValue({name: "account"});
                    item.exchangerate = result[i].getValue({name: "exchangerate"});
                    item.debitfxamount = result[i].getValue({name: "debitfxamount"});
                    item.creditfxamount = result[i].getValue({name: "creditfxamount"});
                    item.amount = result[i].getValue({name: "amount"});
                    item.entityid = result[i].getValue({name: "entityid",join: "employee"});
                    item.department = result[i].getValue({name: "department"});
                    item.navan_type = result[i].getValue({name: "custbody_swc_navan_type"});
                    item.statement_id = result[i].getValue({name: "custbody_swc_statement_id"});
                    item.navan_id = result[i].getValue({name: "custbody_swc_navan_id"});
                    item.externalid = result[i].getValue({name: "externalid"});
                    item.taxamount = result[i].getValue({name: "taxamount"});
                    item.expensecategory = result[i].getValue({name: "expensecategory"});
                    item.expensecategory_text = result[i].getText({name: "expensecategory"});
                    const firstSpaceIndex = item.expensecategory_text.indexOf(' ');
                    item.department_type = result[i].getValue({name: "custrecord_swc_department_type",join: "department"});
                    item.department_type_text = result[i].getText({name: "custrecord_swc_department_type",join: "department"});
                    // 1111 Desktop/1112 Laptop/1113 Monitor/1114 Computer periphery这4种费用类别只根据费用类别名称匹配费用科目
                    if (['1111 Desktop', '1112 Laptop', '1113 Monitor', '1114 Computer periphery'].includes(item.expensecategory_text)) {
                        var text = item.expensecategory_text.substring(firstSpaceIndex + 1);
                    }
                    else {
                        var text = item.expensecategory_text.substring(firstSpaceIndex + 1)+" (" + item.department_type_text + ")";
                    }
                    // log.error("item.department_type_text",item.department_type_text)
                    // log.error("text",text)
                    // log.error("itemObj.hasOwnProperty(text)",itemObj.hasOwnProperty(text))
                    // log.error("itemObj[text]",itemObj[text])
                    if(/*item.department_type_text&&*/itemObj.hasOwnProperty(text))item.expenseaccount=itemObj[text].expenseaccount
                    if (item.subsidiary ==28) {
                        item.subsidiary = 8
                    }
                    if (item.subsidiary ==25) {
                        item.subsidiary = 9
                    }
                    item.sign = item.subsidiary+"_"+item.currency+"_"+item.navan_type
                    item.country = result[i].getValue({name: "country",join: "subsidiary"});
                    item.negative_cost = result[i].getValue({name: "custbody_swc_negative_cost",})||'';
                    item.taxcode = result[i].getValue({name: "internalid",join: "taxItem"})||'';
                    item.taxrate = result[i].getValue({name: "rate",join: "taxItem"})||'';
                    item.memo = result[i].getValue({name: "memo",join: "expenseDetail"})||'';
                    dataList.push(item)
                }
            }

            /*var filteredData = dataList.filter(item => item.trandate_text === "09" || item.trandate_text === "10");
            log.audit("filteredData.length",filteredData.length)
            return filteredData;*/
            log.audit("dataList.length",dataList.length);
            return dataList;
        }

        function getAccount() {
            var itemSearchObj = search.create({
                type: "serviceitem",
                filters:
                    [["type","anyof","Service"]],
                columns:
                    [
                        search.createColumn({name: "itemid", label: "名称"}),
                        search.createColumn({name: "internalid", label: ""}),
                        search.createColumn({name: "type", label: "类型"}),
                        search.createColumn({name: "custitem_swc_department_type", label: "部门类型"}),
                        search.createColumn({name: "class", label: "类别"}),
                        search.createColumn({name: "name", label: ""}),
                        search.createColumn({name: "expenseaccount", label: "费用/销货成本科目"}),
                        search.createColumn({name: "custitem_swc_department_type", label: "部门类型"})
                    ]
            });
            var searchResultCount = itemSearchObj.runPaged().count;
            log.audit("transactionSearchObj result count===========",searchResultCount);
            var result = getAllResultsOfSearch(itemSearchObj);
            var dataObj={}
            if(result.length > 0){
                for(var i = 0; i < result.length; i++) {
                    var itemid= result[i].getValue({name: "itemid"})
                    const firstSpaceIndex = itemid.indexOf(' ');
                    const id = itemid.substring(firstSpaceIndex + 1);
                    if(!dataObj[id])dataObj[id]={}
                    dataObj[id]={
                        id:result[i].getValue({name: "internalid"}),
                        name:result[i].getValue({name: "name"}),
                        expenseaccount:result[i].getValue({name: "expenseaccount"}),
                    }
                }
            }
            return dataObj;
        }

        function srchJptaxAndRate() {
            var salestaxitemSearchObj = search.create({
                type: "salestaxitem",
                filters:
                    [
                    ],
                columns:
                    [
                        search.createColumn({name: "rate", label: ""}),
                        search.createColumn({name: "internalid", label: " ID"}),
                        search.createColumn({name: "custrecord_swc_jptax_formula", label: ""})
                    ]
            });

            var results = getAllResultsOfSearch(salestaxitemSearchObj);
            var json = {};
            results.forEach(function (value) {
                var rate = value.getValue({name: "rate", label: ""});
                var jptax = value.getValue({name: "custrecord_swc_jptax_formula", label: ""});
                var id = value.getValue({name: "internalid", label: " ID"});
                rate = Number(rate.replace(".00%",""));
                json[id] = {"rate":rate,"jptax":jptax?Number(jptax):""};
            });
            return json;
        }

        function divN(a, b) {
            a = parseFloatOrZero(a);
            b = parseFloatOrZero(b);
            return b && div(a, b);
        }

        function div(a, b) {
            a = toNonExponential(a);
            b = toNonExponential(b);
            var c,
                d,
                e = 0,
                f = 0;
            try {
                e = a.toString().split('.')[1].length;
            } catch (g) {}
            try {
                f = b.toString().split('.')[1].length;
            } catch (g) {}
            return (
                (c = Number(a.toString().replace('.', ''))),
                    (d = Number(b.toString().replace('.', ''))),
                    mul(c / d, Math.pow(10, f - e))
            );
        }

        /**
         * 浮点数乘法
         * @param {*} a
         * @param {*} b
         */
        function mul(a, b) {
            a = toNonExponential(a);
            b = toNonExponential(b);
            var c = 0,
                d = a.toString(),
                e = b.toString();
            try {
                c += d.split('.')[1].length;
            } catch (f) {}
            try {
                c += e.split('.')[1].length;
            } catch (f) {}
            return (
                (Number(d.replace('.', '')) * Number(e.replace('.', ''))) /
                Math.pow(10, c)
            );
        }

        function parseFloatOrZero(v) {
            return parseFloat(v) || 0;
        }

        function toNonExponential(num) {
            num = Number(num);
            var m = num.toExponential().match(/\d(?:.(\d*))?e([+-]\d+)/);
            return num.toFixed(Math.max(0, (m[1] || '').length - m[2]));
        }

        function getAllResultsOfSearch(saveSearch) {
            var resultset = saveSearch.run();
            var start = 0;
            var step = 1000;
            var resultArr = [];
            var results = resultset.getRange({
                start : start,
                end : Number(start) + Number(step)
            });
            while (results && results.length > 0) {
                resultArr = resultArr.concat(results);
                start = Number(start) + Number(step);
                results = resultset.getRange({
                    start : start,
                    end : Number(start) + Number(step)
                });
            }
            return resultArr;
        }

        function formatDate(date,format)
        {
            var ymArray = new Array();
            var d = new Date(format.parse({value:date, type: format.Type.DATETIMETZ})),
                month = '' + (d.getMonth() + 1),day = '' + d.getDate(),year = d.getFullYear();
            month = (month<10 ? "0"+month:month);
            day = (day<10?"0"+day:day);
            String(month).length < 2 ? (month = "0" + month): month;
            String(date).length < 2 ? (date = "0" + date): date;

            ymArray = [year, month, day];
            return ymArray;
        }

        return {
            getInputData,
            map,
            reduce,
            summarize
        }

    });
