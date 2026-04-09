/**
 * @author yltian
 * @description 编辑保存金蝶凭证，执行创建日记账
 */

/**
 * @param {String} type Context Types: scheduled, ondemand, userinterface, aborted, skipped
 * @returns {Void}
 */
function scheduled(type) {

    var kvDtlSch = nlapiCreateSearch("customrecord_kingdee_voucher",
        [
            ["custrecord_kv_journalentrycode","anyof","@NONE@"],
            "AND",
            ["custrecord_kv_crtjournalflag","is","T"]
        ],
        [
            new nlobjSearchColumn("internalid")
        ]
    );

    var kvDtlSchAll = getAllResultsOfSearch(kvDtlSch);
    for (var i = 0; i < kvDtlSchAll.length; i++) {
        var remainingUsage = nlapiGetContext().getRemainingUsage();
        if (remainingUsage < 1000) {
            nlapiYieldScript();
        }
        var id = kvDtlSchAll[i].getValue("internalid");
        nlapiLogExecution('ERROR', 'ID', id);
        try {
            // nlapiDeleteRecord("journalentry", id);
            var tmpRec = nlapiLoadRecord("customrecord_kingdee_voucher", id);
            nlapiSubmitRecord(tmpRec);
        } catch (e) {
            log.error("e", e.message)
        }
    }
}

function getAllResultsOfSearch(search) {
    var resultSet = search.runSearch();
    var start = 0;
    var step = 1000;
    var resultArr = [];
    var results = resultSet.getResults(start, Number(start) + Number(step));
    while (results && results.length > 0) {
        resultArr = resultArr.concat(results);
        start = Number(start) + Number(step);
        results = resultSet.getResults(start, Number(start) + Number(step));
    }
    return resultArr;
}