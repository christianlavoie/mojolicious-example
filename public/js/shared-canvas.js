var drawables = [];

var type = 'line';
var inprogress = {};

var clientid;
var socket;

var Item = Line;

$(document).ready(function () {
    clientid = uuid();
    resize();

    $(window).on('resize', resize);
    $('#sharedCanvas').on('click', click);

    var menuitem;
    
    menuitem = $('<li><a>Line</a></li>');
    menuitem.on('click', function (e) { $('#modeMenu').hide(); Item = Line; inprogress = new Line(); });
    $('#modeMenuUL').append(menuitem);

    menuitem = $('<li><a>Circle</a></li>');
    menuitem.on('click', function (e) { $('#modeMenu').hide(); Item = Circle; inprogress = new Circle(); });
    $('#modeMenuUL').append(menuitem);

    $(document).on('contextmenu', function (e) {
        e.preventDefault();

        $('#modeMenu').show();
        $('#modeMenu').offset({ left: e.clientX, top: e.clientY});
    });

    socket = new WebSocket('ws://' + window.location.hostname + '/' + roomid + '/socket/' + clientid);

    socket.onmessage = function (event) {
        drawables.push(JSON.parse(event.data));
        draw();
    };

    socket.onerror = function (event) {
        console.log(event);
    };

    socket.onclose = function (event) {
        socket = new WebSocket('ws://' + window.location.hostname + '/' + roomid + '/socket/' + clientid);
    };

    socket.onopen = function (event) {
        console.log('Websocket opened in room ' + roomid + ' for ' + clientid);
    };
});

function Circle() {
    this.start = [];
    this.end = [];
    this.type = 'circle';

    this.mouseClick = function (e) {
        if (1 != e.which) return true;

        if (this.start.length <= 0) {
            this.start = [ e.clientX, e.clientY ];
            return false;
        }

        this.end = [ e.clientX, e.clientY ];

        drawables.push(this);
        return true;
    }

    this.draw = function (context) {

    }

    return this;
}

function Line() {
    this.start = [];
    this.end = [];
    this.type = 'line';

    this.mouseClick = function (e) {
        if (1 != e.which) return true;

        if (this.start.length <= 0) {
            this.start = [ e.clientX, e.clientY ];
            return false;
        }

        this.end = [ e.clientX, e.clientY ];

        drawables.push(this);
        return true;
    }

    this.draw = function (context) {

    }

    return this;
}

function click(e) {
    console.log(e);

    if (1 != e.which) return true;

    if (!inprogress.hasOwnProperty('type')) {
        inprogress = new Item();
        inprogress.mouseClick(e);
        return true;
    } 

    if (inprogress.mouseClick(e)) {
        draw();
        socket.send(JSON.stringify(inprogress));
        inprogress = new Item();
        return true;
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

        if ('line' == drawable.type) {
            context.beginPath();
            context.moveTo(drawable.start[0], drawable.start[1]);
            context.lineTo(drawable.end[0], drawable.end[1]);
            context.stroke();

        } else if ('circle' == drawable.type) {
            var dx = drawable.start[0] - drawable.end[0];
            var dy = drawable.start[1] - drawable.end[1];

            var radius = Math.sqrt(dx * dx + dy * dy);

            context.beginPath();
            context.arc(drawable.start[0], drawable.start[1], radius, 0, 2 * Math.PI, false);
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
