/**
 * @NApiVersion 2.0
 * @NScriptType UserEventScript
 * @NModuleScope Public
 */


define(['N/record','N/search','N/format','N/https','../../common/Commons.js',"../../lib/underscore.js"],
    /**
     * ����ֱ���м��֧���ɹ��Ĳ���
     * @param record
     * @param search
     * @param format
     */
    function(record,search,format,https,Commons) {
        /**
         * Function definition to be triggered before record is loaded.
         *
         * @param {Object} scriptContext
         * @param {Record} scriptContext.newRecord - New record
         * @param {Record} scriptContext.oldRecord - Old record
         * @param {string} scriptContext.type - Trigger type
         * @Since 2015.2
         */
        function afterSubmit(scriptContext) {
            var newRec = scriptContext.newRecord;
            var oldRec = scriptContext.oldRecord;
            // У��һ�� ֻ��֧��״̬��һ�α��֧���ɹ��Ŵ���
            if(scriptContext.type == 'edit') {
                log.audit('22',22)
                var oldStatus = oldRec.getValue({fieldId:'custrecord_swcpp_state'});
                var newStatus = newRec.getValue({fieldId:'custrecord_swcpp_state'});
                if(newStatus == '1' && oldStatus != newStatus) {
                    log.audit('33',33)
                    var flowId = newRec.getValue({fieldId:'custrecord_swcpp_flowid'}); // ����id
                    var journalId = newRec.getValue({fieldId:'custrecord_swcpp_journalentry'}); // �ռ���
                    var recordType = newRec.getValue({fieldId:'custrecord_swcpp_recordtype'}); // ��������
                    var code = newRec.getValue({fieldId:'custrecord_swcpp_tranid'}); // ҵ��ο���
                    var fileId = newRec.getValue({fieldId:'custrecord_swcpp_fileid'}); // ͼƬid
                    var poName = newRec.getValue({fieldId:'custrecord_swcpp_po'}); // �ɹ���������
                    var famType = newRec.getValue({fieldId:'custrecord_swcpp_assettype'}); // �̶��ʲ�����
                    var vendor = newRec.getValue({fieldId:'custrecord_swcpp_vendor'}); // ��Ӧ��
                    var account = newRec.getValue({fieldId:'custrecord_swcpp_account'}); // �˻�
                    var money = newRec.getValue({fieldId:'custrecord_swcpp_amount'}); // ����֧�����
                    var updateStatus = newRec.getValue({fieldId:'custrecord_swcpp_updatesuccess'}); // ͬ���ɹ�
                    var titile = newRec.getValue({fieldId:'custrecord_swcpp_title'}); // ����
                    var subsidiary = newRec.getValue({fieldId:'custrecord_swcpp_subsidary'}); // �ӹ�˾
                    var employeeName = newRec.getValue({fieldId:'custrecord_swcpp_bankname'}); // Ա����
                    var bank = newRec.getValue({fieldId:'custrecord_swcpp_account'}); // ��������


                    // ���ýӿڸ��µ���
                    var platformRec = record.load({type:"customrecord_swc_platform",id:'7'});
                    var accessToken = platformRec.getValue({fieldId:"custrecord_swcp_session_key"});

                    var rec = record.load({type:"customrecord_swc_api",id:"60"});
                    var urlekuaibao = rec.getValue({fieldId:"custrecord_swca_url"});

                    try {
                        var header = {"Content-Type":"application/json","Accept":"application/json","User-Agent":"Mozilla/5.0"};
                        var urlObj = urlekuaibao + "/api/openapi/v1/paymentResults?accessToken="+accessToken;
                        var body = {"items":[{"id":flowId, "code":"P00001", "errorMsg":null}]}
                        log.audit('code',code)
                        var response = https.post({url:urlObj,headers:header,body:JSON.stringify(body)});
                        log.audit('response',JSON.stringify(response))
                        var responseBody = response && JSON.parse(response.body);
                        log.audit('responseBody',JSON.stringify(responseBody))

                        // ���³ɹ�
                        if(responseBody.items[0].code == "R00000" && !updateStatus) {
                            record.submitFields({type:"customrecord_swc_payment_platform",id:newRec.id,values:{"custrecord_swcpp_updatesuccess":true}});
                        }
                    } catch (e) {
                        log.audit('e',JSON.stringify(e))
                    }



                    var writeOffJournal = Commons.searchByExternalId("writeoff"+code,'journalentry');
                    var vendorpayment = Commons.searchByExternalId('vendorpayment'+code,'vendorpayment');
                    var vendorprepayment = Commons.searchByExternalId('vendorprepayment'+code,'vendorprepayment');
                    var serviceJournal = Commons.searchByExternalId('service'+code,'journalentry');
                    var zeroJournal = Commons.searchByExternalId('0'+code,'journalentry');

                    // ֧���ɹ��ĺ�������
                    if(Number(money) != 0) {
                        if(recordType == "������" || recordType == "�˵���" ) {
                            // ���ɺ����ռ���
                            if(!writeOffJournal) createWriteOffJournal(journalId,code,fileId,newRec.id,bank);
                        } else if(recordType == "��������") {
                            if(!poName && !famType) {
                                // ���û�вɹ���������û�й̶��ʲ�����
                                if(!writeOffJournal) createWriteOffJournal(journalId,code,fileId,newRec.id,bank);
                            } else if(poName && !famType) {
                                var poId = getPoIdSearch(poName);
                                if(poId) {
                                    // ��ȡ�˵�id����
                                    var getBillIdArr = getBillIdArrSearch(poId);
                                    if(getBillIdArr.length != 0) {
                                        if(!vendorpayment) writeOffBill(poId,money,code,newRec.id,getBillIdArr);
                                    }
                                    // �ж��Ƿ���Ҫ���ɹ�Ӧ��Ԥ����
                                    if(!vendorprepayment) writeOffPrePayment(poId,code,newRec.id,fileId,titile,money);
                                }

                            } else if(poName && famType) {
                                var poId = getPoIdSearch(poName);
                                if(poId) {
                                    // ��ȡ�˵�id����
                                    var getBillIdArr = getBillIdArrSearch(poId);
                                    if(getBillIdArr.length != 0) {
                                        if(!vendorpayment) writeOffBill(poId,money,code,newRec.id,getBillIdArr);
                                    }
                                    // �ж��Ƿ���Ҫ���ɹ�Ӧ��Ԥ����
                                    if(!vendorprepayment) writeOffPrePayment(poId,code,newRec.id,fileId,titile,money);
                                }

                            } else if(!poName && famType) {
                                // ���й̶��ʲ�����
                                if(!writeOffJournal) createWriteOffJournal(journalId,code,fileId,newRec.id,bank);
                            }
                        } else if(recordType == "Ԥ����") {
                            if(vendor) createVendorPrePayment(vendor,account,money,code);
                        }  else if(recordType == "��") {
                            if(!serviceJournal) createLoanJournal(money,code,fileId,titile,subsidiary,employeeName,newRec.id,bank);
                        }
                    }
                }
            }
        }

        // �ж��Ƿ���Ҫ���ɹ�Ӧ��Ԥ����
        function writeOffPrePayment(poId,code,newRecId,fileId,titile,money) {
            var subsidiaryAccountJson = {
                '2':'220',//����ӥͫ�Ƽ���չ�ɷ����޹�˾
                '3':'225',//�Ϻ��������ܿƼ����޹�˾
                '4':'224',//�Ϻ�ӥͫҽ�ƿƼ����޹�˾
                '5':'226',//����ӥͫ�����Ƽ����޹�˾
            }
            var poRec = record.load({type:'purchaseorder',id:poId});
            var subsidiary = poRec.getValue({fieldId:'subsidiary'}); // �ӹ�˾���ҿ�Ŀ��
            var vendor = poRec.getValue({fieldId:'entity'}); // ��Ӧ��
            var poTotalAmount = poRec.getValue({fieldId:'total'}); // po�ܼ�
            var billAndPaymentTotalAmount = 0;

            var billAndPaymentTotalAmountJson = {};
            var purchaseorderSearchObj = search.create({
                type: "purchaseorder",
                filters: [["type","anyof","PurchOrd"], "AND", ["internalid","anyof",poId], "AND", ["applyingtransaction.type","anyof","VPrep","VendBill"]],
                columns:
                    [
                        search.createColumn({name: "total", join: "applyingTransaction", label: "�������ܼƣ�"}),
                        search.createColumn({name: "type", join: "applyingTransaction", label: "����"}),
                        search.createColumn({name: "internalid", join: "applyingTransaction", label: "�ڲ���ʶ"})
                    ]
            });
            purchaseorderSearchObj.run().each(function(result) {
                var internalId = result.getValue({name: "internalid", join: "applyingTransaction"});
                var total = result.getValue({name: "total", join: "applyingTransaction"});
                billAndPaymentTotalAmountJson[internalId] = Math.abs(total);
                return true;
            });

            for(var ids in billAndPaymentTotalAmountJson) {
                billAndPaymentTotalAmount += Number(billAndPaymentTotalAmountJson[ids]);
            }

            if(Number(money) > Number(billAndPaymentTotalAmount)) {
                var needPayAmount = Math.round((Number(money) - Number(billAndPaymentTotalAmount)) *100) / 100;
                var vendorPrePayment = record.create({type:'vendorprepayment'});


                vendorPrePayment.setValue({fieldId:'entity',value:vendor});
                vendorPrePayment.setValue({fieldId:'purchaseorder',value:poId});
                vendorPrePayment.setValue({fieldId:'account',value:subsidiaryAccountJson[subsidiary]});
                vendorPrePayment.setValue({fieldId:'payment',value:needPayAmount});
                vendorPrePayment.setValue({fieldId:'memo',value:"֧����"+code +": "+titile});
                var id = vendorPrePayment.save({enableSourcing:true,ignoreMandatoryFields:true});
                if(id) record.submitFields({type:"customrecord_swc_payment_platform",id:newRecId,values:{'custrecord_swcpp_approvetransaction1':id}});
                if(id && fileId) record.attach({record:{type:"file",id:fileId},to:{type:"vendorprepayment",id:id}});
            }


        }


        // ���ռ���
        function createLoanJournal(money,code,fileId,titile,subsidiary,employeeName,newRecId,bank) {
            var memo = code + ": " + titile;
            var journalRec = record.create({type:"journalentry",isDynamic:true});
            journalRec.setValue({fieldId:"subsidiary",value:subsidiary});
            journalRec.setValue({fieldId:"memo",value:memo});
            journalRec.setValue({fieldId:"externalid",value:'service'+code});
            journalRec.setValue({fieldId:"approvalstatus",value:'2'});//�Ѻ�׼

            var subsidiaryAccountJson = {
                '2':'220',//����ӥͫ�Ƽ���չ�ɷ����޹�˾
                '3':'225',//�Ϻ��������ܿƼ����޹�˾
                '4':'224',//�Ϻ�ӥͫҽ�ƿƼ����޹�˾
                '5':'226',//����ӥͫ�����Ƽ����޹�˾
            }

            var vendorSearchObj = search.create({
                type: "employee",
                filters: [["isinactive","is","F"], "AND", ["subsidiary","anyof",subsidiary], "AND", ["entityid","is",employeeName]],
                columns: [search.createColumn({name: "internalid", label: "Internal ID"})]
            });
            var result = vendorSearchObj.run().getRange({start:0,end:1});


            var subRecord = journalRec.selectNewLine({sublistId:'line'});
            subRecord.setCurrentSublistValue({sublistId:'line', fieldId:'account', value: '248'});
            subRecord.setCurrentSublistValue({sublistId:'line', fieldId:'memo', value: memo});
            subRecord.setCurrentSublistValue({sublistId:'line', fieldId:'debit', value: money});
            if(result && result.length) {
                var internalId = result[0].getValue({name: "internalid"});
                subRecord.setCurrentSublistValue({sublistId:'line', fieldId:'entity', value: internalId});
            }
            subRecord.commitLine({sublistId:'line'});

            var subRecord = journalRec.selectNewLine({sublistId:'line'});
            subRecord.setCurrentSublistValue({sublistId:'line', fieldId:'account', value: subsidiaryAccountJson[subsidiary]});
            subRecord.setCurrentSublistValue({sublistId:'line', fieldId:'memo', value: memo});
            subRecord.setCurrentSublistValue({sublistId:'line', fieldId:'credit', value: money});
            subRecord.commitLine({sublistId:"line"});

            var id = journalRec.save({enableSourcing:true,ignoreMandatoryFields:true});

            if(id) record.submitFields({type:"customrecord_swc_payment_platform",id:newRecId,values:{'custrecord_swcpp_approvetransaction':id}});
            if(id && fileId) record.attach({record:{type:"file",id:fileId},to:{type:"journalentry",id:id}});


            // } catch (e) {
            //     log.audit({title:"���ɺ����ռ���",details:e.message})
            // }



        }


        // �����˵�
        function writeOffBill(poId,money,code,newRecId,getBillIdArr) {
            if(getBillIdArr.length) {
                var lastMoney = Number(money);
                var billId = getBillIdArr[0]; // ȡһ���˵�id���У����г����ù�Ӧ�����еĴ�֧���˵�������

                var vendorPaymentRec = record.transform({fromType:"vendorbill",fromId:billId,toType:"vendorpayment",isDynamic:true});
                vendorPaymentRec.setValue({fieldId:"externalid",value:'vendorpayment'+code})
                var count = vendorPaymentRec.getLineCount({sublistId:"apply"});
                for(var i = 0; i < count; i++) {
                    vendorPaymentRec.selectLine({sublistId:"apply",line:i});
                    var type = vendorPaymentRec.getCurrentSublistValue({sublistId:"apply",fieldId:"trantype"});
                    var createFrom = vendorPaymentRec.getCurrentSublistValue({sublistId:"apply",fieldId:"createdfrom"});
                    // ֻ������Ӧ�ɹ��������˵�
                    if(type == 'VendBill' && createFrom == poId) {
                        vendorPaymentRec.setCurrentSublistValue({sublistId:"apply",fieldId:"apply",value:true});
                        var last = vendorPaymentRec.getCurrentSublistValue({sublistId:"apply",fieldId:"due"});
                        vendorPaymentRec.setCurrentSublistValue({sublistId:"apply",fieldId:"amount",value:Math.min(Number(lastMoney),Number(last))});
                        vendorPaymentRec.commitLine({sublistId:"apply"});

                        //���ʣ����Ϊ0�� ����ѭ��
                        lastMoney = lastMoney - (Math.min(Number(lastMoney),Number(last)));
                        if(lastMoney <= 0) break;
                    }
                }
                var id = vendorPaymentRec.save({enableSourcing:true,ignoreMandatoryFields:true});

                if(id) record.submitFields({type:"customrecord_swc_payment_platform",id:newRecId,values:{'custrecord_swcpp_approvetransaction':id}});
            }
        }

        // ��ȡ�˵�id����
        function getBillIdArrSearch(poId) {
            var arr = [];
            var vendorbillSearchObj = search.create({
                type: "vendorbill",
                filters: [["type","anyof","VendBill"], "AND", ["status","anyof","VendBill:A"], "AND", ["appliedtotransaction","anyof",poId]],
                columns: [search.createColumn({name: "internalid", label: "�ڲ���ʶ"})]
            });
            vendorbillSearchObj.run().each(function(result){
                var billId = result.getValue({name: "internalid"});
                arr.push(billId);
                return true;
            });
            return arr;
        }

        // ��ȡpoid
        function getPoIdSearch(poName) {
            var poid = '';
            var purchaseorderSearchObj = search.create({
                type: "purchaseorder",
                filters: [["type","anyof","PurchOrd"], "AND", ["mainline","is","T"], "AND", ["numbertext","is",poName]],
                columns: [search.createColumn({name: "internalid", label: "�ڲ���ʶ"}),]
            });
            purchaseorderSearchObj.run().each(function(result) {
                poid = result.getValue({name: "internalid"})
                return true;
            });
            return poid;
        }

        // ������Ӧ��Ԥ����
        function createVendorPrePayment(vendor,account,money,code) {
            var VendorPrePaymentRec = record.create({type:"vendorprepayment"});
            VendorPrePaymentRec.setValue({fieldId:"entity",value:vendor});// �տ���
            VendorPrePaymentRec.setValue({fieldId:"account",value:account}); //�����˻�
            VendorPrePaymentRec.setValue({fieldId:"payment",value:money}) // ������
            VendorPrePaymentRec.setValue({fieldId:"externalid",value:code}) // ������
            VendorPrePaymentRec.save({enableSourcing:true,ignoreMandatoryFields:true});
        }

        // �����ռ���
        function createWriteOffJournal(journalId,code,fileId,newRecId,bank) {
            if(journalId) {
                // try {
                var journalRec  = record.copy({type:"journalentry",id:journalId,isDynamic:true});
                var memo = journalRec.getValue({fieldId:"memo"});
                var subsidiary = journalRec.getValue({fieldId:"subsidiary"});
                var subsidiaryAccountJson = {
                    '2':'220',//����ӥͫ�Ƽ���չ�ɷ����޹�˾
                    '3':'225',//�Ϻ��������ܿƼ����޹�˾
                    '4':'224',//�Ϻ�ӥͫҽ�ƿƼ����޹�˾
                    '5':'226',//����ӥͫ�����Ƽ����޹�˾
                }
                var newMemo = "֧��: "+memo;
                journalRec.setValue({fieldId:"memo",value:newMemo});
                journalRec.setValue({fieldId:"externalid",value:"writeoff"+code});
                journalRec.setValue({fieldId:"approvalstatus",value:'2'});//�Ѻ�׼

                var money = 0;
                var count = journalRec.getLineCount({sublistId:"line"});
                for(var i = count-1; i >= 0 ; i--) {
                    journalRec.selectLine({sublistId:"line",line:i});
                    var credit = journalRec.getCurrentSublistValue({sublistId:'line', fieldId:'credit'});
                    var debit = journalRec.getCurrentSublistValue({sublistId:'line', fieldId:'debit'});
                    var account = journalRec.getCurrentSublistValue({sublistId:'line', fieldId:'account'});
                    var lineMemo = journalRec.getCurrentSublistValue({sublistId:'line', fieldId:'memo'});
                    if(debit || account=='248') {
                        journalRec.removeLine({sublistId:"line",line:i})
                    }
                    if(credit && account!='248') {
                        money = credit;
                        journalRec.setCurrentSublistValue({sublistId:'line', fieldId:'credit', value: ''});
                        journalRec.setCurrentSublistValue({sublistId:'line', fieldId:'debit', value: credit});
                        journalRec.setCurrentSublistValue({sublistId:'line', fieldId:'memo', value: "֧��: "+lineMemo});
                        journalRec.commitLine({sublistId:"line"});
                    }
                }

                journalRec.selectNewLine({sublistId:'line'});
                journalRec.setCurrentSublistValue({sublistId:'line', fieldId:'account', value: subsidiaryAccountJson[subsidiary]});
                journalRec.setCurrentSublistValue({sublistId:'line', fieldId:'memo', value: newMemo});
                journalRec.setCurrentSublistValue({sublistId:'line', fieldId:'credit', value: money});
                journalRec.commitLine({sublistId:"line"});

                var id = journalRec.save({enableSourcing:true,ignoreMandatoryFields:true});

                if(id) record.submitFields({type:"customrecord_swc_payment_platform",id:newRecId,values:{'custrecord_swcpp_approvetransaction':id}});
                if(id && fileId) record.attach({record:{type:"file",id:fileId},to:{type:"journalentry",id:id}});


                // } catch (e) {
                //     log.audit({title:"���ɺ����ռ���",details:e.message})
                // }

            }

        }

        return {
            afterSubmit: afterSubmit
        };

    });
