/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @NModuleScope public
 */
define(['N/record', 'N/search', 'N/ui/serverWidget', 'N/currentRecord', 'N/ui/dialog'],

    (record, search, serverWidget, currentRecord, dialog) => {
        /**
         * Defines the Suitelet script trigger point.
         * @param {Object} scriptContext
         * @param {ServerRequest} scriptContext.request - Incoming request
         * @param {ServerResponse} scriptContext.response - Suitelet response
         * @since 2015.2
         */
        const onRequest = (scriptContext) => {
            var response = scriptContext.response;
            var request = scriptContext.request;
            // 获取从CS传递的数据
            var option = request.parameters.option;
            option = JSON.parse(option);
            // 将数据中的【表单ID】提取出来
            var formId = option.pay_form_id;
            // 通过【record.load】载入，获取【供应商预付款申请】表单的数据
            var curRec = record.load({
                type: 'customrecord_swc_advpay_request',
                id: formId
            });
            // 首先获取【付款金额】字段中的值，做【非空校验】
            var payAmount = curRec.getValue({fieldId: "custrecord_advpay_payment"});
            // 同时获取【供应商】字段中的值，做【供应商】判断和【非空校验】
            var vendorInfo = curRec.getValue({fieldId:"custrecord_advpay_vendor"});
            // 如果【付款金额】为空，或者为”0“，则不符合赋值规范，返回对应的值提示用户
            if (payAmount <= 0 || payAmount == "") {
                response.write("payAmountNotBe0");
                return;
            }
            // 如果通过则继续流程，通过【采购订单字段】获取对应的【采购订单信息】
            // 首先获取【采购订单字段】信息
            var poNum = curRec.getValue({fieldId: "custrecord_advpay_ponum"});
            // 将获取的【采购订单名称】作为检索条件，获取【采购订单信息】
            var allPoObj = srchPoInfoByPoNum({poNum: poNum});
            // 获取对应的【采购订单ID】
            var poFormIntlId = allPoObj.intlId;
            // 获取对应的【子公司ID】
            var poSubSId = allPoObj.subSId;
            // 获取对应的【供应商ID】
            var poVendorId = allPoObj.vendornm;
            // 获取对应的【付款金额】
            var poPayAmount = allPoObj.amount;

            //jjp+ 20230222 start 如果该采购订单全额开票 则不继续后续操作
            var purStatus = srchPurStatus(poFormIntlId);
            log.audit("purStatus",purStatus);
            if(purStatus == "fullyBilled"){
                response.write("purNotToCreateInvoice");
                return;
            }
            //jjp+ 20230222 start

            // 如果查不到对应【采购订单名称】的【供应商ID】，则需要提示用户
            if (poVendorId == "" || poVendorId == null) {
                response.write("vendorNotExist");
                return;
            }
            // 如果查询到的【供应商ID】和表单字段上的【供应商】不匹配(且字段上的【供应商】不为空)，则需要提示用户
            if (vendorInfo!==poVendorId&&vendorInfo!=""){
                response.write("vendorNotFit");
                return;
            }
            // 如果能查到对应的值，则继续流程:根据【采购订单ID】检索【对应的预付款金额总和】
            var sumPaymentObj = srchSumPayment({poFormIntlId: poFormIntlId, poVendorId: poVendorId});
            // 获取【对应的预付款金额总和】,并取绝对值
            var sumPayment = Math.abs(Number(sumPaymentObj.amount));
            // 如果（【对应的预付款金额总和】+【付款金额字段的值】）>【对应采购订单的付款金额】
            // 则不符合规范，需要提示用户
            if ((sumPayment + payAmount) > poPayAmount) {
                // 优化：创建一个对象，传递【累计金额】和【采购订单金额】,便于提示用户
                var errorAlert = {
                    errorInfo:"amountOutOfBounds",
                    sumPayAmount :(sumPayment + payAmount),
                    currentAmount : poPayAmount
                }
                // 将这个对象传递到CS
                response.write(JSON.stringify(errorAlert));
                return;
            }
            // 如果语句通过，则继续流程，通过【子公司ID】获取对应的【账户】
            var vAccount = srchVendorAccount({poSubSId: poSubSId});
            // 获取【账户】检索列表的第一项作为默认账户（这里没有直接取得数组第一位的值是防止需求变更）
            var vendorAccount = vAccount[0];
            // 输出所有相关数据（便于测试）;
            // log.audit("采购订单ID", poFormIntlId);
            // log.audit("子公司ID", poSubSId);
            // log.audit("供应商ID", poVendorId);
            // log.audit("付款金额", poPayAmount);
            // log.audit("供应商预付款金额总和", (sumPayment + payAmount));
            // log.audit("采购订单预付款金额", poPayAmount);
            // log.audit("账户ID", vendorAccount);
            // ======================开始创建单据，获取部分【表单数据】==========================
            var recData = {
                // 【收款人】已由【poVendorId】获取
                "entity": poVendorId,
                // 【采购订单】已由【poFormIntlId】获取
                "purchaseorder": poFormIntlId,
                // 【付款金额】已由【payAmount】获取
                "payment": payAmount,
                // 【货币】由系统自动带出
                // 【汇率】由系统自动带出
                // 获取【实际付款日期】
                "trandate": curRec.getValue({fieldId: "custrecord_advpay_trandate"}),
                // 【账户】已由【vendorAccount】获取
                "account": vendorAccount,
                // 获取【审批状态】
                "approvalstatus": curRec.getText({fieldId: "custrecord_advpay_status"}),
                // 获取【付款方式】
                "custbody_swc_payway": curRec.getValue({fieldId: "custrecord_advpay_payway"}),
                // 获取【预计付款日期】
                "custbody_swc_repaydate": curRec.getValue({fieldId: "custrecord_advpay_paydate"}),
                // 【子公司】已由【poSubSId】获取
                "subsidiary": poSubSId,
                // 获取【部门】
                "department": curRec.getValue({fieldId: "custrecord_advpay_department"}),
            }
            // 通过获取的【表单数据(recData)】创建对应的【供应商预付款】单据，同时获取返回的【保存单据ID】
            var saveRecId = crtPrePayForm(recData);
            log.audit("saveRecId",saveRecId);
            // 通过返回的【保存单据ID】
            // 回填【供应商】字段
            curRec.setValue({
                fieldId: "custrecord_advpay_vendor",
                value: poVendorId
            });
            // 回填【关联预付款单】字段
            curRec.setValue({
                fieldId: "custrecord_advpay_prepaynote",
                value: saveRecId
            });
            // 最后保存单据，输出字符串便于CS脚本使用页面刷新
            curRec.save({
                enableSourcing: true,
                ignoreMandatoryFields: true
            });
            errorAlert = {
                errorInfo:"successSavedRec",
            }
            response.write(JSON.stringify(errorAlert));
        }

        /**
         * 根据【采购订单】检索【对应的采购订单信息】
         * @param {Object} options
         * @param {Array} options.poNum
         * @return {Object}
         */
        function srchPoInfoByPoNum(options) {
            var poNum = options.poNum;
            var purchaseorderSearchObj = search.create({
                type: "purchaseorder",
                filters:
                    [
                        ["type","anyof","PurchOrd"],
                        "AND",
                        ["numbertext","haskeywords",poNum],
                        "AND",
                        ["mainline","is","F"],
                        "AND",
                        ["taxline","is","F"],
                        "AND",
                        ["shipping","is","F"],
                        "AND",
                        ["cogs","is","F"],
                        "AND",
                        ["closed","is","F"]
                    ],
                columns:
                    [
                        search.createColumn({
                            name: "internalid",
                            summary: "GROUP",
                            label: "内部 ID"
                        }),
                        search.createColumn({
                            name: "internalid",
                            join: "subsidiary",
                            summary: "GROUP",
                            label: "子公司 ID"
                        }),
                        search.createColumn({
                            name: "internalid",
                            join: "vendor",
                            summary: "GROUP",
                            label: "供应商 ID"
                        }),
                        search.createColumn({
                            name: "fxamount",
                            summary: "SUM",
                            label: "金额（外币）"
                        })
                    ]
            });
            var srchRs = getAllResults(purchaseorderSearchObj);
            // console.log("srchResultA:"+srchRs);
            var poObj = {};
            for (var i = 0; i < srchRs.length; i++) {
                var intlId = srchRs[i].getValue({
                    name: "internalid",
                    summary: "GROUP",
                    label: "内部 ID"
                });
                var amount = srchRs[i].getValue({
                    name: "fxamount",
                    summary: "SUM",
                    label: "金额（外币）"
                });
                var vendornm = srchRs[i].getValue({
                    name: "internalid",
                    join: "vendor",
                    summary: "GROUP",
                    label: "供应商 ID"
                });
                var subSId = srchRs[i].getValue({
                    name: "internalid",
                    join: "subsidiary",
                    summary: "GROUP",
                    label: "子公司 ID"
                });
                poObj = {
                    'intlId': intlId,
                    'amount': amount,
                    'vendornm': vendornm,
                    'subSId': subSId
                }
            }
            return poObj;
        }

        /**
         * 根据【采购订单ID】检索【对应的预付款金额总和】
         * @param {Object} options
         * @param options.poNum
         * @return {Object}
         */
        function srchSumPayment(options) {
            // 接收【采购订单ID】，作为查询条件
            var poFormIntlId = options.poFormIntlId;
            // 接收【供应商名称】，作为没有【供应商预付款】存在的初始化
            var poVendorId = options.poVendorId
            // 创建保存检索
            var vendorprepaymentSearchObj = search.create({
                type: "vendorprepayment",
                filters:
                    [
                        ["type", "anyof", "VPrep"],
                        "AND",
                        ["appliedtotransaction", "anyof", poFormIntlId]
                    ],
                columns:
                    [
                        search.createColumn({
                            name: "entity",
                            summary: "GROUP",
                            label: "名称"
                        }),
                        search.createColumn({
                            name: "fxamount",
                            summary: "SUM",
                            label: "金额（外币）"
                        })
                    ]
            });
            var srchRs = getAllResults(vendorprepaymentSearchObj);
            try {
                var amount = srchRs[0].getValue({
                    name: "fxamount",
                    summary: "SUM",
                    label: "金额（外币）"
                });
            } catch (e) {
                amount = 0;
            }
            try {
                var poname = srchRs[0].getValue({
                    name: "entity",
                    summary: "GROUP",
                    label: "名称"
                });
            } catch (e) {
                poname = poVendorId;
            }
            sumPayment = {
                'poname': poname,
                'amount': amount
            }
            return sumPayment;
        }

        /**
         * 根据【子公司ID】检索【对应的账户】
         * @param {Object} options
         * @param {Array} options.poNum
         * @return {Object}
         */
        function srchVendorAccount(options) {
            var poSubSId = options.poSubSId;
            var accountSearchObj = search.create({
                type: "account",
                filters:
                    [
                        ["parent", "anyof", "356"],
                        "AND",
                        ["subsidiary", "anyof", poSubSId]
                    ],
                columns:
                    [
                        search.createColumn({name: "internalid", label: "内部 ID"}),
                    ]
            });
            var srchRs = getAllResults(accountSearchObj);
            // console.log("srchResultA:"+srchRs);
            var vAccount = [];
            for (var i = 0; i < srchRs.length; i++) {
                var intlId = srchRs[i].getValue({name: "internalid", label: "内部 ID"});
                vAccount.push(intlId)
            }
            return vAccount;
        }

        // 通用检索方法，放在最后，使用需要引用【N/search】模块
        function getAllResults(mySearch) {
            var resultSet = mySearch.run();
            var resultArr = [];
            var start = 0;
            var step = 1000;
            var results = resultSet.getRange({start: start, end: step});
            while (results && results.length > 0) {
                resultArr = resultArr.concat(results);
                start = Number(start) + Number(step);
                results = resultSet.getRange({start: start, end: Number(start) + Number(step)});
            }
            return resultArr;
        }

        /**
         * 生成供应商预付款表
         * @param recData,salesOrdId
         */
        function crtPrePayForm(recData) {
            // 使用record.create创建【供应商预付款】单据
            var prePayRec = record.create({
                type: record.Type.VENDOR_PREPAYMENT,
                isDynamic: true,
            });
            // 提取【付款人（供应商ID）】
            prePayRec.setValue({
                fieldId: "entity",
                value: recData.entity
            });
            // 提取【子公司ID】
            prePayRec.setValue({
                fieldId: "subsidiary",
                value: recData.subsidiary
            });
            // 提取【采购订单ID】
            prePayRec.setValue({
                fieldId: "purchaseorder",
                value: recData.purchaseorder,
            });
            // 提取【付款金额】
            prePayRec.setValue({
                fieldId: "payment",
                value: recData.payment
            });
            // 【货币】由系统自带
            // 【汇率】由系统自带
            // 提取【实际付款日期】如果为空则直接获取当前日期
            prePayRec.setValue({
                fieldId: "trandate",
                value: recData.trandate == "" || recData.trandate == null ? new Date() : recData.trandate
            });
            // 提取【账户ID】
            prePayRec.setValue({
                fieldId: "account",
                value: recData.account
            });
            // 提取【审批状态】
            prePayRec.setText({
                fieldId: "approvalstatus",
                text: recData.approvalstatus
            });
            // 提取【付款方式】
            prePayRec.setValue({
                fieldId: "custbody_swc_payway",
                value: recData.custbody_swc_payway
            });
            // 提取【预计付款日期】如果为空则直接获取当前日期
            prePayRec.setValue({
                fieldId: "custbody_swc_repaydate",
                value: recData.custbody_swc_repaydate == "" || recData.custbody_swc_repaydate == null ?
                    new Date() : recData.custbody_swc_repaydate
            });
            // 提取【部门】
            prePayRec.setValue({
                fieldId: "department",
                value: recData.department
            });
            // 保存【供应商预付款】，忽略必填，启用【sourcing】便于带出【货币】和【汇率】
            try {
                var save = prePayRec.save({
                    enableSourcing: true,
                    ignoreMandatoryFields: true
                });
            }
                // 如果保存失败则输出【错误信息】
            catch (e) {
                log.audit({title: '保存失败', details: e.message});
            }
            return save
        }

        /**
         * 根据【采购订单ID】检索【采购订单 状态】
         * @param {Object} poFormIntlId
         * @return string
         */
        function srchPurStatus(poFormIntlId){
            if(!poFormIntlId)return "";
            var purchaseorderSearchObj = search.create({
                type: "purchaseorder",
                filters:
                    [
                        ["internalid","anyof",poFormIntlId],
                        "AND",
                        ["type","anyof","PurchOrd"],
                        "AND",
                        ["mainline","is","T"]
                    ],
                columns:
                    [
                        search.createColumn({name: "statusref", label: "状态"})
                    ]
            });
            var searchResultCount = purchaseorderSearchObj.runPaged().count;
            if(searchResultCount > 0){
                var srchPur = getAllResults(purchaseorderSearchObj);
                var purStatus = srchPur[0].getValue({name: "statusref", label: "状态"});
                  if(purStatus)return purStatus;
            }
            return "";
        }

        return {onRequest}
    });
