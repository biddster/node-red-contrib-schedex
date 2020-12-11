# Schedex

Scheduler for node-red which allows you to enter on/off times as 24hr clock (e.g. 01:10) or suncalc events (e.g.
goldenHour). It also allows you to offset times and randomise the time within the offset.

Inspired by Pete Scargill's [BigTimer](http://tech.scargill.net/big-timer/)

**NOTE: When upgrading from versions prior to 1.0.0, you will see a message for each Schedex node in the Node-RED debug
window. This message is to advise that the Schedex configuration changed slightly in version 1.0.0 in order to
accomodate days of the week when scheduling. To remedy, simply edit each Schedex node, tick the days of the week you
want Schedex enabled and re-deploy.**

# Installation

This node requires node 10.x+. It's tested against 10.22.0.

    $ cd ~/.node-red
    $ npm install node-red-contrib-schedex

# Configuration

## Schedule

The scheduling days allow you to choose which days of the week to schedule events. Unticking all days will suspend
scheduling.

## Suspending scheduling

The 'Suspend scheduling' checkbox allows you to disable time scheduling. If scheduling is suspended, Schedex will only
generate output events upon receipt of input 'on' and 'off' events (see below).

This setting is provided for the situation where you temporarily don't want time based activation and don't want to rewire your Node-RED flow.

> Note that scheduling is suspended if you do not enter an on or off time in the node configuration.

## Times

> Note that on and off times are independent. You only need to configure one or the other or both. You can leave the on or off time field blank in the node configuration and no output will be emitted.

The times can be a 24 hour time or a [suncalc](https://github.com/mourner/suncalc) event:

| Time              | Description                                                              |
| ----------------- | ------------------------------------------------------------------------ |
| `00:00 ... 23:59` | 24hr time                                                                |
| `sunrise`         | sunrise (top edge of the sun appears on the horizon)                     |
| `sunriseEnd`      | sunrise ends (bottom edge of the sun touches the horizon)                |
| `goldenHourEnd`   | morning golden hour (soft light, best time for photography) ends         |
| `solarNoon`       | solar noon (sun is in the highest position)                              |
| `goldenHour`      | evening golden hour starts                                               |
| `sunsetStart`     | sunset starts (bottom edge of the sun touches the horizon)               |
| `sunset`          | sunset (sun disappears below the horizon, evening civil twilight starts) |
| `dusk`            | dusk (evening nautical twilight starts)                                  |
| `nauticalDusk`    | nautical dusk (evening astronomical twilight starts)                     |
| `night`           | night starts (dark enough for astronomical observations)                 |
| `nadir`           | nadir (darkest moment of the night, sun is in the lowest position)       |
| `nightEnd`        | night ends (morning astronomical twilight starts)                        |
| `nauticalDawn`    | nautical dawn (morning nautical twilight starts)                         |
| `dawn`            | dawn (morning nautical twilight ends, morning civil twilight starts)     |

## Offsets

The on and off time can have an offset. This is specified in minutes:

-   -ve number brings the time forward. E.g. if the time is dusk and offset is -60, a message will be generated 60 minutes
    before dusk.
-   +ve number delays the time by the specified number of minutes

## Randomisation of times

Both on and off times can be randomised by ticking "Use random time within offset period". For example, if you specify
dusk with an offset of -60 minutes, every day a message will be generated at a random time in a 60 minute window before
dusk.

## Message passthrough

When `Passthrough unhandled messages` is enabled, any message that isn't explicitly handled by Schedex will be immediately emitted.
To clarify, if the input payload does not match any one of the programmatic options above, along with
the on|off|toggle|info|info_local commands, the message will be sent to output.

With `Passthough unhandled messages`disabled (the default), any message that isn't handled by Schedex will be dropped and an error reported.

## Inputs

You can wire inject nodes to the input of this node and send the following in `msg.payload`.

| msg.payload  | Description                                                                                                                                                                                                                                                                                                   |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `on`         | Triggers manual on mode and causes Schedex to emit the configured on event. Manual mode is reset when the next on or off time is reached                                                                                                                                                                      |
| `off`        | Triggers manual off mode and causes Schedex to emit the configured off event. Manual mode is reset when the next on or off time is reached                                                                                                                                                                    |
| `toggle`     | Triggers either the manual on or manual off mode. If the last event was the on event, toggle will cause schedex to emit the off event and vice versa. State is not maintained over restarts and deploys. Schedex assumes off upon start so the first toggle will emit the on event.                           |
| `info`       | Schedex emits an object containing the on and off times in UTC format. It also contains the state which is either on or off along with the rest of this node's configuration. Note that the output message contains the actuated state. This will be null (if an event hasn't happened yet) or 'on' or 'off'. |
| `info_local` | Emits the information exactly the same as the `info` command but with the on and off times in local ISO format.                                                                                                                                                                                               |
| `send_state` | Causes Schedex to emit the current state as a message with either the on or off topic/payload set. If Schedex is suspended, this command emits nothing.                                                                                                                                                       |

## Programmatic Control

This node supports programmatic time control as well as configuration via the NodeRED UI.

**It is very important to note that properties set programmatically in this manner are transient. They will not persist
over a NodeRED restart or redeploy!**

Note that both the property-based and string-based specifications are overrides that violate the usual behavior.
See here for further discussion https://github.com/node-red/node-red/issues/399.

You can set the following:

| Property                           | Type                                                                               |
| ---------------------------------- | ---------------------------------------------------------------------------------- |
| `msg.payload.suspended`            | Boolean: true will suspend scheduling, false will resume scheduling                |
| `msg.payload.ontime`               | String value as specified in the table above for time configuration                |
| `msg.payload.ontopic`              | String value emitted as the topic for the on event                                 |
| `msg.payload.onpayload`            | String value emitted as the payload for the on event                               |
| `msg.payload.onoffset`             | Number value as specified above for Offset configuration                           |
| `msg.payload.onrandomoffset`       | Boolean value as specified above in Randomisation of Times                         |
| `msg.payload.offtime`              | String value as specified in the table above for time configuration                |
| `msg.payload.offtopic`             | String value emitted as the topic for the off event                                |
| `msg.payload.offpayload`           | String value emitted as the payload for the off event                              |
| `msg.payload.offoffset`            | Number value as specified above for Offset configuration                           |
| `msg.payload.offrandomoffset`      | Boolean value as specified above in Randomisation of Times                         |
| `msg.payload.mon`                  | Boolean: true enables the schedule on a Monday, false disables it.                 |
| `msg.payload.tue`                  | Boolean: true enables the schedule on a Tuesday, false disables it.                |
| `msg.payload.wed`                  | Boolean: true enables the schedule on a Wednesday, false disables it.              |
| `msg.payload.thu`                  | Boolean: true enables the schedule on a Thursday, false disables it.               |
| `msg.payload.fri`                  | Boolean: true enables the schedule on a Friday, false disables it.                 |
| `msg.payload.sat`                  | Boolean: true enables the schedule on a Saturday, false disables it.               |
| `msg.payload.sun`                  | Boolean: true enables the schedule on a Sunday, false disables it.                 |
| `msg.payload.passthroughunhandled` | Boolean: true enables unhandled input messages to automatically be sent to output. |

Alternatively, you can send msg.payload as a string with the following values:

| Example msg.payload                            | Description                                                          |
| ---------------------------------------------- | -------------------------------------------------------------------- |
| `suspended true`                               | true will suspend scheduling, false will resume scheduling           |
| `ontime 12:00`                                 | Time as specified in the table above for time configuration          |
| `ontopic my_topic`                             | Sets the topic for the on event (no spaces)                          |
| `onpayload my_payload`                         | Sets the payload for the on event (no spaces)                        |
| `onoffset 30`                                  | Sets the offset for the on event                                     |
| `onrandomoffset true`                          | Sets the random offset for the on event                              |
| `offtime dusk`                                 | Time as specified in the table above for time configuration          |
| `offtopic my_topic`                            | Sets the topic for the off event (no spaces)                         |
| `offpayload my_payload`                        | Sets the payload for the off event (no spaces)                       |
| `offoffset -30`                                | Sets the offset for the off event                                    |
| `offrandomoffset false`                        | Sets the random offset for the off event                             |
| `mon false`                                    | Disables the schedule on a Monday                                    |
| `tue true`                                     | Enables the schedule on a Tuesday                                    |
| `ontime 16:30 onoffset 60 onrandomoffset true` | Sets the time, offset and random offset for the on event             |
| `passthroughunhandled false`                   | Disabled unhandled input messages automatically being sent to output |

### Enabling extra debugging

Install `node-red-contrib-config` and drag a config node into your workspace. Configure the node to set a global variable called `schedex`
with a JSON value of `{"debug": true}`. Also make sure that the config tickbox for `active` is unchecked. Redeploy. Now click the button on the config node.
This will trigger all instances of `schedex` to write extra logging to the os syslog next time they're invoked.
