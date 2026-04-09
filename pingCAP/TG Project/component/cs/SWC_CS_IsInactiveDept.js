/**
 * @NApiVersion 2.x
 * @NScriptType ClientScript
 * @NModuleScope public
 */
define(['N/record','N/currentRecord','N/url','N/search', "N/ui/dialog","N/format",'N/https'],

	function(record,currentRecord,url,search,dialog,format,https) {


		/**
		 * The recordType (internal id) corresponds to the "Applied To" record in your script deployment.
		 * @appliedtorecord recordType
		 *
		 * @param {String} type Access mode: create, copy, edit
		 * @returns {Void}
		 */
		function pageInit(scriptContext) {
			var oDiv = document.getElementById("timeoutblocker");
			oDiv.style.display = "none";
		}

		/**
		 * 子列表全选方法
		 */
		function allCheck() {
			var rec = currentRecord.get();
			var count = rec.getLineCount({sublistId: "custpage_sublist"});
			for (var i = 0; i < count; i++) {
				rec.selectLine({sublistId: "custpage_sublist", line: i});
				rec.setCurrentSublistValue({sublistId: "custpage_sublist", fieldId: "custpage_checkbox", value: true});
			}
		}

		/**
		 * 子列表全不选方法
		 */
		function deAllCheck() {
			var rec = currentRecord.get();
			var count = rec.getLineCount({sublistId: "custpage_sublist"});
			for (var i = 0; i < count; i++) {
				rec.selectLine({sublistId: "custpage_sublist", line: i});
				rec.setCurrentSublistValue({sublistId: "custpage_sublist", fieldId: "custpage_checkbox", value: false});
			}
		}

		//查询
		function toShow(){
			window.onbeforeunload = null;
			// 获取画面
			var curRecord = currentRecord.get();
			// 根据画面字段ID获取对应字段的值
			var isinactivedept = curRecord.getValue({fieldId:"custpage_isinactivedept"});//非活动部门
			if(isinactivedept){
				isinactivedept = "T";
			}else {
				isinactivedept = "F";
			}
			// 创建url
			var sUrl = url.resolveScript({
				scriptId:"customscript_swc_sl_isinactivedept",
				deploymentId:"customdeploy_swc_sl_isinactivedept",
				params:{"isinactivedept" : isinactivedept} // 传递给SL脚本的参数
			});
			// 给SL脚本传递
			window.location.href = sUrl;
			// var body = {"flag":"show","isinactivedept" : isinactivedept};
			// var response = https.post({url: sUrl,  body: JSON.stringify(body)});
		}

		//提交
		function toCreate(){
			var oDiv = document.getElementById("timeoutblocker");
			oDiv.style.display = "block";
			// 获取画面
			var curRecord = currentRecord.get();
			// 根据画面字段ID获取对应字段的值
			var isinactivedept = curRecord.getValue({fieldId:"custpage_isinactivedept"});//非活动部门
			if(isinactivedept){
				isinactivedept = "T"
			}else {
				isinactivedept = "F"
			}
			var params = {};
			var idArr = [];
			var count = curRecord.getLineCount({sublistId:"custpage_sublist"});//条数
			if(count>0){
				for(var i = 0; i<count; i++) {
					var custpage_checkbox = curRecord.getSublistValue({sublistId: "custpage_sublist", fieldId: "custpage_checkbox", line: i});//勾选框
					if(custpage_checkbox){
						var custpage_id = curRecord.getSublistValue({sublistId: "custpage_sublist", fieldId: "custpage_id", line: i});//id
						idArr.push(custpage_id);
					}
				}
			}else {
				alert("没有可以提交的数据！");
				oDiv.style.display = "none";
				return;
			}
			if(idArr.length<1){
				alert("没有可以提交的数据！");
				oDiv.style.display = "none";
				return;
			}
			params["idArr"] = idArr;
			params["isinactivedept"] = isinactivedept;
			// 创建url
			var sUrl = url.resolveScript({
				scriptId:"customscript_swc_sl_isinactivedept",
				deploymentId:"customdeploy_swc_sl_isinactivedept"
			});
			// 给SL脚本传递
			var body = {"flag":"create","params" : JSON.stringify(params)};
			var response = https.post({url: sUrl,  body: JSON.stringify(body)});
			if(response.body){
				// alert(JSON.parse(response.body).message);
				dialog.alert({
					title: "Tips",
					message: JSON.parse(response.body).message
				})
			}

			oDiv.style.display = "none";

			window.onbeforeunload = null;
			window.location.reload();
		}

		return {
			//saveRecord:saveRecord,
			pageInit:pageInit,
			allCheck:allCheck,
			deAllCheck:deAllCheck,
			toShow:toShow,
			toCreate:toCreate
		};

	});
