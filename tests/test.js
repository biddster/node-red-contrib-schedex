/* eslint-disable max-lines,max-lines-per-function */
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

const { assert } = require('chai');
const _ = require('lodash');
const moment = require('moment');
const mock = require('node-red-contrib-mock-node');
const nodeRedModule = require('../index.js');

function newNode(configOverrides) {
    const config = {
        name: 'test-node',
        suspended: false,
        ontime: '11:45',
        ontopic: 'on topic',
        onpayload: 'on payload',
        onoffset: '',
        onrandomoffset: 0,
        offtime: 'dawn',
        offtopic: 'off topic',
        offpayload: 'off payload',
        offoffset: '5',
        offrandomoffset: 1,
        lat: 51.5050793,
        lon: -0.1225863,
        unittest: true,
        mon: true,
        tue: true,
        wed: true,
        thu: true,
        fri: true,
        sat: true,
        sun: true
    };
    if (configOverrides) {
        _.assign(config, configOverrides);
    }
    return mock(nodeRedModule, config);
}

function testInfoCommand(infoCommand, dateFormatter) {
    let ontime = moment()
        .seconds(0)
        .millisecond(0)
        .add(1, 'minute');
    const offtime = moment()
        .seconds(0)
        .millisecond(0)
        .add(2, 'minute');

    const config = {
        ontime: ontime.format('HH:mm'),
        offtime: offtime.format('HH:mm'),
        onoffset: '',
        offoffset: '',
        onpayload: 'onpayload',
        ontopic: 'ontopic',
        offpayload: 'offpayload',
        offtopic: 'offtopic',
        mon: true,
        tue: true,
        wed: true,
        thu: true,
        fri: true,
        sat: true,
        sun: true
    };
    const node = newNode(config);

    node.emit('input', {
        payload: infoCommand
    });
    const sent = node.sent(0);
    assert.deepStrictEqual(sent, {
        payload: {
            name: 'test-node',
            fri: true,
            lat: 51.5050793,
            lon: -0.1225863,
            mon: true,
            off: dateFormatter(offtime),
            offoffset: '',
            offpayload: 'offpayload',
            offrandomoffset: true,
            offtime: config.offtime,
            offtopic: 'offtopic',
            on: dateFormatter(ontime),
            onoffset: '',
            onpayload: 'onpayload',
            onrandomoffset: false,
            ontime: config.ontime,
            ontopic: 'ontopic',
            sat: true,
            state: 'off',
            sun: true,
            suspended: false,
            thu: true,
            tue: true,
            wed: true
        },
        topic: 'info'
    });

    node.emit('input', {
        payload: 'suspended true'
    });

    node.emit('input', {
        payload: infoCommand
    });
    assert.deepStrictEqual(node.sent(1), {
        payload: {
            name: 'test-node',
            fri: true,
            lat: 51.5050793,
            lon: -0.1225863,
            mon: true,
            off: 'suspended',
            offoffset: '',
            offpayload: 'offpayload',
            offrandomoffset: true,
            offtime: config.offtime,
            offtopic: 'offtopic',
            on: 'suspended',
            onoffset: '',
            onpayload: 'onpayload',
            onrandomoffset: false,
            ontime: config.ontime,
            ontopic: 'ontopic',
            sat: true,
            state: 'suspended',
            sun: true,
            suspended: true,
            thu: true,
            tue: true,
            wed: true
        },
        topic: 'info'
    });

    ontime = ontime.subtract(3, 'minute').add(1, 'day');
    node.emit('input', {
        payload: {
            suspended: false,
            ontime: ontime.format('HH:mm'),
            ontopic: 'ontopic1',
            offpayload: 'offpayload1'
        }
    });

    node.emit('input', {
        payload: infoCommand
    });
    assert.deepStrictEqual(node.sent(2), {
        payload: {
            name: 'test-node',
            fri: true,
            lat: 51.5050793,
            lon: -0.1225863,
            mon: true,
            off: dateFormatter(offtime),
            offoffset: '',
            offpayload: 'offpayload1',
            offrandomoffset: true,
            offtime: config.offtime,
            offtopic: 'offtopic',
            on: dateFormatter(ontime),
            onoffset: '',
            onpayload: 'onpayload',
            onrandomoffset: false,
            ontime: ontime.format('HH:mm'),
            ontopic: 'ontopic1',
            sat: true,
            state: 'on',
            sun: true,
            suspended: false,
            thu: true,
            tue: true,
            wed: true
        },
        topic: 'info'
    });
}

describe('schedex', function() {
    it('issue#64 ability to schedule once a week', function() {
        const now = moment('2019-12-13 11:00:00.000');
        const node = newNode({
            ontime: '10:00',
            offtime: '13:00',
            sat: false,
            sun: false,
            mon: false,
            tue: false,
            wed: false,
            thu: false,
            fri: true,
            offoffset: '',
            offrandomoffset: false
        });
        node.now = function() {
            return now.clone();
        };
        // Trigger some events so the node recalculates the on time
        node.emit('input', { payload: { suspended: true } });
        node.emit('input', { payload: { suspended: false } });
        assert.strictEqual(node.status().text.indexOf('Failed to find valid time'), -1);
        assert.strictEqual(
            node.schedexEvents().on.moment.toISOString(),
            '2019-12-20T10:00:00.000Z'
        );
        assert.strictEqual(
            node.schedexEvents().off.moment.toISOString(),
            '2019-12-13T13:00:00.000Z'
        );
    });
    it('issue#56 suncalc falling over DST changes', function() {
        const now = moment('2019-10-26 22:00:00.000');
        const node = newNode({
            ontime: 'sunset',
            offtime: '21:00'
        });
        node.now = function() {
            return now.clone();
        };
        // Trigger some events so the node recalculates the on time
        node.emit('input', { payload: { suspended: true } });
        node.emit('input', { payload: { suspended: false } });
        // Expecting Sun Oct 27 2019 16:45:40 GMT+0000
        // console.log(node.schedexEvents().on.moment.toString());
        assert.ok(
            node.schedexEvents().on.moment.isSame(moment('2019-10-27 16:45:00.000'), 'minute'),
            `[${node
                .schedexEvents()
                .on.moment.toISOString()}] should equal [2019-10-27T16:45:00.000]`
        );
    });
    it('issue#56 suncalc with offset', function() {
        const node = newNode({
            ontime: 'sunset',
            onoffset: '30',
            offtime: ''
        });
        const now = moment('2019-10-26 02:00:00.000');
        node.now = function() {
            return now.clone();
        };
        // Trigger some events so the node recalculates the on time
        node.emit('input', { payload: { suspended: true } });
        node.emit('input', { payload: { suspended: false } });
        assert.ok(
            node.schedexEvents().on.moment.isSame(moment('2019-10-26 18:17:00.000'), 'minute'),
            `[${node
                .schedexEvents()
                .on.moment.toISOString()}] should equal [2019-10-26T18:17:00.000] (30 minutes after sunset)`
        );
    });
    it('issue#52 node.now should always have second and millisecond precision', function() {
        const node = newNode();
        const now = node.now();
        // NOTE It's possible for this test to fail if you run it precisely on
        // a second boundary. That's pretty unlikely though.
        assert.notEqual(now.milliseconds(), 0);
        assert.notEqual(now.seconds(), 0);
    });
    it('should toggle state', function() {
        const node = newNode();
        node.emit('input', { payload: 'toggle' });
        assert(node.status().text.indexOf('ON manual until OFF at ') === 0);

        node.emit('input', { payload: 'toggle' });
        assert(node.status().text.indexOf('OFF manual until ON at ') === 0);
    });
    it('should indicate correct next event when on or off is not configured', function() {
        const noOnTime = newNode({ ontime: null });
        noOnTime.emit('input', { payload: 'toggle' });
        assert(noOnTime.status().text.indexOf('ON manual until OFF at') === 0);

        noOnTime.emit('input', { payload: 'toggle' });
        assert(noOnTime.status().text.indexOf('OFF manual until OFF at ') === 0);

        const noOnOffTime = newNode({ ontime: null, offtime: null });
        noOnOffTime.emit('input', { payload: 'toggle' });
        assert.equal(noOnOffTime.status().text, 'ON manual - scheduling suspended');

        noOnOffTime.emit('input', { payload: 'toggle' });
        assert.equal(noOnOffTime.status().text, 'OFF manual - scheduling suspended');
    });
    it('should visually indicate manual on off', function() {
        let node = newNode();
        node.emit('input', { payload: 'on' });
        console.log(node.status().text);
        assert(node.status().text.indexOf('ON manual until') === 0);

        node = newNode();
        node.emit('input', { payload: 'off' });
        assert(node.status().text.indexOf('OFF manual until') === 0);
    });
    it('issue#22: should schedule correctly with ontime no offtime', function() {
        const node = newNode({
            ontime: '23:59',
            offtime: ''
        });
        assert.strictEqual(node.status().text, `ON ${moment().format('YYYY-MM-DD')} 23:59`);
    });
    it('issue#22: should schedule correctly with offtime no ontime', function() {
        const node = newNode({
            ontime: '',
            offtime: '23:59',
            offoffset: 0
        });
        assert.strictEqual(node.status().text, `OFF ${moment().format('YYYY-MM-DD')} 23:59`);
    });
    it('issue#22: should indicate scheduling suspended if no on or off time', function() {
        const node = newNode({
            ontime: '',
            offtime: ''
        });
        assert.strictEqual(
            node.status().text,
            'Scheduling suspended (no on or off time) - manual mode only'
        );
    });
    it('should schedule initially', function() {
        const node = newNode();
        assert.strictEqual(node.schedexEvents().on.time, '11:45');
        assert.strictEqual(node.schedexEvents().off.time, 'dawn');

        node.emit('input', {
            payload: 'on'
        });
        assert.strictEqual(node.sent(0).payload, 'on payload');
        assert.strictEqual(node.sent(0).topic, 'on topic');

        node.emit('input', {
            payload: 'off'
        });
        assert.strictEqual(node.sent(1).payload, 'off payload');
        assert.strictEqual(node.sent(1).topic, 'off topic');
    });
    it('should handle programmatic scheduling', function() {
        const node = newNode();
        node.emit('input', {
            payload: 'ontime 11:12'
        });
        assert.strictEqual(node.schedexEvents().on.time, '11:12');

        node.emit('input', {
            payload: {
                ontime: '23:12'
            }
        });
        assert.strictEqual(node.schedexEvents().on.time, '23:12');

        node.emit('input', {
            payload: 'offtime 10:12'
        });
        assert.strictEqual(node.schedexEvents().off.time, '10:12');

        node.emit('input', {
            payload: {
                offtime: '22:12'
            }
        });
        assert.strictEqual(node.schedexEvents().off.time, '22:12');

        node.emit('input', {
            payload: 'mon true'
        });
        assert.strictEqual(node.schedexConfig().mon, true);

        node.emit('input', {
            payload: 'mon false'
        });
        assert.strictEqual(node.schedexConfig().mon, false);

        node.emit('input', {
            payload: { mon: true }
        });
        assert.strictEqual(node.schedexConfig().mon, true);

        node.emit('input', {
            payload: { lat: -1.1 }
        });
        assert.strictEqual(node.schedexConfig().lat, -1.1);

        node.emit('input', {
            payload: 'lat -99.9'
        });
        assert.strictEqual(node.schedexConfig().lat, -99.9);
    });
    it('should indicate bad programmatic input', function() {
        const node = newNode();
        node.emit('input', {
            payload: 'wibble'
        });
        assert.strictEqual(node.status().text, 'Unsupported input');

        node.status().text = '';
        node.emit('input', {
            payload: '4412'
        });
        assert.strictEqual(node.status().text, 'Unsupported input');
    });
    it('should indicate bad configuration', function() {
        const node = newNode({
            ontime: '5555'
        });
        assert.strictEqual(node.status().text, 'Invalid time [5555]');
    });
    it('should suspend initially', function() {
        const node = newNode({
            suspended: true
        });
        assert(node.status().text.indexOf('Scheduling suspended') === 0);
    });
    it('should suspend if all weekdays are unticked and disabled', function() {
        const config = _.zipObject(
            ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
            _.times(7, () => false)
        );
        const node = newNode(config);
        assert(node.status().text.indexOf('Scheduling suspended') === 0);
    });
    it('should suspend programmatically', function() {
        let node = newNode();
        node.emit('input', {
            payload: {
                suspended: true
            }
        });
        assert(node.status().text.indexOf('Scheduling suspended') === 0);

        node = newNode();
        node.emit('input', {
            payload: 'suspended true'
        });
        assert(node.status().text.indexOf('Scheduling suspended') === 0);
    });
    it('should handle day configuration', function() {
        const now = moment();
        // Start by disabling today in the configuration.
        const config = _.zipObject(
            ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
            _.times(7, index => now.isoWeekday() !== index + 1)
        );
        /*
         * Make sure we schedule 'on' for today by making the time after now. That way, disabling
         * today in the config will force the 'on' to be tomorrow and we can assert it.
         */
        config.ontime = moment()
            .add(1, 'minute')
            .format('HH:mm');
        const node = newNode(config);
        assert.strictEqual(
            node.schedexEvents().on.moment.isoWeekday(),
            now.add(1, 'day').isoWeekday()
        );
    });
    it('should handle programmatic day configuration', function() {
        const now = moment();
        // Start by disabling today in the configuration.
        const weekdays = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
        /*
         * Make sure we schedule 'on' for today by making the time after now. That way, disabling
         * today in the config will force the 'on' to be tomorrow and we can assert it.
         */
        const config = {
            ontime: moment()
                .add(1, 'minute')
                .format('HH:mm')
        };
        const node = newNode(config);
        assert.strictEqual(node.schedexEvents().on.moment.isoWeekday(), now.isoWeekday());

        const today = weekdays[now.isoWeekday() - 1];
        node.emit('input', {
            payload: `${today} false`
        });

        assert.strictEqual(
            node.schedexEvents().on.moment.isoWeekday(),
            now.add(1, 'day').isoWeekday()
        );
    });
    it('should emit the correct info', function() {
        testInfoCommand('info', date => date.toDate().toUTCString());
    });
    it('should emit the correct info_local', function() {
        testInfoCommand('info_local', date => date.toISOString(true));
    });
    it('issue#24: should schedule correctly if on time before now but offset makes it after midnight', function() {
        const node = newNode({
            ontime: '23:45',
            onoffset: 20
        });
        const now = moment()
            .hour(23)
            .minute(46)
            .second(0)
            .millisecond(0);
        node.now = function() {
            return now.clone();
        };
        /*
         * We've overridden the now method after the initial scheduling. Cheat a bit and
         * suspend then unsuspend to force initial scheduling again and have our new now
         * method used.
         */
        node.emit('input', {
            payload: {
                suspended: true
            }
        });
        node.emit('input', {
            payload: {
                suspended: false
            }
        });
        const events = node.schedexEvents();
        console.log(now.toString());
        console.log(events.on.moment.toString());
        const duration = Math.round(moment.duration(events.on.moment.diff(now)).asMinutes());
        console.log(duration);
        assert.strictEqual(duration, 19);
    });
    it('issue#29: should schedule correctly if on time before now but offset makes it after now', function() {
        const now = moment().seconds(0);
        console.log(`now: ${now.toString()}`);
        const ontime = now
            .clone()
            .subtract(1, 'minute')
            .format('HH:mm');
        console.log(`ontime pre offset: ${ontime.toString()}`);
        const node = newNode({
            ontime,
            onoffset: 60
        });
        const events = node.schedexEvents();
        console.log(`ontime: ${events.on.moment.toString()}`);
        const duration = moment.duration(events.on.moment.diff(now)).asMinutes();
        console.log(duration);
        assert.strictEqual(Math.round(duration), 59);
    });
    it('should send something when triggered', function(done) {
        this.timeout(60000 * 5);
        console.log(`\t[${this.test.title}] will take 3 minutes, please wait...`);
        const ontime = moment()
            .add(1, 'minute')
            .format('HH:mm');
        const offtime = moment()
            .add(2, 'minute')
            .format('HH:mm');
        const node = newNode({
            ontime,
            offtime,
            offoffset: 0,
            offrandomoffset: '0'
        });
        setTimeout(function() {
            assert.strictEqual(node.sent(0).payload, 'on payload');
            assert.strictEqual(node.sent(0).topic, 'on topic');
            assert.strictEqual(node.sent(1).payload, 'off payload');
            assert.strictEqual(node.sent(1).topic, 'off topic');
            done();
        }, 60000 * 3);
    });
    it('should send something after programmatic configuration when triggered', function(done) {
        this.timeout(60000 * 5);
        console.log(`\t[${this.test.title}] will take 3 minutes, please wait...`);
        const ontime = moment()
            .add(1, 'minute')
            .format('HH:mm');
        const offtime = moment()
            .add(2, 'minute')
            .format('HH:mm');
        const node = newNode({
            offoffset: 0,
            offrandomoffset: '0'
        });
        node.emit('input', {
            payload: `ontime ${ontime}`
        });
        node.emit('input', {
            payload: `offtime ${offtime}`
        });
        setTimeout(function() {
            assert.strictEqual(node.sent(0).payload, 'on payload');
            assert.strictEqual(node.sent(0).topic, 'on topic');
            assert.strictEqual(node.sent(1).payload, 'off payload');
            assert.strictEqual(node.sent(1).topic, 'off topic');
            done();
        }, 60000 * 3);
    });
    it('should send correct sync_state', function() {
        let node = newNode({
            ontime: moment()
                .subtract(10, 'minute')
                .format('HH:mm'),
            offtime: moment()
                .add(10, 'minute')
                .format('HH:mm'),
            onpayload: 'onpayload',
            ontopic: 'ontopic'
        });
        node.emit('input', { payload: 'sync_state' });
        assert(node.sent(0).payload.indexOf('onpayload') === 0, 'on payload not received');
        assert(node.sent(0).topic.indexOf('ontopic') === 0, 'on topic not received');

        node = newNode({
            ontime: moment()
                .add(10, 'minute')
                .format('HH:mm'),
            offtime: moment()
                .subtract(10, 'minute')
                .format('HH:mm'),
            offpayload: 'offpayload',
            offtopic: 'offtopic'
        });
        node.emit('input', { payload: 'sync_state' });
        assert(node.sent(0).payload.indexOf('offpayload') === 0, 'off payload not received');
        assert(node.sent(0).topic.indexOf('offtopic') === 0, 'off topic not received');
    });
});
