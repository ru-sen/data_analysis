/**
 * @NApiVersion 2.0
 * @NModuleScope Public
 *
 * Version          Date            Author        Remark
 * 1.0              2025/11/24      kori          飞书接口优化（1878）
 */
define(["N/file","N/https", "N/record","N/search","N/format","N/runtime","N/email","N/url","./SWC_OMS_Utils.js","./Commons.js", "./SWC_CONFIG_DATA.js","../lib/decimal.js"],
    function(file,https, record,search,format,runtime,email,url,SWC_OMS_Utils,Commons,SWC_CONFIG_DATA,decimal)
    {
        /**
         * zcg authing(new) 处理员工增改
         * @param options
         */
        function getEmployee_new(options) {
            log.audit('ceshi','ceshi');
            var output = options.output;
            // var externalId = Commons.searchByExternalId(output.code, 'customrecord_swc_payment_platform');
            var userId = output.userId; // userId
            var departmentId = output.mainDepartmentId; // 部门authingID
            var subsidiaryName = output.company; // 子公司名称
            var leaderUserId = output.leaderUserId; // supervisor ID

            var nsDepartmentId = ""; // ns部门
            var nsSupervisorId = ""; // ns主管
            var nsSubsidiaryId = ""; // ns子公司

            // email查询系统内员工信息   后改成工号。
            var empId = "";
            //jjp20240715修改 start
            // if(output.jobNumber) {
            //     empId = Commons.srchEmpByEmail(output.jobNumber);
            // }
            if(output.userId) {
                empId = Commons.srchEmpByEmail(output.userId);
            }
            //jjp20240715修改 end
            var nsleaderUserId = "";
            if(output.leaderUserId) {
                nsleaderUserId = Commons.srchEmpByAuthingExternalId(output.leaderUserId);
            }

            // 如果员工存在。接口里没有子公司，直接使用员工
            if(empId && !subsidiaryName) {
                var empRec = record.load({type:"employee",id:empId});
                subsidiaryName = empRec.getText({fieldId:"subsidiary"});
            }

            if (!subsidiaryName || subsidiaryName.trim() == '') throw "员工子公司为空!";
            if (!departmentId || departmentId.trim() == '') throw "员工部门为空!";

            // 检索ns系统中子公司ID
            nsSubsidiaryId = Commons.srchSubsidiaryByName(subsidiaryName);
            if(!nsSubsidiaryId) throw "员工子公司【"+subsidiaryName+"】在NS中未匹配到子公司!";

            // 检索ns部门及主管
            var departmentJson = Commons.srchDepartmentByAuthingid(departmentId);
            nsDepartmentId = departmentJson.nsDepartmentId;
            nsSupervisorId = departmentJson.nsSupervisorId;



            var empRec = "";
            try {
                if(empId) {
                    empRec = record.load({type:"employee",id:empId});
                    var newFlag = empRec.getValue({fieldId:"custentity_swc_new_authing_flag"});
                    var oldFlag = empRec.getValue({fieldId:"custentity_swc_old_authing_flag"});
                    //新authing如果系统不存在执行创建，如果存在并且是只有新authing标识勾选的情况，更新员工/部门数据。
                    //如果存在并且存在旧authing标识勾选的情况，不更新员工/部门数据。
                    if(oldFlag || !newFlag) {
                        return;
                    }
                } else {
                    empRec = record.create({type:"employee"});
                }
                //20250617修改 start
                var nsEmpId = Commons.searchIdByNameAndAutingId(output.name,empId);//根据员工名称和autingid查询员工id
                log.audit("nsEmpId",nsEmpId);
                if(nsEmpId){
                    empRec.setValue({fieldId:"firstname",value:output.name+" "+rand(1000,9999)});
                }else{
                    empRec.setValue({fieldId:"firstname",value:output.name});

                }
                //20250617修改 end

                empRec.setValue({fieldId:"subsidiary",value:nsSubsidiaryId});
                empRec.setValue({fieldId:"email",value:output.email});
                empRec.setValue({fieldId:"phone",value:output.phone});
                empRec.setValue({fieldId:"custentity_swc_job_num",value:userId});
                empRec.setValue({fieldId:"custentity_swc_authing_sub",value:subsidiaryName});
                empRec.setValue({fieldId:"custentity_swc_externalid",value:output.externalId});
                empRec.setValue({fieldId:"custentity_swc_work_num",value:output.jobNumber});
                empRec.setValue({fieldId:"custentity_swc_new_authing_flag",value:true}); // 新auting标识
                if(nsDepartmentId) empRec.setValue({fieldId:"department",value:nsDepartmentId});
                if(nsleaderUserId) empRec.setValue({fieldId:"supervisor",value:nsleaderUserId});
                empRec.save({ignoreMandatoryFields:true,enableSourcing:true});
            } catch (e) {
                // if(e.name == "DUP_EMPL_ENTITY_NAME") {
                //     if(empId) {
                //         empRec = record.load({type:"employee",id:empId});
                //         var newFlag = empRec.getValue({fieldId:"custentity_swc_new_authing_flag"});
                //         var oldFlag = empRec.getValue({fieldId:"custentity_swc_old_authing_flag"});
                //         //新authing如果系统不存在执行创建，如果存在并且是只有新authing标识勾选的情况，更新员工/部门数据。
                //         //如果存在并且存在旧authing标识勾选的情况，不更新员工/部门数据。
                //         if(oldFlag || !newFlag) {
                //             return;
                //         }
                //     } else {
                //         empRec = record.create({type:"employee"});
                //     }
                //     empRec.setValue({fieldId:"firstname",value:output.name+" "+rand(1000,9999)});
                //     empRec.setValue({fieldId:"subsidiary",value:nsSubsidiaryId});
                //     empRec.setValue({fieldId:"email",value:output.email});
                //     empRec.setValue({fieldId:"phone",value:output.phone});
                //     empRec.setValue({fieldId:"custentity_swc_job_num",value:userId});
                //     empRec.setValue({fieldId:"custentity_swc_authing_sub",value:subsidiaryName});
                //     empRec.setValue({fieldId:"custentity_swc_externalid",value:output.externalId});
                //     empRec.setValue({fieldId:"custentity_swc_work_num",value:output.jobNumber});
                //     empRec.setValue({fieldId:"custentity_swc_new_authing_flag",value:true}); // 新auting标识
                //     if(nsDepartmentId) empRec.setValue({fieldId:"department",value:nsDepartmentId});
                //     if(nsleaderUserId) empRec.setValue({fieldId:"supervisor",value:nsleaderUserId});
                //     empRec.save({ignoreMandatoryFields:true,enableSourcing:true});
                // } else {
                //     throw e;
                // }
                throw e.message;
            }

        }
        /**
         * zcg authing 处理员工增改
         * @param options
         */
        function getEmployee(options) {
            log.audit('ceshi','ceshi');
            var output = options.output;
            // var externalId = Commons.searchByExternalId(output.code, 'customrecord_swc_payment_platform');
            var userId = output.userId; // userId
            var departmentId = output.mainDepartmentId; // 部门authingID
            var subsidiaryName = output.company; // 子公司名称
            var leaderUserId = output.leaderUserId; // supervisor ID


            var nsDepartmentId = ""; // ns部门
            var nsSupervisorId = ""; // ns主管
            var nsSubsidiaryId = ""; // ns子公司

            // email查询系统内员工信息    后改成工号。
            var empId = "";
            //jjp20240715修改 start
            // if(output.jobNumber) {
            //     empId = Commons.srchEmpByEmail(output.jobNumber);
            // }
            if(output.userId) {
                empId = Commons.srchEmpByEmail(output.userId);
            }
            //jjp20240715修改 end

            var nsleaderUserId = "";
            if(output.leaderUserId) {
                nsleaderUserId = Commons.srchEmpByAuthingExternalId(output.leaderUserId);
            }

            // 如果员工存在。接口里没有子公司，直接使用员工
            if(empId && !subsidiaryName) {
                var empRec = record.load({type:"employee",id:empId});
                subsidiaryName = empRec.getText({fieldId:"subsidiary"});
            }

            if (!subsidiaryName || subsidiaryName.trim() == '') throw "员工子公司为空!";
            if (!departmentId || departmentId.trim() == '') throw "员工部门为空!";

            // 检索ns系统中子公司ID
            nsSubsidiaryId = Commons.srchSubsidiaryByName(subsidiaryName);
            if(!nsSubsidiaryId) throw "员工子公司【"+subsidiaryName+"】在NS中未匹配到子公司!";

            // 检索ns部门及主管
            var departmentJson = Commons.srchDepartmentByAuthingid(departmentId);
            nsDepartmentId = departmentJson.nsDepartmentId;
            nsSupervisorId = departmentJson.nsSupervisorId;



            var empRec = "";
            try {
                if(empId) {
                    empRec = record.load({type:"employee",id:empId});
                } else {
                    empRec = record.create({type:"employee"});
                }
                //20250617修改 start
                var nsEmpId = Commons.searchIdByNameAndAutingId(output.name,empId);//根据员工名称和autingid查询员工id
                log.audit("nsEmpId",nsEmpId);
                if(nsEmpId){
                    empRec.setValue({fieldId:"firstname",value:output.name+" "+rand(1000,9999)});
                }else{
                    empRec.setValue({fieldId:"firstname",value:output.name});

                }
                //20250617修改 end

                empRec.setValue({fieldId:"subsidiary",value:nsSubsidiaryId});
                empRec.setValue({fieldId:"email",value:output.email});
                empRec.setValue({fieldId:"phone",value:output.phone});
                empRec.setValue({fieldId:"custentity_swc_job_num",value:userId});
                empRec.setValue({fieldId:"custentity_swc_authing_sub",value:subsidiaryName});
                empRec.setValue({fieldId:"custentity_swc_externalid",value:output.externalId});
                empRec.setValue({fieldId:"custentity_swc_work_num",value:output.jobNumber});
                empRec.setValue({fieldId:"custentity_swc_old_authing_flag",value:true}); // 旧auting标识
                if(nsDepartmentId) empRec.setValue({fieldId:"department",value:nsDepartmentId});
                if(nsleaderUserId) empRec.setValue({fieldId:"supervisor",value:nsleaderUserId});
                empRec.save({ignoreMandatoryFields:true,enableSourcing:true});
            } catch (e) {
                // if(e.name == "DUP_EMPL_ENTITY_NAME") {
                //     if(empId) {
                //         empRec = record.load({type:"employee",id:empId});
                //     } else {
                //         empRec = record.create({type:"employee"});
                //     }
                //     empRec.setValue({fieldId:"firstname",value:output.name+" "+rand(1000,9999)});
                //     empRec.setValue({fieldId:"subsidiary",value:nsSubsidiaryId});
                //     empRec.setValue({fieldId:"email",value:output.email});
                //     empRec.setValue({fieldId:"phone",value:output.phone});
                //     empRec.setValue({fieldId:"custentity_swc_job_num",value:userId});
                //     empRec.setValue({fieldId:"custentity_swc_authing_sub",value:subsidiaryName});
                //     empRec.setValue({fieldId:"custentity_swc_externalid",value:output.externalId});
                //     empRec.setValue({fieldId:"custentity_swc_work_num",value:output.jobNumber});
                //     if(nsDepartmentId) empRec.setValue({fieldId:"department",value:nsDepartmentId});
                //     if(nsleaderUserId) empRec.setValue({fieldId:"supervisor",value:nsleaderUserId});
                //     empRec.save({ignoreMandatoryFields:true,enableSourcing:true});
                // } else {
                //     throw e;
                // }
                throw e.message;
            }

        }

        /**
         * 随机数生成器
         * @param min
         * @param max
         * @returns {*}
         */
        function rand(min,max) {
            return Math.floor(Math.random()*(max-min))+min;
        }

        /**
         * zcg authing(new) 处理部门增改
         * @param options
         */
        function getDepartment_new(options) {
            log.audit('ceshi','ceshi');
            var output = options.output;
            var hRBP = output.hRBP;
            var leaderUserIds = output.leaderUserIds;
            var budgetUserIds = output.budgetUserIds;
            var departmentId = output.departmentId;

            // 根据外部ID查询用户
            var hRBPNSID = "";
            if(hRBP) {
                hRBPNSID = Commons.srchEmpByAuthingExternalId(hRBP);
            }

            // 根据userId查询用户
            var leaderId = "";
            if(leaderUserIds) {
                leaderId = Commons.srchEmpByAuthingid(leaderUserIds);
            }

            var budgetId = "";
            if(budgetUserIds) {
                budgetId = Commons.srchEmpByAuthingid(budgetUserIds);
            }
            // 获取所有公司ID数组
            var subsidiaryIdArr = Commons.searchAllSubsidiary();


            // 根据departmentId查询部门
            var departmentJson = Commons.srchDepartmentByAuthingid(departmentId);
            var nsDepartmentId = departmentJson.nsDepartmentId;
            var nsDepartmentRec = "";


            try {
                if(nsDepartmentId) {
                    nsDepartmentRec = record.load({type:"department",id:nsDepartmentId});
                    var newFlag = nsDepartmentRec.getValue({fieldId:"custrecord_swc_new_authing_flag"});
                    var oldFlag = nsDepartmentRec.getValue({fieldId:"custrecord_swc_old_authing_flag"});
                    //新authing如果系统不存在执行创建，如果存在并且是只有新authing标识勾选的情况，更新员工/部门数据。
                    //如果存在并且存在旧authing标识勾选的情况，不更新员工/部门数据。
                    if(oldFlag || !newFlag) {
                        return;
                    }
                } else {
                    nsDepartmentRec = record.create({type:"department"});
                }
                nsDepartmentRec.setValue({fieldId:"name",value:output.code_name});
                nsDepartmentRec.setText({fieldId:"parent",text:output.parentDp});
                nsDepartmentRec.setValue({fieldId:"subsidiary",value:subsidiaryIdArr});
                nsDepartmentRec.setValue({fieldId:"custrecord_swc_id",value:output.code});
                nsDepartmentRec.setValue({fieldId:"custrecord_swc_dm_name",value:output.name});
                if(output.firstOrgName) nsDepartmentRec.setValue({fieldId:"custrecord_swc_dp_first_organame",value:output.firstOrgName});
                if(output.secondOrgName) nsDepartmentRec.setValue({fieldId:"custrecord_swc_dp_sec_organame",value:output.secondOrgName});
                if(output.thirdOrgName) nsDepartmentRec.setValue({fieldId:"custrecord_swc_dp_third_organame",value:output.thirdOrgName});
                if(output.fourthOrgName) nsDepartmentRec.setValue({fieldId:"custrecord_swc_dp_forth_organa",value:output.fourthOrgName});
                nsDepartmentRec.setValue({fieldId:"custrecord_swc_costcenter_id",value:output.costCenterID});
                nsDepartmentRec.setValue({fieldId:"custrecord_swc_costcenterid",value:output.costCenterName});
                nsDepartmentRec.setValue({fieldId:"custrecord_swc_authing_departid",value:departmentId});
                nsDepartmentRec.setValue({fieldId:"custrecord_swc_new_authing_flag",value:true}); // 新authing标识
                if(leaderUserIds) nsDepartmentRec.setValue({fieldId:"custrecord_swc_authing_leaderid",value:leaderUserIds});
                if(leaderId) nsDepartmentRec.setValue({fieldId:"custrecord_swc_depart_leader",value:leaderId});
                if(budgetUserIds) nsDepartmentRec.setValue({fieldId:"custrecord_swc_authing_budgetid",value:budgetUserIds});
                if(budgetId) nsDepartmentRec.setValue({fieldId:"custrecord_swc_budget_owner",value:budgetId});
                if(hRBPNSID) nsDepartmentRec.setValue({fieldId:"custrecord_swc_hrbp",value:hRBPNSID});
                nsDepartmentRec.save({ignoreMandatoryFields:true,enableSourcing:true});
            } catch (e) {
                throw e;
            }
        }
        /**
         * zcg authing 处理部门增改
         * @param options
         */
        function getDepartment(options) {
            log.audit('ceshi','ceshi');
            var output = options.output;
            var hRBP = output.hRBP;
            var leaderUserIds = output.leaderUserIds;
            var budgetUserIds = output.budgetUserIds;
            var departmentId = output.departmentId;

            // 根据外部ID查询用户
            var hRBPNSID = "";
            if(hRBP) {
                hRBPNSID = Commons.srchEmpByAuthingExternalId(hRBP);
            }


            // 根据userId查询用户
            var leaderId = "";
            if(leaderUserIds) {
                leaderId = Commons.srchEmpByAuthingid(leaderUserIds);
            }

            var budgetId = "";
            if(budgetUserIds) {
                budgetId = Commons.srchEmpByAuthingid(budgetUserIds);
            }

            // 获取所有公司ID数组
            var subsidiaryIdArr = Commons.searchAllSubsidiary();


            // 根据departmentId查询部门
            var departmentJson = Commons.srchDepartmentByAuthingid(departmentId);
            var nsDepartmentId = departmentJson.nsDepartmentId;
            var nsDepartmentRec = "";


            try {
                if(nsDepartmentId) {
                    nsDepartmentRec = record.load({type:"department",id:nsDepartmentId});
                } else {
                    nsDepartmentRec = record.create({type:"department"});
                }
                nsDepartmentRec.setValue({fieldId:"name",value:output.code_name});
                nsDepartmentRec.setText({fieldId:"parent",text:output.parentDp});
                nsDepartmentRec.setValue({fieldId:"subsidiary",value:subsidiaryIdArr});
                nsDepartmentRec.setValue({fieldId:"custrecord_swc_id",value:output.code});
                nsDepartmentRec.setValue({fieldId:"custrecord_swc_dm_name",value:output.name});
                if(output.firstOrgName) nsDepartmentRec.setValue({fieldId:"custrecord_swc_dp_first_organame",value:output.firstOrgName});
                if(output.secondOrgName) nsDepartmentRec.setValue({fieldId:"custrecord_swc_dp_sec_organame",value:output.secondOrgName});
                if(output.thirdOrgName) nsDepartmentRec.setValue({fieldId:"custrecord_swc_dp_third_organame",value:output.thirdOrgName});
                if(output.fourthOrgName) nsDepartmentRec.setValue({fieldId:"custrecord_swc_dp_forth_organa",value:output.fourthOrgName});
                nsDepartmentRec.setValue({fieldId:"custrecord_swc_costcenter_id",value:output.costCenterID});
                nsDepartmentRec.setValue({fieldId:"custrecord_swc_costcenterid",value:output.costCenterName});
                nsDepartmentRec.setValue({fieldId:"custrecord_swc_authing_departid",value:departmentId});
                nsDepartmentRec.setValue({fieldId:"custrecord_swc_old_authing_flag",value:true}); // 旧authing标识
                if(leaderUserIds) nsDepartmentRec.setValue({fieldId:"custrecord_swc_authing_leaderid",value:leaderUserIds});
                if(leaderId) nsDepartmentRec.setValue({fieldId:"custrecord_swc_depart_leader",value:leaderId});
                if(budgetUserIds) nsDepartmentRec.setValue({fieldId:"custrecord_swc_authing_budgetid",value:budgetUserIds});
                if(budgetId) nsDepartmentRec.setValue({fieldId:"custrecord_swc_budget_owner",value:budgetId});
                if(hRBPNSID) nsDepartmentRec.setValue({fieldId:"custrecord_swc_hrbp",value:hRBPNSID});
                nsDepartmentRec.save({ignoreMandatoryFields:true,enableSourcing:true});
            } catch (e) {
                throw e;
            }
        }

        /**
         * jjp salesforce 创建各个单据接口
         * @param options
         */
        function getSalesforceQuery(options){
            try {
                var message = "";
                var output = options.output;
                log.audit("getSalesforceQuery-options.output",options.output);
                var time = output.trandate;//日记账 日期
                log.audit("getSalesforceQuery-time",time);
                var endTime = "";
                var subMemo = "";
                if(time){
                    endTime = time.slice(0,10);//拉取时的结束时间 格式：yyyy-mm-dd
                    subMemo = "Revrec_"+endTime.slice(0,4) + endTime.slice(5,7);//子列表 -摘要
                }
                log.audit("Business-getSalesforceQuery-endTime",endTime);
            }catch (e) {
                throw e.message;
            }
            var accountJson = output.account || "";//客户数据
            var financeCurrency = accountJson.financeCurrency || ""; // 货币2  Currency_for_Finance__c
            var orderJson = output.order || "";//订单数据
            var orderMessage = orderJson.message; // salesforce 如果message有数据 说明 该订单不满足查询条件下的附属公司要求，所以不进行生成单据逻辑
            var isStrope = orderJson.isStrope;//如果公司主体为US或者PTE并且是N/A的情况下，增加判断是否为Stripe的收款。如果是Revrec的借方科目改为应收账款，反之与目前一样，递延收益。
            if(orderMessage)return;//如果没有销售订单数据 直接退出 （可能是该销售订单没有满足子公司条件）
            log.audit("Business-getSalesforceQuery-orderJson",orderJson);
            var revrecArr = output.revrec || "";//日记账数据
            //var collectionArr = output.collection || "";//发票数据
            log.audit("revrecArr日记账数据",revrecArr);
            var orderId = orderJson.Id; // salesforce 订单id
            var accountId = orderJson.AccountId; //ACCOUNT ID
            var accountCode = accountJson.Id; //客户编码
            var orderNumber = orderJson.OrderNumber; //订单编号
            var region = orderJson.Region__c; //REGION
            var productFamily = orderJson.Product_Family__c; //类别
            var OPPaidViaMarketplace = orderJson.OP_Paid_via_Marketplace__c;
            var orderStartDate = orderJson.EffectiveDate; //日期
            //jjp0321+合作伙伴字段功能 start
            var Partner_Name__c = orderJson.Partner_Name__c; //合作伙伴（对应ns的客户下的【客户编号】）
            //jjp0321+合作伙伴字段功能 end
            var trandate = getModifyDate(orderStartDate);
            var revrecTrandate = getModifyDate(endTime);//revrec日期
            var overallEndDate = orderJson.EndDate; //ORDER END
            var orderEndDate = getModifyDate(overallEndDate);
            var status = orderJson.Status; //STATUS
            var paymentTerm = orderJson.Payment_Term__c; //PAYMENT TERM
            var term = orderJson.Term__c; //TERM (MONTHS)
            var currencyIsoCode = orderJson.CurrencyIsoCode; //货币
            var cloudRegistrationSource = orderJson.Cloud_Registration_Source__c; //Marketplace
            var pingCAPRevRecEntity = orderJson.PingCAP_RevRec_Entity__c; //主要子公司
            if(!pingCAPRevRecEntity)throw "主要子公司 pingCAPRevRecEntity"+pingCAPRevRecEntity+"不存在";
            var realDate = orderJson.Real_Booking_Date__c; //Real_Booking_Date__c
            var realBookingDate = getModifyDate(realDate);

            var itemsArr = orderJson.items;//货品行数据
            if(itemsArr.length < 1)throw "货品不存在";
            //添加去重record
            var soExternalId = "SALES_ORDER_" + orderId;
            var thiSoId = Commons.searchByExternalId(soExternalId, record.Type.SALES_ORDER);
            var soId = "";//销售订单ID
            var subsidiary = Commons.srchSubsidiaryIdByName(pingCAPRevRecEntity);//主要子公司
            if (!subsidiary) throw "主要子公司" + subsidiary + "在NS中不存在";
            // 根据客户编码查询客户ID
            var customerId = Commons.srchCustomerIdByCode(accountId);
            //如果客户在NS不存在 则创建客户
            if (!customerId) {
                var accountName = accountJson.Name; // 客户名称
                var accountRegion = accountJson.Region__c; // REGION
                var accountcurrency = accountJson.currency; // 货币
                var accountBillingAddress = accountJson.billingAddress; // 地址
                //创建客户
                var customerRecord = record.create({type: record.Type.CUSTOMER, isDynamic: true});
                if (accountName) customerRecord.setValue({fieldId: 'companyname', value: accountName});//客户名称
                customerRecord.setValue({fieldId: 'subsidiary', value: subsidiary});//主要子公司
                if (accountId) customerRecord.setValue({
                    fieldId: 'custentity_swc_customer_code',
                    value: accountId
                });//客户编号
                if (accountRegion) customerRecord.setValue({
                    fieldId: 'custentity_swc_region',
                    value: accountRegion
                });//REGION
                if (accountcurrency) customerRecord.setText({fieldId: 'currency', text: accountcurrency});//货币
                if (accountBillingAddress) customerRecord.setValue({fieldId: 'custentity_swc_billing_address', value: accountBillingAddress});//地址
                customerRecord.setValue({fieldId: 'isperson', value: SWC_CONFIG_DATA.configData().SALESFORCE_QUREY_CUSTOMER_ISPERSON_COMPANY});//类型 isperson=“公司”
                var customerExternalId = "CUSTOMER_" + accountCode;
                customerRecord.setValue({fieldId: 'externalid', value: customerExternalId});//客户外部id
                //如果拉取过来的两个客户不一致 则需要将领一个也赋值到客户币种子列表中
                if(financeCurrency && accountcurrency != financeCurrency){
                    customerRecord.selectNewLine({sublistId: 'currency'});
                    customerRecord.setCurrentSublistText({sublistId: 'currency', fieldId: 'currency', text: financeCurrency});//货币2
                    customerRecord.commitLine({sublistId:"currency"});
                }
                customerId = customerRecord.save();
            }else {
                if(!thiSoId){
                    //查询客户，如果该客户下没有销售订单下的 币种 则货品子列表中新增该 币种
                    var customerRec = record.load({type:record.Type.CUSTOMER,id:customerId,isDynamic:true});
                    var custFlag = false;//如果为true 则需要保存客户单据 为false说该客户record没有操作不需要保存
                    //判断 客户下币种子列表数据 start
                    var customerCurrencyCount = customerRec.getLineCount({sublistId:"currency"});//客户下币种行数
                    if(customerCurrencyCount >0) {
                        var newCurrencyFlag = false;//如果为true说明客户子列表中有该币种，不做操作。如果为false说明没有该币种，新增一条币种
                        var newFinanceCurrencyFlag = false;//如果为true说明客户子列表中有该币种2，不做操作。如果为false说明没有该币种，新增一条币种2
                        for (var i = 0; i < customerCurrencyCount; i++) {
                            customerRec.selectLine({sublistId: 'currency', line: i});
                            var subCurrency = customerRec.getCurrentSublistText({sublistId: "currency", fieldId: "currency"})//子列表币种
                            //如果客户子列表中存在该币种 则将flag设置为true
                            if (currencyIsoCode && subCurrency == currencyIsoCode) {
                                newCurrencyFlag = true;
                            }
                            //如果客户子列表中存在该币种 则将flag设置为true
                            if (financeCurrency && subCurrency == financeCurrency) {
                                newFinanceCurrencyFlag = true;
                            }
                        }
                        //如果为false说明没有该币种，新增一条币种
                        if(currencyIsoCode && newCurrencyFlag == false){
                            customerRec.selectNewLine({sublistId: 'currency'});
                            customerRec.setCurrentSublistText({sublistId: 'currency', fieldId: 'currency', text: currencyIsoCode});//货币
                            customerRec.commitLine({sublistId:"currency"});
                            custFlag = true;
                        }
                        //如果为false说明没有该币种2，新增一条币种2
                        if(financeCurrency && newFinanceCurrencyFlag == false){
                            customerRec.selectNewLine({sublistId: 'currency'});
                            customerRec.setCurrentSublistText({sublistId: 'currency', fieldId: 'currency', text: financeCurrency});//货币2
                            customerRec.commitLine({sublistId:"currency"});
                            custFlag = true;
                        }
                    }
                    //判断 客户下币种子列表数据 end

                    //判断 客户下子公司子列表数据 start
                    var customerSubsidiaryCount = customerRec.getLineCount({sublistId:"submachine"});//客户下子公司行数
                    if(customerSubsidiaryCount >0) {
                        var newsubsidiaryFlag = false;//如果为true说明客户子列表中有该子公司，不做操作。如果为false说明没有该子公司，子列表新增一条子公司
                        for(var j=0;j<customerSubsidiaryCount;j++){
                            customerRec.selectLine({sublistId: 'submachine',line:j});
                            var subSubsidiary = customerRec.getCurrentSublistValue({sublistId:"submachine",fieldId:"subsidiary"})//子列表子公司
                            //如果客户子列表中存在该子公司 则将flag设置为true
                            if(subSubsidiary == subsidiary){
                                newsubsidiaryFlag = true;
                            }
                        }
                        //如果为false说明没有该子公司，新增一条子公司
                        if(newsubsidiaryFlag == false){
                            customerRec.selectNewLine({sublistId: 'submachine'});
                            customerRec.setCurrentSublistValue({sublistId: 'submachine', fieldId: 'subsidiary', value: subsidiary});//子公司
                            customerRec.commitLine({sublistId:"submachine"});
                            custFlag = true;
                        }
                    }
                    //判断 客户下子公司子列表数据 end
                    if(custFlag)customerRec.save();
                }
            }
            if (!customerId) throw "当前客户" + accountId + "在NS中不存在";
            if (!thiSoId) {
                //添加销售订单
                var soRecord = record.create({type: record.Type.SALES_ORDER, isDynamic: true,defaultValues:{"entity":customerId,"subsidiary":subsidiary}});
                //soRecord.setValue({fieldId: 'entity', value: customerId});//客户：作业
                //soRecord.setValue({fieldId: 'subsidiary', value: subsidiary});//主要子公司
                soRecord.setValue({fieldId: 'orderstatus', value: SWC_CONFIG_DATA.configData().SALESFORCE_QUREY_SO_STATUS_WAIT_FULFIL})//状态  B:待履行
                if (accountId) soRecord.setValue({fieldId: 'custbody_swc_accountid', value: accountId});//ACCOUNT ID
                if (orderNumber) soRecord.setValue({fieldId: 'otherrefnum', value: orderNumber});//采购订单号
                if (region) soRecord.setValue({fieldId: 'custbody_swc_region', value: region});//REGION
                if (productFamily) soRecord.setText({fieldId: 'class', Text: productFamily});//类别
                if (trandate) soRecord.setValue({fieldId: 'trandate', value: trandate});//日期
                if (orderEndDate) soRecord.setValue({fieldId: 'custbody_swc_order_enddate', value: orderEndDate});//ORDER END DATE
                if (status) soRecord.setValue({fieldId: 'custbody_swc_status', value: status});//STATUS
                if (paymentTerm) soRecord.setValue({fieldId: 'custbody_swc_payment_term', value: paymentTerm});//Payment Term
                if (term) soRecord.setValue({fieldId: 'custbody_swc_term', value: term});//TERM (MONTHS)
                if (realBookingDate) soRecord.setValue({fieldId: 'custbody_swc_real_bookingdate', value: realBookingDate});//realBookingDate
                //如果Currency_for_Finance__c存在，将Currency_for_Finance__c设置在【币种】字段，将currency_is_code设置在【异常订单币种】字段下。
                // 如果Currency_for_Finance__c不存在，将currency_is_code设置在【币种】字段上
                log.audit("financeCurrency",financeCurrency);
                if(financeCurrency){
                    soRecord.setText({fieldId: 'currency', text: financeCurrency});//货币
                    soRecord.setText({fieldId: 'custbody_swc_error_currency', text: currencyIsoCode});//异常订单币种
                }else if (currencyIsoCode){
                    soRecord.setText({fieldId: 'currency', text: currencyIsoCode});//货币
                }
                if (cloudRegistrationSource) soRecord.setValue({fieldId: 'custbody_swc_marketplace', value: cloudRegistrationSource});//Marketplace
                if (soExternalId) soRecord.setValue({fieldId: 'externalid', value: soExternalId})             //外部id
                //jjp0321+合作伙伴字段功能 start
                var partnerNameId = "";
                if(Partner_Name__c) {
                    // 根据客户编码查询客户ID
                    partnerNameId = Commons.srchCustomerIdByCode(Partner_Name__c);
                    //如果不存在 创建客户
                    if (!partnerNameId){
                        var partnerAccountJson = output.partnerAccount || "";//客户数据
                        var partnerAccountName = partnerAccountJson.Name; // 客户名称
                        var partnerAccountRegion = partnerAccountJson.Region__c; // REGION
                        var partnerAccountcurrency = partnerAccountJson.currency; // 货币
                        var partnerAccountBillingAddress = partnerAccountJson.billingAddress; // 地址
                        //创建客户
                        var partnerCustomerRecord = record.create({type: record.Type.CUSTOMER, isDynamic: true});
                        if (partnerAccountName) partnerCustomerRecord.setValue({fieldId: 'companyname', value: partnerAccountName});//客户名称
                        partnerCustomerRecord.setValue({fieldId: 'subsidiary', value: subsidiary});//主要子公司
                        if (Partner_Name__c) partnerCustomerRecord.setValue({fieldId: 'custentity_swc_customer_code', value: Partner_Name__c});//客户编号
                        if (partnerAccountRegion) partnerCustomerRecord.setValue({fieldId: 'custentity_swc_region', value: partnerAccountRegion});//REGION
                        if (partnerAccountcurrency) partnerCustomerRecord.setText({fieldId: 'currency', text: partnerAccountcurrency});//货币
                        if (partnerAccountBillingAddress) partnerCustomerRecord.setValue({fieldId: 'custentity_swc_billing_address', value: partnerAccountBillingAddress});//地址
                        partnerCustomerRecord.setValue({fieldId: 'isperson', value: SWC_CONFIG_DATA.configData().SALESFORCE_QUREY_CUSTOMER_ISPERSON_COMPANY});//类型 isperson=“公司”
                        var customerExternalId = "CUSTOMER_" + partnerAccountJson.Id;
                        partnerCustomerRecord.setValue({fieldId: 'externalid', value: customerExternalId});//客户外部id
                        partnerNameId = partnerCustomerRecord.save();
                    }
                    soRecord.setValue({fieldId: 'custbody_swc_partner', value: partnerNameId});  //合作伙伴
                }
                //jjp0321+合作伙伴字段功能 end
                try{
                    for (var k = 0; k < itemsArr.length; k++) {
                        var product = itemsArr[k].Name; //货品
                        var num = itemsArr[k].Quantity__c; //数量
                        var termMonths = itemsArr[k].Term_Months__c; //货品-Term(Months)
                        var netFees = itemsArr[k].Net_fees__c; //总金额
                        var Tax__c = itemsArr[k].Tax__c; //税码
                        var Product_Code__c = itemsArr[k].Product_Code__c; //Product Code
                        var serviceStartDate = itemsArr[k].Service_Start_Date__c; //service start date
                        var serStartDate = getModifyDate(serviceStartDate);
                        var serviceEndDate = itemsArr[k].Service_End_Date__c; //service end date
                        var serEndDate = getModifyDate(serviceEndDate);
                        if (!termMonths) termMonths = 1;
                        var quantity = num * termMonths; //quantity*Term(Months)	数量*周期
                        //Total Fees - net fees 税额
                        var rate = (netFees/parseInt(num)).toFixed(2);//单价 = 总金额/数量
                        soRecord.selectNewLine({sublistId: 'item'});
                        soRecord.setCurrentSublistText({sublistId: 'item', fieldId: 'item', text: product}); //货品
                        if(!soRecord.getCurrentSublistText({sublistId:"item",fieldId:"item"}))message+= "销售订单"+orderId+"的货品："+product+"在NS中不存在。";
                        soRecord.setCurrentSublistValue({sublistId: 'item', fieldId: 'custcol_swc_quantity', value: num});     //数量
                        if (termMonths) soRecord.setCurrentSublistValue({sublistId: 'item', fieldId: 'custcol_swc_term', value: termMonths});  //货品-Term(Months)
                        soRecord.setCurrentSublistValue({sublistId: 'item', fieldId: 'quantity', value: quantity}); //quantity
                        soRecord.setCurrentSublistValue({sublistId: 'item', fieldId: 'custcol_swc_product_code', value: Product_Code__c}); //Product Code
                        soRecord.setCurrentSublistValue({sublistId: 'item', fieldId: 'custcol_swc_service_startdate', value: serStartDate}); //service start date
                        soRecord.setCurrentSublistValue({sublistId: 'item', fieldId: 'custcol_swc_service_enddate', value: serEndDate}); //service end date
                        //soRecord.setCurrentSublistValue({sublistId: 'item', fieldId: 'tax1amt', value: tax1amt});     //税额
                        soRecord.setCurrentSublistValue({sublistId: 'item', fieldId: 'amount', value: netFees});     //总金额
                        soRecord.setCurrentSublistValue({sublistId: 'item', fieldId: 'rate', value: rate,ignoreFieldChange:true});     //单价
                        //soRecord.setCurrentSublistText({sublistId: 'item', fieldId: 'taxrate1', text: "0.0%"});     //税率
                        //soRecord.setCurrentSublistValue({sublistId: 'item', fieldId: 'taxcode', value: "15",ignoreFieldChange:true});     //税码
                        soRecord.commitLine({sublistId: 'item'});
                    }
                    soId = soRecord.save({enableSourcing: true, ignoreMandatoryFields: true});
                }catch (e){
                    message+= "创建销售订单"+orderId+"时报错，货品为："+product+"。报错信息："+e.message;
                }
            }else {
                soId = thiSoId;
            }
            if(message)throw message;
            if(soId){
                //Collection接口单独拿出来处理，这里注释掉不要了！
                //Collcetion
                // if(collectionArr.length >0){
                //     log.audit("collectionId2-soId",soId);
                //     var collectionLength = collectionArr.length;//发票个数
                //     var collectionAmountSum = 0;//发票金额总和
                //     for(var i=0;i<collectionArr.length;i++){
                //         var collectionId = collectionArr[i].Id; // id
                //         var collectionName = collectionArr[i].Name; // COLLECTION NUMBER
                //         var collectionNumber = collectionArr[i].Invoice_Number__c; // INVOICE NUMBER
                //         var collectionAmount = collectionArr[i].Collections_Amount__c; //明细金额
                //         collectionAmountSum += Number(collectionAmount);//发票金额总和
                //         //发票去重
                //         var invoiceExternalId = "INVOICE_" + collectionId;
                //         var thisInvoiceId = Commons.searchByExternalId(invoiceExternalId, record.Type.INVOICE);
                //         if(!thisInvoiceId){
                //             //log.audit("collectionId",collectionId + ","+collectionName +","+collectionNumber+","+collectionAmount);
                //             try {
                //                 //创建发票
                //                 var invoiceRecord = record.transform({
                //                     fromType: record.Type.SALES_ORDER,
                //                     fromId: soId,
                //                     toType: record.Type.INVOICE,
                //                     isDynamic: true,
                //                 });
                //                 if(collectionName)invoiceRecord.setValue({fieldId: 'custbody_swc_collection_number', value: collectionName});//COLLECTION NUMBER
                //                 if(collectionNumber)invoiceRecord.setValue({fieldId: 'custbody_swc_invoice_number', value: collectionNumber});//INVOICE NUMBER
                //                 if(invoiceExternalId)invoiceRecord.setValue({fieldId: 'externalid', value: invoiceExternalId})             //外部id
                //
                //                 invoiceRecord.selectLine({sublistId: 'item', line: 0});
                //                 var orderAmountSum= invoiceRecord.getCurrentSublistValue({sublistId: 'item', fieldId: 'amount'});//总金额
                //                 //开最后一个发票的数量如果发票总金额大于等于销售订单总金额，则全部开票
                //                 //log.audit("collectionLength",collectionLength+","+orderAmountSum+","+collectionAmountSum);
                //                 if(collectionLength != i+1 && orderAmountSum > collectionAmountSum){
                //                     invoiceRecord.setCurrentSublistValue({sublistId: 'item', fieldId: 'quantity', value: 1});//数量 （默认为1，开最后一个发票的数量如果发票总金额大于等于销售订单总金额，则全部开票）
                //                 }
                //                 invoiceRecord.setCurrentSublistValue({sublistId: 'item', fieldId: 'amount', value: collectionAmount ||0});//总金额
                //                 invoiceRecord.commitLine({sublistId: 'item'});
                //
                //                 invoiceRecord.save();
                //             }catch (e) {
                //                 message+= "创建发票 "+collectionName+" 报错，报错信息："+e.message;
                //             }
                //             log.audit("collectionId",collectionId + ","+collectionName +","+collectionNumber+","+collectionAmount);
                //             if(message)throw message;
                //         }
                //     }
                // }

                //Revrec
                if(revrecArr.length >0){

                    var marketplace = false;
                    //20240426+
                    //先看 Product Family，如果 Product Family 等于 TiDB Cloud，则读取 “Cloud Registration Source” 字段值，
                    // 如字段值为 AWS marketplace 或 GCP marketplace，则表示该订单是通过 marketplace 的；
                    // 如果 Product Family 不等于 TiDB Cloud，则读取 “OP Paid via Marketplace” 字段值，
                    // 如字段值为 True，则表示该订单是通过 marketplace 的。
                    log.audit("cloudRegistrationSource",cloudRegistrationSource);
                    if(productFamily == "TiDB Cloud"){
                        if(cloudRegistrationSource == "AWS Marketplace" || cloudRegistrationSource == "GCP Marketplace"
                        || cloudRegistrationSource == "gcp_account_provider" || cloudRegistrationSource == "aws_account_provider")marketplace =true;
                    }else {
                        if(OPPaidViaMarketplace)marketplace =true;
                    }
                    log.audit("marketplace",marketplace);

                    var accountTidbJson = Commons.sechRevrectidbMapping();//格式：{Dedicated_Amount_USD__c:1,Serverless_Amount_USD__c:2,...}
                    log.audit("accountTidbJson",accountTidbJson);

                    for(var j=0;j<revrecArr.length;j++){
                        var revrecId = revrecArr[j].Id; // id
                        var revrecProduct = revrecArr[j].Product__c; // 货品
                        if(!revrecProduct)throw "生成日记账的Product__c为空，生成失败";
                        var Tax__c = revrecArr[j].Tax__c; // 税
                        var revrecName = revrecArr[j].Name; // RevRec Number
                        var currencyCode = revrecArr[j].currencyCode; // 货币
                        var revrecOrder = revrecArr[j].Order__c; // 销售订单
                        var revrecAccount = revrecArr[j].Account__c; // ACCOUNT ID
                        var revrecStatus = revrecArr[j].Status__c; // STATUS
                        //var CreatedDate = revrecArr[j].CreatedDate; //
                        var Date__c = revrecArr[j].Date__c; // 日期
                        var revrecAmount = (revrecArr[j].Amount__c).toFixed(2); // 借递延收益  贷主营业务收入：Amount
                        var dedAmount = revrecArr[j].Dedicated_Amount_USD__c?(revrecArr[j].Dedicated_Amount_USD__c).toFixed(2) : 0; // TiDB Cloud - Dedicated Amount (USD)
                        var serAmount = revrecArr[j].Serverless_Amount_USD__c?(revrecArr[j].Serverless_Amount_USD__c).toFixed(2) :0; // TiDB Cloud - Serverless Amount (USD)
                        var supAmount = revrecArr[j].Support_Amount_USD__c?(revrecArr[j].Support_Amount_USD__c).toFixed(2):0; // TIDB Cloud - Support Amount (USD)
                        var shoAmount = revrecArr[j].TiDB_Cloud_Shortfall_Amount_USD__c?(revrecArr[j].TiDB_Cloud_Shortfall_Amount_USD__c).toFixed(2):0; // TIDB Cloud - Shortfall Amount (USD)
                        //日记账去重
                        var journalExternalId = "JOURNAL_ENTRY_" + revrecId;
                        var thisJournalId = Commons.searchByExternalId(journalExternalId, record.Type.JOURNAL_ENTRY);
                        log.audit("thisJournalId",thisJournalId);
                        if(!thisJournalId){
                            try {
                                var taxJson = Commons.schTaxMapping();//查询Salesforce税码映射表 格式： {"税率_子公司id": "科目内部ID", ...}
                                log.audit("taxJson",taxJson);
                                //生成日记账
                                var journalRec = record.create({type: "journalentry", isDynamic: true});
                                journalRec.setValue({fieldId: 'subsidiary', value: subsidiary});//主要子公司
                                if(revrecName)journalRec.setValue({fieldId: "custbody_swc_revrec_number", value: revrecName});// RevRec Number
                                if(revrecProduct)journalRec.setText({fieldId: "custbody_swc_revrec_product", text: revrecProduct});// Product
                                if(Tax__c)journalRec.setValue({fieldId: "custbody_swc_revrec_tax", value: Tax__c});// Tax
                                if(currencyCode)journalRec.setText({fieldId: "currency", text: currencyCode});// 货币
                                //if(revrecOrder)journalRec.setValue({fieldId: "custbody_swc_sonum", value: revrecOrder});// 销售订单
                                journalRec.setValue({fieldId: "custbody_swc_sonum", value: soId});// 销售订单
                                if(revrecAccount)journalRec.setValue({fieldId: "custbody_swc_accountid", value: revrecAccount});// ACCOUNT ID
                                if(revrecStatus)journalRec.setValue({fieldId: "custbody_swc_status", value: revrecStatus});// STATUS
                                if(journalExternalId)journalRec.setValue({fieldId: 'externalid', value: journalExternalId});      //外部id
                                journalRec.setValue({fieldId: 'custbody_swc_platform', value: SWC_CONFIG_DATA.configData().SALESFORCE_QUREY_JOURNALREC_PLATFROM});      //来源平台
                                journalRec.setValue({fieldId: 'custbody_swc_account_name', value: customerId}); //ACCOUNT NAME
                                //if(Rate__c)journalRec.setValue({fieldId: 'exchangerate', value: Rate__c}); //汇率
                                if(revrecTrandate)journalRec.setValue({fieldId: 'trandate', value: revrecTrandate}); //日期
                                var financialProduct = "";//财务核算产品
                                if(revrecProduct){
                                    financialProduct = Commons.srchItemIdByItemName(revrecProduct);//根据货品名称查询货品【财务核算产品】字段
                                }
                                var accountJson = "";//{creditId：xxx,debitId:xxx}
                                if(itemsArr[0].Name)accountJson = Commons.schRevrecAccountByItemName(itemsArr[0].Name);//贷方主营业务科目取货品下的【revrec收入科目】
                                if(!accountJson || Object.keys(accountJson).length==0)throw new Error("创建日记账报错，日记账贷记科目不能为空！");
                                log.audit("1111",Tax__c+"_"+subsidiary);
                                log.audit("taxJson2222",taxJson);
                                //如果税率不为空也不为0  则赋值三个科目数据
                                var account = taxJson[Tax__c+"_"+subsidiary];//查询Salesforce税码映射表 格式： {"税率_子公司id": "科目内部ID", ...} 获取科目内部id
                                log.audit("revrecProduct",revrecProduct);
                                //20240524+ 如果 货品 等于 TiDB cloud
                                if(revrecProduct == "TiDB Cloud"){
                                    var allAmount = (Number(dedAmount)+Number(serAmount)+Number(supAmount)+Number(shoAmount)).toFixed(2);
                                    log.audit("revrec  USD__c 4个金额",dedAmount+","+serAmount+","+supAmount+","+shoAmount);
                                    log.audit("revrecAmount",revrecAmount);
                                    log.audit("4金额加和allAmount",allAmount);
                                    //Dedicated_Amount_USD_c，Serverless_Amount_USD_c，Support_Amount_USD_c，TiDB_Cloud_Shortfall_Amount_USD_c这四个值之和 等于 Amount__c值 生成日记账 否则不生成日记账
                                    if(allAmount ==revrecAmount) {
                                        log.audit("Tax__c",Tax__c);
                                        //if(Tax__c && Tax__c != 0 && account){
                                        if(Tax__c && Tax__c != 0 && account){
                                            var accountAmount = revrecAmount * Number(Tax__c)/100;//税额
                                            //20231007 jjp+ start
                                            //如果主体是日本并且货币为日元 对税额进行取整
                                            if(pingCAPRevRecEntity == "PingCAP Kabushiki-Kaisha" && currencyCode == "JPY"){
                                                accountAmount = Number(accountAmount).toFixed(0);
                                            }
                                            //20231007 jjp+ end
                                            log.audit("accountAmount",accountAmount);
                                            var debitAmount = Number(revrecAmount) + Number(accountAmount);//借记金额
                                            log.audit("debitAmount",debitAmount);
                                            //如果主体是日本 或者是新加坡 有税率的情况下
                                            //if(pingCAPRevRecEntity == "PingCAP Kabushiki-Kaisha" && Tax__c == 10){
                                                if((pingCAPRevRecEntity == "PingCAP Kabushiki-Kaisha" && Tax__c == 10) || (pingCAPRevRecEntity == "PingCAP Pte. Ltd." && Tax__c == 9  && isStrope)){
                                                debitAmount = Number(revrecAmount);
                                                for(var key in accountTidbJson){
                                                    //var subRecord = journalRec.selectNewLine({sublistId: 'line'});
                                                    //subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'account', value:accountTidbJson[key]});//贷方科目
                                                    //借方科目等于revrecAmount+每一个税额总和
                                                    if(key == "Dedicated_Amount_USD__c"){
                                                        if(!dedAmount || dedAmount ==0)continue;
                                                        //如果币种等于USD保留两位小数  其余保留整数 20270729
                                                        var thisDedAmount = currencyCode=="USD"?(decimal.divN(decimal.mulN(dedAmount,Number(Tax__c)),100)).toFixed(2) :(decimal.divN(decimal.mulN(dedAmount,Number(Tax__c)),100)).toFixed(0);//税额
                                                        // * Number(Tax__c)/100
                                                        log.audit("税10% 的 thisDedAmount1",thisDedAmount);
                                                        debitAmount = decimal.addN(thisDedAmount,debitAmount);
                                                    }if(key == "Serverless_Amount_USD__c"){
                                                        if(!serAmount || serAmount ==0)continue;
                                                        var thisSerAmount = currencyCode=="USD"?(decimal.divN(decimal.mulN(serAmount,Number(Tax__c)),100)).toFixed(2):(decimal.divN(decimal.mulN(serAmount,Number(Tax__c)),100)).toFixed(0);//税额 serAmount * Number(Tax__c)/100
                                                        log.audit("税10% 的 thisSerAmount1",thisSerAmount);
                                                        debitAmount = decimal.addN(thisSerAmount,debitAmount);
                                                    }if(key == "Support_Amount_USD__c"){
                                                        if(!supAmount || supAmount ==0)continue;
                                                        var thisSupAmount =  currencyCode=="USD"?(decimal.divN(decimal.mulN(supAmount,Number(Tax__c)),100)).toFixed(2):(decimal.divN(decimal.mulN(supAmount,Number(Tax__c)),100)).toFixed(0);//税额 supAmount * Number(Tax__c)/100
                                                        log.audit("税10% 的 thisSupAmount1",thisSupAmount);
                                                        debitAmount = decimal.addN(thisSupAmount,debitAmount);
                                                    }if(key == "TiDB_Cloud_Shortfall_Amount_USD__c"){
                                                        if(!shoAmount || shoAmount ==0)continue;
                                                        var thisShoAmount = currencyCode=="USD"?(decimal.divN(decimal.mulN(shoAmount,Number(Tax__c)),100)).toFixed(2):(decimal.divN(decimal.mulN(shoAmount,Number(Tax__c)),100)).toFixed(0);//税额 shoAmount * Number(Tax__c)/100
                                                        log.audit("税10% 的 thisShoAmount1",thisShoAmount);
                                                        debitAmount = decimal.addN(thisShoAmount,debitAmount);

                                                    }
                                                }
                                                var subRecord = journalRec.selectNewLine({sublistId: 'line'});
                                                //20240923 如果公司主体为US或者PTE并且是N/A的情况下，增加判断是否为Stripe的收款。如果是Revrec的借方科目改为应收账款，反之与目前一样，递延收益。
                                                if(isStrope){
                                                    subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'account', value:"1241"});//借方科目 112201 应收账款 : 应收账款_已开账单
                                                }else {
                                                    //如果Marketplace为true，Revrec 的借方科目改为应收账款（原来是递延收益）。
                                                    if(marketplace){
                                                        subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'account', value:"1241"});//借方科目 112201 应收账款 : 应收账款_已开账单
                                                    }else {
                                                        //如果主体是日本 Revrec 的借方科目改为应收账款
                                                        if(pingCAPRevRecEntity == "PingCAP Kabushiki-Kaisha"){
                                                            subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'account', value: "1241"});//借方科目 112201 应收账款 : 应收账款_已开账单
                                                        }else {
                                                            subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'account', value: accountJson.debitId});//借方科目 （通过货品名称查询【revrec收入科目】配置表的【收入科目】字段）
                                                        }
                                                    }
                                                }
                                                log.audit("税10% 的 debitAmount",debitAmount);
                                                subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'debit', value: debitAmount});//借记
                                                if(subMemo)subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'memo', value: subMemo});//摘要
                                                subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'entity', value: customerId});//往来名称
                                                subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'custcol_swc_jon_ordernum', value: orderNumber});//订单编号
                                                if(revrecProduct)subRecord.setCurrentSublistText({sublistId: 'line', fieldId: 'custcol_swc_jon_product', text: revrecProduct});//产品
                                                if(financialProduct)subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'custcol_swc_financial_product', value: financialProduct});//财务核算产品
                                                //销售订单的Partner Name（有 Partner Name 的就直接用，没有的就=客户名称）
                                                if(partnerNameId){
                                                    subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'custcol_swc_partner', value: partnerNameId});//合作伙伴
                                                }else {
                                                    subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'custcol_swc_partner', value: customerId});//合作伙伴
                                                }
                                                subRecord.commitLine({sublistId: 'line'});
                                                for(var key in accountTidbJson){
                                                    if(key == "Dedicated_Amount_USD__c" || key == "Serverless_Amount_USD__c" || key == "Support_Amount_USD__c" ||key == "TiDB_Cloud_Shortfall_Amount_USD__c"){
                                                        var subRecord = journalRec.selectNewLine({sublistId: 'line'});
                                                        subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'account', value:accountTidbJson[key]});//贷方科目
                                                        // if(Tax__c == 7){
                                                        //     subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'custcol_swc_report_taxcode', value: SWC_CONFIG_DATA.configData().TAXCODE_ID_10});// 在税码(CUSTOM)
                                                        //     subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'taxcode', value: SWC_CONFIG_DATA.configData().TAXCODE_ID_7});// 在税码(CUSTOM)
                                                        //     subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'custcol_swc_taxrate', value: "7%"});// 税率(CUSTOM)
                                                        // }
                                                        // if(Tax__c == 8){
                                                        //     subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'custcol_swc_report_taxcode', value: SWC_CONFIG_DATA.configData().TAXCODE_ID_8});// 在税码(CUSTOM)
                                                        //     subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'taxcode', value: SWC_CONFIG_DATA.configData().TAXCODE_ID_8});// 在税码(CUSTOM)
                                                        //     subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'custcol_swc_taxrate', value: "8%"});// 税率(CUSTOM)
                                                        // }
                                                        if(Tax__c == 9){
                                                            subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'custcol_swc_report_taxcode', value: SWC_CONFIG_DATA.configData().TAXCODE_ID_9});// 在税码(CUSTOM)
                                                            subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'taxcode', value: SWC_CONFIG_DATA.configData().TAXCODE_ID_9});// 在税码(CUSTOM)
                                                            subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'custcol_swc_taxrate', value: "9%"});// 税率(CUSTOM)
                                                        }
                                                        if(Tax__c == 10){
                                                            subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'custcol_swc_report_taxcode', value: SWC_CONFIG_DATA.configData().TAXCODE_ID_10});// 在税码(CUSTOM)
                                                            subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'taxcode', value: SWC_CONFIG_DATA.configData().TAXCODE_ID_10});// 在税码(CUSTOM)
                                                            subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'custcol_swc_taxrate', value: "10%"});// 税率(CUSTOM)
                                                        }

                                                        if(key == "Dedicated_Amount_USD__c"){
                                                            if(!dedAmount || dedAmount ==0)continue;
                                                            var dedTaxAmount = currencyCode=="USD"?(decimal.divN(decimal.mulN(dedAmount,Number(Tax__c)),100)).toFixed(2):(decimal.divN(decimal.mulN(dedAmount,Number(Tax__c)),100)).toFixed(0);//税额 dedAmount * Number(Tax__c)/100
                                                            subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'credit', value: dedAmount});//营业收入_TiDB cloud_Dedicated
                                                            log.audit("税10% 的 dedTaxAmount",dedTaxAmount);
                                                            subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'tax1amt', value:Number(dedTaxAmount)});// 增值税金额
                                                            if(dedTaxAmount)subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'custcol_swc_taxamount', value: Number(dedTaxAmount)});// 税额(CUSTOM)
                                                        }if(key == "Serverless_Amount_USD__c"){
                                                            if(!serAmount || serAmount ==0)continue;
                                                            var serTaxAmount = currencyCode=="USD"?(decimal.divN(decimal.mulN(serAmount,Number(Tax__c)),100)).toFixed(2):(decimal.divN(decimal.mulN(serAmount,Number(Tax__c)),100)).toFixed(0);//税额 serAmount * Number(Tax__c)/100
                                                            subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'credit', value: serAmount});//营业收入_TiDB cloud_Serverless
                                                            log.audit("税10% 的 serTaxAmount",serTaxAmount);
                                                            subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'tax1amt', value:Number(serTaxAmount)});// 增值税金额
                                                            if(serTaxAmount)subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'custcol_swc_taxamount', value: Number(serTaxAmount)});// 税额(CUSTOM)
                                                        }if(key == "Support_Amount_USD__c"){
                                                            if(!supAmount || supAmount ==0)continue;
                                                            var supTaxAmount = currencyCode=="USD"?(decimal.divN(decimal.mulN(supAmount,Number(Tax__c)),100)).toFixed(2):(decimal.divN(decimal.mulN(supAmount,Number(Tax__c)),100)).toFixed(0);//税额 supAmount * Number(Tax__c)/100
                                                            subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'credit', value: supAmount});//营业收入_TiDB cloud_Support
                                                            log.audit("税10% 的 supTaxAmount",supTaxAmount);
                                                            subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'tax1amt', value:Number(supTaxAmount)});// 增值税金额
                                                            if(supTaxAmount)subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'custcol_swc_taxamount', value: Number(supTaxAmount)});// 税额(CUSTOM)
                                                        }if(key == "TiDB_Cloud_Shortfall_Amount_USD__c"){
                                                            if(!shoAmount || shoAmount ==0)continue;
                                                            var shoTaxAmount = currencyCode=="USD"?(decimal.divN(decimal.mulN(shoAmount,Number(Tax__c)),100)).toFixed(2):(decimal.divN(decimal.mulN(shoAmount,Number(Tax__c)),100)).toFixed(0);//税额 shoAmount * Number(Tax__c)/100
                                                            subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'credit', value: shoAmount});//营业收入_TiDB cloud_Others
                                                            log.audit("税10% 的 shoTaxAmount",shoTaxAmount);
                                                            if(shoTaxAmount)subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'tax1amt', value:Number(shoTaxAmount)});// 增值税金额
                                                            if(shoTaxAmount)subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'custcol_swc_taxamount', value: Number(shoTaxAmount)});// 税额(CUSTOM)
                                                        }
                                                        if(subMemo)subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'memo', value: subMemo});//摘要
                                                        subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'entity', value: customerId});//往来名称
                                                        subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'custcol_swc_jon_ordernum', value: orderNumber});//订单编号
                                                        if(revrecProduct)subRecord.setCurrentSublistText({sublistId: 'line', fieldId: 'custcol_swc_jon_product', text: revrecProduct});//产品
                                                        if(financialProduct)subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'custcol_swc_financial_product', value: financialProduct});//财务核算产品
                                                        //销售订单的Partner Name（有 Partner Name 的就直接用，没有的就=客户名称）
                                                        if(partnerNameId){
                                                            subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'custcol_swc_partner', value: partnerNameId});//合作伙伴
                                                        }else {
                                                            subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'custcol_swc_partner', value: customerId});//合作伙伴
                                                        }
                                                        //subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'custcol_swc_report_taxcode', value: SWC_CONFIG_DATA.configData().TAXCODE_ID_10});// 在税码(CUSTOM)
                                                        // subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'custcol_swc_taxrate', value: "10%"});// 税率(CUSTOM)
                                                         if(pingCAPRevRecEntity == "PingCAP Pte. Ltd." && Tax__c == 9 && isStrope){
                                                             subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'tax1acct', value: 210});// 贷方科目 应交税费_商品服务税_销项税
                                                         }else {
                                                             subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'tax1acct', value: SWC_CONFIG_DATA.configData().TAX1ACCT_YJSF});// 应交税费_暂收消费税（消费税销项税额
                                                         }
                                                        //subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'tax1acct', value: SWC_CONFIG_DATA.configData().TAX1ACCT_YJSF});// 应交税费_暂收消费税（消费税销项税额
                                                        subRecord.commitLine({sublistId: "line"});
                                                    }
                                                }
                                            }else {
                                                var subRecord = journalRec.selectNewLine({sublistId: 'line'});
                                                //20240923 如果公司主体为US或者PTE并且是N/A的情况下，增加判断是否为Stripe的收款。如果是Revrec的借方科目改为应收账款，反之与目前一样，递延收益。
                                                if(isStrope){
                                                    subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'account', value:"1241"});//借方科目 112201 应收账款 : 应收账款_已开账单
                                                }else {
                                                    //如果Marketplace为true，Revrec 的借方科目改为应收账款（原来是递延收益）。
                                                    if(marketplace){
                                                        subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'account', value:"1241"});//借方科目 112201 应收账款 : 应收账款_已开账单
                                                    }else {
                                                        //如果主体是日本
                                                        if(pingCAPRevRecEntity == "PingCAP Kabushiki-Kaisha"){
                                                            subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'account', value: "1241"});//借方科目 112201 应收账款 : 应收账款_已开账单
                                                        }else {
                                                            subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'account', value: accountJson.debitId});//借方科目 贷方主营业务科目取货品下的【收入科目】
                                                        }
                                                    }
                                                }
                                                subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'debit', value: debitAmount});//借记
                                                if(subMemo)subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'memo', value: subMemo});//摘要
                                                subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'entity', value: customerId});//往来名称
                                                subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'custcol_swc_jon_ordernum', value: orderNumber});//订单编号
                                                if(revrecProduct)subRecord.setCurrentSublistText({sublistId: 'line', fieldId: 'custcol_swc_jon_product', text: revrecProduct});//产品
                                                if(financialProduct)subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'custcol_swc_financial_product', value: financialProduct});//财务核算产品
                                                //销售订单的Partner Name（有 Partner Name 的就直接用，没有的就=客户名称）
                                                if(partnerNameId){
                                                    subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'custcol_swc_partner', value: partnerNameId});//合作伙伴
                                                }else {
                                                    subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'custcol_swc_partner', value: customerId});//合作伙伴
                                                }
                                                subRecord.commitLine({sublistId: 'line'});
                                                for(var key in accountTidbJson){
                                                    var subRecord = journalRec.selectNewLine({sublistId: 'line'});
                                                    subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'account', value:accountTidbJson[key]});//贷方科目
                                                    if(key == "Dedicated_Amount_USD__c"){
                                                        if(!dedAmount || dedAmount ==0)continue;
                                                        subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'credit', value: dedAmount});//营业收入_TiDB cloud_Dedicated
                                                    }if(key == "Serverless_Amount_USD__c"){
                                                        if(!serAmount || serAmount ==0)continue;
                                                        subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'credit', value: serAmount});//营业收入_TiDB cloud_Serverless
                                                    }if(key == "Support_Amount_USD__c"){
                                                        if(!supAmount || supAmount ==0)continue;
                                                        subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'credit', value: supAmount});//营业收入_TiDB cloud_Support
                                                    }if(key == "TiDB_Cloud_Shortfall_Amount_USD__c"){
                                                        if(!shoAmount || shoAmount ==0)continue;
                                                        subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'credit', value: shoAmount});//营业收入_TiDB cloud_Others
                                                    }
                                                    if(subMemo)subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'memo', value: subMemo});//摘要
                                                    subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'entity', value: customerId});//往来名称
                                                    subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'custcol_swc_jon_ordernum', value: orderNumber});//订单编号
                                                    if(revrecProduct)subRecord.setCurrentSublistText({sublistId: 'line', fieldId: 'custcol_swc_jon_product', text: revrecProduct});//产品
                                                    if(financialProduct)subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'custcol_swc_financial_product', value: financialProduct});//财务核算产品
                                                    //销售订单的Partner Name（有 Partner Name 的就直接用，没有的就=客户名称）
                                                    if(partnerNameId){
                                                        subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'custcol_swc_partner', value: partnerNameId});//合作伙伴
                                                    }else {
                                                        subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'custcol_swc_partner', value: customerId});//合作伙伴
                                                    }
                                                    subRecord.commitLine({sublistId: "line"});
                                                }
                                                //赋值税科目
                                                var subRecord = journalRec.selectNewLine({sublistId: 'line'});
                                                subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'account', value:account});//借方科目 根据映射表查出的科目
                                                subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'credit', value: accountAmount});//贷记
                                                if(subMemo)subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'memo', value: subMemo});//摘要
                                                subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'entity', value: customerId});//往来名称
                                                subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'custcol_swc_jon_ordernum', value: orderNumber});//订单编号
                                                if(revrecProduct)subRecord.setCurrentSublistText({sublistId: 'line', fieldId: 'custcol_swc_jon_product', text: revrecProduct});//产品
                                                if(financialProduct)subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'custcol_swc_financial_product', value: financialProduct});//财务核算产品
                                                //销售订单的Partner Name（有 Partner Name 的就直接用，没有的就=客户名称）
                                                if(partnerNameId){
                                                    subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'custcol_swc_partner', value: partnerNameId});//合作伙伴
                                                }else {
                                                    subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'custcol_swc_partner', value: customerId});//合作伙伴
                                                }
                                                subRecord.commitLine({sublistId: "line"});
                                            }

                                        }else {
                                            var subRecord = journalRec.selectNewLine({sublistId: 'line'});
                                            //20240923 如果公司主体为US或者PTE并且是N/A的情况下，增加判断是否为Stripe的收款。如果是Revrec的借方科目改为应收账款，反之与目前一样，递延收益。
                                            if(isStrope){
                                                subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'account', value:"1241"});//借方科目 112201 应收账款 : 应收账款_已开账单
                                            }else {
                                                if(marketplace){
                                                    subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'account', value: "1241"});//借方科目 112201 应收账款 : 应收账款_已开账单
                                                }else {
                                                    //如果主体是日本
                                                    if(pingCAPRevRecEntity == "PingCAP Kabushiki-Kaisha"){
                                                        subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'account', value: "1241"});//借方科目 112201 应收账款 : 应收账款_已开账单
                                                    }else {
                                                        subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'account', value: accountJson.debitId});//借方科目 贷方主营业务科目取货品下的【收入科目】
                                                    }
                                                }
                                            }
                                            subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'debit', value: revrecAmount});//借记
                                            if(subMemo)subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'memo', value: subMemo});//摘要
                                            subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'entity', value: customerId});//往来名称
                                            subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'custcol_swc_jon_ordernum', value: orderNumber});//订单编号
                                            if(revrecProduct)subRecord.setCurrentSublistText({sublistId: 'line', fieldId: 'custcol_swc_jon_product', text: revrecProduct});//产品
                                            if(financialProduct)subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'custcol_swc_financial_product', value: financialProduct});//财务核算产品
                                            //销售订单的Partner Name（有 Partner Name 的就直接用，没有的就=客户名称）
                                            if(partnerNameId){
                                                subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'custcol_swc_partner', value: partnerNameId});//合作伙伴
                                            }else {
                                                subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'custcol_swc_partner', value: customerId});//合作伙伴
                                            }
                                            subRecord.commitLine({sublistId: 'line'});

                                            for(var key in accountTidbJson){
                                                var subRecord = journalRec.selectNewLine({sublistId: 'line'});
                                                subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'account', value:accountTidbJson[key]});//贷方科目
                                                if(key == "Dedicated_Amount_USD__c"){
                                                    if(!dedAmount || dedAmount ==0)continue;
                                                    subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'credit', value: dedAmount});//营业收入_TiDB cloud_Dedicated
                                                }if(key == "Serverless_Amount_USD__c"){
                                                    if(!serAmount || serAmount ==0)continue;
                                                    subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'credit', value: serAmount});//营业收入_TiDB cloud_Serverless
                                                }if(key == "Support_Amount_USD__c"){
                                                    if(!supAmount || supAmount ==0)continue;
                                                    subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'credit', value: supAmount});//营业收入_TiDB cloud_Support
                                                }if(key == "TiDB_Cloud_Shortfall_Amount_USD__c"){
                                                    if(!shoAmount || shoAmount ==0)continue;
                                                    subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'credit', value: shoAmount});//营业收入_TiDB cloud_Others
                                                }
                                                if(subMemo)subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'memo', value: subMemo});//摘要
                                                subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'entity', value: customerId});//往来名称
                                                subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'custcol_swc_jon_ordernum', value: orderNumber});//订单编号
                                                if(revrecProduct)subRecord.setCurrentSublistText({sublistId: 'line', fieldId: 'custcol_swc_jon_product', text: revrecProduct});//产品
                                                if(financialProduct)subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'custcol_swc_financial_product', value: financialProduct});//财务核算产品
                                                //销售订单的Partner Name（有 Partner Name 的就直接用，没有的就=客户名称）
                                                if(partnerNameId){
                                                    subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'custcol_swc_partner', value: partnerNameId});//合作伙伴
                                                }else {
                                                    subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'custcol_swc_partner', value: customerId});//合作伙伴
                                                }
                                                subRecord.commitLine({sublistId: "line"});
                                            }

                                        }
                                        journalRec.save({enableSourcing: true, ignoreMandatoryFields: true});
                                    }else {
                                        log.audit("四个值金额总和不等于amount金额，不生成日记账","RevRec Number:"+revrecName+",ACCOUNT ID:"+revrecAccount);
                                    }
                                }else {
                                    log.audit("Tax__c1",Tax__c);
                                    log.audit("account1",account);
                                    if(Tax__c && Tax__c != 0 && account){
                                        //var debitAmount = revrecAmount *(1+Number(Tax__c)/100);//借记金额 + 税额
                                        var accountAmount = (revrecAmount * Number(Tax__c)/100).toFixed(2);//税额
                                        //20231007 jjp+ start
                                        //如果主体是日本并且货币为日元 对税额进行取整
                                        if(pingCAPRevRecEntity == "PingCAP Kabushiki-Kaisha" && currencyCode == "JPY"){
                                            accountAmount = Number(accountAmount).toFixed(0);
                                        }
                                        //20231007 jjp+ end
                                        var debitAmount = 0;
                                            log.audit("accountAmount",accountAmount);
                                        if(pingCAPRevRecEntity != "PingCAP Pte. Ltd."){
                                            debitAmount = Number(revrecAmount) + Number(accountAmount);
                                        }else {
                                            debitAmount = Number(revrecAmount);
                                        }
                                        log.audit("debitAmount",debitAmount);
                                        var subRecord = journalRec.selectNewLine({sublistId: 'line'});
                                        //20240923 如果公司主体为US或者PTE并且是N/A的情况下，增加判断是否为Stripe的收款。如果是Revrec的借方科目改为应收账款，反之与目前一样，递延收益。
                                        if(isStrope){
                                            subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'account', value:"1241"});//借方科目 112201 应收账款 : 应收账款_已开账单
                                        }else {
                                            //如果Marketplace为true，Revrec 的借方科目改为应收账款（原来是递延收益）。
                                            if(marketplace){
                                                subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'account', value:"1241"});//借方科目 112201 应收账款 : 应收账款_已开账单
                                            }else {
                                                //如果主体是日本
                                                if(pingCAPRevRecEntity == "PingCAP Kabushiki-Kaisha"){
                                                    subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'account', value: "1241"});//借方科目 112201 应收账款 : 应收账款_已开账单
                                                }else {
                                                    subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'account', value: accountJson.debitId});//借方科目 贷方主营业务科目取货品下的【收入科目】
                                                }
                                            }
                                        }
                                        subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'debit', value: debitAmount});//借记
                                        if(subMemo)subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'memo', value: subMemo});//摘要
                                        subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'entity', value: customerId});//往来名称
                                        subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'custcol_swc_jon_ordernum', value: orderNumber});//订单编号
                                        if(revrecProduct)subRecord.setCurrentSublistText({sublistId: 'line', fieldId: 'custcol_swc_jon_product', text: revrecProduct});//产品
                                        if(financialProduct)subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'custcol_swc_financial_product', value: financialProduct});//财务核算产品
                                        //销售订单的Partner Name（有 Partner Name 的就直接用，没有的就=客户名称）
                                        if(partnerNameId){
                                            subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'custcol_swc_partner', value: partnerNameId});//合作伙伴
                                        }else {
                                            subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'custcol_swc_partner', value: customerId});//合作伙伴
                                        }
                                        subRecord.commitLine({sublistId: 'line'});
                                        log.audit("pingCAPRevRecEntity",pingCAPRevRecEntity);
                                        log.audit("Tax__c",Tax__c);
                                        //如果主体是日本 或者是新加坡 有税率的情况下
                                       // if(pingCAPRevRecEntity == "PingCAP Kabushiki-Kaisha" && Tax__c == 10){
                                        if((pingCAPRevRecEntity == "PingCAP Kabushiki-Kaisha" && Tax__c == 10) || (pingCAPRevRecEntity == "PingCAP Pte. Ltd." && Tax__c == 9 && isStrope)){
                                            var subRecord = journalRec.selectNewLine({sublistId: 'line'});
                                            subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'account', value:accountJson.creditId});//贷方科目
                                            //subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'taxcode', value: SWC_CONFIG_DATA.configData().TAXCODE_ID_10})// 税码
                                            // if(Tax__c == 7){
                                            //     subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'taxcode', value: SWC_CONFIG_DATA.configData().TAXCODE_ID_7});// 在税码(CUSTOM)
                                            //     subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'custcol_swc_report_taxcode', value: SWC_CONFIG_DATA.configData().TAXCODE_ID_7});// 在税码(CUSTOM)
                                            //     subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'custcol_swc_taxrate', value: "7%"});// 税率(CUSTOM)
                                            // }
                                            // if(Tax__c == 8){
                                            //     subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'taxcode', value: SWC_CONFIG_DATA.configData().TAXCODE_ID_8});// 在税码(CUSTOM)
                                            //     subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'custcol_swc_report_taxcode', value: SWC_CONFIG_DATA.configData().TAXCODE_ID_8});// 在税码(CUSTOM)
                                            //     subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'custcol_swc_taxrate', value: "8%"});// 税率(CUSTOM)
                                            // }
                                            if(Tax__c == 9){
                                                subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'taxcode', value: SWC_CONFIG_DATA.configData().TAXCODE_ID_9});// 在税码(CUSTOM)
                                                subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'custcol_swc_report_taxcode', value: SWC_CONFIG_DATA.configData().TAXCODE_ID_9});// 在税码(CUSTOM)
                                                subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'custcol_swc_taxrate', value: "9%"});// 税率(CUSTOM)
                                            }
                                            if(Tax__c == 10){
                                                subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'taxcode', value: SWC_CONFIG_DATA.configData().TAXCODE_ID_10});// 在税码(CUSTOM)
                                                subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'custcol_swc_report_taxcode', value: SWC_CONFIG_DATA.configData().TAXCODE_ID_10});// 在税码(CUSTOM)
                                                subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'custcol_swc_taxrate', value: "10%"});// 税率(CUSTOM)
                                            }
                                            log.audit("taxcode",subRecord.getCurrentSublistValue({sublistId: 'line', fieldId: 'taxcode'}));
                                            log.audit("custcol_swc_report_taxcode",subRecord.getCurrentSublistValue({sublistId: 'line', fieldId: 'custcol_swc_report_taxcode'}));
                                            log.audit("custcol_swc_taxrate",subRecord.getCurrentSublistValue({sublistId: 'line', fieldId: 'custcol_swc_taxrate'}));


                                            log.audit("revrecAmount",revrecAmount);
                                            subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'credit', value: Number(revrecAmount)});//贷记
                                            log.audit("贷记金额1",subRecord.getCurrentSublistValue({sublistId: 'line', fieldId: 'credit'}))
                                            if(subMemo)subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'memo', value: subMemo});//摘要
                                            subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'entity', value: customerId});//往来名称
                                            subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'custcol_swc_jon_ordernum', value: orderNumber});//订单编号
                                            if(revrecProduct)subRecord.setCurrentSublistText({sublistId: 'line', fieldId: 'custcol_swc_jon_product', text: revrecProduct});//产品
                                            if(financialProduct)subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'custcol_swc_financial_product', value: financialProduct});//财务核算产品
                                            //销售订单的Partner Name（有 Partner Name 的就直接用，没有的就=客户名称）
                                            if(partnerNameId){
                                                subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'custcol_swc_partner', value: partnerNameId});//合作伙伴
                                            }else {
                                                subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'custcol_swc_partner', value: customerId});//合作伙伴
                                            }
                                            if(accountAmount)subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'custcol_swc_taxamount', value: Number(accountAmount)});// 税额(CUSTOM)
                                            if(pingCAPRevRecEntity == "PingCAP Pte. Ltd." && Tax__c == 9 && isStrope){
                                                subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'tax1acct', value: 210});// 贷方 纳税科目 应交税费_商品服务税_销项税
                                            }else {
                                                subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'tax1acct', value: SWC_CONFIG_DATA.configData().TAX1ACCT_YJSF});// 应交税费_暂收消费税（消费税销项税额
                                            }
                                            //subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'tax1acct', value: SWC_CONFIG_DATA.configData().TAX1ACCT_YJSF});// 应交税费_暂收消费税（消费税销项税额
                                            log.audit("贷记金额2",subRecord.getCurrentSublistValue({sublistId: 'line', fieldId: 'credit'}))
                                            subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'tax1amt', value:Number(accountAmount)});// 增值税金额
                                            log.audit("税额",subRecord.getCurrentSublistValue({sublistId: 'line', fieldId: 'custcol_swc_taxamount'}))
                                            subRecord.commitLine({sublistId: "line"});
                                        }else {
                                            var subRecord = journalRec.selectNewLine({sublistId: 'line'});
                                            subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'account', value:accountJson.creditId});//贷方主营业务科目取货品下的【revrec收入科目】
                                            subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'credit', value: revrecAmount});//贷记
                                            if(subMemo)subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'memo', value: subMemo});//摘要
                                            subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'entity', value: customerId});//往来名称
                                            subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'custcol_swc_jon_ordernum', value: orderNumber});//订单编号
                                            if(revrecProduct)subRecord.setCurrentSublistText({sublistId: 'line', fieldId: 'custcol_swc_jon_product', text: revrecProduct});//产品
                                            if(financialProduct)subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'custcol_swc_financial_product', value: financialProduct});//财务核算产品
                                            //销售订单的Partner Name（有 Partner Name 的就直接用，没有的就=客户名称）
                                            if(partnerNameId){
                                                subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'custcol_swc_partner', value: partnerNameId});//合作伙伴
                                            }else {
                                                subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'custcol_swc_partner', value: customerId});//合作伙伴
                                            }
                                            subRecord.commitLine({sublistId: "line"});

                                            //TODO 2025
                                            if(pingCAPRevRecEntity != "PingCAP Pte. Ltd."){
                                                var subRecord = journalRec.selectNewLine({sublistId: 'line'});
                                                subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'account', value:account});//根据映射表查出的科目
                                                subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'credit', value: accountAmount});//贷记
                                                if(subMemo)subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'memo', value: subMemo});//摘要
                                                subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'entity', value: customerId});//往来名称
                                                subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'custcol_swc_jon_ordernum', value: orderNumber});//订单编号
                                                if(revrecProduct)subRecord.setCurrentSublistText({sublistId: 'line', fieldId: 'custcol_swc_jon_product', text: revrecProduct});//产品
                                                if(financialProduct)subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'custcol_swc_financial_product', value: financialProduct});//财务核算产品
                                                //销售订单的Partner Name（有 Partner Name 的就直接用，没有的就=客户名称）
                                                if(partnerNameId){
                                                    subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'custcol_swc_partner', value: partnerNameId});//合作伙伴
                                                }else {
                                                    subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'custcol_swc_partner', value: customerId});//合作伙伴
                                                }
                                                subRecord.commitLine({sublistId: "line"});
                                            }
                                        }
                                    }else {
                                        var subRecord = journalRec.selectNewLine({sublistId: 'line'});
                                        //20240923 如果公司主体为US或者PTE并且是N/A的情况下，增加判断是否为Stripe的收款。如果是Revrec的借方科目改为应收账款，反之与目前一样，递延收益。
                                        if(isStrope){
                                            subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'account', value:"1241"});//借方科目 112201 应收账款 : 应收账款_已开账单
                                        }else {
                                            if(marketplace){
                                                subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'account', value: "1241"});//借方科目 112201 应收账款 : 应收账款_已开账单
                                            }else {
                                                //如果主体是日本
                                                if(pingCAPRevRecEntity == "PingCAP Kabushiki-Kaisha"){
                                                    subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'account', value: "1241"});//借方科目 112201 应收账款 : 应收账款_已开账单
                                                }else {
                                                    subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'account', value: accountJson.debitId});//借方科目 贷方主营业务科目取货品下的【收入科目】
                                                }
                                            }
                                        }
                                        subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'debit', value: revrecAmount});//借记
                                        if(subMemo)subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'memo', value: subMemo});//摘要
                                        subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'entity', value: customerId});//往来名称
                                        subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'custcol_swc_jon_ordernum', value: orderNumber});//订单编号
                                        if(revrecProduct)subRecord.setCurrentSublistText({sublistId: 'line', fieldId: 'custcol_swc_jon_product', text: revrecProduct});//产品
                                        if(financialProduct)subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'custcol_swc_financial_product', value: financialProduct});//财务核算产品
                                        //销售订单的Partner Name（有 Partner Name 的就直接用，没有的就=客户名称）
                                        if(partnerNameId){
                                            subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'custcol_swc_partner', value: partnerNameId});//合作伙伴
                                        }else {
                                            subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'custcol_swc_partner', value: customerId});//合作伙伴
                                        }
                                        subRecord.commitLine({sublistId: 'line'});
                                        var subRecord = journalRec.selectNewLine({sublistId: 'line'});
                                        subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'account', value:accountJson.creditId});//贷方主营业务科目取货品下的【revrec收入科目】
                                        subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'credit', value: revrecAmount});//贷记
                                        if(subMemo)subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'memo', value: subMemo});//摘要
                                        subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'entity', value: customerId});//往来名称
                                        subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'custcol_swc_jon_ordernum', value: orderNumber});//订单编号
                                        if(revrecProduct)subRecord.setCurrentSublistText({sublistId: 'line', fieldId: 'custcol_swc_jon_product', text: revrecProduct});//产品
                                        if(financialProduct)subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'custcol_swc_financial_product', value: financialProduct});//财务核算产品
                                        //销售订单的Partner Name（有 Partner Name 的就直接用，没有的就=客户名称）
                                        if(partnerNameId){
                                            subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'custcol_swc_partner', value: partnerNameId});//合作伙伴
                                        }else {
                                            subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'custcol_swc_partner', value: customerId});//合作伙伴
                                        }
                                        subRecord.commitLine({sublistId: "line"});
                                    }
                                    var paymentCount = journalRec.getLineCount({sublistId:"line"});
                                    for(var i = 0;i<paymentCount;i++) {
                                        var debit = journalRec.getSublistValue({sublistId:"line",fieldId:"debit",line:i});
                                        var credit = journalRec.getSublistValue({sublistId:"line",fieldId:"credit",line:i});
                                        var tax1amt = journalRec.getSublistValue({sublistId:"line",fieldId:"tax1amt",line:i});
                                        log.audit("借贷科目",debit+","+credit+","+tax1amt);
                                    }
                                    journalRec.save({enableSourcing: true, ignoreMandatoryFields: true});
                                }
                            }catch (e) {
                                message+= "创建日记账报错，报错信息："+e.message;
                            }
                            if(message)throw message;
                        }
                    }
                }
            }
        }

        /**
         * jjp salesforce 删除各个单据接口
         * @param options
         */
        function getSalesforceDelete(options){
            var message = "";
            log.audit("getSalesforceDelete",options);

            var output = options.output;//{id: 'id', type: 'type'}
            var id = output["id"]||"";
            var type = output["type"]||"";
            try{
                //如果是删除日记账
                if(type == "revrec"){
                    var journalId = Commons.srchJournalIdByAccountId(id);
                    if(journalId){
                        record.delete({type:record.Type.JOURNAL_ENTRY,id:journalId});
                    }
                }
            }catch (e) {
                message+= "删除日记账报错，ACCOUNTID为"+id+"，单据内部ID为："+journalId+"。报错信息："+e.message+"。";
            }

            //如果是删除销售订单和对应发票
            if(type == "order"){
                try{
                    var invoiceIds = Commons.srchInvoiceIdByAccountId(id);
                    if(invoiceIds.length>0){
                        for(var i=0;i<invoiceIds.length;i++){
                            record.delete({type:record.Type.INVOICE,id:invoiceIds[i]});
                        }
                    }
                }catch (e) {
                    message+= "删除发票报错，ACCOUNTID为"+id+"，单据内部ID为："+invoiceIds+"。报错信息："+e.message+"。";
                }
                try{
                    var soId = Commons.srchSoIdByAccountId(id);
                    if(soId){
                        record.delete({type:record.Type.SALES_ORDER,id:soId});

                    }
                }catch (e) {
                    message+= "删除销售订单报错，ACCOUNTID为"+id+"，单据内部ID为："+soId+"。报错信息："+e.message+"。";
                }
            }
            if(message)throw message;
        }

        /**
         * jjp salesforce 创建发票接口
         * @param options
         */
        function getSalesforceCollection(options){
            var message = "";
            log.audit("getSalesforceCollection",options);
            var output = options.output;//
            var orderMessage = output.message;//该订单不是"+condSubsidiary+"公司下的订单，不需要创建！
            log.audit("orderMessage",orderMessage);
            if(orderMessage)return;////如果没有订单数据 直接退出 （可能是该订单没有满足子公司条件）
            var baseRecordId = output.baseRecordId;//base记录的id值
            var collectionAmountSum = 0;//发票金额总和
            var collectionId = output.Id; // id
            var collectionName = output.Name; // COLLECTION NUMBER
            var collectionNumber = output.Invoice_Number__c || ""; // INVOICE NUMBER
            var Tax_Rate__c = output.Tax_Rate__c; // Tax_Rate__c
            var time = output.trandate;//接口拉取的结束时间
            log.audit("getSalesforceCollection-time",time);
            var endTime = "";
            var memo = "";//备注 子列表说明
            if(time){
                endTime = time.slice(0,10);//拉取时的结束时间 格式：yyyy-mm-dd
                memo = "Collection_"+endTime.slice(0,4) + endTime.slice(5,7)+" "+collectionNumber;//子列表 -摘要
            }
            //var collectionAmount = output.Collections_Amount__c; //明细金额
            var payableAmount = output.Payable_Amount__c; //明细金额 用这个！
            var payableDate = output.Payable_Date__c; //到期日期
            var collectionsStatus = output.CollectionsStatus__c; //COLLECTION STATUS
            var Order_Number__c = output.Order_Number__c; //订单号
            var Collections_Date__c = output.Collections_Date__c;//Collections_Date__c
            //var Exchange_Rate__c = output.Exchange_Rate__c;//Exchange_Rate__c 汇率

            if(!Order_Number__c)throw "发票"+collectionId+"没有订单号Order_Number__c字段值！";
            var pdfDataArr = output.pdfDataArr; //PDF文件  结构：[{fileurl:"",base64code:""},...]
            var soId = Commons.srchSoIdByOrderNumber(Order_Number__c);//根据Order_Number__c查询销售订单内部ID

            var fromMarketplace = output.From_Marketplace__c; //From_Marketplace__c
            var orderStartDate = "";
            if(fromMarketplace == "N/A"){
                orderStartDate = output.Actual_Billing_Date__c; //日期
            }else {
                orderStartDate = Collections_Date__c; //日期
            }
            var duedate = getModifyDate(payableDate);
            var trandate = getModifyDate(orderStartDate);
            var collectionsDate = getModifyDate(Collections_Date__c);

            collectionAmountSum += Number(payableAmount);//发票金额总和
            //发票去重
            var invoiceExternalId = "INVOICE_" + collectionId;
            var thisInvoiceId = Commons.searchByExternalId(invoiceExternalId, record.Type.INVOICE);
            if(!thisInvoiceId){
                if(!soId)throw "销售订单下的采购订单号为："+Order_Number__c+"的销售订单不存在！"

                var invoiceIds = Commons.srchInvoiceIdByOrderNumber(Order_Number__c);//根据Order_Number__c查询批量发票内部ID
                if(invoiceIds.length>0)collectionAmountSum = Commons.srchInvoiceAmountById(invoiceIds);

                //var soRecord = record.load({type:record.Type.SALES_ORDER,id:soId});//销售订单信息
                //var orderAmountSum = record.getSublistValue({sublistId:"item",fieldId:"amount"})//销售订单金额
                try {
                    var soRec = record.load({id:soId,type:record.Type.SALES_ORDER});//销售订单
                    var subsidiaryId =soRec.getValue({fieldId:"subsidiary"});//子公司
                    var soNum = soRec.getSublistValue({sublistId:"item",fieldId:"quantity",line:0});//获取第一行货品数量
                    var invoiceNum = Commons.schInvoiceSumNumBySoId(soId);//发票数量总和
                    //如果销售订单数量小于等于该销售单下的发票总数之和，则该销售单货品数量+1，并且销售单货品总金额不变，对应修改单价
                    if(soNum && invoiceNum && soNum <= invoiceNum){
                        var amount = soRec.getSublistValue({sublistId:"item",fieldId:"amount",line:0});//获取第一行总金额
                        var quantity = parseInt(soNum)+1;
                        var rate = (amount/quantity).toFixed(2);
                        soRec.setSublistValue({sublistId:"item",fieldId:"quantity",value:quantity,line:0});
                        soRec.setSublistValue({sublistId:"item",fieldId:"rate",value:rate,line:0});
                        soRec.setSublistValue({sublistId:"item",fieldId:"amount",value:amount,line:0});
                        soRec.save();
                    }else{
                        var soStatus = soRec.getValue({fieldId: "orderstatus"});//销售订单 状态
                        //如果订单状态为“已开票”则销售订单货品数量+1
                        if(soStatus == "G"){
                            var amount = soRec.getSublistValue({sublistId:"item",fieldId:"amount",line:0});//获取第一行总金额
                            var quantity = parseInt(soNum)+1;
                            var rate = (amount/quantity).toFixed(2);
                            soRec.setSublistValue({sublistId:"item",fieldId:"quantity",value:quantity,line:0});
                            soRec.setSublistValue({sublistId:"item",fieldId:"rate",value:rate,line:0});
                            soRec.setSublistValue({sublistId:"item",fieldId:"amount",value:amount,line:0});
                            soRec.save();
                        }
                    }

                    //创建发票
                    var invoiceRecord = record.transform({
                        fromType: record.Type.SALES_ORDER,
                        fromId: soId,
                        toType: record.Type.INVOICE,
                        isDynamic: true,
                    });

                    var baseJson = {};//将存储base码的record数据放入JSON中
                    if(baseRecordId){
                        var baseRecord = record.load({id:baseRecordId,type:"customrecord_collection_invoice_basecode"});
                        var baseRecordCount = baseRecord.getLineCount({sublistId:"recmachcustrecord_collection_invoice_basecode"});
                        if(baseRecordCount>0){
                            for(var j = 0; j < baseRecordCount; j++) {
                                var baseid = baseRecord.getSublistValue({fieldId:"custrecord_id",sublistId:"recmachcustrecord_collection_invoice_basecode",line:j});//custrecord_id
                                var basecode = baseRecord.getSublistValue({fieldId:"custrecord_base64code",sublistId:"recmachcustrecord_collection_invoice_basecode",line:j});//base64code
                                if(baseid && basecode){
                                    baseJson[baseid] = basecode;
                                }
                            }
                        }
                    }

                    if(collectionName)invoiceRecord.setValue({fieldId: 'custbody_swc_collection_number', value: collectionName});//COLLECTION NUMBER
                    //当N/A时，记录Invoice Number值
                    if(fromMarketplace == "N/A"){
                        invoiceRecord.setValue({fieldId: 'custbody_swc_invoice_number', value: collectionNumber});//INVOICE NUMBER
                    }else {
                        invoiceRecord.setValue({fieldId: 'custbody_swc_invoice_number', value: ""});//INVOICE NUMBER
                    }
                    if(invoiceExternalId)invoiceRecord.setValue({fieldId: 'externalid', value: invoiceExternalId})             //外部id
                    if(memo)invoiceRecord.setValue({fieldId: 'memo', value: memo})             //备注
                    if(collectionsStatus)invoiceRecord.setValue({fieldId: 'custbody_swc_collection_status', value: collectionsStatus}) //COLLECTION STATUS
                    if (trandate) invoiceRecord.setValue({fieldId: 'trandate', value: trandate});//日期
                    if (duedate) invoiceRecord.setValue({fieldId: 'duedate', value: duedate});//到期日期
                    if (orderStartDate) invoiceRecord.setValue({fieldId: 'custbody_swc_collections_date', value: collectionsDate});//COLLECTIONS DATE
                    if (fromMarketplace) invoiceRecord.setValue({fieldId: 'custbody_swc_marketplace', value: fromMarketplace});//MARKETPLACE
                    if (Order_Number__c) invoiceRecord.setValue({fieldId: 'otherrefnum', value: Order_Number__c});//采购订单号
                    //if(Exchange_Rate__c) invoiceRecord.setValue({fieldId: 'exchangerate', value: Exchange_Rate__c});//汇率
                    invoiceRecord.setValue({fieldId: 'custbody_swc_collection_id', value: collectionId});//RECORD ID
                    invoiceRecord.selectLine({sublistId: 'item', line: 0});
                    var orderAmountSum= invoiceRecord.getCurrentSublistValue({sublistId: 'item', fieldId: 'amount'});//销售订单-总金额
                    //开最后一个发票的数量如果发票总金额大于等于销售订单总金额，则全部开票
                    if(orderAmountSum > collectionAmountSum){
                        invoiceRecord.setCurrentSublistValue({sublistId: 'item', fieldId: 'quantity', value: 1});//数量 （默认为1，开最后一个发票的数量如果发票总金额大于等于销售订单总金额，则全部开票）
                    }
                    log.audit("Tax_Rate__c",Tax_Rate__c);
                    //只考虑子公司为PTE的collection，如果接口返回税率为9，设置税率。
                    if((subsidiaryId == "1" || subsidiaryId == "28") && Tax_Rate__c == 9){
                        invoiceRecord.setCurrentSublistValue({sublistId: 'item', fieldId: 'taxcode', value: SWC_CONFIG_DATA.configData().TAXCODE_ID_9})// 税码
                        // invoiceRecord.setCurrentSublistValue({sublistId: 'item', fieldId: 'grossamt', value: payableAmount ||0});//总金额
                        // //税额 = payableAmount * Number(Tax_Rate__c)/100
                        // var accountAmount = (decimal.divN(decimal.mulN(payableAmount,Number(Tax_Rate__c)),100)).toFixed(2);//税额
                        // //未税金额 = 总金额-税额
                        // var wsAmount = decimal.subN(payableAmount,accountAmount);//未税金额
                        // invoiceRecord.setCurrentSublistValue({sublistId: 'item', fieldId: 'amount', value: wsAmount});//未税金额
                        // invoiceRecord.setCurrentSublistValue({sublistId: 'item', fieldId: 'tax1amt', value: accountAmount});//税额

                        //20250107 新版税和金额赋值逻辑
                        //未税金额 = 总金额/(1+税率)
                        var wsAmount = (decimal.divN(payableAmount,decimal.divN(1,decimal.divN(Tax_Rate__c,100)))).toFixed(2);//未税金额
                        //税额= 未税金额*税率
                        var accountAmount =(decimal.mulN(wsAmount,decimal.divN(Tax_Rate__c,100))).toFixed(2);
                        invoiceRecord.setCurrentSublistValue({sublistId: 'item', fieldId: 'grossamt', value: payableAmount ||0});//总金额
                        invoiceRecord.setCurrentSublistValue({sublistId: 'item', fieldId: 'amount', value: wsAmount});//未税金额
                        invoiceRecord.setCurrentSublistValue({sublistId: 'item', fieldId: 'tax1amt', value: accountAmount});//税额
                    }else {
                        invoiceRecord.setCurrentSublistValue({sublistId: 'item', fieldId: 'amount', value: payableAmount ||0});//总金额

                    }
                    if(memo)invoiceRecord.setCurrentSublistValue({sublistId: 'item', fieldId: 'description', value: memo});//说明
                    if(Order_Number__c)invoiceRecord.setCurrentSublistValue({sublistId: 'item', fieldId: 'custcol_swc_jon_ordernum', value: Order_Number__c});//订单编号
                    var invoiceItemId= invoiceRecord.getCurrentSublistValue({sublistId: 'item', fieldId: 'item'});//货品
                    if(invoiceItemId)invoiceRecord.setCurrentSublistValue({sublistId: 'item', fieldId: 'custcol_swc_jon_product', value: invoiceItemId});//产品
                    var itemName = invoiceRecord.getCurrentSublistText({sublistId: 'item', fieldId: 'item'});//货品名
                    var financialProduct = Commons.srchItemIdByItemName(itemName);//根据货品名称查询货品【财务核算产品】字段
                    if(financialProduct)invoiceRecord.setCurrentSublistValue({sublistId: 'item', fieldId: 'custcol_swc_financial_product', value: financialProduct});//财务核算产品
                    var custId = invoiceRecord.getValue({fieldId:"entity"});//客户id
                    if(custId)invoiceRecord.setCurrentSublistValue({sublistId: 'item', fieldId: 'custcol_swc_partner', value: custId});//合作伙伴
                    invoiceRecord.commitLine({sublistId: 'item'});
                    //上传PDF文件
                    if(pdfDataArr.length>0){
                        var index = 1;
                        for(var i=0;i<pdfDataArr.length;i++){
                            var fileId = "";
                            var fileurl = pdfDataArr[i].fileurl || "";
                            var base64code = pdfDataArr[i].base64code || "";
                            if(base64code){
                                var newBase64code = baseJson[base64code] || "";
                                if(newBase64code){
                                    var pdfFile = file.create({name:collectionId+"_PDF_"+index,folder:SWC_CONFIG_DATA.configData().SALESFORCE_QUREY_INVOICE_PDF_FOLDER_ID,fileType: file.Type.PDF,contents:newBase64code});//PDF文件存入位置Downloads-PDF文件下
                                    index++;
                                    fileId = pdfFile.save();//PDF文件id
                                }
                            }
                            //子列表中存入PDF文件内容
                            invoiceRecord.selectNewLine({sublistId: 'recmachcustrecord_collection_invoice_connect'});
                            if(fileId)invoiceRecord.setCurrentSublistValue({sublistId: 'recmachcustrecord_collection_invoice_connect', fieldId: 'custrecord_collection_invoice_file', value: fileId});     //PDF文件
                            if(fileurl)invoiceRecord.setCurrentSublistValue({sublistId: 'recmachcustrecord_collection_invoice_connect', fieldId: 'custrecord_collection_invoice_url', value: fileurl});     //url
                            invoiceRecord.commitLine({sublistId: 'recmachcustrecord_collection_invoice_connect'});

                        }
                    }
                    invoiceRecord.save();
                }catch (e) {
                    message+= "创建发票 "+collectionName+" 报错，报错信息："+e.message;
                }
            }
            if(message)throw message;
        }

        /**
         * jjp salesforce 手动创建task 生成销售订单
         * @param options
         */
        function getSalesforceSaleOrder(options){
            var message = "";
            var output = options.output;
            var orderJson = output.order;//订单数据
            log.audit("Business-getSalesforceSaleOrder-output-orderJson",orderJson);
            var orderId = orderJson.Id; // salesforce 订单id
            var accountId = orderJson.AccountId; //ACCOUNT ID
            var orderNumber = orderJson.OrderNumber; //订单编号
            var region = orderJson.Region__c; //REGION
            var productFamily = orderJson.Product_Family__c; //类别
            var orderStartDate = orderJson.EffectiveDate; //日期
            //jjp0321+合作伙伴字段功能 start
            var Partner_Name__c = orderJson.Partner_Name__c; //合作伙伴（对应ns的客户下的【客户编号】）
            //jjp0321+合作伙伴字段功能 end
            var trandate = getModifyDate(orderStartDate);
            var overallEndDate = orderJson.EndDate; //ORDER END
            var orderEndDate = getModifyDate(overallEndDate);
            var status = orderJson.Status; //STATUS
            var paymentTerm = orderJson.Payment_Term__c; //PAYMENT TERM
            var term = orderJson.Term__c; //TERM (MONTHS)
            var currencyIsoCode = orderJson.CurrencyIsoCode; //货币
            var cloudRegistrationSource = orderJson.Cloud_Registration_Source__c; //Marketplace
            var pingCAPRevRecEntity = orderJson.PingCAP_RevRec_Entity__c; //主要子公司
            if(!pingCAPRevRecEntity)throw "主要子公司 pingCAPRevRecEntity"+pingCAPRevRecEntity+"不存在";

            //添加去重record
            var soExternalId = "SALES_ORDER_" + orderId;
            var thiSoId = Commons.searchByExternalId(soExternalId, record.Type.SALES_ORDER);
            var soId = "";//销售订单ID
            var subsidiary = Commons.srchSubsidiaryIdByName(pingCAPRevRecEntity);//主要子公司
            if (!subsidiary) throw "主要子公司" + subsidiary + "在NS中不存在";
            try {
                // 根据客户编码查询客户ID
                var customerId = Commons.srchCustomerIdByCode(accountId);
                //if (!customerId) throw "当前客户" + accountId + "在NS中不存在";
                //log.audit("customerId",customerId);
                var accountJson = output.account || "";//客户数据
                var financeCurrency = accountJson.financeCurrency || ""; // 货币2  Currency_for_Finance__c
                //如果客户在NS不存在 则创建客户
                if (!customerId) {
                    var accountCode = accountJson.Id; //客户编码
                    var accountName = accountJson.Name; // 客户名称
                    var accountRegion = accountJson.Region__c; // REGION
                    var accountcurrency = accountJson.currency; // 货币
                    var accountBillingAddress = accountJson.billingAddress; // 地址
                    //创建客户
                    var customerRecord = record.create({type: record.Type.CUSTOMER, isDynamic: true});
                    if (accountName) customerRecord.setValue({fieldId: 'companyname', value: accountName});//客户名称
                    customerRecord.setValue({fieldId: 'subsidiary', value: subsidiary});//主要子公司
                    if (accountId) customerRecord.setValue({fieldId: 'custentity_swc_customer_code', value: accountId});//客户编号
                    if (accountRegion) customerRecord.setValue({fieldId: 'custentity_swc_region', value: accountRegion});//REGION
                    if (accountcurrency) customerRecord.setText({fieldId: 'currency', text: accountcurrency});//货币
                    if (accountBillingAddress) customerRecord.setValue({fieldId: 'custentity_swc_billing_address', value: accountBillingAddress});//地址
                    customerRecord.setValue({fieldId: 'isperson', value: SWC_CONFIG_DATA.configData().SALESFORCE_QUREY_CUSTOMER_ISPERSON_COMPANY});//类型 isperson=“公司”
                    var customerExternalId = "CUSTOMER_" + accountCode;
                    customerRecord.setValue({fieldId: 'externalid', value: customerExternalId});//客户外部id
                    //如果拉取过来的两个客户不一致 则需要将领一个也赋值到客户币种子列表中
                    if(financeCurrency && accountcurrency != financeCurrency){
                        customerRecord.selectNewLine({sublistId: 'currency'});
                        customerRecord.setCurrentSublistText({sublistId: 'currency', fieldId: 'currency', text: financeCurrency});//货币2
                        customerRecord.commitLine({sublistId:"currency"});
                    }
                    customerId = customerRecord.save();
                }else {
                    if(!thiSoId){
                        //查询客户，如果该客户下没有销售订单下的 币种 则货品子列表中新增该 币种
                        var customerRec = record.load({type:record.Type.CUSTOMER,id:customerId,isDynamic:true});
                        var custFlag = false;//如果为true 则需要保存客户单据 为false说该客户record没有操作不需要保存
                        //判断 客户下币种子列表数据 start
                        var customerCurrencyCount = customerRec.getLineCount({sublistId:"currency"});//客户下币种行数
                        if(customerCurrencyCount >0) {
                            var newCurrencyFlag = false;//如果为true说明客户子列表中有该币种，不做操作。如果为false说明没有该币种，新增一条币种
                            var newFinanceCurrencyFlag = false;//如果为true说明客户子列表中有该币种2，不做操作。如果为false说明没有该币种，新增一条币种2
                            for (var i = 0; i < customerCurrencyCount; i++) {
                                customerRec.selectLine({sublistId: 'currency', line: i});
                                var subCurrency = customerRec.getCurrentSublistText({sublistId: "currency", fieldId: "currency"})//子列表币种
                                //如果客户子列表中存在该币种 则将flag设置为true
                                if (currencyIsoCode && subCurrency == currencyIsoCode) {
                                    newCurrencyFlag = true;
                                }
                                //如果客户子列表中存在该币种 则将flag设置为true
                                if (financeCurrency && subCurrency == financeCurrency) {
                                    newFinanceCurrencyFlag = true;
                                }
                            }
                            //如果为false说明没有该币种，新增一条币种
                            if(currencyIsoCode && newCurrencyFlag == false){
                                customerRec.selectNewLine({sublistId: 'currency'});
                                customerRec.setCurrentSublistText({sublistId: 'currency', fieldId: 'currency', text: currencyIsoCode});//货币
                                customerRec.commitLine({sublistId:"currency"});
                                custFlag = true;
                            }
                            //如果为false说明没有该币种2，新增一条币种2
                            if(financeCurrency && newFinanceCurrencyFlag == false){
                                customerRec.selectNewLine({sublistId: 'currency'});
                                customerRec.setCurrentSublistText({sublistId: 'currency', fieldId: 'currency', text: financeCurrency});//货币2
                                customerRec.commitLine({sublistId:"currency"});
                                custFlag = true;
                            }
                        }
                        //判断 客户下币种子列表数据 end

                        //判断 客户下子公司子列表数据 start
                        var customerSubsidiaryCount = customerRec.getLineCount({sublistId:"submachine"});//客户下子公司行数
                        if(customerSubsidiaryCount >0) {
                            var newsubsidiaryFlag = false;//如果为true说明客户子列表中有该子公司，不做操作。如果为false说明没有该子公司，子列表新增一条子公司
                            for(var j=0;j<customerSubsidiaryCount;j++){
                                customerRec.selectLine({sublistId: 'submachine',line:j});
                                var subSubsidiary = customerRec.getCurrentSublistValue({sublistId:"submachine",fieldId:"subsidiary"})//子列表子公司
                                //如果客户子列表中存在该子公司 则将flag设置为true
                                if(subSubsidiary == subsidiary){
                                    newsubsidiaryFlag = true;
                                }
                            }
                            //如果为false说明没有该子公司，新增一条子公司
                            if(newsubsidiaryFlag == false){
                                customerRec.selectNewLine({sublistId: 'submachine'});
                                customerRec.setCurrentSublistValue({sublistId: 'submachine', fieldId: 'subsidiary', value: subsidiary});//子公司
                                customerRec.commitLine({sublistId:"submachine"});
                                custFlag = true;
                            }
                        }
                        //判断 客户下子公司子列表数据 end
                        if(custFlag)customerRec.save();
                    }
                }
            }catch (e) {
                throw "创建客户报错，报错信息：" + e.message;
            }
            if (!customerId) throw "当前客户" + accountId + "在NS中不存在";
            log.audit("customerId",customerId);
            if (!thiSoId) {
                //添加销售订单
                var soRecord = record.create({type: record.Type.SALES_ORDER, isDynamic: true,defaultValues:{"entity":customerId,"subsidiary":subsidiary}});
                //log.audit("customerId", customerId);
                //soRecord.setValue({fieldId: 'entity', value: customerId});//客户：作业
                //soRecord.setValue({fieldId: 'subsidiary', value: subsidiary});//主要子公司
                soRecord.setValue({fieldId: 'orderstatus', value: SWC_CONFIG_DATA.configData().SALESFORCE_QUREY_SO_STATUS_WAIT_FULFIL})//状态  B:待履行
                if (accountId) soRecord.setValue({fieldId: 'custbody_swc_accountid', value: accountId});//ACCOUNT ID
                if (orderNumber) soRecord.setValue({fieldId: 'otherrefnum', value: orderNumber});//采购订单号
                if (region) soRecord.setValue({fieldId: 'custbody_swc_region', value: region});//REGION
                if (productFamily) soRecord.setText({fieldId: 'class', Text: productFamily});//类别
                if (trandate) soRecord.setValue({fieldId: 'trandate', value: trandate});//日期
                if (orderEndDate) soRecord.setValue({fieldId: 'custbody_swc_order_enddate', value: orderEndDate});//ORDER END DATE
                if (status) soRecord.setValue({fieldId: 'custbody_swc_status', value: status});//STATUS
                if (paymentTerm) soRecord.setValue({fieldId: 'custbody_swc_payment_term', value: paymentTerm});//Payment Term
                if (term) soRecord.setValue({fieldId: 'custbody_swc_term', value: term});//TERM (MONTHS)
                //如果Currency_for_Finance__c存在，将Currency_for_Finance__c设置在【币种】字段，将currency_is_code设置在【异常订单币种】字段下。
                // 如果Currency_for_Finance__c不存在，将currency_is_code设置在【币种】字段上
                log.audit("financeCurrency",financeCurrency);
                if(financeCurrency){
                    soRecord.setText({fieldId: 'currency', text: financeCurrency});//货币
                    soRecord.setText({fieldId: 'custbody_swc_error_currency', text: currencyIsoCode});//异常订单币种
                }else if (currencyIsoCode){
                    soRecord.setText({fieldId: 'currency', text: currencyIsoCode});//货币
                }
                if (cloudRegistrationSource) soRecord.setValue({fieldId: 'custbody_swc_marketplace', value: cloudRegistrationSource});//Marketplace
                if (soExternalId) soRecord.setValue({fieldId: 'externalid', value: soExternalId})             //外部id
                //jjp0321+合作伙伴字段功能 start
                if(Partner_Name__c) {
                    // 根据客户编码查询客户ID
                    var partnerNameId = Commons.srchCustomerIdByCode(Partner_Name__c);
                    if (!partnerNameId){
                        var partnerAccountJson = output.partnerAccount || "";//客户数据
                        var partnerAccountName = partnerAccountJson.Name; // 客户名称
                        var partnerAccountRegion = partnerAccountJson.Region__c; // REGION
                        var partnerAccountcurrency = partnerAccountJson.currency; // 货币
                        var partnerAccountBillingAddress = partnerAccountJson.billingAddress; // 地址
                        //创建客户
                        var partnerCustomerRecord = record.create({type: record.Type.CUSTOMER, isDynamic: true});
                        if (partnerAccountName) partnerCustomerRecord.setValue({fieldId: 'companyname', value: partnerAccountName});//客户名称
                        partnerCustomerRecord.setValue({fieldId: 'subsidiary', value: subsidiary});//主要子公司
                        if (Partner_Name__c) partnerCustomerRecord.setValue({fieldId: 'custentity_swc_customer_code', value: Partner_Name__c});//客户编号
                        if (partnerAccountRegion) partnerCustomerRecord.setValue({fieldId: 'custentity_swc_region', value: partnerAccountRegion});//REGION
                        if (partnerAccountcurrency) partnerCustomerRecord.setText({fieldId: 'currency', text: partnerAccountcurrency});//货币
                        if (partnerAccountBillingAddress) partnerCustomerRecord.setValue({fieldId: 'custentity_swc_billing_address', value: partnerAccountBillingAddress});//地址
                        partnerCustomerRecord.setValue({fieldId: 'isperson', value: SWC_CONFIG_DATA.configData().SALESFORCE_QUREY_CUSTOMER_ISPERSON_COMPANY});//类型 isperson=“公司”
                        var partnerCustomerExternalId = "CUSTOMER_" + partnerAccountJson.Id;
                        partnerCustomerRecord.setValue({fieldId: 'externalid', value: partnerCustomerExternalId});//客户外部id
                        partnerNameId = partnerCustomerRecord.save();
                    }
                    soRecord.setValue({fieldId: 'custbody_swc_partner', value: partnerNameId})  //合作伙伴
                }
                //jjp0321+合作伙伴字段功能 end
                var itemsArr = orderJson.items;//货品行数据
                //log.audit("itemsArr", itemsArr);
                try{
                    for (var k = 0; k < itemsArr.length; k++) {
                        var product = itemsArr[k].Name; //货品
                        var num = itemsArr[k].Quantity__c; //数量
                        var termMonths = itemsArr[k].Term_Months__c; //货品-Term(Months)
                        var netFees = itemsArr[k].Net_fees__c; //总金额
                        //var Tax__c = itemsArr[k].Tax__c; //税码
                        var Product_Code__c = itemsArr[k].Product_Code__c; //Product Code
                        var serviceStartDate = itemsArr[k].Service_Start_Date__c; //service start date
                        var serStartDate = getModifyDate(serviceStartDate);
                        var serviceEndDate = itemsArr[k].Service_End_Date__c; //service end date
                        var serEndDate = getModifyDate(serviceEndDate);
                        if (!termMonths) termMonths = 1;
                        var quantity = num * termMonths; //quantity*Term(Months)	数量*周期
                        //Total Fees - net fees 税额
                        var rate = (netFees/parseInt(num)).toFixed(2);//单价 = 总金额/数量
                        soRecord.selectNewLine({sublistId: 'item'});
                        soRecord.setCurrentSublistText({sublistId: 'item', fieldId: 'item', text: product}); //货品
                        if(!soRecord.getCurrentSublistText({sublistId:"item",fieldId:"item"}))message+= "销售订单"+orderId+"的货品："+product+"在NS中不存在。";
                        soRecord.setCurrentSublistValue({sublistId: 'item', fieldId: 'custcol_swc_quantity', value: num});     //数量
                        if (termMonths) soRecord.setCurrentSublistValue({sublistId: 'item', fieldId: 'custcol_swc_term', value: termMonths});  //货品-Term(Months)
                        soRecord.setCurrentSublistValue({sublistId: 'item', fieldId: 'quantity', value: quantity}); //quantity
                        soRecord.setCurrentSublistValue({sublistId: 'item', fieldId: 'custcol_swc_product_code', value: Product_Code__c}); //Product Code
                        soRecord.setCurrentSublistValue({sublistId: 'item', fieldId: 'custcol_swc_service_startdate', value: serStartDate}); //service start date
                        soRecord.setCurrentSublistValue({sublistId: 'item', fieldId: 'custcol_swc_service_enddate', value: serEndDate}); //service end date
                        //soRecord.setCurrentSublistValue({sublistId: 'item', fieldId: 'tax1amt', value: tax1amt});     //税额
                        soRecord.setCurrentSublistValue({sublistId: 'item', fieldId: 'amount', value: netFees});     //总金额
                        soRecord.setCurrentSublistValue({sublistId: 'item', fieldId: 'rate', value: rate,ignoreFieldChange:true});     //单价
                        //soRecord.setCurrentSublistText({sublistId: 'item', fieldId: 'taxrate1', text: "0.0%"});     //税率
                        //soRecord.setCurrentSublistValue({sublistId: 'item', fieldId: 'taxcode', value: 15,ignoreFieldChange:true});     //税码

                        soRecord.commitLine({sublistId: 'item'});
                    }
                    soId = soRecord.save();
                }catch (e){
                    message+= "创建销售订单"+orderId+"时报错，货品为："+product+"。报错信息："+e.message;
                }
            }
            if(message)throw message;
        }

        /**
         * 邮箱包含“@pingcap”并且飞书员工ID（custentity_swc_feishu_userid）为空的,赋值飞书ID
         * @param options
         */
        function getEmployeeFeiShuId(options) {
            log.audit('ceshi','ceshi');
            var output = options.output;
            var empId = output.nsInternalId;  // ns 员工内部标识
            var user_id = output.user_id; // 飞书员工ID
            var email = output.email; // 邮箱

            try {
                if(empId) {
                    record.submitFields({type:"employee",id:empId,values:{"custentity_swc_feishu_userid":user_id}});
                }
            } catch (e) {
                throw e;
            }
        }

        /**
         * 邮箱包含“@pingcap”并且飞书员工ID（custentity_swc_feishu_ouid）为空的,赋值飞书ID
         * @param options
         */
        function getEmployeeFeiShuOUId(options) {
            log.audit('ceshi','ceshi');
            var output = options.output;
            var empId = output.nsInternalId;  // ns 员工内部标识
            var user_id = output.user_id; // 飞书员工ID
            var email = output.email; // 邮箱

            try {
                if(empId) {
                    record.submitFields({type:"employee",id:empId,values:{"custentity_swc_feishu_ouid":user_id}});
                }
            } catch (e) {
                throw e;
            }
        }

        /**
         * 金蝶云星空凭证保存到金碟凭证记录
         */
        function getKingdeeVoucher(options) {
            log.error("getKingdeeVoucher start", runtime.getCurrentScript().getRemainingUsage())
            var kingdeeData = options.output.kingdeeData;
            var logicData = options.output.logicData;

            // 接口取得数据校验
            // 根据拉取到的【金蝶科目编码】，取得【金蝶云星空科目映射表】数据
            // {"金蝶科目编码": {"nsAcctCode": "NS科目编码", "bankTypeFlag": "true代表银行类科目", "interType": "公司间类型（客户/供应商）"}, ...}
            var kingdeeAcctObj = Commons.schKingdeeAcct();
            // 检索科目，取得NS科目编号及科目ID
            var nsAcctCode2IdObj = Commons.schNsAcctCode2Id();
            // 取得【金蝶云星空货币映射表】数据
            var kingdeeCurrencyObj = Commons.schKingdeeCurrency();
            // 根据金碟云星空公司编码取得NS子公司内部ID
            var subsidiaryObj = Commons.schSubsidiaryBykingdeeSubCode(logicData.subsidiary);
            // 检索金碟银行账号、NS公司不为空的科目: {"子公司_关联银行科目": "科目", ...}
            var bankAcctObj = Commons.schBankAcct();
            // 检索项目(日记账)
            var projectJournal = Commons.schProjectJournal();
            // 检索组织结构
            var organizationObj = Commons.srchSubsidiaryByKdCodeNotEmpty();
            // 检索部门映射（金蝶云星空cost center mapping）
            var costCenterMappingObj = Commons.srchCostCenterMapping();

            // 映射数据错误处理
            var errMsg = "";
            // 子公司映射
            var subsidiary = subsidiaryObj[kingdeeData.fAccBookOrgId];
            if (!subsidiary) {
                errMsg += "系统未维护金碟云星空子公司编码：" + kingdeeData.fAccBookOrgId + "对应的子公司；\n";
            }
            // 币别
            if (!kingdeeCurrencyObj[kingdeeData.fCurrencyId]) {
                errMsg += "系统未维护金蝶云星空币别编码" + kingdeeData.fCurrencyId + "对应的货币；\n";
            }
            // 科目编码 => 非银行类科目编码处理
            var sublist = kingdeeData.sublist;
            sublist.forEach(function (value) {
                if (!kingdeeAcctObj.hasOwnProperty(value.fAccountId)) {
                    // 金蝶云星空科目映射表不存在当前科目的场合，提示：金蝶云星空科目映射表未维护对应的金蝶科目编码：[金蝶科目编码] \n
                    errMsg += "金蝶云星空科目映射表未维护对应的金蝶科目编码[" + value.fAccountId + "] \n";
                } else {
                    // 金蝶云星空科目映射表存在当前科目的场合
                    var curAcctMapping = kingdeeAcctObj[value.fAccountId];
                    if (!curAcctMapping.bankTypeFlag) {
                        if (!curAcctMapping.nsAcctCode) {
                            // 非银行类科目编码&&当NS科目编码为空的场合，提示：金蝶云星空科目映射表未维护金蝶科目编码：[金蝶科目编码]对应的NS科目编码 \n
                            errMsg += "金蝶云星空科目映射表未维护金蝶科目编码：[" + value.fAccountId + "]对应的NS科目编码 \n";
                        } else if (!nsAcctCode2IdObj[curAcctMapping.nsAcctCode]) {
                            // 金蝶云星空科目映射表维护的NS科目编码错误的场合，提示：系统科目未维护金蝶云星空科目映射表NS科目编码：[123]对应的科目
                            errMsg += "系统科目未维护金蝶云星空科目映射表NS科目编码：[" + curAcctMapping.nsAcctCode + "]对应的科目 \n";
                        }
                    } else {
                        // 科目编码 => 银行类科目编码处理
                        // 当金蝶银行账号、NS公司存在的场合，取得对应的NS银行类科目账号
                        if (!bankAcctObj.hasOwnProperty(subsidiary + "_" + value.bankAcct)) {
                            // 银行类科目编码为空的场合，提示：未维护银行账号：【123】、子公司【456】对应的银行类科目
                            errMsg += "科目：[" + value.fAccountId + "]未维护银行账号：[" + value.bankAcct + "]、子公司[" + subsidiary + "]对应的银行类科目 \n";
                        }
                    }

                    // 存在组织机构，科目未维护公司间类型，提示：金蝶云星空科目映射表未维护金碟科目编码[xxx]对应的公司间类型
                    if (value.fNumber && !curAcctMapping.interType) {
                        errMsg += "金蝶云星空科目映射表未维护金碟科目编码：[" + value.fAccountId + "]对应的公司间类型 \n";
                    }
                }
                // project 项目校验
                if (value.project && !projectJournal.hasOwnProperty(value.project)) {
                    errMsg += "项目（日记账）未维护【" + value.project + "】对应的数据 \n";
                }
                // 组织机构校验
                if (value.fNumber && !organizationObj.hasOwnProperty(value.fNumber)) {
                    errMsg += "子公司未维护金蝶组织机构编码【" + value.fNumber + "】对应的数据 \n";
                }

                // 金蝶云星空部门编码不为空 && 部门映射未维护的场合，提示：【金蝶云星空cost center mapping】表未维护金蝶部门编码【XXXX】
                if (value.costCenter && !costCenterMappingObj[value.costCenter]) {
                    errMsg += "【金蝶云星空cost center mapping】表未维护金蝶部门编码【" + value.costCenter + "】对应的数据 \n";
                }

            });

            if (errMsg) {
                throw errMsg;
            }

            // 根据当前执行人、执行时间、凭证编号检索金碟凭证单据，追加检索条件子公司
            var kingdeeVoucher = Commons.schKingdeeVoucher({
                person: kingdeeData.person,
                date: kingdeeData.exeDate,
                voucher: kingdeeData.fBillNo,
                subsidiary: subsidiary
            });
            var kvRec;
            if (kingdeeVoucher) {
                // 凭证单据存在的场合，添加金碟凭证明细数据
                kvRec = record.load({type: "customrecord_kingdee_voucher", id: kingdeeVoucher.intlId, isDynamic: true});
            } else {
                // 不存在的场合，创建【金碟凭证】记录类型
                kvRec = record.create({type: "customrecord_kingdee_voucher", isDynamic: true});
                kvRec.setValue({fieldId: "custrecord_kv_person", value: kingdeeData.person});
                kvRec.setValue({fieldId: "custrecord_kv_date", value: kingdeeData.exeDate});
                kvRec.setValue({fieldId: "custrecord_kv_billno", value: kingdeeData.fBillNo});
                kvRec.setValue({fieldId: "custrecord_kv_subsidiary", value: subsidiary});
                kvRec.setValue({fieldId: "custrecord_kv_currency", value: kingdeeCurrencyObj[kingdeeData.fCurrencyId]});
                // 日期字段处理 按照"T"分割接口日期字符串，取得日期
                if (kingdeeData.fDate) {
                    // 根据当前用户首选项设置日期
                    var fDate = format.parse({
                        value: Commons.formatDate(kingdeeData.fDate.split("T")[0].replaceAll("-", "")),
                        type: format.Type.DATE
                    });
                    kvRec.setValue({fieldId: "custrecord_kv_trandate", value: fDate});
                }
                // 过账日期处理 按照"T"分割接口日期字符串，取得日期
                if (kingdeeData.fPostDate) {
                    // 根据当前用户首选项设置日期
                    var fPostDate = format.parse({
                        value: Commons.formatDate(kingdeeData.fPostDate.split("T")[0].replaceAll("-", "")),
                        type: format.Type.DATE
                    });
                    kvRec.setValue({fieldId: "custrecord_kv_postdate", value: fPostDate});
                }
                // 创建的场合，设置凭证条数
                kvRec.setValue({fieldId: "custrecord_kv_count", value: kingdeeData.voucherCount});
                // 金蝶凭证年份
                kvRec.setValue({fieldId: "custrecord_kv_year", value: logicData.year});
                // 金蝶凭证月份
                kvRec.setValue({fieldId: "custrecord_kv_month", value: logicData.month});
            }

            var sublist = kingdeeData.sublist;
            sublist.forEach(function (value) {
                kvRec.selectNewLine({sublistId: "recmachcustrecord_kvd_main"});

                // 科目取值设定
                var account = "";
                var curAcctMapping = kingdeeAcctObj[value.fAccountId];
                // 银行类科目标识（默认值：false 非银行类科目）
                var bankTypeFlag = false;
                if (curAcctMapping.bankTypeFlag) {
                    // 银行类科目的场合，科目设置为根据金蝶银行账号、NS公司检索的NS银行类科目账号
                    account = bankAcctObj[subsidiary + "_" + value.bankAcct];
                    // 当前科目为银行类科目的场合
                    bankTypeFlag = true;
                } else {
                    // 非银行类科目的场合，科目设置为根据金蝶云星空科目映射表、系统科目取得的对应科目
                    account = nsAcctCode2IdObj[curAcctMapping.nsAcctCode];
                }
                kvRec.setCurrentSublistValue({sublistId: "recmachcustrecord_kvd_main", fieldId: "custrecord_kvd_account", value: account});

                kvRec.setCurrentSublistValue({sublistId: "recmachcustrecord_kvd_main", fieldId: "custrecord_kvd_debit", value: value.fDebit});
                kvRec.setCurrentSublistValue({sublistId: "recmachcustrecord_kvd_main", fieldId: "custrecord_kvd_credit", value: value.fCredit});
                kvRec.setCurrentSublistValue({sublistId: "recmachcustrecord_kvd_main", fieldId: "custrecord_kdv_explanation", value: value.fExplanation});
                kvRec.setCurrentSublistValue({sublistId: "recmachcustrecord_kvd_main", fieldId: "custrecord_kvd_fnumber", value: organizationObj[value.fNumber]});
                kvRec.setCurrentSublistValue({sublistId: "recmachcustrecord_kvd_main", fieldId: "custrecord_kvd_domestic_ven", value: value.domesticVen});
                kvRec.setCurrentSublistValue({sublistId: "recmachcustrecord_kvd_main", fieldId: "custrecord_kvd_domestic_cus", value: value.domesticCus});
                kvRec.setCurrentSublistValue({sublistId: "recmachcustrecord_kvd_main", fieldId: "custrecord_kvd_acctbank", value: value.bankAcct});
                kvRec.setCurrentSublistValue({sublistId: "recmachcustrecord_kvd_main", fieldId: "custrecord_kvd_cost_center", value: costCenterMappingObj[value.costCenter]});
                // 货币
                kvRec.setCurrentSublistValue({sublistId: "recmachcustrecord_kvd_main", fieldId: "custrecord_kvd_currency", value: kingdeeCurrencyObj[kingdeeData.fCurrencyId]});
                // 外汇兑换率
                kvRec.setCurrentSublistValue({sublistId: "recmachcustrecord_kvd_main", fieldId: "custrecord_kvd_fexchangerate", value: value.fExchangeRate});
                // 银行类科目标识
                kvRec.setCurrentSublistValue({sublistId: "recmachcustrecord_kvd_main", fieldId: "custrecord_kvd_banktypeflag", value: bankTypeFlag});
                // 项目（日记账）
                if (value.project) kvRec.setCurrentSublistValue({sublistId: "recmachcustrecord_kvd_main", fieldId: "custrecord_kvd_projectjournal", value: projectJournal[value.project]});
                // 公司间类型
                kvRec.setCurrentSublistValue({sublistId: "recmachcustrecord_kvd_main", fieldId: "custrecord_kvd_intertype", value: curAcctMapping.interType});

                kvRec.commitLine({sublistId: "recmachcustrecord_kvd_main"});
            });

            kvRec.save();

            log.error("getKingdeeVoucher end", runtime.getCurrentScript().getRemainingUsage())
        }

        /**
         * 飞书 采购申请|付款申请 拉取飞书审批状态----暂时停用
         */


        /**
         * 飞书 采购申请|付款申请 拉取飞书审批状态----暂时停用-1(调用飞书接口改成调用自定义record功能-1版本)
         */
        function getFsAuditStatus(options){
            var outArr = options.output._output_;
            var form = options.output.form;//审批内容
            if(outArr.length <= 0)return;
            var approval_code = options.output.approval_code;
            var id = options.output.id;
            log.audit("Business-getFsAuditStatus-form",form);

            //采购申请
            if(approval_code == SWC_CONFIG_DATA.configData().FS_APPROVAL_TEMPLATE_PURCH_APPLY){
                log.audit("Business-getFsAuditStatus采购申请-output",options.output);
                if(!id)throw new Error("采购申请单内部ID不存在！");
                try{
                    //查询采购申请单
                    var poRequestRecord = record.load({type:"customrecord_swc_purchase_request",id:id});
                    var outJson = {};//instance_code  格式：{instance_code1:status1,instance_code2:status2,...}
                    var outUserJson = {};//审批人  格式：{instance_code1:userName,instance_code2:userName2,...}

                    var userIdArr = [];//飞书员工ID数组
                    //将所有飞书员工id放入数组中
                    for(var i=0;i<outArr.length;i++){
                        var user_id =outArr[i].user_id || "";
                        if(user_id)userIdArr.push(user_id);
                    }
                    var userIdJson = {};
                    if(userIdArr.length > 0){
                        userIdJson = Commons.srchEmployeeName(userIdArr);
                    }

                    //将返回的code和状态放入JSON中
                    for(var i=0;i<outArr.length;i++){
                        var status = outArr[i].status || "";
                        var instance_code =outArr[i].instance_code || "";
                        var user_id =outArr[i].user_id || "";
                        var userName = "";//审批人

                        if(user_id){
                            userName = userIdJson[user_id] || "";
                        }
                        if(status && instance_code){
                            if(status == "PENDING")status = SWC_CONFIG_DATA.configData().WORKFLOW_STATUS_FS_APPROVAL;
                            if(status == "APPROVED")status = SWC_CONFIG_DATA.configData().WORKFLOW_STATUS_FS_APPROVAL_FINISH;
                            if(status == "REJECTED" || status == "CANCELED" || status == "DELETED")status = SWC_CONFIG_DATA.configData().WORKFLOW_STATUS_FS_APPROVAL_REJECT;
                            outJson[instance_code] = status;//审批状态
                            outUserJson[instance_code] = {};
                            outUserJson[instance_code] = userName;//审批人

                        }
                    }
                    var poRequestRecordCount = poRequestRecord.getLineCount({sublistId:"recmachcustrecord_prs_field"});
                    log.audit("Business-getFsAuditStatus-outJson",outJson);
                    log.audit("Business-getFsAuditStatus-outUserJson",outUserJson);
                    if(poRequestRecordCount>0){
                        var prsPro = "";//项目
                        var flag = true;//如果子列表数据全都是审批通过状态，则设置为true，否则为false
                        for(var j = 0; j < poRequestRecordCount; j++) {
                            var nsInstanceCode = poRequestRecord.getSublistValue({fieldId:"custrecord_prs_instance_code",sublistId:"recmachcustrecord_prs_field",line:j});//飞书INSTANCE_CODE
                            var nsLineStatus = poRequestRecord.getSublistValue({fieldId:"custrecord_prs_line_status",sublistId:"recmachcustrecord_prs_field",line:j});//审批状态
                            //如果code存在并且审批状态为审批中或者驳回状态，则更新该行数据的审批状态
                            if(outJson[nsInstanceCode]){
                                prsPro = poRequestRecord.getSublistValue({fieldId:"custrecord_prs_pro",sublistId:"recmachcustrecord_prs_field",line:j});//项目
                                if(nsLineStatus == SWC_CONFIG_DATA.configData().WORKFLOW_STATUS_FS_APPROVAL || nsLineStatus == SWC_CONFIG_DATA.configData().WORKFLOW_STATUS_FS_APPROVAL_REJECT)
                                    poRequestRecord.setSublistValue({fieldId:"custrecord_prs_line_status",sublistId:"recmachcustrecord_prs_field",line:j,value:outJson[nsInstanceCode]});//审批状态
                                if(outUserJson[nsInstanceCode] &&outUserJson[nsInstanceCode]["name"])poRequestRecord.setSublistValue({fieldId:"custrecord_prs_approver",sublistId:"recmachcustrecord_prs_field",line:j,value:outUserJson[nsInstanceCode]["name"]});//审批人
                            }
                            var nsNewLineStatus = poRequestRecord.getSublistValue({fieldId:"custrecord_prs_line_status",sublistId:"recmachcustrecord_prs_field",line:j});//审批状态
                            //如果子列表审批状态有不是【审批通过】的，将flag设置为false
                            if(nsNewLineStatus != SWC_CONFIG_DATA.configData().WORKFLOW_STATUS_FS_APPROVAL_FINISH && flag == true)flag = false;
                        }
                        log.audit("prsPro",prsPro);
                        //如果子列表审批状态都通过了 则创建采购订单
                        if(flag == true){
                            //根据采购申请创建采购订单
                            var poId = createPo(poRequestRecord,id,prsPro);
                            log.audit("Business-getFsAuditStatus-poId",poId);
                            if(poId){
                                var poRec = record.load({id:poId,type:record.Type.PURCHASE_ORDER});
                                var poCode = poRec.getValue({fieldId:"tranid"});//采购订单号
                                poRequestRecord.setValue({fieldId:"custrecord_pr_finish_allpo",value:true});//如果采购订单创建成功 勾选 是否全部生成采购订单 字段
                                //将PO单号存入子列表中的每个采购订单单号上，更改审批状态为【采购订单已创建】
                                for(var k = 0; k < poRequestRecordCount; k++) {
                                    poRequestRecord.setSublistValue({fieldId:"custrecord_prs_ponum",sublistId:"recmachcustrecord_prs_field",line:k,value:poId});//采购订单
                                    if(poCode){
                                        //截取采购订单号#之后的字符串
                                        var index = poCode.indexOf("#");
                                        var poCoderes = poCode.substr(index + 1,poCode.length);
                                        poRequestRecord.setSublistValue({fieldId:"custrecord_prs_potext",sublistId:"recmachcustrecord_prs_field",line:k,value:poCoderes});//采购订单号
                                    }
                                    poRequestRecord.setSublistValue({fieldId: "custrecord_prs_line_status", sublistId: "recmachcustrecord_prs_field", line: k, value: SWC_CONFIG_DATA.configData().WORKFLOW_STATUS_PURCH_ORD_CREATED});//审批状态
                                }

                            }
                        }

                        // 设置【是否提交】为true，采购申请单根据【是否提交】字段执行校验，true的场合当前单据推送能够被执行
                        poRequestRecord.setValue({fieldId: "custrecord_pr_submit_flag", value: true});
                        // 设置【是否推送已驳回数据】，设置false，已驳回数据不会重新推送
                        poRequestRecord.setValue({fieldId: "custrecord_pr_refuse_flag", value: false});
                        poRequestRecord.save();//保存采购申请
                    }
                }catch (e){
                    throw "采购申请报错，报错信息："+e.message;
                }
            }

            //供应商付款申请
            if(approval_code == SWC_CONFIG_DATA.configData().FS_APPROVAL_TEMPLATE_VENDOR_ACCT_APPLY) {
                log.audit("Business-getFsAuditStatus供应商付款申请-output", options.output);
                if (!id) throw new Error("供应商付款申请单内部ID不存在！");
                try {
                    var formJson = JSON.parse(form);//审批内容JSON
                    var resultJson = {};//格式：{""付款时间（财务填写）"":xxx,"名称":xxxx,...}
                    //将审批内容中： 以字段name为key，字段值为value存入resultJson中
                    for(var i = 0; formJson.length > 0 && i < formJson.length; i++) {
                        //var fieldId = formJson[i].custom_id;
                        var fieldName = formJson[i].name;
                        var fieldValue = formJson[i].value;
                        resultJson[fieldName] = fieldValue;
                    }
                    log.audit({title:"resultJson",details:resultJson});
                    var realpaydate = "";
                    if(resultJson["付款时间（财务填写）"]){
                        realpaydate = resultJson["付款时间（财务填写）"];
                        realpaydate = realpaydate.slice(0,10);//截取到年月日
                    }
                    var getRealpaydate = getModifyDate(realpaydate)//付款时间（财务填写）
                    //查询供应商账单申请单
                    var accountpayRecord = record.load({type: "customrecord_swc_account_payable", id: id});
                    //20231007  start jjp+
                    var taxRate = resultJson["Tax Rate"];//税码值
                    //log.audit("taxRate",taxRate);
                    accountpayRecord.setValue({fieldId:"custrecord_ap_taxcode",value:taxRate});//供应商账单申请赋值税码字段
                    accountpayRecord.save();
                    var accountpayRecord = record.load({type: "customrecord_swc_account_payable", id: id});
                    //20231007  end jjp+
                    var outJson = {};//格式： {instance_code1:status1,instance_code2:status2,...}
                    //将返回的code和状态放入JSON中
                    for (var i = 0; i < outArr.length; i++) {
                        var status = outArr[i].status || "";
                        var instance_code = outArr[i].instance_code || "";
                        var user_id = outArr[i].user_id || "";
                        if (status && instance_code) {
                            if (status == "PENDING") status = SWC_CONFIG_DATA.configData().BILL_APPROVAL_STATUS_FS_APPROVAL;
                            if (status == "APPROVED") status = SWC_CONFIG_DATA.configData().BILL_APPROVAL_STATUS_FS_APPROVAL_FINISH;
                            if (status == "REJECTED" || status == "CANCELED" || status == "DELETED") status = SWC_CONFIG_DATA.configData().BILL_APPROVAL_STATUS_FS_APPROVAL_REJECT;
                            outJson[instance_code] = status;
                        }
                    }
                    var accountPayItemJson = {};//供应商账单申请子列表数据 格式： {itemId1：总金额1000,itemId2：总金额1001,...}
                    var linkPaJson = {};//供应商账单申请子列表关联数据 格式： {itemId1：[PA1,PA2],itemId2：[PA3],...}
                    var paymentMethod = accountpayRecord.getValue({fieldId:"custrecord_ap_payment_method"});//供应商账单申请-付款方式
                    var expectedPaytime = accountpayRecord.getValue({fieldId:"custrecord_ap_expected_paytime"});//供应商账单申请-期望付款时间
                    var invoiceAttachment = accountpayRecord.getValue({fieldId:"custrecord_ap_invoice_attachment"});//供应商账单申请-发票附件
                    var invoiceAttachment2 = accountpayRecord.getValue({fieldId:"custrecord_ap_invoice_attachment2"});//供应商账单申请-发票附件2
                    var invoiceAttachment3 = accountpayRecord.getValue({fieldId:"custrecord_ap_invoice_attachment3"});//供应商账单申请-发票附件3
                    var description = accountpayRecord.getValue({fieldId:"custrecord_ap_reason_description"});//供应商账单申请-事由描述
                    var invoiceNo = accountpayRecord.getValue({fieldId:"custrecord_ap_invoiceno"});//供应商账单申请-INVOICE NUMBER
                    // 20250423 HC add 结算单等其他支持性文件
                    var otherAttachment = accountpayRecord.getValue({fieldId:"custrecord_ap_other_supportdoc"});//供应商账单申请-结算单等其他支持性文件
                    var isLinkToPa = accountpayRecord.getValue({fieldId:"custrecord_ap_is_link_to_pa"});//供应商账单申请-是否关联预提

                    var accountpayCount = accountpayRecord.getLineCount({sublistId: "recmachcustrecord_aps_field"});
                    //Hitpoint     20251014    新增【Accounting】节点审批人及审批意见
                    /**账单申请明细行飞书单号: {itemid&depid: fsno}*/
                    var hcFSInstanceCodeMap = {};
                    if (accountpayCount > 0) {
                        var apsPro = "";//项目
                        var flag = true;//如果子列表数据全都是审批通过状态，则设置为true，否则为false
                        //【20251124 HP Start】
                        var vbPrepay = false, vbAmorzation = false;
                        var amorData = JSON.parse(options.output.amordata || "{}");
                        //【20251124 HP End】
                        for (var j = 0; j < accountpayCount; j++) {
                            var nsInstanceCode = accountpayRecord.getSublistValue({fieldId: "custrecord_aps_instance_code", sublistId: "recmachcustrecord_aps_field", line: j});//飞书INSTANCE_CODE
                            var nsLineStatus = accountpayRecord.getSublistValue({fieldId: "custrecord_aps_line_status", sublistId: "recmachcustrecord_aps_field", line: j});//审批状态
                            //如果code存在并且审批状态为审批中或者驳回状态，则更新该行数据的审批状态
                            if (outJson[nsInstanceCode]) {
                                apsPro = accountpayRecord.getSublistValue({fieldId:"custrecord_aps_pro",sublistId:"recmachcustrecord_aps_field",line:j});//项目
                                if (nsLineStatus == SWC_CONFIG_DATA.configData().BILL_APPROVAL_STATUS_FS_APPROVAL || nsLineStatus == SWC_CONFIG_DATA.configData().BILL_APPROVAL_STATUS_FS_APPROVAL_REJECT)
                                    accountpayRecord.setSublistValue({fieldId: "custrecord_aps_line_status", sublistId: "recmachcustrecord_aps_field", line: j, value: outJson[nsInstanceCode]});//审批状态
                            }
                            var nsNewLineStatus = accountpayRecord.getSublistValue({fieldId: "custrecord_aps_line_status", sublistId: "recmachcustrecord_aps_field", line: j});//审批状态
                            //如果子列表审批状态有不是【审批通过】的，将flag设置为false
                            if (flag == true && nsNewLineStatus != SWC_CONFIG_DATA.configData().BILL_APPROVAL_STATUS_FS_APPROVAL_FINISH && nsNewLineStatus != SWC_CONFIG_DATA.configData().BILL_APPROVAL_STATUS_BILL_CREATED) flag = false;

                            var nsItemId = accountpayRecord.getSublistValue({fieldId: "custrecord_aps_item", sublistId: "recmachcustrecord_aps_field", line: j});//飞货品
                            var nsDepartment = accountpayRecord.getSublistValue({fieldId: "custrecord_aps_department", sublistId: "recmachcustrecord_aps_field", line: j});//预算归属部门
                            var nsTotalAmount = accountpayRecord.getSublistValue({fieldId: "custrecord_aps_totalamount", sublistId: "recmachcustrecord_aps_field", line: j});//总金额
                            var linkPa = accountpayRecord.getSublistText({fieldId: "custrecord_pc_link_to_pa", sublistId: "recmachcustrecord_aps_field", line: j});//关联PA

                            hcFSInstanceCodeMap[nsItemId + '&' + nsDepartment] = nsInstanceCode;
                            //if(nsItemId && nsTotalAmount)accountPayItemJson[nsItemId] = Number(nsTotalAmount);
                            //相同货品 金额加和
                            if(nsItemId && nsDepartment && nsTotalAmount){
                                if(accountPayItemJson[nsItemId+"_"+nsDepartment]){
                                    accountPayItemJson[nsItemId+"_"+nsDepartment] = Number(accountPayItemJson[nsItemId+"_"+nsDepartment]) + Number(nsTotalAmount);
                                    linkPaJson[nsItemId+"_"+nsDepartment].push(linkPa);
                                }else {
                                    accountPayItemJson[nsItemId+"_"+nsDepartment] = Number(nsTotalAmount);
                                    linkPaJson[nsItemId+"_"+nsDepartment] = [linkPa];
                                }
                            }
                            //【20251124 HP Start】
                            //中间表字段赋值
                            if(amorData[nsInstanceCode] && '' !== amorData[nsInstanceCode]['prepay']) {
                                accountpayRecord.setSublistValue({fieldId: "custrecord_whether_to_prepay", sublistId: "recmachcustrecord_aps_field", line: j, value: amorData[nsInstanceCode]['prepay'] || false});//是否预付
                            }
                            if(amorData[nsInstanceCode] && '' !== amorData[nsInstanceCode]['amorzation']) {
                                accountpayRecord.setSublistValue({fieldId: "custrecord_whether_to_amortize", sublistId: "recmachcustrecord_aps_field", line: j, value: amorData[nsInstanceCode]['amorzation'] || false});//是否摊销
                            }
                            //用于账单字段赋值
                            var custrecord_whether_to_prepay = accountpayRecord.getSublistValue({fieldId: "custrecord_whether_to_prepay", sublistId: "recmachcustrecord_aps_field", line: j});//是否预付
                            if(true === custrecord_whether_to_prepay && false === vbPrepay) vbPrepay = true;
                            var custrecord_whether_to_amortize = accountpayRecord.getSublistValue({fieldId: "custrecord_whether_to_amortize", sublistId: "recmachcustrecord_aps_field", line: j});//是否摊销
                            if(true === custrecord_whether_to_amortize && false === vbAmorzation) vbAmorzation = true;
                            //【20251124 HP End】
                        }
                        //log.error('hc_FSNoMap:' + id, hcFSInstanceCodeMap);

                        var custrecord_ap_billnum = accountpayRecord.getValue({fieldId : "custrecord_ap_billnum"});//账单单号
                        log.audit("apsPro",apsPro);
                        //如果子列表审批状态都通过了并且账单单号为空 则创账单
                        var vendorBillId = "";

                        if (flag == true && !custrecord_ap_billnum) {
                            //Hitpoint     20251014    新增【Accounting】节点审批人及审批意见
                            /**飞书审批信息：{fsno：{user: fsUserId, cmt:comment, userid: NS员工id}}*/
                            var hcApprovalData = HCAdd_getAllFSApprovalData(hcFSInstanceCodeMap, options.platformJson, id);

                            //如果供应商账单申请中的采购订单字段存在 则通过该采购订单生成账单
                            var poId = accountpayRecord.getValue({fieldId:"custrecord_ap_number"});//采购订单id
                            //如果供应商账单申请中的付款方式为 信用卡 则 不创建账单
                            if(paymentMethod != SWC_CONFIG_DATA.configData().VENDOR_BILL_PAYMENT_METHOD_CARD){
                                if(poId) {
                                    //在生成账单之前 把采购订单货品行所有货品 数量+1 总金额不变
                                    var poRec = record.load({id:poId,type:record.Type.PURCHASE_ORDER});//采购订单
                                    var poCount = poRec.getLineCount({sublistId:"item"});//行数
                                    if(poCount >0){
                                        for(var j=0;j<poCount;j++){
                                            var poNum = poRec.getSublistValue({sublistId:"item",fieldId:"quantity",line:j});//货品数量
                                            var amount = poRec.getSublistValue({sublistId:"item",fieldId:"amount",line:j});//总金额
                                            var quantity = parseInt(poNum)+1;
                                            var rate = (amount/quantity).toFixed(2);
                                            poRec.setSublistValue({sublistId:"item",fieldId:"quantity",value:quantity,line:j});
                                            poRec.setSublistValue({sublistId:"item",fieldId:"rate",value:rate,line:j});
                                            poRec.setSublistValue({sublistId:"item",fieldId:"amount",value:amount,line:j});
                                        }
                                        poRec.save();
                                    }
                                    //根据采购订单生成账单
                                    var vendorBillRecord = record.transform({
                                        fromType: record.Type.PURCHASE_ORDER,
                                        fromId: poId,
                                        toType: record.Type.VENDOR_BILL,
                                        isDynamic: true,
                                    });
                                    var deptCostcenterJson = Commons.srchDepartmentCostcenterid();//查询【部门】 Cost Center ID + Name字段JSON
                                    if(paymentMethod)vendorBillRecord.setValue({fieldId:"custbody_swc_payway",value:paymentMethod});//账单-付款方式
                                    if(expectedPaytime)vendorBillRecord.setValue({fieldId:"custbody_swc_repaydate",value:expectedPaytime});//账单-预计付款日期
                                    if(getRealpaydate)vendorBillRecord.setValue({fieldId:"custbody_swc_paydate",value:getRealpaydate});//实际付款日期
                                    if(isLinkToPa) vendorBillRecord.setValue({fieldId:"custbody_pc_link_pa_choose",value:isLinkToPa});//是否关联预提
                                    var vendorId = vendorBillRecord.getValue({fieldId:"entity"});//供应商ID
                                    var companyname = "";
                                    var companynameObj = search.lookupFields({type: search.Type.VENDOR, id: vendorId, columns: ['companyname']});//供应商名称
                                    if(companynameObj && companynameObj.companyname)companyname = companynameObj.companyname;
                                    var newDescription = "";
                                    if(poCount==1){
                                        vendorBillRecord.selectLine({sublistId: 'item',line:0});
                                        var itemName = vendorBillRecord.getCurrentSublistText({sublistId: 'item', fieldId: 'item'});//费用类型
                                        if(itemName){
                                            newDescription = "Bill_"+companyname+"_"+description+"/"+itemName;
                                        }else {
                                            newDescription = "Bill_"+companyname+"_"+description;
                                        }
                                    }else {
                                        newDescription = "Bill_"+companyname+"_"+description;
                                    }
                                    if(newDescription && newDescription.length>=999){
                                        vendorBillRecord.setValue({fieldId:"custbody_swc_bill_longmemo",value:newDescription});//备注
                                        vendorBillRecord.setValue({fieldId:"memo",value:newDescription.slice(0,990)});//备注
                                    }else if(newDescription){
                                        vendorBillRecord.setValue({fieldId:"memo",value:newDescription});//备注

                                    }
                                    //【20251124 HP Start】
                                    if(true === vbPrepay) {
                                        vendorBillRecord.setValue({fieldId:"custbody_whether_to_prepay",value:vbPrepay});//是否预付
                                        vendorBillRecord.setValue({fieldId:"approvalstatus",value:3});//账单审批状态赋值为Reject
                                    }else {
                                        vendorBillRecord.setValue({fieldId:"approvalstatus",value:2});//账单审批状态赋值为Approved
                                    }
                                    if(true === vbAmorzation) vendorBillRecord.setValue({fieldId:"custbody_whether_to_amortize",value:vbAmorzation});//是否摊销
                                    //【20251124 HP End】
                                    if(invoiceNo)vendorBillRecord.setValue({fieldId:"custbody_swc_invoice_number",value:invoiceNo});//INVOICE NUMBER
                                    //生成账单时，通过供应商id查询 【供应商银行信息】record，将第一条数据赋值到 账单中（【账单供应商信息】record）
                                    if(vendorId)createVenBankInfoByVendorId(vendorBillRecord,vendorId);
                                    //如果供应商账单申请 中存在 采购订单 则生成账单之后，根据采购订单id 查询【采购相关文件】record，将【相关应付账单】字段赋值到【采购相关文件】
                                    var floderArr = Commons.schFloderIdByPoId(poId);
                                    log.audit("floderArr",floderArr);
                                    if(floderArr.length >0){
                                        //将文件赋值到账单子列表【采购文件合同】中
                                        for(var k=0;k<floderArr.length;k++){
                                            var venRecord = vendorBillRecord.selectNewLine({sublistId: 'recmachcustrecord_folder_bill'});
                                            vendorBillRecord.setCurrentSublistValue({sublistId:"recmachcustrecord_folder_bill",fieldId:"custrecord_folder_one",value:floderArr[k]});
                                            venRecord.commitLine({sublistId: 'recmachcustrecord_folder_bill'});
                                        }
                                    }
                                    //如果发票附件存在，则将发票附件字段值赋值到【采购文件合同】中
                                    if(invoiceAttachment){
                                        var venRecord = vendorBillRecord.selectNewLine({sublistId: 'recmachcustrecord_folder_bill'});
                                        vendorBillRecord.setCurrentSublistValue({sublistId:"recmachcustrecord_folder_bill",fieldId:"custrecord_folder_one",value:invoiceAttachment});
                                        venRecord.commitLine({sublistId: 'recmachcustrecord_folder_bill'});
                                    }
                                    if(invoiceAttachment2){
                                        var venRecord = vendorBillRecord.selectNewLine({sublistId: 'recmachcustrecord_folder_bill'});
                                        vendorBillRecord.setCurrentSublistValue({sublistId:"recmachcustrecord_folder_bill",fieldId:"custrecord_folder_one",value:invoiceAttachment2});
                                        venRecord.commitLine({sublistId: 'recmachcustrecord_folder_bill'});
                                    }
                                    if(invoiceAttachment3){
                                        var venRecord = vendorBillRecord.selectNewLine({sublistId: 'recmachcustrecord_folder_bill'});
                                        vendorBillRecord.setCurrentSublistValue({sublistId:"recmachcustrecord_folder_bill",fieldId:"custrecord_folder_one",value:invoiceAttachment3});
                                        venRecord.commitLine({sublistId: 'recmachcustrecord_folder_bill'});
                                    }
                                    // 供应商申请-结算单等其他支持性文件添加到账单【采购文件合同】中
                                    if (otherAttachment) {
                                        var venRecord = vendorBillRecord.selectNewLine({sublistId: 'recmachcustrecord_folder_bill'});
                                        vendorBillRecord.setCurrentSublistValue({sublistId:"recmachcustrecord_folder_bill",fieldId:"custrecord_folder_one",value:otherAttachment});
                                        venRecord.commitLine({sublistId: 'recmachcustrecord_folder_bill'});
                                    }
                                    log.audit("accountPayItemJson",accountPayItemJson);
                                    log.audit("linkPaJson",linkPaJson);
                                    //将【供应商账单申请】子列表下的对应货品金额赋值到【账单】的对应货品金额
                                    for (var l = 0; l < poCount; l++){
                                        vendorBillRecord.selectLine({sublistId: 'item',line:l});
                                        var itemId = vendorBillRecord.getCurrentSublistValue({sublistId: 'item', fieldId: 'item'});//账单-货品
                                        var thisDepartment = vendorBillRecord.getCurrentSublistValue({sublistId: 'item', fieldId: 'department'});//账单-部门
                                        //如果税码不为0或者不为空时，税码=货币对应的税码
                                        if(taxRate!="0%" && taxRate){
                                            //飞书税率及单据明细task2383
                                            //var salesTaxSubsidiaryJson = Commons.srchSubsidiaryBySalesTax();//查询【税码】下的数据 {"subsidiary":{"子公司1":10%,...} ,"subsidiaryId":{10%:内部ID1,...}
                                            var subsidiaryId = vendorBillRecord.getValue({fieldId:"subsidiary"});//子公司ID
                                            var TaxCodeAndCurrJson = {};
                                            if(9 == subsidiaryId){
                                                TaxCodeAndCurrJson = Commons.srchTaxCodeAndCurrJPY(subsidiaryId);//查询【税码】下的【税码对应币种】和【税率】
                                            } else {
                                                TaxCodeAndCurrJson = Commons.srchTaxCodeAndCurr();//查询【税码】下的【税码对应币种】和【税率】
                                            }
                                            var subsidiary = accountpayRecord.getValue({fieldId:"custrecord_ap_subsidary"});
                                            var currency = accountpayRecord.getValue({fieldId:"custrecord_ap_currency"});
                                            log.audit("taxRate",taxRate);
                                            log.audit("TaxCodeAndCurrJson",TaxCodeAndCurrJson);
                                            log.audit("subsidiary",subsidiary);
                                            log.audit("currency",currency);
                                            //如果飞书的税码在付款主体对应的【税码】表中存在并且币种不为美金，则赋值该税码
                                            // if(currency != "2" && salesTaxSubsidiaryJson["subsidiary"][subsidiary].length>0 && salesTaxSubsidiaryJson["subsidiary"][subsidiary].indexOf(taxRate)!=-1){
                                            //     var taxCodeId =  salesTaxSubsidiaryJson["subsidiaryId"][taxRate];//税码内部ID
                                            //     log.audit("taxCodeId",taxCodeId);
                                            //     vendorBillRecord.setCurrentSublistValue({sublistId: 'item', fieldId: 'taxcode', value: taxCodeId})// 税码
                                            // }
                                            if(currency != "2" && TaxCodeAndCurrJson.hasOwnProperty(taxRate+"_"+currency)){
                                                var taxCodeId =  TaxCodeAndCurrJson[taxRate+"_"+currency];//税码内部ID
                                                log.audit("taxCodeId",taxCodeId);
                                                vendorBillRecord.setCurrentSublistValue({sublistId: 'item', fieldId: 'taxcode', value: taxCodeId})// 税码
                                            }
                                        }

                                        var totalAmount = 0;//总金额
                                        // if(accountPayItemJson[nsItemId+"_"+thisDepartment])totalAmount = accountPayItemJson[nsItemId+"_"+thisDepartment]; //TODO 20250922
                                        if(accountPayItemJson[itemId+"_"+thisDepartment])totalAmount = accountPayItemJson[itemId+"_"+thisDepartment];
                                        log.audit("totalAmount",totalAmount);
                                        if(totalAmount){
                                            var quantity = vendorBillRecord.getCurrentSublistValue({sublistId: 'item', fieldId: 'quantity'});//账单-数量
                                            //如果公司本位币为日元(付款主体为9PingCAP 株式会社)，币种为日元，明细税码设置完需要对税金进行小数位舍去，总金额保持不变，倒算未税金额（总金额-舍去后税金）及单价（单价除不尽保留6位小数）。
                                            if(subsidiary =="9" && currency == "6"){
                                                var tax = 0;
                                                if(taxRate)tax = Number(taxRate.replace("%",""))/100;
                                                log.audit("tax",tax);
                                                var amount = Number(totalAmount)/(1+tax);
                                                var tax1amt =  Number(totalAmount)-amount;
                                                vendorBillRecord.setCurrentSublistValue({sublistId: 'item', fieldId: 'amount',value: amount});// 未税金额
                                                vendorBillRecord.setCurrentSublistValue({sublistId: 'item', fieldId: 'tax1amt',value: tax1amt});// 税额
                                                var rate = 0;//单价
                                                if(totalAmount!=0 && quantity && quantity!=0)rate = (totalAmount/(1+tax)/quantity).toFixed(6);//单价 = 从【供应商账单申请】对应货品行取的总金额 / 账单数量
                                                log.audit("rate",rate);
                                                vendorBillRecord.setCurrentSublistValue({sublistId: 'item', fieldId: 'rate', value: rate});//账单-单价

                                            }else {
                                                vendorBillRecord.setCurrentSublistValue({sublistId: 'item', fieldId: 'rate',value: (totalAmount/quantity).toFixed(6)});// 单价
                                            }
                                            vendorBillRecord.setCurrentSublistValue({sublistId: 'item', fieldId: 'grossamt', value: totalAmount});//账单-总金额
                                        }else {
                                            vendorBillRecord.setCurrentSublistValue({sublistId: 'item', fieldId: 'rate', value: 0});// 单价
                                            vendorBillRecord.setCurrentSublistValue({sublistId: 'item', fieldId: 'grossamt',value: 0});// 总金额
                                        }
                                        var itemName = vendorBillRecord.getCurrentSublistText({sublistId: 'item', fieldId: 'item'});//费用类型
                                        var newDescription = "Bill_"+companyname+"_"+description+"/"+itemName;
                                        if(newDescription)vendorBillRecord.setCurrentSublistValue({sublistId: 'item', fieldId: 'description', value: newDescription});//账单-说明
                                        if(apsPro)vendorBillRecord.setCurrentSublistValue({sublistId: 'item', fieldId: 'cseg_swc_pro', value: apsPro});//项目

                                        var department = vendorBillRecord.getCurrentSublistValue({sublistId: 'item', fieldId: 'department'});//预算归属部门
                                        if(department){
                                            var costcenter = deptCostcenterJson[department];
                                            log.audit(" PO存在-COST CENTER ID + NAME",costcenter);
                                            if(costcenter)vendorBillRecord.setCurrentSublistValue({sublistId: 'item', fieldId: 'custcol_swc_cost_centerid', value: costcenter});//COST CENTER ID + NAME
                                        }

                                        if (linkPaJson[itemId+"_"+thisDepartment]) {
                                            vendorBillRecord.setCurrentSublistValue({sublistId: 'item', fieldId: 'custcol_related_pa',value: linkPaJson[itemId+"_"+thisDepartment].join(";")});
                                        }

                                        //Hitpoint     20251014    新增【Accounting】节点审批人及审批意见
                                        log.error('HCA_vbLine', itemId + '|' + thisDepartment);
                                        var thisLineFsno = hcFSInstanceCodeMap[itemId + '&' + thisDepartment];//该行【货品&部门】对应账单申请明细行飞书单号
                                        if(thisLineFsno && hcApprovalData[thisLineFsno]) {
                                            var tmp = hcApprovalData[thisLineFsno];
                                            vendorBillRecord.setCurrentSublistValue({sublistId: 'item', fieldId: 'custcol_feishu_comment', value: tmp.cmt});//审批评论
                                            if(tmp.userid) {
                                                vendorBillRecord.setCurrentSublistValue({sublistId: 'item', fieldId: 'custcol_accounting_approver', value: tmp.userid});//Accounting审批人
                                            }
                                        }
                                        vendorBillRecord.commitLine({sublistId: 'item'});
                                    }

                                    vendorBillId = vendorBillRecord.save();
                                    log.audit("根据采购订单生成vendorBillId",vendorBillId);

                                    // if(floderId && vendorBillId){
                                    //     var floderRec = record.load({id:floderId,type:"customrecord_swc_po_floder"});//【采购相关文件】
                                    //     floderRec.setValue({fieldId:"custrecord_folder_bill",value:vendorBillId});
                                    //     floderRec.save();
                                    // }
                                }else {
                                    //根据供应商账单申请生成账单
                                    vendorBillId = createvendorBillByAccountPay(accountpayRecord,getRealpaydate,paymentMethod,expectedPaytime,invoiceAttachment,invoiceAttachment2,invoiceAttachment3,description,apsPro,taxRate, otherAttachment, hcFSInstanceCodeMap, hcApprovalData, vbPrepay, vbAmorzation);
                                }
                            }

                            //如果账单生成成功 将账单赋值到供应商账单申请的【账单单号】上
                            //if(vendorBillId){
                            if(vendorBillId)accountpayRecord.setValue({fieldId :"custrecord_ap_billnum",value:vendorBillId});//账单单号
                            //将审批状态更改为【账单已创建】
                            for (var k = 0; k < accountpayCount; k++) {
                                accountpayRecord.setSublistValue({fieldId: "custrecord_aps_line_status", sublistId: "recmachcustrecord_aps_field", line: k, value: SWC_CONFIG_DATA.configData().BILL_APPROVAL_STATUS_BILL_CREATED});//审批状态
                            }
                            //}
                        }
                        if(vendorBillId) {
                            log.error('vbid:' + accountpayRecord.id, vendorBillId + ' | vbPrepay:' + vbPrepay);
                        }
                        if(getRealpaydate)accountpayRecord.setValue({fieldId:"custrecord_ap_actul_paytime",value: getRealpaydate});//付款日期
                        accountpayRecord.save({enableSourcing: true, ignoreMandatoryFields: true});//保存供应是账单申请单据
                        //HC 预付VB需再次保存触发AP预提
                        if(vbPrepay && '' != vendorBillId) {
                            log.error('非预付VB', 'vbpr:' + accountpayRecord.id + ' | vbid: ' + vendorBillId);
                            var vbObj1 = record.load({type: 'vendorbill', id: vendorBillId});
                            vbObj1.save({enableSourcing: true, ignoreMandatoryFields: true})
                        }
                    }
                }catch (e) {
                    throw "供应商账单申请报错，报错信息："+e.message;
                }
            }
        }

        /**
         * 格式化审批记录（仅当单据明细行均审批通过时）
         * @param fsCodeMapping         飞书单号
         * @param platformJson          飞书配置信息
         * @param apid                  账单申请id
         * @returns {{}}                {fsno：{user：飞书userid，cmt：comment，userid：NS员工id}}
         * @constructor
         */
        function HCAdd_getAllFSApprovalData(fsCodeMapping, platformJson, apid) {
            var accountingNodeData = {};//{fsno: {user: user, cmt: comment}}
            var fsnoArray = Array.from(new Set(Object.values(fsCodeMapping)));
            if(!fsnoArray || 'undefined' == typeof fsnoArray || 0 == fsnoArray.length) {
                return accountingNodeData;
            }
            try {
                var options = {
                    platform : "飞书",
                    apiId : "getRequstAuditStatus",
                    data : {},
                    //instance_code:instance_code[i],
                    tryCount : 3,
                };
                if(!platformJson) {
                    platformJson = SWC_OMS_Utils.getPlatform("飞书");
                }
                var accessToken = platformJson.config.appKey;// accessToken
                var tryCount = 1;
                const APPROVAL_NODE_NAME = "核算审批";
                var fsUidArray = [];
                for(var i = 0; i < fsnoArray.length; i++) {
                    var fsno = fsnoArray[i];
                    var platformUrl = "https://open.feishu.cn/open-apis/approval/v4/instances/"+fsno;
                    var tmp = JSON.parse(JSON.stringify(options));
                    tmp.instance_code = fsno;
                    var response = HCAdd_tryRequestURL(platformUrl, "", {"Authorization": "Bearer " + accessToken}, "GET", tryCount, "飞书");
                    if(response && response.body) {
                        var fsRtn = JSON.parse(response.body).data;
                        var approvalData = HCAdd_formatSingleApprovalData(fsRtn.task_list, fsRtn.timeline, APPROVAL_NODE_NAME);
                        var thisFsData = approvalData.dataInName[APPROVAL_NODE_NAME] ? approvalData.dataInName[APPROVAL_NODE_NAME][0] : false;
                        if(thisFsData && thisFsData.user && -1 == fsUidArray.indexOf(thisFsData.user)) {
                            fsUidArray.push(thisFsData.user);
                        }
                        accountingNodeData[fsno] = thisFsData;
                    }
                }
                var userData = HCAdd_getEmployeeByFSID(fsUidArray);
                for(fsno in accountingNodeData) {
                    accountingNodeData[fsno].userid = userData[accountingNodeData[fsno].user] || '';
                }
            } catch (e) {
                log.error('HCAdd_FSApprDataError:' + apid, e);
            }
            log.error('hcFSAppDataAll:' + apid, accountingNodeData);
            return accountingNodeData;
        }

        function HCAdd_tryRequestURL(platformUrl, postdata, headers, httpMethod, tryCount, platform,userName,userPassword) {
            var response = "";
            var success = false;
            var error = "";
            for (var i = 0; i < tryCount; i++) {
                try {
                    response = https.request({method:httpMethod,url:platformUrl,body:postdata,headers:headers});
                    success = true;
                    break;
                } catch (e) {
                    log.error({title:"nlapiRequestURL",details:i + ":" + e});
                    error = e;
                }
            }
            if (!success) {
                throw error;
            }
            return response;
        }

        /**
         * 格式化单个审批实例指定节点审批人及审批意见
         * @param taskList                  飞书：审批任务列表
         * @param timelineList              飞书：审批日志
         * @param targetNode                飞书：指定审批节点名称
         * @returns {{dataInID: {}, dataInName: {}}}        {{dataInID（以审批节点id为KEY）: {nodeid： [{user: 审批人，cmt：comment}]}, dataInName（以审批节点名称为KEY）: {nodeid： [{user: 审批人，cmt：comment}]}}}
         * @constructor
         */
        function HCAdd_formatSingleApprovalData(taskList, timelineList, targetNode) {
            var approvalDataInId = {},//审批数据(按照审批流id)：{}
                approvalDataInName = {},//审批数据(按照审批节点名称)：{}
                taskLen = taskList.length,
                tlLength = timelineList.length;
            var timelineData = {};//{taskNodeId: [{user: FSUserId, cmt: comment}]}
            //格式化各审批节点审批人及审批意见
            for(var i = 0; i < tlLength; i++) {
                var tmp = timelineData[timelineList[i].task_id] || [];
                tmp.push({
                    user: timelineList[i].user_id, cmt: timelineList[i].comment || ''
                });
                timelineData[timelineList[i].task_id] = tmp;
            }
            for(var j = 0; j < taskLen; j++) {
                var line = taskList[j];
                if(targetNode) {
                    if(line.node_name == targetNode) {
                        var taskId = line.id,
                            taskName = line.node_name;
                        var tmp = timelineData[taskId];
                        if(tmp) {
                            approvalDataInId[taskId] = tmp;
                            if(taskName) {
                                approvalDataInName[taskName] = tmp;
                            }
                        }
                    }
                } else {
                    var taskId = line.id,
                        taskName = line.node_name;
                    var tmp = timelineData[taskId];
                    if(tmp) {
                        approvalDataInId[taskId] = tmp;
                        if(taskName) {
                            approvalDataInName[taskName] = tmp;
                        }
                    }
                }
            }
            var rtn = {
                dataInID: approvalDataInId,
                dataInName: approvalDataInName
            };
            return rtn;
        }

        function HCAdd_getEmployeeByFSID(fsidArray) {
            if(!fsidArray || fsidArray.length == 0) {
                return {};
            }
            var filters = [], columns = [];
            filters.push(['isinactive', 'is', false]);
            filters.push('and');
            var fsidFts = [];
            for(var i = 0; i < fsidArray.length; i++) {
                fsidFts.push(['custentity_swc_feishu_userid', 'is', fsidArray[i]]);
                fsidFts.push('or');
            }
            fsidFts.pop();
            filters.push(fsidFts);
            columns.push('custentity_swc_feishu_userid');
            columns.push(search.createColumn({
                name: 'internalid', sort: 'DESC'
            }))
            var results = search.create({
                type: 'employee', filters: filters, columns: columns
            }).run().getRange({start: 0, end: 100});
            var userData = {};
            if(results && results.length > 0) {
                for(var j = 0; j < results.length; j++) {
                    var fsid = results[j].getValue(columns[0]);
                    if(!userData[fsid]) {
                        userData[fsid] = results[j].id;
                    }
                }
            }
            return userData;
        }

        /**
         * 飞书 采购申请|付款申请 拉取飞书审批状态----暂时启用（临时）
         */
        function getFsAuditStatusToNS(options){
            var outArr = options.output._output_;
            var formJson = options.output.form;//审批内容{"actulPpaytime":actulPpaytime,"apwfTaxcode":apwfTaxcode}
            if(outArr.length <= 0)return;
            var approval_code = options.output.approval_code;
            var id = options.output.id;
            log.audit("Business-getFsAuditStatus-form",formJson);
            log.audit("Business-getFsAuditStatus-outArr",outArr);

            var buyerJson = {};//提交人
            for(var i=0;i<outArr.length;i++){
                var instance_code =outArr[i].instance_code || "";
                var buyerId =outArr[i].buyerId || "";
                if(buyerId && instance_code)buyerJson[instance_code]= buyerId;
            }
            log.audit("buyerJson",buyerJson);

            var outUserJson = {};//审批人  格式：{instance_code1:userName,instance_code2:userName2,...}

            var userIdArr = [];//飞书员工ID数组
            //将所有飞书员工id放入数组中
            for(var i=0;i<outArr.length;i++){
                var user_id =outArr[i].user_id || "";
                if(user_id)userIdArr.push(user_id);
            }
            var userIdJson = {};
            if(userIdArr.length > 0){
                userIdJson = Commons.srchEmployeeNameToNS(userIdArr);
            }

            //采购申请
            if(approval_code == SWC_CONFIG_DATA.configData().FS_APPROVAL_TEMPLATE_PURCH_APPLY){
                log.audit("Business-getFsAuditStatus采购申请-output",options.output);
                if(!id)throw new Error("采购申请ID不存在！");
                try{
                    //查询采购申请单
                    var poRequestRecord = record.load({type:"customrecord_swc_purchase_request",id:id});
                    var outJson = {};//instance_code  格式：{instance_code1:status1,instance_code2:status2,...}

                    //将返回的code和状态放入JSON中
                    for(var i=0;i<outArr.length;i++){
                        var status = outArr[i].status || "";
                        var instance_code =outArr[i].instance_code || "";
                        var user_id =outArr[i].user_id || "";
                        var userName = "";//审批人
                        var unatived = "";//员工-是否旧系统停用字段
                        var empId = "";//员工内部ID
                        log.audit("userIdJson",userIdJson);
                        if(user_id){
                            userName = userIdJson[user_id]["name"] || "";
                            unatived = userIdJson[user_id]["unatived"] || "";
                            empId = userIdJson[user_id]["internalid"] || "";
                        }
                        if(status && instance_code){
                            if(status == "PENDING")status = SWC_CONFIG_DATA.configData().WORKFLOW_STATUS_FS_APPROVAL;
                            if(status == "APPROVED")status = SWC_CONFIG_DATA.configData().WORKFLOW_STATUS_FS_APPROVAL_FINISH;
                            if(status == "REJECTED" || status == "CANCELED" || status == "DELETED")status = SWC_CONFIG_DATA.configData().WORKFLOW_STATUS_FS_APPROVAL_REJECT;
                            outJson[instance_code] = status;//审批状态
                            outUserJson[instance_code] = {};
                            outUserJson[instance_code]["name"] = userName;//审批人
                            outUserJson[instance_code]["unatived"] = unatived;//审批人-是否旧系统停用
                            outUserJson[instance_code]["empId"] = empId;//审批人（员工）内部ID
                        }
                    }
                    log.audit("outUserJson",outUserJson);
                    var poRequestRecordCount = poRequestRecord.getLineCount({sublistId:"recmachcustrecord_prs_field"});
                    log.audit("Business-getFsAuditStatus-outJson",outJson);
                    if(poRequestRecordCount>0){
                        var prsPro = "";//项目
                        var flag = true;//如果子列表数据全都是审批通过状态，则设置为true，否则为false
                        for(var j = 0; j < poRequestRecordCount; j++) {
                            var nsInstanceCode = poRequestRecord.getSublistValue({fieldId:"custrecord_prs_ns_approval",sublistId:"recmachcustrecord_prs_field",line:j});//采购审批中间表
                            log.audit("nsInstanceCode",nsInstanceCode);
                            var nsLineStatus = poRequestRecord.getSublistValue({fieldId:"custrecord_prs_line_status",sublistId:"recmachcustrecord_prs_field",line:j});//审批状态
                            var oldEmpId = poRequestRecord.getSublistValue({fieldId:"custrecord_prs_approver",sublistId:"recmachcustrecord_prs_field",line:j,});//hang审批人
                            //如果code存在并且审批状态为审批中或者驳回状态，则更新该行数据的审批状态
                            if(outJson[nsInstanceCode]){
                                prsPro = poRequestRecord.getSublistValue({fieldId:"custrecord_prs_pro",sublistId:"recmachcustrecord_prs_field",line:j});//项目
                                if(nsLineStatus == SWC_CONFIG_DATA.configData().WORKFLOW_STATUS_FS_APPROVAL || nsLineStatus == SWC_CONFIG_DATA.configData().WORKFLOW_STATUS_FS_APPROVAL_REJECT)
                                    poRequestRecord.setSublistValue({fieldId:"custrecord_prs_line_status",sublistId:"recmachcustrecord_prs_field",line:j,value:outJson[nsInstanceCode]});//审批状态
                                if(outUserJson[nsInstanceCode]["name"])poRequestRecord.setSublistValue({fieldId:"custrecord_prs_approver",sublistId:"recmachcustrecord_prs_field",line:j,value:outUserJson[nsInstanceCode]["name"]});//审批人
                                //更改审批状态后发送邮件
                                var statusInfo = "";
                                if(outJson[nsInstanceCode] == SWC_CONFIG_DATA.configData().WORKFLOW_STATUS_FS_APPROVAL_FINISH)statusInfo = "Under approval in Netsuite";//审批完成
                                if(outJson[nsInstanceCode] == SWC_CONFIG_DATA.configData().WORKFLOW_STATUS_FS_APPROVAL_REJECT)statusInfo = "Rejected in Netsuite";//审批驳回
                                if(outJson[nsInstanceCode] == SWC_CONFIG_DATA.configData().WORKFLOW_STATUS_FS_APPROVAL)statusInfo = "Under approval in Netsuite";//审批中
                                log.audit("采购申请-发送邮件-1",statusInfo+","+buyerJson[nsInstanceCode]+","+outUserJson[nsInstanceCode]["empId"]);
                                log.audit("采购申请-发送邮件-2oldSubStatus-new",nsLineStatus+","+outJson[nsInstanceCode]);
                                var scheme = 'https://';
                                var host = url.resolveDomain({ hostType: url.HostType.APPLICATION });
                                var relativePath = url.resolveRecord({ recordType: 'customrecord_swc_pr_wf', recordId: nsInstanceCode, isEditMode: false });
                                var outputUrl = scheme + host + relativePath;//采购申请审批URL
                                log.audit("采购申请单outputUrl",outputUrl);
                                //中英文翻译：
                                //审批中：Under approval in Netsuite
                                //审批完成：Approval completed in Netsuite
                                //审批驳回：Rejected in Netsuite
                                //如果是审批中，审批完成 审批驳回 并且更改之前的状态和之后的状态不一致 则发邮件
                                if(statusInfo && buyerJson[nsInstanceCode] && outUserJson[nsInstanceCode]["empId"] && nsLineStatus != outJson[nsInstanceCode]){
                                    if(statusInfo =="Approval completed in Netsuite" || statusInfo=="Rejected in Netsuite"){//审批完成 审批驳回
                                        email.send({
                                            //author: buyerJson[nsInstanceCode],//提交人 outUserJson[nsInstanceCode]["empId"],//审批人
                                            author: 16981,//固定该员工
                                            recipients: buyerJson[nsInstanceCode],//提交人
                                            subject: "Purchase requisition approval has been processed",//采购申请单审批操作已处理
                                            body: "Purchase requisition Internal ID:"+id+". The approval of the corresponding purchase requisition table ID:"+nsInstanceCode+"has been processed. The approval status is:"+statusInfo+"."+outputUrl//"采购申请内部ID："+id+"。对应的采购审批中间表ID:"+nsInstanceCode+"的审批操作已处理。审批状态为："+statusInfo+"。"+outputUrl
                                        });
                                        log.audit("邮件发送成功-采购申请-审批完成/驳回",buyerJson[nsInstanceCode]);
                                    }
                                }
                                if(statusInfo && buyerJson[nsInstanceCode] && outUserJson[nsInstanceCode]["empId"]) {
                                    log.audit("新旧审批人",outUserJson[nsInstanceCode]["name"]+","+oldEmpId);
                                    if(statusInfo =="Under approval in Netsuite" && outUserJson[nsInstanceCode]["name"]!=oldEmpId){//审批中
                                        email.send({
                                            //author: buyerJson[nsInstanceCode],//提交人 outUserJson[nsInstanceCode]["empId"],//审批人
                                            author: 16981,//固定该员工16981
                                            recipients: outUserJson[nsInstanceCode]["empId"],//审批人
                                            subject: "Purchase requisition approval has been processed",//采购申请单审批操作已处理
                                            body: "Purchase requisition Internal ID:"+id+". The approval of the corresponding purchase requisition table ID:"+nsInstanceCode+"has been processed. The approval status is:"+statusInfo+"."+outputUrl//"采购申请内部ID："+id+"。对应的采购审批中间表ID:"+nsInstanceCode+"的审批操作已处理。审批状态为："+statusInfo+"。"+outputUrl
                                        });
                                        log.audit("邮件发送成功-采购申请-审批中",outUserJson[nsInstanceCode]["name"]);
                                    }
                                }


                                //如果该审批人的【是否旧系统停用】字段为ture 则发送邮件
                                log.audit("采购申请发送邮件",outUserJson[nsInstanceCode]["unatived"] +","+ outUserJson[nsInstanceCode]["empId"]  +","+ buyerJson[nsInstanceCode]);
                                if(outUserJson[nsInstanceCode]["unatived"] && outUserJson[nsInstanceCode]["empId"] &&buyerJson[nsInstanceCode]){
                                    log.audit("发送邮件",outUserJson[nsInstanceCode]["empId"]);
                                    email.send({
                                        //author: buyerJson[nsInstanceCode],//提交人
                                        author: 16981,//固定该员工
                                        recipients: outUserJson[nsInstanceCode]["empId"],//审批人
                                        subject: "Purchase Requisition/Payment Requisition approval",//采购申请单/付款申请单审批
                                        body: "There are purchase requisition/payment requisition waiting for your approval in NetSuite system, please deal with it."//"在旧飞书系统中存在待您审批的采购申请单/付款申请单，请处理。"
                                    });
                                }
                            }
                            var nsNewLineStatus = poRequestRecord.getSublistValue({fieldId:"custrecord_prs_line_status",sublistId:"recmachcustrecord_prs_field",line:j});//审批状态
                            //如果子列表审批状态有不是【审批通过】的，将flag设置为false
                            if(nsNewLineStatus != SWC_CONFIG_DATA.configData().WORKFLOW_STATUS_FS_APPROVAL_FINISH && flag == true)flag = false;
                        }
                        log.audit("prsPro",prsPro);
                        //如果子列表审批状态都通过了 则创建采购订单
                        if(flag == true){
                            //根据采购申请创建采购订单
                            var poId = createPo(poRequestRecord,id,prsPro);
                            log.audit("Business-getFsAuditStatus-poId",poId);
                            if(poId){
                                var poRec = record.load({id:poId,type:record.Type.PURCHASE_ORDER});
                                var poCode = poRec.getValue({fieldId:"tranid"});//采购订单号
                                poRequestRecord.setValue({fieldId:"custrecord_pr_finish_allpo",value:true});//如果采购订单创建成功 勾选 是否全部生成采购订单 字段
                                //将PO单号存入子列表中的每个采购订单单号上，更改审批状态为【采购订单已创建】
                                for(var k = 0; k < poRequestRecordCount; k++) {
                                    poRequestRecord.setSublistValue({fieldId:"custrecord_prs_ponum",sublistId:"recmachcustrecord_prs_field",line:k,value:poId});//采购订单
                                    if(poCode){
                                        //截取采购订单号#之后的字符串
                                        var index = poCode.indexOf("#");
                                        var poCoderes = poCode.substr(index + 1,poCode.length);
                                        poRequestRecord.setSublistValue({fieldId:"custrecord_prs_potext",sublistId:"recmachcustrecord_prs_field",line:k,value:poCoderes});//采购订单号
                                    }
                                    poRequestRecord.setSublistValue({fieldId: "custrecord_prs_line_status", sublistId: "recmachcustrecord_prs_field", line: k, value: SWC_CONFIG_DATA.configData().WORKFLOW_STATUS_PURCH_ORD_CREATED});//审批状态
                                }

                            }
                        }

                        // 设置【是否提交】为true，采购申请单根据【是否提交】字段执行校验，true的场合当前单据推送能够被执行
                        poRequestRecord.setValue({fieldId: "custrecord_pr_submit_flag", value: true});
                        // 设置【是否推送已驳回数据】，设置false，已驳回数据不会重新推送
                        poRequestRecord.setValue({fieldId: "custrecord_pr_refuse_flag", value: false});
                        poRequestRecord.save();//保存采购申请
                    }
                }catch (e){
                    throw "采购申请报错，报错信息："+e.message;
                }
            }

            //供应商付款申请
            if(approval_code == SWC_CONFIG_DATA.configData().FS_APPROVAL_TEMPLATE_VENDOR_ACCT_APPLY) {
                log.audit("Business-getFsAuditStatus供应商付款申请-output", options.output);
                if (!id) throw new Error("供应商付款申请单内部ID不存在！");
                try {
                    //var formJson = JSON.parse(form);//审批内容JSON
                    // var resultJson = {};//格式：{""付款时间（财务填写）"":xxx,"名称":xxxx,...}
                    //将审批内容中： 以字段name为key，字段值为value存入resultJson中
                    // for(var i = 0; formJson.length > 0 && i < formJson.length; i++) {
                    //     //var fieldId = formJson[i].custom_id;
                    //     var fieldName = formJson[i].name;
                    //     var fieldValue = formJson[i].value;
                    //     resultJson[fieldName] = fieldValue;
                    // }
                    //log.audit({title:"resultJson",details:resultJson});
                    //var realpaydate = "";
                    // if(resultJson["付款时间（财务填写）"]){
                    //     realpaydate = resultJson["付款时间（财务填写）"];
                    //     realpaydate = realpaydate.slice(0,10);//截取到年月日
                    // }
                    //var getRealpaydate = getModifyDate(realpaydate)//付款时间（财务填写）
                    var getRealpaydate = formJson["actulPpaytime"]//付款时间（财务填写）
                    //查询供应商账单申请单
                    var accountpayRecord = record.load({type: "customrecord_swc_account_payable", id: id});
                    //20231007  start jjp+
                    var taxRate = formJson["apwfTaxcode"];//税码值
                    log.audit("taxRate",taxRate);
                    accountpayRecord.setValue({fieldId:"custrecord_ap_taxcode",value:taxRate});//供应商账单申请赋值税码字段
                    accountpayRecord.save();
                    var accountpayRecord = record.load({type: "customrecord_swc_account_payable", id: id});
                    //20231007  end jjp+
                    var outJson = {};//格式： {instance_code1:status1,instance_code2:status2,...}
                    //将返回的code和状态放入JSON中
                    for (var i = 0; i < outArr.length; i++) {
                        var status = outArr[i].status || "";
                        var instance_code = outArr[i].instance_code || "";
                        var user_id = outArr[i].user_id || "";
                        var userName = "";//审批人
                        var unatived = "";//员工-是否旧系统停用字段
                        var empId = "";//员工内部ID
                        log.audit("userIdJson",userIdJson);
                        if(user_id){
                            userName = userIdJson[user_id]["name"] || "";
                            unatived = userIdJson[user_id]["unatived"] || "";
                            empId = userIdJson[user_id]["internalid"] || "";
                        }
                        if (status && instance_code) {
                            if (status == "PENDING") status = SWC_CONFIG_DATA.configData().BILL_APPROVAL_STATUS_FS_APPROVAL;
                            if (status == "APPROVED") status = SWC_CONFIG_DATA.configData().BILL_APPROVAL_STATUS_FS_APPROVAL_FINISH;
                            if (status == "REJECTED" || status == "CANCELED" || status == "DELETED") status = SWC_CONFIG_DATA.configData().BILL_APPROVAL_STATUS_FS_APPROVAL_REJECT;
                            outJson[instance_code] = status;
                            outUserJson[instance_code] = {};
                            outUserJson[instance_code]["name"] = userName;//审批人
                            outUserJson[instance_code]["unatived"] = unatived;//审批人-是否旧系统停用
                            outUserJson[instance_code]["empId"] = empId;//审批人（员工）内部ID

                        }
                    }
                    log.audit("outUserJson",outUserJson);
                    var accountPayItemJson = {};//供应商账单申请子列表数据 格式： {itemId1：总金额1000,itemId2：总金额1001,...}
                    var paymentMethod = accountpayRecord.getValue({fieldId:"custrecord_ap_payment_method"});//供应商账单申请-付款方式
                    var expectedPaytime = accountpayRecord.getValue({fieldId:"custrecord_ap_expected_paytime"});//供应商账单申请-期望付款时间
                    var invoiceAttachment = accountpayRecord.getValue({fieldId:"custrecord_ap_invoice_attachment"});//供应商账单申请-发票附件
                    var invoiceAttachment2 = accountpayRecord.getValue({fieldId:"custrecord_ap_invoice_attachment2"});//供应商账单申请-发票附件2
                    var invoiceAttachment3 = accountpayRecord.getValue({fieldId:"custrecord_ap_invoice_attachment3"});//供应商账单申请-发票附件3
                    var description = accountpayRecord.getValue({fieldId:"custrecord_ap_reason_description"});//供应商账单申请-事由描述
                    var invoiceNo = accountpayRecord.getValue({fieldId:"custrecord_ap_invoiceno"});//供应商账单申请-INVOICE NUMBER
                    // 20250423 HC add 结算单等其他支持性文件
                    var otherAttachment = accountpayRecord.getValue({fieldId:"custrecord_ap_other_supportdoc"});//供应商账单申请-结算单等其他支持性文件

                    var accountpayCount = accountpayRecord.getLineCount({sublistId: "recmachcustrecord_aps_field"});
                    log.audit("outJson",outJson);
                    if (accountpayCount > 0) {
                        var apsPro = "";//项目
                        var flag = true;//如果子列表数据全都是审批通过状态，则设置为true，否则为false
                        for (var j = 0; j < accountpayCount; j++) {
                            var nsInstanceCode = accountpayRecord.getSublistValue({fieldId: "custrecord_aps_ns_approval", sublistId: "recmachcustrecord_aps_field", line: j});//采购申审批中间表
                            log.audit("nsInstanceCode",nsInstanceCode);
                            var nsLineStatus = accountpayRecord.getSublistValue({fieldId: "custrecord_aps_line_status", sublistId: "recmachcustrecord_aps_field", line: j});//审批状态
                            log.audit("nsLineStatus",nsLineStatus);
                            //如果code存在并且旧审批状态为审批中或者驳回状态，则更新该行数据的审批状态
                            if (outJson[nsInstanceCode]) {
                                apsPro = accountpayRecord.getSublistValue({fieldId:"custrecord_aps_pro",sublistId:"recmachcustrecord_aps_field",line:j});//项目
                                if (nsLineStatus == SWC_CONFIG_DATA.configData().BILL_APPROVAL_STATUS_FS_APPROVAL || nsLineStatus == SWC_CONFIG_DATA.configData().BILL_APPROVAL_STATUS_FS_APPROVAL_REJECT) {
                                    var oldEmpId = accountpayRecord.getSublistValue({fieldId:"custrecord_aps_approver",sublistId:"recmachcustrecord_aps_field",line:j});//hang审批人
                                    accountpayRecord.setSublistValue({fieldId: "custrecord_aps_line_status", sublistId: "recmachcustrecord_aps_field", line: j, value: outJson[nsInstanceCode]});//审批状态
                                    accountpayRecord.setSublistValue({fieldId:"custrecord_aps_approver",sublistId:"recmachcustrecord_aps_field",line:j,value: outUserJson[nsInstanceCode]["name"]});//hang审批人
                                    //更改审批状态后发送邮件
                                    var statusInfo = "";
                                    if (outJson[nsInstanceCode] == SWC_CONFIG_DATA.configData().BILL_APPROVAL_STATUS_FS_APPROVAL_FINISH) statusInfo = "Approval completed in Netsuite";//审批完成
                                    if (outJson[nsInstanceCode] == SWC_CONFIG_DATA.configData().BILL_APPROVAL_STATUS_FS_APPROVAL_REJECT) statusInfo = "Rejected in Netsuite";//审批驳回
                                    if (outJson[nsInstanceCode] == SWC_CONFIG_DATA.configData().BILL_APPROVAL_STATUS_FS_APPROVAL) statusInfo = "Under approval in Netsuite";//审批中
                                    log.audit("供应商申请发送邮件", outUserJson[nsInstanceCode]["empId"] + "," + buyerJson[nsInstanceCode]);
                                    log.audit("供应商申请-发送邮件-2oldSubStatus-new", nsLineStatus + "," + outJson[nsInstanceCode]);
                                    var scheme = 'https://';
                                    var host = url.resolveDomain({hostType: url.HostType.APPLICATION});
                                    var relativePath = url.resolveRecord({
                                        recordType: 'customrecord_swc_ap_wf',
                                        recordId: nsInstanceCode,
                                        isEditMode: false
                                    });
                                    var outputUrl = scheme + host + relativePath;//采购申请审批URL
                                    //中英文翻译：
                                    //审批中：Under approval in Netsuite
                                    //审批完成：Approval completed in Netsuite
                                    //审批驳回：Rejected in Netsuite
                                    log.audit("供应商付款申请单outputUrl", outputUrl);
                                    if (statusInfo && buyerJson[nsInstanceCode] && outUserJson[nsInstanceCode]["empId"] && nsLineStatus != outJson[nsInstanceCode]) {
                                        if (statusInfo == "Approval completed in Netsuite" || statusInfo == "Rejected in Netsuite") {//审批完成 审批驳回
                                            email.send({
                                                //author: buyerJson[nsInstanceCode],//提交人 outUserJson[nsInstanceCode]["empId"],//审批人
                                                author: 16981,//固定该员工
                                                recipients: buyerJson[nsInstanceCode],//提交人
                                                subject: "Supplier Payment Requisition approval has been processed",//供应商付款申请单审批操作已处理
                                                body: "Supplier payment requisition Internal ID: " + id + ". The approval of the corresponding purchase payment Requisition table ID:" + nsInstanceCode + "has been processed. The approval status is:" + statusInfo + "." + outputUrl //"供应商付款申请内部ID：" + id + "。对应的采购付款审批中间表ID:" + nsInstanceCode + "的审批操作已处理。审批状态为：" + statusInfo + "。" + outputUrl
                                            });
                                            log.audit("邮件发送成功-供应商付款申请-审批完成/驳回", buyerJson[nsInstanceCode]);
                                        }
                                    }
                                    log.audit("11111",statusInfo+","+buyerJson[nsInstanceCode]+","+outUserJson[nsInstanceCode]["empId"]);
                                    if(statusInfo && buyerJson[nsInstanceCode] && outUserJson[nsInstanceCode]["empId"]) {
                                        log.audit("新旧审批人",outUserJson[nsInstanceCode]["name"]+","+oldEmpId);
                                        if (statusInfo == "Under approval in Netsuite"&& outUserJson[nsInstanceCode]["name"]!=oldEmpId) {//审批中
                                            email.send({
                                                //author: buyerJson[nsInstanceCode],//提交人 outUserJson[nsInstanceCode]["empId"],//审批人
                                                author: 16981,//固定该员工
                                                recipients: outUserJson[nsInstanceCode]["empId"],//审批人
                                                subject: "Supplier Payment Requisition approval has been processed",//"供应商付款申请单审批操作已处理"
                                                body: "Supplier payment requisition Internal ID: " + id + ". The approval of the corresponding purchase payment Requisition table ID:" + nsInstanceCode + "的has been processed. The approval status is:" + statusInfo + "." + outputUrl //"供应商付款申请内部ID：" + id + "。对应的采购付款审批中间表ID:" + nsInstanceCode + "的审批操作已处理。审批状态为：" + statusInfo + "。" + outputUrl
                                            });
                                            log.audit("邮件发送成功-供应商付款申请-审批中", outUserJson[nsInstanceCode]["empId"]);
                                        }
                                    }

                                }
                            }
                            var nsNewLineStatus = accountpayRecord.getSublistValue({fieldId: "custrecord_aps_line_status", sublistId: "recmachcustrecord_aps_field", line: j});//审批状态
                            //如果子列表审批状态有不是【审批通过】的，将flag设置为false
                            if (flag == true && nsNewLineStatus != SWC_CONFIG_DATA.configData().BILL_APPROVAL_STATUS_FS_APPROVAL_FINISH && nsNewLineStatus != SWC_CONFIG_DATA.configData().BILL_APPROVAL_STATUS_BILL_CREATED) flag = false;

                            var nsItemId = accountpayRecord.getSublistValue({fieldId: "custrecord_aps_item", sublistId: "recmachcustrecord_aps_field", line: j});//飞货品
                            var nsTotalAmount = accountpayRecord.getSublistValue({fieldId: "custrecord_aps_totalamount", sublistId: "recmachcustrecord_aps_field", line: j});//总金额
                            //if(nsItemId && nsTotalAmount)accountPayItemJson[nsItemId] = Number(nsTotalAmount);
                            //相同货品 金额加和
                            if(nsItemId && nsTotalAmount){
                                if(accountPayItemJson[nsItemId]){
                                    accountPayItemJson[nsItemId] = Number(accountPayItemJson[nsItemId]) + Number(nsTotalAmount);
                                }else {
                                    accountPayItemJson[nsItemId] = Number(nsTotalAmount);
                                }
                            }
                        }

                        var custrecord_ap_billnum = accountpayRecord.getValue({fieldId : "custrecord_ap_billnum"});//账单单号
                        log.audit("apsPro",apsPro);
                        log.audit("flag",flag);
                        //如果子列表审批状态都通过了并且账单单号为空 则创账单
                        if (flag == true && !custrecord_ap_billnum) {
                            var vendorBillId = "";
                            //如果供应商账单申请中的采购订单字段存在 则通过该采购订单生成账单
                            var poId = accountpayRecord.getValue({fieldId:"custrecord_ap_number"});//采购订单id
                            //如果供应商账单申请中的付款方式为 信用卡 则 不创建账单
                            if(paymentMethod != SWC_CONFIG_DATA.configData().VENDOR_BILL_PAYMENT_METHOD_CARD){
                                log.audit("poId",poId);
                                if(poId){
                                    //在生成账单之前 把采购订单货品行所有货品 数量+1 总金额不变
                                    var poRec = record.load({id:poId,type:record.Type.PURCHASE_ORDER});//采购订单
                                    var poCount = poRec.getLineCount({sublistId:"item"});//行数
                                    if(poCount >0){
                                        for(var j=0;j<poCount;j++){
                                            var poNum = poRec.getSublistValue({sublistId:"item",fieldId:"quantity",line:j});//货品数量
                                            var amount = poRec.getSublistValue({sublistId:"item",fieldId:"amount",line:j});//总金额
                                            var quantity = parseInt(poNum)+1;
                                            var rate = (amount/quantity).toFixed(2);
                                            poRec.setSublistValue({sublistId:"item",fieldId:"quantity",value:quantity,line:j});
                                            poRec.setSublistValue({sublistId:"item",fieldId:"rate",value:rate,line:j});
                                            poRec.setSublistValue({sublistId:"item",fieldId:"amount",value:amount,line:j});
                                        }
                                        poRec.save();
                                    }
                                    //根据采购订单生成账单
                                    var vendorBillRecord = record.transform({
                                        fromType: record.Type.PURCHASE_ORDER,
                                        fromId: poId,
                                        toType: record.Type.VENDOR_BILL,
                                        isDynamic: true,
                                    });
                                    var deptCostcenterJson = Commons.srchDepartmentCostcenterid();//查询【部门】 Cost Center ID + Name字段JSON
                                    if(paymentMethod)vendorBillRecord.setValue({fieldId:"custbody_swc_payway",value:paymentMethod});//账单-付款方式
                                    if(expectedPaytime)vendorBillRecord.setValue({fieldId:"custbody_swc_repaydate",value:expectedPaytime});//账单-预计付款日期
                                    if(getRealpaydate)vendorBillRecord.setValue({fieldId:"custbody_swc_paydate",value:getRealpaydate});//实际付款日期
                                    var vendorId = vendorBillRecord.getValue({fieldId:"entity"});//供应商ID
                                    var companyname = "";
                                    var companynameObj = search.lookupFields({type: search.Type.VENDOR, id: vendorId, columns: ['companyname']});//供应商名称
                                    if(companynameObj && companynameObj.companyname)companyname = companynameObj.companyname;
                                    var newDescription = "";
                                    if(poCount==1){
                                        vendorBillRecord.selectLine({sublistId: 'item',line:0});
                                        var itemName = vendorBillRecord.getCurrentSublistText({sublistId: 'item', fieldId: 'item'});//费用类型
                                        if(itemName){
                                            newDescription = "Bill_"+companyname+"_"+description+"/"+itemName;
                                        }else {
                                            newDescription = "Bill_"+companyname+"_"+description;
                                        }
                                    }else {
                                        newDescription = "Bill_"+companyname+"_"+description;
                                    }
                                    if(newDescription && newDescription.length>=999){
                                        vendorBillRecord.setValue({fieldId:"custbody_swc_bill_longmemo",value:newDescription});//备注
                                        vendorBillRecord.setValue({fieldId:"memo",value:newDescription.slice(0,990)});//备注
                                    }else if(newDescription){
                                        vendorBillRecord.setValue({fieldId:"memo",value:newDescription});//备注

                                    }
                                    if(invoiceNo)vendorBillRecord.setValue({fieldId:"custbody_swc_invoice_number",value:invoiceNo});//INVOICE NUMBER
                                    //生成账单时，通过供应商id查询 【供应商银行信息】record，将第一条数据赋值到 账单中（【账单供应商信息】record）
                                    if(vendorId)createVenBankInfoByVendorId(vendorBillRecord,vendorId);
                                    //如果供应商账单申请 中存在 采购订单 则生成账单之后，根据采购订单id 查询【采购相关文件】record，将【相关应付账单】字段赋值到【采购相关文件】
                                    var floderArr = Commons.schFloderIdByPoId(poId);
                                    log.audit("floderArr",floderArr);
                                    if(floderArr.length >0){
                                        //将文件赋值到账单子列表【采购文件合同】中
                                        for(var k=0;k<floderArr.length;k++){
                                            var venRecord = vendorBillRecord.selectNewLine({sublistId: 'recmachcustrecord_folder_bill'});
                                            vendorBillRecord.setCurrentSublistValue({sublistId:"recmachcustrecord_folder_bill",fieldId:"custrecord_folder_one",value:floderArr[k]});
                                            venRecord.commitLine({sublistId: 'recmachcustrecord_folder_bill'});
                                        }
                                    }
                                    //如果发票附件存在，则将发票附件字段值赋值到【采购文件合同】中
                                    if(invoiceAttachment){
                                        var venRecord = vendorBillRecord.selectNewLine({sublistId: 'recmachcustrecord_folder_bill'});
                                        vendorBillRecord.setCurrentSublistValue({sublistId:"recmachcustrecord_folder_bill",fieldId:"custrecord_folder_one",value:invoiceAttachment});
                                        venRecord.commitLine({sublistId: 'recmachcustrecord_folder_bill'});
                                    }
                                    if(invoiceAttachment2){
                                        var venRecord = vendorBillRecord.selectNewLine({sublistId: 'recmachcustrecord_folder_bill'});
                                        vendorBillRecord.setCurrentSublistValue({sublistId:"recmachcustrecord_folder_bill",fieldId:"custrecord_folder_one",value:invoiceAttachment2});
                                        venRecord.commitLine({sublistId: 'recmachcustrecord_folder_bill'});
                                    }if(invoiceAttachment3){
                                        var venRecord = vendorBillRecord.selectNewLine({sublistId: 'recmachcustrecord_folder_bill'});
                                        vendorBillRecord.setCurrentSublistValue({sublistId:"recmachcustrecord_folder_bill",fieldId:"custrecord_folder_one",value:invoiceAttachment3});
                                        venRecord.commitLine({sublistId: 'recmachcustrecord_folder_bill'});
                                    }
                                    // 供应商申请-结算单等其他支持性文件添加到账单【采购文件合同】中
                                    if (otherAttachment) {
                                        var venRecord = vendorBillRecord.selectNewLine({sublistId: 'recmachcustrecord_folder_bill'});
                                        vendorBillRecord.setCurrentSublistValue({sublistId:"recmachcustrecord_folder_bill",fieldId:"custrecord_folder_one",value:otherAttachment});
                                        venRecord.commitLine({sublistId: 'recmachcustrecord_folder_bill'});
                                    }
                                    log.audit("accountPayItemJson",accountPayItemJson);
                                    //将【供应商账单申请】子列表下的对应货品金额赋值到【账单】的对应货品金额
                                    for (var l = 0; l < poCount; l++){
                                        vendorBillRecord.selectLine({sublistId: 'item',line:l});
                                        var itemId = vendorBillRecord.getCurrentSublistValue({sublistId: 'item', fieldId: 'item'});//账单-货品

                                        //如果税码不为0或者不为空时，税码=货币对应的税码
                                        if(taxRate!="0%" && taxRate){
                                            //飞书税率及单据明细task2383
                                            //var salesTaxSubsidiaryJson = Commons.srchSubsidiaryBySalesTax();//查询【税码】下的数据 {"subsidiary":{"子公司1":10%,...} ,"subsidiaryId":{10%:内部ID1,...}
                                            var subsidiaryId = vendorBillRecord.getValue({fieldId:"subsidiary"});//子公司ID
                                            var TaxCodeAndCurrJson = {};
                                            if(9 == subsidiaryId){
                                                TaxCodeAndCurrJson = Commons.srchTaxCodeAndCurrJPY(subsidiaryId);//查询【税码】下的【税码对应币种】和【税率】
                                            } else {
                                                TaxCodeAndCurrJson = Commons.srchTaxCodeAndCurr();//查询【税码】下的【税码对应币种】和【税率】
                                            }
                                            var subsidiary = accountpayRecord.getValue({fieldId:"custrecord_ap_subsidary"});
                                            var currency = accountpayRecord.getValue({fieldId:"custrecord_ap_currency"});
                                            log.audit("taxRate",taxRate);
                                            log.audit("TaxCodeAndCurrJson",TaxCodeAndCurrJson);
                                            log.audit("subsidiary",subsidiary);
                                            log.audit("currency",currency);
                                            //如果飞书的税码在付款主体对应的【税码】表中存在并且币种不为美金，则赋值该税码
                                            // if(currency != "2" && salesTaxSubsidiaryJson["subsidiary"][subsidiary].length>0 && salesTaxSubsidiaryJson["subsidiary"][subsidiary].indexOf(taxRate)!=-1){
                                            //     var taxCodeId =  salesTaxSubsidiaryJson["subsidiaryId"][taxRate];//税码内部ID
                                            //     log.audit("taxCodeId",taxCodeId);
                                            //     vendorBillRecord.setCurrentSublistValue({sublistId: 'item', fieldId: 'taxcode', value: taxCodeId})// 税码
                                            // }
                                            if(currency != "2" && TaxCodeAndCurrJson.hasOwnProperty(taxRate+"_"+currency)){
                                                var taxCodeId =  TaxCodeAndCurrJson[taxRate+"_"+currency];//税码内部ID
                                                log.audit("taxCodeId",taxCodeId);
                                                vendorBillRecord.setCurrentSublistValue({sublistId: 'item', fieldId: 'taxcode', value: taxCodeId})// 税码
                                            }
                                        }

                                        var totalAmount = 0;//总金额
                                        if(accountPayItemJson[itemId])totalAmount = accountPayItemJson[itemId];
                                        log.audit("totalAmount",totalAmount);
                                        if(totalAmount){
                                            var quantity = vendorBillRecord.getCurrentSublistValue({sublistId: 'item', fieldId: 'quantity'});//账单-数量
                                            //如果公司本位币为日元(付款主体为9PingCAP 株式会社)，币种为日元，明细税码设置完需要对税金进行小数位舍去，总金额保持不变，倒算未税金额（总金额-舍去后税金）及单价（单价除不尽保留6位小数）。
                                            if(subsidiary =="9" && currency == "6"){
                                                var tax = 0;
                                                if(taxRate)tax = Number(taxRate.replace("%",""))/100;
                                                log.audit("tax",tax);
                                                var amount = Number(totalAmount)/(1+tax);
                                                var tax1amt =  Number(totalAmount)-amount;
                                                vendorBillRecord.setCurrentSublistValue({sublistId: 'item', fieldId: 'amount',value: amount});// 未税金额
                                                vendorBillRecord.setCurrentSublistValue({sublistId: 'item', fieldId: 'tax1amt',value: tax1amt});// 税额
                                                var rate = 0;//单价
                                                if(totalAmount!=0 && quantity && quantity!=0)rate = (totalAmount/(1+tax)/quantity).toFixed(6);//单价 = 从【供应商账单申请】对应货品行取的总金额 / 账单数量
                                                log.audit("rate",rate);
                                                vendorBillRecord.setCurrentSublistValue({sublistId: 'item', fieldId: 'rate', value: rate});//账单-单价

                                            }else {
                                                vendorBillRecord.setCurrentSublistValue({sublistId: 'item', fieldId: 'rate',value: (totalAmount/quantity).toFixed(6)});// 单价
                                            }
                                            vendorBillRecord.setCurrentSublistValue({sublistId: 'item', fieldId: 'grossamt', value: totalAmount});//账单-总金额
                                        }else {
                                            vendorBillRecord.setCurrentSublistValue({sublistId: 'item', fieldId: 'rate', value: 0});// 单价
                                            vendorBillRecord.setCurrentSublistValue({sublistId: 'item', fieldId: 'grossamt',value: 0});// 总金额
                                        }
                                        var itemName = vendorBillRecord.getCurrentSublistText({sublistId: 'item', fieldId: 'item'});//费用类型
                                        var newDescription = "Bill_"+companyname+"_"+description+"/"+itemName;
                                        if(newDescription)vendorBillRecord.setCurrentSublistValue({sublistId: 'item', fieldId: 'description', value: newDescription});//账单-说明
                                        if(apsPro)vendorBillRecord.setCurrentSublistValue({sublistId: 'item', fieldId: 'cseg_swc_pro', value: apsPro});//项目

                                        var department = vendorBillRecord.getCurrentSublistValue({sublistId: 'item', fieldId: 'department'});//预算归属部门
                                        if(department){
                                            var costcenter = deptCostcenterJson[department];
                                            log.audit(" PO存在-COST CENTER ID + NAME",costcenter);
                                            if(costcenter)vendorBillRecord.setCurrentSublistValue({sublistId: 'item', fieldId: 'custcol_swc_cost_centerid', value: costcenter});//COST CENTER ID + NAME
                                        }

                                        vendorBillRecord.commitLine({sublistId: 'item'});
                                    }

                                    vendorBillId = vendorBillRecord.save();
                                    log.audit("根据采购订单生成vendorBillId",vendorBillId);

                                    // if(floderId && vendorBillId){
                                    //     var floderRec = record.load({id:floderId,type:"customrecord_swc_po_floder"});//【采购相关文件】
                                    //     floderRec.setValue({fieldId:"custrecord_folder_bill",value:vendorBillId});
                                    //     floderRec.save();
                                    // }
                                }else {
                                    //根据供应商账单申请生成账单
                                    vendorBillId = createvendorBillByAccountPay(accountpayRecord,getRealpaydate,paymentMethod,expectedPaytime,invoiceAttachment,invoiceAttachment2,invoiceAttachment3,description,apsPro,taxRate,otherAttachment);
                                }
                            }

                            //如果账单生成成功 将账单赋值到供应商账单申请的【账单单号】上
                            //if(vendorBillId){
                            if(vendorBillId)accountpayRecord.setValue({fieldId :"custrecord_ap_billnum",value:vendorBillId});//账单单号
                            //将审批状态更改为【账单已创建】
                            for (var k = 0; k < accountpayCount; k++) {
                                accountpayRecord.setSublistValue({fieldId: "custrecord_aps_line_status", sublistId: "recmachcustrecord_aps_field", line: k, value: SWC_CONFIG_DATA.configData().BILL_APPROVAL_STATUS_BILL_CREATED});//审批状态
                            }
                            //}
                        }
                        if(getRealpaydate){
                            var newTrandate = format.parse({value:new Date(format.parse({value: getRealpaydate,type:format.Type.DATE})),type:format.Type.DATE});
                            accountpayRecord.setValue({fieldId:"custrecord_ap_actul_paytime",value: newTrandate});//付款日期
                        }
                        accountpayRecord.save();//保存供应是账单申请单据
                    }
                }catch (e) {
                    throw "供应商账单申请报错，报错信息："+e.message;
                }
            }
        }

        /**
         *  根据供应商id查询【供应商银行信息】 将第一条数据赋值到 账单中
         *  @param {record} vendorBillRecord 账单
         *  @param {string} vendorId 供应商id
         */
        function createVenBankInfoByVendorId(vendorBillRecord,vendorId){
            var venJson = Commons.schVenBankInfoByVendorId(vendorId);//【供应商银行信息】JSON  根据供应商ID查询【供应商银行信息】记录
            if(venJson){
                var venRecord = vendorBillRecord.selectNewLine({sublistId: 'recmachcustrecord_bbn_billnum'});
                venRecord.setCurrentSublistValue({sublistId: 'recmachcustrecord_bbn_billnum', fieldId: 'custrecord_bbn_vendor_bankname', value:venJson.vendor_bankname});//VENDOR BANK NAME
                venRecord.setCurrentSublistValue({sublistId: 'recmachcustrecord_bbn_billnum', fieldId: 'custrecord_bbn_vendor_accountname', value:venJson.vendor_accountname});//BANK ACCOUNT NAME
                venRecord.setCurrentSublistValue({sublistId: 'recmachcustrecord_bbn_billnum', fieldId: 'custrecord_bbn_vendor_account', value: venJson.vendor_account});//BANK ACCOUNT NO.
                venRecord.setCurrentSublistValue({sublistId: 'recmachcustrecord_bbn_billnum', fieldId: 'custrecord_bbn_swiftcode', value: venJson.swiftcode});//SWIFT CODE
                venRecord.setCurrentSublistValue({sublistId: 'recmachcustrecord_bbn_billnum', fieldId: 'custrecord_bbn_routing_transit', value: venJson.routing_transit});//ROUTING & TRANSIT NO.
                venRecord.setCurrentSublistValue({sublistId: 'recmachcustrecord_bbn_billnum', fieldId: 'custrecord_bbn_bank_country', value: venJson.bank_country});//BANK COUNTRY
                venRecord.setCurrentSublistValue({sublistId: 'recmachcustrecord_bbn_billnum', fieldId: 'custrecord_bbn_bank_province', value: venJson.bank_province});//开户行省份/州
                venRecord.commitLine({sublistId: 'recmachcustrecord_bbn_billnum'});
            }
        }

        function timestampToTime(timestamp) {
            var date = new Date(timestamp);
            var Y = date.getFullYear() + "-";
            var M = (date.getMonth() + 1 < 10 ? "0" + (date.getMonth() + 1) : date.getMonth() + 1) + "-";
            var D = (date.getDate() < 10 ? "0" + date.getDate() : date.getDate()) + " ";
            var h = date.getHours() + ":";
            var m = date.getMinutes() + ":";
            var s = date.getSeconds();
            return Y + M + D + h + m + s;
        }

        function getDate(timeZone) {
            var date = new Date();
            var utcTime = date.getTime() + date.getTimezoneOffset() * 60 * 1000;
            var tzTime = utcTime + timeZone * 60 * 60 * 1000;
            return tzTime;
        }

        /**
         * tyl Salesforce Collection-更新发票接口
         */
        function updSalesforceCollection(options) {
            var output = options.output;
            var data = options.data;
            var invoiceRec = record.load({type: "invoice", id: data.code});
            // 发票未结清金额为0的场合，发票已全部结清，当前发票不再推送
            if (!output.remainAmt) {
                // 是否继续推送=false
                invoiceRec.setValue({fieldId: "custbody_swc_push_collection_flag", value: false});
            }
            // 更新推送状态为推送成功，推送COLLECTION状态=true
            invoiceRec.setValue({fieldId: "custbody_swc_collection_flag", value: true});

            invoiceRec.save();
        }
        //Commons.performBusinessProcessing
        //更新银企直联支付记录状态以及关联相关单据
        //customrecord_swc_payment_log
        //customrecord_swc_payment_platform
        /**
         * 支付业务:支付结果列表查询接口
         * @param options
         */
        function updatePaymentStatus(options)
        {
            var errmsg = options.output.errmsg;
            if(options.output && errmsg)
            {
                var yurref = options.output.yurref;
                if(!yurref)
                {
                    throw "支付业务:支付结果列表查询接口:" + errmsg;
                }
                var paymentPlatformId = checkPaymentPlatform(yurref);
                if(paymentPlatformId)
                {
                    record.submitFields({type:"customrecord_swc_payment_platform",id:paymentPlatformId,values:{"custrecord_swcpp_state":"7","custrecord_swcpp_err_msg":errmsg}});
                }
                return;
            }
            var message = "";
            var dataArray = options.output;
            util.each(dataArray,function (outJson,index) {
                try{
                    var externalId = outJson.YURREF;
                    // if(externalId.indexOf("-") >= 0)
                    // {
                    //     externalId = externalId.split("-")[0];
                    // }
                    var RTNFLG = outJson.RTNFLG;
                    /**
                     * RTNFLG
                     * S  成功  银行支付成功
                     * F  失败  银行支付失败
                     * B  退票  银行支付被退票
                     * R  否决  企业审批否决
                     * D  过期  企业过期不审批
                     * C  撤消  企业撤销
                     * @type {{}|{}|{}}
                     */
                    var paymentPlatformId = checkPaymentPlatform(externalId);
                    var receiptsLogId = Commons.searchByExternalId(externalId+"_"+RTNFLG, "customrecord_swc_payment_log");
                    var paymentLogRecord;
                    if(!receiptsLogId)
                    {
                        paymentLogRecord = record.create({type:"customrecord_swc_payment_log",isDynamic:true});
                        Commons.setFieldsValues(paymentLogRecord, {
                            "externalid" : externalId + "_" + RTNFLG,
                            "custrecord_swcpl_search_datetime" : outJson.OPRDAT,
                            "custrecord_swcpl_payonlylist" : outJson.YURREF,
                            "custrecord_swcpl_results" : JSON.stringify(outJson),
                            "custrecord_swcpl_parent" : paymentPlatformId,
                        }, false, true);
                        paymentLogRecord.setText({fieldId:"custrecord_swcpl_status", text:RTNFLG});
                        paymentLogRecord.save({enableSourcing:true,ignoreMandatoryFields:true});
                    }
                    if(paymentPlatformId)
                    {
                        var status;
                        /**
                         * RTNFLG
                         * S  成功  银行支付成功
                         * F  失败  银行支付失败
                         * B  退票  银行支付被退票
                         * R  否决  企业审批否决
                         * D  过期  企业过期不审批
                         * C  撤消  企业撤销
                         * @type {{}|{}|{}}
                         */
                        if(RTNFLG == "B")//退票  银行支付被退票
                        {
                            status = "2";
                        }
                        if(RTNFLG == "R")//否决  企业审批否决
                        {
                            status = "8";
                        }
                        if(RTNFLG == "D")//过期  企业过期不审批
                        {
                            status = "9";
                        }
                        if(RTNFLG == "C")//撤消  企业撤销
                        {
                            status = "10";
                        }
                        if(RTNFLG == "F")//失败  银行支付失败
                        {
                            status = "7";
                        }
                        if(status)
                        {
                            record.submitFields({type:"customrecord_swc_payment_platform",id:paymentPlatformId,values:{"custrecord_swcpp_state":status,"custrecord_swcpp_err_msg":outJson.errmsg}});
                        }
                    }
                }catch (e) {
                    message += externalId + " ：" + e.message + "\n";
                }
            });
            if(message)
            {
                throw message;
            }
        }
        function checkPaymentPlatform(YURREF)
        {

            var paymentPlatformId = "";
            var resultJson = Commons.searchByNameColumn("customrecord_swc_payment_platform", [YURREF], "custrecord_swcpp_tranid");
            {
                if(resultJson && Object.keys(resultJson).length > 0)
                {
                    paymentPlatformId = resultJson && resultJson[YURREF];
                }
            }
            return paymentPlatformId;
        }
        /**
         * 交易代码
         * 交易代码下载链接
         * https://u.ebank.cmbchina.com/CmbBank_GenShell/UI/Help/DCBank2/API.aspx?FLA/A09
         */
        /**
         * AMTCDR 借贷标记  C:贷；D:借
         * ETYDAT 交易发生日
         * ETYTIM 交易时间
         * TRSCOD 交易代码
         * AMTCDR 借贷标记 C:贷；D:借
         * TRSAMTC 贷方金额
         * TRSAMTD 借方金额
         * TRSBLV 余额
         * REFNBR 流水号
         * BUSNAM 业务名称
         * YURREF 业务参考号
         * RPYNAM 收/付方名称
         * RPYACC 收/付方帐号
         * RPYBNK 收/付方开户行名
         * RPYADR 收/付方开户行地址
         * INFFLG 信息标志 用于标识收/付方帐号和母/子公司的信息。
         * ATHFLG 有否附件信息标志
         * 账户交易流水 customrecord_swc_receipts_log
         * @param options
         */
        function addAccountLog(options)
        {
            if(options.output && options.output.errmsg)
            {
                return;
            }
            var message = "";
            var dataArray = options.output;
            var platform = options.platform;
            // var accountJson = searchBankAndAccount();
            util.each(dataArray,function (outJson,index) {
                var externalId;
                try{
                    var AMTCDR = outJson.AMTCDR && outJson.AMTCDR;
                    var ACCNBR = outJson.ACCNBR;
                    var bankType = outJson.BANKTYPE;
                    var swcrlType = "1";//系统查询类别list ID：1:收入；2：支出；
                    //TRSAMTC 贷方金额 TRSAMTD 借方金额
                    var amount = (outJson.TRSAMTC && outJson.TRSAMTC) || (outJson.TRSAMTD && outJson.TRSAMTD);
                    if(bankType == "CZB" && AMTCDR != "2")//*浙商银行 1出账 2入账
                    {
                        swcrlType = "2";
                    }
                    if(AMTCDR == "D" && bankType == "CMB")//招商银行 1入账 2出账
                    {
                        swcrlType = "2";
                    }
                    // var accountId = "";
                    // if(ACCNBR)
                    // {
                    //     accountId = accountJson[ACCNBR];
                    // }
                    externalId = outJson.REFNBR;
                    var receiptsLogId = Commons.searchByExternalId(externalId, "customrecord_swc_receipts_log");
                    if(!receiptsLogId)
                    {
                        var dateText = outJson.ETYDAT;

                        var year =dateText.substr(0,4)
                        var month =dateText.substr(4,2)
                        var day =dateText.substr(6,2)

                        var today = (format.format({value:new Date(year+"/"+month+"/"+day),type:format.Type.DATETIME,timezone:format.Timezone.ASIA_HONG_KONG})).split(' ')[0];
                        var todayDate = format.parse({value:today,type:format.Type.DATE});
                        var receiptsLogRec = record.create({type:"customrecord_swc_receipts_log",isDynamic:true});
                        Commons.setFieldsValues(receiptsLogRec, {
                            "externalid" : externalId,
                            "name" : externalId,
                            "custrecord_swcrl_number" : externalId,
                            // "custrecord_swcrl_account" : accountId,
                            "custrecord_swcrl_payname" : outJson.RPYNAM && outJson.RPYNAM,
                            "custrecord_swcrl_bank" : outJson.RPYBNK && outJson.RPYBNK,
                            "custrecord_swcrl_paynumber" : (outJson.RPYACC && outJson.RPYACC) || "",
                            "custrecord_swcrl_payamount" : amount,
                            "custrecord_swcrl_tradetype" : outJson.TRSCOD && outJson.TRSCOD,
                            "custrecord_swcrl_type" : swcrlType,
                            "custrecord_swcrl_creationdate" : outJson.ETYDAT+""+outJson.ETYTIM,
                            "custrecord_swcrl_etytim_str" : outJson.ETYDAT+""+outJson.ETYTIM,
                            "custrecord_swcrl_trsblv" : outJson.TRSBLV && outJson.TRSBLV,
                            "custrecord_swcrl_naryur" : (outJson.NARYUR && outJson.NARYUR) || "",
                            "custrecord_swcrl_yurref" : (outJson.YURREF && outJson.YURREF) || "",
                            // "custrecord_swcrl_currency" : currencyMaping(outJson.CCYNBR)
                        }, false, true);
                        Commons.setFieldsValues(receiptsLogRec, {
                            "custrecord_swcrl_bank_number" : ACCNBR,
                            "custrecord_swcrl_currency" : outJson.CCYNBR
                        }, true, true);
                        receiptsLogRec.setValue({fieldId:"custrecord_swcrl_date",value:todayDate});
                        receiptsLogRec.save({enableSourcing:true,ignoreMandatoryFields:true});
                    }
                }catch (e) {
                    message += externalId + "： " + e.message + "\n";
                }
            });
            if(message)
            {
                throw message;
            }
        }
        //币别
        function currencyMaping(ISOCODE)
        {
            var currencyObjField = objRecord.getField({fieldId:"custrecord_sbm_bank_currency"});
            var currencyObjOptions = currencyObjField.getSelectOptions();
            var currencyJson = {};
            util.each(currencyObjOptions,function (valueJson,key) {
                if(valueJson.text)
                {
                    currencyJson[valueJson.text] = valueJson.value;
                }
            });
            log.audit("currencyJson",JSON.stringify(currencyJson));
            if(currencyJson.hasOwnProperty(ISOCODE))
            {
                return currencyJson[ISOCODE];
            }
            return ISOCODE;
        }
        /**
         * 账户管理:查询电子回单信息
         * @param options
         */
        function updateReceiptsLogRec(options)
        {
            if(options.output && options.output.errmsg)
            {
                throw "账户管理:查询电子回单信息：" + options.output.errmsg;
            }
            var message = "";
            var dataArray = options.output;
            var accountJson = searchBankAndAccount();
            util.each(dataArray,function (outJson,index) {
                var externalId;
                try{
                    externalId = outJson.TRSNBR && outJson.TRSNBR;
                    // if(externalId.indexOf("-") >= 0)
                    // {
                    //     externalId = externalId.split("-")[0];
                    // }
                    var receiptsLogId = Commons.searchByExternalId(externalId, "customrecord_swc_receipts_log");
                    if(receiptsLogId)
                    {
                        var receiptsLogRec = record.load({type:"customrecord_swc_receipts_log",id:receiptsLogId,isDynamic:true});
                        var accountId = receiptsLogRec.getValue({fieldId:"custrecord_swcrl_account"});
                        if(!accountId)
                        {
                            if(outJson.SNDEAC && outJson.SNDEAC)
                            {
                                accountId = accountJson[outJson.SNDEAC];
                                receiptsLogRec.setValue({fieldId:"custrecord_swcrl_account",value:accountId});
                                receiptsLogRec.setValue({fieldId:"custrecord_swcrl_paynumber",value:outJson.RCVEAC && outJson.RCVEAC});//收方户口号
                                receiptsLogRec.setValue({fieldId:"custrecord_swcrl_payname",value:outJson.RCVEAN && outJson.RCVEAN});//收方户名
                                receiptsLogRec.setValue({fieldId:"custrecord_swcrl_bank",value:outJson.RCVEAB && outJson.RCVEAB});//收方开户行
                                receiptsLogRec.save({enableSourcing:true,ignoreMandatoryFields:true});
                            }
                        }
                    }
                }catch (e) {
                    message += externalId + "： " + e.message + "\n";
                }
            });
            if(message)
            {
                throw message;
            }
        }

        /**
         * 招商银行图片命名规则为：账号_起始日期-结束日期_回单实例号_流水号
         * 账户管理:查询电子回单信息
         * YURREF 业务参考号
         * REFNBR 流水号
         * @param options
         */
        function addAccountImage(options)
        {
            if(options.output && options.output.errmsg)
            {
                throw "账户管理:查询电子回单（图片）接口：" + options.output.errmsg;
            }
            var message = "";
            try{
                var imageJson = options.output;
                Commons.checkImageName(options);
                var fileType = file.Type.JPGIMAGE;
                if(!options.isJPG)
                {
                    fileType = file.Type.PDF;
                }
                var paymentExternalId = options.paymentExternalId;//业务参考号 《银企直联支付记录》外部ID
                var logExternalId = options.logExternalId;//流水号 流水号是《账户交易流水》的外部ID
                var oldFileId = checkImage(logExternalId,paymentExternalId);
                if(!oldFileId)
                {
                    // if(paymentExternalId && paymentExternalId.indexOf("-") >= 0)
                    // {
                    //     paymentExternalId = paymentExternalId.split("-")[0];
                    // }
                    // var paymentId = Commons.searchByExternalId(paymentExternalId, "customrecord_swc_payment_platform");
                    var resultJson = Commons.searchByNameColumn("customrecord_swc_payment_platform", [paymentExternalId], "custrecord_swcpp_tranid");
                    var paymentId = resultJson && resultJson[paymentExternalId];
                    var receiptsLogId = Commons.searchByExternalId(logExternalId, "customrecord_swc_receipts_log");
                    if (receiptsLogId || paymentId) {
                        var fileObj = file.create({
                            name: imageJson.name,
                            fileType: fileType,
                            contents: imageJson.img,
                            // folder: "2125"//生产
                            // folder: "12809270"//沙箱
                            folder: "13145443"//沙箱
                        });
                        var fileId = fileObj.save();
                        if (fileId && paymentId) {
                            var paymentPlatformRec = record.load({
                                type: "customrecord_swc_payment_platform",
                                id: paymentId,
                                isDynamic: true
                            });
                            paymentPlatformRec.setValue({
                                fieldId: "custrecord_swcpp_payonlylist",
                                value: logExternalId
                            });
                            var swcppState = paymentPlatformRec.getValue({fieldId: "custrecord_swcpp_state"});//获取表单支付状态
                            var errMsg = paymentPlatformRec.getValue({fieldId: "custrecord_swcpp_err_msg"});//获取表单错误信息
                            if(errMsg)
                            {
                                paymentPlatformRec.setValue({fieldId: "custrecord_swcpp_err_msg", value: ""});//清除message
                            }
                            if(swcppState == "4" || swcppState == "7")//只更新已发送待银行支付的记录和支付失败的
                            {
                                paymentPlatformRec.setValue({fieldId: "custrecord_swcpp_state", value: "1"});//支付成功
                            }
                            paymentPlatformRec.setValue({fieldId: "custrecord_swcpp_fileid", value: fileId});
                            // record.submitFields({type:"customrecord_swc_payment_platform",id:paymentId,values:{"custrecord_swcpp_fileid":fileId,"custrecord_swcpp_payonlylist":logExternalId,"custrecord_swcpp_state":"1"}});
                            paymentPlatformRec.save({ignoreMandatoryFields: true, enableSourcing: true});
                            record.attach({
                                record: {type: "file", id: fileId},
                                to: {type: "customrecord_swc_payment_platform", id: paymentId}
                            });
                        }
                        receiptsLogId && record.attach({
                            record: {type: "file", id: fileId},
                            to: {type: "customrecord_swc_receipts_log", id: receiptsLogId}
                        });
                    }
                }
            }catch (e) {
                message += e.message;
            }
            if(message)
            {
                throw message;
            }
        }
        function checkImage(logExternalId,paymentExternalId)
        {
            var filters = [];
            var nameStr = "";
            if(logExternalId)
            {
                nameStr += "_" + logExternalId;
            }
            if(paymentExternalId)
            {
                nameStr += "_" + paymentExternalId;
            }
            if(nameStr)
            {
                filters.push(["name","contains",nameStr]);
                var fileSearchObj = search.create({
                    type: "file",
                    filters:filters,
                    columns: []
                });
                var fileId = "";
                fileSearchObj.run().each(function(result){
                    fileId = result.id;
                    return true;
                });
                return fileId;
            }
        }
        /**
         * 支付业务:支付退票明细查询
         * YURREF 业务参考号
         * REFNBR 业务参考号
         * UPDDAT 更新日期
         * BUSSTS 汇款业务状态 C 退票（跨行）R 退票（同行）
         * ISUDAT 发起日期
         * TRSBRN 处理机构
         * TRSBBK 处理分行
         * RCVEAC 收方户口号
         * RCVEAN 收方户名
         * RCVBBK 收方分行号
         * RCVEAB 收方开户行
         *
         * @param options
         */
        function updatePaymentStatusOfRefund(options)
        {
            var message = "";
            if(options.output && options.output.errmsg)
            {
                throw "支付业务:支付退票明细查询：" + options.output.errmsg;
            }
            try{
                util.each(options.output,function (outJson,index) {
                    var paymentExternalId = outJson.YURREF;
                    // if(paymentExternalId.indexOf("-") >= 0)
                    // {
                    //     paymentExternalId = paymentExternalId.split("-");
                    // }
                    // var paymentId = Commons.searchByExternalId(paymentExternalId, "customrecord_swc_payment_platform");
                    var resultJson = Commons.searchByNameColumn("customrecord_swc_payment_platform", [paymentExternalId], "custrecord_swcpp_tranid");
                    var paymentId = resultJson && resultJson[paymentExternalId];
                    if(paymentId)
                    {
                        var BUSSTS = outJson.BUSSTS;
                        var status = "";
                        if(BUSSTS)
                        {
                            if(BUSSTS == "R")
                            {
                                status = "B";//系统中维护退票时为B
                            }
                        }
                        var paymentLogRecord = record.create({type:"customrecord_swc_payment_log",isDynamic:true});
                        paymentLogRecord.setValue({fieldId:"custrecord_swcpl_search_datetime",value:outJson.UPDDAT});
                        paymentLogRecord.setValue({fieldId:"custrecord_swcpl_payonlylist",value:paymentExternalId});
                        paymentLogRecord.setValue({fieldId:"custrecord_swcpl_results",value:JSON.stringify(outJson)});
                        paymentLogRecord.setValue({fieldId:"custrecord_swcpl_parent",value:paymentId});
                        Commons.setFieldsValues(paymentLogRecord, {
                            "custrecord_swcpl_status" : status
                        }, true, true);
                        paymentLogRecord.save({enableSourcing:true,ignoreMandatoryFields:true});
                    }else{
                        message += paymentExternalId + ":  没有可匹配的支付记录" + "\n";
                    }
                });
            }catch (e) {
                message += e.message;
            }
            if(message)
            {
                throw message;
            }
        }
        function searchBankAndAccount()
        {
            var accountJson = {};
            var customrSearchObj = search.create({
                type: "customrecord_swc_bank_map",
                filters:
                    [
                        ["isinactive","is","F"]
                    ],
                columns:
                    [
                        search.createColumn({
                            name: "name",
                            sort: search.Sort.ASC,
                            label: "Name"
                        }),
                        search.createColumn({name: "custrecord_sbm_account", label: "科目"})
                    ]
            });
            var searchResultCount = customrSearchObj.runPaged().count;
            log.debug("customrecord_swc_bank_map result count",searchResultCount);
            searchResultCount.run().each(function(result){
                // .run().each has a limit of 4,000 results
                var bankNumber = result.getValue({
                    name: "name",
                    sort: search.Sort.ASC,
                    label: "Name"
                });
                accountJson[bankNumber] = result.getValue({name: "custrecord_sbm_account", label: "科目"});
                return true;
            });
            return accountJson;
        }

        /**
         *  飞书 根据【采购申请】创建【采购订单】
         *  @param {record} curRec 采购申请单
         *  @param {string} purchaseRequestId 采购申请id
         */
        function createPo(curRec,purchaseRequestId,prsPro) {
            log.audit("Business-getFsAuditStatus-curRec",curRec);
            //添加去重record
            var poExternalId = "PURCHASE_ORDER_" + purchaseRequestId;
            var thiPoId = Commons.searchByExternalId(poExternalId, record.Type.PURCHASE_ORDER);
            if(thiPoId)return thiPoId;
            // 首先获取当前表单
            // 获取【首选供应商】字段
            var vendor = curRec.getValue({fieldId: 'custrecord_pr_vendor_first'});
            log.audit("Business-getFsAuditStatus-vendor",vendor);
            if (!vendor) throw "采购申请生成采购订单时，供应商不能为空！"
            // 获取【需求者】字段
            var employee = curRec.getValue({fieldId: 'custrecord_pr_buyer'});
            if (!employee)throw "采购申请生成采购订单时，需求者不能为空！"
            // 获取【创建采购订单日期】
            var crtPoDate = new Date();
            // 获取【审批状态】
            var approvalstatus = curRec.getValue({fieldId: 'custrecord_pr_workflowstatus'});
            // 获取【子公司】
            var subS = curRec.getValue({fieldId: 'custrecord_pr_sub'});
            // 获取【部门】
            var department = curRec.getValue({fieldId: 'custrecord_pr_department'});
            // 获取【正当理由】
            var justification = curRec.getValue({fieldId: 'custrecord_pr_extramemo'});
            // 获取【货币】
            var currency = curRec.getValue({fieldId: 'custrecord_pr_currency'});
            // 获取【子列表】信息，首先获取行号
            var sublistLine = curRec.getLineCount({sublistId: 'recmachcustrecord_prs_field'});

            // 创建【采购订单】
            var newPoRec = record.create({type: record.Type.PURCHASE_ORDER, isDynamic: true,defaultValues:{"entity":vendor,"subsidiary":subS}});

            // 设置【外部id】字段
            newPoRec.setValue({fieldId: 'externalid', value: poExternalId});
            // 设置【供应商】字段
            //newPoRec.setValue({fieldId: 'entity', value: vendor});
            // 设置【子公司】
            //newPoRec.setValue({fieldId: 'subsidiary', value: subS});
            // 设置【日期】
            newPoRec.setValue({fieldId: 'trandate', value: crtPoDate});
            // 设置【员工】字段
            newPoRec.setValue({fieldId: 'employee', value: employee});
            // 设置【审批状态】
            newPoRec.setValue({fieldId: 'approvalstatus', value: 2});//已审批
            // 设置【部门】
            newPoRec.setValue({fieldId: 'department', value: department});
            // 设置【正当理由】
            newPoRec.setValue({fieldId: 'custbody_swc_justification', value: justification});
            // 设置【货币】
            newPoRec.setValue({fieldId: 'currency', value: currency});
            // 设置【关联采购申请】 20250526 HC变更
            newPoRec.setValue({fieldId: 'custbody_hp_related_pr', value: curRec.id});
            // 遍历整个子列表
            for (var i = 0; i < sublistLine; i++) {
                // 获取【货品】
                var item = curRec.getSublistValue({sublistId: 'recmachcustrecord_prs_field', fieldId: 'custrecord_prs_item',line:i});
                if (!item) throw new Error('采购申请生成采购订单时，第' + i + '行【货品】不能为空，请核对【货品】');
                // 获取【数量】
                //var quantity = curRec.getSublistValue({sublistId: 'recmachcustrecord_prs_field', fieldId: 'custrecord_prs_quantity',line:i});
                // 获取【价格】
                var price = curRec.getSublistValue({sublistId: 'recmachcustrecord_prs_field', fieldId: 'custrecord_prs_price',line:i});
                // 获取【税码】
                //var taxCode = curRec.getSublistValue({sublistId: 'recmachcustrecord_prs_field', fieldId: 'custrecord_prs_taxcode',line:i});
                // 获取【总金额】
                var totalAmount = curRec.getSublistValue({sublistId: 'recmachcustrecord_prs_field', fieldId: 'custrecord_prs_totalamount',line:i});
                // 获取【税额】
                //var taxCount = curRec.getSublistValue({sublistId: 'recmachcustrecord_prs_field', fieldId: 'custrecord_prs_taxrate',line:i});
                // 获取【预算归属部门】
                var subDepartment = curRec.getSublistValue({sublistId: 'recmachcustrecord_prs_field', fieldId: 'custrecord_prs_budget_department',line:i});
                // 选中当前行
                newPoRec.selectNewLine({sublistId: 'item',});
                if(!item)throw "采购申请生成采购订单时 货品不存在！"
                // 设置【货品】
                newPoRec.setCurrentSublistValue({sublistId: 'item', fieldId: 'item', value: item});
                // 设置【数量】
                newPoRec.setCurrentSublistValue({sublistId: 'item', fieldId: 'quantity', value: 1});
                newPoRec.setCurrentSublistValue({sublistId: 'item', fieldId: 'rate', value: 1});
                // 设置【价格】
                newPoRec.setCurrentSublistValue({sublistId: 'item', fieldId: 'rate', value: price});
                // 设置【项目】
                if(prsPro)newPoRec.setCurrentSublistValue({sublistId: 'item', fieldId: 'cseg_swc_pro', value: prsPro});

                // 美国公司没有税码
                // if (currency != 5) {
                //     // 设置【税码】
                //     newPoRec.setCurrentSublistValue({sublistId: 'item', fieldId: 'taxcode', value: taxCode});
                // }
                //设置【价格】
                var rate = totalAmount/1;
                newPoRec.setCurrentSublistValue({sublistId: 'item', fieldId: 'rate', value: rate,'ignoreFieldChange':true});
                // 设置【总金额】
                newPoRec.setCurrentSublistValue({sublistId: 'item', fieldId: 'amount', value: totalAmount});
                // 设置【税额】
                //var taxCount1 = newPoRec.setCurrentSublistValue({sublistId: 'item', fieldId: 'taxrate', value: taxCount});
                // 设置【预算归属部门】
                newPoRec.setCurrentSublistValue({sublistId: 'item', fieldId: 'department', value: subDepartment});
                newPoRec.commitLine({sublistId: 'item'});
            }

            var poId = newPoRec.save({
                enableSourcing: true,
                ignoreMandatoryFields: true
            });
            return poId;
        }

        /**
         *  飞书 根据【供应商账单申请】创建【账单】
         *  @param {record} curRec 供应商账单申请
         *  @param {string} getRealpaydate 实际付款日期
         *  @param {string} paymentMethod 付款方式
         *  @param {string} expectedPaytime 预计付款日期
         *  @param {string} invoiceAttachment 实际付款日期
         *  @param {string} taxRate 税码
         */
        function createvendorBillByAccountPay(curRec,getRealpaydate,paymentMethod,expectedPaytime,invoiceAttachment,invoiceAttachment2,invoiceAttachment3,description,apsPro,taxRate, otherAttachment,hcFSInstanceCodeMap, hcApprovalData, vbPrepay, vbAmorzation) {
            var supplier = curRec.getValue({fieldId: 'custrecord_ap_vendorname'});// 供应商
            var currency = curRec.getValue({fieldId: 'custrecord_ap_currency'});// 币种
            var subsidiary = curRec.getValue({fieldId: 'custrecord_ap_subsidary'}); // 附属公司（付款主体）
            var invoiceNumber = curRec.getValue({fieldId: 'custrecord_ap_invoiceno'}); // INVOICE NUMBER
            var lineCount = curRec.getLineCount({sublistId: 'recmachcustrecord_aps_field'});
            var deptCostcenterJson = Commons.srchDepartmentCostcenterid();//查询【部门】 Cost Center ID + Name字段JSON
            // 创建账单
            var billRec = record.create({type: record.Type.VENDOR_BILL,isDynamic:true});
            billRec.setValue({fieldId: 'entity', value: supplier});
            billRec.setValue({fieldId: 'subsidiary', value: subsidiary});
            billRec.setValue({fieldId: 'currency', value: currency});
            if(invoiceNumber)billRec.setValue({fieldId: 'custbody_swc_invoice_number', value: invoiceNumber});
            var newDescription = "";
            var companyname = "";
            var companynameObj = search.lookupFields({type: search.Type.VENDOR, id: supplier, columns: ['companyname']});//供应商名称
            if(companynameObj && companynameObj.companyname)companyname = companynameObj.companyname;
            if(lineCount==1){
                var itemName = curRec.getSublistText({sublistId: 'recmachcustrecord_aps_field', fieldId: 'custrecord_aps_item', line: 0});// 货品
                if(itemName){
                    newDescription = "Bill_"+companyname+"_"+description+"/"+itemName;
                }else {
                    newDescription = "Bill_"+companyname+"_"+description;
                }
            }else {
                newDescription = "Bill_"+companyname+"_"+description;
            }
            if(newDescription && newDescription.length>=999){
                billRec.setValue({fieldId:"custbody_swc_bill_longmemo",value:newDescription});//备注
                billRec.setValue({fieldId:"memo",value:newDescription.slice(0,990)});//备注
            }else if(newDescription){
                billRec.setValue({fieldId:"memo",value:newDescription});//备注

            }
            if(paymentMethod)billRec.setValue({fieldId:"custbody_swc_payway",value:paymentMethod});//账单-付款方式
            if(expectedPaytime)billRec.setValue({fieldId:"custbody_swc_repaydate",value:expectedPaytime});//账单-预计付款日期
            if(getRealpaydate)billRec.setValue({fieldId: 'custbody_swc_paydate', value: getRealpaydate});//实际付款日期
            //【20251124 HP Start】
            if(true === vbPrepay) {
                billRec.setValue({fieldId:"custbody_whether_to_prepay",value:vbPrepay});//是否预付
                billRec.setValue({fieldId:"approvalstatus",value:3});//账单审批状态赋值为Reject
            }else {
                billRec.setValue({fieldId:"approvalstatus",value:2});//账单审批状态赋值为Approved
            }
            if(true === vbAmorzation)billRec.setValue({fieldId:"custbody_whether_to_amortize",value:vbAmorzation});//是否摊销
            //【20251124 HP End】
            //20231007 飞书税率及单据明细task2383 start
            //var salesTaxSubsidiaryJson = Commons.srchSubsidiaryBySalesTax();//查询【税码】下的数据 {"subsidiary":{"子公司1":10%,...} ,"subsidiaryId":{10%:内部ID1,...}}
            var subsidiaryId = billRec.getValue({fieldId:"subsidiary"});//子公司ID
            var TaxCodeAndCurrJson = {};
            if(9 == subsidiaryId){
                TaxCodeAndCurrJson = Commons.srchTaxCodeAndCurrJPY(subsidiaryId);//查询【税码】下的【税码对应币种】和【税率】
            } else {
                TaxCodeAndCurrJson = Commons.srchTaxCodeAndCurr();//查询【税码】下的【税码对应币种】和【税率】
            }
            //var subsidiaryCurrencyJson = Commons.srchSubsidiaryCurrency();//查询子公司下的所有币种
            //20231007 飞书税率及单据明细task2383 end
            // 存放货品行明细
            for (var i = 0; i < lineCount; i++) {
                var item = curRec.getSublistValue({sublistId: 'recmachcustrecord_aps_field', fieldId: 'custrecord_aps_item', line: i});// 货品
                var amountTotal = curRec.getSublistValue({sublistId: 'recmachcustrecord_aps_field', fieldId: 'custrecord_aps_totalamount', line: i});// 总金额
                var department = curRec.getSublistValue({sublistId: 'recmachcustrecord_aps_field', fieldId: 'custrecord_aps_department', line: i});// 预算归属部门

                if(!item)throw new Error("创建账单时，货品不能为空！");
                billRec.selectLine({sublistId: 'item',line:i});
                billRec.setCurrentSublistValue({sublistId: 'item', fieldId: 'item',value: item});
                var itemName = billRec.getCurrentSublistText({sublistId: 'item', fieldId: 'item'});//费用类型
                var newDescription = "Bill_"+companyname+"_"+description+"/"+itemName;
                if(newDescription)billRec.setCurrentSublistValue({sublistId: 'item', fieldId: 'description',value: newDescription});//说明
                billRec.setCurrentSublistValue({sublistId: 'item', fieldId: 'quantity',value: '1'});// 数量
                //20231007 飞书税率及单据明细task2383 start
                //如果税码不为0或者不为空时，税码=货币对应的税码
                if(taxRate!="0%" && taxRate){
                    log.audit("taxRate",taxRate);
                    log.audit("TaxCodeAndCurrJson",TaxCodeAndCurrJson);
                    log.audit("subsidiary",subsidiary);
                    log.audit("currency",currency);
                    //如果飞书的税码在付款主体对应的【税码】表中存在并且币种不为美金，则赋值该税码
                    // if(currency != "2" && salesTaxSubsidiaryJson["subsidiary"][subsidiary].length>0 && salesTaxSubsidiaryJson["subsidiary"][subsidiary].indexOf(taxRate)!=-1){
                    //     var taxCodeId =  salesTaxSubsidiaryJson["subsidiaryId"][taxRate];//税码内部ID
                    //     log.audit("taxCodeId",taxCodeId);
                    //     billRec.setCurrentSublistValue({sublistId: 'item', fieldId: 'taxcode', value: taxCodeId})// 税码
                    // }
                    if(currency != "2" && TaxCodeAndCurrJson.hasOwnProperty(taxRate+"_"+currency)){
                        var taxCodeId =  TaxCodeAndCurrJson[taxRate+"_"+currency];//税码内部ID
                        log.audit("taxCodeId",taxCodeId);
                        billRec.setCurrentSublistValue({sublistId: 'item', fieldId: 'taxcode', value: taxCodeId})// 税码
                    }
                }
                if(amountTotal){
                    billRec.setCurrentSublistValue({sublistId: 'item', fieldId: 'grossamt',value: amountTotal});// 总金额
                    //如果公司本位币为日元(付款主体为9PingCAP 株式会社)，币种为日元，明细税码设置完需要对税金进行小数位舍去，总金额保持不变，倒算未税金额（总金额-舍去后税金）及单价（单价除不尽保留6位小数）。
                    if(subsidiary =="9" && currency == "6"){

                        log.audit("taxCodeId2",taxCodeId);
                        log.audit("amountTotal",amountTotal);
                        var tax = 0;
                        //if(taxRate)tax = Number(taxRate)/100;
                        if(taxRate)tax = Number(taxRate.replace("%",""))/100;
                        log.audit("tax",tax);
                        var amount = Number(amountTotal)/(1+tax);
                        var tax1amt =  Number(amountTotal)-amount;
                        //var amount = Number(amountTotal) - Number(tax1amt);
                        log.audit("amount",amount);
                        billRec.setCurrentSublistValue({sublistId: 'item', fieldId: 'amount',value: amount});// 未税金额
                        billRec.setCurrentSublistValue({sublistId: 'item', fieldId: 'tax1amt',value: tax1amt});// 税额
                        log.audit("tax1amt",tax1amt);
                        var rate = (Number(amountTotal)/(1+tax)).toFixed(6);
                        billRec.setCurrentSublistValue({sublistId: 'item', fieldId: 'rate',value: rate});// 单价
                    }else {
                        billRec.setCurrentSublistValue({sublistId: 'item', fieldId: 'rate',value: amountTotal});// 单价

                    }
                }else {
                    billRec.setCurrentSublistValue({sublistId: 'item', fieldId: 'rate', value: 0});// 单价
                    billRec.setCurrentSublistValue({sublistId: 'item', fieldId: 'grossamt',value: 0});// 总金额
                }
                //20231007 飞书税率及单据明细task2383 end
                if(department){
                    billRec.setCurrentSublistValue({sublistId: 'item', fieldId: 'department',value: department});// 预算归属部门
                    var costcenter = deptCostcenterJson[department];
                    log.audit(" PO不存在-COST CENTER ID + NAME",costcenter);
                    if(costcenter)billRec.setCurrentSublistValue({sublistId: 'item', fieldId: 'custcol_swc_cost_centerid', value: costcenter});//COST CENTER ID + NAME
                }
                if(apsPro)billRec.setCurrentSublistValue({sublistId: 'item', fieldId: 'cseg_swc_pro', value: apsPro});//项目
                //Hitpoint     20251014    新增【Accounting】节点审批人及审批意见
                var thisLineFsno = hcFSInstanceCodeMap[item + '&' + department];//该行【货品&部门】对应账单申请明细行飞书单号
                if(thisLineFsno && hcApprovalData[thisLineFsno]) {
                    var tmp = hcApprovalData[thisLineFsno];
                    billRec.setCurrentSublistValue({sublistId: 'item', fieldId: 'custcol_feishu_comment', value: tmp.cmt});//审批评论
                    if(tmp.userid) {
                        billRec.setCurrentSublistValue({sublistId: 'item', fieldId: 'custcol_accounting_approver', value: tmp.userid});//Accounting审批人
                    }
                }
                billRec.commitLine({sublistId: 'item'});
            }
            //生成账单时，通过供应商id查询 【供应商银行信息】record，将第一条数据赋值到 账单中（【账单供应商信息】record）
            if(supplier){
                var venJson = Commons.schVenBankInfoByVendorId(supplier);//【供应商银行信息】JSON  根据供应商ID查询【供应商银行信息】记录
                if(venJson){
                    billRec.selectLine({sublistId: 'recmachcustrecord_bbn_billnum',line:0});
                    billRec.setCurrentSublistValue({sublistId: 'recmachcustrecord_bbn_billnum', fieldId: 'custrecord_bbn_vendor_bankname', value:venJson.vendor_bankname});//VENDOR BANK NAME
                    billRec.setCurrentSublistValue({sublistId: 'recmachcustrecord_bbn_billnum', fieldId: 'custrecord_bbn_vendor_accountname', value:venJson.vendor_accountname});//BANK ACCOUNT NAME
                    billRec.setCurrentSublistValue({sublistId: 'recmachcustrecord_bbn_billnum', fieldId: 'custrecord_bbn_vendor_account', value: venJson.vendor_account});//BANK ACCOUNT NO.
                    billRec.setCurrentSublistValue({sublistId: 'recmachcustrecord_bbn_billnum', fieldId: 'custrecord_bbn_swiftcode', value: venJson.swiftcode});//SWIFT CODE
                    billRec.setCurrentSublistValue({sublistId: 'recmachcustrecord_bbn_billnum', fieldId: 'custrecord_bbn_routing_transit', value: venJson.routing_transit});//ROUTING & TRANSIT NO.
                    billRec.setCurrentSublistValue({sublistId: 'recmachcustrecord_bbn_billnum', fieldId: 'custrecord_bbn_bank_country', value: venJson.bank_country});//BANK COUNTRY
                    billRec.setCurrentSublistValue({sublistId: 'recmachcustrecord_bbn_billnum', fieldId: 'custrecord_bbn_bank_province', value: venJson.bank_province});//开户行省份/州
                    billRec.commitLine({sublistId: 'recmachcustrecord_bbn_billnum'});
                }
            }
            //如果发票附件存在，则将发票附件字段值赋值到【采购文件合同】中
            if(invoiceAttachment){
                billRec.selectNewLine({sublistId: 'recmachcustrecord_folder_bill'});
                billRec.setCurrentSublistValue({sublistId: 'recmachcustrecord_folder_bill', fieldId: 'custrecord_folder_one', value: invoiceAttachment});
                billRec.commitLine({sublistId: 'recmachcustrecord_folder_bill'});
            }
            if(invoiceAttachment2){
                billRec.selectNewLine({sublistId: 'recmachcustrecord_folder_bill'});
                billRec.setCurrentSublistValue({sublistId: 'recmachcustrecord_folder_bill', fieldId: 'custrecord_folder_one', value: invoiceAttachment2});
                billRec.commitLine({sublistId: 'recmachcustrecord_folder_bill'});
            }
            if(invoiceAttachment3){
                billRec.selectNewLine({sublistId: 'recmachcustrecord_folder_bill'});
                billRec.setCurrentSublistValue({sublistId: 'recmachcustrecord_folder_bill', fieldId: 'custrecord_folder_one', value: invoiceAttachment3});
                billRec.commitLine({sublistId: 'recmachcustrecord_folder_bill'});
            }
            // HC 20250423 add 供应商申请-结算单等其他支持性文件添加到账单【采购文件合同】中
            if (otherAttachment) {
                billRec.selectNewLine({sublistId: 'recmachcustrecord_folder_bill'});
                billRec.setCurrentSublistValue({sublistId: 'recmachcustrecord_folder_bill', fieldId: 'custrecord_folder_one', value: otherAttachment});
                billRec.commitLine({sublistId: 'recmachcustrecord_folder_bill'});
            }
            var vendorBillId = billRec.save();
            return vendorBillId;
        }

        /**
         * 生成系统文件。并将合同存到采购订单下
         * @param options
         */
        function getFeiShuContractFile(options) {
            log.audit('ceshi','ceshi');
            var output = options.output;

            var contractId = output.contractId; // 合同ID
            var nsContractIdMidTable = output.nsContractIdMidTable; // NS合同ID中间表id
            var prIdArr = output.prIdArr; // 采购申请单id数组
            // var contractZhu = output.contractZhu;  // 主合同
            var contractGui = output.contractGui; // 归档合同

            if(!prIdArr.length) throw "合同ID【"+contractId+"】对应的NS采购申请为空！"
            var nsContractIdArr = [];
            var nsPoIdArr = Commons.nsSearchPo(prIdArr); // 获取ns采购申请行的采购订单id数组
            log.audit('nsPoIdArr',nsPoIdArr);

            // if(contractZhu.file_id) {
            //     var lastIndex = contractZhu.file_name.lastIndexOf(".");
            //     var fileType = contractZhu.file_name.substr(Number(lastIndex) +1);
            //     try {
            //         var fileId = file.create({
            //             name:contractZhu.file_name,
            //             folder:SWC_CONFIG_DATA.configData().FEISHU_PR_CONTRACT_FOLDER,
            //             fileType:SWC_CONFIG_DATA.configData().FILE_TYPE_JSON[fileType],
            //             contents:contractZhu.fileContent
            //         }).save();
            //
            //         nsContractIdArr.push(fileId);
            //     } catch (e) {
            //         throw contractZhu.file_name+"主合同上传ns系统文件出错"+e.message;
            //     }
            //
            // }
            if(contractGui.length) {
                for(var i = 0; i < contractGui.length; i++) {
                    var lastIndex = contractGui[i].file_name.lastIndexOf(".");
                    var fileType = contractGui[i].file_name.substr(Number(lastIndex) +1);
                    try {
                        var fileId = file.create({
                            name:contractGui[i].file_name,
                            folder:SWC_CONFIG_DATA.configData().FEISHU_PR_CONTRACT_FOLDER,
                            fileType:SWC_CONFIG_DATA.configData().FILE_TYPE_JSON[fileType],
                            contents:contractGui[i].fileContent
                        }).save();
                        nsContractIdArr.push(fileId);
                    } catch (e) {
                        throw contractGui[i].file_name+"归档件上传ns系统文件出错"+e.message;
                    }

                }
            }
            log.audit('nsContractIdArr',nsContractIdArr);
            // 往采购订单下添加文件
            createPOFiles(nsContractIdArr,nsPoIdArr);
            // 勾选中间表为是
            updateMidTable(nsContractIdMidTable);
        }

        /**
         * 勾选中间表为是
         * @param nsContractIdMidTable 中间表id
         */
        function updateMidTable(nsContractIdMidTable) {
            record.submitFields({type:"customrecord_swc_feishu_contractid",id:nsContractIdMidTable,values:{"custrecord_line_success_flag":true}});
        }

        /**
         * 往采购订单下添加文件
         * @param nsContractIdArr ns合同文件id数组
         * @param nsPoIdArr 采购订单id数组
         */
        function createPOFiles(nsContractIdArr,nsPoIdArr) {
            try {
                for(var i = 0; i < nsPoIdArr.length; i++) {
                    for(var j = 0; j < nsContractIdArr.length; j++) {
                        var rec = record.create({type:"customrecord_swc_po_floder"});
                        rec.setValue({fieldId:"custrecord_folder_po",value:nsPoIdArr[i]});
                        rec.setValue({fieldId:"custrecord_folder_one",value:nsContractIdArr[j]});
                        rec.save();
                    }
                }
            } catch (e) {
                throw "回写采购订单合同子列表出错"+e.message;
            }

        }

        //费用报销生成日记账
        function createExReportToJournal(options) {
            var output = options.output;
            var id = output._output_;//费用报告内部ID
            log.audit('id',id);
            //var exReportRec = Commons.srchExreportById(id);
            try {
                var exReportRec = record.load({id:id,type:record.Type.EXPENSE_REPORT});//费用报告
                var jId = exReportRec.getValue({fieldId:"custbody_swc_related_journal"});//相关日记账
                if(jId)throw new Error("ID为"+id+"的费用报告已经生成过日记账，无法重复生成！");
                //根据费用报告生成日记账
                var journalRec = record.create({type:record.Type.JOURNAL_ENTRY,isDynamic:true});
                //20231031修改 科目赋值逻辑 start
                //var expenseCategoryJson = Commons.srchExpenseCategory();//费用类别 格式：{"name1":"账户1",...}
                //log.audit("expenseCategoryJson",expenseCategoryJson);
                var departmentTypeJson = Commons.srchDepartmentTypeById();//根据部门id查询部门类型存入JSON 格式：{"id1":"类别ID1",...}
                var accountFromItemJson = Commons.srchAccountFromItem();//根据货品名称和部门类型查询服务类货品下的科目存入JSON 格式：{"货品名称+部门类型ID":"账户1",...}
                log.audit("部门类型DepartmentTypeJson",departmentTypeJson);
                log.audit("货品下的科目AccountFromItemJson",accountFromItemJson);
                //20231031修改 科目赋值逻辑 end
                var departmentJson = Commons.srchDepartmentSwcprp();//查询部门项目
                var subsidiary = exReportRec.getValue({fieldId:"subsidiary"});//子公司
                var country = Commons.srchSubsidiaryCountryById(subsidiary);//查询子公司的国家地区
                var taxAccount = Commons.srchAccountExpenseById(subsidiary);//根据【子公司id】查询【费用报销公司】的【税项科目】
                log.audit(taxAccount,taxAccount);
                var currency = exReportRec.getValue({fieldId:"expensereportcurrency"});//货币
                var exchangerate = exReportRec.getValue({fieldId:"expensereportexchangerate"});//汇率
                //var trandate = exReportRec.getValue({fieldId:"trandate"});//日期
                var createddate1 = exReportRec.getText({fieldId:"createddate"}).slice(0,10);//创建日期
                var createddate2 = new Date(createddate1);
                var newDate = ''+createddate2.getFullYear()+zeroPush(createddate2.getMonth()+1)+zeroPush(createddate2.getDate());
                log.audit("newDate",newDate);
                var createddate = format.parse({
                    value: Commons.formatDate(newDate),
                    type: format.Type.DATE
                });

                var createdfrom = exReportRec.getValue({fieldId:"custbody_createdfrom_expensify"});//CREATED FROM
                var employee = exReportRec.getValue({fieldId:"entity"});//员工EMPLOYEE
                var employeeName = exReportRec.getText({fieldId:"entity"});//员工EMPLOYEE名称
                var exReportCount = exReportRec.getLineCount({sublistId:"expense"});

                journalRec.setValue({fieldId:"subsidiary",value:subsidiary});//子公司
                journalRec.setValue({fieldId:"currency",value:currency});//货币
                journalRec.setValue({fieldId:"exchangerate",value:exchangerate});//汇率
                journalRec.setValue({fieldId:"trandate",value:createddate});//日期
                journalRec.setValue({fieldId:"custbody_createdfrom_expensify",value:createdfrom});//CREATED FROM

                //日本 JP  开曼 KY   美国 US    新加坡 SG    香港 HK
                var custCountryJson = {"JP":"6","KY":"8","US":"10","SG":"11","HK":"9"};//地区映射关系
                if(exReportCount > 0){
                    var creditAmount = 0;
                    log.audit("exReportCount",exReportCount);
                    var flag = false;
                    //{id：{rate：rate1，jptax：jptax1},...}
                    var jptaxJson = Commons.srchJptaxAndRate();//查询【税码】下的数据 和日本税计算逻辑 (自定义)字段
                    log.audit("jptaxJson",jptaxJson);
                    for(var i=0;i <= exReportCount;i++){
                        if(i == exReportCount){
                            i = i-1;
                            flag = true;//如果是最后一行后，新增一行贷记
                        }
                        var category = exReportRec.getSublistText({sublistId:"expense",fieldId:"category",line:i});//category
                        var department = exReportRec.getSublistValue({sublistId:"expense",fieldId:"department",line:i});//department
                        //20231031修改 科目赋值逻辑 start
                        var account = "";//借方费用科目
                        if(category && department){
                            log.audit("category",category);
                            log.audit("department",department);
                            var departmentType = departmentTypeJson[department];
                            log.audit("departmentType",departmentType);
                            if(departmentType){
                                account = accountFromItemJson[category+" ("+departmentType+")"+departmentType];
                                if(!account){
                                    account = accountFromItemJson[category+departmentType];
                                }
                            }
                        }
                        //20231031修改 科目赋值逻辑 end
                        var amount = exReportRec.getSublistValue({sublistId:"expense",fieldId:"amount",line:i});//amount
                        var tax1amt = exReportRec.getSublistValue({sublistId:"expense",fieldId:"tax1amt",line:i});//税额

                        //var taxCode = "";
                        //var taxrate1 = "";
                        //美国不存在税码
                        //if(currency != "2"){
                        var taxCode = exReportRec.getSublistValue({sublistId:"expense",fieldId:"taxcode",line:i});//税码
                        log.audit("taxCode",taxCode);
                        var tax = 0;//税率 数字
                        var jptax = 0;//日本税计算逻辑字段 数字
                        var swcTaxrate = "";//税额(CUSTOM)
                        if(taxCode) {
                            if(!jptaxJson[taxCode] ||Object.keys(jptaxJson[taxCode]).length<=0)throw new Error("第"+(Number(i)+1)+"行税码在税码表中不存在，生成日记账失败。");
                            if(jptaxJson && jptaxJson[taxCode] && Object.keys(jptaxJson[taxCode]).length>0){
                                tax = jptaxJson[taxCode]["rate"]?decimal.divN(jptaxJson[taxCode]["rate"],100):0;
                                swcTaxrate = jptaxJson[taxCode]["rate"]?jptaxJson[taxCode]["rate"]+"%":"";
                                jptax = jptaxJson[taxCode]["jptax"]?jptaxJson[taxCode]["jptax"]:0;
                            }
                        }
                        log.audit("tax",tax);
                        log.audit("jptax",jptax);
                        //taxrate1 = exReportRec.getSublistValue({sublistId:"expense",fieldId:"taxrate1",line:i});//税率
                        //}
                        var memo = exReportRec.getSublistValue({sublistId:"expense",fieldId:"memo",line:i});//memo
                        var costCenter = exReportRec.getSublistValue({sublistId:"expense",fieldId:"custcol_swc_cost_centerid",line:i});//cost center
                        var expenseUrl = exReportRec.getSublistValue({sublistId:"expense",fieldId:"custcol_expense_url",line:i});//RECEIPT URL
                        var thisMemo = employeeName +"/reimburse/"+ costCenter + "/" +category+ "/"+memo;//规则：员工报销 costcenter 费用报销的category/费用报销的memo
                        var csegswcpro =departmentJson[department]//项目(日记账)
                        //如果是最后一行后，新增一行贷记
                        if(flag){
                            var subRecord = journalRec.selectNewLine({sublistId: 'line'});
                            subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'account', value: "1308"});//贷方科目--224101 其他应付款_应付报销款
                            subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'credit', value: creditAmount});//贷记
                            log.audit("creditAmount贷记",creditAmount);
                            //if(taxCode)subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'taxCode', value: taxCode});//税码
                            subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'memo', value: thisMemo});//摘要
                            //if(department)subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'department', value: department});//部门
                            //if(costCenter)subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'custcol_swc_cost_centerid', value: costCenter});//cost center
                            if(employee)subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'custcol_swc_jon_employee', value: employee});//员工
                            //if(csegswcpro)subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'cseg_swc_pro', value: csegswcpro});//项目(日记账)
                            if(country && custCountryJson[country])subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'cseg_swc_region', value: custCountryJson[country]});//地区
                            //if(expenseUrl)subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'custcol_expense_url', value: expenseUrl});//receipt url
                            subRecord.commitLine({sublistId: 'line'});
                            break;
                        }
                        log.audit("account",account);
                        var subRecord = journalRec.selectNewLine({sublistId: 'line'});
                        subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'account', value: account});//借方科目

                        if(subsidiary =="9" && taxCode){
                            var grossamt = exReportRec.getSublistValue({sublistId:"expense",fieldId:"grossamt",line:i});//总金额
                            subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'taxcode', value: taxCode});//税码
                            log.audit("get-taxCode",subRecord.getCurrentSublistValue({sublistId: 'line', fieldId: 'taxcode'}));
                            log.audit("借记amount",amount);//未税金额
                            //如果是日本的情况下 通过费用报告计算税额
                            var jpyTax1amt =0;//增值税金额
                            // if(jptax){
                            //     var thisTax1amt = decimal.divN(decimal.mulN(Number(amount),tax),100);
                            //     jpyTax1amt = (decimal.mulN(thisTax1amt,jptax)).toFixed(0);
                            // }else {
                            //     jpyTax1amt = (decimal.divN(decimal.mulN(Number(amount),tax),100)).toFixed(0);
                            // }
                            //未税金额= 总金额/ （（税率*日本）+1 ）  作废
                            //总金额= 未税金额*（（税率*日本）+1 ）  作废

                            //税额 = 未税金额*税率*日本
                            if(jptax){
                                jpyTax1amt = (decimal.mulN(amount,decimal.mulN(tax,jptax))).toFixed(0);
                            }else {
                                jpyTax1amt = (decimal.mulN(amount,tax)).toFixed(0);
                            }
                            //未税金额1（借记） = 总金额-税额
                            var newAmount = decimal.subN(grossamt,jpyTax1amt);//新借记
                            log.audit("grossamt",grossamt);
                            log.audit("newAmount",newAmount);
                            //jpyTax1amt = (decimal.subN(allAmount,amount)).toFixed(0);
                            log.audit("jpyTax1amt税额",jpyTax1amt);
                            subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'debit', value: newAmount});//借记
                            creditAmount += Number(newAmount); //金额累加
                            subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'tax1amt', value:jpyTax1amt});// 增值税金额
                            subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'custcol_swc_report_taxcode', value: taxCode});// 税码(CUSTOM)
                            if(tax)subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'custcol_swc_taxrate', value: swcTaxrate});// 税率(CUSTOM)
                            if(jpyTax1amt)subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'custcol_swc_taxamount', value: jpyTax1amt});// 税额(CUSTOM)
                            subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'tax1acct', value:SWC_CONFIG_DATA.configData().TAX1ACCT_YJSF});// 纳税科目  应交税费_暂收消费税（消费税销项税额
                            creditAmount += Number(jpyTax1amt); //金额累加
                        }else {
                            subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'debit', value: amount});//借记
                            creditAmount += Number(amount); //金额累加
                        }
                        subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'memo', value: thisMemo});// 摘要
                        if(department)subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'department', value: department});//部门
                        if(costCenter)subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'custcol_swc_cost_centerid', value: costCenter});//cost center
                        if(employee)subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'custcol_swc_jon_employee', value: employee});//员工
                        if(csegswcpro)subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'cseg_swc_pro', value: csegswcpro});//项目(日记账)
                        if(country && custCountryJson[country])subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'cseg_swc_region', value: custCountryJson[country]});//地区
                        if(expenseUrl)subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'custcol_expense_url', value: expenseUrl});//receipt url
                        //var grossamt = subRecord.getCurrentSublistValue({sublistId: 'line', fieldId: 'grossamt'});//总金额
                        subRecord.commitLine({sublistId: 'line'});
                        //如果子公司不是日本的情况下
                        if(subsidiary !="9" && tax1amt && taxAccount){
                            var subRecord = journalRec.selectNewLine({sublistId: 'line'});
                            subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'account', value: taxAccount});//借方税科目
                            subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'debit', value: tax1amt});//借记
                            log.audit("不是日本的借记金额",tax1amt);
                            //if(taxCode)subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'taxCode', value: taxCode});//税码
                            subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'memo', value: thisMemo});// 摘要
                            if(department)subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'department', value: department});//部门
                            if(costCenter)subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'custcol_swc_cost_centerid', value: costCenter});//cost center
                            if(employee)subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'custcol_swc_jon_employee', value: employee});//员工
                            if(csegswcpro)subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'cseg_swc_pro', value: csegswcpro});//项目(日记账)
                            if(country && custCountryJson[country])subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'cseg_swc_region', value: custCountryJson[country]});//地区
                            if(expenseUrl)subRecord.setCurrentSublistValue({sublistId: 'line', fieldId: 'custcol_expense_url', value: expenseUrl});//receipt url
                            //var grossamt = subRecord.getCurrentSublistValue({sublistId: 'line', fieldId: 'grossamt'});//总金额
                            creditAmount += Number(tax1amt); //金额累加
                            subRecord.commitLine({sublistId: 'line'});
                        }

                    }
                }
                var journalId = journalRec.save();
                if(journalId){
                    exReportRec.setValue({fieldId:"custbody_swc_related_journal",value:journalId});//相关日记账
                    exReportRec.setValue({fieldId:"custbody_swc_joural_error",value:""});
                    exReportRec.save();
                }
            }catch (e) {
                exReportRec.setValue({fieldId:"custbody_swc_joural_error",value:e.message});//生成日记账错误
                exReportRec.save();
                throw e.message;
            }


        }

        /**
         * Navan费用报销凭证接口
         * @param options
         */
        function getNavanVoucher(options){
            try {
                var flag = false;
                var output = options.output;
                log.audit("getNavanVoucher-options.output",options.output);
                var id = output["ID"];//id 唯一键
                var externalId = "EXPENSE_REPORT_"+id;
                var thisId = Commons.searchByExternalId(externalId, record.Type.EXPENSE_REPORT);
                log.audit("thisId",thisId);
                if(thisId)return;
                if(!id)throw new Error("ID字段不存在！");
                var entity = output["CARDHOLDER_EMAIL"];//员工
                if(!entity)throw new Error("员工CARDHOLDER_EMAIL字段不存在！");
                var memo = output["TRANSACTION_DESCRIPTION"];//备注
                //var trandate = output["LAST_APPROVER_ACTION_DATE"];//日期
                var trandate = output["newTranslate"];//日期 取拉取当天的日期 如：2024-11-15,2024-11-30
                var subsidiary = output["BILLABLE_ENTITY"];//子公司
                if(!subsidiary)throw new Error("子公司BILLABLE_ENTITY字段不存在！");
                var statementId = output["STATEMENT_ID"];//STATEMENT ID
                var navanType = output["ACTIVITY_TYPE"];//
                if(!navanType)throw new Error("业务类型ACTIVITY_TYPE字段不存在！");
                log.audit("navanType",navanType);
                //明细
                var date = output["LAST_APPROVER_ACTION_DATE"];//Date
                var glCodeNumber = output["GL_CODE_NUMBER"];//GL_CODE_NUMBER
                var glCodeName = output["GL_CODE_NAME"];//GL_CODE_NAME
                var entityCurrency = output["BILLABLE_ENTITY_CURRENCY"];//BILLABLE_ENTITY_CURRENCY
                var costCenter = output["TRANSACTION_COST_CENTER"];//TRANSACTION_COST_CENTER
                if(!costCenter)throw new Error("部门TRANSACTION_COST_CENTER字段不存在！");
                //var entityAmount = output["LEGAL_ENTITY_AMOUNT"];//LEGAL_ENTITY_AMOUNT
                var postedAmount = output["POSTED_AMOUNT"];//POSTED_AMOUNT
                var taxType = output["TAX_TYPE_1"];//税码
                var taxType2 = output["TAX_TYPE_2"];//税码
                var taxType3 = output["TAX_TYPE_3"];//税码
                var netAmount = output["NET_AMOUNT_1"];//未税金额
                var netAmount2 = output["NET_AMOUNT_2"];//未税金额
                var netAmount3 = output["NET_AMOUNT_3"];//未税金额
                var taxAmount = output["TAX_AMOUNT_1"];//税额
                var taxAmount2 = output["TAX_AMOUNT_2"];//税额
                var taxAmount3 = output["TAX_AMOUNT_3"];//税额
                var cardholder = output["CARDHOLDER"];//CARDHOLDER
                var chrdholderEmail = output["CARDHOLDER_EMAIL"];//CARDHOLDER_EMAIL
                var merchantName = output["MERCHANT_NAME"];//MERCHANT_NAME
                var postedCurrency = output["POSTED_CURRENCY"];//POSTED_CURRENCY
                var legalEntityCurrency = output["LEGAL_ENTITY_CURRENCY"];//LEGAL_ENTITY_CURRENCY
                if(!postedCurrency)throw new Error("币种POSTED_CURRENCY字段不存在！");
                var department = output["TRANSACTION_DEPARTMENT"];
                if (!department)throw new Error("部门TRANSACTION_DEPARTMENT字段不存在！");

                log.audit("trandate",trandate);
                if(trandate){
                    trandate.slice(5,7);
                }
                //CARDHOLDER_EMAIL/reimburse/TRANSACTION_COST_CENTER/TRANSACTION_DESCRIPTION/MERCHANT_NAME/GL_CODE_NUMBER GL_CODE_NAME/NAVAN ID/Navan reimbursement_月份
                var subMemo = chrdholderEmail+"/reimburse/"+costCenter+"/"+memo+"/"+merchantName+"/"+glCodeNumber+" "+glCodeName+"/"+id+"/Navan reimbursement_"+trandate;

                var exReportRec = record.create({type:record.Type.EXPENSE_REPORT,isDynamic:true});//创建费用报告
                var subsidiaryId = SWC_CONFIG_DATA.configData().NAVAN_SUBSIDIARY[subsidiary];//子公司ID
                if(!subsidiaryId)throw new Error("子公司"+subsidiary+"没有找到对应的映射关系");
                var empId = Commons.srchEmpIdByEmail(entity, subsidiaryId);//根据邮箱+子公司查询员工
                exReportRec.setValue({fieldId:"entity",value:empId});//员工
                if(memo)exReportRec.setValue({fieldId:"memo",value:memo});//备注
                var newTrandate = trandate?format.parse({value:new Date(format.parse({value: trandate,type:format.Type.DATE})),type:format.Type.DATE}) : "";
                if(newTrandate)exReportRec.setValue({fieldId:"trandate",value:newTrandate});//日期
                // if(subsidiaryId == 8)subsidiaryId = 28;
                exReportRec.setValue({fieldId:"subsidiary",value:subsidiaryId});//子公司
                if(statementId)exReportRec.setValue({fieldId:"custbody_swc_statement_id",value:statementId});//STATEMENT ID
                exReportRec.setValue({fieldId:"custbody_swc_navan_id",value:id});//NAVAN ID
                //Purchase/Manual Transaction/REPAYMENTS
                exReportRec.setText({fieldId:"custbody_swc_navan_type",text:navanType});//NAVAN业务类型
                exReportRec.setValue({fieldId:"custbody_swc_navan_flag",value:true});//NAVAN接口订单
                exReportRec.setValue({fieldId: 'externalid', value: externalId});//外部id
                //如果是日本 并且类型是Manual Transaction 则币种赋值LEGAL_ENTITY_CURRENCY
                if(subsidiary == "PingCAP Kabushiki-Kaisha" && navanType == "Manual Transaction"){
                    if(!legalEntityCurrency)throw new Error("币种legalEntityCurrency字段不存在！");
                    exReportRec.setText({fieldId: 'expensereportcurrency', text: legalEntityCurrency});//币种
                }else {
                    exReportRec.setText({fieldId: 'expensereportcurrency', text: postedCurrency});//币种

                }
                //TODO 日本  只有日本的manual transaction取的net_amount和税，其他的都不用考虑税
                if(subsidiary == "PingCAP Kabushiki-Kaisha" && navanType=="Manual Transaction"){

                    //  NET_AMOUNT_1+TAX_AMOUNT_1=>FOREIGN AMOUNT
                    //   NET_AMOUNT_1=>AMOUNT
                    //   TAX_TYPE_1=>税码
                    // TAX_AMOUNT_1=>税额
                    //   NET_AMOUNT_1是否大于0， NET_AMOUNT_2， NET_AMOUNT_3以此类推
                    if(netAmount && netAmount>0){
                        exReportRec.selectNewLine({sublistId:"expense"});
                        var newDate = date?format.parse({value:new Date(format.parse({value: date,type:format.Type.DATE})),type:format.Type.DATE}) : "";
                        if(newDate)exReportRec.setCurrentSublistValue({sublistId:"expense",fieldId:"expensedate",value:newDate});//Date
                        var category = Commons.srchExpenseCategoryIdByName(glCodeNumber+" "+glCodeName);//根据费用类别名称查询id
                        if(!category)throw new Error("根据GL_CODE_NUMBER:"+glCodeNumber+" GL_CODE_NAME:"+glCodeName+"，未在NS检索到费用类别数据");
                        exReportRec.setCurrentSublistValue({sublistId:"expense",fieldId:"category",value:category});//Category
                        var account = Commons.srchAccountIdByCode(glCodeNumber);//根据科目编号查询科目id
                        if(account)exReportRec.setCurrentSublistValue({sublistId:"expense",fieldId:"custcol_swc_navan_account_display",value:account});//Navan费用科目
                        //日本LEGAL_ENTITY_AMOUNT，美国+新加坡POSTED_AMOUNT
                        log.audit("subsidiary",subsidiary);
                        exReportRec.setCurrentSublistValue({sublistId:"expense",fieldId:"memo",value:subMemo});//MEMO
                        exReportRec.setCurrentSublistValue({sublistId:"expense",fieldId:"custcol_swc_cost_centerid",value:costCenter});//COST CENTER
                        /*var deptId = Commons.srchDeptIdByName(costCenter)//根据【Cost Center ID + Name (自定义)】查询部门id
                        if(!deptId)throw new Error("TRANSACTION_COST_CENTER部门对应系统中的部门不存在！");*/
                        var deptId = getDepartmentId(department);
                        if(!deptId)throw new Error("TRANSACTION_DEPARTMENT部门对应系统中的部门不存在！");
                        exReportRec.setCurrentSublistValue({sublistId:"expense",fieldId:"department",value:deptId});//Department

                        if(netAmount && netAmount<0){
                            netAmount = Math.abs(netAmount);
                            flag = true;
                        }
                        if(taxAmount && taxAmount<0){
                            taxAmount = Math.abs(taxAmount);
                            flag = true;
                        }
                        exReportRec.setCurrentSublistValue({sublistId:"expense",fieldId:"foreignamount",value:decimal.addN(netAmount,taxAmount)});//Foreign Amount =  NET_AMOUNT_1+TAX_AMOUNT_1
                        exReportRec.setCurrentSublistText({sublistId:"expense",fieldId:"currency",text:entityCurrency});//currency
                        log.audit("taxType",taxType);

                        //1%对应的是 JCT 10 (控80%) ，2%对应的是 JCT 8 (控80%) CT 1%
                        if(taxType == "CT 1%"){
                            exReportRec.setCurrentSublistValue({sublistId:"expense",fieldId:"taxcode",value:690});//税码 JCT 10 (控80%) 680  690
                        }
                        if(taxType == "CT 2%"){
                            exReportRec.setCurrentSublistValue({sublistId:"expense",fieldId:"taxcode",value:689});//税码 JCT 8 (控80%)  679 689
                        }
                        if(taxType == "CT 8%"){
                            exReportRec.setCurrentSublistValue({sublistId:"expense",fieldId:"taxcode",value:15});//税码 JP_JCT 8
                        }
                        if(taxType == "CT 10%"){
                            exReportRec.setCurrentSublistValue({sublistId:"expense",fieldId:"taxcode",value:16});//税码 JP_JCT 10
                        }
                        if(netAmount)exReportRec.setCurrentSublistValue({sublistId:"expense",fieldId:"amount",value:netAmount});//未税金额
                        if(taxAmount)exReportRec.setCurrentSublistValue({sublistId:"expense",fieldId:"tax1amt",value:taxAmount});//税额

                        exReportRec.commitLine({sublistId: 'expense'});
                    }
                    if(netAmount2 && netAmount2>0){
                        exReportRec.selectNewLine({sublistId:"expense"});
                        var newDate = date?format.parse({value:new Date(format.parse({value: date,type:format.Type.DATE})),type:format.Type.DATE}) : "";
                        if(newDate)exReportRec.setCurrentSublistValue({sublistId:"expense",fieldId:"expensedate",value:newDate});//Date
                        var category = Commons.srchExpenseCategoryIdByName(glCodeNumber+" "+glCodeName);//根据费用类别名称查询id
                        if(!category)throw new Error("根据GL_CODE_NUMBER:"+glCodeNumber+" GL_CODE_NAME:"+glCodeName+"，未在NS检索到费用类别数据");
                        exReportRec.setCurrentSublistValue({sublistId:"expense",fieldId:"category",value:category});//Category
                        var account = Commons.srchAccountIdByCode(glCodeNumber);//根据科目编号查询科目id
                        if(account)exReportRec.setCurrentSublistValue({sublistId:"expense",fieldId:"custcol_swc_navan_account_display",value:account});//Navan费用科目
                        //日本LEGAL_ENTITY_AMOUNT，美国+新加坡POSTED_AMOUNT
                        log.audit("subsidiary",subsidiary);
                        exReportRec.setCurrentSublistValue({sublistId:"expense",fieldId:"memo",value:subMemo});//MEMO
                        exReportRec.setCurrentSublistValue({sublistId:"expense",fieldId:"custcol_swc_cost_centerid",value:costCenter});//COST CENTER
                        /*var deptId = Commons.srchDeptIdByName(costCenter)//根据【Cost Center ID + Name (自定义)】查询部门id
                        if(!deptId)throw new Error("TRANSACTION_COST_CENTER部门对应系统中的部门不存在！");*/
                        var deptId = getDepartmentId(department);
                        if(!deptId)throw new Error("TRANSACTION_DEPARTMENT部门对应系统中的部门不存在！");
                        exReportRec.setCurrentSublistValue({sublistId:"expense",fieldId:"department",value:deptId});//Department

                        if(netAmount2 && netAmount2<0){
                            netAmount2 = Math.abs(netAmount2);
                            flag = true;
                        }
                        if(taxAmount2 && taxAmount2<0){
                            taxAmount2 = Math.abs(taxAmount2);
                            flag = true;
                        }
                        exReportRec.setCurrentSublistValue({sublistId:"expense",fieldId:"foreignamount",value:decimal.addN(netAmount2,taxAmount2)});//Foreign Amount =  NET_AMOUNT_1+TAX_AMOUNT_1
                        exReportRec.setCurrentSublistText({sublistId:"expense",fieldId:"currency",text:entityCurrency});//currency
                        log.audit("taxType2",taxType2);

                        //1%对应的是 JCT 10 (控80%) ，2%对应的是 JCT 8 (控80%) CT 1%
                        if(taxType2 == "CT 1%"){
                            exReportRec.setCurrentSublistValue({sublistId:"expense",fieldId:"taxcode",value:690});//税码 JCT 10 (控80%)
                        }
                        if(taxType2 == "CT 2%"){
                            exReportRec.setCurrentSublistValue({sublistId:"expense",fieldId:"taxcode",value:689});//税码 JCT 8 (控80%)
                        }
                        if(taxType2 == "CT 8%"){
                            exReportRec.setCurrentSublistValue({sublistId:"expense",fieldId:"taxcode",value:15});//税码 JP_JCT 8
                        }
                        if(taxType2 == "CT 10%"){
                            exReportRec.setCurrentSublistValue({sublistId:"expense",fieldId:"taxcode",value:16});//税码 JP_JCT 10
                        }
                        if(netAmount2)exReportRec.setCurrentSublistValue({sublistId:"expense",fieldId:"amount",value:netAmount2});//未税金额
                        if(taxAmount2)exReportRec.setCurrentSublistValue({sublistId:"expense",fieldId:"tax1amt",value:taxAmount2});//税额

                        exReportRec.commitLine({sublistId: 'expense'});
                    }
                    if(netAmount3 && netAmount3>0){
                        exReportRec.selectNewLine({sublistId:"expense"});
                        var newDate = date?format.parse({value:new Date(format.parse({value: date,type:format.Type.DATE})),type:format.Type.DATE}) : "";
                        if(newDate)exReportRec.setCurrentSublistValue({sublistId:"expense",fieldId:"expensedate",value:newDate});//Date
                        var category = Commons.srchExpenseCategoryIdByName(glCodeNumber+" "+glCodeName);//根据费用类别名称查询id
                        if(!category)throw new Error("根据GL_CODE_NUMBER:"+glCodeNumber+" GL_CODE_NAME:"+glCodeName+"，未在NS检索到费用类别数据");
                        exReportRec.setCurrentSublistValue({sublistId:"expense",fieldId:"category",value:category});//Category
                        var account = Commons.srchAccountIdByCode(glCodeNumber);//根据科目编号查询科目id
                        if(account)exReportRec.setCurrentSublistValue({sublistId:"expense",fieldId:"custcol_swc_navan_account_display",value:account});//Navan费用科目
                        //日本LEGAL_ENTITY_AMOUNT，美国+新加坡POSTED_AMOUNT
                        log.audit("subsidiary",subsidiary);
                        exReportRec.setCurrentSublistValue({sublistId:"expense",fieldId:"memo",value:subMemo});//MEMO
                        exReportRec.setCurrentSublistValue({sublistId:"expense",fieldId:"custcol_swc_cost_centerid",value:costCenter});//COST CENTER
                        /*var deptId = Commons.srchDeptIdByName(costCenter)//根据【Cost Center ID + Name (自定义)】查询部门id
                        if(!deptId)throw new Error("TRANSACTION_COST_CENTER部门对应系统中的部门不存在！");*/
                        var deptId = getDepartmentId(department);
                        if(!deptId)throw new Error("TRANSACTION_DEPARTMENT部门对应系统中的部门不存在！");
                        exReportRec.setCurrentSublistValue({sublistId:"expense",fieldId:"department",value:deptId});//Department

                        if(netAmount3 && netAmount3<0){
                            netAmount3 = Math.abs(netAmount3);
                            flag = true;
                        }
                        if(taxAmount3 && taxAmount3<0){
                            taxAmount3 = Math.abs(taxAmount3);
                            flag = true;
                        }
                        exReportRec.setCurrentSublistValue({sublistId:"expense",fieldId:"foreignamount",value:decimal.addN(netAmount3,taxAmount3)});//Foreign Amount =  NET_AMOUNT_1+TAX_AMOUNT_1
                        exReportRec.setCurrentSublistText({sublistId:"expense",fieldId:"currency",text:entityCurrency});//currency
                        log.audit("taxType3",taxType3);

                        //1%对应的是 JCT 10 (控80%) ，2%对应的是 JCT 8 (控80%) CT 1%
                        if(taxType3 == "CT 1%"){
                            exReportRec.setCurrentSublistValue({sublistId:"expense",fieldId:"taxcode",value:690});//税码 JCT 10 (控80%)
                        }
                        if(taxType3 == "CT 2%"){
                            exReportRec.setCurrentSublistValue({sublistId:"expense",fieldId:"taxcode",value:689});//税码 JCT 8 (控80%)
                        }
                        if(taxType3 == "CT 8%"){
                            exReportRec.setCurrentSublistValue({sublistId:"expense",fieldId:"taxcode",value:15});//税码 JP_JCT 8
                        }
                        if(taxType3 == "CT 10%"){
                            exReportRec.setCurrentSublistValue({sublistId:"expense",fieldId:"taxcode",value:16});//税码 JP_JCT 10
                        }
                        if(netAmount3)exReportRec.setCurrentSublistValue({sublistId:"expense",fieldId:"amount",value:netAmount3});//未税金额
                        if(taxAmount3)exReportRec.setCurrentSublistValue({sublistId:"expense",fieldId:"tax1amt",value:taxAmount3});//税额

                        exReportRec.commitLine({sublistId: 'expense'});

                    }
                }else {
                    //美国 新加坡
                    // if(navanType=="Refund" || navanType=="Purchase" || navanType=="Manual Transaction"){
                    exReportRec.selectNewLine({sublistId:"expense"});
                    var newDate = date?format.parse({value:new Date(format.parse({value: date,type:format.Type.DATE})),type:format.Type.DATE}) : "";
                    if(newDate)exReportRec.setCurrentSublistValue({sublistId:"expense",fieldId:"expensedate",value:newDate});//Date
                    var category = Commons.srchExpenseCategoryIdByName(glCodeNumber+" "+glCodeName);//根据费用类别名称查询id
                    if(!category)throw new Error("根据GL_CODE_NUMBER:"+glCodeNumber+" GL_CODE_NAME:"+glCodeName+"，未在NS检索到费用类别数据");
                    exReportRec.setCurrentSublistValue({sublistId:"expense",fieldId:"category",value:category});//Category
                    var account = Commons.srchAccountIdByCode(glCodeNumber);//根据科目编号查询科目id
                    if(account)exReportRec.setCurrentSublistValue({sublistId:"expense",fieldId:"custcol_swc_navan_account_display",value:account});//Navan费用科目
                    //日本LEGAL_ENTITY_AMOUNT，美国+新加坡POSTED_AMOUNT
                    //美国和新加坡是 USD，日本取BILLABLE_ENTITY_CURRENCY
                    if(postedAmount && postedAmount<0){
                        postedAmount = Math.abs(postedAmount);
                        flag = true;
                    }
                    exReportRec.setCurrentSublistValue({sublistId:"expense",fieldId:"foreignamount",value:postedAmount});//Foreign Amount
                    exReportRec.setCurrentSublistValue({sublistId:"expense",fieldId:"currency",value:2});//currency USD
                    log.audit("subsidiary",subsidiary);
                    exReportRec.setCurrentSublistValue({sublistId:"expense",fieldId:"memo",value:subMemo});//MEMO
                    exReportRec.setCurrentSublistValue({sublistId:"expense",fieldId:"custcol_swc_cost_centerid",value:costCenter});//COST CENTER
                    /*var deptId = Commons.srchDeptIdByName(costCenter)//根据【Cost Center ID + Name (自定义)】查询部门id
                    if(!deptId)throw new Error("TRANSACTION_COST_CENTER部门对应系统中的部门不存在！");*/
                    var deptId = getDepartmentId(department);
                    if(!deptId)throw new Error("TRANSACTION_DEPARTMENT部门对应系统中的部门不存在！");
                    exReportRec.setCurrentSublistValue({sublistId:"expense",fieldId:"department",value:deptId});//Department
                    if(postedAmount)exReportRec.setCurrentSublistValue({sublistId:"expense",fieldId:"amount",value:postedAmount});//未税金额
                    exReportRec.commitLine({sublistId: 'expense'});
                    // }
                }

                if(flag)exReportRec.setValue({fieldId: 'custbody_swc_negative_cost', value: true});// 负数费用报告
                var exReportRecId = exReportRec.save();
                log.audit("exReportRecId",exReportRecId);
            }catch (e) {
                throw "创建费用报告报错，错误信息："+e.message;
            }

        }

        /**
         * 通过custrecord_navan_department查询部门id
         * @param departmentName
         * @returns {string}
         */
        function getDepartmentId(departmentName) {
            if(!departmentName)return "";
            var id = "";
            var departmentSearchObj = search.create({
                type: "department",
                filters:
                    [
                        ["custrecord_navan_department","is",departmentName]
                    ],
                columns:
                    [
                        search.createColumn({name: "internalid", label: "内部 ID"})
                    ]
            });

            departmentSearchObj.run().each(function(result) {
                id = result.getValue({name: "internalid"});
                return true;
            });
            return id;
        }

        //日期转换
        function getModifyDate(date){
            if(date && date !="null"){
                var modifyDateArr = date.split("-"); // [2022,11,11];
                return format.parse({
                    value:(format.format({
                        value:new Date(modifyDateArr[0],Number(modifyDateArr[1])-1,modifyDateArr[2]),
                        type:format.Type.DATETIME,
                        timezone:format.Timezone.ASIA_HONG_KONG
                    })).split(' ')[0],
                    type:format.Type.DATE
                });
            }
            return "";
        }

        function zeroPush(string) {
            if(String(string).length == 1) {
                return "0"+string;
            } else {
                return string;
            }
        }

        return{
            getEmployee : getEmployee // zcg authing 处理员工增改
            ,getEmployee_new : getEmployee_new // zcg authing(new) 处理员工增改
            ,getDepartment : getDepartment // zcg authing 处理部门增改
            ,getDepartment_new : getDepartment_new // zcg authing(new) 处理部门增改
            ,getSalesforceQuery : getSalesforceQuery // jjp salesforce 创建各个单据接口
            ,getSalesforceCollection :getSalesforceCollection // jjp salesforce 创建发票接口
            ,getSalesforceDelete : getSalesforceDelete // jjp salesforce 删除各个单据接口
            ,getFsAuditStatus: getFsAuditStatus //jjp 飞书 采购申请|付款申请 拉取飞书审批状态--调用飞书
            ,getFsAuditStatusToNS: getFsAuditStatusToNS //jjp 飞书 采购申请|付款申请 拉取飞书审批状态--调用NS（临时使用）
            ,getSalesforceSaleOrder : getSalesforceSaleOrder // jjp salesforce 手动创建task 生成销售订单
            ,getEmployeeFeiShuId : getEmployeeFeiShuId // zcg 飞书员工ID同步NS
            ,getEmployeeFeiShuOUId : getEmployeeFeiShuOUId // zcg 飞书员工ouID同步NS
            ,getKingdeeVoucher: getKingdeeVoucher // tyl kingdee 金蝶云星空凭证同步NS日记账
            ,updSalesforceCollection: updSalesforceCollection // tyl Salesforce Collection-更新发票接口
            ,updatePaymentStatus : updatePaymentStatus
            ,addAccountLog : addAccountLog
            ,addAccountImage : addAccountImage
            ,updatePaymentStatusOfRefund : updatePaymentStatusOfRefund
            ,updateReceiptsLogRec : updateReceiptsLogRec
            ,getFeiShuContractFile : getFeiShuContractFile // zcg 飞书 生成系统文件。并将合同存到采购订单下
            ,createExReportToJournal : createExReportToJournal //费用报销生成日记账
            ,getNavanVoucher : getNavanVoucher // Navan费用报销凭证接口
        }
    });
