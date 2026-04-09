/**
 * @NApiVersion 2.x
 * @NScriptType ClientScript
 * @NModuleScope public
 * @description �˽ű���������Ϊ����״̬ʹ�ã�ʹ�ú�����ͣ��
 *              ʹ��ʱ���ղ���λ��ʹ�ã�SuiteScripts > TG Project > component > cs > SWC_CS_ReviseSOUnitPrice.js
 *              �������۶������ֶ����Ƶ����ֶ���ֵճ�����ܶ���ܶ��ֶη����ı�ĳ��ϣ����ܶ����������ֵ������
 */
define(["../../lib/decimal"],

    function (decimal) {
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
            var curRec = scriptContext.currentRecord;
            var sublistId = scriptContext.sublistId;
            var fieldId = scriptContext.fieldId;
            var line = scriptContext.line;

            // ��Ʒ���б�
            if ("item" == sublistId) {
                // ���
                if ("amount" == fieldId) {
                    curRec.selectLine({sublistId: sublistId, line: line});
                    // ȡ�õ�ǰ���������ܶ�
                    var qty = curRec.getCurrentSublistValue({sublistId: sublistId, fieldId: "quantity"});
                    var amt = curRec.getCurrentSublistValue({sublistId: sublistId, fieldId: "amount"});
                    // �ܶ��������ȡ�õ��ۣ�����8λС��
                    var price = decimal.divN(amt, qty).toFixed(8);
                    // ���ۺ����ֶη����ı�
                    curRec.setCurrentSublistValue({sublistId: sublistId, fieldId: "rate", value: price, ignoreFieldChange: true})
                }
            }
        }

        return {
            fieldChanged: fieldChanged
        };

    });
