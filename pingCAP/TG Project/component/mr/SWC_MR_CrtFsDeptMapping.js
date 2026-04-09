/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 * @author yltian
 * @description 创建飞书部门映射
 */
define(["N/https", "N/search", "N/util", "N/record"],
    
    (https, search, util, record) => {

        // 飞书秘钥
        var FS_APP_ID = "cli_a33f90d887fbd00c";
        var FS_APP_SECRET = "Xx8XoQCx3ntA5F1b70UVygmxddCazk3p";

        /**
         * Defines the function that is executed at the beginning of the map/reduce process and generates the input data.
         * @param {Object} inputContext
         * @param {boolean} inputContext.isRestarted - Indicates whether the current invocation of this function is the first
         *     invocation (if true, the current invocation is not the first invocation and this function has been restarted)
         * @param {Object} inputContext.ObjectRef - Object that references the input data
         * @typedef {Object} ObjectRef
         * @property {string|number} ObjectRef.id - Internal ID of the record instance that contains the input data
         * @property {string} ObjectRef.type - Type of the record instance that contains the input data
         * @returns {Array|Object|Search|ObjectRef|File|Query} The input data to use in the map/reduce process
         * @since 2015.2
         */

        const getInputData = (inputContext) => {
            // 取得飞书登录token
            var accessToken = getFsToken();

            var firstDeptObj = {};
            var secondDeptObj = {};
            var thirdDeptObj = {};
            var fourDeptObj = {};

            try {

                // 根部门ID为0，已确认根部门数量单次请求可以取得全部数据
                var openDeptId = 0;
                // 取得一级部门数据：{"一级-二级-三级-四级部门名称": {"接口返回的items明细数据"}, ...}
                var firstDeptObj = getDeptData({
                    "openDeptId": openDeptId,
                    "accessToken": accessToken,
                    "lastDeptName": null
                });
                // 根据一级部门取得二级部门
                Object.keys(firstDeptObj).forEach(function (value) {
                    var secondDeptObjTmp = getDeptData({
                        "openDeptId": firstDeptObj[value]["open_department_id"],
                        "accessToken": accessToken,
                        "lastDeptName": value
                    });
                    secondDeptObj = extend([secondDeptObj, secondDeptObjTmp]);
                });
                // 根据二级取三级部门
                Object.keys(secondDeptObj).forEach(function (value) {
                    var thirdDeptObjTmp = getDeptData({
                        "openDeptId": secondDeptObj[value]["open_department_id"],
                        "accessToken": accessToken,
                        "lastDeptName": value
                    });
                    thirdDeptObj = extend([thirdDeptObj, thirdDeptObjTmp]);
                });
                // 根据三级取4级
                Object.keys(thirdDeptObj).forEach(function (value) {
                    var fourDeptObjTmp = getDeptData({
                        "openDeptId": thirdDeptObj[value]["open_department_id"],
                        "accessToken": accessToken,
                        "lastDeptName": value
                    });
                    fourDeptObj = extend([fourDeptObj, fourDeptObjTmp]);
                });
            } catch (e) {
                throw new Error(e.message);
            }

            return extend([firstDeptObj, secondDeptObj, thirdDeptObj, fourDeptObj]);
        }

        /**
         * Defines the function that is executed when the map entry point is triggered. This entry point is triggered automatically
         * when the associated getInputData stage is complete. This function is applied to each key-value pair in the provided
         * context.
         * @param {Object} mapContext - Data collection containing the key-value pairs to process in the map stage. This parameter
         *     is provided automatically based on the results of the getInputData stage.
         * @param {Iterator} mapContext.errors - Serialized errors that were thrown during previous attempts to execute the map
         *     function on the current key-value pair
         * @param {number} mapContext.executionNo - Number of times the map function has been executed on the current key-value
         *     pair
         * @param {boolean} mapContext.isRestarted - Indicates whether the current invocation of this function is the first
         *     invocation (if true, the current invocation is not the first invocation and this function has been restarted)
         * @param {string} mapContext.key - Key to be processed during the map stage
         * @param {string} mapContext.value - Value to be processed during the map stage
         * @since 2015.2
         */

        const map = (mapContext) => {
            mapContext.write({
                key : mapContext.key,
                value: mapContext.value
            });
        }

        /**
         * Defines the function that is executed when the reduce entry point is triggered. This entry point is triggered
         * automatically when the associated map stage is complete. This function is applied to each group in the provided context.
         * @param {Object} reduceContext - Data collection containing the groups to process in the reduce stage. This parameter is
         *     provided automatically based on the results of the map stage.
         * @param {Iterator} reduceContext.errors - Serialized errors that were thrown during previous attempts to execute the
         *     reduce function on the current group
         * @param {number} reduceContext.executionNo - Number of times the reduce function has been executed on the current group
         * @param {boolean} reduceContext.isRestarted - Indicates whether the current invocation of this function is the first
         *     invocation (if true, the current invocation is not the first invocation and this function has been restarted)
         * @param {string} reduceContext.key - Key to be processed during the reduce stage
         * @param {List<String>} reduceContext.values - All values associated with a unique key that was passed to the reduce stage
         *     for processing
         * @since 2015.2
         */
        const reduce = (reduceContext) => {
            var key = reduceContext.key;
            var value = JSON.parse(reduceContext.values[0]);
          log.audit("value",value);

            try {
                // 取得NS全量部门数据
                var deptObj = getNsDept();
                // 检索飞书部门映射表取得部门匹配key
                var deptMatchKeyArr = srchDeptMatchKey();
                // 根据部门名称（一级部门_二级部门_三级部门_四级部门）匹对数据 && 在飞书部门映射表中不存在的场合，创建记录
                if (deptObj.hasOwnProperty(key) && deptMatchKeyArr.indexOf(key) == -1) {
                    // 部门名称匹对成功
                    var fsDeptMappingRec = record.create({type: "customrecord_swc_feishu_depart_mapping"});
                    // NS部门列表
                    fsDeptMappingRec.setValue({fieldId: "custrecord_departmap_nsdep", value: deptObj[key]});
                    // 飞书部门名称
                    fsDeptMappingRec.setValue({fieldId: "custrecord_departmap_feidep", value: value["name"]});
                    // 飞书部门ID
                    fsDeptMappingRec.setValue({fieldId: "custrecord_departmap_feidepid", value: value["department_id"]});
                    // OPENID(部门)
                    fsDeptMappingRec.setValue({fieldId: "custrecord_departmap_feiopenid", value: value["open_department_id"]});
                    // 部门匹配KEY
                    fsDeptMappingRec.setValue({fieldId: "custrecord_departmap_key", value: key});

                    fsDeptMappingRec.save();
                }
            } catch (e) {
                throw new Error(e.message);
            }

            reduceContext.write({
                key : key,
                value: reduceContext.value
            });
        }


        /**
         * Defines the function that is executed when the summarize entry point is triggered. This entry point is triggered
         * automatically when the associated reduce stage is complete. This function is applied to the entire result set.
         * @param {Object} summaryContext - Statistics about the execution of a map/reduce script
         * @param {number} summaryContext.concurrency - Maximum concurrency number when executing parallel tasks for the map/reduce
         *     script
         * @param {Date} summaryContext.dateCreated - The date and time when the map/reduce script began running
         * @param {boolean} summaryContext.isRestarted - Indicates whether the current invocation of this function is the first
         *     invocation (if true, the current invocation is not the first invocation and this function has been restarted)
         * @param {Iterator} summaryContext.output - Serialized keys and values that were saved as output during the reduce stage
         * @param {number} summaryContext.seconds - Total seconds elapsed when running the map/reduce script
         * @param {number} summaryContext.usage - Total number of governance usage units consumed when running the map/reduce
         *     script
         * @param {number} summaryContext.yields - Total number of yields when running the map/reduce script
         * @param {Object} summaryContext.inputSummary - Statistics about the input stage
         * @param {Object} summaryContext.mapSummary - Statistics about the map stage
         * @param {Object} summaryContext.reduceSummary - Statistics about the reduce stage
         * @since 2015.2
         */
        const summarize = (summaryContext) => {
            // 每报错一个，运行一次下边的迭代  key是reduce传下来的key error是throw出来的
            summaryContext.reduceSummary.errors.iterator().each(function (key, error,executionNo){
                var errorObject = JSON.parse(error);

                log.audit({title:'错误信息',details:errorObject.message});
                return true;
            });
        }

        /**
         * 获取飞书登录token
         */
        function getFsToken() {
            var headers = {"Content-Type": "application/json; charset=utf-8","Accept":"*/*"};
            var postData = {"app_id": FS_APP_ID, "app_secret": FS_APP_SECRET};
            var response = https.request({
                method:https.Method.POST,
                url:"https://open.feishu.cn/open-apis/auth/v3/app_access_token/internal",
                headers:headers,
                body:JSON.stringify(postData)
            })

            var accessToken = JSON.parse(response.body).app_access_token;

            return accessToken;
        }

        /**
         * 根据部门的open_id（open_department_id）获取子部门列表
         * @param {Object} options
         * @param {string} options.openDeptId 部门数据对象（接口返回的部门对象）
         * @param {string} options.accessToken 飞书访问令牌
         * @param {string} options.pageToken 分页标记
         * @return {"has_more": true, "items": []}
         */
        function getFsDeptSublist(options) {
            var openDeptId = options.openDeptId;
            var accessToken = options.accessToken;
            var pageToken = options.pageToken;

            // 获取子部门列表请求URL
            var getDeptUrl = "https://open.feishu.cn/open-apis/contact/v3/departments/" + openDeptId + "/children?page_size=50";
            // 设置请求参数:分页标记
            if (pageToken) {
                getDeptUrl += ("&page_token=" + pageToken);
            }

            // 设置token请求头
            var headers = {"Content-Type": "application/json; charset=utf-8","Accept":"*/*"};
            headers["Authorization"] = "Bearer " + accessToken;

            var response = https.get({url: getDeptUrl, headers: headers});

            var data = JSON.parse(response.body).data;

            return data;
        }

        /**
         * 取得当前数据组织全量数据（接口分页）
         * @param {Objec} options
         * @param {string} options.openDeptId 部门ID
         * @param {string} options.accessToken 访问令牌
         * @param {string} options.lastDeptName 上一个部门名称 例如： 一级名称、一级-二级名称、一级-二级-三级名称
         * @return {Object} {"一级-二级-三级-四级部门名称": {"接口返回的items明细数据"}, ...}
         */
        function getDeptData(options) {
            var openDeptId = options.openDeptId;
            var accessToken = options.accessToken;
            var lastDeptName = options.lastDeptName;

            // 记录当前组织全部数据
            // {"name": {"item"}, ...}
            var deptData = {};

            // 存在更多数据，默认：false（不存在更多数据）
            var hasMore = false;
            var fsDeptSublistTmp;
            do {
                var pageToken = null;
                if (fsDeptSublistTmp && fsDeptSublistTmp["has_more"]) {
                    pageToken = fsDeptSublistTmp["page_token"];
                }
                // 判断前一次处理结果是否包含分页
                fsDeptSublistTmp = getFsDeptSublist({
                    "openDeptId": openDeptId,
                    "accessToken": accessToken,
                    "pageToken": pageToken
                });
                hasMore = fsDeptSublistTmp["has_more"] || false;

                // 记录当前分页组织数据
                if (fsDeptSublistTmp && fsDeptSublistTmp.hasOwnProperty("items")) {
                    fsDeptSublistTmp.items.forEach(function (value) {
                        // 根据上一级的name加上当前name作为key
                        var name = lastDeptName ? (lastDeptName + "-" + value.name) : value.name;
                        deptData[name] = value;
                    });
                }

            } while (hasMore);

            return deptData;
        }

        /**
         * 检索NS部门，根据一级、二级、三级、四级组织名称拼接KEY
         * @return {Object} {"一级组织名称": "内部 ID", "一级-二级组织名称": "内部 ID", "一级-二级-三级组织名称": "内部 ID", ...}
         */
        function getNsDept() {
            var departmentSearchObj = search.create({
                type: "department",
                filters:
                    [
                        ["isinactive","is","F"]
                    ],
                columns:
                    [
                        search.createColumn({name: "internalid", label: "内部 ID"}),
                        search.createColumn({name: "custrecord_swc_dp_first_organame", label: "一级组织名称"}),
                        search.createColumn({name: "custrecord_swc_dp_sec_organame", label: "二级组织名称"}),
                        search.createColumn({name: "custrecord_swc_dp_third_organame", label: "三级组织名称"}),
                        search.createColumn({name: "custrecord_swc_dp_forth_organa", label: "四级组织名称"})
                    ]
            });

            var results = getAllResultsOfSearch(departmentSearchObj);

            var deptObj = {}
            for (var i = 0; i < results.length; i++) {
                var intlId = results[i].getValue({name: "internalid", label: "内部 ID"});
                var first = results[i].getValue({name: "custrecord_swc_dp_first_organame", label: "一级组织名称"});
                var second = results[i].getValue({name: "custrecord_swc_dp_sec_organame", label: "二级组织名称"});
                var third = results[i].getValue({name: "custrecord_swc_dp_third_organame", label: "三级组织名称"});
                var fourth = results[i].getValue({name: "custrecord_swc_dp_forth_organa", label: "四级组织名称"});

                var key = "";
                if (first) {
                    key += first;
                    if (second) {
                        key += "-" + second;
                        if (third) {
                            key += "-" + third;
                            if (fourth) {
                                key += "-" + fourth;
                            }
                        }
                    }
                }

                deptObj[key] = intlId;
            }

            return deptObj;
        }

        /**
         * 检索飞书部门映射表取得部门匹配key
         * @return ["部门匹配key", ...]
         */
        function srchDeptMatchKey() {
            var searchObj = search.create({
                type: "customrecord_swc_feishu_depart_mapping",
                filters:
                    [
                        ["isinactive","is","F"]
                    ],
                columns:
                    [
                        search.createColumn({name: "custrecord_departmap_key", label: "部门匹配key"})
                    ]
            });

            var results = getAllResultsOfSearch(searchObj);

            var deptMatchKeyArr = [];
            results.forEach(function (value) {
                deptMatchKeyArr.push(value.getValue({name: "custrecord_departmap_key", label: "部门匹配key"}));
            });

            return deptMatchKeyArr;
        }

        /**
         * 获取所有保存检索结果
         * @param saveSearch 保存检索
         * @return [] 数据结果数组
         */
        function getAllResultsOfSearch(saveSearch) {
            var resultset = saveSearch.run();
            var start = 0;
            var step = 1000;
            var resultArr = [];
            var results = resultset.getRange({
                start : start,
                end : Number(start) + Number(step)
            });
            while (results && results.length > 0) {
                resultArr = resultArr.concat(results);
                start = Number(start) + Number(step);
                results = resultset.getRange({
                    start : start,
                    end : Number(start) + Number(step)
                });
            }
            return resultArr;
        }

        // 合并对象
        function extend(objArr) {
            var obj = {};
            objArr.forEach(function (objIt) {
                if (util.isObject(objIt)) {
                    for (var p in objIt) {
                        if (objIt.hasOwnProperty(p) && !obj.hasOwnProperty(p))
                            obj[p] = objIt[p];
                    }
                }
            });
            return obj;
        }

        return {getInputData, map, reduce, summarize}

    });
