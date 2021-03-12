/*
Riven
Modified by Max@SCALE
load dependency
"makercloud": "file:../pxt-makercloud"
*/

//% color="#31C7D5" weight=10 icon="\uf1eb"
//% groups='["Connection", "Publish", "Subscribe"]'
namespace MakerCloud {
    const CMD_SYNC = 1;
    const CMD_RESP_V = 2;
    const CMD_RESP_CB = 3;
    const CMD_WIFISTATUS = 4;
    const CMD_WIFIINFO = 8;
    const CMD_SETHOSTNAME = 9;
    const CMD_MQTT_SETUP = 10;
    const CMD_MQTT_PUB = 11;
    const CMD_MQTT_SUB = 12;
    const CMD_MQTT_SETHOST = 15;
    const CMD_REST_SETUP = 20;
    const CMD_REST_REQ = 21;
    const CMD_REST_RET = 23;
    const CMD_SOCK_SETUP = 40;
    const CMD_SOCK_SEND = 41;
    const CMD_SOCK_DATA = 42;
    const CMD_WIFI_SELECT = 52;

    export enum Callback {
        WIFI_STATUS_CHANGED = 1,
        MQTT_CONN = 2,
        MQTT_DISCON = 3,
        MQTT_PUB = 4,
        MQTT_DATA = 5,
        UDP_SETUP = 6,
        UDP_DATA = 7
    }

    const PortSerial = [
        [SerialPin.P8, SerialPin.P0],
        [SerialPin.P12, SerialPin.P1],
        [SerialPin.P13, SerialPin.P2],
        [SerialPin.P15, SerialPin.P14]
    ]

    export enum SerialPorts {
        PORT1 = 0,
        PORT2 = 1,
        PORT3 = 2,
        PORT4 = 3
    }

    export enum HeaderType {
        Header = 0,
        ContentType = 1,
        UserAgent = 2
    }

    type EvtStr = (data: string) => void;
    type EvtAct = () => void;
    type EvtNum = (data: number) => void;
    type EvtDict = (topic: string, data: string) => void;

    let SERIAL_TX = SerialPin.P2
    let SERIAL_RX = SerialPin.P1

    let PROD_SERVER = "mqtt.makercloud.scaleinnotech.com"
    let SIT_SERVER = "mqtt.makercloud-sit.scaleinnotech.com"
    let SERVER = PROD_SERVER
    let REST_SERVER = "api.makercloud.io"
    let REST_PORT = 80;
    let REST_SECURE = 0;
    let REST_METHOD = "GET"
    let ipAddr: string = '';
    let v: string;
    let topics: string[];

    let wifiConn: EvtAct = null;
    let wifiDisconn: EvtAct = null;

    let isInit = false;
    let isSetup = false;
    let isSubscribe = false;

    // no multi udp or restful instance support for microbit
    let udpRxEvt: EvtStr = null;
    let restRxEvt: (data:string) => void = null;

    export class StringMessageHandler {
        topicName: string;
        fn: (stringMessage: string) => void;
    }

    export class KeyStringMessageHandler {
        topicName: string;
        fn: (key: string, value: string) => void;
    }

    export class KeyValueMessageHandler {
        topicName: string;
        fn: (key: string, value: number) => void;
    }

    let stringMessageHandlerList: StringMessageHandler[] = [
        new StringMessageHandler()
    ]
    let keyStringMessageHandlerList: KeyStringMessageHandler[] = [
        new KeyStringMessageHandler()
    ]
    let keyValueMessageHandlerList: KeyValueMessageHandler[] = [
        new KeyValueMessageHandler()
    ]

    export class KeyStringMessage {
        key: string;
        inText: string;
    }
    export class KeyValueMessage {
        key: string;
        value: number;
    }

    export class MakerCloudMessage {
        deviceName: string;
        deviceSerialNumber: string;
        rawMessage: string;
        stringMessageList: string[];
        keyStringMessageList: KeyStringMessage[];
        keyValueMessagList: KeyValueMessage[];
    }

    //Block in Advance
    /**
    * For testing purpose
    */
    //% blockId=mc_kt_change_to_sit
    //% block="MakerCloud Lab"
    //% advanced=true
    //% weight=103
    export function changeToSitServer() {
        SERVER = SIT_SERVER
    }

    /**
     * On wifi connected
     * @param handler Wifi connected callback
     */
    //% blockId=on_wifi_connected block="on Wi-Fi connected"
    //% advanced=true
    //% weight=102
    export function on_wifi_connected(handler: () => void): void {
        wifiConn = handler;
    }

    /**
     * On wifi disconnected
     * @param handler Wifi disconnected callback
     */
    //% blockId=on_wifi_disconnected block="on Wi-Fi disconnected"
    //% advanced=true
    //% weight=101
    export function on_wifi_disconnected(handler: () => void): void {
        wifiDisconn = handler;
    }

    // Blocks for rest api
    /**
     * Set Restful host
    */
    //% blockId=rest_host block="Setup MakerCloud REST Service"
    //% weight=70
    //% advanced=true
    //% group="REST"
    export function rest_host(): void {
        // todo: support https connection?
        // let secure = false;
        serial.writeString("WF 20 3 20 " + REST_SERVER + " " + REST_PORT + ` ${REST_SECURE}\n`)
        basic.pause(500)
    }

    /**
     * MakerCloud REST Request
     * @param api API link; eg: api
    */
    //% blockId=rest_request block="MakerCloud REST Request %api"
    //% weight=68
    //% advanced=true
    //% group="REST"
    export function rest_request(api: string): void {
        api = api.replace("http://api.makercloud.io", "")
        api = api.replace("https://api.makercloud.io", "")
        api = api.replace("//api.makercloud.io", "")
        serial.writeString("WF 21 2 0 " + REST_METHOD + " " + api + "\n")
        basic.pause(10000)
    }

    /**
     * Restful request return
    */
    //% blockId=rest_ret block="MakerCloud REST Return"
    //% weight=66
    //% advanced=true draggableParameters=reporter
    //% group="REST"
    export function rest_ret(handler: (RESTData: string) => void): void {
        restRxEvt = handler;
    }

    //Block in Connection
    /**
     * Configuration RX TX Pin
     * @param tx Tx pin; eg: SerialPin.P2
     * @param rx Rx pin; eg: SerialPin.P1
     */
    //% blockId=mc_kt_config_rxtx
    //% block="update pin | RX: %rx| TX: %tx"
    //% group="Connection"
    //% weight=104
    export function configRxTxPin(rx: SerialPin, tx: SerialPin) {
        SERIAL_TX = tx
        SERIAL_RX = rx
    }
    /**
     * Configuration Armourbit Port
     * @param tx Tx pin; eg: SerialPin.P2
     * @param rx Rx pin; eg: SerialPin.P1
     */
    //% blockId=mc_kt_config_pwbrick
    //% block="update Armourbit port|%port"
    //% group="Connection"
    //% weight=103
    export function configRxTxPwbrick(port: SerialPorts): void {
        SERIAL_TX = PortSerial[port][1]
        SERIAL_RX = PortSerial[port][0]
    }
    /**
     * Setup and Connect Wi-Fi using KittenWiFi
     */
    //% blockId=mc_kt_wifi_setup
    //% block="connect Wi-Fi SSID: %ssid password: %password"
    //% group="Connection"
    //% weight=102
    export function setupWifi(ssid: string, password: string) {
        init_kittenWiFi()
        isInit = true
        let cmd: string = 'WF 52 2 52 ' + ssid + ' ' + password + '\n'
        serial.writeString(cmd)
        showLoadingStage2(1000)
    }
    /**
     * Connect to MakerCloud MQTT Server
     */
    //% blockId=mc_kt_connect_mc_mqtt
    //% block="connect MakerCloud MQTT"
    //% group="Connection"
    //% weight=101
    export function connectMakerCloudMQTT() {
        serial.writeString("WF 10 4 0 2 3 4 5\n") // mqtt callback install
    }

    // Block in Publish
    /**
     * Publish Message to MakerCloud
     * @param topic ,eg: "topic"
     * @param message ,eg: "message"
     */
    //% blockId=mc_kt_publish_message_to_topic
    //% block="publish to %topic about %message"
    //% group="Publish"
    //% weight=104
    export function publishToTopic(topic: string, message: string) {
        if (isSetup) {
            message = "_dsn=" + control.deviceSerialNumber() + ",_dn=" + control.deviceName() + "," + message
            let cmd: string = 'WF 11 4 11 0 0 ' + topic + ' ' + message + '\n'
            serial.writeString(cmd)
            basic.pause(200) // limit user pub rate
        }
    }

    /**
     * Publish Key and Message to MakerCloud
     * @param topic ,eg: "topic"
     * @param key ,eg: "key"
     * @param inText ,eg: "message"
     */
    //% blockId=mc_kt_publish_key_message_to_topic
    //% block="publish to %topic about %key = $inText"
    //% group="Publish"
    //% weight=103
    export function publishKeyMessageToTopic(topic: string, key: string, inText: string) {
        if (isSetup) {
            let message = "_dsn=" + control.deviceSerialNumber() + ",_dn=" + control.deviceName() + "," + key + "=" + inText
            let cmd: string = 'WF 11 4 11 0 0 ' + topic + ' ' + message + '\n'
            serial.writeString(cmd)
            basic.pause(200) // limit user pub rate        
        }
    }

    /**
     * Publish Key and Value to MakerCloud
     * @param topic ,eg: "topic"
     * @param key ,eg: "key"
     * @param value ,eg: "0"
    */
    //% blockId=mc_kt_publish_key_value_to_topic
    //% block="publish to %topic about %key = $value"
    //% group="Publish"
    //% weight=102
    export function publishKeyValueToTopic(topic: string, key: string, value: number) {
        if (isSetup) {
            let message = "_dsn=" + control.deviceSerialNumber() + ",_dn=" + control.deviceName() + "," + key + "=" + value
            let cmd: string = 'WF 11 4 11 0 0 ' + topic + ' ' + message + '\n'
            serial.writeString(cmd)
            basic.pause(200) // limit user pub rate        
        }
    }

    /**
     * Publish Location Coordinate to MakerCloud
     * @param topic ,eg: "topic"
     * @param lat ,eg: "latitude"
     * @param lng ,eg: "longitude"
    */
    //% blockId=mc_kt_publish_coordination_to_topic
    //% block="publish to %topic about %lat, $lng"
    //% group="Publish"
    //% weight=101
    export function publishCoordinationToTopic(topic: string, lat: string, lng: string) {
        if (isSetup) {
            let message = "_dsn=" + control.deviceSerialNumber() + ",_dn=" + control.deviceName() + ",_lat=" + lat + ",_lng=" + lng
            let cmd: string = 'WF 11 4 11 0 0 ' + topic + ' ' + message + '\n'
            serial.writeString(cmd)
            basic.pause(200) // limit user pub rate        
        }
    }

    /**
     * Subscribe MQTT topic
     * @param inTopics to inTopics ,eg: "topic"
     */
    //% blockId=mc_kt_subscribe_topic
    //% block="subscribe %topics"
    //% group="Subscribe"
    //% weight=104
    export function subscribeTopic(inTopics: string) {
        if (topics == null) {
            topics = splitMessage(inTopics, ",")
        } else {
            topics = topics.concat(splitMessage(inTopics, ","))
        }
        subscribeMQTT()
        isSubscribe = true
    }

    /**
     * Listener for Message from MakerCloud
     * @param topic to topic ,eg: "topic"
     */
    //% blockId=mc_kt_register_topic_text_message_handler
    //% block="on MQTT %topic received"
    //% draggableParameters
    //% group="Subscribe"
    //% weight=103
    export function registerTopicMessageHandler(topic: string, fn: (receivedMessage: string) => void) {
        let topicHandler = new StringMessageHandler()
        topicHandler.fn = fn
        topicHandler.topicName = topic
        stringMessageHandlerList.push(topicHandler)
    }

    /**
     * Listener for Key and Message from MakerCloud
     * @param topic to topic ,eg: "topic"
     */
    //% blockId=mc_kt_register_topic_key_string_message_handler
    //% block="on MQTT %topic received"
    //% draggableParameters
    //% group="Subscribe"
    //% weight=102
    export function registerTopicKeyStringMessageHandler(topic: string, fn: (key: string, receivedMessage: string) => void) {
        let topicHandler = new KeyStringMessageHandler()
        topicHandler.fn = fn
        topicHandler.topicName = topic
        keyStringMessageHandlerList.push(topicHandler)
    }

    /**
     * Listener for Key and Value from MakerCloud
     * @param topic to topic ,eg: "topic"
     */
    //% blockId=mc_kt_register_topic_key_value_message_handler
    //% block="on MQTT %topic received"
    //% draggableParameters
    //% group="Subscribe"
    //% weight=101
    export function registerTopicKeyValueMessageHandler(topic: string, fn: (key: string, receivedValue: number) => void) {
        let topicHandler = new KeyValueMessageHandler()
        topicHandler.fn = fn
        topicHandler.topicName = topic
        keyValueMessageHandlerList.push(topicHandler)
    }

    function trim(t: string): string {
        if (t.charAt(t.length - 1) == ' ') {
            t = t.substr(0, t.length - 1)
        }
        return t;
    }

    function seekNext(space: boolean = true): string {
        for (let i = 0; i < v.length; i++) {
            if ((space && v.charAt(i) == ' ') || v.charAt(i) == '\r' || v.charAt(i) == '\n') {
                let ret = v.substr(0, i)
                v = v.substr(i + 1, v.length - i)
                return ret;
            }
        }
        return '';
    }

    function parseCallback(cb: number) {
        if (Callback.WIFI_STATUS_CHANGED == cb) {
            let stat = parseInt(seekNext())
            if (stat == 5) {
                serial.writeString("WF 10 4 0 2 3 4 5\n") // mqtt callback install
                ipAddr = seekNext()
                if (isInit) connectMCMQTT()
                if (wifiConn && isInit) {
                    wifiConn()
                    // showLoading(5000)
                }
                isSetup = true
            } else {
                ipAddr = ''
                if (wifiDisconn && isSetup) wifiDisconn()
            }
        } else if (Callback.MQTT_DATA == cb) {
            let topic: string = seekNext()
            let data = trim(seekNext(false));
            let makerCloudMessage = parseMakerCloudMessage(data);
            handleTopicStringMessage(topic, makerCloudMessage.stringMessageList);
            handleTopicKeyValueMessage(topic, makerCloudMessage.keyValueMessagList)
            handleTopicKeyStringMessage(topic, makerCloudMessage.keyStringMessageList)

            //if (mqttCbTopicData) {
            //    mqttCbTopicData(topic, data)
            //}
        } else if (Callback.MQTT_CONN == cb) {
            // resubscribe?
            //for (let i = 0; i < mqttCbCnt; i++) {
            //    serial.writeString("WF 12 2 0 " + mqttCbKey[i] + ' 0\n')
            //    basic.pause(300)
            //}
        }
    }

    serial.onDataReceived('\n', function () {
        v = serial.readString()
        let argv: string[] = []

        // serial.writeLine(v)

        if (v.charAt(0) == 'W' && v.charAt(1) == 'F') {
            v = v.substr(3, v.length - 3) + ' '
            let cmd = parseInt(seekNext())
            let argc = parseInt(seekNext())
            let cb = parseInt(seekNext())

            //  todo: is there an async way to handle response value?
            if (cmd == CMD_RESP_CB) {
                parseCallback(cb)
            } else if (cmd == CMD_REST_RET) {
                let code = parseInt(seekNext())
                if (restRxEvt){
                    if(code == 200){
                        restRxEvt(v)
                    }else{
                        restRxEvt("ERROR" + code)
                    }
                }
            }
        }
    })

    function init_kittenWiFi() {
        serial.redirect(
            SERIAL_TX,
            SERIAL_RX,
            BaudRate.BaudRate115200
        )
        basic.pause(500)
        serial.setRxBufferSize(64);
        serial.setTxBufferSize(64);
        serial.readString()
        serial.writeString('\n\n')
        // basic.pause(1000)
        serial.writeString("WF 1 0 1\n") // sync command to add wifi status callback
        showLoadingStage1(500)
        // basic.pause(1000)
        serial.writeString("WF 10 4 0 2 3 4 5\n") // mqtt callback install
    }

    function subscribeMQTT() {
        // let topicList = splitMessage(topics, ",")
        let i = 0
        for (i = 0; i < topics.length; i++) {
            if (topics[i] != "") {
                serial.writeString("WF 12 2 0 " + topics[i] + ' 0\n')
                basic.pause(50)
            }
        }
    }

    function connectMCMQTT() {
        let cmd: string = 'WF 15 2 15 ' + SERVER + ' ' + control.deviceName() + '\n'
        serial.writeString(cmd)
        // basic.pause(1000)
        // reset mqtt handler
        serial.writeString("WF 10 4 0 2 3 4 5\n") // mqtt callback install
        if (isSubscribe) subscribeMQTT()
        // basic.pause(500)
        // showLoading(1000);
        basic.pause(500)
        showLoadingStage3(3000)
    }

    function handleTopicStringMessage(topic: string, stringMessageList: string[]) {
        let i = 0
        for (i = 0; i < stringMessageHandlerList.length; i++) {
            if (stringMessageHandlerList[i].topicName == topic) {
                let j = 0;
                for (j = 0; j < stringMessageList.length; j++) {
                    stringMessageHandlerList[i].fn(stringMessageList[j]);
                }
                break
            }
        }
    }

    function handleTopicKeyStringMessage(topic: string, keyStringMessageList: KeyStringMessage[]) {
        let i = 0
        for (i = 0; i < keyStringMessageHandlerList.length; i++) {
            if (keyStringMessageHandlerList[i].topicName == topic) {
                let j = 0;
                for (j = 0; j < keyStringMessageList.length; j++) {
                    keyStringMessageHandlerList[i].fn(keyStringMessageList[j].key, keyStringMessageList[j].inText);
                }
                break
            }
        }
    }

    function handleTopicKeyValueMessage(topic: string, keyValueMessageList: KeyValueMessage[]) {
        let i = 0
        for (i = 0; i < keyValueMessageHandlerList.length; i++) {
            if (keyValueMessageHandlerList[i].topicName == topic) {
                let j = 0;
                for (j = 0; j < keyValueMessageList.length; j++) {
                    keyValueMessageHandlerList[i].fn(keyValueMessageList[j].key, keyValueMessageList[j].value);
                }
                break
            }
        }
    }

    function splitMessage(message: string, delimitor: string): string[] {
        let messages: string[] = [""];
        let i = 0;
        let messagesIndex = 0;

        for (i = 0; i < message.length; i++) {
            let letter: string = message.charAt(i)
            if (letter == delimitor) {
                messages[++messagesIndex] = ""
            } else {
                messages[messagesIndex] += letter
            }
        }
        return messages
    }

    export function parseMakerCloudMessage(topicMessage: string): MakerCloudMessage {
        let makerCloudMessage = new MakerCloudMessage();
        makerCloudMessage.rawMessage = topicMessage;
        makerCloudMessage.deviceName = "";
        makerCloudMessage.deviceSerialNumber = "";
        makerCloudMessage.keyValueMessagList = [];
        makerCloudMessage.keyStringMessageList = [];
        makerCloudMessage.stringMessageList = [];

        let delimitor = ",";
        let start = 0;
        let oldMessage: string = topicMessage;

        let i = 0;
        let total = countDelimitor(oldMessage, delimitor);
        for (i = 0; i <= total; i++) {
            let end = oldMessage.indexOf(delimitor);
            if (end == -1) {
                end = oldMessage.length
            }
            let subMessage = oldMessage.substr(0, end);
            if (subMessage.indexOf("=") == -1) {
                makerCloudMessage.stringMessageList[makerCloudMessage.stringMessageList.length] = subMessage
            } else {
                let splitIndex = subMessage.indexOf("=");
                let key = subMessage.substr(0, splitIndex);
                let value = subMessage.substr(splitIndex + 1)

                if (value.length > 0) {
                    if (key == "_dsn") {
                        makerCloudMessage.deviceSerialNumber = value;
                    } else if (key == "_dn") {
                        makerCloudMessage.deviceName = value;
                    } else {
                        if (parseFloat(value) || value == "0") {
                            let keyValue = new KeyValueMessage();
                            keyValue.key = key;
                            keyValue.value = parseFloat(value);
                            makerCloudMessage.keyValueMessagList[makerCloudMessage.keyValueMessagList.length] = keyValue;
                        } else {
                            let keyString = new KeyStringMessage();
                            keyString.key = key;
                            keyString.inText = value;
                            makerCloudMessage.keyStringMessageList[makerCloudMessage.keyValueMessagList.length] = keyString;
                        }
                    }
                }
            }
            oldMessage = oldMessage.substr(end + 1, oldMessage.length);
        }

        return makerCloudMessage;
    }

    export function countDelimitor(msg: string, delimitor: string): number {
        let count: number = 0;
        let i = 0;
        for (i = 0; i < msg.length; i++) {
            if (msg.charAt(i) == delimitor) {
                count++;
            }
        }
        return count;
    }

    function splitMessageOnFirstDelimitor(message: string, delimitor: string): string[] {

        let beforeDelimitor = ""
        let afterDelimitor = ""
        let i = 0
        let delimitorPassed = false
        for (i = 0; i < message.length; i++) {
            let letter: string = message.charAt(i)

            if (letter == delimitor) {
                delimitorPassed = true
                continue
            }

            if (delimitorPassed) {
                afterDelimitor += letter
            } else {
                beforeDelimitor += letter
            }
        }
        return [beforeDelimitor, afterDelimitor];
    }

    export function showLoadingStage1(time: number) {
        basic.showLeds(`
        . . . . .
        . . . . .
        . . # . .
        . . . . .
        . . . . .
        `)
        basic.pause(time)
    }

    export function showLoadingStage2(time: number) {
        let interval = 0
        basic.showLeds(`
        . . . . .
        . . # . .
        . . # . .
        . . . . .
        . . . . .
        `)
        basic.showLeds(`
        . . . . .
        . . # # .
        . . # . .
        . . . . .
        . . . . .
        `)
        basic.showLeds(`
        . . . . .
        . . # # .
        . . # # .
        . . . . .
        . . . . .
        `)
        basic.showLeds(`
        . . . . .
        . . # # .
        . . # # .
        . . . # .
        . . . . .
        `)
        basic.showLeds(`
        . . . . .
        . . # # .
        . . # # .
        . . # # .
        . . . . .
        `)
        basic.showLeds(`
        . . . . .
        . . # # .
        . . # # .
        . # # # .
        . . . . .
        `)
        basic.showLeds(`
        . . . . .
        . . # # .
        . # # # .
        . # # # .
        . . . . .
        `)
        basic.showLeds(`
        . . . . .
        . # # # .
        . # # # .
        . # # # .
        . . . . .
        `)
    }
    export function showLoadingStage3(time: number) {
        let interval = time / 16
        interval = 0
        basic.showLeds(`
        . . # . .
        . # # # .
        . # # # .
        . # # # .
        . . . . .
        `)
        basic.pause(interval)
        basic.showLeds(`
        . . # # .
        . # # # .
        . # # # .
        . # # # .
        . . . . .
        `)
        basic.pause(interval)
        basic.showLeds(`
        . . # # #
        . # # # .
        . # # # .
        . # # # .
        . . . . .
        `)
        basic.pause(interval)
        basic.showLeds(`
        . . # # #
        . # # # #
        . # # # .
        . # # # .
        . . . . .
        `)
        basic.pause(interval)
        basic.showLeds(`
        . . # # #
        . # # # #
        . # # # #
        . # # # .
        . . . . .
        `)
        basic.pause(interval)
        basic.showLeds(`
        . . # # #
        . # # # #
        . # # # #
        . # # # #
        . . . . .
        `)
        basic.pause(interval)
        basic.showLeds(`
        . . # # #
        . # # # #
        . # # # #
        . # # # #
        . . . . #
        `)
        basic.pause(interval)
        basic.showLeds(`
        . . # # #
        . # # # #
        . # # # #
        . # # # #
        . . . # #
        `)
        basic.pause(interval)
        basic.showLeds(`
        . . # # #
        . # # # #
        . # # # #
        . # # # #
        . . # # #
        `)
        basic.pause(interval)
        basic.showLeds(`
        . . # # #
        . # # # #
        . # # # #
        . # # # #
        . # # # #
        `)
        basic.pause(interval)
        basic.showLeds(`
        . . # # #
        . # # # #
        . # # # #
        . # # # #
        # # # # #
        `)
        basic.pause(interval)
        basic.showLeds(`
        . . # # #
        . # # # #
        . # # # #
        # # # # #
        # # # # #
        `)
        basic.pause(interval)
        basic.showLeds(`
        . . # # #
        . # # # #
        # # # # #
        # # # # #
        # # # # #
        `)
        basic.pause(interval)
        basic.showLeds(`
        . . # # #
        # # # # #
        # # # # #
        # # # # #
        # # # # #
        `)
        basic.pause(interval)
        basic.showLeds(`
        # . # # #
        # # # # #
        # # # # #
        # # # # #
        # # # # #
        `)
        basic.pause(interval)
        basic.showLeds(`
        # # # # #
        # # # # #
        # # # # #
        # # # # #
        # # # # #
        `)
        basic.pause(interval)
        basic.clearScreen()
    }
}

