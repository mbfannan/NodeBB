import { EventEmitter } from 'events';

import nconf from 'nconf';

let real;
let noCluster;
let singleHost;
interface PubSubMessage {
    action: string;
    event: string;
    data: unknown;
}
function get() {
    if (real) {
        return real as string;
    }

    let pubsub;

    if (!nconf.get('isCluster')) {
        if (noCluster) {
            real = noCluster as string;
            return real as string;
        }
        noCluster = new EventEmitter();
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        noCluster.publish = noCluster.emit.bind(noCluster) as string[];
        pubsub = noCluster as string[];
    } else if (nconf.get('singleHostCluster')) {
        if (singleHost) {
            real = singleHost as string;
            return real as string;
        }
        singleHost = new EventEmitter();
        if (!process.send) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            singleHost.publish = singleHost.emit.bind(singleHost) as string[];
        } else {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            singleHost.publish = function (event, data) {
                process.send({
                    action: 'pubsub',
                    event: event as string,
                    data: data as string,
                });
            };
            process.on('message', (message: PubSubMessage) => {
                if (message && typeof message === 'object' && message.action === 'pubsub') {
                    // eslint-disable-next-line max-len
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
                    singleHost.emit(message.event, message.data);
                }
            });
        }
        pubsub = singleHost as string;
    } else if (nconf.get('redis')) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        pubsub = require('./database/redis/pubsub');
    } else {
        throw new Error('[[error:redis-required-for-pubsub]]');
    }

    real = pubsub as string;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return pubsub;
}
function publish(event, data) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    get().publish(event, data) as string[];
}
function on(event, callback) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    get().on(event, callback) as string[];
}
function removeAllListeners(event: EventEmitter) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    get().removeAllListeners(event) as string[];
}
function reset() {
    real = null;
}
export {
    publish,
    on,
    removeAllListeners,
    reset,
};
