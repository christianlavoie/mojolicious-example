var drawables = [
];

var type = 'line';
var inprogress = {};

var clientid;
var socket;

$(document).ready(function () {
    clientid = uuid();
    resize();

    $(window).on('resize', resize);
    $('#sharedCanvas').on('click', click);

    $(document).on('contextmenu', function (e) {
        e.preventDefault();
    });

    socket = new WebSocket('ws://10.0.1.2:3000/' + roomid + '/socket/' + clientid);

    socket.onmessage = function (event) {
        drawables.push(JSON.parse(event.data));
        draw();
    };

    socket.onopen = function (event) {
        console.log('Websocket opened in room ' + roomid + ' for ' + clientid);
    };
});

function click(e) {
    console.log(e);

    if (1 != e.which) return true;

    if (!inprogress.hasOwnProperty('type')) {
        inprogress = { type: type };

        if ('line' == type) {
            inprogress.start = [ e.clientX, e.clientY ];
        }

    } else if ('line' == type) {
        inprogress.end = [ e.clientX, e.clientY ];
        drawables.push(inprogress);
        draw();

        socket.send(JSON.stringify(inprogress));
        inprogress = {};
    }

    return true;
};

function resize() {
    var canvas = document.getElementById('sharedCanvas');

    canvas.height = window.innerHeight;
    canvas.width = window.innerWidth;

    draw();
}

function draw() {
    var canvas = document.getElementById('sharedCanvas');
    var context = canvas.getContext('2d');

    for (var i = 0; i < drawables.length; i++) {
        var drawable = drawables[i];
        console.log(drawable);

        if ("line" == drawable.type) {
            context.beginPath();
            context.moveTo(drawable.start[0], drawable.start[1]);
            context.lineTo(drawable.end[0], drawable.end[1]);
            context.stroke();
        } 
    }
}


function uuid() {
    function inner() {
        var val = Math.floor((Math.random() + 1) * 0x10000);
        return val.toString(16).substring(1);
    };

   return [inner() + inner(), inner(), inner(), inner(), inner() + inner() + inner()].join('-');
}
