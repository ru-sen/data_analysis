/**
 * @author yltian
 * @description 删除无主表的金碟凭证明细数据
 */

/**
 * @param {String} type Context Types: scheduled, ondemand, userinterface, aborted, skipped
 * @returns {Void}
 */
function scheduled(type) {

    var kvDtlSch = nlapiCreateSearch("customrecord_kingdee_voucher",
        [],
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
        try {
            nlapiDeleteRecord("customrecord_kingdee_voucher", id);
        } catch (e) {
            nlapiLogExecution('ERROR', 'e', e);
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