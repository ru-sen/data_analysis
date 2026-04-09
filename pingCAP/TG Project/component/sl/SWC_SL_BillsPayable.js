/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @description 员工中心应付账单
 * @author chen dong xu
 */
define(['N/ui/serverWidget', '../../common/SWC_BillsPayable.js', 'N/record', 'N/format', 'N/search', 'N/file', '../../common/SWC_Translate',
    "../../common/SWC_CONFIG_DATA", "N/redirect"],

    (serverWidget, SWC_BillsPayable, record, format, search, file, translateUtil,
     SWC_CONFIG_DATA, redirect) => {

        /**
         * Defines the Suitelet script trigger point.
         * @param {Object} scriptContext
         * @param {ServerRequest} scriptContext.request - Incoming request
         * @param {ServerResponse} scriptContext.response - Suitelet response
         * @since 2015.2
         */
        const onRequest = (scriptContext) => {

            var FILE_LOCATION = "259";

            var response = scriptContext.response;
            var request = scriptContext.request;
            var method = scriptContext.request.method;
            var parameters = request.parameters;
            log.audit("parameters", parameters);

            var option = {};

            // 查询数据的结果
            var tidyUpData = {};

            var obj = request.parameters.obj || '';

            var filterJsonOption = request.parameters.filterJsonOption || '';
            // log.audit({title: 'filterJsonOption', details: filterJsonOption})

            // 再次查询标识
            var again = request.parameters.again || false;
            // 清空标识
            var emptyFlag = request.parameters.emptyFlag || false;
            if (obj != '') {
                obj = JSON.parse(obj);
            }

            if (filterJsonOption != '') {
                filterJsonOption = JSON.parse(filterJsonOption);
            }

            // 提交之后再次查询
            if (filterJsonOption && again == 'true') {
                // log.audit({title: '提交之后再次查询', details: 'start'});
                tidyUpData = SWC_BillsPayable.queryData(filterJsonOption);
                log.error("tidyUpData", tidyUpData);
            }

            // POST请求处理，同步处理文件
            if (method == "POST") {
                var postData = parameters.custpage_field_option;
                if (postData) {
                    postData = JSON.parse(postData);
                    // 提交数据的场合
                    if (postData.api == "submit") {
                        // 供应商账单申请字段值
                        var createData = postData.filterJsonOption;
                        // 供应商账单申请子表字段值
                        var createSonData = postData.objArr;

                        // 文件上传：发票附件1、2、3
                        // 发票附件
                        if (request.files["custpage_field_invoice"]) {
                            var invoiceFileId = crtFile(request.files["custpage_field_invoice"]);
                            if (invoiceFileId) createData["invoiceFileId"] = invoiceFileId;
                        }
                        // 发票附件2
                        if (request.files["custpage_field_w8tax"]) {
                            var invoiceFileId2 = crtFile(request.files["custpage_field_w8tax"]);
                            if (invoiceFileId2) createData["invoiceFileId2"] = invoiceFileId2;
                        }
                        // 发票附件3
                        if (request.files["custpage_field_w9tax"]) {
                            var invoiceFileId3 = crtFile(request.files["custpage_field_w9tax"]);
                            if (invoiceFileId3) createData["invoiceFileId3"] = invoiceFileId3;
                        }
                        // 结算单等其他支持性文件
                        if (request.files["custpage_field_other"]) {
                            var otherFileId = crtFile(request.files["custpage_field_other"]);
                            if (otherFileId) createData["otherFileId"] = otherFileId;
                        }
                        log.error("createData", createData)
                        log.error("createSonData", createSonData)
                        // 创建供应商账单申请
                        createBillApply(createData, createSonData);

                        // 查询标志（custpage_field_query_flag）
                        var querFlag = parameters.custpage_field_query_flag;
                        var redirectParam = {
                            'filterJsonOption': JSON.stringify(postData.filterJsonOption)
                        }
                        if (querFlag == 'T') {
                            // 数据来源与检索，重新检索数据
                            redirectParam["again"] = "true";
                        } else {
                            // 非检索的场合，清空数据
                            redirectParam["emptyFlag"] = "true";
                        }
                        redirect.toSuitelet({
                            scriptId: "customscript_swc_sl_billspayable",
                            deploymentId: "customdeploy_swc_sl_billspayable",
                            parameters: redirectParam
                        });
                        return;
                    }
                }
            }

            if (obj.api == 'query') {
                var unBilled = SWC_BillsPayable.queryCheck(obj);
                log.audit({title: 'unBilled', details: unBilled});

                // 计数 查询结果当中flag = true 的数据是未生成的账单
                var count = 0;
                for (var i = 0; unBilled.length > 0 && i < unBilled.length; i++) {
                    if (unBilled[i].flag) {
                        count++;
                    }
                }

                if (count == 0 && unBilled.length > 0) {

                    response.write('all');
                    return;
                } else {

                    if (unBilled.length > 0) {
                        tidyUpData = SWC_BillsPayable.tidyUpData(unBilled);
                        log.audit({title: 'tidyUpData', details: tidyUpData});
                    }

                }
            }

            // 校验采购订单是否存在
            if (obj.api == "verifyPurchOrdExist") {
                var purchOrdExist = SWC_BillsPayable.verifyPurchOrdExist(obj);
                response.write({output: JSON.stringify({result: purchOrdExist.poIsExist, poSubsidiary: purchOrdExist.poSubsidiary})});
                return;
            }

            if (obj.api == 'submit') {
                // 供应商账单申请字段值
                var createData = obj.filterJsonOption;
                // 供应商账单申请子表字段值
                var createSonData = obj.objArr;

                // log.audit({title: 'createData', details: createData});
                // log.audit({title: 'createSonData', details: createSonData});

                // 创建供应商账单申请
                var billApplyID = createBillApply(createData, createSonData);

                // // 创建供应商账单申请子表
                // createBillApplySon(billApplyID, createSonData);

                var returnData = {
                    'flag': true,
                    'billApplyID': billApplyID
                }
                response.write(JSON.stringify(returnData));
                return;
            }

            if (obj.api == 'runTime_pageInit') {

                var user_id = obj.user_id;

                var department = search.lookupFields({
                    type: search.Type.EMPLOYEE,
                    id: user_id,
                    columns: ['department']
                });
                response.write(JSON.stringify(department));
                return;
            }

            if (obj.api == 'runTime_fieldChanged') {

                // 当前用户id
                var user_id = obj.user_id;
                // 提交人
                var submitter_id = obj.submitter_id;

                var withdraw = search.lookupFields({
                    type: search.Type.EMPLOYEE,
                    id: user_id,// 3637 员工 查看允许代提人 数据格式
                    columns: ['custentity_swc_allow_nominee']
                });

                // log.audit({title: 'withdraw',details: withdraw});

                var flag = false;

                if (withdraw['custentity_swc_allow_nominee'].length > 0) {
                    for (var i = 0; i < withdraw['custentity_swc_allow_nominee'].length; i++) {
                        if (withdraw['custentity_swc_allow_nominee'][i].value == submitter_id) {
                            flag = true;
                        }
                    }

                    if (!flag) {
                        response.write('A1');
                        return;
                    }
                } else {
                    response.write('A2');
                    return;
                }

                // 可以勾选
                response.write('A3');
                return;
            }

            if (obj.api == 'onload_up') {
                var body_ = obj.body_;

                // web浏览器在没有网络连接时用于启用web应用程序可访问性的文件
                if (body_.type == 'appcache') {
                    createFile(body_, ".appcache", 'APPCACHE', FILE_LOCATION);
                    return;
                }

                // AutoCAD 文件
                if (body_.type == 'dwt' || body_.type == 'dwg' || body_.type == 'dws' || body_.type == 'dxf') {
                    createFile(body_, " ", 'AUTOCAD', FILE_LOCATION);
                    return;
                }

                // BMP文件格式 图像文件格式
                if (body_.type == 'bmp') {
                    createFile(body_, ".bmp", 'BMPIMAGE', FILE_LOCATION);
                    return;
                }
                // 证书相关文件
                if (body_.type == 'crt' || body_.type == 'key' || body_.type == 'req' || body_.type == 'csr' || body_.type == 'pem' || body_.type == 'der') {
                    createFile(body_, " ", 'CERTIFICATE', FILE_LOCATION);
                    return;
                }
                // config文件是通过各种程序使用的通用配置文件
                if (body_.type == 'conf') {
                    createFile(body_, ".conf", 'CONFIG', FILE_LOCATION);
                    return;
                }
                // csv
                if (body_.type == 'csv') {
                    createFile(body_, ".csv", 'CSV', FILE_LOCATION);
                    return;
                }
                // EXCEL
                if (body_.type == 'xls' || body_.type == 'xlsx') {
                    createFile(body_, ".xls", 'EXCEL', FILE_LOCATION);
                    return;
                }
                // FLASH
                if (body_.type == 'swf' || body_.type == 'swf') {
                    createFile(body_, ".swf", 'FLASH', FILE_LOCATION);
                    return;
                }
                // FREEMARKER
                if (body_.type == 'ftlh') {
                    createFile(body_, ".ftlh", 'FREEMARKER', FILE_LOCATION);
                    return;
                }
                // GIFIMAGE
                if (body_.type == 'gif') {
                    createFile(body_, ".gif", 'GIFIMAGE', FILE_LOCATION);
                    return;
                }
                // GZIP
                if (body_.type == 'gz') {
                    createFile(body_, ".gz", 'GZIP', FILE_LOCATION);
                    return;
                }
                // HTMLDOC
                if (body_.type == 'html') {
                    createFile(body_, ".html", 'HTMLDOC', FILE_LOCATION);
                    return;
                }
                // HTMLDOC
                if (body_.type == 'html') {
                    createFile(body_, ".html", 'HTMLDOC', FILE_LOCATION);
                    return;
                }
                // ICON
                if (body_.type == 'ico' || body_.type == 'icon') {
                    createFile(body_, ".icon", 'ICON', FILE_LOCATION);
                    return;
                }
                // JAVASCRIPT
                if (body_.type == 'js') {
                    createFile(body_, ".js", 'JAVASCRIPT', FILE_LOCATION);
                    return;
                }
                // JPGIMAGE jpg、jpeg、png
                if (body_.type == 'jpg' || body_.type == 'jpeg' || body_.type == 'png') {
                    createFile(body_, ".jpg", 'JPGIMAGE', FILE_LOCATION);
                    return;
                }
                // JSON
                if (body_.type == 'json') {
                    createFile(body_, ".json", 'JSON', FILE_LOCATION);
                    return;
                }
                // MESSAGERFC
                if (body_.type == 'msg') {
                    createFile(body_, ".msg", 'MESSAGERFC', FILE_LOCATION);
                    return;
                }
                // MP3
                if (body_.type == 'mp3') {
                    createFile(body_, ".mp3", 'MP3', FILE_LOCATION);
                    return;
                }
                // 视频格式 MPEGMOVIE
                if (body_.type == 'mpg' || body_.type == 'mpe' || body_.type == 'mpeg' || body_.type == 'm2v' || body_.type == 'avi' || body_.type == 'mp4') {
                    createFile(body_, ".mpeg", 'MPEGMOVIE', FILE_LOCATION);
                    return;
                }
                // MSPROJECT
                if (body_.type == 'mpp') {
                    createFile(body_, ".mpp", 'MSPROJECT', FILE_LOCATION);
                    return;
                }
                // PDF
                if (body_.type == 'pdf') {
                    createFile(body_, ".pdf", 'PDF', FILE_LOCATION);
                    return;
                }
                // POSTSCRIPT .ps
                if (body_.type == 'ps') {
                    createFile(body_, ".ps", 'POSTSCRIPT', FILE_LOCATION);
                    return;
                }
                // POWERPOINT
                if (body_.type == 'ppt') {
                    createFile(body_, ".ppt", 'POWERPOINT', FILE_LOCATION);
                    return;
                }
                // QUICKTIME MOV
                if (body_.type == 'mov') {
                    createFile(body_, ".mov", 'QUICKTIME', FILE_LOCATION);
                    return;
                }
                // RTF
                if (body_.type == 'rtf') {
                    createFile(body_, ".rtf", 'RTF', FILE_LOCATION);
                    return;
                }
                // .scss SCSS
                if (body_.type == 'scss') {
                    createFile(body_, ".scss", 'SCSS', FILE_LOCATION);
                    return;
                }
                // SMS
                if (body_.type == 'sms') {
                    createFile(body_, ".sms", 'SMS', FILE_LOCATION);
                    return;
                }
                // STYLESHEET
                if (body_.type == 'css') {
                    createFile(body_, ".css", 'STYLESHEET', FILE_LOCATION);
                    return;
                }
                // SVG
                if (body_.type == 'svg') {
                    createFile(body_, ".svg", 'SVG', FILE_LOCATION);
                    return;
                }
                // TAR
                if (body_.type == 'tar') {
                    createFile(body_, ".tar", 'TAR', FILE_LOCATION);
                    return;
                }
                // TIFFIMAGE
                if (body_.type == 'tiff') {
                    createFile(body_, ".tiff", 'TIFFIMAGE', FILE_LOCATION);
                    return;
                }
                // VISIO
                if (body_.type == 'vsdx') {
                    createFile(body_, ".vsdx", 'VISIO', FILE_LOCATION);
                    return;
                }

                // WEBAPPPAGE

                // WEBAPPSCRIPT

                // WORD Dox或者是docx
                if (body_.type == 'dox' || body_.type == 'docx') {
                    createFile(body_, ".docx", 'WORD', FILE_LOCATION);
                    return;
                }
                // XMLDOC
                if (body_.type == 'xml') {
                    createFile(body_, ".xml", 'XMLDOC', FILE_LOCATION);
                    return;
                }
                // XSD
                if (body_.type == 'xsd') {
                    createFile(body_, ".xsd", 'XSD', FILE_LOCATION);
                    return;
                }
                // ZIP
                if (body_.type == 'zip') {
                    createFile(body_, ".zip", 'ZIP', FILE_LOCATION);
                    return;
                }

            }

            // 提交时 先验证发票编号是否有重复生成的
            if (obj.api == 'verification_invoice_num') {
                var invoice_num = obj.invoice_num;

                var check_invoice_flag = SWC_BillsPayable.adjInvoiceNo(invoice_num);

                var returnData = {
                    'check_invoice_flag': check_invoice_flag
                }
                response.write(JSON.stringify(returnData));

                return;
            }
            // 提交时 验证货品有税项
            if (obj.api == 'verification_item_data') {
                var verification_item_arr = SWC_BillsPayable.srchTaxGoods();
                var returnData3 = {
                    'arr': verification_item_arr
                }
                response.write(JSON.stringify(returnData3));
                return;

            }
            // 供应商字段改变的时候将相关数据带出来
            if (obj.api == 'get_supplier_data') {
                var vendorInfo = SWC_BillsPayable.srchVendorInfo(obj.supplier_id);
                response.write(JSON.stringify(vendorInfo));
                return;
            }

            if (filterJsonOption && again == 'true') {
                // 创建页面
                createForm(option, filterJsonOption);
                // 主体字段赋值
                setValueBody(option, filterJsonOption, tidyUpData);
            } else {
                if (filterJsonOption) {
                    // 创建页面
                    createForm(option, filterJsonOption);
                    // 主体字段赋值
                    setValueBody(option, filterJsonOption, tidyUpData);
                } else {
                    // 创建页面
                    createForm(option, obj);
                    // 主体字段赋值
                    setValueBody(option, obj, tidyUpData);
                }

            }



            // 创建子列表
            createSublist(option,obj);

            // 子列表赋值
            setValueSublist(option, tidyUpData);

            if (emptyFlag == 'true') {
                var query_flag3 = option.form.getField({id: 'custpage_field_query_flag'});
                query_flag3.defaultValue = 'F';
            }


            scriptContext.response.writePage({pageObject: option.form});

        }


        /**
         * 创建文件并且将文件id反写到生成供应商账单上
         * @param body_ {}
         * @param file_format 文件格式
         * @param create_format 创建格式
         * @param position 文件上传位置
         */
        function createFile(body_, file_format, create_format, position) {
            var newFile = file.create({
                name: new Date().getTime() + file_format,
                fileType: create_format,
                contents: body_.contents.split(',')[1],
                description: '',
                folder: position,
                isOnline: true
            })
            var id = newFile.save();
            // log.audit({title: '文件id', details: id});

            record.submitFields({
                type: 'customrecord_swc_account_payable',
                id: body_.recId,
                values: {
                    [body_.fieldId]: id
                }
            });
        }


        /**
         * 创建页面
         * @param option
         */
        function createForm(option, obj) {
            var form = serverWidget.createForm({
                title:  translateUtil.translate('员工中心应付账单')
            });
            form.clientScriptModulePath = '../cs/SWC_CS_BillsPayable.js';
            // 按钮
            form.addButton({
                id: 'custpage_btn_query',
                label: translateUtil.translate('查询'),
                functionName: 'queryData'
            });
            // form.addButton({
            //     id: 'custpage_btn_submit',
            //     label: translateUtil.translate('提交'),
            //     functionName: 'submitData'
            // });
            form.addSubmitButton({label: translateUtil.translate('提交')})
            // 查询条件
            form.addFieldGroup({
                id: 'custpage_field_group1',
                label: translateUtil.translate('查询条件')
            });
            var poNum = form.addField({
                id: 'custpage_field_po',
                label: translateUtil.translate('采购订单'),
                type: 'TEXT',
                container: 'custpage_field_group1'
            });
            // poNum.isMandatory = true;
            form.addField({
                id: 'custpage_field_prompt_text',
                label: translateUtil.translate('对于需要关联采购订单的付款，请输入采购订单号，并选择付款方式，点击【查询】按钮，系统将自动填充采购申请单的相关信息。'),
                type: 'LABEL',
                container: 'custpage_field_group1'
            });

            // 主要信息
            form.addFieldGroup({
                id: translateUtil.translate('custpage_field_group2'),
                label: translateUtil.translate('主要信息')
            });

            var submitter = form.addField({
                id: 'custpage_field_submitter',
                label: translateUtil.translate('提交人'),
                type: 'SELECT',
                source: 'employee',
                container: 'custpage_field_group2'
            });
            submitter.isMandatory = true;

            var department = form.addField({
                id: 'custpage_field_department',
                label: translateUtil.translate('所属部门'),
                type: 'SELECT',
                source: 'department',
                container: 'custpage_field_group2'
            });
            department.isMandatory = true;

            form.addField({
                id: 'custpage_field_replace',
                label: translateUtil.translate('是否代提'),
                type: 'CHECKBOX',
                container: 'custpage_field_group2'
            });

            var belongto_label = form.addField({
                id: 'custpage_field_label1',
                label: '预算部门填写注意事项；',
                type: 'LABEL',
                container: 'custpage_field_group2'
            }).updateBreakType({
                breakType: serverWidget.FieldBreakType.STARTCOL
            }).updateDisplayType({
                displayType: serverWidget.FieldDisplayType.HIDDEN
            });

            form.addField({
                id: 'custpage_field_label2',
                label: '(1)预算归属部门不能填写为所在 Office；',
                type: 'LABEL',
                container: 'custpage_field_group2'
            }).updateDisplayType({
                displayType: serverWidget.FieldDisplayType.HIDDEN
            });

            form.addField({
                id: 'custpage_field_label3',
                label: '(2)预算归属部门不能填写为一级部门：NA & EMEA /APAC/JBG/CBG/CEG/CSG/RDG ',
                type: 'LABEL',
                container: 'custpage_field_group2'
            }).updateDisplayType({
                displayType: serverWidget.FieldDisplayType.HIDDEN
            });

            form.addField({
                id: 'custpage_field_belongto',
                label: ' ',
                type: 'SELECT',
                source: 'department',
                container: 'custpage_field_group2'
            }).updateDisplayType({
                displayType: serverWidget.FieldDisplayType.HIDDEN
            });
            // belongto_label.isMandatory = true;

            var descriptionField = form.addField({
                id: 'custpage_field_description',
                label: translateUtil.translate('事由描述'),
                type: 'LONGTEXT',
                container: 'custpage_field_group2'
            }).updateBreakType({
                breakType: serverWidget.FieldBreakType.STARTCOL
            });
            // 设置必填
            descriptionField.isMandatory = true;

            // 超申请理由
            form.addField({
                id: 'custpage_field_reason',
                label: translateUtil.translate('超申请理由'),
                type: 'LONGTEXT',
                container: 'custpage_field_group2'
            }).updateBreakType({
                breakType: serverWidget.FieldBreakType.STARTCOL
            });


            // Is link to PA
            var linkToPaField = form.addField({
                id: 'custpage_is_link_to_pa',
                label: 'Is link to PA',
                type: 'SELECT',
                source: 'customlist_pc_link_pa',
                container: 'custpage_field_group2'
            }).updateBreakType({
                breakType: serverWidget.FieldBreakType.STARTCOL
            });
            linkToPaField.isMandatory = true;
            linkToPaField.setHelpText({
                help : "Kindly select “Yes” here if an accrued expense has been submitted for this PO."
            });

            // 付款信息
            form.addFieldGroup({
                id: 'custpage_field_group3',
                label: translateUtil.translate('付款信息')
            });

            var field_pay_way = form.addField({
                id: 'custpage_field_pay',
                label: translateUtil.translate('付款方式'),
                type: 'SELECT',
                // source: 'customlist_swc_payway',
                container: 'custpage_field_group3'
            });
            field_pay_way.isMandatory = true;

            field_pay_way.addSelectOption({value: '', text: ''});
            field_pay_way.addSelectOption({value: '1', text: translateUtil.translate('对公账户付款')});
            field_pay_way.addSelectOption({value: '2', text: translateUtil.translate('信用卡付款')});
            field_pay_way.addSelectOption({value: '3', text: translateUtil.translate('支票')});
            field_pay_way.addSelectOption({value: '4', text: translateUtil.translate('银行自动扣款')});

            var currency = form.addField({
                id: 'custpage_field_currency',
                label: translateUtil.translate('币种'),
                type: 'SELECT',
                source: 'currency',
                container: 'custpage_field_group3'
            });
            currency.isMandatory = true;

            form.addField({
                id: 'custpage_field_bill_total',
                label: translateUtil.translate('订单已付金额'),
                type: 'CURRENCY',
                container: 'custpage_field_group3'
            }).updateDisplayType({
                displayType: serverWidget.FieldDisplayType.DISABLED
            });

            form.addField({
                id: 'custpage_field_payamount',
                label: translateUtil.translate('本次付款金额'),
                type: 'CURRENCY',
                container: 'custpage_field_group3'
            }).updateDisplayType({
                displayType: serverWidget.FieldDisplayType.DISABLED
            });

            var paybody = form.addField({
                id: 'custpage_field_paybody',
                label: translateUtil.translate('付款主体'),
                type: 'SELECT',
                // source: 'subsidiary',
                container: 'custpage_field_group3'
            });
            paybody.isMandatory = true;
            // 查询全部子公司数据
            var subsidiary_select = SWC_BillsPayable.searchSubsidiary();

            // 子公司下拉选赋值
            paybody.addSelectOption({value: '', text: ''});
            // log.audit({title: 'subsidiary_select', details: subsidiary_select});
            for (var j = 0;subsidiary_select.length > 0 && j < subsidiary_select.length; j++) {
                paybody.addSelectOption({
                    value: subsidiary_select[j].value,
                    text: subsidiary_select[j].text
                });
            }

            var suppliername = form.addField({
                id: 'custpage_field_suppliername',
                label: translateUtil.translate('供应商名称'),
                type: 'SELECT',
                source: 'vendor',
                container: 'custpage_field_group3'
            });
            suppliername.isMandatory = true;

            var field_expectation_date = form.addField({
                id: 'custpage_field_expectationdate',
                label: translateUtil.translate('期望付款时间'),
                type: 'DATE',
                container: 'custpage_field_group3'
            });
            field_expectation_date.isMandatory = true;


            // 附件
            form.addFieldGroup({
                id: 'custpage_field_group7',
                label: translateUtil.translate('附件')
            });

            var field_invoice = form.addField({
                id: 'custpage_field_invoice',
                label: translateUtil.translate('发票附件') + '1',
                type: "FILE",
                // container: 'custpage_field_group7'
            });
            field_invoice.isMandatory = true;

            // 这两个原来是 就是改名 后续逻辑不用动 额外将在初始化的时候将类型改为file
            form.addField({
                id: 'custpage_field_w8tax',
                label: translateUtil.translate('发票附件') + '2',
                type: 'FILE',
                // container: 'custpage_field_group7'
            });

            form.addField({
                id: 'custpage_field_w9tax',
                label: translateUtil.translate('发票附件') + '3',
                type: 'FILE',
                // container: 'custpage_field_group7'
            });


            var fieldOther = form.addField({
                id: 'custpage_field_other',
                label: translateUtil.translate('合同或报价单附件'),
                type: 'FILE',
                // container: 'custpage_field_group7'
            });
            fieldOther.isMandatory = true;//必填

            if (obj.pay_way && obj.pay_way == '1') {
                // 对公账户付款
                form.addFieldGroup({
                    id: 'custpage_field_group4',
                    label: translateUtil.translate('对公账户付款')
                });

                var field_vendor_bank_name = form.addField({
                    id: 'custpage_field_vendor_bank_name',
                    label: 'VENDOR BANK NAME',
                    type: 'TEXT',
                    container: 'custpage_field_group4'
                });
                field_vendor_bank_name.isMandatory = true;

                var field_swift_code = form.addField({
                    id: 'custpage_field_swift_code',
                    label: 'SWIFT CODE',
                    type: 'TEXT',
                    container: 'custpage_field_group4'
                });
                field_swift_code.isMandatory = true;


                var field_invoice_num = form.addField({
                    id: 'custpage_field_invoice_num',
                    label: 'INVOICE NO.',
                    type: 'TEXT',
                    container: 'custpage_field_group4'
                });

                field_invoice_num.isMandatory = true;

                var field_vendor_bank_account = form.addField({
                    id: 'custpage_field_vendor_bank_account',
                    label: 'VENDOR BANK ACCOUNT NO.',
                    type: 'TEXT',
                    container: 'custpage_field_group4'
                });
                field_vendor_bank_account.isMandatory = true;

                var field_routing_transit = form.addField({
                    id: 'custpage_field_routing_transit',
                    label: 'ROUTING & TRANSIT NO.',
                    type: 'TEXT',
                    container: 'custpage_field_group4'
                });
                field_routing_transit.isMandatory = true;


                var field_vendor_bank_city = form.addField({
                    id: 'custpage_field_vendor_bank_city',
                    label: 'VENDOR BANK CITY OR STATE',
                    type: 'TEXT',
                    container: 'custpage_field_group4'
                });

                field_vendor_bank_city.isMandatory = true;

            }

            if (obj.pay_way && obj.pay_way == '2' || obj.pay_way == '4') {

                if (obj.pay_way == '2') {
                    // 信用卡
                    form.addFieldGroup({
                        id: 'custpage_field_group6',
                        label: translateUtil.translate('信用卡付款')
                    });
                } else if (obj.pay_way == '4') {
                    // 银行自动扣款
                    form.addFieldGroup({
                        id: 'custpage_field_group6',
                        label: translateUtil.translate('银行自动扣款')
                    });
                }

                form.addField({
                    id: 'custpage_field_payperiod',
                    label: translateUtil.translate('付款周期'),
                    type: 'SELECT',
                    source: 'customlist_swc_payment_period',
                    container: 'custpage_field_group6'
                });

                form.addField({
                    id: 'custpage_field_label4',
                    label: '合同或报价单附件前:',
                    type: 'LABEL',
                    container: 'custpage_field_group6'
                }).updateBreakType({
                    breakType: serverWidget.FieldBreakType.STARTCOL
                }).updateDisplayType({
                    displayType: serverWidget.FieldDisplayType.HIDDEN
                });

                form.addField({
                    id: 'custpage_field_label5',
                    label: '<a href="https://pingcap.feishu.cn/sheets/shtcn8yDx6IGstJ0GoyS8k6Omuc" target="_blank" style="color: blue">' +
                        'Please refer to the following links for detailed description documents of classification:</a>',
                    type: 'LABEL',
                    container: 'custpage_field_group6'
                }).updateDisplayType({
                    displayType: serverWidget.FieldDisplayType.HIDDEN
                });

                form.addField({
                    id: 'custpage_field_quotation',
                    label: '报价单',
                    type: 'TEXT',
                    container: 'custpage_field_group6'
                }).updateBreakType({
                    breakType: serverWidget.FieldBreakType.STARTCOL
                }).updateDisplayType({
                    displayType: serverWidget.FieldDisplayType.HIDDEN
                });

            }

            if (obj.pay_way && obj.pay_way == '3') {
                // 支票
                form.addFieldGroup({
                    id: 'custpage_field_group5',
                    label: translateUtil.translate('支票')
                });

                form.addField({
                    id: 'custpage_field_payeename',
                    label: translateUtil.translate('收款人全名'),
                    type: 'TEXT',
                    container: 'custpage_field_group5'
                });

                form.addField({
                    id: 'custpage_field_payeephone',
                    label: translateUtil.translate('收款人联系电话'),
                    type: 'PHONE',
                    container: 'custpage_field_group5'
                });

                form.addField({
                    id: 'custpage_field_payeeemail',
                    label: translateUtil.translate('收款人邮箱'),
                    type: 'EMAIL',
                    container: 'custpage_field_group5'
                });

                form.addField({
                    id: 'custpage_field_payeeaddress',
                    label: translateUtil.translate('收款人收件地址'),
                    type: 'TEXT',
                    container: 'custpage_field_group5'
                });

            }


            // 采购订单总金额
            form.addField({
                id: 'custpage_field_po_total',
                label: '采购订单总金额',
                type: 'CURRENCY'
            }).updateDisplayType({
                displayType: serverWidget.FieldDisplayType.HIDDEN
            });

            // 查询标识
            form.addField({
                id: 'custpage_field_query_flag',
                label: '查询标识',
                type: 'CHECKBOX'
            }).updateDisplayType({
                displayType: serverWidget.FieldDisplayType.HIDDEN
            });

            // 补丁：设置提交参数
            form.addField({
                id: 'custpage_field_option',
                label: 'POST请求提交参数',
                type: serverWidget.FieldType.LONGTEXT
            }).updateDisplayType({
                displayType: serverWidget.FieldDisplayType.HIDDEN
            });

            option.form = form;
        }


        /**
         * 创建子列表
         * @param option
         */
        function createSublist(option,obj) {

            // INLINEEDITOR / LIST
            var sublist = option.form.addSublist({
                id: 'custpage_sublist',
                type: serverWidget.SublistType.INLINEEDITOR,
                label: translateUtil.translate('费用明细')
            });
            // 全部勾选、取消全部勾选
            sublist.addButton({
                id: 'custpage_sublist_btn_mark_all',
                label: translateUtil.translate('勾选全部'),
                functionName: 'markAll'
            });
            sublist.addButton({
                id: 'custpage_sublist_btn_previous_unmark_all',
                label: translateUtil.translate('取消勾选全部'),
                functionName: 'unmarkAll'
            });
            // sublist.addMarkAllButtons();

            sublist.addField({
                id: 'custpage_sub_check',
                label: translateUtil.translate('勾选框'),
                type: 'CHECKBOX'
            });

            sublist.addField({
                id: 'custpage_sub_internalid',
                label: '内部id',
                type: 'TEXT'
            }).updateDisplayType({
                displayType: serverWidget.FieldDisplayType.HIDDEN
            });
            sublist.addField({
                id: 'custpage_sub_internalid_txt',
                label: '内部id文本',
                type: 'TEXT'
            }).updateDisplayType({
                displayType: serverWidget.FieldDisplayType.HIDDEN
            });

            sublist.addField({
                id: 'custpage_sub_item',
                label: translateUtil.translate('费用类型'),
                type: 'SELECT',
                source: 'item'
            });

            sublist.addField({
                id: 'custpage_sub_itemtext',
                label: '货品',
                type: 'TEXT'
            }).updateDisplayType({
                displayType: serverWidget.FieldDisplayType.HIDDEN
            });

            sublist.addField({
                id: 'custpage_sub_quantity',
                label: '数量',
                type: 'INTEGER'
            }).updateDisplayType({
                displayType: serverWidget.FieldDisplayType.ENTRY
            }).updateDisplayType({
                displayType: serverWidget.FieldDisplayType.HIDDEN
            });

            sublist.addField({
                id: 'custpage_sub_bill_quantity',
                label: '可开票数量',
                type: 'INTEGER'
            }).updateDisplayType({
                displayType: serverWidget.FieldDisplayType.HIDDEN
            });

            sublist.addField({
                id: 'custpage_sub_price',
                label: '价格',
                type: 'CURRENCY'
            }).updateDisplayType({
                displayType: serverWidget.FieldDisplayType.ENTRY
            }).updateDisplayType({
                displayType: serverWidget.FieldDisplayType.HIDDEN
            });

            sublist.addField({
                id: 'custpage_sub_pricetext',
                label: '价格',
                type: 'CURRENCY'
            }).updateDisplayType({
                displayType: serverWidget.FieldDisplayType.HIDDEN
            });

            sublist.addField({
                id: 'custpage_sub_tax',
                label: '税码',
                type: 'TEXT'
            }).updateDisplayType({
                displayType: serverWidget.FieldDisplayType.HIDDEN
            });

            sublist.addField({
                id: 'custpage_sub_taxtext',
                label: '税码',
                type: 'TEXT'
            }).updateDisplayType({
                displayType: serverWidget.FieldDisplayType.HIDDEN
            });

            sublist.addField({
                id: 'custpage_sub_taxrate',
                label: '税率',
                type: 'TEXT'
            }).updateDisplayType({
                displayType: serverWidget.FieldDisplayType.HIDDEN
            });

            sublist.addField({
                id: 'custpage_sub_money',
                label: '金额',
                type: 'CURRENCY'
            }).updateDisplayType({
                displayType: serverWidget.FieldDisplayType.ENTRY
            }).updateDisplayType({
                displayType: serverWidget.FieldDisplayType.HIDDEN
            });

            sublist.addField({
                id: 'custpage_sub_taxprice',
                label: '税额',
                type: 'CURRENCY'
            }).updateDisplayType({
                displayType: serverWidget.FieldDisplayType.ENTRY
            }).updateDisplayType({
                displayType: serverWidget.FieldDisplayType.HIDDEN
            });

            // 预算归属部门
            sublist.addField({
                id: 'custpage_sub_budget',
                label: translateUtil.translate('预算归属部门'),
                type: 'SELECT',
                source: 'department'
            });
            //edit start quyefa 2024-11-25
            sublist.addField({
                id: 'custpage_sub_budget_hid',
                label: translateUtil.translate('预算归属部门-隐藏'),
                type: 'SELECT',
                source: 'department'
            }).updateDisplayType({
                displayType: serverWidget.FieldDisplayType.HIDDEN
            });
            //edit end quyefa 2024-11-25
            sublist.addField({
                id: 'custpage_sub_total',
                label: translateUtil.translate('支付金额'),
                type: 'CURRENCY'
            });

            sublist.addField({
                id: 'custpage_sub_currency',
                label: '货币',
                type: 'TEXT'
            }).updateDisplayType({
                displayType: serverWidget.FieldDisplayType.HIDDEN
            });


            sublist.addField({
                id: 'custpage_sub_totalpo',
                label: '采购订单总金额',
                type: 'CURRENCY'
            }).updateDisplayType({
                displayType: serverWidget.FieldDisplayType.HIDDEN
            });

            sublist.addField({
                id: 'custpage_sub_linenum',
                label: '行id',
                type: 'TEXT'
            }).updateDisplayType({
                displayType: serverWidget.FieldDisplayType.HIDDEN
            });

            // 项目
            sublist.addField({
                id: "custpage_sub_project",
                label: translateUtil.translate("项目"),
                type: serverWidget.FieldType.SELECT,
                source: "customrecord_cseg_swc_pro" // 项目（日记账）
            });

            // Payable Accrual
            let fieldAccrual = sublist.addField({
                id: "custpage_sub_payable_accrual",
                label: translateUtil.translate("预提"),
                type: 'SELECT',
                // source: "customrecord_pc_provision_application"
            });
            let paInfo = searchAccrualSelectOption(obj.po_num);
            fieldAccrual.addSelectOption({value: '', text: ''});
            if (paInfo.length > 0) {
                paInfo.forEach(value => {
                    fieldAccrual.addSelectOption({
                        value: value.id,
                        text: value.value
                    });
                });
            }

            option.sublist = sublist;
        }


        /**
         * 搜索关联PO并且审批通过的PA单
         * @param poNum
         */
        function searchAccrualSelectOption(poNum) {
            let paInfo = [];
            if (!poNum || poNum == '') return paInfo;
            let searchObj = search.create({
                type: "purchaseorder",
                filters:
                    [
                        ["tranid","is",poNum]
                    ],
                columns:
                    [
                        search.createColumn({name: "internalid"}),
                    ]
            });
            let columns = searchObj.columns;
            let results = searchObj.run().getRange({start: 0, end: 1});
            if (results && results.length > 0) {
                let poId = results[0].getValue(columns[0]);
                let searchAccrualObj = search.create({
                    type: "customrecord_pc_provision_application",
                    filters:
                        [
                            ["custrecord_pc_po_number","anyof",poId],
                            "AND",
                            ["custrecord_pc_order_status","anyof","3"]
                        ],
                    columns:
                        [
                            search.createColumn({name: "internalid"}),
                            search.createColumn({name: "name"})
                        ]
                });
                let paColumns = searchAccrualObj.columns;
                let paResults = searchAccrualObj.run().getRange({start: 0, end: 1000});
                if (paResults && paResults.length > 0) {
                    for (let i = 0; i < paResults.length; i++) {
                        let paId = paResults[i].getValue(paColumns[0]);
                        let paName = paResults[i].getValue(paColumns[1]);
                        paInfo.push({id: paId, value: paName});
                    }
                }
            }
            return paInfo;
        }



        /**
         * 主体字段赋值
         * @param option
         * @param obj
         */
        function setValueBody(option, obj, tidyUpData) {
            // 是否代提
            if (obj.replaceFlag) {
                var replaceFlag = option.form.getField({id: 'custpage_field_replace'});
                replaceFlag.defaultValue = 'T';
            }

            // 期望付款时间
            if (obj.expectation_date) {
                var expectationDate = option.form.getField({id: 'custpage_field_expectationdate'});
                expectationDate.defaultValue = obj.expectation_date;
            }

            // 页面隐藏字段 查询标识 判断页面数据是否是查询出的结果
            if (obj.api == 'query') {
                var query_flag1 = option.form.getField({id: 'custpage_field_query_flag'});
                query_flag1.defaultValue = 'T';
            }
            if (obj.query_flag) {
                var query_flag2 = option.form.getField({id: 'custpage_field_query_flag'});
                query_flag2.defaultValue = 'T';
            }

            if (obj.description) {
                var field_description = option.form.getField({id: 'custpage_field_description'});
                field_description.defaultValue = obj.description;
            } else {
                if (tidyUpData.just_cause) {
                    var field_description = option.form.getField({id: 'custpage_field_description'});
                    field_description.defaultValue = tidyUpData.just_cause;
                }
            }

            option.form.updateDefaultValues({
                'custpage_field_po': obj.po_num,                         // 采购订单编号
                'custpage_field_submitter': obj.submitter,               // 提交人
                'custpage_field_department': obj.department,             // 所属部门
                'custpage_field_belongto': tidyUpData.department_line,                 // 预算所属部门
                // 'custpage_field_description': obj.description,           // 事由描述
                'custpage_field_pay': obj.pay_way,                       // 付款方式
                'custpage_field_currency': tidyUpData.currency,                 // 币种
                'custpage_field_paybody': tidyUpData.pay_body,                  // 付款主体
                'custpage_field_suppliername': tidyUpData.vendor,        //供应商名称
                // 'custpage_field_w8tax': obj.w8tax,                       // w8税表
                // 'custpage_field_w9tax': obj.w9tax,                       // w9税表
                // 'custpage_field_other': obj.other,                       // 结算单等其他支持性文件
                // 'custpage_field_payamount': obj.pay_amount,              // 付款金额
                'custpage_field_po_total': tidyUpData.totalPo,           // 采购订单总金额
                'custpage_field_bill_total': tidyUpData.BillTotal,       // 已开票总金额
                'custpage_field_reason': obj.reason,                     // 超申请理由
            });

            if (tidyUpData.department) {
                var field_department = option.form.getField({id: 'custpage_field_department'});
                field_department.defaultValue = tidyUpData.department;
            }

            if (obj.pay_way == '1') {
                if (tidyUpData.vendor_obj) {

                    option.form.updateDefaultValues({
                        'custpage_field_vendor_bank_name': tidyUpData.vendor_obj.vendor_bank_name,
                        'custpage_field_swift_code': tidyUpData.vendor_obj.swift_code,
                        'custpage_field_vendor_bank_account': tidyUpData.vendor_obj.vendor_bank_account,
                        'custpage_field_routing_transit': tidyUpData.vendor_obj.routing_transit,
                        'custpage_field_vendor_bank_city': tidyUpData.vendor_obj.vendor_bank_city,
                        'custpage_field_invoice_num': obj.invoice_num
                    });

                } else {
                    option.form.updateDefaultValues({
                        'custpage_field_vendor_bank_name': obj.vendor_bank_name,
                        'custpage_field_swift_code': obj.swift_code,
                        'custpage_field_invoice_num': obj.invoice_num,
                        'custpage_field_vendor_bank_account': obj.vendor_bank_account,
                        'custpage_field_routing_transit': obj.routing_transit,
                        'custpage_field_vendor_bank_city': obj.vendor_bank_city
                    });
                }

            } else if (obj.pay_way == '2' || obj.pay_way == '4') {
                option.form.updateDefaultValues({
                    'custpage_field_payperiod': obj.pay_period
                });
            } else if (obj.pay_way == '3') {
                option.form.updateDefaultValues({
                    'custpage_field_payeename': obj.payee_name,
                    'custpage_field_payeephone': obj.payee_phone,
                    'custpage_field_payeeemail': obj.payee_email,
                    'custpage_field_payeeaddress': obj.payee_address
                });
            }


        }

        /**
         * 主体字段赋值2
         * @param option
         * @param filterJsonOption 请求参数 {'':'', ...}
         * @param tidyUpData 再次查询的结果 [{}, ...]
         */
        function setValueBody2(option, filterJsonOption, tidyUpData) {
            //'custpage_field_date': filterJsonOption.anticipate_date,
            //                 'custpage_field_date2': filterJsonOption.maturity_date,

            // 预计付款日期
            var anticipate_date = option.form.getField({id: 'custpage_field_date'});
            anticipate_date.defaultValue = filterJsonOption.anticipate_date;

            // 到期日期
            var maturity_date = option.form.getField({id: 'custpage_field_date2'});
            maturity_date.defaultValue = filterJsonOption.maturity_date;

            if (tidyUpData.BillTotal) {
                var bill_total = option.form.getField({id: 'custpage_field_bill_total'});
                bill_total.defaultValue = tidyUpData.BillTotal;
            } else {
                var bill_total = option.form.getField({id: 'custpage_field_bill_total'});
                bill_total.defaultValue = 0;
            }


            option.form.updateDefaultValues({
                'custpage_field_po': filterJsonOption.poNum,              // 采购订单编号
                // 'custpage_field_createdate': filterJsonOption.create_date,// 申请创建日期
                'custpage_field_pay': filterJsonOption.pay_way,           // 付款方式
                'custpage_field_memo': filterJsonOption.memo,             // 备注
                'custpage_field_supplier': tidyUpData.vendor,             // 供应商
                'custpage_field_subsidiary': tidyUpData.subsidiary,       // 子公司
                'custpage_field_tax': tidyUpData.rateTotal,               // 税额
                'custpage_field_money': tidyUpData.price_quantity_total,  // 金额
                // 'custpage_field_bill_total': tidyUpData.BillTotal,        // 已开票的总金额
                'custpage_field_po_total': tidyUpData.totalPo             // 采购订单总金额
            });
        }

        /**
         * 子列表赋值
         * @param option
         * @param tidyUpData 查询结果 [{}, ...]
         */
        function setValueSublist(option, tidyUpData) {

            if (tidyUpData.unBilled && tidyUpData.unBilled.length > 0) {

                var searchData = tidyUpData.unBilled;
                for (var i = 0; i < searchData.length; i++) {
                    // 内部id
                    if (searchData[i].internalid) option.sublist.setSublistValue({
                        id: 'custpage_sub_internalid',
                        line: i,
                        value: searchData[i].internalid
                    });
                    // 内部id文本
                    if (searchData[i].internalidTxt) option.sublist.setSublistValue({
                        id: 'custpage_sub_internalid_txt',
                        line: i,
                        value: searchData[i].internalidTxt
                    });

                    // 预算所属部门
                    if (searchData[i].department){
                        option.sublist.setSublistValue({
                            id: 'custpage_sub_budget',
                            line: i,
                            value: searchData[i].department
                        });
                        //edit start quyefa 2024-11-25
                        option.sublist.setSublistValue({
                            id: 'custpage_sub_budget_hid',
                            line: i,
                            value: searchData[i].department
                        });
                        //edit end quyefa 2024-11-25
                    }

                    // 货品
                    if (searchData[i].item) option.sublist.setSublistValue({
                        id: 'custpage_sub_item',
                        line: i,
                        value: searchData[i].item
                    });
                    // 货品文本
                    if (searchData[i].itemText) option.sublist.setSublistValue({
                        id: 'custpage_sub_itemtext',
                        line: i,
                        value: searchData[i].itemText
                    });
                    // 数量
                    if (searchData[i].quantity) option.sublist.setSublistValue({
                        id: 'custpage_sub_quantity',
                        line: i,
                        value: searchData[i].quantity
                    });
                    // 税码
                    if (searchData[i].taxcode) option.sublist.setSublistValue({
                        id: 'custpage_sub_tax',
                        line: i,
                        value: searchData[i].taxcode
                    });
                    // 税码文本
                    if (searchData[i].taxcodeText) option.sublist.setSublistValue({
                        id: 'custpage_sub_taxtext',
                        line: i,
                        value: searchData[i].taxcodeText
                    });
                    // 税率
                    if (searchData[i].taxrate) option.sublist.setSublistValue({
                        id: 'custpage_sub_taxrate',
                        line: i,
                        value: searchData[i].taxrate
                    });
                    // 价格
                    if (searchData[i].fxrate) option.sublist.setSublistValue({
                        id: 'custpage_sub_price',
                        line: i,
                        value: searchData[i].fxrate
                    });
                    // 价格
                    if (searchData[i].fxrate) option.sublist.setSublistValue({
                        id: 'custpage_sub_pricetext',
                        line: i,
                        value: searchData[i].fxrate
                    });

                    // 金额
                    if (searchData[i].price_quantity) option.sublist.setSublistValue({
                        id: 'custpage_sub_money',
                        line: i,
                        value: searchData[i].price_quantity
                    });

                    // 税额
                    if (searchData[i].price_tax && searchData[i].price_tax != 0) {
                        option.sublist.setSublistValue({
                            id: 'custpage_sub_taxprice',
                            line: i,
                            value: searchData[i].price_tax
                        });
                    } else if (searchData[i].price_tax == 0) {
                        option.sublist.setSublistValue({
                            id: 'custpage_sub_taxprice',
                            line: i,
                            value: '0'
                        });
                    }

                    // 总金额
                    if (searchData[i].un_bill_amount) option.sublist.setSublistValue({
                        id: 'custpage_sub_total',
                        line: i,
                        value: searchData[i].un_bill_amount
                    });

                    // 采购订单总金额
                    if (searchData[i].totalPo) option.sublist.setSublistValue({
                        id: 'custpage_sub_totalpo',
                        line: i,
                        value: searchData[i].totalPo
                    });

                    // 可开票数量
                    if (searchData[i].quantity) option.sublist.setSublistValue({
                        id: 'custpage_sub_bill_quantity',
                        line: i,
                        value: searchData[i].quantity
                    });

                    // 行序号
                    if (searchData[i].lineId) option.sublist.setSublistValue({
                        id: 'custpage_sub_linenum',
                        line: i,
                        value: searchData[i].lineId
                    });

                    // 货币
                    if (searchData[i].currency) option.sublist.setSublistValue({
                        id: 'custpage_sub_currency',
                        line: i,
                        value: searchData[i].currency
                    });

                    // 项目
                    if (searchData[i].pro) option.sublist.setSublistValue({
                        id: 'custpage_sub_project',
                        line: i,
                        value: searchData[i].pro
                    });
                }
            }

        }


        /**
         * 创建供应商账单申请
         * @param createData sl页面上body字段的值 {'': '', ...}
         * @param createSonData sl页面上子列表数据 [{} ,...]
         * @return {*} 生成的供应商账单申请id
         */
        function createBillApply(createData, createSonData) {
            // 创建供应商账单申请
            var billApplyRec = record.create({type: 'customrecord_swc_account_payable',isDynamic : true});
            // 采购订单单号
            billApplyRec.setValue({fieldId: 'custrecord_ap_number', value: createData.po_id});
            // 提交人
            billApplyRec.setValue({fieldId: 'custrecord_ap_employee', value: createData.submitter});
            // 所属部门
            billApplyRec.setValue({fieldId: 'custrecord_ap_department', value: createData.department});
            // is link to pa
            billApplyRec.setValue({fieldId: 'custrecord_ap_is_link_to_pa', value: createData.isLinkToPa});
            // 预算归属部门
            billApplyRec.setValue({fieldId: 'custrecord_ap_budget', value: createData.belongTo});
            // 是否代提
            billApplyRec.setValue({fieldId: 'custrecord_ap_withdraw', value: createData.replaceFlag});
            // 事由描述
            billApplyRec.setValue({fieldId: 'custrecord_ap_reason_description', value: createData.description});
            // 付款方式
            billApplyRec.setValue({fieldId: 'custrecord_ap_payment_method', value: createData.pay_way});
            // 币种
            billApplyRec.setValue({fieldId: 'custrecord_ap_currency', value: createData.currency});
            // 付款金额
            billApplyRec.setValue({fieldId: 'custrecord_ap_payamount', value: createData.pay_amount});
            // 付款主体
            billApplyRec.setValue({fieldId: 'custrecord_ap_subsidary', value: createData.pay_body});
            // 供应商名称
            billApplyRec.setValue({fieldId: 'custrecord_ap_vendorname', value: createData.supplier_name});
            // 期望付款时间
            billApplyRec.setText({fieldId: 'custrecord_ap_expected_paytime', text: createData.expectation_date});
            // 发票附件1
            if (createData["invoiceFileId"]) {
                billApplyRec.setValue({fieldId: 'custrecord_ap_invoice_attachment', value: createData["invoiceFileId"]});
            }
            // 发票附件2
            if (createData["invoiceFileId2"]) {
                billApplyRec.setValue({fieldId: 'custrecord_ap_invoice_attachment2', value: createData["invoiceFileId2"]});
            }
            // 发票附件3
            if (createData["invoiceFileId3"]) {
                billApplyRec.setValue({fieldId: 'custrecord_ap_invoice_attachment3', value: createData["invoiceFileId3"]});
            }
            // 结算单等其他支持性文件
            if (createData["otherFileId"]) {
                billApplyRec.setValue({fieldId: 'custrecord_ap_other_supportdoc', value: createData["otherFileId"]});
            }
            // w8税表
            // billApplyRec.setValue({fieldId: 'custrecord_ap_w8', value: createData.w8tax});
            // w9税表
            // billApplyRec.setValue({fieldId: 'custrecord_ap_w9', value: createData.w9tax});
            // 结算单等其他支持性文件
            // billApplyRec.setValue({fieldId: 'custrecord_ap_other_supportdoc', value: createData.other});

            if (createData.pay_way == '1') {
                // VENDOR BANK NAME
                billApplyRec.setValue({fieldId: 'custrecord_ap_vendor_bankname', value: createData.vendor_bank_name});
                // SWIFT CODE
                billApplyRec.setValue({fieldId: 'custrecord_ap_swiftcode', value: createData.swift_code});
                // INVOICE编号
                billApplyRec.setValue({fieldId: 'custrecord_ap_invoiceno', value: createData.invoice_num});
                // VENDOR BANK ACCOUNT NO.
                billApplyRec.setValue({fieldId: 'custrecord_ap_vendor_bank_accountno', value: createData.vendor_bank_account});
                // ROUTING & TRANSIT NO.
                billApplyRec.setValue({fieldId: 'custrecord_ap_routing_transitno', value: createData.routing_transit});
                // 发票附件
                // billApplyRec.setValue({fieldId: 'custrecord_ap_invoice_attachment', value: createData.invoice});
                // VENDOR BANK CITY OR STATE
                billApplyRec.setValue({fieldId: 'custrecord_ap_vendorbank_citystate', value: createData.vendor_bank_city});

                // var save = billApplyRec.save();
                // return save;

            } else if (createData.pay_way == '2' || createData.pay_way == '4') {
                // 付款周期
                billApplyRec.setValue({fieldId: 'custrecord_ap_payment_period', value: createData.pay_period});
                // 报价单
                billApplyRec.setValue({fieldId: 'custrecord_ap_quotation', value: createData.quotation});

                // var save = billApplyRec.save();
                // return save;

            } else if (createData.pay_way == '3') {
                // 收款人全名
                billApplyRec.setValue({fieldId: 'custrecord_ap_fullname', value: createData.payee_name});
                // 收款人联系电话
                billApplyRec.setValue({fieldId: 'custrecord_ap_phone', value: createData.payee_phone});
                // 收款人邮箱
                billApplyRec.setValue({fieldId: 'custrecord_ap_address_payee', value: createData.payee_email});
                // 收款人收件地址
                billApplyRec.setValue({fieldId: 'custrecord_ap_address', value: createData.payee_address});

                // var save = billApplyRec.save();
                // return save;

            }

            var BILL_APPROVAL_STATUS_PENDING_APPROVAL = "1";
            for (var i = 0; i < createSonData.length; i++) {
                billApplyRec.selectLine({sublistId: 'recmachcustrecord_aps_field',line:i});
                // 货品
                billApplyRec.setCurrentSublistValue({sublistId: 'recmachcustrecord_aps_field', fieldId: 'custrecord_aps_item', value: createSonData[i].item});
                // 预算归属部门
                billApplyRec.setCurrentSublistValue({sublistId: 'recmachcustrecord_aps_field', fieldId: 'custrecord_aps_department', value: createSonData[i].department_line});
                // 总金额
                billApplyRec.setCurrentSublistValue({sublistId: 'recmachcustrecord_aps_field', fieldId: 'custrecord_aps_totalamount', value: createSonData[i].amount});
                // 审批状态
                billApplyRec.setCurrentSublistValue({sublistId: 'recmachcustrecord_aps_field', fieldId: 'custrecord_aps_line_status', value: BILL_APPROVAL_STATUS_PENDING_APPROVAL});
                // 项目
                billApplyRec.setCurrentSublistValue({sublistId: 'recmachcustrecord_aps_field', fieldId: 'custrecord_aps_pro', value: createSonData[i].pro});
                // Payable Accrual
                billApplyRec.setCurrentSublistValue({sublistId: 'recmachcustrecord_aps_field', fieldId: 'custrecord_pc_link_to_pa', value: createSonData[i].payableAccrual});

                billApplyRec.commitLine({sublistId: 'recmachcustrecord_aps_field'});
            }

            var save = billApplyRec.save();
            return save;

        }

        function createBillApplySon(billApplyID, createSonData) {

            for (var i = 0; i < createSonData.length; i++) {
                var billApplySonRec = record.create({type: 'customrecord_swc_apsublist'});
                // 供应商账单申请单号
                billApplySonRec.setValue({fieldId: 'custrecord_aps_field', value: billApplyID});
                // 货品
                billApplySonRec.setValue({fieldId: 'custrecord_aps_item', value: createSonData[i].item});
                // // 数量
                // billApplySonRec.setValue({fieldId: 'custrecord_aps_quantity', value: createSonData[i].quantity});
                // // 价格
                // billApplySonRec.setValue({fieldId: 'custrecord_aps_price', value: createSonData[i].price});
                // // 金额
                // billApplySonRec.setValue({fieldId: 'custrecord_aps_amount', value: createSonData[i].amount_line});
                // // 税码
                // billApplySonRec.setValue({fieldId: 'custrecord_aps_rate', value: createSonData[i].taxcode});
                // // 税额
                // billApplySonRec.setValue({fieldId: 'custrecord_aps_rateamount', value: createSonData[i].taxPrice});

                // 预算归属部门
                billApplySonRec.setValue({fieldId: 'custrecord_aps_department', value: createSonData[i].department_line});
                // 总金额
                billApplySonRec.setValue({fieldId: 'custrecord_aps_totalamount', value: createSonData[i].amount});
                // 审批状态
                billApplySonRec.setText({fieldId: 'custrecord_aps_line_status', text: '待审批'});

                billApplySonRec.save();
            }

        }

        /**
         * 创建文件
         * @param {string} reqFile 服务器请求文件
         * @return {string} 文件内部ID
         */
        function crtFile(reqFile) {
            if (!reqFile) return null;

            // 文件内容
            var contents = reqFile.getContents();
            // 文件类型
            var fileType = reqFile.name.substring(reqFile.name.lastIndexOf(".") + 1);

            // web浏览器在没有网络连接时用于启用web应用程序可访问性的文件
            if (fileType == 'appcache') {
                fileType = 'APPCACHE';
            }

            // AutoCAD 文件
            if (fileType == 'dwt' || fileType == 'dwg' || fileType == 'dws' || fileType == 'dxf') {
                fileType = 'AUTOCAD';
            }

            // BMP文件格式 图像文件格式
            if (fileType == 'bmp') {
                fileType = 'BMPIMAGE';
            }
            // 证书相关文件
            if (fileType == 'crt' || fileType == 'key' || fileType == 'req' || fileType == 'csr' || fileType == 'pem' || fileType == 'der') {
                fileType = 'CERTIFICATE'
            }
            // config文件是通过各种程序使用的通用配置文件
            if (fileType == 'conf') {
                fileType = "CONFIG";
            }
            // csv
            if (fileType == 'csv') {
                fileType = "CSV";
            }
            // EXCEL
            if (fileType == 'xls' || fileType == 'xlsx') {
                fileType = "EXCEL";
            }
            // FLASH
            if (fileType == 'swf' || fileType == 'swf') {
                fileType = "FLASH";
            }
            // FREEMARKER
            if (fileType == 'ftlh') {
                createFile(body_, ".ftlh", 'FREEMARKER', FILE_LOCATION);
                fileType = "FREEMARKER"
            }
            // GIFIMAGE
            if (fileType == 'gif') {
                fileType = "GIFIMAGE";
            }
            // GZIP
            if (fileType == 'gz') {
                fileType = "GZIP";
            }
            // HTMLDOC
            if (fileType == 'html') {
                fileType = "HTMLDOC";
            }
            // ICON
            if (fileType == 'ico' || fileType == 'icon') {
                fileType = 'ICON';
            }
            // JAVASCRIPT
            if (fileType == 'js') {
                fileType = 'JAVASCRIPT';
            }
            // JPGIMAGE jpg、jpeg、png
            if (fileType == 'jpg' || fileType == 'jpeg' || fileType == 'png') {
                fileType = 'JPGIMAGE';
            }
            // JSON
            if (fileType == 'json') {
                fileType = 'JSON';
            }
            // MESSAGERFC
            if (fileType == 'msg') {
                fileType = "MESSAGERFC";
            }
            // MP3
            if (fileType == 'mp3') {
                fileType = "MP3";
            }
            // 视频格式 MPEGMOVIE
            if (fileType == 'mpg' || fileType == 'mpe' || fileType == 'mpeg' || fileType == 'm2v' || fileType == 'avi' || fileType == 'mp4') {
                fileType = "MPEGMOVIE";
            }
            // MSPROJECT
            if (fileType == 'mpp') {
                fileType = 'MSPROJECT';
            }
            // PDF
            if (fileType == 'pdf') {
                fileType = 'PDF';
            }
            // POSTSCRIPT .ps
            if (fileType == 'ps') {
                fileType = 'POSTSCRIPT';
            }
            // POWERPOINT
            if (fileType == 'ppt') {
                fileType = 'POWERPOINT';
            }
            // QUICKTIME MOV
            if (fileType == 'mov') {
                fileType = 'QUICKTIME';
            }
            // RTF
            if (fileType == 'rtf') {
                fileType = 'RTF';
            }
            // .scss SCSS
            if (fileType == 'scss') {
                fileType = 'SCSS';
            }
            // SMS
            if (fileType == 'sms') {
                fileType = 'SMS';
            }
            // STYLESHEET
            if (fileType == 'css') {
                fileType = "STYLESHEET";
            }
            // SVG
            if (fileType == 'svg') {
                fileType = "SVG";
            }
            // TAR
            if (fileType == 'tar') {
                fileType = "TAR";
            }
            // TIFFIMAGE
            if (fileType == 'tiff') {
                fileType = "TIFFIMAGE";
            }
            // VISIO
            if (fileType == 'vsdx') {
                fileType = "VISIO";
            }

            // WEBAPPPAGE

            // WEBAPPSCRIPT

            // WORD Dox或者是docx
            if (fileType == 'dox' || fileType == 'docx') {
                fileType = 'WORD';
            }
            // XMLDOC
            if (fileType == 'xml') {
                fileType = "XMLDOC";
            }
            // XSD
            if (fileType == 'xsd') {
                fileType = 'XSD';
            }
            // ZIP
            if (fileType == 'zip') {
                fileType = 'ZIP';
            }
            // TXT
            if (fileType == 'txt') {
                fileType = 'PLAINTEXT';
            }

            var newFile = file.create({
                name: reqFile.name,
                fileType: fileType,
                contents: contents,
                folder: SWC_CONFIG_DATA.configData().VENDOR_BILL_REQ_FILE_LOCATION,
                isOnline: true
            });

            return newFile.save();
        }

        return {onRequest}

    });
