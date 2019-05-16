'use strict';

const EventEmitter = require('events');

class Poller extends EventEmitter {
    /**
     * @param {int} timeout how long should we wait after the poll started?
     */
    constructor(timeout = 100) {
        super();
        this.timeout = timeout;
    }

    poll() {
        setTimeout(() => this.emit('poll'), this.timeout);
    }

    onPoll(cb) {
        this.on('poll', cb);
    }
}

module.exports = function(timeout, callback) {
    let poller = new Poller(timeout * 1000);

    poller.onPoll(() => {
        callback.apply(null, []);
        poller.poll();
    });

    poller.poll();
};