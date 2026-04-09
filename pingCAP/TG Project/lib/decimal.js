/**
 * @NApiVersion 2.0
 * @NModuleScope Public
 */

define(['N/format'], function (format) {
    /**
     * 浮点数加法
     * @param {*} a
     * @param {*} b
     */
    function add(a, b) {
        a = toNonExponential(a);
        b = toNonExponential(b);
        var c, d, e;
        try {
            c = a.toString().split('.')[1].length;
        } catch (f) {
            c = 0;
        }
        try {
            d = b.toString().split('.')[1].length;
        } catch (f) {
            d = 0;
        }
        return (e = Math.pow(10, Math.max(c, d))), (mul(a, e) + mul(b, e)) / e;
    }

    /**
     * 浮点数减法
     * @param {*} a
     * @param {*} b
     */
    function sub(a, b) {
        a = toNonExponential(a);
        b = toNonExponential(b);
        var c, d, e;
        try {
            c = a.toString().split('.')[1].length;
        } catch (f) {
            c = 0;
        }
        try {
            d = b.toString().split('.')[1].length;
        } catch (f) {
            d = 0;
        }
        return (e = Math.pow(10, Math.max(c, d))), (mul(a, e) - mul(b, e)) / e;
    }

    /**
     * 浮点数乘法
     * @param {*} a
     * @param {*} b
     */
    function mul(a, b) {
        a = toNonExponential(a);
        b = toNonExponential(b);
        var c = 0,
            d = a.toString(),
            e = b.toString();
        try {
            c += d.split('.')[1].length;
        } catch (f) {}
        try {
            c += e.split('.')[1].length;
        } catch (f) {}
        return (
            (Number(d.replace('.', '')) * Number(e.replace('.', ''))) /
            Math.pow(10, c)
        );
    }

    /**
     * 浮点数除法
     * @param {*} a
     * @param {*} b
     */
    function div(a, b) {
        a = toNonExponential(a);
        b = toNonExponential(b);
        var c,
            d,
            e = 0,
            f = 0;
        try {
            e = a.toString().split('.')[1].length;
        } catch (g) {}
        try {
            f = b.toString().split('.')[1].length;
        } catch (g) {}
        return (
            (c = Number(a.toString().replace('.', ''))),
            (d = Number(b.toString().replace('.', ''))),
            mul(c / d, Math.pow(10, f - e))
        );
    }

    // JavaScript中科学计数法转化为数值字符串形式
    function toNonExponential(num) {
        num = Number(num);
        var m = num.toExponential().match(/\d(?:.(\d*))?e([+-]\d+)/);
        return num.toFixed(Math.max(0, (m[1] || '').length - m[2]));
    }

    /** 给Number类型增加一个add方法，调用起来更加方便 */
    Number.prototype.add = function (arg) {
        return add(arg, this);
    };

    /** 给Number类型增加一个sub方法，调用起来更加方便 */
    Number.prototype.sub = function (arg) {
        return sub(arg, this);
    };

    /** 给Number类型增加一个mul方法，调用起来更加方便 */
    Number.prototype.mul = function (arg) {
        return mul(arg, this);
    };

    /** 给Number类型增加一个div方法，调用起来更加方便 */
    Number.prototype.div = function (arg) {
        return div(arg, this);
    };

    /** 给Number类型增加一个toFloatFixed方法，四舍五入，并去掉多余0 */
    Number.prototype.toFloatFixed = function (arg) {
        return parseFloat(this.toFixed(arg)) || 0;
    };

    /** 给Number类型增加一个Cus2LocaleStr方法，基于正则实现数字千分位用逗号分割 */
    // 参数说明：n 保留小数位
    Number.prototype.num2LocaleStr = function (n) {
        var num = String(this.toFixed(n));
        var re = /(-?\d+)(\d{3})/;
        while (re.test(num)) {
            num = num.replace(re, '$1,$2');
        }
        return num;
    };

    function parseFloatOrZero(v) {
        return parseFloat(v) || 0;
    }

    function parseToFloat(v) {
        return isEmpty(v)
            ? ''
            : format.parse({
                  value: v,
                  type: format.Type.FLOAT,
              });
    }

    function isEmpty(v) {
        return v == null || v === '';
    }

    function notEmpty(v) {
        return !isEmpty(v);
    }

    // 计算不含税单价：rate=taxRate/(1+tax)
    function calcRate(taxRate, tax, n) {
        var rate = '';
        if (notEmpty(taxRate) && notEmpty(tax)) {
            taxRate = parseFloatOrZero(taxRate);
            tax = parseFloatOrZero(tax);
            rate = (1).add(tax).div(taxRate);
            if (notEmpty(n)) {
                rate = rate.toFixed(n);
            }
        }
        return rate;
    }

    // 计算含税单价：taxRate=(1+tax)*rate
    function calcTaxRate(rate, tax, n) {
        var taxRate = '';
        if (notEmpty(rate) && notEmpty(tax)) {
            rate = parseFloatOrZero(rate);
            tax = parseFloatOrZero(tax);
            taxRate = (1).add(tax).mul(rate);
            if (notEmpty(n)) {
                taxRate = taxRate.toFixed(n);
            }
        }
        return taxRate;
    }

    // 计算调价比率 = (现单价-原单价)/原单价*100，百分比 保留2位小数
    function calcRatio(oldRate, currRate, n) {
        var radio = '';
        if (notEmpty(oldRate) && notEmpty(currRate)) {
            radio = 0;
            oldRate = parseFloatOrZero(oldRate);
            currRate = parseFloatOrZero(currRate);
            if (oldRate !== 0) {
                radio = oldRate.div(oldRate.sub(currRate)).mul(100);
            }
            if (notEmpty(n)) {
                radio = radio.toFixed(n);
            }
        }
        return radio;
    }

    function addN(a, b) {
        a = parseFloatOrZero(a);
        b = parseFloatOrZero(b);
        return add(a, b);
    }

    function subN(a, b) {
        a = parseFloatOrZero(a);
        b = parseFloatOrZero(b);
        return sub(a, b);
    }

    function mulN(a, b) {
        a = parseFloatOrZero(a);
        b = parseFloatOrZero(b);
        return mul(a, b);
    }

    function divN(a, b) {
        a = parseFloatOrZero(a);
        b = parseFloatOrZero(b);
        return b && div(a, b);
    }

    // 四舍五入
    function fixed(num, len) {
        return Math.round(num * Math.pow(10, len)) / Math.pow(10, len);
    }

    // 重写toFixed()方法：
    // （1）javascript中toFixed使用的是银行家舍入规则。
    // 所谓银行家舍入法，其实质是一种四舍六入五取偶（又称四舍六入五留双）法：四舍六入五考虑，五后非零就进一，五后为零看奇偶，五前为偶应舍去，五前为奇要进一。
    // （2）同时还有精度确实的问题。
    // Number.prototype.toFixed = function (d) {
    //     var s = this + '';
    //     if (!d) d = 0;
    //     if (s.indexOf('.') == -1) s += '.';
    //     s += new Array(d + 1).join('0');
    //     if (
    //         new RegExp('^(-|\\+)?(\\d+(\\.\\d{0,' + (d + 1) + '})?)\\d*$').test(
    //             s
    //         )
    //     ) {
    //         var s = '0' + RegExp.$2,
    //             pm = RegExp.$1,
    //             a = RegExp.$3.length,
    //             b = true;
    //         if (a == d + 2) {
    //             a = s.match(/\d/g);
    //             if (parseInt(a[a.length - 1]) > 4) {
    //                 for (var i = a.length - 2; i >= 0; i--) {
    //                     a[i] = parseInt(a[i]) + 1;
    //                     if (a[i] == 10) {
    //                         a[i] = 0;
    //                         b = i != 1;
    //                     } else break;
    //                 }
    //             }
    //             s = a
    //                 .join('')
    //                 .replace(new RegExp('(\\d+)(\\d{' + d + '})\\d$'), '$1.$2');
    //         }
    //         if (b) s = s.substr(1);
    //         return (pm + s).replace(/\.$/, '');
    //     }
    //     return this + '';
    // };

    return {
        parseFloatOrZero: parseFloatOrZero,
        parseToFloat: parseToFloat,
        calcRate: calcRate,
        calcTaxRate: calcTaxRate,
        calcRatio: calcRatio,
        addN: addN,
        subN: subN,
        mulN: mulN,
        divN: divN,
        fixed: fixed,
    };
});
