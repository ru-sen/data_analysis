/**
 * 共通方法
 * @NApiVersion 2.x
 * @NModuleScope public
 */
define(["N/runtime"],

    function (runtime) {

        var langObj = {
            // cdx 员工应付帐单
            '员工中心应付账单': {EN: 'Employee center billing payable', CN: '员工中心应付账单'},
            '查询': {EN: 'query', CN: '查询'},
            '提交': {EN: 'submit', CN: '提交'},
            '查询条件': {EN: 'Query condition', CN: '查询条件'},
            '订单已付金额': {EN: 'Amount paid on order', CN: '订单已付金额'},
            '发票附件': {EN: 'Invoice attachment', CN: '发票附件'},
            '收款人全名': {EN: 'Full name of payee', CN: '收款人全名'},
            '收款人联系电话': {EN: 'Phone number of the payee', CN: '收款人联系电话'},
            '收款人邮箱': {EN: "Payee's mailbox", CN: '收款人邮箱'},
            '收款人收件地址': {EN: 'Addressee address of payee', CN: '收款人收件地址'},
            '货品明细': {EN: 'Detail of goods', CN: '货品明细'},
            '勾选全部': {EN: 'Check all', CN: '勾选全部'},
            '取消勾选全部': {EN: 'Uncheck all', CN: '取消勾选全部'},
            '勾选框': {EN: 'Check box', CN: '勾选框'},
            '货品': {EN: 'goods', CN: '货品'},
            '预算归属部门': {EN: 'Budget belongs to department', CN: '预算归属部门'},
            '总金额': {EN: 'Total amount', CN: '总金额'},
            '不可以代提该需求者': {EN: 'The demander cannot be substituted', CN: '不可以代提该需求者'},
            '没有代提权限': {EN: 'No proxy rights', CN: '没有代提权限'},
            '请填写采购订单编号！': {EN: 'Please fill in the purchase order number!', CN: '请填写采购订单编号！'},
            '该采购订单已全部开票!': {EN: 'This purchase order has been invoiced in full!', CN: '该采购订单已全部开票!'},
            '提交人，不能为空！': {EN: 'Submitter, cannot be empty!', CN: '提交人，不能为空！'},
            '币种，不能为空！': {EN: 'Currency, not empty!', CN: '币种，不能为空！'},
            '付款主体，不能为空！': {EN: 'Payment body, cannot be empty!', CN: '付款主体，不能为空！'},
            '供应商名称，不能为空！': {EN: 'Supplier name, cannot be empty!', CN: '供应商名称，不能为空！'},
            '所属部门，不能为空！': {EN: 'Department, cannot be empty!', CN: '所属部门，不能为空！'},
            '大小不能超过5Mb，请核对文件大小！': {EN: 'The size cannot exceed 5Mb, please check the file size!', CN: '大小不能超过5Mb，请核对文件大小！'},
            '请勾选需要提交的数据': {EN: 'Please check the data to be submitted', CN: '请勾选需要提交的数据'},
            '超出供应商总金额！': {EN: "Exceed the supplier's total amount!", CN: '超出供应商总金额！'},
            '采购订单为必填项，请验证操作流程是否正确': {EN: 'The purchase order is mandatory. Please verify that the procedure is correct', CN: '采购订单为必填项，请验证操作流程是否正确'},
            '已成功开票！': {EN: 'Invoice has been issued successfully!', CN: '已成功开票！'},
            '期望付款时间，不能为空！': {EN: 'Expected payment time, cannot be empty!', CN: '期望付款时间，不能为空！'},
            '采购订单': {EN: 'PO No.', CN: '采购订单'},
            '主要信息': {EN: 'Main Information', CN: '主要信息'},
            '提交人': {EN: 'Applicant', CN: '提交人'},
            '所属部门': {EN: 'Department', CN: '所属部门'},
            '是否代提': {EN: 'Delegate or not', CN: '是否代提'},
            '事由描述': {EN: 'Reason', CN: '事由描述'},
            '付款信息': {EN: 'Payment Information', CN: '付款信息'},
            '付款方式': {EN: 'Payment Method', CN: '付款方式'},
            '信用卡付款': {EN: 'Pay with Credit Card', CN: '信用卡付款'},
            '支票': {EN: 'Pay with Cheque', CN: '支票'},
            '银行自动扣款': {EN: 'Bank Direct Debit', CN: '银行自动扣款'},
            '币种': {EN: 'Currency', CN: '币种'},
            '本次付款金额': {EN: 'Payment Amount', CN: '本次付款金额'},
            '付款主体': {EN: 'Payer', CN: '付款主体'},
            '供应商名称': {EN: 'Vendor Name', CN: '供应商名称'},
            '期望付款时间': {EN: 'Expected Due Date', CN: '期望付款时间'},
            '附件': {EN: 'Attachment', CN: '附件'},
            '合同或报价单附件': {EN: 'Contract or Quotations', CN: '合同或报价单附件'},
            '(2)预算归属部门不能填写为一级部门：NA & EMEA /APAC/JBG/CBG/CEG/CSG/RDG': {
                EN: 'The Budget Department cannot be filled in as a first-level department: NA & EMEA / APAC / JBG / CBG / CSG / RDG',
                CN: '(2)预算归属部门不能填写为一级部门：NA & EMEA /APAC/JBG/CBG/CEG/CSG/RDG'
            },
            'Invoice No. 重复，请确认是否继续提交。': {EN: 'Duplicate Invoice No., please confirm whether to continue submitting.', CN: 'Invoice No. 重复，请确认是否继续提交。'},
            '第': {EN: 'The first', CN: '第'},
            '行：': {EN: 'line', CN: '行：'},
            '，不能为空！': {EN: ', cannot be empty!', CN: '，不能为空！'},
            '该采购订单金额已全部支付!': {EN: 'The purchase order amount has been fully paid ！', CN: '该采购订单金额已全部支付!'},
            '对公账户付款': {EN: 'Bank Wire Transfer', CN: '对公账户付款'},
            '付款周期': {EN: 'Payment Cycle', CN: '付款周期'},
            '支付金额': {EN: 'payment amount', CN: '支付金额'},
            '选择文件': {EN: 'Select file', CN: '选择文件'},
            '未选择任何文件': {EN: 'No file is selected', CN: '未选择任何文件'},
            '对于需要关联采购订单的付款，请输入采购订单号，并选择付款方式，点击【查询】按钮，系统将自动填充采购申请单的相关信息。': {
                EN: 'To process payments associated with a purchase order, please enter the PO NO., select a PAYMENT METHOD, and click the "query" button. The system will automatically populate relevant information from the purchase request form.',
                CN: '对于需要关联采购订单的付款，请输入采购订单号，并选择付款方式，点击【查询】按钮，系统将自动填充采购申请单的相关信息。'
            },
            '费用明细': {EN: 'Expense Details', CN: '费用明细'},
            '费用类型': {EN: 'Expense Type', CN: '费用类型'},
            '超申请理由': {EN: 'Reasons for Exceeding PR Amount', CN: '超申请理由'},
            '请填写付款方式！': {EN: 'Please select the payment method!', CN: '请填写付款方式！'},
            'INVOICE NO. 重复，请确认是否继续提交!': {EN: 'INVOICE NO. Duplicate, please confirm whether to continue to submit!', CN: 'INVOICE NO. 重复，请确认是否继续提交!'},
            '该申请金额已超采购申请10%，不允许提交。': {
                EN: 'The amount of this application exceeds 10% of the purchase application, so it is not allowed to be submitted.',
                CN: '该申请金额已超采购申请10%，不允许提交。'
            },
            '该申请金额已超采购申请（但未超过10%），请确认。如需提交请填写【超申请理由】': {
                EN: 'The amount of this application exceeds the purchase application (but not more than 10%), please confirm. If you need to submit, please fill in 【Reason for not Applying】.',
                CN: '该申请金额已超采购申请（但未超过10%），请确认。如需提交请填写【超申请理由】'
            },
            '付款申请已提交成功！': {EN: 'Payment application has been submitted successfully!', CN: '付款申请已提交成功！'},
            'INVOICE编号': {EN: 'INVOICE NUMBER', CN: 'INVOICE编号'},
            '事由描述': {EN: 'Reason', CN: '事由描述'},
            "采购订单不存在或不存在可操作数据": {EN: "The purchase order does not exist or there is no actionable data", CN: "采购订单不存在或不存在可操作数据"},
            '执行异常，请重试': {EN: 'Execution exception, please try again', CN: '执行异常，请重试'},
            '项目': {EN: 'Project', CN: '项目'},
            '预提': {EN: 'Payable Accrual', CN: '预提'},



            // djm 新增提示文字“请选择【IT 资产分类】！”
            'ERR_IT_ASSET': {EN: 'Please select【IT Assets Class】！', CN: '请选择【IT 资产分类】！'},
            // djm 新增提示文字"美元金额为:"
            'ERR_USD_AMOUNT' : {EN: 'The amount is USD', CN: '美元金额 '},
            // djm 新增提示文字"，超过 USD20K，请填写【次选供应商】。如果确认只有单一供应商，请填写单一供应商理由。"
            'ERR_ADOVE_20K' : {EN: ', over USD20K. Please fill in【Secondary-choice Vendor】and【Reasons for selection of secondary-choice vendor and quotation】. \n' +
                    '  If confirmed there is only one vendor, please fill in【Reasons for a single vendor】.', CN: '，超过 USD20K，请填写【次选供应商】及【次选供应商入选理由及报价】。\n' +
                    '  如果确认只有单一供应商，请填写单一供应商理由。'},
            'ERR_ADOVE_100K' : {EN: ', over USD100K. Please fill in【Third-choice Vendor】and【Reasons for selection of third-choice vendor and quotation】.', CN: '，超过 USD100K，请填写【末选供应商】及【末选供应商入选理由及报价】。'},
            // djm 新增[次选供应商理由],[末选供应商理由],[单一供应商理由]填写情况23.3.27
            'ERR_VENDOR2_MEMO':{EN: ' Please fill in【Reasons for selection of secondary-choice vendor and quotation】', CN: '请填写【次选供应商入选理由及报价】。'},
            'ERR_VENDOR3_MEMO':{EN: ' Please fill in【Reasons for selection of third-choice vendor and quotation】', CN: '请填写【末选供应商入选理由及报价】。'},
            'ERR_VENDOR_SINGLE':{EN: ' Please clear【Reasons for a single vendor】', CN: '请清空【单一供应商理由】。'},
            // ======djm 2023.4.3+新增【填写首选供应商】，判断【需求者】和员工是否一致=======
            'ERR_PRIMARY_VENDOR':{EN:' Please fill in the 【PRIMARY-CHOICE VENDOR】.', CN: '请填写【首选供应商】。'},
            'ERR_CHK_APPLIER':{EN:' If applicant is different from current applier, please check applicant.', CN: '【需求者】和【当前员工】不一致，请核对【需求者】'},
            // =========================新增翻译添加结束===============================

            '提示': {EN: 'Tip', CN: '提示'},
            '当前行数据处理中或处理完成，不可删除': {EN: 'The current row of data is being processed or completed, and cannot be deleted', CN: '当前行数据处理中或处理完成，不可删除'},
            '提交完成': {EN: 'Submission completed', CN: '提交完成'},
            "【采购订单】不存在明细行或未执行【查询】功能": {EN: 'There are no detailed lines in the purchase order or the query function has not been executed', CN: '【采购订单】不存在明细行或未执行【查询】功能'},

            '飞书审批列表字段映射未维护字段名称：': {EN: 'The field name is not maintained in the field mapping of Lark approval list', CN: '飞书审批列表字段映射未维护字段名称：'},
            '对应的ID': {EN: 'which ID', CN: '对应的ID'},
            '对应的TEXT': {EN: 'which TEXT', CN: '对应的TEXT'},
            '对应的TEXT:': {EN: 'which TEXT', CN: '对应的TEXT:'},
            '的VALUE:': {EN: 'is VALUE', CN: '的VALUE:'},
            '账单申请主体要与采购申请一致，如果不一致请重新做采购申请。': {
                EN: 'The payer of the vendor billing request must be consistent with the purchase requisition. If not, please make a new purchase requisition.',
                CN: '账单申请主体要与采购申请一致，如果不一致请重新做采购申请。'
            },
            '同步供应商信息': {
                EN: 'Sync Vendor Info',
                CN: '同步供应商信息'
            }
        };

        function translate(str) {
            var lang = runtime.getCurrentUser().getPreference({name: "LANGUAGE"});
            // log.debug('lang 1',lang);
            lang = lang == 'zh_CN' ? "CN" : "EN";
            // log.debug('str',str);
            // log.debug('lang 3',JSON.stringify(langObj[str]));
            // log.debug('result',langObj[str] ? langObj[str][lang] : '无翻译');
            return langObj[str] ? langObj[str][lang] : str;
        }

        return {
            translate: translate
        };


    });

       
    
