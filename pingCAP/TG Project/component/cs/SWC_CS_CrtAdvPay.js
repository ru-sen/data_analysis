/**
 * @NApiVersion 2.x
 * @NScriptType ClientScript
 * @NModuleScope SameAccount
 */
define(['N/currentRecord', 'N/record', 'N/search', 'N/ui/dialog', 'N/url', 'N/https'],

    function (currentRecord, record, search, dialog, url, https) {

        /**
         * Function to be executed after page is initialized.
         *
         * @param {Object} scriptContext
         * @param {Record} scriptContext.currentRecord - Current form record
         * @param {string} scriptContext.mode - The mode in which the record is being accessed (create, copy, or edit)
         *
         * @since 2015.2
         */
        function pageInit(scriptContext) {
        }

        /**
         * 创建供应商预付款
         */
        function crtAdvPay() {
            debugger;
            // 将数据传递到SL便于处理【传递表单ID】
            var urlObj = url.resolveScript({
                scriptId: "customscript_swc_sl_crtadvpay",
                deploymentId: "customdeploy_swc_sl_crtadvpay_d",
                // returnExternalUrl:true,
                // params: {}
            });
            var dataObj = {
                'pay_form_id': currentRecord.get().id,
            }
            // 从SL获取搜索结果
            var srchPoResult = https.post({
                url: urlObj,
                body: {"option": JSON.stringify(dataObj)}
            }).body;
            // 如果返回的是”payAmountNotBe0“，代表【付款金额】字段不能为0，不能为空，需要提示用户
            if (srchPoResult == "payAmountNotBe0") {
                dialog.alert({
                    title: '提示',
                    message: '【付款金额】的值不能小于等于0且不能为空，请核对【付款金额】'
                });
                return;
            }
            //jjp+ 20230222 start  如果该采购订单全额开票 则不继续后续操作
            if (srchPoResult=="purNotToCreateInvoice"){
                dialog.alert({
                    title: '提示',
                    message: '该【采购订单】已全额开票，不能创建【供应商预付款】'
                });
                return;
            }
            //jjp+ 20230222 end

            // 如果返回的是”payAmountNotBe0“，代表对应【采购订单】的【供应商】不存在，需要提示用户
            if (srchPoResult=="vendorNotExist"){
                dialog.alert({
                    title: '提示',
                    message: '没有找到与【采购订单】对应的【供应商】，请核对【采购订单】是否填写正确'
                });
                return;
            }

            // 如果返回的是”vendorNotFit“,代表对应的【采购订单】的【供应商】名称填错了，需要提示用户
            if (srchPoResult=="vendorNotFit"){
                dialog.alert({
                    title: '提示',
                    message: '没有找到与【采购订单】对应的【供应商】，请核对【供应商】是否填写正确'
                });
                return;
            }
            // 如果返回的是”amountOutOfBounds“，代表对应预付款累计金额，超过了采购订单总金额,需要提示用户
            if (JSON.parse(srchPoResult).errorInfo=="amountOutOfBounds"){
                dialog.alert({
                    title: '提示',
                    message: '供应商预付款累计金额为:'+JSON.parse(srchPoResult).sumPayAmount+
                        ',超过了采购订单总金额:'+JSON.parse(srchPoResult).currentAmount+
                    '，请核对【付款金额】，以及以前的【供应商预付款】单据'
                });
                return;
            }
            // 如果返回的是”successSavedRec“，代表成功保存订单，刷新页面
            if (JSON.parse(srchPoResult).errorInfo=="successSavedRec"){
                window.location.reload();
            }
        }
        return {
            pageInit: pageInit,
            crtAdvPay: crtAdvPay
        };
    });
