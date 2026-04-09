/**
 * @NApiVersion 2.0
 * @NModuleScope Public
 */
define([],

    function() {
        var data = {};

        // salesforce 拉取单据 PDF文件夹内部ID
        data.SALESFORCE_QUREY_INVOICE_PDF_FOLDER_ID = "147";//沙箱：53  生产：147

        // salesforce 拉取单据 日记账 借记-2401 递延收益
        //data.SALESFORCE_QUREY_JOURNALREC_DEBIT_PORFIT = "972";//沙箱：798  生产：972

        // salesforce 拉取单据 日记账 贷记-6001 营业收入credit
        //data.SALESFORCE_QUREY_JOURNALREC_CREDIT_INCOME = "984";//沙箱：811  生产：984

        // salesforce 拉取单据 客户-类型 isperson=“公司”
        data.SALESFORCE_QUREY_CUSTOMER_ISPERSON_COMPANY = "F";

        // salesforce 拉取单据 销售订单  订单状态-待履行
        data.SALESFORCE_QUREY_SO_STATUS_WAIT_FULFIL = "B";

        // salesforce 拉取单据 日记账 来源平台-salesforce
        data.SALESFORCE_QUREY_JOURNALREC_PLATFROM = "2";

        // 飞书合同拉取存放文件夹 沙箱258 生产155
        data.FEISHU_PR_CONTRACT_FOLDER = "155";

      data.FILE_TYPE_JSON = {
                "doc" : "WORD",
                "docx" : "WORD",
                "xlsx" : "EXCEL",
                "xls" : "EXCEL",
                "pdf" : "PDF",
                "jpg" : "JPGIMAGE",
                "png" : "PNGIMAGE"
        }
      
        // SWC Platform
        // 金蝶云星空
        data.SWC_PLATFORM_KINGDEE = "金蝶云星空";
        data.SWC_PLATFORM_KINGDEE_ID = "4";
        // 飞书
        data.SWC_PLATFORM_LARK = "飞书";
        data.SWC_PLATFORM_LARK_ID = "3";

        // 金蝶云星空_登录_URL
        data.KINGDEE_LOGIN_URL = "https://pingcap.ik3cloud.com/k3cloud/Kingdee.BOS.WebApi.ServicesStub.AuthService.ValidateUser.common.kdsvc";
        // 金蝶云星空_凭证_单据查询_URL
        data.KINGDEE_VOUCHER_RECSCH_URL = "https://pingcap.ik3cloud.com/k3cloud/Kingdee.BOS.WebApi.ServicesStub.DynamicFormService.ExecuteBillQuery.common.kdsvc";
        // 金蝶云星空_登录_请求参数
        data.KINGDEE_LOGIN_POST_DATA = {"acctID":"20201217180017639", "username":"administrator",
            "password":"pingcap2022!", "lcid":"2052"};
        // 金蝶云星空_登录_请求头
        data.KINGDEE_LOGIN_HEADER = {"Accept":"application/json","Content-Type":"application/json"};

        // 金蝶云星空请求操作区分_查询凭证数量
        data.KINGDEE_OPT_FLAG_QUERY_VOUCHER_TOTAL = '0';

        // 飞书创建审批实例取值目标 => "id"
        data.FS_CRT_APPROVAL_VALUE_TARGET_ID = "id";
        // 飞书创建审批实例取值目标 => "value"
        data.FS_CRT_APPROVAL_VALUE_TARGET_VALUE = "value";

        // 飞书审批列表字段映射字典数据_检索参数_飞书供应商账单申请
        data.FS_APPROVAL_FIELD_MAPPING_VENDOR_ACCT_APPLY = "飞书供应商账单申请";
        // 飞书审批列表字段映射字典数据_飞书采购申请
        data.FS_APPROVAL_FIELD_MAPPING_PURCH_APPLY = "飞书采购申请";

        // 飞书审批模板_供应商账单申请
        data.FS_APPROVAL_TEMPLATE_VENDOR_ACCT_APPLY = "7475FE86-9720-466A-AE43-F0F79E554AA6";
        // 飞书审批模板_采购申请
        data.FS_APPROVAL_TEMPLATE_PURCH_APPLY = "FB6D2FA3-B5C3-4239-BB73-C413F23555A8";

        // 飞书审批模板_Expense Type_自定义id："item"
        data.FS_APPROVAL_EXPENSE_TYPE_CUST_ID = "item";
        // Expense Type_固定资产
        data.EXPENSE_TYPE_FIXED_ASSETS = "1100 Fixed Assets";

        // 会计账簿_Accounting Book(HK) 开发环境：4；生产环境2
        data.ACCT_BOOK_HK = "2";

        // 工作流状态_待提交：1
        data.WORKFLOW_STATUS_TO_BE_SUBMITTED = "1";
        // 工作流状态_飞书审批中：3
        data.WORKFLOW_STATUS_FS_APPROVAL = "3";
        // 工作流状态_飞书审批完成：4
        data.WORKFLOW_STATUS_FS_APPROVAL_FINISH = "4";
        // 工作流状态_飞书审批驳回：5
        data.WORKFLOW_STATUS_FS_APPROVAL_REJECT = "5";
        // 工作流状态_采购订单已创建：10
        data.WORKFLOW_STATUS_PURCH_ORD_CREATED = "10"
        // 工作流状态_推送失败：11
        data.WORKFLOW_STATUS_PUSH_FAILURE = "11";

        // 账单审批状态_待审批: 1
        data.BILL_APPROVAL_STATUS_PENDING_APPROVAL = "1";
        // 账单审批状态_飞书审批中：2
        data.BILL_APPROVAL_STATUS_FS_APPROVAL = "2";
        // 账单审批状态_飞书审批完成：3
        data.BILL_APPROVAL_STATUS_FS_APPROVAL_FINISH = "3";
        // 账单审批状态_飞书审批驳回：4
        data.BILL_APPROVAL_STATUS_FS_APPROVAL_REJECT = "4"
        // 账单审批状态_账单已创建：5
        data.BILL_APPROVAL_STATUS_BILL_CREATED = "5";
        // 账单审批状态_飞书推送失败：6
        data.BILL_APPROVAL_STATUS_FS_PUSH_FAILURE = "6";

        // 供应商账单 沙箱：259，生产：154
        data.VENDOR_BILL_REQ_FILE_LOCATION = "154";

        // 金蝶备注_结转本期损益
        data.KINGDEE_MEMO_CARRY_CURRPERIOD_PROFIT2LOSS = "结转本期损益";

        // 科目611802 其他费用 : 其他费用_已实现的汇兑损失
        data.ACCOUNT_OTHER_EXPENSES_REALIZED_EXCHANGE_LOSSES = "1368";

        // 日记账：自定义表单：公司间日记账分录
        data.JOURNALENTRY_CUSTOMFORM_INTERCOMPANY = "107";

        // 货币_CNY
        data.CURRENCY_CNY = "8";

        // 汇率_CNY：1
        data.EXCHANGERATE_CNY = "1";

        // 供应商账单申请 付款方式 信用卡
        data.VENDOR_BILL_PAYMENT_METHOD_CARD = "2";

        // 公司间交易类型
        // 公司间交易类型_客户
        data.INTERCOMPANY_TRANSACTIONS_TYPE_CSR = "客户";
        // 公司间交易类型_供应商
        data.INTERCOMPANY_TRANSACTIONS_TYPE_VEN = "供应商";

        // 项目（日记账）：X0000 N/A
        data.PROJECT_JOURNAL_X0000 = "3";

            // 账单 付款方式 对公转账
            //data.VENDOR_BILL_PAYMENT_METHOD_TA = "1";

            // 账单支付 审批状态 已批准
            //data.VENDOR_PAYMENT_STATUS_APPROVED = "2";

            data.TAXCODE_ID_10 = 16;//税码 10%
            data.TAXCODE_ID_7 = 13;//税码 7%
            data.TAXCODE_ID_8= 12;//税码 8%
            data.TAXCODE_ID_9 = 11;//税码 9%
      
            data.TAX1ACCT_YJSF = 1548;//科目：应交税费_暂收消费税（消费税销项税额 生产：1548  沙箱：3613

            //Navan 子公司映射关系
            data.NAVAN_SUBSIDIARY = {
            "PINGCAP (US), INC.":6,
            "PINGCAP PTE. LTD." : 28,
            "PingCAP Kabushiki-Kaisha" :9,
            "PINGCAP SDN. BHD." :25
        }

            function configData() {
                    return data;
            }

        return {
            configData: configData
        };

    });
