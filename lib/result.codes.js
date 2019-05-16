const config = require('../config');
const resDet = require('../lib/result.details');

module.exports = {
    SUCCESS: {
        status: 200,
        code: '0',
        title: 'Success'
    },
    ACCEPTED: {
        status: 202,
        code: '0',
        title: 'Success'
    },
    AUTH_ERR: {
        status: 401,
        code: '1',
        title: 'Authentication error'
    },
    INVALID_REQ_FORMAT_ERR: {
        status: 400,
        code: '2',
        title: 'Invalid request format'
    },
    REQUIRED_PARAMS_ERR: {
        status: 400,
        code: '3',
        title: 'Required parameters missing'
    },
    INVALID_PARAMS_ERR: {
        status: 400,
        code: '4',
        title: 'Invalid request'
    },
    ACTION_FAILED_ERR: {
        status: 406,
        code: '5',
        title: 'Action failed'
    },
    ACTION_NOT_SUPPORTED_ERR: {
        status: 406,
        code: '6',
        title: 'Action not supported'
    },
    NOT_FOUND: {
        status: 404,
        code: '7',
        title: 'Not found'
    },
    TOO_MANY_INVALID_REQUEST: {
        status: 429,
        code: '8',
        title: 'Too many invalid attempt'
    },
    ACCESS_PERIOD_OVER: {
        status: 401,
        code: '9',
        title: 'Access period over'
    },
    INSUFFICIENT_RESOURCE: {
        status: 406,
        code: '10',
        title: 'Insufficient resource'
    },
    AUTH_TOKEN_ERR: {
        status: 401,
        code: '11',
        title: 'Unauthorized'
    },
    SESSION_EXPIRED_ERR: {
        status: 404,
        code: '12',
        title: 'Session expired'
    },
    INTERNAL_SERVER_ERROR: {
        status: 500,
        code: '255',
        title: 'Internal Server Error'
    },
    TRY_LATER: {
        status: 200,
        code: '211',
        title: 'Try Later'
    },
    responseGenerator: function(respErr, details = undefined, detailsIndex = undefined, status = undefined, data = undefined) {
        if (respErr.code === '255') {
            // config.logger.error(details);
            details = undefined;
        }

        if (!details) details = respErr.title;

        if (detailsIndex !== undefined && config.seterrordetails) {
            let overriddenDetails = resDet.getDetails(detailsIndex);
            details = (overriddenDetails !== undefined ? overriddenDetails : details);
        }

        let result = {
            status: status ? status : respErr.status,
            code: respErr.code,
            title: respErr.title,
            details: details,
            detailsIndex: detailsIndex,
            timestamp: Math.floor(Date.now() / 1000)
        };

        if (data !== undefined) {
            result.data = data;
        }

        return result;
    },
    finalizeResponse: function (response, options) {
        let defaultOptions = {offset: 0, mask: 0};
        options = Object.assign(defaultOptions, options);
        response.details = options.details
            || resDet.getDetails(options.offset + options.mask + response.detailsIndex)
            || resDet.getDetails(options.offset + response.detailsIndex)
            || response.details;
        delete response.detailsIndex;
        return response;
    }
};