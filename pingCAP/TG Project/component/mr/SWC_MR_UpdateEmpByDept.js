/**
 * @NApiVersion 2.1
 * @NScriptType mapreducescript
 * @NModuleScope Public
 */
define(["N/runtime","N/record","N/search"],
    /**
     *  ①定期抓取订单列表（不包含订单明细）
     *  ②定期抓到账信息
     * ["custrecord_swct_tran_name","noneof","26"],"and",
     * ["custrecord_swct_tran_name","noneof","144","145"] => 金蝶云星空凭证拉取："getKingdeeVoucherList", "getKingdeeVoucher";
     */
    function(runtime,record,search){
            return {
                    getInputData: function (context)
                    {
                            var maps = new Map();
                            var employeeSearchObj = search.create({
                                    type: "employee",
                                    filters:
                                        [
                                                ["department","noneof","@NONE@"],
                                                "AND",
                                                ["email","contains","pingcap"],
                                                "AND",
                                                ["isinactive","is","F"]
                                        ],
                                    columns:
                                        [
                                                search.createColumn({name: "internalid", label: "内部 ID"}),
                                                search.createColumn({name: "entityid", sort: search.Sort.ASC, label: "名称"}),
                                                search.createColumn({name: "custrecord_swc_fpa", join: "department", label: "FP&A"}),
                                                search.createColumn({name: "custrecord_swc_depart_leader", join: "department", label: "Depart. Leader"}),
                                                search.createColumn({name: "custrecord_swc_phurse_group", join: "department", label: "采购小组"}),
                                                search.createColumn({name: "custrecord_swc_budget_owner", join: "department", label: "Budget Owner"})
                                        ]
                            });
                            var srchRst = getAllResultsOfSearch(employeeSearchObj);
                            for (var i = 0; i < srchRst.length; i++) {
                                    var empJson = {};
                                    var empId = srchRst[i].getValue({name: "internalid", label: "内部 ID"}); // 员工内部 ID
                                    var entityid = srchRst[i].getValue({name: "entityid", sort: search.Sort.ASC, label: "名称"});
                                    var fpa = srchRst[i].getValue({name: "custrecord_swc_fpa", join: "department", label: "FP&A"});
                                    var leader = srchRst[i].getValue({name: "custrecord_swc_depart_leader", join: "department", label: "Depart. Leader"});
                                    var phurseGroup = srchRst[i].getValue({name: "custrecord_swc_phurse_group", join: "department", label: "采购小组"});
                                    var budgetOwner = srchRst[i].getValue({name: "custrecord_swc_budget_owner", join: "department", label: "Budget Owner"});

                                    if(empId){
                                            empJson["empId"] = empId;
                                            empJson["entityid"] = entityid;
                                            empJson["fpa"] = fpa;
                                            empJson["leader"] = leader;
                                            empJson["phurseGroup"] = phurseGroup;
                                            empJson["budgetOwner"] = budgetOwner;

                                    }
                                    maps.set(empId,empJson);
                            }
                            return Array.from(maps);
                    },
                    map: function (context)
                    {
                            try {
                                    var options = JSON.parse(context.value);
                                    //log.audit({title:"context.key" , details:options[0]});
                                    //log.audit({title:"context.value" , details:options[1]});
                                    var empId = options[0];//员工ID
                                    var empJson = options[1];//{"empId":"5924","entityid":"Aaron Alvarez","fpa":"","leader":"284","phurseGroup":"","budgetOwner":"273"}
                                    if(empId && Object.keys(empJson)){
                                            var empRec = record.load({id:empId,type:"employee",isDynamic:true});
                                            var custentity_swc_depart_leader = empRec.getValue({fieldId:"custentity_swc_depart_leader"})?empRec.getValue({fieldId:"custentity_swc_depart_leader"}):"";//DEPART. LEADER
                                            var custentity_swc_fpa = empRec.getValue({fieldId:"custentity_swc_fpa"})?empRec.getValue({fieldId:"custentity_swc_fpa"}):"";//FP&A
                                            var custentity_swc_budget_owner = empRec.getValue({fieldId:"custentity_swc_budget_owner"})?empRec.getValue({fieldId:"custentity_swc_budget_owner"}):"";//BUDGET OWNER
                                            var custentity_swc_phurse_group = empRec.getValue({fieldId:"custentity_swc_phurse_group"})?empRec.getValue({fieldId:"custentity_swc_phurse_group"}):"";//采购小组

                                            var fpa = empJson["fpa"]?empJson["fpa"]:"";
                                            var leader = empJson["leader"]?empJson["leader"]:"";
                                            var phurseGroup = empJson["phurseGroup"]?empJson["phurseGroup"]:"";
                                            var budgetOwner = empJson["budgetOwner"]?empJson["budgetOwner"]:"";
                                            //如果有不相等的字段则更新
                                            var flag = false;
                                            if(custentity_swc_depart_leader!=leader){
                                                    empRec.setValue({fieldId:"custentity_swc_depart_leader",value:leader});
                                                    flag = true;
                                            }
                                            if(custentity_swc_fpa!=fpa){
                                                    empRec.setValue({fieldId:"custentity_swc_fpa",value:fpa});
                                                    flag = true;
                                            }
                                            if(custentity_swc_budget_owner!=budgetOwner){
                                                    empRec.setValue({fieldId:"custentity_swc_budget_owner",value:budgetOwner});
                                                    flag = true;
                                            }
                                            if(custentity_swc_phurse_group!=phurseGroup){
                                                    empRec.setValue({fieldId:"custentity_swc_phurse_group",value:phurseGroup});
                                                    flag = true;
                                            }
                                            if(flag){
                                                    empRec.save();
                                                    log.audit("员工被修改 ID：",empId);
                                            }
                                    }
                            }catch (e) {
                                    throw e.message;
                            }

                    },

                    // reduce: function (context)
                    // {
                    //         context.write({
                    //                 key: context.key,
                    //                 value: context.values
                    //         });
                    // },
                    summarize: function (summary)
                    {
                            var counts = 0;
                            summary.output.iterator().each(function (key, value)
                            {
                                    log.audit({title: "summarize" + key,details: value});
                                    counts += 1;
                                    return true;
                            });
                            var errors = [];
                            summary.mapSummary.errors.iterator().each(function(key,error){
                                    log.audit({title:key,details:error});
                                    errors.push(error)
                                    return true;
                            });
                            // log.audit("counts", counts);
                            // log.audit("summary.usage", summary.usage);
                            log.audit("summary.errors", errors);
                    }
            }
            /**
             * 获取所有保存检索结果
             * @param saveSearch 保存检索
             * @return 数据结果数组
             */
            function getAllResultsOfSearch(saveSearch) {
                    var resultset = saveSearch.run();
                    var start = 0;
                    var step = 1000;
                    var resultArr = [];
                    var results = resultset.getRange({
                            start: start,
                            end: Number(start) + Number(step)
                    });
                    while (results && results.length > 0) {
                            resultArr = resultArr.concat(results);
                            start = Number(start) + Number(step);
                            results = resultset.getRange({
                                    start: start,
                                    end: Number(start) + Number(step)
                            });
                    }
                    return resultArr;
            }
    });
