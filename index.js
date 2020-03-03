/**
 * The MIT License (MIT)
 *
 * Copyright (c) 2016 @biddster
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */
module.exports = function(RED) {
    const moment = require('moment');
    const SunCalc = require('suncalc2');
    const _ = require('lodash');
    const fmt = 'YYYY-MM-DD HH:mm';

    const Status = Object.freeze({
        SCHEDULED: Symbol('scheduled'),
        SUSPENDED: Symbol('suspended'),
        FIRED: Symbol('fired'),
        ERROR: Symbol('error')
    });

    const weekdays = Object.freeze(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']);

    function toBoolean(val) {
        // eslint-disable-next-line prefer-template
        return (val + '').toLowerCase() === 'true';
    }

    const configuration = Object.freeze({
        ontime: String,
        ontopic: String,
        onpayload: String,
        onoffset: Number,
        onrandomoffset: toBoolean,
        offtime: String,
        offtopic: String,
        offpayload: String,
        offoffset: Number,
        offrandomoffset: toBoolean,
        mon: toBoolean,
        tue: toBoolean,
        wed: toBoolean,
        thu: toBoolean,
        fri: toBoolean,
        sat: toBoolean,
        sun: toBoolean,
        lon: Number,
        lat: Number,
        suspended: toBoolean,
        passthroughunhandled: toBoolean
    });

    RED.nodes.registerType('schedex', function(config) {
        RED.nodes.createNode(this, config);
        const node = this;
        const globalConfig = { debug: false };
        const events = {};
        // Assume the node is off initially
        let lastEvent = events.off;

        function getGlobalConfig() {
            return _.assign(globalConfig, node.context().global.get('schedex'));
        }

        function debug(...args) {
            if (getGlobalConfig().debug) node.log.apply(node.log, args);
        }

        // Make sure these two props are proper booleans.
        config.onrandomoffset = !!config.onrandomoffset;
        config.offrandomoffset = !!config.offrandomoffset;
        // Any old versions upgraded will be undefined so convert them to boolean
        // eslint-disable-next-line no-return-assign
        weekdays.forEach(weekday => (config[weekday] = !!config[weekday]));

        function inverse(event) {
            return event === events.on ? events.off : events.on;
        }

        function getWeekdayConfig() {
            return weekdays.map(weekday => config[weekday]);
        }

        function isSuspended() {
            return (
                config.suspended ||
                getWeekdayConfig().indexOf(true) === -1 ||
                (!events.on.time && !events.off.time)
            );
        }

        function setStatus(status, { event = null, manual = false, error = null } = {}) {
            const message = [];
            let shape = 'dot';
            let fill = 'red';
            if (status === Status.SCHEDULED) {
                fill = 'yellow';
                if (events.on.moment && events.off.moment) {
                    const firstEvent = events.on.moment.isBefore(events.off.moment)
                        ? events.on
                        : events.off;
                    message.push(firstEvent.name);
                    message.push(firstEvent.moment.format(fmt));
                    message.push(inverse(firstEvent).name);
                    message.push(inverse(firstEvent).moment.format(fmt));
                } else if (events.on.moment) {
                    message.push(events.on.name);
                    message.push(events.on.moment.format(fmt));
                } else if (events.off.moment) {
                    message.push(events.off.name);
                    message.push(events.off.moment.format(fmt));
                }
            } else if (status === Status.FIRED) {
                // eslint-disable-next-line prefer-destructuring
                shape = event.shape;
                fill = manual ? 'blue' : 'green';
                message.push(event.name);
                message.push(manual ? 'manual' : 'auto');
                if (isSuspended()) {
                    message.push('- scheduling suspended');
                } else if (inverse(event).moment) {
                    message.push(
                        `until ${inverse(event).name} at ${inverse(event).moment.format(fmt)}`
                    );
                } else {
                    const next = inverse(event).moment ? inverse(event) : event;
                    if (next.moment) {
                        message.push(`until ${next.name} at ${next.moment.format(fmt)}`);
                    }
                }
            } else if (status === Status.SUSPENDED) {
                fill = 'grey';
                message.push('Scheduling suspended');
                if (getWeekdayConfig().indexOf(true) === -1) {
                    message.push('(no weekdays selected)');
                } else if (!events.on.time && !events.off.time) {
                    message.push('(no on or off time)');
                }
                message.push('- manual mode only');
            } else if (status === Status.ERROR) {
                message.push(error);
            }
            const text = message.join(' ');
            debug(`status: fill [${fill}] shape [${shape}] text [${text}]`);
            node.status({ fill, shape, text });
        }

        function send(event, manual) {
            lastEvent = event;
            debug(`send: topic [${event.topic}] payload [${event.payload}]`);
            node.send({ topic: event.topic, payload: event.payload });
            setStatus(Status.FIRED, { event, manual });
        }

        function teardownEvent(event) {
            if (event) {
                if (event.timeout) {
                    clearTimeout(event.timeout);
                }
                event.moment = null;
            }
        }

        function schedule(event, firedNow) {
            teardownEvent(event);

            if (!event.time) {
                return true;
            }

            const now = node.now();
            const weekdayConfig = getWeekdayConfig();
            let day = 0;
            const start = node.now().millisecond(0);
            if (firedNow) {
                // We've already fired today so start by examining tomorrow
                start.add(1, 'day');
                day = 1;
            }
            debug(`schedule: event fired now [${firedNow}] date [${start.toString()}]`);

            let valid = false;
            const clockTime = new RegExp('(\\d+):(\\d+)', 'u').exec(event.time);

            // Today is day 0 and we try seven days into the future
            while (!valid && day <= 7) {
                if (clockTime && clockTime.length) {
                    event.moment = start
                        .clone()
                        .hour(+clockTime[1])
                        .minute(+clockTime[2])
                        .second(0);
                } else {
                    // #57 Suncalc appears to give the best results if you
                    // calculate at midday.
                    const sunDate = start
                        .clone()
                        .hour(12)
                        .minute(0)
                        .second(0)
                        .toDate();
                    const sunTimes = SunCalc.getTimes(sunDate, config.lat, config.lon);
                    const sunTime = sunTimes[event.time];
                    if (!sunTime) {
                        setStatus(Status.ERROR, { error: `Invalid time [${event.time}]` });
                        return false;
                    }
                    // #57 Nadir appears to work differently to other sun times
                    // in that it will calculate tomorrow's nadir if the time is
                    // too close to today's nadir. So we just take the time and
                    // apply that to the event's moment. That's doesn't yield a
                    // perfect suntime but it's close enough.
                    event.moment = start
                        .clone()
                        .hour(sunTime.getHours())
                        .minute(sunTime.getMinutes())
                        .second(sunTime.getSeconds());
                }

                if (event.offset) {
                    event.moment.add(
                        event.randomoffset ? event.offset * Math.random() : event.offset,
                        'minutes'
                    );
                }

                valid =
                    weekdayConfig[event.moment.isoWeekday() - 1] && event.moment.isAfter(now);
                debug(`schedule: day [${day}] [${event.moment.toString()}] valid [${valid}]`);
                if (!valid) {
                    start.add(1, 'day');
                    day++;
                }
            }
            if (!valid) {
                setStatus(Status.ERROR, { error: `Failed to find valid time [${event.time}]` });
                return false;
            }
            const delay = event.moment.diff(now);
            if (delay <= 0) {
                setStatus(Status.ERROR, { error: `Negative delay` });
                return false;
            }
            event.timeout = setTimeout(event.callback, delay);
            return true;
        }

        /**
         * @param {string} eventName
         * @param {string} shape
         * @returns
         */
        function setupEvent(eventName, shape) {
            const filtered = _.pickBy(config, function(value, key) {
                return key && key.indexOf(eventName) === 0;
            });
            const event = _.mapKeys(filtered, function(value, key) {
                return key.substring(eventName.length).toLowerCase();
            });
            event.name = eventName.toUpperCase();
            event.shape = shape;
            event.callback = function() {
                // #66 Order here is important as we need to schedule the next event
                // before calling send as send calls setStatus. setStatus needs the
                // latest event details so the node label is correct.
                schedule(event, true);
                send(event, false);
            };
            return event;
        }

        function suspend() {
            teardownEvent(events.on);
            teardownEvent(events.off);
            setStatus(Status.SUSPENDED);
        }

        function resume() {
            if (schedule(events.on, false) && schedule(events.off, false)) {
                setStatus(Status.SCHEDULED);
            }
        }

        function bootstrap() {
            teardownEvent(events.on);
            teardownEvent(events.off);
            events.on = setupEvent('on', 'dot');
            events.off = setupEvent('off', 'ring');
            if (isSuspended()) {
                suspend();
            } else {
                resume();
            }
        }

        function enumerateProgrammables(callback) {
            _.forIn(configuration, (typeFunc, name) => callback(config, name, typeFunc));
        }

        node.on('input', function(msg) {
            let requiresBootstrap = false;
            let handled = false;
            if (_.isString(msg.payload)) {
                // TODO - with these payload options, we can't support on and ontime etc.
                if (msg.payload === 'on') {
                    handled = true;
                    send(events.on, true);
                } else if (msg.payload === 'off') {
                    handled = true;
                    send(events.off, true);
                } else if (msg.payload === 'toggle') {
                    handled = true;
                    send(inverse(lastEvent), true);
                } else if (msg.payload === 'send_state') {
                    handled = true;
                    if (!isSuspended()) {
                        const isOff = events.off.moment.isAfter(events.on.moment);
                        node.send({
                            topic: isOff ? events.off.topic : events.on.topic,
                            payload: isOff ? events.off.payload : events.on.payload
                        });
                    }
                } else if (msg.payload === 'info' || msg.payload === 'info_local') {
                    handled = true;
                    const payload = _.pick(config, Object.keys(configuration));
                    payload.actuatedstate = null;
                    if (lastEvent) {
                        payload.actuatedstate =
                            lastEvent.topic === events.on.topic ? 'on' : 'off';
                    }
                    payload.name = config.name;
                    if (isSuspended()) {
                        payload.state = 'suspended';
                        payload.on = 'suspended';
                        payload.off = 'suspended';
                    } else {
                        if (events.on.moment && events.off.moment) {
                            payload.state = events.off.moment.isAfter(events.on.moment)
                                ? 'off'
                                : 'on';
                        } else if (events.on.moment) {
                            payload.state = 'on';
                        } else {
                            payload.state = 'off';
                        }
                        if (msg.payload === 'info') {
                            payload.on = events.on.moment
                                ? events.on.moment.toDate().toUTCString()
                                : '';
                            payload.off = events.off.moment
                                ? events.off.moment.toDate().toUTCString()
                                : '';
                        } else if (msg.payload === 'info_local') {
                            payload.on = events.on.moment
                                ? events.on.moment.toISOString(true)
                                : '';
                            payload.off = events.off.moment
                                ? events.off.moment.toISOString(true)
                                : '';
                        }
                    }
                    node.send({ topic: 'info', payload });
                } else {
                    enumerateProgrammables(function(cfg, prop, typeConverter) {
                        const match = new RegExp(`.*${prop}\\s+(\\S+)`, 'u').exec(msg.payload);
                        if (match) {
                            handled = true;
                            const previous = cfg[prop];
                            cfg[prop] = typeConverter(match[1]);
                            requiresBootstrap = requiresBootstrap || previous !== cfg[prop];
                        }
                    });
                }
            } else {
                enumerateProgrammables(function(cfg, prop, typeConverter) {
                    if (Object.prototype.hasOwnProperty.call(msg.payload, prop)) {
                        handled = true;
                        const previous = cfg[prop];
                        cfg[prop] = typeConverter(msg.payload[prop]);
                        requiresBootstrap = requiresBootstrap || previous !== cfg[prop];
                    }
                });
            }
            if (!handled) {
                if (config.passthroughunhandled) {
                    node.send(msg);
                } else {
                    setStatus(Status.ERROR, { error: 'Unsupported input' });
                }
            } else if (requiresBootstrap) {
                bootstrap();
            }
        });

        node.on('close', suspend);

        // Bodges to allow testing
        node.schedexEvents = () => events;
        node.schedexConfig = () => config;
        node.now = () => moment();

        // const error = validateConfig(config);
        // if (error) {
        //     node.error(error);
        //     setStatus(Status.ERROR, { error });
        //     return;
        // }

        bootstrap();
    });
};
