'use strict';

const queries = {
    keyForNonce: function(nonce) { return 'nonce.' + nonce },
    keyForContentInfo: function(contentId) {return 'content.' + contentId}
};

module.exports = queries;