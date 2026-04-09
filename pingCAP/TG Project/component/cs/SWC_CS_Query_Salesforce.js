/**
 * @NApiVersion 2.x
 * @NScriptType ClientScript
 * @NModuleScope public
 */
define(['N/record','N/currentRecord','N/url','N/search', "N/ui/dialog","N/format"],

	function(record,currentRecord,url,search,dialog,format) {

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
			var custpageType = currRec.getValue({fieldId:"custpage_type"});
			var startDate = currRec.getValue({fieldId:"custpage_start"});
			var endDate = currRec.getValue({fieldId:"custpage_end"});
			if(!startDate) {
				dialog.alert({title:"友情提示",message:"请选择开始时间!"});
				return false;
			}
			if(!endDate) {
				dialog.alert({title:"友情提示",message:"请选择结束时间!"});
				return false;
			}
			if(!custpageType) {
				dialog.alert({title:"友情提示",message:"请选择操作类型!"});
				return false;
			}
			// if((Number(startDate.getMonth()) + 1) != (Number(endDate.getMonth()) + 1)) {
			// 	dialog.alert({title:"友情提示",message:"开始结束时间应为同月份日期!"});
			// 	return false;
			// }
			if(custpageType == "delete"){
				// 选择的日期区间大于30天
				if(Number(calculateTimeDifference(endDate.getTime(),startDate.getTime()))+1 > 30) {
					dialog.alert({title:"友情提示",message:"拉取时间区间需小于等于30天!"});
					return false;
				}

			}

			// 请选择本月及之前月份进行拉取
			 var today = getThisDate(8);
			if(startDate > today) {
				dialog.alert({title:"友情提示",message:"请选择本月及之前月份进行拉取!"});
				return false;
			}

			// 查看 tracker 里面是否有未完成的一件代发定时操作，如果有不允许继续执行
			var customrecord_swc_task_trackerSearchObj = search.create({
				type: "customrecord_swc_task_tracker",
				filters: [["custrecord_swctt_type","anyof","33"], "AND", ["custrecord_swctt_completed","is","F"]],
				columns: [search.createColumn({name: "internalid", label: "内部 ID"})]
			});
			var searchResultCount = customrecord_swc_task_trackerSearchObj.runPaged().count;

			if(searchResultCount > 0) {
				dialog.alert({title:"友情提示",message:"有数据正在等待拉取，请稍后重试!"});
				return false;
			}


			return true;
		}

		function getThisDate(timeZone) {
			var date = new Date();
			var utcTime = date.getTime() + date.getTimezoneOffset() * 60 * 1000;
			var tzTime = utcTime + timeZone * 60 * 60 * 1000;
			return new Date(tzTime);
		}
		/**
		 * The recordType (internal id) corresponds to the "Applied To" record in your script deployment.
		 * @appliedtorecord recordType
		 *
		 * @param {String} type Access mode: create, copy, edit
		 * @returns {Void}
		 */
		function pageInit(scriptContext) {
			var curRecord = scriptContext.currentRecord;
			var month = curRecord.getValue({fieldId:"custpage_month"});
			var urlObj = getUrlParameterObj();
			var href = window.location.toString();
			var a = href.indexOf('scriptlet.nl?');
			var b = href.indexOf('&flag');
			href = href.substring(a,b);

			// if(urlObj.flag) {
			// 	dialog.alert({title:'友情提示',message:'有单据正在拉取进行中，请稍等!'});
			// 	window.history.replaceState(null,null,href);
			// }

			if(month) {
				var accountingperiodSearchObj = search.create({
					type: "accountingperiod",
					filters: [["internalid","anyof",month]],
					columns:
						[
							search.createColumn({name: "periodname", sort: search.Sort.ASC, label: "名称"}),
							search.createColumn({name: "startdate", label: "开始日期"}),
							search.createColumn({name: "enddate", label: "结束日期"})
						]
				});
				accountingperiodSearchObj.run().each(function(result) {
					var startDate = result.getValue({name: "startdate"})
					var endDate = result.getValue({name: "enddate"})
					curRecord.setValue({fieldId:"custpage_start",value:format.parse({value:startDate,type:format.Type.DATE})});
					curRecord.setValue({fieldId:"custpage_end",value:format.parse({value:endDate,type:format.Type.DATE})});
					return true;
				});
			}
		}

		/**
		 * 获取URL的参数
		 * @return {null}
		 */
		function getUrlParameterObj() {
			var href = window.location.toString();
			var hrefArr = href.split("?");
			if (!hrefArr[1]) return null;
			var tempArr = hrefArr[1].split("&");
			var parameterObj = {};
			for (var i = 0; i < tempArr.length; i++) {
				var paramArr = tempArr[i].split("=");
				if (!paramArr) continue;
				parameterObj[paramArr[0]] = paramArr[1];
			}
			return parameterObj;
		}


		/**
		 * Function to be executed when field is changed.
		 *custpage_saleagreement
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
			var curRecord = scriptContext.currentRecord;
			var month = curRecord.getValue({fieldId:"custpage_month"});
			// 带出来
			if(scriptContext.fieldId == "custpage_month") {
				if(month) {
					var accountingperiodSearchObj = search.create({
						type: "accountingperiod",
						filters: [["internalid","anyof",month]],
						columns:
							[
								search.createColumn({name: "periodname", sort: search.Sort.ASC, label: "名称"}),
								search.createColumn({name: "startdate", label: "开始日期"}),
								search.createColumn({name: "enddate", label: "结束日期"})
							]
					});
					accountingperiodSearchObj.run().each(function(result) {
						var startDate = result.getValue({name: "startdate"})
						var endDate = result.getValue({name: "enddate"})
						curRecord.setValue({fieldId:"custpage_start",value:format.parse({value:startDate,type:format.Type.DATE})});
						curRecord.setValue({fieldId:"custpage_end",value:format.parse({value:endDate,type:format.Type.DATE})});
						return true;
					});
				} else {
					curRecord.setValue({fieldId:"custpage_start",value:""});
					curRecord.setValue({fieldId:"custpage_end",value:""});
				}
			}
		}

		/**
		 * 计算时间间隔函数 Number(calculateTimeDifference(today.getTime(),inDate.getTime())).toString()
		 * @param time1 开始时间 timezone
		 * @param time2 结束时间 timezone
		 * @return {number}
		 */
		function calculateTimeDifference(time1,time2) {
			var diff = '';
			var time_diff = time1 - time2;
			// 计算相差天数
			var days = Math.floor(time_diff / (24 * 3600 * 1000));
			if (days > 0) {
				diff += days + '天';
			}
			// 计算相差小时数
			var leave1 = time_diff % ( 24 * 3600 * 1000);
			var hours = Math.floor(leave1 / (3600 * 1000));
			if (hours > 0) {
				diff += hours + '小时';
			} else {
				if (diff !== '') {
					diff += hours + '小时';
				}
			}
			// 计算相差分钟数
			var leave2 =leave1 % (3600 * 1000);
			var minutes = Math.floor(leave2 / (60 * 1000));
			if (minutes > 0) {
				diff += minutes + '分';
			} else {
				if (diff !== '') {
					diff += minutes + '分';
				}
			}
			// 计算相差秒数
			var leave3 = leave2%(60*1000);
			var seconds = Math.round(leave3/1000);
			if (seconds > 0) {
				diff += seconds + '秒';
			} else {
				if (diff !== '') {
					diff += seconds + '秒';
				}
			}
			return days;
		}
		return {
			saveRecord:saveRecord,
			fieldChanged:fieldChanged,
			pageInit:pageInit
		};

	});
