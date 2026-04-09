var urlData = "https://5180180.app.netsuite.com/app/accounting/transactions/journal.nl?id=" // 跳转链接(正式需要修改)

/**
 * @NApiVersion 2.x
 * @NScriptType ClientScript
 * @NModuleScope SameAccount
 */
define(["N/record","N/currentRecord","N/search","../../common/SWC_CrtJeByExpReimb","N/url","N/https","../Common/TP_Comm_Number","N/ui/dialog"],

function(record,currentRecord,search,SWC_CrtJeByExpReimb,url,https,_cn,dialog) {

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
        var changedField = scriptContext.fieldId;
        // 【公司主体】修改情况
        if (changedField == 'custpage_swc_subs') {
            var curRec = scriptContext.currentRecord;
            var subsId = curRec.getValue({fieldId: 'custpage_swc_subs'});
            if (subsId) {
                var bankAcct = SWC_CrtJeByExpReimb.getBankAcctBySubs(subsId);
                if (bankAcct.bankAcct && bankAcct.bankAcct != "bankAcctNotExist") {
                    curRec.setValue({fieldId: 'custpage_swc_bankamount', value: bankAcct.bankAcct});
                }
            }
        }
    }

    /**
     * Function to be executed when field is slaved.
     *
     * @param {Object} scriptContext
     * @param {Record} scriptContext.currentRecord - Current form record
     * @param {string} scriptContext.sublistId - Sublist name
     * @param {string} scriptContext.fieldId - Field name
     *
     * @since 2015.2
     */
    function postSourcing(scriptContext) {

    }

    /**
     * Function to be executed after sublist is inserted, removed, or edited.
     *
     * @param {Object} scriptContext
     * @param {Record} scriptContext.currentRecord - Current form record
     * @param {string} scriptContext.sublistId - Sublist name
     *
     * @since 2015.2
     */
    function sublistChanged(scriptContext) {
    }

    /**
     * Function to be executed after line is selected.
     *
     * @param {Object} scriptContext
     * @param {Record} scriptContext.currentRecord - Current form record
     * @param {string} scriptContext.sublistId - Sublist name
     *
     * @since 2015.2
     */
    function lineInit(scriptContext) {

    }

    /**
     * Validation function to be executed when field is changed.
     *
     * @param {Object} scriptContext
     * @param {Record} scriptContext.currentRecord - Current form record
     * @param {string} scriptContext.sublistId - Sublist name
     * @param {string} scriptContext.fieldId - Field name
     * @param {number} scriptContext.lineNum - Line number. Will be undefined if not a sublist or matrix field
     * @param {number} scriptContext.columnNum - Line number. Will be undefined if not a matrix field
     *
     * @returns {boolean} Return true if field is valid
     *
     * @since 2015.2
     */
    function validateField(scriptContext) {

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
        // var vetifRec = currentRecord.get(); // 如果修改了【子列表核销金额】，则遍历整个子列表
        // var subLineCount = vetifRec.getLineCount({sublistId: 'custpage_sublist'});
        // var mainChekTimes = 0; // 声明变量【主行核销勾选次数】（防止勾选多个主行）
        // var mainCheckAmt = 0; // 声明变量【主行核销金额】
        // var verifCheckAmt = 0; // 声明变量【已核销金额】
        // var currLineIndex = vetifRec.getCurrentSublistIndex({sublistId: "custpage_sublist"}); // 获取当前行号
        // for (var i = 0; i < subLineCount; i++) {
        //     var mainCheckTest = vetifRec.getSublistValue({sublistId: "custpage_sublist", fieldId: "custpage_sub_checkmain", line: i}); // 获取【主行（勾选）】
        //     var currMainCheckTest = vetifRec.getCurrentSublistValue({sublistId: "custpage_sublist", fieldId: "custpage_sub_checkmain"}); // 获取【主行（勾选）】
        //     var remainVerifAmt = vetifRec.getCurrentSublistValue({sublistId: "custpage_sublist", fieldId: "custpage_sub_leftamount"}); // 获取【剩余可核销金额】
        //     var currVerifAmt = vetifRec.getCurrentSublistValue({sublistId: "custpage_sublist", fieldId: "custpage_sub_verifamount"}); // 获取【本次核销金额】
        //     var currLineIndex1 = vetifRec.getCurrentSublistIndex({sublistId: "custpage_sublist"}); // 获取当前行号
        //     if (i == currLineIndex1 && currMainCheckTest == true) {
        //         mainChekTimes ++ ;
        //     }
        //     else if (mainCheckTest == true) {
        //         mainChekTimes ++ ;
        //     }
        // }
        // var currMainCheck = vetifRec.getCurrentSublistValue({sublistId: "custpage_sublist", fieldId: "custpage_sub_checkmain"}); // 获取【主行（勾选）
        // var currVerifCheck = vetifRec.getCurrentSublistValue({sublistId: "custpage_sublist", fieldId: "custpage_sub_checkverif"}); // 获取【主行（勾选）
        // if (mainChekTimes > 1) {
        //     alert("【主行】只能勾选一行日记账！");
        //     return false;
        // }
        // if (currVerifCheck == true && currMainCheck == true) {
        //     alert("【主行】不能和【核销】勾选同一行日记账！");
        //     return false;
        // }
        // // alert("本次核销金额:"+ currVerifAmt);
        // // alert("剩余可核销金额:"+ remainVerifAmt);
        // if (remainVerifAmt >= 0 && Number(currVerifAmt) > Number(remainVerifAmt)) {
        //     alert("【本次核销金额】不能大于【剩余可核销金额】！");
        //     return false;
        // }
        // if (remainVerifAmt < 0 && currVerifAmt < remainVerifAmt) {
        //     alert("【本次核销金额】不能小于【剩余可核销金额】！");
        //     return false;
        // }
        return true;
    }

    /**
     * Validation function to be executed when sublist line is inserted.
     *
     * @param {Object} scriptContext
     * @param {Record} scriptContext.currentRecord - Current form record
     * @param {string} scriptContext.sublistId - Sublist name
     *
     * @returns {boolean} Return true if sublist line is valid
     *
     * @since 2015.2
     */
    function validateInsert(scriptContext) {

    }

    /**
     * Validation function to be executed when record is deleted.
     *
     * @param {Object} scriptContext
     * @param {Record} scriptContext.currentRecord - Current form record
     * @param {string} scriptContext.sublistId - Sublist name
     *
     * @returns {boolean} Return true if sublist line is valid
     *
     * @since 2015.2
     */
    function validateDelete(scriptContext) {

    }

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

    }

    // 通过点击SL页面按钮，执行exeSrch()方法，查询数据
    function exeSrch(){
        // debugger;
        // alert("开始查询")
        var currRec = currentRecord.get(); // 获取当前表单(用于获取页面上所有字段值)
        var option = SWC_CrtJeByExpReimb.getBodyValue(currRec); // 获取表单的所有字段值(作为检索条件);
        // alert("字段数据:"+JSON.stringify(option))
        if (!option.jeSubs){alert("请输入'子公司'!");return;} // 子公司字段必填项校验;
        option.api = 'chkData'; // 将要传递到sl的数据(检索条件)处理成JSON格式传递
        // alert("传递的option为："+JSON.stringify(option));
        window.onbeforeunload = null;  // 取消提示框
        // 获取SL 的地址并将检索条件传递到SL便于加速处理
        var urlObj = url.resolveScript({
            scriptId: 'customscript_swc_sl_crtjebyexpreimb',
            deploymentId: 'customdeploy_swc_sl_crtjebyexpreimb',
            // returnExternalUrl:true,
            params: {'obj': JSON.stringify(option)}
        });
        window.location.href = urlObj;
    }

    // 通过点击SL亚眠按钮，执行crtJeByVb()方法，获取子列表勾选的每一项数据，根据数据生成对应的日记账
    function crtJeByReimb(){
        debugger;
        // alert("开始生成【预付核销】");
        var currRec = currentRecord.get(); // 获取当前表单(用于获取页面子列表上勾选的数据);
        var option = SWC_CrtJeByExpReimb.getBodyValue(currRec); // 获取表单的所有字段值(作为日记账部分信息赋值);
        // 判断【默认付款银行账户】是否为空，为空则不允许提交
        if (!option.jeBankAcct){alert("请输入'默认付款银行账户'!");return;}
        if (!option.jeSubs){alert("请输入'子公司'!");return;}
        // 获取【子列表】信息
        var currRecLineCount = currRec.getLineCount({sublistId: 'custpage_sublist'}); // 首先获取【子列表行数】（用于遍历）
        var jeDataArr = []; // 创建数组用于存放子列表数据
        var checkTimes = 0;
        // 遍历【子列表】，获取所有勾选的数据；
        for(var i = 0; i < currRecLineCount; i++) {
            var checkFlag = currRec.getSublistValue({sublistId: "custpage_sublist", fieldId: "custpage_sub_checkflag", line: i}); // 获取【勾选】情况
            var jeCurr = currRec.getSublistValue({sublistId: "custpage_sublist", fieldId: "custpage_sub_currdata", line: i}); // 获取【货币】数据
            var jeRate = currRec.getSublistValue({sublistId: "custpage_sublist", fieldId: "custpage_sub_exchangerate", line: i}); // 获取【汇率】数据
            var jeIntlId = currRec.getSublistValue({sublistId: "custpage_sublist", fieldId: "custpage_sub_jenumber", line: i}); // 获取【日记账单号】数据
            var jeAmt = currRec.getSublistValue({sublistId: "custpage_sublist", fieldId: "custpage_sub_reimbamt", line: i}); // 获取【报销总金额】数据
            var jeDate = currRec.getSublistValue({sublistId: "custpage_sublist", fieldId: "custpage_sub_date", line: i}); // 获取【日期】数据
            var jeEmp = currRec.getSublistText({sublistId: "custpage_sublist", fieldId: "custpage_sub_empdata", line: i}); // 获取【员工】数据
            var jeEmpId = currRec.getSublistValue({sublistId: "custpage_sublist", fieldId: "custpage_sub_empdata", line: i}); // 获取【员工】数据
            var jeSubs = currRec.getSublistValue({sublistId: "custpage_sublist", fieldId: "custpage_sub_subsdata", line: i}); // 获取【日记账单号】数据
            // 如果【勾选】，则继续进行数据处理
            if (checkFlag) {
                var key = jeCurr + "_" + jeRate; // 通过【货币】+【汇率】作为唯一键
                var jeDataObj = {
                    'zj': key, // 数据主键，用于判断是否相等，如果相等创建同一张日记账
                    'dh': jeIntlId, // 子列表【日记账单号】，用于赋值
                    'je': jeAmt, // 子列表【报销总金额】用于赋值
                    'rq': jeDate, // 子列表【日期】用于赋值
                    'yg': jeEmp, // 子列表【员工】用于赋值
                    'ygm': jeEmpId, // 子列表【员工】ID用于赋值
                    'gs': jeSubs, // 子列表【子公司】用于赋值
                    'km': option.jeBankAcct, // 画面上【默认付款银行账户】用于赋值
                }
                if (jeDataObj.hasOwnProperty("dh") && jeDataObj.dh) jeDataArr.push(jeDataObj); // 将对应的每行数据放到数组中
                checkTimes ++;
            }
        }
        console.log("创建日记账，创建数据为：" + jeDataArr);
        // 计算【勾选的行数】,如果没有一行勾选，则不允许提交；
        if (checkTimes === 0) {
            alert("至少勾选1行数据！");
            return
        }
        var successTimes = 0; // 用于判断所有单据是否创建完成
        var crtMsg; // 用于存放错误信息
        option.api = 'crtJe'; // 将要传递到sl的数据处理成JSON格式传递;
        option.je = jeDataArr; // 将对应的数据添加到传递的option中;
        // alert("用于生成日记账的数组信息: "+JSON.stringify(option));
        var urlObj = url.resolveScript({
            scriptId: 'customscript_swc_sl_crtjebyexpreimb',
            deploymentId: 'customdeploy_swc_sl_crtjebyexpreimb',
            returnExternalUrl: true
        });
        var responseBody = https.post({
            url: urlObj,
            body: {'obj': JSON.stringify(option)}
        });
        var rspInfo = JSON.parse(responseBody.body);
        log.audit("单据信息","从SL回传的数据："+rspInfo.successflag);
        if (rspInfo.successflag == "success"){
            crtMsg = "创建日记账成功,对应ID为：";
        } else {
            crtMsg = "创建多项核销失败,报错信息为：" + rspInfo.message;
            dialog.alert({title: "提示", message:crtMsg});
            return;
        }
        // if (crtMsg) dialog.alert({title: "提示", message:crtMsg});
        window.onbeforeunload = null;  // 取消提示框
        dialog.alert({title: "提示", message:"正在创建对应日记账"});
        // 在页面加载完毕后执行
        setTimeout(function() {
            location.reload();
        }, 2000); // 2000 毫秒 = 2 秒
    }

    // 点击按钮触发"全选"功能
    function markAll() {
        // debugger;
        // alert("开始查询")
        var currRec = currentRecord.get(); // 获取当前表单(用于获取页面上所有字段值)
        var option = SWC_CrtJeByExpReimb.getBodyValue(currRec); // 获取表单的所有字段值(作为检索条件);
        // alert("字段数据:"+JSON.stringify(option))
        if (!option.jeSubs){alert("请输入'子公司'!");return;} // 子公司字段必填项校验;
        option.api = 'chkData'; // 将要传递到sl的数据(检索条件)处理成JSON格式传递
        // alert("传递的option为："+JSON.stringify(option));
        window.onbeforeunload = null;  // 取消提示框
        // 获取SL 的地址并将检索条件传递到SL便于加速处理
        var urlObj = url.resolveScript({
            scriptId: 'customscript_swc_sl_crtjebyexpreimb',
            deploymentId: 'customdeploy_swc_sl_crtjebyexpreimb',
            // returnExternalUrl:true,
            params: {'obj': JSON.stringify(option)}
        });
        window.location.href = urlObj;
    }

    // 点击按钮触发"取消全选"功能
    function unmarkAll() {
        // debugger;
        // alert("开始查询")
        var currRec = currentRecord.get(); // 获取当前表单(用于获取页面上所有字段值)
        var option = SWC_CrtJeByExpReimb.getBodyValue(currRec); // 获取表单的所有字段值(作为检索条件);
        // alert("字段数据:"+JSON.stringify(option))
        if (!option.jeSubs){alert("请输入'子公司'!");return;} // 子公司字段必填项校验;
        option.api = 'chkDataUnMark'; // 将要传递到sl的数据(检索条件)处理成JSON格式传递
        // alert("传递的option为："+JSON.stringify(option));
        window.onbeforeunload = null;  // 取消提示框
        // 获取SL 的地址并将检索条件传递到SL便于加速处理
        var urlObj = url.resolveScript({
            scriptId: 'customscript_swc_sl_crtjebyexpreimb',
            deploymentId: 'customdeploy_swc_sl_crtjebyexpreimb',
            // returnExternalUrl:true,
            params: {'obj': JSON.stringify(option)}
        });
        window.location.href = urlObj;
    }

    return {
        pageInit: pageInit,
        exeSrch: exeSrch,
        crtJeByReimb: crtJeByReimb,
        markAll: markAll, // 用于全选（子列表的“主行勾选”）
        unmarkAll: unmarkAll,
        fieldChanged: fieldChanged,
        // postSourcing: postSourcing,
        // sublistChanged: sublistChanged,
        // lineInit: lineInit,
        // validateField: validateField,
        validateLine: validateLine,
        // validateInsert: validateInsert,
        // validateDelete: validateDelete,
        // saveRecord: saveRecord
    };

});
