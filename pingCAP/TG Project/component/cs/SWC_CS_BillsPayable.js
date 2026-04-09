/**
 * @NApiVersion 2.x
 * @NScriptType ClientScript
 * @NModuleScope SameAccount
 * @description 员工中心应付账单
 * @author chen dong xu
 */

define(['N/record', 'N/currentRecord', 'N/url', 'N/https', '../../common/SWC_BillsPayable.js', 'N/runtime', 'N/currency', '../../common/SWC_Translate',
        "../../common/SWC_CONFIG_DATA",'N/search'],

    function (record, currentRecord, url, https, SWC_BillsPayable, runtime,currency, translateUtil,
              SWC_CONFIG_DATA,search) {

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
            // jQuery添加附件标签组
            // 取得无分组的文件类型html：根据发票附件1<span>标签取得顶层<tr>
            var noGroupFileTypeObj = jQuery("#custpage_field_invoice_fs_lbl_uir_label").parent().parent().parent().parent().parent().parent().parent();
            // 取得原HTML后删除HTML DOM
            var noGroupFileTypeHtml = noGroupFileTypeObj.html();
            noGroupFileTypeObj.remove();

            // 补足附件标签组html
            var groupFileTypeHtml = "<tr>\n" +
                "    <td valign=\"top\" colspan=\"3\">\n" +
                "        <table cellspacing=\"0\" cellpadding=\"0\" border=\"0\" width=\"100%\">\n" +
                "            <tbody>\n" +
                "                <tr class=\"uir-field-group-row-separator\">\n" +
                "                    <td colspan=\"3\">\n" +
                "                        <div class=\"uir-field-group-separator\"></div>\n" +
                "                    </td>\n" +
                "                </tr>\n" +
                "                <tr class=\"uir-field-group-row\">\n" +
                "                    <td id=\"fg_custpage_field_group7\" class=\"fgroup_title\" colspan=\"3\">\n" +
                "                        <div class=\"fgroup_title\"\n" +
                "                            style=\"color:#5A6F8F; border-bottom:1px solid #CCC; font-weight:600; white-space:nowrap; margin:0 0 2px 0\">\n" +
                translateUtil.translate("附件") +
                "                            </div>\n" +
                "                    </td>\n" +
                "                </tr>";
            groupFileTypeHtml += noGroupFileTypeHtml;
            groupFileTypeHtml += "            </tbody>\n" +
                "        </table>\n" +
                "    </td>\n" +
                "</tr>";
            // 添加到单据体最后位置
            jQuery("#detail_table_lay").append(groupFileTypeHtml);

            // this.jQuery('#custpage_field_w8tax').attr("type", "file");
            // this.jQuery('#custpage_field_w9tax').attr("type", "file");
            // this.jQuery('#custpage_field_other').attr("type", "file");
            // this.jQuery('#custpage_field_invoice').attr("type", "file");
            // debugger;
            var mode = scriptContext.mode;

            // log.audit({title: '单据状态', details: mode});

            var currRec = scriptContext.currentRecord;

            var reqParam = getReqParamFromUrl();
            if (reqParam.hasOwnProperty('obj') || reqParam.hasOwnProperty('filterJsonOption')) return;

            var user_id = runtime.getCurrentUser().id;

            var obj = {
                'api': 'runTime_pageInit',
                'user_id': user_id
            }

            var urlObj = url.resolveScript({
                scriptId: 'customscript_swc_sl_billspayable',
                deploymentId: 'customdeploy_swc_sl_billspayable',
                // returnExternalUrl:true,
                // params: {}
            });

            var responseBody = https.post({
                url: urlObj,
                body: {"obj": JSON.stringify(obj)}
            }).body;

            if (responseBody) {
                var returnData = JSON.parse(responseBody);

                if (returnData.department) {
                    // 部门
                    if (returnData.department.length > 0) currRec.setValue({fieldId: 'custpage_field_department', value: returnData.department[0].value});
                    // 预算归属部门
                    if (returnData.department.length > 0) currRec.setValue({fieldId: 'custpage_field_belongto', value: returnData.department[0].value});
                }

            }

            // 提交人
            currRec.setValue({fieldId: 'custpage_field_submitter', value: user_id});

            // 控制页面上部分字段的显示隐藏
            // var pay_way = currRec.getValue({fieldId: 'custpage_field_pay'});
            // controlShowHide(pay_way);

        }

        /**
         * 取得URL参数
         * @return {Object}
         */
        function getReqParamFromUrl() {
            var url = decodeURI(location.search); // 获取url中"?"符后的字串
            var reqParam = new Object();
            if (url.indexOf("?") != -1) {
                var str = url.substr(1);
                strs = str.split("&");
                for (var i = 0; i < strs.length; i++) {
                    reqParam[strs[i].split("=")[0]] = unescape(strs[i].split("=")[1]);
                }
            }
            return reqParam;
        }

        /**
         * Function to be executed when field is changed.
         *
         * @param {Object} scriptContext
         * @param {Record} scriptContext.currentRecord - Current form record
         * @param {string} scriptContext.sublistId - Sublist name
         * @param {string} scriptContext.fieldId - Field name
         * @param {number} scriptContext.lineNum - Line number. Will be undefined if not a sublist or matrix field
         * @param {number} scriptContext.columnNum - Line number. Will be undefined if not a matrix field
         *
         * @since 2015.2
         */
        function fieldChanged(scriptContext) {
            var currRec = scriptContext.currentRecord;
            var sublistId = scriptContext.sublistId;
            var fieldId = scriptContext.fieldId;
            var line = scriptContext.line;

            // // 当子列表数量改变时 计算 金额
            // if (sublistId == 'custpage_sublist' && fieldId == 'custpage_sub_quantity') {
            //     // 判断所填写数量是否大于可以使用数量
            //     currRec.selectLine({
            //         sublistId: 'custpage_sublist',
            //         line: line
            //     });
            //
            //     // 可开票数量
            //     var quantity_bill = currRec.getSublistValue({
            //         sublistId: 'custpage_sublist',
            //         fieldId: 'custpage_sub_bill_quantity',
            //         line: line
            //     });
            //
            //     // 数量
            //     var quantity = currRec.getCurrentSublistValue({
            //         sublistId: 'custpage_sublist',
            //         fieldId: 'custpage_sub_quantity'
            //     });
            //
            //     if (quantity > quantity_bill) {
            //         alert('所填写数量不能超过可开票数量：' + quantity_bill);
            //         currRec.setCurrentSublistValue({
            //             sublistId: 'custpage_sublist',
            //             fieldId: 'custpage_sub_quantity',
            //             value: quantity_bill
            //         });
            //         return;
            //     }
            //
            //     // 价格
            //     var price = currRec.getSublistValue({
            //         sublistId: 'custpage_sublist',
            //         fieldId: 'custpage_sub_price',
            //         line: line
            //     });
            //
            //     // 税率
            //     var taxRate = currRec.getSublistValue({
            //         sublistId: 'custpage_sublist',
            //         fieldId: 'custpage_sub_taxrate',
            //         line: line
            //     });
            //
            //
            //     // 将税率百分比转化成小数
            //     var str = taxRate.replace("%", "");
            //     var decimalTax = Number(str) / 100;
            //
            //     // 金额
            //     var amount = price * quantity;
            //
            //     // 税额
            //     var tax_price = amount * decimalTax;
            //
            //     // 总金额
            //     var total = amount + tax_price;
            //
            //     ////////////////////////////////////////// 赋值 /////////////////////////////////////////////////
            //     // 金额
            //     currRec.setCurrentSublistValue({
            //         sublistId: 'custpage_sublist',
            //         fieldId: 'custpage_sub_money',
            //         value: amount,
            //         ignoreFieldChange: true
            //     });
            //     // 税额
            //     currRec.setCurrentSublistValue({
            //         sublistId: 'custpage_sublist',
            //         fieldId: 'custpage_sub_taxprice',
            //         value: tax_price,
            //         ignoreFieldChange: true
            //     });
            //     // 总金额
            //     currRec.setCurrentSublistValue({
            //         sublistId: 'custpage_sublist',
            //         fieldId: 'custpage_sub_total',
            //         value: total,
            //         ignoreFieldChange: true
            //     });
            //
            //
            //     // 计算body字段【付款金额】
            //     setPayAmount(currRec);
            // }
            //
            // // 当子列表价格改变时 计算 金额
            // if (sublistId == 'custpage_sublist' && fieldId == 'custpage_sub_price') {
            //     currRec.selectLine({
            //         sublistId: 'custpage_sublist',
            //         line: line
            //     });
            //
            //     // 价格
            //     var price = currRec.getCurrentSublistValue({
            //         sublistId: 'custpage_sublist',
            //         fieldId: 'custpage_sub_price'
            //     });
            //
            //     // 数量
            //     var quantity = currRec.getSublistValue({
            //         sublistId: 'custpage_sublist',
            //         fieldId: 'custpage_sub_quantity',
            //         line: line
            //     });
            //
            //     // 税率
            //     var taxRate = currRec.getSublistValue({
            //         sublistId: 'custpage_sublist',
            //         fieldId: 'custpage_sub_taxrate',
            //         line: line
            //     });
            //
            //     // 将税率百分比转化成小数
            //     var str = taxRate.replace("%", "");
            //     var decimalTax = Number(str) / 100;
            //
            //     // 金额
            //     var amount = price * quantity;
            //
            //     // 税额
            //     var tax_price = amount * decimalTax;
            //
            //     // 总金额
            //     var total = amount + tax_price;
            //
            //     ////////////////////////////////////////// 赋值 /////////////////////////////////////////////////
            //     // 金额
            //     currRec.setCurrentSublistValue({
            //         sublistId: 'custpage_sublist',
            //         fieldId: 'custpage_sub_money',
            //         value: amount,
            //         ignoreFieldChange: true
            //     });
            //     // 税额
            //     currRec.setCurrentSublistValue({
            //         sublistId: 'custpage_sublist',
            //         fieldId: 'custpage_sub_taxprice',
            //         value: tax_price,
            //         ignoreFieldChange: true
            //     });
            //     // 总金额
            //     currRec.setCurrentSublistValue({
            //         sublistId: 'custpage_sublist',
            //         fieldId: 'custpage_sub_total',
            //         value: total,
            //         ignoreFieldChange: true
            //     });
            //
            //     // 计算body字段【付款金额】
            //     setPayAmount(currRec);
            //
            // }
            //
            // // 当子列表金额改变时 计算
            // if (sublistId == 'custpage_sublist' && fieldId == 'custpage_sub_money') {
            //     currRec.selectLine({
            //         sublistId: 'custpage_sublist',
            //         line: line
            //     });
            //
            //     // 金额
            //     var amount = currRec.getCurrentSublistValue({
            //         sublistId: 'custpage_sublist',
            //         fieldId: 'custpage_sub_money'
            //     });
            //
            //     // 数量
            //     var quantity = currRec.getSublistValue({
            //         sublistId: 'custpage_sublist',
            //         fieldId: 'custpage_sub_quantity',
            //         line: line
            //     });
            //
            //     // 税率
            //     var taxRate = currRec.getSublistValue({
            //         sublistId: 'custpage_sublist',
            //         fieldId: 'custpage_sub_taxrate',
            //         line: line
            //     });
            //
            //     // 将税率百分比转化成小数
            //     var str = taxRate.replace("%", "");
            //     var decimalTax = Number(str) / 100;
            //
            //     // 价格
            //     var price = amount / quantity;
            //
            //     // 税额
            //     var tax_price = amount * decimalTax;
            //
            //     // 总金额
            //     var total = Number(amount) + Number(tax_price);
            //
            //     /////////////////////////////赋值////////////////////////
            //     // 价格
            //     currRec.setCurrentSublistValue({
            //         sublistId: 'custpage_sublist',
            //         fieldId: 'custpage_sub_price',
            //         value: price,
            //         ignoreFieldChange: true
            //     });
            //     // 税额
            //     currRec.setCurrentSublistValue({
            //         sublistId: 'custpage_sublist',
            //         fieldId: 'custpage_sub_taxprice',
            //         value: tax_price,
            //         ignoreFieldChange: true
            //     });
            //     // 总金额
            //     currRec.setCurrentSublistValue({
            //         sublistId: 'custpage_sublist',
            //         fieldId: 'custpage_sub_total',
            //         value: total,
            //         ignoreFieldChange: true
            //     });
            //
            //     // 计算body字段【付款金额】
            //     setPayAmount(currRec);
            // }
            //
            // // 当子列表税额改变时 计算
            // if (sublistId == 'custpage_sublist' && fieldId == 'custpage_sub_taxprice') {
            //     currRec.selectLine({
            //         sublistId: 'custpage_sublist',
            //         line: line
            //     });
            //
            //     // 税额
            //     var tax_price = currRec.getCurrentSublistValue({
            //         sublistId: 'custpage_sublist',
            //         fieldId: 'custpage_sub_taxprice'
            //     });
            //
            //     // 金额
            //     var amount = currRec.getSublistValue({
            //         sublistId: 'custpage_sublist',
            //         fieldId: 'custpage_sub_money',
            //         line: line
            //     });
            //
            //     // 总金额
            //     var total = Number(tax_price) + Number(amount);
            //
            //     // 总金额
            //     currRec.setCurrentSublistValue({
            //         sublistId: 'custpage_sublist',
            //         fieldId: 'custpage_sub_total',
            //         value: total,
            //         ignoreFieldChange: true
            //     });
            //
            //     // 计算body字段【付款金额】
            //     setPayAmount(currRec);
            //
            // }
            //
            // // 当子列表总金额改变时 计算
            // if (sublistId == 'custpage_sublist' && fieldId == 'custpage_sub_total') {
            //     currRec.selectLine({
            //         sublistId: 'custpage_sublist',
            //         line: line
            //     });
            //
            //     // 总金额
            //     var total = currRec.getCurrentSublistValue({
            //         sublistId: 'custpage_sublist',
            //         fieldId: 'custpage_sub_total',
            //     });
            //
            //     // 税额
            //     var tax_price = currRec.getSublistValue({
            //         sublistId: 'custpage_sublist',
            //         fieldId: 'custpage_sub_taxprice',
            //         line: line
            //     });
            //
            //     // 数量
            //     var quantity = currRec.getSublistValue({
            //         sublistId: 'custpage_sublist',
            //         fieldId: 'custpage_sub_quantity',
            //         line: line
            //     });
            //
            //     // 金额
            //     var amount = total - tax_price;
            //
            //     // 价格
            //     var price = amount / quantity;
            //
            //     ///////////////////////////////赋值//////////////////////
            //     // 金额
            //     currRec.setCurrentSublistValue({
            //         sublistId: 'custpage_sublist',
            //         fieldId: 'custpage_sub_money',
            //         value: amount,
            //         ignoreFieldChange: true
            //     });
            //
            //     // 价格
            //     currRec.setCurrentSublistValue({
            //         sublistId: 'custpage_sublist',
            //         fieldId: 'custpage_sub_price',
            //         value: price,
            //         ignoreFieldChange: true
            //     });
            //
            //     // 计算body字段【付款金额】
            //     setPayAmount(currRec);
            //
            // }

            // 当body字段【付款方式】改变时 切换页面样式 并且 重新 赋值【付款主体】下拉选
            if (fieldId == 'custpage_field_pay') {

                // 获取body字段值
                var option = getBodyValue(currRec, true);

                option.api = 'field_changed';

                // 取消提示框
                window.onbeforeunload = null;

                var urlObj = url.resolveScript({
                    scriptId: 'customscript_swc_sl_billspayable',
                    deploymentId: 'customdeploy_swc_sl_billspayable',
                    // returnExternalUrl:true,
                    params: {'obj': JSON.stringify(option)}
                });

                window.location.href = urlObj;

            }

            // 当body字段【是否代提】改变时 去员工档案中验证是否可以代提
            if (fieldId == 'custpage_field_replace') {
                // 提交人
                var submitter_id = currRec.getValue({fieldId: 'custpage_field_submitter'});
                // 当前用户
                var user_id = runtime.getCurrentUser().id;

                if (submitter_id == '') return;

                var obj = {
                    'api': 'runTime_fieldChanged',
                    'user_id': user_id,
                    'submitter_id': submitter_id
                };

                var urlObj = url.resolveScript({
                    scriptId: 'customscript_swc_sl_billspayable',
                    deploymentId: 'customdeploy_swc_sl_billspayable',
                    // returnExternalUrl:true,
                    // params: {}
                });

                var responseBody = https.post({
                    url: urlObj,
                    body: {"obj": JSON.stringify(obj)}
                }).body;

                if (responseBody) {
                    if (responseBody == 'A1') {
                        alert(translateUtil.translate("不可以代提该需求者"));
                        currRec.setValue({fieldId: 'custpage_field_replace', value: false, ignoreFieldChange: true});
                    }

                    if (responseBody == 'A2') {
                        alert(translateUtil.translate("没有代提权限"));
                        currRec.setValue({fieldId: 'custpage_field_replace', value: false, ignoreFieldChange: true});
                    }
                }

            }

            // 当body字段【提交人】改变时 将【是否代提】去掉打勾
            if (fieldId == 'custpage_field_submitter') {
                currRec.setValue({fieldId: 'custpage_field_replace', value: false, ignoreFieldChange: true});
            }

            // 当body字段【供应商】改变时 将 相关信息带过来
            if (fieldId == 'custpage_field_suppliername') {
                // 供应商id
                var supplier_id = currRec.getValue({fieldId: 'custpage_field_suppliername'});
                // 付款方式
                var payWay = currRec.getValue({fieldId: 'custpage_field_pay'});
                if (payWay == '1') {
                    if (supplier_id == '') {
                        currRec.setValue({fieldId: 'custpage_field_vendor_bank_name', value: ' '});
                        currRec.setValue({fieldId: 'custpage_field_vendor_bank_account', value: ' '});
                        currRec.setValue({fieldId: 'custpage_field_vendor_bank_city', value: ' '});
                        currRec.setValue({fieldId: 'custpage_field_swift_code', value: ' '});
                        currRec.setValue({fieldId: 'custpage_field_routing_transit', value: ''});
                    }

                    // 供应商为空的场合，结束处理
                    if (!supplier_id) return;

                    var obj = {
                        'api': 'get_supplier_data',
                        'supplier_id': supplier_id
                    };

                    var urlObj = url.resolveScript({
                        scriptId: 'customscript_swc_sl_billspayable',
                        deploymentId: 'customdeploy_swc_sl_billspayable',
                        // returnExternalUrl:true,
                        // params: {}
                    });

                    var responseBody = https.post({
                        url: urlObj,
                        body: {"obj": JSON.stringify(obj)}
                    }).body;

                    if (responseBody) {
                        var returnData = JSON.parse(responseBody);

                        if (returnData.vendor_bank_name) currRec.setValue({fieldId: 'custpage_field_vendor_bank_name', value: returnData.vendor_bank_name});
                        if (returnData.vendor_bank_account) currRec.setValue({fieldId: 'custpage_field_vendor_bank_account', value: returnData.vendor_bank_account});
                        if (returnData.vendor_bank_city) currRec.setValue({fieldId: 'custpage_field_vendor_bank_city', value: returnData.vendor_bank_city});
                        if (returnData.swift_code) currRec.setValue({fieldId: 'custpage_field_swift_code', value: returnData.swift_code});
                        if (returnData.routing_transit) currRec.setValue({fieldId: 'custpage_field_routing_transit', value: returnData.routing_transit});

                    }
                }

            }

        }

        /**
         * 获取页面body字段的值
         * @param currRec 当前表单对象
         * @param flag 判断标识 字段改变触发(true) / 点击按钮 (false)
         * @return {{po_num: (*|string), submitter: (*|string), w9tax: (*|string), w8tax: (*|string), other: (*|string), pay_amount: (*|string), description: (*|string), expectation_date: (*|string), pay_way: (*|string), belongTo: (*|string), currency: (*|string), pay_body: (*|string), department: (*|string), supplier_name: (*|string), replaceFlag: (*|boolean)}}
         */
        function getBodyValue(currRec, flag) {
            // 采购订单编号
            var po_num = currRec.getValue({fieldId: 'custpage_field_po'});
            if (po_num) {
                var poNum = po_num.trim();
            }
            // 提交人
            var submitter = currRec.getValue({fieldId: 'custpage_field_submitter'});
            // 所属部门
            var department = currRec.getValue({fieldId: 'custpage_field_department'});
            // isLinkToPa
            var isLinkToPa = currRec.getValue({fieldId: 'custpage_is_link_to_pa'});
            // 预算所属部门
            var belongTo = currRec.getValue({fieldId: 'custpage_field_belongto'});
            // 是否代提
            var replaceFlag = currRec.getValue({fieldId: 'custpage_field_replace'});
            // 事由描述
            var description = currRec.getValue({fieldId: 'custpage_field_description'});
            // 付款方式
            var pay_way = currRec.getValue({fieldId: 'custpage_field_pay'});
            // 币种
            var currency = currRec.getValue({fieldId: 'custpage_field_currency'});
            // 付款金额
            var pay_amount = currRec.getValue({fieldId: 'custpage_field_payamount'});
            // 付款主体
            var pay_body = currRec.getValue({fieldId: 'custpage_field_paybody'});
            // 供应商名称
            var supplier_name = currRec.getValue({fieldId: 'custpage_field_suppliername'});
            // 期望付款时间
            var expectation_date = currRec.getText({fieldId: 'custpage_field_expectationdate'});
            // // w8税表
            // var w8tax = currRec.getValue({fieldId: 'custpage_field_w8tax'});
            // // w9税表
            // var w9tax = currRec.getValue({fieldId: 'custpage_field_w9tax'});
            // // 结算单等其他支持性文件
            // var other = currRec.getValue({fieldId: 'custpage_field_other'});
            // 发票附件1
            var invoice = currRec.getValue({fieldId: 'custpage_field_invoice'});

            // 页面隐藏字段 查询标识 判断页面数据是否是查询出的结果
            var query_flag = currRec.getValue({fieldId: 'custpage_field_query_flag'});

            // 超申请理由
            var reason = currRec.getValue({fieldId: 'custpage_field_reason'});

            var option = {
                'po_num': poNum || '',
                'submitter': submitter || '',
                'department': department || '',
                'isLinkToPa' : isLinkToPa || '',
                'belongTo': belongTo || '',
                'replaceFlag': replaceFlag || false,
                'description': description || '',
                'pay_way': pay_way || '',
                'currency': currency || '',
                'pay_amount': pay_amount || '',
                'pay_body': pay_body || '',
                'supplier_name': supplier_name || '',
                'expectation_date': expectation_date || '',
                'query_flag': query_flag || false,
                'reason': reason,
                'invoice': invoice,
                // 'w8tax': w8tax || '',
                // 'w9tax': w9tax || '',
                // 'other': other || ''
            }

            if (flag) {
                return option;
            } else {

                if (pay_way == '1') {
                    // VENDOR BANK NAME
                    var vendor_bank_name = currRec.getValue({fieldId: 'custpage_field_vendor_bank_name'});
                    // SWIFT CODE
                    var swift_code = currRec.getValue({fieldId: 'custpage_field_swift_code'});
                    // INVOICE编号
                    var invoice_num = currRec.getValue({fieldId: 'custpage_field_invoice_num'});
                    // VENDOR BANK ACCOUNT NO.
                    var vendor_bank_account = currRec.getValue({fieldId: 'custpage_field_vendor_bank_account'});
                    // ROUTING & TRANSIT NO.
                    var routing_transit = currRec.getValue({fieldId: 'custpage_field_routing_transit'});

                    // VENDOR BANK CITY OR STATE
                    var vendor_bank_city = currRec.getValue({fieldId: 'custpage_field_vendor_bank_city'});

                    option.vendor_bank_name = vendor_bank_name || '';
                    option.swift_code = swift_code || '';
                    option.invoice_num = invoice_num || '';
                    option.vendor_bank_account = vendor_bank_account || '';
                    option.routing_transit = routing_transit || '';
                    // option.invoice = invoice || '';
                    option.vendor_bank_city = vendor_bank_city || '';


                    return option;

                } else if (pay_way == '2' || pay_way == '4') {
                    // 付款周期
                    var pay_period = currRec.getValue({fieldId: 'custpage_field_payperiod'});
                    // 报价单
                    // var quotation = currRec.getValue({fieldId: 'custpage_field_quotation'});

                    option.pay_period = pay_period || '';
                    // option.quotation = quotation || '';

                    return option;

                } else if (pay_way == '3') {
                    // 收款人全名
                    var payee_name = currRec.getValue({fieldId: 'custpage_field_payeename'});
                    // 收款人联系电话
                    var payee_phone = currRec.getValue({fieldId: 'custpage_field_payeephone'});
                    // 收款人邮箱
                    var payee_email = currRec.getValue({fieldId: 'custpage_field_payeeemail'});
                    // 收款人收件地址
                    var payee_address = currRec.getValue({fieldId: 'custpage_field_payeeaddress'});

                    option.payee_name = payee_name || '';
                    option.payee_phone = payee_phone || '';
                    option.payee_email = payee_email || '';
                    option.payee_address = payee_address || '';

                    return option;

                } else {
                    alert(translateUtil.translate('请填写付款方式！'));
                    return;
                }
            }

        }


        // /**
        //  * 计算body字段【付款金额】
        //  * @param currRec 当前表单
        //  */
        // function setPayAmount(currRec) {
        //     // 金额 总计
        //     var amount_body = 0;
        //
        //     var lineCount = currRec.getLineCount({sublistId: 'custpage_sublist'});
        //
        //
        //     for (var i = 0; i < lineCount; i++) {
        //         currRec.selectLine({
        //             sublistId: 'custpage_sublist',
        //             line: i
        //         });
        //         // 勾选框
        //         var checkBox = currRec.getSublistValue({
        //             sublistId: 'custpage_sublist',
        //             fieldId: 'custpage_sub_check',
        //             line: i
        //         });
        //         if (checkBox == 'T' || checkBox == true) {
        //             // 总金额
        //             var amount_sub = currRec.getCurrentSublistValue({
        //                 sublistId: 'custpage_sublist',
        //                 fieldId: 'custpage_sub_total',
        //                 // line: i
        //             });
        //
        //             amount_body += Number(amount_sub);
        //         }
        //
        //     }
        //
        //     currRec.setValue({fieldId: 'custpage_field_payamount', value: amount_body});
        //
        // }

        // /**
        //  * 计算body字段【付款金额】
        //  * @param currRec 当前表单
        //  */
        // function setPayAmount2(currRec) {
        //     // 金额 总计
        //     var amount_body = 0;
        //
        //     var lineCount = currRec.getLineCount({sublistId: 'custpage_sublist'});
        //
        //     for (var i = 0; i < lineCount; i++) {
        //
        //         // 勾选框
        //         var checkBox = currRec.getSublistValue({
        //             sublistId: 'custpage_sublist',
        //             fieldId: 'custpage_sub_check',
        //             line: i
        //         });
        //         alert(checkBox);
        //         if (checkBox == 'T' || checkBox == true) {
        //             // 总金额
        //             var amount_sub = currRec.getCurrentSublistValue({
        //                 sublistId: 'custpage_sublist',
        //                 fieldId: 'custpage_sub_total',
        //                 // line: i
        //             });
        //
        //             amount_body += Number(amount_sub);
        //             alert(amount_body);
        //         }
        //
        //     }
        //
        //     currRec.setValue({fieldId: 'custpage_field_payamount', value: amount_body});
        //
        // }


        /**
         * Validation function to be executed when record is saved.
         *
         * @param {Object} scriptContext
         * @param {Record} scriptContext.currentRecord - Current form record
         * @returns {boolean} Return true if record is valid
         *
         * @since 2015.2
         */
        function saveRecord(scriptContext) {
            debugger;
            var currRec = scriptContext.currentRecord;


            // 【采购订单】不为空 && 未点击查询按钮的场合，提示：已输入【采购订单】请执行【查询】功能后再提交
            var custpage_field_po = currRec.getValue({fieldId: "custpage_field_po"});
            if (custpage_field_po) {
                // 根据明细行是否存在指定采购订单是否存在
                var lineCt = currRec.getLineCount({sublistId: "custpage_sublist"});
                // 默认值不存在采购订单对应的明细行
                var flag = false;
                for (var i = 0; i < lineCt; i++) {
                    currRec.selectLine({sublistId: "custpage_sublist", line: i});
                    // 明细行采购订单id
                    var linePoId = currRec.getCurrentSublistValue({sublistId: "custpage_sublist", fieldId: "custpage_sub_internalid_txt"});
                    if (linePoId == custpage_field_po) {
                        flag = true;
                    }
                }
                if (!flag) {
                    alert(translateUtil.translate('【采购订单】不存在明细行或未执行【查询】功能'));
                    return false;
                }
            }

            // 获取body字段值
            var filterJsonOption = getBodyValue(currRec, false);
            // 付款方式为空的场合，终止后续处理
            if (!filterJsonOption) return false;

            var promptText = '';
            if (!filterJsonOption.submitter) {
                promptText += translateUtil.translate('提交人，不能为空！') + "\n";
            }
            if (!filterJsonOption.currency) {
                promptText += translateUtil.translate('币种，不能为空！') + "\n";
            }
            if (!filterJsonOption.pay_body) {
                promptText += translateUtil.translate('付款主体，不能为空！') + '\n';
            }
            if (!filterJsonOption.supplier_name) {
                promptText += translateUtil.translate('供应商名称，不能为空！') + '\n';
            }
            if (!filterJsonOption.department) {
                promptText += translateUtil.translate('所属部门，不能为空！') + '\n';
            }
            if (!filterJsonOption.expectation_date) {
                promptText += translateUtil.translate('期望付款时间，不能为空！') + "\n";
            }
            if (filterJsonOption.pay_way == '1' && !filterJsonOption.vendor_bank_name) {
                promptText += 'VENDOR BANK NAME' + translateUtil.translate('，不能为空！') + "\n";
            }
            if (filterJsonOption.pay_way == '1' && !filterJsonOption.swift_code) {
                promptText += 'SWIFT CODE' + translateUtil.translate('，不能为空！') + "\n";
            }
            if (filterJsonOption.pay_way == '1' && !filterJsonOption.invoice_num) {
                promptText += translateUtil.translate('INVOICE编号') + translateUtil.translate('，不能为空！') + "\n";
            }
            if (filterJsonOption.pay_way == '1' && !filterJsonOption.vendor_bank_account) {
                promptText += 'VENDOR BANK ACCOUNT NO' + translateUtil.translate('，不能为空！') + "\n";
            }
            if (filterJsonOption.pay_way == '1' && !filterJsonOption.routing_transit) {
                promptText += 'ROUTING & TRANSIT NO' + translateUtil.translate('，不能为空！') + "\n";
            }
            if (filterJsonOption.pay_way == '1' && !filterJsonOption.invoice) {
                promptText += translateUtil.translate('发票附件') + '1' + translateUtil.translate('，不能为空！') + "\n";
            }
            // 事由描述为空的场合，提示：请输入值： 事由描述/Please enter value(s) for: Reason
            if (!filterJsonOption.description || filterJsonOption.description.trim() == "") {
                promptText += translateUtil.translate('事由描述') + translateUtil.translate('，不能为空！') + "\n";
            }

            if (promptText != '') {
                alert(promptText);
                return;
            }

            var verification_item_obj = {
                'api': 'verification_item_data'
            }
            // 验证货品有税项数组
            var verification_item_arr = [];

            var urlObj3 = url.resolveScript({
                scriptId: 'customscript_swc_sl_billspayable',
                deploymentId: 'customdeploy_swc_sl_billspayable',
                // returnExternalUrl:true,
                // params: {'filterJsonOption': JSON.stringify(filterJsonOption)}
            });

            var responseBody3 = https.post({
                url: urlObj3,
                body: {"obj": JSON.stringify(verification_item_obj)}
            }).body;

            if (responseBody3) {
                var returnData3 = JSON.parse(responseBody3);
                verification_item_arr = returnData3.arr;
                // console.log("全部有税项的数组：" + verification_item_arr);
            }

            if (filterJsonOption.pay_way == '1') {

                if (filterJsonOption.invoice_num != '') {
                    var verification_obj = {
                        'api': 'verification_invoice_num',
                        'invoice_num': filterJsonOption.invoice_num
                    }

                    var urlObj2 = url.resolveScript({
                        scriptId: 'customscript_swc_sl_billspayable',
                        deploymentId: 'customdeploy_swc_sl_billspayable',
                        // returnExternalUrl:true,
                        // params: {'filterJsonOption': JSON.stringify(filterJsonOption)}
                    });

                    var responseBody2 = https.post({
                        url: urlObj2,
                        body: {"obj": JSON.stringify(verification_obj)}
                    }).body;

                    if (responseBody2) {
                        var returnData2 = JSON.parse(responseBody2);

                        if (returnData2.check_invoice_flag == true) {
                            var r = confirm(translateUtil.translate('INVOICE NO. 重复，请确认是否继续提交!'));

                            if (!r) {
                                return;
                            }
                        }
                    }
                } else {
                    alert('INVOICE NO' + translateUtil.translate('，不能为空！'));
                    return;
                }

            }

            // 已开票总金额
            var bill_total = currRec.getValue({fieldId: 'custpage_field_bill_total'});
            // 采购订单总金额
            var po_total = currRec.getValue({fieldId: 'custpage_field_po_total'});
            // 货币id 将金额转化为美元
            var currency_id = currRec.getValue({fieldId: 'custpage_field_currency'});

            var lineCount = currRec.getLineCount({sublistId: 'custpage_sublist'});
            // 计算 整个子列表勾选的总金额
            var countAmount = 0;

            // 需要生成账单的数据 [{}, ...]
            var objArr = [];
            // 需要提交的数据 key ['货品id_金额', ...]
            var keyArr = [];
            // 计数 判断是否有勾选数据
            var count_a = 0;

            // 行提示文本
            var line_prompt_text = '';
            var line_promptText = '';

            //预算归属部门一致性标识
            var dpFlag = false; //edit quyefa 2024-11-25
            for (var i = 0; i < lineCount; i++) {
                currRec.selectLine({
                    sublistId: 'custpage_sublist',
                    line: i
                })
                // 勾选框
                var checkBox = currRec.getSublistValue({
                    sublistId: 'custpage_sublist',
                    fieldId: 'custpage_sub_check',
                    line: i
                });

                if (checkBox == 'T' || checkBox == true) {
                    var obj = {};

                    obj.internalid = currRec.getCurrentSublistValue({
                        sublistId: 'custpage_sublist',
                        fieldId: 'custpage_sub_internalid',
                        // line: i
                    });

                    // 货品
                    obj.item = currRec.getCurrentSublistValue({
                        sublistId: 'custpage_sublist',
                        fieldId: 'custpage_sub_item',
                        // line: i
                    });


                    obj.itemText = currRec.getCurrentSublistValue({
                        sublistId: 'custpage_sublist',
                        fieldId: 'custpage_sub_itemtext',
                        // line: i
                    });
                    //edit start quyefa 2024-11-25
                    var d1 = currRec.getCurrentSublistValue({
                        sublistId: 'custpage_sublist',
                        fieldId: 'custpage_sub_budget'
                    });

                    var d2 = currRec.getCurrentSublistValue({
                        sublistId: 'custpage_sublist',
                        fieldId: 'custpage_sub_budget_hid'
                    });
                    if(d1 != d2){
                        dpFlag = true;
                    }
                    //edit end quyefa 2024-11-25
                    // // 数量
                    // obj.quantity = currRec.getCurrentSublistValue({
                    //     sublistId: 'custpage_sublist',
                    //     fieldId: 'custpage_sub_quantity',
                    //     // line: i
                    // });
                    //
                    // // 价格
                    // obj.price = currRec.getCurrentSublistValue({
                    //     sublistId: 'custpage_sublist',
                    //     fieldId: 'custpage_sub_price',
                    //     // line: i
                    // });
                    //
                    //
                    //
                    // obj.pricetext = currRec.getCurrentSublistValue({
                    //     sublistId: 'custpage_sublist',
                    //     fieldId: 'custpage_sub_pricetext',
                    //     // line: i
                    // });
                    //
                    // // 税码
                    // obj.taxcode = currRec.getCurrentSublistValue({
                    //     sublistId: 'custpage_sublist',
                    //     fieldId: 'custpage_sub_tax',
                    //     // line: i
                    // });
                    //
                    // // 税额
                    // obj.taxPrice = currRec.getCurrentSublistValue({
                    //     sublistId: 'custpage_sublist',
                    //     fieldId: 'custpage_sub_taxprice',
                    //     // line: i
                    // });
                    //
                    // // 金额
                    // obj.amount_line = currRec.getCurrentSublistValue({
                    //     sublistId: 'custpage_sublist',
                    //     fieldId: 'custpage_sub_money',
                    //     // line: i
                    // });

                    // 总金额
                    var amount = currRec.getCurrentSublistValue({
                        sublistId: 'custpage_sublist',
                        fieldId: 'custpage_sub_total',
                        // line: i
                    });

                    // alert("总金额:"+amount)

                    obj.department_line = currRec.getCurrentSublistValue({
                        sublistId: 'custpage_sublist',
                        fieldId: 'custpage_sub_budget',
                        // line: i
                    });
                    var line_num = i + 1;
                    if (obj.department_line == '') {
                        line_prompt_text += translateUtil.translate('预算归属部门');
                    }

                    if (amount == '') {
                        if (line_prompt_text == '') {
                            line_prompt_text += translateUtil.translate('支付金额');
                        } else {
                            line_prompt_text += '、' + translateUtil.translate('支付金额');
                        }
                    }

                    if (line_prompt_text) {
                        line_promptText = translateUtil.translate('第') + line_num + translateUtil.translate('行：') + line_prompt_text + translateUtil.translate('，不能为空！') + '\n';
                    }

                    obj.amount = amount;

                    // 行id
                    obj.lineNum = currRec.getCurrentSublistValue({
                        sublistId: 'custpage_sublist',
                        fieldId: 'custpage_sub_linenum',
                        // line: i
                    });

                    // 账单
                    obj.pro = currRec.getCurrentSublistValue({
                        sublistId: 'custpage_sublist',
                        fieldId: 'custpage_sub_project',
                    });


                    // Payable Accrual
                    obj.payableAccrual = currRec.getCurrentSublistValue({
                        sublistId: 'custpage_sublist',
                        fieldId: 'custpage_sub_payable_accrual',
                    });


                    objArr.push(obj);
                    countAmount += amount;
                    count_a++;
                }
            }

            if (line_promptText != '') {
                alert(line_promptText);
                return;
            }

            // alert('货币：' + currency_id);

            // 获取美元的税率
            var rate_USD = currency.exchangeRate({
                source: currency_id,
                target: 'USD',
                date: new Date(),
            });

            // alert('税率：' + rate_USD);

            var usd_amount = rate_USD * Number(countAmount);

            // alert('美元：' + usd_amount);

            // alert(JSON.stringify(objArr));

            // 获取文件
            // 发票附件
            var invoice_file = document.getElementsByName("custpage_field_invoice")[0];
            var invoice_file_value = currRec.getValue({fieldId: 'custpage_field_invoice'});

            if (filterJsonOption.pay_way == '1') {

            } else if (filterJsonOption.pay_way == '2' || filterJsonOption.pay_way == '4') {
                // 报价单
                var quotation_file = document.getElementsByName("custpage_field_quotation")[0];
                var quotation_file_value = currRec.getValue({fieldId: 'custpage_field_quotation'});
            }

            // W-8税表
            var w8tax_file = document.getElementsByName("custpage_field_w8tax")[0];
            var w8tax_file_value = currRec.getValue({fieldId: 'custpage_field_w8tax'});
            // W-9税表
            var w9tax_file = document.getElementsByName("custpage_field_w9tax")[0];
            var w9tax_file_value = currRec.getValue({fieldId: 'custpage_field_w9tax'});
            // 结算单等其他支持性文件
            var other_file = document.getElementsByName("custpage_field_other")[0];
            var other_file_value = currRec.getValue({fieldId: 'custpage_field_other'});

            if ((w8tax_file_value && w8tax_file.files[0].size > 5242880) ||
                (w9tax_file_value && w9tax_file.files[0].size > 5242880) ||
                (other_file_value && other_file.files[0].size > 5242880) ||
                (invoice_file_value && invoice_file.files[0].size > 5242880) ||
                (quotation_file_value && quotation_file.files[0].size > 5242880)) {
                alert(translateUtil.translate("大小不能超过5Mb，请核对文件大小！"));
                return;
            }


            // 判断是否有提交的数据
            if (count_a == 0) {
                alert(translateUtil.translate('请勾选需要提交的数据'));
                return;
            }

            if (filterJsonOption.query_flag) {
                var  po_total_1_ = po_total * 1.10;
                // alert("采购订单*10%："+ po_total_1_);
                // 判断勾选数据的总金额是否超出采购订单总金额的10%
                if ((countAmount + bill_total) > po_total_1_) {
                    alert(translateUtil.translate('该申请金额已超采购申请10%，不允许提交。'));
                    return;
                }
                // 判断勾选数据的总金额是否超出采购订单总金额并且小于采购订单总金额的10%
                if (((countAmount + bill_total) > po_total) && ((countAmount + bill_total) <= po_total_1_)) {
                    // alert("aaaaaaaa");
                    if (!filterJsonOption.reason) {
                        alert(translateUtil.translate('该申请金额已超采购申请（但未超过10%），请确认。如需提交请填写【超申请理由】'));
                        return;
                    }

                }
            }


            if (filterJsonOption.po_num == '') {
                for (var i = 0; i < objArr.length; i++) {
                    // console.log("objArr.item：" + objArr[i].item);
                    // console.log('verification_item_arr.indexOf(objArr[i].item):'+ verification_item_arr.indexOf(objArr[i].item));
                    // console.log('usd_amount:'+ usd_amount);
                    if (verification_item_arr.indexOf(objArr[i].item) < 0) {
                        if (usd_amount >  1000) {
                            alert(translateUtil.translate('采购订单为必填项，请验证操作流程是否正确'));
                            return;
                        }

                    }
                }
            } else {
                // 当采购订单存在的场合，校验采购订单行是否有效
                try {
                    var urlObj = url.resolveScript({
                        scriptId: 'customscript_swc_sl_billspayable',
                        deploymentId: 'customdeploy_swc_sl_billspayable'
                    });
                    var param = {
                        obj: JSON.stringify({
                            api: "verifyPurchOrdExist",
                            purchOrdNum: filterJsonOption.po_num
                        })
                    };
                    var responseBody = https.post({
                        url: urlObj,
                        body: param
                    });

                    if (responseBody && responseBody.code == 200) {
                        var resp = JSON.parse(responseBody.body);
                        if (!resp.result) {
                            // 提示错误：采购订单不存在或不存在可操作数据
                            alert(translateUtil.translate('采购订单不存在或不存在可操作数据'));
                            return;
                        }

                        // 2025-06-13 HC ADD
                        // 校验付款主体是否和采购订单子公司一致
                        if (filterJsonOption.pay_body != resp.poSubsidiary) {
                            alert(translateUtil.translate("账单申请主体要与采购申请一致，如果不一致请重新做采购申请。"));
                            return false;
                        }
                    } else {
                        // 错误信息：执行异常，请重试
                        alert(translateUtil.translate('执行异常，请重试'));
                        return;
                    }
                } catch (e) {
                    alert(e)
                    return;
                }
            }

            filterJsonOption.po_id = objArr[0].internalid;

            var option = {
                'api': 'submit',
                'objArr': objArr,
                'keyArr': keyArr,
                'filterJsonOption': filterJsonOption
            }
            log.audit({title: 'objArr', details: objArr});

            // 补丁：保存数据到POST请求提交参数
            currRec.setValue({fieldId: "custpage_field_option", value: JSON.stringify(option)});

            // var urlObj1 = url.resolveScript({
            //     scriptId: 'customscript_swc_sl_billspayable',
            //     deploymentId: 'customdeploy_swc_sl_billspayable',
            //     // returnExternalUrl:true,
            //     params: {'filterJsonOption': JSON.stringify(filterJsonOption)}
            // });
            //
            // var responseBody = https.post({
            //     url: urlObj1,
            //     body: {"obj": JSON.stringify(option)}
            // }).body;
            //
            // if (responseBody) {
            //
            //     var returnData = JSON.parse(responseBody);
            //
            //     if (!returnData.flag) return;
            //     alert(translateUtil.translate('付款申请已提交成功！'));
            //
            //
            //     if (w8tax_file_value) {
            //         uploadFile(w8tax_file, returnData, 'custrecord_ap_invoice_attachment2');
            //     }
            //
            //     if (w9tax_file_value) {
            //         uploadFile(w9tax_file, returnData, 'custrecord_ap_invoice_attachment3');
            //     }
            //
            //     if (other_file_value) {
            //         uploadFile(other_file, returnData, 'custrecord_ap_other_supportdoc');
            //     }
            //
            //     if (invoice_file_value) {
            //         uploadFile(invoice_file, returnData, 'custrecord_ap_invoice_attachment');
            //     }
            //
            //     if (quotation_file_value) {
            //         uploadFile(quotation_file, returnData, 'custrecord_ap_quotation');
            //
            //     }
            //
            //     window.onbeforeunload = null;
            //
            //     if (filterJsonOption.query_flag) {
            //         window.location.href = urlObj1 + '&again=true';
            //     } else {
            //         window.location.href = urlObj1 + '&emptyFlag=true';
            //     }
            //
            // }

            //edit start quyefa 2024-11-25
            //获取采购订单的币种和采购订单id
            var poId = "";
            var po_currency = "";
            var po_subsidiary = "";
            if (custpage_field_po) {
                //
                var purchaseorderSearchObj = search.create({
                    type: "purchaseorder",
                    filters:
                        [
                            ["type", "anyof", "PurchOrd"],
                            "AND",
                            ["numbertext", "is", custpage_field_po],
                            "AND",
                            ["mainline", "is", "T"]
                        ],
                    columns:
                        [
                            search.createColumn({name: "internalid", label: "内部 ID"}),
                            search.createColumn({name: "currency", label: "货币"}),
                            search.createColumn({name: "subsidiary", label: "子公司"})
                        ]
                });
                var searchResultCount = purchaseorderSearchObj.runPaged().count;
                if(searchResultCount > 0){
                    purchaseorderSearchObj.run().each(function(result){
                        poId = result.getValue({name: "internalid"});
                        po_currency = result.getValue({name: "currency"});
                        po_subsidiary = result.getValue({name: "subsidiary"});
                        return true;
                    });
                    if(currency_id != po_currency){
                        var msg = translateUtil.translate("本次支付币种与采购申请单的支付币种不一致，请确认是否准确！若本次支付币种无误，请点击 “OK” 继续提交；若本次填写有误，请点击 “Cancel” 修改后继续提交。");
                        if(confirm(msg)==true){
                            //return true;
                        }else {
                            return false;
                        }
                    }

                    // 2025-06-12 HC ADD
                    // 采购订单不为空，校验付款主体是否和PR一致
                    if (filterJsonOption.pay_body != po_subsidiary) {
                        var subMsg = translateUtil.translate("账单申请主体要与采购申请一致，如果不一致请重新做采购申请。");
                        alert(subMsg);
                        return false;
                    }
                }
            }

            if(dpFlag){
                var msg = translateUtil.translate("本次预算归属部门与采购申请单上的预算归属部门不一致，请确认是否准确！若本次填写无误，请点击 “OK” 继续提交；若本次填写有误，请点击 “Cancel” 修改后继续提交。");
                if(confirm(msg)==true){
                    //return true;
                }else {
                    return false;
                }
            }
            try{
                //更新货币
                if(poId && currency_id != po_currency){
                    // alert("poId="+poId+"----------currency_id="+currency_id);
                    // var poRec = record.load({type:"purchaseorder",id:poId});
                    // poRec.setValue({fieldId:"currency",value:currency_id});
                    // poRec.save();
                    var poRec = nlapiLoadRecord("purchaseorder",poId);
                    poRec.setFieldValue("currency", currency_id);
                    nlapiSubmitRecord(poRec);

                    var customrecord_swc_purchase_requestSearchObj = search.create({
                        type: "customrecord_swc_purchase_request",
                        filters:
                            [
                                ["custrecord_prs_field.custrecord_prs_ponum","anyof",poId]
                            ],
                        columns:
                            [
                                search.createColumn({name: "internalid", label: "内部 ID"})
                            ]
                    });
                    var searchResultCount = customrecord_swc_purchase_requestSearchObj.runPaged().count;
                    if(searchResultCount>0){
                        var requestId = "";
                        customrecord_swc_purchase_requestSearchObj.run().each(function(result){
                            requestId = result.getValue({name: "internalid"});
                            return false;
                        });
                        var reRec = record.load({type:"customrecord_swc_purchase_request",id:requestId});
                        reRec.setValue({fieldId:"custrecord_pr_currency",value:currency_id});
                        reRec.save();
                    }
                }
            }catch (e) {
                alert(e.message);
                return false;
            }

            //edit end quyefa 2024-11-25
            return true;
        }

        /**
         * 全选
         */
        function markAll() {
            var curRec = currentRecord.get();
            var sublistLineCount = curRec.getLineCount({sublistId: 'custpage_sublist'});
            var payAmtSum = 0;
            for (var i = 0; i < sublistLineCount; i++) {
                curRec.selectLine({sublistId: 'custpage_sublist', line: i});

                curRec.setCurrentSublistValue({
                    sublistId: 'custpage_sublist',
                    fieldId: 'custpage_sub_check',
                    value: true,
                    ignoreFieldChange: true
                });
                // 累计支付金额
                var curPayAmt = curRec.getCurrentSublistValue({sublistId: "custpage_sublist", fieldId: "custpage_sub_total"});
                payAmtSum += Number(curPayAmt);

                curRec.commitLine({sublistId: 'custpage_sublist'});

            }

            // 全选的场合，本次付款金额等于支付金额总和
            curRec.setValue({fieldId: "custpage_field_payamount", value: payAmtSum});
        }

        /**
         * 全不选
         */
        function unmarkAll() {
            var curRec = currentRecord.get();
            var sublistLineCount = curRec.getLineCount({sublistId: 'custpage_sublist'});
            for (var i = 0; i < sublistLineCount; i++) {
                curRec.selectLine({sublistId: 'custpage_sublist', line: i});

                curRec.setCurrentSublistValue({
                    sublistId: 'custpage_sublist',
                    fieldId: 'custpage_sub_check',
                    value: false,
                    ignoreFieldChange: true
                });

                curRec.commitLine({sublistId: 'custpage_sublist'});
            }

            // 取消全选，清空本次付款金额
            currRec.setValue({fieldId: "custpage_field_payamount", value: 0});
        }

        /**
         * 查询
         */
        function queryData() {
            debugger;
            var currRec = currentRecord.get();
            // 获取所有body字段值
            var option = getBodyValue(currRec, false);

            option.api = 'query';

            if (option.po_num == '') {
                alert(translateUtil.translate('请填写采购订单编号！'));
                return;
            }

            // 取消提示框
            window.onbeforeunload = null;

            var urlObj = url.resolveScript({
                scriptId: 'customscript_swc_sl_billspayable',
                deploymentId: 'customdeploy_swc_sl_billspayable',
                // returnExternalUrl:true,
                params: {'obj': JSON.stringify(option)}
            });

            var responseBody = https.post({
                url: urlObj,
                body: {"obj": JSON.stringify(option)}
            }).body;

            if (responseBody == 'all') {
                alert(translateUtil.translate('该采购订单金额已全部支付!'));
                window.location.reload();
                return;
            } else {
                window.location.href = urlObj;
            }

        }

        /**
         * 提交
         */
        function submitData() {
            debugger;
            // 防止用户操作的时候改完 价格/数量 直接提交不触发fieldChanged 提交后随机点击一个位置先触发fieldChanged再走提交逻辑
            // jQuery("#fg_custpage_field_group1").click();

            var currRec = currentRecord.get();
            // 获取body字段值
            var filterJsonOption = getBodyValue(currRec, false);

            var promptText = '';
            if (!filterJsonOption.submitter) {
                promptText += translateUtil.translate('提交人，不能为空！') + "\n";
            }
            if (!filterJsonOption.currency) {
                promptText += translateUtil.translate('币种，不能为空！') + "\n";
            }
            if (!filterJsonOption.pay_body) {
                promptText += translateUtil.translate('付款主体，不能为空！') + '\n';
            }
            if (!filterJsonOption.supplier_name) {
                promptText += translateUtil.translate('供应商名称，不能为空！') + '\n';
            }
            if (!filterJsonOption.department) {
                promptText += translateUtil.translate('所属部门，不能为空！') + '\n';
            }
            if (!filterJsonOption.expectation_date) {
                promptText += translateUtil.translate('期望付款时间，不能为空！') + "\n";
            }
            if (filterJsonOption.pay_way == '1' && !filterJsonOption.vendor_bank_name) {
                promptText += translateUtil.translate('VENDOR BANK NAME，不能为空！') + "\n";
            }
            if (filterJsonOption.pay_way == '1' && !filterJsonOption.swift_code) {
                promptText += translateUtil.translate('SWIFT CODE，不能为空！') + "\n";
            }
            if (filterJsonOption.pay_way == '1' && !filterJsonOption.invoice_num) {
                promptText += translateUtil.translate('INVOICE编号，不能为空！') + "\n";
            }
            if (filterJsonOption.pay_way == '1' && !filterJsonOption.vendor_bank_account) {
                promptText += translateUtil.translate('VENDOR BANK ACCOUNT NO，不能为空！') + "\n";
            }
            if (filterJsonOption.pay_way == '1' && !filterJsonOption.routing_transit) {
                promptText += translateUtil.translate('ROUTING & TRANSIT NO，不能为空！') + "\n";
            }
            if (filterJsonOption.pay_way == '1' && !filterJsonOption.invoice) {
                promptText += translateUtil.translate('发票附件1，不能为空！') + "\n";
            }

            if (promptText != '') {
                alert(promptText);
                return;
            }

            var verification_item_obj = {
                'api': 'verification_item_data'
            }
            // 验证货品有税项数组
            var verification_item_arr = [];

            var urlObj3 = url.resolveScript({
                scriptId: 'customscript_swc_sl_billspayable',
                deploymentId: 'customdeploy_swc_sl_billspayable',
                // returnExternalUrl:true,
                // params: {'filterJsonOption': JSON.stringify(filterJsonOption)}
            });

            var responseBody3 = https.post({
                url: urlObj3,
                body: {"obj": JSON.stringify(verification_item_obj)}
            }).body;

            if (responseBody3) {
                var returnData3 = JSON.parse(responseBody3);
                verification_item_arr = returnData3.arr;
                // console.log("全部有税项的数组：" + verification_item_arr);
            }

            if (filterJsonOption.pay_way == '1') {

                if (filterJsonOption.invoice_num != '') {
                    var verification_obj = {
                        'api': 'verification_invoice_num',
                        'invoice_num': filterJsonOption.invoice_num
                    }

                    var urlObj2 = url.resolveScript({
                        scriptId: 'customscript_swc_sl_billspayable',
                        deploymentId: 'customdeploy_swc_sl_billspayable',
                        // returnExternalUrl:true,
                        // params: {'filterJsonOption': JSON.stringify(filterJsonOption)}
                    });

                    var responseBody2 = https.post({
                        url: urlObj2,
                        body: {"obj": JSON.stringify(verification_obj)}
                    }).body;

                    if (responseBody2) {
                        var returnData2 = JSON.parse(responseBody2);

                        if (returnData2.check_invoice_flag == true) {
                            var r = confirm('INVOICE NO. 重复，请确认是否继续提交!');

                            if (!r) {
                                return;
                            }
                        }
                    }
                } else {
                    alert('INVOICE NO.不能为空！');
                    return;
                }

            }

            // 已开票总金额
            var bill_total = currRec.getValue({fieldId: 'custpage_field_bill_total'});
            // 采购订单总金额
            var po_total = currRec.getValue({fieldId: 'custpage_field_po_total'});
            // 货币id 将金额转化为美元
            var currency_id = currRec.getValue({fieldId: 'custpage_field_currency'});

            var lineCount = currRec.getLineCount({sublistId: 'custpage_sublist'});
            // 计算 整个子列表勾选的总金额
            var countAmount = 0;

            // 需要生成账单的数据 [{}, ...]
            var objArr = [];
            // 需要提交的数据 key ['货品id_金额', ...]
            var keyArr = [];
            // 计数 判断是否有勾选数据
            var count_a = 0;

            // 行提示文本
            var line_prompt_text = '';
            var line_promptText = '';

            for (var i = 0; i < lineCount; i++) {
                currRec.selectLine({
                    sublistId: 'custpage_sublist',
                    line: i
                })
                // 勾选框
                var checkBox = currRec.getSublistValue({
                    sublistId: 'custpage_sublist',
                    fieldId: 'custpage_sub_check',
                    line: i
                });

                if (checkBox == 'T' || checkBox == true) {
                    var obj = {};

                    obj.internalid = currRec.getCurrentSublistValue({
                        sublistId: 'custpage_sublist',
                        fieldId: 'custpage_sub_internalid',
                        // line: i
                    });

                    // 货品
                    obj.item = currRec.getCurrentSublistValue({
                        sublistId: 'custpage_sublist',
                        fieldId: 'custpage_sub_item',
                        // line: i
                    });


                    obj.itemText = currRec.getCurrentSublistValue({
                        sublistId: 'custpage_sublist',
                        fieldId: 'custpage_sub_itemtext',
                        // line: i
                    });

                    // // 数量
                    // obj.quantity = currRec.getCurrentSublistValue({
                    //     sublistId: 'custpage_sublist',
                    //     fieldId: 'custpage_sub_quantity',
                    //     // line: i
                    // });
                    //
                    // // 价格
                    // obj.price = currRec.getCurrentSublistValue({
                    //     sublistId: 'custpage_sublist',
                    //     fieldId: 'custpage_sub_price',
                    //     // line: i
                    // });
                    //
                    //
                    //
                    // obj.pricetext = currRec.getCurrentSublistValue({
                    //     sublistId: 'custpage_sublist',
                    //     fieldId: 'custpage_sub_pricetext',
                    //     // line: i
                    // });
                    //
                    // // 税码
                    // obj.taxcode = currRec.getCurrentSublistValue({
                    //     sublistId: 'custpage_sublist',
                    //     fieldId: 'custpage_sub_tax',
                    //     // line: i
                    // });
                    //
                    // // 税额
                    // obj.taxPrice = currRec.getCurrentSublistValue({
                    //     sublistId: 'custpage_sublist',
                    //     fieldId: 'custpage_sub_taxprice',
                    //     // line: i
                    // });
                    //
                    // // 金额
                    // obj.amount_line = currRec.getCurrentSublistValue({
                    //     sublistId: 'custpage_sublist',
                    //     fieldId: 'custpage_sub_money',
                    //     // line: i
                    // });

                    // 总金额
                    var amount = currRec.getCurrentSublistValue({
                        sublistId: 'custpage_sublist',
                        fieldId: 'custpage_sub_total',
                        // line: i
                    });

                    // alert("总金额:"+amount)

                    obj.department_line = currRec.getCurrentSublistValue({
                        sublistId: 'custpage_sublist',
                        fieldId: 'custpage_sub_budget',
                        // line: i
                    });
                    var line_num = i + 1;
                    if (obj.department_line == '') {
                        line_prompt_text += translateUtil.translate('预算归属部门');
                    }

                    if (amount == '') {
                        if (line_prompt_text == '') {
                            line_prompt_text += translateUtil.translate('总金额');
                        } else {
                            line_prompt_text += '、' + translateUtil.translate('总金额');
                        }
                    }

                    if (line_prompt_text) {
                        line_promptText = translateUtil.translate('第') + line_num + translateUtil.translate('行：') + line_prompt_text + translateUtil.translate('，不能为空！') + '\n';
                    }

                    obj.amount = amount;

                    // 行id
                    obj.lineNum = currRec.getCurrentSublistValue({
                        sublistId: 'custpage_sublist',
                        fieldId: 'custpage_sub_linenum',
                        // line: i
                    });

                    // // 货币
                    // currency_id = currRec.getCurrentSublistValue({
                    //     sublistId: 'custpage_sublist',
                    //     fieldId: 'custpage_sub_currency',
                    //     // line: i
                    // });

                    // obj.key = obj.item + '_' + obj.pricetext;
                    // keyArr.push(obj.key);


                    // Payable Accrual
                    obj.payableAccrual = currRec.getCurrentSublistValue({
                        sublistId: 'custpage_sublist',
                        fieldId: 'custpage_sub_payable_accrual',
                    });

                    objArr.push(obj);
                    countAmount += amount;
                    count_a++;
                }
            }

            if (line_promptText != '') {
                alert(line_promptText);
                return;
            }

            // alert('货币：' + currency_id);

            // 获取美元的税率
            var rate_USD = currency.exchangeRate({
                source: currency_id,
                target: 'USD',
                date: new Date(),
            });

            // alert('税率：' + rate_USD);

            var usd_amount = rate_USD * Number(countAmount);

            // alert('美元：' + usd_amount);

            // alert(JSON.stringify(objArr));

            // 获取文件
            // 发票附件
            var invoice_file = document.getElementsByName("custpage_field_invoice");
            var invoice_file_value = currRec.getValue({fieldId: 'custpage_field_invoice'});

            if (filterJsonOption.pay_way == '1') {

            } else if (filterJsonOption.pay_way == '2' || filterJsonOption.pay_way == '4') {
                // 报价单
                var quotation_file = document.getElementsByName("custpage_field_quotation");
                var quotation_file_value = currRec.getValue({fieldId: 'custpage_field_quotation'});
            }

            // W-8税表
            var w8tax_file = document.getElementsByName("custpage_field_w8tax");
            var w8tax_file_value = currRec.getValue({fieldId: 'custpage_field_w8tax'});
            // W-9税表
            var w9tax_file = document.getElementsByName("custpage_field_w9tax");
            var w9tax_file_value = currRec.getValue({fieldId: 'custpage_field_w9tax'});
            // 结算单等其他支持性文件
            var other_file = document.getElementsByName("custpage_field_other");
            var other_file_value = currRec.getValue({fieldId: 'custpage_field_other'});

            if ((w8tax_file_value && w8tax_file.files[0].size > 5242880) ||
                (w9tax_file_value && w9tax_file.files[0].size > 5242880) ||
                (other_file_value && other_file.files[0].size > 5242880) ||
                (invoice_file_value && invoice_file.files[0].size > 5242880) ||
                (quotation_file_value && quotation_file.files[0].size > 5242880)) {
                alert(translateUtil.translate("大小不能超过5Mb，请核对文件大小！"));
                return;
            }


            // 判断是否有提交的数据
            if (count_a == 0) {
                alert(translateUtil.translate('请勾选需要提交的数据'));
                return;
            }

            if (filterJsonOption.query_flag) {
                var  po_total_1_ = po_total * 1.10;
                // alert("采购订单*10%："+ po_total_1_);
                // 判断勾选数据的总金额是否超出采购订单总金额的10%
                if ((countAmount + bill_total) > po_total_1_) {
                    alert(translateUtil.translate('该申请金额已超采购申请10%，不允许提交。'));
                    return;
                }
                // 判断勾选数据的总金额是否超出采购订单总金额并且小于采购订单总金额的10%
                if (((countAmount + bill_total) > po_total) && ((countAmount + bill_total) <= po_total_1_)) {
                    // alert("aaaaaaaa");
                    if (!filterJsonOption.reason) {
                        alert(translateUtil.translate('该申请金额已超采购申请（但未超过10%），请确认。如需提交请填写【超申请理由】'));
                        return;
                    }

                }
            }


            if (filterJsonOption.po_num == '') {
                for (var i = 0; i < objArr.length; i++) {
                    // console.log("objArr.item：" + objArr[i].item);
                    // console.log('verification_item_arr.indexOf(objArr[i].item):'+ verification_item_arr.indexOf(objArr[i].item));
                    // console.log('usd_amount:'+ usd_amount);
                    if (verification_item_arr.indexOf(objArr[i].item) < 0) {
                        if (usd_amount >  1000) {
                            alert(translateUtil.translate('采购订单为必填项，请验证操作流程是否正确'));
                            return;
                        }

                    }
                }
            }


            filterJsonOption.po_id = objArr[0].internalid;

            var option = {
                'api': 'submit',
                'objArr': objArr,
                'keyArr': keyArr,
                'filterJsonOption': filterJsonOption
            }

            var urlObj1 = url.resolveScript({
                scriptId: 'customscript_swc_sl_billspayable',
                deploymentId: 'customdeploy_swc_sl_billspayable',
                // returnExternalUrl:true,
                params: {'filterJsonOption': JSON.stringify(filterJsonOption)}
            });

            var responseBody = https.post({
                url: urlObj1,
                body: {"obj": JSON.stringify(option)}
            }).body;

            if (responseBody) {

                var returnData = JSON.parse(responseBody);

                if (!returnData.flag) return;
                alert(translateUtil.translate('付款申请已提交成功！'));


                if (w8tax_file_value) {
                    uploadFile(w8tax_file, returnData, 'custrecord_ap_invoice_attachment2');
                }

                if (w9tax_file_value) {
                    uploadFile(w9tax_file, returnData, 'custrecord_ap_invoice_attachment3');
                }

                if (other_file_value) {
                    uploadFile(other_file, returnData, 'custrecord_ap_other_supportdoc');
                }

                if (invoice_file_value) {
                    uploadFile(invoice_file, returnData, 'custrecord_ap_invoice_attachment');
                }

                if (quotation_file_value) {
                    uploadFile(quotation_file, returnData, 'custrecord_ap_quotation');

                }

                window.onbeforeunload = null;

                if (filterJsonOption.query_flag) {
                    window.location.href = urlObj1 + '&again=true';
                } else {
                    window.location.href = urlObj1 + '&emptyFlag=true';
                }

            }

        }


        function uploadFile(doc, returnData, fieldId) {

            if (doc.files[0]) {
                var fileNm = doc.files[0].name;
                var sliceIndex = fileNm.lastIndexOf(".");
                var fileType = fileNm.substring(sliceIndex + 1, fileNm.length);
                var fileData = fileNm.substring(0, sliceIndex);
                // var fileSize = doc.files[0].size;

                log.audit({title: 'fileType', details: fileType});

                for (var i = 0; i < doc.files.length; i++) {
                    var file = doc.files[i];

                    var reader = new FileReader();

                    reader.readAsDataURL(file);

                    var urlObj = url.resolveScript({
                        scriptId: 'customscript_swc_sl_billspayable',
                        deploymentId: 'customdeploy_swc_sl_billspayable',
                        returnExternalUrl: true,
                    });

                    reader.onload = function (e) {
                        var obj = {
                            'api': 'onload_up',
                            'body_': {
                                "contents": e.target.result,
                                "type": fileType,
                                "recId": returnData.billApplyID,
                                "fieldId": fieldId
                            }
                        }

                        var responseBody = https.post({
                            url: urlObj,
                            body: {'obj': JSON.stringify(obj)}
                        }).body;

                    }
                }
            }

        }


        function _lineInit(context) {
            var element = '<td width="1" class="uir-machinebutton-separator tdt-point" bgcolor="#616161"><span>&nbsp;</span></td>' +
                '<td class="tdt-point">预算归属部门不能填写为一级部门：NA & EMEA /APAC/JBG/CBG/CEG/CSG/RDG</td>';
            $('#line_buttons').find('tr:first').append(element);
        }


        /**
         * Validation function to be executed when sublist line is committed.
         *
         * @param {Object} scriptContext
         * @param {Record} scriptContext.currentRecord - Current form record
         * @param {string} scriptContext.sublistId - Sublist name
         *
         * @returns {boolean} Return true if sublist line is valid
         *
         * @since 2015.2
         */
        function validateLine(scriptContext) {
            debugger;
            var currRec = scriptContext.currentRecord;

            // 计算本次付款金额
            var itemLineCount = currRec.getLineCount({sublistId: "custpage_sublist"});
            var curIndex = currRec.getCurrentSublistIndex({sublistId: "custpage_sublist"});
            var payAmtSum = 0;
            for (var i = 0; i < itemLineCount; i++) {
                // 跳过当前未提交的行
                if (curIndex == i) continue;
                var chkTmp = currRec.getSublistValue({sublistId: "custpage_sublist", fieldId: "custpage_sub_check", line: i});
                if (chkTmp) {
                    var payAmtTmp = currRec.getSublistValue({sublistId: "custpage_sublist", fieldId: "custpage_sub_total", line: i});
                    payAmtSum += Number(payAmtTmp);
                }
            }
            // 计算当前行
            var curChk = currRec.getCurrentSublistValue({sublistId: "custpage_sublist", fieldId: "custpage_sub_check"});
            if (curChk) {
                var curPayAmt = currRec.getCurrentSublistValue({sublistId: "custpage_sublist", fieldId: "custpage_sub_total"});
                payAmtSum += Number(curPayAmt);
            }
            // 本次付款金额
            currRec.setValue({fieldId: "custpage_field_payamount", value: payAmtSum});

            // 项目默认值设定
            // 当采购订单为空 && 费用明细行项目为空的场合，项目默认值设定：X0000 N/A
            // 采购订单
            var purchNun = currRec.getValue({fieldId: "custpage_field_po"});
            // 项目
            var project = currRec.getCurrentSublistValue({sublistId: "custpage_sublist", fieldId: "custpage_sub_project"});
            if (!purchNun && !purchNun.trim() && !project) {
                currRec.setCurrentSublistValue({sublistId: "custpage_sublist", fieldId: "custpage_sub_project", value: SWC_CONFIG_DATA.configData().PROJECT_JOURNAL_X0000});
            }

            var isLinkToPa = currRec.getValue({fieldId: "custpage_is_link_to_pa"});
            console.log('isLinkToPa',isLinkToPa);
            var payableAccrual = currRec.getCurrentSublistValue({sublistId: "custpage_sublist", fieldId: "custpage_sub_payable_accrual"});
            console.log('payableAccrual',payableAccrual);
            if (isLinkToPa == 1 && '' == payableAccrual) {
                alert('Kindly select the Payable Accrual (PA) number in the \'Expense Details\' section.');
                return false;
            }

            return true;
        }


        /**
         * 控制页面上的部分字段显示隐藏
         * @param pay_way 支付方式的id
         */
        function controlShowHide(pay_way) {
            if (pay_way == '') {
                jQuery("#fg_custpage_field_group4").css("display", "none");
                jQuery("#tr_fg_custpage_field_group4").css("display", "none");
                jQuery("#fg_custpage_field_group5").css("display", "none");
                jQuery("#tr_fg_custpage_field_group5").css("display", "none");
                jQuery("#fg_custpage_field_group6").css("display", "none");
                jQuery("#tr_fg_custpage_field_group6").css("display", "none");
            } else if (pay_way == '1') {
                jQuery("#fg_custpage_field_group4").css("display", "block");
                jQuery("#tr_fg_custpage_field_group4").css("display", "block");
                jQuery("#fg_custpage_field_group5").css("display", "none");
                jQuery("#tr_fg_custpage_field_group5").css("display", "none");
                jQuery("#fg_custpage_field_group6").css("display", "none");
                jQuery("#tr_fg_custpage_field_group6").css("display", "none");

            } else if (pay_way == '2' || pay_way == '4') {

                jQuery("#fg_custpage_field_group4").css("display", "none");
                jQuery("#tr_fg_custpage_field_group4").css("display", "none");
                jQuery("#fg_custpage_field_group5").css("display", "block");
                jQuery("#tr_fg_custpage_field_group5").css("display", "block");
                jQuery("#fg_custpage_field_group6").css("display", "none");
                jQuery("#tr_fg_custpage_field_group6").css("display", "none");
            } else if (pay_way == '3') {

                jQuery("#fg_custpage_field_group4").css("display", "none");
                jQuery("#tr_fg_custpage_field_group4").css("display", "none");
                jQuery("#fg_custpage_field_group5").css("display", "none");
                jQuery("#tr_fg_custpage_field_group5").css("display", "none");
                jQuery("#fg_custpage_field_group6").css("display", "block");
                jQuery("#tr_fg_custpage_field_group6").css("display", "block");
            }
        }


        function readFile(fileObj) {
            // 创建一个新的文件读取器
            var reader = new FileReader();

            if (fileObj.w8tax_file) {
                reader.readAsDataURL(fileObj.w8tax_file);
            }

            if (fileObj.w9tax_file) {
                reader.readAsDataURL(fileObj.w9tax_file);
            }

            if (fileObj.other_file) {
                reader.readAsDataURL(fileObj.other_file);
            }

            if (fileObj.quotation_file) {
                reader.readAsDataURL(fileObj.quotation_file);
            }

            if (fileObj.invoice_file) {
                reader.readAsDataURL(fileObj.invoice_file);
            }


            var urlObj = url.resolveScript({
                scriptId: 'customscript_swc_sl_billspayable',
                deploymentId: 'customdeploy_swc_sl_billspayable',
                returnExternalUrl: true,
            });
            var i

            // 当读取器加载时执行方法
            reader.onload = function (e) {

                var responseBody = https.post({
                    url: urlObj,
                    body: {"contents": e.target.result, "type": "img"}
                }).body;

                reader.su


            }
        }


        return {
            pageInit: pageInit,
            fieldChanged: fieldChanged,
            // postSourcing: postSourcing,
            // sublistChanged: sublistChanged,
            // lineInit: _lineInit,
            // validateField: validateField,
            validateLine: validateLine,
            // validateInsert: validateInsert,
            // validateDelete: validateDelete,
            saveRecord: saveRecord,
            queryData: queryData,
            markAll: markAll,
            unmarkAll: unmarkAll,
            submitData: submitData
        };

    });
