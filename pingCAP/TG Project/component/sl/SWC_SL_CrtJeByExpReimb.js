/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 */
define(["N/ui/serverWidget", 'N/search','N/record','../../common/SWC_CrtJeByExpReimb','N/format','N/task'],

    (serverWidget, search,record,SWC_CrtJeByExpReimb,format,task) => {
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
            log.audit("request",request);
            var option = {}; // 创建空对象，用于处理从CS脚本传递来的数据
            var obj = request.parameters.obj || ''; // 获取从CS脚本传递来的“页面所有字段值”(用作保存检索的条件)
            log.audit("obj",obj);
            if (obj != '') obj = JSON.parse(obj); // 如果obj(查询条件)有值,则进行json格式转化(非空校验防止报错，以及转化后的数据用于后续处理)
            if (obj.api && obj.api == 'chkData') {     // 从CS接收数据,如果返回的事【查询功能】，则需要进行数据检索(同时注意非空校验)
                log.audit("开始查询！","开始查询！");
                var jeFilter = SWC_CrtJeByExpReimb.getJeFilter(obj.jeSubs,obj.jeEmp); // 根据传递的值，动态的添加筛选器来检索数据；
                log.audit("筛选条件：",jeFilter);
                var jeSrchRst = SWC_CrtJeByExpReimb.srchByJeFilters(jeFilter); // 根据整理后的筛选器，检索对应的日记账数据
                log.audit("检索结果",jeSrchRst);
            }
            log.audit("整理后的检索结果",jeSrchRst);
            if (obj.api && obj.api == 'crtJe') {
                log.audit("开始创建中间表数据","开始创建中间表数据");
                log.audit("处理后的[中间表数据]obj.vbSubData",obj.je);
                // 根据从CS传递的数据，进行数据整理，创建【中间表】
                // var multVerifId = SWC_CrtJeByExpReimb.crtMultVerifByData(obj.je);
                var midRecId = SWC_CrtJeByExpReimb.crtMidRecByJeData(obj.je);
                if (midRecId.successflag == "success") {
                    log.audit("单据信息","创建【中间表】成功，ID为：" + midRecId.midRecId);
                    // 创建 Scheduled Script 任务
                    var myTask = task.create({
                        taskType: task.TaskType.SCHEDULED_SCRIPT,
                        scriptId: "customscript_swc_ss_crtjebyexpreimb",
                        deploymentId:  "customdeploy_swc_ss_crtjebyexpreimb_2",
                        params: {custscript_swc_jsonid:midRecId.midRecId,custscript_swc_type: 'create'}
                    });
                    var taskId = myTask.submit();
                    log.audit('taskId', taskId);
                    scriptContext.response.write({output : JSON.stringify(midRecId)});
                    return;
                } else {
                    log.audit("单据信息","创建【中间表】出错" + midRecId.message);
                    scriptContext.response.write({output : JSON.stringify(midRecId)});
                    return;
                }
            }
            if (obj.api && obj.api == 'chkDataUnMark') {
                log.audit("开始查询(取消全选)！","开始查询(取消全选)！");
                var jeFilter = SWC_CrtJeByExpReimb.getJeFilter(obj.jeSubs,obj.jeEmp); // 根据传递的值，动态的添加筛选器来检索数据；
                log.audit("筛选条件：",jeFilter);
                var jeSrchRst = SWC_CrtJeByExpReimb.srchByJeFilters(jeFilter); // 根据整理后的筛选器，检索对应的日记账数据
                log.audit("检索结果",jeSrchRst);
            }
            createForm(option); // 根据传递的对象,生成动态的单据头信息;
            if (obj) setFormValue(option,obj); // 根据CS接收的数据,为字段赋值;
            createSublist(option); // 根据传递的对象,生成动态的子列表信息;
            if (jeSrchRst && jeSrchRst.length > 0) setSubValue(option,jeSrchRst,obj); // 根据获取的检索数据，为子列表赋值；
            scriptContext.response.writePage(option.form); // 将动态信息写入页面;
        }

        /**
         * 根据CS接收的数据,为字段赋值
         * @param {Object} option
         */
        function createForm(option){
            // 创建表单
            var newForm = serverWidget.createForm({title: "批量支付员工费用报销"});
            log.audit("createForm","createForm");
            newForm.clientScriptModulePath = '../cs/SWC_CS_CrtJeByExpReimb'; // 引用CS内容(用于添加按钮,实现对应的功能)
            // 点击按钮时,触发相关方法,1.运行(进行检索),2.生成(生成单据)
            // ======================按钮部分=====================
            newForm.addButton({id: "custpage_swc_exesrchbutton", label: "查询", functionName:"exeSrch"}); // 点击该按钮触发"查询"方法
            newForm.addButton({id: "custpage_swc_crtjebutton", label: "提交", functionName:"crtJeByReimb"}); // 点击该按钮触发"生成单据"(可能会出现数量量的问题)
            // ======================查询条件部分字段=====================
            newForm.addFieldGroup({id: 'custpage_field_chkcondition', label: '查询条件'}); // 首先设置分组
            var subsField = newForm.addField({id: "custpage_swc_subs", label: "公司主体", type: 'SELECT', source: 'subsidiary', container: 'custpage_field_chkcondition',isMandatory:'true'}); // "子公司"字段(必填),(用于检索数据);
            subsField.isMandatory = true; // 子公司字段添加必填样式(红色星号);
            var employee = newForm.addField({id: 'custpage_swc_employee', label: "员工", type: 'SELECT', source: 'employee', container: 'custpage_field_chkcondition', isMandatory: 'true'}); // "供应商"字段(必填),(用于检索数据);
            var bankAcct = newForm.addField({id: "custpage_swc_bankamount", label: "默认付款银行账户", type: 'SELECT', source: 'account', container: 'custpage_field_chkcondition'}); // "金额"字段
            // ===================查询条件部分结束=====================
            option.form = newForm; // 向传进来的对象添加"表单"属性,(用于根据Option.form生成对应的单据头信息);
        }

        /**
         * 创建列表主体,
         * @param {Object} option
         * @param {Object} obj
         */
        function setFormValue(option,obj){
            // 更新标点数据，将对应的主体字段赋值(数据反写)
            option.form.updateDefaultValues({
                'custpage_swc_subs': obj.jeSubs,  // 主体字段：子公司
                'custpage_swc_employee':obj.jeEmp,  // 主体字段：员工
                'custpage_swc_bankamount':obj.jeBankAcct,  // 主体字段：默认付款银行账户
            });
        }

        /**
         * 创建子列表
         * @param {Object} option
         */
        function createSublist(option) {
            // 创建子列表,添加对应字段
            var sublist = option.form.addSublist({id: 'custpage_sublist', type: serverWidget.SublistType.INLINEEDITOR, label: '批量支付员工费用报销明细'});
            sublist.addButton({id: 'custpage_sublist_btn_mark_all', label: '全选', functionName: 'markAll'}); // 全部勾选按钮(用于批量勾选,批量生成对应日记账),[待替换];
            sublist.addButton({id: 'custpage_sublist_btn_previous_unmark_all', label: '取消全选', functionName: 'unmarkAll'}); // 全部取消勾选(用于批量取消勾选),[待替换];
            sublist.addField({id: 'custpage_sub_checkflag', label: '主行(勾选)', type: 'CHECKBOX'}); // 勾选按钮,(批量生成对应日记账);
            var jeNumber = sublist.addField({id: 'custpage_sub_jenumber', label: '日记账单号', type: 'SELECT', source: 'journalentry'}); // 日记账单号,(批量生成对应日记账);
            var reimbAmt = sublist.addField({id: 'custpage_sub_reimbamt', label: '报销总金额', type: 'TEXT'}); // 报销总金额,(批量生成对应日记账);
            var empData = sublist.addField({id: 'custpage_sub_empdata', label: '员工', type: 'SELECT', source:'employee'}); // 员工,(批量生成对应日记账);
            var subsData = sublist.addField({id: 'custpage_sub_subsdata', label: '子公司', type: 'SELECT', source: 'subsidiary'}); // 子公司,(批量生成对应日记账);
            var currData = sublist.addField({id: 'custpage_sub_currdata', label: '货币', type: 'SELECT', source: 'currency'}); // 货币,(批量生成对应日记账);
            var exchangeRate = sublist.addField({id: 'custpage_sub_exchangerate', label: '汇率', type: 'TEXT'}); // 汇率,(批量生成对应日记账);
            var jeDateFld = sublist.addField({id: 'custpage_sub_date', label: '日期', type: 'DATE'}); // 日期,(批量生成对应日记账);
            jeNumber.updateDisplayType({displayType: serverWidget.FieldDisplayType.DISABLED});
            reimbAmt.updateDisplayType({displayType: serverWidget.FieldDisplayType.DISABLED});
            empData.updateDisplayType({displayType: serverWidget.FieldDisplayType.DISABLED});
            subsData.updateDisplayType({displayType: serverWidget.FieldDisplayType.DISABLED});
            currData.updateDisplayType({displayType: serverWidget.FieldDisplayType.DISABLED});
            exchangeRate.updateDisplayType({displayType: serverWidget.FieldDisplayType.DISABLED});
            jeDateFld.updateDisplayType({displayType: serverWidget.FieldDisplayType.DISABLED});
            option.sublist = sublist; // 向传进来的对象添加"子列表"属性,(用于根据Option.sublist属性生成对应的动态子列表信息);
        }

        /**
         * 根据保存检索数据,为子列表赋值
         * @param {Object} option
         * @param {Array} srchRst
         * @param {Object} obj
         */
        function setSubValue(option,srchRst,obj){
            if (obj.api &&　obj.api == "chkDataUnMark") {
                log.audit("子列表查询结果(取消全选)：",srchRst);
                for (var i = 0; i <srchRst.length;i++){
                    // 赋值【勾选情况】
                    option.sublist.setSublistValue({
                        id: 'custpage_sub_checkflag',
                        line: i,
                        value: "F"
                    });
                    // 赋值【日记账单号】
                    if (srchRst[i].je_intlid) option.sublist.setSublistValue({
                        id: 'custpage_sub_jenumber',
                        line: i,
                        value: srchRst[i].je_intlid
                    });
                    // 赋值【报销总金额】
                    if (srchRst[i].je_amount) option.sublist.setSublistValue({
                        id: 'custpage_sub_reimbamt',
                        line: i,
                        value: Number(srchRst[i].je_amount)
                    });
                    // 赋值【员工】
                    if (srchRst[i].je_emp) option.sublist.setSublistValue({
                        id: 'custpage_sub_empdata',
                        line: i,
                        value: srchRst[i].je_emp
                    });
                    // 赋值【子公司】
                    if (srchRst[i].je_subs) option.sublist.setSublistValue({
                        id: 'custpage_sub_subsdata',
                        line: i,
                        value: srchRst[i].je_subs
                    });
                    // 赋值【货币】
                    if (srchRst[i].je_curr) option.sublist.setSublistValue({
                        id: 'custpage_sub_currdata',
                        line: i,
                        value: srchRst[i].je_curr
                    });
                    // 赋值【汇率】
                    if (srchRst[i].je_rate) option.sublist.setSublistValue({
                        id: 'custpage_sub_exchangerate',
                        line: i,
                        value: srchRst[i].je_rate
                    });
                    // 赋值【日期】
                    if (srchRst[i].je_date) option.sublist.setSublistValue({
                        id: 'custpage_sub_date',
                        line: i,
                        value: srchRst[i].je_date
                    });
                }
            } else {
                log.audit("子列表查询结果：",srchRst);
                for (var i = 0; i <srchRst.length;i++){
                    // 赋值【勾选情况】
                    option.sublist.setSublistValue({
                        id: 'custpage_sub_checkflag',
                        line: i,
                        value: "T"
                    });
                    // 赋值【日记账单号】
                    if (srchRst[i].je_intlid) option.sublist.setSublistValue({
                        id: 'custpage_sub_jenumber',
                        line: i,
                        value: srchRst[i].je_intlid
                    });
                    // 赋值【报销总金额】
                    if (srchRst[i].je_amount) option.sublist.setSublistValue({
                        id: 'custpage_sub_reimbamt',
                        line: i,
                        value: Number(srchRst[i].je_amount)
                    });
                    // 赋值【员工】
                    if (srchRst[i].je_emp) option.sublist.setSublistValue({
                        id: 'custpage_sub_empdata',
                        line: i,
                        value: srchRst[i].je_emp
                    });
                    // 赋值【子公司】
                    if (srchRst[i].je_subs) option.sublist.setSublistValue({
                        id: 'custpage_sub_subsdata',
                        line: i,
                        value: srchRst[i].je_subs
                    });
                    // 赋值【货币】
                    if (srchRst[i].je_curr) option.sublist.setSublistValue({
                        id: 'custpage_sub_currdata',
                        line: i,
                        value: srchRst[i].je_curr
                    });
                    // 赋值【汇率】
                    if (srchRst[i].je_rate) option.sublist.setSublistValue({
                        id: 'custpage_sub_exchangerate',
                        line: i,
                        value: srchRst[i].je_rate
                    });
                    // 赋值【日期】
                    if (srchRst[i].je_date) option.sublist.setSublistValue({
                        id: 'custpage_sub_date',
                        line: i,
                        value: srchRst[i].je_date
                    });
                }
            }


        }

        /**
         * 转换成正8区时间
         * @param times
         * @returns {Date}
         */
        function getDate(times) {
            var timeZone = 8;
            var date = new Date(times);
            var utcTime = date.getTime() + date.getTimezoneOffset() * 60 * 1000;
            var tzTime = utcTime + timeZone * 60 * 60 * 1000;
            return new Date(tzTime);
        }

        return {onRequest}

    });
