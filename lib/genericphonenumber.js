'use strict';

const PNF       = require('google-libphonenumber').PhoneNumberFormat;
const phoneUtil = require('google-libphonenumber').PhoneNumberUtil.getInstance();

const config    = require('../config/config.phonenumber');

function getIsoAlpha2Code(phoneNumber) {

    for (let index in config.identifiers) {
        let id = config.identifiers[index];
        if (phoneNumber.startsWith(id.countryCode)) {
            return id.isoAlpha2CountryCode;
        }
    }

    return 'BD';
}

module.exports = function (phoneNumber, options) {
    if (!phoneNumber) return false;

    let modifiedNumber = phoneNumber;
    if (config.clean) {
        modifiedNumber = phoneNumber
            .replace(/\([0-9]+?\)/g, '')
            .replace(/[^0-9]/g, '')
            .replace(/^[0]+/g, '');
    }

    if (modifiedNumber.length < 7) return false;
    
    let isoAlpha2Code = getIsoAlpha2Code(modifiedNumber);
    let identifier = config.identifiers[isoAlpha2Code];

    if (!identifier) return false;

    let parsedNumber;
    try {
        parsedNumber = phoneUtil.parse(modifiedNumber, identifier.isoAlpha2CountryCode);
    } catch (e) {
        return false;
    }

    let nationalNumber = parsedNumber.getNationalNumber().toString();
    let mobileNumberE164 = phoneUtil.format(parsedNumber, PNF.E164);
    let ret = {
        operator: !options ? 'NA' : options.operator || 'NA',
        operatorCode: !options ? 'NA' : options.operatorCode || 'NA',
        mobileNumber: mobileNumberE164.substr(1, mobileNumberE164.length),
        nationalNumber: nationalNumber,
        mobileNumberE164: mobileNumberE164,
        country: identifier.countryName,
        countryCode: parsedNumber.getCountryCode().toString()
    };

    if (identifier.checkOperator !== undefined && !identifier.checkOperator && options && options.operator) {
        ret.operator = options.operator;
        return ret;
    }
 

    if (options !== undefined && options.operator && options.operator.toLowerCase() !== 'na') {
        for (let opIndex in identifier.operators) {
            let operator = identifier.operators[opIndex];
            if (operator.name.toUpperCase() === options.operator.toUpperCase() && (options.operator.toLowerCase() === operator.name.toLowerCase())) {                                                    
                if (operator.prefixes.some((prefix) => nationalNumber.startsWith(prefix)) || operator.prefixes.length === 0) {
                    ret.operator = ret.operator !== 'NA' ? ret.operator : operator.name;
                    ret.operatorCode = ret.operatorCode !== 'NA' ? ret.operatorCode : operator.code;
                    return ret;
                }
                return false;
            }
        }
        ret.operator = options.operator;
        return false; 
    }


    if (options !== undefined && options.country && options.country.toLowerCase() !== 'na') { 
        for (let opIndex in identifier.operators) {
            let operator = identifier.operators[opIndex];
            if (operator.name.toUpperCase() === options.operator.toUpperCase()) {
                if (operator.prefixes.length === 0) {
                    ret.operator = ret.operator !== 'NA' ? ret.operator : operator.name;
                    ret.operatorCode = ret.operatorCode !== 'NA' ? ret.operatorCode : operator.code;
                    return ret;
                }
            }
        }
        ret.operator = options.operator;
        return ret;
    }
    

    let defaultOperator;
    for (let opIndex in identifier.operators) {
        let operator = identifier.operators[opIndex];
        if (! defaultOperator && operator.default) defaultOperator = operator;

        if (operator.prefixes.some((prefix) => nationalNumber.startsWith(prefix))) {
            ret.operator = operator.name;
            ret.operatorCode = operator.code;
            return ret;
        }
    }

    if (defaultOperator) {
        ret.operator = defaultOperator.name;
        ret.operatorCode = defaultOperator.code;
        return ret;
    }

    return false;
};